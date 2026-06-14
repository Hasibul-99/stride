import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { CreateStatusInput, UpdateStatusInput } from '@teamboard/shared';
import { PrismaService } from '../prisma/prisma.service';
import { AccessService } from '../access/access.service';

@Injectable()
export class StatusesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessService,
  ) {}

  async list(userId: string, projectId: string) {
    await this.access.assertProjectAccess(userId, projectId);
    return this.prisma.taskStatus.findMany({
      where: { projectId },
      orderBy: { position: 'asc' },
    });
  }

  async create(userId: string, projectId: string, input: CreateStatusInput) {
    await this.access.assertProjectAccess(userId, projectId);
    const last = await this.prisma.taskStatus.findFirst({
      where: { projectId },
      orderBy: { position: 'desc' },
    });
    return this.prisma.taskStatus.create({
      data: {
        projectId,
        name: input.name,
        color: input.color ?? 'slate',
        isCompleted: input.isCompleted ?? false,
        position: (last?.position ?? 0) + 1000,
      },
    });
  }

  async update(userId: string, statusId: string, input: UpdateStatusInput) {
    const status = await this.prisma.taskStatus.findUnique({ where: { id: statusId } });
    if (!status) throw new NotFoundException('Status not found');
    await this.access.assertProjectAccess(userId, status.projectId);

    // Prevent removing the project's last completed status via the isCompleted flag.
    if (input.isCompleted === false && status.isCompleted) {
      const completedCount = await this.prisma.taskStatus.count({
        where: { projectId: status.projectId, isCompleted: true },
      });
      if (completedCount <= 1) {
        throw new BadRequestException('A project must keep at least one completed status');
      }
    }

    return this.prisma.taskStatus.update({ where: { id: statusId }, data: input });
  }

  /** Delete a status, migrating its tasks to targetStatusId. */
  async remove(userId: string, statusId: string, targetStatusId: string) {
    const status = await this.prisma.taskStatus.findUnique({ where: { id: statusId } });
    if (!status) throw new NotFoundException('Status not found');
    await this.access.assertProjectAccess(userId, status.projectId);

    if (targetStatusId === statusId) {
      throw new BadRequestException('targetStatusId must differ from the deleted status');
    }
    const target = await this.prisma.taskStatus.findUnique({ where: { id: targetStatusId } });
    if (!target || target.projectId !== status.projectId) {
      throw new BadRequestException('targetStatusId must belong to the same project');
    }

    if (status.isCompleted) {
      const completedCount = await this.prisma.taskStatus.count({
        where: { projectId: status.projectId, isCompleted: true },
      });
      if (completedCount <= 1) {
        throw new BadRequestException('Cannot delete the last completed status');
      }
    }

    await this.prisma.$transaction([
      this.prisma.task.updateMany({
        where: { statusId },
        data: { statusId: targetStatusId },
      }),
      this.prisma.taskStatus.delete({ where: { id: statusId } }),
    ]);
  }
}
