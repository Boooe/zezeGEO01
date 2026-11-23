import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  Req,
  Res,
  BadRequestException,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import {
  IsInt,
  IsOptional,
  IsString,
  IsArray,
  IsNumber,
  Min,
  Max,
  ArrayMaxSize,
  IsIn,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';

import { NeedGeoLogin, GeoRoles } from '@server/modules/auth/auth.decorator';
import { CreditAdminService } from './credit-admin.service';
import type {
  CreditOverviewResponse,
  BatchRechargeResult,
  ConsumptionRankItem,
  MonthlyBillResponse,
  CreditHealthStatus,
} from '@shared/api.interface';

class OverviewQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number;

  @IsOptional()
  @IsString()
  keyword?: string;

  @IsOptional()
  @Transform(({ obj, key }) => (obj[key] === '' ? undefined : obj[key]))
  @IsString()
  @IsIn(['sufficient', 'low', 'critical'])
  healthStatus?: 'sufficient' | 'low' | 'critical';
}

class BatchRechargeDto {
  @IsArray()
  @ArrayMaxSize(500)
  @IsString({ each: true })
  brandIds!: string[];

  @Type(() => Number)
  @IsNumber()
  @Min(1)
  amount!: number;

  @IsOptional()
  @IsString()
  remark?: string;
}

class RankQueryDto {
  @IsOptional()
  @IsString()
  month?: string;
}

class MonthlyBillQueryDto {
  @IsOptional()
  @IsString()
  month?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number;

  @IsOptional()
  @IsString()
  keyword?: string;
}

class ExportBillQueryDto {
  @IsOptional()
  @IsString()
  month?: string;
}

@Controller('api/admin/credit')
@NeedGeoLogin()
export class CreditAdminController {
  constructor(private readonly creditAdminService: CreditAdminService) {}

  @Get('overview')
  @GeoRoles(['admin', 'operator'])
  async overview(
    @Query() query: OverviewQueryDto,
  ): Promise<CreditOverviewResponse> {
    return this.creditAdminService.getOverview(query);
  }

  @Post('batch-recharge')
  @GeoRoles(['admin'])
  async batchRecharge(
    @Body() dto: BatchRechargeDto,
    @Req() req: Request,
  ): Promise<BatchRechargeResult> {
    const ctx = (req as any).geoUser;
    return this.creditAdminService.batchRecharge(
      dto.brandIds,
      dto.amount,
      dto.remark,
      ctx.id,
    );
  }

  @Get('consumption-rank')
  @GeoRoles(['admin', 'operator'])
  async consumptionRank(
    @Query() query: RankQueryDto,
  ): Promise<{ items: ConsumptionRankItem[] }> {
    return this.creditAdminService.getConsumptionRank(query.month);
  }

  @Get('monthly-bill')
  @GeoRoles(['admin', 'operator'])
  async monthlyBill(
    @Query() query: MonthlyBillQueryDto,
  ): Promise<MonthlyBillResponse> {
    return this.creditAdminService.getMonthlyBill(query);
  }

  @Get('monthly-bill/export')
  @GeoRoles(['admin', 'operator'])
  async exportMonthlyBill(
    @Query() query: ExportBillQueryDto,
    @Res() res: Response,
  ): Promise<void> {
    const { filename, content } =
      await this.creditAdminService.exportMonthlyBillCsv(query.month ?? '');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${encodeURIComponent(filename)}"`,
    );
    res.send(content);
  }
}
