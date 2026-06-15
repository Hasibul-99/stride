import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { REMINDERS_QUEUE, type ReminderJob } from './reminders.constants';

@Injectable()
export class RemindersService {
  private readonly logger = new Logger(RemindersService.name);

  constructor(@InjectQueue(REMINDERS_QUEUE) private readonly queue: Queue<ReminderJob>) {}

  private jobId(eventId: string, userId: string): string {
    return `rem:${eventId}:${userId}`;
  }

  /** (Re)schedule a delayed reminder for one participant. No-op if it's in the past. */
  async schedule(eventId: string, userId: string, fireAt: Date): Promise<void> {
    const jobId = this.jobId(eventId, userId);
    await this.cancel(eventId, userId);
    const delay = fireAt.getTime() - Date.now();
    if (delay <= 0) return;
    try {
      await this.queue.add(REMINDERS_QUEUE, { eventId, userId }, { jobId, delay, removeOnComplete: true });
    } catch (err) {
      this.logger.warn(`Could not schedule reminder ${jobId}: ${String(err)}`);
    }
  }

  async cancel(eventId: string, userId: string): Promise<void> {
    try {
      const job = await this.queue.getJob(this.jobId(eventId, userId));
      if (job) await job.remove();
    } catch {
      // ignore
    }
  }
}
