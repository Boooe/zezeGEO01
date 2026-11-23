import { axiosForBackend } from '@lark-apaas/client-toolkit/utils/getAxiosForBackend';
import type {
  AiKeyListResponse,
  AiKeyUpsertRequest,
  AiTestResponse,
  SetDefaultRequest,
  CreditRequestCreateRequest,
  CreditRequestItem,
  CreditRequestListResponse,
} from '@shared/api.interface';

export async function listKeys(brandId?: string): Promise<AiKeyListResponse> {
  const response = await axiosForBackend.get('/api/ai-keys', {
    params: brandId ? { brandId } : undefined,
  });
  return response.data;
}

export async function upsertKey(
  vendor: string,
  data: AiKeyUpsertRequest,
  brandId?: string,
): Promise<AiKeyListResponse> {
  const response = await axiosForBackend.put(`/api/ai-keys/${vendor}`, data, {
    params: brandId ? { brandId } : undefined,
  });
  return response.data;
}

export async function deleteKey(vendor: string, brandId?: string): Promise<AiKeyListResponse> {
  const response = await axiosForBackend.delete(`/api/ai-keys/${vendor}`, {
    params: brandId ? { brandId } : undefined,
  });
  return response.data;
}

export async function testKey(vendor: string, brandId?: string): Promise<AiTestResponse> {
  const response = await axiosForBackend.post(`/api/ai-keys/${vendor}/test`, undefined, {
    params: brandId ? { brandId } : undefined,
  });
  return response.data;
}

export async function setDefault(
  data: SetDefaultRequest,
  brandId?: string,
): Promise<AiKeyListResponse> {
  const response = await axiosForBackend.post('/api/ai-keys/default', data, {
    params: brandId ? { brandId } : undefined,
  });
  return response.data;
}

export async function createCreditRequest(
  data: CreditRequestCreateRequest,
): Promise<CreditRequestItem> {
  const response = await axiosForBackend.post('/api/credit-requests', data);
  return response.data;
}

export async function listCreditRequests(params?: {
  status?: string;
  page?: number;
  pageSize?: number;
}): Promise<CreditRequestListResponse> {
  const response = await axiosForBackend.get('/api/credit-requests', {
    params: params || {},
  });
  return response.data;
}

export async function approveCreditRequest(
  id: number,
): Promise<CreditRequestItem> {
  const response = await axiosForBackend.post(
    `/api/credit-requests/${id}/approve`,
  );
  return response.data;
}

export async function rejectCreditRequest(
  id: number,
  reason?: string,
): Promise<CreditRequestItem> {
  const response = await axiosForBackend.post(
    `/api/credit-requests/${id}/reject`,
    { reason },
  );
  return response.data;
}
