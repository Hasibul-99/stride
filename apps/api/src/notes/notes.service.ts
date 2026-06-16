import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { SOCKET_EVENTS, type CreateNoteInput, type UpdateNoteInput } from '@teamboard/shared';
import { PrismaService } from '../prisma/prisma.service';
import { AccessService } from '../access/access.service';
import { RealtimeEmitter } from '../realtime/realtime.emitter';

@Injectable()
export class NotesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessService,
    private readonly emitter: RealtimeEmitter,
  ) {}

  async list(userId: string, projectId: string) {
    await this.access.assertProjectAccess(userId, projectId);
    return this.prisma.note.findMany({
      where: { projectId },
      orderBy: { position: 'asc' },
      include: { createdBy: { select: { id: true, name: true } } },
    });
  }

  async create(userId: string, projectId: string, input: CreateNoteInput) {
    await this.access.assertProjectAccess(userId, projectId);
    const last = await this.prisma.note.findFirst({
      where: { projectId },
      orderBy: { position: 'desc' },
    });
    return this.prisma.note.create({
      data: {
        projectId,
        title: input.title ?? 'Untitled',
        content: (input.content ?? undefined) as Prisma.InputJsonValue | undefined,
        position: (last?.position ?? 0) + 1000,
        createdById: userId,
      },
    });
  }

  async update(userId: string, noteId: string, input: UpdateNoteInput) {
    const note = await this.prisma.note.findUnique({ where: { id: noteId } });
    if (!note) throw new NotFoundException('Note not found');
    await this.access.assertProjectAccess(userId, note.projectId);

    const data: Prisma.NoteUpdateInput = {};
    if (input.title !== undefined) data.title = input.title;
    if (input.content !== undefined) data.content = input.content as Prisma.InputJsonValue;
    if (input.position !== undefined) data.position = input.position;

    const updated = await this.prisma.note.update({ where: { id: noteId }, data });
    // Notify others viewing the project so they can show a "refresh" banner.
    this.emitter.emitProject(note.projectId, SOCKET_EVENTS.boardChanged, {
      projectId: note.projectId,
      noteUpdated: { id: noteId, by: userId, updatedAt: updated.updatedAt },
    });
    return updated;
  }

  async remove(userId: string, noteId: string) {
    const note = await this.prisma.note.findUnique({ where: { id: noteId } });
    if (!note) throw new NotFoundException('Note not found');
    await this.access.assertProjectAccess(userId, note.projectId);
    await this.prisma.note.delete({ where: { id: noteId } });
  }
}
