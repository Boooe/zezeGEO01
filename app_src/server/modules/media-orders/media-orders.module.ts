import { Module } from '@nestjs/common';

import { MediaOrdersController } from './media-orders.controller';
import { MediaOrdersService } from './media-orders.service';
import { MediaWalletModule } from '../media-wallet/media-wallet.module';
import { PlacementRecordsModule } from '../placement-records/placement-records.module';
import { AuditLogModule } from '../audit-log/audit-log.module';

@Module({
  imports: [MediaWalletModule, PlacementRecordsModule, AuditLogModule],
  controllers: [MediaOrdersController],
  providers: [MediaOrdersService],
  exports: [MediaOrdersService],
})
export class MediaOrdersModule {}
