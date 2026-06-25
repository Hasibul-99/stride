import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { OtpService } from '../src/otp/otp.service';

const REFRESH_COOKIE = 'refresh_token';
const password = 'password123';
const run = Date.now();
let seq = 0;
const newEmail = () => `otp_${run}_${seq++}@teamboard.local`;

function refreshCookie(res: request.Response): string {
  const raw = res.headers['set-cookie'] as unknown as string[] | undefined;
  const cookie = raw?.find((c) => c.startsWith(REFRESH_COOKIE));
  if (!cookie) throw new Error('no refresh cookie set');
  return cookie.split(';')[0];
}

describe('OTP verification + password reset (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const mails: { email: string; purpose: string; code: string }[] = [];
  const created: string[] = [];

  const codeFor = (email: string, purpose: string) =>
    [...mails].reverse().find((m) => m.email === email && m.purpose === purpose)?.code;
  const countFor = (email: string) => mails.filter((m) => m.email === email).length;

  /** Sign up + force-verify an account so it can sign in. */
  async function verifiedUser(): Promise<string> {
    const email = newEmail();
    created.push(email);
    await request(app.getHttpServer()).post('/auth/signup').send({ email, password, name: 'U' }).expect(200);
    await prisma.user.update({ where: { email }, data: { emailVerifiedAt: new Date() } });
    return email;
  }

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.use(cookieParser());
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    prisma = app.get(PrismaService);

    const otp = app.get(OtpService);
    jest
      .spyOn(otp as unknown as { enqueueMail: (j: { email: string; purpose: string; code: string }) => Promise<void> }, 'enqueueMail')
      .mockImplementation(async (job) => {
        mails.push(job);
      });

    await app.init();
  });

  afterAll(async () => {
    for (const email of created) {
      const user = await prisma.user.findUnique({ where: { email } });
      if (user) {
        await prisma.refreshToken.deleteMany({ where: { userId: user.id } });
        await prisma.workspaceMember.deleteMany({ where: { userId: user.id } });
        await prisma.workspace.deleteMany({ where: { ownerId: user.id } });
        await prisma.user.delete({ where: { id: user.id } });
      }
      await prisma.otpVerification.deleteMany({ where: { email } });
    }
    await app.close();
  });

  it('resend within the 60s cooldown is a no-op (no second email)', async () => {
    const email = newEmail();
    created.push(email);
    await request(app.getHttpServer()).post('/auth/signup').send({ email, password, name: 'U' }).expect(200);
    expect(countFor(email)).toBe(1);

    await request(app.getHttpServer())
      .post('/auth/resend-otp')
      .send({ email, purpose: 'registration' })
      .expect(200);

    expect(countFor(email)).toBe(1); // cooldown blocked the resend
  });

  it('an expired code → 422', async () => {
    const email = newEmail();
    created.push(email);
    await request(app.getHttpServer()).post('/auth/signup').send({ email, password, name: 'U' }).expect(200);
    const code = codeFor(email, 'registration')!;

    await prisma.otpVerification.updateMany({
      where: { email, purpose: 'registration' },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });

    await request(app.getHttpServer()).post('/auth/verify-email').send({ email, code }).expect(422);
  });

  it('locks the code after 5 wrong attempts (6th → 422, code invalidated)', async () => {
    const email = newEmail();
    created.push(email);
    await request(app.getHttpServer()).post('/auth/signup').send({ email, password, name: 'U' }).expect(200);
    const code = codeFor(email, 'registration')!;
    const wrong = code === '0000' ? '1111' : '0000';

    for (let i = 0; i < 5; i++) {
      await request(app.getHttpServer()).post('/auth/verify-email').send({ email, code: wrong }).expect(422);
    }
    // 6th attempt — even with the right code — is locked out.
    const res = await request(app.getHttpServer())
      .post('/auth/verify-email')
      .send({ email, code })
      .expect(422);
    expect(res.body.message).toMatch(/Too many attempts/i);

    const row = await prisma.otpVerification.findFirst({ where: { email, purpose: 'registration' } });
    expect(row).toBeNull(); // invalidated
  });

  it('forgot-password does not reveal whether the email exists', async () => {
    const existing = await verifiedUser();
    const unknown = `ghost_${run}@nowhere.local`;

    const a = await request(app.getHttpServer()).post('/auth/forgot-password').send({ email: existing }).expect(200);
    const b = await request(app.getHttpServer()).post('/auth/forgot-password').send({ email: unknown }).expect(200);

    expect(a.body).toEqual(b.body); // identical generic response
    expect(codeFor(existing, 'password_reset')).toMatch(/^\d{4}$/); // code issued for the real one
    expect(countFor(unknown)).toBe(0); // none for the unknown one
  });

  it('reset-password sets a new password and revokes existing sessions', async () => {
    const email = await verifiedUser();

    // Establish a session, then reset.
    const signin = await request(app.getHttpServer()).post('/auth/signin').send({ email, password }).expect(200);
    const oldCookie = refreshCookie(signin);

    await request(app.getHttpServer()).post('/auth/forgot-password').send({ email }).expect(200);
    const code = codeFor(email, 'password_reset')!;
    const newPassword = 'newpassword456';

    const res = await request(app.getHttpServer())
      .post('/auth/reset-password')
      .send({ email, code, password: newPassword, passwordConfirmation: newPassword })
      .expect(200);
    expect(res.body.message).toBe('Password updated');

    // Old session revoked.
    await request(app.getHttpServer()).post('/auth/refresh').set('Cookie', oldCookie).expect(401);
    // Old password rejected, new password works.
    await request(app.getHttpServer()).post('/auth/signin').send({ email, password }).expect(401);
    await request(app.getHttpServer()).post('/auth/signin').send({ email, password: newPassword }).expect(200);
  });

  it('cleanup deletes stale unverified users (and their workspace) but keeps verified ones', async () => {
    const staleEmail = newEmail();
    const keepEmail = await verifiedUser();
    await request(app.getHttpServer()).post('/auth/signup').send({ email: staleEmail, password, name: 'U' }).expect(200);
    created.push(staleEmail);

    // Backdate the unverified account past the 24h cutoff.
    await prisma.user.update({
      where: { email: staleEmail },
      data: { createdAt: new Date(Date.now() - 25 * 60 * 60 * 1000) },
    });

    const removed = await app.get(OtpService).cleanupStaleUnverified();
    expect(removed).toBeGreaterThanOrEqual(1);

    expect(await prisma.user.findUnique({ where: { email: staleEmail } })).toBeNull();
    expect(await prisma.workspace.findFirst({ where: { owner: { email: staleEmail } } })).toBeNull();
    expect(await prisma.user.findUnique({ where: { email: keepEmail } })).not.toBeNull();
  });

  it('reset-password with a wrong code → 422', async () => {
    const email = await verifiedUser();
    await request(app.getHttpServer()).post('/auth/forgot-password').send({ email }).expect(200);
    const code = codeFor(email, 'password_reset')!;
    const wrong = code === '0000' ? '1111' : '0000';

    await request(app.getHttpServer())
      .post('/auth/reset-password')
      .send({ email, code: wrong, password: 'whatever123', passwordConfirmation: 'whatever123' })
      .expect(422);
  });
});
