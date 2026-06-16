import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { searchQuerySchema, type SearchQuery } from '@teamboard/shared';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { SearchService } from './search.service';

@ApiTags('search')
@ApiBearerAuth()
@Controller('workspaces/:workspaceId')
export class SearchController {
  constructor(private readonly svc: SearchService) {}

  @Get('search')
  search(
    @CurrentUser('id') userId: string,
    @Param('workspaceId') workspaceId: string,
    @Query(new ZodValidationPipe(searchQuerySchema)) query: SearchQuery,
  ) {
    return this.svc.search(userId, workspaceId, query.q);
  }
}
