import React, { useEffect, useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { AiSourcePlatformSelect } from '@client/src/components/publication/AiSourcePlatformSelect';
import { AutoSelectDialog } from '@client/src/components/publication/AutoSelectDialog';
import { toast } from 'sonner';
import {
  RefreshCw,
  AlertCircle,
  Send,
  RotateCcw,
  Clock,
  Loader2,
  CheckCircle2,
  FileText,
  ExternalLink,
  AlertTriangle,
  Calendar,
  Play,
  Search,
  Plus,
  Download,
  XCircle,
  Trash2,
  ChevronRight,
  Upload,
  Copy,
  CalendarClock,
} from 'lucide-react';
import { Button } from '@client/src/components/ui/button';
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
import { Skeleton } from '@client/src/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@client/src/components/ui/dialog';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
  DrawerFooter,
  DrawerClose,
} from '@client/src/components/ui/drawer';
import {
  Tabs,
  TabsList,
  TabsTrigger,
} from '@client/src/components/ui/tabs';
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@client/src/components/ui/pagination';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@client/src/components/ui/tooltip';
import { Badge } from '@client/src/components/ui/badge';
import { Markdown } from '@client/src/components/ui/markdown';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@client/src/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@client/src/components/ui/table';
import { PageHeader } from '@client/src/components/layout/PageHeader';
import { SectionCard } from '@client/src/components/layout/SectionCard';
import { DataTable } from '@client/src/components/layout/DataTable';
import { Pill } from '@client/src/components/layout/Pill';
import { EmptyState } from '@client/src/components/layout/EmptyState';
import {
  list as listPublishQueue,
  retry as retryPublish,
  markPublished,
  markManual,
  remove as removeQueueItem,
  rescheduleDispatch,
} from '@client/src/api/publish-queue';
import { list as listAccountAuths } from '@client/src/api/account-auths';
import {
  list as listSubmissionQueue,
  enqueue as enqueueSubmission,
  updateStatus as updateSubmissionStatus,
  remove as removeSubmission,
  listAllChannels as listAllSubmissionChannels,
} from '@client/src/api/submission-queue';
import { getBrands } from '@client/src/api/brands';
import { listArticles, getArticle } from '@client/src/api/creation';
import { useAuth } from '@client/src/hooks/useAuth';
import {
  PUBLISH_QUEUE_STATUSES,
  PUBLISH_QUEUE_STATUS_LABELS,
  CHANNEL_PLATFORM_LABELS,
  DISPATCH_PLAN_STATUS_LABELS,
  SUBMISSION_QUEUE_STATUSES,
  SUBMISSION_QUEUE_STATUS_LABELS,
  SUBMISSION_CHANNEL_TYPE_LABELS,
  SUBMISSION_REJECT_CATEGORIES,
  SUBMISSION_REJECT_CATEGORY_LABELS,
  SUBMISSION_LIBRARY_TYPES,
  SUBMISSION_LIBRARY_TYPE_LABELS,
  SUBMISSION_REGIONS,
  SUBMISSION_AI_SOURCES,
  SUBMISSION_AI_SOURCE_LABELS,
} from '@shared/api.interface';
import type {
  PublishQueueItem,
  PublishQueueStatus,
  MarkPublishedRequest,
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
const MUTED = '#94A3B8';
const INFO = '#3b82f6';

/** 判断计划是否逾期：计划日期早于今天（只比较年月日）且状态为待排期/待发布 */
function isOverdue(item: PublishQueueItem): boolean {
  if (!item.scheduledDate) return false;
  const status = item.status as string;
  if (status !== 'planned' && status !== 'pending') return false;
  const planTime = new Date(item.scheduledDate).setHours(0, 0, 0, 0);
  const todayTime = new Date().setHours(0, 0, 0, 0);
  return planTime < todayTime;
}

const PAGE_SIZE = 10;

const PUBLISH_STATUS_COLORS: Record<
  PublishQueueStatus,
  { bg: string; color: string; dot: string }
> = {
  pending: { bg: 'rgba(59, 130, 246, 0.1)', color: INFO, dot: INFO },
  publishing: {
    bg: 'rgba(249, 115, 22, 0.1)',
    color: WARNING,
    dot: WARNING,
  },
  pending_manual: {
    bg: 'rgba(46, 125, 255, 0.1)',
    color: '#2563EB',
    dot: '#2563EB',
  },
  pending_client: {
    bg: 'rgba(71, 85, 105, 0.1)',
    color: '#475569',
    dot: '#475569',
  },
  client_running: {
    bg: 'rgba(6, 182, 212, 0.12)',
    color: '#0891b2',
    dot: '#0891b2',
  },
  published: { bg: 'rgba(16, 185, 129, 0.1)', color: SUCCESS, dot: SUCCESS },
  failed: { bg: 'rgba(239, 68, 68, 0.1)', color: DANGER, dot: DANGER },
};

const PUBLISH_TAB_STATUSES: { value: string; label: string }[] = [
  { value: '', label: '全部' },
  { value: 'planned', label: '待排期' },
  { value: 'queued', label: '已下单' },
  { value: 'published', label: '已发布' },
  { value: 'failed', label: '失败' },
];

const SUBMISSION_STATUS_COLORS: Record<
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

const SUBMISSION_STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: '全部状态' },
  ...SUBMISSION_QUEUE_STATUSES.map((s) => ({
    value: s,
    label: SUBMISSION_QUEUE_STATUS_LABELS[s],
  })),
];

type TargetTab = 'publish' | 'submission';

const PublishQueuePage: React.FC = () => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isClient = user?.role === 'client';

  /* ---------- 目标类型切换 ---------- */
  const [targetTab, setTargetTab] = useState<TargetTab>('publish');

  /* ================================================================ */
  /* ---------------- 平台账号（占位队列）相关状态 ------------------- */
  /* ================================================================ */
  const [publishPage, setPublishPage] = useState(1);
  const [publishPageSize, setPublishPageSize] = useState(PAGE_SIZE);
  const [publishStatusTab, setPublishStatusTab] = useState<string>('');
  const [publishChannelFilter, setPublishChannelFilter] = useState<string>('');
  const [publishAccountFilter, setPublishAccountFilter] = useState<string>('');
  const [publishBrandFilter, setPublishBrandFilter] = useState<string>('');
  const [publishStartDate, setPublishStartDate] = useState<string>('');
  const [publishEndDate, setPublishEndDate] = useState<string>('');
  const [publishSelectedIds, setPublishSelectedIds] = useState<Set<string>>(
    new Set(),
  );

  const {
    data: publishQueueData,
    isLoading: publishLoading,
    isError: publishIsError,
    refetch: publishRefetch,
  } = useQuery({
    queryKey: [
      'publishQueue',
      publishPage,
      publishPageSize,
      publishStatusTab,
      publishChannelFilter,
      publishAccountFilter,
      publishBrandFilter,
      publishStartDate,
      publishEndDate,
    ],
    queryFn: () =>
      listPublishQueue({
        page: publishPage,
        pageSize: publishPageSize,
        status:
          publishStatusTab && publishStatusTab !== '__pending_execution__'
            ? (publishStatusTab as PublishQueueStatus)
            : undefined,
        pendingExecution:
          publishStatusTab === '__pending_execution__' ? true : undefined,
        channelId: publishChannelFilter || undefined,
        accountId: publishAccountFilter || undefined,
        brandId: isClient
          ? user?.brandId || undefined
          : publishBrandFilter || undefined,
        startDate: publishStartDate || undefined,
        endDate: publishEndDate || undefined,
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

  const publishBrandIdForFilter = isClient
    ? user?.brandId || undefined
    : publishBrandFilter || undefined;

  const { data: accountAuthsData } = useQuery({
    queryKey: ['accountAuths', 'filter', publishBrandIdForFilter],
    queryFn: () =>
      listAccountAuths({
        brandId: publishBrandIdForFilter,
        pageSize: 100,
      }),
    retry: 2,
    retryDelay: 2000,
    enabled: !!publishBrandIdForFilter,
  });

  const publishAccountOptions = useMemo(
    () => (accountAuthsData?.items ?? []).map((a) => ({ id: a.id, name: a.accountName })),
    [accountAuthsData],
  );

  const publishTotalPages = useMemo(() => {
    if (!publishQueueData) return 1;
    return Math.max(1, Math.ceil(publishQueueData.total / PAGE_SIZE));
  }, [publishQueueData]);

  /* ---------- 渠道选项（从列表数据提取） ---------- */
  const publishChannelOptions = useMemo(() => {
    if (!publishQueueData?.items) return [];
    const map = new Map<string, string>();
    for (const item of publishQueueData.items) {
      if (item.channelId && item.channelName) {
        map.set(item.channelId, item.channelName);
      }
    }
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [publishQueueData]);

  /* ---------- 全选 / 单选 ---------- */
  const publishAllItems = publishQueueData?.items || [];
  const publishAllSelected =
    publishAllItems.length > 0 &&
    publishAllItems.every((i) => publishSelectedIds.has(i.id));

  const togglePublishSelectAll = () => {
    if (publishAllSelected) {
      setPublishSelectedIds(new Set());
    } else {
      setPublishSelectedIds(new Set(publishAllItems.map((i) => i.id)));
    }
  };

  const togglePublishSelectOne = (id: string) => {
    const next = new Set(publishSelectedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setPublishSelectedIds(next);
  };

  /* ---------- 重试 ---------- */
  const publishRetryMutation = useMutation({
    mutationFn: retryPublish,
    retry: false,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['publishQueue'] });
      toast.success('已重新加入待发布队列');
    },
    onError: (err: Error) => {
      toast.error(err.message || '重试失败');
    },
  });

  const handlePublishBatchRetry = () => {
    if (publishSelectedIds.size === 0) return;
    const ids = Array.from(publishSelectedIds);
    Promise.all(ids.map((id) => publishRetryMutation.mutateAsync(id)))
      .then(() => {
        toast.success(`已重新加入队列 ${ids.length} 条`);
        setPublishSelectedIds(new Set());
      })
      .catch(() => {
        toast.error('部分任务重试失败');
      });
  };

  /* ---------- 立即占位 ---------- */
  const handlePublishNow = (item: PublishQueueItem) => {
    toast.info(`已将「${item.title}」加入优先发布队列`);
  };

  /* ---------- 改为手动 ---------- */
  const markManualMutation = useMutation({
    mutationFn: (id: string) => markManual(id),
    onSuccess: () => {
      toast.success('已改为手动发布');
      queryClient.invalidateQueries({ queryKey: ['publishQueue'] });
    },
    onError: (err: Error) => {
      toast.error(err.message || '操作失败');
    },
  });
  const handleMarkManual = (item: PublishQueueItem) => {
    markManualMutation.mutate(item.id);
  };

  /* ---------- 删除队列项 ---------- */
  const [deleteQueueItemId, setDeleteQueueItemId] = useState<string | null>(null);
  const deleteQueueMutation = useMutation({
    mutationFn: (id: string) => removeQueueItem(id),
    retry: false,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['publishQueue'] });
      queryClient.invalidateQueries({ queryKey: ['publishLedger'] });
      setDeleteQueueItemId(null);
      toast.success('删除成功');
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.error?.message || err.message || '删除失败';
      toast.error(msg);
    },
  });

  const handleDeleteQueue = (item: PublishQueueItem) => {
    setDeleteQueueItemId(item.id);
  };

  const rescheduleMutation = useMutation({
    mutationFn: (id: string) => rescheduleDispatch(id),
    retry: false,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['publishQueue'] });
      toast.success('已重新排期至明天');
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.error?.message || err.message || '操作失败';
      toast.error(msg);
    },
  });

  const confirmDeleteQueue = async () => {
    if (!deleteQueueItemId) return;
    const confirmed = await showConfirm(
      '确认删除此队列项？删除后不可恢复，已收录的记录不会被删除。',
    );
    if (!confirmed) return;
    deleteQueueMutation.mutate(deleteQueueItemId);
  };

  /* ---------- 标记已收录弹窗 ---------- */
  const [markPubItem, setMarkPubItem] = useState<PublishQueueItem | null>(
    null,
  );
  const [markPubForm, setMarkPubForm] = useState<MarkPublishedRequest>({
    publishMethod: 'manual',
    url: '',
    publishedAt: '',
  });
  const markPubMutation = useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string;
      data: MarkPublishedRequest;
    }) => markPublished(id, data),
    retry: false,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['publishQueue'] });
      setMarkPubItem(null);
      toast.success('已标记为已收录');
    },
    onError: (err: Error) => {
      toast.error(err.message || '操作失败');
    },
  });

  const openMarkPublished = (item: PublishQueueItem) => {
    setMarkPubItem(item);
    setMarkPubForm({
      publishMethod: 'manual',
      url: item.publishUrl || '',
      publishedAt: formatLocalDateTimeInput(new Date()),
    });
  };

  /* ---------- 查看稿件抽屉 ---------- */
  const [publishViewingItem, setPublishViewingItem] =
    useState<PublishQueueItem | null>(null);

  const {
    data: pubViewingArticle,
    isLoading: pubViewingLoading,
    isError: pubViewingError,
    refetch: pubViewingRefetch,
  } = useQuery({
    queryKey: ['articleDetail', publishViewingItem?.articleId],
    queryFn: () => getArticle(publishViewingItem!.articleId!),
    retry: 1,
    retryDelay: 2000,
    enabled: !!(publishViewingItem?.articleId),
  });

  const getPubViewingContent = (): string => {
    if (!publishViewingItem) return '';
    if (pubViewingArticle?.content) {
      return pubViewingArticle.content;
    }
    return '';
  };

  const getPubViewingWordCount = (): number => {
    if (!publishViewingItem) return 0;
    if (pubViewingArticle?.wordCount) {
      return pubViewingArticle.wordCount;
    }
    return publishViewingItem.wordCount || 0;
  };

  const handlePublishTabChange = (value: string) => {
    setPublishStatusTab(value);
    setPublishPage(1);
    setPublishSelectedIds(new Set());
  };

  /* ---------- 去占位（占位队列） ---------- */
  const [goPubItem, setGoPubItem] = useState<PublishQueueItem | null>(null);
  const [goPubForm, setGoPubForm] = useState({
    publishMethod: 'manual' as 'manual' | 'client',
    accountId: '',
    url: '',
    publishedAt: '',
    remark: '',
  });
  const [goPubUrlTouched, setGoPubUrlTouched] = useState(false);

  const goPubUrlInvalid = useMemo(() => {
    if (!goPubForm.url) return false;
    return !/^https?:\/\//i.test(goPubForm.url);
  }, [goPubForm.url]);

  const goPubUrlSuspicious = useMemo(() => {
    if (!goPubForm.url) return false;
    return (
      /test_/i.test(goPubForm.url) ||
      /placeholder/i.test(goPubForm.url) ||
      /example\.com/i.test(goPubForm.url)
    );
  }, [goPubForm.url]);

  const goPubMutation = useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string;
      data: MarkPublishedRequest;
    }) => markPublished(id, data),
    retry: false,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['publishQueue'] });
      queryClient.invalidateQueries({ queryKey: ['publishLedger'] });
      setGoPubItem(null);
      toast.success('已登记发布，台账已同步');
    },
    onError: (err: Error) => {
      toast.error(err.message || '登记失败');
    },
  });

  const openGoPublish = (item: PublishQueueItem) => {
    const channel = subChannelOptions.find((c) => c.id === item.channelId);
    if (channel?.submitUrl) {
      window.open(channel.submitUrl, '_blank', 'noopener,noreferrer');
    } else {
      toast.warning('该渠道未配置信源入口，请先在信源库页补充', {
        action: {
          label: '去配置',
          onClick: () => navigate('/publish/submission-channels'),
        },
      });
    }
    setGoPubItem(item);
    setGoPubForm({
      publishMethod: 'manual',
      accountId: '',
      url: item.publishUrl || '',
      publishedAt: formatLocalDateTimeInput(new Date()),
      remark: '',
    });
    setGoPubUrlTouched(false);
  };

  const handleGoPubSave = async () => {
    if (!goPubItem) return;

    if (goPubForm.publishMethod === 'manual') {
      if (!goPubForm.url || goPubUrlInvalid) return;

      if (goPubItem.publishUrl) {
        const confirmed = await showConfirm(
          '该稿件已登记过发布链接，确认覆盖？',
        );
        if (!confirmed) return;
      }
    }

    if (goPubForm.publishMethod === 'client' && !goPubForm.accountId) {
      toast.warning('请选择授权账号');
      return;
    }

    goPubMutation.mutate({
      id: goPubItem.id,
      data: {
        publishMethod: goPubForm.publishMethod,
        accountId: goPubForm.accountId || undefined,
        url: goPubForm.url,
        publishedAt: new Date(goPubForm.publishedAt).toISOString(),
        remark: goPubForm.remark || undefined,
      },
    });
  };

  /* ================================================================ */
  /* ---------------- 信源库（占位队列）相关状态 ------------------- */
  /* ================================================================ */
  const [subPage, setSubPage] = useState(1);
  const [subPageSize, setSubPageSize] = useState(PAGE_SIZE);
  const [subStatusFilter, setSubStatusFilter] = useState<string>('');
  const [subChannelFilter, setSubChannelFilter] = useState<string>('');
  const [subBrandFilter, setSubBrandFilter] = useState<string>('');
  const [subStartDate, setSubStartDate] = useState<string>('');
  const [subEndDate, setSubEndDate] = useState<string>('');
  const [subKeyword, setSubKeyword] = useState<string>('');
  const [subSearchInput, setSubSearchInput] = useState<string>('');

  const {
    data: subQueueData,
    isLoading: subLoading,
    isError: subIsError,
    refetch: subRefetch,
  } = useQuery({
    queryKey: [
      'submissionQueue',
      subPage,
      subPageSize,
      subStatusFilter,
      subChannelFilter,
      subBrandFilter,
      subStartDate,
      subEndDate,
      subKeyword,
    ],
    queryFn: () =>
      listSubmissionQueue({
        page: subPage,
        pageSize: subPageSize,
        status: (subStatusFilter || undefined) as
          | SubmissionQueueStatus
          | undefined,
        channelId: subChannelFilter || undefined,
        brandId: isClient
          ? user?.brandId || undefined
          : subBrandFilter || undefined,
        startDate: subStartDate || undefined,
        endDate: subEndDate || undefined,
        keyword: subKeyword || undefined,
      }),
    retry: 2,
    retryDelay: 2000,
  });

  useEffect(() => {
    if (!isClient && brandOptions.length > 0 && !subBrandFilter) {
      setSubBrandFilter(brandOptions[0].id);
    }
  }, [brandOptions, isClient, subBrandFilter]);

  const { data: subChannelOptions = [] } = useQuery<SubmissionChannel[]>({
    queryKey: [
      'submissionChannels',
      isClient ? user?.brandId : subBrandFilter,
    ],
    queryFn: () =>
      listAllSubmissionChannels(
        isClient ? user?.brandId : subBrandFilter || undefined,
      ),
    retry: 2,
    retryDelay: 2000,
  });

  const subTotalPages = useMemo(() => {
    if (!subQueueData) return 1;
    return Math.max(1, Math.ceil(subQueueData.total / PAGE_SIZE));
  }, [subQueueData]);

  const handleSubSearch = () => {
    setSubKeyword(subSearchInput.trim());
    setSubPage(1);
  };

  const handleSubStatusChange = (value: string) => {
    setSubStatusFilter(value);
    setSubPage(1);
  };

  const handleSubChannelChange = (value: string) => {
    setSubChannelFilter(value);
    setSubPage(1);
  };

  const handleSubBrandChange = (value: string) => {
    setSubBrandFilter(value);
    setSubPage(1);
  };

  /* ---------- 删除 ---------- */
  const subDeleteMutation = useMutation({
    mutationFn: removeSubmission,
    retry: false,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['submissionQueue'] });
      toast.success('删除成功');
    },
    onError: (err: Error) => {
      toast.error(err.message || '删除失败');
    },
  });

  const handleSubDelete = async (item: SubmissionQueueItem) => {
    if (await showConfirm(`确认删除发布任务「${item.title}」？`)) {
      subDeleteMutation.mutate(item.id);
    }
  };

  /* ---------- 重试（恢复为 pending） ---------- */
  const subRetryMutation = useMutation({
    mutationFn: (id: string) =>
      updateSubmissionStatus(id, {
        status: 'pending' as SubmissionQueueStatus,
      }),
    retry: false,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['submissionQueue'] });
      toast.success('已重新加入待发布队列');
    },
    onError: (err: Error) => {
      toast.error(err.message || '操作失败');
    },
  });

  const handleSubRetry = (item: SubmissionQueueItem) => {
    subRetryMutation.mutate(item.id);
  };

  /* ---------- 标记已提交 ---------- */
  const markSubmittedMutation = useMutation({
    mutationFn: (id: string) =>
      updateSubmissionStatus(id, {
        status: 'submitted' as SubmissionQueueStatus,
      }),
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
      updateSubmissionStatus(id, {
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

  /* ---------- 标记未收录弹窗 ---------- */
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
      updateSubmissionStatus(id, {
        status: 'rejected',
        rejectCategory: data.category,
        rejectReason: data.reason,
      }),
    retry: false,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['submissionQueue'] });
      setRejectedItem(null);
      toast.success('已标记为未收录');
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
  const [subViewingItem, setSubViewingItem] =
    useState<SubmissionQueueItem | null>(null);

  /* ---------- 查看稿件 - 文章详情 ---------- */
  const {
    data: viewingArticle,
    isLoading: viewingArticleLoading,
    isError: viewingArticleError,
    refetch: refetchViewingArticle,
  } = useQuery({
    queryKey: ['articleDetail', subViewingItem?.articleId],
    queryFn: () => getArticle(subViewingItem!.articleId!),
    retry: 1,
    retryDelay: 2000,
    enabled: !!(subViewingItem?.articleId),
  });

  /* ---------- 去占位（占位队列） ---------- */
  const openSubPublishDialog = (item: SubmissionQueueItem) => {
    const channel = subChannelOptions.find((c) => c.id === item.channelId);
    if (channel?.submitUrl) {
      window.open(channel.submitUrl, '_blank', 'noopener,noreferrer');
      toast.success('已打开发布页，请手动发布后使用「标记已提交」登记');
    } else {
      toast.warning('该渠道未配置信源入口，请先在信源库页补充', {
        action: {
          label: '去配置',
          onClick: () => navigate('/publish/submission-channels'),
        },
      });
    }
  };


  /* ---------- 复制全文 & 下载 .md ---------- */
  const getSubViewingContent = (): string => {
    if (!subViewingItem) return '';
    if (subViewingItem.articleId && viewingArticle?.content) {
      return viewingArticle.content;
    }
    return subViewingItem.content || '';
  };

  const handleCopyFullText = async (title: string, content: string) => {
    try {
      await navigator.clipboard.writeText(`${title}\n\n${content}`);
      toast.success('已复制到剪贴板');
    } catch {
      toast.error('复制失败');
    }
  };

  const handleDownloadMd = (title: string, content: string) => {
    const blob = new Blob([content], { type: 'text/markdown;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${title}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

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
  const [channelFilterLibraryType, setChannelFilterLibraryType] = useState('');
  const [channelFilterRegion, setChannelFilterRegion] = useState('');
  const [channelFilterAiPlatforms, setChannelFilterAiPlatforms] = useState<string[]>([]);
  const [autoSelectDialogOpen, setAutoSelectDialogOpen] = useState(false);

  const filteredSubChannelOptions = useMemo(() => {
    return subChannelOptions.filter((c: SubmissionChannel) => {
      if (channelFilterLibraryType && c.libraryType !== channelFilterLibraryType) return false;
      if (channelFilterRegion && c.region !== channelFilterRegion) return false;
      if (channelFilterAiPlatforms.length > 0 && !c.aiPlatforms.some((p) => channelFilterAiPlatforms.includes(p))) return false;
      return true;
    });
  }, [subChannelOptions, channelFilterLibraryType, channelFilterRegion, channelFilterAiPlatforms]);

  const { data: articlesData, isLoading: articlesLoading } = useQuery({
    queryKey: [
      'articlesForSubmission',
      articlePage,
      articleKeyword,
      isClient ? user?.brandId : subBrandFilter,
    ],
    queryFn: () =>
      listArticles({
        page: articlePage,
        pageSize: 10,
        brandId: isClient
          ? user?.brandId || undefined
          : subBrandFilter || undefined,
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
            enqueueSubmission({
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
      toast.success('已创建发布任务');
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
      brandId: isClient
        ? user?.brandId || undefined
        : subBrandFilter || undefined,
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

  /* ================================================================ */
  /* ---------------- 工具函数 --------------------------------------- */
  /* ================================================================ */
  const formatDateTime = (dateStr: string | null) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleString('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatLocalDateTimeInput = (date: Date): string => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    const hh = String(date.getHours()).padStart(2, '0');
    const mm = String(date.getMinutes()).padStart(2, '0');
    return `${y}-${m}-${d}T${hh}:${mm}`;
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
  };

  const getPlatformLabel = (platform?: string) => {
    if (!platform) return '-';
    return (
      CHANNEL_PLATFORM_LABELS[
        platform as keyof typeof CHANNEL_PLATFORM_LABELS
      ] || platform
    );
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

  /* ================================================================ */
  /* ---------------- 渲染 ------------------------------------------- */
  /* ================================================================ */
  return (
    <TooltipProvider>
      <div className="space-y-6" style={{ backgroundColor: '#f8fafc' }}>
        <PageHeader
          title="发布队列"
          description="查看和管理待发布内容，支持批量操作与状态追踪"
        />

        {/* ================ 渠道账号 Tab ================ */}
        {targetTab === 'publish' && (
          <SectionCard title="发布任务列表">
              {/* 状态 Tabs */}
              <Tabs
                value={publishStatusTab}
                onValueChange={handlePublishTabChange}
                className="w-full"
              >
                <TabsList className="grid grid-cols-5 w-full max-w-xl h-9">
                  {PUBLISH_TAB_STATUSES.map((tab) => (
                    <TabsTrigger
                      key={tab.value}
                      value={tab.value}
                      className="text-xs h-9"
                    >
                      {tab.label}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </Tabs>

              {/* 筛选区 */}
              <div className="flex flex-wrap items-center gap-3">
                <div className="w-40">
                  <Select
                    value={publishBrandFilter}
                    onValueChange={setPublishBrandFilter}
                    disabled={isClient}
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
                <div className="w-40">
                  <Select
                    value={publishChannelFilter}
                    onValueChange={setPublishChannelFilter}
                  >
                    <SelectTrigger className="w-full h-9">
                      <SelectValue placeholder="全部渠道" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">全部渠道</SelectItem>
                      {publishChannelOptions.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="w-40">
                  <Select
                    value={publishAccountFilter}
                    onValueChange={(val) => {
                      setPublishAccountFilter(val);
                      setPublishPage(1);
                    }}
                  >
                    <SelectTrigger className="w-full h-9">
                      <SelectValue placeholder="全部账号" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">全部账号</SelectItem>
                      {publishAccountOptions.map((a) => (
                        <SelectItem key={a.id} value={a.id}>
                          {a.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <Input
                    type="date"
                    value={publishStartDate}
                    onChange={(e) => setPublishStartDate(e.target.value)}
                    className="w-36 h-9 text-xs"
                    placeholder="开始日期"
                  />
                  <span className="text-muted-foreground text-xs">至</span>
                  <Input
                    type="date"
                    value={publishEndDate}
                    onChange={(e) => setPublishEndDate(e.target.value)}
                    className="w-36 h-9 text-xs"
                    placeholder="结束日期"
                  />
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => publishRefetch()}
                  className="h-9 ml-auto"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  刷新
                </Button>
              </div>

              {/* 批量操作栏 */}
              {publishSelectedIds.size > 0 && (
                <div
                  className="flex items-center justify-between rounded-md border px-4 py-2"
                  style={{
                    backgroundColor: 'rgba(30, 64, 175, 0.04)',
                    borderColor: 'rgba(30, 64, 175, 0.2)',
                  }}
                >
                  <div className="text-sm" style={{ color: PRIMARY }}>
                    已选择 <strong>{publishSelectedIds.size}</strong> 项
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8"
                      style={{ color: PRIMARY }}
                    >
                      <Send className="h-3.5 w-3.5" />
                      加入发布队列
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8"
                      style={{ color: WARNING }}
                      onClick={handlePublishBatchRetry}
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                      批量重试
                    </Button>
                    <Button size="sm" variant="outline" className="h-8">
                      <FileText className="h-3.5 w-3.5" />
                      导出稿件
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 text-xs"
                      onClick={() => setPublishSelectedIds(new Set())}
                    >
                      取消选择
                    </Button>
                  </div>
                </div>
              )}

              {/* 错误态 */}
              {publishIsError && (
                <div className="flex items-center justify-between rounded-lg border border-amber-200 bg-amber-50 p-4">
                  <div
                    className="flex items-center gap-2 text-sm"
                    style={{ color: '#b45309' }}
                  >
                    <AlertCircle className="h-4 w-4" />
                    <span>数据加载失败，请稍后刷新</span>
                  </div>
                  <button
                    onClick={() => publishRefetch()}
                    className="flex items-center gap-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors hover:bg-amber-100"
                    style={{ color: '#b45309' }}
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                    重新加载
                  </button>
                </div>
              )}

              {/* 表格区 */}
              {publishLoading ? (
                <PublishTableSkeleton />
              ) : publishQueueData ? (
                <DataTable
                  headerRender={() => null}
                  columns={[
                    {
                      key: 'scheduledDate',
                      title: '计划日期',
                      width: '120px',
                      render: (item: PublishQueueItem) => (
                        <span className="text-sm text-muted-foreground">
                          {item.scheduledDate || '—'}
                        </span>
                      ),
                    },
                    {
                      key: 'channelName',
                      title: '渠道',
                      width: '140px',
                      render: (item: PublishQueueItem) => (
                        item.channelName ? (
                          <span className="text-sm">{item.channelName}</span>
                        ) : (
                          <span className="text-sm text-muted-foreground">—</span>
                        )
                      ),
                    },
                    {
                      key: 'weightTier',
                      title: '档位',
                      width: '72px',
                      render: (item: PublishQueueItem) => (
                        <span className="text-sm tabular-nums">
                          {item.weightTier || '—'}
                        </span>
                      ),
                    },
                    {
                      key: 'title',
                      title: '文章标题',
                      width: '280px',
                      render: (item: PublishQueueItem) => (
                        <div className="flex flex-col gap-1.5 justify-center">
                          {isOverdue(item) && (
                            <Pill
                              variant="warning"
                              className="w-fit"
                            >
                              <AlertTriangle className="h-3 w-3 mr-1" />
                              已逾期
                            </Pill>
                          )}
                          <span
                            className="text-sm font-medium line-clamp-2 block"
                            title={item.title}
                          >
                            {item.title || '—'}
                          </span>
                        </div>
                      ),
                    },
                    {
                      key: 'status',
                      title: '状态',
                      width: '90px',
                      render: (item: PublishQueueItem) => {
                        const statusKey = item.status as keyof typeof DISPATCH_PLAN_STATUS_LABELS;
                        const label = DISPATCH_PLAN_STATUS_LABELS[statusKey] ?? item.status;
                        const variantMap: Record<string, 'success' | 'warning' | 'danger' | 'info' | 'muted'> = {
                          planned: 'muted',
                          queued: 'info',
                          published: 'success',
                          failed: 'danger',
                        };
                        return (
                          <Pill variant={variantMap[item.status] || 'muted'}>
                            {label}
                          </Pill>
                        );
                      },
                    },
                    {
                      key: 'actions',
                      title: '操作',
                      width: '180px',
                      render: (item: PublishQueueItem) => (
                        <div className="flex items-center gap-1 flex-nowrap whitespace-nowrap">
                          {isOverdue(item) && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 px-2 text-xs text-orange-600 hover:text-orange-700 hover:bg-orange-50"
                              onClick={() => rescheduleMutation.mutate(item.id)}
                              disabled={rescheduleMutation.isPending}
                            >
                              <CalendarClock className="h-3 w-3 mr-1" />
                              重新排期
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 px-2 text-xs text-muted-foreground"
                            onClick={() => setPublishViewingItem(item)}
                          >
                            <FileText className="h-3 w-3" />查看详情
                          </Button>
                        </div>
                      ),
                    },
                  ]}
                  data={publishQueueData.items}
                  rowKey="id"
                  emptyText="暂无发布任务"
                  emptyAction={
                    <Button
                      size="sm"
                      style={{ backgroundColor: PRIMARY }}
                      onClick={() => navigate('/publish?tab=records')}
                    >
                      <Plus className="h-3.5 w-3.5" />
                      去发稿
                    </Button>
                  }
                  pagination={{
                    total: publishQueueData.total,
                    page: publishPage,
                    pageSize: publishPageSize,
                    onPageChange: setPublishPage,
                    onPageSizeChange: (size) => {
                      setPublishPageSize(size);
                      setPublishPage(1);
                    },
                  }}
                />
              ) : (
                <PublishEmptyState status={publishStatusTab} />
              )}
          </SectionCard>
        )}

        {/* ================ 信源库 Tab ================ */}
        {targetTab === 'submission' && (
          <SectionCard
            title="信源投稿列表"
            actions={
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
          >
              {/* 筛选区 */}
              <div className="flex flex-wrap items-center gap-3">
                <div className="w-40">
                  <Select
                    value={subStatusFilter}
                    onValueChange={handleSubStatusChange}
                  >
                    <SelectTrigger className="w-full h-9">
                      <SelectValue placeholder="全部状态" />
                    </SelectTrigger>
                    <SelectContent>
                      {SUBMISSION_STATUS_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="w-40">
                  <Select
                    value={subChannelFilter}
                    onValueChange={handleSubChannelChange}
                  >
                    <SelectTrigger className="w-full h-9">
                      <SelectValue placeholder="全部渠道" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">全部渠道</SelectItem>
                      {subChannelOptions.map((c) => (
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
                      value={subBrandFilter}
                      onValueChange={handleSubBrandChange}
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
                    value={subStartDate}
                    onChange={(e) => {
                      setSubStartDate(e.target.value);
                      setSubPage(1);
                    }}
                    className="w-36 h-9 text-xs"
                    placeholder="开始日期"
                  />
                  <span className="text-muted-foreground text-xs">至</span>
                  <Input
                    type="date"
                    value={subEndDate}
                    onChange={(e) => {
                      setSubEndDate(e.target.value);
                      setSubPage(1);
                    }}
                    className="w-36 h-9 text-xs"
                    placeholder="结束日期"
                  />
                </div>
                <div className="flex items-center gap-2 ml-auto">
                  <div className="relative w-56">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                    <Input
                      value={subSearchInput}
                      onChange={(e) => setSubSearchInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSubSearch();
                      }}
                      placeholder="搜索标题关键词"
                      className="h-9 pl-8 text-xs"
                    />
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => subRefetch()}
                    className="h-9"
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                    刷新
                  </Button>
                </div>
              </div>

              {/* 错误态 */}
              {subIsError && (
                <div className="flex items-center justify-between rounded-lg border border-amber-200 bg-amber-50 p-4">
                  <div
                    className="flex items-center gap-2 text-sm"
                    style={{ color: '#b45309' }}
                  >
                    <AlertCircle className="h-4 w-4" />
                    <span>数据加载失败，请稍后刷新</span>
                  </div>
                  <button
                    onClick={() => subRefetch()}
                    className="flex items-center gap-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors hover:bg-amber-100"
                    style={{ color: '#b45309' }}
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                    重新加载
                  </button>
                </div>
              )}

              {/* 表格区 */}
              {subLoading ? (
                <SubmissionTableSkeleton />
              ) : subQueueData ? (
                <DataTable
                  headerRender={() => null}
                  columns={[
                    {
                      key: 'title',
                      title: '标题',
                      width: '240px',
                      render: (item: SubmissionQueueItem) => (
                        <button
                          className="text-left font-medium line-clamp-2 block hover:underline w-full"
                          style={{ color: PRIMARY }}
                          onClick={() => setSubViewingItem(item)}
                          title={item.title}
                        >
                          {item.title}
                        </button>
                      ),
                    },
                    {
                      key: 'channelName',
                      title: '目标渠道',
                      width: '120px',
                      render: (item: SubmissionQueueItem) => (
                        <div className="flex flex-col gap-0.5">
                          <span className="text-sm">{item.channelName}</span>
                          <span className="text-xs text-muted-foreground">
                            {getChannelTypeLabel(item.channelType)}
                          </span>
                        </div>
                      ),
                    },
                    ...(!isClient
                      ? [
                          {
                            key: 'brandId',
                            title: '品牌',
                            width: '100px',
                            render: (item: SubmissionQueueItem) => (
                              <span className="text-sm text-muted-foreground">
                                <span className="block truncate" title={getBrandName(item.brandId)}>
                                  {getBrandName(item.brandId)}
                                </span>
                              </span>
                            ),
                          },
                        ]
                      : []),
                    {
                      key: 'wordCount',
                      title: '字数',
                      width: '68px',
                      align: 'right',
                      render: (item: SubmissionQueueItem) => (
                        <span className="text-sm tabular-nums">{item.wordCount}</span>
                      ),
                    },
                    {
                      key: 'status',
                      title: '状态',
                      width: '96px',
                      render: (item: SubmissionQueueItem) => {
                        const variantMap: Record<string, 'success' | 'warning' | 'danger' | 'info' | 'muted'> = {
                          pending: 'info',
                          reviewing: 'warning',
                          published: 'success',
                          indexed: 'success',
                          rejected: 'danger',
                          failed: 'danger',
                        };
                        return (
                          <Pill variant={variantMap[item.status] || 'muted'}>
                            {SUBMISSION_QUEUE_STATUS_LABELS[item.status]}
                          </Pill>
                        );
                      },
                    },
                    {
                      key: 'createdAt',
                      title: '提交时间',
                      width: '144px',
                      render: (item: SubmissionQueueItem) => (
                        <span className="text-muted-foreground text-sm">
                          {formatDateTime(item.createdAt)}
                        </span>
                      ),
                    },
                    {
                      key: 'reviewResult',
                      title: '审核结果',
                      width: '120px',
                      render: (item: SubmissionQueueItem) => {
                        if (item.status === 'indexed') {
                          return <span className="text-xs" style={{ color: SUCCESS }}>已收录</span>;
                        }
                        if (item.status === 'rejected') {
                          return (
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
                                    : '未收录'}
                                </span>
                              </TooltipTrigger>
                              <TooltipContent className="max-w-xs">
                                <p className="text-xs">{item.rejectReason || '暂无原因说明'}</p>
                              </TooltipContent>
                            </Tooltip>
                          );
                        }
                        if (item.status === 'failed') {
                          return <span className="text-xs" style={{ color: WARNING }}>发布失败</span>;
                        }
                        return <span className="text-xs text-muted-foreground">-</span>;
                      },
                    },
                    {
                      key: 'indexedUrl',
                      title: '收录链接',
                      width: '84px',
                      render: (item: SubmissionQueueItem) => (
                        item.indexedUrl ? (
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
                        )
                      ),
                    },
                    {
                      key: 'actions',
                      title: '操作',
                      width: '248px',
                      render: (item: SubmissionQueueItem) => (
                        <div className="flex items-center gap-1 flex-nowrap whitespace-nowrap">
                          {item.status === 'pending' && (
                            <>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 px-2 text-xs"
                                style={{ color: PRIMARY }}
                                onClick={() => openSubPublishDialog(item)}
                              >
                                <Upload className="h-3 w-3" />去发布
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 px-2 text-xs"
                                style={{ color: '#3b82f6' }}
                                onClick={() => markSubmittedMutation.mutate(item.id)}
                              >
                                <CheckCircle2 className="h-3 w-3" />标记已提交
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 px-2 text-xs text-muted-foreground"
                                onClick={() => setSubViewingItem(item)}
                              >
                                <FileText className="h-3 w-3" />查看稿件
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 px-2 text-xs text-destructive"
                                onClick={() => handleSubDelete(item)}
                              >
                                <Trash2 className="h-3 w-3" />删除
                              </Button>
                            </>
                          )}
                          {item.status === 'submitted' && (
                            <>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 px-2 text-xs"
                                style={{ color: PRIMARY }}
                                onClick={() => openSubPublishDialog(item)}
                              >
                                <Upload className="h-3 w-3" />去发布
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 px-2 text-xs"
                                style={{ color: SUCCESS }}
                                onClick={() => openMarkIndexed(item)}
                              >
                                <CheckCircle2 className="h-3 w-3" />标记已收录
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 px-2 text-xs"
                                style={{ color: DANGER }}
                                onClick={() => openMarkRejected(item)}
                              >
                                <XCircle className="h-3 w-3" />标记未收录
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 px-2 text-xs text-muted-foreground"
                                onClick={() => setSubViewingItem(item)}
                              >
                                <FileText className="h-3 w-3" />查看稿件
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 px-2 text-xs text-destructive"
                                onClick={() => handleSubDelete(item)}
                              >
                                <Trash2 className="h-3 w-3" />删除
                              </Button>
                            </>
                          )}
                          {item.status === 'indexed' && (
                            <>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 px-2 text-xs text-muted-foreground"
                                onClick={() => setSubViewingItem(item)}
                              >
                                <FileText className="h-3 w-3" />查看稿件
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 px-2 text-xs text-destructive"
                                onClick={() => handleSubDelete(item)}
                              >
                                <Trash2 className="h-3 w-3" />删除
                              </Button>
                            </>
                          )}
                          {(item.status === 'rejected' || item.status === 'failed') && (
                            <>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 px-2 text-xs"
                                style={{ color: WARNING }}
                                onClick={() => handleSubRetry(item)}
                                disabled={subRetryMutation.isPending}
                              >
                                <RotateCcw className="h-3 w-3" />重试
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 px-2 text-xs text-muted-foreground"
                                onClick={() => setSubViewingItem(item)}
                              >
                                <FileText className="h-3 w-3" />查看稿件
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 px-2 text-xs text-destructive"
                                onClick={() => handleSubDelete(item)}
                              >
                                <Trash2 className="h-3 w-3" />删除
                              </Button>
                            </>
                          )}
                          {item.status === 'cancelled' && (
                            <>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 px-2 text-xs text-muted-foreground"
                                onClick={() => setSubViewingItem(item)}
                              >
                                <FileText className="h-3 w-3" />查看稿件
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 px-2 text-xs text-destructive"
                                onClick={() => handleSubDelete(item)}
                              >
                                <Trash2 className="h-3 w-3" />删除
                              </Button>
                            </>
                          )}
                        </div>
                      ),
                    },
                  ]}
                  data={subQueueData.items}
                  rowKey="id"
                  emptyText="暂无信源投稿任务"
                  pagination={{
                    total: subQueueData.total,
                    page: subPage,
                    pageSize: subPageSize,
                    onPageChange: setSubPage,
                    onPageSizeChange: (size) => {
                      setSubPageSize(size);
                      setSubPage(1);
                    },
                  }}
                />
              ) : (
                <SubmissionEmptyState onAdd={openSelectDialog} />
              )}
          </SectionCard>
        )}

        {/* ================ 渠道账号弹窗 ================ */}

        {/* 标记已收录弹窗 */}
        <Dialog
          open={!!markPubItem}
          onOpenChange={(v) => !v && setMarkPubItem(null)}
        >
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>标记已收录</DialogTitle>
              <DialogDescription>
                填写实际发布链接和时间，用于记录发布结果
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3 py-2">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">稿件标题</label>
                <div className="text-sm text-muted-foreground bg-muted/30 rounded-md px-3 py-2">
                  {markPubItem?.title}
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">发布链接</label>
                <Input
                  value={markPubForm.url}
                  onChange={(e) =>
                    setMarkPubForm({ ...markPubForm, url: e.target.value })
                  }
                  placeholder="https://..."
                  className="h-9"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">发布时间</label>
                <Input
                  type="datetime-local"
                  value={markPubForm.publishedAt}
                  onChange={(e) =>
                    setMarkPubForm({
                      ...markPubForm,
                      publishedAt: e.target.value,
                    })
                  }
                  className="h-9"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setMarkPubItem(null)}>
                取消
              </Button>
              <Button
                style={{ backgroundColor: PRIMARY }}
                disabled={markPubMutation.isPending || !markPubForm.url}
                onClick={() =>
                  markPubItem &&
                  markPubMutation.mutate({
                    id: markPubItem.id,
                    data: {
                      publishMethod: 'manual',
                      url: markPubForm.url,
                      publishedAt: new Date(
                        markPubForm.publishedAt,
                      ).toISOString(),
                    },
                  })
                }
              >
                {markPubMutation.isPending ? '保存中...' : '确认'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* 占位队列 - 删除确认弹窗 */}
        <Dialog
          open={!!deleteQueueItemId}
          onOpenChange={(v) => !v && setDeleteQueueItemId(null)}
        >
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>确认删除</DialogTitle>
          <DialogDescription>
            删除后该队列项将从列表移除，已收录的记录不会被删除。此操作不可恢复。
          </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setDeleteQueueItemId(null)}
              >
                取消
              </Button>
              <Button
                variant="destructive"
                onClick={confirmDeleteQueue}
                disabled={deleteQueueMutation.isPending}
              >
                {deleteQueueMutation.isPending ? '删除中...' : '确认删除'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* 占位队列 - 去占位登记弹窗 */}
        <Dialog
          open={!!goPubItem}
          onOpenChange={(v) => !v && setGoPubItem(null)}
        >
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>发布登记</DialogTitle>
              <DialogDescription>
                填写发布链接与日期，登记发布结果
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3 py-2">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">发布方式</label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setGoPubForm({ ...goPubForm, publishMethod: 'manual' })}
                    className={`flex-1 rounded-md border px-3 py-2 text-sm transition-colors ${
                      goPubForm.publishMethod === 'manual'
                        ? 'border-primary bg-primary/5 font-medium text-primary'
                        : 'border-border hover:border-primary/50'
                    }`}
                  >
                    手动登记
                  </button>
                  <button
                    type="button"
                    onClick={() => setGoPubForm({ ...goPubForm, publishMethod: 'client' })}
                    className={`flex-1 rounded-md border px-3 py-2 text-sm transition-colors ${
                      goPubForm.publishMethod === 'client'
                        ? 'border-primary bg-primary/5 font-medium text-primary'
                        : 'border-border hover:border-primary/50'
                    }`}
                  >
                    授权客户端
                  </button>
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">目标渠道</label>
                <div className="text-sm text-muted-foreground bg-muted/30 rounded-md px-3 py-2">
                  {goPubItem?.channelName || '未分配渠道'}
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">稿件标题</label>
                <div className="text-sm text-muted-foreground bg-muted/30 rounded-md px-3 py-2 truncate">
                  {goPubItem?.title}
                </div>
              </div>
              <div className="flex items-center justify-end">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    goPubItem &&
                    handleCopyFullText(goPubItem.title, getPubViewingContent())
                  }
                >
                  复制全文
                </Button>
              </div>
              {goPubForm.publishMethod === 'client' ? (
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">
                    选择授权账号 <span className="text-destructive">*</span>
                  </label>
                  <select
                    value={goPubForm.accountId}
                    onChange={(e) =>
                      setGoPubForm({ ...goPubForm, accountId: e.target.value })
                    }
                    className="h-9 w-full rounded-md border border-border bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                  >
                    <option value="">请选择授权账号</option>
                    {publishAccountOptions.map((opt) => (
                      <option key={opt.id} value={opt.id}>
                        {opt.name}
                      </option>
                    ))}
                  </select>
                    <p className="text-xs" style={{ color: MUTED }}>
                    提交后任务将下发至客户端，等待本地客户端领取并执行发布
                  </p>
                </div>
              ) : (
                <>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">
                      发布链接 <span className="text-destructive">*</span>
                    </label>
                    <Input
                      value={goPubForm.url}
                      onChange={(e) =>
                        setGoPubForm({ ...goPubForm, url: e.target.value })
                      }
                      onBlur={() => setGoPubUrlTouched(true)}
                      placeholder="https://..."
                      className="h-9"
                    />
                    {goPubUrlTouched && goPubUrlInvalid && (
                      <p className="text-xs" style={{ color: DANGER }}>
                        请输入有效的 http/https 链接
                      </p>
                    )}
                    {goPubUrlTouched &&
                      !goPubUrlInvalid &&
                      goPubUrlSuspicious && (
                        <p className="text-xs" style={{ color: WARNING }}>
                          疑似测试发布链接，请填真实发布地址
                        </p>
                      )}
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">发布日期</label>
                    <Input
                      type="date"
                      value={goPubForm.publishedAt.slice(0, 10)}
                      onChange={(e) =>
                        setGoPubForm({
                          ...goPubForm,
                          publishedAt: e.target.value,
                        })
                      }
                      className="h-9"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">备注</label>
                    <Textarea
                      value={goPubForm.remark}
                      onChange={(e) =>
                        setGoPubForm({ ...goPubForm, remark: e.target.value })
                      }
                      placeholder="选填"
                      rows={3}
                    />
                  </div>
                </>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setGoPubItem(null)}>
                取消
              </Button>
              <Button
                style={{ backgroundColor: PRIMARY }}
                disabled={
                  goPubMutation.isPending ||
                  (goPubForm.publishMethod === 'manual' && (!goPubForm.url || goPubUrlInvalid)) ||
                  (goPubForm.publishMethod === 'client' && !goPubForm.accountId)
                }
                onClick={handleGoPubSave}
              >
                {goPubMutation.isPending
                  ? '提交中...'
                  : goPubForm.publishMethod === 'client'
                    ? '下发至客户端'
                    : '保存登记'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* 平台账号 - 查看稿件抽屉 */}
        <Drawer
          open={!!publishViewingItem}
          onOpenChange={(open: boolean) => {
            if (!open) setPublishViewingItem(null);
          }}
        >
          <DrawerContent className="max-h-[85vh]">
            <DrawerHeader>
              <DrawerTitle>查看稿件</DrawerTitle>
              <DrawerDescription>
                {publishViewingItem &&
                  `${getPlatformLabel(publishViewingItem.channelPlatform)} · ${
                    publishViewingItem.channelName || '未分配渠道'
                  }`}
              </DrawerDescription>
            </DrawerHeader>
            <div className="px-6 pb-6 overflow-y-auto flex-1">
              {publishViewingItem ? (
                <div className="space-y-4">
                  <div>
                    <h3 className="text-lg font-semibold">
                      {publishViewingItem.title}
                    </h3>
                    <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                      <Badge variant="outline">
                        {getPubViewingWordCount()} 字
                      </Badge>
                      <span>
                        创建于 {formatDateTime(publishViewingItem.createdAt)}
                      </span>
                      {publishViewingItem.channelName && (
                        <span>目标渠道：{publishViewingItem.channelName}</span>
                      )}
                    </div>
                    {/* 占位链接 & 失败原因 */}
                    <div className="grid grid-cols-1 gap-2 text-xs">
                      {publishViewingItem.publishUrl ? (
                        <div className="flex items-start gap-2">
                          <span className="text-muted-foreground shrink-0">发布链接：</span>
                          <UniversalLink
                            to={publishViewingItem.publishUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="hover:underline break-all"
                            style={{ color: PRIMARY }}
                          >
                            {publishViewingItem.publishUrl}
                          </UniversalLink>
                        </div>
                      ) : null}
                      {publishViewingItem.error ? (
                        <div className="flex items-start gap-2">
                          <span className="text-muted-foreground shrink-0">失败原因：</span>
                          <span style={{ color: DANGER }}>
                            {publishViewingItem.error}
                          </span>
                        </div>
                      ) : null}
                    </div>
                  </div>
                  {publishViewingItem.tags.length > 0 && (
                    <div className="flex items-center gap-2 flex-wrap">
                      {publishViewingItem.tags.map(
                        (tag: string, i: number) => (
                          <Badge
                            key={i}
                            variant="secondary"
                            className="text-xs"
                          >
                            #{tag}
                          </Badge>
                        ),
                      )}
                    </div>
                  )}
                  {pubViewingLoading ? (
                    <div className="space-y-3">
                      <Skeleton className="h-4 w-full" />
                      <Skeleton className="h-4 w-5/6" />
                      <Skeleton className="h-4 w-4/6" />
                      <Skeleton className="h-4 w-full" />
                      <Skeleton className="h-4 w-3/4" />
                    </div>
                  ) : pubViewingError ? (
                    <div className="rounded-md border p-6 text-center space-y-3">
                      <p className="text-sm text-muted-foreground">
                        读取正文失败
                      </p>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => pubViewingRefetch()}
                      >
                        点击重试
                      </Button>
                    </div>
                  ) : !publishViewingItem?.articleId ? (
                    <div className="rounded-md border p-6 text-center space-y-2">
                      <p className="text-sm font-medium">
                        该稿件为手动入队记录，未关联文章，无法读取正文
                      </p>
                      <p className="text-xs text-muted-foreground">
                        请在文章库选择文章后重新入队，或直接使用下方「复制标题」
                      </p>
                    </div>
                  ) : !getPubViewingContent() ? (
                    <div className="rounded-md border p-6 text-center">
                      <p className="text-sm text-muted-foreground">
                        文章正文为空
                      </p>
                    </div>
                  ) : (
                    <div className="rounded-md border p-4 bg-muted/20">
                      <Markdown>{getPubViewingContent()}</Markdown>
                    </div>
                  )}
                </div>
              ) : null}
            </div>
            <DrawerFooter className="flex-row justify-end gap-2 pt-2 flex-wrap">
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  publishViewingItem &&
                  handleCopyFullText(
                    publishViewingItem.title,
                    getPubViewingContent(),
                  )
                }
                disabled={!publishViewingItem?.title && !getPubViewingContent()}
              >
                {getPubViewingContent() ? '复制全文' : '复制标题'}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  publishViewingItem &&
                  handleDownloadMd(
                    publishViewingItem.title,
                    getPubViewingContent(),
                  )
                }
                disabled={!getPubViewingContent()}
              >
                下载 .md
              </Button>
              <DrawerClose asChild>
                <Button variant="outline" size="sm">关闭</Button>
              </DrawerClose>
              {publishViewingItem?.status !== 'published' && (
                <Button
                  style={{ backgroundColor: PRIMARY }}
                  size="sm"
                  onClick={() => {
                    openGoPublish(publishViewingItem);
                    setPublishViewingItem(null);
                  }}
                >
                  <Send className="h-4 w-4" />
                  去发布
                </Button>
              )}
            </DrawerFooter>
          </DrawerContent>
        </Drawer>

        {/* ================ 信源库弹窗 ================ */}

        {/* 标记已收录弹窗 */}
        <Dialog
          open={!!indexedItem}
          onOpenChange={(v) => !v && setIndexedItem(null)}
        >
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>标记已收录</DialogTitle>
              <DialogDescription>
                填写收录链接和时间，用于记录发布结果
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

        {/* 标记未收录弹窗 */}
        <Dialog
          open={!!rejectedItem}
          onOpenChange={(v) => !v && setRejectedItem(null)}
        >
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>标记未收录</DialogTitle>
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

        {/* 占位 - 查看稿件抽屉 */}
        <Drawer
          open={!!subViewingItem}
          onOpenChange={(open: boolean) => {
            if (!open) setSubViewingItem(null);
          }}
        >
          <DrawerContent className="max-h-[85vh]">
            <DrawerHeader>
              <DrawerTitle>查看稿件</DrawerTitle>
              <DrawerDescription>
                {subViewingItem &&
                  `${subViewingItem.channelName} · ${getChannelTypeLabel(
                    subViewingItem.channelType,
                  )}`}
              </DrawerDescription>
            </DrawerHeader>
            <div className="px-6 pb-6 overflow-y-auto flex-1">
              {subViewingItem && (
                <div className="space-y-4">
                  <div>
                    <h3 className="text-lg font-semibold">
                      {subViewingItem.title}
                    </h3>
                    <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                      <Badge variant="outline">
                        {subViewingItem.wordCount} 字
                      </Badge>
                      <span>{formatDate(subViewingItem.createdAt)}</span>
                      <span>
                        {getBrandName(subViewingItem.brandId)}
                      </span>
                      {subViewingItem.channelName && (
                        <span>目标渠道：{subViewingItem.channelName}</span>
                      )}
                    </div>
                  </div>
                  {subViewingItem.tags.length > 0 && (
                    <div className="flex items-center gap-2 flex-wrap">
                      {subViewingItem.tags.map((tag: string, i: number) => (
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
                  {/* 正文区 */}
                  <div className="rounded-md border p-4 bg-muted/10 min-h-[200px]">
                    {subViewingItem.articleId ? (
                      viewingArticleLoading ? (
                        <div className="space-y-2">
                          {Array.from({ length: 8 }).map((_, i) => (
                            <Skeleton
                              key={i}
                              className="h-4"
                              style={{
                                width: `${70 + ((i * 13) % 30)}%`,
                              }}
                            />
                          ))}
                        </div>
                      ) : viewingArticleError ? (
                        <div className="flex flex-col items-center justify-center py-8 gap-3">
                          <AlertCircle
                            className="h-6 w-6"
                            style={{ color: DANGER }}
                          />
                          <span className="text-sm text-muted-foreground">
                            读取正文失败
                          </span>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => refetchViewingArticle()}
                          >
                            <RefreshCw className="h-3.5 w-3.5" />
                            点击重试
                          </Button>
                        </div>
                      ) : (
                        <Markdown className="prose prose-sm max-w-none">
                          {viewingArticle?.content || ''}
                        </Markdown>
                      )
                    ) : (
                      <Markdown className="prose prose-sm max-w-none">
                        {subViewingItem.content || '（暂无正文内容）'}
                      </Markdown>
                    )}
                  </div>
                </div>
              )}
            </div>
            <DrawerFooter className="flex-row justify-between items-center pt-2">
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    subViewingItem &&
                    handleCopyFullText(
                      subViewingItem.title,
                      getSubViewingContent(),
                    )
                  }
                >
                  <Copy className="h-3.5 w-3.5" />
                  复制全文
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    subViewingItem &&
                    handleDownloadMd(
                      subViewingItem.title,
                      getSubViewingContent(),
                    )
                  }
                >
                  <Download className="h-3.5 w-3.5" />
                  下载 .md
                </Button>
              </div>
              <div className="flex items-center gap-2">
                <DrawerClose asChild>
                  <Button variant="outline">关闭</Button>
                </DrawerClose>
                {(subViewingItem?.status === 'pending' ||
                  subViewingItem?.status === 'submitted') && (
                  <Button
                    style={{ backgroundColor: PRIMARY }}
                    onClick={() => {
                      if (subViewingItem) {
                        openSubPublishDialog(subViewingItem);
                        setSubViewingItem(null);
                      }
                    }}
                  >
                    <Send className="h-4 w-4" />
                    去发布
                  </Button>
                )}
              </div>
            </DrawerFooter>
          </DrawerContent>
        </Drawer>

        {/* 从创作历史选稿弹窗 */}
        <Dialog
          open={selectDialogOpen}
          onOpenChange={(v) => !v && setSelectDialogOpen(false)}
        >
          <DialogContent className="sm:max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
            <DialogHeader>
              <DialogTitle>
                {selectStep === 'articles' ? '选择文章' : '选择信源库渠道'}
              </DialogTitle>
              <DialogDescription>
                {selectStep === 'articles'
                  ? '从创作历史中勾选需要发布的文章'
                  : '选择目标信源库渠道，将为每篇文章×每个渠道创建发布任务'}
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
                                onCheckedChange={() => toggleArticleSelect(a.id)}
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
                          articlePage >= Math.ceil(articlesData.total / 10)
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
                <div className="grid grid-cols-4 gap-2 p-3 border-b bg-gray-50">
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">库类型</label>
                    <Select value={channelFilterLibraryType} onValueChange={setChannelFilterLibraryType}>
                      <SelectTrigger className="h-8">
                        <SelectValue placeholder="全部" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">全部</SelectItem>
                        {SUBMISSION_LIBRARY_TYPES.map((t) => (
                          <SelectItem key={t} value={t}>
                            {SUBMISSION_LIBRARY_TYPE_LABELS[t]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">地区</label>
                    <Select value={channelFilterRegion} onValueChange={setChannelFilterRegion}>
                      <SelectTrigger className="h-8">
                        <SelectValue placeholder="全部" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">全部</SelectItem>
                        {SUBMISSION_REGIONS.map((r) => (
                          <SelectItem key={r} value={r}>
                            {r}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">AI信源平台</label>
                    <AiSourcePlatformSelect
                      selected={channelFilterAiPlatforms as any[]}
                      onChange={setChannelFilterAiPlatforms as any}
                      size="sm"
                    />
                  </div>
                  <div className="col-span-4 flex items-center justify-end pt-1">
                    <button
                      type="button"
                      onClick={() => setAutoSelectDialogOpen(true)}
                      className="text-xs font-medium hover:underline"
                      style={{ color: PRIMARY }}
                    >
                      按标签自动选源
                    </button>
                  </div>
                </div>
                {filteredSubChannelOptions.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-10">
                          <Checkbox
                            checked={filteredSubChannelOptions.length > 0 &&
                              filteredSubChannelOptions.every((c) =>
                                selectedChannelIds.has(c.id),
                              )
                            }
                            onCheckedChange={(checked) => {
                              if (checked) {
                                const filteredIds = new Set(filteredSubChannelOptions.map((c) => c.id));
                                const merged = new Set(selectedChannelIds);
                                filteredIds.forEach((id) => merged.add(id));
                                setSelectedChannelIds(merged);
                              } else {
                                const filteredIds = new Set(filteredSubChannelOptions.map((c) => c.id));
                                const remaining = new Set(selectedChannelIds);
                                filteredIds.forEach((id) => remaining.delete(id));
                                setSelectedChannelIds(remaining);
                              }
                            }}
                            aria-label="全选当前筛选渠道"
                          />
                        </TableHead>
                        <TableHead>渠道名称</TableHead>
                        <TableHead className="w-28">渠道类型</TableHead>
                        <TableHead className="w-24">状态</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredSubChannelOptions.map((c: SubmissionChannel) => (
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
                    {subChannelOptions.length === 0
                      ? '暂无可用的信源库渠道'
                      : '没有匹配的渠道，请调整筛选条件'}
                  </div>
                )}
              </div>
            )}
            <AutoSelectDialog
              open={autoSelectDialogOpen}
              onOpenChange={setAutoSelectDialogOpen}
              defaultBrandId={isClient ? user?.brandId : subBrandFilter}
              isClient={isClient}
              onConfirm={(ids) => {
                setSelectedChannelIds(new Set(ids));
              }}
            />

            <DialogFooter className="flex items-center justify-between">
              <div className="text-xs text-muted-foreground">
                {selectStep === 'articles'
                  ? `已选 ${selectedArticleIds.size} 篇文章`
                  : `已选 ${selectedChannelIds.size} 个渠道，将创建 ${
                      selectedArticleIds.size * selectedChannelIds.size
                      } 条发布任务`}
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
                    {enqueueBatchMutation.isPending
                      ? '提交中...'
                      : '确认提交'}
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

/* ================================================================ */
/* ---------------- 辅助组件 --------------------------------------- */
/* ================================================================ */

const PublishTableSkeleton = () => (
  <div className="space-y-2 rounded-md border p-4">
    {Array.from({ length: 8 }).map((_, i) => (
      <div key={i} className="flex items-center gap-4">
        <Skeleton className="h-4 w-4" />
        <Skeleton className="h-4 flex-1" />
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-4 w-12" />
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-4 w-12" />
        <Skeleton className="h-4 w-12" />
        <Skeleton className="h-4 w-48" />
      </div>
    ))}
  </div>
);

const PublishEmptyState: React.FC<{ status: string }> = ({ status }) => {
  const navigate = useNavigate();
  const label = status
    ? PUBLISH_QUEUE_STATUS_LABELS[
        status as keyof typeof PUBLISH_QUEUE_STATUS_LABELS
      ] || ''
    : '';
  return (
    <EmptyState
      icon={<FileText />}
      description={`当前${label}状态下暂无发布任务`}
      action={
        <Button size="sm" style={{ backgroundColor: PRIMARY }} onClick={() => navigate('/publish?tab=records')}>
          <Plus className="h-3.5 w-3.5" />
          去发稿
        </Button>
      }
    />
  );
};

const SubmissionTableSkeleton = () => (
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

const SubmissionEmptyState: React.FC<{ onAdd: () => void }> = ({ onAdd }) => {
  return (
    <EmptyState
      icon={<FileText />}
      description="从创作历史中选择稿件加入发布队列"
      action={
        <Button size="sm" onClick={onAdd} style={{ backgroundColor: PRIMARY }}>
          <Plus className="h-3.5 w-3.5" />
          从创作历史选稿
        </Button>
      }
    />
  );
};

export default PublishQueuePage;
