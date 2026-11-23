import React, { useState, useMemo } from 'react';
import { Search, Plus, RefreshCw, Trash2, Pencil } from 'lucide-react';
import {
  useMembersList,
  useCreateMember,
  useUpdateMemberStatus,
} from '@client/src/api/members';
import {
  useRoles,
  useCreateRole,
  useUpdateRole,
  useDeleteRole,
  useUpdateMemberRole,
} from '@client/src/api/roles';
import { useAuth } from '@client/src/hooks/useAuth';
import { Button } from '@client/src/components/ui/button';
import { Input } from '@client/src/components/ui/input';
import { Badge } from '@client/src/components/ui/badge';
import { Skeleton } from '@client/src/components/ui/skeleton';
import { Checkbox } from '@client/src/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@client/src/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@client/src/components/ui/dialog';
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from '@client/src/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@client/src/components/ui/table';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@client/src/components/ui/tooltip';
import { DataPagination } from '@client/src/components/ui/data-pagination';
import {
  PERMISSIONS,
  PERMISSION_GROUPS,
  MEMBER_STATUS_LABELS,
  MEMBER_STATUSES,
} from '@shared/api.interface';
import type {
  GeoMember,
  GeoRole,
  MemberListRequest,
  CreateMemberRequest,
  CreateRoleRequest,
  UpdateRoleRequest,
} from '@shared/api.interface';
import { getApiErrorMessage } from '@client/src/lib/api-error';
import { toast } from 'sonner';
import { logger } from '@lark-apaas/client-toolkit/logger';

const ROLE_TYPE_LABELS: Record<string, string> = {
  system: '系统',
  custom: '自定义',
};

const MembersPage: React.FC = () => {
  const { hasPermission } = useAuth();
  const [activeTab, setActiveTab] = useState<string>('roles');

  // 权限控制：没有 system.member 权限时显示无权限
  if (!hasPermission('system.member')) {
    return (
      <div className="flex min-h-full items-center justify-center bg-[#F7F9FC] p-6">
        <div className="text-center">
          <div className="mb-4 text-[48px]">🔒</div>
          <div className="text-[16px] font-medium text-[#334155]">无权限访问</div>
          <div className="mt-1 text-[13px] text-[#94a3b8]">
            您没有成员与角色管理权限，请联系管理员
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-full bg-[#F7F9FC] p-6">
      {/* 页面标题 */}
      <div className="mb-4">
        <h1 className="text-[20px] font-semibold text-[#0f172a]">成员与角色</h1>
        <p className="mt-1 text-[13px] text-[#64748b]">
          管理系统角色权限及成员账号
        </p>
      </div>

      <div className="rounded-[12px] border border-[#E5E9F2] bg-white">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <div className="border-b border-[#E5E9F2] px-4 pt-3">
            <TabsList className="h-9 bg-transparent p-0">
              <TabsTrigger
                value="roles"
                className="h-9 rounded-none border-b-2 border-transparent px-4 text-[13px] data-[state=active]:border-b-2 data-[state=active]:border-[#2E7DFF] data-[state=active]:bg-transparent data-[state=active]:text-[#2E7DFF] data-[state=active]:shadow-none data-[state=active]:font-semibold"
              >
                角色管理
              </TabsTrigger>
              <TabsTrigger
                value="members"
                className="h-9 rounded-none border-b-2 border-transparent px-4 text-[13px] data-[state=active]:border-b-2 data-[state=active]:border-[#2E7DFF] data-[state=active]:bg-transparent data-[state=active]:text-[#2E7DFF] data-[state=active]:shadow-none data-[state=active]:font-semibold"
              >
                成员列表
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="roles" className="mt-0">
            <RolesTab />
          </TabsContent>

          <TabsContent value="members" className="mt-0">
            <MembersTab />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

/* ==================== 角色管理 Tab ==================== */

const RolesTab: React.FC = () => {
  const { data: roles, isLoading, isError, refetch } = useRoles();
  const createRole = useCreateRole();
  const updateRole = useUpdateRole();
  const deleteRole = useDeleteRole();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<GeoRole | null>(null);
  const [formName, setFormName] = useState('');
  const [formPermissions, setFormPermissions] = useState<string[]>([]);

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingRole, setDeletingRole] = useState<GeoRole | null>(null);

  const handleOpenCreate = () => {
    setEditingRole(null);
    setFormName('');
    setFormPermissions([]);
    setDialogOpen(true);
  };

  const handleOpenEdit = (role: GeoRole) => {
    setEditingRole(role);
    setFormName(role.name);
    setFormPermissions([...(role.permissions || [])]);
    setDialogOpen(true);
  };

  const handleSubmit = () => {
    if (!formName.trim()) {
      toast.error('请输入角色名称');
      return;
    }

    if (editingRole) {
      const body: UpdateRoleRequest = {
        name: formName.trim(),
        permissions: formPermissions,
      };
      updateRole.mutate(
        { id: editingRole.id, ...body },
        {
          onSuccess: () => setDialogOpen(false),
        },
      );
    } else {
      const body: CreateRoleRequest = {
        name: formName.trim(),
        permissions: formPermissions,
      };
      createRole.mutate(body, {
        onSuccess: () => setDialogOpen(false),
      });
    }
  };

  const handleDeleteClick = (role: GeoRole) => {
    setDeletingRole(role);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = () => {
    if (!deletingRole) return;
    deleteRole.mutate(deletingRole.id, {
      onSuccess: () => {
        setDeleteDialogOpen(false);
        setDeletingRole(null);
      },
      onError: (err) => {
        const msg = getApiErrorMessage(err, '');
        if (msg && msg.includes('占用')) {
          toast.error('请先把该角色下的成员改派其他角色');
        }
      },
    });
  };

  const togglePermission = (key: string) => {
    setFormPermissions((prev) =>
      prev.includes(key) ? prev.filter((p) => p !== key) : [...prev, key],
    );
  };

  const permissionsByGroup = useMemo(() => {
    const groups: Record<string, Array<(typeof PERMISSIONS)[number]>> = {};
    for (const group of PERMISSION_GROUPS) {
      groups[group] = PERMISSIONS.filter((p) => p.group === group);
    }
    return groups;
  }, []);

  return (
    <div>
      {/* 顶部操作栏 */}
      <div className="flex items-center justify-between border-b border-[#E5E9F2] p-4">
        <div className="text-[13px] text-[#64748b]">
          共 <span className="font-medium text-[#0f172a]">{roles?.length ?? 0}</span> 个角色
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            aria-label="刷新"
          >
            <RefreshCw className="h-4 w-4" />
            刷新
          </Button>
          <Button size="sm" onClick={handleOpenCreate}>
            <Plus className="h-4 w-4" />
            新建角色
          </Button>
        </div>
      </div>

      {/* 表格区 */}
      <div className="px-4 pt-2">
        {isLoading ? (
          <RoleTableSkeleton />
        ) : isError ? (
          <ErrorState onRetry={() => refetch()} />
        ) : !roles || roles.length === 0 ? (
          <RoleEmptyState />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[200px]">角色名</TableHead>
                <TableHead className="w-[100px]">权限数</TableHead>
                <TableHead className="w-[100px]">成员数</TableHead>
                <TableHead className="w-[100px]">类型</TableHead>
                <TableHead className="w-[140px] text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {roles.map((role: GeoRole) => (
                <TableRow key={role.id}>
                  <TableCell className="font-medium text-[#0f172a]">
                    {role.name}
                  </TableCell>
                  <TableCell className="text-[#475467] tabular-nums">
                    {role.permissions?.length ?? 0}
                  </TableCell>
                  <TableCell className="text-[#475467] tabular-nums">
                    {role.memberCount ?? 0}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={
                        role.isSystem
                          ? 'border-transparent bg-[#EEF2FF] text-[#4F46E5]'
                          : 'border-transparent bg-[#F2F4F7] text-[#64748b]'
                      }
                    >
                      {role.isSystem
                        ? ROLE_TYPE_LABELS.system
                        : ROLE_TYPE_LABELS.custom}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-[12.5px] text-[#2E7DFF] hover:text-[#1E5FD6] hover:bg-[#EAF2FF]"
                        onClick={() => handleOpenEdit(role)}
                        aria-label={`编辑${role.name}`}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                        编辑
                      </Button>
                      {role.isSystem ? (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span>
                              <Button
                                variant="ghost"
                                size="sm"
                                disabled
                                className="h-7 px-2 text-[12.5px]"
                                aria-label="系统角色不可删除"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                                删除
                              </Button>
                            </span>
                          </TooltipTrigger>
                          <TooltipContent>系统角色不可删除</TooltipContent>
                        </Tooltip>
                      ) : (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-[12.5px] text-[#FF5C5C] hover:text-[#E04646] hover:bg-[#FFF1F1]"
                          onClick={() => handleDeleteClick(role)}
                          aria-label={`删除${role.name}`}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          删除
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {/* 新建/编辑角色弹窗 */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-[560px] max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>{editingRole ? '编辑角色' : '新建角色'}</DialogTitle>
            <DialogDescription>
              设置角色名称及对应的权限范围
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto py-2">
            <div className="space-y-4">
              {/* 角色名称 */}
              <div className="space-y-1.5">
                <label className="text-[13px] font-medium text-[#334155]">
                  角色名称
                </label>
                <Input
                  placeholder="请输入角色名称"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  disabled={editingRole?.isSystem}
                />
                {editingRole?.isSystem && (
                  <p className="text-[12px] text-[#94a3b8]">系统角色名称不可修改</p>
                )}
              </div>

              {/* 权限矩阵 */}
              <div className="space-y-2">
                <label className="text-[13px] font-medium text-[#334155]">
                  权限设置
                </label>
                <div className="space-y-4 rounded-lg border border-[#E5E9F2] p-4">
                  {PERMISSION_GROUPS.map((group: string) => (
                    <div key={group}>
                      <div className="mb-2 text-[12px] font-medium text-[#64748b]">
                        {group}
                      </div>
                      <div className="grid grid-cols-2 gap-x-4 gap-y-2 md:grid-cols-3">
                        {permissionsByGroup[group]?.map((perm) => (
                          <label
                            key={perm.key}
                            className="flex cursor-pointer items-center gap-2 text-[13px] text-[#334155]"
                          >
                            <Checkbox
                              checked={formPermissions.includes(perm.key)}
                              onCheckedChange={(checked) => {
                                if (checked) {
                                  togglePermission(perm.key);
                                } else {
                                  togglePermission(perm.key);
                                }
                              }}
                            />
                            <span>{perm.label}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDialogOpen(false)}
              disabled={createRole.isPending || updateRole.isPending}
            >
              取消
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={createRole.isPending || updateRole.isPending}
            >
              {createRole.isPending || updateRole.isPending
                ? '保存中...'
                : '确定'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 删除确认弹窗 */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="max-w-[400px]">
          <DialogHeader>
            <DialogTitle>确认删除</DialogTitle>
            <DialogDescription>
              确定要删除角色「{deletingRole?.name}」吗？此操作不可撤销。
            </DialogDescription>
          </DialogHeader>
          {deletingRole && (deletingRole.memberCount ?? 0) > 0 && (
            <div className="rounded-md bg-[#FFF7ED] px-3 py-2 text-sm text-[#B45309]">
              该角色下还有 {deletingRole.memberCount} 名成员，请先把成员改派到其他角色。
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteDialogOpen(false)}
              disabled={deleteRole.isPending}
            >
              取消
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirmDelete}
              disabled={
                deleteRole.isPending ||
                (deletingRole ? (deletingRole.memberCount ?? 0) > 0 : false)
              }
            >
              {deleteRole.isPending ? '删除中...' : '确认删除'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

/* ==================== 成员列表 Tab ==================== */

const MembersTab: React.FC = () => {
  const { user } = useAuth();
  const currentUserId = user?.id ?? '';
  const { data: roles } = useRoles();
  const updateMemberRole = useUpdateMemberRole();

  // 筛选状态
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [status, setStatus] = useState<string>('all');
  const [keyword, setKeyword] = useState<string>('');
  const [page, setPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);

  // 新增弹窗
  const [dialogOpen, setDialogOpen] = useState<boolean>(false);
  const [formName, setFormName] = useState<string>('');
  const [formUsername, setFormUsername] = useState<string>('');
  const [formRoleId, setFormRoleId] = useState<string>('');

  const queryParams: MemberListRequest = useMemo(() => {
    const params: MemberListRequest = { page, pageSize };
    if (roleFilter && roleFilter !== 'all') params.role = roleFilter;
    if (status && status !== 'all') params.status = status;
    if (keyword && keyword.trim()) params.keyword = keyword.trim();
    return params;
  }, [page, pageSize, roleFilter, status, keyword]);

  const { data, isLoading, isError, refetch } = useMembersList(queryParams);
  const createMember = useCreateMember();
  const updateStatus = useUpdateMemberStatus();

  // 角色映射：code → role object, id → role object
  const roleMapById = useMemo(() => {
    const map = new Map<string, GeoRole>();
    if (roles) {
      for (const r of roles) {
        map.set(r.id, r);
        if (r.code) map.set(r.code, r);
      }
    }
    return map;
  }, [roles]);

  const getRoleName = (member: GeoMember): string => {
    // 兼容两种模式：member.role 是 code 字符串 或 有单独的 roleId
    const roleCode = member.role as unknown as string;
    const role = roleMapById.get(roleCode);
    return role?.name || roleCode || '';
  };

  const getRoleId = (member: GeoMember): string => {
    const roleCode = member.role as unknown as string;
    const role = roleMapById.get(roleCode);
    return role?.id || roleCode || '';
  };

  const handleSearch = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      setPage(1);
    }
  };

  const handleRoleFilterChange = (val: string) => {
    setRoleFilter(val);
    setPage(1);
  };

  const handleStatusChange = (val: string) => {
    setStatus(val);
    setPage(1);
  };

  const handlePageChange = (p: number) => {
    setPage(p);
  };

  const handlePageSizeChange = (size: number) => {
    setPageSize(size);
    setPage(1);
  };

  const handleToggleStatus = (member: GeoMember) => {
    if (member.id === currentUserId) return;
    const nextStatus: 'active' | 'disabled' =
      member.status === 'active' ? 'disabled' : 'active';
    updateStatus.mutate({ id: member.id, status: nextStatus });
  };

  const handleRoleChange = (memberId: string, newRoleId: string) => {
    updateMemberRole.mutate(
      { id: memberId, roleId: newRoleId },
      {
        onError: () => {
          refetch();
        },
      },
    );
  };

  const handleSubmitCreate = () => {
    if (!formName.trim()) {
      toast.error('请输入姓名');
      return;
    }
    if (!formUsername.trim()) {
      toast.error('请输入用户名');
      return;
    }
    const body: CreateMemberRequest = {
      name: formName.trim(),
      username: formUsername.trim(),
      role: formRoleId
        ? (roleMapById.get(formRoleId)?.code as GeoMember['role']) ||
          ('operator' as GeoMember['role'])
        : ('operator' as GeoMember['role']),
    };
    createMember.mutate(body, {
      onSuccess: () => {
        setDialogOpen(false);
        setFormName('');
        setFormUsername('');
        setFormRoleId('');
      },
    });
  };

  const isSelf = (id: string): boolean => id === currentUserId;

  const roleOptions = roles ?? [];

  return (
    <div>
      {/* 顶部筛选栏 */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E5E9F2] p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="w-40">
            <Select value={roleFilter} onValueChange={handleRoleFilterChange}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="全部角色" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部角色</SelectItem>
                {roleOptions.map((r: GeoRole) => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="w-36">
            <Select value={status} onValueChange={handleStatusChange}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="全部状态" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部状态</SelectItem>
                {MEMBER_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {MEMBER_STATUS_LABELS[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94a3b8]" />
            <Input
              placeholder="搜索姓名 / 用户名"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              onKeyDown={handleSearch}
              className="pl-9"
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            aria-label="刷新"
          >
            <RefreshCw className="h-4 w-4" />
            刷新
          </Button>
          <Button size="sm" onClick={() => setDialogOpen(true)}>
            <Plus className="h-4 w-4" />
            新增成员
          </Button>
        </div>
      </div>

      {/* 表格区 */}
      <div className="px-4 pt-2">
        {isLoading ? (
          <MembersSkeleton />
        ) : isError ? (
          <ErrorState onRetry={() => refetch()} />
        ) : !data || data.items.length === 0 ? (
          <MembersEmptyState />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[120px]">姓名</TableHead>
                <TableHead className="w-[160px]">用户名</TableHead>
                <TableHead className="w-[160px]">角色</TableHead>
                <TableHead className="w-[120px]">状态</TableHead>
                <TableHead className="w-[180px]">最后登录</TableHead>
                <TableHead className="w-[140px] text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.items.map((m: GeoMember) => (
                <TableRow key={m.id}>
                  <TableCell className="font-medium text-[#0f172a]">
                    {m.name}
                  </TableCell>
                  <TableCell className="text-[#475467]">
                    {m.username}
                  </TableCell>
                  <TableCell>
                    <Select
                      value={getRoleId(m)}
                      onValueChange={(val) => handleRoleChange(m.id, val)}
                      disabled={isSelf(m.id) || updateMemberRole.isPending}
                    >
                      <SelectTrigger className="h-8 w-[140px] text-[13px]">
                        <SelectValue>{getRoleName(m)}</SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {roleOptions.map((r: GeoRole) => (
                          <SelectItem key={r.id} value={r.id}>
                            {r.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <Badge
                      className={
                        m.status === 'active'
                          ? 'border-transparent bg-[#E6F8EE] text-[#17C964]'
                          : 'border-transparent bg-[#F2F4F7] text-[#94a3b8]'
                      }
                      variant="outline"
                    >
                      {MEMBER_STATUS_LABELS[m.status]}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-[#64748b]">
                    {m.lastLoginAt
                      ? new Date(m.lastLoginAt).toLocaleString('zh-CN')
                      : '—'}
                  </TableCell>
                  <TableCell className="text-right">
                    {isSelf(m.id) ? (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span>
                            <Button
                              variant="ghost"
                              size="sm"
                              disabled
                              className="h-7 px-2 text-xs"
                            >
                              {m.status === 'active' ? '禁用' : '启用'}
                            </Button>
                          </span>
                        </TooltipTrigger>
                        <TooltipContent>不能操作自己的账号</TooltipContent>
                      </Tooltip>
                    ) : (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleToggleStatus(m)}
                        disabled={updateStatus.isPending}
                        className="h-7 px-2 text-xs"
                      >
                        {m.status === 'active' ? '禁用' : '启用'}
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {/* 分页 */}
      <div className="border-t border-[#E5E9F2] px-4 py-3">
        <DataPagination
          total={data?.total ?? 0}
          page={page}
          pageSize={pageSize}
          onPageChange={handlePageChange}
          onPageSizeChange={handlePageSizeChange}
        />
      </div>

      {/* 新增成员弹窗 */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>新增成员</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <label className="text-[13px] font-medium text-[#334155]">
                姓名
              </label>
              <Input
                placeholder="请输入姓名"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[13px] font-medium text-[#334155]">
                用户名
              </label>
              <Input
                placeholder="请输入用户名（登录账号）"
                value={formUsername}
                onChange={(e) => setFormUsername(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[13px] font-medium text-[#334155]">
                角色
              </label>
              <Select value={formRoleId} onValueChange={setFormRoleId}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="选择角色" />
                </SelectTrigger>
                <SelectContent>
                  {roleOptions.map((r: GeoRole) => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDialogOpen(false)}
              disabled={createMember.isPending}
            >
              取消
            </Button>
            <Button
              onClick={handleSubmitCreate}
              disabled={createMember.isPending}
            >
              {createMember.isPending ? '创建中...' : '确认创建'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

/* ==================== 骨架屏 / 空态 / 错误态 ==================== */

function RoleTableSkeleton() {
  return (
    <div className="py-2">
      <div className="flex h-10 items-center gap-4 bg-[#F8FAFC] px-4 text-[12.5px] font-medium text-[#334155]">
        <span className="w-[200px]">角色名</span>
        <span className="w-[100px]">权限数</span>
        <span className="w-[100px]">成员数</span>
        <span className="w-[100px]">类型</span>
        <span className="ml-auto w-[140px] text-right">操作</span>
      </div>
      {Array.from({ length: 5 }).map((_, i) => (
        <div
          key={i}
          className="flex h-[44px] items-center gap-4 border-b border-[#EEF2F7] px-4"
        >
          <Skeleton className="h-4 w-[160px]" />
          <Skeleton className="h-4 w-[60px]" />
          <Skeleton className="h-4 w-[60px]" />
          <Skeleton className="h-[22px] w-[60px] rounded-[6px]" />
          <div className="ml-auto w-[140px]">
            <Skeleton className="ml-auto h-6 w-[80px] rounded-[6px]" />
          </div>
        </div>
      ))}
    </div>
  );
}

function RoleEmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="mb-3 text-[40px]">🎭</div>
      <div className="text-[14px] font-medium text-[#334155]">暂无角色</div>
      <div className="mt-1 text-[12px] text-[#94a3b8]">
        点击右上角「新建角色」添加第一个角色
      </div>
    </div>
  );
}

function MembersSkeleton() {
  return (
    <div className="py-2">
      <div className="flex h-10 items-center gap-4 bg-[#F8FAFC] px-4 text-[12.5px] font-medium text-[#334155]">
        <span className="w-[120px]">姓名</span>
        <span className="w-[160px]">用户名</span>
        <span className="w-[160px]">角色</span>
        <span className="w-[120px]">状态</span>
        <span className="w-[180px]">最后登录</span>
        <span className="ml-auto w-[140px] text-right">操作</span>
      </div>
      {Array.from({ length: 5 }).map((_, i) => (
        <div
          key={i}
          className="flex h-[44px] items-center gap-4 border-b border-[#EEF2F7] px-4"
        >
          <Skeleton className="h-4 w-[100px]" />
          <Skeleton className="h-4 w-[140px]" />
          <Skeleton className="h-[26px] w-[120px] rounded-[6px]" />
          <Skeleton className="h-[22px] w-[60px] rounded-[6px]" />
          <Skeleton className="h-4 w-[140px]" />
          <div className="ml-auto w-[140px]">
            <Skeleton className="ml-auto h-6 w-[48px] rounded-[6px]" />
          </div>
        </div>
      ))}
    </div>
  );
}

function MembersEmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="mb-3 text-[40px]">📭</div>
      <div className="text-[14px] font-medium text-[#334155]">暂无成员</div>
      <div className="mt-1 text-[12px] text-[#94a3b8]">
        点击右上角「新增成员」添加第一个账号
      </div>
    </div>
  );
}

function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="mb-3 text-[40px]">⚠️</div>
      <div className="text-[14px] font-medium text-[#334155]">加载失败</div>
      <div className="mt-1 text-[12px] text-[#94a3b8]">
        网络异常或服务暂时不可用
      </div>
      <Button variant="outline" size="sm" onClick={onRetry} className="mt-4">
        重新加载
      </Button>
    </div>
  );
}

export default MembersPage;
