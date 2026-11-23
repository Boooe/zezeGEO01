import { Module } from '@nestjs/common';

import {
  MediaMarketSupplierController,
  MediaMarketChannelController,
  MediaMarketController,
  MediaMarketChannelClientController,
} from './media-market.controller';
import { MediaMarketService } from './media-market.service';

@Module({
  controllers: [
    MediaMarketSupplierController,
    MediaMarketChannelController,
    MediaMarketController,
    MediaMarketChannelClientController,
  ],
  providers: [MediaMarketService],
})
export class MediaMarketModule {}
