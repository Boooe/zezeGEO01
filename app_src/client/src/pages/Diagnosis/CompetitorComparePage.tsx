import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import ReactECharts from 'echarts-for-react';
import type { EChartsOption } from 'echarts';
import {
  ArrowRight,
  AlertTriangle,
  ChevronDown,
  TrendingDown,
  RefreshCw,
  AlertCircle,
} from 'lucide-react';
import { Button } from '@client/src/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@client/src/components/ui/select';
import { Skeleton } from '@client/src/components/ui/skeleton';
import { SectionCard } from '@client/src/components/layout/SectionCard';
import { Toolbar } from '@client/src/components/layout/Toolbar';
import { Pill } from '@client/src/components/layout/Pill';
import { DataTable } from '@client/src/components/layout/DataTable';

import {
  diagnosis,
} from '@client/src/api';
import { getBrandList } from '@client/src/api/keywords';
import { useAuth } from '@client/src/contexts/AuthContext';
import {
  DIAGNOSIS_PLATFORM_LABELS,
  type CompetitorCompareResponse,
  type DiagnosisReport,
  type CompetitorQuestionCompare,
  type CompetitorGapAlert,
} from '@shared/api.interface';

const COMPARE_LIMIT = 3;
const QUESTIONS_PER_PAGE = 20;

const BRAND_COLORS = ['#2E7DFF', '#F59E0B', '#10B981', '#EF4444'];
const PRIMARY = '#2E7DFF';
const DANGER = '#EF4444';

const CompetitorComparePage: React.FC = () => {
  const { user } = useAuth();
  const isClient = user?.role === 'client';

  const [brandId, setBrandId] = useState<string>(user?.brandId ?? '');
  const [brandReportId, setBrandReportId] = useState<string>('');
  const [competitorReportIds, setCompetitorReportIds] = useState<string[]>([]);
  const [hasCompared, setHasCompared] = useState(false);
  const [questionsVisible, setQuestionsVisible] = useState(QUESTIONS_PER_PAGE);

  const { data: brandList = [] } = useQuery({
    queryKey: ['brands', 'options'],
    queryFn: getBrandList,
    staleTime: 5 * 60 * 1000,
    enabled: !isClient,
  });

  const { data: reportsData } = useQuery({
    queryKey: ['diagnosisReports', 'all', brandId],
    queryFn: () =>
      diagnosis.getDiagnosisReports({
        page: 1,
        pageSize: 100,
        brandId: brandId || undefined,
      }),
    enabled: !!brandId || isClient,
  });

  const { data: allReportsData } = useQuery({
    queryKey: ['diagnosisReports', 'all-brands'],
    queryFn: () =>
      diagnosis.getDiagnosisReports({
        page: 1,
        pageSize: 100,
      }),
    enabled: !isClient,
    staleTime: 5 * 60 * 1000,
  });

  const reportOptions: DiagnosisReport[] = reportsData?.items ?? [];
  const competitorReportOptions: DiagnosisReport[] = isClient
    ? reportOptions
    : (allReportsData?.items ?? []);

  const {
    data: compareData,
    isLoading: compareLoading,
    refetch: runCompare,
    isError: compareError,
  } = useQuery<CompetitorCompareResponse>({
    queryKey: ['competitorCompare', brandReportId, competitorReportIds],
    queryFn: () =>
      diagnosis.competitorCompare({
        brandReportId,
        competitorReportIds,
      }),
    enabled: false,
    retry: false,
  });

  const handleCompare = () => {
    if (!brandReportId || competitorReportIds.length === 0) return;
    setHasCompared(true);
    setQuestionsVisible(QUESTIONS_PER_PAGE);
    void runCompare();
  };

  const toggleCompetitor = (id: string) => {
    if (competitorReportIds.includes(id)) {
      setCompetitorReportIds(competitorReportIds.filter((r) => r !== id));
    } else {
      if (competitorReportIds.length >= COMPARE_LIMIT) return;
      setCompetitorReportIds([...competitorReportIds, id]);
    }
  };

  const competitorLabels = useMemo(() => {
    if (!compareData) return [];
    return compareData.competitors.map((c) => c.brandName);
  }, [compareData]);

  /* ---------- 雷达图配置 ---------- */
  const radarOption = useMemo((): EChartsOption | null => {
    if (!compareData) return null;
    const indicators = compareData.ownBrand.dimensions.map((d) => ({
      name: d.label,
    }));
    const ownData = compareData.ownBrand.dimensions.map((d) => d.score);
    const series = [
      {
        name: compareData.ownBrand.brandName,
        value: ownData,
        itemStyle: { color: BRAND_COLORS[0] },
        areaStyle: { color: 'rgba(37, 99, 235, 0.15)' },
        lineStyle: { width: 2 },
      },
      ...compareData.competitors.map((c, i) => ({
        name: c.brandName,
        value: c.dimensions.map((d) => d.score),
        itemStyle: { color: BRAND_COLORS[i + 1] },
        areaStyle: { color: `${BRAND_COLORS[i + 1]}22` },
        lineStyle: { width: 2 },
      })),
    ];

    return {
      tooltip: { trigger: 'item' },
      legend: {
        type: 'scroll',
        bottom: 0,
        data: series.map((s) => s.name),
      },
      radar: {
        indicator: indicators,
        center: ['50%', '45%'],
        radius: '60%',
        splitNumber: 4,
        axisName: {
          color: '#64748B',
          fontSize: 12,
        },
        splitLine: {
          lineStyle: { color: '#E6EAF2' },
        },
        splitArea: {
          areaStyle: { color: ['#fff', '#F7F9FC'] },
        },
      },
      series: [
        {
          type: 'radar',
          data: series,
        },
      ],
    };
  }, [compareData]);

  /* ---------- SOV ---------- */
  const sovData = useMemo(() => {
    if (!compareData) return [];
    return [
      { name: compareData.ownBrand.brandName, sov: compareData.ownBrand.sov, color: BRAND_COLORS[0] },
      ...compareData.competitors.map((c, i) => ({
        name: c.brandName,
        sov: c.sov,
        color: BRAND_COLORS[i + 1],
      })),
    ];
  }, [compareData]);

  const sovMax = useMemo(() => {
    if (sovData.length === 0) return 100;
    return Math.max(...sovData.map((d) => d.sov), 1);
  }, [sovData]);

  const visibleQuestions = useMemo(() => {
    if (!compareData) return [];
    return compareData.questionCompare.slice(0, questionsVisible);
  }, [compareData, questionsVisible]);

  const gapAlerts: CompetitorGapAlert[] = compareData?.gapAlerts ?? [];

  const positionLabel = (pos: string | null, isMentioned: boolean): string => {
    if (!isMentioned) return '未命中';
    if (!pos) return '已提及';
    const map: Record<string, string> = {
      first: '1',
      top3: '3',
      later: '后',
    };
    return `第${map[pos] ?? pos}位`;
  };

  const positionShort = (pos: string): string => {
    const map: Record<string, string> = {
      first: '1',
      top3: '3',
      later: '后',
    };
    return map[pos] ?? pos;
  };

  return (
    <div className="flex flex-col gap-6">
      {/* 选择区 */}
      <SectionCard title="竞对差距对比">
        <Toolbar>
          {!isClient && (
            <div className="space-y-1.5 w-48">
              <label className="text-[12px] text-[#94A3B8]">品牌</label>
              <Select value={brandId} onValueChange={setBrandId}>
                <SelectTrigger className="h-9 w-full">
                  <SelectValue placeholder="请选择品牌" />
                </SelectTrigger>
                <SelectContent>
                  {brandList.map((b: { id: string; name: string }) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="space-y-1.5 w-64">
            <label className="text-[12px] text-[#94A3B8]">本品牌诊断报告</label>
            <Select value={brandReportId} onValueChange={setBrandReportId}>
              <SelectTrigger className="h-9 w-full">
                <SelectValue placeholder="选择本品牌诊断报告" />
              </SelectTrigger>
              <SelectContent>
                {reportOptions.map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.brandName} · {r.id.slice(0, 8)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5 w-64">
            <label className="text-[12px] text-[#94A3B8]">
              竞品报告（最多 {COMPARE_LIMIT} 个）
            </label>
            <Select
              value=""
              onValueChange={(v) => {
                if (v) toggleCompetitor(v);
              }}
            >
              <SelectTrigger className="h-9 w-full">
                <SelectValue
                  placeholder={
                    competitorReportIds.length > 0
                      ? `已选 ${competitorReportIds.length} 个`
                      : '选择竞品报告'
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {competitorReportOptions
                  .filter((r) => r.id !== brandReportId)
                  .map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      {competitorReportIds.includes(r.id) ? '✓ ' : ''}
                      {r.brandName} · {r.id.slice(0, 8)}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
            {competitorReportIds.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {competitorReportIds.map((id) => {
                  const r = reportOptions.find((opt) => opt.id === id);
                  return (
                    <span
                      key={id}
                      className="cursor-pointer hover:opacity-80"
                      onClick={() => toggleCompetitor(id)}
                    >
                      <Pill variant="info" className="gap-1">
                        {r?.brandName ?? id.slice(0, 8)}
                        <span className="opacity-60">×</span>
                      </Pill>
                    </span>
                  );
                })}
              </div>
            )}
          </div>
          <Button
            onClick={handleCompare}
            disabled={
              !brandReportId ||
              competitorReportIds.length === 0 ||
              compareLoading
            }
            className="h-9 self-end"
            style={{ backgroundColor: PRIMARY }}
          >
            {compareLoading ? (
              <>对比中...</>
            ) : (
              <>
                <ArrowRight className="h-4 w-4" />
                开始对比
              </>
            )}
          </Button>
        </Toolbar>
      </SectionCard>

      {/* 结果区 */}
      {compareLoading && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <SectionCard title="核心维度对比" className="lg:col-span-2">
            <Skeleton className="h-[360px] w-full rounded-md" />
          </SectionCard>
          <SectionCard title="声量份额（SOV）">
            <Skeleton className="h-[360px] w-full rounded-md" />
          </SectionCard>
        </div>
      )}

      {compareError && (
        <SectionCard title="对比失败">
          <div className="flex items-center justify-between py-4">
            <div className="flex items-center gap-2 text-sm" style={{ color: DANGER }}>
              <AlertCircle className="h-4 w-4" />
              <span>对比失败，请重试</span>
            </div>
            <button
              onClick={() => runCompare()}
              className="flex items-center gap-1 rounded-md px-3 py-1.5 text-sm font-medium"
              style={{ color: DANGER }}
            >
              <RefreshCw className="h-3.5 w-3.5" />
              重试
            </button>
          </div>
        </SectionCard>
      )}

      {hasCompared && compareData && !compareLoading && (
        <>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            {/* 雷达图 */}
            <SectionCard title="核心维度对比" className="lg:col-span-2">
              {radarOption && (
                <ReactECharts
                  option={radarOption}
                  theme="ud"
                  className="h-[380px] w-full"
                />
              )}
            </SectionCard>

            {/* SOV */}
            <SectionCard title="声量份额（SOV）">
              <div className="space-y-4">
                <div>
                  <div
                    className="text-4xl font-bold"
                    style={{ color: BRAND_COLORS[0] }}
                  >
                    {compareData.ownBrand.sov.toFixed(1)}%
                  </div>
                  <div className="text-xs mt-1" style={{ color: '#94A3B8' }}>
                    本品牌声量份额
                  </div>
                </div>
                <div className="space-y-3">
                  {sovData.map((item) => (
                    <div key={item.name} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span style={{ color: '#64748B' }}>{item.name}</span>
                        <span
                          className="font-medium tabular-nums"
                          style={{ color: item.color }}
                        >
                          {item.sov.toFixed(1)}%
                        </span>
                      </div>
                      <div className="h-2 w-full rounded-full overflow-hidden" style={{ backgroundColor: '#F1F5F9' }}>
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${(item.sov / sovMax) * 100}%`,
                            backgroundColor: item.color,
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </SectionCard>
          </div>

          {/* 逐题对比表 */}
          <SectionCard
            title="逐题命中对比"
            count={compareData.totalQuestions}
          >
            <DataTable
              rowKey="question"
              data={visibleQuestions}
              columns={[
                {
                  key: 'question',
                  title: '问题',
                  width: '45%',
                  render: (row: CompetitorQuestionCompare) => (
                    <span
                      className="font-medium text-[#0F172A] text-[13px] truncate block"
                      title={row.question}
                    >
                      {row.question}
                    </span>
                  ),
                },
                {
                  key: 'platform',
                  title: '平台',
                  width: '15%',
                  render: (row: CompetitorQuestionCompare) => (
                    <span className="text-[12.5px] text-[#5B6B85]">
                      {DIAGNOSIS_PLATFORM_LABELS?.[
                        row.platform as keyof typeof DIAGNOSIS_PLATFORM_LABELS
                      ] ?? row.platform}
                    </span>
                  ),
                },
                {
                  key: 'ownBrand',
                  title: (
                    <span style={{ color: BRAND_COLORS[0] }}>本品牌</span>
                  ),
                  width: '13%',
                  render: (row: CompetitorQuestionCompare) => {
                    const own = row.brands.find((b) => b.isOwn);
                    return (
                      <span
                        className="inline-flex items-center gap-1.5 text-xs"
                        style={{ color: own?.isMentioned ? BRAND_COLORS[0] : '#94A3B8' }}
                      >
                        <span
                          className="h-2 w-2 rounded-full"
                          style={{
                            backgroundColor: own?.isMentioned
                              ? BRAND_COLORS[0]
                              : '#CBD5E1',
                          }}
                        />
                        {positionLabel(own?.mentionPosition ?? null, !!own?.isMentioned)}
                      </span>
                    );
                  },
                },
                ...competitorLabels.slice(0, 3).map((name, i) => ({
                  key: `competitor-${i}`,
                  title: <span style={{ color: BRAND_COLORS[i + 1] }}>{name}</span>,
                  width: '13%',
                  render: (row: CompetitorQuestionCompare) => {
                    const competitors = row.brands.filter((b) => !b.isOwn);
                    const c = competitors[i];
                    return c ? (
                      <span
                        className="inline-flex items-center gap-1.5 text-xs"
                        style={{
                          color: c.isMentioned ? BRAND_COLORS[i + 1] : '#94A3B8',
                        }}
                      >
                        <span
                          className="h-2 w-2 rounded-full"
                          style={{
                            backgroundColor: c.isMentioned
                              ? BRAND_COLORS[i + 1]
                              : '#CBD5E1',
                          }}
                        />
                        {positionLabel(c.mentionPosition, c.isMentioned)}
                      </span>
                    ) : null;
                  },
                })),
              ]}
            />
            {compareData.questionCompare.length > questionsVisible && (
              <div className="flex justify-center pt-4">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setQuestionsVisible((v) => v + QUESTIONS_PER_PAGE)
                  }
                >
                  <ChevronDown className="h-4 w-4" />
                  查看更多
                </Button>
              </div>
            )}
          </SectionCard>

          {/* 抢位预警 */}
          <SectionCard title="抢位预警" count={gapAlerts.length}>
            {gapAlerts.length === 0 ? (
              <div className="py-8 text-center text-sm" style={{ color: '#94A3B8' }}>
                暂无抢位预警
              </div>
            ) : (
              <div className="space-y-3">
                {gapAlerts.map((alert, i) => (
                  <div
                    key={i}
                    className="flex items-start gap-3 rounded-lg border-l-4 p-3 pl-4"
                    style={{
                      borderLeftColor: DANGER,
                      backgroundColor: 'rgba(220, 38, 38, 0.04)',
                    }}
                  >
                    <TrendingDown className="h-5 w-5 shrink-0 mt-0.5" style={{ color: DANGER }} />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-[13px] text-[#0F172A]">
                        {alert.question}
                      </div>
                      <div className="mt-1 text-xs text-[#64748B]">
                        竞品 <span className="font-medium">{alert.competitorName}</span>
                        {alert.competitorPosition
                          ? ` · 排名第 ${positionShort(alert.competitorPosition)} 位`
                          : ' · 已发布'}
                        <span className="ml-2" style={{ color: '#94A3B8' }}>
                          {DIAGNOSIS_PLATFORM_LABELS?.[
                            alert.platform as keyof typeof DIAGNOSIS_PLATFORM_LABELS
                          ] ?? alert.platform}
                        </span>
                      </div>
                      <div className="mt-1.5 text-xs" style={{ color: '#94A3B8' }}>
                        建议：{alert.suggestion}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>
        </>
      )}

      {hasCompared && !compareData && !compareLoading && !compareError && (
        <SectionCard title="暂无数据">
          <div className="py-12 text-center text-sm" style={{ color: '#94A3B8' }}>
            请选择本品牌与竞品报告后点击「开始对比」
          </div>
        </SectionCard>
      )}
    </div>
  );
};

export default CompetitorComparePage;
