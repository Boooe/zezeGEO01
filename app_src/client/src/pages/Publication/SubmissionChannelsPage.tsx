import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useInfiniteQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import {
  Plus,
  Trash2,
  RefreshCw,
  AlertCircle,
  Play,
  Pause,
  ExternalLink,
  Send,
  Search,
  X,
  MoreHorizontal,
  Upload,
  Download,
  FileText,
  CheckCircle2,
  XCircle,
  Copy,
  LayoutGrid,
  Rows3,
  FileSpreadsheet,
  Tags,
  History,
  CheckSquare,
  Square,
  ChevronDown,
  Link as LinkIcon,
  Wand2,
} from 'lucide-react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@client/src/components/ui/card';
import { Button } from '@client/src/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@client/src/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@client/src/components/ui/table';
import { ColumnResizeHandle } from '@client/src/components/ui/column-resize-handle';
import { useResizableColumns } from '@client/src/hooks/use-resizable-columns';
import { Skeleton } from '@client/src/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from '@client/src/components/ui/dialog';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@client/src/components/ui/tabs';
import { PageHeader } from '@client/src/components/layout/PageHeader';
import { Input } from '@client/src/components/ui/input';
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@client/src/components/ui/empty';
import { Textarea } from '@client/src/components/ui/textarea';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@client/src/components/ui/dropdown-menu';
import { Switch } from '@client/src/components/ui/switch';
import {
  list,
  create,
  update,
  remove,
  seed,
  stats,
  importPreview,
  importConfirm,
  updateSubmitUrl,
  eliminationScan,
  eliminationBatch,
  batchUpdateTags,
  listTagLogs,
  getBatchSheet,
  exportBatchSheet,
  getUrlStats,
  batchUrlPatch,
  listUrlLogs,
  fillUrlsFromMap,
  exportUnmatched,
  updatePrice,
  bulkUpdatePrice,
} from '@client/src/api/submission-channels';
import { useAuth } from '@client/src/hooks/useAuth';
import { useBrandSelector } from '@client/src/hooks/useBrandSelector';
import {
  SUBMISSION_CHANNEL_TYPES,
  SUBMISSION_CHANNEL_TYPE_LABELS,
  SUBMISSION_CHANNEL_STATUSES,
  SUBMISSION_CHANNEL_STATUS_LABELS,
  SUBMISSION_CHANNEL_USAGE_TYPES,
  SUBMISSION_CHANNEL_USAGE_TYPE_LABELS,
  SUBMISSION_INDUSTRIES,
  SUBMISSION_INDUSTRY_LABELS,
  SUBMISSION_AI_SOURCES,
  SUBMISSION_AI_SOURCE_LABELS,
  SUBMISSION_LIBRARY_TYPES,
  SUBMISSION_LIBRARY_TYPE_LABELS,
  SUBMISSION_MEDIA_TYPES,
  SUBMISSION_MEDIA_TYPE_LABELS,
  SUBMISSION_REGIONS,
  SUBMISSION_CHANNEL_TIERS,
  SUBMISSION_CHANNEL_TIER_LABELS,
  DIAGNOSIS_PLATFORMS,
  DIAGNOSIS_PLATFORM_LABELS,
  BATCH_TAG_MODE_LABELS,
} from '@shared/api.interface';
import type {
  SubmissionChannel,
  SubmissionChannelType,
  SubmissionChannelStatus,
  SubmissionChannelUsageType,
  SubmissionIndustry,
  SubmissionAiSource,
  SubmissionLibraryType,
  SubmissionMediaType,
  CreateSubmissionChannelRequest,
  UpdateSubmissionChannelRequest,
  SubmissionChannelStats,
  SubmissionChannelImportPreview,
  SubmissionChannelTier,
  DiagnosisPlatform,
  EliminationScanItem,
  EliminationAction,
  BatchTagScope,
  BatchTagMode,
  SourceTagLog,
  SubmissionChannelQuery,
  BatchSheetItem,
  SubmissionUrlStats,
  BatchUrlPatchRequest,
  BatchUrlPatchResult,
  SourceUrlLog,
  UpdateChannelPriceRequest,
  UpdateChannelPriceResponse,
  BulkChannelPriceRequest,
  BulkChannelPriceResponse,
  BulkPriceMode,
} from '@shared/api.interface';
import { Pill } from '@client/src/components/layout/Pill';
import { Checkbox } from '@client/src/components/ui/checkbox';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@client/src/components/ui/sheet';
import { UniversalLink } from '@lark-apaas/client-toolkit/components/UniversalLink';
import { showConfirm } from '@lark-apaas/client-toolkit';

const PRIMARY = '#2563EB';
const DANGER = '#DC2626';
const SUCCESS = '#16A34A';
const MUTED = '#94A3B8';
const WARNING = '#F59E0B';
const BORDER = '#E6EAF2';

const PAGE_SIZE = 20;

interface PaginationBarProps {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  loading?: boolean;
}

const PaginationBar: React.FC<PaginationBarProps> = ({
  page,
  pageSize,
  total,
  onPageChange,
  onPageSizeChange,
  loading,
}) => {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const canPrev = page > 1;
  const canNext = page < totalPages;

  const getPageNumbers = (): (number | '...')[] => {
    const pages: (number | '...')[] = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i += 1) pages.push(i);
      return pages;
    }
    pages.push(1);
    if (page > 3) pages.push('...');
    const start = Math.max(2, page - 1);
    const end = Math.min(totalPages - 1, page + 1);
    for (let i = start; i <= end; i += 1) pages.push(i);
    if (page < totalPages - 2) pages.push('...');
    pages.push(totalPages);
    return pages;
  };

  return (
    <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
      <div className="text-xs text-slate-500">
        共 <span className="tnum font-medium text-slate-700">{total}</span> 条
        {total > 0 && (
          <span className="ml-2">
            第 <span className="tnum font-medium text-slate-700">
              {(page - 1) * pageSize + 1}
            </span> - <span className="tnum font-medium text-slate-700">
              {Math.min(page * pageSize, total)}
            </span> 条
          </span>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={pageSize}
          onChange={(e) => onPageSizeChange(Number(e.target.value))}
          disabled={loading}
          className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-600 focus:border-[#2563EB] focus:outline-none disabled:opacity-50"
        >
          <option value={20}>20 条/页</option>
          <option value={50}>50 条/页</option>
          <option value={100}>100 条/页</option>
        </select>
        <button
          type="button"
          onClick={() => onPageChange(page - 1)}
          disabled={!canPrev || loading}
          className="h-7 rounded-md border border-slate-200 bg-white px-3 text-xs text-slate-600 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          上一页
        </button>
        {getPageNumbers().map((p, idx) =>
          p === '...' ? (
            <span
              key={`ellipsis-${idx}`}
              className="h-7 px-2 text-xs text-slate-400 flex items-center"
            >
              ...
            </span>
          ) : (
            <button
              key={p}
              type="button"
              onClick={() => onPageChange(p)}
              disabled={loading}
              className={`h-7 min-w-7 rounded-md px-2 text-xs transition-colors ${
                p === page
                  ? 'bg-[#2563EB] text-white font-medium'
                  : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
              } disabled:opacity-50`}
            >
              {p}
            </button>
          ),
        )}
        <button
          type="button"
          onClick={() => onPageChange(page + 1)}
          disabled={!canNext || loading}
          className="h-7 rounded-md border border-slate-200 bg-white px-3 text-xs text-slate-600 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          下一页
        </button>
      </div>
    </div>
  );
};

const TYPE_COLORS: Record<
  SubmissionChannelType,
  { bg: string; color: string }
> = {
  self_site: { bg: '#ECFDF3', color: '#12B76A' },
  public_submission: { bg: '#EFF4FF', color: '#2563EB' },
  authoritative_media: { bg: '#FFF6E5', color: '#F79009' },
  industry_vertical: { bg: '#F2F4F7', color: '#5A6478' },
  self_media_account: { bg: '#F0ECFF', color: '#7A5AF8' },
};

const STATUS_COLORS: Record<
  SubmissionChannelStatus,
  { bg: string; color: string }
> = {
  active: { bg: 'rgba(23, 201, 100, 0.12)', color: SUCCESS },
  paused: { bg: 'rgba(100, 116, 139, 0.1)', color: MUTED },
  to_be_deprecated: { bg: 'rgba(255, 92, 92, 0.12)', color: DANGER },
  archived: { bg: 'rgba(100, 116, 139, 0.1)', color: MUTED },
};

const DEFAULT_TYPE_META = { bg: '#F2F4F7', color: '#5A6478' };
const DEFAULT_STATUS_META = { bg: 'rgba(100, 116, 139, 0.1)', color: MUTED };

const LIBRARY_TYPE_COLORS: Record<SubmissionLibraryType, { bg: string; color: string }> = {
  private: { bg: 'rgba(124, 58, 237, 0.12)', color: '#7C3AED' },
  public: { bg: 'rgba(46, 125, 255, 0.12)', color: '#2563EB' },
  authoritative: { bg: 'rgba(247, 144, 9, 0.12)', color: '#F79009' },
  b2b_alliance: { bg: 'rgba(23, 201, 100, 0.12)', color: '#16A34A' },
  multimodal: { bg: 'rgba(255, 92, 92, 0.12)', color: '#DC2626' },
  self_site: { bg: 'rgba(107, 114, 128, 0.12)', color: '#6B7280' },
};

const SUBMISSION_CHANNELS_COL_DEFAULTS: Record<string, number> = {
  name: 200,
  libraryType: 110,
  region: 90,
  industry: 120,
  aiSources: 120,
  mediaType: 90,
  quota: 100,
  price: 120,
  indexCiteRate: 140,
  status: 90,
  actions: 160,
};

const TIER_COLORS: Record<SubmissionChannelTier, { bg: string; color: string }> = {
  S: { bg: 'rgba(124, 58, 237, 0.12)', color: '#7C3AED' },
  A: { bg: 'rgba(46, 125, 255, 0.12)', color: '#2563EB' },
  B: { bg: 'rgba(0, 194, 255, 0.12)', color: '#00C2FF' },
  C: { bg: 'rgba(148, 163, 184, 0.15)', color: '#94a3b8' },
};

const PLATFORM_DOT_COLORS: Record<DiagnosisPlatform, string> = {
  doubao: '#2563EB',
  deepseek: '#00C2B8',
  wenxin: '#FF7A00',
  tongyi: '#7C3AED',
  yuanbao: '#16A34A',
  kimi: '#DC2626',
};

const PLATFORM_ORDER: DiagnosisPlatform[] = [
  'doubao',
  'deepseek',
  'wenxin',
  'tongyi',
  'yuanbao',
  'kimi',
];

const LIBRARY_TAB_VALUES: (SubmissionLibraryType | 'all')[] = [
  'all',
  'private',
  'public',
  'authoritative',
  'b2b_alliance',
  'multimodal',
];

const LIBRARY_TAB_LABELS: Record<SubmissionLibraryType | 'all', string> = {
  all: '全部',
  ...SUBMISSION_LIBRARY_TYPE_LABELS,
};

function getChannelTypeMeta(type: string) {
  return TYPE_COLORS[type as SubmissionChannelType] || DEFAULT_TYPE_META;
}

function getChannelTypeLabel(type: string) {
  return (
    SUBMISSION_CHANNEL_TYPE_LABELS[type as SubmissionChannelType] || type || '未知类型'
  );
}

function getStatusMeta(status: string) {
  return STATUS_COLORS[status as SubmissionChannelStatus] || DEFAULT_STATUS_META;
}

function getStatusLabel(status: string) {
  return (
    SUBMISSION_CHANNEL_STATUS_LABELS[status as SubmissionChannelStatus] ||
      status ||
      '未知状态'
  );
}

/* ---------- URL 工具函数 ---------- */
function isValidSubmitUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  return /^https?:\/\//i.test(url);
}

function normalizeUrl(url: string): string {
  const trimmed = url.trim();
  if (!trimmed) return '';
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

function getUrlHostname(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

const SubmissionChannelsPage: React.FC = () => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isClient = user?.role === 'client';

  const {
    getThStyle,
    getTdStyle,
    getTableStyle,
    handleResizeStart,
    resetColumn,
    resetAll,
    isResizing,
  } = useResizableColumns({
    tableKey: 'submission-channels',
    defaultWidths: SUBMISSION_CHANNELS_COL_DEFAULTS,
    userId: user?.id || 'guest',
  });

  const [libraryType, setLibraryType] = useState<SubmissionLibraryType | 'all'>('all');
  const [typeFilter, setTypeFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [tierFilter, setTierFilter] = useState<string>('');
  const [platformCoverageFilter, setPlatformCoverageFilter] = useState<string>('');
  const [regionFilter, setRegionFilter] = useState<string>('');
  const [industryFilter, setIndustryFilter] = useState<string>('');
  const [aiPlatformFilter, setAiPlatformFilter] = useState<string>('');
  const [mediaTypeFilter, setMediaTypeFilter] = useState<string>('');
  const [keyword, setKeyword] = useState('');

  const { brands: brandOptions } = useBrandSelector();
  const [brandFilter, setBrandFilter] = useState<string>('');

  const effectiveBrandId = useMemo(() => {
    if (isClient) return user?.brandId || '';
    return brandFilter;
  }, [isClient, user?.brandId, brandFilter]);

  const [viewMode, setViewMode] = useState<'card' | 'table'>('card');
  const [page, setPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(PAGE_SIZE);

  // ---------- 批量打标选择状态 ----------
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectionMode, setSelectionMode] = useState<'page' | 'all'>('page');
  const [batchDialogOpen, setBatchDialogOpen] = useState(false);
  const [batchScope, setBatchScope] = useState<BatchTagScope>('selection');
  const [batchPlatforms, setBatchPlatforms] = useState<string[]>([]);
  const [batchMediaType, setBatchMediaType] = useState<string>('');
  const [batchImagePrice, setBatchImagePrice] = useState<string>('');
  const [batchVideoPrice, setBatchVideoPrice] = useState<string>('');
  const [batchQuotaTotal, setBatchQuotaTotal] = useState<string>('');
  const [batchFollowers, setBatchFollowers] = useState<string>('');
  const [batchLikes, setBatchLikes] = useState<string>('');
  const [batchMode, setBatchMode] = useState<BatchTagMode>('append');
  const [batchConfirmed, setBatchConfirmed] = useState(false);
  const [logDrawerOpen, setLogDrawerOpen] = useState(false);
  const [logDrawerTab, setLogDrawerTab] = useState<'tag' | 'url'>('tag');

  // ---------- 批量补录网址弹窗 ----------
  const [urlPatchDialogOpen, setUrlPatchDialogOpen] = useState(false);
  const [urlPatchTab, setUrlPatchTab] = useState<'paste' | 'csv'>('paste');
  const [urlPatchText, setUrlPatchText] = useState('');
  const [urlPatchFile, setUrlPatchFile] = useState<File | null>(null);
  const [urlPatchResult, setUrlPatchResult] = useState<BatchUrlPatchResult | null>(null);

  // ---------- 批次清单 ----------
  const [batchSheetOpen, setBatchSheetOpen] = useState(false);
  const [batchSheetLibraryType, setBatchSheetLibraryType] = useState<SubmissionLibraryType>('authoritative');
  const [batchSheetRegion, setBatchSheetRegion] = useState<string>('');
  const [batchSheetIndustry, setBatchSheetIndustry] = useState<string>('');
  const [batchSheetTagStatus, setBatchSheetTagStatus] = useState<string>('all');

  // 分批打标状态
  const [batchTargetRow, setBatchTargetRow] = useState<BatchSheetItem | null>(null);
  const [batchBatching, setBatchBatching] = useState(false);
  const [batchProgress, setBatchProgress] = useState({ current: 0, total: 0, updated: 0 });
  const [batchAllIds, setBatchAllIds] = useState<string[]>([]);

  // ---------- 单条补录网址 Dialog ----------
  const [patchUrlDialog, setPatchUrlDialog] = useState<{
    open: boolean;
    channelId: string | null;
    channelName: string;
    initialUrl: string;
  }>({
    open: false,
    channelId: null,
    channelName: '',
    initialUrl: '',
  });
  const [patchUrlInput, setPatchUrlInput] = useState('');
  const [patchUrlError, setPatchUrlError] = useState('');

  // ---------- 单条调价弹窗 ----------
  const [priceDialogOpen, setPriceDialogOpen] = useState(false);
  const [priceEditChannel, setPriceEditChannel] = useState<SubmissionChannel | null>(null);
  const [priceEditValue, setPriceEditValue] = useState<string>('');

  // ---------- 批量调价弹窗 ----------
  const [bulkPriceDialogOpen, setBulkPriceDialogOpen] = useState(false);
  const [bulkPriceMode, setBulkPriceMode] = useState<BulkPriceMode>('markup_rate');
  const [bulkMarkupRate, setBulkMarkupRate] = useState<string>('');
  const [bulkFixedDelta, setBulkFixedDelta] = useState<string>('');
  const [bulkPricePreviewCount, setBulkPricePreviewCount] = useState<number | null>(null);
  const [bulkPriceConfirmed, setBulkPriceConfirmed] = useState(false);

  const {
    data,
    refetch,
    isLoading,
    isError,
  } = useQuery({
    queryKey: [
      'submission-channels',
      libraryType,
      typeFilter,
      statusFilter,
      tierFilter,
      platformCoverageFilter,
      regionFilter,
      industryFilter,
      aiPlatformFilter,
      mediaTypeFilter,
      keyword,
      effectiveBrandId,
      page,
      pageSize,
    ],
    queryFn: () =>
      list({
        page,
        limit: pageSize,
        libraryType: libraryType === 'all' ? undefined : libraryType,
        type: (typeFilter || undefined) as SubmissionChannelType | undefined,
        status: (statusFilter || undefined) as
          | SubmissionChannelStatus
          | undefined,
        tier: (tierFilter || undefined) as SubmissionChannelTier | undefined,
        platformCoverage: (platformCoverageFilter || undefined) as
          | DiagnosisPlatform
          | undefined,
        region: regionFilter || undefined,
        industry: industryFilter || undefined,
        aiPlatform: (aiPlatformFilter || undefined) as
          | SubmissionAiSource
          | undefined,
        mediaType: (mediaTypeFilter || undefined) as
          | SubmissionMediaType
          | undefined,
        keyword: keyword || undefined,
        brandId: effectiveBrandId || undefined,
      }),
    retry: 2,
    retryDelay: 2000,
  });

  const allItems = data?.items ?? [];
  const totalCount = data?.total ?? 0;

  useEffect(() => {
    setPage(1);
  }, [
    libraryType,
    typeFilter,
    statusFilter,
    tierFilter,
    platformCoverageFilter,
    regionFilter,
    industryFilter,
    aiPlatformFilter,
    mediaTypeFilter,
    keyword,
    effectiveBrandId,
  ]);

  // 基础统计（用于总数量参考）
  const { data: statsData } = useQuery<SubmissionChannelStats>({
    queryKey: [
      'submission-channels-stats',
      effectiveBrandId,
      typeFilter,
      statusFilter,
      tierFilter,
      platformCoverageFilter,
      regionFilter,
      aiPlatformFilter,
      mediaTypeFilter,
      keyword,
    ],
    queryFn: () =>
      stats({
        brandId: effectiveBrandId || undefined,
        type: (typeFilter || undefined) as SubmissionChannelType | undefined,
        status: (statusFilter || undefined) as SubmissionChannelStatus | undefined,
        tier: (tierFilter || undefined) as SubmissionChannelTier | undefined,
        platformCoverage: (platformCoverageFilter || undefined) as
          | DiagnosisPlatform
          | undefined,
        region: regionFilter || undefined,
        aiPlatform: (aiPlatformFilter || undefined) as SubmissionAiSource | undefined,
        mediaType: (mediaTypeFilter || undefined) as
          | SubmissionMediaType
          | undefined,
        keyword: keyword || undefined,
      }),
    retry: 2,
    retryDelay: 2000,
  });

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingChannel, setEditingChannel] = useState<SubmissionChannel | null>(
    null,
  );
  const [formData, setFormData] = useState<CreateSubmissionChannelRequest>({
    name: '',
    channelType: 'self_site',
    submitUrl: '',
    needAccount: false,
    costPerArticle: 0,
    dailyLimit: 3,
    reviewHours: 24,
    industries: [],
    requiredFields: [],
    aiSources: [],
    aiPlatforms: [],
    remark: '',
    brandId: isClient ? user?.brandId || '' : '',
    libraryType: 'public',
    region: '全国',
    mediaType: 'image_text',
    quotaTotal: null,
    quotaUsed: 0,
    followers: null,
    likes: null,
    imagePrice: null,
    videoPrice: null,
    description: '',
    tier: 'C',
    platformCoverage: [],
    indexRate: 0,
    citeRate: 0,
  });

  // textarea 里的 requiredFields 用换行分隔的字符串
  const [requiredFieldsText, setRequiredFieldsText] = useState('');

  const openCreate = () => {
    setEditingChannel(null);
    setFormData({
      name: '',
      channelType: 'self_site',
      submitUrl: '',
      needAccount: false,
      costPerArticle: 0,
      dailyLimit: 3,
      reviewHours: 24,
      industries: [],
      requiredFields: [],
      aiSources: [],
      aiPlatforms: [],
      remark: '',
      brandId: isClient ? user?.brandId || brandFilter : brandFilter,
      libraryType: 'public',
      region: '全国',
      mediaType: 'image_text',
      quotaTotal: null,
      quotaUsed: 0,
      followers: null,
      likes: null,
      imagePrice: null,
      videoPrice: null,
      description: '',
      tier: 'C',
      platformCoverage: [],
      indexRate: 0,
      citeRate: 0,
    });
    setRequiredFieldsText('');
    setDialogOpen(true);
  };

  const openEdit = (channel: SubmissionChannel) => {
    setEditingChannel(channel);
    setFormData({
      name: channel.name,
      channelType: channel.channelType,
      submitUrl: channel.submitUrl || '',
      needAccount: channel.needAccount,
      costPerArticle: channel.costPerArticle,
      dailyLimit: channel.dailyLimit,
      reviewHours: channel.reviewHours,
      industries: channel.industries,
      requiredFields: channel.requiredFields,
      aiSources: channel.aiSources,
      aiPlatforms: channel.aiPlatforms || [],
      remark: channel.remark || '',
      brandId: channel.brandId,
      libraryType: channel.libraryType,
      region: channel.region,
      mediaType: channel.mediaType,
      quotaTotal: channel.quotaTotal,
      quotaUsed: channel.quotaUsed,
      followers: channel.followers,
      likes: channel.likes,
      imagePrice: channel.imagePrice,
      videoPrice: channel.videoPrice,
      description: channel.description || '',
      tier: channel.tier,
      platformCoverage: channel.platformCoverage,
      indexRate: channel.indexRate,
      citeRate: channel.citeRate,
    });
    setRequiredFieldsText(channel.requiredFields.join('\n'));
    setDialogOpen(true);
  };

  const createMutation = useMutation({
    mutationFn: (data: CreateSubmissionChannelRequest) => {
      const payload: CreateSubmissionChannelRequest = {
        ...data,
        requiredFields: requiredFieldsText
          .split('\n')
          .map((s) => s.trim())
          .filter(Boolean),
      };
      return create(payload);
    },
    retry: false,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['submission-channels'] });
      queryClient.invalidateQueries({
        queryKey: ['submission-channels-stats'],
      });
      setDialogOpen(false);
      toast.success('信源创建成功');
    },
    onError: (err: Error) => {
      toast.error(err.message || '创建失败');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string;
      data: UpdateSubmissionChannelRequest;
    }) => {
      const payload: UpdateSubmissionChannelRequest = {
        ...data,
        requiredFields: requiredFieldsText
          .split('\n')
          .map((s) => s.trim())
          .filter(Boolean),
      };
      return update(id, payload);
    },
    retry: false,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['submission-channels'] });
      queryClient.invalidateQueries({
        queryKey: ['submission-channels-stats'],
      });
      setDialogOpen(false);
      toast.success('信源更新成功');
    },
    onError: (err: Error) => {
      toast.error(err.message || '更新失败');
    },
  });

  const handleSubmit = () => {
    if (!formData.name.trim()) {
      toast.error('请填写信源名称');
      return;
    }
    if (editingChannel) {
      updateMutation.mutate({ id: editingChannel.id, data: formData });
    } else {
      createMutation.mutate({
        ...formData,
        brandId: formData.brandId || brandFilter || undefined,
      });
    }
  };

  /* ---------- 状态切换 ---------- */
  const toggleStatusMutation = useMutation({
    mutationFn: ({
      id,
      status,
    }: {
      id: string;
      status: SubmissionChannelStatus;
    }) => update(id, { status }),
    retry: false,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['submission-channels'] });
      queryClient.invalidateQueries({
        queryKey: ['submission-channels-stats'],
      });
      toast.success('状态已更新');
    },
    onError: (err: Error) => {
      toast.error(err.message || '操作失败');
    },
  });

  /* ---------- 删除 ---------- */
  const [deleteConfirm, setDeleteConfirm] = useState<SubmissionChannel | null>(
    null,
  );
  const deleteMutation = useMutation({
    mutationFn: remove,
    retry: false,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['submission-channels'] });
      queryClient.invalidateQueries({
        queryKey: ['submission-channels-stats'],
      });
      setDeleteConfirm(null);
      toast.success('已删除信源');
    },
    onError: (err: Error) => {
      toast.error(err.message || '删除失败');
    },
  });

  /* ---------- 编辑入口 URL ---------- */
  const [entryEditChannel, setEntryEditChannel] =
    useState<SubmissionChannel | null>(null);
  const [entryUrlInput, setEntryUrlInput] = useState('');
  const [entryUrlTouched, setEntryUrlTouched] = useState(false);

  const entryUrlInvalid = useMemo(() => {
    if (!entryUrlInput) return true;
    return !/^https?:\/\//i.test(entryUrlInput);
  }, [entryUrlInput]);

  const updateSubmitUrlMutation = useMutation({
    mutationFn: ({
      id,
      url,
    }: {
      id: string;
      url: string;
    }) => updateSubmitUrl(id, url),
    retry: false,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['submission-channels'] });
      queryClient.invalidateQueries({
        queryKey: ['submission-channels-stats'],
      });
      setEntryEditChannel(null);
      toast.success('信源入口已更新');
    },
    onError: (err: Error) => {
      toast.error(err.message || '更新失败');
    },
  });

  const openEntryEdit = (channel: SubmissionChannel) => {
    setEntryEditChannel(channel);
    setEntryUrlInput(channel.submitUrl || '');
    setEntryUrlTouched(false);
  };

  /* ---------- 单条调价 ---------- */
  const openPriceDialog = (channel: SubmissionChannel) => {
    setPriceEditChannel(channel);
    setPriceEditValue(((channel.salePriceCents ?? 0) / 100).toFixed(2));
    setPriceDialogOpen(true);
  };

  const closePriceDialog = () => {
    setPriceDialogOpen(false);
    setPriceEditChannel(null);
    setPriceEditValue('');
  };

  const updatePriceMutation = useMutation({
    mutationFn: ({ id, salePriceCents }: { id: string; salePriceCents: number }) =>
      updatePrice(id, { salePriceCents }),
    retry: false,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['submission-channels'] });
      toast.success('已更新价格');
      closePriceDialog();
    },
    onError: (err: Error) => {
      toast.error(err.message || '更新价格失败');
    },
  });

  /* ---------- 批量调价 ---------- */
  const openBulkPriceDialog = () => {
    setBulkPriceMode('markup_rate');
    setBulkMarkupRate('');
    setBulkFixedDelta('');
    setBulkPricePreviewCount(null);
    setBulkPriceConfirmed(false);
    setBulkPriceDialogOpen(true);
  };

  const closeBulkPriceDialog = () => {
    setBulkPriceDialogOpen(false);
    setBulkPricePreviewCount(null);
    setBulkPriceConfirmed(false);
  };

  const bulkPricePreviewMutation = useMutation({
    mutationFn: (filter: SubmissionChannelQuery) =>
      bulkUpdatePrice({
        mode: bulkPriceMode,
        markupRate: bulkPriceMode === 'markup_rate' && bulkMarkupRate
          ? Number(bulkMarkupRate)
          : undefined,
        fixedDelta: bulkPriceMode === 'fixed_delta' && bulkFixedDelta
          ? Math.round(Number(bulkFixedDelta) * 100)
          : undefined,
        filter,
        previewOnly: true,
      }),
    retry: false,
    onSuccess: (data) => {
      setBulkPricePreviewCount(data.affectedCount);
    },
    onError: (err: Error) => {
      toast.error(err.message || '预览失败');
    },
  });

  const bulkPriceExecuteMutation = useMutation({
    mutationFn: (filter: SubmissionChannelQuery) =>
      bulkUpdatePrice({
        mode: bulkPriceMode,
        markupRate: bulkPriceMode === 'markup_rate' && bulkMarkupRate
          ? Number(bulkMarkupRate)
          : undefined,
        fixedDelta: bulkPriceMode === 'fixed_delta' && bulkFixedDelta
          ? Math.round(Number(bulkFixedDelta) * 100)
          : undefined,
        filter,
        previewOnly: false,
      }),
    retry: false,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['submission-channels'] });
      toast.success(`已更新 ${data.affectedCount} 条渠道价格`);
      closeBulkPriceDialog();
    },
    onError: (err: Error) => {
      toast.error(err.message || '批量调价失败');
    },
  });

  /* ---------- 单条补录网址 ---------- */
  const openPatchUrlDialog = (channel: SubmissionChannel) => {
    setPatchUrlDialog({
      open: true,
      channelId: channel.id,
      channelName: channel.name,
      initialUrl: channel.submitUrl || '',
    });
    setPatchUrlInput(channel.submitUrl || '');
    setPatchUrlError('');
  };

  const closePatchUrlDialog = () => {
    setPatchUrlDialog((prev) => ({ ...prev, open: false }));
    setPatchUrlError('');
  };

  const patchUrlMutation = useMutation({
    mutationFn: ({
      id,
      url,
    }: {
      id: string;
      url: string;
    }) => updateSubmitUrl(id, url),
    retry: false,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['submission-channels'] });
      queryClient.invalidateQueries({
        queryKey: ['submission-channels-stats'],
      });
      closePatchUrlDialog();
      toast.success('网址已更新');
    },
    onError: (err: Error) => {
      toast.error(err.message || '更新失败');
    },
  });

  const handlePatchUrlSave = () => {
    if (!patchUrlDialog.channelId) return;
    const normalized = normalizeUrl(patchUrlInput);
    if (!isValidSubmitUrl(normalized)) {
      setPatchUrlError('请输入有效的网址，仅支持 http:// 或 https://');
      return;
    }
    // 禁止 javascript: / data: / file: 等危险协议
    const lower = normalized.toLowerCase();
    if (
      lower.startsWith('javascript:') ||
      lower.startsWith('data:') ||
      lower.startsWith('file:')
    ) {
      setPatchUrlError('不支持该协议，请输入 http:// 或 https:// 开头的网址');
      return;
    }
    setPatchUrlError('');
    patchUrlMutation.mutate({
      id: patchUrlDialog.channelId,
      url: normalized,
    });
  };

  /* ---------- 投稿跳转 ---------- */
  const handleSubmitToChannel = (channel: SubmissionChannel) => {
    if (isValidSubmitUrl(channel.submitUrl)) {
      window.open(channel.submitUrl!, '_blank', 'noopener,noreferrer');
      return;
    }
    navigate(`/publish?tab=records&channelId=${channel.id}`);
  };

  /* ---------- 批量导入弹窗 ---------- */
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [importTab, setImportTab] = useState<'upload' | 'template'>('upload');
  const [csvContent, setCsvContent] = useState('');
  const [csvFileName, setCsvFileName] = useState('');
  const [previewData, setPreviewData] =
    useState<SubmissionChannelImportPreview | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const previewMutation = useMutation({
    mutationFn: (content: string) =>
      importPreview({ brandId: brandFilter || undefined, csvContent: content }),
    retry: false,
    onMutate: () => setIsParsing(true),
    onSettled: () => setIsParsing(false),
    onSuccess: (data) => setPreviewData(data),
    onError: (err: Error) => {
      toast.error(err.message || '解析失败');
      setPreviewData(null);
    },
  });

  const confirmMutation = useMutation({
    mutationFn: () =>
      importConfirm({
        brandId: brandFilter || undefined,
        csvContent,
        importToken: previewData?.importToken,
      }),
    retry: false,
    onSuccess: (data) => {
      toast.success(`已导入 ${data.inserted} 条信源`);
      setImportDialogOpen(false);
      setPreviewData(null);
      setCsvContent('');
      setCsvFileName('');
      queryClient.invalidateQueries({ queryKey: ['submission-channels'] });
      queryClient.invalidateQueries({
        queryKey: ['submission-channels-stats'],
      });
    },
    onError: (err: Error) => {
      toast.error(err.message || '导入失败');
    },
  });

  const handleFileSelect = (file: File) => {
    if (!file.name.endsWith('.csv')) {
      toast.error('请选择 CSV 文件');
      return;
    }
    setCsvFileName(file.name);
    setPreviewData(null);
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = String(e.target?.result || '');
      setCsvContent(text);
      previewMutation.mutate(text);
    };
    reader.onerror = () => {
      toast.error('文件读取失败');
    };
    reader.readAsText(file, 'utf-8');
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFileSelect(file);
    e.target.value = '';
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) handleFileSelect(file);
  };

  const downloadTemplate = () => {
    const header =
      '信源名称,渠道类型,投稿入口URL,单篇成本,日限额,审核时长,适配行业,AI信源标记,备注,库类型,地区,模态,图文价格,视频价格,粉丝数,点赞数,描述';
    const sample =
      '示例科技博客,public_submission,https://example.com/submit,50,10,24,科技|数码,doubao|kimi,示例数据请勿导入,public,全国,image_text,10,20,1000,500,示例描述';
    const csv = `${header}\n${sample}\n`;
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = '信源库导入模板.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success('模板已下载');
  };

  const openImportDialog = () => {
    setImportTab('upload');
    setCsvContent('');
    setCsvFileName('');
    setPreviewData(null);
    setImportDialogOpen(true);
  };

  /* ---------- 恢复预置 ---------- */
  const seedMutation = useMutation({
    mutationFn: () => seed(brandFilter || undefined),
    retry: false,
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['submission-channels'] });
      queryClient.invalidateQueries({
        queryKey: ['submission-channels-stats'],
      });
      toast.success(`已恢复 ${(result as any).inserted ?? 0} 个预置信源`);
    },
    onError: (err: Error) => {
      toast.error(err.message || '恢复失败');
    },
  });

  /* ---------- 月度淘汰检查 ---------- */
  const [eliminationDialogOpen, setEliminationDialogOpen] = useState(false);
  const [hasScanned, setHasScanned] = useState(false);
  const [selectedEliminationIds, setSelectedEliminationIds] = useState<string[]>([]);

  const eliminationScanQuery = useQuery({
    queryKey: ['elimination-scan'],
    queryFn: eliminationScan,
    enabled: false,
    retry: false,
  });

  const eliminationBatchMutation = useMutation({
    mutationFn: ({
      ids,
      action,
    }: {
      ids: string[];
      action: EliminationAction;
    }) => eliminationBatch(ids, action),
    retry: false,
    onSuccess: (_, { action }) => {
      const label =
        action === 'keep'
          ? '保留'
          : action === 'mark_deprecated'
          ? '标记待淘汰'
          : '移入归档';
      toast.success(`批量${label}成功`);
      setSelectedEliminationIds([]);
      eliminationScanQuery.refetch();
      queryClient.invalidateQueries({ queryKey: ['submission-channels'] });
      queryClient.invalidateQueries({
        queryKey: ['submission-channels-stats'],
      });
    },
    onError: (err: Error) => {
      toast.error(err.message || '操作失败');
    },
  });

  const eliminationSingleMutation = useMutation({
    mutationFn: ({
      id,
      action,
    }: {
      id: string;
      action: EliminationAction;
    }) => eliminationBatch([id], action),
    retry: false,
    onSuccess: () => {
      eliminationScanQuery.refetch();
      queryClient.invalidateQueries({ queryKey: ['submission-channels'] });
      queryClient.invalidateQueries({
        queryKey: ['submission-channels-stats'],
      });
      toast.success('操作成功');
    },
    onError: (err: Error) => {
      toast.error(err.message || '操作失败');
    },
  });

  const startEliminationScan = () => {
    setHasScanned(true);
    eliminationScanQuery.refetch();
  };

  const toggleEliminationSelect = (id: string) => {
    setSelectedEliminationIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id],
    );
  };

  const toggleEliminationSelectAll = () => {
    const items = eliminationScanQuery.data?.items ?? [];
    if (selectedEliminationIds.length === items.length && items.length > 0) {
      setSelectedEliminationIds([]);
    } else {
      setSelectedEliminationIds(items.map((item: EliminationScanItem) => item.id));
    }
  };

  const handleBatchElimination = (action: EliminationAction) => {
    if (selectedEliminationIds.length === 0) return;
    eliminationBatchMutation.mutate({ ids: selectedEliminationIds, action });
  };

  // ---------- 批量打标：选择相关 ----------
  const selectedCount = selectionMode === 'all' ? totalCount : selectedIds.size;

  const toggleSelectOne = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
    // 手动勾选时回到 page 模式
    if (selectionMode === 'all') setSelectionMode('page');
  };

  const isCurrentPageAllSelected = useMemo(() => {
    if (allItems.length === 0) return false;
    return allItems.every((item) => selectedIds.has(item.id));
  }, [allItems, selectedIds]);

  const isCurrentPageIndeterminate = useMemo(() => {
    if (allItems.length === 0) return false;
    const hasSelected = allItems.some((item) => selectedIds.has(item.id));
    return hasSelected && !isCurrentPageAllSelected;
  }, [allItems, selectedIds, isCurrentPageAllSelected]);

  const toggleSelectCurrentPage = () => {
    if (isCurrentPageAllSelected) {
      setSelectedIds(new Set());
    } else {
      const next = new Set(selectedIds);
      allItems.forEach((item) => next.add(item.id));
      setSelectedIds(next);
    }
    setSelectionMode('page');
  };

  const selectAllFiltered = () => {
    setSelectionMode('all');
    setSelectedIds(new Set());
  };

  const clearSelection = () => {
    setSelectedIds(new Set());
    setSelectionMode('page');
  };

  // ---------- 批量打标 mutation ----------
  const buildFilterQuery = (): SubmissionChannelQuery => ({
    libraryType: libraryType === 'all' ? undefined : libraryType,
    type: (typeFilter || undefined) as SubmissionChannelType | undefined,
    status: (statusFilter || undefined) as SubmissionChannelStatus | undefined,
    tier: (tierFilter || undefined) as SubmissionChannelTier | undefined,
    platformCoverage: (platformCoverageFilter || undefined) as
      | DiagnosisPlatform
      | undefined,
    region: regionFilter || undefined,
    industry: industryFilter || undefined,
    aiPlatform: (aiPlatformFilter || undefined) as
      | SubmissionAiSource
      | undefined,
    mediaType: (mediaTypeFilter || undefined) as
      | SubmissionMediaType
      | undefined,
    keyword: keyword || undefined,
    brandId: effectiveBrandId || undefined,
  });

  const batchTagMutation = useMutation({
    mutationFn: () => {
      const payload: Parameters<typeof batchUpdateTags>[0] = {
        scope: batchScope,
        mode: batchMode,
      };
      if (batchScope === 'selection') {
        payload.ids = Array.from(selectedIds);
      } else if (batchTargetRow) {
        // 从批次清单行打开，使用行级筛选
        payload.filter = {
          libraryType: batchSheetLibraryType,
          region: batchTargetRow.region || undefined,
          industry: (batchTargetRow.industry as string) || undefined,
          brandId: effectiveBrandId || undefined,
        };
      } else {
        payload.filter = buildFilterQuery();
      }
      if (batchPlatforms.length > 0) {
        payload.platforms = batchPlatforms;
      }
      if (batchMediaType) {
        payload.mediaType = batchMediaType as SubmissionMediaType;
      }
      if (batchImagePrice !== '') {
        payload.imagePrice = Number(batchImagePrice);
      }
      if (batchVideoPrice !== '') {
        payload.videoPrice = Number(batchVideoPrice);
      }
      if (batchQuotaTotal !== '') {
        payload.quotaTotal = Number(batchQuotaTotal);
      }
      if (batchFollowers !== '') {
        payload.followers = Number(batchFollowers);
      }
      if (batchLikes !== '') {
        payload.likes = Number(batchLikes);
      }
      return batchUpdateTags(payload);
    },
    retry: false,
    onSuccess: (result) => {
      toast.success(`已更新 ${result.updated} 条渠道的 AI 信源标签`);
      setBatchDialogOpen(false);
      clearSelection();
      queryClient.invalidateQueries({ queryKey: ['submission-channels'] });
      queryClient.invalidateQueries({
        queryKey: ['submission-channels-stats'],
      });
      queryClient.invalidateQueries({ queryKey: ['tag-logs'] });
      queryClient.invalidateQueries({ queryKey: ['batch-sheet'] });
    },
    onError: (err: Error) => {
      toast.error(err.message || '批量打标失败');
    },
  });

  const openBatchDialog = () => {
    // 默认范围
    if (selectionMode === 'all' || selectedIds.size === 0) {
      setBatchScope('filter');
    } else {
      setBatchScope('selection');
    }
    setBatchPlatforms([]);
    setBatchMediaType('');
    setBatchImagePrice('');
    setBatchVideoPrice('');
    setBatchQuotaTotal('');
    setBatchFollowers('');
    setBatchLikes('');
    setBatchMode('append');
    setBatchConfirmed(false);
    setBatchTargetRow(null);
    setBatchBatching(false);
    setBatchProgress({ current: 0, total: 0, updated: 0 });
    setBatchAllIds([]);
    setBatchDialogOpen(true);
  };

  // 从批次清单打开批量打标（限定地区+行业）
  const openBatchDialogForRow = (row: BatchSheetItem) => {
    setBatchTargetRow(row);
    setBatchScope('filter');
    setBatchPlatforms([]);
    setBatchMediaType('');
    setBatchImagePrice('');
    setBatchVideoPrice('');
    setBatchQuotaTotal('');
    setBatchFollowers('');
    setBatchLikes('');
    setBatchMode('append');
    setBatchConfirmed(false);
    setBatchBatching(false);
    setBatchProgress({ current: 0, total: 0, updated: 0 });
    setBatchAllIds([]);
    setBatchDialogOpen(true);
  };

  // 分批打标执行
  const runBatchedTagging = async () => {
    if (!batchTargetRow) return;
    const total = batchTargetRow.totalCount;
    const batchSize = 5000;
    const totalBatches = Math.ceil(total / batchSize);
    setBatchBatching(true);
    setBatchProgress({ current: 0, total: totalBatches, updated: 0 });

    // 先查全量 id（只查 id 字段，用分页）
    const allIds: string[] = [];
    let page = 1;
    const pageSize = 1000;
    while (allIds.length < total) {
      const res = await list({
        page,
        limit: pageSize,
        libraryType: batchSheetLibraryType,
        region: batchTargetRow.region || undefined,
        industry: (batchTargetRow.industry as string) || undefined,
        brandId: effectiveBrandId || undefined,
      });
      const ids = (res.items as SubmissionChannel[]).map((c) => c.id);
      if (ids.length === 0) break;
      allIds.push(...ids);
      if (ids.length < pageSize) break;
      page += 1;
    }
    setBatchAllIds(allIds);

    let updatedCount = 0;
    for (let i = 0; i < totalBatches; i += 1) {
      const slice = allIds.slice(i * batchSize, (i + 1) * batchSize);
      const payload: Parameters<typeof batchUpdateTags>[0] = {
        scope: 'selection',
        ids: slice,
        mode: batchMode,
      };
      if (batchPlatforms.length > 0) payload.platforms = batchPlatforms;
      if (batchMediaType) {
        payload.mediaType = batchMediaType as SubmissionMediaType;
      }
      if (batchImagePrice !== '') payload.imagePrice = Number(batchImagePrice);
      if (batchVideoPrice !== '') payload.videoPrice = Number(batchVideoPrice);
      if (batchQuotaTotal !== '') payload.quotaTotal = Number(batchQuotaTotal);
      if (batchFollowers !== '') payload.followers = Number(batchFollowers);
      if (batchLikes !== '') payload.likes = Number(batchLikes);
      const res = await batchUpdateTags(payload);
      updatedCount += res.updated;
      setBatchProgress({ current: i + 1, total: totalBatches, updated: updatedCount });
    }

    setBatchBatching(false);
    toast.success(`分批打标完成，共更新 ${updatedCount} 条`);
    setBatchDialogOpen(false);
    queryClient.invalidateQueries({ queryKey: ['submission-channels'] });
    queryClient.invalidateQueries({ queryKey: ['submission-channels-stats'] });
    queryClient.invalidateQueries({ queryKey: ['tag-logs'] });
    queryClient.invalidateQueries({ queryKey: ['batch-sheet'] });
  };

  const handleBatchSubmit = () => {
    const hasAnyField =
      batchPlatforms.length > 0 ||
      !!batchMediaType ||
      batchImagePrice !== '' ||
      batchVideoPrice !== '' ||
      batchQuotaTotal !== '' ||
      batchFollowers !== '' ||
      batchLikes !== '';
    if (!hasAnyField) {
      toast.error('请至少选择一个要更新的字段');
      return;
    }
    if (!batchConfirmed) {
      toast.error('请先确认本次批量操作');
      return;
    }
    batchTagMutation.mutate();
  };

  // ---------- 打标记录查询 ----------
  const tagLogsQuery = useQuery({
    queryKey: ['tag-logs'],
    queryFn: listTagLogs,
    enabled: logDrawerOpen && logDrawerTab === 'tag',
    retry: false,
  });

  // ---------- URL 补录记录查询 ----------
  const urlLogsQuery = useQuery({
    queryKey: ['url-logs'],
    queryFn: listUrlLogs,
    enabled: logDrawerOpen && logDrawerTab === 'url',
    retry: false,
  });

  // ---------- URL 统计查询 ----------
  const urlStatsQuery = useQuery<SubmissionUrlStats>({
    queryKey: [
      'submission-channels-url-stats',
      libraryType,
      typeFilter,
      statusFilter,
      tierFilter,
      platformCoverageFilter,
      regionFilter,
      industryFilter,
      aiPlatformFilter,
      mediaTypeFilter,
      keyword,
      effectiveBrandId,
    ],
    queryFn: () =>
      getUrlStats({
        libraryType: libraryType === 'all' ? undefined : libraryType,
        type: (typeFilter || undefined) as SubmissionChannelType | undefined,
        status: (statusFilter || undefined) as
          | SubmissionChannelStatus
          | undefined,
        tier: (tierFilter || undefined) as SubmissionChannelTier | undefined,
        platformCoverage: (platformCoverageFilter || undefined) as
          | DiagnosisPlatform
          | undefined,
        region: regionFilter || undefined,
        industry: industryFilter || undefined,
        aiPlatform: (aiPlatformFilter || undefined) as
          | SubmissionAiSource
          | undefined,
        mediaType: (mediaTypeFilter || undefined) as
          | SubmissionMediaType
          | undefined,
        keyword: keyword || undefined,
        brandId: effectiveBrandId || undefined,
      }),
    retry: 2,
    retryDelay: 2000,
  });

  // ---------- 批量补录网址 mutation ----------
  const batchUrlPatchMutation = useMutation({
    mutationFn: (body: BatchUrlPatchRequest) => batchUrlPatch(body),
    retry: false,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['submission-channels'] });
      queryClient.invalidateQueries({
        queryKey: ['submission-channels-stats'],
      });
      queryClient.invalidateQueries({
        queryKey: ['submission-channels-url-stats'],
      });
      queryClient.invalidateQueries({ queryKey: ['url-logs'] });
      setUrlPatchResult(data);
      toast.success(`补录完成：成功 ${data.successCount} 条`);
    },
    onError: (err: Error) => {
      toast.error(err.message || '补录失败');
    },
  });

  // ---------- 域名映射一键补录 ----------
  const fillFromMapMutation = useMutation({
    mutationFn: () => fillUrlsFromMap(),
    retry: false,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['submission-channels'] });
      queryClient.invalidateQueries({
        queryKey: ['submission-channels-stats'],
      });
      queryClient.invalidateQueries({
        queryKey: ['submission-channels-url-stats'],
      });
      queryClient.invalidateQueries({ queryKey: ['url-logs'] });
      toast.success(
        `域名映射补录完成：命中 ${data.matched} 条，未匹配 ${data.unmatched} 条`,
      );
    },
    onError: (err: Error) => {
      toast.error(err.message || '补录失败');
    },
  });

  const handleFillFromMap = async (): Promise<void> => {
    if (!await showConfirm('确认用域名映射表批量补录所有空入口渠道？不会覆盖已有网址。')) return;
    fillFromMapMutation.mutate();
  };

  const handleExportUnmatched = (): void => {
    const params: SubmissionChannelQuery = {};
    if (brandFilter) params.brandId = brandFilter;
    exportUnmatched(params).catch((err: Error) => {
      toast.error(err.message || '导出失败');
    });
  };

  const parseUrlPatchRows = (text: string): Array<{ name: string; url: string }> => {
    const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    const rows: Array<{ name: string; url: string }> = [];
    for (const line of lines) {
      // 支持英文逗号、制表符、竖线分隔，取第一个分隔符
      const sepIdx = line.search(/[,\t|]/);
      if (sepIdx === -1) continue;
      const name = line.slice(0, sepIdx).trim();
      const url = line.slice(sepIdx + 1).trim();
      if (name && url) {
        rows.push({ name, url });
      }
    }
    return rows;
  };

  const normalizeAndValidateUrl = (url: string): string | null => {
    const trimmed = url.trim();
    if (!trimmed) return null;
    const normalized = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    // 白名单校验：只允许 http/https
    if (!/^https?:\/\//i.test(normalized)) return null;
    // 禁止危险协议
    const lower = normalized.toLowerCase();
    if (
      lower.startsWith('javascript:') ||
      lower.startsWith('data:') ||
      lower.startsWith('file:')
    ) {
      return null;
    }
    return normalized;
  };

  const handleUrlPatchSubmit = async () => {
    let rawText = '';
    if (urlPatchTab === 'paste') {
      rawText = urlPatchText;
    } else if (urlPatchFile) {
      try {
        rawText = await urlPatchFile.text();
        // CSV 第一行是表头，跳过
        const lines = rawText.split(/\r?\n/);
        if (lines.length > 0 && lines[0].trim()) {
          const firstLine = lines[0].trim().toLowerCase();
          // 判断是否表头：包含名称/name/网址/url 等关键词
          if (
            firstLine.includes('名称') ||
            firstLine.includes('name') ||
            firstLine.includes('网址') ||
            firstLine.includes('url')
          ) {
            rawText = lines.slice(1).join('\n');
          }
        }
      } catch {
        toast.error('读取文件失败');
        return;
      }
    } else {
      toast.error('请粘贴文本或选择文件');
      return;
    }

    const rawRows = parseUrlPatchRows(rawText);
    if (rawRows.length === 0) {
      toast.error('未解析到有效数据行');
      return;
    }
    if (rawRows.length > 5000) {
      toast.error(`单次上限 5000 行，当前 ${rawRows.length} 行`);
      return;
    }

    const rows: Array<{ name: string; libraryType?: string; url: string }> = [];
    for (const row of rawRows) {
      const normalizedUrl = normalizeAndValidateUrl(row.url);
      if (normalizedUrl) {
        rows.push({
          name: row.name,
          libraryType: libraryType === 'all' ? undefined : libraryType,
          url: normalizedUrl,
        });
      }
    }

    if (rows.length === 0) {
      toast.error('没有有效的网址行');
      return;
    }

    batchUrlPatchMutation.mutate({
      rows,
      brandId: effectiveBrandId || undefined,
    });
  };

  const exportUnmatchedCsv = () => {
    if (!urlPatchResult?.unmatchedItems?.length) return;
    const header = '名称,库类型,网址,原因\n';
    const lines = urlPatchResult.unmatchedItems.map(
      (item) =>
        `"${(item.name || '').replace(/"/g, '""')}",` +
        `"${(item.libraryType || '').replace(/"/g, '""')}",` +
        `"${(item.url || '').replace(/"/g, '""')}",` +
        `"${(item.reason || '').replace(/"/g, '""')}"`,
    );
    const csvContent = header + lines.join('\n');
    const blob = new Blob(['\uFEFF' + csvContent], {
      type: 'text/csv;charset=utf-8;',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `未匹配清单_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleUrlPatchDialogClose = (open: boolean) => {
    if (!open) {
      setUrlPatchDialogOpen(false);
      setUrlPatchResult(null);
      setUrlPatchText('');
      setUrlPatchFile(null);
    }
  };

  const formatUrlLogTime = (dateStr: string) => {
    const d = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    const diffHour = Math.floor(diffMs / 3600000);
    const diffDay = Math.floor(diffMs / 86400000);
    if (diffMin < 1) return '刚刚';
    if (diffMin < 60) return `${diffMin} 分钟前`;
    if (diffHour < 24) return `${diffHour} 小时前`;
    if (diffDay < 7) return `${diffDay} 天前`;
    return d.toLocaleString('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // ---------- 批次清单查询 ----------
  const batchSheetQuery = useQuery({
    queryKey: [
      'batch-sheet',
      batchSheetLibraryType,
      batchSheetRegion,
      batchSheetIndustry,
      batchSheetTagStatus,
    ],
    queryFn: () =>
      getBatchSheet({
        libraryType: batchSheetLibraryType,
        region: batchSheetRegion || undefined,
        industry: (batchSheetIndustry || undefined) as SubmissionIndustry | undefined,
        tagStatus: (batchSheetTagStatus as 'all' | 'tagged' | 'untagged') || undefined,
      }),
    retry: 2,
    retryDelay: 2000,
    enabled: batchSheetOpen,
  });

  const handleViewChannels = (item: BatchSheetItem) => {
    // 设置信源库筛选条件并关闭抽屉
    setLibraryType(batchSheetLibraryType);
    setRegionFilter(item.region || '');
    setIndustryFilter(item.industry || '');
    setBatchSheetOpen(false);
    setPage(1);
  };

  const formatTagLogTime = (dateStr: string) => {
    const d = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    const diffHour = Math.floor(diffMs / 3600000);
    const diffDay = Math.floor(diffMs / 86400000);
    if (diffMin < 1) return '刚刚';
    if (diffMin < 60) return `${diffMin} 分钟前`;
    if (diffHour < 24) return `${diffHour} 小时前`;
    if (diffDay < 7) return `${diffDay} 天前`;
    return d.toLocaleString('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const BATCH_SCOPE_LABELS: Record<BatchTagScope, string> = {
    selection: '已选',
    filter: '全部筛选结果',
  };

  /* ---------- 行业多选 ---------- */
  const toggleIndustry = (ind: SubmissionIndustry) => {
    const current = formData.industries || [];
    const next = current.includes(ind)
      ? current.filter((i) => i !== ind)
      : [...current, ind];
    setFormData({ ...formData, industries: next });
  };

  /* ---------- AI 信源标记多选（旧字段）---------- */
  const toggleAiSource = (src: SubmissionAiSource) => {
    const current = formData.aiSources || [];
    const next = current.includes(src)
      ? current.filter((s) => s !== src)
      : [...current, src];
    setFormData({ ...formData, aiSources: next });
  };

  /* ---------- AI 平台多选（新字段）---------- */
  const toggleAiPlatform = (p: SubmissionAiSource) => {
    const current = formData.aiPlatforms || [];
    const next = current.includes(p)
      ? current.filter((i) => i !== p)
      : [...current, p];
    setFormData({ ...formData, aiPlatforms: next });
  };

  const currentBrandName = useMemo(() => {
    if (!isClient || !user?.brandId) return '';
    return brandOptions.find((b) => b.id === user.brandId)?.name || '';
  }, [isClient, user?.brandId, brandOptions]);

  const brandNameMap = useMemo(() => {
    const map: Record<string, string> = {};
    brandOptions.forEach((b) => {
      map[b.id] = b.name;
    });
    return map;
  }, [brandOptions]);

  const libraryTypeLabel = (t: SubmissionLibraryType | 'all') =>
    LIBRARY_TAB_LABELS[t];

  return (
    <div className="space-y-6" style={{ backgroundColor: '#f8fafc' }}>
      {/* 标题区 */}
      <PageHeader
        title="信源库"
        subtitle="对标媒体库的信源渠道体系，支持多维筛选、卡片与表格双视图，覆盖私人/公共/权威/B2B/多模态五大类型"
      />

      {/* 品牌筛选 */}
      {!isClient && (
        <div className="mb-4 flex items-center gap-2">
          <span className="text-[12px]" style={{ color: MUTED }}>品牌</span>
          <div className="w-44">
            <Select
              value={brandFilter}
              onValueChange={(v) => setBrandFilter(v)}
            >
              <SelectTrigger className="h-9">
                <SelectValue placeholder="全部品牌" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">全部品牌</SelectItem>
                {brandOptions.map((b) => (
                  <SelectItem key={b.id} value={b.id}>
                    {b.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      )}

      {/* 新增/编辑信源对话框 */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>
              {editingChannel ? '编辑信源' : '新增信源'}
            </DialogTitle>
            <DialogDescription className="text-xs">
              配置信源渠道信息，用于稿件外投与收录追踪
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2 max-h-[70vh] overflow-y-auto">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">
                信源名称 <span style={{ color: DANGER }}>*</span>
              </label>
              <Input
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                placeholder="如：知乎专栏"
                className="h-9"
              />
            </div>

            {/* 库类型 + 地区 + 模态 */}
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">库类型</label>
                <Select
                  value={formData.libraryType || 'public'}
                  onValueChange={(v) =>
                    setFormData({
                      ...formData,
                      libraryType: v as SubmissionLibraryType,
                    })
                  }
                >
                  <SelectTrigger className="w-full h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SUBMISSION_LIBRARY_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>
                        {SUBMISSION_LIBRARY_TYPE_LABELS[t]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">地区</label>
                <Select
                  value={formData.region || '全国'}
                  onValueChange={(v) =>
                    setFormData({ ...formData, region: v })
                  }
                >
                  <SelectTrigger className="w-full h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="max-h-[300px]">
                    {SUBMISSION_REGIONS.map((r) => (
                      <SelectItem key={r} value={r}>
                        {r}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">模态</label>
                <Select
                  value={formData.mediaType || 'image_text'}
                  onValueChange={(v) =>
                    setFormData({
                      ...formData,
                      mediaType: v as SubmissionMediaType,
                    })
                  }
                >
                  <SelectTrigger className="w-full h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SUBMISSION_MEDIA_TYPES.map((m) => (
                      <SelectItem key={m} value={m}>
                        {SUBMISSION_MEDIA_TYPE_LABELS[m]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium">信源类型</label>
              <Select
                value={formData.channelType}
                onValueChange={(v) =>
                  setFormData({
                    ...formData,
                    channelType: v as SubmissionChannelType,
                  })
                }
              >
                <SelectTrigger className="w-full h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SUBMISSION_CHANNEL_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {SUBMISSION_CHANNEL_TYPE_LABELS[t]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {!isClient && (
              <div className="space-y-1.5">
                <label className="text-sm font-medium">归属品牌</label>
                <Select
                  value={formData.brandId || brandFilter || ''}
                  onValueChange={(v) =>
                    setFormData({ ...formData, brandId: v })
                  }
                >
                  <SelectTrigger className="w-full h-9">
                    <SelectValue placeholder="请选择品牌" />
                  </SelectTrigger>
                  <SelectContent>
                    {brandOptions.map((b) => (
                      <SelectItem key={b.id} value={b.id}>
                        {b.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            {isClient && (
              <div className="space-y-1.5">
                <label className="text-sm font-medium">归属品牌</label>
                <Input
                  value={currentBrandName || user?.brandId || ''}
                  disabled
                  className="h-9 bg-muted/50"
                />
              </div>
            )}
            <div className="space-y-1.5">
              <label className="text-sm font-medium">信源入口 URL</label>
              <Input
                value={formData.submitUrl || ''}
                onChange={(e) =>
                  setFormData({ ...formData, submitUrl: e.target.value })
                }
                placeholder="https://..."
                className="h-9"
              />
            </div>
            <div className="flex items-center justify-between pt-1">
              <label className="text-sm font-medium">
                是否需要注册账号
              </label>
              <Switch
                checked={!!formData.needAccount}
                onCheckedChange={(v) =>
                  setFormData({ ...formData, needAccount: v })
                }
              />
            </div>

            {/* 价格 / 配额 / 粉丝 / 点赞 */}
            <div className="grid grid-cols-4 gap-3">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">图文价格（元）</label>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  value={formData.imagePrice ?? ''}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      imagePrice: e.target.value === '' ? null : Number(e.target.value),
                    })
                  }
                  placeholder="选填"
                  className="h-9"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">视频价格（元）</label>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  value={formData.videoPrice ?? ''}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      videoPrice: e.target.value === '' ? null : Number(e.target.value),
                    })
                  }
                  placeholder="选填"
                  className="h-9"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">配额总数</label>
                <Input
                  type="number"
                  min={0}
                  value={formData.quotaTotal ?? ''}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      quotaTotal: e.target.value === '' ? null : Number(e.target.value),
                    })
                  }
                  placeholder="选填"
                  className="h-9"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">已发布数</label>
                <Input
                  type="number"
                  min={0}
                  value={formData.quotaUsed ?? 0}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      quotaUsed: Number(e.target.value) || 0,
                    })
                  }
                  className="h-9"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">粉丝数</label>
                <Input
                  type="number"
                  min={0}
                  value={formData.followers ?? ''}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      followers: e.target.value === '' ? null : Number(e.target.value),
                    })
                  }
                  placeholder="选填"
                  className="h-9"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">点赞数</label>
                <Input
                  type="number"
                  min={0}
                  value={formData.likes ?? ''}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      likes: e.target.value === '' ? null : Number(e.target.value),
                    })
                  }
                  placeholder="选填"
                  className="h-9"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">单篇成本（元）</label>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  value={formData.costPerArticle ?? 0}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      costPerArticle: Number(e.target.value) || 0,
                    })
                  }
                  className="h-9"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">日限额</label>
                <Input
                  type="number"
                  min={1}
                  value={formData.dailyLimit ?? 3}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      dailyLimit: Math.max(
                        1,
                        Number(e.target.value) || 1,
                      ),
                    })
                  }
                  className="h-9"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">审核时长（小时）</label>
                <Input
                  type="number"
                  min={0}
                  value={formData.reviewHours ?? 24}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      reviewHours: Number(e.target.value) || 0,
                    })
                  }
                  className="h-9"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium">适配行业</label>
              <div className="flex flex-wrap gap-2">
                {SUBMISSION_INDUSTRIES.map((ind) => {
                  const selected = (formData.industries || []).includes(
                    ind,
                  );
                  return (
                    <button
                      key={ind}
                      type="button"
                      onClick={() => toggleIndustry(ind)}
                      className="rounded-md border px-2.5 py-1 text-xs transition-colors"
                      style={{
                        borderColor: selected ? PRIMARY : '#e2e8f0',
                        backgroundColor: selected
                          ? 'rgba(46, 125, 255, 0.08)'
                          : 'transparent',
                        color: selected ? PRIMARY : '#475569',
                      }}
                    >
                      {SUBMISSION_INDUSTRY_LABELS[ind]}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium">AI 信源平台</label>
              <div className="flex flex-wrap gap-2">
                {SUBMISSION_AI_SOURCES.map((src) => {
                  const selected = (formData.aiPlatforms || []).includes(
                    src,
                  );
                  return (
                    <button
                      key={src}
                      type="button"
                      onClick={() => toggleAiPlatform(src)}
                      className="rounded-md border px-2.5 py-1 text-xs transition-colors"
                      style={{
                        borderColor: selected ? PRIMARY : '#e2e8f0',
                        backgroundColor: selected
                          ? 'rgba(46, 125, 255, 0.08)'
                          : 'transparent',
                        color: selected ? PRIMARY : '#475569',
                      }}
                    >
                      {SUBMISSION_AI_SOURCE_LABELS[src]}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium">描述</label>
              <Textarea
                value={formData.description || ''}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                placeholder="信源描述，将展示在卡片上"
                className="min-h-[70px] resize-y"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium">
                投稿需填字段
                <span className="text-xs text-muted-foreground ml-2">
                  每行一个
                </span>
              </label>
              <Textarea
                value={requiredFieldsText}
                onChange={(e) => setRequiredFieldsText(e.target.value)}
                placeholder={'标题\n正文\n分类\n联系电话\n品牌官网'}
                className="min-h-[90px] resize-y"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium">
                AI 信源标记（旧字段）
              </label>
              <div className="flex flex-wrap gap-2">
                {SUBMISSION_AI_SOURCES.map((src) => {
                  const selected = (formData.aiSources || []).includes(
                    src,
                  );
                  return (
                    <button
                      key={src}
                      type="button"
                      onClick={() => toggleAiSource(src)}
                      className="rounded-md border px-2.5 py-1 text-xs transition-colors"
                      style={{
                        borderColor: selected ? PRIMARY : '#e2e8f0',
                        backgroundColor: selected
                          ? 'rgba(46, 125, 255, 0.08)'
                          : 'transparent',
                        color: selected ? PRIMARY : '#475569',
                      }}
                    >
                      {SUBMISSION_AI_SOURCE_LABELS[src]}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium">备注</label>
              <Textarea
                value={formData.remark || ''}
                onChange={(e) =>
                  setFormData({ ...formData, remark: e.target.value })
                }
                placeholder="选填"
                className="min-h-[70px] resize-y"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDialogOpen(false)}
            >
              取消
            </Button>
            <Button
              style={{ backgroundColor: PRIMARY }}
              disabled={
                createMutation.isPending ||
                updateMutation.isPending ||
                !formData.name.trim()
              }
              onClick={handleSubmit}
            >
              {createMutation.isPending || updateMutation.isPending
                ? '保存中...'
                : '确认'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 库类型 Tab + 统计条 + 视图切换 */}
      <Card
        className="w-full"
        style={{
          borderRadius: '12px',
          border: '1px solid #E6EAF2',
          boxShadow: 'none',
        }}
      >
        <CardContent
          className="flex flex-wrap items-center justify-between gap-3 py-3 px-4"
        >
          <div
            className="flex items-center gap-1 rounded-lg p-0.5"
            style={{ backgroundColor: '#F1F5F9' }}
          >
            {LIBRARY_TAB_VALUES.map((t) => {
              const active = libraryType === t;
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => setLibraryType(t)}
                  className="px-3 py-1.5 text-sm font-medium rounded-md transition-all whitespace-nowrap"
                  style={{
                    color: active ? PRIMARY : '#94A3B8',
                    backgroundColor: active ? '#ffffff' : 'transparent',
                    boxShadow: active
                      ? '0 1px 2px rgba(16,24,40,0.06)'
                      : 'none',
                  }}
                >
                  {libraryTypeLabel(t)}
                  <span
                    className="ml-1.5 text-xs tnum"
                    style={{
                      color: active ? PRIMARY : '#94a3b8',
                      fontWeight: 500,
                    }}
                  >
                    {t === 'all' ? totalCount : (statsData?.byLibraryType?.[t as SubmissionLibraryType] ?? 0)}
                  </span>
                </button>
              );
            })}
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            {!isClient && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => setEliminationDialogOpen(true)}
                className="h-8"
              >
                月度淘汰检查
              </Button>
            )}
            {/* 视图切换 */}
            <div
              className="flex items-center rounded-md p-0.5"
              style={{ backgroundColor: '#F1F5F9' }}
            >
              <button
                type="button"
                onClick={() => setViewMode('card')}
                className="flex h-7 w-7 items-center justify-center rounded"
                style={{
                  backgroundColor: viewMode === 'card' ? '#ffffff' : 'transparent',
                  color: viewMode === 'card' ? PRIMARY : '#94A3B8',
                  boxShadow: viewMode === 'card' ? '0 1px 2px rgba(16,24,40,0.06)' : 'none',
                }}
                aria-label="卡片视图"
              >
                <LayoutGrid className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => setViewMode('table')}
                className="flex h-7 w-7 items-center justify-center rounded"
                style={{
                  backgroundColor: viewMode === 'table' ? '#ffffff' : 'transparent',
                  color: viewMode === 'table' ? PRIMARY : '#94A3B8',
                  boxShadow: viewMode === 'table' ? '0 1px 2px rgba(16,24,40,0.06)' : 'none',
                }}
                aria-label="表格视图"
              >
                <Rows3 className="h-4 w-4" />
              </button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 筛选条 */}
      <div className="filter-bar-card">
        <div className="flex flex-wrap items-center gap-3 flex-1">
          {!isClient && (
            <div className="w-36">
              <Select
                value={brandFilter}
                onValueChange={setBrandFilter}
              >
                <SelectTrigger className="w-full h-9">
                  <SelectValue placeholder="全部品牌" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">全部品牌</SelectItem>
                  {brandOptions.map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="w-32">
            <Select
              value={typeFilter}
              onValueChange={setTypeFilter}
            >
              <SelectTrigger className="w-full h-9">
                <SelectValue placeholder="全部类型" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">全部类型</SelectItem>
                {SUBMISSION_CHANNEL_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {SUBMISSION_CHANNEL_TYPE_LABELS[t]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="w-28">
            <Select
              value={statusFilter}
              onValueChange={setStatusFilter}
            >
              <SelectTrigger className="w-full h-9">
                <SelectValue placeholder="全部状态" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">全部状态</SelectItem>
                {SUBMISSION_CHANNEL_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {SUBMISSION_CHANNEL_STATUS_LABELS[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="w-24">
            <Select
              value={tierFilter}
              onValueChange={setTierFilter}
            >
              <SelectTrigger className="w-full h-9">
                <SelectValue placeholder="全部分级" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">全部分级</SelectItem>
                {SUBMISSION_CHANNEL_TIERS.map((t) => (
                  <SelectItem key={t} value={t}>
                    {SUBMISSION_CHANNEL_TIER_LABELS[t]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="w-32">
            <Select
              value={platformCoverageFilter}
              onValueChange={setPlatformCoverageFilter}
            >
              <SelectTrigger className="w-full h-9">
                <SelectValue placeholder="覆盖平台" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">全部平台</SelectItem>
                {DIAGNOSIS_PLATFORMS.map((p) => (
                  <SelectItem key={p} value={p}>
                    {DIAGNOSIS_PLATFORM_LABELS[p]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {/* 新增：地区 */}
          <div className="w-28">
            <Select
              value={regionFilter}
              onValueChange={setRegionFilter}
            >
              <SelectTrigger className="w-full h-9">
                <SelectValue placeholder="全部地区" />
              </SelectTrigger>
              <SelectContent className="max-h-[300px]">
                <SelectItem value="">全部地区</SelectItem>
                {SUBMISSION_REGIONS.map((r) => (
                  <SelectItem key={r} value={r}>
                    {r}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {/* 新增：行业 */}
          <div className="w-28">
            <Select
              value={industryFilter}
              onValueChange={setIndustryFilter}
            >
              <SelectTrigger className="w-full h-9">
                <SelectValue placeholder="全部行业" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">全部行业</SelectItem>
                {SUBMISSION_INDUSTRIES.map((ind) => (
                  <SelectItem key={ind} value={ind}>
                    {SUBMISSION_INDUSTRY_LABELS[ind]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {/* 新增：AI 信源平台 */}
          <div className="w-32">
            <Select
              value={aiPlatformFilter}
              onValueChange={setAiPlatformFilter}
            >
              <SelectTrigger className="w-full h-9">
                <SelectValue placeholder="全部AI信源" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">全部AI信源</SelectItem>
                {SUBMISSION_AI_SOURCES.map((p) => (
                  <SelectItem key={p} value={p}>
                    {SUBMISSION_AI_SOURCE_LABELS[p]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {/* 新增：模态 */}
          <div className="w-28">
            <Select
              value={mediaTypeFilter}
              onValueChange={setMediaTypeFilter}
            >
              <SelectTrigger className="w-full h-9">
                <SelectValue placeholder="全部模态" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">全部模态</SelectItem>
                {SUBMISSION_MEDIA_TYPES.map((m) => (
                  <SelectItem key={m} value={m}>
                    {SUBMISSION_MEDIA_TYPE_LABELS[m]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="relative w-56">
            <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="搜索信源名称"
              className="h-9 pl-8 pr-8"
            />
            {keyword && (
              <button
                onClick={() => setKeyword('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          {viewMode === 'table' && (
            <button
              type="button"
              onClick={resetAll}
              className="text-[12px] transition-colors hover:underline h-9 flex items-center"
              style={{ color: '#94A3B8' }}
            >
              重置列宽
            </button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setLogDrawerTab('tag');
              setLogDrawerOpen(true);
            }}
            className="h-9"
          >
            <History className="h-3.5 w-3.5" />
            打标记录
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setBatchSheetOpen(true)}
            className="h-9"
          >
            <FileSpreadsheet className="h-3.5 w-3.5" />
            批次清单
          </Button>
          {user?.role === 'admin' && (
            <Button
              variant="outline"
              size="sm"
              onClick={openBulkPriceDialog}
              className="h-9"
            >
              <Tags className="h-3.5 w-3.5" />
              批量调价
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setUrlPatchDialogOpen(true);
              setUrlPatchResult(null);
              setUrlPatchText('');
              setUrlPatchFile(null);
            }}
            className="h-9"
          >
            <LinkIcon className="h-3.5 w-3.5" />
            批量补录网址
          </Button>
          {user?.role === 'admin' || user?.role === 'operator' ? (
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleFillFromMap()}
              disabled={fillFromMapMutation.isPending}
              className="h-9"
            >
              <Wand2 className="h-3.5 w-3.5" />
              {fillFromMapMutation.isPending ? '补录中...' : '域名映射一键补录'}
            </Button>
          ) : null}
          <Button
            size="sm"
            variant="ghost"
            onClick={() => handleExportUnmatched()}
            className="h-9"
            style={{ color: '#94A3B8' }}
          >
            <Download className="h-3.5 w-3.5" />
            导出未匹配清单
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => refetch()}
            className="h-9"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            刷新
          </Button>
        </div>
      </div>

      {/* 选择态提示条 */}
      {(selectionMode === 'all' ||
        (selectionMode === 'page' && selectedIds.size > 0)) && (
        <div
          className="flex items-center justify-between rounded-xl px-4 py-2.5"
          style={{
            backgroundColor: 'rgba(46, 125, 255, 0.08)',
            border: '1px solid rgba(46, 125, 255, 0.18)',
          }}
        >
          <div className="text-sm" style={{ color: PRIMARY }}>
            {selectionMode === 'page' ? (
              <>
                已选{' '}
                <span className="font-medium tnum">
                  {selectedIds.size}
                </span>{' '}
                条（当前页）｜筛选结果共{' '}
                <span className="font-medium tnum">{totalCount}</span>{' '}
                条
              </>
            ) : (
              <>
                已选全部筛选结果（
                <span className="font-medium tnum">{totalCount}</span> 条）
              </>
            )}
          </div>
          <div className="flex items-center gap-3">
            <Button
              size="sm"
              onClick={openBatchDialog}
              className="h-8 text-xs"
            >
              <Tags className="h-3.5 w-3.5" />
              批量打标
            </Button>
            {selectionMode === 'page' && totalCount > 0 && (
              <button
                type="button"
                onClick={selectAllFiltered}
                className="text-xs font-medium transition-colors hover:underline"
                style={{ color: PRIMARY }}
              >
                选择全部筛选结果（{totalCount} 条）
              </button>
            )}
            {selectionMode === 'all' && (
              <button
                type="button"
                onClick={clearSelection}
                className="text-xs font-medium transition-colors hover:underline"
                style={{ color: PRIMARY }}
              >
                取消全选
              </button>
            )}
          </div>
        </div>
      )}

      {/* URL 统计行 */}
      <div
        className="text-xs"
        style={{
          color: '#94A3B8',
          padding: '8px 0 12px 0',
          textAlign: 'left',
        }}
      >
        {urlStatsQuery.isLoading ? (
          <span>统计中...</span>
        ) : urlStatsQuery.data ? (
          <>
            已录入口{' '}
            <span className="tnum font-medium" style={{ color: '#0f172a' }}>
              {urlStatsQuery.data.withUrl.toLocaleString()}
            </span>
            {' ／ '}公共渠道待补{' '}
            <span className="tnum font-medium" style={{ color: '#f59e0b' }}>
              {urlStatsQuery.data.searchDirect.toLocaleString()}
            </span>
            {' ／ '}自有站点{' '}
            <span className="tnum font-medium" style={{ color: '#94A3B8' }}>
              {urlStatsQuery.data.selfSite.toLocaleString()}
            </span>
            {' ／ '}完全无入口{' '}
            <span className="tnum font-medium" style={{ color: '#DC2626' }}>
              {urlStatsQuery.data.noEntry.toLocaleString()}
            </span>
            {' ｜ '}覆盖率{' '}
            <span className="tnum font-medium" style={{ color: PRIMARY }}>
              {urlStatsQuery.data.coverageRate.toFixed(2)}%
            </span>
          </>
        ) : null}
      </div>

      {/* 列表卡片 */}
      <Card
        className="w-full"
        style={{ borderRadius: '14px', border: '1px solid #E6EBF2', boxShadow: '0 1px 2px rgba(16,24,40,0.04)' }}
      >
        <CardContent className="p-0">
          {/* 错误态 */}
          {isError && (
            <div className="flex items-center justify-between rounded-lg border border-amber-200 bg-amber-50 p-4">
              <div
                className="flex items-center gap-2 text-sm"
                style={{ color: '#b45309' }}
              >
                <AlertCircle className="h-4 w-4" />
                <span>数据加载失败，请稍后刷新</span>
              </div>
              <button
                onClick={() => refetch()}
                className="flex items-center gap-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors hover:bg-amber-100"
                style={{ color: '#b45309' }}
              >
                <RefreshCw className="h-3.5 w-3.5" />
                重新加载
              </button>
            </div>
          )}

          {/* 加载态 */}
          {isLoading && viewMode === 'card' && <CardGridSkeleton />}
          {isLoading && viewMode === 'table' && (
            <div className="p-4">
              <TableSkeleton />
            </div>
          )}

          {/* 卡片视图 */}
          {!isLoading && viewMode === 'card' && allItems.length > 0 && (
            <div className="p-4">
              {/* 顶部工具条：本页全选 */}
              <div className="mb-3 flex items-center justify-between rounded-lg border px-4 py-2.5" style={{ borderColor: '#E6EAF2', backgroundColor: '#F7F9FC' }}>
                <label className="flex cursor-pointer items-center gap-2 text-sm" style={{ color: '#0f172a' }}>
                  <Checkbox
                    checked={isCurrentPageAllSelected}
                    onCheckedChange={toggleSelectCurrentPage}
                    aria-label="本页全选"
                  />
                  <span>本页全选</span>
                </label>
                <span className="text-xs" style={{ color: '#94A3B8' }}>
                  共 {allItems.length} 张卡片
                </span>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                {allItems.map((channel: SubmissionChannel) => {
                  const isSelected =
                    selectionMode === 'all' || selectedIds.has(channel.id);
                  return (
                    <Card
                      key={channel.id}
                      className="flex flex-col transition-all hover:border-primary/30"
                      style={{
                        borderRadius: '12px',
                        border: isSelected
                          ? '2px solid #2563EB'
                          : '1px solid #E6EAF2',
                        boxShadow: isSelected
                          ? '0 0 0 2px rgba(46,125,255,0.12)'
                          : 'none',
                      }}
                    >
                      <CardContent className="flex flex-1 flex-col gap-3 p-4">
                        {/* 顶部：复选框 + 名称 + 状态 */}
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex min-w-0 flex-1 items-start gap-2">
                            <div
                              className="mt-0.5 shrink-0"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <Checkbox
                                checked={isSelected}
                                onCheckedChange={() =>
                                  toggleSelectOne(channel.id)
                                }
                                aria-label={`选择 ${channel.name}`}
                              />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1">
                                {isValidSubmitUrl(channel.submitUrl) ? (
                                  <>
                                    <UniversalLink
                                      to={channel.submitUrl!}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      onClick={(e) => e.stopPropagation()}
                                      title={`前往 ${getUrlHostname(channel.submitUrl!)}`}
                                      className="line-clamp-1 text-[15px] transition-colors hover:underline"
                                      style={{
                                        fontWeight: 600,
                                        color: '#0f172a',
                                      }}
                                      onMouseEnter={(e) => {
                                        e.currentTarget.style.color = PRIMARY;
                                      }}
                                      onMouseLeave={(e) => {
                                        e.currentTarget.style.color = '#0f172a';
                                      }}
                                    >
                                      {channel.name}
                                    </UniversalLink>
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        window.open(
                                          channel.submitUrl!,
                                          '_blank',
                                          'noopener,noreferrer',
                                        );
                                      }}
                                      title={`前往 ${getUrlHostname(channel.submitUrl!)}`}
                                      className="shrink-0 transition-colors"
                                      style={{ color: '#94A3B8' }}
                                      onMouseEnter={(e) => {
                                        e.currentTarget.style.color = PRIMARY;
                                      }}
                                      onMouseLeave={(e) => {
                                        e.currentTarget.style.color = '#94A3B8';
                                      }}
                                      aria-label={`打开 ${channel.name} 投稿入口`}
                                    >
                                      <ExternalLink className="h-3.5 w-3.5" />
                                    </button>
                                  </>
                                ) : channel.channelType === 'self_site' ? (
                                  <>
                                    <h3
                                      className="line-clamp-1 text-[15px]"
                                      style={{ fontWeight: 600 }}
                                      title={channel.name}
                                    >
                                      {channel.name}
                                    </h3>
                                    <span
                                      className="shrink-0 text-[11px]"
                                      style={{ color: '#94a3b8' }}
                                      title="客户自有站点，无需补录"
                                    >
                                      客户自有站点
                                    </span>
                                    <span
                                      className="shrink-0"
                                      style={{ color: '#cbd5e1' }}
                                    >
                                      ·
                                    </span>
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        navigate(`/brands/${channel.brandId}`);
                                      }}
                                      className="shrink-0 transition-colors hover:underline"
                                      style={{
                                        fontSize: '11px',
                                        color: PRIMARY,
                                      }}
                                      aria-label="去客户档案"
                                    >
                                      去客户档案配置
                                    </button>
                                  </>
                                ) : (
                                  <>
                                    <h3
                                      className="line-clamp-1 text-[15px]"
                                      style={{ fontWeight: 600 }}
                                      title={channel.name}
                                    >
                                      {channel.name}
                                    </h3>
                                    {channel.name ? (
                                      <>
                                        <UniversalLink
                                          to={`https://www.bing.com/search?q=${encodeURIComponent(channel.name + ' 官网')}`}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          onClick={(e) => e.stopPropagation()}
                                          title="该渠道暂无固定网址，先去搜索确认"
                                          className="shrink-0 text-[11px] transition-colors hover:underline"
                                          style={{ color: '#94A3B8' }}
                                          aria-label={`搜索 ${channel.name} 官网`}
                                        >
                                          搜索直达
                                        </UniversalLink>
                                        <span
                                          className="shrink-0"
                                          style={{ color: '#cbd5e1' }}
                                        >
                                          ·
                                        </span>
                                      </>
                                    ) : null}
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        openPatchUrlDialog(channel);
                                      }}
                                      className="shrink-0 transition-colors hover:underline"
                                      style={{
                                        fontSize: '11px',
                                        color: '#94a3b8',
                                      }}
                                      aria-label="补录网址"
                                    >
                                      补录真实网址
                                    </button>
                                  </>
                                )}
                              </div>
                              <div className="mt-1 flex items-center gap-1.5 text-xs" style={{ color: MUTED }}>
                                <span
                                  className="inline-flex items-center rounded px-1.5 py-0.5 text-[11px] font-medium"
                                  style={{
                                    backgroundColor: LIBRARY_TYPE_COLORS[channel.libraryType]?.bg,
                                    color: LIBRARY_TYPE_COLORS[channel.libraryType]?.color,
                                  }}
                                >
                                  {SUBMISSION_LIBRARY_TYPE_LABELS[channel.libraryType]}
                                </span>
                                <span>·</span>
                                <span>{channel.region || '全国'}</span>
                              </div>
                            </div>
                          </div>
                        <Pill
                          className="shrink-0"
                          variant={
                            ({
                              active: 'success',
                              paused: 'muted',
                              to_be_deprecated: 'danger',
                              archived: 'muted',
                            } as Record<string, 'success' | 'warning' | 'danger' | 'info' | 'muted'>)[
                              channel.status
                            ] || 'muted'
                          }
                        >
                          {getStatusLabel(channel.status)}
                        </Pill>
                      </div>

                      {/* 描述 / 适配行业 */}
                      <div
                        className="line-clamp-2 text-xs leading-relaxed"
                        style={{ color: '#475569' }}
                      >
                        {channel.description ? (
                          channel.description
                        ) : channel.industries && channel.industries.length > 0 ? (
                          <>
                            适配行业：
                            {channel.industries
                              .slice(0, 2)
                              .map((i) => SUBMISSION_INDUSTRY_LABELS[i])
                              .join(' / ')}
                            {channel.industries.length > 2 &&
                              ` 等 ${channel.industries.length} 个`}
                          </>
                        ) : (
                          '—'
                        )}
                      </div>

                      {/* AI 信源平台 chips */}
                      <div className="text-xs">
                        <span style={{ color: MUTED }}>AI 信源：</span>
                        {channel.aiPlatforms && channel.aiPlatforms.length > 0 ? (
                          <span className="inline-flex flex-wrap gap-1 align-top">
                            {channel.aiPlatforms.map((p) => (
                              <span
                                key={p}
                                className="inline-flex items-center rounded px-1.5 py-0.5 text-[11px]"
                                style={{
                                  backgroundColor: 'rgba(46, 125, 255, 0.08)',
                                  color: PRIMARY,
                                }}
                              >
                                {SUBMISSION_AI_SOURCE_LABELS[p]}
                              </span>
                            ))}
                          </span>
                        ) : (
                          <span style={{ color: '#94a3b8' }}>—</span>
                        )}
                      </div>

                      {/* 库存行 */}
                      {channel.quotaTotal !== null &&
                        channel.quotaTotal !== undefined &&
                        channel.quotaTotal > 0 && (
                          <div className="text-xs" style={{ color: MUTED }}>
                            已发布{' '}
                            <span className="font-medium tnum" style={{ color: '#0f172a' }}>
                              {channel.quotaUsed ?? 0}
                            </span>
                            /
                            <span className="tnum">{channel.quotaTotal}</span>
                            <div className="mt-1 h-1.5 w-full rounded-full bg-[#E2E8F0] overflow-hidden">
                              <div
                                className="h-full rounded-full"
                                style={{
                                  width: `${Math.min(
                                    100,
                                    ((channel.quotaUsed ?? 0) / channel.quotaTotal) * 100,
                                  )}%`,
                                  backgroundColor: PRIMARY,
                                }}
                              />
                            </div>
                          </div>
                        )}

                      {/* 价格行 */}
                      {(channel.imagePrice !== null &&
                        channel.imagePrice !== undefined) ||
                      (channel.videoPrice !== null &&
                        channel.videoPrice !== undefined) ? (
                        <div className="flex items-center gap-4 text-xs">
                          {channel.imagePrice !== null &&
                            channel.imagePrice !== undefined && (
                              <span style={{ color: WARNING }}>
                                图文 ¥{channel.imagePrice}/篇
                              </span>
                            )}
                          {channel.videoPrice !== null &&
                            channel.videoPrice !== undefined && (
                              <span style={{ color: WARNING }}>
                                视频 ¥{channel.videoPrice}/条
                              </span>
                            )}
                        </div>
                      ) : null}

                      {/* 底部按钮 */}
                      <div className="mt-auto pt-2 flex flex-col gap-1.5">
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            className="flex-1 h-8"
                            style={{ backgroundColor: PRIMARY }}
                            onClick={() => handleSubmitToChannel(channel)}
                          >
                            {isValidSubmitUrl(channel.submitUrl) ? (
                              <ExternalLink className="mr-1 h-3 w-3" />
                            ) : (
                              <Send className="h-3.5 w-3.5" />
                            )}
                            投稿
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="flex-1 h-8"
                            onClick={() => {
                              navigate('/publish?tab=ledger');
                            }}
                          >
                            <FileSpreadsheet className="h-3.5 w-3.5" />
                            收录记录
                          </Button>
                        </div>
                        {!isValidSubmitUrl(channel.submitUrl) && (
                          <div
                            className="text-center"
                            style={{ fontSize: '11px', color: '#94a3b8' }}
                          >
                            未录投稿地址
                          </div>
                        )}
                        {user?.role === 'admin' && (
                          <button
                            type="button"
                            className="text-center text-xs transition-colors hover:underline"
                            style={{ color: PRIMARY }}
                            onClick={() => openPriceDialog(channel)}
                          >
                            修改价格
                          </button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                  );
                })}
              </div>
              {(totalCount > 0 || allItems.length > 0) && (
                <PaginationBar
                  page={page}
                  pageSize={pageSize}
                  total={totalCount}
                  onPageChange={setPage}
                  onPageSizeChange={(size) => {
                    setPageSize(size);
                    setPage(1);
                  }}
                  loading={isLoading}
                />
              )}
            </div>
          )}

          {/* 表格视图 */}
          {!isLoading && viewMode === 'table' && allItems.length > 0 && (
            <>
              <div className="overflow-x-auto rounded-lg border border-[#E6EAF2]">
                <Table
                  className="data-table table-fixed"
                  style={{ ...getTableStyle(), minWidth: '1500px' }}
                >
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10">
                        <div className="flex items-center gap-1">
                          <Checkbox
                            checked={
                              selectionMode === 'all'
                                ? true
                                : isCurrentPageAllSelected
                            }
                            onCheckedChange={toggleSelectCurrentPage}
                            aria-label="全选当前页"
                          />
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button
                                type="button"
                                className="text-muted-foreground hover:text-foreground"
                                aria-label="全选选项"
                              >
                                <ChevronDown className="h-3.5 w-3.5" />
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="start" className="w-44">
                              <DropdownMenuItem
                                onClick={toggleSelectCurrentPage}
                              >
                                {isCurrentPageAllSelected
                                  ? '取消全选当前页'
                                  : '全选当前页'}
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={selectAllFiltered}>
                                全选全部筛选结果（{totalCount} 条）
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </TableHead>
                      <TableHead
                        data-col="name"
                        className="whitespace-nowrap"
                        style={getThStyle('name')}
                      >
                        信源名称
                        <ColumnResizeHandle
                          onResizeStart={(e) => handleResizeStart('name', e)}
                          onDoubleClick={() => resetColumn('name')}
                          isResizing={isResizing}
                        />
                      </TableHead>
                      <TableHead
                        data-col="libraryType"
                        className="whitespace-nowrap text-left"
                        style={getThStyle('libraryType')}
                      >
                        库类型
                        <ColumnResizeHandle
                          onResizeStart={(e) => handleResizeStart('libraryType', e)}
                          onDoubleClick={() => resetColumn('libraryType')}
                          isResizing={isResizing}
                        />
                      </TableHead>
                      <TableHead
                        data-col="region"
                        className="whitespace-nowrap text-left"
                        style={getThStyle('region')}
                      >
                        地区
                        <ColumnResizeHandle
                          onResizeStart={(e) => handleResizeStart('region', e)}
                          onDoubleClick={() => resetColumn('region')}
                          isResizing={isResizing}
                        />
                      </TableHead>
                      <TableHead
                        data-col="industry"
                        className="whitespace-nowrap"
                        style={getThStyle('industry')}
                      >
                        适配行业
                        <ColumnResizeHandle
                          onResizeStart={(e) => handleResizeStart('industry', e)}
                          onDoubleClick={() => resetColumn('industry')}
                          isResizing={isResizing}
                        />
                      </TableHead>
                      <TableHead
                        data-col="aiSources"
                        className="whitespace-nowrap"
                        style={getThStyle('aiSources')}
                      >
                        AI 信源
                        <ColumnResizeHandle
                          onResizeStart={(e) => handleResizeStart('aiSources', e)}
                          onDoubleClick={() => resetColumn('aiSources')}
                          isResizing={isResizing}
                        />
                      </TableHead>
                      <TableHead
                        data-col="mediaType"
                        className="whitespace-nowrap"
                        style={getThStyle('mediaType')}
                      >
                        模态
                        <ColumnResizeHandle
                          onResizeStart={(e) => handleResizeStart('mediaType', e)}
                          onDoubleClick={() => resetColumn('mediaType')}
                          isResizing={isResizing}
                        />
                      </TableHead>
                      <TableHead
                        data-col="quota"
                        className="whitespace-nowrap text-right"
                        style={getThStyle('quota')}
                      >
                        库存
                        <ColumnResizeHandle
                          onResizeStart={(e) => handleResizeStart('quota', e)}
                          onDoubleClick={() => resetColumn('quota')}
                          isResizing={isResizing}
                        />
                      </TableHead>
                      <TableHead
                        data-col="price"
                        className="whitespace-nowrap text-right"
                        style={getThStyle('price')}
                      >
                        图文价 / 视频价
                        <ColumnResizeHandle
                          onResizeStart={(e) => handleResizeStart('price', e)}
                          onDoubleClick={() => resetColumn('price')}
                          isResizing={isResizing}
                        />
                      </TableHead>
                      <TableHead
                        data-col="indexCiteRate"
                        className="whitespace-nowrap"
                        style={getThStyle('indexCiteRate')}
                      >
                        收录率 / 引用率
                        <ColumnResizeHandle
                          onResizeStart={(e) => handleResizeStart('indexCiteRate', e)}
                          onDoubleClick={() => resetColumn('indexCiteRate')}
                          isResizing={isResizing}
                        />
                      </TableHead>
                      <TableHead
                        data-col="status"
                        className="whitespace-nowrap"
                        style={getThStyle('status')}
                      >
                        状态
                        <ColumnResizeHandle
                          onResizeStart={(e) => handleResizeStart('status', e)}
                          onDoubleClick={() => resetColumn('status')}
                          isResizing={isResizing}
                        />
                      </TableHead>
                      <TableHead
                        data-col="actions"
                        className="whitespace-nowrap text-right"
                        style={getThStyle('actions')}
                      >
                        操作
                        <ColumnResizeHandle
                          onResizeStart={(e) => handleResizeStart('actions', e)}
                          onDoubleClick={() => resetColumn('actions')}
                          isResizing={isResizing}
                        />
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {allItems.map((channel: SubmissionChannel) => (
                      <TableRow key={channel.id}>
                        <TableCell className="w-10">
                          <Checkbox
                            checked={
                              selectionMode === 'all' ||
                              selectedIds.has(channel.id)
                            }
                            onCheckedChange={() =>
                              toggleSelectOne(channel.id)
                            }
                            aria-label={`选择 ${channel.name}`}
                          />
                        </TableCell>
                        <TableCell
                          className="font-medium min-w-0"
                          style={getTdStyle('name')}
                        >
                          <div className="space-y-0.5">
                            {isValidSubmitUrl(channel.submitUrl) ? (
                              <UniversalLink
                                to={channel.submitUrl!}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                title={channel.submitUrl!}
                                className="line-clamp-2 block text-[13px] leading-tight transition-colors hover:underline"
                                style={{ color: PRIMARY, fontWeight: 500 }}
                              >
                                {channel.name}
                              </UniversalLink>
                            ) : channel.channelType === 'self_site' ? (
                              <>
                                <div
                                  className="line-clamp-2 text-[13px] leading-tight"
                                  title={channel.name}
                                >
                                  {channel.name}
                                </div>
                                <div className="flex items-center gap-1">
                                  <span
                                    className="text-left text-[11px]"
                                    style={{ color: '#94a3b8' }}
                                    title="客户自有站点，无需补录"
                                  >
                                    客户自有站点
                                  </span>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      navigate(`/brands/${channel.brandId}`);
                                    }}
                                    className="text-left transition-colors hover:underline"
                                    style={{
                                      fontSize: '11px',
                                      color: PRIMARY,
                                    }}
                                  >
                                    去客户档案配置
                                  </button>
                                </div>
                              </>
                            ) : (
                              <>
                                <div
                                  className="line-clamp-2 text-[13px] leading-tight"
                                  title={channel.name}
                                >
                                  {channel.name}
                                </div>
                                <div className="flex items-center gap-1">
                                  {channel.name ? (
                                    <UniversalLink
                                      to={`https://www.bing.com/search?q=${encodeURIComponent(channel.name + ' 官网')}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      onClick={(e) => e.stopPropagation()}
                                      title="该渠道暂无固定网址，先去搜索确认"
                                      className="text-left text-[11px] transition-colors hover:underline"
                                      style={{ color: '#94A3B8' }}
                                    >
                                      搜索直达
                                    </UniversalLink>
                                  ) : null}
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      openPatchUrlDialog(channel);
                                    }}
                                    className="text-left transition-colors hover:underline"
                                    style={{
                                      fontSize: '11px',
                                      color: '#94a3b8',
                                    }}
                                  >
                                    补录真实网址
                                  </button>
                                </div>
                              </>
                            )}
                          </div>
                        </TableCell>
                        <TableCell style={getTdStyle('libraryType')}>
                          <span
                            className="inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium"
                            style={{
                              backgroundColor:
                                LIBRARY_TYPE_COLORS[channel.libraryType]?.bg,
                              color:
                                LIBRARY_TYPE_COLORS[channel.libraryType]?.color,
                            }}
                          >
                            {SUBMISSION_LIBRARY_TYPE_LABELS[channel.libraryType]}
                          </span>
                        </TableCell>
                        <TableCell
                          className="text-xs"
                          style={getTdStyle('region')}
                        >
                          {channel.region || '—'}
                        </TableCell>
                        <TableCell
                          className="min-w-0"
                          style={getTdStyle('industry')}
                        >
                          {channel.industries &&
                          channel.industries.length > 0 ? (
                            <div className="flex flex-wrap gap-1 items-center">
                              {channel.industries.slice(0, 1).map((ind) => (
                                <span
                                  key={ind}
                                  className="inline-flex items-center rounded px-1.5 py-0.5 text-xs whitespace-nowrap"
                                  style={{
                                    backgroundColor: '#F1F5F9',
                                    color: '#475569',
                                  }}
                                >
                                  {SUBMISSION_INDUSTRY_LABELS[ind]}
                                </span>
                              ))}
                              {channel.industries.length > 1 && (
                                <span
                                  className="text-xs whitespace-nowrap"
                                  style={{ color: '#94A3B8' }}
                                  title={channel.industries
                                    .map((i) => SUBMISSION_INDUSTRY_LABELS[i])
                                    .join(', ')}
                                >
                                  +{channel.industries.length - 1}
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-xs">
                              -
                            </span>
                          )}
                        </TableCell>
                        <TableCell style={getTdStyle('aiSources')}>
                          {channel.aiPlatforms &&
                          channel.aiPlatforms.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {channel.aiPlatforms.slice(0, 2).map((p) => (
                                <span
                                  key={p}
                                  className="inline-flex items-center rounded px-1.5 py-0.5 text-[11px]"
                                  style={{
                                    backgroundColor:
                                      'rgba(46, 125, 255, 0.08)',
                                    color: PRIMARY,
                                  }}
                                  title={SUBMISSION_AI_SOURCE_LABELS[p]}
                                >
                                  {SUBMISSION_AI_SOURCE_LABELS[p]}
                                </span>
                              ))}
                              {channel.aiPlatforms.length > 2 && (
                                <span
                                  className="text-[11px]"
                                  style={{ color: '#94a3B8' }}
                                  title={channel.aiPlatforms
                                    .map(
                                      (p) => SUBMISSION_AI_SOURCE_LABELS[p],
                                    )
                                    .join(', ')}
                                >
                                  +{channel.aiPlatforms.length - 2}
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-xs">
                              -
                            </span>
                          )}
                        </TableCell>
                        <TableCell style={getTdStyle('mediaType')}>
                          <span className="text-xs">
                            {SUBMISSION_MEDIA_TYPE_LABELS[channel.mediaType] ||
                              '—'}
                          </span>
                        </TableCell>
                        <TableCell
                          className="text-right tabular-nums text-xs"
                          style={getTdStyle('quota')}
                        >
                          {channel.quotaTotal !== null &&
                          channel.quotaTotal !== undefined &&
                          channel.quotaTotal > 0 ? (
                            <span style={{ color: '#0f172a' }}>
                              {channel.quotaUsed ?? 0}/{channel.quotaTotal}
                            </span>
                          ) : (
                            <span
                              className="text-muted-foreground"
                              style={{ color: '#94a3b8' }}
                            >
                              不限
                            </span>
                          )}
                        </TableCell>
                        <TableCell
                          className="text-right tabular-nums text-xs"
                          style={getTdStyle('price')}
                        >
                          <div className="space-y-0.5">
                            {channel.imagePrice !== null &&
                            channel.imagePrice !== undefined ? (
                              <div style={{ color: WARNING }}>
                                图文 ¥{channel.imagePrice}
                              </div>
                            ) : null}
                            {channel.videoPrice !== null &&
                            channel.videoPrice !== undefined ? (
                              <div style={{ color: WARNING }}>
                                视频 ¥{channel.videoPrice}
                              </div>
                            ) : null}
                            {channel.imagePrice === null &&
                              channel.videoPrice === null && (
                                <span
                                  className="text-muted-foreground"
                                  style={{ color: '#94a3b8' }}
                                >
                                  免费
                                </span>
                              )}
                          </div>
                        </TableCell>
                        <TableCell style={getTdStyle('indexCiteRate')}>
                          {channel.indexRate === 0 &&
                          channel.citeRate === 0 ? (
                            <span className="text-xs" style={{ color: '#94A3B8' }}>
                              待回填
                            </span>
                          ) : (
                            <div className="space-y-1">
                              <div className="text-xs text-muted-foreground">
                                <span
                                  className="tnum"
                                  style={{ color: SUCCESS }}
                                >
                                  {Math.round(channel.indexRate * 100)}%
                                </span>
                                {' 收录 / '}
                                <span
                                  className="tnum"
                                  style={{ color: PRIMARY }}
                                >
                                  {Math.round(channel.citeRate * 100)}%
                                </span>
                                {' 引用'}
                              </div>
                              <div className="space-y-0.5">
                                <div className="h-[3px] w-full rounded-full bg-[#E2E8F0] overflow-hidden">
                                  <div
                                    className="h-full rounded-full"
                                    style={{
                                      width: `${Math.round(
                                        channel.indexRate * 100,
                                      )}%`,
                                      backgroundColor: SUCCESS,
                                    }}
                                  />
                                </div>
                                <div className="h-[3px] w-full rounded-full bg-[#E2E8F0] overflow-hidden">
                                  <div
                                    className="h-full rounded-full"
                                    style={{
                                      width: `${Math.round(
                                        channel.citeRate * 100,
                                      )}%`,
                                      backgroundColor: PRIMARY,
                                    }}
                                  />
                                </div>
                              </div>
                            </div>
                          )}
                        </TableCell>
                        <TableCell style={getTdStyle('status')}>
                          <span className="inline-flex items-center text-xs">
                            <span
                              className="status-dot"
                              style={{
                                backgroundColor:
                                  channel.status === 'active'
                                    ? '#12B76A'
                                    : '#8A93A6',
                              }}
                            />
                            {getStatusLabel(channel.status)}
                          </span>
                        </TableCell>
                        <TableCell
                          className="whitespace-nowrap text-right"
                          style={getTdStyle('actions')}
                        >
                          <div className="flex items-center justify-end gap-2">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-7 w-7 p-0"
                                >
                                  <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-32">
                                {channel.ownerType === 'platform' ? (
                                  <>
                                    <DropdownMenuItem disabled>
                                      预置信源不可编辑
                                    </DropdownMenuItem>
                                  </>
                                ) : (
                                  <>
                                    {user?.role === 'admin' && (
                                      <DropdownMenuItem
                                        onClick={() => openPriceDialog(channel)}
                                      >
                                        修改价格
                                      </DropdownMenuItem>
                                    )}
                                    <DropdownMenuItem
                                      onClick={() => openEdit(channel)}
                                    >
                                      编辑
                                    </DropdownMenuItem>
                                    {channel.status === 'active' ? (
                                      <DropdownMenuItem
                                        disabled={
                                          toggleStatusMutation.isPending
                                        }
                                        onClick={() =>
                                          toggleStatusMutation.mutate({
                                            id: channel.id,
                                            status: 'paused',
                                          })
                                        }
                                      >
                                        <Pause className="mr-2 h-4 w-4" />
                                        暂停
                                      </DropdownMenuItem>
                                    ) : (
                                      <DropdownMenuItem
                                        disabled={
                                          toggleStatusMutation.isPending
                                        }
                                        onClick={() =>
                                          toggleStatusMutation.mutate({
                                            id: channel.id,
                                            status: 'active',
                                          })
                                        }
                                      >
                                        <Play className="mr-2 h-4 w-4" />
                                        启用
                                      </DropdownMenuItem>
                                    )}
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem
                                      className="text-destructive focus:text-destructive"
                                      onClick={() =>
                                        setDeleteConfirm(channel)
                                      }
                                    >
                                      <Trash2 className="mr-2 h-4 w-4" />
                                      删除
                                    </DropdownMenuItem>
                                  </>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              {(totalCount > 0 || allItems.length > 0) && (
                <PaginationBar
                  page={page}
                  pageSize={pageSize}
                  total={totalCount}
                  onPageChange={setPage}
                  onPageSizeChange={(size) => {
                    setPageSize(size);
                    setPage(1);
                  }}
                  loading={isLoading}
                />
              )}
            </>
          )}

          {/* 空态 */}
          {!isLoading && !isError && allItems.length === 0 && (
            <Empty className="min-h-[360px]">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <Send />
                </EmptyMedia>
                <EmptyTitle>暂无信源</EmptyTitle>
                <EmptyDescription>
                  添加信源渠道，用于稿件外投与搜索引擎收录追踪
                </EmptyDescription>
                <Button
                  onClick={openCreate}
                  className="mt-4"
                  style={{ backgroundColor: '#2563EB' }}
                >
                  <Plus className="h-4 w-4" />
                  新增信源
                </Button>
              </EmptyHeader>
            </Empty>
          )}
        </CardContent>
      </Card>

      {/* 单条补录网址 Dialog */}
      <Dialog
        open={patchUrlDialog.open}
        onOpenChange={(open) => {
          if (!open) closePatchUrlDialog();
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>补录网址</DialogTitle>
            <DialogDescription className="text-xs">
              为「{patchUrlDialog.channelName}」补录投稿入口地址
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <label className="text-xs font-medium" style={{ color: MUTED }}>
                渠道名称
              </label>
              <div
                className="rounded-md border px-3 py-2 text-sm"
                style={{
                  borderColor: '#E6EAF2',
                  backgroundColor: '#F7F9FC',
                  color: '#0f172a',
                }}
              >
                {patchUrlDialog.channelName}
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium" style={{ color: MUTED }}>
                网址
              </label>
              <Input
                type="text"
                value={patchUrlInput}
                onChange={(e) => {
                  setPatchUrlInput(e.target.value);
                  if (patchUrlError) setPatchUrlError('');
                }}
                placeholder="https://example.com"
                className="h-9"
              />
              {patchUrlError && (
                <p className="text-xs" style={{ color: DANGER }}>
                  {patchUrlError}
                </p>
              )}
              <p className="text-xs" style={{ color: '#94a3b8' }}>
                支持 http:// 和 https://，如果只写域名会自动补 https://
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closePatchUrlDialog}>
              取消
            </Button>
            <Button
              style={{ backgroundColor: PRIMARY }}
              onClick={handlePatchUrlSave}
              disabled={patchUrlMutation.isPending}
            >
              {patchUrlMutation.isPending ? '保存中...' : '保存'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 批量导入弹窗 */}
      <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>批量导入信源</DialogTitle>
            <DialogDescription className="text-xs">
              支持 CSV 格式批量导入信源渠道
            </DialogDescription>
          </DialogHeader>
          {/* Tab 切换 */}
          <div
            className="flex gap-1 rounded-lg p-1"
            style={{ backgroundColor: '#F7F9FC' }}
          >
            <button
              type="button"
              onClick={() => setImportTab('upload')}
              className="flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors"
              style={{
                backgroundColor:
                  importTab === 'upload' ? '#ffffff' : 'transparent',
                color: importTab === 'upload' ? PRIMARY : '#94A3B8',
                boxShadow:
                  importTab === 'upload'
                    ? '0 1px 2px rgba(0,0,0,0.05)'
                    : 'none',
              }}
            >
              <Upload className="mr-1.5 inline h-3.5 w-3.5" />
              上传导入
            </button>
            <button
              type="button"
              onClick={() => setImportTab('template')}
              className="flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors"
              style={{
                backgroundColor:
                  importTab === 'template' ? '#ffffff' : 'transparent',
                color: importTab === 'template' ? PRIMARY : '#94A3B8',
                boxShadow:
                  importTab === 'template'
                    ? '0 1px 2px rgba(0,0,0,0.05)'
                    : 'none',
              }}
            >
              <Download className="mr-1.5 inline h-3.5 w-3.5" />
              下载模板
            </button>
          </div>

          {importTab === 'template' ? (
            <div className="space-y-4 py-4">
              <div
                className="rounded-lg border p-4 text-sm"
                style={{ borderColor: '#E6EAF2' }}
              >
                <div className="flex items-start gap-3">
                  <FileText
                    className="mt-0.5 h-5 w-5 flex-shrink-0"
                    style={{ color: PRIMARY }}
                  />
                  <div className="space-y-1.5">
                    <p className="font-medium">模板说明</p>
                    <ul
                      className="list-disc space-y-1 pl-4 text-xs text-muted-foreground"
                    >
                      <li>模板为 CSV 格式，使用 UTF-8 编码</li>
                      <li>
                        多值字段（适配行业、AI 信源标记、AI 平台）用 | 分隔
                      </li>
                      <li>
                        渠道类型可选值：authoritative_media /
                        public_submission / industry_vertical / self_site
                      </li>
                      <li>
                        AI 信源可选值：doubao / deepseek / wenxin / tongyi /
                        yuanbao / kimi
                      </li>
                      <li>库类型可选值：private / public / authoritative / b2b_alliance / multimodal</li>
                      <li>模态可选值：image_text / video / image_text_video</li>
                      <li>第一行为表头，请勿修改表头文字</li>
                    </ul>
                  </div>
                </div>
              </div>
              <div className="flex justify-center">
                <Button
                  onClick={downloadTemplate}
                  style={{ backgroundColor: PRIMARY }}
                >
                  <Download className="mr-2 h-4 w-4" />
                  下载模板
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4 py-2 max-h-[60vh] overflow-y-auto">
              {/* 文件选择区 */}
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed py-8 text-center transition-colors hover:border-blue-400"
                style={{ borderColor: '#CBD5E1' }}
              >
                <Upload
                  className="mb-2 h-8 w-8 text-muted-foreground"
                />
                {csvFileName ? (
                  <div className="space-y-1">
                    <p className="text-sm font-medium">{csvFileName}</p>
                    <p className="text-xs text-muted-foreground">
                      点击重新选择文件
                    </p>
                  </div>
                ) : (
                  <div className="space-y-1">
                    <p className="text-sm font-medium">
                      点击或拖拽 CSV 文件到此处
                    </p>
                    <p className="text-xs text-muted-foreground">
                      支持 .csv 格式文件
                    </p>
                  </div>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv"
                  className="hidden"
                  onChange={handleFileInputChange}
                />
              </div>

              {/* 解析中 */}
              {isParsing && (
                <div className="flex items-center justify-center gap-2 py-4 text-sm text-muted-foreground">
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  正在解析文件...
                </div>
              )}

              {/* 预览结果 */}
              {previewData && !isParsing && (
                <div className="space-y-3">
                  {/* 统计数字 */}
                  <div className="grid grid-cols-4 gap-3">
                    <div
                      className="rounded-lg border p-3 text-center"
                      style={{ borderColor: '#E6EAF2' }}
                    >
                      <div
                        className="text-2xl font-semibold tnum"
                        style={{ color: PRIMARY }}
                      >
                        {previewData.total}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        共 N 条
                      </div>
                    </div>
                    <div
                      className="rounded-lg border p-3 text-center"
                      style={{ borderColor: '#E6EAF2' }}
                    >
                      <div
                        className="text-2xl font-semibold tnum"
                        style={{ color: WARNING }}
                      >
                        {previewData.duplicate}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        重复
                      </div>
                    </div>
                    <div
                      className="rounded-lg border p-3 text-center"
                      style={{ borderColor: '#E6EAF2' }}
                    >
                      <div
                        className="text-2xl font-semibold tnum"
                        style={{ color: SUCCESS }}
                      >
                        {previewData.newCount}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        新增
                      </div>
                    </div>
                    <div
                      className="rounded-lg border p-3 text-center"
                      style={{ borderColor: '#E6EAF2' }}
                    >
                      <div
                        className="text-2xl font-semibold tnum"
                        style={{ color: DANGER }}
                      >
                        {previewData.errorCount}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        错误
                      </div>
                    </div>
                  </div>

                  {/* 错误列表 */}
                  {previewData.errors &&
                    previewData.errors.length > 0 && (
                      <div
                        className="rounded-lg border p-3"
                        style={{
                          borderColor: '#FECACA',
                          backgroundColor: '#FEF2F2',
                        }}
                      >
                        <div className="mb-2 flex items-center gap-2 text-sm font-medium">
                          <XCircle
                            className="h-4 w-4"
                            style={{ color: DANGER }}
                          />
                          错误行（最多显示 20 条）
                        </div>
                        <ul className="space-y-1 text-xs">
                          {previewData.errors
                            .slice(0, 20)
                            .map((err, i) => (
                              <li
                                key={i}
                                className="flex items-start gap-2"
                                style={{ color: '#991B1B' }}
                              >
                                <span className="font-medium">
                                  第 {err.row} 行
                                </span>
                                <span>—</span>
                                <span>{err.error}</span>
                              </li>
                            ))}
                        </ul>
                      </div>
                    )}

                  {/* 预览表 */}
                  {previewData.sampleItems &&
                    previewData.sampleItems.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-sm font-medium">
                          预览（样例 {previewData.sampleItems.length} 条）
                        </p>
                        <div
                          className="overflow-x-auto rounded-lg border"
                          style={{ borderColor: '#E6EAF2' }}
                        >
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>信源名称</TableHead>
                                <TableHead>类型</TableHead>
                                <TableHead>是否重复</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {previewData.sampleItems.map((item, i) => (
                                <TableRow key={i}>
                                  <TableCell className="text-sm">
                                    {item.name}
                                  </TableCell>
                                  <TableCell>
                                    <span
                                      className="inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium"
                                      style={{
                                        backgroundColor:
                                          getChannelTypeMeta(
                                            item.channelType,
                                          ).bg,
                                        color:
                                          getChannelTypeMeta(
                                            item.channelType,
                                          ).color,
                                      }}
                                    >
                                      {getChannelTypeLabel(
                                        item.channelType,
                                      )}
                                    </span>
                                  </TableCell>
                                  <TableCell>
                                    {item.isDuplicate ? (
                                      <span
                                        className="inline-flex items-center gap-1 text-xs"
                                        style={{ color: WARNING }}
                                      >
                                        <Copy className="h-3 w-3" />
                                        重复
                                      </span>
                                    ) : (
                                      <span
                                        className="inline-flex items-center gap-1 text-xs"
                                        style={{ color: SUCCESS }}
                                      >
                                        <CheckCircle2 className="h-3 w-3" />
                                        新增
                                      </span>
                                    )}
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      </div>
                    )}
                </div>
              )}

              {/* 未选文件提示 */}
              {!csvContent && !isParsing && !previewData && (
                <div className="text-center text-xs text-muted-foreground">
                  选择 CSV 文件后将自动解析并显示预览结果
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setImportDialogOpen(false)}
            >
              取消
            </Button>
            {importTab === 'upload' && (
              <Button
                style={{ backgroundColor: PRIMARY }}
                disabled={
                  !previewData ||
                  previewData.errorCount > 0 ||
                  confirmMutation.isPending ||
                  previewData.newCount === 0
                }
                onClick={() => confirmMutation.mutate()}
              >
                {confirmMutation.isPending
                  ? '导入中...'
                  : `确认导入（${previewData?.newCount ?? 0} 条）`}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 编辑信源入口弹窗 */}
      <Dialog
        open={!!entryEditChannel}
        onOpenChange={(v) => !v && setEntryEditChannel(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>编辑信源入口</DialogTitle>
            <DialogDescription>
              设置该信源的入口地址，用于一键跳转投稿页面
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5 py-2">
            <label className="text-sm font-medium">
              信源入口 URL <span style={{ color: DANGER }}>*</span>
            </label>
            <Input
              value={entryUrlInput}
              onChange={(e) => setEntryUrlInput(e.target.value)}
              onBlur={() => setEntryUrlTouched(true)}
              placeholder="https://..."
              className="h-9"
              style={{
                borderColor:
                  entryUrlTouched && entryUrlInvalid ? DANGER : undefined,
              }}
            />
            {entryUrlTouched && entryUrlInvalid && (
              <p className="text-xs" style={{ color: DANGER }}>
                请输入有效的 http:// 或 https:// 链接
              </p>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEntryEditChannel(null)}
            >
              取消
            </Button>
            <Button
              style={{ backgroundColor: PRIMARY }}
              disabled={updateSubmitUrlMutation.isPending || entryUrlInvalid}
              onClick={() =>
                entryEditChannel &&
                updateSubmitUrlMutation.mutate({
                  id: entryEditChannel.id,
                  url: entryUrlInput.trim(),
                })
              }
            >
              {updateSubmitUrlMutation.isPending ? '保存中...' : '保存'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 删除确认弹窗 */}
      <Dialog
        open={!!deleteConfirm}
        onOpenChange={(v) => !v && setDeleteConfirm(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>确认删除</DialogTitle>
            <DialogDescription>
              删除后该信源渠道将被移除，相关投稿记录不受影响。确认删除「
              {deleteConfirm?.name}」？
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteConfirm(null)}
            >
              取消
            </Button>
            <Button
              variant="destructive"
              disabled={deleteMutation.isPending}
              onClick={() =>
                deleteConfirm && deleteMutation.mutate(deleteConfirm.id)
              }
            >
              {deleteMutation.isPending ? '删除中...' : '确认删除'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 月度淘汰检查弹窗 */}
      <Dialog
        open={eliminationDialogOpen}
        onOpenChange={(v) => {
          setEliminationDialogOpen(v);
          if (!v) {
            setSelectedEliminationIds([]);
          }
        }}
      >
        <DialogContent className="sm:max-w-5xl w-[90vw]">
          <DialogHeader>
            <DialogTitle>月度淘汰检查</DialogTitle>
            <DialogDescription>
              扫描全库常用信源，列出符合淘汰条件的记录（连续 60 天 0 引用且收录率低于 30%）
            </DialogDescription>
          </DialogHeader>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button
                size="sm"
                onClick={startEliminationScan}
                disabled={eliminationScanQuery.isFetching}
                style={{ backgroundColor: PRIMARY }}
              >
                {eliminationScanQuery.isFetching ? (
                  <>
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    扫描中...
                  </>
                ) : (
                  '开始扫描'
                )}
              </Button>
              {hasScanned && !eliminationScanQuery.isFetching && (
                <span className="text-sm text-muted-foreground">
                  扫描结果：共{' '}
                  <span className="font-medium tnum" style={{ color: DANGER }}>
                    {eliminationScanQuery.data?.total ?? 0}
                  </span>{' '}
                  条符合淘汰条件
                </span>
              )}
            </div>
            {hasScanned &&
              !eliminationScanQuery.isFetching &&
              eliminationScanQuery.data &&
              eliminationScanQuery.data.items.length > 0 && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">
                    已选{' '}
                    <span className="tnum font-medium">
                      {selectedEliminationIds.length}
                    </span>{' '}
                    条
                  </span>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={
                      selectedEliminationIds.length === 0 ||
                      eliminationBatchMutation.isPending
                    }
                    onClick={() => handleBatchElimination('keep')}
                  >
                    批量保留
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={
                      selectedEliminationIds.length === 0 ||
                      eliminationBatchMutation.isPending
                    }
                    onClick={() => handleBatchElimination('mark_deprecated')}
                  >
                    批量标记待淘汰
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={
                      selectedEliminationIds.length === 0 ||
                      eliminationBatchMutation.isPending
                    }
                    onClick={() => handleBatchElimination('archive')}
                  >
                    批量归档
                  </Button>
                </div>
              )}
          </div>

          <div
            className="rounded-lg border border-[#E6EAF2] max-h-[55vh] overflow-y-auto"
          >
            {!hasScanned ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <Search className="h-10 w-10 mb-3 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  点击「开始扫描」检查全库待淘汰信源
                </p>
              </div>
            ) : eliminationScanQuery.isFetching ? (
              <div className="p-4 space-y-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-4">
                    <Skeleton className="h-4 w-40" />
                    <Skeleton className="h-4 w-16" />
                    <Skeleton className="h-4 w-16" />
                    <Skeleton className="h-4 w-20" />
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-4 w-20" />
                    <Skeleton className="h-4 w-32" />
                  </div>
                ))}
              </div>
            ) : eliminationScanQuery.data?.items.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <CheckCircle2
                  className="h-10 w-10 mb-3"
                  style={{ color: SUCCESS }}
                />
                <p className="text-sm font-medium">暂无符合淘汰条件的信源</p>
                <p className="text-xs text-muted-foreground mt-1">
                  所有常用信源均满足质量标准
                </p>
              </div>
            ) : (
              <Table>
                <TableHeader className="sticky top-0 z-10">
                  <TableRow>
                    <TableHead className="w-10">
                      <input
                        type="checkbox"
                        checked={
                          selectedEliminationIds.length ===
                            eliminationScanQuery.data?.items.length &&
                          eliminationScanQuery.data.items.length > 0
                        }
                        onChange={toggleEliminationSelectAll}
                        className="h-4 w-4 rounded border-slate-300"
                      />
                    </TableHead>
                    <TableHead>信源名</TableHead>
                    <TableHead>类型</TableHead>
                    <TableHead className="text-right">引用率</TableHead>
                    <TableHead>最近引用</TableHead>
                    <TableHead className="text-right">收录率</TableHead>
                    <TableHead>覆盖平台</TableHead>
                    <TableHead>淘汰原因</TableHead>
                    <TableHead className="text-right">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {eliminationScanQuery.data?.items.map(
                    (item: EliminationScanItem) => (
                      <TableRow key={item.id}>
                        <TableCell>
                          <input
                            type="checkbox"
                            checked={selectedEliminationIds.includes(item.id)}
                            onChange={() => toggleEliminationSelect(item.id)}
                            className="h-4 w-4 rounded border-slate-300"
                          />
                        </TableCell>
                        <TableCell className="font-medium">
                          {item.name}
                        </TableCell>
                        <TableCell>
                          <span
                            className="inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium"
                            style={{
                              backgroundColor:
                                getChannelTypeMeta(item.channelType).bg,
                              color: getChannelTypeMeta(item.channelType).color,
                            }}
                          >
                            {getChannelTypeLabel(item.channelType)}
                          </span>
                        </TableCell>
                        <TableCell
                          className="text-right tnum"
                          style={{ color: PRIMARY }}
                        >
                          {Math.round(item.citeRate * 100)}%
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {item.lastCiteAt
                            ? new Date(item.lastCiteAt).toLocaleDateString(
                                'zh-CN',
                              )
                            : '无记录'}
                        </TableCell>
                        <TableCell
                          className="text-right tnum"
                          style={{ color: SUCCESS }}
                        >
                          {Math.round(item.indexRate * 100)}%
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            {PLATFORM_ORDER.map((p: DiagnosisPlatform) => {
                              const covered = item.platformCoverage?.includes(p);
                              return (
                                <span
                                  key={p}
                                  title={DIAGNOSIS_PLATFORM_LABELS[p]}
                                  className="inline-block rounded-full"
                                  style={{
                                    width: '8px',
                                    height: '8px',
                                    backgroundColor: covered
                                      ? PLATFORM_DOT_COLORS[p]
                                      : 'transparent',
                                    border: covered
                                      ? 'none'
                                      : '1px solid #CBD5E1',
                                  }}
                                />
                              );
                            })}
                          </div>
                        </TableCell>
                        <TableCell
                          className="text-xs text-muted-foreground max-w-[180px]"
                        >
                          <span title={item.reason} className="line-clamp-1">
                            {item.reason}
                          </span>
                        </TableCell>
                        <TableCell className="text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 px-2 text-xs"
                              style={{ color: SUCCESS }}
                              disabled={eliminationSingleMutation.isPending}
                              onClick={() =>
                                eliminationSingleMutation.mutate({
                                  id: item.id,
                                  action: 'keep',
                                })
                              }
                            >
                              保留
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 px-2 text-xs"
                              style={{ color: WARNING }}
                              disabled={eliminationSingleMutation.isPending}
                              onClick={() =>
                                eliminationSingleMutation.mutate({
                                  id: item.id,
                                  action: 'mark_deprecated',
                                })
                              }
                            >
                              标记待淘汰
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 px-2 text-xs"
                              style={{ color: MUTED }}
                              disabled={eliminationSingleMutation.isPending}
                              onClick={() =>
                                eliminationSingleMutation.mutate({
                                  id: item.id,
                                  action: 'archive',
                                })
                              }
                            >
                              移入归档
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ),
                  )}
                </TableBody>
              </Table>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEliminationDialogOpen(false)}
            >
              关闭
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 单条调价弹窗 */}
      <Dialog open={priceDialogOpen} onOpenChange={(open) => { if (!open) closePriceDialog(); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>修改价格</DialogTitle>
            <DialogDescription>
              调整渠道售价，售价不得低于成本价
            </DialogDescription>
          </DialogHeader>

          {priceEditChannel && (
            <div className="space-y-4">
              <div className="rounded-lg bg-slate-50 p-4 space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span style={{ color: '#64748b' }}>渠道名称</span>
                  <span className="font-medium">{priceEditChannel.name}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span style={{ color: '#64748b' }}>采购价（成本）</span>
                  <span className="font-medium tnum">
                    ¥{((priceEditChannel.costPriceCents ?? 0) / 100).toFixed(2)}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span style={{ color: '#64748b' }}>当前售价</span>
                  <span className="font-medium tnum" style={{ color: WARNING }}>
                    ¥{((priceEditChannel.salePriceCents ?? 0) / 100).toFixed(2)}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span style={{ color: '#64748b' }}>当前加价率</span>
                  <span className="font-medium tnum">
                    {(priceEditChannel.costPriceCents ?? 0) > 0
                      ? (((priceEditChannel.salePriceCents ?? 0) / (priceEditChannel.costPriceCents ?? 0))).toFixed(2) + 'x'
                      : '-'}
                  </span>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">新售价（元）</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">¥</span>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={priceEditValue}
                    onChange={(e) => setPriceEditValue(e.target.value)}
                    className="pl-7"
                    placeholder="请输入新售价"
                  />
                </div>
                {priceEditValue && Number(priceEditValue) >= 0 && (
                  <div className="text-sm" style={{ color: '#64748b' }}>
                    新加价率：
                    <span className="font-medium tnum">
                      {(priceEditChannel.costPriceCents ?? 0) > 0
                        ? ((Number(priceEditValue) * 100) / (priceEditChannel.costPriceCents ?? 0)).toFixed(2) + 'x'
                        : '-'}
                    </span>
                  </div>
                )}
                {Number(priceEditValue) * 100 < (priceEditChannel.costPriceCents ?? 0) && (
                  <p className="text-sm" style={{ color: DANGER }}>
                    售价不得低于成本价
                  </p>
                )}
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={closePriceDialog}
              disabled={updatePriceMutation.isPending}
            >
              取消
            </Button>
            <Button
              onClick={() => {
                if (!priceEditChannel) return;
                const cents = Math.round(Number(priceEditValue) * 100);
                updatePriceMutation.mutate({
                  id: priceEditChannel.id,
                  salePriceCents: cents,
                });
              }}
              disabled={
                !priceEditChannel ||
                !priceEditValue ||
                isNaN(Number(priceEditValue)) ||
                Number(priceEditValue) < 0 ||
                Number(priceEditValue) * 100 < (priceEditChannel?.costPriceCents ?? 0) ||
                updatePriceMutation.isPending
              }
            >
              {updatePriceMutation.isPending ? '保存中...' : '保存'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 批量调价弹窗 */}
      <Dialog open={bulkPriceDialogOpen} onOpenChange={(open) => { if (!open) closeBulkPriceDialog(); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>批量调价</DialogTitle>
            <DialogDescription>
              按当前筛选条件批量调整渠道售价
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div
              className="rounded-lg px-3 py-2 text-xs"
              style={{ backgroundColor: 'rgba(245, 158, 11, 0.08)', color: '#B45309' }}
            >
              ⚠ 未选择筛选条件时不影响任何渠道，请先在列表页设置筛选后再操作
            </div>

            <Tabs value={bulkPriceMode} onValueChange={(v) => {
              setBulkPriceMode(v as BulkPriceMode);
              setBulkPricePreviewCount(null);
              setBulkPriceConfirmed(false);
            }}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="markup_rate">按加价率</TabsTrigger>
                <TabsTrigger value="fixed_delta">按固定金额</TabsTrigger>
              </TabsList>

              <TabsContent value="markup_rate" className="space-y-3 pt-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">加价倍率</label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0.1"
                    value={bulkMarkupRate}
                    onChange={(e) => {
                      setBulkMarkupRate(e.target.value);
                      setBulkPricePreviewCount(null);
                      setBulkPriceConfirmed(false);
                    }}
                    placeholder="例如：1.95 表示售价 = 成本价 × 1.95"
                  />
                  <p className="text-xs" style={{ color: '#64748b' }}>
                    售价 = 成本价 × 倍率
                  </p>
                </div>
              </TabsContent>

              <TabsContent value="fixed_delta" className="space-y-3 pt-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">增减金额（元）</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">¥</span>
                    <Input
                      type="number"
                      step="0.01"
                      value={bulkFixedDelta}
                      onChange={(e) => {
                        setBulkFixedDelta(e.target.value);
                        setBulkPricePreviewCount(null);
                        setBulkPriceConfirmed(false);
                      }}
                      className="pl-7"
                      placeholder="正数加价，负数降价"
                    />
                  </div>
                  <p className="text-xs" style={{ color: '#64748b' }}>
                    售价 = 成本价 ± 金额（低于成本价的渠道会被跳过）
                  </p>
                </div>
              </TabsContent>
            </Tabs>

            <div className="flex items-center justify-between rounded-lg bg-slate-50 px-4 py-3">
              <span className="text-sm" style={{ color: '#64748b' }}>
                影响渠道数
              </span>
              <span className="font-medium tnum">
                {bulkPricePreviewCount !== null ? `${bulkPricePreviewCount} 条` : '未预览'}
              </span>
            </div>

            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => {
                  const filter: SubmissionChannelQuery = {
                    libraryType: libraryType === 'all' ? undefined : libraryType,
                    type: (typeFilter || undefined) as SubmissionChannelType | undefined,
                    status: (statusFilter || undefined) as SubmissionChannelStatus | undefined,
                    tier: (tierFilter || undefined) as SubmissionChannelTier | undefined,
                    platformCoverage: (platformCoverageFilter || undefined) as DiagnosisPlatform | undefined,
                    region: regionFilter || undefined,
                    industry: industryFilter || undefined,
                    aiPlatform: (aiPlatformFilter || undefined) as SubmissionAiSource | undefined,
                    mediaType: (mediaTypeFilter || undefined) as SubmissionMediaType | undefined,
                    keyword: keyword || undefined,
                    brandId: effectiveBrandId || undefined,
                  };
                  bulkPricePreviewMutation.mutate(buildFilterQuery());
                }}
                disabled={
                  bulkPricePreviewMutation.isPending ||
                  (bulkPriceMode === 'markup_rate' && (!bulkMarkupRate || Number(bulkMarkupRate) < 0.1)) ||
                  (bulkPriceMode === 'fixed_delta' && bulkFixedDelta === '')
                }
              >
                {bulkPricePreviewMutation.isPending ? '预览中...' : '预览条数'}
              </Button>
            </div>

            {bulkPricePreviewCount !== null && bulkPricePreviewCount > 0 && !bulkPriceConfirmed && (
              <button
                type="button"
                className="w-full text-center text-xs transition-colors hover:underline"
                style={{ color: PRIMARY }}
                onClick={() => setBulkPriceConfirmed(true)}
              >
                确认对 {bulkPricePreviewCount} 条渠道执行批量调价？此操作不可撤销
              </button>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={closeBulkPriceDialog}
              disabled={bulkPriceExecuteMutation.isPending}
            >
              取消
            </Button>
            <Button
              onClick={() => {
                const filter: SubmissionChannelQuery = {
                  libraryType: libraryType === 'all' ? undefined : libraryType,
                  type: (typeFilter || undefined) as SubmissionChannelType | undefined,
                  status: (statusFilter || undefined) as SubmissionChannelStatus | undefined,
                  tier: (tierFilter || undefined) as SubmissionChannelTier | undefined,
                  platformCoverage: (platformCoverageFilter || undefined) as DiagnosisPlatform | undefined,
                  region: regionFilter || undefined,
                  industry: industryFilter || undefined,
                  aiPlatform: (aiPlatformFilter || undefined) as SubmissionAiSource | undefined,
                  mediaType: (mediaTypeFilter || undefined) as SubmissionMediaType | undefined,
                  keyword: keyword || undefined,
                  brandId: effectiveBrandId || undefined,
                };
                bulkPriceExecuteMutation.mutate(buildFilterQuery());
              }}
              disabled={
                !bulkPriceConfirmed ||
                bulkPriceExecuteMutation.isPending ||
                bulkPricePreviewCount === null ||
                bulkPricePreviewCount === 0
              }
            >
              {bulkPriceExecuteMutation.isPending ? '执行中...' : '确认执行'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 批量打 AI 信源标签弹窗 */}
      <Dialog open={batchDialogOpen} onOpenChange={(open) => { if (!batchBatching) setBatchDialogOpen(open); }}>
        <DialogContent className="sm:max-w-2xl">
          {batchBatching && (
            <div className="absolute inset-0 z-50 flex items-center justify-center rounded-lg bg-white/80 backdrop-blur-sm">
              <div className="text-center">
                <div className="mb-3 flex items-center justify-center">
                  <div className="h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-[#2563EB]"></div>
                </div>
                <p className="text-sm font-medium">分批打标进行中...</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  第 {batchProgress.current} / {batchProgress.total} 批完成，已更新 {batchProgress.updated} 条
                </p>
              </div>
            </div>
          )}
          <DialogHeader>
            <DialogTitle>
              {batchTargetRow
                ? `批量打 AI 信源标签（${batchTargetRow.region} · ${SUBMISSION_INDUSTRY_LABELS[batchTargetRow.industry] || batchTargetRow.industry}）`
                : `批量打 AI 信源标签（${selectedCount} 条）`}
            </DialogTitle>
            <DialogDescription className="text-xs">
              {batchTargetRow
                ? `共 ${batchTargetRow.totalCount} 条渠道，作用范围：${batchTargetRow.region} · ${SUBMISSION_INDUSTRY_LABELS[batchTargetRow.industry] || batchTargetRow.industry}`
                : '为选中渠道批量设置 AI 信源平台、模态及价格等信息'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 py-2 max-h-[70vh] overflow-y-auto">
            {/* 1. 作用范围 */}
            <div className="space-y-2">
              <label className="text-sm font-medium">作用范围</label>
              <div className="space-y-2">
                <label className="flex items-start gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="batch-scope"
                    value="selection"
                    checked={batchScope === 'selection'}
                    onChange={() => setBatchScope('selection')}
                    disabled={selectedIds.size === 0 && selectionMode !== 'all'}
                    className="mt-0.5 h-4 w-4"
                  />
                  <span className="text-sm">
                    已勾选的 {selectedCount} 条渠道
                  </span>
                </label>
                <label className="flex items-start gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="batch-scope"
                    value="filter"
                    checked={batchScope === 'filter'}
                    onChange={() => setBatchScope('filter')}
                    className="mt-0.5 h-4 w-4"
                  />
                  <div className="flex-1">
                    <span className="text-sm">
                      当前筛选结果的全部{' '}
                      <span
                        className="font-bold"
                        style={{ color: '#F59E0B' }}
                      >
                        {totalCount}
                      </span>{' '}
                      条
                    </span>
                    <p
                      className="text-xs mt-0.5"
                      style={{ color: '#F59E0B' }}
                    >
                      将影响 {totalCount} 条，请确认范围
                    </p>
                  </div>
                </label>
              </div>
            </div>

            {/* 2. AI 信源平台 */}
            <div className="space-y-2">
              <label className="text-sm font-medium">AI 信源平台</label>
              <div className="flex flex-wrap gap-2">
                {SUBMISSION_AI_SOURCES.map((p) => {
                  const selected = batchPlatforms.includes(p);
                  return (
                    <button
                      key={p}
                      type="button"
                      onClick={() => {
                        setBatchPlatforms((prev) =>
                          prev.includes(p)
                            ? prev.filter((x) => x !== p)
                            : [...prev, p],
                        );
                      }}
                      className="rounded-md border px-3 py-1.5 text-xs font-medium transition-colors"
                      style={{
                        borderColor: selected ? PRIMARY : '#e2e8f0',
                        backgroundColor: selected
                          ? PRIMARY
                          : 'transparent',
                        color: selected ? '#ffffff' : '#475569',
                      }}
                    >
                      {SUBMISSION_AI_SOURCE_LABELS[p]}
                    </button>
                  );
                })}
              </div>
              <p className="text-xs" style={{ color: MUTED }}>
                只勾选这些渠道真实会被引用的平台，勾错会造成数据失真
              </p>
            </div>

            {/* 3. 模态 */}
            <div className="space-y-2">
              <label className="text-sm font-medium">模态</label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setBatchMediaType('')}
                  className="rounded-md border px-3 py-1.5 text-xs font-medium transition-colors"
                  style={{
                    borderColor: batchMediaType === '' ? PRIMARY : '#e2e8f0',
                    backgroundColor:
                      batchMediaType === '' ? PRIMARY : 'transparent',
                    color: batchMediaType === '' ? '#ffffff' : '#475569',
                  }}
                >
                  不修改
                </button>
                {SUBMISSION_MEDIA_TYPES.map((m) => {
                  const selected = batchMediaType === m;
                  return (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setBatchMediaType(m)}
                      className="rounded-md border px-3 py-1.5 text-xs font-medium transition-colors"
                      style={{
                        borderColor: selected ? PRIMARY : '#e2e8f0',
                        backgroundColor: selected ? PRIMARY : 'transparent',
                        color: selected ? '#ffffff' : '#475569',
                      }}
                    >
                      {SUBMISSION_MEDIA_TYPE_LABELS[m]}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 4. 可选填写 */}
            <div className="space-y-2">
              <label className="text-sm font-medium">可选填写（留空不修改）</label>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs" style={{ color: MUTED }}>
                    图文价（元/篇）
                  </label>
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    value={batchImagePrice}
                    onChange={(e) => setBatchImagePrice(e.target.value)}
                    placeholder="不修改"
                    className="h-9"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs" style={{ color: MUTED }}>
                    视频价（元/条）
                  </label>
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    value={batchVideoPrice}
                    onChange={(e) => setBatchVideoPrice(e.target.value)}
                    placeholder="不修改"
                    className="h-9"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs" style={{ color: MUTED }}>
                    配额上限
                  </label>
                  <Input
                    type="number"
                    min={0}
                    value={batchQuotaTotal}
                    onChange={(e) => setBatchQuotaTotal(e.target.value)}
                    placeholder="不修改"
                    className="h-9"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs" style={{ color: MUTED }}>
                    粉丝数
                  </label>
                  <Input
                    type="number"
                    min={0}
                    value={batchFollowers}
                    onChange={(e) => setBatchFollowers(e.target.value)}
                    placeholder="不修改"
                    className="h-9"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs" style={{ color: MUTED }}>
                    点赞数
                  </label>
                  <Input
                    type="number"
                    min={0}
                    value={batchLikes}
                    onChange={(e) => setBatchLikes(e.target.value)}
                    placeholder="不修改"
                    className="h-9"
                  />
                </div>
              </div>
            </div>

            {/* 5. 覆盖策略 */}
            <div className="space-y-2">
              <label className="text-sm font-medium">覆盖策略</label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="batch-mode"
                    value="append"
                    checked={batchMode === 'append'}
                    onChange={() => setBatchMode('append')}
                    className="h-4 w-4"
                  />
                  <span className="text-sm">追加标签（保留原有平台，合并）</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="batch-mode"
                    value="replace"
                    checked={batchMode === 'replace'}
                    onChange={() => setBatchMode('replace')}
                    className="h-4 w-4"
                  />
                  <span className="text-sm">替换标签（用本次选择覆盖）</span>
                </label>
              </div>
            </div>

            {/* 6. 二次确认 */}
            <div className="rounded-lg p-3" style={{ backgroundColor: '#FFF7ED' }}>
              <label className="flex items-start gap-2 cursor-pointer">
                <Checkbox
                  checked={batchConfirmed}
                  onCheckedChange={(v) => setBatchConfirmed(!!v)}
                  className="mt-0.5"
                />
                <span className="text-xs" style={{ color: '#92400E' }}>
                  我确认这 {batchTargetRow ? batchTargetRow.totalCount : selectedCount} 条渠道的 AI 平台归属属实
                </span>
              </label>
            </div>

            {/* 分批打标提示（仅批次清单场景且 >5000） */}
            {batchTargetRow && batchTargetRow.totalCount > 5000 && (
              <div className="rounded-lg border p-3" style={{ borderColor: '#F59E0B', backgroundColor: '#FFFBEB' }}>
                <div className="flex items-start gap-2">
                  <AlertCircle className="mt-0.5 h-4 w-4" style={{ color: '#F59E0B' }} />
                  <div className="flex-1">
                    <p className="text-xs font-medium" style={{ color: '#92400E' }}>
                      该组共 {batchTargetRow.totalCount} 条，超过单批 5000 条上限
                    </p>
                    <p className="mt-1 text-xs" style={{ color: '#B45309' }}>
                      将分为 {Math.ceil(batchTargetRow.totalCount / 5000)} 批执行，每批 5000 条
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setBatchDialogOpen(false)} disabled={batchBatching}>
              取消
            </Button>
            {batchTargetRow && batchTargetRow.totalCount > 5000 ? (
              <Button
                style={{ backgroundColor: PRIMARY }}
                disabled={!batchConfirmed || batchBatching}
                onClick={runBatchedTagging}
              >
                {batchBatching
                  ? '分批打标中...'
                  : `分 ${Math.ceil(batchTargetRow.totalCount / 5000)} 批打标`}
              </Button>
            ) : (
              <Button
                style={{ backgroundColor: PRIMARY }}
                disabled={!batchConfirmed || batchTagMutation.isPending || batchBatching}
                onClick={handleBatchSubmit}
              >
                {batchTagMutation.isPending
                  ? '提交中...'
                  : `应用到 ${batchTargetRow ? batchTargetRow.totalCount : selectedCount} 条渠道`}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 批量补录网址弹窗 */}
      <Dialog open={urlPatchDialogOpen} onOpenChange={handleUrlPatchDialogClose}>
        <DialogContent className="sm:max-w-[600px] w-[92vw]">
          {urlPatchResult ? (
            // 结果页
            <>
              <DialogHeader>
                <DialogTitle>补录结果</DialogTitle>
                <DialogDescription>
                  共解析 {urlPatchResult.totalRows} 行数据
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <div className="grid grid-cols-2 gap-3">
                  <div
                    className="rounded-lg border p-3"
                    style={{ borderColor: '#E6EAF2', backgroundColor: '#F7F9FC' }}
                  >
                    <div className="text-xs" style={{ color: '#94A3B8' }}>解析行数</div>
                    <div
                      className="mt-1 text-2xl font-semibold tnum"
                      style={{ color: '#0f172a' }}
                    >
                      {urlPatchResult.totalRows.toLocaleString()}
                    </div>
                  </div>
                  <div
                    className="rounded-lg border p-3"
                    style={{ borderColor: 'rgba(23, 201, 100, 0.2)', backgroundColor: 'rgba(23, 201, 100, 0.06)' }}
                  >
                    <div className="text-xs" style={{ color: '#94A3B8' }}>成功匹配并更新</div>
                    <div
                      className="mt-1 text-2xl font-semibold tnum"
                      style={{ color: SUCCESS }}
                    >
                      {urlPatchResult.successCount.toLocaleString()}
                    </div>
                  </div>
                  <div
                    className="rounded-lg border p-3"
                    style={{ borderColor: 'rgba(255, 92, 92, 0.2)', backgroundColor: 'rgba(255, 92, 92, 0.06)' }}
                  >
                    <div className="text-xs" style={{ color: '#94A3B8' }}>未匹配</div>
                    <div
                      className="mt-1 text-2xl font-semibold tnum"
                      style={{ color: DANGER }}
                    >
                      {urlPatchResult.unmatchedCount.toLocaleString()}
                    </div>
                  </div>
                  <div
                    className="rounded-lg border p-3"
                    style={{ borderColor: 'rgba(255, 169, 64, 0.2)', backgroundColor: 'rgba(255, 169, 64, 0.06)' }}
                  >
                    <div className="text-xs" style={{ color: '#94A3B8' }}>需人工确认</div>
                    <div
                      className="mt-1 text-2xl font-semibold tnum"
                      style={{ color: WARNING }}
                    >
                      {urlPatchResult.ambiguousCount.toLocaleString()}
                    </div>
                  </div>
                </div>
                {urlPatchResult.unmatchedItems && urlPatchResult.unmatchedItems.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium" style={{ color: '#0f172a' }}>
                        未匹配清单
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={exportUnmatchedCsv}
                        className="h-7"
                      >
                        <Download className="h-3.5 w-3.5" />
                        导出未匹配 CSV
                      </Button>
                    </div>
                    <div
                      className="max-h-60 overflow-y-auto rounded-lg border"
                      style={{ borderColor: '#E6EAF2' }}
                    >
                      {urlPatchResult.unmatchedItems.map((item, idx) => (
                        <div
                          key={idx}
                          className="flex items-start justify-between gap-2 border-b px-3 py-2 last:border-b-0"
                          style={{ borderColor: '#E6EAF2' }}
                        >
                          <div className="min-w-0 flex-1">
                            <div className="text-xs font-medium truncate" style={{ color: '#0f172a' }}>
                              {item.name}
                            </div>
                            <div
                              className="text-xs truncate"
                              style={{ color: MUTED }}
                              title={item.url}
                            >
                              {item.url}
                            </div>
                            <div className="text-xs mt-0.5" style={{ color: DANGER }}>
                              {item.reason}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <DialogFooter>
                <Button
                  onClick={() => {
                    setUrlPatchDialogOpen(false);
                    setUrlPatchResult(null);
                    setUrlPatchText('');
                    setUrlPatchFile(null);
                  }}
                  style={{ backgroundColor: PRIMARY }}
                >
                  完成
                </Button>
              </DialogFooter>
            </>
          ) : (
            // 表单页
            <>
              <DialogHeader>
                <DialogTitle>批量补录网址</DialogTitle>
                <DialogDescription>
                  通过粘贴文本或上传 CSV 文件，批量为信源补录入口网址
                </DialogDescription>
              </DialogHeader>
              <Tabs value={urlPatchTab} onValueChange={(v) => setUrlPatchTab(v as 'paste' | 'csv')} className="w-full">
                <TabsList className="w-full">
                  <TabsTrigger value="paste" className="flex-1">粘贴文本</TabsTrigger>
                  <TabsTrigger value="csv" className="flex-1">上传 CSV</TabsTrigger>
                </TabsList>
                <TabsContent value="paste" className="mt-4 space-y-3">
                  <Textarea
                    value={urlPatchText}
                    onChange={(e) => setUrlPatchText(e.target.value)}
                    placeholder={"黄页88,https://www.huangye88.com/\n商业新知,www.shangyexinzhi.com\n搜了网,https://www.soule.com"}
                    className="w-full resize-none font-mono text-xs"
                    style={{ height: '200px' }}
                  />
                  <p className="text-xs" style={{ color: MUTED }}>
                    每行「信源名称,网址」，支持逗号 / 制表符 / 竖线分隔；单次上限 5000 行
                  </p>
                </TabsContent>
                <TabsContent value="csv" className="mt-4 space-y-3">
                  <div
                    className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 text-center transition-colors hover:border-primary/40"
                    style={{ borderColor: '#E6EAF2', backgroundColor: '#F7F9FC' }}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault();
                      const file = e.dataTransfer.files?.[0];
                      if (file && file.name.toLowerCase().endsWith('.csv')) {
                        setUrlPatchFile(file);
                      }
                    }}
                  >
                    <Upload className="mb-2 h-8 w-8" style={{ color: MUTED }} />
                    <p className="text-sm font-medium" style={{ color: '#0f172a' }}>
                      拖拽 CSV 文件到此处
                    </p>
                    <p className="mt-1 text-xs" style={{ color: MUTED }}>
                      或
                    </p>
                    <label className="mt-2 cursor-pointer">
                      <input
                        type="file"
                        accept=".csv"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) setUrlPatchFile(file);
                        }}
                      />
                      <span
                        className="inline-flex items-center rounded-md border px-3 py-1.5 text-xs font-medium transition-colors"
                        style={{ borderColor: '#E6EAF2', color: '#0f172a', backgroundColor: '#ffffff' }}
                      >
                        选择文件
                      </span>
                    </label>
                  </div>
                  {urlPatchFile && (
                    <div
                      className="flex items-center justify-between rounded-lg border px-3 py-2"
                      style={{ borderColor: '#E6EAF2', backgroundColor: '#F7F9FC' }}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <FileText className="h-4 w-4 shrink-0" style={{ color: PRIMARY }} />
                        <span className="text-xs truncate" style={{ color: '#0f172a' }}>
                          {urlPatchFile.name}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setUrlPatchFile(null)}
                        className="text-xs transition-colors hover:underline"
                        style={{ color: MUTED }}
                      >
                        移除
                      </button>
                    </div>
                  )}
                  <p className="text-xs" style={{ color: MUTED }}>
                    CSV 列格式为「名称,网址」，第一行表头；单次上限 5000 行
                  </p>
                </TabsContent>
              </Tabs>
              <DialogFooter>
                <Button variant="outline" onClick={() => handleUrlPatchDialogClose(false)}>
                  取消
                </Button>
                <Button
                  onClick={handleUrlPatchSubmit}
                  disabled={batchUrlPatchMutation.isPending}
                  style={{ backgroundColor: PRIMARY }}
                >
                  {batchUrlPatchMutation.isPending ? '补录中...' : '解析并补录'}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* 打标记录抽屉 */}
      <Sheet open={logDrawerOpen} onOpenChange={setLogDrawerOpen}>
        <SheetContent side="right" className="sm:max-w-md w-[90vw]">
          <SheetHeader>
            <SheetTitle>操作记录</SheetTitle>
            <SheetDescription>
              最近 200 条批量操作记录
            </SheetDescription>
          </SheetHeader>

          <Tabs value={logDrawerTab} onValueChange={(v) => setLogDrawerTab(v as 'tag' | 'url')} className="w-full mt-4">
            <TabsList className="w-full">
              <TabsTrigger value="tag" className="flex-1">打标记录</TabsTrigger>
              <TabsTrigger value="url" className="flex-1">补录网址记录</TabsTrigger>
            </TabsList>

            <TabsContent value="tag" className="mt-4 -mx-6 px-6">
              <div className="flex-1 overflow-y-auto">
                {tagLogsQuery.isLoading && (
                  <div className="space-y-3 py-4">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <div key={i} className="space-y-2">
                        <Skeleton className="h-4 w-32" />
                        <Skeleton className="h-4 w-full" />
                        <Skeleton className="h-4 w-2/3" />
                      </div>
                    ))}
                  </div>
                )}
                {tagLogsQuery.isError && (
                  <div className="py-8 text-center text-sm" style={{ color: DANGER }}>
                    加载失败，请刷新重试
                  </div>
                )}
                {!tagLogsQuery.isLoading &&
                  !tagLogsQuery.isError &&
                  (tagLogsQuery.data?.items?.length ?? 0) === 0 && (
                    <div className="py-8 text-center text-sm text-muted-foreground">
                      暂无打标记录
                    </div>
                  )}
                {tagLogsQuery.data?.items?.map((log: SourceTagLog) => (
                  <div
                    key={log.id}
                    className="py-3 border-b last:border-b-0"
                    style={{ borderColor: '#E6EAF2' }}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs" style={{ color: MUTED }}>
                        {formatTagLogTime(log.createdAt)}
                      </span>
                      <span
                        className="text-xs font-medium"
                        style={{ color: PRIMARY }}
                      >
                        {BATCH_TAG_MODE_LABELS[log.mode]}
                      </span>
                    </div>
                    <div className="text-xs mb-1.5">
                      <span style={{ color: '#0f172a' }}>{log.operatorName || '未知用户'}</span>
                      <span style={{ color: MUTED }}> · </span>
                      <span style={{ color: MUTED }}>
                        {log.scope === 'filter' ? `全部筛选结果（${log.targetCount} 条）` : `已选 ${log.targetCount} 条`}
                      </span>
                    </div>
                    {log.platforms && log.platforms.length > 0 && (
                      <div className="flex flex-wrap gap-1 mb-1.5">
                        {log.platforms.map((p) => (
                          <span
                            key={p}
                            className="inline-flex items-center rounded px-1.5 py-0.5 text-[11px]"
                            style={{
                              backgroundColor: 'rgba(46, 125, 255, 0.08)',
                              color: PRIMARY,
                            }}
                          >
                            {SUBMISSION_AI_SOURCE_LABELS[p as SubmissionAiSource] || p}
                          </span>
                        ))}
                      </div>
                    )}
                    <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs" style={{ color: MUTED }}>
                      {log.mediaType && (
                        <span>模态：{SUBMISSION_MEDIA_TYPE_LABELS[log.mediaType as SubmissionMediaType] || log.mediaType}</span>
                      )}
                      {log.imagePrice !== null && log.imagePrice !== undefined && (
                        <span>图文价：¥{log.imagePrice}</span>
                      )}
                      {log.videoPrice !== null && log.videoPrice !== undefined && (
                        <span>视频价：¥{log.videoPrice}</span>
                      )}
                      {log.quotaTotal !== null && log.quotaTotal !== undefined && (
                        <span>配额：{log.quotaTotal}</span>
                      )}
                      {log.followers !== null && log.followers !== undefined && (
                        <span>粉丝：{log.followers}</span>
                      )}
                      {log.likes !== null && log.likes !== undefined && (
                        <span>点赞：{log.likes}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="url" className="mt-4 -mx-6 px-6">
              <div className="flex-1 overflow-y-auto">
                {urlLogsQuery.isLoading && (
                  <div className="space-y-3 py-4">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <div key={i} className="space-y-2">
                        <Skeleton className="h-4 w-32" />
                        <Skeleton className="h-4 w-full" />
                        <Skeleton className="h-4 w-2/3" />
                      </div>
                    ))}
                  </div>
                )}
                {urlLogsQuery.isError && (
                  <div className="py-8 text-center text-sm" style={{ color: DANGER }}>
                    加载失败，请刷新重试
                  </div>
                )}
                {!urlLogsQuery.isLoading &&
                  !urlLogsQuery.isError &&
                  (urlLogsQuery.data?.items?.length ?? 0) === 0 && (
                    <div className="py-8 text-center text-sm text-muted-foreground">
                      暂无补录网址记录
                    </div>
                  )}
                {urlLogsQuery.data?.items?.map((log: SourceUrlLog) => (
                  <div
                    key={log.id}
                    className="py-3 border-b last:border-b-0"
                    style={{ borderColor: '#E6EAF2' }}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs" style={{ color: MUTED }}>
                        {formatUrlLogTime(log.createdAt)}
                      </span>
                      <span
                        className="text-xs font-medium"
                        style={{ color: PRIMARY }}
                      >
                        批量补录
                      </span>
                    </div>
                    <div className="text-xs mb-1.5">
                      <span style={{ color: '#0f172a' }}>{log.operatorName || '未知用户'}</span>
                      <span style={{ color: MUTED }}> · 解析 </span>
                      <span className="tnum" style={{ color: '#0f172a' }}>{log.totalRows}</span>
                      <span style={{ color: MUTED }}> 行</span>
                    </div>
                    <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs" style={{ color: MUTED }}>
                      <span style={{ color: SUCCESS }}>成功 {log.successCount}</span>
                      <span style={{ color: DANGER }}>未匹配 {log.unmatchedCount}</span>
                      <span style={{ color: WARNING }}>需确认 {log.ambiguousCount}</span>
                    </div>
                  </div>
                ))}
              </div>
            </TabsContent>
          </Tabs>
        </SheetContent>
      </Sheet>

      {/* 批次清单抽屉 */}
      <Sheet open={batchSheetOpen} onOpenChange={setBatchSheetOpen}>
        <SheetContent side="right" className="fixed inset-y-0 right-0 z-50 h-full w-[62vw] min-w-[720px] max-w-[980px] p-0 border-l border-slate-200 shadow-xl bg-white flex flex-col">
          <SheetHeader className="border-b px-6 py-4" style={{ borderColor: '#E6EAF2' }}>
            <SheetTitle className="text-base font-semibold" style={{ color: '#0f172a' }}>
              批次清单
            </SheetTitle>
            <SheetDescription>
              按地区和行业分组展示渠道打标覆盖情况
            </SheetDescription>
          </SheetHeader>

          {/* 筛选区 */}
          <div className="flex flex-wrap items-center gap-3 border-b px-6 py-3" style={{ borderColor: '#E6EAF2' }}>
            <div className="flex items-center gap-2">
              <span className="text-xs" style={{ color: MUTED }}>库类型</span>
              <Select value={batchSheetLibraryType} onValueChange={(v) => setBatchSheetLibraryType(v as SubmissionLibraryType)}>
                <SelectTrigger className="h-8 w-[140px] text-xs">
                  <SelectValue placeholder="选择库类型" />
                </SelectTrigger>
                <SelectContent>
                  {SUBMISSION_LIBRARY_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {SUBMISSION_LIBRARY_TYPE_LABELS[t]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs" style={{ color: MUTED }}>地区</span>
              <Select value={batchSheetRegion} onValueChange={setBatchSheetRegion}>
                <SelectTrigger className="h-8 w-[120px] text-xs">
                  <SelectValue placeholder="全部" />
                </SelectTrigger>
                <SelectContent className="max-h-[300px]">
                  <SelectItem value="">全部</SelectItem>
                  {SUBMISSION_REGIONS.map((r) => (
                    <SelectItem key={r} value={r}>{r}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs" style={{ color: MUTED }}>行业</span>
              <Select value={batchSheetIndustry} onValueChange={setBatchSheetIndustry}>
                <SelectTrigger className="h-8 w-[120px] text-xs">
                  <SelectValue placeholder="全部" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">全部</SelectItem>
                  {SUBMISSION_INDUSTRIES.map((ind) => (
                    <SelectItem key={ind} value={ind}>
                      {SUBMISSION_INDUSTRY_LABELS[ind]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs" style={{ color: MUTED }}>打标状态</span>
              <Select value={batchSheetTagStatus} onValueChange={setBatchSheetTagStatus}>
                <SelectTrigger className="h-8 w-[120px] text-xs">
                  <SelectValue placeholder="全部" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部</SelectItem>
                  <SelectItem value="untagged">未打标</SelectItem>
                  <SelectItem value="tagged">已打标</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* 表格区 */}
          <div className="flex-1 overflow-y-auto px-6 py-4">
            {batchSheetQuery.isLoading ? (
              <div className="space-y-2 p-4">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-4">
                    <Skeleton className="h-4 w-16" />
                    <Skeleton className="h-4 w-16" />
                    <Skeleton className="h-4 w-12" />
                    <Skeleton className="h-4 w-12" />
                    <Skeleton className="h-4 w-12" />
                    <Skeleton className="h-6 w-20" />
                  </div>
                ))}
              </div>
            ) : batchSheetQuery.isError ? (
              <div className="py-12 text-center">
                <p className="text-sm" style={{ color: DANGER }}>加载失败</p>
                <button
                  onClick={() => batchSheetQuery.refetch()}
                  className="mt-2 text-xs hover:underline"
                  style={{ color: PRIMARY }}
                >
                  点击重试
                </button>
              </div>
            ) : (batchSheetQuery.data?.items?.length ?? 0) === 0 ? (
              <div className="py-12 text-center text-sm text-muted-foreground">
                暂无数据
              </div>
            ) : (
              <table className="w-full min-w-[640px] text-sm">
                <thead>
                  <tr style={{ backgroundColor: '#F7F9FC', position: 'sticky', top: 0, zIndex: 1 }}>
                    <th className="px-4 py-2.5 text-left text-xs font-medium h-11" style={{ color: MUTED }}>地区</th>
                    <th className="px-4 py-2.5 text-left text-xs font-medium h-11" style={{ color: MUTED }}>行业</th>
                    <th className="px-4 py-2.5 text-right text-xs font-medium tnum h-11" style={{ color: MUTED }}>渠道总数</th>
                    <th className="px-4 py-2.5 text-right text-xs font-medium tnum h-11" style={{ color: MUTED }}>已打标</th>
                    <th className="px-4 py-2.5 text-right text-xs font-medium tnum h-11" style={{ color: MUTED }}>未打标</th>
                    <th className="px-4 py-2.5 text-right text-xs font-medium h-11 w-[150px]" style={{ color: MUTED }}>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {batchSheetQuery.data?.items?.map((item: BatchSheetItem, idx: number) => (
                    <tr key={`${item.region}-${item.industry}-${idx}`} className="border-t" style={{ borderColor: '#E6EAF2' }}>
                      <td className="px-4 py-2.5 text-sm h-11" style={{ whiteSpace: 'nowrap', minWidth: 88 }}>{item.region || '—'}</td>
                      <td className="px-4 py-2.5 text-sm h-11" style={{ whiteSpace: 'nowrap', minWidth: 88 }}>
                        {SUBMISSION_INDUSTRY_LABELS[item.industry] || item.industry}
                      </td>
                      <td className="px-4 py-2.5 text-right text-sm tnum h-11">{item.totalCount}</td>
                      <td className="px-4 py-2.5 text-right text-sm tnum h-11" style={{ color: SUCCESS }}>
                        {item.taggedCount}
                      </td>
                      <td className="px-4 py-2.5 text-right text-sm tnum h-11" style={{ color: DANGER }}>
                        {item.untaggedCount}
                      </td>
                      <td className="px-4 py-2.5 text-right h-11 w-[150px]">
                        <div className="inline-flex items-center justify-end gap-2 whitespace-nowrap">
                          <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => handleViewChannels(item)}>
                            查看渠道
                          </Button>
                          <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => openBatchDialogForRow(item)}>
                            批量打标
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* 底部汇总区 */}
          <div className="border-t px-6 py-4" style={{ borderColor: '#E6EAF2', backgroundColor: '#FAFBFC' }}>
            <div className="grid grid-cols-4 gap-4">
              <div
                className="relative rounded-xl border p-4 bg-white"
                style={{ borderColor: '#E6EAF2' }}
              >
                <div className="text-xs" style={{ color: '#94A3B8' }}>总计</div>
                <div className="text-2xl font-semibold tnum mt-1" style={{ color: '#0f172a' }}>
                  {(batchSheetQuery.data?.total ?? 0).toLocaleString()}
                </div>
              </div>
              {/* 已打标 */}
              <div
                className="relative rounded-xl border p-4 bg-white"
                style={{ borderColor: '#E6EAF2' }}
              >
                <div className="text-xs" style={{ color: '#94A3B8' }}>已打标</div>
                <div className="text-2xl font-semibold tnum mt-1" style={{ color: '#16A34A' }}>
                  {(batchSheetQuery.data?.taggedTotal ?? 0).toLocaleString()}
                </div>
              </div>
              {/* 未打标 */}
              <div
                className="relative rounded-xl border p-4 bg-white"
                style={{ borderColor: '#E6EAF2' }}
              >
                <div className="text-xs" style={{ color: '#94A3B8' }}>未打标</div>
                <div className="text-2xl font-semibold tnum mt-1" style={{ color: '#DC2626' }}>
                  {(batchSheetQuery.data?.untaggedTotal ?? 0).toLocaleString()}
                </div>
              </div>
              {/* 覆盖率 */}
              <div
                className="relative rounded-xl border p-4 bg-white"
                style={{ borderColor: '#E6EAF2' }}
              >
                <div className="text-xs" style={{ color: '#94A3B8' }}>覆盖率</div>
                <div className="text-2xl font-semibold tnum mt-1" style={{ color: '#2563EB' }}>
                  {batchSheetQuery.data ? (batchSheetQuery.data.coverageRate * 100).toFixed(1) : '0.0'}%
                </div>
              </div>
            </div>
            <div className="mt-4 flex justify-end">
              <Button
                size="sm"
                variant="outline"
                onClick={() => exportBatchSheet({
                  libraryType: batchSheetLibraryType,
                  region: batchSheetRegion || undefined,
                  industry: (batchSheetIndustry || undefined) as SubmissionIndustry | undefined,
                  tagStatus: (batchSheetTagStatus as 'all' | 'tagged' | 'untagged') || undefined,
                })}
                disabled={batchSheetQuery.isLoading}
                className="h-8"
              >
                <Download className="h-3.5 w-3.5" />
                导出清单 CSV
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
};

const CardGridSkeleton = () => (
  <div className="p-4">
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className="space-y-3 rounded-xl p-4"
          style={{ border: '1px solid #E6EAF2' }}
        >
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-3/4" />
              <div className="flex items-center gap-1.5">
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-3 w-10" />
              </div>
            </div>
            <Skeleton className="h-5 w-12" />
          </div>
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-4/5" />
          <div className="flex gap-1">
            <Skeleton className="h-4 w-10" />
            <Skeleton className="h-4 w-10" />
            <Skeleton className="h-4 w-10" />
          </div>
          <div className="space-y-1">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-1.5 w-full rounded-full" />
          </div>
          <Skeleton className="h-4 w-20" />
          <div className="flex gap-2 pt-2">
            <Skeleton className="h-8 flex-1" />
            <Skeleton className="h-8 flex-1" />
          </div>
        </div>
      ))}
    </div>
  </div>
);

const TableSkeleton = () => (
  <div className="space-y-2 rounded-md border p-4">
    {Array.from({ length: 6 }).map((_, i) => (
      <div key={i} className="flex items-center gap-4">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-4 w-16" />
        <Skeleton className="h-4 w-12" />
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-4 w-16" />
        <Skeleton className="h-4 w-14" />
        <Skeleton className="h-4 w-16" />
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-4 w-16" />
        <Skeleton className="h-4 w-20" />
      </div>
    ))}
  </div>
);

export default SubmissionChannelsPage;
