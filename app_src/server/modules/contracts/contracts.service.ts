import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { Inject } from '@nestjs/common';
import { DRIZZLE_DATABASE, type PostgresJsDatabase } from '@lark-apaas/fullstack-nestjs-core';
import { eq, and, like, or, asc, sql, count, gte, lte } from 'drizzle-orm';

import { geoContracts, geoPayments, geoBrands, geoUsers } from '@server/database/schema';
import type { QueryContractDto } from './dto/query-contract.dto';
import type { CreateContractDto } from './dto/create-contract.dto';
import type { UpdateContractDto } from './dto/update-contract.dto';
import type { CreatePaymentDto } from './dto/create-payment.dto';
import type { RenewContractDto } from './dto/renew-contract.dto';
import type { Contract, Payment, PaymentStatus } from '@shared/api.interface';

interface GeoUserCtx {
  id: string;
  username: string;
  role: string;
  brandId: string | null;
}

function toISODate(d: string | null | undefined): string | null {
  if (!d) return null;
  return String(d);
}

function dateToStr(d: Date | string | undefined | null): string | undefined {
  if (!d) return undefined;
  if (d instanceof Date) return d.toISOString().slice(0, 10);
  return d;
}

function calcRemainingDays(serviceEnd: Date | string | null): number | null {
  if (!serviceEnd) return null;
  const end = new Date(serviceEnd);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);
  const diff = Math.ceil((end.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  return diff;
}

@Injectable()
export class ContractsService {
  constructor(
    @Inject(DRIZZLE_DATABASE) private readonly db: PostgresJsDatabase,
  ) {}

  private applyBrandFilter(
    conditions: ReturnType<typeof eq>[],
    user: GeoUserCtx,
    brandIdParam?: string,
  ): void {
    if (user.role === 'client' && user.brandId) {
      conditions.push(eq(geoContracts.brandId, user.brandId));
    } else if (brandIdParam) {
      conditions.push(eq(geoContracts.brandId, brandIdParam));
    }
  }

  async findAll(query: QueryContractDto, user: GeoUserCtx): Promise<{ items: Contract[]; total: number; page: number; pageSize: number }> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;

    const conditions: ReturnType<typeof eq>[] = [];
    this.applyBrandFilter(conditions, user, query.brandId);

    if (query.packageType) {
      conditions.push(eq(geoContracts.packageType, query.packageType));
    }
    if (query.paymentStatus) {
      conditions.push(eq(geoContracts.paymentStatus, query.paymentStatus));
    }

    const keywordConditions: ReturnType<typeof like>[] = [];
    if (query.keyword) {
      const kw = `%${query.keyword}%`;
      keywordConditions.push(like(geoContracts.customerName, kw));
      keywordConditions.push(like(geoContracts.contactPerson, kw));
      keywordConditions.push(like(geoContracts.contactPhone, kw));
    }

    const whereClause = keywordConditions.length > 0
      ? and(...conditions, or(...keywordConditions))
      : conditions.length > 0 ? and(...conditions) : undefined;

    const [totalResult, rows] = await Promise.all([
      this.db.select({ count: count() }).from(geoContracts).where(whereClause),
      this.db
        .select({
          contract: geoContracts,
          brandName: geoBrands.name,
          ownerName: geoUsers.displayName,
        })
        .from(geoContracts)
        .leftJoin(geoBrands, eq(geoContracts.brandId, geoBrands.id))
        .leftJoin(geoUsers, eq(geoContracts.ownerId, geoUsers.id))
        .where(whereClause)
        .orderBy(asc(geoContracts.serviceEnd))
        .limit(pageSize)
        .offset((page - 1) * pageSize),
    ]);

    const items: Contract[] = rows.map((row) => ({
      id: row.contract.id,
      brandId: row.contract.brandId,
      brandName: row.brandName ?? '',
      customerName: row.contract.customerName,
      industry: row.contract.industry,
      contactPerson: row.contract.contactPerson,
      contactPhone: row.contract.contactPhone,
      packageType: row.contract.packageType as Contract['packageType'],
      contractAmount: Number(row.contract.contractAmount),
      signDate: toISODate(row.contract.signDate),
      serviceStart: toISODate(row.contract.serviceStart),
      serviceEnd: toISODate(row.contract.serviceEnd),
      paymentStatus: row.contract.paymentStatus as Contract['paymentStatus'],
      ownerId: row.contract.ownerId,
      ownerName: row.ownerName,
      remainingDays: calcRemainingDays(row.contract.serviceEnd),
      remark: row.contract.remark,
      createdAt: row.contract.createdAt.toISOString(),
    }));

    return {
      items,
      total: Number(totalResult[0]?.count ?? 0),
      page,
      pageSize,
    };
  }

  async findOne(id: string, user: GeoUserCtx): Promise<{ contract: Contract; payments: Payment[] }> {
    const rows = await this.db
      .select({
        contract: geoContracts,
        brandName: geoBrands.name,
        ownerName: geoUsers.displayName,
      })
      .from(geoContracts)
      .leftJoin(geoBrands, eq(geoContracts.brandId, geoBrands.id))
      .leftJoin(geoUsers, eq(geoContracts.ownerId, geoUsers.id))
      .where(eq(geoContracts.id, id));

    if (rows.length === 0) {
      throw new NotFoundException('合同不存在');
    }

    const row = rows[0];
    const contractRow = row.contract;

    if (user.role === 'client' && user.brandId && contractRow.brandId !== user.brandId) {
      throw new ForbiddenException('无权访问该合同');
    }

    const paymentsRows = await this.db
      .select()
      .from(geoPayments)
      .where(eq(geoPayments.contractId, id))
      .orderBy(asc(geoPayments.paymentDate));

    const contract: Contract = {
      id: contractRow.id,
      brandId: contractRow.brandId,
      brandName: row.brandName ?? '',
      customerName: contractRow.customerName,
      industry: contractRow.industry,
      contactPerson: contractRow.contactPerson,
      contactPhone: contractRow.contactPhone,
      packageType: contractRow.packageType as Contract['packageType'],
      contractAmount: Number(contractRow.contractAmount),
      signDate: toISODate(contractRow.signDate),
      serviceStart: toISODate(contractRow.serviceStart),
      serviceEnd: toISODate(contractRow.serviceEnd),
      paymentStatus: contractRow.paymentStatus as Contract['paymentStatus'],
      ownerId: contractRow.ownerId,
      ownerName: row.ownerName,
      remainingDays: calcRemainingDays(contractRow.serviceEnd),
      remark: contractRow.remark,
      createdAt: contractRow.createdAt.toISOString(),
    };

    const payments: Payment[] = paymentsRows.map((p) => ({
      id: p.id,
      contractId: p.contractId,
      amount: Number(p.amount),
      paymentDate: toISODate(p.paymentDate),
      paymentMethod: p.paymentMethod,
      status: p.status,
      remark: p.remark,
    }));

    return { contract, payments };
  }

  async create(dto: CreateContractDto): Promise<Contract> {
    const [inserted] = await this.db
      .insert(geoContracts)
      .values({
        brandId: dto.brandId,
        customerName: dto.customerName,
        industry: dto.industry,
        contactPerson: dto.contactPerson,
        contactPhone: dto.contactPhone,
        packageType: dto.packageType,
        contractAmount: String(dto.contractAmount),
        signDate: dateToStr(dto.signDate),
        serviceStart: dateToStr(dto.serviceStart),
        serviceEnd: dateToStr(dto.serviceEnd),
        paymentStatus: dto.paymentStatus ?? 'unpaid',
        ownerId: dto.ownerId,
        remark: dto.remark,
      })
      .returning({ id: geoContracts.id });

    return this.findById(inserted.id);
  }

  private async findById(id: string): Promise<Contract> {
    const rows = await this.db
      .select({
        contract: geoContracts,
        brandName: geoBrands.name,
        ownerName: geoUsers.displayName,
      })
      .from(geoContracts)
      .leftJoin(geoBrands, eq(geoContracts.brandId, geoBrands.id))
      .leftJoin(geoUsers, eq(geoContracts.ownerId, geoUsers.id))
      .where(eq(geoContracts.id, id));

    if (rows.length === 0) {
      throw new NotFoundException('合同不存在');
    }

    const row = rows[0];
    return {
      id: row.contract.id,
      brandId: row.contract.brandId,
      brandName: row.brandName ?? '',
      customerName: row.contract.customerName,
      industry: row.contract.industry,
      contactPerson: row.contract.contactPerson,
      contactPhone: row.contract.contactPhone,
      packageType: row.contract.packageType as Contract['packageType'],
      contractAmount: Number(row.contract.contractAmount),
      signDate: toISODate(row.contract.signDate),
      serviceStart: toISODate(row.contract.serviceStart),
      serviceEnd: toISODate(row.contract.serviceEnd),
      paymentStatus: row.contract.paymentStatus as Contract['paymentStatus'],
      ownerId: row.contract.ownerId,
      ownerName: row.ownerName,
      remainingDays: calcRemainingDays(row.contract.serviceEnd),
      remark: row.contract.remark,
      createdAt: row.contract.createdAt.toISOString(),
    };
  }

  async update(id: string, dto: UpdateContractDto, user: GeoUserCtx): Promise<Contract> {
    const patch: Partial<typeof geoContracts.$inferInsert> = {};
    if (dto.brandId !== undefined) patch.brandId = dto.brandId;
    if (dto.customerName !== undefined) patch.customerName = dto.customerName;
    if (dto.industry !== undefined) patch.industry = dto.industry;
    if (dto.contactPerson !== undefined) patch.contactPerson = dto.contactPerson;
    if (dto.contactPhone !== undefined) patch.contactPhone = dto.contactPhone;
    if (dto.packageType !== undefined) patch.packageType = dto.packageType;
    if (dto.contractAmount !== undefined) patch.contractAmount = String(dto.contractAmount);
    if (dto.signDate !== undefined) patch.signDate = dateToStr(dto.signDate);
    if (dto.serviceStart !== undefined) patch.serviceStart = dateToStr(dto.serviceStart);
    if (dto.serviceEnd !== undefined) patch.serviceEnd = dateToStr(dto.serviceEnd);
    if (dto.paymentStatus !== undefined) patch.paymentStatus = dto.paymentStatus;
    if (dto.ownerId !== undefined) patch.ownerId = dto.ownerId;
    if (dto.remark !== undefined) patch.remark = dto.remark;

    if (Object.keys(patch).length === 0) {
      return this.findById(id);
    }

    const conditions: ReturnType<typeof eq>[] = [eq(geoContracts.id, id)];
    if (user.role === 'client' && user.brandId) {
      conditions.push(eq(geoContracts.brandId, user.brandId));
    }

    const updated = await this.db
      .update(geoContracts)
      .set(patch)
      .where(and(...conditions))
      .returning({ id: geoContracts.id });

    if (!updated) {
      throw new NotFoundException('合同不存在');
    }

    return this.findById(id);
  }

  async delete(id: string): Promise<void> {
    const deleted = await this.db
      .delete(geoContracts)
      .where(eq(geoContracts.id, id))
      .returning({ id: geoContracts.id });

    if (deleted.length === 0) {
      throw new NotFoundException('合同不存在');
    }
  }

  async addPayment(contractId: string, dto: CreatePaymentDto): Promise<Payment> {
    const contractRows = await this.db
      .select()
      .from(geoContracts)
      .where(eq(geoContracts.id, contractId));

    if (contractRows.length === 0) {
      throw new NotFoundException('合同不存在');
    }

    const [inserted] = await this.db
      .insert(geoPayments)
      .values({
        contractId,
        amount: String(dto.amount),
        paymentDate: dateToStr(dto.paymentDate),
        paymentMethod: dto.paymentMethod,
        status: dto.status ?? 'received',
        remark: dto.remark,
      })
      .returning({ id: geoPayments.id, contractId: geoPayments.contractId, amount: geoPayments.amount, paymentDate: geoPayments.paymentDate, paymentMethod: geoPayments.paymentMethod, status: geoPayments.status, remark: geoPayments.remark });

    await this.refreshPaymentStatus(contractId);

    return {
      id: inserted.id,
      contractId: inserted.contractId,
      amount: Number(inserted.amount),
      paymentDate: toISODate(inserted.paymentDate),
      paymentMethod: inserted.paymentMethod,
      status: inserted.status,
      remark: inserted.remark,
    };
  }

  private async refreshPaymentStatus(contractId: string): Promise<void> {
    const [contractRow] = await this.db
      .select({ contractAmount: geoContracts.contractAmount })
      .from(geoContracts)
      .where(eq(geoContracts.id, contractId));

    if (!contractRow) return;

    const [sumResult] = await this.db
      .select({ total: sql<number>`COALESCE(SUM(${geoPayments.amount}), 0)`.as('total') })
      .from(geoPayments)
      .where(eq(geoPayments.contractId, contractId));

    const totalPaid = Number(sumResult?.total ?? 0);
    const contractAmount = Number(contractRow.contractAmount);

    let newStatus: PaymentStatus;
    if (totalPaid <= 0) {
      newStatus = 'unpaid';
    } else if (totalPaid >= contractAmount) {
      newStatus = 'paid';
    } else {
      newStatus = 'partial';
    }

    await this.db
      .update(geoContracts)
      .set({ paymentStatus: newStatus })
      .where(eq(geoContracts.id, contractId));
  }

  async renew(id: string, dto: RenewContractDto, user: GeoUserCtx): Promise<Contract> {
    const contractRows = await this.db
      .select()
      .from(geoContracts)
      .where(eq(geoContracts.id, id));

    if (contractRows.length === 0) {
      throw new NotFoundException('合同不存在');
    }

    const contract = contractRows[0];

    if (user.role === 'client' && user.brandId && contract.brandId !== user.brandId) {
      throw new ForbiddenException('无权操作该合同');
    }

    const currentEnd = contract.serviceEnd;
    let newServiceEnd: string | undefined;
    if (currentEnd) {
      const endDate = new Date(currentEnd);
      endDate.setMonth(endDate.getMonth() + dto.extendMonths);
      newServiceEnd = endDate.toISOString().slice(0, 10);
    }

    const updatedRows = await this.db
      .update(geoContracts)
      .set({
        serviceEnd: newServiceEnd,
      })
      .where(eq(geoContracts.id, id))
      .returning({ id: geoContracts.id });

    if (updatedRows.length === 0) {
      throw new NotFoundException('合同不存在');
    }

    if (dto.amount > 0) {
      await this.db.insert(geoPayments).values({
        contractId: id,
        amount: String(dto.amount),
        paymentDate: sql`CURRENT_DATE`,
        status: 'received',
        remark: `续费 ${dto.extendMonths} 个月`,
      });
      await this.refreshPaymentStatus(id);
    }

    return this.findById(id);
  }

  async exportCSV(query: QueryContractDto, user: GeoUserCtx): Promise<string> {
    const page = 1;
    const pageSize = 10000;
    const result = await this.findAll({ ...query, page, pageSize }, user);

    const headers = [
      '客户名称',
      '行业',
      '联系人',
      '电话',
      '套餐',
      '合同金额',
      '签约日期',
      '服务开始',
      '服务结束',
      '收款状态',
      '剩余天数',
      '负责人',
    ];

    const rows = result.items.map((item: Contract) => [
      item.customerName,
      item.industry ?? '',
      item.contactPerson ?? '',
      item.contactPhone ?? '',
      item.packageType,
      String(item.contractAmount),
      item.signDate ?? '',
      item.serviceStart ?? '',
      item.serviceEnd ?? '',
      item.paymentStatus,
      item.remainingDays !== null ? String(item.remainingDays) : '',
      item.ownerName ?? '',
    ]);

    const csvLines = [headers.join(','), ...rows.map((r) => r.map((cell) => {
      if (cell.includes(',') || cell.includes('"') || cell.includes('\n')) {
        return `"${cell.replace(/"/g, '""')}"`;
      }
      return cell;
    }).join(','))];

    return '\uFEFF' + csvLines.join('\n');
  }

  async getStats(user: GeoUserCtx): Promise<{ activeCount: number; expiringIn30Days: number; totalAmount: number }> {
    const conditions: ReturnType<typeof eq>[] = [];
    if (user.role === 'client' && user.brandId) {
      conditions.push(eq(geoContracts.brandId, user.brandId));
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = today.toISOString().slice(0, 10);
    const in30Days = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);
    const in30DaysStr = in30Days.toISOString().slice(0, 10);

    const [activeResult, expiringResult, totalResult] = await Promise.all([
      this.db
        .select({ count: count() })
        .from(geoContracts)
        .where(
          and(
            ...conditions,
            gte(geoContracts.serviceEnd, todayStr),
          ),
        ),
      this.db
        .select({ count: count() })
        .from(geoContracts)
        .where(
          and(
            ...conditions,
            gte(geoContracts.serviceEnd, todayStr),
            lte(geoContracts.serviceEnd, in30DaysStr),
          ),
        ),
      this.db
        .select({ total: sql<number>`COALESCE(SUM(${geoContracts.contractAmount}), 0)`.as('total') })
        .from(geoContracts)
        .where(conditions.length > 0 ? and(...conditions) : undefined),
    ]);

    return {
      activeCount: Number(activeResult[0]?.count ?? 0),
      expiringIn30Days: Number(expiringResult[0]?.count ?? 0),
      totalAmount: Number(totalResult[0]?.total ?? 0),
    };
  }
}
