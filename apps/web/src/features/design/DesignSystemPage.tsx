import { PROJECT_COLORS } from '@teamboard/shared';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { Avatar } from '@/components/ui/Avatar';
import { COLOR_HEX } from '@/features/workspaces/colors';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-10">
      <h2 className="mb-3 text-lg font-semibold">{title}</h2>
      <div className="flex flex-wrap items-center gap-3 rounded-card border border-border bg-surface p-4">
        {children}
      </div>
    </section>
  );
}

export function DesignSystemPage() {
  return (
    <div className="max-w-3xl">
      <h1 className="mb-1 text-2xl font-semibold">Design system</h1>
      <p className="mb-8 text-muted">Living style guide — every primitive, every state.</p>

      <Section title="Buttons">
        <Button variant="primary">Primary</Button>
        <Button variant="secondary">Secondary</Button>
        <Button variant="ghost">Ghost</Button>
        <Button variant="danger">Danger</Button>
        <Button disabled>Disabled</Button>
        <Button size="sm">Small</Button>
        <Button size="lg">Large</Button>
      </Section>

      <Section title="Inputs">
        <Input placeholder="Text input" className="max-w-xs" />
        <Input placeholder="Disabled" disabled className="max-w-xs" />
      </Section>

      <Section title="Badges">
        <Badge>Neutral</Badge>
        <Badge tone="primary">Primary</Badge>
        <Badge tone="success">Success</Badge>
        <Badge tone="warning">Warning</Badge>
        <Badge tone="danger">Danger</Badge>
      </Section>

      <Section title="Avatars">
        <Avatar name="Alice Chen" />
        <Avatar name="Bob Martins" size={28} />
        <Avatar name="Carol Diaz" size={40} />
      </Section>

      <Section title="Elevation">
        <div className="rounded-card bg-surface p-4 shadow-sm">shadow-sm</div>
        <div className="rounded-card bg-surface p-4 shadow-md">shadow-md</div>
        <div className="rounded-card bg-surface p-4 shadow-lg">shadow-lg</div>
      </Section>

      <Section title="Project / status palette">
        {PROJECT_COLORS.map((c) => (
          <div key={c} className="flex flex-col items-center gap-1">
            <span className="h-8 w-8 rounded-full" style={{ background: COLOR_HEX[c] }} />
            <span className="text-xs text-muted">{c}</span>
          </div>
        ))}
      </Section>

      <Section title="Semantic surfaces">
        <span className="rounded-control bg-primary-tint px-3 py-1.5 text-primary">primary</span>
        <span className="rounded-control bg-success-tint px-3 py-1.5 text-success">success</span>
        <span className="rounded-control bg-warning-tint px-3 py-1.5 text-warning">warning</span>
        <span className="rounded-control bg-danger-tint px-3 py-1.5 text-danger">danger</span>
      </Section>
    </div>
  );
}
