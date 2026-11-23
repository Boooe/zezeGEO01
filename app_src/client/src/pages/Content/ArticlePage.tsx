import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { getApiErrorMessage } from '@client/src/lib/api-error';
import {
  FileText,
  Copy,
  Save,
  Trash2,
  Wand2,
  History,
  Plus,
  X,
  Sparkles,
  Clock,
  Hash,
  Type,
  Lightbulb,
  Search,
  Eye,
  Edit,
  CheckCircle,
  Megaphone,
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
import {
  RadioGroup,
  RadioGroupItem,
} from '@client/src/components/ui/radio-group';
import { Checkbox } from '@client/src/components/ui/checkbox';
import { Switch } from '@client/src/components/ui/switch';
import { Badge } from '@client/src/components/ui/badge';
import { Progress } from '@client/src/components/ui/progress';
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from '@client/src/components/ui/tabs';
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
  PaginationNext,
  PaginationPrevious,
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
  generateArticle,
  getArticle,
  getArticles,
  getCreditAccount,
  updateArticle,
  deleteArticle,
  publishArticle,
} from '@client/src/api/content';
import { getBrandList } from '@client/src/api/keywords';
import PublishToMarketDialog from './components/PublishToMarketDialog';
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
const ACCENT = '#f97316';

const WORD_COUNT_PRESETS = [800, 1200, 1500];

const ArticlePage = () => {
  const { user, hasRole } = useAuth();
  const queryClient = useQueryClient();
  const isClient = hasRole('client');

  /* ---------------- 顶层 tab ---------------- */
  const [activeTopTab, setActiveTopTab] = useState<string>('create');

  /* ---------------- 表单状态 ---------------- */
  const [brandId, setBrandId] = useState<string>('');
  const [coreKeywords, setCoreKeywords] = useState<string[]>([]);
  const [coreInput, setCoreInput] = useState<string>('');
  const [longtailKeywords, setLongtailKeywords] = useState<string[]>([]);
  const [longtailInput, setLongtailInput] = useState<string>('');
  const [articleType, setArticleType] = useState<ArticleType>('recommendation');
  const [wordCountPreset, setWordCountPreset] = useState<number>(1200);
  const [customWordCount, setCustomWordCount] = useState<string>('');
  const [useCustomWordCount, setUseCustomWordCount] = useState<boolean>(false);
  const [count, setCount] = useState<number>(1);
  const [useKnowledgeBase, setUseKnowledgeBase] = useState<boolean>(false);
  const [autoCover, setAutoCover] = useState<boolean>(false);

  /* ---------------- 生成状态 ---------------- */
  const [generatingIds, setGeneratingIds] = useState<string[]>([]);
  const [generatedArticles, setGeneratedArticles] = useState<Article[]>([]);
  const [activeTab, setActiveTab] = useState<string>('0');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState<string>('');
  const [editContent, setEditContent] = useState<string>('');
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  /* ---------------- 历史列表状态 ---------------- */
  const [historyPage, setHistoryPage] = useState<number>(1);
  const [historyPageSize] = useState<number>(10);
  const [historyBrandId, setHistoryBrandId] = useState<string>('');
  const [historyType, setHistoryType] = useState<string>('');
  const [historyStatus, setHistoryStatus] = useState<string>('');
  const [historyKeyword, setHistoryKeyword] = useState<string>('');
  const [historySearchKw, setHistorySearchKw] = useState<string>('');

  /* ---------------- 历史查看/编辑弹窗 ---------------- */
  const [viewArticle, setViewArticle] = useState<Article | null>(null);
  const [isEditMode, setIsEditMode] = useState<boolean>(false);
  const [viewEditTitle, setViewEditTitle] = useState<string>('');
  const [viewEditContent, setViewEditContent] = useState<string>('');
  const [deleteTarget, setDeleteTarget] = useState<Article | null>(null);
  const [publishDialogOpen, setPublishDialogOpen] = useState<boolean>(false);
  const [publishArticleIds, setPublishArticleIds] = useState<string[]>([]);
  const [publishIndustry, setPublishIndustry] = useState<string | undefined>(undefined);

  /* ---------------- 品牌列表 ---------------- */
  const { data: brandList = [] } = useQuery({
    queryKey: ['brandOptions'],
    queryFn: () => getBrandList(),
    enabled: !isClient,
  });

  // client 角色默认自己品牌
  useEffect(() => {
    if (isClient && user?.brandId) {
      setBrandId(user.brandId);
      setHistoryBrandId(user.brandId);
    } else if (brandList.length > 0 && !brandId) {
      setBrandId(brandList[0].id);
    }
  }, [isClient, user?.brandId, brandList, brandId]);

  /* ---------------- 算力账户 ---------------- */
  const { data: creditAccount } = useQuery({
    queryKey: ['creditAccount', brandId],
    queryFn: () => getCreditAccount(),
    enabled: !!brandId,
    refetchInterval: 15000,
  });

  /* ---------------- 最近生成的文章（创作 tab 底部） ---------------- */
  const { data: recentArticles } = useQuery({
    queryKey: ['recentArticles', brandId],
    queryFn: () => getArticles({ page: 1, pageSize: 10, brandId }),
    enabled: !!brandId,
  });

  /* ---------------- 历史文章列表 ---------------- */
  const { data: historyData, isLoading: historyLoading } = useQuery({
    queryKey: [
      'historyArticles',
      {
        page: historyPage,
        pageSize: historyPageSize,
        brandId: historyBrandId,
        articleType: historyType,
        status: historyStatus,
        keyword: historySearchKw,
      },
    ],
    queryFn: () =>
      getArticles({
        page: historyPage,
        pageSize: historyPageSize,
        brandId: historyBrandId || undefined,
        articleType: (historyType as ArticleType) || undefined,
        status: (historyStatus as ArticleStatus) || undefined,
        keyword: historySearchKw || undefined,
      }),
    enabled: activeTopTab === 'history',
  });

  const historyArticles = historyData?.items ?? [];
  const historyTotal = historyData?.total ?? 0;
  const historyTotalPages = Math.max(1, Math.ceil(historyTotal / historyPageSize));

  /* ---------------- 预计消耗算力 ---------------- */
  const estimatedCost = useMemo(() => {
    const baseCost = useCustomWordCount
      ? Math.max(1, Math.round(Number(customWordCount) / 100))
      : Math.round(wordCountPreset / 100);
    let total = baseCost * count;
    if (autoCover) total += count * 2;
    return total;
  }, [wordCountPreset, customWordCount, useCustomWordCount, count, autoCover]);

  /* ---------------- 关键词添加 ---------------- */
  const addCoreKeyword = useCallback(() => {
    const val = coreInput.trim();
    if (!val) return;
    if (coreKeywords.includes(val)) {
      setCoreInput('');
      return;
    }
    setCoreKeywords([...coreKeywords, val]);
    setCoreInput('');
  }, [coreInput, coreKeywords]);

  const removeCoreKeyword = useCallback(
    (kw: string) => {
      setCoreKeywords(coreKeywords.filter((k: string) => k !== kw));
    },
    [coreKeywords],
  );

  const addLongtailKeywords = useCallback(() => {
    const lines = longtailInput
      .split(/[\n,，]/)
      .map((s: string) => s.trim())
      .filter(Boolean);
    if (lines.length === 0) return;
    const merged = [...longtailKeywords];
    for (const line of lines) {
      if (!merged.includes(line)) merged.push(line);
    }
    setLongtailKeywords(merged);
    setLongtailInput('');
  }, [longtailInput, longtailKeywords]);

  const removeLongtailKeyword = useCallback(
    (kw: string) => {
      setLongtailKeywords(longtailKeywords.filter((k: string) => k !== kw));
    },
    [longtailKeywords],
  );

  /* ---------------- 生成文章 ---------------- */
  const targetWordCount = useCustomWordCount
    ? Number(customWordCount) || 1200
    : wordCountPreset;

  const generateMutation = useMutation({
    mutationFn: async () => {
      if (!brandId) throw new Error('请选择品牌');
      if (coreKeywords.length === 0 && longtailKeywords.length === 0) {
        throw new Error('请至少输入一个关键词');
      }
      if (count < 1 || count > 10) throw new Error('生成篇数需在 1-10 之间');
      if (targetWordCount < 200) throw new Error('目标字数不能少于 200');

      const result = await generateArticle({
        brandId,
        keywords: coreKeywords,
        longtailKeywords,
        articleType,
        targetWordCount,
        count,
        useKnowledgeBase,
        autoCover,
      });
      return result;
    },
    retry: false,
    onSuccess: (result) => {
      setGeneratingIds(result.articleIds);
      setGeneratedArticles([]);
      setActiveTab('0');
      toast.success('已开始生成，请稍候...');
    },
    onError: (err: Error) => {
      toast.error(getApiErrorMessage(err, '生成失败'));
      logger.error('生成文章失败', err);
    },
  });

  /* ---------------- 轮询文章状态 ---------------- */
  useEffect(() => {
    if (generatingIds.length === 0) return;

    const poll = async () => {
      try {
        const results = await Promise.all(
          generatingIds.map((id: string) => getArticle(id)),
        );
        setGeneratedArticles(results);

        const allDone = results.every(
          (a: Article) => a.status === 'draft' || a.status === 'failed' || a.status === 'published',
        );
        if (allDone) {
          if (pollTimerRef.current) {
            clearInterval(pollTimerRef.current);
            pollTimerRef.current = null;
          }
          const failedCount = results.filter((a: Article) => a.status === 'failed').length;
          if (failedCount > 0) {
            toast.warning(`生成完成，${failedCount} 篇失败`);
          } else {
            toast.success(`成功生成 ${results.length} 篇文章`);
          }
          queryClient.invalidateQueries({ queryKey: ['recentArticles'] });
          queryClient.invalidateQueries({ queryKey: ['historyArticles'] });
          queryClient.invalidateQueries({ queryKey: ['creditAccount'] });
        }
      } catch (err) {
        logger.error('轮询文章状态失败', err);
      }
    };

    poll();
    pollTimerRef.current = setInterval(poll, 3000);

    return () => {
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
    };
  }, [generatingIds, queryClient]);

  /* ---------------- 进度计算 ---------------- */
  const progress = useMemo(() => {
    if (generatingIds.length === 0) return 0;
    if (generatedArticles.length === 0) return 10;
    const done = generatedArticles.filter(
      (a: Article) => a.status === 'draft' || a.status === 'failed' || a.status === 'published',
    ).length;
    return Math.min(95, Math.round((done / generatingIds.length) * 100));
  }, [generatingIds, generatedArticles]);

  const generatingCount = useMemo(
    () => generatedArticles.filter((a: Article) => a.status === 'generating').length,
    [generatedArticles],
  );

  /* ---------------- 复制全文 ---------------- */
  const handleCopy = useCallback(async (article: Article) => {
    try {
      await navigator.clipboard.writeText(`${article.title}\n\n${article.content}`);
      toast.success('已复制到剪贴板');
    } catch {
      toast.error('复制失败');
    }
  }, []);

  /* ---------------- 保存/编辑（生成结果区） ---------------- */
  const startEdit = useCallback((article: Article) => {
    setEditingId(article.id);
    setEditTitle(article.title);
    setEditContent(article.content);
  }, []);

  const cancelEdit = useCallback(() => {
    setEditingId(null);
  }, []);

  const saveEditMutation = useMutation({
    mutationFn: async () => {
      if (!editingId) throw new Error('未选中文章');
      return updateArticle(editingId, { title: editTitle, content: editContent });
    },
    retry: false,
    onSuccess: (updated: Article) => {
      setGeneratedArticles((prev: Article[]) =>
        prev.map((a: Article) => (a.id === updated.id ? updated : a)),
      );
      setEditingId(null);
      toast.success('保存成功');
      queryClient.invalidateQueries({ queryKey: ['recentArticles'] });
      queryClient.invalidateQueries({ queryKey: ['historyArticles'] });
    },
    onError: (err: Error) => {
      toast.error(err.message || '保存失败');
    },
  });

  /* ---------------- 删除文章 ---------------- */
  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteArticle(id),
    retry: false,
    onSuccess: (_void: void, id: string) => {
      setGeneratedArticles((prev: Article[]) => prev.filter((a: Article) => a.id !== id));
      setDeleteTarget(null);
      toast.success('已删除');
      queryClient.invalidateQueries({ queryKey: ['recentArticles'] });
      queryClient.invalidateQueries({ queryKey: ['historyArticles'] });
    },
    onError: (err: Error) => {
      toast.error(err.message || '删除失败');
    },
  });

  /* ---------------- 标记发布 ---------------- */
  const publishMutation = useMutation({
    mutationFn: (id: string) => publishArticle(id),
    retry: false,
    onSuccess: (updated: Article) => {
      setGeneratedArticles((prev: Article[]) =>
        prev.map((a: Article) => (a.id === updated.id ? updated : a)),
      );
      toast.success('已标记为已发布');
      queryClient.invalidateQueries({ queryKey: ['recentArticles'] });
      queryClient.invalidateQueries({ queryKey: ['historyArticles'] });
    },
    onError: (err: Error) => {
      toast.error(err.message || '操作失败');
    },
  });

  /* ---------------- 历史 tab 操作 ---------------- */
  const handleHistorySearch = useCallback(() => {
    setHistorySearchKw(historyKeyword.trim());
    setHistoryPage(1);
  }, [historyKeyword]);

  const handleHistoryBrandChange = useCallback((val: string) => {
    setHistoryBrandId(val);
    setHistoryPage(1);
  }, []);

  const handleHistoryTypeChange = useCallback((val: string) => {
    setHistoryType(val);
    setHistoryPage(1);
  }, []);

  const handleHistoryStatusChange = useCallback((val: string) => {
    setHistoryStatus(val);
    setHistoryPage(1);
  }, []);

  const openViewArticle = useCallback((article: Article) => {
    setViewArticle(article);
    setIsEditMode(false);
    setViewEditTitle(article.title);
    setViewEditContent(article.content);
  }, []);

  const startViewEdit = useCallback(() => {
    setIsEditMode(true);
  }, []);

  const closeViewDialog = useCallback(() => {
    setViewArticle(null);
    setIsEditMode(false);
  }, []);

  const saveViewEditMutation = useMutation({
    mutationFn: async () => {
      if (!viewArticle) throw new Error('未选中文章');
      return updateArticle(viewArticle.id, {
        title: viewEditTitle,
        content: viewEditContent,
      });
    },
    retry: false,
    onSuccess: (updated: Article) => {
      setViewArticle(updated);
      setIsEditMode(false);
      toast.success('保存成功');
      queryClient.invalidateQueries({ queryKey: ['historyArticles'] });
      queryClient.invalidateQueries({ queryKey: ['recentArticles'] });
    },
    onError: (err: Error) => {
      toast.error(err.message || '保存失败');
      logger.error('保存文章失败', err);
    },
  });

  const historyPublishMutation = useMutation({
    mutationFn: (id: string) => publishArticle(id),
    retry: false,
    onSuccess: () => {
      toast.success('已标记为已发布');
      queryClient.invalidateQueries({ queryKey: ['historyArticles'] });
    },
    onError: (err: Error) => {
      toast.error(err.message || '操作失败');
    },
  });

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

  const historyPageNumbers = useMemo(() => {
    const pages: number[] = [];
    const maxShown = 5;
    let start = Math.max(1, historyPage - Math.floor(maxShown / 2));
    const end = Math.min(historyTotalPages, start + maxShown - 1);
    start = Math.max(1, end - maxShown + 1);
    for (let i = start; i <= end; i += 1) pages.push(i);
    return pages;
  }, [historyPage, historyTotalPages]);

  const currentArticle = generatedArticles[Number(activeTab)];
  const isGenerating = generatingIds.length > 0 && generatingCount > 0;
  const hasResults = generatedArticles.length > 0;

  return (
    <div className="space-y-6" style={{ backgroundColor: '#f8fafc' }}>
      {/* 页面标题 */}
      <div>
        <h1 className="text-[20px] font-semibold leading-none" style={{ color: '#101828' }}>
          AI 文章
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          基于关键词和品牌知识库，AI 自动生成高质量原创文章
        </p>
      </div>

      {/* 顶层 Tabs */}
      <Tabs value={activeTopTab} onValueChange={setActiveTopTab}>
        <TabsList className="mb-2">
          <TabsTrigger value="create">创作</TabsTrigger>
          <TabsTrigger value="history">历史文章</TabsTrigger>
        </TabsList>

        {/* ==================== 创作 tab ==================== */}
        <TabsContent value="create" className="mt-0 space-y-6">
          {/* 主内容区：左表单 + 右预览 */}
          <div className="flex flex-col gap-6 md:flex-row">
            {/* 左侧表单 */}
            <div className="w-full md:w-[420px] md:shrink-0 space-y-4">
              <Card className="shadow-sm">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Wand2 size={18} style={{ color: PRIMARY }} />
                    生成参数
                  </CardTitle>
                  <CardDescription>配置文章生成的各项参数</CardDescription>
                </CardHeader>
                <CardContent className="space-y-5">
                  {/* 品牌 */}
                  <div className="space-y-2">
                    <Label>品牌</Label>
                    {isClient ? (
                      <div
                        className="flex h-9 items-center rounded-md border px-3 text-sm bg-muted/30"
                        style={{ color: '#64748b' }}
                      >
                        {user?.displayName || '我的品牌'}
                      </div>
                    ) : (
                      <Select value={brandId} onValueChange={setBrandId}>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="选择品牌" />
                        </SelectTrigger>
                        <SelectContent>
                          {brandList.map((b: { id: string; name: string }) => (
                            <SelectItem key={b.id} value={b.id}>
                              {b.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </div>

                  {/* 核心关键词 */}
                  <div className="space-y-2">
                    <Label className="flex items-center gap-1">
                      <Hash size={14} />
                      核心关键词
                    </Label>
                    <div className="flex gap-2">
                      <Input
                        placeholder="输入关键词，回车添加"
                        value={coreInput}
                        onChange={(e) => setCoreInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            addCoreKeyword();
                          }
                        }}
                      />
                      <Button size="sm" onClick={addCoreKeyword} aria-label="添加核心关键词">
                        <Plus size={16} />
                      </Button>
                    </div>
                    {coreKeywords.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {coreKeywords.map((kw: string) => (
                          <Badge key={kw} variant="secondary" className="gap-1 px-2">
                            {kw}
                            <button
                              onClick={() => removeCoreKeyword(kw)}
                              className="ml-1 opacity-60 hover:opacity-100"
                              aria-label={`删除关键词 ${kw}`}
                            >
                              <X size={12} />
                            </button>
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* 长尾关键词 */}
                  <div className="space-y-2">
                    <Label className="flex items-center gap-1">
                      <Lightbulb size={14} />
                      长尾关键词
                      <span className="text-xs text-muted-foreground ml-1">
                        支持批量粘贴，一行一个
                      </span>
                    </Label>
                    <Textarea
                      placeholder="输入长尾关键词，回车或逗号分隔；也可批量粘贴多行"
                      value={longtailInput}
                      onChange={(e) => setLongtailInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          addLongtailKeywords();
                        }
                      }}
                      className="min-h-[72px]"
                    />
                    <div className="flex justify-end">
                      <Button size="sm" variant="outline" onClick={addLongtailKeywords}>
                        添加
                      </Button>
                    </div>
                    {longtailKeywords.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {longtailKeywords.map((kw: string) => (
                          <Badge key={kw} variant="outline" className="gap-1 px-2">
                            {kw}
                            <button
                              onClick={() => removeLongtailKeyword(kw)}
                              className="ml-1 opacity-60 hover:opacity-100"
                              aria-label={`删除长尾词 ${kw}`}
                            >
                              <X size={12} />
                            </button>
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* 文章类型 */}
                  <div className="space-y-2">
                    <Label>文章类型</Label>
                    <RadioGroup
                      value={articleType}
                      onValueChange={(v) => setArticleType(v as ArticleType)}
                      className="grid grid-cols-2 gap-2"
                    >
                      {ARTICLE_TYPES.map((type: ArticleType) => (
                        <div
                          key={type}
                          className={`flex items-center gap-2 rounded-md border px-3 py-2 text-sm cursor-pointer transition-colors ${
                            articleType === type
                              ? 'border-primary bg-primary/5'
                              : 'hover:bg-muted/30'
                          }`}
                        >
                          <RadioGroupItem value={type} id={`type-${type}`} />
                          <label htmlFor={`type-${type}`} className="cursor-pointer flex-1">
                            {ARTICLE_TYPE_LABELS[type]}
                          </label>
                        </div>
                      ))}
                    </RadioGroup>
                  </div>

                  {/* 目标字数 */}
                  <div className="space-y-2">
                    <Label className="flex items-center gap-1">
                      <Type size={14} />
                      目标字数
                    </Label>
                    <div className="flex flex-wrap gap-2">
                      {WORD_COUNT_PRESETS.map((n: number) => (
                        <button
                          key={n}
                          type="button"
                          onClick={() => {
                            setWordCountPreset(n);
                            setUseCustomWordCount(false);
                          }}
                          className={`h-8 rounded-md border px-3 text-sm transition-colors ${
                            !useCustomWordCount && wordCountPreset === n
                              ? 'border-primary bg-primary text-white'
                              : 'hover:bg-muted/30'
                          }`}
                        >
                          {n}字
                        </button>
                      ))}
                      <button
                        type="button"
                        onClick={() => setUseCustomWordCount(true)}
                        className={`h-8 rounded-md border px-3 text-sm transition-colors ${
                          useCustomWordCount
                            ? 'border-primary bg-primary text-white'
                            : 'hover:bg-muted/30'
                        }`}
                      >
                        自定义
                      </button>
                    </div>
                    {useCustomWordCount && (
                      <Input
                        type="number"
                        min={200}
                        max={5000}
                        value={customWordCount}
                        onChange={(e) => setCustomWordCount(e.target.value)}
                        placeholder="输入目标字数"
                        className="mt-2"
                      />
                    )}
                  </div>

                  {/* 生成篇数 */}
                  <div className="space-y-2">
                    <Label>生成篇数（1-10）</Label>
                    <Input
                      type="number"
                      min={1}
                      max={10}
                      value={count}
                      onChange={(e) => setCount(Math.min(10, Math.max(1, Number(e.target.value) || 1)))}
                    />
                  </div>

                  {/* 参考知识库 */}
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label className="text-sm">参考品牌知识库</Label>
                      <p className="text-xs text-muted-foreground">
                        接入后将基于品牌知识库生成（暂未开放）
                      </p>
                    </div>
                    <Checkbox
                      checked={useKnowledgeBase}
                      onCheckedChange={(v) => setUseKnowledgeBase(Boolean(v))}
                      disabled
                    />
                  </div>

                  {/* 自动配图 */}
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label className="text-sm">自动配图</Label>
                      <p className="text-xs text-muted-foreground">
                        为每篇文章生成一张封面图（额外消耗算力）
                      </p>
                    </div>
                    <Switch checked={autoCover} onCheckedChange={setAutoCover} />
                  </div>
                </CardContent>
              </Card>

              {/* 算力信息 + 生成按钮 */}
              <Card className="shadow-sm">
                <CardContent className="pt-5 space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">预计消耗</span>
                    <span className="font-semibold" style={{ color: ACCENT }}>
                      {estimatedCost} 算力点
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">当前余额</span>
                    <span className="font-semibold" style={{ color: PRIMARY }}>
                      {creditAccount !== undefined ? `${creditAccount.balance} 点` : '加载中...'}
                    </span>
                  </div>
                  <Button
                    size="lg"
                    className="w-full"
                    style={{ backgroundColor: PRIMARY }}
                    disabled={
                      generateMutation.isPending || isGenerating || !brandId
                    }
                    onClick={() => generateMutation.mutate()}
                  >
                    {generateMutation.isPending || isGenerating ? (
                      <>
                        <Sparkles className="animate-pulse" size={18} />
                        {isGenerating
                          ? `生成中（${generatingIds.length - generatingCount}/${generatingIds.length}）`
                          : '提交中...'}
                      </>
                    ) : (
                      <>
                        <Wand2 size={18} />
                        开始生成
                      </>
                    )}
                  </Button>
                  <p className="text-[11px] text-center text-muted-foreground">
                    内容由 AI 生成，发布前请人工核对事实
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* 右侧预览区 */}
            <div className="flex-1 min-w-0">
              <Card className="h-full shadow-sm">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <FileText size={18} style={{ color: PRIMARY }} />
                    文章预览
                  </CardTitle>
                  <CardDescription>
                    {hasResults
                      ? `已生成 ${generatedArticles.length} 篇文章`
                      : '生成结果将显示在这里'}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {/* 生成中进度 */}
                  {isGenerating && (
                    <div className="mb-4 space-y-2 rounded-lg border p-4">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium" style={{ color: PRIMARY }}>
                          正在生成...
                        </span>
                        <span className="text-muted-foreground">
                          已完成 {generatingIds.length - generatingCount} / {generatingIds.length}
                        </span>
                      </div>
                      <Progress value={progress} />
                      <p className="text-xs text-muted-foreground">
                        正在生成第 {generatingIds.length - generatingCount + 1} 篇 / 共 {generatingIds.length} 篇
                      </p>
                    </div>
                  )}

                  {/* 空状态 */}
                  {!hasResults && !isGenerating && (
                    <div className="flex flex-col items-center justify-center py-16 text-center">
                      <div
                        className="mb-4 flex h-16 w-16 items-center justify-center rounded-full"
                        style={{ backgroundColor: '#eff6ff' }}
                      >
                        <Sparkles size={32} style={{ color: PRIMARY }} />
                      </div>
                      <h3 className="text-base font-medium" style={{ color: '#0f172a' }}>
                        还没有生成的文章
                      </h3>
                      <p className="mt-2 max-w-xs text-sm text-muted-foreground">
                        填写左侧参数后点击「开始生成」，AI 将为你创作高质量文章
                      </p>
                    </div>
                  )}

                  {/* 生成结果 */}
                  {hasResults && (
                    <div className="space-y-4">
                      {/* Tabs 切换（多篇时） */}
                      {generatedArticles.length > 1 && (
                        <Tabs value={activeTab} onValueChange={setActiveTab}>
                          <TabsList className="w-full flex-wrap h-auto gap-1 p-1 bg-slate-100">
                            {generatedArticles.map((_: Article, i: number) => (
                              <TabsTrigger
                                key={i}
                                value={String(i)}
                                className="h-8 rounded-md px-3 text-xs"
                              >
                                第 {i + 1} 篇
                                {generatedArticles[i]?.status === 'failed' && (
                                  <span className="ml-1" style={{ color: '#ef4444' }}>
                                    (失败)
                                  </span>
                                )}
                              </TabsTrigger>
                            ))}
                          </TabsList>
                        </Tabs>
                      )}

                      {currentArticle && (
                        <div className="space-y-4">
                          {/* 状态 Badge */}
                          <div className="flex items-center gap-2">
                            <Badge
                              variant={
                                currentArticle.status === 'failed'
                                  ? 'destructive'
                                  : currentArticle.status === 'published'
                                  ? 'default'
                                  : 'secondary'
                              }
                            >
                              {ARTICLE_STATUS_LABELS[currentArticle.status]}
                            </Badge>
                            <Badge variant="outline">
                              {ARTICLE_TYPE_LABELS[currentArticle.articleType]}
                            </Badge>
                          </div>

                          {/* 标题（可编辑） */}
                          {editingId === currentArticle.id ? (
                            <Input
                              value={editTitle}
                              onChange={(e) => setEditTitle(e.target.value)}
                              className="text-lg font-semibold"
                            />
                          ) : (
                            <h2 className="text-xl font-semibold leading-snug" style={{ color: '#0f172a' }}>
                              {currentArticle.title}
                            </h2>
                          )}

                          {/* 正文 */}
                          <div className="rounded-md border bg-slate-50/50 p-4 max-h-[480px] overflow-y-auto">
                            {currentArticle.status === 'failed' ? (
                              <p className="text-sm" style={{ color: '#ef4444' }}>
                                生成失败：{currentArticle.error || '未知错误'}
                              </p>
                            ) : editingId === currentArticle.id ? (
                              <Textarea
                                value={editContent}
                                onChange={(e) => setEditContent(e.target.value)}
                                className="min-h-[320px] resize-none bg-white"
                              />
                            ) : (
                              <div className="text-sm leading-relaxed whitespace-pre-wrap text-slate-700">
                                {currentArticle.content || '内容生成中...'}
                              </div>
                            )}
                          </div>

                          {/* 底部信息 */}
                          <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground border-t pt-3">
                            <span className="flex items-center gap-1">
                              <Type size={12} />
                              {currentArticle.wordCount} 字
                            </span>
                            <span className="flex items-center gap-1">
                              <Sparkles size={12} />
                              消耗 {currentArticle.costCredits} 算力
                            </span>
                            <span className="flex items-center gap-1">
                              <Clock size={12} />
                              {new Date(currentArticle.createdAt).toLocaleString('zh-CN')}
                            </span>
                          </div>

                          {/* 操作按钮 */}
                          <div className="flex flex-wrap gap-2">
                            {editingId === currentArticle.id ? (
                              <>
                                <Button
                                  size="sm"
                                  onClick={() => saveEditMutation.mutate()}
                                  disabled={saveEditMutation.isPending}
                                >
                                  <Save size={14} />
                                  保存
                                </Button>
                                <Button size="sm" variant="outline" onClick={cancelEdit}>
                                  取消
                                </Button>
                              </>
                            ) : (
                              <>
                                <Button size="sm" variant="outline" onClick={() => startEdit(currentArticle)}>
                                  编辑
                                </Button>
                                <Button size="sm" variant="outline" onClick={() => handleCopy(currentArticle)}>
                                  <Copy size={14} />
                                  复制全文
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => publishMutation.mutate(currentArticle.id)}
                                  disabled={currentArticle.status === 'published' || publishMutation.isPending}
                                >
                                  {currentArticle.status === 'published' ? '已发布' : '标记已发布'}
                                </Button>
                                <Button
                                  size="sm"
                                  style={{ backgroundColor: PRIMARY }}
                                  onClick={() => {
                                    const brand = brandList.find(
                                      (b: { id: string; industry: string | null }) =>
                                        b.id === currentArticle.brandId,
                                    );
                                    setPublishArticleIds([currentArticle.id]);
                                    setPublishIndustry(brand?.industry || undefined);
                                    setPublishDialogOpen(true);
                                  }}
                                  disabled={currentArticle.status === 'generating' || currentArticle.status === 'failed'}
                                >
                                  <Megaphone size={14} />
                                  发到媒体商城
                                </Button>
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  onClick={() => deleteMutation.mutate(currentArticle.id)}
                                  disabled={deleteMutation.isPending}
                                >
                                  <Trash2 size={14} />
                                  删除
                                </Button>
                              </>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>

          {/* 底部最近生成 */}
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <History size={18} style={{ color: PRIMARY }} />
                最近生成
              </CardTitle>
              <CardDescription>最近 10 条生成记录</CardDescription>
            </CardHeader>
            <CardContent>
              {!recentArticles ? (
                <div className="space-y-2">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : recentArticles.items.length === 0 ? (
                <div className="py-8 text-center text-sm text-muted-foreground">
                  暂无生成记录
                </div>
              ) : (
                <div className="divide-y">
                  {recentArticles.items.map((article: Article) => (
                    <div
                      key={article.id}
                      className="flex flex-wrap items-center gap-3 py-3 first:pt-0 last:pb-0"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="truncate font-medium text-sm">{article.title}</p>
                        <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                          <span>{article.brandName}</span>
                          <span>{ARTICLE_TYPE_LABELS[article.articleType]}</span>
                          <span>{article.wordCount} 字</span>
                          <span>{new Date(article.createdAt).toLocaleString('zh-CN')}</span>
                        </div>
                      </div>
                      <Badge
                        variant={
                          article.status === 'failed'
                            ? 'destructive'
                            : article.status === 'published'
                            ? 'default'
                            : 'secondary'
                        }
                      >
                        {ARTICLE_STATUS_LABELS[article.status]}
                      </Badge>
                      <div className="flex gap-1">
                        <Button size="sm" variant="ghost" onClick={() => handleCopy(article)} aria-label="复制">
                          <Copy size={14} />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => deleteMutation.mutate(article.id)}
                          aria-label="删除"
                        >
                          <Trash2 size={14} />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ==================== 历史文章 tab ==================== */}
        <TabsContent value="history" className="mt-0">
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <FileText size={18} style={{ color: PRIMARY }} />
                文章列表
              </CardTitle>
              <CardDescription>共 {historyTotal} 篇文章</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* 筛选栏 */}
              <div className="flex flex-wrap gap-3 items-end">
                {!isClient && (
                  <div className="space-y-1.5 w-[180px]">
                    <Label className="text-xs">品牌</Label>
                    <Select value={historyBrandId} onValueChange={handleHistoryBrandChange}>
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
                  <Select value={historyType} onValueChange={handleHistoryTypeChange}>
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
                  <Select value={historyStatus} onValueChange={handleHistoryStatusChange}>
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
                        value={historyKeyword}
                        onChange={(e) => setHistoryKeyword(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleHistorySearch();
                        }}
                        className="pl-9"
                      />
                    </div>
                    <Button size="sm" onClick={handleHistorySearch}>
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
                    {historyLoading ? (
                      Array.from({ length: 5 }).map((_, i) => (
                        <TableRow key={i}>
                          <TableCell colSpan={!isClient ? 7 : 6}>
                            <Skeleton className="h-10 w-full" />
                          </TableCell>
                        </TableRow>
                      ))
                    ) : historyArticles.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={!isClient ? 7 : 6}
                          className="text-center py-12 text-muted-foreground"
                        >
                          暂无文章数据
                        </TableCell>
                      </TableRow>
                    ) : (
                      historyArticles.map((article: Article) => (
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
                                onClick={() => openViewArticle(article)}
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
                                  onClick={() => historyPublishMutation.mutate(article.id)}
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
              {historyTotalPages > 1 && (
                <Pagination>
                  <PaginationContent>
                    <PaginationItem>
                      <PaginationPrevious
                        onClick={() => setHistoryPage(Math.max(1, historyPage - 1))}
                        className={historyPage === 1 ? 'pointer-events-none opacity-50 cursor-pointer' : 'cursor-pointer'}
                        aria-disabled={historyPage === 1}
                      />
                    </PaginationItem>
                    {historyPageNumbers.map((p: number) => (
                      <PaginationItem key={p}>
                        <PaginationLink
                          isActive={p === historyPage}
                          onClick={() => setHistoryPage(p)}
                          className="cursor-pointer"
                        >
                          {p}
                        </PaginationLink>
                      </PaginationItem>
                    ))}
                    <PaginationItem>
                      <PaginationNext
                        onClick={() => setHistoryPage(Math.min(historyTotalPages, historyPage + 1))}
                        className={historyPage === historyTotalPages ? 'pointer-events-none opacity-50 cursor-pointer' : 'cursor-pointer'}
                        aria-disabled={historyPage === historyTotalPages}
                      />
                    </PaginationItem>
                  </PaginationContent>
                </Pagination>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <p className="text-center text-xs text-muted-foreground">
        内容由 AI 生成，发布前请人工核对事实，避免错误信息
      </p>

      {/* 查看/编辑弹窗（历史 tab 用） */}
      <Dialog open={!!viewArticle} onOpenChange={(open) => !open && closeViewDialog()}>
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
                  value={viewEditTitle}
                  onChange={(e) => setViewEditTitle(e.target.value)}
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
                  value={viewEditContent}
                  onChange={(e) => setViewEditContent(e.target.value)}
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
                  onClick={() => saveViewEditMutation.mutate()}
                  disabled={saveViewEditMutation.isPending}
                >
                  <Edit size={14} />
                  保存修改
                </Button>
              </>
            ) : (
              <>
                <Button variant="outline" onClick={closeViewDialog}>
                  关闭
                </Button>
                <Button variant="outline" onClick={() => viewArticle && handleCopy(viewArticle)}>
                  <Copy size={14} />
                  复制全文
                </Button>
                <Button
                  style={{ backgroundColor: PRIMARY }}
                  onClick={() => {
                    if (!viewArticle) return;
                    const brand = brandList.find(
                      (b: { id: string; industry: string | null }) =>
                        b.id === viewArticle.brandId,
                    );
                    setPublishArticleIds([viewArticle.id]);
                    setPublishIndustry(brand?.industry || undefined);
                    setPublishDialogOpen(true);
                    closeViewDialog();
                  }}
                  disabled={viewArticle?.status === 'generating' || viewArticle?.status === 'failed'}
                >
                  <Megaphone size={14} />
                  发到媒体商城
                </Button>
                <Button onClick={startViewEdit}>
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

      {/* 发布到媒体商城弹窗 */}
      <PublishToMarketDialog
        open={publishDialogOpen}
        onOpenChange={setPublishDialogOpen}
        articleIds={publishArticleIds}
        industry={publishIndustry}
      />
    </div>
  );
};

export default ArticlePage;
