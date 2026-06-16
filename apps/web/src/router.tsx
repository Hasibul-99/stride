import { lazy, Suspense, type ReactNode } from 'react';
import { createBrowserRouter } from 'react-router-dom';
import { LandingPage } from '@/features/marketing/LandingPage';
import { SignInPage } from '@/features/auth/SignInPage';
import { SignUpPage } from '@/features/auth/SignUpPage';
import { AuthCallbackPage } from '@/features/auth/AuthCallbackPage';
import { RequireAuth } from '@/features/auth/RequireAuth';
import { AppLayout } from '@/app/AppLayout';
import { HomePage } from '@/app/HomePage';

// Heavy in-app views are code-split to keep the initial bundle small.
const ProjectPage = lazy(() => import('@/features/projects/ProjectPage').then((m) => ({ default: m.ProjectPage })));
const TeamPlannerPage = lazy(() => import('@/features/calendar/TeamPlannerPage').then((m) => ({ default: m.TeamPlannerPage })));
const WorkloadPage = lazy(() => import('@/features/workload/WorkloadPage').then((m) => ({ default: m.WorkloadPage })));
const ReportsPage = lazy(() => import('@/features/workload/ReportsPage').then((m) => ({ default: m.ReportsPage })));
const SettingsPage = lazy(() => import('@/features/integrations/SettingsPage').then((m) => ({ default: m.SettingsPage })));
const DesignSystemPage = lazy(() => import('@/features/design/DesignSystemPage').then((m) => ({ default: m.DesignSystemPage })));
const RsvpPage = lazy(() => import('@/features/events/RsvpPage').then((m) => ({ default: m.RsvpPage })));

function lazyRoute(node: ReactNode): ReactNode {
  return <Suspense fallback={<div className="p-6 text-muted">Loading…</div>}>{node}</Suspense>;
}

export const router = createBrowserRouter([
  { path: '/', element: <LandingPage /> },
  { path: '/auth/signin', element: <SignInPage /> },
  { path: '/auth/signup', element: <SignUpPage /> },
  { path: '/auth/callback', element: <AuthCallbackPage /> },
  { path: '/rsvp', element: lazyRoute(<RsvpPage />) },
  {
    path: '/app',
    element: (
      <RequireAuth>
        <AppLayout />
      </RequireAuth>
    ),
    children: [
      { index: true, element: <HomePage /> },
      { path: 'team', element: lazyRoute(<TeamPlannerPage />) },
      { path: 'workload', element: lazyRoute(<WorkloadPage />) },
      { path: 'reports', element: lazyRoute(<ReportsPage />) },
      { path: 'settings', element: lazyRoute(<SettingsPage />) },
      { path: 'design-system', element: lazyRoute(<DesignSystemPage />) },
      { path: 'projects/:id', element: lazyRoute(<ProjectPage />) },
    ],
  },
]);
