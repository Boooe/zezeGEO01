import React, { useState, useMemo } from 'react';
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
import { Textarea } from '@client/src/components/ui/textarea';
import { Badge } from '@client/src/components/ui/badge';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@client/src/components/ui/popover';
import {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandItem,
} from '@client/src/components/ui/command';
import { Plus, X, AlertCircle, Wallet, CheckCircle2, FileText, ChevronsUpDown, ArrowUpRight } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { axiosForBackend } from '@lark-apaas/client-toolkit/utils/getAxiosForBackend';
import { useCreateOrder } from '@client/src/api/media-orders';
import { useWallet } from '@client/src/api/media-wallet';
import { useBrand } from '@client/src/hooks/useBrandContext';
import { formatMoneyCents } from '@client/src/utils/format';
import { SUBMISSION_LIBRARY_TYPE_LABELS, ARTICLE_STATUS_LABELS } from '@shared/api.interface';
import type { MarketChannel, Article } from '@shared/api.interface';

interface OrderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  channel: MarketChannel;
}

const OrderDialog: React.FC<OrderDialogProps> = ({
  open,
  onOpenChange,
  channel,
}) => {
  const { selectedBrandId } = useBrand();
  const navigate = useNavigate();
  const { data: wallet } = useWallet(selectedBrandId ?? undefined);
  const createOrder = useCreateOrder();

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [remark, setRemark] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [articleId, setArticleId] = useState<string>('');
  const [articleComboOpen, setArticleComboOpen] = useState(false);

  const balanceCents = wallet?.balanceCents ?? 0;
  const priceCents = channel.salePriceCents;
  const balanceInsufficient = !selectedBrandId || balanceCents < priceCents;

  const brandId = selectedBrandId ?? undefined;

  const {
    data: articlesData,
    isLoading: articlesLoading,
  } = useQuery({
    queryKey: ['content', 'articles', 'for-order', brandId],
    queryFn: async () => {
      const { data } = await axiosForBackend.get('/api/content/articles', {
        params: { brandId, pageSize: 50, status: 'draft' },
      });
      return data as { items: Article[]; total: number };
    },
    enabled: !!brandId,
    retry: false,
  });



  const selectedArticle = useMemo(() => {
    if (!articleId) return null;
    return articlesData?.items?.find((a: Article) => a.id === articleId) ?? null;
  }, [articleId, articlesData]);

  const handleArticleSelect = (id: string) => {
    setArticleId(id);
    const article = articlesData?.items?.find((a: Article) => a.id === id);
    if (article) {
      setTitle(article.title);
      setContent(article.content);
      if (article.coverImage) {
        setImageUrls([article.coverImage]);
      }
    }
  };

  const canSubmit = useMemo(() => {
    return (
      !!selectedBrandId &&
      title.trim().length > 0 &&
      content.trim().length > 0 &&
      !balanceInsufficient &&
      !createOrder.isPending
    );
  }, [selectedBrandId, title, content, balanceInsufficient, createOrder.isPending]);

  const handleAddImage = () => {
    const url = imageUrl.trim();
    if (url && !imageUrls.includes(url)) {
      setImageUrls([...imageUrls, url]);
      setImageUrl('');
    }
  };

  const handleRemoveImage = (index: number) => {
    setImageUrls(imageUrls.filter((_, i) => i !== index));
  };

  const handleSubmit = () => {
    if (!canSubmit) return;
    createOrder.mutate(
      {
        channelId: channel.id,
        title: title.trim(),
        content: content.trim(),
        imageUrls: imageUrls.length > 0 ? imageUrls : undefined,
        remark: remark.trim() || undefined,
        articleId: articleId || undefined,
      },
      {
        onSuccess: () => {
          setTitle('');
          setContent('');
          setRemark('');
          setImageUrls([]);
          setArticleId('');
          onOpenChange(false);
        },
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[640px] max-h-[85vh] flex flex-col p-0">
        <DialogHeader className="px-6 pt-6">
          <DialogTitle>提交发稿订单</DialogTitle>
          <DialogDescription className="sr-only">
            填写稿件信息并提交订单
          </DialogDescription>
        </DialogHeader>

        <div className="overflow-y-auto flex-1 px-6 py-5 space-y-5">
          {/* 钱包余额条 */}
          {!selectedBrandId ? (
            <div className="flex items-center justify-between rounded-lg border border-[#FFA940]/40 bg-[#FFF7E6] px-4 py-3">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-[#FFA940]" />
                <span className="text-sm text-[#D46B08]">请先选择品牌</span>
              </div>
              <button
                onClick={() => onOpenChange(false)}
                className="flex items-center gap-1 text-xs text-[#2E7DFF] hover:underline"
              >
                去选择
                <ArrowUpRight className="h-3 w-3" />
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-between rounded-lg border border-[#E5E9F2] bg-[#F0F7FF] px-4 py-3">
              <div className="flex items-center gap-2">
                <Wallet className="h-4 w-4 text-[#2E7DFF]" />
                <span className="text-sm text-slate-600">可用余额</span>
                <span
                  className="text-base font-semibold tnum"
                  style={{ color: '#2E7DFF' }}
                >
                  {formatMoneyCents(balanceCents)}
                </span>
              </div>
              <button
                onClick={() => {
                  onOpenChange(false);
                  navigate('/media-market?tab=wallet');
                }}
                className="flex items-center gap-1 text-xs text-[#2E7DFF] hover:underline"
              >
                去充值
                <ArrowUpRight className="h-3 w-3" />
              </button>
            </div>
          )}

          {/* 渠道信息 */}
          <div className="rounded-lg border border-[#E5E9F2] bg-[#F7F9FC] p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-slate-500">投放渠道</p>
                <p className="mt-1 font-semibold text-[#0f172a]">{channel.name}</p>
                <div className="mt-1 flex gap-2">
                  {channel.libraryType && (
                    <Badge variant="outline" className="border-[#E5E9F2] text-[11px] font-normal text-slate-600">
                      {SUBMISSION_LIBRARY_TYPE_LABELS[channel.libraryType as keyof typeof SUBMISSION_LIBRARY_TYPE_LABELS] ?? channel.libraryType}
                    </Badge>
                  )}
                  {channel.region && (
                    <Badge variant="outline" className="border-[#E5E9F2] text-[11px] font-normal text-slate-600">
                      {channel.region}
                    </Badge>
                  )}
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm text-slate-500">价格</p>
                <p
                  className="tnum text-xl font-bold"
                  style={{ color: '#2E7DFF' }}
                >
                  {formatMoneyCents(priceCents)}
                </p>
                <p className="text-[11px] text-slate-400">
                  元/篇
                </p>
              </div>
            </div>
          </div>

          {/* 选择已创作文章 */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-[#0f172a]">
              选择已创作文章
            </label>
            <Popover open={articleComboOpen} onOpenChange={setArticleComboOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={articleComboOpen}
                  disabled={articlesLoading}
                  className="w-full justify-between border-[#E5E9F2] font-normal text-slate-600 hover:bg-white"
                >
                  {articlesLoading
                    ? '加载中...'
                    : selectedArticle
                      ? selectedArticle.title
                      : '选择一篇文章快速填充'}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[480px] p-0" align="start">
                <Command>
                  <CommandInput placeholder="搜索文章标题..." className="h-9" />
                  <CommandList className="max-h-[320px]">
                    {!articlesLoading && (!articlesData?.items || articlesData.items.length === 0) && (
                      <CommandEmpty>
                        <div className="flex flex-col items-center justify-center py-6 text-center text-sm text-slate-500">
                          <FileText className="mb-2 h-8 w-8 text-slate-300" />
                          <p>还没有可发布的文章</p>
                          <button
                            type="button"
                            onClick={() => navigate('/creation?tab=articles')}
                            className="mt-2 text-[#2E7DFF] hover:underline"
                          >
                            → 去创作
                          </button>
                        </div>
                      </CommandEmpty>
                    )}
                    {(articlesData?.items ?? []).map((article: Article) => (
                      <CommandItem
                        key={article.id}
                        value={article.title}
                        onSelect={() => {
                          handleArticleSelect(article.id);
                          setArticleComboOpen(false);
                        }}
                        className="flex flex-col items-start gap-0.5 py-2"
                      >
                        <span className="text-sm font-medium text-[#0f172a]">
                          {article.title}
                        </span>
                        <span className="text-[11px] text-slate-400">
                          {article.keywords?.[0] || ''}
                          {article.keywords?.[0] ? ' · ' : ''}
                          {article.wordCount}字 · {article.createdAt?.slice(0, 10)} · {ARTICLE_STATUS_LABELS[article.status as keyof typeof ARTICLE_STATUS_LABELS] ?? article.status}
                        </span>
                      </CommandItem>
                    ))}
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
            {selectedArticle && (
              <div className="mt-2 flex items-center gap-1.5 text-[12px] text-[#17C964]">
                <CheckCircle2 className="h-3.5 w-3.5" />
                <span>已关联文章 #{selectedArticle.id.slice(-6)}</span>
              </div>
            )}
          </div>

          {/* 余额与预计扣款 */}
          <div className="space-y-1 rounded-lg border border-[#E5E9F2] bg-[#F7F9FC] p-3 text-[12px] text-slate-500">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Wallet className="h-3.5 w-3.5 text-slate-400" />
                余额
              </span>
              <span className="tnum font-medium text-[#0f172a]">
                {formatMoneyCents(balanceCents)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span>预计扣款</span>
              <span className="tnum font-medium text-[#2E7DFF]">
                {formatMoneyCents(priceCents)}
              </span>
            </div>
          </div>

          {balanceInsufficient && selectedBrandId && (
            <div className="flex items-center justify-between gap-2 rounded-lg bg-[#FF5C5C]/10 p-3 text-sm text-[#FF5C5C]">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>余额不足，请先充值</span>
              </div>
              <Button
                size="sm"
                variant="destructive"
                className="h-7 text-xs"
                onClick={() => {
                  onOpenChange(false);
                  navigate('/media-market?tab=wallet');
                }}
              >
                去充值
              </Button>
            </div>
          )}

          {/* 稿件标题 */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-[#0f172a]">
              稿件标题 <span className="text-[#FF5C5C]">*</span>
            </label>
            <Input
              placeholder="请输入稿件标题"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={100}
            />
            <p className="mt-1 text-right text-[11px] text-slate-400">
              {title.length}/100
            </p>
          </div>

          {/* 正文 */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-[#0f172a]">
              正文 <span className="text-[#FF5C5C]">*</span>
            </label>
            <Textarea
              placeholder="请粘贴或输入稿件正文内容"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="min-h-[160px] resize-y"
            />
            <p className="mt-1 text-right text-[11px] text-slate-400">
              {content.length} 字
            </p>
          </div>

          {/* 配图 */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-[#0f172a]">
              配图（可选）
            </label>
            <div className="flex gap-2">
              <Input
                placeholder="粘贴图片 URL"
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddImage();
                  }
                }}
              />
              <Button
                type="button"
                variant="outline"
                onClick={handleAddImage}
                disabled={!imageUrl.trim()}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            {imageUrls.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {imageUrls.map((url, idx) => (
                  <div
                    key={idx}
                    className="flex items-center gap-1.5 rounded-md border border-[#E5E9F2] bg-white px-2 py-1 text-xs text-slate-600"
                  >
                    <span className="max-w-[200px] truncate">{url}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveImage(idx)}
                      className="text-slate-400 hover:text-slate-600"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 备注 */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-[#0f172a]">
              备注（可选）
            </label>
            <Textarea
              placeholder="特殊要求或备注信息"
              value={remark}
              onChange={(e) => setRemark(e.target.value)}
              className="min-h-[80px] resize-y"
              maxLength={200}
            />
          </div>

          {/* 价格合计 */}
          <div className="flex items-center justify-between rounded-lg border border-[#E5E9F2] p-4">
            <span className="text-sm text-slate-500">合计金额</span>
            <span
              className="tnum text-2xl font-bold"
              style={{ color: '#2E7DFF' }}
            >
              {formatMoneyCents(priceCents)}
            </span>
          </div>
        </div>

        <DialogFooter className="px-6 py-4 border-t border-[#E5E9F2] sticky bottom-0 bg-white">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={createOrder.isPending}
          >
            取消
          </Button>
          <Button
            className="bg-[#2E7DFF] hover:bg-[#2563EB]"
            onClick={handleSubmit}
            disabled={!canSubmit}
          >
            {createOrder.isPending ? '提交中...' : '提交订单'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default OrderDialog;
