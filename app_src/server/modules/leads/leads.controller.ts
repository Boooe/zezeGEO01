import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  Req,
  ParseUUIDPipe,
} from '@nestjs/common';
import type { Request } from 'express';

import { NeedGeoLogin, GeoRoles } from '../auth/auth.decorator';
import { LeadsService } from './leads.service';
import { CreateLeadDto } from './dto/create-lead.dto';
import { UpdateLeadDto } from './dto/update-lead.dto';
import { LeadsQueryDto } from './dto/leads-query.dto';
import { CreateFollowupDto } from './dto/create-followup.dto';
import { ConvertLeadDto } from './dto/convert-lead.dto';

interface GeoUserCtx {
  id: string;
  username: string;
  role: string;
  brandId: string | null;
}

@Controller('api/leads')
@NeedGeoLogin()
export class LeadsController {
  constructor(private readonly leadsService: LeadsService) {}

  /**
   * 线索统计（各阶段数量）
   */
  @Get('stats')
  async getStats(
    @Req() req: Request,
    @Query('includeDemo') includeDemo?: string,
  ) {
    const geoUser = (req as any).geoUser as GeoUserCtx;
    return this.leadsService.getStats(geoUser, includeDemo === 'true');
  }

  /**
   * 线索列表
   */
  @Get()
  async getLeads(@Req() req: Request, @Query() query: LeadsQueryDto) {
    const geoUser = (req as any).geoUser as GeoUserCtx;
    return this.leadsService.getLeads(query, geoUser);
  }

  /**
   * 线索详情
   */
  @Get(':id')
  async getLeadDetail(
    @Req() req: Request,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const geoUser = (req as any).geoUser as GeoUserCtx;
    return this.leadsService.getLeadDetail(id, geoUser);
  }

  /**
   * 新增线索
   */
  @Post()
  @GeoRoles(['admin', 'operator'])
  async createLead(@Req() req: Request, @Body() dto: CreateLeadDto) {
    const geoUser = (req as any).geoUser as GeoUserCtx;
    return this.leadsService.createLead(dto, geoUser);
  }

  /**
   * 编辑线索
   */
  @Patch(':id')
  @GeoRoles(['admin', 'operator'])
  async updateLead(
    @Req() req: Request,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateLeadDto,
  ) {
    const geoUser = (req as any).geoUser as GeoUserCtx;
    await this.leadsService.updateLead(id, dto, geoUser);
    return { success: true };
  }

  /**
   * 删除线索
   */
  @Delete(':id')
  @GeoRoles(['admin'])
  async deleteLead(
    @Req() req: Request,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const geoUser = (req as any).geoUser as GeoUserCtx;
    await this.leadsService.deleteLead(id, geoUser);
    return { success: true };
  }

  /**
   * 新增跟进记录
   */
  @Post(':id/followups')
  async addFollowup(
    @Req() req: Request,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateFollowupDto,
  ) {
    const geoUser = (req as any).geoUser as GeoUserCtx;
    return this.leadsService.addFollowup(id, dto, geoUser);
  }

  /**
   * 线索转客户
   */
  @Post(':id/convert')
  @GeoRoles(['admin', 'operator'])
  async convertLead(
    @Req() req: Request,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ConvertLeadDto,
  ) {
    const geoUser = (req as any).geoUser as GeoUserCtx;
    return this.leadsService.convertLead(id, dto, geoUser);
  }
}
