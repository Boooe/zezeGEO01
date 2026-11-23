import React, { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Plus,
  Search,
  Pencil,
  Trash2,
  Eye,
  Send,
  RefreshCw,
  AlertCircle,
  FileText,
  Megaphone,
} from 'lucide-react';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';

import {
  Card,
  CardContent,
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
import { Skeleton } from '@client/src/components/ui/skeleton';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@client/src/components/ui/sheet';
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
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@client/src/components/ui/pagination';
import { Badge } from '@client/src/components/ui/badge';
import { Checkbox } from '@client/src/components/ui/checkbox';
import { PageHeader } from '@client/src/components/layout/PageHeader';
import { DataTable } from '@client/src/components/layout/DataTable';
import { Pill } from '@client/src/components/layout/Pill';

import PublishToMarketDialog from './components/PublishToMarketDialog';

import {
  getArticles,
  publishArticle,
  deleteArticle,
  type GetArticlesParams,
} from '@client/src/api/content';
import { getBrands } from '@client/src/api/brands';
import {
  ARTICLE_STATUS,
  ARTICLE_STATUS_LABELS,
  ARTICLE_TYPES,
  ARTICLE_TYPE_LABELS,
} from '@shared/api.interface';
import type { Article, ArticleStatus, ArticleType } from '@shared/api.interface';
import { useAuth } from '@client/src/contexts/AuthContext';

const PRIMARY = '#2E7DFF';
const DANGER = '#FF5C5C';
const SUCCESS = '#17C964';
const MUTED = '#94A3B8';
const WARNING = '#FFA940';

const STATUS_COLORS: Record<ArticleStatus, { bg: string; color: string }> = {
  draft: { bg: 'rgba(100, 116, 139, 0.1)', color: MUTED },
  generating: { bg: 'rgba(255, 169, 64, 0.1)', color: WARNING },
  published: { bg: 'rgba(23, 201, 100, 0.1)', color: SUCCESS },
  failed: { bg: 'rgba(255, 92, 92, 0.1)', color: DANGER },
};

const ARTICLE_STATUS_OPTIONS: ArticleStatus[] = [
  'draft',
  'published',
  'generating',
  'failed',
];

const AllArticlesPage: React.FC = () => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isClient = user?.role === 'client';

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [brandId, setBrandId] = useState<string>(user?.brandId ?? '');
  const [status, setStatus] = useState<string>('');
  const [articleType, setArticleType] = useState<string>('');
  const [keyword, setKeyword] = useState<string>('');
  const [searchText, setSearchText] = useState<string>('');

  const [viewingArticle, setViewingArticle] = useState<Article | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Article | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [publishDialogOpen, setPublishDialogOpen] = useState<boolean>(false);

  const {
    data: articlesData,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: [
      'articles',
      'list',
      page,
      pageSize,
      brandId,
      status,
      articleType,
      searchText,
    ],
    queryFn: (): Promise<{
      items: Article[];
      total: number;
      page: number;
      pageSize: number;
    }> => {
      const params: GetArticlesParams = {
        page,
        pageSize,
        keyword: searchText || undefined,
      };
      if (brandId) params.brandId = brandId;
      if (status) params.status = status;
      if (articleType) params.articleType = articleType;
      return getArticles(params) as unknown as Promise<{
        items: Article[];
        total: number;
        page: number;
        pageSize: number;
      }>;
    },
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

  const totalPages = useMemo(() => {
    if (!articlesData) return 1;
    return Math.max(1, Math.ceil(articlesData.total / pageSize));
  }, [articlesData, pageSize]);

  /* ---------- Mutations ---------- */
  const publishMutation = useMutation({
    mutationFn: (id: string) => publishArticle(id),
    retry: false,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['articles'] });
      toast.success('已加入发布队列');
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.error?.message ?? '发布失败');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteArticle(id),
    retry: false,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['articles'] });
      setDeleteTarget(null);
      toast.success('删除成功');
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.error?.message ?? '删除失败');
    },
  });

  const handleSearch = () => {
    setSearchText(keyword.trim());
    setPage(1);
    setSelectedIds(new Set());
  };

  const handlePageSizeChange = (size: number) => {
    setPageSize(size);
    setPage(1);
  };

  const formatDate = (dateStr: string): string => {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  };

  const renderContent = (content: string) => {
    const isHtml = /<[a-z][\s\S]*>/i.test(content);
    if (isHtml) {
      return (
        <div
          className="prose prose-sm max-w-none"
          dangerouslySetInnerHTML={{ __html: content }}
        />
      );
    }
    return (
      <div className="whitespace-pre-wrap text-sm text-muted-foreground leading-relaxed">
        {content}
      </div>
    );
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (!articlesData) return;
    if (selectedIds.size === articlesData.items.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(articlesData.items.map((a: Article) => a.id)));
    }
  };

  const selectedArticles = useMemo(() => {
    if (!articlesData) return [];
    return articlesData.items.filter((a: Article) => selectedIds.has(a.id));
  }, [articlesData, selectedIds]);

  const handleBatchPublish = () => {
    setPublishDialogOpen(true);
  };

  const selectedBrandIndustry = useMemo(() => {
    if (selectedArticles.length === 0) return undefined;
    const firstBrandId = selectedArticles[0].brandId;
    const brand = brandOptions.find((b) => b.id === firstBrandId);
    return brand?.industry || undefined;
  }, [selectedArticles, brandOptions]);

  return (
    <div className="space-y-5" style={{ backgroundColor: '#f8fafc' }}>
      <PageHeader
        title="所有文章"
        description="管理全部 AI 生成的文章内容，支持搜索、筛选与批量操作"
        actions={
          <Button
            size="sm"
            className="h-9"
            style={{ backgroundColor: PRIMARY }}
            onClick={() => navigate('/creation/article')}
          >
            <Plus className="h-3.5 w-3.5" />
            新建创作
          </Button>
        }
      />

      <Card
        className="w-full"
        style={{ borderRadius: '12px', border: '1px solid #E5E9F2' }}
      >
        <CardContent className="pt-5 space-y-4">
          {/* 筛选区 */}
          <div className="flex flex-wrap items-center gap-3">
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
                  {ARTICLE_STATUS_OPTIONS.map((s) => (
                    <SelectItem key={s} value={s}>
                      {ARTICLE_STATUS_LABELS[s]}
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
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search
                className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4"
                style={{ color: MUTED }}
              />
              <Input
                placeholder="搜索标题关键词"
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
          </div>

          {/* 错误态 */}
          {isError && (
            <div className="flex items-center justify-between rounded-lg border border-amber-200 bg-amber-50 p-4">
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
          )}

          {/* 批量操作栏 */}
          {articlesData && articlesData.items.length > 0 && (
            <div className="flex items-center justify-between rounded-lg border px-3 py-2" style={{ borderColor: '#E5E9F2', backgroundColor: '#F7F9FC' }}>
              <div className="flex items-center gap-2 text-sm">
                <Checkbox
                  id="batch-select-all"
                  checked={
                    selectedIds.size === articlesData.items.length && articlesData.items.length > 0
                      ? true
                      : selectedIds.size > 0
                      ? 'indeterminate'
                      : false
                  }
                  onCheckedChange={toggleSelectAll}
                />
                <label htmlFor="batch-select-all" className="text-sm cursor-pointer">
                  全选当前页
                </label>
                <span className="text-xs text-muted-foreground ml-2">
                  已选 {selectedIds.size} 篇
                </span>
              </div>
              <Button
                size="sm"
                className="h-8"
                style={{ backgroundColor: selectedIds.size > 0 ? PRIMARY : '#94a3b8' }}
                disabled={selectedIds.size === 0}
                onClick={handleBatchPublish}
              >
                <Megaphone className="h-3.5 w-3.5" />
                发布到媒体商城
              </Button>
            </div>
          )}

          {/* 表格区 */}
          {isLoading ? (
            <TableSkeleton />
          ) : articlesData ? (
            <DataTable
              headerRender={() => null}
              columns={[
                {
                  key: 'select',
                  title: '',
                  width: '40px',
                  headerRender: () => <span className="sr-only">选择</span>,
                  render: (item: Article) => (
                    <Checkbox
                      checked={selectedIds.has(item.id)}
                      onCheckedChange={() => toggleSelect(item.id)}
                      aria-label={`选择文章 ${item.title}`}
                    />
                  ),
                },
                {
                  key: 'index',
                  title: '序号',
                  width: '56px',
                  render: (_item: Article, index: number) => (
                    <span className="text-muted-foreground text-sm">
                      {(page - 1) * pageSize + index + 1}
                    </span>
                  ),
                },
                {
                  key: 'title',
                  title: '标题',
                  width: '200px',
                  render: (item: Article) => (
                    <div className="truncate max-w-[360px] font-medium" title={item.title}>
                      {item.title}
                    </div>
                  ),
                },
                {
                  key: 'brandName',
                  title: '品牌',
                  width: '112px',
                  render: (item: Article) => (
                    <span className="text-sm">{item.brandName}</span>
                  ),
                },
                {
                  key: 'articleType',
                  title: '类型',
                  width: '112px',
                  render: (item: Article) => (
                    <span className="text-sm">{ARTICLE_TYPE_LABELS[item.articleType]}</span>
                  ),
                },
                {
                  key: 'wordCount',
                  title: '字数',
                  width: '80px',
                  align: 'right',
                  render: (item: Article) => (
                    <span className="text-sm tabular-nums">
                      {item.wordCount.toLocaleString()}
                    </span>
                  ),
                },
                {
                  key: 'status',
                  title: '状态',
                  width: '96px',
                  render: (item: Article) => {
                    const variantMap: Record<string, 'success' | 'warning' | 'danger' | 'muted'> = {
                      draft: 'muted',
                      generating: 'warning',
                      published: 'success',
                      failed: 'danger',
                    };
                    return (
                      <Pill variant={variantMap[item.status] || 'muted'}>
                        {ARTICLE_STATUS_LABELS[item.status]}
                      </Pill>
                    );
                  },
                },
                {
                  key: 'createdAt',
                  title: '创建时间',
                  width: '160px',
                  render: (item: Article) => (
                    <span className="text-sm text-muted-foreground">
                      {formatDate(item.createdAt)}
                    </span>
                  ),
                },
                {
                  key: 'actions',
                  title: '操作',
                  width: '192px',
                  render: (item: Article) => (
                    <div className="flex items-center gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 px-2 text-xs"
                        onClick={() => setViewingArticle(item)}
                        style={{ color: PRIMARY }}
                      >
                        <Eye className="h-3 w-3" />查看
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 px-2 text-xs"
                        disabled={item.status === 'published'}
                        onClick={() => publishMutation.mutate(item.id)}
                        style={{ color: PRIMARY }}
                      >
                        <Send className="h-3 w-3" />发布
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 px-2 text-xs"
                        style={{ color: DANGER }}
                        onClick={() => setDeleteTarget(item)}
                      >
                        <Trash2 className="h-3 w-3" />删除
                      </Button>
                    </div>
                  ),
                },
              ]}
              data={articlesData.items}
              rowKey="id"
              emptyText="暂无文章"
              emptyAction={
                <Button
                  size="sm"
                  style={{ backgroundColor: PRIMARY }}
                  onClick={() => navigate('/creation/article')}
                >
                  <Plus className="h-3.5 w-3.5" />
                  去创作
                </Button>
              }
              pagination={{
                total: articlesData.total,
                page,
                pageSize,
                onPageChange: setPage,
                onPageSizeChange: handlePageSizeChange,
                pageSizeOptions: [10, 20, 50],
              }}
            />
          ) : (
            <EmptyState onCreate={() => navigate('/creation/article')} />
          )}
        </CardContent>
      </Card>

      {/* 查看文章抽屉 */}
      <Sheet
        open={!!viewingArticle}
        onOpenChange={(v) => !v && setViewingArticle(null)}
      >
        <SheetContent className="sm:max-w-2xl overflow-y-auto">
          <SheetHeader className="px-0 pt-2">
            <SheetTitle className="text-lg font-semibold">
              {viewingArticle?.title}
            </SheetTitle>
          </SheetHeader>
          {viewingArticle && (
            <div className="space-y-5 py-4">
              <div className="flex flex-wrap items-center gap-3 text-sm">
                <Pill
                  variant={
                    ({
                      draft: 'muted',
                      generating: 'warning',
                      published: 'success',
                      failed: 'danger',
                    } as Record<string, 'success' | 'warning' | 'danger' | 'muted'>)[
                      viewingArticle.status
                    ] || 'muted'
                  }
                >
                  {ARTICLE_STATUS_LABELS[viewingArticle.status]}
                </Pill>
                <span className="text-muted-foreground">
                  {ARTICLE_TYPE_LABELS[viewingArticle.articleType]}
                </span>
                <span className="text-muted-foreground">
                  字数：
                  <span className="tnum font-medium text-foreground">
                    {viewingArticle.wordCount.toLocaleString()}
                  </span>
                </span>
                <span className="text-muted-foreground">
                  创建时间：{formatDate(viewingArticle.createdAt)}
                </span>
              </div>

              <div className="space-y-2">
                <div className="text-sm font-medium">关键词</div>
                <div className="flex flex-wrap gap-2">
                  {viewingArticle.keywords.length > 0 ? (
                    viewingArticle.keywords.map((kw, i) => (
                      <Badge
                        key={i}
                        variant="outline"
                        className="font-normal"
                      >
                        {kw}
                      </Badge>
                    ))
                  ) : (
                    <span className="text-sm text-muted-foreground">无</span>
                  )}
                  {viewingArticle.longtailKeywords.length > 0 &&
                    viewingArticle.longtailKeywords.map((kw, i) => (
                      <Badge
                        key={`lt-${i}`}
                        variant="outline"
                        className="font-normal"
                        style={{ borderStyle: 'dashed' }}
                      >
                        {kw}
                      </Badge>
                    ))}
                </div>
              </div>

              <div className="space-y-2">
                <div className="text-sm font-medium">正文</div>
                {renderContent(viewingArticle.content)}
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* 删除确认 */}
      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(v) => !v && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除</AlertDialogTitle>
            <AlertDialogDescription>
              确定要删除文章「{deleteTarget?.title}」吗？此操作不可撤销。
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

      {/* 发布到媒体商城弹窗 */}
      <PublishToMarketDialog
        open={publishDialogOpen}
        onOpenChange={setPublishDialogOpen}
        articleIds={Array.from(selectedIds)}
        industry={selectedBrandIndustry}
      />
    </div>
  );
};

const TableSkeleton = () => (
  <div
    className="space-y-1 rounded-md border p-4"
    style={{ borderColor: '#E5E9F2' }}
  >
    {Array.from({ length: 8 }).map((_, i) => (
      <div key={i} className="flex items-center gap-4 h-11">
        <Skeleton className="h-4 w-10" />
        <Skeleton className="h-4 w-64 flex-1" />
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-4 w-16" />
        <Skeleton className="h-5 w-16 rounded-full" />
        <Skeleton className="h-4 w-32" />
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
      <FileText className="h-8 w-8" style={{ color: '#94A3B8' }} />
    </div>
    <div className="text-center space-y-1">
      <div className="text-base font-medium">暂无文章</div>
      <div className="text-sm text-muted-foreground">
        去创作你的第一篇文章吧
      </div>
    </div>
    <Button
      size="sm"
      className="mt-2"
      style={{ backgroundColor: PRIMARY }}
      onClick={onCreate}
    >
      <Plus className="h-3.5 w-3.5" />
      去创作
    </Button>
  </div>
);

export default AllArticlesPage;
