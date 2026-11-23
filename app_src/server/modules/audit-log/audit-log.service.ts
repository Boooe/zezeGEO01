import { Inject, Injectable, Logger } from '@nestjs/common';
import { DRIZZLE_DATABASE, type PostgresJsDatabase } from '@lark-apaas/fullstack-nestjs-core';
import { and, count, desc, eq, gte, ilike, lte, or } from 'drizzle-orm';
import { geoOperationLogs } from '@server/database/schema';
import type { OperationLog, OperationLogListResponse } from '@shared/api.interface';

interface LogParams {
  action: string;
  actor?: string;
  role?: string;
  target?: string;
  detail?: string;
  ip?: string;
}

@Injectable()
export class AuditLogService {
  private readonly logger = new Logger(AuditLogService.name);

  constructor(
    @Inject(DRIZZLE_DATABASE) private readonly db: PostgresJsDatabase,
  ) {}

  /**
   * Fire-and-forget 操作日志写入。
   * 异步执行、不阻塞调用方、吞掉所有异常。
   */
  log(params: LogParams): void {
    const {
      action,
      actor = 'system',
      role,
      target,
      detail,
      ip,
    } = params;

    setImmediate(() => {
      this.db
        .insert(geoOperationLogs)
        .values({ action, actor, role, target, detail, ip })
        .catch((error: unknown) => {
          // 写日志失败只记录 warn，不影响主业务
          this.logger.warn(
            `写入操作日志失败: action=${action}, actor=${actor}`,
            error instanceof Error ? error.stack : String(error),
          );
        });
    });
  }

  async list(query: {
    page: number;
    pageSize: number;
    keyword?: string;
    action?: string;
    role?: string;
    startDate?: string;
    endDate?: string;
  }): Promise<OperationLogListResponse> {
    const { page, pageSize, keyword, action, role, startDate, endDate } = query;

    // 强制 7 天窗口：即使传了更早的 startDate 也以 7 天为准
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const effectiveStart = startDate
      ? new Date(startDate) > sevenDaysAgo
        ? new Date(startDate)
        : sevenDaysAgo
      : sevenDaysAgo;

    const conditions = [gte(geoOperationLogs.createdAt, effectiveStart)];

    if (endDate) {
      conditions.push(lte(geoOperationLogs.createdAt, new Date(endDate)));
    }

    if (keyword) {
      const pattern = `%${keyword}%`;
      conditions.push(
        or(
          ilike(geoOperationLogs.actor, pattern),
          ilike(geoOperationLogs.target, pattern),
          ilike(geoOperationLogs.detail, pattern),
        ),
      );
    }

    if (action) {
      conditions.push(eq(geoOperationLogs.action, action));
    }

    if (role) {
      conditions.push(eq(geoOperationLogs.role, role));
    }

    const whereClause = conditions.length > 1
      ? and(...conditions)
      : conditions[0];

    const [totalResult, rows] = await Promise.all([
      this.db
        .select({ count: count() })
        .from(geoOperationLogs)
        .where(whereClause),
      this.db
        .select()
        .from(geoOperationLogs)
        .where(whereClause)
        .orderBy(desc(geoOperationLogs.createdAt))
        .limit(pageSize)
        .offset((page - 1) * pageSize),
    ]);

    const total = totalResult[0]?.count ?? 0;

    const items: OperationLog[] = rows.map((row) => ({
      id: row.id,
      actor: row.actor,
      role: row.role ?? null,
      action: row.action,
      target: row.target ?? null,
      detail: row.detail ?? null,
      ip: row.ip ?? null,
      createdAt: row.createdAt.toISOString(),
    }));

    return { items, total, page, pageSize };
  }
}
