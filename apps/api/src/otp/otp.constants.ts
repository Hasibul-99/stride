import type { OtpPurpose } from '@teamboard/shared';

/** Queue that delivers OTP emails asynchronously (so HTTP responses aren't blocked on SMTP). */
export const OTP_MAIL_QUEUE = 'otp-mail';

/** Queue carrying the daily repeatable cleanup of stale unverified users. */
export const OTP_CLEANUP_QUEUE = 'otp-cleanup';

/** Job payload — carries the RAW code (only ever in transit to the mailer, never persisted). */
export interface OtpMailJob {
  email: string;
  purpose: OtpPurpose;
  code: string;
}

export type OtpVerifyResult = { ok: true } | { ok: false; reason: 'invalid' | 'expired' | 'locked' };
