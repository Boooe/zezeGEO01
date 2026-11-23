import { axiosForBackend } from '@lark-apaas/client-toolkit/utils/getAxiosForBackend';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  DIAGNOSIS_PLATFORMS,
  DIAGNOSIS_PLATFORM_LABELS,
  CITATION_PROBE_STATUS,
  CITATION_PROBE_STATUS_LABELS,
} from '@shared/api.interface';
import type {
  DiagnosisPlatform,
  CitationProbeStatus,
  CitationProbeTask,
  CitationProbeResult,
  CitationProbeKpiResponse,
  CitationProbePlatformDistributionItem,
  CitationProbeTaskListResponse,
  CitationProbeResultListResponse,
  CreateCitationProbeTaskRequest,
  CreateManualSnapshotRequest,
  CitationProbeKeywordItem,
  GenerateQuestionsResponse,
} from '@shared/api.interface';
import { getApiErrorMessage } from '@client/src/lib/api-error';
import { logger } from '@lark-apaas/client-toolkit/logger';
import { toast } from 'sonner';

const PLATFORM_ACCESS_STATUS: Record<DiagnosisPlatform, boolean> = {
  doubao: false,
  deepseek: false,
  wenxin: false,
  tongyi: false,
  yuanbao: false,
  kimi: false,
};

export function isPlatformConnected(platform: DiagnosisPlatform): boolean {
  return PLATFORM_ACCESS_STATUS[platform] ?? false;
}

export interface PlatformStatusResponse {
  platforms: Record<DiagnosisPlatform, { connected: boolean; model: string | null }>;
}

export function usePlatformsStatus() {
  return useQuery({
    queryKey: ['citation-probe', 'platforms-status'],
    queryFn: async (): Promise<PlatformStatusResponse['platforms']> => {
      const res = await axiosForBackend.get<PlatformStatusResponse>(
        '/api/citation-probe/platforms-status',
      );
      return res.data.platforms;
    },
    retry: false,
    staleTime: 60_000,
  });
}

export {
  DIAGNOSIS_PLATFORMS,
  DIAGNOSIS_PLATFORM_LABELS,
  CITATION_PROBE_STATUS,
  CITATION_PROBE_STATUS_LABELS,
};
export type {
  DiagnosisPlatform,
  CitationProbeStatus,
  CitationProbeTask,
  CitationProbeResult,
  CitationProbeKpiResponse,
  CitationProbePlatformDistributionItem,
  CitationProbeKeywordItem,
};

export interface ResultListQuery {
  page?: number;
  pageSize?: number;
  brandId?: string;
  platform?: DiagnosisPlatform;
  status?: CitationProbeStatus;
  keyword?: string;
}

export interface TaskListQuery {
  page?: number;
  pageSize?: number;
  brandId?: string;
  status?: CitationProbeStatus;
}

export function useKeywords(brandId?: string) {
  return useQuery({
    queryKey: ['citation-probe', 'keywords', brandId],
    queryFn: async (): Promise<CitationProbeKeywordItem[]> => {
      const res = await axiosForBackend.get('/api/citation-probe/keywords', {
        params: { brandId },
      });
      return res.data.items;
    },
    enabled: !!brandId,
    retry: false,
  });
}

export function useGenerateQuestions() {
  return useMutation({
    mutationFn: async (body: { keywords: string[]; count?: number }): Promise<string[]> => {
      const res = await axiosForBackend.post<GenerateQuestionsResponse>(
        '/api/citation-probe/generate-questions',
        body,
      );
      return res.data.questions;
    },
    retry: false,
    onError: (error: unknown) => {
      const msg = getApiErrorMessage(error);
      logger.error('生成提问失败', error);
      toast.error(msg);
    },
  });
}

export function useCreateTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: CreateCitationProbeTaskRequest): Promise<CitationProbeTask> => {
      const res = await axiosForBackend.post('/api/citation-probe/tasks', body);
      return res.data;
    },
    retry: false,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['citation-probe', 'tasks'] });
      queryClient.invalidateQueries({ queryKey: ['citation-probe', 'results'] });
      queryClient.invalidateQueries({ queryKey: ['citation-probe', 'kpi'] });
      queryClient.invalidateQueries({
        queryKey: ['citation-probe', 'platform-distribution'],
      });
      toast.success('探针任务创建成功');
    },
    onError: (error: unknown) => {
      const msg = getApiErrorMessage(error);
      logger.error('创建探针任务失败', error);
      toast.error(msg);
    },
  });
}

export function useTasks(params: TaskListQuery) {
  return useQuery({
    queryKey: ['citation-probe', 'tasks', params],
    queryFn: async (): Promise<CitationProbeTaskListResponse> => {
      const res = await axiosForBackend.get('/api/citation-probe/tasks', {
        params,
      });
      return res.data;
    },
    retry: false,
  });
}

export function useResults(params: ResultListQuery) {
  return useQuery({
    queryKey: ['citation-probe', 'results', params],
    queryFn: async (): Promise<CitationProbeResultListResponse> => {
      const res = await axiosForBackend.get('/api/citation-probe/results', {
        params,
      });
      return res.data;
    },
    retry: false,
  });
}

export function useExecuteResult() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string): Promise<CitationProbeResult> => {
      const res = await axiosForBackend.post(
        `/api/citation-probe/results/${id}/execute`,
      );
      return res.data;
    },
    retry: false,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['citation-probe', 'results'] });
      queryClient.invalidateQueries({ queryKey: ['citation-probe', 'kpi'] });
      queryClient.invalidateQueries({
        queryKey: ['citation-probe', 'platform-distribution'],
      });
    },
    onError: (error: unknown) => {
      const msg = getApiErrorMessage(error);
      logger.error('执行快照失败', error);
      toast.error(msg);
    },
  });
}

export function useCreateManualSnapshot() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (
      body: CreateManualSnapshotRequest,
    ): Promise<CitationProbeResult> => {
      const res = await axiosForBackend.post(
        '/api/citation-probe/results/manual',
        body,
      );
      return res.data;
    },
    retry: false,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['citation-probe', 'results'] });
      queryClient.invalidateQueries({ queryKey: ['citation-probe', 'kpi'] });
      queryClient.invalidateQueries({
        queryKey: ['citation-probe', 'platform-distribution'],
      });
      toast.success('快照录入成功');
    },
    onError: (error: unknown) => {
      const msg = getApiErrorMessage(error);
      logger.error('录入快照失败', error);
      toast.error(msg);
    },
  });
}

export function useKpi(params: { brandId?: string; platform?: DiagnosisPlatform }) {
  return useQuery({
    queryKey: ['citation-probe', 'kpi', params],
    queryFn: async (): Promise<CitationProbeKpiResponse> => {
      const res = await axiosForBackend.get('/api/citation-probe/kpi', {
        params,
      });
      return res.data;
    },
    retry: false,
  });
}

export function usePlatformDistribution(brandId?: string) {
  return useQuery({
    queryKey: ['citation-probe', 'platform-distribution', brandId],
    queryFn: async (): Promise<CitationProbePlatformDistributionItem[]> => {
      const res = await axiosForBackend.get(
        '/api/citation-probe/platform-distribution',
        { params: { brandId } },
      );
      return res.data.items;
    },
    enabled: !!brandId,
    retry: false,
  });
}

export function useDeleteResult() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string): Promise<void> => {
      await axiosForBackend.delete(`/api/citation-probe/results/${id}`);
    },
    retry: false,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['citation-probe', 'results'] });
      queryClient.invalidateQueries({ queryKey: ['citation-probe', 'kpi'] });
      queryClient.invalidateQueries({
        queryKey: ['citation-probe', 'platform-distribution'],
      });
      toast.success('已删除');
    },
    onError: (error: unknown) => {
      const msg = getApiErrorMessage(error);
      logger.error('删除快照失败', error);
      toast.error(msg);
    },
  });
}
