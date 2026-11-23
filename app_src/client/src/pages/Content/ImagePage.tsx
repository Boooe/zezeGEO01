import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Image as ImageIcon,
  Download,
  Trash2,
  Plus,
  Sparkles,
  AlertCircle,
  FolderPlus,
  Loader2,
  Wand2,
  Settings,
  CheckCircle2,
  XCircle,
} from 'lucide-react';
import { toast } from 'sonner';

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@client/src/components/ui/card';
import { Button } from '@client/src/components/ui/button';
import { Input } from '@client/src/components/ui/input';
import { Textarea } from '@client/src/components/ui/textarea';
import { Label } from '@client/src/components/ui/label';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@client/src/components/ui/select';
import {
  RadioGroup,
  RadioGroupItem,
} from '@client/src/components/ui/radio-group';
import { Switch } from '@client/src/components/ui/switch';
import { Skeleton } from '@client/src/components/ui/skeleton';
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from '@client/src/components/ui/alert';
import { Badge } from '@client/src/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@client/src/components/ui/dialog';
import { Image } from '@client/src/components/ui/image';
import {
  Empty,
  EmptyMedia,
  EmptyHeader,
  EmptyTitle,
  EmptyContent,
  EmptyDescription,
} from '@client/src/components/ui/empty';

import { content } from '@client/src/api';
import { getApiErrorMessage, isAiQuotaError } from '@client/src/lib/api-error';
import { getBrandList } from '@client/src/api/keywords';
import { useAuth } from '@client/src/contexts/AuthContext';
import {
  IMAGE_PURPOSES,
  IMAGE_PURPOSE_LABELS,
  IMAGE_STYLES,
  IMAGE_STYLE_LABELS,
} from '@shared/api.interface';
import type { GenerateImageResponse, ImageServiceConfig } from '@shared/api.interface';

const PRIMARY = '#1e40af';
const ACCENT = '#f97316';
const BG = '#f8fafc';

const IMAGE_RATIOS = ['1:1', '4:5', '16:9', '9:16'] as const;
type ImageRatio = (typeof IMAGE_RATIOS)[number];
const RATIO_STYLES: Record<ImageRatio, string> = {
  '1:1': 'aspect-square',
  '4:5': 'aspect-[4/5]',
  '16:9': 'aspect-video',
  '9:16': 'aspect-[9/16]',
};

const ImagePage: React.FC = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const isClient = user?.role === 'client';
  const canConfig = user?.role === 'admin' || user?.role === 'operator';

  /* ---------------- Form state ---------------- */
  const [brandId, setBrandId] = useState<string>(user?.brandId ?? '');
  const [imagePurpose, setImagePurpose] =
    useState<(typeof IMAGE_PURPOSES)[number]>('cover');
  const [prompt, setPrompt] = useState('');
  const [style, setStyle] = useState<(typeof IMAGE_STYLES)[number]>(
    'realistic',
  );
  const [ratio, setRatio] = useState<ImageRatio>('1:1');
  const [count, setCount] = useState(1);
  const [saveToLibrary, setSaveToLibrary] = useState(true);

  /* ---------------- Result state ---------------- */
  const [result, setResult] = useState<GenerateImageResponse | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [history, setHistory] = useState<
    Array<{ id: string; url: string; name: string }>
  >([]);

  /* ---------------- Rename dialog ---------------- */
  const [renameTarget, setRenameTarget] = useState<{
    id: string;
    currentName: string;
    url: string;
  } | null>(null);
  const [renameValue, setRenameValue] = useState('');

  /* ---------------- 配置弹窗 ---------------- */
  const [configOpen, setConfigOpen] = useState(false);
  const [configForm, setConfigForm] = useState<Partial<ImageServiceConfig>>({
    apiUrl: '',
    apiKey: '',
    modelName: '',
  });
  const [testResult, setTestResult] = useState<{
    ok: boolean;
    message: string;
  } | null>(null);

  /* ---------------- Queries ---------------- */
  const { data: brandList = [] } = useQuery({
    queryKey: ['brands', 'options'],
    queryFn: getBrandList,
    staleTime: 5 * 60 * 1000,
    enabled: !isClient,
  });

  const { data: creditAccount } = useQuery({
    queryKey: ['creditAccount'],
    queryFn: () => content.getCreditAccount(),
    staleTime: 60 * 1000,
  });

  const { data: imageConfig, isError: configError } = useQuery({
    queryKey: ['imageConfig'],
    queryFn: () => content.getImageConfig(),
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  const isServiceConfigured = imageConfig?.isConfigured ?? false;
  // 配置未就绪提示（接口报错或 isConfigured=false 都显示）
  const showConfigAlert = !configError && imageConfig && !imageConfig.isConfigured;

  const estimatedCost = useMemo(() => count * 2, [count]);

  /* ---------------- Mutations ---------------- */
  const generateMutation = useMutation<GenerateImageResponse, any>({
    mutationFn: () =>
      content.generateImage({
        brandId: brandId || user?.brandId || '',
        imagePurpose,
        prompt,
        style,
        ratio,
        count,
        saveToLibrary,
      }),
    retry: false,
    onSuccess: (data: GenerateImageResponse) => {
      setResult(data);
      setErrorMsg(null);
      const newItems = data.images.map((img, idx) => ({
        id: img.id,
        url: img.url,
        name: `图片_${Date.now()}_${idx + 1}`,
      }));
      setHistory((prev) => [...newItems, ...prev]);
      queryClient.invalidateQueries({ queryKey: ['creditAccount'] });
      queryClient.invalidateQueries({ queryKey: ['materials'] });
      toast.success(`生成成功，消耗 ${data.costCredits} 算力`);
    },
    onError: (err: any) => {
      const msg = getApiErrorMessage(err, '图像生成能力未开通，请联系管理员');
      setErrorMsg(msg);
      setResult(null);
      if (!isAiQuotaError(err)) {
        toast.error(msg);
      }
    },
  });

  const updateConfigMutation = useMutation<ImageServiceConfig, any>({
    mutationFn: () => content.updateImageConfig(configForm),
    retry: false,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['imageConfig'] });
      setConfigOpen(false);
      toast.success('配置已保存');
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.error?.message ?? '保存失败');
    },
  });

  const testConfigMutation = useMutation<{ ok: boolean; message: string }, any>({
    mutationFn: () => content.testImageConfig(),
    retry: false,
    onSuccess: (res) => {
      setTestResult(res);
      if (res.ok) {
        toast.success('连通性测试通过');
      } else {
        toast.error(`测试失败：${res.message}`);
      }
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.error?.message ?? '测试请求失败';
      setTestResult({ ok: false, message: msg });
      toast.error(msg);
    },
  });

  const handleGenerate = () => {
    if (!prompt.trim()) {
      toast.error('请输入画面描述');
      return;
    }
    if (!brandId && !user?.brandId) {
      toast.error('请选择品牌');
      return;
    }
    generateMutation.mutate();
  };

  const handleDownload = (url: string, name: string) => {
    const link = document.createElement('a');
    link.href = url;
    link.download = name;
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDelete = (id: string) => {
    setHistory((prev) => prev.filter((item) => item.id !== id));
    if (result?.images) {
      setResult({
        ...result,
        images: result.images.filter((img) => img.id !== id),
      });
    }
    toast.success('已删除');
  };

  const handleAddToLibrary = (id: string, url: string, name: string) => {
    toast.success('已加入素材库');
    queryClient.invalidateQueries({ queryKey: ['materials'] });
  };

  const handleOpenRename = (item: {
    id: string;
    name: string;
    url: string;
  }) => {
    setRenameTarget({ id: item.id, currentName: item.name, url: item.url });
    setRenameValue(item.name);
  };

  const handleRenameConfirm = () => {
    if (!renameTarget) return;
    const newName = renameValue.trim() || renameTarget.currentName;
    setHistory((prev) =>
      prev.map((item) =>
        item.id === renameTarget.id ? { ...item, name: newName } : item,
      ),
    );
    if (result?.images) {
      setResult({
        ...result,
        images: result.images.map((img) =>
          img.id === renameTarget.id ? { ...img, url: img.url } : img,
        ),
      });
    }
    setRenameTarget(null);
    toast.success('重命名成功');
  };

  const openConfigDialog = () => {
    setConfigForm({
      apiUrl: imageConfig?.apiUrl ?? '',
      apiKey: imageConfig?.apiKey ?? '',
      modelName: imageConfig?.modelName ?? '',
    });
    setTestResult(null);
    setConfigOpen(true);
  };

  const handleTestConfig = () => {
    testConfigMutation.mutate();
  };

  const handleSaveConfig = () => {
    if (!configForm.apiUrl?.trim()) {
      toast.error('请输入 API 地址');
      return;
    }
    updateConfigMutation.mutate();
  };

  const isGenerating = generateMutation.isPending;
  const displayImages = result?.images?.length
    ? result.images.map((img) => {
        const hist = history.find((h) => h.id === img.id);
        return {
          id: img.id,
          url: img.url,
          name: hist?.name || `图片_${img.id.slice(-6)}`,
        };
      })
    : [];

  return (
    <div className="space-y-6" style={{ backgroundColor: BG }}>
      {/* 页面标题 */}
      <div>
        <h1
          className="text-[20px] font-semibold leading-none"
          style={{ color: '#101828' }}
        >
          AI 图片生成
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          通过 AI 生成品牌营销素材图，支持多种风格与尺寸
        </p>
      </div>

      {/* 配置未就绪提示条 */}
      {showConfigAlert && (
        <Alert variant="default" className="border-orange-200 bg-orange-50">
          <AlertCircle className="h-4 w-4" style={{ color: ACCENT }} />
          <div className="flex-1">
            <AlertTitle style={{ color: ACCENT }}>未配置生图服务</AlertTitle>
            <AlertDescription className="text-xs text-muted-foreground">
              当前生图服务尚未配置，无法使用图片生成功能
            </AlertDescription>
          </div>
          {canConfig && (
            <Button size="sm" onClick={openConfigDialog} style={{ backgroundColor: ACCENT }}>
              <Settings className="mr-1 h-3.5 w-3.5" />
              去配置
            </Button>
          )}
        </Alert>
      )}

      {/* 错误提示条 */}
      {errorMsg && (
        <Alert variant="destructive" className="border-red-200 bg-red-50">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>生成失败</AlertTitle>
          <AlertDescription>{errorMsg}</AlertDescription>
        </Alert>
      )}

      {/* 主区域：左表单 + 右预览 */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        {/* 左侧表单 */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wand2 className="h-5 w-5" style={{ color: PRIMARY }} />
              生成配置
            </CardTitle>
            <CardDescription className="text-xs">
              填写参数后点击生成，AI 将为你创作图片
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {/* 品牌 */}
            <div className="space-y-2">
              <Label htmlFor="brand">品牌</Label>
              {isClient ? (
                <Input value={user?.brandId ?? ''} disabled readOnly />
              ) : (
                <Select value={brandId} onValueChange={setBrandId}>
                  <SelectTrigger>
                    <SelectValue placeholder="选择品牌" />
                  </SelectTrigger>
                  <SelectContent>
                    {brandList.map((b) => (
                      <SelectItem key={b.id} value={b.id}>
                        {b.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            {/* 图片用途 */}
            <div className="space-y-2">
              <Label>图片用途</Label>
              <RadioGroup
                value={imagePurpose}
                onValueChange={(v) =>
                  setImagePurpose(v as (typeof IMAGE_PURPOSES)[number])
                }
                className="grid grid-cols-2 gap-2"
              >
                {IMAGE_PURPOSES.map((p) => (
                  <div key={p}>
                    <RadioGroupItem
                      value={p}
                      id={`purpose-${p}`}
                      className="peer sr-only"
                    />
                    <Label
                      htmlFor={`purpose-${p}`}
                      className="flex cursor-pointer items-center justify-center rounded-md border px-3 py-2 text-sm peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/5 peer-data-[state=checked]:font-medium hover:bg-slate-50"
                      style={
                        imagePurpose === p
                          ? { borderColor: PRIMARY, backgroundColor: `${PRIMARY}0d` }
                          : undefined
                      }
                    >
                      {IMAGE_PURPOSE_LABELS[p]}
                    </Label>
                  </div>
                ))}
              </RadioGroup>
            </div>

            {/* 画面描述 */}
            <div className="space-y-2">
              <Label htmlFor="prompt">画面描述</Label>
              <Textarea
                id="prompt"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="详细描述你想要的画面，例如：一家温馨的咖啡店门口，阳光透过玻璃窗…"
                rows={4}
              />
            </div>

            {/* 风格 */}
            <div className="space-y-2">
              <Label>风格</Label>
              <RadioGroup
                value={style}
                onValueChange={(v) =>
                  setStyle(v as (typeof IMAGE_STYLES)[number])
                }
                className="grid grid-cols-2 gap-2"
              >
                {IMAGE_STYLES.map((s) => (
                  <div key={s}>
                    <RadioGroupItem
                      value={s}
                      id={`style-${s}`}
                      className="peer sr-only"
                    />
                    <Label
                      htmlFor={`style-${s}`}
                      className="flex cursor-pointer items-center justify-center rounded-md border px-3 py-2 text-sm peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/5 peer-data-[state=checked]:font-medium hover:bg-slate-50"
                      style={
                        style === s
                          ? { borderColor: PRIMARY, backgroundColor: `${PRIMARY}0d` }
                          : undefined
                      }
                    >
                      {IMAGE_STYLE_LABELS[s]}
                    </Label>
                  </div>
                ))}
              </RadioGroup>
            </div>

            {/* 尺寸 */}
            <div className="space-y-2">
              <Label>尺寸比例</Label>
              <RadioGroup
                value={ratio}
                onValueChange={(v) => setRatio(v as ImageRatio)}
                className="grid grid-cols-4 gap-2"
              >
                {IMAGE_RATIOS.map((r) => (
                  <div key={r}>
                    <RadioGroupItem
                      value={r}
                      id={`ratio-${r}`}
                      className="peer sr-only"
                    />
                    <Label
                      htmlFor={`ratio-${r}`}
                      className="flex cursor-pointer items-center justify-center rounded-md border px-2 py-2 text-xs peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/5 peer-data-[state=checked]:font-medium hover:bg-slate-50"
                      style={
                        ratio === r
                          ? { borderColor: PRIMARY, backgroundColor: `${PRIMARY}0d` }
                          : undefined
                      }
                    >
                      {r}
                    </Label>
                  </div>
                ))}
              </RadioGroup>
            </div>

            {/* 数量 */}
            <div className="space-y-2">
              <Label htmlFor="count">生成数量</Label>
              <div className="flex items-center gap-3">
                <Input
                  id="count"
                  type="number"
                  min={1}
                  max={4}
                  value={count}
                  onChange={(e) => {
                    const v = Math.max(1, Math.min(4, Number(e.target.value) || 1));
                    setCount(v);
                  }}
                  className="w-24"
                />
                <span className="text-xs text-muted-foreground">
                  范围 1-4 张
                </span>
              </div>
            </div>

            {/* 保存到素材库 */}
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-sm font-medium">保存到素材库</Label>
                <p className="text-xs text-muted-foreground">
                  生成后自动存入品牌素材库
                </p>
              </div>
              <Switch
                checked={saveToLibrary}
                onCheckedChange={setSaveToLibrary}
              />
            </div>

            {/* 算力消耗 */}
            <div
              className="rounded-lg p-3"
              style={{ backgroundColor: `${ACCENT}0d`, border: `1px solid ${ACCENT}33` }}
            >
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">预计消耗</span>
                <span className="font-semibold" style={{ color: ACCENT }}>
                  {estimatedCost} 算力
                </span>
              </div>
              <div className="mt-1 flex items-center justify-between text-xs text-muted-foreground">
                <span>当前余额</span>
                <span>
                  {creditAccount
                    ? `${creditAccount.balance} 算力`
                    : '加载中…'}
                </span>
              </div>
            </div>

            {/* 生成按钮 */}
            <Button
              className="w-full"
              style={{ backgroundColor: PRIMARY }}
              onClick={handleGenerate}
              disabled={isGenerating || showConfigAlert}
            >
              {isGenerating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  生成中…
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-4 w-4" />
                  生成图片
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* 右侧预览区 */}
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ImageIcon className="h-5 w-5" style={{ color: PRIMARY }} />
              生成结果
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isGenerating ? (
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  AI 正在创作中，大约需要 10-30 秒…
                </div>
                <div className={`grid gap-4 ${count === 1 ? 'grid-cols-1' : count === 2 ? 'grid-cols-2' : 'grid-cols-2'}`}>
                  {Array.from({ length: count }).map((_, i) => (
                    <div key={i} className={`rounded-lg border ${RATIO_STYLES[ratio]}`}>
                      <Skeleton className="h-full w-full rounded-lg" />
                    </div>
                  ))}
                </div>
              </div>
            ) : displayImages.length > 0 ? (
              <div
                className={`grid gap-4 ${
                  displayImages.length === 1
                    ? 'grid-cols-1'
                    : displayImages.length === 2
                      ? 'grid-cols-1 sm:grid-cols-2'
                      : 'grid-cols-2 sm:grid-cols-2'
                }`}
              >
                {displayImages.map((img) => (
                  <div
                    key={img.id}
                    className="group overflow-hidden rounded-lg border bg-white"
                  >
                    <div className={`flex items-center justify-center overflow-hidden bg-slate-100 ${RATIO_STYLES[ratio]}`}>
                      <Image
                        src={img.url}
                        alt={img.name}
                        className="h-full w-full object-cover"
                      />
                    </div>
                    <div className="space-y-2 p-3">
                      <Input
                        value={img.name}
                        onChange={(e) => {
                          setHistory((prev) =>
                            prev.map((item) =>
                              item.id === img.id
                                ? { ...item, name: e.target.value }
                                : item,
                            ),
                          );
                        }}
                        className="h-8 text-sm"
                      />
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="flex-1"
                          onClick={() => handleDownload(img.url, img.name)}
                        >
                          <Download className="mr-1 h-3 w-3" />
                          下载
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="flex-1"
                          onClick={() =>
                            handleAddToLibrary(img.id, img.url, img.name)
                          }
                        >
                          <FolderPlus className="mr-1 h-3 w-3" />
                          入库
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-red-500 hover:text-red-600"
                          onClick={() => handleDelete(img.id)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <Empty>
                <EmptyMedia variant="icon">
                  <ImageIcon className="h-6 w-6" />
                </EmptyMedia>
                <EmptyHeader>
                  <EmptyTitle>暂无生成结果</EmptyTitle>
                </EmptyHeader>
                <EmptyContent>
                  <EmptyDescription>
                    在左侧填写参数，点击「生成图片」开始创作
                  </EmptyDescription>
                </EmptyContent>
              </Empty>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 底部历史记录 */}
      {history.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>本次会话历史</CardTitle>
            <CardDescription className="text-xs">
              本次会话生成的所有图片
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 md:grid-cols-6">
              {history.slice(0, 12).map((item) => (
                <div
                  key={item.id}
                  className="group cursor-pointer overflow-hidden rounded-md border"
                  onClick={() => handleOpenRename(item)}
                >
                  <div className="flex aspect-square items-center justify-center overflow-hidden bg-slate-100">
                    <Image
                      src={item.url}
                      alt={item.name}
                      className="h-full w-full object-cover transition-transform group-hover:scale-105"
                    />
                  </div>
                  <div className="truncate px-2 py-1 text-xs text-muted-foreground">
                    {item.name}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* 重命名对话框 */}
      <Dialog open={!!renameTarget} onOpenChange={(o) => !o && setRenameTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>重命名</DialogTitle>
            <DialogDescription>修改图片名称</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Input
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenameTarget(null)}>
              取消
            </Button>
            <Button style={{ backgroundColor: PRIMARY }} onClick={handleRenameConfirm}>
              确认
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 生图服务配置弹窗 */}
      {canConfig && (
        <Dialog open={configOpen} onOpenChange={(o) => !o && setConfigOpen(false)}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>生图服务配置</DialogTitle>
              <DialogDescription>
                配置外部生图服务的 API 地址与密钥
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="img-api-url">API 地址</Label>
                <Input
                  id="img-api-url"
                  value={configForm.apiUrl ?? ''}
                  onChange={(e) =>
                    setConfigForm({ ...configForm, apiUrl: e.target.value })
                  }
                  placeholder="https://api.example.com/v1/images/generations"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="img-api-key">API Key</Label>
                <Input
                  id="img-api-key"
                  type="password"
                  value={configForm.apiKey ?? ''}
                  onChange={(e) =>
                    setConfigForm({ ...configForm, apiKey: e.target.value })
                  }
                  placeholder="sk-xxxxxxxxxxxxxx"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="img-model">模型名称</Label>
                <Input
                  id="img-model"
                  value={configForm.modelName ?? ''}
                  onChange={(e) =>
                    setConfigForm({ ...configForm, modelName: e.target.value })
                  }
                  placeholder="stable-diffusion-xl"
                />
              </div>

              {/* 测试结果 */}
              {testResult && (
                <div
                  className={`flex items-center gap-2 rounded-md border p-3 text-sm ${
                    testResult.ok
                      ? 'border-green-200 bg-green-50 text-green-700'
                      : 'border-red-200 bg-red-50 text-red-700'
                  }`}
                >
                  {testResult.ok ? (
                    <CheckCircle2 className="h-4 w-4 shrink-0" />
                  ) : (
                    <XCircle className="h-4 w-4 shrink-0" />
                  )}
                  <span>{testResult.message}</span>
                </div>
              )}
            </div>

            <DialogFooter className="gap-2">
              <Button
                variant="outline"
                onClick={handleTestConfig}
                disabled={testConfigMutation.isPending || updateConfigMutation.isPending}
              >
                {testConfigMutation.isPending && (
                  <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                )}
                测试连通性
              </Button>
              <Button variant="outline" onClick={() => setConfigOpen(false)}>
                取消
              </Button>
              <Button
                style={{ backgroundColor: PRIMARY }}
                onClick={handleSaveConfig}
                disabled={updateConfigMutation.isPending}
              >
                {updateConfigMutation.isPending && (
                  <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                )}
                保存
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
};

export default ImagePage;
