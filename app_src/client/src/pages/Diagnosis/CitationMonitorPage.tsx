import React, { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@client/src/components/ui/button';
import { Input } from '@client/src/components/ui/input';
import { Textarea } from '@client/src/components/ui/textarea';
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@client/src/components/ui/dialog';
import { Checkbox } from '@client/src/components/ui/checkbox';
import { Skeleton } from '@client/src/components/ui/skeleton';
import {
  Plus,
  Search,
  Trash2,
  Eye,
  Play,
  Check,
  ExternalLink,
} from 'lucide-react';
import { StatCard } from '@client/src/components/layout/StatCard';
import { SectionCard } from '@client/src/components/layout/SectionCard';
import { Toolbar } from '@client/src/components/layout/Toolbar';
import { Pill } from '@client/src/components/layout/Pill';
import { DataTable } from '@client/src/components/layout/DataTable';
import { EmptyState } from '@client/src/components/layout/EmptyState';
import { getBrands } from '@client/src/api/brands';
import {
  useResults,
  useKpi,
  usePlatformDistribution,
  useCreateTask,
  useCreateManualSnapshot,
  useDeleteResult,
  useExecuteResult,
  useKeywords,
  useGenerateQuestions,
  usePlatformsStatus,
  DIAGNOSIS_PLATFORMS,
  DIAGNOSIS_PLATFORM_LABELS,
  CITATION_PROBE_STATUS_LABELS,
} from '@client/src/api/citation-probe';
import type {
  DiagnosisPlatform,
  CitationProbeResult,
  CitationProbeKeywordItem,
  CitationProbePlatformDistributionItem,
  PlatformStatusResponse,
} from '@client/src/api/citation-probe';
import { toast } from 'sonner';
import { showConfirm } from '@lark-apaas/client-toolkit';
import { UniversalLink } from '@lark-apaas/client-toolkit/components/UniversalLink';

const PRIMARY = '#2E7DFF';
const ACCENT = '#F59E0B';
const SUCCESS = '#10B981';

function formatRate(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return d.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
}

const KpiCard: React.FC<{
  label: string;
  value: React.ReactNode;
  subLabel?: string;
  footNote?: string;
  isLoading?: boolean;
}> = ({ label, value, subLabel, footNote, isLoading }) => (
  <div
    className="min-h-24 rounded-[12px] border border-[#E6EAF2] bg-white p-5"
    style={{
      boxShadow: '0 1px 2px rgba(15,23,42,.04), 0 8px 24px -12px rgba(15,23,42,.10)',
    }}
  >
    <div className="text-[12px] text-[#94A3B8]">{label}</div>
    {isLoading ? (
      <Skeleton className="h-6 w-24 mt-1.5" />
    ) : (
      <div className="mt-1.5 tabular-nums text-[24px] font-semibold leading-tight" style={{ color: PRIMARY }}>
        {value}
      </div>
    )}
    {subLabel && !isLoading && (
      <div className="text-[12px] text-[#5B6B85] mt-0.5 tabular-nums font-normal">{subLabel}</div>
    )}
    {footNote && (
      <div className="text-[12px] text-[#94A3B8] mt-2 pt-2 border-t border-[#EEF2F7] leading-relaxed font-normal">
        {footNote}
      </div>
    )}
  </div>
);

const PlatformDistributionChart: React.FC<{
  data: CitationProbePlatformDistributionItem[];
  isLoading: boolean;
  platformsStatus?: PlatformStatusResponse['platforms'];
}> = ({ data, isLoading, platformsStatus }) => {
  const maxValue = useMemo(() => {
    const max = Math.max(...data.map((d) => d.total), 1);
    return max;
  }, [data]);

  if (isLoading) {
    return (
      <SectionCard title="平台提及分布">
        <div className="flex items-end justify-around h-48">
          {DIAGNOSIS_PLATFORMS.map((p) => (
            <div key={p} className="flex flex-col items-center gap-2 flex-1">
              <Skeleton className="w-10 h-32" />
              <Skeleton className="h-3 w-12" />
            </div>
          ))}
        </div>
      </SectionCard>
    );
  }

  return (
    <SectionCard title="平台提及分布">
      <div className="flex items-end justify-around h-48 gap-2">
        {DIAGNOSIS_PLATFORMS.map((p) => {
          const item = data.find((d) => d.platform === p);
          const mentioned = item?.mentioned ?? 0;
          const total = item?.total ?? 0;
          const heightPercent = total > 0 ? (mentioned / maxValue) * 100 : 0;
          const connected = platformsStatus?.[p]?.connected ?? false;
          return (
            <div
              key={p}
              className="flex flex-col items-center gap-2 flex-1 h-full justify-end"
            >
              <div className="text-xs tabular-nums text-[#5B6B85] mb-1">
                {mentioned}/{total}
              </div>
              <div
                className="w-10 rounded-t transition-all duration-300"
                style={{
                  height: `${Math.max(heightPercent, total > 0 ? 2 : 0)}%`,
                  backgroundColor: connected ? PRIMARY : '#93C5FD',
                  minHeight: total > 0 ? '2px' : '0',
                  opacity: connected ? 1 : 0.5,
                }}
              />
              <div className="text-xs text-[#0F172A] mt-2">
                {DIAGNOSIS_PLATFORM_LABELS[p]}
              </div>
              <div className="text-[12px] text-[#94A3B8]">
                {connected ? '已接入' : '未接入'}
              </div>
            </div>
          );
        })}
      </div>
    </SectionCard>
  );
};

const ResultTableSkeleton: React.FC = () => (
  <div className="space-y-1">
    {Array.from({ length: 5 }).map((_, i) => (
      <div key={i} className="flex items-center gap-3 h-11 px-4">
        <Skeleton className="h-3.5 flex-1" />
        <Skeleton className="h-5 w-20" />
        <Skeleton className="h-5 w-16" />
        <Skeleton className="h-3.5 w-16" />
        <Skeleton className="h-3.5 w-20" />
        <Skeleton className="h-3.5 w-24" />
        <Skeleton className="h-6 w-24" />
      </div>
    ))}
  </div>
);

const CreateTaskDialog: React.FC<{
  open: boolean;
  onOpenChange: (open: boolean) => void;
  platformsStatus?: PlatformStatusResponse['platforms'];
}> = ({ open, onOpenChange, platformsStatus }) => {
  const [step, setStep] = useState(0);
  const [brandId, setBrandId] = useState('');
  const [brandName, setBrandName] = useState('');
  const [selectedKeywordIds, setSelectedKeywordIds] = useState<string[]>([]);
  const [platforms, setPlatforms] = useState<DiagnosisPlatform[]>([]);
  const [questions, setQuestions] = useState<string[]>([]);
  const [keywordSearch, setKeywordSearch] = useState('');
  const [manualKeywords, setManualKeywords] = useState<string[]>([]);
  const [manualInput, setManualInput] = useState('');

  const { data: brands = [] } = useQuery({
    queryKey: ['brands-options'],
    queryFn: () => getBrands(),
    retry: false,
  });

  const { data: keywords = [], isLoading: keywordsLoading } = useKeywords(brandId);
  const generateQuestionsMutation = useGenerateQuestions();
  const createTaskMutation = useCreateTask();

  const filteredKeywords = useMemo(() => {
    if (!keywordSearch.trim()) return keywords;
    const lower = keywordSearch.toLowerCase();
    return keywords.filter((k: CitationProbeKeywordItem) =>
      k.keyword.toLowerCase().includes(lower),
    );
  }, [keywords, keywordSearch]);

  const toggleKeyword = (id: string) => {
    setSelectedKeywordIds((prev) =>
      prev.includes(id) ? prev.filter((k) => k !== id) : prev.length < 20 ? [...prev, id] : prev,
    );
  };

  const totalKeywordCount = selectedKeywordIds.length + manualKeywords.length;

  const addManualKeywords = (raw: string) => {
    const parts = raw
      .split(/[\n,，、;；]/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (parts.length === 0) return;
    const remaining = 20 - totalKeywordCount;
    if (remaining <= 0) {
      toast.error('最多选择 20 个关键词');
      return;
    }
    const toAdd = parts.slice(0, remaining).filter(
      (kw) => !manualKeywords.includes(kw),
    );
    if (toAdd.length > 0) {
      setManualKeywords((prev) => [...prev, ...toAdd]);
    }
    setManualInput('');
  };

  const removeManualKeyword = (kw: string) => {
    setManualKeywords((prev) => prev.filter((k) => k !== kw));
  };

  const getAllKeywords = (): string[] => {
    const fromLib = keywords
      .filter((k: CitationProbeKeywordItem) => selectedKeywordIds.includes(k.id))
      .map((k: CitationProbeKeywordItem) => k.keyword);
    return [...fromLib, ...manualKeywords];
  };

  const togglePlatform = (p: DiagnosisPlatform) => {
    setPlatforms((prev) =>
      prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p],
    );
  };

  const handleGenerateQuestions = async () => {
    const allKw = getAllKeywords();
    if (allKw.length === 0) {
      toast.error('请至少选择或输入 1 个关键词');
      return;
    }
    const result = await generateQuestionsMutation.mutateAsync({
      keywords: allKw,
      count: 10,
    });
    setQuestions(result);
  };

  const handleQuestionsTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const lines = e.target.value
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);
    setQuestions(lines);
  };

  const handleSubmit = async () => {
    if (!brandId) {
      toast.error('请选择品牌');
      return;
    }
    if (platforms.length === 0) {
      toast.error('请至少选择 1 个平台');
      return;
    }
    if (questions.length === 0) {
      toast.error('请至少输入 1 个提问');
      return;
    }
    await createTaskMutation.mutateAsync({
      brandId,
      brandName,
      keywordIds: selectedKeywordIds,
      keywords: getAllKeywords(),
      platforms,
      questions,
    });
    handleClose();
  };

  const handleClose = () => {
    setStep(0);
    setBrandId('');
    setBrandName('');
    setSelectedKeywordIds([]);
    setManualKeywords([]);
    setManualInput('');
    setPlatforms([]);
    setQuestions([]);
    setKeywordSearch('');
    onOpenChange(false);
  };

  const canNext = () => {
    if (step === 0) return !!brandId;
    if (step === 1) return totalKeywordCount > 0;
    if (step === 2) return platforms.length > 0;
    return true;
  };

  const STEP_LABELS = ['选择品牌', '选择关键词', '选择平台', '生成提问'];

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[640px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>新建探针任务</DialogTitle>
        </DialogHeader>

        <div className="flex items-center justify-center gap-2 py-2">
          {STEP_LABELS.map((label, i) => (
            <React.Fragment key={label}>
              <div className="flex flex-col items-center gap-1">
                <div
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold"
                  style={{
                    backgroundColor: i <= step ? PRIMARY : '#e2e8f0',
                    color: i <= step ? '#fff' : '#94a3b8',
                  }}
                >
                  {i < step ? <Check className="h-4 w-4" /> : i + 1}
                </div>
                <span
                  className="text-xs whitespace-nowrap"
                  style={{ color: i <= step ? '#0f172a' : '#94a3b8' }}
                >
                  {label}
                </span>
              </div>
              {i < STEP_LABELS.length - 1 && (
                <div
                  className="h-px w-10"
                  style={{ backgroundColor: i < step ? PRIMARY : '#e2e8f0' }}
                />
              )}
            </React.Fragment>
          ))}
        </div>

        <div className="py-4">
          {step === 0 && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[#0f172a] mb-2">
                  选择品牌 <span style={{ color: '#FF5C5C' }}>*</span>
                </label>
                <Select
                  value={brandId}
                  onValueChange={(val) => {
                    setBrandId(val);
                    const brand = brands.find((b) => b.id === val);
                    if (brand) setBrandName(brand.name);
                    setSelectedKeywordIds([]);
                    setManualKeywords([]);
                    setManualInput('');
                  }}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="请选择品牌" />
                  </SelectTrigger>
                  <SelectContent>
                    {brands.map((b) => (
                      <SelectItem key={b.id} value={b.id}>
                        {b.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <label className="block text-sm font-medium text-[#0f172a]">
                  选择关键词
                  <span className="text-xs text-[#94a3b8] ml-2">
                    最多 20 条，已选 {totalKeywordCount}（词库 {selectedKeywordIds.length} · 手动 {manualKeywords.length}）
                  </span>
                </label>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    className="text-xs font-medium"
                    style={{ color: '#2E7DFF' }}
                    onClick={() => {
                      if (filteredKeywords.length > 0 && totalKeywordCount < 20) {
                        const remaining = 20 - manualKeywords.length;
                        const toAdd = filteredKeywords
                          .filter((k: CitationProbeKeywordItem) => !selectedKeywordIds.includes(k.id))
                          .slice(0, remaining)
                          .map((k: CitationProbeKeywordItem) => k.id);
                        setSelectedKeywordIds((prev) => [...prev, ...toAdd]);
                      }
                    }}
                  >
                    全选词库
                  </button>
                  <button
                    type="button"
                    className="text-xs font-medium text-[#64748b]"
                    onClick={() => {
                      setSelectedKeywordIds([]);
                      setManualKeywords([]);
                    }}
                  >
                    清空
                  </button>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-medium text-[#64748b]">
                    从词库选择
                  </label>
                  <span className="text-xs text-[#94a3b8]">
                    词库共 {keywords.length} 个
                  </span>
                </div>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94a3b8]" />
                  <Input
                    placeholder="搜索词库关键词"
                    value={keywordSearch}
                    onChange={(e) => setKeywordSearch(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <div className="mt-2 max-h-40 overflow-y-auto border rounded-md p-2">
                  {keywordsLoading ? (
                    <div className="space-y-2 p-2">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Skeleton key={i} className="h-8 w-full" />
                      ))}
                    </div>
                  ) : keywords.length === 0 ? (
                    <div className="py-6 text-center text-sm text-[#94a3b8]">
                      该品牌暂无关键词，可直接在下方手动添加
                    </div>
                  ) : filteredKeywords.length === 0 ? (
                    <div className="py-6 text-center text-sm text-[#94a3b8]">
                      没有匹配的关键词，可在下方手动添加
                    </div>
                  ) : (
                    <div className="space-y-1">
                      {filteredKeywords.map((kw: CitationProbeKeywordItem) => {
                        const checked = selectedKeywordIds.includes(kw.id);
                        const disabled = !checked && totalKeywordCount >= 20;
                        return (
                          <div
                            key={kw.id}
                            className={`flex items-center gap-2 rounded px-2 py-2 cursor-pointer ${
                              checked ? 'bg-primary/5' : 'hover:bg-muted/50'
                            } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                            onClick={() => !disabled && toggleKeyword(kw.id)}
                          >
                            <Checkbox checked={checked} disabled={disabled} />
                            <span className="text-sm text-[#0f172a]">
                              {kw.keyword}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-[#E5E9F2]" />
                </div>
                <div className="relative flex justify-center">
                  <span className="bg-white px-2 text-xs text-[#94a3b8]">或</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-[#64748b] mb-1">
                  手动输入关键词
                  <span className="text-[#94a3b8] ml-1">（回车/逗号/顿号分隔批量添加）</span>
                </label>
                <div className="flex gap-2">
                  <Input
                    placeholder="输入关键词后按回车添加"
                    value={manualInput}
                    onChange={(e) => setManualInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        addManualKeywords(manualInput);
                      }
                    }}
                    disabled={totalKeywordCount >= 20}
                  />
                  <Button
                    variant="outline"
                    onClick={() => addManualKeywords(manualInput)}
                    disabled={!manualInput.trim() || totalKeywordCount >= 20}
                  >
                    添加
                  </Button>
                </div>
                {manualKeywords.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {manualKeywords.map((kw) => (
                      <div
                        key={kw}
                        className="flex items-center gap-1 rounded-full bg-primary/10 px-3 py-1 text-xs text-[#2E7DFF]"
                      >
                        <span>{kw}</span>
                        <button
                          type="button"
                          className="ml-1 hover:text-[#FF5C5C]"
                          onClick={() => removeManualKeyword(kw)}
                          aria-label={`删除 ${kw}`}
                        >
                          <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M18 6L6 18M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <label className="block text-sm font-medium text-[#0f172a]">
                  选择平台 <span style={{ color: '#FF5C5C' }}>*</span>
                </label>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    className="text-xs font-medium"
                    style={{ color: PRIMARY }}
                    onClick={() => setPlatforms(DIAGNOSIS_PLATFORMS.filter((p) => platformsStatus?.[p]?.connected ?? false))}
                  >
                    全选
                  </button>
                  <button
                    type="button"
                    className="text-xs font-medium text-[#64748b]"
                    onClick={() => setPlatforms([])}
                  >
                    清空
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-2 min-[600px]:grid-cols-3 gap-3">
                {DIAGNOSIS_PLATFORMS.map((p) => {
                  const selected = platforms.includes(p);
                  const connected = platformsStatus?.[p]?.connected ?? false;
                  const disabled = !connected;
                  return (
                    <div
                      key={p}
                      role="checkbox"
                      aria-checked={selected}
                      aria-disabled={disabled}
                      className={`relative rounded-lg p-3 text-center transition-all ${
                        disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'
                      }`}
                      style={{
                        border: selected
                          ? `2px solid ${PRIMARY}`
                          : '1px solid #E5E9F2',
                        backgroundColor: disabled ? '#f8fafc' : '#fff',
                        borderRadius: '8px',
                      }}
                      onClick={() => !disabled && togglePlatform(p)}
                      title={disabled ? '该平台未接入，请先在设置中配置' : ''}
                    >
                      {selected && (
                        <div
                          className="absolute -top-[1px] -right-[1px] flex h-5 w-5 items-center justify-center rounded-bl-lg rounded-tr-[7px]"
                          style={{ backgroundColor: PRIMARY }}
                        >
                          <Check className="h-3 w-3 text-white" />
                        </div>
                      )}
                      <div
                        className="text-sm font-medium"
                        style={{
                          color: selected ? PRIMARY : '#0f172a',
                        }}
                      >
                        {DIAGNOSIS_PLATFORM_LABELS[p]}
                      </div>
                      <div
                        className="text-xs mt-1"
                        style={{
                          color: connected ? ACCENT : '#94a3b8',
                        }}
                      >
                        {connected ? '已接入' : '未接入（需配置）'}
                      </div>
                    </div>
                  );
                })}
              </div>
              <p className="text-xs text-[#94a3b8]">
                未接入的平台暂不可选，请先在「设置 - AI 模型」中配置对应平台。
              </p>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <label className="block text-sm font-medium text-[#0f172a]">
                  提问列表
                </label>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleGenerateQuestions}
                  disabled={generateQuestionsMutation.isPending}
                >
                  {generateQuestionsMutation.isPending
                    ? '生成中...'
                    : '生成提问'}
                </Button>
              </div>
              <Textarea
                value={questions.join('\n')}
                onChange={handleQuestionsTextareaChange}
                placeholder="每行一个提问，可直接编辑"
                className="min-h-[200px] font-mono text-sm"
              />
              <p className="text-xs text-[#94a3b8]">
                共 {questions.length} 条提问。可手动编辑或补充。
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            取消
          </Button>
          {step > 0 && (
            <Button variant="outline" onClick={() => setStep(step - 1)}>
              上一步
            </Button>
          )}
          {step < STEP_LABELS.length - 1 ? (
            <Button
              disabled={!canNext()}
              onClick={() => setStep(step + 1)}
            >
              下一步
            </Button>
          ) : (
            <Button
              onClick={handleSubmit}
              disabled={createTaskMutation.isPending}
            >
              {createTaskMutation.isPending ? '创建中...' : '创建任务'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const ManualSnapshotDialog: React.FC<{
  open: boolean;
  onOpenChange: (open: boolean) => void;
}> = ({ open, onOpenChange }) => {
  const [brandId, setBrandId] = useState('');
  const [brandName, setBrandName] = useState('');
  const [platform, setPlatform] = useState<DiagnosisPlatform | ''>('');
  const [question, setQuestion] = useState('');
  const [rawAnswer, setRawAnswer] = useState('');

  const { data: brands = [] } = useQuery({
    queryKey: ['brands-options'],
    queryFn: () => getBrands(),
    retry: false,
  });

  const createManualMutation = useCreateManualSnapshot();

  const handleSubmit = async () => {
    if (!brandId) {
      toast.error('请选择品牌');
      return;
    }
    if (!platform) {
      toast.error('请选择平台');
      return;
    }
    if (!question.trim()) {
      toast.error('请输入提问原文');
      return;
    }
    if (!rawAnswer.trim()) {
      toast.error('请输入 AI 回答原文');
      return;
    }
    await createManualMutation.mutateAsync({
      brandId,
      brandAliases: [brandName],
      question: question.trim(),
      platform: platform as DiagnosisPlatform,
      rawAnswer: rawAnswer.trim(),
    });
    handleClose();
  };

  const handleClose = () => {
    setBrandId('');
    setBrandName('');
    setPlatform('');
    setQuestion('');
    setRawAnswer('');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle>录入快照</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-[#0f172a] mb-2">
              选择品牌 <span style={{ color: '#FF5C5C' }}>*</span>
            </label>
            <Select
              value={brandId}
              onValueChange={(val) => {
                setBrandId(val);
                const brand = brands.find((b) => b.id === val);
                if (brand) setBrandName(brand.name);
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="请选择品牌" />
              </SelectTrigger>
              <SelectContent>
                {brands.map((b) => (
                  <SelectItem key={b.id} value={b.id}>
                    {b.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="block text-sm font-medium text-[#0f172a] mb-2">
              选择平台 <span style={{ color: '#FF5C5C' }}>*</span>
            </label>
            <Select
              value={platform}
              onValueChange={(val) => setPlatform(val as DiagnosisPlatform)}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="请选择平台" />
              </SelectTrigger>
              <SelectContent>
                {DIAGNOSIS_PLATFORMS.map((p) => (
                  <SelectItem key={p} value={p}>
                    {DIAGNOSIS_PLATFORM_LABELS[p]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="block text-sm font-medium text-[#0f172a] mb-2">
              提问原文 <span style={{ color: '#FF5C5C' }}>*</span>
            </label>
            <Input
              placeholder="例如：上海哪家火锅店好吃"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-[#0f172a] mb-2">
              品牌别名
              <span className="text-xs text-[#94a3b8] ml-2">
                用于识别品牌提及，自动带出品牌名
              </span>
            </label>
            <Input
              placeholder="品牌别名，逗号分隔（可选补充）"
              value={brandName}
              onChange={(e) => setBrandName(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-[#0f172a] mb-2">
              AI 回答原文 <span style={{ color: '#FF5C5C' }}>*</span>
            </label>
            <Textarea
              placeholder="粘贴 AI 平台的完整回答内容"
              value={rawAnswer}
              onChange={(e) => setRawAnswer(e.target.value)}
              className="min-h-[180px]"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            取消
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={createManualMutation.isPending}
          >
            {createManualMutation.isPending ? '提取分析中...' : '提取分析'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const ViewSnapshotDialog: React.FC<{
  result: CitationProbeResult | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}> = ({ result, open, onOpenChange }) => {
  if (!result) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[640px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>快照详情</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <div className="text-xs text-[#94a3b8] mb-1">提问原文</div>
            <div className="text-sm text-[#0f172a] font-medium">
              {result.question}
            </div>
          </div>

          <div className="flex items-center gap-6">
            <div>
              <div className="text-xs text-[#94a3b8] mb-1">平台</div>
              <Pill variant="muted">
                {DIAGNOSIS_PLATFORM_LABELS[result.platform]}
              </Pill>
            </div>
            <div>
              <div className="text-xs text-[#94a3b8] mb-1">是否提及</div>
              {result.isMentioned ? (
                <Pill variant="success">已提及</Pill>
              ) : (
                <Pill variant="muted">未提及</Pill>
              )}
            </div>
            <div>
              <div className="text-xs text-[#94a3b8] mb-1">提及位置</div>
              <div className="text-sm tnum text-[#0f172a]">
                {result.mentionPosition ? `第 ${result.mentionPosition} 位` : '—'}
              </div>
            </div>
          </div>

          <div>
            <div className="text-xs text-[#94a3b8] mb-2">
              引用信源 ({result.sourceUrls.length})
            </div>
            <div className="space-y-1 max-h-32 overflow-y-auto">
              {result.sourceUrls.length === 0 ? (
                <div className="text-sm text-[#94a3b8]">无</div>
              ) : (
                result.sourceUrls.map((url, i) => (
                  <div key={i} className="text-xs">
                    <UniversalLink
                      to={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline flex items-center gap-1 truncate"
                    >
                      <ExternalLink className="h-3 w-3 shrink-0" />
                      <span className="truncate">{url}</span>
                    </UniversalLink>
                  </div>
                ))
              )}
            </div>
          </div>

          <div>
            <div className="text-xs text-[#94a3b8] mb-2">原始回答快照</div>
            <div
              className="max-h-64 overflow-y-auto rounded-md border p-3 text-sm text-[#475569] whitespace-pre-wrap"
              style={{ borderColor: '#E5E9F2' }}
            >
              {result.rawAnswer || '无原始回答'}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            关闭
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const CitationMonitorPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [brandFilter, setBrandFilter] = useState('');
  const [platformFilter, setPlatformFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [keywordFilter, setKeywordFilter] = useState('');

  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [manualDialogOpen, setManualDialogOpen] = useState(false);
  const [viewResult, setViewResult] = useState<CitationProbeResult | null>(null);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);

  const { data: brands = [] } = useQuery({
    queryKey: ['brands-options'],
    queryFn: () => getBrands(),
    retry: false,
  });

  const effectiveBrandId = brandFilter || brands[0]?.id || '';

  const { data: kpi, isLoading: kpiLoading } = useKpi({
    brandId: effectiveBrandId || undefined,
    platform: platformFilter !== 'all' ? (platformFilter as DiagnosisPlatform) : undefined,
  });

  const { data: distribution = [], isLoading: distLoading } =
    usePlatformDistribution(effectiveBrandId || undefined);

  const { data: platformsStatus } = usePlatformsStatus();

  const { data: resultsData, isLoading: resultsLoading } = useResults({
    page: 1,
    pageSize: 20,
    brandId: effectiveBrandId || undefined,
    platform: platformFilter !== 'all' ? (platformFilter as DiagnosisPlatform) : undefined,
    status: statusFilter !== 'all' ? (statusFilter as any) : undefined,
    keyword: keywordFilter || undefined,
  });

  const deleteMutation = useDeleteResult();
  const executeMutation = useExecuteResult();

  const handleView = (r: CitationProbeResult) => {
    setViewResult(r);
    setViewDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (await showConfirm('确认删除该快照？')) {
      deleteMutation.mutate(id);
    }
  };

  const handleExecute = (r: CitationProbeResult) => {
    executeMutation.mutate(r.id);
  };

  const items = resultsData?.items ?? [];
  const total = resultsData?.total ?? 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <span className="text-sm text-[#64748b]">品牌</span>
          <Select value={brandFilter} onValueChange={setBrandFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="全部品牌" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">全部品牌</SelectItem>
              {brands.map((b) => (
                <SelectItem key={b.id} value={b.id}>
                  {b.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-sm text-[#64748b]">平台</span>
          <Select value={platformFilter} onValueChange={setPlatformFilter}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="全部平台" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部平台</SelectItem>
              {DIAGNOSIS_PLATFORMS.map((p) => (
                <SelectItem key={p} value={p}>
                  {DIAGNOSIS_PLATFORM_LABELS[p]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-sm text-[#64748b]">状态</span>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="全部状态" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部状态</SelectItem>
              <SelectItem value="pending">待执行</SelectItem>
              <SelectItem value="completed">已完成</SelectItem>
              <SelectItem value="failed">执行失败</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex-1" />

        <div className="relative w-[200px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94a3b8]" />
          <Input
            placeholder="搜索提问"
            value={keywordFilter}
            onChange={(e) => setKeywordFilter(e.target.value)}
            className="pl-9"
          />
        </div>

        <Button variant="outline" onClick={() => setManualDialogOpen(true)}>
          录入快照
        </Button>

        <Button onClick={() => setCreateDialogOpen(true)} data-ai-section-type="button">
          <Plus className="h-4 w-4" />
          新建探针任务
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {kpiLoading ? (
          <KpiCard label="已执行探针数" value={0} isLoading />
        ) : (
          <StatCard
            label="已执行探针数"
            value={kpi?.totalProbes ?? 0}
            unit="条"
          />
        )}
        <KpiCard
          label="品牌提及率"
          value={
            <div className="flex flex-col">
              <span style={{ color: ACCENT }}>
                {formatRate(kpi?.mentionRate ?? 0)}
              </span>
              <div
                className="mt-2 h-1.5 w-full rounded-full bg-[#E5E9F2] overflow-hidden"
              >
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${(kpi?.mentionRate ?? 0) * 100}%`,
                    backgroundColor: ACCENT,
                  }}
                />
              </div>
            </div>
          }
          isLoading={kpiLoading}
        />
        {kpiLoading ? (
          <KpiCard label="平均提及位置" value={0} isLoading />
        ) : (
          <StatCard
            label="平均提及位置"
            value={
              kpi?.avgPosition !== null && kpi?.avgPosition !== undefined
                ? `第 ${kpi.avgPosition} 位`
                : '—'
            }
          />
        )}
        {kpiLoading ? (
          <KpiCard label="被引用信源数" value={0} isLoading />
        ) : (
          <StatCard
            label="被引用信源数"
            value={kpi?.citedSourceCount ?? 0}
            unit="个独立来源"
          />
        )}
      </div>

      <PlatformDistributionChart
        data={distribution}
        isLoading={distLoading}
        platformsStatus={platformsStatus}
      />

      <SectionCard
        title="引用快照"
        count={total}
      >
        {resultsLoading ? (
          <ResultTableSkeleton />
        ) : items.length === 0 ? (
          <EmptyState
            icon={<Search />}
            description="还没有引用快照，先添加一个探针任务"
            action={
              <Button onClick={() => setCreateDialogOpen(true)}>
                <Plus className="h-4 w-4" />
                新建探针任务
              </Button>
            }
          />
        ) : (
          <DataTable
            rowKey="id"
            data={items}
            columns={[
              {
                key: 'question',
                title: '提问原文',
                width: '28%',
                render: (row: CitationProbeResult) => (
                  <span
                    className="text-[13px] text-[#0F172A] truncate block"
                    title={row.question}
                  >
                    {row.question}
                  </span>
                ),
              },
              {
                key: 'platform',
                title: '平台',
                width: '12%',
                render: (row: CitationProbeResult) => (
                  <Pill variant="muted">
                    {DIAGNOSIS_PLATFORM_LABELS[row.platform]}
                  </Pill>
                ),
              },
              {
                key: 'isMentioned',
                title: '是否提及',
                width: '12%',
                render: (row: CitationProbeResult) =>
                  row.isMentioned ? (
                    <Pill variant="success">已提及</Pill>
                  ) : (
                    <Pill variant="muted">未提及</Pill>
                  ),
              },
              {
                key: 'mentionPosition',
                title: '位置',
                width: '12%',
                render: (row: CitationProbeResult) => (
                  <span className="tabular-nums text-[13px] text-[#5B6B85]">
                    {row.mentionPosition ? `第 ${row.mentionPosition} 条` : '—'}
                  </span>
                ),
              },
              {
                key: 'sourceUrls',
                title: '引用信源',
                width: '14%',
                render: (row: CitationProbeResult) => (
                  <div className="group relative inline-block">
                    <span
                      className="tabular-nums cursor-pointer text-[13px] hover:underline"
                      style={{ color: PRIMARY }}
                    >
                      {row.sourceUrls.length} 个来源
                    </span>
                    {row.sourceUrls.length > 0 && (
                      <div className="invisible absolute z-10 left-0 top-full mt-1 w-80 max-h-48 overflow-y-auto rounded-md border border-[#E6EAF2] bg-white p-2 opacity-0 shadow-lg transition-opacity group-hover:visible group-hover:opacity-100">
                        {row.sourceUrls.map((url: string, i: number) => (
                          <div
                            key={i}
                            className="truncate py-1 text-xs hover:underline"
                            style={{ color: PRIMARY }}
                          >
                            <UniversalLink
                              to={url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-1"
                            >
                              <ExternalLink className="h-3 w-3 shrink-0" />
                              <span className="truncate">{url}</span>
                            </UniversalLink>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ),
              },
              {
                key: 'time',
                title: '时间',
                width: '12%',
                render: (row: CitationProbeResult) => (
                  <span className="text-[13px] text-[#5B6B85]">
                    {formatDate(row.executedAt ?? row.createdAt)}
                  </span>
                ),
              },
              {
                key: 'actions',
                title: '操作',
                width: '10%',
                align: 'right',
                render: (row: CitationProbeResult) => {
                  const connected = platformsStatus?.[row.platform]?.connected ?? false;
                  return (
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleView(row)}
                        aria-label="查看快照"
                      >
                        <Eye className="h-4 w-4" />
                        <span className="hidden sm:inline">查看</span>
                      </Button>
                      {row.status === 'pending' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={!connected}
                          onClick={() => handleExecute(row)}
                          title={
                            connected
                              ? '立即执行'
                              : '该平台未接入，请先配置接口或使用手工快照'
                          }
                          aria-label="立即执行"
                        >
                          <Play className="h-4 w-4" />
                          <span className="hidden sm:inline">执行</span>
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(row.id)}
                        aria-label="删除"
                        style={{ color: '#EF4444' }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  );
                },
              },
            ]}
          />
        )}
      </SectionCard>

      <CreateTaskDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        platformsStatus={platformsStatus}
      />
      <ManualSnapshotDialog
        open={manualDialogOpen}
        onOpenChange={setManualDialogOpen}
      />
      <ViewSnapshotDialog
        result={viewResult}
        open={viewDialogOpen}
        onOpenChange={setViewDialogOpen}
      />
    </div>
  );
};

export default CitationMonitorPage;
