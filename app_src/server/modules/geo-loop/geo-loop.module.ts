import { Module } from '@nestjs/common';
import { GeoLoopController } from './geo-loop.controller';
import { GeoLoopService } from './geo-loop.service';

@Module({
  controllers: [GeoLoopController],
  providers: [GeoLoopService],
})
export class GeoLoopModule {}
