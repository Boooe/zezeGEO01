import { axiosForBackend } from '@lark-apaas/client-toolkit/utils/getAxiosForBackend';
import type {
  Article,
  ArticleBatch,
  ArticleType,
  ArticleStatus,
  CreditAccount,
  CreditTransaction,
  GenerateArticleRequest,
  GenerateArticleResponse,
  GenerateImageRequest,
  GenerateImageResponse,
  GenerateVideoScriptRequest,
  GenerateVideoScriptResponse,
  Material,
  MaterialGroup,
  MaterialType,
  PagedResponse,
  VideoTask,
  VideoTaskDetail,
  VideoServiceConfig,
  ImageServiceConfig,
  ContentOverviewStats,
  VideoDuration,
  VideoRatio,
  VideoTaskStatus,
} from '@shared/api.interface';

/* ---------------- 文章 ---------------- */

export interface GetArticlesParams {
  page?: number;
  pageSize?: number;
  brandId?: string;
  articleType?: string;
  status?: string;
  batchId?: string;
  keyword?: string;
  startDate?: string;
  endDate?: string;
}

export async function generateArticle(
  body: GenerateArticleRequest,
): Promise<GenerateArticleResponse> {
  const response = await axiosForBackend.post('/api/content/articles/generate', body);
  return response.data;
}

export async function getArticles(
  params: GetArticlesParams,
): Promise<PagedResponse<Article>> {
  const response = await axiosForBackend.get('/api/content/articles', { params });
  return response.data;
}

export async function getArticle(id: string): Promise<Article> {
  const response = await axiosForBackend.get(`/api/content/articles/${id}`);
  return response.data;
}

export interface UpdateArticleRequest {
  title?: string;
  content?: string;
  status?: ArticleStatus;
}

export async function updateArticle(
  id: string,
  body: UpdateArticleRequest,
): Promise<Article> {
  const response = await axiosForBackend.patch(`/api/content/articles/${id}`, body);
  return response.data;
}

export async function deleteArticle(id: string): Promise<void> {
  await axiosForBackend.delete(`/api/content/articles/${id}`);
}

export async function publishArticle(id: string): Promise<Article> {
  const response = await axiosForBackend.post(`/api/content/articles/${id}/publish`);
  return response.data;
}

/* ---------------- 批量任务 ---------------- */

export interface CreateBatchRequest {
  batchName: string;
  brandId: string;
  keywords: string[];
  articlesPerKeyword: number;
  articleType: ArticleType;
  targetWordCount: number;
}

export async function createBatch(
  body: CreateBatchRequest,
): Promise<{ batchId: string }> {
  const response = await axiosForBackend.post('/api/content/batches', body);
  return response.data;
}

export interface GetBatchesParams {
  page?: number;
  pageSize?: number;
  brandId?: string;
  status?: string;
  batchName?: string;
  articleType?: string;
  startDate?: string;
  endDate?: string;
}

export async function getBatches(
  params: GetBatchesParams,
): Promise<PagedResponse<ArticleBatch>> {
  const response = await axiosForBackend.get('/api/content/batches', { params });
  return response.data;
}

export async function getBatch(
  id: string,
): Promise<ArticleBatch & { articles: Article[] }> {
  const response = await axiosForBackend.get(`/api/content/batches/${id}`);
  return response.data;
}

export async function retryBatch(id: string): Promise<void> {
  await axiosForBackend.post(`/api/content/batches/${id}/retry`);
}

export async function deleteBatch(id: string): Promise<void> {
  await axiosForBackend.delete(`/api/content/batches/${id}`);
}

/* ---------------- 算力账户 ---------------- */

export async function getCreditAccount(): Promise<CreditAccount> {
  const response = await axiosForBackend.get('/api/content/credit-account');
  return response.data;
}

export interface GetCreditTransactionsParams {
  page?: number;
  pageSize?: number;
  brandId?: string;
  transactionType?: string;
}

export async function getCreditTransactions(
  params: GetCreditTransactionsParams,
): Promise<PagedResponse<CreditTransaction>> {
  const response = await axiosForBackend.get('/api/content/credit/transactions', { params });
  return response.data;
}

/* ---------------- 图片生成 ---------------- */

export async function generateImage(
  body: GenerateImageRequest,
): Promise<GenerateImageResponse> {
  const response = await axiosForBackend.post('/api/content/images/generate', body);
  return response.data;
}

/* ---------------- 素材 ---------------- */

export interface GetMaterialsParams {
  page?: number;
  pageSize?: number;
  brandId?: string;
  groupId?: string;
  materialType?: MaterialType;
  keyword?: string;
}

export async function getMaterials(
  params: GetMaterialsParams,
): Promise<PagedResponse<Material>> {
  const response = await axiosForBackend.get('/api/content/materials', { params });
  return response.data;
}

export interface GetMaterialGroupsParams {
  brandId?: string;
  groupType?: MaterialType;
}

export async function getMaterialGroups(
  params?: GetMaterialGroupsParams,
): Promise<MaterialGroup[]> {
  const response = await axiosForBackend.get('/api/content/material-groups', { params });
  return response.data;
}

export interface CreateMaterialGroupRequest {
  brandId: string;
  name: string;
  groupType: string;
}

export async function createMaterialGroup(
  body: CreateMaterialGroupRequest,
): Promise<MaterialGroup> {
  const response = await axiosForBackend.post('/api/content/material-groups', body);
  return response.data;
}

export async function deleteMaterial(id: string): Promise<void> {
  await axiosForBackend.delete(`/api/content/materials/${id}`);
}

export async function renameMaterial(id: string, name: string): Promise<Material> {
  const response = await axiosForBackend.patch(`/api/content/materials/${id}`, { name });
  return response.data;
}

export async function batchDeleteMaterials(ids: string[]): Promise<void> {
  await axiosForBackend.post('/api/content/materials/batch-delete', { ids });
}

/* ---------------- 视频脚本 ---------------- */

export async function generateVideoScript(
  body: GenerateVideoScriptRequest,
): Promise<GenerateVideoScriptResponse> {
  const response = await axiosForBackend.post('/api/content/video-script/generate', body);
  return response.data;
}

/* ---------------- 图片服务配置 ---------------- */

export async function getImageConfig(): Promise<ImageServiceConfig> {
  const response = await axiosForBackend.get('/api/content/image/config');
  return response.data;
}

export async function updateImageConfig(
  body: Partial<ImageServiceConfig>,
): Promise<ImageServiceConfig> {
  const response = await axiosForBackend.put('/api/content/image/config', body);
  return response.data;
}

export async function testImageConfig(): Promise<{ ok: boolean; message: string }> {
  const response = await axiosForBackend.post('/api/content/image/config/test');
  return response.data;
}

/* ---------------- 视频任务 ---------------- */

export interface CreateVideoTaskRequest {
  brandId: string;
  taskName: string;
  prompt: string;
  duration: VideoDuration;
  ratio: VideoRatio;
  coverImage?: string;
}

export interface GetVideoTasksParams {
  page?: number;
  pageSize?: number;
  brandId?: string;
  status?: VideoTaskStatus | '';
  keyword?: string;
}

export async function createVideoTask(
  body: CreateVideoTaskRequest,
): Promise<VideoTask> {
  const response = await axiosForBackend.post('/api/content/video/tasks', body);
  return response.data;
}

export async function getVideoTasks(
  params: GetVideoTasksParams,
): Promise<PagedResponse<VideoTask>> {
  const response = await axiosForBackend.get('/api/content/video/tasks', { params });
  return response.data;
}

export async function getVideoTask(id: string): Promise<VideoTaskDetail> {
  const response = await axiosForBackend.get(`/api/content/video/tasks/${id}`);
  return response.data;
}

export async function submitVideoTask(id: string): Promise<VideoTask> {
  const response = await axiosForBackend.post(
    `/api/content/video/tasks/${id}/submit`,
  );
  return response.data;
}

export async function pollVideoTask(id: string): Promise<VideoTask> {
  const response = await axiosForBackend.post(
    `/api/content/video/tasks/${id}/poll`,
  );
  return response.data;
}

export async function deleteVideoTask(id: string): Promise<void> {
  await axiosForBackend.delete(`/api/content/video/tasks/${id}`);
}

/* ---------------- 视频服务配置 ---------------- */

export async function getVideoConfig(): Promise<VideoServiceConfig> {
  const response = await axiosForBackend.get('/api/content/video/config');
  return response.data;
}

export async function updateVideoConfig(
  body: Partial<VideoServiceConfig>,
): Promise<VideoServiceConfig> {
  const response = await axiosForBackend.put('/api/content/video/config', body);
  return response.data;
}

export async function testVideoConfig(): Promise<{ ok: boolean; message: string }> {
  const response = await axiosForBackend.post('/api/content/video/config/test');
  return response.data;
}

/* ---------------- 内容产出统计 ---------------- */

export async function getContentOverviewStats(params?: {
  brandId?: string;
}): Promise<ContentOverviewStats> {
  const response = await axiosForBackend.get('/api/content/stats/overview', {
    params,
  });
  return response.data;
}
