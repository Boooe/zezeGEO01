import { axiosForBackend } from '@lark-apaas/client-toolkit/utils/getAxiosForBackend';
import type {
  PublishRecord,
  PublishStatus,
  PagedResponse,
  AutoPublishTask,
  AutoPublishStatus,
  AutoPublishLibrary,
  CreateAutoPublishTaskRequest,
  UpdateAutoPublishTaskRequest,
} from '@shared/api.interface';

/* ---------------- 发布记录 ---------------- */

export interface GetPublishRecordsParams {
  page?: number;
  pageSize?: number;
  contentType?: string;
  status?: PublishStatus | '';
  platform?: string;
  keyword?: string;
  brandId?: string;
}

export async function getPublishRecords(
  params: GetPublishRecordsParams,
): Promise<PagedResponse<PublishRecord>> {
  const response = await axiosForBackend.get('/api/publish/records', {
    params,
  });
  return response.data;
}

export async function getPublishRecordDetail(
  id: string,
): Promise<PublishRecord> {
  const response = await axiosForBackend.get(`/api/publish/records/${id}`);
  return response.data;
}

export interface CreatePublishRecordRequest {
  brandId: string;
  taskId?: string;
  contentType: string;
  title?: string;
  externalUrl?: string;
  platform?: string;
  status?: PublishStatus;
  publishDate?: string;
  notes?: string;
}

export async function createPublishRecord(
  body: CreatePublishRecordRequest,
): Promise<PublishRecord> {
  const response = await axiosForBackend.post('/api/publish/records', body);
  return response.data;
}

export interface UpdatePublishRecordRequest {
  brandId?: string;
  taskId?: string | null;
  contentType?: string;
  title?: string | null;
  externalUrl?: string | null;
  platform?: string | null;
  status?: PublishStatus;
  publishDate?: string | null;
  notes?: string | null;
}

export async function updatePublishRecord(
  id: string,
  body: UpdatePublishRecordRequest,
): Promise<PublishRecord> {
  const response = await axiosForBackend.patch(
    `/api/publish/records/${id}`,
    body,
  );
  return response.data;
}

export async function deletePublishRecord(id: string): Promise<void> {
  await axiosForBackend.delete(`/api/publish/records/${id}`);
}

export async function recyclePublishRecord(id: string): Promise<void> {
  await axiosForBackend.post(`/api/publish/records/${id}/recycle`);
}

export async function getPublishRecordsByTask(
  taskId: string,
): Promise<PublishRecord[]> {
  const response = await axiosForBackend.get(
    `/api/publish/records/by-task/${taskId}`,
  );
  return response.data;
}

/* ---------------- 自动发布任务 ---------------- */

export interface GetAutoPublishTasksParams {
  page?: number;
  pageSize?: number;
  brandId?: string;
  libraryType?: AutoPublishLibrary;
  status?: AutoPublishStatus | '';
  keyword?: string;
}

export async function getAutoPublishTasks(
  params: GetAutoPublishTasksParams,
): Promise<PagedResponse<AutoPublishTask>> {
  const response = await axiosForBackend.get('/api/publication/auto-publish', {
    params,
  });
  return response.data;
}

export async function getAutoPublishTask(
  id: string,
): Promise<AutoPublishTask> {
  const response = await axiosForBackend.get(`/api/publication/auto-publish/${id}`);
  return response.data;
}

export async function createAutoPublishTask(
  body: CreateAutoPublishTaskRequest,
): Promise<AutoPublishTask> {
  const response = await axiosForBackend.post(
    '/api/publication/auto-publish',
    body,
  );
  return response.data;
}

export async function updateAutoPublishTask(
  id: string,
  body: UpdateAutoPublishTaskRequest,
): Promise<AutoPublishTask> {
  const response = await axiosForBackend.patch(
    `/api/publication/auto-publish/${id}`,
    body,
  );
  return response.data;
}

export async function deleteAutoPublishTask(id: string): Promise<void> {
  await axiosForBackend.delete(`/api/publication/auto-publish/${id}`);
}

export async function toggleAutoPublishTaskStatus(
  id: string,
  status: AutoPublishStatus,
): Promise<AutoPublishTask> {
  const response = await axiosForBackend.patch(
    `/api/publication/auto-publish/${id}/status`,
    { status },
  );
  return response.data;
}
