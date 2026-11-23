import { Module } from '@nestjs/common';

import { AutomationController, VideoAutomationController } from './automation.controller';
import { AutomationService } from './automation.service';

@Module({
  controllers: [AutomationController, VideoAutomationController],
  providers: [AutomationService],
  exports: [AutomationService],
})
export class AutomationModule {}
