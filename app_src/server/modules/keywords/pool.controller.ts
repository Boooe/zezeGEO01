import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Query,
  Param,
  Req,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import type { Request } from 'express';

import { NeedGeoLogin, GeoRoles } from '../auth/auth.decorator';
import { PoolService } from './pool.service';
import {
  PoolListQueryDto,
  AddPoolKeywordDto,
  BatchImportPoolDto,
  BatchMovePoolDto,
  GenerateLongtailDto,
} from './dto/keywords.dto';
import type { UserRole } from '@shared/api.interface';

@Controller('api/keywords/pool')
@NeedGeoLogin()
export class PoolController {
  constructor(private readonly poolService: PoolService) {}

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

  @Get()
  async listPool(@Query() query: PoolListQueryDto, @Req() req: Request) {
    const user = this.getGeoUser(req);
    return this.poolService.listPool(query, user);
  }

  @Post()
  @GeoRoles(['admin', 'operator', 'client'])
  async addKeyword(
    @Body() dto: AddPoolKeywordDto,
    @Req() req: Request,
  ) {
    const user = this.getGeoUser(req);
    const brandId = this.resolveWriteBrandId(dto.brandId, user);
    return this.poolService.addKeyword({ ...dto, brandId }, user);
  }

  @Post('batch')
  @GeoRoles(['admin', 'operator', 'client'])
  async batchImport(
    @Body() dto: BatchImportPoolDto,
    @Req() req: Request,
  ) {
    const user = this.getGeoUser(req);
    const brandId = this.resolveWriteBrandId(dto.brandId, user);
    return this.poolService.batchImport({ ...dto, brandId }, user);
  }

  @Post('generate-longtail')
  @GeoRoles(['admin', 'operator', 'client'])
  async generateLongtail(@Body() dto: GenerateLongtailDto) {
    return this.poolService.generateLongtail(dto);
  }

  @Post(':id/move-to-library')
  @GeoRoles(['admin', 'operator', 'client'])
  async moveToLibrary(
    @Param('id') id: string,
    @Req() req: Request,
  ) {
    const user = this.getGeoUser(req);
    return this.poolService.moveToLibrary(id, user);
  }

  @Post('batch-move')
  @GeoRoles(['admin', 'operator', 'client'])
  async batchMoveToLibrary(
    @Body() dto: BatchMovePoolDto,
    @Req() req: Request,
  ) {
    const user = this.getGeoUser(req);
    return this.poolService.batchMoveToLibrary(dto.ids, user);
  }

  @Delete(':id')
  @GeoRoles(['admin', 'operator', 'client'])
  @HttpCode(HttpStatus.NO_CONTENT)
  async deletePoolItem(
    @Param('id') id: string,
    @Req() req: Request,
  ): Promise<void> {
    const user = this.getGeoUser(req);
    await this.poolService.deletePoolItem(id, user);
  }
}
