import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { RemindersService } from './reminders.service';
import { RemindersProcessor } from './reminders.processor';
import { REMINDERS_QUEUE } from './reminders.constants';

@Module({
  imports: [BullModule.registerQueue({ name: REMINDERS_QUEUE })],
  providers: [RemindersService, RemindersProcessor],
  exports: [RemindersService],
})
export class RemindersModule {}
