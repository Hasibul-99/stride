import { Injectable, NotFoundException } from '@nestjs/common';
import type {
  CreateFolderInput,
  CreateInviteInput,
  CreateWorkspaceInput,
  UpdateFolderInput,
  UpdateWorkspaceInput,
} from '@teamboard/shared';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { AccessService } from '../access/access.service';
import { MailService } from '../mail/mail.service';
import { randomToken, sha256 } from '../common/hash';

@Injectable()
export class WorkspacesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessService,
    private readonly mail: MailService,
    private readonly config: ConfigService,
  ) {}

  /** Workspaces the user belongs to, with their role. */
  async list(userId: string) {
    const memberships = await this.prisma.workspaceMember.findMany({
      where: { userId },
      include: { workspace: true },
      orderBy: { joinedAt: 'asc' },
    });
    return memberships.map((m) => ({ ...m.workspace, role: m.role }));
  }

  async create(userId: string, input: CreateWorkspaceInput) {
    return this.prisma.workspace.create({
      data: {
        name: input.name,
        logoUrl: input.logoUrl ?? null,
        ownerId: userId,
        members: { create: { userId, role: 'OWNER' } },
      },
    });
  }

  async get(userId: string, workspaceId: string) {
    await this.access.assertWorkspaceMember(userId, workspaceId);
    const ws = await this.prisma.workspace.findUnique({ where: { id: workspaceId } });
    if (!ws) throw new NotFoundException('Workspace not found');
    return ws;
  }

  async update(userId: string, workspaceId: string, input: UpdateWorkspaceInput) {
    await this.access.assertWorkspaceMember(userId, workspaceId, ['OWNER', 'ADMIN']);
    return this.prisma.workspace.update({ where: { id: workspaceId }, data: input });
  }

  async remove(userId: string, workspaceId: string) {
    await this.access.assertWorkspaceMember(userId, workspaceId, ['OWNER']);
    await this.prisma.workspace.delete({ where: { id: workspaceId } });
  }

  async members(userId: string, workspaceId: string) {
    await this.access.assertWorkspaceMember(userId, workspaceId);
    return this.prisma.workspaceMember.findMany({
      where: { workspaceId },
      include: { user: { select: { id: true, name: true, email: true, avatarUrl: true } } },
      orderBy: { joinedAt: 'asc' },
    });
  }

  // ─── Folders ───────────────────────────────────────────

  async listFolders(userId: string, workspaceId: string) {
    await this.access.assertWorkspaceMember(userId, workspaceId);
    return this.prisma.folder.findMany({
      where: { workspaceId },
      orderBy: { position: 'asc' },
    });
  }

  async createFolder(userId: string, workspaceId: string, input: CreateFolderInput) {
    await this.access.assertWorkspaceMember(userId, workspaceId);
    const last = await this.prisma.folder.findFirst({
      where: { workspaceId },
      orderBy: { position: 'desc' },
    });
    return this.prisma.folder.create({
      data: { workspaceId, name: input.name, position: (last?.position ?? 0) + 1000 },
    });
  }

  async updateFolder(userId: string, folderId: string, input: UpdateFolderInput) {
    const folder = await this.prisma.folder.findUnique({ where: { id: folderId } });
    if (!folder) throw new NotFoundException('Folder not found');
    await this.access.assertWorkspaceMember(userId, folder.workspaceId);
    return this.prisma.folder.update({ where: { id: folderId }, data: input });
  }

  async removeFolder(userId: string, folderId: string) {
    const folder = await this.prisma.folder.findUnique({ where: { id: folderId } });
    if (!folder) throw new NotFoundException('Folder not found');
    await this.access.assertWorkspaceMember(userId, folder.workspaceId);
    await this.prisma.folder.delete({ where: { id: folderId } });
  }

  // ─── Invites ───────────────────────────────────────────

  async createInvite(userId: string, workspaceId: string, input: CreateInviteInput) {
    await this.access.assertWorkspaceMember(userId, workspaceId, ['OWNER', 'ADMIN']);
    const ws = await this.prisma.workspace.findUniqueOrThrow({ where: { id: workspaceId } });

    const token = randomToken();
    const tokenHash = sha256(token);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const invite = await this.prisma.invite.create({
      data: { workspaceId, email: input.email, role: input.role, tokenHash, expiresAt },
    });

    const acceptUrl = `${this.config.getOrThrow<string>('FRONTEND_URL')}/invite?token=${token}`;
    await this.mail.sendInvite(input.email, ws.name, acceptUrl);

    return { id: invite.id, email: invite.email, role: invite.role, acceptUrl };
  }

  async listInvites(userId: string, workspaceId: string) {
    await this.access.assertWorkspaceMember(userId, workspaceId, ['OWNER', 'ADMIN']);
    return this.prisma.invite.findMany({
      where: { workspaceId, acceptedAt: null },
      select: { id: true, email: true, role: true, createdAt: true, projectId: true },
    });
  }

  /** The logged-in user accepts an invite and joins the workspace (and project, if any). */
  async acceptInvite(userId: string, token: string) {
    const tokenHash = sha256(token);
    const invite = await this.prisma.invite.findUnique({ where: { tokenHash } });
    if (!invite || invite.acceptedAt || invite.expiresAt < new Date()) {
      throw new NotFoundException('Invite is invalid or expired');
    }

    await this.prisma.$transaction(async (tx) => {
      if (invite.projectId) {
        // Project-level (GUEST) invite: join only the project.
        await tx.projectMember.upsert({
          where: { projectId_userId: { projectId: invite.projectId, userId } },
          update: {},
          create: { projectId: invite.projectId, userId, role: 'GUEST' },
        });
      } else {
        await tx.workspaceMember.upsert({
          where: { workspaceId_userId: { workspaceId: invite.workspaceId, userId } },
          update: {},
          create: {
            workspaceId: invite.workspaceId,
            userId,
            role: invite.role === 'OWNER' || invite.role === 'ADMIN' ? invite.role : 'MEMBER',
          },
        });
      }
      await tx.invite.update({ where: { id: invite.id }, data: { acceptedAt: new Date() } });
    });

    return { workspaceId: invite.workspaceId, projectId: invite.projectId };
  }
}
