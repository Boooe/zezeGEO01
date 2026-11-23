import {
  Injectable,
  Inject,
  Logger,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { DRIZZLE_DATABASE, type PostgresJsDatabase } from '@lark-apaas/fullstack-nestjs-core';
import { randomBytes } from 'crypto';
import { eq, and, ilike, desc, count, inArray, sql } from 'drizzle-orm';

import {
  geoPublishRecords,
  geoAutoPublishTasks,
  geoArticles,
  geoUsers,
  geoPublishQueue,
  geoBrands,
  geoSubmissionChannels,
  geoMediaOrders,
} from '@server/database/schema';
import { MediaOrdersService } from '@server/modules/media-orders/media-orders.service';
import { MediaWalletService } from '@server/modules/media-wallet/media-wallet.service';
import type {
  PublishRecord,
  PagedResponse,
  UserRole,
  AutoPublishTask,
  AutoPublishLibrary,
  AutoPublishStatus,
  PaginatedResponse,
} from '@shared/api.interface';
import {
  PublishRecordListQueryDto,
  CreatePublishRecordDto,
  UpdatePublishRecordDto,
  AutoPublishTaskListQueryDto,
  CreateAutoPublishTaskDto,
  UpdateAutoPublishTaskDto,
} from './dto/publish.dto';

interface GeoUserCtx {
  id: string;
  role: UserRole;
  brandId: string | null;
}

@Injectable()
export class PublishService {
  private readonly logger = new Logger(PublishService.name);

  constructor(
    @Inject(DRIZZLE_DATABASE) private readonly db: PostgresJsDatabase,
    private readonly mediaOrdersService: MediaOrdersService,
    private readonly walletService: MediaWalletService,
  ) {}

  // ---------- 列表 ----------

  async listRecords(
    query: PublishRecordListQueryDto,
    user: GeoUserCtx,
  ): Promise<PagedResponse<PublishRecord>> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;

    const whereClauses = this.buildWhereSql(query, user);
    const whereSql = whereClauses.length > 0
      ? sql`WHERE ${sql.join(whereClauses, sql` AND `)}`
      : sql``;

    const [listResult, totalResult] = await Promise.all([
      this.db.execute(sql`
        WITH ranked AS (
          SELECT id,
            ROW_NUMBER() OVER (
              PARTITION BY brand_id, regexp_replace(COALESCE(title, ''), '[^a-zA-Z0-9一-龥]', '', 'g')
              ORDER BY _created_at ASC
            ) as rn
          FROM geo_publish_records
        )
        SELECT pr.*, (r.rn > 1) as is_duplicate
        FROM geo_publish_records pr
        JOIN ranked r ON pr.id = r.id
        ${whereSql}
        ORDER BY pr._created_at DESC
        LIMIT ${pageSize} OFFSET ${(page - 1) * pageSize}
      `) as Promise<Array<{
        id: string;
        brand_id: string;
        task_id: string | null;
        content_type: string;
        title: string | null;
        external_url: string | null;
        platform: string | null;
        status: string;
        publish_date: string | null;
        notes: string | null;
        creator_id: string;
        _created_at: string;
        is_duplicate: boolean;
      }>>,
      this.db.execute(sql`
        SELECT COUNT(*) as total FROM geo_publish_records pr ${whereSql}
      `) as Promise<Array<{ total: string }>>,
    ]);

    const items: PublishRecord[] = listResult.map((row) => ({
      id: row.id,
      brandId: row.brand_id,
      taskId: row.task_id,
      contentType: row.content_type,
      title: row.title,
      externalUrl: row.external_url,
      platform: row.platform,
      status: row.status as PublishRecord['status'],
      publishDate: row.publish_date
        ? new Date(row.publish_date).toISOString()
        : null,
      notes: row.notes,
      creatorId: row.creator_id,
      createdAt: new Date(row._created_at).toISOString(),
      isDuplicate: row.is_duplicate,
    }));

    return {
      items,
      total: Number(totalResult[0]?.total ?? 0),
      page,
      pageSize,
    };
  }

  // ---------- 详情 ----------

  async getRecord(id: string, user: GeoUserCtx): Promise<PublishRecord> {
    const rows = await this.db
      .select()
      .from(geoPublishRecords)
      .where(eq(geoPublishRecords.id, id));

    if (rows.length === 0) {
      throw new NotFoundException('发布记录不存在');
    }

    const record = rows[0];
    this.ensureBrandAccess(record.brandId, user);

    return this.toRecord(record);
  }

  // ---------- 新增 ----------

  async createRecord(
    dto: CreatePublishRecordDto,
    user: GeoUserCtx,
  ): Promise<PublishRecord> {
    // client 只能给自己品牌加
    if (user.role === 'client' && user.brandId !== dto.brandId) {
      throw new ForbiddenException('无权为其他品牌创建发布记录');
    }

    const inserted = await this.db
      .insert(geoPublishRecords)
      .values({
        brandId: dto.brandId,
        taskId: dto.taskId ?? null,
        contentType: dto.contentType,
        title: dto.title ?? null,
        externalUrl: dto.externalUrl ?? null,
        platform: dto.platform ?? null,
        status: dto.status ?? 'pending',
        publishDate: dto.publishDate ?? null,
        notes: dto.notes ?? null,
        creatorId: user.id,
      })
      .returning();

    return this.toRecord(inserted[0]);
  }

  // ---------- 更新 ----------

  async updateRecord(
    id: string,
    dto: UpdatePublishRecordDto,
    user: GeoUserCtx,
  ): Promise<PublishRecord> {
    const existing = await this.findOrThrow(id);
    this.ensureBrandAccess(existing.brandId, user);

    const patch: Partial<typeof geoPublishRecords.$inferInsert> = {};
    if (dto.status !== undefined) patch.status = dto.status;
    if (dto.externalUrl !== undefined) patch.externalUrl = dto.externalUrl;
    if (dto.platform !== undefined) patch.platform = dto.platform;
    if (dto.publishDate !== undefined) {
      patch.publishDate = dto.publishDate;
    }
    if (dto.notes !== undefined) patch.notes = dto.notes;
    if (dto.title !== undefined) patch.title = dto.title;

    if (Object.keys(patch).length === 0) {
      throw new BadRequestException('未提供可更新字段');
    }

    const updated = await this.db
      .update(geoPublishRecords)
      .set(patch)
      .where(eq(geoPublishRecords.id, id))
      .returning();

    if (updated.length === 0) {
      throw new NotFoundException('发布记录不存在');
    }

    return this.toRecord(updated[0]);
  }

  // ---------- 删除 ----------

  async deleteRecord(id: string, user: GeoUserCtx): Promise<void> {
    const existing = await this.findOrThrow(id);
    this.ensureBrandAccess(existing.brandId, user);

    const deleted = await this.db
      .delete(geoPublishRecords)
      .where(eq(geoPublishRecords.id, id))
      .returning({ id: geoPublishRecords.id });

    if (deleted.length === 0) {
      throw new NotFoundException('发布记录不存在');
    }
  }

  // ---------- 回收外链 ----------

  async recycleRecord(id: string, user: GeoUserCtx): Promise<PublishRecord> {
    const existing = await this.findOrThrow(id);
    this.ensureBrandAccess(existing.brandId, user);

    const updated = await this.db
      .update(geoPublishRecords)
      .set({
        status: 'archived',
        externalUrl: null,
      })
      .where(eq(geoPublishRecords.id, existing.id))
      .returning();

    return this.toRecord(updated[0]);
  }

  // ---------- 按任务查 ----------

  async getRecordsByTask(
    taskId: string,
    user: GeoUserCtx,
  ): Promise<PublishRecord[]> {
    const conditions = [eq(geoPublishRecords.taskId, taskId)];

    if (user.role === 'client' && user.brandId) {
      conditions.push(eq(geoPublishRecords.brandId, user.brandId));
    }

    const rows = await this.db
      .select()
      .from(geoPublishRecords)
      .where(and(...conditions))
      .orderBy(desc(geoPublishRecords.createdAt));

    return rows.map((row) => this.toRecord(row));
  }

  // ---------- 内部方法 ----------

  private buildWhereSql(
    query: PublishRecordListQueryDto,
    user: GeoUserCtx,
  ): Array<import('drizzle-orm').SQL> {
    const conditions: Array<import('drizzle-orm').SQL> = [];

    // client 只能看自己品牌
    if (user.role === 'client') {
      if (user.brandId) {
        conditions.push(sql`pr.brand_id = ${user.brandId}::uuid`);
      } else {
        conditions.push(sql`pr.brand_id = ''::uuid`);
      }
    } else if (query.brandId) {
      conditions.push(sql`pr.brand_id = ${query.brandId}::uuid`);
    }

    if (query.contentType) {
      conditions.push(sql`pr.content_type = ${query.contentType}`);
    }
    if (query.status) {
      conditions.push(sql`pr.status = ${query.status}`);
    }
    if (query.platform) {
      conditions.push(sql`pr.platform = ${query.platform}`);
    }
    if (query.keyword) {
      conditions.push(sql`pr.title ILIKE ${`%${query.keyword}%`}`);
    }

    return conditions;
  }

  private async findOrThrow(id: string): Promise<typeof geoPublishRecords.$inferSelect> {
    const rows = await this.db
      .select()
      .from(geoPublishRecords)
      .where(eq(geoPublishRecords.id, id));

    if (rows.length === 0) {
      throw new NotFoundException('发布记录不存在');
    }

    return rows[0];
  }

  private ensureBrandAccess(brandId: string, user: GeoUserCtx): void {
    if (user.role === 'client' && user.brandId !== brandId) {
      throw new ForbiddenException('无权访问其他品牌数据');
    }
  }

  private toRecord(row: typeof geoPublishRecords.$inferSelect): PublishRecord {
    return {
      id: row.id,
      brandId: row.brandId,
      taskId: row.taskId,
      contentType: row.contentType,
      title: row.title,
      externalUrl: row.externalUrl,
      platform: row.platform,
      status: row.status as PublishRecord['status'],
      publishDate: row.publishDate
        ? new Date(row.publishDate).toISOString()
        : null,
      notes: row.notes,
      creatorId: row.creatorId,
      createdAt: new Date(row.createdAt).toISOString(),
      isDuplicate: false,
    };
  }

  // ============================================================
  //  自动发布任务
  // ============================================================

  async listAutoPublishTasks(
    query: AutoPublishTaskListQueryDto,
    user: GeoUserCtx,
  ): Promise<PaginatedResponse<AutoPublishTask>> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;

    const conditions = this.buildAutoPublishWhere(query, user);
    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const baseQuery = this.db
      .select({
        id: geoAutoPublishTasks.id,
        brandId: geoAutoPublishTasks.brandId,
        brandName: geoBrands.name,
        taskName: geoAutoPublishTasks.taskName,
        libraryType: geoAutoPublishTasks.libraryType,
        channelIds: geoAutoPublishTasks.channelIds,
        articleIds: geoAutoPublishTasks.articleIds,
        startDate: geoAutoPublishTasks.startDate,
        endDate: geoAutoPublishTasks.endDate,
        dailyLimit: geoAutoPublishTasks.dailyLimit,
        status: geoAutoPublishTasks.status,
        publishedCount: geoAutoPublishTasks.publishedCount,
        totalCount: geoAutoPublishTasks.totalCount,
        error: geoAutoPublishTasks.error,
        creatorId: geoAutoPublishTasks.creatorId,
        creatorName: geoUsers.displayName,
        sourceRule: geoAutoPublishTasks.sourceRule,
        sourceSelectionMode: geoAutoPublishTasks.sourceSelectionMode,
        channelSource: geoAutoPublishTasks.channelSource,
        marketChannelIds: geoAutoPublishTasks.marketChannelIds,
        budgetCents: geoAutoPublishTasks.budgetCents,
        publishIntervalMinutes: geoAutoPublishTasks.publishIntervalMinutes,
        createdAt: geoAutoPublishTasks.createdAt,
        updatedAt: geoAutoPublishTasks.updatedAt,
      })
      .from(geoAutoPublishTasks)
      .leftJoin(geoBrands, eq(geoAutoPublishTasks.brandId, geoBrands.id))
      .leftJoin(geoUsers, eq(geoAutoPublishTasks.creatorId, geoUsers.id));

    const dataQuery = whereClause ? baseQuery.where(whereClause) : baseQuery;

    const [itemsRaw, totalResult] = await Promise.all([
      dataQuery
        .orderBy(desc(geoAutoPublishTasks.createdAt))
        .limit(pageSize)
        .offset((page - 1) * pageSize),
      this.db
        .select({ count: count() })
        .from(geoAutoPublishTasks)
        .leftJoin(geoBrands, eq(geoAutoPublishTasks.brandId, geoBrands.id))
        .where(whereClause),
    ]);

    const items: AutoPublishTask[] = itemsRaw.map((row) => ({
      id: row.id,
      brandId: row.brandId,
      brandName: row.brandName ?? '',
      taskName: row.taskName,
      libraryType: row.libraryType as AutoPublishLibrary,
      channelIds: row.channelIds ?? [],
      articleIds: row.articleIds ?? [],
      startDate: String(row.startDate),
      endDate: String(row.endDate),
      dailyLimit: row.dailyLimit,
      status: row.status as AutoPublishStatus,
      publishedCount: row.publishedCount,
      totalCount: row.totalCount,
      error: row.error ?? null,
      creatorId: row.creatorId,
      creatorName: row.creatorName ?? null,
      sourceRule: (row.sourceRule as unknown as AutoPublishTask['sourceRule']) ?? null,
      sourceSelectionMode: (row.sourceSelectionMode as 'manual' | 'auto') ?? 'manual',
      channelSource: row.channelSource as AutoPublishTask['channelSource'],
      marketChannelIds: row.marketChannelIds ?? [],
      budgetCents: row.budgetCents ?? 0,
      publishIntervalMinutes: row.publishIntervalMinutes ?? 0,
      createdAt: new Date(row.createdAt).toISOString(),
      updatedAt: new Date(row.updatedAt).toISOString(),
    }));

    return { items, total: Number(totalResult[0]?.count ?? 0), page, pageSize };
  }

  async getAutoPublishTask(
    id: string,
    user: GeoUserCtx,
  ): Promise<AutoPublishTask> {
    const rows = await this.db
      .select({
        id: geoAutoPublishTasks.id,
        brandId: geoAutoPublishTasks.brandId,
        brandName: geoBrands.name,
        taskName: geoAutoPublishTasks.taskName,
        libraryType: geoAutoPublishTasks.libraryType,
        channelIds: geoAutoPublishTasks.channelIds,
        articleIds: geoAutoPublishTasks.articleIds,
        startDate: geoAutoPublishTasks.startDate,
        endDate: geoAutoPublishTasks.endDate,
        dailyLimit: geoAutoPublishTasks.dailyLimit,
        status: geoAutoPublishTasks.status,
        publishedCount: geoAutoPublishTasks.publishedCount,
        totalCount: geoAutoPublishTasks.totalCount,
        error: geoAutoPublishTasks.error,
        creatorId: geoAutoPublishTasks.creatorId,
        creatorName: geoUsers.displayName,
        sourceRule: geoAutoPublishTasks.sourceRule,
        sourceSelectionMode: geoAutoPublishTasks.sourceSelectionMode,
        channelSource: geoAutoPublishTasks.channelSource,
        marketChannelIds: geoAutoPublishTasks.marketChannelIds,
        budgetCents: geoAutoPublishTasks.budgetCents,
        publishIntervalMinutes: geoAutoPublishTasks.publishIntervalMinutes,
        createdAt: geoAutoPublishTasks.createdAt,
        updatedAt: geoAutoPublishTasks.updatedAt,
      })
      .from(geoAutoPublishTasks)
      .leftJoin(geoBrands, eq(geoAutoPublishTasks.brandId, geoBrands.id))
      .leftJoin(geoUsers, eq(geoAutoPublishTasks.creatorId, geoUsers.id))
      .where(eq(geoAutoPublishTasks.id, id))
      .limit(1);

    if (rows.length === 0) {
      throw new NotFoundException('自动发布任务不存在');
    }

    const row = rows[0];
    this.ensureBrandAccess(row.brandId, user);

    return {
      id: row.id,
      brandId: row.brandId,
      brandName: row.brandName ?? '',
      taskName: row.taskName,
      libraryType: row.libraryType as AutoPublishLibrary,
      channelIds: row.channelIds ?? [],
      articleIds: row.articleIds ?? [],
      startDate: String(row.startDate),
      endDate: String(row.endDate),
      dailyLimit: row.dailyLimit,
      status: row.status as AutoPublishStatus,
      publishedCount: row.publishedCount,
      totalCount: row.totalCount,
      error: row.error ?? null,
      creatorId: row.creatorId,
      creatorName: row.creatorName ?? null,
      sourceRule: (row.sourceRule as unknown as AutoPublishTask['sourceRule']) ?? null,
      sourceSelectionMode: (row.sourceSelectionMode as 'manual' | 'auto') ?? 'manual',
      channelSource: row.channelSource as AutoPublishTask['channelSource'],
      marketChannelIds: row.marketChannelIds ?? [],
      budgetCents: row.budgetCents ?? 0,
      publishIntervalMinutes: row.publishIntervalMinutes ?? 0,
      createdAt: new Date(row.createdAt).toISOString(),
      updatedAt: new Date(row.updatedAt).toISOString(),
    };
  }

  async createAutoPublishTask(
    dto: CreateAutoPublishTaskDto,
    user: GeoUserCtx,
  ): Promise<AutoPublishTask> {
    this.ensureBrandAccess(dto.brandId, user);

    if (dto.startDate > dto.endDate) {
      throw new BadRequestException('开始日期不能晚于结束日期');
    }
    if (dto.dailyLimit < 1) {
      throw new BadRequestException('每日发布数量至少为 1');
    }
    const isMarketChannel = dto.channelSource === 'market';
    const effectiveChannelIds = isMarketChannel
      ? (dto.marketChannelIds ?? [])
      : dto.channelIds;

    if (effectiveChannelIds.length < 1) {
      throw new BadRequestException('至少选择一个发布渠道');
    }
    if (dto.articleIds.length < 1) {
      throw new BadRequestException('至少选择一篇文章');
    }

    // 校验文章存在且属于该品牌
    const articles = await this.db
      .select({
        id: geoArticles.id,
        title: geoArticles.title,
        content: geoArticles.content,
        coverImage: geoArticles.coverImage,
        keywords: geoArticles.keywords,
        wordCount: geoArticles.wordCount,
      })
      .from(geoArticles)
      .where(
        and(
          eq(geoArticles.brandId, dto.brandId),
          inArray(geoArticles.id, dto.articleIds),
        ),
      );

    if (articles.length !== dto.articleIds.length) {
      const foundIds = new Set(articles.map((a) => a.id));
      const missing = dto.articleIds.filter((id) => !foundIds.has(id));
      throw new BadRequestException(
        `以下文章不存在或不属于该品牌：${missing.slice(0, 3).join(', ')}` +
          (missing.length > 3 ? ` 等 ${missing.length} 篇` : ''),
      );
    }

    const articleMap = new Map<string, typeof articles[number]>();
    for (const a of articles) {
      articleMap.set(a.id, a);
    }

    let excludedArticleCount = 0;

    const taskId = await this.db.transaction(async (tx) => {
      const inserted = await tx
        .insert(geoAutoPublishTasks)
        .values({
          brandId: dto.brandId,
          taskName: dto.taskName,
          libraryType: dto.libraryType,
          channelIds: isMarketChannel ? [] : dto.channelIds,
          marketChannelIds: isMarketChannel ? (dto.marketChannelIds ?? []) : [],
          articleIds: dto.articleIds,
          startDate: dto.startDate,
          endDate: dto.endDate,
          dailyLimit: dto.dailyLimit,
          status: 'running',
          publishedCount: 0,
          totalCount: 0,
          creatorId: user.id,
          sourceRule: dto.sourceRule ?? {},
          sourceSelectionMode: dto.sourceSelectionMode ?? 'manual',
          channelSource: dto.channelSource,
          budgetCents: dto.budgetCents ?? 0,
          publishIntervalMinutes: dto.publishIntervalMinutes ?? 0,
        })
        .returning({ id: geoAutoPublishTasks.id });

      const newTaskId = inserted[0].id;

      if (isMarketChannel) {
        // 媒体商城渠道：生成 media_orders（带冻结）
        const channels = await tx
          .select()
          .from(geoSubmissionChannels)
          .where(inArray(geoSubmissionChannels.id, dto.marketChannelIds ?? []));

        const validChannels = channels.filter(
          (c) => c.sellable && c.salePriceCents && c.salePriceCents > 0,
        );
        if (validChannels.length !== (dto.marketChannelIds ?? []).length) {
          throw new BadRequestException('部分商城渠道不存在或不可下单');
        }

        const totalCents = validChannels.reduce(
          (sum: number, c) => sum + (c.salePriceCents ?? 0),
          0,
        ) * articles.length;

        if (dto.budgetCents && totalCents > dto.budgetCents) {
          throw new BadRequestException(
            `总费用 ${(totalCents / 100).toFixed(2)} 元超出预算 ${(dto.budgetCents / 100).toFixed(2)} 元`,
          );
        }

        // 冻结余额
        await this.walletService.freezeBalance(dto.brandId, totalCents, tx);

        // 生成排期订单
        const start = new Date(dto.startDate + 'T00:00:00Z');
        const end = new Date(dto.endDate + 'T23:59:59Z');
        const formatDateStr = (d: Date): string => {
          const y = d.getUTCFullYear();
          const m = String(d.getUTCMonth() + 1).padStart(2, '0');
          const day = String(d.getUTCDate()).padStart(2, '0');
          return `${y}-${m}-${day}`;
        };

        const orderValues: typeof geoMediaOrders.$inferInsert[] = [];
        const now = new Date();
        let scheduledCount = 0;

        for (let i = 0; i < dto.articleIds.length; i++) {
          const daysOffset = Math.floor(i / dto.dailyLimit);
          const scheduled = new Date(start);
          scheduled.setUTCDate(start.getUTCDate() + daysOffset);
          if (scheduled.getTime() > end.getTime()) break;

          const articleId = dto.articleIds[i];
          const art = articleMap.get(articleId);
          if (!art) continue;

          const scheduledDateStr = formatDateStr(scheduled);
          for (const ch of validChannels) {
            const orderNo = this.generateOrderNo();
            const salePriceCents = ch.salePriceCents ?? 0;
            orderValues.push({
              orderNo,
              brandId: dto.brandId,
              channelId: ch.id,
              supplierId: ch.supplierId ?? undefined,
              title: art.title,
              content: art.content,
              imageUrls: art.coverImage ? [art.coverImage] : [],
              priceCents: salePriceCents,
              costPriceCents: ch.costPriceCents ?? 0,
              status: 'paid',
              articleId: art.id,
              source: 'auto_task',
              taskId: newTaskId,
              frozenAmountCents: salePriceCents,
              timeline: [
                { status: 'paid', time: now.toISOString(), note: `自动任务创建，排期 ${scheduledDateStr}` },
              ] as any,
            });
          }
          scheduledCount++;
        }

        excludedArticleCount = dto.articleIds.length - scheduledCount;

        if (orderValues.length > 0) {
          const batchSize = 100;
          for (let i = 0; i < orderValues.length; i += batchSize) {
            const batch = orderValues.slice(i, i + batchSize);
            await tx.insert(geoMediaOrders).values(batch as any);
          }
        }

        await tx
          .update(geoAutoPublishTasks)
          .set({ totalCount: orderValues.length })
          .where(eq(geoAutoPublishTasks.id, newTaskId));

        return newTaskId;
      }

      // 自媒体渠道：原有逻辑（publish_queue）
      const queueValues: typeof geoPublishQueue.$inferInsert[] = [];
      const start = new Date(dto.startDate + 'T00:00:00Z');
      const end = new Date(dto.endDate + 'T23:59:59Z');

      const formatDateStr = (d: Date): string => {
        const y = d.getUTCFullYear();
        const m = String(d.getUTCMonth() + 1).padStart(2, '0');
        const day = String(d.getUTCDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
      };

      let scheduledCount = 0;
      for (let i = 0; i < dto.articleIds.length; i++) {
        const daysOffset = Math.floor(i / dto.dailyLimit);
        const scheduled = new Date(start);
        scheduled.setUTCDate(start.getUTCDate() + daysOffset);

        if (scheduled.getTime() > end.getTime()) {
          break;
        }

        const articleId = dto.articleIds[i];
        const art = articleMap.get(articleId);
        if (!art) continue;

        const scheduledDateStr = formatDateStr(scheduled);
        for (const channelId of effectiveChannelIds) {
          queueValues.push({
            brandId: dto.brandId,
            articleId: art.id,
            channelId: channelId,
            taskId: newTaskId,
            title: art.title,
            content: art.content,
            coverUrl: art.coverImage,
            tags: art.keywords ?? [],
            wordCount: art.wordCount,
            mode: dto.libraryType === 'b2b_alliance' ? 'b2b_submit' : 'local_auto',
            status: dto.accountId ? 'pending_client' : 'pending',
            accountId: dto.accountId || undefined,
            source: 'queue_auto',
            scheduledDate: scheduledDateStr,
          });
        }
        scheduledCount++;
      }

      excludedArticleCount = dto.articleIds.length - scheduledCount;

      if (queueValues.length > 0) {
        const batchSize = 100;
        for (let i = 0; i < queueValues.length; i += batchSize) {
          const batch = queueValues.slice(i, i + batchSize);
          await tx.insert(geoPublishQueue).values(batch);
        }
      }

      await tx
        .update(geoAutoPublishTasks)
        .set({ totalCount: queueValues.length })
        .where(eq(geoAutoPublishTasks.id, newTaskId));

      return newTaskId;
    });

    const task = await this.getAutoPublishTask(taskId, user);
    if (excludedArticleCount > 0) {
      (task as AutoPublishTask & { excludedArticleCount: number }).excludedArticleCount = excludedArticleCount;
    }

    return task;
  }

  async toggleTaskStatus(
    id: string,
    status: 'running' | 'paused' | 'stopped' | 'completed',
    user: GeoUserCtx,
  ): Promise<AutoPublishTask> {
    const existing = await this.db
      .select({
        id: geoAutoPublishTasks.id,
        brandId: geoAutoPublishTasks.brandId,
        status: geoAutoPublishTasks.status,
      })
      .from(geoAutoPublishTasks)
      .where(eq(geoAutoPublishTasks.id, id))
      .limit(1);

    if (existing.length === 0) {
      throw new NotFoundException('自动发布任务不存在');
    }

    const row = existing[0];
    this.ensureBrandAccess(row.brandId, user);

    if (row.status === status) {
      return this.getAutoPublishTask(id, user);
    }

    const updated = await this.db
      .update(geoAutoPublishTasks)
      .set({ status })
      .where(eq(geoAutoPublishTasks.id, id))
      .returning({ id: geoAutoPublishTasks.id });

    if (updated.length === 0) {
      throw new NotFoundException('自动发布任务不存在');
    }

    return this.getAutoPublishTask(id, user);
  }

  async updateAutoPublishTask(
    id: string,
    dto: UpdateAutoPublishTaskDto,
    user: GeoUserCtx,
  ): Promise<AutoPublishTask> {
    const existing = await this.db
      .select({
        id: geoAutoPublishTasks.id,
        brandId: geoAutoPublishTasks.brandId,
        startDate: geoAutoPublishTasks.startDate,
        endDate: geoAutoPublishTasks.endDate,
        dailyLimit: geoAutoPublishTasks.dailyLimit,
        channelIds: geoAutoPublishTasks.channelIds,
        articleIds: geoAutoPublishTasks.articleIds,
      })
      .from(geoAutoPublishTasks)
      .where(eq(geoAutoPublishTasks.id, id))
      .limit(1);

    if (existing.length === 0) {
      throw new NotFoundException('自动发布任务不存在');
    }

    const row = existing[0];
    this.ensureBrandAccess(row.brandId, user);

    const patch: Partial<typeof geoAutoPublishTasks.$inferInsert> = {};
    if (dto.taskName !== undefined) patch.taskName = dto.taskName;
    if (dto.channelIds !== undefined) patch.channelIds = dto.channelIds;
    if (dto.articleIds !== undefined) {
      patch.articleIds = dto.articleIds;
      patch.totalCount = dto.articleIds.length;
    }
    if (dto.startDate !== undefined) patch.startDate = dto.startDate;
    if (dto.endDate !== undefined) patch.endDate = dto.endDate;
    if (dto.dailyLimit !== undefined) patch.dailyLimit = dto.dailyLimit;
    if (dto.status !== undefined) patch.status = dto.status;
    if (dto.sourceRule !== undefined) patch.sourceRule = dto.sourceRule as any;
    if (dto.sourceSelectionMode !== undefined) {
      patch.sourceSelectionMode = dto.sourceSelectionMode;
    }

    if (Object.keys(patch).length === 0) {
      throw new BadRequestException('未提供可更新字段');
    }

    // 校验 startDate <= endDate
    const newStart = dto.startDate ?? String(row.startDate);
    const newEnd = dto.endDate ?? String(row.endDate);
    if (newStart > newEnd) {
      throw new BadRequestException('开始日期不能晚于结束日期');
    }

    const updated = await this.db
      .update(geoAutoPublishTasks)
      .set(patch)
      .where(eq(geoAutoPublishTasks.id, id))
      .returning({ id: geoAutoPublishTasks.id });

    if (updated.length === 0) {
      throw new NotFoundException('自动发布任务不存在');
    }

    return this.getAutoPublishTask(id, user);
  }

  async deleteAutoPublishTask(
    id: string,
    user: GeoUserCtx,
  ): Promise<void> {
    const existing = await this.db
      .select({
        id: geoAutoPublishTasks.id,
        brandId: geoAutoPublishTasks.brandId,
      })
      .from(geoAutoPublishTasks)
      .where(eq(geoAutoPublishTasks.id, id))
      .limit(1);

    if (existing.length === 0) {
      throw new NotFoundException('自动发布任务不存在');
    }

    this.ensureBrandAccess(existing[0].brandId, user);

    await this.db.transaction(async (tx) => {
      await tx
        .delete(geoPublishQueue)
        .where(
          and(
            eq(geoPublishQueue.taskId, id),
            inArray(geoPublishQueue.status, ['pending', 'pending_client']),
          ),
        );

      const deleted = await tx
        .delete(geoAutoPublishTasks)
        .where(eq(geoAutoPublishTasks.id, id))
        .returning({ id: geoAutoPublishTasks.id });

      if (deleted.length === 0) {
        throw new NotFoundException('自动发布任务不存在');
      }
    });
  }

  private buildAutoPublishWhere(
    query: AutoPublishTaskListQueryDto,
    user: GeoUserCtx,
  ): Array<ReturnType<typeof eq> | ReturnType<typeof ilike>> {
    const conditions: Array<
      ReturnType<typeof eq> | ReturnType<typeof ilike>
    > = [];

    if (user.role === 'client') {
      if (user.brandId) {
        conditions.push(eq(geoAutoPublishTasks.brandId, user.brandId));
      } else {
        conditions.push(eq(geoAutoPublishTasks.brandId, '' as any));
      }
    } else if (query.brandId) {
      conditions.push(eq(geoAutoPublishTasks.brandId, query.brandId));
    }

    if (query.libraryType) {
      conditions.push(eq(geoAutoPublishTasks.libraryType, query.libraryType));
    }
    if (query.status) {
      conditions.push(eq(geoAutoPublishTasks.status, query.status));
    }
    if (query.keyword) {
      conditions.push(ilike(geoAutoPublishTasks.taskName, `%${query.keyword}%`));
    }

    return conditions;
  }

  private generateOrderNo(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const datePart = `${year}${month}${day}`;

    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    const bytes = randomBytes(7);
    let randomPart = '';
    for (let i = 0; i < 7; i++) {
      randomPart += chars[bytes[i] % chars.length];
    }

    return `MD${datePart}${randomPart}`;
  }
}
