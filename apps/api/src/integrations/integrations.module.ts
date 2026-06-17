import { Global, Module, OnModuleInit } from '@nestjs/common';
import { BullModule, InjectQueue, Processor, WorkerHost } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { GoogleCalendarService } from './google-calendar.service';
import { IntegrationsController } from './integrations.controller';

const GCAL_POLL_QUEUE = 'gcal-poll';

@Processor(GCAL_POLL_QUEUE)
class GcalPollProcessor extends WorkerHost {
  constructor(private readonly gcal: GoogleCalendarService) {
    super();
  }
  async process(): Promise<void> {
    await this.gcal.pollAll();
  }
}

@Global()
@Module({
  imports: [BullModule.registerQueue({ name: GCAL_POLL_QUEUE })],
  controllers: [IntegrationsController],
  providers: [GoogleCalendarService, GcalPollProcessor],
  exports: [GoogleCalendarService],
})
export class IntegrationsModule implements OnModuleInit {
  constructor(@InjectQueue(GCAL_POLL_QUEUE) private readonly queue: Queue) {}

  async onModuleInit() {
    // Fallback sync every 15 minutes (push channels handle the rest in real time).
    await this.queue.add(
      'poll',
      {},
      { repeat: { pattern: '*/15 * * * *' }, jobId: 'gcal-poll', removeOnComplete: true },
    );
  }
}
