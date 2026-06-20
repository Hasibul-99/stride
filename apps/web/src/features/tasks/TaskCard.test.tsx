import { describe, it, expect, vi } from 'vitest';
import { axe } from 'vitest-axe';
import { render, screen } from '@/test/utils';
import { makeTask, makeStatus } from '@/test/factories';
import { TaskCard } from './TaskCard';
import type { ProjectMember } from './api';

const status = makeStatus({ name: 'In progress', color: 'blue' });
const assignee: ProjectMember = {
  id: 'pm_1',
  role: 'MEMBER',
  user: { id: 'u_1', name: 'Alice Chen', email: 'a@x.com', avatarUrl: null },
};

describe('TaskCard', () => {
  it('shows title, estimate chip, status dot, and assignee avatar', () => {
    render(
      <TaskCard
        task={makeTask({ title: 'Wireframe homepage', timeEstimateMinutes: 90, statusId: status.id })}
        status={status}
        assignee={assignee}
        projectColor="violet"
      />,
    );
    expect(screen.getByRole('button', { name: 'Wireframe homepage' })).toBeInTheDocument();
    expect(screen.getByText('1h 30m')).toBeInTheDocument();
    expect(screen.getByTitle('In progress')).toBeInTheDocument(); // status dot
    expect(screen.getByTitle('Alice Chen')).toBeInTheDocument(); // avatar initials
  });

  it('renders a completed task greyed with a strikethrough title and a check', () => {
    render(
      <TaskCard
        task={makeTask({ title: 'Done thing', completedAt: '2026-06-15T16:00:00Z' })}
        status={status}
        projectColor="green"
      />,
    );
    const title = screen.getByRole('button', { name: 'Done thing' });
    expect(title.className).toContain('line-through');
    expect(screen.getByLabelText('Completed')).toBeInTheDocument();
    // No timer control on completed cards.
    expect(screen.queryByTitle('Start timer')).not.toBeInTheDocument();
  });

  it('fires the open handler on click', async () => {
    const onClick = vi.fn();
    const { user } = render(
      <TaskCard task={makeTask({ title: 'Open me' })} status={status} projectColor="blue" onClick={onClick} />,
    );
    await user.click(screen.getByRole('button', { name: 'Open me' }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('has no a11y violations', async () => {
    const { container } = render(
      <TaskCard
        task={makeTask({ title: 'Accessible card', completedAt: '2026-06-15T16:00:00Z' })}
        status={status}
        assignee={assignee}
        projectColor="blue"
      />,
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
