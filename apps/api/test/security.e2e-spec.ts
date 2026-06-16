import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

const password = 'password123';
const ts = Date.now();
const aliceEmail = `sec_alice_${ts}@teamboard.local`;
const bobEmail = `sec_bob_${ts}@teamboard.local`;

describe('Security: project access & guest isolation (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let aliceToken: string;
  let bobToken: string;
  let workspaceId: string;
  let projectA: string;
  let projectB: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.use(cookieParser());
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    prisma = app.get(PrismaService);
    await app.init();

    const server = app.getHttpServer();
    aliceToken = (await request(server).post('/auth/signup').send({ email: aliceEmail, password, name: 'Alice' })).body.accessToken;

    workspaceId = (await request(server).get('/workspaces').set('Authorization', `Bearer ${aliceToken}`)).body[0].id;
    projectA = (await request(server).post(`/workspaces/${workspaceId}/projects`).set('Authorization', `Bearer ${aliceToken}`).send({ name: 'Project A' })).body.id;
    projectB = (await request(server).post(`/workspaces/${workspaceId}/projects`).set('Authorization', `Bearer ${aliceToken}`).send({ name: 'Project B' })).body.id;

    // Invite bob as a GUEST to project A only.
    await request(server).post(`/projects/${projectA}/members`).set('Authorization', `Bearer ${aliceToken}`).send({ email: bobEmail, role: 'GUEST' });
    const invite = await prisma.invite.findFirst({ where: { email: bobEmail, projectId: projectA } });
    const token = inviteRawTokenFor(invite!.tokenHash); // not retrievable; accept via DB-marked flow below

    bobToken = (await request(server).post('/auth/signup').send({ email: bobEmail, password, name: 'Bob' })).body.accessToken;
    // Accepting needs the raw token (only emailed). Simulate acceptance directly: add bob as GUEST member of A.
    const bob = await prisma.user.findUnique({ where: { email: bobEmail } });
    await prisma.projectMember.create({ data: { projectId: projectA, userId: bob!.id, role: 'GUEST' } });
    void token;
  });

  afterAll(async () => {
    const users = await prisma.user.findMany({ where: { email: { in: [aliceEmail, bobEmail] } } });
    const ids = users.map((u) => u.id);
    // Delete every workspace these users own (cascades members/projects/statuses/etc.).
    await prisma.workspace.deleteMany({ where: { ownerId: { in: ids } } });
    await prisma.refreshToken.deleteMany({ where: { userId: { in: ids } } });
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
    await app.close();
  });

  it('guest can read the project they were invited to', async () => {
    await request(app.getHttpServer())
      .get(`/projects/${projectA}`)
      .set('Authorization', `Bearer ${bobToken}`)
      .expect(200);
  });

  it('guest CANNOT read a different project in the same workspace', async () => {
    await request(app.getHttpServer())
      .get(`/projects/${projectB}`)
      .set('Authorization', `Bearer ${bobToken}`)
      .expect(403);
  });

  it('guest CANNOT list workspace members', async () => {
    await request(app.getHttpServer())
      .get(`/workspaces/${workspaceId}/members`)
      .set('Authorization', `Bearer ${bobToken}`)
      .expect(403);
  });

  it('guest CANNOT read tasks of a project they lack access to', async () => {
    await request(app.getHttpServer())
      .get(`/projects/${projectB}/tasks`)
      .set('Authorization', `Bearer ${bobToken}`)
      .expect(403);
  });

  it('rejects oversized / disallowed file uploads at presign', async () => {
    await request(app.getHttpServer())
      .post('/files/presign')
      .set('Authorization', `Bearer ${aliceToken}`)
      .send({ fileName: 'x.exe', size: 10, mimeType: 'application/x-msdownload', target: { taskId: 'x' } })
      .expect(400);
  });
});

// The raw invite token is only emailed; tests bypass by inserting membership directly.
function inviteRawTokenFor(_hash: string): string {
  return '';
}
