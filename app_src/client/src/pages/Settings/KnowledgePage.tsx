import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Plus,
  Search,
  Pencil,
  Trash2,
  RefreshCw,
  AlertCircle,
  Inbox,
} from 'lucide-react';
import { Button } from '@client/src/components/ui/button';
import { Input } from '@client/src/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@client/src/components/ui/select';
import { Skeleton } from '@client/src/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@client/src/components/ui/dialog';
import { Textarea } from '@client/src/components/ui/textarea';
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
import { Label } from '@client/src/components/ui/label';
import { Switch } from '@client/src/components/ui/switch';
import { DataPagination } from '@client/src/components/ui/data-pagination';
import { SectionCard } from '@client/src/components/layout/SectionCard';
import { Toolbar } from '@client/src/components/layout/Toolbar';
import { Pill } from '@client/src/components/layout/Pill';
import { DataTable } from '@client/src/components/layout/DataTable';
import { EmptyState } from '@client/src/components/layout/EmptyState';
import { toast } from 'sonner';
import {
  getKnowledgeList,
  createKnowledge,
  updateKnowledge,
  deleteKnowledge,
} from '@client/src/api/knowledge';
import {
  KNOWLEDGE_CATEGORIES,
  KNOWLEDGE_CATEGORY_LABELS,
  type KnowledgeCategory,
  type KnowledgeItem,
} from '@shared/api.interface';
import { useAuth } from '@client/src/hooks/useAuth';
import { useBrandSelector } from '@client/src/hooks/useBrandSelector';

const PRIMARY = '#2E7DFF';
const DANGER = '#EF4444';

const KnowledgePage: React.FC = () => {
  const { user } = useAuth();
  const isClient = user?.role === 'client';
  const queryClient = useQueryClient();

  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);
  const [category, setCategory] = useState<KnowledgeCategory | ''>('');
  const [keyword, setKeyword] = useState('');
  const [searchInput, setSearchInput] = useState('');

  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<KnowledgeItem | null>(null);
  const [formData, setFormData] = useState({
    category: 'general' as KnowledgeCategory,
    title: '',
    content: '',
    tags: '',
    isActive: true,
  });

  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const { brands: brandOptions, selectedBrandId, setSelectedBrandId } =
    useBrandSelector();

  const brandId = isClient ? user?.brandId || '' : selectedBrandId;

  const {
    data: listData,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['knowledge', 'list', page, pageSize, category, keyword, selectedBrandId],
    queryFn: () =>
      getKnowledgeList({
        page,
        pageSize,
        category: category || undefined,
        keyword: keyword || undefined,
        brandId: selectedBrandId || undefined,
      }),
    enabled: !!selectedBrandId || user?.role === 'client',
  });

  const createMutation = useMutation({
    mutationFn: createKnowledge,
    retry: false,
    onSuccess: () => {
      toast.success('创建成功');
      setEditDialogOpen(false);
      resetForm();
      queryClient.invalidateQueries({ queryKey: ['knowledge', 'list'] });
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.error?.message || '创建失败');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) =>
      updateKnowledge(id, data),
    retry: false,
    onSuccess: () => {
      toast.success('更新成功');
      setEditDialogOpen(false);
      resetForm();
      queryClient.invalidateQueries({ queryKey: ['knowledge', 'list'] });
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.error?.message || '更新失败');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteKnowledge,
    retry: false,
    onSuccess: () => {
      toast.success('删除成功');
      setDeleteConfirm(null);
      queryClient.invalidateQueries({ queryKey: ['knowledge', 'list'] });
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.error?.message || '删除失败');
    },
  });

  const resetForm = () => {
    setFormData({
      category: 'general' as KnowledgeCategory,
      title: '',
      content: '',
      tags: '',
      isActive: true,
    });
    setEditingItem(null);
  };

  const handleCreate = () => {
    resetForm();
    setEditDialogOpen(true);
  };

  const handleEdit = (item: KnowledgeItem) => {
    setEditingItem(item);
    setFormData({
      category: item.category,
      title: item.title,
      content: item.content,
      tags: item.tags.join('，'),
      isActive: item.isActive,
    });
    setEditDialogOpen(true);
  };

  const handleSubmit = () => {
    if (!formData.title.trim()) {
      toast.error('请输入标题');
      return;
    }
    if (!formData.content.trim()) {
      toast.error('请输入内容');
      return;
    }

    const body = {
      category: formData.category,
      title: formData.title.trim(),
      content: formData.content.trim(),
      tags: formData.tags
        ? formData.tags
            .split(/[,，]/)
            .map((t) => t.trim())
            .filter(Boolean)
        : [],
      isActive: formData.isActive,
      brandId: selectedBrandId,
    };

    if (editingItem) {
      updateMutation.mutate({ id: editingItem.id, data: body });
    } else {
      createMutation.mutate(body as any);
    }
  };

  const handleSearch = () => {
    setKeyword(searchInput.trim());
    setPage(1);
  };

  const handleCategoryChange = (val: string) => {
    setCategory(val as KnowledgeCategory | '');
    setPage(1);
  };

  const totalPages = listData?.total
    ? Math.ceil(listData.total / pageSize)
    : 0;
  const items = listData?.items ?? [];

  return (
    <>
      <SectionCard
        title="知识条目"
        count={listData?.total ?? 0}
        actions={
          <Button size="sm" className="h-8 bg-[#2E7DFF] text-white hover:bg-[#1E5FD6]" onClick={handleCreate}>
            <Plus className="h-3.5 w-3.5" />
            新增知识条目
          </Button>
        }
      >
        <Toolbar>
          {!isClient && (
            <Select value={selectedBrandId} onValueChange={setSelectedBrandId}>
              <SelectTrigger className="h-8 w-[140px] text-[13px]">
                <SelectValue placeholder="选择品牌" />
              </SelectTrigger>
              <SelectContent>
                {brandOptions.map((b: any) => (
                  <SelectItem key={b.id} value={b.id}>
                    {b.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Select value={category} onValueChange={handleCategoryChange}>
            <SelectTrigger className="h-8 w-[140px] text-[13px]">
              <SelectValue placeholder="全部分类" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">全部分类</SelectItem>
              {KNOWLEDGE_CATEGORIES.map((cat) => (
                <SelectItem key={cat} value={cat}>
                  {KNOWLEDGE_CATEGORY_LABELS[cat]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="relative w-[240px]">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94A3B8]" />
            <Input
              placeholder="搜索标题/内容"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              className="h-8 w-full pl-9 text-[13px]"
            />
          </div>
          <Button size="sm" variant="outline" onClick={() => refetch()} className="h-8">
            <RefreshCw className="h-3.5 w-3.5" />
            刷新
          </Button>
        </Toolbar>

        <div className="pt-4">
          {isError ? (
            <div className="mb-4 flex items-center justify-between rounded-lg border border-red-200 bg-red-50 p-4">
              <div className="flex items-center gap-2 text-sm text-red-600">
                <AlertCircle className="h-4 w-4" />
                <span>数据加载失败，请重试</span>
              </div>
              <button
                onClick={() => refetch()}
                className="rounded-md px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-100"
              >
                重试
              </button>
            </div>
          ) : isLoading ? (
            <ListSkeleton rows={5} />
          ) : items.length === 0 ? (
            <EmptyState
              icon={<Inbox />}
              description="暂无知识条目，点击右上角添加新知识"
              action={
                <Button
                  size="sm"
                  className="bg-[#2E7DFF] text-white hover:bg-[#1E5FD6]"
                  onClick={() => handleCreate()}
                >
                  <Plus className="h-3.5 w-3.5" />
                  新增条目
                </Button>
              }
            />
          ) : (
            <>
              <DataTable
                rowKey="id"
                columns={[
                  {
                    key: 'category',
                    title: '分类',
                    width: '15%',
                    render: (row: KnowledgeItem) => (
                      <Pill variant="info">
                        {KNOWLEDGE_CATEGORY_LABELS[row.category]}
                      </Pill>
                    ),
                  },
                  {
                    key: 'title',
                    title: '标题',
                    width: '40%',
                    render: (row: KnowledgeItem) => (
                      <div>
                        <div
                          className="font-medium text-[12.5px] text-[#0F172A] truncate"
                          title={row.title}
                        >
                          {row.title}
                        </div>
                        <div
                          className="mt-0.5 text-[12px] text-[#5B6B85] truncate"
                          title={row.content}
                        >
                          {row.content}
                        </div>
                      </div>
                    ),
                  },
                  {
                    key: 'status',
                    title: '状态',
                    width: '12%',
                    render: (row: KnowledgeItem) => (
                      <Pill variant={row.isActive ? 'success' : 'muted'}>
                        {row.isActive ? '启用' : '停用'}
                      </Pill>
                    ),
                  },
                  {
                    key: 'updatedAt',
                    title: '更新时间',
                    width: '18%',
                    render: (row: KnowledgeItem) => (
                      <span className="text-[12px] text-[#5B6B85]">
                        {row.updatedAt
                          ? new Date(row.updatedAt).toLocaleString('zh-CN', {
                              year: 'numeric',
                              month: '2-digit',
                              day: '2-digit',
                              hour: '2-digit',
                              minute: '2-digit',
                            })
                          : '-'}
                      </span>
                    ),
                  },
                  {
                    key: 'actions',
                    title: '操作',
                    width: '15%',
                    align: 'right',
                    render: (row: KnowledgeItem) => (
                      <>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEdit(row)}
                          className="text-primary hover:text-primary"
                        >
                          <Pencil className="mr-1 size-3.5" />
                          编辑
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setDeleteConfirm(row.id)}
                          className="text-red-500 hover:text-red-600"
                        >
                          <Trash2 className="mr-1 size-3.5" />
                          删除
                        </Button>
                      </>
                    ),
                  },
                ]}
                data={items}
              />

              {listData && listData.total > 0 && (
                <div className="pt-4">
                  <DataPagination
                    total={listData.total}
                    page={page}
                    pageSize={pageSize}
                    onPageChange={setPage}
                    onPageSizeChange={() => setPage(1)}
                  />
                </div>
              )}
            </>
          )}
        </div>
      </SectionCard>

      {/* 编辑弹窗 */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingItem ? '编辑知识条目' : '新增知识条目'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>分类</Label>
              <Select
                value={formData.category}
                onValueChange={(v) =>
                  setFormData({ ...formData, category: v as KnowledgeCategory })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="选择分类" />
                </SelectTrigger>
                <SelectContent>
                  {KNOWLEDGE_CATEGORIES.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {KNOWLEDGE_CATEGORY_LABELS[cat]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>标题</Label>
              <Input
                placeholder="请输入标题"
                value={formData.title}
                onChange={(e) =>
                  setFormData({ ...formData, title: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label>内容</Label>
              <Textarea
                placeholder="请输入知识内容"
                rows={8}
                value={formData.content}
                onChange={(e) =>
                  setFormData({ ...formData, content: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label>标签（用逗号分隔）</Label>
              <Input
                placeholder="例如：品牌,产品,优势"
                value={formData.tags}
                onChange={(e) =>
                  setFormData({ ...formData, tags: e.target.value })
                }
              />
            </div>
            <div className="flex items-center justify-between">
              <Label className="cursor-pointer" htmlFor="is-active">
                启用状态
              </Label>
              <Switch
                id="is-active"
                checked={formData.isActive}
                onCheckedChange={(checked) =>
                  setFormData({ ...formData, isActive: checked })
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              取消
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={createMutation.isPending || updateMutation.isPending}
              style={{ backgroundColor: PRIMARY }}
            >
              {createMutation.isPending || updateMutation.isPending
                ? '保存中...'
                : '保存'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 删除确认 */}
      <AlertDialog
        open={!!deleteConfirm}
        onOpenChange={(open) => !open && setDeleteConfirm(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除</AlertDialogTitle>
            <AlertDialogDescription>
              删除后无法恢复，确定要删除这条知识条目吗？
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={() =>
                deleteConfirm && deleteMutation.mutate(deleteConfirm)
              }
              className="bg-red-500 hover:bg-red-600"
            >
              {deleteMutation.isPending ? '删除中...' : '确认删除'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

function ListSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 py-2">
          <Skeleton className="h-5 w-20" />
          <Skeleton className="h-5 flex-1" />
          <Skeleton className="h-5 w-16" />
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-5 w-20" />
        </div>
      ))}
    </div>
  );
}

export default KnowledgePage;
