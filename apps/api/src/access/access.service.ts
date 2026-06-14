import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { WorkspaceRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AccessService {
  constructor(private readonly prisma: PrismaService) {}

  /** Returns the membership or throws 403. Optionally enforces a minimum role set. */
  async assertWorkspaceMember(
    userId: string,
    workspaceId: string,
    allowedRoles?: WorkspaceRole[],
  ) {
    const member = await this.prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId } },
    });
    if (!member) {
      throw new ForbiddenException('Not a member of this workspace');
    }
    if (allowedRoles && !allowedRoles.includes(member.role)) {
      throw new ForbiddenException('Insufficient workspace role');
    }
    return member;
  }

  /**
   * Project access rule:
   * - workspace members can access any project in their workspace;
   * - guests (not workspace members) can access only projects they're a
   *   ProjectMember of. This enforces guest isolation.
   */
  async assertProjectAccess(userId: string, projectId: string) {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, deletedAt: null },
      select: { id: true, workspaceId: true },
    });
    if (!project) {
      throw new NotFoundException('Project not found');
    }

    const wsMember = await this.prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId: project.workspaceId, userId } },
    });
    if (wsMember) return { project, isGuest: false };

    const projMember = await this.prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId, userId } },
    });
    if (projMember) return { project, isGuest: true };

    throw new ForbiddenException('No access to this project');
  }
}
