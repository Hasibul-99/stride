import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { randomInt } from 'node:crypto';
import * as argon2 from 'argon2';
import {
  OTP_EXPIRY_MINUTES,
  OTP_LENGTH,
  OTP_MAX_ATTEMPTS,
  OTP_MAX_SENDS_PER_HOUR,
  OTP_RESEND_COOLDOWN_SECONDS,
  type OtpPurpose,
} from '@teamboard/shared';
import { PrismaService } from '../prisma/prisma.service';
import { OTP_MAIL_QUEUE, type OtpMailJob, type OtpVerifyResult } from './otp.constants';

const HOUR_MS = 60 * 60 * 1000;

/**
 * Issues + verifies short numeric OTP codes for email verification and password
 * reset. Security model (codes are weak by design — 4 digits — so these controls
 * are mandatory):
 *  - codes stored hashed (argon2), never raw;
 *  - one active code per (email, purpose) — re-issuing overwrites the prior;
 *  - 10-minute expiry; 5 verify attempts then the code is invalidated;
 *  - 60s resend cooldown + max 5 sends/hour per (email, purpose).
 * Cooldown / hourly-cap hits are swallowed (logged, no-op) so callers can always
 * return a generic response without leaking timing or account existence.
 */
@Injectable()
export class OtpService {
  private readonly logger = new Logger(OtpService.name);

  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue(OTP_MAIL_QUEUE) private readonly mailQueue: Queue<OtpMailJob>,
  ) {}

  /** Cryptographically-random zero-padded numeric code of OTP_LENGTH digits. */
  private generateCode(): string {
    return randomInt(0, 10 ** OTP_LENGTH)
      .toString()
      .padStart(OTP_LENGTH, '0');
  }

  /**
   * Issue (or re-issue) a code for (email, purpose) and queue its email.
   * No-op (logged) when the 60s cooldown or hourly send cap is active.
   */
  async issue(email: string, purpose: OtpPurpose): Promise<void> {
    const now = new Date();
    const existing = await this.prisma.otpVerification.findUnique({
      where: { email_purpose: { email, purpose } },
    });

    if (existing?.lastSentAt) {
      const sinceMs = now.getTime() - existing.lastSentAt.getTime();
      if (sinceMs < OTP_RESEND_COOLDOWN_SECONDS * 1000) {
        this.logger.warn(`OTP issue throttled (cooldown) for ${purpose}:${email}`);
        return;
      }
    }

    // Sliding hourly window: reset the counter once the last send is >1h ago.
    const withinHour = existing?.lastSentAt && now.getTime() - existing.lastSentAt.getTime() < HOUR_MS;
    const sendCount = withinHour ? (existing?.sendCount ?? 0) + 1 : 1;
    if (sendCount > OTP_MAX_SENDS_PER_HOUR) {
      this.logger.warn(`OTP issue blocked (hourly cap) for ${purpose}:${email}`);
      return;
    }

    const code = this.generateCode();
    const codeHash = await argon2.hash(code);
    const expiresAt = new Date(now.getTime() + OTP_EXPIRY_MINUTES * 60 * 1000);

    await this.prisma.otpVerification.upsert({
      where: { email_purpose: { email, purpose } },
      create: { email, purpose, codeHash, expiresAt, attempts: 0, sendCount: 1, lastSentAt: now },
      update: { codeHash, expiresAt, attempts: 0, sendCount, lastSentAt: now },
    });

    await this.enqueueMail({ email, purpose, code });
    this.logger.log(`OTP issued for ${purpose}:${email} (send #${sendCount})`);
  }

  /** Enqueue the OTP email. Isolated so failures don't break the request (and easy to spy in tests). */
  private async enqueueMail(job: OtpMailJob): Promise<void> {
    try {
      await this.mailQueue.add('send', job, { removeOnComplete: true, attempts: 3 });
    } catch (err) {
      this.logger.error(`Failed to enqueue OTP mail for ${job.email}: ${String(err)}`);
    }
  }

  /**
   * Check a submitted code. Increments the attempt counter; invalidates the code
   * once attempts are exhausted (the 6th try). On success, optionally consumes
   * (deletes) the code. Returns a typed result; the caller maps it to a generic message.
   */
  async verify(
    email: string,
    purpose: OtpPurpose,
    code: string,
    opts: { consume?: boolean } = {},
  ): Promise<OtpVerifyResult> {
    const row = await this.prisma.otpVerification.findUnique({
      where: { email_purpose: { email, purpose } },
    });

    if (!row) {
      this.logger.warn(`OTP verify miss (no code) for ${purpose}:${email}`);
      return { ok: false, reason: 'invalid' };
    }

    if (row.expiresAt.getTime() < Date.now()) {
      await this.deleteCode(email, purpose);
      this.logger.warn(`OTP verify expired for ${purpose}:${email}`);
      return { ok: false, reason: 'expired' };
    }

    // Attempts already exhausted before this try → invalidate + force resend.
    if (row.attempts >= OTP_MAX_ATTEMPTS) {
      await this.deleteCode(email, purpose);
      this.logger.warn(`OTP verify locked (attempts exhausted) for ${purpose}:${email}`);
      return { ok: false, reason: 'locked' };
    }

    const valid = await argon2.verify(row.codeHash, code);
    if (!valid) {
      const attempts = row.attempts + 1;
      await this.prisma.otpVerification.update({
        where: { email_purpose: { email, purpose } },
        data: { attempts },
      });
      this.logger.warn(`OTP verify wrong code (${attempts}/${OTP_MAX_ATTEMPTS}) for ${purpose}:${email}`);
      return { ok: false, reason: 'invalid' };
    }

    if (opts.consume) await this.deleteCode(email, purpose);
    this.logger.log(`OTP verified for ${purpose}:${email}`);
    return { ok: true };
  }

  async deleteCode(email: string, purpose: OtpPurpose): Promise<void> {
    await this.prisma.otpVerification.deleteMany({ where: { email, purpose } });
  }

  /**
   * Delete unverified users older than 24h (plus their empty personal workspace,
   * since Workspace.owner is not cascade-deleted) and any expired OTP rows.
   * Returns the number of users removed.
   */
  async cleanupStaleUnverified(): Promise<number> {
    const cutoff = new Date(Date.now() - 24 * HOUR_MS);
    const stale = await this.prisma.user.findMany({
      where: { emailVerifiedAt: null, createdAt: { lt: cutoff } },
      select: { id: true, email: true },
    });
    if (stale.length === 0) {
      await this.prisma.otpVerification.deleteMany({ where: { expiresAt: { lt: new Date() } } });
      return 0;
    }

    const ids = stale.map((u) => u.id);
    const emails = stale.map((u) => u.email);
    try {
      await this.prisma.$transaction([
        this.prisma.workspace.deleteMany({ where: { ownerId: { in: ids } } }),
        this.prisma.user.deleteMany({ where: { id: { in: ids } } }),
        this.prisma.otpVerification.deleteMany({
          where: { OR: [{ email: { in: emails } }, { expiresAt: { lt: new Date() } }] },
        }),
      ]);
      this.logger.log(`Cleaned up ${ids.length} stale unverified user(s)`);
      return ids.length;
    } catch (err) {
      this.logger.error(`Stale-user cleanup failed: ${String(err)}`);
      return 0;
    }
  }
}
