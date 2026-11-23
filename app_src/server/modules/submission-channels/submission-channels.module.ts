import { Module } from '@nestjs/common';

import { SubmissionChannelsController } from './submission-channels.controller';
import { SubmissionChannelsService } from './submission-channels.service';
import { AuditLogModule } from '../audit-log/audit-log.module';

@Module({
  imports: [AuditLogModule],
  controllers: [SubmissionChannelsController],
  providers: [SubmissionChannelsService],
  exports: [],
})
export class SubmissionChannelsModule {}
