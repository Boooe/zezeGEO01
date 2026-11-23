import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Search,
  Clock,
  FileText,
  Image as ImageIcon,
  Video,
  ListChecks,
  RefreshCw,
  AlertCircle,
  Send,
  Plus,
} from 'lucide-react';

import { toast } from 'sonner';

import { Card, CardContent } from '@client/src/components/ui/card';
import { Button } from '@client/src/components/ui/button';
import { Input } from '@client/src/components/ui/input';
import { Label } from '@client/src/components/ui/label';

import { Skeleton } from '@client/src/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@client/src/components/ui/table';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@client/src/components/ui/select';
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@client/src/components/ui/pagination';

import { creation } from '@client/src/api';
import { useAuth } from '@client/src/contexts/AuthContext';
import { channels, publishQueue, submissionChannels, submissionQueue } from '@client/src/api';
import { checkCompliance } from '@client/src/api/compliance';
import { ComplianceBadge } from '@client/src/components/ui/compliance-badge';
import type { ComplianceCheckResponse } from '@shared/api.interface';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from '@client/src/components/ui/dialog';
import {
  CREATION_TASK_TYPES,
  CREATION_TASK_TYPE_LABELS,
  CREATION_TASK_STATUSES,
  CREATION_TASK_STATUS_LABELS,
  type CreationTaskItem,
  type PagedResponse,
  CHANNEL_PLATFORM_LABELS,
} from '@shared/api.interface';

const PAGE_SIZE = 15;

const TaskPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const isClient = user?.role === 'client';
  const brandId = user?.brandId ?? '';

  const [submitTask, setSubmitTask] = useState<CreationTaskItem | null>(null);
  const [submitTargetType, setSubmitTargetType] = useState<'publish' | 'submission'>('publish');
  const [submitChannelId, setSubmitChannelId] = useState('');
  const [submitOpen, setSubmitOpen] = useState(false);
  const [complianceResult, setComplianceResult] = useState<ComplianceCheckResponse | null>(null);
  const [complianceLoading, setComplianceLoading] = useState(false);

  const { data: channelsData } = useQuery({
    queryKey: ['channels', { brandId }],
    queryFn: () =>
      channels.list({ page: 1, pageSize: 100, brandId: brandId || undefined, status: 'active' }),
    enabled: submitOpen && submitTargetType === 'publish' && !!brandId,
  });

  const { data: subChannelsData } = useQuery({
    queryKey: ['submissionChannels', { brandId: submitTask?.brandId }],
    queryFn: () =>
      submissionChannels.list({ limit: 100, brandId: submitTask?.brandId, status: 'active' }),
    enabled: submitOpen && submitTargetType === 'submission' && !!submitTask?.brandId,
  });

  const publishSubmitMutation = useMutation({
    mutationFn: (data: { articleId: string; channelId: string }) =>
      publishQueue.enqueue(data),
    onSuccess: () => {
      toast.success('已加入发布队列');
      closeSubmitDialog();
      queryClient.invalidateQueries({ queryKey: ['publishQueue'] });
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.error?.message || '加入队列失败');
    },
    retry: false,
  });

  const submissionSubmitMutation = useMutation({
    mutationFn: (data: { articleId: string; channelId: string; brandId?: string }) =>
      submissionQueue.enqueue(data),
    onSuccess: () => {
      toast.success('已加入投稿队列');
      closeSubmitDialog();
      queryClient.invalidateQueries({ queryKey: ['submissionQueue'] });
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.error?.message || '加入队列失败');
    },
    retry: false,
  });

  const closeSubmitDialog = () => {
    setSubmitOpen(false);
    setSubmitTask(null);
    setSubmitChannelId('');
    setSubmitTargetType('publish');
    setComplianceResult(null);
    setComplianceLoading(false);
  };

  const handleSubmitConfirm = () => {
    if (!submitTask || !submitChannelId) return;
    // 投稿类型需要合规预检
    if (submitTargetType === 'submission' && complianceResult?.riskLevel === 'block') {
      toast.error(
        `内容存在 ${complianceResult.totalHits} 处高风险表述，请修改后再投稿`,
      );
      return;
    }
    if (submitTargetType === 'publish') {
      publishSubmitMutation.mutate({
        articleId: submitTask.id,
        channelId: submitChannelId,
      });
    } else {
      submissionSubmitMutation.mutate({
        articleId: submitTask.id,
        channelId: submitChannelId,
        brandId: submitTask.brandId,
      });
    }
  };

  const isSubmitPending = publishSubmitMutation.isPending || submissionSubmitMutation.isPending;

  // 投稿时自动做合规预检
  useEffect(() => {
    if (!submitOpen || submitTargetType !== 'submission' || !submitTask) return;
    if (complianceResult) return;
    setComplianceLoading(true);
    checkCompliance({
      title: submitTask.taskName,
      content: submitTask.taskName,
    })
      .then((res) => {
        setComplianceResult(res);
      })
      .catch(() => {
        // 合规检测失败不阻断投稿，仅提示
      })
      .finally(() => {
        setComplianceLoading(false);
      });
  }, [submitOpen, submitTargetType, submitTask, complianceResult]);

  // 筛选
  const [typeFilter, setTypeFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [keyword, setKeyword] = useState('');
  const [searchKw, setSearchKw] = useState('');
  const [page, setPage] = useState(1);

  const { data: tasksData, isLoading: listLoading } = useQuery<
    PagedResponse<CreationTaskItem>,
    unknown
  >({
    queryKey: ['creationTasks', { page, brandId, type: typeFilter, status: statusFilter, keyword: searchKw }],
    queryFn: () =>
      creation.listTasks({
        page,
        pageSize: PAGE_SIZE,
        brandId: brandId || undefined,
        taskType: (typeFilter as CreationTaskItem['taskType']) || undefined,
        status: (statusFilter as CreationTaskItem['status']) || undefined,
      }),
  });

  const tasks = tasksData?.items ?? [];
  const total = tasksData?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const pageNumbers = useMemo(() => {
    const pages: number[] = [];
    const start = Math.max(1, page - 2);
    const end = Math.min(totalPages, start + 4);
    for (let i = start; i <= end; i++) pages.push(i);
    return pages;
  }, [page, totalPages]);

  const formatDuration = (seconds: number): string => {
    if (!seconds || seconds < 0) return '0s';
    if (seconds < 60) return `${seconds}s`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    return `${h}h ${m}m`;
  };

  const handleSearch = () => {
    setSearchKw(keyword);
    setPage(1);
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'article':
        return FileText;
      case 'image':
        return ImageIcon;
      case 'video':
        return Video;
      default:
        return ListChecks;
    }
  };

  const statusDotColor = (status: string): string => {
    switch (status) {
      case 'completed':
        return '#12B76A';
      case 'generating':
      case 'processing':
        return '#2E7DFF';
      case 'pending':
        return '#F79009';
      case 'failed':
        return '#F04438';
      default:
        return '#8A93A6';
    }
  };

  return (
    <div className="space-y-5">
      {/* 页面标题栏 */}
      <div className="flex items-start justify-between">
        <div className="page-header">
          <h1>创作历史</h1>
          <p>查看所有 AI 创作任务的执行状态、进度与产出详情</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => window.location.reload()}>
            <RefreshCw className="h-4 w-4" />
            刷新
          </Button>
        </div>
      </div>

      {/* 筛选栏 */}
      <div className="filter-bar-card">
        <div className="flex items-center gap-3">
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-32 h-9">
              <SelectValue placeholder="全部类型" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">全部类型</SelectItem>
              {CREATION_TASK_TYPES.map((t) => (
                <SelectItem key={t} value={t}>
                  {CREATION_TASK_TYPE_LABELS[t]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-32 h-9">
              <SelectValue placeholder="全部状态" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">全部状态</SelectItem>
              {CREATION_TASK_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  {CREATION_TASK_STATUS_LABELS[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2 ml-auto">
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" style={{ color: '#8A93A6' }} />
            <Input
              placeholder="搜索任务名"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              className="pl-9 h-9"
            />
          </div>
          <Button onClick={handleSearch} variant="outline" className="h-9">搜索</Button>
        </div>
      </div>

      {/* 列表 */}
      <div
        className="w-full overflow-hidden"
        style={{ borderRadius: '14px', border: '1px solid #E6EBF2', boxShadow: '0 1px 2px rgba(16,24,40,0.04)', background: '#fff' }}
      >
          {listLoading ? (
            <div className="p-4 space-y-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full rounded" />
              ))}
            </div>
          ) : tasks.length === 0 ? (
            <div className="empty-state-card" style={{ minHeight: 360 }}>
              <ListChecks className="empty-icon" />
              <div className="empty-title">暂无创作任务</div>
              <div className="empty-desc">
                前往 AI 创作页面发起任务后，将在此处展示进度与结果
              </div>
              <Button
                className="mt-4 bg-[#2E7DFF] text-white hover:bg-[#1E5FD6]"
                onClick={() => navigate('/creation?tab=write')}
              >
                <Plus className="h-4 w-4" />
                去创作
              </Button>
            </div>
          ) : (
            <>
              <Table className="data-table">
                <TableHeader>
                  <TableRow>
                    <TableHead>任务名称</TableHead>
                    <TableHead className="w-20">类型</TableHead>
                    <TableHead className="w-20 text-right">数量</TableHead>
                    <TableHead className="w-28">状态</TableHead>
                    <TableHead className="w-28">耗时</TableHead>
                    <TableHead className="w-24 text-right">消耗算力</TableHead>
                    <TableHead className="w-40">创建时间</TableHead>
                    <TableHead className="w-36">失败原因</TableHead>
                    <TableHead className="w-28 text-right">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tasks.map((task: CreationTaskItem) => {
                    const Icon = getTypeIcon(task.taskType);
                    const durationSec = task.durationMs ? Math.floor(task.durationMs / 1000) : 0;
                    return (
                      <TableRow key={task.id}>
                        <TableCell className="font-medium text-foreground">
                          <div className="max-w-md">{task.taskName}</div>
                          <div className="mt-0.5 text-xs text-muted-foreground">
                            {task.brandName}
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="inline-flex items-center gap-1.5 text-xs" style={{ color: '#5A6478' }}>
                            <Icon className="h-3.5 w-3.5" style={{ color: '#8A93A6' }} />
                            {CREATION_TASK_TYPE_LABELS[task.taskType]}
                          </span>
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground">
                          {task.quantity}
                        </TableCell>
                        <TableCell>
                          <span className="inline-flex items-center text-xs" style={{ color: '#1A2233' }}>
                            <span
                              className="status-dot"
                              style={{ backgroundColor: statusDotColor(task.status) }}
                            />
                            {CREATION_TASK_STATUS_LABELS[task.status]}
                          </span>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3 text-slate-400" />
                            {formatDuration(durationSec)}
                          </span>
                        </TableCell>
                        <TableCell className="text-right font-medium text-primary">
                          {task.costCredits?.toLocaleString() ?? 0}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {new Date(task.createdAt).toLocaleString('zh-CN')}
                        </TableCell>
                        <TableCell className="max-w-48 text-sm">
                          {task.status === 'failed' ? (
                            <span
                              className="text-destructive"
                              title={task.error || ''}
                            >
                              <AlertCircle className="mr-1 inline h-3 w-3" />
                              {task.error || '未知错误'}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {task.taskType === 'article' && task.status === 'completed' && (
                            <Dialog
                              open={submitOpen && submitTask?.id === task.id}
                              onOpenChange={(open) => {
                                if (!open) {
                                  closeSubmitDialog();
                                } else {
                                  setSubmitTask(task);
                                  setSubmitOpen(true);
                                }
                              }}
                            >
                              <DialogTrigger asChild>
                                <Button variant="ghost" size="sm" className="h-7 gap-1 px-2 text-xs">
                                  <Send className="h-3.5 w-3.5" />
                                  投稿
                                </Button>
                              </DialogTrigger>
                              <DialogContent>
                                <DialogHeader>
                                  <DialogTitle>选择投稿目标</DialogTitle>
                                </DialogHeader>
                                <div className="space-y-4 py-4">
                                  <div>
                                    <Label className="text-sm">文章标题</Label>
                                    <p className="mt-1 text-sm text-muted-foreground">{task.taskName}</p>
                                  </div>
                                  <div>
                                    <Label className="text-sm">目标类型</Label>
                                    <div className="mt-2 grid grid-cols-2 gap-2">
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setSubmitTargetType('publish');
                                          setSubmitChannelId('');
                                        }}
                                        className={
                                          submitTargetType === 'publish'
                                            ? 'rounded-lg border-2 p-3 text-left transition-colors'
                                            : 'rounded-lg border p-3 text-left transition-colors hover:border-muted-foreground/30'
                                        }
                                        style={{
                                          borderColor: submitTargetType === 'publish' ? '#1e40af' : undefined,
                                          backgroundColor: submitTargetType === 'publish' ? 'rgba(30, 64, 175, 0.04)' : undefined,
                                        }}
                                      >
                                        <div className="text-sm font-medium">渠道账号</div>
                                        <div className="mt-1 text-xs text-muted-foreground">百家号等自媒体账号，自动发布</div>
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setSubmitTargetType('submission');
                                          setSubmitChannelId('');
                                        }}
                                        className={
                                          submitTargetType === 'submission'
                                            ? 'rounded-lg border-2 p-3 text-left transition-colors'
                                            : 'rounded-lg border p-3 text-left transition-colors hover:border-muted-foreground/30'
                                        }
                                        style={{
                                          borderColor: submitTargetType === 'submission' ? '#1e40af' : undefined,
                                          backgroundColor: submitTargetType === 'submission' ? 'rgba(30, 64, 175, 0.04)' : undefined,
                                        }}
                                      >
                                        <div className="text-sm font-medium">信源</div>
                                        <div className="mt-1 text-xs text-muted-foreground">博客园、搜了网等第三方投稿站</div>
                                      </button>
                                    </div>
                                  </div>
                                  <div>
                                    <Label className="text-sm">
                                      {submitTargetType === 'publish' ? '选择账号' : '选择信源'}
                                    </Label>
                                    <Select
                                      value={submitChannelId}
                                      onValueChange={setSubmitChannelId}
                                    >
                                      <SelectTrigger className="mt-1">
                                        <SelectValue
                                          placeholder={
                                            submitTargetType === 'publish'
                                              ? '请选择发布账号'
                                              : '请选择信源'
                                          }
                                        />
                                      </SelectTrigger>
                                      <SelectContent>
                                        {submitTargetType === 'publish'
                                          ? channelsData?.items?.map((ch: any) => (
                                              <SelectItem key={ch.id} value={ch.id}>
                                                {ch.accountName} ({
                                                  CHANNEL_PLATFORM_LABELS[
                                                    ch.platform as keyof typeof CHANNEL_PLATFORM_LABELS
                                                  ] || ch.platform
                                                })
                                              </SelectItem>
                                            ))
                                          : subChannelsData?.items?.map((ch: any) => (
                                              <SelectItem key={ch.id} value={ch.id}>
                                                {ch.name}
                                              </SelectItem>
                                            ))}
                                        {submitTargetType === 'publish' &&
                                          !channelsData?.items?.length && (
                                            <div className="p-2 text-sm text-muted-foreground">暂无可用账号</div>
                                          )}
                                        {submitTargetType === 'submission' &&
                                          !subChannelsData?.items?.length && (
                                            <div className="p-2 text-sm text-muted-foreground">暂无可用渠道</div>
                                          )}
                                      </SelectContent>
                                    </Select>
                                    {submitTargetType === 'submission' && (
                                      <p className="mt-1.5 text-xs text-muted-foreground">
                                        投稿不消耗算力（生成时已扣除）
                                      </p>
                                    )}
                                    {submitTargetType === 'submission' && (
                                      <div className="mt-3 rounded-md border p-3" style={{ borderColor: '#E5E9F2' }}>
                                        <div className="flex items-center justify-between">
                                          <span className="text-xs text-muted-foreground">合规状态</span>
                                          {complianceLoading ? (
                                            <span className="text-xs text-muted-foreground">检测中...</span>
                                          ) : complianceResult ? (
                                            <ComplianceBadge
                                              level={complianceResult.riskLevel}
                                              count={complianceResult.totalHits}
                                            />
                                          ) : (
                                            <span className="text-xs text-muted-foreground">未检测</span>
                                          )}
                                        </div>
                                        {complianceResult && complianceResult.riskLevel === 'block' && (
                                          <p className="mt-2 text-xs" style={{ color: '#FF5C5C' }}>
                                            内容存在 {complianceResult.totalHits} 处高风险表述，请修改后再投稿
                                          </p>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                </div>
                                <DialogFooter>
                                  <Button variant="outline" onClick={closeSubmitDialog}>
                                    取消
                                  </Button>
                                  <Button
                                    disabled={
                                      !submitChannelId ||
                                      isSubmitPending ||
                                      (submitTargetType === 'submission' && complianceResult?.riskLevel === 'block')
                                    }
                                    onClick={handleSubmitConfirm}
                                  >
                                    {isSubmitPending ? '提交中...' : '确认加入队列'}
                                  </Button>
                                </DialogFooter>
                              </DialogContent>
                            </Dialog>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>

              {totalPages > 1 && (
                <div className="p-3" style={{ borderTop: '1px solid #EDF1F7' }}>
                  <Pagination>
                    <PaginationContent>
                      <PaginationItem>
                        <PaginationPrevious
                          onClick={() => setPage(Math.max(1, page - 1))}
                          className={page === 1 ? 'pointer-events-none opacity-50 cursor-pointer' : 'cursor-pointer'}
                        />
                      </PaginationItem>
                      {pageNumbers.map((p: number) => (
                        <PaginationItem key={p}>
                          <PaginationLink
                            isActive={p === page}
                            onClick={() => setPage(p)}
                            className="cursor-pointer"
                          >
                            {p}
                          </PaginationLink>
                        </PaginationItem>
                      ))}
                      <PaginationItem>
                        <PaginationNext
                          onClick={() => setPage(Math.min(totalPages, page + 1))}
                          className={page === totalPages ? 'pointer-events-none opacity-50 cursor-pointer' : 'cursor-pointer'}
                        />
                      </PaginationItem>
                    </PaginationContent>
                  </Pagination>
                </div>
              )}
            </>
          )}
        </div>
    </div>
  );
};

export default TaskPage;
