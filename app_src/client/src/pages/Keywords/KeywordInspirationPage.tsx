import React, { useEffect, useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Sparkles,
  Plus,
  Trash2,
  Info,
  ChevronUp,
  ChevronDown,
  Loader2,
  CircleHelp,
} from 'lucide-react';
import {
  Card,
  CardContent,
} from '@client/src/components/ui/card';
import { SectionCard } from '@client/src/components/layout/SectionCard';
import { Button } from '@client/src/components/ui/button';
import { Input } from '@client/src/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@client/src/components/ui/select';
import { Checkbox } from '@client/src/components/ui/checkbox';
import { Switch } from '@client/src/components/ui/switch';
import { Label } from '@client/src/components/ui/label';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@client/src/components/ui/tooltip';
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
  TableCell,
} from '@client/src/components/ui/table';
import { Skeleton } from '@client/src/components/ui/skeleton';
import { ColumnResizeHandle } from '@client/src/components/ui/column-resize-handle';
import { useResizableColumns } from '@client/src/hooks/use-resizable-columns';
import { useAuth } from '@client/src/hooks/useAuth';
import { useBrandSelector } from '@client/src/hooks/useBrandSelector';
import {
  generateInspiration,
  addInspirationToPool,
  getKeywordVisibility,
  runSingleDetect,
  getKeywordPool,
} from '@client/src/api/keywords';
import {
  AI_DETECT_PLATFORMS,
  AI_DETECT_PLATFORM_LABELS,
} from '@shared/api.interface';
import {
  KEYWORD_TYPE_LABELS,
  KEYWORD_TYPES,
  INSPIRATION_INTENT_TYPES,
  INSPIRATION_INTENT_LABELS,
  INSPIRATION_INTENT_COLORS,
  INSPIRATION_INDUSTRIES,
  INSPIRATION_INDUSTRY_LABELS,
  INSPIRATION_INDUSTRY_SCENES,
  INSPIRATION_DISTRICTS_BY_CITY,
} from '@shared/api.interface';
import type {
  InspirationKeyword,
  InspirationIntentType,
  InspirationIndustry,
} from '@shared/api.interface';
import { toast } from 'sonner';
import { IndexRegisterDialog } from '@client/src/components/keywords/KeywordIndexDialogs';
import { PageHeader } from '@client/src/components/layout/PageHeader';

const COUNT_OPTIONS = [5, 10, 20, 50];

// 指数（人工采集）功能开关：与词池页保持一致，true=显示登记入口，false=隐藏
const INDEX_LOG_ENABLED = true;

const COL_DEFAULTS: Record<string, number> = {
  select: 40,
  keyword: 160,
  intent: 84,
  scene: 80,
  flags: 80,
  opportunity: 68,
  visibility: 92,
  reason: 100,
  actions: 82,
};

type IntentFilter = 'all' | InspirationIntentType;
type SortField = 'opportunity' | 'keyword';
type SortOrder = 'asc' | 'desc';

const INTENT_FILTERS: Array<{ value: IntentFilter; label: string }> = [
  { value: 'all', label: '全部' },
  ...INSPIRATION_INTENT_TYPES.map((t) => ({
    value: t,
    label: INSPIRATION_INTENT_LABELS[t],
  })),
];

function getOpportunityColor(score: number): string {
  if (score >= 80) return '#3B5BFF';
  if (score >= 60) return '#17C964';
  if (score >= 40) return '#FFA940';
  return '#FF5C5C';
}

function makeKey(item: InspirationKeyword): string {
  return `${item.keyword}:${item.keywordType}`;
}

const KeywordInspirationPage: React.FC = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { brands: brandOptions, selectedBrandId, setSelectedBrandId, selectedBrand } =
    useBrandSelector();

  // ---------- 表单状态 ----------
  const brandId = selectedBrandId;
  const brandName = selectedBrand?.name ?? '';
  const [seedKeyword, setSeedKeyword] = useState('');
  const [keywordType, setKeywordType] = useState<'core' | 'longtail'>('longtail');
  const [count, setCount] = useState(10);
  const [city, setCity] = useState('石家庄');
  const [districts, setDistricts] = useState<string[]>([]);
  const [industry, setIndustry] = useState<InspirationIndustry | ''>('');
  const [industryFromBrand, setIndustryFromBrand] = useState(false);
  const [includeBrand, setIncludeBrand] = useState(true);
  const [includeQuestion, setIncludeQuestion] = useState(false);
  const [includeLocal, setIncludeLocal] = useState(true);

  // ---------- 结果状态 ----------
  const [results, setResults] = useState<InspirationKeyword[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [addedKeys, setAddedKeys] = useState<Set<string>>(new Set());
  const [detectingKeyword, setDetectingKeyword] = useState<string | null>(null);

  // ---------- 筛选/排序状态 ----------
  const [intentFilter, setIntentFilter] = useState<IntentFilter>('all');
  const [minOpportunity, setMinOpportunity] = useState('');
  const [sortField, setSortField] = useState<SortField | null>(null);
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');

  // ---------- 品牌列表 ----------

  // ---------- AI 可见度 ----------
  const resultKeywords = useMemo(
    () => results.map((r: InspirationKeyword) => r.keyword),
    [results],
  );

  const {
    data: visibilityData,
    isLoading: visibilityLoading,
  } = useQuery({
    queryKey: ['keyword-visibility', brandId, resultKeywords],
    queryFn: () =>
      getKeywordVisibility({
        brandId,
        keywords: resultKeywords.slice(0, 100),
      }),
    enabled: !!brandId && resultKeywords.length > 0,
    staleTime: 30_000,
    refetchInterval: 5000,
  });

  const visibilityMap = useMemo(() => {
    if (!visibilityData?.items) return new Map();
    const map = new Map<string, (typeof visibilityData.items)[number]['platforms']>();
    for (const item of visibilityData.items) {
      map.set(item.keyword, item.platforms);
    }
    return map;
  }, [visibilityData]);

  const singleDetectMutation = useMutation({
    mutationFn: runSingleDetect,
    onSuccess: () => {
      toast.success('已开始检测，稍后刷新结果');
      queryClient.invalidateQueries({ queryKey: ['keyword-visibility'] });
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.error?.message || '检测启动失败');
    },
    onSettled: () => setDetectingKeyword(null),
  });

  const handleDetect = (keyword: string) => {
    if (!brandId) return;
    setDetectingKeyword(keyword);
    singleDetectMutation.mutate({
      brandId,
      keyword,
      platforms: ['volcano', 'qwen', 'hunyuan'],
    });
  };
  const districtList: string[] = useMemo(() => {
    return INSPIRATION_DISTRICTS_BY_CITY[city] ?? [];
  }, [city]);

  // ---------- 登记指数弹窗 ----------
  const [registerOpen, setRegisterOpen] = useState(false);
  const [registerKeywordId, setRegisterKeywordId] = useState('');
  const [registerKeywordText, setRegisterKeywordText] = useState('');

  const handleRegisterIndex = async (item: InspirationKeyword) => {
    if (!brandId) {
      toast.error('请先选择品牌');
      return;
    }
    const key = makeKey(item);
    if (!addedKeys.has(key)) {
      toast.error('请先将该关键词加入词库后再登记指数');
      return;
    }
    try {
      const res = await getKeywordPool({
        brandId,
        keyword: item.keyword,
        pageSize: 10,
      });
      const matched = res.items.find(
        (k) => k.keyword === item.keyword && k.keywordType === item.keywordType,
      );
      if (!matched) {
        toast.error('请先将该关键词加入词库后再登记指数');
        return;
      }
      setRegisterKeywordId(matched.id);
      setRegisterKeywordText(item.keyword);
      setRegisterOpen(true);
    } catch (err: any) {
      toast.error(err?.response?.data?.error?.message || '查询失败');
    }
  };

  // ---------- 列宽 ----------
  const {
    getThStyle,
    getTdStyle,
    getTableStyle,
    handleResizeStart,
    resetColumn,
    isResizing,
  } = useResizableColumns({
    tableKey: 'keyword-inspiration',
    defaultWidths: COL_DEFAULTS,
    defaultVersion: 2,
    userId: user?.id || 'guest',
  });

  // ---------- 行业场景词 ----------
  const industryScenes: string[] = useMemo(() => {
    if (!industry) return [];
    return INSPIRATION_INDUSTRY_SCENES[industry]?.slice(0, 5) ?? [];
  }, [industry]);

  // ---------- 筛选/排序后的结果 ----------
  const filteredResults = useMemo(() => {
    let list = results.slice();

    if (intentFilter !== 'all') {
      list = list.filter((item) => item.intentType === intentFilter);
    }

    const minScore = minOpportunity.trim() ? Number(minOpportunity) : NaN;
    if (!Number.isNaN(minScore)) {
      list = list.filter((item) => item.opportunityScore >= minScore);
    }

    if (sortField) {
      list.sort((a, b) => {
        let diff = 0;
        if (sortField === 'opportunity') {
          diff = a.opportunityScore - b.opportunityScore;
        } else if (sortField === 'keyword') {
          diff = a.keyword.localeCompare(b.keyword, 'zh-CN');
        }
        return sortOrder === 'asc' ? diff : -diff;
      });
    }

    return list;
  }, [results, intentFilter, minOpportunity, sortField, sortOrder]);

  // ---------- 全选逻辑 ----------
  const selectableItems = useMemo(
    () => filteredResults.filter((item) => !addedKeys.has(makeKey(item))),
    [filteredResults, addedKeys],
  );

  const allSelected = useMemo(() => {
    if (selectableItems.length === 0) return false;
    return selectableItems.every((item) => selectedKeys.has(makeKey(item)));
  }, [selectableItems, selectedKeys]);

  const indeterminate = useMemo(() => {
    if (selectableItems.length === 0) return false;
    const selectedCount = selectableItems.filter((item) =>
      selectedKeys.has(makeKey(item)),
    ).length;
    return selectedCount > 0 && selectedCount < selectableItems.length;
  }, [selectableItems, selectedKeys]);

  const selectedNotAddedCount = useMemo(
    () =>
      filteredResults.filter(
        (item) =>
          selectedKeys.has(makeKey(item)) && !addedKeys.has(makeKey(item)),
      ).length,
    [filteredResults, selectedKeys, addedKeys],
  );

  // ---------- 操作函数 ----------
  // ---------- 行业模板：品牌优先，其次 localStorage 记忆 ----------
  const industryStorageKey = `geo:keywords:inspiration:industry:${user?.id || 'guest'}`;

  useEffect(() => {
    if (!user?.id) return;
    const saved = localStorage.getItem(industryStorageKey);
    if (
      saved &&
      (INSPIRATION_INDUSTRIES as readonly string[]).includes(saved)
    ) {
      setIndustry(saved as InspirationIndustry);
    }
  }, [user?.id, industryStorageKey]);

  const handleBrandChange = (value: string) => {
    setSelectedBrandId(value);
    setIndustryFromBrand(false);

    if (!value) return;

    const b = brandOptions.find((opt) => opt.id === value);
    const brandIndustry = b?.industry?.trim();
    if (
      brandIndustry &&
      (INSPIRATION_INDUSTRIES as readonly string[]).includes(brandIndustry)
    ) {
      setIndustry(brandIndustry as InspirationIndustry);
      setIndustryFromBrand(true);
    }
  };

  const handleIndustryChange = (value: InspirationIndustry | '') => {
    setIndustry(value);
    setIndustryFromBrand(false);
    if (value) {
      localStorage.setItem(industryStorageKey, value);
    } else {
      localStorage.removeItem(industryStorageKey);
    }
  };

  const toggleDistrict = (d: string) => {
    setDistricts((prev) =>
      prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d],
    );
  };

  const toggleSelectAll = () => {
    if (allSelected) {
      // 取消选中所有可选行
      const next = new Set(selectedKeys);
      selectableItems.forEach((item) => next.delete(makeKey(item)));
      setSelectedKeys(next);
    } else {
      const next = new Set(selectedKeys);
      selectableItems.forEach((item) => next.add(makeKey(item)));
      setSelectedKeys(next);
    }
  };

  const toggleSelect = (item: InspirationKeyword) => {
    const key = makeKey(item);
    const next = new Set(selectedKeys);
    if (next.has(key)) {
      next.delete(key);
    } else {
      next.add(key);
    }
    setSelectedKeys(next);
  };

  const handleSort = (field: SortField) => {
    if (sortField !== field) {
      setSortField(field);
      setSortOrder('desc');
    } else {
      setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    }
  };

  const handleGenerate = async () => {
    if (!brandId) {
      toast.error('请选择品牌');
      return;
    }
    if (!seedKeyword.trim()) {
      toast.error('请输入种子关键词');
      return;
    }

    setIsGenerating(true);
    try {
      const data = await generateInspiration({
        seedKeyword: seedKeyword.trim(),
        keywordType,
        brandId,
        brandName: brandName || undefined,
        count,
        city: city.trim() || undefined,
        districts: districts.length > 0 ? districts : undefined,
        industry: industry || undefined,
        includeBrand,
        includeQuestion,
        includeLocal,
      });
      setResults(data.items);
      setSelectedKeys(new Set());
      setAddedKeys(new Set());
      setSortField(null);
      setIntentFilter('all');
      setMinOpportunity('');
    } catch (err: any) {
      toast.error(err?.response?.data?.error?.message || '生成失败');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleAddSingle = async (item: InspirationKeyword) => {
    if (!brandId) {
      toast.error('请选择品牌');
      return;
    }
    setIsAdding(true);
    try {
      await addInspirationToPool({
        keywords: [{ keyword: item.keyword, keywordType: item.keywordType }],
        brandId,
      });
      const key = makeKey(item);
      setAddedKeys((prev) => {
        const next = new Set(prev);
        next.add(key);
        return next;
      });
      setSelectedKeys((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
      toast.success('已加入词池');
    } catch (err: any) {
      toast.error(err?.response?.data?.error?.message || '加入词池失败');
    } finally {
      setIsAdding(false);
    }
  };

  const handleBatchAdd = async () => {
    if (selectedNotAddedCount === 0) {
      toast.error('请先选择要加入的关键词');
      return;
    }
    if (!brandId) {
      toast.error('请选择品牌');
      return;
    }
    const keywords = filteredResults
      .filter(
        (item) =>
          selectedKeys.has(makeKey(item)) && !addedKeys.has(makeKey(item)),
      )
      .map((item) => ({
        keyword: item.keyword,
        keywordType: item.keywordType,
      }));

    setIsAdding(true);
    try {
      const res = await addInspirationToPool({ keywords, brandId });
      setAddedKeys((prev) => {
        const next = new Set(prev);
        keywords.forEach((k) => next.add(`${k.keyword}:${k.keywordType}`));
        return next;
      });
      setSelectedKeys(new Set());
      toast.success(`已加入 ${res.added} 个关键词到词池`);
    } catch (err: any) {
      toast.error(err?.response?.data?.error?.message || '加入词池失败');
    } finally {
      setIsAdding(false);
    }
  };

  const handleDeleteSelected = () => {
    const toDelete = new Set(
      filteredResults
        .filter((item) => selectedKeys.has(makeKey(item)))
        .map((item) => makeKey(item)),
    );
    setResults((prev) => prev.filter((item) => !toDelete.has(makeKey(item))));
    setSelectedKeys(new Set());
  };

  // ---------- 渲染 ----------
  const canGenerate = !!brandId && !!seedKeyword.trim() && !isGenerating;

  return (
    <div className="space-y-5 bg-[#F7F9FC]">
      <PageHeader
        title="词灵感 / 关键词蒸馏"
        subtitle="输入种子词，AI 智能生成高潜力关键词"
      />

      <div className="flex flex-col gap-5 2xl:flex-row">
        {/* 左侧表单区 */}
        <SectionCard title="生成设置" className="w-full 2xl:w-[340px] flex-shrink-0">
            {/* 品牌选择 */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-[#101828]">
                品牌选择 <span className="text-red-500">*</span>
              </label>
              <Select value={brandId} onValueChange={handleBrandChange}>
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

            {/* 种子关键词 */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-[#101828]">
                种子关键词 <span className="text-red-500">*</span>
              </label>
              <Input
                placeholder="如：石家庄蛋糕店"
                value={seedKeyword}
                onChange={(e) => setSeedKeyword(e.target.value)}
                onKeyDown={(e) =>
                  e.key === 'Enter' && canGenerate && handleGenerate()
                }
                className="h-9"
              />
            </div>

            {/* 词类型 */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-[#101828]">
                词类型
              </label>
              <div className="flex gap-2">
                {KEYWORD_TYPES.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setKeywordType(t)}
                    className="flex-1 rounded-md border px-3 py-1.5 text-sm transition-colors"
                    style={
                      keywordType === t
                        ? {
                            backgroundColor: '#3B5BFF',
                            color: '#fff',
                            borderColor: '#3B5BFF',
                          }
                        : {
                            backgroundColor: '#fff',
                            color: '#667085',
                            borderColor: '#E5E9F2',
                          }
                    }
                  >
                    {KEYWORD_TYPE_LABELS[t]}
                  </button>
                ))}
              </div>
            </div>

            {/* 生成数量 */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-[#101828]">
                生成数量
              </label>
              <div className="grid grid-cols-4 gap-2">
                {COUNT_OPTIONS.map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setCount(n)}
                    className="rounded-md border px-2 py-1.5 text-sm transition-colors"
                    style={
                      count === n
                        ? {
                            backgroundColor: '#3B5BFF',
                            color: '#fff',
                            borderColor: '#3B5BFF',
                          }
                        : {
                            backgroundColor: '#fff',
                            color: '#667085',
                            borderColor: '#E5E9F2',
                          }
                    }
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>

            {/* 地域设置 */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-[#101828]">
                地域设置
              </label>
              <div className="space-y-2">
                <Input
                  placeholder="请输入城市"
                  value={city}
                  onChange={(e) => {
                    setCity(e.target.value);
                    setDistricts([]);
                  }}
                  className="h-9"
                />
                <div className="max-h-28 overflow-y-auto rounded-md border border-[#E5E9F2] p-2">
                  {districtList.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {districtList.map((d) => (
                        <Label
                          key={d}
                          className="flex cursor-pointer items-center gap-1.5 text-xs font-normal text-[#475467]"
                        >
                          <Checkbox
                            checked={districts.includes(d)}
                            onCheckedChange={() => toggleDistrict(d)}
                            className="size-3.5"
                          />
                          {d}
                        </Label>
                      ))}
                    </div>
                  ) : (
                    <p className="px-1 py-1 text-xs text-[#98A2B3]">
                      暂无区县数据
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* 行业模板 */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-[#101828]">
                行业模板
              </label>
              <Select
                value={industry}
                onValueChange={(v) =>
                  handleIndustryChange(v as InspirationIndustry | '')
                }
              >
                <SelectTrigger className="h-9 w-full">
                  <SelectValue placeholder="通用" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">通用</SelectItem>
                  {INSPIRATION_INDUSTRIES.map((ind) => (
                    <SelectItem key={ind} value={ind}>
                      {INSPIRATION_INDUSTRY_LABELS[ind]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {industryFromBrand && (
                <p
                  className="text-xs font-medium"
                  style={{ color: '#3B5BFF' }}
                >
                  已按品牌信息填为 {INSPIRATION_INDUSTRY_LABELS[industry as InspirationIndustry]}
                </p>
              )}
              {!industry && (
                <p className="text-xs text-[#98A2B3]">
                  建议选择行业，场景词会更准
                </p>
              )}
              {industry && industryScenes.length > 0 && (
                <p className="text-xs text-[#98A2B3]">
                  常用场景词：{industryScenes.join('、')}
                </p>
              )}
            </div>

            {/* 开关选项 */}
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-normal text-[#101828]">
                  包含品牌词
                </Label>
                <Switch
                  checked={includeBrand}
                  onCheckedChange={(v) => setIncludeBrand(v as boolean)}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label className="text-sm font-normal text-[#101828]">
                  包含疑问句
                </Label>
                <Switch
                  checked={includeQuestion}
                  onCheckedChange={(v) => setIncludeQuestion(v as boolean)}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label className="text-sm font-normal text-[#101828]">
                  包含本地到店词
                </Label>
                <Switch
                  checked={includeLocal}
                  onCheckedChange={(v) => setIncludeLocal(v as boolean)}
                />
              </div>
            </div>

            {/* 生成按钮 */}
            <Button
              className="w-full disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed"
              onClick={handleGenerate}
              disabled={!canGenerate}
            >
              {isGenerating ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  正在蒸馏…
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  生成关键词
                </>
              )}
            </Button>
        </SectionCard>

        {/* 右侧结果区 */}
        <SectionCard
          title="生成结果"
          count={results.length > 0 ? filteredResults.length : undefined}
          className="flex-1 min-w-0"
        >

            {/* 顶部操作栏 */}
            {results.length > 0 && (
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                {/* 左侧：筛选 */}
                <div className="flex flex-wrap items-center gap-3">
                  {/* 意图筛选胶囊 */}
                  <div className="flex rounded-md border border-[#E5E9F2] p-0.5">
                    {INTENT_FILTERS.map((f) => (
                      <button
                        key={f.value}
                        type="button"
                        onClick={() => setIntentFilter(f.value)}
                        className="rounded-[6px] px-2.5 py-1 text-xs transition-colors"
                        style={
                          intentFilter === f.value
                            ? {
                                backgroundColor: '#3B5BFF',
                                color: '#fff',
                                fontWeight: 500,
                              }
                            : {
                                backgroundColor: 'transparent',
                                color: '#667085',
                              }
                        }
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>

                  {/* 机会分筛选 */}
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-[#667085]">
                      机会分 ≥
                    </span>
                    <Input
                      type="number"
                      value={minOpportunity}
                      onChange={(e) => setMinOpportunity(e.target.value)}
                      placeholder="—"
                      className="h-7 w-16 px-2 text-xs"
                    />
                  </div>
                </div>

                {/* 右侧：批量操作 */}
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    onClick={handleBatchAdd}
                    disabled={selectedNotAddedCount === 0 || isAdding}
                  >
                    <Plus className="h-3.5 w-3.5" />
                    加入词池（已选 {selectedNotAddedCount}）
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleDeleteSelected}
                    disabled={selectedKeys.size === 0}
                    style={{ color: '#FF5C5C' }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    删除所选
                  </Button>
                </div>
              </div>
            )}

            {isGenerating ? (
              <ResultSkeleton />
            ) : results.length === 0 ? (
              <EmptyState />
            ) : filteredResults.length === 0 ? (
              <EmptyFilterState />
            ) : (
              <div className="overflow-hidden rounded-md border border-[#E5E9F2]">
                <div className="overflow-x-auto">
                  <Table
                    className="table-fixed"
                    style={{ ...getTableStyle(), minWidth: 0 }}
                  >
                    <TableHeader>
                      <TableRow className="hover:bg-transparent">
                        <TableHead
                          data-col="select"
                          className="w-[40px]"
                          style={getThStyle('select')}
                        >
                          <Checkbox
                            checked={indeterminate ? 'indeterminate' : allSelected}
                            onCheckedChange={toggleSelectAll}
                            aria-label="全选"
                          />
                          <ColumnResizeHandle
                            onResizeStart={(e) =>
                              handleResizeStart('select', e)
                            }
                            onDoubleClick={() => resetColumn('select')}
                            isResizing={isResizing}
                          />
                        </TableHead>

                        <TableHead
                          data-col="keyword"
                          className="cursor-pointer select-none min-w-0"
                          style={getThStyle('keyword')}
                          onClick={() => handleSort('keyword')}
                        >
                          <span className="inline-flex items-center gap-1">
                            关键词
                            {sortField === 'keyword' &&
                              (sortOrder === 'asc' ? (
                                <ChevronUp className="h-3 w-3" />
                              ) : (
                                <ChevronDown className="h-3 w-3" />
                              ))}
                          </span>
                          <ColumnResizeHandle
                            onResizeStart={(e) =>
                              handleResizeStart('keyword', e)
                            }
                            onDoubleClick={() => resetColumn('keyword')}
                            onClick={(e) => e.stopPropagation()}
                            isResizing={isResizing}
                          />
                        </TableHead>

                        <TableHead
                          data-col="intent"
                          className="text-center"
                          style={getThStyle('intent')}
                        >
                          意图类型
                          <ColumnResizeHandle
                            onResizeStart={(e) =>
                              handleResizeStart('intent', e)
                            }
                            onDoubleClick={() => resetColumn('intent')}
                            isResizing={isResizing}
                          />
                        </TableHead>

                        <TableHead
                          data-col="scene"
                          className="min-w-0"
                          style={getThStyle('scene')}
                        >
                          场景标签
                          <ColumnResizeHandle
                            onResizeStart={(e) =>
                              handleResizeStart('scene', e)
                            }
                            onDoubleClick={() => resetColumn('scene')}
                            isResizing={isResizing}
                          />
                        </TableHead>

                        <TableHead
                          data-col="flags"
                          className="text-center"
                          style={getThStyle('flags')}
                        >
                          标记
                          <ColumnResizeHandle
                            onResizeStart={(e) =>
                              handleResizeStart('flags', e)
                            }
                            onDoubleClick={() => resetColumn('flags')}
                            isResizing={isResizing}
                          />
                        </TableHead>

                        <TableHead
                          data-col="opportunity"
                          className="cursor-pointer select-none"
                          style={getThStyle('opportunity')}
                          onClick={() => handleSort('opportunity')}
                        >
                          <span className="inline-flex items-center justify-end gap-1 w-full text-right">
                            机会分
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <CircleHelp className="h-3.5 w-3.5 text-[#98A2B3] inline-block" />
                              </TooltipTrigger>
                              <TooltipContent side="top" className="max-w-[240px]">
                                按 意图类型×地域匹配×词长×含品牌词×交易意图
                                加权计算，分数越高机会越大
                              </TooltipContent>
                            </Tooltip>
                            {sortField === 'opportunity' &&
                              (sortOrder === 'asc' ? (
                                <ChevronUp className="h-3 w-3" />
                              ) : (
                                <ChevronDown className="h-3 w-3" />
                              ))}
                          </span>
                          <ColumnResizeHandle
                            onResizeStart={(e) =>
                              handleResizeStart('opportunity', e)
                            }
                            onDoubleClick={() => resetColumn('opportunity')}
                            onClick={(e) => e.stopPropagation()}
                            isResizing={isResizing}
                          />
                        </TableHead>

                        <TableHead
                          data-col="visibility"
                          className="text-center"
                          style={getThStyle('visibility')}
                        >
                          AI 可见度
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <CircleHelp className="ml-1 h-3.5 w-3.5 text-[#98A2B3] inline-block align-text-bottom" />
                            </TooltipTrigger>
                            <TooltipContent side="top" className="max-w-[260px]">
                              三个平台的品牌提及状态：✓ 提及 · ✗ 未提及 · — 未检测
                            </TooltipContent>
                          </Tooltip>
                          <ColumnResizeHandle
                            onResizeStart={(e) =>
                              handleResizeStart('visibility', e)
                            }
                            onDoubleClick={() => resetColumn('visibility')}
                            isResizing={isResizing}
                          />
                        </TableHead>

                        <TableHead
                          data-col="reason"
                          className="min-w-0"
                          style={getThStyle('reason')}
                        >
                          推荐理由
                          <ColumnResizeHandle
                            onResizeStart={(e) =>
                              handleResizeStart('reason', e)
                            }
                            onDoubleClick={() => resetColumn('reason')}
                            isResizing={isResizing}
                          />
                        </TableHead>

                        <TableHead
                          data-col="actions"
                          className="text-center"
                          style={getThStyle('actions')}
                        >
                          操作
                          <ColumnResizeHandle
                            onResizeStart={(e) =>
                              handleResizeStart('actions', e)
                            }
                            onDoubleClick={() => resetColumn('actions')}
                            isResizing={isResizing}
                          />
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredResults.map((item) => {
                        const key = makeKey(item);
                        const isAdded = addedKeys.has(key);
                        const isSelected = selectedKeys.has(key);
                        const colors = INSPIRATION_INTENT_COLORS[item.intentType];
                        return (
                          <TableRow key={key}>
                            <TableCell style={getTdStyle('select')}>
                              <Checkbox
                                checked={isSelected}
                                disabled={isAdded}
                                onCheckedChange={() => toggleSelect(item)}
                                aria-label={`选择 ${item.keyword}`}
                              />
                            </TableCell>
                            <TableCell
                              className="font-medium text-[#101828] min-w-0"
                              style={getTdStyle('keyword')}
                            >
                              <span
                                className="block"
                                title={item.keyword}
                              >
                                {item.keyword}
                              </span>
                            </TableCell>
                            <TableCell
                              className="text-center"
                              style={getTdStyle('intent')}
                            >
                              <span
                                className="inline-flex items-center whitespace-nowrap rounded-md px-2 py-0.5 text-xs font-medium"
                                style={{
                                  backgroundColor: colors.bg,
                                  color: colors.text,
                                }}
                              >
                                {INSPIRATION_INTENT_LABELS[item.intentType]}
                              </span>
                            </TableCell>
                            <TableCell
                              className="min-w-0 text-[12px] text-[#667085]"
                              style={getTdStyle('scene')}
                            >
                              <span
                                className="block"
                                title={item.sceneTag}
                              >
                                {item.sceneTag || '—'}
                              </span>
                            </TableCell>
                            <TableCell
                              className="text-center"
                              style={getTdStyle('flags')}
                            >
                              <div className="flex items-center justify-center gap-1 flex-nowrap overflow-hidden">
                                {item.hasLocation && (
                                  <span
                                    className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium leading-none"
                                    style={{
                                      backgroundColor: 'rgba(255, 169, 64, 0.12)',
                                      color: '#FFA940',
                                    }}
                                  >
                                    本地
                                  </span>
                                )}
                                {item.hasBrand && (
                                  <span
                                    className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium leading-none"
                                    style={{
                                      backgroundColor: 'rgba(59, 91, 255, 0.12)',
                                      color: '#3B5BFF',
                                    }}
                                  >
                                    品牌
                                  </span>
                                )}
                                {!item.hasLocation && !item.hasBrand && (
                                  <span className="text-[12px] text-[#98A2B3]">—</span>
                                )}
                              </div>
                            </TableCell>
                            <TableCell
                              className="text-right tabular-nums"
                              style={getTdStyle('opportunity')}
                            >
                              <span
                                className="text-[14px] font-semibold"
                                style={{
                                  color: getOpportunityColor(
                                    item.opportunityScore,
                                  ),
                                }}
                              >
                                {item.opportunityScore}
                              </span>
                            </TableCell>
                            <TableCell
                              className="text-center"
                              style={getTdStyle('visibility')}
                            >
                              <VisibilityDots
                                platforms={visibilityMap.get(item.keyword)}
                                loading={visibilityLoading}
                              />
                            </TableCell>
                            <TableCell
                              className="min-w-0 text-[12px] text-[#667085]"
                              style={getTdStyle('reason')}
                            >
                              <span
                                className="block"
                                title={item.reason}
                              >
                                {item.reason || '—'}
                              </span>
                            </TableCell>
                            <TableCell
                              className="text-center"
                              style={getTdStyle('actions')}
                            >
                              <div className="flex items-center justify-center gap-2 flex-wrap">
                                <button
                                  type="button"
                                  className="text-xs font-medium transition-colors hover:underline"
                                  style={{ color: '#3B5BFF' }}
                                  onClick={() => handleDetect(item.keyword)}
                                  disabled={detectingKeyword === item.keyword || singleDetectMutation.isPending}
                                >
                                  {detectingKeyword === item.keyword && singleDetectMutation.isPending ? (
                                    <Loader2 className="h-3 w-3 animate-spin" />
                                  ) : (
                                    '检测'
                                  )}
                                </button>
                                {INDEX_LOG_ENABLED && (
                                  <button
                                    type="button"
                                    className="text-xs font-medium transition-colors hover:underline"
                                    style={{ color: '#3B5BFF' }}
                                    onClick={() => handleRegisterIndex(item)}
                                  >
                                    登记指数
                                  </button>
                                )}
                                {isAdded ? (
                                  <span className="inline-flex items-center rounded-md border border-[#E5E9F2] px-2 py-0.5 text-xs text-[#98A2B3]">
                                    已加入
                                  </span>
                                ) : (
                                  <button
                                    type="button"
                                    className="text-xs font-medium transition-colors hover:underline"
                                    style={{ color: '#3B5BFF' }}
                                    onClick={() => handleAddSingle(item)}
                                    disabled={isAdding}
                                  >
                                    加入词池
                                  </button>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
                {/* 底部统计 + 说明 */}
                <div className="border-t border-[#E5E9F2] px-4 py-2 flex items-center justify-between">
                  <p className="text-[12px] text-[#98A2B3]">
                    搜索量与竞争度无公开数据源，本系统采用「AI 提及率 + 推荐位次」作为真实效果指标。
                  </p>
                  {visibilityData?.stats && visibilityData.stats.testedKeywords > 0 ? (
                    <p className="text-[12px] text-[#667085]">
                      已检测 {visibilityData.stats.testedKeywords} 词 · 平均提及率 {(visibilityData.stats.avgMentionRate * 100).toFixed(0)}%
                      {AI_DETECT_PLATFORMS.map((p) => (
                        <span key={p} className="ml-2">
                          {AI_DETECT_PLATFORM_LABELS[p]} {((visibilityData.stats.mentionRateByPlatform[p] || 0) * 100).toFixed(0)}%
                        </span>
                      ))}
                    </p>
                  ) : (
                    <p className="text-[12px] text-[#98A2B3]">
                      暂无检测数据
                    </p>
                  )}
                </div>
              </div>
            )}
        </SectionCard>
      </div>

      {/* 指数登记弹窗 */}
      <IndexRegisterDialog
        open={registerOpen}
        onOpenChange={setRegisterOpen}
        keywordId={registerKeywordId}
        keywordText={registerKeywordText}
      />
    </div>
  );
};

const ResultSkeleton: React.FC = () => (
  <div className="space-y-2 rounded-md border border-[#E5E9F2] p-3">
    {Array.from({ length: 8 }).map((_, i) => (
      <div key={i} className="flex items-center gap-3 py-1.5">
        <Skeleton className="h-4 w-4" />
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-4 w-16" />
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-4 w-16" />
        <Skeleton className="h-4 w-16" />
        <Skeleton className="h-4 w-14" />
        <Skeleton className="h-4 flex-1" />
        <Skeleton className="h-4 w-16" />
      </div>
    ))}
  </div>
);

const EmptyState: React.FC = () => (
  <div className="flex flex-col items-center justify-center py-16 text-center">
    <div className="mb-4 flex size-16 items-center justify-center rounded-full bg-slate-100">
      <Sparkles className="size-8 text-slate-400" />
    </div>
    <p className="text-sm font-medium text-[#475467]">还没有生成结果</p>
    <p className="mt-1 text-xs text-[#98A2B3]">
      点击左侧「生成」按钮开始关键词蒸馏
    </p>
  </div>
);

const EmptyFilterState: React.FC = () => (
  <div className="flex flex-col items-center justify-center py-16 text-center">
    <div className="mb-4 flex size-16 items-center justify-center rounded-full bg-slate-100">
      <Info className="size-8 text-slate-400" />
    </div>
    <p className="text-sm font-medium text-[#475467]">没有匹配的关键词</p>
    <p className="mt-1 text-xs text-[#98A2B3]">
      试试调整筛选条件或重新生成
    </p>
  </div>
);

interface VisibilityDotsProps {
  platforms?: Record<string, {
    status: string;
    rank: number | null;
    mentionPosition: string | null;
    testedAt: string | null;
    resultId: string | null;
  }>;
  loading?: boolean;
}

const PLATFORM_DOT_COLORS: Record<string, { mentioned: string; not_mentioned: string; untested: string }> = {
  volcano: { mentioned: '#FF4D4F', not_mentioned: '#d9d9d9', untested: '#f0f0f0' },
  qwen: { mentioned: '#9254DE', not_mentioned: '#d9d9d9', untested: '#f0f0f0' },
  hunyuan: { mentioned: '#FAAD14', not_mentioned: '#d9d9d9', untested: '#f0f0f0' },
};

const VisibilityDots: React.FC<VisibilityDotsProps> = ({ platforms, loading }) => {
  if (loading || !platforms) {
    return (
      <div className="flex flex-row flex-nowrap items-center justify-center gap-1 whitespace-nowrap">
        {AI_DETECT_PLATFORMS.map((p) => (
          <span
            key={p}
            className="inline-block h-2 w-2 flex-shrink-0 rounded-full bg-gray-200"
          />
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-row flex-nowrap items-center justify-center gap-1.5 whitespace-nowrap">
      {AI_DETECT_PLATFORMS.map((p) => {
        const info = platforms[p];
        const status = info?.status || 'untested';
        const colors = PLATFORM_DOT_COLORS[p] || PLATFORM_DOT_COLORS.volcano;
        const bg =
          status === 'mentioned'
            ? colors.mentioned
            : status === 'not_mentioned'
              ? colors.not_mentioned
              : colors.untested;
        const symbol =
          status === 'mentioned' ? '✓' : status === 'not_mentioned' ? '✗' : '—';
        const title = `${AI_DETECT_PLATFORM_LABELS[p]}${
          status === 'mentioned'
            ? ` 提及 · 第${info?.rank || '?'}位`
            : status === 'not_mentioned'
              ? ' 未提及'
              : ' 未检测'
        }${info?.testedAt ? ` · ${info.testedAt.slice(0, 16).replace('T', ' ')}` : ''}`;
        return (
          <Tooltip key={p}>
            <TooltipTrigger asChild>
              <span
                className="inline-flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-medium text-white"
                style={{ backgroundColor: bg }}
              >
                {symbol}
              </span>
            </TooltipTrigger>
            <TooltipContent side="top" className="text-xs">
              {title}
            </TooltipContent>
          </Tooltip>
        );
      })}
    </div>
  );
};

export default KeywordInspirationPage;
