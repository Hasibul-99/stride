import { createBrowserRouter } from 'react-router-dom';
import { LandingPage } from '@/features/marketing/LandingPage';
import { DesignSystemPage } from '@/features/design/DesignSystemPage';
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
import { SettingsPage } from '@/features/integrations/SettingsPage';

export const router = createBrowserRouter([
  { path: '/', element: <LandingPage /> },
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
      { path: 'settings', element: <SettingsPage /> },
      { path: 'design-system', element: <DesignSystemPage /> },
      { path: 'projects/:id', element: <ProjectPage /> },
    ],
  },
]);
