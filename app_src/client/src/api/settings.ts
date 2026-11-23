import { axiosForBackend } from '@lark-apaas/client-toolkit/utils/getAxiosForBackend';
import type { AutoToken, GeoUser } from '@shared/api.interface';

/** 获取当前用户资料 */
export async function getProfile(): Promise<{ user: GeoUser }> {
  const response = await axiosForBackend.get('/api/settings/profile');
  return response.data;
}

/** 更新用户资料 */
export async function updateProfile(body: {
  displayName: string;
}): Promise<{ user: GeoUser }> {
  const response = await axiosForBackend.patch('/api/settings/profile', body);
  return response.data;
}

/** 修改密码 */
export async function changePassword(body: {
  oldPassword: string;
  newPassword: string;
}): Promise<void> {
  await axiosForBackend.post('/api/settings/password', body);
}

/** 获取自动化令牌列表 */
export async function getTokens(): Promise<AutoToken[]> {
  const response = await axiosForBackend.get('/api/settings/tokens');
  return response.data;
}

/** 创建新令牌，返回明文 token */
export async function createToken(body: {
  name: string;
}): Promise<AutoToken & { token: string }> {
  const response = await axiosForBackend.post('/api/settings/tokens', body);
  return response.data;
}

/** 编辑令牌名称 */
export async function updateTokenName(
  id: string,
  body: { name: string },
): Promise<AutoToken> {
  const response = await axiosForBackend.patch(
    `/api/settings/tokens/${id}`,
    body,
  );
  return response.data;
}

/** 重置令牌，返回新 token */
export async function resetToken(
  id: string,
): Promise<AutoToken & { token: string }> {
  const response = await axiosForBackend.post(
    `/api/settings/tokens/${id}/reset`,
  );
  return response.data;
}

/** 删除令牌 */
export async function deleteToken(id: string): Promise<void> {
  await axiosForBackend.delete(`/api/settings/tokens/${id}`);
}
