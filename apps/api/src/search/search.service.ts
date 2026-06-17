import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { SearchResults } from '@teamboard/shared';
import { PrismaService } from '../prisma/prisma.service';

interface Row {
  id: string;
  title: string;
  projectId: string;
}

@Injectable()
export class SearchService {
  constructor(private readonly prisma: PrismaService) {}

  /** Full-text search (Postgres tsvector + GIN) over tasks + notes the user can see. */
  async search(userId: string, workspaceId: string, q: string): Promise<SearchResults> {
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

    const ids = Prisma.join(projectIds);
    const [tasks, notes] = await Promise.all([
      this.prisma.$queryRaw<Row[]>`
        SELECT "id", "title", "projectId" FROM "tasks"
        WHERE "deletedAt" IS NULL AND "projectId" IN (${ids})
          AND "searchVector" @@ websearch_to_tsquery('english', ${q})
        LIMIT 20`,
      this.prisma.$queryRaw<Row[]>`
        SELECT "id", "title", "projectId" FROM "notes"
        WHERE "projectId" IN (${ids})
          AND "searchVector" @@ websearch_to_tsquery('english', ${q})
        LIMIT 20`,
    ]);

    return {
      tasks: tasks.map((t) => ({ ...t, projectName: nameById.get(t.projectId) ?? '' })),
      notes: notes.map((n) => ({ ...n, projectName: nameById.get(n.projectId) ?? '' })),
    };
  }
}
