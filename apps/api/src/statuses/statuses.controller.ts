import { Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  createStatusSchema,
  updateStatusSchema,
  type CreateStatusInput,
  type UpdateStatusInput,
} from '@teamboard/shared';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ZodBody } from '../common/pipes/zod-body.decorator';
import { StatusesService } from './statuses.service';

@ApiTags('statuses')
@ApiBearerAuth()
@Controller()
export class StatusesController {
  constructor(private readonly svc: StatusesService) {}

  @Get('projects/:projectId/statuses')
  list(@CurrentUser('id') userId: string, @Param('projectId') projectId: string) {
    return this.svc.list(userId, projectId);
  }

  @Post('projects/:projectId/statuses')
  create(
    @CurrentUser('id') userId: string,
    @Param('projectId') projectId: string,
    @ZodBody(createStatusSchema) body: CreateStatusInput,
  ) {
    return this.svc.create(userId, projectId, body);
  }

  @Patch('statuses/:id')
  update(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
    @ZodBody(updateStatusSchema) body: UpdateStatusInput,
  ) {
    return this.svc.update(userId, id, body);
  }

  @Delete('statuses/:id')
  remove(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
    @Query('targetStatusId') targetStatusId: string,
  ) {
    return this.svc.remove(userId, id, targetStatusId);
  }
}
