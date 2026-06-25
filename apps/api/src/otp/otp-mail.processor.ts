import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { OTP_EXPIRY_MINUTES } from '@teamboard/shared';
import { MailService } from '../mail/mail.service';
import { OTP_MAIL_QUEUE, type OtpMailJob } from './otp.constants';

@Processor(OTP_MAIL_QUEUE)
export class OtpMailProcessor extends WorkerHost {
  private readonly logger = new Logger(OtpMailProcessor.name);

  constructor(private readonly mail: MailService) {
    super();
  }

  async process(job: Job<OtpMailJob>): Promise<void> {
    const { email, purpose, code } = job.data;
    const isReset = purpose === 'password_reset';
    const subject = isReset ? 'Reset your password' : 'Verify your email';
    const intro = isReset
      ? 'Use the code below to reset your TeamBoard password.'
      : 'Welcome to TeamBoard! Use the code below to verify your email address.';
    const reset = isReset
      ? `<p style="color:#6b7280;font-size:13px">If you didn't request a password reset, you can safely ignore this email — your password won't change.</p>`
      : '';

    const html = `
      <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;max-width:480px;margin:0 auto;color:#1a1d23">
        <p>${intro}</p>
        <div style="font-size:36px;font-weight:700;letter-spacing:10px;text-align:center;padding:20px;background:#f1f3f6;border-radius:10px;margin:16px 0">${code}</div>
        <p style="color:#6b7280;font-size:13px">This code expires in ${OTP_EXPIRY_MINUTES} minutes.</p>
        ${reset}
      </div>`;

    await this.mail.send(email, subject, html);
    this.logger.log(`OTP email dispatched (${purpose}) to ${email}`);
  }
}
