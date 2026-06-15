import {
  OnGatewayConnection,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Server, Socket } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { Redis } from 'ioredis';
import { SOCKET_EVENTS } from '@teamboard/shared';
import { AccessService } from '../access/access.service';
import { ChatService } from '../chat/chat.service';
import { NotificationsService } from '../notifications/notifications.service';
import { RealtimeEmitter } from './realtime.emitter';

interface AuthedSocket extends Socket {
  data: { userId?: string };
}

@WebSocketGateway({ cors: { origin: true, credentials: true } })
export class RealtimeGateway implements OnGatewayInit, OnGatewayConnection {
  private readonly logger = new Logger(RealtimeGateway.name);
  @WebSocketServer() server!: Server;

  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly access: AccessService,
    private readonly chat: ChatService,
    private readonly notifications: NotificationsService,
    private readonly emitter: RealtimeEmitter,
  ) {}

  afterInit(server: Server): void {
    const url = this.config.get<string>('REDIS_URL') ?? 'redis://localhost:6379';
    const pub = new Redis(url, { maxRetriesPerRequest: null });
    const sub = pub.duplicate();
    server.adapter(createAdapter(pub, sub));
    this.emitter.setServer(server);
    this.logger.log('WebSocket gateway initialized with Redis adapter');
  }

  async handleConnection(client: AuthedSocket): Promise<void> {
    const token =
      (client.handshake.auth?.token as string | undefined) ??
      (client.handshake.query?.token as string | undefined);
    try {
      const payload = await this.jwt.verifyAsync<{ sub: string }>(token ?? '', {
        secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'),
      });
      client.data.userId = payload.sub;
      client.join(`user:${payload.sub}`); // personal room for notifications
    } catch {
      client.disconnect(true);
    }
  }

  // ─── Rooms ─────────────────────────────────────────────

  @SubscribeMessage(SOCKET_EVENTS.joinProject)
  async joinProject(@ConnectedSocket() client: AuthedSocket, @MessageBody() body: { projectId: string }) {
    if (!(await this.canAccessProject(client, body.projectId))) return { ok: false };
    await client.join(`project:${body.projectId}`);
    return { ok: true };
  }

  @SubscribeMessage(SOCKET_EVENTS.leaveProject)
  async leaveProject(@ConnectedSocket() client: AuthedSocket, @MessageBody() body: { projectId: string }) {
    await client.leave(`project:${body.projectId}`);
    return { ok: true };
  }

  @SubscribeMessage(SOCKET_EVENTS.joinTask)
  async joinTask(@ConnectedSocket() client: AuthedSocket, @MessageBody() body: { taskId: string }) {
    const userId = client.data.userId;
    if (!userId) return { ok: false };
    try {
      await this.chat.assertAccess(userId, body.taskId);
    } catch {
      return { ok: false };
    }
    await client.join(`task:${body.taskId}`);
    return { ok: true };
  }

  @SubscribeMessage(SOCKET_EVENTS.leaveTask)
  async leaveTask(@ConnectedSocket() client: AuthedSocket, @MessageBody() body: { taskId: string }) {
    await client.leave(`task:${body.taskId}`);
    return { ok: true };
  }

  // ─── Chat ──────────────────────────────────────────────

  @SubscribeMessage(SOCKET_EVENTS.chatSend)
  async chatSend(
    @ConnectedSocket() client: AuthedSocket,
    @MessageBody() body: { taskId: string; body: string; mentions?: string[] },
  ) {
    const userId = client.data.userId;
    if (!userId) return { ok: false };
    const msg = await this.chat.send(userId, body.taskId, body.body);
    this.emitter.emitTask(body.taskId, SOCKET_EVENTS.chatNew, msg);

    // @mentions → notifications
    for (const mentionedId of body.mentions ?? []) {
      if (mentionedId !== userId) {
        await this.notifications.create(mentionedId, 'MENTION', {
          taskId: body.taskId,
          messageId: msg.id,
          from: msg.author.name,
        });
      }
    }
    return { ok: true, message: msg };
  }

  @SubscribeMessage(SOCKET_EVENTS.chatEdit)
  async chatEdit(
    @ConnectedSocket() client: AuthedSocket,
    @MessageBody() body: { messageId: string; body: string },
  ) {
    const userId = client.data.userId;
    if (!userId) return { ok: false };
    const msg = await this.chat.edit(userId, body.messageId, body.body);
    this.emitter.emitTask(msg.taskId, SOCKET_EVENTS.chatUpdated, msg);
    return { ok: true };
  }

  @SubscribeMessage(SOCKET_EVENTS.chatDelete)
  async chatDelete(
    @ConnectedSocket() client: AuthedSocket,
    @MessageBody() body: { messageId: string },
  ) {
    const userId = client.data.userId;
    if (!userId) return { ok: false };
    const { id, taskId } = await this.chat.remove(userId, body.messageId);
    this.emitter.emitTask(taskId, SOCKET_EVENTS.chatDeleted, { id, taskId });
    return { ok: true };
  }

  @SubscribeMessage(SOCKET_EVENTS.chatTyping)
  async typing(@ConnectedSocket() client: AuthedSocket, @MessageBody() body: { taskId: string }) {
    const userId = client.data.userId;
    if (!userId) return;
    client.to(`task:${body.taskId}`).emit(SOCKET_EVENTS.typingPing, { taskId: body.taskId, userId });
  }

  private async canAccessProject(client: AuthedSocket, projectId: string): Promise<boolean> {
    const userId = client.data.userId;
    if (!userId) return false;
    try {
      await this.access.assertProjectAccess(userId, projectId);
      return true;
    } catch {
      return false;
    }
  }
}
