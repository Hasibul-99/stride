import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DEFAULT_STATUSES } from '@teamboard/shared';
import type {
  AddProjectMemberInput,
  CreateProjectInput,
  UpdateProjectInput,
} from '@teamboard/shared';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { AccessService } from '../access/access.service';
import { MailService } from '../mail/mail.service';
import { randomToken, sha256 } from '../common/hash';

@Injectable()
export class ProjectsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessService,
    private readonly mail: MailService,
    private readonly config: ConfigService,
  ) {}

  /** Projects in a workspace the user can see (guests see only their own). */
  async list(userId: string, workspaceId: string) {
    const member = await this.prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId } },
    });

    if (member) {
      return this.prisma.project.findMany({
        where: { workspaceId, deletedAt: null },
        orderBy: { position: 'asc' },
      });
    }

    // Guest: only projects they're a member of within this workspace.
    return this.prisma.project.findMany({
      where: { workspaceId, deletedAt: null, members: { some: { userId } } },
      orderBy: { position: 'asc' },
    });
  }

  async create(userId: string, workspaceId: string, input: CreateProjectInput) {
    await this.access.assertWorkspaceMember(userId, workspaceId);

    const last = await this.prisma.project.findFirst({
      where: { workspaceId },
      orderBy: { position: 'desc' },
    });

    return this.prisma.project.create({
      data: {
        workspaceId,
        name: input.name,
        color: input.color ?? 'blue',
        description: input.description ?? null,
        folderId: input.folderId ?? null,
        position: (last?.position ?? 0) + 1000,
        members: { create: { userId, role: 'MANAGER' } },
        statuses: {
          create: DEFAULT_STATUSES.map((s, i) => ({
            name: s.name,
            color: s.color,
            position: (i + 1) * 1000,
            isDefault: i === 0,
            isCompleted: s.isCompleted,
          })),
        },
      },
      include: { statuses: { orderBy: { position: 'asc' } } },
    });
  }

  async get(userId: string, projectId: string) {
    await this.access.assertProjectAccess(userId, projectId);
    return this.prisma.project.findUniqueOrThrow({
      where: { id: projectId },
      include: { statuses: { orderBy: { position: 'asc' } } },
    });
  }

  async update(userId: string, projectId: string, input: UpdateProjectInput) {
    await this.access.assertProjectAccess(userId, projectId);
    return this.prisma.project.update({ where: { id: projectId }, data: input });
  }

  async archive(userId: string, projectId: string) {
    await this.access.assertProjectAccess(userId, projectId);
    return this.prisma.project.update({
      where: { id: projectId },
      data: { archivedAt: new Date() },
    });
  }

  async restore(userId: string, projectId: string) {
    await this.access.assertProjectAccess(userId, projectId);
    return this.prisma.project.update({ where: { id: projectId }, data: { archivedAt: null } });
  }

  async remove(userId: string, projectId: string) {
    await this.access.assertProjectAccess(userId, projectId);
    // Soft delete — never hard delete user data.
    await this.prisma.project.update({
      where: { id: projectId },
      data: { deletedAt: new Date() },
    });
  }

  // ─── Members ───────────────────────────────────────────

  async listMembers(userId: string, projectId: string) {
    await this.access.assertProjectAccess(userId, projectId);
    return this.prisma.projectMember.findMany({
      where: { projectId },
      include: { user: { select: { id: true, name: true, email: true, avatarUrl: true } } },
    });
  }

  /** Add an existing workspace member, or invite an external guest by email. */
  async addMember(userId: string, projectId: string, input: AddProjectMemberInput) {
    const { project } = await this.access.assertProjectAccess(userId, projectId);

    if (input.userId) {
      // Must already be a workspace member.
      await this.access.assertWorkspaceMember(input.userId, project.workspaceId);
      return this.prisma.projectMember.upsert({
        where: { projectId_userId: { projectId, userId: input.userId } },
        update: { role: input.role },
        create: { projectId, userId: input.userId, role: input.role },
      });
    }

    if (input.email) {
      // Guest invite scoped to this project.
      const token = randomToken();
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      await this.prisma.invite.create({
        data: {
          workspaceId: project.workspaceId,
          projectId,
          email: input.email,
          role: 'GUEST',
          tokenHash: sha256(token),
          expiresAt,
        },
      });
      const ws = await this.prisma.workspace.findUniqueOrThrow({
        where: { id: project.workspaceId },
      });
      const acceptUrl = `${this.config.getOrThrow<string>('FRONTEND_URL')}/invite?token=${token}`;
      await this.mail.sendInvite(input.email, ws.name, acceptUrl);
      return { invited: input.email, acceptUrl };
    }

    throw new BadRequestException('Provide either userId or email');
  }

  async removeMember(userId: string, projectId: string, targetUserId: string) {
    await this.access.assertProjectAccess(userId, projectId);
    const member = await this.prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId, userId: targetUserId } },
    });
    if (!member) throw new NotFoundException('Member not found');
    await this.prisma.projectMember.delete({
      where: { projectId_userId: { projectId, userId: targetUserId } },
    });
  }
}
