import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { axiosForBackend } from '@lark-apaas/client-toolkit/utils/getAxiosForBackend';
import type {
  GeoRole,
  GeoMember,
  CreateRoleRequest,
  UpdateRoleRequest,
} from '@shared/api.interface';
import { getApiErrorMessage } from '@client/src/lib/api-error';

/**
 * 角色列表
 */
export function useRoles() {
  return useQuery({
    queryKey: ['roles'],
    queryFn: async (): Promise<GeoRole[]> => {
      const { data } = await axiosForBackend.get('/api/roles');
      // 兼容 items 结构或直接数组
      if (data && Array.isArray(data.items)) return data.items;
      if (Array.isArray(data)) return data;
      return [];
    },
  });
}

/**
 * 新建角色
 */
export function useCreateRole() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateRoleRequest): Promise<GeoRole> =>
      axiosForBackend.post('/api/roles', body).then((r) => r.data),
    retry: false,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['roles'] });
      toast.success('角色创建成功');
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error, '创建失败，请稍后重试'));
    },
  });
}

/**
 * 更新角色
 */
export function useUpdateRole() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      ...body
    }: {
      id: string;
    } & UpdateRoleRequest): Promise<GeoRole> =>
      axiosForBackend.patch(`/api/roles/${id}`, body).then((r) => r.data),
    retry: false,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['roles'] });
      toast.success('角色更新成功');
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error, '更新失败，请稍后重试'));
    },
  });
}

/**
 * 删除角色
 */
export function useDeleteRole() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string): Promise<void> =>
      axiosForBackend.delete(`/api/roles/${id}`).then((r) => r.data),
    retry: false,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['roles'] });
      queryClient.invalidateQueries({ queryKey: ['members'] });
      toast.success('角色已删除');
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error, '删除失败，请稍后重试'));
    },
  });
}

/**
 * 修改成员角色
 */
export function useUpdateMemberRole() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      roleId,
    }: {
      id: string;
      roleId: string;
    }): Promise<GeoMember> =>
      axiosForBackend
        .patch(`/api/members/${id}/role`, { roleId })
        .then((r) => r.data),
    retry: false,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['members'] });
      toast.success('成员角色已更新');
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error, '更新失败，请稍后重试'));
    },
  });
}
