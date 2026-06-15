import { Injectable } from '@nestjs/common';
import type { Server } from 'socket.io';

/**
 * Thin holder for the Socket.IO server so any service can emit without
 * depending on the gateway (avoids circular deps). The gateway injects the
 * live server in its afterInit.
 */
@Injectable()
export class RealtimeEmitter {
  private server: Server | null = null;

  setServer(server: Server): void {
    this.server = server;
  }

  emitProject(projectId: string, event: string, payload: unknown): void {
    this.server?.to(`project:${projectId}`).emit(event, payload);
  }

  emitTask(taskId: string, event: string, payload: unknown): void {
    this.server?.to(`task:${taskId}`).emit(event, payload);
  }

  emitUser(userId: string, event: string, payload: unknown): void {
    this.server?.to(`user:${userId}`).emit(event, payload);
  }
}
