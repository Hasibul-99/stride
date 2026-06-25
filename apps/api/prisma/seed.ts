import { PrismaClient, Prisma } from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();

/** Monday of the current week at 00:00 local. */
function mondayOfThisWeek(): Date {
  const d = new Date();
  const day = d.getDay(); // 0=Sun
  const diff = (day === 0 ? -6 : 1) - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

/** Date-only value N days from this week's Monday. */
function weekDay(offset: number): Date {
  const m = mondayOfThisWeek();
  m.setDate(m.getDate() + offset);
  return m;
}

/** A datetime on a given weekday offset at hh:mm. */
function weekDateTime(offset: number, hh: number, mm = 0): Date {
  const d = weekDay(offset);
  d.setHours(hh, mm, 0, 0);
  return d;
}

function richText(text: string): Prisma.InputJsonValue {
  return {
    type: 'doc',
    content: [{ type: 'paragraph', content: [{ type: 'text', text }] }],
  };
}

async function main() {
  console.log('Resetting demo data…');
  // Wipe in FK-safe order (dev only).
  await prisma.$transaction([
    prisma.notification.deleteMany(),
    prisma.messageRead.deleteMany(),
    prisma.attachment.deleteMany(),
    prisma.chatMessage.deleteMany(),
    prisma.timeEntry.deleteMany(),
    prisma.eventParticipant.deleteMany(),
    prisma.event.deleteMany(),
    prisma.task.deleteMany(),
    prisma.note.deleteMany(),
    prisma.taskStatus.deleteMany(),
    prisma.recurrence.deleteMany(),
    prisma.projectMember.deleteMany(),
    prisma.invite.deleteMany(),
    prisma.project.deleteMany(),
    prisma.folder.deleteMany(),
    prisma.memberCapacity.deleteMany(),
    prisma.workspaceMember.deleteMany(),
    prisma.refreshToken.deleteMany(),
    prisma.workspace.deleteMany(),
    prisma.user.deleteMany(),
  ]);

  const passwordHash = await argon2.hash('password123');

  // ─── Users ─────────────────────────────────────────────
  const alice = await prisma.user.create({
    data: {
      email: 'alice@teamboard.local',
      name: 'Alice Chen',
      passwordHash,
      timezone: 'America/New_York',
      avatarUrl: null,
      emailVerifiedAt: new Date(),
    },
  });
  const bob = await prisma.user.create({
    data: {
      email: 'bob@teamboard.local',
      name: 'Bob Martins',
      passwordHash,
      timezone: 'America/New_York',
      emailVerifiedAt: new Date(),
    },
  });
  const carol = await prisma.user.create({
    data: {
      email: 'carol@teamboard.local',
      name: 'Carol Diaz',
      passwordHash,
      timezone: 'Europe/London',
      emailVerifiedAt: new Date(),
    },
  });

  // ─── Workspace + members ───────────────────────────────
  const workspace = await prisma.workspace.create({
    data: {
      name: 'Acme Studio',
      ownerId: alice.id,
      members: {
        create: [
          { userId: alice.id, role: 'OWNER' },
          { userId: bob.id, role: 'ADMIN' },
          { userId: carol.id, role: 'MEMBER' },
        ],
      },
    },
  });

  await prisma.memberCapacity.createMany({
    data: [
      { workspaceId: workspace.id, userId: alice.id, dailyMinutes: 480 },
      { workspaceId: workspace.id, userId: bob.id, dailyMinutes: 480 },
      { workspaceId: workspace.id, userId: carol.id, dailyMinutes: 360 },
    ],
  });

  // ─── Folders ───────────────────────────────────────────
  const clientWork = await prisma.folder.create({
    data: { workspaceId: workspace.id, name: 'Client Work', position: 1 },
  });
  const internal = await prisma.folder.create({
    data: { workspaceId: workspace.id, name: 'Internal', position: 2 },
  });

  // ─── Helper: create a project with statuses + members ──
  async function createProject(opts: {
    name: string;
    color: string;
    folderId: string;
    position: number;
    description: string;
  }) {
    const project = await prisma.project.create({
      data: {
        workspaceId: workspace.id,
        folderId: opts.folderId,
        name: opts.name,
        color: opts.color,
        description: opts.description,
        position: opts.position,
        members: {
          create: [
            { userId: alice.id, role: 'MANAGER' },
            { userId: bob.id, role: 'MEMBER' },
            { userId: carol.id, role: 'MEMBER' },
          ],
        },
      },
    });

    const statusDefs = [
      { name: 'New', color: 'slate', position: 1, isDefault: true, isCompleted: false },
      { name: 'In progress', color: 'blue', position: 2, isDefault: false, isCompleted: false },
      { name: 'Review', color: 'amber', position: 3, isDefault: false, isCompleted: false },
      { name: 'Completed', color: 'green', position: 4, isDefault: false, isCompleted: true },
    ];
    const statuses: Record<string, string> = {};
    for (const s of statusDefs) {
      const created = await prisma.taskStatus.create({
        data: { projectId: project.id, ...s },
      });
      statuses[s.name] = created.id;
    }
    return { project, statuses };
  }

  const website = await createProject({
    name: 'Website Redesign',
    color: 'violet',
    folderId: clientWork.id,
    position: 1,
    description: 'Marketing site refresh for Q3 launch.',
  });

  const mobile = await createProject({
    name: 'Mobile App',
    color: 'teal',
    folderId: internal.id,
    position: 1,
    description: 'Native companion app, v1.',
  });

  // ─── Tasks ─────────────────────────────────────────────
  const assignees = [alice.id, bob.id, carol.id];
  let posCounter = 0;

  type TaskSeed = {
    title: string;
    statusName: string;
    assignee: string | null;
    dayOffset: number | null; // null = waiting list
    estimate: number | null;
    completed?: boolean;
  };

  async function seedTasks(
    proj: { project: { id: string }; statuses: Record<string, string> },
    seeds: TaskSeed[],
  ) {
    for (const t of seeds) {
      const completedAt = t.completed ? weekDateTime(t.dayOffset ?? 0, 16) : null;
      await prisma.task.create({
        data: {
          projectId: proj.project.id,
          title: t.title,
          description: richText(`Details for "${t.title}".`),
          statusId: proj.statuses[t.statusName],
          assigneeId: t.assignee,
          scheduledDate: t.dayOffset === null ? null : weekDay(t.dayOffset),
          position: (posCounter += 100),
          timeEstimateMinutes: t.estimate,
          completedAt,
          createdById: alice.id,
        },
      });
    }
  }

  await seedTasks(website, [
    { title: 'Audit current site analytics', statusName: 'Completed', assignee: alice.id, dayOffset: 0, estimate: 90, completed: true },
    { title: 'Define new sitemap', statusName: 'Completed', assignee: bob.id, dayOffset: 0, estimate: 120, completed: true },
    { title: 'Wireframe homepage', statusName: 'In progress', assignee: carol.id, dayOffset: 1, estimate: 180 },
    { title: 'Wireframe pricing page', statusName: 'In progress', assignee: carol.id, dayOffset: 1, estimate: 90 },
    { title: 'Draft hero copy', statusName: 'New', assignee: alice.id, dayOffset: 2, estimate: 60 },
    { title: 'Source hero imagery', statusName: 'New', assignee: bob.id, dayOffset: 2, estimate: 45 },
    { title: 'Design system tokens', statusName: 'Review', assignee: carol.id, dayOffset: 3, estimate: 240 },
    { title: 'Build navbar component', statusName: 'New', assignee: bob.id, dayOffset: 3, estimate: 150 },
    { title: 'SEO meta pass', statusName: 'New', assignee: alice.id, dayOffset: 4, estimate: 60 },
    { title: 'Accessibility audit', statusName: 'New', assignee: alice.id, dayOffset: 4, estimate: 120 },
    // waiting list
    { title: 'Cookie consent banner', statusName: 'New', assignee: null, dayOffset: null, estimate: 90 },
    { title: 'Blog index template', statusName: 'New', assignee: carol.id, dayOffset: null, estimate: 180 },
    { title: '404 page illustration', statusName: 'New', assignee: null, dayOffset: null, estimate: null },
    { title: 'Newsletter signup integration', statusName: 'New', assignee: bob.id, dayOffset: null, estimate: 120 },
  ]);

  await seedTasks(mobile, [
    { title: 'Set up RN project', statusName: 'Completed', assignee: bob.id, dayOffset: -1, estimate: 120, completed: true },
    { title: 'Auth screens', statusName: 'In progress', assignee: bob.id, dayOffset: 0, estimate: 240 },
    { title: 'Push notifications POC', statusName: 'In progress', assignee: alice.id, dayOffset: 1, estimate: 180 },
    { title: 'Offline cache layer', statusName: 'New', assignee: carol.id, dayOffset: 2, estimate: 300 },
    { title: 'App icon + splash', statusName: 'Review', assignee: carol.id, dayOffset: 2, estimate: 90 },
    { title: 'Profile screen', statusName: 'New', assignee: bob.id, dayOffset: 3, estimate: 150 },
    { title: 'Settings screen', statusName: 'New', assignee: bob.id, dayOffset: 4, estimate: 120 },
    { title: 'Deep linking', statusName: 'New', assignee: alice.id, dayOffset: 4, estimate: 180 },
    // waiting list
    { title: 'App Store screenshots', statusName: 'New', assignee: null, dayOffset: null, estimate: 60 },
    { title: 'Crash reporting setup', statusName: 'New', assignee: alice.id, dayOffset: null, estimate: 90 },
    { title: 'Biometric login', statusName: 'New', assignee: null, dayOffset: null, estimate: 240 },
  ]);

  // ─── Events ────────────────────────────────────────────
  const kickoff = await prisma.event.create({
    data: {
      projectId: website.project.id,
      title: 'Website kickoff',
      description: 'Align on scope and timeline.',
      startAt: weekDateTime(0, 10),
      endAt: weekDateTime(0, 11),
      location: 'Zoom',
      color: 'violet',
      createdById: alice.id,
      reminderMinutesBefore: 15,
      participants: {
        create: [
          { userId: alice.id, responseStatus: 'ACCEPTED' },
          { userId: bob.id, responseStatus: 'ACCEPTED' },
          { userId: carol.id, responseStatus: 'PENDING' },
          { email: 'client@external.com', responseStatus: 'PENDING' },
        ],
      },
    },
  });

  await prisma.event.create({
    data: {
      projectId: mobile.project.id,
      title: 'Sprint planning',
      startAt: weekDateTime(1, 14),
      endAt: weekDateTime(1, 15, 30),
      location: 'Meeting Room B',
      color: 'teal',
      createdById: bob.id,
      reminderMinutesBefore: 30,
      participants: {
        create: [
          { userId: alice.id, responseStatus: 'ACCEPTED' },
          { userId: bob.id, responseStatus: 'ACCEPTED' },
        ],
      },
    },
  });

  await prisma.event.create({
    data: {
      projectId: null, // personal event
      title: 'Design review (personal)',
      startAt: weekDateTime(3, 16),
      endAt: weekDateTime(3, 17),
      color: 'amber',
      createdById: carol.id,
      participants: { create: [{ userId: carol.id, responseStatus: 'ACCEPTED' }] },
    },
  });

  // ─── Notes ─────────────────────────────────────────────
  await prisma.note.createMany({
    data: [
      {
        projectId: website.project.id,
        title: 'Brand guidelines',
        content: richText('Primary font: Inter. Voice: confident, calm.') as Prisma.InputJsonValue,
        position: 1,
        createdById: alice.id,
      },
      {
        projectId: website.project.id,
        title: 'Launch checklist',
        content: richText('DNS, analytics, redirects, OG tags.') as Prisma.InputJsonValue,
        position: 2,
        createdById: bob.id,
      },
      {
        projectId: mobile.project.id,
        title: 'Release process',
        content: richText('TestFlight → internal QA → phased rollout.') as Prisma.InputJsonValue,
        position: 1,
        createdById: bob.id,
      },
    ],
  });

  // ─── A little chat + notifications ─────────────────────
  const firstTask = await prisma.task.findFirst({
    where: { projectId: website.project.id, scheduledDate: { not: null } },
    orderBy: { position: 'asc' },
  });
  if (firstTask) {
    await prisma.chatMessage.create({
      data: {
        taskId: firstTask.id,
        authorId: bob.id,
        body: 'Started on this — will share a draft by EOD.',
      },
    });
    await prisma.notification.create({
      data: {
        userId: alice.id,
        type: 'CHAT_MESSAGE',
        payload: { taskId: firstTask.id, from: bob.name } as Prisma.InputJsonValue,
      },
    });
  }

  const counts = {
    users: await prisma.user.count(),
    workspaces: await prisma.workspace.count(),
    projects: await prisma.project.count(),
    statuses: await prisma.taskStatus.count(),
    tasks: await prisma.task.count(),
    events: await prisma.event.count(),
    notes: await prisma.note.count(),
  };
  console.log('Seed complete:', counts);
  console.log('Login: alice@teamboard.local / password123');
  void kickoff;
  void assignees;
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
