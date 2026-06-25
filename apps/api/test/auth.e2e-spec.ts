import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { OtpService } from '../src/otp/otp.service';

const REFRESH_COOKIE = 'refresh_token';
const email = `e2e_${Date.now()}@teamboard.local`;
const password = 'password123';

function refreshCookie(res: request.Response): string {
  const raw = res.headers['set-cookie'] as unknown as string[] | undefined;
  const cookie = raw?.find((c) => c.startsWith(REFRESH_COOKIE));
  if (!cookie) throw new Error('no refresh cookie set');
  return cookie.split(';')[0];
}

describe('Auth (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let lastCode = '';

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.use(cookieParser());
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    prisma = app.get(PrismaService);

    // Capture the raw OTP code (it's only ever in the queued mail payload).
    const otp = app.get(OtpService);
    jest
      .spyOn(otp as unknown as { enqueueMail: (j: { code: string }) => Promise<void> }, 'enqueueMail')
      .mockImplementation(async (job) => {
        lastCode = job.code;
      });

    await app.init();
  });

  afterAll(async () => {
    const user = await prisma.user.findUnique({ where: { email } });
    if (user) {
      await prisma.refreshToken.deleteMany({ where: { userId: user.id } });
      await prisma.workspaceMember.deleteMany({ where: { userId: user.id } });
      await prisma.workspace.deleteMany({ where: { ownerId: user.id } });
      await prisma.user.delete({ where: { id: user.id } });
    }
    await prisma.otpVerification.deleteMany({ where: { email } });
    await app.close();
  });

  it('signup → 200, emails a code, creates an UNVERIFIED user (no token)', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/signup')
      .send({ email, password, name: 'E2E User' })
      .expect(200);

    expect(res.body.email).toBe(email);
    expect(res.body.accessToken).toBeUndefined();
    expect(lastCode).toMatch(/^\d{4}$/);

    const user = await prisma.user.findUnique({ where: { email } });
    expect(user?.emailVerifiedAt).toBeNull();
    const ws = await prisma.workspace.findFirst({ where: { name: 'My Workspace', owner: { email } } });
    expect(ws).toBeTruthy();
  });

  it('signin before verification → 403 EMAIL_NOT_VERIFIED', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/signin')
      .send({ email, password })
      .expect(403);
    expect(res.body.code).toBe('EMAIL_NOT_VERIFIED');
    expect(res.body.email).toBe(email);
  });

  it('verify-email with the wrong code → 422', async () => {
    const wrong = lastCode === '0000' ? '1111' : '0000';
    await request(app.getHttpServer())
      .post('/auth/verify-email')
      .send({ email, code: wrong })
      .expect(422);
  });

  it('verify-email with the correct code → 200 + token + marks verified', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/verify-email')
      .send({ email, code: lastCode })
      .expect(200);

    expect(res.body.accessToken).toBeDefined();
    expect(res.body.user.email).toBe(email);
    expect(refreshCookie(res)).toContain(REFRESH_COOKIE);

    const user = await prisma.user.findUnique({ where: { email } });
    expect(user?.emailVerifiedAt).not.toBeNull();
  });

  it('signup with an already-verified email → 409', async () => {
    await request(app.getHttpServer())
      .post('/auth/signup')
      .send({ email, password, name: 'Dupe' })
      .expect(409);
  });

  it('signup with weak password → 400', async () => {
    await request(app.getHttpServer())
      .post('/auth/signup')
      .send({ email: `weak_${Date.now()}@x.com`, password: 'short', name: 'X' })
      .expect(400);
  });

  it('signin with correct credentials → 200 + token', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/signin')
      .send({ email, password })
      .expect(200);
    expect(res.body.accessToken).toBeDefined();
  });

  it('signin with wrong password → 401', async () => {
    await request(app.getHttpServer())
      .post('/auth/signin')
      .send({ email, password: 'wrongpass' })
      .expect(401);
  });

  it('protected route without token → 401', async () => {
    await request(app.getHttpServer()).get('/users/me').expect(401);
  });

  it('protected route with token → 200', async () => {
    const signin = await request(app.getHttpServer())
      .post('/auth/signin')
      .send({ email, password })
      .expect(200);
    const res = await request(app.getHttpServer())
      .get('/users/me')
      .set('Authorization', `Bearer ${signin.body.accessToken}`)
      .expect(200);
    expect(res.body.email).toBe(email);
  });

  it('refresh rotates token and old refresh cookie is revoked', async () => {
    const signin = await request(app.getHttpServer())
      .post('/auth/signin')
      .send({ email, password })
      .expect(200);
    const oldCookie = refreshCookie(signin);

    const refreshed = await request(app.getHttpServer())
      .post('/auth/refresh')
      .set('Cookie', oldCookie)
      .expect(200);
    expect(refreshed.body.accessToken).toBeDefined();

    await request(app.getHttpServer()).post('/auth/refresh').set('Cookie', oldCookie).expect(401);
  });

  it('logout revokes refresh token → 204', async () => {
    const signin = await request(app.getHttpServer())
      .post('/auth/signin')
      .send({ email, password })
      .expect(200);
    const cookie = refreshCookie(signin);

    await request(app.getHttpServer()).post('/auth/logout').set('Cookie', cookie).expect(204);
    await request(app.getHttpServer()).post('/auth/refresh').set('Cookie', cookie).expect(401);
  });
});
