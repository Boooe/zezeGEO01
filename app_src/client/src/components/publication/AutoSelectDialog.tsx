import React, { useMemo, useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Search, Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@client/src/components/ui/table';
import { Skeleton } from '@client/src/components/ui/skeleton';
import { Badge } from '@client/src/components/ui/badge';
import {
  AiSourcePlatformSelect,
  CONNECTED_AI_PLATFORMS,
} from '@client/src/components/publication/AiSourcePlatformSelect';
import { autoSelectChannels } from '@client/src/api/submission-channels';
import { getBrands } from '@client/src/api/brands';
import {
  SUBMISSION_LIBRARY_TYPES,
  SUBMISSION_LIBRARY_TYPE_LABELS,
  SUBMISSION_REGIONS,
  SUBMISSION_INDUSTRIES,
  SUBMISSION_INDUSTRY_LABELS,
  SUBMISSION_AI_SOURCES,
  SUBMISSION_AI_SOURCE_LABELS,
  SUBMISSION_MEDIA_TYPES,
  SUBMISSION_MEDIA_TYPE_LABELS,
} from '@shared/api.interface';
import type {
  SubmissionLibraryType,
  SubmissionAiSource,
  SubmissionMediaType,
  SubmissionIndustry,
  AutoSelectChannelItem,
  AutoSelectChannelsRequest,
} from '@shared/api.interface';

const PRIMARY = '#2E7DFF';
const MUTED = '#64748b';

export interface AutoSelectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultBrandId?: string;
  defaultLibraryType?: SubmissionLibraryType;
  isClient?: boolean;
  /** 确认选源后回调，返回选中的渠道 id 列表和规则 JSON */
  onConfirm: (channelIds: string[], rule: string) => void;
}

export const AutoSelectDialog: React.FC<AutoSelectDialogProps> = ({
  open,
  onOpenChange,
  defaultBrandId = '',
  defaultLibraryType,
  isClient = false,
  onConfirm,
}) => {
  const [brandId, setBrandId] = useState<string>(defaultBrandId);
  const [region, setRegion] = useState<string>('');
  const [industry, setIndustry] = useState<string>('');
  const [libraryType, setLibraryType] = useState<SubmissionLibraryType | ''>(
    defaultLibraryType && (SUBMISSION_LIBRARY_TYPES as readonly string[]).includes(defaultLibraryType)
      ? defaultLibraryType
      : '',
  );
  const [aiPlatforms, setAiPlatforms] = useState<SubmissionAiSource[]>([]);
  const [mediaType, setMediaType] = useState<SubmissionMediaType>('image_text');
  const [budgetMax, setBudgetMax] = useState<string>('200');
  const [keyword, setKeyword] = useState<string>('');
  const [hasSearched, setHasSearched] = useState(false);
  const [result, setResult] = useState<AutoSelectChannelItem[]>([]);
  const [totalCost, setTotalCost] = useState(0);
  const [unpricedCount, setUnpricedCount] = useState(0);

  const { data: brandOptions = [] } = useQuery({
    queryKey: ['brands', 'options', 'auto-select'],
    queryFn: () => getBrands(),
    enabled: open && !isClient,
    retry: 2,
    retryDelay: 2000,
  });

  const selectMutation = useMutation({
    mutationFn: (body: AutoSelectChannelsRequest) =>
      autoSelectChannels(body),
    retry: false,
    onSuccess: (data) => {
      setResult(data.items);
      setTotalCost(data.totalCost);
      setUnpricedCount(data.unpricedCount || 0);
      setHasSearched(true);
      if (data.items.length === 0) {
        toast.info('没有找到符合条件的渠道，请调整筛选条件');
      }
    },
    onError: (err: any) => {
      toast.error(
        err?.response?.data?.error?.message ??
          err?.message ??
          '匹配失败，请重试',
      );
    },
  });

  const handleMatch = () => {
    if (!brandId) {
      toast.error('请选择品牌');
      return;
    }
    if (aiPlatforms.length === 0) {
      toast.error('请至少选择一个 AI 平台');
      return;
    }
    const budgetNum = Number(budgetMax);
    if (!budgetNum || budgetNum <= 0) {
      toast.error('请输入有效的单篇预算上限');
      return;
    }
    selectMutation.mutate({
      brandId,
      libraryType: libraryType || undefined,
      region: region || undefined,
      industry: (industry || undefined) as SubmissionIndustry | undefined,
      aiPlatforms,
      mediaType,
      budgetMax: budgetNum,
    });
  };

  const filteredResult = useMemo(() => {
    if (!keyword.trim()) return result;
    const kw = keyword.toLowerCase();
    return result.filter((c) => c.name.toLowerCase().includes(kw));
  }, [result, keyword]);

  const handleConfirm = () => {
    if (result.length === 0) {
      toast.error('没有可选的渠道');
      return;
    }
    const rule = JSON.stringify({
      libraryType: libraryType || null,
      region: region || null,
      industry: industry || null,
      aiPlatforms,
      mediaType,
      budgetMax: Number(budgetMax),
    });
    const ids = result.map((c) => c.id);
    onConfirm(ids, rule);
    onOpenChange(false);
  };

  const resetState = () => {
    setHasSearched(false);
    setResult([]);
    setTotalCost(0);
    setUnpricedCount(0);
    setKeyword('');
  };

  React.useEffect(() => {
    if (open) {
      setBrandId(defaultBrandId);
      resetState();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={(v) => !selectMutation.isPending && onOpenChange(v)}>
      <DialogContent className="sm:max-w-4xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>按标签自动选源</DialogTitle>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto space-y-4 py-2">
          {/* 筛选表单 */}
          <div
            className="grid grid-cols-2 gap-3 rounded-lg border p-4"
            style={{ borderColor: '#E5E9F2', backgroundColor: '#FAFBFC' }}
          >
            {!isClient && (
              <div className="space-y-1.5">
                <label className="text-xs font-medium">品牌</label>
                <Select value={brandId} onValueChange={setBrandId}>
                  <SelectTrigger className="h-8">
                    <SelectValue placeholder="选择品牌" />
                  </SelectTrigger>
                  <SelectContent>
                    {brandOptions.map((b: { id: string; name: string }) => (
                      <SelectItem key={b.id} value={b.id}>
                        {b.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-1.5">
              <label className="text-xs font-medium">行业</label>
              <Select value={industry} onValueChange={setIndustry}>
                <SelectTrigger className="h-8">
                  <SelectValue placeholder="全部行业" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">全部行业</SelectItem>
                  {SUBMISSION_INDUSTRIES.map((ind) => (
                    <SelectItem key={ind} value={ind}>
                      {SUBMISSION_INDUSTRY_LABELS[ind]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium">地区</label>
              <Select value={region} onValueChange={setRegion}>
                <SelectTrigger className="h-8">
                  <SelectValue placeholder="全部地区" />
                </SelectTrigger>
                <SelectContent className="max-h-[240px]">
                  <SelectItem value="">全部地区</SelectItem>
                  {SUBMISSION_REGIONS.map((r) => (
                    <SelectItem key={r} value={r}>
                      {r}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium">库类型</label>
              <Select
                value={libraryType}
                onValueChange={(v) => setLibraryType(v as SubmissionLibraryType | '')}
              >
                <SelectTrigger className="h-8">
                  <SelectValue placeholder="全部库类型" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">全部库类型</SelectItem>
                  {SUBMISSION_LIBRARY_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {SUBMISSION_LIBRARY_TYPE_LABELS[t]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2 space-y-1.5">
              <label className="text-xs font-medium">AI 平台</label>
              <AiSourcePlatformSelect
                selected={aiPlatforms}
                onChange={setAiPlatforms}
              />
              <p className="text-[11px]" style={{ color: MUTED }}>
                <span
                  className="mr-1 inline-block h-1.5 w-1.5 rounded-full"
                  style={{ backgroundColor: PRIMARY }}
                />
                标记为已接入 API Key；置灰平台仍可用于筛选，发布时会跳过无配置渠道
              </p>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium">模态</label>
              <Select
                value={mediaType}
                onValueChange={(v) => setMediaType(v as SubmissionMediaType)}
              >
                <SelectTrigger className="h-8">
                  <SelectValue placeholder="选择模态" />
                </SelectTrigger>
                <SelectContent>
                  {SUBMISSION_MEDIA_TYPES.map((m) => (
                    <SelectItem key={m} value={m}>
                      {SUBMISSION_MEDIA_TYPE_LABELS[m]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium">单篇预算上限（元）</label>
              <Input
                type="number"
                min={0}
                step="1"
                value={budgetMax}
                onChange={(e) => setBudgetMax(e.target.value)}
                className="h-8"
                placeholder="例如 200"
              />
            </div>
            <div className="col-span-2 flex justify-end pt-1">
              <Button
                style={{ backgroundColor: PRIMARY }}
                size="sm"
                onClick={handleMatch}
                disabled={selectMutation.isPending}
              >
                {selectMutation.isPending ? (
                  <>
                    <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                    匹配中...
                  </>
                ) : (
                  '开始匹配'
                )}
              </Button>
            </div>
          </div>

          {/* 结果列表 */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">候选渠道</label>
              {hasSearched && result.length > 0 && (
                <div className="relative w-48">
                  <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={keyword}
                    onChange={(e) => setKeyword(e.target.value)}
                    placeholder="搜索渠道名称"
                    className="h-7 pl-7 text-xs"
                  />
                </div>
              )}
            </div>
            <div className="max-h-[300px] overflow-y-auto rounded-md border" style={{ borderColor: '#E5E9F2' }}>
              {selectMutation.isPending ? (
                <div className="space-y-1 p-2">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="flex items-center gap-2 px-2 py-1.5">
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-4 w-16" />
                      <Skeleton className="h-4 w-16" />
                      <Skeleton className="h-4 w-24" />
                      <Skeleton className="h-4 w-16" />
                    </div>
                  ))}
                </div>
              ) : !hasSearched ? (
                <div className="py-10 text-center text-sm text-muted-foreground">
                  请在上方设置条件，点击「开始匹配」获取候选渠道
                </div>
              ) : filteredResult.length === 0 ? (
                <div className="py-10 text-center text-sm text-muted-foreground">
                  {result.length === 0 ? '没有匹配的渠道，请调整筛选条件' : '没有匹配搜索关键词的渠道'}
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow style={{ backgroundColor: '#F7F9FC' }}>
                      <TableHead className="h-8 text-xs font-medium">渠道名称</TableHead>
                      <TableHead className="h-8 text-xs font-medium w-24">库类型</TableHead>
                      <TableHead className="h-8 text-xs font-medium w-20">地区</TableHead>
                      <TableHead className="h-8 text-xs font-medium w-48">AI 信源标签</TableHead>
                      <TableHead className="h-8 text-xs font-medium w-24 text-right tnum">
                        {mediaType === 'video' ? '视频价' : '图文价'}
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredResult.map((c) => {
                      const price =
                        mediaType === 'video' ? c.videoPrice : c.imagePrice;
                      return (
                        <TableRow key={c.id} className="h-9">
                          <TableCell className="text-sm font-medium">
                            {c.name}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {SUBMISSION_LIBRARY_TYPE_LABELS[c.libraryType] || c.libraryType}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {c.region || '—'}
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1">
                              {c.aiPlatforms?.length ? (
                                c.aiPlatforms.map((p) => (
                                  <Badge
                                    key={p}
                                    variant="outline"
                                    className="text-[10px] h-4 border-0"
                                    style={{
                                      backgroundColor: CONNECTED_AI_PLATFORMS.includes(p)
                                        ? 'rgba(46, 125, 255, 0.1)'
                                        : 'rgba(100, 116, 139, 0.08)',
                                      color: CONNECTED_AI_PLATFORMS.includes(p)
                                        ? PRIMARY
                                        : MUTED,
                                    }}
                                  >
                                    {SUBMISSION_AI_SOURCE_LABELS[p] || p}
                                  </Badge>
                                ))
                              ) : (
                                <span className="text-xs" style={{ color: MUTED }}>
                                  无标签
                                </span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-right text-sm tnum">
                            {price !== null && price !== undefined ? (
                              <span>¥{price}</span>
                            ) : (
                              <span style={{ color: MUTED }}>未定价</span>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </div>
          </div>
        </div>

        <DialogFooter className="flex items-center justify-between pt-2">
          {hasSearched && result.length > 0 ? (
            <div className="text-xs" style={{ color: MUTED }}>
              已选 <span className="tnum font-medium" style={{ color: '#0f172a' }}>{result.length}</span>{' '}
              个渠道，预估单轮成本{' '}
              <span className="tnum font-medium" style={{ color: PRIMARY }}>
                ¥{totalCost.toFixed(2)}
              </span>
              {unpricedCount > 0 && (
                <span className="ml-2" style={{ color: '#F59E0B' }}>
                  （含 {unpricedCount} 个未定价渠道，按 0 元计）
                </span>
              )}
            </div>
          ) : (
            <div />
          )}
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={selectMutation.isPending}
            >
              取消
            </Button>
            <Button
              style={{ backgroundColor: PRIMARY }}
              onClick={handleConfirm}
              disabled={!hasSearched || result.length === 0 || selectMutation.isPending}
            >
              确认选源
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default AutoSelectDialog;
