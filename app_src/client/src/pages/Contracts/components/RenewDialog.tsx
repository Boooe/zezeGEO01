import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { logger } from '@lark-apaas/client-toolkit/logger';
import { toast } from 'sonner';
import { CalendarClock, RotateCcw } from 'lucide-react';

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
import { renewContract } from '@client/src/api/contracts';
import type { Contract } from '@shared/api.interface';

const PRIMARY = '#1e40af';
const ACCENT = '#f97316';

interface RenewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contract: Contract | null;
  onSuccess: () => void;
}

const RenewDialog: React.FC<RenewDialogProps> = ({
  open,
  onOpenChange,
  contract,
  onSuccess,
}) => {
  const queryClient = useQueryClient();
  const [months, setMonths] = useState<number>(12);

  useEffect(() => {
    if (open) {
      setMonths(12);
    }
  }, [open]);

  const renewMutation = useMutation({
    mutationFn: (m: number) => renewContract(contract!.id, m),
    retry: false,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contracts'] });
      queryClient.invalidateQueries({ queryKey: ['contractDetail'] });
      toast.success(`续费成功，已顺延 ${months} 个月`);
      onSuccess();
    },
    onError: (err) => {
      logger.error('续费失败', err);
      toast.error('续费失败，请重试');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!months || months <= 0) {
      toast.error('请输入有效的月数');
      return;
    }
    renewMutation.mutate(months);
  };

  // 计算新的到期日
  const calculateNewEndDate = (): string => {
    if (!contract?.serviceEnd) return '-';
    const currentEnd = new Date(contract.serviceEnd);
    // 如果已过期，从今天开始算
    const now = new Date();
    const startDate = currentEnd > now ? currentEnd : now;
    const newDate = new Date(startDate);
    newDate.setMonth(newDate.getMonth() + months);
    return newDate.toISOString().slice(0, 10);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RotateCcw className="h-5 w-5" style={{ color: ACCENT }} />
            合同续费
          </DialogTitle>
          <DialogDescription>
            为「{contract?.customerName ?? ''}」延长服务周期
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="rounded-md bg-orange-50 p-4">
            <div className="flex items-start gap-3">
              <CalendarClock className="h-5 w-5 flex-shrink-0" style={{ color: ACCENT }} />
              <div className="text-sm">
                <p className="font-medium" style={{ color: ACCENT }}>
                  当前服务到期：{contract?.serviceEnd ? contract.serviceEnd.slice(0, 10) : '-'}
                </p>
                <p className="mt-1 text-xs text-slate-600">
                  续费后到期：{calculateNewEndDate()}
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="renew-months">
              延长月数 <span className="text-red-500">*</span>
            </Label>
            <div className="flex items-center gap-2">
              <Input
                id="renew-months"
                type="number"
                min="1"
                max="120"
                value={months}
                onChange={(e) => setMonths(Number(e.target.value))}
              />
              <span className="text-sm text-muted-foreground">个月</span>
            </div>
            <div className="flex gap-2">
              {[3, 6, 12, 24].map((m) => (
                <Button
                  key={m}
                  type="button"
                  variant={months === m ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setMonths(m)}
                  style={months === m ? { backgroundColor: PRIMARY } : undefined}
                >
                  {m}个月
                </Button>
              ))}
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={renewMutation.isPending}
            >
              取消
            </Button>
            <Button
              type="submit"
              disabled={renewMutation.isPending}
              style={{ backgroundColor: ACCENT }}
            >
              {renewMutation.isPending ? '处理中...' : '确认续费'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default RenewDialog;
