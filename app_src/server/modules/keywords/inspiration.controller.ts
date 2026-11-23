import {
  Controller,
  Post,
  Body,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';

import { NeedGeoLogin, GeoRoles } from '../auth/auth.decorator';
import { InspirationService } from './inspiration.service';
import {
  GenerateInspirationDto,
  AddInspirationToPoolDto,
} from './dto/keywords.dto';
import type { UserRole } from '@shared/api.interface';

@Controller('api/keywords/inspiration')
@NeedGeoLogin()
export class InspirationController {
  constructor(private readonly inspirationService: InspirationService) {}

  private getGeoUser(req: Request): {
    id: string;
    role: UserRole;
    brandId: string | null;
  } {
    const user = (req as any).geoUser;
    return {
      id: user.id,
      role: user.role as UserRole,
      brandId: user.brandId ?? null,
    };
  }

  /**
   * client 角色强制使用自己的 brandId，admin/operator 保持 dto/query 原值。
   */
  private resolveWriteBrandId(
    dtoBrandId: string | undefined,
    user: { role: UserRole; brandId: string | null },
  ): string {
    if (user.role === 'client' && user.brandId) {
      return user.brandId;
    }
    return dtoBrandId ?? '';
  }

  @Post('generate')
  @GeoRoles(['admin', 'operator', 'client'])
  async generate(
    @Body() dto: GenerateInspirationDto,
    @Req() req: Request,
  ) {
    const user = this.getGeoUser(req);
    const brandId = this.resolveWriteBrandId(dto.brandId, user);
    return this.inspirationService.generate({ ...dto, brandId }, user);
  }

  @Post('add-to-pool')
  @GeoRoles(['admin', 'operator', 'client'])
  async addToPool(
    @Body() dto: AddInspirationToPoolDto,
    @Req() req: Request,
  ) {
    const user = this.getGeoUser(req);
    const brandId = this.resolveWriteBrandId(dto.brandId, user);
    return this.inspirationService.addToPool({ ...dto, brandId }, user);
  }
}
