import React from 'react';
import { Navigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';

import { useAuth } from '@client/src/hooks/useAuth';
import { checkNeedsSign } from '@client/src/api/commitment';
import { Skeleton } from '@client/src/components/ui/skeleton';

interface CommitmentGuardProps {
  children: React.ReactNode;
}

const CommitmentGuard: React.FC<CommitmentGuardProps> = ({ children }) => {
  const { user } = useAuth();

  const { data, isLoading } = useQuery({
    queryKey: ['commitment', 'check'],
    queryFn: () => checkNeedsSign(),
    retry: 1,
    staleTime: 60 * 1000,
    refetchOnWindowFocus: false,
    enabled: user?.role === 'client',
  });

  if (user?.role !== 'client') {
    return <>{children}</>;
  }

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

  if (data?.needsSign) {
    return <Navigate to="/commitment" replace />;
  }

  return <>{children}</>;
};

export default CommitmentGuard;
