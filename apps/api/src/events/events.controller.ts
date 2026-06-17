import { Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  createEventSchema,
  eventQuerySchema,
  rsvpSchema,
  updateEventSchema,
  type CreateEventInput,
  type EventQuery,
  type RsvpInput,
  type UpdateEventInput,
} from '@teamboard/shared';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { ZodBody } from '../common/pipes/zod-body.decorator';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { EventsService } from './events.service';

@ApiTags('events')
@ApiBearerAuth()
@Controller('events')
export class EventsController {
  constructor(private readonly svc: EventsService) {}

  @Get()
  list(
    @CurrentUser('id') userId: string,
    @Query(new ZodValidationPipe(eventQuerySchema)) query: EventQuery,
  ) {
    return this.svc.list(userId, query);
  }

  @Post()
  create(@CurrentUser('id') userId: string, @ZodBody(createEventSchema) body: CreateEventInput) {
    return this.svc.create(userId, body);
  }

  // RSVP via signed link in invite email — no auth required.
  @Public()
  @Post('rsvp')
  rsvp(@ZodBody(rsvpSchema) body: RsvpInput) {
    return this.svc.rsvp(body);
  }

  @Get(':id')
  get(@CurrentUser('id') userId: string, @Param('id') id: string) {
    return this.svc.get(userId, id);
  }

  @Patch(':id')
  update(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
    @ZodBody(updateEventSchema) body: UpdateEventInput,
  ) {
    return this.svc.update(userId, id, body);
  }

  @Delete(':id')
  remove(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
    @Query('scope') scope?: 'THIS' | 'THIS_AND_FOLLOWING' | 'ALL',
  ) {
    return this.svc.removeRecurring(userId, id, scope ?? 'THIS');
  }
}
