import { axiosForBackend } from '@lark-apaas/client-toolkit/utils/getAxiosForBackend';
import type {
  LoginRequest,
  LoginResponse,
  CurrentUserResponse,
} from '@shared/api.interface';

export const GEO_TOKEN_STORAGE_KEY = 'geo_session_token';

export function getStoredToken(): string | null {
  try {
    return localStorage.getItem(GEO_TOKEN_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function setStoredToken(token: string): void {
  try {
    localStorage.setItem(GEO_TOKEN_STORAGE_KEY, token);
  } catch {
    // ignore
  }
}

export function clearStoredToken(): void {
  try {
    localStorage.removeItem(GEO_TOKEN_STORAGE_KEY);
  } catch {
    // ignore
  }
}

export async function login(payload: LoginRequest): Promise<LoginResponse> {
  const response = await axiosForBackend.post<LoginResponse>(
    '/api/auth/login',
    payload,
  );
  if (response.data.sessionToken) {
    setStoredToken(response.data.sessionToken);
  }
  return response.data;
}

export async function logout(): Promise<void> {
  try {
    await axiosForBackend.post('/api/auth/logout');
  } finally {
    clearStoredToken();
  }
}

export async function logoutAll(): Promise<{ success: true; revokedCount: number }> {
  const response = await axiosForBackend.post<{ success: true; revokedCount: number }>(
    '/api/auth/logout-all',
  );
  clearStoredToken();
  return response.data;
}

export async function getCurrentUser(): Promise<CurrentUserResponse> {
  try {
    const response = await axiosForBackend.get<CurrentUserResponse>(
      '/api/auth/me',
    );
    if (response.data.renewedToken) {
      setStoredToken(response.data.renewedToken);
    }
    return response.data;
  } catch (error: unknown) {
    const status = (error as { response?: { status: number } })?.response?.status;
    if (status === 401) {
      clearStoredToken();
      return { user: null };
    }
    throw error;
  }
}
