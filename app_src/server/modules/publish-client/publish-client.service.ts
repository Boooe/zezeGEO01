import { Inject, Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { DRIZZLE_DATABASE, type PostgresJsDatabase } from '@lark-apaas/fullstack-nestjs-core';
import { eq, and, desc, gt, count, inArray } from 'drizzle-orm';
import { randomBytes } from 'crypto';

import { geoAccountAuths, geoPublishQueue, geoPublishRecords, geoSubmissionChannels } from '@server/database/schema';
import type {
  ClientBindResponse,
  ClientHeartbeatResponse,
  ClientTaskItem,
  ClientTaskListResponse,
  AuthStatus,
  AccountPlatform,
} from '@shared/api.interface';

const SYSTEM_CREATOR_ID = 'dfba5028-5208-4289-abca-6d39a9920748';

@Injectable()
export class PublishClientService {
  private readonly logger = new Logger(PublishClientService.name);

  constructor(
    @Inject(DRIZZLE_DATABASE) private readonly db: PostgresJsDatabase,
  ) {}

  async bind(authCode: string, clientVersion?: string): Promise<ClientBindResponse> {
    const now = new Date();

    const rows = await this.db
      .select()
      .from(geoAccountAuths)
      .where(eq(geoAccountAuths.authCode, authCode));

    if (rows.length === 0) {
      throw new BadRequestException('授权码无效');
    }

    const account = rows[0];

    if (account.authCodeExpiresAt && new Date(account.authCodeExpiresAt) < now) {
      throw new BadRequestException('授权码已过期，请重新生成');
    }

    const token = this.generateToken();

    const updatedRows = await this.db
      .update(geoAccountAuths)
      .set({
        authStatus: 'authorized',
        lastAuthAt: now,
        lastHeartbeatAt: now,
        clientToken: token,
        clientVersion: clientVersion ?? null,
        authCode: null,
        authCodeExpiresAt: null,
      })
      .where(eq(geoAccountAuths.id, account.id))
      .returning();

    if (updatedRows.length === 0) {
      throw new BadRequestException('绑定失败');
    }

    return {
      token,
      accountId: account.id,
      platform: account.platform as AccountPlatform,
      accountName: account.accountName,
    };
  }

  async heartbeat(token: string, clientVersion?: string): Promise<ClientHeartbeatResponse> {
    const now = new Date();

    const rows = await this.db
      .select()
      .from(geoAccountAuths)
      .where(eq(geoAccountAuths.clientToken, token));

    if (rows.length === 0) {
      throw new BadRequestException('无效的客户端令牌');
    }

    const patch: Partial<typeof geoAccountAuths.$inferInsert> = {
      lastHeartbeatAt: now,
    };
    if (clientVersion) {
      patch.clientVersion = clientVersion;
    }

    await this.db
      .update(geoAccountAuths)
      .set(patch)
      .where(eq(geoAccountAuths.id, rows[0].id));

    return {
      ok: true,
      nextHeartbeatIn: 60,
    };
  }

  async listClients(brandId?: string): Promise<any[]> {
    const conditions = [eq(geoAccountAuths.authStatus, 'authorized' as AuthStatus)];
    if (brandId) {
      conditions.push(eq(geoAccountAuths.brandId, brandId));
    }

    const rows = await this.db
      .select()
      .from(geoAccountAuths)
      .where(and(...conditions))
      .orderBy(desc(geoAccountAuths.lastHeartbeatAt));

    const now = Date.now();
    return rows.map((row) => ({
      id: row.id,
      accountName: row.accountName,
      platform: row.platform,
      authMethod: row.authMethod,
      clientVersion: row.clientVersion,
      lastHeartbeatAt: row.lastHeartbeatAt
        ? new Date(row.lastHeartbeatAt).toISOString()
        : null,
      onlineStatus: row.lastHeartbeatAt
        && now - new Date(row.lastHeartbeatAt).getTime() < 10 * 60 * 1000
        ? 'online'
        : 'offline',
    }));
  }

  async pullTasks(token: string): Promise<ClientTaskListResponse> {
    const accountRows = await this.db
      .select()
      .from(geoAccountAuths)
      .where(eq(geoAccountAuths.clientToken, token));

    if (accountRows.length === 0) {
      throw new BadRequestException('无效的客户端令牌');
    }

    const account = accountRows[0];
    const now = new Date();

    const pendingRows = await this.db
      .select()
      .from(geoPublishQueue)
      .where(and(
        eq(geoPublishQueue.accountId, account.id),
        eq(geoPublishQueue.status, 'pending_client' as any),
      ))
      .orderBy(desc(geoPublishQueue.createdAt))
      .limit(10);

    if (pendingRows.length === 0) {
      return { tasks: [] };
    }

    const channelIds = pendingRows
      .map((r) => r.channelId)
      .filter((id): id is string => !!id);

    const channelMap = new Map<string, { name: string; channelType: string }>();
    if (channelIds.length > 0) {
      const chRows = await this.db
        .select({
          id: geoSubmissionChannels.id,
          name: geoSubmissionChannels.name,
          channelType: geoSubmissionChannels.channelType,
        })
        .from(geoSubmissionChannels)
        .where(inArray(geoSubmissionChannels.id, channelIds));
      for (const ch of chRows) {
        channelMap.set(ch.id, { name: ch.name, channelType: ch.channelType });
      }
    }

    const tasks: ClientTaskItem[] = [];
    for (const row of pendingRows) {
      const channel = row.channelId ? channelMap.get(row.channelId) : undefined;

      await this.db
        .update(geoPublishQueue)
        .set({
          status: 'client_running' as any,
          clientClaimedAt: now,
        })
        .where(eq(geoPublishQueue.id, row.id));

      tasks.push({
        id: row.id,
        title: row.title,
        content: row.content,
        coverUrl: row.coverUrl,
        tags: row.tags ?? [],
        platform: account.platform as AccountPlatform,
        accountName: account.accountName,
        channelName: channel?.name ?? null,
        claimedAt: now.toISOString(),
      });
    }

    return { tasks };
  }

  async reportTaskResult(
    token: string,
    taskId: string,
    success: boolean,
    publishUrl?: string,
    error?: string,
    publishedAt?: string,
  ): Promise<{ ok: true }> {
    const accountRows = await this.db
      .select()
      .from(geoAccountAuths)
      .where(eq(geoAccountAuths.clientToken, token));

    if (accountRows.length === 0) {
      throw new BadRequestException('无效的客户端令牌');
    }

    const account = accountRows[0];

    const existingRows = await this.db
      .select()
      .from(geoPublishQueue)
      .where(eq(geoPublishQueue.id, taskId));

    if (existingRows.length === 0) {
      throw new NotFoundException('任务不存在');
    }

    const existing = existingRows[0];

    if (existing.accountId !== account.id) {
      throw new BadRequestException('该任务不属于此账号');
    }

    let channel: typeof geoSubmissionChannels.$inferSelect | undefined;
    if (existing.channelId) {
      const channels = await this.db
        .select()
        .from(geoSubmissionChannels)
        .where(eq(geoSubmissionChannels.id, existing.channelId));
      channel = channels[0];
    }

    await this.db.transaction(async (tx) => {
      if (success) {
        const pubDate = publishedAt ? new Date(publishedAt) : new Date();

        await tx
          .update(geoPublishQueue)
          .set({
            status: 'published',
            publishUrl: publishUrl ?? null,
            publishedAt: pubDate,
            error: null,
          })
          .where(eq(geoPublishQueue.id, taskId));

        if (channel) {
          await tx.insert(geoPublishRecords).values({
            brandId: existing.brandId,
            taskId: existing.taskId ?? null,
            contentType: 'article',
            title: existing.title,
            externalUrl: publishUrl ?? null,
            platform: channel.channelType,
            status: 'published',
            publishDate: pubDate,
            notes: `来源：发布客户端；渠道：${channel.name}；账号：${account.accountName}`,
            creatorId: SYSTEM_CREATOR_ID,
            accountId: account.id,
          });
        }
      } else {
        await tx
          .update(geoPublishQueue)
          .set({
            status: 'failed',
            error: error ?? '客户端发布失败',
          })
          .where(eq(geoPublishQueue.id, taskId));
      }
    });

    return { ok: true };
  }

  private generateToken(): string {
    return randomBytes(32).toString('hex');
  }
}
