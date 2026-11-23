import React, { useState, useEffect, useCallback } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import {
  Card,
  CardContent,
} from '@client/src/components/ui/card';
import { Button } from '@client/src/components/ui/button';
import { Input } from '@client/src/components/ui/input';
import { Textarea } from '@client/src/components/ui/textarea';
import { Badge } from '@client/src/components/ui/badge';
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
import { Skeleton } from '@client/src/components/ui/skeleton';
import {
  ArrowRight,
  ArrowLeft,
  Plus,
  X,
  Check,
  Search,
  RefreshCw,
  Trash2,
  Pencil,
} from 'lucide-react';
import { getBrands } from '@client/src/api/brands';
import {
  createDiagnosisTask,
  runDiagnosis,
  getDiagnosisTask,
  generateQuestionScenarios,
  getRecommendQuota,
  getDiagnosisCreditInfo,
} from '@client/src/api/diagnosis';
import {
  DIAGNOSIS_PLATFORMS,
  DIAGNOSIS_PLATFORM_LABELS,
  DIAGNOSIS_QUESTION_TYPES,
  DIAGNOSIS_QUESTION_TYPE_LABELS,
} from '@shared/api.interface';
import type {
  DiagnosisPlatform,
  DiagnosisQuestionScenario,
  DiagnosisQuestionType,
} from '@shared/api.interface';
import { getApiErrorMessage, isAiQuotaError } from '@client/src/lib/api-error';
import { logger } from '@lark-apaas/client-toolkit/logger';

const PRIMARY = '#3B5BFF';
const DRAFT_KEY = 'geo_diagnosis_draft';

const STEPS = ['基础信息设置', '配置确认', '查询确认'];

/* ---------- 公用：区块标题 ---------- */
const SectionTitle: React.FC<{ label: string; required?: boolean }> = ({
  label,
  required,
}) => (
  <div className="flex items-center gap-2">
    <span
      className="inline-block h-4 w-1 rounded-sm"
      style={{ backgroundColor: PRIMARY }}
    />
    <span className="text-[14px] font-semibold" style={{ color: '#0f172a' }}>
      {label}
    </span>
    {required && <span style={{ color: '#FF5C5C' }}>*</span>}
  </div>
);

/* ---------- 步骤条 ---------- */
const StepBar: React.FC<{ step: number }> = ({ step }) => (
  <div className="mb-6 flex items-center justify-center">
    {STEPS.map((s, i) => {
      const done = i < step;
      const active = i === step;
      return (
        <React.Fragment key={s}>
          <div className="flex items-center">
            <div
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold"
              style={{
                backgroundColor: done || active ? PRIMARY : '#e2e8f0',
                color: done || active ? '#fff' : '#94a3b8',
              }}
            >
              {done ? <Check className="h-4 w-4" /> : i + 1}
            </div>
            <span
              className="ml-2 text-sm font-medium whitespace-nowrap"
              style={{
                color: done || active ? '#0f172a' : '#94a3b8',
              }}
            >
              第{i + 1 === 1 ? '一' : i + 1 === 2 ? '二' : '三'}步：{s}
            </span>
          </div>
          {i < STEPS.length - 1 && (
            <div
              className="mx-4 h-px w-16 shrink-0"
              style={{ backgroundColor: done ? PRIMARY : '#e2e8f0' }}
            />
          )}
        </React.Fragment>
      );
    })}
  </div>
);

/* ================================================================ */

const DiagnosisCreatePage: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  /* ---------- 数据状态 ---------- */
  const [step, setStep] = useState(0);

  const [brandId, setBrandId] = useState<string>('');
  const [brandName, setBrandName] = useState('');
  const [brandAliases, setBrandAliases] = useState<string[]>([]);
  const [aliasInput, setAliasInput] = useState('');
  const [brandIntro, setBrandIntro] = useState('');
  const [products, setProducts] = useState<{ name: string }[]>([
    { name: '' },
  ]);
  const [competitorInput, setCompetitorInput] = useState('');
  const [competitors, setCompetitors] = useState<string[]>([]);
  const [city, setCity] = useState('');
  const [category, setCategory] = useState('');
  const [website, setWebsite] = useState('');
  const [platforms, setPlatforms] = useState<DiagnosisPlatform[]>([...DIAGNOSIS_PLATFORMS]);

  const [activeProductTab, setActiveProductTab] = useState(0);
  const [scenariosByProduct, setScenariosByProduct] = useState<
    DiagnosisQuestionScenario[][]
  >([]);

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [usedRecommendCount, setUsedRecommendCount] = useState(0);

  // 编辑/添加场景弹窗
  const [scenarioDialogOpen, setScenarioDialogOpen] = useState(false);
  const [editingScenarioIdx, setEditingScenarioIdx] = useState<number | null>(
    null,
  );
  const [scenarioForm, setScenarioForm] = useState({
    userProfile: '',
    searchScenario: '',
    sampleQuestion: '',
    questionType: '口碑' as DiagnosisQuestionType,
  });

  /* ---------- 草稿持久化 ---------- */
  // 挂载时读取草稿
  useEffect(() => {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (raw) {
        const draft = JSON.parse(raw);
        if (draft.brandId !== undefined) setBrandId(draft.brandId);
        if (draft.brandName !== undefined) setBrandName(draft.brandName);
        if (draft.brandAliases) setBrandAliases(draft.brandAliases);
        if (draft.brandIntro !== undefined) setBrandIntro(draft.brandIntro);
        if (draft.products) setProducts(draft.products);
        if (draft.competitors) setCompetitors(draft.competitors);
        if (draft.city !== undefined) setCity(draft.city);
        if (draft.category !== undefined) setCategory(draft.category);
        if (draft.website !== undefined) setWebsite(draft.website);
        if (draft.platforms) setPlatforms(draft.platforms);
        if (draft.scenariosByProduct) setScenariosByProduct(draft.scenariosByProduct);
        if (typeof draft.usedRecommendCount === 'number') {
          setUsedRecommendCount(draft.usedRecommendCount);
        }
      }
    } catch (e) {
      // 静默忽略解析错误
    }
  }, []);

  // 保存草稿
  const saveDraft = useCallback(() => {
    try {
      const draft = {
        brandId,
        brandName,
        brandAliases,
        brandIntro,
        products,
        competitors,
        city,
        category,
        website,
        platforms,
        scenariosByProduct,
        usedRecommendCount,
      };
      localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
    } catch (e) {
      // 静默忽略
    }
  }, [
    brandId,
    brandName,
    brandAliases,
    brandIntro,
    products,
    competitors,
    city,
    category,
    website,
    platforms,
    scenariosByProduct,
    usedRecommendCount,
  ]);

  // 关键字段变化时自动保存
  useEffect(() => {
    saveDraft();
  }, [saveDraft]);

  /* ---------- 品牌列表 ---------- */
  const { data: brandOptions = [] } = useQuery({
    queryKey: ['brands', 'options'],
    queryFn: () => getBrands(),
  });

  /* ---------- 推荐额度 ---------- */
  const { data: quota, refetch: refetchQuota } = useQuery({
    queryKey: ['diagnosis', 'recommend-quota', brandId],
    queryFn: () => getRecommendQuota(brandId || undefined),
    enabled: false, // 进入第二步时再取
  });

  useEffect(() => {
    if (quota && quota.used > usedRecommendCount) {
      setUsedRecommendCount(quota.used);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quota]);

  /* ---------- 算力信息 ---------- */
  const { data: creditInfo, refetch: refetchCreditInfo } = useQuery({
    queryKey: ['diagnosis', 'credit-info', brandId],
    queryFn: () => getDiagnosisCreditInfo(brandId || undefined),
    enabled: false, // 进入第三步时再取
  });

  /* ---------- 生成场景 mutation ---------- */
  const genScenariosMutation = useMutation({
    mutationFn: (productIdx: number) => {
      const productName = products[productIdx]?.name.trim();
      return generateQuestionScenarios({
        productName,
        brandName: brandName.trim(),
        city: city.trim(),
        category: category.trim(),
        brandId: brandId || undefined,
      });
    },
    retry: false,
    onSuccess: (data, variables) => {
      setScenariosByProduct((prev) => {
        const next = [...prev];
        const existing = next[variables] ?? [];
        const existingQuestions = new Set(existing.map((s) => s.sampleQuestion));
        const newScenarios = data.scenarios.filter(
          (s: DiagnosisQuestionScenario) => !existingQuestions.has(s.sampleQuestion),
        );
        next[variables] = [...existing, ...newScenarios];
        return next;
      });
      setUsedRecommendCount((prev) => prev + 1);
      refetchQuota();
    },
    onError: (err: unknown) => {
      const msg = getApiErrorMessage(err, '生成查询场景失败');
      if (!isAiQuotaError(err)) {
        toast.error(msg);
      }
    },
  });

  /* ---------- 创建任务 mutation ---------- */
  const createMutation = useMutation({
    mutationFn: createDiagnosisTask,
    retry: false,
    onError: (err: unknown) => {
      const msg = getApiErrorMessage(err, '创建任务失败');
      toast.error(msg);
    },
  });

  /* ---------- 运行诊断 mutation + 轮询 ---------- */
  const runMutation = useMutation({
    mutationFn: ({
      taskId,
      questions,
    }: {
      taskId: string;
      questions: string[];
    }) => runDiagnosis(taskId, { questions }),
    retry: false,
    onError: (err: unknown) => {
      logger.error('诊断启动失败', err);
      toast.error(getApiErrorMessage(err, '诊断启动失败'));
      setSubmitting(false);
    },
  });

  const [runTaskId, setRunTaskId] = useState<string | null>(null);
  const [runStatus, setRunStatus] = useState<
    'idle' | 'running' | 'success' | 'error'
  >('idle');

  useEffect(() => {
    if (runStatus !== 'running' || !runTaskId) return;
    let cancelled = false;

    const poll = async () => {
      try {
        const task = await getDiagnosisTask(runTaskId);
        if (cancelled) return;
        if (task.status === 'completed') {
          setRunStatus('success');
          queryClient.invalidateQueries({ queryKey: ['diagnosis', 'tasks'] });
          toast.success('诊断已完成');
          localStorage.removeItem(DRAFT_KEY);
          navigate('/diagnosis?tab=reports');
          return;
        }
        if (task.status === 'failed') {
          setRunStatus('error');
          setSubmitting(false);
          toast.error(task.error || '诊断执行失败');
          return;
        }
        setTimeout(poll, 3000);
      } catch (err: unknown) {
        if (cancelled) return;
        logger.error('轮询诊断状态失败', err);
        setTimeout(poll, 3000);
      }
    };
    poll();

    return () => {
      cancelled = true;
    };
  }, [runStatus, runTaskId, navigate, queryClient]);

  /* ================================================================ */
  /*                         事件处理：第一步                           */
  /* ================================================================ */

  const handleBrandChange = (value: string) => {
    setBrandId(value);
    const brand = brandOptions.find((b) => b.id === value);
    if (brand) {
      setBrandName(brand.name);
    }
  };

  // 品牌简称
  const addAlias = () => {
    const name = aliasInput.trim();
    if (!name) return;
    if (brandAliases.length >= 10) {
      toast.warning('最多添加 10 个品牌简称');
      return;
    }
    if (name.length > 30) {
      toast.warning('单个简称不超过 30 字');
      return;
    }
    if (brandAliases.includes(name)) {
      setAliasInput('');
      return;
    }
    setBrandAliases([...brandAliases, name]);
    setAliasInput('');
  };

  const removeAlias = (name: string) => {
    setBrandAliases(brandAliases.filter((a) => a !== name));
  };

  // 产品
  const addProduct = () => {
    if (products.length >= 5) {
      toast.warning('最多添加 5 个产品');
      return;
    }
    setProducts([...products, { name: '' }]);
  };

  const updateProduct = (idx: number, name: string) => {
    const next = [...products];
    next[idx] = { name };
    setProducts(next);
  };

  const removeProduct = (idx: number) => {
    if (products.length <= 1) {
      toast.warning('至少保留 1 个产品');
      return;
    }
    const next = products.filter((_, i) => i !== idx);
    setProducts(next);
    // 同步 scenario 数组
    setScenariosByProduct((prev) => prev.filter((_, i) => i !== idx));
    if (activeProductTab >= next.length) {
      setActiveProductTab(Math.max(0, next.length - 1));
    }
  };

  // 竞品
  const addCompetitor = () => {
    const name = competitorInput.trim();
    if (!name) return;
    if (competitors.length >= 3) {
      toast.warning('最多添加 3 个竞品品牌');
      return;
    }
    if (competitors.includes(name)) {
      setCompetitorInput('');
      return;
    }
    setCompetitors([...competitors, name]);
    setCompetitorInput('');
  };

  const removeCompetitor = (name: string) => {
    setCompetitors(competitors.filter((c) => c !== name));
  };

  const validateStep1 = (): boolean => {
    const next: Record<string, string> = {};
    if (!brandName.trim()) next.brandName = '请输入品牌/公司全称';
    if (brandAliases.length === 0) next.brandAliases = '请至少添加 1 个品牌简称';
    if (!brandIntro.trim()) next.brandIntro = '请输入品牌介绍';
    if (brandIntro.length > 300)
      next.brandIntro = '品牌介绍不超过 300 字';
    const validProducts = products.filter((p) => p.name.trim());
    if (validProducts.length === 0) next.products = '请至少添加 1 个产品';
    if (competitors.length === 0) next.competitors = '请至少添加 1 个竞品';
    if (!city.trim()) next.city = '请输入城市/区域';
    if (!category.trim()) next.category = '请输入品类/主营';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const goToStep2 = () => {
    if (!validateStep1()) return;

    // 对齐 scenariosByProduct 长度
    const validProductCount = products.filter((p) => p.name.trim()).length;
    if (validProductCount === 0) return;

    setScenariosByProduct((prev) => {
      const next: DiagnosisQuestionScenario[][] = [];
      for (let i = 0; i < products.length; i += 1) {
        next.push(prev[i] ?? []);
      }
      return next;
    });

    if (activeProductTab >= products.length) {
      setActiveProductTab(Math.max(0, products.length - 1));
    }

    // 拉取额度
    refetchQuota();
    setStep(1);
  };

  /* ================================================================ */
  /*                         事件处理：第二步                           */
  /* ================================================================ */

  // 进入第二步后，若第一个产品无场景则自动生成
  useEffect(() => {
    if (step !== 1) return;
    const idx = activeProductTab;
    const productName = products[idx]?.name.trim();
    if (!productName) return;
    if (
      scenariosByProduct[idx] &&
      scenariosByProduct[idx].length > 0
    )
      return;
    // 避免重复触发
    if (genScenariosMutation.isPending) return;
    genScenariosMutation.mutate(idx);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, activeProductTab, products.length]);

  const togglePlatform = (p: DiagnosisPlatform) => {
    setPlatforms((prev) =>
      prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p],
    );
  };

  const selectAllPlatforms = () => {
    setPlatforms([...DIAGNOSIS_PLATFORMS]);
  };

  const clearAllPlatforms = () => {
    setPlatforms([]);
  };

  const handleRecommend = () => {
    const productName = products[activeProductTab]?.name.trim();
    if (!productName) {
      toast.warning('请先填写产品名称');
      return;
    }
    const limit = quota?.limit ?? 20;
    if (usedRecommendCount >= limit) {
      toast.warning('今日推荐次数已用完');
      return;
    }
    genScenariosMutation.mutate(activeProductTab);
  };

  // 场景增删改
  const openAddScenario = () => {
    setEditingScenarioIdx(null);
    setScenarioForm({
      userProfile: '',
      searchScenario: '',
      sampleQuestion: '',
      questionType: '口碑',
    });
    setScenarioDialogOpen(true);
  };

  const openEditScenario = (idx: number) => {
    const s = scenariosByProduct[activeProductTab]?.[idx];
    if (!s) return;
    setEditingScenarioIdx(idx);
    setScenarioForm({
      userProfile: s.userProfile,
      searchScenario: s.searchScenario,
      sampleQuestion: s.sampleQuestion,
      questionType: s.questionType,
    });
    setScenarioDialogOpen(true);
  };

  const saveScenario = () => {
    if (!scenarioForm.userProfile.trim()) {
      toast.error('请填写用户画像');
      return;
    }
    if (!scenarioForm.searchScenario.trim()) {
      toast.error('请填写搜索场景');
      return;
    }
    if (!scenarioForm.sampleQuestion.trim()) {
      toast.error('请填写示例问题');
      return;
    }
    setScenariosByProduct((prev) => {
      const next = [...prev];
      const current = [...(next[activeProductTab] ?? [])];
      if (editingScenarioIdx === null) {
        current.push({
          id: `local_${Date.now()}`,
          ...scenarioForm,
        });
      } else {
        current[editingScenarioIdx] = {
          ...current[editingScenarioIdx],
          ...scenarioForm,
        };
      }
      next[activeProductTab] = current;
      return next;
    });
    setScenarioDialogOpen(false);
  };

  const removeScenario = (idx: number) => {
    setScenariosByProduct((prev) => {
      const next = [...prev];
      next[activeProductTab] = (next[activeProductTab] ?? []).filter(
        (_, i) => i !== idx,
      );
      return next;
    });
  };

  const totalScenarios = scenariosByProduct.reduce(
    (sum, arr) => sum + (arr?.length ?? 0),
    0,
  );

  const validateStep2 = (): boolean => {
    if (platforms.length === 0) {
      toast.error('请至少选择 1 个 AI 平台');
      return false;
    }
    if (totalScenarios === 0) {
      toast.error('请至少添加 1 条查询场景');
      return false;
    }
    return true;
  };

  const goToStep3 = () => {
    if (!validateStep2()) return;
    refetchCreditInfo();
    setStep(2);
  };

  /* ================================================================ */
  /*                         事件处理：第三步                           */
  /* ================================================================ */

  const totalQueries = totalScenarios * platforms.length;
  const balance = creditInfo?.balance ?? 0;
  const unitPrice = creditInfo?.unitPricePerQuery ?? 0;
  const totalCost = totalQueries * unitPrice;
  const balanceInsufficient = creditInfo ? balance < totalCost : false;

  const handleConfirmAndRun = async () => {
    if (balanceInsufficient) return;
    setSubmitting(true);

    try {
      const validProducts = products
        .filter((p) => p.name.trim())
        .map((p) => ({ name: p.name.trim() }));

      const task = await createMutation.mutateAsync({
        brandId: brandId || undefined,
        brandName: brandName.trim(),
        city: city.trim(),
        category: category.trim(),
        platforms,
        competitors,
        website: website.trim() || undefined,
        brandAliases,
        brandIntro: brandIntro.trim(),
        products: validProducts,
      });

      // 收集所有场景的 sampleQuestion
      const allQuestions: string[] = [];
      for (const arr of scenariosByProduct) {
        if (arr) {
          for (const s of arr) {
            if (s.sampleQuestion.trim()) {
              allQuestions.push(s.sampleQuestion.trim());
            }
          }
        }
      }

      setRunTaskId(task.id);
      setRunStatus('running');
      await runMutation.mutateAsync({
        taskId: task.id,
        questions: allQuestions,
      });
    } catch {
      setSubmitting(false);
    }
  };

  /* ================================================================ */
  /*                              渲染                                 */
  /* ================================================================ */

  return (
    <div className="max-w-3xl mx-auto py-8">
      <StepBar step={step} />

      <Card
        style={{
          borderRadius: '12px',
          borderColor: '#E5E9F2',
        }}
      >
        <CardContent className="pt-6">
          {/* ============ 第一步 ============ */}
          {step === 0 && (
            <div className="space-y-4">
              {/* 关联品牌 */}
              <div
                className="rounded-lg p-3"
                style={{ backgroundColor: '#F7F9FC' }}
              >
                <SectionTitle label="关联品牌" />
                <div className="mt-2">
                  <Select value={brandId} onValueChange={handleBrandChange}>
                    <SelectTrigger className="h-9 w-full bg-white">
                      <SelectValue placeholder="选择已有品牌（选填）" />
                    </SelectTrigger>
                    <SelectContent>
                      {brandOptions.map((b) => (
                        <SelectItem key={b.id} value={b.id}>
                          {b.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="mt-1 text-xs" style={{ color: '#64748b' }}>
                    选择品牌后将自动带出品牌名称等信息，没有品牌也可以直接填写
                  </p>
                </div>
              </div>

              {/* 品牌/公司全称 */}
              <div
                className="rounded-lg p-3"
                style={{ backgroundColor: '#F7F9FC' }}
              >
                <SectionTitle label="品牌/公司全称" required />
                <div className="mt-2">
                  <Input
                    value={brandName}
                    onChange={(e) => setBrandName(e.target.value)}
                    placeholder="请输入品牌/公司全称"
                    className="h-9 bg-white"
                  />
                  {errors.brandName && (
                    <p className="mt-1 text-xs text-red-500">
                      {errors.brandName}
                    </p>
                  )}
                </div>
              </div>

              {/* 品牌简称 */}
              <div
                className="rounded-lg p-3"
                style={{ backgroundColor: '#F7F9FC' }}
              >
                <SectionTitle label="品牌简称" required />
                <div className="mt-2 flex gap-2">
                  <Input
                    value={aliasInput}
                    onChange={(e) => setAliasInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        addAlias();
                      }
                    }}
                    placeholder="输入品牌简称，回车添加"
                    className="h-9 bg-white"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addAlias}
                    className="h-9"
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {brandAliases.map((a) => (
                    <Badge
                      key={a}
                      variant="secondary"
                      className="flex items-center gap-1 px-3 py-1"
                    >
                      {a}
                      <button
                        type="button"
                        onClick={() => removeAlias(a)}
                        className="ml-1 hover:text-red-500"
                        aria-label={`删除 ${a}`}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
                <p className="mt-1 text-xs" style={{ color: '#64748b' }}>
                  最多添加 10 个，回车确认
                </p>
                {errors.brandAliases && (
                  <p className="mt-1 text-xs text-red-500">
                    {errors.brandAliases}
                  </p>
                )}
              </div>

              {/* 品牌介绍 */}
              <div
                className="rounded-lg p-3"
                style={{ backgroundColor: '#F7F9FC' }}
              >
                <SectionTitle label="品牌介绍" required />
                <div className="mt-2 relative">
                  <Textarea
                    value={brandIntro}
                    onChange={(e) => {
                      if (e.target.value.length <= 300) {
                        setBrandIntro(e.target.value);
                      } else {
                        setBrandIntro(e.target.value.slice(0, 300));
                      }
                    }}
                    placeholder="请输入品牌介绍，最多 300 字"
                    className="min-h-[72px] bg-white resize-none"
                  />
                  <div
                    className="absolute bottom-2 right-3 text-xs"
                    style={{ color: '#64748b' }}
                  >
                    {brandIntro.length}/300
                  </div>
                </div>
                {errors.brandIntro && (
                  <p className="mt-1 text-xs text-red-500">
                    {errors.brandIntro}
                  </p>
                )}
              </div>

              {/* 产品 */}
              <div
                className="rounded-lg p-3"
                style={{ backgroundColor: '#F7F9FC' }}
              >
                <SectionTitle label="产品" required />
                <div className="mt-2 space-y-2">
                  {products.map((p, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <Input
                        value={p.name}
                        onChange={(e) => updateProduct(idx, e.target.value)}
                        placeholder={`产品 ${idx + 1}`}
                        className="h-9 bg-white"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={() => removeProduct(idx)}
                        className="h-9 w-9 shrink-0"
                        aria-label="删除产品"
                      >
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </div>
                  ))}
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addProduct}
                  className="mt-2 h-8"
                >
                  <Plus className="h-4 w-4" />
                  新增产品
                </Button>
                {errors.products && (
                  <p className="mt-1 text-xs text-red-500">
                    {errors.products}
                  </p>
                )}
              </div>

              {/* 竞品 */}
              <div
                className="rounded-lg p-3"
                style={{ backgroundColor: '#F7F9FC' }}
              >
                <SectionTitle label="竞品" required />
                <div className="mt-2 flex gap-2">
                  <Input
                    value={competitorInput}
                    onChange={(e) => setCompetitorInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        addCompetitor();
                      }
                    }}
                    placeholder="输入竞品品牌名，回车添加"
                    className="h-9 bg-white"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addCompetitor}
                    className="h-9"
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {competitors.map((c) => (
                    <Badge
                      key={c}
                      variant="secondary"
                      className="flex items-center gap-1 px-3 py-1"
                    >
                      {c}
                      <button
                        type="button"
                        onClick={() => removeCompetitor(c)}
                        className="ml-1 hover:text-red-500"
                        aria-label={`删除 ${c}`}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
                <p className="mt-1 text-xs" style={{ color: '#64748b' }}>
                  至少 1 个，最多 3 个
                </p>
                {errors.competitors && (
                  <p className="mt-1 text-xs text-red-500">
                    {errors.competitors}
                  </p>
                )}
              </div>

              {/* 城市 + 品类 */}
              <div
                className="rounded-lg p-3"
                style={{ backgroundColor: '#F7F9FC' }}
              >
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <SectionTitle label="城市/区域" required />
                    <div className="mt-2">
                      <Input
                        value={city}
                        onChange={(e) => setCity(e.target.value)}
                        placeholder="如：北京"
                        className="h-9 bg-white"
                      />
                      {errors.city && (
                        <p className="mt-1 text-xs text-red-500">
                          {errors.city}
                        </p>
                      )}
                    </div>
                  </div>
                  <div>
                    <SectionTitle label="品类/主营" required />
                    <div className="mt-2">
                      <Input
                        value={category}
                        onChange={(e) => setCategory(e.target.value)}
                        placeholder="如：蛋糕、烘焙"
                        className="h-9 bg-white"
                      />
                      {errors.category && (
                        <p className="mt-1 text-xs text-red-500">
                          {errors.category}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* 官网地址 */}
              <div
                className="rounded-lg p-3"
                style={{ backgroundColor: '#F7F9FC' }}
              >
                <SectionTitle label="官网地址" />
                <div className="mt-2">
                  <Input
                    type="url"
                    value={website}
                    onChange={(e) => setWebsite(e.target.value)}
                    placeholder="https://example.com"
                    className="h-9 bg-white"
                  />
                </div>
              </div>

              {/* 下一步按钮 */}
              <div className="pt-2">
                <Button
                  type="button"
                  className="w-full h-10"
                  style={{ backgroundColor: PRIMARY }}
                  onClick={goToStep2}
                >
                  下一步：配置确认
                  <ArrowRight className="ml-1 h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          {/* ============ 第二步 ============ */}
          {step === 1 && (
            <div className="space-y-5">
              {/* 顶部横条 */}
              <div
                className="rounded-lg p-4"
                style={{ backgroundColor: '#F7F9FC' }}
              >
                <p className="text-sm" style={{ color: '#0f172a' }}>
                  本次诊断共覆盖{' '}
                  <span
                    className="font-semibold"
                    style={{ color: PRIMARY }}
                  >
                    {products.filter((p) => p.name.trim()).length}
                  </span>{' '}
                  个产品词、{' '}
                  <span
                    className="font-semibold"
                    style={{ color: PRIMARY }}
                  >
                    {totalScenarios}
                  </span>{' '}
                  个查询场景
                </p>
              </div>

              {/* 选择查询的 AI 平台 */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h4
                    className="text-[14px] font-semibold"
                    style={{ color: '#0f172a' }}
                  >
                    选择查询的 AI 平台
                  </h4>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      className="text-xs font-medium"
                      style={{ color: PRIMARY }}
                      onClick={selectAllPlatforms}
                    >
                      全选
                    </button>
                    <button
                      type="button"
                      className="text-xs font-medium"
                      style={{ color: '#64748b' }}
                      onClick={clearAllPlatforms}
                    >
                      清空
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-3 min-[900px]:grid-cols-6 gap-3">
                  {DIAGNOSIS_PLATFORMS.map((p) => {
                    const selected = platforms.includes(p);
                    return (
                      <div
                        key={p}
                        role="checkbox"
                        aria-checked={selected}
                        className="relative cursor-pointer rounded-lg p-4 text-center transition-all"
                        style={{
                          border: selected
                            ? `2px solid ${PRIMARY}`
                            : '1px solid #E5E9F2',
                          backgroundColor: '#fff',
                          borderRadius: '8px',
                        }}
                        onClick={() => togglePlatform(p)}
                      >
                        {selected && (
                          <div
                            className="absolute -top-[1px] -right-[1px] flex h-5 w-5 items-center justify-center rounded-bl-lg rounded-tr-[7px]"
                            style={{ backgroundColor: PRIMARY }}
                          >
                            <Check className="h-3 w-3 text-white" />
                          </div>
                        )}
                        <span
                          className="text-sm font-medium"
                          style={{
                            color: selected ? PRIMARY : '#0f172a',
                          }}
                        >
                          {DIAGNOSIS_PLATFORM_LABELS[p]}
                        </span>
                        <div
                          className="mt-1.5 text-[10px] font-medium"
                          style={{
                            color: p === 'doubao' ? '#17C964' : '#94a3b8',
                          }}
                        >
                          {p === 'doubao' ? '已接入' : '未接入'}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* 产品 tab + 场景表 */}
              <div>
                <h4
                  className="text-[14px] font-semibold mb-3"
                  style={{ color: '#0f172a' }}
                >
                  查询场景
                </h4>

                {/* 产品 tab */}
                <div className="flex flex-wrap gap-1 border-b mb-0">
                  {products.map((p, idx) => {
                    if (!p.name.trim()) return null;
                    const active = idx === activeProductTab;
                    return (
                      <button
                        key={idx}
                        type="button"
                        className="px-3 py-2 text-sm font-medium relative -mb-px"
                        style={{
                          color: active ? PRIMARY : '#64748b',
                          borderBottom: active
                            ? `2px solid ${PRIMARY}`
                            : '2px solid transparent',
                        }}
                        onClick={() => setActiveProductTab(idx)}
                      >
                        {p.name}
                        <span
                          className="ml-1 text-xs"
                          style={{ color: '#94a3b8' }}
                        >
                          ({scenariosByProduct[idx]?.length ?? 0})
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* 场景表格 */}
                <div className="overflow-x-auto border border-t-0 rounded-b-lg">
                  {genScenariosMutation.isPending &&
                  scenariosByProduct[activeProductTab]?.length === 0 ? (
                    <div className="p-4 space-y-2">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Skeleton key={i} className="h-8 w-full rounded-md" />
                      ))}
                    </div>
                  ) : (
                    <table className="text-sm" style={{ minWidth: '960px', tableLayout: 'auto' }}>
                      <thead style={{ backgroundColor: '#F7F9FC' }}>
                        <tr>
                          <th
                            className="px-3 py-2 text-left font-medium whitespace-nowrap"
                            style={{ color: '#64748b', width: '56px', minWidth: '56px' }}
                          >
                            序号
                          </th>
                          <th
                            className="px-3 py-2 text-left font-medium"
                            style={{ color: '#64748b', width: '190px', minWidth: '190px' }}
                          >
                            用户画像
                          </th>
                          <th
                            className="px-3 py-2 text-left font-medium"
                            style={{ color: '#64748b', width: '240px', minWidth: '240px' }}
                          >
                            搜索场景
                          </th>
                          <th
                            className="px-3 py-2 text-left font-medium"
                            style={{ color: '#64748b', width: '300px', minWidth: '300px' }}
                          >
                            示例问题
                          </th>
                          <th
                            className="px-3 py-2 text-left font-medium whitespace-nowrap"
                            style={{ color: '#64748b', width: '90px', minWidth: '90px' }}
                          >
                            问题类型
                          </th>
                          <th
                            className="px-3 py-2 text-left font-medium whitespace-nowrap"
                            style={{ color: '#64748b', width: '84px', minWidth: '84px' }}
                          >
                            操作
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {(
                          scenariosByProduct[activeProductTab] ?? []
                        ).map((s, idx) => (
                          <tr
                            key={s.id}
                            className="border-t"
                            style={{ borderColor: '#E5E9F2' }}
                          >
                            <td className="px-3 py-2 text-xs">{idx + 1}</td>
                            <td className="px-3 py-2 text-xs">
                              {s.userProfile}
                            </td>
                            <td className="px-3 py-2 text-xs">
                              {s.searchScenario}
                            </td>
                            <td className="px-3 py-2 text-xs">
                              {s.sampleQuestion}
                            </td>
                            <td className="px-3 py-2 text-xs">
                              {
                                DIAGNOSIS_QUESTION_TYPE_LABELS[
                                  s.questionType
                                ]
                              }
                            </td>
                            <td className="px-3 py-2 text-xs">
                              <div className="flex gap-2">
                                <button
                                  type="button"
                                  onClick={() => openEditScenario(idx)}
                                  style={{ color: PRIMARY }}
                                  className="hover:underline"
                                  aria-label={`编辑第 ${idx + 1} 条场景`}
                                >
                                  <Pencil className="h-3.5 w-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => removeScenario(idx)}
                                  className="text-red-500 hover:text-red-600"
                                  aria-label={`删除第 ${idx + 1} 条场景`}
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                        {(scenariosByProduct[activeProductTab] ?? [])
                          .length === 0 && (
                          <tr>
                            <td
                              colSpan={6}
                              className="px-3 py-8 text-center text-xs"
                              style={{ color: '#94a3b8' }}
                            >
                              暂无查询场景，点击「继续推荐」生成或手动添加
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  )}
                </div>

                {/* 表格下方按钮 */}
                <div className="flex items-center justify-between mt-3">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={openAddScenario}
                    className="h-8"
                  >
                    <Plus className="h-4 w-4" />
                    手动添加
                  </Button>
                  <div className="flex items-center gap-3">
                    <span className="text-xs" style={{ color: '#64748b' }}>
                      剩余推荐次数：{usedRecommendCount}/{quota?.limit ?? 20}
                    </span>
                    <Button
                      type="button"
                      size="sm"
                      onClick={handleRecommend}
                      disabled={
                        genScenariosMutation.isPending ||
                        usedRecommendCount >= (quota?.limit ?? 20)
                      }
                      className="h-8"
                      style={{
                        backgroundColor: usedRecommendCount >= (quota?.limit ?? 20)
                          ? '#94a3b8'
                          : PRIMARY,
                      }}
                    >
                      <RefreshCw
                        className={`h-3.5 w-3.5 ${genScenariosMutation.isPending ? 'animate-spin' : ''}`}
                      />
                      继续推荐
                    </Button>
                  </div>
                </div>
              </div>

              {/* 底部按钮 */}
              <div className="flex gap-3 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setStep(0)}
                  className="flex-1 h-10"
                >
                  <ArrowLeft className="mr-1 h-4 w-4" />
                  上一步
                </Button>
                <Button
                  type="button"
                  className="flex-1 h-10"
                  style={{ backgroundColor: PRIMARY }}
                  onClick={goToStep3}
                >
                  下一步：查询确认
                  <ArrowRight className="ml-1 h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          {/* ============ 第三步 ============ */}
          {step === 2 && (
            <div className="py-4">
              {/* 标题区 */}
              <div className="text-center mb-6">
                <div
                  className="mx-auto flex h-12 w-12 items-center justify-center rounded-full mb-3"
                  style={{ backgroundColor: 'rgba(59, 91, 255, 0.1)' }}
                >
                  <Search
                    className="h-6 w-6"
                    style={{ color: PRIMARY }}
                  />
                </div>
                <h2
                  className="text-lg font-semibold"
                  style={{ color: '#0f172a' }}
                >
                  确认诊断信息
                </h2>
                <p
                  className="mt-2 text-sm max-w-md mx-auto"
                  style={{ color: '#64748b' }}
                >
                  系统将向选定的 AI 平台发起查询，分析品牌在 AI 搜索中的可见度与信源覆盖情况。
                </p>
              </div>

              {/* 四指标 */}
              <div className="grid grid-cols-4 gap-3 mb-5">
                {[
                  {
                    value: products.filter((p) => p.name.trim()).length,
                    label: '产品词',
                  },
                  { value: totalScenarios, label: '查询场景' },
                  { value: `${platforms.length}/${DIAGNOSIS_PLATFORMS.length}`, label: '已覆盖平台' },
                  { value: totalQueries, label: '查询次数' },
                ].map((item, i) => (
                  <div
                    key={i}
                    className="rounded-lg text-center p-3"
                    style={{ backgroundColor: '#F7F9FC' }}
                  >
                    <div
                      className="text-[20px] font-semibold tnum"
                      style={{ color: PRIMARY }}
                    >
                      {item.value}
                    </div>
                    <div
                      className="mt-1 text-xs"
                      style={{ color: '#64748b' }}
                    >
                      {item.label}
                    </div>
                  </div>
                ))}
              </div>

              {/* 算力结算 */}
              <div
                className="rounded-lg p-4 mb-5"
                style={{ backgroundColor: '#F7F9FC' }}
              >
                <h4
                  className="text-[14px] font-semibold mb-3"
                  style={{ color: '#0f172a' }}
                >
                  算力结算
                </h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span style={{ color: '#64748b' }}>当前剩余算力</span>
                    <span className="font-medium tnum" style={{ color: '#0f172a' }}>
                      {creditInfo ? `${balance} 点` : '...'}
                    </span>
                  </div>
                  <div className="flex justify-between items-start">
                    <span style={{ color: '#64748b' }}>单价</span>
                    <div className="text-right">
                      <span className="tnum" style={{ color: '#0f172a' }}>
                        {creditInfo ? `${unitPrice} 点 / 次` : '...'}
                      </span>
                      <div className="text-[11px] leading-tight mt-0.5" style={{ color: '#94a3b8' }}>
                        与关键词检测同一计费规则
                      </div>
                    </div>
                  </div>
                  <div className="flex justify-between">
                    <span style={{ color: '#64748b' }}>计费方式</span>
                    <span style={{ color: '#0f172a' }}>
                      场景数 × 平台数 × 单价
                    </span>
                  </div>
                  <div
                    className="flex justify-between pt-2 mt-2"
                    style={{ borderTop: '1px dashed #E5E9F2' }}
                  >
                    <span className="font-medium" style={{ color: '#0f172a' }}>
                      本次消耗算力
                    </span>
                    <span
                      className="font-bold tnum"
                      style={{ color: PRIMARY }}
                    >
                      {creditInfo ? `${totalCost} 点` : '...'}
                    </span>
                  </div>
                </div>
              </div>

              {/* 余额不足警示 */}
              {balanceInsufficient && (
                <div
                  className="rounded-lg p-3 mb-5 text-sm"
                  style={{
                    backgroundColor: '#fef2f2',
                    color: '#991b1b',
                  }}
                >
                  当前算力余额不足，本次需要 {totalCost} 点算力，请先充值
                </div>
              )}

              {/* 主按钮 */}
              <Button
                type="button"
                className="w-full h-10"
                style={{
                  backgroundColor: balanceInsufficient ? '#94a3b8' : PRIMARY,
                }}
                onClick={handleConfirmAndRun}
                disabled={submitting || balanceInsufficient || runStatus === 'running'}
              >
                {submitting || runStatus === 'running'
                  ? '诊断启动中...'
                  : balanceInsufficient
                    ? '算力余额不足，请充值'
                    : '确认并开始诊断'}
              </Button>

              {/* 上一步 */}
              <div className="mt-3">
                <Button
                  type="button"
                  variant="outline"
                  className="w-full h-10"
                  onClick={() => setStep(1)}
                  disabled={runStatus === 'running'}
                >
                  <ArrowLeft className="mr-1 h-4 w-4" />
                  上一步
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ============ 场景编辑弹窗 ============ */}
      <Dialog open={scenarioDialogOpen} onOpenChange={setScenarioDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingScenarioIdx === null ? '添加查询场景' : '编辑查询场景'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">用户画像</label>
              <Input
                value={scenarioForm.userProfile}
                onChange={(e) =>
                  setScenarioForm({
                    ...scenarioForm,
                    userProfile: e.target.value,
                  })
                }
                placeholder="如：年轻白领女性"
                className="h-9"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">搜索场景</label>
              <Input
                value={scenarioForm.searchScenario}
                onChange={(e) =>
                  setScenarioForm({
                    ...scenarioForm,
                    searchScenario: e.target.value,
                  })
                }
                placeholder="如：想找附近口碑好的蛋糕店"
                className="h-9"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">示例问题</label>
              <Input
                value={scenarioForm.sampleQuestion}
                onChange={(e) =>
                  setScenarioForm({
                    ...scenarioForm,
                    sampleQuestion: e.target.value,
                  })
                }
                placeholder="如：北京有哪些好吃的蛋糕店推荐？"
                className="h-9"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">问题类型</label>
              <Select
                value={scenarioForm.questionType}
                onValueChange={(v) =>
                  setScenarioForm({
                    ...scenarioForm,
                    questionType: v as DiagnosisQuestionType,
                  })
                }
              >
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DIAGNOSIS_QUESTION_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {DIAGNOSIS_QUESTION_TYPE_LABELS[t]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setScenarioDialogOpen(false)}
            >
              取消
            </Button>
            <Button
              type="button"
              onClick={saveScenario}
              style={{ backgroundColor: PRIMARY }}
            >
              保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default DiagnosisCreatePage;
