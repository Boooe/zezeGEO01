import { useMemo, useState } from 'react';
import {
  useQuery,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';
import {
  Search,
  TrendingUp,
  DollarSign,
  Wallet,
  Download,
  Zap,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  ArrowUpRight,
  FileText,
} from 'lucide-react';
import { logger } from '@lark-apaas/client-toolkit/logger';
import { toast } from 'sonner';

import { Button } from '@client/src/components/ui/button';
import { Input } from '@client/src/components/ui/input';
import { Label } from '@client/src/components/ui/label';
import { Textarea } from '@client/src/components/ui/textarea';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@client/src/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@client/src/components/ui/table';
import { ColumnResizeHandle } from '@client/src/components/ui/column-resize-handle';
import { useResizableColumns } from '@client/src/hooks/use-resizable-columns';
import { Badge } from '@client/src/components/ui/badge';
import { Pill } from '@client/src/components/layout/Pill';
import { DataTable } from '@client/src/components/layout/DataTable';
import { StatCard } from '@client/src/components/layout/StatCard';
import { Skeleton } from '@client/src/components/ui/skeleton';
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@client/src/components/ui/empty';
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@client/src/components/ui/pagination';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@client/src/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@client/src/components/ui/dialog';
import { Checkbox } from '@client/src/components/ui/checkbox';
import { useAuth } from '@client/src/contexts/AuthContext';
import { PageHeader } from '@client/src/components/layout/PageHeader';
import {
  getCreditOverview,
  batchRecharge,
  getConsumptionRank,
  getMonthlyBill,
  exportMonthlyBillCsv,
} from '@client/src/api/admin';
import type {
  CreditBrandRow,
  CreditHealthStatus,
  MonthlyBillRow,
  ConsumptionRankItem,
} from '@shared/api.interface';

const PRIMARY = '#2E7DFF';
const SUCCESS = '#10B981';
const WARNING = '#F59E0B';
const DANGER = '#EF4444';
const MUTED = '#94A3B8';

const CREDIT_CUSTOMERS_COL_DEFAULTS: Record<string, number> = {
  select: 40,
  brand: 110,
  company: 120,
  plan: 90,
  balance: 80,
  monthlyConsumed: 80,
  monthlyRecharged: 80,
  lastConsumedAt: 100,
  status: 70,
};

const CREDIT_BILLS_COL_DEFAULTS: Record<string, number> = {
  customer: 150,
  openingBalance: 110,
  monthlyConsumed: 110,
  monthlyRecharged: 110,
  closingBalance: 110,
  consumedAmount: 110,
};

const HEALTH_STATUS_OPTIONS = [
  { value: '', label: '全部状态' },
  { value: 'sufficient', label: '充足' },
  { value: 'low', label: '偏低' },
  { value: 'critical', label: '告急' },
];

const HEALTH_STATUS_LABELS: Record<CreditHealthStatus, string> = {
  sufficient: '充足',
  low: '偏低',
  critical: '告急',
};

const getHealthColor = (status: CreditHealthStatus): string => {
  switch (status) {
    case 'sufficient':
      return SUCCESS;
    case 'low':
      return WARNING;
    case 'critical':
      return DANGER;
    default:
      return MUTED;
  }
};

const formatDate = (dateStr: string | null): string => {
  if (!dateStr) return '-';
  return dateStr.replace('T', ' ').slice(0, 16);
};

const CreditOverviewPage = () => {
  const { user, hasRole } = useAuth();
  const isAdmin = hasRole('admin');
  const queryClient = useQueryClient();

  const {
    getThStyle: getCustomersThStyle,
    getTdStyle: getCustomersTdStyle,
    getTableStyle: getCustomersTableStyle,
    handleResizeStart: handleCustomersResizeStart,
    resetColumn: resetCustomersColumn,
    resetAll: resetCustomersAll,
    isResizing: isCustomersResizing,
  } = useResizableColumns({
    tableKey: 'credit-customers',
    defaultWidths: CREDIT_CUSTOMERS_COL_DEFAULTS,
    userId: user?.id || 'guest',
    defaultVersion: 3,
    fillContainer: true,
  });

  const {
    getThStyle: getBillsThStyle,
    getTdStyle: getBillsTdStyle,
    getTableStyle: getBillsTableStyle,
    handleResizeStart: handleBillsResizeStart,
    resetColumn: resetBillsColumn,
    resetAll: resetBillsAll,
    isResizing: isBillsResizing,
  } = useResizableColumns({
    tableKey: 'credit-bills',
    defaultWidths: CREDIT_BILLS_COL_DEFAULTS,
    userId: user?.id || 'guest',
    defaultVersion: 2,
  });

  const [page, setPage] = useState(1);
  const pageSize = 10;
  const [keyword, setKeyword] = useState('');
  const [keywordInput, setKeywordInput] = useState('');
  const [healthStatus, setHealthStatus] = useState('');

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [batchRechargeOpen, setBatchRechargeOpen] = useState(false);
  const [rechargeAmount, setRechargeAmount] = useState(0);
  const [rechargeRemark, setRechargeRemark] = useState('');

  // 月度账单
  const [billPage, setBillPage] = useState(1);
  const billPageSize = 10;
  const [billMonth, setBillMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['admin-credit-overview', page, pageSize, keyword, healthStatus],
    queryFn: () =>
      getCreditOverview({
        page,
        pageSize,
        keyword: keyword || undefined,
        healthStatus: healthStatus || undefined,
      }),
  });

  const { data: rankData, isLoading: rankLoading } = useQuery({
    queryKey: ['admin-consumption-rank', billMonth],
    queryFn: () => getConsumptionRank({ month: billMonth }),
  });

  const { data: billData, isLoading: billLoading } = useQuery({
    queryKey: ['admin-monthly-bill', billMonth, billPage, billPageSize],
    queryFn: () =>
      getMonthlyBill({
        month: billMonth,
        page: billPage,
        pageSize: billPageSize,
      }),
  });

  const batchRechargeMutation = useMutation({
    mutationFn: ({
      brandIds,
      amount,
      remark,
    }: {
      brandIds: string[];
      amount: number;
      remark?: string;
    }) => batchRecharge({ brandIds, amount, remark }),
    retry: false,
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['admin-credit-overview'] });
      queryClient.invalidateQueries({ queryKey: ['admin-monthly-bill'] });
      queryClient.invalidateQueries({ queryKey: ['admin-consumption-rank'] });
      toast.success(
        `批量充值完成：成功 ${res.successCount} 个，失败 ${res.failedCount} 个`,
      );
      setBatchRechargeOpen(false);
      setSelectedIds([]);
      setRechargeAmount(0);
      setRechargeRemark('');
    },
    onError: (err: unknown) => {
      logger.error('批量充值失败', err);
      const msg =
        (err as { response?: { data?: { error?: { message?: string } } } })
          .response?.data?.error?.message || '批量充值失败，请重试';
      toast.error(msg);
    },
  });

  const totalPages = data ? Math.ceil(data.total / pageSize) : 0;
  const billTotalPages = billData ? Math.ceil(billData.total / billPageSize) : 0;

  const handleSearch = () => {
    setKeyword(keywordInput.trim());
    setPage(1);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') handleSearch();
  };

  const handleStatusChange = (value: string) => {
    setHealthStatus(value);
    setPage(1);
  };

  const toggleSelect = (brandId: string) => {
    setSelectedIds((prev) =>
      prev.includes(brandId)
        ? prev.filter((id) => id !== brandId)
        : [...prev, brandId],
    );
  };

  const toggleSelectAll = () => {
    if (!data?.items.length) return;
    const allIds = data.items.map((item) => item.brandId);
    const allSelected = allIds.every((id) => selectedIds.includes(id));
    if (allSelected) {
      setSelectedIds((prev) =>
        prev.filter((id) => !allIds.includes(id)),
      );
    } else {
      setSelectedIds((prev) => [...new Set([...prev, ...allIds])]);
    }
  };

  const handleBatchRecharge = () => {
    if (selectedIds.length === 0) {
      toast.error('请先选择要充值的客户');
      return;
    }
    if (rechargeAmount <= 0) {
      toast.error('请输入充值数量');
      return;
    }
    batchRechargeMutation.mutate({
      brandIds: selectedIds,
      amount: rechargeAmount,
      remark: rechargeRemark || undefined,
    });
  };

  const handleExportCsv = () => {
    exportMonthlyBillCsv(billMonth);
  };

  const maxRankAmount = useMemo(() => {
    if (!rankData?.items?.length) return 0;
    return Math.max(...rankData.items.map((item) => item.amount));
  }, [rankData]);

  const renderPaginationItems = (
    currentPage: number,
    total: number,
    onChange: (p: number) => void,
  ) => {
    const items: React.ReactNode[] = [];
    const maxVisible = 5;
    let startPage = Math.max(1, currentPage - Math.floor(maxVisible / 2));
    const endPage = Math.min(total, startPage + maxVisible - 1);
    startPage = Math.max(1, endPage - maxVisible + 1);

    for (let i = startPage; i <= endPage; i++) {
      items.push(
        <PaginationItem key={i}>
          <PaginationLink
            href="#"
            isActive={i === currentPage}
            onClick={(e: React.MouseEvent) => {
              e.preventDefault();
              onChange(i);
            }}
          >
            {i}
          </PaginationLink>
        </PaginationItem>,
      );
    }
    return items;
  };

  const allSelected =
    data?.items?.length > 0 &&
    data.items.every((item) => selectedIds.includes(item.brandId));

  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <PageHeader
        title="算力总览"
        subtitle="查看所有客户算力余额、消耗与充值情况"
      />

      {/* 顶部指标卡 */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <Card
              key={i}
              style={{
                borderRadius: '12px',
                border: '1px solid #E5E9F2',
                boxShadow: 'none',
              }}
            >
              <CardContent className="pt-6">
                <Skeleton className="mb-3 h-4 w-20" />
                <Skeleton className="h-8 w-28" />
              </CardContent>
            </Card>
          ))
        ) : (
          <>
            <StatCard
              label="全部客户算力余额合计"
              value={(data?.stats?.totalBalance ?? 0).toLocaleString('zh-CN')}
              unit="算力"
            />
            <StatCard
              label="本月消耗合计"
              value={(data?.stats?.monthlyConsumed ?? 0).toLocaleString('zh-CN')}
              unit="算力"
            />
            <StatCard
              label="本月充值合计"
              value={(data?.stats?.monthlyRecharged ?? 0).toLocaleString('zh-CN')}
              unit="算力"
            />
          </>
        )}
      </div>

      {isError && (
        <div className="flex items-center justify-between rounded-lg border border-red-200 bg-red-50 p-4">
          <div
            className="flex items-center gap-2 text-sm"
            style={{ color: DANGER }}
          >
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

      <div className="space-y-6">
        {/* 筛选 + 表格区 */}
        <div className="space-y-6">
          {/* 筛选 + 批量操作栏 */}
          <Card
            style={{
              borderRadius: '12px',
              border: '1px solid #E5E9F2',
              boxShadow: 'none',
            }}
          >
            <CardContent className="pt-6">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:items-center">
                  <div className="relative flex-1 sm:max-w-xs">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      placeholder="搜索品牌/企业名"
                      value={keywordInput}
                      onChange={(e) => setKeywordInput(e.target.value)}
                      onKeyDown={handleKeyDown}
                      className="pl-9"
                    />
                  </div>
                  <Select
                    value={healthStatus}
                    onValueChange={handleStatusChange}
                  >
                    <SelectTrigger className="w-full sm:w-[140px]">
                      <SelectValue placeholder="健康状态" />
                    </SelectTrigger>
                    <SelectContent>
                      {HEALTH_STATUS_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-2">
                  {isAdmin && (
                    <>
                      <Button
                        variant="outline"
                        onClick={() => setBatchRechargeOpen(true)}
                        disabled={selectedIds.length === 0}
                        style={{
                          borderColor: '#E5E9F2',
                          color:
                            selectedIds.length > 0 ? PRIMARY : MUTED,
                        }}
                      >
                        <Zap className="h-4 w-4" />
                        批量充值（{selectedIds.length}）
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 算力表格 */}
          <Card
            style={{
              borderRadius: '12px',
              border: '1px solid #E5E9F2',
              boxShadow: 'none',
            }}
          >
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="font-semibold">
                客户算力
                {data && (
                  <span className="ml-2 text-xs font-normal text-muted-foreground">
                    共 {data.total} 个客户
                  </span>
                )}
              </CardTitle>
              <button
                type="button"
                onClick={resetCustomersAll}
                className="text-[12px] transition-colors hover:underline"
                style={{ color: '#64748b' }}
              >
                重置列宽
              </button>
            </CardHeader>
            <CardContent>
              {isLoading && <TableSkeleton />}

              {!isLoading && data && data.items.length === 0 && (
                <Empty className="min-h-[200px] py-8">
                  <EmptyHeader>
                    <EmptyMedia variant="icon">
                      <Zap />
                    </EmptyMedia>
                    <EmptyTitle>暂无数据</EmptyTitle>
                  </EmptyHeader>
                </Empty>
              )}

              {!isLoading && data && data.items.length > 0 && (
                <div className="overflow-x-auto">
                  <Table className="table-fixed" style={getCustomersTableStyle()}>
                    <TableHeader style={{ backgroundColor: '#F7F9FC' }}>
                      <TableRow>
                        <TableHead data-col="select" className="w-10" style={getCustomersThStyle('select')}>
                          <Checkbox
                            checked={allSelected}
                            onCheckedChange={toggleSelectAll}
                            aria-label="全选"
                          />
                          <ColumnResizeHandle
                            onResizeStart={(e) => handleCustomersResizeStart('select', e)}
                            onDoubleClick={() => resetCustomersColumn('select')}
                            isResizing={isCustomersResizing}
                          />
                        </TableHead>
                        <TableHead data-col="brand" style={{ ...getCustomersThStyle('brand'), whiteSpace: 'normal' }}>
                          客户/品牌
                          <ColumnResizeHandle
                            onResizeStart={(e) => handleCustomersResizeStart('brand', e)}
                            onDoubleClick={() => resetCustomersColumn('brand')}
                            isResizing={isCustomersResizing}
                          />
                        </TableHead>
                        <TableHead data-col="company" style={{ ...getCustomersThStyle('company'), whiteSpace: 'normal' }}>
                          企业名
                          <ColumnResizeHandle
                            onResizeStart={(e) => handleCustomersResizeStart('company', e)}
                            onDoubleClick={() => resetCustomersColumn('company')}
                            isResizing={isCustomersResizing}
                          />
                        </TableHead>
                        <TableHead data-col="plan" style={{ ...getCustomersThStyle('plan'), whiteSpace: 'normal' }}>
                          套餐
                          <ColumnResizeHandle
                            onResizeStart={(e) => handleCustomersResizeStart('plan', e)}
                            onDoubleClick={() => resetCustomersColumn('plan')}
                            isResizing={isCustomersResizing}
                          />
                        </TableHead>
                        <TableHead data-col="balance" className="text-right" style={{ ...getCustomersThStyle('balance'), whiteSpace: 'normal' }}>
                          余额
                          <ColumnResizeHandle
                            onResizeStart={(e) => handleCustomersResizeStart('balance', e)}
                            onDoubleClick={() => resetCustomersColumn('balance')}
                            isResizing={isCustomersResizing}
                          />
                        </TableHead>
                        <TableHead data-col="monthlyConsumed" className="text-right" style={{ ...getCustomersThStyle('monthlyConsumed'), whiteSpace: 'normal' }}>
                          本月消耗
                          <ColumnResizeHandle
                            onResizeStart={(e) => handleCustomersResizeStart('monthlyConsumed', e)}
                            onDoubleClick={() => resetCustomersColumn('monthlyConsumed')}
                            isResizing={isCustomersResizing}
                          />
                        </TableHead>
                        <TableHead data-col="monthlyRecharged" className="text-right" style={{ ...getCustomersThStyle('monthlyRecharged'), whiteSpace: 'normal' }}>
                          本月充值
                          <ColumnResizeHandle
                            onResizeStart={(e) => handleCustomersResizeStart('monthlyRecharged', e)}
                            onDoubleClick={() => resetCustomersColumn('monthlyRecharged')}
                            isResizing={isCustomersResizing}
                          />
                        </TableHead>
                        <TableHead data-col="lastConsumedAt" style={{ ...getCustomersThStyle('lastConsumedAt'), whiteSpace: 'normal' }}>
                          最近消耗时间
                          <ColumnResizeHandle
                            onResizeStart={(e) => handleCustomersResizeStart('lastConsumedAt', e)}
                            onDoubleClick={() => resetCustomersColumn('lastConsumedAt')}
                            isResizing={isCustomersResizing}
                          />
                        </TableHead>
                        <TableHead data-col="status" style={{ ...getCustomersThStyle('status'), whiteSpace: 'normal' }}>
                          状态
                          <ColumnResizeHandle
                            onResizeStart={(e) => handleCustomersResizeStart('status', e)}
                            onDoubleClick={() => resetCustomersColumn('status')}
                            isResizing={isCustomersResizing}
                          />
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.items.map((item: CreditBrandRow) => (
                        <TableRow key={item.brandId}>
                          <TableCell style={getCustomersTdStyle('select')}>
                            <Checkbox
                              checked={selectedIds.includes(item.brandId)}
                              onCheckedChange={() => toggleSelect(item.brandId)}
                              aria-label={`选择 ${item.brandName}`}
                            />
                          </TableCell>
                          <TableCell className="font-medium text-slate-800" style={getCustomersTdStyle('brand')}>
                            {item.brandName}
                          </TableCell>
                          <TableCell className="text-slate-600" style={getCustomersTdStyle('company')}>
                          </TableCell>
                          <TableCell className="text-slate-600" style={getCustomersTdStyle('plan')}>
                            {item.planName || '-'}
                          </TableCell>
                          <TableCell
                            className="text-right tnum font-medium"
                            style={{ ...getCustomersTdStyle('balance'), color: PRIMARY }}
                          >
                            ¥{item.balance.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </TableCell>
                          <TableCell className="text-right tnum text-slate-600" style={getCustomersTdStyle('monthlyConsumed')}>
                            ¥{item.monthlyConsumed.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </TableCell>
                          <TableCell className="text-right tnum text-slate-600" style={getCustomersTdStyle('monthlyRecharged')}>
                            ¥{item.monthlyRecharged.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </TableCell>
                          <TableCell className="text-slate-600" style={getCustomersTdStyle('lastConsumedAt')}>
                            {formatDate(item.lastConsumedAt)}
                          </TableCell>
                          <TableCell style={getCustomersTdStyle('status')}>
                            <Pill
                              variant={
                                item.healthStatus === 'sufficient'
                                  ? 'success'
                                  : item.healthStatus === 'low'
                                    ? 'warning'
                                    : item.healthStatus === 'critical'
                                      ? 'danger'
                                      : 'muted'
                              }
                            >
                              {HEALTH_STATUS_LABELS[item.healthStatus]}
                            </Pill>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}

              {!isLoading && data && data.items.length > 0 && totalPages > 1 && (
                <div className="mt-4">
                  <Pagination>
                    <PaginationContent>
                      <PaginationItem>
                        <PaginationPrevious
                          href="#"
                          onClick={(e: React.MouseEvent) => {
                            e.preventDefault();
                            if (page > 1) setPage(page - 1);
                          }}
                          aria-disabled={page <= 1}
                          className={
                            page <= 1
                              ? 'pointer-events-none opacity-50'
                              : ''
                          }
                        />
                      </PaginationItem>
                      {renderPaginationItems(page, totalPages, setPage)}
                      <PaginationItem>
                        <PaginationNext
                          href="#"
                          onClick={(e: React.MouseEvent) => {
                            e.preventDefault();
                            if (page < totalPages) setPage(page + 1);
                          }}
                          aria-disabled={page >= totalPages}
                          className={
                            page >= totalPages
                              ? 'pointer-events-none opacity-50'
                              : ''
                          }
                        />
                      </PaginationItem>
                    </PaginationContent>
                  </Pagination>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* 消耗排行 */}
        <div>
          <Card
            style={{
              borderRadius: '12px',
              border: '1px solid #E5E9F2',
              boxShadow: 'none',
            }}
          >
            <CardHeader className="pb-2">
              <CardTitle className="font-semibold flex items-center gap-2">
                <ArrowUpRight className="h-4 w-4" style={{ color: PRIMARY }} />
                本月消耗排行榜
              </CardTitle>
            </CardHeader>
            <CardContent>
              {rankLoading ? (
                <div className="space-y-3">
                  {Array.from({ length: 10 }).map((_, i) => (
                    <div key={i} className="space-y-1">
                      <div className="flex justify-between">
                        <Skeleton className="h-3 w-20" />
                        <Skeleton className="h-3 w-12" />
                      </div>
                      <Skeleton className="h-2 w-full" />
                    </div>
                  ))}
                </div>
              ) : rankData?.items?.length ? (
                <div className="space-y-3">
                  {rankData.items.map(
                    (item: ConsumptionRankItem, idx: number) => {
                      const pct =
                        maxRankAmount > 0
                          ? (item.amount / maxRankAmount) * 100
                          : 0;
                      const colors = [
                        PRIMARY,
                        '#6366F1',
                        '#8B5CF6',
                        '#A855F7',
                        '#D946EF',
                      ];
                      const barColor =
                        idx < colors.length ? colors[idx] : '#94A3B8';
                      return (
                        <div key={item.brandId} className="space-y-1">
                          <div className="flex items-center justify-between text-xs">
                            <div className="flex items-center gap-2">
                              <span
                                className="flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-medium text-white"
                                style={{
                                  backgroundColor:
                                    idx < 3 ? barColor : '#CBD5E1',
                                }}
                              >
                                {idx + 1}
                              </span>
                              <span className="truncate text-slate-700">
                                {item.brandName}
                              </span>
                            </div>
                            <span className="tnum font-medium text-slate-600">
                              {item.amount.toLocaleString('zh-CN')}
                            </span>
                          </div>
                          <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                            <div
                              className="h-full rounded-full transition-all"
                              style={{
                                width: `${pct}%`,
                                backgroundColor: barColor,
                              }}
                            />
                          </div>
                        </div>
                      );
                    },
                  )}
                </div>
              ) : (
                <div className="py-8 text-center text-sm text-slate-400">
                  暂无消耗数据
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* 月度账单区 */}
      <Card
        style={{
          borderRadius: '12px',
          border: '1px solid #E5E9F2',
          boxShadow: 'none',
        }}
      >
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <div className="flex items-center gap-3">
            <CardTitle className="font-semibold">
              月度账单
            </CardTitle>
            <Input
              type="month"
              value={billMonth}
              onChange={(e) => {
                setBillMonth(e.target.value);
                setBillPage(1);
              }}
              className="w-40"
            />
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportCsv}
              style={{ borderColor: '#E5E9F2', color: '#64748b' }}
            >
              <Download className="h-3.5 w-3.5" />
              导出 CSV
            </Button>
            <button
              type="button"
              onClick={resetBillsAll}
              className="text-[12px] transition-colors hover:underline"
              style={{ color: '#64748b' }}
            >
              重置列宽
            </button>
          </div>
        </CardHeader>
        <CardContent>
          {billLoading ? (
            <TableSkeleton />
          ) : billData && billData.items.length > 0 ? (
            <div className="overflow-x-auto">
              <Table className="table-fixed" style={getBillsTableStyle()}>
                <TableHeader style={{ backgroundColor: '#F7F9FC' }}>
                  <TableRow>
                    <TableHead data-col="customer" style={getBillsThStyle('customer')}>
                      客户
                      <ColumnResizeHandle
                        onResizeStart={(e) => handleBillsResizeStart('customer', e)}
                        onDoubleClick={() => resetBillsColumn('customer')}
                        isResizing={isBillsResizing}
                      />
                    </TableHead>
                    <TableHead data-col="openingBalance" className="text-right" style={getBillsThStyle('openingBalance')}>
                      期初余额
                      <ColumnResizeHandle
                        onResizeStart={(e) => handleBillsResizeStart('openingBalance', e)}
                        onDoubleClick={() => resetBillsColumn('openingBalance')}
                        isResizing={isBillsResizing}
                      />
                    </TableHead>
                    <TableHead data-col="monthlyConsumed" className="text-right" style={getBillsThStyle('monthlyConsumed')}>
                      本月消耗
                      <ColumnResizeHandle
                        onResizeStart={(e) => handleBillsResizeStart('monthlyConsumed', e)}
                        onDoubleClick={() => resetBillsColumn('monthlyConsumed')}
                        isResizing={isBillsResizing}
                      />
                    </TableHead>
                    <TableHead data-col="monthlyRecharged" className="text-right" style={getBillsThStyle('monthlyRecharged')}>
                      本月充值
                      <ColumnResizeHandle
                        onResizeStart={(e) => handleBillsResizeStart('monthlyRecharged', e)}
                        onDoubleClick={() => resetBillsColumn('monthlyRecharged')}
                        isResizing={isBillsResizing}
                      />
                    </TableHead>
                    <TableHead data-col="closingBalance" className="text-right" style={getBillsThStyle('closingBalance')}>
                      期末余额
                      <ColumnResizeHandle
                        onResizeStart={(e) => handleBillsResizeStart('closingBalance', e)}
                        onDoubleClick={() => resetBillsColumn('closingBalance')}
                        isResizing={isBillsResizing}
                      />
                    </TableHead>
                    {billData.hasUnitPrice && (
                      <TableHead data-col="consumedAmount" className="text-right" style={getBillsThStyle('consumedAmount')}>
                        消耗金额(元)
                        <ColumnResizeHandle
                          onResizeStart={(e) => handleBillsResizeStart('consumedAmount', e)}
                          onDoubleClick={() => resetBillsColumn('consumedAmount')}
                          isResizing={isBillsResizing}
                        />
                      </TableHead>
                    )}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {billData.items.map((row: MonthlyBillRow) => (
                    <TableRow key={row.brandId}>
                      <TableCell className="font-medium text-slate-800" style={getBillsTdStyle('customer')}>
                        {row.brandName}
                      </TableCell>
                      <TableCell className="text-right tnum" style={getBillsTdStyle('openingBalance')}>
                        ¥{row.openingBalance.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell className="text-right tnum" style={{ ...getBillsTdStyle('monthlyConsumed'), color: WARNING }}>
                        ¥{row.monthlyConsumed.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell className="text-right tnum" style={{ ...getBillsTdStyle('monthlyRecharged'), color: SUCCESS }}>
                        ¥{row.monthlyRecharged.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell
                        className="text-right tnum font-medium"
                        style={{ ...getBillsTdStyle('closingBalance'), color: PRIMARY }}
                      >
                        ¥{row.closingBalance.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </TableCell>
                      {billData.hasUnitPrice && (
                        <TableCell className="text-right tnum text-slate-600" style={getBillsTdStyle('consumedAmount')}>
                          {row.amountYuan !== undefined
                            ? `¥${row.amountYuan.toFixed(2)}`
                            : '-'}
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                  {/* 合计行 */}
                  <TableRow style={{ backgroundColor: '#F7F9FC', fontWeight: 600 }}>
                    <TableCell style={getBillsTdStyle('customer')}>合计</TableCell>
                    <TableCell className="text-right tnum" style={getBillsTdStyle('openingBalance')}>
                      ¥{billData.totalOpening.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell className="text-right tnum" style={{ ...getBillsTdStyle('monthlyConsumed'), color: WARNING }}>
                      ¥{billData.totalConsumed.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell className="text-right tnum" style={{ ...getBillsTdStyle('monthlyRecharged'), color: SUCCESS }}>
                      ¥{billData.totalRecharged.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell className="text-right tnum" style={{ ...getBillsTdStyle('closingBalance'), color: PRIMARY }}>
                      ¥{billData.totalClosing.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </TableCell>
                    {billData.hasUnitPrice && (
                      <TableCell className="text-right tnum text-slate-700" style={getBillsTdStyle('consumedAmount')}>
                        {billData.totalAmountYuan !== undefined
                          ? `¥${billData.totalAmountYuan.toFixed(2)}`
                          : '-'}
                      </TableCell>
                    )}
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          ) : (
            <Empty className="min-h-[200px] py-8">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <FileText />
                </EmptyMedia>
                <EmptyTitle>暂无账单数据</EmptyTitle>
              </EmptyHeader>
            </Empty>
          )}

          {!billLoading && billData && billData.items.length > 0 && billTotalPages > 1 && (
            <div className="mt-4">
              <Pagination>
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious
                      href="#"
                      onClick={(e: React.MouseEvent) => {
                        e.preventDefault();
                        if (billPage > 1) setBillPage(billPage - 1);
                      }}
                      aria-disabled={billPage <= 1}
                      className={
                        billPage <= 1
                          ? 'pointer-events-none opacity-50'
                          : ''
                      }
                    />
                  </PaginationItem>
                  {renderPaginationItems(billPage, billTotalPages, setBillPage)}
                  <PaginationItem>
                    <PaginationNext
                      href="#"
                      onClick={(e: React.MouseEvent) => {
                        e.preventDefault();
                        if (billPage < billTotalPages)
                          setBillPage(billPage + 1);
                      }}
                      aria-disabled={billPage >= billTotalPages}
                      className={
                        billPage >= billTotalPages
                          ? 'pointer-events-none opacity-50'
                          : ''
                      }
                    />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 批量充值弹窗 */}
      <Dialog open={batchRechargeOpen} onOpenChange={setBatchRechargeOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>批量充值</DialogTitle>
            <DialogDescription>
              已选择 {selectedIds.length} 个客户
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="rounded-md bg-blue-50 p-3">
              <div className="flex items-start gap-2">
                <CheckCircle2
                  className="mt-0.5 h-4 w-4 shrink-0"
                  style={{ color: PRIMARY }}
                />
                <div className="text-xs" style={{ color: PRIMARY }}>
                  将向选中的 {selectedIds.length} 个客户同时充值相同数量的算力
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label>
                充值数量（算力）<span className="text-red-500">*</span>
              </Label>
              <Input
                type="number"
                min="1"
                value={rechargeAmount}
                onChange={(e) =>
                  setRechargeAmount(Number(e.target.value) || 0)
                }
                placeholder="请输入充值算力数量"
              />
            </div>

            <div className="space-y-2">
              <Label>备注</Label>
              <Textarea
                value={rechargeRemark}
                onChange={(e) => setRechargeRemark(e.target.value)}
                placeholder="请输入备注信息（选填）"
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setBatchRechargeOpen(false)}
              disabled={batchRechargeMutation.isPending}
            >
              取消
            </Button>
            <Button
              onClick={handleBatchRecharge}
              disabled={
                batchRechargeMutation.isPending || rechargeAmount <= 0
              }
              style={{ backgroundColor: PRIMARY }}
            >
              {batchRechargeMutation.isPending ? '充值中...' : '确认充值'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

const TableSkeleton = () => (
  <div className="space-y-2 py-2">
    {Array.from({ length: 6 }).map((_, i) => (
      <div key={i} className="flex items-center gap-4 py-2">
        <Skeleton className="h-4 w-4" />
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-4 w-20" />
        <Skeleton className="ml-auto h-4 w-20" />
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-6 w-16" />
      </div>
    ))}
  </div>
);

export default CreditOverviewPage;
