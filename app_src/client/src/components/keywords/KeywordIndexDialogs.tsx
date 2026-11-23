import React, { useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  UploadCloud,
  X,
  ImageIcon,
  Info,
  Loader2,
} from 'lucide-react';
import { format } from 'date-fns';

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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@client/src/components/ui/select';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@client/src/components/ui/tooltip';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@client/src/components/ui/tabs';
import { Skeleton } from '@client/src/components/ui/skeleton';
import { Badge } from '@client/src/components/ui/badge';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@client/src/components/ui/popover';
import { Calendar } from '@client/src/components/ui/calendar';
import { CalendarIcon } from 'lucide-react';
import { zhCN } from 'date-fns/locale';
import { parseISO } from 'date-fns';

import {
  createKeywordIndexLog,
  getKeywordIndexLogs,
} from '@client/src/api/keywords';
import {
  KEYWORD_INDEX_SOURCES,
  KEYWORD_INDEX_SOURCE_LABELS,
  KEYWORD_INDEX_PERIODS,
  KEYWORD_INDEX_PERIOD_LABELS,
} from '@shared/api.interface';
import type {
  KeywordIndexSource,
  KeywordIndexPeriod,
  KeywordIndexLatestBySource,
  KeywordIndexLog,
} from '@shared/api.interface';

import { getDataloom } from '@lark-apaas/client-toolkit/dataloom';
import { getDefaultBucketId } from '@lark-apaas/client-toolkit/tools/storage';
import { logger } from '@lark-apaas/client-toolkit/logger';
import { toast } from 'sonner';
import { Image } from '@client/src/components/ui/image';

/* ============================================================
 * IndexRegisterDialog — 指数截图登记弹窗
 * ============================================================ */

export interface IndexRegisterDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  keywordId: string;
  keywordText: string;
  onSuccess?: () => void;
}

export const IndexRegisterDialog: React.FC<IndexRegisterDialogProps> = ({
  open,
  onOpenChange,
  keywordId,
  keywordText,
  onSuccess,
}) => {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [source, setSource] = useState<KeywordIndexSource | ''>('baidu');
  const [period, setPeriod] = useState<KeywordIndexPeriod>('30d');
  const [valueStr, setValueStr] = useState('');
  const [collectedAt, setCollectedAt] = useState<string>(
    format(new Date(), 'yyyy-MM-dd'),
  );
  const [remark, setRemark] = useState('');
  const [screenshotUrl, setScreenshotUrl] = useState('');
  const [screenshotName, setScreenshotName] = useState('');
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const resetForm = () => {
    setSource('baidu');
    setPeriod('30d');
    setValueStr('');
    setCollectedAt(format(new Date(), 'yyyy-MM-dd'));
    setRemark('');
    setScreenshotUrl('');
    setScreenshotName('');
  };

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      resetForm();
    }
    onOpenChange(next);
  };

  const handleFile = async (file: File) => {
    // 校验类型
    if (!/^image\/(png|jpe?g)$/.test(file.type)) {
      toast.error('仅支持 png / jpg 格式的截图');
      return;
    }
    // 校验大小
    if (file.size > 5 * 1024 * 1024) {
      toast.error('图片大小不能超过 5MB');
      return;
    }
    setUploading(true);
    try {
      const dataloom = await getDataloom();
      const bucket = dataloom.storage.from(getDefaultBucketId());
      const result = await bucket.uploadFile(file);
      if (result.error) {
        throw result.error;
      }
      if (!result.data) {
        throw new Error('上传失败：未返回数据');
      }
      setScreenshotUrl(result.data.download_url);
      setScreenshotName(file.name);
      logger.info('指数截图上传成功', result.data.download_url);
    } catch (err: any) {
      const msg = err?.error_msg || err?.message || '截图上传失败，请重试';
      logger.error('指数截图上传失败', err);
      toast.error(msg);
    } finally {
      setUploading(false);
    }
  };

  const onFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    // 允许重复选择同一文件
    e.target.value = '';
  };

  const onDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  };

  const removeScreenshot = () => {
    setScreenshotUrl('');
    setScreenshotName('');
  };

  const createMutation = useMutation({
    mutationFn: createKeywordIndexLog,
    retry: false,
    onSuccess: (data) => {
      logger.info('指数登记成功', { keywordId, logId: data?.data?.id });
      queryClient.invalidateQueries({ queryKey: ['keyword-index-batch'] });
      queryClient.invalidateQueries({ queryKey: ['keyword-index-logs', keywordId ] });
      toast.success('登记成功');
      onSuccess?.();
      handleOpenChange(false);
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.error?.message
        || err?.response?.data?.message
        || err?.message
        || '登记失败，请重试';
      logger.error('指数登记失败', err);
      toast.error(msg);
    },
  });

  const handleSubmit = () => {
    if (!source) {
      toast.error('请选择来源');
      return;
    }
    if (!screenshotUrl) {
      toast.error('请先上传指数截图');
      return;
    }
    const valueNum = Number(valueStr);
    if (!valueStr || !Number.isInteger(valueNum) || valueNum <= 0) {
      toast.error('请填写截图中的指数值（正整数）');
      return;
    }
    if (!collectedAt) {
      toast.error('请选择采集日期');
      return;
    }
    createMutation.mutate({
      keywordId,
      keywordText,
      source: source as KeywordIndexSource,
      value: valueNum,
      period,
      collectedAt,
      screenshotUrl,
      remark: remark.trim() || undefined,
    });
  };

  const todayStr = format(new Date(), 'yyyy-MM-dd');

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>登记指数截图</DialogTitle>
          <DialogDescription className="text-xs">
            关键词：{keywordText}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* 来源 */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium">
              来源 <span className="text-red-500">*</span>
            </label>
            <Select
              value={source}
              onValueChange={(v) => setSource(v as KeywordIndexSource | '')}
            >
              <SelectTrigger className="h-9 w-full">
                <SelectValue placeholder="请选择来源" />
              </SelectTrigger>
              <SelectContent>
                {KEYWORD_INDEX_SOURCES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {KEYWORD_INDEX_SOURCE_LABELS[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* 趋势周期 */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium">
              趋势周期 <span className="text-red-500">*</span>
            </label>
            <Select
              value={period}
              onValueChange={(v) => setPeriod(v as KeywordIndexPeriod)}
            >
              <SelectTrigger className="h-9 w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {KEYWORD_INDEX_PERIODS.map((p) => (
                  <SelectItem key={p} value={p}>
                    {KEYWORD_INDEX_PERIOD_LABELS[p]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* 上传截图 */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium">
              上传截图 <span className="text-red-500">*</span>
              <span className="ml-1 text-xs font-normal text-muted-foreground">
                png / jpg，≤5MB
              </span>
            </label>
            {screenshotUrl ? (
              <div className="flex items-center gap-3 rounded-lg border border-[#E5E9F2] p-3">
                <Image
                  src={screenshotUrl}
                  alt={screenshotName}
                  className="h-[60px] w-[60px] rounded object-cover"
                />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm text-[#101828]">
                    {screenshotName}
                  </div>
                  <p
                    className="mt-0.5 text-[12px]"
                    style={{ color: '#98A2B3' }}
                  >
                    自动识别暂不可用，请手工填写截图中的指数值
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                  onClick={removeScreenshot}
                  aria-label="删除截图"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={onDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-6 transition-colors ${
                  dragOver
                    ? 'border-[#3B5BFF] bg-[#3B5BFF]/5'
                    : 'border-[#E5E9F2] bg-[#F7F9FC] hover:border-[#3B5BFF]/40'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg"
                  className="hidden"
                  onChange={onFileInputChange}
                />
                {uploading ? (
                  <>
                    <Loader2 className="mb-2 h-6 w-6 animate-spin text-[#3B5BFF]" />
                    <p className="text-sm text-[#475467]">上传中…</p>
                  </>
                ) : (
                  <>
                    <UploadCloud className="mb-2 h-6 w-6 text-muted-foreground" />
                    <p className="text-sm text-[#475467]">
                      点击或拖拽图片到此处上传
                    </p>
                    <p className="mt-1 text-[12px] text-[#98A2B3]">
                      支持 png / jpg，单张 ≤ 5MB
                    </p>
                  </>
                )}
              </div>
            )}
          </div>

          {/* 指数值 */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium">
              指数值 <span className="text-red-500">*</span>
            </label>
            <div>
              <Input
                type="number"
                inputMode="numeric"
                value={valueStr}
                onChange={(e) => setValueStr(e.target.value)}
                placeholder="请填写截图中的指数值"
                className="h-9"
              />
              {screenshotUrl && (
                <p
                  className="mt-1 text-[12px]"
                  style={{ color: '#98A2B3' }}
                >
                  自动识别暂不可用，请手工填写截图中的指数值
                </p>
              )}
            </div>
          </div>

          {/* 采集日期 */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium">
              采集日期 <span className="text-red-500">*</span>
            </label>
            <Popover>
              <PopoverTrigger asChild>
                <div className="relative w-full">
                  <Input
                    value={collectedAt}
                    readOnly
                    placeholder="选择日期"
                    className="h-9 pr-9 cursor-pointer"
                  />
                  <CalendarIcon className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                </div>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={collectedAt ? parseISO(collectedAt) : undefined}
                  onSelect={(date) => {
                    if (date) {
                      setCollectedAt(format(date, 'yyyy-MM-dd'));
                    }
                  }}
                  locale={zhCN}
                  disabled={{ after: new Date() }}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* 备注 */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium">备注</label>
            <Textarea
              value={remark}
              onChange={(e) =>
                setRemark(e.target.value.slice(0, 200))
              }
              placeholder="可选，最多 200 字"
              className="min-h-[80px] resize-y"
            />
            <p className="text-right text-[12px] text-[#98A2B3]">
              {remark.length}/200
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            取消
          </Button>
          <Button
            className="bg-[#3B5BFF] text-white hover:bg-[#3B5BFF]/90"
            disabled={createMutation.isPending}
            onClick={handleSubmit}
          >
            {createMutation.isPending ? '保存中...' : '保存'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

/* ============================================================
 * IndexDetailDialog — 指数截图详情弹窗
 * ============================================================ */

export interface IndexDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  keywordId: string;
  keywordText: string;
}

export const IndexDetailDialog: React.FC<IndexDetailDialogProps> = ({
  open,
  onOpenChange,
  keywordId,
  keywordText,
}) => {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['keyword-index-logs', keywordId],
    queryFn: () => getKeywordIndexLogs(keywordId),
    enabled: open && !!keywordId,
  });

  const logs = data?.data ?? [];
  const baiduLogs = logs
    .filter((l) => l.source === 'baidu')
    .sort(
      (a, b) =>
        new Date(b.collectedAt).getTime() - new Date(a.collectedAt).getTime(),
    );
  const weixinLogs = logs
    .filter((l) => l.source === 'weixin')
    .sort(
      (a, b) =>
        new Date(b.collectedAt).getTime() - new Date(a.collectedAt).getTime(),
    );

  const defaultTab: KeywordIndexSource =
    baiduLogs.length > 0 ? 'baidu' : weixinLogs.length > 0 ? 'weixin' : 'baidu';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[640px] max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>
            指数截图详情
            <span className="ml-2 text-sm font-normal text-muted-foreground">
              {keywordText}
            </span>
          </DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="space-y-3 py-4">
            <Skeleton className="h-[200px] w-full rounded-lg" />
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-16 w-full rounded-lg" />
          </div>
        ) : isError ? (
          <div className="py-10 text-center text-sm text-muted-foreground">
            加载失败，请重试
          </div>
        ) : (
          <Tabs
            defaultValue={defaultTab}
            className="flex-1 min-h-0 flex flex-col"
          >
            <TabsList>
              <TabsTrigger value="baidu">
                百度指数
                {baiduLogs.length === 0 && (
                  <span className="ml-1 text-[12px] text-[#98A2B3]">
                    暂无记录
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger value="weixin">
                微信指数
                {weixinLogs.length === 0 && (
                  <span className="ml-1 text-[12px] text-[#98A2B3]">
                    暂无记录
                  </span>
                )}
              </TabsTrigger>
            </TabsList>

            <TabsContent
              value="baidu"
              className="flex-1 min-h-0 overflow-y-auto mt-3"
            >
              <LogList logs={baiduLogs} source="baidu" />
            </TabsContent>
            <TabsContent
              value="weixin"
              className="flex-1 min-h-0 overflow-y-auto mt-3"
            >
              <LogList logs={weixinLogs} source="weixin" />
            </TabsContent>
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  );
};

/* ---- 历史记录列表 ---- */

interface LogListProps {
  logs: KeywordIndexLog[];
  source: KeywordIndexSource;
}

const LogList: React.FC<LogListProps> = ({ logs, source }) => {
  if (logs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <ImageIcon className="mb-3 h-10 w-10 text-[#D0D5DD]" />
        <p className="text-sm text-[#667085]">暂无{KEYWORD_INDEX_SOURCE_LABELS[source]}记录</p>
        <p className="mt-1 text-[12px] text-[#98A2B3]">
          点击「登记」上传第一条指数截图
        </p>
      </div>
    );
  }

  const latest = logs[0];

  return (
    <div className="space-y-4">
      {/* 最新大图 */}
      <div className="space-y-2">
        <p className="text-xs text-[#98A2B3]">最新截图</p>
        <div
          className="flex w-full items-center justify-center overflow-hidden rounded-lg border border-[#E5E9F2] bg-[#F7F9FC] cursor-pointer"
          style={{ maxHeight: 400 }}
          onClick={() => window.open(latest.screenshotUrl, '_blank')}
        >
          <Image
            src={latest.screenshotUrl}
            alt={`${KEYWORD_INDEX_SOURCE_LABELS[source]}截图`}
            className="w-full object-contain"
            style={{ maxHeight: 400 }}
          />
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span
              className="text-[22px] font-bold tabular-nums"
              style={{ color: '#0f172a' }}
            >
              {latest.value.toLocaleString()}
            </span>
            <Badge
              variant="secondary"
              className="whitespace-nowrap bg-gray-100 text-xs text-gray-600"
            >
              {KEYWORD_INDEX_SOURCE_LABELS[source]}
            </Badge>
          </div>
          <p className="text-xs text-[#98A2B3]">
            {KEYWORD_INDEX_PERIOD_LABELS[latest.period]} · {latest.collectedAt} 采集
          </p>
        </div>
      </div>

      {/* 历史列表 */}
      <div className="space-y-2">
        <p className="text-xs text-[#98A2B3]">历史记录</p>
        <div className="space-y-2">
          {logs.map((log) => (
            <div
              key={log.id}
              className="flex gap-3 rounded-lg border border-[#E5E9F2] p-3"
            >
              <Image
                src={log.screenshotUrl}
                alt={KEYWORD_INDEX_SOURCE_LABELS[source]}
                className="h-[60px] w-[60px] shrink-0 cursor-pointer rounded object-cover"
                onClick={() => window.open(log.screenshotUrl, '_blank')}
              />
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-[16px] font-semibold tabular-nums text-[#0f172a]">
                    {log.value.toLocaleString()}
                  </span>
                  <Badge
                    variant="secondary"
                    className="whitespace-nowrap bg-gray-100 text-[11px] text-gray-600"
                  >
                    {KEYWORD_INDEX_SOURCE_LABELS[source]}
                  </Badge>
                </div>
                <div className="text-[12px] text-[#667085]">
                  周期：{KEYWORD_INDEX_PERIOD_LABELS[log.period]} · 采集日期：
                  {log.collectedAt}
                </div>
                {log.createdBy && (
                  <div className="text-[12px] text-[#98A2B3]">
                    上传人：{log.createdBy}
                  </div>
                )}
                {log.remark && (
                  <div className="text-[12px] text-[#475467]">
                    备注：{log.remark}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

/* ============================================================
 * IndexCell — 表格指数列单元格
 * ============================================================ */

export interface IndexCellProps {
  keywordId: string;
  latestData: KeywordIndexLatestBySource | undefined;
  onRegister: () => void;
  onViewDetail: () => void;
}

export const IndexCell: React.FC<IndexCellProps> = ({
  latestData,
  onRegister,
  onViewDetail,
}) => {
  const baidu = latestData?.baidu;
  const weixin = latestData?.weixin;
  const hasAny = !!baidu || !!weixin;

  const tooltipText = (() => {
    const parts: string[] = [];
    parts.push(`百度：${baidu ? baidu.collectedAt + ' 采集' : '暂无记录'}`);
    parts.push(`微信：${weixin ? weixin.collectedAt + ' 采集' : '暂无记录'}`);
    return parts.join('\n');
  })();

  if (!hasAny) {
    return (
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          className="text-left cursor-pointer text-muted-foreground hover:underline"
          onClick={(e) => {
            e.stopPropagation();
            onViewDetail();
          }}
        >
          —
        </button>
        <button
          type="button"
          className="text-[12px] font-medium transition-colors hover:underline whitespace-nowrap"
          style={{ color: '#3B5BFF' }}
          onClick={(e) => {
            e.stopPropagation();
            onRegister();
          }}
        >
          登记
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            className="w-full text-left cursor-pointer"
            onClick={(e) => {
              e.stopPropagation();
              onViewDetail();
            }}
          >
            <div className="flex flex-wrap items-center gap-1.5">
              {baidu && (
                <>
                  <Badge
                    variant="secondary"
                    className="whitespace-nowrap bg-gray-100 text-[11px] text-gray-600"
                  >
                    百度
                  </Badge>
                  <span className="text-[13px] tabular-nums text-[#101828]">
                    {baidu.value.toLocaleString()}
                  </span>
                </>
              )}
              {baidu && weixin && (
                <span className="text-gray-400">·</span>
              )}
              {weixin && (
                <>
                  <Badge
                    variant="secondary"
                    className="whitespace-nowrap bg-gray-100 text-[11px] text-gray-600"
                  >
                    微信
                  </Badge>
                  <span className="text-[13px] tabular-nums text-[#101828]">
                    {weixin.value.toLocaleString()}
                  </span>
                </>
              )}
            </div>
          </button>
        </TooltipTrigger>
        <TooltipContent side="top" className="text-xs whitespace-pre-line">
          {tooltipText}
        </TooltipContent>
      </Tooltip>
      <button
        type="button"
        className="text-[12px] font-medium transition-colors hover:underline whitespace-nowrap"
        style={{ color: '#3B5BFF' }}
        onClick={(e) => {
          e.stopPropagation();
          onRegister();
        }}
      >
        登记
      </button>
    </div>
  );
};

export default IndexRegisterDialog;
