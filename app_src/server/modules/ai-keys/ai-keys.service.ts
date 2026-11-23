import {
  Injectable,
  Inject,
  Logger,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { DRIZZLE_DATABASE, type PostgresJsDatabase } from '@lark-apaas/fullstack-nestjs-core';
import { eq, and, isNull, desc, count } from 'drizzle-orm';
import { firstValueFrom } from 'rxjs';
import { HttpService } from '@nestjs/axios';
import type { AxiosError } from 'axios';

import {
  geoAiKeys,
  geoAiKeyBrands,
  geoCreditAccounts,
  geoCreditRequests,
  geoBrands,
  geoCreditTransactions,
} from '@server/database/schema';
import {
  AI_VENDORS,
  AI_VENDOR_LABELS,
  AI_VENDOR_DEFAULT_BASE_URL,
  AI_VENDOR_MODELS,
  CREDIT_PACKAGE_INFO,
  type AiVendor,
  type AiKeyStatus,
  type AiKeyItem,
  type AiKeyListResponse,
  type AiKeyUpsertRequest,
  type AiTestResponse,
  type CreditPackage,
  type CreditRequestItem,
  type CreditRequestListResponse,
  CREDIT_REQUEST_STATUS_LABELS,
} from '@shared/api.interface';

interface GeoUserCtx {
  id: string;
  role: string;
  brandId: string | null;
}

function maskApiKey(key: string | null): string | null {
  if (!key) return null;
  if (key.length <= 7) return '****';
  return key.slice(0, 3) + '****' + key.slice(-4);
}

function isAiVendor(v: string): v is AiVendor {
  return (AI_VENDORS as readonly string[]).includes(v);
}

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
}

function classifyUpstreamError(
  status: number | null,
  bodyText: string,
  err: unknown,
  vendor?: string,
): { message: string; code: string | null } {
  let errorCode: string | null = null;

  // 尝试从响应体提取 error.code 和 error.message
  try {
    const parsed = JSON.parse(bodyText) as {
      error?: { message?: string; code?: string } | string;
    };
    if (typeof parsed.error === 'object' && parsed.error !== null) {
      if (parsed.error.code) errorCode = parsed.error.code;
    }
  } catch {
    // 不是 JSON，忽略
  }

  if (status === 401 || status === 403) {
    const vendorLabel = vendor ? ` ${vendor} 的` : '';
    return {
      message: `API Key 无效或已过期，请到『AI 模型接入』检查${vendorLabel} Key`,
      code: errorCode,
    };
  }
  const lowerBody = bodyText.toLowerCase();
  if (
    status === 429 ||
    lowerBody.includes('insufficient_quota') ||
    lowerBody.includes('rate limit') ||
    lowerBody.includes('余额不足')
  ) {
    return { message: '该模型额度不足，请更换模型或充值', code: errorCode };
  }
  // 网络错误识别
  if (err && typeof err === 'object') {
    const code = (err as { code?: string }).code;
    if (code === 'ECONNABORTED' || code === 'ETIMEDOUT' || code === 'ECONNREFUSED') {
      return { message: '模型服务连接失败，请稍后重试', code: errorCode || code };
    }
  }
  // 尝试从响应体提取 error.message
  try {
    const parsed = JSON.parse(bodyText) as {
      error?: { message?: string; code?: string } | string;
    };
    const errMsg =
      typeof parsed.error === 'object' && parsed.error !== null
        ? parsed.error.message
        : typeof parsed.error === 'string'
          ? parsed.error
          : null;
    if (errMsg) {
      return {
        message: errMsg.length > 100 ? errMsg.slice(0, 100) : errMsg,
        code: errorCode,
      };
    }
  } catch {
    // 不是 JSON，忽略
  }
  const fallback = bodyText.slice(0, 100);
  return { message: fallback || '模型服务调用失败', code: errorCode };
}

@Injectable()
export class AiKeysService {
  private readonly logger = new Logger(AiKeysService.name);

  constructor(
    @Inject(DRIZZLE_DATABASE) private readonly db: PostgresJsDatabase,
    private readonly httpService: HttpService,
  ) {}

  // ============================================================
  //  列表 + 默认计算 + 余额
  // ============================================================

  async listKeys(user: GeoUserCtx, brandId?: string | null): Promise<AiKeyListResponse> {
    // 平台级 Key
    const platformRows = await this.db
      .select()
      .from(geoAiKeys)
      .where(and(eq(geoAiKeys.ownerType, 'platform'), isNull(geoAiKeys.ownerId)));

    // 品牌级 Key（仅当传了 brandId）
    let brandRows: typeof geoAiKeyBrands.$inferSelect[] = [];
    if (brandId) {
      brandRows = await this.db
        .select()
        .from(geoAiKeyBrands)
        .where(eq(geoAiKeyBrands.brandId, brandId));
    }

    // 余额：传了 brandId 读指定品牌；client 读自己的 brand；admin/operator 默认读第一个品牌
    let balance = 0;
    let balanceBrandId: string | null = null;
    let balanceBrandName: string | null = null;
    const balanceBid = brandId ?? user.brandId;
    if (balanceBid) {
      const [accRows, brandRowsForName] = await Promise.all([
        this.db
          .select()
          .from(geoCreditAccounts)
          .where(eq(geoCreditAccounts.brandId, balanceBid as unknown as string))
          .limit(1),
        this.db
          .select({ name: geoBrands.name })
          .from(geoBrands)
          .where(eq(geoBrands.id, balanceBid as unknown as string))
          .limit(1),
      ]);
      if (accRows[0]) {
        balance = Number(accRows[0].balance);
        balanceBrandId = balanceBid as unknown as string;
        balanceBrandName = brandRowsForName[0]?.name ?? null;
      }
    } else if (user.role === 'admin' || user.role === 'operator') {
      const brandRowsFirst = await this.db
        .select({ id: geoBrands.id, name: geoBrands.name })
        .from(geoBrands)
        .orderBy(geoBrands.id)
        .limit(1);
      if (brandRowsFirst[0]) {
        const accRows = await this.db
          .select()
          .from(geoCreditAccounts)
          .where(eq(geoCreditAccounts.brandId, brandRowsFirst[0].id as unknown as string))
          .limit(1);
        if (accRows[0]) {
          balance = Number(accRows[0].balance);
          balanceBrandId = brandRowsFirst[0].id as unknown as string;
          balanceBrandName = brandRowsFirst[0].name ?? null;
        }
      }
    }

    // 有 brandId：品牌视图，以 AI_VENDORS 全集为基础合并
    if (brandId) {
      const brandMap = new Map<string, typeof geoAiKeyBrands.$inferSelect>();
      for (const row of brandRows) brandMap.set(row.vendor, row);

      const platformMap = new Map<string, typeof geoAiKeys.$inferSelect>();
      for (const row of platformRows) platformMap.set(row.vendor, row);

      const items: AiKeyItem[] = [];
      for (const vendor of AI_VENDORS) {
        const brandRow = brandMap.get(vendor);
        const platformRow = platformMap.get(vendor);

        const hasBrandConfig = Boolean(brandRow && brandRow.apiKey);
        const sourceRow = hasBrandConfig ? brandRow : platformRow;

        if (!sourceRow) continue;

        let status = (sourceRow.status ?? 'unconfigured') as AiKeyStatus;
        if (status === 'unconfigured' && sourceRow.apiKey) {
          status = 'configured';
        }

        items.push({
          vendor,
          model: sourceRow.model ?? null,
          baseUrl: sourceRow.baseUrl ?? null,
          apiKey: maskApiKey(sourceRow.apiKey ?? null),
          isDefault: hasBrandConfig
            ? Boolean(brandRow?.isDefault)
            : Boolean(platformRow?.isDefault),
          status,
          ownerType: hasBrandConfig ? 'brand' : 'platform',
          brandOverride: hasBrandConfig,
          lastTestedAt: sourceRow.lastTestedAt
            ? new Date(sourceRow.lastTestedAt).toISOString()
            : null,
          lastTestError: sourceRow.lastTestError ?? null,
        });
      }

      // 默认：先品牌级 isDefault，再平台级 isDefault
      let defaultVendor: AiVendor | null = null;
      let defaultSource: 'brand' | 'platform' | null = null;

      const brandDefault = brandRows.find((r) => r.isDefault === true && r.apiKey);
      if (brandDefault && isAiVendor(brandDefault.vendor)) {
        defaultVendor = brandDefault.vendor;
        defaultSource = 'brand';
      } else {
        const platformDefault = platformRows.find((r) => r.isDefault === true);
        if (platformDefault && isAiVendor(platformDefault.vendor)) {
          defaultVendor = platformDefault.vendor;
          defaultSource = 'platform';
        }
      }

      return {
        items,
        defaultVendor,
        defaultSource,
        balance,
        balanceBrandId,
        balanceBrandName,
        monthlyCalls: 0,
        monthlyTokens: 0,
      };
    }

    // 无 brandId：平台视图，只返回平台级记录
    const items: AiKeyItem[] = [];
    for (const row of platformRows) {
      if (!isAiVendor(row.vendor)) continue;
      let status = (row.status ?? 'unconfigured') as AiKeyStatus;
      if (status === 'unconfigured' && row.apiKey) {
        status = 'configured';
      }
      items.push({
        vendor: row.vendor,
        model: row.model ?? null,
        baseUrl: row.baseUrl ?? null,
        apiKey: maskApiKey(row.apiKey ?? null),
        isDefault: Boolean(row.isDefault),
        status,
        ownerType: 'platform',
        brandOverride: false,
        lastTestedAt: row.lastTestedAt ? new Date(row.lastTestedAt).toISOString() : null,
        lastTestError: row.lastTestError ?? null,
      });
    }

    let defaultVendor: AiVendor | null = null;
    let defaultSource: 'platform' | null = null;
    const platformDefault = platformRows.find((r) => r.isDefault === true);
    if (platformDefault && isAiVendor(platformDefault.vendor)) {
      defaultVendor = platformDefault.vendor;
      defaultSource = 'platform';
    }

    return {
      items,
      defaultVendor,
      defaultSource,
      balance,
      balanceBrandId,
      balanceBrandName,
      monthlyCalls: 0,
      monthlyTokens: 0,
    };
  }

  // ============================================================
  //  保存/更新
  // ============================================================

  async upsertKey(
    user: GeoUserCtx,
    vendor: string,
    dto: AiKeyUpsertRequest,
    brandId?: string | null,
  ): Promise<AiKeyItem> {
    if (!isAiVendor(vendor)) {
      throw new BadRequestException('不支持的 AI 厂商');
    }

    // 校验 model 是否在对应厂商模型列表内（如果传入）
    if (dto.model) {
      // 允许自定义模型 ID，不再做白名单校验
      // 前端 combobox 提供预设选项，用户也可输入任意模型
    }

    if (brandId) {
      // 品牌级 upsert
      const existing = await this.db
        .select()
        .from(geoAiKeyBrands)
        .where(and(eq(geoAiKeyBrands.brandId, brandId), eq(geoAiKeyBrands.vendor, vendor)))
        .limit(1);

      const patch: Partial<typeof geoAiKeyBrands.$inferInsert> = {};
      if (dto.model !== undefined) patch.model = dto.model;
      if (dto.baseUrl !== undefined) patch.baseUrl = dto.baseUrl;
      if (dto.apiKey !== undefined) patch.apiKey = dto.apiKey;
      patch.updatedAt = new Date();

      let resultRow: typeof geoAiKeyBrands.$inferSelect;

      if (existing[0]) {
        if (Object.keys(patch).length === 0) {
          resultRow = existing[0];
        } else {
          const updated = await this.db
            .update(geoAiKeyBrands)
            .set(patch)
            .where(eq(geoAiKeyBrands.id, existing[0].id))
            .returning();
          resultRow = updated[0];
        }
      } else {
        const values: typeof geoAiKeyBrands.$inferInsert = {
          brandId,
          vendor,
          model: dto.model ?? null,
          baseUrl: dto.baseUrl ?? AI_VENDOR_DEFAULT_BASE_URL[vendor],
          apiKey: dto.apiKey ?? null,
          isDefault: false,
          status: 'unconfigured',
        };
        const inserted = await this.db
          .insert(geoAiKeyBrands)
          .values(values)
          .returning();
        resultRow = inserted[0];

        // 第一次保存且还没有任何默认 Key，把这条设为默认
        const defaultRow = await this.db
          .select()
          .from(geoAiKeyBrands)
          .where(and(eq(geoAiKeyBrands.brandId, brandId), eq(geoAiKeyBrands.isDefault, true)))
          .limit(1);

        if (!defaultRow[0]) {
          const updated = await this.db
            .update(geoAiKeyBrands)
            .set({ isDefault: true, updatedAt: new Date() })
            .where(eq(geoAiKeyBrands.id, resultRow.id))
            .returning();
          resultRow = updated[0];
        }
      }

      return {
        vendor: resultRow.vendor as AiVendor,
        model: resultRow.model ?? null,
        baseUrl: resultRow.baseUrl ?? null,
        apiKey: maskApiKey(resultRow.apiKey ?? null),
        isDefault: Boolean(resultRow.isDefault),
        status: (resultRow.status ?? 'unconfigured') as AiKeyStatus,
        ownerType: 'brand',
        brandOverride: Boolean(resultRow.apiKey),
        lastTestedAt: resultRow.lastTestedAt
          ? new Date(resultRow.lastTestedAt).toISOString()
          : null,
        lastTestError: resultRow.lastTestError ?? null,
      };
    }

    // 平台级 upsert
    const existing = await this.db
      .select()
      .from(geoAiKeys)
      .where(and(eq(geoAiKeys.ownerType, 'platform'), isNull(geoAiKeys.ownerId), eq(geoAiKeys.vendor, vendor)))
      .limit(1);

    const patch: Partial<typeof geoAiKeys.$inferInsert> = {};
    if (dto.model !== undefined) patch.model = dto.model;
    if (dto.baseUrl !== undefined) patch.baseUrl = dto.baseUrl;
    if (dto.apiKey !== undefined) patch.apiKey = dto.apiKey;
    patch.updatedAt = new Date();

    let resultRow: typeof geoAiKeys.$inferSelect;

    if (existing[0]) {
      if (Object.keys(patch).length === 0) {
        resultRow = existing[0];
      } else {
        const updated = await this.db
          .update(geoAiKeys)
          .set(patch)
          .where(eq(geoAiKeys.id, existing[0].id))
          .returning();
        resultRow = updated[0];
      }
    } else {
      const values: typeof geoAiKeys.$inferInsert = {
        ownerType: 'platform',
        ownerId: null,
        vendor,
        model: dto.model ?? null,
        baseUrl: dto.baseUrl ?? AI_VENDOR_DEFAULT_BASE_URL[vendor],
        apiKey: dto.apiKey ?? null,
        isDefault: false,
        status: 'unconfigured',
      };
      const inserted = await this.db
        .insert(geoAiKeys)
        .values(values)
        .returning();
      resultRow = inserted[0];

      // 第一次保存且还没有任何默认 Key，把这条设为默认
      const defaultRow = await this.db
        .select()
        .from(geoAiKeys)
        .where(and(eq(geoAiKeys.ownerType, 'platform'), isNull(geoAiKeys.ownerId), eq(geoAiKeys.isDefault, true)))
        .limit(1);

      if (!defaultRow[0]) {
        const updated = await this.db
          .update(geoAiKeys)
          .set({ isDefault: true, updatedAt: new Date() })
          .where(eq(geoAiKeys.id, resultRow.id))
          .returning();
        resultRow = updated[0];
      }
    }

    return {
      vendor: resultRow.vendor as AiVendor,
      model: resultRow.model ?? null,
      baseUrl: resultRow.baseUrl ?? null,
      apiKey: maskApiKey(resultRow.apiKey ?? null),
      isDefault: Boolean(resultRow.isDefault),
      status: (resultRow.status ?? 'unconfigured') as AiKeyStatus,
      ownerType: 'platform',
      brandOverride: false,
      lastTestedAt: resultRow.lastTestedAt
        ? new Date(resultRow.lastTestedAt).toISOString()
        : null,
      lastTestError: resultRow.lastTestError ?? null,
    };
  }

  // ============================================================
  //  删除
  // ============================================================

  async deleteKey(user: GeoUserCtx, vendor: string, brandId?: string | null): Promise<void> {
    if (!isAiVendor(vendor)) {
      throw new BadRequestException('不支持的 AI 厂商');
    }

    if (brandId) {
      // 品牌级删除
      const existing = await this.db
        .select()
        .from(geoAiKeyBrands)
        .where(and(eq(geoAiKeyBrands.brandId, brandId), eq(geoAiKeyBrands.vendor, vendor)))
        .limit(1);

      if (!existing[0]) {
        throw new NotFoundException('该品牌该厂商配置不存在');
      }

      const wasDefault = existing[0].isDefault === true;
      const deletedId = existing[0].id;

      await this.db.delete(geoAiKeyBrands).where(eq(geoAiKeyBrands.id, deletedId));

      // 如果删的是默认 Key，重新选默认（同品牌内）
      if (wasDefault) {
        const remaining = await this.db
          .select()
          .from(geoAiKeyBrands)
          .where(eq(geoAiKeyBrands.brandId, brandId))
          .orderBy((t) => [t.id])
          .limit(1);

        if (remaining[0]) {
          await this.db
            .update(geoAiKeyBrands)
            .set({ isDefault: true, updatedAt: new Date() })
            .where(eq(geoAiKeyBrands.id, remaining[0].id));
        }
      }
      return;
    }

    // 平台级删除
    const existing = await this.db
      .select()
      .from(geoAiKeys)
      .where(
        and(
          eq(geoAiKeys.ownerType, 'platform'),
          isNull(geoAiKeys.ownerId),
          eq(geoAiKeys.vendor, vendor),
        ),
      )
      .limit(1);

    if (!existing[0]) {
      throw new NotFoundException('该厂商配置不存在');
    }

    const wasDefault = existing[0].isDefault === true;
    const deletedId = existing[0].id;

    await this.db.delete(geoAiKeys).where(eq(geoAiKeys.id, deletedId));

    // 如果删的是默认 Key，重新选默认
    if (wasDefault) {
      const remaining = await this.db
        .select()
        .from(geoAiKeys)
        .where(and(eq(geoAiKeys.ownerType, 'platform'), isNull(geoAiKeys.ownerId)))
        .orderBy((t) => [t.id])
        .limit(1);

      if (remaining[0]) {
        await this.db
          .update(geoAiKeys)
          .set({ isDefault: true, updatedAt: new Date() })
          .where(eq(geoAiKeys.id, remaining[0].id));
      }
    }
  }

  // ============================================================
  //  测试连接
  // ============================================================

  async testKey(user: GeoUserCtx, vendor: string, brandId?: string | null): Promise<AiTestResponse> {
    if (!isAiVendor(vendor)) {
      throw new BadRequestException('不支持的 AI 厂商');
    }

    // 找配置：品牌级 → 平台级回落
    let sourceRow: { apiKey: string | null; baseUrl: string | null; model: string | null; id: number; table: 'brand' | 'platform' } | null = null;

    if (brandId) {
      const brandRow = await this.db
        .select()
        .from(geoAiKeyBrands)
        .where(and(eq(geoAiKeyBrands.brandId, brandId), eq(geoAiKeyBrands.vendor, vendor)))
        .limit(1);
      if (brandRow[0] && brandRow[0].apiKey) {
        sourceRow = { ...brandRow[0], table: 'brand' };
      }
    }

    if (!sourceRow) {
      const platformRow = await this.db
        .select()
        .from(geoAiKeys)
        .where(
          and(
            eq(geoAiKeys.ownerType, 'platform'),
            isNull(geoAiKeys.ownerId),
            eq(geoAiKeys.vendor, vendor),
          ),
        )
        .limit(1);
      if (platformRow[0] && platformRow[0].apiKey) {
        sourceRow = { ...platformRow[0], table: 'platform' };
      }
    }

    if (!sourceRow || !sourceRow.apiKey) {
      throw new BadRequestException('该厂商尚未配置 API Key');
    }

    const baseUrl = sourceRow.baseUrl ?? AI_VENDOR_DEFAULT_BASE_URL[vendor as AiVendor];
    const model = sourceRow.model ?? AI_VENDOR_MODELS[vendor as AiVendor][0];
    const chatUrl = `${normalizeBaseUrl(baseUrl)}/chat/completions`;

    const startTime = Date.now();
    let status = 0;
    let rawBody = '';
    let errorMessage: string | undefined;
    let errorCode: string | undefined;
    let ok = false;
    let upstreamErr: unknown = null;

    try {
      const response = await firstValueFrom(
        this.httpService.post(
          chatUrl,
          {
            model,
            messages: [{ role: 'user', content: 'ping' }],
            max_tokens: 8,
          },
          {
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${sourceRow.apiKey}`,
            },
            timeout: 15000,
          },
        ),
      );
      status = response.status;
      rawBody = typeof response.data === 'string'
        ? response.data
        : JSON.stringify(response.data);
      ok = status >= 200 && status < 300;
      // 进一步检查响应内容是否有 choices
      if (ok) {
        try {
          const data = typeof response.data === 'string'
            ? JSON.parse(response.data)
            : response.data;
          if (data?.choices && Array.isArray(data.choices) && data.choices.length > 0) {
            ok = true;
          } else if (data?.error) {
            ok = false;
            const classified = classifyUpstreamError(status, rawBody, null, vendor);
            errorMessage = classified.message;
            errorCode = classified.code ?? undefined;
          }
        } catch {
          // 解析失败保持 ok
        }
      }
    } catch (err: unknown) {
      upstreamErr = err;
      const axiosErr = err as AxiosError;
      if (axiosErr.response) {
        status = axiosErr.response.status;
        rawBody =
          typeof axiosErr.response.data === 'string'
            ? axiosErr.response.data
            : JSON.stringify(axiosErr.response.data ?? '');
      } else {
        status = 0;
        rawBody = axiosErr.message ?? 'Network error';
      }
      const classified = classifyUpstreamError(status, rawBody, err, vendor);
      errorMessage = classified.message;
      errorCode = classified.code ?? undefined;
      ok = false;
    }

    const latencyMs = Date.now() - startTime;
    const raw = rawBody.slice(0, 200);

    // 更新 status、lastTestedAt、lastTestError 到对应表
    if (sourceRow.table === 'brand') {
      await this.db
        .update(geoAiKeyBrands)
        .set({
          status: ok ? 'ok' : 'failed',
          lastTestedAt: new Date(),
          lastTestError: ok
            ? null
            : (`HTTP ${status} · ${errorCode || '未知错误'}: ${errorMessage || ''}`).slice(0, 200),
          updatedAt: new Date(),
        })
        .where(eq(geoAiKeyBrands.id, sourceRow.id));
    } else {
      await this.db
        .update(geoAiKeys)
        .set({
          status: ok ? 'ok' : 'failed',
          lastTestedAt: new Date(),
          lastTestError: ok
            ? null
            : (`HTTP ${status} · ${errorCode || '未知错误'}: ${errorMessage || ''}`).slice(0, 200),
          updatedAt: new Date(),
        })
        .where(eq(geoAiKeys.id, sourceRow.id));
    }

    // 上游原始错误打日志
    if (!ok && upstreamErr) {
      this.logger.error(
        `AI Key 测试失败 vendor=${vendor} status=${status}`,
        upstreamErr instanceof Error ? upstreamErr.stack : String(upstreamErr),
      );
    }

    return {
      ok,
      status,
      latencyMs,
      raw,
      errorMessage,
      errorCode,
    };
  }

  // ============================================================
  //  设置默认
  // ============================================================

  async setDefault(user: GeoUserCtx, vendor: string, brandId?: string | null): Promise<AiKeyListResponse> {
    if (!isAiVendor(vendor)) {
      throw new BadRequestException('不支持的 AI 厂商');
    }

    if (brandId) {
      // 品牌级设默认
      const target = await this.db
        .select()
        .from(geoAiKeyBrands)
        .where(and(eq(geoAiKeyBrands.brandId, brandId), eq(geoAiKeyBrands.vendor, vendor)))
        .limit(1);

      if (!target[0]) {
        throw new BadRequestException('该品牌该厂商尚未配置，无法设为默认');
      }

      // 先全部取消默认
      await this.db
        .update(geoAiKeyBrands)
        .set({ isDefault: false, updatedAt: new Date() })
        .where(eq(geoAiKeyBrands.brandId, brandId));

      // 再设指定的为默认
      await this.db
        .update(geoAiKeyBrands)
        .set({ isDefault: true, updatedAt: new Date() })
        .where(eq(geoAiKeyBrands.id, target[0].id));

      return this.listKeys(user, brandId);
    }

    // 平台级设默认
    const target = await this.db
      .select()
      .from(geoAiKeys)
      .where(
        and(
          eq(geoAiKeys.ownerType, 'platform'),
          isNull(geoAiKeys.ownerId),
          eq(geoAiKeys.vendor, vendor),
        ),
      )
      .limit(1);

    if (!target[0]) {
      throw new BadRequestException('该厂商尚未配置，无法设为默认');
    }

    // 先全部取消默认
    await this.db
      .update(geoAiKeys)
      .set({ isDefault: false, updatedAt: new Date() })
      .where(and(eq(geoAiKeys.ownerType, 'platform'), isNull(geoAiKeys.ownerId)));

    // 再设指定的为默认
    await this.db
      .update(geoAiKeys)
      .set({ isDefault: true, updatedAt: new Date() })
      .where(eq(geoAiKeys.id, target[0].id));

    return this.listKeys(user);
  }

  // ============================================================
  //  获取当前生效的 Key（内部调用，返回明文）
  //  优先级：品牌级默认 → 平台级默认
  // ============================================================

  async getActiveKey(
    user: GeoUserCtx | null,
    brandId?: string | null,
  ): Promise<{ baseUrl: string; apiKey: string; model: string; vendor: string } | null> {
    // 1. 品牌级默认
    if (brandId) {
      const brandRow = await this.db
        .select()
        .from(geoAiKeyBrands)
        .where(and(eq(geoAiKeyBrands.brandId, brandId), eq(geoAiKeyBrands.isDefault, true)))
        .limit(1);

      if (brandRow[0] && brandRow[0].apiKey) {
        const vendor = brandRow[0].vendor;
        const v = isAiVendor(vendor) ? vendor : null;
        return {
          baseUrl: brandRow[0].baseUrl ?? (v ? AI_VENDOR_DEFAULT_BASE_URL[v] : ''),
          apiKey: brandRow[0].apiKey,
          model: brandRow[0].model ?? (v ? AI_VENDOR_MODELS[v][0] : ''),
          vendor,
        };
      }
    }

    // 2. 平台级默认
    const platformRow = await this.db
      .select()
      .from(geoAiKeys)
      .where(
        and(
          eq(geoAiKeys.ownerType, 'platform'),
          isNull(geoAiKeys.ownerId),
          eq(geoAiKeys.isDefault, true),
        ),
      )
      .limit(1);

    if (platformRow[0] && platformRow[0].apiKey) {
      const vendor = platformRow[0].vendor;
      const v = isAiVendor(vendor) ? vendor : null;
      return {
        baseUrl: platformRow[0].baseUrl ?? (v ? AI_VENDOR_DEFAULT_BASE_URL[v] : ''),
        apiKey: platformRow[0].apiKey,
        model: platformRow[0].model ?? (v ? AI_VENDOR_MODELS[v][0] : ''),
        vendor,
      };
    }

    return null;
  }

  // ============================================================
  //  获取当前生效模型的显示名（如「豆包（doubao-pro-32k）」）
  // ============================================================

  async getActiveModelName(brandId?: string | null): Promise<string | null> {
    const activeKey = await this.getActiveKey(null, brandId);
    if (!activeKey) return null;
    const vendorLabel = isAiVendor(activeKey.vendor)
      ? AI_VENDOR_LABELS[activeKey.vendor]
      : activeKey.vendor;
    return `${vendorLabel}（${activeKey.model}）`;
  }

  // ============================================================
  //  Chat 方法（供其他模块调用）
  // ============================================================

  async chat(
    messages: Array<{ role: string; content: string }>,
    options?: { maxTokens?: number; temperature?: number; user?: GeoUserCtx | null; brandId?: string },
  ): Promise<{ content: string; usage?: { promptTokens: number; completionTokens: number } }> {
    const activeKey = await this.getActiveKey(options?.user ?? null, options?.brandId);
    if (!activeKey) {
      throw new BadRequestException('尚未配置 AI 模型，请到「AI 模型接入」填写 Key 或联系服务商');
    }

    const chatUrl = `${normalizeBaseUrl(activeKey.baseUrl)}/chat/completions`;
    const startTime = Date.now();

    try {
      const response = await firstValueFrom(
        this.httpService.post(
          chatUrl,
          {
            model: activeKey.model,
            messages: messages.map((m) => ({ role: m.role, content: m.content })),
            max_tokens: options?.maxTokens,
            temperature: options?.temperature,
          },
          {
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${activeKey.apiKey}`,
            },
            timeout: 60000,
          },
        ),
      );

      const data = response.data as {
        choices?: Array<{ message?: { content?: string } }>;
        usage?: { prompt_tokens?: number; completion_tokens?: number };
      };

      const content = data?.choices?.[0]?.message?.content ?? '';
      const usage = data.usage
        ? {
            promptTokens: data.usage.prompt_tokens ?? 0,
            completionTokens: data.usage.completion_tokens ?? 0,
          }
        : undefined;

      return { content, usage };
    } catch (err: unknown) {
      const axiosErr = err as AxiosError;
      const status = axiosErr.response?.status ?? 0;
      const rawBody =
        typeof axiosErr.response?.data === 'string'
          ? axiosErr.response.data
          : JSON.stringify(axiosErr.response?.data ?? '');

      const msg = classifyUpstreamError(status, rawBody, err, activeKey.vendor);
      const latencyMs = Date.now() - startTime;
      this.logger.error(
        `AI chat 调用失败 vendor=${activeKey.vendor} status=${status} latency=${latencyMs}ms`,
        err instanceof Error ? err.stack : String(err),
      );
      throw new BadRequestException(msg);
    }
  }

  // ============================================================
  //  充值申请
  // ============================================================

  async createCreditRequest(
    user: GeoUserCtx,
    packageType: CreditPackage,
    brandId: string,
  ): Promise<CreditRequestItem> {
    // client 角色：brandId 必须等于 user.brandId
    if (user.role === 'client') {
      if (!user.brandId || user.brandId !== brandId) {
        throw new ForbiddenException('只能为自己所属品牌提交充值申请');
      }
    }

    const pkgInfo = CREDIT_PACKAGE_INFO[packageType];
    const amount = pkgInfo.amount;

    const inserted = await this.db
      .insert(geoCreditRequests)
      .values({
        brandId,
        package: packageType,
        amount,
        status: 'pending',
      })
      .returning();

    const row = inserted[0];
    return {
      id: row.id,
      brandId: row.brandId ?? null,
      brandName: null,
      package: row.package ?? null,
      packageName: row.package ? CREDIT_PACKAGE_INFO[row.package as CreditPackage]?.name ?? null : null,
      amount: row.amount ?? null,
      status: (row.status ?? 'pending') as 'pending' | 'approved' | 'rejected',
      createdAt: row.createdAt ? new Date(row.createdAt).toISOString() : null,
      processedAt: null,
      rejectReason: null,
    };
  }

  // ============================================================
  //  充值申请列表（管理员：全部；客户：自己品牌）
  // ============================================================

  async listCreditRequests(
    user: GeoUserCtx,
    query: { status?: string; page?: number; pageSize?: number },
  ): Promise<CreditRequestListResponse> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;

    const whereConditions = [];
    if (user.role === 'client') {
      if (!user.brandId) {
        return { items: [], total: 0, pendingCount: 0 };
      }
      whereConditions.push(eq(geoCreditRequests.brandId, user.brandId));
    }
    if (query.status) {
      whereConditions.push(eq(geoCreditRequests.status, query.status));
    }

    const whereClause = whereConditions.length > 0 ? and(...whereConditions) : undefined;

    const [totalRows, pendingRows, rawItems] = await Promise.all([
      this.db
        .select({ count: count() })
        .from(geoCreditRequests)
        .where(whereClause),
      this.db
        .select({ count: count() })
        .from(geoCreditRequests)
        .where(
          and(
            user.role === 'client' && user.brandId
              ? eq(geoCreditRequests.brandId, user.brandId)
              : undefined,
            eq(geoCreditRequests.status, 'pending'),
          ),
        ),
      this.db
        .select({
          id: geoCreditRequests.id,
          brandId: geoCreditRequests.brandId,
          brandName: geoBrands.name,
          package: geoCreditRequests.package,
          amount: geoCreditRequests.amount,
          status: geoCreditRequests.status,
          createdAt: geoCreditRequests.createdAt,
          processedAt: geoCreditRequests.processedAt,
          rejectReason: geoCreditRequests.rejectReason,
        })
        .from(geoCreditRequests)
        .leftJoin(geoBrands, eq(geoCreditRequests.brandId, geoBrands.id))
        .where(whereClause)
        .orderBy(desc(geoCreditRequests.createdAt))
        .limit(pageSize)
        .offset((page - 1) * pageSize),
    ]);

    const items: CreditRequestItem[] = rawItems.map((row: typeof rawItems[number]) => ({
      id: row.id,
      brandId: row.brandId ?? null,
      brandName: row.brandName ?? null,
      package: row.package ?? null,
      packageName: row.package
        ? CREDIT_PACKAGE_INFO[row.package as CreditPackage]?.name ?? null
        : null,
      amount: row.amount ?? null,
      status: (row.status ?? 'pending') as CreditRequestItem['status'],
      createdAt: row.createdAt ? new Date(row.createdAt).toISOString() : null,
      processedAt: row.processedAt ? new Date(row.processedAt).toISOString() : null,
      rejectReason: row.rejectReason ?? null,
    }));

    return {
      items,
      total: Number(totalRows[0]?.count ?? 0),
      pendingCount: Number(pendingRows[0]?.count ?? 0),
    };
  }

  // ============================================================
  //  审批通过：事务加算力 + 写流水 + 改状态
  // ============================================================

  async approveCreditRequest(
    user: GeoUserCtx,
    id: number,
  ): Promise<CreditRequestItem> {
    if (user.role !== 'admin') {
      throw new ForbiddenException('无权限操作');
    }

    const result = await this.db.transaction(async (tx) => {
      const [reqRow] = await tx
        .select()
        .from(geoCreditRequests)
        .where(eq(geoCreditRequests.id, id))
        .for('update')
        .limit(1);

      if (!reqRow) {
        throw new NotFoundException('申请不存在');
      }
      if (reqRow.status !== 'pending') {
        throw new BadRequestException('该申请已处理');
      }
      if (!reqRow.brandId) {
        throw new BadRequestException('申请缺少品牌信息');
      }

      const amount = Number(reqRow.amount ?? 0);
      if (amount <= 0) {
        throw new BadRequestException('充值金额无效');
      }

      let accountId: string | undefined;
      let currentBalance = 0;
      const [account] = await tx
        .select({
          id: geoCreditAccounts.id,
          balance: geoCreditAccounts.balance,
        })
        .from(geoCreditAccounts)
        .where(eq(geoCreditAccounts.brandId, reqRow.brandId))
        .limit(1);

      if (account) {
        accountId = account.id;
        currentBalance = Number(account.balance);
      } else {
        const [created] = await tx
          .insert(geoCreditAccounts)
          .values({
            brandId: reqRow.brandId,
            balance: '0',
            totalUsed: '0',
            totalRecharged: '0',
          })
          .returning({ id: geoCreditAccounts.id, balance: geoCreditAccounts.balance });
        accountId = created[0].id;
        currentBalance = 0;
      }

      const newBalance = currentBalance + amount;
      await tx
        .update(geoCreditAccounts)
        .set({
          balance: String(newBalance),
        })
        .where(eq(geoCreditAccounts.id, accountId));

      await tx.insert(geoCreditTransactions).values({
        brandId: reqRow.brandId,
        transactionType: 'recharge',
        changeAmount: String(amount),
        balanceAfter: String(newBalance),
        description: `充值申请 #${id} 到账`,
        operatorId: user.id,
      });

      const [updated] = await tx
        .update(geoCreditRequests)
        .set({
          status: 'approved',
          processedAt: new Date(),
          processedBy: user.id,
        })
        .where(eq(geoCreditRequests.id, id))
        .returning();

      return updated[0];
    });

    const [brandRow] = await this.db
      .select({ name: geoBrands.name })
      .from(geoBrands)
      .where(eq(geoBrands.id, result.brandId ?? ''))
      .limit(1);

    return {
      id: result.id,
      brandId: result.brandId ?? null,
      brandName: brandRow?.name ?? null,
      package: result.package ?? null,
      packageName: result.package
        ? CREDIT_PACKAGE_INFO[result.package as CreditPackage]?.name ?? null
        : null,
      amount: result.amount ?? null,
      status: (result.status ?? 'pending') as CreditRequestItem['status'],
      createdAt: result.createdAt ? new Date(result.createdAt).toISOString() : null,
      processedAt: result.processedAt ? new Date(result.processedAt).toISOString() : null,
      rejectReason: result.rejectReason ?? null,
    };
  }

  // ============================================================
  //  驳回申请
  // ============================================================

  async rejectCreditRequest(
    user: GeoUserCtx,
    id: number,
    reason?: string,
  ): Promise<CreditRequestItem> {
    if (user.role !== 'admin') {
      throw new ForbiddenException('无权限操作');
    }

    const [reqRow] = await this.db
      .select()
      .from(geoCreditRequests)
      .where(eq(geoCreditRequests.id, id))
      .limit(1);

    if (!reqRow) {
      throw new NotFoundException('申请不存在');
    }
    if (reqRow.status !== 'pending') {
      throw new BadRequestException('该申请已处理');
    }

    const [updated] = await this.db
      .update(geoCreditRequests)
      .set({
        status: 'rejected',
        processedAt: new Date(),
        processedBy: user.id,
        rejectReason: reason ?? null,
      })
      .where(eq(geoCreditRequests.id, id))
      .returning();

    const [brandRow] = await this.db
      .select({ name: geoBrands.name })
      .from(geoBrands)
      .where(eq(geoBrands.id, updated[0].brandId ?? ''))
      .limit(1);

    return {
      id: updated[0].id,
      brandId: updated[0].brandId ?? null,
      brandName: brandRow?.name ?? null,
      package: updated[0].package ?? null,
      packageName: updated[0].package
        ? CREDIT_PACKAGE_INFO[updated[0].package as CreditPackage]?.name ?? null
        : null,
      amount: updated[0].amount ?? null,
      status: (updated[0].status ?? 'pending') as CreditRequestItem['status'],
      createdAt: updated[0].createdAt ? new Date(updated[0].createdAt).toISOString() : null,
      processedAt: updated[0].processedAt ? new Date(updated[0].processedAt).toISOString() : null,
      rejectReason: updated[0].rejectReason ?? null,
    };
  }
}
