# Work Management Platform — Claude Code Prompt Playbook

A complete, phase-by-phase set of prompts to build a Bordio-style work management platform for result-driven teams using **React (frontend)**, **NestJS (backend)**, **PostgreSQL + Prisma (database)**, **Redis (realtime/queues)**, and **Claude Code** as your AI developer.

---

## Recommended Stack (my preference)

| Layer | Choice | Why |
|---|---|---|
| Frontend | React 18 + Vite + TypeScript | Fast dev experience, typed |
| State / Data | TanStack Query + Zustand | Server cache + light client state |
| UI | Tailwind CSS + shadcn/ui + dnd-kit | Custom design system, drag & drop |
| Backend | NestJS 10 + TypeScript | Modular, enterprise-grade |
| Database | **PostgreSQL 16 + Prisma ORM** | Relational data (tasks, projects, members) fits perfectly; Prisma gives typed queries & easy migrations |
| Realtime | Socket.IO (NestJS Gateway) + Redis adapter | Task chat, live board updates |
| Queues / Jobs | BullMQ + Redis | Recurring tasks, reminders, ICS emails |
| File storage | S3-compatible (AWS S3 / MinIO locally) | Task & event attachments |
| Auth | JWT (access + refresh) + Google OAuth | Standard, supports Google Calendar sync later |
| Email | Nodemailer + ICS generation (`ics` package) | Meeting invites |
| Monorepo | pnpm workspaces + Turborepo | `apps/web`, `apps/api`, `packages/shared` |

---

## Feature Map (what we are cloning, functionally)

Core views: **Calendar planner** (week view with tasks + events per day), **Task list (table view)**, **Kanban board**, **Projects** (with folders), **Notes** per project.

Core features: schedule tasks/events on specific days, **waiting list** (backlog), **custom task statuses**, meetings with **ICS email invites**, **Google Calendar sync**, **workload management with time estimates**, **recurring tasks/events**, team-level board showing every member's tasks across all projects, completed-task history in calendar, **time tracking** (start/stop timer per task), **real-time task chat**, **file uploads** on tasks/events, rich-text **notes**, guests (external collaborators per project), notifications.

---

## How to use this playbook

1. Install Claude Code: `npm install -g @anthropic-ai/claude-code` (requires Node.js 18+). Docs: https://docs.claude.com/en/docs/claude-code/overview
2. Run `claude` inside your project folder.
3. Feed prompts **one phase at a time, in order**. Each phase builds on the previous.
4. After each phase: run the app, test, commit. Tell Claude Code to fix anything broken before moving on.
5. Prompt 0 creates a `CLAUDE.md` file — this is critical. Claude Code reads it automatically in every session, so your conventions persist.

---

# PHASE 0 — Project Scaffold & CLAUDE.md

## Prompt 0.1 — Monorepo scaffold

```
Create a production-grade monorepo for a work management SaaS called "TeamBoard" (a Bordio-style platform for result-driven teams).

Structure:
- pnpm workspaces + Turborepo
- apps/web → React 18 + Vite + TypeScript + Tailwind CSS + shadcn/ui
- apps/api → NestJS 10 + TypeScript
- packages/shared → shared TypeScript types, zod schemas, and constants used by both apps
- docker-compose.yml at root with: PostgreSQL 16, Redis 7, MinIO (S3-compatible), and Mailpit (local SMTP for testing emails)

Backend setup:
- Prisma ORM connected to PostgreSQL, with a prisma/schema.prisma starter
- Global ValidationPipe with zod or class-validator
- ConfigModule reading .env (provide .env.example with all variables: DATABASE_URL, REDIS_URL, JWT_ACCESS_SECRET, JWT_REFRESH_SECRET, S3 credentials, SMTP settings, GOOGLE_CLIENT_ID/SECRET, FRONTEND_URL)
- Helmet, CORS configured for the web app origin, rate limiting with @nestjs/throttler
- Swagger docs at /api/docs
- Health check endpoint at /api/health

Frontend setup:
- React Router v6 with a route skeleton: /auth/signin, /auth/signup, /app (protected layout)
- TanStack Query configured with sensible defaults
- Zustand store skeleton
- Axios instance with interceptors prepared for JWT refresh flow
- Tailwind configured with a CSS-variable-based theme (we'll define design tokens later)

Add root scripts: dev (runs both apps), build, lint, test, db:migrate, db:studio, db:seed.
Verify everything boots: docker compose up, API on :3000, web on :5173. Fix any errors before finishing.
```

## Prompt 0.2 — CLAUDE.md (project memory)

```
Create a CLAUDE.md file at the repo root that you will follow in all future sessions. Include:

PROJECT: TeamBoard — work management platform (Bordio-style). Teams plan work on a weekly calendar, manage tasks in kanban/table views, schedule meetings, track time, and chat inside tasks.

ARCHITECTURE RULES:
- Monorepo: apps/web (React+Vite), apps/api (NestJS), packages/shared (types + zod schemas)
- All API request/response types and zod schemas live in packages/shared — never duplicate types
- NestJS: one module per domain (auth, users, workspaces, projects, tasks, events, statuses, time-tracking, chat, files, notes, notifications, calendar-sync). Controller → Service → Prisma. No business logic in controllers.
- Every endpoint guarded by JwtAuthGuard unless explicitly @Public()
- Authorization: always verify workspace/project membership in services before any read/write
- Frontend: feature folders under src/features/*, shared UI in src/components/ui, API hooks with TanStack Query in src/features/*/api.ts
- Dates: store UTC in DB, always send ISO 8601, render in user's timezone with date-fns-tz
- Soft-delete tasks/projects (deletedAt) — never hard delete user data

CODE STYLE:
- TypeScript strict mode, no `any`
- Descriptive names, small functions, early returns
- Write/update tests for services with business logic (Jest on API, Vitest on web)

WORKFLOW:
- After significant changes run: pnpm lint && pnpm build, and fix errors
- Prisma schema changes require a named migration (pnpm db:migrate)
- Conventional commits
```

---

# PHASE 1 — Database Schema

## Prompt 1.1 — Full Prisma schema

```
Design the complete Prisma schema for TeamBoard. Think hard about relations before writing. Entities:

User: id, email (unique), passwordHash (nullable for OAuth-only), name, avatarUrl, timezone, googleId, googleRefreshToken (encrypted), createdAt.

Workspace: id, name, logoUrl, ownerId. WorkspaceMember: workspaceId, userId, role (OWNER | ADMIN | MEMBER), joinedAt. Unique on (workspaceId, userId).

Folder: id, workspaceId, name, position — for organizing projects.

Project: id, workspaceId, folderId (nullable), name, color, description, position, archivedAt, deletedAt.
ProjectMember: projectId, userId, role (MANAGER | MEMBER | GUEST). GUEST = external collaborator (client/freelancer) who only sees this project.

TaskStatus: id, projectId, name, color, position, isDefault, isCompleted (marks the "done" column). Every project gets seeded with New / In progress / Completed but users can add unlimited custom statuses and reorder them.

Task: id, projectId, title, description (rich text JSON), statusId, assigneeId (nullable), scheduledDate (DATE, nullable — null means it sits on the waiting list), position (ordering within a day/column), timeEstimateMinutes (nullable), completedAt, createdById, deletedAt, recurrenceId (nullable).

Event (meetings): id, projectId (nullable — personal events allowed), title, description, startAt, endAt, allDay, location, color, createdById, recurrenceId (nullable), reminderMinutesBefore, googleEventId (for sync), icsUid.
EventParticipant: eventId, userId (nullable), email (for external invitees), responseStatus (PENDING | ACCEPTED | DECLINED).

Recurrence: id, frequency (DAILY | WEEKLY | MONTHLY), interval, byWeekdays (int[]), until (nullable), count (nullable). Tasks/events with recurrenceId are generated as materialized occurrences by a background job (generate 8 weeks ahead, rolling).

TimeEntry: id, taskId, userId, startedAt, stoppedAt (nullable while running), durationSeconds (computed on stop). A user can have at most one running entry.

ChatMessage: id, taskId, authorId, body, createdAt, editedAt. MessageRead: messageId, userId.

Attachment: id, taskId (nullable), eventId (nullable), messageId (nullable), uploaderId, fileName, fileSize, mimeType, s3Key.

Note: id, projectId, title, content (rich text JSON), position, createdById, updatedAt.

Notification: id, userId, type, payload (JSON), readAt, createdAt.

Add proper indexes: (projectId, statusId, position) on Task; (assigneeId, scheduledDate) on Task; (workspaceId) lookups; (taskId, createdAt) on ChatMessage.

Create the migration, then write a seed script: demo workspace, 2 projects with custom statuses, 3 users, ~25 tasks spread across this week + waiting list, 3 events, sample notes. Run migration + seed and verify with prisma studio.
```

---

# PHASE 2 — Authentication & Workspaces

## Prompt 2.1 — Auth module

```
Implement the full auth module in apps/api:

- POST /auth/signup (email, password, name) → create user + personal workspace ("My Workspace"), return access token (15 min) + refresh token (30 days, httpOnly secure cookie, rotated on every refresh, stored hashed in DB so we can revoke)
- POST /auth/signin, POST /auth/refresh, POST /auth/logout (revokes refresh token)
- Google OAuth: GET /auth/google → consent screen (request calendar.events scope as optional incremental scope for later sync), callback creates/links user
- Password hashing with argon2, login throttling (5 attempts/min per IP+email)
- JwtAuthGuard global, @Public() decorator, @CurrentUser() decorator
- GET /users/me, PATCH /users/me (name, avatarUrl, timezone)

Frontend:
- /auth/signin and /auth/signup pages (clean, centered card — we'll restyle in the design phase)
- Auth store in Zustand: holds access token in memory only (never localStorage), silent refresh on 401 via axios interceptor, redirect to /auth/signin when refresh fails
- Protected layout route /app that loads /users/me

Write e2e tests for signup/signin/refresh/logout happy paths and failure cases.
```

## Prompt 2.2 — Workspaces, projects, folders, members

```
Implement workspace and project management:

API:
- CRUD /workspaces (only OWNER/ADMIN can update/delete), GET /workspaces/:id/members
- Invitations: POST /workspaces/:id/invites (email + role) → emailed link with signed token → accept endpoint joins the workspace. Same flow for project-level GUEST invites.
- CRUD /workspaces/:id/folders with reordering (PATCH position)
- CRUD /projects (name, color from a fixed 12-color palette, folder assignment, description), archive and soft-delete, reorder within folders
- POST /projects/:id/members — add workspace members or invite guests by email. Guests can only access their invited projects: enforce this in a ProjectAccessGuard used by every project-scoped route.
- When a project is created, seed default statuses: New (grey), In progress (blue), Completed (green, isCompleted=true)

Frontend:
- /app sidebar: workspace switcher at top, then folders (collapsible) with projects inside, color dots, "+ New project" button, drag-to-reorder projects between folders using dnd-kit
- Project creation/edit modal, member management modal with role selector and pending invites list
- Settings page for workspace (name, members, invites)

Maintain optimistic updates with TanStack Query for reordering. Test the guest-isolation rule carefully.
```

---

# PHASE 3 — Tasks Core + Custom Statuses

## Prompt 3.1 — Task CRUD + waiting list + statuses

```
Implement the task system core:

API:
- CRUD /projects/:projectId/tasks. Task fields: title, description (TipTap JSON), statusId, assigneeId, scheduledDate (nullable date), timeEstimateMinutes, position.
- scheduledDate = null → task lives on the WAITING LIST (backlog). Moving between waiting list and a calendar day is just a PATCH of scheduledDate + position.
- Completing a task: PATCH status to an isCompleted status → set completedAt = now, and snap scheduledDate to the completion date (Bordio behavior: completed tasks live on the day they were finished, so scrolling the calendar back shows what was done each day).
- Custom statuses: CRUD /projects/:projectId/statuses with reorder; deleting a status requires a targetStatusId to migrate its tasks; cannot delete the last isCompleted status.
- Bulk position updates endpoint for drag-and-drop: PATCH /tasks/positions accepts [{id, statusId?, scheduledDate?, position}] and applies in a transaction. Use fractional indexing (e.g. LexoRank-style string positions or float midpoints with periodic rebalance) so reorders are O(1) writes.

Frontend:
- TaskCard component: title, project color strip, assignee avatar, time estimate chip (e.g. "1h 30m"), status color dot, completed tasks rendered greyed-out with strikethrough
- Task detail opens as a right-side drawer (not a page): editable title, TipTap rich text description, status dropdown (shows project's custom statuses with colors), assignee picker, date picker (with "Move to waiting list" option), time estimate input accepting "1h 30m" / "90m" formats
- Status manager UI inside project settings: add/rename/recolor/reorder statuses, drag to reorder, delete with migration picker
```

---

# PHASE 4 — The Three Views: Calendar, Kanban, Table

## Prompt 4.1 — Weekly calendar planner (the signature view)

```
Build the weekly calendar planner — the heart of the product (study how Bordio's planner works: columns are DAYS, and tasks + events stack vertically inside each day as cards, NOT a time-grid like Google Calendar).

Layout:
- Horizontal week view: 7 day columns (Mon–Sun), today highlighted, infinite horizontal scroll/pagination to past and future weeks, "Today" button to jump back
- Each day column stacks: events (sorted by start time, showing time range) then tasks (by position). Cards are compact.
- A WAITING LIST panel docked on the right side (collapsible): all unscheduled tasks for the current project, with search and filter by assignee
- Per-day footer showing total scheduled workload: sum of task estimates + event durations, e.g. "6h 30m". Turn the indicator amber over 8h and red over 10h.

Drag & drop (dnd-kit):
- Drag tasks between days, day ↔ waiting list, and reorder within a day. Optimistic updates via the bulk positions endpoint, rollback on failure.
- Multi-select with shift-click and drag a group together.

Filters in the toolbar: by assignee (avatar row), by status, show/hide completed.
Quick add: "+" at the bottom of each day column creates an inline task draft (title + Enter).
Past days show completed tasks greyed out — this is the performance review feature: scrolling back = seeing what each person finished per day.

Mode switch: project calendar (one project's tasks) vs TEAM calendar (rows grouped by member, showing each member's tasks/events across ALL projects in the workspace — one board to manage everyone's work). Build the team mode as a grouped variant of the same view: GET /workspaces/:id/planner?from=&to= returns tasks+events across all projects the requesting user can see.

Keep components performant: virtualize week columns, memoize cards, target smooth 60fps drag.
```

## Prompt 4.2 — Kanban board view

```
Add a Kanban board view per project (tab next to Calendar):

- Columns = the project's custom task statuses, in their configured order, with column header showing status color, name, task count, and summed time estimates
- Drag tasks between columns (changes status) and reorder within columns; dropping into an isCompleted column completes the task (sets completedAt + snaps scheduledDate per Phase 3 rules)
- "+ Add status" column stub at the end opens the status creator
- Quick-add card at bottom of each column
- Same toolbar filters as calendar (assignee, show/hide completed)
- Collapsed-column support and horizontal scroll for many statuses

Reuse TaskCard and the bulk-positions endpoint. Column drag (reordering statuses) updates status positions.
```

## Prompt 4.3 — Table (task list) view

```
Add a Table view per project:

- Columns: checkbox, title (inline editable), status (colored select), assignee, scheduled date, time estimate, time tracked (from TimeEntries), created, files count, chat messages count
- Sort by any column; group-by toggle: status / assignee / date
- Inline editing for every cell without opening the drawer
- Bulk actions on selected rows: change status, assignee, date, delete
- Sticky header, virtualized rows (assume thousands of tasks), keyboard navigation (arrows + Enter to edit)
- Column visibility menu persisted per user in localStorage
```

---

# PHASE 5 — Events, Meetings & Recurrence

## Prompt 5.1 — Events + ICS email invites

```
Implement events (meetings):

API:
- CRUD /events: title, description, startAt/endAt (or allDay), location, projectId (nullable for personal events), color, reminderMinutesBefore
- Participants: workspace members by userId AND external people by raw email. On create/update, generate an ICS file (use the `ics` npm package, stable UID per event, proper METHOD:REQUEST and sequence bumping on updates, METHOD:CANCEL on delete) and email it to all participants via Nodemailer. Test against Mailpit locally.
- Participants respond via signed links in the email (accept/decline) → updates responseStatus
- Reminders: BullMQ delayed job per event per participant at (startAt - reminderMinutesBefore) → creates a Notification and (later) a push to the websocket

Frontend:
- "New event" from the calendar day column or a global "+" button: modal with title, date, start/end time pickers (15-min steps), participants multi-select (members + free-typed emails as chips), reminder select, project select, color
- Events render in calendar day columns above tasks, showing time range and participant avatars; clicking opens an event drawer with RSVP statuses
- Event duration counts toward the day's workload total
```

## Prompt 5.2 — Recurring tasks & events

```
Implement recurrence for both tasks and events:

- Recurrence editor UI in task/event drawers: Daily / Weekly (pick weekdays) / Monthly (day N), every X interval, ends never / on date / after N occurrences. Show a human-readable summary ("Every 2 weeks on Mon, Wed").
- Backend: store the Recurrence rule; a nightly BullMQ job (plus immediate generation on rule create/update) materializes concrete Task/Event rows 8 weeks ahead, linked by recurrenceId. Idempotent — never duplicate occurrences.
- Editing a recurring item asks: "This occurrence only" (detaches it) or "This and following" (truncates the old rule with `until`, creates a new rule)
- Deleting: same two options, plus "All occurrences"
- Completed occurrences are never altered by rule changes
- Recurring items show a repeat icon on their cards

Write unit tests for the occurrence generator covering weekly multi-day rules, interval > 1, until/count limits, and timezone edges (generation must respect the creator's timezone for "which day is it").
```

---

# PHASE 6 — Workload, Time Tracking & Performance

## Prompt 6.1 — Workload management

```
Build workload features on top of time estimates:

- API: GET /workspaces/:id/workload?from=&to= → per member per day: sum of task estimates + event durations + counts. Include tasks without estimates as a separate "unestimated" count.
- Team calendar: each member row header shows their daily and weekly load; day cells get a subtle background tint when overloaded (>8h amber, >10h red)
- A Workload page: grid of members × days for the selected week with hours per cell, weekly totals, and a capacity setting per member (default 8h/day, editable by admins) that drives the over/under coloring
- When assigning a task or scheduling it on a day, show the assignee's current load for that day inline in the picker ("Mon 12 May — already 7h 30m planned")
```

## Prompt 6.2 — Time tracking

```
Implement per-task time tracking:

API:
- POST /tasks/:id/time/start → creates a running TimeEntry; automatically stops any other running entry for that user (one timer at a time)
- POST /tasks/:id/time/stop, GET /tasks/:id/time (entries with users + total), manual entry add/edit/delete (own entries only; admins can edit anyone's)
- GET /workspaces/:id/time-report?from=&to=&projectId=&userId= → totals grouped by user/project/task, CSV export endpoint

Frontend:
- Play/stop button on TaskCard and in the task drawer; running timer shows live elapsed time (tick locally, reconcile with server)
- Global persistent timer pill in the app header showing the running task — click to jump to it, stop from anywhere
- Time tab in task drawer: entries list (who, when, duration), total vs estimate progress bar
- Reports page: filterable time report table with grouping and CSV download
- If the user closes the tab with a timer running, the entry keeps running server-side; on return show a "Timer still running — keep or discard?" reconciliation prompt if it exceeds 12h
```

## Prompt 6.3 — Analytics & reporting dashboard

```
Build an analytics & reporting dashboard — this powers the "productivity tracker", "performance tracker", and "team tracker" angles of the product. Everything reads from existing data (tasks, completedAt, time entries, events, statuses); add no new core tables, only an optional materialized summary table if queries get slow.

API — all workspace-scoped, all respecting membership/guest visibility, all accepting from/to/projectId[]/userId[] filters:
- GET /analytics/summary → headline KPIs for the range: tasks completed, tasks created, completion rate, total time tracked, avg time-to-complete (createdAt → completedAt), active members, overdue count (scheduledDate in past and not completed)
- GET /analytics/throughput → tasks completed per day/week (time series), with a parallel created series so you can see created-vs-completed (burn-up style)
- GET /analytics/by-member → per member: completed count, time tracked, estimated-vs-actual (sum estimate vs sum tracked), on-time rate (completed on or before scheduledDate), current open load. This is the employee productivity/performance view.
- GET /analytics/by-project → per project: open vs completed, time tracked, member contribution breakdown
- GET /analytics/by-status → current distribution of open tasks across statuses (funnel), plus avg time each task spends in each status if status-change history is available (if not, add a lightweight TaskStatusHistory row written on every status change — implement that now so this metric works)
- GET /analytics/workload-heatmap → member × day grid of planned hours over the range (reuse Phase 6.1 workload math)
- GET /analytics/estimate-accuracy → scatter of estimate vs actual per completed task, plus an accuracy ratio per member
- CSV/XLSX export for every report (reuse the time-report export pattern)

Add TaskStatusHistory: id, taskId, fromStatusId, toStatusId, changedById, changedAt — written whenever a task status changes (do it in the task service transaction, and backfill nothing). Index (taskId, changedAt).

Frontend — a dedicated /app/analytics route, with sub-tabs Overview / People / Projects / Time:
- Global filter bar: date-range picker (presets: this week, last week, this month, last 30 days, custom), project multi-select, member multi-select. Filters persist in the URL query string so reports are shareable.
- Overview: KPI stat cards (with delta vs previous equivalent period and up/down arrows), the created-vs-completed throughput line chart, the status-distribution funnel, and an overdue list.
- People: a sortable table (member, completed, time tracked, est-vs-actual bar, on-time %, open load) PLUS the workload heatmap (color intensity = planned hours, capacity-aware coloring from Phase 6.1). Clicking a member filters the whole dashboard to them.
- Projects: per-project cards with open/completed donut, time tracked, and a small contributor breakdown bar.
- Time: time-tracked-by-day area chart, estimate-accuracy scatter, and the existing filterable time report table.
- Use the charting library already available (Recharts) with the design tokens — muted palette, no chart junk, clear empty states ("No completed tasks in this range"), and a top-right export button on every panel.

Performance: these are aggregate queries over potentially large task/time tables — write them as efficient grouped SQL via Prisma ($queryRaw where cleaner), add the indexes they need, and cache each report in Redis for 60s keyed by workspace+filters. Add unit tests for the metric calculations (completion rate, on-time rate, time-to-complete, estimate accuracy) using a fixed seed dataset with known expected values, and watch the timezone boundary on "per day" buckets (bucket by the requesting user's timezone, not UTC).
```

---

# PHASE 7 — Realtime: Chat, Presence, Live Updates

## Prompt 7.1 — WebSocket gateway + task chat

```
Implement realtime with a NestJS Socket.IO gateway using the Redis adapter (so it scales horizontally):

Infrastructure:
- Authenticate sockets with the JWT access token on connect
- Rooms: workspace:{id}, project:{id}, task:{id}. Join/leave validated against membership (reuse the same access checks as HTTP).

Task chat:
- ChatMessage CRUD over both REST (history, pagination by cursor) and socket (send, edit, delete) with optimistic UI
- @mentions with member autocomplete → creates a Notification for the mentioned user
- File attachments in messages (wire to the files module in Phase 8)
- Unread counts per task per user (MessageRead); chat icon on TaskCard shows unread badge; mark-as-read when the chat tab is open and focused
- Typing indicators and message timestamps grouped by day

Live board updates:
- Server emits task.created/updated/moved/deleted, event.*, status.* to project rooms; clients patch TanStack Query caches so two users see each other's drags within ~100ms. Guard against echo (ignore events originated by your own mutation id).
```

## Prompt 7.2 — Notifications

```
Build the notification system:

- Triggers: task assigned to you, task status changed on your task, @mention, chat message in a task you participate in, event invitation, event reminder, invite accepted
- Notification model already exists; add REST list (cursor pagination) + unread count + mark read/mark all read, and socket push notification.new
- Frontend: bell icon in header with unread badge, dropdown panel with grouped notifications ("Today", "Earlier"), each deep-links to the task/event drawer
- Email digests: BullMQ job sends an email for high-value notifications (assignment, invite, mention) if the user hasn't seen it within 10 minutes and has email notifications enabled (user setting)
- Notification preferences page: toggle per type for in-app and email
```

---

# PHASE 8 — Files & Notes

## Prompt 8.1 — File uploads

```
Implement attachments on tasks, events, and chat messages:

- S3 presigned-URL flow: POST /files/presign (fileName, size, mimeType, target) → client uploads directly to S3/MinIO → POST /files/confirm creates the Attachment row. Max 25MB, whitelist common types, virus-scan hook stub.
- GET downloads via short-lived presigned URLs; deletes restricted to uploader/admins
- Frontend: drag-and-drop zone + paste-from-clipboard in the task drawer and chat composer; image attachments render inline thumbnails with a lightbox; other files show type icon, name, size
- Files tab in task drawer listing all attachments including ones posted in chat
```

## Prompt 8.2 — Project notes

```
Implement Notes per project (Bordio's per-project notes tool):

- CRUD /projects/:id/notes; content is TipTap JSON supporting headings, lists, checkboxes, links, images (via the files module), code blocks, tables
- Notes tab in the project: left list of notes (reorderable), right editor with autosave (debounced 800ms, "Saved" indicator), created-by and updated-at metadata
- Realtime conflict safety: lock-free last-write-wins is NOT acceptable — broadcast note.updated to the project room and if another user has the note open, show "Updated by {name} — refresh" banner. (Full CRDT collaboration is out of scope for v1; note this as a future upgrade with Yjs.)
- Search across notes and tasks: GET /workspaces/:id/search?q= using Postgres full-text search (tsvector columns + GIN indexes) returning grouped results; global Cmd+K search palette on the frontend
```

---

# PHASE 9 — Google Calendar Sync

## Prompt 9.1 — Two-way Google Calendar integration

```
Implement Google Calendar sync:

- Settings → Integrations: "Connect Google Calendar" triggers incremental OAuth consent for calendar.events scope (we already have the Google identity from auth)
- Initial import: pull events from the user's primary calendar (past 1 week + future 8 weeks) into TeamBoard as personal events with googleEventId set
- Ongoing sync: register a Google push notification channel (webhook endpoint with channel validation) + fallback polling job every 15 min using syncTokens; handle 410 GONE by full re-sync
- Two-way: events created/updated/deleted in TeamBoard that the user owns push to Google via the Calendar API; loop prevention via googleEventId + updated-timestamp comparison
- Encrypt the stored Google refresh token at rest (AES-256-GCM with a key from env); handle token revocation gracefully (mark integration disconnected, notify user)
- Synced events show a small Google icon on their cards; deleting in TeamBoard asks "Also delete from Google Calendar?"

Write integration tests with mocked Google API responses covering: create both directions, update both directions, delete, sync token expiry.
```

---

# PHASE 10 — Design (by Claude)

Run these in Claude Code with **frontend-design focus**, or paste screenshots into claude.ai and iterate. Do Prompt 10.1 BEFORE building lots of UI if you want less rework — or run it as a restyle pass after Phase 4.

## Prompt 10.1 — Design system & tokens

```
Act as a senior product designer. Create a complete design system for TeamBoard, a calm, professional work management app (in the spirit of Bordio / Linear / Notion — light, airy, color used functionally, never decoratively).

Deliver as code, not mockups:
1. Design tokens as CSS variables in apps/web/src/styles/tokens.css:
   - Color: near-white app background (#F7F8FA range), white surfaces, one confident primary blue, a 12-color project/status palette (each with a 100-level tint for backgrounds and 600-level for text/dots), semantic success/warning/danger, 3 levels of grey text
   - Type scale: Inter; 13px base for dense data UI, sizes for xs/sm/base/lg/xl/2xl with line-heights
   - Spacing on a 4px grid, radii (6px controls, 10px cards, 14px modals), 3 elevation shadows (subtle — this is a flat-leaning UI)
   - Dark mode variant of every token
2. Update tailwind.config to consume these variables
3. Restyle the core primitives in src/components/ui (Button, Input, Select, Modal, Drawer, Dropdown, Avatar, Badge, Tooltip, Tabs, DatePicker) to use only tokens — sizes sm/md/lg, focus rings, disabled states
4. Document everything in a /app/design-system route that renders every primitive in every state, plus the full color palette — this is our living style guide

Rules: no gradients, no glassmorphism, 150ms ease-out transitions only on color/opacity/transform, generous whitespace, borders over shadows for separation.
```

## Prompt 10.2 — Signature view polish

```
Using the design system, do a detailed polish pass on the weekly calendar planner — this view must feel delightful:

- Day columns: 280px wide, day name + date in the header, today's column gets a primary-tinted header and a hairline outline
- TaskCard: white, 1px border, 10px radius, project color as a 3px left strip, 13px title (2-line clamp), bottom row = status dot + estimate chip + assignee avatar (20px). Hover: border darkens + tiny lift. Dragging: 3° tilt, soft shadow, drop placeholder as a dashed outline.
- Event cards: tinted background of the event color (100-level) with 600-level text, time range in tabular numbers
- Completed tasks: 55% opacity, strikethrough title, checkmark replaces the status dot
- Waiting list panel: slightly grey background to read as "off-calendar", section header with count
- Workload footer per day: tiny progress bar against the 8h capacity, hours label
- Empty states: friendly illustration-free copy ("Nothing planned — drag a task from the waiting list")
- Micro-interactions: completing a task plays a 200ms check animation; quick-add input expands smoothly
- Audit the whole view for spacing rhythm (multiples of 4) and text-color hierarchy; fix every inconsistency you find

Then take the same treatment to the Kanban and Table views for visual consistency.
```

## Prompt 10.3 — Marketing landing page

```
Design and build a public landing page (route /) for TeamBoard following the structure of high-converting SaaS pages:

Hero: headline "Work management platform for result-driven teams", subline about planning work, tracking progress and getting things done in one app, primary CTA "Try TeamBoard for free" + "No credit card required" microcopy, and a large product screenshot of the calendar planner in a browser frame.
Then: tabbed interactive preview (Calendar / Tasks / Kanban / Projects / Notes), alternating feature sections with screenshots (scheduling on specific days, waiting list, custom statuses, meetings with invites, Google Calendar sync, workload, time tracking, task chat, files, notes, team board), an industries strip (Marketing, Design, Development, Agencies, IT, Operations, HR, Legal, Sales), a final CTA band, and a clean footer.
Style: same design tokens, real screenshots captured from the app (use seeded demo data), fully responsive, light SEO meta tags. No fake testimonials or invented review scores.
```

---

# PHASE 11 — Hardening & Deployment

## Prompt 11.1 — Quality pass

```
Do a full quality pass on the codebase:
1. Security audit: verify every project-scoped endpoint enforces membership (write a test that a GUEST of project A cannot read project B), check rate limits, validate all file-upload paths, confirm refresh-token rotation revokes old tokens, scan for injection risks in the search feature
2. Add e2e tests (Playwright) for the critical flows: signup → create project → create task → drag to a day → complete it → see it greyed on that day; create event with external email → ICS arrives in Mailpit; start/stop timer; kanban drag updates a second browser via websocket
3. Performance: verify list virtualization, add DB query logging in dev and eliminate N+1s (use Prisma includes carefully), add indexes the query log suggests
4. Error handling: global exception filter returning consistent error shapes, frontend error boundaries + toast on mutation failures, retry/backoff on socket reconnect with state resync
5. Accessibility: keyboard operability of drag-and-drop (dnd-kit keyboard sensor), focus traps in modals/drawers, ARIA labels, color-contrast check on all tokens
Fix everything you find. Produce a SECURITY.md and TESTING.md summary.
```

## Prompt 11.2 — Deployment

```
Prepare production deployment:
- Multi-stage Dockerfiles for api and web (web served by nginx with gzip + caching headers + SPA fallback)
- docker-compose.prod.yml: api (2 replicas behind nginx), web, Postgres with volume + automated daily backup job, Redis with persistence, MinIO or S3 config
- GitHub Actions CI: lint → typecheck → test → build → docker push; deploy job over SSH (or write the fly.io/Render config if I choose managed hosting — ask me)
- Production env checklist: secrets, CORS origins, cookie domain, trust proxy, websocket sticky sessions (or Redis adapter confirmation), Sentry for both apps, healthchecks + restart policies
- Prisma migrate deploy step on release, with a documented rollback procedure
- Write DEPLOYMENT.md covering all of it
```

---

# Suggested build order & milestones

| Milestone | Phases | You can demo |
|---|---|---|
| M1 — Foundation | 0, 1, 2 | Sign up, create workspace/projects/folders, invite people |
| M2 — Tasks work | 3, 4.1 | The weekly planner with drag & drop + waiting list |
| M3 — Full views | 4.2, 4.3, 5 | Kanban, table, meetings with ICS invites, recurring items |
| M4 — Team power | 6, 7 | Workload, time tracking, analytics dashboard, chat, live updates, notifications |
| M5 — Complete | 8, 9 | Files, notes, search, Google Calendar sync |
| M6 — Ship | 10, 11 | Designed, tested, deployed |

# Tips for working with Claude Code on this project

Keep CLAUDE.md updated whenever you change a convention — it's read in every session. Work one prompt at a time and commit after each green build; if a phase is large, ask Claude Code to "plan first, then implement step by step." When something breaks, paste the exact error and say "fix this" rather than re-prompting the feature. For tricky phases (recurrence, Google sync, drag-and-drop), ask it to write the tests first. Use `/clear` between phases so the context stays focused, and use plan mode (Shift+Tab) before big phases to review the approach before any code is written.

One legal note: this builds a product *in the same category* as Bordio (task/project management concepts are not protectable), but don't copy their name, logo, marketing copy, screenshots, or pixel-level design. The prompts above describe original implementations of common patterns.
