import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Wallet, Clock, TrendingUp, TrendingDown, CreditCard } from 'lucide-react';

import { Card, CardContent } from '@client/src/components/ui/card';
import { Button } from '@client/src/components/ui/button';
import { Pill } from '@client/src/components/layout/Pill';
import { DataTable } from '@client/src/components/layout/DataTable';
import { SectionCard } from '@client/src/components/layout/SectionCard';
import { EmptyState } from '@client/src/components/layout/EmptyState';
import { DataPagination } from '@client/src/components/ui/data-pagination';
import { Skeleton } from '@client/src/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@client/src/components/ui/select';
import { creation } from '@client/src/api';
import { listCreditRequests } from '@client/src/api/ai-keys';
import { useAuth } from '@client/src/contexts/AuthContext';
import { useBrandSelector } from '@client/src/hooks/useBrandSelector';
import {
  CREDIT_TX_TYPE_LABELS,
  CREDIT_REQUEST_STATUS_LABELS,
  type CreditAccountDetail,
  type CreditTransaction,
  type CreditRequestItem,
  type CreditRequestListResponse,
  type PagedResponse,
} from '@shared/api.interface';

const PAGE_SIZE = 10;

const TIME_RANGES: { value: string; label: string }[] = [
  { value: '7d', label: '最近 7 天' },
  { value: '30d', label: '最近 30 天' },
  { value: 'all', label: '全部' },
];

const TX_TYPE_FILTERS: { value: string; label: string }[] = [
  { value: 'all', label: '全部' },
  { value: 'consume', label: '消耗' },
  { value: 'recharge', label: '充值' },
];



const formatNumber = (n: number | string): string => {
  const num = typeof n === 'string' ? Number(n) : n;
  return num.toLocaleString('zh-CN');
};

const formatDateTime = (dateStr: string): string => {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  return d.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const isConsumeType = (type: string): boolean => {
  const consumeTypes = [
    'article_generate',
    'image_generate',
    'video_script',
    'video_generate',
  ];
  return consumeTypes.includes(type);
};

const isRechargeType = (type: string): boolean => {
  const rechargeTypes = ['manual_recharge', 'plan_grant', 'adjustment', 'refund'];
  return rechargeTypes.includes(type);
};

const CreditTransactionsPage: React.FC = () => {
  const { user } = useAuth();
  const isClient = user?.role === 'client';
  const { brands: brandOptions, selectedBrandId, setSelectedBrandId } =
    useBrandSelector();

  const brandId = isClient ? user?.brandId ?? '' : selectedBrandId;

  const [page, setPage] = useState(1);
  const [txTypeFilter, setTxTypeFilter] = useState<string>('all');
  const [timeRange, setTimeRange] = useState<string>('30d');

  const [activeTab, setActiveTab] = useState<'transactions' | 'requests'>('transactions');
  const [reqStatus, setReqStatus] = useState<string>('all');
  const [reqPage, setReqPage] = useState(1);

  const handleTypeChange = (value: string) => {
    setTxTypeFilter(value);
    setPage(1);
  };

  const handleReqStatusChange = (value: string) => {
    setReqStatus(value);
    setReqPage(1);
  };

  const { data: account, isLoading: accountLoading } = useQuery<
    CreditAccountDetail,
    unknown
  >({
    queryKey: ['creditAccountDetail', brandId],
    queryFn: () => creation.getCreditAccountDetail(brandId),
    enabled: !!brandId,
    staleTime: 60 * 1000,
  });

  const { data: transactions, isLoading: txLoading } = useQuery<
    PagedResponse<CreditTransaction>,
    unknown
  >({
    queryKey: [
      'creditTransactions',
      brandId,
      page,
      txTypeFilter,
      timeRange,
    ],
    queryFn: () =>
      creation.listCreditTransactions({
        brandId,
        page,
        pageSize: PAGE_SIZE,
        transactionType: txTypeFilter === 'all' ? undefined : txTypeFilter,
      }),
    enabled: !!brandId,
    staleTime: 30 * 1000,
    select: (data: PagedResponse<CreditTransaction>) => {
      // 前端按消耗/充值过滤（因为后端按 transactionType 细粒度）
      if (txTypeFilter === 'consume') {
        const filtered = data.items.filter((item: CreditTransaction) =>
          isConsumeType(item.transactionType),
        );
        return { ...data, items: filtered, total: filtered.length };
      }
      if (txTypeFilter === 'recharge') {
        const filtered = data.items.filter((item: CreditTransaction) =>
          isRechargeType(item.transactionType),
        );
        return { ...data, items: filtered, total: filtered.length };
      }
      return data;
    },
  });

  const { data: reqList, isLoading: reqLoading } = useQuery<
    CreditRequestListResponse,
    unknown
  >({
    queryKey: ['credit-requests', brandId, reqStatus, reqPage],
    queryFn: () =>
      listCreditRequests({
        status: reqStatus === 'all' ? undefined : reqStatus,
        page: reqPage,
        pageSize: PAGE_SIZE,
      }),
    enabled: !!brandId && activeTab === 'requests',
    staleTime: 30 * 1000,
  });

  const handleRecharge = () => {
    toast.info('请联系客服充值');
  };

  const handleTimeRangeChange = (value: string) => {
    setTimeRange(value);
    setPage(1);
  };

  const columns = [
    {
      key: 'createdAt',
      title: '时间',
      width: 150,
      render: (row: CreditTransaction) => (
        <span className="text-sm text-gray-600">{formatDateTime(row.createdAt)}</span>
      ),
    },
    {
      key: 'transactionType',
      title: '类型',
      width: 90,
      render: (row: CreditTransaction) => {
        const label =
          CREDIT_TX_TYPE_LABELS[
            row.transactionType as keyof typeof CREDIT_TX_TYPE_LABELS
          ] ?? row.transactionType;
        const isPositive = isRechargeType(row.transactionType);
        return <Pill variant={isPositive ? 'success' : 'muted'}>{label}</Pill>;
      },
    },
    {
      key: 'description',
      title: '事由',
      width: '40%',
      render: (row: CreditTransaction) => (
        <span className="text-sm text-gray-700 line-clamp-2 block" title={row.description ?? ''}>{row.description ?? '-'}</span>
      ),
    },
    {
      key: 'changeAmount',
      title: '变动',
      width: 110,
      align: 'right' as const,
      render: (row: CreditTransaction) => {
        const isPositive = row.changeAmount > 0;
        return (
          <span
            className={`font-semibold text-sm tabular-nums ${
              isPositive ? 'text-green-600' : 'text-red-500'
            }`}
          >
            {isPositive ? '+' : ''}
            {formatNumber(row.changeAmount)}
          </span>
        );
      },
    },
    {
      key: 'balanceAfter',
      title: '余额',
      width: 110,
      align: 'right' as const,
      render: (row: CreditTransaction) => (
        <span className="text-sm text-gray-700 tabular-nums">{formatNumber(row.balanceAfter)}</span>
      ),
    },
  ];

  const REQ_STATUS_FILTERS: { value: string; label: string }[] = [
    { value: 'all', label: '全部' },
    { value: 'pending', label: '待处理' },
    { value: 'approved', label: '已到账' },
    { value: 'rejected', label: '已驳回' },
  ];

  const reqColumns = [
    {
      key: 'createdAt',
      title: '提交时间',
      width: 160,
      render: (row: CreditRequestItem) => (
        <span className="text-sm text-gray-600">{formatDateTime(row.createdAt ?? '')}</span>
      ),
    },
    {
      key: 'packageName',
      title: '套餐',
      width: '25%',
      render: (row: CreditRequestItem) => (
        <span className="text-sm text-gray-700 truncate" title={row.packageName ?? ''}>{row.packageName ?? '-'}</span>
      ),
    },
    {
      key: 'amount',
      title: '算力数',
      width: 110,
      align: 'right' as const,
      render: (row: CreditRequestItem) => (
        <span className="font-semibold text-sm text-green-600 tabular-nums">
          +{row.amount != null ? formatNumber(row.amount) : '-'}
        </span>
      ),
    },
    {
      key: 'status',
      title: '状态',
      width: 90,
      render: (row: CreditRequestItem) => {
        const label = CREDIT_REQUEST_STATUS_LABELS[
          row.status as keyof typeof CREDIT_REQUEST_STATUS_LABELS
        ] ?? row.status;
        let variant: 'success' | 'warning' | 'muted' = 'muted';
        if (row.status === 'pending') {
          variant = 'warning';
        } else if (row.status === 'approved') {
          variant = 'success';
        } else if (row.status === 'rejected') {
          variant = 'muted';
        }
        return <Pill variant={variant}>{label}</Pill>;
      },
    },
    {
      key: 'rejectReason',
      title: '备注',
      width: '25%',
      render: (row: CreditRequestItem) => (
        <span className="text-sm text-gray-700 truncate" title={row.status === 'rejected' ? row.rejectReason ?? '' : ''}>
          {row.status === 'rejected' ? row.rejectReason ?? '-' : '-'}
        </span>
      ),
    },
    {
      key: 'processedAt',
      title: '处理时间',
      width: 160,
      render: (row: CreditRequestItem) => (
        <span className="text-sm text-gray-600 tabular-nums">
          {row.status === 'pending' ? '-' : formatDateTime(row.processedAt ?? '')}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div data-page-header="true">
        <h1 className="text-[20px] font-semibold" style={{ color: '#101828' }}>算力流水</h1>
        <p className="text-sm text-gray-500 mt-1">
          查看算力余额变动与消费明细
        </p>
      </div>

      {/* Tab 切换 */}
      <div className="flex items-center gap-6 border-b border-gray-200 pb-0">
        <button
          className={`pb-3 text-sm font-medium transition-colors border-b-2 -mb-px ${
            activeTab === 'transactions'
              ? 'text-[#2E7DFF] font-semibold border-[#2E7DFF]'
              : 'text-[#94A3B8] border-transparent hover:text-gray-700'
          }`}
          onClick={() => setActiveTab('transactions')}
        >
          算力流水
        </button>
        <button
          className={`pb-3 text-sm font-medium transition-colors border-b-2 -mb-px ${
            activeTab === 'requests'
              ? 'text-[#2E7DFF] font-semibold border-[#2E7DFF]'
              : 'text-[#94A3B8] border-transparent hover:text-gray-700'
          }`}
          onClick={() => setActiveTab('requests')}
        >
          充值申请记录
        </button>
      </div>

      {/* 顶部余额卡片 */}
      <Card
        className="rounded-lg border overflow-hidden"
        style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}
      >
        <CardContent className="p-0">
          {!isClient && (
            <div className="px-6 pt-4">
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-600">品牌：</span>
                <Select value={selectedBrandId} onValueChange={setSelectedBrandId}>
                  <SelectTrigger className="w-48 h-9">
                    <SelectValue placeholder="选择品牌" />
                  </SelectTrigger>
                  <SelectContent>
                    {brandOptions.map((b) => (
                      <SelectItem key={b.id} value={b.id}>
                        {b.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
          <div className="bg-gradient-to-br from-[#1e40af] to-[#1e3a8a] text-white p-6 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center">
                <Wallet className="w-6 h-6 text-yellow-400" />
              </div>
              <div>
                <div className="text-sm text-blue-200 mb-1">当前余额</div>
                {accountLoading ? (
                  <Skeleton className="h-9 w-32 bg-white/20" />
                ) : (
                  <div className="text-4xl font-bold">
                    {account ? formatNumber(account.balance) : '-'}
                  </div>
                )}
              </div>
            </div>
            <Button
              variant="outline"
              className="bg-white/10 border-white/30 text-white hover:bg-white/20 hover:text-white"
              onClick={handleRecharge}
            >
              充值
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 算力流水列表 */}
      {activeTab === 'transactions' && (
        <SectionCard
          title="算力流水"
          count={transactions?.total ?? 0}
        >
          <div className="flex flex-wrap items-center gap-3 mb-4">
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600">类型：</span>
              <Select value={txTypeFilter} onValueChange={handleTypeChange}>
                <SelectTrigger className="w-32 h-9">
                  <SelectValue placeholder="全部" />
                </SelectTrigger>
                <SelectContent>
                  {TX_TYPE_FILTERS.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600">时间：</span>
              <Select value={timeRange} onValueChange={handleTimeRangeChange}>
                <SelectTrigger className="w-36 h-9">
                  <SelectValue placeholder="时间范围" />
                </SelectTrigger>
                <SelectContent>
                  {TIME_RANGES.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="ml-auto text-sm text-gray-500 flex items-center gap-1">
              <Clock className="w-4 h-4" />
              共 {transactions?.total ?? 0} 条记录
            </div>
          </div>

          {txLoading ? (
            <div className="space-y-2 py-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 h-11 px-2">
                  <Skeleton className="h-4 w-36" />
                  <Skeleton className="h-5 w-16" />
                  <Skeleton className="h-4 flex-1" />
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-4 w-24" />
                </div>
              ))}
            </div>
          ) : !transactions || transactions.items.length === 0 ? (
            <EmptyState
              icon={<Wallet />}
              description="暂无流水记录，还没有任何算力变动记录"
              action={
                <Button
                  size="sm"
                  className="bg-[#2E7DFF] text-white hover:bg-[#1E5FD6]"
                  onClick={handleRecharge}
                >
                  <CreditCard className="h-4 w-4" />
                  去充值
                </Button>
              }
            />
          ) : (
            <>
              <DataTable
                rowKey="id"
                data={transactions.items}
                columns={columns}
                emptyText="暂无流水记录"
              />
              {transactions.total > PAGE_SIZE && (
                <div className="pt-4">
                  <DataPagination
                    total={transactions.total}
                    page={page}
                    pageSize={PAGE_SIZE}
                    onPageChange={setPage}
                    onPageSizeChange={() => {}}
                  />
                </div>
              )}
            </>
          )}
        </SectionCard>
      )}

      {/* 充值申请记录列表 */}
      {activeTab === 'requests' && (
        <SectionCard
          title="充值申请记录"
          count={reqList?.total ?? 0}
        >
          <div className="flex flex-wrap items-center gap-3 mb-4">
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600">状态：</span>
              <Select value={reqStatus} onValueChange={handleReqStatusChange}>
                <SelectTrigger className="w-32 h-9">
                  <SelectValue placeholder="全部" />
                </SelectTrigger>
                <SelectContent>
                  {REQ_STATUS_FILTERS.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {reqLoading ? (
            <div className="space-y-2 py-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 h-11 px-2">
                  <Skeleton className="h-4 w-36" />
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-5 w-16" />
                  <Skeleton className="h-4 flex-1" />
                  <Skeleton className="h-4 w-36" />
                </div>
              ))}
            </div>
          ) : !reqList || reqList.items.length === 0 ? (
            <EmptyState
              icon={<Wallet />}
              description="暂无充值申请，还没有提交过充值申请"
              action={
                <Button
                  size="sm"
                  className="bg-[#2E7DFF] text-white hover:bg-[#1E5FD6]"
                  onClick={handleRecharge}
                >
                  <CreditCard className="h-4 w-4" />
                  申请充值
                </Button>
              }
            />
          ) : (
            <>
              <DataTable
                rowKey="id"
                data={reqList.items}
                columns={reqColumns}
                emptyText="暂无充值申请"
              />
              {reqList.total > PAGE_SIZE && (
                <div className="pt-4">
                  <DataPagination
                    total={reqList.total}
                    page={reqPage}
                    pageSize={PAGE_SIZE}
                    onPageChange={setReqPage}
                    onPageSizeChange={() => {}}
                  />
                </div>
              )}
            </>
          )}
        </SectionCard>
      )}
    </div>
  );
};

export default CreditTransactionsPage;
