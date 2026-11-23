import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  Lightbulb,
  Send,
  Link2,
  Target,
  Play,
} from 'lucide-react';
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from '@client/src/components/ui/tabs';
import {
  PageHeader,
  SectionCard,
  StepRail,
} from '@client/src/components/layout';
import { Button } from '@client/src/components/ui/button';
import type { StepStatus, StepRailStep } from '@client/src/components/layout/StepRail';
import { useBrandSelector } from '@client/src/hooks/useBrandSelector';
import { BrandSelector } from '@client/src/components/BrandSelector';
import {
  BrandProfileCard,
  ContentMatrixCard,
  ContentCheckCard,
  EmptyBrandState as ContentEmptyBrand,
} from './components/ContentProductionStep';
import {
  GapAnalysisCard,
  ActionItemsCard,
  ModuleLinksSection,
} from './components/EffectLoopStep';
import DiagnosisListPage from '@client/src/pages/Diagnosis/DiagnosisListPage';
import CompetitorComparePage from '@client/src/pages/Diagnosis/CompetitorComparePage';
import CitationMonitorPage from '@client/src/pages/Diagnosis/CitationMonitorPage';
import { DispatchStep } from './components/DispatchStep';
import { IndexingStep } from './components/IndexingStep';
import { getOverview, getInternalLinks } from '@client/src/api/geo-loop';
import BrandReadinessCard from '@client/src/components/BrandReadinessCard';
import type { GeoLoopOverview } from '@shared/api.interface';

const STEPS: StepRailStep[] = [
  { id: 1, name: '内容生产', icon: Lightbulb },
  { id: 2, name: '分发节奏', icon: Send },
  { id: 3, name: '收录引导', icon: Link2 },
  { id: 4, name: '效果闭环', icon: Target },
];

const STATUS_LABELS: Record<StepStatus, string> = {
  completed: '已完成',
  inProgress: '进行中',
  notStarted: '未开始',
};

const STATUS_PILL_CLASSES: Record<StepStatus, string> = {
  completed: 'bg-[#10B981] text-white border-[#10B981]',
  inProgress: 'bg-[#2E7DFF] text-white border-[#2E7DFF]',
  notStarted: 'bg-[#F1F5F9] text-[#94A3B8] border-[#F1F5F9]',
};

/**
 * 计算四步的真实状态（左侧导轨与各段标题同源）
 * ①内容生产：品牌定位 6/6 都有值 且 内容矩阵子话题≥1 且 结构检查文章数≥1 → completed
 *   有定位（至少1个字段有值）但缺矩阵或检查 → inProgress
 *   定位全空 → notStarted
 * ②分发节奏：有plans且已发布>0且本月计划≥4 → completed
 *   有plans但未全达标 → inProgress
 *   无plans → notStarted
 * ③收录引导：内链≥1且外链≥1且有体检记录 → completed
 *   部分有数据 → inProgress
 *   都没有 → notStarted
 * ④效果闭环：有竞对差距且有优化建议≥1 → completed
 *   仅有差距、没有建议 → inProgress
 *   都没有 → notStarted
 */
export function computeStepStatuses(
  overview: GeoLoopOverview | null | undefined,
  hasBrand: boolean,
  dispatchOverview?: { monthlyPlanned: number; monthlyPublished: number },
  externalLinkTotal?: number,
  internalLinkTotal?: number,
  pageCheckCount?: number,
  actionItemCount?: number,
): Record<number, StepStatus> {
  if (!hasBrand || !overview) {
    return { 1: 'notStarted', 2: 'notStarted', 3: 'notStarted', 4: 'notStarted' };
  }

  // 第一步：内容生产
  const s1 = overview.step1;
  const profileAllDone = s1.profileFieldsDone >= 6;
  const hasSubTopics = s1.subTopicCount >= 1;
  const hasCheckedArticles = s1.checkedArticleCount >= 1;
  const hasAnyProfile = s1.profileFieldsDone > 0;
  const step1: StepStatus = profileAllDone && hasSubTopics && hasCheckedArticles
    ? 'completed'
    : hasAnyProfile || s1.subTopicCount > 0 || s1.checkedArticleCount > 0
    ? 'inProgress'
    : 'notStarted';

  // 第二步：分发节奏
  let step2: StepStatus = 'notStarted';
  if (dispatchOverview && dispatchOverview.monthlyPlanned > 0) {
    if (dispatchOverview.monthlyPublished > 0 && dispatchOverview.monthlyPlanned >= 4) {
      step2 = 'completed';
    } else {
      step2 = 'inProgress';
    }
  }

  // 第三步：收录引导
  const hasInternal = (internalLinkTotal ?? 0) > 0;
  const hasExternal = (externalLinkTotal ?? 0) > 0;
  const hasPageCheck = (pageCheckCount ?? 0) > 0;
  const step3HasAny = hasInternal || hasExternal || hasPageCheck;
  const step3: StepStatus = hasInternal && hasExternal && hasPageCheck
    ? 'completed'
    : step3HasAny
    ? 'inProgress'
    : 'notStarted';

  // 第四步：效果闭环
  const s4 = overview.step4;
  const hasGaps = s4.openGapCount > 0;
  const hasActions = s4.pendingActionCount > 0 || (actionItemCount ?? 0) > 0;
  const step4: StepStatus = hasGaps && hasActions
    ? 'completed'
    : hasGaps
    ? 'inProgress'
    : 'notStarted';

  return { 1: step1, 2: step2, 3: step3, 4: step4 };
}

const EFFECT_TABS = [
  { value: 'gap', label: '竞对差距' },
  { value: 'action', label: '优化建议' },
  { value: 'diagnosis', label: '诊断报告' },
  { value: 'competitors', label: '竞对对比' },
  { value: 'citations', label: '引用监测' },
] as const;

export default function GeoLoopPage() {
  const { selectedBrandId, selectedBrand, isLoading: brandsLoading } = useBrandSelector();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const effectTab = (searchParams.get('tab') as string) || 'gap';

  const handleEffectTabChange = (value: string): void => {
    const params = new URLSearchParams(searchParams);
    params.set('tab', value);
    navigate(`?${params.toString()}`, { replace: true });
    if (['diagnosis', 'competitors', 'citations', 'gap', 'action'].includes(value)) {
      setTimeout(() => {
        document.getElementById('step-4')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 0);
    }
  };

  const {
    data: overview,
    isLoading: overviewLoading,
    isError: overviewError,
  } = useQuery({
    queryKey: ['geo-loop', 'overview', selectedBrandId],
    queryFn: () => getOverview(selectedBrandId),
    enabled: !!selectedBrandId,
  });

  // 分发概览（用于步骤 2 状态）
  const { data: dispatchOverview } = useQuery({
    queryKey: ['geo-loop', 'dispatch-overview-status', selectedBrandId],
    queryFn: async () => {
      const { getDispatchOverview } = await import('@client/src/api/geo-loop');
      return getDispatchOverview(selectedBrandId);
    },
    enabled: !!selectedBrandId,
    staleTime: 60_000,
  });

  // 外链概览（用于步骤 3 状态）
  const { data: externalOverview } = useQuery({
    queryKey: ['geo-loop', 'external-link-overview-status', selectedBrandId],
    queryFn: async () => {
      const { getExternalLinkOverview } = await import('@client/src/api/geo-loop');
      return getExternalLinkOverview(selectedBrandId);
    },
    enabled: !!selectedBrandId,
    staleTime: 60_000,
  });

  // 页面体检（用于步骤 3 状态）
  const { data: pageChecks } = useQuery({
    queryKey: ['geo-loop', 'page-checks-status', selectedBrandId],
    queryFn: async () => {
      const { getPageChecks } = await import('@client/src/api/geo-loop');
      return getPageChecks(selectedBrandId);
    },
    enabled: !!selectedBrandId,
    staleTime: 60_000,
  });

  // 内链（用于步骤 3 状态）
  const { data: internalLinks } = useQuery({
    queryKey: ['geo-loop', 'internal-links-status', selectedBrandId],
    queryFn: () => getInternalLinks(selectedBrandId),
    enabled: !!selectedBrandId,
    staleTime: 60_000,
  });

  // 优化建议（用于步骤 4 状态）
  const { data: actionItems } = useQuery({
    queryKey: ['geo-loop', 'action-items-status', selectedBrandId],
    queryFn: async () => {
      const { getActionItemsByBrand } = await import('@client/src/api/geo-loop');
      return getActionItemsByBrand(selectedBrandId);
    },
    enabled: !!selectedBrandId,
    staleTime: 60_000,
  });

  const [activeStep, setActiveStep] = useState(1);

  const showContentSkeleton = overviewLoading && !!selectedBrandId;
  const showRailSkeleton = (overviewLoading || overviewError) && !!selectedBrandId;

  const stepStatuses = useMemo(
    () => computeStepStatuses(
      overview,
      !!selectedBrandId,
      dispatchOverview,
      externalOverview?.total,
      internalLinks?.length,
      pageChecks?.length,
      actionItems?.length,
    ),
    [overview, selectedBrandId, dispatchOverview, externalOverview, internalLinks, pageChecks, actionItems],
  );

  const completedCount = useMemo(
    () => Object.values(stepStatuses).filter((s) => s === 'completed').length,
    [stepStatuses],
  );

  const handleStepClick = (stepId: number) => {
    setActiveStep(stepId);
    const el = document.getElementById(`step-${stepId}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const hasBrand = !!selectedBrandId;

  return (
    <div className="w-full px-6 pt-5 pb-8 bg-[#F7F9FC] min-h-screen overflow-x-hidden">
      {/* 页头 */}
      <PageHeader
        title="GEO 闭环"
        subtitle="内容生产、分发节奏、收录引导、效果闭环四步工作流"
        actions={
          <div className="flex items-center gap-2">
            {hasBrand && (
              <Button
                size="sm"
                className="bg-[#2E7DFF] text-white hover:bg-[#1E5FD6]"
                onClick={() => {
                  const el = document.getElementById('step-1');
                  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  setActiveStep(1);
                }}
              >
                <Play className="h-4 w-4" />
                开始创作
              </Button>
            )}
            {!brandsLoading && (
              <div className="w-56 shrink-0">
                <BrandSelector />
              </div>
            )}
          </div>
        }
        className="mb-5"
      />

      {!hasBrand ? (
        <ContentEmptyBrand />
      ) : (
        <>
          {/* 品牌就绪度卡 */}
          {selectedBrandId && (
            <div className="mb-5">
              <BrandReadinessCard
                brandId={selectedBrandId}
                brandName={selectedBrand?.name}
              />
            </div>
          )}

          <div className="flex gap-5 items-start">
          {/* 左侧竖向步骤导轨 */}
          <aside className="w-48 shrink-0 sticky top-5">
            <StepRail
              steps={STEPS}
              statuses={stepStatuses}
              activeStep={activeStep}
              completedCount={completedCount}
              onStepClick={handleStepClick}
              loading={showRailSkeleton}
            />
          </aside>

          {/* 主内容区 */}
          <main className="flex-1 min-w-0 space-y-5">
            {/* 第一步：内容生产 */}
            <section id="step-1">
              <SectionCard
                title={`第 1 步 · 内容生产`}
                actions={(
                  <span className={`inline-flex h-[22px] items-center rounded-[6px] border px-2 text-[12px] font-medium ${STATUS_PILL_CLASSES[stepStatuses[1]]}`}>
                    {STATUS_LABELS[stepStatuses[1]]}
                  </span>
                )}
              >
                {/* 行 1：品牌定位档案（360px） + 内容矩阵（flex-1），等高 */}
                <div className="flex items-stretch gap-5 mb-5 min-w-0">
                  <div className="w-[360px] shrink-0 min-w-0 flex flex-col">
                    <BrandProfileCard brandId={selectedBrandId} showSkeleton={showContentSkeleton} />
                  </div>
                  <div className="flex-1 min-w-0 flex flex-col">
                    <ContentMatrixCard brandId={selectedBrandId} showSkeleton={showContentSkeleton} />
                  </div>
                </div>
                {/* 行 2：结构检查（全宽） */}
                <ContentCheckCard brandId={selectedBrandId} showSkeleton={showContentSkeleton} />
              </SectionCard>
            </section>

            {/* 第二步：分发节奏 */}
            <section id="step-2">
              <SectionCard
                title={`第 2 步 · 分发节奏`}
                actions={(
                  <span className={`inline-flex h-[22px] items-center rounded-[6px] border px-2 text-[12px] font-medium ${STATUS_PILL_CLASSES[stepStatuses[2]]}`}>
                    {STATUS_LABELS[stepStatuses[2]]}
                  </span>
                )}
              >
                <DispatchStep brandId={selectedBrandId} showSkeleton={showContentSkeleton} />
              </SectionCard>
            </section>

            {/* 第三步：收录引导 */}
            <section id="step-3">
              <SectionCard
                title={`第 3 步 · 收录引导`}
                actions={(
                  <span className={`inline-flex h-[22px] items-center rounded-[6px] border px-2 text-[12px] font-medium ${STATUS_PILL_CLASSES[stepStatuses[3]]}`}>
                    {STATUS_LABELS[stepStatuses[3]]}
                  </span>
                )}
              >
                <IndexingStep brandId={selectedBrandId} showSkeleton={showContentSkeleton} />
              </SectionCard>
            </section>

            {/* 第四步：效果闭环（含诊断三子入口） */}
            <section id="step-4">
              <SectionCard
                title={`第 4 步 · 效果闭环`}
                actions={(
                  <span className={`inline-flex h-[22px] items-center rounded-[6px] border px-2 text-[12px] font-medium ${STATUS_PILL_CLASSES[stepStatuses[4]]}`}>
                    {STATUS_LABELS[stepStatuses[4]]}
                  </span>
                )}
              >
                <Tabs value={effectTab} onValueChange={handleEffectTabChange}>
                  <div className="border-b mb-4" style={{ borderColor: '#E6EAF2' }}>
                    <TabsList className="h-9 w-full flex-nowrap justify-start gap-5 bg-transparent p-0">
                      {EFFECT_TABS.map((tab) => (
                        <TabsTrigger
                          key={tab.value}
                          value={tab.value}
                          className="relative h-9 flex-shrink-0 rounded-none border-b-2 border-transparent bg-transparent px-1 text-[13px] font-medium text-[#5B6B85] transition-colors data-[state=active]:border-b-2 data-[state=active]:border-[#2E7DFF] data-[state=active]:bg-transparent data-[state=active]:text-[#2E7DFF] data-[state=active]:shadow-none data-[state=active]:font-semibold"
                        >
                          {tab.label}
                        </TabsTrigger>
                      ))}
                    </TabsList>
                  </div>

                  <TabsContent value="gap">
                    <GapAnalysisCard brandId={selectedBrandId} showSkeleton={showContentSkeleton} />
                  </TabsContent>
                  <TabsContent value="action">
                    <ActionItemsCard brandId={selectedBrandId} showSkeleton={showContentSkeleton} />
                  </TabsContent>
                  <TabsContent value="diagnosis">
                    <div className="hub-content-inner pt-1">
                      <DiagnosisListPage />
                    </div>
                  </TabsContent>
                  <TabsContent value="competitors">
                    <div className="hub-content-inner pt-1">
                      <CompetitorComparePage />
                    </div>
                  </TabsContent>
                  <TabsContent value="citations">
                    <div className="hub-content-inner pt-1">
                      <CitationMonitorPage />
                    </div>
                  </TabsContent>
                </Tabs>
              </SectionCard>
            </section>

            {/* 模块入口区 */}
            <ModuleLinksSection />

            {/* 数据来源脚注 */}
            <div className="text-[11px] text-[#94A3B8] text-right mt-4">
              数据截至 {new Date().toLocaleString('zh-CN')} · 来源：geo_brands / geo_keywords
            </div>
          </main>
        </div>
        </>
      )}
    </div>
  );
}
