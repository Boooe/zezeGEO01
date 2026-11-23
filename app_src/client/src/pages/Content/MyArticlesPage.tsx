import { useCallback, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Search,
  Eye,
  Edit,
  Copy,
  Trash2,
  CheckCircle,
  FileText,
} from 'lucide-react';
import { logger } from '@lark-apaas/client-toolkit/logger';

import { Button } from '@client/src/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@client/src/components/ui/card';
import { Input } from '@client/src/components/ui/input';
import { Textarea } from '@client/src/components/ui/textarea';
import { Label } from '@client/src/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@client/src/components/ui/select';
import { Badge } from '@client/src/components/ui/badge';
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
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationPrevious,
  PaginationNext,
} from '@client/src/components/ui/pagination';
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
import { useAuth } from '@client/src/hooks/useAuth';
import {
  getArticles,
  updateArticle,
  deleteArticle,
  publishArticle,
} from '@client/src/api/content';
import { getBrandList } from '@client/src/api/keywords';
import {
  ARTICLE_TYPES,
  ARTICLE_TYPE_LABELS,
  ARTICLE_STATUS,
  ARTICLE_STATUS_LABELS,
  type Article,
  type ArticleType,
  type ArticleStatus,
} from '@shared/api.interface';

const PRIMARY = '#1e40af';

const MyArticlesPage = () => {
  const { hasRole } = useAuth();
  const queryClient = useQueryClient();
  const isClient = hasRole('client');

  /* ---------------- 筛选条件 ---------------- */
  const [page, setPage] = useState<number>(1);
  const [pageSize] = useState<number>(10);
  const [brandId, setBrandId] = useState<string>('');
  const [articleType, setArticleType] = useState<string>('');
  const [status, setStatus] = useState<string>('');
  const [keyword, setKeyword] = useState<string>('');
  const [searchKeyword, setSearchKeyword] = useState<string>('');

  /* ---------------- 弹窗状态 ---------------- */
  const [viewArticle, setViewArticle] = useState<Article | null>(null);
  const [isEditMode, setIsEditMode] = useState<boolean>(false);
  const [editTitle, setEditTitle] = useState<string>('');
  const [editContent, setEditContent] = useState<string>('');
  const [deleteTarget, setDeleteTarget] = useState<Article | null>(null);

  /* ---------------- 品牌列表 ---------------- */
  const { data: brandList = [] } = useQuery({
    queryKey: ['brandOptions'],
    queryFn: () => getBrandList(),
    enabled: !isClient,
  });

  /* ---------------- 文章列表 ---------------- */
  const { data, isLoading } = useQuery({
    queryKey: ['myArticles', { page, pageSize, brandId, articleType, status, keyword: searchKeyword }],
    queryFn: () =>
      getArticles({
        page,
        pageSize,
        brandId: brandId || undefined,
        articleType: (articleType as ArticleType) || undefined,
        status: (status as ArticleStatus) || undefined,
        keyword: searchKeyword || undefined,
      }),
    enabled: true,
  });

  const articles = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  /* ---------------- 搜索 ---------------- */
  const handleSearch = useCallback(() => {
    setSearchKeyword(keyword.trim());
    setPage(1);
  }, [keyword]);

  /* ---------------- 筛选变更重置到第一页 ---------------- */
  const handleBrandChange = useCallback((val: string) => {
    setBrandId(val);
    setPage(1);
  }, []);

  const handleTypeChange = useCallback((val: string) => {
    setArticleType(val);
    setPage(1);
  }, []);

  const handleStatusChange = useCallback((val: string) => {
    setStatus(val);
    setPage(1);
  }, []);

  /* ---------------- 查看/编辑 ---------------- */
  const openView = useCallback((article: Article) => {
    setViewArticle(article);
    setIsEditMode(false);
    setEditTitle(article.title);
    setEditContent(article.content);
  }, []);

  const startEdit = useCallback(() => {
    setIsEditMode(true);
  }, []);

  const closeDialog = useCallback(() => {
    setViewArticle(null);
    setIsEditMode(false);
  }, []);

  const saveEditMutation = useMutation({
    mutationFn: async () => {
      if (!viewArticle) throw new Error('未选中文章');
      return updateArticle(viewArticle.id, {
        title: editTitle,
        content: editContent,
      });
    },
    retry: false,
    onSuccess: (updated: Article) => {
      setViewArticle(updated);
      setIsEditMode(false);
      toast.success('保存成功');
      queryClient.invalidateQueries({ queryKey: ['myArticles'] });
    },
    onError: (err: Error) => {
      toast.error(err.message || '保存失败');
      logger.error('保存文章失败', err);
    },
  });

  /* ---------------- 复制 ---------------- */
  const handleCopy = useCallback(async (article: Article) => {
    try {
      await navigator.clipboard.writeText(`${article.title}\n\n${article.content}`);
      toast.success('已复制到剪贴板');
    } catch {
      toast.error('复制失败');
    }
  }, []);

  /* ---------------- 标记发布 ---------------- */
  const publishMutation = useMutation({
    mutationFn: (id: string) => publishArticle(id),
    retry: false,
    onSuccess: () => {
      toast.success('已标记为已发布');
      queryClient.invalidateQueries({ queryKey: ['myArticles'] });
    },
    onError: (err: Error) => {
      toast.error(err.message || '操作失败');
    },
  });

  /* ---------------- 删除 ---------------- */
  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteArticle(id),
    retry: false,
    onSuccess: () => {
      toast.success('已删除');
      setDeleteTarget(null);
      queryClient.invalidateQueries({ queryKey: ['myArticles'] });
      // 如果删完当前页没数据了，回退一页
      if (articles.length === 1 && page > 1) {
        setPage(page - 1);
      }
    },
    onError: (err: Error) => {
      toast.error(err.message || '删除失败');
    },
  });

  /* ---------------- 状态 Badge variant ---------------- */
  const getStatusVariant = useCallback((s: ArticleStatus): 'default' | 'secondary' | 'destructive' => {
    switch (s) {
      case 'published':
        return 'default';
      case 'failed':
        return 'destructive';
      default:
        return 'secondary';
    }
  }, []);

  /* ---------------- 分页数字 ---------------- */
  const pageNumbers = useMemo(() => {
    const pages: number[] = [];
    const maxShown = 5;
    let start = Math.max(1, page - Math.floor(maxShown / 2));
    const end = Math.min(totalPages, start + maxShown - 1);
    start = Math.max(1, end - maxShown + 1);
    for (let i = start; i <= end; i += 1) pages.push(i);
    return pages;
  }, [page, totalPages]);

  return (
    <div className="space-y-6" style={{ backgroundColor: '#f8fafc' }}>
      {/* 页面标题 */}
      <div>
        <h1 className="text-[20px] font-semibold leading-none" style={{ color: '#101828' }}>
          我的文章
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          查看和管理所有已生成的文章
        </p>
      </div>

      {/* 筛选栏 + 表格 */}
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <FileText size={18} style={{ color: PRIMARY }} />
            文章列表
          </CardTitle>
          <CardDescription>共 {total} 篇文章</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* 筛选栏 */}
          <div className="flex flex-wrap gap-3 items-end">
            {!isClient && (
              <div className="space-y-1.5 w-[180px]">
                <Label className="text-xs">品牌</Label>
                <Select value={brandId} onValueChange={handleBrandChange}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="全部品牌" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">全部品牌</SelectItem>
                    {brandList.map((b: { id: string; name: string }) => (
                      <SelectItem key={b.id} value={b.id}>
                        {b.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-1.5 w-[160px]">
              <Label className="text-xs">创作类型</Label>
              <Select value={articleType} onValueChange={handleTypeChange}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="全部类型" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">全部类型</SelectItem>
                  {ARTICLE_TYPES.map((type: ArticleType) => (
                    <SelectItem key={type} value={type}>
                      {ARTICLE_TYPE_LABELS[type]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5 w-[140px]">
              <Label className="text-xs">状态</Label>
              <Select value={status} onValueChange={handleStatusChange}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="全部状态" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">全部状态</SelectItem>
                  {ARTICLE_STATUS.map((s: ArticleStatus) => (
                    <SelectItem key={s} value={s}>
                      {ARTICLE_STATUS_LABELS[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5 flex-1 min-w-[200px]">
              <Label className="text-xs">关键词搜索</Label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={14} />
                  <Input
                    placeholder="搜索标题或关键词..."
                    value={keyword}
                    onChange={(e) => setKeyword(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSearch();
                    }}
                    className="pl-9"
                  />
                </div>
                <Button size="sm" onClick={handleSearch}>
                  搜索
                </Button>
              </div>
            </div>
          </div>

          {/* 表格 */}
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[280px]">标题</TableHead>
                  {!isClient && <TableHead>品牌</TableHead>}
                  <TableHead>创作类型</TableHead>
                  <TableHead>字数</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead>创建时间</TableHead>
                  <TableHead className="text-right w-[200px]">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell colSpan={!isClient ? 7 : 6}>
                        <Skeleton className="h-10 w-full" />
                      </TableCell>
                    </TableRow>
                  ))
                ) : articles.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={!isClient ? 7 : 6}
                      className="text-center py-12 text-muted-foreground"
                    >
                      暂无文章数据
                    </TableCell>
                  </TableRow>
                ) : (
                  articles.map((article: Article) => (
                    <TableRow key={article.id}>
                      <TableCell className="font-medium">
                        <div className="truncate max-w-[280px]" title={article.title}>
                          {article.title}
                        </div>
                      </TableCell>
                      {!isClient && (
                        <TableCell className="text-muted-foreground">
                          {article.brandName}
                        </TableCell>
                      )}
                      <TableCell>
                        <Badge variant="outline">
                          {ARTICLE_TYPE_LABELS[article.articleType]}
                        </Badge>
                      </TableCell>
                      <TableCell>{article.wordCount}</TableCell>
                      <TableCell>
                        <Badge variant={getStatusVariant(article.status)}>
                          {ARTICLE_STATUS_LABELS[article.status]}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-xs">
                        {new Date(article.createdAt).toLocaleString('zh-CN')}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => openView(article)}
                            aria-label="查看"
                          >
                            <Eye size={14} />
                            <span className="hidden sm:inline">查看</span>
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleCopy(article)}
                            aria-label="复制"
                          >
                            <Copy size={14} />
                          </Button>
                          {article.status !== 'published' && article.status !== 'failed' && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => publishMutation.mutate(article.id)}
                              aria-label="标记已发布"
                              className="text-green-600"
                            >
                              <CheckCircle size={14} />
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setDeleteTarget(article)}
                            aria-label="删除"
                            className="text-red-500"
                          >
                            <Trash2 size={14} />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* 分页 */}
          {totalPages > 1 && (
            <Pagination>
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious
                    onClick={() => setPage(Math.max(1, page - 1))}
                    className={page === 1 ? 'pointer-events-none opacity-50 cursor-pointer' : 'cursor-pointer'}
                    aria-disabled={page === 1}
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
                    aria-disabled={page === totalPages}
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          )}
        </CardContent>
      </Card>

      {/* 查看/编辑弹窗 */}
      <Dialog open={!!viewArticle} onOpenChange={(open) => !open && closeDialog()}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>
              {isEditMode ? '编辑文章' : '文章详情'}
            </DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto space-y-4 pr-1">
            {/* 状态和类型 */}
            {viewArticle && (
              <div className="flex items-center gap-2">
                <Badge variant={getStatusVariant(viewArticle.status)}>
                  {ARTICLE_STATUS_LABELS[viewArticle.status]}
                </Badge>
                <Badge variant="outline">
                  {ARTICLE_TYPE_LABELS[viewArticle.articleType]}
                </Badge>
                <span className="text-xs text-muted-foreground ml-auto">
                  {viewArticle.wordCount} 字 · {viewArticle.costCredits} 算力
                </span>
              </div>
            )}

            {/* 标题 */}
            {isEditMode ? (
              <div className="space-y-1.5">
                <Label className="text-xs">标题</Label>
                <Input
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="text-base font-medium"
                />
              </div>
            ) : (
              <h2 className="text-xl font-semibold" style={{ color: '#0f172a' }}>
                {viewArticle?.title}
              </h2>
            )}

            {/* 正文 */}
            {isEditMode ? (
              <div className="space-y-1.5">
                <Label className="text-xs">正文</Label>
                <Textarea
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  className="min-h-[320px] resize-y"
                />
              </div>
            ) : (
              <div className="rounded-md border bg-slate-50/50 p-4 max-h-[400px] overflow-y-auto">
                <div className="text-sm leading-relaxed whitespace-pre-wrap text-slate-700">
                  {viewArticle?.content}
                </div>
              </div>
            )}

            {/* 元信息 */}
            {viewArticle && (
              <div className="text-xs text-muted-foreground border-t pt-3">
                创建时间：{new Date(viewArticle.createdAt).toLocaleString('zh-CN')}
              </div>
            )}
          </div>

          <DialogFooter className="pt-2">
            {isEditMode ? (
              <>
                <Button variant="outline" onClick={() => setIsEditMode(false)}>
                  取消
                </Button>
                <Button
                  onClick={() => saveEditMutation.mutate()}
                  disabled={saveEditMutation.isPending}
                >
                  <Edit size={14} />
                  保存修改
                </Button>
              </>
            ) : (
              <>
                <Button variant="outline" onClick={closeDialog}>
                  关闭
                </Button>
                <Button variant="outline" onClick={() => viewArticle && handleCopy(viewArticle)}>
                  <Copy size={14} />
                  复制全文
                </Button>
                <Button onClick={startEdit}>
                  <Edit size={14} />
                  编辑
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 删除确认弹窗 */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除</AlertDialogTitle>
            <AlertDialogDescription>
              确定要删除文章「{deleteTarget?.title}」吗？此操作不可恢复。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
              className="bg-destructive hover:bg-destructive/90"
            >
              {deleteMutation.isPending ? '删除中...' : '确认删除'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default MyArticlesPage;
