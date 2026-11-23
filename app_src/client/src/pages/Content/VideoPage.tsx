import React, { useCallback, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Video,
  Plus,
  Search,
  Play,
  Download,
  Trash2,
  RefreshCw,
  Settings,
  Clock,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Loader2,
  ImageIcon,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { logger } from '@lark-apaas/client-toolkit/logger';

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
import { Badge } from '@client/src/components/ui/badge';
import { Skeleton } from '@client/src/components/ui/skeleton';
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from '@client/src/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
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
} from '@client/src/components/ui/alert-dialog';
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from '@client/src/components/ui/alert';
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
  PaginationNext,
  PaginationPrevious,
} from '@client/src/components/ui/pagination';
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
import { getBrandList } from '@client/src/api/keywords';
import { useAuth } from '@client/src/contexts/AuthContext';
import {
  VIDEO_TASK_STATUSES,
  VIDEO_TASK_STATUS_LABELS,
  VIDEO_DURATIONS,
  VIDEO_DURATION_LABELS,
  VIDEO_RATIOS,
  VIDEO_RATIO_LABELS,
} from '@shared/api.interface';
import type {
  VideoTask,
  VideoTaskStatus,
  VideoDuration,
  VideoRatio,
  VideoServiceConfig,
  PagedResponse,
} from '@shared/api.interface';

const PRIMARY = '#1e40af';
const ACCENT = '#f97316';
const SUCCESS = '#10b981';
const DANGER = '#ef4444';
const BG = '#f8fafc';

const PAGE_SIZE = 10;

const VideoPage: React.FC = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const isClient = user?.role === 'client';
  const isAdmin = user?.role === 'admin';

  /* ---------------- 顶层 tab ---------------- */
  const [activeTab, setActiveTab] = useState<string>('tasks');

  /* ---------------- 任务列表筛选 ---------------- */
  const [brandId, setBrandId] = useState<string>(user?.brandId ?? '');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [keyword, setKeyword] = useState<string>('');
  const [searchKw, setSearchKw] = useState<string>('');
  const [page, setPage] = useState(1);

  /* ---------------- 新建任务弹窗 ---------------- */
  const [createOpen, setCreateOpen] = useState(false);
  const [taskName, setTaskName] = useState('');
  const [prompt, setPrompt] = useState('');
  const [duration, setDuration] = useState<VideoDuration>('30s');
  const [ratio, setRatio] = useState<VideoRatio>('9:16');
  const [coverImage, setCoverImage] = useState<string>('');

  /* ---------------- 素材选择弹窗（首帧图） ---------------- */
  const [materialPickerOpen, setMaterialPickerOpen] = useState(false);
  const [pickerSearch, setPickerSearch] = useState('');

  /* ---------------- 任务详情弹窗 ---------------- */
  const [detailTask, setDetailTask] = useState<VideoTask | null>(null);

  /* ---------------- 删除确认 ---------------- */
  const [deleteTarget, setDeleteTarget] = useState<VideoTask | null>(null);

  /* ---------------- 服务配置表单 ---------------- */
  const [configForm, setConfigForm] = useState<Partial<VideoServiceConfig>>({
    apiUrl: '',
    apiKey: '',
    modelName: '',
    callbackUrl: '',
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

  const { data: tasksData, isLoading: tasksLoading } = useQuery<
    PagedResponse<VideoTask>,
    any
  >({
    queryKey: ['videoTasks', { page, brandId, status: statusFilter, keyword: searchKw }],
    queryFn: () =>
      content.getVideoTasks({
        page,
        pageSize: PAGE_SIZE,
        brandId: brandId || undefined,
        status: (statusFilter as VideoTaskStatus) || undefined,
        keyword: searchKw || undefined,
      }),
    enabled: activeTab === 'tasks',
  });

  const { data: videoConfig, isError: configError } = useQuery({
    queryKey: ['videoConfig'],
    queryFn: () => content.getVideoConfig(),
    staleTime: 5 * 60 * 1000,
    retry: false,
    enabled: activeTab === 'config',
  });

  // 配置未就绪时（接口返回 isConfigured=false）
  const isServiceConfigured = videoConfig?.isConfigured ?? false;
  const showConfigAlert = activeTab === 'tasks' && videoConfig && !videoConfig.isConfigured;

  // 初始化配置表单
  React.useEffect(() => {
    if (videoConfig && activeTab === 'config') {
      setConfigForm({
        apiUrl: videoConfig.apiUrl || '',
        apiKey: videoConfig.apiKey || '',
        modelName: videoConfig.modelName || '',
        callbackUrl: videoConfig.callbackUrl || '',
      });
    }
  }, [videoConfig, activeTab]);

  const tasks = tasksData?.items ?? [];
  const total = tasksData?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  /* ---------------- Mutations ---------------- */
  const createTaskMutation = useMutation<VideoTask, any>({
    mutationFn: () =>
      content.createVideoTask({
        brandId: brandId || user?.brandId || '',
        taskName: taskName.trim(),
        prompt: prompt.trim(),
        duration,
        ratio,
        coverImage: coverImage || undefined,
      }),
    retry: false,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['videoTasks'] });
      setCreateOpen(false);
      resetCreateForm();
      toast.success('任务已创建');
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.error?.message ?? '创建失败');
    },
  });

  const submitTaskMutation = useMutation<VideoTask, any, string>({
    mutationFn: (id: string) => content.submitVideoTask(id),
    retry: false,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['videoTasks'] });
      toast.success('已提交生成');
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.error?.message ?? '提交失败');
    },
  });

  const pollTaskMutation = useMutation<VideoTask, any, string>({
    mutationFn: (id: string) => content.pollVideoTask(id),
    retry: false,
    onSuccess: (updated: VideoTask) => {
      queryClient.invalidateQueries({ queryKey: ['videoTasks'] });
      if (detailTask?.id === updated.id) {
        setDetailTask(updated);
      }
      if (updated.status === 'completed') {
        toast.success('视频生成完成');
      } else if (updated.status === 'failed') {
        toast.error(`生成失败：${updated.error || '未知错误'}`);
      } else {
        toast.success('状态已更新');
      }
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.error?.message ?? '刷新失败');
    },
  });

  const deleteTaskMutation = useMutation<void, any, string>({
    mutationFn: (id: string) => content.deleteVideoTask(id),
    retry: false,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['videoTasks'] });
      setDeleteTarget(null);
      toast.success('已删除');
      if (tasks.length === 1 && page > 1) {
        setPage(page - 1);
      }
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.error?.message ?? '删除失败');
    },
  });

  const updateConfigMutation = useMutation<VideoServiceConfig, any>({
    mutationFn: () => content.updateVideoConfig(configForm),
    retry: false,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['videoConfig'] });
      toast.success('配置已保存');
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.error?.message ?? '保存失败');
    },
  });

  const testConfigMutation = useMutation<{ ok: boolean; message: string }, any>({
    mutationFn: () => content.testVideoConfig(),
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

  /* ---------------- Handlers ---------------- */
  const resetCreateForm = () => {
    setTaskName('');
    setPrompt('');
    setDuration('30s');
    setRatio('9:16');
    setCoverImage('');
  };

  const handleSearch = useCallback(() => {
    setSearchKw(keyword.trim());
    setPage(1);
  }, [keyword]);

  const handleStatusChange = useCallback((val: string) => {
    setStatusFilter(val);
    setPage(1);
  }, []);

  const handleBrandChange = useCallback((val: string) => {
    setBrandId(val);
    setPage(1);
  }, []);

  const openCreateDialog = () => {
    resetCreateForm();
    setCreateOpen(true);
  };

  const handleCreateSubmit = () => {
    if (!taskName.trim()) {
      toast.error('请输入任务名称');
      return;
    }
    if (!prompt.trim()) {
      toast.error('请输入视频主题/脚本要点');
      return;
    }
    if (!brandId && !user?.brandId) {
      toast.error('请选择品牌');
      return;
    }
    createTaskMutation.mutate();
  };

  const handleSubmitTask = (id: string) => {
    submitTaskMutation.mutate(id);
  };

  const handlePollTask = (id: string) => {
    pollTaskMutation.mutate(id);
  };

  const openDetail = (task: VideoTask) => {
    setDetailTask(task);
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

  const handleSaveConfig = () => {
    if (!configForm.apiUrl?.trim()) {
      toast.error('请输入 API 地址');
      return;
    }
    updateConfigMutation.mutate();
  };

  const handleTestConfig = () => {
    testConfigMutation.mutate();
  };

  const getStatusVariant = useCallback(
    (s: VideoTaskStatus): 'default' | 'secondary' | 'destructive' => {
      switch (s) {
        case 'completed':
          return 'default';
        case 'failed':
          return 'destructive';
        default:
          return 'secondary';
      }
    },
    [],
  );

  const pageNumbers = useMemo(() => {
    const pages: number[] = [];
    const maxShown = 5;
    let start = Math.max(1, page - Math.floor(maxShown / 2));
    const end = Math.min(totalPages, start + maxShown - 1);
    start = Math.max(1, end - maxShown + 1);
    for (let i = start; i <= end; i += 1) pages.push(i);
    return pages;
  }, [page, totalPages]);

  return (
    <div className="space-y-6" style={{ backgroundColor: BG }}>
      {/* 页面标题 */}
      <div>
        <h1
          className="text-[20px] font-semibold leading-none"
          style={{ color: '#101828' }}
        >
          AI 视频
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          基于视频生成服务创建短视频任务，支持多规格输出
        </p>
      </div>

      {/* 顶层 Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-2">
          <TabsTrigger value="tasks">任务列表</TabsTrigger>
          <TabsTrigger value="config">服务配置</TabsTrigger>
        </TabsList>

        {/* ==================== 任务列表 tab ==================== */}
        <TabsContent value="tasks" className="mt-0">
          {/* 未配置提示 */}
          {showConfigAlert && (
            <Alert variant="default" className="mb-4 border-orange-200 bg-orange-50">
              <AlertCircle className="h-4 w-4 shrink-0" style={{ color: ACCENT }} />
              <div className="flex-1">
                <AlertTitle style={{ color: ACCENT }}>未配置视频生成服务</AlertTitle>
                <AlertDescription className="text-xs text-muted-foreground">
                  本系统不直接生成视频，需接入外部视频生成服务。请先在「服务配置」中设置。
                </AlertDescription>
              </div>
              {isAdmin && (
                <Button size="sm" onClick={() => setActiveTab('config')} style={{ backgroundColor: ACCENT }}>
                  去配置
                </Button>
              )}
            </Alert>
          )}

          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Video size={18} style={{ color: PRIMARY }} />
                视频任务
              </CardTitle>
              <CardDescription>共 {total} 个任务</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* 筛选栏 */}
              <div className="flex flex-wrap gap-3 items-end">
                {!isClient && (
                  <div className="space-y-1.5 w-[180px]">
                    <Label className="text-xs">品牌</Label>
                    <Select value={brandId} onValueChange={handleBrandChange}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="全部品牌" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">全部品牌</SelectItem>
                        {brandList.map((b: { id: string; name: string }) => (
                          <SelectItem key={b.id} value={b.id}>
                            {b.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <div className="space-y-1.5 w-[160px]">
                  <Label className="text-xs">状态筛选</Label>
                  <Select value={statusFilter} onValueChange={handleStatusChange}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="全部状态" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">全部</SelectItem>
                      {VIDEO_TASK_STATUSES.map((s: VideoTaskStatus) => (
                        <SelectItem key={s} value={s}>
                          {VIDEO_TASK_STATUS_LABELS[s]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5 flex-1 min-w-[200px]">
                  <Label className="text-xs">搜索任务</Label>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={14} />
                      <Input
                        placeholder="搜索任务名称..."
                        value={keyword}
                        onChange={(e) => setKeyword(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleSearch();
                        }}
                        className="pl-9"
                      />
                    </div>
                    <Button size="sm" onClick={handleSearch}>
                      搜索
                    </Button>
                  </div>
                </div>

                <div className="ml-auto">
                  <Button
                    style={{ backgroundColor: PRIMARY }}
                    onClick={openCreateDialog}
                    disabled={showConfigAlert}
                  >
                    <Plus size={16} />
                    新建视频任务
                  </Button>
                </div>
              </div>

              {/* 表格 */}
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[240px]">任务名称</TableHead>
                      {!isClient && <TableHead>品牌</TableHead>}
                      <TableHead>状态</TableHead>
                      <TableHead>时长</TableHead>
                      <TableHead>比例</TableHead>
                      <TableHead>创建时间</TableHead>
                      <TableHead className="text-right w-[260px]">操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {tasksLoading ? (
                      Array.from({ length: 5 }).map((_, i) => (
                        <TableRow key={i}>
                          <TableCell colSpan={!isClient ? 7 : 6}>
                            <Skeleton className="h-10 w-full" />
                          </TableCell>
                        </TableRow>
                      ))
                    ) : tasks.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={!isClient ? 7 : 6}
                          className="text-center py-16 text-muted-foreground"
                        >
                          <Empty className="py-4">
                            <EmptyMedia variant="icon">
                              <Video className="h-6 w-6" />
                            </EmptyMedia>
                            <EmptyHeader>
                              <EmptyTitle>暂无视频任务</EmptyTitle>
                            </EmptyHeader>
                            <EmptyContent>
                              <EmptyDescription>
                                点击「新建视频任务」开始创建
                              </EmptyDescription>
                            </EmptyContent>
                          </Empty>
                        </TableCell>
                      </TableRow>
                    ) : (
                      tasks.map((task: VideoTask) => (
                        <TableRow key={task.id}>
                          <TableCell className="font-medium">
                            <div className="truncate max-w-[240px]" title={task.taskName}>
                              {task.taskName}
                            </div>
                          </TableCell>
                          {!isClient && (
                            <TableCell className="text-muted-foreground">
                              {task.brandName}
                            </TableCell>
                          )}
                          <TableCell>
                            <Badge variant={getStatusVariant(task.status)}>
                              {VIDEO_TASK_STATUS_LABELS[task.status]}
                            </Badge>
                          </TableCell>
                          <TableCell>{VIDEO_DURATION_LABELS[task.duration]}</TableCell>
                          <TableCell>{VIDEO_RATIO_LABELS[task.ratio]}</TableCell>
                          <TableCell className="text-muted-foreground text-xs">
                            {new Date(task.createdAt).toLocaleString('zh-CN')}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              {/* 查看/播放 */}
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => openDetail(task)}
                                aria-label="查看"
                              >
                                {task.status === 'completed' ? (
                                  <Play size={14} />
                                ) : (
                                  <Eye size={14} />
                                )}
                                <span className="hidden sm:inline">
                                  {task.status === 'completed' ? '播放' : '查看'}
                                </span>
                              </Button>
                              {/* 轮询状态 */}
                              {task.status === 'pending' || task.status === 'generating' ? (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handlePollTask(task.id)}
                                  disabled={pollTaskMutation.isPending}
                                  aria-label="刷新状态"
                                >
                                  <RefreshCw
                                    size={14}
                                    className={pollTaskMutation.isPending ? 'animate-spin' : ''}
                                  />
                                </Button>
                              ) : null}
                              {/* 提交生成（pending 状态） */}
                              {task.status === 'pending' && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  style={{ color: PRIMARY }}
                                  onClick={() => handleSubmitTask(task.id)}
                                  disabled={submitTaskMutation.isPending}
                                  aria-label="提交生成"
                                >
                                  {submitTaskMutation.isPending ? (
                                    <Loader2 size={14} className="animate-spin" />
                                  ) : (
                                    '提交'
                                  )}
                                </Button>
                              )}
                              {/* 删除 */}
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => setDeleteTarget(task)}
                                aria-label="删除"
                                className="text-red-500"
                              >
                                <Trash2 size={14} />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>

              {/* 分页 */}
              {totalPages > 1 && (
                <Pagination>
                  <PaginationContent>
                    <PaginationItem>
                      <PaginationPrevious
                        onClick={() => setPage(Math.max(1, page - 1))}
                        className={page === 1 ? 'pointer-events-none opacity-50 cursor-pointer' : 'cursor-pointer'}
                        aria-disabled={page === 1}
                      />
                    </PaginationItem>
                    {pageNumbers.map((p: number) => (
                      <PaginationItem key={p}>
                        <PaginationLink
                          isActive={p === page}
                          onClick={() => setPage(p)}
                          className="cursor-pointer"
                        >
                          {p}
                        </PaginationLink>
                      </PaginationItem>
                    ))}
                    <PaginationItem>
                      <PaginationNext
                        onClick={() => setPage(Math.min(totalPages, page + 1))}
                        className={page === totalPages ? 'pointer-events-none opacity-50 cursor-pointer' : 'cursor-pointer'}
                        aria-disabled={page === totalPages}
                      />
                    </PaginationItem>
                  </PaginationContent>
                </Pagination>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ==================== 服务配置 tab ==================== */}
        <TabsContent value="config" className="mt-0">
          {!isAdmin ? (
            <Card className="shadow-sm">
              <CardContent className="pt-8 pb-8 text-center">
                <AlertCircle className="mx-auto h-10 w-10 text-orange-500" />
                <h3 className="mt-3 text-base font-medium" style={{ color: '#0f172a' }}>
                  无权限访问
                </h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  视频服务配置仅管理员可查看和修改
                </p>
              </CardContent>
            </Card>
          ) : (
            <Card className="shadow-sm max-w-xl">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Settings size={18} style={{ color: PRIMARY }} />
                  视频生成服务配置
                </CardTitle>
                <CardDescription>
                  配置外部视频生成服务的 API 信息
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                {/* 当前状态 */}
                <div
                  className={`flex items-center gap-3 rounded-md border p-3 ${
                    isServiceConfigured
                      ? 'border-green-200 bg-green-50'
                      : 'border-orange-200 bg-orange-50'
                  }`}
                >
                  {isServiceConfigured ? (
                    <CheckCircle2 className="h-5 w-5" style={{ color: SUCCESS }} />
                  ) : (
                    <AlertCircle className="h-5 w-5" style={{ color: ACCENT }} />
                  )}
                  <div>
                    <div className="text-sm font-medium" style={{ color: isServiceConfigured ? SUCCESS : ACCENT }}>
                      {isServiceConfigured ? '已配置' : '未配置'}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {isServiceConfigured ? '视频生成服务已就绪' : '请填写下方配置信息并保存'}
                    </div>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="video-api-url">API 地址</Label>
                  <Input
                    id="video-api-url"
                    value={configForm.apiUrl ?? ''}
                    onChange={(e) =>
                      setConfigForm({ ...configForm, apiUrl: e.target.value })
                    }
                    placeholder="https://api.example.com/v1/videos"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="video-api-key">API Key</Label>
                  <Input
                    id="video-api-key"
                    type="password"
                    value={configForm.apiKey ?? ''}
                    onChange={(e) =>
                      setConfigForm({ ...configForm, apiKey: e.target.value })
                    }
                    placeholder="sk-xxxxxxxxxxxxxx"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="video-model">模型名称</Label>
                  <Input
                    id="video-model"
                    value={configForm.modelName ?? ''}
                    onChange={(e) =>
                      setConfigForm({ ...configForm, modelName: e.target.value })
                    }
                    placeholder="stable-video-diffusion"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="video-callback">回调地址（可选）</Label>
                  <Input
                    id="video-callback"
                    value={configForm.callbackUrl ?? ''}
                    onChange={(e) =>
                      setConfigForm({ ...configForm, callbackUrl: e.target.value })
                    }
                    placeholder="https://your-domain.com/api/callback/video"
                  />
                  <p className="text-xs text-muted-foreground">
                    视频生成完成后，外部服务将调用此地址通知结果
                  </p>
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

                <div className="flex gap-2 pt-2">
                  <Button
                    variant="outline"
                    onClick={handleTestConfig}
                    disabled={testConfigMutation.isPending || updateConfigMutation.isPending}
                  >
                    {testConfigMutation.isPending && (
                      <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                    )}
                    测试连通性
                  </Button>
                  <div className="flex-1" />
                  <Button
                    style={{ backgroundColor: PRIMARY }}
                    onClick={handleSaveConfig}
                    disabled={updateConfigMutation.isPending}
                  >
                    {updateConfigMutation.isPending && (
                      <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                    )}
                    保存配置
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* 新建任务弹窗 */}
      <Dialog open={createOpen} onOpenChange={(o) => !o && setCreateOpen(false)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>新建视频任务</DialogTitle>
            <DialogDescription>
              填写视频参数，提交后开始生成
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
            {/* 品牌 */}
            <div className="space-y-1.5">
              <Label>品牌</Label>
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

            {/* 任务名 */}
            <div className="space-y-1.5">
              <Label htmlFor="task-name">任务名称</Label>
              <Input
                id="task-name"
                value={taskName}
                onChange={(e) => setTaskName(e.target.value)}
                placeholder="例如：新品宣传视频"
              />
            </div>

            {/* 主题/脚本要点 */}
            <div className="space-y-1.5">
              <Label htmlFor="task-prompt">视频主题 / 脚本要点</Label>
              <Textarea
                id="task-prompt"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="描述视频的核心内容、风格、关键场景..."
                rows={4}
              />
            </div>

            {/* 时长 */}
            <div className="space-y-1.5">
              <Label>视频时长</Label>
              <RadioGroup
                value={duration}
                onValueChange={(v) => setDuration(v as VideoDuration)}
                className="grid grid-cols-3 gap-2"
              >
                {VIDEO_DURATIONS.map((d: VideoDuration) => (
                  <div key={d}>
                    <RadioGroupItem value={d} id={`dur-${d}`} className="peer sr-only" />
                    <Label
                      htmlFor={`dur-${d}`}
                      className="flex cursor-pointer items-center justify-center rounded-md border px-3 py-2 text-sm peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/5 peer-data-[state=checked]:font-medium hover:bg-slate-50"
                      style={
                        duration === d
                          ? { borderColor: PRIMARY, backgroundColor: `${PRIMARY}0d` }
                          : undefined
                      }
                    >
                      {VIDEO_DURATION_LABELS[d]}
                    </Label>
                  </div>
                ))}
              </RadioGroup>
            </div>

            {/* 比例 */}
            <div className="space-y-1.5">
              <Label>视频比例</Label>
              <RadioGroup
                value={ratio}
                onValueChange={(v) => setRatio(v as VideoRatio)}
                className="grid grid-cols-3 gap-2"
              >
                {VIDEO_RATIOS.map((r: VideoRatio) => (
                  <div key={r}>
                    <RadioGroupItem value={r} id={`ratio-${r}`} className="peer sr-only" />
                    <Label
                      htmlFor={`ratio-${r}`}
                      className="flex cursor-pointer items-center justify-center rounded-md border px-3 py-2 text-sm peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/5 peer-data-[state=checked]:font-medium hover:bg-slate-50"
                      style={
                        ratio === r
                          ? { borderColor: PRIMARY, backgroundColor: `${PRIMARY}0d` }
                          : undefined
                      }
                    >
                      {VIDEO_RATIO_LABELS[r]}
                    </Label>
                  </div>
                ))}
              </RadioGroup>
            </div>

            {/* 首帧图 */}
            <div className="space-y-1.5">
              <Label>首帧图（可选）</Label>
              {coverImage ? (
                <div className="relative inline-block">
                  <div className="h-24 w-24 overflow-hidden rounded-md border">
                    <Image src={coverImage} alt="首帧图" className="h-full w-full object-cover" />
                  </div>
                  <button
                    type="button"
                    onClick={() => setCoverImage('')}
                    className="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-white"
                    aria-label="移除首帧图"
                  >
                    <X size={12} />
                  </button>
                </div>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setMaterialPickerOpen(true)}
                >
                  <ImageIcon className="mr-1 h-3.5 w-3.5" />
                  从素材库选择
                </Button>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              取消
            </Button>
            <Button
              style={{ backgroundColor: PRIMARY }}
              onClick={handleCreateSubmit}
              disabled={createTaskMutation.isPending}
            >
              {createTaskMutation.isPending && (
                <Loader2 className="mr-1 h-4 w-4 animate-spin" />
              )}
              提交任务
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 任务详情/播放弹窗 */}
      <Dialog open={!!detailTask} onOpenChange={(o) => !o && setDetailTask(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{detailTask?.taskName}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* 状态 */}
            <div className="flex items-center gap-2">
              <Badge variant={detailTask ? getStatusVariant(detailTask.status) : 'secondary'}>
                {detailTask ? VIDEO_TASK_STATUS_LABELS[detailTask.status] : ''}
              </Badge>
              <Badge variant="outline">
                {detailTask ? VIDEO_DURATION_LABELS[detailTask.duration] : ''}
              </Badge>
              <Badge variant="outline">
                {detailTask ? VIDEO_RATIO_LABELS[detailTask.ratio] : ''}
              </Badge>
              {detailTask?.status === 'failed' && detailTask.error && (
                <span className="text-xs text-red-500 ml-auto">
                  {detailTask.error}
                </span>
              )}
            </div>

            {/* 视频播放器 / 封面图 */}
            {detailTask?.status === 'completed' && detailTask.videoUrl ? (
              <div className="overflow-hidden rounded-md border bg-black aspect-video">
                <video
                  src={detailTask.videoUrl}
                  controls
                  className="h-full w-full"
                  poster={detailTask.coverImage ?? undefined}
                />
              </div>
            ) : detailTask?.coverImage ? (
              <div className="overflow-hidden rounded-md border bg-slate-100 aspect-video flex items-center justify-center">
                <Image
                  src={detailTask.coverImage}
                  alt="封面"
                  className="h-full w-full object-cover"
                />
              </div>
            ) : (
              <div className="flex aspect-video items-center justify-center rounded-md border bg-slate-50">
                <Video className="h-12 w-12 text-slate-300" />
              </div>
            )}

            {/* 任务信息 */}
            <div className="space-y-2 text-sm">
              <div className="flex">
                <span className="w-20 text-muted-foreground shrink-0">任务主题</span>
                <span className="flex-1 whitespace-pre-wrap text-slate-700">
                  {detailTask?.prompt}
                </span>
              </div>
              <div className="flex">
                <span className="w-20 text-muted-foreground shrink-0">消耗算力</span>
                <span>{detailTask?.costCredits ?? 0} 点</span>
              </div>
              <div className="flex">
                <span className="w-20 text-muted-foreground shrink-0">创建时间</span>
                <span className="text-xs">
                  {detailTask ? new Date(detailTask.createdAt).toLocaleString('zh-CN') : ''}
                </span>
              </div>
            </div>
          </div>

          <DialogFooter>
            {detailTask?.status === 'completed' && detailTask.videoUrl && (
              <Button
                variant="outline"
                onClick={() => handleDownload(detailTask.videoUrl!, detailTask.taskName)}
              >
                <Download className="mr-1 h-4 w-4" />
                下载
              </Button>
            )}
            {(detailTask?.status === 'pending' || detailTask?.status === 'generating') && (
              <Button
                variant="outline"
                onClick={() => detailTask && handlePollTask(detailTask.id)}
                disabled={pollTaskMutation.isPending}
              >
                <RefreshCw
                  className={`mr-1 h-4 w-4 ${pollTaskMutation.isPending ? 'animate-spin' : ''}`}
                />
                刷新状态
              </Button>
            )}
            <Button variant="outline" onClick={() => setDetailTask(null)}>
              关闭
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 素材选择弹窗（简化版：用输入框替代，后续可接入真实素材库） */}
      <Dialog open={materialPickerOpen} onOpenChange={(o) => !o && setMaterialPickerOpen(false)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>选择首帧图</DialogTitle>
            <DialogDescription>
              输入图片 URL（后续将接入素材库选择）
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Input
              value={pickerSearch}
              onChange={(e) => setPickerSearch(e.target.value)}
              placeholder="输入图片 URL"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMaterialPickerOpen(false)}>
              取消
            </Button>
            <Button
              style={{ backgroundColor: PRIMARY }}
              onClick={() => {
                setCoverImage(pickerSearch.trim());
                setMaterialPickerOpen(false);
              }}
            >
              确认
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 删除确认 */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除</AlertDialogTitle>
            <AlertDialogDescription>
              确定要删除任务「{deleteTarget?.taskName}」吗？此操作不可恢复。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteTarget && deleteTaskMutation.mutate(deleteTarget.id)}
              className="bg-destructive hover:bg-destructive/90"
            >
              {deleteTaskMutation.isPending ? '删除中...' : '确认删除'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

// Eye 组件本地定义（避免额外 import）
const Eye: React.FC<{ className?: string; size?: number }> = ({ className, size = 24 }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

export default VideoPage;
