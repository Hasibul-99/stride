import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { OtpService } from './otp.service';
import { OTP_CLEANUP_QUEUE } from './otp.constants';

@Processor(OTP_CLEANUP_QUEUE)
export class OtpCleanupProcessor extends WorkerHost {
  private readonly logger = new Logger(OtpCleanupProcessor.name);

  constructor(private readonly otp: OtpService) {
    super();
  }

  async process(): Promise<void> {
    const removed = await this.otp.cleanupStaleUnverified();
    this.logger.log(`Stale-unverified cleanup pass complete (removed ${removed})`);
  }
}
