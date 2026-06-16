import { Controller, Delete, Get, Headers, Post, Query, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { GoogleCalendarService } from './google-calendar.service';

@ApiTags('integrations')
@Controller('integrations/google')
export class IntegrationsController {
  constructor(
    private readonly gcal: GoogleCalendarService,
    private readonly config: ConfigService,
  ) {}

  @ApiBearerAuth()
  @Get('status')
  status(@CurrentUser('id') userId: string) {
    return this.gcal.status(userId);
  }

  @ApiBearerAuth()
  @Get('connect')
  connect(@CurrentUser('id') userId: string) {
    return { url: this.gcal.connectUrl(userId) };
  }

  // Google redirects here after consent (state carries the userId).
  @Public()
  @Get('callback')
  async callback(@Query('code') code: string, @Query('state') state: string, @Res() res: Response) {
    await this.gcal.handleCallback(state, code);
    res.redirect(`${this.config.getOrThrow<string>('FRONTEND_URL')}/app/settings?gcal=connected`);
  }

  @ApiBearerAuth()
  @Post('sync')
  sync(@CurrentUser('id') userId: string) {
    return this.gcal.syncIncremental(userId);
  }

  @ApiBearerAuth()
  @Delete()
  disconnect(@CurrentUser('id') userId: string) {
    return this.gcal.disconnect(userId);
  }

  // Google push-notification channel webhook.
  @Public()
  @Post('webhook')
  async webhook(
    @Headers('x-goog-channel-id') channelId: string,
    @Headers('x-goog-resource-id') resourceId: string,
  ) {
    if (channelId && resourceId) await this.gcal.handleWebhook(channelId, resourceId);
    return { ok: true };
  }
}
