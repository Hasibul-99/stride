import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, Task } from '@prisma/client';
import type {
  BulkPositionsInput,
  CreateTaskInput,
  TaskQuery,
  UpdateTaskInput,
} from '@teamboard/shared';
import { PrismaService } from '../prisma/prisma.service';
import { AccessService } from '../access/access.service';

/** 'YYYY-MM-DD' → Date at UTC midnight (matches @db.Date storage). */
function dateOnlyToUtc(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

/** Date (UTC) → 'YYYY-MM-DD'. */
function utcToDateOnly(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function todayDateOnly(): string {
  return new Date().toISOString().slice(0, 10);
}

@Injectable()
export class TasksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessService,
  ) {}

  private serialize(task: Task) {
    return {
      ...task,
      scheduledDate: task.scheduledDate ? utcToDateOnly(task.scheduledDate) : null,
    };
  }

  async list(userId: string, projectId: string, query: TaskQuery) {
    await this.access.assertProjectAccess(userId, projectId);

    const where: Prisma.TaskWhereInput = { projectId, deletedAt: null };

    if (query.waitingList) {
      where.scheduledDate = null;
    } else if (query.scheduledFrom || query.scheduledTo) {
      where.scheduledDate = {};
      if (query.scheduledFrom) where.scheduledDate.gte = dateOnlyToUtc(query.scheduledFrom);
      if (query.scheduledTo) where.scheduledDate.lte = dateOnlyToUtc(query.scheduledTo);
    }
    if (query.assigneeId) where.assigneeId = query.assigneeId;
    if (query.statusId) where.statusId = query.statusId;
    if (!query.includeCompleted) where.completedAt = null;

    const tasks = await this.prisma.task.findMany({
      where,
      orderBy: [{ scheduledDate: 'asc' }, { position: 'asc' }],
    });
    return tasks.map((t) => this.serialize(t));
  }

  async get(userId: string, taskId: string) {
    const task = await this.loadAccessible(userId, taskId);
    return this.serialize(task);
  }

  async create(userId: string, projectId: string, input: CreateTaskInput) {
    await this.access.assertProjectAccess(userId, projectId);

    const statusId = input.statusId ?? (await this.defaultStatusId(projectId));

    const last = await this.prisma.task.findFirst({
      where: { projectId, statusId, scheduledDate: input.scheduledDate
        ? dateOnlyToUtc(input.scheduledDate)
        : null },
      orderBy: { position: 'desc' },
    });

    const task = await this.prisma.task.create({
      data: {
        projectId,
        title: input.title,
        description: (input.description ?? undefined) as Prisma.InputJsonValue | undefined,
        statusId,
        assigneeId: input.assigneeId ?? null,
        scheduledDate: input.scheduledDate ? dateOnlyToUtc(input.scheduledDate) : null,
        timeEstimateMinutes: input.timeEstimateMinutes ?? null,
        position: input.position ?? (last?.position ?? 0) + 1000,
        createdById: userId,
      },
    });
    return this.serialize(task);
  }

  async update(userId: string, taskId: string, input: UpdateTaskInput) {
    const task = await this.loadAccessible(userId, taskId);

    const data: Prisma.TaskUpdateInput = {};
    if (input.title !== undefined) data.title = input.title;
    if (input.description !== undefined) {
      data.description = input.description as Prisma.InputJsonValue;
    }
    if (input.assigneeId !== undefined) {
      data.assignee = input.assigneeId
        ? { connect: { id: input.assigneeId } }
        : { disconnect: true };
    }
    if (input.timeEstimateMinutes !== undefined) {
      data.timeEstimateMinutes = input.timeEstimateMinutes;
    }
    if (input.position !== undefined) data.position = input.position;
    if (input.scheduledDate !== undefined) {
      data.scheduledDate = input.scheduledDate ? dateOnlyToUtc(input.scheduledDate) : null;
    }

    // Status change drives completion semantics.
    if (input.statusId !== undefined && input.statusId !== task.statusId) {
      const newStatus = await this.prisma.taskStatus.findUnique({
        where: { id: input.statusId },
      });
      if (!newStatus || newStatus.projectId !== task.projectId) {
        throw new BadRequestException('Invalid statusId for this project');
      }
      data.status = { connect: { id: input.statusId } };

      if (newStatus.isCompleted && !task.completedAt) {
        // Complete: stamp completedAt + snap to the completion day (unless caller set a date).
        data.completedAt = new Date();
        if (input.scheduledDate === undefined) {
          data.scheduledDate = dateOnlyToUtc(todayDateOnly());
        }
      } else if (!newStatus.isCompleted && task.completedAt) {
        // Reopen.
        data.completedAt = null;
      }
    }

    const updated = await this.prisma.task.update({ where: { id: taskId }, data });
    return this.serialize(updated);
  }

  async remove(userId: string, taskId: string) {
    const task = await this.loadAccessible(userId, taskId);
    await this.prisma.task.update({
      where: { id: task.id },
      data: { deletedAt: new Date() },
    });
  }

  /** Bulk position/status/date updates for drag-and-drop, in one transaction. */
  async bulkPositions(userId: string, projectId: string, input: BulkPositionsInput) {
    await this.access.assertProjectAccess(userId, projectId);

    const ids = input.updates.map((u) => u.id);
    const owned = await this.prisma.task.findMany({
      where: { id: { in: ids }, projectId, deletedAt: null },
      select: { id: true, statusId: true, completedAt: true },
    });
    if (owned.length !== ids.length) {
      throw new BadRequestException('Some tasks do not belong to this project');
    }
    const ownedMap = new Map(owned.map((t) => [t.id, t]));

    // Resolve which target statuses are "completed" to apply snap/stamp.
    const targetStatusIds = [
      ...new Set(input.updates.map((u) => u.statusId).filter((s): s is string => !!s)),
    ];
    const statuses = targetStatusIds.length
      ? await this.prisma.taskStatus.findMany({
          where: { id: { in: targetStatusIds }, projectId },
        })
      : [];
    const completedSet = new Set(statuses.filter((s) => s.isCompleted).map((s) => s.id));
    if (statuses.length !== targetStatusIds.length) {
      throw new BadRequestException('Some statuses do not belong to this project');
    }

    await this.prisma.$transaction(
      input.updates.map((u) => {
        const current = ownedMap.get(u.id)!;
        const data: Prisma.TaskUncheckedUpdateInput = { position: u.position };
        if (u.statusId) data.statusId = u.statusId;
        if (u.scheduledDate !== undefined) {
          data.scheduledDate = u.scheduledDate ? dateOnlyToUtc(u.scheduledDate) : null;
        }
        const becomesCompleted = u.statusId ? completedSet.has(u.statusId) : false;
        if (becomesCompleted && !current.completedAt) {
          data.completedAt = new Date();
          if (u.scheduledDate === undefined) data.scheduledDate = dateOnlyToUtc(todayDateOnly());
        } else if (u.statusId && !becomesCompleted && current.completedAt) {
          data.completedAt = null;
        }
        return this.prisma.task.update({ where: { id: u.id }, data });
      }),
    );
    return { updated: input.updates.length };
  }

  private async defaultStatusId(projectId: string): Promise<string> {
    const status = await this.prisma.taskStatus.findFirst({
      where: { projectId },
      orderBy: [{ isDefault: 'desc' }, { position: 'asc' }],
    });
    if (!status) throw new BadRequestException('Project has no statuses');
    return status.id;
  }

  private async loadAccessible(userId: string, taskId: string): Promise<Task> {
    const task = await this.prisma.task.findFirst({
      where: { id: taskId, deletedAt: null },
    });
    if (!task) throw new NotFoundException('Task not found');
    await this.access.assertProjectAccess(userId, task.projectId);
    return task;
  }
}
