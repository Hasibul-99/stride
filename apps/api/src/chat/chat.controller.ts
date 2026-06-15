import { Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ChatService } from './chat.service';

@ApiTags('chat')
@ApiBearerAuth()
@Controller('tasks/:taskId/chat')
export class ChatController {
  constructor(private readonly svc: ChatService) {}

  @Get()
  history(
    @CurrentUser('id') userId: string,
    @Param('taskId') taskId: string,
    @Query('cursor') cursor?: string,
  ) {
    return this.svc.history(userId, taskId, cursor);
  }

  @Get('unread')
  unread(@CurrentUser('id') userId: string, @Param('taskId') taskId: string) {
    return this.svc.unreadCount(userId, taskId).then((count) => ({ count }));
  }

  @Post('read')
  markRead(@CurrentUser('id') userId: string, @Param('taskId') taskId: string) {
    return this.svc.markRead(userId, taskId);
  }
}
