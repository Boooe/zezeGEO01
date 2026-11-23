import React, { useState, useMemo, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import {
  Plus,
  Search,
  Eye,
  Edit2,
  Trash2,
  Copy,
  X,
  Loader2,
  FileText,
} from 'lucide-react';
import { toast } from 'sonner';
import { logger } from '@lark-apaas/client-toolkit/logger';

import { Button } from '@client/src/components/ui/button';
import { Input } from '@client/src/components/ui/input';
import { Textarea } from '@client/src/components/ui/textarea';
import { Label } from '@client/src/components/ui/label';
import { Badge } from '@client/src/components/ui/badge';
import { Pill } from '@client/src/components/layout/Pill';
import { SectionCard } from '@client/src/components/layout/SectionCard';
import { DataTable } from '@client/src/components/layout/DataTable';
import { EmptyState } from '@client/src/components/layout/EmptyState';
import { Toolbar } from '@client/src/components/layout/Toolbar';
import { Skeleton } from '@client/src/components/ui/skeleton';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@client/src/components/ui/select';
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
import { Switch } from '@client/src/components/ui/switch';
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@client/src/components/ui/pagination';
import {
  Empty,
  EmptyHeader,
  EmptyTitle,
  EmptyContent,
  EmptyDescription,
} from '@client/src/components/ui/empty';
import { ScrollArea } from '@client/src/components/ui/scroll-area';
import { ComplianceCheckDialog } from '@client/src/components/compliance/ComplianceCheckDialog';
import { ComplianceBadge } from '@client/src/components/ui/compliance-badge';
import { checkCompliance } from '@client/src/api/compliance';
import type { ComplianceCheckResponse } from '@shared/api.interface';

import { creation } from '@client/src/api';
import { getBrandList } from '@client/src/api/keywords';
import { useAuth } from '@client/src/contexts/AuthContext';
import {
  ARTICLE_TYPES,
  ARTICLE_TYPE_LABELS,
  ARTICLE_STATUS,
  ARTICLE_STATUS_LABELS,
  type Article,
  type PagedResponse,
} from '@shared/api.interface';

const PAGE_SIZE = 10;

const ArticlePage: React.FC = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const isClient = user?.role === 'client';

  // 筛选
  const [brandId, setBrandId] = useState<string>(user?.brandId ?? '');
  const [articleType, setArticleType] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [keyword, setKeyword] = useState<string>('');
  const [searchKw, setSearchKw] = useState<string>('');
  const [page, setPage] = useState(1);

  // 弹窗状态
  const [createOpen, setCreateOpen] = useState(false);
  const [viewArticle, setViewArticle] = useState<Article | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editContent, setEditContent] = useState('');
  const [editStatus, setEditStatus] = useState<string>('draft');
  const [deleteTarget, setDeleteTarget] = useState<Article | null>(null);

  // 新建表单
  const [formBrandId, setFormBrandId] = useState<string>('');
  const [formKeywords, setFormKeywords] = useState<string>('');
  const [formLongtail, setFormLongtail] = useState<string>('');
  const [formType, setFormType] = useState<Article['articleType']>('recommendation');
  const [formCount, setFormCount] = useState(1);
  const [formAutoCover, setFormAutoCover] = useState(false);
  const [formUseKb, setFormUseKb] = useState(false);
  const [formKbCategories, setFormKbCategories] = useState<string[]>([]);

  // 合规预检
  const [complianceOpen, setComplianceOpen] = useState(false);
  const [complianceResult, setComplianceResult] = useState<ComplianceCheckResponse | null>(null);
  const complianceMutation = useMutation<ComplianceCheckResponse, unknown, { title: string; content: string; articleId?: string }>({
    mutationFn: (body) => checkCompliance(body),
    retry: false,
    onSuccess: (data) => {
      setComplianceResult(data);
    },
    onError: () => {
      toast.error('合规检测失败');
    },
  });

  const [searchParams] = useSearchParams();

  const kbCategories = ['品牌知识库', '产品知识库', '行业资讯', '常见问题'];

  // 从 URL 读取 keyword 参数，自动填入并打开创作弹窗
  useEffect(() => {
    const kw = searchParams.get('keyword');
    if (kw && !createOpen) {
      setFormKeywords(kw);
      setFormBrandId(brandId || user?.brandId || '');
      setCreateOpen(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const { data: brandList = [] } = useQuery({
    queryKey: ['brands', 'options'],
    queryFn: getBrandList,
    staleTime: 5 * 60 * 1000,
    enabled: !isClient,
  });

  const { data: articlesData, isLoading: listLoading } = useQuery<
    PagedResponse<Article>,
    unknown
  >({
    queryKey: ['creationArticles', { page, brandId, articleType, status: statusFilter, keyword: searchKw }],
    queryFn: () =>
      creation.listArticles({
        page,
        pageSize: PAGE_SIZE,
        brandId: brandId || undefined,
        articleType: articleType || undefined,
        status: statusFilter || undefined,
        keyword: searchKw || undefined,
      }),
  });

  const articles = articlesData?.items ?? [];
  const total = articlesData?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const pageNumbers = useMemo(() => {
    const pages: number[] = [];
    const start = Math.max(1, page - 2);
    const end = Math.min(totalPages, start + 4);
    for (let i = start; i <= end; i++) pages.push(i);
    return pages;
  }, [page, totalPages]);

  /* ---------------- Mutations ---------------- */

  const generateMutation = useMutation({
    mutationFn: () => {
      const kwList = formKeywords
        .split(/[,，\n]/)
        .map((s: string) => s.trim())
        .filter(Boolean);
      const ltList = formLongtail
        .split(/[,，\n]/)
        .map((s: string) => s.trim())
        .filter(Boolean);
      return creation.generateArticles({
        brandId: formBrandId || brandId || user?.brandId || '',
        keywords: kwList.length > 0 ? kwList : ['关键词'],
        longtailKeywords: ltList,
        articleType: formType,
        targetWordCount: 1200,
        count: formCount,
        autoCover: formAutoCover,
        useKnowledgeBase: formUseKb,
        knowledgeCategories: formKbCategories,
      });
    },
    retry: false,
    onSuccess: () => {
      toast.success('文章生成任务已提交，正在后台处理...');
      setCreateOpen(false);
      resetCreateForm();
      queryClient.invalidateQueries({ queryKey: ['creationArticles'] });
      queryClient.invalidateQueries({ queryKey: ['creationOverview'] });
      queryClient.invalidateQueries({ queryKey: ['creationRecent'] });
      queryClient.invalidateQueries({ queryKey: ['creationTasks'] });
    },
    onError: (err: unknown) => {
      toast.error(
        (err as { response?: { data?: { error?: { message?: string } } } })
          ?.response?.data?.error?.message ?? '生成失败',
      );
    },
  });

  const updateMutation = useMutation<Article, unknown>({
    mutationFn: () =>
      creation.updateArticle(viewArticle!.id, {
        title: editTitle,
        content: editContent,
        status: editStatus as Article['status'],
      }),
    retry: false,
    onSuccess: () => {
      toast.success('保存成功');
      setIsEditMode(false);
      queryClient.invalidateQueries({ queryKey: ['creationArticles'] });
      if (viewArticle) {
        creation.getArticle(viewArticle.id).then((a: Article) => setViewArticle(a));
      }
    },
    onError: (err: unknown) => {
      toast.error(
        (err as { response?: { data?: { error?: { message?: string } } } })
          ?.response?.data?.error?.message ?? '保存失败',
      );
    },
  });

  const deleteMutation = useMutation<void, unknown, string>({
    mutationFn: (id: string) => creation.deleteArticle(id),
    retry: false,
    onSuccess: () => {
      toast.success('已删除');
      setDeleteTarget(null);
      queryClient.invalidateQueries({ queryKey: ['creationArticles'] });
      queryClient.invalidateQueries({ queryKey: ['creationOverview'] });
      queryClient.invalidateQueries({ queryKey: ['creationRecent'] });
      if (articles.length === 1 && page > 1) setPage(page - 1);
    },
    onError: (err: unknown) => {
      toast.error(
        (err as { response?: { data?: { error?: { message?: string } } } })
          ?.response?.data?.error?.message ?? '删除失败',
      );
    },
  });

  const resetCreateForm = () => {
    setFormKeywords('');
    setFormLongtail('');
    setFormType('recommendation');
    setFormCount(1);
    setFormAutoCover(false);
    setFormUseKb(false);
    setFormKbCategories([]);
  };

  const openCreate = () => {
    setFormBrandId(brandId || user?.brandId || '');
    setCreateOpen(true);
  };

  const handleView = (article: Article) => {
    setViewArticle(article);
    setIsEditMode(false);
  };

  const startEdit = () => {
    if (!viewArticle) return;
    setEditTitle(viewArticle.title);
    setEditContent(viewArticle.content);
    setEditStatus(viewArticle.status);
    setIsEditMode(true);
  };

  const handleCopy = (article: Article) => {
    const text = `${article.title}\n\n${article.content}`;
    navigator.clipboard?.writeText(text);
    toast.success('已复制全文');
  };

  const handleComplianceCheck = (article: Article) => {
    setComplianceResult(null);
    setComplianceOpen(true);
    complianceMutation.mutate({
      title: article.title,
      content: article.content,
      articleId: article.id,
    });
  };

  const handleSearch = () => {
    setSearchKw(keyword);
    setPage(1);
  };

  const toggleKbCategory = (cat: string) => {
    setFormKbCategories((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat],
    );
  };

  return (
    <div className="space-y-5">
      {/* 页面标题栏 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[20px] font-semibold text-[#0F172A]">
            AI 文章
          </h1>
          <p className="mt-1 text-[12px] text-[#5B6B85]">
            智能生成多类型营销文案，支持批量创作
          </p>
        </div>
        {!isClient && (
          <Button onClick={openCreate} style={{ height: '36px' }}>
            <Plus className="h-4 w-4" />
            生成文章
          </Button>
        )}
      </div>

      {/* 筛选栏 */}
      <SectionCard title="筛选">
        <Toolbar>
          {!isClient && (
            <>
              <Label className="text-[12px] text-[#5B6B85] w-10 shrink-0">品牌</Label>
              <Select value={brandId} onValueChange={setBrandId}>
                <SelectTrigger className="w-40 h-9">
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
            </>
          )}

          <Label className="text-[12px] text-[#5B6B85] w-10 shrink-0">类型</Label>
          <Select value={articleType} onValueChange={setArticleType}>
            <SelectTrigger className="w-36 h-9">
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

          <Label className="text-[12px] text-[#5B6B85] w-10 shrink-0">状态</Label>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-32 h-9">
              <SelectValue placeholder="全部状态" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">全部状态</SelectItem>
              {ARTICLE_STATUS.map((s) => (
                <SelectItem key={s} value={s}>
                  {ARTICLE_STATUS_LABELS[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="relative w-64 ml-auto">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94A3B8]" />
            <Input
              placeholder="搜索标题关键词"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              className="pl-9 h-9"
            />
          </div>
          <Button onClick={handleSearch} variant="outline" className="h-9">
            搜索
          </Button>
        </Toolbar>
      </SectionCard>

      {/* 列表 */}
      <SectionCard title="文章列表" count={total}>
        {listLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-11 w-full rounded" />
            ))}
          </div>
        ) : articles.length === 0 ? (
          <EmptyState
            icon={<FileText />}
            description={!isClient ? '点击右上角「生成文章」开始创作' : '暂无文章数据'}
          />
        ) : (
          <DataTable
            columns={[
              { key: 'title', title: '标题', render: (row: Article) => (
                <div className="flex items-center gap-2 min-w-0">
                  <span className="font-medium text-[#0F172A] truncate" title={row.title}>
                    {row.title}
                  </span>
                  {isTestArticle(row) && (
                    <Pill variant="muted" className="shrink-0">测试</Pill>
                  )}
                </div>
              )},
              { key: 'brandName', title: '品牌', width: '100px', render: (row: Article) => (
                <span className="text-[#5B6B85] truncate block" title={row.brandName || ''}>{row.brandName}</span>
              )},
              { key: 'articleType', title: '类型', width: '100px', render: (row: Article) => (
                <Pill variant="muted">{ARTICLE_TYPE_LABELS[row.articleType]}</Pill>
              )},
              { key: 'wordCount', title: '字数', width: '80px', align: 'right', render: (row: Article) => (
                <span className="text-[#5B6B85] tabular-nums">{row.wordCount}</span>
              )},
              { key: 'status', title: '状态', width: '90px', render: (row: Article) => (
                <Pill variant={getStatusPillVariant(row.status)}>
                  {getStatusLabel(row.status)}
                </Pill>
              )},
              { key: 'createdAt', title: '创建时间', width: '160px', render: (row: Article) => (
                <span className="text-[#5B6B85]">{new Date(row.createdAt).toLocaleString('zh-CN')}</span>
              )},
              { key: 'actions', title: '操作', width: '220px', align: 'right', render: (row: Article) => (
                <div className="flex items-center justify-end gap-1">
                  <Button variant="ghost" size="sm" onClick={() => handleView(row)} className="h-7 px-2 text-xs">
                    <Eye className="h-3 w-3 mr-1" />查看
                  </Button>
                  {!isClient && (
                    <>
                      <Button variant="ghost" size="sm" onClick={() => { setViewArticle(row); startEdit(); }} className="h-7 px-2 text-xs">
                        <Edit2 className="h-3 w-3 mr-1" />编辑
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => handleCopy(row)} className="h-7 px-2 text-xs">
                        <Copy className="h-3 w-3 mr-1" />复制
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setDeleteTarget(row)}
                        className="h-7 px-2 text-xs text-[#EF4444] hover:text-[#EF4444]"
                      >
                        <Trash2 className="h-3 w-3 mr-1" />删除
                      </Button>
                    </>
                  )}
                </div>
              )},
            ]}
            data={articles}
            rowKey="id"
            emptyText={!isClient ? '点击右上角「生成文章」开始创作' : '暂无文章数据'}
            emptyIcon={<FileText />}
            pagination={{
              total,
              page,
              pageSize: PAGE_SIZE,
              onPageChange: setPage,
              onPageSizeChange: () => {},
              pageSizeOptions: [PAGE_SIZE],
            }}
          />
        )}
      </SectionCard>

      {/* 生成文章弹窗 */}
      <Dialog open={createOpen} onOpenChange={(open) => !open && !generateMutation.isPending && setCreateOpen(open)}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-hidden flex flex-col p-0">
          <DialogHeader className="px-6 pt-6 pb-0">
            <DialogTitle className="text-lg font-semibold">生成文章</DialogTitle>
          </DialogHeader>

          <ScrollArea className="flex-1 px-6 py-4">
            <div className="space-y-5">
              {/* 品牌 */}
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">
                  品牌 <span className="text-destructive">*</span>
                </Label>
                <Select
                  value={formBrandId}
                  onValueChange={setFormBrandId}
                  disabled={isClient || !!user?.brandId}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="选择品牌" />
                  </SelectTrigger>
                  <SelectContent>
                    {brandList.map((b: { id: string; name: string }) => (
                      <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* 创作类型 */}
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">创作类型</Label>
                <div className="grid grid-cols-5 gap-2">
                  {ARTICLE_TYPES.map((t) => (
                    <Button
                      key={t}
                      variant={formType === t ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setFormType(t)}
                      className="w-full"
                    >
                      {ARTICLE_TYPE_LABELS[t]}
                    </Button>
                  ))}
                </div>
              </div>

              {/* 核心关键词 */}
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">核心关键词</Label>
                <Textarea
                  placeholder="输入核心关键词，多个用逗号或换行分隔"
                  value={formKeywords}
                  onChange={(e) => setFormKeywords(e.target.value)}
                  rows={2}
                />
                <p className="text-xs text-muted-foreground">
                  从关键词库带出或手动输入，多关键词用逗号分隔
                </p>
              </div>

              {/* 长尾关键词 */}
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">长尾关键词（可选）</Label>
                <Textarea
                  placeholder="输入长尾关键词，每行一个或逗号分隔"
                  value={formLongtail}
                  onChange={(e) => setFormLongtail(e.target.value)}
                  rows={2}
                />
              </div>

              {/* 生成篇数 + 自动配图 */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium">生成篇数</Label>
                  <Select
                    value={String(formCount)}
                    onValueChange={(v) => setFormCount(Number(v))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[1, 2, 3, 5, 10].map((n) => (
                        <SelectItem key={n} value={String(n)}>{n} 篇</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium">自动配图</Label>
                  <div className="flex items-center justify-between rounded-md border px-3 py-2">
                    <span className="text-sm text-muted-foreground">生成后自动配图</span>
                    <Switch
                      checked={formAutoCover}
                      onCheckedChange={setFormAutoCover}
                    />
                  </div>
                </div>
              </div>

              {/* 知识库分类 */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium">引用知识库分类</Label>
                  <Switch
                    checked={formUseKb}
                    onCheckedChange={setFormUseKb}
                  />
                </div>
                {formUseKb && (
                  <div className="flex flex-wrap gap-2">
                    {kbCategories.map((cat) => (
                      <Button
                        key={cat}
                        variant={formKbCategories.includes(cat) ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => toggleKbCategory(cat)}
                        className="h-7 text-xs"
                      >
                        {cat}
                      </Button>
                    ))}
                  </div>
                )}
              </div>

              {/* 生成中 */}
              {generateMutation.isPending && (
                <div className="flex items-center gap-2 rounded-md border bg-primary/5 p-3 text-sm text-primary">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  正在提交生成任务...
                </div>
              )}
            </div>
          </ScrollArea>

          <DialogFooter className="px-6 py-4 border-t">
            <Button variant="outline" onClick={() => setCreateOpen(false)} disabled={generateMutation.isPending}>
              取消
            </Button>
            <Button
              onClick={() => generateMutation.mutate()}
              disabled={generateMutation.isPending || !formBrandId}
            >
              {generateMutation.isPending ? (
                <><Loader2 className="h-4 w-4 animate-spin" />生成中...</>
              ) : (
                <>生成文章</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 查看/编辑弹窗 */}
      <Dialog open={!!viewArticle} onOpenChange={(open) => !open && setViewArticle(null)}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden flex flex-col p-0">
          <DialogHeader className="px-6 pt-6 pb-0">
            <DialogTitle className="text-lg font-semibold">
              {isEditMode ? '编辑文章' : '文章详情'}
            </DialogTitle>
          </DialogHeader>

          <ScrollArea className="flex-1 px-6 py-4">
            {viewArticle && (
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{ARTICLE_TYPE_LABELS[viewArticle.articleType]}</Badge>
                  {isEditMode ? (
                    <Select value={editStatus} onValueChange={setEditStatus}>
                      <SelectTrigger className="w-28 h-7 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ARTICLE_STATUS.map((s) => (
                          <SelectItem key={s} value={s}>{ARTICLE_STATUS_LABELS[s]}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    (() => {
                      return (
                        <Pill variant={getStatusPillVariant(viewArticle.status)}>
                          {getStatusLabel(viewArticle.status)}
                        </Pill>
                      );
                    })()
                  )}
                  <span className="ml-auto text-xs text-muted-foreground">
                    {viewArticle.wordCount} 字 · {viewArticle.costCredits} 算力
                  </span>
                </div>

                {isEditMode ? (
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">标题</Label>
                    <Input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} />
                  </div>
                ) : (
                  <h2 className="text-xl font-semibold text-foreground">
                    {viewArticle.title}
                  </h2>
                )}

                {isEditMode ? (
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">正文</Label>
                    <Textarea
                      value={editContent}
                      onChange={(e) => setEditContent(e.target.value)}
                      className="min-h-[320px] resize-y"
                    />
                  </div>
                ) : (
                  <div className="rounded-md border bg-slate-50/50 p-4 max-h-[400px] overflow-y-auto">
                    <div className="text-sm leading-relaxed whitespace-pre-wrap text-slate-700">
                      {viewArticle.content}
                    </div>
                  </div>
                )}

                <div className="text-xs text-muted-foreground border-t pt-3">
                  创建时间：{new Date(viewArticle.createdAt).toLocaleString('zh-CN')}
                  <br />
                  品牌：{viewArticle.brandName}
                </div>
              </div>
            )}
          </ScrollArea>

          <DialogFooter className="px-6 py-4 border-t">
            {isEditMode ? (
              <>
                <Button variant="outline" onClick={() => setIsEditMode(false)}>取消</Button>
                <Button onClick={() => updateMutation.mutate()} disabled={updateMutation.isPending}>
                  <Edit2 className="h-4 w-4" />保存修改
                </Button>
              </>
            ) : (
              <>
                <Button variant="outline" onClick={() => setViewArticle(null)}>关闭</Button>
                <Button
                  variant="outline"
                  onClick={() => viewArticle && handleComplianceCheck(viewArticle)}
                  disabled={complianceMutation.isPending}
                >
                  <FileText className="h-4 w-4 mr-1" />
                  合规预检
                </Button>
                <Button variant="outline" onClick={() => viewArticle && handleCopy(viewArticle)}>
                  <Copy className="h-4 w-4" />复制全文
                </Button>
                {!isClient && (
                  <Button onClick={startEdit}>
                    <Edit2 className="h-4 w-4" />编辑
                  </Button>
                )}
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 合规预检弹窗 */}
      <ComplianceCheckDialog
        open={complianceOpen}
        onOpenChange={setComplianceOpen}
        result={complianceResult}
        isLoading={complianceMutation.isPending}
      />

      {/* 删除确认 */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
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

function getStatusPillVariant(status: string): 'success' | 'warning' | 'danger' | 'info' | 'muted' {
  switch (status) {
    case 'published':
    case 'completed':
      return 'success';
    case 'generating':
      return 'info';
    case 'pending':
      return 'warning';
    case 'draft':
      return 'muted';
    case 'failed':
    case 'error':
    case 'partial_failed':
      return 'danger';
    default:
      return 'muted';
  }
}

function getStatusLabel(status: string): string {
  if (status === 'failed' || status === 'error' || status === 'partial_failed') {
    return '生成失败';
  }
  return ARTICLE_STATUS_LABELS[status as keyof typeof ARTICLE_STATUS_LABELS] ?? status;
}

function isTestArticle(article: Article): boolean {
  const title = article.title ?? '';
  if (title.includes('测试') || title.includes('可删除')) return true;
  const content = article.content ?? '';
  if (content.includes('测试') || content.includes('可删除')) return true;
  return false;
}

export default ArticlePage;
