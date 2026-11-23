import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Package,
  Wallet,
  Plus,
  Pencil,
  Trash2,
  CreditCard,
  Zap,
} from 'lucide-react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@client/src/components/ui/card';
import { Button } from '@client/src/components/ui/button';
import { Input } from '@client/src/components/ui/input';
import { Label } from '@client/src/components/ui/label';
import { Badge } from '@client/src/components/ui/badge';
import { Switch } from '@client/src/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from '@client/src/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@client/src/components/ui/select';
import { Skeleton } from '@client/src/components/ui/skeleton';
import {
  listCreditPlans,
  createCreditPlan,
  updateCreditPlan,
  deleteCreditPlan,
  listCreditAccounts,
  rechargeCredit,
  activatePlan,
} from '@client/src/api/creation';
import type {
  CreditPlan,
  CreditAccountDetail,
} from '@shared/api.interface';

const PRIMARY = '#1e40af';
const SUCCESS = '#10b981';
const DANGER = '#ef4444';
const ACCENT = '#f97316';

/* ---------------- 套餐表单弹窗 ---------------- */

interface PlanFormValues {
  planName: string;
  planCode: string;
  price: string;
  creditAmount: string;
  description: string;
  sortOrder: string;
  isActive: boolean;
}

interface PlanDialogProps {
  mode: 'create' | 'edit';
  initial?: CreditPlan | null;
  isLoading: boolean;
  onSubmit: (values: PlanFormValues) => void;
  onOpenChange?: (open: boolean) => void;
  trigger?: React.ReactNode;
  open?: boolean;
}

const defaultPlanValues: PlanFormValues = {
  planName: '',
  planCode: '',
  price: '',
  creditAmount: '',
  description: '',
  sortOrder: '0',
  isActive: true,
};

const PlanDialog: React.FC<PlanDialogProps> = ({
  mode,
  initial,
  isLoading,
  onSubmit,
  trigger,
  open,
  onOpenChange,
}) => {
  const [values, setValues] = useState<PlanFormValues>(
    initial
      ? {
          planName: initial.planName,
          planCode: initial.planCode,
          price: String(initial.price),
          creditAmount: String(initial.creditAmount),
          description: initial.description ?? '',
          sortOrder: String(initial.sortOrder),
          isActive: initial.isActive,
        }
      : defaultPlanValues,
  );

  const handleChange = (field: keyof PlanFormValues, value: string | boolean) => {
    setValues((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = () => {
    if (!values.planName.trim()) return toast.error('请输入套餐名');
    if (!values.planCode.trim()) return toast.error('请输入套餐编码');
    if (!values.price || Number(values.price) < 0) return toast.error('请输入有效价格');
    if (!values.creditAmount || Number(values.creditAmount) <= 0)
      return toast.error('请输入有效算力额度');
    onSubmit(values);
    if (mode === 'create') setValues(defaultPlanValues);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>{mode === 'create' ? '新增套餐' : '编辑套餐'}</DialogTitle>
          <DialogDescription>
            {mode === 'create' ? '创建新的算力套餐' : '修改套餐信息'}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">套餐名 *</Label>
              <Input
                value={values.planName}
                onChange={(e) => handleChange('planName', e.target.value)}
                placeholder="如：标准版"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">套餐编码 *</Label>
              <Input
                value={values.planCode}
                onChange={(e) => handleChange('planCode', e.target.value)}
                placeholder="如：standard"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">价格（元）*</Label>
              <Input
                type="number"
                value={values.price}
                onChange={(e) => handleChange('price', e.target.value)}
                placeholder="0.00"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">算力额度 *</Label>
              <Input
                type="number"
                value={values.creditAmount}
                onChange={(e) => handleChange('creditAmount', e.target.value)}
                placeholder="1000"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">描述</Label>
            <Input
              value={values.description}
              onChange={(e) => handleChange('description', e.target.value)}
              placeholder="套餐描述信息"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">排序</Label>
              <Input
                type="number"
                value={values.sortOrder}
                onChange={(e) => handleChange('sortOrder', e.target.value)}
                placeholder="0"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">是否启用</Label>
              <div className="flex items-center h-9">
                <Switch
                  checked={values.isActive}
                  onCheckedChange={(checked) => handleChange('isActive', checked)}
                />
                <span className="ml-2 text-sm text-slate-700">
                  {values.isActive ? '启用' : '停用'}
                </span>
              </div>
            </div>
          </div>
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">取消</Button>
          </DialogClose>
          <Button
            style={{ backgroundColor: PRIMARY, borderColor: PRIMARY }}
            onClick={handleSubmit}
            disabled={isLoading}
          >
            {isLoading ? '保存中...' : '确认'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

/* ---------------- 套餐表格骨架 ---------------- */

function PlanTableSkeleton() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 py-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-12" />
          <Skeleton className="h-5 w-12 rounded-full" />
          <div className="ml-auto flex gap-1">
            <Skeleton className="h-7 w-7 rounded-md" />
            <Skeleton className="h-7 w-7 rounded-md" />
          </div>
        </div>
      ))}
    </div>
  );
}

/* ---------------- 账户表格骨架 ---------------- */

function AccountTableSkeleton() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 py-2">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-16" />
          <div className="ml-auto flex gap-1">
            <Skeleton className="h-7 w-14 rounded-md" />
            <Skeleton className="h-7 w-16 rounded-md" />
          </div>
        </div>
      ))}
    </div>
  );
}

/* ---------------- 充值弹窗 ---------------- */

interface RechargeDialogProps {
  account: CreditAccountDetail | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (values: { amount: number; paymentAmount?: number; remark?: string }) => void;
  isLoading: boolean;
}

const RechargeDialog: React.FC<RechargeDialogProps> = ({
  account,
  open,
  onOpenChange,
  onSubmit,
  isLoading,
}) => {
  const [amount, setAmount] = useState('');
  const [paymentAmount, setPaymentAmount] = useState('');
  const [remark, setRemark] = useState('');

  const handleSubmit = () => {
    const num = Number(amount);
    if (!amount || num <= 0) return toast.error('请输入有效算力数量');
    onSubmit({
      amount: num,
      paymentAmount: paymentAmount ? Number(paymentAmount) : undefined,
      remark: remark || undefined,
    });
    setAmount('');
    setPaymentAmount('');
    setRemark('');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" style={{ color: PRIMARY }} />
            手工充值
          </DialogTitle>
          <DialogDescription>
            为品牌 <span className="font-medium text-slate-800">{account?.brandName}</span> 充值算力
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">算力数量 *</Label>
            <Input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="请输入充值算力数量"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">收款金额（元，可选）</Label>
            <Input
              type="number"
              value={paymentAmount}
              onChange={(e) => setPaymentAmount(e.target.value)}
              placeholder="请输入收款金额"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">备注（可选）</Label>
            <Input
              value={remark}
              onChange={(e) => setRemark(e.target.value)}
              placeholder="充值备注"
            />
          </div>
          {account && (
            <div
              className="rounded-md p-3 text-xs"
              style={{ backgroundColor: 'rgba(30, 64, 175, 0.06)', color: PRIMARY }}
            >
              当前余额：<span className="font-semibold">{account.balance.toLocaleString()}</span> 算力
            </div>
          )}
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">取消</Button>
          </DialogClose>
          <Button
            style={{ backgroundColor: PRIMARY, borderColor: PRIMARY }}
            onClick={handleSubmit}
            disabled={isLoading}
          >
            {isLoading ? '充值中...' : '确认充值'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

/* ---------------- 激活套餐弹窗 ---------------- */

interface ActivatePlanDialogProps {
  account: CreditAccountDetail | null;
  plans: CreditPlan[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (planId: string) => void;
  isLoading: boolean;
}

const ActivatePlanDialog: React.FC<ActivatePlanDialogProps> = ({
  account,
  plans,
  open,
  onOpenChange,
  onSubmit,
  isLoading,
}) => {
  const [selectedPlanId, setSelectedPlanId] = useState('');

  const handleSubmit = () => {
    if (!selectedPlanId) return toast.error('请选择套餐');
    onSubmit(selectedPlanId);
    setSelectedPlanId('');
  };

  const selectedPlan = plans.find((p) => p.id === selectedPlanId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5" style={{ color: ACCENT }} />
            激活套餐
          </DialogTitle>
          <DialogDescription>
            为品牌 <span className="font-medium text-slate-800">{account?.brandName}</span> 激活算力套餐
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">选择套餐 *</Label>
            <Select value={selectedPlanId} onValueChange={setSelectedPlanId}>
              <SelectTrigger>
                <SelectValue placeholder="请选择套餐" />
              </SelectTrigger>
              <SelectContent>
                {plans.filter((p) => p.isActive).map((plan) => (
                  <SelectItem key={plan.id} value={plan.id}>
                    {plan.planName} - {plan.creditAmount.toLocaleString()} 算力 / ¥{plan.price}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {selectedPlan && (
            <div className="rounded-md border border-slate-200 p-3 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">套餐名</span>
                <span className="font-medium">{selectedPlan.planName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">算力额度</span>
                <span className="font-medium">{selectedPlan.creditAmount.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">价格</span>
                <span className="font-medium">¥{selectedPlan.price}</span>
              </div>
              {selectedPlan.description && (
                <div className="pt-2 border-t border-slate-100 text-xs text-muted-foreground">
                  {selectedPlan.description}
                </div>
              )}
            </div>
          )}
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">取消</Button>
          </DialogClose>
          <Button
            style={{ backgroundColor: ACCENT, borderColor: ACCENT }}
            onClick={handleSubmit}
            disabled={isLoading || !selectedPlanId}
          >
            {isLoading ? '激活中...' : '确认激活'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

/* ---------------- 主组件 ---------------- */

const CreditManagementTab: React.FC = () => {
  const queryClient = useQueryClient();

  // 套餐相关
  const [planDialogOpen, setPlanDialogOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<CreditPlan | null>(null);
  const [deletePlanId, setDeletePlanId] = useState<string | null>(null);

  // 账户相关
  const [rechargeAccount, setRechargeAccount] = useState<CreditAccountDetail | null>(null);
  const [rechargeOpen, setRechargeOpen] = useState(false);
  const [activateAccount, setActivateAccount] = useState<CreditAccountDetail | null>(null);
  const [activateOpen, setActivateOpen] = useState(false);

  // Queries
  const { data: plans, isLoading: plansLoading } = useQuery({
    queryKey: ['credit', 'plans'],
    queryFn: listCreditPlans,
  });

  const { data: accounts, isLoading: accountsLoading } = useQuery({
    queryKey: ['credit', 'accounts'],
    queryFn: () => listCreditAccounts({ pageSize: 100 }),
  });

  // Mutations
  const createPlanMutation = useMutation({
    mutationFn: createCreditPlan,
    retry: false,
    onSuccess: () => {
      toast.success('套餐创建成功');
      setPlanDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ['credit', 'plans'] });
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.error?.message ?? '创建失败，请重试';
      toast.error(msg);
    },
  });

  const updatePlanMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Parameters<typeof updateCreditPlan>[1] }) =>
      updateCreditPlan(id, body),
    retry: false,
    onSuccess: () => {
      toast.success('套餐更新成功');
      setPlanDialogOpen(false);
      setEditingPlan(null);
      queryClient.invalidateQueries({ queryKey: ['credit', 'plans'] });
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.error?.message ?? '更新失败，请重试';
      toast.error(msg);
    },
  });

  const deletePlanMutation = useMutation({
    mutationFn: deleteCreditPlan,
    retry: false,
    onSuccess: () => {
      toast.success('套餐删除成功');
      setDeletePlanId(null);
      queryClient.invalidateQueries({ queryKey: ['credit', 'plans'] });
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.error?.message ?? '删除失败，请重试';
      toast.error(msg);
    },
  });

  const rechargeMutation = useMutation({
    mutationFn: rechargeCredit,
    retry: false,
    onSuccess: () => {
      toast.success('充值成功');
      setRechargeOpen(false);
      setRechargeAccount(null);
      queryClient.invalidateQueries({ queryKey: ['credit', 'accounts'] });
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.error?.message ?? '充值失败，请重试';
      toast.error(msg);
    },
  });

  const activatePlanMutation = useMutation({
    mutationFn: activatePlan,
    retry: false,
    onSuccess: () => {
      toast.success('套餐激活成功');
      setActivateOpen(false);
      setActivateAccount(null);
      queryClient.invalidateQueries({ queryKey: ['credit', 'accounts'] });
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.error?.message ?? '激活失败，请重试';
      toast.error(msg);
    },
  });

  const handleCreatePlan = (values: PlanFormValues) => {
    createPlanMutation.mutate({
      planName: values.planName.trim(),
      planCode: values.planCode.trim(),
      price: Number(values.price),
      creditAmount: Number(values.creditAmount),
      description: values.description.trim() || undefined,
      sortOrder: Number(values.sortOrder) || 0,
      isActive: values.isActive,
    });
  };

  const handleUpdatePlan = (values: PlanFormValues) => {
    if (!editingPlan) return;
    updatePlanMutation.mutate({
      id: editingPlan.id,
      body: {
        planName: values.planName.trim(),
        planCode: values.planCode.trim(),
        price: Number(values.price),
        creditAmount: Number(values.creditAmount),
        description: values.description.trim() || undefined,
        sortOrder: Number(values.sortOrder) || 0,
        isActive: values.isActive,
      },
    });
  };

  const handleEditPlan = (plan: CreditPlan) => {
    setEditingPlan(plan);
    setPlanDialogOpen(true);
  };

  const handlePlanDialogClose = (open: boolean) => {
    setPlanDialogOpen(open);
    if (!open) {
      setEditingPlan(null);
    }
  };

  const handleRecharge = (values: {
    amount: number;
    paymentAmount?: number;
    remark?: string;
  }) => {
    if (!rechargeAccount) return;
    rechargeMutation.mutate({
      brandId: rechargeAccount.brandId,
      amount: values.amount,
      paymentAmount: values.paymentAmount,
      remark: values.remark,
    });
  };

  const handleActivatePlan = (planId: string) => {
    if (!activateAccount) return;
    activatePlanMutation.mutate({
      brandId: activateAccount.brandId,
      planId,
    });
  };

  const sortedPlans = plans
    ? [...plans].sort((a, b) => a.sortOrder - b.sortOrder)
    : [];

  const accountItems = accounts?.items ?? [];

  return (
    <div className="space-y-6">
      {/* 套餐配置 */}
      <Card style={{ borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="font-semibold flex items-center gap-2">
              <Package className="h-4 w-4" style={{ color: PRIMARY }} />
              套餐配置
            </CardTitle>
            <CardDescription>
              管理算力套餐，品牌账户可激活套餐获得算力
            </CardDescription>
          </div>
          <PlanDialog
            mode="create"
            open={planDialogOpen && !editingPlan}
            onOpenChange={handlePlanDialogClose}
            isLoading={createPlanMutation.isPending}
            onSubmit={handleCreatePlan}
            trigger={
              <Button size="sm" style={{ backgroundColor: PRIMARY, borderColor: PRIMARY }}>
                <Plus className="h-3.5 w-3.5" />
                新增套餐
              </Button>
            }
          />
        </CardHeader>
        <CardContent>
          {plansLoading ? (
            <PlanTableSkeleton />
          ) : sortedPlans.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-muted-foreground">
                    <th className="pb-3 pr-4 font-medium">套餐名</th>
                    <th className="pb-3 pr-4 font-medium">价格（元）</th>
                    <th className="pb-3 pr-4 font-medium">算力额度</th>
                    <th className="pb-3 pr-4 font-medium">排序</th>
                    <th className="pb-3 pr-4 font-medium">状态</th>
                    <th className="pb-3 text-right font-medium">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedPlans.map((plan) => (
                    <tr
                      key={plan.id}
                      className="border-b border-slate-100"
                      style={{ height: 48 }}
                    >
                      <td className="pr-4">
                        <div className="font-medium text-slate-800">
                          {plan.planName}
                          <span className="ml-2 text-xs text-muted-foreground font-normal">
                            {plan.planCode}
                          </span>
                        </div>
                      </td>
                      <td className="pr-4 text-slate-700">¥{plan.price}</td>
                      <td className="pr-4 text-slate-700">
                        {plan.creditAmount.toLocaleString()}
                      </td>
                      <td className="pr-4 text-muted-foreground">{plan.sortOrder}</td>
                      <td className="pr-4">
                        <Badge
                          variant="secondary"
                          style={{
                            backgroundColor: plan.isActive
                              ? 'rgba(16, 185, 129, 0.1)'
                              : 'rgba(148, 163, 184, 0.15)',
                            color: plan.isActive ? SUCCESS : '#64748b',
                          }}
                        >
                          {plan.isActive ? '启用' : '停用'}
                        </Badge>
                      </td>
                      <td className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7"
                            onClick={() => handleEditPlan(plan)}
                            aria-label="编辑套餐"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Dialog
                            open={deletePlanId === plan.id}
                            onOpenChange={(open) =>
                              !open && setDeletePlanId(null)
                            }
                          >
                            <DialogTrigger asChild>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-7 w-7"
                                onClick={() => setDeletePlanId(plan.id)}
                                aria-label="删除套餐"
                              >
                                <Trash2
                                  className="h-3.5 w-3.5"
                                  style={{ color: DANGER }}
                                />
                              </Button>
                            </DialogTrigger>
                            <DialogContent>
                              <DialogHeader>
                                <DialogTitle>确认删除套餐</DialogTitle>
                                <DialogDescription>
                                  删除后无法恢复，请谨慎操作。
                                </DialogDescription>
                              </DialogHeader>
                              <div className="py-2">
                                <p className="text-sm">
                                  确定要删除套餐{' '}
                                  <span className="font-medium">
                                    {plan.planName}
                                  </span>{' '}
                                  吗？
                                </p>
                              </div>
                              <DialogFooter>
                                <DialogClose asChild>
                                  <Button variant="outline">取消</Button>
                                </DialogClose>
                                <Button
                                  variant="destructive"
                                  onClick={() =>
                                    deletePlanMutation.mutate(plan.id)
                                  }
                                  disabled={deletePlanMutation.isPending}
                                >
                                  {deletePlanMutation.isPending
                                    ? '删除中...'
                                    : '确认删除'}
                                </Button>
                              </DialogFooter>
                            </DialogContent>
                          </Dialog>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Package className="h-10 w-10 text-muted-foreground/40 mb-3" />
              <p className="text-sm text-muted-foreground">暂无套餐</p>
              <p className="text-xs text-muted-foreground mt-1">
                点击"新增套餐"创建第一个算力套餐
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 编辑套餐弹窗（独立于新增，因为编辑有 initial 数据） */}
      {editingPlan && (
        <PlanDialog
          mode="edit"
          initial={editingPlan}
          open={planDialogOpen && !!editingPlan}
          onOpenChange={handlePlanDialogClose}
          isLoading={updatePlanMutation.isPending}
          onSubmit={handleUpdatePlan}
        />
      )}

      {/* 品牌账户 */}
      <Card style={{ borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
        <CardHeader>
          <CardTitle className="font-semibold flex items-center gap-2">
            <Wallet className="h-4 w-4" style={{ color: PRIMARY }} />
            品牌账户
          </CardTitle>
          <CardDescription>
            查看各品牌算力账户余额，支持手工充值和套餐激活
          </CardDescription>
        </CardHeader>
        <CardContent>
          {accountsLoading ? (
            <AccountTableSkeleton />
          ) : accountItems.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-muted-foreground">
                    <th className="pb-3 pr-4 font-medium">品牌名</th>
                    <th className="pb-3 pr-4 font-medium">当前套餐</th>
                    <th className="pb-3 pr-4 font-medium">余额</th>
                    <th className="pb-3 pr-4 font-medium">总额度</th>
                    <th className="pb-3 pr-4 font-medium">已用比例</th>
                    <th className="pb-3 pr-4 font-medium">累计到账算力</th>
                    <th className="pb-3 text-right font-medium">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {accountItems.map((account) => {
                    const total = account.balance + account.totalUsed;
                    const usageRate = total > 0 ? (account.totalUsed / total) * 100 : 0;
                    return (
                      <tr
                        key={account.id}
                        className="border-b border-slate-100"
                        style={{ height: 48 }}
                      >
                        <td className="pr-4 font-medium text-slate-800">
                          {account.brandName}
                        </td>
                        <td className="pr-4">
                          {account.currentPlanName ? (
                            <Badge
                              variant="secondary"
                              style={{
                                backgroundColor: 'rgba(30, 64, 175, 0.1)',
                                color: PRIMARY,
                              }}
                            >
                              {account.currentPlanName}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground text-xs">
                              无套餐
                            </span>
                          )}
                        </td>
                        <td className="pr-4 font-medium" style={{ color: PRIMARY }}>
                          {account.balance.toLocaleString()}
                        </td>
                        <td className="pr-4 text-slate-700">
                          {total.toLocaleString()}
                        </td>
                        <td className="pr-4">
                          <div className="flex items-center gap-2">
                            <div className="w-24 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                              <div
                                className="h-full rounded-full"
                                style={{
                                  width: `${Math.min(usageRate, 100)}%`,
                                  backgroundColor: usageRate > 80 ? ACCENT : PRIMARY,
                                }}
                              />
                            </div>
                            <span className="text-xs text-muted-foreground w-10">
                              {usageRate.toFixed(1)}%
                            </span>
                          </div>
                        </td>
                        <td className="pr-4 text-slate-700">
                          {account.totalRecharged.toLocaleString()}
                        </td>
                        <td className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setRechargeAccount(account);
                                setRechargeOpen(true);
                              }}
                            >
                              <CreditCard className="h-3.5 w-3.5 mr-1" />
                              充值
                            </Button>
                            <Button
                              size="sm"
                              style={{
                                backgroundColor: ACCENT,
                                borderColor: ACCENT,
                              }}
                              onClick={() => {
                                setActivateAccount(account);
                                setActivateOpen(true);
                              }}
                            >
                              <Zap className="h-3.5 w-3.5 mr-1" />
                              激活套餐
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Wallet className="h-10 w-10 text-muted-foreground/40 mb-3" />
              <p className="text-sm text-muted-foreground">暂无品牌账户</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 充值弹窗 */}
      <RechargeDialog
        account={rechargeAccount}
        open={rechargeOpen}
        onOpenChange={setRechargeOpen}
        onSubmit={handleRecharge}
        isLoading={rechargeMutation.isPending}
      />

      {/* 激活套餐弹窗 */}
      <ActivatePlanDialog
        account={activateAccount}
        plans={sortedPlans}
        open={activateOpen}
        onOpenChange={setActivateOpen}
        onSubmit={handleActivatePlan}
        isLoading={activatePlanMutation.isPending}
      />
    </div>
  );
};

export default CreditManagementTab;
