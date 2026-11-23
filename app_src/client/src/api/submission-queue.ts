import { axiosForBackend } from '@lark-apaas/client-toolkit/utils/getAxiosForBackend';
import type {
  SubmissionQueueItem,
  SubmissionQueueQuery,
  SubmissionQueueListResponse,
  EnqueueSubmissionRequest,
  SubmissionStatusUpdateRequest,
  SubmissionResultRequest,
  PendingSubmissionTask,
  SubmissionChannel,
  SubmissionChannelListResponse,
} from '@shared/api.interface';

/* ---------------- 投稿队列 ---------------- */

export async function list(
  params: SubmissionQueueQuery,
): Promise<SubmissionQueueListResponse> {
  const response = await axiosForBackend.get('/api/submission-queue', {
    params,
  });
  return response.data;
}

export async function enqueue(
  data: EnqueueSubmissionRequest,
): Promise<SubmissionQueueItem> {
  const response = await axiosForBackend.post('/api/submission-queue', data);
  return response.data;
}

export async function updateStatus(
  id: string,
  data: SubmissionStatusUpdateRequest,
): Promise<SubmissionQueueItem> {
  const response = await axiosForBackend.post(
    `/api/submission-queue/${id}/status`,
    data,
  );
  return response.data;
}

export async function remove(id: string): Promise<void> {
  await axiosForBackend.delete(`/api/submission-queue/${id}`);
}

export async function getPending(
  limit?: number,
): Promise<PendingSubmissionTask[]> {
  const response = await axiosForBackend.get('/api/submission-queue/pending', {
    params: limit ? { limit } : undefined,
  });
  return response.data;
}

export async function submitResult(
  id: string,
  data: SubmissionResultRequest,
): Promise<SubmissionQueueItem> {
  const response = await axiosForBackend.post(
    `/api/submission-queue/${id}/result`,
    data,
  );
  return response.data;
}

export async function markPublished(
  id: string,
  data: {
    publishUrl: string;
    publishedAt: string;
    remark?: string;
  },
): Promise<SubmissionQueueItem> {
  const response = await axiosForBackend.post(
    `/api/submission-queue/${id}/mark-published`,
    data,
  );
  return response.data;
}

/* ---------------- 投稿渠道（用于页面筛选与选稿弹窗） ---------------- */

export async function getChannels(params?: {
  brandId?: string;
  status?: string;
  limit?: number;
}): Promise<SubmissionChannelListResponse> {
  const response = await axiosForBackend.get('/api/submission-channels', {
    params,
  });
  return response.data;
}

export async function listAllChannels(
  brandId?: string,
): Promise<SubmissionChannel[]> {
  const response = await axiosForBackend.get('/api/submission-channels', {
    params: { brandId, limit: 100 },
  });
  return response.data.items;
}
