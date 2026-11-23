import React, { useEffect, useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Search,
  Calendar,
  RefreshCw,
  AlertCircle,
  FileText,
  ExternalLink,
  Plus,
  Download,
  CheckCircle2,
  XCircle,
  RotateCcw,
  Trash2,
  ChevronRight,
  Upload,
} from 'lucide-react';
import { Button } from '@client/src/components/ui/button';
import { TableShell } from '@client/src/components/ui/table-shell';
import { Input } from '@client/src/components/ui/input';
import { Textarea } from '@client/src/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@client/src/components/ui/select';
import { Checkbox } from '@client/src/components/ui/checkbox';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@client/src/components/ui/table';
import { Skeleton } from '@client/src/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@client/src/components/ui/dialog';
import { Badge } from '@client/src/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@client/src/components/ui/tooltip';
import {
  list,
  enqueue,
  updateStatus,
  remove,
  listAllChannels,
} from '@client/src/api/submission-queue';
import { getBrands } from '@client/src/api/brands';
import { listArticles } from '@client/src/api/creation';
import { useAuth } from '@client/src/hooks/useAuth';
import {
  SUBMISSION_QUEUE_STATUSES,
  SUBMISSION_QUEUE_STATUS_LABELS,
  SUBMISSION_CHANNEL_TYPE_LABELS,
  SUBMISSION_REJECT_CATEGORIES,
  SUBMISSION_REJECT_CATEGORY_LABELS,
} from '@shared/api.interface';
import type {
  SubmissionQueueItem,
  SubmissionQueueStatus,
  SubmissionChannel,
  SubmissionRejectCategory,
  Article,
} from '@shared/api.interface';
import { showConfirm } from '@lark-apaas/client-toolkit';
import { UniversalLink } from '@lark-apaas/client-toolkit/components/UniversalLink';

const PRIMARY = '#1e40af';
const DANGER = '#ef4444';
const SUCCESS = '#10b981';
const WARNING = '#f97316';
const MUTED = '#64748b';
const INFO = '#3b82f6';

const PAGE_SIZE = 10;

const STATUS_COLORS: Record<
  SubmissionQueueStatus,
  { bg: string; color: string; dot: string }
> = {
  pending: { bg: 'rgba(100, 116, 139, 0.1)', color: MUTED, dot: MUTED },
  submitted: { bg: 'rgba(59, 130, 246, 0.1)', color: INFO, dot: INFO },
  indexed: { bg: 'rgba(16, 185, 129, 0.1)', color: SUCCESS, dot: SUCCESS },
  rejected: { bg: 'rgba(239, 68, 68, 0.1)', color: DANGER, dot: DANGER },
  failed: { bg: 'rgba(249, 115, 22, 0.1)', color: WARNING, dot: WARNING },
  cancelled: {
    bg: 'rgba(100, 116, 139, 0.1)',
    color: MUTED,
    dot: MUTED,
  },
};

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: '全部状态' },
  ...SUBMISSION_QUEUE_STATUSES.map((s) => ({
    value: s,
    label: SUBMISSION_QUEUE_STATUS_LABELS[s],
  })),
];

const SubmissionQueuePage: React.FC = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const isClient = user?.role === 'client';

  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [channelFilter, setChannelFilter] = useState<string>('');
  const [brandFilter, setBrandFilter] = useState<string>('');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [keyword, setKeyword] = useState<string>('');
  const [searchInput, setSearchInput] = useState<string>('');

  const {
    data: queueData,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: [
      'submissionQueue',
      page,
      statusFilter,
      channelFilter,
      brandFilter,
      startDate,
      endDate,
      keyword,
    ],
    queryFn: () =>
      list({
        page,
        pageSize: PAGE_SIZE,
        status: (statusFilter || undefined) as
          | SubmissionQueueStatus
          | undefined,
        channelId: channelFilter || undefined,
        brandId: isClient
          ? user?.brandId || undefined
          : brandFilter || undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        keyword: keyword || undefined,
      }),
    retry: 2,
    retryDelay: 2000,
  });

  const { data: brandOptions = [] } = useQuery({
    queryKey: ['brands', 'options'],
    queryFn: () => getBrands(),
    retry: 2,
    retryDelay: 2000,
    enabled: !isClient,
  });

  useEffect(() => {
    if (!isClient && brandOptions.length > 0 && !brandFilter) {
      setBrandFilter(brandOptions[0].id);
    }
  }, [brandOptions, isClient, brandFilter]);

  const { data: channelOptions = [] } = useQuery<SubmissionChannel[]>({
    queryKey: [
      'submissionChannels',
      isClient ? user?.brandId : brandFilter,
    ],
    queryFn: () =>
      listAllChannels(isClient ? user?.brandId : brandFilter || undefined),
    retry: 2,
    retryDelay: 2000,
  });

  const totalPages = useMemo(() => {
    if (!queueData) return 1;
    return Math.max(1, Math.ceil(queueData.total / PAGE_SIZE));
  }, [queueData]);

  const handleSearch = () => {
    setKeyword(searchInput.trim());
    setPage(1);
  };

  const handleStatusChange = (value: string) => {
    setStatusFilter(value);
    setPage(1);
  };

  const handleChannelChange = (value: string) => {
    setChannelFilter(value);
    setPage(1);
  };

  const handleBrandChange = (value: string) => {
    setBrandFilter(value);
    setPage(1);
  };

  /* ---------- 删除 ---------- */
  const deleteMutation = useMutation({
    mutationFn: remove,
    retry: false,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['submissionQueue'] });
      toast.success('删除成功');
    },
    onError: (err: Error) => {
      toast.error(err.message || '删除失败');
    },
  });

  const handleDelete = async (item: SubmissionQueueItem) => {
    if (await showConfirm(`确认删除投稿任务「${item.title}」？`)) {
      deleteMutation.mutate(item.id);
    }
  };

  /* ---------- 重试（恢复为 pending） ---------- */
  const retryMutation = useMutation({
    mutationFn: (id: string) =>
      updateStatus(id, { status: 'pending' as SubmissionQueueStatus }),
    retry: false,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['submissionQueue'] });
      toast.success('已重新加入待投稿队列');
    },
    onError: (err: Error) => {
      toast.error(err.message || '操作失败');
    },
  });

  const handleRetry = (item: SubmissionQueueItem) => {
    retryMutation.mutate(item.id);
  };

  /* ---------- 去投稿 ---------- */
  const handleSubmitLocal = (item: SubmissionQueueItem) => {
    toast.info('请使用本地投稿器进行投稿操作');
  };

  const markSubmittedMutation = useMutation({
    mutationFn: (id: string) =>
      updateStatus(id, { status: 'submitted' as SubmissionQueueStatus }),
    retry: false,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['submissionQueue'] });
      toast.success('已标记为已提交待审核');
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.error?.message || '操作失败');
    },
  });

  /* ---------- 标记已收录弹窗 ---------- */
  const [indexedItem, setIndexedItem] = useState<SubmissionQueueItem | null>(
    null,
  );
  const [indexedForm, setIndexedForm] = useState({
    url: '',
    indexedAt: '',
  });
  const indexedMutation = useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string;
      data: { url: string; indexedAt: string };
    }) =>
      updateStatus(id, {
        status: 'indexed',
        url: data.url,
        indexedAt: new Date(data.indexedAt).toISOString(),
      }),
    retry: false,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['submissionQueue'] });
      setIndexedItem(null);
      toast.success('已标记为已收录');
    },
    onError: (err: Error) => {
      toast.error(err.message || '操作失败');
    },
  });

  const openMarkIndexed = (item: SubmissionQueueItem) => {
    setIndexedItem(item);
    setIndexedForm({
      url: item.indexedUrl || '',
      indexedAt: new Date().toISOString().slice(0, 10),
    });
  };

  /* ---------- 标记被拒弹窗 ---------- */
  const [rejectedItem, setRejectedItem] = useState<SubmissionQueueItem | null>(
    null,
  );
  const [rejectForm, setRejectForm] = useState<{
    category: SubmissionRejectCategory;
    reason: string;
  }>({
    category: 'content_violation',
    reason: '',
  });
  const rejectMutation = useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string;
      data: { category: SubmissionRejectCategory; reason: string };
    }) =>
      updateStatus(id, {
        status: 'rejected',
        rejectCategory: data.category,
        rejectReason: data.reason,
      }),
    retry: false,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['submissionQueue'] });
      setRejectedItem(null);
      toast.success('已标记为被拒');
    },
    onError: (err: Error) => {
      toast.error(err.message || '操作失败');
    },
  });

  const openMarkRejected = (item: SubmissionQueueItem) => {
    setRejectedItem(item);
    setRejectForm({
      category:
        (item.rejectCategory as SubmissionRejectCategory) ||
        'content_violation',
      reason: item.rejectReason || '',
    });
  };

  /* ---------- 查看稿件弹窗 ---------- */
  const [viewingItem, setViewingItem] = useState<SubmissionQueueItem | null>(
    null,
  );

  /* ---------- 选稿弹窗 ---------- */
  const [selectDialogOpen, setSelectDialogOpen] = useState(false);
  const [selectStep, setSelectStep] = useState<'articles' | 'channels'>(
    'articles',
  );
  const [selectedArticleIds, setSelectedArticleIds] = useState<Set<string>>(
    new Set(),
  );
  const [selectedChannelIds, setSelectedChannelIds] = useState<Set<string>>(
    new Set(),
  );
  const [articlePage, setArticlePage] = useState(1);
  const [articleKeyword, setArticleKeyword] = useState('');

  const { data: articlesData, isLoading: articlesLoading } = useQuery({
    queryKey: [
      'articlesForSubmission',
      articlePage,
      articleKeyword,
      isClient ? user?.brandId : brandFilter,
    ],
    queryFn: () =>
      listArticles({
        page: articlePage,
        pageSize: 10,
        brandId: isClient
          ? user?.brandId || undefined
          : brandFilter || undefined,
        keyword: articleKeyword || undefined,
      }),
    retry: 2,
    retryDelay: 2000,
    enabled: selectDialogOpen && selectStep === 'articles',
  });

  const enqueueBatchMutation = useMutation({
    mutationFn: async ({
      articleIds,
      channelIds,
      brandId,
    }: {
      articleIds: string[];
      channelIds: string[];
      brandId?: string;
    }) => {
      const results = [];
      for (const articleId of articleIds) {
        for (const channelId of channelIds) {
          results.push(
            enqueue({
              articleId,
              channelId,
              ...(brandId ? { brandId } : {}),
            }),
          );
        }
      }
      return Promise.all(results);
    },
    retry: false,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['submissionQueue'] });
      setSelectDialogOpen(false);
      setSelectStep('articles');
      setSelectedArticleIds(new Set());
      setSelectedChannelIds(new Set());
      toast.success('已创建投稿任务');
    },
    onError: (err: Error) => {
      toast.error(err.message || '创建失败');
    },
  });

  const handleConfirmEnqueue = () => {
    if (selectedArticleIds.size === 0 || selectedChannelIds.size === 0) return;
    enqueueBatchMutation.mutate({
      articleIds: Array.from(selectedArticleIds),
      channelIds: Array.from(selectedChannelIds),
      brandId: isClient ? user?.brandId || undefined : brandFilter || undefined,
    });
  };

  const toggleArticleSelect = (id: string) => {
    const next = new Set(selectedArticleIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedArticleIds(next);
  };

  const toggleChannelSelect = (id: string) => {
    const next = new Set(selectedChannelIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedChannelIds(next);
  };

  const openSelectDialog = () => {
    setSelectStep('articles');
    setSelectedArticleIds(new Set());
    setSelectedChannelIds(new Set());
    setArticlePage(1);
    setArticleKeyword('');
    setSelectDialogOpen(true);
  };

  /* ---------- 工具函数 ---------- */
  const formatDateTime = (dateStr: string | null) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleString('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
  };

  const getChannelTypeLabel = (type?: string) => {
    if (!type) return '';
    return (
      SUBMISSION_CHANNEL_TYPE_LABELS[
        type as keyof typeof SUBMISSION_CHANNEL_TYPE_LABELS
      ] || type
    );
  };

  const getBrandName = (brandId: string) => {
    return brandOptions.find((b) => b.id === brandId)?.name || '-';
  };

  /* ---------- 渲染 ---------- */
  return (
    <TooltipProvider>
      <div className="space-y-6" style={{ backgroundColor: '#f8fafc' }}>
        {/* 标题区 */}
        <div>
          <h1
            className="text-[20px] font-semibold leading-none"
            style={{ color: '#101828' }}
          >
            投稿队列
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            管理向第三方站点投稿的稿件状态
          </p>
        </div>

        {/* 列表 */}
      <TableShell
        title="投稿任务列表"
        description="管理文章投稿任务，跟踪各渠道审核与收录状态"
        headerActions={
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => toast.info('功能开发中')}
              className="h-9"
            >
              <Download className="h-3.5 w-3.5" />
              导出稿件
            </Button>
            <Button
              size="sm"
              onClick={openSelectDialog}
              className="h-9"
              style={{ backgroundColor: PRIMARY }}
            >
              <Plus className="h-3.5 w-3.5" />
              从创作历史选稿
            </Button>
          </div>
        }
        filterBar={
          <>
            <div className="w-40">
              <Select
                value={statusFilter}
                onValueChange={handleStatusChange}
              >
                <SelectTrigger className="w-full h-9">
                  <SelectValue placeholder="全部状态" />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="w-40">
              <Select
                value={channelFilter}
                onValueChange={handleChannelChange}
              >
                <SelectTrigger className="w-full h-9">
                  <SelectValue placeholder="全部渠道" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">全部渠道</SelectItem>
                  {channelOptions.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {!isClient && (
              <div className="w-40">
                <Select
                  value={brandFilter}
                  onValueChange={handleBrandChange}
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
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <Input
                type="date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  setPage(1);
                }}
                className="w-36 h-9 text-xs"
                placeholder="开始日期"
              />
              <span className="text-muted-foreground text-xs">至</span>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => {
                  setEndDate(e.target.value);
                  setPage(1);
                }}
                className="w-36 h-9 text-xs"
                placeholder="结束日期"
              />
            </div>
            <div className="relative w-[260px] ml-auto">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSearch();
                }}
                placeholder="搜索标题关键词"
                className="h-9 pl-8 text-xs"
              />
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => refetch()}
              className="h-9"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              刷新
            </Button>
          </>
        }
        data={queueData?.items ?? []}
        isLoading={isLoading}
        isEmpty={!isLoading && (!queueData || queueData.items.length === 0)}
        emptyTitle="暂无投稿任务"
        emptyDescription="从创作历史选稿加入投稿队列，自动跟踪各平台审核状态"
        emptyAction={{ label: '从创作历史选稿', onClick: openSelectDialog }}
        total={queueData?.total ?? 0}
        page={page}
        pageSize={PAGE_SIZE}
        onPageChange={setPage}
      >
        {isError ? (
          <div className="flex items-center justify-between rounded-lg border border-amber-200 bg-amber-50 p-4 mb-3">
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
        ) : null}
        {isLoading ? (
          <TableSkeleton />
        ) : (
          <Table style={{ minWidth: '1100px' }}>
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-[240px]">标题</TableHead>
                <TableHead className="min-w-[140px]">目标渠道</TableHead>
                {!isClient && (
                  <TableHead className="min-w-[120px]">品牌</TableHead>
                )}
                <TableHead className="min-w-[100px] text-right tnum">字数</TableHead>
                <TableHead className="min-w-[100px]">状态</TableHead>
                <TableHead className="min-w-[140px]">提交时间</TableHead>
                <TableHead className="min-w-[140px]">审核结果</TableHead>
                <TableHead className="min-w-[100px]">收录链接</TableHead>
                <TableHead className="w-[132px] text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {queueData?.items.map(
                (item: SubmissionQueueItem) => (
                  <TableRow key={item.id} className="h-12">
                    <TableCell className="min-w-[240px]">
                      <button
                        className="text-left font-medium line-clamp-2 block hover:underline w-full"
                        style={{ color: PRIMARY }}
                        onClick={() => setViewingItem(item)}
                        title={item.title}
                      >
                        {item.title}
                      </button>
                    </TableCell>
                    <TableCell className="min-w-[140px]">
                      <div className="flex flex-col gap-0.5">
                        <span className="text-sm">
                          {item.channelName}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {getChannelTypeLabel(item.channelType)}
                        </span>
                      </div>
                    </TableCell>
                    {!isClient && (
                      <TableCell className="min-w-[120px] text-sm text-muted-foreground">
                        {getBrandName(item.brandId)}
                      </TableCell>
                    )}
                    <TableCell className="min-w-[100px] text-sm text-right tnum">
                      {item.wordCount}
                    </TableCell>
                    <TableCell className="min-w-[100px]">
                      <span
                        className="inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-medium"
                        style={{
                          backgroundColor:
                            STATUS_COLORS[item.status].bg,
                          color: STATUS_COLORS[item.status].color,
                        }}
                      >
                        <span
                          className="size-1.5 rounded-full"
                          style={{
                            backgroundColor:
                              STATUS_COLORS[item.status].dot,
                          }}
                        />
                        {
                          SUBMISSION_QUEUE_STATUS_LABELS[
                            item.status
                              ]
                        }
                      </span>
                    </TableCell>
                    <TableCell className="min-w-[140px] text-muted-foreground text-sm">
                      {formatDateTime(item.createdAt)}
                    </TableCell>
                    <TableCell className="min-w-[140px]">
                      {item.status === 'indexed' ? (
                        <span
                          className="text-xs"
                          style={{ color: SUCCESS }}
                        >
                          已收录
                        </span>
                      ) : item.status === 'rejected' ? (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span
                              className="text-xs cursor-help line-clamp-2 block max-w-[160px]"
                              style={{ color: DANGER }}
                            >
                              {item.rejectCategory
                                ? SUBMISSION_REJECT_CATEGORY_LABELS[
                                    item.rejectCategory as keyof typeof SUBMISSION_REJECT_CATEGORY_LABELS
                                  ]
                                : '被拒'}
                            </span>
                          </TooltipTrigger>
                          <TooltipContent className="max-w-xs">
                            <p className="text-xs">
                            {item.rejectReason || '暂无原因说明'}
                            </p>
                          </TooltipContent>
                        </Tooltip>
                      ) : item.status === 'failed' ? (
                        <span
                          className="text-xs"
                          style={{ color: WARNING }}
                        >
                          投稿失败
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">
                          -
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="min-w-[100px]">
                      {item.indexedUrl ? (
                        <UniversalLink
                          to={item.indexedUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs hover:underline"
                          style={{ color: PRIMARY }}
                        >
                          <ExternalLink className="h-3 w-3" />
                          查看
                        </UniversalLink>
                      ) : (
                        '-'
                      )}
                    </TableCell>
                    <TableCell className="w-[132px] text-right">
                      <div className="flex items-center justify-end gap-1">
                        {item.status === 'pending' && (
                          <>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 px-2 text-xs"
                              style={{ color: PRIMARY }}
                              onClick={() => handleSubmitLocal(item)}
                            >
                              <Upload className="h-3 w-3" />
                              去投稿
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 px-2 text-xs text-destructive"
                              onClick={() => handleDelete(item)}
                            >
                              <Trash2 className="h-3 w-3" />
                              删除
                            </Button>
                          </>
                        )}
                        {item.status === 'submitted' && (
                          <>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 px-2 text-xs"
                              style={{ color: SUCCESS }}
                              onClick={() => openMarkIndexed(item)}
                            >
                              <CheckCircle2 className="h-3 w-3" />
                              标记已收录
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 px-2 text-xs text-destructive"
                              onClick={() => handleDelete(item)}
                            >
                              <Trash2 className="h-3 w-3" />
                              删除
                            </Button>
                          </>
                        )}
                        {item.status === 'indexed' && (
                          <>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 px-2 text-xs text-muted-foreground"
                              onClick={() => setViewingItem(item)}
                            >
                              <FileText className="h-3 w-3" />
                              查看
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 px-2 text-xs text-destructive"
                              onClick={() => handleDelete(item)}
                            >
                              <Trash2 className="h-3 w-3" />
                              删除
                            </Button>
                          </>
                        )}
                        {(item.status === 'rejected' ||
                          item.status === 'failed') && (
                          <>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 px-2 text-xs"
                              style={{ color: WARNING }}
                              onClick={() => handleRetry(item)}
                              disabled={retryMutation.isPending}
                            >
                              <RotateCcw className="h-3 w-3" />
                              重试
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 px-2 text-xs text-destructive"
                              onClick={() => handleDelete(item)}
                            >
                              <Trash2 className="h-3 w-3" />
                              删除
                            </Button>
                          </>
                        )}
                        {item.status === 'cancelled' && (
                          <>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 px-2 text-xs text-destructive"
                              onClick={() => handleDelete(item)}
                            >
                              <Trash2 className="h-3 w-3" />
                              删除
                            </Button>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ),
              )}
            </TableBody>
          </Table>
        )}
      </TableShell>

        {/* 标记已收录弹窗 */}
        <Dialog
          open={!!indexedItem}
          onOpenChange={(v) => !v && setIndexedItem(null)}
        >
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>标记已收录</DialogTitle>
              <DialogDescription>
                填写收录链接和时间，用于记录投稿结果
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3 py-2">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">稿件标题</label>
                <div className="text-sm text-muted-foreground bg-muted/30 rounded-md px-3 py-2">
                  {indexedItem?.title}
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">
                  收录链接 <span style={{ color: DANGER }}>*</span>
                </label>
                <Input
                  value={indexedForm.url}
                  onChange={(e) =>
                    setIndexedForm({ ...indexedForm, url: e.target.value })
                  }
                  placeholder="https://..."
                  className="h-9"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">收录时间</label>
                <Input
                  type="date"
                  value={indexedForm.indexedAt}
                  onChange={(e) =>
                    setIndexedForm({
                      ...indexedForm,
                      indexedAt: e.target.value,
                    })
                  }
                  className="h-9"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIndexedItem(null)}>
                取消
              </Button>
              <Button
                style={{ backgroundColor: PRIMARY }}
                disabled={indexedMutation.isPending || !indexedForm.url}
                onClick={() =>
                  indexedItem &&
                  indexedMutation.mutate({
                    id: indexedItem.id,
                    data: indexedForm,
                  })
                }
              >
                {indexedMutation.isPending ? '保存中...' : '确认'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* 标记被拒弹窗 */}
        <Dialog
          open={!!rejectedItem}
          onOpenChange={(v) => !v && setRejectedItem(null)}
        >
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>标记被拒</DialogTitle>
              <DialogDescription>
                选择拒绝类型并填写拒绝原因
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3 py-2">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">稿件标题</label>
                <div className="text-sm text-muted-foreground bg-muted/30 rounded-md px-3 py-2">
                  {rejectedItem?.title}
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">拒绝类型</label>
                <Select
                  value={rejectForm.category}
                  onValueChange={(v) =>
                    setRejectForm({
                      ...rejectForm,
                      category: v as SubmissionRejectCategory,
                    })
                  }
                >
                  <SelectTrigger className="w-full h-9">
                    <SelectValue placeholder="选择拒绝类型" />
                  </SelectTrigger>
                  <SelectContent>
                    {SUBMISSION_REJECT_CATEGORIES.map((cat) => (
                      <SelectItem key={cat} value={cat}>
                        {SUBMISSION_REJECT_CATEGORY_LABELS[cat]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">拒绝原因</label>
                <Textarea
                  value={rejectForm.reason}
                  onChange={(e) =>
                    setRejectForm({ ...rejectForm, reason: e.target.value })
                  }
                  placeholder="请输入拒绝原因"
                  rows={4}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setRejectedItem(null)}>
                取消
              </Button>
              <Button
                variant="destructive"
                disabled={rejectMutation.isPending}
                onClick={() =>
                  rejectedItem &&
                  rejectMutation.mutate({
                    id: rejectedItem.id,
                    data: rejectForm,
                  })
                }
              >
                {rejectMutation.isPending ? '保存中...' : '确认'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* 查看稿件弹窗 */}
        <Dialog
          open={!!viewingItem}
          onOpenChange={(v) => !v && setViewingItem(null)}
        >
          <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
            <DialogHeader>
              <DialogTitle>查看稿件</DialogTitle>
              <DialogDescription>
                {viewingItem &&
                  `${viewingItem.channelName} · ${getChannelTypeLabel(
                    viewingItem.channelType,
                  )}`}
              </DialogDescription>
            </DialogHeader>
            <div className="overflow-y-auto flex-1">
              {viewingItem && (
                <div className="space-y-4">
                  <div>
                    <h3 className="text-lg font-semibold">
                      {viewingItem.title}
                    </h3>
                    <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
                      <Badge variant="outline">
                        {viewingItem.wordCount} 字
                      </Badge>
                      <span>创建于 {formatDate(viewingItem.createdAt)}</span>
                    </div>
                  </div>
                  {viewingItem.tags.length > 0 && (
                    <div className="flex items-center gap-2 flex-wrap">
                      {viewingItem.tags.map((tag: string, i: number) => (
                        <Badge
                          key={i}
                          variant="secondary"
                          className="text-xs"
                        >
                          #{tag}
                        </Badge>
                      ))}
                    </div>
                  )}
                  <div className="rounded-md border p-4 bg-muted/20 whitespace-pre-wrap text-sm leading-relaxed max-h-[400px] overflow-y-auto">
                    {viewingItem.content || '（暂无正文内容）'}
                  </div>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setViewingItem(null)}>
                关闭
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* 从创作历史选稿弹窗 */}
        <Dialog
          open={selectDialogOpen}
          onOpenChange={(v) => !v && setSelectDialogOpen(false)}
        >
          <DialogContent className="sm:max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
            <DialogHeader>
              <DialogTitle>
                {selectStep === 'articles' ? '选择文章' : '选择信源'}
              </DialogTitle>
              <DialogDescription>
                {selectStep === 'articles'
                  ? '从创作历史中勾选需要投稿的文章'
                  : '选择目标信源，将为每篇文章×每个信源创建发布任务'}
              </DialogDescription>
            </DialogHeader>

            {selectStep === 'articles' && (
              <div className="flex-1 overflow-hidden flex flex-col gap-3">
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                    <Input
                      value={articleKeyword}
                      onChange={(e) => setArticleKeyword(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') setArticlePage(1);
                      }}
                      placeholder="搜索文章标题"
                      className="h-9 pl-8 text-xs"
                    />
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setArticlePage(1)}
                    className="h-9"
                  >
                    搜索
                  </Button>
                </div>
                <div className="flex-1 overflow-y-auto rounded-md border">
                  {articlesLoading ? (
                    <div className="p-4 space-y-2">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <div
                          key={i}
                          className="flex items-center gap-3 h-10"
                        >
                          <Skeleton className="h-4 w-4" />
                          <Skeleton className="h-4 flex-1" />
                          <Skeleton className="h-4 w-20" />
                          <Skeleton className="h-4 w-16" />
                          <Skeleton className="h-4 w-28" />
                        </div>
                      ))}
                    </div>
                  ) : articlesData?.items?.length ? (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-10">
                            <Checkbox
                              checked={
                                articlesData.items.length > 0 &&
                                articlesData.items.every((a: Article) =>
                                  selectedArticleIds.has(a.id),
                                )
                              }
                              onCheckedChange={(checked) => {
                                if (checked) {
                                  setSelectedArticleIds(
                                    new Set(
                                      articlesData.items.map(
                                        (a: Article) => a.id,
                                      ),
                                    ),
                                  );
                                } else {
                                  setSelectedArticleIds(new Set());
                                }
                              }}
                              aria-label="全选本页"
                            />
                          </TableHead>
                          <TableHead>标题</TableHead>
                          <TableHead className="w-24">品牌</TableHead>
                          <TableHead className="w-16">字数</TableHead>
                          <TableHead className="w-28">创建时间</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {articlesData.items.map((a: Article) => (
                          <TableRow key={a.id} className="h-10">
                            <TableCell>
                              <Checkbox
                                checked={selectedArticleIds.has(a.id)}
                                onCheckedChange={() =>
                                  toggleArticleSelect(a.id)
                                }
                                aria-label={`选择 ${a.title}`}
                              />
                            </TableCell>
                            <TableCell className="text-sm font-medium truncate max-w-[280px]">
                              {a.title}
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {a.brandName}
                            </TableCell>
                            <TableCell className="text-sm">
                              {a.wordCount}
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {formatDate(a.createdAt)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  ) : (
                    <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
                      暂无符合条件的文章
                    </div>
                  )}
                </div>
                {articlesData && articlesData.total > 10 && (
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>
                      共 {articlesData.total} 篇，第 {articlePage} /{' '}
                      {Math.ceil(articlesData.total / 10)} 页
                    </span>
                    <div className="flex gap-1">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8"
                        onClick={() =>
                          setArticlePage((p) => Math.max(1, p - 1))
                        }
                        disabled={articlePage === 1}
                      >
                        上一页
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8"
                        onClick={() =>
                          setArticlePage((p) =>
                            Math.min(
                              Math.ceil(articlesData.total / 10),
                              p + 1,
                            ),
                          )
                        }
                        disabled={
                          articlePage >=
                          Math.ceil(articlesData.total / 10)
                        }
                      >
                        下一页
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {selectStep === 'channels' && (
              <div className="flex-1 overflow-y-auto rounded-md border">
                {channelOptions.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-10">
                          <Checkbox
                            checked={
                              channelOptions.length > 0 &&
                              channelOptions.every((c) =>
                                selectedChannelIds.has(c.id),
                              )
                            }
                            onCheckedChange={(checked) => {
                              if (checked) {
                                setSelectedChannelIds(
                                  new Set(channelOptions.map((c) => c.id)),
                                );
                              } else {
                                setSelectedChannelIds(new Set());
                              }
                            }}
                            aria-label="全选渠道"
                          />
                        </TableHead>
                        <TableHead>渠道名称</TableHead>
                        <TableHead className="w-28">渠道类型</TableHead>
                        <TableHead className="w-24">状态</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {channelOptions.map((c: SubmissionChannel) => (
                        <TableRow key={c.id} className="h-10">
                          <TableCell>
                            <Checkbox
                              checked={selectedChannelIds.has(c.id)}
                              onCheckedChange={() => toggleChannelSelect(c.id)}
                              aria-label={`选择 ${c.name}`}
                            />
                          </TableCell>
                          <TableCell className="text-sm font-medium">
                            {c.name}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {getChannelTypeLabel(c.channelType)}
                          </TableCell>
                          <TableCell>
                            <span
                              className="text-xs"
                              style={{
                                color: c.status === 'active' ? SUCCESS : MUTED,
                              }}
                            >
                              {c.status === 'active' ? '启用' : '暂停'}
                            </span>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
                    暂无可用的信源
                  </div>
                )}
              </div>
            )}

            <DialogFooter className="flex items-center justify-between">
              <div className="text-xs text-muted-foreground">
                {selectStep === 'articles'
                  ? `已选 ${selectedArticleIds.size} 篇文章`
                  : `已选 ${selectedChannelIds.size} 个渠道，将创建 ${selectedArticleIds.size * selectedChannelIds.size} 条投稿任务`}
              </div>
              <div className="flex items-center gap-2">
                {selectStep === 'channels' && (
                  <Button
                    variant="outline"
                    onClick={() => setSelectStep('articles')}
                  >
                    上一步
                  </Button>
                )}
                <Button
                  variant="outline"
                  onClick={() => setSelectDialogOpen(false)}
                >
                  取消
                </Button>
                {selectStep === 'articles' ? (
                  <Button
                    style={{ backgroundColor: PRIMARY }}
                    disabled={selectedArticleIds.size === 0}
                    onClick={() => setSelectStep('channels')}
                  >
                    下一步
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                ) : (
                  <Button
                    style={{ backgroundColor: PRIMARY }}
                    disabled={
                      selectedChannelIds.size === 0 ||
                      enqueueBatchMutation.isPending
                    }
                    onClick={handleConfirmEnqueue}
                  >
                    {enqueueBatchMutation.isPending ? '提交中...' : '确认提交'}
                  </Button>
                )}
              </div>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  );
};

const TableSkeleton = () => (
  <div className="space-y-2 rounded-md border p-4">
    {Array.from({ length: 8 }).map((_, i) => (
      <div key={i} className="flex items-center gap-4">
        <Skeleton className="h-4 flex-1" />
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-4 w-12" />
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-4 w-16" />
        <Skeleton className="h-4 w-48" />
      </div>
    ))}
  </div>
);

const EmptyState: React.FC<{ onAdd: () => void }> = ({ onAdd }) => {
  return (
    <div className="flex h-[300px] flex-col items-center justify-center gap-3 text-sm text-muted-foreground">
      <div
        className="flex size-16 items-center justify-center rounded-full"
        style={{ backgroundColor: '#f1f5f9' }}
      >
        <FileText className="h-8 w-8 text-muted-foreground/50" />
      </div>
      <div>暂无投稿任务</div>
      <Button size="sm" onClick={onAdd} style={{ backgroundColor: PRIMARY }}>
        <Plus className="h-3.5 w-3.5" />
        从创作历史选稿
      </Button>
    </div>
  );
};

export default SubmissionQueuePage;
