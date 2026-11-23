import { Module } from '@nestjs/common';

import { AccountAuthsController } from './account-auths.controller';
import { AccountAuthsService } from './account-auths.service';

@Module({
  controllers: [AccountAuthsController],
  providers: [AccountAuthsService],
})
export class AccountAuthsModule {}
