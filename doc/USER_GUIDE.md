# TeamBoard — User Guide

A Bordio-style work management platform: plan work on a weekly calendar, run tasks on Kanban/Table boards, schedule meetings, track time, chat, and keep notes — all per project, per workspace.

---

## Part 1 — Run it locally

### Prerequisites
- **Node.js 18+** (built/tested on 20–25)
- **pnpm 10** — `npm install -g pnpm`
- **Docker Desktop** (for Postgres, Redis, MinIO, Mailpit)

### First-time setup
```bash
# 1. Start infrastructure (Postgres, Redis, MinIO, Mailpit)
docker compose up -d

# 2. Install dependencies
pnpm install

# 3. Create your env file
cp .env.example .env

# 4. Set up the database (generate client, run migrations, load demo data)
pnpm db:generate
pnpm db:migrate
pnpm db:seed

# 5. Run both apps
pnpm dev
```

### What's now running
| URL | What |
|---|---|
| http://localhost:5173 | **Web app** (the UI you use) |
| http://localhost:3000/api | API |
| http://localhost:3000/api/docs | Swagger API reference |
| http://localhost:8025 | **Mailpit** — every email the app "sends" (invites, meeting ICS, reminders) lands here |
| http://localhost:9001 | MinIO console (file storage), login `minioadmin` / `minioadmin` |

### Log in with demo data
Open http://localhost:5173 → **Sign in**:

| Email | Password | Role |
|---|---|---|
| `alice@teamboard.local` | `password123` | Owner |
| `bob@teamboard.local` | `password123` | Admin |
| `carol@teamboard.local` | `password123` | Member |

The seed gives you the **Acme Studio** workspace with two projects (Website Redesign, Mobile App), ~25 tasks across this week + a waiting list, custom statuses, events, and notes.

> Prefer a clean start? Click **Sign up** to create a brand-new account — you get your own empty "My Workspace".

### Handy commands
| Command | Does |
|---|---|
| `pnpm dev` | Run web + API in watch mode |
| `pnpm db:studio` | Browse the database in Prisma Studio |
| `pnpm db:seed` | Reset to demo data |
| `pnpm build` / `pnpm lint` / `pnpm test` | Build / lint / test everything |

To stop: `Ctrl-C` the `pnpm dev` process, then `docker compose down` (add `-v` to wipe data).

---

## Part 2 — Using TeamBoard

### The layout
- **Left sidebar** — workspace switcher (top), then your projects (with color dots) and the global pages: **Team board, Workload, Reports, Settings**. The **+** next to "Projects" creates a project.
- **Top bar** — Cmd/Ctrl+K **search**, running **timer pill**, **theme** toggle (light/dark), **notification bell**.
- **Main area** — whatever you've opened.

### Workspaces, projects & people
- **Switch workspace** with the dropdown at the top of the sidebar.
- **New project** — sidebar **+** → name, pick a color, optional folder + description. Every new project starts with **New / In progress / Completed** statuses.
- **Invite people** — workspace Settings / project member management. Invites are emailed (check **Mailpit** at :8025) with an accept link.
- **Guests** are external collaborators scoped to a single project — they only ever see the project they were invited to.

### A project has four tabs
Open a project from the sidebar, then switch tabs (top-right): **Calendar · Kanban · Table · Notes**.

#### 📅 Calendar (the signature view)
- Seven day columns (Mon–Sun). Cards are tasks; tinted blocks at the top of a day are **events**.
- **Drag** a task between days, or to/from the **Waiting list** panel on the right (unscheduled backlog).
- Each day shows a **workload total** (sum of task estimates + event durations) — it turns amber over 8h, red over 10h.
- **Quick-add**: type in the "+ Add task" box at the bottom of any day (or the waiting list) and press Enter.
- **+ Event** (toolbar) schedules a meeting on the week.
- Toolbar filters: by assignee (avatars), by status, show/hide completed. Navigate weeks with ‹ › / **Today**.

#### 📋 Kanban
- Columns are the project's statuses. **Drag** cards between columns to change status; dropping into a **Completed** column completes the task (stamps the finish date).
- Quick-add per column. **Manage statuses** to add/rename/recolor/reorder or delete (with task migration).

#### 🗂️ Table
- Spreadsheet view. **Click a column header** to sort. **Edit inline** (title, status, assignee, date).
- **Group by** status / assignee / date. **Columns** menu hides/shows columns (remembered per browser).
- Select rows (checkboxes) for **bulk** status change or delete. Large lists are virtualized for speed.

#### 📝 Notes
- Rich-text notes per project (headings, lists, etc.). **Autosaves** (~0.8s after you stop typing; "Saved" indicator).
- If someone else edits the open note, you get an "Updated by someone else — refresh" banner.

### Working a task (the task drawer)
Click any task card to open the right-side drawer:
- Edit **title**, **status**, **assignee**, **date** (or "Waiting list"), **time estimate** (type `1h 30m`, `90m`, `45`).
- **Timer** — ▶ starts tracking; only one timer runs at a time (starting another stops the first). It also shows on the card and as the top-bar pill.
- **Files** — drag-drop, click, or paste from clipboard to upload. Images show thumbnails; click to open.
- **Chat** — message in real time; typing indicators; mentions notify people.
- **Recurring task** — deleting asks whether to remove just this one or all occurrences.

### Meetings (events)
- Create from the calendar's **+ Event**: title, date, start/end, **participants** (teammates + external emails as chips), reminder, color, optional **repeat**.
- Participants get an **ICS invite by email** (see Mailpit) and can **Accept/Decline** from the link. Open an event to see RSVP statuses.
- A reminder fires at the set time (creates a notification).

### Time, workload & reports
- **Timer pill** (top bar) shows the running task — click to jump to it, stop from anywhere. (Running 12h+ shows a "stop & keep" nudge.)
- **Workload** page — grid of members × days with hours vs capacity (cells tint when overloaded). Edit a member's daily capacity inline.
- **Reports** page — totals by user/project + filter by date; **Export CSV**.

### Team board
- **Team board** (sidebar) shows everyone's scheduled work for the week, one row per member, across all projects — a single place to see who's doing what.

### Realtime & notifications
- Changes other people make (drags, new tasks, chat) appear live without refresh.
- **Bell** (top bar) — assignments, mentions, event reminders, invites. Click one to mark it read and jump to its project. **Mark all read** clears the badge.
- **Notification preferences** (Settings) — toggle each type for in-app and email; master email switch. High-value emails (assignment, mention, invite) only send if you haven't seen the in-app one within 10 minutes.

### Search
- **Cmd/Ctrl+K** anywhere → search tasks and notes across the projects you can access. Click a result to jump to its project.

### Google Calendar (optional)
- **Settings → Integrations → Connect Google Calendar**. Needs `GOOGLE_CLIENT_ID/SECRET` configured in `.env`; otherwise it shows "Not configured".
- Once connected: your Google events import as personal events, and personal events you create here push back to Google (two-way). Synced events show a 📅 icon; deleting one asks whether to also remove it from Google.

### Theme
- Top-bar 🌙/☀️ toggles dark/light; your choice is remembered.

---

## Troubleshooting
| Symptom | Fix |
|---|---|
| `docker compose up` fails | Start Docker Desktop first. |
| API won't start / "port 3000 in use" | Kill a stale process: `lsof -ti:3000 \| xargs kill -9`. |
| "Environment variable not found: DATABASE_URL" | Ensure `.env` exists at repo root (`cp .env.example .env`). |
| No data after login | Run `pnpm db:seed`. |
| Emails/invites "not arriving" | They go to **Mailpit** → http://localhost:8025, not a real inbox. |
| Uploaded file won't open | Check MinIO is up (`docker compose ps`) and the `teamboard` bucket exists (auto-created on start). |
| Connect Google Calendar disabled | Set `GOOGLE_CLIENT_ID/SECRET` + `GOOGLE_CALLBACK_URL` in `.env`, restart API. |

For deployment to production, see [DEPLOYMENT.md](DEPLOYMENT.md). For architecture/conventions, see [CLAUDE.md](../CLAUDE.md).
