import { Injectable, Inject, Logger, UnauthorizedException } from '@nestjs/common';
import { DRIZZLE_DATABASE, type PostgresJsDatabase } from '@lark-apaas/fullstack-nestjs-core';
import { eq, and, asc, inArray, sql } from 'drizzle-orm';
import type { Request } from 'express';

import {
  geoKeywordTasks,
  geoKeywords,
  geoKeywordResults,
  geoAutoTokens,
  geoVideoTasks,
} from '@server/database/schema';
import type { TaskResultDto, VideoTaskResultDto } from './dto/automation.dto';

@Injectable()
export class AutomationService {
  private readonly logger = new Logger(AutomationService.name);

  constructor(
    @Inject(DRIZZLE_DATABASE) private readonly db: PostgresJsDatabase,
  ) {}

  // ---------- Token 鉴权 ----------

  async validateAutoToken(req: Request): Promise<string> {
    const token = req.headers['x-auto-token'];
    if (!token || typeof token !== 'string') {
      throw new UnauthorizedException('Invalid or missing automation token');
    }

    const tokens = await this.db
      .select({ id: geoAutoTokens.id, status: geoAutoTokens.status })
      .from(geoAutoTokens)
      .where(eq(geoAutoTokens.token, token))
      .limit(1);

    if (tokens.length === 0 || tokens[0].status !== 'active') {
      throw new UnauthorizedException('Invalid or missing automation token');
    }

    // 更新 last_used_at
    await this.db
      .update(geoAutoTokens)
      .set({ lastUsedAt: new Date() })
      .where(eq(geoAutoTokens.id, tokens[0].id));

    return tokens[0].id;
  }

  // ---------- 拉取任务 ----------

  async pullTasks(limit: number): Promise<Array<{
    id: string;
    keyword: string;
    platform: string;
    city: string | null;
  }>> {
    const actualLimit = limit && limit > 0 && limit <= 50 ? limit : 10;

    // 在事务中：查 pending → 标记为 running → 返回
    return this.db.transaction(async (tx) => {
      // 先取 pending 任务，按 created_at 升序
      const tasks = await tx
        .select({
          id: geoKeywordTasks.id,
          keywordId: geoKeywordTasks.keywordId,
          platform: geoKeywordTasks.platform,
          city: geoKeywordTasks.city,
        })
        .from(geoKeywordTasks)
        .where(eq(geoKeywordTasks.status, 'pending'))
        .orderBy(asc(geoKeywordTasks.createdAt))
        .limit(actualLimit);

      if (tasks.length === 0) {
        return [];
      }

      const taskIds = tasks.map((t) => t.id);

      // 批量更新状态为 running
      await tx
        .update(geoKeywordTasks)
        .set({ status: 'running' })
        .where(inArray(geoKeywordTasks.id, taskIds));

      // 查出关键词文本
      const keywordIds = tasks.map((t) => t.keywordId);
      const keywordRows = await tx
        .select({ id: geoKeywords.id, keyword: geoKeywords.keyword })
        .from(geoKeywords)
        .where(inArray(geoKeywords.id, keywordIds));

      const keywordMap = new Map(keywordRows.map((row) => [row.id, row.keyword]));

      return tasks.map((task) => ({
        id: task.id,
        keyword: keywordMap.get(task.keywordId) ?? '',
        platform: task.platform,
        city: task.city,
      }));
    });
  }

  // ---------- 回传结果 ----------

  async submitResults(results: TaskResultDto[]): Promise<{ success: number }> {
    let successCount = 0;

    for (const result of results) {
      try {
        // 验证任务存在
        const tasks = await this.db
          .select({
            id: geoKeywordTasks.id,
            keywordId: geoKeywordTasks.keywordId,
            brandId: geoKeywordTasks.brandId,
            platform: geoKeywordTasks.platform,
            city: geoKeywordTasks.city,
            isExample: geoKeywordTasks.isExample,
          })
          .from(geoKeywordTasks)
          .where(eq(geoKeywordTasks.id, result.taskId))
          .limit(1);

        if (tasks.length === 0) {
          this.logger.warn(`结果回传：任务不存在 taskId=${result.taskId}`);
          continue;
        }

        const task = tasks[0];
        const isFailed = Boolean(result.error);
        const newStatus = isFailed ? 'failed' : 'completed';

        await this.db.transaction(async (tx) => {
          if (isFailed) {
            // 失败时也写入结果（is_hit=false + error）
            await tx
              .insert(geoKeywordResults)
              .values({
                taskId: result.taskId,
                keywordId: task.keywordId,
                brandId: task.brandId,
                platform: task.platform,
                city: task.city,
                isHit: false,
                position: null,
                snippet: null,
                url: null,
                error: result.error,
                detectedAt: new Date(),
                isExample: task.isExample,
              })
              .onConflictDoUpdate({
                target: geoKeywordResults.taskId,
                set: {
                  isHit: false,
                  position: null,
                  snippet: null,
                  url: null,
                  error: result.error,
                  detectedAt: new Date(),
                },
              });
          } else {
            // 成功写入
            await tx
              .insert(geoKeywordResults)
              .values({
                taskId: result.taskId,
                keywordId: task.keywordId,
                brandId: task.brandId,
                platform: task.platform,
                city: task.city,
                isHit: result.hit,
                position: result.position ?? null,
                snippet: result.snippet ?? null,
                url: result.url ?? null,
                error: null,
                detectedAt: new Date(),
                isExample: task.isExample,
              })
              .onConflictDoUpdate({
                target: geoKeywordResults.taskId,
                set: {
                  isHit: result.hit,
                  position: result.position ?? null,
                  snippet: result.snippet ?? null,
                  url: result.url ?? null,
                  error: null,
                  detectedAt: new Date(),
                },
              });
          }

          // 更新任务状态
          await tx
            .update(geoKeywordTasks)
            .set({ status: newStatus })
            .where(eq(geoKeywordTasks.id, result.taskId));
        });

        successCount += 1;
      } catch (error) {
        this.logger.error(`结果回传失败 taskId=${result.taskId}`, error);
        // 单条失败不影响其他
      }
    }

    return { success: successCount };
  }

  // ---------- 视频任务：拉取 ----------

  async pullVideoTasks(limit: number): Promise<Array<{
    id: string;
    brandId: string;
    purpose: string;
    topic: string;
    scriptText: string | null;
    duration: string;
    ratio: string;
    style: string | null;
    coverImage: string | null;
  }>> {
    const actualLimit = limit && limit > 0 && limit <= 50 ? limit : 10;

    return this.db.transaction(async (tx) => {
      const tasks = await tx
        .select({
          id: geoVideoTasks.id,
          brandId: geoVideoTasks.brandId,
          purpose: geoVideoTasks.purpose,
          topic: geoVideoTasks.topic,
          scriptText: geoVideoTasks.scriptText,
          duration: geoVideoTasks.duration,
          ratio: geoVideoTasks.ratio,
          style: geoVideoTasks.style,
          coverImage: geoVideoTasks.coverImage,
        })
        .from(geoVideoTasks)
        .where(eq(geoVideoTasks.status, 'pending'))
        .orderBy(asc(geoVideoTasks.createdAt))
        .limit(actualLimit);

      if (tasks.length === 0) {
        return [];
      }

      const taskIds = tasks.map((t) => t.id);

      await tx
        .update(geoVideoTasks)
        .set({ status: 'processing' })
        .where(inArray(geoVideoTasks.id, taskIds));

      return tasks.map((task) => ({
        id: task.id,
        brandId: task.brandId,
        purpose: task.purpose,
        topic: task.topic,
        scriptText: task.scriptText ?? null,
        duration: task.duration,
        ratio: task.ratio,
        style: task.style ?? null,
        coverImage: task.coverImage ?? null,
      }));
    });
  }

  // ---------- 视频任务：回传结果 ----------

  async submitVideoResults(results: VideoTaskResultDto[]): Promise<{ success: number }> {
    let successCount = 0;

    for (const result of results) {
      try {
        const tasks = await this.db
          .select({
            id: geoVideoTasks.id,
            status: geoVideoTasks.status,
          })
          .from(geoVideoTasks)
          .where(eq(geoVideoTasks.id, result.taskId))
          .limit(1);

        if (tasks.length === 0) {
          this.logger.warn(`视频结果回传：任务不存在 taskId=${result.taskId}`);
          continue;
        }

        const isFailed = result.status === 'failed';
        const newStatus = isFailed ? 'failed' : 'completed';

        const patch: Partial<typeof geoVideoTasks.$inferInsert> = {
          status: newStatus,
          updatedAt: new Date(),
        };

        if (isFailed) {
          patch.error = result.error ?? '生成失败';
        } else {
          patch.videoUrl = result.videoUrl ?? null;
          patch.videoCoverUrl = result.coverUrl ?? null;
          patch.error = null;
        }

        await this.db
          .update(geoVideoTasks)
          .set(patch)
          .where(eq(geoVideoTasks.id, result.taskId));

        successCount += 1;
      } catch (error) {
        this.logger.error(`视频结果回传失败 taskId=${result.taskId}`, error);
      }
    }

    return { success: successCount };
  }
}
