import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly transporter: nodemailer.Transporter;

  constructor(private readonly config: ConfigService) {
    this.transporter = nodemailer.createTransport({
      host: this.config.getOrThrow<string>('SMTP_HOST'),
      port: this.config.get<number>('SMTP_PORT') ?? 1025,
      secure: false,
      auth: this.config.get<string>('SMTP_USER')
        ? {
            user: this.config.get<string>('SMTP_USER'),
            pass: this.config.get<string>('SMTP_PASS'),
          }
        : undefined,
    });
  }

  async send(to: string, subject: string, html: string): Promise<void> {
    try {
      await this.transporter.sendMail({
        from: this.config.get<string>('SMTP_FROM') ?? 'TeamBoard <no-reply@teamboard.local>',
        to,
        subject,
        html,
      });
    } catch (err) {
      this.logger.error(`Failed to send mail to ${to}: ${String(err)}`);
    }
  }

  async sendInvite(to: string, workspaceName: string, acceptUrl: string): Promise<void> {
    await this.send(
      to,
      `You've been invited to ${workspaceName} on TeamBoard`,
      `<p>You've been invited to join <strong>${workspaceName}</strong>.</p>
       <p><a href="${acceptUrl}">Accept the invitation</a></p>`,
    );
  }
}
