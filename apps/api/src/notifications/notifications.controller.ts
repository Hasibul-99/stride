import { Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { NotificationsService } from './notifications.service';

@ApiTags('notifications')
@ApiBearerAuth()
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly svc: NotificationsService) {}

  @Get()
  list(@CurrentUser('id') userId: string, @Query('cursor') cursor?: string) {
    return this.svc.list(userId, cursor);
  }

  @Get('unread-count')
  unread(@CurrentUser('id') userId: string) {
    return this.svc.unreadCount(userId).then((count) => ({ count }));
  }

  @Post('read-all')
  markAll(@CurrentUser('id') userId: string) {
    return this.svc.markAllRead(userId);
  }

  @Post(':id/read')
  markRead(@CurrentUser('id') userId: string, @Param('id') id: string) {
    return this.svc.markRead(userId, id);
  }
}
