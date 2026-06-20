import { describe, it, expect } from 'vitest';
import { render, screen } from './utils';
import { api } from '@/lib/api';
import { makeTask, makeUser } from './factories';
import { freezeTime, pinTimezone } from './time';
import { SignInPage } from '@/features/auth/SignInPage';

describe('test infra smoke', () => {
  it('renders a component through the provider wrapper (RTL layer)', () => {
    render(<SignInPage />);
    expect(screen.getByRole('heading', { name: /sign in to teamboard/i })).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Email')).toBeInTheDocument();
  });

  it('intercepts API calls with MSW', async () => {
    const { data } = await api.get('/workspaces');
    expect(data[0].name).toBe('Acme Studio');
  });

  it('builds valid objects from factories with overrides', () => {
    const task = makeTask({ title: 'Custom' });
    expect(task.title).toBe('Custom');
    expect(task.statusId).toBeTruthy();
    expect(makeUser().timezone).toBe('America/New_York');
  });

  it('freezes time deterministically', () => {
    const restore = freezeTime('2026-06-15T12:00:00.000Z');
    expect(new Date().toISOString()).toBe('2026-06-15T12:00:00.000Z');
    restore();
  });

  it('pins the timezone', () => {
    const restore = pinTimezone('America/New_York');
    expect(process.env.TZ).toBe('America/New_York');
    restore();
  });
});
