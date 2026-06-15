import { Controller, Get, Param, Patch, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  setCapacitySchema,
  workloadQuerySchema,
  type SetCapacityInput,
  type WorkloadQuery,
} from '@teamboard/shared';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ZodBody } from '../common/pipes/zod-body.decorator';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { WorkloadService } from './workload.service';

@ApiTags('workload')
@ApiBearerAuth()
@Controller('workspaces/:workspaceId')
export class WorkloadController {
  constructor(private readonly svc: WorkloadService) {}

  @Get('workload')
  workload(
    @CurrentUser('id') userId: string,
    @Param('workspaceId') workspaceId: string,
    @Query(new ZodValidationPipe(workloadQuerySchema)) query: WorkloadQuery,
  ) {
    return this.svc.workload(userId, workspaceId, query.from, query.to);
  }

  @Patch('capacity')
  setCapacity(
    @CurrentUser('id') userId: string,
    @Param('workspaceId') workspaceId: string,
    @ZodBody(setCapacitySchema) body: SetCapacityInput,
  ) {
    return this.svc.setCapacity(userId, workspaceId, body);
  }
}
