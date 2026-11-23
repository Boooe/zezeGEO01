import { Module } from '@nestjs/common';

import { PublishQueueController } from './publish-queue.controller';
import { PublishQueueService } from './publish-queue.service';

@Module({
  controllers: [PublishQueueController],
  providers: [PublishQueueService],
})
export class PublishQueueModule {}
