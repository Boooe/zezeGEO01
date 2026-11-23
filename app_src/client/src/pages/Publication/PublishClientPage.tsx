import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Download,
  Shield,
  Zap,
  Radio,
  Unlink,
  Inbox,
  RefreshCw,
  AlertCircle,
} from 'lucide-react';
import { Button } from '@client/src/components/ui/button';
import { SectionCard } from '@client/src/components/layout/SectionCard';
import { DataTable } from '@client/src/components/layout/DataTable';
import { Pill } from '@client/src/components/layout/Pill';
import { EmptyState } from '@client/src/components/layout/EmptyState';
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
import { PageHeader } from '@client/src/components/layout/PageHeader';
import {
  downloadScript,
  listClients,
} from '@client/src/api/publish-client';
import { getBrands } from '@client/src/api/brands';
import { useAuth } from '@client/src/hooks/useAuth';
import {
  ACCOUNT_PLATFORM_LABELS,
} from '@shared/api.interface';
import type {
  AccountPlatform,
} from '@shared/api.interface';

interface ClientItem {
  id: string;
  accountName: string;
  platform: AccountPlatform;
  isOnline: boolean;
  clientVersion: string;
  lastHeartbeat: string | null;
  brandId: string;
  brandName: string;
}

const PRIMARY = '#2E7DFF';
const SUCCESS = '#17C964';
const MUTED = '#64748b';

const PublishClientPage: React.FC = () => {
  const { user } = useAuth();
  const isClient = user?.role === 'client';

  const [selectedBrandId, setSelectedBrandId] = useState<string>(
    isClient && user?.brandId ? user.brandId : '',
  );

  const { data: brandOptions = [] } = useQuery({
    queryKey: ['brands', 'options'],
    queryFn: () => getBrands(),
    retry: 2,
    retryDelay: 2000,
    enabled: !isClient,
  });

  const brandIdForQuery = useMemo(() => {
    if (isClient) return user?.brandId || undefined;
    return selectedBrandId || undefined;
  }, [isClient, user?.brandId, selectedBrandId]);

  const {
    data: clientsData,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['publishClients', brandIdForQuery],
    queryFn: () => listClients(brandIdForQuery),
    retry: 2,
    retryDelay: 2000,
  });

  const clients: ClientItem[] = useMemo(() => {
    if (!clientsData) return [];
    if (Array.isArray(clientsData)) return clientsData;
    if (clientsData.items && Array.isArray(clientsData.items)) {
      return clientsData.items;
    }
    return [];
  }, [clientsData]);

  const handleDownload = async () => {
    try {
      const blob: Blob = await downloadScript();
      const url: string = URL.createObjectURL(blob);
      const a: HTMLAnchorElement = document.createElement('a');
      a.href = url;
      a.download = 'geo-publish-client.py';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success('下载已开始');
    } catch (err) {
      const error = err as Error;
      toast.error(error.message || '下载失败');
    }
  };

  const handleUnbind = (client: ClientItem) => {
    toast.info(`解绑「${client.accountName}」客户端功能待实现`);
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleString('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const currentBrandName = useMemo(() => {
    if (!isClient || !user?.brandId) return '';
    return brandOptions.find((b) => b.id === user.brandId)?.name || '';
  }, [isClient, user?.brandId, brandOptions]);

  return (
    <div className="space-y-6" style={{ backgroundColor: '#f8fafc' }}>
      <PageHeader
        title="发布客户端"
        description="本地客户端程序，用于在各平台后台半自动发布文章"
      />

      {/* 为什么需要客户端 */}
      <SectionCard title="为什么需要客户端？">
          <p className="text-[13px] leading-relaxed mb-4 text-[#5B6B85]">
            各内容平台（百家号、头条号、知乎等）不开放第三方发布 API，无法通过后台直接调用接口发布文章。发布客户端在本机运行，利用浏览器自动化能力打开平台后台编辑器，由人工确认后完成发布。
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex items-start gap-3">
              <div
                className="flex size-9 shrink-0 items-center justify-center rounded-lg"
                style={{ backgroundColor: 'rgba(23, 201, 100, 0.1)' }}
              >
                <Shield className="h-5 w-5" style={{ color: SUCCESS }} />
              </div>
              <div>
                <div className="text-[13px] font-medium text-[#0F172A]">
                  账号安全
                </div>
                <div className="text-[12px] mt-1 leading-relaxed text-[#5B6B85]">
                  账号密码仅保存在本机浏览器中，服务端不存储
                </div>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div
                className="flex size-9 shrink-0 items-center justify-center rounded-lg"
                style={{ backgroundColor: 'rgba(46, 125, 255, 0.1)' }}
              >
                <Zap className="h-5 w-5" style={{ color: PRIMARY }} />
              </div>
              <div>
                <div className="text-[13px] font-medium text-[#0F172A]">
                  半自动
                </div>
                <div className="text-[12px] mt-1 leading-relaxed text-[#5B6B85]">
                  自动填充内容、打开编辑器，人工确认后一键提交
                </div>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div
                className="flex size-9 shrink-0 items-center justify-center rounded-lg"
                style={{ backgroundColor: 'rgba(250, 173, 20, 0.1)' }}
              >
                <Radio className="h-5 w-5" style={{ color: '#FAAD14' }} />
              </div>
              <div>
                <div className="text-[13px] font-medium text-[#0F172A]">
                  心跳上报
                </div>
                <div className="text-[12px] mt-1 leading-relaxed text-[#5B6B85]">
                  客户端实时上报在线状态，后台可查看在线情况
                </div>
              </div>
            </div>
          </div>
      </SectionCard>

      {/* 下载区块 */}
      <SectionCard
        title="下载发布客户端"
        actions={
          <Button onClick={handleDownload} style={{ backgroundColor: PRIMARY }}>
            <Download className="h-4 w-4" />
            下载客户端
          </Button>
        }
      >
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <div className="text-[13px] font-medium text-[#0F172A]">
              geo-publish-client.py
            </div>
            <div className="text-[12px] mt-1 text-[#5B6B85]">
              Python 脚本，纯标准库，无第三方依赖
            </div>
          </div>
        </div>
      </SectionCard>

      {/* 安装与使用三步说明 */}
      <SectionCard title="安装与使用">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Step 1 */}
            <div className="flex flex-col items-start">
              <div
                className="flex size-10 items-center justify-center rounded-full text-sm font-semibold text-white mb-3"
                style={{ backgroundColor: PRIMARY }}
              >
                1
              </div>
              <div className="text-[13px] font-medium mb-1.5 text-[#0F172A]">
                下载脚本
              </div>
              <div className="text-[12px] leading-relaxed text-[#5B6B85]">
                下载脚本文件，在本地安装 Python 3.8+，运行
                <code
                  className="mx-1 px-1.5 py-0.5 rounded text-xs"
                  style={{ backgroundColor: '#f1f5f9', color: '#334155' }}
                >
                  python geo-publish-client.py --help
                </code>
                查看帮助。
              </div>
            </div>

            {/* Step 2 */}
            <div className="flex flex-col items-start">
              <div
                className="flex size-10 items-center justify-center rounded-full text-sm font-semibold text-white mb-3"
                style={{ backgroundColor: PRIMARY }}
              >
                2
              </div>
              <div className="text-[13px] font-medium mb-1.5 text-[#0F172A]">
                获取授权码
              </div>
              <div className="text-[12px] leading-relaxed text-[#5B6B85]">
                在「授权账号」页添加账号，拿到 6 位授权码。
              </div>
            </div>

            {/* Step 3 */}
            <div className="flex flex-col items-start">
              <div
                className="flex size-10 items-center justify-center rounded-full text-sm font-semibold text-white mb-3"
                style={{ backgroundColor: PRIMARY }}
              >
                3
              </div>
              <div className="text-[13px] font-medium mb-1.5 text-[#0F172A]">
                运行客户端
              </div>
              <div className="text-[12px] leading-relaxed text-[#5B6B85]">
                执行
                <code
                  className="mx-1 px-1.5 py-0.5 rounded text-xs"
                  style={{ backgroundColor: '#f1f5f9', color: '#334155' }}
                >
                  python geo-publish-client.py bind {'<授权码>'}
                </code>
                完成绑定，再执行
                <code
                  className="mx-1 px-1.5 py-0.5 rounded text-xs"
                  style={{ backgroundColor: '#f1f5f9', color: '#334155' }}
                >
                  python geo-publish-client.py run
                </code>
                开始监听任务。
              </div>
            </div>
          </div>
      </SectionCard>

      {/* 客户端列表 */}
      <SectionCard
        title="已连接客户端"
        count={clients.length}
        actions={
          <div className="flex items-center gap-2">
            {!isClient && (
              <Select value={selectedBrandId} onValueChange={setSelectedBrandId}>
                <SelectTrigger className="w-40 h-9">
                  <SelectValue placeholder="全部品牌" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">全部品牌</SelectItem>
                  {brandOptions.map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {isClient && currentBrandName && (
              <span className="text-[12px] text-[#5B6B85]">
                品牌：{currentBrandName}
              </span>
            )}
            <Button size="sm" variant="outline" onClick={() => refetch()} className="h-9">
              <RefreshCw className="h-3.5 w-3.5" />
              刷新
            </Button>
          </div>
        }
      >
        {/* 错误态 */}
        {isError && (
          <div className="flex items-center justify-between rounded-lg border border-amber-200 bg-amber-50 p-4 mb-4">
            <div className="flex items-center gap-2 text-sm text-amber-700">
              <AlertCircle className="h-4 w-4" />
              <span>数据加载失败，请稍后刷新</span>
            </div>
            <button
              onClick={() => refetch()}
              className="flex items-center gap-1 rounded-md px-3 py-1.5 text-sm font-medium text-amber-700 hover:bg-amber-100 transition-colors"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              重新加载
            </button>
          </div>
        )}

        {/* 表格区 */}
        {isLoading ? (
          <TableSkeleton />
        ) : clients.length > 0 ? (
          <DataTable
            columns={[
              { key: 'accountName', title: '账号名称' },
              { key: 'platform', title: '平台', width: '120px', render: (row: ClientItem) => ACCOUNT_PLATFORM_LABELS[row.platform] || row.platform },
              { key: 'isOnline', title: '在线状态', width: '100px', render: (row: ClientItem) => (
                <Pill variant={row.isOnline ? 'success' : 'muted'}>
                  {row.isOnline ? '在线' : '离线'}
                </Pill>
              )},
              { key: 'clientVersion', title: '客户端版本', width: '120px', render: (row: ClientItem) => row.clientVersion || '-' },
              { key: 'lastHeartbeat', title: '最近心跳', width: '160px', render: (row: ClientItem) => (
                <span className="text-[#5B6B85]">{formatDate(row.lastHeartbeat)}</span>
              )},
              { key: 'action', title: '操作', width: '100px', align: 'right', render: (row: ClientItem) => (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 px-2 text-xs"
                  style={{ color: '#EF4444' }}
                  onClick={() => handleUnbind(row)}
                >
                  <Unlink className="h-3 w-3" />
                  解绑
                </Button>
              )},
            ]}
            data={clients}
            rowKey="id"
          />
        ) : (
          <EmptyState
            icon={<Inbox />}
            description="暂无已连接的客户端"
          />
        )}
      </SectionCard>
    </div>
  );
};

const TableSkeleton = () => (
  <div className="space-y-2">
    {Array.from({ length: 5 }).map((_, i) => (
      <div key={i} className="flex items-center gap-4 h-11">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-4 w-16" />
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-4 w-16 ml-auto" />
      </div>
    ))}
  </div>
);

export default PublishClientPage;
