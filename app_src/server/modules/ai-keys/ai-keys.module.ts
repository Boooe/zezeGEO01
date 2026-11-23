import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';

import { AiKeysController } from './ai-keys.controller';
import { CreditRequestsController } from './credit-requests.controller';
import { AiKeysService } from './ai-keys.service';

@Module({
  imports: [
    HttpModule.register({
      timeout: 60000,
      maxRedirects: 2,
    }),
  ],
  controllers: [AiKeysController, CreditRequestsController],
  providers: [AiKeysService],
  exports: [AiKeysService],
})
export class AiKeysModule {}
