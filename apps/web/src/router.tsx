import { createBrowserRouter, Navigate } from 'react-router-dom';
import { SignInPage } from '@/features/auth/SignInPage';
import { SignUpPage } from '@/features/auth/SignUpPage';
import { AuthCallbackPage } from '@/features/auth/AuthCallbackPage';
import { RequireAuth } from '@/features/auth/RequireAuth';
import { AppLayout } from '@/app/AppLayout';
import { HomePage } from '@/app/HomePage';
import { ProjectPage } from '@/features/projects/ProjectPage';
import { TeamPlannerPage } from '@/features/calendar/TeamPlannerPage';
import { RsvpPage } from '@/features/events/RsvpPage';
import { WorkloadPage } from '@/features/workload/WorkloadPage';
import { ReportsPage } from '@/features/workload/ReportsPage';

export const router = createBrowserRouter([
  { path: '/', element: <Navigate to="/app" replace /> },
  { path: '/auth/signin', element: <SignInPage /> },
  { path: '/auth/signup', element: <SignUpPage /> },
  { path: '/auth/callback', element: <AuthCallbackPage /> },
  { path: '/rsvp', element: <RsvpPage /> },
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
      { path: 'workload', element: <WorkloadPage /> },
      { path: 'reports', element: <ReportsPage /> },
      { path: 'projects/:id', element: <ProjectPage /> },
    ],
  },
]);
