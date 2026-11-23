import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  Clock,
  ChevronRight,
  CheckCircle2,
  XCircle,
  Send,
  ExternalLink,
} from 'lucide-react';
import { Badge } from '@client/src/components/ui/badge';
import { Button } from '@client/src/components/ui/button';
import { Input } from '@client/src/components/ui/input';
import { Skeleton } from '@client/src/components/ui/skeleton';
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
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationPrevious,
  PaginationNext,
} from '@client/src/components/ui/pagination';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
  DrawerClose,
} from '@client/src/components/ui/drawer';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@client/src/components/ui/dialog';
import { Textarea } from '@client/src/components/ui/textarea';
import { PageHeader } from '@client/src/components/layout/PageHeader';
import {
  useAdminOrders,
  useAcceptOrder,
  useSubmitSupplierOrder,
  usePublishOrder,
  useRejectRefundOrder,
  type AdminOrderQuery,
} from '@client/src/api/media-orders';
import {
  MEDIA_ORDER_STATUS,
  MEDIA_ORDER_STATUS_LABELS,
} from '@shared/api.interface';
import type { MediaOrderAdmin, MediaOrderStatus } from '@shared/api.interface';
import { formatMoneyCentsRaw, formatMoneyCents } from '@client/src/utils/format';
import { UniversalLink } from '@lark-apaas/client-toolkit/components/UniversalLink';

const PAGE_SIZE = 20;

const STATUS_COLORS: Record<MediaOrderStatus, string> = {
  pending_payment: 'bg-slate-100 text-slate-600 border-none',
  paid: 'bg-[#F59E0B]/10 text-[#F59E0B] border-none',
  placing: 'bg-[#2563EB]/10 text-[#2563EB] border-none',
  published: 'bg-[#16A34A]/10 text-[#16A34A] border-none',
  failed: 'bg-[#DC2626]/10 text-[#DC2626] border-none',
  refunded: 'bg-slate-100 text-slate-500 border-none',
};

const OrdersPage: React.FC = () => {
  const [status, setStatus] = useState<string>('');
  const navigate = useNavigate();
  const [keyword, setKeyword] = useState('');
  const [page, setPage] = useState(1);

  const [detailDrawerOpen, setDetailDrawerOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<MediaOrderAdmin | null>(null);

  // 操作弹窗
  const [actionType, setActionType] = useState<'supplier' | 'publish' | 'reject' | null>(null);
  const [actionValue, setActionValue] = useState('');

  const acceptOrder = useAcceptOrder();
  const submitSupplier = useSubmitSupplierOrder();
  const publishOrder = usePublishOrder();
  const rejectRefund = useRejectRefundOrder();

  const queryParams: AdminOrderQuery = useMemo(() => {
    const params: AdminOrderQuery = {
      page,
      pageSize: PAGE_SIZE,
    };
    if (status) params.status = status as MediaOrderStatus;
    if (keyword.trim()) params.keyword = keyword.trim();
    return params;
  }, [status, keyword, page]);

  const { data, isLoading } = useAdminOrders(queryParams);
  const totalPages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;

  const handleViewDetail = (order: MediaOrderAdmin) => {
    setSelectedOrder(order);
    setDetailDrawerOpen(true);
  };

  const handleAccept = (order: MediaOrderAdmin) => {
    acceptOrder.mutate(order.id);
  };

  const openActionDialog = (
    type: 'supplier' | 'publish' | 'reject',
    order: MediaOrderAdmin,
  ) => {
    setSelectedOrder(order);
    setActionType(type);
    setActionValue('');
  };

  const handleActionConfirm = () => {
    if (!selectedOrder || !actionType) return;

    if (actionType === 'supplier') {
      submitSupplier.mutate(
        { id: selectedOrder.id, supplierOrderNo: actionValue.trim() },
        { onSuccess: () => setActionType(null) },
      );
    } else if (actionType === 'publish') {
      publishOrder.mutate(
        { id: selectedOrder.id, publishedUrl: actionValue.trim() },
        { onSuccess: () => setActionType(null) },
      );
    } else if (actionType === 'reject') {
      rejectRefund.mutate(
        { id: selectedOrder.id, rejectReason: actionValue.trim() },
        { onSuccess: () => setActionType(null) },
      );
    }
  };

  const getActionButton = (order: MediaOrderAdmin) => {
    switch (order.status) {
      case 'paid':
        return (
          <Button
            size="sm"
            className="h-7 bg-[#2563EB] hover:bg-[#2563EB] text-[12px]"
            onClick={() => handleAccept(order)}
            disabled={acceptOrder.isPending}
          >
            接单
          </Button>
        );
      case 'placing':
        return (
          <div className="flex items-center justify-end gap-1.5">
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-[12px] text-[#F59E0B]"
              onClick={() => openActionDialog('supplier', order)}
            >
              提交供应商
            </Button>
            <Button
              size="sm"
              className="h-7 bg-[#16A34A] hover:bg-[#15803d] text-[12px]"
              onClick={() => openActionDialog('publish', order)}
            >
              标记发布
            </Button>
          </div>
        );
      case 'pending_payment':
      case 'failed':
        return (
          <Button
            size="sm"
            variant="ghost"
            className="h-7 text-[12px] text-[#DC2626]"
            onClick={() => openActionDialog('reject', order)}
          >
            驳回退款
          </Button>
        );
      default:
        return (
          <Button
            size="sm"
            variant="ghost"
            className="h-7 text-[12px] text-[#2563EB]"
            onClick={() => handleViewDetail(order)}
          >
            详情
          </Button>
        );
    }
  };

  return (
    <div>
      <PageHeader
        title="发稿订单"
        description="管理所有媒体发稿订单的状态流转"
      />

      {/* 筛选栏 */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Select value={status} onValueChange={(v) => { setStatus(v); setPage(1); }}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="全部状态" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">全部状态</SelectItem>
            {MEDIA_ORDER_STATUS.map((s) => (
              <SelectItem key={s} value={s}>
                {MEDIA_ORDER_STATUS_LABELS[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            placeholder="搜索订单号/客户/渠道"
            value={keyword}
            onChange={(e) => {
              setKeyword(e.target.value);
              setPage(1);
            }}
            className="pl-9 w-[260px]"
          />
        </div>

        <div className="ml-auto text-sm text-slate-500">
          共 <span className="tnum font-medium">{data?.total ?? 0}</span> 条订单
        </div>
      </div>

      {/* 订单表格 */}
      <div className="rounded-xl border border-[#E6EAF2] bg-white">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader style={{ backgroundColor: '#F7F9FC' }}>
              <TableRow className="h-11">
                <TableHead className="min-w-[160px] font-medium">订单号</TableHead>
                <TableHead className="min-w-[100px] font-medium">客户</TableHead>
                <TableHead className="min-w-[160px] font-medium">渠道</TableHead>
                <TableHead className="min-w-[120px] font-medium">供应商</TableHead>
                <TableHead className="min-w-[200px] font-medium">标题</TableHead>
                <TableHead className="min-w-[90px] text-right font-medium tnum">售价</TableHead>
                <TableHead className="min-w-[90px] text-right font-medium tnum">采购价</TableHead>
                <TableHead className="min-w-[90px] text-right font-medium tnum">毛利</TableHead>
                <TableHead className="min-w-[100px] font-medium">状态</TableHead>
                <TableHead className="min-w-[160px] font-medium">提交时间</TableHead>
                <TableHead className="min-w-[180px] text-right font-medium">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading
                ? Array.from({ length: 8 }).map((_, i) => (
                    <TableRow key={i} className="h-11">
                      {Array.from({ length: 11 }).map((_, j) => (
                        <TableCell key={j}>
                          <Skeleton className="h-4 w-20" />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                : !data?.items.length
                ? (
                  <TableRow>
                    <TableCell colSpan={11} className="py-12 text-center">
                      <div className="flex flex-col items-center gap-3 text-slate-400">
                        <span>暂无订单数据</span>
                        <Button
                          className="h-8 rounded-lg bg-[#2E7DFF] text-[12px] font-medium hover:bg-[#1E5FD6]"
                          onClick={() => navigate('?tab=market', { replace: true })}
                        >
                          去发稿
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                )
                : data.items.map((order) => (
                    <TableRow key={order.id} className="h-11">
                      <TableCell className="font-mono text-xs text-slate-600">
                        {order.orderNo}
                      </TableCell>
                      <TableCell className="text-slate-600">
                        {order.brandName || '-'}
                      </TableCell>
                      <TableCell className="text-slate-600">
                        {order.channelName || '-'}
                      </TableCell>
                      <TableCell className="text-slate-600">
                        {order.supplierName || '-'}
                      </TableCell>
                      <TableCell className="max-w-[240px] truncate text-slate-700">
                        {order.title}
                      </TableCell>
                      <TableCell className="text-right tnum font-medium" style={{ color: '#2563EB' }}>
                        {formatMoneyCentsRaw(order.priceCents)}
                      </TableCell>
                      <TableCell className="text-right tnum text-slate-600">
                        {formatMoneyCentsRaw(order.costPriceCents)}
                      </TableCell>
                      <TableCell
                        className={`text-right tnum font-medium ${
                          order.grossProfitCents >= 0 ? 'text-[#16A34A]' : 'text-[#DC2626]'
                        }`}
                      >
                        {order.grossProfitCents >= 0 ? '+' : ''}
                        {formatMoneyCentsRaw(order.grossProfitCents)}
                      </TableCell>
                      <TableCell>
                        <Badge className={STATUS_COLORS[order.status]}>
                          {MEDIA_ORDER_STATUS_LABELS[order.status]}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-slate-500 text-[13px]">
                        {order.createdAt}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-[12px] text-slate-500"
                            onClick={() => handleViewDetail(order)}
                          >
                            详情
                          </Button>
                          {getActionButton(order)}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
            </TableBody>
          </Table>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-[#E6EAF2] px-4 py-3">
            <div className="text-sm text-slate-500">
              共 <span className="tnum font-medium">{data?.total ?? 0}</span> 条
            </div>
            <Pagination className="justify-end">
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious
                    href="#"
                    onClick={(e) => {
                      e.preventDefault();
                      if (page > 1) setPage(page - 1);
                    }}
                    className={page <= 1 ? 'pointer-events-none opacity-50' : ''}
                  />
                </PaginationItem>
                {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                  const start = Math.max(1, Math.min(page - 2, totalPages - 4));
                  const p = start + i;
                  if (p > totalPages) return null;
                  return (
                    <PaginationItem key={p}>
                      <PaginationLink
                        href="#"
                        onClick={(e) => {
                          e.preventDefault();
                          setPage(p);
                        }}
                        isActive={p === page}
                      >
                        {p}
                      </PaginationLink>
                    </PaginationItem>
                  );
                })}
                <PaginationItem>
                  <PaginationNext
                    href="#"
                    onClick={(e) => {
                      e.preventDefault();
                      if (page < totalPages) setPage(page + 1);
                    }}
                    className={page >= totalPages ? 'pointer-events-none opacity-50' : ''}
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          </div>
        )}
      </div>

      {/* 订单详情抽屉 */}
      <Drawer open={detailDrawerOpen} onOpenChange={setDetailDrawerOpen} direction="right">
        <DrawerContent className="h-full w-full max-w-[520px] right-0 left-auto">
          <DrawerHeader>
            <DrawerTitle>订单详情</DrawerTitle>
            <DrawerDescription>
              {selectedOrder?.orderNo}
            </DrawerDescription>
          </DrawerHeader>

          {selectedOrder && (
            <div className="flex-1 overflow-y-auto px-6 pb-6">
              {/* 基本信息 */}
              <div className="space-y-3 rounded-lg border border-[#E6EAF2] p-4">
                <h4 className="text-sm font-medium text-[#0f172a]">基本信息</h4>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-slate-500">状态</p>
                    <Badge className="mt-1" variant="outline">
                      {MEDIA_ORDER_STATUS_LABELS[selectedOrder.status]}
                    </Badge>
                  </div>
                  <div>
                    <p className="text-slate-500">提交时间</p>
                    <p className="mt-1 text-slate-700">{selectedOrder.createdAt}</p>
                  </div>
                  <div>
                    <p className="text-slate-500">客户</p>
                    <p className="mt-1 text-slate-700">{selectedOrder.brandName || '-'}</p>
                  </div>
                  <div>
                    <p className="text-slate-500">渠道</p>
                    <p className="mt-1 text-slate-700">{selectedOrder.channelName || '-'}</p>
                  </div>
                  <div>
                    <p className="text-slate-500">供应商</p>
                    <p className="mt-1 text-slate-700">{selectedOrder.supplierName || '-'}</p>
                  </div>
                  <div>
                    <p className="text-slate-500">供应商单号</p>
                    <p className="mt-1 font-mono text-xs text-slate-700">
                      {selectedOrder.supplierOrderNo || '-'}
                    </p>
                  </div>
                </div>
              </div>

              {/* 金额信息 */}
              <div className="mt-4 space-y-3 rounded-lg border border-[#E6EAF2] p-4">
                <h4 className="text-sm font-medium text-[#0f172a]">金额信息</h4>
                <div className="grid grid-cols-3 gap-3 text-sm">
                  <div>
                    <p className="text-slate-500">售价</p>
                    <p className="mt-1 tnum font-semibold" style={{ color: '#2563EB' }}>
                      {formatMoneyCents(selectedOrder.priceCents)}
                    </p>
                  </div>
                  <div>
                    <p className="text-slate-500">采购价</p>
                    <p className="mt-1 tnum font-medium text-slate-700">
                      {formatMoneyCents(selectedOrder.costPriceCents)}
                    </p>
                  </div>
                  <div>
                    <p className="text-slate-500">毛利</p>
                    <p
                      className={`mt-1 tnum font-semibold ${
                        selectedOrder.grossProfitCents >= 0
                          ? 'text-[#16A34A]'
                          : 'text-[#DC2626]'
                      }`}
                    >
                      {selectedOrder.grossProfitCents >= 0 ? '+' : ''}
                      {formatMoneyCents(selectedOrder.grossProfitCents)}
                    </p>
                  </div>
                </div>
              </div>

              {/* 已发布链接 */}
              {selectedOrder.publishedUrl && (
                <div className="mt-4 rounded-lg border border-[#16A34A]/30 bg-[#16A34A]/5 p-4">
                  <p className="text-sm font-medium text-[#16A34A]">已发布链接</p>
                  <UniversalLink
                    to={selectedOrder.publishedUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-1 flex items-center gap-1 text-sm text-[#2563EB] hover:underline"
                  >
                    <span className="truncate">{selectedOrder.publishedUrl}</span>
                    <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                  </UniversalLink>
                </div>
              )}

              {/* 失败原因 */}
              {selectedOrder.rejectReason && (
                <div className="mt-4 rounded-lg border border-[#DC2626]/30 bg-[#DC2626]/5 p-4">
                  <p className="text-sm font-medium text-[#DC2626]">驳回原因</p>
                  <p className="mt-1 text-sm text-slate-700">{selectedOrder.rejectReason}</p>
                </div>
              )}

              {/* 备注 */}
              {selectedOrder.remark && (
                <div className="mt-4 rounded-lg border border-[#E6EAF2] p-4">
                  <p className="text-sm font-medium text-[#0f172a]">备注</p>
                  <p className="mt-1 text-sm text-slate-600">{selectedOrder.remark}</p>
                </div>
              )}

              {/* 时间线 */}
              <div className="mt-4">
                <h4 className="mb-3 text-sm font-medium text-[#0f172a]">状态时间线</h4>
                <div className="relative space-y-4 pl-6">
                  {selectedOrder.timeline.map((item, idx) => (
                    <div key={idx} className="relative">
                      {/* 时间点 */}
                      <div
                        className={`absolute -left-6 top-1 h-3 w-3 rounded-full ${
                          idx === 0
                            ? 'bg-[#2563EB] ring-4 ring-[#2563EB]/20'
                            : 'bg-slate-300'
                        }`}
                      />
                      {/* 连线 */}
                      {idx < selectedOrder.timeline.length - 1 && (
                        <div className="absolute -left-[22px] top-4 h-full w-px bg-slate-200" />
                      )}
                      <div>
                        <p className="text-sm font-medium text-[#0f172a]">
                          {MEDIA_ORDER_STATUS_LABELS[item.status as MediaOrderStatus] || item.status}
                        </p>
                        <p className="text-xs text-slate-400">{item.time}</p>
                        {item.note && (
                          <p className="mt-1 text-xs text-slate-500">{item.note}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </DrawerContent>
      </Drawer>

      {/* 操作弹窗 */}
      <Dialog open={!!actionType} onOpenChange={(v) => !v && setActionType(null)}>
        <DialogContent className="max-w-[480px]">
          <DialogHeader>
            <DialogTitle>
              {actionType === 'supplier' && '提交供应商单号'}
              {actionType === 'publish' && '标记已发布'}
              {actionType === 'reject' && '驳回退款'}
            </DialogTitle>
            <DialogDescription>
              {actionType === 'supplier' && '填写供应商返回的订单编号'}
              {actionType === 'publish' && '填写文章发布后的链接地址'}
              {actionType === 'reject' && '请填写驳回原因，将同步给客户'}
            </DialogDescription>
          </DialogHeader>

          <div className="py-2">
            {actionType === 'supplier' && (
              <Input
                placeholder="请输入供应商订单号"
                value={actionValue}
                onChange={(e) => setActionValue(e.target.value)}
              />
            )}
            {actionType === 'publish' && (
              <Input
                placeholder="请输入发布链接 URL"
                value={actionValue}
                onChange={(e) => setActionValue(e.target.value)}
              />
            )}
            {actionType === 'reject' && (
              <Textarea
                placeholder="请填写驳回原因"
                value={actionValue}
                onChange={(e) => setActionValue(e.target.value)}
                rows={4}
              />
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setActionType(null)}>
              取消
            </Button>
            <Button
              className="bg-[#2563EB] hover:bg-[#2563EB]"
              onClick={handleActionConfirm}
              disabled={!actionValue.trim()}
            >
              确认
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default OrdersPage;
