import { axiosForBackend } from '@lark-apaas/client-toolkit/utils/getAxiosForBackend';
import type {
  CommitmentVersion,
  CommitmentSignatureWithStatus,
  CommitmentSignature,
  CommitmentCheckResponse,
  PagedResponse,
} from '@shared/api.interface';

export function getActiveVersion(): Promise<CommitmentVersion> {
  return axiosForBackend
    .get('/api/commitment/active')
    .then((r) => r.data);
}

export function checkNeedsSign(): Promise<CommitmentCheckResponse> {
  return axiosForBackend
    .get('/api/commitment/check')
    .then((r) => r.data);
}

export function signCommitment(): Promise<CommitmentSignature> {
  return axiosForBackend
    .post('/api/commitment/sign')
    .then((r) => r.data);
}

export interface SignatureListParams {
  page?: number;
  pageSize?: number;
  status?: string;
  versionId?: string;
  keyword?: string;
}

export function listVersions(): Promise<CommitmentVersion[]> {
  return axiosForBackend
    .get('/api/commitment/versions')
    .then((r) => r.data);
}

export function createVersion(content: string): Promise<CommitmentVersion> {
  return axiosForBackend
    .post('/api/commitment/versions', { content })
    .then((r) => r.data);
}

export function activateVersion(id: string): Promise<CommitmentVersion> {
  return axiosForBackend
    .post(`/api/commitment/versions/${id}/activate`)
    .then((r) => r.data);
}

export function listSignatures(
  params: SignatureListParams,
): Promise<PagedResponse<CommitmentSignatureWithStatus>> {
  return axiosForBackend
    .get('/api/commitment/signatures', { params })
    .then((r) => r.data);
}

export function getSignatureDetail(
  id: string,
): Promise<CommitmentSignature & { content: string }> {
  return axiosForBackend
    .get(`/api/commitment/signatures/${id}`)
    .then((r) => r.data);
}

export function requireResign(userId: string): Promise<void> {
  return axiosForBackend
    .post(`/api/commitment/signatures/${userId}/require-resign`)
    .then(() => undefined);
}

export function remindSign(userId: string): Promise<void> {
  return axiosForBackend
    .post(`/api/commitment/signatures/${userId}/remind`)
    .then(() => undefined);
}

export function exportSignaturesCsv(params: {
  status?: string;
  versionId?: string;
  keyword?: string;
}): string {
  const search = new URLSearchParams();
  if (params.status) search.set('status', params.status);
  if (params.versionId) search.set('versionId', params.versionId);
  if (params.keyword) search.set('keyword', params.keyword);
  const qs = search.toString();
  return `/api/commitment/signatures/export${qs ? `?${qs}` : ''}`;
}
