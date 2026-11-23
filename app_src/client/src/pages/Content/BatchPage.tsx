import React, { useEffect, useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Search,
  Plus,
  RefreshCw,
  AlertCircle,
  Eye,
  RotateCw,
  Trash2,
  CheckSquare,
  Square,
  Sparkles,
} from 'lucide-react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@client/src/components/ui/card';
import { Button } from '@client/src/components/ui/button';
import { Input } from '@client/src/components/ui/input';
import { Checkbox } from '@client/src/components/ui/checkbox';
import { Textarea } from '@client/src/components/ui/textarea';
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
import { Badge } from '@client/src/components/ui/badge';
import { Skeleton } from '@client/src/components/ui/skeleton';
import { Progress } from '@client/src/components/ui/progress';
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@client/src/components/ui/empty';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from '@client/src/components/ui/dialog';
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from '@client/src/components/ui/tabs';
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@client/src/components/ui/pagination';
import { toast } from 'sonner';
import { content } from '@client/src/api';
import { getKeywords, getBrandList } from '@client/src/api/keywords';
import {
  BATCH_STATUS_LABELS,
  BATCH_STATUS,
  ARTICLE_TYPE_LABELS,
  ARTICLE_TYPES,
  ARTICLE_STATUS_LABELS,
} from '@shared/api.interface';
import type {
  ArticleBatch,
  Article,
  ArticleType,
  BatchStatus,
} from '@shared/api.interface';
import { showConfirm } from '@lark-apaas/client-toolkit';

const PRIMARY = '#1e40af';
const ACCENT = '#f97316';
const SUCCESS = '#10b981';
const DANGER = '#ef4444';
const MUTED = '#64748b';

const BATCH_STATUS_COLORS: Record<BatchStatus, { bg: string; color: string }> = {
  pending: { bg: 'rgba(100, 116, 139, 0.1)', color: MUTED },
  generating: { bg: 'rgba(30, 64, 175, 0.1)', color: PRIMARY },
  completed: { bg: 'rgba(16, 185, 129, 0.1)', color: SUCCESS },
  partial_failed: { bg: 'rgba(249, 115, 22, 0.1)', color: ACCENT },
  failed: { bg: 'rgba(239, 68, 68, 0.1)', color: DANGER },
};

const PAGE_SIZE = 10;
const POLL_INTERVAL = 5000;

const BatchPage = () => {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [brandId, setBrandId] = useState<string>('');
  const [status, setStatus] = useState<string>('');
  const [searchName, setSearchName] = useState<string>('');
  const [searchDebounced, setSearchDebounced] = useState<string>('');

  const {
    data: batchesData,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['content', 'batches', page, brandId, status, searchDebounced],
    queryFn: () =>
      content.getBatches({
        page,
        pageSize: PAGE_SIZE,
        brandId: brandId || undefined,
        status: status || undefined,
        batchName: searchDebounced || undefined,
      }),
  });

  const { data: brandOptions = [] } = useQuery({
    queryKey: ['brands', 'options'],
    queryFn: getBrandList,
  });

  // 自动轮询：有进行中的任务时才刷新
  const hasRunning = useMemo(() => {
    if (!batchesData?.items) return false;
    return batchesData.items.some(
      (b: ArticleBatch) => b.status === 'pending' || b.status === 'generating',
    );
  }, [batchesData]);

  useEffect(() => {
    if (!hasRunning) return;
    const timer = setInterval(() => {
      refetch();
    }, POLL_INTERVAL);
    return () => clearInterval(timer);
  }, [hasRunning, refetch]);

  // 搜索防抖
  useEffect(() => {
    const t = setTimeout(() => {
      setSearchDebounced(searchName);
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [searchName]);

  const totalPages = useMemo(() => {
    if (!batchesData) return 1;
    return Math.max(1, Math.ceil(batchesData.total / PAGE_SIZE));
  }, [batchesData]);

  /* ---------- 查看结果弹窗 ---------- */
  const [detailBatchId, setDetailBatchId] = useState<string | null>(null);

  const { data: batchDetail, isLoading: detailLoading } = useQuery({
    queryKey: ['content', 'batch', detailBatchId],
    queryFn: () => content.getBatch(detailBatchId!),
    enabled: !!detailBatchId,
  });

  const openDetail = (id: string) => {
    setDetailBatchId(id);
  };

  /* ---------- 重试 ---------- */
  const retryMutation = useMutation({
    mutationFn: (id: string) => content.retryBatch(id),
    retry: false,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['content', 'batches'] });
      toast.success('已重新提交失败项');
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.error?.message || '重试失败');
    },
  });

  /* ---------- 删除 ---------- */
  const deleteMutation = useMutation({
    mutationFn: (id: string) => content.deleteBatch(id),
    retry: false,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['content', 'batches'] });
      toast.success('已删除');
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.error?.message || '删除失败');
    },
  });

  /* ---------- 新建批量任务弹窗 ---------- */
  const [createOpen, setCreateOpen] = useState(false);
  const [formName, setFormName] = useState('');
  const [formBrandId, setFormBrandId] = useState('');
  const [keywordTab, setKeywordTab] = useState<'library' | 'paste'>('library');
  const [kwSearch, setKwSearch] = useState('');
  const [selectedKwIds, setSelectedKwIds] = useState<Set<string>>(new Set());
  const [pasteText, setPasteText] = useState('');
  const [articlesPerKw, setArticlesPerKw] = useState(1);
  const [articleType, setArticleType] = useState<ArticleType>('recommendation');
  const [targetWordCount, setTargetWordCount] = useState(1500);

  const { data: kwOptions } = useQuery({
    queryKey: ['keywords', 'for-batch', formBrandId, kwSearch],
    queryFn: () =>
      getKeywords({
        page: 1,
        pageSize: 100,
        brandId: formBrandId || undefined,
        keyword: kwSearch || undefined,
      }),
    enabled: !!formBrandId && createOpen && keywordTab === 'library',
  });

  const allKwIds = kwOptions?.items.map((k) => k.id) ?? [];
  const allSelected =
    allKwIds.length > 0 && allKwIds.every((id) => selectedKwIds.has(id));
  const someSelected =
    allKwIds.some((id) => selectedKwIds.has(id)) && !allSelected;

  const toggleAllKw = () => {
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

  const keywordCount = useMemo(() => {
    if (keywordTab === 'library') return selectedKwIds.size;
    return pasteText
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean).length;
  }, [keywordTab, selectedKwIds, pasteText]);

  const estimatedCost = keywordCount * articlesPerKw * 2;

  const createMutation = useMutation({
    mutationFn: content.createBatch,
    retry: false,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['content', 'batches'] });
      toast.success('任务已提交，正在排队中');
      setCreateOpen(false);
      resetForm();
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.error?.message || '提交失败');
    },
  });

  const resetForm = () => {
    setFormName('');
    setFormBrandId('');
    setSelectedKwIds(new Set());
    setPasteText('');
    setArticlesPerKw(1);
    setArticleType('recommendation');
    setTargetWordCount(1500);
    setKeywordTab('library');
    setKwSearch('');
  };

  const handleBrandChange = (v: string) => {
    setFormBrandId(v);
    setSelectedKwIds(new Set());
  };

  const handleSubmit = () => {
    if (!formName.trim()) {
      toast.error('请填写任务名称');
      return;
    }
    if (!formBrandId) {
      toast.error('请选择品牌');
      return;
    }
    if (keywordCount === 0) {
      toast.error('请至少选择或输入一个关键词');
      return;
    }
    let keywords: string[] = [];
    if (keywordTab === 'library') {
      const kwMap = new Map(
        (kwOptions?.items ?? []).map((k) => [k.id, k.keyword]),
      );
      keywords = Array.from(selectedKwIds)
        .map((id) => kwMap.get(id))
        .filter(Boolean) as string[];
    } else {
      keywords = pasteText
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean);
    }
    if (keywords.length === 0) {
      toast.error('请至少输入一个关键词');
      return;
    }
    createMutation.mutate({
      batchName: formName.trim(),
      brandId: formBrandId,
      keywords,
      articlesPerKeyword: articlesPerKw,
      articleType,
      targetWordCount,
    });
  };

  const statusBadge = (s: BatchStatus) => {
    const color = BATCH_STATUS_COLORS[s];
    return (
      <span
        className="inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium"
        style={{ backgroundColor: color.bg, color: color.color }}
      >
        {BATCH_STATUS_LABELS[s]}
      </span>
    );
  };

  const progressPercent = (batch: ArticleBatch) => {
    if (batch.totalCount === 0) return 0;
    const done = batch.successCount + batch.failedCount;
    return Math.round((done / batch.totalCount) * 100);
  };

  return (
    <div className="space-y-4">
      <Card
        className="w-full"
        style={{ borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}
      >
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <CardTitle className="font-semibold">批量创作任务</CardTitle>
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button size="sm" style={{ backgroundColor: PRIMARY }}>
                <Plus className="h-3.5 w-3.5" />
                新建批量任务
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-2xl">
              <DialogHeader>
                <DialogTitle>新建批量创作任务</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-2 max-h-[65vh] overflow-y-auto">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">
                    任务名称 <span className="text-destructive">*</span>
                  </label>
                  <Input
                    placeholder="例如：3月核心词创作"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    className="h-9"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-sm font-medium">品牌</label>
                  <Select value={formBrandId} onValueChange={handleBrandChange}>
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

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium">关键词选择</label>
                    <span className="text-xs text-muted-foreground">
                      已选 {keywordCount} 个
                    </span>
                  </div>
                  <Tabs value={keywordTab} onValueChange={(v) => setKeywordTab(v as 'library' | 'paste')}>
                    <TabsList>
                      <TabsTrigger value="library">从词库选择</TabsTrigger>
                      <TabsTrigger value="paste">粘贴一批</TabsTrigger>
                    </TabsList>
                    <TabsContent value="library">
                      {formBrandId ? (
                        <div className="space-y-2">
                          <div className="relative">
                            <Search
                              className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4"
                              style={{ color: MUTED }}
                            />
                            <Input
                              placeholder="搜索关键词"
                              value={kwSearch}
                              onChange={(e) => setKwSearch(e.target.value)}
                              className="pl-9 h-9"
                            />
                          </div>
                          <div className="rounded-md border max-h-[220px] overflow-y-auto">
                            <div className="flex items-center gap-2 px-3 py-2 border-b bg-slate-50 sticky top-0">
                              {allSelected ? (
                                <CheckSquare
                                  className="h-4 w-4 cursor-pointer"
                                  style={{ color: PRIMARY }}
                                  onClick={toggleAllKw}
                                />
                              ) : someSelected ? (
                                <div
                                  className="h-4 w-4 rounded cursor-pointer flex items-center justify-center border"
                                  style={{
                                    borderColor: PRIMARY,
                                    backgroundColor: PRIMARY,
                                  }}
                                  onClick={toggleAllKw}
                                >
                                  <div className="h-0.5 w-2 bg-white" />
                                </div>
                              ) : (
                                <Square
                                  className="h-4 w-4 cursor-pointer text-muted-foreground"
                                  onClick={toggleAllKw}
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
                                  </label>
                                ))}
                              </div>
                            ) : (
                              <div className="px-3 py-8 text-center text-sm text-muted-foreground">
                                暂无关键词
                              </div>
                            )}
                          </div>
                        </div>
                      ) : (
                        <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
                          请先选择品牌
                        </div>
                      )}
                    </TabsContent>
                    <TabsContent value="paste">
                      <Textarea
                        placeholder="每行一个关键词，例如：&#10;火锅店加盟&#10;串串香加盟&#10;烧烤店加盟"
                        value={pasteText}
                        onChange={(e) => setPasteText(e.target.value)}
                        className="min-h-[220px] resize-none"
                      />
                    </TabsContent>
                  </Tabs>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">每词生成篇数</label>
                    <Select
                      value={String(articlesPerKw)}
                      onValueChange={(v) => setArticlesPerKw(Number(v))}
                    >
                      <SelectTrigger className="w-full h-9">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {[1, 2, 3, 4, 5].map((n) => (
                          <SelectItem key={n} value={String(n)}>
                            {n} 篇
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">文章类型</label>
                    <Select
                      value={articleType}
                      onValueChange={(v) => setArticleType(v as ArticleType)}
                    >
                      <SelectTrigger className="w-full h-9">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ARTICLE_TYPES.map((t) => (
                          <SelectItem key={t} value={t}>
                            {ARTICLE_TYPE_LABELS[t]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-sm font-medium">目标字数</label>
                  <Select
                    value={String(targetWordCount)}
                    onValueChange={(v) => setTargetWordCount(Number(v))}
                  >
                    <SelectTrigger className="w-full h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[800, 1200, 1500, 2000, 3000].map((n) => (
                        <SelectItem key={n} value={String(n)}>
                          {n} 字
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div
                  className="flex items-center justify-between rounded-lg border p-3"
                  style={{ backgroundColor: 'rgba(30, 64, 175, 0.04)' }}
                >
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4" style={{ color: PRIMARY }} />
                    <span className="text-sm">预计消耗</span>
                  </div>
                  <span className="text-sm font-semibold" style={{ color: PRIMARY }}>
                    {estimatedCost} 算力
                  </span>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setCreateOpen(false)}>
                  取消
                </Button>
                <Button
                  style={{ backgroundColor: PRIMARY }}
                  disabled={
                    createMutation.isPending ||
                    !formName.trim() ||
                    !formBrandId ||
                    keywordCount === 0
                  }
                  onClick={handleSubmit}
                >
                  {createMutation.isPending
                    ? '提交中...'
                    : `提交任务 (${keywordCount}词 × ${articlesPerKw}篇)`}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* 筛选区 */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="w-40">
              <Select value={brandId} onValueChange={(v) => { setBrandId(v); setPage(1); }}>
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
            <div className="w-32">
              <Select value={status} onValueChange={(v) => { setStatus(v); setPage(1); }}>
                <SelectTrigger className="w-full h-9">
                  <SelectValue placeholder="全部状态" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">全部状态</SelectItem>
                  {BATCH_STATUS.map((s) => (
                    <SelectItem key={s} value={s}>
                      {BATCH_STATUS_LABELS[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="relative w-64">
              <Search
                className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4"
                style={{ color: MUTED }}
              />
              <Input
                placeholder="搜索任务名称"
                value={searchName}
                onChange={(e) => setSearchName(e.target.value)}
                className="pl-9 h-9"
              />
            </div>
            {hasRunning && (
              <div className="flex items-center gap-1.5 text-xs" style={{ color: PRIMARY }}>
                <RefreshCw className="h-3 w-3 animate-spin" />
                自动刷新中
              </div>
            )}
          </div>

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
          ) : batchesData && batchesData.items.length > 0 ? (
            <>
              <div className="rounded-md border overflow-x-auto">
                <Table style={{ minWidth: '1100px' }}>
                  <TableHeader>
                    <TableRow>
                      <TableHead style={{ width: '280px', minWidth: '280px' }}>任务名称</TableHead>
                      <TableHead style={{ width: '140px', minWidth: '140px' }}>品牌</TableHead>
                      <TableHead className="text-right tabular-nums" style={{ width: '100px', minWidth: '100px' }}>关键词数</TableHead>
                      <TableHead className="text-right tabular-nums" style={{ width: '80px', minWidth: '80px' }}>篇数</TableHead>
                      <TableHead style={{ width: '120px', minWidth: '120px' }}>创作类型</TableHead>
                      <TableHead style={{ width: '100px', minWidth: '100px' }}>状态</TableHead>
                      <TableHead style={{ width: '180px', minWidth: '180px' }}>进度</TableHead>
                      <TableHead className="text-right tabular-nums" style={{ width: '100px', minWidth: '100px' }}>预估消耗</TableHead>
                      <TableHead className="text-right tabular-nums" style={{ width: '100px', minWidth: '100px' }}>实际消耗</TableHead>
                      <TableHead style={{ width: '160px', minWidth: '160px' }}>创建时间</TableHead>
                      <TableHead className="text-right" style={{ width: '160px', minWidth: '160px' }}>操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {batchesData.items.map((batch: ArticleBatch) => (
                      <TableRow key={batch.id}>
                        <TableCell style={{ width: '280px', minWidth: '280px' }} className="font-medium">
                          <div className="line-clamp-2 text-[13px] leading-tight" title={batch.batchName}>
                            {batch.batchName}
                          </div>
                        </TableCell>
                        <TableCell>{batch.brandName}</TableCell>
                        <TableCell className="text-right tabular-nums" style={{ width: '100px', minWidth: '100px' }}>
                          {batch.keywords?.length ?? 0}
                        </TableCell>
                        <TableCell className="text-right tabular-nums" style={{ width: '80px', minWidth: '80px' }}>
                          {batch.totalCount}
                        </TableCell>
                        <TableCell>
                          {ARTICLE_TYPE_LABELS[batch.articleType] ?? batch.articleType}
                        </TableCell>
                        <TableCell>{statusBadge(batch.status)}</TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <Progress
                              value={progressPercent(batch)}
                              className="h-1.5"
                            />
                            <div className="text-xs text-muted-foreground">
                              {batch.successCount + batch.failedCount}
                              {' / '}
                              {batch.totalCount}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground">
                          —
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {batch.totalCost ?? 0}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-xs">
                          {batch.createdAt
                            ? new Date(batch.createdAt).toLocaleString('zh-CN')
                            : '-'}
                        </TableCell>
                        <TableCell className="text-right tabular-nums" style={{ width: '160px', minWidth: '160px' }}>
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 px-2 text-xs"
                              onClick={() => openDetail(batch.id)}
                            >
                              <Eye className="h-3.5 w-3.5" />
                              查看结果
                            </Button>
                            {(batch.status === 'partial_failed' ||
                              batch.status === 'failed') && (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 px-2 text-xs"
                                style={{ color: ACCENT }}
                                onClick={() => retryMutation.mutate(batch.id)}
                                disabled={retryMutation.isPending}
                              >
                                <RotateCw className="h-3.5 w-3.5" />
                                重试
                              </Button>
                            )}
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 px-2 text-xs"
                              style={{ color: DANGER }}
                              onClick={async () => {
                                if (await showConfirm('确定删除该批量任务？')) {
                                  deleteMutation.mutate(batch.id);
                                }
                              }}
                              disabled={deleteMutation.isPending}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {totalPages > 1 && (
                <div className="flex items-center justify-between pt-2">
                  <div className="text-xs text-muted-foreground">
                    共 {batchesData.total} 条记录
                  </div>
                  <Pagination className="justify-end">
                    <PaginationContent>
                      <PaginationItem>
                        <PaginationPrevious
                          onClick={() => setPage((p) => Math.max(1, p - 1))}
                          className={page === 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                        />
                      </PaginationItem>
                      {Array.from({ length: totalPages }).map((_, i) => {
                        const p = i + 1;
                        if (
                          p === 1 ||
                          p === totalPages ||
                          (p >= page - 1 && p <= page + 1)
                        ) {
                          return (
                            <PaginationItem key={p}>
                              <PaginationLink
                                isActive={page === p}
                                onClick={() => setPage(p)}
                                className="cursor-pointer"
                              >
                                {p}
                              </PaginationLink>
                            </PaginationItem>
                          );
                        }
                        if (p === page - 2 || p === page + 2) {
                          return (
                            <PaginationItem key={p}>
                              <span className="px-2 text-muted-foreground">...</span>
                            </PaginationItem>
                          );
                        }
                        return null;
                      })}
                      <PaginationItem>
                        <PaginationNext
                          onClick={() =>
                            setPage((p) => Math.min(totalPages, p + 1))
                          }
                          className={
                            page === totalPages
                              ? 'pointer-events-none opacity-50'
                              : 'cursor-pointer'
                          }
                        />
                      </PaginationItem>
                    </PaginationContent>
                  </Pagination>
                </div>
              )}
            </>
          ) : (
            <Empty className="min-h-[300px]">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <Sparkles />
                </EmptyMedia>
                <EmptyTitle>暂无批量创作任务</EmptyTitle>
                <EmptyDescription>点击右上角新建开始创作</EmptyDescription>
              </EmptyHeader>
            </Empty>
          )}
        </CardContent>
      </Card>

      {/* 批次详情弹窗 */}
      <Dialog
        open={!!detailBatchId}
        onOpenChange={(o) => !o && setDetailBatchId(null)}
      >
        <DialogContent className="sm:max-w-4xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>
              {batchDetail ? batchDetail.batchName : '批次详情'}
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto">
            {detailLoading ? (
              <div className="space-y-2 p-2">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-4">
                    <Skeleton className="h-4 flex-1" />
                    <Skeleton className="h-4 w-16" />
                    <Skeleton className="h-4 w-20" />
                  </div>
                ))}
              </div>
            ) : batchDetail ? (
              <div className="space-y-3">
                <div className="flex items-center gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">品牌：</span>
                    {batchDetail.brandName}
                  </div>
                  <div>
                    <span className="text-muted-foreground">类型：</span>
                    {ARTICLE_TYPE_LABELS[batchDetail.articleType]}
                  </div>
                  <div>
                    <span className="text-muted-foreground">状态：</span>
                    {statusBadge(batchDetail.status)}
                  </div>
                  <div>
                    <span className="text-muted-foreground">总消耗：</span>
                    <span className="font-medium">{batchDetail.totalCost} 算力</span>
                  </div>
                </div>
                <div className="rounded-md border overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>标题</TableHead>
                        <TableHead className="w-24">状态</TableHead>
                        <TableHead className="w-20 text-right">字数</TableHead>
                        <TableHead className="w-24 text-right">消耗</TableHead>
                        <TableHead className="w-40">错误信息</TableHead>
                        <TableHead className="w-24 text-right">操作</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {batchDetail.articles.map((a: Article) => (
                        <TableRow key={a.id}>
                          <TableCell className="font-medium">
                            {a.title || <span className="text-muted-foreground">生成中...</span>}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant="secondary"
                              className="text-xs"
                            >
                              {ARTICLE_STATUS_LABELS[a.status]}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">{a.wordCount ?? 0}</TableCell>
                          <TableCell className="text-right">{a.costCredits ?? 0}</TableCell>
                          <TableCell className="text-xs text-destructive">
                            {a.error || '-'}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button size="sm" variant="ghost" className="h-7 px-2 text-xs">
                              <Eye className="h-3.5 w-3.5" />
                              查看
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            ) : null}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDetailBatchId(null)}>
              关闭
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

const TableSkeleton = () => (
  <div className="space-y-2 rounded-md border p-4">
    {Array.from({ length: 8 }).map((_, i) => (
      <div key={i} className="flex items-center gap-4">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-4 w-12" />
        <Skeleton className="h-4 w-12" />
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-4 w-16" />
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-4 w-16" />
        <Skeleton className="h-4 w-16" />
        <Skeleton className="h-4 w-32" />
      </div>
    ))}
  </div>
);

export default BatchPage;
