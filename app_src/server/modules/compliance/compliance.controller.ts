import {
  Controller,
  Post,
  Body,
  Req,
} from '@nestjs/common';
import { NeedGeoLogin, GeoRoles } from '../auth/auth.decorator';
import { ComplianceService } from './compliance.service';
import { ComplianceCheckDto } from './dto/compliance.dto';
import type { Request } from 'express';
import type { UserRole } from '@shared/api.interface';

interface GeoUserCtx {
  id: string;
  role: UserRole;
  brandId: string | null;
}

@Controller('api/compliance')
@NeedGeoLogin()
export class ComplianceController {
  constructor(private readonly complianceService: ComplianceService) {}

  private getGeoUser(req: Request): GeoUserCtx {
    const ctx = (req as any).geoUser;
    return {
      id: ctx?.id ?? '',
      role: ctx?.role ?? 'client',
      brandId: ctx?.brandId ?? null,
    };
  }

  @Post('check')
  @GeoRoles(['admin', 'operator', 'client'])
  async check(
    @Body() dto: ComplianceCheckDto,
    @Req() req: Request,
  ) {
    const user = this.getGeoUser(req);
    return this.complianceService.check(dto, user);
  }
}
