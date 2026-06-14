import { Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  bulkPositionsSchema,
  createTaskSchema,
  taskQuerySchema,
  updateTaskSchema,
  type BulkPositionsInput,
  type CreateTaskInput,
  type TaskQuery,
  type UpdateTaskInput,
} from '@teamboard/shared';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ZodBody } from '../common/pipes/zod-body.decorator';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { TasksService } from './tasks.service';

@ApiTags('tasks')
@ApiBearerAuth()
@Controller()
export class TasksController {
  constructor(private readonly svc: TasksService) {}

  @Get('projects/:projectId/tasks')
  list(
    @CurrentUser('id') userId: string,
    @Param('projectId') projectId: string,
    @Query(new ZodValidationPipe(taskQuerySchema)) query: TaskQuery,
  ) {
    return this.svc.list(userId, projectId, query);
  }

  @Post('projects/:projectId/tasks')
  create(
    @CurrentUser('id') userId: string,
    @Param('projectId') projectId: string,
    @ZodBody(createTaskSchema) body: CreateTaskInput,
  ) {
    return this.svc.create(userId, projectId, body);
  }

  // Bulk drag-and-drop positions (project-scoped for access control).
  @Patch('projects/:projectId/tasks/positions')
  bulkPositions(
    @CurrentUser('id') userId: string,
    @Param('projectId') projectId: string,
    @ZodBody(bulkPositionsSchema) body: BulkPositionsInput,
  ) {
    return this.svc.bulkPositions(userId, projectId, body);
  }

  @Get('tasks/:id')
  get(@CurrentUser('id') userId: string, @Param('id') id: string) {
    return this.svc.get(userId, id);
  }

  @Patch('tasks/:id')
  update(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
    @ZodBody(updateTaskSchema) body: UpdateTaskInput,
  ) {
    return this.svc.update(userId, id, body);
  }

  @Delete('tasks/:id')
  remove(@CurrentUser('id') userId: string, @Param('id') id: string) {
    return this.svc.remove(userId, id);
  }
}
