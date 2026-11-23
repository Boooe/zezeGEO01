import {
  Controller,
  Post,
  Get,
  Body,
  Req,
  Param,
  ParseIntPipe,
  Query,
} from '@nestjs/common';
import type { Request } from 'express';

import { NeedGeoLogin } from '../auth/auth.decorator';
import { AiKeysService } from './ai-keys.service';
import {
  CreateCreditRequestDto,
  CreditRequestListQueryDto,
  RejectCreditRequestDto,
} from './ai-keys.dto';
import type {
  CreditRequestItem,
  CreditRequestListResponse,
} from '@shared/api.interface';

interface GeoUserCtx {
  id: string;
  role: string;
  brandId: string | null;
}

@Controller('api/credit-requests')
@NeedGeoLogin()
export class CreditRequestsController {
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
  async list(
    @Query() query: CreditRequestListQueryDto,
    @Req() req: Request,
  ): Promise<CreditRequestListResponse> {
    return this.aiKeysService.listCreditRequests(this.getGeoUser(req), {
      status: query.status,
      page: query.page,
      pageSize: query.pageSize,
    });
  }

  @Post()
  async create(
    @Body() dto: CreateCreditRequestDto,
    @Req() req: Request,
  ): Promise<CreditRequestItem> {
    return this.aiKeysService.createCreditRequest(
      this.getGeoUser(req),
      dto.packageType,
      dto.brandId,
    );
  }

  @Post(':id/approve')
  async approve(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: Request,
  ): Promise<CreditRequestItem> {
    return this.aiKeysService.approveCreditRequest(this.getGeoUser(req), id);
  }

  @Post(':id/reject')
  async reject(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: RejectCreditRequestDto,
    @Req() req: Request,
  ): Promise<CreditRequestItem> {
    return this.aiKeysService.rejectCreditRequest(
      this.getGeoUser(req),
      id,
      dto.reason,
    );
  }
}
