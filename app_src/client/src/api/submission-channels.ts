import { axiosForBackend } from '@lark-apaas/client-toolkit/utils/getAxiosForBackend';
import type {
  SubmissionChannel,
  SubmissionChannelQuery,
  SubmissionChannelListResponse,
  CreateSubmissionChannelRequest,
  UpdateSubmissionChannelRequest,
  SubmissionChannelStats,
  SubmissionChannelImportPreview,
  SubmissionChannelImportConfirmResponse,
  EliminationScanResult,
  EliminationAction,
  BatchTagRequest,
  BatchTagResponse,
  SourceTagLog,
  SourceTagLogListResponse,
  BatchSheetQuery,
  BatchSheetResponse,
  AutoSelectChannelsRequest,
  AutoSelectChannelsResult,
  SubmissionUrlStats,
  BatchUrlPatchRequest,
  BatchUrlPatchResult,
  SourceUrlLogListResponse,
  UpdateChannelPriceRequest,
  UpdateChannelPriceResponse,
  BulkChannelPriceRequest,
  BulkChannelPriceResponse,
} from '@shared/api.interface';

export async function list(
  params: SubmissionChannelQuery,
): Promise<SubmissionChannelListResponse> {
  const response = await axiosForBackend.get('/api/submission-channels', {
    params,
  });
  return response.data;
}

export async function create(
  data: CreateSubmissionChannelRequest,
): Promise<SubmissionChannel> {
  const response = await axiosForBackend.post(
    '/api/submission-channels',
    data,
  );
  return response.data;
}

export async function update(
  id: string,
  data: UpdateSubmissionChannelRequest,
): Promise<SubmissionChannel> {
  const response = await axiosForBackend.patch(
    `/api/submission-channels/${id}`,
    data,
  );
  return response.data;
}

export async function remove(id: string): Promise<void> {
  await axiosForBackend.delete(`/api/submission-channels/${id}`);
}

export async function updateSubmitUrl(
  id: string,
  submitUrl: string,
): Promise<SubmissionChannel> {
  const response = await axiosForBackend.patch(
    `/api/submission-channels/${id}/submit-url`,
    { submitUrl },
  );
  return response.data;
}

export async function seed(brandId?: string): Promise<{ inserted: number }> {
  const { data } = await axiosForBackend.post(
    '/api/submission-channels/seed',
    { brandId },
  );
  return data;
}

export async function stats(params: SubmissionChannelQuery): Promise<SubmissionChannelStats> {
  const { data } = await axiosForBackend.get(
    '/api/submission-channels/stats',
    { params },
  );
  return data;
}

export async function eliminationScan(): Promise<EliminationScanResult> {
  const { data } = await axiosForBackend.get(
    '/api/submission-channels/elimination/scan',
  );
  return data;
}

export async function eliminationBatch(
  ids: string[],
  action: EliminationAction,
): Promise<{ updated: number }> {
  const { data } = await axiosForBackend.post(
    '/api/submission-channels/elimination/batch',
    { ids, action },
  );
  return data;
}

export async function importPreview(params: {
  brandId?: string;
  csvContent: string;
}): Promise<SubmissionChannelImportPreview> {
  const { data } = await axiosForBackend.post(
    '/api/submission-channels/import/preview',
    params,
  );
  return data;
}

export async function importConfirm(params: {
  brandId?: string;
  csvContent: string;
  importToken?: string;
}): Promise<SubmissionChannelImportConfirmResponse> {
  const { data } = await axiosForBackend.post(
    '/api/submission-channels/import/confirm',
    params,
  );
  return data;
}

export async function batchUpdateTags(
  data: BatchTagRequest,
): Promise<BatchTagResponse> {
  const { data: result } = await axiosForBackend.patch(
    '/api/submission-channels/batch-tags',
    data,
  );
  return result;
}

export async function listTagLogs(): Promise<SourceTagLogListResponse> {
  const { data } = await axiosForBackend.get(
    '/api/submission-channels/tag-logs',
  );
  return data;
}

export async function getBatchSheet(
  params: BatchSheetQuery,
): Promise<BatchSheetResponse> {
  const { data } = await axiosForBackend.get(
    '/api/submission-channels/batch-sheet',
    { params },
  );
  return data;
}

export async function exportBatchSheet(
  params: BatchSheetQuery,
): Promise<void> {
  const response = await axiosForBackend.get(
    '/api/submission-channels/batch-sheet/export',
    { params, responseType: 'blob' },
  );
  const blob = new Blob([response.data], {
    type: 'text/csv;charset=utf-8;',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `批次清单_${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export async function autoSelectChannels(
  body: AutoSelectChannelsRequest,
): Promise<AutoSelectChannelsResult> {
  const { data } = await axiosForBackend.post(
    '/api/submission-channels/auto-select',
    body,
  );
  return data;
}

export async function getUrlStats(
  params: SubmissionChannelQuery,
): Promise<SubmissionUrlStats> {
  const { data } = await axiosForBackend.get(
    '/api/submission-channels/url-stats',
    { params },
  );
  return data;
}

export async function batchUrlPatch(
  body: BatchUrlPatchRequest,
): Promise<BatchUrlPatchResult> {
  const { data } = await axiosForBackend.post(
    '/api/submission-channels/batch-url-patch',
    body,
  );
  return data;
}

export async function listUrlLogs(): Promise<SourceUrlLogListResponse> {
  const { data } = await axiosForBackend.get(
    '/api/submission-channels/url-logs',
  );
  return data;
}

export async function fillUrlsFromMap(): Promise<{ matched: number; unmatched: number }> {
  const { data } = await axiosForBackend.post(
    '/api/submission-channels/fill-urls-from-map',
  );
  return data;
}

export async function exportUnmatched(
  params: SubmissionChannelQuery,
): Promise<void> {
  const response = await axiosForBackend.get(
    '/api/submission-channels/unmatched-export',
    { params, responseType: 'blob' },
  );
  const blob = new Blob([response.data], {
    type: 'text/csv;charset=utf-8;',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `未匹配渠道清单_${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export async function getChannel(id: string): Promise<SubmissionChannel> {
  const { data } = await axiosForBackend.get(`/api/submission-channels/${id}`);
  return data;
}

export async function updatePrice(
  id: string,
  data: UpdateChannelPriceRequest,
): Promise<UpdateChannelPriceResponse> {
  const { data: result } = await axiosForBackend.patch(
    `/api/submission-channels/${id}/price`,
    data,
  );
  return result;
}

export async function bulkUpdatePrice(
  data: BulkChannelPriceRequest,
): Promise<BulkChannelPriceResponse> {
  const { data: result } = await axiosForBackend.post(
    '/api/submission-channels/bulk-price',
    data,
  );
  return result;
}
