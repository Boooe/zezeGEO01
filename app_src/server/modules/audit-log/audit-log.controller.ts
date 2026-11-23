import { Controller, Get, Query, Req } from '@nestjs/common';
import type { Request } from 'express';
import { AuditLogService } from './audit-log.service';
import { NeedGeoLogin, GeoRoles } from '../auth/auth.decorator';
import { OperationLogListQueryDto } from './audit-log.dto';
import type { OperationLogListResponse } from '@shared/api.interface';

@Controller('api/audit-logs')
@NeedGeoLogin()
@GeoRoles(['admin'])
export class AuditLogController {
  constructor(private readonly auditLogService: AuditLogService) {}

  @Get()
  async list(
    @Req() _req: Request,
    @Query() query: OperationLogListQueryDto,
  ): Promise<OperationLogListResponse> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;

    return this.auditLogService.list({
      page,
      pageSize,
      keyword: query.keyword,
      action: query.action,
      role: query.role,
      startDate: query.startDate,
      endDate: query.endDate,
    });
  }
}
