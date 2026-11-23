import { Controller, Get, Req, Query, Param } from '@nestjs/common';
import type { Request } from 'express';

import { BrandsService } from './brands.service';
import { NeedGeoLogin } from '../auth/auth.decorator';

@Controller('api/brands')
@NeedGeoLogin()
export class BrandsController {
  constructor(private readonly brandsService: BrandsService) {}

  @Get('options')
  async getOptions(@Req() req: Request, @Query() query: Record<string, string>) {
    const geoUser = (req as any).geoUser;
    const includeDemo = query.includeDemo === 'true';
    const items = await this.brandsService.listOptions(geoUser, includeDemo);
    return { items };
  }

  @Get(':id/readiness')
  async getReadiness(@Param('id') id: string) {
    return this.brandsService.getReadiness(id);
  }
}
