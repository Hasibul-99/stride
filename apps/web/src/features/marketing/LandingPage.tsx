import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/Button';

const FEATURES = [
  ['Weekly calendar planner', 'Plan work on the days it happens — drag tasks across the week.'],
  ['Waiting list', 'Park unscheduled work in a backlog and pull it onto a day when ready.'],
  ['Custom statuses', 'Model your workflow with unlimited statuses and a Kanban board.'],
  ['Meetings with invites', 'Schedule events, email ICS invites, collect RSVPs.'],
  ['Google Calendar sync', 'Two-way sync keeps your personal calendar in lockstep.'],
  ['Workload & time tracking', 'See each member’s load and track time per task.'],
  ['Task chat & files', 'Discuss in-context and attach files right on the task.'],
  ['Notes & search', 'Rich per-project notes and instant Cmd+K search.'],
];

const INDUSTRIES = [
  'Marketing', 'Design', 'Development', 'Agencies', 'IT', 'Operations', 'HR', 'Legal', 'Sales',
];

export function LandingPage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <div className="text-lg font-semibold">TeamBoard</div>
        <nav className="flex items-center gap-3">
          <Link to="/auth/signin" className="text-base text-foreground-2 hover:text-foreground">
            Sign in
          </Link>
          <Link to="/auth/signup">
            <Button size="sm">Get started</Button>
          </Link>
        </nav>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-3xl px-6 pb-10 pt-16 text-center">
        <h1 className="text-[40px] font-semibold leading-tight tracking-tight">
          Work management platform for result-driven teams
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-lg text-foreground-2">
          Plan work, track progress and get things done — all in one app. Calendar planning, boards,
          time tracking and team workload, together.
        </p>
        <div className="mt-7 flex items-center justify-center gap-3">
          <Link to="/auth/signup">
            <Button size="lg">Try TeamBoard for free</Button>
          </Link>
          <span className="text-sm text-muted">No credit card required</span>
        </div>

        {/* Product frame */}
        <div className="mx-auto mt-12 max-w-5xl overflow-hidden rounded-modal border border-border bg-surface shadow-lg">
          <div className="flex items-center gap-1.5 border-b border-border px-4 py-2.5">
            <span className="h-3 w-3 rounded-full bg-danger/60" />
            <span className="h-3 w-3 rounded-full bg-warning/60" />
            <span className="h-3 w-3 rounded-full bg-success/60" />
          </div>
          <div className="grid grid-cols-7 gap-2 p-4">
            {Array.from({ length: 7 }).map((_, i) => (
              <div key={i} className="space-y-2">
                <div className="text-xs font-medium text-muted">Day {i + 1}</div>
                {Array.from({ length: (i % 3) + 1 }).map((__, j) => (
                  <div key={j} className="rounded-card border border-border bg-surface p-2 text-left shadow-sm">
                    <div className="mb-1 h-1.5 w-3/4 rounded bg-surface-2" />
                    <div className="h-1.5 w-1/2 rounded bg-surface-2" />
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="mx-auto max-w-5xl px-6 py-16">
        <div className="grid gap-x-10 gap-y-8 sm:grid-cols-2">
          {FEATURES.map(([title, body]) => (
            <div key={title}>
              <h3 className="text-lg font-medium">{title}</h3>
              <p className="mt-1 text-foreground-2">{body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Industries */}
      <section className="border-y border-border bg-surface py-10">
        <div className="mx-auto flex max-w-4xl flex-wrap justify-center gap-x-6 gap-y-2 px-6 text-foreground-2">
          {INDUSTRIES.map((i) => (
            <span key={i} className="text-base">{i}</span>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-3xl px-6 py-20 text-center">
        <h2 className="text-2xl font-semibold">Get your team on the same page</h2>
        <p className="mt-2 text-foreground-2">Start planning in minutes.</p>
        <div className="mt-6">
          <Link to="/auth/signup">
            <Button size="lg">Try TeamBoard for free</Button>
          </Link>
        </div>
      </section>

      <footer className="border-t border-border py-8 text-center text-sm text-muted">
        © {new Date().getFullYear()} TeamBoard
      </footer>
    </div>
  );
}
