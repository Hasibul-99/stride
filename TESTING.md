# Testing

TeamBoard follows a **test pyramid**: many fast unit tests, fewer integration
tests, a thin layer of end-to-end browser tests.

```
        ╱╲          E2E (Playwright)        — real browser, real stack, real DB
       ╱──╲                                   critical user journeys only
      ╱    ╲       Integration (Vitest+MSW)  — components + hooks + query cache,
     ╱──────╲                                  network mocked at HTTP boundary
    ╱        ╲     Unit (Vitest / Jest)       — pure logic: dates, positions,
   ╱──────────╲                                 recurrence, durations, crypto
```

Rule of thumb: push a test **as low as it will go**. A date/position/recurrence
bug belongs in a unit test (millisecond feedback), not a browser test. Reserve
E2E for flows that only break when the real pieces are wired together (auth +
websockets + drag + persistence).

| Layer | Runner | Where | Network | Speed |
|-------|--------|-------|---------|-------|
| Unit | Vitest (web) / Jest (api) | `*.test.ts` next to source | n/a (pure) | ms |
| Integration | Vitest + MSW | `*.integration.test.tsx` | MSW mocks `/api` | tens of ms |
| E2E | Playwright | `apps/web/tests-e2e/*.spec.ts` | real API + DB | seconds |

---

## Running each layer locally

### Web unit + integration (Vitest)
```bash
pnpm --filter @teamboard/web test            # run once
pnpm --filter @teamboard/web test:watch      # watch mode
pnpm --filter @teamboard/web test:coverage   # with coverage + thresholds
```
Run a single file or test:
```bash
pnpm --filter @teamboard/web test src/features/calendar/week.test.ts
pnpm --filter @teamboard/web test -t "weekStart snaps to Monday"
```

> Node 25 exposes a `localStorage` global the test envs trip on; the `test*`
> scripts set `NODE_OPTIONS=--localstorage-file=/tmp/tb-web-ls` to work around it.

### API unit + e2e (Jest + supertest)
Needs Postgres + Redis (from `docker compose up -d`).
```bash
pnpm --filter @teamboard/api test            # unit
pnpm --filter @teamboard/api test:e2e        # integration (real Postgres/Redis)
```

### E2E (Playwright)
Needs the **full stack** up and the DB seeded. Playwright's `globalSetup`
reseeds automatically; you just need the services + browsers.
```bash
docker compose up -d                                   # postgres/redis/minio/mailpit
pnpm --filter @teamboard/web exec playwright install chromium webkit
pnpm dev                                                # API :3000 + web :5173 (leave running)
# in a second shell:
pnpm --filter @teamboard/web test:e2e                  # all specs, both browsers
pnpm --filter @teamboard/web test:e2e:ui               # interactive UI mode (best for authoring)
pnpm --filter @teamboard/web exec playwright test tests-e2e/kanban.spec.ts   # one spec
pnpm --filter @teamboard/web exec playwright test --shard=1/3                # one shard
```
Locally `webServer.reuseExistingServer` is on, so it attaches to the `pnpm dev`
you already have running instead of booting its own.

---

## Coverage thresholds

Configured in [apps/web/vitest.config.ts](apps/web/vitest.config.ts). They are a
**no-regression floor**, not a target — ratchet them up as tests land.

- Global: **lines/statements ≥ 48 · branches ≥ 70 · functions ≥ 45**.
- Pure-logic utils held to **90** per-file (`positions.ts`, `calendar/drop.ts`,
  `calendar/week.ts`, `kanban/drop.ts`, `lib/utils.ts`).
- Excluded from the gate (covered by the E2E layer, not unit): route shells
  (`router.tsx`, `app/**`), pages (`*Page.tsx`), thin data hooks (`**/api.ts`),
  marketing/design-system screens, `lib/socket.ts`, plus test files and config.

The HTML report lands in `apps/web/coverage/index.html` after `test:coverage`.

---

## Writing a test with MSW + factories

The plumbing lives in [apps/web/src/test/](apps/web/src/test/):

- **`factories.ts`** — `makeUser/makeProject/makeStatus/makeTask/makeEvent`.
  Each returns a valid, API-shaped object; pass a partial to override. Never
  hand-roll shapes in a test.
- **`mocks/handlers.ts`** — default MSW handlers for `/api/*`. Request bodies are
  validated against the shared zod schemas; responses are built from factories.
- **`mocks/server.ts`** + **`setup.ts`** — MSW server wired into Vitest. Any
  request **without a handler errors the test** (`onUnhandledRequest: 'error'`),
  so tests stay honest. Handlers reset after every test.
- **`utils.tsx`** — `render()` (aliased `renderWithProviders`) wraps the UI in a
  fresh `QueryClient` (retries off) + `MemoryRouter`, and returns a
  `userEvent` instance.

A typical integration test:

```tsx
import { http, HttpResponse } from 'msw';
import { server } from '@/test/mocks/server';
import { render, screen } from '@/test/utils';
import { makeTask } from '@/test/factories';
import { TaskCard } from './TaskCard';

it('renders the task title and reacts to a status change', async () => {
  const task = makeTask({ title: 'Ship the thing', statusId: 'status_new' });

  // Override a default handler for THIS test only (auto-reset afterEach).
  server.use(
    http.patch('*/api/tasks/:id', async ({ request }) => {
      const body = await request.json();
      return HttpResponse.json({ ...task, ...body });   // echo the PATCH
    }),
  );

  const { user } = render(<TaskCard task={task} />);
  expect(screen.getByText('Ship the thing')).toBeInTheDocument();

  await user.click(screen.getByRole('button', { name: /status/i }));
  // ...assert optimistic update / settled state
});
```

Guidelines:
- Override handlers with `server.use(...)` inside the test to assert payloads or
  force error paths (e.g. return `status: 500`); the default handlers cover the
  happy path so most tests need no override.
- a11y matchers are available — `expect(await axe(container)).toHaveNoViolations()`
  (`vitest-axe`, registered in `setup.ts`).
- Date-sensitive tests run in `America/New_York` (`vitest.config.ts` `env.TZ`);
  freeze the clock with `freezeTime(iso)` from `@/test/time`.

---

## The `dragTo` helper (drag-and-drop)

dnd-kit needs real pointer movement, so there are two helpers depending on layer.

**E2E (real pointer)** — [tests-e2e/helpers.ts](apps/web/tests-e2e/helpers.ts):
```ts
import { dragTo } from './helpers';
await dragTo(page, page.getByText('My task'), page.getByTestId('day-2026-06-18'));
```
`dragTo` presses on the source centre, nudges 8px to cross dnd-kit's 5px
activation distance, then travels to the target in stepped `mouse.move`s
(emitting the intermediate `pointermove` events dnd-kit needs) before releasing.
Pass **Locators**, not selectors, so Playwright auto-waits.

**Unit/integration (jsdom, no layout)** — [src/test/dnd.ts](apps/web/src/test/dnd.ts):
jsdom has no layout engine, so use `installDndRects({...})` to feed
`getBoundingClientRect` per draggable/droppable id, then drive a **keyboard**
drag with `keyboardDrag(user, handle, ['{ArrowDown}'])`. See
`SortableBoard.dnd.test.tsx` for a worked example.

---

## Debugging a Playwright failure from the trace

CI uploads a **`playwright-report-shard-N`** artifact on failure containing the
HTML report and `test-results/` (traces, screenshots, videos). To investigate:

1. Download the artifact from the failed GitHub Actions run and unzip it.
2. Open the trace in the viewer:
   ```bash
   pnpm --filter @teamboard/web exec playwright show-trace path/to/trace.zip
   ```
   (or `playwright show-report apps/web/playwright-report` for the full report).
3. The trace gives you a **time-travel** view: each action with before/after DOM
   snapshots, the network log, console output, and the exact locator that failed.
   Scrub the timeline to the red step; the "Before/After" snapshots show what the
   page actually looked like when the assertion ran.

Locally, the fastest loops are:
```bash
pnpm --filter @teamboard/web test:e2e:ui                 # UI mode: watch, pick, time-travel
pnpm --filter @teamboard/web exec playwright test --debug # step with the inspector
pnpm --filter @teamboard/web exec playwright test --trace on  # force-record a trace
```
Traces are captured `on-first-retry` (config), so a flake that passes on retry
still leaves a trace to inspect. Retries are `2` in CI, `0` locally.

---

## Accessibility tests

a11y is checked at **two** layers; both fail the build on a real violation.

- **Component (vitest-axe)** — [src/test/a11y.test.tsx](apps/web/src/test/a11y.test.tsx)
  runs `axe` over every design-system primitive plus the task drawer, the
  create-project / event / status modals, the kanban board and the calendar in
  their default states, asserting `toHaveNoViolations()`. Clock + timezone are
  frozen so contrast/timestamp checks are stable. Fast (jsdom, no browser).
- **E2E (@axe-core/playwright)** — [tests-e2e/a11y.spec.ts](apps/web/tests-e2e/a11y.spec.ts)
  (tag `@a11y`) scans the **real** rendered pages — signin, planner, kanban,
  table, analytics — with the WCAG 2.0/2.1 A+AA rule sets and fails on any
  violation of **serious/critical** impact.
  ```bash
  pnpm --filter @teamboard/web test:e2e:a11y
  ```
- **Keyboard navigation (E2E)** — [tests-e2e/keyboard.spec.ts](apps/web/tests-e2e/keyboard.spec.ts)
  (tag `@keyboard`) asserts the task-drawer tab order is logical, modal focus is
  trapped and **returns to the trigger** on close, and the dnd-kit **keyboard
  drag** path reorders the list end to end.
  ```bash
  pnpm --filter @teamboard/web test:e2e:keyboard
  ```

Dialog semantics (focus-in on open, Tab/Shift+Tab trap, Escape-to-close, focus
restore) come from the shared [`useFocusTrap`](apps/web/src/lib/useFocusTrap.ts)
hook — attach its ref to a `role="dialog" aria-modal tabIndex={-1}` element.
> Don't put `autoFocus` on a control inside a trapped dialog: it steals focus
> before the hook captures the trigger, breaking focus restore on close.

---

## Updating visual snapshots

Visual-regression baselines live in
[tests-e2e/visual.spec.ts-snapshots/](apps/web/tests-e2e/visual.spec.ts-snapshots/)
and cover the empty planner, the seeded planner, kanban, table, the task drawer
and the analytics overview — each at **desktop (1280×800)** and **mobile
(390×844)** widths. The spec (tag `@visual`, chromium only) keeps them
**deterministic**:

- **Timezone pinned** to `America/New_York` and the **clock frozen** to a fixed
  Monday (`2026-06-15`) via `page.clock`, so the week header, day numbers and the
  "today" column highlight never move.
- **Data is built per run via the API** with date strings tied to the frozen
  week (a fresh signup each run). The shared db seed is real-"now"-relative, so
  its scheduled dates/timestamps would drift daily — never snapshot against it.
  The fresh account also gives a clean (empty) analytics page.
- **Live timers are masked** (`mask:` the play/stop buttons); no time entries or
  chat are created, so no relative timestamps render.

Regenerate baselines intentionally after a deliberate UI change:
```bash
pnpm --filter @teamboard/web test:e2e:visual:update          # all visual baselines
pnpm --filter @teamboard/web exec playwright test --project=chromium \
  visual.spec.ts -g "task drawer" --update-snapshots         # just one
```
Then run without the flag to confirm they're stable, **review the changed PNGs**
in the diff, and **commit them** — they are the reviewed source of truth:
```bash
pnpm --filter @teamboard/web test:e2e:visual
```
- A failing screenshot test writes `*-actual.png` / `*-diff.png` into the report
  artifact so you can see what moved before deciding to update.
- Baselines are keyed by **browser+OS** (`*-chromium-darwin.png`). The committed
  set is generated on macOS; regenerate on the CI OS (Linux / the Playwright
  Docker image) before relying on them in CI — fonts/rendering differ across
  platforms and will false-fail otherwise.

---

## CI layout

[.github/workflows/ci.yml](.github/workflows/ci.yml):

- **`fast`** — every PR + push: lint → typecheck → web unit (vitest+coverage) →
  api unit/e2e → build. Uploads the coverage report. **Mark this job as the
  required status check** in branch protection.
- **`e2e`** — PRs targeting `main`, pushes to `main`, and nightly (`cron 0 3`):
  boots docker-compose (postgres/redis/minio/mailpit), migrates + seeds, starts
  the API, runs Playwright **sharded 3×** (chromium + webkit). Uploads the HTML
  report + traces per shard **on failure**. `@visual` is **excluded** here
  (`--grep-invert "@visual"`) — its baselines are darwin-only; commit Linux
  baselines first (see *Updating visual snapshots*) to enable them in CI.
- **`docker`** — `main` only: builds the API + web images.

---

## API test inventory

### Unit (Jest)
- `crypto.util.spec.ts` — AES-256-GCM round-trip, random IV, wrong-key + malformed rejection (4).
- `recurrence.generator.spec.ts` — daily/weekly-multiday/monthly, interval>1, until/count, horizon (6).
- `integrations/google-calendar.service.spec.ts` — mocked googleapis: import + sync token, cancel→soft-delete, push insert (+id store), push delete, **410 GONE → full re-sync** (5).

**15 unit tests pass.**

### E2E (supertest, real Postgres/Redis)
- `auth.e2e-spec.ts` — signup (+ personal workspace), dup→409, weak pw→400, signin ok/401, protected 401/200, **refresh rotation revokes old token**, logout revoke (9).
- `security.e2e-spec.ts` — **guest isolation**: guest reads invited project (200) but gets 403 on a sibling project, its tasks, and workspace members; presign rejects disallowed MIME (5).

**14 e2e tests pass.**

## Web E2E inventory (Playwright)
`apps/web/tests-e2e/` — onboarding, kanban quick-add + drag, task lifecycle,
meetings + ICS, time tracking, search, and realtime (two-browser websocket)
flows, plus three quality layers: **`a11y.spec.ts`** (axe scans, serious/critical),
**`keyboard.spec.ts`** (drawer tab order, modal focus trap + restore, dnd-kit
keyboard drag) and **`visual.spec.ts`** (deterministic desktop/mobile snapshots).
Fixtures mint a fresh authenticated session per test via the API (`fixtures.ts`)
because refresh-token rotation makes a shared `storageState` single-use; the
visual spec signs up its own throwaway account so its data is fully controlled.
