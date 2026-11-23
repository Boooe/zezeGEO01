import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { AlertCircle, Loader2 } from 'lucide-react';

import { Button } from '@client/src/components/ui/button';
import { Card } from '@client/src/components/ui/card';
import { Checkbox } from '@client/src/components/ui/checkbox';
import { Skeleton } from '@client/src/components/ui/skeleton';
import {
  Empty,
  EmptyHeader,
  EmptyTitle,
  EmptyDescription,
  EmptyMedia,
} from '@client/src/components/ui/empty';
import { useAuth } from '@client/src/hooks/useAuth';
import { getApiErrorMessage } from '@client/src/lib/api-error';
import {
  getActiveVersion,
  signCommitment,
} from '@client/src/api/commitment';

const CommitmentPage: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { logout } = useAuth();

  const scrollRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const [canCheck, setCanCheck] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [showScrollHint, setShowScrollHint] = useState(true);

  const {
    data: version,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['commitment', 'active'],
    queryFn: () => getActiveVersion(),
    retry: 1,
    staleTime: 5 * 60 * 1000,
  });

  const signMutation = useMutation({
    mutationFn: () => signCommitment(),
    retry: false,
    onSuccess: () => {
      toast.success('承诺书签署成功');
      queryClient.setQueryData(['commitment', 'check'], { needsSign: false });
      navigate('/', { replace: true });
    },
    onError: (err) => {
      toast.error(getApiErrorMessage(err, '签署失败，请稍后重试'));
    },
  });

  useEffect(() => {
    const scrollEl = scrollRef.current;
    const sentinelEl = sentinelRef.current;
    if (!scrollEl || !sentinelEl) return;

    if (scrollEl.scrollHeight <= scrollEl.clientHeight + 5) {
      setCanCheck(true);
      setShowScrollHint(false);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setCanCheck(true);
            setShowScrollHint(false);
            observer.disconnect();
            break;
          }
        }
      },
      { root: scrollEl, threshold: 0.1 },
    );

    observer.observe(sentinelEl);
    return () => observer.disconnect();
  }, [version?.content]);

  const handleSign = useCallback(() => {
    if (!agreed || signMutation.isPending) return;
    signMutation.mutate();
  }, [agreed, signMutation]);

  const handleLogout = useCallback(() => {
    logout();
  }, [logout]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f8fafc] p-6">
        <Card className="w-full max-w-2xl p-6">
          <div className="mb-4 flex justify-center">
            <Skeleton className="h-6 w-64" />
          </div>
          <Skeleton className="mb-3 h-4 w-full" />
          <Skeleton className="mb-3 h-4 w-11/12" />
          <Skeleton className="mb-3 h-4 w-10/12" />
          <Skeleton className="mb-3 h-4 w-11/12" />
          <Skeleton className="mb-3 h-4 w-9/12" />
          <Skeleton className="h-4 w-10/12" />
        </Card>
      </div>
    );
  }

  if (isError || !version) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f8fafc] p-6">
        <Card className="w-full max-w-2xl p-6">
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <AlertCircle size={24} />
              </EmptyMedia>
              <EmptyTitle>加载失败</EmptyTitle>
              <EmptyDescription>
                承诺书内容加载失败，请检查网络后重试
              </EmptyDescription>
            </EmptyHeader>
            <Button onClick={() => refetch()}>重新加载</Button>
          </Empty>
        </Card>
      </div>
    );
  }

  const paragraphs = version.content.split(/\r?\n/).filter((p) => p.trim());

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f8fafc] p-6">
      <div className="w-full max-w-2xl">
        <Card className="shadow-md">
          <div className="border-b border-border p-6 text-center">
            <h1
              className="text-[18px] font-semibold text-[#0f172a]"
              style={{ fontWeight: 600 }}
            >
              《客户信息真实性承诺书》
            </h1>
          </div>

          <div className="relative p-6">
            <div
              ref={scrollRef}
              className="max-h-[60vh] overflow-y-auto rounded-lg border border-border p-6 text-[14px] leading-relaxed text-[#334155]"
            >
              {paragraphs.map((line: string, idx: number) => (
                <p key={idx} className="mb-4 last:mb-0">
                  {line}
                </p>
              ))}
              <div ref={sentinelRef} className="h-px w-full" />
            </div>

            {!canCheck && showScrollHint && (
              <div className="pointer-events-none absolute bottom-6 left-6 right-6 flex justify-center pb-2">
                <span className="rounded-full bg-black/60 px-4 py-1.5 text-xs text-white">
                  请滚动阅读全文后勾选
                </span>
              </div>
            )}
          </div>

          <div className="space-y-4 p-6 pt-0">
            <label className="flex cursor-pointer items-start gap-3">
              <Checkbox
                disabled={!canCheck}
                checked={agreed}
                onCheckedChange={(checked) => setAgreed(checked === true)}
                className="mt-0.5"
                id="agree-checkbox"
              />
              <span
                className={`text-sm ${
                  canCheck ? 'text-[#334155]' : 'text-[#94a3b8]'
                }`}
              >
                我已阅读并同意上述全部条款
              </span>
            </label>

            <div className="flex flex-col items-center gap-3 pt-2">
              <Button
                onClick={handleSign}
                disabled={!agreed || signMutation.isPending}
                className="w-full bg-[#1e40af] hover:bg-[#1d4ed8]"
                size="lg"
              >
                {signMutation.isPending && (
                  <Loader2 className="animate-spin" size={16} />
                )}
                {signMutation.isPending ? '签署中...' : '确认并继续'}
              </Button>
              <Button
                variant="ghost"
                onClick={handleLogout}
                className="text-[#64748b] hover:text-[#334155]"
                disabled={signMutation.isPending}
              >
                暂不确认，退出登录
              </Button>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default CommitmentPage;
