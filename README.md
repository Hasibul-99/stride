# TeamBoard

A Bordio-style work management platform for result-driven teams. Weekly calendar planner, kanban + table views, meetings with ICS invites, time tracking, task chat, and more.

## Stack
- **Web:** React 18 + Vite + TypeScript + Tailwind CSS
- **API:** NestJS 10 + Prisma + PostgreSQL
- **Realtime/Queues:** Redis (Socket.IO adapter + BullMQ)
- **Shared:** `packages/shared` — types, zod schemas, constants
- **Monorepo:** pnpm workspaces + Turborepo

## Quick start

```bash
# 1. Start infra (Postgres, Redis, MinIO, Mailpit)
docker compose up -d

# 2. Install deps
pnpm install

# 3. Set up the database
cp .env.example .env
pnpm db:generate && pnpm db:migrate && pnpm db:seed

# 4. Run everything
pnpm dev
```

- Web → http://localhost:5173
- API → http://localhost:3000/api
- API docs → http://localhost:3000/api/docs
- Mailpit UI → http://localhost:8025
- MinIO console → http://localhost:9001

## Scripts
| Command | Description |
|---|---|
| `pnpm dev` | Run web + api in watch mode |
| `pnpm build` | Build all packages |
| `pnpm lint` | Lint all packages |
| `pnpm test` | Run tests |
| `pnpm db:migrate` | Run Prisma migrations |
| `pnpm db:studio` | Open Prisma Studio |
| `pnpm db:seed` | Seed demo data |

See [the prompt playbook](./work-management-platform-claude-code-prompts.md) for the full phase-by-phase build plan.
