import { useEffect, useState } from 'react';
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
import { adjustCredit } from '@client/src/api/customers';

const PRIMARY = '#1e40af';

interface AdjustCreditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  brandId: string | null;
  brandName: string | null;
  currentBalance: number;
  onSuccess: () => void;
}

const AdjustCreditDialog: React.FC<AdjustCreditDialogProps> = ({
  open,
  onOpenChange,
  brandId,
  brandName,
  currentBalance,
  onSuccess,
}) => {
  const queryClient = useQueryClient();

  const [amount, setAmount] = useState<number>(0);
  const [reason, setReason] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (open) {
      setAmount(0);
      setReason('');
      setErrors({});
    }
  }, [open]);

  const adjustMutation = useMutation({
    mutationFn: () => {
      if (!brandId) throw new Error('缺少品牌ID');
      return adjustCredit(brandId, amount, reason);
    },
    retry: false,
    onSuccess: (data) => {
      toast.success(`调整成功，当前余额：${data.balance}`);
      onSuccess();
      onOpenChange(false);
    },
    onError: (err: unknown) => {
      logger.error('调整算力失败', err);
      const msg =
        (err as { response?: { data?: { error?: { message?: string } } } })
          .response?.data?.error?.message || '调整失败，请重试';
      toast.error(msg);
    },
  });

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (amount === 0) {
      newErrors.amount = '请输入调整额度，不能为 0';
    }
    if (currentBalance + amount < 0) {
      newErrors.amount = '调整后余额不能为负数';
    }
    if (!reason.trim()) {
      newErrors.reason = '请输入调整原因';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    adjustMutation.mutate();
  };

  const newBalance = currentBalance + amount;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>调整算力</DialogTitle>
          <DialogDescription>
            为「{brandName || '-'}」调整算力额度
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* 当前余额 */}
          <div className="space-y-2">
            <Label>当前余额</Label>
            <div className="rounded-md border bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700">
              {currentBalance.toLocaleString('zh-CN')} 算力
            </div>
          </div>

          {/* 调整额度 */}
          <div className="space-y-2">
            <Label htmlFor="amount">
              调整额度 <span className="text-red-500">*</span>
            </Label>
            <Input
              id="amount"
              type="number"
              value={amount}
              onChange={(e) => setAmount(Number(e.target.value) || 0)}
              placeholder="正数增加，负数扣减"
            />
            {errors.amount && (
              <p className="text-xs text-red-500">{errors.amount}</p>
            )}
            <p className="text-xs text-muted-foreground">
              调整后余额：
              <span
                className={
                  newBalance < 0
                    ? 'font-medium text-red-500'
                    : 'font-medium text-slate-700'
                }
              >
                {newBalance.toLocaleString('zh-CN')} 算力
              </span>
            </p>
          </div>

          {/* 调整原因 */}
          <div className="space-y-2">
            <Label htmlFor="reason">
              调整原因 <span className="text-red-500">*</span>
            </Label>
            <Input
              id="reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="请输入调整原因"
            />
            {errors.reason && (
              <p className="text-xs text-red-500">{errors.reason}</p>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={adjustMutation.isPending}
            >
              取消
            </Button>
            <Button
              type="submit"
              disabled={adjustMutation.isPending}
              style={{ backgroundColor: PRIMARY }}
            >
              {adjustMutation.isPending ? '提交中...' : '确认调整'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default AdjustCreditDialog;
