import React, { useMemo, useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { HelpCircle, ExternalLink, X } from 'lucide-react';
import { PageHeader } from '@client/src/components/layout/PageHeader';
import { useResizableColumns } from '@client/src/hooks/use-resizable-columns';
import { useAuth } from '@client/src/hooks/useAuth';
import { useBrandSelector } from '@client/src/hooks/useBrandSelector';
import {
  SUBMISSION_CHANNEL_TYPE_LABELS,
  SUBMISSION_AI_SOURCE_LABELS,
  PUBLISH_STATUS_LABELS,
} from '@shared/api.interface';
import type {
  PublishLedgerItem,
  SubmissionChannelType,
  PublishStatus,
  LedgerAccountDetail,
} from '@shared/api.interface';
import * as publishQueueApi from '@client/src/api/publish-queue';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@client/src/components/ui/select';
import { Pill } from '@client/src/components/layout/Pill';
import { SectionCard } from '@client/src/components/layout/SectionCard';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@client/src/components/ui/tooltip';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerClose,
} from '@client/src/components/ui/drawer';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@client/src/components/ui/tabs';
import { Skeleton } from '@client/src/components/ui/skeleton';
import { UniversalLink } from '@lark-apaas/client-toolkit/components/UniversalLink';

const PRIMARY = '#2563EB';
const DANGER = '#DC2626';
const SUCCESS = '#16A34A';
const WARNING = '#F59E0B';
const MUTED = '#94A3B8';
const BORDER = '#E6EAF2';

const COL_DEFAULTS: Record<string, number> = {
  channelName: 200,
  channelType: 110,
  aiPlatforms: 180,
  brandName: 130,
  submittedCount: 80,
  publishedCount: 80,
  failedCount: 70,
  indexStatus: 100,
  citeCount: 90,
  accountCount: 80,
  lastSubmitAt: 140,
  latestPublishUrl: 240,
};

const PublishLedgerPage: React.FC = () => {
  const { user } = useAuth();
  const isClient = user?.role === 'client';
  const [channelType, setChannelType] = useState<string>('');
  const [status, setStatus] = useState<string>('');
  const [keyword, setKeyword] = useState<string>('');
  const [detailChannelId, setDetailChannelId] = useState<string | null>(null);
  const [page, setPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(50);

  const { brands: brandOptions, selectedBrandId, setSelectedBrandId } =
    useBrandSelector();

  const brandId = isClient ? user?.brandId || '' : selectedBrandId;

  useEffect(() => {
    setPage(1);
  }, [brandId, channelType, status, keyword]);

  const {
    getThStyle,
    getTdStyle,
    getTableStyle,
    handleResizeStart,
  } = useResizableColumns({
    tableKey: 'publish-ledger',
    defaultWidths: COL_DEFAULTS,
    userId: user?.id || 'guest',
  });

  const queryParams = useMemo(() => {
    const params: Record<string, string> = {};
    if (brandId) params.brandId = brandId;
    if (channelType) params.channelType = channelType;
    if (status) params.status = status;
    if (keyword) params.keyword = keyword;
    params.page = String(page);
    params.limit = String(pageSize);
    return params;
  }, [brandId, channelType, status, page, pageSize]);

  const { data, isLoading } = useQuery({
    queryKey: ['publish-ledger', queryParams],
    queryFn: () => publishQueueApi.getLedger(queryParams),
  });

  const { data: detailData } = useQuery({
    queryKey: ['publish-ledger-detail', detailChannelId, queryParams],
    queryFn: () => {
      if (!detailChannelId) return { items: [] };
      return publishQueueApi.getLedgerDetail(detailChannelId, queryParams);
    },
    enabled: !!detailChannelId,
  });

  const { data: accountData } = useQuery({
    queryKey: ['publish-ledger-accounts', detailChannelId, queryParams],
    queryFn: () => {
      if (!detailChannelId) return { items: [] };
      return publishQueueApi.getLedgerAccounts(detailChannelId, queryParams);
    },
    enabled: !!detailChannelId,
  });

  const [drawerTab, setDrawerTab] = useState<string>('articles');

  const handleRowClick = (item: PublishLedgerItem) => {
    setDetailChannelId(item.channelId ?? 'unbound');
  };

  const formatDate = (iso: string | null): string => {
    if (!iso) return '—';
    const d = new Date(iso);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  const channelTypeLabel = (type: SubmissionChannelType | 'unbound'): string => {
    if (type === 'unbound') return '—';
    return SUBMISSION_CHANNEL_TYPE_LABELS[type] ?? type;
  };

  const stats = data?.stats;
  const items = data?.items ?? [];
  const totalCount = data?.total ?? 0;

  return (
    <TooltipProvider delayDuration={200}>
      <SectionCard
        title="渠道投放汇总"
        actions={null}
      >
        {/* 筛选栏 */}
        <div className="flex flex-wrap items-center gap-3 mb-4">
            {!isClient && (
              <div className="flex items-center gap-2">
                <span className="text-xs" style={{ color: MUTED }}>品牌</span>
                <Select value={selectedBrandId} onValueChange={setSelectedBrandId}>
                  <SelectTrigger className="h-8 w-[160px] text-xs">
                    <SelectValue placeholder="选择品牌" />
                  </SelectTrigger>
                  <SelectContent>
                    {brandOptions.map((b: { id: string; name: string }) => (
                      <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="flex items-center gap-2">
              <span className="text-xs" style={{ color: MUTED }}>渠道类型</span>
              <Select value={channelType} onValueChange={setChannelType}>
                <SelectTrigger className="h-8 w-[140px] text-xs">
                  <SelectValue placeholder="全部类型" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">全部类型</SelectItem>
                  <SelectItem value="self_site">自建站</SelectItem>
                  <SelectItem value="public_submission">公共投稿站</SelectItem>
                  <SelectItem value="authoritative_media">权威媒体</SelectItem>
                  <SelectItem value="industry_vertical">行业垂直站</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs" style={{ color: MUTED }}>信源</span>
              <input
                type="text"
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                placeholder="搜索信源名称"
                className="h-8 w-[180px] rounded-md border px-3 text-xs outline-none transition-colors focus:border-[#2E7DFF]"
                style={{ borderColor: BORDER }}
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs" style={{ color: MUTED }}>状态</span>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger className="h-8 w-[120px] text-xs">
                  <SelectValue placeholder="全部状态" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">全部状态</SelectItem>
                  <SelectItem value="pending">待发布</SelectItem>
                  <SelectItem value="publishing">发布中</SelectItem>
                  <SelectItem value="published">已收录并引用</SelectItem>
                  <SelectItem value="failed">未收录</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* 统计块 */}
          <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-5">
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i: number) => (
                <div
                  key={i}
                  className="rounded-xl border bg-white p-4"
                  style={{ borderColor: BORDER }}
                >
                  <Skeleton className="mb-2 h-3 w-20" />
                  <Skeleton className="h-7 w-16" />
                </div>
              ))
            ) : (
              <>
                <StatCard label="渠道总数" value={stats?.totalChannels ?? 0} />
                <StatCard label="已投放渠道数" value={stats?.activeChannels ?? 0} />
                <StatCard label="已投放账号数" value={stats?.activeAccounts ?? 0} />
                <StatCard label="累计已收录并引用" value={stats?.totalPublished ?? 0} />
                <StatCard label="累计未收录" value={stats?.totalFailed ?? 0} danger />
              </>
            )}
          </div>

          {/* 表格 */}
          <div
            className="overflow-hidden rounded-xl border bg-white"
            style={{ borderColor: BORDER }}
          >
            <div className="overflow-x-auto">
              <table
                className="w-full text-sm"
                style={{ ...getTableStyle(), maxWidth: 'none', tableLayout: 'fixed' }}
              >
                <thead>
                  <tr style={{ backgroundColor: '#F7F9FC' }}>
                    <Th
                      colKey="channelName"
                      style={getThStyle('channelName')}
                      onResizeStart={handleResizeStart}
                    >
                      渠道名称
                    </Th>
                    <Th
                      colKey="channelType"
                      style={getThStyle('channelType')}
                      onResizeStart={handleResizeStart}
                    >
                      类型
                    </Th>
                    <Th
                      colKey="aiPlatforms"
                      style={getThStyle('aiPlatforms')}
                      onResizeStart={handleResizeStart}
                    >
                      AI 信源
                    </Th>
                    <Th
                      colKey="brandName"
                      style={getThStyle('brandName')}
                      onResizeStart={handleResizeStart}
                    >
                      归属品牌
                    </Th>
                    <Th
                      colKey="submittedCount"
                      style={getThStyle('submittedCount')}
                      onResizeStart={handleResizeStart}
                      align="right"
                    >
                      已发布
                    </Th>
                    <Th
                      colKey="publishedCount"
                      style={getThStyle('publishedCount')}
                      onResizeStart={handleResizeStart}
                      align="right"
                    >
                      已收录并引用
                    </Th>
                    <Th
                      colKey="failedCount"
                      style={getThStyle('failedCount')}
                      onResizeStart={handleResizeStart}
                      align="right"
                    >
                      未收录
                    </Th>
                    <Th
                      colKey="accountCount"
                      style={getThStyle('accountCount')}
                      onResizeStart={handleResizeStart}
                      align="right"
                    >
                      账号数
                    </Th>
                    <Th
                      colKey="lastSubmitAt"
                      style={getThStyle('lastSubmitAt')}
                      onResizeStart={handleResizeStart}
                    >
                      最近投放时间
                    </Th>
                    <Th
                      colKey="latestPublishUrl"
                      style={getThStyle('latestPublishUrl')}
                      onResizeStart={handleResizeStart}
                    >
                      最新外链
                    </Th>
                    <Th
                      colKey="indexStatus"
                      style={getThStyle('indexStatus')}
                      onResizeStart={handleResizeStart}
                    >
                      收录状态
                    </Th>
                    <Th
                      colKey="citeCount"
                      style={getThStyle('citeCount')}
                      onResizeStart={handleResizeStart}
                      align="right"
                    >
                      引用次数
                    </Th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading ? (
                    Array.from({ length: 6 }).map((_, i: number) => (
                      <tr key={i}>
                        {Object.keys(COL_DEFAULTS).map((key: string) => (
                          <td key={key} style={getTdStyle(key)} className="p-0">
                            <div className="px-3 py-2.5">
                              <Skeleton className="h-3.5 w-3/4" />
                            </div>
                          </td>
                        ))}
                      </tr>
                    ))
                  ) : items.length === 0 ? (
                    <tr>
                      <td
                        colSpan={12}
                        className="px-4 py-12 text-center text-sm"
                        style={{ color: MUTED }}
                      >
                        暂无投放数据
                      </td>
                    </tr>
                  ) : (
                    items.map((item: PublishLedgerItem) => (
                      <tr
                        key={item.channelId ?? 'unbound'}
                        className="cursor-pointer border-t transition-colors hover:bg-[#F7F9FC]"
                        style={{ borderColor: BORDER }}
                        onClick={() => handleRowClick(item)}
                      >
                        <td style={getTdStyle('channelName')} className="px-3 py-2.5">
                          <div className="flex items-center gap-2">
                            <span
                              className="text-sm font-medium"
                              style={{
                                color: item.channelId ? '#0f172a' : MUTED,
                              }}
                            >
                              {item.channelName}
                            </span>
                            {!item.channelId && (
                              <span
                                className="text-xs"
                                style={{ color: MUTED }}
                              >
                                手动发布，未指定渠道
                              </span>
                            )}
                          </div>
                        </td>
                        <td style={getTdStyle('channelType')} className="px-3 py-2.5">
                          <span className="text-xs" style={{ color: MUTED }}>
                            {channelTypeLabel(item.channelType)}
                          </span>
                        </td>
                        <td style={getTdStyle('aiPlatforms')} className="px-3 py-2.5">
                          {item.aiPlatforms && item.aiPlatforms.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {item.aiPlatforms.slice(0, 3).map((p) => (
                                <span
                                  key={p}
                                  className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px]"
                                  style={{
                                    backgroundColor: 'rgba(46, 125, 255, 0.08)',
                                    color: '#2E7DFF',
                                  }}
                                >
                                  {SUBMISSION_AI_SOURCE_LABELS[p as keyof typeof SUBMISSION_AI_SOURCE_LABELS] || p}
                                </span>
                              ))}
                              {item.aiPlatforms.length > 3 && (
                                <span className="text-[10px]" style={{ color: MUTED }}>
                                  +{item.aiPlatforms.length - 3}
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-xs" style={{ color: MUTED }}>—</span>
                          )}
                        </td>
                        <td style={getTdStyle('brandName')} className="px-3 py-2.5">
                          <span className="text-xs" style={{ color: '#0f172a' }}>
                            {item.brandName || '—'}
                          </span>
                        </td>
                        <td
                          style={getTdStyle('submittedCount')}
                          className="px-3 py-2.5 text-right tnum"
                        >
                          <span className="text-sm" style={{ color: '#0f172a' }}>
                            {item.submittedCount}
                          </span>
                        </td>
                        <td
                          style={getTdStyle('publishedCount')}
                          className="px-3 py-2.5 text-right tnum"
                        >
                          <span
                            className="text-sm font-medium"
                            style={{ color: '#17C964' }}
                          >
                            {item.publishedCount}
                          </span>
                        </td>
                        <td
                          style={getTdStyle('failedCount')}
                          className="px-3 py-2.5 text-right tnum"
                        >
                          <span
                            className="text-sm"
                            style={{ color: item.failedCount > 0 ? '#FF5C5C' : '#0f172a' }}
                          >
                            {item.failedCount}
                          </span>
                        </td>
                        <td
                          style={getTdStyle('accountCount')}
                          className="px-3 py-2.5 text-right tnum"
                        >
                          {item.accountCount && item.accountCount > 0 ? (
                            <span className="text-sm" style={{ color: '#0f172a' }}>
                              {item.accountCount}
                            </span>
                          ) : (
                            <span className="text-xs" style={{ color: MUTED }}>—</span>
                          )}
                        </td>
                        <td style={getTdStyle('lastSubmitAt')} className="px-3 py-2.5">
                          <span className="text-xs" style={{ color: MUTED }}>
                            {formatDate(item.lastSubmitAt)}
                          </span>
                        </td>
                        <td style={getTdStyle('latestPublishUrl')} className="px-3 py-2.5">
                          {item.latestPublishUrl ? (
                            <UniversalLink
                              to={item.latestPublishUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-1 truncate text-xs"
                              style={{ color: PRIMARY }}
                              onClick={(e: React.MouseEvent) => e.stopPropagation()}
                            >
                              <span className="truncate">{item.latestPublishUrl}</span>
                              <ExternalLink className="size-3 shrink-0" />
                            </UniversalLink>
                          ) : (
                            <span className="text-xs" style={{ color: MUTED }}>—</span>
                          )}
                        </td>
                        <td style={getTdStyle('indexStatus')} className="px-3 py-2.5">
                          {item.hasPublished ? (
                            <Pill variant="success">已收录</Pill>
                          ) : item.failedCount > 0 ? (
                            <Pill variant="danger">未收录</Pill>
                          ) : (
                            <Pill variant="muted">待回收</Pill>
                          )}
                        </td>
                        <td
                          style={getTdStyle('citeCount')}
                          className="px-3 py-2.5 text-right"
                        >
                          <div className="flex flex-col items-end gap-0.5">
                            <span className="text-sm tnum" style={{ color: '#0f172a' }}>
                              0
                            </span>
                            <span className="text-xs" style={{ color: MUTED }}>
                              待回填
                            </span>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {totalCount > 0 && (
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 px-4 pb-4">
                <div className="text-xs text-slate-500">
                  共 <span className="tnum font-medium text-slate-700">{totalCount}</span> 条
                  <span className="ml-2">
                    第 <span className="tnum font-medium text-slate-700">
                      {(page - 1) * pageSize + 1}
                    </span> - <span className="tnum font-medium text-slate-700">
                      {Math.min(page * pageSize, totalCount)}
                    </span> 条
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <select
                    value={pageSize}
                    onChange={(e) => {
                      setPageSize(Number(e.target.value));
                      setPage(1);
                    }}
                    disabled={isLoading}
                    className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-600 focus:border-[#2E7DFF] focus:outline-none disabled:opacity-50"
                  >
                    <option value={20}>20 条/页</option>
                    <option value={50}>50 条/页</option>
                    <option value={100}>100 条/页</option>
                  </select>
                  <button
                    type="button"
                    onClick={() => setPage(page - 1)}
                    disabled={page <= 1 || isLoading}
                    className="h-7 rounded-md border border-slate-200 bg-white px-3 text-xs text-slate-600 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    上一页
                  </button>
                  <span className="px-2 text-xs text-slate-500">
                    第 <span className="tnum font-medium text-slate-700">{page}</span> /{' '}
                    <span className="tnum font-medium text-slate-700">
                      {Math.max(1, Math.ceil(totalCount / pageSize))}
                    </span>{' '}
                    页
                  </span>
                  <button
                    type="button"
                    onClick={() => setPage(page + 1)}
                    disabled={page >= Math.ceil(totalCount / pageSize) || isLoading}
                    className="h-7 rounded-md border border-slate-200 bg-white px-3 text-xs text-slate-600 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    下一页
                  </button>
                </div>
              </div>
            )}
          </div>

        {/* 抽屉 */}
        <Drawer
          open={!!detailChannelId}
          onOpenChange={(open: boolean) => {
            if (!open) setDetailChannelId(null);
          }}
          direction="right"
        >
          <DrawerContent className="h-full w-full max-w-[640px] p-0" style={{ borderRadius: 0 }}>
            <DrawerHeader className="border-b px-6 py-4" style={{ borderColor: BORDER }}>
              <DrawerTitle className="text-base font-semibold mb-3" style={{ color: '#0f172a' }}>
                {data?.items.find((it: PublishLedgerItem) => (it.channelId ?? 'unbound') === detailChannelId)?.channelName || '渠道详情'}
              </DrawerTitle>
              <Tabs value={drawerTab} onValueChange={setDrawerTab} className="w-full">
                <TabsList className="w-full">
                  <TabsTrigger value="articles" className="flex-1">稿件明细</TabsTrigger>
                  <TabsTrigger value="accounts" className="flex-1">账号明细</TabsTrigger>
                </TabsList>
              </Tabs>
              <DrawerClose className="absolute right-4 top-4 rounded-md p-1.5 hover:bg-slate-100">
                <X className="size-4" style={{ color: MUTED }} />
              </DrawerClose>
            </DrawerHeader>
            <div className="flex-1 overflow-y-auto px-6 py-4">
              {drawerTab === 'articles' && (
                <table className="w-full text-sm">
                  <thead>
                    <tr style={{ backgroundColor: '#F7F9FC' }}>
                      <th className="px-3 py-2.5 text-left text-xs font-medium" style={{ color: MUTED }}>标题</th>
                      <th className="px-3 py-2.5 text-left text-xs font-medium w-20" style={{ color: MUTED }}>状态</th>
                      <th className="px-3 py-2.5 text-left text-xs font-medium w-32" style={{ color: MUTED }}>创建时间</th>
                      <th className="px-3 py-2.5 text-left text-xs font-medium w-56" style={{ color: MUTED }}>外链</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detailData?.items.map((item) => (
                      <tr key={item.id} className="border-t" style={{ borderColor: BORDER }}>
                        <td className="px-3 py-2.5">
                          <div className="truncate text-sm" style={{ color: '#0f172a' }} title={item.title}>
                            {item.title}
                          </div>
                        </td>
                        <td className="px-3 py-2.5">
                          <StatusBadge status={item.status as PublishStatus} />
                        </td>
                        <td className="px-3 py-2.5">
                          <span className="text-xs" style={{ color: MUTED }}>
                            {formatDate(item.createdAt)}
                          </span>
                        </td>
                        <td className="px-3 py-2.5">
                          {item.publishUrl ? (
                            <UniversalLink
                              to={item.publishUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-1 truncate text-xs"
                              style={{ color: PRIMARY }}
                              title={item.publishUrl}
                            >
                              <span className="truncate">{item.publishUrl}</span>
                              <ExternalLink className="size-3 shrink-0" />
                            </UniversalLink>
                          ) : (
                            <span className="text-xs" style={{ color: MUTED }}>—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                    {detailData?.items.length === 0 && (
                      <tr>
                        <td colSpan={4} className="px-4 py-8 text-center text-sm" style={{ color: MUTED }}>
                          暂无稿件记录
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              )}
              {drawerTab === 'accounts' && (
                <AccountList accounts={accountData?.items ?? []} formatDate={formatDate} />
              )}
            </div>
          </DrawerContent>
        </Drawer>
      </SectionCard>
    </TooltipProvider>
  );
};

function StatCard({
  label,
  value,
  danger,
}: {
  label: string;
  value: number;
  danger?: boolean;
}) {
  return (
    <div
      className="rounded-xl border bg-white p-4"
      style={{ borderColor: BORDER }}
    >
      <div className="text-xs mb-1.5" style={{ color: MUTED }}>{label}</div>
      <div
        className="text-2xl font-bold tnum"
        style={{ color: danger ? '#FF5C5C' : '#0f172a' }}
      >
        {value}
      </div>
    </div>
  );
}

function Th({
  colKey,
  children,
  style,
  onResizeStart,
  align,
}: {
  colKey: string;
  children: React.ReactNode;
  style: React.CSSProperties;
  onResizeStart: (key: string, e: React.PointerEvent) => void;
  align?: 'left' | 'right';
}) {
  return (
    <th
      style={{ ...style, textAlign: align ?? 'left' }}
      className="relative px-3 py-2.5 text-xs font-medium select-none"
    >
      <span style={{ color: MUTED }}>{children}</span>
      <div
        className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-[#2E7DFF]"
        onPointerDown={(e: React.PointerEvent) => onResizeStart(colKey, e)}
      />
    </th>
  );
}

function AccountList({
  accounts,
  formatDate,
}: {
  accounts: LedgerAccountDetail[];
  formatDate: (iso: string | null) => string;
}) {
  if (accounts.length === 0) {
    return (
      <div className="py-12 text-center text-sm" style={{ color: MUTED }}>
        该渠道暂无授权账号
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {accounts.map((acc: LedgerAccountDetail, idx: number) => (
        <div
          key={acc.accountId ?? idx}
          className="rounded-xl border bg-white p-4"
          style={{ borderColor: BORDER }}
        >
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium" style={{ color: '#0f172a' }}>
                {acc.accountName || '—'}
              </span>
              {acc.platform && (
                <span className="text-xs" style={{ color: MUTED }}>
                  {acc.platform}
                </span>
              )}
            </div>
            {acc.indexed === true ? (
              <Pill variant="success">已收录</Pill>
            ) : acc.indexed === false ? (
              <Pill variant="danger">未收录</Pill>
            ) : (
              <span className="text-xs" style={{ color: MUTED }}>收录检测中</span>
            )}
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <div className="text-xs mb-1" style={{ color: MUTED }}>已发布</div>
              <div className="text-sm tnum" style={{ color: '#0f172a' }}>
                {acc.submittedCount}
              </div>
            </div>
            <div>
              <div className="text-xs mb-1" style={{ color: MUTED }}>已收录并引用</div>
              <div
                className="text-sm font-medium tnum"
                style={{ color: '#17C964' }}
              >
                {acc.publishedCount}
              </div>
            </div>
            <div>
              <div className="text-xs mb-1" style={{ color: MUTED }}>失败</div>
              <div
                className="text-sm tnum"
                style={{ color: acc.failedCount > 0 ? '#FF5C5C' : '#0f172a' }}
              >
                {acc.failedCount}
              </div>
            </div>
          </div>
          <div className="mt-3 space-y-2 border-t pt-3" style={{ borderColor: BORDER }}>
            <div className="flex items-center gap-2">
              <span className="text-xs shrink-0" style={{ color: MUTED }}>最近投放：</span>
              <span className="text-xs" style={{ color: '#0f172a' }}>
                {formatDate(acc.lastPublishAt)}
              </span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-xs shrink-0" style={{ color: MUTED }}>最新外链：</span>
              {acc.latestPublishUrl ? (
                <UniversalLink
                  to={acc.latestPublishUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 truncate text-xs"
                  style={{ color: PRIMARY }}
                  title={acc.latestPublishUrl}
                >
                  <span className="truncate">{acc.latestPublishUrl}</span>
                  <ExternalLink className="size-3 shrink-0" />
                </UniversalLink>
              ) : (
                <span className="text-xs" style={{ color: MUTED }}>—</span>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function StatusBadge({ status }: { status: PublishStatus }) {
  const variants: Record<string, 'success' | 'warning' | 'danger' | 'info' | 'muted'> = {
    pending: 'muted',
    publishing: 'info',
    pending_manual: 'warning',
    published: 'success',
    failed: 'danger',
    archived: 'muted',
  };
  const labels: Record<string, string> = {
    pending: PUBLISH_STATUS_LABELS.pending,
    publishing: '发布中',
    pending_manual: '待手动',
    published: PUBLISH_STATUS_LABELS.published,
    failed: PUBLISH_STATUS_LABELS.failed,
    archived: '已归档',
  };
  const variant = variants[status] ?? 'muted';
  const label = labels[status] ?? status;
  return <Pill variant={variant}>{label}</Pill>;
}

export default PublishLedgerPage;
