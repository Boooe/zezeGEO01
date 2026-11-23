import { logger } from '@lark-apaas/client-toolkit/logger';

export interface RetryOptions {
  retries?: number;
  delay?: number;
}

const DEFAULT_RETRIES = 2;
const DEFAULT_DELAY = 2000;

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {},
): Promise<T> {
  const retries = options.retries ?? DEFAULT_RETRIES;
  const delay = options.delay ?? DEFAULT_DELAY;
  let lastError: unknown;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (attempt < retries) {
        logger.warn(`请求失败，${delay / 1000}s后重试（第${attempt + 1}/${retries}次）`);
        await sleep(delay);
      }
    }
  }

  throw lastError;
}

export function getFriendlyError(error: unknown): string {
  if (!error) return '数据加载失败，请稍后刷新';
  const err = error as { response?: { data?: { error?: { message?: string } } } };
  const msg = err.response?.data?.error?.message;
  if (msg && typeof msg === 'string') {
    if (msg.includes('timeout') || msg.includes('超时')) {
      return '加载较慢，请稍后刷新';
    }
    if (msg.includes('404') || msg.includes('Not Found')) {
      return '数据加载失败，请稍后刷新';
    }
  }
  return '数据加载中，请稍后刷新';
}
