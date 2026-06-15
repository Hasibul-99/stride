import { createBrowserRouter, Navigate } from 'react-router-dom';
import { SignInPage } from '@/features/auth/SignInPage';
import { SignUpPage } from '@/features/auth/SignUpPage';
import { AuthCallbackPage } from '@/features/auth/AuthCallbackPage';
import { RequireAuth } from '@/features/auth/RequireAuth';
import { AppLayout } from '@/app/AppLayout';
import { HomePage } from '@/app/HomePage';
import { ProjectPage } from '@/features/projects/ProjectPage';
import { TeamPlannerPage } from '@/features/calendar/TeamPlannerPage';

export const router = createBrowserRouter([
  { path: '/', element: <Navigate to="/app" replace /> },
  { path: '/auth/signin', element: <SignInPage /> },
  { path: '/auth/signup', element: <SignUpPage /> },
  { path: '/auth/callback', element: <AuthCallbackPage /> },
  {
    path: '/app',
    element: (
      <RequireAuth>
        <AppLayout />
      </RequireAuth>
    ),
    children: [
      { index: true, element: <HomePage /> },
      { path: 'team', element: <TeamPlannerPage /> },
      { path: 'projects/:id', element: <ProjectPage /> },
    ],
  },
]);
