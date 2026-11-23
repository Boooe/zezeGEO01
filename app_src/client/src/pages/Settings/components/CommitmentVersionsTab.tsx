import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, FileText, Zap, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import {
  Card,
  CardContent,
} from '@client/src/components/ui/card';
import { Button } from '@client/src/components/ui/button';
import { Badge } from '@client/src/components/ui/badge';
import { Skeleton } from '@client/src/components/ui/skeleton';
import { Textarea } from '@client/src/components/ui/textarea';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@client/src/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@client/src/components/ui/dialog';
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from '@client/src/components/ui/empty';
import {
  listVersions,
  createVersion,
  activateVersion,
} from '@client/src/api/commitment';
import type { CommitmentVersion } from '@shared/api.interface';

const PRIMARY = '#1e40af';
const SUCCESS = '#10b981';
const MUTED = '#64748b';

function formatDateTime(dateStr: string): string {
  const d = new Date(dateStr);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

const CommitmentVersionsTab = () => {
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [createContent, setCreateContent] = useState('');
  const [viewOpen, setViewOpen] = useState(false);
  const [viewVersion, setViewVersion] = useState<CommitmentVersion | null>(null);
  const [activateOpen, setActivateOpen] = useState(false);
  const [activateItem, setActivateItem] = useState<CommitmentVersion | null>(null);

  const { data: versions = [], isLoading, isError, refetch } = useQuery({
    queryKey: ['commitment', 'versions'],
    queryFn: listVersions,
    staleTime: 30 * 1000,
  });

  const activeVersion = versions.find((v: CommitmentVersion) => v.isActive);

  const openCreate = () => {
    setCreateContent(activeVersion?.content || '');
    setCreateOpen(true);
  };

  const createMutation = useMutation({
    mutationFn: (content: string) => createVersion(content),
    retry: false,
    onSuccess: () => {
      toast.success('新版本已创建');
      queryClient.invalidateQueries({ queryKey: ['commitment', 'versions'] });
      setCreateOpen(false);
      setCreateContent('');
    },
    onError: (err: unknown) => {
      const e = err as { response?: { data?: { error?: { message?: string } } } };
      toast.error(e.response?.data?.error?.message || '创建版本失败');
    },
  });

  const activateMutation = useMutation({
    mutationFn: (id: string) => activateVersion(id),
    retry: false,
    onSuccess: () => {
      toast.success('版本已激活');
      queryClient.invalidateQueries({ queryKey: ['commitment', 'versions'] });
      setActivateOpen(false);
      setActivateItem(null);
    },
    onError: (err: unknown) => {
      const e = err as { response?: { data?: { error?: { message?: string } } } };
      toast.error(e.response?.data?.error?.message || '激活版本失败');
    },
  });

  const openView = (v: CommitmentVersion) => {
    setViewVersion(v);
    setViewOpen(true);
  };

  const openActivate = (v: CommitmentVersion) => {
    setActivateItem(v);
    setActivateOpen(true);
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <span className="text-sm text-muted-foreground">当前激活版本：</span>
              {activeVersion ? (
                <Badge
                  style={{
                    backgroundColor: '#ecfdf5',
                    color: SUCCESS,
                    borderColor: '#a7f3d0',
                  }}
                >
                  <Zap className="size-3 mr-1" />
                  {activeVersion.versionCode}
                </Badge>
              ) : (
                <Badge variant="secondary">暂无激活版本</Badge>
              )}
            </div>
            <Button onClick={openCreate} style={{ backgroundColor: PRIMARY }}>
              <Plus className="size-4" />
              新建版本
            </Button>
          </div>

          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 py-2">
                  <Skeleton className="h-5 w-24" />
                  <Skeleton className="h-5 w-16" />
                  <Skeleton className="h-5 w-32" />
                  <Skeleton className="h-5 w-20" />
                  <Skeleton className="h-5 w-28 ml-auto" />
                </div>
              ))}
            </div>
          ) : isError ? (
            <Empty className="py-12">
              <EmptyHeader>
                <EmptyTitle>加载失败</EmptyTitle>
                <EmptyDescription>
                  <Button variant="outline" size="sm" onClick={() => refetch()}>
                    <RefreshCw className="size-4" />
                    重试
                  </Button>
                </EmptyDescription>
              </EmptyHeader>
              <EmptyContent />
            </Empty>
          ) : !versions.length ? (
            <Empty className="py-12">
              <EmptyHeader>
                <EmptyTitle>暂无承诺书版本</EmptyTitle>
                <EmptyDescription>点击上方「新建版本」创建第一个承诺书版本</EmptyDescription>
              </EmptyHeader>
              <EmptyContent />
            </Empty>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>版本号</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead>创建时间</TableHead>
                  <TableHead>签署数量</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {versions.map((v: CommitmentVersion) => (
                  <TableRow key={v.id}>
                    <TableCell className="font-medium">{v.versionCode}</TableCell>
                    <TableCell>
                      {v.isActive ? (
                        <Badge
                          style={{
                            backgroundColor: '#ecfdf5',
                            color: SUCCESS,
                            borderColor: '#a7f3d0',
                          }}
                        >
                          已激活
                        </Badge>
                      ) : (
                        <Badge
                          variant="secondary"
                          style={{
                            backgroundColor: '#f1f5f9',
                            color: MUTED,
                            borderColor: '#e2e8f0',
                          }}
                        >
                          草稿
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDateTime(v.createdAt)}
                    </TableCell>
                    <TableCell>{v.signCount}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="ghost" size="sm" onClick={() => openView(v)}>
                          <FileText className="size-4" />
                          查看正文
                        </Button>
                        {!v.isActive && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openActivate(v)}
                            style={{ color: PRIMARY }}
                          >
                            <Zap className="size-4" />
                            激活
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* 新建版本 Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>新建承诺书版本</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              版本号将自动生成。您可以基于当前激活版本的内容进行修改。
            </p>
            <Textarea
              value={createContent}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setCreateContent(e.target.value)}
              placeholder="请输入承诺书正文内容..."
              className="min-h-[300px]"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              取消
            </Button>
            <Button
              onClick={() => createMutation.mutate(createContent)}
              disabled={createMutation.isPending || !createContent.trim()}
              style={{ backgroundColor: PRIMARY }}
            >
              {createMutation.isPending ? '保存中...' : '保存为新版本'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 查看正文 Dialog */}
      <Dialog open={viewOpen} onOpenChange={setViewOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>
              承诺书正文 · {viewVersion?.versionCode}
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto">
            <div className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700">
              {viewVersion?.content}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setViewOpen(false)}>
              关闭
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 激活确认 Dialog */}
      <Dialog open={activateOpen} onOpenChange={setActivateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>激活版本</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            确定将 <span className="font-medium text-slate-700">{activateItem?.versionCode}</span> 设为当前激活版本吗？
            激活后，新客户将签署此版本的承诺书。
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setActivateOpen(false)}>
              取消
            </Button>
            <Button
              onClick={() => activateItem && activateMutation.mutate(activateItem.id)}
              disabled={activateMutation.isPending}
              style={{ backgroundColor: PRIMARY }}
            >
              {activateMutation.isPending ? '激活中...' : '确认激活'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CommitmentVersionsTab;
