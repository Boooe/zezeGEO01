import { axiosForBackend } from '@lark-apaas/client-toolkit/utils/getAxiosForBackend';
import type {
  PublishQueueItem,
  PublishQueueQuery,
  PublishQueueListResponse,
  EnqueuePublishRequest,
  MarkPublishedRequest,
  PendingPublishTask,
  PublishLedgerQuery,
  PublishLedgerResponse,
  PublishLedgerDetailResponse,
  LedgerAccountDetailResponse,
  UnifiedAccountOption,
} from '@shared/api.interface';

export async function list(
  params: PublishQueueQuery,
): Promise<PublishQueueListResponse> {
  const response = await axiosForBackend.get('/api/publish-queue', { params });
  return response.data;
}

export async function enqueue(
  data: EnqueuePublishRequest,
): Promise<PublishQueueItem> {
  const response = await axiosForBackend.post('/api/publish-queue', data);
  return response.data;
}

export async function retry(id: string): Promise<PublishQueueItem> {
  const response = await axiosForBackend.post(
    `/api/publish-queue/${id}/retry`,
  );
  return response.data;
}

export async function markManual(id: string): Promise<PublishQueueItem> {
  const response = await axiosForBackend.post(
    `/api/publish-queue/${id}/mark-manual`,
  );
  return response.data;
}

export async function rescheduleDispatch(id: string): Promise<PublishQueueItem> {
  const response = await axiosForBackend.post(
    `/api/publish-queue/dispatch/${id}/reschedule`,
  );
  return response.data;
}

export async function remove(id: string): Promise<{ ok: true }> {
  const response = await axiosForBackend.delete(`/api/publish-queue/${id}`);
  return response.data;
}

export async function markPublished(
  id: string,
  data: MarkPublishedRequest,
): Promise<PublishQueueItem> {
  const response = await axiosForBackend.post(
    `/api/publish-queue/${id}/mark-published`,
    data,
  );
  return response.data;
}

export async function pending(): Promise<PendingPublishTask[]> {
  const response = await axiosForBackend.get('/api/publish-queue/pending');
  return response.data;
}

export async function getLedger(
  params: PublishLedgerQuery,
): Promise<PublishLedgerResponse> {
  const response = await axiosForBackend.get('/api/publish-queue/ledger', { params });
  return response.data;
}

export async function getLedgerDetail(
  channelId: string,
  params: PublishLedgerQuery = {},
): Promise<PublishLedgerDetailResponse> {
  const response = await axiosForBackend.get(`/api/publish-queue/ledger/${channelId}/detail`, { params });
  return response.data;
}

export async function getLedgerAccounts(
  channelId: string,
  params: PublishLedgerQuery = {},
): Promise<LedgerAccountDetailResponse> {
  const response = await axiosForBackend.get(`/api/publish-queue/ledger/${channelId}/accounts`, { params });
  return response.data;
}

export async function listPublishAccounts(
  brandId?: string,
): Promise<UnifiedAccountOption[]> {
  const response = await axiosForBackend.get('/api/publish-queue/accounts', {
    params: brandId ? { brandId } : {},
  });
  return response.data;
}
