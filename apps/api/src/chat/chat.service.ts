import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AccessService } from '../access/access.service';

@Injectable()
export class ChatService {
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

  async assertAccess(userId: string, taskId: string): Promise<string> {
    const projectId = await this.taskProject(taskId);
    await this.access.assertProjectAccess(userId, projectId);
    return projectId;
  }

  /** Cursor-paginated history (newest first). */
  async history(userId: string, taskId: string, cursor?: string, take = 30) {
    await this.assertAccess(userId, taskId);
    const messages = await this.prisma.chatMessage.findMany({
      where: { taskId },
      include: { author: { select: { id: true, name: true, avatarUrl: true } } },
      orderBy: { createdAt: 'desc' },
      take: take + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });
    const hasMore = messages.length > take;
    const page = hasMore ? messages.slice(0, take) : messages;
    return { messages: page.reverse(), nextCursor: hasMore ? page[0]?.id : null };
  }

  async send(userId: string, taskId: string, body: string) {
    await this.assertAccess(userId, taskId);
    return this.prisma.chatMessage.create({
      data: { taskId, authorId: userId, body },
      include: { author: { select: { id: true, name: true, avatarUrl: true } } },
    });
  }

  async edit(userId: string, messageId: string, body: string) {
    const msg = await this.prisma.chatMessage.findUnique({ where: { id: messageId } });
    if (!msg) throw new NotFoundException('Message not found');
    if (msg.authorId !== userId) throw new ForbiddenException('Not your message');
    return this.prisma.chatMessage.update({
      where: { id: messageId },
      data: { body, editedAt: new Date() },
      include: { author: { select: { id: true, name: true, avatarUrl: true } } },
    });
  }

  async remove(userId: string, messageId: string) {
    const msg = await this.prisma.chatMessage.findUnique({ where: { id: messageId } });
    if (!msg) throw new NotFoundException('Message not found');
    if (msg.authorId !== userId) throw new ForbiddenException('Not your message');
    await this.prisma.chatMessage.delete({ where: { id: messageId } });
    return { id: messageId, taskId: msg.taskId };
  }

  async markRead(userId: string, taskId: string) {
    await this.assertAccess(userId, taskId);
    const messages = await this.prisma.chatMessage.findMany({
      where: { taskId, reads: { none: { userId } } },
      select: { id: true },
    });
    if (messages.length === 0) return { read: 0 };
    await this.prisma.messageRead.createMany({
      data: messages.map((m) => ({ messageId: m.id, userId })),
      skipDuplicates: true,
    });
    return { read: messages.length };
  }

  async unreadCount(userId: string, taskId: string): Promise<number> {
    return this.prisma.chatMessage.count({
      where: { taskId, authorId: { not: userId }, reads: { none: { userId } } },
    });
  }
}
