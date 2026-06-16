import { Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  createNoteSchema,
  updateNoteSchema,
  type CreateNoteInput,
  type UpdateNoteInput,
} from '@teamboard/shared';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ZodBody } from '../common/pipes/zod-body.decorator';
import { NotesService } from './notes.service';

@ApiTags('notes')
@ApiBearerAuth()
@Controller()
export class NotesController {
  constructor(private readonly svc: NotesService) {}

  @Get('projects/:projectId/notes')
  list(@CurrentUser('id') userId: string, @Param('projectId') projectId: string) {
    return this.svc.list(userId, projectId);
  }

  @Post('projects/:projectId/notes')
  create(
    @CurrentUser('id') userId: string,
    @Param('projectId') projectId: string,
    @ZodBody(createNoteSchema) body: CreateNoteInput,
  ) {
    return this.svc.create(userId, projectId, body);
  }

  @Patch('notes/:id')
  update(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
    @ZodBody(updateNoteSchema) body: UpdateNoteInput,
  ) {
    return this.svc.update(userId, id, body);
  }

  @Delete('notes/:id')
  remove(@CurrentUser('id') userId: string, @Param('id') id: string) {
    return this.svc.remove(userId, id);
  }
}
