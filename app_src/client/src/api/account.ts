import { axiosForBackend } from '@lark-apaas/client-toolkit/utils/getAxiosForBackend';
import type {
  AccountProfile,
  UpdateAccountProfileRequest,
  ChangePasswordRequest,
} from '@shared/api.interface';

export async function getAccountProfile(): Promise<AccountProfile | null> {
  const response = await axiosForBackend.get<{ profile: AccountProfile | null }>(
    '/api/account/profile',
  );
  return response.data.profile;
}

export async function updateAccountProfile(
  body: UpdateAccountProfileRequest,
): Promise<AccountProfile> {
  const response = await axiosForBackend.put<{ profile: AccountProfile }>(
    '/api/account/profile',
    body,
  );
  return response.data.profile;
}

export async function changePassword(
  body: ChangePasswordRequest,
): Promise<{ success: boolean }> {
  const response = await axiosForBackend.post('/api/account/password', body);
  return response.data;
}
