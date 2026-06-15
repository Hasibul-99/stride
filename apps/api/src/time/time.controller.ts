import { Controller, Delete, Get, Param, Patch, Post, Query, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import {
  manualTimeEntrySchema,
  timeReportQuerySchema,
  updateTimeEntrySchema,
  type ManualTimeEntryInput,
  type TimeReportQuery,
  type UpdateTimeEntryInput,
} from '@teamboard/shared';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ZodBody } from '../common/pipes/zod-body.decorator';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { TimeService } from './time.service';

@ApiTags('time')
@ApiBearerAuth()
@Controller()
export class TimeController {
  constructor(private readonly svc: TimeService) {}

  @Post('tasks/:id/time/start')
  start(@CurrentUser('id') userId: string, @Param('id') id: string) {
    return this.svc.start(userId, id);
  }

  @Post('tasks/:id/time/stop')
  stop(@CurrentUser('id') userId: string, @Param('id') id: string) {
    return this.svc.stop(userId, id);
  }

  @Get('tasks/:id/time')
  list(@CurrentUser('id') userId: string, @Param('id') id: string) {
    return this.svc.listForTask(userId, id);
  }

  @Post('tasks/:id/time')
  addManual(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
    @ZodBody(manualTimeEntrySchema) body: ManualTimeEntryInput,
  ) {
    return this.svc.addManual(userId, id, body);
  }

  @Get('time/running')
  running(@CurrentUser('id') userId: string) {
    return this.svc.running(userId);
  }

  @Patch('time/:entryId')
  update(
    @CurrentUser('id') userId: string,
    @Param('entryId') entryId: string,
    @ZodBody(updateTimeEntrySchema) body: UpdateTimeEntryInput,
  ) {
    return this.svc.updateEntry(userId, entryId, body);
  }

  @Delete('time/:entryId')
  remove(@CurrentUser('id') userId: string, @Param('entryId') entryId: string) {
    return this.svc.deleteEntry(userId, entryId);
  }

  @Get('workspaces/:workspaceId/time-report')
  report(
    @CurrentUser('id') userId: string,
    @Param('workspaceId') workspaceId: string,
    @Query(new ZodValidationPipe(timeReportQuerySchema)) query: TimeReportQuery,
  ) {
    return this.svc.report(userId, workspaceId, query);
  }

  @Get('workspaces/:workspaceId/time-report.csv')
  async reportCsv(
    @CurrentUser('id') userId: string,
    @Param('workspaceId') workspaceId: string,
    @Query(new ZodValidationPipe(timeReportQuerySchema)) query: TimeReportQuery,
    @Res() res: Response,
  ) {
    const csv = await this.svc.reportCsv(userId, workspaceId, query);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="time-report.csv"');
    res.send(csv);
  }
}
