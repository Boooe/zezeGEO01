import {
  Injectable,
  Inject,
  Logger,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { DRIZZLE_DATABASE, type PostgresJsDatabase } from '@lark-apaas/fullstack-nestjs-core';
import { createHash } from 'crypto';
import { eq, and, desc, count, ilike, or, sql, type SQL } from 'drizzle-orm';

import { geoAccountAuths, geoChannels, geoBrands } from '@server/database/schema';
import type {
  AccountAuth,
  AccountAuthListResponse,
  AccountAuthCodeResponse,
  AccountPlatformCard,
  UserRole,
  AccountPlatform,
  AuthStatus,
  OnlineStatus,
  AuthMethod,
  UnifiedAccount,
  UnifiedAccountListResponse,
  PlatformCapabilitiesResponse,
  AuthorizeCodeResponse,
  ResolveCodeResponse,
  UnifiedAccountV2,
  UnifiedAccountListResponseV2,
  AuthMode,
  SessionState,
} from '@shared/api.interface';
import { RESOLVE_CODE_ERRORS } from '@shared/api.interface';
import { ACCOUNT_PLATFORMS, AUTH_METHODS } from '@shared/api.interface';
import {
  AccountAuthListQueryDto,
  CreateAccountAuthDto,
  UpdateAccountAuthDto,
} from './dto/account-auths.dto';
import {
  UnifiedAccountListQueryDto,
  CreateUnifiedAccountDto,
  AuthorizeCodeDto,
  AccountSessionDto,
  AccountHeartbeatDto,
} from './dto/unified-account.dto';

interface GeoUserCtx {
  id: string;
  role: UserRole;
  brandId: string | null;
}

const HEARTBEAT_THRESHOLD_MS = 10 * 60 * 1000; // 10 分钟

@Injectable()
export class AccountAuthsService {
  private readonly logger = new Logger(AccountAuthsService.name);

  constructor(
    @Inject(DRIZZLE_DATABASE) private readonly db: PostgresJsDatabase,
  ) {}

  // ---------- 列表 ----------

  async list(
    query: AccountAuthListQueryDto,
    user: GeoUserCtx,
  ): Promise<AccountAuthListResponse> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;

    const conditions = this.buildWhere(query, user);

    const baseQuery = this.db.select().from(geoAccountAuths);
    const dataQuery = conditions.length > 0
      ? baseQuery.where(and(...conditions))
      : baseQuery;

    const [itemsRaw, totalResult] = await Promise.all([
      dataQuery
        .orderBy(desc(geoAccountAuths.createdAt))
        .limit(pageSize)
        .offset((page - 1) * pageSize),
      this.db
        .select({ count: count() })
        .from(geoAccountAuths)
        .where(conditions.length > 0 ? and(...conditions) : undefined),
    ]);

    const items: AccountAuth[] = itemsRaw.map((row) => this.toAccountAuth(row));

    return {
      items,
      total: Number(totalResult[0]?.count ?? 0),
      page,
      pageSize,
    };
  }

  // ---------- 平台卡片 ----------

  async platformCards(
    brandId: string | undefined,
    user: GeoUserCtx,
  ): Promise<AccountPlatformCard[]> {
    const effectiveBrandId = this.resolveReadBrandId(brandId, user);

    const conditions: Array<ReturnType<typeof eq>> = [];
    if (effectiveBrandId) {
      conditions.push(eq(geoAccountAuths.brandId, effectiveBrandId));
    }

    const allRows = conditions.length > 0
      ? await this.db.select().from(geoAccountAuths).where(and(...conditions))
      : await this.db.select().from(geoAccountAuths);

    const byPlatform = new Map<string, typeof geoAccountAuths.$inferSelect[]>();
    for (const row of allRows) {
      const list = byPlatform.get(row.platform) ?? [];
      list.push(row);
      byPlatform.set(row.platform, list);
    }

    const cards: AccountPlatformCard[] = ACCOUNT_PLATFORMS.map(
      (platform: AccountPlatform): AccountPlatformCard => {
        const rows = byPlatform.get(platform) ?? [];
        const sorted = rows.sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
        );
        const authorizedCount = sorted.filter(
          (r) => r.authStatus === 'authorized',
        ).length;

        return {
          platform,
          total: sorted.length,
          authorized: authorizedCount,
          accounts: sorted.map((row) => this.toAccountAuth(row)),
        };
      },
    );

    return cards;
  }

  // ---------- 创建 ----------

  async create(
    dto: CreateAccountAuthDto,
    user: GeoUserCtx,
  ): Promise<AccountAuth> {
    if (user.role === 'client' && user.brandId !== dto.brandId) {
      throw new ForbiddenException('无权为其他品牌创建账号授权');
    }

    const inserted = await this.db
      .insert(geoAccountAuths)
      .values({
        brandId: dto.brandId,
        platform: dto.platform,
        accountName: dto.accountName,
        accountIdentifier: dto.accountIdentifier ?? null,
        authMethod: dto.authMethod,
        remark: dto.remark ?? null,
      })
      .returning();

    return this.toAccountAuth(inserted[0]);
  }

  // ---------- 更新 ----------

  async update(
    id: string,
    dto: UpdateAccountAuthDto,
    user: GeoUserCtx,
  ): Promise<AccountAuth> {
    const existing = await this.findOrThrow(id);
    this.ensureBrandAccess(existing.brandId, user);

    const patch: Partial<typeof geoAccountAuths.$inferInsert> = {};
    if (dto.accountName !== undefined) patch.accountName = dto.accountName;
    if (dto.accountIdentifier !== undefined) {
      patch.accountIdentifier = dto.accountIdentifier ?? null;
    }
    if (dto.authMethod !== undefined) patch.authMethod = dto.authMethod;
    if (dto.remark !== undefined) patch.remark = dto.remark ?? null;

    if (Object.keys(patch).length === 0) {
      throw new BadRequestException('未提供可更新字段');
    }

    const updated = await this.db
      .update(geoAccountAuths)
      .set(patch)
      .where(eq(geoAccountAuths.id, id))
      .returning();

    if (updated.length === 0) {
      throw new NotFoundException('账号授权不存在');
    }

    return this.toAccountAuth(updated[0]);
  }

  // ---------- 删除 ----------

  async remove(id: string, user: GeoUserCtx): Promise<void> {
    const existing = await this.findOrThrow(id);
    this.ensureBrandAccess(existing.brandId, user);

    const deleted = await this.db
      .delete(geoAccountAuths)
      .where(eq(geoAccountAuths.id, id))
      .returning({ id: geoAccountAuths.id });

    if (deleted.length === 0) {
      throw new NotFoundException('账号授权不存在');
    }
  }

  // ---------- 生成授权码 ----------

  async generateAuthCode(
    id: string,
    user: GeoUserCtx,
  ): Promise<AccountAuthCodeResponse> {
    const existing = await this.findOrThrow(id);
    this.ensureBrandAccess(existing.brandId, user);

    const authCode = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    const updated = await this.db
      .update(geoAccountAuths)
      .set({
        authCode,
        authCodeExpiresAt: expiresAt,
      })
      .where(eq(geoAccountAuths.id, id))
      .returning();

    if (updated.length === 0) {
      throw new NotFoundException('账号授权不存在');
    }

    return {
      authCode,
      expiresAt: expiresAt.toISOString(),
    };
  }

  // ---------- 解绑 ----------

  async unbind(
    id: string,
    user: GeoUserCtx,
  ): Promise<AccountAuth> {
    const existing = await this.findOrThrow(id);
    this.ensureBrandAccess(existing.brandId, user);

    const updated = await this.db
      .update(geoAccountAuths)
      .set({
        authStatus: 'unauthorized',
        lastHeartbeatAt: null,
        authCode: null,
        authCodeExpiresAt: null,
        clientVersion: null,
      })
      .where(eq(geoAccountAuths.id, id))
      .returning();

    if (updated.length === 0) {
      throw new NotFoundException('账号授权不存在');
    }

    return this.toAccountAuth(updated[0]);
  }

  // ---------- 内部方法 ----------

  private buildWhere(
    query: AccountAuthListQueryDto,
    user: GeoUserCtx,
  ): SQL[] {
    const conditions: SQL[] = [];

    const brandId = this.resolveReadBrandId(query.brandId, user);
    if (brandId) {
      conditions.push(eq(geoAccountAuths.brandId, brandId));
    }

    if (query.platform) {
      conditions.push(eq(geoAccountAuths.platform, query.platform));
    }
    if (query.authStatus) {
      conditions.push(eq(geoAccountAuths.authStatus, query.authStatus));
    }
    if (query.keyword) {
      const keyword = `%${query.keyword}%`;
      conditions.push(
        or(
          ilike(geoAccountAuths.accountName, keyword),
          ilike(geoAccountAuths.accountIdentifier, keyword),
        ),
      );
    }

    return conditions;
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

  private async findOrThrow(
    id: string,
  ): Promise<typeof geoAccountAuths.$inferSelect> {
    const rows = await this.db
      .select()
      .from(geoAccountAuths)
      .where(eq(geoAccountAuths.id, id));

    if (rows.length === 0) {
      throw new NotFoundException('账号授权不存在');
    }

    return rows[0];
  }

  private ensureBrandAccess(brandId: string, user: GeoUserCtx): void {
    if (user.role === 'client' && user.brandId !== brandId) {
      throw new ForbiddenException('无权访问其他品牌数据');
    }
  }

  private calculateOnlineStatus(
    lastHeartbeatAt: Date | null,
  ): OnlineStatus {
    if (!lastHeartbeatAt) return 'offline';
    const now = Date.now();
    const heartbeatTime = new Date(lastHeartbeatAt).getTime();
    return now - heartbeatTime <= HEARTBEAT_THRESHOLD_MS
      ? 'online'
      : 'offline';
  }

  private toAccountAuth(
    row: typeof geoAccountAuths.$inferSelect,
  ): AccountAuth {
    return {
      id: row.id,
      brandId: row.brandId,
      platform: row.platform as AccountPlatform,
      accountName: row.accountName,
      accountIdentifier: row.accountIdentifier,
      authMethod: row.authMethod as AuthMethod,
      authStatus: row.authStatus as AuthStatus,
      lastAuthAt: row.lastAuthAt
        ? new Date(row.lastAuthAt).toISOString()
        : null,
      lastHeartbeatAt: row.lastHeartbeatAt
        ? new Date(row.lastHeartbeatAt).toISOString()
        : null,
      onlineStatus: this.calculateOnlineStatus(row.lastHeartbeatAt),
      clientVersion: row.clientVersion,
      remark: row.remark,
      createdAt: new Date(row.createdAt).toISOString(),
      updatedAt: new Date(row.updatedAt).toISOString(),
    };
  }

  // ---------- 平台能力 ----------

  getPlatformCapabilities(): PlatformCapabilitiesResponse {
    return {
      platforms: [
        { key: 'wechat', name: '微信公众号', oauth: true, oauthNote: '需认证公众号 AppID+Secret', qr: true, password: true },
        { key: 'weibo', name: '微博', oauth: true, oauthNote: '需创建应用并过审，发布权限单独申请', qr: true, password: true },
        { key: 'douyin', name: '抖音', oauth: true, oauthNote: '仅企业号+应用审核', qr: true, password: true },
        { key: 'toutiao', name: '今日头条', oauth: true, oauthNote: '需媒体资质申请', qr: true, password: true },
        { key: 'bilibili', name: 'B站', oauth: true, oauthNote: '需申请开放平台', qr: true, password: true },
        { key: 'baijiahao', name: '百家号', oauth: false, oauthNote: '无公开 API，仅支持扫码授权', qr: true, password: true },
        { key: 'zhihu', name: '知乎', oauth: false, oauthNote: '无发布 API，仅支持扫码授权', qr: true, password: true },
        { key: 'xiaohongshu', name: '小红书', oauth: false, oauthNote: '无发文 API，仅支持扫码授权', qr: true, password: true },
        { key: 'sohu', name: '搜狐号', oauth: false, oauthNote: '无公开 API，仅支持扫码授权', qr: true, password: true },
        { key: 'netease', name: '网易号', oauth: false, oauthNote: '无公开 API，仅支持扫码授权', qr: true, password: true },
        { key: 'ifeng', name: '凤凰号', oauth: false, oauthNote: '无公开 API，仅支持扫码授权', qr: true, password: true },
        { key: 'qq', name: '企鹅号', oauth: false, oauthNote: '无公开 API，仅支持扫码授权', qr: true, password: true },
      ],
    };
  }

  // ---------- 生成授权码 ----------

  async generateAuthorizeCode(
    dto: AuthorizeCodeDto,
    user: GeoUserCtx,
  ): Promise<AuthorizeCodeResponse> {
    if (user.role === 'client' && user.brandId !== dto.brandId) {
      throw new ForbiddenException('无权为其他品牌创建授权码');
    }

    const code = this.generateAuthCodeString();
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000);

    const inserted = await this.db
      .insert(geoAccountAuths)
      .values({
        brandId: dto.brandId,
        platform: dto.platform,
        accountName: '待命名账号',
        authMethod: dto.authMode === 'qr' ? 'client' : 'manual',
        authMode: dto.authMode,
        sessionState: 'valid',
        authCodePlain: code,
        authCodeExpiresAt: expiresAt,
      })
      .returning({ id: geoAccountAuths.id });

    return {
      accountId: inserted[0].id,
      code,
      expiresAt: expiresAt.toISOString(),
    };
  }

  private generateAuthCodeString(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let result = '';
    for (let i = 0; i < 8; i += 1) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return `${result.slice(0, 4)}-${result.slice(4)}`;
  }

  // ---------- 授权码解析 ----------

  async resolveAuthorizeCode(
    code: string,
  ): Promise<ResolveCodeResponse> {
    const normalizedCode = code.replace(/-/g, '').toUpperCase();

    const rows = await this.db
      .select({
        id: geoAccountAuths.id,
        platform: geoAccountAuths.platform,
        brandId: geoAccountAuths.brandId,
        authCodePlain: geoAccountAuths.authCodePlain,
        authCodeExpiresAt: geoAccountAuths.authCodeExpiresAt,
      })
      .from(geoAccountAuths)
      .where(sql`REPLACE(UPPER(auth_code_plain), '-', '') = ${normalizedCode}`);

    if (rows.length === 0) {
      throw new NotFoundException(RESOLVE_CODE_ERRORS.NOT_FOUND);
    }

    const row = rows[0];
    if (!row.authCodePlain || !row.authCodeExpiresAt) {
      throw new NotFoundException(RESOLVE_CODE_ERRORS.EXPIRED);
    }

    const now = new Date();
    const expiresAt = new Date(row.authCodeExpiresAt);
    if (now > expiresAt) {
      throw new NotFoundException(RESOLVE_CODE_ERRORS.EXPIRED);
    }

    return {
      accountId: row.id,
      platform: row.platform,
      brandId: row.brandId,
      expiresAt: expiresAt.toISOString(),
    };
  }

  // ---------- 会话回传 ----------

  async setAccountSession(
    id: string,
    dto: AccountSessionDto,
  ): Promise<{ ok: true }> {
    const existing = await this.findOrThrow(id);

    const source = dto.cookieText || dto.token;
    if (!source) {
      throw new BadRequestException('cookieText 或 token 必须提供一个');
    }
    const sessionHash = createHash('sha256').update(source).digest('hex');

    const now = new Date();
    const sessionExpiresAt = dto.expiresAt
      ? new Date(dto.expiresAt)
      : new Date(Date.now() + 7 * 24 * 3600 * 1000);

    const patch: Partial<typeof geoAccountAuths.$inferInsert> = {
      authMode: dto.authMode,
      sessionState: 'valid',
      sessionHash,
      sessionExpiresAt,
      lastHeartbeatAt: now,
      clientVersion: dto.clientId ?? null,
      authCodeExpiresAt: new Date(0),
    };

    if (dto.platformAccountName) {
      patch.accountName = dto.platformAccountName;
    }

    const updated = await this.db
      .update(geoAccountAuths)
      .set(patch)
      .where(eq(geoAccountAuths.id, id))
      .returning({ id: geoAccountAuths.id });

    if (updated.length === 0) {
      throw new NotFoundException('账号不存在');
    }

    return { ok: true };
  }

  // ---------- 心跳 ----------

  async heartbeat(
    id: string,
    dto: AccountHeartbeatDto,
  ): Promise<{ ok: true }> {
    const existing = await this.findOrThrow(id);

    const checkedAt = dto.checkedAt ? new Date(dto.checkedAt) : new Date();
    const sessionState: SessionState = dto.ok ? 'valid' : 'expired';

    const patch: Partial<typeof geoAccountAuths.$inferInsert> = {
      sessionState,
    };

    if (dto.ok) {
      patch.lastHeartbeatAt = checkedAt;
    }

    const updated = await this.db
      .update(geoAccountAuths)
      .set(patch)
      .where(eq(geoAccountAuths.id, id))
      .returning({ id: geoAccountAuths.id });

    if (updated.length === 0) {
      throw new NotFoundException('账号不存在');
    }

    return { ok: true };
  }

  // ---------- 清会话 ----------

  async clearSession(
    id: string,
    user: GeoUserCtx,
  ): Promise<{ ok: true }> {
    const existing = await this.findOrThrow(id);
    this.ensureBrandAccess(existing.brandId, user);

    const updated = await this.db
      .update(geoAccountAuths)
      .set({
        sessionHash: null,
        sessionExpiresAt: null,
        sessionState: 'expired',
        authCodePlain: null,
        authCodeExpiresAt: null,
      })
      .where(eq(geoAccountAuths.id, id))
      .returning({ id: geoAccountAuths.id });

    if (updated.length === 0) {
      throw new NotFoundException('账号不存在');
    }

    return { ok: true };
  }

  // ---------- 统一账号列表 ----------

  async listUnified(
    query: UnifiedAccountListQueryDto,
    user: GeoUserCtx,
  ): Promise<UnifiedAccountListResponseV2> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;

    const { whereSql } = this.buildUnifiedWhere(query, user);
    const offset = (page - 1) * pageSize;

    const [listResult, countResult, statsResult] = await Promise.all([
      this.db.execute(sql`
        SELECT
          u.source_table,
          u.source_id,
          u.account_name,
          u.platform,
          u.access_type,
          u.status,
          u.auth_mode,
          u.session_state,
          u.session_expires_at,
          u.has_session,
          u.last_heartbeat_at,
          u.brand_id,
          b.name AS brand_name,
          u.updated_at
        FROM (
          SELECT
            'account_auths' AS source_table,
            id AS source_id,
            account_name,
            platform,
            'client_auth' AS access_type,
            auth_status AS status,
            auth_mode,
            session_state,
            session_expires_at,
            CASE WHEN session_hash IS NOT NULL AND session_hash <> '' THEN true WHEN auth_status = 'authorized' THEN true ELSE false END AS has_session,
            last_heartbeat_at,
            brand_id,
            _updated_at AS updated_at
          FROM geo_account_auths
          UNION ALL
          SELECT
            'channels' AS source_table,
            id AS source_id,
            account_name,
            platform,
            'local_account' AS access_type,
            status,
            'password' AS auth_mode,
            CASE
              WHEN status = 'active' THEN 'valid'
              WHEN status = 'paused' THEN 'paused'
              ELSE 'expired'
            END AS session_state,
            NULL::timestamptz AS session_expires_at,
            CASE WHEN status = 'active' THEN true ELSE false END AS has_session,
            last_published_at AS last_heartbeat_at,
            brand_id,
            _updated_at AS updated_at
          FROM geo_channels
        ) u
        LEFT JOIN geo_brands b ON b.id = u.brand_id
        ${whereSql}
        ORDER BY u.updated_at DESC
        LIMIT ${pageSize} OFFSET ${offset}
      `),
      this.db.execute(sql`
        SELECT COUNT(*) AS total
        FROM (
          SELECT id, brand_id, platform, auth_status AS status, account_name, 'client_auth' AS access_type, _updated_at
          FROM geo_account_auths
          UNION ALL
          SELECT id, brand_id, platform, status, account_name, 'local_account' AS access_type, _updated_at
          FROM geo_channels
        ) u
        ${whereSql}
      `),
      this.getPlatformStatsRaw(query.brandId, user),
    ]);

    const items: UnifiedAccountV2[] = (listResult as unknown as Array<Record<string, unknown>>).map(
      (row: Record<string, unknown>): UnifiedAccountV2 => {
        const sessionState = row.session_state as SessionState;
        const rawExpiresAt = row.session_expires_at
          ? new Date(row.session_expires_at as string | Date)
          : null;
        const lastHeartbeat = row.last_heartbeat_at
          ? new Date(row.last_heartbeat_at as string | Date)
          : null;

        let expiresAt: string | null = rawExpiresAt
          ? rawExpiresAt.toISOString()
          : null;
        if (sessionState === 'valid' && !expiresAt && lastHeartbeat) {
          const fallback = new Date(lastHeartbeat.getTime() + 7 * 24 * 3600 * 1000);
          expiresAt = fallback.toISOString();
        }

        return {
          id: `${row.source_table as string}:${row.source_id as string}`,
          accountName: row.account_name as string,
          platform: row.platform as string,
          accessType: row.access_type as UnifiedAccountV2['accessType'],
          authMode: row.auth_mode as AuthMode,
          sessionState,
          expiresAt,
          lastHeartbeatAt: lastHeartbeat ? lastHeartbeat.toISOString() : null,
          hasSession: Boolean(row.has_session),
          brandId: row.brand_id as string,
          brandName: (row.brand_name as string | null) ?? null,
          sourceTable: row.source_table as 'account_auths' | 'channels',
          sourceId: row.source_id as string,
        };
      },
    );

    const totalRow = (countResult as unknown as Array<Record<string, unknown>>)[0];
    const total = Number(totalRow?.total ?? 0);

    const platformStats = (statsResult as unknown as Array<Record<string, unknown>>).map(
      (row: Record<string, unknown>) => ({
        platform: row.platform as string,
        total: Number(row.total),
        authorized: Number(row.authorized),
      }),
    );

    return {
      items,
      total,
      platformStats,
    };
  }

  // ---------- 平台统计 ----------

  async getPlatformStats(
    brandId: string | undefined,
    user: GeoUserCtx,
  ): Promise<UnifiedAccountListResponseV2['platformStats']> {
    const result = await this.getPlatformStatsRaw(brandId, user);
    return (result as unknown as Array<Record<string, unknown>>).map(
      (row: Record<string, unknown>) => ({
        platform: row.platform as string,
        total: Number(row.total),
        authorized: Number(row.authorized),
      }),
    );
  }

  private getPlatformStatsRaw(
    brandId: string | undefined,
    user: GeoUserCtx,
  ): Promise<unknown> {
    const effectiveBrandId = this.resolveReadBrandId(brandId, user);
    const brandCondition = effectiveBrandId
      ? sql`WHERE u.brand_id = ${effectiveBrandId}`
      : sql``;

    return this.db.execute(sql`
      SELECT
        u.platform,
        COUNT(*) AS total,
        SUM(CASE WHEN u.status = 'authorized' OR u.status = 'active' THEN 1 ELSE 0 END) AS authorized
      FROM (
        SELECT brand_id, platform, auth_status AS status FROM geo_account_auths
        UNION ALL
        SELECT brand_id, platform, status FROM geo_channels
      ) u
      ${brandCondition}
      GROUP BY u.platform
      ORDER BY u.platform
    `);
  }

  // ---------- 创建统一账号 ----------

  async createUnified(
    dto: CreateUnifiedAccountDto,
    user: GeoUserCtx,
  ): Promise<UnifiedAccount> {
    if (user.role === 'client' && user.brandId !== dto.brandId) {
      throw new ForbiddenException('无权为其他品牌创建账号');
    }

    if (dto.accessType === 'client_auth') {
      const accountName = dto.accountName?.trim();
      if (!accountName) {
        throw new BadRequestException('客户端授权账号名称不能为空');
      }
      const inserted = await this.db
        .insert(geoAccountAuths)
        .values({
          brandId: dto.brandId,
          platform: dto.platform,
          accountName,
          authMethod: 'client',
          remark: dto.remark ?? null,
        })
        .returning();

      const brand = await this.getBrandName(dto.brandId);
      const row = inserted[0];
      return {
        id: `account_auths:${row.id}`,
        accountName: row.accountName,
        platform: row.platform,
        accessType: 'client_auth',
        status: row.authStatus,
        lastHeartbeatAt: row.lastHeartbeatAt
          ? new Date(row.lastHeartbeatAt).toISOString()
          : null,
        brandId: row.brandId,
        brandName: brand,
        sourceTable: 'account_auths',
        sourceId: row.id,
      };
    }

    if (dto.accessType === 'local_account' || dto.accessType === 'cookie') {
      const accountName = (dto.accountNameLocal ?? dto.accountName)?.trim();
      if (!accountName) {
        throw new BadRequestException('本地账号名称不能为空');
      }
      const config: Record<string, unknown> = {};
      if (dto.cookie) {
        config.cookie = dto.cookie;
      }
      if (dto.remark) {
        config.remark = dto.remark;
      }
      const inserted = await this.db
        .insert(geoChannels)
        .values({
          brandId: dto.brandId,
          platform: dto.platform,
          accountName,
          publishMode: 'local_auto',
          dailyLimit: 3,
          bindStatus: 'unbound',
          status: 'active',
          config: Object.keys(config).length > 0 ? config : undefined,
          remark: dto.remark ?? null,
        })
        .returning();

      const brand = await this.getBrandName(dto.brandId);
      const row = inserted[0];
      return {
        id: `channels:${row.id}`,
        accountName: row.accountName,
        platform: row.platform,
        accessType: dto.accessType,
        status: row.status,
        lastHeartbeatAt: row.lastPublishedAt
          ? new Date(row.lastPublishedAt).toISOString()
          : null,
        brandId: row.brandId,
        brandName: brand,
        sourceTable: 'channels',
        sourceId: row.id,
      };
    }

    throw new BadRequestException('不支持的接入方式');
  }

  private async getBrandName(brandId: string): Promise<string | null> {
    const rows = await this.db
      .select({ name: geoBrands.name })
      .from(geoBrands)
      .where(eq(geoBrands.id, brandId));
    return rows[0]?.name ?? null;
  }

  private buildUnifiedWhere(
    query: UnifiedAccountListQueryDto,
    user: GeoUserCtx,
  ): { whereSql: SQL; params: Record<string, unknown> } {
    const conditions: SQL[] = [];

    const brandId = this.resolveReadBrandId(query.brandId, user);
    if (brandId) {
      conditions.push(sql`u.brand_id = ${brandId}`);
    }
    if (query.platform) {
      conditions.push(sql`u.platform = ${query.platform}`);
    }
    if (query.accessType) {
      conditions.push(sql`u.access_type = ${query.accessType}`);
    }
    if (query.status) {
      conditions.push(sql`u.status = ${query.status}`);
    }
    if (query.keyword) {
      const keyword = `%${query.keyword}%`;
      conditions.push(sql`u.account_name ILIKE ${keyword}`);
    }

    const whereSql = conditions.length > 0
      ? sql`WHERE ${sql.join(conditions, sql` AND `)}`
      : sql``;

    return { whereSql, params: {} };
  }
}
