import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { REMINDERS_QUEUE, type ReminderJob } from './reminders.constants';

@Processor(REMINDERS_QUEUE)
export class RemindersProcessor extends WorkerHost {
  private readonly logger = new Logger(RemindersProcessor.name);

  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async process(job: Job<ReminderJob>): Promise<void> {
    const { eventId, userId } = job.data;
    const event = await this.prisma.event.findFirst({
      where: { id: eventId, deletedAt: null },
      select: { id: true, title: true, startAt: true },
    });
    if (!event) return; // event removed — skip silently

    await this.prisma.notification.create({
      data: {
        userId,
        type: 'EVENT_REMINDER',
        payload: { eventId: event.id, title: event.title, startAt: event.startAt.toISOString() },
      },
    });
    this.logger.log(`Reminder notification created for event ${eventId} → user ${userId}`);
  }
}
