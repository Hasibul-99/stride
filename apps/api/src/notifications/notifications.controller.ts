import { Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { updateNotifPrefsSchema, type UpdateNotifPrefsInput } from '@teamboard/shared';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ZodBody } from '../common/pipes/zod-body.decorator';
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

  @Get('preferences')
  getPrefs(@CurrentUser('id') userId: string) {
    return this.svc.getPrefs(userId);
  }

  @Patch('preferences')
  updatePrefs(
    @CurrentUser('id') userId: string,
    @ZodBody(updateNotifPrefsSchema) body: UpdateNotifPrefsInput,
  ) {
    return this.svc.updatePrefs(userId, body);
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
