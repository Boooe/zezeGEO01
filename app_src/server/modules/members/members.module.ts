import { Module } from '@nestjs/common';

import { MembersController } from './members.controller';
import { MembersService } from './members.service';
import { AuditLogModule } from '../audit-log/audit-log.module';
import { RolesModule } from '../roles/roles.module';

@Module({
  imports: [AuditLogModule, RolesModule],
  controllers: [MembersController],
  providers: [MembersService],
  exports: [MembersService],
})
export class MembersModule {}
