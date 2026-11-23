import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { axiosForBackend } from '@lark-apaas/client-toolkit/utils/getAxiosForBackend';
import type {
  GeoMember,
  MemberListRequest,
  MemberListResponse,
  CreateMemberRequest,
  UpdateMemberStatusRequest,
} from '@shared/api.interface';
import { getApiErrorMessage } from '@client/src/lib/api-error';

/**
 * 成员列表
 */
export function useMembersList(params: MemberListRequest) {
  return useQuery({
    queryKey: ['members', params],
    queryFn: async (): Promise<MemberListResponse> => {
      const { data } = await axiosForBackend.get('/api/members', { params });
      return data;
    },
  });
}

/**
 * 新增成员
 */
export function useCreateMember() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateMemberRequest): Promise<GeoMember> =>
      axiosForBackend.post('/api/members', body).then((r) => r.data),
    retry: false,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['members'] });
      toast.success('成员创建成功');
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error, '创建失败，请稍后重试'));
    },
  });
}

/**
 * 更新成员状态（启用/禁用）
 */
export function useUpdateMemberStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      status,
    }: {
      id: string;
      status: UpdateMemberStatusRequest['status'];
    }): Promise<GeoMember> =>
      axiosForBackend
        .patch(`/api/members/${id}/status`, { status })
        .then((r) => r.data),
    retry: false,
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['members'] });
      toast.success(
        variables.status === 'active' ? '成员已启用' : '成员已禁用',
      );
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error, '操作失败，请稍后重试'));
    },
  });
}
