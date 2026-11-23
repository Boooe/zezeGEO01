import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';

import { NeedGeoLogin } from '../auth/auth.decorator';
import { IndexLogService } from './index-log.service';
import {
  CreateKeywordIndexLogDto,
  KeywordIndexListQueryDto,
  BatchQueryDto,
} from './dto/index-log.dto';
import type {
  KeywordIndexLogResponse,
  KeywordIndexBatchResponse,
  KeywordIndexListResponse,
  UserRole,
} from '@shared/api.interface';

@Controller('api/keywords/index-logs')
@NeedGeoLogin()
export class IndexLogController {
  constructor(private readonly indexLogService: IndexLogService) {}

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

  @Post()
  async createLog(
    @Body() dto: CreateKeywordIndexLogDto,
    @Req() req: Request,
  ): Promise<KeywordIndexLogResponse> {
    const user = this.getGeoUser(req);
    const log = await this.indexLogService.create(dto, user.id);
    return { success: true, data: log };
  }

  @Get()
  async listLogs(
    @Query() query: KeywordIndexListQueryDto,
  ): Promise<KeywordIndexListResponse> {
    const logs = await this.indexLogService.listByKeyword(query.keywordId);
    return { success: true, data: logs };
  }

  @Post('latest')
  async getLatestBatch(
    @Body() dto: BatchQueryDto,
  ): Promise<KeywordIndexBatchResponse> {
    const data = await this.indexLogService.getLatestByKeywordIds(
      dto.keywordIds,
    );
    return { success: true, data };
  }
}
