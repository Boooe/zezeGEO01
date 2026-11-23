import {
  Injectable,
  Inject,
  Logger,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { DRIZZLE_DATABASE, type PostgresJsDatabase } from '@lark-apaas/fullstack-nestjs-core';
import { eq, and, desc, asc, count, gte, lt, gt, inArray, isNull, or, sql, type SQL } from 'drizzle-orm';

import {
  geoPublishQueue,
  geoSubmissionChannels,
  geoArticles,
  geoCreationTasks,
  geoPublishRecords,
  geoAutoPublishTasks,
  geoBrands,
  geoAccountAuths,
  geoChannels,
  geoDispatchPlans,
} from '@server/database/schema';
import { SUBMISSION_AI_SOURCES, type SubmissionAiSource, type SubmissionChannelType } from '@shared/api.interface';
import type {
  PublishQueueItem,
  PublishQueueDetail,
  PagedResponse,
  UserRole,
  ChannelPublishMode,
  PendingPublishTask,
  PublishLedgerItem,
  PublishLedgerResponse,
  PublishLedgerStats,
  PublishLedgerDetailResponse,
  UnifiedAccountOption,
} from '@shared/api.interface';
import {
  PublishQueueListQueryDto,
  EnqueuePublishDto,
  MarkPublishedDto,
  PublishResultDto,
  PublishLedgerQueryDto,
} from './dto/publish-queue.dto';

interface GeoUserCtx {
  id: string;
  role: UserRole;
  brandId: string | null;
}

const SYSTEM_CREATOR_ID = 'dfba5028-5208-4289-abca-6d39a9920748';

@Injectable()
export class PublishQueueService {
  private readonly logger = new Logger(PublishQueueService.name);

  constructor(
    @Inject(DRIZZLE_DATABASE) private readonly db: PostgresJsDatabase,
  ) {}

  // ---------- 列表 ----------

  async listQueue(
    query: PublishQueueListQueryDto,
    user: GeoUserCtx,
  ): Promise<PagedResponse<PublishQueueItem>> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;

    const conditions = this.buildDispatchWhere(query, user);

    const baseQuery = this.db
      .select()
      .from(geoDispatchPlans);

    const dataQuery = conditions.length > 0
      ? baseQuery.where(and(...conditions))
      : baseQuery;

    const countQuery = this.db
      .select({ count: count() })
      .from(geoDispatchPlans)
      .where(conditions.length > 0 ? and(...conditions) : undefined);

    const [rowsRaw, totalResult] = await Promise.all([
      dataQuery
        .orderBy(asc(geoDispatchPlans.planDate))
        .limit(pageSize)
        .offset((page - 1) * pageSize),
      countQuery,
    ]);

    const items: PublishQueueItem[] = rowsRaw.map((row) =>
      this.dispatchPlanToQueueItem(row),
    );

    return {
      items,
      total: Number(totalResult[0]?.count ?? 0),
      page,
      pageSize,
    };
  }

  async rescheduleDispatchPlan(id: string, user: GeoUserCtx): Promise<PublishQueueItem> {
    const rows = await this.db
      .select()
      .from(geoDispatchPlans)
      .where(eq(geoDispatchPlans.id, id));

    if (rows.length === 0) {
      throw new NotFoundException('计划不存在');
    }

    const plan = rows[0];
    this.ensureBrandAccess(plan.brandId, user);

    if (plan.status !== 'planned') {
      throw new BadRequestException('只有待排期计划可重新排期');
    }

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    const dateStr = tomorrow.toISOString().split('T')[0];

    const updated = await this.db
      .update(geoDispatchPlans)
      .set({ planDate: dateStr, updatedAt: new Date() })
      .where(eq(geoDispatchPlans.id, id))
      .returning();

    return this.dispatchPlanToQueueItem(updated[0]);
  }

  private dispatchPlanToQueueItem(
    row: typeof geoDispatchPlans.$inferSelect,
  ): PublishQueueItem {
    return {
      id: row.id,
      brandId: row.brandId,
      articleId: row.articleId ?? null,
      channelId: row.channelId ?? null,
      channelName: row.channelName ?? undefined,
      title: row.title ?? '',
      coverUrl: null,
      tags: [],
      mode: 'b2b_submit' as any,
      status: row.status as any,
      publishUrl: null,
      publishedAt: null,
      error: null,
      wordCount: 0,
      source: 'queue_auto' as any,
      accountId: null,
      accountName: null,
      scheduledDate: row.planDate ? String(row.planDate) : null,
      weightTier: row.weightTier ?? undefined,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  // ---------- 详情 ----------

  async getDetail(id: string, user: GeoUserCtx): Promise<PublishQueueDetail> {
    const rows = await this.db
      .select({
        queue: geoPublishQueue,
        channelName: geoSubmissionChannels.name,
        channelType: geoSubmissionChannels.channelType,
        channelSubmitUrl: geoSubmissionChannels.submitUrl,
        article: geoArticles,
      })
      .from(geoPublishQueue)
      .leftJoin(
        geoSubmissionChannels,
        eq(geoSubmissionChannels.id, geoPublishQueue.channelId ?? ''),
      )
      .leftJoin(
        geoArticles,
        eq(geoArticles.id, geoPublishQueue.articleId ?? ''),
      )
      .where(eq(geoPublishQueue.id, id));

    if (rows.length === 0) {
      throw new NotFoundException('队列项不存在');
    }

    const row = rows[0];
    this.ensureBrandAccess(row.queue.brandId, user);

    return this.toQueueDetail(
      row.queue,
      row.channelName ?? null,
      row.channelType ?? null,
      row.article,
    );
  }

  // ---------- 加入队列 ----------

  async enqueue(
    dto: EnqueuePublishDto,
    user: GeoUserCtx,
  ): Promise<PublishQueueItem> {
    // 查文章
    const articles = await this.db
      .select()
      .from(geoArticles)
      .where(eq(geoArticles.id, dto.articleId));

    if (articles.length === 0) {
      throw new NotFoundException('文章不存在');
    }

    const article = articles[0];

    // client 只能操作自己品牌
    if (user.role === 'client' && user.brandId !== article.brandId) {
      throw new ForbiddenException('无权操作其他品牌文章');
    }

    // 查渠道
    const channels = await this.db
      .select()
      .from(geoSubmissionChannels)
      .where(eq(geoSubmissionChannels.id, dto.channelId));

    if (channels.length === 0) {
      throw new NotFoundException('渠道不存在');
    }

    const channel = channels[0];

    if (user.role === 'client' && user.brandId !== channel.brandId) {
      throw new ForbiddenException('无权操作其他品牌渠道');
    }

    // 确认文章和渠道同一品牌
    if (article.brandId !== channel.brandId) {
      throw new BadRequestException('文章与渠道品牌不一致');
    }

    // mode 默认 b2b_submit
    const mode: ChannelPublishMode = (dto.mode ??
      'b2b_submit') as ChannelPublishMode;

    // 有账号时状态为待客户端领取
    const status = dto.accountId ? 'pending_client' : 'pending';

    // 计算字数
    const wordCount = article.content
      ? article.content.replace(/\s/g, '').length
      : 0;

    const inserted = await this.db
      .insert(geoPublishQueue)
      .values({
        brandId: article.brandId,
        articleId: article.id,
        channelId: channel.id,
        title: article.title ?? '未命名文章',
        content: article.content,
        coverUrl: article.coverImage ?? null,
        tags: article.keywords ?? [],
        mode,
        status: status as any,
        wordCount,
        source: 'queue_auto',
        accountId: dto.accountId ?? null,
      })
      .returning();

    return this.toQueueItem(inserted[0], channel.name, channel.channelType, null);
  }

  // ---------- 改为手动 ----------

  async deleteQueueItem(id: string, user: GeoUserCtx): Promise<void> {
    const existing = await this.findOrThrow(id);
    this.ensureBrandAccess(existing.brandId, user);

    if (
      existing.status !== 'pending' &&
      existing.status !== 'pending_client'
    ) {
      throw new BadRequestException(
        '仅待发布或待客户端领取状态的队列项可删除',
      );
    }

    const deleted = await this.db
      .delete(geoPublishQueue)
      .where(eq(geoPublishQueue.id, id))
      .returning({ id: geoPublishQueue.id });

    if (deleted.length === 0) {
      throw new NotFoundException('队列项不存在');
    }
  }

  async markManual(id: string, user: GeoUserCtx): Promise<PublishQueueItem> {
    const existing = await this.findOrThrow(id);
    this.ensureBrandAccess(existing.brandId, user);

    const updated = await this.db
      .update(geoPublishQueue)
      .set({ status: 'pending_manual' })
      .where(eq(geoPublishQueue.id, id))
      .returning();

    if (updated.length === 0) {
      throw new NotFoundException('队列项不存在');
    }

    const channels = await this.db
      .select({ name: geoSubmissionChannels.name, channelType: geoSubmissionChannels.channelType })
      .from(geoSubmissionChannels)
      .where(eq(geoSubmissionChannels.id, updated[0].channelId ?? ''));

    const ch = channels[0];
    return this.toQueueItem(updated[0], ch?.name ?? null, ch?.channelType ?? null, null);
  }

  // ---------- 重试 ----------

  async retry(id: string, user: GeoUserCtx): Promise<PublishQueueItem> {
    const existing = await this.findOrThrow(id);
    this.ensureBrandAccess(existing.brandId, user);

    const updated = await this.db
      .update(geoPublishQueue)
      .set({
        status: 'pending',
        error: null,
      })
      .where(eq(geoPublishQueue.id, id))
      .returning();

    if (updated.length === 0) {
      throw new NotFoundException('队列项不存在');
    }

    // 查渠道信息
    const channels = await this.db
      .select({ name: geoSubmissionChannels.name, channelType: geoSubmissionChannels.channelType })
      .from(geoSubmissionChannels)
      .where(eq(geoSubmissionChannels.id, updated[0].channelId ?? ''));

    const ch = channels[0];
    return this.toQueueItem(updated[0], ch?.name ?? null, ch?.channelType ?? null, null);
  }

  // ---------- 标记已发布 ----------

  async markPublished(
    id: string,
    dto: MarkPublishedDto,
    user: GeoUserCtx,
  ): Promise<PublishQueueItem> {
    const existing = await this.findOrThrow(id);
    this.ensureBrandAccess(existing.brandId, user);

    // 查渠道
    let channel: typeof geoSubmissionChannels.$inferSelect | undefined;
    if (existing.channelId) {
      const channels = await this.db
        .select()
        .from(geoSubmissionChannels)
        .where(eq(geoSubmissionChannels.id, existing.channelId));
      channel = channels[0];
    }

    let taskId: string | null = null;
    if (existing.articleId) {
      const tasks = await this.db
        .select({ id: geoArticles.id })
        .from(geoArticles)
        .where(eq(geoArticles.id, existing.articleId));
      if (tasks.length > 0) {
        taskId = tasks[0].id;
      }
    }

    const publishedAtIso = dto.publishedAt.toISOString();

    // 更新队列状态 + 写入发布记录（事务）
    const result = await this.db.transaction(async (tx) => {
      if (dto.publishMethod === 'client') {
        if (!dto.accountId) {
          throw new BadRequestException('授权客户端发布必须指定账号');
        }
        const updatedRows = await tx
          .update(geoPublishQueue)
          .set({
            status: 'pending_client',
            accountId: dto.accountId,
            error: null,
          })
          .where(eq(geoPublishQueue.id, id))
          .returning();

        if (updatedRows.length === 0) {
          throw new NotFoundException('队列项不存在');
        }
        return updatedRows[0];
      }

      const updatedRows = await tx
        .update(geoPublishQueue)
        .set({
          status: 'published',
          publishUrl: dto.url,
          publishedAt: dto.publishedAt,
          error: null,
        })
        .where(eq(geoPublishQueue.id, id))
        .returning();

      if (updatedRows.length === 0) {
        throw new NotFoundException('队列项不存在');
      }

      // 写入发布记录（channel_id 为空时也写，platform 记 manual）
      const notesParts = [`来源：发布队列手动标记`];
      if (channel) {
        notesParts.push(`渠道：${channel.name ?? ''}`);
      } else {
        notesParts.push(`渠道：未绑定（手动发布）`);
      }
      if (dto.remark) {
        notesParts.push(`备注：${dto.remark}`);
      }
      await tx.insert(geoPublishRecords).values({
        brandId: existing.brandId,
        taskId,
        contentType: 'article',
        title: existing.title,
        externalUrl: dto.url,
        platform: channel ? channel.channelType : 'manual',
        status: 'published',
        publishDate: dto.publishedAt,
        notes: notesParts.join('；'),
        creatorId: user.id,
      });

      return updatedRows[0];
    });

    return this.toQueueItem(
      result,
      channel?.name ?? null,
      channel?.channelType ?? null,
      null,
    );
  }

  // ---------- 拉取待发布任务（公开接口） ----------

  async pullPending(): Promise<PendingPublishTask[]> {
    const limit = 20;

    // 先查 pending 的任务，按创建时间升序（最早的优先）
    const pendingRows = await this.db
      .select()
      .from(geoPublishQueue)
      .where(eq(geoPublishQueue.status, 'pending'))
      .orderBy(geoPublishQueue.createdAt)
      .limit(limit);

    if (pendingRows.length === 0) {
      return [];
    }

    const ids = pendingRows.map((row) => row.id);

    // 批量更新状态为 publishing
    await this.db
      .update(geoPublishQueue)
      .set({ status: 'publishing' })
      .where(inArray(geoPublishQueue.id, ids));

    // 查渠道信息
    const channelIds = [
      ...new Set(pendingRows.map((r) => r.channelId).filter((id): id is string => !!id)),
    ];

    let channelMap = new Map<string, { name: string; channelType: string }>();
    if (channelIds.length > 0) {
      const channelRows = await this.db
        .select()
        .from(geoSubmissionChannels)
        .where(inArray(geoSubmissionChannels.id, channelIds));
      for (const ch of channelRows) {
        channelMap.set(ch.id, {
          name: ch.name,
          channelType: ch.channelType,
        });
      }
    }

    const tasks: PendingPublishTask[] = pendingRows.map((row) => {
      const ch = row.channelId ? channelMap.get(row.channelId) : undefined;
      return {
        id: row.id,
        title: row.title,
        content: row.content,
        coverUrl: row.coverUrl,
        tags: row.tags ?? [],
        channelId: row.channelId,
        channelPlatform: (ch?.channelType as any) ?? null,
        channelName: ch?.name ?? null,
        publishMode: row.mode as ChannelPublishMode,
      };
    });

    return tasks;
  }

  // ---------- 回传结果（公开接口） ----------

  async reportResult(
    id: string,
    dto: PublishResultDto,
  ): Promise<{ ok: true }> {
    const existing = await this.findOrThrow(id);

    let channel: typeof geoSubmissionChannels.$inferSelect | undefined;
    if (existing.channelId) {
      const channels = await this.db
        .select()
        .from(geoSubmissionChannels)
        .where(eq(geoSubmissionChannels.id, existing.channelId));
      channel = channels[0];
    }

    await this.db.transaction(async (tx) => {
      if (dto.status === 'success') {
        const now = new Date();
        await tx
          .update(geoPublishQueue)
          .set({
            status: 'published',
            publishUrl: dto.publishUrl ?? null,
            publishedAt: now,
            screenshotUrl: dto.screenshotUrl ?? null,
            error: null,
          })
          .where(eq(geoPublishQueue.id, id));

        // 写入发布记录
        if (channel) {
          await tx.insert(geoPublishRecords).values({
            brandId: existing.brandId,
            taskId: existing.articleId ?? null,
            contentType: 'article',
            title: existing.title,
            externalUrl: dto.publishUrl ?? null,
            platform: channel?.channelType ?? 'unknown',
            status: 'published',
            publishDate: new Date(),
            notes: `来源：发布队列自动（queue_auto）；渠道：${channel?.name ?? ''}`,
            creatorId: SYSTEM_CREATOR_ID,
          });
        }
      } else if (dto.status === 'failed') {
        await tx
          .update(geoPublishQueue)
          .set({
            status: 'failed',
            error: dto.error ?? null,
            screenshotUrl: dto.screenshotUrl ?? null,
          })
          .where(eq(geoPublishQueue.id, id));
      } else if (dto.status === 'pending_manual') {
        await tx
          .update(geoPublishQueue)
          .set({
            status: 'pending_manual',
            error: null,
            screenshotUrl: dto.screenshotUrl ?? null,
          })
          .where(eq(geoPublishQueue.id, id));
      }
    });

    return { ok: true };
  }

  // ---------- 内部方法 ----------

  private buildDispatchWhere(
    query: PublishQueueListQueryDto,
    user: GeoUserCtx,
  ): Array<SQL> {
    const conditions: SQL[] = [];

    // client 只能看自己品牌
    if (user.role === 'client') {
      if (user.brandId) {
        conditions.push(eq(geoDispatchPlans.brandId, user.brandId));
      }
    } else if (query.brandId) {
      conditions.push(eq(geoDispatchPlans.brandId, query.brandId));
    }

    // 状态筛选：用户传了 status 就按用户传的，否则默认 planned + queued
    if (query.status) {
      conditions.push(eq(geoDispatchPlans.status, query.status));
    } else {
      conditions.push(inArray(geoDispatchPlans.status, ['planned', 'queued']));
    }

    return conditions;
  }

  private async findOrThrow(
    id: string,
  ): Promise<typeof geoPublishQueue.$inferSelect> {
    const rows = await this.db
      .select()
      .from(geoPublishQueue)
      .where(eq(geoPublishQueue.id, id));

    if (rows.length === 0) {
      throw new NotFoundException('队列项不存在');
    }

    return rows[0];
  }

  private ensureBrandAccess(brandId: string, user: GeoUserCtx): void {
    if (user.role === 'client' && user.brandId !== brandId) {
      throw new ForbiddenException('无权访问其他品牌数据');
    }
  }

  private toQueueItem(
    row: typeof geoPublishQueue.$inferSelect,
    channelName: string | null,
    channelType: string | null | undefined,
    taskName: string | null,
    articleWordCount: number | null = null,
    accountName: string | null = null,
  ): PublishQueueItem {
    return {
      id: row.id,
      brandId: row.brandId,
      articleId: row.articleId,
      channelId: row.channelId,
      channelName: channelName ?? undefined,
      channelPlatform: (channelType as any) ?? undefined,
      taskId: row.taskId ?? null,
      taskName: taskName ?? null,
      title: row.title,
      coverUrl: row.coverUrl,
      tags: row.tags ?? [],
      mode: row.mode as ChannelPublishMode,
      status: row.status as PublishQueueItem['status'],
      publishUrl: row.publishUrl,
      publishedAt: row.publishedAt
        ? new Date(row.publishedAt).toISOString()
        : null,
      error: row.error,
      wordCount: row.wordCount || articleWordCount || 0,
      source: row.source as PublishQueueItem['source'],
      accountId: row.accountId,
      accountName,
      scheduledDate: row.scheduledDate
        ? new Date(row.scheduledDate).toISOString().slice(0, 10)
        : null,
      createdAt: new Date(row.createdAt).toISOString(),
      updatedAt: new Date(row.updatedAt).toISOString(),
    };
  }

  private toQueueDetail(
    row: typeof geoPublishQueue.$inferSelect,
    channelName: string | null,
    channelType: string | null,
    article: typeof geoArticles.$inferSelect | null,
  ): PublishQueueDetail {
    const base = this.toQueueItem(row, channelName, channelType, null, article?.wordCount ?? null);
    return {
      ...base,
      content: row.content,
      screenshotUrl: row.screenshotUrl,
      article: article
        ? {
            id: article.id,
            brandId: article.brandId,
            title: article.title,
            content: article.content,
            articleType: article.articleType,
            wordCount: article.wordCount,
            keywords: article.keywords ?? [],
            longtailKeywords: article.longtailKeywords ?? [],
            status: article.status,
            costCredits: Number(article.costCredits),
            coverImage: article.coverImage ?? null,
            createdAt: new Date(article.createdAt).toISOString(),
            updatedAt: new Date(article.updatedAt).toISOString(),
          }
        : null,
    };
  }

  async getLedger(query: PublishLedgerQueryDto, user: { id: string; role: UserRole; brandId: string | null }): Promise<PublishLedgerResponse> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 50;
    const offset = (page - 1) * limit;

    const isClient = user.role === 'client';
    const brandId = isClient ? user.brandId : (query.brandId ?? null);

    const statusFilter = query.status ?? null;
    const channelTypeFilter = query.channelType ?? null;

    const submittedCond = statusFilter
      ? sql`q.status = ${statusFilter}`
      : sql`true`;
    const publishedCond = statusFilter
      ? (statusFilter === 'published' ? sql`q.status = 'published'` : sql`false`)
      : sql`q.status = 'published'`;
    const failedCond = statusFilter
      ? (statusFilter === 'failed' ? sql`q.status = 'failed'` : sql`false`)
      : sql`q.status = 'failed'`;

    const channelConditions: SQL[] = [];
    if (channelTypeFilter) {
      channelConditions.push(sql`c.channel_type = ${channelTypeFilter}`);
    }
    if (query.keyword) {
      channelConditions.push(sql`c.name ILIKE ${`%${query.keyword}%`}`);
    }
    if (isClient && brandId) {
      channelConditions.push(sql`(
        c.owner_type = 'platform'
        OR (c.owner_type = 'brand' AND c.owner_id = ${brandId})
      )`);
    } else if (brandId) {
      channelConditions.push(sql`c.brand_id = ${brandId}`);
    }
    const channelWhere = channelConditions.length > 0
      ? sql`WHERE ${sql.join(channelConditions, sql` AND `)}`
      : sql``;

    const queueConditions: SQL[] = [];
    if (isClient && brandId) {
      queueConditions.push(sql`q.brand_id = ${brandId}`);
    } else if (brandId) {
      queueConditions.push(sql`q.brand_id = ${brandId}`);
    }
    const activeAccountsWhere = queueConditions.length > 0
      ? sql`WHERE ${sql.join([...queueConditions, sql`account_id IS NOT NULL`], sql` AND `)}`
      : sql`WHERE account_id IS NOT NULL`;

    const queueWhere = queueConditions.length > 0
      ? sql`WHERE ${sql.join(queueConditions, sql` AND `)}`
      : sql``;

    const countResult = await this.db.execute(sql<{ total: string }>`
      SELECT count(*)::bigint AS total
      FROM geo_submission_channels c
      ${channelWhere}
    `);
    const total = Number(countResult[0]?.total ?? 0);

    const rows = await this.db.execute(sql`
      SELECT
        c.id AS channel_id,
        c.name AS channel_name,
        c.channel_type,
        c.brand_id,
        c.owner_type,
        c.owner_id,
        c.indexed_count,
        c.cite_snapshots,
        c.ai_platforms,
        COALESCE(q_stats.submitted, 0) AS submitted_count,
        COALESCE(q_stats.published, 0) AS published_count,
        COALESCE(q_stats.failed, 0) AS failed_count,
        q_stats.last_submit_at,
        q_stats.latest_publish_url,
        q_stats.has_published
      FROM geo_submission_channels c
      LEFT JOIN (
        SELECT
          channel_id,
          count(*) FILTER (WHERE ${submittedCond}) AS submitted,
          count(*) FILTER (WHERE ${publishedCond}) AS published,
          count(*) FILTER (WHERE ${failedCond}) AS failed,
          MAX(COALESCE(q.published_at, q._created_at)) AS last_submit_at,
          (
            SELECT publish_url
            FROM geo_publish_queue
            WHERE channel_id = q.channel_id
            ORDER BY COALESCE(published_at, _created_at) DESC
            LIMIT 1
          ) AS latest_publish_url,
          bool_or(q.status = 'published') AS has_published
        FROM geo_publish_queue q
        ${queueWhere}
        GROUP BY channel_id
      ) q_stats ON q_stats.channel_id = c.id
      ${channelWhere}
      ORDER BY COALESCE(q_stats.last_submit_at, '-infinity'::timestamptz) DESC, c._created_at DESC
      LIMIT ${limit}
      OFFSET ${offset}
    `);

    const channelRows = rows as unknown as Array<{
      channel_id: string;
      channel_name: string;
      channel_type: string;
      brand_id: string | null;
      owner_type: string;
      owner_id: string | null;
      indexed_count: number;
      cite_snapshots: number;
      ai_platforms: string[] | null;
      submitted_count: string | number;
      published_count: string | number;
      failed_count: string | number;
      last_submit_at: Date | null;
      latest_publish_url: string | null;
      has_published: boolean | null;
    }>;

    const brandOwnerIds = [...new Set(
      channelRows
        .filter((r) => r.owner_type === 'brand' && r.owner_id)
        .map((r) => r.owner_id as string),
    )];
    const brandMap = new Map<string, string>();
    if (brandOwnerIds.length > 0) {
      const brandRows = await this.db
        .select({ id: geoBrands.id, name: geoBrands.name })
        .from(geoBrands)
        .where(inArray(geoBrands.id, brandOwnerIds));
      for (const b of brandRows) {
        brandMap.set(b.id, b.name);
      }
    }

    const pageChannelIds = channelRows.map((r) => r.channel_id);
    let accountByChannel = new Map<string, number>();
    if (pageChannelIds.length > 0) {
      const channelIdArraySql = sql.join(
        pageChannelIds.map((id) => sql`${id}`),
        sql`, `,
      );
      const accRows = await this.db.execute(sql<{ channel_id: string; account_count: string | number }>`
        SELECT channel_id, count(DISTINCT account_id) AS account_count
        FROM geo_publish_queue
        WHERE channel_id IN (${channelIdArraySql})
          AND account_id IS NOT NULL
        GROUP BY channel_id
      `);
      for (const row of accRows as unknown as Array<{ channel_id: string; account_count: string | number }>) {
        accountByChannel.set(row.channel_id, Number(row.account_count));
      }
    }

    const items: PublishLedgerItem[] = channelRows.map((row) => {
      let brandName: string | null = null;
      if (row.owner_type === 'platform') {
        brandName = '服务商预置';
      } else if (row.owner_type === 'brand' && row.owner_id) {
        brandName = brandMap.get(row.owner_id) ?? null;
      }
      const indexStatus: PublishLedgerItem['indexStatus'] = (row.indexed_count ?? 0) > 0 ? 'indexed' : 'pending';
      return {
        channelId: row.channel_id,
        channelName: row.channel_name,
        channelType: row.channel_type as PublishLedgerItem['channelType'],
        brandId: row.brand_id,
        brandName,
        submittedCount: Number(row.submitted_count),
        publishedCount: Number(row.published_count),
        failedCount: Number(row.failed_count),
        lastSubmitAt: row.last_submit_at ? row.last_submit_at.toISOString() : null,
        latestPublishUrl: row.latest_publish_url ?? null,
        hasPublished: Boolean(row.has_published),
        accountCount: accountByChannel.get(row.channel_id) ?? 0,
        indexStatus,
        citeCount: row.cite_snapshots ?? 0,
        aiPlatforms: (row.ai_platforms ?? []).filter(
          (p: string): p is SubmissionAiSource =>
            (SUBMISSION_AI_SOURCES as readonly string[]).includes(p),
        ),
      };
    });

    const statsResult = await this.db.execute(sql<{
      total_channels: number;
      active_channels: number;
      total_published: string | number;
      total_failed: string | number;
      active_accounts: string | number;
    }>`
      SELECT
        (SELECT count(*) FROM geo_submission_channels c ${channelWhere})::int AS total_channels,
        COALESCE(SUM(CASE WHEN q_stats.submitted > 0 THEN 1 ELSE 0 END), 0)::int AS active_channels,
        COALESCE(SUM(q_stats.published), 0)::bigint AS total_published,
        COALESCE(SUM(q_stats.failed), 0)::bigint AS total_failed,
        COALESCE((SELECT count(DISTINCT account_id) FROM geo_publish_queue q ${activeAccountsWhere}), 0)::bigint AS active_accounts
      FROM geo_submission_channels c
      LEFT JOIN (
        SELECT
          channel_id,
          count(*) FILTER (WHERE ${submittedCond}) AS submitted,
          count(*) FILTER (WHERE ${publishedCond}) AS published,
          count(*) FILTER (WHERE ${failedCond}) AS failed
        FROM geo_publish_queue q
        ${queueWhere}
        GROUP BY channel_id
      ) q_stats ON q_stats.channel_id = c.id
      ${channelWhere}
    `);

    const statsRow = statsResult[0] as {
      total_channels: number;
      active_channels: number;
      total_published: string | number;
      total_failed: string | number;
      active_accounts: string | number;
    };

    const stats: PublishLedgerStats = {
      totalChannels: Number(statsRow?.total_channels ?? 0),
      activeChannels: Number(statsRow?.active_channels ?? 0),
      totalPublished: Number(statsRow?.total_published ?? 0),
      totalFailed: Number(statsRow?.total_failed ?? 0),
      activeAccounts: Number(statsRow?.active_accounts ?? 0),
    };

    return {
      items,
      total,
      page,
      limit,
      stats,
    };
  }

  async getLedgerDetail(
    channelId: string,
    query: PublishLedgerQueryDto,
    user: { id: string; role: UserRole; brandId: string | null },
  ): Promise<PublishLedgerDetailResponse> {
    const conditions = [];
    if (channelId === 'unbound') {
      conditions.push(isNull(geoPublishQueue.channelId));
    } else {
      conditions.push(eq(geoPublishQueue.channelId, channelId));
    }
    if (user.role === 'client' && user.brandId) {
      conditions.push(eq(geoPublishQueue.brandId, user.brandId));
    } else if (query.brandId) {
      conditions.push(eq(geoPublishQueue.brandId, query.brandId));
    }
    if (query.status) {
      conditions.push(eq(geoPublishQueue.status, query.status));
    }

    const rows = await this.db
      .select({
        id: geoPublishQueue.id,
        title: geoPublishQueue.title,
        status: geoPublishQueue.status,
        createdAt: geoPublishQueue.createdAt,
        publishUrl: geoPublishQueue.publishUrl,
      })
      .from(geoPublishQueue)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(
        desc(
          sql`COALESCE(${geoPublishQueue.publishedAt}, ${geoPublishQueue.createdAt})`,
        ),
      )
      .limit(200);

    return {
      items: rows.map((row: { id: string; title: string; status: string; createdAt: Date | string; publishUrl: string | null }) => ({
        id: row.id,
        title: row.title,
        status: row.status as any,
        createdAt: new Date(row.createdAt).toISOString(),
        publishUrl: row.publishUrl,
      })),
    };
  }

  async getLedgerAccountBreakdown(
    channelId: string,
    query: PublishLedgerQueryDto,
    user: { id: string; role: UserRole; brandId: string | null },
  ): Promise<{ items: any[] }> {
    const conditions = [];
    if (channelId === 'unbound') {
      conditions.push(isNull(geoPublishQueue.channelId));
    } else {
      conditions.push(eq(geoPublishQueue.channelId, channelId));
    }
    if (user.role === 'client' && user.brandId) {
      conditions.push(eq(geoPublishQueue.brandId, user.brandId));
    } else if (query.brandId) {
      conditions.push(eq(geoPublishQueue.brandId, query.brandId));
    }

    const rows = await this.db
      .select({
        accountId: geoPublishQueue.accountId,
        status: geoPublishQueue.status,
        publishedAt: geoPublishQueue.publishedAt,
        publishUrl: geoPublishQueue.publishUrl,
      })
      .from(geoPublishQueue)
      .where(conditions.length > 0 ? and(...conditions) : undefined);

    interface Acc {
      submitted: number;
      published: number;
      failed: number;
      lastPublishAt: Date | null;
      latestPublishUrl: string | null;
    }

    const byAccount = new Map<string | null, Acc>();
    for (const row of rows) {
      const key = row.accountId ?? null;
      let acc = byAccount.get(key);
      if (!acc) {
        acc = { submitted: 0, published: 0, failed: 0, lastPublishAt: null, latestPublishUrl: null };
        byAccount.set(key, acc);
      }
      acc.submitted += 1;
      if (row.status === 'published') {
        acc.published += 1;
        const pubTime = row.publishedAt ? new Date(row.publishedAt) : null;
        if (pubTime && (!acc.lastPublishAt || pubTime > acc.lastPublishAt)) {
          acc.lastPublishAt = pubTime;
          acc.latestPublishUrl = row.publishUrl;
        }
      }
      if (row.status === 'failed') acc.failed += 1;
    }

    const accountIds = [...byAccount.keys()].filter((id): id is string => !!id);
    const accountMap = new Map<string, { accountName: string; platform: string }>();
    if (accountIds.length > 0) {
      const accRows = await this.db
        .select({
          id: geoAccountAuths.id,
          accountName: geoAccountAuths.accountName,
          platform: geoAccountAuths.platform,
        })
        .from(geoAccountAuths)
        .where(inArray(geoAccountAuths.id, accountIds));
      for (const a of accRows) {
        accountMap.set(a.id, { accountName: a.accountName, platform: a.platform });
      }
    }

    const items = [...byAccount.entries()].map(([accountId, acc]) => {
      const info = accountId ? accountMap.get(accountId) : null;
      return {
        accountId,
        accountName: info?.accountName ?? (accountId ? null : '未分配账号'),
        platform: info?.platform ?? null,
        submittedCount: acc.submitted,
        publishedCount: acc.published,
        failedCount: acc.failed,
        lastPublishAt: acc.lastPublishAt ? acc.lastPublishAt.toISOString() : null,
        latestPublishUrl: acc.latestPublishUrl,
        indexed: null,
      };
    });

    items.sort((a, b) => b.publishedCount - a.publishedCount);

    return { items };
  }

  // ---------- 统一账号下拉 ----------

  async getAccounts(
    brandId: string | undefined,
    user: GeoUserCtx,
  ): Promise<UnifiedAccountOption[]> {
    const effectiveBrandId = this.resolveReadBrandId(brandId, user);

    const [authRows, channelRows] = await Promise.all([
      effectiveBrandId
        ? this.db
            .select({
              id: geoAccountAuths.id,
              accountName: geoAccountAuths.accountName,
              platform: geoAccountAuths.platform,
            })
            .from(geoAccountAuths)
            .where(eq(geoAccountAuths.brandId, effectiveBrandId))
            .orderBy(geoAccountAuths.accountName)
        : this.db
            .select({
              id: geoAccountAuths.id,
              accountName: geoAccountAuths.accountName,
              platform: geoAccountAuths.platform,
            })
            .from(geoAccountAuths)
            .orderBy(geoAccountAuths.accountName),
      effectiveBrandId
        ? this.db
            .select({
              id: geoChannels.id,
              accountName: geoChannels.accountName,
              platform: geoChannels.platform,
            })
            .from(geoChannels)
            .where(eq(geoChannels.brandId, effectiveBrandId))
            .orderBy(geoChannels.accountName)
        : this.db
            .select({
              id: geoChannels.id,
              accountName: geoChannels.accountName,
              platform: geoChannels.platform,
            })
            .from(geoChannels)
            .orderBy(geoChannels.accountName),
    ]);

    const items: UnifiedAccountOption[] = [];
    for (const row of authRows) {
      items.push({
        id: `account_auths:${row.id}`,
        accountName: row.accountName,
        platform: row.platform,
        accessType: 'client_auth',
        sourceTable: 'account_auths',
        sourceId: row.id,
      });
    }
    for (const row of channelRows) {
      items.push({
        id: `channels:${row.id}`,
        accountName: row.accountName,
        platform: row.platform,
        accessType: 'local_account',
        sourceTable: 'channels',
        sourceId: row.id,
      });
    }

    return items.sort((a, b) => a.accountName.localeCompare(b.accountName));
  }

  private resolveReadBrandId(
    queryBrandId: string | undefined,
    user: GeoUserCtx,
  ): string | undefined {
    if (user.role === 'client') {
      return user.brandId ?? undefined;
    }
    return queryBrandId;
  }
}
