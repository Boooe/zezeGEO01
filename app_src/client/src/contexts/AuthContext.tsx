import React, { createContext, useCallback, useContext, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { logger } from '@lark-apaas/client-toolkit/logger';

import { getCurrentUser, login, logout, logoutAll } from '@client/src/api/auth';
import { setNavigate } from '@client/src/api/request';
import type { GeoUser, LoginRequest } from '@shared/api.interface';

// 确保拦截器模块被加载
import '@client/src/api/request';

interface AuthContextValue {
  user: GeoUser | null;
  isLoading: boolean;
  isError: boolean;
  login: (payload: LoginRequest) => Promise<GeoUser>;
  logout: () => Promise<void>;
  logoutAll: () => Promise<number>;
  hasRole: (role: string) => boolean;
  hasPermission: (perm: string) => boolean;
  refetch: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const queryKey = ['auth', 'currentUser'];

export const AuthContextProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  // 注入 navigate 到 axios 拦截器，用于 401 时跳转登录页
  useEffect(() => {
    setNavigate(navigate);
  }, [navigate]);

  const {
    data,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey,
    queryFn: () => getCurrentUser(),
    // 登录态由 Cookie 维护，刷新页面时静默拉取
    staleTime: Infinity,
    // 401 时不重抛到全局错误边界，由拦截器处理跳转
    retry: false,
    refetchOnWindowFocus: false,
  });

  const user = data?.user ?? null;

  const loginMutation = useMutation({
    mutationFn: (payload: LoginRequest) => login(payload),
    retry: false,
    onSuccess: (result) => {
      queryClient.setQueryData(queryKey, result);
    },
    onError: (err) => {
      logger.error('登录失败', err);
    },
  });

  const logoutMutation = useMutation({
    mutationFn: () => logout(),
    retry: false,
    onSettled: () => {
      queryClient.setQueryData(queryKey, { user: null });
      queryClient.clear();
      navigate('/login');
    },
  });

  const logoutAllMutation = useMutation({
    mutationFn: () => logoutAll(),
    retry: false,
    onSettled: () => {
      queryClient.setQueryData(queryKey, { user: null });
      queryClient.clear();
      navigate('/login');
    },
  });

  const handleLogin = useCallback(
    async (payload: LoginRequest): Promise<GeoUser> => {
      const result = await loginMutation.mutateAsync(payload);
      return result.user;
    },
    [loginMutation],
  );

  const handleLogout = useCallback(async (): Promise<void> => {
    await logoutMutation.mutateAsync();
  }, [logoutMutation]);

  const handleLogoutAll = useCallback(async (): Promise<number> => {
    const result = await logoutAllMutation.mutateAsync();
    return result.revokedCount;
  }, [logoutAllMutation]);

  const hasRole = useCallback(
    (role: string): boolean => {
      if (!user) return false;
      return user.role === role;
    },
    [user],
  );

  const hasPermission = useCallback(
    (perm: string): boolean => {
      if (!user) return false;
      if (user.role === 'admin') return true;
      return Array.isArray(user.permissions) && user.permissions.includes(perm);
    },
    [user],
  );

  const value: AuthContextValue = {
    user,
    isLoading,
    isError,
    login: handleLogin,
    logout: handleLogout,
    logoutAll: handleLogoutAll,
    hasRole,
    hasPermission,
    refetch: () => refetch(),
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within AuthContextProvider');
  }
  return ctx;
}
