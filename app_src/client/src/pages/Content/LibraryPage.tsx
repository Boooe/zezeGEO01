import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Folder,
  FolderPlus,
  Upload,
  Search,
  Trash2,
  Edit3,
  Image as ImageIcon,
  Video,
  FileText,
  MoreVertical,
  Check,
  X,
  Trash,
  Plus,
  LayoutGrid,
  Database,
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
import { Label } from '@client/src/components/ui/label';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@client/src/components/ui/select';
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
import { Checkbox } from '@client/src/components/ui/checkbox';
import { Skeleton } from '@client/src/components/ui/skeleton';
import {
  Empty,
  EmptyMedia,
  EmptyHeader,
  EmptyTitle,
  EmptyContent,
  EmptyDescription,
} from '@client/src/components/ui/empty';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@client/src/components/ui/dropdown-menu';
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@client/src/components/ui/pagination';
import { Badge } from '@client/src/components/ui/badge';
import { Image } from '@client/src/components/ui/image';
import { PageHeader } from '@client/src/components/layout/PageHeader';

import { content } from '@client/src/api';
import { getBrandList } from '@client/src/api/keywords';
import { useAuth } from '@client/src/contexts/AuthContext';
import {
  MATERIAL_TYPES,
  MATERIAL_TYPE_LABELS,
} from '@shared/api.interface';
import type { Material, MaterialType, MaterialGroup, PagedResponse } from '@shared/api.interface';

const PRIMARY = '#1e40af';
const ACCENT = '#f97316';
const BG = '#f8fafc';
const PAGE_SIZE = 12;

const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024)
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
};

const formatDate = (dateStr: string): string => {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const LibraryPage: React.FC = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const isClient = user?.role === 'client';

  /* ---------------- State ---------------- */
  const [activeTab, setActiveTab] = useState<MaterialType>('image');
  const [brandId, setBrandId] = useState<string>(user?.brandId ?? '');
  const [keyword, setKeyword] = useState('');
  const [searchText, setSearchText] = useState('');
  const [page, setPage] = useState(1);
  const [groupId, setGroupId] = useState<string | null>(null);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isMultiSelect, setIsMultiSelect] = useState(false);

  /* ---------------- Dialogs ---------------- */
  const [newGroupOpen, setNewGroupOpen] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupType, setNewGroupType] = useState<MaterialType>('image');

  const [deleteTarget, setDeleteTarget] = useState<Material | null>(null);
  const [batchDeleteOpen, setBatchDeleteOpen] = useState(false);

  const [renameTarget, setRenameTarget] = useState<Material | null>(null);
  const [renameValue, setRenameValue] = useState('');

  /* ---------------- Queries ---------------- */
  const { data: brandList = [] } = useQuery({
    queryKey: ['brands', 'options'],
    queryFn: getBrandList,
    staleTime: 5 * 60 * 1000,
    enabled: !isClient,
  });

  const { data: groups = [], isLoading: groupsLoading } = useQuery({
    queryKey: ['materialGroups', { brandId, type: activeTab }],
    queryFn: () =>
      content.getMaterialGroups({
        brandId: brandId || user?.brandId || undefined,
        groupType: activeTab,
      }),
    staleTime: 2 * 60 * 1000,
  });

  const { data: materialsData, isLoading: materialsLoading } = useQuery<
    PagedResponse<Material>,
    any
  >({
    queryKey: [
      'materials',
      { page, brandId, groupId, type: activeTab, keyword: searchText },
    ],
    queryFn: () =>
      content.getMaterials({
        page,
        pageSize: PAGE_SIZE,
        brandId: brandId || user?.brandId || undefined,
        groupId: groupId || undefined,
        materialType: activeTab,
        keyword: searchText || undefined,
      }),
  });

  const totalPages = useMemo(() => {
    if (!materialsData) return 0;
    return Math.max(1, Math.ceil(materialsData.total / PAGE_SIZE));
  }, [materialsData]);

  const items = materialsData?.items ?? [];
  const total = materialsData?.total ?? 0;

  /* ---------------- Mutations ---------------- */
  const createGroupMutation = useMutation<MaterialGroup, any, void>({
    mutationFn: () =>
      content.createMaterialGroup({
        brandId: brandId || user?.brandId || '',
        name: newGroupName,
        groupType: newGroupType,
      }),
    retry: false,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['materialGroups'] });
      setNewGroupOpen(false);
      setNewGroupName('');
      toast.success('分组创建成功');
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.error?.message ?? '创建失败');
    },
  });

  const deleteMutation = useMutation<void, any, string>({
    mutationFn: (id: string) => content.deleteMaterial(id),
    retry: false,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['materials'] });
      setDeleteTarget(null);
      toast.success('删除成功');
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.error?.message ?? '删除失败');
    },
  });

  const renameMutation = useMutation<
    Material,
    any,
    { id: string; name: string }
  >({
    mutationFn: (args: { id: string; name: string }) =>
      content.renameMaterial(args.id, args.name),
    retry: false,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['materials'] });
      setRenameTarget(null);
      toast.success('重命名成功');
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.error?.message ?? '重命名失败');
    },
  });

  const batchDeleteMutation = useMutation<void, any, string[]>({
    mutationFn: (ids: string[]) => content.batchDeleteMaterials(ids),
    retry: false,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['materials'] });
      setBatchDeleteOpen(false);
      setSelectedIds(new Set());
      setIsMultiSelect(false);
      toast.success('批量删除成功');
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.error?.message ?? '批量删除失败');
    },
  });

  /* ---------------- Handlers ---------------- */
  const handleSearch = () => {
    setSearchText(keyword.trim());
    setPage(1);
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(new Set(items.map((m) => m.id)));
    } else {
      setSelectedIds(new Set());
    }
  };

  const handleSelectItem = (id: string, checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const handleBatchDelete = () => {
    batchDeleteMutation.mutate(Array.from(selectedIds));
  };

  const handleUploadClick = () => {
    toast.info('上传功能将在后续开放');
  };

  const handleTabChange = (v: string) => {
    setActiveTab(v as MaterialType);
    setGroupId(null);
    setPage(1);
    setSelectedIds(new Set());
  };

  const typeIcon = (type: MaterialType) => {
    switch (type) {
      case 'image':
        return <ImageIcon className="h-4 w-4" />;
      case 'video':
        return <Video className="h-4 w-4" />;
      case 'document':
        return <FileText className="h-4 w-4" />;
    }
  };

  const allSelected = items.length > 0 && selectedIds.size === items.length;
  const someSelected = selectedIds.size > 0 && selectedIds.size < items.length;

  return (
    <div className="space-y-6" style={{ backgroundColor: BG }}>
      <PageHeader
        title="素材库"
        description="管理品牌图片、视频、文档素材，支持分组管理与批量操作"
      />

      {/* 顶部操作栏 */}
      <Card>
        <CardContent className="pt-6">
          <Tabs
            value={activeTab}
            onValueChange={handleTabChange}
            className="w-full"
          >
            <div className="flex flex-wrap items-center justify-between gap-4">
              <TabsList
                className="h-10 gap-1 rounded-lg bg-slate-100 p-1"
                style={{ backgroundColor: '#f1f5f9' }}
              >
                {MATERIAL_TYPES.map((t) => (
                  <TabsTrigger
                    key={t}
                    value={t}
                    className="h-8 rounded-md px-5 text-sm data-[state=active]:text-white"
                    style={
                      activeTab === t
                        ? { backgroundColor: PRIMARY, color: '#ffffff' }
                        : { color: '#64748b' }
                    }
                  >
                    <span className="flex items-center gap-1.5">
                      {typeIcon(t)}
                      {MATERIAL_TYPE_LABELS[t]}
                    </span>
                  </TabsTrigger>
                ))}
              </TabsList>

              <div className="flex flex-wrap items-center gap-2">
                {/* 品牌 */}
                {!isClient && (
                  <Select value={brandId} onValueChange={setBrandId}>
                    <SelectTrigger className="w-36">
                      <SelectValue placeholder="全部品牌" />
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

                {/* 搜索 */}
                <div className="relative w-56">
                  <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={keyword}
                    onChange={(e) => setKeyword(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                    placeholder="搜索素材名称…"
                    className="pl-8"
                  />
                </div>

                {/* 多选模式 */}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setIsMultiSelect(!isMultiSelect);
                    setSelectedIds(new Set());
                  }}
                >
                  {isMultiSelect ? (
                    <>
                      <X className="mr-1 h-3 w-3" />
                      取消选择
                    </>
                  ) : (
                    <>
                      <Check className="mr-1 h-3 w-3" />
                      批量选择
                    </>
                  )}
                </Button>

                {/* 新建分组 */}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setNewGroupType(activeTab);
                    setNewGroupOpen(true);
                  }}
                >
                  <FolderPlus className="mr-1 h-3 w-3" />
                  新建分组
                </Button>

                {/* 上传 */}
                <Button
                  size="sm"
                  style={{ backgroundColor: PRIMARY }}
                  onClick={handleUploadClick}
                >
                  <Upload className="mr-1 h-3 w-3" />
                  上传
                </Button>
              </div>
            </div>

            {/* 容量信息 */}
            <div className="mt-4 flex items-center justify-between rounded-md bg-slate-50 px-3 py-2 text-xs text-muted-foreground">
              <div className="flex items-center gap-2">
                <Database className="h-3.5 w-3.5" />
                总容量使用：<span className="font-medium text-slate-700">128.5 MB / 10 GB</span>
              </div>
              <div>
                共 <span className="font-medium text-slate-700">{total}</span> 个素材
              </div>
            </div>

            {/* 批量操作栏 */}
            {isMultiSelect && selectedIds.size > 0 && (
              <div
                className="mt-3 flex items-center justify-between rounded-md px-4 py-2"
                style={{
                  backgroundColor: `${PRIMARY}0d`,
                  border: `1px solid ${PRIMARY}33`,
                }}
              >
                <div className="flex items-center gap-3 text-sm">
                  <Checkbox
                    checked={allSelected}
                    onCheckedChange={handleSelectAll}
                    aria-label="全选"
                  />
                  <span>
                    已选择 <span className="font-semibold" style={{ color: PRIMARY }}>
                      {selectedIds.size}
                    </span> 项
                  </span>
                </div>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => setBatchDeleteOpen(true)}
                >
                  <Trash className="mr-1 h-3 w-3" />
                  批量删除
                </Button>
              </div>
            )}

            <TabsContent value={activeTab} className="mt-4">
              <div className="grid grid-cols-1 gap-6 md:grid-cols-[200px_1fr]">
                {/* 左侧分组列表 */}
                <div className="space-y-1">
                  <div className="pb-2 text-xs font-medium text-muted-foreground">
                    分组
                  </div>
                  <Button
                    variant={groupId === null ? 'default' : 'ghost'}
                    className="w-full justify-start"
                    style={
                      groupId === null
                        ? { backgroundColor: PRIMARY }
                        : undefined
                    }
                    onClick={() => {
                      setGroupId(null);
                      setPage(1);
                    }}
                  >
                    <LayoutGrid className="mr-2 h-4 w-4" />
                    全部素材
                  </Button>

                  {groupsLoading ? (
                    <div className="space-y-2 pt-2">
                      {Array.from({ length: 4 }).map((_, i) => (
                        <Skeleton key={i} className="h-8 w-full rounded" />
                      ))}
                    </div>
                  ) : (
                    <div className="space-y-1 pt-1">
                      {groups.map((g: MaterialGroup) => (
                        <Button
                          key={g.id}
                          variant={groupId === g.id ? 'default' : 'ghost'}
                          className="w-full justify-start"
                          style={
                            groupId === g.id
                              ? { backgroundColor: PRIMARY }
                              : undefined
                          }
                          onClick={() => {
                            setGroupId(g.id);
                            setPage(1);
                          }}
                        >
                          <Folder className="mr-2 h-4 w-4" />
                          <span className="truncate">{g.name}</span>
                        </Button>
                      ))}
                    </div>
                  )}

                  <Button
                    variant="ghost"
                    className="mt-2 w-full justify-start text-muted-foreground hover:text-foreground"
                    onClick={() => {
                      setNewGroupType(activeTab);
                      setNewGroupOpen(true);
                    }}
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    新建分组
                  </Button>
                </div>

                {/* 右侧素材网格 */}
                <div>
                  {materialsLoading ? (
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
                      {Array.from({ length: 8 }).map((_, i) => (
                        <div key={i} className="space-y-2">
                          <Skeleton className="aspect-square w-full rounded-md" />
                          <Skeleton className="h-3 w-3/4 rounded" />
                          <Skeleton className="h-2 w-1/2 rounded" />
                        </div>
                      ))}
                    </div>
                  ) : items.length === 0 ? (
                    <Empty>
                      <EmptyMedia variant="icon">
                        <Folder className="h-6 w-6" />
                      </EmptyMedia>
                      <EmptyHeader>
                        <EmptyTitle>暂无素材</EmptyTitle>
                      </EmptyHeader>
                      <EmptyContent>
                        <EmptyDescription>
                          当前分组下暂无素材，点击「上传」添加新素材
                        </EmptyDescription>
                      </EmptyContent>
                    </Empty>
                  ) : (
                    <>
                      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
                        {items.map((item: Material) => (
                          <div
                            key={item.id}
                            className={`group relative overflow-hidden rounded-lg border bg-white transition-shadow hover:shadow-md ${
                              selectedIds.has(item.id)
                                ? 'ring-2 ring-primary'
                                : ''
                            }`}
                          >
                            {/* 多选复选框 */}
                            {isMultiSelect && (
                              <div className="absolute left-2 top-2 z-10">
                                <Checkbox
                                  checked={selectedIds.has(item.id)}
                                  onCheckedChange={(c) =>
                                    handleSelectItem(item.id, !!c)
                                  }
                                  aria-label={`选择 ${item.name}`}
                                />
                              </div>
                            )}

                            {/* 缩略图 */}
                            <div className="flex aspect-square items-center justify-center bg-slate-100">
                              {item.materialType === 'image' && item.fileUrl ? (
                                <Image
                                  src={item.fileUrl}
                                  alt={item.name}
                                  className="h-full w-full object-cover"
                                />
                              ) : (
                                <div className="flex flex-col items-center gap-1 text-muted-foreground">
                                  {typeIcon(item.materialType)}
                                  <span className="text-xs">
                                    {MATERIAL_TYPE_LABELS[item.materialType]}
                                  </span>
                                </div>
                              )}
                            </div>

                            {/* 信息区 */}
                            <div className="space-y-1 p-2">
                              <div className="flex items-start justify-between gap-1">
                                <div className="truncate text-sm font-medium">
                                  {item.name}
                                </div>
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button
                                      size="icon"
                                      variant="ghost"
                                      className="h-6 w-6"
                                      aria-label="更多操作"
                                    >
                                      <MoreVertical className="h-3.5 w-3.5" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    <DropdownMenuItem
                                      onClick={() => {
                                        setRenameTarget(item);
                                        setRenameValue(item.name);
                                      }}
                                    >
                                      <Edit3 className="mr-2 h-4 w-4" />
                                      重命名
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem
                                      className="text-red-500"
                                      onClick={() => setDeleteTarget(item)}
                                    >
                                      <Trash2 className="mr-2 h-4 w-4" />
                                      删除
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </div>
                              <div className="flex items-center justify-between text-xs text-muted-foreground">
                                <span>{formatFileSize(item.fileSize)}</span>
                                <span>{formatDate(item.createdAt)}</span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* 分页 */}
                      {totalPages > 1 && (
                        <div className="mt-6 flex justify-center">
                          <Pagination>
                            <PaginationContent>
                              <PaginationItem>
                                <PaginationPrevious
                                  href="#"
                                  onClick={(e) => {
                                    e.preventDefault();
                                    if (page > 1) setPage(page - 1);
                                  }}
                                  className={
                                    page <= 1
                                      ? 'pointer-events-none opacity-50'
                                      : ''
                                  }
                                />
                              </PaginationItem>
                              {Array.from(
                                { length: Math.min(5, totalPages) },
                                (_, i) => {
                                  let p: number;
                                  if (totalPages <= 5) {
                                    p = i + 1;
                                  } else if (page <= 3) {
                                    p = i + 1;
                                  } else if (page >= totalPages - 2) {
                                    p = totalPages - 4 + i;
                                  } else {
                                    p = page - 2 + i;
                                  }
                                  return (
                                    <PaginationItem key={p}>
                                      <PaginationLink
                                        href="#"
                                        onClick={(e) => {
                                          e.preventDefault();
                                          setPage(p);
                                        }}
                                        isActive={page === p}
                                      >
                                        {p}
                                      </PaginationLink>
                                    </PaginationItem>
                                  );
                                },
                              )}
                              <PaginationItem>
                                <PaginationNext
                                  href="#"
                                  onClick={(e) => {
                                    e.preventDefault();
                                    if (page < totalPages) setPage(page + 1);
                                  }}
                                  className={
                                    page >= totalPages
                                      ? 'pointer-events-none opacity-50'
                                      : ''
                                  }
                                />
                              </PaginationItem>
                            </PaginationContent>
                          </Pagination>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* 新建分组弹窗 */}
      <Dialog open={newGroupOpen} onOpenChange={(o) => !o && setNewGroupOpen(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>新建分组</DialogTitle>
            <DialogDescription>创建新的素材分组</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="groupName">分组名称</Label>
              <Input
                id="groupName"
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
                placeholder="请输入分组名称"
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label>分组类型</Label>
              <RadioGroupInline
                value={newGroupType}
                onChange={(v) => setNewGroupType(v as MaterialType)}
                options={MATERIAL_TYPES.map((t) => ({
                  value: t,
                  label: MATERIAL_TYPE_LABELS[t],
                }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewGroupOpen(false)}>
              取消
            </Button>
            <Button
              style={{ backgroundColor: PRIMARY }}
              onClick={() => {
                if (!newGroupName.trim()) {
                  toast.error('请输入分组名称');
                  return;
                }
                createGroupMutation.mutate();
              }}
              disabled={createGroupMutation.isPending}
            >
              {createGroupMutation.isPending ? '创建中…' : '确认创建'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 删除确认弹窗 */}
      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除</AlertDialogTitle>
            <AlertDialogDescription>
              确定要删除素材「{deleteTarget?.name}」吗？删除后无法恢复。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-500 hover:bg-red-600"
              onClick={() =>
                deleteTarget && deleteMutation.mutate(deleteTarget.id)
              }
            >
              {deleteMutation.isPending ? '删除中…' : '确认删除'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 批量删除确认 */}
      <AlertDialog
        open={batchDeleteOpen}
        onOpenChange={(o) => !o && setBatchDeleteOpen(false)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>批量删除</AlertDialogTitle>
            <AlertDialogDescription>
              确定要删除选中的 {selectedIds.size} 个素材吗？删除后无法恢复。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-500 hover:bg-red-600"
              onClick={handleBatchDelete}
            >
              {batchDeleteMutation.isPending ? '删除中…' : '确认删除'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 重命名弹窗 */}
      <Dialog
        open={!!renameTarget}
        onOpenChange={(o) => !o && setRenameTarget(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>重命名素材</DialogTitle>
            <DialogDescription>修改素材名称</DialogDescription>
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
            <Button
              style={{ backgroundColor: PRIMARY }}
              onClick={() => {
                if (!renameValue.trim()) {
                  toast.error('名称不能为空');
                  return;
                }
                if (renameTarget) {
                  renameMutation.mutate({
                    id: renameTarget.id,
                    name: renameValue.trim(),
                  });
                }
              }}
              disabled={renameMutation.isPending}
            >
              {renameMutation.isPending ? '保存中…' : '确认'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

/* ---------------- 内联 RadioGroup 组件 ---------------- */
interface RadioGroupInlineProps {
  value: string;
  onChange: (v: string) => void;
  options: Array<{ value: string; label: string }>;
}

const RadioGroupInline: React.FC<RadioGroupInlineProps> = ({
  value,
  onChange,
  options,
}) => {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={`rounded-md border px-3 py-1.5 text-sm transition-colors ${
            value === opt.value
              ? 'border-primary bg-primary/5 font-medium text-primary'
              : 'border-slate-200 text-slate-600 hover:bg-slate-50'
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
};

export default LibraryPage;
