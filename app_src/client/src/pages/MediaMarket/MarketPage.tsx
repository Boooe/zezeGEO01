import React, { useState, useMemo } from 'react';
import {
  Search,
  ShoppingCart,
  Clock,
  Sparkles,
  Wallet,
  ArrowUpRight,
  LayoutGrid,
  List,
} from 'lucide-react';
import { Card, CardContent, CardFooter } from '@client/src/components/ui/card';
import { Button } from '@client/src/components/ui/button';
import { Input } from '@client/src/components/ui/input';
import { Badge } from '@client/src/components/ui/badge';
import { Skeleton } from '@client/src/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@client/src/components/ui/select';
import {
  ToggleGroup,
  ToggleGroupItem,
} from '@client/src/components/ui/toggle-group';
import { SectionCard } from '@client/src/components/layout/SectionCard';
import { EmptyState } from '@client/src/components/layout/EmptyState';
import PricingTableView from './PricingTableView';
import { useMarketChannels, type MarketChannelQuery, useMarketFilterOptions } from '@client/src/api/media-market';
import { SOURCE_TYPE_LABELS } from '@shared/api.interface';
import type { SourceType } from '@shared/api.interface';
import { useWallet } from '@client/src/api/media-wallet';
import { useAuth } from '@client/src/hooks/useAuth';
import { useBrandSelector } from '@client/src/hooks/useBrandSelector';
import { useNavigate } from 'react-router-dom';
import type { MarketChannel } from '@shared/api.interface';
import PriceAdjustDialog from './components/PriceAdjustDialog';
import { formatMoneyCents } from '@client/src/utils/format';
import OrderDialog from './components/OrderDialog';

const MEDIA_TYPE_LABELS: Record<string, string> = {
  image_text: '图文',
  image: '图片',
  video: '视频',
  audio: '音频',
};

const TURNAROUND_OPTIONS = [
  { value: 'all', label: '全部时效' },
  { value: '12', label: '12小时内' },
  { value: '24', label: '24小时内' },
  { value: '48', label: '48小时内' },
  { value: '72', label: '72小时内' },
] as const;

const SORT_OPTIONS = [
  { value: 'price_asc', label: '价格从低到高' },
  { value: 'price_desc', label: '价格从高到低' },
  { value: 'turnaround_asc', label: '时效从快到慢' },
  { value: 'turnaround_desc', label: '时效从慢到快' },
] as const;

const PAGE_SIZE_OPTIONS = [12, 24, 48, 96] as const;

function formatFollowers(n: number): string {
  if (n >= 10000) {
    const wan = n / 10000;
    return `${wan % 1 === 0 ? wan.toFixed(0) : wan.toFixed(1)}万`;
  }
  return String(n);
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return dateStr;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

const MarketPage: React.FC = () => {
  const { user, hasRole, hasPermission } = useAuth();
  const navigate = useNavigate();
  const isClient = hasRole('client');
  const isAdmin = hasRole('admin') || hasRole('operator');
  const canManagePrice = hasPermission('media.price');
  const [viewMode, setViewMode] = useState<'card' | 'table'>('card');
  const { selectedBrandId } = useBrandSelector();
  const walletBrandId = user?.brandId || selectedBrandId;
  const { data: wallet } = useWallet(walletBrandId || undefined);
  const { data: filterOptions } = useMarketFilterOptions();
  const [keyword, setKeyword] = useState('');
  const [mediaType, setMediaType] = useState<string>('');
  const [region, setRegion] = useState<string>('');
  const [industry, setIndustry] = useState<string>('');
  const [sourceType, setSourceType] = useState<string>('');
  const [priceMin, setPriceMin] = useState('');
  const [priceMax, setPriceMax] = useState('');
  const [turnaround, setTurnaround] = useState<string>('all');
  const [sortBy, setSortBy] = useState<string>('price_asc');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(12);
  const [jumpInput, setJumpInput] = useState('');
  const [orderChannel, setOrderChannel] = useState<MarketChannel | null>(null);
  const [orderOpen, setOrderOpen] = useState(false);
  const [priceAdjustChannelId, setPriceAdjustChannelId] = useState<string | null>(null);
  const [priceAdjustOpen, setPriceAdjustOpen] = useState(false);

  const queryParams: MarketChannelQuery = useMemo(() => {
    const params: MarketChannelQuery = {
      page,
      pageSize,
    };
    if (keyword.trim()) params.keyword = keyword.trim();
    if (mediaType) params.mediaType = mediaType;
    if (region) params.region = region;
    if (industry) params.industry = industry;
    if (sourceType) params.sourceType = sourceType as SourceType;
    if (priceMin) {
      const min = parseFloat(priceMin);
      if (!isNaN(min) && min > 0) params.priceMin = Math.round(min * 100);
    }
    if (priceMax) {
      const max = parseFloat(priceMax);
      if (!isNaN(max) && max > 0) params.priceMax = Math.round(max * 100);
    }
    if (turnaround !== 'all') {
      const hours = parseInt(turnaround, 10);
      if (!isNaN(hours) && hours > 0) params.turnaroundMax = hours;
    }
    const [sortField, sortOrder] = sortBy.split('_');
    params.sortBy = sortField as 'price' | 'turnaroundHours';
    params.sortOrder = sortOrder as 'asc' | 'desc';
    return params;
  }, [keyword, mediaType, region, industry, priceMin, priceMax, turnaround, sortBy, page, pageSize]);

  const { data, isLoading, isError, refetch } = useMarketChannels(queryParams);
  const total = data?.total ?? 0;
  const totalPages = data ? Math.max(1, Math.ceil(data.total / pageSize)) : 1;

  const pageNumbers = useMemo(() => {
    const pages: (number | 'ellipsis')[] = [];
    const delta = 1;
    const range: number[] = [];
    for (let i = Math.max(2, page - delta); i <= Math.min(totalPages - 1, page + delta); i++) {
      range.push(i);
    }
    pages.push(1);
    if (page - delta > 2) pages.push('ellipsis');
    for (const p of range) pages.push(p);
    if (page + delta < totalPages - 1) pages.push('ellipsis');
    if (totalPages > 1) pages.push(totalPages);
    return pages;
  }, [page, totalPages]);

  const handlePageSizeChange = (size: number) => {
    setPageSize(size);
    setPage(1);
  };

  const handleJump = () => {
    const n = parseInt(jumpInput, 10);
    if (isNaN(n) || n < 1) return;
    const target = Math.min(n, totalPages);
    setPage(target);
    setJumpInput('');
  };

  const handleSearch = () => {
    setPage(1);
    refetch();
  };

  const handleOrderClick = (channel: MarketChannel) => {
    setOrderChannel(channel);
    setOrderOpen(true);
  };

  return (
    <div>
      {wallet && (
        <div
          className="mb-4 flex items-center justify-between rounded-xl border px-5 py-4"
          style={{
            background: 'linear-gradient(135deg, #2E7DFF 0%, #00C2FF 100%)',
            borderColor: 'rgba(46,125,255,0.2)',
          }}
        >
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/20">
              <Wallet className="h-5 w-5 text-white" />
            </div>
            <div>
              <p className="text-xs text-white/70">
                {isAdmin ? '当前品牌可用余额' : '可用余额'}
              </p>
              <p className="text-2xl font-bold text-white tnum">
                {formatMoneyCents(wallet.balanceCents)}
              </p>
            </div>
            <div className="ml-6 flex gap-6 text-white">
              <div>
                <p className="text-xs text-white/70">冻结中</p>
                <p className="text-sm font-medium tnum">
                  {formatMoneyCents(wallet.frozenCents)}
                </p>
              </div>
              <div>
                <p className="text-xs text-white/70">累计充值</p>
                <p className="text-sm font-medium tnum">
                  {formatMoneyCents(wallet.totalRechargedCents)}
                </p>
              </div>
              <div>
                <p className="text-xs text-white/70">累计消耗</p>
                <p className="text-sm font-medium tnum">
                  {formatMoneyCents(wallet.totalSpentCents)}
                </p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate('/media-market?tab=wallet')}
              className="flex items-center gap-1.5 rounded-lg bg-white px-4 py-2 text-sm font-medium text-[#2E7DFF] shadow-sm hover:bg-white/90"
            >
              查看钱包
              <ArrowUpRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      <SectionCard
        title="媒体资源"
        count={total}
      >
        {/* 视图切换（仅有权限用户可见） */}
        {canManagePrice && (
          <div className="mb-4 flex justify-end">
            <ToggleGroup
              type="single"
              value={viewMode}
              onValueChange={(v) => v && setViewMode(v as 'card' | 'table')}
              variant="outline"
              size="sm"
            >
              <ToggleGroupItem value="card" aria-label="卡片视图">
                <LayoutGrid className="mr-1.5 h-3.5 w-3.5" />
                卡片
              </ToggleGroupItem>
              <ToggleGroupItem value="table" aria-label="表格视图">
                <List className="mr-1.5 h-3.5 w-3.5" />
                表格
              </ToggleGroupItem>
            </ToggleGroup>
          </div>
        )}

        {viewMode === 'card' && (
        <>
        {/* 搜索与筛选栏 */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[240px]">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94A3B8]" />
            <Input
              placeholder="搜索媒体名称、关键词"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              className="h-9 rounded-lg pl-9 text-[13px]"
            />
          </div>

          <Select value={mediaType} onValueChange={(v) => { setMediaType(v); setPage(1); }}>
            <SelectTrigger className="h-9 w-[120px] rounded-lg text-[13px]">
              <SelectValue placeholder="类型" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">全部类型</SelectItem>
              {(filterOptions?.mediaTypes ?? []).map((t) => (
                <SelectItem key={t} value={t}>{MEDIA_TYPE_LABELS[t] ?? t}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={region} onValueChange={(v) => { setRegion(v); setPage(1); }}>
            <SelectTrigger className="h-9 w-[120px] rounded-lg text-[13px]">
              <SelectValue placeholder="地区" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">全部地区</SelectItem>
              {(filterOptions?.regions ?? []).map((r) => (
                <SelectItem key={r} value={r}>{r}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={industry} onValueChange={(v) => { setIndustry(v); setPage(1); }}>
            <SelectTrigger className="h-9 w-[120px] rounded-lg text-[13px]">
              <SelectValue placeholder="行业" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">全部行业</SelectItem>
              {(filterOptions?.industries ?? []).map((ind) => (
                <SelectItem key={ind} value={ind}>{ind}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={sourceType} onValueChange={(v) => { setSourceType(v); setPage(1); }}>
            <SelectTrigger className="h-9 w-[120px] rounded-lg text-[13px]">
              <SelectValue placeholder="信源类型" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">全部信源</SelectItem>
              <SelectItem value="self">{SOURCE_TYPE_LABELS.self}</SelectItem>
              <SelectItem value="supplier">{SOURCE_TYPE_LABELS.supplier}</SelectItem>
            </SelectContent>
          </Select>

          <div className="flex items-center gap-2">
            <Input
              type="number"
              placeholder="最低价"
              value={priceMin}
              onChange={(e) => setPriceMin(e.target.value)}
              className="h-9 w-[100px] rounded-lg text-[13px]"
            />
            <span className="text-[#94A3B8]">—</span>
            <Input
              type="number"
              placeholder="最高价"
              value={priceMax}
              onChange={(e) => setPriceMax(e.target.value)}
              className="h-9 w-[100px] rounded-lg text-[13px]"
            />
            <span className="text-[13px] text-[#5B6B85]">元</span>
          </div>

          <Select value={turnaround} onValueChange={(v) => { setTurnaround(v); setPage(1); }}>
            <SelectTrigger className="h-9 w-[130px] rounded-lg text-[13px]">
              <SelectValue placeholder="时效" />
            </SelectTrigger>
            <SelectContent>
              {TURNAROUND_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={sortBy} onValueChange={(v) => { setSortBy(v); setPage(1); }}>
            <SelectTrigger className="h-9 w-[160px] rounded-lg text-[13px]">
              <SelectValue placeholder="排序" />
            </SelectTrigger>
            <SelectContent>
              {SORT_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* 卡片网格 */}
        <div className="mt-5">
          {isLoading ? (
            <ChannelGridSkeleton />
          ) : isError ? (
            <EmptyState
              description="加载失败，请重试"
              action={
                <Button variant="outline" onClick={() => refetch()}>
                  重新加载
                </Button>
              }
            />
          ) : !data?.items.length ? (
            <EmptyState
              description="暂无上架渠道"
              action={
                <Button className="h-9 rounded-lg bg-[#2E7DFF] text-[13px] font-medium hover:bg-[#1E5FD6]">
                  联系销售
                </Button>
              }
            />
          ) : (
            <>
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {data.items.map((channel: MarketChannel) => (
                  <ChannelCard
                    key={channel.id}
                    channel={channel}
                    onOrder={() => handleOrderClick(channel)}
                    showAdjustButton={!isClient}
                    onAdjustPrice={() => {
                      setPriceAdjustChannelId(channel.id);
                      setPriceAdjustOpen(true);
                    }}
                  />
                ))}
              </div>

              {/* 分页器 */}
              <div className="mt-5 flex items-center justify-between gap-2 text-[12px] text-[#5B6B85] flex-nowrap overflow-hidden">
                <div className="flex items-center gap-2 shrink-0">
                  <span>
                    共 <span className="tabular-nums font-medium text-[#0F172A]">{total.toLocaleString('en-US')}</span> 条
                  </span>
                  <span className="text-[#E6EAF2]">·</span>
                  <span>
                    第 <span className="tabular-nums font-medium text-[#0F172A]">{page}</span>/{totalPages} 页
                  </span>

                  <div className="hidden items-center gap-1 lg:flex ml-2">
                    <span>每页</span>
                    <Select value={String(pageSize)} onValueChange={(v) => handlePageSizeChange(Number(v))}>
                      <SelectTrigger className="h-9 w-[64px] rounded-md border-[#E6EAF2] text-[12px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {PAGE_SIZE_OPTIONS.map((size) => (
                          <SelectItem key={size} value={String(size)}>{size} 条</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => setPage(1)}
                    disabled={page <= 1}
                    className="hidden h-9 w-[52px] items-center justify-center rounded-md border border-[#E6EAF2] bg-white text-[#5B6B85] transition hover:border-[#2E7DFF] hover:text-[#2E7DFF] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-[#E6EAF2] disabled:hover:text-[#5B6B85] lg:flex"
                  >
                    首页
                  </button>
                  <button
                    type="button"
                    onClick={() => setPage(Math.max(1, page - 1))}
                    disabled={page <= 1}
                    className="flex h-9 w-9 items-center justify-center rounded-md border border-[#E6EAF2] bg-white text-[#5B6B85] transition hover:border-[#2E7DFF] hover:text-[#2E7DFF] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-[#E6EAF2] disabled:hover:text-[#5B6B85]"
                  >
                    上一页
                  </button>

                  <div className="hidden items-center gap-1 lg:flex">
                    {pageNumbers.map((p, idx) => (
                      p === 'ellipsis' ? (
                        <span key={`e-${idx}`} className="flex h-9 w-9 items-center justify-center text-[#94A3B8] text-[11px]">
                          …
                        </span>
                      ) : (
                        <button
                          key={p}
                          type="button"
                          onClick={() => setPage(p)}
                          className={`flex h-9 w-9 items-center justify-center rounded-md border tabular-nums text-[12px] transition ${
                            p === page
                              ? 'border-[#2E7DFF] bg-[#2E7DFF] font-medium text-white'
                              : 'border-[#E6EAF2] bg-white text-[#5B6B85] hover:border-[#2E7DFF] hover:text-[#2E7DFF]'
                          }`}
                        >
                          {p}
                        </button>
                      )
                    ))}
                  </div>

                  <div className="flex items-center gap-1 lg:hidden">
                    <span className="tabular-nums text-[#5B6B85]">
                      {page}/{totalPages}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => setPage(Math.min(totalPages, page + 1))}
                    disabled={page >= totalPages}
                    className="flex h-9 w-9 items-center justify-center rounded-md border border-[#E6EAF2] bg-white text-[#5B6B85] transition hover:border-[#2E7DFF] hover:text-[#2E7DFF] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-[#E6EAF2] disabled:hover:text-[#5B6B85]"
                  >
                    下一页
                  </button>
                  <button
                    type="button"
                    onClick={() => setPage(totalPages)}
                    disabled={page >= totalPages}
                    className="hidden h-9 w-[52px] items-center justify-center rounded-md border border-[#E6EAF2] bg-white text-[#5B6B85] transition hover:border-[#2E7DFF] hover:text-[#2E7DFF] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-[#E6EAF2] disabled:hover:text-[#5B6B85] lg:flex"
                  >
                    末页
                  </button>

                  <div className="hidden items-center gap-1 pl-2 lg:flex">
                    <span>跳至</span>
                    <Input
                      type="number"
                      value={jumpInput}
                      onChange={(e) => setJumpInput(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleJump()}
                      className="h-9 w-12 rounded-md border-[#E6EAF2] px-2 text-center text-[12px]"
                      min={1}
                    />
                    <span>页</span>
                    <button
                      type="button"
                      onClick={handleJump}
                      className="h-9 px-2 rounded-md border border-[#E6EAF2] bg-white text-[#5B6B85] transition hover:border-[#2E7DFF] hover:text-[#2E7DFF]"
                    >
                      GO
                    </button>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        </>
        )}

        {viewMode === 'table' && canManagePrice && (
          <PricingTableView />
        )}
      </SectionCard>

      {/* 下单弹窗 */}
      {orderChannel && (
        <OrderDialog
          open={orderOpen}
          onOpenChange={setOrderOpen}
          channel={orderChannel}
        />
      )}

      {/* 修改价格弹窗 */}
      {priceAdjustChannelId && (
        <PriceAdjustDialog
          open={priceAdjustOpen}
          onOpenChange={(open) => {
            setPriceAdjustOpen(open);
            if (!open) setPriceAdjustChannelId(null);
          }}
          channelId={priceAdjustChannelId}
          onSuccess={() => refetch()}
        />
      )}
    </div>
  );
};

/* ---------- 渠道卡片 ---------- */

interface ChannelCardProps {
  channel: MarketChannel;
  onOrder: () => void;
  onAdjustPrice?: () => void;
  showAdjustButton?: boolean;
}

const ChannelCard: React.FC<ChannelCardProps> = ({ channel, onOrder, onAdjustPrice, showAdjustButton }) => {
  const hasAi = channel.aiSources && channel.aiSources.length > 0;

  const libraryTypeLabels: Record<string, string> = {
    public: '公共媒体库',
    authoritative: '权威媒体库',
    b2b: 'B2B联盟',
    multimodal: '多模态信源',
    private: '私人媒体库',
  };
  const libraryTypeLabel = channel.libraryType
    ? libraryTypeLabels[channel.libraryType] ?? channel.libraryType
    : '';

  const isSoldOut = channel.stock !== null && channel.stock === 0;
  const stockText = channel.stock === null || channel.stock < 0
    ? '库存充足'
    : channel.stock === 0
      ? '暂时约满'
      : `库存 ${channel.stock} 篇`;

  const stockIcon = isSoldOut
    ? (
        <svg
          className="h-3.5 w-3.5"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="10" />
          <path d="M15 9l-6 6" />
          <path d="M9 9l6 6" />
        </svg>
      )
    : (
        <svg
          className="h-3.5 w-3.5"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
          <polyline points="22 4 12 14.01 9 11.01" />
        </svg>
      );

  const turnaroundText = !channel.turnaroundHours || channel.turnaroundHours <= 0
    ? '时效以供应商为准'
    : `${channel.turnaroundHours}小时出稿`;

  const unitText = channel.priceUnit === 'video'
    ? '元/条'
    : '元/篇';

  const industriesText = channel.industries && channel.industries.length > 0
    ? channel.industries.join('、')
    : '';

  const followersText = channel.followers
    ? formatFollowers(channel.followers)
    : '';

  const priceUpdatedText = channel.priceUpdatedAt
    ? formatDate(channel.priceUpdatedAt)
    : '';

  return (
    <Card
      className="flex flex-col overflow-hidden border-[#E6EAF2] bg-white transition-all hover:border-[#2E7DFF]/30"
      style={{
        boxShadow: '0 1px 2px rgba(15,23,42,.04), 0 8px 24px -12px rgba(15,23,42,.10)',
      }}
    >
      <CardContent className="flex-1 p-5">
        <div className="mb-3 flex items-start justify-between gap-2">
          <h3
            className="line-clamp-2 text-[14px] font-semibold text-[#0F172A]"
            title={channel.name}
          >
            {channel.name}
          </h3>
        </div>

        <div className="mb-4 flex flex-wrap gap-1.5">
          {libraryTypeLabel && (
            <Badge variant="outline" className="h-[22px] rounded-[6px] border-[#E6EAF2] text-[12px] font-normal text-[#5B6B85]">
              {libraryTypeLabel}
            </Badge>
          )}
          {channel.region && (
            <Badge variant="outline" className="h-[22px] rounded-[6px] border-[#E6EAF2] text-[12px] font-normal text-[#5B6B85]">
              {channel.region}
            </Badge>
          )}
          {hasAi && (
            <Badge className="h-[22px] rounded-[6px] bg-[#EAF2FF] text-[12px] font-normal text-[#2E7DFF] border-none">
              <Sparkles className="mr-1 h-3 w-3" />
              AI信源
            </Badge>
          )}
        </div>

        <div className="mb-3 flex items-baseline">
          <span
            className="tabular-nums text-[18px] font-semibold"
            style={{ color: '#2E7DFF' }}
          >
            {formatMoneyCents(channel.salePriceCents)}
          </span>
          <span className="ml-1 text-[12px] text-[#94A3B8]">
            {unitText}
          </span>
        </div>

        <div className="flex items-center gap-4 text-[13px] text-[#5B6B85]">
          <div className="flex items-center gap-1">
            <Clock className="h-3.5 w-3.5" />
            <span>{turnaroundText}</span>
          </div>
          <div className="flex items-center gap-1" aria-label={`库存状态: ${stockText}`}>
            {stockIcon}
            <span className="tabular-nums">{stockText}</span>
          </div>
        </div>

        {(industriesText || followersText) && (
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-[#5B6B85]">
            {industriesText && (
              <span>行业：{industriesText}</span>
            )}
            {followersText && (
              <span>粉丝 {followersText}</span>
            )}
          </div>
        )}

        {priceUpdatedText && (
          <div className="mt-2 text-[12px] text-[#94A3B8]">
            价格更新时间：{priceUpdatedText}
          </div>
        )}
      </CardContent>

      <CardFooter className="border-t border-[#EEF2F7] p-5 pt-4">
        {showAdjustButton && onAdjustPrice ? (
          <div className="flex w-full gap-2">
            <Button
              variant="outline"
              className="flex-1 rounded-lg border-[#E5E9F2] text-[#2E7DFF] hover:bg-[#F0F5FF]"
              onClick={onAdjustPrice}
              size="sm"
            >
              修改价格
            </Button>
            <Button
              className="flex-1 rounded-lg bg-[#2E7DFF] hover:bg-[#1E5FD6]"
              onClick={onOrder}
              disabled={isSoldOut}
              size="sm"
            >
              <ShoppingCart className="mr-1.5 h-3.5 w-3.5" />
              {isSoldOut ? '约满' : '去发稿'}
            </Button>
          </div>
        ) : (
          <Button
            className="h-9 w-full rounded-lg bg-[#2E7DFF] hover:bg-[#1E5FD6]"
            onClick={onOrder}
            disabled={isSoldOut}
          >
            <ShoppingCart className="mr-2 h-4 w-4" />
            {isSoldOut ? '暂时约满' : '去发稿'}
          </Button>
        )}
      </CardFooter>
    </Card>
  );
};

/* ---------- 骨架屏 ---------- */

const ChannelGridSkeleton: React.FC = () => {
  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {Array.from({ length: 8 }).map((_, i) => (
        <div
          key={i}
          className="rounded-[12px] border border-[#E6EAF2] bg-white p-5"
          style={{
            boxShadow: '0 1px 2px rgba(15,23,42,.04), 0 8px 24px -12px rgba(15,23,42,.10)',
          }}
        >
          <Skeleton className="mb-4 h-5 w-3/4" />
          <div className="mb-4 flex gap-1.5">
            <Skeleton className="h-[22px] w-12 rounded-[6px]" />
            <Skeleton className="h-[22px] w-12 rounded-[6px]" />
          </div>
          <Skeleton className="mb-3 h-8 w-32" />
          <div className="flex gap-4">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-20" />
          </div>
          <Skeleton className="mt-5 h-9 w-full rounded-lg" />
        </div>
      ))}
    </div>
  );
};

export default MarketPage;
