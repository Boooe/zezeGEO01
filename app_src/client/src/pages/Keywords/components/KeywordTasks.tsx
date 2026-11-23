import React, { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Play,
  Search,
  RefreshCw,
  AlertCircle,
  CheckSquare,
  Square,
} from 'lucide-react';
import { SectionCard } from '@client/src/components/layout/SectionCard';
import { Toolbar } from '@client/src/components/layout/Toolbar';
import { Pill } from '@client/src/components/layout/Pill';
import { DataTable } from '@client/src/components/layout/DataTable';
import { Button } from '@client/src/components/ui/button';
import { Input } from '@client/src/components/ui/input';
import { Checkbox } from '@client/src/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@client/src/components/ui/select';
import { Skeleton } from '@client/src/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from '@client/src/components/ui/dialog';
import {
  getKeywordTasks,
  batchCreateTasks,
  getKeywords,
  getBrandList,
} from '@client/src/api/keywords';
import {
  TASK_STATUS_LABELS,
  TASK_STATUS,
  PLATFORM_LABELS,
  PLATFORMS,
} from '@shared/api.interface';
import type { KeywordTask, Platform } from '@shared/api.interface';

const PRIMARY = '#1e40af';
const SUCCESS = '#10b981';
const DANGER = '#ef4444';
const MUTED = '#64748b';

const STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  pending: { bg: 'rgba(100, 116, 139, 0.1)', color: MUTED },
  running: { bg: 'rgba(30, 64, 175, 0.1)', color: PRIMARY },
  completed: { bg: 'rgba(16, 185, 129, 0.1)', color: SUCCESS },
  failed: { bg: 'rgba(239, 68, 68, 0.1)', color: DANGER },
};

const PAGE_SIZE = 10;

const KeywordTasks = () => {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [brandId, setBrandId] = useState<string>('');
  const [status, setStatus] = useState<string>('');

  const {
    data: tasksData,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['keywords', 'tasks', page, brandId, status],
    queryFn: () =>
      getKeywordTasks({
        page,
        pageSize: PAGE_SIZE,
        brandId: brandId || undefined,
        status: status || undefined,
      }),
  });

  const { data: brandOptions = [] } = useQuery({
    queryKey: ['brands', 'options'],
    queryFn: getBrandList,
  });

  /* ---------- 批量发起检测弹窗 ---------- */
  const [batchOpen, setBatchOpen] = useState(false);
  const [batchBrandId, setBatchBrandId] = useState<string>('');
  const [keywordSearch, setKeywordSearch] = useState<string>('');
  const [selectedKwIds, setSelectedKwIds] = useState<Set<string>>(new Set());
  const [selectedPlatforms, setSelectedPlatforms] = useState<Set<Platform>>(
    new Set(['baidu']),
  );

  const { data: kwOptions } = useQuery({
    queryKey: ['keywords', 'for-task', batchBrandId, keywordSearch],
    queryFn: () =>
      getKeywords({
        page: 1,
        pageSize: 100,
        brandId: batchBrandId || undefined,
        keyword: keywordSearch || undefined,
      }),
    enabled: !!batchBrandId && batchOpen,
  });

  const allKwIds = kwOptions?.items.map((k) => k.id) ?? [];
  const allSelected =
    allKwIds.length > 0 && allKwIds.every((id) => selectedKwIds.has(id));
  const someSelected =
    allKwIds.some((id) => selectedKwIds.has(id)) && !allSelected;

  const toggleAll = () => {
    if (allSelected) {
      setSelectedKwIds(new Set());
    } else {
      setSelectedKwIds(new Set(allKwIds));
    }
  };

  const toggleKw = (id: string) => {
    const next = new Set(selectedKwIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedKwIds(next);
  };

  const togglePlatform = (p: Platform) => {
    const next = new Set(selectedPlatforms);
    if (next.has(p)) next.delete(p);
    else next.add(p);
    setSelectedPlatforms(next);
  };

  const batchMutation = useMutation({
    mutationFn: batchCreateTasks,
    retry: false,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['keywords', 'tasks'] });
      setBatchOpen(false);
      setBatchBrandId('');
      setSelectedKwIds(new Set());
      setKeywordSearch('');
    },
  });

  const handleBatchSubmit = () => {
    if (!batchBrandId || selectedKwIds.size === 0 || selectedPlatforms.size === 0) return;
    batchMutation.mutate({
      brandId: batchBrandId,
      keywordIds: Array.from(selectedKwIds),
      platforms: Array.from(selectedPlatforms),
    });
  };

  const handleBrandChange = (v: string) => {
    setBatchBrandId(v);
    setSelectedKwIds(new Set());
  };

  return (
    <SectionCard
      title="检测任务"
      count={tasksData?.total ?? 0}
      actions={
        <Button
          size="sm"
          className="h-9 bg-[#2E7DFF] text-white hover:bg-[#1E5FD6]"
          onClick={() => setBatchOpen(true)}
        >
          <Play className="h-3.5 w-3.5" />
          批量发起检测
        </Button>
      }
    >
      <Toolbar>
        <Select value={brandId} onValueChange={setBrandId}>
          <SelectTrigger className="h-9 w-[140px]">
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
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="h-9 w-[120px]">
            <SelectValue placeholder="全部状态" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">全部状态</SelectItem>
            {TASK_STATUS.map((s) => (
              <SelectItem key={s} value={s}>
                {TASK_STATUS_LABELS[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          size="sm"
          variant="outline"
          className="h-9"
          onClick={() => refetch()}
        >
          <RefreshCw className="h-3.5 w-3.5" />
          刷新
        </Button>
      </Toolbar>

      {/* 批量发起检测弹窗 */}
      <Dialog open={batchOpen} onOpenChange={setBatchOpen}>
        <DialogContent className="sm:max-w-2xl">
                <DialogHeader>
                  <DialogTitle>批量发起检测</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-2 max-h-[60vh] overflow-y-auto">
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">选择品牌</label>
                    <Select value={batchBrandId} onValueChange={handleBrandChange}>
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

                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">选择平台</label>
                    <div className="flex flex-wrap gap-3 pt-1">
                      {PLATFORMS.map((p) => (
                        <label
                          key={p}
                          className="flex items-center gap-2 cursor-pointer"
                        >
                          <Checkbox
                            checked={selectedPlatforms.has(p)}
                            onCheckedChange={() => togglePlatform(p)}
                          />
                          <span className="text-sm">{PLATFORM_LABELS[p]}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-sm font-medium">
                        选择关键词
                      </label>
                      <span className="text-xs text-muted-foreground">
                        已选 {selectedKwIds.size} 个
                      </span>
                    </div>
                    {batchBrandId ? (
                      <>
                        <div className="relative">
                          <Search
                            className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4"
                            style={{ color: MUTED }}
                          />
                          <Input
                            placeholder="搜索关键词"
                            value={keywordSearch}
                            onChange={(e) => setKeywordSearch(e.target.value)}
                            className="pl-9 h-9"
                          />
                        </div>
                        <div className="rounded-md border max-h-[240px] overflow-y-auto">
                          <div className="flex items-center gap-2 px-3 py-2 border-b bg-slate-50 sticky top-0">
                            {allSelected ? (
                              <CheckSquare
                                className="h-4 w-4 cursor-pointer"
                                style={{ color: PRIMARY }}
                                onClick={toggleAll}
                              />
                            ) : someSelected ? (
                              <div
                                className="h-4 w-4 rounded cursor-pointer flex items-center justify-center border"
                                style={{
                                  borderColor: PRIMARY,
                                  backgroundColor: PRIMARY,
                                }}
                                onClick={toggleAll}
                              >
                                <div className="h-0.5 w-2 bg-white" />
                              </div>
                            ) : (
                              <Square
                                className="h-4 w-4 cursor-pointer text-muted-foreground"
                                onClick={toggleAll}
                              />
                            )}
                            <span className="text-xs font-medium">全选</span>
                          </div>
                          {kwOptions?.items && kwOptions.items.length > 0 ? (
                            <div className="divide-y divide-slate-100">
                              {kwOptions.items.map((kw) => (
                                <label
                                  key={kw.id}
                                  className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-slate-50"
                                >
                                  <Checkbox
                                    checked={selectedKwIds.has(kw.id)}
                                    onCheckedChange={() => toggleKw(kw.id)}
                                  />
                                  <span className="text-sm flex-1">
                                    {kw.keyword}
                                  </span>
                                  <span
                                    className="text-xs px-2 py-0.5 rounded"
                                    style={{
                                      backgroundColor:
                                        kw.keywordType === 'core'
                                          ? 'rgba(30, 64, 175, 0.1)'
                                          : 'rgba(100, 116, 139, 0.1)',
                                      color:
                                        kw.keywordType === 'core'
                                          ? PRIMARY
                                          : MUTED,
                                    }}
                                  >
                                    {kw.keywordType === 'core'
                                      ? '核心词'
                                      : '长尾词'}
                                  </span>
                                </label>
                              ))}
                            </div>
                          ) : (
                            <div className="px-3 py-8 text-center text-sm text-muted-foreground">
                              暂无关键词
                            </div>
                          )}
                        </div>
                      </>
                    ) : (
                      <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
                        请先选择品牌
                      </div>
                    )}
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setBatchOpen(false)}>
                    取消
                  </Button>
                  <Button
                    className="bg-[#2E7DFF] text-white hover:bg-[#1E5FD6]"
                    disabled={
                      batchMutation.isPending ||
                      !batchBrandId ||
                      selectedKwIds.size === 0 ||
                      selectedPlatforms.size === 0
                    }
                    onClick={handleBatchSubmit}
                  >
                    {batchMutation.isPending
                      ? '提交中...'
                      : `发起检测 (${selectedKwIds.size}个 × ${selectedPlatforms.size}平台)`}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

        {/* 错误态 */}
        {isError && (
          <div className="flex items-center justify-between rounded-lg border border-red-200 bg-red-50 p-4">
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

        {/* 表格区 */}
        {isLoading ? (
          <TableSkeleton />
        ) : tasksData ? (
          <DataTable
            columns={[
              { key: 'id', title: '任务ID', width: '120px', render: (row: KeywordTask) => (
                <span className="text-[#5B6B85] tabular-nums font-mono truncate block" title={row.id}>
                  {row.id.slice(0, 8)}...
                </span>
              )},
              { key: 'keyword', title: '关键词', render: (row: KeywordTask) => (
                <div className="flex items-center gap-2">
                  <span className="truncate font-medium" title={row.keyword}>{row.keyword}</span>
                  {row.isExample && <Pill variant="muted">示例</Pill>}
                </div>
              )},
              { key: 'brandName', title: '品牌', width: '120px', render: (row: KeywordTask) => (
                <span className="truncate block" title={row.brandName}>{row.brandName}</span>
              )},
              { key: 'platform', title: '平台', width: '80px', render: (row: KeywordTask) => (
                PLATFORM_LABELS[row.platform as Platform] ?? row.platform
              )},
              { key: 'city', title: '城市', width: '80px', render: (row: KeywordTask) => (
                row.city ?? '-'
              )},
              { key: 'status', title: '状态', width: '90px', render: (row: KeywordTask) => (
                <Pill variant={row.status === 'completed' ? 'success' : row.status === 'failed' ? 'danger' : row.status === 'running' ? 'info' : 'warning'}>
                  {TASK_STATUS_LABELS[row.status]}
                </Pill>
              )},
              { key: 'createdAt', title: '创建时间', width: '160px', render: (row: KeywordTask) => (
                <span className="text-[#5B6B85]">
                  {row.createdAt ? new Date(row.createdAt).toLocaleString('zh-CN') : '-'}
                </span>
              )},
            ]}
            data={tasksData.items}
            rowKey="id"
            emptyText="暂无检测任务"
            pagination={{
              total: tasksData.total,
              page,
              pageSize: PAGE_SIZE,
              onPageChange: setPage,
              onPageSizeChange: () => {},
              pageSizeOptions: [10],
            }}
          />
        ) : null}
    </SectionCard>
  );
};

const TableSkeleton = () => (
  <div className="space-y-2 rounded-md border p-4">
    {Array.from({ length: 8 }).map((_, i) => (
      <div key={i} className="flex items-center gap-4">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-4 flex-1" />
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-4 w-16" />
        <Skeleton className="h-4 w-16" />
        <Skeleton className="h-4 w-16" />
        <Skeleton className="h-4 w-32" />
      </div>
    ))}
  </div>
);

export default KeywordTasks;
