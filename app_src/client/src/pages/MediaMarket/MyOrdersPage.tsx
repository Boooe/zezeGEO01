import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Clock,
  FileText,
} from 'lucide-react';
import { Pill } from '@client/src/components/layout/Pill';
import { SectionCard } from '@client/src/components/layout/SectionCard';
import { Toolbar } from '@client/src/components/layout/Toolbar';
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
  useMyOrders,
  type ClientOrderQuery,
} from '@client/src/api/media-orders';
import {
  MEDIA_ORDER_STATUS,
  MEDIA_ORDER_STATUS_LABELS,
} from '@shared/api.interface';
import type { MediaOrderClient, MediaOrderStatus } from '@shared/api.interface';
import { formatMoneyCentsRaw, formatMoneyCents } from '@client/src/utils/format';
import { UniversalLink } from '@lark-apaas/client-toolkit/components/UniversalLink';

const PAGE_SIZE = 15;

const PRIMARY = '#2563EB';
const DANGER = '#DC2626';
const SUCCESS = '#16A34A';
const WARNING = '#F59E0B';
const MUTED = '#94A3B8';

const STATUS_PILL_VARIANT: Record<MediaOrderStatus, 'success' | 'warning' | 'danger' | 'info' | 'muted'> = {
  pending_payment: 'muted',
  paid: 'warning',
  placing: 'info',
  published: 'success',
  failed: 'danger',
  refunded: 'muted',
};

const MyOrdersPage: React.FC = () => {
  const navigate = useNavigate();
  const [status, setStatus] = useState<string>('');
  const [keyword, setKeyword] = useState('');
  const [page, setPage] = useState(1);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const queryParams: ClientOrderQuery = useMemo(() => {
    const params: ClientOrderQuery = {
      page,
      pageSize: PAGE_SIZE,
    };
    if (status) params.status = status as MediaOrderStatus;
    if (keyword.trim()) params.keyword = keyword.trim();
    return params;
  }, [status, keyword, page]);

  const { data, isLoading } = useMyOrders(queryParams);
  const totalPages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;

  const toggleExpand = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
  };

  return (
    <SectionCard title="我的发稿订单">
      <Toolbar>
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
            placeholder="搜索订单号/标题/渠道"
            value={keyword}
            onChange={(e) => { setKeyword(e.target.value); setPage(1); }}
            className="pl-9 w-[280px]"
          />
        </div>

        <div className="ml-auto text-[12px] text-[#64748b]">
          共 <span className="tnum font-medium text-[#334155]">{data?.total ?? 0}</span> 条订单
        </div>
      </Toolbar>

      {/* 订单列表 */}
      <div className="space-y-3 mt-4">
        {isLoading
          ? Array.from({ length: 5 }).map((_, i) => (
              <div
                key={i}
                className="rounded-xl border border-[#E6EAF2] bg-white p-5"
              >
                <div className="flex items-center justify-between">
                  <Skeleton className="h-5 w-48" />
                  <Skeleton className="h-5 w-16" />
                </div>
                <Skeleton className="mt-3 h-4 w-32" />
              </div>
            ))
          : !data?.items.length
          ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-[#E6EAF2] bg-white p-16">
              <FileText className="mb-4 h-12 w-12 text-slate-300" />
              <p className="text-[#64748b] text-[13px] mb-4">暂无订单记录</p>
              <Button
                className="h-9 rounded-lg bg-[#2E7DFF] text-[13px] font-medium hover:bg-[#1E5FD6]"
                onClick={() => navigate('?tab=market', { replace: true })}
              >
                去发稿
              </Button>
            </div>
          )
          : data.items.map((order) => (
              <OrderCard
                key={order.id}
                order={order}
                expanded={expandedId === order.id}
                onToggle={() => toggleExpand(order.id)}
              />
            ))}
      </div>

      {/* 分页 */}
      {totalPages > 1 && (
        <div className="mt-6 flex justify-center" style={{ borderTop: 'none' }}>
          <Pagination>
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
    </SectionCard>
  );
};

/* ---------- 订单卡片 ---------- */

interface OrderCardProps {
  order: MediaOrderClient;
  expanded: boolean;
  onToggle: () => void;
}

const OrderCard: React.FC<OrderCardProps> = ({ order, expanded, onToggle }) => {
  return (
    <div className="overflow-hidden rounded-xl border border-[#E6EAF2] bg-white transition-all hover:border-[#2563EB]/30">
      <div
        className="flex cursor-pointer items-center justify-between p-5"
        onClick={onToggle}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3">
            <h3 className="truncate font-medium text-[#0f172a]">{order.title}</h3>
            <Pill variant={STATUS_PILL_VARIANT[order.status]}>
              {MEDIA_ORDER_STATUS_LABELS[order.status]}
            </Pill>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-1 text-sm text-slate-500">
            <span className="font-mono text-[12px] text-[#64748b]">{order.orderNo}</span>
            <span className="text-[13px] text-[#64748b]">渠道：{order.channelName || '-'}</span>
            <span className="flex items-center gap-1 text-[12px] text-[#64748b]">
              <Clock className="h-3.5 w-3.5" />
              {order.createdAt}
            </span>
          </div>
          {order.status === 'published' && order.publishedUrl && (
            <UniversalLink
              to={order.publishedUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="mt-2 inline-flex items-center gap-1 text-[13px] hover:underline" style={{ color: PRIMARY }}
            >
              <ExternalLink className="h-3.5 w-3.5" />
              查看发布链接
            </UniversalLink>
          )}
          {order.status === 'failed' && order.rejectReason && (
            <p className="mt-2 text-[13px]" style={{ color: DANGER }}>
              失败原因：{order.rejectReason}
            </p>
          )}
        </div>

        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="text-xs text-slate-400">订单金额</p>
            <p
              className="tnum text-lg font-bold"
style={{ color: PRIMARY }}
            >
              {formatMoneyCents(order.priceCents)}
            </p>
          </div>
          {expanded ? (
            <ChevronUp className="h-5 w-5 text-slate-400" />
          ) : (
            <ChevronDown className="h-5 w-5 text-slate-400" />
          )}
        </div>
      </div>

      {/* 展开详情 */}
      {expanded && (
        <div className="border-t border-[#EEF2F7] bg-[#F7F9FC] p-5">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            {/* 正文预览 */}
            <div>
              <p className="mb-2 text-[13px] font-medium text-[#0f172a]">稿件正文预览</p>
              <div className="max-h-[200px] overflow-y-auto rounded-md bg-white p-3 text-[13px] text-slate-600 border border-[#E6EAF2]">
                <p className="whitespace-pre-wrap">
                  {/* 正文内容（注：订单详情接口未返回完整正文，这里显示备注或标题） */}
                  {order.remark || order.title || '暂无正文预览'}
                </p>
              </div>
            </div>

            {/* 时间线 */}
            <div>
              <p className="mb-2 text-sm font-medium text-[#0f172a]">状态时间线</p>
              <div className="relative space-y-3 pl-6">
                {order.timeline.map((item, idx) => (
                  <div key={idx} className="relative">
                    <div
                      className={`absolute -left-6 top-1 h-3 w-3 rounded-full ${
                      idx === 0
                        ? 'bg-[#2563EB] ring-4 ring-[#2563EB]/20'
                        : 'bg-slate-300'
                      }`}
                    />
                    {idx < order.timeline.length - 1 && (
                      <div className="absolute -left-[22px] top-4 h-full w-px bg-[#E2E8F0]" />
                    )}
                    <div>
                      <p className="text-[13px] font-medium text-[#0f172a]">
                        {MEDIA_ORDER_STATUS_LABELS[item.status as MediaOrderStatus] || item.status}
                      </p>
                      <p className="text-[12px] text-[#94A3B8]">{item.time}</p>
                      {item.note && (
                        <p className="mt-1 text-[12px] text-[#64748b]">{item.note}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* 备注 */}
          {order.remark && (
            <div className="mt-4">
              <p className="mb-1 text-[13px] font-medium text-[#0f172a]">备注</p>
              <p className="text-[13px] text-[#475569]">{order.remark}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default MyOrdersPage;
