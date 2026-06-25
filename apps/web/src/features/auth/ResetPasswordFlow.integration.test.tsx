import { describe, it, expect } from 'vitest';
import { Routes, Route } from 'react-router-dom';
import { render, screen } from '@/test/utils';
import { ForgotPasswordPage } from './ForgotPasswordPage';
import { ResetPasswordPage } from './ResetPasswordPage';

function AppRoutes() {
  return (
    <Routes>
      <Route path="/auth/forgot" element={<ForgotPasswordPage />} />
      <Route path="/auth/reset" element={<ResetPasswordPage />} />
      <Route path="/auth/signin" element={<div>Sign In Page</div>} />
    </Routes>
  );
}

describe('Forgot → reset flow', () => {
  it('requests a code, then resets the password and returns to sign in', async () => {
    const { user } = render(<AppRoutes />, { route: '/auth/forgot' });

    await user.type(screen.getByPlaceholderText('Email'), 'alice@x.com');
    await user.click(screen.getByRole('button', { name: /send reset code/i }));

    // Lands on the reset screen, carrying the email.
    expect(await screen.findByText('alice@x.com')).toBeInTheDocument();

    const boxes = screen.getAllByRole('textbox') as HTMLInputElement[];
    for (const [i, d] of ['1', '2', '3', '4'].entries()) await user.type(boxes[i], d);
    await user.type(screen.getByPlaceholderText(/^New password/i),'newpassword456');
    await user.type(screen.getByPlaceholderText(/Confirm/i), 'newpassword456');
    await user.click(screen.getByRole('button', { name: /update password/i }));

    expect(await screen.findByText('Sign In Page')).toBeInTheDocument();
  });

  it('mismatched passwords block submission', async () => {
    const { user } = render(<AppRoutes />, { route: '/auth/reset?email=alice@x.com' });

    const boxes = screen.getAllByRole('textbox') as HTMLInputElement[];
    for (const [i, d] of ['1', '2', '3', '4'].entries()) await user.type(boxes[i], d);
    await user.type(screen.getByPlaceholderText(/^New password/i),'newpassword456');
    await user.type(screen.getByPlaceholderText(/Confirm/i), 'different789');

    expect(screen.getByRole('button', { name: /update password/i })).toBeDisabled();
  });
});
