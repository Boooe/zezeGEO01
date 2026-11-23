import {
  Injectable,
  Inject,
  Logger,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { DRIZZLE_DATABASE, type PostgresJsDatabase } from '@lark-apaas/fullstack-nestjs-core';
import { eq, and, ilike, desc, sql, count, or } from 'drizzle-orm';

import {
  geoWebsiteSettings,
  geoTdkTemplates,
  geoSiteNetwork,
  geoBrands,
} from '@server/database/schema';
import type {
  WebsiteSettings,
  TdkTemplate,
  SiteNetworkItem,
  PagedResponse,
  UserRole,
  WebsiteContactInfo,
  SiteType,
} from '@shared/api.interface';
import { SITE_STATUS, isSiteStatus, SITE_TYPES, isSiteType } from '@shared/api.interface';
import {
  WebsiteSettingsQueryDto,
  SaveWebsiteSettingsDto,
  TdkTemplateListQueryDto,
  CreateTdkTemplateDto,
  UpdateTdkTemplateDto,
  ApplyTdkTemplateDto,
  SiteListQueryDto,
  CreateSiteDto,
  UpdateSiteDto,
} from './dto/website.dto';

interface GeoUserCtx {
  id: string;
  role: UserRole;
  brandId: string | null;
}

@Injectable()
export class WebsiteService {
  private readonly logger = new Logger(WebsiteService.name);

  constructor(
    @Inject(DRIZZLE_DATABASE) private readonly db: PostgresJsDatabase,
  ) {}

  private checkBrandAccess(user: GeoUserCtx, brandId: string): void {
    if (user.role === 'client' && user.brandId && user.brandId !== brandId) {
      throw new ForbiddenException('无权访问其他品牌数据');
    }
  }

  // ---------- 官网设置 ----------

  async getSettings(
    query: WebsiteSettingsQueryDto,
    user: GeoUserCtx,
  ): Promise<WebsiteSettings & { id: string | null }> {
    const brandId = user.role === 'client' ? user.brandId ?? '' : query.brandId ?? '';
    if (!brandId) {
      return {
        id: null,
        brandId: '',
        domain: null,
        siteName: null,
        siteDescription: null,
        contactInfo: null,
        creatorId: user.id,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
    }
    this.checkBrandAccess(user, brandId);

    const rows = await this.db
      .select()
      .from(geoWebsiteSettings)
      .where(eq(geoWebsiteSettings.brandId, brandId))
      .limit(1);

    if (rows.length === 0) {
      return {
        id: null,
        brandId: query.brandId,
        domain: null,
        siteName: null,
        siteDescription: null,
        contactInfo: null,
        creatorId: user.id,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
    }

    const row = rows[0];
    return {
      id: row.id,
      brandId: row.brandId,
      domain: row.domain ?? null,
      siteName: row.siteName ?? null,
      siteDescription: row.siteDescription ?? null,
      contactInfo: (row.contactInfo as WebsiteContactInfo | null) ?? null,
      creatorId: row.creatorId,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  async saveSettings(
    dto: SaveWebsiteSettingsDto,
    user: GeoUserCtx,
  ): Promise<WebsiteSettings> {
    this.checkBrandAccess(user, dto.brandId);

    const existing = await this.db
      .select({ id: geoWebsiteSettings.id })
      .from(geoWebsiteSettings)
      .where(eq(geoWebsiteSettings.brandId, dto.brandId))
      .limit(1);

    const contactInfo = dto.contactInfo
      ? {
          phone: dto.contactInfo.phone ?? '',
          email: dto.contactInfo.email ?? '',
          address: dto.contactInfo.address ?? '',
        }
      : null;

    if (existing.length === 0) {
      const inserted = await this.db
        .insert(geoWebsiteSettings)
        .values({
          brandId: dto.brandId,
          domain: dto.domain ?? null,
          siteName: dto.siteName ?? null,
          siteDescription: dto.siteDescription ?? null,
          contactInfo: contactInfo as any,
          creatorId: user.id,
        })
        .returning();

      const row = inserted[0];
      return {
        id: row.id,
        brandId: row.brandId,
        domain: row.domain ?? null,
        siteName: row.siteName ?? null,
        siteDescription: row.siteDescription ?? null,
        contactInfo: (row.contactInfo as WebsiteContactInfo | null) ?? null,
        creatorId: row.creatorId,
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
      };
    }

    const patch: Partial<typeof geoWebsiteSettings.$inferInsert> = {};
    if (dto.domain !== undefined) patch.domain = dto.domain;
    if (dto.siteName !== undefined) patch.siteName = dto.siteName;
    if (dto.siteDescription !== undefined) patch.siteDescription = dto.siteDescription;
    if (dto.contactInfo !== undefined) {
      patch.contactInfo = contactInfo as any;
    }

    if (Object.keys(patch).length === 0) {
      throw new BadRequestException('未提供可更新字段');
    }

    const updated = await this.db
      .update(geoWebsiteSettings)
      .set(patch)
      .where(eq(geoWebsiteSettings.id, existing[0].id))
      .returning();

    const row = updated[0];
    return {
      id: row.id,
      brandId: row.brandId,
      domain: row.domain ?? null,
      siteName: row.siteName ?? null,
      siteDescription: row.siteDescription ?? null,
      contactInfo: (row.contactInfo as WebsiteContactInfo | null) ?? null,
      creatorId: row.creatorId,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  // ---------- TDK 模板 ----------

  async listTdkTemplates(
    query: TdkTemplateListQueryDto,
    user: GeoUserCtx,
  ): Promise<TdkTemplate[]> {
    const brandId = user.role === 'client' ? user.brandId ?? '' : query.brandId ?? '';
    if (!brandId) return [];
    this.checkBrandAccess(user, brandId);

    const conditions = [eq(geoTdkTemplates.brandId, brandId)];
    if (query.pageType) {
      conditions.push(eq(geoTdkTemplates.pageType, query.pageType));
    }

    const rows = await this.db
      .select()
      .from(geoTdkTemplates)
      .where(and(...conditions))
      .orderBy(
        desc(geoTdkTemplates.isDefault),
        desc(geoTdkTemplates.createdAt),
      );

    return rows.map((row) => ({
      id: row.id,
      brandId: row.brandId,
      name: row.name,
      titleTemplate: row.titleTemplate,
      descriptionTemplate: row.descriptionTemplate,
      keywordsTemplate: row.keywordsTemplate,
      pageType: row.pageType ?? null,
      isDefault: row.isDefault ?? false,
      creatorId: row.creatorId,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    }));
  }

  private async clearOtherDefaults(brandId: string, excludeId?: string): Promise<void> {
    const conditions: any[] = [
      eq(geoTdkTemplates.brandId, brandId),
      eq(geoTdkTemplates.isDefault, true),
    ];
    if (excludeId) {
      conditions.push(sql`${geoTdkTemplates.id} != ${excludeId}`);
    }
    await this.db
      .update(geoTdkTemplates)
      .set({ isDefault: false })
      .where(and(...conditions));
  }

  async createTdkTemplate(
    dto: CreateTdkTemplateDto,
    user: GeoUserCtx,
  ): Promise<TdkTemplate> {
    this.checkBrandAccess(user, dto.brandId);

    const isDefault = dto.isDefault ?? false;

    if (isDefault) {
      await this.clearOtherDefaults(dto.brandId);
    }

    const inserted = await this.db
      .insert(geoTdkTemplates)
      .values({
        brandId: dto.brandId,
        name: dto.name,
        titleTemplate: dto.titleTemplate,
        descriptionTemplate: dto.descriptionTemplate,
        keywordsTemplate: dto.keywordsTemplate,
        pageType: dto.pageType ?? null,
        isDefault,
        creatorId: user.id,
      })
      .returning();

    const row = inserted[0];
    return {
      id: row.id,
      brandId: row.brandId,
      name: row.name,
      titleTemplate: row.titleTemplate,
      descriptionTemplate: row.descriptionTemplate,
      keywordsTemplate: row.keywordsTemplate,
      pageType: row.pageType ?? null,
      isDefault: row.isDefault ?? false,
      creatorId: row.creatorId,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  async updateTdkTemplate(
    id: string,
    dto: UpdateTdkTemplateDto,
    user: GeoUserCtx,
  ): Promise<TdkTemplate> {
    const existing = await this.db
      .select()
      .from(geoTdkTemplates)
      .where(eq(geoTdkTemplates.id, id))
      .limit(1);

    if (existing.length === 0) {
      throw new NotFoundException('TDK 模板不存在');
    }

    const row = existing[0];
    this.checkBrandAccess(user, row.brandId);

    const patch: Partial<typeof geoTdkTemplates.$inferInsert> = {};
    if (dto.name !== undefined) patch.name = dto.name;
    if (dto.titleTemplate !== undefined) patch.titleTemplate = dto.titleTemplate;
    if (dto.descriptionTemplate !== undefined)
      patch.descriptionTemplate = dto.descriptionTemplate;
    if (dto.keywordsTemplate !== undefined)
      patch.keywordsTemplate = dto.keywordsTemplate;
    if (dto.pageType !== undefined) patch.pageType = dto.pageType;

    const setDefault = dto.isDefault ?? false;

    if (Object.keys(patch).length === 0 && dto.isDefault === undefined) {
      throw new BadRequestException('未提供可更新字段');
    }

    if (dto.isDefault !== undefined) {
      patch.isDefault = setDefault;
    }

    await this.db.transaction(async (tx) => {
      if (setDefault) {
        await tx
          .update(geoTdkTemplates)
          .set({ isDefault: false })
          .where(
            and(
              eq(geoTdkTemplates.brandId, row.brandId),
              eq(geoTdkTemplates.isDefault, true),
              sql`${geoTdkTemplates.id} != ${id}`,
            ),
          );
      }

      await tx
        .update(geoTdkTemplates)
        .set(patch)
        .where(eq(geoTdkTemplates.id, id));
    });

    const updatedRows = await this.db
      .select()
      .from(geoTdkTemplates)
      .where(eq(geoTdkTemplates.id, id))
      .limit(1);

    const updatedRow = updatedRows[0];
    return {
      id: updatedRow.id,
      brandId: updatedRow.brandId,
      name: updatedRow.name,
      titleTemplate: updatedRow.titleTemplate,
      descriptionTemplate: updatedRow.descriptionTemplate,
      keywordsTemplate: updatedRow.keywordsTemplate,
      pageType: updatedRow.pageType ?? null,
      isDefault: updatedRow.isDefault ?? false,
      creatorId: updatedRow.creatorId,
      createdAt: updatedRow.createdAt.toISOString(),
      updatedAt: updatedRow.updatedAt.toISOString(),
    };
  }

  async deleteTdkTemplate(id: string, user: GeoUserCtx): Promise<void> {
    const existing = await this.db
      .select({ id: geoTdkTemplates.id, brandId: geoTdkTemplates.brandId })
      .from(geoTdkTemplates)
      .where(eq(geoTdkTemplates.id, id))
      .limit(1);

    if (existing.length === 0) {
      throw new NotFoundException('TDK 模板不存在');
    }

    this.checkBrandAccess(user, existing[0].brandId);

    const deleted = await this.db
      .delete(geoTdkTemplates)
      .where(eq(geoTdkTemplates.id, id))
      .returning({ id: geoTdkTemplates.id });

    if (deleted.length === 0) {
      throw new NotFoundException('TDK 模板不存在');
    }
  }

  async applyTdkTemplate(
    id: string,
    dto: ApplyTdkTemplateDto,
    user: GeoUserCtx,
  ): Promise<{ title: string; description: string; keywords: string }> {
    const existing = await this.db
      .select()
      .from(geoTdkTemplates)
      .where(eq(geoTdkTemplates.id, id))
      .limit(1);

    if (existing.length === 0) {
      throw new NotFoundException('TDK 模板不存在');
    }

    const row = existing[0];
    this.checkBrandAccess(user, row.brandId);

    const brandName = dto.brandName;
    const coreKeyword = dto.keywords[0] ?? '';
    const keywordsStr = dto.keywords.join(',');

    const replaceVars = (text: string): string => {
      return text
        .replace(/\{品牌名\}/g, brandName)
        .replace(/\{核心词\}/g, coreKeyword)
        .replace(/\{关键词\}/g, keywordsStr);
    };

    return {
      title: replaceVars(row.titleTemplate),
      description: replaceVars(row.descriptionTemplate),
      keywords: replaceVars(row.keywordsTemplate),
    };
  }

  // ---------- 站群 ----------

  async listSites(
    query: SiteListQueryDto,
    user: GeoUserCtx,
  ): Promise<PagedResponse<SiteNetworkItem>> {
    const brandId = user.role === 'client' ? user.brandId ?? '' : query.brandId ?? '';
    const page = query.page ?? 1;
    const pageSize = query.limit ?? query.pageSize ?? 20;

    if (!brandId) {
      return { items: [], total: 0, page, pageSize };
    }
    this.checkBrandAccess(user, brandId);

    const conditions = [eq(geoSiteNetwork.brandId, brandId)];

    if (query.status && isSiteStatus(query.status)) {
      conditions.push(eq(geoSiteNetwork.status, query.status));
    }

    if (query.keyword) {
      const keywordPattern = `%${query.keyword}%`;
      conditions.push(
        or(
          ilike(geoSiteNetwork.siteName, keywordPattern),
          ilike(geoSiteNetwork.domain, keywordPattern),
        ),
      );
    }

    if (query.siteType) {
      conditions.push(eq(geoSiteNetwork.siteType, query.siteType));
    }

    const whereClause = and(...conditions);

    const [itemsRaw, totalResult] = await Promise.all([
      this.db
        .select({
          id: geoSiteNetwork.id,
          brandId: geoSiteNetwork.brandId,
          brandName: geoBrands.name,
          siteName: geoSiteNetwork.siteName,
          domain: geoSiteNetwork.domain,
          status: geoSiteNetwork.status,
          cmsType: geoSiteNetwork.cmsType,
          notes: geoSiteNetwork.notes,
          siteType: geoSiteNetwork.siteType,
          creatorId: geoSiteNetwork.creatorId,
          createdAt: geoSiteNetwork.createdAt,
          updatedAt: geoSiteNetwork.updatedAt,
        })
        .from(geoSiteNetwork)
        .leftJoin(geoBrands, eq(geoSiteNetwork.brandId, geoBrands.id))
        .where(whereClause)
        .orderBy(desc(geoSiteNetwork.createdAt))
        .limit(pageSize)
        .offset((page - 1) * pageSize),
      this.db
        .select({ count: count() })
        .from(geoSiteNetwork)
        .where(whereClause),
    ]);

    const total = Number(totalResult[0]?.count ?? 0);

    const items: (SiteNetworkItem & { brandName: string | null })[] = itemsRaw.map((row) => ({
      id: row.id,
      brandId: row.brandId,
      brandName: row.brandName ?? null,
      siteName: row.siteName,
      domain: row.domain,
      status: (isSiteStatus(row.status) ? row.status : 'active') as any,
      cmsType: row.cmsType ?? null,
      notes: row.notes ?? null,
      siteType: (isSiteType(row.siteType) ? row.siteType : 'enterprise') as SiteType,
      creatorId: row.creatorId,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    }));

    return { items, total, page, pageSize };
  }

  async createSite(
    dto: CreateSiteDto,
    user: GeoUserCtx,
  ): Promise<SiteNetworkItem> {
    this.checkBrandAccess(user, dto.brandId);

    const inserted = await this.db
      .insert(geoSiteNetwork)
      .values({
        brandId: dto.brandId,
        siteName: dto.siteName,
        domain: dto.domain,
        status: dto.status ?? 'active',
        cmsType: dto.cmsType ?? null,
        notes: dto.notes ?? null,
        siteType: dto.siteType ?? 'enterprise',
        creatorId: user.id,
      })
      .returning();

    const row = inserted[0];
    return {
      id: row.id,
      brandId: row.brandId,
      siteName: row.siteName,
      domain: row.domain,
      status: (isSiteStatus(row.status) ? row.status : 'active') as any,
      cmsType: row.cmsType ?? null,
      notes: row.notes ?? null,
      siteType: (isSiteType(row.siteType) ? row.siteType : 'enterprise') as SiteType,
      creatorId: row.creatorId,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  async updateSite(
    id: string,
    dto: UpdateSiteDto,
    user: GeoUserCtx,
  ): Promise<SiteNetworkItem> {
    const existing = await this.db
      .select()
      .from(geoSiteNetwork)
      .where(eq(geoSiteNetwork.id, id))
      .limit(1);

    if (existing.length === 0) {
      throw new NotFoundException('站点不存在');
    }

    const row = existing[0];
    this.checkBrandAccess(user, row.brandId);

    const patch: Partial<typeof geoSiteNetwork.$inferInsert> = {};
    if (dto.siteName !== undefined) patch.siteName = dto.siteName;
    if (dto.domain !== undefined) patch.domain = dto.domain;
    if (dto.status !== undefined) patch.status = dto.status;
    if (dto.cmsType !== undefined) patch.cmsType = dto.cmsType;
    if (dto.notes !== undefined) patch.notes = dto.notes;
    if (dto.siteType !== undefined) patch.siteType = dto.siteType;

    if (Object.keys(patch).length === 0) {
      throw new BadRequestException('未提供可更新字段');
    }

    const updated = await this.db
      .update(geoSiteNetwork)
      .set(patch)
      .where(eq(geoSiteNetwork.id, id))
      .returning();

    const updatedRow = updated[0];
    return {
      id: updatedRow.id,
      brandId: updatedRow.brandId,
      siteName: updatedRow.siteName,
      domain: updatedRow.domain,
      status: (isSiteStatus(updatedRow.status)
        ? updatedRow.status
        : 'active') as any,
      cmsType: updatedRow.cmsType ?? null,
      notes: updatedRow.notes ?? null,
      siteType: (isSiteType(updatedRow.siteType)
        ? updatedRow.siteType
        : 'enterprise') as SiteType,
      creatorId: updatedRow.creatorId,
      createdAt: updatedRow.createdAt.toISOString(),
      updatedAt: updatedRow.updatedAt.toISOString(),
    };
  }

  async deleteSite(id: string, user: GeoUserCtx): Promise<void> {
    const existing = await this.db
      .select({ id: geoSiteNetwork.id, brandId: geoSiteNetwork.brandId })
      .from(geoSiteNetwork)
      .where(eq(geoSiteNetwork.id, id))
      .limit(1);

    if (existing.length === 0) {
      throw new NotFoundException('站点不存在');
    }

    this.checkBrandAccess(user, existing[0].brandId);

    const deleted = await this.db
      .delete(geoSiteNetwork)
      .where(eq(geoSiteNetwork.id, id))
      .returning({ id: geoSiteNetwork.id });

    if (deleted.length === 0) {
      throw new NotFoundException('站点不存在');
    }
  }
}
