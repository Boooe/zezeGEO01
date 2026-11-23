import React, { useMemo, useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Play,
  RotateCcw,
  Plus,
  Search,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Clock,
  Settings,
  ChevronDown,
  ChevronUp,
  Eye,
  Loader2,
  Sparkles,
  Activity,
  Target,
  Zap,
  X,
  ExternalLink,
} from 'lucide-react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@client/src/components/ui/card';
import { Button } from '@client/src/components/ui/button';
import { Input } from '@client/src/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@client/src/components/ui/select';
import { Badge } from '@client/src/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@client/src/components/ui/dialog';
import { Label } from '@client/src/components/ui/label';
import { Checkbox } from '@client/src/components/ui/checkbox';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@client/src/components/ui/tooltip';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@client/src/components/ui/table';
import { Skeleton } from '@client/src/components/ui/skeleton';
import { Alert, AlertDescription } from '@client/src/components/ui/alert';
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@client/src/components/ui/empty';
import { useAuth } from '@client/src/hooks/useAuth';
import {
  getDetectTasks,
  createDetectTask,
  runDetectTask,
  retryDetectTask,
  getDetectTaskDetail,
  getDetectResults,
  getBrandList,
  getDetectPlatformsStatus,
} from '@client/src/api/keywords';
import {
  AI_DETECT_PLATFORMS,
  AI_DETECT_PLATFORM_LABELS,
  AI_DETECT_TASK_STATUS_LABELS,
} from '@shared/api.interface';
import type {
  AiDetectTask,
  AiDetectResult,
  AiDetectPlatform,
  AiDetectTaskStatus,
  AiDetectTaskSummary,
  AiDetectPlatformsStatusResponse,
} from '@shared/api.interface';
import { toast } from 'sonner';
import { UniversalLink } from '@lark-apaas/client-toolkit/components/UniversalLink';
import { PageHeader } from '@client/src/components/layout/PageHeader';
import { Pill } from '@client/src/components/layout/Pill';
import { TableShell } from '@client/src/components/ui/table-shell';

const PAGE_SIZE = 20;

const STATUS_PILL_VARIANT: Record<AiDetectTaskStatus, 'muted' | 'info' | 'success' | 'warning'> = {
  pending: 'muted',
  running: 'info',
  completed: 'success',
  partial_failed: 'warning',
  paused: 'warning',
};

const PLATFORM_COLORS: Record<AiDetectPlatform, string> = {
  volcano: 'bg-red-50 text-red-600',
  qwen: 'bg-purple-50 text-purple-600',
  hunyuan: 'bg-amber-50 text-amber-700',
  deepseek: 'bg-cyan-50 text-cyan-700',
  kimi: 'bg-rose-50 text-rose-600',
  wenxin: 'bg-blue-50 text-blue-600',
};

const KeywordTasksPage: React.FC = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [page, setPage] = useState(1);
  const [brandId, setBrandId] = useState('');
  const [status, setStatus] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [selectedTask, setSelectedTask] = useState<AiDetectTask | null>(null);
  const [showResultDetail, setShowResultDetail] = useState<AiDetectResult | null>(null);
  const [pollingTaskId, setPollingTaskId] = useState<string | null>(null);

  const { data: brandList = [] } = useQuery({
    queryKey: ['brand-options'],
    queryFn: getBrandList,
    staleTime: 60_000,
  });

  const currentBrand = useMemo(() => {
    if (brandId) return brandList.find((b) => b.id === brandId)?.id;
    if (user?.role === 'client' && user?.brandId) return user.brandId;
    return brandList[0]?.id || '';
  }, [brandId, brandList, user]);

  const { data: tasksPage, isLoading } = useQuery({
    queryKey: ['detect-tasks', { page, brandId: currentBrand, status }],
    queryFn: () =>
      getDetectTasks({
        page,
        pageSize: PAGE_SIZE,
        brandId: currentBrand,
        status: status || undefined,
      }),
    enabled: !!currentBrand,
    refetchInterval: (query): number | false => {
      const data = query.state.data;
      if (!data?.items) return false;
      const hasRunning = data.items.some(
        (item: AiDetectTask) => item.status === 'running',
      );
      return hasRunning ? 3000 : false;
    },
  });

  const { data: platformsStatus } = useQuery({
    queryKey: ['detect-platforms-status'],
    queryFn: getDetectPlatformsStatus,
    staleTime: 60_000,
  });

  const missingPlatforms = useMemo(() => {
    if (!platformsStatus?.platforms) return [];
    const statusMap = new Map(platformsStatus.platforms.map((p) => [p.platform, p]));
    return AI_DETECT_PLATFORMS.filter(
      (p) => !statusMap.get(p)?.configured,
    );
  }, [platformsStatus]);

  const { data: taskDetail } = useQuery({
    queryKey: ['detect-task-detail', selectedTask?.id],
    queryFn: () => getDetectTaskDetail(selectedTask!.id),
    enabled: !!selectedTask,
    refetchInterval: (query): number | false => {
      const data = query.state.data as AiDetectTask & { summary: AiDetectTaskSummary } | undefined;
      return data?.status === 'running' ? 3000 : false;
    },
  });

  const { data: resultsPage, isLoading: resultsLoading } = useQuery({
    queryKey: ['detect-results', selectedTask?.id],
    queryFn: () =>
      getDetectResults({
        taskId: selectedTask!.id,
        page: 1,
        pageSize: 100,
      }),
    enabled: !!selectedTask,
    refetchInterval: (): number | false => {
      const detailData = queryClient.getQueryData<
        AiDetectTask & { summary: AiDetectTaskSummary }
      >(['detect-task-detail', selectedTask?.id]);
      return detailData?.status === 'running' ? 3000 : false;
    },
  });

  const createMutation = useMutation({
    mutationFn: createDetectTask,
    onSuccess: () => {
      toast.success('检测任务已创建');
      setShowCreate(false);
      queryClient.invalidateQueries({ queryKey: ['detect-tasks'] });
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.error?.message || '创建失败');
    },
  });

  const runMutation = useMutation({
    mutationFn: runDetectTask,
    onSuccess: (task) => {
      toast.success('任务已开始运行');
      setPollingTaskId(task.id);
      queryClient.invalidateQueries({ queryKey: ['detect-tasks'] });
      if (selectedTask?.id === task.id) {
        queryClient.invalidateQueries({ queryKey: ['detect-task-detail', task.id] });
        queryClient.invalidateQueries({ queryKey: ['detect-results', task.id] });
      }
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.error?.message || '启动失败');
    },
  });

  const retryMutation = useMutation({
    mutationFn: retryDetectTask,
    onSuccess: () => {
      toast.success('已开始重试失败项');
      queryClient.invalidateQueries({ queryKey: ['detect-tasks'] });
      if (selectedTask) {
        queryClient.invalidateQueries({ queryKey: ['detect-task-detail', selectedTask.id] });
        queryClient.invalidateQueries({ queryKey: ['detect-results', selectedTask.id] });
      }
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.error?.message || '重试失败');
    },
  });

  const handleCreate = (values: {
    brandId: string;
    keywords: string;
    hitWords: string;
    platforms: AiDetectPlatform[];
    concurrency: number;
  }) => {
    const keywordList = values.keywords
      .split(/[\n,，、\s]+/)
      .map((k) => k.trim())
      .filter(Boolean);
    if (keywordList.length === 0) {
      toast.error('请输入至少一个关键词');
      return;
    }
    if (values.platforms.length === 0) {
      toast.error('请至少选择一个平台');
      return;
    }
    const hitWordList = values.hitWords
      .split(/[,，、\s]+/)
      .map((w) => w.trim())
      .filter(Boolean);
    createMutation.mutate({
      brandId: values.brandId,
      keywords: keywordList,
      platforms: values.platforms,
      hitWords: hitWordList.length > 0 ? hitWordList : undefined,
      concurrency: values.concurrency,
    });
  };

  const displayTask = taskDetail || selectedTask;
  const results = resultsPage?.items || [];
  const summary = resultsPage?.summary || taskDetail?.summary;

  return (
    <div className="space-y-5 bg-[#F7F9FC]">
      <PageHeader
        title="检测任务"
        subtitle="对关键词在各大 AI 平台的可见度进行真实检测，查看品牌提及情况"
      />

      {missingPlatforms.length > 0 && (
        <Alert variant="warning" className="border-amber-200 bg-amber-50">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          <AlertDescription className="text-amber-800">
            {missingPlatforms.length === AI_DETECT_PLATFORMS.length
              ? '当前未配置任何 AI 平台的 Key，无法进行检测。'
              : `${missingPlatforms
                  .map((p) => AI_DETECT_PLATFORM_LABELS[p])
                  .join('、')} 平台未配置 Key，检测时将跳过。`}
            <UniversalLink
              to="/settings?tab=ai-keys"
              className="ml-2 font-medium underline hover:text-amber-900"
            >
              前往 AI 模型接入 →
            </UniversalLink>
          </AlertDescription>
        </Alert>
      )}

      <TableShell
        title="任务列表"
        headerActions={
          <Button onClick={() => setShowCreate(true)} className="h-9 bg-[#2E7DFF] text-white hover:bg-[#1E5FD6]">
            <Plus className="mr-2 h-4 w-4" />
            新建任务
          </Button>
        }
        filterBar={
          <>
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-500">品牌：</span>
              <Select
                value={currentBrand}
                onValueChange={setBrandId}
                disabled={user?.role === 'client'}
              >
                <SelectTrigger className="h-9 w-[180px]">
                  <SelectValue placeholder="选择品牌" />
                </SelectTrigger>
                <SelectContent>
                  {brandList.map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-500">状态：</span>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger className="h-9 w-[140px]">
                  <SelectValue placeholder="全部状态" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">全部状态</SelectItem>
                  {Object.entries(AI_DETECT_TASK_STATUS_LABELS).map(([v, label]) => (
                    <SelectItem key={v} value={v}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </>
        }
        data={tasksPage?.items ?? []}
        isLoading={isLoading}
        isEmpty={!isLoading && tasksPage && tasksPage.items.length === 0}
        emptyTitle="暂无检测任务"
        emptyDescription="新建第一个检测任务，查看关键词在 AI 平台的品牌提及情况"
        emptyAction={{ label: '新建任务', onClick: () => setShowCreate(true) }}
        total={tasksPage?.total ?? 0}
        page={page}
        pageSize={PAGE_SIZE}
        onPageChange={setPage}
      >
        {!isLoading && tasksPage && tasksPage.items.length > 0 && (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-[160px]">关键词数量</TableHead>
                <TableHead className="min-w-[200px]">平台</TableHead>
                <TableHead className="min-w-[100px]">状态</TableHead>
                <TableHead className="min-w-[160px]">进度</TableHead>
                <TableHead className="min-w-[140px]">创建时间</TableHead>
                <TableHead className="w-[132px] text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
              <TableBody>
                {tasksPage.items.map((task) => (
                  <TableRow
                    key={task.id}
                    className="cursor-pointer"
                    onClick={() => setSelectedTask(task)}
                  >
                    <TableCell>
                      <div className="font-medium">{task.keywords.length} 个关键词</div>
                      <div className="mt-0.5 text-xs text-gray-400">
                        {task.brandName}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {task.platforms.map((p) => (
                          <Badge
                            key={p}
                            variant="secondary"
                            className={PLATFORM_COLORS[p]}
                          >
                            {AI_DETECT_PLATFORM_LABELS[p]}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Pill variant={STATUS_PILL_VARIANT[task.status]}>
                        {AI_DETECT_TASK_STATUS_LABELS[task.status]}
                      </Pill>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-24 overflow-hidden rounded-full bg-gray-100">
                          <div
                            className="h-full rounded-full bg-blue-500"
                            style={{
                              width: task.totalCount
                                ? `${(task.doneCount / task.totalCount) * 100}%`
                                : '0%',
                            }}
                          />
                        </div>
                        <span className="text-xs text-gray-500">
                          {task.doneCount}/{task.totalCount}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-gray-500">
                      {task.createdAt?.slice(0, 16).replace('T', ' ')}
                    </TableCell>
                    <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex justify-end gap-2">
                        {task.status === 'pending' && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => runMutation.mutate(task.id)}
                          >
                            <Play className="mr-1 h-3 w-3" />
                            运行
                          </Button>
                        )}
                        {(task.status === 'partial_failed' ||
                          task.status === 'paused') && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => retryMutation.mutate(task.id)}
                          >
                            <RotateCcw className="mr-1 h-3 w-3" />
                            重试
                          </Button>
                        )}
                        <Button size="sm" variant="ghost">
                          查看
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
          </Table>
        )}
      </TableShell>

      {showCreate && (
        <CreateTaskDialog
          open={showCreate}
          onClose={() => setShowCreate(false)}
          onSubmit={handleCreate}
          brandList={brandList}
          defaultBrandId={currentBrand}
          isLoading={createMutation.isPending}
          clientMode={user?.role === 'client'}
          platformsStatus={platformsStatus}
        />
      )}

      {selectedTask && displayTask && (
        <Dialog open={!!selectedTask} onOpenChange={(o) => !o && setSelectedTask(null)}>
          <DialogContent className="max-w-[900px] max-h-[90vh] overflow-hidden flex flex-col">
            <DialogHeader>
              <DialogTitle className="flex items-center justify-between">
                <span>检测任务详情</span>
                <Pill variant={STATUS_PILL_VARIANT[displayTask.status]}>
                  {AI_DETECT_TASK_STATUS_LABELS[displayTask.status]}
                </Pill>
              </DialogTitle>
            </DialogHeader>

            <div className="grid grid-cols-4 gap-3 py-2">
              <SummaryCard
                icon={<Target className="h-4 w-4 text-blue-500" />}
                label="AI 提及率"
                value={summary ? `${(summary.mentionRate * 100).toFixed(0)}%` : '-'}
                sub={
                  summary
                    ? AI_DETECT_PLATFORMS.map(
                        (p) =>
                          `${AI_DETECT_PLATFORM_LABELS[p]} ${(
                            (summary.mentionRateByPlatform[p] || 0) * 100
                          ).toFixed(0)}%`,
                      ).join(' · ')
                    : ''
                }
              />
              <SummaryCard
                icon={<Activity className="h-4 w-4 text-purple-500" />}
                label="平均位次"
                value={summary?.avgRank ? `第 ${summary.avgRank.toFixed(1)} 位` : '-'}
                sub={
                  summary
                    ? AI_DETECT_PLATFORMS.map((p) => {
                        const r = summary.avgRankByPlatform[p];
                        return `${AI_DETECT_PLATFORM_LABELS[p]} ${r ? `第${r.toFixed(1)}位` : '-'}`;
                      }).join(' · ')
                    : ''
                }
              />
              <SummaryCard
                icon={<Sparkles className="h-4 w-4 text-emerald-500" />}
                label="覆盖关键词"
                value={summary ? String(summary.coveredKeywords) : '-'}
                sub={`共 ${displayTask.keywords.length} 个词`}
              />
              <SummaryCard
                icon={<AlertTriangle className="h-4 w-4 text-orange-500" />}
                label="失败数"
                value={summary ? String(summary.failedCount) : '-'}
                sub={`总 ${displayTask.totalCount} 次调用`}
              />
            </div>

            {displayTask.status === 'running' && (
              <div className="mb-3 flex items-center gap-2 rounded-lg bg-blue-50 px-3 py-2 text-sm text-blue-700">
                <Loader2 className="h-4 w-4 animate-spin" />
                运行中：已完成 {displayTask.doneCount} / {displayTask.totalCount}
              </div>
            )}
            {displayTask.status === 'partial_failed' && displayTask.error && (
              <Alert variant="destructive" className="mb-3">
                <AlertDescription>{displayTask.error}</AlertDescription>
              </Alert>
            )}

            <div className="flex items-center justify-between border-t pt-3">
              <div className="text-sm text-gray-500">
                结果列表 · 共 {results.length} 条
              </div>
              {displayTask.status === 'partial_failed' && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => retryMutation.mutate(displayTask.id)}
                >
                  <RotateCcw className="mr-1 h-3 w-3" />
                  重试失败项
                </Button>
              )}
            </div>

            <div className="flex-1 min-h-0 overflow-auto">
              {resultsLoading ? (
                <div className="space-y-2 py-4">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className="h-10 w-full" />
                  ))}
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>关键词</TableHead>
                      <TableHead>平台</TableHead>
                      <TableHead>是否提及</TableHead>
                      <TableHead>位次</TableHead>
                      <TableHead>引用来源</TableHead>
                      <TableHead>耗时</TableHead>
                      <TableHead>HTTP</TableHead>
                      <TableHead>操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {results.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell className="font-medium">{r.keyword}</TableCell>
                        <TableCell>
                          <Badge
                            variant="secondary"
                            className={PLATFORM_COLORS[r.platform]}
                          >
                            {AI_DETECT_PLATFORM_LABELS[r.platform]}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {r.errorMessage ? (
                            <span className="flex items-center gap-1 text-red-500">
                              <XCircle className="h-3.5 w-3.5" />
                              失败
                            </span>
                          ) : r.isMentioned ? (
                            <span className="flex items-center gap-1 text-green-600">
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              提及
                            </span>
                          ) : (
                            <span className="flex items-center gap-1 text-gray-400">
                              <XCircle className="h-3.5 w-3.5" />
                              未提及
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-sm">
                          {r.mentionRank ? `第 ${r.mentionRank} 位` : '-'}
                        </TableCell>
                        <TableCell className="max-w-[160px] text-xs text-gray-500">
                          {r.sourceDomains?.length
                            ? r.sourceDomains.slice(0, 2).join('、') +
                              (r.sourceDomains.length > 2 ? '...' : '')
                            : '-'}
                        </TableCell>
                        <TableCell className="text-sm text-gray-500">
                          {r.latencyMs ? `${r.latencyMs}ms` : '-'}
                        </TableCell>
                        <TableCell className="text-sm">
                          <span
                            className={
                              r.httpStatus && r.httpStatus >= 200 && r.httpStatus < 300
                                ? 'text-green-600'
                                : 'text-red-500'
                            }
                          >
                            {r.httpStatus || '-'}
                          </span>
                        </TableCell>
                        <TableCell>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setShowResultDetail(r)}
                          >
                            <Eye className="mr-1 h-3 w-3" />
                            查看原文
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}

      {showResultDetail && (
        <Dialog open={!!showResultDetail} onOpenChange={(o) => !o && setShowResultDetail(null)}>
          <DialogContent className="max-w-[680px] max-h-[80vh] flex flex-col">
            <DialogHeader>
              <DialogTitle className="text-base">
                检测详情 · {showResultDetail.keyword} · {AI_DETECT_PLATFORM_LABELS[showResultDetail.platform]}
              </DialogTitle>
            </DialogHeader>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <div className="text-gray-400">模型</div>
                <div className="font-medium">{showResultDetail.modelName}</div>
              </div>
              <div>
                <div className="text-gray-400">执行时间</div>
                <div className="font-medium">
                  {showResultDetail.executedAt?.slice(0, 19).replace('T', ' ') || '-'}
                </div>
              </div>
              <div>
                <div className="text-gray-400">HTTP 状态</div>
                <div className="font-medium">
                  {showResultDetail.httpStatus || '-'}
                  {showResultDetail.errorMessage && (
                    <span className="ml-2 text-red-500">
                      {showResultDetail.errorMessage}
                    </span>
                  )}
                </div>
              </div>
              <div>
                <div className="text-gray-400">耗时</div>
                <div className="font-medium">
                  {showResultDetail.latencyMs ? `${showResultDetail.latencyMs}ms` : '-'}
                </div>
              </div>
              <div className="col-span-2">
                <div className="text-gray-400">提问</div>
                <div className="font-medium">{showResultDetail.question}</div>
              </div>
              {showResultDetail.isMentioned && (
                <>
                  <div>
                    <div className="text-gray-400">是否提及</div>
                    <div className="font-medium text-green-600">是</div>
                  </div>
                  <div>
                    <div className="text-gray-400">位次</div>
                    <div className="font-medium">
                      {showResultDetail.mentionRank
                        ? `第 ${showResultDetail.mentionRank} 位`
                        : showResultDetail.mentionPosition || '-'}
                    </div>
                  </div>
                </>
              )}
              {showResultDetail.competitorBrands?.length > 0 && (
                <div className="col-span-2">
                  <div className="text-gray-400">竞品提及</div>
                  <div className="font-medium">
                    {showResultDetail.competitorBrands.join('、')}
                  </div>
                </div>
              )}
            </div>
            <div className="mt-4">
              <div className="mb-1 text-sm text-gray-400">回答原文</div>
              <div className="max-h-[300px] overflow-auto rounded-lg border bg-gray-50 p-3 text-sm leading-relaxed whitespace-pre-wrap">
                {showResultDetail.rawAnswer || '（无回答内容）'}
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
};

interface SummaryCardProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
}

const SummaryCard: React.FC<SummaryCardProps> = ({ icon, label, value, sub }) => (
  <div className="rounded-lg border bg-gray-50 p-3">
    <div className="flex items-center gap-1.5 text-xs text-gray-500">
      {icon}
      {label}
    </div>
    <div className="mt-1 text-xl font-bold" style={{ color: '#0f172a' }}>
      {value}
    </div>
    {sub && <div className="mt-0.5 text-[11px] text-gray-400">{sub}</div>}
  </div>
);

const TaskListSkeleton: React.FC = () => (
  <div className="space-y-3">
    {Array.from({ length: 5 }).map((_, i) => (
      <Skeleton key={i} className="h-14 w-full" />
    ))}
  </div>
);

interface CreateTaskDialogProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (values: {
    brandId: string;
    keywords: string;
    hitWords: string;
    platforms: AiDetectPlatform[];
    concurrency: number;
  }) => void;
  brandList: Array<{ id: string; name: string }>;
  defaultBrandId: string;
  isLoading: boolean;
  clientMode?: boolean;
  platformsStatus?: AiDetectPlatformsStatusResponse;
}

const CreateTaskDialog: React.FC<CreateTaskDialogProps> = ({
  open,
  onClose,
  onSubmit,
  brandList,
  defaultBrandId,
  isLoading,
  clientMode,
  platformsStatus,
}) => {
  const [brandId, setBrandId] = useState(defaultBrandId);
  const [hitWordsText, setHitWordsText] = useState('');
  const [keywords, setKeywords] = useState('');
  const [platforms, setPlatforms] = useState<AiDetectPlatform[]>([
    'volcano',
    'qwen',
    'hunyuan',
  ]);
  const [concurrency, setConcurrency] = useState(3);

  useEffect(() => {
    if (open) {
      setBrandId(defaultBrandId);
      const defaultBrand = brandList.find((b) => b.id === defaultBrandId);
      setHitWordsText(defaultBrand?.name || '');
      setKeywords('');
      const statusMap = new Map<AiDetectPlatform, { configured: boolean }>(
        platformsStatus?.platforms?.map((p) => [p.platform, { configured: p.configured }]) ?? [],
      );
      const configuredPlatforms = AI_DETECT_PLATFORMS.filter(
        (p) => statusMap.get(p)?.configured ?? false,
      );
      setPlatforms(
        configuredPlatforms.length > 0 ? configuredPlatforms : [],
      );
      setConcurrency(3);
    }
  }, [open, defaultBrandId, brandList, platformsStatus]);

  useEffect(() => {
    if (!open) return;
    const brand = brandList.find((b) => b.id === brandId);
    if (brand) {
      setHitWordsText(brand.name);
    }
  }, [brandId, brandList, open]);

  const togglePlatform = (p: AiDetectPlatform) => {
    setPlatforms((prev) =>
      prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p],
    );
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-[520px]">
        <DialogHeader>
          <DialogTitle>新建检测任务</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>品牌</Label>
            <Select
              value={brandId}
              onValueChange={setBrandId}
              disabled={clientMode}
            >
              <SelectTrigger>
                <SelectValue placeholder="选择品牌" />
              </SelectTrigger>
              <SelectContent>
                {brandList.map((b) => (
                  <SelectItem key={b.id} value={b.id}>
                    {b.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>命中词（查询词）</Label>
            <Input
              value={hitWordsText}
              onChange={(e) => setHitWordsText(e.target.value)}
              placeholder="多个词用逗号分隔，例如：星美蛋糕,星美烘焙"
            />
            <p className="text-xs text-gray-400">
              AI 回答中出现任一词即判定为提及，建议把简称、常见别名都写进来
            </p>
          </div>

          <div className="space-y-2">
            <Label>关键词</Label>
            <textarea
              className="h-28 w-full rounded-md border border-gray-200 p-3 text-sm outline-none focus:border-blue-500"
              placeholder="每行一个关键词，或用逗号分隔&#10;例如：&#10;石家庄蛋糕店哪家好&#10;石家庄烘焙店推荐"
              value={keywords}
              onChange={(e) => setKeywords(e.target.value)}
            />
            <p className="text-xs text-gray-400">
              每个关键词 × 每个平台 = 一次检测，消耗 1 算力点
            </p>
          </div>

          <div className="space-y-2">
            <Label>检测平台</Label>
            <div className="flex flex-wrap gap-2">
              {AI_DETECT_PLATFORMS.map((p) => {
                const configured = platformsStatus?.platforms?.find((s) => s.platform === p)?.configured ?? false;
                const checked = platforms.includes(p);
                return (
                  <label
                    key={p}
                    className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors ${
                      !configured
                        ? 'cursor-not-allowed border-gray-100 bg-gray-50 text-gray-400'
                        : checked
                        ? 'border-blue-500 bg-blue-50 text-blue-700'
                        : 'border-gray-200 bg-white hover:border-gray-300'
                    }`}
                  >
                    <Checkbox
                      checked={checked}
                      disabled={!configured}
                      onCheckedChange={() => configured && togglePlatform(p)}
                    />
                    {AI_DETECT_PLATFORM_LABELS[p]}
                    <span
                      className={`ml-1 rounded px-1.5 py-0.5 text-[10px] font-medium ${
                        configured
                          ? 'bg-green-50 text-green-600'
                          : 'bg-gray-100 text-gray-400'
                      }`}
                    >
                      {configured ? '已接入' : '未接入'}
                    </span>
                  </label>
                );
              })}
            </div>
            <p className="text-xs text-gray-400">
              未接入的平台需先在 AI 模型接入中配置密钥
            </p>
          </div>

          <div className="space-y-2">
            <Label>并发数</Label>
            <Select
              value={String(concurrency)}
              onValueChange={(v) => setConcurrency(Number(v))}
            >
              <SelectTrigger className="w-[120px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[1, 2, 3, 5, 10].map((n) => (
                  <SelectItem key={n} value={String(n)}>
                    {n} 并发
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-gray-400">
              同时进行的 API 调用数，默认 3
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            取消
          </Button>
          <Button onClick={() => onSubmit({ brandId, keywords, hitWords: hitWordsText, platforms, concurrency })} disabled={isLoading}>
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                创建中
              </>
            ) : (
              <>
                <Plus className="mr-2 h-4 w-4" />
                创建任务
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default KeywordTasksPage;
