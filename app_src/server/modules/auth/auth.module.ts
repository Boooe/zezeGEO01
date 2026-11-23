import { Module, NestModule, MiddlewareConsumer, RequestMethod } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';

import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { SeedService } from './seed.service';
import { GeoAuthMiddleware } from './auth.middleware';
import { GeoAuthGuard, GeoRolesGuard, GeoPermissionGuard } from './auth.guard';
import { AuditLogModule } from '../audit-log/audit-log.module';

@Module({
  imports: [AuditLogModule],
  controllers: [AuthController],
  providers: [
    AuthService,
    SeedService,
    {
      provide: APP_GUARD,
      useClass: GeoAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: GeoRolesGuard,
    },
    {
      provide: APP_GUARD,
      useClass: GeoPermissionGuard,
    },
  ],
  exports: [AuthService],
})
export class AuthModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer
      .apply(GeoAuthMiddleware)
      .forRoutes({ path: '*api*', method: RequestMethod.ALL });
  }
}
