import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { logger } from '@lark-apaas/client-toolkit/logger';
import { toast } from 'sonner';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@client/src/components/ui/dialog';
import { Button } from '@client/src/components/ui/button';
import { Input } from '@client/src/components/ui/input';
import { Label } from '@client/src/components/ui/label';
import { Textarea } from '@client/src/components/ui/textarea';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@client/src/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@client/src/components/ui/select';
import { useQuery } from '@tanstack/react-query';
import { getActivePlans, renewCustomer } from '@client/src/api/admin';
import type { PlanItem, RenewRequest } from '@shared/api.interface';

const PRIMARY = '#3B5BFF';
const MUTED = '#64748b';

interface RenewCustomerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  brandId: string | null;
  brandName: string | null;
  onSuccess: () => void;
}

const RenewCustomerDialog: React.FC<RenewCustomerDialogProps> = ({
  open,
  onOpenChange,
  brandId,
  brandName,
  onSuccess,
}) => {
  const queryClient = useQueryClient();

  const [tab, setTab] = useState<'plan' | 'custom'>('plan');
  const [planId, setPlanId] = useState('');
  const [customAmount, setCustomAmount] = useState(0);
  const [customCredit, setCustomCredit] = useState(0);
  const [customMonths, setCustomMonths] = useState(1);
  const [remark, setRemark] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const { data: plansData } = useQuery({
    queryKey: ['admin-active-plans'],
    queryFn: () => getActivePlans(),
    enabled: open,
  });

  const planOptions = plansData?.items ?? [];

  const selectedPlan = useMemo(
    () => planOptions.find((p: PlanItem) => p.id === planId) || null,
    [planId, planOptions],
  );

  useEffect(() => {
    if (open) {
      setTab('plan');
      setPlanId('');
      setCustomAmount(0);
      setCustomCredit(0);
      setCustomMonths(1);
      setRemark('');
      setErrors({});
    }
  }, [open, brandId]);

  const renewMutation = useMutation({
    mutationFn: ({
      brandId,
      body,
    }: {
      brandId: string;
      body: RenewRequest;
    }) => renewCustomer(brandId, body),
    retry: false,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      queryClient.invalidateQueries({ queryKey: ['customerDetail'] });
      toast.success('续费成功');
      onSuccess();
      onOpenChange(false);
    },
    onError: (err: unknown) => {
      logger.error('续费失败', err);
      const msg =
        (err as { response?: { data?: { error?: { message?: string } } } })
          .response?.data?.error?.message || '续费失败，请重试';
      toast.error(msg);
    },
  });

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (tab === 'plan') {
      if (!planId) newErrors.planId = '请选择套餐';
    } else {
      if (customAmount <= 0) newErrors.customAmount = '请输入续费金额';
      if (customCredit <= 0) newErrors.customCredit = '请输入算力数量';
      if (customMonths <= 0) newErrors.customMonths = '请输入延长月数';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = () => {
    if (!brandId) return;
    if (!validate()) return;

    const body: RenewRequest = {};

    if (tab === 'plan') {
      body.planId = planId;
    } else {
      body.customAmount = customAmount;
      body.customCredit = customCredit;
      body.customMonths = customMonths;
    }

    if (remark.trim()) {
      body.remark = remark.trim();
    }

    renewMutation.mutate({ brandId, body });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>客户续费</DialogTitle>
          <DialogDescription>
            为 <span className="font-medium text-slate-700">{brandName}</span> 办理续费
          </DialogDescription>
        </DialogHeader>

        <Tabs value={tab} onValueChange={(v: string) => setTab(v as 'plan' | 'custom')}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="plan">按套餐续费</TabsTrigger>
            <TabsTrigger value="custom">自定义续费</TabsTrigger>
          </TabsList>

          <TabsContent value="plan" className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label>
                选择套餐 <span className="text-red-500">*</span>
              </Label>
              <Select value={planId} onValueChange={setPlanId}>
                <SelectTrigger>
                  <SelectValue placeholder="请选择套餐" />
                </SelectTrigger>
                <SelectContent>
                  {planOptions.map((plan: PlanItem) => (
                    <SelectItem key={plan.id} value={plan.id}>
                      {plan.planName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.planId && (
                <p className="text-xs text-red-500">{errors.planId}</p>
              )}
            </div>

            {selectedPlan && (
              <div
                className="rounded-lg border p-4"
                style={{
                  borderColor: '#E5E9F2',
                  backgroundColor: '#F7F9FC',
                }}
              >
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <div className="text-xs" style={{ color: MUTED }}>
                      含算力
                    </div>
                    <div
                      className="mt-1 text-base font-semibold tnum"
                      style={{ color: PRIMARY }}
                    >
                      {selectedPlan.creditAmount.toLocaleString('zh-CN')}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs" style={{ color: MUTED }}>
                      有效期
                    </div>
                    <div className="mt-1 text-base font-semibold tnum" style={{ color: '#0f172a' }}>
                      {selectedPlan.validityMonths} 个月
                    </div>
                  </div>
                  <div>
                    <div className="text-xs" style={{ color: MUTED }}>
                      价格
                    </div>
                    <div className="mt-1 text-base font-semibold tnum" style={{ color: '#0f172a' }}>
                      ¥{selectedPlan.price.toLocaleString('zh-CN')}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="custom" className="space-y-4 pt-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>
                  自定义金额（元）<span className="text-red-500">*</span>
                </Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={customAmount}
                  onChange={(e) =>
                    setCustomAmount(Number(e.target.value) || 0)
                  }
                  placeholder="续费金额"
                />
                {errors.customAmount && (
                  <p className="text-xs text-red-500">{errors.customAmount}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label>
                  自定义算力 <span className="text-red-500">*</span>
                </Label>
                <Input
                  type="number"
                  min="0"
                  value={customCredit}
                  onChange={(e) =>
                    setCustomCredit(Number(e.target.value) || 0)
                  }
                  placeholder="算力数量"
                />
                {errors.customCredit && (
                  <p className="text-xs text-red-500">{errors.customCredit}</p>
                )}
              </div>
            </div>
            <div className="space-y-2">
              <Label>
                延长月数 <span className="text-red-500">*</span>
              </Label>
              <Input
                type="number"
                min="1"
                value={customMonths}
                onChange={(e) =>
                  setCustomMonths(Number(e.target.value) || 1)
                }
                placeholder="服务期延长月数"
              />
              {errors.customMonths && (
                <p className="text-xs text-red-500">{errors.customMonths}</p>
              )}
            </div>
          </TabsContent>
        </Tabs>

        <div className="space-y-2">
          <Label>备注</Label>
          <Textarea
            value={remark}
            onChange={(e) => setRemark(e.target.value)}
            placeholder="请输入备注信息（选填）"
            rows={3}
          />
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={renewMutation.isPending}
          >
            取消
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={renewMutation.isPending}
            style={{ backgroundColor: PRIMARY }}
          >
            {renewMutation.isPending ? '处理中...' : '确认续费'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default RenewCustomerDialog;
