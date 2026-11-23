export const USER_ROLES = ['admin', 'operator', 'client'] as const;
export type UserRole = string;
export const isUserRole = (v: string): v is UserRole =>
  (USER_ROLES as readonly string[]).includes(v);
export const USER_ROLE_LABELS: Record<UserRole, string> = {
  admin: '超级管理员',
  operator: '运营',
  client: '客户',
};

export const PERMISSIONS = [
  { key: 'customer.manage', label: '客户管理', group: '业务' },
  { key: 'keyword.manage', label: '关键词管理', group: '业务' },
  { key: 'creation.manage', label: '创作管理', group: '业务' },
  { key: 'publish.manage', label: '发布管理', group: '业务' },
  { key: 'media.view', label: '媒体商城浏览', group: '媒体商城' },
  { key: 'media.order', label: '媒体商城下单', group: '媒体商城' },
  { key: 'media.price', label: '媒体调价', group: '媒体商城' },
  { key: 'recharge.audit', label: '充值审批', group: '媒体商城' },
  { key: 'delivery.record', label: '投放记录', group: '业务' },
  { key: 'site.manage', label: '站点与账号', group: '系统' },
  { key: 'billing.manage', label: '计费与套餐', group: '系统' },
  { key: 'ai.model.config', label: 'AI 模型配置', group: '系统' },
  { key: 'system.member', label: '成员与角色', group: '系统' },
  { key: 'system.log', label: '操作日志', group: '系统' },
] as const;
export type PermissionKey = (typeof PERMISSIONS)[number]['key'];
export const PERMISSION_KEYS = PERMISSIONS.map((p) => p.key) as PermissionKey[];
export const isPermissionKey = (v: string): v is PermissionKey =>
  (PERMISSION_KEYS as readonly string[]).includes(v);
export const PERMISSION_LABELS: Record<PermissionKey, string> = Object.fromEntries(
  PERMISSIONS.map((p) => [p.key, p.label]),
) as Record<PermissionKey, string>;
export const PERMISSION_GROUPS: string[] = ['业务', '媒体商城', '系统'];

export interface GeoRole {
  id: string;
  code: string;
  name: string;
  permissions: string[];
  isSystem: boolean;
  sort: number;
  memberCount?: number;
  createdAt: string;
}

export interface RoleListResponse {
  items: GeoRole[];
  total: number;
}

export interface CreateRoleRequest {
  name: string;
  code?: string;
  permissions: string[];
  sort?: number;
}

export interface UpdateRoleRequest {
  name?: string;
  permissions?: string[];
  sort?: number;
}

export interface UpdateMemberRoleRequest {
  roleId: string;
}

export const MEMBER_STATUSES = ['active', 'disabled'] as const;
export type MemberStatus = (typeof MEMBER_STATUSES)[number];
export const isMemberStatus = (v: string): v is MemberStatus =>
  (MEMBER_STATUSES as readonly string[]).includes(v);
export const MEMBER_STATUS_LABELS: Record<MemberStatus, string> = {
  active: '已启用',
  disabled: '已禁用',
};

export interface GeoMember {
  id: string;
  name: string;
  username: string;
  role: string;
  roleId: string | null;
  roleName: string | null;
  status: 'active' | 'disabled';
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface MemberListRequest {
  page?: number;
  pageSize?: number;
  role?: string;
  keyword?: string;
  status?: string;
}

export interface MemberListResponse {
  items: GeoMember[];
  total: number;
  page: number;
  pageSize: number;
}

export interface CreateMemberRequest {
  name: string;
  username: string;
  role: string;
}

export interface UpdateMemberStatusRequest {
  status: 'active' | 'disabled';
}

export const LEAD_STAGES = [
  'pending',
  'contacted',
  'quoted',
  'signed',
  'shelved',
] as const;
export type LeadStage = (typeof LEAD_STAGES)[number];
export const LEAD_STAGE_LABELS: Record<LeadStage, string> = {
  pending: '待首触',
  contacted: '已沟通',
  quoted: '已报价',
  signed: '已签单',
  shelved: '已搁置',
};

export const INTENT_LEVELS = ['high', 'medium', 'low'] as const;
export type IntentLevel = (typeof INTENT_LEVELS)[number];
export const INTENT_LEVEL_LABELS: Record<IntentLevel, string> = {
  high: '高意向',
  medium: '中意向',
  low: '低意向',
};

export const PACKAGE_TYPES = ['basic', 'standard', 'premium'] as const;
export type PackageType = (typeof PACKAGE_TYPES)[number];
export const PACKAGE_TYPE_LABELS: Record<PackageType, string> = {
  basic: '基础版 9,800',
  standard: '标准版 19,800',
  premium: '旗舰版 39,800',
};
export const PACKAGE_PRICES: Record<PackageType, number> = {
  basic: 9800,
  standard: 19800,
  premium: 39800,
};

export const PAYMENT_STATUS = ['unpaid', 'partial', 'paid'] as const;
export type PaymentStatus = (typeof PAYMENT_STATUS)[number];
export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  unpaid: '未收款',
  partial: '部分收款',
  paid: '已收齐',
};

export const KEYWORD_TYPES = ['core', 'longtail'] as const;
export type KeywordType = (typeof KEYWORD_TYPES)[number];
export const KEYWORD_TYPE_LABELS: Record<KeywordType, string> = {
  core: '核心词',
  longtail: '长尾词',
};

export const PLATFORMS = ['baidu', '360', 'sogou', 'toutiao', 'douyin'] as const;
export type Platform = (typeof PLATFORMS)[number];
export const PLATFORM_LABELS: Record<Platform, string> = {
  baidu: '百度',
  '360': '360搜索',
  sogou: '搜狗',
  toutiao: '头条',
  douyin: '抖音',
};

export const TASK_STATUS = ['pending', 'running', 'completed', 'failed'] as const;
export type TaskStatus = (typeof TASK_STATUS)[number];
export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  pending: '待检测',
  running: '检测中',
  completed: '已完成',
  failed: '失败',
};

export interface GeoUser {
  id: string;
  username: string;
  role: UserRole;
  roleId: string | null;
  permissions: string[];
  displayName: string | null;
  brandId: string | null;
  status: string;
  lastLoginAt: string | null;
  createdAt: string;
}

export interface BrandOption {
  id: string;
  name: string;
  industry: string | null;
}

export interface BrandReadinessResponse {
  profileDone: boolean;
  keywordsDone: boolean;
  detectDone: boolean;
  publishDone: boolean;
  totalDone: number;
  totalItems: number;
}

export interface SeedSamplesBrandStat {
  brandId: string;
  brandName: string;
  totalCount: number;
  successCount: number;
  failedCount: number;
  taskId: string | null;
  failedReasons: string[];
}

export interface SeedSamplesResponse {
  brands: SeedSamplesBrandStat[];
  probedPlatforms: Array<{ platform: string; available: boolean; reason?: string }>;
}

export interface LoginRequest {
  username: string;
  password: string;
  rememberMe?: boolean;
}

export interface LoginResponse {
  user: GeoUser;
  sessionToken?: string;
}

export interface CurrentUserResponse {
  user: GeoUser | null;
  renewedToken?: string;
}

export interface Brand {
  id: string;
  name: string;
  companyName: string | null;
  industry: string | null;
  city: string | null;
  address: string | null;
  contactPerson: string | null;
  contactPhone: string | null;
  domain: string | null;
  status: string;
  remark: string | null;
  hitWords: string[];
}

export const INDUSTRIES = [
  'catering',
  'bakery',
  'maternity',
  'dental',
  'auto_repair',
  'decoration',
  'retail_specialty',
  'other',
] as const;
export type Industry = (typeof INDUSTRIES)[number];
export const INDUSTRY_LABELS: Record<Industry, string> = {
  catering: '餐饮',
  bakery: '烘焙',
  maternity: '母婴',
  dental: '口腔',
  auto_repair: '汽修',
  decoration: '装修',
  retail_specialty: '零售特产',
  other: '其他',
};

export const ACCOUNT_STATUSES = ['not_opened', 'active', 'disabled'] as const;
export type AccountStatus = (typeof ACCOUNT_STATUSES)[number];
export const ACCOUNT_STATUS_LABELS: Record<AccountStatus, string> = {
  not_opened: '未开通',
  active: '已开通',
  disabled: '已停用',
};

export interface CustomerItem {
  id: string;
  companyName: string | null;
  brandName: string;
  industry: string | null;
  contactPerson: string | null;
  contactPhone: string | null;
  packageType: PackageType | null;
  creditBalance: number;
  username: string | null;
  userId: string | null;
  accountStatus: AccountStatus;
  serviceEnd: string | null;
  createdAt: string;
  remark: string | null;
}

export type ActiveCustomerItem = ActiveCustomerRow;

export interface CustomerDetail extends Brand {
  creditBalance: number;
  packageType: PackageType | null;
  serviceEnd: string | null;
  users: Array<{
    id: string;
    username: string;
    role: UserRole;
    status: string;
    lastLoginAt: string | null;
    createdAt: string;
  }>;
}

export interface CreateCustomerRequest {
  companyName: string;
  brandName: string;
  industry?: string;
  contactPerson: string;
  contactPhone: string;
  address?: string;
  domain?: string;
  packageType: PackageType;
  initialCredit: number;
  remark?: string;
}

export interface CreateCustomerResponse {
  brandId: string;
  brandName: string;
  creditBalance: number;
}

export interface CreateBrandUserRequest {
  brandId: string;
  username: string;
  password: string;
  role: UserRole;
  displayName?: string;
}

export interface CreateBrandUserResponse {
  userId: string;
  username: string;
  role: UserRole;
  password: string;
}

export interface ResetUserPasswordResponse {
  userId: string;
  username: string;
  newPassword: string;
}

export interface UpdateUserRoleRequest {
  role: UserRole;
}

export interface AdjustCreditRequest {
  brandId: string;
  amount: number;
  reason: string;
}

export interface AdjustCreditResponse {
  brandId: string;
  balance: number;
}

export interface Lead {
  id: string;
  merchantName: string;
  industry: string | null;
  region: string | null;
  phone: string | null;
  source: string | null;
  intentLevel: IntentLevel;
  stage: LeadStage;
  ownerId: string | null;
  ownerName: string | null;
  brandId: string | null;
  brandName: string | null;
  nextFollowupDate: string | null;
  remark: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface LeadFollowup {
  id: string;
  leadId: string;
  content: string;
  followupType: string;
  operatorId: string | null;
  operatorName: string | null;
  nextFollowupDate: string | null;
  createdAt: string;
}

export interface Contract {
  id: string;
  brandId: string;
  brandName: string;
  customerName: string;
  industry: string | null;
  contactPerson: string | null;
  contactPhone: string | null;
  packageType: PackageType;
  contractAmount: number;
  signDate: string | null;
  serviceStart: string | null;
  serviceEnd: string | null;
  paymentStatus: PaymentStatus;
  ownerId: string | null;
  ownerName: string | null;
  remainingDays: number | null;
  remark: string | null;
  createdAt: string;
}

export interface Payment {
  id: string;
  contractId: string;
  amount: number;
  paymentDate: string | null;
  paymentMethod: string | null;
  status: string;
  remark: string | null;
}

export interface MonthlyReport {
  id: string;
  brandId: string;
  brandName: string;
  reportMonth: string;
  includedCount: number;
  prevIncludedCount: number;
  improvementCount: number;
  contentOutput: number;
  monthlyCreditUsed: number;
  notes: string | null;
  isSent: boolean;
  sentAt: string | null;
}

export interface ReportExportResponse {
  downloadUrl: string;
}

export interface Keyword {
  id: string;
  brandId: string;
  brandName: string;
  keyword: string;
  keywordType: KeywordType;
  isExample: boolean;
  parentKeywordId: string | null;
  parentKeyword: string | null;
  createdAt: string;
}

export interface KeywordTask {
  id: string;
  keywordId: string;
  keyword: string;
  brandId: string;
  brandName: string;
  platform: Platform;
  city: string | null;
  status: TaskStatus;
  isExample: boolean;
  createdAt: string;
}

export interface KeywordResult {
  id: string;
  taskId: string;
  keywordId: string;
  keyword: string;
  brandId: string;
  brandName: string;
  platform: Platform;
  city: string | null;
  isHit: boolean;
  position: number | null;
  snippet: string | null;
  url: string | null;
  error: string | null;
  detectedAt: string | null;
  isExample: boolean;
}

export interface DashboardStats {
  pendingFollowups: number;
  overdueCount: number;
  activeCustomers: number;
  expiringIn30Days: number;
  keywordHitRate: number;
  keywordTotal: number;
  activeCustomerList: ActiveCustomerRow[];
}

export interface ActiveCustomerRow {
  brandId: string;
  brandName: string;
  packageType: string;
  monthPublications: number;
  kpiTarget: number | null;
  kpiHitRate: number | null;
  status: 'active' | 'expiring' | 'expired';
}

export interface HitRateTrend {
  month: string;
  rate: number;
}

export interface PlatformHitDistribution {
  platform: string;
  hit: number;
  total: number;
}

export interface RiskRadar {
  expiringCustomers: Array<{ id: string; name: string; daysLeft: number }>;
  missedKeywords: Array<{ id: string; keyword: string; platform: string }>;
}

export interface BrandDashboardStats {
  keywordCount: number;
  creationTaskCount: number;
  inProgressCreationCount: number;
  publicationCount: number;
  creditBalance: number;
  keywordHitRate: number;
  pendingDiagnosisCount: number;
  monthArticleCount: number;
  monthImageCount: number;
  monthVideoCount: number;
  monthPublicationCount: number;
  monthSubmissionCount: number;
  monthSubmissionIndexedCount: number;
}

export interface BrandDailyTrend {
  date: string;
  keywordCount: number;
  creationCount: number;
  publicationCount: number;
}

export interface IndustryNewsItem {
  id: string;
  title: string;
  summary: string;
  source: string;
  newsDate: string;
}

export interface AiPlatformStatItem {
  id: string;
  platformName: string;
  dauMillion: number;
}

export interface PagedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  demoCount?: number;
}

export interface OperationLog {
  id: string;
  actor: string;
  role: string | null;
  action: string;
  target: string | null;
  detail: string | null;
  ip: string | null;
  createdAt: string;
}

export interface OperationLogListRequest {
  page?: number;
  pageSize?: number;
  keyword?: string;
  action?: string;
  role?: string;
  startDate?: string;
  endDate?: string;
}

export interface OperationLogListResponse {
  items: OperationLog[];
  total: number;
  page: number;
  pageSize: number;
}

export const ARTICLE_TYPES = [
  'recommendation',
  'review',
  'story',
  'science',
  'qa',
] as const;
export type ArticleType = (typeof ARTICLE_TYPES)[number];
export const ARTICLE_TYPE_LABELS: Record<ArticleType, string> = {
  recommendation: '排行推荐类',
  review: '评测对比类',
  story: '创意故事类',
  science: '科普解读类',
  qa: '问答答疑类',
};

export const ARTICLE_STATUS = ['draft', 'generating', 'published', 'failed'] as const;
export type ArticleStatus = (typeof ARTICLE_STATUS)[number];
export const ARTICLE_STATUS_LABELS: Record<ArticleStatus, string> = {
  draft: '草稿',
  generating: '生成中',
  published: '已发布',
  failed: '生成失败',
};

export const BATCH_STATUS = [
  'pending',
  'generating',
  'completed',
  'partial_failed',
  'failed',
] as const;
export type BatchStatus = (typeof BATCH_STATUS)[number];
export const BATCH_STATUS_LABELS: Record<BatchStatus, string> = {
  pending: '排队中',
  generating: '生成中',
  completed: '已完成',
  partial_failed: '部分失败',
  failed: '失败',
};

export const MATERIAL_TYPES = ['image', 'video', 'document'] as const;
export type MaterialType = (typeof MATERIAL_TYPES)[number];
export const MATERIAL_TYPE_LABELS: Record<MaterialType, string> = {
  image: '图片',
  video: '视频',
  document: '文档',
};

export const MATERIAL_STATUS = [
  'success',
  'failed',
  'generating',
] as const;
export type MaterialStatus = (typeof MATERIAL_STATUS)[number];
export const isMaterialStatus = (v: string): v is MaterialStatus =>
  (MATERIAL_STATUS as readonly string[]).includes(v);
export const MATERIAL_STATUS_LABELS: Record<MaterialStatus, string> = {
  success: '已生成',
  failed: '生成失败',
  generating: '生成中',
};

export const IMAGE_STYLES = [
  'realistic',
  'illustration',
  'minimal_ecommerce',
  'guochao',
  'tech',
  'fresh_natural',
] as const;
export type ImageStyle = (typeof IMAGE_STYLES)[number];
export const isImageStyle = (v: string): v is ImageStyle =>
  (IMAGE_STYLES as readonly string[]).includes(v);
export const IMAGE_STYLE_LABELS: Record<ImageStyle, string> = {
  realistic: '写实摄影',
  illustration: '插画',
  minimal_ecommerce: '极简电商风',
  guochao: '国潮',
  tech: '科技感',
  fresh_natural: '清新自然',
};

export const IMAGE_PURPOSES = [
  'article_illustration',
  'cover',
  'product',
  'store_poster',
] as const;
export type ImagePurpose = (typeof IMAGE_PURPOSES)[number];
export const isImagePurpose = (v: string): v is ImagePurpose =>
  (IMAGE_PURPOSES as readonly string[]).includes(v);
export const IMAGE_PURPOSE_LABELS: Record<ImagePurpose, string> = {
  article_illustration: '文章配图',
  cover: '封面图',
  product: '产品场景图',
  store_poster: '门店海报',
};

export const CREDIT_TX_TYPES = [
  'manual_recharge',
  'recharge',
  'plan_grant',
  'article_generate',
  'image_generate',
  'video_script',
  'video_generate',
  'adjustment',
  'refund',
] as const;
export type CreditTxType = (typeof CREDIT_TX_TYPES)[number];
export const isCreditTxType = (v: string): v is CreditTxType =>
  (CREDIT_TX_TYPES as readonly string[]).includes(v);
export const CREDIT_TX_TYPE_LABELS: Record<CreditTxType, string> = {
  manual_recharge: '手工充值',
  recharge: '续费充值',
  plan_grant: '套餐赠送',
  article_generate: '文章生成',
  image_generate: '图片生成',
  video_script: '视频脚本',
  video_generate: '视频生成',
  adjustment: '调整',
  refund: '退款',
};

// ---------- 视频任务 ----------

export const VIDEO_TASK_STATUSES = [
  'pending',
  'generating',
  'completed',
  'failed',
] as const;
export type VideoTaskStatus = (typeof VIDEO_TASK_STATUSES)[number];
export const isVideoTaskStatus = (v: string): v is VideoTaskStatus =>
  (VIDEO_TASK_STATUSES as readonly string[]).includes(v);
export const VIDEO_TASK_STATUS_LABELS: Record<VideoTaskStatus, string> = {
  pending: '排队中',
  generating: '生成中',
  completed: '已完成',
  failed: '失败',
};

export const VIDEO_DURATIONS = ['15s', '30s', '60s'] as const;
export type VideoDuration = (typeof VIDEO_DURATIONS)[number];
export const VIDEO_DURATION_LABELS: Record<VideoDuration, string> = {
  '15s': '15秒',
  '30s': '30秒',
  '60s': '60秒',
};

export const VIDEO_RATIOS = ['9:16', '16:9', '1:1'] as const;
export type VideoRatio = (typeof VIDEO_RATIOS)[number];
export const VIDEO_RATIO_LABELS: Record<VideoRatio, string> = {
  '9:16': '竖屏 9:16',
  '16:9': '横屏 16:9',
  '1:1': '方形 1:1',
};

export const VIDEO_PURPOSES = [
  'store_intro',
  'product_show',
  'knowledge',
] as const;
export type VideoPurpose = (typeof VIDEO_PURPOSES)[number];
export const isVideoPurpose = (v: string): v is VideoPurpose =>
  (VIDEO_PURPOSES as readonly string[]).includes(v);
export const VIDEO_PURPOSE_LABELS: Record<VideoPurpose, string> = {
  store_intro: '门店介绍',
  product_show: '产品展示',
  knowledge: '口播科普',
};

export const VIDEO_STYLES = [
  'realistic',
  'cartoon',
  'tech',
  'fresh',
  'guochao',
] as const;
export type VideoStyle = (typeof VIDEO_STYLES)[number];
export const isVideoStyle = (v: string): v is VideoStyle =>
  (VIDEO_STYLES as readonly string[]).includes(v);
export const VIDEO_STYLE_LABELS: Record<VideoStyle, string> = {
  realistic: '写实',
  cartoon: '卡通',
  tech: '科技感',
  fresh: '清新',
  guochao: '国潮',
};

export interface VideoTask {
  id: string;
  brandId: string;
  brandName: string;
  taskName: string;
  prompt: string;
  topic?: string;
  duration: VideoDuration;
  ratio: VideoRatio;
  coverImage: string | null;
  status: VideoTaskStatus;
  videoUrl: string | null;
  error: string | null;
  costCredits: number;
  creatorId: string;
  creatorName: string | null;
  createdAt: string;
  updatedAt: string;
  purpose: VideoPurpose | null;
  style: VideoStyle | null;
  scriptText: string | null;
};

export interface VideoTaskDetail extends VideoTask {
  callbackUrl?: string | null;
  externalTaskId?: string | null;
  scriptContent?: string;
  storyboard?: string;
  videoCoverUrl?: string | null;
}

export interface VideoServiceConfig {
  id?: string;
  apiUrl: string;
  apiKey: string;
  modelName?: string;
  model?: string;
  callbackUrl?: string;
  isConfigured?: boolean;
  status?: string;
}

export interface ImageServiceConfig {
  id?: string;
  apiUrl: string;
  apiKey: string;
  modelName?: string;
  model?: string;
  isConfigured?: boolean;
  status?: string;
}

export interface SubmitVideoTaskResult {
  taskId: string;
  externalTaskId: string;
  status: VideoTaskStatus;
}

// ---------- 内容产出统计 ----------

export interface ContentOverviewStats {
  articleCount: number;
  imageCount: number;
  videoCount: number;
  creditUsed: number;
}

export interface Article {
  id: string;
  brandId: string;
  brandName: string;
  title: string;
  content: string;
  articleType: ArticleType;
  wordCount: number;
  keywords: string[];
  longtailKeywords: string[];
  status: ArticleStatus;
  batchId: string | null;
  coverImage: string | null;
  costCredits: number;
  creatorId: string;
  creatorName: string | null;
  error: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ArticleBatch {
  id: string;
  brandId: string;
  brandName: string;
  batchName: string;
  articleType: ArticleType;
  targetWordCount: number;
  totalCount: number;
  successCount: number;
  failedCount: number;
  status: BatchStatus;
  totalCost: number;
  keywords: string[];
  creatorId: string;
  creatorName: string | null;
  error: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface GenerateArticleRequest {
  brandId: string;
  keywords: string[];
  longtailKeywords: string[];
  articleType: ArticleType;
  targetWordCount: number;
  count: number;
  useKnowledgeBase: boolean;
  autoCover: boolean;
}

export interface GenerateArticleResponse {
  articleIds: string[];
  batchId?: string;
}

export interface Material {
  id: string;
  brandId: string | null;
  groupId: string | null;
  materialType: MaterialType;
  name: string;
  fileUrl: string | null;
  fileSize: number;
  mimeType: string | null;
  width: number | null;
  height: number | null;
  source: string;
  sourceId: string | null;
  creatorId: string;
  creatorName: string | null;
  createdAt: string;
  purpose: ImagePurpose | null;
  imageStyle: ImageStyle | null;
  promptText: string | null;
  status: MaterialStatus;
}

export interface MaterialGroup {
  id: string;
  brandId: string;
  name: string;
  groupType: MaterialType;
}

export interface MaterialUsageStats {
  totalCount: number;
  totalSize: number;
  imageCount: number;
  videoCount: number;
  documentCount: number;
}

export interface GenerateImageRequest {
  brandId: string;
  imagePurpose: ImagePurpose;
  prompt: string;
  style: ImageStyle;
  ratio: string;
  count: number;
  saveToLibrary: boolean;
}

export interface ImageListQuery {
  page?: number;
  pageSize?: number;
  brandId?: string;
  imagePurpose?: ImagePurpose;
  style?: ImageStyle;
  status?: MaterialStatus;
  keyword?: string;
}

export interface GenerateImageResponse {
  materialIds: string[];
  images: Array<{ id: string; url: string }>;
  costCredits: number;
}

export interface ImportArticleScriptResponse {
  title: string;
  content: string;
}

export interface CreditPlan {
  id: string;
  planName: string;
  planCode: string;
  price: number;
  creditAmount: number;
  description: string | null;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
}

export interface CreditAccount {
  brandId: string;
  balance: number;
  totalUsed: number;
}

export interface CreditAccountDetail {
  id: string;
  brandId: string;
  brandName: string;
  balance: number;
  totalUsed: number;
  totalRecharged: number;
  currentPlanId: string | null;
  currentPlanName: string | null;
  dailyPublishLimit: number;
  planExpiresAt: string | null;
  activeModelName: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface UsageBreakdownItem {
  transactionType: string;
  typeLabel: string;
  totalAmount: number;
  count: number;
}

export interface UsageBreakdownResponse {
  month: string;
  items: UsageBreakdownItem[];
  totalUsed: number;
}

export interface CreditTransaction {
  id: string;
  brandId: string;
  changeAmount: number;
  balanceAfter: number;
  transactionType: CreditTxType;
  relatedType: string | null;
  relatedId: string | null;
  description: string | null;
  createdAt: string;
}

export interface VideoScriptScene {
  sceneNumber: number;
  visualDescription: string;
  voiceover: string;
  subtitle: string;
  duration: string;
  imagePrompt: string;
}

export interface VideoScript {
  id: string;
  brandId: string;
  hook: string;
  scenes: VideoScriptScene[];
  totalDuration: string;
  costCredits: number;
}

export interface GenerateVideoScriptRequest {
  brandId: string;
  coreKeyword: string;
  purpose: string;
}

export interface GenerateVideoScriptResponse {
  hook: string;
  scenes: VideoScriptScene[];
  totalDuration: string;
  costCredits: number;
}

/* ---------------- AI 创作中心 ---------------- */

export interface CreationOverviewStats {
  monthArticleCount: number;
  monthImageCount: number;
  monthVideoCount: number;
  monthCreditUsed: number;
  pendingReviewCount: number;
  inProgressCount: number;
}

export const RECENT_ITEM_TYPES = ['article', 'image', 'video'] as const;
export type RecentItemType = (typeof RECENT_ITEM_TYPES)[number];
export const RECENT_ITEM_TYPE_LABELS: Record<RecentItemType, string> = {
  article: '文章',
  image: '图片',
  video: '视频',
};

export interface RecentGenerationItem {
  id: string;
  type: RecentItemType;
  title: string;
  brandId: string;
  brandName: string;
  status: string;
  createdAt: string;
  thumbnail?: string | null;
}

/* ---------------- 发布记录 ---------------- */

export const PUBLICATION_CONTENT_TYPES = ['article', 'image', 'video'] as const;
export type PublicationContentType = (typeof PUBLICATION_CONTENT_TYPES)[number];
export const PUBLICATION_CONTENT_TYPE_LABELS: Record<PublicationContentType, string> = {
  article: '文章',
  image: '图片',
  video: '视频',
};

export const PUBLICATION_PLATFORMS = [
  'douyin',
  'xiaohongshu',
  'wechat_mp',
  'video_channel',
  'weibo',
  'bilibili',
  'kuaishou',
  'baijiahao',
  'manual',
] as const;
export type PublicationPlatform = (typeof PUBLICATION_PLATFORMS)[number];
export const PUBLICATION_PLATFORM_LABELS: Record<PublicationPlatform, string> = {
  douyin: '抖音',
  xiaohongshu: '小红书',
  wechat_mp: '微信公众号',
  video_channel: '视频号',
  weibo: '微博',
  bilibili: '哔哩哔哩',
  kuaishou: '快手',
  baijiahao: '百家号',
  manual: '手动登记',
};

export const PUBLICATION_STATUSES = ['pending', 'published', 'failed'] as const;
export type PublicationStatus = (typeof PUBLICATION_STATUSES)[number];
export const PUBLICATION_STATUS_LABELS: Record<PublicationStatus, string> = {
  pending: '待发布',
  published: '已发布',
  failed: '发布失败',
};

export interface PublicationRecord {
  id: string;
  contentType: PublicationContentType;
  contentId: string;
  contentTitle?: string | null;
  brandId: string;
  brandName: string;
  mediaLibrary: string;
  platform: PublicationPlatform;
  scheduledAt: string | null;
  status: PublicationStatus;
  publishUrl: string | null;
  remark: string | null;
  creatorId: string;
  creatorName: string | null;
  createdAt: string;
  updatedAt: string;
}

/* ---------------- 任务队列（统一视图） ---------------- */

export const CREATION_TASK_TYPES = ['article', 'image', 'video'] as const;
export type CreationTaskType = (typeof CREATION_TASK_TYPES)[number];
export const CREATION_TASK_TYPE_LABELS: Record<CreationTaskType, string> = {
  article: '文章',
  image: '图片',
  video: '视频',
};

export const CREATION_TASK_STATUSES = [
  'pending',
  'generating',
  'completed',
  'failed',
] as const;
export type CreationTaskStatus = (typeof CREATION_TASK_STATUSES)[number];
export const CREATION_TASK_STATUS_LABELS: Record<CreationTaskStatus, string> = {
  pending: '排队中',
  generating: '生成中',
  completed: '已完成',
  failed: '失败',
};

export interface CreationTaskItem {
  id: string;
  taskName: string;
  taskType: CreationTaskType;
  quantity: number;
  status: CreationTaskStatus;
  durationMs: number;
  costCredits: number;
  brandId: string;
  brandName: string;
  error: string | null;
  createdAt: string;
  completedAt: string | null;
}

/* ---------------- 关键词分组 ---------------- */

export interface KeywordGroup {
  id: string;
  brandId: string;
  name: string;
  description: string | null;
  sortOrder: number;
  createdAt: string;
}

export interface KeywordItem {
  id: string;
  keyword: string;
  keywordType: 'core' | 'longtail';
  groupId: string | null;
}

/* ---------------- 统一创作任务 ---------------- */

export const CREATION_IMG_MODES = ['ai_generate', 'material', 'upload'] as const;
export type CreationImgMode = (typeof CREATION_IMG_MODES)[number];
export const CREATION_IMG_MODE_LABELS: Record<CreationImgMode, string> = {
  ai_generate: 'AI 生成',
  material: '素材库选择',
  upload: '上传图片',
};

export const CREATION_RATIOS = ['1:1', '4:3', '3:4', '16:9', '9:16'] as const;
export type CreationRatio = (typeof CREATION_RATIOS)[number];

export const CREATION_VIDEO_DURATIONS = ['10s', '15s'] as const;
export type CreationVideoDuration = (typeof CREATION_VIDEO_DURATIONS)[number];
export const CREATION_VIDEO_DURATION_LABELS: Record<CreationVideoDuration, string> = {
  '10s': '10 秒',
  '15s': '15 秒',
};

export const CREATION_RESOLUTIONS = ['hd', 'full_hd', '4k'] as const;
export type CreationResolution = (typeof CREATION_RESOLUTIONS)[number];
export const CREATION_RESOLUTION_LABELS: Record<CreationResolution, string> = {
  hd: '高清',
  full_hd: '全高清',
  '4k': '4K',
};

export const SUBTITLE_STYLES = ['default', 'karaoke', 'bounce', 'neon'] as const;
export type SubtitleStyle = (typeof SUBTITLE_STYLES)[number];
export const SUBTITLE_STYLE_LABELS: Record<SubtitleStyle, string> = {
  default: '默认',
  karaoke: '卡拉OK',
  bounce: '弹跳',
  neon: '霓虹',
};

export interface VoiceOption {
  id: string;
  name: string;
  gender: 'male' | 'female';
}

export interface CreationTaskDetail {
  id: string;
  taskType: CreationTaskType;
  title: string | null;
  content: string | null;
  keywords: string[];
  longtailKeywords: string[];
  groupId: string | null;
  groupName: string | null;
  tags: string[];
  ratio: string | null;
  duration: string | null;
  resolution: string | null;
  subtitleEnabled: boolean;
  subtitleStyle: string | null;
  bgmUrl: string | null;
  bgmVolume: number;
  voiceId: string | null;
  voiceName: string | null;
  originalAudioEnabled: boolean;
  imageMode: string | null;
  imagePrompt: string | null;
  imageCount: number;
  referenceImages: string[];
  materialImageIds: string[];
  uploadedImageUrls: string[];
  videoPrompt: string | null;
  videoReferenceImages: string[];
  videoMaterialId: string | null;
  resultImages: string[];
  resultVideoUrl: string | null;
  resultCoverUrl: string | null;
  externalTaskId: string | null;
  status: CreationTaskStatus;
  error: string | null;
  costCredits: number;
  durationMs: number | null;
  brandId: string;
  brandName: string | null;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
}

export interface CreateImageTaskRequest {
  brandId: string;
  groupId: string;
  keywords: string[];
  longtailKeywords: string[];
  title: string;
  content: string;
  tags: string[];
  imageMode: CreationImgMode;
  imagePrompt?: string;
  imageCount: number;
  referenceImages?: string[];
  materialImageIds?: string[];
  uploadedImageUrls?: string[];
  perImagePrompts?: string[];
  ratio: CreationRatio;
}

export interface CreateVideoTaskRequest {
  brandId: string;
  groupId: string;
  keywords: string[];
  longtailKeywords: string[];
  title: string;
  content: string;
  tags: string[];
  videoPrompt: string;
  videoReferenceImages?: string[];
  videoMaterialId?: string;
  duration: CreationVideoDuration;
  ratio: CreationRatio;
  resolution: CreationResolution;
  subtitleEnabled: boolean;
  subtitleStyle?: SubtitleStyle;
  bgmUrl?: string;
  bgmVolume: number;
  voiceId?: string;
  voiceName?: string;
  originalAudioEnabled: boolean;
}

export interface GenerateCopyRequest {
  brandId: string;
  keywords: string[];
  longtailKeywords: string[];
  title: string;
  taskType: 'image' | 'video';
}

export interface GenerateCopyResponse {
  content: string;
}

export interface SplitImagePromptsRequest {
  content: string;
  imageCount: number;
  keywords: string[];
  title: string;
}

export interface SplitImagePromptsResponse {
  prompts: string[];
}

export interface CreationTaskListQuery {
  taskType?: CreationTaskType;
  status?: CreationTaskStatus;
  keyword?: string;
  page?: number;
  pageSize?: number;
}

export interface CreationTaskListResponse {
  items: CreationTaskDetail[];
  total: number;
  page: number;
  pageSize: number;
}

/* ---------------- 自动令牌 ---------------- */

export interface AutoToken {
  id: string;
  name: string;
  token: string | null;
  status: string;
  lastUsedAt: string | null;
  createdAt: string;
}

/* ---------------- 客户信息真实性承诺书 ---------------- */

export const COMMITMENT_SIGN_STATUSES = [
  'signed',
  'unsigned',
  'resign_required',
] as const;
export type CommitmentSignStatus = (typeof COMMITMENT_SIGN_STATUSES)[number];
export const COMMITMENT_SIGN_STATUS_LABELS: Record<CommitmentSignStatus, string> = {
  signed: '已签署',
  unsigned: '未签署',
  resign_required: '需重签',
};

export interface CommitmentVersion {
  id: string;
  versionCode: string;
  content: string;
  isActive: boolean;
  signCount?: number;
  createdAt: string;
}

export interface CommitmentSignature {
  id: string;
  userId: string;
  brandId: string | null;
  brandName: string | null;
  username: string;
  versionId: string | null;
  versionCode: string | null;
  signMethod: string | null;
  clientIp: string | null;
  userAgent: string | null;
  signedAt: string | null;
  needsResign: boolean;
  remindCount: number;
  lastRemindedAt: string | null;
}

export interface CommitmentSignatureWithStatus extends CommitmentSignature {
  status: CommitmentSignStatus;
}

export interface CommitmentCheckResponse {
  needsSign: boolean;
  currentVersion?: CommitmentVersion | null;
  latestSignature?: CommitmentSignature | null;
}

// ============ B 模块：品牌诊断 ============

export const DIAGNOSIS_STATUS = ['pending', 'running', 'completed', 'failed', 'skipped'] as const;
export type DiagnosisStatus = (typeof DIAGNOSIS_STATUS)[number];
export const DIAGNOSIS_STATUS_LABELS: Record<DiagnosisStatus, string> = {
  pending: '等待中',
  running: '诊断中',
  completed: '已完成',
  failed: '失败',
  skipped: '未接入',
};

export const DIAGNOSIS_PLATFORMS = ['doubao', 'deepseek', 'wenxin', 'tongyi', 'yuanbao', 'kimi'] as const;
export type DiagnosisPlatform = (typeof DIAGNOSIS_PLATFORMS)[number];
export const DIAGNOSIS_PLATFORM_LABELS: Record<DiagnosisPlatform, string> = {
  doubao: '豆包',
  deepseek: 'DeepSeek',
  wenxin: '文心一言',
  tongyi: '通义千问',
  yuanbao: '腾讯元宝',
  kimi: 'Kimi',
};

export const MENTION_POSITIONS = ['first', 'top3', 'later', 'none'] as const;
export type MentionPosition = (typeof MENTION_POSITIONS)[number];
export const MENTION_POSITION_LABELS: Record<MentionPosition, string> = {
  first: '第1个提及',
  top3: '前3个提及',
  later: '之后提及',
  none: '未出现',
};

export const SENTIMENT_TYPES = ['positive', 'neutral', 'negative'] as const;
export type SentimentType = (typeof SENTIMENT_TYPES)[number];
export const SENTIMENT_LABELS: Record<SentimentType, string> = {
  positive: '正向推荐',
  neutral: '中立提及',
  negative: '负面评价',
};

export interface DiagnosisResultItem {
  id: string;
  taskId: string;
  reportId: string | null;
  question: string;
  platform: DiagnosisPlatform;
  isMentioned: boolean;
  mentionPosition: MentionPosition | null;
  sentiment: SentimentType;
  otherBrands: string[];
  rawAnswer: string | null;
  answerSummary: string | null;
  error: string | null;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  createdAt: string;
}

export interface DiagnosisRecommendation {
  title: string;
  detail: string;
  priority: string;
}

export interface DiagnosisReportData {
  summary: string;
  visibility: { score: number; hitQuestions: number; totalQuestions: number };
  ranking: { score: number; avgPosition: string };
  coverage: { score: number; coveredTypes: string[]; totalTypes: number };
  citation: { score: number; citedSources: string[] };
  recommendations: DiagnosisRecommendation[];
}

export interface DiagnosisTask {
  id: string;
  brandId: string | null;
  brandName: string;
  website: string | null;
  industry: string | null;
  coreKeywords: string[];
  city: string | null;
  category: string | null;
  platforms: DiagnosisPlatform[];
  competitors: string[];
  questions: string[];
  status: DiagnosisStatus;
  reportId: string | null;
  error: string | null;
  totalCount: number;
  completedCount: number;
  failedCount: number;
  skippedCount: number;
  creatorId: string;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  isDemo: boolean;
  brandAliases: string[];
  brandIntro: string | null;
  products: DiagnosisProduct[];
}

export interface DiagnosisProduct {
  name: string;
}

export const DIAGNOSIS_QUESTION_TYPES = [
  '口碑', '推荐', '对比', '品牌词', '排名', '地址',
] as const;
export type DiagnosisQuestionType = (typeof DIAGNOSIS_QUESTION_TYPES)[number];
export const DIAGNOSIS_QUESTION_TYPE_LABELS: Record<DiagnosisQuestionType, string> = {
  '口碑': '口碑类',
  '推荐': '推荐类',
  '对比': '对比类',
  '品牌词': '品牌词类',
  '排名': '排名类',
  '地址': '地址类',
};

export interface DiagnosisQuestionScenario {
  id: string;
  userProfile: string;
  searchScenario: string;
  sampleQuestion: string;
  questionType: DiagnosisQuestionType;
}

export interface DiagnosisRecommendQuotaResponse {
  used: number;
  limit: number;
  remaining: number;
}

export interface DiagnosisCreditInfoResponse {
  balance: number;
  unitPricePerQuery: number;
  planName: string;
}

export interface DiagnosisReport {
  id: string;
  taskId: string;
  brandId: string;
  brandName?: string | null;
  overallScore: number;
  visibilityScore: number;
  rankingScore: number;
  coverageScore: number;
  citationScore: number;
  reportData: DiagnosisReportData;
  shareToken: string | null;
  shareExpiresAt: string | null;
  creatorId: string;
  createdAt: string;
  isDemo: boolean;
}

// ============ B 模块：词池 / 词灵感 ============

export const KEYWORD_POOL_SOURCES = ['manual', 'inspiration', 'import', 'competitor', 'keyword_expand'] as const;
export type KeywordPoolSource = (typeof KEYWORD_POOL_SOURCES)[number];
export const KEYWORD_POOL_SOURCE_LABELS: Record<KeywordPoolSource, string> = {
  manual: '手动添加',
  inspiration: '词灵感',
  import: '批量导入',
  competitor: '竞品分析',
  keyword_expand: '关键词扩展',
};

export interface KeywordPoolItem {
  id: string;
  brandId: string;
  keyword: string;
  keywordType: KeywordType;
  groupId: string | null;
  groupName: string | null;
  source: KeywordPoolSource;
  searchVolume: number | null;
  competition: number | null;
  addedAt: string | null;
  creatorId: string;
  createdAt: string;
}

export const INSPIRATION_INTENT_TYPES = [
  'cognitive',
  'comparison',
  'transaction',
  'local',
  'scenario',
] as const;
export type InspirationIntentType = (typeof INSPIRATION_INTENT_TYPES)[number];
export const INSPIRATION_INTENT_LABELS: Record<InspirationIntentType, string> = {
  cognitive: '认知型',
  comparison: '比较型',
  transaction: '交易型',
  local: '本地型',
  scenario: '场景型',
};
export const INSPIRATION_INTENT_COLORS: Record<InspirationIntentType, { bg: string; text: string }> = {
  cognitive: { bg: 'rgba(59, 91, 255, 0.1)', text: '#3B5BFF' },
  comparison: { bg: 'rgba(139, 92, 246, 0.1)', text: '#8B5CF6' },
  transaction: { bg: 'rgba(23, 201, 100, 0.1)', text: '#17C964' },
  local: { bg: 'rgba(255, 169, 64, 0.1)', text: '#FFA940' },
  scenario: { bg: 'rgba(0, 194, 255, 0.1)', text: '#00C2FF' },
};

export const INSPIRATION_INDUSTRIES = [
  'bakery',
  'maternity',
  'dental',
  'auto_repair',
  'decoration',
  'restaurant',
  'local_specialty',
] as const;
export type InspirationIndustry = (typeof INSPIRATION_INDUSTRIES)[number];
export const INSPIRATION_INDUSTRY_LABELS: Record<InspirationIndustry, string> = {
  bakery: '烘焙',
  maternity: '母婴',
  dental: '口腔',
  auto_repair: '汽修',
  decoration: '装修',
  restaurant: '餐饮',
  local_specialty: '特产',
};
export const INSPIRATION_INDUSTRY_SCENES: Record<InspirationIndustry, string[]> = {
  bakery: ['生日蛋糕', '结婚蛋糕', '无糖蛋糕', '团建蛋糕', '儿童蛋糕', '祝寿蛋糕', '下午茶点心', '面包'],
  maternity: ['新生儿', '产后恢复', '月嫂', '月子中心', '婴儿辅食', '孕妇奶粉', '早教', '童装'],
  dental: ['种植牙', '牙齿矫正', '洗牙', '烤瓷牙', '儿童齿科', '根管治疗', '补牙', '美白'],
  auto_repair: ['保养', '维修', '钣金喷漆', '轮胎更换', '洗车', '改装', '电瓶更换', '刹车片'],
  decoration: ['全屋整装', '旧房改造', '装修设计', '半包', '全包', '婚房装修', '办公室装修', '水电改造'],
  restaurant: ['特色菜', '私房菜', '火锅', '烧烤', '生日聚餐', '团建聚餐', '外卖', '包厢预订'],
  local_specialty: ['特产礼盒', '伴手礼', '本地小吃', '老字号', '手工制作', '农家特产', '节日礼品', '团购'],
};

export const INSPIRATION_DISTRICTS_BY_CITY: Record<string, string[]> = {
  '石家庄': ['桥西区', '裕华区', '长安区', '新华区', '正定县', '鹿泉区', '栾城区', '藁城区'],
};

export interface InspirationKeyword {
  keyword: string;
  keywordType: KeywordType;
  intentType: InspirationIntentType;
  sceneTag: string;
  hasLocation: boolean;
  hasBrand: boolean;
  opportunityScore: number;
  reason: string;
  searchVolume: null;
  competition: null;
}

// ============ B 模块：知识库 ============

export const KNOWLEDGE_CATEGORIES = [
  'company_intro',
  'product_service',
  'faq',
  'case_study',
  'qualification',
  'general',
  'selling_point',
] as const;
export type KnowledgeCategory = (typeof KNOWLEDGE_CATEGORIES)[number];
export const KNOWLEDGE_CATEGORY_LABELS: Record<KnowledgeCategory, string> = {
  company_intro: '企业介绍',
  product_service: '产品服务',
  faq: '常见问题',
  case_study: '案例',
  qualification: '资质荣誉',
  general: '通用',
  selling_point: '企业资料',
};

export interface KnowledgeItem {
  id: string;
  brandId: string | null;
  category: KnowledgeCategory;
  title: string;
  content: string;
  tags: string[];
  isActive: boolean;
  creatorId: string;
  createdAt: string;
  updatedAt: string;
}

// ============ B 模块：发布记录 ============

export const PUBLISH_STATUS = ['pending', 'published', 'failed', 'archived'] as const;
export type PublishStatus = (typeof PUBLISH_STATUS)[number];
export const PUBLISH_STATUS_LABELS: Record<PublishStatus, string> = {
  pending: '待发布',
  published: '已收录并引用',
  failed: '未收录',
  archived: '已回收',
};

export const GEO_PUBLISH_STATUS_LABELS = PUBLISH_STATUS_LABELS;

export interface PublishRecord {
  id: string;
  brandId: string;
  taskId: string | null;
  contentType: string;
  title: string | null;
  externalUrl: string | null;
  platform: string | null;
  status: PublishStatus;
  publishDate: string | null;
  notes: string | null;
  creatorId: string;
  createdAt: string;
  isDuplicate: boolean;
}

export interface PlatformAccessStatus {
  platform: DiagnosisPlatform;
  label: string;
  accessible: boolean;
}

// ============ B 模块：官网设置 / TDK / 站群 ============

export interface WebsiteContactInfo {
  phone: string;
  email: string;
  address: string;
}

export interface WebsiteSettings {
  id: string;
  brandId: string;
  domain: string | null;
  siteName: string | null;
  siteDescription: string | null;
  contactInfo: WebsiteContactInfo | null;
  creatorId: string;
  createdAt: string;
  updatedAt: string;
}

export interface TdkTemplate {
  id: string;
  brandId: string;
  name: string;
  titleTemplate: string;
  descriptionTemplate: string;
  keywordsTemplate: string;
  pageType: string | null;
  isDefault: boolean;
  creatorId: string;
  createdAt: string;
  updatedAt: string;
}

export const SITE_STATUS = ['active', 'inactive', 'building'] as const;
export type SiteStatus = (typeof SITE_STATUS)[number];
export const isSiteStatus = (v: string): v is SiteStatus =>
  (SITE_STATUS as readonly string[]).includes(v);
export const SITE_STATUS_LABELS: Record<SiteStatus, string> = {
  active: '运行中',
  inactive: '已停用',
  building: '建设中',
};

export const SITE_TYPES = ['enterprise', 'b2b'] as const;
export type SiteType = (typeof SITE_TYPES)[number];
export const isSiteType = (v: string): v is SiteType =>
  (SITE_TYPES as readonly string[]).includes(v);
export const SITE_TYPE_LABELS: Record<SiteType, string> = {
  enterprise: '企业官网',
  b2b: 'B2B联盟',
};

export interface SiteNetworkItem {
  id: string;
  brandId: string;
  siteType: SiteType;
  siteName: string;
  domain: string;
  status: SiteStatus;
  cmsType: string | null;
  notes: string | null;
  creatorId: string;
  createdAt: string;
  updatedAt: string;
}

// ============ B 模块：账号信息 ============

export interface AccountProfile {
  id: string;
  userId: string;
  companyName: string | null;
  industry: string | null;
  region: string | null;
  contactName: string | null;
  contactPhone: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface UpdateAccountProfileRequest {
  companyName?: string | null;
  industry?: string | null;
  region?: string | null;
  contactName?: string | null;
  contactPhone?: string | null;
}

export interface ChangePasswordRequest {
  oldPassword: string;
  newPassword: string;
}

/* ---------------- 渠道账号 ---------------- */

export const CHANNEL_PLATFORMS = [
  'baijiahao',
  'toutiao',
  'zhihu',
  'xiaohongshu',
  'wechat',
  'website',
] as const;
export type ChannelPlatform = (typeof CHANNEL_PLATFORMS)[number];
export const CHANNEL_PLATFORM_LABELS: Record<ChannelPlatform, string> = {
  baijiahao: '百家号',
  toutiao: '头条号',
  zhihu: '知乎',
  xiaohongshu: '小红书',
  wechat: '微信公众号',
  website: '客户自有网站',
};

export const CHANNEL_PUBLISH_MODES = ['local_auto', 'official_api', 'manual'] as const;
export type ChannelPublishMode = (typeof CHANNEL_PUBLISH_MODES)[number];
export const CHANNEL_PUBLISH_MODE_LABELS: Record<ChannelPublishMode, string> = {
  local_auto: '本地自动发布',
  official_api: '官方接口',
  manual: '手动发布',
};

export const CHANNEL_BIND_STATUSES = ['bound', 'unbound', 'expired'] as const;
export type ChannelBindStatus = (typeof CHANNEL_BIND_STATUSES)[number];
export const CHANNEL_BIND_STATUS_LABELS: Record<ChannelBindStatus, string> = {
  bound: '已绑定',
  unbound: '未绑定',
  expired: 'Cookie 失效',
};

export const CHANNEL_STATUSES = ['active', 'paused'] as const;
export type ChannelStatus = (typeof CHANNEL_STATUSES)[number];
export const CHANNEL_STATUS_LABELS: Record<ChannelStatus, string> = {
  active: '启用',
  paused: '暂停',
};

export interface Channel {
  id: string;
  brandId: string;
  platform: ChannelPlatform;
  accountName: string;
  publishMode: ChannelPublishMode;
  dailyLimit: number;
  todayPublished: number;
  bindStatus: ChannelBindStatus;
  status: ChannelStatus;
  lastPublishedAt: string | null;
  remark: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ChannelListQuery {
  page?: number;
  pageSize?: number;
  brandId?: string;
  platform?: ChannelPlatform;
  status?: ChannelStatus;
}

export interface ChannelListResponse {
  items: Channel[];
  total: number;
  page: number;
  pageSize: number;
}

export interface CreateChannelRequest {
  platform: ChannelPlatform;
  accountName: string;
  brandId: string;
  publishMode: ChannelPublishMode;
  dailyLimit: number;
  remark?: string;
}

export interface UpdateChannelRequest {
  status?: ChannelStatus;
  dailyLimit?: number;
  remark?: string;
  accountName?: string;
}

export interface ChannelTestResult {
  ok: boolean;
  bindStatus: ChannelBindStatus;
  message?: string;
}

/* ---------------- 发布队列 ---------------- */

export const PUBLISH_QUEUE_STATUSES = [
  'pending',
  'publishing',
  'pending_manual',
  'published',
  'failed',
  'pending_client',
  'client_running',
] as const;
export type PublishQueueStatus = (typeof PUBLISH_QUEUE_STATUSES)[number];
export const PUBLISH_QUEUE_STATUS_LABELS: Record<PublishQueueStatus, string> = {
  pending: '待发布',
  publishing: '发布中',
  pending_manual: '待人工确认',
  published: '已收录并引用',
  failed: '未收录',
  pending_client: '待客户端领取',
  client_running: '客户端执行中',
};

export const PUBLISH_QUEUE_SOURCES = ['queue_auto', 'queue_manual'] as const;
export type PublishQueueSource = (typeof PUBLISH_QUEUE_SOURCES)[number];
export const PUBLISH_QUEUE_SOURCE_LABELS: Record<PublishQueueSource, string> = {
  queue_auto: '队列自动',
  queue_manual: '队列手动',
};

export interface PublishQueueItem {
  id: string;
  brandId: string;
  articleId: string | null;
  channelId: string | null;
  channelName?: string;
  channelPlatform?: ChannelPlatform;
  taskId?: string | null;
  taskName?: string | null;
  title: string;
  coverUrl: string | null;
  tags: string[];
  mode: ChannelPublishMode;
  status: PublishQueueStatus;
  publishUrl: string | null;
  publishedAt: string | null;
  error: string | null;
  wordCount: number;
  source: PublishQueueSource;
  accountId: string | null;
  accountName: string | null;
  scheduledDate: string | null;
  weightTier?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PublishQueueQuery {
  page?: number;
  pageSize?: number;
  brandId?: string;
  channelId?: string;
  status?: PublishQueueStatus;
  accountId?: string;
  startDate?: string;
  endDate?: string;
  scheduledBefore?: string;
  scheduledAfter?: string;
  pendingExecution?: boolean;
}

export interface PublishQueueDetail extends PublishQueueItem {
  content: string | null;
  screenshotUrl: string | null;
  article: {
    id: string;
    brandId: string;
    title: string;
    content: string;
    articleType: string;
    wordCount: number;
    keywords: string[];
    longtailKeywords: string[];
    status: string;
    costCredits: number;
    coverImage: string | null;
    createdAt: string;
    updatedAt: string;
  } | null;
}

export interface PublishQueueListResponse {
  items: PublishQueueItem[];
  total: number;
  page: number;
  pageSize: number;
}

export interface EnqueuePublishRequest {
  articleId: string;
  channelId: string;
  mode?: ChannelPublishMode;
  accountId?: string;
}

export interface MarkPublishedRequest {
  publishMethod: 'manual' | 'client';
  accountId?: string;
  url: string;
  publishedAt: string;
  remark?: string;
}

export interface PendingPublishTask {
  id: string;
  title: string;
  content: string | null;
  coverUrl: string | null;
  tags: string[];
  channelId: string | null;
  channelPlatform: ChannelPlatform | null;
  channelName: string | null;
  publishMode: ChannelPublishMode;
}

export interface PublishResultRequest {
  status: 'success' | 'failed' | 'pending_manual';
  publishUrl?: string;
  screenshotUrl?: string;
  error?: string;
}

// ========== 投稿渠道 ==========

export const SUBMISSION_CHANNEL_TYPES = [
  'self_site',
  'public_submission',
  'authoritative_media',
  'industry_vertical',
  'self_media_account',
] as const;
export type SubmissionChannelType = (typeof SUBMISSION_CHANNEL_TYPES)[number];
export const isSubmissionChannelType = (v: string): v is SubmissionChannelType =>
  (SUBMISSION_CHANNEL_TYPES as readonly string[]).includes(v);
export const SUBMISSION_CHANNEL_TYPE_LABELS: Record<SubmissionChannelType, string> = {
  self_site: '自建站',
  public_submission: '公共投稿站',
  authoritative_media: '权威媒体',
  industry_vertical: '行业垂直站',
  self_media_account: '自媒体账号',
};

export const SUBMISSION_CHANNEL_USAGE_TYPES = [
  'real_submission',
  'info_publish',
  'merchant',
  'lookup',
  'paid_media',
] as const;
export type SubmissionChannelUsageType = (typeof SUBMISSION_CHANNEL_USAGE_TYPES)[number];
export const isSubmissionChannelUsageType = (v: string): v is SubmissionChannelUsageType =>
  (SUBMISSION_CHANNEL_USAGE_TYPES as readonly string[]).includes(v);
export const SUBMISSION_CHANNEL_USAGE_TYPE_LABELS: Record<SubmissionChannelUsageType, string> = {
  real_submission: '真投稿',
  info_publish: '信息发布',
  merchant: '商户入驻',
  lookup: '查询·百科',
  paid_media: '付费发稿',
};

export const SUBMISSION_CHANNEL_STATUSES = ['active', 'paused', 'to_be_deprecated', 'archived'] as const;
export type SubmissionChannelStatus = (typeof SUBMISSION_CHANNEL_STATUSES)[number];
export const isSubmissionChannelStatus = (v: string): v is SubmissionChannelStatus =>
  (SUBMISSION_CHANNEL_STATUSES as readonly string[]).includes(v);
export const SUBMISSION_CHANNEL_STATUS_LABELS: Record<SubmissionChannelStatus, string> = {
  active: '启用',
  paused: '暂停',
  to_be_deprecated: '待淘汰',
  archived: '已归档',
};

export const SUBMISSION_CHANNEL_TIERS = ['S', 'A', 'B', 'C'] as const;
export type SubmissionChannelTier = (typeof SUBMISSION_CHANNEL_TIERS)[number];
export const isSubmissionChannelTier = (v: string): v is SubmissionChannelTier =>
  (SUBMISSION_CHANNEL_TIERS as readonly string[]).includes(v);
export const SUBMISSION_CHANNEL_TIER_LABELS: Record<SubmissionChannelTier, string> = {
  S: 'S级',
  A: 'A级',
  B: 'B级',
  C: 'C级',
};

export const INDEX_STATUSES = ['pending', 'indexed', 'failed'] as const;
export type IndexStatus = (typeof INDEX_STATUSES)[number];
export const INDEX_STATUS_LABELS: Record<IndexStatus, string> = {
  pending: '待回收',
  indexed: '已收录',
  failed: '未收录',
};

export const SUBMISSION_AI_SOURCES = [
  'doubao',
  'deepseek',
  'wenxin',
  'tongyi',
  'yuanbao',
  'kimi',
] as const;
export type SubmissionAiSource = (typeof SUBMISSION_AI_SOURCES)[number];
export const SUBMISSION_AI_SOURCE_LABELS: Record<SubmissionAiSource, string> = {
  doubao: '豆包',
  deepseek: 'DeepSeek',
  wenxin: '文心',
  tongyi: '通义',
  yuanbao: '元宝',
  kimi: 'Kimi',
};

export const SUBMISSION_LIBRARY_TYPES = ['public', 'authoritative', 'b2b_alliance', 'multimodal', 'private', 'self_site'] as const;
export type SubmissionLibraryType = (typeof SUBMISSION_LIBRARY_TYPES)[number];
export const SUBMISSION_LIBRARY_TYPE_LABELS: Record<SubmissionLibraryType, string> = {
  public: '公共媒体库',
  authoritative: '权威媒体库',
  b2b_alliance: 'B2B联盟',
  multimodal: '多模态信源',
  private: '私人媒体库',
  self_site: '客户自有站点',
};

export const BATCH_TAG_MODES = ['append', 'replace'] as const;
export type BatchTagMode = (typeof BATCH_TAG_MODES)[number];
export const BATCH_TAG_MODE_LABELS: Record<BatchTagMode, string> = {
  append: '追加标签',
  replace: '替换标签',
};

export const BATCH_TAG_SCOPES = ['selection', 'filter'] as const;
export type BatchTagScope = (typeof BATCH_TAG_SCOPES)[number];

export interface BatchTagRequest {
  scope: BatchTagScope;
  ids?: string[];
  filter?: SubmissionChannelQuery;
  platforms?: string[];
  mediaType?: SubmissionMediaType;
  imagePrice?: number | null;
  videoPrice?: number | null;
  quotaTotal?: number | null;
  followers?: number | null;
  likes?: number | null;
  mode: BatchTagMode;
}

export interface BatchTagResponse {
  updated: number;
}

export interface SourceTagLog {
  id: string;
  operatorId: string;
  operatorName: string;
  scope: BatchTagScope;
  targetCount: number;
  platforms: string[];
  mediaType: string | null;
  imagePrice: number | null;
  videoPrice: number | null;
  quotaTotal: number | null;
  followers: number | null;
  likes: number | null;
  mode: BatchTagMode;
  createdAt: string;
}

export interface SourceTagLogListResponse {
  items: SourceTagLog[];
}

// ============ 批次清单 ============

export interface BatchSheetQuery {
  libraryType?: SubmissionLibraryType;
  region?: string;
  industry?: SubmissionIndustry;
  tagStatus?: 'all' | 'tagged' | 'untagged';
}

export interface BatchSheetItem {
  region: string;
  industry: SubmissionIndustry;
  totalCount: number;
  taggedCount: number;
  untaggedCount: number;
}

export interface BatchSheetResponse {
  items: BatchSheetItem[];
  total: number;
  taggedTotal: number;
  untaggedTotal: number;
  coverageRate: number;
}

export interface BatchTagSheetGroup {
  region: string;
  industry: string;
  total: number;
  tagged: number;
  untagged: number;
}

export interface BatchTagSheetResponse {
  groups: BatchTagSheetGroup[];
  summary: {
    total: number;
    tagged: number;
    untagged: number;
    coverage: number;
  };
}

// ============ 自动选源 ============

export interface AutoSelectChannelsRequest {
  brandId: string;
  libraryType?: SubmissionLibraryType;
  region?: string;
  industry?: SubmissionIndustry;
  aiPlatforms: SubmissionAiSource[];
  mediaType: SubmissionMediaType;
  budgetMax: number;
}

export interface AutoSelectChannelItem {
  id: string;
  name: string;
  libraryType: SubmissionLibraryType;
  region: string;
  aiPlatforms: SubmissionAiSource[];
  imagePrice: number | null;
  videoPrice: number | null;
}

export interface AutoSelectChannelsResult {
  items: AutoSelectChannelItem[];
  totalCost: number;
  unpricedCount: number;
}

export const SUBMISSION_MEDIA_TYPES = ['image_text', 'video', 'image_text_video'] as const;
export type SubmissionMediaType = (typeof SUBMISSION_MEDIA_TYPES)[number];
export const SUBMISSION_MEDIA_TYPE_LABELS: Record<SubmissionMediaType, string> = {
  image_text: '图文',
  video: '视频',
  image_text_video: '图文+视频',
};

export const SUBMISSION_REGIONS = [
  '全国',
  '北京', '天津', '河北', '山西', '内蒙古',
  '辽宁', '吉林', '黑龙江',
  '上海', '江苏', '浙江', '安徽', '福建', '江西', '山东',
  '河南', '湖北', '湖南', '广东', '广西', '海南',
  '重庆', '四川', '贵州', '云南', '西藏',
  '陕西', '甘肃', '青海', '宁夏', '新疆',
  '香港', '澳门', '台湾',
] as const;
export type SubmissionRegion = (typeof SUBMISSION_REGIONS)[number];

export const SUBMISSION_INDUSTRIES = [
  'general',
  'bakery',
  'mother_baby',
  'dental',
  'auto_repair',
  'decoration',
  'catering',
  'specialty',
] as const;
export type SubmissionIndustry = (typeof SUBMISSION_INDUSTRIES)[number];
export const SUBMISSION_INDUSTRY_LABELS: Record<SubmissionIndustry, string> = {
  general: '通用',
  bakery: '烘焙',
  mother_baby: '母婴',
  dental: '口腔',
  auto_repair: '汽修',
  decoration: '装修',
  catering: '餐饮',
  specialty: '特产',
};

export interface SubmissionChannel {
  id: string;
  brandId: string | null;
  ownerType: 'platform' | 'brand';
  ownerId: string | null;
  name: string;
  channelType: SubmissionChannelType;
  submitUrl: string | null;
  needAccount: boolean;
  costPerArticle: number;
  dailyLimit: number;
  todayPublished: number;
  reviewHours: number;
  industries: SubmissionIndustry[];
  requiredFields: string[];
  aiSources: SubmissionAiSource[];
  accountName: string | null;
  status: SubmissionChannelStatus;
  submittedCount: number;
  indexedCount: number;
  remark: string | null;
  usageType: SubmissionChannelUsageType | null;
  platformCoverage: DiagnosisPlatform[];
  indexRate: number;
  citeRate: number;
  lastCiteAt: string | null;
  citeSnapshots: number;
  tier: SubmissionChannelTier;
  indexStatus: IndexStatus;
  citeCount: number;
  createdAt: string;
  libraryType: SubmissionLibraryType;
  region: string;
  aiPlatforms: SubmissionAiSource[];
  mediaType: SubmissionMediaType;
  quotaTotal: number | null;
  quotaUsed: number;
  followers: number | null;
  likes: number | null;
  imagePrice: number | null;
  videoPrice: number | null;
  description: string | null;
  costPriceCents: number | null;
  salePriceCents: number | null;
  priceUnit: string | null;
  sellable: boolean;
  salePriceOverridden: boolean;
  priceUpdatedAt: string | null;
}

export interface UpdateChannelPriceRequest {
  salePriceCents: number;
}

export interface UpdateChannelPriceResponse {
  updated: number;
  channel: SubmissionChannel;
}

export const BULK_PRICE_MODES = ['markup_rate', 'fixed_delta'] as const;
export type BulkPriceMode = (typeof BULK_PRICE_MODES)[number];

export interface BulkChannelPriceRequest {
  mode: BulkPriceMode;
  markupRate?: number;
  fixedDelta?: number;
  filter?: SubmissionChannelQuery;
  previewOnly?: boolean;
}

export interface BulkChannelPriceResponse {
  affectedCount: number;
  previewOnly?: boolean;
}

export interface GenerateLongtailRequest {
  keywords: string[];
  city?: string;
  brandId?: string;
}

export interface GenerateLongtailResponse {
  keywords: string[];
  source: 'template' | 'ai_fallback';
}

export const SUBMISSION_CHANNEL_GROUPS = ['common', 'self_media_pack'] as const;
export type SubmissionChannelGroup = (typeof SUBMISSION_CHANNEL_GROUPS)[number];
export const SUBMISSION_CHANNEL_GROUP_LABELS: Record<SubmissionChannelGroup, string> = {
  common: '常用信源',
  self_media_pack: '自媒体信源包',
};

export interface SubmissionChannelQuery {
  limit?: number;
  cursor?: string;
  page?: number;
  brandId?: string;
  type?: SubmissionChannelType;
  status?: SubmissionChannelStatus;
  usageType?: SubmissionChannelUsageType;
  keyword?: string;
  supplierId?: string;
  sellable?: boolean;
  channelGroup?: SubmissionChannelGroup;
  tier?: SubmissionChannelTier;
  platformCoverage?: DiagnosisPlatform;
  libraryType?: SubmissionLibraryType;
  region?: string;
  industry?: string;
  aiPlatform?: SubmissionAiSource;
  mediaType?: SubmissionMediaType;
}

export interface AutoSelectRequest {
  brandId?: string;
  libraryType?: SubmissionLibraryType;
  region?: string;
  industry?: string;
  aiPlatforms?: string[];
  mediaType?: SubmissionMediaType;
  budgetMax?: number;
}

export interface AutoSelectResponse {
  channels: SubmissionChannel[];
  totalCost: number;
}

export interface SubmissionChannelListResponse {
  items: SubmissionChannel[];
  total: number;
  limit: number;
  page?: number;
  nextCursor?: string;
}

export interface CreateSubmissionChannelRequest {
  name: string;
  channelType: SubmissionChannelType;
  submitUrl?: string;
  needAccount?: boolean;
  costPerArticle?: number;
  dailyLimit?: number;
  reviewHours?: number;
  industries?: SubmissionIndustry[];
  requiredFields?: string[];
  aiSources?: SubmissionAiSource[];
  accountName?: string;
  status?: SubmissionChannelStatus;
  remark?: string;
  brandId?: string;
  usageType?: SubmissionChannelUsageType;
  platformCoverage?: DiagnosisPlatform[];
  indexRate?: number;
  citeRate?: number;
  tier?: SubmissionChannelTier;
  indexStatus?: IndexStatus;
  citeSnapshots?: number;
  libraryType?: SubmissionLibraryType;
  region?: string;
  aiPlatforms?: SubmissionAiSource[];
  mediaType?: SubmissionMediaType;
  quotaTotal?: number | null;
  quotaUsed?: number;
  followers?: number | null;
  likes?: number | null;
  imagePrice?: number | null;
  videoPrice?: number | null;
  description?: string | null;
}

export interface UpdateSubmissionChannelRequest {
  name?: string;
  channelType?: SubmissionChannelType;
  submitUrl?: string;
  needAccount?: boolean;
  costPerArticle?: number;
  dailyLimit?: number;
  reviewHours?: number;
  industries?: SubmissionIndustry[];
  requiredFields?: string[];
  aiSources?: SubmissionAiSource[];
  accountName?: string;
  status?: SubmissionChannelStatus;
  remark?: string;
  usageType?: SubmissionChannelUsageType | null;
  platformCoverage?: DiagnosisPlatform[];
  indexRate?: number;
  citeRate?: number;
  tier?: SubmissionChannelTier;
  indexStatus?: IndexStatus;
  citeSnapshots?: number;
  libraryType?: SubmissionLibraryType;
  region?: string;
  aiPlatforms?: SubmissionAiSource[];
  mediaType?: SubmissionMediaType;
  quotaTotal?: number | null;
  quotaUsed?: number;
  followers?: number | null;
  likes?: number | null;
  imagePrice?: number | null;
  videoPrice?: number | null;
  description?: string | null;
}

export interface SubmissionChannelImportPreview {
  total: number;
  duplicate: number;
  newCount: number;
  errorCount: number;
  errors: Array<{ row: number; error: string }>;
  sampleItems: Array<{
    name: string;
    channelType: SubmissionChannelType;
    submitUrl?: string;
    costPerArticle: number;
    dailyLimit: number;
    reviewHours: number;
    industries: SubmissionIndustry[];
    aiSources: SubmissionAiSource[];
    remark?: string;
    isDuplicate: boolean;
  }>;
  importToken: string;
}

export interface SubmissionChannelImportConfirmResponse {
  inserted: number;
  duplicate: number;
}

export interface SubmissionChannelStats {
  total: number;
  byType: Record<SubmissionChannelType, number>;
  byLibraryType: Record<SubmissionLibraryType, number>;
  commonCount: number;
  commonPresetCount: number;
  commonManualCount: number;
  selfMediaPackCount: number;
  tierCounts: Record<SubmissionChannelTier, number>;
  toBeDeprecatedCount: number;
}

export interface SubmissionUrlStats {
  total: number;
  withUrl: number;
  searchDirect: number;
  noEntry: number;
  selfSite: number;
  withoutUrl: number;
  coverageRate: number;
}

export interface BatchUrlPatchRequest {
  rows: Array<{ name: string; libraryType?: string; url: string }>;
  brandId?: string;
}

export interface BatchUrlPatchResult {
  totalRows: number;
  successCount: number;
  unmatchedCount: number;
  ambiguousCount: number;
  unmatchedItems: Array<{ name: string; libraryType?: string; url: string; reason: string }>;
}

export interface SourceUrlLog {
  id: string;
  operatorId: string;
  operatorName: string;
  totalRows: number;
  successCount: number;
  unmatchedCount: number;
  ambiguousCount: number;
  unmatchedItems: Array<{ name: string; libraryType?: string; url: string; reason: string }>;
  createdAt: string;
}

export interface SourceUrlLogListResponse {
  items: SourceUrlLog[];
}

export interface EliminationScanItem {
  id: string;
  name: string;
  channelType: SubmissionChannelType;
  citeRate: number;
  lastCiteAt: string | null;
  indexRate: number;
  platformCoverage: DiagnosisPlatform[];
  citeSnapshots: number;
  reason: string;
}

export interface EliminationScanResult {
  total: number;
  items: EliminationScanItem[];
}

export type EliminationAction = 'keep' | 'mark_deprecated' | 'archive';

export interface EliminationBatchRequest {
  ids: string[];
  action: EliminationAction;
}

// ========== 信源投放台账 ==========

export interface PublishLedgerQuery {
  brandId?: string;
  channelType?: SubmissionChannelType;
  status?: PublishStatus;
  page?: number;
  limit?: number;
}

export interface PublishLedgerItem {
  channelId: string | null;
  channelName: string;
  channelType: SubmissionChannelType | 'unbound';
  brandId: string | null;
  brandName: string | null;
  submittedCount: number;
  publishedCount: number;
  failedCount: number;
  lastSubmitAt: string | null;
  latestPublishUrl: string | null;
  hasPublished: boolean;
  accountCount: number;
  indexStatus: IndexStatus;
  citeCount: number;
  aiPlatforms: SubmissionAiSource[];
}

export interface LedgerAccountDetail {
  accountId: string | null;
  accountName: string | null;
  platform: string | null;
  submittedCount: number;
  publishedCount: number;
  failedCount: number;
  lastPublishAt: string | null;
  latestPublishUrl: string | null;
  indexed: boolean | null;
}

export interface LedgerAccountDetailResponse {
  items: LedgerAccountDetail[];
}

export interface PublishLedgerStats {
  totalChannels: number;
  activeChannels: number;
  totalPublished: number;
  totalFailed: number;
  activeAccounts: number;
}

export interface PublishLedgerResponse {
  items: PublishLedgerItem[];
  total: number;
  page: number;
  limit: number;
  stats: PublishLedgerStats;
}

export interface PublishLedgerDetailItem {
  id: string;
  title: string;
  status: PublishStatus;
  createdAt: string;
  publishUrl: string | null;
}

export interface PublishLedgerDetailResponse {
  items: PublishLedgerDetailItem[];
}

// ========== 投稿队列 ==========

export const SUBMISSION_QUEUE_STATUSES = [
  'pending',
  'submitted',
  'indexed',
  'rejected',
  'failed',
  'cancelled',
] as const;
export type SubmissionQueueStatus = (typeof SUBMISSION_QUEUE_STATUSES)[number];
export const isSubmissionQueueStatus = (v: string): v is SubmissionQueueStatus =>
  (SUBMISSION_QUEUE_STATUSES as readonly string[]).includes(v);
export const SUBMISSION_QUEUE_STATUS_LABELS: Record<SubmissionQueueStatus, string> = {
  pending: '待发布',
  submitted: '已提交待审核',
  indexed: '已收录',
  rejected: '未收录',
  failed: '发布失败',
  cancelled: '已取消',
};

export const SUBMISSION_REJECT_CATEGORIES = [
  'content_violation',
  'need_payment',
  'too_many_similar',
  'other',
] as const;
export type SubmissionRejectCategory = (typeof SUBMISSION_REJECT_CATEGORIES)[number];
export const SUBMISSION_REJECT_CATEGORY_LABELS: Record<SubmissionRejectCategory, string> = {
  content_violation: '内容不合规',
  need_payment: '需付费',
  too_many_similar: '同类过多',
  other: '其他',
};

export interface SubmissionQueueItem {
  id: string;
  brandId: string;
  articleId: string | null;
  channelId: string;
  channelName: string;
  channelType: SubmissionChannelType;
  title: string;
  content: string | null;
  tags: string[];
  coverUrl: string | null;
  wordCount: number;
  status: SubmissionQueueStatus;
  submitUrl: string | null;
  indexedUrl: string | null;
  indexedAt: string | null;
  rejectReason: string | null;
  rejectCategory: string | null;
  createdAt: string;
}

export interface SubmissionQueueQuery {
  page?: number;
  pageSize?: number;
  brandId?: string;
  channelId?: string;
  status?: SubmissionQueueStatus;
  startDate?: string;
  endDate?: string;
  keyword?: string;
}

export interface SubmissionQueueListResponse {
  items: SubmissionQueueItem[];
  total: number;
  page: number;
  pageSize: number;
}

export interface EnqueueSubmissionRequest {
  articleId: string;
  channelId: string;
  brandId?: string;
}

export interface SubmissionStatusUpdateRequest {
  status: SubmissionQueueStatus;
  url?: string;
  rejectReason?: string;
  rejectCategory?: SubmissionRejectCategory;
  indexedAt?: string;
}

export interface PendingSubmissionTask {
  id: string;
  title: string;
  content: string | null;
  tags: string[];
  coverUrl: string | null;
  channelId: string;
  channelName: string;
  channelType: SubmissionChannelType;
  submitUrl: string | null;
  requiredFields: string[];
}

export interface SubmissionResultRequest {
  status: 'success' | 'failed';
  screenshotUrl?: string;
  error?: string;
}

// ============ 竞品对比 ============

export interface CompetitorCompareRequest {
  brandReportId: string;
  competitorReportIds: string[];
}

export interface CompetitorDimensionScore {
  name: string;
  label: string;
  score: number;
}

export interface CompetitorBrandData {
  brandId: string;
  brandName: string;
  reportId: string;
  dimensions: CompetitorDimensionScore[];
  sov: number;
}

export interface CompetitorQuestionCompare {
  question: string;
  platform: string;
  brands: Array<{
    brandName: string;
    isMentioned: boolean;
    mentionPosition: string | null;
    isOwn: boolean;
  }>;
}

export interface CompetitorGapAlert {
  question: string;
  platform: string;
  competitorName: string;
  competitorPosition: string | null;
  suggestion: string;
}

export interface CompetitorCompareResponse {
  ownBrand: CompetitorBrandData;
  competitors: CompetitorBrandData[];
  questionCompare: CompetitorQuestionCompare[];
  gapAlerts: CompetitorGapAlert[];
  totalQuestions: number;
}

// ============ 词池机会分 ============

export interface KeywordPoolItemWithOpportunity extends KeywordPoolItem {
  opportunityScore: number;
  opportunityReasons: string[];
  hasContentCovered: boolean;
  competitorMentioned: boolean;
  notHit: boolean;
  highIntent: boolean;
}

// ============ 内容合规预检 ============

export const COMPLIANCE_RISK_LEVELS = ['pass', 'warn', 'block'] as const;
export type ComplianceRiskLevel = (typeof COMPLIANCE_RISK_LEVELS)[number];
export const COMPLIANCE_RISK_LABELS: Record<ComplianceRiskLevel, string> = {
  pass: '通过',
  warn: '警告',
  block: '拦截',
};

export interface ComplianceCheckHit {
  word: string;
  category: string;
  suggestion: string;
  position: number;
}

export interface ComplianceCheckRequest {
  title: string;
  content: string;
  articleId?: string;
}

export interface ComplianceCheckResponse {
  riskLevel: ComplianceRiskLevel;
  hits: ComplianceCheckHit[];
  totalHits: number;
  checkedAt: string;
  recordId?: string;
}

// ============================================================
//  AI 模型接入
// ============================================================

export const AI_VENDORS = [
  'volcano',
  'deepseek',
  'qwen',
  'kimi',
  'zhipu',
  'minimax',
  'wenxin',
  'hunyuan',
  'spark',
  'openai',
  'gemini',
  'siliconflow',
] as const;
export type AiVendor = (typeof AI_VENDORS)[number];

export const AI_VENDOR_LABELS: Record<AiVendor, string> = {
  volcano: '火山方舟（豆包）',
  deepseek: 'DeepSeek',
  qwen: '通义千问',
  kimi: 'Kimi（月之暗面）',
  zhipu: '智谱 GLM',
  minimax: 'MiniMax',
  wenxin: '百度文心',
  hunyuan: '腾讯混元',
  spark: '讯飞星火',
  openai: 'OpenAI',
  gemini: 'Gemini',
  siliconflow: '硅基流动',
};

export const AI_VENDOR_MODELS: Record<AiVendor, string[]> = {
  volcano: ['doubao-seed-1-6', 'doubao-pro-32k', 'doubao-lite-32k'],
  deepseek: ['deepseek-chat', 'deepseek-reasoner'],
  qwen: ['qwen-plus', 'qwen-max', 'qwen-turbo'],
  kimi: ['kimi-k2', 'moonshot-v1-8k'],
  zhipu: ['glm-4', 'glm-4-flash'],
  minimax: ['abab6.5s-chat'],
  wenxin: ['ernie-4.0', 'ernie-speed'],
  hunyuan: ['hunyuan-turbo'],
  spark: ['generalv3.5', '4.0Ultra'],
  openai: ['gpt-4o-mini', 'gpt-4o'],
  gemini: ['gemini-2.0-flash', 'gemini-2.5-pro'],
  siliconflow: ['Qwen/Qwen2.5-7B-Instruct', 'deepseek-ai/DeepSeek-V3'],
};

export const AI_VENDOR_DEFAULT_BASE_URL: Record<AiVendor, string> = {
  volcano: 'https://ark.cn-beijing.volces.com/api/v3',
  deepseek: 'https://api.deepseek.com/v1',
  qwen: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
  kimi: 'https://api.moonshot.cn/v1',
  zhipu: 'https://open.bigmodel.cn/api/paas/v4',
  minimax: 'https://api.minimax.chat/v1',
  wenxin: 'https://qianfan.baidubce.com/v2',
  hunyuan: 'https://api.hunyuan.cloud.tencent.com/v1',
  spark: 'https://spark-api-open.xf-yun.com/v1',
  openai: 'https://api.openai.com/v1',
  gemini: 'https://generativelanguage.googleapis.com/v1beta/openai',
  siliconflow: 'https://api.siliconflow.cn/v1',
};

export const AI_KEY_STATUSES = ['unconfigured', 'configured', 'ok', 'failed'] as const;
export type AiKeyStatus = (typeof AI_KEY_STATUSES)[number];
export const AI_KEY_STATUS_LABELS: Record<AiKeyStatus, string> = {
  unconfigured: '未配置',
  configured: '已配置 · 未验证',
  ok: '已连接',
  failed: '连接失败',
};

export interface AiKeyItem {
  vendor: AiVendor;
  model: string | null;
  baseUrl: string | null;
  apiKey: string | null;
  isDefault: boolean;
  status: AiKeyStatus;
  ownerType: 'client' | 'platform' | 'brand';
  lastTestedAt: string | null;
  lastTestError: string | null;
  brandOverride?: boolean;
}

export interface AiKeyListResponse {
  items: AiKeyItem[];
  defaultVendor: AiVendor | null;
  defaultSource: 'client' | 'platform' | 'brand' | null;
  balance: number;
  balanceBrandId: string | null;
  balanceBrandName: string | null;
  monthlyCalls: number;
  monthlyTokens: number;
}

export interface AiKeyUpsertRequest {
  model?: string;
  baseUrl?: string;
  apiKey?: string;
}

export interface AiTestResponse {
  ok: boolean;
  status: number;
  latencyMs: number;
  raw: string;
  errorMessage?: string;
  errorCode?: string;
}

export interface SetDefaultRequest {
  vendor: AiVendor;
}

// ============================================================
//  充值申请
// ============================================================

export const CREDIT_PACKAGES = ['basic', 'standard', 'premium'] as const;
export type CreditPackage = (typeof CREDIT_PACKAGES)[number];
export const CREDIT_PACKAGE_INFO: Record<CreditPackage, { name: string; amount: number; priceLabel: string }> = {
  basic: { name: '基础包', amount: 10000, priceLabel: '联系服务商报价' },
  standard: { name: '标准包', amount: 50000, priceLabel: '联系服务商报价' },
  premium: { name: '专业包', amount: 200000, priceLabel: '联系服务商报价' },
};

export const CREDIT_REQUEST_STATUSES = ['pending', 'approved', 'rejected'] as const;
export type CreditRequestStatus = (typeof CREDIT_REQUEST_STATUSES)[number];

export const CREDIT_REQUEST_STATUS_LABELS: Record<CreditRequestStatus, string> = {
  pending: '待处理',
  approved: '已到账',
  rejected: '已驳回',
};

export interface CreditRequestCreateRequest {
  packageType: CreditPackage;
  brandId: string;
}

export interface CreditRequestItem {
  id: number;
  brandId: string | null;
  brandName: string | null;
  package: string | null;
  packageName: string | null;
  amount: number | null;
  status: CreditRequestStatus;
  createdAt: string | null;
  processedAt: string | null;
  rejectReason: string | null;
}

export interface CreditRequestListResponse {
  items: CreditRequestItem[];
  total: number;
  pendingCount: number;
}

// ============================================================
//  服务商模块：套餐管理
// ============================================================

export interface PlanItem {
  id: string;
  planName: string;
  planCode: string;
  price: number;
  creditAmount: number;
  validityMonths: number;
  unitPrice: number;
  dailyPublishLimit: number;
  description: string | null;
  isActive: boolean;
  sortOrder: number;
}

export interface PlanListResponse {
  items: PlanItem[];
  total: number;
}

export interface PlanUpsertRequest {
  planName: string;
  planCode: string;
  price: number;
  creditAmount: number;
  validityMonths: number;
  dailyPublishLimit: number;
  unitPrice?: number;
  description?: string;
  isActive?: boolean;
  sortOrder?: number;
}

// ============================================================
//  服务商模块：客户开通与续费
// ============================================================

export type CustomerExpiryStatus = 'normal' | 'warning' | 'expired' | 'unset';

export interface CreateCustomerFullRequest {
  companyName: string;
  brandName: string;
  industry?: string;
  contactPerson?: string;
  contactPhone: string;
  planId: string;
  initialCredit: number;
  serviceEnd: string;
  username: string;
  password: string;
}

export interface CustomerLoginCard {
  companyName: string;
  loginUrl: string;
  username: string;
  password: string;
  planName: string;
  creditAmount: number;
  serviceEnd: string;
}

export interface CustomerCreateResponse {
  brandId: string;
  userId: string;
  loginCard: CustomerLoginCard;
}

export interface CustomerResetPasswordResponse {
  userId: string;
  newPassword: string;
}

export interface UpdatePlanRequest {
  planId: string;
  serviceEnd: string;
}

export interface RenewRequest {
  planId?: string;
  customAmount?: number;
  customCredit?: number;
  customMonths?: number;
  remark?: string;
}

export interface RenewResponse {
  brandId: string;
  newServiceEnd: string;
  addedCredit: number;
  newBalance: number;
  paymentAmount: number;
  transactionId: string;
}

// ============================================================
//  服务商模块：算力总览
// ============================================================

export type CreditHealthStatus = 'sufficient' | 'low' | 'critical';

export interface CreditOverviewStats {
  totalBalance: number;
  monthlyConsumed: number;
  monthlyRecharged: number;
}

export interface CreditBrandRow {
  brandId: string;
  brandName: string;
  companyName: string | null;
  planName: string | null;
  balance: number;
  monthlyConsumed: number;
  monthlyRecharged: number;
  lastConsumedAt: string | null;
  healthStatus: CreditHealthStatus;
}

export interface CreditOverviewResponse {
  stats: CreditOverviewStats;
  items: CreditBrandRow[];
  total: number;
}

export interface BatchRechargeRequest {
  brandIds: string[];
  amount: number;
  remark?: string;
}

export interface BatchRechargeResult {
  successCount: number;
  failedCount: number;
}

export interface ConsumptionRankItem {
  brandId: string;
  brandName: string;
  amount: number;
}

export interface MonthlyBillRow {
  brandId: string;
  brandName: string;
  companyName: string | null;
  openingBalance: number;
  monthlyConsumed: number;
  monthlyRecharged: number;
  closingBalance: number;
  amountYuan?: number;
}

export interface MonthlyBillResponse {
  month: string;
  items: MonthlyBillRow[];
  total: number;
  totalOpening: number;
  totalConsumed: number;
  totalRecharged: number;
  totalClosing: number;
  totalAmountYuan?: number;
  hasUnitPrice: boolean;
}

// ============================================================
//  服务商模块：交付看板
// ============================================================

export type DeliveryStatus = 'normal' | 'lagging' | 'stagnant';

export interface DeliveryBrandItem {
  brandId: string;
  brandName: string;
  companyName: string | null;
  planName: string | null;
  expiryStatus: CustomerExpiryStatus;
  diagnosisCount: number;
  lastDiagnosisAt: string | null;
  keywordCount: number;
  keywordHitRate: number | null;
  monthlyArticles: number;
  monthlyPublications: number;
  lastActivityAt: string | null;
  deliveryStatus: DeliveryStatus;
}

export interface DeliveryOverviewResponse {
  activeCustomers: number;
  producingCustomers: number;
  laggingCustomers: number;
  stagnantCustomers: number;
  items: DeliveryBrandItem[];
  total: number;
}

export interface ActivityTimelineItem {
  id: string;
  type: 'diagnosis' | 'article' | 'publish' | 'recharge' | 'adjustment' | 'keyword';
  typeLabel: string;
  title: string;
  amount?: number;
  createdAt: string;
}

export const AI_DETECT_PLATFORMS = ['volcano', 'qwen', 'hunyuan', 'deepseek', 'kimi', 'wenxin'] as const;
export type AiDetectPlatform = (typeof AI_DETECT_PLATFORMS)[number];
export const AI_DETECT_PLATFORM_LABELS: Record<AiDetectPlatform, string> = {
  volcano: '豆包',
  qwen: '通义千问',
  hunyuan: '腾讯元宝',
  deepseek: 'DeepSeek',
  kimi: 'Kimi',
  wenxin: '文心一言',
};

export const AI_DETECT_TASK_STATUSES = ['pending', 'running', 'completed', 'partial_failed', 'paused'] as const;
export type AiDetectTaskStatus = (typeof AI_DETECT_TASK_STATUSES)[number];
export const AI_DETECT_TASK_STATUS_LABELS: Record<AiDetectTaskStatus, string> = {
  pending: '待运行',
  running: '运行中',
  completed: '已完成',
  partial_failed: '部分失败',
  paused: '已暂停',
};

export interface AiDetectTask {
  id: string;
  brandId: string;
  brandName: string;
  keywords: string[];
  platforms: AiDetectPlatform[];
  hitWords: string[];
  concurrency: number;
  status: AiDetectTaskStatus;
  totalCount: number;
  doneCount: number;
  failedCount: number;
  error: string | null;
  creatorId: string;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
}

export interface AiDetectResult {
  id: string;
  taskId: string;
  brandId: string;
  keyword: string;
  parentKeyword: string | null;
  platform: AiDetectPlatform;
  modelName: string;
  question: string;
  rawAnswer: string | null;
  isMentioned: boolean;
  mentionRank: number | null;
  mentionPosition: string | null;
  competitorBrands: string[];
  sourceDomains: string[];
  latencyMs: number | null;
  httpStatus: number | null;
  errorMessage: string | null;
  executedAt: string | null;
}

export interface AiDetectTaskSummary {
  mentionRate: number;
  mentionRateByPlatform: Record<AiDetectPlatform, number>;
  avgRank: number | null;
  avgRankByPlatform: Record<AiDetectPlatform, number | null>;
  coveredKeywords: number;
  failedCount: number;
}

export interface AiDetectCreateRequest {
  brandId: string;
  keywords: string[];
  platforms: AiDetectPlatform[];
  hitWords?: string[];
  concurrency?: number;
}

export interface AiDetectResultListResponse {
  items: AiDetectResult[];
  summary: AiDetectTaskSummary;
}

export interface AiDetectKeywordVisibility {
  keyword: string;
  platforms: Record<AiDetectPlatform, {
    status: 'mentioned' | 'not_mentioned' | 'untested';
    rank: number | null;
    mentionPosition: string | null;
    testedAt: string | null;
    resultId: string | null;
  }>;
}

export interface AiDetectVisibilityResponse {
  items: AiDetectKeywordVisibility[];
  stats: {
    testedKeywords: number;
    avgMentionRate: number;
    mentionRateByPlatform: Record<AiDetectPlatform, number>;
  };
}

export interface AiDetectPlatformStatItem {
  platform: AiDetectPlatform;
  label: string;
  totalCount: number;
  mentionCount: number;
  mentionRate: number;
}

export interface AiDetectResultsStats {
  totalCount: number;
  mentionCount: number;
  mentionRate: number;
  coveredPlatforms: number;
  platforms: AiDetectPlatformStatItem[];
}

export interface AiDetectPlatformStatusItem {
  platform: AiDetectPlatform;
  label: string;
  isConfigured: boolean;
  configured: boolean;
  model: string | null;
}

export interface AiDetectPlatformsStatusResponse {
  platforms: AiDetectPlatformStatusItem[];
}

export interface BrandActivityResponse {
  brandId: string;
  brandName: string;
  items: ActivityTimelineItem[];
}

// ---------- 关键词指数人工采集日志 ----------

export const KEYWORD_INDEX_SOURCES = ['baidu', 'weixin'] as const;
export type KeywordIndexSource = (typeof KEYWORD_INDEX_SOURCES)[number];
export const KEYWORD_INDEX_SOURCE_LABELS: Record<KeywordIndexSource, string> = {
  baidu: '百度指数',
  weixin: '微信指数',
};

export const KEYWORD_INDEX_PERIODS = ['7d', '30d', '90d'] as const;
export type KeywordIndexPeriod = (typeof KEYWORD_INDEX_PERIODS)[number];
export const KEYWORD_INDEX_PERIOD_LABELS: Record<KeywordIndexPeriod, string> = {
  '7d': '7天',
  '30d': '30天',
  '90d': '90天',
};

export interface KeywordIndexLog {
  id: string;
  keywordId: string;
  keywordText: string;
  source: KeywordIndexSource;
  value: number;
  period: KeywordIndexPeriod;
  collectedAt: string;
  screenshotUrl: string;
  ocrText: string | null;
  remark: string | null;
  createdBy: string | null;
  createdAt: string;
}

export interface KeywordIndexLatestBySource {
  baidu: KeywordIndexLog | null;
  weixin: KeywordIndexLog | null;
}

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

export interface KeywordIndexBatchQuery {
  keywordIds: string[];
}

export interface KeywordIndexLogResponse {
  success: boolean;
  data: KeywordIndexLog;
  message?: string;
}

export interface KeywordIndexBatchResponse {
  success: boolean;
  data: Record<string, KeywordIndexLatestBySource>;
  message?: string;
}

export interface KeywordIndexListResponse {
  success: boolean;
  data: KeywordIndexLog[];
  message?: string;
}

// ============ 统一分页 ============

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface PaginationQuery {
  page?: number;
  pageSize?: number;
}

// ============ 自动发布任务 ============

export const AUTO_PUBLISH_STATUS = ['running', 'paused', 'stopped', 'completed'] as const;
export type AutoPublishStatus = (typeof AUTO_PUBLISH_STATUS)[number];
export const isAutoPublishStatus = (v: string): v is AutoPublishStatus =>
  (AUTO_PUBLISH_STATUS as readonly string[]).includes(v);
export const AUTO_PUBLISH_STATUS_LABELS: Record<AutoPublishStatus, string> = {
  running: '进行中',
  paused: '已暂停',
  stopped: '已终止',
  completed: '已完成',
};

export const AUTO_PUBLISH_LIBRARY = ['public', 'authoritative', 'b2b_alliance', 'multimodal', 'self_site'] as const;
export type AutoPublishLibrary = (typeof AUTO_PUBLISH_LIBRARY)[number];
export const isAutoPublishLibrary = (v: string): v is AutoPublishLibrary =>
  (AUTO_PUBLISH_LIBRARY as readonly string[]).includes(v);
export const AUTO_PUBLISH_LIBRARY_LABELS: Record<AutoPublishLibrary, string> = {
  public: '公共媒体库',
  authoritative: '权威媒体库',
  b2b_alliance: 'B2B联盟',
  multimodal: '多模态信源',
  self_site: '客户自有站点',
};

export const CHANNEL_SOURCE = ['self_media', 'market'] as const;
export type ChannelSource = (typeof CHANNEL_SOURCE)[number];
export const isChannelSource = (v: string): v is ChannelSource =>
  (CHANNEL_SOURCE as readonly string[]).includes(v);
export const CHANNEL_SOURCE_LABELS: Record<ChannelSource, string> = {
  self_media: '自媒体账号',
  market: '媒体商城渠道',
};

export interface AutoPublishTask {
  id: string;
  brandId: string;
  brandName: string;
  taskName: string;
  libraryType: AutoPublishLibrary;
  channelIds: string[];
  articleIds: string[];
  startDate: string;
  endDate: string;
  dailyLimit: number;
  status: AutoPublishStatus;
  publishedCount: number;
  totalCount: number;
  excludedArticleCount?: number;
  error: string | null;
  creatorId: string;
  creatorName: string | null;
  channelSource: ChannelSource;
  marketChannelIds: string[];
  budgetCents: number | null;
  publishIntervalMinutes: number | null;
  sourceRule: {
    platforms: string[];
    region?: string;
    industry?: string;
    mediaType?: string;
    budgetMax?: number;
  } | null;
  sourceSelectionMode: 'manual' | 'auto';
  createdAt: string;
  updatedAt: string;
}

export interface AutoPublishTaskListQuery extends PaginationQuery {
  brandId?: string;
  libraryType?: AutoPublishLibrary;
  status?: AutoPublishStatus;
  keyword?: string;
}

export interface CreateAutoPublishTaskRequest {
  brandId: string;
  taskName: string;
  libraryType: AutoPublishLibrary;
  channelIds: string[];
  articleIds: string[];
  startDate: string;
  endDate: string;
  dailyLimit: number;
  accountId?: string;
  channelSource: ChannelSource;
  marketChannelIds?: string[];
  budgetCents?: number;
  publishIntervalMinutes?: number;
  sourceRule?: {
    platforms: string[];
    region?: string;
    industry?: string;
    mediaType?: string;
    budgetMax?: number;
  };
  sourceSelectionMode?: 'manual' | 'auto';
}

export interface UpdateAutoPublishTaskRequest {
  taskName?: string;
  channelIds?: string[];
  articleIds?: string[];
  startDate?: string;
  endDate?: string;
  dailyLimit?: number;
  status?: AutoPublishStatus;
  channelSource?: ChannelSource;
  marketChannelIds?: string[];
  budgetCents?: number;
  publishIntervalMinutes?: number;
  sourceRule?: {
    platforms: string[];
    region?: string;
    industry?: string;
    mediaType?: string;
    budgetMax?: number;
  };
  sourceSelectionMode?: 'manual' | 'auto';
}

// ============ 长尾词组合配置 ============

export const LONGTAIL_CONFIG_TYPES = ['prefix', 'suffix'] as const;
export type LongtailConfigType = (typeof LONGTAIL_CONFIG_TYPES)[number];

export interface LongtailConfig {
  id: string;
  brandId: string;
  groupId: string | null;
  configType: LongtailConfigType;
  words: string[];
  createdAt: string;
  updatedAt: string;
}

export interface SaveLongtailConfigRequest {
  brandId: string;
  groupId?: string | null;
  configType: LongtailConfigType;
  words: string[];
}

export interface LongtailCombineResult {
  word: string;
  inPool: boolean;
}

export interface LongtailCombinePreview {
  total: number;
  deduplicated: number;
}

export interface BatchAddKeywordsRequest {
  brandId: string;
  groupId?: string | null;
  keywords: string[];
  parentKeywordId?: string;
}

// ============ 工作台 AI 平台覆盖 ============

export interface AiPlatformCoverage {
  platform: string;
  platformLabel: string;
  keywordCount: number;
  avgMentionRate: number;
  avgRank: number | null;
}

export interface HotKeywordRank {
  keyword: string;
  extendedKeyword: string;
  platform: string;
  platformLabel: string;
  rank: number;
}

export interface DashboardStatsQuery {
  range?: 'all' | 'today' | 'yesterday' | '7d' | '30d';
  brandId?: string;
}

export interface AiPlatformDistributionItem {
  platform: string;
  sampleCount: number;
  hitCount: number;
  hitRate: number;
}

export interface WorkbenchStats {
  articleCount: number;
  publicationCount: number;
  aiMentionCount: number;
  aiSampleCount: number;
  aiHitRate: number;
  aiPlatformDistribution: AiPlatformDistributionItem[];
  mediaOrderCount: number;
  mediaRevenueCents: number;
  deliveryArticleCount: number;
  deliveryScheduledCount: number;
  deliveryPublishedCount: number;
  deliveryPendingCount: number;
  deliveryMonthlySpendCents: number;
}

export const ACCOUNT_PLATFORMS = [
  'baijiahao', 'toutiao', 'sohu', 'wangyi', 'zhihu',
  'wechat', 'douyin', 'xiaohongshu', 'weibo', 'bilibili', 'other',
] as const;
export type AccountPlatform = (typeof ACCOUNT_PLATFORMS)[number];
export const ACCOUNT_PLATFORM_LABELS: Record<AccountPlatform, string> = {
  baijiahao: '百家号', toutiao: '头条号', sohu: '搜狐号',
  wangyi: '网易号', zhihu: '知乎', wechat: '公众号',
  douyin: '抖音', xiaohongshu: '小红书', weibo: '微博',
  bilibili: 'B站', other: '其他',
};
export const isAccountPlatform = (v: string): v is AccountPlatform =>
  (ACCOUNT_PLATFORMS as readonly string[]).includes(v);

export const AUTH_METHODS = ['qr_code', 'client', 'manual'] as const;
export type AuthMethod = (typeof AUTH_METHODS)[number];
export const AUTH_METHOD_LABELS: Record<AuthMethod, string> = {
  qr_code: '扫码授权', client: '客户端授权', manual: '手工登记',
};

export const AUTH_STATUSES = ['authorized', 'unauthorized', 'expired'] as const;
export type AuthStatus = (typeof AUTH_STATUSES)[number];
export const AUTH_STATUS_LABELS: Record<AuthStatus, string> = {
  authorized: '已授权', unauthorized: '未授权', expired: '已过期',
};

export const ONLINE_STATUSES = ['online', 'offline'] as const;
export type OnlineStatus = (typeof ONLINE_STATUSES)[number];
export const ONLINE_STATUS_LABELS: Record<OnlineStatus, string> = {
  online: '在线', offline: '离线',
};

export interface AccountAuth {
  id: string;
  brandId: string;
  platform: AccountPlatform;
  accountName: string;
  accountIdentifier: string | null;
  authMethod: AuthMethod;
  authStatus: AuthStatus;
  lastAuthAt: string | null;
  lastHeartbeatAt: string | null;
  onlineStatus: OnlineStatus;
  clientVersion: string | null;
  remark: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AccountAuthCreateRequest {
  brandId: string;
  platform: AccountPlatform;
  accountName: string;
  accountIdentifier?: string;
  authMethod: AuthMethod;
  remark?: string;
}

export interface AccountAuthUpdateRequest {
  accountName?: string;
  accountIdentifier?: string;
  authMethod?: AuthMethod;
  remark?: string;
}

export interface AccountAuthListQuery {
  page?: number;
  pageSize?: number;
  brandId?: string;
  platform?: AccountPlatform;
  authStatus?: AuthStatus;
  keyword?: string;
}

export interface AccountAuthListResponse {
  items: AccountAuth[];
  total: number;
  page: number;
  pageSize: number;
}

export interface AccountAuthCodeResponse {
  authCode: string;
  expiresAt: string;
}

export interface AccountPlatformCard {
  platform: AccountPlatform;
  total: number;
  authorized: number;
  accounts: AccountAuth[];
}

export interface ClientBindRequest {
  authCode: string;
  clientVersion?: string;
}

export interface ClientBindResponse {
  accountId: string;
  platform: AccountPlatform;
  accountName: string;
  token: string;
}

export interface ClientHeartbeatRequest {
  token: string;
  clientVersion?: string;
}

export interface ClientHeartbeatResponse {
  ok: boolean;
  nextHeartbeatIn: number;
}

export interface ClientTaskItem {
  id: string;
  title: string;
  content: string | null;
  coverUrl: string | null;
  tags: string[];
  platform: AccountPlatform | null;
  accountName: string | null;
  channelName: string | null;
  claimedAt: string | null;
}

export interface ClientTaskListResponse {
  tasks: ClientTaskItem[];
}

export interface ClientTaskResultRequest {
  token: string;
  taskId: string;
  success: boolean;
  publishUrl?: string;
  error?: string;
  publishedAt?: string;
}

export const CLIENT_QUEUE_STATUSES = ['pending_client', 'client_running'] as const;
export type ClientQueueStatus = (typeof CLIENT_QUEUE_STATUSES)[number];

// ---------- AI 引用反查探针（Citation Probe） ----------

export const CITATION_PROBE_STATUS = ['pending', 'completed', 'failed'] as const;
export type CitationProbeStatus = (typeof CITATION_PROBE_STATUS)[number];
export const isCitationProbeStatus = (v: string): v is CitationProbeStatus =>
  (CITATION_PROBE_STATUS as readonly string[]).includes(v);
export const CITATION_PROBE_STATUS_LABELS: Record<CitationProbeStatus, string> = {
  pending: '待执行',
  completed: '已完成',
  failed: '执行失败',
};

export interface CitationProbeTask {
  id: string;
  brandId: string;
  brandName: string;
  brandAliases: string[];
  keywordIds: string[];
  keywords: string[];
  platforms: DiagnosisPlatform[];
  questions: string[];
  status: CitationProbeStatus;
  totalCount: number;
  completedCount: number;
  error: string | null;
  creatorId: string;
  createdAt: string;
  updatedAt: string;
}

export interface CitationProbeResult {
  id: string;
  taskId: string | null;
  brandId: string;
  question: string;
  platform: DiagnosisPlatform;
  isMentioned: boolean;
  mentionPosition: number | null;
  sourceUrls: string[];
  rawAnswer: string | null;
  status: CitationProbeStatus;
  error: string | null;
  executedAt: string | null;
  creatorId: string;
  createdAt: string;
}

export interface CitationProbeTaskListResponse extends PagedResponse<CitationProbeTask> {}
export interface CitationProbeResultListResponse extends PagedResponse<CitationProbeResult> {}

export interface CitationProbeKpiResponse {
  totalProbes: number;
  mentionRate: number;
  avgPosition: number | null;
  citedSourceCount: number;
}

export interface CitationProbePlatformDistributionItem {
  platform: DiagnosisPlatform;
  mentioned: number;
  total: number;
}

export interface CreateCitationProbeTaskRequest {
  brandId: string;
  brandName: string;
  brandAliases?: string[];
  keywordIds?: string[];
  keywords?: string[];
  platforms: DiagnosisPlatform[];
  questions: string[];
}

export interface CreateManualSnapshotRequest {
  brandId: string;
  brandAliases?: string[];
  question: string;
  platform: DiagnosisPlatform;
  rawAnswer: string;
  taskId?: string;
}

export interface GenerateQuestionsRequest {
  keywords: string[];
  count?: number;
}

export interface GenerateQuestionsResponse {
  questions: string[];
}

export interface CitationProbeKeywordItem {
  id: string;
  keyword: string;
}

export interface CitationProbeKeywordListResponse {
  items: CitationProbeKeywordItem[];
}

export type UnifiedAccountAccessType = 'client_auth' | 'local_account' | 'cookie';
export const UNIFIED_ACCOUNT_ACCESS_TYPES = ['client_auth', 'local_account', 'cookie'] as const;
export const isUnifiedAccountAccessType = (v: string): v is UnifiedAccountAccessType =>
  (UNIFIED_ACCOUNT_ACCESS_TYPES as readonly string[]).includes(v);
export const UNIFIED_ACCOUNT_ACCESS_LABELS: Record<UnifiedAccountAccessType, string> = {
  client_auth: '客户端授权',
  local_account: '本地账号',
  cookie: 'Cookie',
};
export const UNIFIED_ACCOUNT_ACCESS_COLORS: Record<UnifiedAccountAccessType, string> = {
  client_auth: '#2E7DFF',
  local_account: '#F79009',
  cookie: '#7A5AF8',
};

export interface UnifiedAccount {
  id: string;
  accountName: string;
  platform: string;
  accessType: UnifiedAccountAccessType;
  status: string;
  lastHeartbeatAt: string | null;
  brandId: string;
  brandName: string | null;
  sourceTable: 'account_auths' | 'channels';
  sourceId: string;
}

export interface UnifiedAccountListResponse {
  items: UnifiedAccount[];
  total: number;
  platformStats: Array<{
    platform: string;
    total: number;
    authorized: number;
  }>;
}

export interface CreateUnifiedAccountRequest {
  platform: string;
  accessType: UnifiedAccountAccessType;
  brandId: string;
  accountName?: string;
  accountNameLocal?: string;
  cookie?: string;
  remark?: string;
}

export interface UnifiedAccountOption {
  id: string;
  accountName: string;
  platform: string;
  accessType: UnifiedAccountAccessType;
  sourceTable: 'account_auths' | 'channels';
  sourceId: string;
}

/* ---------- 平台能力矩阵 ---------- */

export interface PlatformCapability {
  key: string;
  name: string;
  oauth: boolean;
  oauthNote: string;
  qr: boolean;
  password: boolean;
}

export interface PlatformCapabilitiesResponse {
  platforms: PlatformCapability[];
}

/* ---------- 授权模式 ---------- */

export const AUTH_MODES = ['oauth', 'qr', 'password'] as const;
export type AuthMode = (typeof AUTH_MODES)[number];
export const AUTH_MODE_LABELS: Record<AuthMode, string> = {
  oauth: '官方授权',
  qr: '扫码授权',
  password: '密码登录',
};

/* ---------- 会话状态 ---------- */

export const SESSION_STATES = ['valid', 'expired', 'paused'] as const;
export type SessionState = (typeof SESSION_STATES)[number];
export const SESSION_STATE_LABELS: Record<SessionState, string> = {
  valid: '已授权',
  expired: '已失效',
  paused: '已暂停',
};

/* ---------- 授权码 ---------- */

export interface AuthorizeCodeRequest {
  platform: string;
  brandId: string;
  authMode: AuthMode;
}

export interface AuthorizeCodeResponse {
  accountId: string;
  code: string;
  expiresAt: string;
}

export const RESOLVE_CODE_ERRORS = {
  NOT_FOUND: 'CODE_NOT_FOUND',
  EXPIRED: 'CODE_EXPIRED',
} as const;
export type ResolveCodeErrorCode = (typeof RESOLVE_CODE_ERRORS)[keyof typeof RESOLVE_CODE_ERRORS];

export interface ResolveCodeResponse {
  accountId: string;
  platform: string;
  brandId: string;
  expiresAt: string;
}

/* ---------- 会话回传 ---------- */

export interface AccountSessionRequest {
  authMode: AuthMode;
  cookieText?: string;
  token?: string;
  expiresAt?: string;
  platformAccountName?: string;
  clientId?: string;
}

export interface AccountHeartbeatRequest {
  ok: boolean;
  checkedAt?: string;
}

/* ---------- 账号列表增强 ---------- */

export interface UnifiedAccountV2 {
  id: string;
  accountName: string;
  platform: string;
  accessType: UnifiedAccountAccessType;
  authMode: AuthMode;
  sessionState: SessionState;
  expiresAt: string | null;
  lastHeartbeatAt: string | null;
  hasSession: boolean;
  brandId: string;
  brandName: string | null;
  sourceTable: 'account_auths' | 'channels';
  sourceId: string;
}

export interface UnifiedAccountListResponseV2 {
  items: UnifiedAccountV2[];
  total: number;
  platformStats: Array<{
    platform: string;
    total: number;
    authorized: number;
  }>;
}

/* =========================================================
 * 媒体商城 / 客户钱包 / 自助发稿
 * ========================================================= */

/* ---------- 供应商 ---------- */

export const SUPPLIER_STATUS = ['active', 'inactive'] as const;
export type SupplierStatus = (typeof SUPPLIER_STATUS)[number];
export const SUPPLIER_STATUS_LABELS: Record<SupplierStatus, string> = {
  active: '合作中',
  inactive: '已停用',
};

export interface MediaSupplier {
  id: string;
  name: string;
  contact?: string;
  contactPhone?: string;
  settlementCycle?: string;
  apiBase?: string;
  status: SupplierStatus;
  markupRate: number;
  note?: string;
  createdAt: string;
}

export interface MediaSupplierListItem extends MediaSupplier {
  channelCount: number;
  sellableCount: number;
}

export interface MediaSupplierListResponse {
  items: MediaSupplierListItem[];
  total: number;
}

/* ---------- 渠道价格（admin/operator 用，含采购价） ---------- */

export interface ChannelPricingAdmin {
  id: string;
  name: string;
  libraryType?: string;
  channelType?: string;
  region?: string;
  industry?: string;
  tier?: string;
  supplierId?: string;
  supplierName?: string;
  costPriceCents: number;
  salePriceCents: number;
  priceUnit: string;
  markupRate: number;
  stock: number | null;
  turnaroundHours: number | null;
  priceUpdatedAt?: string;
  sellable: boolean;
  salePriceOverridden: boolean;
}

export interface ChannelPricingListResponse {
  items: ChannelPricingAdmin[];
  total: number;
  page: number;
  pageSize: number;
}

/* ---------- 信源类型 ---------- */

export const SOURCE_TYPES = ['self', 'supplier'] as const;
export type SourceType = (typeof SOURCE_TYPES)[number];
export const SOURCE_TYPE_LABELS: Record<SourceType, string> = {
  self: '自有信源',
  supplier: '供应商',
};

/* ---------- 渠道商城（client 用，不含采购价） ---------- */

export interface MarketChannel {
  id: string;
  name: string;
  sourceType: SourceType;
  libraryType?: string;
  channelType?: string;
  region?: string;
  industry?: string;
  industries?: string[];
  tier?: string;
  salePriceCents: number;
  priceUnit: string;
  stock: number | null;
  turnaroundHours: number | null;
  priceUpdatedAt?: string | null;
  followers?: number | null;
  aiSources?: string[];
  platformCoverage?: string[];
  submitUrl?: string;
}

export interface MarketChannelListResponse {
  items: MarketChannel[];
  total: number;
  page: number;
  pageSize: number;
}

export interface MarketFilterOptions {
  mediaTypes: string[];
  regions: string[];
  industries: string[];
  sourceTypes: SourceType[];
}

/* ---------- 商城统计 ---------- */

export interface MediaMarketStats {
  supplierCount: number;
  sellableChannelCount: number;
  selfChannelCount: number;
  pricedUnshelvedCount: number;
  avgSalePriceArticle: number;
  medianSalePriceArticle: number;
  minSalePriceArticle: number;
  maxSalePriceArticle: number;
  avgSalePriceVideo: number;
  monthlyOrderAmount: number;
  monthlyGrossProfit: number;
}

/* ---------- 批量导入 ---------- */

export interface PriceImportResult {
  parsed: number;
  success: number;
  updated: number;
  created: number;
  unmatched: number;
  failed: number;
  skipped: number;
  unmatchedItems: Array<{
    name: string;
    libraryType?: string;
    supplier?: string;
    row: number;
  }>;
  failedItems: Array<{
    name: string;
    row: number;
    reason: string;
  }>;
}

/* ---------- 钱包 ---------- */

export const WALLET_TX_TYPES = [
  'recharge',
  'consume',
  'refund',
  'gift',
  'adjust',
] as const;
export type WalletTxType = (typeof WALLET_TX_TYPES)[number];
export const WALLET_TX_TYPE_LABELS: Record<WalletTxType, string> = {
  recharge: '充值',
  consume: '消费',
  refund: '退款',
  gift: '赠送',
  adjust: '调整',
};

export interface CustomerWallet {
  id: string;
  brandId: string;
  balanceCents: number;
  frozenCents: number;
  totalRechargedCents: number;
  totalSpentCents: number;
  updatedAt: string;
}

export interface WalletTransaction {
  id: string;
  type: WalletTxType;
  amountCents: number;
  balanceAfterCents: number;
  orderId?: string;
  orderNo?: string;
  note?: string;
  createdAt: string;
}

export interface WalletTransactionListResponse {
  items: WalletTransaction[];
  total: number;
  page: number;
  pageSize: number;
}

/* ---------- 充值申请 ---------- */

export const RECHARGE_STATUS = [
  'pending',
  'approved',
  'rejected',
] as const;
export type RechargeStatus = (typeof RECHARGE_STATUS)[number];
export const RECHARGE_STATUS_LABELS: Record<RechargeStatus, string> = {
  pending: '待审核',
  approved: '已入账',
  rejected: '已驳回',
};

export interface RechargeApplication {
  id: string;
  brandId: string;
  brandName?: string;
  applyAmountCents: number;
  actualAmountCents?: number;
  status: RechargeStatus;
  rejectReason?: string;
  remark?: string;
  createdAt: string;
  auditedAt?: string;
  auditorName?: string;
}

export interface RechargeApplicationListResponse {
  items: RechargeApplication[];
  total: number;
  page: number;
  pageSize: number;
}

export interface RechargeApplicationQuery {
  status?: RechargeStatus;
  brandId?: string;
  page?: number;
  pageSize?: number;
  startDate?: string;
  endDate?: string;
}

export interface RechargeStatsResponse {
  pendingCount: number;
  pendingAmountCents: number;
  monthApprovedAmountCents: number;
}

/* ---------- 媒体订单 ---------- */

export const MEDIA_ORDER_STATUS = [
  'pending_payment',
  'paid',
  'placing',
  'published',
  'failed',
  'refunded',
] as const;
export type MediaOrderStatus = (typeof MEDIA_ORDER_STATUS)[number];
export const MEDIA_ORDER_STATUS_LABELS: Record<MediaOrderStatus, string> = {
  pending_payment: '待支付',
  paid: '已支付待发布',
  placing: '发布中',
  published: '已发布',
  failed: '发布失败',
  refunded: '已退款',
};

export interface MediaOrderTimelineItem {
  status: MediaOrderStatus | string;
  time: string;
  operatorId?: string;
  note?: string;
}

/* admin/operator 看，含采购价与供应商 */
export interface MediaOrderAdmin {
  id: string;
  orderNo: string;
  brandId: string;
  brandName?: string;
  channelId: string;
  channelName?: string;
  supplierId?: string;
  supplierName?: string;
  title: string;
  priceCents: number;
  costPriceCents: number;
  grossProfitCents: number;
  status: MediaOrderStatus;
  supplierOrderNo?: string;
  publishedUrl?: string;
  rejectReason?: string;
  remark?: string;
  timeline: MediaOrderTimelineItem[];
  createdAt: string;
  updatedAt: string;
}

/* client 看，不含采购价与供应商 */
export interface MediaOrderClient {
  id: string;
  orderNo: string;
  channelId: string;
  channelName?: string;
  title: string;
  priceCents: number;
  status: MediaOrderStatus;
  publishedUrl?: string;
  rejectReason?: string;
  remark?: string;
  timeline: MediaOrderTimelineItem[];
  createdAt: string;
}

export interface MediaOrderListResponse<T = MediaOrderAdmin> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

/* ---------- 下单请求 ---------- */

export interface CreateMediaOrderRequest {
  channelId: string;
  title: string;
  content: string;
  imageUrls?: string[];
  remark?: string;
  articleId?: string;
  source?: 'manual' | 'auto_task' | 'batch_publish';
  taskId?: string;
}

export interface BatchCreateOrdersRequest {
  channelIds: string[];
  articleId: string;
  remark?: string;
}

/* ---------- 投放记录 ---------- */

export const PLACEMENT_INDEX_STATUSES = ['pending', 'indexed', 'failed'] as const;
export type PlacementIndexStatus = (typeof PLACEMENT_INDEX_STATUSES)[number];
export const PLACEMENT_INDEX_STATUS_LABELS: Record<PlacementIndexStatus, string> = {
  pending: '待收录',
  indexed: '已收录',
  failed: '收录失败',
};

export interface PlacementRecord {
  id: string;
  orderId: string;
  orderNo: string;
  channelId: string;
  brandId: string;
  articleId?: string;
  articleTitle?: string;
  mediaName?: string;
  region?: string;
  amountCents: number;
  publishedUrl?: string;
  publishedAt?: string;
  indexStatus: PlacementIndexStatus;
  createdAt: string;
}

export interface PlacementRecordListResponse {
  items: PlacementRecord[];
  total: number;
  page: number;
  pageSize: number;
}

export interface PlacementStats {
  total: number;
  indexed: number;
  pending: number;
  thisMonth: number;
}

export interface BatchCreateOrdersResponse {
  successCount: number;
  failedCount: number;
  orderIds: string[];
  errors: string[];
}

export interface ContentDeliveryOverview {
  articleCount: number;
  scheduledCount: number;
  publishedCount: number;
  pendingCount: number;
  monthlySpendCents: number;
}

/* ---------- 供应商结算统计 ---------- */

export interface SupplierSettlementStat {
  supplierId: string;
  supplierName: string;
  orderCount: number;
  totalCostCents: number;
  unsettledCents: number;
}


/* ---------- GEO 闭环 ---------- */

// 品牌定位档案
export interface BrandProfile {
  id: string;
  brandId: string;
  positioningTagline?: string;
  industry?: string;
  targetAudience?: string;
  sellingPoints: string[];
  forbiddenPhrases?: string;
  topQuestions: string[];
  createdAt: string;
  updatedAt: string;
}

export interface BrandProfileUpsertRequest {
  brandId: string;
  positioningTagline?: string;
  industry?: string;
  targetAudience?: string;
  sellingPoints: string[];
  forbiddenPhrases?: string;
  topQuestions: string[];
}

// 内容矩阵
export const PILLAR_STATUSES = ['planned', 'writing', 'published'] as const;
export type PillarStatus = (typeof PILLAR_STATUSES)[number];
export const PILLAR_STATUS_LABELS: Record<PillarStatus, string> = {
  planned: '计划中',
  writing: '创作中',
  published: '已发布',
};

export interface ContentPillar {
  id: string;
  brandId: string;
  pillarTopic: string;
  subTopic: string;
  coverKeywords: string[];
  targetQuestion?: string;
  contentType: string;
  status: PillarStatus;
  articleId?: string;
  createdAt: string;
}

export interface PillarCreateRequest {
  brandId: string;
  pillarTopic: string;
  subTopic: string;
  coverKeywords?: string[];
  targetQuestion?: string;
  contentType?: string;
}

export interface PillarsByPillar {
  pillarTopic: string;
  subTopics: ContentPillar[];
  total: number;
  publishedCount: number;
}

// 结构检查
export interface ContentCheckDetail {
  titleScore: number;
  introScore: number;
  headingScore: number;
  faqScore: number;
  citationScore: number;
  internalLinkScore: number;
  wordCountScore: number;
}

export interface ContentCheckSuggestion {
  type: string;
  text: string;
}

export interface ContentCheck {
  id: string;
  articleId: string;
  articleTitle?: string;
  overallScore: number;
  detail: ContentCheckDetail;
  suggestions: { items: ContentCheckSuggestion[] };
  checkedAt: string;
}

// 竞对差距
export const GAP_PRIORITIES = ['high', 'medium', 'low'] as const;
export type GapPriority = (typeof GAP_PRIORITIES)[number];
export const GAP_PRIORITY_LABELS: Record<GapPriority, string> = {
  high: '高',
  medium: '中',
  low: '低',
};

export const GAP_STATUSES = ['open', 'dispatched', 'resolved', 'ignored'] as const;
export type GapStatus = (typeof GAP_STATUSES)[number];
export const GAP_STATUS_LABELS: Record<GapStatus, string> = {
  open: '待处理',
  dispatched: '已派发',
  resolved: '已解决',
  ignored: '已忽略',
};

export interface ContentGap {
  id: string;
  brandId: string;
  keyword: string;
  ourCited: boolean;
  ourSourceDomain?: string;
  competitorName: string;
  competitorDomain?: string;
  gapType: string;
  priority: GapPriority;
  status: GapStatus;
  articleId?: string;
  createdAt: string;
}

// 优化建议
export const ACTION_TYPES = ['content', 'distribution', 'indexing', 'structure'] as const;
export type ActionItemType = (typeof ACTION_TYPES)[number];
export const ACTION_TYPE_LABELS: Record<ActionItemType, string> = {
  content: '内容',
  distribution: '分发',
  indexing: '收录',
  structure: '结构',
};

export const ACTION_PRIORITIES = ['high', 'medium', 'low'] as const;
export type ActionPriority = (typeof ACTION_PRIORITIES)[number];
export const ACTION_PRIORITY_LABELS: Record<ActionPriority, string> = {
  high: '高',
  medium: '中',
  low: '低',
};

export const ACTION_STATUSES = ['pending', 'in_progress', 'done'] as const;
export type ActionStatus = (typeof ACTION_STATUSES)[number];
export const ACTION_STATUS_LABELS: Record<ActionStatus, string> = {
  pending: '待执行',
  in_progress: '进行中',
  done: '已完成',
};

export interface ActionItem {
  id: string;
  brandId: string;
  source: 'auto' | 'manual';
  title: string;
  itemType: ActionItemType;
  priority: ActionPriority;
  ownerUserId?: string;
  dueDate?: string;
  status: ActionStatus;
  relatedGapId?: string;
  relatedCheckId?: string;
  createdAt: string;
}

// GEO 闭环概览
export interface GeoLoopOverview {
  brandId: string;
  step1: {
    profileCompleted: boolean;
    profileFieldsDone: number;
    profileFieldsTotal: number;
    pillarCount: number;
    subTopicCount: number;
    publishedArticleCount: number;
    checkedArticleCount: number;
    avgStructureScore: number;
  };
  step2: { status: 'upcoming' };
  step3: { status: 'upcoming' };
  step4: {
    openGapCount: number;
    highPriorityGapCount: number;
    pendingActionCount: number;
    highPriorityActionCount: number;
  };
}

// ==================== 分发节奏 ====================

export const WEIGHT_TIERS = ['A', 'B', 'C'] as const;
export type WeightTier = (typeof WEIGHT_TIERS)[number];
export const WEIGHT_TIER_LABELS: Record<WeightTier, string> = {
  A: 'A档 · 央媒/一线门户',
  B: 'B档 · 行业/地方主流',
  C: 'C档 · 自媒体/聚合站',
};

export interface PlatformWeight {
  id: string;
  domain: string;
  weightTier: WeightTier;
  indexRate?: number;
  citationRate?: number;
  aiPlatforms: string[];
  collectedAt?: string;
}

export const DISPATCH_PLAN_STATUSES = ['planned', 'queued', 'published', 'failed'] as const;
export type DispatchPlanStatus = (typeof DISPATCH_PLAN_STATUSES)[number];
export const DISPATCH_PLAN_STATUS_LABELS: Record<DispatchPlanStatus, string> = {
  planned: '待排期',
  queued: '已下单',
  published: '已发布',
  failed: '失败',
};

export interface DispatchPlan {
  id: string;
  brandId: string;
  planDate: string;
  channelId?: string;
  articleId?: string;
  status: DispatchPlanStatus;
  orderId?: string;
  channelName?: string;
  weightTier?: WeightTier;
  title?: string;
  createdAt: string;
}

export interface DispatchOverview {
  monthlyPlanned: number;
  monthlyPublished: number;
  tierDistribution: { A: number; B: number; C: number };
}

export interface SmartScheduleRequest {
  brandId: string;
  totalArticles: number;
  weeks: number;
  perWeek: number;
  tiers: WeightTier[];
  budgetLimit?: number;
}

export interface WeeklyPlanView {
  weekStart: string;
  days: { date: string; plans: DispatchPlan[] }[];
}

export interface ConvertToOrdersRequest {
  brandId: string;
  planIds: string[];
}

export interface ConvertToOrdersResponse {
  success: number;
  failed: number;
  totalPriceCents: number;
}

// ==================== 收录引导 ====================

export const INTERNAL_LINK_STATUSES = ['planned', 'added', 'indexed'] as const;
export type InternalLinkStatus = (typeof INTERNAL_LINK_STATUSES)[number];
export const INTERNAL_LINK_STATUS_LABELS: Record<InternalLinkStatus, string> = {
  planned: '待添加',
  added: '已添加',
  indexed: '已收录',
};

export interface InternalLink {
  id: string;
  brandId: string;
  fromUrl?: string;
  toUrl?: string;
  anchorText?: string;
  status: InternalLinkStatus;
  note?: string;
  fromTitle?: string;
  toTitle?: string;
  createdAt: string;
}

export const EXTERNAL_LINK_TYPES = ['news', 'baike', 'forum', 'self_media'] as const;
export type ExternalLinkType = (typeof EXTERNAL_LINK_TYPES)[number];
export const EXTERNAL_LINK_TYPE_LABELS: Record<ExternalLinkType, string> = {
  news: '新闻源',
  baike: '百科',
  forum: '论坛',
  self_media: '自媒体',
};

export const EXTERNAL_LINK_STATUSES = ['pending', 'indexed', 'rejected'] as const;
export type ExternalLinkStatus = (typeof EXTERNAL_LINK_STATUSES)[number];
export const EXTERNAL_LINK_STATUS_LABELS: Record<ExternalLinkStatus, string> = {
  pending: '待收录',
  indexed: '已收录',
  rejected: '未通过',
};

export interface ExternalLink {
  id: string;
  brandId: string;
  resourceName: string;
  resourceType: ExternalLinkType;
  domain?: string;
  domainWeight?: WeightTier;
  linkUrl?: string;
  submittedAt?: string;
  status: ExternalLinkStatus;
  note?: string;
  createdAt: string;
}

export interface ExternalLinkOverview {
  total: number;
  indexed: number;
  pending: number;
}

export interface PageCheck {
  id: string;
  brandId: string;
  pageUrl: string;
  hasJsonld: boolean;
  hasFaq: boolean;
  hasAnswerBlock: boolean;
  hLevelOk: boolean;
  internalLinkCount: number;
  score?: number;
  suggestions?: Record<string, string>;
  checkedAt?: string;
  note?: string;
  createdAt: string;
}

export interface PageCheckCreateRequest {
  brandId: string;
  pageUrl: string;
  hasJsonld: boolean;
  hasFaq: boolean;
  hasAnswerBlock: boolean;
  hLevelOk: boolean;
  internalLinkCount: number;
  note?: string;
}

export const SEARCH_ENGINES = ['baidu', 'bing', '360', 'doubao'] as const;
export type SearchEngine = (typeof SEARCH_ENGINES)[number];
export const SEARCH_ENGINE_LABELS: Record<SearchEngine, string> = {
  baidu: '百度',
  bing: '必应',
  '360': '360',
  doubao: '豆包',
};

export const INDEXED_STATUSES = ['yes', 'no', 'unknown'] as const;
export type IndexedStatus = (typeof INDEXED_STATUSES)[number];
export const INDEXED_STATUS_LABELS: Record<IndexedStatus, string> = {
  yes: '已收录',
  no: '未收录',
  unknown: '未知',
};

export interface IndexCheck {
  id: string;
  brandId: string;
  url: string;
  searchEngine: SearchEngine;
  submittedAt: string;
  indexed: IndexedStatus;
  checkedAt?: string;
  createdAt: string;
}
