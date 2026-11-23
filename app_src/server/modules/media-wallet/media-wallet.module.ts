import { Module } from '@nestjs/common';

import { MediaWalletController } from './media-wallet.controller';
import { MediaWalletService } from './media-wallet.service';
import { AuditLogModule } from '../audit-log/audit-log.module';

@Module({
  imports: [AuditLogModule],
  controllers: [MediaWalletController],
  providers: [MediaWalletService],
  exports: [MediaWalletService],
})
export class MediaWalletModule {}
