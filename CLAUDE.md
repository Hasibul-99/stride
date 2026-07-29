# CLAUDE.md — TeamBoard

PROJECT: TeamBoard — work management platform (Bordio-style). Teams plan work on a weekly calendar, manage tasks in kanban/table views, schedule meetings, track time, and chat inside tasks.

## ARCHITECTURE RULES
- Monorepo: `apps/web` (React + Vite), `apps/api` (NestJS), `packages/shared` (types + zod schemas).
- All API request/response types and zod schemas live in `packages/shared` — never duplicate types.
- NestJS: one module per domain (auth, users, workspaces, projects, tasks, events, statuses, time-tracking, chat, files, notes, notifications, calendar-sync). Controller → Service → Prisma. **No business logic in controllers.**
- Every endpoint guarded by `JwtAuthGuard` unless explicitly `@Public()`.
- Authorization: always verify workspace/project membership in services before any read/write. Guests are restricted to their invited projects (`ProjectAccessGuard`).
- Frontend: feature folders under `src/features/*`, shared UI in `src/components/ui`, API hooks with TanStack Query in `src/features/*/api.ts`.
- Dates: store UTC in DB, always send ISO 8601, render in user's timezone with `date-fns-tz`.
- Soft-delete tasks/projects (`deletedAt`) — never hard delete user data.

## CODE STYLE
- TypeScript strict mode, no `any`.
- Descriptive names, small functions, early returns.
- Write/update tests for services with business logic (Jest on API, Vitest on web).

## WORKFLOW
- After significant changes run: `pnpm lint && pnpm build`, and fix errors.
- Prisma schema changes require a named migration (`pnpm db:migrate`).
- Conventional commits.

## LOCAL DEV
- `docker compose up -d` — Postgres :5432, Redis :6379, MinIO :9000 (console :9001), Mailpit SMTP :1025 (UI :8025).
- `pnpm install` then `pnpm db:generate && pnpm db:migrate && pnpm db:seed`.
- `pnpm dev` — API on :3000 (`/api`, docs at `/api/docs`), web on :5173.

## BUILD STATUS
- Phase 0 (scaffold) complete.
- Phase 1 (full Prisma schema + rich seed) complete. All domain entities modeled with indexes. Seed: 3 users, 1 workspace, 2 projects, 8 statuses, 25 tasks (7 on waiting list), 3 events, 3 notes.
- Demo login: `alice@teamboard.local` / `password123` (also bob@, carol@).
- Phase 2 complete:
  - Auth: signup (creates personal workspace), signin, refresh (rotating httpOnly cookie, hashed+revocable in DB), logout, Google OAuth (graceful 503 if unconfigured). argon2, JWT access 15m. Real `JwtAuthGuard` (global) + `@Public()` + `@CurrentUser()`. Signin throttled 5/min. `/users/me` GET+PATCH. 9 e2e tests green.
  - Workspaces/folders/projects/members/invites. Access enforced in services via `AccessService` (`assertWorkspaceMember`, `assertProjectAccess`). Guest isolation verified (guest sees only invited projects, 403 elsewhere). Default statuses seeded on project create. Invites email via Mailpit (`MailService`).
  - Frontend: signin/signup wired, silent-refresh session bootstrap (`useSession`/`RequireAuth`), sidebar (workspace switcher + folders + projects + new-project modal), project page.
- Phase 3 complete:
  - Tasks: CRUD `/projects/:projectId/tasks`, waiting list (nullable `scheduledDate`), complete-snap (move to isCompleted status → `completedAt`=now + snap scheduledDate to today), bulk drag endpoint `PATCH /projects/:projectId/tasks/positions` (float positions, one transaction, completion-aware). Soft delete.
  - Statuses: CRUD `/projects/:projectId/statuses`, delete requires `?targetStatusId=` (migrates tasks), cannot delete/unflag the last completed status.
  - Dates: `scheduledDate` stored as `@db.Date` UTC-midnight; API serializes to/parses `YYYY-MM-DD` (helpers in `tasks.service.ts`).
  - Frontend: task/status/member hooks, `TaskCard`, `TaskDrawer` (status/assignee/date/estimate edit), `StatusManager` (add/recolor/rename/delete-migrate/toggle done), interim status-column board on ProjectPage with quick-add. `Avatar` primitive.
  - Estimate parse/format helpers in shared (`parseDurationToMinutes`, `formatMinutes`).
- Phase 4 complete:
  - Backend: workspace planner endpoint `GET /workspaces/:id/planner?from=&to=&assigneeId=` (tasks across visible projects, enriched with project/status/assignee) + `/planner-members`.
  - dnd-kit: generic `SortableBoard` multi-container (features/board) reused by Calendar + Kanban. Position via float-midpoint helper (`features/tasks/positions.ts`), persisted through bulk-positions endpoint.
  - CalendarView: week columns (Mon–Sun) + waiting-list panel + per-day workload footer (amber>8h/red>10h) + drag between days/waiting + filters (assignee/status/completed) + quick-add. Week nav + Today.
  - KanbanView: status columns, drag changes status (completion-aware via bulk endpoint), quick-add, manage-statuses.
  - TableView: sortable columns, inline edit (title/status/assignee/date), show/hide completed, row select + bulk status/delete.
  - ProjectPage tabs Calendar/Kanban/Table. Team board page `/app/team` (planner grouped by member rows, workload tint) — read-only for now.
- Phase 5 complete:
  - Events CRUD `/events` (personal or project). Participants = workspace users + external emails. On create/update: build ICS (`ics` pkg, stable `icsUid`, `sequence` bumped on update, METHOD:REQUEST) + email each participant via `MailService.sendCalendar` (Mailpit). Delete → METHOD:CANCEL email + soft delete.
  - RSVP via signed HMAC token (`ENCRYPTION_KEY`) in invite links → public `POST /events/rsvp`. No storage.
  - Reminders: BullMQ delayed job per participant at `startAt - reminderMinutesBefore` → `RemindersProcessor` creates a Notification. `BullModule.forRoot` connects to Redis (parsed from `REDIS_URL`).
  - Recurrence: pure generator `recurrence.generator.ts` (DAILY/WEEKLY-multi-weekday/MONTHLY, interval/until/count) — 6 jest tests green. Events with a rule materialize occurrences 8 weeks ahead (idempotent by recurrenceId+startAt), each with participants + reminders.
  - Frontend: events hooks, `EventModal` (participants + recurrence + reminder + color), events rendered in CalendarView day headers (tinted, click→`EventDrawer` with RSVP statuses), workload footer includes event durations, public `/rsvp` page.
- Phase 6 complete:
  - Time tracking: `POST /tasks/:id/time/start|stop` (one running entry per user — start auto-stops others), `GET /tasks/:id/time`, manual `POST /tasks/:id/time`, `PATCH/DELETE /time/:id` (own entries, or workspace OWNER/ADMIN), `GET /time/running`, `GET /workspaces/:id/time-report` (+ `.csv`). `TimeService.duration` = seconds.
  - Workload: `GET /workspaces/:id/workload?from=&to=` → per member/day task+event minutes, counts, unestimated count, capacity; `PATCH /workspaces/:id/capacity` (admin). `MemberCapacity` default 480m.
  - Frontend: `TimerButton` (play/stop on TaskCard + drawer), global `TimerPill` in AppLayout topbar (live tick, jump/stop), Time section in TaskDrawer (entries + tracked-vs-estimate bar), `WorkloadPage` (`/app/workload`, grid + editable capacity + over-tint), `ReportsPage` (`/app/reports`, by-user/by-project + CSV download via fetch+blob). Sidebar links added.
- Phase 7 complete:
  - Socket.IO `RealtimeGateway` (`@nestjs/websockets`/`platform-socket.io` pinned v10), JWT auth on handshake (`auth.token`), Redis adapter (`@socket.io/redis-adapter` + ioredis from `REDIS_URL`). Rooms: `user:{id}` (auto on connect, for notifications), `project:{id}`, `task:{id}` — joins validated via `AccessService`/`ChatService.assertAccess`.
  - `RealtimeEmitter` (global, holds the io server; gateway sets it in afterInit) decouples services from the gateway → no circular deps. Services call `emitProject/emitTask/emitUser`.
  - Chat: REST history (cursor) + unread + mark-read (`/tasks/:id/chat*`); socket `chat:send|edit|delete|typing` → emits `chat:new|updated|deleted|typing-ping` to task room. @mentions create notifications.
  - Live board: tasks service emits `board:changed {projectId}` to project room on create/update/delete/bulk; clients invalidate `['tasks',pid]`/`['events']`/`['planner']`.
  - Notifications (global module): persist + socket push `notification:new` to `user:{id}`; REST list (cursor) + unread-count + read/read-all. Triggers wired: TASK_ASSIGNED, MENTION, EVENT_REMINDER.
  - Frontend: singleton socket (`lib/socket.ts`, Vite proxies `/socket.io` ws), `useProjectLive` (join+invalidate), `ChatPanel` in TaskDrawer (history + live + typing + mark-read), `NotificationBell` in topbar (unread badge + dropdown + socket push).
- Phase 8 complete:
  - Files: S3/MinIO presigned flow — `POST /files/presign` → client direct PUT → `POST /files/confirm` (Attachment row). Mime whitelist + 25MB cap + virus-scan stub. `GET /tasks/:id/files` (incl chat-posted), `GET /files/:id/download` (short-lived presigned GET), `DELETE /files/:id` (uploader or admin). `S3Service` uses `forcePathStyle` for MinIO.
  - Notes: CRUD `/projects/:id/notes` + `/notes/:id` (TipTap JSON content). Update emits `board:changed {noteUpdated}` → frontend conflict banner (last-write-wins, not CRDT).
  - Search: `GET /workspaces/:id/search?q=` — tasks + notes by title (ILIKE) across accessible projects (guest-scoped). (FTS tsvector/GIN refinement deferred; note-content search not included.)
  - Frontend: `FilesSection` in TaskDrawer (drag-drop + click upload, image thumbs, download, delete), Notes tab on ProjectPage (`NotesView` list + `NoteEditor` TipTap + 800ms autosave + Saved indicator + refresh banner), `SearchPalette` (Cmd/Ctrl+K) in AppLayout.
- Phase 9 complete (Google Calendar two-way sync):
  - AES-256-GCM `crypto.util` (key derived from `ENCRYPTION_KEY`) encrypts the stored Google refresh token. 4 unit tests.
  - `GoogleCalendarService`: incremental-consent connect URL (calendar.events scope, state=userId), callback stores encrypted token + runs initial import (past 1wk/future 8wk, primary calendar). `syncIncremental` via syncToken; 410 GONE → clears token + full re-sync. `pushEvent` (insert/patch/delete) for owner's personal events with loop guard (`gcalSyncedAt >= updatedAt` ⇒ skip). Webhook handler `handleWebhook(channelId,resourceId)` → sync. Graceful when unconfigured (status `configured:false`, connect → 503).
  - `IntegrationsController`: `GET status|connect`, `GET callback` (Public, state-based), `POST sync`, `DELETE` disconnect, `POST webhook` (Public). EventsService pushes personal-event create/update/delete to Google.
  - User fields: `gcalConnectedAt/gcalSyncToken/gcalChannelId/gcalResourceId`; Event `gcalSyncedAt`.
  - 5 integration tests (mocked googleapis): import+token, cancel→soft-delete, push insert+id, push delete, 410 re-sync. **Total api tests: 15/15.**
  - Frontend: `SettingsPage` (`/app/settings`) Integrations connect/sync/disconnect, Google icon on synced events in EventDrawer, "Also delete from Google?" confirm.
- Phase 10 complete (design):
  - `styles/tokens.css` — CSS-variable design system (surfaces, 3 greys, primary + tint/hover, semantic success/warning/danger + tints, 13px-base type scale, 4px spacing, radii control/card/modal, 3 subtle shadows, full dark-mode variant). Imported by `styles/index.css` (Inter, 150ms ease-out transitions on color/opacity/transform/shadow, focus-visible ring, scrollbar).
  - `tailwind.config.js` consumes the vars (colors incl surface/border/foreground/muted/primary/semantic, fontSize, borderRadius, boxShadow).
  - Primitives in `components/ui`: `Button` (primary/secondary/ghost/danger × sm/md/lg), `Input`, `Badge` (5 tones), `Modal`, plus existing `Avatar`/`Tabs`. Living style guide at `/app/design-system` (`DesignSystemPage`).
  - TaskCard polish: shadow-sm + hover lift/shadow-md, completed = 55% opacity + ✓ replacing status dot + strikethrough.
  - Marketing `LandingPage` at public `/` (hero + headline, browser-framed planner mockup, 8 feature blocks, industries strip, CTA, footer). `/` no longer redirects to `/app`.
- Phase 11 complete (hardening + deploy) — **ALL 11 PHASES DONE**:
  - Security e2e `test/security.e2e-spec.ts`: guest-of-A → 403 on project B / its tasks / workspace members; presign rejects disallowed MIME. `doc/SECURITY.md` written.
  - Frontend resilience: `ErrorBoundary` (main.tsx), global toast (`store/toast.store.ts` + `Toaster`), MutationCache `onError` → toast (401 skipped, handled by refresh interceptor).
  - Perf: route-level `React.lazy` + Suspense in router → initial bundle 984KB→457KB, ProjectPage (TipTap+dnd) split into its own chunk.
  - Playwright scaffold: `apps/web/playwright.config.ts` + `apps/web/e2e/critical-flows.spec.ts` (needs `playwright install` + live stack; `pnpm --filter @teamboard/web e2e`).
  - eslint: added `eslint-plugin-react-hooks` (scoped to apps/web) ; `pnpm lint` clean.
  - Deploy: `Dockerfile.api` (multi-stage, `pnpm deploy --prod`, entrypoint runs `prisma migrate deploy`), `Dockerfile.web` (build → nginx), `docker/nginx.conf` (gzip, asset cache, /api + /socket.io proxy, SPA fallback), `docker-compose.prod.yml` (postgres + daily backup, redis AOF, api ×2, web), `.github/workflows/ci.yml` (lint→typecheck→test→e2e→build→docker), `doc/DEPLOYMENT.md`, `doc/TESTING.md`. `prisma` moved to api runtime deps for in-container migrate.
- Tests: **15 unit + 14 e2e green**. `pnpm build/lint/typecheck` all clean.

### Phase 11 deferred
- Real Sentry wiring (hook points noted: ErrorBoundary + global exception filter).
- Playwright multi-browser websocket test + ICS-in-Mailpit assertion (scaffolded, not run here — no browser binaries).

## GAP-CLOSURE PASS (post-Phase-11) — completed
Went back and finished playbook requirements previously deferred:
- **Task recurrence**: `createTask` accepts `recurrence`; `TasksService.materialize` generates occurrences 8wk ahead (idempotent). Verified: weekly×3 → 3 occurrences.
- **Recurrence edit-scope**: `DELETE /tasks/:id?scope=` and `/events/:id?scope=` (THIS / THIS_AND_FOLLOWING / ALL); completed occurrences never altered. Drawers prompt scope when recurring.
- **Nightly rolling materialize**: `RecurrenceQueueModule` BullMQ repeatable (`0 2 * * *`) → `rollingMaterialize` for tasks + events.
- **Notification prefs + email digests**: User `emailNotifications` + `notifPrefs` JSON; `GET/PATCH /notifications/preferences`; high-value notifs enqueue a 10-min delayed `notif-digest` job that emails only if still unread + opted-in (`DigestProcessor`). Frontend `NotificationPrefs` in Settings.
- **Notification deep-links**: payloads carry `projectId`; bell items mark-read + navigate.
- **Postgres FTS**: `fts` migration adds generated `searchVector` tsvector + GIN on tasks/notes (declared `Unsupported("tsvector")` to avoid drift); `SearchService` uses `websearch_to_tsquery`. Verified.
- **Google `events.watch`** channel registered on connect (graceful) + **15-min poll** BullMQ repeatable (`gcal-poll`) → `pollAll`.
- **Table view**: group-by (status/assignee/date), column-visibility menu (localStorage), row virtualization (`@tanstack/react-virtual`) for ungrouped lists.
- **Dark-mode toggle** (`ThemeToggle`, persists, applied on boot), **clipboard-paste upload** (FilesSection), **12h timer reconcile** prompt (TimerPill).

### Still intentionally deferred (minor/optional)
- Assignee daily-load hint inline in the date/assignee picker.
- Team-board cross-project drag (read-only; per-project boards have full drag).
- Sentry, real virus scanner (playbook asked only for the stub — satisfied).

### Phase 10 deferred / notes
- Existing feature components already used token utility classes (bg-surface/border/muted/primary), so the token swap restyled them globally; not every inline-styled control was migrated to the new primitives.
- Landing uses an abstract CSS mockup, not real seeded screenshots. No dark-mode toggle UI yet (tokens ready, add `.dark` on root to enable).
- Web bundle ~984KB (TipTap+googleapis types stripped, but app is one chunk) — code-split in Phase 11 perf.

### Phase 9 deferred
- Push-notification channel registration (`events.watch`) not created on connect — only the webhook receiver + 15-min polling intent exist; wire `cal.events.watch` + a BullMQ repeatable poll job for production.
- Sync only covers the user's primary calendar + personal (projectId null) TB events.

### Phase 8 deferred
- Postgres FTS (tsvector + GIN) — currently ILIKE title search; note-content/body not searched.
- Files on events/chat-composer in UI (backend supports event/message targets; only task UI wired).
- Paste-from-clipboard upload; lightbox (thumbs link to presigned URL in new tab).

### Phase 7 deferred
- Email digests for high-value notifications (BullMQ, 10-min unseen) — not built.
- Notification deep-links to task/event drawer; notification preferences page; per-task chat unread badge on TaskCard; precise cache patching (uses invalidate, not echo-guarded patch).

### Phase 6 deferred
- Assignee-load shown inline in date/assignee picker (workload endpoint exists; UI hint not wired).
- 12h "timer still running" reconciliation prompt on return.

### Phase 5 deferred
- Task recurrence (generator is generic + ready; only events wired so far).
- Edit "this / this-and-following" occurrence split + nightly rolling materialize job (BullMQ repeat) — only immediate materialize-on-create done.
- Google Calendar sync is Phase 9.

### Phase 4 deferred
- Events not yet rendered in calendar (Phase 5).
- Team board is read-only (cross-project drag not wired); single-project calendar/kanban have full drag.
- Table: virtualization, group-by, column-visibility menu, files/chat/time columns not done (need later phases / large-list perf).

## DEFERRED (pick up later)
- Rich text: task description is plain textarea for now; TipTap editor lands with notes (Phase 8) / can be added in Phase 4 polish.
- dnd-kit drag-and-drop (tasks between days/columns, project/folder reorder): Phase 4 — bulk-positions endpoint already exists to back it.

## CONVENTIONS (added in Phase 2)
- Request validation: zod schemas from `@teamboard/shared` via `@ZodBody(schema)` decorator (`src/common/pipes/zod-body.decorator.ts`). Not class-validator.
- `packages/shared` builds with **tsup** (dual ESM+CJS). Required: CJS `export *` hides named runtime exports from Vite/rollup. After editing shared, `pnpm --filter @teamboard/shared build` (or run its `dev` watch).
- Invite tokens: random base64url, stored as deterministic `sha256` hash for lookup (`src/common/hash.ts`). Refresh tokens use argon2 (looked up by jti).

## GOTCHAS
- Prisma CLI reads `.env` from cwd. `apps/api/.env` is a symlink → root `.env`. Keep it.
- pnpm build scripts are gated: native deps (argon2, prisma, esbuild, @nestjs/core) listed in root `package.json#pnpm.onlyBuiltDependencies`. After adding a native dep, add it there + `pnpm rebuild <dep>`.
