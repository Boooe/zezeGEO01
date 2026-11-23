import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Plus,
  Pencil,
  Trash2,
  RefreshCw,
  AlertCircle,
  Wand2,
  Copy,
  Check,
  FileText,
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
import { Badge } from '@client/src/components/ui/badge';
import { Skeleton } from '@client/src/components/ui/skeleton';
import { SectionCard } from '@client/src/components/layout/SectionCard';
import { Toolbar } from '@client/src/components/layout/Toolbar';
import { Pill } from '@client/src/components/layout/Pill';
import { DataTable } from '@client/src/components/layout/DataTable';
import { EmptyState } from '@client/src/components/layout/EmptyState';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from '@client/src/components/ui/dialog';
import { Textarea } from '@client/src/components/ui/textarea';
import { Switch } from '@client/src/components/ui/switch';
import {
  getTdkTemplates,
  createTdkTemplate,
  updateTdkTemplate,
  deleteTdkTemplate,
  applyTdkTemplate,
  type CreateTdkTemplateRequest,
  type UpdateTdkTemplateRequest,
  type ApplyTdkTemplateResponse,
} from '@client/src/api/website';
import { useBrandSelector } from '@client/src/hooks/useBrandSelector';
import type { TdkTemplate } from '@shared/api.interface';
import { showConfirm } from '@lark-apaas/client-toolkit';

const PRIMARY = '#2E7DFF';
const DANGER = '#EF4444';
const SUCCESS = '#10B981';
const MUTED = '#94A3B8';

const PAGE_TYPES = [
  { value: 'home', label: '首页' },
  { value: 'category', label: '分类页' },
  { value: 'detail', label: '详情页' },
  { value: 'about', label: '关于我们' },
  { value: 'contact', label: '联系我们' },
  { value: 'news', label: '新闻资讯' },
  { value: 'product', label: '产品页' },
  { value: 'other', label: '其他' },
];

const WebsiteTdkPage: React.FC = () => {
  const queryClient = useQueryClient();
  const { brands: brandOptions, selectedBrandId, setSelectedBrandId } =
    useBrandSelector();
  const brandId = selectedBrandId;
  const [pageType, setPageType] = useState<string>('');

  const {
    data: templates = [],
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['website', 'tdk', brandId, pageType],
    queryFn: () =>
      getTdkTemplates({
        brandId: brandId || undefined,
        pageType: pageType || undefined,
      }),
    enabled: !!brandId,
  });

  /* ---------- 新增弹窗 ---------- */
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState<CreateTdkTemplateRequest>({
    brandId: '',
    name: '',
    titleTemplate: '',
    descriptionTemplate: '',
    keywordsTemplate: '',
    pageType: 'home',
    isDefault: false,
  });
  const createMutation = useMutation({
    mutationFn: createTdkTemplate,
    retry: false,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['website', 'tdk'] });
      setCreateOpen(false);
      setCreateForm({
        brandId: '',
        name: '',
        titleTemplate: '',
        descriptionTemplate: '',
        keywordsTemplate: '',
        pageType: 'home',
        isDefault: false,
      });
    },
  });

  /* ---------- 编辑弹窗 ---------- */
  const [editing, setEditing] = useState<TdkTemplate | null>(null);
  const [editForm, setEditForm] = useState<UpdateTdkTemplateRequest>({});
  const openEdit = (tpl: TdkTemplate) => {
    setEditing(tpl);
    setEditForm({
      name: tpl.name,
      titleTemplate: tpl.titleTemplate,
      descriptionTemplate: tpl.descriptionTemplate,
      keywordsTemplate: tpl.keywordsTemplate,
      pageType: tpl.pageType,
      isDefault: tpl.isDefault,
    });
  };
  const updateMutation = useMutation({
    mutationFn: ({
      id,
      body,
    }: {
      id: string;
      body: UpdateTdkTemplateRequest;
    }) => updateTdkTemplate(id, body),
    retry: false,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['website', 'tdk'] });
      setEditing(null);
    },
  });

  /* ---------- 删除 ---------- */
  const deleteMutation = useMutation({
    mutationFn: deleteTdkTemplate,
    retry: false,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['website', 'tdk'] });
    },
  });

  /* ---------- 套用弹窗 ---------- */
  const [applyOpenId, setApplyOpenId] = useState<string | null>(null);
  const [applyForm, setApplyForm] = useState({
    brandName: '',
    keywords: '',
  });
  const [applyResult, setApplyResult] =
    useState<ApplyTdkTemplateResponse | null>(null);
  const [copiedField, setCopiedField] = useState<string>('');
  const applyMutation = useMutation({
    mutationFn: ({
      id,
      brandName,
      keywords,
    }: {
      id: string;
      brandName: string;
      keywords: string[];
    }) => applyTdkTemplate(id, { brandName, keywords }),
    retry: false,
    onSuccess: (data) => {
      setApplyResult(data);
    },
  });

  const openApply = (tpl: TdkTemplate) => {
    setApplyOpenId(tpl.id);
    setApplyForm({ brandName: '', keywords: '' });
    setApplyResult(null);
  };

  const handleApply = () => {
    if (!applyOpenId) return;
    const kwList = applyForm.keywords
      .split(/[,，、\s]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    applyMutation.mutate({
      id: applyOpenId,
      brandName: applyForm.brandName,
      keywords: kwList,
    });
  };

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedField(field);
      setTimeout(() => setCopiedField(''), 2000);
    });
  };

  const getPageTypeLabel = (pt: string | null) => {
    if (!pt) return '-';
    return PAGE_TYPES.find((p) => p.value === pt)?.label ?? pt;
  };

  return (
    <>
      <SectionCard
        title="TDK 模板列表"
        count={templates?.length ?? 0}
        actions={
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="h-8 bg-[#2E7DFF] text-white hover:bg-[#1E5FD6]" disabled={!brandId}>
                <Plus className="h-3.5 w-3.5" />
                新增模板
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-lg">
              <DialogHeader>
                <DialogTitle>新增 TDK 模板</DialogTitle>
              </DialogHeader>
              <div className="space-y-3 py-2">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">模板名称</label>
                  <Input
                    value={createForm.name}
                    onChange={(e) =>
                      setCreateForm({ ...createForm, name: e.target.value })
                    }
                    placeholder="请输入模板名称"
                    className="h-9"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">页面类型</label>
                  <Select
                    value={createForm.pageType || 'home'}
                    onValueChange={(v) =>
                      setCreateForm({ ...createForm, pageType: v })
                    }
                  >
                    <SelectTrigger className="w-full h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PAGE_TYPES.map((p) => (
                        <SelectItem key={p.value} value={p.value}>
                          {p.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">
                    标题模板
                    <span className="ml-2 text-xs text-muted-foreground">
                      支持变量: {'{品牌名}'} {'{核心词}'}
                    </span>
                  </label>
                  <Input
                    value={createForm.titleTemplate}
                    onChange={(e) =>
                      setCreateForm({
                        ...createForm,
                        titleTemplate: e.target.value,
                      })
                    }
                    placeholder="{品牌名} - {核心词}专业服务商"
                    className="h-9 font-mono text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">
                    描述模板
                    <span className="ml-2 text-xs text-muted-foreground">
                      支持变量: {'{品牌名}'} {'{核心词}'}
                    </span>
                  </label>
                  <Textarea
                    value={createForm.descriptionTemplate}
                    onChange={(e) =>
                      setCreateForm({
                        ...createForm,
                        descriptionTemplate: e.target.value,
                      })
                    }
                    placeholder="{品牌名}专注于{核心词}领域多年，为您提供专业的..."
                    className="min-h-[80px] resize-y font-mono text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">
                    关键词模板
                    <span className="ml-2 text-xs text-muted-foreground">
                      支持变量: {'{核心词}'}
                    </span>
                  </label>
                  <Input
                    value={createForm.keywordsTemplate}
                    onChange={(e) =>
                      setCreateForm({
                        ...createForm,
                        keywordsTemplate: e.target.value,
                      })
                    }
                    placeholder="{核心词},{品牌名}官网"
                    className="h-9 font-mono text-sm"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium">设为默认</label>
                  <Switch
                    checked={createForm.isDefault}
                    onCheckedChange={(v) =>
                      setCreateForm({ ...createForm, isDefault: v })
                    }
                  />
                </div>
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setCreateOpen(false)}
                >
                  取消
                </Button>
                <Button
                  className="bg-[#2E7DFF] text-white hover:bg-[#1E5FD6]"
                  disabled={
                    createMutation.isPending ||
                    !createForm.name.trim()
                  }
                  onClick={() =>
                    createMutation.mutate({
                      ...createForm,
                      brandId,
                    })
                  }
                >
                  {createMutation.isPending ? '保存中...' : '保存'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      >
        <Toolbar>
          <Select value={brandId} onValueChange={(v) => setSelectedBrandId(v)}>
            <SelectTrigger className="h-8 w-[140px] text-[13px]">
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
          <Select value={pageType} onValueChange={(v) => setPageType(v)}>
            <SelectTrigger className="h-8 w-[140px] text-[13px]">
              <SelectValue placeholder="全部页面类型" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">全部页面类型</SelectItem>
              {PAGE_TYPES.map((p) => (
                <SelectItem key={p.value} value={p.value}>
                  {p.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button size="sm" variant="outline" onClick={() => refetch()} className="h-8">
            <RefreshCw className="h-3.5 w-3.5" />
            刷新
          </Button>
        </Toolbar>

        <div className="pt-4">
          {/* 错误态 */}
          {isError && (
            <div className="mb-4 flex items-center justify-between rounded-lg border border-red-200 bg-red-50 p-4">
              <div className="flex items-center gap-2 text-sm text-red-600">
                <AlertCircle className="h-4 w-4" />
                <span>数据加载失败，请重试</span>
              </div>
              <button
                onClick={() => refetch()}
                className="flex items-center gap-1 rounded-md px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-100"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                重试
              </button>
            </div>
          )}

          {/* 表格区 */}
          {isLoading ? (
            <TableSkeleton />
          ) : !brandId ? (
            <div className="flex h-[300px] items-center justify-center text-sm text-muted-foreground">
              请先选择品牌
            </div>
          ) : templates && templates.length > 0 ? (
            <DataTable
              rowKey="id"
              columns={[
                {
                  key: 'index',
                  title: '序号',
                  width: '6%',
                  render: (_row: TdkTemplate & { _index: number }) => (
                    <span className="text-[12.5px] text-[#94A3B8]">
                      {_row._index + 1}
                    </span>
                  ),
                },
                {
                  key: 'name',
                  title: '模板名称',
                  width: '12%',
                  render: (row: TdkTemplate & { _index: number }) => (
                    <span
                      className="font-medium text-[12.5px] text-[#0f172a] truncate block"
                      title={row.name}
                    >
                      {row.name}
                    </span>
                  ),
                },
                {
                  key: 'pageType',
                  title: '页面类型',
                  width: '10%',
                  render: (row: TdkTemplate & { _index: number }) => (
                    <span className="text-[12.5px] text-[#334155]">
                      {getPageTypeLabel(row.pageType)}
                    </span>
                  ),
                },
                {
                  key: 'titleTemplate',
                  title: '标题模板',
                  width: '18%',
                  render: (row: TdkTemplate & { _index: number }) => (
                    <span
                      className="text-[12px] font-mono text-[#334155] truncate block"
                      title={row.titleTemplate}
                    >
                      {row.titleTemplate}
                    </span>
                  ),
                },
                {
                  key: 'descriptionTemplate',
                  title: '描述模板',
                  width: '20%',
                  render: (row: TdkTemplate & { _index: number }) => (
                    <span
                      className="text-[12px] text-[#5B6B85] truncate block"
                      title={row.descriptionTemplate}
                    >
                      {row.descriptionTemplate}
                    </span>
                  ),
                },
                {
                  key: 'keywordsTemplate',
                  title: '关键词模板',
                  width: '14%',
                  render: (row: TdkTemplate & { _index: number }) => (
                    <span
                      className="text-[12px] font-mono text-[#334155] truncate block"
                      title={row.keywordsTemplate}
                    >
                      {row.keywordsTemplate}
                    </span>
                  ),
                },
                {
                  key: 'isDefault',
                  title: '默认',
                  width: '6%',
                  render: (row: TdkTemplate & { _index: number }) =>
                    row.isDefault ? (
                      <Badge
                        variant="secondary"
                        className="text-xs"
                        style={{
                          backgroundColor: 'rgba(46, 125, 255, 0.1)',
                          color: PRIMARY,
                        }}
                      >
                        默认
                      </Badge>
                    ) : null,
                },
                {
                  key: 'actions',
                  title: '操作',
                  width: '14%',
                  align: 'right',
                  render: (row: TdkTemplate & { _index: number }) => (
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 px-2 text-xs"
                        onClick={() => openEdit(row)}
                        style={{ color: PRIMARY }}
                      >
                        <Pencil className="h-3 w-3" />
                        编辑
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 px-2 text-xs"
                        style={{ color: SUCCESS }}
                        onClick={() => openApply(row)}
                      >
                        <Wand2 className="h-3 w-3" />
                        套用
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 px-2 text-xs"
                        style={{ color: DANGER }}
                        onClick={async () => {
                          if (await showConfirm('确认删除该模板？')) {
                            deleteMutation.mutate(row.id);
                          }
                        }}
                      >
                        <Trash2 className="h-3 w-3" />
                        删除
                      </Button>
                    </div>
                  ),
                },
              ]}
              data={templates.map((tpl: TdkTemplate, i: number) => ({
                ...tpl,
                _index: i,
              }))}
            />
          ) : (
            <EmptyState
              icon={<Inbox />}
              description="暂无 TDK 模板，点击右上角新建模板"
              action={
                <Button
                  size="sm"
                  className="bg-[#2E7DFF] text-white hover:bg-[#1E5FD6]"
                  onClick={() => setCreateOpen(true)}
                >
                  <Plus className="h-3.5 w-3.5" />
                  新建模板
                </Button>
              }
            />
          )}
        </div>
      </SectionCard>

      {/* 编辑弹窗 */}
      <Dialog open={!!editing} onOpenChange={(v) => !v && setEditing(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>编辑 TDK 模板</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">模板名称</label>
              <Input
                value={editForm.name || ''}
                onChange={(e) =>
                  setEditForm({ ...editForm, name: e.target.value })
                }
                className="h-9"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">页面类型</label>
              <Select
                value={editForm.pageType || ''}
                onValueChange={(v) =>
                  setEditForm({ ...editForm, pageType: v })
                }
              >
                <SelectTrigger className="w-full h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAGE_TYPES.map((p) => (
                    <SelectItem key={p.value} value={p.value}>
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">
                标题模板
                <span className="ml-2 text-xs text-muted-foreground">
                  支持变量: {'{品牌名}'} {'{核心词}'}
                </span>
              </label>
              <Input
                value={editForm.titleTemplate || ''}
                onChange={(e) =>
                  setEditForm({
                    ...editForm,
                    titleTemplate: e.target.value,
                  })
                }
                className="h-9 font-mono text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">
                描述模板
                <span className="ml-2 text-xs text-muted-foreground">
                  支持变量: {'{品牌名}'} {'{核心词}'}
                </span>
              </label>
              <Textarea
                value={editForm.descriptionTemplate || ''}
                onChange={(e) =>
                  setEditForm({
                    ...editForm,
                    descriptionTemplate: e.target.value,
                  })
                }
                className="min-h-[80px] resize-y font-mono text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">
                关键词模板
                <span className="ml-2 text-xs text-muted-foreground">
                  支持变量: {'{核心词}'}
                </span>
              </label>
              <Input
                value={editForm.keywordsTemplate || ''}
                onChange={(e) =>
                  setEditForm({
                    ...editForm,
                    keywordsTemplate: e.target.value,
                  })
                }
                className="h-9 font-mono text-sm"
              />
            </div>
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">设为默认</label>
              <Switch
                checked={!!editForm.isDefault}
                onCheckedChange={(v) =>
                  setEditForm({ ...editForm, isDefault: v })
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>
              取消
            </Button>
            <Button
              style={{ backgroundColor: PRIMARY }}
              disabled={
                updateMutation.isPending ||
                !editForm.name?.trim() ||
                !editing
              }
              onClick={() =>
                editing &&
                updateMutation.mutate({ id: editing.id, body: editForm })
              }
            >
              {updateMutation.isPending ? '保存中...' : '保存'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 套用弹窗 */}
      <Dialog
        open={!!applyOpenId}
        onOpenChange={(v) => !v && setApplyOpenId(null)}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>套用模板</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">品牌名</label>
              <Input
                value={applyForm.brandName}
                onChange={(e) =>
                  setApplyForm({ ...applyForm, brandName: e.target.value })
                }
                placeholder="请输入品牌名"
                className="h-9"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">
                核心关键词（逗号或空格分隔）
              </label>
              <Input
                value={applyForm.keywords}
                onChange={(e) =>
                  setApplyForm({ ...applyForm, keywords: e.target.value })
                }
                placeholder="关键词1, 关键词2, 关键词3"
                className="h-9"
              />
            </div>
            <Button
              style={{ backgroundColor: PRIMARY }}
              onClick={handleApply}
              disabled={
                applyMutation.isPending ||
                !applyForm.brandName.trim() ||
                !applyForm.keywords.trim()
              }
              className="w-full"
            >
              {applyMutation.isPending ? '生成中...' : '生成 TDK'}
            </Button>

            {applyResult && (
              <div className="space-y-3 pt-2 border-t">
                <h4 className="text-sm font-semibold">生成结果</h4>
                <div className="space-y-2">
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-medium text-muted-foreground">
                        Title
                      </label>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 px-2 text-xs"
                        onClick={() => copyToClipboard(applyResult.title, 'title')}
                        style={{ color: PRIMARY }}
                      >
                        {copiedField === 'title' ? (
                          <>
                            <Check className="h-3 w-3 mr-1" />
                            已复制
                          </>
                        ) : (
                          <>
                            <Copy className="h-3 w-3 mr-1" />
                            复制
                          </>
                        )}
                      </Button>
                    </div>
                    <div className="rounded-md border p-3 text-sm bg-slate-50 break-words">
                      {applyResult.title}
                    </div>
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-medium text-muted-foreground">
                        Description
                      </label>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 px-2 text-xs"
                        onClick={() =>
                          copyToClipboard(applyResult.description, 'desc')
                        }
                        style={{ color: PRIMARY }}
                      >
                        {copiedField === 'desc' ? (
                          <>
                            <Check className="h-3 w-3 mr-1" />
                            已复制
                          </>
                        ) : (
                          <>
                            <Copy className="h-3 w-3 mr-1" />
                            复制
                          </>
                        )}
                      </Button>
                    </div>
                    <div className="rounded-md border p-3 text-sm bg-slate-50 break-words">
                      {applyResult.description}
                    </div>
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-medium text-muted-foreground">
                        Keywords
                      </label>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 px-2 text-xs"
                        onClick={() =>
                          copyToClipboard(applyResult.keywords, 'kw')
                        }
                        style={{ color: PRIMARY }}
                      >
                        {copiedField === 'kw' ? (
                          <>
                            <Check className="h-3 w-3 mr-1" />
                            已复制
                          </>
                        ) : (
                          <>
                            <Copy className="h-3 w-3 mr-1" />
                            复制
                          </>
                        )}
                      </Button>
                    </div>
                    <div className="rounded-md border p-3 text-sm bg-slate-50 break-words font-mono">
                      {applyResult.keywords}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setApplyOpenId(null)}
            >
              关闭
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

const TableSkeleton = () => (
  <div className="space-y-2 rounded-md border p-4">
    {Array.from({ length: 6 }).map((_, i) => (
      <div key={i} className="flex items-center gap-4">
        <Skeleton className="h-4 w-10" />
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-4 flex-1" />
        <Skeleton className="h-4 flex-1" />
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-4 w-12" />
        <Skeleton className="h-4 w-24" />
      </div>
    ))}
  </div>
);

export default WebsiteTdkPage;
