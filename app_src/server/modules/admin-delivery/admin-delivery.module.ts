import { Module } from '@nestjs/common';
import { PlansController } from './plans.controller';
import { PlansService } from './plans.service';
import { DeliveryController } from './delivery.controller';
import { DeliveryService } from './delivery.service';
import { CreditAdminController } from './credit-admin.controller';
import { CreditAdminService } from './credit-admin.service';
import { CustomerAdminService } from './customer-admin.service';
import { CustomerAdminController } from './customer-admin.controller';
@Module({
  controllers: [PlansController, DeliveryController, CreditAdminController, CustomerAdminController],
  providers: [PlansService, DeliveryService, CreditAdminService, CustomerAdminService],
  exports: [CustomerAdminService],
})
export class AdminDeliveryModule {}
