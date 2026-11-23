import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Search,
  Download,
  RefreshCw,
  AlertCircle,
  Target,
  CheckCircle2,
  Percent,
  Globe,
} from 'lucide-react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@client/src/components/ui/card';
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@client/src/components/ui/table';
import { Skeleton } from '@client/src/components/ui/skeleton';
import { DataPagination } from '@client/src/components/ui/data-pagination';
import {
  getKeywordResults,
  getKeywordResultsStats,
  exportResults,
} from '@client/src/api/keywords';
import {
  PLATFORM_LABELS,
  PLATFORMS,
} from '@shared/api.interface';
import type { KeywordResult } from '@shared/api.interface';
import { UniversalLink } from '@lark-apaas/client-toolkit/components/UniversalLink';
import { useAuth } from '@client/src/hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { useResizableColumns } from '@client/src/hooks/use-resizable-columns';
import { ColumnResizeHandle } from '@client/src/components/ui/column-resize-handle';
import { PageHeader } from '@client/src/components/layout/PageHeader';
import { TableShell } from '@client/src/components/ui/table-shell';

const PRIMARY = '#2E7DFF';
const SUCCESS = '#12B76A';
const DANGER = '#F04438';
const MUTED = '#5A6478';
const BG = '#F7F9FC';

const DEFAULT_PAGE_SIZE = 10;

const KEYWORD_REPORTS_COL_DEFAULTS = {
  index: 60,
  keyword: 160,
  platform: 65,
  hit: 65,
  rank: 65,
  checkedAt: 100,
  snippet: 260,
  actions: 60,
};
// 合计: 60 + 160 + 65 + 65 + 65 + 100 + 260 + 60 = 835

const TIME_RANGES = [
  { value: '7', label: '近7天' },
  { value: '30', label: '近30天' },
  { value: '90', label: '近90天' },
];

const KeywordReportsPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isClient = user?.role === 'client';

  const {
    getThStyle,
    getTdStyle,
    getTableStyle,
    handleResizeStart,
    resetAll,
    isResizing,
  } = useResizableColumns({
    tableKey: 'keyword-reports',
    defaultWidths: KEYWORD_REPORTS_COL_DEFAULTS,
    defaultVersion: 3,
    userId: user?.id || 'guest',
  });

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [platform, setPlatform] = useState<string>('');
  const [isHit, setIsHit] = useState<string>('');
  const [keywordSearch, setKeywordSearch] = useState<string>('');
  const [days, setDays] = useState<string>('30');

  const dateRange = useMemo(() => {
    const d = Number(days) || 30;
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - d);
    return {
      startDate: start.toISOString().slice(0, 10),
      endDate: end.toISOString().slice(0, 10),
    };
  }, [days]);

  const queryParams = useMemo(
    () => ({
      page,
      pageSize,
      platform: platform || undefined,
      isHit: isHit || undefined,
      keyword: keywordSearch || undefined,
      startDate: dateRange.startDate,
      endDate: dateRange.endDate,
    }),
    [page, platform, isHit, keywordSearch, dateRange],
  );

  const statsParams = useMemo(
    () => ({
      platform: platform || undefined,
      isHit: isHit || undefined,
      keyword: keywordSearch || undefined,
      startDate: dateRange.startDate,
      endDate: dateRange.endDate,
    }),
    [platform, isHit, keywordSearch, dateRange],
  );

  const {
    data: resultsData,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['keyword-reports', 'results', queryParams],
    queryFn: () => getKeywordResults(queryParams),
    retry: 2,
    retryDelay: 2000,
  });

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['keyword-reports', 'stats', statsParams],
    queryFn: () => getKeywordResultsStats(statsParams),
    retry: 2,
    retryDelay: 2000,
  });

  const totalPages = useMemo(() => {
    if (!resultsData) return 1;
    return Math.max(1, Math.ceil(resultsData.total / pageSize));
  }, [resultsData]);

  const handleSearch = () => {
    setPage(1);
  };

  const handleExport = () => {
    exportResults({
      startDate: dateRange.startDate,
      endDate: dateRange.endDate,
    });
  };

  const hitRate = stats?.hitRate
    ? stats.hitRate.toFixed(1)
    : '0.0';

  return (
    <div className="space-y-5 bg-[#F7F9FC]">
      {/* 页面头部 */}
      <PageHeader
        title="关键词报表"
        subtitle="关键词检测数据统计概览"
      />

      {/* 统计卡片 */}
      <div
        className="grid grid-cols-2 gap-4 md:grid-cols-4"
        data-ai-section-type="card-stat"
      >
        <StatCard
          icon={<Target className="h-5 w-5" />}
          iconBg="rgba(30, 64, 175, 0.1)"
          iconColor={PRIMARY}
          label="检测总数"
          value={stats?.total ?? 0}
          isLoading={statsLoading}
        />
        <StatCard
          icon={<CheckCircle2 className="h-5 w-5" />}
          iconBg="rgba(16, 185, 129, 0.1)"
          iconColor={SUCCESS}
          label="命中总数"
          value={stats?.hitCount ?? 0}
          isLoading={statsLoading}
        />
        <StatCard
          icon={<Percent className="h-5 w-5" />}
          iconBg="rgba(249, 115, 22, 0.1)"
          iconColor="#f97316"
          label="命中率"
          value={`${hitRate}%`}
          isLoading={statsLoading}
        />
        <StatCard
          icon={<Globe className="h-5 w-5" />}
          iconBg="rgba(100, 116, 139, 0.1)"
          iconColor={MUTED}
          label="覆盖平台数"
          value={stats?.platformCount ?? 0}
          isLoading={statsLoading}
        />
      </div>

      {/* 筛选 + 表格 */}
      <TableShell
        title="关键词检测明细"
        headerActions={
          <>
            <button
              type="button"
              onClick={resetAll}
              className="text-[12px] transition-colors hover:underline"
              style={{ color: '#64748b' }}
            >
              重置列宽
            </button>
            <Button
              size="sm"
              onClick={handleExport}
              className="h-9"
              style={{ backgroundColor: PRIMARY }}
            >
              <Download className="h-4 w-4" />
              导出 CSV
            </Button>
          </>
        }
        filterBar={
          <>
            <Select value={days} onValueChange={setDays}>
              <SelectTrigger className="h-9 w-[100px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TIME_RANGES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={platform} onValueChange={setPlatform}>
              <SelectTrigger className="h-9 w-[120px]">
                <SelectValue placeholder="全部平台" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">全部平台</SelectItem>
                {PLATFORMS.map((p) => (
                  <SelectItem key={p} value={p}>
                    {PLATFORM_LABELS[p]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={isHit} onValueChange={setIsHit}>
              <SelectTrigger className="h-9 w-[120px]">
                <SelectValue placeholder="命中状态" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">全部</SelectItem>
                <SelectItem value="true">已命中</SelectItem>
                <SelectItem value="false">未命中</SelectItem>
              </SelectContent>
            </Select>
            <div className="relative w-[260px]">
              <Search
                className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4"
                style={{ color: '#8A93A6' }}
              />
              <Input
                placeholder="搜索关键词"
                value={keywordSearch}
                onChange={(e) => setKeywordSearch(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                className="h-9 pl-9"
                style={{ fontSize: '13px' }}
              />
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={handleSearch}
              className="h-9"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              查询
            </Button>
          </>
        }
        data={resultsData?.items ?? []}
        isLoading={isLoading}
        isEmpty={!isLoading && !isError && resultsData && resultsData.items.length === 0}
        emptyTitle="暂无检测结果"
        emptyDescription="还没有关键词检测数据，先去发起一次检测吧"
        emptyAction={{ label: '去检测', onClick: () => navigate('/keywords/tasks') }}
        total={resultsData?.total ?? 0}
        page={page}
        pageSize={pageSize}
        onPageChange={setPage}
        onPageSizeChange={(size) => {
          setPageSize(size);
          setPage(1);
        }}
      >
        {/* 错误态 */}
        {isError && (
          <div className="flex items-center justify-between rounded-lg border border-amber-200 bg-amber-50 p-4">
            <div
              className="flex items-center gap-2 text-sm"
              style={{ color: '#b45309' }}
            >
              <AlertCircle className="h-4 w-4" />
              <span>数据加载中，请稍后刷新</span>
            </div>
            <button
              onClick={() => refetch()}
              className="flex items-center gap-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors hover:bg-amber-100"
              style={{ color: '#b45309' }}
            >
              <RefreshCw className="h-3.5 w-3.5" />
              重新加载
            </button>
          </div>
        )}

        {/* 表格区 */}
        {!isLoading && !isError && resultsData && resultsData.items.length > 0 && (
          <Table style={getTableStyle()} className="table-fixed">
                <TableHeader style={{ backgroundColor: '#F7F9FC' }}>
                  <TableRow>
                    <TableHead
                      data-col="index"
                      className="relative group"
                      style={{
                        ...getThStyle('index'),
                        fontSize: '13px',
                        fontWeight: 500,
                        color: '#5A6478',
                        height: '48px',
                        borderBottom: '1px solid #EDF1F7',
                      }}
                    >
                      序号
                      <ColumnResizeHandle
                        onResizeStart={(e) => handleResizeStart('index', e)}
                        isResizing={isResizing}
                      />
                    </TableHead>
                    <TableHead
                      data-col="keyword"
                      className="relative group"
                      style={{
                        ...getThStyle('keyword'),
                        fontSize: '13px',
                        fontWeight: 500,
                        color: '#5A6478',
                        height: '48px',
                        borderBottom: '1px solid #EDF1F7',
                      }}
                    >
                      关键词
                      <ColumnResizeHandle
                        onResizeStart={(e) => handleResizeStart('keyword', e)}
                        isResizing={isResizing}
                      />
                    </TableHead>
                    <TableHead
                      data-col="platform"
                      className="relative group"
                      style={{
                        ...getThStyle('platform'),
                        fontSize: '13px',
                        fontWeight: 500,
                        color: '#5A6478',
                        height: '48px',
                        borderBottom: '1px solid #EDF1F7',
                      }}
                    >
                      平台
                      <ColumnResizeHandle
                        onResizeStart={(e) => handleResizeStart('platform', e)}
                        isResizing={isResizing}
                      />
                    </TableHead>
                    <TableHead
                      data-col="hit"
                      className="relative group"
                      style={{
                        ...getThStyle('hit'),
                        fontSize: '13px',
                        fontWeight: 500,
                        color: '#5A6478',
                        height: '48px',
                        borderBottom: '1px solid #EDF1F7',
                      }}
                    >
                      是否命中
                      <ColumnResizeHandle
                        onResizeStart={(e) => handleResizeStart('hit', e)}
                        isResizing={isResizing}
                      />
                    </TableHead>
                    <TableHead
                      data-col="rank"
                      className="relative group"
                      style={{
                        ...getThStyle('rank'),
                        fontSize: '13px',
                        fontWeight: 500,
                        color: '#5A6478',
                        height: '48px',
                        borderBottom: '1px solid #EDF1F7',
                      }}
                    >
                      排名位置
                      <ColumnResizeHandle
                        onResizeStart={(e) => handleResizeStart('rank', e)}
                        isResizing={isResizing}
                      />
                    </TableHead>
                    <TableHead
                      data-col="checkedAt"
                      className="relative group"
                      style={{
                        ...getThStyle('checkedAt'),
                        fontSize: '13px',
                        fontWeight: 500,
                        color: '#5A6478',
                        height: '48px',
                        borderBottom: '1px solid #EDF1F7',
                      }}
                    >
                      检测时间
                      <ColumnResizeHandle
                        onResizeStart={(e) => handleResizeStart('checkedAt', e)}
                        isResizing={isResizing}
                      />
                    </TableHead>
                    <TableHead
                      data-col="snippet"
                      className="relative group"
                      style={{
                        ...getThStyle('snippet'),
                        fontSize: '13px',
                        fontWeight: 500,
                        color: '#5A6478',
                        height: '48px',
                        borderBottom: '1px solid #EDF1F7',
                      }}
                    >
                      命中内容摘要
                      <ColumnResizeHandle
                        onResizeStart={(e) => handleResizeStart('snippet', e)}
                        isResizing={isResizing}
                      />
                    </TableHead>
                    <TableHead
                      data-col="actions"
                      style={{
                        ...getThStyle('actions'),
                        fontSize: '13px',
                        fontWeight: 500,
                        color: '#5A6478',
                        height: '48px',
                        borderBottom: '1px solid #EDF1F7',
                      }}
                    >
                      操作
                    </TableHead>
                  </TableRow>
                </TableHeader>
                  <TableBody>
                    {resultsData.items.map((r: KeywordResult, i: number) => (
                      <TableRow key={r.id} style={{ height: '48px' }}>
                        <TableCell
                          className="text-muted-foreground"
                          style={{
                            ...getTdStyle('index'),
                            borderBottom: '1px solid #EDF1F7',
                          }}
                        >
                          {(page - 1) * pageSize + i + 1}
                        </TableCell>
                        <TableCell
                          className="font-medium"
                          style={{
                            ...getTdStyle('keyword'),
                            color: '#1A2233',
                            borderBottom: '1px solid #EDF1F7',
                          }}
                        >
                          {r.keyword}
                        </TableCell>
                        <TableCell
                          style={{
                            ...getTdStyle('platform'),
                            borderBottom: '1px solid #EDF1F7',
                          }}
                        >
                          {PLATFORM_LABELS[r.platform] ?? r.platform}
                        </TableCell>
                        <TableCell
                          style={{
                            ...getTdStyle('hit'),
                            borderBottom: '1px solid #EDF1F7',
                          }}
                        >
                          <span
                            className={`status-dot ${
                              r.isHit
                                ? 'status-dot-success'
                                : 'status-dot-danger'
                            }`}
                          />
                          <span
                            style={{
                              color: r.isHit ? SUCCESS : DANGER,
                              fontSize: '13px',
                            }}
                          >
                            {r.isHit ? '已命中' : '未命中'}
                          </span>
                        </TableCell>
                        <TableCell style={getTdStyle('rank')}>
                          {r.position ? (
                            <span
                              className="font-semibold"
                              style={{
                                color:
                                  r.position <= 10
                                    ? SUCCESS
                                    : r.position <= 30
                                    ? '#f97316'
                                    : MUTED,
                              }}
                            >
                              第 {r.position} 位
                            </span>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell
                          className="text-xs"
                          style={{
                            ...getTdStyle('checkedAt'),
                            color: '#8A93A6',
                            borderBottom: '1px solid #EDF1F7',
                          }}
                        >
                          {r.detectedAt
                            ? new Date(r.detectedAt).toLocaleString('zh-CN')
                            : '-'}
                        </TableCell>
                        <TableCell
                          style={{
                            ...getTdStyle('snippet'),
                            borderBottom: '1px solid #EDF1F7',
                          }}
                        >
                          {r.url ? (
                            <UniversalLink
                              to={r.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs block hover:underline"
                              style={{ color: PRIMARY }}
                              title={r.url}
                            >
                              {r.url}
                            </UniversalLink>
                          ) : (
                            <span className="text-muted-foreground text-xs">-</span>
                          )}
                        </TableCell>
                        <TableCell
                          style={{
                            ...getTdStyle('actions'),
                            borderBottom: '1px solid #EDF1F7',
                          }}
                        >
                          <button
                            onClick={() => {}}
                            className="text-xs font-medium transition-colors hover:opacity-80"
                            style={{ color: PRIMARY }}
                          >
                            查看
                          </button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
        )}
      </TableShell>
    </div>
  );
};

interface StatCardProps {
  icon: React.ReactNode;
  iconBg: string;
  iconColor: string;
  label: string;
  value: number | string;
  isLoading: boolean;
}

const StatCard: React.FC<StatCardProps> = ({
  icon,
  iconBg,
  iconColor,
  label,
  value,
  isLoading,
}) => (
  <div className="dashboard-card p-5">
    <div className="flex items-start justify-between">
      <div className="flex-1">
        <p className="text-sm" style={{ color: '#8A93A6' }}>
          {label}
        </p>
        {isLoading ? (
          <Skeleton className="mt-2 h-7 w-20" />
        ) : (
          <p
            className="kpi-number mt-2 text-2xl leading-none"
            style={{ color: '#1A2233' }}
          >
            {value}
          </p>
        )}
      </div>
      <div
        className="flex h-10 w-10 items-center justify-center rounded-lg"
        style={{ backgroundColor: iconBg, color: iconColor }}
      >
        {icon}
      </div>
    </div>
  </div>
);

const TableSkeleton = () => (
  <div className="space-y-3 p-4">
    {Array.from({ length: 8 }).map((_, i) => (
      <div key={i} className="flex items-center gap-4" style={{ height: '48px' }}>
        <Skeleton className="h-4 w-10" />
        <Skeleton className="h-4 flex-1" />
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-4 w-16" />
        <Skeleton className="h-4 w-16" />
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-4 w-12" />
      </div>
    ))}
  </div>
);

const EmptyState: React.FC<{ onGoTasks: () => void }> = ({ onGoTasks }) => (
  <div className="empty-state-card" style={{ minHeight: '360px' }}>
    <Search className="empty-icon" strokeWidth={1.5} />
    <p className="empty-title">暂无检测结果</p>
    <p className="empty-desc">还没有关键词检测数据，先去发起一次检测吧</p>
    <Button
      size="sm"
      onClick={onGoTasks}
      style={{ backgroundColor: PRIMARY }}
    >
      去检测任务
    </Button>
  </div>
);

export default KeywordReportsPage;
