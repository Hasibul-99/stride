import { Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  addProjectMemberSchema,
  createProjectSchema,
  updateProjectSchema,
  type AddProjectMemberInput,
  type CreateProjectInput,
  type UpdateProjectInput,
} from '@teamboard/shared';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ZodBody } from '../common/pipes/zod-body.decorator';
import { ProjectsService } from './projects.service';

@ApiTags('projects')
@ApiBearerAuth()
@Controller()
export class ProjectsController {
  constructor(private readonly svc: ProjectsService) {}

  @Get('workspaces/:workspaceId/projects')
  list(@CurrentUser('id') userId: string, @Param('workspaceId') workspaceId: string) {
    return this.svc.list(userId, workspaceId);
  }

  @Post('workspaces/:workspaceId/projects')
  create(
    @CurrentUser('id') userId: string,
    @Param('workspaceId') workspaceId: string,
    @ZodBody(createProjectSchema) body: CreateProjectInput,
  ) {
    return this.svc.create(userId, workspaceId, body);
  }

  @Get('projects/:id')
  get(@CurrentUser('id') userId: string, @Param('id') id: string) {
    return this.svc.get(userId, id);
  }

  @Patch('projects/:id')
  update(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
    @ZodBody(updateProjectSchema) body: UpdateProjectInput,
  ) {
    return this.svc.update(userId, id, body);
  }

  @Post('projects/:id/archive')
  archive(@CurrentUser('id') userId: string, @Param('id') id: string) {
    return this.svc.archive(userId, id);
  }

  @Post('projects/:id/restore')
  restore(@CurrentUser('id') userId: string, @Param('id') id: string) {
    return this.svc.restore(userId, id);
  }

  @Delete('projects/:id')
  remove(@CurrentUser('id') userId: string, @Param('id') id: string) {
    return this.svc.remove(userId, id);
  }

  @Get('projects/:id/members')
  listMembers(@CurrentUser('id') userId: string, @Param('id') id: string) {
    return this.svc.listMembers(userId, id);
  }

  @Post('projects/:id/members')
  addMember(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
    @ZodBody(addProjectMemberSchema) body: AddProjectMemberInput,
  ) {
    return this.svc.addMember(userId, id, body);
  }

  @Delete('projects/:id/members/:targetUserId')
  removeMember(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
    @Param('targetUserId') targetUserId: string,
  ) {
    return this.svc.removeMember(userId, id, targetUserId);
  }
}
