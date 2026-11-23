import {
  Injectable,
  Inject,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { DRIZZLE_DATABASE, type PostgresJsDatabase } from '@lark-apaas/fullstack-nestjs-core';
import {
  eq,
  and,
  desc,
  asc,
  ilike,
  count,
  gte,
  lt,
  lte,
  sql,
  avg,
  sum,
} from 'drizzle-orm';
import dayjs from 'dayjs';

import {
  geoMediaSuppliers,
  geoSubmissionChannels,
  geoMediaOrders,
} from '@server/database/schema';
import type {
  MediaSupplier,
  MediaSupplierListItem,
  MediaSupplierListResponse,
  ChannelPricingAdmin,
  ChannelPricingListResponse,
  MarketChannel,
  MarketChannelListResponse,
  MediaMarketStats,
  PriceImportResult,
  SupplierSettlementStat,
} from '@shared/api.interface';
import { SUPPLIER_STATUS, SOURCE_TYPES } from '@shared/api.interface';
import { SupplierQueryDto, CreateSupplierDto, UpdateSupplierDto } from './dto/supplier.dto';
import {
  ChannelPricingQueryDto,
  UpdateChannelPricingDto,
  MarketChannelQueryDto,
} from './dto/channel-pricing.dto';
import { ImportPriceDto } from './dto/import.dto';

function calcSalePrice(costCents: number, markupRate: number): number {
  return Math.round(costCents * (1 + markupRate));
}

@Injectable()
export class MediaMarketService {
  constructor(
    @Inject(DRIZZLE_DATABASE) private readonly db: PostgresJsDatabase,
  ) {}

  /* ==================== 供应商 CRUD ==================== */

  async getSuppliers(query: SupplierQueryDto): Promise<MediaSupplierListResponse> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const offset = (page - 1) * pageSize;

    const conditions = [];
    if (query.keyword) {
      conditions.push(ilike(geoMediaSuppliers.name, `%${query.keyword}%`));
    }
    if (query.status) {
      conditions.push(eq(geoMediaSuppliers.status, query.status));
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const [totalResult, items] = await Promise.all([
      this.db
        .select({ count: count() })
        .from(geoMediaSuppliers)
        .where(where),
      this.db
        .select({
          id: geoMediaSuppliers.id,
          name: geoMediaSuppliers.name,
          contact: geoMediaSuppliers.contact,
          contactPhone: geoMediaSuppliers.contactPhone,
          settlementCycle: geoMediaSuppliers.settlementCycle,
          apiBase: geoMediaSuppliers.apiBase,
          status: geoMediaSuppliers.status,
          markupRate: geoMediaSuppliers.markupRate,
          note: geoMediaSuppliers.note,
          createdAt: geoMediaSuppliers.createdAt,
          channelCount: this.db.$count(
            geoSubmissionChannels,
            eq(geoSubmissionChannels.supplierId, geoMediaSuppliers.id),
          ),
          sellableCount: this.db.$count(
            geoSubmissionChannels,
            and(
              eq(geoSubmissionChannels.supplierId, geoMediaSuppliers.id),
              eq(geoSubmissionChannels.sellable, true),
            ),
          ),
        })
        .from(geoMediaSuppliers)
        .where(where)
        .orderBy(desc(geoMediaSuppliers.createdAt))
        .limit(pageSize)
        .offset(offset),
    ]);

    const total = totalResult[0]?.count ?? 0;

    return {
      items: items.map((item) => ({
        ...item,
        markupRate: Number(item.markupRate),
        createdAt: item.createdAt.toISOString(),
      })) as MediaSupplierListItem[],
      total,
    };
  }

  async getSupplier(id: string): Promise<MediaSupplier> {
    const result = await this.db
      .select()
      .from(geoMediaSuppliers)
      .where(eq(geoMediaSuppliers.id, id))
      .limit(1);

    if (result.length === 0) {
      throw new NotFoundException('供应商不存在');
    }

    const row = result[0];
    return {
      id: row.id,
      name: row.name,
      contact: row.contact ?? undefined,
      contactPhone: row.contactPhone ?? undefined,
      settlementCycle: row.settlementCycle ?? undefined,
      apiBase: row.apiBase ?? undefined,
      status: (SUPPLIER_STATUS as readonly string[]).includes(row.status ?? '')
        ? (row.status as 'active' | 'inactive')
        : 'active',
      markupRate: Number(row.markupRate),
      note: row.note ?? undefined,
      createdAt: row.createdAt.toISOString(),
    };
  }

  async createSupplier(dto: CreateSupplierDto): Promise<MediaSupplier> {
    const result = await this.db
      .insert(geoMediaSuppliers)
      .values({
        name: dto.name,
        contact: dto.contact,
        contactPhone: dto.contactPhone,
        settlementCycle: dto.settlementCycle,
        apiBase: dto.apiBase,
        apiKey: dto.apiKey,
        status: dto.status ?? 'active',
        markupRate: dto.markupRate !== undefined ? String(dto.markupRate) : undefined,
        note: dto.note,
      })
      .returning({ id: geoMediaSuppliers.id });

    return this.getSupplier(result[0].id);
  }

  async updateSupplier(id: string, dto: UpdateSupplierDto): Promise<MediaSupplier> {
    const patch: Record<string, unknown> = {};
    if (dto.name !== undefined) patch.name = dto.name;
    if (dto.contact !== undefined) patch.contact = dto.contact;
    if (dto.contactPhone !== undefined) patch.contactPhone = dto.contactPhone;
    if (dto.settlementCycle !== undefined) patch.settlementCycle = dto.settlementCycle;
    if (dto.apiBase !== undefined) patch.apiBase = dto.apiBase;
    if (dto.apiKey !== undefined) patch.apiKey = dto.apiKey;
    if (dto.status !== undefined) patch.status = dto.status;
    if (dto.markupRate !== undefined) patch.markupRate = String(dto.markupRate);
    if (dto.note !== undefined) patch.note = dto.note;

    if (Object.keys(patch).length === 0) {
      throw new BadRequestException('未提供可更新字段');
    }

    const updated = await this.db
      .update(geoMediaSuppliers)
      .set(patch)
      .where(eq(geoMediaSuppliers.id, id))
      .returning({ id: geoMediaSuppliers.id });

    if (updated.length === 0) {
      throw new NotFoundException('供应商不存在');
    }

    if (dto.markupRate !== undefined) {
      await this.recalculatePrices(id);
    }

    return this.getSupplier(updated[0].id);
  }

  async deleteSupplier(id: string): Promise<void> {
    const channelCount = await this.db.$count(
      geoSubmissionChannels,
      eq(geoSubmissionChannels.supplierId, id),
    );

    if (channelCount > 0) {
      throw new ConflictException('该供应商下有关联渠道，无法删除');
    }

    const deleted = await this.db
      .delete(geoMediaSuppliers)
      .where(eq(geoMediaSuppliers.id, id))
      .returning({ id: geoMediaSuppliers.id });

    if (deleted.length === 0) {
      throw new NotFoundException('供应商不存在');
    }
  }

  async recalculatePrices(supplierId: string): Promise<{ updated: number }> {
    // 检查供应商是否存在并获取 markupRate
    const supplierResult = await this.db
      .select({
        id: geoMediaSuppliers.id,
        markupRate: geoMediaSuppliers.markupRate,
      })
      .from(geoMediaSuppliers)
      .where(eq(geoMediaSuppliers.id, supplierId))
      .limit(1);

    if (supplierResult.length === 0) {
      throw new NotFoundException('供应商不存在');
    }

    const markupRate = Number(supplierResult[0].markupRate) || 0;
    const now = new Date();

    // 只重算 salePriceOverridden = false 的渠道
    const channels = await this.db
      .select({
        id: geoSubmissionChannels.id,
        costPriceCents: geoSubmissionChannels.costPriceCents,
      })
      .from(geoSubmissionChannels)
      .where(
        and(
          eq(geoSubmissionChannels.supplierId, supplierId),
          eq(geoSubmissionChannels.salePriceOverridden, false),
        ),
      );

    let updatedCount = 0;
    for (const ch of channels) {
      const cost = ch.costPriceCents ?? 0;
      const salePrice = calcSalePrice(cost, markupRate);
      await this.db
        .update(geoSubmissionChannels)
        .set({
          salePriceCents: salePrice,
          priceUpdatedAt: now,
        })
        .where(eq(geoSubmissionChannels.id, ch.id));
      updatedCount += 1;
    }

    return { updated: updatedCount };
  }

  /* ==================== 渠道价格管理 ==================== */

  async getChannelPricingList(
    query: ChannelPricingQueryDto,
  ): Promise<ChannelPricingListResponse> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const offset = (page - 1) * pageSize;

    const conditions = [];
    if (query.keyword) {
      conditions.push(ilike(geoSubmissionChannels.name, `%${query.keyword}%`));
    }
    if (query.supplierId) {
      conditions.push(eq(geoSubmissionChannels.supplierId, query.supplierId));
    }
    if (query.sellable !== undefined) {
      conditions.push(eq(geoSubmissionChannels.sellable, query.sellable));
    }
    if (query.libraryType) {
      conditions.push(eq(geoSubmissionChannels.libraryType, query.libraryType));
    }
    if (query.region && query.region !== '全国') {
      conditions.push(eq(geoSubmissionChannels.region, query.region));
    }
    if (query.priceMin !== undefined) {
      conditions.push(gte(geoSubmissionChannels.salePriceCents, query.priceMin));
    }
    if (query.priceMax !== undefined) {
      conditions.push(lt(geoSubmissionChannels.salePriceCents, query.priceMax + 1));
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const [totalResult, items] = await Promise.all([
      this.db
        .select({ count: count() })
        .from(geoSubmissionChannels)
        .where(where),
      this.db
        .select({
          id: geoSubmissionChannels.id,
          name: geoSubmissionChannels.name,
          libraryType: geoSubmissionChannels.libraryType,
          channelType: geoSubmissionChannels.channelType,
          region: geoSubmissionChannels.region,
          tier: geoSubmissionChannels.tier,
          supplierId: geoSubmissionChannels.supplierId,
          supplierName: geoMediaSuppliers.name,
          costPriceCents: geoSubmissionChannels.costPriceCents,
          salePriceCents: geoSubmissionChannels.salePriceCents,
          priceUnit: geoSubmissionChannels.priceUnit,
          markupRate: geoMediaSuppliers.markupRate,
          stock: geoSubmissionChannels.stock,
          turnaroundHours: geoSubmissionChannels.turnaroundHours,
          priceUpdatedAt: geoSubmissionChannels.priceUpdatedAt,
          sellable: geoSubmissionChannels.sellable,
          salePriceOverridden: geoSubmissionChannels.salePriceOverridden,
        })
        .from(geoSubmissionChannels)
        .leftJoin(
          geoMediaSuppliers,
          eq(geoSubmissionChannels.supplierId, geoMediaSuppliers.id),
        )
        .where(where)
        .orderBy(desc(geoSubmissionChannels.updatedAt))
        .limit(pageSize)
        .offset(offset),
    ]);

    const total = totalResult[0]?.count ?? 0;

    return {
      items: items.map((item) => ({
        id: item.id,
        name: item.name,
        libraryType: item.libraryType ?? undefined,
        channelType: item.channelType ?? undefined,
        region: item.region ?? undefined,
        tier: item.tier ?? undefined,
        supplierId: item.supplierId ?? undefined,
        supplierName: item.supplierName ?? undefined,
        costPriceCents: item.costPriceCents ?? 0,
        salePriceCents: item.salePriceCents ?? 0,
        priceUnit: item.priceUnit ?? 'article',
        markupRate: Number(item.markupRate) || 0,
        stock: item.stock ?? null,
        turnaroundHours: item.turnaroundHours ?? null,
        priceUpdatedAt: item.priceUpdatedAt ? item.priceUpdatedAt.toISOString() : undefined,
        sellable: item.sellable ?? false,
        salePriceOverridden: item.salePriceOverridden ?? false,
      })) as ChannelPricingAdmin[],
      total,
      page,
      pageSize,
    };
  }

  async getChannelPricing(id: string): Promise<ChannelPricingAdmin> {
    const result = await this.db
      .select({
        id: geoSubmissionChannels.id,
        name: geoSubmissionChannels.name,
        libraryType: geoSubmissionChannels.libraryType,
        channelType: geoSubmissionChannels.channelType,
        region: geoSubmissionChannels.region,
        tier: geoSubmissionChannels.tier,
        supplierId: geoSubmissionChannels.supplierId,
        supplierName: geoMediaSuppliers.name,
        costPriceCents: geoSubmissionChannels.costPriceCents,
        salePriceCents: geoSubmissionChannels.salePriceCents,
        priceUnit: geoSubmissionChannels.priceUnit,
        markupRate: geoMediaSuppliers.markupRate,
        stock: geoSubmissionChannels.stock,
        turnaroundHours: geoSubmissionChannels.turnaroundHours,
        priceUpdatedAt: geoSubmissionChannels.priceUpdatedAt,
        sellable: geoSubmissionChannels.sellable,
        salePriceOverridden: geoSubmissionChannels.salePriceOverridden,
      })
      .from(geoSubmissionChannels)
      .leftJoin(
        geoMediaSuppliers,
        eq(geoSubmissionChannels.supplierId, geoMediaSuppliers.id),
      )
      .where(eq(geoSubmissionChannels.id, id))
      .limit(1);

    if (result.length === 0) {
      throw new NotFoundException('渠道不存在');
    }

    const item = result[0];
    return {
      id: item.id,
      name: item.name,
      libraryType: item.libraryType ?? undefined,
      channelType: item.channelType ?? undefined,
      region: item.region ?? undefined,
      tier: item.tier ?? undefined,
      supplierId: item.supplierId ?? undefined,
      supplierName: item.supplierName ?? undefined,
      costPriceCents: item.costPriceCents ?? 0,
      salePriceCents: item.salePriceCents ?? 0,
      priceUnit: item.priceUnit ?? 'article',
      markupRate: Number(item.markupRate) || 0,
      stock: item.stock ?? null,
      turnaroundHours: item.turnaroundHours ?? null,
      priceUpdatedAt: item.priceUpdatedAt ? item.priceUpdatedAt.toISOString() : undefined,
      sellable: item.sellable ?? false,
      salePriceOverridden: item.salePriceOverridden ?? false,
    };
  }

  async updateChannelPricing(
    id: string,
    dto: UpdateChannelPricingDto,
  ): Promise<ChannelPricingAdmin> {
    // 先获取当前渠道信息
    const currentResult = await this.db
      .select({
        id: geoSubmissionChannels.id,
        costPriceCents: geoSubmissionChannels.costPriceCents,
        salePriceCents: geoSubmissionChannels.salePriceCents,
        sellable: geoSubmissionChannels.sellable,
        salePriceOverridden: geoSubmissionChannels.salePriceOverridden,
        supplierId: geoSubmissionChannels.supplierId,
      })
      .from(geoSubmissionChannels)
      .where(eq(geoSubmissionChannels.id, id))
      .limit(1);

    if (currentResult.length === 0) {
      throw new NotFoundException('渠道不存在');
    }

    const current = currentResult[0];
    const patch: Record<string, unknown> = {};
    const now = new Date();

    // supplierId 更新
    if (dto.supplierId !== undefined) {
      patch.supplierId = dto.supplierId;
    }

    // priceUnit 更新
    if (dto.priceUnit !== undefined) {
      patch.priceUnit = dto.priceUnit;
    }

    // stock 更新
    if (dto.stock !== undefined) {
      patch.stock = dto.stock;
    }

    // turnaroundHours 更新
    if (dto.turnaroundHours !== undefined) {
      patch.turnaroundHours = dto.turnaroundHours;
    }

    // 价格逻辑
    const effectiveSupplierId = dto.supplierId ?? current.supplierId;
    let salePriceOverridden = current.salePriceOverridden ?? false;

    if (dto.salePriceCents !== undefined) {
      // 显式传了售价 → 标记为 override
      patch.salePriceCents = dto.salePriceCents;
      salePriceOverridden = true;
      if (dto.costPriceCents !== undefined) {
        patch.costPriceCents = dto.costPriceCents;
      }
    } else if (dto.costPriceCents !== undefined) {
      // 只传了采购价
      patch.costPriceCents = dto.costPriceCents;

      // 如果当前未 override，且能找到供应商 markupRate，自动算售价
      if (!salePriceOverridden && effectiveSupplierId) {
        const supplierRow = await this.db
          .select({ markupRate: geoMediaSuppliers.markupRate })
          .from(geoMediaSuppliers)
          .where(eq(geoMediaSuppliers.id, effectiveSupplierId))
          .limit(1);

        if (supplierRow.length > 0 && supplierRow[0].markupRate !== null) {
          const rate = Number(supplierRow[0].markupRate) || 0;
          patch.salePriceCents = calcSalePrice(dto.costPriceCents, rate);
        }
      }
    }

    patch.salePriceOverridden = salePriceOverridden;

    // sellable 更新 + 校验
    const targetSellable = dto.sellable !== undefined ? dto.sellable : current.sellable;
    if (dto.sellable !== undefined) {
      patch.sellable = dto.sellable;
    }

    if (targetSellable) {
      const effectiveSalePrice =
        (patch.salePriceCents as number) ?? current.salePriceCents ?? 0;
      if (effectiveSalePrice <= 0) {
        throw new BadRequestException('上架时售价必须大于 0');
      }
    }

    patch.priceUpdatedAt = now;

    await this.db
      .update(geoSubmissionChannels)
      .set(patch)
      .where(eq(geoSubmissionChannels.id, id));

    return this.getChannelPricing(id);
  }

  async toggleSellable(id: string, sellable: boolean): Promise<{ sellable: boolean }> {
    const current = await this.db
      .select({
        id: geoSubmissionChannels.id,
        salePriceCents: geoSubmissionChannels.salePriceCents,
        sellable: geoSubmissionChannels.sellable,
      })
      .from(geoSubmissionChannels)
      .where(eq(geoSubmissionChannels.id, id))
      .limit(1);

    if (current.length === 0) {
      throw new NotFoundException('渠道不存在');
    }

    if (sellable && (current[0].salePriceCents ?? 0) <= 0) {
      throw new BadRequestException('上架时售价必须大于 0');
    }

    const updated = await this.db
      .update(geoSubmissionChannels)
      .set({ sellable })
      .where(eq(geoSubmissionChannels.id, id))
      .returning({ sellable: geoSubmissionChannels.sellable });

    if (updated.length === 0) {
      throw new NotFoundException('渠道不存在');
    }

    return { sellable: updated[0].sellable ?? false };
  }

  /* ==================== 批量导入报价 ==================== */

  async importPrices(dto: ImportPriceDto): Promise<PriceImportResult> {
    let rows: Array<{
      name: string;
      libraryType?: string;
      supplier?: string;
      costPrice?: string;
      salePrice?: string;
      turnaroundHours?: string;
      stock?: string;
      industry?: string;
      followers?: string;
    }> = [];

    if (dto.rows && dto.rows.length > 0) {
      rows = dto.rows;
    } else if (dto.csvText) {
      rows = this.parseCsv(dto.csvText);
    }

    const result: PriceImportResult = {
      parsed: rows.length,
      success: 0,
      updated: 0,
      created: 0,
      unmatched: 0,
      failed: 0,
      skipped: 0,
      unmatchedItems: [],
      failedItems: [],
    };

    // 预加载所有供应商 name → id + markupRate
    const allSuppliers = await this.db
      .select({
        id: geoMediaSuppliers.id,
        name: geoMediaSuppliers.name,
        markupRate: geoMediaSuppliers.markupRate,
      })
      .from(geoMediaSuppliers);

    const supplierMap = new Map<string, { id: string; markupRate: number }>();
    for (const s of allSuppliers) {
      supplierMap.set(s.name.trim(), {
        id: s.id,
        markupRate: Number(s.markupRate) || 0,
      });
    }

    // 预加载所有渠道 (name + libraryType) → id + current info
    const allChannels = await this.db
      .select({
        id: geoSubmissionChannels.id,
        name: geoSubmissionChannels.name,
        libraryType: geoSubmissionChannels.libraryType,
        costPriceCents: geoSubmissionChannels.costPriceCents,
        salePriceCents: geoSubmissionChannels.salePriceCents,
        stock: geoSubmissionChannels.stock,
        turnaroundHours: geoSubmissionChannels.turnaroundHours,
        supplierId: geoSubmissionChannels.supplierId,
        salePriceOverridden: geoSubmissionChannels.salePriceOverridden,
        sellable: geoSubmissionChannels.sellable,
      })
      .from(geoSubmissionChannels);

    const channelMap = new Map<
      string,
      (typeof allChannels)[number]
    >();
    for (const ch of allChannels) {
      const key = `${ch.name.trim()}__${(ch.libraryType ?? '').trim()}`;
      channelMap.set(key, ch);
    }

    const now = new Date();

    for (let i = 0; i < rows.length; i += 1) {
      const row = rows[i];
      const rowNum = i + 1;
      const name = row.name?.trim() ?? '';
      const libraryType = row.libraryType?.trim() ?? '';

      if (!name) {
        result.failed += 1;
        result.failedItems.push({
          name: name || '(空)',
          row: rowNum,
          reason: '渠道名称为空',
        });
        continue;
      }

      const channelKey = `${name}__${libraryType}`;
      const channel = channelMap.get(channelKey);

      if (!channel) {
        if (dto.allowCreate) {
          // 供应商渠道新建模式：按 name + supplier 判重
          const supplierName = row.supplier?.trim() ?? '';
          if (!supplierName) {
            result.failed += 1;
            result.failedItems.push({
              name,
              row: rowNum,
              reason: '允许新建渠道时必须指定供应商',
            });
            continue;
          }
          const supplierInfo = supplierMap.get(supplierName);
          if (!supplierInfo) {
            result.failed += 1;
            result.failedItems.push({
              name,
              row: rowNum,
              reason: `供应商 "${supplierName}" 不存在`,
            });
            continue;
          }

          // 按 name + supplierId 判重
          const existingByNameSupplier = allChannels.find(
            (c) => c.name.trim() === name && c.supplierId === supplierInfo.id,
          );

          if (existingByNameSupplier) {
            // 已存在同供应商同名渠道 → 更新价格（走更新逻辑）
            channelMap.set(
              `${name}__${libraryType}`,
              existingByNameSupplier,
            );
            // 继续往下走更新分支
          } else {
            // 新建渠道
            const costStr = row.costPrice?.trim() ?? '';
            const saleStr = row.salePrice?.trim() ?? '';
            const stockStr = row.stock?.trim() ?? '';
            const turnaroundStr = row.turnaroundHours?.trim() ?? '';
            const industry = row.industry?.trim() ?? '';
            const followersStr = row.followers?.trim() ?? '';

            let costCents = 0;
            if (costStr !== '') {
              costCents = parseInt(costStr, 10);
              if (Number.isNaN(costCents) || costCents < 0) {
                result.failed += 1;
                result.failedItems.push({
                  name,
                  row: rowNum,
                  reason: `采购价无效: ${costStr}`,
                });
                continue;
              }
            }

            let saleCents = 0;
            if (saleStr !== '') {
              saleCents = parseInt(saleStr, 10);
              if (Number.isNaN(saleCents) || saleCents < 0) {
                result.failed += 1;
                result.failedItems.push({
                  name,
                  row: rowNum,
                  reason: `售价无效: ${saleStr}`,
                });
                continue;
              }
            } else if (costCents > 0) {
              saleCents = calcSalePrice(costCents, supplierInfo.markupRate);
            }

            let stockVal: number | null = null;
            if (stockStr !== '') {
              stockVal = parseInt(stockStr, 10);
              if (Number.isNaN(stockVal) || stockVal < 0) {
                result.failed += 1;
                result.failedItems.push({
                  name,
                  row: rowNum,
                  reason: `库存无效: ${stockStr}`,
                });
                continue;
              }
            }

            let turnaroundVal: number | null = null;
            if (turnaroundStr !== '') {
              turnaroundVal = parseInt(turnaroundStr, 10);
              if (Number.isNaN(turnaroundVal) || turnaroundVal < 0) {
                result.failed += 1;
                result.failedItems.push({
                  name,
                  row: rowNum,
                  reason: `时效无效: ${turnaroundStr}`,
                });
                continue;
              }
            }

            let followersVal: number | null = null;
            if (followersStr !== '') {
              followersVal = parseInt(followersStr, 10);
              if (Number.isNaN(followersVal) || followersVal < 0) {
                result.failed += 1;
                result.failedItems.push({
                  name,
                  row: rowNum,
                  reason: `粉丝数无效: ${followersStr}`,
                });
                continue;
              }
            }

            const descriptionParts: string[] = [`供应商：${supplierName}`];
            if (industry) descriptionParts.push(`行业：${industry}`);
            if (followersVal !== null) {
              descriptionParts.push(`粉丝：${followersVal}`);
            }
            descriptionParts.push('报价抓取日 2026-11-19');
            const description = descriptionParts.join('；');

            const industriesArr = industry
              ? industry.split(/[、,，\/]/).map((s) => s.trim()).filter(Boolean)
              : [];

            await this.db.insert(geoSubmissionChannels).values({
              name,
              channelType: 'public_submission',
              libraryType: 'public',
              region: '全国',
              mediaType: 'image_text',
              supplierId: supplierInfo.id,
              costPriceCents: costCents,
              salePriceCents: saleCents,
              stock: stockVal,
              turnaroundHours: turnaroundVal,
              industries: industriesArr,
              followers: followersVal,
              description,
              priceUpdatedAt: now,
              sellable: saleCents > 0,
              salePriceOverridden: saleStr !== '',
            });

            result.created += 1;
            result.success += 1;
            continue;
          }
        } else {
          result.unmatched += 1;
          result.unmatchedItems.push({
            name,
            libraryType: libraryType || undefined,
            supplier: row.supplier?.trim() || undefined,
            row: rowNum,
          });
          continue;
        }
      }

      // 供应商匹配
      const supplierName = row.supplier?.trim() ?? '';
      let supplierInfo: { id: string; markupRate: number } | null = null;
      if (supplierName) {
        supplierInfo = supplierMap.get(supplierName) ?? null;
        if (!supplierInfo) {
          result.failed += 1;
          result.failedItems.push({
            name,
            row: rowNum,
            reason: `供应商 "${supplierName}" 不存在`,
          });
          continue;
        }
      }

      const patch: Record<string, unknown> = {};

      // 采购价
      const costStr = row.costPrice?.trim() ?? '';
      let newCost: number | null = null;
      if (costStr !== '') {
        const costNum = parseInt(costStr, 10);
        if (Number.isNaN(costNum) || costNum < 0) {
          result.failed += 1;
          result.failedItems.push({
            name,
            row: rowNum,
            reason: `采购价无效: ${costStr}`,
          });
          continue;
        }
        newCost = costNum;
        patch.costPriceCents = costNum;
      }

      // 售价
      const saleStr = row.salePrice?.trim() ?? '';
      let newSale: number | null = null;
      let salePriceOverridden = channel.salePriceOverridden ?? false;

      if (saleStr !== '') {
        const saleNum = parseInt(saleStr, 10);
        if (Number.isNaN(saleNum) || saleNum < 0) {
          result.failed += 1;
          result.failedItems.push({
            name,
            row: rowNum,
            reason: `售价无效: ${saleStr}`,
          });
          continue;
        }
        newSale = saleNum;
        patch.salePriceCents = saleNum;
        salePriceOverridden = true;
      } else if (newCost !== null && !salePriceOverridden) {
        // 只填了采购价，且当前未 override → 用供应商 markupRate 自动算
        const effectiveSupplier = supplierInfo ??
          (channel.supplierId
            ? supplierMap.get(
                [...supplierMap.values()].find(
                  (s) => s.id === channel.supplierId,
                )?.id ?? '',
              )
            : null);

        // 重新从供应商 map 找（通过 supplierId 反查 name 较复杂，直接查 DB）
        if (channel.supplierId) {
          const sup = [...supplierMap.values()].find(
            (s) => s.id === channel.supplierId,
          );
          if (sup) {
            newSale = calcSalePrice(newCost, sup.markupRate);
            patch.salePriceCents = newSale;
          }
        } else if (supplierInfo) {
          newSale = calcSalePrice(newCost, supplierInfo.markupRate);
          patch.salePriceCents = newSale;
        }
      }

      patch.salePriceOverridden = salePriceOverridden;

      // 时效
      const turnaroundStr = row.turnaroundHours?.trim() ?? '';
      if (turnaroundStr !== '') {
        const turnaroundNum = parseInt(turnaroundStr, 10);
        if (Number.isNaN(turnaroundNum) || turnaroundNum < 0) {
          result.failed += 1;
          result.failedItems.push({
            name,
            row: rowNum,
            reason: `时效无效: ${turnaroundStr}`,
          });
          continue;
        }
        patch.turnaroundHours = turnaroundNum;
      }

      // 库存
      const stockStr = row.stock?.trim() ?? '';
      if (stockStr !== '') {
        const stockNum = parseInt(stockStr, 10);
        if (Number.isNaN(stockNum) || stockNum < 0) {
          result.failed += 1;
          result.failedItems.push({
            name,
            row: rowNum,
            reason: `库存无效: ${stockStr}`,
          });
          continue;
        }
        patch.stock = stockNum;
      }

      // 供应商
      if (supplierInfo) {
        patch.supplierId = supplierInfo.id;
      }

      patch.priceUpdatedAt = now;
      patch.sellable =
        (patch.salePriceCents as number) > 0
          ? true
          : channel.sellable ?? false;

      await this.db
        .update(geoSubmissionChannels)
        .set(patch)
        .where(eq(geoSubmissionChannels.id, channel.id));

      result.success += 1;
      result.updated += 1;
    }

    return result;
  }

  private parseCsv(csvText: string): Array<{
    name: string;
    libraryType?: string;
    supplier?: string;
    costPrice?: string;
    salePrice?: string;
    turnaroundHours?: string;
    stock?: string;
    industry?: string;
    followers?: string;
  }> {
    const lines = csvText.split(/\r?\n/).filter((line) => line.trim() !== '');
    if (lines.length <= 1) return [];

    const dataLines = lines.slice(1);
    return dataLines.map((line) => {
      const cols = line.split(',');
      return {
        name: cols[0]?.trim() ?? '',
        libraryType: cols[1]?.trim(),
        supplier: cols[2]?.trim(),
        costPrice: cols[3]?.trim(),
        salePrice: cols[4]?.trim(),
        turnaroundHours: cols[5]?.trim(),
        stock: cols[6]?.trim(),
        industry: cols[7]?.trim(),
        followers: cols[8]?.trim(),
      };
    });
  }

  /* ==================== 商城统计 ==================== */

  async getStats(): Promise<MediaMarketStats> {
    const now = dayjs();
    const monthStart = now.startOf('month').toDate();
    const nextMonthStart = now.add(1, 'month').startOf('month').toDate();

    const [
      supplierCountResult,
      sellableResult,
      selfChannelResult,
      pricedUnshelvedResult,
      avgArticleResult,
      medianArticleResult,
      minArticleResult,
      maxArticleResult,
      avgVideoResult,
      monthlyOrdersResult,
    ] = await Promise.all([
      this.db.select({ count: count() }).from(geoMediaSuppliers),
      this.db
        .select({ count: count() })
        .from(geoSubmissionChannels)
        .where(eq(geoSubmissionChannels.sellable, true)),
      this.db
        .select({ count: count() })
        .from(geoSubmissionChannels)
        .where(eq(geoSubmissionChannels.sourceType, 'self')),
      this.db
        .select({ count: count() })
        .from(geoSubmissionChannels)
        .where(
          and(
            eq(geoSubmissionChannels.sellable, false),
            gte(geoSubmissionChannels.costPriceCents, 1),
          ),
        ),
      this.db
        .select({ avg: avg(geoSubmissionChannels.salePriceCents) })
        .from(geoSubmissionChannels)
        .where(
          and(
            eq(geoSubmissionChannels.priceUnit, 'article'),
            eq(geoSubmissionChannels.sellable, true),
          ),
        ),
      this.db
        .select({ val: sql<number>`percentile_cont(0.5) within group (order by ${geoSubmissionChannels.salePriceCents})` })
        .from(geoSubmissionChannels)
        .where(
          and(
            eq(geoSubmissionChannels.priceUnit, 'article'),
            eq(geoSubmissionChannels.sellable, true),
          ),
        ),
      this.db
        .select({ val: sql<number>`min(${geoSubmissionChannels.salePriceCents})` })
        .from(geoSubmissionChannels)
        .where(
          and(
            eq(geoSubmissionChannels.priceUnit, 'article'),
            eq(geoSubmissionChannels.sellable, true),
          ),
        ),
      this.db
        .select({ val: sql<number>`max(${geoSubmissionChannels.salePriceCents})` })
        .from(geoSubmissionChannels)
        .where(
          and(
            eq(geoSubmissionChannels.priceUnit, 'article'),
            eq(geoSubmissionChannels.sellable, true),
          ),
        ),
      this.db
        .select({ avg: avg(geoSubmissionChannels.salePriceCents) })
        .from(geoSubmissionChannels)
        .where(
          and(
            eq(geoSubmissionChannels.priceUnit, 'video'),
            eq(geoSubmissionChannels.sellable, true),
          ),
        ),
      this.db
        .select({
          totalAmount: sum(geoMediaOrders.priceCents),
          totalCost: sum(geoMediaOrders.costPriceCents),
        })
        .from(geoMediaOrders)
        .where(
          and(
            eq(geoMediaOrders.status, 'published'),
            gte(geoMediaOrders.createdAt, monthStart),
            lt(geoMediaOrders.createdAt, nextMonthStart),
          ),
        ),
    ]);

    const supplierCount = supplierCountResult[0]?.count ?? 0;
    const sellableChannelCount = sellableResult[0]?.count ?? 0;
    const selfChannelCount = selfChannelResult[0]?.count ?? 0;
    const pricedUnshelvedCount = pricedUnshelvedResult[0]?.count ?? 0;

    const avgSalePriceArticle =
      avgArticleResult[0]?.avg != null
        ? Math.round(Number(avgArticleResult[0].avg) / 100 * 100) / 100
        : 0;
    const medianSalePriceArticle =
      medianArticleResult[0]?.val != null
        ? Math.round(Number(medianArticleResult[0].val) / 100 * 100) / 100
        : 0;
    const minSalePriceArticle =
      minArticleResult[0]?.val != null
        ? Math.round(Number(minArticleResult[0].val) / 100 * 100) / 100
        : 0;
    const maxSalePriceArticle =
      maxArticleResult[0]?.val != null
        ? Math.round(Number(maxArticleResult[0].val) / 100 * 100) / 100
        : 0;
    const avgSalePriceVideo =
      avgVideoResult[0]?.avg != null
        ? Math.round(Number(avgVideoResult[0].avg) / 100 * 100) / 100
        : 0;

    const monthlyOrderAmount =
      monthlyOrdersResult[0]?.totalAmount != null
        ? Math.round(Number(monthlyOrdersResult[0].totalAmount) / 100 * 100) / 100
        : 0;
    const monthlyGrossProfit =
      monthlyOrdersResult[0]?.totalAmount != null &&
      monthlyOrdersResult[0]?.totalCost != null
        ? Math.round(
            (Number(monthlyOrdersResult[0].totalAmount) -
              Number(monthlyOrdersResult[0].totalCost)) /
              100 *
              100,
          ) / 100
        : 0;

    return {
      supplierCount,
      sellableChannelCount,
      selfChannelCount,
      pricedUnshelvedCount,
      avgSalePriceArticle,
      medianSalePriceArticle,
      minSalePriceArticle,
      maxSalePriceArticle,
      avgSalePriceVideo,
      monthlyOrderAmount,
      monthlyGrossProfit,
    };
  }

  /* ==================== 客户端商城渠道列表 ==================== */

  async getMarketChannels(
    query: MarketChannelQueryDto,
  ): Promise<MarketChannelListResponse> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const offset = (page - 1) * pageSize;

    const conditions = [
      eq(geoSubmissionChannels.sellable, true),
      gte(geoSubmissionChannels.salePriceCents, 1),
    ];

    if (query.mediaType) {
      conditions.push(eq(geoSubmissionChannels.mediaType, query.mediaType));
    }
    if (query.region && query.region !== '全国') {
      conditions.push(eq(geoSubmissionChannels.region, query.region));
    }
    if (query.industry) {
      // industries 是 text[]，用 array contains 匹配
      conditions.push(
        sql`${geoSubmissionChannels.industries} @> ARRAY[${query.industry}]::text[]`,
      );
    }
    if (query.priceMin !== undefined) {
      conditions.push(gte(geoSubmissionChannels.salePriceCents, query.priceMin));
    }
    if (query.priceMax !== undefined) {
      conditions.push(lt(geoSubmissionChannels.salePriceCents, query.priceMax + 1));
    }
    if (query.turnaroundMax !== undefined) {
      conditions.push(
        lte(geoSubmissionChannels.turnaroundHours, query.turnaroundMax),
      );
    }
    if (query.keyword) {
      conditions.push(ilike(geoSubmissionChannels.name, `%${query.keyword}%`));
    }
    if (query.sourceType) {
      conditions.push(eq(geoSubmissionChannels.sourceType, query.sourceType));
    }

    const where = and(...conditions);

    // 排序
    const sortBy = query.sortBy ?? 'price';
    const sortOrder = query.sortOrder ?? 'asc';
    const orderExpr =
      sortBy === 'turnaround'
        ? sortOrder === 'asc'
          ? asc(geoSubmissionChannels.turnaroundHours)
          : desc(geoSubmissionChannels.turnaroundHours)
        : sortOrder === 'asc'
          ? asc(geoSubmissionChannels.salePriceCents)
          : desc(geoSubmissionChannels.salePriceCents);

    const [totalResult, items] = await Promise.all([
      this.db
        .select({ count: count() })
        .from(geoSubmissionChannels)
        .where(where),
      this.db
        .select({
          id: geoSubmissionChannels.id,
          name: geoSubmissionChannels.name,
          libraryType: geoSubmissionChannels.libraryType,
          channelType: geoSubmissionChannels.channelType,
          region: geoSubmissionChannels.region,
          industries: geoSubmissionChannels.industries,
          tier: geoSubmissionChannels.tier,
          salePriceCents: geoSubmissionChannels.salePriceCents,
          priceUnit: geoSubmissionChannels.priceUnit,
          stock: geoSubmissionChannels.stock,
          turnaroundHours: geoSubmissionChannels.turnaroundHours,
          priceUpdatedAt: geoSubmissionChannels.priceUpdatedAt,
          followers: geoSubmissionChannels.followers,
          aiSources: geoSubmissionChannels.aiSources,
          platformCoverage: geoSubmissionChannels.platformCoverage,
          submitUrl: geoSubmissionChannels.submitUrl,
          sourceType: geoSubmissionChannels.sourceType,
        })
        .from(geoSubmissionChannels)
        .where(where)
        .orderBy(orderExpr, desc(geoSubmissionChannels.updatedAt))
        .limit(pageSize)
        .offset(offset),
    ]);

    const total = totalResult[0]?.count ?? 0;

    return {
      items: items.map((item) => ({
        id: item.id,
        name: item.name,
        libraryType: item.libraryType ?? undefined,
        channelType: item.channelType ?? undefined,
        region: item.region ?? undefined,
        industries: item.industries ?? [],
        tier: item.tier ?? undefined,
        salePriceCents: item.salePriceCents ?? 0,
        priceUnit: item.priceUnit ?? 'article',
        stock: item.stock ?? null,
        turnaroundHours: item.turnaroundHours ?? null,
        priceUpdatedAt: item.priceUpdatedAt ? item.priceUpdatedAt.toISOString() : null,
        followers: item.followers ?? null,
        aiSources: item.aiSources ?? undefined,
        platformCoverage: item.platformCoverage ?? undefined,
        submitUrl: item.submitUrl ?? undefined,
        sourceType: ((SOURCE_TYPES as readonly string[]).includes(item.sourceType ?? '')
          ? item.sourceType
          : 'supplier') as 'self' | 'supplier',
      })) as MarketChannel[],
      total,
      page,
      pageSize,
    };
  }

  /* ==================== 供应商结算统计 ==================== */

  async getSettlementStats(): Promise<SupplierSettlementStat[]> {
    const now = dayjs();
    const monthStart = now.startOf('month').toDate();
    const nextMonthStart = now.add(1, 'month').startOf('month').toDate();

    const rows = await this.db
      .select({
        supplierId: geoMediaOrders.supplierId,
        supplierName: geoMediaSuppliers.name,
        orderCount: count(),
        totalCostCents: sum(geoMediaOrders.costPriceCents),
      })
      .from(geoMediaOrders)
      .leftJoin(
        geoMediaSuppliers,
        eq(geoMediaOrders.supplierId, geoMediaSuppliers.id),
      )
      .where(
        and(
          eq(geoMediaOrders.status, 'published'),
          gte(geoMediaOrders.createdAt, monthStart),
          lt(geoMediaOrders.createdAt, nextMonthStart),
        ),
      )
      .groupBy(geoMediaOrders.supplierId, geoMediaSuppliers.name);

    const result: SupplierSettlementStat[] = rows.map((row) => ({
      supplierId: row.supplierId ?? 'unassigned',
      supplierName: row.supplierName ?? '未分配',
      orderCount: Number(row.orderCount),
      totalCostCents: Number(row.totalCostCents) || 0,
      unsettledCents: Number(row.totalCostCents) || 0,
    }));

    return result;
  }

  async getFilterOptions(): Promise<{
    mediaTypes: string[];
    regions: string[];
    industries: string[];
    sourceTypes: string[];
  }> {
    const [mediaTypeRows, regionRows, industryRows] = await Promise.all([
      this.db
        .select({ value: geoSubmissionChannels.mediaType })
        .from(geoSubmissionChannels)
        .where(eq(geoSubmissionChannels.sellable, true))
        .groupBy(geoSubmissionChannels.mediaType)
        .orderBy(geoSubmissionChannels.mediaType),
      this.db
        .select({
          value: geoSubmissionChannels.region,
          count: count(),
        })
        .from(geoSubmissionChannels)
        .where(eq(geoSubmissionChannels.sellable, true))
        .groupBy(geoSubmissionChannels.region)
        .orderBy((fields) => [
          sql`CASE WHEN ${fields.value} = '全国' THEN 0 ELSE 1 END`,
          desc(fields.count),
          fields.value,
        ]),
      this.db
        .select({ value: sql<string>`unnest(${geoSubmissionChannels.industries})` })
        .from(geoSubmissionChannels)
        .where(eq(geoSubmissionChannels.sellable, true))
        .groupBy(sql`unnest(${geoSubmissionChannels.industries})`)
        .orderBy(sql`unnest(${geoSubmissionChannels.industries})`),
    ]);

    return {
      mediaTypes: mediaTypeRows.map((r) => r.value).filter(Boolean) as string[],
      regions: regionRows.map((r) => r.value).filter(Boolean) as string[],
      industries: industryRows.map((r) => r.value).filter(Boolean) as string[],
      sourceTypes: [...SOURCE_TYPES],
    };
  }
}
