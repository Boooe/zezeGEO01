import { axiosForBackend } from '@lark-apaas/client-toolkit/utils/getAxiosForBackend';
import type {
  AccountAuth,
  AccountAuthListQuery,
  AccountAuthListResponse,
  AccountAuthCreateRequest,
  AccountAuthUpdateRequest,
  AccountAuthCodeResponse,
  AccountPlatformCard,
  UnifiedAccount,
  UnifiedAccountListResponse,
  UnifiedAccountListResponseV2,
  CreateUnifiedAccountRequest,
  UnifiedAccountAccessType,
  PlatformCapabilitiesResponse,
  AuthorizeCodeResponse,
} from '@shared/api.interface';

export async function list(
  params: AccountAuthListQuery,
): Promise<AccountAuthListResponse> {
  const response = await axiosForBackend.get('/api/account-auths', { params });
  return response.data;
}

export async function create(
  data: AccountAuthCreateRequest,
): Promise<AccountAuth> {
  const response = await axiosForBackend.post('/api/account-auths', data);
  return response.data;
}

export async function update(
  id: string,
  data: AccountAuthUpdateRequest,
): Promise<AccountAuth> {
  const response = await axiosForBackend.patch(`/api/account-auths/${id}`, data);
  return response.data;
}

export async function remove(id: string): Promise<void> {
  await axiosForBackend.delete(`/api/account-auths/${id}`);
}

export async function generateAuthCode(
  id: string,
): Promise<AccountAuthCodeResponse> {
  const response = await axiosForBackend.post(
    `/api/account-auths/${id}/auth-code`,
  );
  return response.data;
}

export async function unbind(id: string): Promise<AccountAuth> {
  const response = await axiosForBackend.post(`/api/account-auths/${id}/unbind`);
  return response.data;
}

export async function getPlatformCards(brandId?: string): Promise<AccountPlatformCard[]> {
  const response = await axiosForBackend.get('/api/account-auths/platform-cards', {
    params: brandId ? { brandId } : {},
  });
  return response.data;
}

/* ---------- 统一账号视图 ---------- */

export interface ListUnifiedAccountsParams {
  brandId?: string;
  accessType?: UnifiedAccountAccessType | '';
  platform?: string;
  status?: string;
  keyword?: string;
  page?: number;
  pageSize?: number;
}

export async function listUnifiedAccounts(
  params: ListUnifiedAccountsParams,
): Promise<UnifiedAccountListResponseV2> {
  const response = await axiosForBackend.get('/api/account-auths/unified', {
    params: {
      ...params,
      accessType: params.accessType || undefined,
    },
  });
  return response.data;
}

export async function getPlatformCapabilities(): Promise<PlatformCapabilitiesResponse> {
  const response = await axiosForBackend.get(
    '/api/account-auths/platform-capabilities',
  );
  return response.data;
}

export async function generateAuthorizeCode(params: {
  platform: string;
  brandId: string;
  authMode: 'oauth' | 'qr' | 'password';
}): Promise<AuthorizeCodeResponse> {
  const response = await axiosForBackend.post(
    '/api/account-auths/authorize-code',
    params,
  );
  return response.data;
}

export async function clearAccountSession(id: string): Promise<{ ok: true }> {
  const response = await axiosForBackend.delete(
    `/api/account-auths/${id}/session`,
  );
  return response.data;
}

export async function getUnifiedPlatformStats(
  params?: { brandId?: string },
): Promise<Array<{ platform: string; total: number; authorized: number }>> {
  const response = await axiosForBackend.get(
    '/api/account-auths/unified/platform-stats',
    { params },
  );
  return response.data;
}

export async function createUnifiedAccount(
  body: CreateUnifiedAccountRequest,
): Promise<{ id: string }> {
  const response = await axiosForBackend.post(
    '/api/account-auths/unified',
    body,
  );
  return response.data;
}
