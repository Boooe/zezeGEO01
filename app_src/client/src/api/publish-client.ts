import { axiosForBackend } from '@lark-apaas/client-toolkit/utils/getAxiosForBackend';
import type {
  ClientBindRequest,
  ClientBindResponse,
  ClientHeartbeatRequest,
  ClientHeartbeatResponse,
} from '@shared/api.interface';

export async function downloadScript(): Promise<Blob> {
  const response = await axiosForBackend.get('/api/publish-client/download', {
    responseType: 'blob',
  });
  return response.data;
}

export async function listClients(brandId?: string) {
  const response = await axiosForBackend.get('/api/publish-client/clients', {
    params: brandId ? { brandId } : {},
  });
  return response.data;
}

export async function bind(
  data: ClientBindRequest,
): Promise<ClientBindResponse> {
  const response = await axiosForBackend.post('/api/publish-client/bind', data);
  return response.data;
}

export async function heartbeat(
  data: ClientHeartbeatRequest,
): Promise<ClientHeartbeatResponse> {
  const response = await axiosForBackend.post('/api/publish-client/heartbeat', data);
  return response.data;
}
