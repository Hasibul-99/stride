import type { Queue } from 'bullmq';
import { OTP_LENGTH, OTP_MAX_ATTEMPTS, OTP_MAX_SENDS_PER_HOUR } from '@teamboard/shared';
import type { PrismaService } from '../prisma/prisma.service';
import type { OtpMailJob } from './otp.constants';
import { OtpService } from './otp.service';

interface OtpRow {
  id: string;
  email: string;
  purpose: string;
  codeHash: string;
  expiresAt: Date;
  attempts: number;
  sendCount: number;
  lastSentAt: Date | null;
}

type WhereKey = { where: { email_purpose: { email: string; purpose: string } } };

/** In-memory stand-in for the bits of PrismaService that OtpService touches. */
function makeFakePrisma() {
  const store = new Map<string, OtpRow>();
  const key = (email: string, purpose: string) => `${email}|${purpose}`;
  return {
    _store: store,
    otpVerification: {
      findUnique: jest.fn(async ({ where }: WhereKey) => {
        const { email, purpose } = where.email_purpose;
        return store.get(key(email, purpose)) ?? null;
      }),
      upsert: jest.fn(
        async ({
          where,
          create,
          update,
        }: WhereKey & { create: Partial<OtpRow>; update: Partial<OtpRow> }) => {
          const { email, purpose } = where.email_purpose;
          const k = key(email, purpose);
          const existing = store.get(k);
          const row = (
            existing ? { ...existing, ...update } : { id: `otp_${k}`, email, purpose, ...create }
          ) as OtpRow;
          store.set(k, row);
          return row;
        },
      ),
      update: jest.fn(async ({ where, data }: WhereKey & { data: Partial<OtpRow> }) => {
        const { email, purpose } = where.email_purpose;
        const k = key(email, purpose);
        const row = { ...store.get(k), ...data } as OtpRow;
        store.set(k, row);
        return row;
      }),
      deleteMany: jest.fn(async ({ where }: { where: { email?: string; purpose?: string } }) => {
        if (where?.email && where?.purpose) store.delete(key(where.email, where.purpose));
        return { count: 1 };
      }),
    },
  };
}

function makeQueue() {
  const jobs: OtpMailJob[] = [];
  const add = jest.fn(async (_name: string, job: OtpMailJob) => {
    jobs.push(job);
  });
  return { add, jobs };
}

function build() {
  const prisma = makeFakePrisma();
  const queue = makeQueue();
  const service = new OtpService(
    prisma as unknown as PrismaService,
    queue as unknown as Queue<OtpMailJob>,
  );
  return { service, prisma, queue };
}

/** Last raw code handed to the mail queue. */
function lastCode(queue: ReturnType<typeof makeQueue>): string {
  const job = queue.jobs[queue.jobs.length - 1];
  return job.code;
}

const EMAIL = 'user@example.com';

/** The stored OTP row (asserts it exists — tests issue() first). */
function row(prisma: ReturnType<typeof makeFakePrisma>, k = `${EMAIL}|registration`): OtpRow {
  const r = prisma._store.get(k);
  if (!r) throw new Error(`no otp row for ${k}`);
  return r;
}

describe('OtpService', () => {
  it('issues a hashed, N-digit numeric code and queues the raw code to mail', async () => {
    const { service, prisma, queue } = build();
    await service.issue(EMAIL, 'registration');

    expect(queue.add).toHaveBeenCalledTimes(1);
    const code = lastCode(queue);
    expect(code).toMatch(new RegExp(`^\\d{${OTP_LENGTH}}$`));

    const r = row(prisma);
    expect(r.codeHash).toBeDefined();
    expect(r.codeHash).not.toContain(code); // hashed at rest, not the raw code
    expect(r.codeHash.startsWith('$argon2')).toBe(true);
  });

  it('verifies the correct code and consumes it', async () => {
    const { service, queue, prisma } = build();
    await service.issue(EMAIL, 'registration');
    const code = lastCode(queue);

    const res = await service.verify(EMAIL, 'registration', code, { consume: true });
    expect(res).toEqual({ ok: true });
    expect(prisma._store.get(`${EMAIL}|registration`)).toBeUndefined(); // consumed
  });

  it('rejects a wrong code and increments attempts', async () => {
    const { service, queue, prisma } = build();
    await service.issue(EMAIL, 'registration');
    const wrong = lastCode(queue) === '0000' ? '1111' : '0000';

    const res = await service.verify(EMAIL, 'registration', wrong);
    expect(res).toEqual({ ok: false, reason: 'invalid' });
    expect(row(prisma).attempts).toBe(1);
  });

  it('treats an expired code as invalid and clears it', async () => {
    const { service, queue, prisma } = build();
    await service.issue(EMAIL, 'registration');
    const code = lastCode(queue);
    // Force expiry.
    row(prisma).expiresAt = new Date(Date.now() - 1000);

    const res = await service.verify(EMAIL, 'registration', code);
    expect(res).toEqual({ ok: false, reason: 'expired' });
    expect(prisma._store.get(`${EMAIL}|registration`)).toBeUndefined();
  });

  it('locks (invalidates) the code on the 6th attempt', async () => {
    const { service, queue, prisma } = build();
    await service.issue(EMAIL, 'registration');
    const code = lastCode(queue);
    const wrong = code === '0000' ? '1111' : '0000';

    // 5 allowed wrong attempts
    for (let i = 0; i < OTP_MAX_ATTEMPTS; i++) {
      const r = await service.verify(EMAIL, 'registration', wrong);
      expect(r).toEqual({ ok: false, reason: 'invalid' });
    }
    expect(row(prisma).attempts).toBe(OTP_MAX_ATTEMPTS);

    // 6th attempt — even with the CORRECT code — is locked out and the code is gone.
    const res = await service.verify(EMAIL, 'registration', code);
    expect(res).toEqual({ ok: false, reason: 'locked' });
    expect(prisma._store.get(`${EMAIL}|registration`)).toBeUndefined();
  });

  it('enforces the 60s resend cooldown (second issue is a no-op)', async () => {
    const { service, queue, prisma } = build();
    await service.issue(EMAIL, 'registration');
    const firstHash = row(prisma).codeHash;

    await service.issue(EMAIL, 'registration'); // within cooldown → ignored

    expect(queue.add).toHaveBeenCalledTimes(1);
    expect(row(prisma).codeHash).toBe(firstHash);
  });

  it('caps sends per hour', async () => {
    const { service, queue, prisma } = build();
    const k = `${EMAIL}|registration`;

    for (let i = 0; i < OTP_MAX_SENDS_PER_HOUR; i++) {
      await service.issue(EMAIL, 'registration');
      // step past the 60s cooldown but stay inside the 1h window
      row(prisma, k).lastSentAt = new Date(Date.now() - 61_000);
    }
    expect(queue.add).toHaveBeenCalledTimes(OTP_MAX_SENDS_PER_HOUR);
    expect(row(prisma, k).sendCount).toBe(OTP_MAX_SENDS_PER_HOUR);

    await service.issue(EMAIL, 'registration'); // 6th within the hour → blocked
    expect(queue.add).toHaveBeenCalledTimes(OTP_MAX_SENDS_PER_HOUR);
  });

  it('keeps only one active code per (email, purpose) — re-issue invalidates the old', async () => {
    const { service, queue, prisma } = build();
    const k = `${EMAIL}|registration`;

    await service.issue(EMAIL, 'registration');
    const code1 = lastCode(queue);
    row(prisma, k).lastSentAt = new Date(Date.now() - 61_000); // bypass cooldown

    let code2 = code1;
    while (code2 === code1) {
      await service.issue(EMAIL, 'registration');
      code2 = lastCode(queue);
      row(prisma, k).lastSentAt = new Date(Date.now() - 61_000);
    }

    expect(await service.verify(EMAIL, 'registration', code1)).toEqual({ ok: false, reason: 'invalid' });
    expect(await service.verify(EMAIL, 'registration', code2)).toEqual({ ok: true });
  });
});
