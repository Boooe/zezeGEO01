import React, { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import dayjs from 'dayjs';
import {
  Plus,
  Search,
  Pencil,
  Trash2,
  Play,
  Pause,
  RefreshCw,
  AlertCircle,
  Calendar as CalendarIcon,
  Check,
  ChevronDown,
} from 'lucide-react';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';

import { Button } from '@client/src/components/ui/button';
import { TableShell } from '@client/src/components/ui/table-shell';
import { Input } from '@client/src/components/ui/input';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@client/src/components/ui/popover';
import { Calendar } from '@client/src/components/ui/calendar';
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
import { Skeleton } from '@client/src/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@client/src/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@client/src/components/ui/alert-dialog';

import { Badge } from '@client/src/components/ui/badge';
import { Pill } from '@client/src/components/layout/Pill';
import { PageHeader } from '@client/src/components/layout/PageHeader';
import { Checkbox } from '@client/src/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@client/src/components/ui/radio-group';
import { Label } from '@client/src/components/ui/label';

import { AiSourcePlatformSelect } from '@client/src/components/publication/AiSourcePlatformSelect';
import { AutoSelectDialog } from '@client/src/components/publication/AutoSelectDialog';

import {
  getAutoPublishTasks,
  createAutoPublishTask,
  updateAutoPublishTask,
  deleteAutoPublishTask,
  toggleAutoPublishTaskStatus,
  type GetAutoPublishTasksParams,
} from '@client/src/api/publication';
import { getArticles } from '@client/src/api/content';
import { getBrands } from '@client/src/api/brands';
import { list as listAccountAuths } from '@client/src/api/account-auths';
import { getCreditAccountDetail } from '@client/src/api/creation';
import * as submissionChannelsApi from '@client/src/api/submission-channels';
import { listMarketChannels } from '@client/src/api/media-market';
import { useWallet } from '@client/src/api/media-wallet';
import {
  AUTO_PUBLISH_STATUS,
  AUTO_PUBLISH_STATUS_LABELS,
  AUTO_PUBLISH_LIBRARY,
  AUTO_PUBLISH_LIBRARY_LABELS,
  CHANNEL_SOURCE,
  CHANNEL_SOURCE_LABELS,
  ARTICLE_TYPE_LABELS,
  SUBMISSION_CHANNEL_TYPE_LABELS,
  SUBMISSION_LIBRARY_TYPES,
  SUBMISSION_LIBRARY_TYPE_LABELS,
  SUBMISSION_REGIONS,
  SUBMISSION_AI_SOURCES,
  SUBMISSION_AI_SOURCE_LABELS,
  SUBMISSION_INDUSTRIES,
  SUBMISSION_INDUSTRY_LABELS,
  SUBMISSION_MEDIA_TYPES,
  SUBMISSION_MEDIA_TYPE_LABELS,
} from '@shared/api.interface';
import type {
  AutoPublishTask,
  AutoPublishStatus,
  AutoPublishLibrary,
  Article,
  SubmissionChannel,
  SubmissionChannelType,
  SubmissionLibraryType,
  CreateAutoPublishTaskRequest,
  MarketChannel,
  ChannelSource,
} from '@shared/api.interface';
import { useAuth } from '@client/src/contexts/AuthContext';

const PRIMARY = '#2563EB';
const DANGER = '#DC2626';
const SUCCESS = '#16A34A';
const MUTED = '#94A3B8';
const WARNING = '#F59E0B';
const BORDER = '#E6EAF2';

const STATUS_PILL_VARIANT: Record<AutoPublishStatus, 'success' | 'warning' | 'danger' | 'info' | 'muted'> = {
  running: 'info',
  paused: 'warning',
  stopped: 'muted',
  completed: 'success',
};

type TabValue = 'tasks' | 'records';

const AutoPublishPage: React.FC = () => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isClient = user?.role === 'client';

  const [activeTab, setActiveTab] = useState<TabValue>('tasks');

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [brandId, setBrandId] = useState<string>(user?.brandId ?? '');
  const [status, setStatus] = useState<string>('');
  const [keyword, setKeyword] = useState<string>('');
  const [searchText, setSearchText] = useState<string>('');

  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<AutoPublishTask | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AutoPublishTask | null>(null);

  /* ---------- Queries ---------- */
  const {
    data: tasksData,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: [
      'autoPublish',
      'tasks',
      page,
      pageSize,
      brandId,
      status,
      searchText,
    ],
    queryFn: (): Promise<{
      items: AutoPublishTask[];
      total: number;
      page: number;
      pageSize: number;
    }> => {
      const params: GetAutoPublishTasksParams = {
        page,
        pageSize,
        keyword: searchText || undefined,
      };
      if (brandId) params.brandId = brandId;
      if (status) params.status = status as AutoPublishStatus;
      return getAutoPublishTasks(params) as unknown as Promise<{
        items: AutoPublishTask[];
        total: number;
        page: number;
        pageSize: number;
      }>;
    },
    retry: 2,
    retryDelay: 2000,
    enabled: activeTab === 'tasks',
  });

  const { data: brandOptions = [] } = useQuery({
    queryKey: ['brands', 'options'],
    queryFn: () => getBrands(),
    retry: 2,
    retryDelay: 2000,
    enabled: !isClient,
  });

  const totalPages = useMemo(() => {
    if (!tasksData) return 1;
    return Math.max(1, Math.ceil(tasksData.total / pageSize));
  }, [tasksData, pageSize]);

  /* ---------- Mutations ---------- */
  const createMutation = useMutation({
    mutationFn: (body: CreateAutoPublishTaskRequest) =>
      createAutoPublishTask(body),
    retry: false,
    onSuccess: (data, body) => {
      queryClient.invalidateQueries({ queryKey: ['autoPublish'] });
      queryClient.invalidateQueries({ queryKey: ['publishQueue'] });
      setCreateOpen(false);
      const msg = `任务已创建：自 ${body.startDate} 起，每日最多 ${body.dailyLimit} 篇`;
      const extras: string[] = [];
      if (body.accountId) extras.push('将由客户端自动领取并发布');
      if (data.excludedArticleCount && data.excludedArticleCount > 0) {
        extras.push(`另有 ${data.excludedArticleCount} 篇超出周期容量，未排入队列`);
      }
      const extra = extras.join('；');
      toast.success(extra ? `${msg}；${extra}` : msg);
    },
    onError: (err: any) => {
      toast.error(
        err?.response?.data?.error?.message ??
          err?.message ??
          '创建失败，请重试',
      );
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({
      id,
      body,
    }: {
      id: string;
      body: Partial<CreateAutoPublishTaskRequest>;
    }) => updateAutoPublishTask(id, body),
    retry: false,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['autoPublish'] });
      setEditing(null);
      toast.success('更新成功');
    },
    onError: (err: any) => {
      toast.error(
        err?.response?.data?.error?.message ??
          err?.message ??
          '更新失败，请重试',
      );
    },
  });

  const toggleStatusMutation = useMutation({
    mutationFn: ({
      id,
      status,
    }: {
      id: string;
      status: AutoPublishStatus;
    }) => toggleAutoPublishTaskStatus(id, status),
    retry: false,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['autoPublish'] });
      toast.success('操作成功');
    },
    onError: (err: any) => {
      toast.error(
        err?.response?.data?.error?.message ??
          err?.message ??
          '操作失败，请重试',
      );
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteAutoPublishTask(id),
    retry: false,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['autoPublish'] });
      setDeleteTarget(null);
      toast.success('删除成功');
    },
    onError: (err: any) => {
      toast.error(
        err?.response?.data?.error?.message ??
          err?.message ??
          '删除失败，请重试',
      );
    },
  });

  const handleSearch = () => {
    setSearchText(keyword.trim());
    setPage(1);
  };

  const handlePageSizeChange = (size: number) => {
    setPageSize(size);
    setPage(1);
  };

  const handleTabChange = (value: string) => {
    if (value === 'records') {
      navigate('/publish/records');
      return;
    }
    setActiveTab(value as TabValue);
  };

  const formatDate = (dateStr: string): string => {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };

  const formatDateTime = (dateStr: string): string => {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  };

  const openCreate = () => {
    setEditing(null);
    setCreateOpen(true);
  };

  const openEdit = (task: AutoPublishTask) => {
    setEditing(task);
  };

  return (
    <div className="space-y-5" style={{ backgroundColor: '#f8fafc' }}>
      <PageHeader
        title="自动发布"
        subtitle="设置定时发布计划，自动将文章分发到各渠道"
        actions={
          <Button
            size="sm"
            onClick={openCreate}
          >
            <Plus className="h-3.5 w-3.5" />
            新建任务
          </Button>
        }
      />

      {activeTab === 'tasks' && (
        <TableShell
          title="自动发布任务"
          description="设置定时发布计划，自动将文章分发到各渠道"
          headerActions={
            <Button
              size="sm"
              onClick={openCreate}
            >
              <Plus className="h-3.5 w-3.5" />
              新建任务
            </Button>
          }
          filterBar={
            <>
              {!isClient && (
                <div className="w-40">
                  <Select
                    value={brandId}
                    onValueChange={(v) => {
                      setBrandId(v);
                      setPage(1);
                    }}
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
                  value={status}
                  onValueChange={(v) => {
                    setStatus(v);
                    setPage(1);
                  }}
                >
                  <SelectTrigger className="w-full h-9">
                    <SelectValue placeholder="全部状态" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">全部状态</SelectItem>
                    {AUTO_PUBLISH_STATUS.map((s) => (
                      <SelectItem key={s} value={s}>
                        {AUTO_PUBLISH_STATUS_LABELS[s]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="relative w-[260px]">
                <Search
                  className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4"
                  style={{ color: MUTED }}
                />
                <Input
                  placeholder="搜索任务名称"
                  value={keyword}
                  onChange={(e) => setKeyword(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  className="pl-9 h-9"
                />
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={handleSearch}
                className="h-9"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                查询
              </Button>
            </>
          }
          data={tasksData?.items ?? []}
          isLoading={isLoading}
          isEmpty={!isLoading && (!tasksData || tasksData.items.length === 0)}
          emptyTitle="暂无自动发布任务"
          emptyDescription="创建任务后，系统将自动从素材库选取文章并发布"
          emptyAction={{ label: '新建任务', onClick: openCreate }}
          total={tasksData?.total ?? 0}
          page={page}
          pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={handlePageSizeChange}
          pageSizeOptions={[10, 20, 50]}
        >
          {isError ? (
            <div className="flex items-center justify-between rounded-lg border border-amber-200 bg-amber-50 p-4 mb-3">
              <div
                className="flex items-center gap-2 text-sm"
                style={{ color: '#b45309' }}
              >
                <AlertCircle className="h-4 w-4" />
                <span>数据加载失败，请稍后重试</span>
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
            <Table style={{ minWidth: '1220px' }}>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[80px]">序号</TableHead>
                  <TableHead className="min-w-[240px]">任务名称</TableHead>
                  <TableHead className="min-w-[120px]">品牌</TableHead>
                  <TableHead className="min-w-[110px]">渠道来源</TableHead>
                  <TableHead className="min-w-[140px]">媒体库类型</TableHead>
                  <TableHead className="min-w-[100px] text-right tnum">文章数量</TableHead>
                  <TableHead className="min-w-[180px]">进度</TableHead>
                  <TableHead className="min-w-[100px] text-right tnum">每日上限</TableHead>
                  <TableHead className="min-w-[180px]">周期</TableHead>
                  <TableHead className="min-w-[100px]">状态</TableHead>
                  <TableHead className="min-w-[100px]">选源方式</TableHead>
                  <TableHead className="min-w-[140px]">创建时间</TableHead>
                  <TableHead className="w-[132px] text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tasksData?.items.map(
                  (task: AutoPublishTask, i: number) => {
                    const progress =
                      task.totalCount > 0
                        ? Math.round(
                            (task.publishedCount / task.totalCount) *
                              100,
                          )
                        : 0;
                    return (
                      <TableRow key={task.id}>
                        <TableCell className="min-w-[80px] text-muted-foreground text-sm">
                          {(page - 1) * pageSize + i + 1}
                        </TableCell>
                        <TableCell className="min-w-[240px] font-medium">
                          <div
                            className="line-clamp-2"
                            title={task.taskName}
                          >
                            {task.taskName}
                          </div>
                        </TableCell>
                        <TableCell className="min-w-[120px] text-sm">
                          {task.brandName}
                        </TableCell>
                        <TableCell className="min-w-[110px] text-sm">
                          {CHANNEL_SOURCE_LABELS[
                            ((task as AutoPublishTask & { channelSource?: ChannelSource })
                              .channelSource ?? 'self_media') as ChannelSource
                          ] ?? '自媒体账号'}
                        </TableCell>
                        <TableCell className="min-w-[140px] text-sm">
                          {
                            AUTO_PUBLISH_LIBRARY_LABELS[
                              task.libraryType
                            ]
                          }
                        </TableCell>
                        <TableCell className="min-w-[100px] text-right tnum text-sm">
                          {task.totalCount}
                        </TableCell>
                        <TableCell className="min-w-[180px]">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                <div
                                  className="h-full rounded-full transition-all"
                                  style={{
                                    width: `${progress}%`,
                                    backgroundColor: PRIMARY,
                                  }}
                                />
                              </div>
                              <span className="text-xs text-muted-foreground tnum whitespace-nowrap">
                                {task.publishedCount}/{task.totalCount}
                              </span>
                            </div>
                            <div className="text-xs text-muted-foreground leading-tight">
                              进度 = 已完成发布 / 计划总篇数，收录取到后更新
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="min-w-[100px] text-right tnum text-sm">
                          {task.dailyLimit}
                        </TableCell>
                        <TableCell className="min-w-[180px] text-sm">
                          <span className="text-muted-foreground">
                            {formatDate(task.startDate)} ~{' '}
                            {formatDate(task.endDate)}
                          </span>
                        </TableCell>
                        <TableCell className="min-w-[100px]">
                          <div className="space-y-1">
                            <Pill variant={STATUS_PILL_VARIANT[task.status]}>
                              {AUTO_PUBLISH_STATUS_LABELS[task.status]}
                            </Pill>
                            {task.status === 'running' && (
                              <div className="text-xs text-muted-foreground leading-tight">
                                按每日上限 {task.dailyLimit} 篇/日 运行中
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="min-w-[100px]">
                          {task.sourceSelectionMode === 'auto' ? (
                            <div
                              className="inline-block cursor-help text-xs font-medium"
                              style={{ color: PRIMARY }}
                              title={
                                task.sourceRule
                                  ? [
                                      task.sourceRule.platforms?.map((p) => SUBMISSION_AI_SOURCE_LABELS[p as keyof typeof SUBMISSION_AI_SOURCE_LABELS] || p).join('/') || '',
                                      task.sourceRule.region || '全部地区',
                                      task.sourceRule.industry ? SUBMISSION_INDUSTRY_LABELS[task.sourceRule.industry as keyof typeof SUBMISSION_INDUSTRY_LABELS] || task.sourceRule.industry : '全部行业',
                                      task.sourceRule.mediaType ? SUBMISSION_MEDIA_TYPE_LABELS[task.sourceRule.mediaType as keyof typeof SUBMISSION_MEDIA_TYPE_LABELS] || task.sourceRule.mediaType : '',
                                      task.sourceRule.budgetMax ? `¥${task.sourceRule.budgetMax}` : '',
                                    ].filter(Boolean).join(' · ')
                                  : ''
                              }
                            >
                              自动
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">手工</span>
                          )}
                        </TableCell>
                        <TableCell className="min-w-[140px] text-sm text-muted-foreground">
                          {formatDateTime(task.createdAt)}
                        </TableCell>
                        <TableCell className="w-[132px] text-right">
                          <div className="flex items-center justify-end gap-1">
                            {task.status === 'running' ? (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 px-2 text-xs"
                                onClick={() =>
                                  toggleStatusMutation.mutate({
                                    id: task.id,
                                    status: 'paused',
                                  })
                                }
                                style={{ color: WARNING }}
                              >
                                <Pause className="h-3 w-3" />
                                暂停
                              </Button>
                            ) : task.status === 'paused' ? (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 px-2 text-xs"
                                onClick={() =>
                                  toggleStatusMutation.mutate({
                                    id: task.id,
                                    status: 'running',
                                  })
                                }
                                style={{ color: PRIMARY }}
                              >
                                <Play className="h-3 w-3" />
                                继续
                              </Button>
                            ) : null}
                            {task.status !== 'completed' &&
                              task.status !== 'stopped' && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-7 px-2 text-xs"
                                  onClick={() => openEdit(task)}
                                  style={{ color: PRIMARY }}
                                >
                                  <Pencil className="h-3 w-3" />
                                  编辑
                                </Button>
                              )}
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 px-2 text-xs"
                              style={{ color: DANGER }}
                              onClick={() => setDeleteTarget(task)}
                            >
                              <Trash2 className="h-3 w-3" />
                              删除
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  },
                )}
              </TableBody>
            </Table>
          )}
        </TableShell>
      )}

      {/* 新建任务弹窗 */}
      <TaskFormDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        mode="create"
        initialBrandId={user?.brandId ?? ''}
        isClient={isClient}
        onSubmit={(data) => createMutation.mutate(data)}
        isPending={createMutation.isPending}
      />

      {/* 编辑任务弹窗 */}
      {editing && (
        <TaskFormDialog
          open={!!editing}
          onOpenChange={(v) => !v && setEditing(null)}
          mode="edit"
          task={editing}
          isClient={isClient}
          onSubmit={(data) =>
            updateMutation.mutate({ id: editing.id, body: data })
          }
          isPending={updateMutation.isPending}
        />
      )}

      {/* 删除确认 */}
      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(v) => !v && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除</AlertDialogTitle>
            <AlertDialogDescription>
              确定要删除任务「{deleteTarget?.taskName}」吗？该任务下尚未发布的发布项会一并从队列移除，已收录并引用的记录不受影响。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={() =>
                deleteTarget && deleteMutation.mutate(deleteTarget.id)
              }
              style={{ backgroundColor: DANGER }}
            >
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

/* ---------- 任务表单弹窗 ---------- */

interface TaskFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: 'create' | 'edit';
  task?: AutoPublishTask;
  initialBrandId?: string;
  isClient: boolean;
  onSubmit: (data: CreateAutoPublishTaskRequest) => void;
  isPending: boolean;
}

const TaskFormDialog: React.FC<TaskFormDialogProps> = ({
  open,
  onOpenChange,
  mode,
  task,
  initialBrandId = '',
  isClient,
  onSubmit,
  isPending,
}) => {
  const [form, setForm] = useState<CreateAutoPublishTaskRequest>(() => {
    if (mode === 'edit' && task) {
      const taskWithExt = task as AutoPublishTask & {
        channelSource?: ChannelSource;
        marketChannelIds?: string[];
        budgetCents?: number | null;
        publishIntervalMinutes?: number | null;
      };
      return {
        brandId: task.brandId,
        taskName: task.taskName,
        libraryType: task.libraryType,
        channelIds: [...task.channelIds],
        articleIds: [...task.articleIds],
        startDate: task.startDate,
        endDate: task.endDate,
        dailyLimit: task.dailyLimit,
        accountId: (task as unknown as { accountId?: string }).accountId ?? '',
        sourceSelectionMode: task.sourceSelectionMode || 'manual',
        sourceRule: task.sourceRule || undefined,
        channelSource: taskWithExt.channelSource ?? 'self_media',
        marketChannelIds: taskWithExt.marketChannelIds ?? [],
        budgetCents: taskWithExt.budgetCents ?? undefined,
        publishIntervalMinutes:
          taskWithExt.publishIntervalMinutes ?? undefined,
      };
    }
    return {
      brandId: initialBrandId || undefined,
      taskName: '',
      libraryType: 'public',
      channelIds: [],
      articleIds: [],
      startDate: '',
      endDate: '',
      dailyLimit: 10,
      accountId: '',
      sourceSelectionMode: 'manual',
      sourceRule: undefined,
      channelSource: 'self_media',
      marketChannelIds: [],
      budgetCents: undefined,
      publishIntervalMinutes: 30,
    };
  });

  const [articleBrandId, setArticleBrandId] = useState<string>(
    mode === 'edit' && task ? task.brandId : initialBrandId,
  );
  const [articleKeyword, setArticleKeyword] = useState('');
  const [articlePage, setArticlePage] = useState(1);
  const [startOpen, setStartOpen] = useState(false);
  const [endOpen, setEndOpen] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const navigate = useNavigate();

  const { data: accountAuthsData } = useQuery({
    queryKey: ['accountAuths', 'autoPublish', form.brandId],
    queryFn: () =>
      listAccountAuths({
        brandId: form.brandId,
        pageSize: 100,
      }),
    retry: 2,
    retryDelay: 2000,
    enabled: !!form.brandId,
  });

  // 重置表单
  React.useEffect(() => {
    if (open) {
      if (mode === 'edit' && task) {
        const taskWithExt = task as AutoPublishTask & {
          channelSource?: ChannelSource;
          marketChannelIds?: string[];
          budgetCents?: number | null;
          publishIntervalMinutes?: number | null;
        };
        setForm({
          brandId: task.brandId,
          taskName: task.taskName,
          libraryType: task.libraryType,
          channelIds: [...task.channelIds],
          articleIds: [...task.articleIds],
          startDate: task.startDate,
          endDate: task.endDate,
          dailyLimit: task.dailyLimit,
          accountId: (task as unknown as { accountId?: string }).accountId ?? '',
          sourceSelectionMode: task.sourceSelectionMode || 'manual',
          sourceRule: task.sourceRule || undefined,
          channelSource: taskWithExt.channelSource ?? 'self_media',
          marketChannelIds: taskWithExt.marketChannelIds ?? [],
          budgetCents: taskWithExt.budgetCents ?? undefined,
          publishIntervalMinutes:
            taskWithExt.publishIntervalMinutes ?? undefined,
        });
        setArticleBrandId(task.brandId);
      } else {
        setForm({
          brandId: initialBrandId || undefined,
          taskName: '',
          libraryType: 'public',
          channelIds: [],
          articleIds: [],
          startDate: '',
          endDate: '',
          dailyLimit: 10,
          accountId: '',
        sourceSelectionMode: 'manual',
        sourceRule: undefined,
          channelSource: 'self_media',
          marketChannelIds: [],
          budgetCents: undefined,
          publishIntervalMinutes: 30,
        });
        setArticleBrandId(initialBrandId);
      }
      setArticleKeyword('');
      setArticlePage(1);
      setFieldErrors({});
    }
  }, [open, mode, task, initialBrandId]);

  const [channelFilterLibraryType, setChannelFilterLibraryType] = useState('');
  const [channelFilterRegion, setChannelFilterRegion] = useState('');
  const [channelFilterIndustry, setChannelFilterIndustry] = useState('');
  const [channelFilterMediaType, setChannelFilterMediaType] = useState('');
  const [channelFilterAiPlatforms, setChannelFilterAiPlatforms] = useState<string[]>([]);
  const [autoSelectDialogOpen, setAutoSelectDialogOpen] = useState(false);

  /* ---------- 渠道列表 ---------- */
  const { data: channelData, isLoading: channelsLoading, isError: channelsError, refetch: refetchChannels } = useQuery({
    queryKey: ['channels', 'autoPublish', form.brandId, form.libraryType],
    queryFn: async (): Promise<Array<{ id: string; name: string; type: SubmissionChannelType; ownerType: 'platform' | 'brand'; libraryType: string; region: string; industries: string[]; aiPlatforms: string[]; mediaType: string }>> => {
      const res = await submissionChannelsApi.list({
        limit: 100,
        brandId: form.brandId || undefined,
        libraryType: form.libraryType,
      });
      return (res.items as unknown as SubmissionChannel[]).map((c) => ({
        id: c.id,
        name: c.name,
        type: c.channelType,
        ownerType: c.ownerType,
        libraryType: c.libraryType,
        region: c.region,
        industries: c.industries ?? [],
        aiPlatforms: c.aiPlatforms,
        mediaType: c.mediaType,
      }));
    },
    enabled: open && !!form.brandId,
    retry: 2,
    retryDelay: 2000,
  });

  const channelOptions = channelData ?? [];

  // 内存过滤后的渠道列表
  const filteredChannelOptions = useMemo(() => {
    return channelOptions.filter((c) => {
      if (channelFilterLibraryType && c.libraryType !== channelFilterLibraryType) return false;
      if (channelFilterRegion && c.region !== channelFilterRegion) return false;
      if (channelFilterIndustry && !c.industries?.includes(channelFilterIndustry)) return false;
      if (channelFilterMediaType && c.mediaType !== channelFilterMediaType) return false;
      if (channelFilterAiPlatforms.length > 0 && !c.aiPlatforms?.some((p) => channelFilterAiPlatforms.includes(p))) return false;
      return true;
    });
  }, [channelOptions, channelFilterLibraryType, channelFilterRegion, channelFilterIndustry, channelFilterMediaType, channelFilterAiPlatforms]);

  // 渠道按「名称 + 类型」分组，一组内可能有多个归属（品牌专属 / 服务商预置）
  const groupedChannelOptions = useMemo(() => {
    type ChannelOpt = { id: string; name: string; type: SubmissionChannelType; ownerType: 'platform' | 'brand'; libraryType: string; region: string; industries: string[]; aiPlatforms: string[]; mediaType: string };
    const map = new Map<string, {
      key: string;
      name: string;
      type: SubmissionChannelType;
      channels: ChannelOpt[];
      ownerTypes: Set<string>;
    }>();
    for (const ch of filteredChannelOptions) {
      const key = `${ch.name}|${ch.type}`;
      if (!map.has(key)) {
        map.set(key, {
          key,
          name: ch.name,
          type: ch.type,
          channels: [],
          ownerTypes: new Set(),
        });
      }
      const group = map.get(key)!;
      group.channels.push(ch);
      group.ownerTypes.add(ch.ownerType);
    }
    return Array.from(map.values());
  }, [filteredChannelOptions]);

  const selectedGroupCount = useMemo(() => {
    return groupedChannelOptions.filter((g) =>
      g.channels.every((ch) => form.channelIds.includes(ch.id)),
    ).length;
  }, [groupedChannelOptions, form.channelIds]);

  const toggleChannelGroup = (groupKey: string) => {
    const group = groupedChannelOptions.find((g) => g.key === groupKey);
    if (!group) return;
    const allSelected = group.channels.every((ch) =>
      form.channelIds.includes(ch.id),
    );
    setForm((prev) => {
      if (allSelected) {
        const ids = new Set(prev.channelIds);
        for (const ch of group.channels) ids.delete(ch.id);
        return { ...prev, channelIds: Array.from(ids) };
      } else {
        const ids = new Set(prev.channelIds);
        for (const ch of group.channels) ids.add(ch.id);
        return { ...prev, channelIds: Array.from(ids) };
      }
    });
    clearFieldError('channelIds');
  };

  /* ---------- 文章列表 ---------- */
  const { data: articlesData, isLoading: articlesLoading } = useQuery({
    queryKey: [
      'articles',
      'autoPublishSelector',
      articleBrandId,
      articleKeyword,
      articlePage,
    ],
    queryFn: (): Promise<{
      items: Article[];
      total: number;
      page: number;
      pageSize: number;
    }> =>
      getArticles({
        page: articlePage,
        pageSize: 10,
        brandId: articleBrandId || undefined,
        keyword: articleKeyword || undefined,
        status: 'draft',
      }) as unknown as Promise<{
        items: Article[];
        total: number;
        page: number;
        pageSize: number;
      }>,
    enabled: open,
    retry: 2,
    retryDelay: 2000,
  });

  const articleItems = articlesData?.items ?? [];
  const articleTotal = articlesData?.total ?? 0;
  const articleTotalPages = Math.max(1, Math.ceil(articleTotal / 10));

  const clearFieldError = (field: string) => {
    setFieldErrors((prev) => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  };

  const toggleChannel = (id: string) => {
    setForm((prev) => ({
      ...prev,
      channelIds: prev.channelIds.includes(id)
        ? prev.channelIds.filter((c) => c !== id)
        : [...prev.channelIds, id],
    }));
    clearFieldError('channelIds');
  };

  // 自动选源确认
  const handleAutoSelectConfirm = (channelIds: string[], rule: string) => {
    const ruleObj = JSON.parse(rule);
    setForm((prev) => ({
      ...prev,
      channelIds,
      sourceSelectionMode: 'auto',
      sourceRule: ruleObj,
    }));
    clearFieldError('channelIds');
  };

  /* ---------- 媒体商城渠道 ---------- */
  const [marketIndustry, setMarketIndustry] = useState<string>('');
  const [marketPriceMin, setMarketPriceMin] = useState<string>('');
  const [marketPriceMax, setMarketPriceMax] = useState<string>('');
  const [marketKeyword, setMarketKeyword] = useState<string>('');

  const marketChannelLibraryType = form.libraryType;

  const { data: marketChannelsData, isLoading: marketChannelsLoading } =
    useQuery({
      queryKey: [
        'autoPublish',
        'marketChannels',
        marketChannelLibraryType,
        marketIndustry,
        marketPriceMin,
        marketPriceMax,
        marketKeyword,
      ],
      queryFn: (): Promise<{
        items: MarketChannel[];
        total: number;
        page: number;
        pageSize: number;
      }> =>
        listMarketChannels({
          page: 1,
          pageSize: 50,
          industry: marketIndustry || undefined,
          priceMin: marketPriceMin
            ? Math.round(Number(marketPriceMin) * 100)
            : undefined,
          priceMax: marketPriceMax
            ? Math.round(Number(marketPriceMax) * 100)
            : undefined,
          keyword: marketKeyword || undefined,
          sortBy: 'price',
          sortOrder: 'asc',
        }) as unknown as Promise<{
          items: MarketChannel[];
          total: number;
          page: number;
          pageSize: number;
        }>,
      retry: false,
      enabled:
        open &&
        form.channelSource === 'market' &&
        !!marketChannelLibraryType,
    });

  const marketChannelItems = marketChannelsData?.items ?? [];

  const selectedMarketChannels = useMemo(() => {
    const ids = new Set(form.marketChannelIds ?? []);
    return marketChannelItems.filter((c) => ids.has(c.id));
  }, [marketChannelItems, form.marketChannelIds]);

  const selectedMarketTotalCents = useMemo(() => {
    return selectedMarketChannels.reduce(
      (sum, c) => sum + (c.salePriceCents ?? 0),
      0,
    );
  }, [selectedMarketChannels]);

  const estimatedBudgetCents = useMemo(() => {
    // 粗略预算 = 渠道单价之和 × 计划篇数（取 articleIds 数量，至少 1）
    const articleCount = Math.max(1, form.articleIds.length);
    return selectedMarketTotalCents * articleCount;
  }, [selectedMarketTotalCents, form.articleIds.length]);

  const toggleMarketChannel = (id: string) => {
    setForm((prev) => ({
      ...prev,
      marketChannelIds: prev.marketChannelIds?.includes(id)
        ? prev.marketChannelIds.filter((c) => c !== id)
        : [...(prev.marketChannelIds ?? []), id],
    }));
    clearFieldError('marketChannelIds');
  };

  /* ---------- 钱包余额 ---------- */
  const { data: walletData } = useWallet(
    form.channelSource === 'market' && form.brandId ? form.brandId : undefined,
  );

  const toggleArticle = (id: string) => {
    setForm((prev) => ({
      ...prev,
      articleIds: prev.articleIds.includes(id)
        ? prev.articleIds.filter((a) => a !== id)
        : [...prev.articleIds, id],
    }));
    clearFieldError('articleIds');
  };

  const { data: planLimitData } = useQuery({
    queryKey: ['credit-account-detail', form.brandId],
    queryFn: () => getCreditAccountDetail(form.brandId),
    enabled: !!form.brandId,
    retry: 2,
  });

  const planDailyLimit = planLimitData?.dailyPublishLimit ?? 10;
  const isOverLimit = form.dailyLimit > planDailyLimit;

  // 品牌变化时，如果是新建模式且当前 dailyLimit 超过新套餐上限，重置为套餐上限
  React.useEffect(() => {
    if (mode === 'create' && form.brandId && planLimitData) {
      setForm((prev) => ({
        ...prev,
        dailyLimit: Math.min(prev.dailyLimit, planLimitData.dailyPublishLimit),
      }));
    }
  }, [form.brandId, planLimitData, mode]);

  const handleSubmit = () => {
    if (!form.taskName.trim()) {
      setFieldErrors({ taskName: '请输入任务名称' });
      toast.error('请输入任务名称');
      return;
    }
    if (!form.brandId) {
      setFieldErrors({ brandId: '请选择品牌' });
      toast.error('请选择品牌');
      return;
    }
    if (form.channelSource === 'self_media') {
      if (form.channelIds.length === 0) {
        setFieldErrors({ channelIds: '请至少选择 1 个渠道' });
        toast.error('请至少选择 1 个渠道');
        return;
      }
    } else {
      if ((form.marketChannelIds?.length ?? 0) === 0) {
        setFieldErrors({ marketChannelIds: '请至少选择 1 个媒体商城渠道' });
        toast.error('请至少选择 1 个媒体商城渠道');
        return;
      }
      // 余额校验
      if (
        walletData?.balanceCents !== undefined &&
        walletData.balanceCents < estimatedBudgetCents
      ) {
        toast.error('钱包余额不足，请先充值');
        return;
      }
    }
    if (form.articleIds.length === 0) {
      setFieldErrors({ articleIds: '请至少选择 1 篇文章' });
      toast.error('请至少选择 1 篇文章');
      return;
    }
    if (form.articleIds.length === 0) {
      setFieldErrors({ articleIds: '请至少选择 1 篇文章' });
      toast.error('请至少选择 1 篇文章');
      return;
    }
    if (!form.startDate) {
      setFieldErrors({ startDate: '请选择开始日期' });
      toast.error('请选择开始日期');
      return;
    }
    if (!form.endDate) {
      setFieldErrors({ endDate: '请选择结束日期' });
      toast.error('请选择结束日期');
      return;
    }
    onSubmit(form);
  };

  const { data: brandOptions = [] } = useQuery({
    queryKey: ['brands', 'options'],
    queryFn: () => getBrands(),
    enabled: open && !isClient,
    retry: 2,
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>
            {mode === 'create' ? '新建自动发布任务' : '编辑自动发布任务'}
          </DialogTitle>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto pr-1 space-y-4 py-2">
          {/* 任务名称 + 品牌 */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">
                任务名称 <span className="text-destructive">*</span>
              </label>
              <Input
                value={form.taskName}
                onChange={(e) => {
                  setForm({ ...form, taskName: e.target.value });
                  clearFieldError('taskName');
                }}
                placeholder="请输入任务名称"
                className="h-9"
                style={{
                  borderColor:
                    fieldErrors.taskName ? '#FF5C5C' : undefined,
                }}
              />
              {fieldErrors.taskName && (
                <p className="text-xs text-destructive">
                  {fieldErrors.taskName}
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">
                品牌 <span className="text-destructive">*</span>
              </label>
              {isClient ? (
                <div className="h-9 flex items-center px-3 rounded-[8px] border border-border-strong text-sm">
                  {brandOptions.find((b) => b.id === form.brandId)?.name ??
                    '-'}
                </div>
              ) : (
                <Select
                  value={form.brandId || undefined}
                  onValueChange={(v) => {
                    setForm({ ...form, brandId: v, channelIds: [] });
                    setArticleBrandId(v);
                    clearFieldError('brandId');
                  }}
                >
                  <SelectTrigger
                    className="w-full h-9"
                    style={{
                      borderColor:
                        fieldErrors.brandId ? '#FF5C5C' : undefined,
                    }}
                  >
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
              )}
              {fieldErrors.brandId && (
                <p className="text-xs text-destructive">
                  {fieldErrors.brandId}
                </p>
              )}
            </div>
          </div>

          {/* 渠道来源 */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium">
              渠道来源 <span className="text-destructive">*</span>
            </label>
            <RadioGroup
              value={form.channelSource}
              onValueChange={(v) =>
                setForm({
                  ...form,
                  channelSource: v as ChannelSource,
                })
              }
              className="flex gap-6"
            >
              <div className="flex items-center gap-2">
                <RadioGroupItem value="self_media" id="cs-self" />
                <Label htmlFor="cs-self">自媒体账号</Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="market" id="cs-market" />
                <Label htmlFor="cs-market">媒体商城渠道</Label>
              </div>
            </RadioGroup>
          </div>

          {/* 占位到 */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium">
              发布到 <span className="text-destructive">*</span>
            </label>
            <RadioGroup
              value={form.libraryType}
              onValueChange={(v) =>
                setForm({
                  ...form,
                  libraryType: v as AutoPublishLibrary,
                  channelIds: [],
                })
              }
              className="flex flex-wrap gap-x-6 gap-y-2"
            >
              <div className="flex items-center gap-2">
                <RadioGroupItem value="public" id="lib-public" />
                <Label htmlFor="lib-public">公共媒体库</Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="authoritative" id="lib-authoritative" />
                <Label htmlFor="lib-authoritative">权威媒体库</Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="b2b_alliance" id="lib-b2b" />
                <Label htmlFor="lib-b2b">B2B联盟</Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="multimodal" id="lib-multimodal" />
                <Label htmlFor="lib-multimodal">多模态信源</Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="self_site" id="lib-self-site" />
                <Label htmlFor="lib-self-site">客户自有站点</Label>
              </div>
            </RadioGroup>
          </div>

          {/* 选择渠道 */}
          {form.channelSource === 'self_media' ? (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">
                选择渠道 <span className="text-destructive">*</span>
              </label>
              <span className="text-xs text-muted-foreground">
                已选 <span className="tnum">{selectedGroupCount}</span> 个
              </span>
            </div>
            <div
              className="min-h-[240px] max-h-[320px] overflow-y-auto border rounded-md py-2 pl-2 pr-[8px] space-y-1"
              style={{
                borderColor:
                  fieldErrors.channelIds
                    ? '#FF5C5C'
                    : '#E6EAF2',
              }}
            >
              {!form.brandId ? (
                <div className="text-center py-4 text-sm text-muted-foreground">
                  请先选择品牌
                </div>
              ) : channelsLoading ? (
                <div className="space-y-1 py-1">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <Skeleton key={i} className="h-6 w-full" />
                  ))}
                </div>
              ) : channelsError ? (
                <div className="text-center py-4 text-sm" style={{ color: DANGER }}>
                  渠道加载失败，请重试
                </div>
              ) : channelOptions.length === 0 ? (
                <div className="text-center py-4 text-sm text-muted-foreground">
                  当前品牌在该平台类型下没有可用渠道
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-4 gap-2 mb-2">
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
                      <label className="text-xs text-muted-foreground mb-1 block">行业</label>
                      <Select value={channelFilterIndustry} onValueChange={setChannelFilterIndustry}>
                        <SelectTrigger className="h-8">
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
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">模态</label>
                      <Select value={channelFilterMediaType} onValueChange={setChannelFilterMediaType}>
                        <SelectTrigger className="h-8">
                          <SelectValue placeholder="全部" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="">全部</SelectItem>
                          {SUBMISSION_MEDIA_TYPES.map((m) => (
                            <SelectItem key={m} value={m}>
                              {SUBMISSION_MEDIA_TYPE_LABELS[m]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="col-span-4">
                      <label className="text-xs text-muted-foreground mb-1 block">AI信源平台</label>
                      <AiSourcePlatformSelect
                        selected={channelFilterAiPlatforms as any[]}
                        onChange={setChannelFilterAiPlatforms as any}
                        size="sm"
                      />
                    </div>
                  </div>
                    <div className="flex items-center justify-between">
                    <div className="text-xs text-muted-foreground">
                      共 <span className="tnum font-medium" style={{ color: '#0f172a' }}>{filteredChannelOptions.length}</span> 个渠道
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setAutoSelectDialogOpen(true)}
                      className="h-7 text-xs"
                    >
                      按标签自动选源
                    </Button>
                  </div>
                  {filteredChannelOptions.length === 0 ? (
                    <div className="text-center py-4 text-sm text-muted-foreground">
                      没有匹配的渠道，请调整筛选条件
                    </div>
                  ) : (
                    groupedChannelOptions.map((g) => {
                  const allSelected = g.channels.every((ch) => form.channelIds.includes(ch.id));
                  const slotCount = g.channels.length;
                      return (
                        <button
                          key={g.key}
                          type="button"
                          role="checkbox"
                          aria-checked={allSelected}
                          aria-label={`选择渠道 ${g.name}`}
                          title={g.name}
                          className="w-full text-left appearance-none bg-transparent border-none flex flex-col gap-1 px-3 min-h-[64px] py-2 rounded hover:bg-gray-50 cursor-pointer justify-center"
                          onClick={() => toggleChannelGroup(g.key)}
                        >
                          <div className="flex items-center gap-2 w-full">
                            <Checkbox
                              checked={allSelected}
                              onCheckedChange={() => toggleChannelGroup(g.key)}
                              onClick={(e) => e.stopPropagation()}
                            />
                            <span className="text-sm font-medium flex-1 truncate" style={{ color: '#0f172a' }}>{g.name}</span>
                            {(() => {
                              const platforms = g.channels[0]?.aiPlatforms ?? [];
                              if (platforms.length === 0) {
                                return (
                                  <span className="text-[11px] shrink-0" style={{ color: '#94a3b8' }}>
                                    未标注
                                  </span>
                                );
                              }
                              const showPlatforms = platforms.slice(0, 3);
                              const extraCount = platforms.length - 3;
                              return (
                                <div className="flex items-center gap-0.5 shrink-0">
                                  {showPlatforms.map((p) => (
                                    <Badge
                                      key={p}
                                      variant="outline"
                                      className="text-[10px] h-4 border-0 px-1.5"
                                      style={{
                                        backgroundColor: 'rgba(46, 125, 255, 0.08)',
                                        color: PRIMARY,
                                      }}
                                    >
                                      {SUBMISSION_AI_SOURCE_LABELS[p as keyof typeof SUBMISSION_AI_SOURCE_LABELS] || p}
                                    </Badge>
                                  ))}
                                  {extraCount > 0 && (
                                    <span className="text-[10px] h-4 px-1 flex items-center" style={{ color: '#94a3b8' }}>
                                      +{extraCount}
                                    </span>
                                  )}
                                </div>
                              );
                            })()}
                          </div>
                          <div className="flex items-center gap-2 w-full pl-6">
                            <span className="text-xs shrink-0 truncate" style={{ color: '#64748b' }}>
                              {SUBMISSION_CHANNEL_TYPE_LABELS[g.type]} · {g.channels[0]?.region || '全国'}

                            </span>
                            <div className="flex items-center gap-1 shrink-0 min-w-0">
                              {Array.from(g.ownerTypes).slice(0, 2).map((ot) => (
                                <Badge
                                  key={ot}
                                  variant="outline"
                                  className="text-[10px] h-4 px-1.5"
                                  style={{
                                    borderColor: ot === 'platform' ? '#00C2FF' : '#2E7DFF',
                                    color: ot === 'platform' ? '#00A3CC' : '#2E7DFF',
                                    backgroundColor: ot === 'platform' ? 'rgba(0, 194, 255, 0.08)' : 'rgba(46, 125, 255, 0.06)',
                                  }}
                                >
                                  {ot === 'platform' ? '服务商预置' : '品牌专属'}
                                </Badge>
                              ))}
                              {g.ownerTypes.size > 2 && (
                                <span className="text-[10px]" style={{ color: '#94a3b8' }}>+{g.ownerTypes.size - 2}</span>
                              )}
                            </div>
                            <span className="text-xs shrink-0 ml-auto" style={{ color: '#64748b' }}>
                              含 {slotCount} 个投放位
                            </span>
                          </div>
                        </button>
                      );
                    })
                  )}
                </>
              )}
            </div>
            {channelsError && (
              <button
                onClick={() => refetchChannels()}
                className="text-xs" style={{ color: PRIMARY }}
              >
                重新加载渠道
              </button>
            )}
            {fieldErrors.channelIds && (
              <p className="text-xs text-destructive">
                {fieldErrors.channelIds}
              </p>
            )}
          </div>
          ) : (
          /* 媒体商城渠道选择 */
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">
                选择商城渠道 <span className="text-destructive">*</span>
              </label>
              <span className="text-xs text-muted-foreground">
                已选 <span className="tnum">{form.marketChannelIds?.length ?? 0}</span> 个
                {selectedMarketTotalCents > 0 && (
                  <>
                    {' · '}合计 <span style={{ color: PRIMARY }} className="tnum font-medium">¥{(selectedMarketTotalCents / 100).toFixed(2)}</span>
                  </>
                )}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2 mb-2">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">行业</label>
                <Select value={marketIndustry} onValueChange={setMarketIndustry}>
                  <SelectTrigger className="h-8">
                    <SelectValue placeholder="全行业" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">全行业</SelectItem>
                    {SUBMISSION_INDUSTRIES.map((ind) => (
                      <SelectItem key={ind} value={ind}>
                        {SUBMISSION_INDUSTRY_LABELS[ind]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">最低价（元）</label>
                <Input
                  type="number"
                  min={0}
                  value={marketPriceMin}
                  onChange={(e) => setMarketPriceMin(e.target.value)}
                  placeholder="不限"
                  className="h-8 text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">最高价（元）</label>
                <Input
                  type="number"
                  min={0}
                  value={marketPriceMax}
                  onChange={(e) => setMarketPriceMax(e.target.value)}
                  placeholder="不限"
                  className="h-8 text-sm"
                />
              </div>
            </div>
            <div className="relative mb-2">
              <Search
                className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5"
                style={{ color: MUTED }}
              />
              <Input
                placeholder="搜索渠道名称"
                value={marketKeyword}
                onChange={(e) => setMarketKeyword(e.target.value)}
                className="pl-9 h-8 text-sm"
              />
            </div>
            <div
              className="min-h-[240px] max-h-[320px] overflow-y-auto border rounded-md divide-y"
              style={{
                borderColor: fieldErrors.marketChannelIds
                  ? '#FF5C5C'
                  : '#E6EAF2',
              }}
            >
              {!form.brandId ? (
                <div className="text-center py-8 text-sm text-muted-foreground">
                  请先选择品牌
                </div>
              ) : marketChannelsLoading ? (
                <div className="p-4 space-y-2">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className="h-10 w-full" />
                  ))}
                </div>
              ) : marketChannelItems.length === 0 ? (
                <div className="text-center py-8 text-sm text-muted-foreground">
                  暂无匹配的商城渠道
                </div>
              ) : (
                marketChannelItems.map((ch) => {
                  const checked = form.marketChannelIds?.includes(ch.id) ?? false;
                  return (
                    <div
                      key={ch.id}
                      className="flex items-center gap-3 px-3 py-2.5 hover:bg-gray-50 cursor-pointer"
                      onClick={() => toggleMarketChannel(ch.id)}
                    >
                      <Checkbox
                        checked={checked}
                        onCheckedChange={() => toggleMarketChannel(ch.id)}
                        onClick={(e) => e.stopPropagation()}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate" style={{ color: '#0f172a' }}>
                          {ch.name}
                        </div>
                        <div className="text-xs text-muted-foreground truncate">
                          {ch.industry
                            ? SUBMISSION_INDUSTRY_LABELS[
                                ch.industry as keyof typeof SUBMISSION_INDUSTRY_LABELS
                              ] || ch.industry
                            : '通用'}
                          {ch.tier ? ` · ${ch.tier}` : ''}
                          {ch.followers ? ` · ${ch.followers.toLocaleString()} 粉丝` : ''}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-sm font-medium tnum" style={{ color: PRIMARY }}>
                          ¥{(ch.salePriceCents / 100).toFixed(2)}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {ch.priceUnit || '篇'}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
            {form.marketChannelIds && form.marketChannelIds.length > 0 && (
              <div className="flex items-center justify-between text-xs px-1">
                <span className="text-muted-foreground">
                  预计总预算（{form.articleIds.length || 1} 篇 × {form.marketChannelIds.length} 渠道）：
                  <span className="font-medium tnum ml-1" style={{ color: PRIMARY }}>
                    ¥{(estimatedBudgetCents / 100).toFixed(2)}
                  </span>
                </span>
                {walletData?.balanceCents !== undefined && (
                  <span className="text-muted-foreground">
                    钱包余额：
                    <span
                      className="font-medium tnum"
                      style={{
                        color:
                          walletData.balanceCents >= estimatedBudgetCents
                            ? SUCCESS
                            : DANGER,
                      }}
                    >
                      ¥{(walletData.balanceCents / 100).toFixed(2)}
                    </span>
                  </span>
                )}
              </div>
            )}
            {fieldErrors.marketChannelIds && (
              <p className="text-xs text-destructive">
                {fieldErrors.marketChannelIds}
              </p>
            )}
          </div>
          )}

          {/* 授权账号 */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium">
              授权账号
              <span className="text-xs ml-1" style={{ color: '#94a3b8' }}>
                 （可选，选后任务下发至客户端发布）
              </span>
            </label>
            <Select
              value={form.accountId || ''}
              onValueChange={(v) =>
                setForm({ ...form, accountId: v || '' })
              }
            >
              <SelectTrigger className="h-9">
                <SelectValue placeholder="不选则走原手动发布流程" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">不选（手动发布）</SelectItem>
                {(accountAuthsData?.items ?? []).map((acc) => (
                  <SelectItem key={acc.id} value={acc.id}>
                    {acc.accountName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* 选择文章 */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">
                选择文章 <span className="text-destructive">*</span>
              </label>
              <span className="text-xs text-muted-foreground">
                已选 <span className="tnum">{form.articleIds.length}</span> 篇
              </span>
            </div>
            {!isClient && (
              <div className="w-40">
                <Select
                  value={articleBrandId}
                  onValueChange={(v) => {
                    setArticleBrandId(v);
                    setArticlePage(1);
                  }}
                >
                  <SelectTrigger className="w-full h-8 text-xs">
                    <SelectValue placeholder="按品牌筛选" />
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
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search
                  className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5"
                  style={{ color: MUTED }}
                />
                <Input
                  placeholder="搜索文章标题"
                  value={articleKeyword}
                  onChange={(e) => setArticleKeyword(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && setArticlePage(1)}
                  className="pl-9 h-8 text-sm"
                />
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setArticlePage(1)}
                className="h-8"
              >
                搜索
              </Button>
            </div>
            <div
              className="max-h-48 overflow-y-auto border rounded-md"
              style={{
                borderColor:
                  fieldErrors.articleIds
                    ? '#FF5C5C'
                    : '#E6EAF2',
              }}
            >
              {articlesLoading ? (
                <div className="p-4 space-y-2">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className="h-6 w-full" />
                  ))}
                </div>
              ) : articleItems.length === 0 ? (
                <div className="text-center py-8 text-sm text-muted-foreground">
                  暂无文章
                </div>
              ) : (
                <div className="divide-y">
                  {articleItems.map((article) => (
                    <div
                      key={article.id}
                      className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 cursor-pointer"
                      onClick={() => toggleArticle(article.id)}
                    >
                      <Checkbox
                        checked={form.articleIds.includes(article.id)}
                        onCheckedChange={() => toggleArticle(article.id)}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">
                          {article.title}
                        </div>
                        <div className="text-xs text-muted-foreground flex gap-3">
                          <span>
                            {
                              ARTICLE_TYPE_LABELS[
                                article.articleType as keyof typeof ARTICLE_TYPE_LABELS
                              ]
                            }
                          </span>
                          <span className="tnum">
                            {article.wordCount} 字
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            {articleTotalPages > 1 && (
              <div className="flex items-center justify-center gap-1">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setArticlePage((p) => Math.max(1, p - 1))}
                  disabled={articlePage === 1}
                  className="h-7 px-2"
                >
                  上一页
                </Button>
                <span className="text-xs text-muted-foreground px-2 tnum">
                  {articlePage} / {articleTotalPages}
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    setArticlePage((p) =>
                      Math.min(articleTotalPages, p + 1),
                    )
                  }
                  disabled={articlePage === articleTotalPages}
                  className="h-7 px-2"
                >
                  下一页
                </Button>
              </div>
            )}
            {fieldErrors.articleIds && (
              <p className="text-xs text-destructive">
                {fieldErrors.articleIds}
              </p>
            )}
          </div>

          {/* 占位周期 + 每日上限 */}
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">
                开始日期 <span className="text-destructive">*</span>
              </label>
              <Popover open={startOpen} onOpenChange={setStartOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full h-9 justify-start text-left font-normal border-[#E6EAF2]"
                    style={{
                      borderColor:
                        fieldErrors.startDate ? '#FF5C5C' : '#E6EAF2',
                    }}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {form.startDate
                      ? dayjs(form.startDate).format('YYYY-MM-DD')
                      : '选择开始日期'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={form.startDate ? new Date(form.startDate) : undefined}
                    onSelect={(date) => {
                      if (date) {
                        setForm({
                          ...form,
                          startDate: dayjs(date).format('YYYY-MM-DD'),
                        });
                        setStartOpen(false);
                        clearFieldError('startDate');
                      }
                    }}
                    initialFocus
                    formatters={{
                      formatWeekdayName: (date: Date) =>
                        ['日', '一', '二', '三', '四', '五', '六'][date.getDay()],
                      formatMonthCaption: (date: Date) =>
                        dayjs(date).format('YYYY年M月'),
                    }}
                    labels={{
                      labelPrevious: () => '上个月',
                      labelNext: () => '下个月',
                    }}
                  />
                </PopoverContent>
              </Popover>
              {fieldErrors.startDate && (
                <p className="text-xs text-destructive">
                  {fieldErrors.startDate}
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">
                结束日期 <span className="text-destructive">*</span>
              </label>
              <Popover open={endOpen} onOpenChange={setEndOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full h-9 justify-start text-left font-normal border-[#E6EAF2]"
                    style={{
                      borderColor:
                        fieldErrors.endDate ? '#FF5C5C' : '#E6EAF2',
                    }}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {form.endDate
                      ? dayjs(form.endDate).format('YYYY-MM-DD')
                      : '选择结束日期'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={form.endDate ? new Date(form.endDate) : undefined}
                    onSelect={(date) => {
                      if (date) {
                        setForm({
                          ...form,
                          endDate: dayjs(date).format('YYYY-MM-DD'),
                        });
                        setEndOpen(false);
                        clearFieldError('endDate');
                      }
                    }}
                    initialFocus
                    formatters={{
                      formatWeekdayName: (date: Date) =>
                        ['日', '一', '二', '三', '四', '五', '六'][date.getDay()],
                      formatMonthCaption: (date: Date) =>
                        dayjs(date).format('YYYY年M月'),
                    }}
                    labels={{
                      labelPrevious: () => '上个月',
                      labelNext: () => '下个月',
                    }}
                  />
                </PopoverContent>
              </Popover>
              {fieldErrors.endDate && (
                <p className="text-xs text-destructive">
                  {fieldErrors.endDate}
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">
                每日发布上限 <span className="text-destructive">*</span>
              </label>
              <Input
                type="number"
                min={1}
                value={form.dailyLimit}
                onChange={(e) =>
                  setForm({
                    ...form,
                    dailyLimit: Math.max(1, Number(e.target.value) || 1),
                  })
                }
                className="h-9 tnum"
                style={{
                  borderColor: isOverLimit ? '#FF5C5C' : undefined,
                }}
              />
              <p className="text-xs" style={{ color: isOverLimit ? '#FF5C5C' : '#64748b' }}>
                {isOverLimit
                  ? `超出套餐上限 ${planDailyLimit} 篇/日`
                  : planLimitData
                    ? (
                      <>
                        取自
                        <span
                          className="underline cursor-pointer"
                          style={{ color: '#3B5BFF' }}
                          onClick={() => {
                            navigate('/settings?tab=plan');
                            onOpenChange(false);
                          }}
                        >
                          套餐配置
                        </span>
                        ，上限 {planDailyLimit} 篇/日
                      </>
                    )
                    : '未绑定套餐，默认 10 篇/日'}
              </p>
            </div>
          </div>

          {/* 预算与发布间隔（仅商城渠道） */}
          {form.channelSource === 'market' && (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">总预算（元）</label>
                <Input
                  type="number"
                  min={0}
                  value={
                    form.budgetCents !== undefined && form.budgetCents !== null
                      ? (form.budgetCents / 100).toFixed(2)
                      : ''
                  }
                  onChange={(e) => {
                    const val = e.target.value;
                    setForm({
                      ...form,
                      budgetCents:
                        val === '' ? undefined : Math.round(Number(val) * 100),
                    });
                  }}
                  placeholder="不填则不限制"
                  className="h-9 tnum"
                />
                <p className="text-xs" style={{ color: '#64748b' }}>
                  可选，达到预算后自动停止发布
                </p>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">发布间隔（分钟）</label>
                <Input
                  type="number"
                  min={1}
                  value={
                    form.publishIntervalMinutes !== undefined &&
                    form.publishIntervalMinutes !== null
                      ? form.publishIntervalMinutes
                      : ''
                  }
                  onChange={(e) => {
                    const val = e.target.value;
                    setForm({
                      ...form,
                      publishIntervalMinutes:
                        val === '' ? undefined : Number(val) || undefined,
                    });
                  }}
                  placeholder="30"
                  className="h-9 tnum"
                />
                <p className="text-xs" style={{ color: '#64748b' }}>
                  可选，默认 30 分钟
                </p>
              </div>
            </div>
          )}

        </div>
        <DialogFooter className="pt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button
            style={{ backgroundColor: PRIMARY }}
            disabled={isPending || isOverLimit}
            onClick={handleSubmit}
          >
            {isPending
              ? '保存中...'
              : mode === 'create'
                ? '创建任务'
                : '保存修改'}
          </Button>
        </DialogFooter>
      </DialogContent>
      <AutoSelectDialog
        open={autoSelectDialogOpen}
        onOpenChange={setAutoSelectDialogOpen}
        defaultBrandId={form.brandId}
        defaultLibraryType={form.libraryType as SubmissionLibraryType}
        isClient={isClient}
        onConfirm={handleAutoSelectConfirm}
      />
    </Dialog>
  );
};

const TableSkeleton = () => (
  <div
    className="space-y-1 rounded-md border p-4"
    style={{ borderColor: '#E6EAF2' }}
  >
    {Array.from({ length: 6 }).map((_, i) => (
      <div key={i} className="flex items-center gap-4 h-11">
        <Skeleton className="h-4 w-10" />
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-4 w-16" />
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-4 w-16" />
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-5 w-16 rounded-full" />
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-4 w-24" />
      </div>
    ))}
  </div>
);

const EmptyState: React.FC<{ onCreate: () => void }> = ({ onCreate }) => (
  <div className="flex flex-col items-center justify-center py-16 gap-4">
    <div
      className="flex h-16 w-16 items-center justify-center rounded-full"
      style={{ backgroundColor: '#F2F4F7' }}
    >
      <RefreshCw className="h-8 w-8" style={{ color: '#94A3B8' }} />
    </div>
    <div className="text-center space-y-1">
      <div className="text-base font-medium">暂无自动发布任务</div>
      <div className="text-sm text-muted-foreground">
        创建第一个定时发布任务，自动分发文章
      </div>
    </div>
    <Button
      size="sm"
      className="mt-2"
      style={{ backgroundColor: PRIMARY }}
      onClick={onCreate}
    >
      <Plus className="h-3.5 w-3.5" />
      新建任务
    </Button>
  </div>
);

export default AutoPublishPage;
