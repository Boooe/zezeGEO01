import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@client/src/components/ui/dialog';
import { Button } from '@client/src/components/ui/button';
import { Input } from '@client/src/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@client/src/components/ui/select';
import { useSuppliers, useUpdateChannelPricing } from '@client/src/api/media-market';
import { formatMoneyCentsRaw, formatMarkupRate } from '@client/src/utils/format';
import type { ChannelPricingAdmin } from '@shared/api.interface';

interface PricingEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  channel: ChannelPricingAdmin;
}

const PricingEditDialog: React.FC<PricingEditDialogProps> = ({
  open,
  onOpenChange,
  channel,
}) => {
  const { data: suppliersData } = useSuppliers({ page: 1, pageSize: 100 });
  const updatePricing = useUpdateChannelPricing();

  const [costPrice, setCostPrice] = useState('');
  const [salePrice, setSalePrice] = useState('');
  const [stock, setStock] = useState('');
  const [turnaroundHours, setTurnaroundHours] = useState('');
  const [priceUnit, setPriceUnit] = useState('');

  useEffect(() => {
    if (open && channel) {
      setCostPrice((channel.costPriceCents / 100).toString());
      setSalePrice((channel.salePriceCents / 100).toString());
      setStock(channel.stock === -1 ? '-1' : channel.stock.toString());
      setTurnaroundHours(channel.turnaroundHours.toString());
      setPriceUnit(channel.priceUnit || '篇');
    }
  }, [open, channel]);

  const handleSave = () => {
    const costYuan = parseFloat(costPrice);
    const saleYuan = parseFloat(salePrice);

    if (isNaN(costYuan) || costYuan < 0) {
      return;
    }
    if (isNaN(saleYuan) || saleYuan <= 0) {
      return;
    }

    const costPriceCents = Math.round(costYuan * 100);
    const salePriceCents = Math.round(saleYuan * 100);
    const stockNum = parseInt(stock, 10);
    const turnaround = parseInt(turnaroundHours, 10);

    updatePricing.mutate(
      {
        id: channel.id,
        body: {
          costPriceCents,
          salePriceCents,
          stock: isNaN(stockNum) ? channel.stock : stockNum,
          turnaroundHours: isNaN(turnaround) ? channel.turnaroundHours : turnaround,
          priceUnit: priceUnit || channel.priceUnit,
        },
      },
      {
        onSuccess: () => {
          onOpenChange(false);
        },
      },
    );
  };

  const markupRate = useMemoMarkupRate(parseFloat(costPrice), parseFloat(salePrice));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[500px]">
        <DialogHeader>
          <DialogTitle>编辑渠道价格</DialogTitle>
          <DialogDescription>
            {channel.name}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-[#0f172a]">
              渠道名称
            </label>
            <Input value={channel.name} disabled className="bg-slate-50" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-[#0f172a]">
                采购价（元）
              </label>
              <Input
                type="number"
                step="0.01"
                value={costPrice}
                onChange={(e) => setCostPrice(e.target.value)}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-[#0f172a]">
                售价（元）
              </label>
              <Input
                type="number"
                step="0.01"
                value={salePrice}
                onChange={(e) => setSalePrice(e.target.value)}
              />
            </div>
          </div>

          {markupRate !== null && (
            <div className="rounded-md bg-[#F7F9FC] px-3 py-2 text-sm">
              <span className="text-slate-500">加价率：</span>
              <span className="tnum font-semibold" style={{ color: '#2E7DFF' }}>
                {formatMarkupRate(markupRate)}
              </span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-[#0f172a]">
                库存
              </label>
              <Input
                type="number"
                value={stock}
                onChange={(e) => setStock(e.target.value)}
                placeholder="-1 表示不限"
              />
              <p className="mt-1 text-[11px] text-slate-400">填 -1 表示不限量</p>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-[#0f172a]">
                时效（小时）
              </label>
              <Input
                type="number"
                value={turnaroundHours}
                onChange={(e) => setTurnaroundHours(e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-[#0f172a]">
              价格单位
            </label>
            <Input
              value={priceUnit}
              onChange={(e) => setPriceUnit(e.target.value)}
              placeholder="篇/条/个"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button
            className="bg-[#2E7DFF] hover:bg-[#2563EB]"
            onClick={handleSave}
            disabled={updatePricing.isPending}
          >
            {updatePricing.isPending ? '保存中...' : '保存'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

function useMemoMarkupRate(cost: number, sale: number): number | null {
  if (isNaN(cost) || isNaN(sale) || cost <= 0) return null;
  return ((sale - cost) / cost) * 100;
}

export default PricingEditDialog;
