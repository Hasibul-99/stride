import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { createHmac } from 'node:crypto';
import type {
  CreateEventInput,
  EventQuery,
  RecurrenceInput,
  RsvpInput,
  UpdateEventInput,
} from '@teamboard/shared';
import { PrismaService } from '../prisma/prisma.service';
import { AccessService } from '../access/access.service';
import { MailService } from '../mail/mail.service';
import { RemindersService } from '../reminders/reminders.service';
import { IcsService } from './ics.service';
import { generateOccurrences } from '../recurrence/recurrence.generator';

const HORIZON_WEEKS = 8;

@Injectable()
export class EventsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessService,
    private readonly mail: MailService,
    private readonly reminders: RemindersService,
    private readonly ics: IcsService,
    private readonly config: ConfigService,
  ) {}

  // ─── RSVP token (stateless HMAC) ───────────────────────

  private rsvpToken(participantId: string): string {
    const sig = this.hmac(participantId);
    return Buffer.from(`${participantId}.${sig}`).toString('base64url');
  }

  private verifyRsvpToken(token: string): string {
    let decoded: string;
    try {
      decoded = Buffer.from(token, 'base64url').toString('utf8');
    } catch {
      throw new BadRequestException('Bad token');
    }
    const [participantId, sig] = decoded.split('.');
    if (!participantId || sig !== this.hmac(participantId)) {
      throw new BadRequestException('Invalid RSVP token');
    }
    return participantId;
  }

  private hmac(value: string): string {
    return createHmac('sha256', this.config.getOrThrow<string>('ENCRYPTION_KEY'))
      .update(value)
      .digest('hex')
      .slice(0, 24);
  }

  // ─── Access ────────────────────────────────────────────

  private async assertCanCreate(userId: string, projectId?: string | null) {
    if (projectId) await this.access.assertProjectAccess(userId, projectId);
    // personal event (projectId null) needs no project check
  }

  private async loadAccessible(userId: string, eventId: string) {
    const event = await this.prisma.event.findFirst({
      where: { id: eventId, deletedAt: null },
      include: { participants: true },
    });
    if (!event) throw new NotFoundException('Event not found');
    if (event.projectId) {
      await this.access.assertProjectAccess(userId, event.projectId);
    } else if (event.createdById !== userId) {
      throw new ForbiddenException('No access to this event');
    }
    return event;
  }

  // ─── Queries ───────────────────────────────────────────

  async list(userId: string, query: EventQuery) {
    const where: Prisma.EventWhereInput = { deletedAt: null };
    if (query.from || query.to) {
      where.startAt = {};
      if (query.from) where.startAt.gte = new Date(query.from);
      if (query.to) where.startAt.lte = new Date(query.to);
    }
    if (query.projectId) {
      await this.access.assertProjectAccess(userId, query.projectId);
      where.projectId = query.projectId;
    } else {
      // events the user can see: their personal events + events in their projects
      const memberships = await this.prisma.projectMember.findMany({
        where: { userId },
        select: { projectId: true },
      });
      const wsMember = await this.prisma.workspaceMember.findMany({
        where: { userId },
        select: { workspaceId: true },
      });
      const wsProjects = await this.prisma.project.findMany({
        where: { workspaceId: { in: wsMember.map((w) => w.workspaceId) }, deletedAt: null },
        select: { id: true },
      });
      const projectIds = [
        ...new Set([...memberships.map((m) => m.projectId), ...wsProjects.map((p) => p.id)]),
      ];
      where.OR = [
        { projectId: { in: projectIds } },
        { projectId: null, createdById: userId },
        { participants: { some: { userId } } },
      ];
    }
    return this.prisma.event.findMany({
      where,
      orderBy: { startAt: 'asc' },
      include: {
        participants: {
          include: { user: { select: { id: true, name: true, avatarUrl: true } } },
        },
      },
    });
  }

  async get(userId: string, eventId: string) {
    await this.loadAccessible(userId, eventId);
    return this.prisma.event.findUnique({
      where: { id: eventId },
      include: {
        participants: { include: { user: { select: { id: true, name: true, avatarUrl: true } } } },
      },
    });
  }

  // ─── Mutations ─────────────────────────────────────────

  async create(userId: string, input: CreateEventInput) {
    await this.assertCanCreate(userId, input.projectId);

    let recurrenceId: string | null = null;
    if (input.recurrence) {
      const rec = await this.createRecurrence(input.recurrence);
      recurrenceId = rec.id;
    }

    const event = await this.prisma.event.create({
      data: {
        projectId: input.projectId ?? null,
        title: input.title,
        description: input.description ?? null,
        startAt: new Date(input.startAt),
        endAt: new Date(input.endAt),
        allDay: input.allDay ?? false,
        location: input.location ?? null,
        color: input.color ?? 'blue',
        reminderMinutesBefore: input.reminderMinutesBefore ?? null,
        createdById: userId,
        recurrenceId,
        participants: { create: this.buildParticipants(input.participants) },
      },
      include: { participants: true },
    });

    await this.sendInvites(event.id, 'REQUEST');
    await this.scheduleReminders(event.id);

    if (recurrenceId && input.recurrence) {
      await this.materialize(event.id, input.recurrence);
    }

    return this.get(userId, event.id);
  }

  async update(userId: string, eventId: string, input: UpdateEventInput) {
    const existing = await this.loadAccessible(userId, eventId);

    const data: Prisma.EventUpdateInput = { sequence: { increment: 1 } };
    if (input.title !== undefined) data.title = input.title;
    if (input.description !== undefined) data.description = input.description;
    if (input.startAt !== undefined) data.startAt = new Date(input.startAt);
    if (input.endAt !== undefined) data.endAt = new Date(input.endAt);
    if (input.allDay !== undefined) data.allDay = input.allDay;
    if (input.location !== undefined) data.location = input.location;
    if (input.color !== undefined) data.color = input.color;
    if (input.reminderMinutesBefore !== undefined) {
      data.reminderMinutesBefore = input.reminderMinutesBefore;
    }

    if (input.participants !== undefined) {
      // Replace participant set.
      await this.prisma.eventParticipant.deleteMany({ where: { eventId } });
      data.participants = { create: this.buildParticipants(input.participants) };
    }

    await this.prisma.event.update({ where: { id: eventId }, data });
    await this.sendInvites(eventId, 'REQUEST');
    await this.scheduleReminders(eventId);
    void existing;
    return this.get(userId, eventId);
  }

  async remove(userId: string, eventId: string) {
    const event = await this.loadAccessible(userId, eventId);
    await this.sendInvites(eventId, 'CANCEL');
    for (const p of event.participants) {
      if (p.userId) await this.reminders.cancel(eventId, p.userId);
    }
    await this.prisma.event.update({ where: { id: eventId }, data: { deletedAt: new Date() } });
  }

  async rsvp(input: RsvpInput) {
    const participantId = this.verifyRsvpToken(input.token);
    const participant = await this.prisma.eventParticipant.findUnique({
      where: { id: participantId },
    });
    if (!participant) throw new NotFoundException('Participant not found');
    await this.prisma.eventParticipant.update({
      where: { id: participantId },
      data: { responseStatus: input.response },
    });
    return { ok: true };
  }

  // ─── Helpers ───────────────────────────────────────────

  private buildParticipants(
    participants: { userId?: string; email?: string }[],
  ): Prisma.EventParticipantCreateWithoutEventInput[] {
    return participants.map((p) =>
      p.userId ? { user: { connect: { id: p.userId } } } : { email: p.email },
    );
  }

  private async createRecurrence(rule: RecurrenceInput) {
    return this.prisma.recurrence.create({
      data: {
        frequency: rule.frequency,
        interval: rule.interval ?? 1,
        byWeekdays: rule.byWeekdays ?? [],
        until: rule.until ? new Date(rule.until) : null,
        count: rule.count ?? null,
      },
    });
  }

  /** Build invitee list (members + external emails) and email an ICS to each. */
  private async sendInvites(eventId: string, method: 'REQUEST' | 'CANCEL') {
    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
      include: {
        createdBy: { select: { name: true, email: true } },
        participants: { include: { user: { select: { name: true, email: true } } } },
      },
    });
    if (!event) return;

    const attendees = event.participants
      .map((p) => ({
        name: p.user?.name ?? undefined,
        email: p.user?.email ?? p.email ?? undefined,
      }))
      .filter((a): a is { name: string | undefined; email: string } => !!a.email);

    if (attendees.length === 0) return;

    const icsContent = this.ics.build({
      uid: event.icsUid,
      sequence: event.sequence,
      title: event.title,
      description: event.description,
      location: event.location,
      startAt: event.startAt,
      endAt: event.endAt,
      organizerName: event.createdBy.name,
      organizerEmail: event.createdBy.email,
      attendees,
      method,
    });

    const verb = method === 'CANCEL' ? 'Cancelled' : 'Invitation';
    for (const p of event.participants) {
      const to = p.user?.email ?? p.email;
      if (!to) continue;
      const rsvpBase = this.config.getOrThrow<string>('FRONTEND_URL');
      const link = `${rsvpBase}/rsvp?token=${this.rsvpToken(p.id)}`;
      const html =
        method === 'CANCEL'
          ? `<p>The meeting <strong>${event.title}</strong> has been cancelled.</p>`
          : `<p>You're invited to <strong>${event.title}</strong>.</p>
             <p><a href="${link}&response=ACCEPTED">Accept</a> · <a href="${link}&response=DECLINED">Decline</a></p>`;
      await this.mail.sendCalendar(to, `${verb}: ${event.title}`, html, icsContent, method);
    }
  }

  private async scheduleReminders(eventId: string) {
    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
      include: { participants: true },
    });
    if (!event || event.reminderMinutesBefore == null) return;
    const fireAt = new Date(event.startAt.getTime() - event.reminderMinutesBefore * 60_000);
    for (const p of event.participants) {
      if (p.userId) await this.reminders.schedule(eventId, p.userId, fireAt);
    }
  }

  /** Materialize recurring occurrences (8 weeks ahead), idempotent by recurrenceId+startAt. */
  private async materialize(baseEventId: string, rule: RecurrenceInput) {
    const base = await this.prisma.event.findUnique({
      where: { id: baseEventId },
      include: { participants: true },
    });
    if (!base || !base.recurrenceId) return;

    const horizon = new Date(Date.now() + HORIZON_WEEKS * 7 * 24 * 60 * 60 * 1000);
    const durationMs = base.endAt.getTime() - base.startAt.getTime();
    const occurrences = generateOccurrences(
      {
        frequency: rule.frequency,
        interval: rule.interval ?? 1,
        byWeekdays: rule.byWeekdays ?? [],
        until: rule.until ? new Date(rule.until) : null,
        count: rule.count ?? null,
      },
      base.startAt,
      horizon,
    );

    const existing = await this.prisma.event.findMany({
      where: { recurrenceId: base.recurrenceId },
      select: { startAt: true },
    });
    const existingTimes = new Set(existing.map((e) => e.startAt.getTime()));

    for (const occStart of occurrences) {
      if (existingTimes.has(occStart.getTime())) continue; // includes the base
      const occ = await this.prisma.event.create({
        data: {
          projectId: base.projectId,
          title: base.title,
          description: base.description,
          startAt: occStart,
          endAt: new Date(occStart.getTime() + durationMs),
          allDay: base.allDay,
          location: base.location,
          color: base.color,
          reminderMinutesBefore: base.reminderMinutesBefore,
          createdById: base.createdById,
          recurrenceId: base.recurrenceId,
          participants: {
            create: base.participants.map((p) =>
              p.userId ? { user: { connect: { id: p.userId } } } : { email: p.email },
            ),
          },
        },
        include: { participants: true },
      });
      await this.scheduleReminders(occ.id);
    }
  }
}
