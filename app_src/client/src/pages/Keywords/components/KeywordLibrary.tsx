import React, { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Plus,
  Upload,
  Search,
  Pencil,
  Trash2,
  RefreshCw,
  AlertCircle,
  Hash,
} from 'lucide-react';
import { SectionCard } from '@client/src/components/layout/SectionCard';
import { Toolbar } from '@client/src/components/layout/Toolbar';
import { Pill } from '@client/src/components/layout/Pill';
import { DataTable } from '@client/src/components/layout/DataTable';
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
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from '@client/src/components/ui/dialog';
import { Textarea } from '@client/src/components/ui/textarea';
import {
  getKeywords,
  createKeyword,
  batchImportKeywords,
  deleteKeyword,
  updateKeyword,
  getBrandList,
  toggleCoreKeyword,
  setParentKeyword,
} from '@client/src/api/keywords';
import {
  KEYWORD_TYPE_LABELS,
  KEYWORD_TYPES,
} from '@shared/api.interface';
import type { Keyword } from '@shared/api.interface';
import { showConfirm } from '@lark-apaas/client-toolkit';

const PRIMARY = '#1e40af';
const SUCCESS = '#10b981';
const DANGER = '#ef4444';
const MUTED = '#64748b';

const PAGE_SIZE = 10;

const KeywordLibrary = () => {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [brandId, setBrandId] = useState<string>('');
  const [keywordType, setKeywordType] = useState<string>('');
  const [keywordSearch, setKeywordSearch] = useState<string>('');
  const [parentKeywordId, setParentKeywordId] = useState<string>('');

  const {
    data: keywordsData,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['keywords', 'list', page, brandId, keywordType, keywordSearch, parentKeywordId],
    queryFn: () =>
      getKeywords({
        page,
        pageSize: PAGE_SIZE,
        brandId: brandId || undefined,
        keywordType: keywordType || undefined,
        keyword: keywordSearch || undefined,
        parentKeywordId: parentKeywordId === '' ? undefined : parentKeywordId === '__none__' ? '' : parentKeywordId,
      }),
  });

  // 当前品牌下的核心词列表（用于筛选和设置父级）
  const { data: coreKeywords = [] } = useQuery<Keyword[]>({
    queryKey: ['keywords', 'core-list', brandId],
    queryFn: async (): Promise<Keyword[]> => {
      const res = await getKeywords({
        page: 1,
        pageSize: 500,
        brandId: brandId || undefined,
        keywordType: 'core',
      });
      return res.items;
    },
    enabled: !!brandId,
  });

  const { data: brandOptions = [] } = useQuery({
    queryKey: ['brands', 'options'],
    queryFn: getBrandList,
  });

  /* ---------- 新增弹窗 ---------- */
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState({
    keyword: '',
    keywordType: 'core',
    brandId: '',
  });
  const createMutation = useMutation({
    mutationFn: createKeyword,
    retry: false,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['keywords', 'list'] });
      setCreateOpen(false);
      setCreateForm({ keyword: '', keywordType: 'core', brandId: '' });
    },
  });

  /* ---------- 编辑弹窗 ---------- */
  const [editing, setEditing] = useState<Keyword | null>(null);
  const [editForm, setEditForm] = useState({
    keyword: '',
    keywordType: 'core',
    brandId: '',
  });
  const openEdit = (kw: Keyword) => {
    setEditing(kw);
    setEditForm({
      keyword: kw.keyword,
      keywordType: kw.keywordType,
      brandId: kw.brandId,
    });
  };
  const updateMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: typeof editForm }) =>
      updateKeyword(id, body),
    retry: false,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['keywords', 'list'] });
      setEditing(null);
    },
  });

  /* ---------- 删除 ---------- */
  const deleteMutation = useMutation({
    mutationFn: deleteKeyword,
    retry: false,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['keywords', 'list'] });
    },
  });

  /* ---------- 批量导入弹窗 ---------- */
  const [importOpen, setImportOpen] = useState(false);
  const [importForm, setImportForm] = useState({
    keywordType: 'core',
    brandId: '',
    text: '',
  });
  const importMutation = useMutation({
    mutationFn: batchImportKeywords,
    retry: false,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['keywords', 'list'] });
      setImportOpen(false);
      setImportForm({ keywordType: 'core', brandId: '', text: '' });
    },
  });

  const handleSearch = () => {
    setPage(1);
  };

  /* ---------- 标记/取消核心词 ---------- */
  const toggleCoreMutation = useMutation({
    mutationFn: ({ id, isCore }: { id: string; isCore: boolean }) =>
      toggleCoreKeyword(id, isCore),
    retry: false,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['keywords', 'list'] });
      queryClient.invalidateQueries({ queryKey: ['keywords', 'core-list'] });
    },
  });

  /* ---------- 设置父级 ---------- */
  const [setParentOpen, setSetParentOpen] = useState(false);
  const [setParentTarget, setSetParentTarget] = useState<Keyword | null>(null);
  const [setParentValue, setSetParentValue] = useState<string>('');

  const openSetParent = (kw: Keyword) => {
    setSetParentTarget(kw);
    setSetParentValue(kw.parentKeywordId || '');
    setSetParentOpen(true);
  };

  const setParentMutation = useMutation({
    mutationFn: ({ id, parentId }: { id: string; parentId: string | null }) =>
      setParentKeyword(id, parentId),
    retry: false,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['keywords', 'list'] });
      setSetParentOpen(false);
      setSetParentTarget(null);
    },
  });

  const handleConfirmSetParent = () => {
    if (!setParentTarget) return;
    setParentMutation.mutate({
      id: setParentTarget.id,
      parentId: setParentValue || null,
    });
  };

  return (
    <SectionCard
      title="关键词词库"
      count={keywordsData?.total ?? 0}
      actions={
        <>
          <Button size="sm" variant="outline" className="h-9" onClick={() => setImportOpen(true)}>
            <Upload className="h-3.5 w-3.5" />
            批量导入
          </Button>
          <Button size="sm" className="h-9 bg-[#2E7DFF] text-white hover:bg-[#1E5FD6]" onClick={() => setCreateOpen(true)}>
            <Plus className="h-3.5 w-3.5" />
            添加关键词
          </Button>
        </>
      }
    >
      <Toolbar>
        <Select value={brandId} onValueChange={setBrandId}>
          <SelectTrigger className="h-9 w-[140px]">
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
        <Select value={keywordType} onValueChange={setKeywordType}>
          <SelectTrigger className="h-9 w-[120px]">
            <SelectValue placeholder="全部类型" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">全部类型</SelectItem>
            {KEYWORD_TYPES.map((t) => (
              <SelectItem key={t} value={t}>
                {KEYWORD_TYPE_LABELS[t]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={parentKeywordId} onValueChange={setParentKeywordId}>
          <SelectTrigger className="h-9 w-[160px]">
            <SelectValue placeholder="上级核心词" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">全部</SelectItem>
            <SelectItem value="__none__">未归类</SelectItem>
            {coreKeywords.map((kw: Keyword) => (
              <SelectItem key={kw.id} value={kw.id}>
                {kw.keyword}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="relative w-[260px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94A3B8]" />
          <Input
            placeholder="搜索关键词"
            value={keywordSearch}
            onChange={(e) => setKeywordSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            className="h-9 pl-9"
          />
        </div>
        <Button
          size="sm"
          className="h-9 bg-[#2E7DFF] text-white hover:bg-[#1E5FD6]"
          onClick={handleSearch}
        >
          <RefreshCw className="h-3.5 w-3.5" />
          查询
        </Button>
      </Toolbar>

      {/* 错误态 */}
      {isError && (
        <div className="flex items-center justify-between rounded-lg border border-red-200 bg-red-50 p-4">
          <div className="flex items-center gap-2 text-sm" style={{ color: DANGER }}>
            <AlertCircle className="h-4 w-4" />
            <span>数据加载失败，请重试</span>
          </div>
          <button
            onClick={() => refetch()}
            className="flex items-center gap-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors hover:bg-red-100"
            style={{ color: DANGER }}
          >
            <RefreshCw className="h-3.5 w-3.5" />
            重试
          </button>
        </div>
      )}

      {/* 表格区 */}
      {isLoading ? (
        <TableSkeleton />
      ) : keywordsData ? (
        <DataTable
          columns={[
            { key: 'index', title: '序号', width: '60px', align: 'left', render: (_row: Keyword, index: number) => (
              <span className="text-[#5B6B85]">{(page - 1) * PAGE_SIZE + index + 1}</span>
            )},
            { key: 'keyword', title: '关键词', render: (row: Keyword) => (
              <span className="truncate block font-medium" title={row.keyword}>{row.keyword}</span>
            )},
            { key: 'keywordType', title: '类型', width: '80px', render: (row: Keyword) => (
              <Pill variant={row.keywordType === 'core' ? 'info' : 'muted'}>
                {KEYWORD_TYPE_LABELS[row.keywordType]}
              </Pill>
            )},
            { key: 'brandName', title: '品牌', width: '140px', render: (row: Keyword) => (
              <span className="truncate block" title={row.brandName}>{row.brandName}</span>
            )},
            { key: 'parentKeyword', title: '上级核心词', width: '140px', render: (row: Keyword) => (
              row.parentKeyword ? (
                <span className="truncate block" title={row.parentKeyword}>{row.parentKeyword}</span>
              ) : (
                <span className="text-[#94A3B8]">未归类</span>
              )
            )},
            { key: 'isExample', title: '示例', width: '60px', render: (row: Keyword) => (
              row.isExample ? <Pill variant="muted">示例</Pill> : null
            )},
            { key: 'createdAt', title: '创建时间', width: '160px', render: (row: Keyword) => (
              <span className="text-[#5B6B85]">
                {row.createdAt ? new Date(row.createdAt).toLocaleString('zh-CN') : '-'}
              </span>
            )},
            { key: 'actions', title: '操作', width: '220px', render: (row: Keyword) => (
              <div className="flex items-center gap-1 flex-wrap">
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 px-2 text-xs text-[#2E7DFF] hover:text-[#1E5FD6] hover:bg-[#EAF2FF]"
                  onClick={() => openEdit(row)}
                >
                  <Pencil className="h-3 w-3" />
                  编辑
                </Button>
                {row.keywordType === 'core' ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 px-2 text-xs text-[#5B6B85] hover:text-[#0F172A]"
                    onClick={async () => {
                      if (
                        await showConfirm(
                          '取消核心词后，其子词将变为未归类，确认操作？',
                        )
                      ) {
                        toggleCoreMutation.mutate({
                          id: row.id,
                          isCore: false,
                        });
                      }
                    }}
                  >
                    取消核心
                  </Button>
                ) : (
                  <>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 px-2 text-xs text-[#5B6B85] hover:text-[#0F172A]"
                      onClick={() => openSetParent(row)}
                    >
                      设置父级
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 px-2 text-xs text-[#5B6B85] hover:text-[#0F172A]"
                      onClick={async () => {
                        if (
                          await showConfirm(
                            '确认将该长尾词标记为核心词？',
                          )
                        ) {
                          toggleCoreMutation.mutate({
                            id: row.id,
                            isCore: true,
                          });
                        }
                      }}
                    >
                      标记核心
                    </Button>
                  </>
                )}
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 px-2 text-xs text-[#EF4444] hover:text-[#DC2626] hover:bg-red-50"
                  onClick={async () => {
                    if (await showConfirm('确认删除该关键词？')) {
                      deleteMutation.mutate(row.id);
                    }
                  }}
                >
                  <Trash2 className="h-3 w-3" />
                  删除
                </Button>
              </div>
            )},
          ]}
          data={keywordsData.items}
          rowKey="id"
          emptyText="暂无关键词数据"
          emptyIcon={<Hash />}
          emptyAction={
            <Button
              size="sm"
              className="bg-[#2E7DFF] text-white hover:bg-[#1E5FD6]"
              onClick={() => setCreateOpen(true)}
            >
              <Plus className="h-3.5 w-3.5" />
              添加关键词
            </Button>
          }
          pagination={{
            total: keywordsData.total,
            page,
            pageSize: PAGE_SIZE,
            onPageChange: setPage,
            onPageSizeChange: () => {},
            pageSizeOptions: [10],
          }}
        />
      ) : null}

        {/* 设置父级弹窗 */}
        <Dialog open={setParentOpen} onOpenChange={setSetParentOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>设置上级核心词</DialogTitle>
              <DialogDescription>
                为「{setParentTarget?.keyword}」选择上级核心词
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3 py-2">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">上级核心词</label>
                <Select
                  value={setParentValue}
                  onValueChange={setSetParentValue}
                >
                  <SelectTrigger className="w-full h-9">
                    <SelectValue placeholder="不设置（未归类）" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">不设置（未归类）</SelectItem>
                    {coreKeywords.map((kw) => (
                      <SelectItem key={kw.id} value={kw.id}>
                        {kw.keyword}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setSetParentOpen(false)}
              >
                取消
              </Button>
              <Button
                className="bg-[#2E7DFF] text-white hover:bg-[#1E5FD6]"
                disabled={setParentMutation.isPending}
                onClick={handleConfirmSetParent}
              >
                {setParentMutation.isPending ? '保存中...' : '确认'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* 批量导入弹窗 */}
        <Dialog open={importOpen} onOpenChange={setImportOpen}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>批量导入关键词</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 py-2">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">所属品牌</label>
                <Select
                  value={importForm.brandId}
                  onValueChange={(v) =>
                    setImportForm({ ...importForm, brandId: v })
                  }
                >
                  <SelectTrigger className="w-full h-9">
                    <SelectValue placeholder="请选择品牌" />
                  </SelectTrigger>
                  <SelectContent>
                    {brandOptions.map((b) => (
                      <SelectItem key={b.id} value={b.id}>
                        {b.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">关键词类型</label>
                <Select
                  value={importForm.keywordType}
                  onValueChange={(v) =>
                    setImportForm({ ...importForm, keywordType: v })
                  }
                >
                  <SelectTrigger className="w-full h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {KEYWORD_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>
                        {KEYWORD_TYPE_LABELS[t]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">
                  关键词列表（每行一个）
                </label>
                <Textarea
                  placeholder="关键词1&#10;关键词2&#10;关键词3"
                  value={importForm.text}
                  onChange={(e) =>
                    setImportForm({ ...importForm, text: e.target.value })
                  }
                  className="min-h-[200px] resize-y"
                />
                <p className="text-xs text-muted-foreground">
                  共{' '}
                  {
                    importForm.text
                      .split('\n')
                      .filter((l) => l.trim()).length
                  }{' '}
                  个关键词
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setImportOpen(false)}
              >
                取消
              </Button>
              <Button
                className="bg-[#2E7DFF] text-white hover:bg-[#1E5FD6]"
                disabled={
                  importMutation.isPending ||
                  !importForm.brandId ||
                  !importForm.text.trim()
                }
                onClick={() => {
                  const keywords = importForm.text
                    .split('\n')
                    .map((l) => l.trim())
                    .filter(Boolean);
                  importMutation.mutate({
                    keywords,
                    keywordType: importForm.keywordType,
                    brandId: importForm.brandId,
                  });
                }}
              >
                {importMutation.isPending ? '导入中...' : '确认导入'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* 新增弹窗 */}
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>新增关键词</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 py-2">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">关键词</label>
                <Input
                  value={createForm.keyword}
                  onChange={(e) =>
                    setCreateForm({
                      ...createForm,
                      keyword: e.target.value,
                    })
                  }
                  placeholder="请输入关键词"
                  className="h-9"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">类型</label>
                <Select
                  value={createForm.keywordType}
                  onValueChange={(v) =>
                    setCreateForm({ ...createForm, keywordType: v })
                  }
                >
                  <SelectTrigger className="w-full h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {KEYWORD_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>
                        {KEYWORD_TYPE_LABELS[t]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">所属品牌</label>
                <Select
                  value={createForm.brandId}
                  onValueChange={(v) =>
                    setCreateForm({ ...createForm, brandId: v })
                  }
                >
                  <SelectTrigger className="w-full h-9">
                    <SelectValue placeholder="请选择品牌" />
                  </SelectTrigger>
                  <SelectContent>
                    {brandOptions.map((b) => (
                      <SelectItem key={b.id} value={b.id}>
                        {b.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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
                  !createForm.keyword.trim() ||
                  !createForm.brandId
                }
                onClick={() => createMutation.mutate(createForm)}
              >
                {createMutation.isPending ? '保存中...' : '保存'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* 编辑弹窗 */}
        <Dialog
          open={!!editing}
          onOpenChange={(v) => !v && setEditing(null)}
        >
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>编辑关键词</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 py-2">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">关键词</label>
                <Input
                  value={editForm.keyword}
                  onChange={(e) =>
                    setEditForm({ ...editForm, keyword: e.target.value })
                  }
                  className="h-9"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">类型</label>
                <Select
                  value={editForm.keywordType}
                  onValueChange={(v) =>
                    setEditForm({ ...editForm, keywordType: v })
                  }
                >
                  <SelectTrigger className="w-full h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {KEYWORD_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>
                        {KEYWORD_TYPE_LABELS[t]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">所属品牌</label>
                <Select
                  value={editForm.brandId}
                  onValueChange={(v) =>
                    setEditForm({ ...editForm, brandId: v })
                  }
                >
                  <SelectTrigger className="w-full h-9">
                    <SelectValue placeholder="请选择品牌" />
                  </SelectTrigger>
                  <SelectContent>
                    {brandOptions.map((b) => (
                      <SelectItem key={b.id} value={b.id}>
                        {b.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditing(null)}>
                取消
              </Button>
              <Button
                className="bg-[#2E7DFF] text-white hover:bg-[#1E5FD6]"
                disabled={
                  updateMutation.isPending ||
                  !editForm.keyword.trim() ||
                  !editForm.brandId ||
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
      </SectionCard>
  );
};

const TableSkeleton = () => (
  <div className="space-y-2 rounded-md border p-4">
    {Array.from({ length: 8 }).map((_, i) => (
      <div key={i} className="flex items-center gap-4">
        <Skeleton className="h-4 w-10" />
        <Skeleton className="h-4 flex-1" />
        <Skeleton className="h-4 w-16" />
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-4 w-12" />
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-4 w-20" />
      </div>
    ))}
  </div>
);

export default KeywordLibrary;
