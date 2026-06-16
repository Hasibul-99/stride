import { Injectable } from '@nestjs/common';
import type { SearchResults } from '@teamboard/shared';
import { PrismaService } from '../prisma/prisma.service';
import { AccessService } from '../access/access.service';

@Injectable()
export class SearchService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessService,
  ) {}

  /** Search tasks + notes by title across projects the user can see. */
  async search(userId: string, workspaceId: string, q: string): Promise<SearchResults> {
    await this.access.assertWorkspaceMember(userId, workspaceId).catch(() => undefined);

    // Projects the user can see in this workspace.
    const wsMember = await this.prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId } },
    });
    const projects = wsMember
      ? await this.prisma.project.findMany({
          where: { workspaceId, deletedAt: null },
          select: { id: true, name: true },
        })
      : await this.prisma.project.findMany({
          where: { workspaceId, deletedAt: null, members: { some: { userId } } },
          select: { id: true, name: true },
        });

    const projectIds = projects.map((p) => p.id);
    const nameById = new Map(projects.map((p) => [p.id, p.name]));
    if (projectIds.length === 0) return { tasks: [], notes: [] };

    const [tasks, notes] = await Promise.all([
      this.prisma.task.findMany({
        where: {
          projectId: { in: projectIds },
          deletedAt: null,
          title: { contains: q, mode: 'insensitive' },
        },
        select: { id: true, title: true, projectId: true },
        take: 20,
      }),
      this.prisma.note.findMany({
        where: {
          projectId: { in: projectIds },
          title: { contains: q, mode: 'insensitive' },
        },
        select: { id: true, title: true, projectId: true },
        take: 20,
      }),
    ]);

    return {
      tasks: tasks.map((t) => ({ ...t, projectName: nameById.get(t.projectId) ?? '' })),
      notes: notes.map((n) => ({ ...n, projectName: nameById.get(n.projectId) ?? '' })),
    };
  }
}
