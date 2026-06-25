import { describe, it, expect, beforeEach } from 'vitest';
import { http, HttpResponse } from 'msw';
import { Routes, Route } from 'react-router-dom';
import { render, screen } from '@/test/utils';
import { server } from '@/test/mocks/server';
import { useAuthStore } from '@/store/auth.store';
import { VerifyEmailPage } from './VerifyEmailPage';

function AppRoutes() {
  return (
    <Routes>
      <Route path="/auth/verify" element={<VerifyEmailPage />} />
      <Route path="/auth/signup" element={<div>Sign Up Page</div>} />
      <Route path="/app" element={<div>App Home</div>} />
    </Routes>
  );
}

beforeEach(() => useAuthStore.getState().clear());

describe('Verify-email flow', () => {
  it('correct code → stores token and redirects to /app', async () => {
    const { user } = render(<AppRoutes />, { route: '/auth/verify?email=alice@x.com' });

    expect(screen.getByText('alice@x.com')).toBeInTheDocument();
    const boxes = screen.getAllByRole('textbox') as HTMLInputElement[];
    for (const [i, d] of ['1', '2', '3', '4'].entries()) await user.type(boxes[i], d);

    expect(await screen.findByText('App Home')).toBeInTheDocument();
    expect(useAuthStore.getState().accessToken).toBe('test.access.token');
  });

  it('wrong code → shows an error and clears the boxes', async () => {
    server.use(
      http.post('*/api/auth/verify-email', () =>
        HttpResponse.json({ message: 'Invalid or expired code' }, { status: 422 }),
      ),
    );
    const { user } = render(<AppRoutes />, { route: '/auth/verify?email=alice@x.com' });

    const boxes = screen.getAllByRole('textbox') as HTMLInputElement[];
    for (const [i, d] of ['9', '9', '9', '9'].entries()) await user.type(boxes[i], d);

    expect(await screen.findByText(/invalid or expired code/i)).toBeInTheDocument();
    // Boxes were remounted (cleared) on error.
    const cleared = screen.getAllByRole('textbox') as HTMLInputElement[];
    expect(cleared.map((b) => b.value).join('')).toBe('');
    expect(screen.queryByText('App Home')).not.toBeInTheDocument();
  });

  it('redirects to signup when no email is provided', async () => {
    render(<AppRoutes />, { route: '/auth/verify' });
    expect(await screen.findByText('Sign Up Page')).toBeInTheDocument();
  });
});
