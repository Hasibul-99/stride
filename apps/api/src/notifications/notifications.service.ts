import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { SOCKET_EVENTS } from '@teamboard/shared';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeEmitter } from '../realtime/realtime.emitter';

@Injectable()
export class NotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly emitter: RealtimeEmitter,
  ) {}

  /** Persist a notification and push it to the user's socket room. */
  async create(userId: string, type: string, payload: Prisma.InputJsonValue) {
    const notif = await this.prisma.notification.create({
      data: { userId, type, payload },
    });
    this.emitter.emitUser(userId, SOCKET_EVENTS.notificationNew, notif);
    return notif;
  }

  async list(userId: string, cursor?: string, take = 20) {
    const items = await this.prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: take + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });
    const hasMore = items.length > take;
    const page = hasMore ? items.slice(0, take) : items;
    return { items: page, nextCursor: hasMore ? page[page.length - 1]?.id : null };
  }

  async unreadCount(userId: string): Promise<number> {
    return this.prisma.notification.count({ where: { userId, readAt: null } });
  }

  async markRead(userId: string, id: string) {
    await this.prisma.notification.updateMany({
      where: { id, userId, readAt: null },
      data: { readAt: new Date() },
    });
    return { ok: true };
  }

  async markAllRead(userId: string) {
    await this.prisma.notification.updateMany({
      where: { userId, readAt: null },
      data: { readAt: new Date() },
    });
    return { ok: true };
  }
}
