import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Zap,
  Clock,
  TrendingUp,
  Calendar,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  Sparkles,
  Inbox,
} from 'lucide-react';
import ReactECharts from 'echarts-for-react';
import type { EChartsOption } from 'echarts';

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@client/src/components/ui/card';
import { Button } from '@client/src/components/ui/button';
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
  Empty,
  EmptyHeader,
  EmptyTitle,
  EmptyContent,
} from '@client/src/components/ui/empty';
import { Pill } from '@client/src/components/layout/Pill';
import { DataTable } from '@client/src/components/layout/DataTable';
import { EmptyState } from '@client/src/components/layout/EmptyState';

import { creation } from '@client/src/api';
import { useAuth } from '@client/src/contexts/AuthContext';
import { useBrandSelector } from '@client/src/hooks/useBrandSelector';
import {
  CREDIT_TX_TYPE_LABELS,
  CREDIT_TX_TYPES,
  type BrandOption,
  type CreditAccountDetail,
  type CreditTransaction,
  type UsageBreakdownResponse,
  type PagedResponse,
} from '@shared/api.interface';

const PAGE_SIZE = 10;

const formatNumber = (n: number | string): string => {
  const num = typeof n === 'string' ? Number(n) : n;
  return num.toLocaleString('zh-CN');
};

const formatDate = (dateStr: string | null | undefined): string => {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  return d.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const getMonthList = (): string[] => {
  const months: string[] = [];
  const now = new Date();
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push(
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
    );
  }
  return months;
};

/* ---------------- 账户卡片骨架 ---------------- */

function AccountCardSkeleton() {
  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-2">
        <Skeleton className="h-5 w-24" />
        <Skeleton className="h-8 w-40 mt-2" />
      </CardHeader>
      <CardContent>
        <Skeleton className="h-3 w-full mb-2" />
        <Skeleton className="h-2 w-3/4 mb-6" />
        <div className="grid grid-cols-3 gap-4">
          <Skeleton className="h-12 w-full rounded" />
          <Skeleton className="h-12 w-full rounded" />
          <Skeleton className="h-12 w-full rounded" />
        </div>
      </CardContent>
    </Card>
  );
}

/* ---------------- 账户卡片 ---------------- */

interface AccountCardProps {
  account: CreditAccountDetail;
}

function AccountCard({ account }: AccountCardProps) {
  const total = account.balance + account.totalUsed;
  const percent = total > 0 ? (account.totalUsed / total) * 100 : 0;
  const remainingPercent = total > 0 ? (account.balance / total) * 100 : 0;

  const expiresDays = account.planExpiresAt
    ? Math.ceil(
        (new Date(account.planExpiresAt).getTime() - Date.now()) /
          (1000 * 60 * 60 * 24),
      )
    : null;

  const isExpiring = expiresDays !== null && expiresDays <= 30 && expiresDays > 0;
  const isExpired = expiresDays !== null && expiresDays <= 0;

  return (
    <Card className="overflow-hidden border-0 bg-gradient-to-br from-[#1e40af] to-[#1e3a8a] text-white">
      <CardContent className="pt-6 pb-6">
        <div className="flex items-start justify-between mb-6">
          <div>
            <div className="text-sm text-blue-200 mb-1">当前套餐</div>
            <div className="text-xl font-semibold flex items-center gap-2">
              <Zap className="w-5 h-5 text-yellow-400" />
              {account.currentPlanName ?? '暂无套餐'}
            </div>
          </div>
          {account.planExpiresAt && (
            <Badge
              variant="outline"
              className={`
                ${isExpired ? 'bg-red-500/20 text-red-200 border-red-400/30' : ''}
                ${isExpiring ? 'bg-orange-500/20 text-orange-200 border-orange-400/30' : ''}
                ${!isExpired && !isExpiring ? 'bg-white/10 text-blue-100 border-white/20' : ''}
              `}
            >
              {isExpired
                ? '已过期'
                : isExpiring
                  ? `${expiresDays} 天后到期`
                  : `${expiresDays} 天后到期`}
            </Badge>
          )}
        </div>

        <div className="mb-2">
          <div className="flex items-baseline gap-2 mb-2">
            <span className="text-4xl font-bold">
              {formatNumber(account.balance)}
            </span>
            <span className="text-sm text-blue-200">算力余额</span>
          </div>

          {/* 进度条 */}
          <div className="relative h-2 bg-white/20 rounded-full overflow-hidden">
            <div
              className="absolute left-0 top-0 h-full bg-gradient-to-r from-yellow-400 to-orange-400 rounded-full"
              style={{ width: `${remainingPercent}%` }}
            />
          </div>
          <div className="flex justify-between mt-2 text-xs text-blue-200">
            <span>已用 {formatNumber(account.totalUsed)}</span>
            <span>总额度 {formatNumber(total)}</span>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-4 mt-6 pt-5 border-t border-white/10">
          <div>
            <div className="text-xs text-blue-300 mb-1">套餐额度</div>
            <div className="text-base font-semibold tabular-nums">
              {formatNumber(account.totalRecharged)}
            </div>
          </div>
          <div>
            <div className="text-xs text-blue-300 mb-1">累计充值（元）</div>
            <div className="text-base font-semibold tabular-nums">
              {/* TODO: 接入真实充值金额后显示；当前无真实充值数据字段 */}
              —
            </div>
          </div>
          <div>
            <div className="text-xs text-blue-300 mb-1">已用算力</div>
            <div className="text-base font-semibold">
              {formatNumber(account.totalUsed)}
            </div>
          </div>
          <div>
            <div className="text-xs text-blue-300 mb-1">每日发布上限</div>
            <div className="text-base font-semibold">
              {account.dailyPublishLimit} 篇/日
            </div>
          </div>
          <div>
            <div className="text-xs text-blue-300 mb-1">到期时间</div>
            <div className="text-base font-semibold">
              {account.planExpiresAt
                ? new Date(account.planExpiresAt).toLocaleDateString('zh-CN')
                : '-'}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/* ---------------- 使用明细环形图 ---------------- */

interface UsageChartProps {
  data: UsageBreakdownResponse;
}

function UsageChart({ data }: UsageChartProps) {
  const chartData = data.items
    .filter((item) => item.totalAmount > 0)
    .map((item) => ({
      name: item.typeLabel,
      value: item.totalAmount,
    }));

  const colors = ['#1e40af', '#10b981', '#f97316', '#8b5cf6', '#ec4899'];

  const option: EChartsOption = {
    tooltip: {
      trigger: 'item',
      formatter: (params: any) => {
        if (!params || Array.isArray(params)) return '';
        return `${params.name}<br/>算力：${formatNumber(params.value as number)}`;
      },
    },
    legend: {
      type: 'scroll',
      bottom: 0,
      itemWidth: 10,
      itemHeight: 10,
    },
    color: colors,
    series: [
      {
        type: 'pie',
        radius: ['55%', '75%'],
        center: ['50%', '45%'],
        avoidLabelOverlap: false,
        label: { show: false },
        emphasis: {
          label: { show: false },
        },
        labelLine: { show: false },
        data: chartData,
      },
    ],
  };

  if (chartData.length === 0) {
    return (
      <div className="h-[300px] flex items-center justify-center">
        <Empty>
          <EmptyHeader>
            <EmptyTitle>暂无使用数据</EmptyTitle>
          </EmptyHeader>
          <EmptyContent>本月还没有产生算力消耗</EmptyContent>
        </Empty>
      </div>
    );
  }

  return (
    <ReactECharts
      option={option}
      theme="ud"
      className="h-[300px] w-full"
    />
  );
}

/* ---------------- 主页面 ---------------- */

const MyPlan: React.FC = () => {
  const { user } = useAuth();
  const userBrandId = user?.brandId ?? '';
  const isAdmin = user?.role === 'admin' || user?.role === 'operator';
  const [page, setPage] = useState(1);
  const [txType, setTxType] = useState<string>('all');
  const [month, setMonth] = useState<string>(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });

  const monthList = useMemo(() => getMonthList(), []);

  const { brands: brandOptions, selectedBrandId, setSelectedBrandId } =
    useBrandSelector();

  const brandId = isAdmin ? selectedBrandId : userBrandId;

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
    queryKey: ['creditTransactions', brandId, page, txType],
    queryFn: () =>
      creation.listCreditTransactions({
        brandId,
        page,
        pageSize: PAGE_SIZE,
        transactionType: txType === 'all' ? undefined : txType,
      }),
    enabled: !!brandId,
    staleTime: 30 * 1000,
  });

  const { data: usage, isLoading: usageLoading } = useQuery<
    UsageBreakdownResponse,
    unknown
  >({
    queryKey: ['usageBreakdown', brandId, month],
    queryFn: () => creation.getUsageBreakdown({ brandId, month }),
    enabled: !!brandId,
    staleTime: 60 * 1000,
  });

  const handleMonthChange = (value: string) => {
    setMonth(value);
  };

  const handleTxTypeChange = (value: string) => {
    setTxType(value);
    setPage(1);
  };

  if (!brandId && !isAdmin) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Empty>
          <EmptyHeader>
            <AlertCircle className="w-10 h-10 text-orange-500 mx-auto mb-2" />
            <EmptyTitle>未绑定品牌</EmptyTitle>
          </EmptyHeader>
          <EmptyContent>当前账号未绑定品牌，请联系管理员</EmptyContent>
        </Empty>
      </div>
    );
  }



  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div data-page-header="true">
          <h1 className="text-[20px] font-semibold" style={{ color: '#101828' }}>我的套餐</h1>
          <p className="text-sm text-gray-500 mt-1">
            {isAdmin ? '查看品牌的算力余额、使用明细和流水记录' : '查看算力余额、使用明细和流水记录'}
          </p>
        </div>
        {isAdmin && (
          <div className="w-64">
            <Select
              value={selectedBrandId}
              onValueChange={(val: string) => {
                setSelectedBrandId(val);
                setPage(1);
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="选择品牌" />
              </SelectTrigger>
              <SelectContent>
                {brandOptions?.map((b: BrandOption) => (
                  <SelectItem key={b.id} value={b.id}>
                    {b.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {/* 顶部账户卡片 */}
      {accountLoading ? (
        <AccountCardSkeleton />
      ) : account && account.currentPlanName ? (
        <AccountCard account={account} />
      ) : (
        <Card className="border-dashed">
          <CardContent className="pt-10 pb-10 text-center">
            <AlertCircle className="w-10 h-10 text-orange-500 mx-auto mb-3" />
            <h3 className="text-base font-semibold text-gray-800 mb-1">
              当前品牌还没有绑定套餐
            </h3>
            <p className="text-sm text-gray-500">
              请联系服务商开通套餐后再查看
            </p>
          </CardContent>
        </Card>
      )}

      {/* 当前可用模型（仅客户角色展示） */}
      {!isAdmin && account?.activeModelName && (
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
                <Sparkles className="w-5 h-5 text-blue-600" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm text-gray-500">当前可用模型</div>
                <div className="text-[15px] font-medium text-gray-800 truncate">
                  {account.activeModelName} · 由服务商统一提供
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 中部：使用明细 + 月份选择 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-blue-600" />
                使用明细
              </CardTitle>
              <Select value={month} onValueChange={handleMonthChange}>
                <SelectTrigger className="w-36 h-8">
                  <SelectValue placeholder="选择月份" />
                </SelectTrigger>
                <SelectContent>
                  {monthList.map((m) => (
                    <SelectItem key={m} value={m}>
                      <div className="flex items-center gap-2">
                        <Calendar className="w-3.5 h-3.5 text-gray-400" />
                        {m}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent>
            {usageLoading ? (
              <div className="h-[300px] flex items-center justify-center">
                <div className="space-y-3 w-full max-w-[300px]">
                  <Skeleton className="h-6 w-full" />
                  <Skeleton className="h-6 w-5/6" />
                  <Skeleton className="h-6 w-4/6" />
                </div>
              </div>
            ) : usage ? (
              <UsageChart data={usage} />
            ) : null}
          </CardContent>
        </Card>

        {/* 使用类型横条列表 */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle>按类型统计</CardTitle>
            <CardDescription>
              {usage?.month ?? '-'} 各类型算力消耗
            </CardDescription>
          </CardHeader>
          <CardContent>
            {usageLoading ? (
              <div className="space-y-4">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="space-y-2">
                    <div className="flex justify-between">
                      <Skeleton className="h-4 w-20" />
                      <Skeleton className="h-4 w-16" />
                    </div>
                    <Skeleton className="h-2 w-full" />
                  </div>
                ))}
              </div>
            ) : usage ? (
              <div className="space-y-4">
                {usage.items.length === 0 ? (
                  <div className="py-8 text-center text-sm text-gray-500">
                    本月暂无消耗记录
                  </div>
                ) : (
                  usage.items.map((item, index) => {
                    const percent =
                      usage.totalUsed > 0
                        ? (item.totalAmount / usage.totalUsed) * 100
                        : 0;
                    const colors = [
                      '#1e40af',
                      '#10b981',
                      '#f97316',
                      '#8b5cf6',
                      '#ec4899',
                    ];
                    const color = colors[index % colors.length];

                    return (
                      <div key={item.transactionType}>
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-sm text-gray-700">
                            {item.typeLabel}
                          </span>
                          <span className="text-sm font-medium text-gray-900">
                            {formatNumber(item.totalAmount)}
                          </span>
                        </div>
                        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{
                              width: `${percent}%`,
                              backgroundColor: color,
                            }}
                          />
                        </div>
                        <div className="text-xs text-gray-400 mt-1">
                          {item.count} 次 · {percent.toFixed(1)}%
                        </div>
                      </div>
                    );
                  })
                )}

                {usage.totalUsed > 0 && (
                  <div className="pt-3 mt-3 border-t flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-700">
                      合计
                    </span>
                    <span className="text-base font-semibold text-gray-900">
                      {formatNumber(usage.totalUsed)}
                    </span>
                  </div>
                )}
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>

      {/* 底部：流水列表 */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-blue-600" />
              算力流水
            </CardTitle>
            <Select value={txType} onValueChange={handleTxTypeChange}>
              <SelectTrigger className="w-36 h-8">
                <SelectValue placeholder="全部类型" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部类型</SelectItem>
                {CREDIT_TX_TYPES.map((type) => (
                  <SelectItem key={type} value={type}>
                    {CREDIT_TX_TYPE_LABELS[type]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          {txLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between p-3 rounded-lg border border-border"
                >
                  <div className="flex items-center gap-3 flex-1">
                    <Skeleton className="h-8 w-8 rounded-full" />
                    <div className="space-y-2 flex-1">
                      <Skeleton className="h-4 w-24" />
                      <Skeleton className="h-3 w-32" />
                    </div>
                  </div>
                  <Skeleton className="h-5 w-16" />
                </div>
              ))}
            </div>
          ) : transactions ? (
            <>
              {transactions.items.length === 0 ? (
                <div className="py-12">
                  <EmptyState
                    icon={<Inbox />}
                    description="还没有任何算力变动记录"
                  />
                </div>
              ) : (
                <DataTable
                  rowKey="id"
                  columns={[
                    {
                      key: 'createdAt',
                      title: '时间',
                      width: '22%',
                      render: (row: CreditTransaction) => (
                        <span className="text-[12.5px] text-[#5B6B85] whitespace-nowrap">
                          {formatDate(row.createdAt)}
                        </span>
                      ),
                    },
                    {
                      key: 'type',
                      title: '类型',
                      width: '18%',
                      render: (row: CreditTransaction) => {
                        const isPositive = row.changeAmount > 0;
                        const typeLabel =
                          CREDIT_TX_TYPE_LABELS[
                            row.transactionType as keyof typeof CREDIT_TX_TYPE_LABELS
                          ] ?? row.transactionType;
                        return (
                          <Pill variant={isPositive ? 'success' : 'muted'}>
                            {typeLabel}
                          </Pill>
                        );
                      },
                    },
                    {
                      key: 'changeAmount',
                      title: '变动',
                      width: '15%',
                      align: 'right',
                      render: (row: CreditTransaction) => {
                        const isPositive = row.changeAmount > 0;
                        return (
                          <span
                            className={`font-medium tabular-nums text-[12.5px] ${isPositive ? 'text-[#10B981]' : 'text-[#EF4444]'}`}
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
                      width: '15%',
                      align: 'right',
                      render: (row: CreditTransaction) => (
                        <span className="text-[12.5px] text-[#0F172A] tabular-nums font-medium">
                          {formatNumber(row.balanceAfter)}
                        </span>
                      ),
                    },
                    {
                      key: 'description',
                      title: '备注',
                      width: '30%',
                      render: (row: CreditTransaction) => (
                        <span
                          className="text-[12.5px] text-[#5B6B85] truncate block"
                          title={row.description ?? ''}
                        >
                          {row.description ?? '-'}
                        </span>
                      ),
                    },
                  ]}
                  data={transactions.items}
                />
              )}

              {/* 分页 */}
              {transactions.total > 0 && (
                <div className="flex items-center justify-between mt-4 pt-4 border-t">
                  <div className="text-sm text-gray-500">
                    第 {page} 页 / 共{' '}
                    {Math.ceil(transactions.total / transactions.pageSize) || 1}{' '}
                    页
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage(page - 1)}
                      disabled={page <= 1}
                    >
                      <ChevronLeft className="w-4 h-4" />
                      上一页
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage(page + 1)}
                      disabled={
                        page >=
                        Math.ceil(
                          transactions.total / transactions.pageSize,
                        )
                      }
                    >
                      下一页
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
};

export default MyPlan;
