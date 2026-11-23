import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';

import { useAuth } from '@client/src/hooks/useAuth';
import { Skeleton } from '@client/src/components/ui/skeleton';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

/**
 * 路由守卫：未登录时跳转到登录页，加载中显示骨架。
 *
 * 使用方式：
 * <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
 *   ...受保护路由
 * </Route>
 */
const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { user, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="w-full max-w-md space-y-3 p-6">
          <Skeleton className="h-8 w-2/3" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
          <Skeleton className="h-4 w-4/6" />
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <Navigate to="/login" state={{ from: location.pathname }} replace />
    );
  }

  return <>{children}</>;
};

export default ProtectedRoute;
