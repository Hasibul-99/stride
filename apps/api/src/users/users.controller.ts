import { Body, Controller, Get, Patch, UsePipes } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { updateMeSchema, type AuthUser } from '@teamboard/shared';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { UsersService } from './users.service';

@ApiTags('users')
@ApiBearerAuth()
@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get('me')
  @ApiOperation({ summary: 'Get the authenticated user' })
  getMe(@CurrentUser('id') userId: string): Promise<AuthUser> {
    return this.users.getMe(userId);
  }

  @Patch('me')
  @UsePipes(new ZodValidationPipe(updateMeSchema))
  @ApiOperation({ summary: 'Update name / avatar / timezone' })
  updateMe(
    @CurrentUser('id') userId: string,
    @Body() body: typeof updateMeSchema._type,
  ): Promise<AuthUser> {
    return this.users.updateMe(userId, body);
  }
}
