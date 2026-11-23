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
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Request, Response } from 'express';

import { NeedGeoLogin, GeoRoles } from '../auth/auth.decorator';
import { GeoAuthGuard, GeoRolesGuard } from '../auth/auth.guard';
import { ReportsService } from './reports.service';
import { QueryReportDto } from './dto/query-report.dto';
import { CreateReportDto } from './dto/create-report.dto';
import { UpdateReportDto } from './dto/update-report.dto';

interface GeoUserCtx {
  id: string;
  username: string;
  role: string;
  brandId: string | null;
}

function getGeoUser(req: Request): GeoUserCtx {
  return (req as any).geoUser as GeoUserCtx;
}

@Controller('api/reports')
@NeedGeoLogin()
@UseGuards(GeoAuthGuard, GeoRolesGuard)
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get()
  async findAll(@Req() req: Request, @Query() query: QueryReportDto) {
    const user = getGeoUser(req);
    return this.reportsService.findAll(query, user);
  }

  @Get(':id/export-pdf')
  async exportPdf(
    @Req() req: Request,
    @Param('id') id: string,
    @Res() res: Response,
  ) {
    const user = getGeoUser(req);
    const result = await this.reportsService.exportPdf(id, user);
    const encodedName = encodeURIComponent(result.fileName);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${encodedName}"; filename*=UTF-8''${encodedName}`,
    );
    res.setHeader('Content-Length', String(result.buffer.length));
    res.end(result.buffer);
  }

  @Get(':id')
  async findOne(@Req() req: Request, @Param('id') id: string) {
    const user = getGeoUser(req);
    return this.reportsService.findOne(id, user);
  }

  @Post()
  @GeoRoles(['admin', 'operator'])
  async upsert(@Body() dto: CreateReportDto) {
    return this.reportsService.upsert(dto);
  }

  @Patch(':id')
  @GeoRoles(['admin', 'operator'])
  async update(@Req() req: Request, @Param('id') id: string, @Body() dto: UpdateReportDto) {
    const user = getGeoUser(req);
    return this.reportsService.update(id, dto, user);
  }

  @Post(':id/send')
  @GeoRoles(['admin', 'operator'])
  async send(@Req() req: Request, @Param('id') id: string) {
    const user = getGeoUser(req);
    return this.reportsService.markSent(id, user);
  }

  @Delete(':id')
  @GeoRoles(['admin'])
  async delete(@Param('id') id: string) {
    await this.reportsService.delete(id);
    return { success: true };
  }
}
