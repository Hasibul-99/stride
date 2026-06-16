import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { google, calendar_v3 } from 'googleapis';

// Use googleapis' bundled OAuth2 type to avoid clashing google-auth-library versions.
type OAuth2Client = InstanceType<typeof google.auth.OAuth2>;
import { PrismaService } from '../prisma/prisma.service';
import { decryptSecret, encryptSecret } from '../common/crypto.util';

const CALENDAR_SCOPE = 'https://www.googleapis.com/auth/calendar.events';
const IMPORT_PAST_DAYS = 7;
const IMPORT_FUTURE_DAYS = 56; // 8 weeks

@Injectable()
export class GoogleCalendarService {
  private readonly logger = new Logger(GoogleCalendarService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  get configured(): boolean {
    return Boolean(this.config.get<string>('GOOGLE_CLIENT_ID'));
  }

  private oauthClient(refreshToken?: string): OAuth2Client {
    if (!this.configured) throw new ServiceUnavailableException('Google OAuth not configured');
    const client = new google.auth.OAuth2(
      this.config.getOrThrow<string>('GOOGLE_CLIENT_ID'),
      this.config.getOrThrow<string>('GOOGLE_CLIENT_SECRET'),
      this.config.get<string>('GOOGLE_CALLBACK_URL'),
    );
    if (refreshToken) client.setCredentials({ refresh_token: refreshToken });
    return client;
  }

  /** Incremental-consent URL for the calendar.events scope. */
  connectUrl(userId: string): string {
    return this.oauthClient().generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent',
      include_granted_scopes: true,
      scope: [CALENDAR_SCOPE],
      state: userId,
    });
  }

  async handleCallback(userId: string, code: string): Promise<void> {
    const client = this.oauthClient();
    const { tokens } = await client.getToken(code);
    if (!tokens.refresh_token) {
      throw new ServiceUnavailableException('Google did not return a refresh token');
    }
    const secret = this.config.getOrThrow<string>('ENCRYPTION_KEY');
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        googleRefreshToken: encryptSecret(tokens.refresh_token, secret),
        gcalConnectedAt: new Date(),
        gcalSyncToken: null,
      },
    });
    await this.importInitial(userId);
  }

  async status(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { gcalConnectedAt: true },
    });
    return { connected: !!user?.gcalConnectedAt, configured: this.configured };
  }

  async disconnect(userId: string): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        googleRefreshToken: null,
        gcalConnectedAt: null,
        gcalSyncToken: null,
        gcalChannelId: null,
        gcalResourceId: null,
      },
    });
  }

  private async calendarFor(userId: string): Promise<{ cal: calendar_v3.Calendar; user: { id: string } } | null> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, googleRefreshToken: true, gcalConnectedAt: true },
    });
    if (!user?.googleRefreshToken || !user.gcalConnectedAt) return null;
    const secret = this.config.getOrThrow<string>('ENCRYPTION_KEY');
    let refreshToken: string;
    try {
      refreshToken = decryptSecret(user.googleRefreshToken, secret);
    } catch {
      this.logger.warn(`Failed to decrypt refresh token for ${userId}`);
      return null;
    }
    const auth = this.oauthClient(refreshToken);
    return { cal: google.calendar({ version: 'v3', auth }), user: { id: user.id } };
  }

  // ─── Import + incremental sync ─────────────────────────

  async importInitial(userId: string): Promise<{ imported: number }> {
    const ctx = await this.calendarFor(userId);
    if (!ctx) return { imported: 0 };
    const timeMin = new Date(Date.now() - IMPORT_PAST_DAYS * 86400000).toISOString();
    const timeMax = new Date(Date.now() + IMPORT_FUTURE_DAYS * 86400000).toISOString();

    let pageToken: string | undefined;
    let syncToken: string | undefined;
    let imported = 0;
    do {
      const res = await ctx.cal.events.list({
        calendarId: 'primary',
        singleEvents: true,
        showDeleted: false,
        timeMin,
        timeMax,
        pageToken,
      });
      for (const ev of res.data.items ?? []) {
        await this.applyGoogleEvent(userId, ev);
        imported += 1;
      }
      pageToken = res.data.nextPageToken ?? undefined;
      syncToken = res.data.nextSyncToken ?? syncToken;
    } while (pageToken);

    if (syncToken) {
      await this.prisma.user.update({ where: { id: userId }, data: { gcalSyncToken: syncToken } });
    }
    return { imported };
  }

  async syncIncremental(userId: string): Promise<{ changed: number }> {
    const ctx = await this.calendarFor(userId);
    if (!ctx) return { changed: 0 };
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { gcalSyncToken: true },
    });
    if (!user?.gcalSyncToken) {
      await this.importInitial(userId);
      return { changed: 0 };
    }

    let pageToken: string | undefined;
    let changed = 0;
    try {
      do {
        const res = await ctx.cal.events.list({
          calendarId: 'primary',
          syncToken: user.gcalSyncToken,
          pageToken,
          showDeleted: true,
        });
        for (const ev of res.data.items ?? []) {
          await this.applyGoogleEvent(userId, ev);
          changed += 1;
        }
        pageToken = res.data.nextPageToken ?? undefined;
        if (res.data.nextSyncToken) {
          await this.prisma.user.update({
            where: { id: userId },
            data: { gcalSyncToken: res.data.nextSyncToken },
          });
        }
      } while (pageToken);
    } catch (err) {
      if (this.isGone(err)) {
        // 410 GONE → sync token expired, full re-sync.
        await this.prisma.user.update({ where: { id: userId }, data: { gcalSyncToken: null } });
        await this.importInitial(userId);
        return { changed: 0 };
      }
      throw err;
    }
    return { changed };
  }

  private isGone(err: unknown): boolean {
    return typeof err === 'object' && err !== null && (err as { code?: number }).code === 410;
  }

  /** Map a Google event into TeamBoard (create/update/soft-delete). */
  private async applyGoogleEvent(userId: string, ev: calendar_v3.Schema$Event): Promise<void> {
    if (!ev.id) return;
    const existing = await this.prisma.event.findFirst({ where: { googleEventId: ev.id } });

    if (ev.status === 'cancelled') {
      if (existing && !existing.deletedAt) {
        await this.prisma.event.update({
          where: { id: existing.id },
          data: { deletedAt: new Date(), gcalSyncedAt: new Date() },
        });
      }
      return;
    }

    const start = ev.start?.dateTime ?? (ev.start?.date ? `${ev.start.date}T00:00:00.000Z` : null);
    const end = ev.end?.dateTime ?? (ev.end?.date ? `${ev.end.date}T00:00:00.000Z` : null);
    if (!start || !end) return;

    const data = {
      title: ev.summary ?? '(no title)',
      description: ev.description ?? null,
      startAt: new Date(start),
      endAt: new Date(end),
      allDay: !ev.start?.dateTime,
      location: ev.location ?? null,
      gcalSyncedAt: new Date(),
    };

    if (existing) {
      await this.prisma.event.update({ where: { id: existing.id }, data });
    } else {
      await this.prisma.event.create({
        data: {
          ...data,
          projectId: null, // imported as personal events
          color: 'blue',
          createdById: userId,
          googleEventId: ev.id,
        },
      });
    }
  }

  // ─── Push TeamBoard → Google ───────────────────────────

  /** Push an owner's personal-event change to Google. Loop-guarded. */
  async pushEvent(userId: string, eventId: string, action: 'upsert' | 'delete'): Promise<void> {
    const ctx = await this.calendarFor(userId);
    if (!ctx) return;
    const event = await this.prisma.event.findUnique({ where: { id: eventId } });
    if (!event || event.createdById !== userId) return;

    // Loop guard: skip if the latest change came from a Google sync.
    if (action === 'upsert' && event.gcalSyncedAt && event.gcalSyncedAt >= event.updatedAt) return;

    try {
      if (action === 'delete') {
        if (event.googleEventId) {
          await ctx.cal.events.delete({ calendarId: 'primary', eventId: event.googleEventId });
        }
        return;
      }
      const body: calendar_v3.Schema$Event = {
        summary: event.title,
        description: event.description ?? undefined,
        location: event.location ?? undefined,
        start: { dateTime: event.startAt.toISOString() },
        end: { dateTime: event.endAt.toISOString() },
      };
      if (event.googleEventId) {
        await ctx.cal.events.patch({ calendarId: 'primary', eventId: event.googleEventId, requestBody: body });
      } else {
        const res = await ctx.cal.events.insert({ calendarId: 'primary', requestBody: body });
        if (res.data.id) {
          await this.prisma.event.update({
            where: { id: eventId },
            data: { googleEventId: res.data.id, gcalSyncedAt: new Date() },
          });
        }
      }
    } catch (err) {
      this.logger.warn(`Push to Google failed for event ${eventId}: ${String(err)}`);
    }
  }

  /** Webhook hit by Google's push channel → run incremental sync for the channel owner. */
  async handleWebhook(channelId: string, resourceId: string): Promise<void> {
    const user = await this.prisma.user.findFirst({
      where: { gcalChannelId: channelId, gcalResourceId: resourceId },
      select: { id: true },
    });
    if (user) await this.syncIncremental(user.id);
  }
}
