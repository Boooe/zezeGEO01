import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Plus,
  Clock,
  DollarSign,
  Calendar,
  User,
  Phone,
  Package,
  FileText,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';
import { logger } from '@lark-apaas/client-toolkit/logger';
import { toast } from 'sonner';

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@client/src/components/ui/sheet';
import { Button } from '@client/src/components/ui/button';
import { Badge } from '@client/src/components/ui/badge';
import { Skeleton } from '@client/src/components/ui/skeleton';
import { Separator } from '@client/src/components/ui/separator';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@client/src/components/ui/dialog';
import { Input } from '@client/src/components/ui/input';
import { Label } from '@client/src/components/ui/label';
import { Textarea } from '@client/src/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@client/src/components/ui/select';
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@client/src/components/ui/empty';
import {
  getContractDetail,
  createPayment,
  type CreatePaymentPayload,
} from '@client/src/api/contracts';
import {
  PACKAGE_TYPE_LABELS,
  PAYMENT_STATUS_LABELS,
  type Contract,
  type Payment,
  type PaymentStatus,
} from '@shared/api.interface';

const PRIMARY = '#1e40af';
const ACCENT = '#f97316';
const SUCCESS = '#10b981';
const DANGER = '#ef4444';
const MUTED = '#64748b';

const PAYMENT_METHODS = [
  { value: 'bank_transfer', label: '银行转账' },
  { value: 'wechat', label: '微信' },
  { value: 'alipay', label: '支付宝' },
  { value: 'cash', label: '现金' },
];

const getStatusColor = (status: PaymentStatus): string => {
  switch (status) {
    case 'unpaid':
      return DANGER;
    case 'partial':
      return ACCENT;
    case 'paid':
      return SUCCESS;
    default:
      return MUTED;
  }
};

const getRemainingDaysColor = (days: number | null): string => {
  if (days === null) return MUTED;
  if (days <= 0) return DANGER;
  if (days <= 30) return ACCENT;
  return MUTED;
};

const formatDate = (dateStr: string | null): string => {
  if (!dateStr) return '-';
  return dateStr.slice(0, 10);
};

const formatAmount = (amount: number): string => {
  return `¥${amount.toLocaleString('zh-CN')}`;
};

const getMethodLabel = (method: string | null): string => {
  if (!method) return '-';
  const found = PAYMENT_METHODS.find((m) => m.value === method);
  return found?.label ?? method;
};

interface ContractDetailSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contractId: string | null;
}

const ContractDetailSheet: React.FC<ContractDetailSheetProps> = ({
  open,
  onOpenChange,
  contractId,
}) => {
  const queryClient = useQueryClient();
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [formData, setFormData] = useState<CreatePaymentPayload>({
    amount: 0,
    paymentDate: new Date().toISOString().slice(0, 10),
    paymentMethod: 'bank_transfer',
    remark: '',
  });

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['contractDetail', contractId],
    queryFn: () => getContractDetail(contractId!),
    enabled: open && !!contractId,
  });

  const createPaymentMutation = useMutation({
    mutationFn: (payload: CreatePaymentPayload) =>
      createPayment(contractId!, payload),
    retry: false,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contractDetail'] });
      queryClient.invalidateQueries({ queryKey: ['contracts'] });
      toast.success('收款记录添加成功');
      setPaymentDialogOpen(false);
      setFormData({
        amount: 0,
        paymentDate: new Date().toISOString().slice(0, 10),
        paymentMethod: 'bank_transfer',
        remark: '',
      });
    },
    onError: (err) => {
      logger.error('添加收款记录失败', err);
      toast.error('添加失败，请重试');
    },
  });

  const contract = data?.contract;
  const payments = data?.payments ?? [];

  const totalPaid = payments.reduce((sum: number, p: Payment) => sum + (p.amount || 0), 0);

  const handleSubmitPayment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.amount || formData.amount <= 0) {
      toast.error('请输入有效金额');
      return;
    }
    createPaymentMutation.mutate(formData);
  };

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader className="px-0">
            <SheetTitle className="text-lg">合同详情</SheetTitle>
          </SheetHeader>

          {isLoading && <DetailSkeleton />}

          {isError && (
            <div className="flex items-center justify-between rounded-lg border border-red-200 bg-red-50 p-4">
              <div className="flex items-center gap-2 text-sm" style={{ color: DANGER }}>
                <AlertCircle className="h-4 w-4" />
                <span>加载失败</span>
              </div>
              <button
                onClick={() => refetch()}
                className="flex items-center gap-1 text-xs font-medium"
                style={{ color: DANGER }}
              >
                <RefreshCw className="h-3.5 w-3.5" />
                重试
              </button>
            </div>
          )}

          {!isLoading && !isError && contract && (
            <div className="space-y-6 pb-6">
              {/* 顶部信息 */}
              <div>
                <h2 className="text-xl font-semibold text-slate-800">
                  {contract.customerName}
                </h2>
                <div className="mt-2 flex items-center gap-2">
                  <Badge
                    variant="outline"
                    style={{
                      borderColor: 'transparent',
                      backgroundColor: `${getStatusColor(contract.paymentStatus)}15`,
                      color: getStatusColor(contract.paymentStatus),
                    }}
                  >
                    {PAYMENT_STATUS_LABELS[contract.paymentStatus]}
                  </Badge>
                  <span
                    className="text-xs font-medium"
                    style={{ color: getRemainingDaysColor(contract.remainingDays) }}
                  >
                    {contract.remainingDays === null
                      ? '-'
                      : contract.remainingDays <= 0
                        ? `已逾期 ${Math.abs(contract.remainingDays)} 天`
                        : `剩余 ${contract.remainingDays} 天`}
                  </span>
                </div>
              </div>

              <Separator />

              {/* 基本信息 */}
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-slate-700">基本信息</h3>
                <InfoRow
                  icon={<Package className="h-4 w-4" style={{ color: PRIMARY }} />}
                  label="套餐"
                  value={PACKAGE_TYPE_LABELS[contract.packageType]}
                />
                <InfoRow
                  icon={<DollarSign className="h-4 w-4" style={{ color: SUCCESS }} />}
                  label="合同金额"
                  value={formatAmount(contract.contractAmount)}
                />
                <InfoRow
                  icon={<Calendar className="h-4 w-4" style={{ color: MUTED }} />}
                  label="签约日期"
                  value={formatDate(contract.signDate)}
                />
                <InfoRow
                  icon={<Clock className="h-4 w-4" style={{ color: ACCENT }} />}
                  label="服务期"
                  value={`${formatDate(contract.serviceStart)} ~ ${formatDate(contract.serviceEnd)}`}
                />
                <InfoRow
                  icon={<User className="h-4 w-4" style={{ color: MUTED }} />}
                  label="联系人"
                  value={contract.contactPerson || '-'}
                />
                <InfoRow
                  icon={<Phone className="h-4 w-4" style={{ color: MUTED }} />}
                  label="联系电话"
                  value={contract.contactPhone || '-'}
                />
                <InfoRow
                  icon={<FileText className="h-4 w-4" style={{ color: MUTED }} />}
                  label="行业"
                  value={contract.industry || '-'}
                />
                {contract.remark && (
                  <div className="rounded-md bg-slate-50 p-3">
                    <p className="text-xs text-muted-foreground">备注</p>
                    <p className="mt-1 text-sm text-slate-700">{contract.remark}</p>
                  </div>
                )}
              </div>

              <Separator />

              {/* 收款记录 */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-slate-700">
                    收款记录
                    <span className="ml-2 text-xs font-normal text-muted-foreground">
                      已收 {formatAmount(totalPaid)} / {formatAmount(contract.contractAmount)}
                    </span>
                  </h3>
                  <Button
                    size="sm"
                    onClick={() => setPaymentDialogOpen(true)}
                    style={{ backgroundColor: PRIMARY }}
                  >
                    <Plus className="h-3.5 w-3.5" />
                    新增收款
                  </Button>
                </div>

                {payments.length === 0 ? (
                  <Empty>
                    <EmptyHeader>
                      <EmptyMedia variant="icon">
                        <DollarSign className="h-5 w-5" />
                      </EmptyMedia>
                      <EmptyTitle>暂无收款记录</EmptyTitle>
                    </EmptyHeader>
                    <EmptyContent>
                      <EmptyDescription>
                        点击右上角「新增收款」添加
                      </EmptyDescription>
                    </EmptyContent>
                  </Empty>
                ) : (
                  <div className="space-y-2">
                    {payments.map((payment: Payment) => (
                      <div
                        key={payment.id}
                        className="flex items-center justify-between rounded-md border border-slate-100 bg-white p-3"
                      >
                        <div>
                          <p className="font-medium text-slate-800">
                            {formatAmount(payment.amount)}
                          </p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {formatDate(payment.paymentDate)} · {getMethodLabel(payment.paymentMethod)}
                          </p>
                          {payment.remark && (
                            <p className="mt-1 text-xs text-slate-500">{payment.remark}</p>
                          )}
                        </div>
                        <Badge
                          variant="outline"
                          style={{
                            borderColor: 'transparent',
                            backgroundColor: 'rgba(16, 185, 129, 0.1)',
                            color: SUCCESS,
                          }}
                        >
                          已到账
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* 新增收款弹窗 */}
      <Dialog open={paymentDialogOpen} onOpenChange={setPaymentDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>新增收款记录</DialogTitle>
            <DialogDescription>
              为「{contract?.customerName ?? ''}」添加一笔收款
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmitPayment} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="payment-amount">收款金额 <span className="text-red-500">*</span></Label>
              <Input
                id="payment-amount"
                type="number"
                min="0"
                step="0.01"
                value={formData.amount || ''}
                onChange={(e) =>
                  setFormData({ ...formData, amount: Number(e.target.value) })
                }
                placeholder="请输入收款金额"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="payment-date">收款日期</Label>
              <Input
                id="payment-date"
                type="date"
                value={formData.paymentDate || ''}
                onChange={(e) =>
                  setFormData({ ...formData, paymentDate: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="payment-method">收款方式</Label>
              <Select
                value={formData.paymentMethod || ''}
                onValueChange={(value) =>
                  setFormData({ ...formData, paymentMethod: value })
                }
              >
                <SelectTrigger id="payment-method">
                  <SelectValue placeholder="请选择收款方式" />
                </SelectTrigger>
                <SelectContent>
                  {PAYMENT_METHODS.map((m) => (
                    <SelectItem key={m.value} value={m.value}>
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="payment-remark">备注</Label>
              <Textarea
                id="payment-remark"
                value={formData.remark || ''}
                onChange={(e) =>
                  setFormData({ ...formData, remark: e.target.value })
                }
                placeholder="选填，备注信息"
                rows={3}
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setPaymentDialogOpen(false)}
              >
                取消
              </Button>
              <Button
                type="submit"
                disabled={createPaymentMutation.isPending}
                style={{ backgroundColor: PRIMARY }}
              >
                {createPaymentMutation.isPending ? '提交中...' : '确认提交'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
};

const InfoRow: React.FC<{
  icon: React.ReactNode;
  label: string;
  value: string;
}> = ({ icon, label, value }) => (
  <div className="flex items-center gap-3">
    <div className="flex h-8 w-8 items-center justify-center rounded-md bg-slate-50">
      {icon}
    </div>
    <div className="flex-1">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm text-slate-700">{value}</p>
    </div>
  </div>
);

const DetailSkeleton = () => (
  <div className="space-y-6">
    <div className="space-y-2">
      <Skeleton className="h-6 w-40" />
      <Skeleton className="h-5 w-24" />
    </div>
    <Separator />
    <div className="space-y-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3">
          <Skeleton className="h-8 w-8 rounded-md" />
          <div className="flex-1 space-y-1">
            <Skeleton className="h-3 w-12" />
            <Skeleton className="h-4 w-32" />
          </div>
        </div>
      ))}
    </div>
    <Separator />
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-8 w-20" />
      </div>
      <div className="space-y-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-16 w-full rounded-md" />
        ))}
      </div>
    </div>
  </div>
);

export default ContractDetailSheet;
