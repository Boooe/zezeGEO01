import {
  Controller,
  Get,
  Put,
  Delete,
  Post,
  Param,
  Body,
  Req,
  Query,
  BadRequestException,
} from '@nestjs/common';
import type { Request } from 'express';

import { NeedGeoLogin, GeoRoles } from '../auth/auth.decorator';
import { AiKeysService } from './ai-keys.service';
import { UpsertAiKeyDto, SetDefaultDto } from './ai-keys.dto';
import {
  AI_VENDORS,
  type AiVendor,
  type AiKeyListResponse,
  type AiKeyItem,
  type AiTestResponse,
} from '@shared/api.interface';

interface GeoUserCtx {
  id: string;
  role: string;
  brandId: string | null;
}

@Controller('api/ai-keys')
@NeedGeoLogin()
@GeoRoles(['admin', 'operator'])
export class AiKeysController {
  constructor(private readonly aiKeysService: AiKeysService) {}

  private getGeoUser(req: Request): GeoUserCtx {
    const user = (req as any).geoUser;
    return {
      id: user.id,
      role: user.role,
      brandId: user.brandId ?? null,
    };
  }

  @Get()
  async listKeys(
    @Req() req: Request,
    @Query('brandId') brandId?: string,
  ): Promise<AiKeyListResponse> {
    return this.aiKeysService.listKeys(this.getGeoUser(req), brandId);
  }

  @Put(':vendor')
  async upsertKey(
    @Param('vendor') vendor: string,
    @Body() dto: UpsertAiKeyDto,
    @Req() req: Request,
    @Query('brandId') brandId?: string,
  ): Promise<AiKeyItem> {
    if (!(AI_VENDORS as readonly string[]).includes(vendor)) {
      throw new BadRequestException('不支持的 AI 厂商');
    }
    return this.aiKeysService.upsertKey(this.getGeoUser(req), vendor as AiVendor, dto, brandId);
  }

  @Delete(':vendor')
  async deleteKey(
    @Param('vendor') vendor: string,
    @Req() req: Request,
    @Query('brandId') brandId?: string,
  ): Promise<{ success: true }> {
    if (!(AI_VENDORS as readonly string[]).includes(vendor)) {
      throw new BadRequestException('不支持的 AI 厂商');
    }
    await this.aiKeysService.deleteKey(this.getGeoUser(req), vendor, brandId);
    return { success: true };
  }

  @Post(':vendor/test')
  async testKey(
    @Param('vendor') vendor: string,
    @Req() req: Request,
    @Query('brandId') brandId?: string,
  ): Promise<AiTestResponse> {
    if (!(AI_VENDORS as readonly string[]).includes(vendor)) {
      throw new BadRequestException('不支持的 AI 厂商');
    }
    return this.aiKeysService.testKey(this.getGeoUser(req), vendor, brandId);
  }

  @Post('default')
  async setDefault(
    @Body() dto: SetDefaultDto,
    @Req() req: Request,
    @Query('brandId') brandId?: string,
  ): Promise<AiKeyListResponse> {
    return this.aiKeysService.setDefault(this.getGeoUser(req), dto.vendor, brandId);
  }
}
