import React, { useMemo, useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search } from 'lucide-react';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { getApiErrorMessage } from '@client/src/lib/api-error';

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
import { Checkbox } from '@client/src/components/ui/checkbox';
import { Badge } from '@client/src/components/ui/badge';
import { Skeleton } from '@client/src/components/ui/skeleton';

import { listMarketChannels } from '@client/src/api/media-market';
import { useBatchCreateOrders } from '@client/src/api/media-orders';
import { INDUSTRIES, INDUSTRY_LABELS } from '@shared/api.interface';
import type { MarketChannel } from '@shared/api.interface';

interface PublishToMarketDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  articleIds: string[];
  brandId?: string;
  industry?: string;
}

const PRIMARY = '#2E7DFF';

const PublishToMarketDialog: React.FC<PublishToMarketDialogProps> = ({
  open,
  onOpenChange,
  articleIds,
  industry: defaultIndustry,
}) => {
  const navigate = useNavigate();
  const [industry, setIndustry] = useState<string>(defaultIndustry || '');
  const [keyword, setKeyword] = useState<string>('');
  const [priceMin, setPriceMin] = useState<string>('');
  const [priceMax, setPriceMax] = useState<string>('');
  const [searchKw, setSearchKw] = useState<string>('');
  const [selectedChannelIds, setSelectedChannelIds] = useState<Set<string>>(new Set());
  const [autoSelected, setAutoSelected] = useState<boolean>(false);

  const { data, isLoading } = useQuery({
    queryKey: [
      'media-market',
      'market-channels-dialog',
      {
        industry: industry || undefined,
        keyword: searchKw || undefined,
        priceMin: priceMin ? Number(priceMin) * 100 : undefined,
        priceMax: priceMax ? Number(priceMax) * 100 : undefined,
        pageSize: 50,
        sortBy: 'price',
        sortOrder: 'asc',
      },
    ],
    queryFn: () =>
      listMarketChannels({
        industry: industry || undefined,
        keyword: searchKw || undefined,
        priceMin: priceMin ? Number(priceMin) * 100 : undefined,
        priceMax: priceMax ? Number(priceMax) * 100 : undefined,
        pageSize: 50,
        sortBy: 'price',
        sortOrder: 'asc',
      }),
    enabled: open,
    retry: false,
  });

  const channels: MarketChannel[] = data?.items ?? [];

  const sortedChannels = useMemo(() => {
    if (!industry) return channels;
    const sameIndustry: MarketChannel[] = [];
    const others: MarketChannel[] = [];
    for (const ch of channels) {
      const industries = ch.industries ?? (ch.industry ? [ch.industry] : []);
      if (industries.includes(industry)) {
        sameIndustry.push(ch);
      } else {
        others.push(ch);
      }
    }
    return [...sameIndustry, ...others];
  }, [channels, industry]);

  useEffect(() => {
    if (!open) {
      setAutoSelected(false);
      setSelectedChannelIds(new Set());
      return;
    }
    setIndustry(defaultIndustry || '');
    setKeyword('');
    setSearchKw('');
    setPriceMin('');
    setPriceMax('');
    setSelectedChannelIds(new Set());
    setAutoSelected(false);
  }, [open, defaultIndustry]);

  useEffect(() => {
    if (autoSelected || isLoading || !industry || sortedChannels.length === 0) return;
    const recIds: string[] = [];
    for (const ch of sortedChannels) {
      const industries = ch.industries ?? (ch.industry ? [ch.industry] : []);
      if (industries.includes(industry)) {
        recIds.push(ch.id);
        if (recIds.length >= 5) break;
      }
    }
    if (recIds.length > 0) {
      setSelectedChannelIds(new Set(recIds));
    }
    setAutoSelected(true);
  }, [isLoading, industry, sortedChannels, autoSelected]);

  const handleSearch = () => {
    setSearchKw(keyword.trim());
    setAutoSelected(false);
  };

  const toggleChannel = (id: string) => {
    setSelectedChannelIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedChannelIds.size === sortedChannels.length) {
      setSelectedChannelIds(new Set());
    } else {
      setSelectedChannelIds(new Set(sortedChannels.map((c: MarketChannel) => c.id)));
    }
  };

  const totalCents = useMemo(() => {
    let sum = 0;
    for (const ch of sortedChannels) {
      if (selectedChannelIds.has(ch.id)) {
        sum += ch.salePriceCents;
      }
    }
    return sum * articleIds.length;
  }, [sortedChannels, selectedChannelIds, articleIds]);

  const batchMutation = useBatchCreateOrders();

  const handleConfirm = async () => {
    if (selectedChannelIds.size === 0) {
      toast.warning('请至少选择一个渠道');
      return;
    }
    if (articleIds.length === 0) {
      toast.warning('没有可发布的文章');
      return;
    }
    const channelIds = Array.from(selectedChannelIds);
    try {
      const result = await batchMutation.mutateAsync({
        articleIds,
        channelIds,
      });
      onOpenChange(false);
      const totalOrders = result.successCount + result.failedCount;
      if (result.failedCount > 0) {
        toast.warning(
          `已生成 ${result.successCount} 条发稿订单，${result.failedCount} 条失败`,
          {
            action: {
              label: '去查看',
              onClick: () => navigate('/media-market?tab=my-orders'),
            },
          },
        );
      } else {
        toast.success(`已生成 ${totalOrders} 条发稿订单`, {
          action: {
            label: '去查看',
            onClick: () => navigate('/media-market?tab=my-orders'),
          },
        });
      }
    } catch (error: unknown) {
      const msg = getApiErrorMessage(error, '下单失败');
      if (msg.includes('余额不足') || msg.includes('insufficient')) {
        toast.error('余额不足，请先充值', {
          action: {
            label: '去充值',
            onClick: () => navigate('/media-market?tab=wallet'),
          },
        });
      } else {
        toast.error(msg);
      }
    }
  };

  const allSelected = sortedChannels.length > 0 && selectedChannelIds.size === sortedChannels.length;
  const someSelected = selectedChannelIds.size > 0 && selectedChannelIds.size < sortedChannels.length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[720px] max-h-[85vh] flex flex-col p-0">
        <DialogHeader className="px-6 pt-5 pb-3">
          <DialogTitle className="text-lg font-semibold">发布到媒体商城</DialogTitle>
          <DialogDescription className="text-sm">
            已选 {articleIds.length} 篇文章
            {industry && (
              <span className="ml-2">
                · 行业：
                <Badge variant="secondary" className="ml-1">
                  {INDUSTRY_LABELS[industry as keyof typeof INDUSTRY_LABELS] || industry}
                </Badge>
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="px-6 pb-3 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="w-36">
              <Select
                value={industry}
                onValueChange={(v) => {
                  setIndustry(v);
                  setAutoSelected(false);
                }}
              >
                <SelectTrigger className="w-full h-8 text-sm">
                  <SelectValue placeholder="全部行业" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">全部行业</SelectItem>
                  {INDUSTRIES.map((ind) => (
                    <SelectItem key={ind} value={ind}>
                      {INDUSTRY_LABELS[ind]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-1">
              <Input
                type="number"
                placeholder="最低价"
                value={priceMin}
                onChange={(e) => setPriceMin(e.target.value)}
                className="w-24 h-8 text-sm"
              />
              <span className="text-muted-foreground text-xs">-</span>
              <Input
                type="number"
                placeholder="最高价"
                value={priceMax}
                onChange={(e) => setPriceMax(e.target.value)}
                className="w-24 h-8 text-sm"
              />
            </div>
            <div className="relative flex-1 min-w-[160px]">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="搜索渠道名称"
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                className="pl-8 h-8 text-sm"
              />
            </div>
            <Button size="sm" variant="outline" onClick={handleSearch} className="h-8 px-3 text-xs">
              搜索
            </Button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6">
          <div className="flex items-center justify-between py-2 border-t border-b">
            <div className="flex items-center gap-2">
              <Checkbox
                id="select-all-channels"
                checked={allSelected ? true : someSelected ? 'indeterminate' : false}
                onCheckedChange={toggleSelectAll}
              />
              <label htmlFor="select-all-channels" className="text-sm font-medium cursor-pointer">
                全选
              </label>
            </div>
            <span className="text-xs text-muted-foreground">
              共 {sortedChannels.length} 个渠道
            </span>
          </div>

          {isLoading ? (
            <div className="space-y-2 py-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : sortedChannels.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              暂无符合条件的渠道
            </div>
          ) : (
            <div className="py-2 space-y-1">
              {sortedChannels.map((channel: MarketChannel) => {
                const checked = selectedChannelIds.has(channel.id);
                const isSameIndustry =
                  (channel.industries ?? (channel.industry ? [channel.industry] : [])).includes(
                    industry,
                  );
                return (
                  <div
                    key={channel.id}
                    className={`flex items-center gap-3 rounded-lg border px-3 py-2.5 transition-colors cursor-pointer ${
                      checked
                        ? 'border-primary/50 bg-primary/5'
                        : 'hover:bg-muted/30'
                    }`}
                    onClick={() => toggleChannel(channel.id)}
                  >
                    <Checkbox
                      checked={checked}
                      onCheckedChange={() => toggleChannel(channel.id)}
                      onClick={(e) => e.stopPropagation()}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm truncate">{channel.name}</span>
                        {isSameIndustry && industry && (
                          <Badge variant="secondary" className="text-[10px] h-4 px-1.5">
                            推荐
                          </Badge>
                        )}
                        {channel.libraryType && (
                          <Badge variant="outline" className="text-[10px] h-4 px-1.5">
                            {channel.libraryType}
                          </Badge>
                        )}
                      </div>
                      <div className="mt-0.5 flex items-center gap-3 text-xs text-muted-foreground">
                        {channel.region && <span>{channel.region}</span>}
                        {channel.turnaroundHours !== null &&
                          channel.turnaroundHours !== undefined && (
                            <span>{channel.turnaroundHours}h 出稿</span>
                          )}
                        {channel.stock !== null && channel.stock !== undefined && (
                          <span>库存 {channel.stock}</span>
                        )}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div
                        className="font-semibold tnum"
                        style={{ color: PRIMARY }}
                      >
                        ¥{(channel.salePriceCents / 100).toFixed(2)}
                      </div>
                      <div className="text-[11px] text-muted-foreground">
                        {channel.priceUnit || '元/篇'}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <DialogFooter className="px-6 py-3 border-t flex flex-col sm:flex-row gap-2">
          <div className="flex-1 flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">
              已选 {selectedChannelIds.size} 个渠道
            </span>
            <span className="text-muted-foreground">·</span>
            <span>
              合计{' '}
              <span
                className="font-semibold text-lg tnum"
                style={{ color: PRIMARY }}
              >
                ¥{(totalCents / 100).toFixed(2)}
              </span>
            </span>
            <span className="text-xs text-muted-foreground ml-1">
              ({articleIds.length} 篇 × {selectedChannelIds.size} 渠道)
            </span>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={batchMutation.isPending}
            >
              取消
            </Button>
            <Button
              style={{ backgroundColor: PRIMARY }}
              onClick={handleConfirm}
              disabled={selectedChannelIds.size === 0 || batchMutation.isPending}
            >
              {batchMutation.isPending ? '提交中...' : '确认生成订单'}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default PublishToMarketDialog;
