import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Zap,
  Trash2,
  RefreshCw,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Plus,
  Eye,
  EyeOff,
  Undo2,
} from 'lucide-react';
import { toast } from 'sonner';

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@client/src/components/ui/card';
import { Button } from '@client/src/components/ui/button';
import { Input } from '@client/src/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@client/src/components/ui/select';
import { Badge } from '@client/src/components/ui/badge';
import { Pill } from '@client/src/components/layout/Pill';
import { Skeleton } from '@client/src/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from '@client/src/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@client/src/components/ui/alert-dialog';
import { Label } from '@client/src/components/ui/label';
import { PageHeader } from '@client/src/components/layout/PageHeader';
import { useBrandSelector } from '@client/src/hooks/useBrandSelector';

import {
  listKeys,
  upsertKey,
  deleteKey,
  testKey,
  setDefault,
  createCreditRequest,
} from '@client/src/api/ai-keys';
import {
  AI_VENDORS,
  AI_VENDOR_LABELS,
  AI_VENDOR_MODELS,
  AI_VENDOR_DEFAULT_BASE_URL,
  CREDIT_PACKAGE_INFO,
  AI_KEY_STATUS_LABELS,
  type AiVendor,
  type AiKeyStatus,
  type AiKeyItem,
  type AiKeyListResponse,
  type CreditPackage,
} from '@shared/api.interface';

const PRIMARY = '#2E7DFF';
const SUCCESS = '#10B981';
const WARNING = '#F59E0B';
const DANGER = '#EF4444';
const MUTED = '#94A3B8';
const BRAND_PRIMARY = '#7C3AED'; // 品牌默认：蓝紫色

/* ---------------- 厂商彩色方块 ---------------- */

const VENDOR_GRADIENTS: Record<AiVendor, string> = {
  volcano: 'linear-gradient(135deg, #FF6B35, #F7931E)',
  deepseek: 'linear-gradient(135deg, #4F46E5, #7C3AED)',
  qwen: 'linear-gradient(135deg, #FF6B6B, #FFA502)',
  kimi: 'linear-gradient(135deg, #0EA5E9, #2563EB)',
  zhipu: 'linear-gradient(135deg, #10B981, #059669)',
  minimax: 'linear-gradient(135deg, #EC4899, #F43F5E)',
  wenxin: 'linear-gradient(135deg, #2563EB, #1D4ED8)',
  hunyuan: 'linear-gradient(135deg, #059669, #10B981)',
  spark: 'linear-gradient(135deg, #0891B2, #0E7490)',
  openai: 'linear-gradient(135deg, #10A37F, #0D9488)',
  gemini: 'linear-gradient(135deg, #4285F4, #34A853)',
  siliconflow: 'linear-gradient(135deg, #6366F1, #8B5CF6)',
};

const VENDOR_SHORT_NAMES: Record<AiVendor, string> = {
  volcano: '火山',
  deepseek: 'Deep',
  qwen: '通义',
  kimi: 'Kimi',
  zhipu: '智谱',
  minimax: 'Mini',
  wenxin: '文心',
  hunyuan: '混元',
  spark: '星火',
  openai: 'GPT',
  gemini: 'Gem',
  siliconflow: '硅基',
};

const formatNumber = (n: number): string => n.toLocaleString('zh-CN');

function summarizeTestError(raw: string | undefined | null): string {
  if (!raw) return '连接失败，请检查 API Key 或模型名称是否正确';
  const msg = raw.toLowerCase();
  if (msg.includes('api key') || msg.includes('api_key') || msg.includes('invalid') || msg.includes('unauthorized') || msg.includes('401') || msg.includes('403') || msg.includes('认证') || msg.includes('invalid_api_key')) {
    return 'API Key 无效';
  }
  if (msg.includes('model') && (msg.includes('not exist') || msg.includes('not found') || msg.includes('no such') || msg.includes('不可用') || msg.includes('不存在') || msg.includes('access'))) {
    return '模型不可用或无权限';
  }
  if (msg.includes('timeout') || msg.includes('超时') || msg.includes('network') || msg.includes('econn') || msg.includes('socket hang up')) {
    return '网络超时';
  }
  if (msg.includes('rate limit') || msg.includes('quota') || msg.includes('insufficient') || msg.includes('限额') || msg.includes('余额不足')) {
    return '额度不足';
  }
  return '连接失败，请检查 API Key 或模型名称是否正确（hover 看详情）';
}

/* ---------------- 状态胶囊 ---------------- */

function StatusBadge({ status, errorMessage }: { status: AiKeyStatus; errorMessage?: string }) {
  if (status === 'ok') {
    return (
      <Badge
        variant="outline"
        className="border-0"
        style={{
          backgroundColor: 'rgba(16, 185, 129, 0.1)',
          color: SUCCESS,
        }}
      >
        <CheckCircle2 className="mr-1 size-3" />
        {AI_KEY_STATUS_LABELS[status]}
      </Badge>
    );
  }
  if (status === 'failed') {
    return (
      <Badge
        variant="outline"
        className="border-0"
        style={{
          backgroundColor: 'rgba(239, 68, 68, 0.1)',
          color: DANGER,
        }}
        title={errorMessage || '连接失败，点击测试连接重试'}
      >
        <XCircle className="mr-1 size-3" />
        {AI_KEY_STATUS_LABELS[status]}
      </Badge>
    );
  }
  return (
    <Badge
      variant="outline"
      className="border-0"
      style={{
        backgroundColor: '#F1F5F9',
        color: MUTED,
      }}
    >
      <AlertCircle className="mr-1 size-3" />
      {AI_KEY_STATUS_LABELS[status]}
    </Badge>
  );
}

/* ---------------- 厂商卡片骨架 ---------------- */

function VendorCardSkeleton() {
  return (
    <Card className="overflow-hidden">
      <CardContent className="pt-5">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Skeleton className="h-8 w-8 rounded-md" />
            <Skeleton className="h-4 w-24" />
          </div>
          <Skeleton className="h-5 w-16" />
        </div>
        <Skeleton className="mb-2 h-3 w-16" />
        <Skeleton className="mb-3 h-9 w-full" />
        <Skeleton className="mb-2 h-3 w-20" />
        <Skeleton className="mb-3 h-9 w-full" />
        <Skeleton className="mb-2 h-3 w-16" />
        <Skeleton className="mb-4 h-9 w-full" />
        <div className="flex gap-2">
          <Skeleton className="h-9 flex-1" />
          <Skeleton className="h-9 flex-1" />
        </div>
      </CardContent>
    </Card>
  );
}

/* ---------------- 配置范围切换器 ---------------- */

type ConfigScope = 'platform' | 'brand';

interface ScopeSwitcherProps {
  scope: ConfigScope;
  onScopeChange: (s: ConfigScope) => void;
  brandOptions: Array<{ id: string; name: string }>;
  selectedBrandId: string;
  onBrandChange: (id: string) => void;
  isBrandLoading: boolean;
}

function ScopeSwitcher({
  scope,
  onScopeChange,
  brandOptions,
  selectedBrandId,
  onBrandChange,
  isBrandLoading,
}: ScopeSwitcherProps) {
  return (
    <Card className="overflow-hidden">
      <CardContent className="flex flex-col items-center justify-between gap-3 py-4 sm:flex-row">
        <div className="text-sm font-medium" style={{ color: '#0f172a' }}>
          配置范围
        </div>
        <div className="flex items-center gap-3">
          <div className="inline-flex rounded-lg bg-gray-100 p-[3px]">
            <Button
              variant="ghost"
              size="sm"
              className={`h-8 px-4 text-sm ${
                scope === 'platform'
                  ? 'bg-white shadow-sm font-medium'
                  : 'text-gray-500 font-normal hover:bg-transparent'
              }`}
              style={{ color: scope === 'platform' ? PRIMARY : undefined }}
              onClick={() => onScopeChange('platform')}
            >
              平台默认
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className={`h-8 px-4 text-sm ${
                scope === 'brand'
                  ? 'bg-white shadow-sm font-medium'
                  : 'text-gray-500 font-normal hover:bg-transparent'
              }`}
              style={{ color: scope === 'brand' ? BRAND_PRIMARY : undefined }}
              onClick={() => onScopeChange('brand')}
            >
              按品牌
            </Button>
          </div>
          {scope === 'brand' && (
            <Select
              value={selectedBrandId}
              onValueChange={onBrandChange}
              disabled={isBrandLoading}
            >
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="选择品牌" />
              </SelectTrigger>
              <SelectContent>
                {brandOptions.map((b) => (
                  <SelectItem key={b.id} value={b.id}>
                    {b.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

/* ---------------- 顶部当前生效模型卡片 ---------------- */

interface ActiveModelCardProps {
  data: AiKeyListResponse;
  scope: ConfigScope;
  onTest: () => void;
  isTesting: boolean;
}

function ActiveModelCard({ data, scope, onTest, isTesting }: ActiveModelCardProps) {
  const defaultItem = useMemo(() => {
    if (!data.defaultVendor) return null;
    return data.items.find((it: AiKeyItem) => it.vendor === data.defaultVendor) ?? null;
  }, [data]);

  if (!defaultItem || !data.defaultVendor) {
    return (
      <Card className="overflow-hidden">
        <CardContent className="flex flex-col items-center justify-center py-10">
          <AlertCircle className="mb-3 size-10" style={{ color: MUTED }} />
          <div className="text-base font-medium" style={{ color: '#0f172a' }}>
            未配置默认模型
          </div>
          <div className="mt-1 text-sm" style={{ color: MUTED }}>
            请在下方配置一个模型 Key 并设为默认
          </div>
        </CardContent>
      </Card>
    );
  }

  // Badge 文字与颜色
  let badgeText = '平台默认';
  let badgeBg = 'rgba(46, 125, 255, 0.1)';
  let badgeColor = PRIMARY;

  if (scope === 'brand') {
    if (data.defaultSource === 'brand') {
      badgeText = '品牌默认';
      badgeBg = 'rgba(124, 58, 237, 0.1)';
      badgeColor = BRAND_PRIMARY;
    } else {
      // 继承平台默认
      badgeText = '继承平台默认';
      badgeBg = '#F1F5F9';
      badgeColor = MUTED;
    }
  }

  return (
    <Card className="overflow-hidden">
      <CardContent className="pt-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-start gap-4">
            <div
              className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg text-sm font-bold text-white"
              style={{ background: VENDOR_GRADIENTS[data.defaultVendor] }}
            >
              {VENDOR_SHORT_NAMES[data.defaultVendor]}
            </div>
            <div>
              <div className="mb-1 text-sm" style={{ color: MUTED }}>
                当前生效模型
              </div>
              <div
                className="text-2xl font-semibold leading-none"
                style={{ color: '#0f172a' }}
              >
                {AI_VENDOR_LABELS[data.defaultVendor]}
                <span className="mx-2 text-base font-normal" style={{ color: '#94A3B8' }}>
                  ·
                </span>
                <span className="text-lg font-medium">
                  {defaultItem.model || '未选择模型'}
                </span>
              </div>
              <div className="mt-3 flex items-center gap-2">
                <Badge
                  variant="outline"
                  className="border-0"
                  style={{
                    backgroundColor: badgeBg,
                    color: badgeColor,
                  }}
                >
                  {badgeText}
                </Badge>
                <StatusBadge
                  status={defaultItem.status}
                  errorMessage={defaultItem.lastTestError ?? undefined}
                />
              </div>
              <div className="mt-3 flex items-center gap-5 text-xs" style={{ color: MUTED }}>
                <span>本月调用 {formatNumber(data.monthlyCalls)} 次</span>
                <span>消耗 {formatNumber(data.monthlyTokens)} tokens</span>
              </div>
            </div>
          </div>
          <Button
            onClick={onTest}
            disabled={isTesting}
            style={{ backgroundColor: PRIMARY }}
          >
            <RefreshCw className={`size-4 ${isTesting ? 'animate-spin' : ''}`} />
            {isTesting ? '测试中...' : '测试连接'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

/* ---------------- 单个厂商 Key 卡片 ---------------- */

interface VendorCardProps {
  vendor: AiVendor;
  item: AiKeyItem | null;
  scope: ConfigScope;
  brandOverride: boolean;
  onSave: (vendor: AiVendor, data: { model: string; baseUrl: string; apiKey: string }) => void;
  onTest: (vendor: AiVendor) => void;
  onDelete: (vendor: AiVendor) => void;
  isSaving: boolean;
  isTesting: boolean;
  isDeleting: boolean;
}

function VendorCard({
  vendor,
  item,
  scope,
  brandOverride,
  onSave,
  onTest,
  onDelete,
  isSaving,
  isTesting,
  isDeleting,
}: VendorCardProps) {
  const defaultModel = AI_VENDOR_MODELS[vendor][0] ?? '';
  const defaultBaseUrl = AI_VENDOR_DEFAULT_BASE_URL[vendor];

  const [expanded, setExpanded] = useState<boolean>(false);
  const [model, setModel] = useState<string>(item?.model ?? defaultModel);
  const [baseUrl, setBaseUrl] = useState<string>(item?.baseUrl ?? defaultBaseUrl);
  const [apiKey, setApiKey] = useState<string>('');
  const [showKey, setShowKey] = useState<boolean>(false);
  const [modelOptionsOpen, setModelOptionsOpen] = useState<boolean>(false);
  const modelComboboxRef = useRef<HTMLDivElement>(null);

  const filteredModelOptions = useMemo(() => {
    const models = AI_VENDOR_MODELS[vendor];
    if (!model) return models;
    const lower = model.toLowerCase();
    return models.filter((m: string) => m.toLowerCase().includes(lower));
  }, [model, vendor]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (modelComboboxRef.current && !modelComboboxRef.current.contains(e.target as Node)) {
        setModelOptionsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const status = item?.status ?? 'unconfigured';

  const handleExpand = () => {
    setExpanded(true);
    setModel(item?.model ?? defaultModel);
    setBaseUrl(item?.baseUrl ?? defaultBaseUrl);
    setApiKey('');
  };

  const handleCollapse = () => {
    setExpanded(false);
    setApiKey('');
    setShowKey(false);
  };

  const handleSave = () => {
    if (!apiKey.trim()) {
      toast.error('请输入 API Key');
      return;
    }
    onSave(vendor, { model, baseUrl, apiKey });
    setApiKey('');
  };

  const handleTest = () => {
    // 平台默认 / 继承状态下，收起时测试的是平台级配置
    // 展开时测试需要先填 Key
    const isCollapsedPlatform = !expanded && scope === 'platform' && item?.ownerType === 'platform';
    const isCollapsedInherited = !expanded && scope === 'brand' && !brandOverride && item;
    if (expanded && !isCollapsedPlatform && !isCollapsedInherited && !apiKey.trim()) {
      toast.error('请先输入 API Key');
      return;
    }
    onTest(vendor);
  };

  // ---- 品牌视图：状态 A 继承平台默认 ----
  const isBrandInherited = scope === 'brand' && item && !brandOverride;
  // ---- 品牌视图：状态 B 品牌独立配置 ----
  const isBrandIndependent = scope === 'brand' && item && brandOverride;
  // ---- 平台视图：未配置 ----
  const isPlatformUnconfigured = scope === 'platform' && !item;
  // ---- 平台视图：已配置（平台级） ----
  const isPlatformConfigured = scope === 'platform' && item && item.ownerType === 'platform';

  return (
    <Card className="relative overflow-hidden" data-ai-section-type="card-list">
      {/* 删除 / 恢复按钮：仅品牌独立配置 或 平台自有配置时显示 */}
      {isBrandIndependent && (
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-3 top-3 size-7"
              aria-label="恢复为继承平台默认"
            >
              <Undo2 className="size-4" style={{ color: MUTED }} />
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>恢复为继承平台默认</AlertDialogTitle>
              <AlertDialogDescription>
                恢复后该品牌将使用平台默认配置，是否确认？
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>取消</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => onDelete(vendor)}
                disabled={isDeleting}
                style={{ backgroundColor: DANGER }}
              >
                {isDeleting ? '恢复中...' : '确认恢复'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}

      {isPlatformConfigured && (
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-3 top-3 size-7"
              aria-label="删除配置"
            >
              <Trash2 className="size-4" style={{ color: MUTED }} />
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>确认删除</AlertDialogTitle>
              <AlertDialogDescription>
                删除后平台将不再有该厂商的默认配置，是否确认删除？
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>取消</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => onDelete(vendor)}
                disabled={isDeleting}
                style={{ backgroundColor: DANGER }}
              >
                {isDeleting ? '删除中...' : '确认删除'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}

      <CardContent className="relative pt-5">
        {/* 头部 */}
        <div className="mb-3">
          <div className="flex items-start gap-2">
            <div
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-xs font-bold text-white"
              style={{ background: VENDOR_GRADIENTS[vendor] }}
            >
              {VENDOR_SHORT_NAMES[vendor].slice(0, 2)}
            </div>
            <div className="min-w-0 flex-1">
              <div
                className="text-sm font-medium leading-5"
                style={{ color: '#0f172a' }}
              >
                {AI_VENDOR_LABELS[vendor]}
              </div>
              <div className="mt-1.5 flex flex-wrap items-center gap-2">
                <StatusBadge status={status} errorMessage={item?.lastTestError ?? undefined} />
                {item?.isDefault && (
                  <Pill variant="info">默认</Pill>
                )}
                {isBrandInherited && (
                  <Pill variant="muted">继承平台默认</Pill>
                )}
                {isBrandIndependent && (
                  <Pill variant="info">品牌独立配置</Pill>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* 收起态 */}
        {!expanded && (
          <div className="space-y-3">
            {/* 平台视图：未配置 */}
            {isPlatformUnconfigured && (
              <div className="flex items-center justify-between">
                <span className="text-sm" style={{ color: MUTED }}>
                  尚未配置
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleExpand}
                  style={{ color: PRIMARY, borderColor: 'rgba(46, 125, 255, 0.3)' }}
                >
                  <Plus className="size-3.5" />
                  去配置
                </Button>
              </div>
            )}

            {/* 平台视图：已配置（平台级） */}
            {isPlatformConfigured && (
              <div className="space-y-2">
                <div className="text-sm font-medium" style={{ color: '#0f172a' }}>
                  平台配置 · {item.model || '未选择模型'}
                </div>
                {status === 'failed' && (
                  <div
                    className="text-xs leading-relaxed line-clamp-2"
                    style={{ color: DANGER }}
                    title={item.lastTestError || ''}
                  >
                    最近测试失败：{summarizeTestError(item.lastTestError)}
                  </div>
                )}
                <div className="flex gap-2 pt-1">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleExpand}
                    className="flex-1"
                  >
                    编辑
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleTest}
                    disabled={isTesting}
                    className="flex-1"
                  >
                    <RefreshCw
                      className={`size-3.5 ${isTesting ? 'animate-spin' : ''}`}
                    />
                    测试连接
                  </Button>
                </div>
              </div>
            )}

            {/* 品牌视图：状态 A — 继承平台默认 */}
            {isBrandInherited && (
              <div
                className="rounded-lg border p-3"
                style={{
                  backgroundColor: '#F8FAFC',
                  borderColor: '#E5E9F2',
                }}
              >
                <div className="mb-2 flex items-center justify-between">
                  <div className="text-xs" style={{ color: MUTED }}>
                    继承平台配置 · {item.model || '未选择模型'}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleTest}
                    disabled={isTesting}
                    className="h-7 px-2 text-xs"
                    style={{ color: PRIMARY }}
                  >
                    <RefreshCw
                      className={`mr-1 size-3 ${isTesting ? 'animate-spin' : ''}`}
                    />
                    测试
                  </Button>
                </div>
                {status === 'failed' && item.lastTestError && (
                  <div
                    className="mb-2 text-xs leading-relaxed line-clamp-2"
                    style={{ color: DANGER }}
                    title={item.lastTestError}
                  >
                    最近测试失败：{summarizeTestError(item.lastTestError)}
                  </div>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleExpand}
                  className="w-full"
                  style={{
                    borderColor: 'rgba(124, 58, 237, 0.3)',
                    color: BRAND_PRIMARY,
                  }}
                >
                  <Plus className="size-3.5" />
                  独立配置
                </Button>
              </div>
            )}

            {/* 品牌视图：状态 B — 品牌独立配置 */}
            {isBrandIndependent && (
              <div className="space-y-2">
                <div className="text-sm font-medium" style={{ color: '#0f172a' }}>
                  品牌配置 · {item.model || '未选择模型'}
                </div>
                {status === 'failed' && (
                  <div
                    className="text-xs leading-relaxed line-clamp-2"
                    style={{ color: DANGER }}
                    title={item.lastTestError || ''}
                  >
                    最近测试失败：{summarizeTestError(item.lastTestError)}
                  </div>
                )}
                <div className="flex gap-2 pt-1">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleExpand}
                    className="flex-1"
                  >
                    编辑
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleTest}
                    disabled={isTesting}
                    className="flex-1"
                  >
                    <RefreshCw
                      className={`size-3.5 ${isTesting ? 'animate-spin' : ''}`}
                    />
                    测试连接
                  </Button>
                </div>
              </div>
            )}

            {/* 品牌视图：完全未配置（平台也没配，品牌也没配） */}
            {scope === 'brand' && !item && (
              <div className="flex items-center justify-between">
                <span className="text-sm" style={{ color: MUTED }}>
                  尚未配置
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleExpand}
                  style={{
                    color: BRAND_PRIMARY,
                    borderColor: 'rgba(124, 58, 237, 0.3)',
                  }}
                >
                  <Plus className="size-3.5" />
                  独立配置
                </Button>
              </div>
            )}
          </div>
        )}

        {/* 展开态 */}
        {expanded && (
          <div className="space-y-3">
            <div>
              <Label className="mb-1.5 block text-xs" style={{ color: MUTED }}>
                模型
              </Label>
              <div className="relative" ref={modelComboboxRef}>
                <Input
                  value={model}
                  onChange={(e) => {
                    setModel(e.target.value);
                    setModelOptionsOpen(true);
                  }}
                  onFocus={() => setModelOptionsOpen(true)}
                  placeholder="输入或选择模型 ID"
                />
                {modelOptionsOpen && (
                  <div className="absolute left-0 right-0 top-full z-10 mt-1 max-h-40 overflow-y-auto rounded-md border bg-white p-1 shadow-lg">
                    {filteredModelOptions.length > 0 ? (
                      filteredModelOptions.map((m: string) => (
                        <div
                          key={m}
                          className="cursor-pointer rounded px-3 py-1.5 text-sm hover:bg-gray-100"
                          onClick={() => {
                            setModel(m);
                            setModelOptionsOpen(false);
                          }}
                        >
                          {m}
                        </div>
                      ))
                    ) : (
                      <div className="px-3 py-2 text-xs text-gray-400">
                        无匹配预设，可直接输入自定义模型
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div>
              <Label className="mb-1.5 block text-xs" style={{ color: MUTED }}>
                Base URL
              </Label>
              <Input value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} />
            </div>

            <div>
              <Label className="mb-1.5 block text-xs" style={{ color: MUTED }}>
                API Key
              </Label>
              <div className="relative">
                <Input
                  type={showKey ? 'text' : 'password'}
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder={
                    item?.apiKey && !apiKey
                      ? item.apiKey
                      : '请输入 API Key'
                  }
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowKey(!showKey)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1"
                  style={{ color: MUTED }}
                  aria-label={showKey ? '隐藏 Key' : '显示 Key'}
                >
                  {showKey ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </div>

            <div className="flex gap-2 pt-1">
              <Button
                variant="outline"
                size="sm"
                onClick={handleTest}
                disabled={isTesting}
                className="flex-1"
              >
                <RefreshCw
                  className={`size-3.5 ${isTesting ? 'animate-spin' : ''}`}
                />
                测试连接
              </Button>
              <Button
                size="sm"
                onClick={handleSave}
                disabled={isSaving}
                className="flex-1"
                style={{ backgroundColor: PRIMARY }}
              >
                {isSaving ? '保存中...' : '保存'}
              </Button>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCollapse}
              className="w-full"
              style={{ color: MUTED }}
            >
              取消
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/* ---------------- 算力充值卡片 ---------------- */

interface CreditCardProps {
  balance: number;
  brandId: string | null;
  balanceBrandName: string | null;
}

function CreditCard({ balance, brandId, balanceBrandName }: CreditCardProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedPkg, setSelectedPkg] = useState<CreditPackage | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!selectedPkg) {
      toast.error('请选择套餐');
      return;
    }
    if (!brandId) {
      toast.error('未获取到品牌信息');
      return;
    }
    setIsSubmitting(true);
    try {
      await createCreditRequest({ packageType: selectedPkg, brandId });
      toast.success('申请已提交，服务商将尽快处理');
      setDialogOpen(false);
      setSelectedPkg(null);
    } catch (err: any) {
      toast.error(err?.response?.data?.error?.message || '提交失败');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card className="overflow-hidden" data-ai-section-type="card-stat">
      <CardContent className="pt-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-4">
            <div
              className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg"
              style={{
                background: 'linear-gradient(135deg, #00C2FF, #2E7DFF)',
              }}
            >
              <Zap className="size-6 text-white" />
            </div>
            <div>
              <div className="mb-1 text-sm" style={{ color: MUTED }}>
                {balanceBrandName ? `${balanceBrandName} 算力余额` : '算力余额'}
              </div>
              <div
                className="text-3xl font-bold leading-none"
                style={{ color: '#0f172a' }}
              >
                {formatNumber(balance)}
                <span className="ml-2 text-base font-normal" style={{ color: MUTED }}>
                  算力点
                </span>
              </div>
              <div className="mt-1 text-xs" style={{ color: MUTED }}>
                {balanceBrandName
                  ? '当前查看品牌算力，与内容生产页一致'
                  : '用于文章、图片、视频等 AI 生成任务'}
              </div>
            </div>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button style={{ backgroundColor: PRIMARY }}>
                <Zap className="size-4" />
                充值
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>算力充值</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                {(Object.keys(CREDIT_PACKAGE_INFO) as CreditPackage[]).map(
                  (pkg: CreditPackage) => {
                    const info = CREDIT_PACKAGE_INFO[pkg];
                    const isSelected = selectedPkg === pkg;
                    return (
                      <div
                        key={pkg}
                        onClick={() => setSelectedPkg(pkg)}
                        className="cursor-pointer rounded-lg border p-4 transition-colors"
                        role="radio"
                        aria-checked={isSelected}
                        style={{
                          borderColor: isSelected ? PRIMARY : '#E5E9F2',
                          backgroundColor: isSelected
                            ? 'rgba(46, 125, 255, 0.04)'
                            : '#fff',
                        }}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <div
                              className="text-base font-semibold"
                              style={{ color: '#0f172a' }}
                            >
                              {info.name}
                            </div>
                            <div className="mt-1 text-sm" style={{ color: MUTED }}>
                              {formatNumber(info.amount)} 算力点
                            </div>
                          </div>
                          <div
                            className="text-xs"
                            style={{ color: '#94A3B8' }}
                          >
                            {info.priceLabel}
                          </div>
                        </div>
                      </div>
                    );
                  },
                )}
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setDialogOpen(false)}
                >
                  取消
                </Button>
                <Button
                  onClick={handleSubmit}
                  disabled={!selectedPkg || isSubmitting}
                  style={{ backgroundColor: PRIMARY }}
                >
                  {isSubmitting ? '提交中...' : '提交申请'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </CardContent>
    </Card>
  );
}

/* ---------------- 主页面 ---------------- */

const AiKeysPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [testingVendor, setTestingVendor] = useState<string | null>(null);
  const [savingVendor, setSavingVendor] = useState<string | null>(null);
  const [deletingVendor, setDeletingVendor] = useState<string | null>(null);
  const [testingDefault, setTestingDefault] = useState(false);

  // 配置范围
  const [configScope, setConfigScope] = useState<ConfigScope>('platform');

  // 品牌选择器
  const {
    brands,
    selectedBrandId,
    setSelectedBrandId,
    isLoading: isBrandLoading,
  } = useBrandSelector();

  // 有效 brandId：品牌视图下用 selectedBrandId，平台视图下不传
  const effectiveBrandId = configScope === 'brand' ? selectedBrandId : undefined;

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['ai-keys', configScope, effectiveBrandId],
    queryFn: () => listKeys(effectiveBrandId),
    enabled: configScope === 'platform' || !!selectedBrandId,
  });

  const itemsMap = useMemo(() => {
    const map: Record<string, AiKeyItem> = {};
    if (data?.items) {
      data.items.forEach((it: AiKeyItem) => {
        map[it.vendor] = it;
      });
    }
    return map;
  }, [data]);

  const handleSave = async (
    vendor: AiVendor,
    body: { model: string; baseUrl: string; apiKey: string },
  ) => {
    setSavingVendor(vendor);
    try {
      await upsertKey(vendor, body, effectiveBrandId);
      toast.success('保存成功');
      queryClient.invalidateQueries({ queryKey: ['ai-keys', configScope, effectiveBrandId] });
    } catch (err: any) {
      toast.error(err?.response?.data?.error?.message || '保存失败');
    } finally {
      setSavingVendor(null);
    }
  };

  const handleDelete = async (vendor: AiVendor) => {
    setDeletingVendor(vendor);
    try {
      await deleteKey(vendor, effectiveBrandId);
      toast.success(configScope === 'brand' ? '已恢复为继承平台默认' : '删除成功');
      queryClient.invalidateQueries({ queryKey: ['ai-keys', configScope, effectiveBrandId] });
    } catch (err: any) {
      toast.error(err?.response?.data?.error?.message || '操作失败');
    } finally {
      setDeletingVendor(null);
    }
  };

  const handleTest = async (vendor: AiVendor) => {
    setTestingVendor(vendor);
    try {
      const result = await testKey(vendor, effectiveBrandId);
      if (result.ok) {
        toast.success(`连接成功，延迟 ${result.latencyMs}ms`);
      } else {
        const statusPart = result.status ? `HTTP ${result.status}` : '';
        const codePart = result.errorCode ? ` · ${result.errorCode}` : '';
        const prefix = statusPart || codePart ? `连接失败 · ${statusPart}${codePart}` : '连接失败';
        toast.error(`${prefix}${result.errorMessage ? ` · ${result.errorMessage}` : ''}`);
      }
      queryClient.invalidateQueries({ queryKey: ['ai-keys', configScope, effectiveBrandId] });
    } catch (err: any) {
      toast.error(err?.response?.data?.error?.message || '测试失败');
    } finally {
      setTestingVendor(null);
    }
  };

  const handleTestDefault = async () => {
    if (!data?.defaultVendor) return;
    const vendor = data.defaultVendor;
    const defaultItem = data.items.find((it: AiKeyItem) => it.vendor === vendor);
    setTestingDefault(true);
    try {
      const result = await testKey(vendor, effectiveBrandId);
      if (result.ok) {
        toast.success(
          `连接成功 · ${AI_VENDOR_LABELS[vendor]} ${defaultItem?.model || ''} · 延迟 ${result.latencyMs}ms`,
        );
      } else {
        const statusPart = result.status ? `HTTP ${result.status}` : '';
        const codePart = result.errorCode ? ` · ${result.errorCode}` : '';
        const prefix = statusPart || codePart ? `连接失败 · ${statusPart}${codePart}` : '连接失败';
        toast.error(`${prefix}${result.errorMessage ? ` · ${result.errorMessage}` : ''}`);
      }
      queryClient.invalidateQueries({ queryKey: ['ai-keys', configScope, effectiveBrandId] });
    } catch (err: any) {
      toast.error(`连接失败 · ${err?.response?.data?.error?.message || '测试失败'}`);
    } finally {
      setTestingDefault(false);
    }
  };

  const handleSetDefault = async (vendor: string) => {
    try {
      await setDefault({ vendor: vendor as AiVendor }, effectiveBrandId);
      toast.success('已设为默认');
      queryClient.invalidateQueries({ queryKey: ['ai-keys', configScope, effectiveBrandId] });
    } catch (err: any) {
      toast.error(err?.response?.data?.error?.message || '设置失败');
    }
  };

  const defaultVendor = data?.defaultVendor ?? '';

  // 算力卡片的品牌 ID：品牌视图下用当前选中品牌，平台视图下用返回的 balanceBrandId
  const creditBrandId = configScope === 'brand'
    ? selectedBrandId
    : (data?.balanceBrandId ?? null);

  return (
    <div className="space-y-5">
      {/* 页面标题 */}
      <PageHeader
        title="AI 模型接入"
        subtitle="配置各 AI 厂商的 API Key，设置默认模型用于内容生成"
      />

      {/* 配置范围切换 */}
      <ScopeSwitcher
        scope={configScope}
        onScopeChange={setConfigScope}
        brandOptions={brands}
        selectedBrandId={selectedBrandId}
        onBrandChange={setSelectedBrandId}
        isBrandLoading={isBrandLoading}
      />

      {/* 第 1 段：当前生效模型 */}
      {isLoading ? (
        <Card className="overflow-hidden">
          <CardContent className="pt-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div className="flex items-start gap-4">
                <Skeleton className="h-14 w-14 rounded-lg" />
                <div className="space-y-2">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-7 w-64" />
                  <Skeleton className="h-5 w-32" />
                  <Skeleton className="h-3 w-48" />
                </div>
              </div>
              <Skeleton className="h-9 w-28" />
            </div>
          </CardContent>
        </Card>
      ) : isError ? (
        <Card className="overflow-hidden">
          <CardContent className="flex flex-col items-center justify-center py-10">
            <AlertCircle className="mb-3 size-10" style={{ color: DANGER }} />
            <div className="text-base font-medium" style={{ color: '#0f172a' }}>
              加载失败
            </div>
            <Button
              variant="outline"
              onClick={() => refetch()}
              className="mt-3"
            >
              重新加载
            </Button>
          </CardContent>
        </Card>
      ) : data ? (
        <ActiveModelCard
          data={data}
          scope={configScope}
          onTest={handleTestDefault}
          isTesting={testingDefault}
        />
      ) : null}

      {/* 第 2 段：模型 Key 列表 */}
      <Card className="overflow-hidden">
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="font-semibold" style={{ color: '#0f172a' }}>
            模型 Key 配置
          </CardTitle>
          <div className="flex items-center gap-2">
            <span className="text-xs" style={{ color: MUTED }}>
              设为默认
            </span>
            <Select
              value={defaultVendor}
              onValueChange={handleSetDefault}
              disabled={!defaultVendor || isLoading}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="选择默认厂商" />
              </SelectTrigger>
              <SelectContent>
                {AI_VENDORS.map((v: AiVendor) => (
                  <SelectItem key={v} value={v}>
                    {AI_VENDOR_LABELS[v]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 12 }).map((_, i: number) => (
                <VendorCardSkeleton key={i} />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {AI_VENDORS.map((vendor: AiVendor) => (
                <VendorCard
                  key={vendor}
                  vendor={vendor}
                  item={itemsMap[vendor] ?? null}
                  scope={configScope}
                  brandOverride={itemsMap[vendor]?.brandOverride ?? false}
                  onSave={handleSave}
                  onTest={handleTest}
                  onDelete={handleDelete}
                  isSaving={savingVendor === vendor}
                  isTesting={testingVendor === vendor}
                  isDeleting={deletingVendor === vendor}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 第 3 段：算力与充值 */}
      {data ? (
        <CreditCard
          balance={data.balance}
          brandId={creditBrandId}
          balanceBrandName={data.balanceBrandName}
        />
      ) : null}
    </div>
  );
};

export default AiKeysPage;
