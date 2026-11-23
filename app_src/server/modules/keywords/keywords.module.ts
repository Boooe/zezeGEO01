import { Module } from '@nestjs/common';

import { KeywordsController } from './keywords.controller';
import { KeywordsService } from './keywords.service';
import { PoolController } from './pool.controller';
import { PoolService } from './pool.service';
import { InspirationController } from './inspiration.controller';
import { InspirationService } from './inspiration.service';
import { DetectController } from './detect.controller';
import { DetectService } from './detect.service';
import { IndexLogController } from './index-log.controller';
import { IndexLogService } from './index-log.service';

@Module({
  controllers: [KeywordsController, PoolController, InspirationController, DetectController, IndexLogController],
  providers: [KeywordsService, PoolService, InspirationService, DetectService, IndexLogService],
  exports: [KeywordsService, PoolService, InspirationService, DetectService, IndexLogService],
})
export class KeywordsModule {}
