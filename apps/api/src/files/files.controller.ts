import { Controller, Delete, Get, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  confirmUploadSchema,
  presignSchema,
  type ConfirmUploadInput,
  type PresignInput,
} from '@teamboard/shared';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ZodBody } from '../common/pipes/zod-body.decorator';
import { FilesService } from './files.service';

@ApiTags('files')
@ApiBearerAuth()
@Controller()
export class FilesController {
  constructor(private readonly svc: FilesService) {}

  @Post('files/presign')
  presign(@CurrentUser('id') userId: string, @ZodBody(presignSchema) body: PresignInput) {
    return this.svc.presign(userId, body);
  }

  @Post('files/confirm')
  confirm(@CurrentUser('id') userId: string, @ZodBody(confirmUploadSchema) body: ConfirmUploadInput) {
    return this.svc.confirm(userId, body);
  }

  @Get('tasks/:taskId/files')
  listForTask(@CurrentUser('id') userId: string, @Param('taskId') taskId: string) {
    return this.svc.listForTask(userId, taskId);
  }

  @Get('files/:id/download')
  download(@CurrentUser('id') userId: string, @Param('id') id: string) {
    return this.svc.downloadUrl(userId, id);
  }

  @Delete('files/:id')
  remove(@CurrentUser('id') userId: string, @Param('id') id: string) {
    return this.svc.remove(userId, id);
  }
}
