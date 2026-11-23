import {
  Injectable,
  Inject,
  Logger,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  HttpException,
} from '@nestjs/common';
import { DRIZZLE_DATABASE, type PostgresJsDatabase } from '@lark-apaas/fullstack-nestjs-core';
import { eq, and, asc, count, ilike, or, gt, sql, inArray, isNull, desc } from 'drizzle-orm';
import type { SQL } from 'drizzle-orm';

import { geoSubmissionChannels, geoSubmissionQueue, geoSourceTagLogs, geoSourceUrlLogs, geoSourceDomainMap } from '@server/database/schema';
import { AuditLogService } from '../audit-log/audit-log.service';
import {
  SUBMISSION_CHANNEL_TIERS,
  DIAGNOSIS_PLATFORMS,
} from '@shared/api.interface';
import type {
  SubmissionChannel,
  SubmissionChannelListResponse,
  UserRole,
  SubmissionChannelType,
  SubmissionChannelStatus,
  SubmissionAiSource,
  SubmissionIndustry,
  SubmissionChannelStats,
  SubmissionChannelImportPreview,
  SubmissionChannelImportConfirmResponse,
  EliminationScanResult,
  EliminationScanItem,
  SubmissionChannelTier,
  DiagnosisPlatform,
  SubmissionLibraryType,
  SubmissionMediaType,
  BatchTagResponse,
  SourceTagLogListResponse,
  SourceTagLog,
  BatchSheetResponse,
  BatchSheetItem,
  AutoSelectChannelsResult,
  AutoSelectChannelItem,
  SubmissionUrlStats,
  BatchUrlPatchResult,
  SourceUrlLogListResponse,
  SourceUrlLog,
  UpdateChannelPriceResponse,
  BulkChannelPriceResponse,
} from '@shared/api.interface';
import {
  SubmissionChannelQueryDto,
  CreateSubmissionChannelDto,
  UpdateSubmissionChannelDto,
  EliminationBatchDto,
  BatchTagDto,
  BatchSheetQueryDto,
  AutoSelectDto,
  BatchUrlPatchDto,
  UpdateChannelPriceDto,
  BulkChannelPriceDto,
} from './dto/submission-channels.dto';

interface GeoUserCtx {
  id: string;
  role: UserRole;
  brandId: string | null;
  username?: string;
  displayName?: string | null;
}

interface PresetChannel {
  name: string;
  channelType: SubmissionChannelType;
  submitUrl?: string;
  costPerArticle: number;
  dailyLimit: number;
  reviewHours: number;
  aiSources: SubmissionAiSource[];
  industries: SubmissionIndustry[];
}

const PRESET_CHANNELS: PresetChannel[] = [
  // A. 权威媒体（8 条）
  { name: '人民网', channelType: 'authoritative_media', submitUrl: 'http://www.people.com.cn', costPerArticle: 0, dailyLimit: 5, reviewHours: 72, aiSources: ['doubao', 'deepseek', 'wenxin', 'tongyi', 'kimi'], industries: ['general'] },
  { name: '新华网', channelType: 'authoritative_media', submitUrl: 'http://www.xinhuanet.com', costPerArticle: 0, dailyLimit: 5, reviewHours: 72, aiSources: ['doubao', 'deepseek', 'wenxin', 'tongyi', 'kimi'], industries: ['general'] },
  { name: '中国网', channelType: 'authoritative_media', submitUrl: 'http://www.china.com.cn', costPerArticle: 0, dailyLimit: 5, reviewHours: 72, aiSources: ['doubao', 'wenxin', 'tongyi'], industries: ['general'] },
  { name: '中华网', channelType: 'authoritative_media', submitUrl: 'https://www.chinanews.com.cn', costPerArticle: 0, dailyLimit: 5, reviewHours: 48, aiSources: ['doubao', 'wenxin', 'tongyi'], industries: ['general'] },
  { name: '央广网', channelType: 'authoritative_media', submitUrl: 'https://www.cnr.cn', costPerArticle: 0, dailyLimit: 5, reviewHours: 72, aiSources: ['doubao', 'deepseek', 'tongyi'], industries: ['general'] },
  { name: '光明网', channelType: 'authoritative_media', submitUrl: 'https://www.gmw.cn', costPerArticle: 0, dailyLimit: 5, reviewHours: 72, aiSources: ['doubao', 'deepseek', 'wenxin', 'kimi'], industries: ['general'] },
  { name: '河北新闻网', channelType: 'authoritative_media', submitUrl: 'https://www.hebnews.cn', costPerArticle: 0, dailyLimit: 3, reviewHours: 48, aiSources: ['doubao', 'wenxin'], industries: ['general'] },
  { name: '石家庄新闻网', channelType: 'authoritative_media', submitUrl: 'https://www.sjznews.com', costPerArticle: 0, dailyLimit: 3, reviewHours: 48, aiSources: ['doubao', 'wenxin'], industries: ['general'] },

  // B. 自媒体站（9 条）
  { name: '知乎', channelType: 'public_submission', submitUrl: 'https://www.zhihu.com', costPerArticle: 0, dailyLimit: 10, reviewHours: 24, aiSources: ['doubao', 'deepseek', 'kimi', 'yuanbao'], industries: ['general'] },
  { name: '百度百家号', channelType: 'public_submission', submitUrl: 'https://baijiahao.baidu.com', costPerArticle: 0, dailyLimit: 10, reviewHours: 24, aiSources: ['doubao', 'wenxin'], industries: ['general'] },
  { name: '今日头条', channelType: 'public_submission', submitUrl: 'https://mp.toutiao.com', costPerArticle: 0, dailyLimit: 10, reviewHours: 24, aiSources: ['doubao', 'wenxin', 'kimi'], industries: ['general'] },
  { name: '搜狐号', channelType: 'public_submission', submitUrl: 'https://mp.sohu.com', costPerArticle: 0, dailyLimit: 10, reviewHours: 24, aiSources: ['doubao', 'deepseek', 'kimi'], industries: ['general'] },
  { name: '网易号', channelType: 'public_submission', submitUrl: 'https://mp.163.com', costPerArticle: 0, dailyLimit: 10, reviewHours: 24, aiSources: ['doubao', 'deepseek'], industries: ['general'] },
  { name: '新浪看点', channelType: 'public_submission', submitUrl: 'https://mp.sina.com.cn', costPerArticle: 0, dailyLimit: 10, reviewHours: 24, aiSources: ['doubao', 'wenxin'], industries: ['general'] },
  { name: '微信公众号', channelType: 'public_submission', submitUrl: 'https://mp.weixin.qq.com', costPerArticle: 0, dailyLimit: 10, reviewHours: 24, aiSources: ['doubao', 'deepseek', 'wenxin', 'tongyi', 'yuanbao', 'kimi'], industries: ['general'] },
  { name: '小红书', channelType: 'public_submission', submitUrl: 'https://www.xiaohongshu.com', costPerArticle: 0, dailyLimit: 10, reviewHours: 24, aiSources: ['doubao', 'deepseek', 'kimi', 'yuanbao'], industries: ['general', 'bakery', 'mother_baby', 'catering'] },
  { name: '哔哩哔哩专栏', channelType: 'public_submission', submitUrl: 'https://www.bilibili.com', costPerArticle: 0, dailyLimit: 10, reviewHours: 24, aiSources: ['doubao', 'deepseek', 'kimi'], industries: ['general'] },

  // C. 问答与知识（5 条）
  { name: '百度知道', channelType: 'public_submission', submitUrl: 'https://zhidao.baidu.com', costPerArticle: 0, dailyLimit: 10, reviewHours: 24, aiSources: ['doubao', 'wenxin'], industries: ['general'] },
  { name: '知乎问答', channelType: 'public_submission', submitUrl: 'https://www.zhihu.com', costPerArticle: 0, dailyLimit: 10, reviewHours: 24, aiSources: ['doubao', 'deepseek', 'kimi', 'yuanbao'], industries: ['general'] },
  { name: '搜搜问问', channelType: 'public_submission', submitUrl: 'https://wenwen.sogou.com', costPerArticle: 0, dailyLimit: 5, reviewHours: 48, aiSources: ['doubao', 'wenxin'], industries: ['general'] },
  { name: '豆瓣', channelType: 'public_submission', submitUrl: 'https://www.douban.com', costPerArticle: 0, dailyLimit: 5, reviewHours: 24, aiSources: ['doubao', 'deepseek', 'kimi'], industries: ['general'] },
  { name: '简书', channelType: 'public_submission', submitUrl: 'https://www.jianshu.com', costPerArticle: 0, dailyLimit: 5, reviewHours: 24, aiSources: ['doubao', 'deepseek', 'yuanbao'], industries: ['general'] },

  // D. 行业垂直站（14 条）
  { name: '丁香医生', channelType: 'industry_vertical', submitUrl: 'https://www.dxy.com', costPerArticle: 0, dailyLimit: 5, reviewHours: 48, aiSources: ['doubao', 'deepseek', 'wenxin', 'kimi'], industries: ['dental'] },
  { name: '39健康网', channelType: 'industry_vertical', submitUrl: 'https://www.39.net', costPerArticle: 0, dailyLimit: 5, reviewHours: 48, aiSources: ['doubao', 'wenxin', 'tongyi'], industries: ['dental'] },
  { name: '妈妈网', channelType: 'industry_vertical', submitUrl: 'https://www.mama.cn', costPerArticle: 0, dailyLimit: 5, reviewHours: 24, aiSources: ['doubao', 'deepseek', 'yuanbao'], industries: ['mother_baby'] },
  { name: '宝宝树', channelType: 'industry_vertical', submitUrl: 'https://www.babytree.com', costPerArticle: 0, dailyLimit: 5, reviewHours: 24, aiSources: ['doubao', 'deepseek', 'kimi', 'yuanbao'], industries: ['mother_baby'] },
  { name: '汽车之家', channelType: 'industry_vertical', submitUrl: 'https://www.autohome.com.cn', costPerArticle: 0, dailyLimit: 5, reviewHours: 48, aiSources: ['doubao', 'deepseek', 'wenxin', 'tongyi'], industries: ['auto_repair'] },
  { name: '懂车帝', channelType: 'industry_vertical', submitUrl: 'https://www.dongchedi.com', costPerArticle: 0, dailyLimit: 5, reviewHours: 24, aiSources: ['doubao', 'wenxin', 'kimi'], industries: ['auto_repair'] },
  { name: '太平洋汽车', channelType: 'industry_vertical', submitUrl: 'https://www.pcauto.com.cn', costPerArticle: 0, dailyLimit: 5, reviewHours: 48, aiSources: ['doubao', 'deepseek', 'tongyi'], industries: ['auto_repair'] },
  { name: '土巴兔', channelType: 'industry_vertical', submitUrl: 'https://www.toutoo.com', costPerArticle: 0, dailyLimit: 5, reviewHours: 48, aiSources: ['doubao', 'wenxin', 'tongyi'], industries: ['decoration'] },
  { name: '齐家网', channelType: 'industry_vertical', submitUrl: 'https://www.jia.com', costPerArticle: 0, dailyLimit: 5, reviewHours: 48, aiSources: ['doubao', 'wenxin', 'yuanbao'], industries: ['decoration'] },
  { name: '大众点评', channelType: 'industry_vertical', submitUrl: 'https://www.dianping.com', costPerArticle: 0, dailyLimit: 10, reviewHours: 24, aiSources: ['doubao', 'deepseek', 'wenxin', 'kimi'], industries: ['catering'] },
  { name: '美团', channelType: 'industry_vertical', submitUrl: 'https://www.meituan.com', costPerArticle: 0, dailyLimit: 10, reviewHours: 24, aiSources: ['doubao', 'deepseek', 'wenxin', 'kimi'], industries: ['catering'] },
  { name: '中国食品网', channelType: 'industry_vertical', submitUrl: 'https://www.food.cn', costPerArticle: 0, dailyLimit: 3, reviewHours: 48, aiSources: ['doubao', 'wenxin', 'tongyi'], industries: ['bakery', 'specialty'] },
  { name: '食品商务网', channelType: 'industry_vertical', submitUrl: 'https://www.21food.cn', costPerArticle: 0, dailyLimit: 3, reviewHours: 48, aiSources: ['doubao', 'wenxin', 'tongyi'], industries: ['bakery', 'specialty'] },
  { name: '九州醉餐饮网', channelType: 'industry_vertical', submitUrl: 'https://www.9zhitx.com', costPerArticle: 0, dailyLimit: 3, reviewHours: 48, aiSources: ['doubao', 'deepseek'], industries: ['catering'] },

  // E. 企业信息源（6 条）
  { name: '百度百科', channelType: 'public_submission', submitUrl: 'https://baike.baidu.com', costPerArticle: 0, dailyLimit: 3, reviewHours: 72, aiSources: ['doubao', 'deepseek', 'wenxin', 'tongyi', 'yuanbao', 'kimi'], industries: ['general'] },
  { name: '搜狗百科', channelType: 'public_submission', submitUrl: 'https://baike.sogou.com', costPerArticle: 0, dailyLimit: 3, reviewHours: 72, aiSources: ['doubao', 'wenxin'], industries: ['general'] },
  { name: '企查查', channelType: 'public_submission', submitUrl: 'https://www.qcc.com', costPerArticle: 0, dailyLimit: 3, reviewHours: 48, aiSources: ['doubao', 'deepseek', 'kimi'], industries: ['general'] },
  { name: '天眼查', channelType: 'public_submission', submitUrl: 'https://www.tianyancha.com', costPerArticle: 0, dailyLimit: 3, reviewHours: 48, aiSources: ['doubao', 'deepseek', 'kimi'], industries: ['general'] },
  { name: '顺企网', channelType: 'public_submission', submitUrl: 'https://www.11467.com', costPerArticle: 0, dailyLimit: 5, reviewHours: 48, aiSources: ['doubao', 'wenxin'], industries: ['general'] },
  { name: '黄页88', channelType: 'public_submission', submitUrl: 'https://www.huangye88.com', costPerArticle: 0, dailyLimit: 5, reviewHours: 48, aiSources: ['doubao', 'wenxin'], industries: ['general'] },

  // F. 本地生活平台（3 条）
  { name: '高德地图', channelType: 'industry_vertical', submitUrl: 'https://www.amap.com', costPerArticle: 0, dailyLimit: 5, reviewHours: 48, aiSources: ['doubao', 'deepseek', 'wenxin'], industries: ['catering', 'bakery', 'auto_repair'] },
  { name: '百度地图', channelType: 'industry_vertical', submitUrl: 'https://map.baidu.com', costPerArticle: 0, dailyLimit: 5, reviewHours: 48, aiSources: ['doubao', 'wenxin', 'tongyi'], industries: ['catering', 'bakery', 'auto_repair'] },
  { name: '58同城', channelType: 'public_submission', submitUrl: 'https://www.58.com', costPerArticle: 0, dailyLimit: 5, reviewHours: 48, aiSources: ['doubao', 'wenxin'], industries: ['general'] },
];

type ChannelScope = { ownerType: 'platform' | 'brand'; ownerId: string | null };

/** 规范化投稿地址：去首尾空白、统一小写、去掉末尾斜杠，避免同一入口因写法差异被重复写入 */
function normalizeChannelUrl(url: string | null | undefined): string {
  if (!url) return '';
  return url.trim().toLowerCase().replace(/\/+$/, '');
}

/**
 * 渠道幂等键：归属范围（ownerType + ownerId）+ 渠道名 + 规范化 URL + 渠道类型。
 * 注意：同一投稿入口下存在“多账号”业务形态（同名站点不同账号名），因此不能用 name 或 url 单字段去重。
 */
function channelDedupeKey(input: {
  ownerType: string;
  ownerId: string | null;
  name: string;
  submitUrl?: string | null;
  channelType: string;
}): string {
  return [
    input.ownerType,
    input.ownerId ?? '',
    (input.name ?? '').trim().toLowerCase(),
    normalizeChannelUrl(input.submitUrl),
    input.channelType,
  ].join('|');
}

@Injectable()
export class SubmissionChannelsService {
  private readonly logger = new Logger(SubmissionChannelsService.name);

  constructor(
    @Inject(DRIZZLE_DATABASE) private readonly db: PostgresJsDatabase,
    private readonly auditLogService: AuditLogService,
  ) {}

  // ---------- 详情 ----------

  async getById(id: string, user: GeoUserCtx): Promise<SubmissionChannel> {
    const conditions: SQL[] = [eq(geoSubmissionChannels.id, id)];
    if (user.role === 'client' && user.brandId) {
      conditions.push(eq(geoSubmissionChannels.brandId, user.brandId));
    }

    const rows = await this.db
      .select()
      .from(geoSubmissionChannels)
      .where(and(...conditions))
      .limit(1);

    if (rows.length === 0) {
      throw new NotFoundException('渠道不存在');
    }
    return this.toSubmissionChannel(rows[0], 0);
  }

  // ---------- 列表（游标分页） ----------

  async list(
    query: SubmissionChannelQueryDto,
    user: GeoUserCtx,
  ): Promise<SubmissionChannelListResponse> {
    const limit = query.limit ?? 10;
    const page = query.page ? Math.max(1, Number(query.page)) : undefined;
    const conditions = this.buildWhere(query, user);

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // 总数
    const totalResult = await this.db
      .select({ count: count() })
      .from(geoSubmissionChannels)
      .where(whereClause);
    const total = Number(totalResult[0]?.count ?? 0);

    let rows: typeof geoSubmissionChannels.$inferSelect[];

    if (page !== undefined) {
      // offset 分页模式（支持跳页）
      const offset = (page - 1) * limit;
      rows = await this.db
        .select()
        .from(geoSubmissionChannels)
        .where(whereClause)
        .orderBy(
          asc(geoSubmissionChannels.createdAt),
          asc(geoSubmissionChannels.id),
        )
        .limit(limit)
        .offset(offset);
    } else {
      // 游标分页模式（兼容原逻辑）
      const allConditions = [...conditions];
      if (query.cursor) {
        const [cursorName, cursorId] = this.parseCursor(query.cursor);
        allConditions.push(
          or(
            gt(geoSubmissionChannels.name, cursorName),
            and(
              eq(geoSubmissionChannels.name, cursorName),
              gt(geoSubmissionChannels.id, cursorId),
            ),
          ) as unknown as ReturnType<typeof eq>,
        );
      }

      const cursorWhere = allConditions.length > 0 ? and(...allConditions) : undefined;
      const rawRows = await this.db
        .select()
        .from(geoSubmissionChannels)
        .where(cursorWhere)
        .orderBy(
          asc(geoSubmissionChannels.createdAt),
          asc(geoSubmissionChannels.id),
        )
        .limit(limit + 1);

      const hasMore = rawRows.length > limit;
      const pageRows = hasMore ? rawRows.slice(0, limit) : rawRows;
      rows = pageRows;
    }

    // 查今日发布数
    const todayCounts = await this.getTodayPublishedCounts(
      rows.map((row) => row.id),
    );

    const items: SubmissionChannel[] = rows.length > 0
      ? rows.map((row) =>
          this.toSubmissionChannel(row, todayCounts.get(row.id) ?? 0),
        )
      : [];

    let nextCursor: string | undefined;
    if (page === undefined) {
      const hasMore = items.length >= limit;
      if (hasMore && items.length > 0) {
        const last = items[items.length - 1];
        nextCursor = this.makeCursor(last.name, last.id);
      }
    }

    return {
      items,
      total,
      limit,
      page,
      nextCursor,
    };
  }

  // ---------- 新增 ----------

  async create(
    dto: CreateSubmissionChannelDto,
    user: GeoUserCtx,
  ): Promise<SubmissionChannel> {
    const ownerType: 'platform' | 'brand' = user.role === 'client' ? 'brand' : (dto as any).ownerType || 'brand';
    const ownerId = ownerType === 'platform' ? null : (dto.brandId ?? null);

    if (user.role === 'client') {
      if (!user.brandId) throw new ForbiddenException('您没有绑定品牌，无法创建渠道');
    }
    if (ownerType === 'brand' && !ownerId) {
      throw new BadRequestException('品牌渠道必须指定 brandId');
    }
    if (ownerType === 'platform' && user.role === 'client') {
      throw new ForbiddenException('无权创建平台级预置渠道');
    }

    // 幂等保护：同一归属范围内「渠道名 + URL + 渠道类型」已存在时，直接返回已有记录（重复提交不产生新行）
    const duplicated = await this.findExistingChannel({
      ownerType,
      ownerId,
      name: dto.name,
      submitUrl: dto.submitUrl,
      channelType: dto.channelType,
    });
    if (duplicated) {
      this.logger.warn(`create SKIP_DUPLICATE id=${duplicated.id} name=${dto.name} owner=${ownerType}:${ownerId ?? ''}`);
      const dupTodayCount = await this.getTodayPublishedCount(duplicated.id);
      return this.toSubmissionChannel(duplicated, dupTodayCount);
    }

    const inserted = await this.db
      .insert(geoSubmissionChannels)
      .values({
        brandId: ownerId,
        ownerType,
        ownerId,
        name: dto.name,
        channelType: dto.channelType,
        submitUrl: dto.submitUrl ?? null,
        needAccount: dto.needAccount ?? false,
        costPerArticle: String(dto.costPerArticle ?? 0),
        dailyLimit: dto.dailyLimit ?? 3,
        reviewHours: dto.reviewHours ?? 24,
        industries: dto.industries ?? [],
        requiredFields: dto.requiredFields ?? [],
        aiSources: dto.aiSources ?? [],
        accountName: dto.accountName ?? null,
        status: dto.status ?? 'active',
        remark: dto.remark ?? null,
        usageType: dto.usageType ?? null,
        platformCoverage: dto.platformCoverage ?? [],
        indexRate: dto.indexRate ?? 0,
        citeRate: dto.citeRate ?? 0,
        tier: dto.tier ?? 'C',
        indexStatus: dto.indexStatus ?? 'pending',
        citeSnapshots: dto.citeSnapshots ?? 0,
        libraryType: dto.libraryType ?? 'public',
        region: dto.region ?? '全国',
        aiPlatforms: dto.aiPlatforms ?? [],
        mediaType: dto.mediaType ?? 'image_text',
        quotaTotal: dto.quotaTotal ?? null,
        quotaUsed: dto.quotaUsed ?? 0,
        followers: dto.followers ?? null,
        likes: dto.likes ?? null,
        imagePrice: dto.imagePrice != null ? String(dto.imagePrice) : null,
        videoPrice: dto.videoPrice != null ? String(dto.videoPrice) : null,
        description: dto.description ?? null,
      })
      .returning();

    return this.toSubmissionChannel(inserted[0], 0);
  }

  // ---------- 更新 ----------

  async update(
    id: string,
    dto: UpdateSubmissionChannelDto,
    user: GeoUserCtx,
  ): Promise<SubmissionChannel> {
    const existing = await this.findOrThrow(id);
    this.ensureWriteAccess(existing, user);

    const patch: Partial<typeof geoSubmissionChannels.$inferInsert> = {};
    if (dto.name !== undefined) patch.name = dto.name;
    if (dto.channelType !== undefined) patch.channelType = dto.channelType;
    if (dto.submitUrl !== undefined) patch.submitUrl = dto.submitUrl || null;
    if (dto.needAccount !== undefined) patch.needAccount = dto.needAccount;
    if (dto.costPerArticle !== undefined) patch.costPerArticle = String(dto.costPerArticle);
    if (dto.dailyLimit !== undefined) patch.dailyLimit = dto.dailyLimit;
    if (dto.reviewHours !== undefined) patch.reviewHours = dto.reviewHours;
    if (dto.industries !== undefined) patch.industries = dto.industries;
    if (dto.requiredFields !== undefined) patch.requiredFields = dto.requiredFields;
    if (dto.aiSources !== undefined) patch.aiSources = dto.aiSources;
    if (dto.accountName !== undefined) patch.accountName = dto.accountName || null;
    if (dto.status !== undefined) patch.status = dto.status;
    if (dto.remark !== undefined) patch.remark = dto.remark ?? null;
    if (dto.usageType !== undefined) patch.usageType = dto.usageType ?? null;
    if (dto.platformCoverage !== undefined) patch.platformCoverage = dto.platformCoverage;
    if (dto.indexRate !== undefined) patch.indexRate = dto.indexRate;
    if (dto.citeRate !== undefined) patch.citeRate = dto.citeRate;
    if (dto.tier !== undefined) patch.tier = dto.tier;
    if (dto.indexStatus !== undefined) patch.indexStatus = dto.indexStatus;
    if (dto.citeSnapshots !== undefined) patch.citeSnapshots = dto.citeSnapshots;
    if (dto.libraryType !== undefined) patch.libraryType = dto.libraryType;
    if (dto.region !== undefined) patch.region = dto.region;
    if (dto.aiPlatforms !== undefined) patch.aiPlatforms = dto.aiPlatforms;
    if (dto.mediaType !== undefined) patch.mediaType = dto.mediaType;
    if (dto.quotaTotal !== undefined) patch.quotaTotal = dto.quotaTotal;
    if (dto.quotaUsed !== undefined) patch.quotaUsed = dto.quotaUsed;
    if (dto.followers !== undefined) patch.followers = dto.followers;
    if (dto.likes !== undefined) patch.likes = dto.likes;
    if (dto.imagePrice !== undefined) patch.imagePrice = dto.imagePrice != null ? String(dto.imagePrice) : null;
    if (dto.videoPrice !== undefined) patch.videoPrice = dto.videoPrice != null ? String(dto.videoPrice) : null;
    if (dto.description !== undefined) patch.description = dto.description ?? null;

    if (Object.keys(patch).length === 0) {
      throw new BadRequestException('未提供可更新字段');
    }

    const updated = await this.db
      .update(geoSubmissionChannels)
      .set(patch)
      .where(eq(geoSubmissionChannels.id, id))
      .returning();

    if (updated.length === 0) {
      throw new NotFoundException('投稿渠道不存在');
    }

    const todayCount = await this.getTodayPublishedCount(id);
    return this.toSubmissionChannel(updated[0], todayCount);
  }

  // ---------- 更新投稿地址 ----------

  async updateSubmitUrl(
    id: string,
    submitUrl: string,
    user: GeoUserCtx,
  ): Promise<SubmissionChannel> {
    const existing = await this.findOrThrow(id);
    this.ensureWriteAccess(existing, user);

    const validatedUrl = this.validateHttpUrl(submitUrl);

    const updated = await this.db
      .update(geoSubmissionChannels)
      .set({ submitUrl: validatedUrl })
      .where(eq(geoSubmissionChannels.id, id))
      .returning();

    if (updated.length === 0) {
      throw new NotFoundException('投稿渠道不存在');
    }

    const todayCount = await this.getTodayPublishedCount(id);
    return this.toSubmissionChannel(updated[0], todayCount);
  }

  // ---------- 单条调价 ----------

  async updatePrice(
    id: string,
    salePriceCents: number,
    user: GeoUserCtx,
  ): Promise<UpdateChannelPriceResponse> {
    const existing = await this.findOrThrow(id);
    this.ensureWriteAccess(existing, user);

    const costPriceCents = existing.costPriceCents ?? 0;
    if (salePriceCents < costPriceCents) {
      throw new BadRequestException('售价不得低于成本价');
    }

    const oldPrice = existing.salePriceCents ?? 0;

    const updated = await this.db
      .update(geoSubmissionChannels)
      .set({
        salePriceCents,
        salePriceOverridden: true,
        priceUpdatedAt: new Date(),
      })
      .where(eq(geoSubmissionChannels.id, id))
      .returning();

    if (updated.length === 0) {
      throw new NotFoundException('投稿渠道不存在');
    }

    const channel = this.toSubmissionChannel(updated[0], 0);

    const oldPriceYuan = (oldPrice / 100).toFixed(2);
    const newPriceYuan = (salePriceCents / 100).toFixed(2);
    this.auditLogService.log({
      action: 'channel_price_update',
      actor: user.username ?? 'system',
      role: user.role,
      target: existing.name,
      detail: `旧价 ¥${oldPriceYuan} → 新价 ¥${newPriceYuan}`,
    });

    return { updated: 1, channel };
  }

  // ---------- 批量调价 ----------

  async bulkUpdatePrice(
    dto: BulkChannelPriceDto,
    user: GeoUserCtx,
  ): Promise<BulkChannelPriceResponse> {
    // 计算用户主动传入的有效筛选字段数（防止误改全库）
    let effectiveFilterCount = 0;
    if (dto.filter) {
      const f = dto.filter;
      const fields = [
        'keyword', 'supplierId', 'sellable', 'type', 'status',
        'usageType', 'channelGroup', 'tier', 'platformCoverage',
        'libraryType', 'region', 'industry', 'aiPlatform', 'mediaType',
        'brandId',
      ] as const;
      for (const field of fields) {
        const val = f[field as keyof typeof f];
        if (val !== undefined && val !== '' && val !== null) {
          effectiveFilterCount += 1;
        }
      }
    }
    if (effectiveFilterCount === 0) {
      return { affectedCount: 0, previewOnly: dto.previewOnly };
    }

    const conditions = this.buildWhere(dto.filter, user);
    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // 先 count 符合条件的记录数
    const countResult = await this.db
      .select({ count: count() })
      .from(geoSubmissionChannels)
      .where(whereClause);
    const totalMatch = Number(countResult[0]?.count ?? 0);

    if (dto.previewOnly) {
      return { affectedCount: totalMatch, previewOnly: true };
    }

    // 实际执行批量更新
    const now = new Date();
    let updatedRows: { id: string }[];

    if (dto.mode === 'markup_rate') {
      const rate = dto.markupRate ?? 1;
      updatedRows = await this.db
        .update(geoSubmissionChannels)
        .set({
          salePriceCents: sql<number>`ROUND(COALESCE(${geoSubmissionChannels.costPriceCents}, 0) * ${rate})`,
          salePriceOverridden: true,
          priceUpdatedAt: now,
        })
        .where(
          and(
            whereClause,
            sql`ROUND(COALESCE(${geoSubmissionChannels.costPriceCents}, 0) * ${rate}) >= COALESCE(${geoSubmissionChannels.costPriceCents}, 0)`,
          ),
        )
        .returning({ id: geoSubmissionChannels.id });
    } else {
      const delta = dto.fixedDelta ?? 0;
      updatedRows = await this.db
        .update(geoSubmissionChannels)
        .set({
          salePriceCents: sql<number>`COALESCE(${geoSubmissionChannels.costPriceCents}, 0) + ${delta}`,
          salePriceOverridden: true,
          priceUpdatedAt: now,
        })
        .where(
          and(
            whereClause,
            sql`COALESCE(${geoSubmissionChannels.costPriceCents}, 0) + ${delta} >= COALESCE(${geoSubmissionChannels.costPriceCents}, 0)`,
          ),
        )
        .returning({ id: geoSubmissionChannels.id });
    }

    const updatedCount = updatedRows.length;

    const modeLabel = dto.mode === 'markup_rate' ? '加价率' : '固定金额';
    this.auditLogService.log({
      action: 'channel_bulk_price_update',
      actor: user.username ?? 'system',
      role: user.role,
      target: `批量 ${totalMatch} 条`,
      detail: `模式: ${modeLabel}, 影响 ${updatedCount} 条`,
    });

    return { affectedCount: updatedCount, previewOnly: false };
  }

  // ---------- 删除 ----------

  async remove(id: string, user: GeoUserCtx): Promise<{ success: true }> {
    const existing = await this.findOrThrow(id);
    this.ensureWriteAccess(existing, user);

    const deleted = await this.db
      .delete(geoSubmissionChannels)
      .where(eq(geoSubmissionChannels.id, id))
      .returning({ id: geoSubmissionChannels.id });

    if (deleted.length === 0) {
      throw new NotFoundException('投稿渠道不存在');
    }

    return { success: true };
  }

  // ---------- 一键恢复预置渠道 ----------

  async seed(_brandId: string, user: GeoUserCtx): Promise<{ inserted: number }> {
    if (user.role === 'client') {
      throw new ForbiddenException('仅服务商可恢复预置渠道');
    }

    const values = PRESET_CHANNELS.map((preset) => ({
      ownerType: 'platform' as const,
      ownerId: null,
      brandId: null,
      name: preset.name,
      channelType: preset.channelType,
      submitUrl: preset.submitUrl ?? null,
      needAccount: false,
      costPerArticle: String(preset.costPerArticle),
      dailyLimit: preset.dailyLimit,
      reviewHours: preset.reviewHours,
      industries: preset.industries,
      requiredFields: ['标题', '正文'],
      aiSources: preset.aiSources,
      accountName: null,
      status: 'active' as SubmissionChannelStatus,
      remark: null,
    }));

    // 幂等写入：platform 级「渠道名 + URL + 渠道类型」已存在的预置渠道跳过，重复点击不会产生重复行
    const { inserted } = await this.insertChannelsIfAbsent(values);
    return { inserted };
  }

  // ---------- 内部方法 ----------

  /** 按「归属范围 + 渠道名 + 规范化 URL + 渠道类型」查已有渠道（create 幂等用） */
  private async findExistingChannel(input: {
    ownerType: 'platform' | 'brand';
    ownerId: string | null;
    name: string;
    submitUrl?: string | null;
    channelType: string;
  }) {
    const rows = await this.db
      .select()
      .from(geoSubmissionChannels)
      .where(
        and(
          eq(geoSubmissionChannels.ownerType, input.ownerType),
          input.ownerId
            ? eq(geoSubmissionChannels.ownerId, input.ownerId)
            : isNull(geoSubmissionChannels.ownerId),
          sql`lower(btrim(${geoSubmissionChannels.name})) = ${(input.name ?? '').trim().toLowerCase()}`,
          sql`lower(rtrim(btrim(coalesce(${geoSubmissionChannels.submitUrl}, '')), '/')) = ${normalizeChannelUrl(input.submitUrl)}`,
          eq(geoSubmissionChannels.channelType, input.channelType),
        ) as unknown as ReturnType<typeof eq>,
      )
      .limit(1);
    return rows[0] ?? null;
  }

  /**
   * 幂等批量写入渠道。
   * 表上没有唯一索引（不改表结构），因此用事务级 advisory lock 串行化「查重 + 插入」，
   * 保证并发/重复调用（重复点击恢复预置、重复确认导入）不会插入重复行。
   */
  private async insertChannelsIfAbsent(
    rows: Array<typeof geoSubmissionChannels.$inferInsert>,
  ): Promise<{ inserted: number; duplicate: number }> {
    if (rows.length === 0) return { inserted: 0, duplicate: 0 };

    const scopes = new Map<string, ChannelScope>();
    for (const row of rows) {
      const ownerType = ((row.ownerType ?? 'brand') as 'platform' | 'brand');
      const ownerId = ownerType === 'platform' ? null : (row.ownerId ?? null);
      scopes.set(`${ownerType}:${ownerId ?? ''}`, { ownerType, ownerId });
    }

    return this.db.transaction(async (tx) => {
      await tx.execute(
        sql`SELECT pg_advisory_xact_lock(hashtext('geo_submission_channels:write'))`,
      );

      const scopeConditions = Array.from(scopes.values()).map((scope) =>
        scope.ownerId
          ? and(
              eq(geoSubmissionChannels.ownerType, scope.ownerType),
              eq(geoSubmissionChannels.ownerId, scope.ownerId),
            )
          : and(
              eq(geoSubmissionChannels.ownerType, scope.ownerType),
              isNull(geoSubmissionChannels.ownerId),
            ),
      );

      const existingRows = await tx
        .select({
          ownerType: geoSubmissionChannels.ownerType,
          ownerId: geoSubmissionChannels.ownerId,
          name: geoSubmissionChannels.name,
          submitUrl: geoSubmissionChannels.submitUrl,
          channelType: geoSubmissionChannels.channelType,
        })
        .from(geoSubmissionChannels)
        .where(or(...scopeConditions) as unknown as ReturnType<typeof eq>);

      const existingKeys = new Set(
        existingRows.map((row) =>
          channelDedupeKey({
            ownerType: row.ownerType,
            ownerId: row.ownerId,
            name: row.name,
            submitUrl: row.submitUrl,
            channelType: row.channelType,
          }),
        ),
      );

      const fresh: Array<typeof geoSubmissionChannels.$inferInsert> = [];
      for (const row of rows) {
        const ownerType = ((row.ownerType ?? 'brand') as 'platform' | 'brand');
        const ownerId = ownerType === 'platform' ? null : (row.ownerId ?? null);
        const key = channelDedupeKey({
          ownerType,
          ownerId,
          name: row.name,
          submitUrl: row.submitUrl,
          channelType: row.channelType,
        });
        if (existingKeys.has(key)) continue;
        existingKeys.add(key); // 同一批内的重复也去掉
        fresh.push({ ...row, ownerType, ownerId });
      }

      if (fresh.length === 0) return { inserted: 0, duplicate: rows.length };

      try {
        await tx.insert(geoSubmissionChannels).values(fresh);
      } catch (err: unknown) {
        const code = extractPostgresErrorCode(err);
        const msg = err instanceof Error ? err.message : String(err);
        this.logger.error(`channels INSERT_FAILED code=${code} msg=${msg.slice(0, 500)} count=${fresh.length}`);
        throw err;
      }

      return { inserted: fresh.length, duplicate: rows.length - fresh.length };
    });
  }

  private buildWhere(
    query: SubmissionChannelQueryDto,
    user: GeoUserCtx,
  ): Array<ReturnType<typeof eq>> {
    const conditions: Array<ReturnType<typeof eq>> = [];

    if (query.sellable !== undefined) {
      conditions.push(eq(geoSubmissionChannels.sellable, query.sellable));
    } else {
      conditions.push(eq(geoSubmissionChannels.sellable, true));
    }

    if (query.supplierId) {
      conditions.push(eq(geoSubmissionChannels.supplierId, query.supplierId));
    }

    if (user.role === 'client') {
      if (user.brandId) {
        conditions.push(
          or(
            eq(geoSubmissionChannels.ownerType, 'platform'),
            and(
              eq(geoSubmissionChannels.ownerType, 'brand'),
              eq(geoSubmissionChannels.ownerId, user.brandId),
            ),
          ) as unknown as ReturnType<typeof eq>,
        );
      }
    } else if (query.brandId) {
      conditions.push(
        or(
          eq(geoSubmissionChannels.ownerType, 'platform'),
          and(
            eq(geoSubmissionChannels.ownerType, 'brand'),
            eq(geoSubmissionChannels.ownerId, query.brandId),
          ),
        ) as unknown as ReturnType<typeof eq>,
      );
    }

    if (query.type) {
      conditions.push(eq(geoSubmissionChannels.channelType, query.type));
    }
    if (query.usageType) {
      conditions.push(eq(geoSubmissionChannels.usageType, query.usageType));
    }
    if (query.status) {
      conditions.push(eq(geoSubmissionChannels.status, query.status));
    }
    if (query.keyword) {
      conditions.push(ilike(geoSubmissionChannels.name, `%${query.keyword}%`) as unknown as ReturnType<typeof eq>);
    }

    if (query.channelGroup === 'common') {
      conditions.push(
        sql`${geoSubmissionChannels.source} != ${'batch_import'}` as unknown as ReturnType<typeof eq>,
      );
    } else if (query.channelGroup === 'self_media_pack') {
      conditions.push(
        eq(geoSubmissionChannels.source, 'batch_import'),
      );
    }

    if (query.tier) {
      conditions.push(eq(geoSubmissionChannels.tier, query.tier));
    }
    if (query.platformCoverage) {
      conditions.push(
        sql`${geoSubmissionChannels.platformCoverage} @> ARRAY[${query.platformCoverage}]::text[]` as unknown as ReturnType<typeof eq>,
      );
    }
    if (query.libraryType) {
      conditions.push(eq(geoSubmissionChannels.libraryType, query.libraryType));
    }
    if (query.region) {
      conditions.push(eq(geoSubmissionChannels.region, query.region));
    }
    if (query.industry) {
      conditions.push(
        sql`${geoSubmissionChannels.industries} @> ARRAY[${query.industry}]::text[]` as unknown as ReturnType<typeof eq>,
      );
    }
    if (query.aiPlatform) {
      conditions.push(
        sql`${geoSubmissionChannels.aiPlatforms} @> ARRAY[${query.aiPlatform}]::text[]` as unknown as ReturnType<typeof eq>,
      );
    }
    if (query.mediaType) {
      conditions.push(eq(geoSubmissionChannels.mediaType, query.mediaType));
    }

    return conditions;
  }

  private buildGroupBaseWhere(
    query: SubmissionChannelQueryDto,
    user: GeoUserCtx,
  ): Array<ReturnType<typeof eq>> {
    const conditions: Array<ReturnType<typeof eq>> = [];

    if (user.role === 'client') {
      if (user.brandId) {
        conditions.push(
          or(
            eq(geoSubmissionChannels.ownerType, 'platform'),
            and(
              eq(geoSubmissionChannels.ownerType, 'brand'),
              eq(geoSubmissionChannels.ownerId, user.brandId),
            ),
          ) as unknown as ReturnType<typeof eq>,
        );
      }
    } else if (query.brandId) {
      conditions.push(
        or(
          eq(geoSubmissionChannels.ownerType, 'platform'),
          and(
            eq(geoSubmissionChannels.ownerType, 'brand'),
            eq(geoSubmissionChannels.ownerId, query.brandId),
          ),
        ) as unknown as ReturnType<typeof eq>,
      );
    }

    if (query.type) {
      conditions.push(eq(geoSubmissionChannels.channelType, query.type));
    }
    if (query.usageType) {
      conditions.push(eq(geoSubmissionChannels.usageType, query.usageType));
    }
    if (query.status) {
      conditions.push(eq(geoSubmissionChannels.status, query.status));
    }
    if (query.keyword) {
      conditions.push(ilike(geoSubmissionChannels.name, `%${query.keyword}%`) as unknown as ReturnType<typeof eq>);
    }
    if (query.tier) {
      conditions.push(eq(geoSubmissionChannels.tier, query.tier));
    }
    if (query.platformCoverage) {
      conditions.push(
        sql`${geoSubmissionChannels.platformCoverage} @> ARRAY[${query.platformCoverage}]::text[]` as unknown as ReturnType<typeof eq>,
      );
    }

    return conditions;
  }

  private async findOrThrow(id: string): Promise<typeof geoSubmissionChannels.$inferSelect> {
    const rows = await this.db
      .select()
      .from(geoSubmissionChannels)
      .where(eq(geoSubmissionChannels.id, id));

    if (rows.length === 0) {
      throw new NotFoundException('投稿渠道不存在');
    }

    return rows[0];
  }

  private ensureWriteAccess(
    row: typeof geoSubmissionChannels.$inferSelect,
    user: GeoUserCtx,
  ): void {
    if (row.ownerType === 'platform') {
      if (user.role === 'client') {
        throw new ForbiddenException('预置渠道由服务商维护，不可修改');
      }
      return;
    }
    if (user.role === 'client' && user.brandId !== row.ownerId) {
      throw new ForbiddenException('无权访问其他品牌数据');
    }
  }

  private makeCursor(name: string, id: string): string {
    return `${encodeURIComponent(name)}::${id}`;
  }

  private parseCursor(cursor: string): [string, string] {
    const parts = cursor.split('::');
    if (parts.length < 2) return [cursor, ''];
    const id = parts[parts.length - 1];
    const name = parts.slice(0, -1).join('::');
    return [decodeURIComponent(name), id];
  }

  private getStartOfTodayIso(): string {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    return start.toISOString();
  }

  private async getTodayPublishedCount(channelId: string): Promise<number> {
    const startOfDay = this.getStartOfTodayIso();
    const result = await this.db
      .select({ count: count() })
      .from(geoSubmissionQueue)
      .where(
        and(
          eq(geoSubmissionQueue.channelId, channelId),
          sql`${geoSubmissionQueue.createdAt} >= ${startOfDay}`,
          sql`${geoSubmissionQueue.status} != ${'cancelled'}`,
        ),
      );
    return Number(result[0]?.count ?? 0);
  }

  private async getTodayPublishedCounts(channelIds: string[]): Promise<Map<string, number>> {
    const map = new Map<string, number>();
    if (channelIds.length === 0) return map;

    const startOfDay = this.getStartOfTodayIso();
    const rows = await this.db
      .select({
        channelId: geoSubmissionQueue.channelId,
        count: count(),
      })
      .from(geoSubmissionQueue)
      .where(
        and(
          inArray(geoSubmissionQueue.channelId, channelIds),
          sql`${geoSubmissionQueue.createdAt} >= ${startOfDay}`,
          sql`${geoSubmissionQueue.status} != ${'cancelled'}`,
        ),
      )
      .groupBy(geoSubmissionQueue.channelId);

    for (const row of rows) {
      map.set(row.channelId, Number(row.count));
    }

    return map;
  }

  // ---------- 统计（按类型分组） ----------

  async stats(
    query: SubmissionChannelQueryDto,
    user: GeoUserCtx,
  ): Promise<SubmissionChannelStats> {
    const conditions = this.buildWhere(query, user);
    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const rows = await this.db
      .select({
        channelType: geoSubmissionChannels.channelType,
        count: count(),
      })
      .from(geoSubmissionChannels)
      .where(whereClause)
      .groupBy(geoSubmissionChannels.channelType);

    const libRows = await this.db
      .select({
        libraryType: geoSubmissionChannels.libraryType,
        count: count(),
      })
      .from(geoSubmissionChannels)
      .where(whereClause)
      .groupBy(geoSubmissionChannels.libraryType);

    const byType: Record<string, number> = {
      self_site: 0,
      public_submission: 0,
      authoritative_media: 0,
      industry_vertical: 0,
      self_media_account: 0,
    };
    let total = 0;

    if (rows && rows.length > 0) {
      for (const row of rows) {
        const t = String(row.channelType);
        const c = Number(row.count ?? 0);
        if (t in byType) {
          byType[t] = c;
        }
        total += c;
      }
    }

    const byLibraryType: Record<string, number> = {
      private: 0,
      public: 0,
      authoritative: 0,
      b2b_alliance: 0,
      multimodal: 0,
    };
    if (libRows && libRows.length > 0) {
      for (const row of libRows) {
        const t = String(row.libraryType);
        const c = Number(row.count ?? 0);
        if (t in byLibraryType) {
          byLibraryType[t] = c;
        }
      }
    }

    const groupConditions = this.buildGroupBaseWhere(query, user);
    const groupWhere = groupConditions.length > 0 ? and(...groupConditions) : undefined;

    const groupRows = await this.db
      .select({
        source: geoSubmissionChannels.source,
        count: count(),
      })
      .from(geoSubmissionChannels)
      .where(groupWhere)
      .groupBy(geoSubmissionChannels.source);

    let commonCount = 0;
    let commonPresetCount = 0;
    let commonManualCount = 0;
    let selfMediaPackCount = 0;
    for (const row of groupRows) {
      const src = String(row.source);
      const c = Number(row.count ?? 0);
      if (src === 'batch_import') {
        selfMediaPackCount += c;
      } else if (src === 'platform_preset') {
        commonPresetCount += c;
        commonCount += c;
      } else {
        commonManualCount += c;
        commonCount += c;
      }
    }

    // tier 分组计数（基于当前可见范围，即 buildGroupBaseWhere）
    const tierRows = await this.db
      .select({
        tier: geoSubmissionChannels.tier,
        count: count(),
      })
      .from(geoSubmissionChannels)
      .where(groupWhere)
      .groupBy(geoSubmissionChannels.tier);

    const tierCounts: Record<SubmissionChannelTier, number> = {
      S: 0,
      A: 0,
      B: 0,
      C: 0,
    };
    for (const row of tierRows) {
      const t = String(row.tier);
      const c = Number(row.count ?? 0);
      if (t in tierCounts) {
        tierCounts[t as SubmissionChannelTier] = c;
      }
    }

    // 待淘汰数量（基于 buildGroupBaseWhere）
    const toBeDeprecatedResult = await this.db
      .select({ count: count() })
      .from(geoSubmissionChannels)
      .where(
        groupConditions.length > 0
          ? and(
              ...groupConditions,
              eq(geoSubmissionChannels.status, 'to_be_deprecated'),
            )
          : eq(geoSubmissionChannels.status, 'to_be_deprecated'),
      );
    const toBeDeprecatedCount = Number(toBeDeprecatedResult[0]?.count ?? 0);

    return {
      total,
      byType: byType as SubmissionChannelStats['byType'],
      byLibraryType: byLibraryType as SubmissionChannelStats['byLibraryType'],
      commonCount,
      commonPresetCount,
      commonManualCount,
      selfMediaPackCount,
      tierCounts,
      toBeDeprecatedCount,
    };
  }

  // ---------- 月度淘汰扫描 ----------

  async eliminationScan(
    query: SubmissionChannelQueryDto,
    user: GeoUserCtx,
  ): Promise<EliminationScanResult> {
    const groupConditions = this.buildGroupBaseWhere(query, user);

    // 只扫常用渠道（source != 'batch_import'），不扫自媒体账号包
    const baseConditions = [
      ...groupConditions,
      sql`${geoSubmissionChannels.source} != ${'batch_import'}` as unknown as ReturnType<typeof eq>,
      eq(geoSubmissionChannels.status, 'active'),
    ];

    // 连续 60 天 0 引用 + 收录率 < 30
    const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString();

    const whereClause = and(
      ...baseConditions,
      sql`${geoSubmissionChannels.citeSnapshots} = 0`,
      sql`(
        ${geoSubmissionChannels.lastCiteAt} IS NULL
        OR ${geoSubmissionChannels.lastCiteAt} < ${sixtyDaysAgo}
      )`,
      sql`${geoSubmissionChannels.indexRate} < 30`,
    );

    const rows = await this.db
      .select()
      .from(geoSubmissionChannels)
      .where(whereClause)
      .orderBy(asc(geoSubmissionChannels.name))
      .limit(500);

    const items: EliminationScanItem[] = rows.map((row) => {
      const platformCoverage: DiagnosisPlatform[] = Array.isArray(row.platformCoverage)
        ? row.platformCoverage.filter(
            (p: string): p is DiagnosisPlatform =>
              (DIAGNOSIS_PLATFORMS as readonly string[]).includes(p),
          )
        : [];
      const lastCiteAt = row.lastCiteAt ? new Date(row.lastCiteAt).toISOString() : null;
      const reasons: string[] = [];
      if (!row.lastCiteAt) {
        reasons.push('暂无引用记录');
      } else {
        reasons.push('连续60天0引用');
      }
      reasons.push(`收录率${row.indexRate ?? 0}%`);
      return {
        id: row.id,
        name: row.name,
        channelType: row.channelType as SubmissionChannelType,
        citeRate: row.citeRate ?? 0,
        lastCiteAt,
        indexRate: row.indexRate ?? 0,
        platformCoverage,
        citeSnapshots: row.citeSnapshots ?? 0,
        reason: reasons.join('且'),
      };
    });

    return {
      total: items.length,
      items,
    };
  }

  // ---------- 批量淘汰处理 ----------

  async eliminationBatch(
    dto: EliminationBatchDto,
    user: GeoUserCtx,
  ): Promise<{ updated: number }> {
    if (dto.ids.length === 0) {
      return { updated: 0 };
    }

    if (dto.action === 'keep') {
      // 标记保留：本轮不做数据变更，仅返回成功
      return { updated: dto.ids.length };
    }

    const targetStatus: 'to_be_deprecated' | 'archived' =
      dto.action === 'mark_deprecated' ? 'to_be_deprecated' : 'archived';

    // 校验权限：只允许操作当前用户可见范围内的渠道
    const scopeConditions = this.buildScopeCondition(user);
    const whereClause = and(
      ...scopeConditions,
      inArray(geoSubmissionChannels.id, dto.ids),
    );

    const updated = await this.db
      .update(geoSubmissionChannels)
      .set({ status: targetStatus })
      .where(whereClause)
      .returning({ id: geoSubmissionChannels.id });

    return { updated: updated.length };
  }

  private buildScopeCondition(user: GeoUserCtx): Array<ReturnType<typeof eq>> {
    const conditions: Array<ReturnType<typeof eq>> = [];
    if (user.role === 'client') {
      if (user.brandId) {
        conditions.push(
          or(
            eq(geoSubmissionChannels.ownerType, 'platform'),
            and(
              eq(geoSubmissionChannels.ownerType, 'brand'),
              eq(geoSubmissionChannels.ownerId, user.brandId),
            ),
          ) as unknown as ReturnType<typeof eq>,
        );
      }
    }
    return conditions;
  }

  // ---------- 批量导入：预览 ----------

  async importPreview(
    brandId: string,
    csvContent: string,
    user: GeoUserCtx,
  ): Promise<SubmissionChannelImportPreview> {
    if (!brandId) {
      throw new BadRequestException('请选择品牌后再导入');
    }
    if (user.role === 'client' && user.brandId !== brandId) {
      throw new ForbiddenException('无权为其他品牌导入渠道');
    }

    const lines = csvContent.split(/\r?\n/).filter((line) => line.trim().length > 0);
    if (lines.length < 2) {
      throw new BadRequestException('CSV 内容为空或只有表头');
    }

    const headerLine = lines[0];
    const headers = this.parseCsvLine(headerLine).map((h) => h.trim());

    const nameIdx = headers.indexOf('渠道名称');
    const typeIdx = headers.indexOf('渠道类型');
    const urlIdx = headers.indexOf('投稿入口URL');
    const costIdx = headers.indexOf('单篇成本');
    const limitIdx = headers.indexOf('日限额');
    const reviewIdx = headers.indexOf('审核时长');
    const indIdx = headers.indexOf('适配行业');
    const aiIdx = headers.indexOf('AI信源标记');
    const remarkIdx = headers.indexOf('备注');

    if (nameIdx < 0 || typeIdx < 0) {
      throw new BadRequestException('CSV 表头缺少必填列：渠道名称、渠道类型');
    }

    // 幂等判定键：品牌级按品牌、平台级全局，键 = 渠道名 + 规范化 URL + 渠道类型
    const existingRows = await this.db
      .select({
        name: geoSubmissionChannels.name,
        ownerType: geoSubmissionChannels.ownerType,
        ownerId: geoSubmissionChannels.ownerId,
        submitUrl: geoSubmissionChannels.submitUrl,
        channelType: geoSubmissionChannels.channelType,
      })
      .from(geoSubmissionChannels)
      .where(
        or(
          eq(geoSubmissionChannels.ownerType, 'platform'),
          and(
            eq(geoSubmissionChannels.ownerType, 'brand'),
            eq(geoSubmissionChannels.ownerId, brandId),
          ),
        ) as unknown as ReturnType<typeof eq>,
      );
    const existingKeys = new Set(
      existingRows.map((row) =>
        channelDedupeKey({
          ownerType: row.ownerType,
          ownerId: row.ownerId,
          name: row.name,
          submitUrl: row.submitUrl,
          channelType: row.channelType,
        }),
      ),
    );

    const errors: Array<{ row: number; error: string }> = [];
    const sampleItems: SubmissionChannelImportPreview['sampleItems'] = [];
    let duplicate = 0;
    let newCount = 0;

    const typeLabelToKey: Record<string, SubmissionChannelType> = {
      '自建站': 'self_site',
      '自媒体站': 'public_submission',
      '公共投稿站': 'public_submission',
      '权威媒体': 'authoritative_media',
      '行业垂直站': 'industry_vertical',
    };

    const aiLabelToKey: Record<string, SubmissionAiSource> = {
      '豆包': 'doubao',
      'DeepSeek': 'deepseek',
      '文心': 'wenxin',
      '通义': 'tongyi',
      '元宝': 'yuanbao',
      'Kimi': 'kimi',
    };

    const indLabelToKey: Record<string, SubmissionIndustry> = {
      '通用': 'general',
      '烘焙': 'bakery',
      '母婴': 'mother_baby',
      '口腔': 'dental',
      '医疗': 'dental',
      '汽修': 'auto_repair',
      '装修': 'decoration',
      '餐饮': 'catering',
      '特产': 'specialty',
    };

    for (let i = 1; i < lines.length; i += 1) {
      const rowNum = i + 1;
      const cells = this.parseCsvLine(lines[i]);

      const name = (cells[nameIdx] || '').trim();
      const typeLabel = (cells[typeIdx] || '').trim();

      if (!name) {
        errors.push({ row: rowNum, error: '渠道名称不能为空' });
        continue;
      }
      if (!typeLabel || !typeLabelToKey[typeLabel]) {
        errors.push({ row: rowNum, error: `无效的渠道类型：${typeLabel || '(空)'}` });
        continue;
      }

      const channelType = typeLabelToKey[typeLabel];
      const submitUrl = urlIdx >= 0 ? (cells[urlIdx] || '').trim() : '';
      const costPerArticle = costIdx >= 0 ? Number(cells[costIdx] || 0) : 0;
      const dailyLimit = limitIdx >= 0 ? parseInt(cells[limitIdx] || '3', 10) : 3;
      const reviewHours = reviewIdx >= 0 ? parseInt(cells[reviewIdx] || '24', 10) : 24;

      let industries: SubmissionIndustry[] = ['general'];
      if (indIdx >= 0 && cells[indIdx]) {
        const parts = cells[indIdx].split('|').map((s) => s.trim()).filter(Boolean);
        const mapped = parts
          .map((p) => indLabelToKey[p])
          .filter((v): v is SubmissionIndustry => !!v);
        if (mapped.length > 0) industries = mapped;
      }

      let aiSources: SubmissionAiSource[] = [];
      if (aiIdx >= 0 && cells[aiIdx]) {
        const parts = cells[aiIdx].split('|').map((s) => s.trim()).filter(Boolean);
        aiSources = parts
          .map((p) => aiLabelToKey[p])
          .filter((v): v is SubmissionAiSource => !!v);
      }

      const remark = remarkIdx >= 0 ? cells[remarkIdx] || '' : '';
      const candidateKey = channelDedupeKey({
        ownerType: 'brand',
        ownerId: brandId,
        name,
        submitUrl,
        channelType,
      });
      const isDuplicate = existingKeys.has(candidateKey);

      if (isDuplicate) {
        duplicate += 1;
      } else {
        newCount += 1;
        existingKeys.add(candidateKey);
      }

      if (sampleItems.length < 10) {
        sampleItems.push({
          name,
          channelType,
          submitUrl: submitUrl || undefined,
          costPerArticle: isNaN(costPerArticle) ? 0 : costPerArticle,
          dailyLimit: isNaN(dailyLimit) ? 3 : dailyLimit,
          reviewHours: isNaN(reviewHours) ? 24 : reviewHours,
          industries,
          aiSources,
          remark: remark || undefined,
          isDuplicate,
        });
      }
    }

    const total = lines.length - 1;
    const errorCount = errors.length;

    // 生成一个简短 token（预览→确认的一次性凭证，服务端用内存 map 存解析结果）
    const importToken = Buffer.from(`${brandId}:${Date.now()}:${Math.random()}`).toString('base64').replace(/[^a-zA-Z0-9]/g, '').slice(0, 32);
    this._importCache.set(importToken, {
      brandId,
      items: sampleItems,
      createdAt: Date.now(),
    });

    return {
      total,
      duplicate,
      newCount,
      errorCount,
      errors: errors.slice(0, 20),
      sampleItems,
      importToken,
    };
  }

  // ---------- 批量导入：确认入库 ----------

  async importConfirm(
    brandId: string,
    importToken: string,
    csvContent: string,
    user: GeoUserCtx,
  ): Promise<SubmissionChannelImportConfirmResponse> {
    if (!brandId) {
      throw new BadRequestException('请选择品牌后再导入');
    }
    if (user.role === 'client' && user.brandId !== brandId) {
      throw new ForbiddenException('无权为其他品牌导入渠道');
    }

    // 重新从 CSV 解析并过滤出新增项，直接入库（避免依赖缓存）
    const preview = await this.importPreview(brandId, csvContent, user);
    if (preview.newCount === 0) {
      return { inserted: 0, duplicate: preview.duplicate };
    }

    // 拿完整数据再过滤一遍
    const lines = csvContent.split(/\r?\n/).filter((line) => line.trim().length > 0);
    const headerLine = lines[0];
    const headers = this.parseCsvLine(headerLine).map((h) => h.trim());

    const nameIdx = headers.indexOf('渠道名称');
    const typeIdx = headers.indexOf('渠道类型');
    const urlIdx = headers.indexOf('投稿入口URL');
    const costIdx = headers.indexOf('单篇成本');
    const limitIdx = headers.indexOf('日限额');
    const reviewIdx = headers.indexOf('审核时长');
    const indIdx = headers.indexOf('适配行业');
    const aiIdx = headers.indexOf('AI信源标记');
    const remarkIdx = headers.indexOf('备注');

    const typeLabelToKey: Record<string, SubmissionChannelType> = {
      '自建站': 'self_site',
      '自媒体站': 'public_submission',
      '公共投稿站': 'public_submission',
      '权威媒体': 'authoritative_media',
      '行业垂直站': 'industry_vertical',
    };

    const aiLabelToKey: Record<string, SubmissionAiSource> = {
      '豆包': 'doubao',
      'DeepSeek': 'deepseek',
      '文心': 'wenxin',
      '通义': 'tongyi',
      '元宝': 'yuanbao',
      'Kimi': 'kimi',
    };

    const indLabelToKey: Record<string, SubmissionIndustry> = {
      '通用': 'general',
      '烘焙': 'bakery',
      '母婴': 'mother_baby',
      '口腔': 'dental',
      '医疗': 'dental',
      '汽修': 'auto_repair',
      '装修': 'decoration',
      '餐饮': 'catering',
      '特产': 'specialty',
    };

    const toInsert: Array<typeof geoSubmissionChannels.$inferInsert> = [];

    for (let i = 1; i < lines.length; i += 1) {
      const cells = this.parseCsvLine(lines[i]);
      const name = (cells[nameIdx] || '').trim();
      const typeLabel = (cells[typeIdx] || '').trim();
      if (!name || !typeLabel || !typeLabelToKey[typeLabel]) continue;

      const channelType = typeLabelToKey[typeLabel];
      const submitUrl = urlIdx >= 0 ? (cells[urlIdx] || '').trim() : '';
      const costPerArticle = costIdx >= 0 ? Number(cells[costIdx] || 0) : 0;
      const dailyLimit = limitIdx >= 0 ? parseInt(cells[limitIdx] || '3', 10) : 3;
      const reviewHours = reviewIdx >= 0 ? parseInt(cells[reviewIdx] || '24', 10) : 24;

      let industries: SubmissionIndustry[] = ['general'];
      if (indIdx >= 0 && cells[indIdx]) {
        const parts = cells[indIdx].split('|').map((s) => s.trim()).filter(Boolean);
        const mapped = parts
          .map((p) => indLabelToKey[p])
          .filter((v): v is SubmissionIndustry => !!v);
        if (mapped.length > 0) industries = mapped;
      }

      let aiSources: SubmissionAiSource[] = [];
      if (aiIdx >= 0 && cells[aiIdx]) {
        const parts = cells[aiIdx].split('|').map((s) => s.trim()).filter(Boolean);
        aiSources = parts
          .map((p) => aiLabelToKey[p])
          .filter((v): v is SubmissionAiSource => !!v);
      }

      const remark = remarkIdx >= 0 ? cells[remarkIdx] || null : null;

      toInsert.push({
        brandId,
        ownerType: 'brand',
        ownerId: brandId,
        name,
        channelType,
        submitUrl: submitUrl || null,
        needAccount: false,
        costPerArticle: String(isNaN(costPerArticle) ? 0 : costPerArticle),
        dailyLimit: isNaN(dailyLimit) ? 3 : dailyLimit,
        reviewHours: isNaN(reviewHours) ? 24 : reviewHours,
        industries,
        requiredFields: ['标题', '正文'],
        aiSources,
        accountName: null,
        status: 'active',
        remark,
      });
    }

    // 事务内 advisory lock + 查重 + 插入，避免「预览后重复点击确认」「并发导入」写入重复行
    const { inserted, duplicate } = await this.insertChannelsIfAbsent(toInsert);
    return { inserted, duplicate: duplicate + preview.duplicate };
  }

  // ---------- CSV 行解析（支持双引号转义） ----------

  private parseCsvLine(line: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i += 1) {
      const char = line[i];
      if (inQuotes) {
        if (char === '"') {
          if (line[i + 1] === '"') {
            current += '"';
            i += 1;
          } else {
            inQuotes = false;
          }
        } else {
          current += char;
        }
      } else {
        if (char === '"') {
          inQuotes = true;
        } else if (char === ',') {
          result.push(current);
          current = '';
        } else {
          current += char;
        }
      }
    }
    result.push(current);
    return result;
  }

  private _importCache = new Map<string, { brandId: string; items: SubmissionChannelImportPreview['sampleItems']; createdAt: number }>();

  private toSubmissionChannel(
    row: typeof geoSubmissionChannels.$inferSelect,
    todayPublished: number,
  ): SubmissionChannel {
    const platformCoverage: DiagnosisPlatform[] = Array.isArray(row.platformCoverage)
      ? row.platformCoverage.filter(
          (p: string): p is DiagnosisPlatform =>
            (DIAGNOSIS_PLATFORMS as readonly string[]).includes(p),
        )
      : [];

    const tier: SubmissionChannelTier = SUBMISSION_CHANNEL_TIERS.includes(
      row.tier as SubmissionChannelTier,
    )
      ? (row.tier as SubmissionChannelTier)
      : 'C';

    const indexStatus = (row.indexStatus as SubmissionChannel['indexStatus']) ?? 'pending';
    const lastCiteAt = row.lastCiteAt ? new Date(row.lastCiteAt).toISOString() : null;

    return {
      id: row.id,
      brandId: row.brandId,
      ownerType: row.ownerType as 'platform' | 'brand',
      ownerId: row.ownerId,
      name: row.name,
      channelType: row.channelType as SubmissionChannel['channelType'],
      submitUrl: row.submitUrl,
      needAccount: row.needAccount,
      costPerArticle: Number(row.costPerArticle),
      dailyLimit: row.dailyLimit,
      todayPublished,
      reviewHours: row.reviewHours,
      industries: row.industries as SubmissionIndustry[],
      requiredFields: row.requiredFields,
      aiSources: row.aiSources as SubmissionAiSource[],
      accountName: row.accountName,
      status: row.status as SubmissionChannel['status'],
      submittedCount: row.submittedCount,
      indexedCount: row.indexedCount,
      remark: row.remark,
      usageType: (row.usageType as SubmissionChannel['usageType']) ?? null,
      platformCoverage,
      indexRate: row.indexRate ?? 0,
      citeRate: row.citeRate ?? 0,
      lastCiteAt,
      citeSnapshots: row.citeSnapshots ?? 0,
      tier,
      indexStatus,
      citeCount: row.citeSnapshots ?? 0,
      createdAt: new Date(row.createdAt).toISOString(),
      libraryType: row.libraryType as SubmissionLibraryType,
      region: row.region,
      aiPlatforms: row.aiPlatforms as SubmissionAiSource[],
      mediaType: row.mediaType as SubmissionMediaType,
      quotaTotal: row.quotaTotal ?? null,
      quotaUsed: row.quotaUsed ?? 0,
      followers: row.followers ?? null,
      likes: row.likes ?? null,
      imagePrice: row.imagePrice != null ? Number(row.imagePrice) : null,
      videoPrice: row.videoPrice != null ? Number(row.videoPrice) : null,
      description: row.description ?? null,
      costPriceCents: row.costPriceCents ?? 0,
      salePriceCents: row.salePriceCents ?? 0,
      priceUnit: row.priceUnit ?? 'article',
      sellable: row.sellable ?? false,
      salePriceOverridden: row.salePriceOverridden ?? false,
      priceUpdatedAt: row.priceUpdatedAt
        ? new Date(row.priceUpdatedAt).toISOString()
        : null,
    };
  }

  // ---------- 批次清单 ----------

  async getBatchSheet(
    query: BatchSheetQueryDto & { brandId?: string },
    user: GeoUserCtx,
  ): Promise<BatchSheetResponse> {
    // 构造所有 where 条件片段（SQL chunk 数组），统一用 raw SQL 拼接
    const whereChunks: SQL[] = [];

    // 权限过滤：复用 buildWhere 的角色权限逻辑，手工翻译成 raw SQL
    if (user.role === 'client' && user.brandId) {
      whereChunks.push(
        sql`(${geoSubmissionChannels.ownerType} = ${'platform'} OR (
          ${geoSubmissionChannels.ownerType} = ${'brand'} AND
          ${geoSubmissionChannels.ownerId} = ${user.brandId}
        ))`,
      );
    } else if (query.brandId) {
      whereChunks.push(
        sql`(${geoSubmissionChannels.ownerType} = ${'platform'} OR (
          ${geoSubmissionChannels.ownerType} = ${'brand'} AND
          ${geoSubmissionChannels.ownerId} = ${query.brandId}
        ))`,
      );
    }

    if (query.libraryType) {
      whereChunks.push(sql`${geoSubmissionChannels.libraryType} = ${query.libraryType}`);
    }
    if (query.region) {
      whereChunks.push(sql`${geoSubmissionChannels.region} = ${query.region}`);
    }
    if (query.industry) {
      whereChunks.push(sql`${geoSubmissionChannels.industries} @> ARRAY[${query.industry}]::text[]`);
    }
    if (query.tagStatus === 'tagged') {
      whereChunks.push(sql`array_length(${geoSubmissionChannels.aiPlatforms}, 1) > 0`);
    } else if (query.tagStatus === 'untagged') {
      whereChunks.push(sql`array_length(${geoSubmissionChannels.aiPlatforms}, 1) = 0`);
    }

    const whereSql = whereChunks.length > 0
      ? sql`WHERE ${sql.join(whereChunks, sql` AND `)}`
      : sql``;

    // 按 region + 展开后的 industry 分组统计
    const groupsSql = sql<{ region: string; industry: string; total: string; tagged: string; untagged: string }>`
      SELECT
        ${geoSubmissionChannels.region} AS region,
        industry,
        count(*) AS total,
        count(*) filter (where COALESCE(array_length(${geoSubmissionChannels.aiPlatforms}, 1), 0) > 0) AS tagged,
        count(*) filter (where COALESCE(array_length(${geoSubmissionChannels.aiPlatforms}, 1), 0) = 0) AS untagged
      FROM ${geoSubmissionChannels},
           unnest(${geoSubmissionChannels.industries}) AS industry
      ${whereSql}
      GROUP BY ${geoSubmissionChannels.region}, industry
      ORDER BY ${geoSubmissionChannels.region}, industry
    `;

    // 汇总统计（按渠道×行业展开，与分组口径一致）
    const summarySql = sql<{ total: string; tagged: string; untagged: string }>`
      SELECT
        count(*) AS total,
        count(*) filter (where COALESCE(array_length(${geoSubmissionChannels.aiPlatforms}, 1), 0) > 0) AS tagged,
        count(*) filter (where COALESCE(array_length(${geoSubmissionChannels.aiPlatforms}, 1), 0) = 0) AS untagged
      FROM ${geoSubmissionChannels},
           unnest(${geoSubmissionChannels.industries}) AS industry
      ${whereSql}
    `;

    const groupRows = await this.db.execute(groupsSql);
    const summaryRows = await this.db.execute(summarySql);

    type GroupRow = { region: string; industry: string; total: string; tagged: string; untagged: string };
    type SummaryRow = { total: string; tagged: string; untagged: string };

    const groups: { region: string; industry: string; total: number; tagged: number; untagged: number }[] = (groupRows as unknown as GroupRow[]).map((row: GroupRow) => ({
      region: row.region,
      industry: row.industry,
      total: Number(row.total),
      tagged: Number(row.tagged),
      untagged: Number(row.untagged),
    }));

    const items: BatchSheetItem[] = groups.map((g) => ({
      region: g.region,
      industry: g.industry as SubmissionIndustry,
      totalCount: g.total,
      taggedCount: g.tagged,
      untaggedCount: g.untagged,
    }));

    const summaryArr = summaryRows as unknown as SummaryRow[];
    const total = summaryArr[0] ? Number(summaryArr[0].total) : 0;
    const tagged = summaryArr[0] ? Number(summaryArr[0].tagged) : 0;
    const untagged = summaryArr[0] ? Number(summaryArr[0].untagged) : 0;
    const coverage = total > 0 ? Number(((tagged / total) * 100).toFixed(2)) : 0;

    return {
      items,
      total,
      taggedTotal: tagged,
      untaggedTotal: untagged,
      coverageRate: total > 0 ? tagged / total : 0,
    };
  }

  // ---------- 自动选源 ----------

  async autoSelectChannels(
    dto: AutoSelectDto,
    user: GeoUserCtx,
  ): Promise<AutoSelectChannelsResult> {
    const query = new SubmissionChannelQueryDto();
    query.brandId = dto.brandId;
    query.libraryType = dto.libraryType;
    query.region = dto.region;
    query.industry = dto.industry;
    query.mediaType = dto.mediaType;
    query.status = 'active';

    const baseConditions = this.buildWhere(query, user);
    const extraConditions: Array<ReturnType<typeof eq>> = [];

    if (dto.aiPlatforms && dto.aiPlatforms.length > 0) {
      const platformItems = dto.aiPlatforms.map((p: string) => sql`${p}`);
      const platformArraySql = platformItems.length > 0
        ? sql`ARRAY[${sql.join(platformItems, sql`, `)}]::text[]`
        : sql`ARRAY[]::text[]`;
      extraConditions.push(
        sql`${geoSubmissionChannels.aiPlatforms} && ${platformArraySql}` as unknown as ReturnType<typeof eq>,
      );
    }

    if (dto.budgetMax !== undefined && dto.mediaType) {
      if (dto.mediaType === 'image_text') {
        extraConditions.push(
          sql`(${geoSubmissionChannels.imagePrice} IS NULL OR ${geoSubmissionChannels.imagePrice} <= ${dto.budgetMax})` as unknown as ReturnType<typeof eq>,
        );
      } else if (dto.mediaType === 'video') {
        extraConditions.push(
          sql`(${geoSubmissionChannels.videoPrice} IS NULL OR ${geoSubmissionChannels.videoPrice} <= ${dto.budgetMax})` as unknown as ReturnType<typeof eq>,
        );
      } else if (dto.mediaType === 'image_text_video') {
        extraConditions.push(
          sql`(
            (${geoSubmissionChannels.imagePrice} IS NULL OR ${geoSubmissionChannels.imagePrice} <= ${dto.budgetMax})
            OR (${geoSubmissionChannels.videoPrice} IS NULL OR ${geoSubmissionChannels.videoPrice} <= ${dto.budgetMax})
          )` as unknown as ReturnType<typeof eq>,
        );
      }
    }

    const allConditions = [...baseConditions, ...extraConditions];
    const whereClause = allConditions.length > 0 ? and(...allConditions) : undefined;

    const rows = await this.db
      .select()
      .from(geoSubmissionChannels)
      .where(whereClause)
      .orderBy(
        asc(geoSubmissionChannels.name),
        asc(geoSubmissionChannels.id),
      )
      .limit(200);

    const todayCounts = await this.getTodayPublishedCounts(
      rows.map((row) => row.id),
    );

    const channels: SubmissionChannel[] = rows.map((row) =>
      this.toSubmissionChannel(row, todayCounts.get(row.id) ?? 0),
    );

    let totalCost = 0;
    let unpricedCount = 0;
    for (const ch of channels) {
      let hasPrice = false;
      if (dto.mediaType === 'image_text' && ch.imagePrice != null) {
        totalCost += ch.imagePrice;
        hasPrice = true;
      } else if (dto.mediaType === 'video' && ch.videoPrice != null) {
        totalCost += ch.videoPrice;
        hasPrice = true;
      } else if (dto.mediaType === 'image_text_video') {
        if (ch.imagePrice != null) { totalCost += ch.imagePrice; hasPrice = true; }
        if (ch.videoPrice != null) { totalCost += ch.videoPrice; hasPrice = true; }
      }
      if (!hasPrice) unpricedCount += 1;
    }

    const items: AutoSelectChannelItem[] = channels.map((ch) => ({
      id: ch.id,
      name: ch.name,
      libraryType: ch.libraryType,
      region: ch.region,
      aiPlatforms: ch.aiPlatforms,
      imagePrice: ch.imagePrice,
      videoPrice: ch.videoPrice,
    }));

    return { items, totalCost, unpricedCount };
  }

  // ---------- 批量打 AI 信源标签 ----------

  async batchUpdateTags(
    dto: BatchTagDto,
    user: GeoUserCtx,
  ): Promise<BatchTagResponse> {
    // 1. 构造 where 条件
    const conditions: Array<ReturnType<typeof eq>> = [];

    if (dto.scope === 'selection') {
      if (!dto.ids || dto.ids.length === 0) {
        throw new BadRequestException('批量选择模式必须提供 ids');
      }
      conditions.push(
        inArray(geoSubmissionChannels.id, dto.ids) as unknown as ReturnType<typeof eq>,
      );
      // 叠加权限过滤：用空 query 调 buildWhere 拿到角色权限条件
      const scopeConditions = this.buildWhere(new SubmissionChannelQueryDto(), user);
      conditions.push(...scopeConditions);
    } else {
      // filter 模式
      const filterQuery = dto.filter ?? new SubmissionChannelQueryDto();
      const scopeConditions = this.buildWhere(filterQuery, user);
      conditions.push(...scopeConditions);
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // 2. 校验可更新字段
    const hasPlatforms = dto.platforms !== undefined;
    const hasMediaType = dto.mediaType !== undefined;
    const hasImagePrice = dto.imagePrice !== undefined;
    const hasVideoPrice = dto.videoPrice !== undefined;
    const hasQuotaTotal = dto.quotaTotal !== undefined;
    const hasFollowers = dto.followers !== undefined;
    const hasLikes = dto.likes !== undefined;

    if (
      !hasPlatforms && !hasMediaType && !hasImagePrice &&
      !hasVideoPrice && !hasQuotaTotal && !hasFollowers && !hasLikes
    ) {
      throw new BadRequestException('未提供任何可更新字段');
    }

    // 3. 计数 & 上限校验
    const countResult = await this.db
      .select({ count: count() })
      .from(geoSubmissionChannels)
      .where(whereClause);
    const targetCount = Number(countResult[0]?.count ?? 0);

    if (targetCount > 5000) {
      throw new BadRequestException('单次批量更新上限 5000 条，请分页提交');
    }

    if (targetCount === 0) {
      return { updated: 0 };
    }

    // 4. 构造 set patch
    const setValues: Record<string, unknown> = {};

    if (hasPlatforms) {
      const platforms = dto.platforms ?? [];
      if (dto.mode === 'append') {
        // 追加并去重：逐个参数化平台值，避免 JS 数组被展开成 record
        const platformItems = platforms.map((p: string) => sql`${p}`);
        const platformArraySql = platformItems.length > 0
          ? sql`ARRAY[${sql.join(platformItems, sql`, `)}]::text[]`
          : sql`ARRAY[]::text[]`;
        setValues.aiPlatforms = sql`ARRAY(SELECT DISTINCT unnest(array_cat(${geoSubmissionChannels.aiPlatforms}, ${platformArraySql})))`;
      } else {
        // 替换
        setValues.aiPlatforms = platforms;
      }
    }

    if (hasMediaType) {
      setValues.mediaType = dto.mediaType;
    }

    if (hasImagePrice) {
      setValues.imagePrice = dto.imagePrice;
    }
    if (hasVideoPrice) {
      setValues.videoPrice = dto.videoPrice;
    }
    if (hasQuotaTotal) {
      setValues.quotaTotal = dto.quotaTotal;
    }
    if (hasFollowers) {
      setValues.followers = dto.followers;
    }
    if (hasLikes) {
      setValues.likes = dto.likes;
    }

    // 5. 执行更新
    const updatedRows = await this.db
      .update(geoSubmissionChannels)
      .set(setValues)
      .where(whereClause)
      .returning({ id: geoSubmissionChannels.id });

    const updated = updatedRows.length;

    // 6. 写操作日志
    const operatorName = user.displayName || user.username || '未知用户';
    await this.db.insert(geoSourceTagLogs).values({
      operatorId: user.id,
      operatorName,
      scope: dto.scope,
      targetCount,
      platforms: dto.platforms ?? [],
      mediaType: dto.mediaType ?? null,
      imagePrice: dto.imagePrice != null ? String(dto.imagePrice) : null,
      videoPrice: dto.videoPrice != null ? String(dto.videoPrice) : null,
      quotaTotal: dto.quotaTotal ?? null,
      followers: dto.followers ?? null,
      likes: dto.likes ?? null,
      mode: dto.mode,
    });

    return { updated };
  }

  // ---------- 打标签操作日志列表 ----------

  async listTagLogs(
    user: GeoUserCtx,
  ): Promise<SourceTagLogListResponse> {
    const rows = await this.db
      .select()
      .from(geoSourceTagLogs)
      .orderBy(desc(geoSourceTagLogs.createdAt))
      .limit(200);

    const uuidPattern =
      /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
    const items: SourceTagLog[] = rows.map((row) => ({
      id: row.id,
      operatorId: row.operatorId,
      operatorName:
        !row.operatorName || uuidPattern.test(row.operatorName)
          ? '未知用户'
          : row.operatorName,
      scope: row.scope as 'selection' | 'filter',
      targetCount: row.targetCount,
      platforms: row.platforms ?? [],
      mediaType: row.mediaType ?? null,
      imagePrice: row.imagePrice != null ? Number(row.imagePrice) : null,
      videoPrice: row.videoPrice != null ? Number(row.videoPrice) : null,
      quotaTotal: row.quotaTotal ?? null,
      followers: row.followers ?? null,
      likes: row.likes ?? null,
      mode: row.mode as 'append' | 'replace',
      createdAt: new Date(row.createdAt).toISOString(),
    }));

    return { items };
  }

  // ---------- URL 统计 ----------

  async getUrlStats(
    query: SubmissionChannelQueryDto,
    user: GeoUserCtx,
  ): Promise<SubmissionUrlStats> {
    const baseConditions = this.buildWhere(query, user);
    const baseQuery = baseConditions.length > 0
      ? this.db.select().from(geoSubmissionChannels).where(and(...baseConditions))
      : this.db.select().from(geoSubmissionChannels);

    const [{ total }] = await this.db
      .select({ total: count() })
      .from(baseQuery.as('base'));

    const withUrlQuery = baseConditions.length > 0
      ? this.db.select().from(geoSubmissionChannels)
          .where(and(...baseConditions, sql`${geoSubmissionChannels.submitUrl} IS NOT NULL AND ${geoSubmissionChannels.submitUrl} <> ''`))
      : this.db.select().from(geoSubmissionChannels)
          .where(sql`${geoSubmissionChannels.submitUrl} IS NOT NULL AND ${geoSubmissionChannels.submitUrl} <> ''`);

    const [{ withUrl }] = await this.db
      .select({ withUrl: count() })
      .from(withUrlQuery.as('wu'));

    const noEntryQuery = baseConditions.length > 0
      ? this.db.select().from(geoSubmissionChannels)
          .where(and(
            ...baseConditions,
            sql`(${geoSubmissionChannels.submitUrl} IS NULL OR ${geoSubmissionChannels.submitUrl} = '')`,
            sql`(${geoSubmissionChannels.name} IS NULL OR ${geoSubmissionChannels.name} = '')`,
          ))
      : this.db.select().from(geoSubmissionChannels)
          .where(sql`
            (submit_url IS NULL OR submit_url = '')
            AND (name IS NULL OR name = '')
          `);

    const [{ noEntry }] = await this.db
      .select({ noEntry: count() })
      .from(noEntryQuery.as('ne'));

    const selfSiteQuery = baseConditions.length > 0
      ? this.db.select().from(geoSubmissionChannels)
          .where(and(
            ...baseConditions,
            sql`${geoSubmissionChannels.channelType} = 'self_site'`,
          ))
      : this.db.select().from(geoSubmissionChannels)
          .where(sql`channel_type = 'self_site'`);

    const [{ selfSite }] = await this.db
      .select({ selfSite: count() })
      .from(selfSiteQuery.as('ss'));

    const withoutUrl = total - withUrl;
    const publicNeedPatch = withoutUrl - noEntry - selfSite;
    const searchDirect = publicNeedPatch < 0 ? 0 : publicNeedPatch;
    const coverageDenom = withUrl + searchDirect;
    const coverageRate = coverageDenom > 0 ? Number(((withUrl / coverageDenom) * 100).toFixed(2)) : 0;

    return {
      total,
      withUrl,
      searchDirect,
      noEntry,
      selfSite,
      withoutUrl,
      coverageRate,
    };
  }

  // ---------- 批量补录 URL ----------

  async batchUrlPatch(
    dto: BatchUrlPatchDto,
    user: GeoUserCtx,
  ): Promise<BatchUrlPatchResult> {
    if (dto.rows.length > 5000) {
      throw new BadRequestException('单次批量补录最多 5000 行');
    }
    if (dto.rows.length === 0) {
      return {
        totalRows: 0,
        successCount: 0,
        unmatchedCount: 0,
        ambiguousCount: 0,
        unmatchedItems: [],
      };
    }

    const brandFilter = user.role === 'client' && user.brandId
      ? [eq(geoSubmissionChannels.brandId, user.brandId)]
      : dto.brandId
        ? [eq(geoSubmissionChannels.brandId, dto.brandId)]
        : [];

    const allChannels = brandFilter.length > 0
      ? await this.db
          .select({
            id: geoSubmissionChannels.id,
            name: geoSubmissionChannels.name,
            libraryType: geoSubmissionChannels.channelType,
          })
          .from(geoSubmissionChannels)
          .where(and(...brandFilter))
      : await this.db
          .select({
            id: geoSubmissionChannels.id,
            name: geoSubmissionChannels.name,
            libraryType: geoSubmissionChannels.channelType,
          })
          .from(geoSubmissionChannels);

    const channelMap = new Map<string, { id: string; libraryType: string | null }[]>();
    for (const ch of allChannels) {
      const key = ch.name.toLowerCase().trim();
      const arr = channelMap.get(key) ?? [];
      arr.push({ id: ch.id, libraryType: ch.libraryType });
      channelMap.set(key, arr);
    }

    const updates: Array<{ id: string; url: string }> = [];
    const unmatchedItems: BatchUrlPatchResult['unmatchedItems'] = [];

    for (const row of dto.rows) {
      const nameKey = row.name.trim().toLowerCase();
      const candidates = channelMap.get(nameKey) ?? [];

      if (candidates.length === 0) {
        unmatchedItems.push({
          name: row.name,
          libraryType: row.libraryType,
          url: row.url,
          reason: '未找到匹配的信源',
        });
        continue;
      }

      let matchedIds: string[] = [];
      if (!row.libraryType) {
        matchedIds = candidates.map((c) => c.id);
      } else if (row.libraryType) {
        const libMatches = candidates.filter(
          (c) => c.libraryType?.toLowerCase() === row.libraryType.toLowerCase(),
        );
        if (libMatches.length >= 1) {
          matchedIds = libMatches.map((c) => c.id);
        } else {
          unmatchedItems.push({
            name: row.name,
            libraryType: row.libraryType,
            url: row.url,
            reason: '未找到匹配库类型的渠道',
          });
          continue;
        }
      }

      if (matchedIds.length > 0) {
        let validatedUrl: string;
        try {
          validatedUrl = this.validateHttpUrl(row.url);
        } catch {
          unmatchedItems.push({
            name: row.name,
            libraryType: row.libraryType,
            url: row.url,
            reason: 'URL 协议不合法',
          });
          continue;
        }
        for (const id of matchedIds) {
          updates.push({ id, url: validatedUrl });
        }
      }
    }

    if (updates.length > 0) {
      await this.db.transaction(async (tx) => {
        for (const u of updates) {
          await tx
            .update(geoSubmissionChannels)
            .set({
              submitUrl: u.url,
            })
            .where(eq(geoSubmissionChannels.id, u.id));
        }
      });
    }

    const ambiguousCount = unmatchedItems.filter(
      (i) => i.reason.includes('需人工确认'),
    ).length;
    const unmatchedCount = unmatchedItems.length - ambiguousCount;

    await this.db.insert(geoSourceUrlLogs).values({
      operatorId: user.id,
      operatorName: user.displayName || user.username,
      totalRows: dto.rows.length,
      successCount: updates.length,
      unmatchedCount,
      ambiguousCount,
      unmatchedItems: JSON.stringify(unmatchedItems) as unknown as BatchUrlPatchResult['unmatchedItems'],
    });

    return {
      totalRows: dto.rows.length,
      successCount: updates.length,
      unmatchedCount,
      ambiguousCount,
      unmatchedItems,
    };
  }

  // ---------- 域名映射表批量补录 URL ----------

  async fillUrlsFromMap(user: GeoUserCtx): Promise<{ matched: number; unmatched: number }> {
    const brandFilter = user.role === 'client' && user.brandId
      ? sql`AND sc.brand_id = ${user.brandId}`
      : sql``;

    const matchResult = await this.db.execute(sql`
      WITH candidates AS (
        SELECT
          sc.id,
          sc.name,
          m.domain,
          ROW_NUMBER() OVER (PARTITION BY sc.id ORDER BY LENGTH(m.keyword) DESC) AS rn
        FROM geo_submission_channels sc
        JOIN geo_source_domain_map m
          ON sc.name ILIKE '%' || m.keyword || '%'
        WHERE (sc.submit_url IS NULL OR sc.submit_url = '')
          AND sc.channel_type != 'self_site'
          ${brandFilter}
      )
      SELECT c.id, c.name, c.domain
      INTO TEMP TABLE _tmp_map_updates
      FROM candidates c
      WHERE c.rn = 1;
    `);

    const updateResult = await this.db.execute(sql`
      UPDATE geo_submission_channels sc
      SET submit_url = 'https://' || t.domain,
          _updated_at = CURRENT_TIMESTAMP
      FROM _tmp_map_updates t
      WHERE sc.id = t.id
        AND (sc.submit_url IS NULL OR sc.submit_url = '')
        AND sc.channel_type != 'self_site'
        ${brandFilter};
    `);

    const countRows = await this.db.execute(sql`
      SELECT
        (SELECT COUNT(*) FROM _tmp_map_updates)::int AS matched,
        (SELECT COUNT(*) FROM geo_submission_channels sc
         WHERE (sc.submit_url IS NULL OR sc.submit_url = '')
           AND sc.channel_type != 'self_site'
           ${brandFilter})::int AS unmatched;
    `);

    const firstRow = (countRows[0] ?? {}) as { matched?: number; unmatched?: number };
    const matchedCount: number = firstRow.matched ?? 0;
    const unmatchedCount: number = firstRow.unmatched ?? 0;

    await this.db.insert(geoSourceUrlLogs).values({
      operatorId: user.id,
      operatorName: user.displayName || user.username,
      mode: 'domain_map',
      totalRows: matchedCount + unmatchedCount,
      successCount: matchedCount,
      unmatchedCount,
      ambiguousCount: 0,
      unmatchedItems: '[]' as unknown as BatchUrlPatchResult['unmatchedItems'],
    });

    await this.db.execute(sql`DROP TABLE IF EXISTS _tmp_map_updates;`);

    return { matched: matchedCount, unmatched: unmatchedCount };
  }

  // ---------- 未匹配渠道清单导出 ----------

  async exportUnmatchedCsv(
    query: SubmissionChannelQueryDto,
    user: GeoUserCtx,
  ): Promise<string> {
    const baseConditions = this.buildWhere(query, user);
    const whereSql = baseConditions.length > 0
      ? sql`AND ${sql.join(baseConditions, sql` AND `)}`
      : sql``;

    const rows = await this.db.execute(sql`
      SELECT
        name,
        library_type AS "libraryType",
        channel_type AS "channelType",
        region,
        industry,
        COUNT(*) AS cnt
      FROM geo_submission_channels
      WHERE (submit_url IS NULL OR submit_url = '')
        ${whereSql}
      GROUP BY name, library_type, channel_type, region, industry
      ORDER BY
        CASE WHEN channel_type = 'self_site' THEN 1 ELSE 0 END ASC,
        cnt DESC,
        name ASC
      LIMIT 5000;
    `);

    const channelTypeLabel = (t: unknown): string => {
      if (t === 'self_site') return '自有站点（无需补录）';
      return String(t ?? '');
    };

    const header = '名称,库类型,渠道类型,地区,行业,条数';
    const lines = (rows as Array<Record<string, unknown>>).map((r) =>
      `"${String(r.name ?? '')}","${String(r.libraryType ?? '')}","${channelTypeLabel(r.channelType)}","${String(r.region ?? '')}","${String(r.industry ?? '')}",${Number(r.cnt ?? 0)}`,
    );
    return '\ufeff' + [header, ...lines].join('\n');
  }

  // ---------- URL 补录日志 ----------

  async listUrlLogs(user: GeoUserCtx): Promise<SourceUrlLogListResponse> {
    const rows = await this.db
      .select()
      .from(geoSourceUrlLogs)
      .orderBy(desc(geoSourceUrlLogs.createdAt))
      .limit(200);

    const items: SourceUrlLog[] = rows.map((row) => ({
      id: row.id,
      operatorId: row.operatorId,
      operatorName: row.operatorName || '未知用户',
      totalRows: row.totalRows,
      successCount: row.successCount,
      unmatchedCount: row.unmatchedCount,
      ambiguousCount: row.ambiguousCount,
      unmatchedItems: Array.isArray(row.unmatchedItems) ? row.unmatchedItems : [],
      createdAt: new Date(row.createdAt).toISOString(),
    }));

    return { items };
  }

  private validateHttpUrl(url: string): string {
    let trimmed = url.trim();
    if (!trimmed) {
      throw new BadRequestException('URL 不能为空');
    }
    if (!/^https?:\/\//i.test(trimmed)) {
      trimmed = 'https://' + trimmed;
    }
    try {
      const parsed = new URL(trimmed);
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        throw new BadRequestException('仅支持 http:// 与 https:// 协议');
      }
      return parsed.toString();
    } catch (e) {
      if (e instanceof HttpException) throw e;
      throw new BadRequestException('URL 格式不合法');
    }
  }
}

function extractPostgresErrorCode(error: unknown): string | undefined {
  let current: unknown = error;
  for (let depth = 0; depth < 4 && current && typeof current === 'object'; depth += 1) {
    const { code, cause } = current as { code?: unknown; cause?: unknown };
    if (typeof code === 'string') return code;
    current = cause;
  }
  return undefined;
}
