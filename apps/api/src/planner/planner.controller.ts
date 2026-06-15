import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { PlannerService } from './planner.service';

@ApiTags('planner')
@ApiBearerAuth()
@Controller('workspaces/:workspaceId')
export class PlannerController {
  constructor(private readonly svc: PlannerService) {}

  @Get('planner')
  planner(
    @CurrentUser('id') userId: string,
    @Param('workspaceId') workspaceId: string,
    @Query('from') from: string,
    @Query('to') to: string,
    @Query('assigneeId') assigneeId?: string,
  ) {
    return this.svc.planner(userId, workspaceId, from, to, assigneeId);
  }

  @Get('planner-members')
  members(@CurrentUser('id') userId: string, @Param('workspaceId') workspaceId: string) {
    return this.svc.members(userId, workspaceId);
  }
}
