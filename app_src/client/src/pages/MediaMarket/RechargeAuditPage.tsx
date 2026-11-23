import React, { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getBrands } from '@client/src/api/brands';
import {
  useRechargeStats,
  useRechargeApplications,
  useApproveRecharge,
  useRejectRecharge,
} from '@client/src/api/media-wallet';
import type {
  RechargeApplication,
  RechargeStatus,
} from '@shared/api.interface';
import { RECHARGE_STATUS_LABELS } from '@shared/api.interface';
import { formatMoneyCents } from '@client/src/utils/format';
import { Button } from '@client/src/components/ui/button';
import { Input } from '@client/src/components/ui/input';
import { Textarea } from '@client/src/components/ui/textarea';
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
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@client/src/components/ui/dialog';

const PAGE_SIZE = 20;

function formatDateTime(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    d.getFullYear() +
    '-' +
    pad(d.getMonth() + 1) +
    '-' +
    pad(d.getDate()) +
    ' ' +
    pad(d.getHours()) +
    ':' +
    pad(d.getMinutes())
  );
}

function getBadgeVariant(status: RechargeStatus): 'default' | 'secondary' | 'destructive' {
  switch (status) {
    case 'approved':
      return 'default';
    case 'rejected':
      return 'destructive';
    default:
      return 'secondary';
  }
}

const RechargeAuditPage: React.FC = () => {
  const queryClient = useQueryClient();
  const { data: brands = [] } = useQuery({
    queryKey: ['brands', 'options'],
    queryFn: () => getBrands(),
  });

  // 筛选状态
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [brandFilter, setBrandFilter] = useState<string>('');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [page, setPage] = useState<number>(1);

  const [appliedFilters, setAppliedFilters] = useState<{
    status: string;
    brandId: string;
    startDate: string;
    endDate: string;
  }>({
    status: '',
    brandId: '',
    startDate: '',
    endDate: '',
  });

  // KPI 统计
  const { data: stats, isLoading: statsLoading } = useRechargeStats();

  // 列表查询参数
  const listParams = useMemo(() => {
    const params: {
      brandId?: string;
      status?: RechargeStatus;
      page: number;
      pageSize: number;
      startDate?: string;
      endDate?: string;
    } = {
      page,
      pageSize: PAGE_SIZE,
    };
    if (appliedFilters.brandId) params.brandId = appliedFilters.brandId;
    if (appliedFilters.status) {
      params.status = appliedFilters.status as RechargeStatus;
    }
    if (appliedFilters.startDate) params.startDate = appliedFilters.startDate;
    if (appliedFilters.endDate) params.endDate = appliedFilters.endDate;
    return params;
  }, [page, appliedFilters]);

  const { data: listData, isLoading: listLoading } =
    useRechargeApplications(listParams);

  const handleSearch = () => {
    setAppliedFilters({
      status: statusFilter,
      brandId: brandFilter,
      startDate,
      endDate,
    });
    setPage(1);
  };

  // 弹窗状态
  const [approveDialogOpen, setApproveDialogOpen] = useState(false);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [currentItem, setCurrentItem] = useState<RechargeApplication | null>(
    null,
  );
  const [actualAmount, setActualAmount] = useState<string>('');
  const [rejectReason, setRejectReason] = useState<string>('');

  const openApproveDialog = (item: RechargeApplication) => {
    setCurrentItem(item);
    const applyAmountYuan = (item.applyAmountCents / 100).toFixed(2);
    setActualAmount(applyAmountYuan);
    setApproveDialogOpen(true);
  };

  const openRejectDialog = (item: RechargeApplication) => {
    setCurrentItem(item);
    setRejectReason('');
    setRejectDialogOpen(true);
  };

  const approveMutation = useApproveRecharge();
  const rejectMutation = useRejectRecharge();

  const handleApprove = () => {
    if (!currentItem) return;
    const amount = parseFloat(actualAmount);
    if (isNaN(amount) || amount <= 0) return;
    const maxAmount = currentItem.applyAmountCents / 100;
    if (amount > maxAmount) return;
    approveMutation.mutate(
      { id: currentItem.id, actualAmountYuan: amount },
      {
        onSuccess: () => {
          setApproveDialogOpen(false);
          setCurrentItem(null);
          queryClient.invalidateQueries({
            queryKey: ['media-wallet', 'recharge-stats'],
          });
        },
      },
    );
  };

  const handleReject = () => {
    if (!currentItem) return;
    if (!rejectReason.trim()) return;
    rejectMutation.mutate(
      { id: currentItem.id, rejectReason: rejectReason.trim() },
      {
        onSuccess: () => {
          setRejectDialogOpen(false);
          setCurrentItem(null);
          queryClient.invalidateQueries({
            queryKey: ['media-wallet', 'recharge-stats'],
          });
        },
      },
    );
  };

  const totalPages = listData
    ? Math.max(1, Math.ceil(listData.total / PAGE_SIZE))
    : 1;
  const items = listData?.items ?? [];

  // 渲染页码按钮
  const renderPageNumbers = () => {
    const pages: (number | 'ellipsis')[] = [];
    const current = page;
    const total = totalPages;

    if (total <= 7) {
      for (let i = 1; i <= total; i++) pages.push(i);
    } else if (current <= 4) {
      pages.push(1, 2, 3, 4, 5, 'ellipsis', total);
    } else if (current >= total - 3) {
      pages.push(1, 'ellipsis', total - 4, total - 3, total - 2, total - 1, total);
    } else {
      pages.push(1, 'ellipsis', current - 1, current, current + 1, 'ellipsis', total);
    }

    return pages.map((p, idx) =>
      p === 'ellipsis' ? (
        <PaginationItem key={`ellipsis-${idx}`}>
          <span className="flex h-9 w-9 items-center justify-center text-[#64748b]">
            ...
          </span>
        </PaginationItem>
      ) : (
        <PaginationItem key={p}>
          <PaginationLink
            href="#"
            isActive={p === current}
            onClick={(e: React.MouseEvent) => {
              e.preventDefault();
              setPage(p);
            }}
          >
            {p}
          </PaginationLink>
        </PaginationItem>
      ),
    );
  };

  const applyAmountYuanDisplay = currentItem
    ? formatMoneyCents(currentItem.applyAmountCents)
    : '';

  const actualAmountNum = parseFloat(actualAmount);
  const maxAmountNum = currentItem ? currentItem.applyAmountCents / 100 : 0;
  const actualAmountInvalid =
    isNaN(actualAmountNum) || actualAmountNum <= 0 || actualAmountNum > maxAmountNum;

  const isDemoRemark = (remark?: string): boolean => {
    if (!remark) return false;
    return /演示|测试/.test(remark);
  };

  return (
    <div className="space-y-4">
      {/* KPI 卡片 */}
      <div className="grid grid-cols-3 gap-4">
        <div
          className="rounded-xl border bg-white p-5"
          style={{ borderColor: '#E5E9F2', borderRadius: '12px', padding: '20px' }}
        >
          <div className="text-xs" style={{ color: '#64748b' }}>
            待审核笔数
          </div>
          <div
            className="mt-2 text-[24px] font-semibold"
            style={{ color: '#0f172a' }}
          >
            {statsLoading ? (
              <Skeleton className="h-7 w-24" />
            ) : (
              <>
                {stats?.pendingCount ?? 0}
                <span className="ml-1 text-[14px] font-normal text-[#64748b]">
                  笔
                </span>
              </>
            )}
          </div>
        </div>

        <div
          className="rounded-xl border bg-white p-5"
          style={{ borderColor: '#E5E9F2', borderRadius: '12px', padding: '20px' }}
        >
          <div className="text-xs" style={{ color: '#64748b' }}>
            待审金额合计
          </div>
          <div
            className="mt-2 text-[24px] font-semibold"
            style={{ color: '#00C2FF', fontVariantNumeric: 'tabular-nums' }}
          >
            {statsLoading ? (
              <Skeleton className="h-7 w-36" />
            ) : (
              formatMoneyCents(stats?.pendingAmountCents ?? 0)
            )}
          </div>
        </div>

        <div
          className="rounded-xl border bg-white p-5"
          style={{ borderColor: '#E5E9F2', borderRadius: '12px', padding: '20px' }}
        >
          <div className="text-xs" style={{ color: '#64748b' }}>
            本月已入账合计
          </div>
          <div
            className="mt-2 text-[24px] font-semibold"
            style={{ color: '#00C2FF', fontVariantNumeric: 'tabular-nums' }}
          >
            {statsLoading ? (
              <Skeleton className="h-7 w-36" />
            ) : (
              formatMoneyCents(stats?.monthApprovedAmountCents ?? 0)
            )}
          </div>
        </div>
      </div>

      {/* 筛选栏 */}
      <div
        className="rounded-xl border bg-white p-4"
        style={{ borderColor: '#E5E9F2', borderRadius: '12px' }}
      >
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-sm text-[#64748b]">状态</span>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="全部" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">全部</SelectItem>
                <SelectItem value="pending">待审核</SelectItem>
                <SelectItem value="approved">已入账</SelectItem>
                <SelectItem value="rejected">已驳回</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-sm text-[#64748b]">品牌</span>
            <Select value={brandFilter} onValueChange={setBrandFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="全部品牌" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">全部品牌</SelectItem>
                {brands.map((b) => (
                  <SelectItem key={b.id} value={b.id}>
                    {b.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-sm text-[#64748b]">时间</span>
            <Input
              type="date"
              value={startDate}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setStartDate(e.target.value)
              }
              className="w-[160px]"
            />
            <span className="text-sm text-[#64748b]">至</span>
            <Input
              type="date"
              value={endDate}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setEndDate(e.target.value)
              }
              className="w-[160px]"
            />
          </div>

          <Button onClick={handleSearch}>查询</Button>
        </div>
      </div>

      {/* 表格 */}
      <div
        className="rounded-xl border bg-white"
        style={{ borderColor: '#E5E9F2', borderRadius: '12px' }}
      >
        <div className="overflow-x-auto">
          <Table>
            <TableHeader style={{ backgroundColor: '#F7F9FC' }}>
              <TableRow style={{ height: '44px' }}>
                <TableHead className="w-[140px]">申请单号</TableHead>
                <TableHead>客户品牌</TableHead>
                <TableHead className="text-right w-[160px]">申请金额</TableHead>
                <TableHead className="text-right w-[160px]">实际到账</TableHead>
                <TableHead className="w-[100px]">状态</TableHead>
                <TableHead className="w-[160px]">申请时间</TableHead>
                <TableHead className="w-[100px]">审核人</TableHead>
                <TableHead className="text-right w-[200px]">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {listLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i} style={{ height: '44px' }}>
                    <TableCell colSpan={8}>
                      <Skeleton className="h-5 w-full" />
                    </TableCell>
                  </TableRow>
                ))
              ) : items.length === 0 ? (
                <TableRow style={{ height: '120px' }}>
                  <TableCell
                    colSpan={8}
                    className="text-center text-[#64748b]"
                  >
                    暂无数据
                  </TableCell>
                </TableRow>
              ) : (
                items.map((item: RechargeApplication) => (
                  <TableRow key={item.id} style={{ height: '44px' }}>
                    <TableCell className="font-mono">
                      {item.id.slice(0, 8)}...
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {isDemoRemark(item.remark) && (
                          <span
                            className="text-[11px] px-1.5 py-0.5 rounded"
                            style={{ backgroundColor: '#F1F5F9', color: '#64748b' }}
                          >
                            演示
                          </span>
                        )}
                        <span>{item.brandName ?? '—'}</span>
                      </div>
                    </TableCell>
                    <TableCell
                      className="text-right"
                      style={{ fontVariantNumeric: 'tabular-nums' }}
                    >
                      {formatMoneyCents(item.applyAmountCents)}
                    </TableCell>
                    <TableCell
                      className="text-right"
                      style={{ fontVariantNumeric: 'tabular-nums' }}
                    >
                      {item.actualAmountCents !== undefined &&
                      item.actualAmountCents !== null
                        ? formatMoneyCents(item.actualAmountCents)
                        : '—'}
                    </TableCell>
                    <TableCell>
                      <Badge variant={getBadgeVariant(item.status)}
                        style={{
                          backgroundColor:
                            item.status === 'pending'
                              ? '#FFF7E6'
                              : item.status === 'approved'
                                ? '#E6FBEE'
                                : '#FFECEC',
                          color:
                            item.status === 'pending'
                              ? '#FFA940'
                              : item.status === 'approved'
                                ? '#17C964'
                                : '#FF5C5C',
                          border: 'none',
                        }}
                      >
                        {RECHARGE_STATUS_LABELS[item.status]}
                      </Badge>
                    </TableCell>
                    <TableCell>{formatDateTime(item.createdAt)}</TableCell>
                    <TableCell style={{ color: '#64748b' }}>—</TableCell>
                    <TableCell className="text-right">
                      {item.status === 'pending' && (
                        <>
                          <Button
                            size="sm"
                            className="mr-2 text-sm"
                            onClick={() => openApproveDialog(item)}
                          >
                            确认入账
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            className="text-sm"
                            onClick={() => openRejectDialog(item)}
                          >
                            驳回
                          </Button>
                        </>
                      )}
                      {item.status === 'approved' && (
                        <span className="text-xs text-[#64748b]">
                          已入账 · {item.auditedAt ? formatDateTime(item.auditedAt) : '—'}
                        </span>
                      )}
                      {item.status === 'rejected' && (
                        <span className="text-xs text-[#64748b]">
                          已驳回 · {item.auditedAt ? formatDateTime(item.auditedAt) : '—'}
                        </span>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* 分页 */}
        {!listLoading && items.length > 0 && (
          <div className="py-3">
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
                    className={page <= 1 ? 'pointer-events-none opacity-50' : ''}
                  />
                </PaginationItem>
                {renderPageNumbers()}
                <PaginationItem>
                  <PaginationNext
                    href="#"
                    onClick={(e: React.MouseEvent) => {
                      e.preventDefault();
                      if (page < totalPages) setPage(page + 1);
                    }}
                    aria-disabled={page >= totalPages}
                    className={page >= totalPages ? 'pointer-events-none opacity-50' : ''}
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          </div>
        )}
      </div>

      {/* 确认入账弹窗 */}
      <Dialog open={approveDialogOpen} onOpenChange={setApproveDialogOpen}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>确认入账</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex items-center justify-between text-sm">
              <span className="text-[#64748b]">品牌</span>
              <span className="font-medium text-[#0f172a]">
                {currentItem?.brandName ?? '—'}
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-[#64748b]">申请金额</span>
              <span
                className="font-semibold"
                style={{ color: '#00C2FF', fontVariantNumeric: 'tabular-nums' }}
              >
                {applyAmountYuanDisplay}
              </span>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-[#0f172a]">
                实际到账金额
              </label>
              <Input
                type="number"
                step="0.01"
                min="0.01"
                value={actualAmount}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setActualAmount(e.target.value)
                }
              />
              <p className="text-xs text-[#64748b]">
                实际到账金额可小于申请金额（部分到账）
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setApproveDialogOpen(false)}
            >
              取消
            </Button>
            <Button
              onClick={handleApprove}
              disabled={actualAmountInvalid || approveMutation.isPending}
            >
              {approveMutation.isPending ? '处理中...' : '确认入账'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 驳回弹窗 */}
      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>驳回申请</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex items-center justify-between text-sm">
              <span className="text-[#64748b]">品牌</span>
              <span className="font-medium text-[#0f172a]">
                {currentItem?.brandName ?? '—'}
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-[#64748b]">申请金额</span>
              <span
                className="font-semibold"
                style={{ color: '#00C2FF', fontVariantNumeric: 'tabular-nums' }}
              >
                {applyAmountYuanDisplay}
              </span>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-[#0f172a]">
                驳回原因 <span className="text-[#FF5C5C]">*</span>
              </label>
              <Textarea
                rows={4}
                placeholder="请输入驳回原因"
                value={rejectReason}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                  setRejectReason(e.target.value)
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setRejectDialogOpen(false)}
            >
              取消
            </Button>
            <Button
              variant="destructive"
              onClick={handleReject}
              disabled={!rejectReason.trim() || rejectMutation.isPending}
            >
              {rejectMutation.isPending ? '处理中...' : '确认驳回'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default RechargeAuditPage;
