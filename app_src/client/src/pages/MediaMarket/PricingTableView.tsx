import React, { useState, useMemo } from 'react';
import {
  Search,
  Upload,
  Download,
  Settings,
} from 'lucide-react';
import { Button } from '@client/src/components/ui/button';
import { Input } from '@client/src/components/ui/input';
import { Skeleton } from '@client/src/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@client/src/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@client/src/components/ui/select';
import { StatCard } from '@client/src/components/layout/StatCard';
import { SectionCard } from '@client/src/components/layout/SectionCard';
import { DataTable } from '@client/src/components/layout/DataTable';
import { Pill } from '@client/src/components/layout/Pill';
import type { DataTableColumn } from '@client/src/components/layout/DataTable';
import {
  useMarketStats,
  useChannels,
  useToggleChannelSellable,
  downloadTemplate,
  type ChannelListQuery,
} from '@client/src/api/media-market';
import { formatMoneyCents, formatMarkupRate, formatStockDisplay } from '@client/src/utils/format';
import PriceImportDialog from './components/PriceImportDialog';
import SupplierDrawer from './components/SupplierDrawer';
import PricingEditDialog from './components/PricingEditDialog';
import PriceAdjustDialog from './components/PriceAdjustDialog';
import { SUBMISSION_LIBRARY_TYPE_LABELS } from '@shared/api.interface';
import type { ChannelPricingAdmin, BulkChannelPriceRequest, BulkPriceMode, SubmissionLibraryType } from '@shared/api.interface';
import { bulkUpdatePrice } from '@client/src/api/submission-channels';
import { toast } from 'sonner';
import { logger } from '@lark-apaas/client-toolkit/logger';

const PAGE_SIZE = 20;

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return dateStr;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function isPriceExpired(dateStr: string): boolean {
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return false;
  const diffMs = Date.now() - d.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);
  return diffDays > 30;
}

const PricingTableView: React.FC = () => {
  const [keyword, setKeyword] = useState('');
  const [supplierId, setSupplierId] = useState('');
  const [sellable, setSellable] = useState<string>('');
  const [libraryType, setLibraryType] = useState('');
  const [region, setRegion] = useState('');
  const [page, setPage] = useState(1);

  const [importOpen, setImportOpen] = useState(false);
  const [supplierDrawerOpen, setSupplierDrawerOpen] = useState(false);
  const [editingChannel, setEditingChannel] = useState<ChannelPricingAdmin | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [adjustChannel, setAdjustChannel] = useState<ChannelPricingAdmin | null>(null);
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [bulkPriceOpen, setBulkPriceOpen] = useState(false);
  const [bulkMode, setBulkMode] = useState<BulkPriceMode>('markup_rate');
  const [bulkValue, setBulkValue] = useState('');
  const [bulkPreviewCount, setBulkPreviewCount] = useState<number | null>(null);
  const [bulkSubmitting, setBulkSubmitting] = useState(false);

  const { data: stats, isLoading: statsLoading } = useMarketStats();

  const queryParams: ChannelListQuery = useMemo(() => {
    const params: ChannelListQuery = {
      page,
      pageSize: PAGE_SIZE,
    };
    if (keyword.trim()) params.keyword = keyword.trim();
    if (supplierId) params.supplierId = supplierId;
    if (sellable !== '') params.sellable = sellable === 'true';
    if (libraryType) params.libraryType = libraryType;
    if (region) params.region = region;
    params.sortBy = 'price';
    params.sortOrder = 'asc';
    return params;
  }, [keyword, supplierId, sellable, libraryType, region, page]);

  const { data, isLoading, refetch } = useChannels(queryParams);
  const toggleSellable = useToggleChannelSellable();

  const total = data?.total ?? 0;
  const totalPages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;
  const [jumpInput, setJumpInput] = useState('');

  const handleEdit = (channel: ChannelPricingAdmin) => {
    setEditingChannel(channel);
    setEditOpen(true);
  };

  const handleAdjustPrice = (channel: ChannelPricingAdmin) => {
    setAdjustChannel(channel);
    setAdjustOpen(true);
  };

  const handleBulkPriceSubmit = async () => {
    const val = parseFloat(bulkValue);
    if (isNaN(val)) {
      toast.error('请输入有效的数值');
      return;
    }
    if (bulkMode === 'markup_rate' && val <= 0) {
      toast.error('加价倍率必须大于 0');
      return;
    }

    setBulkSubmitting(true);
    try {
      const body: BulkChannelPriceRequest = {
        mode: bulkMode,
        filter: {
          keyword: keyword.trim() || undefined,
          supplierId: supplierId || undefined,
          sellable: sellable !== '' ? sellable === 'true' : undefined,
          libraryType: (libraryType || undefined) as SubmissionLibraryType | undefined,
          region: region || undefined,
        },
      };
      if (bulkMode === 'markup_rate') {
        body.markupRate = val;
      } else {
        body.fixedDelta = Math.round(val * 100);
      }
      const res = await bulkUpdatePrice(body);
      toast.success(`已更新 ${res.affectedCount} 条渠道价格`);
      setBulkPriceOpen(false);
      refetch();
    } catch (err: unknown) {
      logger.error('批量调价失败', err);
      const msg =
        (err as { response?: { data?: { error?: { message?: string } } } })
          ?.response?.data?.error?.message ?? '批量调价失败';
      toast.error(msg);
    } finally {
      setBulkSubmitting(false);
    }
  };

  const handleToggleSellable = (id: string) => {
    toggleSellable.mutate(id);
  };

  const handleJump = () => {
    const n = parseInt(jumpInput, 10);
    if (isNaN(n) || n < 1) return;
    const target = Math.min(n, totalPages);
    setPage(target);
    setJumpInput('');
  };

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

  const columns: DataTableColumn[] = [
    {
      key: 'name',
      title: '渠道名',
      width: '22%',
      render: (row: ChannelPricingAdmin) => (
        <span className="font-medium text-[#0F172A]" title={row.name}>
          {row.name}
        </span>
      ),
    },
    {
      key: 'libraryType',
      title: '库类型',
      width: '8%',
      render: (row: ChannelPricingAdmin) => (
        row.libraryType
          ? SUBMISSION_LIBRARY_TYPE_LABELS[row.libraryType as keyof typeof SUBMISSION_LIBRARY_TYPE_LABELS] ?? row.libraryType
          : '—'
      ),
    },
    {
      key: 'supplierName',
      title: '供应商',
      width: '12%',
      render: (row: ChannelPricingAdmin) => row.supplierName || '—',
    },
    {
      key: 'salePriceCents',
      title: '售价',
      width: '12%',
      align: 'right',
      render: (row: ChannelPricingAdmin) => (
        <span className="font-semibold" style={{ color: '#2E7DFF' }}>
          {formatMoneyCents(row.salePriceCents)}
        </span>
      ),
    },
    {
      key: 'markupRate',
      title: '加价率',
      width: '8%',
      align: 'right',
      render: (row: ChannelPricingAdmin) => formatMarkupRate(row.markupRate),
    },
    {
      key: 'stock',
      title: '库存',
      width: '9%',
      align: 'right',
      render: (row: ChannelPricingAdmin) => formatStockDisplay(row.stock),
    },
    {
      key: 'sellable',
      title: '上架状态',
      width: '9%',
      render: (row: ChannelPricingAdmin) => (
        <Pill variant={row.sellable ? 'success' : 'muted'}>
          {row.sellable ? '已上架' : '已下架'}
        </Pill>
      ),
    },
    {
      key: 'priceUpdatedAt',
      title: '更新时间',
      width: '12%',
      render: (row: ChannelPricingAdmin) => (
        row.priceUpdatedAt ? (
          <div className="flex flex-col">
            <span
              className={
                isPriceExpired(row.priceUpdatedAt)
                  ? 'text-[#F59E0B] font-medium'
                  : 'text-[#5B6B85]'
              }
            >
              {formatDate(row.priceUpdatedAt)}
            </span>
            {isPriceExpired(row.priceUpdatedAt) && (
              <span className="text-[11px] text-[#F59E0B]">
                报价可能过期
              </span>
            )}
          </div>
        ) : (
          '—'
        )
      ),
    },
    {
      key: 'actions',
      title: '操作',
      width: '8%',
      align: 'right',
      render: (row: ChannelPricingAdmin) => (
        <div className="flex items-center justify-end gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-[12.5px] text-[#2E7DFF] hover:text-[#1E5FD6] hover:bg-[#EAF2FF]"
            onClick={() => handleAdjustPrice(row)}
          >
            修改价格
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-[12.5px] text-slate-500 hover:text-slate-700 hover:bg-slate-100"
            onClick={() => handleEdit(row)}
          >
            编辑
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className={`h-7 text-[12.5px] ${
              row.sellable
                ? 'text-[#F59E0B] hover:bg-[#FFFBEB]'
                : 'text-[#10B981] hover:bg-[#ECFDF5]'
            }`}
            onClick={() => handleToggleSellable(row.id)}
          >
            {row.sellable ? '下架' : '上架'}
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-5">
      {/* 统计卡片 — 8张，grid-cols-4 两行 */}
      <div className="grid grid-cols-2 gap-5 md:grid-cols-4">
        {statsLoading ? (
          Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="h-24 rounded-[12px] border border-[#E6EAF2] bg-white p-5"
              style={{
                boxShadow: '0 1px 2px rgba(15,23,42,.04), 0 8px 24px -12px rgba(15,23,42,.10)',
              }}
            >
              <Skeleton className="mb-2 h-4 w-16" />
              <Skeleton className="h-6 w-20" />
            </div>
          ))
        ) : (
          <>
            <StatCard
              label="供应商数"
              value={stats?.supplierCount ?? 0}
              unit="家"
            />
            <StatCard
              label="可售渠道数"
              value={stats?.sellableChannelCount ?? 0}
              unit="个"
            />
            <StatCard
              label="已定价未上架"
              value={stats?.pricedUnshelvedCount ?? 0}
              unit="个"
            />
            <StatCard
              label="平均售价(图文)"
              value={stats ? '¥' + (stats.avgSalePriceArticle ?? 0).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '¥0.00'}
            />
            <StatCard
              label="中位价(图文)"
              value={stats ? '¥' + (stats.medianSalePriceArticle ?? 0).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '¥0.00'}
            />
            <StatCard
              label="最低价(图文)"
              value={stats ? '¥' + (stats.minSalePriceArticle ?? 0).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '¥0.00'}
            />
            <StatCard
              label="最高价(图文)"
              value={stats ? '¥' + (stats.maxSalePriceArticle ?? 0).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '¥0.00'}
            />
            <StatCard
              label="平均售价(视频)"
              value={stats ? formatMoneyCents(stats.avgSalePriceVideo ?? 0) : '¥0.00'}
            />
          </>
        )}
      </div>

      {/* 报价列表 */}
      <SectionCard
        title="报价列表"
        count={total}
        actions={
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              onClick={() => {
                setBulkPriceOpen(true);
                setBulkPreviewCount(null);
                setBulkValue('');
              }}
              className="h-8 rounded-lg bg-[#2E7DFF] text-[13px] hover:bg-[#1E5FD6]"
            >
              批量调价
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setImportOpen(true)}
              className="h-8 rounded-lg border-[#E6EAF2] text-[13px]"
            >
              <Upload className="mr-1.5 h-3.5 w-3.5" />
              批量导入报价
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSupplierDrawerOpen(true)}
              className="h-8 rounded-lg border-[#E6EAF2] text-[13px]"
            >
              <Settings className="mr-1.5 h-3.5 w-3.5" />
              价格规则
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={downloadTemplate}
              className="h-8 rounded-lg text-[13px] text-[#2E7DFF] hover:text-[#1E5FD6] hover:bg-[#EAF2FF]"
            >
              <Download className="mr-1.5 h-3.5 w-3.5" />
              下载报价模板
            </Button>
          </div>
        }
      >
        {/* 筛选栏：搜索 + 3个下拉 = 4个筛选 */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94A3B8]" />
            <Input
              placeholder="搜索渠道名称"
              value={keyword}
              onChange={(e) => {
                setKeyword(e.target.value);
                setPage(1);
              }}
              className="h-9 w-[240px] rounded-lg pl-9 text-[13px]"
            />
          </div>

          <Select value={sellable} onValueChange={(v) => { setSellable(v); setPage(1); }}>
            <SelectTrigger className="h-9 w-[130px] rounded-lg text-[13px]">
              <SelectValue placeholder="上架状态" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">全部状态</SelectItem>
              <SelectItem value="true">已上架</SelectItem>
              <SelectItem value="false">已下架</SelectItem>
            </SelectContent>
          </Select>

          <Select value={libraryType} onValueChange={(v) => { setLibraryType(v); setPage(1); }}>
            <SelectTrigger className="h-9 w-[120px] rounded-lg text-[13px]">
              <SelectValue placeholder="库类型" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">全部</SelectItem>
              <SelectItem value="图文">图文</SelectItem>
              <SelectItem value="视频">视频</SelectItem>
              <SelectItem value="音频">音频</SelectItem>
            </SelectContent>
          </Select>

          <Select value={region} onValueChange={(v) => { setRegion(v); setPage(1); }}>
            <SelectTrigger className="h-9 w-[120px] rounded-lg text-[13px]">
              <SelectValue placeholder="地区" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">全部</SelectItem>
              <SelectItem value="全国">全国</SelectItem>
              <SelectItem value="华东">华东</SelectItem>
              <SelectItem value="华南">华南</SelectItem>
              <SelectItem value="华北">华北</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* 表格 */}
        <div className="mt-4">
          {isLoading ? (
            <div className="space-y-1">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="flex h-11 items-center gap-4 border-b border-[#EEF2F7] px-4">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="h-4 w-14" />
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-4 w-16" />
                </div>
              ))}
            </div>
          ) : (
            <DataTable
              columns={columns}
              data={data?.items ?? []}
              rowKey="id"
              emptyText="暂无渠道数据"
            />
          )}
        </div>

        {/* 分页器 */}
        {totalPages > 1 && (
          <div className="mt-4 flex items-center justify-between gap-2 text-[12px] text-[#5B6B85] flex-nowrap overflow-hidden border-t border-[#EEF2F7] pt-4">
            <div className="flex items-center gap-2 shrink-0">
              <span>
                共 <span className="tabular-nums font-medium text-[#0F172A]">{total.toLocaleString('en-US')}</span> 条
              </span>
              <span className="text-[#E6EAF2]">·</span>
              <span>
                第 <span className="tabular-nums font-medium text-[#0F172A]">{page}</span>/{totalPages} 页
              </span>
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
        )}
      </SectionCard>

      {/* 弹窗 & 抽屉 */}
      <PriceImportDialog open={importOpen} onOpenChange={setImportOpen} />

      <SupplierDrawer
        open={supplierDrawerOpen}
        onOpenChange={setSupplierDrawerOpen}
      />

      {editingChannel && (
        <PricingEditDialog
          open={editOpen}
          onOpenChange={setEditOpen}
          channel={editingChannel}
        />
      )}

      {adjustChannel && (
        <PriceAdjustDialog
          open={adjustOpen}
          onOpenChange={(open) => {
            setAdjustOpen(open);
            if (!open) setAdjustChannel(null);
          }}
          channelId={adjustChannel.id}
          channelName={adjustChannel.name}
          costPriceCents={adjustChannel.costPriceCents}
          salePriceCents={adjustChannel.salePriceCents}
          onSuccess={() => refetch?.()}
        />
      )}

      {/* 批量调价弹窗 */}
      <Dialog open={bulkPriceOpen} onOpenChange={setBulkPriceOpen}>
        <DialogContent className="max-w-[480px]">
          <DialogHeader>
            <DialogTitle>批量调价</DialogTitle>
            <DialogDescription>
              对当前筛选结果中的渠道统一调整售价
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-[#0f172a]">
                调价方式
              </label>
              <div className="flex gap-3">
                <label className="flex flex-1 cursor-pointer items-center gap-2 rounded-lg border border-[#E5E9F2] px-3 py-2.5 hover:border-[#2E7DFF]">
                  <input
                    type="radio"
                    checked={bulkMode === 'markup_rate'}
                    onChange={() => setBulkMode('markup_rate')}
                    className="h-4 w-4 accent-[#2E7DFF]"
                  />
                  <span className="text-sm">加价倍率</span>
                </label>
                <label className="flex flex-1 cursor-pointer items-center gap-2 rounded-lg border border-[#E5E9F2] px-3 py-2.5 hover:border-[#2E7DFF]">
                  <input
                    type="radio"
                    checked={bulkMode === 'fixed_delta'}
                    onChange={() => setBulkMode('fixed_delta')}
                    className="h-4 w-4 accent-[#2E7DFF]"
                  />
                  <span className="text-sm">固定增减</span>
                </label>
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-[#0f172a]">
                {bulkMode === 'markup_rate' ? '加价倍率（如 1.95）' : '增减金额（元，负数为减）'}
              </label>
              <Input
                type="number"
                step="0.01"
                value={bulkValue}
                onChange={(e) => {
                  setBulkValue(e.target.value);
                  setBulkPreviewCount(null);
                }}
                placeholder={bulkMode === 'markup_rate' ? '例如：1.95' : '例如：10 或 -5'}
              />
            </div>

            <div className="rounded-md bg-[#FFF7ED] px-3 py-2 text-sm text-[#B45309]">
              当前筛选条件下共 {total?.toLocaleString() ?? 0} 条渠道，
              仅对筛选结果执行，不会修改全库数据。
            </div>

            {bulkPreviewCount !== null && (
              <div className="rounded-md bg-[#F0FDF4] px-3 py-2 text-sm text-[#15803d]">
                预计影响 <strong>{bulkPreviewCount}</strong> 条渠道
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkPriceOpen(false)}>
              取消
            </Button>
            <Button
              className="bg-[#2E7DFF] hover:bg-[#2563EB]"
              onClick={handleBulkPriceSubmit}
              disabled={bulkSubmitting}
            >
              {bulkSubmitting ? '执行中...' : '确认调价'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PricingTableView;
