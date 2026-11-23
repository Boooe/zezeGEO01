import React, { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Plus,
  Shuffle,
  Download,
  Search,
  RefreshCw,
  AlertCircle,
  Check,
  X,
  FileText,
} from 'lucide-react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@client/src/components/ui/card';
import { SectionCard } from '@client/src/components/layout/SectionCard';
import { DataTable } from '@client/src/components/layout/DataTable';
import { Pill } from '@client/src/components/layout/Pill';
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@client/src/components/ui/dialog';
import { Badge } from '@client/src/components/ui/badge';
import { Skeleton } from '@client/src/components/ui/skeleton';
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@client/src/components/ui/empty';
import { Checkbox } from '@client/src/components/ui/checkbox';
import { PageHeader } from '@client/src/components/layout/PageHeader';
import { useAuth } from '@client/src/hooks/useAuth';
import { toast } from 'sonner';
import {
  getBrandList,
  getKeywordGroups,
  getKeywordPool,
  getLongtailConfig,
  saveLongtailConfig,
  previewLongtailCombine,
  combineLongtail,
  batchAddKeywords,
  getKeywords,
} from '@client/src/api/keywords';
import type {
  LongtailCombineResult,
  KeywordGroup,
  KeywordPoolItemWithOpportunity,
  Keyword,
} from '@shared/api.interface';

const RESULT_PAGE_SIZE = 20;

const LongtailComboPage: React.FC = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const [brandId, setBrandId] = useState<string>('');
  const [groupId, setGroupId] = useState<string>('');
  const [prefixWords, setPrefixWords] = useState<string[]>([]);
  const [suffixWords, setSuffixWords] = useState<string[]>([]);
  const [prefixInput, setPrefixInput] = useState('');
  const [suffixInput, setSuffixInput] = useState('');
  const [prefixExpanded, setPrefixExpanded] = useState(true);
  const [suffixExpanded, setSuffixExpanded] = useState(true);
  const [prefixDupTip, setPrefixDupTip] = useState('');
  const [suffixDupTip, setSuffixDupTip] = useState('');
  const [resultPage, setResultPage] = useState(1);
  const [hasGenerated, setHasGenerated] = useState(false);
  const [selectedCoreKeywordId, setSelectedCoreKeywordId] = useState<string>('');

  // 当前品牌的核心词列表（用于归入核心词）
  const { data: coreKeywordOptions = [] } = useQuery<Keyword[]>({
    queryKey: ['keywords', 'core-list', brandId],
    queryFn: async (): Promise<Keyword[]> => {
      const res = await getKeywords({
        page: 1,
        pageSize: 500,
        brandId: brandId || undefined,
        keywordType: 'core',
      });
      return res.items;
    },
    enabled: !!brandId,
  });

  // 从词库导入弹窗
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [importTarget, setImportTarget] = useState<'prefix' | 'suffix'>('prefix');
  const [importSearch, setImportSearch] = useState('');
  const [importPage, setImportPage] = useState(1);
  const [importSelected, setImportSelected] = useState<Set<string>>(new Set());

  // 品牌列表
  const { data: brandOptions = [], isLoading: brandsLoading } = useQuery({
    queryKey: ['brands', 'options'],
    queryFn: getBrandList,
  });

  // 品牌列表加载完成后，自动选中第一个品牌
  React.useEffect(() => {
    if (!brandId && brandOptions.length > 0) {
      setBrandId(brandOptions[0].id);
    }
  }, [brandOptions, brandId]);

  // 分组列表
  const { data: groupOptions = [] } = useQuery<KeywordGroup[]>({
    queryKey: ['keywordGroups', brandId],
    queryFn: () => getKeywordGroups(brandId),
    enabled: !!brandId,
  });

  // 前缀配置
  const { data: prefixConfig, isLoading: prefixLoading } = useQuery({
    queryKey: ['longtailConfig', brandId, groupId, 'prefix'],
    queryFn: () =>
      getLongtailConfig({
        brandId,
        groupId: groupId || undefined,
        type: 'prefix',
      }),
    enabled: !!brandId,
  });

  // 后缀配置
  const { data: suffixConfig, isLoading: suffixLoading } = useQuery({
    queryKey: ['longtailConfig', brandId, groupId, 'suffix'],
    queryFn: () =>
      getLongtailConfig({
        brandId,
        groupId: groupId || undefined,
        type: 'suffix',
      }),
    enabled: !!brandId,
  });

  // 当品牌或分组变化时，用配置回填词列表
  React.useEffect(() => {
    if (prefixConfig) {
      setPrefixWords(prefixConfig.words);
    } else if (brandId && !prefixLoading) {
      setPrefixWords([]);
    }
  }, [prefixConfig, brandId, prefixLoading]);

  React.useEffect(() => {
    if (suffixConfig) {
      setSuffixWords(suffixConfig.words);
    } else if (brandId && !suffixLoading) {
      setSuffixWords([]);
    }
  }, [suffixConfig, brandId, suffixLoading]);

  const estimatedCount = useMemo(
    () => prefixWords.length * suffixWords.length,
    [prefixWords, suffixWords],
  );

  // 保存配置 mutation
  const savePrefixMutation = useMutation({
    mutationFn: saveLongtailConfig,
    retry: false,
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['longtailConfig', brandId, groupId, 'prefix'],
      });
      toast.success('前缀配置已保存');
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.error?.message || '保存失败');
    },
  });

  const saveSuffixMutation = useMutation({
    mutationFn: saveLongtailConfig,
    retry: false,
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['longtailConfig', brandId, groupId, 'suffix'],
      });
      toast.success('后缀配置已保存');
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.error?.message || '保存失败');
    },
  });

  // 组合结果
  const [combineResult, setCombineResult] = useState<LongtailCombineResult[]>(
    [],
  );
  const [combineError, setCombineError] = useState<string | null>(null);
  const [isCombining, setIsCombining] = useState(false);

  const handleGenerate = async () => {
    if (!brandId) {
      toast.error('请先选择品牌');
      return;
    }
    if (prefixWords.length === 0 || suffixWords.length === 0) {
      toast.error('请输入至少一个前缀词和一个后缀词');
      return;
    }
    setIsCombining(true);
    setCombineError(null);
    setResultPage(1);
    try {
      await previewLongtailCombine({
        brandId,
        groupId: groupId || null,
        prefixWords,
        suffixWords,
      });
      const result = await combineLongtail({
        brandId,
        groupId: groupId || null,
        prefixWords,
        suffixWords,
      });
      setCombineResult(result.items);
      setHasGenerated(true);
    } catch (err: any) {
      setCombineError(
        err?.response?.data?.error?.message || '生成组合失败，请重试',
      );
    } finally {
      setIsCombining(false);
    }
  };

  // 统计
  const resultStats = useMemo(() => {
    const total = combineResult.length;
    const inPool = combineResult.filter((r) => r.inPool).length;
    const newCount = total - inPool;
    return { total, inPool, newCount };
  }, [combineResult]);

  const totalResultPages = useMemo(() => {
    if (!combineResult.length) return 1;
    return Math.max(1, Math.ceil(combineResult.length / RESULT_PAGE_SIZE));
  }, [combineResult]);

  const pagedResults = useMemo(() => {
    const start = (resultPage - 1) * RESULT_PAGE_SIZE;
    return combineResult.slice(start, start + RESULT_PAGE_SIZE);
  }, [combineResult, resultPage]);

  // 单个加入词池
  const addSingleMutation = useMutation({
    mutationFn: async (keyword: string) => {
      const res = await batchAddKeywords({
        brandId,
        groupId: groupId || null,
        keywords: [keyword],
        parentKeywordId: selectedCoreKeywordId || undefined,
      });
      return res;
    },
    retry: false,
    onSuccess: (_data, keyword) => {
      setCombineResult((prev) =>
        prev.map((r) => (r.word === keyword ? { ...r, inPool: true } : r)),
      );
      toast.success('已加入词池');
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.error?.message || '加入失败');
    },
  });

  // 批量加入词池（只加新增的）
  const batchAddMutation = useMutation({
    mutationFn: batchAddKeywords,
    retry: false,
    onSuccess: (data) => {
      toast.success(`成功加入 ${data.added} 个，跳过 ${data.skipped} 个重复`);
      // 重新调 combine 接口刷新状态
      handleGenerate();
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.error?.message || '批量加入失败');
    },
  });

  const handleBatchAdd = () => {
    const newKeywords = combineResult
      .filter((r) => !r.inPool)
      .map((r) => r.word);
    if (newKeywords.length === 0) {
      toast.info('没有可新增的关键词');
      return;
    }
    batchAddMutation.mutate({
      brandId,
      groupId: groupId || null,
      keywords: newKeywords,
      parentKeywordId: selectedCoreKeywordId || undefined,
    });
  };

  // ---------- 从词库导入弹窗 ----------
  const openImportDialog = (target: 'prefix' | 'suffix') => {
    if (!brandId) {
      toast.error('请先选择品牌');
      return;
    }
    setImportTarget(target);
    setImportSearch('');
    setImportPage(1);
    setImportSelected(new Set());
    setImportDialogOpen(true);
  };

  const {
    data: importPoolData,
    isLoading: importLoading,
  } = useQuery({
    queryKey: [
      'keywordPool',
      'import',
      importPage,
      brandId,
      importSearch,
    ],
    queryFn: () =>
      getKeywordPool({
        page: importPage,
        pageSize: 20,
        brandId: brandId || undefined,
        keyword: importSearch || undefined,
      }),
    enabled: importDialogOpen && !!brandId,
  });

  const toggleImportSelect = (keyword: string) => {
    const next = new Set(importSelected);
    if (next.has(keyword)) {
      next.delete(keyword);
    } else {
      next.add(keyword);
    }
    setImportSelected(next);
  };

  const handleImportConfirm = () => {
    if (importSelected.size === 0) return;
    const wordsToAdd = Array.from(importSelected);
    if (importTarget === 'prefix') {
      const existing = new Set(prefixWords);
      const deduped = wordsToAdd.filter((w) => !existing.has(w));
      setPrefixWords([...prefixWords, ...deduped]);
      const skipped = wordsToAdd.length - deduped.length;
      if (skipped > 0) {
        toast.success(`已导入 ${deduped.length} 个词，跳过 ${skipped} 个重复词`);
      } else {
        toast.success(`已导入 ${wordsToAdd.length} 个词`);
      }
    } else {
      const existing = new Set(suffixWords);
      const deduped = wordsToAdd.filter((w) => !existing.has(w));
      setSuffixWords([...suffixWords, ...deduped]);
      const skipped = wordsToAdd.length - deduped.length;
      if (skipped > 0) {
        toast.success(`已导入 ${deduped.length} 个词，跳过 ${skipped} 个重复词`);
      } else {
        toast.success(`已导入 ${wordsToAdd.length} 个词`);
      }
    }
    setImportDialogOpen(false);
  };

  const handleSavePrefix = () => {
    if (!brandId) {
      toast.error('请先选择品牌');
      return;
    }
    savePrefixMutation.mutate({
      brandId,
      groupId: groupId || null,
      configType: 'prefix',
      words: prefixWords,
    });
  };

  const handleSaveSuffix = () => {
    if (!brandId) {
      toast.error('请先选择品牌');
      return;
    }
    saveSuffixMutation.mutate({
      brandId,
      groupId: groupId || null,
      configType: 'suffix',
      words: suffixWords,
    });
  };

  return (
    <div className="space-y-5 bg-[#F7F9FC]">
      {/* 页面标题区 */}
      {/* 品牌为空提示 */}
      {!brandsLoading && brandOptions.length === 0 && (
        <div className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
          <AlertCircle className="h-5 w-5 text-amber-500 flex-shrink-0" />
          <div className="text-sm text-amber-800">
            暂无品牌数据，请先在客户管理中创建品牌
          </div>
        </div>
      )}

      <PageHeader
        title="长尾词组合"
        subtitle="通过前缀词与后缀词的笛卡尔积组合，批量生成高质量长尾关键词"
        actions={
          <div className="flex items-center gap-2">
            <div className="w-40">
              <Select value={brandId} onValueChange={setBrandId}>
                <SelectTrigger className="h-9 w-full">
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
            <div className="w-40">
              <Select
                value={groupId}
                onValueChange={setGroupId}
                disabled={!brandId}
              >
                <SelectTrigger className="h-9 w-full">
                  <SelectValue placeholder="全部分组" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">全部分组</SelectItem>
                  {groupOptions.map((g) => (
                    <SelectItem key={g.id} value={g.id}>
                      {g.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        }
      />

      {/* 主体布局 */}
      <div className="flex flex-col gap-4 md:flex-row">
        {/* 左栏：配置区 */}
        <div className="flex flex-col gap-4 md:w-[45%]">
          {/* 前缀词卡片 */}
          <SectionCard
            title="前缀词"
            count={prefixWords.length}
            className="rounded-xl"
          >
              {/* 输入框 */}
              <div className="flex gap-2">
                <Input
                  placeholder="输入前缀词，回车添加"
                  value={prefixInput}
                  onChange={(e) => {
                    setPrefixInput(e.target.value);
                    setPrefixDupTip('');
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      const val = prefixInput.trim();
                      if (!val) return;
                      if (prefixWords.includes(val)) {
                        setPrefixDupTip('该词已存在');
                        return;
                      }
                      setPrefixWords([...prefixWords, val]);
                      setPrefixInput('');
                      setPrefixDupTip('');
                    }
                  }}
                  className="h-9"
                />
                <Button
                  size="sm"
                  className="h-9 rounded-lg bg-[#2E7DFF] text-white hover:bg-[#2E7DFF]/90"
                  onClick={() => {
                    const val = prefixInput.trim();
                    if (!val) return;
                    if (prefixWords.includes(val)) {
                      setPrefixDupTip('该词已存在');
                      return;
                    }
                    setPrefixWords([...prefixWords, val]);
                    setPrefixInput('');
                    setPrefixDupTip('');
                  }}
                >
                  添加
                </Button>
              </div>
              {prefixDupTip && (
                <p className="text-xs" style={{ color: '#FF5C5C' }}>
                  {prefixDupTip}
                </p>
              )}

              {/* 标签云 */}
              {prefixLoading ? (
                <Skeleton className="h-40 w-full rounded-md" />
              ) : prefixWords.length === 0 ? (
                <div className="rounded-lg border border-dashed py-8 text-center text-sm text-slate-400" style={{ borderColor: '#E5E9F2' }}>
                  暂无前缀词，输入或从词库导入
                </div>
              ) : (
                <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto">
                  {(prefixExpanded ? prefixWords : prefixWords.slice(0, 20)).map((word: string, idx: number) => (
                    <span
                      key={`${word}-${idx}`}
                      className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium"
                      style={{ backgroundColor: '#EEF4FF', color: '#2E7DFF' }}
                    >
                      {word}
                      <button
                        type="button"
                        onClick={() =>
                          setPrefixWords(prefixWords.filter((_, i) => i !== idx))
                        }
                        className="ml-0.5 rounded-full hover:bg-[#2E7DFF]/20 transition-colors"
                        aria-label={`删除前缀词 ${word}`}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
              {prefixWords.length > 20 && (
                <button
                  type="button"
                  className="text-xs transition-colors hover:underline"
                  style={{ color: '#2E7DFF' }}
                  onClick={() => setPrefixExpanded(!prefixExpanded)}
                >
                  {prefixExpanded
                    ? '收起'
                    : `展开全部（${prefixWords.length}）`}
                </button>
              )}

              <div className="flex items-center justify-between">
                <span className="text-xs text-[#64748b] tabular-nums">
                  共 {prefixWords.length} 个前缀词
                </span>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 rounded-lg border-[#E5E9F2] bg-white hover:bg-slate-50"
                    onClick={() => openImportDialog('prefix')}
                  >
                    <Plus className="h-3.5 w-3.5" />
                    从词库导入
                  </Button>
                  <Button
                    size="sm"
                    className="h-8 rounded-lg bg-[#2E7DFF] text-white hover:bg-[#2E7DFF]/90"
                    onClick={handleSavePrefix}
                    disabled={
                      savePrefixMutation.isPending ||
                      prefixWords.length === 0
                    }
                  >
                    {savePrefixMutation.isPending ? '保存中...' : '保存配置'}
                  </Button>
                </div>
              </div>
          </SectionCard>

          {/* 后缀词卡片 */}
          <SectionCard
            title="后缀词"
            count={suffixWords.length}
            className="rounded-xl"
          >
              {/* 输入框 */}
              <div className="flex gap-2">
                <Input
                  placeholder="输入后缀词，回车添加"
                  value={suffixInput}
                  onChange={(e) => {
                    setSuffixInput(e.target.value);
                    setSuffixDupTip('');
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      const val = suffixInput.trim();
                      if (!val) return;
                      if (suffixWords.includes(val)) {
                        setSuffixDupTip('该词已存在');
                        return;
                      }
                      setSuffixWords([...suffixWords, val]);
                      setSuffixInput('');
                      setSuffixDupTip('');
                    }
                  }}
                  className="h-9"
                />
                <Button
                  size="sm"
                  className="h-9 rounded-lg bg-[#2E7DFF] text-white hover:bg-[#2E7DFF]/90"
                  onClick={() => {
                    const val = suffixInput.trim();
                    if (!val) return;
                    if (suffixWords.includes(val)) {
                      setSuffixDupTip('该词已存在');
                      return;
                    }
                    setSuffixWords([...suffixWords, val]);
                    setSuffixInput('');
                    setSuffixDupTip('');
                  }}
                >
                  添加
                </Button>
              </div>
              {suffixDupTip && (
                <p className="text-xs" style={{ color: '#FF5C5C' }}>
                  {suffixDupTip}
                </p>
              )}

              {/* 标签云 */}
              {suffixLoading ? (
                <Skeleton className="h-40 w-full rounded-md" />
              ) : suffixWords.length === 0 ? (
                <div className="rounded-lg border border-dashed py-8 text-center text-sm text-slate-400" style={{ borderColor: '#E5E9F2' }}>
                  暂无后缀词，输入或从词库导入
                </div>
              ) : (
                <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto">
                  {(suffixExpanded ? suffixWords : suffixWords.slice(0, 20)).map((word: string, idx: number) => (
                    <span
                      key={`${word}-${idx}`}
                      className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium"
                      style={{ backgroundColor: '#EEF4FF', color: '#2E7DFF' }}
                    >
                      {word}
                      <button
                        type="button"
                        onClick={() =>
                          setSuffixWords(suffixWords.filter((_, i) => i !== idx))
                        }
                        className="ml-0.5 rounded-full hover:bg-[#2E7DFF]/20 transition-colors"
                        aria-label={`删除后缀词 ${word}`}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
              {suffixWords.length > 20 && (
                <button
                  type="button"
                  className="text-xs transition-colors hover:underline"
                  style={{ color: '#2E7DFF' }}
                  onClick={() => setSuffixExpanded(!suffixExpanded)}
                >
                  {suffixExpanded
                    ? '收起'
                    : `展开全部（${suffixWords.length}）`}
                </button>
              )}

              <div className="flex items-center justify-between">
                <span className="text-xs text-[#64748b] tabular-nums">
                  共 {suffixWords.length} 个后缀词
                </span>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 rounded-lg border-[#E5E9F2] bg-white hover:bg-slate-50"
                    onClick={() => openImportDialog('suffix')}
                  >
                    <Plus className="h-3.5 w-3.5" />
                    从词库导入
                  </Button>
                  <Button
                    size="sm"
                    className="h-8 rounded-lg bg-[#2E7DFF] text-white hover:bg-[#2E7DFF]/90"
                    onClick={handleSaveSuffix}
                    disabled={
                      saveSuffixMutation.isPending ||
                      suffixWords.length === 0
                    }
                  >
                    {saveSuffixMutation.isPending ? '保存中...' : '保存配置'}
                  </Button>
                </div>
              </div>
          </SectionCard>

          {/* 底部固定操作条 */}
          <Card className="rounded-xl border-[#E5E9F2]">
            <CardContent className="flex items-center justify-between py-3">
              <div className="text-sm text-[#475467]">
                预计组合{' '}
                <span
                  className="font-semibold tabular-nums"
                  style={{ color: '#2E7DFF' }}
                >
                  {estimatedCount}
                </span>{' '}
                个词
              </div>
              <Button
                size="sm"
                className="h-9 rounded-lg bg-[#2E7DFF] text-white hover:bg-[#2E7DFF]/90"
                onClick={handleGenerate}
                disabled={
                  isCombining ||
                  prefixWords.length === 0 ||
                  suffixWords.length === 0
                }
              >
                <Shuffle className="h-3.5 w-3.5" />
                {isCombining ? '生成中...' : '生成组合'}
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* 右栏：结果区 */}
        <div className="md:w-[55%]">
          <SectionCard
            title="组合结果"
            count={hasGenerated && !isCombining && !combineError ? resultStats.total : undefined}
            className="h-full"
          >
            {hasGenerated && !isCombining && !combineError && (
              <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-[#5B6B85]">归入核心词</span>
                  <div className="w-48">
                    <Select
                      value={selectedCoreKeywordId}
                      onValueChange={setSelectedCoreKeywordId}
                    >
                      <SelectTrigger className="h-8 w-full">
                          <SelectValue placeholder="不归入（未归类）" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="">不归入（未归类）</SelectItem>
                          {coreKeywordOptions.map((kw) => (
                            <SelectItem key={kw.id} value={kw.id}>
                              {kw.keyword}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <p className="text-xs text-[#98A2B3] text-right">
                    选填，导入后该核心词下的所有长尾词
                  </p>
                  <Button
                    size="sm"
                    className="h-8 rounded-lg bg-[#2E7DFF] text-white hover:bg-[#2E7DFF]/90"
                    onClick={handleBatchAdd}
                    disabled={
                      batchAddMutation.isPending || resultStats.newCount === 0
                    }
                  >
                    <Download className="h-3.5 w-3.5" />
                    {batchAddMutation.isPending
                      ? '加入中...'
                      : `批量加入词池 (${resultStats.newCount})`}
                  </Button>
                </div>
              )}

              {/* 加载骨架 */}
              {isCombining && <ResultSkeleton />}

              {/* 错误态 */}
              {!isCombining && combineError && (
                <div className="flex items-center justify-between rounded-lg border border-red-200 bg-red-50 p-4">
                  <div className="flex items-center gap-2 text-sm text-[#FF5C5C]">
                    <AlertCircle className="h-4 w-4" />
                    <span>{combineError}</span>
                  </div>
                  <button
                    onClick={handleGenerate}
                    className="flex items-center gap-1 rounded-md px-3 py-1.5 text-sm font-medium text-[#FF5C5C] transition-colors hover:bg-red-100"
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                    重试
                  </button>
                </div>
              )}

              {/* 空态 */}
              {!isCombining && !combineError && !hasGenerated && (
                <Empty className="min-h-[300px]">
                  <EmptyHeader>
                    <EmptyMedia variant="icon">
                      <FileText />
                    </EmptyMedia>
                    <EmptyTitle>暂无结果</EmptyTitle>
                    <EmptyDescription>
                      配置前缀词和后缀词后，点击生成组合查看结果
                    </EmptyDescription>
                  </EmptyHeader>
                </Empty>
              )}

              {/* 结果表格 */}
              {!isCombining &&
                !combineError &&
                hasGenerated &&
                combineResult.length > 0 && (
                  <>
                    {/* 统计条 */}
                    <div className="mb-3 flex flex-wrap items-center gap-4 rounded-lg px-3 py-2" style={{ backgroundColor: '#F7F9FC' }}>
                      <div className="text-xs text-[#475467]">
                        总组合数：
                        <span className="font-semibold tabular-nums text-[#101828]">
                          {resultStats.total}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 text-xs">
                        <Badge
                          variant="secondary"
                          className="bg-slate-100 text-slate-500"
                        >
                          已在词池
                        </Badge>
                        <span className="font-medium tabular-nums text-[#64748b]">
                          {resultStats.inPool}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 text-xs">
                        <Badge
                          variant="secondary"
                          className="bg-emerald-50 text-emerald-600"
                        >
                          可新增
                        </Badge>
                        <span className="font-medium tabular-nums text-[#64748b]">
                          {resultStats.newCount}
                        </span>
                      </div>
                    </div>

                    {/* 表格 */}
                    <DataTable
                      columns={[
                        { key: 'index', title: '序号', width: '60px', render: (_item: any, idx: number) => (
                          <span className="text-[#98A2B8] tabular-nums">
                            {(resultPage - 1) * RESULT_PAGE_SIZE + idx + 1}
                          </span>
                        )},
                        { key: 'word', title: '关键词', render: (item: any) => (
                          <span className="font-medium text-[#101828]">{item.word}</span>
                        )},
                        { key: 'status', title: '状态', width: '100px', render: (item: any) => (
                          item.inPool ? (
                            <Pill variant="muted">已在词池</Pill>
                          ) : (
                            <Pill variant="success">可新增</Pill>
                          )
                        )},
                        { key: 'actions', title: '操作', width: '100px', align: 'right', render: (item: any) => (
                          item.inPool ? (
                            <span className="text-xs text-[#98A2B8]">—</span>
                          ) : (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 rounded-md border-[#E5E9F2] text-xs hover:bg-slate-50"
                              onClick={() =>
                                addSingleMutation.mutate(item.word)
                              }
                              disabled={addSingleMutation.isPending}
                            >
                              <Plus className="h-3 w-3 mr-1" />
                              加入
                            </Button>
                          )
                        )},
                      ]}
                      data={pagedResults}
                      rowKey="word"
                      emptyText="暂无结果"
                      pagination={{
                        total: resultStats.total,
                        page: resultPage,
                        pageSize: RESULT_PAGE_SIZE,
                        onPageChange: setResultPage,
                        onPageSizeChange: () => {},
                        pageSizeOptions: [RESULT_PAGE_SIZE],
                      }}
                    />
                  </>
                )}

              {/* 生成了但0结果 */}
              {!isCombining &&
                !combineError &&
                hasGenerated &&
                combineResult.length === 0 && (
                  <div className="empty-state-card rounded-xl border border-[#F0F4FA] bg-white">
                    <X className="empty-icon" />
                    <div className="empty-title">暂无组合结果</div>
                    <div className="empty-desc">
                      请确保前缀词和后缀词都有内容
                    </div>
                  </div>
                )}
          </SectionCard>
        </div>
      </div>

      {/* 从词库导入弹窗 */}
      <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>从词库选择</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#98A2B3]" />
              <Input
                placeholder="搜索关键词"
                value={importSearch}
                onChange={(e) => setImportSearch(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && setImportPage(1)}
                className="h-9 pl-9"
              />
            </div>
            <div className="max-h-[300px] overflow-y-auto rounded-md border border-[#F0F4FA]">
              {importLoading ? (
                <div className="space-y-2 p-3">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className="h-6 w-full" />
                  ))}
                </div>
              ) : importPoolData && importPoolData.items.length > 0 ? (
                <div>
                  {importPoolData.items.map(
                    (item: KeywordPoolItemWithOpportunity) => (
                      <label
                        key={item.id}
                        className="flex cursor-pointer items-center gap-3 px-3 py-2 hover:bg-slate-50"
                      >
                        <Checkbox
                          checked={importSelected.has(item.keyword)}
                          onCheckedChange={() =>
                            toggleImportSelect(item.keyword)
                          }
                        />
                        <span className="text-sm text-[#101828]">
                          {item.keyword}
                        </span>
                      </label>
                    ),
                  )}
                </div>
              ) : (
                <div className="py-8 text-center text-sm text-[#98A2B3]">
                  暂无词库数据
                </div>
              )}
            </div>
            {importPoolData && importPoolData.total > 20 && (
              <div className="flex items-center justify-end gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7"
                  onClick={() =>
                    setImportPage((p) => Math.max(1, p - 1))
                  }
                  disabled={importPage === 1}
                >
                  上一页
                </Button>
                <span className="text-xs text-muted-foreground tabular-nums">
                  {importPage} /{' '}
                  {Math.ceil(importPoolData.total / 20)}
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7"
                  onClick={() =>
                    setImportPage((p) => p + 1)
                  }
                  disabled={
                    importPage >= Math.ceil(importPoolData.total / 20)
                  }
                >
                  下一页
                </Button>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setImportDialogOpen(false)}
            >
              取消
            </Button>
            <Button
              className="bg-[#2E7DFF] text-white hover:bg-[#2E7DFF]/90"
              disabled={importSelected.size === 0}
              onClick={handleImportConfirm}
            >
              <Check className="h-3.5 w-3.5" />
              确认导入 ({importSelected.size})
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

const ResultSkeleton: React.FC = () => (
  <div className="space-y-3">
    <div className="flex gap-4">
      <Skeleton className="h-4 w-20" />
      <Skeleton className="h-4 w-24" />
      <Skeleton className="h-4 w-24" />
    </div>
    <div className="space-y-2">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="flex items-center gap-4">
          <Skeleton className="h-4 w-8" />
          <Skeleton className="h-4 flex-1" />
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-6 w-16" />
        </div>
      ))}
    </div>
  </div>
);

export default LongtailComboPage;
