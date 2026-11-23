import { axiosForBackend } from '@lark-apaas/client-toolkit/utils/getAxiosForBackend';
import type {
  Keyword,
  KeywordTask,
  KeywordResult,
  KeywordPoolItem,
  KeywordPoolItemWithOpportunity,
  KeywordGroup,
  InspirationKeyword,
  PagedResponse,
  Platform,
  AiDetectTask,
  AiDetectResult,
  AiDetectTaskSummary,
  AiDetectPlatform,
  AiDetectCreateRequest,
  AiDetectVisibilityResponse,
  AiDetectResultsStats,
  AiDetectPlatformsStatusResponse,
  KeywordIndexSource,
  KeywordIndexPeriod,
  KeywordIndexLogResponse,
  KeywordIndexListResponse,
  KeywordIndexBatchResponse,
  LongtailConfig,
  LongtailCombineResult,
  LongtailCombinePreview,
  SaveLongtailConfigRequest,
  BatchAddKeywordsRequest,
  GenerateLongtailRequest,
  GenerateLongtailResponse,
} from '@shared/api.interface';

/* ---------------- 关键词词库 ---------------- */

export interface GetKeywordsParams {
  page?: number;
  pageSize?: number;
  brandId?: string;
  keywordType?: string;
  keyword?: string;
  parentKeywordId?: string;
}

export async function getKeywords(
  params: GetKeywordsParams,
): Promise<PagedResponse<Keyword>> {
  const response = await axiosForBackend.get('/api/keywords', { params });
  return response.data;
}

export interface CreateKeywordRequest {
  keyword: string;
  keywordType: string;
  brandId: string;
  parentKeywordId?: string;
}

export async function createKeyword(
  body: CreateKeywordRequest,
): Promise<Keyword> {
  const response = await axiosForBackend.post('/api/keywords', body);
  return response.data;
}

export interface BatchImportKeywordsRequest {
  keywords: string[];
  keywordType: string;
  brandId: string;
  parentKeywordId?: string;
}

export async function batchImportKeywords(
  body: BatchImportKeywordsRequest,
): Promise<{ count: number }> {
  const response = await axiosForBackend.post('/api/keywords/batch', body);
  return response.data;
}

export interface UpdateKeywordRequest {
  keyword?: string;
  keywordType?: string;
  brandId?: string;
}

export async function updateKeyword(
  id: string,
  body: UpdateKeywordRequest,
): Promise<Keyword> {
  const response = await axiosForBackend.patch(`/api/keywords/${id}`, body);
  return response.data;
}

export async function deleteKeyword(id: string): Promise<void> {
  await axiosForBackend.delete(`/api/keywords/${id}`);
}

export async function toggleCoreKeyword(
  id: string,
  isCore: boolean,
): Promise<Keyword> {
  const response = await axiosForBackend.post(
    `/api/keywords/${id}/toggle-core`,
    { isCore },
  );
  return response.data;
}

export async function setParentKeyword(
  id: string,
  parentKeywordId: string | null,
): Promise<Keyword> {
  const response = await axiosForBackend.post(
    `/api/keywords/${id}/set-parent`,
    { parentKeywordId },
  );
  return response.data;
}

/* ---------------- 检测任务 ---------------- */

export interface GetTasksParams {
  page?: number;
  pageSize?: number;
  brandId?: string;
  status?: string;
}

export async function getKeywordTasks(
  params: GetTasksParams,
): Promise<PagedResponse<KeywordTask>> {
  const response = await axiosForBackend.get('/api/keywords/tasks', { params });
  return response.data;
}

export interface BatchCreateTasksRequest {
  brandId: string;
  keywordIds: string[];
  platforms: Platform[];
  city?: string;
}

export async function batchCreateTasks(
  body: BatchCreateTasksRequest,
): Promise<{ count: number }> {
  const response = await axiosForBackend.post(
    '/api/keywords/tasks/batch',
    body,
  );
  return response.data;
}

/* ---------------- 检测结果 / 报表 ---------------- */

export interface GetResultsParams {
  page?: number;
  pageSize?: number;
  brandId?: string;
  platform?: string;
  isHit?: string;
  keyword?: string;
  startDate?: string;
  endDate?: string;
}

export async function getKeywordResults(
  params: GetResultsParams,
): Promise<PagedResponse<KeywordResult>> {
  const response = await axiosForBackend.get('/api/keywords/results', {
    params,
  });
  return response.data;
}

export interface ResultsStats {
  total: number;
  hitCount: number;
  hitRate: number;
  platformCount: number;
}

export async function getKeywordResultsStats(params: {
  brandId?: string;
  platform?: string;
  isHit?: string;
  keyword?: string;
  startDate?: string;
  endDate?: string;
}): Promise<ResultsStats> {
  const response = await axiosForBackend.get(
    '/api/keywords/results/stats',
    { params },
  );
  return response.data;
}

export function getResultsExportUrl(params: { brandId?: string; startDate?: string; endDate?: string }): string {
  const qs = new URLSearchParams();
  if (params.brandId) qs.set('brandId', params.brandId);
  if (params.startDate) qs.set('startDate', params.startDate);
  if (params.endDate) qs.set('endDate', params.endDate);
  const qsStr = qs.toString();
  return `/api/keywords/results/export${qsStr ? `?${qsStr}` : ''}`;
}

export async function exportResults(params: { brandId?: string; startDate?: string; endDate?: string }): Promise<void> {
  const url = getResultsExportUrl(params);
  const response = await axiosForBackend.get(url, { responseType: 'blob' });
  const blob = new Blob([response.data], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const objUrl = URL.createObjectURL(blob);
  link.href = objUrl;
  link.setAttribute('download', `keyword-results-${Date.now()}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(objUrl);
}

/* ---------------- 品牌列表（下拉选项用） ---------------- */

export async function getBrandList(): Promise<
  Array<{ id: string; name: string; industry: string | null }>
> {
  const response = await axiosForBackend.get('/api/brands/options');
  return response.data.items ?? response.data ?? [];
}

/* ---------------- 关键词分组（下拉选项用） ---------------- */

export async function getKeywordGroups(
  brandId: string,
): Promise<KeywordGroup[]> {
  const response = await axiosForBackend.get(
    '/api/creation/unified/keyword-groups',
    { params: { brandId } },
  );
  return response.data;
}

/* ---------------- 词池 ---------------- */

export interface GetPoolParams {
  page?: number;
  pageSize?: number;
  brandId?: string;
  keywordType?: string;
  groupId?: string;
  source?: string;
  keyword?: string;
  sortBy?: 'opportunity' | 'default';
  highOpportunityOnly?: boolean;
}

export async function getKeywordPool(
  params: GetPoolParams,
): Promise<PagedResponse<KeywordPoolItemWithOpportunity>> {
  const response = await axiosForBackend.get('/api/keywords/pool', {
    params,
  });
  return response.data;
}

export interface AddPoolKeywordRequest {
  keyword: string;
  keywordType: 'core' | 'longtail';
  brandId: string;
  groupId?: string;
  source?: string;
}

export async function addPoolKeyword(
  body: AddPoolKeywordRequest,
): Promise<KeywordPoolItem> {
  const response = await axiosForBackend.post('/api/keywords/pool', body);
  return response.data;
}

export interface BatchImportPoolRequest {
  keywords: Array<{ keyword: string; keywordType: 'core' | 'longtail' }>;
  brandId: string;
  groupId?: string;
  source?: string;
}

export async function batchImportPool(
  body: BatchImportPoolRequest,
): Promise<{ added: number; skipped: number }> {
  const response = await axiosForBackend.post(
    '/api/keywords/pool/batch',
    body,
  );
  return response.data;
}

export async function movePoolToLibrary(id: string): Promise<void> {
  await axiosForBackend.post(`/api/keywords/pool/${id}/move-to-library`);
}

export async function batchMovePoolToLibrary(ids: string[]): Promise<void> {
  await axiosForBackend.post('/api/keywords/pool/batch-move', { ids });
}

export async function generateLongtail(
  data: GenerateLongtailRequest,
): Promise<GenerateLongtailResponse> {
  const response = await axiosForBackend.post(
    '/api/keywords/pool/generate-longtail',
    data,
  );
  return response.data;
}

export async function deletePoolItem(id: string): Promise<void> {
  await axiosForBackend.delete(`/api/keywords/pool/${id}`);
}

/* ---------------- 词灵感 ---------------- */

export interface GenerateInspirationRequest {
  seedKeyword: string;
  keywordType: 'core' | 'longtail';
  brandId: string;
  brandName?: string;
  count?: number;
  city?: string;
  districts?: string[];
  industry?: string;
  includeBrand?: boolean;
  includeQuestion?: boolean;
  includeLocal?: boolean;
}

export async function generateInspiration(
  body: GenerateInspirationRequest,
): Promise<{ items: InspirationKeyword[] }> {
  const response = await axiosForBackend.post(
    '/api/keywords/inspiration/generate',
    body,
  );
  return response.data;
}

export interface AddInspirationToPoolRequest {
  keywords: Array<{ keyword: string; keywordType: 'core' | 'longtail' }>;
  brandId: string;
  groupId?: string;
}

export async function addInspirationToPool(
  body: AddInspirationToPoolRequest,
): Promise<{ added: number; skipped: number }> {
  const response = await axiosForBackend.post(
    '/api/keywords/inspiration/add-to-pool',
    body,
  );
  return response.data;
}

/* ---------------- AI 检测任务 ---------------- */

export interface GetDetectTasksParams {
  page?: number;
  pageSize?: number;
  brandId?: string;
  status?: string;
}

export async function getDetectTasks(
  params: GetDetectTasksParams,
): Promise<PagedResponse<AiDetectTask>> {
  const response = await axiosForBackend.get('/api/keywords/detect/tasks', { params });
  return response.data;
}

export async function createDetectTask(
  body: AiDetectCreateRequest,
): Promise<AiDetectTask> {
  const response = await axiosForBackend.post('/api/keywords/detect/tasks', body);
  return response.data;
}

export async function runDetectTask(taskId: string): Promise<AiDetectTask> {
  const response = await axiosForBackend.post(`/api/keywords/detect/tasks/${taskId}/run`);
  return response.data;
}

export async function retryDetectTask(taskId: string): Promise<AiDetectTask> {
  const response = await axiosForBackend.post(`/api/keywords/detect/tasks/${taskId}/retry`);
  return response.data;
}

export async function getDetectTaskDetail(
  taskId: string,
): Promise<AiDetectTask & { summary: AiDetectTaskSummary }> {
  const response = await axiosForBackend.get(`/api/keywords/detect/tasks/${taskId}`);
  return response.data;
}

export interface GetDetectResultsParams {
  taskId: string;
  keyword?: string;
  platform?: AiDetectPlatform;
  page?: number;
  pageSize?: number;
}

export async function getDetectResults(
  params: GetDetectResultsParams,
): Promise<{ items: AiDetectResult[]; summary: AiDetectTaskSummary; total: number }> {
  const { taskId, ...rest } = params;
  const response = await axiosForBackend.get(`/api/keywords/detect/tasks/${taskId}/results`, { params: rest });
  return response.data;
}

export async function getKeywordVisibility(
  params: { brandId: string; keywords: string[] },
): Promise<AiDetectVisibilityResponse> {
  const response = await axiosForBackend.post('/api/keywords/detect/visibility', params);
  return response.data;
}

export async function runSingleDetect(
  params: { brandId: string; keyword: string; platforms: AiDetectPlatform[] },
): Promise<{ taskId: string }> {
  const response = await axiosForBackend.post('/api/keywords/detect/single', params);
  return response.data;
}

export async function getDetectPlatformsStatus(): Promise<AiDetectPlatformsStatusResponse> {
  const response = await axiosForBackend.get('/api/keywords/detect/platforms/status');
  return response.data;
}

/* ---------------- AI 检测结果报表 ---------------- */

export interface GetAiDetectResultsParams {
  brandId: string;
  platform?: string;
  keyword?: string;
  isMentioned?: boolean;
  taskId?: string;
  page?: number;
  pageSize?: number;
}

export async function getAiDetectResults(
  params: GetAiDetectResultsParams,
): Promise<PagedResponse<AiDetectResult>> {
  const response = await axiosForBackend.get('/api/keywords/detect/results', { params });
  return response.data;
}

export interface GetAiDetectResultsStatsParams {
  brandId: string;
  platform?: string;
  keyword?: string;
  isMentioned?: boolean;
}

export async function getAiDetectResultsStats(
  params: GetAiDetectResultsStatsParams,
): Promise<AiDetectResultsStats> {
  const response = await axiosForBackend.get('/api/keywords/detect/results/stats', { params });
  return response.data;
}

export async function getLegacyResultsCount(brandId: string): Promise<{ count: number }> {
  const response = await axiosForBackend.get('/api/keywords/detect/results/legacy-count', { params: { brandId } });
  return response.data;
}

export interface GetLegacyResultsParams {
  brandId: string;
  platform?: string;
  keyword?: string;
  page?: number;
  pageSize?: number;
}

export async function getLegacyResults(
  params: GetLegacyResultsParams,
): Promise<PagedResponse<KeywordResult>> {
  const response = await axiosForBackend.get('/api/keywords/detect/results/legacy', { params });
  return response.data;
}

/* ---------------- 指数截图登记 ---------------- */

export interface CreateKeywordIndexLogRequest {
  keywordId: string;
  keywordText: string;
  source: KeywordIndexSource;
  value: number;
  period: KeywordIndexPeriod;
  collectedAt: string;
  screenshotUrl: string;
  ocrText?: string;
  remark?: string;
}

export async function createKeywordIndexLog(
  body: CreateKeywordIndexLogRequest,
): Promise<KeywordIndexLogResponse> {
  const response = await axiosForBackend.post('/api/keywords/index-logs', body);
  return response.data;
}

export async function getKeywordIndexLogs(
  keywordId: string,
): Promise<KeywordIndexListResponse> {
  const response = await axiosForBackend.get('/api/keywords/index-logs', {
    params: { keywordId },
  });
  return response.data;
}

export async function getKeywordIndexLatestBatch(
  keywordIds: string[],
): Promise<KeywordIndexBatchResponse> {
  const response = await axiosForBackend.post(
    '/api/keywords/index-logs/latest',
    { keywordIds },
  );
  return response.data;
}

/* ---------------- 长尾词组合 ---------------- */

export interface GetLongtailConfigParams {
  brandId: string;
  groupId?: string;
  type: 'prefix' | 'suffix';
}

export async function getLongtailConfig(
  params: GetLongtailConfigParams,
): Promise<LongtailConfig | null> {
  const response = await axiosForBackend.get('/api/keywords/longtail/config', {
    params,
  });
  return response.data;
}

export async function saveLongtailConfig(
  body: SaveLongtailConfigRequest,
): Promise<LongtailConfig> {
  const response = await axiosForBackend.put(
    '/api/keywords/longtail/config',
    body,
  );
  return response.data;
}

export interface PreviewLongtailCombineRequest {
  brandId: string;
  groupId?: string | null;
  prefixWords: string[];
  suffixWords: string[];
}

export async function previewLongtailCombine(
  body: PreviewLongtailCombineRequest,
): Promise<LongtailCombinePreview> {
  const response = await axiosForBackend.post(
    '/api/keywords/longtail/preview',
    body,
  );
  return response.data;
}

export interface CombineLongtailRequest {
  brandId: string;
  groupId?: string | null;
  prefixWords: string[];
  suffixWords: string[];
}

export async function combineLongtail(
  body: CombineLongtailRequest,
): Promise<{ items: LongtailCombineResult[] }> {
  const response = await axiosForBackend.post(
    '/api/keywords/longtail/combine',
    body,
  );
  return response.data;
}

export async function batchAddKeywords(
  body: BatchAddKeywordsRequest,
): Promise<{ added: number; skipped: number }> {
  const response = await axiosForBackend.post(
    '/api/keywords/longtail/batch-add',
    body,
  );
  return response.data;
}
