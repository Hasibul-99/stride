import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { DIGEST_QUEUE, type DigestJob } from './digest.constants';

const LABELS: Record<string, string> = {
  TASK_ASSIGNED: 'You were assigned a task',
  MENTION: 'You were mentioned',
  INVITE: 'You were invited',
};

@Processor(DIGEST_QUEUE)
export class DigestProcessor extends WorkerHost {
  private readonly logger = new Logger(DigestProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
  ) {
    super();
  }

  /** Email a high-value notification only if it's still unread after the delay + user opted in. */
  async process(job: Job<DigestJob>): Promise<void> {
    const notif = await this.prisma.notification.findUnique({
      where: { id: job.data.notificationId },
      include: { user: { select: { email: true, emailNotifications: true, notifPrefs: true } } },
    });
    if (!notif || notif.readAt) return; // already seen → no email
    if (!notif.user.emailNotifications) return;

    const prefs = (notif.user.notifPrefs as Record<string, { email?: boolean }> | null) ?? {};
    if (prefs[notif.type]?.email === false) return;

    const subject = LABELS[notif.type] ?? 'TeamBoard notification';
    await this.mail.send(
      notif.user.email,
      subject,
      `<p>${subject}.</p><p>Open TeamBoard to see the details.</p>`,
    );
    this.logger.log(`Digest email sent to ${notif.user.email} for ${notif.type}`);
  }
}
