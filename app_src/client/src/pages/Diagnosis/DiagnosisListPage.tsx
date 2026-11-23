import React, { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  AlertCircle,
  RefreshCw,
  Plus,
  Trash2,
  FileText,
  Search,
  RotateCcw,
} from 'lucide-react';
import { Button } from '@client/src/components/ui/button';
import { Input } from '@client/src/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@client/src/components/ui/select';
import { Skeleton } from '@client/src/components/ui/skeleton';
import { DataPagination } from '@client/src/components/ui/data-pagination';
import { SectionCard } from '@client/src/components/layout/SectionCard';
import { Toolbar } from '@client/src/components/layout/Toolbar';
import { Pill } from '@client/src/components/layout/Pill';
import { EmptyState } from '@client/src/components/layout/EmptyState';

import { getBrands } from '@client/src/api/brands';
import {
  getDiagnosisTasks,
  deleteDiagnosisTask,
  retryDiagnosisTask,
} from '@client/src/api/diagnosis';
import {
  DIAGNOSIS_STATUS,
  DIAGNOSIS_STATUS_LABELS,
} from '@shared/api.interface';
import type { DiagnosisTask } from '@shared/api.interface';
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

const PRIMARY = '#2E7DFF';
const DANGER = '#EF4444';

const PAGE_SIZE = 10;

const getStatusVariant = (
  status: string,
): 'success' | 'info' | 'danger' | 'muted' => {
  switch (status) {
    case 'completed':
      return 'success';
    case 'running':
      return 'info';
    case 'failed':
      return 'danger';
    case 'pending':
    case 'demo':
    default:
      return 'muted';
  }
};

const DiagnosisListPage: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [page, setPage] = useState(1);
  const [brandId, setBrandId] = useState<string>('');
  const [status, setStatus] = useState<string>('');
  const [keyword, setKeyword] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingTask, setDeletingTask] = useState<DiagnosisTask | null>(null);

  const {
    data: tasksData,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['diagnosis', 'tasks', page, brandId, status, keyword],
    queryFn: () =>
      getDiagnosisTasks({
        page,
        pageSize: PAGE_SIZE,
        brandId: brandId || undefined,
        status: (status as any) || undefined,
        keyword: keyword || undefined,
      }),
  });

  const { data: brandOptions = [] } = useQuery({
    queryKey: ['brands', 'options'],
    queryFn: () => getBrands(),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteDiagnosisTask,
    retry: false,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['diagnosis', 'tasks'] });
      toast.success('删除成功');
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.error?.message ?? '删除失败';
      toast.error(msg);
    },
  });

  const retryMutation = useMutation({
    mutationFn: retryDiagnosisTask,
    retry: false,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['diagnosis', 'tasks'] });
      toast.success('已重新排队，请稍候');
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.error?.message ?? '重试失败';
      toast.error(msg);
    },
  });

  const totalCount = tasksData?.total ?? 0;

  const handleBrandChange = (v: string) => {
    setBrandId(v);
    setPage(1);
  };

  const handleStatusChange = (v: string) => {
    setStatus(v);
    setPage(1);
  };

  const handleSearch = () => {
    setKeyword(searchInput.trim());
    setPage(1);
  };

  const handleViewReport = (task: DiagnosisTask) => {
    if (task.reportId) {
      navigate(`/diagnosis/${task.reportId}`);
    } else {
      toast.info('报告尚未生成，请稍候');
    }
  };

  const handleDelete = (task: DiagnosisTask) => {
    setDeletingTask(task);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (deletingTask) {
      deleteMutation.mutate(deletingTask.id);
      setDeleteDialogOpen(false);
    }
  };

  const formatDateTime = (dateStr: string | null): string => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleString('zh-CN');
  };

  const isEmpty = !isLoading && !isError && tasksData && tasksData.items.length === 0;

  return (
    <div className="flex flex-col gap-6">
      <SectionCard
        title="诊断报告"
        count={totalCount}
        actions={
          <Link to="/diagnosis/new">
            <Button size="sm" style={{ backgroundColor: PRIMARY }}>
              <Plus className="h-4 w-4" />
              发起诊断
            </Button>
          </Link>
        }
      >
        {/* 筛选工具栏 */}
        <div className="mb-4">
          <Toolbar>
            <div className="relative w-[240px]">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="搜索品牌或城市"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSearch();
                }}
                className="h-9 pl-9"
              />
            </div>
            <Select value={brandId} onValueChange={handleBrandChange}>
              <SelectTrigger className="h-9 w-[160px]">
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
            <Select value={status} onValueChange={handleStatusChange}>
              <SelectTrigger className="h-9 w-[140px]">
                <SelectValue placeholder="全部状态" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">全部状态</SelectItem>
                {DIAGNOSIS_STATUS.map((s) => (
                  <SelectItem key={s} value={s}>
                    {DIAGNOSIS_STATUS_LABELS[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={handleSearch}>
              搜索
            </Button>
          </Toolbar>
        </div>

        {/* 错误态 */}
        {isError && (
          <div
            className="mb-4 flex items-center justify-between rounded-lg border p-4"
            style={{
              borderColor: 'rgba(220, 38, 38, 0.3)',
              backgroundColor: 'rgba(220, 38, 38, 0.05)',
            }}
          >
            <div className="flex items-center gap-2 text-sm" style={{ color: DANGER }}>
              <AlertCircle className="h-4 w-4" />
              <span>数据加载失败，请重试</span>
            </div>
            <button
              onClick={() => refetch()}
              className="flex items-center gap-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors hover:bg-red-100"
              style={{ color: DANGER }}
            >
              <RefreshCw className="h-3.5 w-3.5" />
              重试
            </button>
          </div>
        )}

        {/* 加载态 */}
        {isLoading && <CardRowSkeleton />}

        {/* 列表 */}
        {!isLoading && !isError && tasksData && tasksData.items.length > 0 && (
          <div className="space-y-2">
            {tasksData.items.map((task: DiagnosisTask) => (
              <div
                key={task.id}
                className="flex items-center gap-4 rounded-lg border p-4 bg-white hover:bg-[#F8FAFC] transition-colors"
                style={{ borderColor: '#E6EAF2' }}
              >
                {/* 左侧信息区 */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[14px] font-semibold text-[#0F172A]">
                      {task.brandName}
                    </span>
                    {task.isDemo && (
                      <Pill variant="muted">演示</Pill>
                    )}
                  </div>
                  <div className="mt-1 text-[12px] text-[#94A3B8]">
                    {task.city && task.category
                      ? `${task.city} · ${task.category}`
                      : task.city || task.category || '-'}
                  </div>
                </div>

                {/* 状态胶囊 */}
                <div style={{ width: 160 }}>
                  {task.status === 'failed' && task.error ? (
                    <span title={task.error} style={{ cursor: 'help' }}>
                      <Pill variant={getStatusVariant(task.status)}>
                        {DIAGNOSIS_STATUS_LABELS[task.status] ?? task.status}
                      </Pill>
                    </span>
                  ) : task.status === 'running' ? (
                    <Pill variant={getStatusVariant(task.status)}>
                      诊断中 {task.completedCount}/{task.totalCount || '?'}
                    </Pill>
                  ) : (
                    <Pill variant={getStatusVariant(task.status)}>
                      {DIAGNOSIS_STATUS_LABELS[task.status] ?? task.status}
                    </Pill>
                  )}
                </div>

                {/* 创建时间 */}
                <div
                  className="text-[12px] tabular-nums hidden md:block"
                  style={{ color: '#94A3B8', width: 170, textAlign: 'right' }}
                >
                  {formatDateTime(task.createdAt)}
                </div>

                {/* 操作区 */}
                <div className="flex items-center justify-end gap-2" style={{ width: 140 }}>
                  {task.status === 'failed' ? (
                    <Button
                      size="sm"
                      onClick={() => retryMutation.mutate(task.id)}
                      disabled={retryMutation.isPending}
                      style={{ backgroundColor: DANGER }}
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                      {retryMutation.isPending ? '重试中...' : '重试'}
                    </Button>
                  ) : task.reportId ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleViewReport(task)}
                      style={{ color: PRIMARY }}
                    >
                      查看报告
                    </Button>
                  ) : (
                    <span className="text-[13px]" style={{ color: '#94A3B8' }}>
                      生成中
                    </span>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => handleDelete(task)}
                    disabled={deleteMutation.isPending}
                    aria-label="删除"
                    style={{ color: '#94A3B8' }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* 空态 */}
        {isEmpty && (
          <EmptyState
            icon={<FileText />}
            description="还没有诊断报告，发起一次品牌诊断开始"
            action={
              <Link to="/diagnosis/new">
                <Button size="sm" style={{ backgroundColor: PRIMARY }}>
                  <Plus className="h-4 w-4" />
                  发起诊断
                </Button>
              </Link>
            }
          />
        )}

        {/* 分页 */}
        {tasksData && tasksData.total > PAGE_SIZE && (
          <div className="mt-4 flex justify-end">
            <DataPagination
              total={tasksData.total}
              page={page}
              pageSize={PAGE_SIZE}
              onPageChange={setPage}
              onPageSizeChange={(size) => {
                // keep PAGE_SIZE constant for this page
              }}
            />
          </div>
        )}
      </SectionCard>

      {/* 删除确认弹窗 */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除</AlertDialogTitle>
            <AlertDialogDescription>
              确定要删除「{deletingTask?.brandName}」的诊断任务吗？
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              style={{ backgroundColor: DANGER }}
            >
              确认删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

function CardRowSkeleton() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 5 }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-4 rounded-lg border p-4"
          style={{ borderColor: '#E6EAF2', backgroundColor: '#fff' }}
        >
          <div className="flex-1 min-w-0 space-y-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-48" />
          </div>
          <Skeleton className="h-6 w-20 rounded-full" />
          <Skeleton className="h-3 w-28 hidden md:block" />
          <div className="flex items-center gap-2" style={{ width: 140 }}>
            <Skeleton className="h-8 w-16 rounded-md" />
            <Skeleton className="h-8 w-8 rounded-md" />
          </div>
        </div>
      ))}
    </div>
  );
}

export default DiagnosisListPage;
