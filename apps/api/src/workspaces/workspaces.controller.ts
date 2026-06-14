import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  acceptInviteSchema,
  createFolderSchema,
  createInviteSchema,
  createWorkspaceSchema,
  updateFolderSchema,
  updateWorkspaceSchema,
  type AcceptInviteInput,
  type CreateFolderInput,
  type CreateInviteInput,
  type CreateWorkspaceInput,
  type UpdateFolderInput,
  type UpdateWorkspaceInput,
} from '@teamboard/shared';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ZodBody } from '../common/pipes/zod-body.decorator';
import { WorkspacesService } from './workspaces.service';

@ApiTags('workspaces')
@ApiBearerAuth()
@Controller()
export class WorkspacesController {
  constructor(private readonly svc: WorkspacesService) {}

  @Get('workspaces')
  list(@CurrentUser('id') userId: string) {
    return this.svc.list(userId);
  }

  @Post('workspaces')
  create(
    @CurrentUser('id') userId: string,
    @ZodBody(createWorkspaceSchema) body: CreateWorkspaceInput,
  ) {
    return this.svc.create(userId, body);
  }

  @Get('workspaces/:id')
  get(@CurrentUser('id') userId: string, @Param('id') id: string) {
    return this.svc.get(userId, id);
  }

  @Patch('workspaces/:id')
  update(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
    @ZodBody(updateWorkspaceSchema) body: UpdateWorkspaceInput,
  ) {
    return this.svc.update(userId, id, body);
  }

  @Delete('workspaces/:id')
  remove(@CurrentUser('id') userId: string, @Param('id') id: string) {
    return this.svc.remove(userId, id);
  }

  @Get('workspaces/:id/members')
  members(@CurrentUser('id') userId: string, @Param('id') id: string) {
    return this.svc.members(userId, id);
  }

  // ─── Folders ───────────────────────────────────────────

  @Get('workspaces/:id/folders')
  listFolders(@CurrentUser('id') userId: string, @Param('id') id: string) {
    return this.svc.listFolders(userId, id);
  }

  @Post('workspaces/:id/folders')
  createFolder(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
    @ZodBody(createFolderSchema) body: CreateFolderInput,
  ) {
    return this.svc.createFolder(userId, id, body);
  }

  @Patch('folders/:folderId')
  updateFolder(
    @CurrentUser('id') userId: string,
    @Param('folderId') folderId: string,
    @ZodBody(updateFolderSchema) body: UpdateFolderInput,
  ) {
    return this.svc.updateFolder(userId, folderId, body);
  }

  @Delete('folders/:folderId')
  removeFolder(@CurrentUser('id') userId: string, @Param('folderId') folderId: string) {
    return this.svc.removeFolder(userId, folderId);
  }

  // ─── Invites ───────────────────────────────────────────

  @Post('workspaces/:id/invites')
  createInvite(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
    @ZodBody(createInviteSchema) body: CreateInviteInput,
  ) {
    return this.svc.createInvite(userId, id, body);
  }

  @Get('workspaces/:id/invites')
  listInvites(@CurrentUser('id') userId: string, @Param('id') id: string) {
    return this.svc.listInvites(userId, id);
  }

  @Post('invites/accept')
  accept(@CurrentUser('id') userId: string, @ZodBody(acceptInviteSchema) body: AcceptInviteInput) {
    return this.svc.acceptInvite(userId, body.token);
  }
}
