import { Injectable } from '@nestjs/common';
import { DEFAULT_CAPACITY_MINUTES } from '@teamboard/shared';
import type { SetCapacityInput } from '@teamboard/shared';
import { PrismaService } from '../prisma/prisma.service';
import { AccessService } from '../access/access.service';

export interface Cell {
  taskMinutes: number;
  eventMinutes: number;
  taskCount: number;
  unestimatedCount: number;
}

function dateOnly(d: Date): string {
  return d.toISOString().slice(0, 10);
}

@Injectable()
export class WorkloadService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessService,
  ) {}

  async workload(userId: string, workspaceId: string, from: string, to: string) {
    await this.access.assertWorkspaceMember(userId, workspaceId);

    const fromUtc = new Date(`${from}T00:00:00.000Z`);
    const toUtc = new Date(`${to}T23:59:59.999Z`);

    const members = await this.prisma.workspaceMember.findMany({
      where: { workspaceId },
      include: { user: { select: { id: true, name: true, avatarUrl: true } } },
      orderBy: { joinedAt: 'asc' },
    });

    const capacities = await this.prisma.memberCapacity.findMany({ where: { workspaceId } });
    const capByUser = new Map(capacities.map((c) => [c.userId, c.dailyMinutes]));

    const tasks = await this.prisma.task.findMany({
      where: {
        deletedAt: null,
        assigneeId: { not: null },
        scheduledDate: { gte: fromUtc, lte: toUtc },
        project: { workspaceId, deletedAt: null },
      },
      select: { assigneeId: true, scheduledDate: true, timeEstimateMinutes: true },
    });

    const events = await this.prisma.event.findMany({
      where: {
        deletedAt: null,
        startAt: { gte: fromUtc, lte: toUtc },
        project: { workspaceId },
      },
      select: { startAt: true, endAt: true, participants: { select: { userId: true } } },
    });

    // cells[userId][iso]
    const cells: Record<string, Record<string, Cell>> = {};
    const ensure = (uid: string, iso: string): Cell => {
      (cells[uid] ??= {});
      return (cells[uid][iso] ??= { taskMinutes: 0, eventMinutes: 0, taskCount: 0, unestimatedCount: 0 });
    };

    for (const t of tasks) {
      if (!t.assigneeId || !t.scheduledDate) continue;
      const c = ensure(t.assigneeId, dateOnly(t.scheduledDate));
      c.taskCount += 1;
      if (t.timeEstimateMinutes) c.taskMinutes += t.timeEstimateMinutes;
      else c.unestimatedCount += 1;
    }

    for (const e of events) {
      const mins = Math.round((e.endAt.getTime() - e.startAt.getTime()) / 60000);
      const iso = dateOnly(e.startAt);
      for (const p of e.participants) {
        if (!p.userId) continue;
        ensure(p.userId, iso).eventMinutes += mins;
      }
    }

    return {
      members: members.map((m) => ({
        userId: m.user.id,
        name: m.user.name,
        avatarUrl: m.user.avatarUrl,
        capacityMinutes: capByUser.get(m.user.id) ?? DEFAULT_CAPACITY_MINUTES,
      })),
      cells,
    };
  }

  async setCapacity(userId: string, workspaceId: string, input: SetCapacityInput) {
    await this.access.assertWorkspaceMember(userId, workspaceId, ['OWNER', 'ADMIN']);
    return this.prisma.memberCapacity.upsert({
      where: { workspaceId_userId: { workspaceId, userId: input.userId } },
      update: { dailyMinutes: input.dailyMinutes },
      create: { workspaceId, userId: input.userId, dailyMinutes: input.dailyMinutes },
    });
  }
}
