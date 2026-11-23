import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { PublishClientController } from './publish-client.controller';
import { PublishClientService } from './publish-client.service';
import { PublishClientAuthMiddleware } from './publish-client.middleware';

@Module({
  controllers: [PublishClientController],
  providers: [PublishClientService],
})
export class PublishClientModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(PublishClientAuthMiddleware).forRoutes(PublishClientController);
  }
}
