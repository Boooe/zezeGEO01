import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Pencil,
  ChevronDown,
  ChevronUp,
  Plus,
  ArrowRight,
  RefreshCw,
  FileText,
  Search,
  ShoppingCart,
  X,
  AlertCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@client/src/components/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@client/src/components/ui/card';
import { Badge } from '@client/src/components/ui/badge';
import { Input } from '@client/src/components/ui/input';
import { Textarea } from '@client/src/components/ui/textarea';
import { Checkbox } from '@client/src/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@client/src/components/ui/dialog';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from '@client/src/components/ui/sheet';
import { Progress } from '@client/src/components/ui/progress';
import { DataTable } from '@client/src/components/layout';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@client/src/components/ui/select';
import { Skeleton } from '@client/src/components/ui/skeleton';
import { getApiErrorMessage } from '@client/src/lib/api-error';
import {
  getBrandProfile,
  upsertBrandProfile,
  getPillarsByPillar,
  createPillar,
  dispatchPillarsAsTasks,
  getContentChecksByBrand,
  runContentCheck,
} from '@client/src/api/geo-loop';
import type {
  BrandProfile,
  PillarsByPillar,
  ContentCheck,
  ContentCheckDetail,
  ContentPillar,
} from '@shared/api.interface';
import {
  PILLAR_STATUS_LABELS,
  type PillarStatus,
} from '@shared/api.interface';
import { Link } from 'react-router-dom';

interface CardProps {
  brandId: string;
  showSkeleton?: boolean;
}

const PROFILE_TOTAL_FIELDS = 6;

const MODULE_LINKS = [
  { label: '创作中心', to: '/creation?tab=write', icon: FileText },
  { label: '关键词库', to: '/keywords?tab=pool', icon: Search },
  { label: '媒体商城', to: '/media-market?tab=market', icon: ShoppingCart },
];

/* ---------- 空品牌态 ---------- */

export function EmptyBrandState() {
  return (
    <Card className="p-10">
      <div className="flex flex-col items-center text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100">
          <AlertCircle className="h-8 w-8 text-slate-400" />
        </div>
        <h3 className="mt-4 text-lg font-semibold text-slate-800">
          请先选择品牌
        </h3>
        <p className="mt-2 max-w-md text-sm text-slate-500">
          选择品牌后即可查看 GEO 闭环数据
        </p>
      </div>
    </Card>
  );
}

/* ---------- 品牌定位档案 ---------- */

function computeProfileCompletion(profile: BrandProfile | null): number {
  if (!profile) return 0;
  let count = 0;
  if (profile.positioningTagline?.trim()) count++;
  if (profile.industry?.trim()) count++;
  if (profile.targetAudience?.trim()) count++;
  if (profile.sellingPoints?.length > 0) count++;
  if (profile.forbiddenPhrases?.trim()) count++;
  if (profile.topQuestions?.length > 0) count++;
  return count;
}

export function BrandProfileCard({ brandId, showSkeleton }: CardProps) {
  const queryClient = useQueryClient();
  const [drawerOpen, setDrawerOpen] = useState(false);

  const { data: profile, isLoading, isError, refetch } = useQuery({
    queryKey: ['geo-loop', 'brand-profile', brandId],
    queryFn: () => getBrandProfile(brandId),
  });

  const upsertMutation = useMutation({
    mutationFn: (body: {
      positioningTagline?: string;
      industry?: string;
      targetAudience?: string;
      sellingPoints: string[];
      forbiddenPhrases?: string;
      topQuestions: string[];
    }) =>
      upsertBrandProfile({
        brandId,
        ...body,
      }),
    retry: false,
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['geo-loop', 'brand-profile', brandId],
      });
      queryClient.invalidateQueries({
        queryKey: ['geo-loop', 'overview', brandId],
      });
      setDrawerOpen(false);
      toast.success('品牌定位档案已保存');
    },
    onError: (err) => {
      toast.error(getApiErrorMessage(err, '保存失败'));
    },
  });

  const completed = computeProfileCompletion(profile ?? null);

  return (
    <Card className="flex-1 min-h-0 flex flex-col">
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="text-base font-semibold">品牌定位档案</CardTitle>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setDrawerOpen(true)}
          disabled={isLoading}
        >
          <Pencil className="h-3.5 w-3.5" />
          编辑
        </Button>
      </CardHeader>
      <CardContent className="p-5 flex-1">
        {showSkeleton || isLoading ? (
          <ProfileSkeleton />
        ) : isError ? (
          <ErrorState onRetry={refetch} />
        ) : (
          <div className="space-y-4">
            {/* 行业 */}
            <div className="space-y-1">
              <div className="text-xs text-slate-500">行业</div>
              <div
                  className="text-sm text-slate-800 break-words min-w-0"
                title={profile?.industry || '—'}
              >
                {profile?.industry || '—'}
              </div>
            </div>
            {/* 定位一句话 */}
            <div className="space-y-1">
              <div className="text-xs text-slate-500">定位一句话</div>
              <div
                  className="text-sm text-slate-800 break-words min-w-0"
                title={profile?.positioningTagline || '—'}
              >
                {profile?.positioningTagline || '—'}
              </div>
            </div>
            {/* 目标受众 */}
            <div className="space-y-1">
              <div className="text-xs text-slate-500">目标受众</div>
              <div
                className="text-sm text-slate-800 break-words min-w-0"
              >
                {profile?.targetAudience || '—'}
              </div>
            </div>
            {/* 差异化卖点 */}
            <div className="space-y-2">
              <div className="text-xs text-slate-500">差异化卖点</div>
              {profile?.sellingPoints?.length ? (
                <div className="flex flex-wrap gap-2">
                  {profile.sellingPoints.map((point, i) => (
                    <Badge
                      key={i}
                      variant="secondary"
                      className="whitespace-nowrap bg-blue-50 px-3 py-1 text-xs font-normal text-blue-600 border-blue-100"
                    >
                      {point}
                    </Badge>
                  ))}
                </div>
              ) : (
                <span className="text-sm text-slate-400">—</span>
              )}
            </div>
            {/* 主打问题 */}
            <div className="space-y-2">
              <div className="text-xs text-slate-500">主打问题</div>
              {profile?.topQuestions?.length ? (
                <div className="flex flex-wrap gap-2">
                  {profile.topQuestions.map((q, i) => (
                    <Badge
                      key={i}
                      variant="outline"
                      className="whitespace-nowrap bg-slate-50 px-3 py-1 text-xs font-normal text-slate-600 border-slate-200"
                    >
                      {q}
                    </Badge>
                  ))}
                </div>
              ) : (
                <span className="text-sm text-slate-400">—</span>
              )}
            </div>
            {/* 底部完整度进度条 */}
            <div className="pt-1">
              <div className="mb-1.5 flex items-center justify-between text-sm">
                <span className="text-slate-500">完整度</span>
                <span className="font-medium tnum text-slate-700 whitespace-nowrap">
                  {completed}/{PROFILE_TOTAL_FIELDS} 项已填
                </span>
              </div>
              <Progress
                value={(completed / PROFILE_TOTAL_FIELDS) * 100}
                className="h-2"
              />
            </div>
          </div>
        )}
      </CardContent>

      <ProfileEditDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        profile={profile ?? null}
        onSave={(data) => upsertMutation.mutate(data)}
        isSaving={upsertMutation.isPending}
      />
    </Card>
  );
}

function ProfileSkeleton() {
  return (
    <div className="space-y-4">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="space-y-1">
          <Skeleton className="h-3 w-12" />
          <Skeleton className="h-4 w-full" />
        </div>
      ))}
      {/* 卖点骨架 */}
      <div className="space-y-2">
        <Skeleton className="h-3 w-16" />
        <div className="flex flex-wrap gap-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-6 w-20 rounded-full" />
          ))}
        </div>
      </div>
      {/* 主打问题骨架 */}
      <div className="space-y-2">
        <Skeleton className="h-3 w-16" />
        <div className="flex flex-wrap gap-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-6 w-24 rounded-full" />
          ))}
        </div>
      </div>
      {/* 底部进度条骨架 */}
      <div className="space-y-1.5 pt-1">
        <div className="flex justify-between">
          <Skeleton className="h-3 w-12" />
          <Skeleton className="h-3 w-20" />
        </div>
        <Skeleton className="h-2 w-full" />
      </div>
    </div>
  );
}

function ProfileEditDrawer({
  open,
  onOpenChange,
  profile,
  onSave,
  isSaving,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  profile: BrandProfile | null;
  onSave: (data: {
    positioningTagline?: string;
    industry?: string;
    targetAudience?: string;
    sellingPoints: string[];
    forbiddenPhrases?: string;
    topQuestions: string[];
  }) => void;
  isSaving: boolean;
}) {
  const [positioningTagline, setPositioningTagline] = useState('');
  const [industry, setIndustry] = useState('');
  const [targetAudience, setTargetAudience] = useState('');
  const [sellingPoints, setSellingPoints] = useState<string[]>(['', '', '']);
  const [forbiddenPhrases, setForbiddenPhrases] = useState('');
  const [topQuestions, setTopQuestions] = useState<string[]>(['', '', '', '', '']);

  const initForm = () => {
    setPositioningTagline(profile?.positioningTagline ?? '');
    setIndustry(profile?.industry ?? '');
    setTargetAudience(profile?.targetAudience ?? '');
    setSellingPoints(
      profile?.sellingPoints?.length
        ? [...profile.sellingPoints]
        : ['', '', ''],
    );
    setForbiddenPhrases(profile?.forbiddenPhrases ?? '');
    setTopQuestions(
      profile?.topQuestions?.length
        ? [...profile.topQuestions]
        : ['', '', '', '', ''],
    );
  };

  const handleSellingPointChange = (idx: number, val: string) => {
    const next = [...sellingPoints];
    next[idx] = val;
    setSellingPoints(next);
  };

  const addSellingPoint = () => {
    setSellingPoints([...sellingPoints, '']);
  };

  const removeSellingPoint = (idx: number) => {
    if (sellingPoints.length <= 1) return;
    setSellingPoints(sellingPoints.filter((_, i) => i !== idx));
  };

  const handleTopQuestionChange = (idx: number, val: string) => {
    const next = [...topQuestions];
    next[idx] = val;
    setTopQuestions(next);
  };

  const addTopQuestion = () => {
    if (topQuestions.length >= 10) return;
    setTopQuestions([...topQuestions, '']);
  };

  const removeTopQuestion = (idx: number) => {
    if (topQuestions.length <= 1) return;
    setTopQuestions(topQuestions.filter((_, i) => i !== idx));
  };

  const handleSave = () => {
    const cleanSellingPoints = sellingPoints.filter((s) => s.trim());
    const cleanTopQuestions = topQuestions.filter((s) => s.trim());
    onSave({
      positioningTagline: positioningTagline.trim() || undefined,
      industry: industry.trim() || undefined,
      targetAudience: targetAudience.trim() || undefined,
      sellingPoints: cleanSellingPoints,
      forbiddenPhrases: forbiddenPhrases.trim() || undefined,
      topQuestions: cleanTopQuestions,
    });
  };

  return (
    <Sheet
      open={open}
      onOpenChange={(v) => {
        if (v) initForm();
        onOpenChange(v);
      }}
    >
      <SheetContent side="right" className="w-[440px] sm:max-w-[440px]">
        <SheetHeader>
          <SheetTitle>编辑品牌定位档案</SheetTitle>
          <SheetDescription>
            完善品牌定位信息，为内容生产提供依据
          </SheetDescription>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-slate-700">
              定位一句话
            </label>
            <Input
              value={positioningTagline}
              onChange={(e) => setPositioningTagline(e.target.value)}
              placeholder="一句话描述品牌定位"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-slate-700">行业</label>
            <Input
              value={industry}
              onChange={(e) => setIndustry(e.target.value)}
              placeholder="所属行业"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-slate-700">
              目标受众
            </label>
            <Textarea
              value={targetAudience}
              onChange={(e) => setTargetAudience(e.target.value)}
              placeholder="描述目标受众特征"
              rows={3}
            />
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-slate-700">
                差异化卖点
              </label>
              <Button
                variant="ghost"
                size="sm"
                onClick={addSellingPoint}
                className="h-7 px-2 text-xs"
              >
                <Plus className="h-3.5 w-3.5" />
                添加
              </Button>
            </div>
            <div className="space-y-2">
              {sellingPoints.map((point, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <Input
                    value={point}
                    onChange={(e) =>
                      handleSellingPointChange(idx, e.target.value)
                    }
                    placeholder={`卖点 ${idx + 1}`}
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeSellingPoint(idx)}
                    className="h-9 w-9 shrink-0 text-slate-400 hover:text-red-500"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-slate-700">
              禁用表述
            </label>
            <Textarea
              value={forbiddenPhrases}
              onChange={(e) => setForbiddenPhrases(e.target.value)}
              placeholder="品牌禁用的词汇或表述"
              rows={2}
            />
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-slate-700">
                主打问题
              </label>
              <Button
                variant="ghost"
                size="sm"
                onClick={addTopQuestion}
                disabled={topQuestions.length >= 10}
                className="h-7 px-2 text-xs"
              >
                <Plus className="h-3.5 w-3.5" />
                添加
              </Button>
            </div>
            <div className="space-y-2">
              {topQuestions.map((q, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <Input
                    value={q}
                    onChange={(e) =>
                      handleTopQuestionChange(idx, e.target.value)
                    }
                    placeholder={`问题 ${idx + 1}`}
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeTopQuestion(idx)}
                    className="h-9 w-9 shrink-0 text-slate-400 hover:text-red-500"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        </div>
        <SheetFooter>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? '保存中...' : '保存'}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

/* ---------- 内容矩阵（支柱折叠 + 子话题两行式） ---------- */

export function ContentMatrixCard({ brandId, showSkeleton }: CardProps) {
  const queryClient = useQueryClient();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [currentPillar, setCurrentPillar] = useState<string>('');
  const [expandedPillars, setExpandedPillars] = useState<Set<string>>(new Set());

  const {
    data: pillars,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['geo-loop', 'pillars', brandId],
    queryFn: () => getPillarsByPillar(brandId),
  });

  const dispatchMutation = useMutation({
    mutationFn: (ids: string[]) =>
      dispatchPillarsAsTasks(ids, brandId),
    retry: false,
    onSuccess: (data) => {
      queryClient.invalidateQueries({
        queryKey: ['geo-loop', 'pillars', brandId],
      });
      toast.success(`已生成 ${data.count} 个创作任务`);
      setSelectedIds(new Set());
    },
    onError: (err) => {
      toast.error(getApiErrorMessage(err, '生成任务失败'));
    },
  });

  const createMutation = useMutation({
    mutationFn: (data: {
      pillarTopic: string;
      subTopic: string;
      coverKeywords: string[];
      targetQuestion?: string;
    }) =>
      createPillar({
        brandId,
        pillarTopic: data.pillarTopic,
        subTopic: data.subTopic,
        coverKeywords: data.coverKeywords,
        targetQuestion: data.targetQuestion,
        contentType: 'article',
      }),
    retry: false,
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['geo-loop', 'pillars', brandId],
      });
      setAddDialogOpen(false);
      toast.success('子话题已添加');
    },
    onError: (err) => {
      toast.error(getApiErrorMessage(err, '添加失败'));
    },
  });

  const totalSubTopics = useMemo(
    () => pillars?.reduce((sum, p) => sum + p.total, 0) ?? 0,
    [pillars],
  );
  const totalPublished = useMemo(
    () => pillars?.reduce((sum, p) => sum + p.publishedCount, 0) ?? 0,
    [pillars],
  );
  const pillarCount = pillars?.length ?? 0;

  const togglePillar = (pillarTopic: string) => {
    const next = new Set(expandedPillars);
    if (next.has(pillarTopic)) {
      next.delete(pillarTopic);
    } else {
      next.add(pillarTopic);
    }
    setExpandedPillars(next);
  };

  const toggleSelect = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedIds(next);
  };

  const handleDispatch = () => {
    if (selectedIds.size === 0) return;
    dispatchMutation.mutate(Array.from(selectedIds));
  };

  const openAddDialog = (pillarTopic: string) => {
    setCurrentPillar(pillarTopic);
    setAddDialogOpen(true);
  };

  // 默认展开第一个支柱
  const effectiveExpanded = useMemo(() => {
    if (expandedPillars.size > 0) return expandedPillars;
    if (pillars && pillars.length > 0) {
      return new Set([pillars[0].pillarTopic]);
    }
    return new Set();
  }, [expandedPillars, pillars]);

  return (
    <Card className="flex-1 min-h-0 flex flex-col">
      <CardHeader className="flex flex-row items-center justify-between pb-3 flex-wrap gap-2">
        <CardTitle className="text-base font-semibold">内容矩阵</CardTitle>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              if (pillars && pillars.length > 0) {
                setCurrentPillar(pillars[0].pillarTopic);
                setAddDialogOpen(true);
              }
            }}
            disabled={!pillars?.length}
          >
            <Plus className="h-3.5 w-3.5" />
            添加子话题
          </Button>
          <Button
            size="sm"
            onClick={handleDispatch}
            disabled={selectedIds.size === 0 || dispatchMutation.isPending}
          >
            批量生成任务
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-5 flex-1 min-h-0 overflow-y-auto">
        {showSkeleton || isLoading ? (
          <MatrixSkeleton />
        ) : isError ? (
          <ErrorState onRetry={refetch} />
        ) : !pillars?.length ? (
          <EmptyState text="暂无内容矩阵，点击右上角添加子话题" />
        ) : (
          <div className="space-y-3">
            {/* 统计汇总 */}
            <div className="flex items-center gap-4 text-xs text-slate-500">
              <span>
                支柱{' '}
                <span className="font-semibold text-slate-700 tnum">
                  {pillarCount}
                </span>{' '}
                个
              </span>
              <span>
                子话题{' '}
                <span className="font-semibold text-slate-700 tnum">
                  {totalSubTopics}
                </span>{' '}
                个
              </span>
              <span>
                已发布{' '}
                <span className="font-semibold text-emerald-600 tnum">
                  {totalPublished}
                </span>{' '}
                篇
              </span>
              <span className="ml-auto text-slate-400">
                已选 <span className="font-semibold text-slate-700 tnum">{selectedIds.size}</span> 项
              </span>
            </div>

            {/* 支柱列表 */}
            <div className="space-y-2">
              {pillars.map((pillar) => (
                <PillarGroup
                  key={pillar.pillarTopic}
                  pillar={pillar}
                  isExpanded={effectiveExpanded.has(pillar.pillarTopic)}
                  selectedIds={selectedIds}
                  onToggleExpand={() => togglePillar(pillar.pillarTopic)}
                  onToggleSelect={toggleSelect}
                  onAddSubTopic={() => openAddDialog(pillar.pillarTopic)}
                />
              ))}
            </div>
          </div>
        )}
      </CardContent>
      <div className="border-t border-slate-100 px-6 py-3">
        <Link
          to="/creation?tab=write"
          className="flex items-center justify-center gap-1 text-sm text-[#2E7DFF] hover:underline"
        >
          前往创作中心
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      <AddSubTopicDialog
        open={addDialogOpen}
        onOpenChange={setAddDialogOpen}
        pillarTopic={currentPillar}
        pillarOptions={pillars?.map((p) => p.pillarTopic) ?? []}
        onPillarChange={setCurrentPillar}
        onSubmit={(data) => createMutation.mutate(data)}
        isSubmitting={createMutation.isPending}
      />
    </Card>
  );
}

function MatrixSkeleton() {
  return (
    <div className="space-y-3">
      <div className="flex gap-4">
        <Skeleton className="h-3 w-14" />
        <Skeleton className="h-3 w-16" />
        <Skeleton className="h-3 w-16" />
        <Skeleton className="h-3 w-12 ml-auto" />
      </div>
      <div className="space-y-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="space-y-1.5">
            <Skeleton className="h-10 w-full rounded-lg" />
            <div className="pl-8 space-y-1">
              {Array.from({ length: 2 }).map((_, j) => (
                <Skeleton key={j} className="h-14 w-full rounded-md" />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function PillarGroup({
  pillar,
  isExpanded,
  selectedIds,
  onToggleExpand,
  onToggleSelect,
  onAddSubTopic,
}: {
  pillar: PillarsByPillar;
  isExpanded: boolean;
  selectedIds: Set<string>;
  onToggleExpand: () => void;
  onToggleSelect: (id: string) => void;
  onAddSubTopic: () => void;
}) {
  return (
    <div className="rounded-lg border border-slate-100 bg-slate-50/50 overflow-hidden">
      {/* 支柱标题行 */}
      <button
        onClick={onToggleExpand}
        className="flex w-full items-center justify-between px-3 py-2.5 text-left transition-colors hover:bg-slate-100/60"
      >
        <div className="flex items-center gap-2 min-w-0 flex-1">
          {isExpanded ? (
            <ChevronUp className="h-4 w-4 shrink-0 text-slate-400" />
          ) : (
            <ChevronDown className="h-4 w-4 shrink-0 text-slate-400" />
          )}
          <span
            className="text-sm font-semibold text-slate-800 truncate min-w-0"
            title={pillar.pillarTopic}
          >
            {pillar.pillarTopic}
          </span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs text-slate-400 tnum whitespace-nowrap">
            {pillar.total} 子话题 / {pillar.publishedCount} 已发布
          </span>
          <Button
            variant="ghost"
            size="icon"
            onClick={(e) => {
              e.stopPropagation();
              onAddSubTopic();
            }}
            className="h-7 w-7 shrink-0 text-[#2E7DFF]"
            aria-label={`为 ${pillar.pillarTopic} 添加子话题`}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </button>

      {/* 展开后：子话题列表 */}
      {isExpanded && (
        <div className="border-t border-slate-100 bg-white">
          {pillar.subTopics.map((sub, idx) => (
            <div
              key={sub.id}
              className={
                'flex gap-2 px-3 py-2.5 min-w-0 ' +
                (idx < pillar.subTopics.length - 1 ? 'border-b border-slate-100' : '')
              }
            >
              {/* 左侧勾选框 */}
              <div className="w-8 shrink-0 flex items-start pt-0.5">
                <Checkbox
                  checked={selectedIds.has(sub.id)}
                  onCheckedChange={() => onToggleSelect(sub.id)}
                  aria-label={`选择 ${sub.subTopic}`}
                />
              </div>
              {/* 右侧内容 */}
              <div className="flex-1 min-w-0 space-y-1.5">
                {/* 上：子话题名 + 状态 + 操作 */}
                <div className="flex items-center justify-between gap-2 min-w-0">
                  <div
                    className="text-sm font-medium text-slate-800 truncate min-w-0 break-words"
                    title={sub.subTopic}
                  >
                    {sub.subTopic}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <StatusBadge status={sub.status} />
                  </div>
                </div>
                {/* 下：覆盖关键词标签 */}
                <div className="flex flex-wrap gap-1">
                  {sub.coverKeywords?.length ? (
                    sub.coverKeywords.map((kw, ki) => (
                      <Badge
                        key={ki}
                        variant="secondary"
                        className="h-4 px-1.5 text-[10px] font-normal whitespace-nowrap bg-slate-100 text-slate-600 border-0"
                      >
                        {kw}
                      </Badge>
                    ))
                  ) : (
                    <span className="text-xs text-slate-400">无关键词</span>
                  )}
                </div>
              </div>
            </div>
          ))}
          {pillar.subTopics.length === 0 && (
            <div className="px-3 py-6 text-center text-sm text-slate-400">
              暂无子话题
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: PillarStatus }) {
  const colorMap: Record<PillarStatus, string> = {
    planned: 'bg-slate-100 text-slate-600 border-slate-200',
    writing: 'bg-blue-50 text-blue-600 border-blue-100',
    published: 'bg-emerald-50 text-emerald-600 border-emerald-100',
  };
  return (
    <Badge
      variant="outline"
      className={'h-5 px-1.5 text-[11px] font-normal whitespace-nowrap ' + colorMap[status]}
    >
      {PILLAR_STATUS_LABELS[status]}
    </Badge>
  );
}

function AddSubTopicDialog({
  open,
  onOpenChange,
  pillarTopic,
  pillarOptions,
  onPillarChange,
  onSubmit,
  isSubmitting,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  pillarTopic: string;
  pillarOptions: string[];
  onPillarChange: (v: string) => void;
  onSubmit: (data: {
    pillarTopic: string;
    subTopic: string;
    coverKeywords: string[];
    targetQuestion?: string;
  }) => void;
  isSubmitting: boolean;
}) {
  const [subTopic, setSubTopic] = useState('');
  const [targetQuestion, setTargetQuestion] = useState('');
  const [keywordsStr, setKeywordsStr] = useState('');

  const handleSubmit = () => {
    if (!subTopic.trim()) {
      toast.error('请输入子话题名');
      return;
    }
    const coverKeywords = keywordsStr
      .split(',')
      .map((k) => k.trim())
      .filter(Boolean);
    onSubmit({
      pillarTopic,
      subTopic: subTopic.trim(),
      coverKeywords,
      targetQuestion: targetQuestion.trim() || undefined,
    });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (v) {
          setSubTopic('');
          setTargetQuestion('');
          setKeywordsStr('');
        }
        onOpenChange(v);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>添加子话题</DialogTitle>
          <DialogDescription className="text-xs text-slate-500">
            选择所属支柱并填写子话题信息
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-slate-700">
              所属支柱
            </label>
            <Select
              value={pillarTopic}
              onValueChange={onPillarChange}
            >
              <SelectTrigger className="h-9">
                <SelectValue placeholder="选择支柱" />
              </SelectTrigger>
              <SelectContent>
                {pillarOptions.map((p) => (
                  <SelectItem key={p} value={p}>
                    {p}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-slate-700">
              子话题名
            </label>
            <Input
              value={subTopic}
              onChange={(e) => setSubTopic(e.target.value)}
              placeholder="输入子话题名称"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-slate-700">
              目标问题
            </label>
            <Input
              value={targetQuestion}
              onChange={(e) => setTargetQuestion(e.target.value)}
              placeholder="该子话题回答的核心问题"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-slate-700">
              关键词
            </label>
            <Input
              value={keywordsStr}
              onChange={(e) => setKeywordsStr(e.target.value)}
              placeholder="多个关键词用英文逗号分隔"
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            size="sm"
          >
            取消
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting} size="sm">
            {isSubmitting ? '添加中...' : '添加'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ---------- 结构检查（5列表格） ---------- */

export function ContentCheckCard({ brandId, showSkeleton }: CardProps) {
  const queryClient = useQueryClient();
  const [detailCheck, setDetailCheck] = useState<ContentCheck | null>(null);

  const {
    data: checks,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['geo-loop', 'content-checks', brandId],
    queryFn: () => getContentChecksByBrand(brandId),
  });

  const runMutation = useMutation({
    mutationFn: (articleIds: string[]) => runContentCheck(articleIds, brandId),
    retry: false,
    onSuccess: (data) => {
      queryClient.invalidateQueries({
        queryKey: ['geo-loop', 'content-checks', brandId],
      });
      toast.success(`已重新检查 ${data.count} 篇文章`);
    },
    onError: (err) => {
      toast.error(getApiErrorMessage(err, '检查失败'));
    },
  });

  const avgScore = useMemo(() => {
    if (!checks?.length) return 0;
    const sum = checks.reduce((acc, c) => acc + c.overallScore, 0);
    return Math.round(sum / checks.length);
  }, [checks]);

  const handleRecheck = () => {
    if (!checks?.length) return;
    const articleIds = checks.map((c) => c.articleId);
    runMutation.mutate(articleIds);
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="text-base font-semibold">结构检查</CardTitle>
        <Button
          variant="outline"
          size="sm"
          onClick={handleRecheck}
          disabled={!checks?.length || runMutation.isPending}
        >
          <RefreshCw
            className={
              'h-3.5 w-3.5 ' + (runMutation.isPending ? 'animate-spin' : '')
            }
          />
          重新检查
        </Button>
      </CardHeader>
      <CardContent className="p-5 flex-1">
        {showSkeleton || isLoading ? (
          <CheckSkeleton />
        ) : isError ? (
          <ErrorState onRetry={refetch} />
        ) : !checks?.length ? (
          <EmptyState text="暂无检查结果，点击右上角重新检查" />
        ) : (
          <div className="space-y-3">
            <div className="flex items-center gap-4 text-xs text-slate-500">
              <span>
                已检查{' '}
                <span className="font-semibold text-slate-700 tnum">
                  {checks.length}
                </span>{' '}
                篇
              </span>
              <span>
                平均分{' '}
                <span className="font-semibold text-slate-700 tnum">
                  {avgScore}
                </span>{' '}
                分
              </span>
            </div>
            <DataTable
              rowKey="id"
              data={checks}
              emptyText="暂无检查结果，点击右上角重新检查"
              columns={[
                {
                  key: 'title',
                  title: '标题',
                  width: '45%',
                  render: (row: ContentCheck) => (
                    <span className="text-[13px] text-[#0F172A] break-words">
                      {row.articleTitle || row.articleId.slice(0, 8)}
                    </span>
                  ),
                },
                {
                  key: 'score',
                  title: '结构分',
                  width: '12%',
                  render: (row: ContentCheck) => (
                    <ScoreChip score={row.overallScore} />
                  ),
                },
                {
                  key: 'wordCount',
                  title: '字数',
                  width: '12%',
                  render: (row: ContentCheck) => (
                    <span className="text-[13px] text-[#0F172A] tabular-nums">
                      {row.detail.wordCountScore > 0
                        ? `~${Math.round(row.detail.wordCountScore * 10)}`
                        : '-'}
                    </span>
                  ),
                },
                {
                  key: 'status',
                  title: '状态',
                  width: '15%',
                  render: (row: ContentCheck) => (
                    <ScoreStatusBadge score={row.overallScore} />
                  ),
                },
                {
                  key: 'action',
                  title: '操作',
                  width: '16%',
                  render: (row: ContentCheck) => (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setDetailCheck(row)}
                      className="h-7 px-2 text-xs text-[#2563EB]"
                    >
                      查看
                    </Button>
                  ),
                },
              ]}
            />
          </div>
        )}
      </CardContent>
      <div className="border-t border-slate-100 px-6 py-3">
        <Link
          to="/creation?tab=library"
          className="flex items-center justify-center gap-1 text-sm text-[#2E7DFF] hover:underline"
        >
          前往文章库
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      <CheckDetailDialog
        check={detailCheck}
        onClose={() => setDetailCheck(null)}
      />
    </Card>
  );
}

function CheckSkeleton() {
  return (
    <div className="space-y-3">
      <div className="flex gap-4">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-4 w-20" />
      </div>
      <div className="space-y-1">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="flex h-11 items-center gap-3 border-b border-slate-100"
          >
            <Skeleton className="h-4 flex-1" />
            <Skeleton className="h-6 w-12" />
            <Skeleton className="h-4 w-12" />
            <Skeleton className="h-5 w-12" />
            <Skeleton className="h-5 w-10" />
          </div>
        ))}
      </div>
    </div>
  );
}

function ScoreChip({ score }: { score: number }) {
  let bg = '';
  let text = '';
  if (score >= 70) {
    bg = '#F0FDF4';
    text = '#10B981';
  } else if (score >= 30) {
    bg = '#FFFBEB';
    text = '#F59E0B';
  } else {
    bg = '#FEF2F2';
    text = '#EF4444';
  }
  return (
    <div
      className="inline-flex items-center justify-center rounded-md font-medium tabular-nums text-[12px]"
      style={{ width: '48px', height: '24px', backgroundColor: bg, color: text }}
    >
      {score}
    </div>
  );
}

function ScoreStatusBadge({ score }: { score: number }) {
  if (score >= 80) {
    return (
      <Badge
        variant="outline"
        className="h-5 px-1.5 text-[11px] font-normal whitespace-nowrap bg-emerald-50 text-emerald-600 border-emerald-100"
      >
        优秀
      </Badge>
    );
  }
  if (score >= 60) {
    return (
      <Badge
        variant="outline"
        className="h-5 px-1.5 text-[11px] font-normal whitespace-nowrap bg-amber-50 text-amber-600 border-amber-100"
      >
        良好
      </Badge>
    );
  }
  return (
    <Badge
      variant="outline"
      className="h-5 px-1.5 text-[11px] font-normal whitespace-nowrap bg-red-50 text-red-500 border-red-100"
    >
      待优化
    </Badge>
  );
}

function CheckDetailDialog({
  check,
  onClose,
}: {
  check: ContentCheck | null;
  onClose: () => void;
}) {
  if (!check) return null;

  const items: Array<{ label: string; score: number }> = [
    { label: '标题含关键词', score: check.detail.titleScore },
    { label: '首段答案', score: check.detail.introScore },
    { label: '标题层级', score: check.detail.headingScore },
    { label: 'FAQ 段', score: check.detail.faqScore },
    { label: '数据引用', score: check.detail.citationScore },
    { label: '内链数量', score: check.detail.internalLinkScore },
    { label: '字数达标', score: check.detail.wordCountScore },
  ];

  return (
    <Dialog open={!!check} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>结构分详情</DialogTitle>
          <DialogDescription className="flex items-center gap-2 text-xs">
            总分：
            <span className="text-base font-semibold tnum text-slate-800">
              {check.overallScore}
            </span>
            <ScoreStatusBadge score={check.overallScore} />
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <h4 className="mb-2 text-sm font-semibold text-slate-700">
              7 项得分明细
            </h4>
            <div className="space-y-2">
              {items.map((item) => (
                <div key={item.label} className="flex items-center gap-3">
                  <span className="w-24 text-sm text-slate-600 shrink-0">
                    {item.label}
                  </span>
                  <Progress
                    value={item.score}
                    className="h-2 flex-1"
                  />
                  <span className="w-10 text-right text-sm font-medium tnum text-slate-700 shrink-0">
                    {item.score}
                  </span>
                </div>
              ))}
            </div>
          </div>
          <div>
            <h4 className="mb-2 text-sm font-semibold text-slate-700">
              改写建议
            </h4>
            {check.suggestions?.items?.length ? (
              <ul className="space-y-1.5">
                {check.suggestions.items.map((s, i) => (
                  <li
                    key={i}
                    className="flex items-start gap-2 text-sm text-slate-600"
                  >
                    <span className="mt-0.5 text-[#2E7DFF]">•</span>
                    <span className="min-w-0 break-words">{s.text}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-slate-400">暂无建议</p>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} size="sm">
            关闭
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ---------- 模块入口链接区（保留导出，供外部使用） ---------- */

export function ModuleLinksSection() {
  return (
    <Card className="p-5">
      <div className="mb-3 text-sm font-semibold text-slate-700">
        已有模块入口
      </div>
      <div className="grid grid-cols-3 gap-3">
        {MODULE_LINKS.map((link) => {
          const LinkIcon = link.icon;
          return (
            <Link
              key={link.label}
              to={link.to}
              className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white p-3 transition-all hover:border-[#2E7DFF] hover:bg-blue-50/50"
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-[#2E7DFF]">
                <LinkIcon className="h-4 w-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-slate-800 truncate">
                  {link.label}
                </div>
              </div>
              <ArrowRight className="h-4 w-4 text-slate-400 shrink-0" />
            </Link>
          );
        })}
      </div>
    </Card>
  );
}

/* ---------- 通用空态 / 错误态 ---------- */

function EmptyState({ text }: { text: string }) {
  return (
    <div className="flex h-40 flex-col items-center justify-center text-center">
      <div className="text-sm text-slate-400">{text}</div>
    </div>
  );
}

function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex h-40 flex-col items-center justify-center text-center">
      <AlertCircle className="mb-2 h-8 w-8 text-red-400" />
      <p className="mb-2 text-sm text-slate-500">加载失败</p>
      <Button variant="outline" size="sm" onClick={onRetry}>
        重试
      </Button>
    </div>
  );
}
