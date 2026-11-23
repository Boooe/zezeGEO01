import { Module, OnModuleInit, Logger } from '@nestjs/common';

import { PlacementRecordsController } from './placement-records.controller';
import { PlacementRecordsService } from './placement-records.service';

@Module({
  controllers: [PlacementRecordsController],
  providers: [PlacementRecordsService],
  exports: [PlacementRecordsService],
})
export class PlacementRecordsModule implements OnModuleInit {
  private readonly logger = new Logger(PlacementRecordsModule.name);

  constructor(private readonly placementRecordsService: PlacementRecordsService) {}

  onModuleInit(): void {
    // 启动时异步回填历史订单投放记录，不阻塞启动
    void Promise.resolve()
      .then(async () => {
        await new Promise((resolve: (value: void) => void) => setTimeout(resolve, 5000));
        return this.placementRecordsService.backfillFromOrders();
      })
      .then((result) => {
        this.logger.log(
          `Backfill placement records done: backfilled=${result.backfilled}, existing=${result.totalExisting}`,
        );
      })
      .catch((err: unknown) => {
        this.logger.error(
          'Backfill placement records failed:',
          err instanceof Error ? err.stack : String(err),
        );
      });
  }
}
