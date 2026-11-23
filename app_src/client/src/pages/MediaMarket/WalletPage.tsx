import React, { useState, useMemo } from 'react';
import {
  Wallet,
  CreditCard,
  TrendingUp,
  TrendingDown,
  Plus,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react';
import {
  Card,
  CardContent,
} from '@client/src/components/ui/card';
import { Button } from '@client/src/components/ui/button';
import { Badge } from '@client/src/components/ui/badge';
import { Skeleton } from '@client/src/components/ui/skeleton';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@client/src/components/ui/tabs';
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@client/src/components/ui/dialog';
import { Input } from '@client/src/components/ui/input';
import { PageHeader } from '@client/src/components/layout/PageHeader';
import { BrandSelector } from '@client/src/components/BrandSelector';
import { useAuth } from '@client/src/hooks/useAuth';
import { useBrandSelector } from '@client/src/hooks/useBrandSelector';
import {
  useWallet,
  useWalletTransactions,
  useApplyRecharge,
  useRechargeApplications,
  type TransactionListQuery,
  type RechargeApplicationQuery,
} from '@client/src/api/media-wallet';
import {
  WALLET_TX_TYPES,
  WALLET_TX_TYPE_LABELS,
  RECHARGE_STATUS_LABELS,
} from '@shared/api.interface';
import type { WalletTxType, RechargeStatus } from '@shared/api.interface';
import { formatMoneyCents, formatMoneyCentsRaw } from '@client/src/utils/format';

const PAGE_SIZE = 20;

const WalletPage: React.FC = () => {
  const { user, hasRole } = useAuth();
  const isClient = hasRole('client');
  const isAdmin = hasRole('admin') || hasRole('operator');
  const { selectedBrandId } = useBrandSelector();
  const brandId = isClient ? user?.brandId : selectedBrandId;

  const { data: wallet, isLoading: walletLoading } = useWallet(brandId || undefined, !!brandId);

  const [txTab, setTxTab] = useState<'recharge' | 'consume'>('recharge');
  const [txPage, setTxPage] = useState(1);
  const [rechargePage, setRechargePage] = useState(1);

  const [rechargeDialogOpen, setRechargeDialogOpen] = useState(false);
  const [rechargeAmount, setRechargeAmount] = useState('100');
  const [applyResult, setApplyResult] = useState<{
    applicationId: string;
    amount: number;
  } | null>(null);

  const applyRecharge = useApplyRecharge();

  // 消费流水
  const txParams: TransactionListQuery = useMemo(() => ({
    brandId,
    page: txPage,
    pageSize: PAGE_SIZE,
    type: txTab === 'consume' ? 'consume' : undefined,
  }), [brandId, txPage, txTab]);

  const { data: txData, isLoading: txLoading } = useWalletTransactions(txParams);

  const { data: rechargeData, isLoading: rechargeLoading, refetch: refetchApplications } = useRechargeApplications({
    brandId,
    page: rechargePage,
    pageSize: PAGE_SIZE,
  });

  const txTotalPages = txData
    ? Math.max(1, Math.ceil(txData.total / PAGE_SIZE))
    : 1;
  const rechargeTotalPages = rechargeData
    ? Math.max(1, Math.ceil(rechargeData.total / PAGE_SIZE))
    : 1;



  const handleApplyRecharge = () => {
    const amount = parseFloat(rechargeAmount);
    if (isNaN(amount) || amount < 100 || amount % 100 !== 0) return;
    applyRecharge.mutate(amount, {
      onSuccess: (app) => {
        setApplyResult({
          applicationId: app.id,
          amount: app.applyAmountCents,
        });
        refetchApplications();
      },
    });
  };

  const closeRechargeDialog = () => {
    setRechargeDialogOpen(false);
    setApplyResult(null);
    setRechargeAmount('100');
  };

  const txTypeColor = (type: WalletTxType): string => {
    switch (type) {
      case 'recharge':
      case 'refund':
      case 'gift':
        return 'text-[#16A34A]';
      case 'consume':
        return 'text-[#DC2626]';
      case 'adjust':
        return 'text-slate-600';
      default:
        return 'text-slate-600';
    }
  };

  const isPositive = (type: WalletTxType): boolean => {
    return type === 'recharge' || type === 'refund' || type === 'gift';
  };

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <PageHeader
            title="我的钱包"
            description="查看余额、充值与消费明细"
          />
        </div>
        {isAdmin && (
          <div className="w-56">
            <BrandSelector />
          </div>
        )}
      </div>

      {/* 余额卡片 */}
      <Card className="mb-6 border-[#E6EAF2] bg-white overflow-hidden">
        <CardContent className="p-6">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2 text-sm text-slate-500">
                <Wallet className="h-4 w-4" />
                <span>账户可用余额</span>
              </div>
              {walletLoading ? (
                <Skeleton className="mt-2 h-12 w-48" />
              ) : (
                <div className="mt-2 flex items-baseline gap-2">
                  <span
                    className="tnum text-[40px] font-bold"
                    style={{ color: '#2563EB' }}
                  >
                    {formatMoneyCents(wallet?.balanceCents ?? 0)}
                  </span>
                </div>
              )}
              <div className="mt-3 flex gap-6 text-sm">
                <div className="flex items-center gap-1.5">
                  <span className="text-slate-400">冻结金额：</span>
                  <span className="tnum font-medium text-slate-600">
                    {formatMoneyCents(wallet?.frozenCents ?? 0)}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-slate-400">累计充值：</span>
                  <span className="tnum font-medium text-[#16A34A]">
                    {formatMoneyCents(wallet?.totalRechargedCents ?? 0)}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-slate-400">累计消费：</span>
                  <span className="tnum font-medium text-[#DC2626]">
                    {formatMoneyCents(wallet?.totalSpentCents ?? 0)}
                  </span>
                </div>
              </div>
            </div>

            {isClient && (
              <Button
                className="bg-[#2563EB] hover:bg-[#2563EB]"
                onClick={() => setRechargeDialogOpen(true)}
              >
                <Plus className="mr-2 h-4 w-4" />
                申请充值
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* 流水记录 */}
      <div className="rounded-xl border border-[#E6EAF2] bg-white">
        <Tabs value={txTab} onValueChange={(v) => {
          setTxTab(v as 'recharge' | 'consume');
          setTxPage(1);
          setRechargePage(1);
        }}>
          <div className="border-b border-[#E6EAF2] px-6 pt-4">
            <TabsList className="h-10 gap-6 bg-transparent p-0">
              <TabsTrigger
                value="recharge"
                className="relative h-10 rounded-none border-b-2 border-transparent bg-transparent px-1 text-sm font-medium text-slate-500 data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=active]:shadow-none"
              >
                <CreditCard className="mr-2 h-4 w-4" />
                充值记录
              </TabsTrigger>
              <TabsTrigger
                value="consume"
                className="relative h-10 rounded-none border-b-2 border-transparent bg-transparent px-1 text-sm font-medium text-slate-500 data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=active]:shadow-none"
              >
                <TrendingDown className="mr-2 h-4 w-4" />
                消费流水
              </TabsTrigger>
            </TabsList>
          </div>

          <div className="p-6 pt-4">
            {/* 充值记录 Tab */}
            <TabsContent value="recharge" className="mt-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader style={{ backgroundColor: '#F7F9FC' }}>
                    <TableRow className="h-11">
                      <TableHead className="min-w-[180px] font-medium">申请时间</TableHead>
                      <TableHead className="min-w-[120px] text-right font-medium tnum">申请金额</TableHead>
                      <TableHead className="min-w-[120px] text-right font-medium tnum">实际到账</TableHead>
                      <TableHead className="min-w-[100px] font-medium">状态</TableHead>
                      <TableHead className="min-w-[160px] font-medium">备注</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rechargeLoading
                      ? Array.from({ length: 5 }).map((_, i) => (
                          <TableRow key={i} className="h-11">
                            {Array.from({ length: 5 }).map((_, j) => (
                              <TableCell key={j}>
                                <Skeleton className="h-4 w-20" />
                              </TableCell>
                            ))}
                          </TableRow>
                        ))
                      : !rechargeData?.items.length
                      ? (
                        <TableRow>
                          <TableCell colSpan={5} className="py-12 text-center text-slate-400">
                            暂无充值记录
                          </TableCell>
                        </TableRow>
                      )
                      : rechargeData.items.map((app) => (
                          <TableRow key={app.id} className="h-11">
                            <TableCell className="text-slate-600 text-[13px]">
                              {app.createdAt}
                            </TableCell>
                            <TableCell className="text-right tnum font-medium text-[#16A34A]">
                              +{formatMoneyCentsRaw(app.applyAmountCents)}
                            </TableCell>
                            <TableCell className="text-right tnum text-slate-600">
                              {app.actualAmountCents
                                ? formatMoneyCentsRaw(app.actualAmountCents)
                                : '-'}
                            </TableCell>
                            <TableCell>
                              <Badge
                                className={
                                  app.status === 'approved'
                                    ? 'bg-[#16A34A]/10 text-[#16A34A] border-none'
                                    : app.status === 'rejected'
                                    ? 'bg-[#DC2626]/10 text-[#DC2626] border-none'
                                    : 'bg-[#F59E0B]/10 text-[#F59E0B] border-none'
                                }
                              >
                                {RECHARGE_STATUS_LABELS[app.status]}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-slate-500 text-[13px]">
                              {app.rejectReason || app.remark || '-'}
                            </TableCell>
                          </TableRow>
                        ))}
                  </TableBody>
                </Table>
              </div>

              {rechargeTotalPages > 1 && (
                <div className="mt-4 flex justify-end">
                  <Pagination>
                    <PaginationContent>
                      <PaginationItem>
                        <PaginationPrevious
                          href="#"
                          onClick={(e) => {
                            e.preventDefault();
                            if (rechargePage > 1) setRechargePage(rechargePage - 1);
                          }}
                          className={rechargePage <= 1 ? 'pointer-events-none opacity-50' : ''}
                        />
                      </PaginationItem>
                      {Array.from({ length: Math.min(rechargeTotalPages, 5) }, (_, i) => {
                        const start = Math.max(1, Math.min(rechargePage - 2, rechargeTotalPages - 4));
                        const p = start + i;
                        if (p > rechargeTotalPages) return null;
                        return (
                          <PaginationItem key={p}>
                            <PaginationLink
                              href="#"
                              onClick={(e) => {
                                e.preventDefault();
                                setRechargePage(p);
                              }}
                              isActive={p === rechargePage}
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
                            if (rechargePage < rechargeTotalPages) setRechargePage(rechargePage + 1);
                          }}
                          className={rechargePage >= rechargeTotalPages ? 'pointer-events-none opacity-50' : ''}
                        />
                      </PaginationItem>
                    </PaginationContent>
                  </Pagination>
                </div>
              )}
            </TabsContent>

            {/* 消费流水 Tab */}
            <TabsContent value="consume" className="mt-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader style={{ backgroundColor: '#F7F9FC' }}>
                    <TableRow className="h-11">
                      <TableHead className="min-w-[180px] font-medium">时间</TableHead>
                      <TableHead className="min-w-[100px] font-medium">类型</TableHead>
                      <TableHead className="min-w-[120px] text-right font-medium tnum">金额</TableHead>
                      <TableHead className="min-w-[120px] text-right font-medium tnum">余额</TableHead>
                      <TableHead className="min-w-[160px] font-medium">关联订单</TableHead>
                      <TableHead className="min-w-[160px] font-medium">备注</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {txLoading
                      ? Array.from({ length: 5 }).map((_, i) => (
                          <TableRow key={i} className="h-11">
                            {Array.from({ length: 6 }).map((_, j) => (
                              <TableCell key={j}>
                                <Skeleton className="h-4 w-20" />
                              </TableCell>
                            ))}
                          </TableRow>
                        ))
                      : !txData?.items.length
                      ? (
                        <TableRow>
                          <TableCell colSpan={6} className="py-12 text-center text-slate-400">
                            暂无流水记录
                          </TableCell>
                        </TableRow>
                      )
                       : txData?.items.map((tx) => (
                          <TableRow key={tx.id} className="h-11">
                            <TableCell className="text-slate-600 text-[13px]">
                              {tx.createdAt}
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant="outline"
                                className="border-[#E6EAF2] text-[12px] font-normal text-slate-600"
                              >
                                {WALLET_TX_TYPE_LABELS[tx.type]}
                              </Badge>
                            </TableCell>
                            <TableCell className={`text-right tnum font-medium ${txTypeColor(tx.type)}`}>
                              {isPositive(tx.type) ? '+' : '-'}
                              {formatMoneyCentsRaw(tx.amountCents)}
                            </TableCell>
                            <TableCell className="text-right tnum text-slate-600">
                              {formatMoneyCentsRaw(tx.balanceAfterCents)}
                            </TableCell>
                            <TableCell className="font-mono text-xs text-slate-500">
                              {tx.orderNo || '-'}
                            </TableCell>
                            <TableCell className="text-slate-500 text-[13px]">
                              {tx.note || '-'}
                            </TableCell>
                          </TableRow>
                        ))}
                  </TableBody>
                </Table>
              </div>

              {txTotalPages > 1 && (
                <div className="mt-4 flex justify-end">
                  <Pagination>
                    <PaginationContent>
                      <PaginationItem>
                        <PaginationPrevious
                          href="#"
                          onClick={(e) => {
                            e.preventDefault();
                            if (txPage > 1) setTxPage(txPage - 1);
                          }}
                          className={txPage <= 1 ? 'pointer-events-none opacity-50' : ''}
                        />
                      </PaginationItem>
                      {Array.from({ length: Math.min(txTotalPages, 5) }, (_, i) => {
                        const start = Math.max(1, Math.min(txPage - 2, txTotalPages - 4));
                        const p = start + i;
                        if (p > txTotalPages) return null;
                        return (
                          <PaginationItem key={p}>
                            <PaginationLink
                              href="#"
                              onClick={(e) => {
                                e.preventDefault();
                                setTxPage(p);
                              }}
                              isActive={p === txPage}
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
                            if (txPage < txTotalPages) setTxPage(txPage + 1);
                          }}
                          className={txPage >= txTotalPages ? 'pointer-events-none opacity-50' : ''}
                        />
                      </PaginationItem>
                    </PaginationContent>
                  </Pagination>
                </div>
              )}
            </TabsContent>
          </div>
        </Tabs>
      </div>

      {/* 充值弹窗 */}
      <Dialog open={rechargeDialogOpen} onOpenChange={closeRechargeDialog}>
        <DialogContent className="max-w-[480px]">
          <DialogHeader>
            <DialogTitle>
              {applyResult ? '申请已提交' : '申请充值'}
            </DialogTitle>
            <DialogDescription>
              {applyResult
                ? '已提交，等待服务商审核。审核通过后余额将自动到账'
                : '输入充值金额并提交申请'}
            </DialogDescription>
          </DialogHeader>

          {!applyResult ? (
            <div className="space-y-4 py-2">
              <div>
                <label className="mb-2 block text-sm font-medium text-[#0f172a]">
                  充值金额（元）
                </label>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setRechargeAmount('1000')}
                    className={rechargeAmount === '1000' ? 'border-[#2563EB] text-[#2563EB]' : ''}
                  >
                    ¥1,000
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setRechargeAmount('5000')}
                    className={rechargeAmount === '5000' ? 'border-[#2563EB] text-[#2563EB]' : ''}
                  >
                    ¥5,000
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setRechargeAmount('10000')}
                    className={rechargeAmount === '10000' ? 'border-[#2563EB] text-[#2563EB]' : ''}
                  >
                    ¥10,000
                  </Button>
                </div>
                <div className="mt-3 relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">¥</span>
                  <Input
                    type="number"
                    step="100"
                    min={100}
                    value={rechargeAmount}
                    onChange={(e) => setRechargeAmount(e.target.value)}
                    className="pl-7 tnum text-lg"
                  />
                </div>
                <p className="mt-2 text-[12px] text-slate-400">
                  最低充值 1,000 元，步进 100 元
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-4 py-2">
              <div className="rounded-lg bg-[#16A34A]/10 p-4 text-center">
                <p className="text-sm text-[#16A34A]">申请金额</p>
                <p className="mt-1 tnum text-3xl font-bold text-[#16A34A]">
                  {formatMoneyCents(applyResult.amount)}
                </p>
              </div>
              <div className="rounded-lg bg-[#EFF6FF] p-3 text-xs text-[#1D4ED8]">
                <p className="font-medium">已提交，等待服务商审核</p>
                <p className="mt-1">审核通过后余额将自动到账，您可在充值记录中查看状态。</p>
                <p className="mt-1 font-mono font-semibold">申请单号：{applyResult.applicationId}</p>
              </div>
            </div>
          )}

          <DialogFooter>
            {!applyResult ? (
              <>
                <Button variant="outline" onClick={closeRechargeDialog}>
                  取消
                </Button>
                <Button
                  className="bg-[#2563EB] hover:bg-[#2563EB]"
                  onClick={handleApplyRecharge}
                  disabled={
                    applyRecharge.isPending ||
                    parseFloat(rechargeAmount) < 100 ||
                    isNaN(parseFloat(rechargeAmount))
                  }
                >
                  {applyRecharge.isPending ? '提交中...' : '提交申请'}
                </Button>
              </>
            ) : (
              <Button
                className="w-full bg-[#2563EB] hover:bg-[#2563EB]"
                onClick={closeRechargeDialog}
              >
                知道了
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default WalletPage;
