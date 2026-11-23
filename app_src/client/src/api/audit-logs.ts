import { axiosForBackend } from '@lark-apaas/client-toolkit/utils/getAxiosForBackend';
import { useQuery } from '@tanstack/react-query';
import type {
  OperationLogListRequest,
  OperationLogListResponse,
} from '@shared/api.interface';

async function fetchAuditLogs(
  params: OperationLogListRequest,
): Promise<OperationLogListResponse> {
  const { data } = await axiosForBackend.get('/api/audit-logs', { params });
  return data;
}

export function useAuditLogList(params: OperationLogListRequest) {
  return useQuery<OperationLogListResponse>({
    queryKey: ['audit-logs', params],
    queryFn: () => fetchAuditLogs(params),
  });
}
