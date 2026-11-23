import { axiosForBackend } from '@lark-apaas/client-toolkit/utils/getAxiosForBackend';
import { useQuery } from '@tanstack/react-query';
import type {
  PlacementRecord,
  PlacementRecordListResponse,
  PlacementStats,
  PlacementIndexStatus,
} from '@shared/api.interface';

export interface PlacementRecordQuery {
  page?: number;
  pageSize?: number;
  brandId?: string;
  indexStatus?: PlacementIndexStatus;
  startDate?: string;
  endDate?: string;
}

async function listPlacementRecords(
  params: PlacementRecordQuery,
): Promise<PlacementRecordListResponse> {
  const { data } = await axiosForBackend.get('/api/placement-records', {
    params,
  });
  return data;
}

async function fetchPlacementStats(brandId?: string): Promise<PlacementStats> {
  const { data } = await axiosForBackend.get('/api/placement-records/stats', {
    params: brandId ? { brandId } : {},
  });
  return data;
}

export function usePlacementRecords(params: PlacementRecordQuery = {}) {
  return useQuery({
    queryKey: ['placement-records', params],
    queryFn: () => listPlacementRecords(params),
    retry: false,
  });
}

export function usePlacementStats(brandId?: string) {
  return useQuery({
    queryKey: ['placement-records', 'stats', brandId],
    queryFn: () => fetchPlacementStats(brandId),
    retry: false,
    staleTime: 60_000,
  });
}
