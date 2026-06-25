import { Module, OnModuleInit } from '@nestjs/common';
import { BullModule, InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { OtpService } from './otp.service';
import { OtpMailProcessor } from './otp-mail.processor';
import { OtpCleanupProcessor } from './otp-cleanup.processor';
import { OTP_CLEANUP_QUEUE, OTP_MAIL_QUEUE } from './otp.constants';

@Module({
  imports: [
    BullModule.registerQueue({ name: OTP_MAIL_QUEUE }),
    BullModule.registerQueue({ name: OTP_CLEANUP_QUEUE }),
  ],
  providers: [OtpService, OtpMailProcessor, OtpCleanupProcessor],
  exports: [OtpService],
})
export class OtpModule implements OnModuleInit {
  constructor(@InjectQueue(OTP_CLEANUP_QUEUE) private readonly cleanupQueue: Queue) {}

  async onModuleInit() {
    // Daily at 03:00 — delete unverified users older than 24h + expired OTP rows.
    await this.cleanupQueue.add(
      'cleanup',
      {},
      { repeat: { pattern: '0 3 * * *' }, jobId: 'otp-cleanup-daily', removeOnComplete: true },
    );
  }
}
