import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';

import { AiKeysModule } from '../ai-keys/ai-keys.module';
import { ContentController } from './content.controller';
import { CreationController } from './creation.controller';
import { MaterialsController } from './materials.controller';
import { ContentService } from './content.service';
import { CreationService } from './creation.service';
import { CapabilityService } from './capability.service';

@Module({
  imports: [
    HttpModule.register({
      timeout: 60000,
      maxRedirects: 3,
    }),
    AiKeysModule,
  ],
  controllers: [ContentController, CreationController, MaterialsController],
  providers: [ContentService, CreationService, CapabilityService],
  exports: [ContentService],
})
export class ContentModule {}
