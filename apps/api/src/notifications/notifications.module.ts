import { Global, Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { NotificationsService } from './notifications.service';
import { NotificationsController } from './notifications.controller';
import { DigestProcessor } from './digest.processor';
import { DIGEST_QUEUE } from './digest.constants';

@Global()
@Module({
  imports: [BullModule.registerQueue({ name: DIGEST_QUEUE })],
  controllers: [NotificationsController],
  providers: [NotificationsService, DigestProcessor],
  exports: [NotificationsService],
})
export class NotificationsModule {}
