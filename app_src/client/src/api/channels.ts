import { axiosForBackend } from '@lark-apaas/client-toolkit/utils/getAxiosForBackend';
import type {
  Channel,
  ChannelListQuery,
  ChannelListResponse,
  CreateChannelRequest,
  UpdateChannelRequest,
  ChannelTestResult,
} from '@shared/api.interface';

export async function list(
  params: ChannelListQuery,
): Promise<ChannelListResponse> {
  const response = await axiosForBackend.get('/api/channels', { params });
  return response.data;
}

export async function create(
  data: CreateChannelRequest,
): Promise<Channel> {
  const response = await axiosForBackend.post('/api/channels', data);
  return response.data;
}

export async function update(
  id: string,
  data: UpdateChannelRequest,
): Promise<Channel> {
  const response = await axiosForBackend.patch(`/api/channels/${id}`, data);
  return response.data;
}

export async function remove(id: string): Promise<void> {
  await axiosForBackend.delete(`/api/channels/${id}`);
}

export async function test(id: string): Promise<ChannelTestResult> {
  const response = await axiosForBackend.post(`/api/channels/${id}/test`);
  return response.data;
}
