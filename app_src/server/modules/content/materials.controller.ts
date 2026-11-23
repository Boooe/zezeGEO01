import {
  Controller,
  Get,
  Post,
  Patch,
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
import { ContentService } from './content.service';
import {
  MaterialListQueryDto,
  MaterialGroupListQueryDto,
  CreateMaterialGroupDto,
  UpdateMaterialDto,
  BatchDeleteMaterialsDto,
  RecordMaterialDto,
} from './dto/content.dto';
import type { UserRole } from '@shared/api.interface';

@Controller('api/materials')
@NeedGeoLogin()
export class MaterialsController {
  constructor(private readonly contentService: ContentService) {}

  private getGeoUser(
    req: Request,
  ): { id: string; role: UserRole; brandId: string | null } {
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
    dtoBrandId: string | undefined | null,
    user: { role: UserRole; brandId: string | null },
  ): string | undefined {
    if (user.role === 'client' && user.brandId) {
      return user.brandId;
    }
    return dtoBrandId ?? undefined;
  }

  // ============================================================
  //  素材列表
  // ============================================================

  @Get()
  async listMaterials(
    @Query() query: MaterialListQueryDto,
    @Req() req: Request,
  ) {
    const user = this.getGeoUser(req);
    return this.contentService.listMaterials(query, user);
  }

  // ============================================================
  //  容量使用统计
  // ============================================================

  @Get('usage')
  async getMaterialUsage(
    @Query('brandId') brandId: string,
    @Req() req: Request,
  ) {
    const user = this.getGeoUser(req);
    return this.contentService.getMaterialUsage(brandId, user);
  }

  // ============================================================
  //  分组列表（支持 materialType 筛选）
  // ============================================================

  @Get('groups')
  async listMaterialGroups(
    @Query() query: MaterialGroupListQueryDto,
    @Req() req: Request,
  ) {
    const user = this.getGeoUser(req);
    return this.contentService.listMaterialGroupsByQuery(query, user);
  }

  // ============================================================
  //  新建分组
  // ============================================================

  @Post('groups')
  @GeoRoles(['admin', 'operator', 'client'])
  async createMaterialGroup(
    @Body() dto: CreateMaterialGroupDto,
    @Req() req: Request,
  ) {
    const user = this.getGeoUser(req);
    const brandId = this.resolveWriteBrandId(dto.brandId, user);
    return this.contentService.createMaterialGroup(
      { ...dto, brandId: brandId ?? undefined },
      user,
    );
  }

  // ============================================================
  //  批量删除
  // ============================================================

  @Post('batch-delete')
  @GeoRoles(['admin', 'operator', 'client'])
  @HttpCode(HttpStatus.OK)
  async batchDeleteMaterials(
    @Body() dto: BatchDeleteMaterialsDto,
    @Req() req: Request,
  ) {
    const user = this.getGeoUser(req);
    return this.contentService.batchDeleteMaterials(dto, user);
  }

  // ============================================================
  //  记录上传素材（dataloom 上传后写库）
  // ============================================================

  @Post('record')
  @GeoRoles(['admin', 'operator', 'client'])
  async recordMaterial(
    @Body() dto: RecordMaterialDto,
    @Req() req: Request,
  ) {
    const user = this.getGeoUser(req);
    const brandId = this.resolveWriteBrandId(dto.brandId, user);
    return this.contentService.recordMaterial(
      { ...dto, brandId: brandId ?? undefined },
      user,
    );
  }

  // ============================================================
  //  素材详情
  // ============================================================

  @Get(':id')
  async getMaterial(
    @Param('id') id: string,
    @Req() req: Request,
  ) {
    const user = this.getGeoUser(req);
    return this.contentService.getMaterialDetail(id, user);
  }

  // ============================================================
  //  重命名 / 移动分组
  // ============================================================

  @Patch(':id')
  @GeoRoles(['admin', 'operator', 'client'])
  async updateMaterial(
    @Param('id') id: string,
    @Body() dto: UpdateMaterialDto,
    @Req() req: Request,
  ) {
    const user = this.getGeoUser(req);
    return this.contentService.updateMaterial(id, dto, user);
  }

  // ============================================================
  //  删除单个素材
  // ============================================================

  @Delete(':id')
  @GeoRoles(['admin', 'operator', 'client'])
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteMaterial(
    @Param('id') id: string,
    @Req() req: Request,
  ): Promise<void> {
    const user = this.getGeoUser(req);
    await this.contentService.deleteMaterial(id, user);
  }
}
