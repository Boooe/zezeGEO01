import {
  Injectable,
  Inject,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { DRIZZLE_DATABASE, type PostgresJsDatabase } from '@lark-apaas/fullstack-nestjs-core';
import { eq, and, desc, asc, isNull, ilike, count, or } from 'drizzle-orm';

import {
  geoLeads,
  geoLeadFollowups,
  geoUsers,
  geoBrands,
} from '@server/database/schema';
import type { Lead, LeadFollowup, PagedResponse } from '@shared/api.interface';
import { LEAD_STAGES } from '@shared/api.interface';
import { CreateLeadDto } from './dto/create-lead.dto';
import { UpdateLeadDto } from './dto/update-lead.dto';
import { LeadsQueryDto } from './dto/leads-query.dto';
import { CreateFollowupDto } from './dto/create-followup.dto';
import { ConvertLeadDto } from './dto/convert-lead.dto';

interface GeoUserCtx {
  id: string;
  username: string;
  role: string;
  brandId: string | null;
}

@Injectable()
export class LeadsService {
  constructor(
    @Inject(DRIZZLE_DATABASE) private readonly db: PostgresJsDatabase,
  ) {}

  /**
   * 线索列表
   */
  async getLeads(
    query: LeadsQueryDto,
    geoUser: GeoUserCtx,
  ): Promise<PagedResponse<Lead>> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;

    const baseConditions = this.buildBaseConditions(query, geoUser);
    const conditions = [...baseConditions];
    if (!query.includeDemo) {
      conditions.push(eq(geoLeads.isDemo, false));
    }

    const baseSelect = this.db
      .select({
        id: geoLeads.id,
        merchantName: geoLeads.merchantName,
        industry: geoLeads.industry,
        region: geoLeads.region,
        phone: geoLeads.phone,
        source: geoLeads.source,
        intentLevel: geoLeads.intentLevel,
        stage: geoLeads.stage,
        ownerId: geoLeads.ownerId,
        ownerName: geoUsers.displayName,
        brandId: geoLeads.brandId,
        brandName: geoBrands.name,
        nextFollowupDate: geoLeads.nextFollowupDate,
        remark: geoLeads.remark,
        createdAt: geoLeads.createdAt,
        updatedAt: geoLeads.updatedAt,
      })
      .from(geoLeads)
      .leftJoin(geoUsers, eq(geoLeads.ownerId, geoUsers.id))
      .leftJoin(geoBrands, eq(geoLeads.brandId, geoBrands.id))
      .where(and(...conditions));

    const rows = await baseSelect
      .orderBy(
        asc(isNull(geoLeads.nextFollowupDate)),
        asc(geoLeads.nextFollowupDate),
        desc(geoLeads.createdAt),
      )
      .limit(pageSize)
      .offset((page - 1) * pageSize);

    const [{ total }] = await this.db
      .select({ total: count() })
      .from(geoLeads)
      .leftJoin(geoUsers, eq(geoLeads.ownerId, geoUsers.id))
      .leftJoin(geoBrands, eq(geoLeads.brandId, geoBrands.id))
      .where(and(...conditions));

    // 统计演示数据数量
    let demoCount = 0;
    if (!query.includeDemo) {
      const demoConditions = [...baseConditions, eq(geoLeads.isDemo, true)];
      const [{ count: dc }] = await this.db
        .select({ count: count() })
        .from(geoLeads)
        .leftJoin(geoUsers, eq(geoLeads.ownerId, geoUsers.id))
        .leftJoin(geoBrands, eq(geoLeads.brandId, geoBrands.id))
        .where(and(...demoConditions));
      demoCount = Number(dc);
    }

    const items: Lead[] = rows.map((row) => ({
      id: row.id,
      merchantName: row.merchantName,
      industry: row.industry,
      region: row.region,
      phone: row.phone,
      source: row.source,
      intentLevel: row.intentLevel as Lead['intentLevel'],
      stage: row.stage as Lead['stage'],
      ownerId: row.ownerId,
      ownerName: row.ownerName,
      brandId: row.brandId,
      brandName: row.brandName,
      nextFollowupDate: row.nextFollowupDate
        ? row.nextFollowupDate.toString()
        : null,
      remark: row.remark,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    }));

    return { items, total: Number(total), page, pageSize, demoCount };
  }

  /**
   * 线索详情
   */
  async getLeadDetail(id: string, geoUser: GeoUserCtx): Promise<{
    lead: Lead;
    followups: LeadFollowup[];
  }> {
    const leadRow = await this.getLeadById(id);
    if (!leadRow) {
      throw new NotFoundException('线索不存在');
    }

    // client 角色只能看自己品牌的数据
    if (geoUser.role === 'client' && geoUser.brandId) {
      if (leadRow.brandId !== geoUser.brandId) {
        throw new ForbiddenException('权限不足');
      }
    }

    const followupRows = await this.db
      .select({
        id: geoLeadFollowups.id,
        leadId: geoLeadFollowups.leadId,
        content: geoLeadFollowups.content,
        followupType: geoLeadFollowups.followupType,
        operatorId: geoLeadFollowups.operatorId,
        operatorName: geoUsers.displayName,
        nextFollowupDate: geoLeadFollowups.nextFollowupDate,
        createdAt: geoLeadFollowups.createdAt,
      })
      .from(geoLeadFollowups)
      .leftJoin(geoUsers, eq(geoLeadFollowups.operatorId, geoUsers.id))
      .where(eq(geoLeadFollowups.leadId, id))
      .orderBy(desc(geoLeadFollowups.createdAt));

    const followups: LeadFollowup[] = followupRows.map((row) => ({
      id: row.id,
      leadId: row.leadId,
      content: row.content,
      followupType: row.followupType ?? 'call',
      operatorId: row.operatorId,
      operatorName: row.operatorName,
      nextFollowupDate: row.nextFollowupDate
        ? row.nextFollowupDate.toString()
        : null,
      createdAt: row.createdAt.toISOString(),
    }));

    const lead = await this.mapToLead(leadRow);
    return { lead, followups };
  }

  /**
   * 新增线索
   */
  async createLead(
    dto: CreateLeadDto,
    geoUser: GeoUserCtx,
  ): Promise<{ id: string }> {
    const values: typeof geoLeads.$inferInsert = {
      merchantName: dto.merchantName,
      industry: dto.industry,
      region: dto.region,
      phone: dto.phone,
      source: dto.source,
      intentLevel: dto.intentLevel,
      stage: dto.stage ?? 'pending',
      ownerId: dto.ownerId,
      brandId: dto.brandId,
      nextFollowupDate: dto.nextFollowupDate ?? null,
      remark: dto.remark,
    };

    const [inserted] = await this.db
      .insert(geoLeads)
      .values(values)
      .returning({ id: geoLeads.id });

    return { id: inserted.id };
  }

  /**
   * 编辑线索
   */
  async updateLead(
    id: string,
    dto: UpdateLeadDto,
    geoUser: GeoUserCtx,
  ): Promise<void> {
    const existing = await this.getLeadById(id);
    if (!existing) {
      throw new NotFoundException('线索不存在');
    }

    const patch: Partial<typeof geoLeads.$inferInsert> = {};
    if (dto.merchantName !== undefined) patch.merchantName = dto.merchantName;
    if (dto.industry !== undefined) patch.industry = dto.industry;
    if (dto.region !== undefined) patch.region = dto.region;
    if (dto.phone !== undefined) patch.phone = dto.phone;
    if (dto.source !== undefined) patch.source = dto.source;
    if (dto.intentLevel !== undefined) patch.intentLevel = dto.intentLevel;
    if (dto.stage !== undefined) patch.stage = dto.stage;
    if (dto.ownerId !== undefined) patch.ownerId = dto.ownerId;
    if (dto.brandId !== undefined) patch.brandId = dto.brandId;
    if (dto.nextFollowupDate !== undefined) {
      patch.nextFollowupDate = dto.nextFollowupDate;
    }
    if (dto.remark !== undefined) patch.remark = dto.remark;

    if (Object.keys(patch).length === 0) {
      throw new BadRequestException('未提供可更新字段');
    }

    const updated = await this.db
      .update(geoLeads)
      .set(patch)
      .where(eq(geoLeads.id, id))
      .returning({ id: geoLeads.id });

    if (updated.length === 0) {
      throw new NotFoundException('线索不存在');
    }
  }

  /**
   * 删除线索
   */
  async deleteLead(id: string, geoUser: GeoUserCtx): Promise<void> {
    const existing = await this.getLeadById(id);
    if (!existing) {
      throw new NotFoundException('线索不存在');
    }

    const deleted = await this.db
      .delete(geoLeads)
      .where(eq(geoLeads.id, id))
      .returning({ id: geoLeads.id });

    if (deleted.length === 0) {
      throw new NotFoundException('线索不存在');
    }
  }

  /**
   * 新增跟进记录
   */
  async addFollowup(
    leadId: string,
    dto: CreateFollowupDto,
    geoUser: GeoUserCtx,
  ): Promise<{ id: string }> {
    const existing = await this.getLeadById(leadId);
    if (!existing) {
      throw new NotFoundException('线索不存在');
    }

    // client 角色只能跟进自己品牌的线索
    if (geoUser.role === 'client' && geoUser.brandId) {
      if (existing.brandId !== geoUser.brandId) {
        throw new ForbiddenException('权限不足');
      }
    }

    const result = await this.db.transaction(async (tx) => {
      // 插入跟进记录
      const [inserted] = await tx
        .insert(geoLeadFollowups)
        .values({
          leadId,
          content: dto.content,
          followupType: dto.followupType ?? 'call',
          operatorId: geoUser.id,
          nextFollowupDate: dto.nextFollowupDate ?? null,
        })
        .returning({ id: geoLeadFollowups.id });

      // 更新线索的 next_followup_date
      const leadPatch: Partial<typeof geoLeads.$inferInsert> = {};
      if (dto.nextFollowupDate !== undefined) {
        leadPatch.nextFollowupDate = dto.nextFollowupDate;
      }

      // 首次跟进时 stage 从 pending 推进到 contacted
      if (existing.stage === 'pending') {
        leadPatch.stage = 'contacted';
      }

      if (Object.keys(leadPatch).length > 0) {
        await tx
          .update(geoLeads)
          .set(leadPatch)
          .where(eq(geoLeads.id, leadId));
      }

      return { id: inserted.id };
    });

    return result;
  }

  /**
   * 线索转客户
   */
  async convertLead(
    id: string,
    dto: ConvertLeadDto,
    geoUser: GeoUserCtx,
  ): Promise<{ brandId: string }> {
    const existing = await this.getLeadById(id);
    if (!existing) {
      throw new NotFoundException('线索不存在');
    }

    // 如果已有 brandId，直接更新 stage 为 signed
    if (existing.brandId) {
      const updated = await this.db
        .update(geoLeads)
        .set({ stage: 'signed' })
        .where(eq(geoLeads.id, id))
        .returning({ id: geoLeads.id });

      if (updated.length === 0) {
        throw new NotFoundException('线索不存在');
      }

      return { brandId: existing.brandId };
    }

    // 没有 brandId，创建新品牌并关联
    const result = await this.db.transaction(async (tx) => {
      const [newBrand] = await tx
        .insert(geoBrands)
        .values({
          name: existing.merchantName,
          industry: dto.industry ?? existing.industry,
          contactPerson: dto.contactPerson,
          contactPhone: dto.contactPhone ?? existing.phone,
          city: existing.region,
        })
        .returning({ id: geoBrands.id });

      await tx
        .update(geoLeads)
        .set({ brandId: newBrand.id, stage: 'signed' })
        .where(eq(geoLeads.id, id));

      return { brandId: newBrand.id };
    });

    return result;
  }

  /**
   * 统计 - 各阶段线索数量
   */
  async getStats(
    geoUser: GeoUserCtx,
    includeDemo = false,
  ): Promise<Array<{ stage: string; count: number; demoCount: number }>> {
    const baseConditions = [];
    if (geoUser.role === 'client' && geoUser.brandId) {
      baseConditions.push(eq(geoLeads.brandId, geoUser.brandId));
    }

    const realConditions = [...baseConditions, eq(geoLeads.isDemo, false)];
    const demoConditions = [...baseConditions, eq(geoLeads.isDemo, true)];

    const realRows = await this.db
      .select({
        stage: geoLeads.stage,
        count: count(),
      })
      .from(geoLeads)
      .where(and(...realConditions))
      .groupBy(geoLeads.stage);

    const demoRows = includeDemo
      ? await this.db
          .select({
            stage: geoLeads.stage,
            count: count(),
          })
          .from(geoLeads)
          .where(and(...demoConditions))
          .groupBy(geoLeads.stage)
      : [];

    const stageMap = new Map<string, { count: number; demoCount: number }>();
    for (const r of realRows) {
      stageMap.set(r.stage, { count: Number(r.count), demoCount: 0 });
    }
    for (const r of demoRows) {
      const existing = stageMap.get(r.stage);
      if (existing) {
        existing.count += Number(r.count);
        existing.demoCount = Number(r.count);
      } else {
        stageMap.set(r.stage, {
          count: Number(r.count),
          demoCount: Number(r.count),
        });
      }
    }

    // 确保所有阶段都有返回值（即使为0）
    const result = LEAD_STAGES.map((stage) => {
      const val = stageMap.get(stage);
      return {
        stage,
        count: val ? val.count : 0,
        demoCount: val ? val.demoCount : 0,
      };
    });

    return result;
  }

  // ---- 私有方法 ----

  private buildBaseConditions(
    query: LeadsQueryDto,
    geoUser: GeoUserCtx,
  ) {
    const conditions = [];

    // client 角色只能看自己品牌的数据
    if (geoUser.role === 'client' && geoUser.brandId) {
      conditions.push(eq(geoLeads.brandId, geoUser.brandId));
    }

    if (query.stage) {
      conditions.push(eq(geoLeads.stage, query.stage));
    }

    if (query.intentLevel) {
      conditions.push(eq(geoLeads.intentLevel, query.intentLevel));
    }

    if (query.ownerId) {
      conditions.push(eq(geoLeads.ownerId, query.ownerId));
    }

    if (query.keyword) {
      const searchTerm = `%${query.keyword}%`;
      conditions.push(
        or(
          ilike(geoLeads.merchantName, searchTerm),
          ilike(geoLeads.phone, searchTerm),
        ),
      );
    }

    return conditions;
  }

  private async getLeadById(id: string) {
    const rows = await this.db
      .select()
      .from(geoLeads)
      .where(eq(geoLeads.id, id))
      .limit(1);

    return rows[0] ?? null;
  }

  private async mapToLead(row: typeof geoLeads.$inferSelect): Promise<Lead> {
    const [ownerRow] = row.ownerId
      ? await this.db
          .select({ displayName: geoUsers.displayName })
          .from(geoUsers)
          .where(eq(geoUsers.id, row.ownerId))
          .limit(1)
      : [null];

    const [brandRow] = row.brandId
      ? await this.db
          .select({ name: geoBrands.name })
          .from(geoBrands)
          .where(eq(geoBrands.id, row.brandId))
          .limit(1)
      : [null];

    return {
      id: row.id,
      merchantName: row.merchantName,
      industry: row.industry,
      region: row.region,
      phone: row.phone,
      source: row.source,
      intentLevel: row.intentLevel as Lead['intentLevel'],
      stage: row.stage as Lead['stage'],
      ownerId: row.ownerId,
      ownerName: ownerRow?.displayName ?? null,
      brandId: row.brandId,
      brandName: brandRow?.name ?? null,
      nextFollowupDate: row.nextFollowupDate
        ? row.nextFollowupDate.toString()
        : null,
      remark: row.remark,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}
