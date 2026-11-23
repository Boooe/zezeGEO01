import {
  Injectable,
  Inject,
  Logger,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { DRIZZLE_DATABASE, type PostgresJsDatabase } from '@lark-apaas/fullstack-nestjs-core';
import { eq, and, desc, count } from 'drizzle-orm';

import { geoChannels } from '@server/database/schema';
import type {
  Channel,
  ChannelListResponse,
  ChannelTestResult,
  UserRole,
  ChannelBindStatus,
} from '@shared/api.interface';
import {
  CHANNEL_BIND_STATUS_LABELS,
} from '@shared/api.interface';
import {
  ChannelListQueryDto,
  CreateChannelDto,
  UpdateChannelDto,
} from './dto/channels.dto';

interface GeoUserCtx {
  id: string;
  role: UserRole;
  brandId: string | null;
}

@Injectable()
export class ChannelsService {
  private readonly logger = new Logger(ChannelsService.name);

  constructor(
    @Inject(DRIZZLE_DATABASE) private readonly db: PostgresJsDatabase,
  ) {}

  // ---------- 列表 ----------

  async list(
    query: ChannelListQueryDto,
    user: GeoUserCtx,
  ): Promise<ChannelListResponse> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;

    const conditions = this.buildWhere(query, user);

    const baseQuery = this.db.select().from(geoChannels);
    const dataQuery = conditions.length > 0
      ? baseQuery.where(and(...conditions))
      : baseQuery;

    const [itemsRaw, totalResult] = await Promise.all([
      dataQuery
        .orderBy(desc(geoChannels.createdAt))
        .limit(pageSize)
        .offset((page - 1) * pageSize),
      this.db
        .select({ count: count() })
        .from(geoChannels)
        .where(conditions.length > 0 ? and(...conditions) : undefined),
    ]);

    const items: Channel[] = itemsRaw.map((row) => this.toChannel(row));

    return {
      items,
      total: Number(totalResult[0]?.count ?? 0),
      page,
      pageSize,
    };
  }

  // ---------- 新增 ----------

  async create(
    dto: CreateChannelDto,
    user: GeoUserCtx,
  ): Promise<Channel> {
    if (user.role === 'client' && user.brandId !== dto.brandId) {
      throw new ForbiddenException('无权为其他品牌创建渠道');
    }

    const inserted = await this.db
      .insert(geoChannels)
      .values({
        brandId: dto.brandId,
        platform: dto.platform,
        accountName: dto.accountName,
        publishMode: dto.publishMode,
        dailyLimit: dto.dailyLimit,
        remark: dto.remark ?? null,
      })
      .returning();

    return this.toChannel(inserted[0]);
  }

  // ---------- 更新 ----------

  async update(
    id: string,
    dto: UpdateChannelDto,
    user: GeoUserCtx,
  ): Promise<Channel> {
    const existing = await this.findOrThrow(id);
    this.ensureBrandAccess(existing.brandId, user);

    const patch: Partial<typeof geoChannels.$inferInsert> = {};
    if (dto.status !== undefined) patch.status = dto.status;
    if (dto.dailyLimit !== undefined) patch.dailyLimit = dto.dailyLimit;
    if (dto.remark !== undefined) patch.remark = dto.remark;
    if (dto.accountName !== undefined) patch.accountName = dto.accountName;

    if (Object.keys(patch).length === 0) {
      throw new BadRequestException('未提供可更新字段');
    }

    const updated = await this.db
      .update(geoChannels)
      .set(patch)
      .where(eq(geoChannels.id, id))
      .returning();

    if (updated.length === 0) {
      throw new NotFoundException('渠道不存在');
    }

    return this.toChannel(updated[0]);
  }

  // ---------- 删除 ----------

  async remove(id: string, user: GeoUserCtx): Promise<void> {
    const existing = await this.findOrThrow(id);
    this.ensureBrandAccess(existing.brandId, user);

    const deleted = await this.db
      .delete(geoChannels)
      .where(eq(geoChannels.id, id))
      .returning({ id: geoChannels.id });

    if (deleted.length === 0) {
      throw new NotFoundException('渠道不存在');
    }
  }

  // ---------- 测试连接 ----------

  async test(id: string, user: GeoUserCtx): Promise<ChannelTestResult> {
    const existing = await this.findOrThrow(id);
    this.ensureBrandAccess(existing.brandId, user);

    const bindStatus = existing.bindStatus as ChannelBindStatus;

    if (bindStatus === 'bound') {
      return {
        ok: true,
        bindStatus,
      };
    }

    return {
      ok: false,
      bindStatus,
      message: CHANNEL_BIND_STATUS_LABELS[bindStatus],
    };
  }

  // ---------- 内部方法 ----------

  private buildWhere(
    query: ChannelListQueryDto,
    user: GeoUserCtx,
  ): Array<ReturnType<typeof eq>> {
    const conditions: Array<ReturnType<typeof eq>> = [];

    if (user.role === 'client') {
      if (user.brandId) {
        conditions.push(eq(geoChannels.brandId, user.brandId));
      } else {
        // client 无品牌则看不到任何数据
        conditions.push(eq(geoChannels.brandId, '' as unknown as string));
      }
    } else if (query.brandId) {
      conditions.push(eq(geoChannels.brandId, query.brandId));
    }

    if (query.platform) {
      conditions.push(eq(geoChannels.platform, query.platform));
    }
    if (query.status) {
      conditions.push(eq(geoChannels.status, query.status));
    }

    return conditions;
  }

  private async findOrThrow(id: string): Promise<typeof geoChannels.$inferSelect> {
    const rows = await this.db
      .select()
      .from(geoChannels)
      .where(eq(geoChannels.id, id));

    if (rows.length === 0) {
      throw new NotFoundException('渠道不存在');
    }

    return rows[0];
  }

  private ensureBrandAccess(brandId: string, user: GeoUserCtx): void {
    if (user.role === 'client' && user.brandId !== brandId) {
      throw new ForbiddenException('无权访问其他品牌数据');
    }
  }

  private toChannel(row: typeof geoChannels.$inferSelect): Channel {
    return {
      id: row.id,
      brandId: row.brandId,
      platform: row.platform as Channel['platform'],
      accountName: row.accountName,
      publishMode: row.publishMode as Channel['publishMode'],
      dailyLimit: row.dailyLimit,
      todayPublished: row.todayPublished,
      bindStatus: row.bindStatus as Channel['bindStatus'],
      status: row.status as Channel['status'],
      lastPublishedAt: row.lastPublishedAt
        ? new Date(row.lastPublishedAt).toISOString()
        : null,
      remark: row.remark,
      createdAt: new Date(row.createdAt).toISOString(),
      updatedAt: new Date(row.updatedAt).toISOString(),
    };
  }
}
