import { Controller, Get, Inject, OnModuleInit } from '@nestjs/common';
import { DRIZZLE_DATABASE, type PostgresJsDatabase } from '@lark-apaas/fullstack-nestjs-core';
import { sql } from 'drizzle-orm';

import {
  geoBrands,
  geoKeywords,
  geoDiagnosisTasks,
  geoCreationTasks,
  geoIndustryNews,
} from '@server/database/schema';

interface PoolInfo {
  max: number;
  idleTimeoutSeconds: number;
  connectionTimeoutSeconds: number;
  source: string;
}

interface HealthDbResponse {
  maxConnections: string;
  total: number;
  byState: { state: string; count: number }[];
  idleOver3min: number;
  topIdle: { pid: number; state: string; idleFor: string; query: string }[];
  pool: PoolInfo;
  counts: {
    brands: number;
    keywords: number;
    diagnosisTasks: number;
    creationTasks: number;
    industryNews: number;
  };
  lastError: string | null;
  error?: string;
  raw?: string;
}

let lastPostgresError: string | null = null;

export function recordPostgresError(err: unknown): void {
  const msg = err instanceof Error ? err.message : String(err);
  lastPostgresError = msg.slice(0, 500);
}

@Controller('api/health')
export class HealthController implements OnModuleInit {
  private poolInfo: PoolInfo | null = null;

  constructor(@Inject(DRIZZLE_DATABASE) private readonly db: PostgresJsDatabase) {}

  async onModuleInit(): Promise<void> {
    try {
      await this.db.execute(sql`SET idle_in_transaction_session_timeout = '30s'`);
    } catch {
      // ignore - might not have permission, doesn't affect main functionality
    }
  }

  private getPoolInfo(): PoolInfo {
    if (this.poolInfo) return this.poolInfo;
    let max = 0;
    let idleTimeout = 0;
    let connectTimeout = 0;
    let source = 'unknown';
    try {
      const dbAny = this.db as unknown as Record<string, unknown>;
      const clientFn = dbAny['$client'] as unknown as { options?: Record<string, unknown> } | undefined;
      const opts = clientFn?.options as Record<string, unknown> | undefined;
      if (opts && typeof opts === 'object') {
        max = Number(opts.max ?? 0);
        idleTimeout = Number(opts.idle_timeout ?? 0);
        connectTimeout = Number(opts.connect_timeout ?? 0);
        source = '$client.options';
      }
    } catch {
      // ignore
    }
    this.poolInfo = { max, idleTimeoutSeconds: idleTimeout, connectionTimeoutSeconds: connectTimeout, source };
    return this.poolInfo;
  }

  @Get('db')
  async dbHealth(): Promise<HealthDbResponse> {
    try {
      const result = await this.db.execute(sql`
        SELECT
          (SELECT setting FROM pg_settings WHERE name = 'max_connections') AS max_connections,
          (SELECT count(*)::int FROM pg_stat_activity) AS total,
          (SELECT count(*)::int FROM pg_stat_activity WHERE state LIKE 'idle%' AND now() - state_change > interval '3 minutes') AS idle_over_3min
      `);
      const row = result[0] as { max_connections: string; total: number | string; idle_over_3min: number | string };

      const byStateRows = await this.db.execute(sql`
        SELECT state, count(*)::int AS count
        FROM pg_stat_activity
        GROUP BY state
        ORDER BY count DESC
      `) as unknown as { state: string | null; count: number | string }[];
      const byState = byStateRows.map((r: { state: string | null; count: number | string }) => ({
        state: r.state ?? '<null>',
        count: Number(r.count),
      }));

      const topIdleRows = await this.db.execute(sql`
        SELECT
          pid,
          state,
          now() - state_change AS idle_for,
          left(query, 60) AS query
        FROM pg_stat_activity
        WHERE state LIKE 'idle%'
        ORDER BY now() - state_change DESC
        LIMIT 10
      `) as unknown as { pid: number | string; state: string; idle_for: string; query: string }[];
      const topIdle = topIdleRows.map((r: { pid: number | string; state: string; idle_for: string; query: string }) => ({
        pid: Number(r.pid),
        state: r.state,
        idleFor: String(r.idle_for),
        query: r.query ?? '',
      }));

      const [brandsR, keywordsR, diagR, creationR, newsR] = await Promise.all([
        this.db.select({ count: sql<number>`count(*)` }).from(geoBrands),
        this.db.select({ count: sql<number>`count(*)` }).from(geoKeywords),
        this.db.select({ count: sql<number>`count(*)` }).from(geoDiagnosisTasks),
        this.db.select({ count: sql<number>`count(*)` }).from(geoCreationTasks),
        this.db.select({ count: sql<number>`count(*)` }).from(geoIndustryNews),
      ]);

      return {
        maxConnections: row.max_connections,
        total: Number(row.total),
        byState,
        idleOver3min: Number(row.idle_over_3min),
        topIdle,
        pool: this.getPoolInfo(),
        counts: {
          brands: Number(brandsR[0]?.count ?? 0),
          keywords: Number(keywordsR[0]?.count ?? 0),
          diagnosisTasks: Number(diagR[0]?.count ?? 0),
          creationTasks: Number(creationR[0]?.count ?? 0),
          industryNews: Number(newsR[0]?.count ?? 0),
        },
        lastError: lastPostgresError,
      };
    } catch (err) {
      const raw = err instanceof Error ? err.message : String(err);
      recordPostgresError(err);
      return {
        maxConnections: 'unknown',
        total: 0,
        byState: [],
        idleOver3min: 0,
        topIdle: [],
        pool: { max: 0, idleTimeoutSeconds: 0, connectionTimeoutSeconds: 0, source: 'error' },
        counts: { brands: 0, keywords: 0, diagnosisTasks: 0, creationTasks: 0, industryNews: 0 },
        lastError: lastPostgresError,
        error: 'cannot connect',
        raw,
      };
    }
  }
}
