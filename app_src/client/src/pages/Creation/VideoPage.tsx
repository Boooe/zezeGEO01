import React, { useState, useEffect, useMemo } from 'react';
import {
  Video as VideoIcon,
  Download,
  Plus,
  Share2,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Play,
  FileText,
  X,
  Search,
  Upload,
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@client/src/components/ui/dialog';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@client/src/components/ui/tooltip';
import { Label } from '@client/src/components/ui/label';
import { Image } from '@client/src/components/ui/image';
import { Skeleton } from '@client/src/components/ui/skeleton';

import {
  generateVideo as createVideoTask,
  listVideos,
  retryVideo,
  publishVideo,
  importArticleScript,
  listArticles,
} from '@client/src/api/creation';
import { getMaterials } from '@client/src/api/content';

import {
  VIDEO_PURPOSE_LABELS,
  VIDEO_STYLE_LABELS,
  VIDEO_DURATION_LABELS,
  VIDEO_RATIO_LABELS,
  VIDEO_TASK_STATUS_LABELS,
  PUBLICATION_PLATFORM_LABELS,
  type VideoPurpose,
  type VideoStyle,
  type VideoTask,
} from '@shared/api.interface';

import { logger } from '@lark-apaas/client-toolkit/logger';
import { useBrandSelector } from '@client/src/hooks/useBrandSelector';

const PURPOSE_OPTIONS = Object.entries(VIDEO_PURPOSE_LABELS).map(
  ([value, label]) => ({ value: value as VideoPurpose, label }),
);

const STYLE_OPTIONS = Object.entries(VIDEO_STYLE_LABELS).map(
  ([value, label]) => ({ value: value as VideoStyle, label }),
);

const PLATFORM_OPTIONS = Object.entries(PUBLICATION_PLATFORM_LABELS).map(
  ([value, label]) => ({ value, label }),
);

const VideoPage: React.FC = () => {
  const { brands, selectedBrandId, setSelectedBrandId } = useBrandSelector();

  const [taskName, setTaskName] = useState('');
  const [purpose, setPurpose] = useState<VideoPurpose>('store_intro');
  const [topic, setTopic] = useState('');
  const [scriptText, setScriptText] = useState('');
  const [duration, setDuration] = useState<'15s' | '30s' | '60s'>('30s');
  const [ratio, setRatio] = useState<'9:16' | '16:9' | '1:1'>('9:16');
  const [style, setStyle] = useState<VideoStyle>('realistic');
  const [coverImage, setCoverImage] = useState<string>('');

  const [isSubmitting, setIsSubmitting] = useState(false);

  const [taskList, setTaskList] = useState<VideoTask[]>([]);
  const [listLoading, setListLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);
  const [total, setTotal] = useState(0);

  const [filterPurpose, setFilterPurpose] = useState<string | undefined>(
    undefined,
  );
  const [filterStatus, setFilterStatus] = useState<string | undefined>(undefined);

  const [videoDialogOpen, setVideoDialogOpen] = useState(false);
  const [currentVideoUrl, setCurrentVideoUrl] = useState('');
  const [currentVideoTitle, setCurrentVideoTitle] = useState('');

  const [articleDialogOpen, setArticleDialogOpen] = useState(false);
  const [articleSearch, setArticleSearch] = useState('');
  const [articleList, setArticleList] = useState<Array<{ id: string; title: string }>>([]);
  const [articleLoading, setArticleLoading] = useState(false);
  const [selectedArticle, setSelectedArticle] = useState<string>('');

  const [coverDialogOpen, setCoverDialogOpen] = useState(false);
  const [coverList, setCoverList] = useState<
    Array<{ id: string; name: string; fileUrl: string | null }>
  >([]);
  const [coverLoading, setCoverLoading] = useState(false);

  const [publishDialogOpen, setPublishDialogOpen] = useState(false);
  const [publishTaskId, setPublishTaskId] = useState<string>('');
  const [publishPlatform, setPublishPlatform] = useState<string>('xiaohongshu');
  const [publishMediaLibrary, setPublishMediaLibrary] = useState<string>(
    '默认素材库',
  );
  const [publishing, setPublishing] = useState(false);

  const fetchList = () => {
    if (!selectedBrandId) return;
    setListLoading(true);
    listVideos({
      page,
      pageSize,
      brandId: selectedBrandId,
      status: filterStatus || undefined,
      purpose: filterPurpose || undefined,
    })
      .then((res) => {
        setTaskList(res.items);
        setTotal(res.total);
      })
      .catch((err) => {
        logger.error('加载视频任务列表失败', err);
        toast.error('加载视频任务列表失败');
      })
      .finally(() => {
        setListLoading(false);
      });
  };

  useEffect(() => {
    fetchList();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedBrandId, page, filterPurpose, filterStatus]);

  const handleSubmit = async () => {
    if (!selectedBrandId) {
      toast.error('请选择品牌');
      return;
    }
    if (!taskName.trim()) {
      toast.error('请输入任务名称');
      return;
    }
    if (!topic.trim()) {
      toast.error('请输入视频主题/脚本要点');
      return;
    }
    setIsSubmitting(true);
    try {
      await createVideoTask({
        brandId: selectedBrandId,
        taskName: taskName.trim(),
        purpose,
        script: topic.trim(),
        scriptText: scriptText.trim() || undefined,
        duration,
        ratio,
        style,
        coverImage: coverImage || undefined,
      });
      toast.success('视频任务已提交，正在排队生成');
      setTaskName('');
      setTopic('');
      setScriptText('');
      setCoverImage('');
      fetchList();
    } catch (err: unknown) {
      logger.error('视频任务提交失败', err);
      const msg =
        (err as { response?: { data?: { error?: { message?: string } } } })
          ?.response?.data?.error?.message ?? '视频任务提交失败';
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePlayVideo = (task: VideoTask) => {
    if (!task.videoUrl) return;
    setCurrentVideoUrl(task.videoUrl);
    setCurrentVideoTitle(task.taskName);
    setVideoDialogOpen(true);
  };

  const handleOpenArticleDialog = () => {
    setArticleSearch('');
    setArticleList([]);
    setSelectedArticle('');
    setArticleDialogOpen(true);
    searchArticles('');
  };

  const searchArticles = async (keyword: string) => {
    if (!selectedBrandId) return;
    setArticleLoading(true);
    try {
      const res = await listArticles({
        brandId: selectedBrandId,
        keyword: keyword || undefined,
        page: 1,
        pageSize: 20,
      });
      setArticleList(res.items.map((a) => ({ id: a.id, title: a.title })));
    } catch (err) {
      logger.error('搜索文章失败', err);
      toast.error('搜索文章失败');
    } finally {
      setArticleLoading(false);
    }
  };

  const handleImportArticle = async () => {
    if (!selectedArticle) {
      toast.error('请选择文章');
      return;
    }
    try {
      const res = await importArticleScript(selectedArticle);
      setTaskName(res.title || '从文章导入');
      setScriptText(res.content || '');
      setTopic(res.title || '');
      setArticleDialogOpen(false);
      toast.success('已导入文章内容作为脚本参考');
    } catch (err) {
      logger.error('导入文章失败', err);
      toast.error('导入文章失败');
    }
  };

  const handleOpenCoverDialog = () => {
    setCoverDialogOpen(true);
    loadCoverImages();
  };

  const loadCoverImages = async () => {
    if (!selectedBrandId) return;
    setCoverLoading(true);
    try {
      const res = await getMaterials({
        brandId: selectedBrandId,
        materialType: 'image',
        page: 1,
        pageSize: 50,
      });
      setCoverList(res.items.map((m) => ({ id: m.id, name: m.name, fileUrl: m.fileUrl })));
    } catch (err) {
      logger.error('加载素材失败', err);
      toast.error('加载素材失败');
    } finally {
      setCoverLoading(false);
    }
  };

  const handleSelectCover = (url: string) => {
    setCoverImage(url);
    setCoverDialogOpen(false);
  };

  const handleRetry = async (id: string) => {
    try {
      await retryVideo(id);
      toast.success('视频任务已重新提交');
      fetchList();
    } catch (err) {
      logger.error('重试失败', err);
      toast.error('重试失败');
    }
  };

  const openPublishDialog = (id: string) => {
    setPublishTaskId(id);
    setPublishPlatform('xiaohongshu');
    setPublishMediaLibrary('默认素材库');
    setPublishDialogOpen(true);
  };

  const handlePublish = async () => {
    setPublishing(true);
    try {
      await publishVideo(publishTaskId, {
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

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="space-y-6">
      {/* 生成区 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 左侧表单 */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-lg">AI 视频生成</CardTitle>
            <CardDescription>
              填写主题、脚本和风格，提交后由视频服务异步生成
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 max-h-[calc(100vh-200px)] overflow-y-auto">
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
                任务名称
              </Label>
              <Input
                value={taskName}
                onChange={(e) => setTaskName(e.target.value)}
                placeholder="如：新品上市宣传视频"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium text-gray-700">
                视频用途
              </Label>
              <Select
                value={purpose}
                onValueChange={(v) => setPurpose(v as VideoPurpose)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="选择用途" />
                </SelectTrigger>
                <SelectContent>
                  {PURPOSE_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium text-gray-700">
                  视频主题/脚本要点
                </Label>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleOpenArticleDialog}
                  className="text-xs h-7"
                >
                  <FileText className="mr-1 h-3.5 w-3.5" />
                  从文章导入
                </Button>
              </div>
              <Textarea
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="简要描述视频主题和核心要点，如：介绍新品咖啡的口感、产地和冲调方法..."
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium text-gray-700">
                脚本内容
              </Label>
              <Textarea
                value={scriptText}
                onChange={(e) => setScriptText(e.target.value)}
                placeholder="可编辑的完整脚本文案，从文章导入后可在此修改"
                rows={6}
              />
              <p className="text-xs text-gray-400">
                留空将基于主题自动生成脚本
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label className="text-sm font-medium text-gray-700">
                  时长
                </Label>
                <Select value={duration} onValueChange={(v) => setDuration(v as any)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(VIDEO_DURATION_LABELS).map(([v, l]) => (
                      <SelectItem key={v} value={v}>
                        {l}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium text-gray-700">
                  比例
                </Label>
                <Select value={ratio} onValueChange={(v) => setRatio(v as any)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(VIDEO_RATIO_LABELS).map(([v, l]) => (
                      <SelectItem key={v} value={v}>
                        {l}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium text-gray-700">
                画面风格
              </Label>
              <Select
                value={style}
                onValueChange={(v) => setStyle(v as VideoStyle)}
              >
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
                首帧图
              </Label>
              {coverImage ? (
                <div className="relative w-full h-32 rounded-lg overflow-hidden border">
                  <Image
                    src={coverImage}
                    alt="首帧图"
                    className="w-full h-full object-cover"
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute top-1 right-1 h-6 w-6 bg-black/50 text-white hover:bg-black/70"
                    onClick={() => setCoverImage('')}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ) : (
                <Button
                  variant="outline"
                  className="w-full h-24 border-dashed"
                  onClick={handleOpenCoverDialog}
                >
                  <Upload className="mr-2 h-4 w-4" />
                  从素材库选择首帧图
                </Button>
              )}
            </div>

            <Button
              className="w-full"
              onClick={handleSubmit}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  提交中...
                </>
              ) : (
                <>
                  <VideoIcon className="mr-2 h-4 w-4" />
                  提交生成
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* 右侧任务列表 */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-lg">生成任务</CardTitle>
              <CardDescription>视频生成任务列表与状态</CardDescription>
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
                    {Object.entries(VIDEO_TASK_STATUS_LABELS).map(([v, l]) => (
                      <SelectItem key={v} value={v}>
                        {l}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
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
                    <TableHead className="w-16">封面</TableHead>
                    <TableHead>任务名称</TableHead>
                    <TableHead>用途</TableHead>
                    <TableHead>时长</TableHead>
                    <TableHead>比例</TableHead>
                    <TableHead>提交时间</TableHead>
                    <TableHead>状态</TableHead>
                    <TableHead className="text-right">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {taskList.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={8}
                        className="text-center py-12 text-gray-400"
                      >
                        暂无视频任务
                      </TableCell>
                    </TableRow>
                  ) : (
                    taskList.map((task) => (
                      <TableRow key={task.id}>
                        <TableCell>
                          {task.coverImage ? (
                            <Image
                              src={task.coverImage}
                              alt={task.taskName}
                              className="w-12 h-8 rounded object-cover"
                            />
                          ) : (
                            <div className="w-12 h-8 rounded bg-gray-100 flex items-center justify-center">
                              <VideoIcon className="h-3 w-3 text-gray-400" />
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="font-medium max-w-[200px] truncate">
                          {task.taskName}
                        </TableCell>
                        <TableCell>
                          {task.purpose
                            ? VIDEO_PURPOSE_LABELS[task.purpose] ?? task.purpose
                            : '-'}
                        </TableCell>
                        <TableCell>
                          {VIDEO_DURATION_LABELS[task.duration] ?? task.duration}
                        </TableCell>
                        <TableCell>
                          {VIDEO_RATIO_LABELS[task.ratio] ?? task.ratio}
                        </TableCell>
                        <TableCell>
                          {new Date(task.createdAt).toLocaleString('zh-CN', {
                            month: '2-digit',
                            day: '2-digit',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              task.status === 'completed'
                                ? 'default'
                                : task.status === 'failed'
                                  ? 'destructive'
                                  : task.status === 'generating'
                                    ? 'secondary'
                                    : 'outline'
                            }
                          >
                            {VIDEO_TASK_STATUS_LABELS[task.status]}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            {task.status === 'completed' && task.videoUrl && (
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-7 w-7"
                                      onClick={() => handlePlayVideo(task)}
                                    >
                                      <Play className="h-3.5 w-3.5" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>播放</TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            )}
                            {task.status === 'completed' && task.videoUrl && (
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-7 w-7"
                                      onClick={() =>
                                        handleDownload(
                                          task.videoUrl!,
                                          `${task.taskName}.mp4`,
                                        )
                                      }
                                    >
                                      <Download className="h-3.5 w-3.5" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>下载</TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            )}
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7"
                                    onClick={() => handleRetry(task.id)}
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
                                    onClick={() => openPublishDialog(task.id)}
                                  >
                                    <Share2 className="h-3.5 w-3.5" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>加入发布记录</TooltipContent>
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
      </div>

      {/* 视频播放弹窗 */}
      <Dialog open={videoDialogOpen} onOpenChange={setVideoDialogOpen}>
        <DialogContent className="sm:max-w-3xl p-0 overflow-hidden">
          <DialogHeader className="px-6 pt-4 pb-2">
            <DialogTitle>{currentVideoTitle}</DialogTitle>
          </DialogHeader>
          <div className="bg-black aspect-video">
            {currentVideoUrl && (
              <video
                src={currentVideoUrl}
                controls
                autoPlay
                className="w-full h-full"
              />
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* 选择文章弹窗 */}
      <Dialog open={articleDialogOpen} onOpenChange={setArticleDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>从文章导入脚本</DialogTitle>
            <DialogDescription>
              搜索并选择一篇文章，将其标题和正文作为脚本参考
            </DialogDescription>
          </DialogHeader>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="搜索文章标题..."
              value={articleSearch}
              onChange={(e) => {
                setArticleSearch(e.target.value);
                searchArticles(e.target.value);
              }}
              className="pl-9"
            />
          </div>
          <div className="max-h-72 overflow-y-auto border rounded-md">
            {articleLoading ? (
              <div className="space-y-2 p-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-8 w-full" />
                ))}
              </div>
            ) : articleList.length === 0 ? (
              <div className="text-center py-10 text-gray-400 text-sm">
                暂无匹配的文章
              </div>
            ) : (
              <div className="divide-y">
                {articleList.map((article) => (
                  <div
                    key={article.id}
                    className={`px-4 py-3 cursor-pointer hover:bg-gray-50 flex items-center justify-between ${
                      selectedArticle === article.id ? 'bg-blue-50' : ''
                    }`}
                    onClick={() => setSelectedArticle(article.id)}
                  >
                    <span className="text-sm truncate flex-1">
                      {article.title}
                    </span>
                    {selectedArticle === article.id && (
                      <Badge variant="secondary" className="ml-2">已选</Badge>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setArticleDialogOpen(false)}
            >
              取消
            </Button>
            <Button
              onClick={handleImportArticle}
              disabled={!selectedArticle}
            >
              导入选中文章
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 选择首帧图弹窗 */}
      <Dialog open={coverDialogOpen} onOpenChange={setCoverDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>选择首帧图</DialogTitle>
            <DialogDescription>从图片素材库中选择一张作为首帧</DialogDescription>
          </DialogHeader>
          <div className="max-h-80 overflow-y-auto">
            {coverLoading ? (
              <div className="grid grid-cols-4 gap-2">
                {Array.from({ length: 8 }).map((_, i) => (
                  <Skeleton key={i} className="aspect-square rounded" />
                ))}
              </div>
            ) : coverList.length === 0 ? (
              <div className="text-center py-10 text-gray-400 text-sm">
                暂无图片素材
              </div>
            ) : (
              <div className="grid grid-cols-4 gap-2">
                {coverList.map((item) => (
                  <div
                    key={item.id}
                    className={`aspect-square rounded overflow-hidden border-2 cursor-pointer hover:border-primary transition-colors ${
                      coverImage === item.fileUrl
                        ? 'border-primary'
                        : 'border-transparent'
                    }`}
                    onClick={() => item.fileUrl && handleSelectCover(item.fileUrl)}
                  >
                    {item.fileUrl ? (
                      <Image
                        src={item.fileUrl}
                        alt={item.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full bg-gray-100 flex items-center justify-center">
                        <Upload className="h-4 w-4 text-gray-400" />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setCoverDialogOpen(false)}
            >
              取消
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
                '确认加入'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default VideoPage;
