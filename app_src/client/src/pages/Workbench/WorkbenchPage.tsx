import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, PenSquare } from 'lucide-react';
import ReactECharts from 'echarts-for-react';
import type { EChartsOption } from 'echarts';
import { Skeleton } from '@client/src/components/ui/skeleton';
import { Button } from '@client/src/components/ui/button';
import { PageHeader } from '@client/src/components/layout/PageHeader';
import { SectionCard } from '@client/src/components/layout/SectionCard';
import { StatCard } from '@client/src/components/layout/StatCard';
import { DataTable } from '@client/src/components/layout/DataTable';
import { Pill } from '@client/src/components/layout/Pill';
import {
  getDashboardStats,
  getHitRateTrend,
  getWorkbenchStats,
} from '@client/src/api/dashboard';
import { creation } from '@client/src/api';
import { useAuth } from '@client/src/hooks/useAuth';
import { useBrand } from '@client/src/hooks/useBrandContext';
import BrandReadinessCard from '@client/src/components/BrandReadinessCard';
import DashboardPage from '@client/src/pages/Dashboard/Dashboard';
import type {
  DashboardStats,
  HitRateTrend,
  CreationOverviewStats,
  WorkbenchStats,
  ActiveCustomerItem,
} from '@shared/api.interface';

/* ========== 时间范围选项 ========== */
const STATS_RANGE_OPTIONS: Array<{
  value: 'all' | 'today' | 'yesterday' | '7d' | '30d';
  label: string;
}> = [
  { value: 'all', label: '全部' },
  { value: 'today', label: '今天' },
  { value: 'yesterday', label: '昨天' },
  { value: '7d', label: '近7天' },
  { value: '30d', label: '近30天' },
];

/* ========== 图表配色 ========== */
const CHART_COLORS = {
  c1: '#2563EB',
  c2: '#00C2FF',
  c3: '#60A5FA',
  c4: '#5FD3E8',
  c5: '#CBD5E1',
};

/* ========== 第一行：4 个 KPI 卡 ========== */
interface KpiCardsProps {
  workbenchStats: WorkbenchStats | undefined;
  isLoading: boolean;
  rangeLabel: string;
  brandLabel: string;
}

const KpiCards: React.FC<KpiCardsProps> = ({
  workbenchStats,
  isLoading,
  rangeLabel,
  brandLabel,
}) => {
  return (
    <div data-ai-section-type="card-stat">
      <div className="grid grid-cols-4 gap-5">
      <StatCard
        label="文章生成数"
        value={isLoading ? '—' : (workbenchStats?.articleCount ?? 0).toLocaleString('en-US')}
        unit="篇"
        trend={`${rangeLabel} · ${brandLabel}`}
        trendUp={false}
      />
      <StatCard
        label="发布数"
        value={isLoading ? '—' : (workbenchStats?.publicationCount ?? 0).toLocaleString('en-US')}
        unit="篇"
        trend={`${rangeLabel} · ${brandLabel}`}
        trendUp={false}
      />
      <StatCard
        label="AI 提及次数"
        value={isLoading ? '—' : (workbenchStats?.aiMentionCount ?? 0).toLocaleString('en-US')}
        unit="次"
        trend={`${rangeLabel} · ${brandLabel}`}
        trendUp={false}
      />
      <StatCard
        label="关键词命中率"
        value={isLoading ? '—' : `${(workbenchStats?.aiHitRate ?? 0).toFixed(1)}%`}
        trend={`${rangeLabel} · ${brandLabel} · 样本 ${workbenchStats?.aiSampleCount?.toLocaleString('en-US') ?? 0} 条检测`}
        trendUp={false}
      />
    </div>
      <div className="mt-2 text-center text-[12px] text-[#94A3B8]">
        {brandLabel} · 近7天
      </div>
    </div>
  );
};

/* ========== 内容投放链路 ========== */
interface DeliveryFunnelProps {
  workbenchStats: WorkbenchStats | undefined;
  isLoading: boolean;
}

const DeliveryFunnel: React.FC<DeliveryFunnelProps> = ({
  workbenchStats,
  isLoading,
}) => {
  return (
    <SectionCard
      title="内容投放链路"
      actions={<span className="text-[12px] text-[#94A3B8]">实时数据 · 点击跳转对应页面</span>}
    >
      <div className="grid grid-cols-5 gap-4">
        {[
          { to: '/creation', label: '创作', value: workbenchStats?.deliveryArticleCount ?? 0, unit: '篇', color: 'text-[#0F172A]', loading: isLoading },
          { to: '/publish', label: '排期', value: workbenchStats?.deliveryScheduledCount ?? 0, unit: '条', color: 'text-[#0F172A]', loading: isLoading },
          { to: '/media-market/orders', label: '已发布', value: workbenchStats?.deliveryPublishedCount ?? 0, unit: '条', color: 'text-[#10B981]', loading: isLoading },
          { to: '/media-market/orders', label: '待发布', value: workbenchStats?.deliveryPendingCount ?? 0, unit: '条', color: 'text-[#F59E0B]', loading: isLoading },
          { to: null, label: '本月花费', value: null, unit: '', color: 'text-[#2E7DFF]', loading: isLoading, isSpend: true },
        ].map((step, index) => {
          const Wrapper: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className }) =>
            step.to ? (
              <Link to={step.to} className={className}>{children}</Link>
            ) : (
              <div className={className}>{children}</div>
            );
          return (
            <div key={step.label} className="relative">
              <Wrapper className="flex flex-col items-center gap-1 py-3 rounded-lg hover:bg-[#F8FAFC] transition-colors w-full">
                <span className="text-[12px] text-[#94A3B8]">{step.label}</span>
                <div className="flex items-baseline gap-0.5">
                  {step.isSpend ? (
                    <span className={`tnum text-[20px] font-semibold ${step.color}`}>
                      {isLoading ? '—' : `¥${((workbenchStats?.deliveryMonthlySpendCents ?? 0) / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                    </span>
                  ) : (
                    <>
                      <span className={`tnum text-[20px] font-semibold ${step.color}`}>
                        {isLoading ? '—' : typeof step.value === 'number' ? step.value.toLocaleString('en-US') : step.value}
                      </span>
                      <span className="text-[12px] text-[#94A3B8]">{step.unit}</span>
                    </>
                  )}
                </div>
              </Wrapper>
              {index < 4 && (
                <div className="pointer-events-none absolute top-1/2 -right-2 -translate-y-1/2 z-10">
                  <ArrowRight className="w-4 h-4 text-[#CBD5E1]" />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </SectionCard>
  );
};

/* ========== 第二行左：近 30 天动态趋势折线图 ========== */
interface TrendChartProps {
  trend: HitRateTrend[] | undefined;
  isLoading: boolean;
}

const TrendChart: React.FC<TrendChartProps> = ({ trend, isLoading }) => {
  const option: EChartsOption = useMemo(
    () => ({
      tooltip: {
        trigger: 'axis',
        backgroundColor: '#FFFFFF',
        borderColor: '#E6E9F2',
        borderWidth: 1,
        textStyle: { color: '#0F172A', fontSize: 12 },
      },
      legend: {
        show: true,
        top: 0,
        right: 0,
        textStyle: { color: '#64748B', fontSize: 12 },
        itemWidth: 16,
        itemHeight: 2,
        itemGap: 16,
      },
      grid: { left: 10, right: 10, top: 36, bottom: 20, containLabel: true },
      xAxis: {
        type: 'category',
        boundaryGap: false,
        data: trend?.map((t) => t.month) ?? [],
        axisLine: { show: false },
        axisLabel: { color: '#94A3B8', fontSize: 11 },
        axisTick: { show: false },
      },
      yAxis: {
        type: 'value',
        axisLabel: {
          color: '#94A3B8',
          fontSize: 11,
          formatter: '{value}%',
        },
        splitLine: { lineStyle: { color: '#EEF2F7', type: 'dashed' } },
        axisLine: { show: false },
        axisTick: { show: false },
      },
      series: [
        {
          name: 'AI 检测',
          type: 'line',
          data: trend?.map((t) => t.rate) ?? [],
          smooth: true,
          symbol: 'circle',
          symbolSize: 6,
          lineStyle: { color: CHART_COLORS.c1, width: 2.5 },
          itemStyle: {
            color: CHART_COLORS.c1,
            borderColor: '#FFFFFF',
            borderWidth: 2,
          },
          areaStyle: {
            color: {
              type: 'linear',
              x: 0,
              y: 0,
              x2: 0,
              y2: 1,
              colorStops: [
                { offset: 0, color: 'rgba(37, 99, 235, 0.18)' },
                { offset: 1, color: 'rgba(37, 99, 235, 0)' },
              ],
            },
          },
        },
      ],
    }),
    [trend],
  );

  return (
    <SectionCard title="近 30 天趋势" actions={<span className="text-[12px] text-[#94A3B8]">默认近 30 天</span>}>
      <div className="h-[260px]">
        {isLoading ? (
          <Skeleton className="w-full h-[240px] rounded-md" />
        ) : (
          <ReactECharts
            option={option}
            style={{ height: 240, width: '100%' }}
            notMerge
          />
        )}
      </div>
    </SectionCard>
  );
};

/* ========== 第二行右：各平台命中分布环形图 ========== */
interface PlatformDonutProps {
  platformDist: Array<{
    platform: string;
    sampleCount: number;
    hitCount: number;
    hitRate: number;
  }> | undefined;
  isLoading: boolean;
}

const PlatformDonut: React.FC<PlatformDonutProps> = ({
  platformDist,
  isLoading,
}) => {
  const option: EChartsOption = useMemo(() => {
    const data = platformDist?.map((p) => ({
      name: p.platform,
      value: p.hitCount,
    })) ?? [];
    const palette = [
      CHART_COLORS.c1,
      CHART_COLORS.c2,
      CHART_COLORS.c3,
      CHART_COLORS.c4,
      CHART_COLORS.c5,
    ];
    return {
      tooltip: {
        trigger: 'item',
        backgroundColor: '#FFFFFF',
        borderColor: '#E6E9F2',
        borderWidth: 1,
        textStyle: { color: '#0F172A', fontSize: 12 },
        formatter: '{b}: {c} ({d}%)',
      },
      series: [
        {
          type: 'pie',
          radius: ['60%', '82%'],
          center: ['50%', '50%'],
          avoidLabelOverlap: false,
          label: { show: false },
          labelLine: { show: false },
          data: data.map((d, i) => ({
            ...d,
            itemStyle: { color: palette[i % palette.length] },
          })),
        },
      ],
    };
  }, [platformDist]);

  const data = platformDist?.map((p) => ({
    name: p.platform,
    value: p.hitCount,
    sampleCount: p.sampleCount,
    hitRate: p.hitRate,
  })) ?? [];
  const totalHit = data.reduce((sum: number, d) => sum + d.value, 0);
  const totalSample = data.reduce((sum: number, d) => sum + d.sampleCount, 0);
  const palette = [
    CHART_COLORS.c1,
    CHART_COLORS.c2,
    CHART_COLORS.c3,
    CHART_COLORS.c4,
    CHART_COLORS.c5,
  ];
  const hasData = data.length > 0;

  return (
    <SectionCard title="平台分布">
      <div className="flex flex-col h-full">
        {isLoading ? (
          <Skeleton className="w-full h-[220px] rounded-md" />
        ) : hasData ? (
          <>
            <div className="relative h-[180px] w-full">
              <ReactECharts
                option={option}
                style={{ height: 180, width: '100%' }}
                notMerge
              />
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                <div className="tnum text-[22px] font-semibold text-[#0F172A] leading-none">
                  {totalHit.toLocaleString('en-US')}
                </div>
                <div className="mt-1 text-[11px] text-[#94a3b8]">总命中 / {totalSample.toLocaleString('en-US')} 样本</div>
              </div>
            </div>
            <div className="mt-3 space-y-2">
              {data.map((item, index) => {
                return (
                  <div key={item.name} className="flex items-center justify-between text-[12px]">
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className="inline-block h-2.5 w-2.5 shrink-0 rounded-sm"
                        style={{ backgroundColor: palette[index % palette.length] }}
                      />
                      <span className="text-[#64748B] break-words">{item.name}</span>
                    </div>
                    <div className="tnum flex items-center gap-2 shrink-0">
                      <span className="text-[#0F172A] font-medium">{item.value}</span>
                      <span className="text-[#94A3B8]">/ {item.sampleCount}</span>
                      <span className="text-[#0F172A] font-medium w-[48px] text-right">{item.hitRate.toFixed(1)}%</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        ) : (
          <div className="flex h-[220px] w-full items-center justify-center text-[12px] text-[#94A3B8]">
            暂无检测数据
          </div>
        )}
      </div>
    </SectionCard>
  );
};

/* ========== 第三行左：交付看板表 ========== */
interface DeliveryBoardProps {
  stats: DashboardStats | undefined;
  isLoading: boolean;
}

const DeliveryBoard: React.FC<DeliveryBoardProps> = ({ stats, isLoading }) => {
  const list = stats?.activeCustomerList ?? [];
  const isEmpty = !isLoading && list.length === 0;

  const getStatusVariant = (s: string): 'success' | 'warning' | 'danger' | 'muted' => {
    if (s === 'expired') return 'danger';
    if (s === 'expiring') return 'warning';
    if (s === 'active') return 'success';
    return 'muted';
  };

  const statusLabel: Record<string, string> = {
    active: '正常',
    expiring: '30 天内到期',
    expired: '已到期',
  };

  const packageLabel: Record<string, string> = {
    basic: '基础版',
    standard: '标准版',
    premium: '旗舰版',
  };

  const columns = [
    { key: 'brandName', title: '客户', width: '25%' },
    { key: 'packageType', title: '套餐', width: '20%', render: (row: ActiveCustomerItem) => packageLabel[row.packageType] || row.packageType },
    { key: 'monthPublications', title: '本月发布', width: '18%', align: 'right' as const, render: (row: ActiveCustomerItem) => (<span className="tabular-nums">{row.monthPublications} 篇</span>) },
    { key: 'kpiHitRate', title: 'KPI', width: '15%', align: 'right' as const, render: (row: ActiveCustomerItem) => row.kpiHitRate !== null ? <span className="tabular-nums">{row.kpiHitRate}%</span> : '—' },
    { key: 'status', title: '状态', width: '22%', render: (row: ActiveCustomerItem) => (
      <Pill variant={getStatusVariant(row.status)}>
        {statusLabel[row.status] || row.status}
      </Pill>
    )},
  ];

  return (
    <SectionCard
      title="交付看板"
      count={stats?.activeCustomers ?? 0}
      actions={<span className="text-[12px] text-[#94A3B8]">在服务客户</span>}
    >
      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 h-11">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-12" />
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-5 w-20 rounded-full" />
            </div>
          ))}
        </div>
      ) : (
        <DataTable
          columns={columns}
          data={list}
          rowKey="brandId"
          emptyText="暂无在服务客户"
          emptyAction={
            <Button size="sm" asChild>
              <Link to="/clients?tab=customers">去查看客户</Link>
            </Button>
          }
        />
      )}
    </SectionCard>
  );
};

/* ========== 第三行右上：线索与跟进 ========== */
interface LeadFollowupsProps {
  stats: DashboardStats | undefined;
  isLoading: boolean;
}

const LeadFollowupsCard: React.FC<LeadFollowupsProps> = ({
  stats,
  isLoading,
}) => {
  const total = stats?.pendingFollowups ?? 0;

  const items = [
    { label: '待跟进线索', sub: '未处理线索', value: stats?.pendingFollowups ?? 0, unit: '条', color: 'text-[#2563EB]' },
    { label: '30 天内到期', sub: '合同到期', value: stats?.expiringIn30Days ?? 0, unit: '个', color: 'text-[#F59E0B]' },
    { label: '逾期未跟进', sub: '线索已超期', value: stats?.overdueCount ?? 0, unit: '条', color: 'text-[#DC2626]' },
  ];

  const isEmpty = !isLoading && total === 0;

  return (
    <SectionCard title="线索与跟进" count={total} actions={<span className="text-[12px] text-[#94A3B8]">待跟进</span>}>
      {isLoading ? (
        <div className="grid grid-cols-3 gap-2 py-2">
          {items.map((item) => (
            <div key={item.label} className="flex flex-col items-center">
              <Skeleton className="h-6 w-12" />
              <div className="mt-1.5 flex flex-col items-center">
                <Skeleton className="h-3 w-16" />
                <Skeleton className="mt-1 h-2.5 w-12" />
              </div>
            </div>
          ))}
        </div>
      ) : isEmpty ? (
        <div className="flex flex-col items-center justify-center py-6">
          <div className="text-[13px] text-[#94A3B8] mb-3">暂无线索数据</div>
          <Button size="sm" asChild>
            <Link to="/clients?tab=leads">去添加线索</Link>
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-2 py-2">
          {items.map((item) => (
            <div key={item.label} className="flex flex-col items-center">
              <div className="flex items-baseline gap-0.5">
                <span className={`tnum text-[20px] font-semibold leading-none ${item.color}`}>
                  {item.value.toLocaleString('en-US')}
                </span>
                <span className="text-[11px] text-[#94A3B8]">{item.unit}</span>
              </div>
              <div className="mt-1.5 flex flex-col items-center">
                <span className="text-[12px] text-[#64748B]">{item.label}</span>
                <span className="text-[11px] text-[#94A3B8]">{item.sub}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </SectionCard>
  );
};

/* ========== 第三行右下：资源概览 ========== */
interface ResourceOverviewProps {
  stats: DashboardStats | undefined;
  contentStats: CreationOverviewStats | undefined;
  statsLoading: boolean;
  contentLoading: boolean;
}

const ResourceOverviewCard: React.FC<ResourceOverviewProps> = ({
  stats,
  contentStats,
  statsLoading,
  contentLoading,
}) => {
  const todoCount =
    (contentStats?.inProgressCount ?? 0) +
    (contentStats?.pendingReviewCount ?? 0);
  const creationCount =
    (contentStats?.monthArticleCount ?? 0) +
    (contentStats?.monthImageCount ?? 0) +
    (contentStats?.monthVideoCount ?? 0);

  const gridItems = [
    { label: '本月算力消耗', value: contentStats?.monthCreditUsed ?? 0, unit: '点', isContent: true, color: 'text-[#2563EB]' },
    { label: '在服务客户', value: stats?.activeCustomers ?? 0, unit: '家', isContent: false, color: 'text-[#2563EB]' },
    { label: '本月创作', value: creationCount, unit: '件', isContent: true, color: 'text-[#0F172A]' },
    { label: '待办任务', value: todoCount, unit: '项', isContent: true, color: 'text-[#0F172A]' },
  ];

  return (
    <SectionCard title="资源概览">
      <div className="grid grid-cols-2 gap-y-4 gap-x-4 py-2">
        {gridItems.map((item) => {
          const loading = item.isContent ? contentLoading : statsLoading;
          return (
            <div key={item.label} className="flex flex-col">
              {loading ? (
                <Skeleton className="h-5 w-14" />
              ) : (
                <div className="flex items-baseline gap-0.5">
                  <span className={`tnum text-[18px] font-semibold leading-none ${item.color}`}>
                    {typeof item.value === 'number'
                      ? item.value.toLocaleString('en-US')
                      : item.value}
                  </span>
                  <span className="text-[11px] text-[#94A3B8]">{item.unit}</span>
                </div>
              )}
              <span className="mt-1 text-[12px] text-[#64748B]">{item.label}</span>
            </div>
          );
        })}
      </div>
    </SectionCard>
  );
};

/* ========== 主组件 ========== */
const WorkbenchPage: React.FC = () => {
  const { hasRole } = useAuth();
  const { selectedBrandId, selectedBrand } = useBrand();
  const isAdmin = hasRole('admin') || hasRole('operator');

  const statsRange = '7d' as const;
  const rangeLabel =
    STATS_RANGE_OPTIONS.find((o) => o.value === statsRange)?.label ?? '近7天';
  const brandLabel = selectedBrand?.name ?? '全部品牌';

  /* 核心统计数据 */
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['dashboard', 'stats', statsRange, selectedBrandId],
    queryFn: () => getDashboardStats(statsRange, selectedBrandId),
    enabled: isAdmin,
    retry: 2,
    retryDelay: 2000,
  });

  /* 命中率趋势 */
  const { data: trend, isLoading: trendLoading } = useQuery({
    queryKey: ['dashboard', 'trend', selectedBrandId],
    queryFn: () => getHitRateTrend(selectedBrandId),
    enabled: isAdmin,
    retry: 2,
    retryDelay: 2000,
  });

  /* 工作台数据总览（按时间范围） */
  const { data: workbenchStats, isLoading: workbenchLoading } = useQuery({
    queryKey: ['dashboard', 'workbench-stats', statsRange, selectedBrandId],
    queryFn: () =>
      getWorkbenchStats({
        range: statsRange,
        brandId: selectedBrandId ?? undefined,
      }),
    enabled: isAdmin,
    retry: false,
  });

  /* 内容产出统计 */
  const { data: contentStats, isLoading: contentStatsLoading } = useQuery({
    queryKey: ['contentStats', 'overview', selectedBrandId],
    queryFn: () => creation.getOverviewStats(selectedBrandId ?? undefined),
    enabled: isAdmin,
    retry: 2,
    retryDelay: 2000,
  });

  /* 数据更新时间（兜底取当前时间） */
  const updatedAt = useMemo(() => {
    const raw = (workbenchStats as { updatedAt?: string })?.updatedAt;
    if (raw) return new Date(raw).toLocaleString('zh-CN');
    return new Date().toLocaleString('zh-CN');
  }, [workbenchStats]);

  /* 非 admin/operator 角色：回退到原 Dashboard 页 */
  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-[#F7F9FC]">
        <div className="max-w-full px-6 pt-5 pb-8">
          <PageHeader title="工作台" subtitle="GEO 闭环运营总览 · 今日数据实时更新" />
          <div className="hub-content-inner">
            <DashboardPage />
          </div>
        </div>
      </div>
    );
  }

  const overallLoading =
    statsLoading || workbenchLoading || contentStatsLoading;

  return (
    <div className="min-h-screen bg-[#F7F9FC] overflow-x-hidden">
      <div className="max-w-full px-6 pt-5 pb-8">
        {/* 页头 */}
        <PageHeader
          title="工作台"
          subtitle="内容生产、发布、收录、效果全链路数据总览"
          className="!pt-0"
          actions={
            <Button asChild>
              <Link to="/creation">
                <PenSquare className="size-4 mr-1.5" />
                去创作
              </Link>
            </Button>
          }
        />

        {/* 区块间距 20px */}
        <div className="flex flex-col gap-5">
          {/* 品牌就绪度卡 */}
          {selectedBrandId && (
            <BrandReadinessCard
              brandId={selectedBrandId}
              brandName={selectedBrand?.name}
            />
          )}

          {/* 第一行：4 个 KPI 卡 */}
          <KpiCards
            workbenchStats={workbenchStats}
            isLoading={overallLoading}
            rangeLabel={rangeLabel}
            brandLabel={brandLabel}
          />

          {/* 内容投放链路卡片 */}
          <DeliveryFunnel
            workbenchStats={workbenchStats}
            isLoading={overallLoading}
          />

          {/* 第三行：左趋势图(60%) + 右环形图(40%) */}
          <div className="grid grid-cols-5 gap-5">
            <div className="col-span-3">
              <TrendChart trend={trend} isLoading={trendLoading} />
            </div>
            <div className="col-span-2">
              <PlatformDonut
                platformDist={workbenchStats?.aiPlatformDistribution}
                isLoading={workbenchLoading}
              />
            </div>
          </div>

          {/* 第四行：交付看板整宽 */}
          <DeliveryBoard
            stats={stats}
            isLoading={statsLoading || workbenchLoading}
          />

          {/* 第五行：线索与跟进 + 资源概览 等宽 */}
          <div className="grid grid-cols-2 gap-5">
            <LeadFollowupsCard
              stats={stats}
              isLoading={statsLoading || workbenchLoading}
            />
            <ResourceOverviewCard
              stats={stats}
              contentStats={contentStats}
              statsLoading={statsLoading || workbenchLoading}
              contentLoading={contentStatsLoading}
            />
          </div>

          {/* 数据来源脚注 */}
          <div className="text-[11px] text-[#94A3B8] text-right mt-4">
            数据截至 {updatedAt} · 来源：geo_keywords / geo_publications / geo_leads
          </div>
        </div>
      </div>
    </div>
  );
};

export default WorkbenchPage;
