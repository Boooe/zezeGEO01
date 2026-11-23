import { useState, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  AlertCircle,
  Clock,
  Target,
  ChevronRight,
  RefreshCw,
  Zap,
  TrendingUp,
  BarChart3,
  Search,
  Send,
  Inbox,
  Activity,
  Sparkles,
  Radio,
  Bell,
  FileCheck,
  ListTodo,
} from 'lucide-react';
import ReactECharts from 'echarts-for-react';
import type { EChartsOption } from 'echarts';
import { Skeleton } from '@client/src/components/ui/skeleton';
import { Badge } from '@client/src/components/ui/badge';
import { Button } from '@client/src/components/ui/button';
import {
  getDashboardStats,
  getHitRateTrend,
  getPlatformDist,
  getRiskRadar,
  getBrandStats,
  getBrandTrend,
  getIndustryNews,
  getWorkbenchStats,
  getAiPlatformCoverage,
  getTopKeywordRanking,
} from '@client/src/api/dashboard';
import { creation } from '@client/src/api';
import { PLATFORM_LABELS, DIAGNOSIS_PLATFORM_LABELS } from '@shared/api.interface';
import type { AiPlatformCoverage, HotKeywordRank } from '@shared/api.interface';
import { UniversalLink } from '@lark-apaas/client-toolkit/components/UniversalLink';
import { useAuth } from '@client/src/hooks/useAuth';
import IndustryNewsMarquee from '@client/src/components/IndustryNewsMarquee';
import { useNavigate } from 'react-router-dom';

/* ========== 颜色常量（浅色系，与设计令牌一致） ========== */
const C = {
  bg: '#F6F8FC',
  panel: '#FFFFFF',
  panel2: '#F6F8FC',
  primary: '#3B5BFF',
  primaryLight: '#EEF2FF',
  accent: '#00C2FF',
  success: '#12B76A',
  warning: '#F79009',
  danger: '#F04438',
  info: '#175CD3',
  textMain: '#101828',
  textSecondary: '#475467',
  textMuted: '#98A2B3',
  border: '#E8EDF5',
  borderLight: '#F0F4FA',
  gridLine: '#EEF2F7',
  chart1: '#3B5BFF',
  chart2: '#00C2FF',
  chart3: '#7A9BFF',
  chart4: '#5FD3E8',
  chart5: '#B9C6E8',
};

/* ========== 数字滚动 hook ========== */
function useCountUp(target: number, duration = 600, decimals = 0): number {
  const [val, setVal] = useState(0);
  const [started, setStarted] = useState(false);

  useEffect(() => {
    if (!started && target !== undefined) {
      setStarted(true);
      const start = 0;
      const startTime = performance.now();

      const step = (now: number) => {
        const elapsed = now - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        const current = start + (target - start) * eased;
        setVal(Number(current.toFixed(decimals)));
        if (progress < 1) {
          requestAnimationFrame(step);
        }
      };
      requestAnimationFrame(step);
    }
    return () => {};
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target]);

  return val;
}

/* ========== KPI 数字组件（含滚动动效） ========== */
interface KpiNumberProps {
  value: number | string;
  className?: string;
  decimals?: number;
  suffix?: string;
  prefix?: string;
}

const KpiNumber: React.FC<KpiNumberProps> = ({
  value,
  className = '',
  decimals = 0,
  suffix = '',
  prefix = '',
}) => {
  const numericVal = typeof value === 'number' ? value : Number(value);
  const animated = useCountUp(
    isNaN(numericVal) ? 0 : numericVal,
    600,
    decimals,
  );

  const display = typeof value === 'number'
    ? (decimals > 0 ? animated.toFixed(decimals) : animated.toLocaleString('en-US'))
    : value;

  return (
    <span className={`kpi-number tnum ${className}`}>
      {prefix}
      {display}
      {suffix}
    </span>
  );
};

/* ========== 状态灯胶囊 ========== */
interface StatusPillProps {
  label: string;
  status: 'normal' | 'warning';
  to?: string;
}

const StatusPill: React.FC<StatusPillProps> = ({ label, status, to }) => {
  const dotColor = status === 'normal' ? C.success : C.warning;
  const content = (
    <div className="flex items-center gap-1.5">
      <span
        className="h-1.5 w-1.5 rounded-full"
        style={{ backgroundColor: dotColor }}
      />
      <span
        className="text-xs font-medium"
        style={{ color: C.textSecondary }}
      >
        {label}
      </span>
    </div>
  );

  if (to) {
    return (
      <UniversalLink to={to} className="no-underline">
        {content}
      </UniversalLink>
    );
  }
  return content;
};

/* ========== 迷你折线 Sparkline ========== */
interface MiniSparklineProps {
  data: number[];
  color?: string;
  height?: number;
}

const MiniSparkline: React.FC<MiniSparklineProps> = ({
  data,
  color = C.primary,
  height = 40,
}) => {
  if (!data?.length) return null;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const width = 120;

  const points = data.map((v, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - ((v - min) / range) * (height - 4) - 2;
    return `${x},${y}`;
  }).join(' ');

  const areaPoints = `0,${height} ${points} ${width},${height}`;

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <defs>
        <linearGradient id="sparkGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.2" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={areaPoints} fill="url(#sparkGrad)" />
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
};

/* ========== 主组件 ========== */
const Dashboard = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isClient = user?.role === 'client';

  /* 数据总览时间范围 */
  const [statsRange, setStatsRange] = useState<'all' | 'today' | 'yesterday' | '7d' | '30d'>('7d');
  const TIME_RANGE_OPTIONS: Array<{ value: 'all' | 'today' | 'yesterday' | '7d' | '30d'; label: string }> = [
    { value: 'all', label: '全部' },
    { value: 'today', label: '今天' },
    { value: 'yesterday', label: '昨天' },
    { value: '7d', label: '近7天' },
    { value: '30d', label: '近30天' },
  ];

  /* ========== Admin / Operator 视角 ========== */
  const {
    data: stats,
    isLoading: statsLoading,
    isError: statsError,
    refetch: refetchStats,
  } = useQuery({
    queryKey: ['dashboard', 'stats', statsRange],
    queryFn: () => getDashboardStats(statsRange),
    enabled: !isClient,
    retry: 2,
    retryDelay: 2000,
  });

  const {
    data: trend,
    isLoading: trendLoading,
  } = useQuery({
    queryKey: ['dashboard', 'trend'],
    queryFn: () => getHitRateTrend(),
    enabled: !isClient,
    retry: 2,
    retryDelay: 2000,
  });

  const {
    data: platformDist,
    isLoading: platformLoading,
  } = useQuery({
    queryKey: ['dashboard', 'platform-dist', statsRange],
    queryFn: () => getPlatformDist(statsRange),
    enabled: !isClient,
    retry: 2,
    retryDelay: 2000,
  });

  const {
    data: risks,
    isLoading: risksLoading,
  } = useQuery({
    queryKey: ['dashboard', 'risks'],
    queryFn: getRiskRadar,
    enabled: !isClient,
    retry: 2,
    retryDelay: 2000,
  });

  /* ========== Client / Brand 视角 ========== */
  const {
    data: brandStats,
    isLoading: brandStatsLoading,
    isError: brandStatsError,
    refetch: refetchBrandStats,
  } = useQuery({
    queryKey: ['dashboard', 'brand-stats'],
    queryFn: () => getBrandStats(),
    enabled: isClient,
    retry: 2,
    retryDelay: 2000,
  });

  const {
    data: brandTrend,
    isLoading: brandTrendLoading,
  } = useQuery({
    queryKey: ['dashboard', 'brand-trend', 30],
    queryFn: () => getBrandTrend(30),
    enabled: isClient,
    retry: 2,
    retryDelay: 2000,
  });

  const {
    data: industryNews,
    isLoading: industryNewsLoading,
  } = useQuery({
    queryKey: ['dashboard-industry-news'],
    queryFn: getIndustryNews,
  });

  /* 内容产出统计（两种角色都用） */
  const {
    data: contentStats,
    isError: contentStatsError,
  } = useQuery({
    queryKey: ['contentStats', 'overview'],
    queryFn: () => creation.getOverviewStats(),
    retry: 2,
    retryDelay: 2000,
  });

  /* 工作台数据总览（按时间范围） */
  const {
    data: workbenchStats,
    isLoading: workbenchStatsLoading,
    isError: workbenchStatsError,
    refetch: refetchWorkbenchStats,
  } = useQuery({
    queryKey: ['dashboard', 'workbench-stats', statsRange, isClient ? 'client' : 'admin'],
    queryFn: () => getWorkbenchStats({ range: statsRange }),
    retry: false,
  });

  /* AI 平台关键词覆盖 */
  const {
    data: aiPlatformCoverage,
    isLoading: aiPlatformCoverageLoading,
    isError: aiPlatformCoverageError,
    refetch: refetchAiPlatformCoverage,
  } = useQuery({
    queryKey: ['dashboard', 'ai-platform-coverage'],
    queryFn: () => getAiPlatformCoverage(),
    retry: false,
  });

  /* 热门关键词排名 */
  const {
    data: topKeywordRanking,
    isLoading: topKeywordRankingLoading,
    isError: topKeywordRankingError,
    refetch: refetchTopKeywordRanking,
  } = useQuery({
    queryKey: ['dashboard', 'top-keyword-ranking', 10],
    queryFn: () => getTopKeywordRanking(10),
    retry: false,
  });

  /* ========== 派生数据 ========== */
  const monthCreationTotal = useMemo(() => {
    if (isClient) {
      return (brandStats?.monthArticleCount ?? 0)
        + (brandStats?.monthImageCount ?? 0)
        + (brandStats?.monthVideoCount ?? 0);
    }
    return (contentStats?.monthArticleCount ?? 0)
      + (contentStats?.monthImageCount ?? 0)
      + (contentStats?.monthVideoCount ?? 0);
  }, [isClient, brandStats, contentStats]);

  // 待办任务数（admin）
  const adminTodoCount = useMemo(() => {
    return (stats?.pendingFollowups ?? 0)
      + (stats?.expiringIn30Days ?? 0)
      + (risks?.missedKeywords?.length ?? 0);
  }, [stats, risks]);

  // 待办任务数（client）：进行中创作 + 进行中诊断 + 未发布创作
  const clientTodoCount = useMemo(() => {
    const unpublished = Math.max(
      0,
      (brandStats?.creationTaskCount ?? 0) - (brandStats?.publicationCount ?? 0),
    );
    const inProgress = brandStats?.inProgressCreationCount ?? 0;
    const diagnosis = brandStats?.pendingDiagnosisCount ?? 0;
    return inProgress + diagnosis + unpublished;
  }, [brandStats]);

  const now = new Date();
  const updateTime = `${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

  const brandName = user?.displayName || user?.username || '';

  // 迷你折线数据（用于 KPI 组卡内 sparkline）
  const sparkline7day = useMemo(() => {
    if (isClient) {
      return (brandTrend ?? []).slice(-7).map((t) => t.creationCount);
    }
    return (trend ?? []).slice(-7).map((t) => t.rate);
  }, [isClient, brandTrend, trend]);

  /* ========== Admin：命中率趋势折线图 ========== */
  const trendOption: EChartsOption = useMemo(() => ({
    tooltip: {
      trigger: 'axis',
      backgroundColor: '#FFFFFF',
      borderColor: C.border,
      borderWidth: 1,
      textStyle: { color: C.textMain, fontSize: 12 },
      formatter: (params: unknown) => {
        const p = (params as Array<{ name: string; value: number }>)[0];
        return p ? `${p.name}<br/><span style="color:${C.primary}">●</span> 命中率: <b>${p.value}%</b>` : '';
      },
    },
    grid: { left: 20, right: 20, top: 20, bottom: 30 },
    xAxis: {
      type: 'category',
      data: trend?.map((t) => t.month) ?? [],
      axisLine: { show: false },
      axisLabel: { color: C.textMuted, fontSize: 11 },
      axisTick: { show: false },
    },
    yAxis: {
      type: 'value',
      axisLabel: {
        color: C.textMuted,
        fontSize: 11,
        formatter: '{value}%',
      },
      splitLine: { lineStyle: { color: C.gridLine, type: 'dashed' } },
      axisLine: { show: false },
      axisTick: { show: false },
    },
    series: [
      {
        type: 'line',
        data: trend?.map((t) => t.rate) ?? [],
        smooth: true,
        symbol: 'circle',
        symbolSize: 6,
        lineStyle: { color: C.primary, width: 2.5 },
        itemStyle: { color: C.primary, borderColor: C.panel, borderWidth: 2 },
        areaStyle: {
          color: {
            type: 'linear',
            x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: 'rgba(59, 91, 255, 0.2)' },
              { offset: 1, color: 'rgba(59, 91, 255, 0)' },
            ],
          },
        },
      },
    ],
  }), [trend]);

  /* ========== Client：创作 + 发布双折线 ========== */
  const brandTrendOption: EChartsOption = useMemo(() => ({
    tooltip: {
      trigger: 'axis',
      backgroundColor: '#FFFFFF',
      borderColor: C.border,
      borderWidth: 1,
      textStyle: { color: C.textMain, fontSize: 12 },
    },
    legend: {
      data: ['创作任务', '发布数'],
      top: 0,
      right: 0,
      textStyle: { color: C.textSecondary, fontSize: 12 },
      itemGap: 20,
      icon: 'circle',
    },
    grid: { left: 20, right: 20, top: 36, bottom: 30 },
    xAxis: {
      type: 'category',
      data: brandTrend?.map((t) => t.date.slice(5)) ?? [],
      axisLine: { show: false },
      axisLabel: { color: C.textMuted, fontSize: 11, interval: 4 },
      axisTick: { show: false },
    },
    yAxis: {
      type: 'value',
      axisLabel: { color: C.textMuted, fontSize: 11 },
      splitLine: { lineStyle: { color: C.gridLine, type: 'dashed' } },
      axisLine: { show: false },
      axisTick: { show: false },
    },
    series: [
      {
        name: '创作任务',
        type: 'line',
        data: brandTrend?.map((t) => t.creationCount) ?? [],
        smooth: true,
        symbol: 'circle',
        symbolSize: 4,
        lineStyle: { color: C.primary, width: 2 },
        itemStyle: { color: C.primary },
        areaStyle: {
          color: {
            type: 'linear',
            x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: 'rgba(59, 91, 255, 0.2)' },
              { offset: 1, color: 'rgba(59, 91, 255, 0)' },
            ],
          },
        },
      },
      {
        name: '发布数',
        type: 'line',
        data: brandTrend?.map((t) => t.publicationCount) ?? [],
        smooth: true,
        symbol: 'circle',
        symbolSize: 4,
        lineStyle: { color: C.chart3, width: 2 },
        itemStyle: { color: C.chart3 },
      },
    ],
  }), [brandTrend]);

  /* ========== Admin：各平台分布环形图 ========== */
  const platformDonutOption: EChartsOption = useMemo(() => {
    const data = platformDist?.map((p) => ({
      name: PLATFORM_LABELS[p.platform as keyof typeof PLATFORM_LABELS] ?? p.platform,
      value: p.hit,
    })) ?? [];
    const palette = [C.chart1, C.chart2, C.chart3, C.chart4, C.chart5];
    return {
      tooltip: {
        trigger: 'item',
        backgroundColor: '#FFFFFF',
        borderColor: C.border,
        borderWidth: 1,
        textStyle: { color: C.textMain, fontSize: 12 },
        formatter: '{b}: {c} ({d}%)',
      },
      legend: {
        orient: 'vertical',
        right: 12,
        top: 'center',
        textStyle: { color: C.textSecondary, fontSize: 12 },
        itemWidth: 10,
        itemHeight: 10,
        itemGap: 12,
      },
      series: [
        {
          type: 'pie',
          radius: ['55%', '78%'],
          center: ['35%', '50%'],
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

  /* ========== Client：内容类型占比环形图 ========== */
  const contentTypeDonutOption: EChartsOption = useMemo(() => {
    const article = brandStats?.monthArticleCount ?? 0;
    const image = brandStats?.monthImageCount ?? 0;
    const video = brandStats?.monthVideoCount ?? 0;
    const data = [
      { name: '文章', value: article },
      { name: '图片', value: image },
      { name: '视频', value: video },
    ];
    const palette = [C.chart1, C.chart2, C.chart3];
    return {
      tooltip: {
        trigger: 'item',
        backgroundColor: '#FFFFFF',
        borderColor: C.border,
        borderWidth: 1,
        textStyle: { color: C.textMain, fontSize: 12 },
        formatter: '{b}: {c} ({d}%)',
      },
      legend: {
        orient: 'vertical',
        right: 12,
        top: 'center',
        textStyle: { color: C.textSecondary, fontSize: 12 },
        itemWidth: 10,
        itemHeight: 10,
        itemGap: 12,
      },
      series: [
        {
          type: 'pie',
          radius: ['55%', '78%'],
          center: ['35%', '50%'],
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
  }, [brandStats]);

  /* ========== 错误态条 ========== */
  const renderErrorBar = (message: string, onRetry: () => void) => (
    <div
      className="flex items-center justify-between rounded-xl px-4 py-3"
      style={{
        backgroundColor: 'rgba(247, 144, 9, 0.06)',
        border: '1px solid rgba(247, 144, 9, 0.2)',
      }}
    >
      <div className="flex items-center gap-2 text-sm" style={{ color: C.warning }}>
        <AlertCircle className="h-4 w-4" />
        <span>{message}</span>
      </div>
      <button
        onClick={onRetry}
        className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors"
        style={{ color: C.warning, backgroundColor: 'rgba(247, 144, 9, 0.08)' }}
        onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'rgba(247, 144, 9, 0.14)'; }}
        onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'rgba(247, 144, 9, 0.08)'; }}
      >
        <RefreshCw className="h-3.5 w-3.5" />
        重新加载
      </button>
    </div>
  );

  /* ========== 图表内嵌浅底容器 ========== */
  const ChartInner: React.FC<{ children: React.ReactNode; height?: number }> = ({
    children,
    height = 280,
  }) => (
    <div
      className="rounded-lg min-w-0 overflow-hidden"
      style={{ backgroundColor: C.panel2, padding: 16, height }}
    >
      {children}
    </div>
  );

  /* ========== Client 渲染分支 ========== */
  if (isClient) {
    return (
      <>
        <div
          className="min-h-screen px-4 py-4 md:px-6 md:py-5"
          style={{ backgroundColor: C.bg }}
        >
          {/* 错误态 */}
          {brandStatsError && renderErrorBar('数据加载中，请稍后刷新', () => refetchBrandStats())}

          {/* 页头标题区 */}
          <div data-page-header="true" className="mb-4">
            <h1
              className="text-[24px] font-bold leading-none"
              style={{ color: '#ffffff' }}
            >
              数据总览
            </h1>
            <p
              className="mt-2 text-[13px] font-normal leading-5"
              style={{ color: 'rgba(255,255,255,0.6)' }}
            >
              实时监控业务运行状态与内容产出表现
            </p>
          </div>

          {/* 数据总览 */}
          <div className="dashboard-card mb-4 p-5">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-[15px] font-semibold" style={{ color: C.textMain }}>
                数据总览
              </h3>
              {/* 时间筛选 */}
              <div className="flex items-center gap-1 rounded-lg p-1" style={{ backgroundColor: C.panel2 }}>
                {TIME_RANGE_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setStatsRange(opt.value)}
                    className="rounded-md px-3 py-1 text-xs font-medium transition-colors"
                    style={{
                      color: statsRange === opt.value ? '#ffffff' : C.textSecondary,
                      backgroundColor: statsRange === opt.value ? '#2E7DFF' : 'transparent',
                    }}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              {/* 文章生成数 */}
              <div className="rounded-xl p-4" style={{ backgroundColor: C.panel2 }}>
                <p className="text-[12px]" style={{ color: C.textMuted }}>文章生成数</p>
                {workbenchStatsLoading ? (
                  <Skeleton className="mt-2 h-8 w-24" style={{ backgroundColor: '#E8EDF5' }} />
                ) : workbenchStatsError ? (
                  <p className="mt-2 text-xs" style={{ color: C.danger }}>加载失败</p>
                ) : (
                  <p className="tnum mt-2 text-[28px] font-semibold leading-none" style={{ color: C.textMain }}>
                    {(workbenchStats?.articleCount ?? 0).toLocaleString('en-US')}
                    <span className="ml-0.5 text-[12px] font-normal" style={{ color: C.textMuted }}>篇</span>
                  </p>
                )}
              </div>
              {/* 发布数 */}
              <div className="rounded-xl p-4" style={{ backgroundColor: C.panel2 }}>
                <p className="text-[12px]" style={{ color: C.textMuted }}>发布数</p>
                {workbenchStatsLoading ? (
                  <Skeleton className="mt-2 h-8 w-24" style={{ backgroundColor: '#E8EDF5' }} />
                ) : workbenchStatsError ? (
                  <p className="mt-2 text-xs" style={{ color: C.danger }}>加载失败</p>
                ) : (
                  <p className="tnum mt-2 text-[28px] font-semibold leading-none" style={{ color: C.textMain }}>
                    {(workbenchStats?.publicationCount ?? 0).toLocaleString('en-US')}
                    <span className="ml-0.5 text-[12px] font-normal" style={{ color: C.textMuted }}>篇</span>
                  </p>
                )}
              </div>
              {/* AI 提及次数 */}
              <div className="rounded-xl p-4" style={{ backgroundColor: C.panel2 }}>
                <p className="text-[12px]" style={{ color: C.textMuted }}>AI 提及次数</p>
                {workbenchStatsLoading ? (
                  <Skeleton className="mt-2 h-8 w-24" style={{ backgroundColor: '#E8EDF5' }} />
                ) : workbenchStatsError ? (
                  <p className="mt-2 text-xs" style={{ color: C.danger }}>加载失败</p>
                ) : (
                  <p className="tnum mt-2 text-[28px] font-semibold leading-none" style={{ color: C.textMain }}>
                    {(workbenchStats?.aiMentionCount ?? 0).toLocaleString('en-US')}
                    <span className="ml-0.5 text-[12px] font-normal" style={{ color: C.textMuted }}>次</span>
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* KPI 三组卡 */}
          <div
            className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr] items-stretch"
            data-ai-section-type="card-stat"
          >
            {/* 组一：AI 可见度（最宽） */}
            <div className="dashboard-card p-5 flex flex-col">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-[15px] font-semibold" style={{ color: C.textMain }}>
                  AI 可见度
                </h3>
                <span className="text-xs" style={{ color: C.textMuted }}>实时更新</span>
              </div>
              <div className="flex flex-1 flex-col">
                <p className="text-[12px]" style={{ color: C.textMuted }}>
                  AI 命中率
                </p>
                {brandStatsLoading ? (
                  <Skeleton className="mt-1.5 h-8 w-20" style={{ backgroundColor: C.panel2 }} />
                ) : (
                  <>
                    <div className="mt-1 flex items-baseline gap-1">
                      <KpiNumber
                        value={brandStats?.keywordHitRate ?? 0}
                        className="text-[32px] leading-none font-semibold"
                        suffix="%"
                      />
                    </div>
                    <div className="mt-2">
                      <MiniSparkline
                        data={sparkline7day.length ? sparkline7day : [30, 45, 38, 52, 48, 60, 55]}
                        color={C.primary}
                        height={40}
                      />
                    </div>
                  </>
                )}
                <div className="mt-auto pt-3 space-y-0">
                  <div className="flex items-center justify-between py-2.5" style={{ borderTop: '1px solid rgba(16,24,40,.06)' }}>
                    <span className="text-[12px]" style={{ color: C.textMuted }}>关键词总数</span>
                    {brandStatsLoading ? (
                      <Skeleton className="h-4 w-12" style={{ backgroundColor: C.panel2 }} />
                    ) : (
                      <span className="tnum text-[13px] font-medium" style={{ color: C.textMain }}>
                        {brandStats?.keywordCount?.toLocaleString('en-US') ?? 0}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center justify-between py-2.5" style={{ borderTop: '1px solid rgba(16,24,40,.06)' }}>
                    <span className="text-[12px]" style={{ color: C.textMuted }}>本月创作</span>
                    {brandStatsLoading ? (
                      <Skeleton className="h-4 w-12" style={{ backgroundColor: C.panel2 }} />
                    ) : (
                      <span className="tnum text-[13px] font-medium" style={{ color: C.textMain }}>
                        {monthCreationTotal.toLocaleString('en-US')}
                        <span className="ml-0.5 text-[12px] font-normal" style={{ color: C.textMuted }}>篇</span>
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* 组二：内容与发布 */}
            <div className="dashboard-card p-5 flex flex-col">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-[15px] font-semibold" style={{ color: C.textMain }}>
                  内容与发布
                </h3>
                <span className="text-xs" style={{ color: C.textMuted }}>本月</span>
              </div>
              <div className="flex flex-1 flex-col">
                <p className="text-[12px]" style={{ color: C.textMuted }}>
                  已收录信源
                </p>
                {brandStatsLoading ? (
                  <Skeleton className="mt-1.5 h-8 w-20" style={{ backgroundColor: C.panel2 }} />
                ) : (
                  <p className="tnum text-[32px] font-semibold leading-none mt-1" style={{ color: C.textMain }}>
                    {brandStats?.monthSubmissionIndexedCount?.toLocaleString('en-US') ?? 0}
                    <span className="text-[12px] font-normal ml-0.5" style={{ color: C.textMuted }}>个</span>
                  </p>
                )}
                <div className="mt-auto pt-3 space-y-0">
                  <div className="flex items-center justify-between py-2.5" style={{ borderTop: '1px solid rgba(16,24,40,.06)' }}>
                    <span className="text-[12px]" style={{ color: C.textMuted }}>本月发布</span>
                    {brandStatsLoading ? (
                      <Skeleton className="h-4 w-12" style={{ backgroundColor: C.panel2 }} />
                    ) : (
                      <span className="tnum text-[13px] font-medium" style={{ color: C.textMain }}>
                        {brandStats?.monthPublicationCount?.toLocaleString('en-US') ?? 0}
                        <span className="ml-0.5 text-[12px] font-normal" style={{ color: C.textMuted }}>篇</span>
                      </span>
                    )}
                  </div>
                  <div className="flex items-center justify-between py-2.5" style={{ borderTop: '1px solid rgba(16,24,40,.06)' }}>
                    <span className="text-[12px]" style={{ color: C.textMuted }}>进行中创作</span>
                    {brandStatsLoading ? (
                      <Skeleton className="h-4 w-12" style={{ backgroundColor: C.panel2 }} />
                    ) : (
                      <span className="tnum text-[13px] font-medium" style={{ color: C.textMain }}>
                        {brandStats?.inProgressCreationCount?.toLocaleString('en-US') ?? 0}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* 组三：资源 */}
            <div className="dashboard-card p-5 flex flex-col">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-[15px] font-semibold" style={{ color: C.textMain }}>
                  资源
                </h3>
                <span className="text-xs" style={{ color: C.textMuted }}>概览</span>
              </div>
              <div className="flex flex-1 flex-col">
                <div className="flex items-center gap-1.5">
                  <Zap className="h-3.5 w-3.5" style={{ color: C.accent }} />
                  <p className="text-[12px]" style={{ color: C.textMuted }}>
                    算力余额
                  </p>
                </div>
                {brandStatsLoading ? (
                  <Skeleton className="mt-1.5 h-8 w-20" style={{ backgroundColor: C.panel2 }} />
                ) : (
                  <div className="mt-1 flex items-baseline gap-1">
                    <span className="tnum text-[32px] font-semibold leading-none" style={{ color: C.accent }}>
                      {brandStats?.creditBalance?.toLocaleString('en-US') ?? 0}
                    </span>
                    <span className="text-[12px] font-normal" style={{ color: C.textMuted }}>点</span>
                  </div>
                )}
                <div className="mt-auto pt-3 space-y-0">
                  <div className="flex items-center justify-between py-2.5" style={{ borderTop: '1px solid rgba(16,24,40,.06)' }}>
                    <span className="text-[12px]" style={{ color: C.textMuted }}>本月消耗</span>
                    {brandStatsLoading || !contentStats ? (
                      <Skeleton className="h-4 w-12" style={{ backgroundColor: C.panel2 }} />
                    ) : (
                      <span className="tnum text-[13px] font-medium" style={{ color: C.textMain }}>
                        {contentStats.monthCreditUsed.toLocaleString('en-US')}
                        <span className="ml-0.5 text-[12px] font-normal" style={{ color: C.textMuted }}>点</span>
                      </span>
                    )}
                  </div>
                  <div className="flex items-center justify-between py-2.5" style={{ borderTop: '1px solid rgba(16,24,40,.06)' }}>
                    <span className="text-[12px]" style={{ color: C.textMuted }}>待办事项</span>
                    {brandStatsLoading ? (
                      <Skeleton className="h-4 w-12" style={{ backgroundColor: C.panel2 }} />
                    ) : (
                        <div className="flex items-center gap-1.5">
                        <span className="tnum text-[13px] font-medium" style={{ color: C.textMain }}>
                          {clientTodoCount.toLocaleString('en-US')}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 行业观察 */}
          <div className="mt-7">
            <IndustryNewsMarquee
              items={industryNews}
              isLoading={industryNewsLoading}
            />
          </div>

          {/* 中部图表区 */}
          <div className="mt-7 grid grid-cols-1 gap-4 lg:grid-cols-5">
            {/* 左：趋势图 3 列 */}
            <div className="dashboard-card p-5 lg:col-span-3">
              <div className="mb-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-[15px] font-semibold" style={{ color: C.textMain }}>
                    近30天动态趋势
                  </h3>
                  <div className="flex items-center gap-4">
                    {['近7天', '近30天', '近90天'].map((item) => (
                      <button
                        key={item}
                        className="relative text-[12px] pb-1 transition-colors"
                        style={{
                          color: item === '近30天' ? C.primary : C.textSecondary,
                          fontWeight: item === '近30天' ? 600 : 400,
                        }}
                      >
                        {item}
                        {item === '近30天' && (
                          <span
                            className="absolute bottom-0 left-0 h-0.5 w-full"
                            style={{ backgroundColor: C.primary }}
                          />
                        )}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="mt-2 flex items-center gap-4">
                  <StatusPill label="AI检测" status="normal" />
                  <StatusPill label="创作" status="normal" />
                  <StatusPill label="发布" status="normal" />
                </div>
              </div>
              {brandTrendLoading ? (
                <ChartInner height={280}>
                  <Skeleton className="h-full w-full" style={{ backgroundColor: '#E8EDF5' }} />
                </ChartInner>
              ) : (
                <ChartInner height={280}>
                  <ReactECharts option={brandTrendOption} style={{ height: '100%', width: '100%' }} notMerge />
                </ChartInner>
              )}
            </div>

            {/* 右：内容分布 2 列 */}
            <div className="dashboard-card p-5 lg:col-span-2">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-[15px] font-semibold" style={{ color: C.textMain }}>
                  内容类型占比
                </h3>
                <div className="flex items-center gap-4">
                  {['近7天', '近30天', '近90天'].map((item) => (
                    <button
                      key={item}
                      className="relative text-[12px] pb-1 transition-colors"
                      style={{
                        color: item === '近30天' ? C.primary : C.textSecondary,
                        fontWeight: item === '近30天' ? 600 : 400,
                      }}
                    >
                      {item}
                      {item === '近30天' && (
                        <span
                          className="absolute bottom-0 left-0 h-0.5 w-full"
                          style={{ backgroundColor: C.primary }}
                        />
                      )}
                    </button>
                  ))}
                </div>
              </div>
              {brandStatsLoading ? (
                <ChartInner height={280}>
                  <Skeleton className="h-full w-full" style={{ backgroundColor: '#E8EDF5' }} />
                </ChartInner>
              ) : (
                <ChartInner height={280}>
                  <ReactECharts option={contentTypeDonutOption} style={{ height: '100%', width: '100%' }} notMerge />
                </ChartInner>
              )}
            </div>
          </div>

          {/* 底部三个区块 */}
          <div
            className="mt-7 grid grid-cols-1 gap-4 md:grid-cols-3"
            style={{ minHeight: 300 }}
          >
            {/* 待办提醒 */}
            <div className="dashboard-card p-5" style={{ minHeight: 300 }}>
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-[15px] font-semibold" style={{ color: C.textMain }}>待办提醒</h3>
              </div>
              {brandStatsLoading ? (
                <ListSkeleton rows={4} />
              ) : (
                <ul className="space-y-0">
                  {brandStats && brandStats.pendingDiagnosisCount > 0 && (
                    <li>
                      <UniversalLink to="/diagnosis?tab=reports" className="flex items-center justify-between no-underline transition-colors hover:bg-[#F6F8FC]" style={{ height: 44, padding: '0 8px', borderRadius: 6 }}>
                        <div className="flex items-center gap-3">
                          <div
                            className="flex h-8 w-8 items-center justify-center rounded-md"
                            style={{ backgroundColor: 'rgba(247, 144, 9, 0.1)', color: C.warning }}
                          >
                            <BarChart3 className="h-4 w-4" />
                          </div>
                          <div>
                            <p className="text-[13px] font-medium" style={{ color: C.textMain }}>待完成诊断</p>
                            <p className="text-[12px]" style={{ color: C.textMuted }}>{brandStats.pendingDiagnosisCount} 个任务进行中</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="tnum text-sm font-semibold" style={{ color: C.accent }}>
                            {brandStats.pendingDiagnosisCount}
                          </span>
                          <ChevronRight className="h-4 w-4" style={{ color: C.textMuted }} />
                        </div>
                      </UniversalLink>
                    </li>
                  )}
                  {brandStats && (brandStats.creationTaskCount - brandStats.publicationCount) > 0 && (
                    <li>
                      <UniversalLink to="/creation" className="flex items-center justify-between no-underline transition-colors hover:bg-[#F6F8FC]" style={{ height: 44, padding: '0 8px', borderRadius: 6 }}>
                        <div className="flex items-center gap-3">
                          <div
                            className="flex h-8 w-8 items-center justify-center rounded-md"
                            style={{ backgroundColor: 'rgba(59, 91, 255, 0.1)', color: C.primary }}
                          >
                            <TrendingUp className="h-4 w-4" />
                          </div>
                          <div>
                            <p className="text-[13px] font-medium" style={{ color: C.textMain }}>未发布内容</p>
                            <p className="text-[12px]" style={{ color: C.textMuted }}>
                              {brandStats.creationTaskCount - brandStats.publicationCount} 个创作待发布
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="tnum text-sm font-semibold" style={{ color: C.accent }}>
                            {brandStats.creationTaskCount - brandStats.publicationCount}
                          </span>
                          <ChevronRight className="h-4 w-4" style={{ color: C.textMuted }} />
                        </div>
                      </UniversalLink>
                    </li>
                  )}
                  {brandStats && (
                    <li>
                      <UniversalLink to="/publication" className="flex items-center justify-between no-underline transition-colors hover:bg-[#F6F8FC]" style={{ height: 44, padding: '0 8px', borderRadius: 6 }}>
                        <div className="flex items-center gap-3">
                          <div
                            className="flex h-8 w-8 items-center justify-center rounded-md"
                            style={{ backgroundColor: 'rgba(18, 183, 106, 0.1)', color: C.success }}
                          >
                            <Send className="h-4 w-4" />
                          </div>
                          <div>
                            <p className="text-[13px] font-medium" style={{ color: C.textMain }}>本月发布</p>
                            <p className="text-[12px]" style={{ color: C.textMuted }}>已发布内容统计</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="tnum text-sm font-semibold" style={{ color: C.accent }}>
                            {brandStats.monthPublicationCount}
                          </span>
                          <ChevronRight className="h-4 w-4" style={{ color: C.textMuted }} />
                        </div>
                      </UniversalLink>
                    </li>
                  )}
                  {brandStats && (
                    <li>
                      <UniversalLink to="/creation" className="flex items-center justify-between no-underline transition-colors hover:bg-[#F6F8FC]" style={{ height: 44, padding: '0 8px', borderRadius: 6 }}>
                        <div className="flex items-center gap-3">
                          <div
                            className="flex h-8 w-8 items-center justify-center rounded-md"
                            style={{ backgroundColor: 'rgba(0, 194, 255, 0.1)', color: C.accent }}
                          >
                            <Sparkles className="h-4 w-4" />
                          </div>
                          <div>
                            <p className="text-[13px] font-medium" style={{ color: C.textMain }}>创作总览</p>
                            <p className="text-[12px]" style={{ color: C.textMuted }}>查看全部创作任务</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="tnum text-sm font-semibold" style={{ color: C.accent }}>
                            {brandStats.creationTaskCount}
                          </span>
                          <ChevronRight className="h-4 w-4" style={{ color: C.textMuted }} />
                        </div>
                      </UniversalLink>
                    </li>
                  )}
                </ul>
              )}
            </div>

            {/* 最近动态 */}
            <div className="dashboard-card p-5" style={{ minHeight: 300 }}>
              <div className="mb-4 flex items-center gap-2">
                <Radio className="h-4 w-4" style={{ color: C.primary }} />
                <h3 className="text-[15px] font-semibold" style={{ color: C.textMain }}>最近动态</h3>
              </div>
              {brandStatsLoading ? (
                <ListSkeleton rows={5} />
              ) : (
                <div className="relative pl-4">
                  <div
                    className="absolute left-[7px] top-1 bottom-1 w-px"
                    style={{ backgroundColor: C.border }}
                  />
                  <ul className="space-y-3.5">
                    <TimelineItem
                      time={updateTime}
                      text={`投稿收录：${brandStats?.monthSubmissionIndexedCount ?? 0} 篇已收录`}
                      highlight
                    />
                    <TimelineItem
                      time={updateTime}
                      text={`本月创作：${monthCreationTotal} 篇内容生成`}
                    />
                    <TimelineItem
                      time={updateTime}
                      text={`本月发布：${brandStats?.monthPublicationCount ?? 0} 条内容`}
                    />
                    <TimelineItem
                      time={updateTime}
                      text={`关键词总数：${brandStats?.keywordCount ?? 0} 个`}
                    />
                    <TimelineItem
                      time={updateTime}
                      text={`算力余额：${brandStats?.creditBalance ?? 0} 点`}
                    />
                  </ul>
                </div>
              )}
            </div>

            {/* 信源健康度 — 四个横向小指标块 */}
            <div className="dashboard-card p-5" style={{ minHeight: 300 }}>
              <div className="mb-4 flex items-center gap-2">
                <Activity className="h-4 w-4" style={{ color: C.primary }} />
                <h3 className="text-[15px] font-semibold" style={{ color: C.textMain }}>信源健康度</h3>
              </div>
              {brandStatsLoading ? (
                <div className="grid grid-cols-2 gap-3">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="rounded-lg p-3" style={{ backgroundColor: C.panel2 }}>
                      <Skeleton className="h-3 w-12 mb-2" style={{ backgroundColor: '#E8EDF5' }} />
                      <Skeleton className="h-5 w-16" style={{ backgroundColor: '#E8EDF5' }} />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  <HealthMetricBlock
                    icon={<Inbox className="h-4 w-4" />}
                    iconColor={C.primary}
                    name="投稿收录"
                    value={brandStats?.monthSubmissionIndexedCount ?? 0}
                    status="success"
                    suffix="篇"
                  />
                  <HealthMetricBlock
                    icon={<Send className="h-4 w-4" />}
                    iconColor={C.chart2}
                    name="发布完成率"
                    value={monthCreationTotal > 0 ? Math.round(((brandStats?.monthPublicationCount ?? 0) / monthCreationTotal) * 100) : 0}
                    status={monthCreationTotal > 0 && (brandStats?.monthPublicationCount ?? 0) / monthCreationTotal >= 0.6 ? 'success' : 'warning'}
                    suffix="%"
                  />
                  <HealthMetricBlock
                    icon={<Target className="h-4 w-4" />}
                    iconColor={C.chart3}
                    name="AI 命中率"
                    value={brandStats?.keywordHitRate ?? 0}
                    status={(brandStats?.keywordHitRate ?? 0) >= 60 ? 'success' : 'warning'}
                    suffix="%"
                  />
                  <HealthMetricBlock
                    icon={<Sparkles className="h-4 w-4" />}
                    iconColor={C.chart4}
                    name="内容产出"
                    value={monthCreationTotal}
                    status="success"
                    suffix="篇"
                  />
                </div>
              )}
            </div>
          </div>

          {/* AI 平台关键词覆盖 */}
          <div className="dashboard-card mt-7 p-5">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-[15px] font-semibold" style={{ color: C.textMain }}>
                AI 平台关键词覆盖
              </h3>
            </div>
            {aiPlatformCoverageLoading ? (
              <TableSkeleton rows={6} />
            ) : aiPlatformCoverageError ? (
              <div className="flex items-center justify-between rounded-lg px-4 py-3 text-sm" style={{ backgroundColor: 'rgba(247, 144, 9, 0.06)', border: '1px solid rgba(247, 144, 9, 0.2)' }}>
                <span style={{ color: C.warning }}>加载失败，请重试</span>
                <button onClick={() => refetchAiPlatformCoverage()} className="text-xs" style={{ color: C.primary }}>重试</button>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto rounded-lg border" style={{ borderColor: C.border }}>
                  <table className="w-full text-sm">
                    <thead style={{ backgroundColor: '#F7F9FC' }}>
                      <tr>
                        <th className="px-4 py-2.5 text-left text-xs font-medium" style={{ color: C.textSecondary }}>平台</th>
                        <th className="px-4 py-2.5 text-right text-xs font-medium tnum" style={{ color: C.textSecondary }}>已检测关键词数</th>
                        <th className="px-4 py-2.5 text-right text-xs font-medium tnum" style={{ color: C.textSecondary }}>平均提及率</th>
                        <th className="px-4 py-2.5 text-right text-xs font-medium tnum" style={{ color: C.textSecondary }}>平均位次</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(['doubao', 'tongyi', 'yuanbao', 'deepseek', 'kimi', 'wenxin'] as const).map((platformKey) => {
                        const label = DIAGNOSIS_PLATFORM_LABELS[platformKey];
                        const item = (aiPlatformCoverage ?? []).find(
                          (c: AiPlatformCoverage) => c.platform === platformKey,
                        );
                        return (
                          <tr key={platformKey} style={{ borderTop: `1px solid ${C.border}` }}>
                            <td className="px-4 py-2.5 text-xs font-medium" style={{ color: C.textMain }}>
                              {label}
                            </td>
                            <td className="px-4 py-2.5 text-right text-xs tnum" style={{ color: C.textSecondary }}>
                              {item ? item.keywordCount.toLocaleString('en-US') : '-'}
                            </td>
                            <td className="px-4 py-2.5 text-right text-xs tnum" style={{ color: C.textSecondary }}>
                              {item ? `${item.avgMentionRate.toFixed(1)}%` : '-'}
                            </td>
                            <td className="px-4 py-2.5 text-right text-xs tnum" style={{ color: C.textSecondary }}>
                              {item && item.avgRank !== null ? item.avgRank.toFixed(1) : '-'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <p className="mt-3 text-[12px]" style={{ color: C.textMuted }}>
                  统计自本系统 AI 检测任务真实结果；未检测的平台显示为空。
                </p>
              </>
            )}
          </div>

          {/* 热门关键词排名 */}
          <div className="dashboard-card mt-4 p-5">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-[15px] font-semibold" style={{ color: C.textMain }}>
                热门关键词排名
              </h3>
            </div>
            {topKeywordRankingLoading ? (
              <TableSkeleton rows={5} />
            ) : topKeywordRankingError ? (
              <div className="flex items-center justify-between rounded-lg px-4 py-3 text-sm" style={{ backgroundColor: 'rgba(247, 144, 9, 0.06)', border: '1px solid rgba(247, 144, 9, 0.2)' }}>
                <span style={{ color: C.warning }}>加载失败，请重试</span>
                <button onClick={() => refetchTopKeywordRanking()} className="text-xs" style={{ color: C.primary }}>重试</button>
              </div>
            ) : !topKeywordRanking || topKeywordRanking.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8">
                <Inbox className="mb-2 h-8 w-8" style={{ color: C.textMuted }} />
                <p className="text-sm" style={{ color: C.textMuted }}>还没有检测结果，去检测任务跑一轮</p>
                <Button variant="outline" size="sm" onClick={() => navigate('/keywords/tasks')} className="mt-3">
                  前往检测任务
                </Button>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-lg border" style={{ borderColor: C.border }}>
                <table className="w-full text-sm">
                  <thead style={{ backgroundColor: '#F7F9FC' }}>
                    <tr>
                      <th className="px-4 py-2.5 text-left text-xs font-medium" style={{ color: C.textSecondary }}>核心关键词</th>
                      <th className="px-4 py-2.5 text-left text-xs font-medium" style={{ color: C.textSecondary }}>扩展词</th>
                      <th className="px-4 py-2.5 text-left text-xs font-medium" style={{ color: C.textSecondary }}>排名平台</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topKeywordRanking.map((item: HotKeywordRank, idx: number) => (
                      <tr key={`${item.keyword}-${item.platform}-${idx}`} style={{ borderTop: `1px solid ${C.border}` }}>
                        <td className="px-4 py-2.5 text-xs font-medium" style={{ color: C.textMain }}>
                          {item.keyword}
                        </td>
                        <td className="px-4 py-2.5 text-xs" style={{ color: C.textSecondary }}>
                          {item.extendedKeyword || '-'}
                        </td>
                        <td className="px-4 py-2.5 text-xs">
                          <span style={{ color: C.textMain }}>{item.platformLabel}</span>
                          <Badge variant="default" className="ml-2 tnum" style={{ fontSize: 11 }}>
                            第{item.rank}位
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* 内容产出错误提示 */}
          {contentStatsError && (
            <div
              className="mt-4 flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm"
              style={{
                backgroundColor: 'rgba(247, 144, 9, 0.08)',
                border: '1px solid rgba(247, 144, 9, 0.2)',
                color: C.warning,
              }}
            >
              <AlertCircle className="h-4 w-4" />
              <span>数据加载中，请稍后刷新</span>
            </div>
          )}
        </div>
      </>
    );
  }

  /* ========== Admin / Operator 渲染分支 ========== */
  return (
    <div
      className="min-h-full w-full px-4 py-4 md:px-6 md:py-5"
      style={{ backgroundColor: C.bg }}
    >

      {/* 错误态 */}
      {statsError && renderErrorBar('数据加载中，请稍后刷新', () => refetchStats())}

      {/* 页头标题区 */}
      <div data-page-header="true" className="mb-4">
        <h1
          className="text-[24px] font-bold leading-none"
          style={{ color: '#ffffff' }}
        >
          数据总览
        </h1>
        <p
          className="mt-2 text-[13px] font-normal leading-5"
          style={{ color: 'rgba(255,255,255,0.6)' }}
        >
          实时监控业务运行状态与内容产出表现
        </p>
      </div>

      {/* 数据总览 */}
      <div className="dashboard-card mb-4 p-5">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-[15px] font-semibold" style={{ color: C.textMain }}>
            数据总览
          </h3>
          <div className="flex items-center gap-1 rounded-lg p-1" style={{ backgroundColor: C.panel2 }}>
            {TIME_RANGE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setStatsRange(opt.value)}
                className="rounded-md px-3 py-1 text-xs font-medium transition-colors"
                style={{
                  color: statsRange === opt.value ? '#ffffff' : C.textSecondary,
                  backgroundColor: statsRange === opt.value ? '#2E7DFF' : 'transparent',
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="rounded-xl p-4" style={{ backgroundColor: C.panel2 }}>
            <p className="text-[12px]" style={{ color: C.textMuted }}>文章生成数</p>
            {workbenchStatsLoading ? (
              <Skeleton className="mt-2 h-8 w-24" style={{ backgroundColor: '#E8EDF5' }} />
            ) : workbenchStatsError ? (
              <p className="mt-2 text-xs" style={{ color: C.danger }}>加载失败</p>
            ) : (
              <p className="tnum mt-2 text-[28px] font-semibold leading-none" style={{ color: C.textMain }}>
                {(workbenchStats?.articleCount ?? 0).toLocaleString('en-US')}
                <span className="ml-0.5 text-[12px] font-normal" style={{ color: C.textMuted }}>篇</span>
              </p>
            )}
          </div>
          <div className="rounded-xl p-4" style={{ backgroundColor: C.panel2 }}>
            <p className="text-[12px]" style={{ color: C.textMuted }}>发布数</p>
            {workbenchStatsLoading ? (
              <Skeleton className="mt-2 h-8 w-24" style={{ backgroundColor: '#E8EDF5' }} />
            ) : workbenchStatsError ? (
              <p className="mt-2 text-xs" style={{ color: C.danger }}>加载失败</p>
            ) : (
              <p className="tnum mt-2 text-[28px] font-semibold leading-none" style={{ color: C.textMain }}>
                {(workbenchStats?.publicationCount ?? 0).toLocaleString('en-US')}
                <span className="ml-0.5 text-[12px] font-normal" style={{ color: C.textMuted }}>篇</span>
              </p>
            )}
          </div>
          <div className="rounded-xl p-4" style={{ backgroundColor: C.panel2 }}>
            <p className="text-[12px]" style={{ color: C.textMuted }}>AI 提及次数</p>
            {workbenchStatsLoading ? (
              <Skeleton className="mt-2 h-8 w-24" style={{ backgroundColor: '#E8EDF5' }} />
            ) : workbenchStatsError ? (
              <p className="mt-2 text-xs" style={{ color: C.danger }}>加载失败</p>
            ) : (
              <p className="tnum mt-2 text-[28px] font-semibold leading-none" style={{ color: C.textMain }}>
                {(workbenchStats?.aiMentionCount ?? 0).toLocaleString('en-US')}
                <span className="ml-0.5 text-[12px] font-normal" style={{ color: C.textMuted }}>次</span>
              </p>
            )}
          </div>
        </div>
      </div>

      {/* KPI 三组卡 */}
      <div
        className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr] items-stretch"
        data-ai-section-type="card-stat"
      >
        {/* 组一：关键词命中率（最宽） */}
        <div className="dashboard-card p-5 flex flex-col">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-[15px] font-semibold" style={{ color: C.textMain }}>
              关键词命中率
            </h3>
            <span className="text-xs" style={{ color: C.textMuted }}>
              {TIME_RANGE_OPTIONS.find(o => o.value === statsRange)?.label ?? '近7天'} / 全部品牌
            </span>
          </div>
          <div className="flex flex-1 flex-col">
            <p className="text-[12px]" style={{ color: C.textMuted }}>
              整体命中率
            </p>
            {statsLoading ? (
              <Skeleton className="mt-1.5 h-8 w-20" style={{ backgroundColor: C.panel2 }} />
            ) : (stats?.keywordTotal ?? 0) === 0 ? (
              <>
                <div className="mt-1 flex items-baseline gap-1">
                  <span
                    className="text-[32px] leading-none font-semibold"
                    style={{ color: C.textMuted }}
                  >
                    -
                  </span>
                </div>
                <p className="mt-2 text-[12px]" style={{ color: C.textMuted }}>
                  暂无数据
                </p>
              </>
            ) : (
              <>
                <div className="mt-1 flex items-baseline gap-1">
                  <KpiNumber
                    value={stats?.keywordHitRate ?? 0}
                    className="text-[32px] leading-none font-semibold"
                    suffix="%"
                    decimals={1}
                  />
                </div>
                <div className="mt-2">
                  <MiniSparkline
                    data={sparkline7day.length ? sparkline7day : [30, 45, 38, 52, 48, 60, 55]}
                    color={C.primary}
                    height={40}
                  />
                </div>
              </>
            )}
            <div className="mt-auto pt-3 space-y-0">
              <div className="flex items-center justify-between py-2.5" style={{ borderTop: '1px solid rgba(16,24,40,.06)' }}>
                <span className="text-[12px]" style={{ color: C.textMuted }}>在服务客户</span>
                {statsLoading ? (
                  <Skeleton className="h-4 w-12" style={{ backgroundColor: C.panel2 }} />
                ) : (
                  <span className="tnum text-[13px] font-medium" style={{ color: C.textMain }}>
                    {stats?.activeCustomers?.toLocaleString('en-US') ?? 0}
                    <span className="ml-0.5 text-[12px] font-normal" style={{ color: C.textMuted }}>家</span>
                  </span>
                )}
              </div>
              <div className="flex items-center justify-between py-2.5" style={{ borderTop: '1px solid rgba(16,24,40,.06)' }}>
                <span className="text-[12px]" style={{ color: C.textMuted }}>本月创作</span>
                {statsLoading ? (
                  <Skeleton className="h-4 w-12" style={{ backgroundColor: C.panel2 }} />
                ) : (
                  <span className="tnum text-[13px] font-medium" style={{ color: C.textMain }}>
                    {monthCreationTotal.toLocaleString('en-US')}
                    <span className="ml-0.5 text-[12px] font-normal" style={{ color: C.textMuted }}>篇</span>
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* 组二：线索与跟进 */}
        <div className="dashboard-card p-5 flex flex-col">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-[15px] font-semibold" style={{ color: C.textMain }}>
              线索与跟进
            </h3>
            <span className="text-xs" style={{ color: C.textMuted }}>待处理</span>
          </div>
          <div className="flex flex-1 flex-col">
            <p className="text-[12px]" style={{ color: C.textMuted }}>
              待跟进线索
            </p>
            {statsLoading ? (
              <Skeleton className="mt-1.5 h-8 w-20" style={{ backgroundColor: C.panel2 }} />
            ) : (
              <p className="tnum text-[32px] font-semibold leading-none mt-1" style={{ color: C.textMain }}>
                {stats?.pendingFollowups?.toLocaleString('en-US') ?? 0}
              </p>
            )}
            <div className="mt-auto pt-3 space-y-0">
              <div className="flex items-center justify-between py-2.5" style={{ borderTop: '1px solid rgba(16,24,40,.06)' }}>
                <span className="text-[12px]" style={{ color: C.textMuted }}>30天内到期</span>
                {statsLoading ? (
                  <Skeleton className="h-4 w-12" style={{ backgroundColor: C.panel2 }} />
                ) : (
                  <span className="tnum text-[13px] font-medium" style={{ color: C.textMain }}>
                    {stats?.expiringIn30Days?.toLocaleString('en-US') ?? 0}
                    <span className="ml-0.5 text-[12px] font-normal" style={{ color: C.textMuted }}>家</span>
                  </span>
                )}
              </div>
              <div className="flex items-center justify-between py-2.5" style={{ borderTop: '1px solid rgba(16,24,40,.06)' }}>
                <span className="text-[12px]" style={{ color: C.textMuted }}>逾期跟进</span>
                {statsLoading ? (
                  <Skeleton className="h-4 w-12" style={{ backgroundColor: C.panel2 }} />
                ) : (
                  <span className="tnum text-[13px] font-medium" style={{ color: C.danger }}>
                    {stats?.overdueCount?.toLocaleString('en-US') ?? 0}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* 组三：资源 */}
        <div className="dashboard-card p-5 flex flex-col">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-[15px] font-semibold" style={{ color: C.textMain }}>
              资源
            </h3>
            <span className="text-xs" style={{ color: C.textMuted }}>概览</span>
          </div>
          <div className="flex flex-1 flex-col">
            <div className="flex items-center gap-1.5">
              <Zap className="h-3.5 w-3.5" style={{ color: C.accent }} />
              <p className="text-[12px]" style={{ color: C.textMuted }}>
                本月算力消耗
              </p>
            </div>
            {statsLoading || !contentStats ? (
              <Skeleton className="mt-1.5 h-8 w-20" style={{ backgroundColor: C.panel2 }} />
            ) : (
              <div className="mt-1 flex items-baseline gap-1">
                <span className="tnum text-[32px] font-semibold leading-none" style={{ color: C.accent }}>
                  {contentStats.monthCreditUsed.toLocaleString('en-US')}
                </span>
                <span className="text-[12px] font-normal" style={{ color: C.textMuted }}>点</span>
              </div>
            )}
            <div className="mt-auto pt-3 space-y-0">
              <div className="flex items-center justify-between py-2.5" style={{ borderTop: '1px solid rgba(16,24,40,.06)' }}>
                <span className="text-[12px]" style={{ color: C.textMuted }}>待办任务</span>
                {statsLoading || risksLoading ? (
                  <Skeleton className="h-4 w-12" style={{ backgroundColor: C.panel2 }} />
                ) : (
                  <div className="flex items-center gap-1.5">
                    <span className="tnum text-[13px] font-medium" style={{ color: C.textMain }}>
                      {adminTodoCount.toLocaleString('en-US')}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 行业资讯 */}
      <div className="mt-7">
        <IndustryNewsMarquee
          items={industryNews}
          isLoading={industryNewsLoading}
        />
      </div>

      {/* 中部图表区 */}
      <div className="mt-7 grid grid-cols-1 gap-4 lg:grid-cols-5">
        {/* 左侧：趋势折线图 */}
        <div className="dashboard-card p-5 lg:col-span-3">
          <div className="mb-3">
            <div className="flex items-center justify-between">
              <h3 className="text-[15px] font-semibold" style={{ color: C.textMain }}>
                近30天动态趋势
              </h3>
              <div className="flex items-center gap-4">
                {['近7天', '近30天', '近90天'].map((item) => (
                  <button
                    key={item}
                    className="relative text-[12px] pb-1 transition-colors"
                    style={{
                      color: item === '近30天' ? C.primary : C.textSecondary,
                      fontWeight: item === '近30天' ? 600 : 400,
                    }}
                  >
                    {item}
                    {item === '近30天' && (
                      <span
                        className="absolute bottom-0 left-0 h-0.5 w-full"
                        style={{ backgroundColor: C.primary }}
                      />
                    )}
                  </button>
                ))}
              </div>
            </div>
            <div className="mt-2 flex items-center gap-4">
              <StatusPill label="AI检测" status="normal" />
              <StatusPill label="创作" status="normal" />
              <StatusPill label="发布" status="normal" />
            </div>
          </div>
          <ChartInner height={280}>
            <ReactECharts option={trendOption} style={{ height: '100%', width: '100%' }} notMerge />
          </ChartInner>
        </div>

        {/* 右侧：各平台命中分布环形图 */}
        <div className="dashboard-card p-5 lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-[15px] font-semibold" style={{ color: C.textMain }}>
              各平台命中分布
            </h3>
            <div className="flex items-center gap-4">
              {['近7天', '近30天', '近90天'].map((item) => (
                <button
                  key={item}
                  className="relative text-[12px] pb-1 transition-colors"
                  style={{
                    color: item === '近30天' ? C.primary : C.textSecondary,
                    fontWeight: item === '近30天' ? 600 : 400,
                  }}
                >
                  {item}
                  {item === '近30天' && (
                    <span
                      className="absolute bottom-0 left-0 h-0.5 w-full"
                      style={{ backgroundColor: C.primary }}
                    />
                  )}
                </button>
              ))}
            </div>
          </div>
          {platformLoading ? (
            <ChartInner height={280}>
              <Skeleton className="h-full w-full" style={{ backgroundColor: '#E8EDF5' }} />
            </ChartInner>
          ) : (
            <ChartInner height={280}>
              <ReactECharts option={platformDonutOption} style={{ height: '100%', width: '100%' }} notMerge />
            </ChartInner>
          )}
        </div>
      </div>

      {/* 底部三个区块 */}
      <div
        className="mt-7 grid grid-cols-1 gap-4 md:grid-cols-3"
        style={{ minHeight: 300 }}
      >
        {/* 待办提醒 */}
        <div className="dashboard-card p-5" style={{ minHeight: 300 }}>
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-[15px] font-semibold" style={{ color: C.textMain }}>待办提醒</h3>
          </div>
          {statsLoading || risksLoading ? (
            <ListSkeleton rows={4} />
          ) : (
            <ul className="space-y-0">
              <li>
                <UniversalLink to="/leads" className="flex items-center justify-between no-underline transition-colors hover:bg-[#F6F8FC]" style={{ height: 44, padding: '0 8px', borderRadius: 6 }}>
                  <div className="flex items-center gap-3">
                    <div
                      className="flex h-8 w-8 items-center justify-center rounded-md"
                      style={{ backgroundColor: 'rgba(59, 91, 255, 0.1)', color: C.primary }}
                    >
                      <Clock className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-[13px] font-medium" style={{ color: C.textMain }}>待跟进线索</p>
                      <p className="text-[12px]" style={{ color: C.textMuted }}>
                        {stats?.overdueCount ? `含 ${stats.overdueCount} 个逾期` : '需尽快跟进'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="tnum text-sm font-semibold" style={{ color: C.accent }}>
                      {stats?.pendingFollowups ?? 0}
                    </span>
                    <ChevronRight className="h-4 w-4" style={{ color: C.textMuted }} />
                  </div>
                </UniversalLink>
              </li>
              <li>
                <UniversalLink to="/contracts?filter=expiring" className="flex items-center justify-between no-underline transition-colors hover:bg-[#F6F8FC]" style={{ height: 44, padding: '0 8px', borderRadius: 6 }}>
                  <div className="flex items-center gap-3">
                    <div
                      className="flex h-8 w-8 items-center justify-center rounded-md"
                      style={{ backgroundColor: 'rgba(247, 144, 9, 0.1)', color: C.warning }}
                    >
                      <AlertCircle className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-[13px] font-medium" style={{ color: C.textMain }}>临期客户</p>
                      <p className="text-[12px]" style={{ color: C.textMuted }}>30天内合同到期</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="tnum text-sm font-semibold" style={{ color: C.accent }}>
                      {stats?.expiringIn30Days ?? 0}
                    </span>
                    <ChevronRight className="h-4 w-4" style={{ color: C.textMuted }} />
                  </div>
                </UniversalLink>
              </li>
              <li>
                <UniversalLink to="/keywords?filter=missed" className="flex items-center justify-between no-underline transition-colors hover:bg-[#F6F8FC]" style={{ height: 44, padding: '0 8px', borderRadius: 6 }}>
                  <div className="flex items-center gap-3">
                    <div
                      className="flex h-8 w-8 items-center justify-center rounded-md"
                      style={{ backgroundColor: 'rgba(240, 68, 56, 0.1)', color: C.danger }}
                    >
                      <Target className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-[13px] font-medium" style={{ color: C.textMain }}>未命中关键词</p>
                      <p className="text-[12px]" style={{ color: C.textMuted }}>需要优化的核心词</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="tnum text-sm font-semibold" style={{ color: C.accent }}>
                      {risks?.missedKeywords?.length ?? 0}
                    </span>
                    <ChevronRight className="h-4 w-4" style={{ color: C.textMuted }} />
                  </div>
                </UniversalLink>
              </li>
              <li>
                <UniversalLink to="/creation" className="flex items-center justify-between no-underline transition-colors hover:bg-[#F6F8FC]" style={{ height: 44, padding: '0 8px', borderRadius: 6 }}>
                  <div className="flex items-center gap-3">
                    <div
                      className="flex h-8 w-8 items-center justify-center rounded-md"
                      style={{ backgroundColor: 'rgba(0, 194, 255, 0.1)', color: C.accent }}
                    >
                      <Sparkles className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-[13px] font-medium" style={{ color: C.textMain }}>内容创作</p>
                      <p className="text-[12px]" style={{ color: C.textMuted }}>本月创作概览</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="tnum text-sm font-semibold" style={{ color: C.accent }}>
                      {monthCreationTotal}
                    </span>
                    <ChevronRight className="h-4 w-4" style={{ color: C.textMuted }} />
                  </div>
                </UniversalLink>
              </li>
            </ul>
          )}
        </div>

        {/* 最近动态 */}
        <div className="dashboard-card p-5" style={{ minHeight: 300 }}>
          <div className="mb-4 flex items-center gap-2">
            <Radio className="h-4 w-4" style={{ color: C.primary }} />
            <h3 className="text-[15px] font-semibold" style={{ color: C.textMain }}>最近动态</h3>
          </div>
          {risksLoading || statsLoading ? (
            <ListSkeleton rows={5} />
          ) : (
            <div className="relative pl-4">
              <div
                className="absolute left-[7px] top-1 bottom-1 w-px"
                style={{ backgroundColor: C.border }}
              />
              <ul className="space-y-3.5">
                {(risks?.expiringCustomers?.length ?? 0) > 0 && risks?.expiringCustomers?.[0] && (
                  <TimelineItem
                    time={updateTime}
                    text={`合同临期：${risks.expiringCustomers[0].name}（剩 ${risks.expiringCustomers[0].daysLeft} 天）`}
                    highlight
                  />
                )}
                {(risks?.missedKeywords?.length ?? 0) > 0 && risks?.missedKeywords?.[0] && (
                  <TimelineItem
                    time={updateTime}
                    text={`未命中词：${risks.missedKeywords[0].keyword} @ ${PLATFORM_LABELS[risks.missedKeywords[0].platform as keyof typeof PLATFORM_LABELS] ?? risks.missedKeywords[0].platform}`}
                  />
                )}
                <TimelineItem
                  time={updateTime}
                  text={`客户运营：${stats?.activeCustomers ?? 0} 家客户在服务`}
                />
                <TimelineItem
                  time={updateTime}
                  text={`线索跟进：${stats?.pendingFollowups ?? 0} 条待跟进`}
                />
                <TimelineItem
                  time={updateTime}
                  text={`内容产出：本月 ${monthCreationTotal} 篇创作`}
                />
              </ul>
            </div>
          )}
        </div>

        {/* 各平台命中分布 — 四个横向小指标块 */}
        <div className="dashboard-card p-5" style={{ minHeight: 300 }}>
          <div className="mb-4 flex items-center gap-2">
            <FileCheck className="h-4 w-4" style={{ color: C.primary }} />
            <h3 className="text-[15px] font-semibold" style={{ color: C.textMain }}>各平台命中分布</h3>
          </div>
          {platformLoading ? (
            <div className="grid grid-cols-2 gap-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="rounded-lg p-3" style={{ backgroundColor: C.panel2 }}>
                  <Skeleton className="h-3 w-12 mb-2" style={{ backgroundColor: '#E8EDF5' }} />
                  <Skeleton className="h-5 w-16" style={{ backgroundColor: '#E8EDF5' }} />
                </div>
              ))}
            </div>
          ) : (platformDist?.length ?? 0) === 0 ? (
            <div className="py-6 text-center text-sm" style={{ color: C.textMuted }}>
              暂无数据
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {(platformDist ?? []).slice(0, 4).map((p, idx) => {
                const name = PLATFORM_LABELS[p.platform as keyof typeof PLATFORM_LABELS] ?? p.platform;
                const total = p.total || 1;
                const pct = Math.round((p.hit / total) * 100);
                const palette = [C.chart1, C.chart2, C.chart3, C.chart4];
                return (
                  <HealthMetricBlock
                    key={p.platform}
                    icon={<BarChart3 className="h-4 w-4" />}
                    iconColor={palette[idx % palette.length]}
                    name={name}
                    value={pct}
                    status={pct >= 60 ? 'success' : pct >= 40 ? 'warning' : 'danger'}
                    suffix="%"
                  />
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* AI 平台关键词覆盖 */}
      <div className="dashboard-card mt-7 p-5">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-[15px] font-semibold" style={{ color: C.textMain }}>
            AI 平台关键词覆盖
          </h3>
        </div>
        {aiPlatformCoverageLoading ? (
          <TableSkeleton rows={6} />
        ) : aiPlatformCoverageError ? (
          <div className="flex items-center justify-between rounded-lg px-4 py-3 text-sm" style={{ backgroundColor: 'rgba(247, 144, 9, 0.06)', border: '1px solid rgba(247, 144, 9, 0.2)' }}>
            <span style={{ color: C.warning }}>加载失败，请重试</span>
            <button onClick={() => refetchAiPlatformCoverage()} className="text-xs" style={{ color: C.primary }}>重试</button>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto rounded-lg border" style={{ borderColor: C.border }}>
              <table className="w-full text-sm">
                <thead style={{ backgroundColor: '#F7F9FC' }}>
                  <tr>
                    <th className="px-4 py-2.5 text-left text-xs font-medium" style={{ color: C.textSecondary }}>平台</th>
                    <th className="px-4 py-2.5 text-right text-xs font-medium tnum" style={{ color: C.textSecondary }}>已检测关键词数</th>
                    <th className="px-4 py-2.5 text-right text-xs font-medium tnum" style={{ color: C.textSecondary }}>平均提及率</th>
                    <th className="px-4 py-2.5 text-right text-xs font-medium tnum" style={{ color: C.textSecondary }}>平均位次</th>
                  </tr>
                </thead>
                <tbody>
                  {(['doubao', 'tongyi', 'yuanbao', 'deepseek', 'kimi', 'wenxin'] as const).map((platformKey) => {
                    const label = DIAGNOSIS_PLATFORM_LABELS[platformKey];
                    const item = (aiPlatformCoverage ?? []).find(
                      (c: AiPlatformCoverage) => c.platform === platformKey,
                    );
                    return (
                      <tr key={platformKey} style={{ borderTop: `1px solid ${C.border}` }}>
                        <td className="px-4 py-2.5 text-xs font-medium" style={{ color: C.textMain }}>
                          {label}
                        </td>
                        <td className="px-4 py-2.5 text-right text-xs tnum" style={{ color: C.textSecondary }}>
                          {item ? item.keywordCount.toLocaleString('en-US') : '-'}
                        </td>
                        <td className="px-4 py-2.5 text-right text-xs tnum" style={{ color: C.textSecondary }}>
                          {item ? `${item.avgMentionRate.toFixed(1)}%` : '-'}
                        </td>
                        <td className="px-4 py-2.5 text-right text-xs tnum" style={{ color: C.textSecondary }}>
                          {item && item.avgRank !== null ? item.avgRank.toFixed(1) : '-'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="mt-3 text-[12px]" style={{ color: C.textMuted }}>
              统计自本系统 AI 检测任务真实结果；未检测的平台显示为空。
            </p>
          </>
        )}
      </div>

      {/* 热门关键词排名 */}
      <div className="dashboard-card mt-4 p-5">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-[15px] font-semibold" style={{ color: C.textMain }}>
            热门关键词排名
          </h3>
        </div>
        {topKeywordRankingLoading ? (
          <TableSkeleton rows={5} />
        ) : topKeywordRankingError ? (
          <div className="flex items-center justify-between rounded-lg px-4 py-3 text-sm" style={{ backgroundColor: 'rgba(247, 144, 9, 0.06)', border: '1px solid rgba(247, 144, 9, 0.2)' }}>
            <span style={{ color: C.warning }}>加载失败，请重试</span>
            <button onClick={() => refetchTopKeywordRanking()} className="text-xs" style={{ color: C.primary }}>重试</button>
          </div>
        ) : !topKeywordRanking || topKeywordRanking.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8">
            <Inbox className="mb-2 h-8 w-8" style={{ color: C.textMuted }} />
            <p className="text-sm" style={{ color: C.textMuted }}>还没有检测结果，去检测任务跑一轮</p>
            <Button variant="outline" size="sm" onClick={() => navigate('/keywords/tasks')} className="mt-3">
              前往检测任务
            </Button>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border" style={{ borderColor: C.border }}>
            <table className="w-full text-sm">
              <thead style={{ backgroundColor: '#F7F9FC' }}>
                <tr>
                  <th className="px-4 py-2.5 text-left text-xs font-medium" style={{ color: C.textSecondary }}>核心关键词</th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium" style={{ color: C.textSecondary }}>扩展词</th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium" style={{ color: C.textSecondary }}>排名平台</th>
                </tr>
              </thead>
              <tbody>
                {topKeywordRanking.map((item: HotKeywordRank, idx: number) => (
                  <tr key={`${item.keyword}-${item.platform}-${idx}`} style={{ borderTop: `1px solid ${C.border}` }}>
                    <td className="px-4 py-2.5 text-xs font-medium" style={{ color: C.textMain }}>
                      {item.keyword}
                    </td>
                    <td className="px-4 py-2.5 text-xs" style={{ color: C.textSecondary }}>
                      {item.extendedKeyword || '-'}
                    </td>
                    <td className="px-4 py-2.5 text-xs">
                      <span style={{ color: C.textMain }}>{item.platformLabel}</span>
                      <Badge variant="default" className="ml-2 tnum" style={{ fontSize: 11 }}>
                        第{item.rank}位
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 内容产出错误提示 */}
      {contentStatsError && (
        <div
          className="mt-4 flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm"
          style={{
            backgroundColor: 'rgba(247, 144, 9, 0.08)',
            border: '1px solid rgba(247, 144, 9, 0.2)',
            color: C.warning,
          }}
        >
          <AlertCircle className="h-4 w-4" />
          <span>数据加载中，请稍后刷新</span>
        </div>
      )}
    </div>
  );
};

/* ==================== 子组件 ==================== */

/* ---------- 大 KPI 卡片（保留组件接口，用于向后兼容） ---------- */
interface BigKpiCardProps {
  accent?: boolean;
  icon: React.ReactNode;
  iconColor: string;
  label: string;
  value: number | string;
  suffix?: string;
  prefix?: string;
  isLoading: boolean;
  subText?: string;
  extraText?: string;
  extraColor?: string;
  trendText?: string;
  trendDirection?: 'up' | 'down' | 'flat';
}

const BigKpiCard: React.FC<BigKpiCardProps> = ({
  accent = false,
  icon,
  iconColor,
  label,
  value,
  suffix = '',
  prefix = '',
  isLoading,
  subText,
  extraText,
  extraColor,
  trendText,
  trendDirection = 'flat',
}) => {
  const numericValue = typeof value === 'number' ? value : Number(value);
  const isNumeric = !isNaN(numericValue);

  const sparklineData = [30, 45, 38, 52, 48, 60, 55];

  return (
    <div className={`dashboard-card relative p-5 ${accent ? 'dashboard-card-accent' : ''}`}>
      <div className="flex h-full flex-col">
        <div className="flex items-start justify-between">
          <p className="text-[13px] font-normal" style={{ color: C.textMuted }}>{label}</p>
        </div>
        <div className="mt-3">
          {isLoading ? (
            <Skeleton
              className="h-9 w-24"
              style={{ backgroundColor: C.panel2 }}
            />
          ) : (
            <div className="flex items-baseline gap-1">
              {isNumeric ? (
                <KpiNumber
                  value={numericValue}
                  className="text-[32px] leading-none"
                  suffix={suffix}
                  prefix={prefix}
                />
              ) : (
                <span className="kpi-number tnum text-[32px] leading-none">
                  {prefix}{value}{suffix}
                </span>
              )}
            </div>
          )}
        </div>
        <div className="mt-auto flex items-end justify-between pt-3">
          <div className="flex-1">
            {trendText && !isLoading && (
              <div className="flex items-center gap-1 text-xs">
                {trendDirection === 'up' && (
                  <TrendingUp className="h-3 w-3" style={{ color: C.success }} />
                )}
                {trendDirection === 'down' && (
                  <TrendingUp className="h-3 w-3 rotate-180" style={{ color: C.warning }} />
                )}
                {trendDirection === 'flat' && (
                  <span className="h-3 w-3" />
                )}
                <span style={{ color: trendDirection === 'up' ? C.success : trendDirection === 'down' ? C.warning : C.textMuted }}>
                  {trendText}
                </span>
              </div>
            )}
            {subText && !isLoading && (
              <p className="text-xs" style={{ color: C.textMuted }}>{subText}</p>
            )}
            {extraText && !isLoading && (
              <p className="text-xs font-medium" style={{ color: extraColor ?? C.textMuted }}>{extraText}</p>
            )}
          </div>
          {!isLoading && (
            <MiniSparkline data={sparklineData} color={iconColor || C.primary} height={24} />
          )}
        </div>
      </div>
    </div>
  );
};

/* ---------- 小 KPI 卡片（保留组件接口，用于向后兼容） ---------- */
interface SmallKpiCardProps {
  icon: React.ReactNode;
  iconColor: string;
  label: string;
  value: number | string;
  suffix?: string;
  isLoading: boolean;
}

const SmallKpiCard: React.FC<SmallKpiCardProps> = ({
  icon,
  iconColor,
  label,
  value,
  suffix = '',
  isLoading,
}) => {
  const numericValue = typeof value === 'number' ? value : Number(value);
  const isNumeric = !isNaN(numericValue);

  return (
    <div className="dashboard-card relative p-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[13px]" style={{ color: C.textMuted }}>{label}</p>
          {isLoading ? (
            <Skeleton className="mt-2 h-6 w-16" style={{ backgroundColor: C.panel2 }} />
          ) : (
            <p className="tnum text-[22px] font-semibold leading-none mt-1.5" style={{ color: C.textMain }}>
              {isNumeric ? numericValue.toLocaleString('en-US') : value}
              <span className="text-[13px] font-medium ml-1" style={{ color: C.textMuted }}>{suffix}</span>
            </p>
          )}
        </div>
        <div
          className="flex items-center justify-center"
          style={{ color: iconColor }}
        >
          {icon}
        </div>
      </div>
    </div>
  );
};

/* ---------- 信源健康度小指标块 ---------- */
interface HealthMetricBlockProps {
  icon: React.ReactNode;
  iconColor: string;
  name: string;
  value: number | string;
  suffix?: string;
  status?: 'success' | 'warning' | 'danger';
}

const HealthMetricBlock: React.FC<HealthMetricBlockProps> = ({
  icon,
  iconColor,
  name,
  value,
  suffix = '',
  status = 'success',
}) => {
  const statusColor = status === 'success'
    ? C.success
    : status === 'warning'
      ? C.warning
      : C.danger;

  return (
    <div
      className="rounded-lg p-3 transition-colors"
      style={{ backgroundColor: C.panel2 }}
    >
      <div className="flex items-center gap-2">
        <div style={{ color: iconColor }}>{icon}</div>
        <span className="text-[12px]" style={{ color: C.textSecondary }}>{name}</span>
      </div>
      <div className="mt-2 flex items-baseline gap-1">
        <span className="tnum text-[20px] font-semibold leading-none" style={{ color: C.textMain }}>
          {typeof value === 'number' ? value.toLocaleString('en-US') : value}
        </span>
        <span className="text-[12px]" style={{ color: C.textMuted }}>{suffix}</span>
      </div>
      <div className="mt-2 flex items-center gap-1.5">
        <span
          className="h-1.5 w-1.5 rounded-full"
          style={{ backgroundColor: statusColor }}
        />
        <span className="text-[11px]" style={{ color: C.textMuted }}>
          {status === 'success' ? '正常' : status === 'warning' ? '待优化' : '需关注'}
        </span>
      </div>
    </div>
  );
};

/* ---------- 时间轴条目 ---------- */
interface TimelineItemProps {
  time: string;
  text: string;
  highlight?: boolean;
}

const TimelineItem: React.FC<TimelineItemProps> = ({ time, text, highlight = false }) => (
  <li className="relative">
    <span
      className="absolute -left-4 top-1.5 h-2.5 w-2.5 rounded-full border-2"
      style={{
        backgroundColor: highlight ? C.primary : C.chart3,
        borderColor: C.panel,
      }}
    />
    <p
      className="text-[12px]"
      style={{ color: C.textMuted }}
    >
      {time}
    </p>
    <p
      className="mt-0.5 text-[13px] leading-snug"
      style={{ color: highlight ? C.textMain : C.textSecondary }}
    >
      {text}
    </p>
  </li>
);

/* ---------- 信源健康度条目（保留组件接口，用于向后兼容） ---------- */
interface SourceHealthItemProps {
  name: string;
  count: number;
  total: number;
  percent?: boolean;
  barColor?: string;
  suffix?: string;
}

const SourceHealthItem: React.FC<SourceHealthItemProps> = ({
  name,
  count,
  total,
  percent = false,
  barColor,
  suffix,
}) => {
  const pct = total > 0 ? Math.min(100, Math.round((count / total) * 100)) : 0;
  const fillColor = barColor || C.primary;

  return (
    <li>
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-[13px]" style={{ color: C.textMain }}>{name}</span>
        <span className="tnum text-[13px] font-medium" style={{ color: C.textSecondary }}>
          {percent ? `${pct}%` : `${count}${suffix ?? ''}`}
        </span>
      </div>
      <div
        className="h-1 w-full overflow-hidden rounded-full"
        style={{ backgroundColor: 'rgba(59, 91, 255, 0.1)' }}
      >
        <div
          className="h-full rounded-full transition-all"
          style={{
            width: `${pct}%`,
            backgroundColor: fillColor,
          }}
        />
      </div>
    </li>
  );
};

/* ---------- 列表骨架屏 ---------- */
/* ---------- 列表骨架屏 ---------- */
const ListSkeleton: React.FC<{ rows: number }> = ({ rows }) => (
  <div className="space-y-3">
    {Array.from({ length: rows }).map((_, i) => (
      <div key={i} className="flex items-center justify-between">
        <Skeleton className="h-4 w-32" style={{ backgroundColor: '#EEF2F7' }} />
        <Skeleton className="h-4 w-16" style={{ backgroundColor: '#EEF2F7' }} />
      </div>
    ))}
  </div>
);

/* ---------- 表格骨架屏 ---------- */
const TableSkeleton: React.FC<{ rows?: number; cols?: number }> = ({ rows = 5, cols = 4 }) => (
  <div className="space-y-2 rounded-lg border p-2" style={{ borderColor: C.border }}>
    <div className="flex gap-3 px-2 py-2">
      {Array.from({ length: cols }).map((_, i) => (
        <Skeleton
          key={i}
          className="h-3"
          style={{
            backgroundColor: '#EEF2F7',
            width: i === 0 ? '25%' : i === cols - 1 ? '15%' : '20%',
          }}
        />
      ))}
    </div>
    {Array.from({ length: rows }).map((_, i) => (
      <div key={i} className="flex gap-3 px-2 py-2" style={{ borderTop: `1px solid ${C.borderLight}` }}>
        {Array.from({ length: cols }).map((_, j) => (
          <Skeleton
            key={j}
            className="h-3.5"
            style={{
              backgroundColor: '#F2F4F7',
              width: j === 0 ? '25%' : j === cols - 1 ? '15%' : '20%',
            }}
          />
        ))}
      </div>
    ))}
  </div>
);

export default Dashboard;
