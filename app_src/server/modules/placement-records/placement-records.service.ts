import { Injectable, Inject, Logger } from '@nestjs/common';
import { eq, and, desc, count, gte, lt, inArray } from 'drizzle-orm';
import dayjs from 'dayjs';

import { DRIZZLE_DATABASE, type PostgresJsDatabase } from '@lark-apaas/fullstack-nestjs-core';
import {
  geoPlacementRecords,
  geoMediaOrders,
  geoSubmissionChannels,
} from '@server/database/schema';
import type {
  PlacementRecord,
  PlacementRecordListResponse,
  PlacementStats,
} from '@shared/api.interface';
import { PLACEMENT_INDEX_STATUSES } from '@shared/api.interface';

type OrderRow = typeof geoMediaOrders.$inferSelect;

@Injectable()
export class PlacementRecordsService {
  private readonly logger = new Logger(PlacementRecordsService.name);

  constructor(
    @Inject(DRIZZLE_DATABASE) private readonly db: PostgresJsDatabase,
  ) {}

  // ========== 列表查询 ==========

  async list(params: {
    brandId?: string;
    indexStatus?: string;
    startDate?: string;
    endDate?: string;
    page: number;
    pageSize: number;
  }): Promise<PlacementRecordListResponse> {
    const conditions = [];
    if (params.brandId) {
      conditions.push(eq(geoPlacementRecords.brandId, params.brandId));
    }
    if (params.indexStatus) {
      conditions.push(eq(geoPlacementRecords.indexStatus, params.indexStatus));
    }
    if (params.startDate) {
      conditions.push(gte(geoPlacementRecords.createdAt, new Date(params.startDate)));
    }
    if (params.endDate) {
      const endDay = dayjs(params.endDate).add(1, 'day').toDate();
      conditions.push(lt(geoPlacementRecords.createdAt, endDay));
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const [countResult, rows] = await Promise.all([
      this.db
        .select({ count: count() })
        .from(geoPlacementRecords)
        .where(where),
      this.db
        .select()
        .from(geoPlacementRecords)
        .where(where)
        .orderBy(desc(geoPlacementRecords.createdAt))
        .limit(params.pageSize)
        .offset((params.page - 1) * params.pageSize),
    ]);

    const total = Number(countResult[0]?.count ?? 0);

    const items: PlacementRecord[] = rows.map((row) => ({
      id: row.id,
      orderId: row.orderId,
      orderNo: row.orderNo,
      channelId: row.channelId,
      brandId: row.brandId,
      articleId: row.articleId ?? undefined,
      articleTitle: row.articleTitle ?? undefined,
      mediaName: row.mediaName ?? undefined,
      region: row.region ?? undefined,
      amountCents: row.amountCents,
      publishedUrl: row.publishedUrl ?? undefined,
      publishedAt: row.publishedAt ? row.publishedAt.toISOString() : undefined,
      indexStatus: ((PLACEMENT_INDEX_STATUSES as readonly string[]).includes(row.indexStatus)
        ? row.indexStatus
        : 'pending') as 'pending' | 'indexed' | 'failed',
      createdAt: row.createdAt.toISOString(),
    }));

    return {
      items,
      total,
      page: params.page,
      pageSize: params.pageSize,
    };
  }

  // ========== 统计 ==========

  async stats(brandId?: string): Promise<PlacementStats> {
    const conditions = [];
    if (brandId) {
      conditions.push(eq(geoPlacementRecords.brandId, brandId));
    }
    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const monthStart = dayjs().startOf('month').toDate();
    const monthConditions = [...conditions, gte(geoPlacementRecords.createdAt, monthStart)];
    const monthWhere = and(...monthConditions);

    const [totalResult, indexedResult, pendingResult, thisMonthResult] = await Promise.all([
      this.db.select({ count: count() }).from(geoPlacementRecords).where(where),
      this.db
        .select({ count: count() })
        .from(geoPlacementRecords)
        .where(
          where
            ? and(where, eq(geoPlacementRecords.indexStatus, 'indexed'))
            : eq(geoPlacementRecords.indexStatus, 'indexed'),
        ),
      this.db
        .select({ count: count() })
        .from(geoPlacementRecords)
        .where(
          where
            ? and(where, eq(geoPlacementRecords.indexStatus, 'pending'))
            : eq(geoPlacementRecords.indexStatus, 'pending'),
        ),
      this.db.select({ count: count() }).from(geoPlacementRecords).where(monthWhere),
    ]);

    return {
      total: Number(totalResult[0]?.count ?? 0),
      indexed: Number(indexedResult[0]?.count ?? 0),
      pending: Number(pendingResult[0]?.count ?? 0),
      thisMonth: Number(thisMonthResult[0]?.count ?? 0),
    };
  }

  // ========== 从订单创建投放记录（幂等） ==========

  async createFromOrder(order: OrderRow, channelName: string): Promise<void> {
    // 先查是否已有 (order_id, channel_id)，有则跳过
    const existing = await this.db
      .select({ id: geoPlacementRecords.id })
      .from(geoPlacementRecords)
      .where(
        and(
          eq(geoPlacementRecords.orderId, order.id),
          eq(geoPlacementRecords.channelId, order.channelId),
        ),
      )
      .limit(1);

    if (existing.length > 0) {
      return;
    }

    // 查渠道信息获取 region 和 mediaName
    const [channel] = await this.db
      .select({
        name: geoSubmissionChannels.name,
        region: geoSubmissionChannels.region,
      })
      .from(geoSubmissionChannels)
      .where(eq(geoSubmissionChannels.id, order.channelId))
      .limit(1);

    await this.db.insert(geoPlacementRecords).values({
      orderId: order.id,
      orderNo: order.orderNo,
      channelId: order.channelId,
      brandId: order.brandId,
      articleId: order.articleId ?? undefined,
      articleTitle: order.title,
      mediaName: channel?.name ?? channelName,
      region: channel?.region ?? undefined,
      amountCents: order.priceCents,
      publishedUrl: order.publishedUrl ?? undefined,
      publishedAt: order.status === 'published' ? new Date() : undefined,
      indexStatus: 'pending',
    });
  }

  // ========== 从已支付/已发布订单回填（幂等） ==========

  async backfillFromOrders(): Promise<{ backfilled: number; totalExisting: number }> {
    const statuses: string[] = ['paid', 'placing', 'published'];

    // 查所有已支付/已发布订单
    const orderRows = await this.db
      .select()
      .from(geoMediaOrders)
      .where(inArray(geoMediaOrders.status, statuses));

    // 统计已存在的记录数
    const [existingCount] = await this.db
      .select({ count: count() })
      .from(geoPlacementRecords);

    let backfilled = 0;

    // 逐个创建（幂等，内部会检查是否已存在）
    for (const order of orderRows) {
      const before = await this.db
        .select({ id: geoPlacementRecords.id })
        .from(geoPlacementRecords)
        .where(
          and(
            eq(geoPlacementRecords.orderId, order.id),
            eq(geoPlacementRecords.channelId, order.channelId),
          ),
        )
        .limit(1);

      if (before.length > 0) {
        continue;
      }

      const [channel] = await this.db
        .select({
          name: geoSubmissionChannels.name,
          region: geoSubmissionChannels.region,
        })
        .from(geoSubmissionChannels)
        .where(eq(geoSubmissionChannels.id, order.channelId))
        .limit(1);

      try {
        await this.db.insert(geoPlacementRecords).values({
          orderId: order.id,
          orderNo: order.orderNo,
          channelId: order.channelId,
          brandId: order.brandId,
          articleId: order.articleId ?? undefined,
          articleTitle: order.title,
          mediaName: channel?.name ?? undefined,
          region: channel?.region ?? undefined,
          amountCents: order.priceCents,
          publishedUrl: order.publishedUrl ?? undefined,
          indexStatus: 'pending',
        });
        backfilled += 1;
      } catch (err) {
        this.logger.warn(
          `Backfill placement record failed for order ${order.orderNo}: ${(err as Error).message}`,
        );
      }
    }

    const totalExisting = Number(existingCount[0]?.count ?? 0);

    this.logger.log(
      `Placement records backfill complete: backfilled=${backfilled}, existingBefore=${totalExisting}`,
    );

    return { backfilled, totalExisting };
  }
}
