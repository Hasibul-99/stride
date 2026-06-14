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
- Phase 4 (Calendar planner / Kanban / Table views + dnd-kit drag) next.

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
