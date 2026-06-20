import { io, type Socket } from 'socket.io-client';
import { useAuthStore } from '@/store/auth.store';

/**
 * Stable id for this tab. Mutations stamp realtime events with it so the
 * client can ignore echoes of its own changes (no double-apply).
 */
export const clientId =
  typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);

let socket: Socket | null = null;

/** Connect (or reconnect) the singleton socket using the in-memory access token. */
export function connectSocket(): Socket {
  const token = useAuthStore.getState().accessToken;
  if (socket) {
    socket.auth = { token };
    if (!socket.connected) socket.connect();
    return socket;
  }
  socket = io({
    // same-origin; Vite proxies /socket.io to the API in dev
    auth: { token },
    autoConnect: true,
    transports: ['websocket'],
  });
  return socket;
}

export function getSocket(): Socket | null {
  return socket;
}

export function disconnectSocket(): void {
  socket?.disconnect();
  socket = null;
}
