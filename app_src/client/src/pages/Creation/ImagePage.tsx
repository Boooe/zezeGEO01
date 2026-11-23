import React, { useState, useEffect, useMemo } from 'react';
import {
  Image as ImageIcon,
  Download,
  Trash2,
  Plus,
  Share2,
  RefreshCw,
  Check,
  ChevronLeft,
  ChevronRight,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@client/src/components/ui/select';
import { Badge } from '@client/src/components/ui/badge';
import { Pill } from '@client/src/components/layout/Pill';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@client/src/components/ui/table';
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
} from '@client/src/components/ui/pagination';
import { Checkbox } from '@client/src/components/ui/checkbox';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@client/src/components/ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@client/src/components/ui/dialog';
import {
  RadioGroup,
  RadioGroupItem,
} from '@client/src/components/ui/radio-group';
import { Label } from '@client/src/components/ui/label';
import { Image } from '@client/src/components/ui/image';
import { Skeleton } from '@client/src/components/ui/skeleton';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@client/src/components/ui/tooltip';

import {
  generateImages,
  listImages,
  deleteImage,
  batchDeleteImages,
  retryImage,
  publishImage,
} from '@client/src/api/creation';
import { getBrands } from '@client/src/api/brands';

import {
  IMAGE_PURPOSE_LABELS,
  IMAGE_STYLE_LABELS,
  MATERIAL_STATUS_LABELS,
  PUBLICATION_PLATFORM_LABELS,
  type ImagePurpose,
  type ImageStyle,
  type Material,
  type MaterialStatus,
} from '@shared/api.interface';

import { logger } from '@lark-apaas/client-toolkit/logger';

const IMAGE_RATIOS: { value: string; label: string }[] = [
  { value: '1:1', label: '1:1（方形）' },
  { value: '4:3', label: '4:3（横屏）' },
  { value: '16:9', label: '16:9（宽屏）' },
  { value: '9:16', label: '9:16（竖屏）' },
  { value: '3:4', label: '3:4（竖幅）' },
];

const PURPOSE_OPTIONS = Object.entries(IMAGE_PURPOSE_LABELS).map(
  ([value, label]) => ({ value: value as ImagePurpose, label }),
);

const STYLE_OPTIONS = Object.entries(IMAGE_STYLE_LABELS).map(
  ([value, label]) => ({ value: value as ImageStyle, label }),
);

const PLATFORM_OPTIONS = Object.entries(PUBLICATION_PLATFORM_LABELS).map(
  ([value, label]) => ({ value, label }),
);

const ImagePage: React.FC = () => {
  const [brands, setBrands] = useState<Array<{ id: string; name: string }>>([]);
  const [selectedBrandId, setSelectedBrandId] = useState<string>('');

  const [purpose, setPurpose] = useState<ImagePurpose>('cover');
  const [prompt, setPrompt] = useState<string>('');
  const [style, setStyle] = useState<ImageStyle>('realistic');
  const [ratio, setRatio] = useState<string>('1:1');
  const [count, setCount] = useState<number>(1);

  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedImages, setGeneratedImages] = useState<
    Array<{ id: string; url: string }>
  >([]);

  const [imageList, setImageList] = useState<Material[]>([]);
  const [listLoading, setListLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);
  const [total, setTotal] = useState(0);

  const [filterPurpose, setFilterPurpose] = useState<string | undefined>(
    undefined,
  );
  const [filterStatus, setFilterStatus] = useState<string | undefined>(undefined);

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [batchDeleteDialogOpen, setBatchDeleteDialogOpen] = useState(false);

  const [publishDialogOpen, setPublishDialogOpen] = useState(false);
  const [publishImageId, setPublishImageId] = useState<string>('');
  const [publishPlatform, setPublishPlatform] = useState<string>('xiaohongshu');
  const [publishMediaLibrary, setPublishMediaLibrary] = useState<string>(
    '默认素材库',
  );
  const [publishing, setPublishing] = useState(false);

  useEffect(() => {
    getBrands()
      .then((data) => {
        setBrands(data);
        if (data.length > 0) {
          setSelectedBrandId(data[0].id);
        }
      })
      .catch((err) => {
        logger.error('加载品牌列表失败', err);
        toast.error('加载品牌列表失败');
      });
  }, []);

  const fetchList = () => {
    if (!selectedBrandId) return;
    setListLoading(true);
    listImages({
      page,
      pageSize,
      brandId: selectedBrandId,
      imagePurpose: filterPurpose || undefined,
      status: filterStatus || undefined,
    })
      .then((res) => {
        setImageList(res.items);
        setTotal(res.total);
      })
      .catch((err) => {
        logger.error('加载图片列表失败', err);
        toast.error('加载图片列表失败');
      })
      .finally(() => {
        setListLoading(false);
      });
  };

  useEffect(() => {
    fetchList();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedBrandId, page, filterPurpose, filterStatus]);

  const handleGenerate = async () => {
    if (!selectedBrandId) {
      toast.error('请选择品牌');
      return;
    }
    if (!prompt.trim()) {
      toast.error('请输入画面描述');
      return;
    }
    setIsGenerating(true);
    setGeneratedImages([]);
    try {
      const result = await generateImages({
        brandId: selectedBrandId,
        imagePurpose: purpose,
        prompt: prompt.trim(),
        style,
        ratio,
        count,
        saveToLibrary: true,
      });
      setGeneratedImages(result.images);
      toast.success(`生成成功，消耗 ${result.costCredits} 算力`);
      fetchList();
    } catch (err: unknown) {
      logger.error('图片生成失败', err);
      const msg =
        (err as { response?: { data?: { error?: { message?: string } } } })
          ?.response?.data?.error?.message ?? '图片生成失败';
      toast.error(msg);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteImage(id);
      toast.success('删除成功');
      setSelectedIds((prev) => prev.filter((i) => i !== id));
      fetchList();
    } catch (err) {
      logger.error('删除失败', err);
      toast.error('删除失败');
    }
  };

  const handleBatchDelete = async () => {
    try {
      await batchDeleteImages({ ids: selectedIds });
      toast.success(`已删除 ${selectedIds.length} 张图片`);
      setSelectedIds([]);
      setBatchDeleteDialogOpen(false);
      fetchList();
    } catch (err) {
      logger.error('批量删除失败', err);
      toast.error('批量删除失败');
    }
  };

  const handleRetry = async (id: string) => {
    try {
      const result = await retryImage(id);
      toast.success('重新生成成功');
      if (result.images) {
        setGeneratedImages(result.images);
      }
      fetchList();
    } catch (err) {
      logger.error('重新生成失败', err);
      toast.error('重新生成失败');
    }
  };

  const openPublishDialog = (id: string) => {
    setPublishImageId(id);
    setPublishPlatform('xiaohongshu');
    setPublishMediaLibrary('默认素材库');
    setPublishDialogOpen(true);
  };

  const handlePublish = async () => {
    setPublishing(true);
    try {
      await publishImage(publishImageId, {
        platform: publishPlatform,
        mediaLibrary: publishMediaLibrary,
      });
      toast.success('已加入发布记录');
      setPublishDialogOpen(false);
    } catch (err) {
      logger.error('加入发布记录失败', err);
      toast.error('加入发布记录失败');
    } finally {
      setPublishing(false);
    }
  };

  const handleToggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id],
    );
  };

  const handleToggleSelectAll = () => {
    if (selectedIds.length === imageList.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(imageList.map((item) => item.id));
    }
  };

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const purposeLabel = useMemo(
    () => IMAGE_PURPOSE_LABELS[purpose],
    [purpose],
  );
  const styleLabel = useMemo(
    () => IMAGE_STYLE_LABELS[style],
    [style],
  );

  const handleDownload = (url: string, name: string) => {
    const link = document.createElement('a');
    link.href = url;
    link.download = name;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* 生成区 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 左侧表单 */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-lg">AI 图片生成</CardTitle>
            <CardDescription>
              选择用途与风格，输入画面描述即可生成
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label className="text-sm font-medium text-gray-700">
                选择品牌
              </Label>
              <Select value={selectedBrandId} onValueChange={setSelectedBrandId}>
                <SelectTrigger>
                  <SelectValue placeholder="选择品牌" />
                </SelectTrigger>
                <SelectContent>
                  {brands.map((brand) => (
                    <SelectItem key={brand.id} value={brand.id}>
                      {brand.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium text-gray-700">
                图片用途
              </Label>
              <RadioGroup
                value={purpose}
                onValueChange={(v) => setPurpose(v as ImagePurpose)}
                className="grid grid-cols-2 gap-2"
              >
                {PURPOSE_OPTIONS.map((opt) => (
                  <div key={opt.value} className="flex items-center space-x-2">
                    <RadioGroupItem value={opt.value} id={`purpose-${opt.value}`} />
                    <Label htmlFor={`purpose-${opt.value}`} className="text-sm cursor-pointer">
                      {opt.label}
                    </Label>
                  </div>
                ))}
              </RadioGroup>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium text-gray-700">
                画面描述
              </Label>
              <Textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="请详细描述你想要的画面，比如：一家温馨的咖啡店内景，暖色调，木质家具..."
                rows={4}
              />
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium text-gray-700">
                画面风格
              </Label>
              <Select value={style} onValueChange={(v) => setStyle(v as ImageStyle)}>
                <SelectTrigger>
                  <SelectValue placeholder="选择风格" />
                </SelectTrigger>
                <SelectContent>
                  {STYLE_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium text-gray-700">
                图片比例
              </Label>
              <Select value={ratio} onValueChange={setRatio}>
                <SelectTrigger>
                  <SelectValue placeholder="选择比例" />
                </SelectTrigger>
                <SelectContent>
                  {IMAGE_RATIOS.map((r) => (
                    <SelectItem key={r.value} value={r.value}>
                      {r.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium text-gray-700">
                生成数量（1-4 张）
              </Label>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setCount((c) => Math.max(1, c - 1))}
                  disabled={count <= 1}
                >
                  -
                </Button>
                <Input
                  type="number"
                  value={count}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    if (!isNaN(v) && v >= 1 && v <= 4) setCount(v);
                  }}
                  min={1}
                  max={4}
                  className="text-center"
                />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setCount((c) => Math.min(4, c + 1))}
                  disabled={count >= 4}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <Button
              className="w-full"
              onClick={handleGenerate}
              disabled={isGenerating}
            >
              {isGenerating ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  生成中...
                </>
              ) : (
                <>
                  <ImageIcon className="mr-2 h-4 w-4" />
                  生成图片
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* 右侧结果展示 */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-lg">生成结果</CardTitle>
            <CardDescription>
              生成的图片可下载、加入发布记录或删除
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isGenerating ? (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {Array.from({ length: count }).map((_, i) => (
                  <div key={i} className="space-y-2">
                    <Skeleton className="aspect-square rounded-lg" />
                    <Skeleton className="h-4 w-3/4" />
                  </div>
                ))}
              </div>
            ) : generatedImages.length > 0 ? (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {generatedImages.map((img, idx) => (
                  <div
                    key={img.id}
                    className="group relative rounded-lg overflow-hidden border bg-white hover:shadow-md transition-shadow"
                  >
                    <div className="aspect-square overflow-hidden">
                      <Image
                        src={img.url}
                        alt={`生成图片 ${idx + 1}`}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="p-2 space-y-1">
                      <div className="flex flex-wrap gap-1">
                        <Badge variant="secondary" className="text-xs">
                          {purposeLabel}
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                          {styleLabel}
                        </Badge>
                      </div>
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                onClick={() =>
                                  handleDownload(
                                    img.url,
                                    `${purposeLabel}_${idx + 1}.jpg`,
                                  )
                                }
                              >
                                <Download className="h-3.5 w-3.5" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>下载</TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-primary"
                                onClick={() => openPublishDialog(img.id)}
                              >
                                <Share2 className="h-3.5 w-3.5" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>加入发布记录</TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-16 text-gray-400">
                <ImageIcon className="h-12 w-12 mb-3" />
                <p className="text-sm">生成的图片将在这里展示</p>
                <p className="text-xs mt-1">
                  填写左侧表单后点击「生成图片」开始
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 历史列表 */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-lg">历史记录</CardTitle>
            <CardDescription>所有生成过的图片素材</CardDescription>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600">用途：</span>
              <Select
                value={filterPurpose ?? 'all'}
                onValueChange={(v) => {
                  setFilterPurpose(v === 'all' ? undefined : v);
                  setPage(1);
                }}
              >
                <SelectTrigger className="w-32">
                  <SelectValue placeholder="全部" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部</SelectItem>
                  {PURPOSE_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600">状态：</span>
              <Select
                value={filterStatus ?? 'all'}
                onValueChange={(v) => {
                  setFilterStatus(v === 'all' ? undefined : v);
                  setPage(1);
                }}
              >
                <SelectTrigger className="w-28">
                  <SelectValue placeholder="全部" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部</SelectItem>
                  {Object.entries(MATERIAL_STATUS_LABELS).map(([v, l]) => (
                    <SelectItem key={v} value={v}>
                      {l}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {selectedIds.length > 0 && (
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setBatchDeleteDialogOpen(true)}
              >
                <Trash2 className="mr-1 h-4 w-4" />
                批量删除（{selectedIds.length}）
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {listLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <Checkbox
                      checked={
                        imageList.length > 0 &&
                        selectedIds.length === imageList.length
                      }
                      onCheckedChange={handleToggleSelectAll}
                    />
                  </TableHead>
                  <TableHead className="w-16">预览</TableHead>
                  <TableHead>用途</TableHead>
                  <TableHead className="w-[240px]">提示词</TableHead>
                  <TableHead>风格</TableHead>
                  <TableHead>比例</TableHead>
                  <TableHead>生成时间</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {imageList.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={9}
                      className="text-center py-12 text-gray-400"
                    >
                      暂无图片记录
                    </TableCell>
                  </TableRow>
                ) : (
                  imageList.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>
                        <Checkbox
                          checked={selectedIds.includes(item.id)}
                          onCheckedChange={() => handleToggleSelect(item.id)}
                        />
                      </TableCell>
                      <TableCell>
                        {item.fileUrl ? (
                          <Image
                            src={item.fileUrl}
                            alt={item.name}
                            className="w-10 h-10 rounded object-cover"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded bg-gray-100 flex items-center justify-center">
                            <ImageIcon className="h-4 w-4 text-gray-400" />
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        {item.purpose
                          ? IMAGE_PURPOSE_LABELS[item.purpose] ?? item.purpose
                          : '-'}
                      </TableCell>
                      <TableCell className="max-w-[240px]" title={item.promptText ?? undefined}>
                        {item.promptText || '-'}
                      </TableCell>
                      <TableCell>
                        {item.imageStyle
                          ? IMAGE_STYLE_LABELS[item.imageStyle] ?? item.imageStyle
                          : '-'}
                      </TableCell>
                      <TableCell>
                        {item.width && item.height
                          ? `${item.width}:${item.height}`
                          : '-'}
                      </TableCell>
                      <TableCell>
                        {new Date(item.createdAt).toLocaleString('zh-CN', {
                          month: '2-digit',
                          day: '2-digit',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            item.status === 'success'
                              ? 'default'
                              : item.status === 'failed'
                                ? 'destructive'
                                : 'secondary'
                          }
                        >
                          {MATERIAL_STATUS_LABELS[item.status]}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7"
                                  onClick={() =>
                                    item.fileUrl &&
                                    handleDownload(item.fileUrl, item.name)
                                  }
                                  disabled={!item.fileUrl}
                                >
                                  <Download className="h-3.5 w-3.5" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>下载</TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7"
                                  onClick={() => handleRetry(item.id)}
                                >
                                  <RefreshCw className="h-3.5 w-3.5" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>重新生成</TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 text-primary"
                                  onClick={() => openPublishDialog(item.id)}
                                >
                                  <Share2 className="h-3.5 w-3.5" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>加入发布记录</TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 text-red-600"
                                  onClick={() => handleDelete(item.id)}
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>删除</TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}

          {totalPages > 1 && (
            <div className="flex justify-center mt-4">
              <Pagination>
                <PaginationContent>
                  <PaginationItem>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page === 1}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                  </PaginationItem>
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map(
                    (p) => (
                      <PaginationItem key={p}>
                        <PaginationLink
                          isActive={p === page}
                          onClick={() => setPage(p)}
                        >
                          {p}
                        </PaginationLink>
                      </PaginationItem>
                    ),
                  )}
                  <PaginationItem>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                      disabled={page === totalPages}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 批量删除确认 */}
      <AlertDialog
        open={batchDeleteDialogOpen}
        onOpenChange={setBatchDeleteDialogOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认批量删除</AlertDialogTitle>
            <AlertDialogDescription>
              即将删除 {selectedIds.length} 张图片，删除后不可恢复。是否继续？
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={handleBatchDelete}
            >
              确认删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 加入发布记录 */}
      <Dialog open={publishDialogOpen} onOpenChange={setPublishDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>加入发布记录</DialogTitle>
            <DialogDescription>
              选择发布平台和素材库分类
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label className="text-sm font-medium">发布平台</Label>
              <Select value={publishPlatform} onValueChange={setPublishPlatform}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PLATFORM_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium">素材库（可选）</Label>
              <Input
                value={publishMediaLibrary}
                onChange={(e) => setPublishMediaLibrary(e.target.value)}
                placeholder="如：默认素材库"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setPublishDialogOpen(false)}
            >
              取消
            </Button>
            <Button onClick={handlePublish} disabled={publishing}>
              {publishing ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  提交中...
                </>
              ) : (
                <>
                  <Check className="mr-2 h-4 w-4" />
                  确认加入
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ImagePage;
