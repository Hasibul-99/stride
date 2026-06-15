import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type {
  ManualTimeEntryInput,
  TimeReportQuery,
  UpdateTimeEntryInput,
} from '@teamboard/shared';
import { PrismaService } from '../prisma/prisma.service';
import { AccessService } from '../access/access.service';

@Injectable()
export class TimeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessService,
  ) {}

  private async taskProject(taskId: string): Promise<string> {
    const task = await this.prisma.task.findFirst({
      where: { id: taskId, deletedAt: null },
      select: { projectId: true },
    });
    if (!task) throw new NotFoundException('Task not found');
    return task.projectId;
  }

  private duration(startedAt: Date, stoppedAt: Date): number {
    return Math.max(0, Math.round((stoppedAt.getTime() - startedAt.getTime()) / 1000));
  }

  /** Start a timer; stops any other running entry for this user (one at a time). */
  async start(userId: string, taskId: string) {
    const projectId = await this.taskProject(taskId);
    await this.access.assertProjectAccess(userId, projectId);
    await this.stopAllRunning(userId);
    return this.prisma.timeEntry.create({
      data: { taskId, userId, startedAt: new Date() },
    });
  }

  async stop(userId: string, taskId: string) {
    const running = await this.prisma.timeEntry.findFirst({
      where: { taskId, userId, stoppedAt: null },
    });
    if (!running) throw new NotFoundException('No running timer for this task');
    return this.finalize(running.id, running.startedAt, new Date());
  }

  /** Stop every running entry for a user. Returns count stopped. */
  async stopAllRunning(userId: string): Promise<void> {
    const running = await this.prisma.timeEntry.findMany({
      where: { userId, stoppedAt: null },
    });
    const now = new Date();
    await this.prisma.$transaction(
      running.map((e) =>
        this.prisma.timeEntry.update({
          where: { id: e.id },
          data: { stoppedAt: now, durationSeconds: this.duration(e.startedAt, now) },
        }),
      ),
    );
  }

  private finalize(id: string, startedAt: Date, stoppedAt: Date) {
    return this.prisma.timeEntry.update({
      where: { id },
      data: { stoppedAt, durationSeconds: this.duration(startedAt, stoppedAt) },
    });
  }

  /** The user's currently running entry (for the global timer pill). */
  async running(userId: string) {
    return this.prisma.timeEntry.findFirst({
      where: { userId, stoppedAt: null },
      include: { task: { select: { id: true, title: true, projectId: true } } },
    });
  }

  async listForTask(userId: string, taskId: string) {
    const projectId = await this.taskProject(taskId);
    await this.access.assertProjectAccess(userId, projectId);
    const entries = await this.prisma.timeEntry.findMany({
      where: { taskId },
      include: { user: { select: { id: true, name: true, avatarUrl: true } } },
      orderBy: { startedAt: 'desc' },
    });
    const total = entries.reduce((s, e) => s + (e.durationSeconds ?? 0), 0);
    return { entries, totalSeconds: total };
  }

  async addManual(userId: string, taskId: string, input: ManualTimeEntryInput) {
    const projectId = await this.taskProject(taskId);
    await this.access.assertProjectAccess(userId, projectId);
    const startedAt = new Date(input.startedAt);
    const stoppedAt = new Date(input.stoppedAt);
    return this.prisma.timeEntry.create({
      data: { taskId, userId, startedAt, stoppedAt, durationSeconds: this.duration(startedAt, stoppedAt) },
    });
  }

  async updateEntry(userId: string, entryId: string, input: UpdateTimeEntryInput) {
    const entry = await this.loadEditable(userId, entryId);
    const startedAt = input.startedAt ? new Date(input.startedAt) : entry.startedAt;
    const stoppedAt =
      input.stoppedAt === undefined
        ? entry.stoppedAt
        : input.stoppedAt
          ? new Date(input.stoppedAt)
          : null;
    return this.prisma.timeEntry.update({
      where: { id: entryId },
      data: {
        startedAt,
        stoppedAt,
        durationSeconds: stoppedAt ? this.duration(startedAt, stoppedAt) : null,
      },
    });
  }

  async deleteEntry(userId: string, entryId: string) {
    await this.loadEditable(userId, entryId);
    await this.prisma.timeEntry.delete({ where: { id: entryId } });
  }

  /** Own entries always; otherwise require workspace ADMIN/OWNER. */
  private async loadEditable(userId: string, entryId: string) {
    const entry = await this.prisma.timeEntry.findUnique({
      where: { id: entryId },
      include: { task: { select: { projectId: true } } },
    });
    if (!entry) throw new NotFoundException('Time entry not found');
    if (entry.userId === userId) return entry;

    const project = await this.prisma.project.findUnique({
      where: { id: entry.task.projectId },
      select: { workspaceId: true },
    });
    if (!project) throw new NotFoundException('Project not found');
    try {
      await this.access.assertWorkspaceMember(userId, project.workspaceId, ['OWNER', 'ADMIN']);
    } catch {
      throw new ForbiddenException('Can only edit your own time entries');
    }
    return entry;
  }

  // ─── Report ────────────────────────────────────────────

  async report(userId: string, workspaceId: string, query: TimeReportQuery) {
    await this.access.assertWorkspaceMember(userId, workspaceId);

    const where: Prisma.TimeEntryWhereInput = {
      task: { project: { workspaceId } },
      durationSeconds: { not: null },
    };
    if (query.from || query.to) {
      where.startedAt = {};
      if (query.from) where.startedAt.gte = new Date(query.from);
      if (query.to) where.startedAt.lte = new Date(query.to);
    }
    if (query.userId) where.userId = query.userId;
    if (query.projectId) where.task = { projectId: query.projectId };

    const entries = await this.prisma.timeEntry.findMany({
      where,
      include: {
        user: { select: { id: true, name: true } },
        task: { select: { id: true, title: true, project: { select: { id: true, name: true } } } },
      },
      orderBy: { startedAt: 'desc' },
    });

    const totalSeconds = entries.reduce((s, e) => s + (e.durationSeconds ?? 0), 0);
    const byUser = this.groupSum(entries, (e) => e.user.name);
    const byProject = this.groupSum(entries, (e) => e.task.project.name);
    return { totalSeconds, byUser, byProject, entries };
  }

  private groupSum<T extends { durationSeconds: number | null }>(
    rows: T[],
    key: (r: T) => string,
  ): { label: string; seconds: number }[] {
    const map = new Map<string, number>();
    for (const r of rows) map.set(key(r), (map.get(key(r)) ?? 0) + (r.durationSeconds ?? 0));
    return [...map.entries()].map(([label, seconds]) => ({ label, seconds }));
  }

  async reportCsv(userId: string, workspaceId: string, query: TimeReportQuery): Promise<string> {
    const { entries } = await this.report(userId, workspaceId, query);
    const header = 'User,Project,Task,Started,Stopped,DurationSeconds';
    const lines = entries.map((e) =>
      [
        csv(e.user.name),
        csv(e.task.project.name),
        csv(e.task.title),
        e.startedAt.toISOString(),
        e.stoppedAt?.toISOString() ?? '',
        e.durationSeconds ?? 0,
      ].join(','),
    );
    return [header, ...lines].join('\n');
  }
}

function csv(value: string): string {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}
