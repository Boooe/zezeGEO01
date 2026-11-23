import { Module } from '@nestjs/common';

import { PublishController } from './publish.controller';
import { PublicationController } from './publication.controller';
import { PublishService } from './publish.service';
import { MediaOrdersModule } from '../media-orders/media-orders.module';
import { MediaWalletModule } from '../media-wallet/media-wallet.module';
import { AuditLogModule } from '../audit-log/audit-log.module';

@Module({
  imports: [MediaOrdersModule, MediaWalletModule, AuditLogModule],
  controllers: [PublishController, PublicationController],
  providers: [PublishService],
  exports: [],
})
export class PublicationModule {}
