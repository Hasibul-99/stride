import { describe, it, expect } from 'vitest';
import { axe } from 'vitest-axe';
import { render, screen } from '@/test/utils';
import { makeTask } from '@/test/factories';
import { WorkloadFooter } from './WorkloadFooter';

describe('WorkloadFooter', () => {
  it('renders the combined task + event total', () => {
    render(
      <WorkloadFooter
        tasks={[makeTask({ timeEstimateMinutes: 60 }), makeTask({ timeEstimateMinutes: 30 })]}
        events={[{ startAt: '2026-06-15T10:00:00Z', endAt: '2026-06-15T11:00:00Z' }]}
      />,
    );
    expect(screen.getByText('2h 30m')).toBeInTheDocument(); // 60+30+60
  });

  it('renders nothing when there is no load', () => {
    const { container } = render(<WorkloadFooter tasks={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('uses the normal tier at or under 8h', () => {
    render(<WorkloadFooter tasks={[makeTask({ timeEstimateMinutes: 480 })]} />);
    expect(screen.getByText('8h')).toHaveAttribute('data-tier', 'normal');
  });

  it('uses the amber tier over 8h', () => {
    render(<WorkloadFooter tasks={[makeTask({ timeEstimateMinutes: 540 })]} />);
    expect(screen.getByText('9h')).toHaveAttribute('data-tier', 'amber');
  });

  it('uses the red tier over 10h', () => {
    render(<WorkloadFooter tasks={[makeTask({ timeEstimateMinutes: 660 })]} />);
    expect(screen.getByText('11h')).toHaveAttribute('data-tier', 'red');
  });

  it('has no a11y violations', async () => {
    const { container } = render(<WorkloadFooter tasks={[makeTask({ timeEstimateMinutes: 90 })]} />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
