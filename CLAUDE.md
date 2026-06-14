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
- Phase 2 (auth module + workspaces/projects) next.

## GOTCHAS
- Prisma CLI reads `.env` from cwd. `apps/api/.env` is a symlink → root `.env`. Keep it.
- pnpm build scripts are gated: native deps (argon2, prisma, esbuild, @nestjs/core) listed in root `package.json#pnpm.onlyBuiltDependencies`. After adding a native dep, add it there + `pnpm rebuild <dep>`.
