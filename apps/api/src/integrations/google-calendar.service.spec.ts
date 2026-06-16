import { encryptSecret } from '../common/crypto.util';

// Controllable fake Google Calendar client.
const cal = {
  events: {
    list: jest.fn(),
    insert: jest.fn(),
    patch: jest.fn(),
    delete: jest.fn(),
  },
};

jest.mock('googleapis', () => ({
  google: {
    auth: { OAuth2: jest.fn().mockImplementation(() => ({ setCredentials: jest.fn() })) },
    calendar: jest.fn(() => cal),
  },
}));

jest.mock('google-auth-library', () => ({ OAuth2Client: jest.fn() }));

// Imported after mocks are registered.
import { GoogleCalendarService } from './google-calendar.service';

const SECRET = 'unit-test-encryption-key';

function makeConfig() {
  const values: Record<string, string> = {
    GOOGLE_CLIENT_ID: 'cid',
    GOOGLE_CLIENT_SECRET: 'csecret',
    GOOGLE_CALLBACK_URL: 'http://localhost/cb',
    ENCRYPTION_KEY: SECRET,
  };
  return {
    get: (k: string) => values[k],
    getOrThrow: (k: string) => values[k],
  };
}

function makePrisma(overrides: Record<string, unknown> = {}) {
  return {
    user: {
      findUnique: jest.fn().mockResolvedValue({
        id: 'u1',
        googleRefreshToken: encryptSecret('refresh-tok', SECRET),
        gcalConnectedAt: new Date(),
        gcalSyncToken: null,
      }),
      update: jest.fn().mockResolvedValue({}),
      findFirst: jest.fn(),
    },
    event: {
      findFirst: jest.fn().mockResolvedValue(null),
      findUnique: jest.fn(),
      create: jest.fn().mockResolvedValue({ id: 'e1' }),
      update: jest.fn().mockResolvedValue({ id: 'e1' }),
    },
    ...overrides,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function service(prisma: any) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return new GoogleCalendarService(makeConfig() as any, prisma);
}

describe('GoogleCalendarService', () => {
  beforeEach(() => jest.clearAllMocks());

  it('imports events and stores the sync token', async () => {
    cal.events.list.mockResolvedValueOnce({
      data: {
        items: [
          {
            id: 'g1',
            summary: 'Imported',
            start: { dateTime: '2026-06-20T10:00:00Z' },
            end: { dateTime: '2026-06-20T11:00:00Z' },
            status: 'confirmed',
          },
        ],
        nextSyncToken: 'tok-123',
      },
    });
    const prisma = makePrisma();
    const res = await service(prisma).importInitial('u1');
    expect(res.imported).toBe(1);
    expect(prisma.event.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ googleEventId: 'g1', projectId: null }) }),
    );
    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { gcalSyncToken: 'tok-123' } }),
    );
  });

  it('soft-deletes a TB event when Google reports it cancelled', async () => {
    cal.events.list.mockResolvedValueOnce({
      data: { items: [{ id: 'g2', status: 'cancelled' }], nextSyncToken: 't' },
    });
    const prisma = makePrisma();
    prisma.event.findFirst.mockResolvedValue({ id: 'e2', deletedAt: null });
    await service(prisma).importInitial('u1');
    expect(prisma.event.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'e2' }, data: expect.objectContaining({ deletedAt: expect.any(Date) }) }),
    );
  });

  it('pushes a new TB event to Google and stores the returned id', async () => {
    const prisma = makePrisma();
    prisma.event.findUnique.mockResolvedValue({
      id: 'e1',
      createdById: 'u1',
      googleEventId: null,
      title: 'Local',
      description: null,
      location: null,
      startAt: new Date('2026-06-21T09:00:00Z'),
      endAt: new Date('2026-06-21T10:00:00Z'),
      gcalSyncedAt: null,
      updatedAt: new Date(),
    });
    cal.events.insert.mockResolvedValue({ data: { id: 'gNew' } });
    await service(prisma).pushEvent('u1', 'e1', 'upsert');
    expect(cal.events.insert).toHaveBeenCalled();
    expect(prisma.event.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ googleEventId: 'gNew' }) }),
    );
  });

  it('deletes from Google when a TB event is removed', async () => {
    const prisma = makePrisma();
    prisma.event.findUnique.mockResolvedValue({
      id: 'e1',
      createdById: 'u1',
      googleEventId: 'gExisting',
    });
    await service(prisma).pushEvent('u1', 'e1', 'delete');
    expect(cal.events.delete).toHaveBeenCalledWith(
      expect.objectContaining({ eventId: 'gExisting' }),
    );
  });

  it('full re-syncs when the sync token is gone (410)', async () => {
    const prisma = makePrisma();
    prisma.user.findUnique
      .mockResolvedValueOnce({
        id: 'u1',
        googleRefreshToken: encryptSecret('refresh-tok', SECRET),
        gcalConnectedAt: new Date(),
      }) // calendarFor
      .mockResolvedValueOnce({ gcalSyncToken: 'old-token' }); // syncIncremental token lookup
    cal.events.list
      .mockRejectedValueOnce({ code: 410 }) // incremental call → GONE
      .mockResolvedValueOnce({ data: { items: [], nextSyncToken: 'fresh' } }); // importInitial
    const res = await service(prisma).syncIncremental('u1');
    expect(res.changed).toBe(0);
    expect(cal.events.list).toHaveBeenCalledTimes(2);
  });
});
