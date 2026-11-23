import { type QueryClient } from '@tanstack/react-query';
import { getCustomers } from '@client/src/api/customers';
import { getContracts } from '@client/src/api/contracts';
import { getLeads } from '@client/src/api/leads';
import { getReports } from '@client/src/api/reports';
import { getPlans } from '@client/src/api/admin';
import { logger } from '@lark-apaas/client-toolkit/logger';

interface PrefetchConfig {
  queryKey: unknown[];
  queryFn: () => Promise<unknown>;
  roles?: string[];
}

const DEFAULT_PAGE_SIZE = 10;

export const prefetchConfig: Record<string, PrefetchConfig> = {
  '/customers': {
    queryKey: ['customers', { page: 1, pageSize: DEFAULT_PAGE_SIZE }],
    queryFn: () => getCustomers({ page: 1, pageSize: DEFAULT_PAGE_SIZE }),
    roles: ['admin', 'operator'],
  },
  '/contracts': {
    queryKey: ['contracts', { page: 1, pageSize: DEFAULT_PAGE_SIZE }],
    queryFn: () => getContracts({ page: 1, pageSize: DEFAULT_PAGE_SIZE }),
    roles: ['admin', 'operator'],
  },
  '/leads': {
    queryKey: ['leads', 'list', { page: 1, pageSize: DEFAULT_PAGE_SIZE }],
    queryFn: () => getLeads({ page: 1, pageSize: DEFAULT_PAGE_SIZE }),
    roles: ['admin', 'operator'],
  },
  '/reports': {
    queryKey: ['reports', { page: 1, pageSize: DEFAULT_PAGE_SIZE }],
    queryFn: () => getReports({ page: 1, pageSize: DEFAULT_PAGE_SIZE }),
    roles: ['admin', 'operator'],
  },
  '/admin/plans': {
    queryKey: ['admin-plans', 1, DEFAULT_PAGE_SIZE],
    queryFn: () => getPlans({ page: 1, pageSize: DEFAULT_PAGE_SIZE }),
    roles: ['admin', 'operator'],
  },
};

export function prefetchRoute(client: QueryClient, path: string): void {
  const config = prefetchConfig[path];
  if (!config) return;
  const cached = client.getQueryData(config.queryKey);
  if (cached) {
    logger.debug('[prefetch] cache hit, skip:', String(path));
    return;
  }
  logger.debug('[prefetch] start fetching:', { path: path, arg1: 'key:', arg2: JSON.stringify(config.queryKey) });
  void client.prefetchQuery({
    queryKey: config.queryKey,
    queryFn: config.queryFn,
  }).then(() => {
    logger.debug('[prefetch] done:', String(path));
  }).catch((err: unknown) => {
    logger.debug('[prefetch] failed:', { path: path, err: err });
  });
}

export function canPrefetchRoute(path: string, role: string): boolean {
  const config = prefetchConfig[path];
  if (!config) return false;
  if (!config.roles) return true;
  return config.roles.includes(role);
}

const IDLE_PREFETCH_PATHS = [
  '/customers',
  '/contracts',
  '/leads',
  '/admin/plans',
];

export function warmupIdlePrefetch(client: QueryClient, role: string): void {
  const paths = IDLE_PREFETCH_PATHS.filter((p) => canPrefetchRoute(p, role));
  logger.debug('[prefetch] idle warmup scheduled, paths:', String(paths));
  let index = 0;

  function next(): void {
    if (index >= paths.length) {
      logger.debug('[prefetch] idle warmup all done');
      return;
    }
    const path = paths[index];
    index += 1;
    const config = prefetchConfig[path];
    if (!config) {
      next();
      return;
    }
    logger.debug('[prefetch] idle warming:', String(path));
    void client
      .prefetchQuery({
        queryKey: config.queryKey,
        queryFn: config.queryFn,
      })
      .catch(() => {
        logger.debug('[prefetch] idle warm failed:', String(path));
      })
      .finally(() => {
        if (typeof requestIdleCallback !== 'undefined') {
          requestIdleCallback(next, { timeout: 2000 });
        } else {
          setTimeout(next, 300);
        }
      });
  }

  if (typeof requestIdleCallback !== 'undefined') {
    requestIdleCallback(next, { timeout: 6000 });
  } else {
    setTimeout(next, 3000);
  }
}
