import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  FileText,
  Image as ImageIcon,
  Video,
  Sparkles,
  Eye,
  Clock,
  AlertCircle,
  Zap,
  ListChecks,
  TrendingUp,
  ChevronRight,
} from 'lucide-react';

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@client/src/components/ui/card';
import { Button } from '@client/src/components/ui/button';
import { Badge } from '@client/src/components/ui/badge';
import { Skeleton } from '@client/src/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@client/src/components/ui/table';
import { Image } from '@client/src/components/ui/image';
import {
  Empty,
  EmptyHeader,
  EmptyTitle,
  EmptyContent,
  EmptyDescription,
} from '@client/src/components/ui/empty';

import { creation } from '@client/src/api';
import { useAuth } from '@client/src/contexts/AuthContext';
import {
  RECENT_ITEM_TYPE_LABELS,
  type CreationOverviewStats,
  type RecentGenerationItem,
} from '@shared/api.interface';

const CreationHome: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const brandId = user?.brandId ?? '';

  const { data: stats, isLoading: statsLoading } = useQuery<CreationOverviewStats, unknown>({
    queryKey: ['creationOverview', brandId],
    queryFn: () => creation.getOverviewStats(brandId || undefined),
    staleTime: 60 * 1000,
  });

  const { data: recent, isLoading: recentLoading } = useQuery<RecentGenerationItem[], unknown>({
    queryKey: ['creationRecent', brandId],
    queryFn: () => creation.getRecentGenerations(10, brandId || undefined),
    staleTime: 30 * 1000,
  });

  const statCards = [
    {
      label: '本月生成文章',
      value: stats?.monthArticleCount ?? 0,
      icon: FileText,
      iconBg: 'bg-blue-50',
      iconColor: 'text-blue-600',
      trend: '+12%',
    },
    {
      label: '本月生成图片',
      value: stats?.monthImageCount ?? 0,
      icon: ImageIcon,
      iconBg: 'bg-sky-50',
      iconColor: 'text-sky-600',
      trend: '+8%',
    },
    {
      label: '本月生成视频',
      value: stats?.monthVideoCount ?? 0,
      icon: Video,
      iconBg: 'bg-blue-50',
      iconColor: 'text-blue-600',
      trend: '+25%',
    },
    {
      label: '本月算力消耗',
      value: stats?.monthCreditUsed?.toLocaleString() ?? '0',
      icon: Zap,
      iconBg: 'bg-orange-50',
      iconColor: 'text-orange-600',
      trend: '+5%',
    },
    {
      label: '待审核',
      value: stats?.pendingReviewCount ?? 0,
      icon: AlertCircle,
      iconBg: 'bg-amber-50',
      iconColor: 'text-amber-600',
      trend: '-3%',
    },
  ];

  const quickEntries = [
    {
      title: 'AI 文章生成',
      description: '智能批量生成高质量营销文案',
      icon: FileText,
      path: '/creation/article',
      iconBg: 'bg-blue-500',
    },
    {
      title: 'AI 图片生成',
      description: '一键生成营销配图与海报素材',
      icon: ImageIcon,
      path: '/creation/image',
      iconBg: 'bg-sky-500',
    },
    {
      title: 'AI 视频生成',
      description: '短视频内容批量自动化生产',
      icon: Video,
      path: '/creation/video',
      iconBg: 'bg-blue-500',
    },
  ];

  const getStatusBadgeStyle = (status: string): { className: string; style: React.CSSProperties } => {
    switch (status) {
      case 'completed':
      case 'published':
        return {
          className: 'border-transparent text-white',
          style: { backgroundColor: 'hsl(130 54% 42%)' },
        };
      case 'generating':
      case 'processing':
        return {
          className: 'border-transparent text-white',
          style: { backgroundColor: 'hsl(221 83% 53%)' },
        };
      case 'pending':
        return {
          className: 'border-transparent text-white',
          style: { backgroundColor: 'hsl(26 90% 49%)' },
        };
      case 'draft':
        return {
          className: 'border bg-slate-100 text-slate-600',
          style: {},
        };
      case 'failed':
        return {
          className: 'border-transparent text-white bg-destructive',
          style: {},
        };
      default:
        return {
          className: 'border bg-slate-100 text-slate-600',
          style: {},
        };
    }
  };

  const getStatusLabel = (status: string): string => {
    const map: Record<string, string> = {
      draft: '草稿',
      published: '已发布',
      generating: '生成中',
      failed: '失败',
      completed: '已完成',
      pending: '排队中',
      processing: '处理中',
    };
    return map[status] || status;
  };

  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[20px] font-semibold tracking-tight text-foreground">
            AI 创作中心
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            一站式内容创作平台，快速生成高质量营销内容
          </p>
        </div>
        <Button variant="outline" onClick={() => navigate('/creation/tasks')}>
          <Clock className="h-4 w-4" />
          任务队列
        </Button>
      </div>

      {/* 数据概览 */}
      <div>
        <h2 className="mb-3 text-sm font-semibold text-foreground">数据概览</h2>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
          {statsLoading
            ? statCards.map((_, i) => (
                <Card key={i}>
                  <CardContent className="p-5">
                    <Skeleton className="mb-3 h-10 w-10 rounded-lg" />
                    <Skeleton className="mb-1 h-7 w-16" />
                    <Skeleton className="h-3 w-20" />
                  </CardContent>
                </Card>
              ))
            : statCards.map((card, i) => {
                const Icon = card.icon;
                const isUp = card.trend.startsWith('+');
                return (
                  <Card key={i}>
                    <CardContent className="p-5">
                      <div
                        className={`mb-3 flex h-10 w-10 items-center justify-center rounded-lg ${card.iconBg}`}
                      >
                        <Icon className={`h-5 w-5 ${card.iconColor}`} />
                      </div>
                      <div className="text-2xl font-semibold tracking-tight text-foreground">
                        {card.value}
                      </div>
                      <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                        <span>{card.label}</span>
                        <span
                          className={`ml-auto inline-flex items-center gap-0.5 ${isUp ? 'text-emerald-600' : 'text-rose-600'}`}
                        >
                          <TrendingUp
                            className={`h-3 w-3 ${!isUp ? 'rotate-180' : ''}`}
                          />
                          {card.trend}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
        </div>
      </div>

      {/* 快捷入口 */}
      <div>
        <h2 className="mb-3 text-sm font-semibold text-foreground">快捷入口</h2>
        <div className="grid gap-4 md:grid-cols-3">
          {quickEntries.map((entry, i) => {
            const Icon = entry.icon;
            return (
              <Card
                key={i}
                className="cursor-pointer transition-all hover:shadow-md"
                onClick={() => navigate(entry.path)}
              >
                <CardContent className="p-5">
                  <div className="flex items-start gap-4">
                    <div
                      className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-lg ${entry.iconBg}`}
                    >
                      <Icon className="h-6 w-6 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-base font-semibold text-foreground">
                        {entry.title}
                      </h3>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {entry.description}
                      </p>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="mt-3 h-7 px-2 text-xs text-primary hover:text-primary"
                      >
                        立即创作
                        <ChevronRight className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* 最近生成 */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground">最近生成</h2>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/creation/tasks')}
          >
            查看全部
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <Card>
          <CardContent className="p-0">
            {recentLoading ? (
              <div className="p-4 space-y-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full rounded" />
                ))}
              </div>
            ) : !recent || recent.length === 0 ? (
              <div className="p-12">
                <Empty>
                  <EmptyHeader>
                    <Sparkles className="h-10 w-10 text-slate-300" />
                  </EmptyHeader>
                  <EmptyContent>
                    <EmptyTitle>暂无生成记录</EmptyTitle>
                    <EmptyDescription>开始创作你的第一篇内容吧</EmptyDescription>
                  </EmptyContent>
                </Empty>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-20">类型</TableHead>
                    <TableHead>标题/名称</TableHead>
                    <TableHead className="w-32">品牌</TableHead>
                    <TableHead className="w-24">状态</TableHead>
                    <TableHead className="w-40">创建时间</TableHead>
                    <TableHead className="w-24 text-right">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recent.map((item: RecentGenerationItem) => {
                    const statusStyle = getStatusBadgeStyle(item.status);
                    return (
                      <TableRow key={`${item.type}-${item.id}`}>
                        <TableCell>
                          <Badge variant="outline" className="gap-1">
                            {item.type === 'article' && (
                              <FileText className="h-3 w-3" />
                            )}
                            {item.type === 'image' && (
                              <ImageIcon className="h-3 w-3" />
                            )}
                            {item.type === 'video' && (
                              <Video className="h-3 w-3" />
                            )}
                            {RECENT_ITEM_TYPE_LABELS[item.type]}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            {item.thumbnail && item.type !== 'article' ? (
                              <div className="h-10 w-10 shrink-0 overflow-hidden rounded border">
                                <Image
                                  src={item.thumbnail}
                                  alt={item.title}
                                  className="h-full w-full object-cover"
                                />
                              </div>
                            ) : null}
                            <span className="truncate font-medium text-foreground">
                              {item.title}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {item.brandName}
                        </TableCell>
                        <TableCell>
                          <Badge
                            className={statusStyle.className}
                            style={statusStyle.style}
                          >
                            {getStatusLabel(item.status)}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {new Date(item.createdAt).toLocaleString('zh-CN')}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="sm">
                            <Eye className="mr-1 h-3 w-3" />
                            查看
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default CreationHome;
