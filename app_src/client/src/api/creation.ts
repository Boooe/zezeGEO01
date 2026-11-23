import { axiosForBackend } from '@lark-apaas/client-toolkit/utils/getAxiosForBackend';
import type {
  CreationOverviewStats,
  RecentGenerationItem,
  Article,
  Material,
  VideoTask,
  CreationTaskItem,
  PublicationRecord,
  PagedResponse,
  GenerateArticleResponse,
  CreditPlan,
  CreditAccountDetail,
  CreditTransaction,
  UsageBreakdownResponse,
  ImportArticleScriptResponse,
  KeywordGroup,
  KeywordItem,
  SplitImagePromptsResponse,
  CreateImageTaskRequest,
  CreateVideoTaskRequest,
  CreationTaskDetail,
  CreationTaskListResponse,
  CreationTaskListQuery,
  GenerateCopyRequest,
  SplitImagePromptsRequest,
  GenerateCopyResponse,
} from '@shared/api.interface';

/* ---------------- 概览统计 ---------------- */

export function getOverviewStats(brandId?: string): Promise<CreationOverviewStats> {
  return axiosForBackend
    .get('/api/creation/stats/overview', { params: { brandId } })
    .then((r) => r.data);
}

/* ---------------- 最近生成 ---------------- */

export function getRecentGenerations(
  limit = 10,
  brandId?: string,
): Promise<RecentGenerationItem[]> {
  return axiosForBackend
    .get('/api/creation/recent', { params: { limit, brandId } })
    .then((r) => r.data);
}

/* ---------------- 文章 ---------------- */

export interface GenerateArticleRequest {
  brandId: string;
  keywords: string[];
  longtailKeywords?: string[];
  articleType: 'recommendation' | 'review' | 'story' | 'science' | 'qa';
  targetWordCount: number;
  count: number;
  autoCover?: boolean;
  useKnowledgeBase?: boolean;
  knowledgeCategories?: string[];
}

export interface ArticleListParams {
  page?: number;
  pageSize?: number;
  brandId?: string;
  articleType?: string;
  status?: string;
  keyword?: string;
  startDate?: string;
  endDate?: string;
}

export function listArticles(params: ArticleListParams): Promise<PagedResponse<Article>> {
  return axiosForBackend
    .get('/api/creation/articles', { params })
    .then((r) => r.data);
}

export function getArticle(id: string): Promise<Article> {
  return axiosForBackend.get(`/api/creation/articles/${id}`).then((r) => r.data);
}

export function generateArticles(body: GenerateArticleRequest): Promise<GenerateArticleResponse> {
  return axiosForBackend
    .post('/api/creation/articles/generate', body)
    .then((r) => r.data);
}

export function updateArticle(
  id: string,
  body: { title?: string; content?: string; status?: string },
): Promise<Article> {
  return axiosForBackend
    .patch(`/api/creation/articles/${id}`, body)
    .then((r) => r.data);
}

export function deleteArticle(id: string): Promise<void> {
  return axiosForBackend.delete(`/api/creation/articles/${id}`).then(() => undefined);
}

/* ---------------- 图片 ---------------- */

export interface GenerateImageRequest {
  brandId: string;
  imagePurpose: 'article_illustration' | 'cover' | 'product' | 'store_poster';
  prompt: string;
  style: 'realistic' | 'illustration' | 'minimal_ecommerce' | 'guochao' | 'tech' | 'fresh_natural';
  ratio?: string;
  count: number;
  saveToLibrary?: boolean;
}

export interface GenerateImageResponse {
  mode: 'ai' | 'upload';
  materialIds: string[];
  images: Array<{ id: string; url: string; prompt?: string }>;
  costCredits: number;
  message?: string;
}

export interface ImageListParams {
  page?: number;
  pageSize?: number;
  brandId?: string;
  style?: string;
  imagePurpose?: string;
  status?: string;
  keyword?: string;
}

export function listImages(params: ImageListParams): Promise<PagedResponse<Material>> {
  return axiosForBackend
    .get('/api/creation/images', { params })
    .then((r) => r.data);
}

export function generateImages(body: GenerateImageRequest): Promise<GenerateImageResponse> {
  return axiosForBackend
    .post('/api/creation/images/generate', body)
    .then((r) => r.data);
}

export function batchDeleteImages(body: { ids: string[] }): Promise<{ deleted: number }> {
  return axiosForBackend
    .post('/api/creation/images/batch-delete', body)
    .then((r) => r.data);
}

export function retryImage(id: string): Promise<GenerateImageResponse & { mode: string; message?: string }> {
  return axiosForBackend
    .post(`/api/creation/images/${id}/retry`)
    .then((r) => r.data);
}

export function publishImage(id: string, body: { platform: string; mediaLibrary?: string }): Promise<PublicationRecord> {
  return axiosForBackend
    .post(`/api/creation/images/${id}/publication`, body)
    .then((r) => r.data);
}

export function deleteImage(id: string): Promise<void> {
  return axiosForBackend.delete(`/api/creation/images/${id}`).then(() => undefined);
}

/* ---------------- 视频 ---------------- */

export interface GenerateVideoRequest {
  brandId: string;
  taskName: string;
  purpose?: string;
  script: string;
  duration: '15s' | '30s' | '60s';
  ratio: '9:16' | '16:9' | '1:1';
  style?: string;
  scriptText?: string;
  coverImage?: string;
}

export interface GenerateVideoResponse {
  mode: 'ai' | 'script_upload';
  taskId: string;
  costCredits: number;
  scriptContent?: string;
  storyboard?: Array<{
    sceneNumber: number;
    visualDescription: string;
    voiceover: string;
    subtitle: string;
    duration: string;
    imagePrompt?: string;
  }>;
  message?: string;
}

export interface VideoListParams {
  page?: number;
  pageSize?: number;
  brandId?: string;
  status?: string;
  purpose?: string;
  keyword?: string;
}

export function listVideos(params: VideoListParams): Promise<PagedResponse<VideoTask>> {
  return axiosForBackend
    .get('/api/creation/videos', { params })
    .then((r) => r.data);
}

export function importArticleScript(articleId: string): Promise<ImportArticleScriptResponse> {
  return axiosForBackend
    .get(`/api/creation/videos/import-article/${articleId}`)
    .then((r) => r.data);
}

export function retryVideo(id: string): Promise<VideoTask> {
  return axiosForBackend
    .post(`/api/creation/videos/${id}/retry`)
    .then((r) => r.data);
}

export function publishVideo(id: string, body: { platform: string; mediaLibrary?: string }): Promise<PublicationRecord> {
  return axiosForBackend
    .post(`/api/creation/videos/${id}/publication`, body)
    .then((r) => r.data);
}

export function getVideo(id: string): Promise<VideoTask> {
  return axiosForBackend.get(`/api/creation/videos/${id}`).then((r) => r.data);
}

export function generateVideo(body: GenerateVideoRequest): Promise<GenerateVideoResponse> {
  return axiosForBackend
    .post('/api/creation/videos/generate', body)
    .then((r) => r.data);
}

export function updateVideo(
  id: string,
  body: {
    taskName?: string;
    videoUrl?: string;
    videoCoverUrl?: string;
    status?: string;
    scriptContent?: string;
    storyboard?: string;
  },
): Promise<VideoTask> {
  return axiosForBackend
    .patch(`/api/creation/videos/${id}`, body)
    .then((r) => r.data);
}

export function deleteVideo(id: string): Promise<void> {
  return axiosForBackend.delete(`/api/creation/videos/${id}`).then(() => undefined);
}

/* ---------------- 任务队列 ---------------- */

export interface TaskListParams {
  page?: number;
  pageSize?: number;
  taskType?: 'article' | 'image' | 'video';
  status?: 'pending' | 'generating' | 'completed' | 'failed';
  brandId?: string;
  startDate?: string;
  endDate?: string;
}

export function listTasks(params: TaskListParams): Promise<PagedResponse<CreationTaskItem>> {
  return axiosForBackend
    .get('/api/creation/tasks', { params })
    .then((r) => r.data);
}

/* ---------------- 发布记录 ---------------- */

export interface CreatePublicationRequest {
  contentType: 'article' | 'image' | 'video';
  contentId: string;
  brandId: string;
  mediaLibrary: string;
  platform: string;
  scheduledAt?: string;
  publishUrl?: string;
  remark?: string;
}

export interface PublicationListParams {
  page?: number;
  pageSize?: number;
  contentType?: 'article' | 'image' | 'video';
  brandId?: string;
  status?: 'pending' | 'published' | 'failed';
  platform?: string;
}

export function listPublications(
  params: PublicationListParams,
): Promise<PagedResponse<PublicationRecord>> {
  return axiosForBackend
    .get('/api/creation/publications', { params })
    .then((r) => r.data);
}

export function createPublication(body: CreatePublicationRequest): Promise<PublicationRecord> {
  return axiosForBackend
    .post('/api/creation/publications', body)
    .then((r) => r.data);
}

export function updatePublication(
  id: string,
  body: {
    status?: string;
    publishUrl?: string;
    scheduledAt?: string;
    remark?: string;
  },
): Promise<PublicationRecord> {
  return axiosForBackend
    .patch(`/api/creation/publications/${id}`, body)
    .then((r) => r.data);
}

export function deletePublication(id: string): Promise<void> {
  return axiosForBackend.delete(`/api/creation/publications/${id}`).then(() => undefined);
}

// ============================================================
//  算力账户与流水（旧接口保留兼容）
// ============================================================

export interface CreditAccount {
  brandId: string;
  balance: number | string;
  totalUsed: number | string;
}

export function getCreditAccount(brandId: string): Promise<CreditAccount> {
  return axiosForBackend
    .get('/api/creation/credit/account', { params: { brandId } })
    .then((r) => r.data);
}

export function listCreditTransactions(params: {
  brandId: string;
  page?: number;
  pageSize?: number;
  transactionType?: string;
}): Promise<PagedResponse<CreditTransaction>> {
  return axiosForBackend
    .get('/api/creation/credit/transactions', { params })
    .then((r) => r.data);
}

// ============================================================
//  算力套餐
// ============================================================

export function listCreditPlans(): Promise<CreditPlan[]> {
  return axiosForBackend
    .get('/api/creation/credit/plans')
    .then((r) => r.data);
}

export function createCreditPlan(body: {
  planName: string;
  planCode: string;
  price: number;
  creditAmount: number;
  description?: string;
  isActive?: boolean;
  sortOrder?: number;
}): Promise<CreditPlan> {
  return axiosForBackend
    .post('/api/creation/credit/plans', body)
    .then((r) => r.data);
}

export function updateCreditPlan(
  id: string,
  body: {
    planName?: string;
    planCode?: string;
    price?: number;
    creditAmount?: number;
    description?: string;
    isActive?: boolean;
    sortOrder?: number;
  },
): Promise<CreditPlan> {
  return axiosForBackend
    .put(`/api/creation/credit/plans/${id}`, body)
    .then((r) => r.data);
}

export function deleteCreditPlan(id: string): Promise<void> {
  return axiosForBackend
    .delete(`/api/creation/credit/plans/${id}`)
    .then(() => undefined);
}

// ============================================================
//  算力账户（详细版 + 列表）
// ============================================================

export function getCreditAccountDetail(
  brandId: string,
): Promise<CreditAccountDetail> {
  return axiosForBackend
    .get('/api/creation/credit/account', { params: { brandId } })
    .then((r) => r.data);
}

export function listCreditAccounts(params: {
  page?: number;
  pageSize?: number;
  keyword?: string;
}): Promise<PagedResponse<CreditAccountDetail>> {
  return axiosForBackend
    .get('/api/creation/credit/accounts', { params })
    .then((r) => r.data);
}

// ============================================================
//  充值 / 激活套餐
// ============================================================

export function rechargeCredit(body: {
  brandId: string;
  amount: number;
  paymentAmount?: number;
  remark?: string;
  planId?: string;
}): Promise<{ success: boolean }> {
  return axiosForBackend
    .post('/api/creation/credit/recharge', body)
    .then((r) => r.data);
}

export function activatePlan(body: {
  brandId: string;
  planId: string;
}): Promise<{ success: boolean }> {
  return axiosForBackend
    .post('/api/creation/credit/activate-plan', body)
    .then((r) => r.data);
}

// ============================================================
//  使用明细
// ============================================================

export function getUsageBreakdown(params: {
  brandId: string;
  month?: string;
}): Promise<UsageBreakdownResponse> {
  return axiosForBackend
    .get('/api/creation/credit/usage-breakdown', { params })
    .then((r) => r.data);
}

// ============================================================
//  统一创作（/api/creation/unified）
// ============================================================

export function getKeywordGroups(brandId: string): Promise<KeywordGroup[]> {
  return axiosForBackend
    .get('/api/creation/unified/keyword-groups', { params: { brandId } })
    .then((r) => r.data);
}

export interface UnifiedKeywordsParams {
  groupId: string;
  type: 'core' | 'longtail';
  search?: string;
}

export function getKeywords(params: UnifiedKeywordsParams): Promise<KeywordItem[]> {
  return axiosForBackend
    .get('/api/creation/unified/keywords', { params })
    .then((r) => r.data);
}

export function generateCopy(body: GenerateCopyRequest): Promise<GenerateCopyResponse> {
  return axiosForBackend
    .post('/api/creation/unified/generate-copy', body)
    .then((r) => r.data);
}

export function splitImagePrompts(
  body: SplitImagePromptsRequest,
): Promise<SplitImagePromptsResponse> {
  return axiosForBackend
    .post('/api/creation/unified/split-image-prompts', body)
    .then((r) => r.data);
}

export function createUnifiedImageTask(
  body: CreateImageTaskRequest,
): Promise<CreationTaskDetail> {
  return axiosForBackend
    .post('/api/creation/unified/image', body)
    .then((r) => r.data);
}

export function createUnifiedVideoTask(
  body: CreateVideoTaskRequest,
): Promise<CreationTaskDetail> {
  return axiosForBackend
    .post('/api/creation/unified/video', body)
    .then((r) => r.data);
}

export function listUnifiedTasks(
  params: CreationTaskListQuery & { brandId?: string },
): Promise<CreationTaskListResponse> {
  return axiosForBackend
    .get('/api/creation/unified/tasks', { params })
    .then((r) => r.data);
}

export function getUnifiedTask(id: string): Promise<CreationTaskDetail> {
  return axiosForBackend.get(`/api/creation/unified/tasks/${id}`).then((r) => r.data);
}

export function deleteUnifiedTask(id: string): Promise<void> {
  return axiosForBackend
    .delete(`/api/creation/unified/tasks/${id}`)
    .then(() => undefined);
}

export function retryUnifiedTask(id: string): Promise<CreationTaskDetail> {
  return axiosForBackend
    .post(`/api/creation/unified/tasks/${id}/retry`)
    .then((r) => r.data);
}

export function pollUnifiedTask(id: string): Promise<CreationTaskDetail> {
  return axiosForBackend
    .post(`/api/creation/unified/tasks/${id}/poll`)
    .then((r) => r.data);
}
