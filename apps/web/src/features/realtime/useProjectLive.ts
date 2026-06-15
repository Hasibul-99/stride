import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { SOCKET_EVENTS } from '@teamboard/shared';
import { connectSocket } from '@/lib/socket';

/** Join a project room and refresh task/event caches on live board changes. */
export function useProjectLive(projectId: string | undefined) {
  const qc = useQueryClient();

  useEffect(() => {
    if (!projectId) return;
    const socket = connectSocket();

    const join = () => socket.emit(SOCKET_EVENTS.joinProject, { projectId });
    if (socket.connected) join();
    socket.on('connect', join);

    const onBoard = (payload: { projectId: string }) => {
      if (payload.projectId !== projectId) return;
      qc.invalidateQueries({ queryKey: ['tasks', projectId] });
      qc.invalidateQueries({ queryKey: ['events'] });
      qc.invalidateQueries({ queryKey: ['planner'] });
    };
    socket.on(SOCKET_EVENTS.boardChanged, onBoard);

    return () => {
      socket.emit(SOCKET_EVENTS.leaveProject, { projectId });
      socket.off('connect', join);
      socket.off(SOCKET_EVENTS.boardChanged, onBoard);
    };
  }, [projectId, qc]);
}
