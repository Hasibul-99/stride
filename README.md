# TeamBoard

A Bordio-style work management platform for result-driven teams. Weekly calendar planner, kanban + table views, meetings with ICS invites, time tracking, task chat, and more.

👉 **New here? Read the [User Guide](USER_GUIDE.md)** — how to run it and how to use every feature.

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

## Email verification & password reset (OTP)

New signups must verify a 4-digit code emailed to them before they can sign in,
and passwords are reset with the same OTP mechanism.

- **Endpoints** (all under `/api/auth`): `signup` (creates an *unverified* account
  + emails a code, returns no token), `verify-email` (code → tokens, lands logged in),
  `resend-otp`, `forgot-password` (generic response — never reveals if an email exists),
  `reset-password` (code + new password; revokes all existing sessions). Unverified
  sign-in returns `403 { code: 'EMAIL_NOT_VERIFIED' }` and the web app bounces to the
  verify screen.
- **Security:** codes hashed at rest (argon2), 10-min expiry, 5 attempts then the code
  is invalidated, 60s resend cooldown + 5 sends/hour, one active code per (email, purpose).
  Tunables live in `packages/shared/src/constants.ts` (`OTP_LENGTH`, `OTP_EXPIRY_MINUTES`, …).

### Required `.env` mail vars
```bash
SMTP_HOST=smtp.gmail.com      # dev default: localhost (Mailpit)
SMTP_PORT=587                 # 587 = STARTTLS (secure:false); use 465 for SSL
SMTP_USER=you@gmail.com       # a Gmail App Password account
SMTP_PASS=your-app-password   # NOT your normal password — create an App Password
SMTP_FROM="TeamBoard <you@gmail.com>"
```
> ⚠️ Gmail SMTP caps at ~500 emails/day and isn't built for transactional volume —
> fine for launch; move to Resend/Postmark/SES at scale (see the `TODO` in
> `apps/api/src/mail/mail.service.ts`). In local dev, emails are captured by **Mailpit**
> at http://localhost:8025 (no Gmail needed).

### A queue worker must be running
OTP emails are sent **asynchronously** via BullMQ, so the HTTP response isn't blocked on
SMTP. The workers run **in-process with the API** (`pnpm dev` / the running API container),
so they just need **Redis up** (`docker compose up -d`). No separate worker process.

### Cleanup schedule
A daily repeatable job (registered by `OtpModule`, **03:00** server time) deletes
unverified users older than 24h (and their empty personal workspace) plus any expired
OTP rows. It runs automatically while the API is up with Redis available.

See [the prompt playbook](./work-management-platform-claude-code-prompts.md) for the full phase-by-phase build plan.
