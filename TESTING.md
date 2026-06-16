# Testing

## API (Jest)
Run: `pnpm --filter @teamboard/api test` (unit) and `... test:e2e` (integration/e2e).

> Note: Node 25 exposes a `localStorage` global that jest-environment-node trips on; the test scripts set `NODE_OPTIONS=--localstorage-file=/tmp/tb-ls` to work around it.

### Unit
- `crypto.util.spec.ts` — AES-256-GCM round-trip, random IV, wrong-key + malformed rejection (4).
- `recurrence.generator.spec.ts` — daily/weekly-multiday/monthly, interval>1, until/count, horizon (6).
- `integrations/google-calendar.service.spec.ts` — mocked googleapis: import + sync token, cancel→soft-delete, push insert (+id store), push delete, **410 GONE → full re-sync** (5).

**15 unit tests pass.**

### E2E (supertest, real Postgres/Redis)
- `auth.e2e-spec.ts` — signup (+ personal workspace), dup→409, weak pw→400, signin ok/401, protected 401/200, **refresh rotation revokes old token**, logout revoke (9).
- `security.e2e-spec.ts` — **guest isolation**: guest reads invited project (200) but gets 403 on a sibling project, its tasks, and workspace members; presign rejects disallowed MIME (5).

**14 e2e tests pass.**

## Web (Playwright — scaffold)
Critical browser flows in `apps/web/e2e/`. Requires a running stack + browsers:
```
pnpm exec playwright install chromium
# in one shell: pnpm dev   (api :3000 + web :5173)
pnpm --filter @teamboard/web e2e
```
- `critical-flows.spec.ts` — signup → create project → Kanban quick-add task; landing hero renders.

Further browser flows to add: drag a task to a day then complete it (greyed on that day); create event with external email → assert ICS in Mailpit (`:8025` API); start/stop timer; kanban drag reflected in a second browser via WebSocket.

## Manual verification performed during build
Each phase was curl-verified against the live stack: auth flow, guest isolation, task complete-snap, bulk drag positions, status delete-migration, events + ICS in Mailpit + RSVP + recurrence materialization, time one-timer + report + CSV, workload grid, realtime (socket connect, chat, assignment notification + board:changed through the Vite proxy), file presign→PUT→confirm round-trip against MinIO, search.
