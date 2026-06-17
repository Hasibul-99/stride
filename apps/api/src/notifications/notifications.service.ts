import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { Prisma } from '@prisma/client';
import { HIGH_VALUE_NOTIF_TYPES, SOCKET_EVENTS, type UpdateNotifPrefsInput } from '@teamboard/shared';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeEmitter } from '../realtime/realtime.emitter';
import { DIGEST_QUEUE } from './digest.constants';

@Injectable()
export class NotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly emitter: RealtimeEmitter,
    @InjectQueue(DIGEST_QUEUE) private readonly digestQueue: Queue,
  ) {}

  /** Persist a notification, push to the user's socket, and queue an email digest for high-value types. */
  async create(userId: string, type: string, payload: Prisma.InputJsonValue) {
    const notif = await this.prisma.notification.create({ data: { userId, type, payload } });
    this.emitter.emitUser(userId, SOCKET_EVENTS.notificationNew, notif);

    if ((HIGH_VALUE_NOTIF_TYPES as readonly string[]).includes(type)) {
      // Send an email only if still unseen after 10 minutes (checked in the processor).
      await this.digestQueue
        .add('digest', { notificationId: notif.id }, { delay: 10 * 60_000, removeOnComplete: true })
        .catch(() => undefined);
    }
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

  async getPrefs(userId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { emailNotifications: true, notifPrefs: true },
    });
    return { emailNotifications: user.emailNotifications, prefs: user.notifPrefs ?? {} };
  }

  async updatePrefs(userId: string, input: UpdateNotifPrefsInput) {
    const data: Prisma.UserUpdateInput = {};
    if (input.emailNotifications !== undefined) data.emailNotifications = input.emailNotifications;
    if (input.prefs !== undefined) data.notifPrefs = input.prefs as Prisma.InputJsonValue;
    await this.prisma.user.update({ where: { id: userId }, data });
    return this.getPrefs(userId);
  }
}
