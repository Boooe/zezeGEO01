import React, { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@client/src/components/ui/dialog';
import { Button } from '@client/src/components/ui/button';
import { Input } from '@client/src/components/ui/input';
import { Skeleton } from '@client/src/components/ui/skeleton';
import { getChannel, updatePrice } from '@client/src/api/submission-channels';
import { formatMoneyCentsRaw, formatMarkupRate } from '@client/src/utils/format';
import { toast } from 'sonner';
import { logger } from '@lark-apaas/client-toolkit/logger';

interface PriceAdjustDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  channelId: string;
  channelName?: string;
  costPriceCents?: number;
  salePriceCents?: number;
  onSuccess?: () => void;
}

const PriceAdjustDialog: React.FC<PriceAdjustDialogProps> = ({
  open,
  onOpenChange,
  channelId,
  channelName,
  costPriceCents,
  salePriceCents,
  onSuccess,
}) => {
  const [salePrice, setSalePrice] = useState('');
  const [costPrice, setCostPrice] = useState<number | null>(
    costPriceCents ?? null,
  );
  const [name, setName] = useState(channelName ?? '');
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;

    if (costPriceCents !== undefined && salePriceCents !== undefined) {
      setCostPrice(costPriceCents);
      setSalePrice((salePriceCents / 100).toString());
      setName(channelName ?? '');
      return;
    }

    setLoading(true);
    getChannel(channelId)
      .then((ch) => {
        setCostPrice(ch.costPriceCents ?? 0);
        setSalePrice((ch.salePriceCents ?? 0) / 100 + '');
        setName(ch.name);
      })
      .catch((err: unknown) => {
        logger.error('获取渠道详情失败', err);
        toast.error('获取渠道信息失败');
      })
      .finally(() => {
        setLoading(false);
      });
  }, [open, channelId, costPriceCents, salePriceCents, channelName]);

  const costYuan = costPrice ? costPrice / 100 : 0;
  const saleYuan = parseFloat(salePrice);
  const markupRate =
    costPrice && costPrice > 0 && !isNaN(saleYuan) && saleYuan > 0
      ? ((saleYuan - costYuan) / costYuan) * 100
      : null;

  const handleSave = async () => {
    const saleYuanVal = parseFloat(salePrice);
    if (isNaN(saleYuanVal) || saleYuanVal <= 0) {
      toast.error('请输入有效的售价');
      return;
    }
    const newSalePriceCents = Math.round(saleYuanVal * 100);
    if (costPrice && newSalePriceCents < costPrice) {
      toast.error('售价不能低于采购成本');
      return;
    }

    setSubmitting(true);
    try {
      await updatePrice(channelId, { salePriceCents: newSalePriceCents });
      toast.success('价格已更新');
      onOpenChange(false);
      onSuccess?.();
    } catch (err: unknown) {
      logger.error('调价失败', err);
      const msg =
        (err as { response?: { data?: { error?: { message?: string } } } })
          ?.response?.data?.error?.message ?? '调价失败';
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[420px]">
        <DialogHeader>
          <DialogTitle>修改价格</DialogTitle>
          <DialogDescription>{name}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-[#0f172a]">
              采购价
            </label>
            {loading ? (
              <Skeleton className="h-9 w-full" />
            ) : (
              <Input
                value={costPrice ? formatMoneyCentsRaw(costPrice) : '-'}
                disabled
                className="bg-slate-50"
              />
            )}
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-[#0f172a]">
              售价（元/篇）
            </label>
            {loading ? (
              <Skeleton className="h-9 w-full" />
            ) : (
              <Input
                type="number"
                step="0.01"
                value={salePrice}
                onChange={(e) => setSalePrice(e.target.value)}
              />
            )}
          </div>

          {markupRate !== null && !loading && (
            <div className="rounded-md bg-[#F7F9FC] px-3 py-2 text-sm">
              <span className="text-slate-500">加价率：</span>
              <span
                className="tnum font-semibold"
                style={{ color: markupRate < 0 ? '#FF5C5C' : '#2E7DFF' }}
              >
                {formatMarkupRate(markupRate)}
              </span>
              {markupRate < 0 && (
                <span className="ml-2 text-[#FF5C5C]">低于成本</span>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button
            className="bg-[#2E7DFF] hover:bg-[#2563EB]"
            onClick={handleSave}
            disabled={submitting || loading}
          >
            {submitting ? '保存中...' : '保存'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default PriceAdjustDialog;
