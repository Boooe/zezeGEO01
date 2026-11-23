import {
  Controller,
  Get,
  Query,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';

import { NeedGeoLogin, GeoRoles } from '../auth/auth.decorator';
import { PlacementRecordsService } from './placement-records.service';
import { PlacementRecordListQueryDto } from './dto/placement-records.dto';
import type { GeoUser } from '@shared/api.interface';

@Controller('api/placement-records')
@NeedGeoLogin()
export class PlacementRecordsController {
  constructor(private readonly service: PlacementRecordsService) {}

  @Get()
  async list(@Req() req: Request, @Query() query: PlacementRecordListQueryDto) {
    const geoUser = (req as any).geoUser as GeoUser;
    const brandId = geoUser.role === 'client' ? geoUser.brandId ?? undefined : query.brandId;
    return this.service.list({
      brandId,
      indexStatus: query.indexStatus,
      startDate: query.startDate,
      endDate: query.endDate,
      page: query.page ?? 1,
      pageSize: query.pageSize ?? 20,
    });
  }

  @Get('stats')
  async getStats(@Req() req: Request, @Query('brandId') brandIdQuery?: string) {
    const geoUser = (req as any).geoUser as GeoUser;
    const brandId = geoUser.role === 'client' ? geoUser.brandId ?? undefined : brandIdQuery;
    return this.service.stats(brandId);
  }
}
