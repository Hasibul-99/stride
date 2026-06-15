import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AccessService } from '../access/access.service';

function dateOnlyToUtc(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}
function utcToDateOnly(d: Date): string {
  return d.toISOString().slice(0, 10);
}

@Injectable()
export class PlannerService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessService,
  ) {}

  /**
   * Tasks across every project in the workspace the user can see, scheduled
   * within [from, to]. Powers the TEAM calendar. Enriched with project,
   * status and assignee so the client can render across many projects.
   */
  async planner(
    userId: string,
    workspaceId: string,
    from: string,
    to: string,
    assigneeId?: string,
  ) {
    await this.access.assertWorkspaceMember(userId, workspaceId);

    const where: Prisma.TaskWhereInput = {
      deletedAt: null,
      scheduledDate: { gte: dateOnlyToUtc(from), lte: dateOnlyToUtc(to) },
      project: { workspaceId, deletedAt: null },
    };
    if (assigneeId) where.assigneeId = assigneeId;

    const tasks = await this.prisma.task.findMany({
      where,
      orderBy: [{ scheduledDate: 'asc' }, { position: 'asc' }],
      include: {
        project: { select: { id: true, name: true, color: true } },
        status: { select: { id: true, name: true, color: true, isCompleted: true } },
        assignee: { select: { id: true, name: true, avatarUrl: true } },
      },
    });

    return tasks.map((t) => ({
      ...t,
      scheduledDate: t.scheduledDate ? utcToDateOnly(t.scheduledDate) : null,
    }));
  }

  /** Workspace members (for grouping rows + assignee filters). */
  async members(userId: string, workspaceId: string) {
    await this.access.assertWorkspaceMember(userId, workspaceId);
    const rows = await this.prisma.workspaceMember.findMany({
      where: { workspaceId },
      include: { user: { select: { id: true, name: true, avatarUrl: true } } },
      orderBy: { joinedAt: 'asc' },
    });
    return rows.map((m) => m.user);
  }
}
