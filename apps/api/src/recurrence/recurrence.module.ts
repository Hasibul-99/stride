import { Module, OnModuleInit } from '@nestjs/common';
import { BullModule, InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { TasksModule } from '../tasks/tasks.module';
import { EventsModule } from '../events/events.module';
import { TasksService } from '../tasks/tasks.service';
import { EventsService } from '../events/events.service';

export const RECURRENCE_QUEUE = 'recurrence';

@Processor(RECURRENCE_QUEUE)
class RecurrenceProcessor extends WorkerHost {
  private readonly logger = new Logger('RecurrenceProcessor');
  constructor(
    private readonly tasks: TasksService,
    private readonly events: EventsService,
  ) {
    super();
  }
  async process(): Promise<void> {
    await this.tasks.rollingMaterialize();
    await this.events.rollingMaterialize();
    this.logger.log('Rolling recurrence materialization complete');
  }
}

@Module({
  imports: [BullModule.registerQueue({ name: RECURRENCE_QUEUE }), TasksModule, EventsModule],
  providers: [RecurrenceProcessor],
})
export class RecurrenceQueueModule implements OnModuleInit {
  constructor(@InjectQueue(RECURRENCE_QUEUE) private readonly queue: Queue) {}

  async onModuleInit() {
    // Nightly at 02:00 — idempotent generator keeps occurrences rolling 8 weeks ahead.
    await this.queue.add(
      'roll',
      {},
      { repeat: { pattern: '0 2 * * *' }, jobId: 'recurrence-nightly', removeOnComplete: true },
    );
  }
}
