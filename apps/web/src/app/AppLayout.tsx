import { useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from '@/features/workspaces/Sidebar';
import { TimerPill } from '@/features/time/TimerPill';
import { NotificationBell } from '@/features/notifications/NotificationBell';
import { connectSocket, disconnectSocket } from '@/lib/socket';

export function AppLayout() {
  useEffect(() => {
    connectSocket();
    return () => disconnectSocket();
  }, []);

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex flex-1 flex-col">
        <header className="flex h-12 items-center justify-end gap-3 border-b border-border bg-surface px-4">
          <TimerPill />
          <NotificationBell />
        </header>
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
