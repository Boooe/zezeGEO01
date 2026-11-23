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
  BarChart3,
  ChevronDown,
  ChevronRight,
  Eye,
} from 'lucide-react';
import { SectionCard } from '@client/src/components/layout/SectionCard';
import { Toolbar } from '@client/src/components/layout/Toolbar';
import { Pill } from '@client/src/components/layout/Pill';
import { DataTable } from '@client/src/components/layout/DataTable';
import {
  Card,
  CardContent,
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
import { Badge } from '@client/src/components/ui/badge';
import { Skeleton } from '@client/src/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@client/src/components/ui/table';
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@client/src/components/ui/pagination';
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@client/src/components/ui/empty';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@client/src/components/ui/dialog';
import {
  getAiDetectResults,
  getAiDetectResultsStats,
  getLegacyResultsCount,
  getLegacyResults,
  getBrandList,
  getDetectPlatformsStatus,
  exportResults,
} from '@client/src/api/keywords';
import {
  AI_DETECT_PLATFORMS,
  AI_DETECT_PLATFORM_LABELS,
  PLATFORM_LABELS,
  PLATFORMS,
} from '@shared/api.interface';
import type {
  AiDetectResult,
  AiDetectPlatform,
  KeywordResult,
} from '@shared/api.interface';
import { useNavigate } from 'react-router-dom';
import { UniversalLink } from '@lark-apaas/client-toolkit/components/UniversalLink';

const PRIMARY = '#2E7DFF';
const SUCCESS = '#17C964';
const DANGER = '#FF5C5C';
const MUTED = '#64748b';
const WARNING = '#FFA940';

const PAGE_SIZE = 10;
const LEGACY_PAGE_SIZE = 10;

const KeywordReports = () => {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [legacyPage, setLegacyPage] = useState(1);
  const [brandId, setBrandId] = useState<string>('');
  const [platform, setPlatform] = useState<string>('');
  const [isMentioned, setIsMentioned] = useState<string>('');
  const [keywordSearch, setKeywordSearch] = useState<string>('');
  const [showLegacy, setShowLegacy] = useState(false);
  const [detailResult, setDetailResult] = useState<AiDetectResult | null>(null);

  const { data: platformsStatus } = useQuery({
    queryKey: ['detect-platforms-status'],
    queryFn: getDetectPlatformsStatus,
    staleTime: 60_000,
  });

  const platformConfigured = useMemo(() => {
    const map = new Map<AiDetectPlatform, boolean>();
    platformsStatus?.platforms?.forEach((p) => {
      map.set(p.platform, p.configured);
    });
    return map;
  }, [platformsStatus]);

  const {
    data: resultsData,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: [
      'ai-detect-results',
      page,
      brandId,
      platform,
      isMentioned,
      keywordSearch,
    ],
    queryFn: () =>
      getAiDetectResults({
        page,
        pageSize: PAGE_SIZE,
        brandId: brandId || undefined,
        platform: platform || undefined,
        isMentioned: isMentioned === ''
          ? undefined
          : isMentioned === 'true',
        keyword: keywordSearch || undefined,
      }),
    enabled: !!brandId,
  });

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: [
      'ai-detect-results-stats',
      brandId,
      platform,
      isMentioned,
      keywordSearch,
    ],
    queryFn: () =>
      getAiDetectResultsStats({
        brandId: brandId || undefined,
        platform: platform || undefined,
        isMentioned: isMentioned === ''
          ? undefined
          : isMentioned === 'true',
        keyword: keywordSearch || undefined,
      }),
    enabled: !!brandId,
  });

  const { data: legacyCountData } = useQuery({
    queryKey: ['legacy-results-count', brandId],
    queryFn: () => getLegacyResultsCount(brandId),
    enabled: !!brandId,
  });

  const { data: legacyData, isLoading: legacyLoading } = useQuery({
    queryKey: ['legacy-results', legacyPage, brandId, keywordSearch],
    queryFn: () =>
      getLegacyResults({
        brandId,
        page: legacyPage,
        pageSize: LEGACY_PAGE_SIZE,
        keyword: keywordSearch || undefined,
      }),
    enabled: !!brandId && showLegacy,
  });

  const { data: brandOptions = [] } = useQuery({
    queryKey: ['brands', 'options'],
    queryFn: getBrandList,
  });

  const totalPages = useMemo(() => {
    if (!resultsData) return 1;
    return Math.max(1, Math.ceil(resultsData.total / PAGE_SIZE));
  }, [resultsData]);

  const legacyTotalPages = useMemo(() => {
    if (!legacyData) return 1;
    return Math.max(1, Math.ceil(legacyData.total / LEGACY_PAGE_SIZE));
  }, [legacyData]);

  const handleSearch = () => {
    setPage(1);
  };

  const handleExport = () => {
    exportResults({ brandId: brandId || undefined });
  };

  const mentionRate = stats?.mentionRate
    ? stats.mentionRate.toFixed(1)
    : '0.0';

  return (
    <div className="space-y-5">
      {/* 统计卡片 */}
      <div
        className="grid grid-cols-2 gap-4 md:grid-cols-4"
        data-ai-section-type="card-stat"
      >
        <StatCard
          icon={<Target className="h-5 w-5" />}
          iconBg="rgba(46, 125, 255, 0.1)"
          iconColor="#2E7DFF"
          label="检测总数"
          value={stats?.totalCount ?? 0}
          isLoading={statsLoading}
        />
        <StatCard
          icon={<CheckCircle2 className="h-5 w-5" />}
          iconBg="rgba(16, 185, 129, 0.1)"
          iconColor="#10B981"
          label="提及总数"
          value={stats?.mentionCount ?? 0}
          isLoading={statsLoading}
        />
        <StatCard
          icon={<Percent className="h-5 w-5" />}
          iconBg="rgba(245, 158, 11, 0.12)"
          iconColor="#F59E0B"
          label="提及率"
          value={`${mentionRate}%`}
          isLoading={statsLoading}
        />
        <StatCard
          icon={<Globe className="h-5 w-5" />}
          iconBg="rgba(148, 163, 184, 0.1)"
          iconColor="#94A3B8"
          label="覆盖平台数"
          value={stats?.coveredPlatforms ?? 0}
          isLoading={statsLoading}
        />
      </div>

      <SectionCard
        title="检测结果"
        actions={
          <Button
            size="sm"
            variant="outline"
            className="h-9"
            onClick={handleExport}
          >
            <Download className="h-3.5 w-3.5" />
            导出报表
          </Button>
        }
      >
        <Toolbar>
          <Select value={brandId} onValueChange={(v) => { setBrandId(v); setPage(1); }}>
            <SelectTrigger className="h-9 w-[140px]">
              <SelectValue placeholder="全部品牌" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">全部品牌</SelectItem>
              {brandOptions.map((b) => (
                <SelectItem key={b.id} value={b.id}>
                  {b.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={isMentioned} onValueChange={setIsMentioned}>
            <SelectTrigger className="h-9 w-[110px]">
              <SelectValue placeholder="提及状态" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">全部</SelectItem>
              <SelectItem value="true">已提及</SelectItem>
              <SelectItem value="false">未提及</SelectItem>
            </SelectContent>
          </Select>
          <Select value={platform} onValueChange={setPlatform}>
            <SelectTrigger className="h-9 w-[110px]">
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
          <div className="relative w-[220px]">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94A3B8]" />
            <Input
              placeholder="搜索关键词"
              value={keywordSearch}
              onChange={(e) => setKeywordSearch(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && setPage(1)}
              className="h-9 pl-9"
            />
          </div>
          <Button
            size="sm"
            variant="outline"
            className="h-9"
            onClick={() => refetch()}
          >
            <RefreshCw className="h-3.5 w-3.5" />
            刷新
          </Button>
        </Toolbar>

          {/* 平台筛选 chips */}
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => { setPlatform(''); setPage(1); }}
                className={`rounded-lg border px-3 py-1.5 text-sm transition-colors ${
                  platform === ''
                    ? 'border-blue-500 bg-blue-50 text-blue-700 font-medium'
                    : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
                }`}
              >
                全部
              </button>
              {AI_DETECT_PLATFORMS.map((p) => {
                const configured = platformConfigured.get(p) ?? true;
                const active = platform === p;
                return (
                  <button
                    key={p}
                    type="button"
                    disabled={!configured}
                    onClick={() => { setPlatform(p); setPage(1); }}
                    className={`rounded-lg border px-3 py-1.5 text-sm transition-colors ${
                      !configured
                        ? 'cursor-not-allowed border-gray-100 bg-gray-50 text-gray-400'
                        : active
                        ? 'border-blue-500 bg-blue-50 text-blue-700 font-medium'
                        : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    {AI_DETECT_PLATFORM_LABELS[p]}
                  </button>
                );
              })}
            </div>
            <p className="text-xs text-gray-400">
              未接入平台检测将跳过，可前往 AI 模型接入配置
            </p>
          </div>

          {/* 错误态 */}
          {isError && (
            <div className="flex items-center justify-between rounded-lg border border-red-200 bg-red-50 p-4">
              <div className="flex items-center gap-2 text-sm" style={{ color: DANGER }}>
                <AlertCircle className="h-4 w-4" />
                <span>数据加载失败，请重试</span>
              </div>
              <button
                onClick={() => refetch()}
                className="flex items-center gap-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors hover:bg-red-100"
                style={{ color: DANGER }}
              >
                <RefreshCw className="h-3.5 w-3.5" />
                重试
              </button>
            </div>
          )}

          {/* 表格区 */}
          {isLoading ? (
            <AiTableSkeleton />
          ) : resultsData ? (
            <DataTable
              columns={[
                { key: 'index', title: '序号', width: '50px', render: (_r: AiDetectResult, idx: number) => (
                  <span className="text-[#5B6B85]">{(page - 1) * PAGE_SIZE + idx + 1}</span>
                )},
                { key: 'parentKeyword', title: '核心词', render: (r: AiDetectResult) => (
                  <span className="truncate block font-medium" title={r.parentKeyword ?? ''}>
                    {r.parentKeyword ?? '—'}
                  </span>
                )},
                { key: 'keyword', title: '长尾问句', render: (r: AiDetectResult) => (
                  <span className="truncate block text-[#5B6B85]" title={r.keyword}>
                    {r.keyword}
                  </span>
                )},
                { key: 'platform', title: 'AI 平台', width: '90px', render: (r: AiDetectResult) => (
                  AI_DETECT_PLATFORM_LABELS[r.platform as typeof AI_DETECT_PLATFORMS[number]] ?? r.platform
                )},
                { key: 'isMentioned', title: '是否提及', width: '80px', render: (r: AiDetectResult) => (
                  <Pill variant={r.isMentioned ? 'success' : 'danger'}>
                    {r.isMentioned ? '已提及' : '未提及'}
                  </Pill>
                )},
                { key: 'rawAnswer', title: '提及摘要', width: '240px', render: (r: AiDetectResult) => {
                  const snippet = r.rawAnswer
                    ? r.rawAnswer.replace(/\s+/g, ' ').slice(0, 50) + (r.rawAnswer.length > 50 ? '...' : '')
                    : '-';
                  return <span className="truncate block text-[#5B6B85]" title={r.rawAnswer ?? ''}>{snippet}</span>;
                }},
                { key: 'executedAt', title: '检测时间', width: '160px', render: (r: AiDetectResult) => (
                  <span className="text-[#5B6B85]">
                    {r.executedAt ? new Date(r.executedAt).toLocaleString('zh-CN') : '-'}
                  </span>
                )},
                { key: 'actions', title: '操作', width: '80px', render: (r: AiDetectResult) => (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 px-2 text-xs text-[#2E7DFF] hover:text-[#1E5FD6] hover:bg-[#EAF2FF]"
                    onClick={() => setDetailResult(r)}
                  >
                    <Eye className="h-3.5 w-3.5 mr-1" />
                    查看
                  </Button>
                )},
              ]}
              data={resultsData.items}
              rowKey="id"
              emptyText="还没有 AI 检测结果"
              emptyIcon={<BarChart3 />}
              emptyAction={
                <Button
                  size="sm"
                  onClick={() => navigate('/keywords?tab=monitor')}
                >
                  去检测任务
                </Button>
              }
              pagination={{
                total: resultsData.total,
                page,
                pageSize: PAGE_SIZE,
                onPageChange: setPage,
                onPageSizeChange: () => {},
                pageSizeOptions: [10],
              }}
            />
          ) : null}

          {/* 旧版搜索引擎记录折叠 */}
          <div className="mt-4 rounded-lg border border-dashed">
            <button
              type="button"
              onClick={() => setShowLegacy((s) => !s)}
              className="flex w-full items-center gap-2 px-4 py-3 text-left text-sm text-muted-foreground transition-colors hover:bg-gray-50"
            >
              {showLegacy ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
              <span>
                旧版搜索引擎检测记录
                {legacyCountData?.count !== undefined && (
                  <span className="ml-1">（{legacyCountData.count} 条）</span>
                )}
              </span>
            </button>
            {showLegacy && (
              <div className="border-t px-4 py-4">
                {legacyLoading ? (
                  <LegacyTableSkeleton />
                ) : legacyData && legacyData.items.length > 0 ? (
                  <>
                    <div className="rounded-md border overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-16">序号</TableHead>
                            <TableHead>关键词</TableHead>
                            <TableHead className="w-24">平台</TableHead>
                            <TableHead className="w-24">是否命中</TableHead>
                            <TableHead className="w-20">排名</TableHead>
                            <TableHead className="w-40">检测时间</TableHead>
                            <TableHead>来源URL</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {legacyData.items.map((r: KeywordResult, i: number) => (
                            <TableRow key={r.id}>
                              <TableCell className="text-muted-foreground">
                                {(legacyPage - 1) * LEGACY_PAGE_SIZE + i + 1}
                              </TableCell>
                              <TableCell className="font-medium">
                                <div className="flex items-center gap-2">
                                  {r.keyword}
                                  {r.isExample && (
                                    <Badge
                                      variant="secondary"
                                      className="text-xs bg-slate-100 text-slate-500 border-slate-200"
                                    >
                                      示例
                                    </Badge>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell>
                                {PLATFORM_LABELS[r.platform as typeof PLATFORMS[number]] ?? r.platform}
                              </TableCell>
                              <TableCell>
                                <span
                                  className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium"
                                  style={{
                                    backgroundColor: r.isHit
                                      ? 'rgba(23, 201, 100, 0.12)'
                                      : 'rgba(255, 92, 92, 0.1)',
                                    color: r.isHit ? SUCCESS : DANGER,
                                  }}
                                >
                                  {r.isHit ? '已命中' : '未命中'}
                                </span>
                              </TableCell>
                              <TableCell>
                                {r.position ? (
                                  <span
                                    className="font-semibold"
                                    style={{
                                      color:
                                        r.position <= 10
                                          ? SUCCESS
                                          : r.position <= 30
                                          ? WARNING
                                          : MUTED,
                                    }}
                                  >
                                    第 {r.position} 位
                                  </span>
                                ) : (
                                  <span className="text-muted-foreground">-</span>
                                )}
                              </TableCell>
                              <TableCell className="text-muted-foreground">
                                {r.detectedAt
                                  ? new Date(r.detectedAt).toLocaleString('zh-CN')
                                  : '-'}
                              </TableCell>
                              <TableCell className="max-w-[200px]">
                                {r.url ? (
                                  <UniversalLink
                                    to={r.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-xs truncate block hover:underline"
                                    style={{ color: PRIMARY }}
                                    title={r.url}
                                  >
                                    {r.url}
                                  </UniversalLink>
                                ) : (
                                  <span className="text-muted-foreground text-xs">-</span>
                                )}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                    {legacyTotalPages > 1 && (
                      <div className="flex items-center justify-between pt-3">
                        <div className="text-xs text-muted-foreground">
                          共 {legacyData.total} 条旧版记录
                        </div>
                        <Pagination className="justify-end">
                          <PaginationContent>
                            <PaginationItem>
                              <PaginationPrevious
                                onClick={() => setLegacyPage((p) => Math.max(1, p - 1))}
                                className={legacyPage === 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                              />
                            </PaginationItem>
                            {Array.from({ length: legacyTotalPages }).map((_, i) => {
                              const p = i + 1;
                              if (
                                p === 1 ||
                                p === legacyTotalPages ||
                                (p >= legacyPage - 1 && p <= legacyPage + 1)
                              ) {
                                return (
                                  <PaginationItem key={p}>
                                    <PaginationLink
                                      isActive={legacyPage === p}
                                      onClick={() => setLegacyPage(p)}
                                      className="cursor-pointer"
                                    >
                                      {p}
                                    </PaginationLink>
                                  </PaginationItem>
                                );
                              }
                              if (p === legacyPage - 2 || p === legacyPage + 2) {
                                return (
                                  <PaginationItem key={p}>
                                    <span className="px-2 text-muted-foreground">
                                      ...
                                    </span>
                                  </PaginationItem>
                                );
                              }
                              return null;
                            })}
                            <PaginationItem>
                              <PaginationNext
                                onClick={() =>
                                  setLegacyPage((p) => Math.min(legacyTotalPages, p + 1))
                                }
                                className={
                                  legacyPage === legacyTotalPages
                                    ? 'pointer-events-none opacity-50'
                                    : 'cursor-pointer'
                                }
                              />
                            </PaginationItem>
                          </PaginationContent>
                        </Pagination>
                      </div>
                    )}
                  </>
                ) : (
                  <Empty className="min-h-[200px]">
                    <EmptyHeader>
                      <EmptyMedia variant="icon">
                        <BarChart3 />
                      </EmptyMedia>
                      <EmptyTitle>暂无旧版检测记录</EmptyTitle>
                    </EmptyHeader>
                  </Empty>
                )}
              </div>
            )}
          </div>
        </SectionCard>

      {/* 详情弹窗 */}
      {detailResult && (
        <Dialog open={!!detailResult} onOpenChange={(o) => !o && setDetailResult(null)}>
          <DialogContent className="max-w-[680px] max-h-[85vh] flex flex-col">
            <DialogHeader>
              <DialogTitle className="text-base">
                检测详情 · {detailResult.keyword} · {AI_DETECT_PLATFORM_LABELS[detailResult.platform]}
              </DialogTitle>
            </DialogHeader>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <div className="text-gray-400">模型</div>
                <div className="font-medium">{detailResult.modelName}</div>
              </div>
              <div>
                <div className="text-gray-400">检测时间</div>
                <div className="font-medium">
                  {detailResult.executedAt?.slice(0, 19).replace('T', ' ') || '-'}
                </div>
              </div>
              <div>
                <div className="text-gray-400">是否提及</div>
                <div className="font-medium" style={{ color: detailResult.isMentioned ? SUCCESS : DANGER }}>
                  {detailResult.isMentioned ? '是' : '否'}
                </div>
              </div>
              {detailResult.isMentioned && (
                <div>
                  <div className="text-gray-400">提及位置</div>
                  <div className="font-medium">
                    {detailResult.mentionRank
                      ? `第 ${detailResult.mentionRank} 位`
                      : detailResult.mentionPosition || '-'}
                  </div>
                </div>
              )}
              <div className="col-span-2">
                <div className="text-gray-400">提问</div>
                <div className="font-medium">{detailResult.question}</div>
              </div>
              {detailResult.sourceDomains?.length > 0 && (
                <div className="col-span-2">
                  <div className="text-gray-400">引用来源</div>
                  <div className="space-y-1">
                    {detailResult.sourceDomains.map((d: string, i: number) => (
                      <div key={i} className="font-medium break-words">
                        <UniversalLink
                          to={d.startsWith('http') ? d : `https://${d}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs hover:underline"
                          style={{ color: PRIMARY }}
                        >
                          {d}
                        </UniversalLink>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {detailResult.competitorBrands?.length > 0 && (
                <div className="col-span-2">
                  <div className="text-gray-400">竞品提及</div>
                  <div className="font-medium">
                    {detailResult.competitorBrands.join('、')}
                  </div>
                </div>
              )}
            </div>
            <div className="mt-4 flex-1 min-h-0">
              <div className="mb-1 text-sm text-gray-400">回答全文</div>
              <div className="h-[320px] overflow-auto rounded-lg border bg-gray-50 p-3 text-sm leading-relaxed whitespace-pre-wrap">
                {detailResult.rawAnswer || '（无回答内容）'}
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
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
  <Card
    className="w-full"
    style={{ borderRadius: '12px', boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 0 0 1px #E5E9F2' }}
  >
    <CardContent className="pt-6">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm text-muted-foreground">{label}</p>
          {isLoading ? (
            <Skeleton className="mt-2 h-7 w-20" />
          ) : (
            <p
              className="mt-2 text-xl font-bold leading-none"
              style={{ color: '#0f172a' }}
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
    </CardContent>
  </Card>
);

const AiTableSkeleton = () => (
  <div className="space-y-2 rounded-md border p-4">
    {Array.from({ length: 8 }).map((_, i: number) => (
      <div key={i} className="flex items-center gap-4">
        <Skeleton className="h-4 w-10" />
        <Skeleton className="h-4 flex-1" />
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-4 w-16" />
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-4 w-16" />
      </div>
    ))}
  </div>
);

const LegacyTableSkeleton = () => (
  <div className="space-y-2 rounded-md border p-4">
    {Array.from({ length: 5 }).map((_, i: number) => (
      <div key={i} className="flex items-center gap-4">
        <Skeleton className="h-4 w-10" />
        <Skeleton className="h-4 flex-1" />
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-4 w-16" />
        <Skeleton className="h-4 w-16" />
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-4 w-24" />
      </div>
    ))}
  </div>
);

export default KeywordReports;
