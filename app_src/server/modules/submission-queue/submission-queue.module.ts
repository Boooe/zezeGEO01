import { Module } from '@nestjs/common';

import { SubmissionQueueController } from './submission-queue.controller';
import { SubmissionQueueService } from './submission-queue.service';

@Module({
  controllers: [SubmissionQueueController],
  providers: [SubmissionQueueService],
})
export class SubmissionQueueModule {}
