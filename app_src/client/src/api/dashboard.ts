import { axiosForBackend } from '@lark-apaas/client-toolkit/utils/getAxiosForBackend';
import type {
  DashboardStats,
  HitRateTrend,
  PlatformHitDistribution,
  RiskRadar,
  BrandDashboardStats,
  BrandDailyTrend,
  IndustryNewsItem,
  AiPlatformStatItem,
  AiPlatformCoverage,
  HotKeywordRank,
  WorkbenchStats,
} from '@shared/api.interface';

export interface WorkbenchStatsParams {
  range: string;
  brandId?: string;
}

/** 首页统计卡片数据 */
export async function getDashboardStats(
  range?: string,
  brandId?: string,
): Promise<DashboardStats> {
  const params: Record<string, string> = {};
  if (range) params.range = range;
  if (brandId) params.brandId = brandId;
  const response = await axiosForBackend.get('/api/dashboard/stats', { params });
  return response.data;
}

/** 近6个月命中率趋势 */
export async function getHitRateTrend(
  brandId?: string,
): Promise<HitRateTrend[]> {
  const params: Record<string, string> = {};
  if (brandId) params.brandId = brandId;
  const response = await axiosForBackend.get('/api/dashboard/trend', { params });
  return response.data;
}

/** 各平台命中分布 */
export async function getPlatformDist(range?: string): Promise<PlatformHitDistribution[]> {
  const params: Record<string, string> = {};
  if (range) params.range = range;
  const response = await axiosForBackend.get('/api/dashboard/platform-distribution', { params });
  return response.data;
}

/** 风险雷达（临期客户 + 未命中核心词） */
export async function getRiskRadar(): Promise<RiskRadar> {
  const response = await axiosForBackend.get('/api/dashboard/risks');
  return response.data;
}

/** 品牌视角：数据总览统计 */
export async function getBrandStats(brandId?: string): Promise<BrandDashboardStats> {
  const params: Record<string, string> = {};
  if (brandId) params.brandId = brandId;
  const response = await axiosForBackend.get('/api/dashboard/brand-stats', { params });
  return response.data;
}

/** 品牌视角：近 N 天趋势 */
export async function getBrandTrend(days = 30, brandId?: string): Promise<BrandDailyTrend[]> {
  const params: Record<string, string | number> = { days };
  if (brandId) params.brandId = brandId;
  const response = await axiosForBackend.get('/api/dashboard/brand-trend', { params });
  return response.data;
}

/** 行业资讯列表 */
export async function getIndustryNews(): Promise<IndustryNewsItem[]> {
  const response = await axiosForBackend.get('/api/dashboard/industry-news');
  return response.data;
}

/** AI 平台日活统计 */
export async function getAiPlatformStats(): Promise<AiPlatformStatItem[]> {
  const response = await axiosForBackend.get('/api/dashboard/ai-platform-stats');
  return response.data;
}

/** 工作台数据总览（按时间范围） */
export async function getWorkbenchStats(
  params: WorkbenchStatsParams,
): Promise<WorkbenchStats> {
  const response = await axiosForBackend.get('/api/dashboard/workbench-stats', {
    params,
  });
  return response.data;
}

/** AI 平台关键词覆盖 */
export async function getAiPlatformCoverage(): Promise<AiPlatformCoverage[]> {
  const response = await axiosForBackend.get(
    '/api/dashboard/ai-platform-coverage',
  );
  return response.data;
}

/** 热门关键词排名 */
export async function getTopKeywordRanking(
  limit = 10,
): Promise<HotKeywordRank[]> {
  const response = await axiosForBackend.get(
    '/api/dashboard/hot-keywords',
    { params: { limit } },
  );
  return response.data;
}
