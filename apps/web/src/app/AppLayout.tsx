import { useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from '@/features/workspaces/Sidebar';
import { TimerPill } from '@/features/time/TimerPill';
import { NotificationBell } from '@/features/notifications/NotificationBell';
import { SearchPalette } from '@/features/search/SearchPalette';
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
        <header className="flex h-12 items-center gap-3 border-b border-border bg-surface px-4">
          <button
            onClick={() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true }))}
            className="rounded-control border border-border px-3 py-1 text-sm text-muted"
          >
            Search… ⌘K
          </button>
          <div className="ml-auto flex items-center gap-3">
            <TimerPill />
            <NotificationBell />
          </div>
        </header>
        <SearchPalette />
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
