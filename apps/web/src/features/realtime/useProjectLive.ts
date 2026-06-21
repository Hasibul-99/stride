import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { SOCKET_EVENTS } from '@teamboard/shared';
import { connectSocket, clientId } from '@/lib/socket';
import type { Task } from '@/features/tasks/api';

export interface TaskMovedEvent {
  projectId: string;
  originId?: string;
  task: Partial<Task> & { id: string };
}

/** Join a project room; patch task caches live on board changes. */
export function useProjectLive(projectId: string | undefined) {
  const qc = useQueryClient();

  useEffect(() => {
    if (!projectId) return;
    const socket = connectSocket();

    // (Re)join the room and resync caches on every connect — this catches a
    // client up on changes it missed while offline/disconnected.
    const join = () => {
      socket.emit(SOCKET_EVENTS.joinProject, { projectId });
      qc.invalidateQueries({ queryKey: ['tasks', projectId] });
      qc.invalidateQueries({ queryKey: ['events'] });
    };
    if (socket.connected) join();
    socket.on('connect', join);

    // Coarse refresh for any board change (create/delete/etc.).
    const onBoard = (payload: { projectId: string }) => {
      if (payload.projectId !== projectId) return;
      qc.invalidateQueries({ queryKey: ['tasks', projectId] });
      qc.invalidateQueries({ queryKey: ['events'] });
      qc.invalidateQueries({ queryKey: ['planner'] });
    };
    socket.on(SOCKET_EVENTS.boardChanged, onBoard);

    // Precise cache patch for a moved task — skip our own echoes.
    const onTaskMoved = (payload: TaskMovedEvent) => {
      if (payload.projectId !== projectId) return;
      if (payload.originId && payload.originId === clientId) return; // echo guard
      qc.setQueriesData<Task[]>({ queryKey: ['tasks', projectId] }, (old) =>
        old?.map((t) => (t.id === payload.task.id ? { ...t, ...payload.task } : t)),
      );
    };
    socket.on(SOCKET_EVENTS.taskMoved, onTaskMoved);

    return () => {
      socket.emit(SOCKET_EVENTS.leaveProject, { projectId });
      socket.off('connect', join);
      socket.off(SOCKET_EVENTS.boardChanged, onBoard);
      socket.off(SOCKET_EVENTS.taskMoved, onTaskMoved);
    };
  }, [projectId, qc]);
}
