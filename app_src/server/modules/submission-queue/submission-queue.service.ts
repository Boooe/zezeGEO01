import {
  Injectable,
  Inject,
  Logger,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { DRIZZLE_DATABASE, type PostgresJsDatabase } from '@lark-apaas/fullstack-nestjs-core';
import { eq, and, desc, count, gte, lt, like } from 'drizzle-orm';

import {
  geoSubmissionQueue,
  geoSubmissionChannels,
  geoArticles,
  geoPublishRecords,
} from '@server/database/schema';
import type {
  SubmissionQueueItem,
  SubmissionQueueListResponse,
  UserRole,
  PendingSubmissionTask,
  SubmissionChannelType,
} from '@shared/api.interface';
import {
  SubmissionQueueListQueryDto,
  EnqueueSubmissionDto,
  SubmissionStatusUpdateDto,
  SubmissionResultDto,
} from './dto/submission-queue.dto';

interface GeoUserCtx {
  id: string;
  role: UserRole;
  brandId: string | null;
}

const SYSTEM_CREATOR_ID = 'dfba5028-5208-4289-abca-6d39a9920748';

@Injectable()
export class SubmissionQueueService {
  private readonly logger = new Logger(SubmissionQueueService.name);

  constructor(
    @Inject(DRIZZLE_DATABASE) private readonly db: PostgresJsDatabase,
  ) {}

  // ---------- 列表 ----------

  async listQueue(
    query: SubmissionQueueListQueryDto,
    user: GeoUserCtx,
  ): Promise<SubmissionQueueListResponse> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;

    const conditions = this.buildWhere(query, user);

    const baseQuery = this.db
      .select({
        queue: geoSubmissionQueue,
        channelName: geoSubmissionChannels.name,
        channelType: geoSubmissionChannels.channelType,
      })
      .from(geoSubmissionQueue)
      .leftJoin(
        geoSubmissionChannels,
        eq(geoSubmissionQueue.channelId, geoSubmissionChannels.id),
      );

    const dataQuery = conditions.length > 0
      ? baseQuery.where(and(...conditions))
      : baseQuery;

    // count 从主表查
    const countBase = this.db
      .select({ count: count() })
      .from(geoSubmissionQueue);
    const countQuery = conditions.length > 0
      ? countBase.where(and(...conditions))
      : countBase;

    const [rowsRaw, totalResult] = await Promise.all([
      dataQuery
        .orderBy(desc(geoSubmissionQueue.createdAt))
        .limit(pageSize)
        .offset((page - 1) * pageSize),
      countQuery,
    ]);

    const items: SubmissionQueueItem[] = rowsRaw.map((row) =>
      this.toQueueItem(row.queue, row.channelName ?? '', row.channelType as SubmissionChannelType),
    );

    return {
      items,
      total: Number(totalResult[0]?.count ?? 0),
      page,
      pageSize,
    };
  }

  // ---------- 入队 ----------

  async enqueue(
    dto: EnqueueSubmissionDto,
    user: GeoUserCtx,
  ): Promise<SubmissionQueueItem> {
    // 查文章
    const articles = await this.db
      .select()
      .from(geoArticles)
      .where(eq(geoArticles.id, dto.articleId));

    if (articles.length === 0) {
      throw new NotFoundException('文章不存在');
    }

    const article = articles[0];

    // 品牌权限
    if (user.role === 'client') {
      if (user.brandId !== article.brandId) {
        throw new ForbiddenException('无权操作其他品牌文章');
      }
    }

    // 查渠道
    const channels = await this.db
      .select()
      .from(geoSubmissionChannels)
      .where(eq(geoSubmissionChannels.id, dto.channelId));

    if (channels.length === 0) {
      throw new NotFoundException('投稿渠道不存在');
    }

    const channel = channels[0];

    // client 只能操作自己品牌渠道
    if (user.role === 'client' && user.brandId !== channel.brandId) {
      throw new ForbiddenException('无权操作其他品牌渠道');
    }

    // 校验渠道与文章属于同一品牌
    if (article.brandId !== channel.brandId) {
      throw new BadRequestException('文章与渠道品牌不一致');
    }

    const inserted = await this.db
      .insert(geoSubmissionQueue)
      .values({
        brandId: article.brandId,
        articleId: article.id,
        channelId: channel.id,
        title: article.title,
        content: article.content,
        tags: article.keywords ?? [],
        coverUrl: article.coverImage,
        wordCount: article.wordCount ?? 0,
        status: 'pending',
        submitUrl: channel.submitUrl,
        creatorId: user.id,
      })
      .returning();

    return this.toQueueItem(
      inserted[0],
      channel.name,
      channel.channelType as SubmissionChannelType,
    );
  }

  // ---------- 状态流转 ----------

  async updateStatus(
    id: string,
    dto: SubmissionStatusUpdateDto,
    user: GeoUserCtx,
  ): Promise<SubmissionQueueItem> {
    const existing = await this.findOrThrow(id);
    this.ensureBrandAccess(existing.brandId, user);

    // 查渠道
    const channels = await this.db
      .select()
      .from(geoSubmissionChannels)
      .where(eq(geoSubmissionChannels.id, existing.channelId));
    const channel = channels[0];

    const result = await this.db.transaction(async (tx) => {
      const patch: Partial<typeof geoSubmissionQueue.$inferInsert> = {
        status: dto.status,
      };

      // indexed 时保存收录链接和时间
      if (dto.status === 'indexed') {
        if (dto.url) {
          patch.indexedUrl = dto.url;
        }
        patch.indexedAt = dto.indexedAt ?? new Date();
      }

      // rejected 时保存拒绝信息
      if (dto.status === 'rejected') {
        if (dto.rejectReason !== undefined) {
          patch.rejectReason = dto.rejectReason;
        }
        if (dto.rejectCategory !== undefined) {
          patch.rejectCategory = dto.rejectCategory;
        }
      }

      const updatedRows = await tx
        .update(geoSubmissionQueue)
        .set(patch)
        .where(eq(geoSubmissionQueue.id, id))
        .returning();

      if (updatedRows.length === 0) {
        throw new NotFoundException('队列项不存在');
      }

      // 标记已收录时写入发布记录表
      if (dto.status === 'indexed' && dto.url) {
        await tx.insert(geoPublishRecords).values({
          brandId: existing.brandId,
          taskId: existing.articleId,
          contentType: 'article',
          title: existing.title,
          externalUrl: dto.url,
          platform: 'submission',
          status: 'published',
          publishDate: dto.indexedAt ?? new Date(),
          notes: `来源：投稿渠道；渠道：${channel?.name ?? '未知'}`,
          creatorId: user.id,
        });
      }

      return updatedRows[0];
    });

    return this.toQueueItem(
      result,
      channel?.name ?? '',
      (channel?.channelType as SubmissionChannelType) ?? 'public_submission',
    );
  }

  // ---------- 拉取待投稿任务（公开接口）----------

  async pullPending(limit: number): Promise<PendingSubmissionTask[]> {
    const actualLimit = limit ?? 10;

    const pendingRows = await this.db
      .select({
        queue: geoSubmissionQueue,
        channelName: geoSubmissionChannels.name,
        channelType: geoSubmissionChannels.channelType,
        submitUrl: geoSubmissionChannels.submitUrl,
        requiredFields: geoSubmissionChannels.requiredFields,
      })
      .from(geoSubmissionQueue)
      .leftJoin(
        geoSubmissionChannels,
        eq(geoSubmissionQueue.channelId, geoSubmissionChannels.id),
      )
      .where(eq(geoSubmissionQueue.status, 'pending'))
      .orderBy(geoSubmissionQueue.createdAt)
      .limit(actualLimit);

    const tasks: PendingSubmissionTask[] = pendingRows.map((row) => ({
      id: row.queue.id,
      title: row.queue.title,
      content: row.queue.content,
      tags: row.queue.tags ?? [],
      coverUrl: row.queue.coverUrl,
      channelId: row.queue.channelId,
      channelName: row.channelName ?? '',
      channelType: (row.channelType as SubmissionChannelType) ?? 'public_submission',
      submitUrl: row.submitUrl ?? null,
      requiredFields: row.requiredFields ?? [],
    }));

    return tasks;
  }

  // ---------- 回传结果（公开接口）----------

  async reportResult(
    id: string,
    dto: SubmissionResultDto,
  ): Promise<{ success: true }> {
    const existing = await this.findOrThrow(id);

    if (dto.status === 'success') {
      await this.db
        .update(geoSubmissionQueue)
        .set({
          status: 'submitted',
          screenshotUrl: dto.screenshotUrl ?? null,
          errorMessage: null,
        })
        .where(eq(geoSubmissionQueue.id, id));
    } else {
      await this.db
        .update(geoSubmissionQueue)
        .set({
          status: 'failed',
          errorMessage: dto.error ?? null,
          screenshotUrl: dto.screenshotUrl ?? null,
        })
        .where(eq(geoSubmissionQueue.id, id));
    }

    return { success: true };
  }

  // ---------- 删除 ----------

  async delete(id: string, user: GeoUserCtx): Promise<{ success: true }> {
    const existing = await this.findOrThrow(id);
    this.ensureBrandAccess(existing.brandId, user);

    const deleted = await this.db
      .delete(geoSubmissionQueue)
      .where(eq(geoSubmissionQueue.id, id))
      .returning({ id: geoSubmissionQueue.id });

    if (deleted.length === 0) {
      throw new NotFoundException('队列项不存在');
    }

    return { success: true };
  }

  // ---------- 内部方法 ----------

  private buildWhere(
    query: SubmissionQueueListQueryDto,
    user: GeoUserCtx,
  ): Array<ReturnType<typeof eq> | ReturnType<typeof gte> | ReturnType<typeof lt> | ReturnType<typeof like>> {
    const conditions: Array<
      ReturnType<typeof eq> | ReturnType<typeof gte> | ReturnType<typeof lt> | ReturnType<typeof like>
    > = [];

    // client 只能看自己品牌
    if (user.role === 'client') {
      if (user.brandId) {
        conditions.push(eq(geoSubmissionQueue.brandId, user.brandId));
      } else {
        conditions.push(eq(geoSubmissionQueue.brandId, '' as any));
      }
    } else if (query.brandId) {
      conditions.push(eq(geoSubmissionQueue.brandId, query.brandId));
    }

    if (query.channelId) {
      conditions.push(eq(geoSubmissionQueue.channelId, query.channelId));
    }
    if (query.status) {
      conditions.push(eq(geoSubmissionQueue.status, query.status));
    }
    if (query.startDate) {
      conditions.push(gte(geoSubmissionQueue.createdAt, query.startDate));
    }
    if (query.endDate) {
      const endDay = new Date(query.endDate);
      endDay.setDate(endDay.getDate() + 1);
      conditions.push(lt(geoSubmissionQueue.createdAt, endDay));
    }
    if (query.keyword) {
      conditions.push(like(geoSubmissionQueue.title, `%${query.keyword}%`));
    }

    return conditions;
  }

  private async findOrThrow(
    id: string,
  ): Promise<typeof geoSubmissionQueue.$inferSelect> {
    const rows = await this.db
      .select()
      .from(geoSubmissionQueue)
      .where(eq(geoSubmissionQueue.id, id));

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
    row: typeof geoSubmissionQueue.$inferSelect,
    channelName: string,
    channelType: SubmissionChannelType,
  ): SubmissionQueueItem {
    return {
      id: row.id,
      brandId: row.brandId,
      articleId: row.articleId,
      channelId: row.channelId,
      channelName,
      channelType,
      title: row.title,
      content: row.content,
      tags: row.tags ?? [],
      coverUrl: row.coverUrl,
      wordCount: row.wordCount ?? 0,
      status: row.status as SubmissionQueueItem['status'],
      submitUrl: row.submitUrl,
      indexedUrl: row.indexedUrl,
      indexedAt: row.indexedAt
        ? new Date(row.indexedAt).toISOString()
        : null,
      rejectReason: row.rejectReason,
      rejectCategory: row.rejectCategory,
      createdAt: new Date(row.createdAt).toISOString(),
    };
  }
}
