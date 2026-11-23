import React, { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Search,
  ChevronDown,
  ChevronRight,
  RefreshCw,
  AlertCircle,
  Eye,
  Share2,
  Trash2,
  Copy,
  X,
  Calendar,
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@client/src/components/ui/dialog';
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
import { getBrandList } from '@client/src/api/keywords';
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
  BatchStatus,
  ArticleType,
} from '@shared/api.interface';
import { showConfirm } from '@lark-apaas/client-toolkit';

const PRIMARY = '#1e40af';
const SUCCESS = '#10b981';
const DANGER = '#ef4444';
const MUTED = '#64748b';

const BATCH_STATUS_COLORS: Record<BatchStatus, { bg: string; color: string }> = {
  pending: { bg: 'rgba(100, 116, 139, 0.1)', color: MUTED },
  generating: { bg: 'rgba(30, 64, 175, 0.1)', color: PRIMARY },
  completed: { bg: 'rgba(16, 185, 129, 0.1)', color: SUCCESS },
  partial_failed: { bg: 'rgba(249, 115, 22, 0.1)', color: '#f97316' },
  failed: { bg: 'rgba(239, 68, 68, 0.1)', color: DANGER },
};

const PAGE_SIZE = 10;

const HistoryPage = () => {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [brandId, setBrandId] = useState<string>('');
  const [articleType, setArticleType] = useState<string>('');
  const [status, setStatus] = useState<string>('');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [articleDetail, setArticleDetail] = useState<Article | null>(null);
  const [shareOpen, setShareOpen] = useState(false);

  const {
    data: batchesData,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: [
      'content',
      'history',
      'batches',
      page,
      brandId,
      articleType,
      status,
      startDate,
      endDate,
    ],
    queryFn: () =>
      content.getBatches({
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

  // 展开时加载该批次文章
  const { data: batchDetail, isLoading: detailLoading } = useQuery({
    queryKey: ['content', 'batch', expandedId],
    queryFn: () => content.getBatch(expandedId!),
    enabled: !!expandedId,
  });

  const totalPages = useMemo(() => {
    if (!batchesData) return 1;
    return Math.max(1, Math.ceil(batchesData.total / PAGE_SIZE));
  }, [batchesData]);

  const toggleExpand = (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  const viewArticle = (article: Article) => {
    setArticleDetail(article);
  };

  const copyArticle = (article: Article) => {
    if (article.content) {
      navigator.clipboard.writeText(article.content).then(
        () => toast.success('已复制到剪贴板'),
        () => toast.error('复制失败'),
      );
    } else {
      toast.error('文章内容为空');
    }
  };

  const deleteMutation = useMutation({
    mutationFn: (id: string) => content.deleteArticle(id),
    retry: false,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['content', 'batch'] });
      queryClient.invalidateQueries({ queryKey: ['content', 'history'] });
      toast.success('已删除');
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.error?.message || '删除失败');
    },
  });

  const deleteBatchMutation = useMutation({
    mutationFn: (id: string) => content.deleteBatch(id),
    retry: false,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['content', 'history', 'batches'] });
      setExpandedId(null);
      toast.success('已删除批次');
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.error?.message || '删除失败');
    },
  });

  const handleShare = () => {
    setShareOpen(true);
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

  return (
    <div className="space-y-4">
      <Card
        className="w-full"
        style={{ borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}
      >
        <CardHeader className="pb-3">
          <CardTitle className="font-semibold">创作历史</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* 筛选区 */}
          <div className="flex flex-wrap items-center gap-3">
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
            <div className="w-36">
              <Select
                value={articleType}
                onValueChange={(v) => {
                  setArticleType(v);
                  setPage(1);
                }}
              >
                <SelectTrigger className="w-full h-9">
                  <SelectValue placeholder="全部类型" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">全部类型</SelectItem>
                  {ARTICLE_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {ARTICLE_TYPE_LABELS[t]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
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
                  {BATCH_STATUS.map((s) => (
                    <SelectItem key={s} value={s}>
                      {BATCH_STATUS_LABELS[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4" style={{ color: MUTED }} />
              <Input
                type="date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  setPage(1);
                }}
                className="h-9 w-36"
              />
              <span className="text-muted-foreground">至</span>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => {
                  setEndDate(e.target.value);
                  setPage(1);
                }}
                className="h-9 w-36"
              />
            </div>
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

          {/* 批次列表 */}
          {isLoading ? (
            <BatchListSkeleton />
          ) : batchesData && batchesData.items.length > 0 ? (
            <div className="space-y-3">
              {batchesData.items.map((batch: ArticleBatch) => {
                const isExpanded = expandedId === batch.id;
                return (
                  <div
                    key={batch.id}
                    className="rounded-lg border overflow-hidden transition-all"
                    style={{
                      boxShadow: isExpanded ? '0 2px 8px rgba(0,0,0,0.08)' : 'none',
                    }}
                  >
                    {/* 批次行 */}
                    <div
                      className="flex items-center gap-4 px-4 py-3 bg-white hover:bg-slate-50 cursor-pointer"
                      onClick={() => toggleExpand(batch.id)}
                    >
                      <button
                        className="flex-shrink-0 text-muted-foreground hover:text-foreground transition-colors"
                        aria-label={isExpanded ? '收起' : '展开'}
                      >
                        {isExpanded ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                      </button>

                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm truncate">
                          {batch.batchName}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">
                          <span>{batch.brandName}</span>
                          <span>·</span>
                          <span>
                            {ARTICLE_TYPE_LABELS[batch.articleType] ??
                              batch.articleType}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 flex-shrink-0">
                        <div className="text-sm text-right">
                          <div className="font-medium">{batch.totalCount} 篇</div>
                          <div className="text-xs text-muted-foreground">
                            成功 {batch.successCount} / 失败 {batch.failedCount}
                          </div>
                        </div>
                        {statusBadge(batch.status)}
                      </div>

                      <div className="flex items-center gap-3 flex-shrink-0">
                        <div className="text-xs text-muted-foreground text-right">
                          {batch.createdAt
                            ? new Date(batch.createdAt).toLocaleDateString(
                                'zh-CN',
                              )
                            : '-'}
                        </div>
                        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 px-2 text-xs"
                            onClick={handleShare}
                          >
                            <Share2 className="h-3.5 w-3.5" />
                            分享
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 px-2 text-xs"
                            style={{ color: DANGER }}
                            onClick={async () => {
                              if (await showConfirm('确定删除该批次？')) {
                                deleteBatchMutation.mutate(batch.id);
                              }
                            }}
                            disabled={deleteBatchMutation.isPending}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    </div>

                    {/* 展开的文章清单 */}
                    {isExpanded && (
                      <div className="border-t bg-slate-50/50">
                        {detailLoading ? (
                          <div className="p-4 space-y-2">
                            {Array.from({ length: 4 }).map((_, i) => (
                              <div key={i} className="flex items-center gap-4">
                                <Skeleton className="h-4 flex-1" />
                                <Skeleton className="h-4 w-16" />
                                <Skeleton className="h-4 w-20" />
                              </div>
                            ))}
                          </div>
                        ) : batchDetail && batchDetail.articles.length > 0 ? (
                          <div className="p-4">
                            <div className="rounded-md border bg-white overflow-hidden">
                              <Table>
                                <TableHeader>
                                  <TableRow>
                                    <TableHead>标题</TableHead>
                                    <TableHead className="w-20 text-right">字数</TableHead>
                                    <TableHead className="w-24">状态</TableHead>
                                    <TableHead className="w-40">创建时间</TableHead>
                                    <TableHead className="w-48 text-right">操作</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {batchDetail.articles.map((a: Article) => (
                                    <TableRow key={a.id}>
                                      <TableCell className="font-medium">
                                        {a.title || (
                                          <span className="text-muted-foreground">
                                            生成中...
                                          </span>
                                        )}
                                      </TableCell>
                                      <TableCell className="text-right">
                                        {a.wordCount ?? 0}
                                      </TableCell>
                                      <TableCell>
                                        <Badge
                                          variant="secondary"
                                          className="text-xs"
                                        >
                                          {ARTICLE_STATUS_LABELS[a.status]}
                                        </Badge>
                                      </TableCell>
                                      <TableCell className="text-xs text-muted-foreground">
                                        {a.createdAt
                                          ? new Date(
                                              a.createdAt,
                                            ).toLocaleString('zh-CN')
                                          : '-'}
                                      </TableCell>
                                      <TableCell className="text-right">
                                        <div className="flex items-center justify-end gap-1">
                                          <Button
                                            size="sm"
                                            variant="ghost"
                                            className="h-7 px-2 text-xs"
                                            onClick={() => viewArticle(a)}
                                          >
                                            <Eye className="h-3.5 w-3.5" />
                                            查看
                                          </Button>
                                          <Button
                                            size="sm"
                                            variant="ghost"
                                            className="h-7 px-2 text-xs"
                                            onClick={() => copyArticle(a)}
                                          >
                                            <Copy className="h-3.5 w-3.5" />
                                            复制
                                          </Button>
                                          <Button
                                            size="sm"
                                            variant="ghost"
                                            className="h-7 px-2 text-xs"
                                            style={{ color: DANGER }}
                                            onClick={async () => {
                                              if (await showConfirm('确定删除该文章？')) {
                                                deleteMutation.mutate(a.id);
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
                          </div>
                        ) : (
                          <div className="p-8 text-center text-sm text-muted-foreground">
                            暂无文章
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <EmptyState text="暂无创作记录" />
          )}

          {/* 分页 */}
          {batchesData && totalPages > 1 && (
            <div className="flex items-center justify-between pt-2">
              <div className="text-xs text-muted-foreground">
                共 {batchesData.total} 个批次
              </div>
              <Pagination className="justify-end">
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      className={
                        page === 1
                          ? 'pointer-events-none opacity-50'
                          : 'cursor-pointer'
                      }
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
        </CardContent>
      </Card>

      {/* 文章详情弹窗 */}
      <Dialog
        open={!!articleDetail}
        onOpenChange={(o) => !o && setArticleDetail(null)}
      >
        <DialogContent className="sm:max-w-3xl max-h-[85vh]">
          <DialogHeader>
            <DialogTitle className="pr-8">
              {articleDetail?.title || '文章详情'}
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto">
            {articleDetail ? (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <Badge variant="secondary">
                    {ARTICLE_TYPE_LABELS[articleDetail.articleType]}
                  </Badge>
                  <Badge variant="outline">
                    {articleDetail.wordCount ?? 0} 字
                  </Badge>
                  <span className="text-muted-foreground">
                    创建于{' '}
                    {articleDetail.createdAt
                      ? new Date(articleDetail.createdAt).toLocaleString(
                          'zh-CN',
                        )
                      : '-'}
                  </span>
                </div>
                <div className="rounded-lg border p-4 bg-slate-50 whitespace-pre-wrap text-sm leading-relaxed">
                  {articleDetail.content || (
                    <span className="text-muted-foreground">
                      文章正在生成中，请稍候...
                    </span>
                  )}
                </div>
                {articleDetail.keywords &&
                  articleDetail.keywords.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {articleDetail.keywords.map((k: string, i: number) => (
                        <Badge key={i} variant="outline" className="text-xs">
                          {k}
                        </Badge>
                      ))}
                    </div>
                  )}
              </div>
            ) : null}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => articleDetail && copyArticle(articleDetail)}
            >
              <Copy className="h-3.5 w-3.5" />
              复制全文
            </Button>
            <Button
              style={{ backgroundColor: PRIMARY }}
              onClick={() => setArticleDetail(null)}
            >
              关闭
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 分享弹窗 */}
      <Dialog open={shareOpen} onOpenChange={setShareOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>分享</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <div className="flex items-start gap-3 rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
              <Share2 className="h-5 w-5 flex-shrink-0 mt-0.5" />
              <div>
                <div className="font-medium text-foreground mb-1">分享功能开发中</div>
                <p>可复制文章内容手动分享给需要的同事或客户。</p>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShareOpen(false)}>
              关闭
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

const BatchListSkeleton = () => (
  <div className="space-y-3">
    {Array.from({ length: 5 }).map((_, i) => (
      <div key={i} className="rounded-lg border p-4">
        <div className="flex items-center gap-4">
          <Skeleton className="h-4 w-4" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-64" />
            <Skeleton className="h-3 w-40" />
          </div>
          <Skeleton className="h-6 w-16" />
          <Skeleton className="h-6 w-16" />
          <Skeleton className="h-4 w-20" />
        </div>
      </div>
    ))}
  </div>
);

const EmptyState: React.FC<{ text: string }> = ({ text }) => (
  <div className="flex h-[300px] items-center justify-center text-sm text-muted-foreground">
    {text}
  </div>
);

export default HistoryPage;
