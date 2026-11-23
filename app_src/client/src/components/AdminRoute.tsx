import React from 'react';
import { ShieldAlert } from 'lucide-react';

import { useAuth } from '@client/src/contexts/AuthContext';
import { Skeleton } from '@client/src/components/ui/skeleton';

interface AdminRouteProps {
  children: React.ReactNode;
}

const AdminRoute: React.FC<AdminRouteProps> = ({ children }) => {
  const { user, isLoading, hasRole } = useAuth();

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="w-full max-w-md space-y-3 p-6">
          <Skeleton className="h-8 w-2/3" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  const isAdmin = hasRole('admin');
  const isOperator = hasRole('operator');

  if (!isAdmin && !isOperator) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="flex flex-col items-center gap-4 rounded-xl border border-slate-200 bg-white p-10 text-center shadow-sm">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-amber-50">
            <ShieldAlert className="h-7 w-7 text-amber-500" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-slate-800">
              权限不足
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              当前账号没有该模块的访问权限，请联系服务商开通。
            </p>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

export default AdminRoute;
