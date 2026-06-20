import { describe, it, expect, beforeEach } from 'vitest';
import { http, HttpResponse } from 'msw';
import { Routes, Route } from 'react-router-dom';
import { render, screen } from '@/test/utils';
import { server } from '@/test/mocks/server';
import { makeUser } from '@/test/factories';
import { useAuthStore } from '@/store/auth.store';
import { SignInPage } from './SignInPage';

function AppRoutes() {
  return (
    <Routes>
      <Route path="/auth/signin" element={<SignInPage />} />
      <Route path="/app" element={<div>App Home</div>} />
    </Routes>
  );
}

beforeEach(() => useAuthStore.getState().clear());

describe('Sign-in flow', () => {
  it('valid credentials → stores token and redirects to /app', async () => {
    server.use(
      http.post('*/api/auth/signin', () =>
        HttpResponse.json({ accessToken: 'tok-123', user: makeUser({ email: 'alice@x.com' }) }),
      ),
    );
    const { user } = render(<AppRoutes />, { route: '/auth/signin' });

    await user.type(screen.getByPlaceholderText('Email'), 'alice@x.com');
    await user.type(screen.getByPlaceholderText('Password'), 'password123');
    await user.click(screen.getByRole('button', { name: /^sign in$/i }));

    expect(await screen.findByText('App Home')).toBeInTheDocument();
    expect(useAuthStore.getState().accessToken).toBe('tok-123');
  });

  it('invalid credentials → shows an error and stays on the page', async () => {
    server.use(
      http.post('*/api/auth/signin', () => HttpResponse.json({ message: 'bad' }, { status: 401 })),
    );
    const { user } = render(<AppRoutes />, { route: '/auth/signin' });

    await user.type(screen.getByPlaceholderText('Email'), 'alice@x.com');
    await user.type(screen.getByPlaceholderText('Password'), 'wrong');
    await user.click(screen.getByRole('button', { name: /^sign in$/i }));

    expect(await screen.findByText(/invalid email or password/i)).toBeInTheDocument();
    expect(screen.queryByText('App Home')).not.toBeInTheDocument();
    expect(useAuthStore.getState().accessToken).toBeNull();
  });
});
