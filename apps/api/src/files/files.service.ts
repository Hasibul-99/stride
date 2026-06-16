import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { ALLOWED_MIME_PREFIXES, type ConfirmUploadInput, type PresignInput } from '@teamboard/shared';
import { PrismaService } from '../prisma/prisma.service';
import { AccessService } from '../access/access.service';
import { S3Service } from './s3.service';

interface Target {
  taskId?: string;
  eventId?: string;
  messageId?: string;
}

@Injectable()
export class FilesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessService,
    private readonly s3: S3Service,
  ) {}

  private assertMime(mimeType: string) {
    if (!ALLOWED_MIME_PREFIXES.some((p) => mimeType.startsWith(p))) {
      throw new BadRequestException(`File type not allowed: ${mimeType}`);
    }
  }

  /** Resolve the project a target belongs to and assert access. */
  private async assertTargetAccess(userId: string, target: Target): Promise<void> {
    let projectId: string | null = null;
    if (target.taskId) {
      const t = await this.prisma.task.findFirst({
        where: { id: target.taskId, deletedAt: null },
        select: { projectId: true },
      });
      projectId = t?.projectId ?? null;
    } else if (target.messageId) {
      const m = await this.prisma.chatMessage.findUnique({
        where: { id: target.messageId },
        select: { task: { select: { projectId: true } } },
      });
      projectId = m?.task.projectId ?? null;
    } else if (target.eventId) {
      const e = await this.prisma.event.findFirst({
        where: { id: target.eventId, deletedAt: null },
        select: { projectId: true, createdById: true },
      });
      if (e && !e.projectId) {
        if (e.createdById !== userId) throw new ForbiddenException('No access');
        return;
      }
      projectId = e?.projectId ?? null;
    }
    if (!projectId) throw new NotFoundException('Upload target not found');
    await this.access.assertProjectAccess(userId, projectId);
  }

  /** Virus-scan hook stub — wire a real scanner here later. */
  private async virusScan(_key: string): Promise<void> {
    return;
  }

  async presign(userId: string, input: PresignInput) {
    this.assertMime(input.mimeType);
    await this.assertTargetAccess(userId, input.target);
    const ext = input.fileName.includes('.') ? input.fileName.split('.').pop() : 'bin';
    const s3Key = `uploads/${userId}/${randomUUID()}.${ext}`;
    const uploadUrl = await this.s3.presignPut(s3Key, input.mimeType);
    return { uploadUrl, s3Key };
  }

  async confirm(userId: string, input: ConfirmUploadInput) {
    this.assertMime(input.mimeType);
    await this.assertTargetAccess(userId, input.target);
    await this.virusScan(input.s3Key);
    return this.prisma.attachment.create({
      data: {
        taskId: input.target.taskId ?? null,
        eventId: input.target.eventId ?? null,
        messageId: input.target.messageId ?? null,
        uploaderId: userId,
        fileName: input.fileName,
        fileSize: input.size,
        mimeType: input.mimeType,
        s3Key: input.s3Key,
      },
    });
  }

  async listForTask(userId: string, taskId: string) {
    const task = await this.prisma.task.findFirst({
      where: { id: taskId, deletedAt: null },
      select: { projectId: true },
    });
    if (!task) throw new NotFoundException('Task not found');
    await this.access.assertProjectAccess(userId, task.projectId);
    // Include files posted directly + via this task's chat messages.
    return this.prisma.attachment.findMany({
      where: { OR: [{ taskId }, { message: { taskId } }] },
      include: { uploader: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async downloadUrl(userId: string, attachmentId: string) {
    const att = await this.loadWithAccess(userId, attachmentId);
    const url = await this.s3.presignGet(att.s3Key);
    return { url };
  }

  async remove(userId: string, attachmentId: string) {
    const att = await this.loadWithAccess(userId, attachmentId, true);
    await this.s3.delete(att.s3Key).catch(() => undefined);
    await this.prisma.attachment.delete({ where: { id: attachmentId } });
  }

  private async loadWithAccess(userId: string, attachmentId: string, mutating = false) {
    const att = await this.prisma.attachment.findUnique({ where: { id: attachmentId } });
    if (!att) throw new NotFoundException('Attachment not found');
    await this.assertTargetAccess(userId, {
      taskId: att.taskId ?? undefined,
      eventId: att.eventId ?? undefined,
      messageId: att.messageId ?? undefined,
    });
    if (mutating && att.uploaderId !== userId) {
      // Non-uploaders need workspace admin to delete.
      const projectId = att.taskId
        ? (await this.prisma.task.findUnique({ where: { id: att.taskId }, select: { projectId: true } }))?.projectId
        : null;
      if (projectId) {
        const project = await this.prisma.project.findUnique({
          where: { id: projectId },
          select: { workspaceId: true },
        });
        if (project) await this.access.assertWorkspaceMember(userId, project.workspaceId, ['OWNER', 'ADMIN']);
      } else {
        throw new ForbiddenException('Only the uploader can delete this file');
      }
    }
    return att;
  }
}
