import { axiosForBackend } from '@lark-apaas/client-toolkit/utils/getAxiosForBackend';
import { getStoredToken, setStoredToken, clearStoredToken } from './auth';

const CSRF_COOKIE_NAME = 'suda-csrf-token';
const CSRF_HEADER_NAME = 'X-Suda-Csrf-Token';
const SESSION_RENEWED_HEADER = 'x-session-renewed';
const GEO_COOKIE_NAME = 'geo_session_id';

function generateToken(): string {
  const arr = new Uint8Array(32);
  crypto.getRandomValues(arr);
  return Array.from(arr, (b: number) => b.toString(16).padStart(2, '0')).join('');
}

function getCsrfToken(): string {
  const match = document.cookie.match(
    new RegExp(`(?:^|;\\s*)${CSRF_COOKIE_NAME}=([^;]+)`),
  );
  return match ? decodeURIComponent(match[1]) : '';
}

function setCsrfCookie(token: string): void {
  document.cookie = `${CSRF_COOKIE_NAME}=${token}; Path=/; Max-Age=2592000; SameSite=Lax`;
}

function ensureCsrfToken(): string {
  let token = getCsrfToken();
  if (!token) {
    token = generateToken();
    setCsrfCookie(token);
  }
  return token;
}

function hasGeoCookie(): boolean {
  return document.cookie
    .split(';')
    .some((c) => c.trim().startsWith(`${GEO_COOKIE_NAME}=`));
}

ensureCsrfToken();

axiosForBackend.interceptors.request.use((config) => {
  const csrfToken = getCsrfToken();
  if (csrfToken) {
    config.headers[CSRF_HEADER_NAME] = csrfToken;
  }

  if (!hasGeoCookie()) {
    const storedToken = getStoredToken();
    if (storedToken && config.headers) {
      config.headers['Authorization'] = `Bearer ${storedToken}`;
    }
  }

  return config;
});

let navigateFn: ((path: string) => void) | null = null;

export function setNavigate(fn: (path: string) => void): void {
  navigateFn = fn;
}

axiosForBackend.interceptors.response.use(
  (response) => {
    const renewedToken = response.headers?.[SESSION_RENEWED_HEADER];
    if (renewedToken && typeof renewedToken === 'string') {
      setStoredToken(renewedToken);
    }
    return response;
  },
  (error) => {
    const status = error?.response?.status;
    const headers = error?.response?.headers;

    if (status === 401) {
      const requestUrl = error?.config?.url ?? '';
      if (requestUrl.includes('/api/auth/me')) {
        clearStoredToken();
        return Promise.reject(error);
      }

      clearStoredToken();

      const isExpired =
        headers?.['x-session-expired'] === 'true' ||
        headers?.['X-Session-Expired'] === 'true';
      const target = isExpired ? '/login?expired=1' : '/login';

      if (navigateFn) {
        navigateFn(target);
      }
    }

    return Promise.reject(error);
  },
);
