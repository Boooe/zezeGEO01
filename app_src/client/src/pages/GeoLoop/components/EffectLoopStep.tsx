import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowRight,
  Sparkles,
  Stethoscope,
  Send as SendIcon,
  Globe,
  FileBarChart,
  AlertCircle,
  CheckCircle2,
  Clock,
  Play,
} from 'lucide-react';
import { toast } from 'sonner';
import { Link } from 'react-router-dom';
import { Button } from '@client/src/components/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@client/src/components/ui/card';
import { Badge } from '@client/src/components/ui/badge';
import { Checkbox } from '@client/src/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@client/src/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@client/src/components/ui/table';
import { DataTable } from '@client/src/components/layout';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@client/src/components/ui/select';
import { Skeleton } from '@client/src/components/ui/skeleton';
import { getApiErrorMessage } from '@client/src/lib/api-error';
import {
  getGapsByBrand,
  dispatchGapsAsTasks,
  getActionItemsByBrand,
  adoptAutoSuggestions,
  updateActionItemStatus,
} from '@client/src/api/geo-loop';
import type { ContentGap, ActionItem } from '@shared/api.interface';
import {
  GAP_PRIORITY_LABELS,
  GAP_STATUS_LABELS,
  ACTION_TYPE_LABELS,
  ACTION_PRIORITY_LABELS,
  ACTION_STATUS_LABELS,
  type GapPriority,
  type GapStatus,
  type ActionStatus,
  type ActionPriority,
} from '@shared/api.interface';

interface CardProps {
  brandId: string;
  showSkeleton?: boolean;
}

const MODULE_LINKS = [
  { label: '品牌诊断', to: '/diagnosis?tab=reports', icon: Stethoscope },
  { label: '发布记录', to: '/publish?tab=records', icon: SendIcon },
  { label: '站群管理', to: '/sites?tab=settings', icon: Globe },
  { label: '结案报告', to: '/clients?tab=reports', icon: FileBarChart },
];

/* ---------- 空品牌态 ---------- */

export function EmptyBrandState() {
  return (
    <Card className="p-10">
      <div className="flex flex-col items-center text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100">
          <AlertCircle className="h-8 w-8 text-slate-400" />
        </div>
        <h3 className="mt-4 text-lg font-semibold text-slate-800">
          请先选择品牌
        </h3>
        <p className="mt-2 max-w-md text-sm text-slate-500">
          选择品牌后即可查看效果闭环数据
        </p>
      </div>
    </Card>
  );
}

/* ---------- 竞对差距（7列表格） ---------- */

export function GapAnalysisCard({ brandId, showSkeleton }: CardProps) {
  const queryClient = useQueryClient();
  const [keywordFilter, setKeywordFilter] = useState<string>('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [successDialogOpen, setSuccessDialogOpen] = useState(false);
  const [dispatchedTasks, setDispatchedTasks] = useState<
    { gapId: string; title: string }[]
  >([]);

  const {
    data: gaps,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['geo-loop', 'gaps', brandId, keywordFilter],
    queryFn: () =>
      getGapsByBrand(brandId, keywordFilter || undefined),
  });

  const dispatchMutation = useMutation({
    mutationFn: (ids: string[]) => dispatchGapsAsTasks(ids, brandId),
    retry: false,
    onSuccess: (data) => {
      queryClient.invalidateQueries({
        queryKey: ['geo-loop', 'gaps', brandId],
      });
      setDispatchedTasks(data.tasks);
      setSuccessDialogOpen(true);
      setSelectedIds(new Set());
    },
    onError: (err) => {
      toast.error(getApiErrorMessage(err, '派发失败'));
    },
  });

  const keywordOptions = useMemo(() => {
    if (!gaps) return [] as string[];
    const set = new Set(gaps.map((g) => g.keyword));
    return Array.from(set);
  }, [gaps]);

  const openDispatchable = useMemo(() => {
    if (!gaps) return 0;
    return gaps.filter(
      (g) => selectedIds.has(g.id) && g.status === 'open',
    ).length;
  }, [gaps, selectedIds]);

  const toggleSelect = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedIds(next);
  };

  const handleDispatch = () => {
    if (openDispatchable === 0) return;
    const openIds = gaps
      ?.filter((g) => selectedIds.has(g.id) && g.status === 'open')
      .map((g) => g.id);
    if (openIds?.length) {
      dispatchMutation.mutate(openIds);
    }
  };

  return (
    <div className="min-w-0">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="text-[12px] text-[#94A3B8] shrink-0">关键词</span>
          <Select
            value={keywordFilter}
            onValueChange={setKeywordFilter}
          >
            <SelectTrigger className="h-8 w-48">
              <SelectValue placeholder="全部关键词" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">全部关键词</SelectItem>
              {keywordOptions.map((kw) => (
                <SelectItem key={kw} value={kw}>
                  {kw}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button
          size="sm"
          onClick={handleDispatch}
          disabled={openDispatchable === 0 || dispatchMutation.isPending}
        >
          转成创作任务
        </Button>
      </div>
      {showSkeleton || isLoading ? (
        <GapSkeleton />
      ) : isError ? (
        <ErrorState onRetry={refetch} />
      ) : !gaps?.length ? (
        <EmptyState text="暂无竞对差距数据" />
      ) : (
        <>
          <DataTable
            rowKey="id"
            data={gaps}
            emptyText="暂无竞对差距数据"
            columns={[
              {
                key: 'select',
                title: '',
                width: '6%',
                render: (row: ContentGap) => (
                  <Checkbox
                    checked={selectedIds.has(row.id)}
                    onCheckedChange={() => toggleSelect(row.id)}
                    disabled={row.status !== 'open'}
                    aria-label={`选择 ${row.keyword}`}
                  />
                ),
              },
              {
                key: 'keyword',
                title: '关键词',
                width: '22%',
                render: (row: ContentGap) => (
                  <span className="text-[13px] font-medium text-[#0F172A] break-words">
                    {row.keyword}
                  </span>
                ),
              },
              {
                key: 'ourCited',
                title: '我方引用',
                width: '12%',
                render: (row: ContentGap) => (
                  row.ourCited ? (
                    <Badge className="bg-[#F0FDF4] text-[#16A34A] border-[#BBF7D0] text-[12px] font-normal">
                      已引用
                    </Badge>
                  ) : (
                    <Badge className="bg-[#FEF2F2] text-[#DC2626] border-[#FECACA] text-[12px] font-normal">
                      未引用
                    </Badge>
                  )
                ),
              },
              {
                key: 'competitor',
                title: '竞对',
                width: '14%',
                render: (row: ContentGap) => (
                  <div className="min-w-0 space-y-0.5">
                    <div className="text-[13px] font-medium text-[#0F172A] break-words">
                      {row.competitorName}
                    </div>
                    {row.competitorDomain && (
                      <div className="text-[12px] text-[#94A3B8] break-all">
                        {row.competitorDomain}
                      </div>
                    )}
                  </div>
                ),
              },
              {
                key: 'source',
                title: '竞对来源',
                width: '20%',
                render: (row: ContentGap) => (
                  <span className="text-[12px] text-[#94A3B8] break-words">
                    {row.ourSourceDomain || (row.gapType === 'citation' || !row.gapType ? 'AI 回答引用' : row.gapType)}
                  </span>
                ),
              },
              {
                key: 'priority',
                title: '优先级',
                width: '10%',
                render: (row: ContentGap) => (
                  <PriorityBadge priority={row.priority} />
                ),
              },
              {
                key: 'status',
                title: '状态',
                width: '16%',
                render: (row: ContentGap) => (
                  <GapStatusBadge status={row.status} />
                ),
              },
            ]}
          />
        </>
      )}

      <DispatchSuccessDialog
        open={successDialogOpen}
        onOpenChange={setSuccessDialogOpen}
        tasks={dispatchedTasks}
        count={dispatchedTasks.length}
      />
    </div>
  );
}

function GapSkeleton() {
  return (
    <div className="space-y-2">
      <Skeleton className="h-8 w-48" />
      <div className="space-y-1">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="flex h-11 items-center gap-3 border-b border-[#EEF2F7] pl-2"
          >
            <Skeleton className="h-4 w-4" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-5 w-12" />
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-5 w-10" />
            <Skeleton className="h-5 w-12" />
          </div>
        ))}
      </div>
    </div>
  );
}

function GapRow({
  gap,
  checked,
  onToggle,
}: {
  gap: ContentGap;
  checked: boolean;
  onToggle: () => void;
}) {
  const isHigh = gap.priority === 'high';
  return (
    <TableRow
      className={
        'h-11 ' +
        (isHigh ? 'border-l-2 border-l-red-500' : '')
      }
    >
      <TableCell className="w-8 px-2">
        <Checkbox
          checked={checked}
          onCheckedChange={onToggle}
          disabled={gap.status !== 'open'}
          aria-label={`选择 ${gap.keyword}`}
        />
      </TableCell>
      <TableCell className="px-3">
        <div
          className="text-sm font-medium text-slate-800 line-clamp-2 break-words min-w-0"
          title={gap.keyword}
        >
          {gap.keyword}
        </div>
      </TableCell>
      <TableCell className="px-3">
        {gap.ourCited ? (
          <Badge className="h-5 whitespace-nowrap bg-emerald-50 px-1.5 text-[11px] text-emerald-600 border-emerald-100 border">
            已引用
          </Badge>
        ) : (
          <Badge className="h-5 whitespace-nowrap bg-red-50 px-1.5 text-[11px] text-red-500 border-red-100 border">
            未引用
          </Badge>
        )}
      </TableCell>
      <TableCell className="px-3">
        <div className="space-y-0.5 min-w-0">
          <div
            className="text-sm font-medium text-slate-800 truncate"
            title={gap.competitorName}
          >
            {gap.competitorName}
          </div>
          {gap.competitorDomain && (
            <div
              className="text-[12px] text-slate-400 break-all"
              title={gap.competitorDomain}
            >
              {gap.competitorDomain}
            </div>
          )}
        </div>
      </TableCell>
      <TableCell className="px-3">
        <div
          className="text-xs text-slate-500 break-words min-w-0"
          title={gap.ourSourceDomain || (gap.gapType === 'citation' || !gap.gapType ? 'AI 回答引用' : gap.gapType)}
        >
          {gap.ourSourceDomain || (gap.gapType === 'citation' || !gap.gapType ? 'AI 回答引用' : gap.gapType)}
        </div>
      </TableCell>
      <TableCell className="px-3">
        <PriorityBadge priority={gap.priority} />
      </TableCell>
      <TableCell className="px-3">
        <GapStatusBadge status={gap.status} />
      </TableCell>
    </TableRow>
  );
}

function PriorityBadge({ priority }: { priority: GapPriority }) {
  const colorMap: Record<GapPriority, string> = {
    high: 'bg-red-50 text-red-500 border-red-100',
    medium: 'bg-amber-50 text-amber-600 border-amber-100',
    low: 'bg-slate-100 text-slate-500 border-slate-200',
  };
  return (
    <Badge
      variant="outline"
      className={'h-5 px-1.5 text-[11px] font-normal whitespace-nowrap ' + colorMap[priority]}
    >
      {GAP_PRIORITY_LABELS[priority]}
    </Badge>
  );
}

function GapStatusBadge({ status }: { status: GapStatus }) {
  const colorMap: Record<GapStatus, string> = {
    open: 'bg-slate-100 text-slate-600 border-slate-200',
    dispatched: 'bg-blue-50 text-blue-600 border-blue-100',
    resolved: 'bg-emerald-50 text-emerald-600 border-emerald-100',
    ignored: 'bg-slate-50 text-slate-400 border-slate-100',
  };
  return (
    <Badge
      variant="outline"
      className={'h-5 px-1.5 text-[11px] font-normal whitespace-nowrap ' + colorMap[status]}
    >
      {GAP_STATUS_LABELS[status]}
    </Badge>
  );
}

function DispatchSuccessDialog({
  open,
  onOpenChange,
  tasks,
  count,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  tasks: { gapId: string; title: string }[];
  count: number;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-emerald-500" />
            派发成功
          </DialogTitle>
          <DialogDescription>
            已派发 <span className="font-semibold tnum">{count}</span> 个创作任务
          </DialogDescription>
        </DialogHeader>
        {tasks.length > 0 && (
          <div className="max-h-60 overflow-y-auto rounded-md border border-slate-100">
            <ul className="divide-y divide-slate-100">
              {tasks.map((t) => (
                <li key={t.gapId} className="px-3 py-2 text-sm text-slate-700 break-words min-w-0">
                  {t.title}
                </li>
              ))}
            </ul>
          </div>
        )}
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            size="sm"
          >
            关闭
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ---------- 优化建议清单（5列表格） ---------- */

export function ActionItemsCard({ brandId, showSkeleton }: CardProps) {
  const queryClient = useQueryClient();

  const {
    data: items,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['geo-loop', 'action-items', brandId],
    queryFn: () => getActionItemsByBrand(brandId),
  });

  const adoptMutation = useMutation({
    mutationFn: () => adoptAutoSuggestions(brandId),
    retry: false,
    onSuccess: (data) => {
      queryClient.invalidateQueries({
        queryKey: ['geo-loop', 'action-items', brandId],
      });
      toast.success(`已采纳 ${data.count} 条系统建议`);
    },
    onError: (err) => {
      toast.error(getApiErrorMessage(err, '采纳失败'));
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: ActionStatus }) =>
      updateActionItemStatus(id, status),
    retry: false,
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['geo-loop', 'action-items', brandId],
      });
    },
    onError: (err) => {
      toast.error(getApiErrorMessage(err, '状态更新失败'));
    },
  });

  // 按优先级排序：高 → 中 → 低
  const sortedItems = useMemo(() => {
    if (!items) return [] as ActionItem[];
    const priorityOrder: Record<ActionPriority, number> = {
      high: 0,
      medium: 1,
      low: 2,
    };
    return [...items].sort(
      (a, b) => priorityOrder[a.priority] - priorityOrder[b.priority],
    );
  }, [items]);

  const cycleStatus = (current: ActionStatus): ActionStatus => {
    if (current === 'pending') return 'in_progress';
    if (current === 'in_progress') return 'done';
    return 'pending';
  };

  const handleStatusClick = (id: string, current: ActionStatus) => {
    const next = cycleStatus(current);
    updateStatusMutation.mutate({ id, status: next });
  };

  return (
    <div className="min-w-0">
      <div className="flex justify-end mb-4">
        <Button
          size="sm"
          onClick={() => adoptMutation.mutate()}
          disabled={adoptMutation.isPending}
        >
          <Sparkles
            className={
              'h-3.5 w-3.5 ' +
              (adoptMutation.isPending ? 'animate-spin' : '')
            }
          />
          一键采纳建议
        </Button>
      </div>
      {showSkeleton || isLoading ? (
        <ActionItemsSkeleton />
      ) : isError ? (
        <ErrorState onRetry={refetch} />
      ) : !items?.length ? (
        <EmptyState text="暂无优化建议，点击右上角一键采纳系统建议" />
      ) : (
        <DataTable
          rowKey="id"
          data={sortedItems}
          emptyText="暂无优化建议"
          columns={[
            {
              key: 'priority',
              title: '优先级',
              width: '10%',
              render: (row: ActionItem) => (
                <ActionPriorityBadge priority={row.priority} />
              ),
            },
            {
              key: 'type',
              title: '类型',
              width: '10%',
              render: (row: ActionItem) => (
                <span className="text-[12px] text-[#94A3B8]">
                  {ACTION_TYPE_LABELS[row.itemType]}
                </span>
              ),
            },
            {
              key: 'title',
              title: '建议标题',
              width: '55%',
              render: (row: ActionItem) => (
                <span className="text-[13px] font-medium text-[#0F172A] break-words leading-snug">
                  {row.title}
                </span>
              ),
            },
            {
              key: 'status',
              title: '状态',
              width: '15%',
              render: (row: ActionItem) => (
                <button
                  onClick={() => handleStatusClick(row.id, row.status)}
                  className="inline-flex"
                  aria-label="切换状态"
                >
                  <ActionStatusBadge status={row.status} />
                </button>
              ),
            },
            {
              key: 'action',
              title: '操作',
              width: '10%',
              render: (row: ActionItem) => (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleStatusClick(row.id, row.status)}
                  className="h-7 px-2 text-xs text-[#2563EB]"
                >
                  <StatusCycleIcon status={row.status} />
                  <StatusCycleLabel status={row.status} />
                </Button>
              ),
            },
          ]}
        />
      )}
    </div>
  );
}

function ActionItemsSkeleton() {
  return (
    <div className="space-y-1">
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className="flex h-11 items-center gap-3 border-b border-slate-100 px-3"
        >
          <Skeleton className="h-5 w-10" />
          <Skeleton className="h-4 w-10" />
          <Skeleton className="h-4 flex-1" />
          <Skeleton className="h-5 w-14" />
          <Skeleton className="h-6 w-12" />
        </div>
      ))}
    </div>
  );
}

function ActionPriorityBadge({ priority }: { priority: ActionPriority }) {
  const colorMap: Record<ActionPriority, string> = {
    high: 'bg-red-50 text-red-500 border-red-100',
    medium: 'bg-amber-50 text-amber-600 border-amber-100',
    low: 'bg-slate-100 text-slate-500 border-slate-200',
  };
  return (
    <Badge
      variant="outline"
      className={'h-5 px-1.5 text-[11px] font-normal whitespace-nowrap ' + colorMap[priority]}
    >
      {ACTION_PRIORITY_LABELS[priority]}
    </Badge>
  );
}

function ActionStatusBadge({ status }: { status: ActionStatus }) {
  const colorMap: Record<ActionStatus, string> = {
    pending: 'bg-slate-100 text-slate-600 border-slate-200',
    in_progress: 'bg-blue-50 text-blue-600 border-blue-100',
    done: 'bg-emerald-50 text-emerald-600 border-emerald-100',
  };
  return (
    <Badge
      variant="outline"
      className={'h-5 px-1.5 text-[11px] font-normal whitespace-nowrap ' + colorMap[status]}
    >
      {ACTION_STATUS_LABELS[status]}
    </Badge>
  );
}

function StatusCycleIcon({ status }: { status: ActionStatus }) {
  if (status === 'pending')
    return <Clock className="h-3.5 w-3.5 text-slate-500" />;
  if (status === 'in_progress')
    return <Play className="h-3.5 w-3.5 text-blue-500" />;
  return <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />;
}

function StatusCycleLabel({ status }: { status: ActionStatus }) {
  if (status === 'pending') return '开始';
  if (status === 'in_progress') return '完成';
  return '重置';
}

/* ---------- 模块入口链接区 ---------- */

export function ModuleLinksSection() {
  return (
    <Card className="p-5">
      <div className="mb-3 text-sm font-semibold text-slate-700">
        已有模块入口
      </div>
      <div className="grid grid-cols-4 gap-3">
        {MODULE_LINKS.map((link) => {
          const LinkIcon = link.icon;
          return (
            <Link
              key={link.label}
              to={link.to}
              className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white p-3 transition-all hover:border-[#2E7DFF] hover:bg-blue-50/50"
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-[#2E7DFF]">
                <LinkIcon className="h-4 w-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-slate-800 truncate">
                  {link.label}
                </div>
              </div>
              <ArrowRight className="h-4 w-4 text-slate-400 shrink-0" />
            </Link>
          );
        })}
      </div>
    </Card>
  );
}

/* ---------- 通用 ---------- */

function EmptyState({ text }: { text: string }) {
  return (
    <div className="flex h-40 flex-col items-center justify-center text-center">
      <div className="text-sm text-slate-400">{text}</div>
    </div>
  );
}

function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex h-40 flex-col items-center justify-center text-center">
      <AlertCircle className="mb-2 h-8 w-8 text-red-400" />
      <p className="mb-2 text-sm text-slate-500">加载失败</p>
      <Button variant="outline" size="sm" onClick={onRetry}>
        重试
      </Button>
    </div>
  );
}
