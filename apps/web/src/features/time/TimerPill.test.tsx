import { describe, it, expect, afterEach, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import { render, screen, act } from '@/test/utils';
import { server } from '@/test/mocks/server';
import { freezeTime } from '@/test/time';
import { TimerPill } from './TimerPill';

const NOW = '2026-06-15T12:00:00.000Z';

function runningSince(secondsAgo: number) {
  const startedAt = new Date(Date.parse(NOW) - secondsAgo * 1000).toISOString();
  return {
    id: 'te_1',
    taskId: 'task_running',
    userId: 'u_1',
    startedAt,
    stoppedAt: null,
    durationSeconds: null,
    task: { id: 'task_running', title: 'Build the thing', projectId: 'proj_1' },
  };
}

let restore: (() => void) | undefined;
afterEach(() => restore?.());

describe('TimerPill', () => {
  it('shows the running task with live elapsed time that ticks', async () => {
    restore = freezeTime(NOW);
    server.use(http.get('*/api/time/running', () => HttpResponse.json(runningSince(90))));

    render(<TimerPill />);
    // Flush the react-query fetch under fake timers.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(screen.getByText('Build the thing')).toBeInTheDocument();
    expect(screen.getByText('1:30')).toBeInTheDocument(); // 90s elapsed

    // Advance 5s of wall-clock; the 1s interval re-renders the elapsed counter.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });
    expect(screen.getByText('1:35')).toBeInTheDocument();
  });

  it('renders nothing when no timer is running', async () => {
    server.use(http.get('*/api/time/running', () => HttpResponse.json(null)));
    const { container } = render(<TimerPill />);
    await act(async () => {}); // flush the query
    expect(container).toBeEmptyDOMElement();
  });
});
