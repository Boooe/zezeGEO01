import {
  Injectable,
  Inject,
  Logger,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { DRIZZLE_DATABASE, type PostgresJsDatabase } from '@lark-apaas/fullstack-nestjs-core';
import { eq, desc, count, sql, type SQL } from 'drizzle-orm';
import { pgTable, uuid, varchar, text, boolean, integer } from 'drizzle-orm/pg-core';
import type { Request } from 'express';

import { geoUsers, geoBrands, customTimestamptz, userProfile } from '@server/database/schema';
import type {
  CommitmentVersion,
  CommitmentSignature,
  CommitmentSignatureWithStatus,
  CommitmentCheckResponse,
  PagedResponse,
  UserRole,
} from '@shared/api.interface';
import {
  ListSignaturesQueryDto,
  CreateVersionDto,
  UpdateVersionDto,
} from './dto/commitment.dto';

// ---------------------------------------------------------------------------
//  临时表定义（schema.ts 未刷新前使用，列与数据库表一一对应）
// ---------------------------------------------------------------------------

const geoCommitmentVersions = pgTable('geo_commitment_versions', {
  id: uuid('id').primaryKey().defaultRandom(),
  versionCode: varchar('version_code', { length: 50 }).notNull(),
  content: text('content').notNull(),
  isActive: boolean('is_active').notNull().default(false),
  createdAt: customTimestamptz('_created_at', { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  createdBy: userProfile('_created_by'),
  updatedAt: customTimestamptz('_updated_at', { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedBy: userProfile('_updated_by'),
});

const geoCommitmentSignatures = pgTable('geo_commitment_signatures', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull(),
  brandId: uuid('brand_id').notNull(),
  versionId: uuid('version_id').notNull(),
  versionCode: varchar('version_code', { length: 50 }).notNull(),
  signMethod: varchar('sign_method', { length: 20 }).notNull(),
  clientIp: varchar('client_ip', { length: 45 }),
  userAgent: text('user_agent'),
  signedAt: customTimestamptz('signed_at', { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  needsResign: boolean('needs_resign').notNull().default(false),
  lastRemindedAt: customTimestamptz('last_reminded_at', { precision: 3 }),
  remindCount: integer('remind_count').notNull().default(0),
  createdAt: customTimestamptz('_created_at', { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: customTimestamptz('_updated_at', { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
});

// ---------------------------------------------------------------------------
//  辅助类型
// ---------------------------------------------------------------------------

interface GeoUserCtx {
  id: string;
  role: UserRole;
  brandId: string | null;
}

type SignatureStatus = 'signed' | 'unsigned' | 'resign_required';

// ---------------------------------------------------------------------------
//  Service
// ---------------------------------------------------------------------------

@Injectable()
export class CommitmentService {
  private readonly logger = new Logger(CommitmentService.name);

  constructor(
    @Inject(DRIZZLE_DATABASE) private readonly db: PostgresJsDatabase,
  ) {}

  // ============================================================
  //  版本管理
  // ============================================================

  async getActiveVersion(): Promise<CommitmentVersion | null> {
    const rows = await this.db
      .select()
      .from(geoCommitmentVersions)
      .where(eq(geoCommitmentVersions.isActive, true))
      .orderBy(desc(geoCommitmentVersions.createdAt))
      .limit(1);

    if (rows.length === 0) return null;
    return this.mapVersion(rows[0]);
  }

  async listVersions(): Promise<Array<CommitmentVersion & { signCount: number }>> {
    const versions = await this.db
      .select()
      .from(geoCommitmentVersions)
      .orderBy(desc(geoCommitmentVersions.versionCode));

    const counts = await this.db
      .select({
        versionId: geoCommitmentSignatures.versionId,
        count: count(),
      })
      .from(geoCommitmentSignatures)
      .groupBy(geoCommitmentSignatures.versionId);

    const countMap = new Map<string, number>();
    for (const c of counts) {
      countMap.set(c.versionId, Number(c.count));
    }

    return versions.map((v) => ({
      ...this.mapVersion(v),
      signCount: countMap.get(v.id) ?? 0,
    }));
  }

  async createVersion(dto: CreateVersionDto, operatorId: string): Promise<CommitmentVersion> {
    const nextVersionCode = await this.getNextVersionCode();

    const [inserted] = await this.db
      .insert(geoCommitmentVersions)
      .values({
        versionCode: nextVersionCode,
        content: dto.content,
        isActive: false,
        createdBy: operatorId,
        updatedBy: operatorId,
      })
      .returning();

    return this.mapVersion(inserted);
  }

  async updateVersion(versionId: string, dto: UpdateVersionDto, operatorId: string): Promise<CommitmentVersion> {
    const existing = await this.db
      .select()
      .from(geoCommitmentVersions)
      .where(eq(geoCommitmentVersions.id, versionId))
      .limit(1);

    if (existing.length === 0) {
      throw new NotFoundException('版本不存在');
    }

    if (existing[0].isActive) {
      throw new BadRequestException('已激活版本不可修改');
    }

    const [updated] = await this.db
      .update(geoCommitmentVersions)
      .set({
        content: dto.content,
        updatedBy: operatorId,
      })
      .where(eq(geoCommitmentVersions.id, versionId))
      .returning();

    return this.mapVersion(updated);
  }

  async activateVersion(versionId: string, operatorId: string): Promise<CommitmentVersion> {
    const existing = await this.db
      .select()
      .from(geoCommitmentVersions)
      .where(eq(geoCommitmentVersions.id, versionId))
      .limit(1);

    if (existing.length === 0) {
      throw new NotFoundException('版本不存在');
    }

    await this.db.transaction(async (tx) => {
      // 全部取消激活
      await tx
        .update(geoCommitmentVersions)
        .set({ isActive: false, updatedBy: operatorId });

      // 激活指定版本
      await tx
        .update(geoCommitmentVersions)
        .set({ isActive: true, updatedBy: operatorId })
        .where(eq(geoCommitmentVersions.id, versionId));
    });

    const refreshed = await this.db
      .select()
      .from(geoCommitmentVersions)
      .where(eq(geoCommitmentVersions.id, versionId))
      .limit(1);

    return this.mapVersion(refreshed[0]);
  }

  private async getNextVersionCode(): Promise<string> {
    const latest = await this.db
      .select({ versionCode: geoCommitmentVersions.versionCode })
      .from(geoCommitmentVersions)
      .orderBy(desc(geoCommitmentVersions.versionCode))
      .limit(1);

    if (latest.length === 0) {
      return 'v1.0';
    }

    const current = latest[0].versionCode;
    const match = current.match(/^v(\d+)\.(\d+)$/);
    if (!match) {
      return 'v1.0';
    }

    const major = Number(match[1]);
    const minor = Number(match[2]);
    return `v${major}.${minor + 1}`;
  }

  // ============================================================
  //  签署相关
  // ============================================================

  async checkNeedsSign(userId: string): Promise<CommitmentCheckResponse> {
    // 先查用户角色
    const userRows = await this.db
      .select({ role: geoUsers.role, id: geoUsers.id })
      .from(geoUsers)
      .where(eq(geoUsers.id, userId))
      .limit(1);

    if (userRows.length === 0) {
      throw new NotFoundException('用户不存在');
    }

    const userRole = userRows[0].role as UserRole;
    if (userRole !== 'client') {
      return { needsSign: false };
    }

    const activeVersion = await this.getActiveVersion();
    if (!activeVersion) {
      // 没有激活版本时不需要签
      return { needsSign: false };
    }

    const latestSig = await this.getLatestSignature(userId);

    if (!latestSig) {
      return {
        needsSign: true,
        currentVersion: activeVersion,
      };
    }

    if (latestSig.needsResign) {
      return {
        needsSign: true,
        currentVersion: activeVersion,
        latestSignature: latestSig,
      };
    }

    if (latestSig.versionCode !== activeVersion.versionCode) {
      return {
        needsSign: true,
        currentVersion: activeVersion,
        latestSignature: latestSig,
      };
    }

    return {
      needsSign: false,
      currentVersion: activeVersion,
      latestSignature: latestSig,
    };
  }

  async signCommitment(req: Request, userId: string): Promise<CommitmentSignature> {
    // 校验用户角色
    const userRows = await this.db
      .select()
      .from(geoUsers)
      .where(eq(geoUsers.id, userId))
      .limit(1);

    if (userRows.length === 0) {
      throw new NotFoundException('用户不存在');
    }

    const user = userRows[0];
    if (user.role !== 'client') {
      throw new ForbiddenException('仅客户角色可签署承诺书');
    }
    if (!user.brandId) {
      throw new BadRequestException('客户账号未绑定品牌，无法签署');
    }

    // 获取当前激活版本
    const activeVersion = await this.getActiveVersion();
    if (!activeVersion) {
      throw new BadRequestException('当前无可用的承诺书版本');
    }

    // 检查是否已签署当前版本且无需重签
    const checkResult = await this.checkNeedsSign(userId);
    if (!checkResult.needsSign) {
      throw new ConflictException('您已签署当前版本的承诺书，无需重复签署');
    }

    const clientIp = this.getIpAddress(req);
    const userAgent = req.headers['user-agent'] ?? '';

    const [inserted] = await this.db
      .insert(geoCommitmentSignatures)
      .values({
        userId,
        brandId: user.brandId ?? '',
        versionId: activeVersion.id,
        versionCode: activeVersion.versionCode,
        signMethod: 'checkbox',
        clientIp,
        userAgent,
        signedAt: new Date(),
      })
      .returning();

    return this.mapSignature(inserted, user.username, user.brandId ?? null, null);
  }

  // ============================================================
  //  签署记录列表（管理员 / 运营）
  // ============================================================

  async listSignatures(
    query: ListSignaturesQueryDto,
  ): Promise<PagedResponse<CommitmentSignatureWithStatus>> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const keyword = query.keyword?.trim();
    const statusFilter = query.status;
    const versionCode = query.versionCode;

    const activeVersion = await this.getActiveVersion();
    const activeVersionCode = activeVersion?.versionCode ?? '';

    // 使用 SQL 数组动态拼接 where 条件
    const whereChunks: SQL[] = [];

    // 只统计 client 角色且状态为 active 的用户
    whereChunks.push(sql`u.role = 'client'`);
    whereChunks.push(sql`u.status = 'active'`);

    if (keyword) {
      const likePattern = `%${keyword}%`;
      whereChunks.push(sql`(u.username ILIKE ${likePattern} OR b.name ILIKE ${likePattern})`);
    }

    if (versionCode) {
      whereChunks.push(sql`ls.version_code = ${versionCode}`);
    }

    // 状态过滤
    if (statusFilter === 'unsigned') {
      whereChunks.push(sql`ls.id IS NULL`);
    } else if (statusFilter === 'signed') {
      whereChunks.push(
        sql`ls.id IS NOT NULL AND ls.needs_resign = false AND ls.version_code = ${activeVersionCode}`,
      );
    } else if (statusFilter === 'resign_required') {
      whereChunks.push(
        sql`ls.id IS NOT NULL AND (ls.needs_resign = true OR ls.version_code <> ${activeVersionCode})`,
      );
    }

    const whereSql = sql`WHERE ${sql.join(whereChunks, sql` AND `)}`;

    const offset = (page - 1) * pageSize;

    // 总数
    const countSql = sql`
      SELECT COUNT(*) AS total
      FROM geo_users u
      LEFT JOIN geo_brands b ON u.brand_id = b.id
      LEFT JOIN LATERAL (
        SELECT s.*
        FROM geo_commitment_signatures s
        WHERE s.user_id = u.id
        ORDER BY s.signed_at DESC
        LIMIT 1
      ) ls ON true
      ${whereSql}
    `;

    const countResult = await this.db.execute(countSql);
    const countRows = countResult as unknown as Array<{ total: string }>;
    const total = Number(countRows[0]?.total ?? 0);

    // 分页数据
    const dataSql = sql`
      SELECT
        ls.id,
        u.id AS user_id,
        u.username,
        u.display_name,
        u.brand_id,
        b.name AS brand_name,
        ls.version_id,
        ls.version_code,
        ls.sign_method,
        ls.client_ip,
        ls.user_agent,
        ls.signed_at,
        ls.needs_resign,
        ls.remind_count,
        ls.last_reminded_at,
        CASE
          WHEN ls.id IS NULL THEN 'unsigned'
          WHEN ls.needs_resign = true THEN 'resign_required'
          WHEN ls.version_code <> ${activeVersionCode} THEN 'resign_required'
          ELSE 'signed'
        END AS status
      FROM geo_users u
      LEFT JOIN geo_brands b ON u.brand_id = b.id
      LEFT JOIN LATERAL (
        SELECT s.*
        FROM geo_commitment_signatures s
        WHERE s.user_id = u.id
        ORDER BY s.signed_at DESC
        LIMIT 1
      ) ls ON true
      ${whereSql}
      ORDER BY ls.signed_at DESC NULLS LAST, u._created_at DESC
      LIMIT ${pageSize} OFFSET ${offset}
    `;

    const dataResult = await this.db.execute(dataSql);
    const rows = dataResult as unknown as Array<{
      id: string | null;
      user_id: string;
      username: string;
      display_name: string | null;
      brand_id: string | null;
      brand_name: string | null;
      version_id: string | null;
      version_code: string | null;
      sign_method: string | null;
      client_ip: string | null;
      user_agent: string | null;
      signed_at: Date | null;
      needs_resign: boolean | null;
      remind_count: number | null;
      last_reminded_at: Date | null;
      status: SignatureStatus;
    }>;

    const items: CommitmentSignatureWithStatus[] = rows.map((row) => ({
      id: row.id ?? '',
      userId: row.user_id,
      brandId: row.brand_id,
      brandName: row.brand_name ?? '',
      username: row.username,
      versionId: row.version_id,
      versionCode: row.version_code,
      signMethod: row.sign_method,
      clientIp: row.client_ip,
      userAgent: row.user_agent,
      signedAt: row.signed_at ? new Date(row.signed_at as unknown as string).toISOString() : null,
      needsResign: row.needs_resign ?? false,
      remindCount: row.remind_count ?? 0,
      lastRemindedAt: row.last_reminded_at ? new Date(row.last_reminded_at as unknown as string).toISOString() : null,
      status: row.status,
    }));

    return { items, total, page, pageSize };
  }

  async getSignatureDetail(id: string): Promise<{
    signature: CommitmentSignature;
    versionContent: string | null;
  }> {
    const rows = await this.db
      .select({
        sig: geoCommitmentSignatures,
        username: geoUsers.username,
        brandName: geoBrands.name,
        brandId: geoUsers.brandId,
        versionContent: geoCommitmentVersions.content,
      })
      .from(geoCommitmentSignatures)
      .leftJoin(geoUsers, eq(geoCommitmentSignatures.userId, geoUsers.id))
      .leftJoin(geoBrands, eq(geoCommitmentSignatures.brandId, geoBrands.id))
      .leftJoin(geoCommitmentVersions, eq(geoCommitmentSignatures.versionId, geoCommitmentVersions.id))
      .where(eq(geoCommitmentSignatures.id, id))
      .limit(1);

    if (rows.length === 0) {
      throw new NotFoundException('签署记录不存在');
    }

    const row = rows[0];
    return {
      signature: this.mapSignature(row.sig, row.username ?? '', row.brandId ?? null, row.brandName ?? null),
      versionContent: row.versionContent ?? null,
    };
  }

  // ============================================================
  //  要求重签 / 提醒签署
  // ============================================================

  async requireResign(userId: string, operatorId: string): Promise<{ success: boolean; message: string }> {
    const userRows = await this.db
      .select({ id: geoUsers.id, role: geoUsers.role })
      .from(geoUsers)
      .where(eq(geoUsers.id, userId))
      .limit(1);

    if (userRows.length === 0) {
      throw new NotFoundException('用户不存在');
    }

    if (userRows[0].role !== 'client') {
      throw new BadRequestException('仅客户角色可被要求重签');
    }

    const latest = await this.db
      .select()
      .from(geoCommitmentSignatures)
      .where(eq(geoCommitmentSignatures.userId, userId))
      .orderBy(desc(geoCommitmentSignatures.signedAt))
      .limit(1);

    if (latest.length === 0) {
      // 未签署本身就是未签状态，不创建记录
      return { success: true, message: '用户尚未签署过承诺书，无需额外标记' };
    }

    if (latest[0].needsResign) {
      return { success: true, message: '已标记需重签，无需重复操作' };
    }

    await this.db
      .update(geoCommitmentSignatures)
      .set({ needsResign: true })
      .where(eq(geoCommitmentSignatures.id, latest[0].id));

    return { success: true, message: '已标记需重签' };
  }

  async remindSign(userId: string): Promise<{ success: boolean; remindCount: number }> {
    const userRows = await this.db
      .select({ id: geoUsers.id, role: geoUsers.role })
      .from(geoUsers)
      .where(eq(geoUsers.id, userId))
      .limit(1);

    if (userRows.length === 0) {
      throw new NotFoundException('用户不存在');
    }

    const latest = await this.db
      .select()
      .from(geoCommitmentSignatures)
      .where(eq(geoCommitmentSignatures.userId, userId))
      .orderBy(desc(geoCommitmentSignatures.signedAt))
      .limit(1);

    if (latest.length === 0) {
      // 没有签署记录也可以提醒，返回 0 次
      return { success: true, remindCount: 0 };
    }

    const newCount = (latest[0].remindCount ?? 0) + 1;
    await this.db
      .update(geoCommitmentSignatures)
      .set({
        lastRemindedAt: new Date(),
        remindCount: newCount,
      })
      .where(eq(geoCommitmentSignatures.id, latest[0].id));

    return { success: true, remindCount: newCount };
  }

  // ============================================================
  //  CSV 导出
  // ============================================================

  async exportSignaturesCsv(query: ListSignaturesQueryDto): Promise<string> {
    // 不分页获取全部数据
    const allQuery: ListSignaturesQueryDto = {
      ...query,
      page: 1,
      pageSize: 10000,
    };

    const result = await this.listSignatures(allQuery);

    const headers = [
      '客户账号',
      '品牌名称',
      '签署状态',
      '版本号',
      '签署时间',
      '签署IP',
      '用户代理',
      '提醒次数',
      '上次提醒时间',
    ];

    const statusLabels: Record<SignatureStatus, string> = {
      signed: '已签署',
      unsigned: '未签署',
      resign_required: '需重签',
    };

    const rows = result.items.map((item) => [
      item.username,
      item.brandName ?? '',
      statusLabels[item.status],
      item.versionCode ?? '',
      item.signedAt ?? '',
      item.clientIp ?? '',
      (item.userAgent ?? '').replace(/"/g, '""'),
      String(item.remindCount),
      item.lastRemindedAt ?? '',
    ]);

    const csvLines = [
      headers.join(','),
      ...rows.map((r) => r.map((cell) => `"${cell}"`).join(',')),
    ];

    return csvLines.join('\n');
  }

  // ============================================================
  //  辅助方法
  // ============================================================

  private async getLatestSignature(userId: string): Promise<CommitmentSignature | null> {
    const rows = await this.db
      .select({
        sig: geoCommitmentSignatures,
        username: geoUsers.username,
        brandName: geoBrands.name,
      })
      .from(geoCommitmentSignatures)
      .leftJoin(geoUsers, eq(geoCommitmentSignatures.userId, geoUsers.id))
      .leftJoin(geoBrands, eq(geoCommitmentSignatures.brandId, geoBrands.id))
      .where(eq(geoCommitmentSignatures.userId, userId))
      .orderBy(desc(geoCommitmentSignatures.signedAt))
      .limit(1);

    if (rows.length === 0) return null;
    const row = rows[0];
    return this.mapSignature(row.sig, row.username ?? '', row.sig.brandId, row.brandName ?? null);
  }

  private mapVersion(v: typeof geoCommitmentVersions.$inferSelect): CommitmentVersion {
    return {
      id: v.id,
      versionCode: v.versionCode,
      content: v.content,
      isActive: v.isActive,
      createdAt: new Date(v.createdAt).toISOString(),
    };
  }

  private mapSignature(
    s: typeof geoCommitmentSignatures.$inferSelect,
    username: string,
    brandId: string | null,
    brandName: string | null,
  ): CommitmentSignature {
    return {
      id: s.id,
      userId: s.userId,
      brandId,
      brandName: brandName ?? '',
      username,
      versionId: s.versionId,
      versionCode: s.versionCode,
      signMethod: s.signMethod,
      clientIp: s.clientIp ?? null,
      userAgent: s.userAgent ?? null,
      signedAt: new Date(s.signedAt).toISOString(),
      needsResign: s.needsResign,
      remindCount: s.remindCount ?? 0,
      lastRemindedAt: s.lastRemindedAt ? new Date(s.lastRemindedAt).toISOString() : null,
    };
  }

  private getIpAddress(req: Request): string {
    const forwarded = req.headers['x-forwarded-for'];
    if (typeof forwarded === 'string' && forwarded.length > 0) {
      return forwarded.split(',')[0].trim();
    }
    return req.ip ?? '';
  }
}
