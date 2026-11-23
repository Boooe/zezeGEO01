import { axiosForBackend } from '@lark-apaas/client-toolkit/utils/getAxiosForBackend';
import type {
  BrandProfile,
  BrandProfileUpsertRequest,
  ContentPillar,
  PillarCreateRequest,
  PillarsByPillar,
  ContentCheck,
  ContentGap,
  ActionItem,
  GeoLoopOverview,
  DispatchOverview,
  DispatchPlan,
  SmartScheduleRequest,
  InternalLink,
  InternalLinkStatus,
  ExternalLink,
  ExternalLinkOverview,
  ExternalLinkStatus,
  PageCheck,
  PageCheckCreateRequest,
  IndexCheck,
  SearchEngine,
} from '@shared/api.interface';

export async function getOverview(brandId: string): Promise<GeoLoopOverview> {
  const { data } = await axiosForBackend.get('/api/geo-loop/overview', {
    params: { brandId },
  });
  return data;
}

export async function getBrandProfile(brandId: string): Promise<BrandProfile | null> {
  const { data } = await axiosForBackend.get('/api/geo-loop/brand-profile', {
    params: { brandId },
  });
  return data;
}

export async function upsertBrandProfile(
  body: BrandProfileUpsertRequest,
): Promise<BrandProfile> {
  const { data } = await axiosForBackend.post('/api/geo-loop/brand-profile', body);
  return data;
}

export async function getPillarsByPillar(brandId: string): Promise<PillarsByPillar[]> {
  const { data } = await axiosForBackend.get('/api/geo-loop/pillars/grouped', {
    params: { brandId },
  });
  return data;
}

export async function createPillar(body: PillarCreateRequest): Promise<ContentPillar> {
  const { data } = await axiosForBackend.post('/api/geo-loop/pillars', body);
  return data;
}

export async function deletePillar(id: string): Promise<void> {
  await axiosForBackend.delete(`/api/geo-loop/pillars/${id}`);
}

export async function dispatchPillarsAsTasks(
  pillarIds: string[],
  brandId: string,
): Promise<{ count: number }> {
  const { data } = await axiosForBackend.post(
    '/api/geo-loop/pillars/dispatch-tasks',
    { pillarIds, brandId },
  );
  return data;
}

export async function getContentChecksByBrand(
  brandId: string,
): Promise<ContentCheck[]> {
  const { data } = await axiosForBackend.get('/api/geo-loop/content-checks', {
    params: { brandId },
  });
  return data;
}

export async function runContentCheck(
  articleIds: string[],
  brandId: string,
): Promise<{ count: number }> {
  const { data } = await axiosForBackend.post(
    '/api/geo-loop/content-checks/run',
    { articleIds, brandId },
  );
  return data;
}

export async function getGapsByBrand(
  brandId: string,
  keyword?: string,
): Promise<ContentGap[]> {
  const { data } = await axiosForBackend.get('/api/geo-loop/gaps', {
    params: { brandId, keyword },
  });
  return data;
}

export async function dispatchGapsAsTasks(
  gapIds: string[],
  brandId: string,
): Promise<{ count: number; tasks: { gapId: string; title: string }[] }> {
  const { data } = await axiosForBackend.post(
    '/api/geo-loop/gaps/dispatch-tasks',
    { gapIds, brandId },
  );
  return data;
}

export async function getActionItemsByBrand(
  brandId: string,
): Promise<ActionItem[]> {
  const { data } = await axiosForBackend.get('/api/geo-loop/action-items', {
    params: { brandId },
  });
  return data;
}

export async function adoptAutoSuggestions(brandId: string): Promise<{ count: number }> {
  const { data } = await axiosForBackend.post(
    '/api/geo-loop/action-items/adopt',
    { brandId },
  );
  return data;
}

export async function updateActionItemStatus(
  id: string,
  status: 'pending' | 'in_progress' | 'done',
): Promise<void> {
  await axiosForBackend.patch(`/api/geo-loop/action-items/${id}/status`, { status });
}

// ---------- 分发节奏 ----------

export async function getDispatchOverview(
  brandId: string,
): Promise<DispatchOverview> {
  const { data } = await axiosForBackend.get('/api/geo-loop/dispatch/overview', {
    params: { brandId },
  });
  return data;
}

export async function getDispatchPlans(
  brandId: string,
  startDate: string,
  endDate: string,
): Promise<DispatchPlan[]> {
  const { data } = await axiosForBackend.get('/api/geo-loop/dispatch/plans', {
    params: { brandId, startDate, endDate },
  });
  return data;
}

export async function smartSchedule(
  body: SmartScheduleRequest,
): Promise<DispatchPlan[]> {
  const { data } = await axiosForBackend.post(
    '/api/geo-loop/dispatch/smart-schedule',
    body,
  );
  return data;
}

export async function previewConvertOrders(
  brandId: string,
  planIds: string[],
): Promise<{
  matchedCount: number;
  unmatchedCount: number;
  totalPriceCents: number;
  balanceCents: number;
  sufficient: boolean;
}> {
  const { data } = await axiosForBackend.post(
    '/api/geo-loop/dispatch/convert-orders/preview',
    { brandId, planIds },
  );
  return data;
}

export async function convertToOrders(
  brandId: string,
  planIds: string[],
): Promise<{ success: number; failed: number; unmatched: number; totalPriceCents: number }> {
  const { data } = await axiosForBackend.post(
    '/api/geo-loop/dispatch/convert-orders',
    { brandId, planIds },
  );
  return data;
}

// ---------- 收录引导 · 内链 ----------

export async function getInternalLinks(
  brandId: string,
): Promise<InternalLink[]> {
  const { data } = await axiosForBackend.get(
    '/api/geo-loop/indexing/internal-links',
    { params: { brandId } },
  );
  return data;
}

export async function generateInternalLinks(
  brandId: string,
): Promise<{ generated: number }> {
  const { data } = await axiosForBackend.post(
    '/api/geo-loop/indexing/internal-links/generate',
    { brandId },
  );
  return data;
}

export async function createInternalLink(
  body: Omit<InternalLink, 'id' | 'brandId' | 'createdAt'> & { brandId: string },
): Promise<InternalLink> {
  const { data } = await axiosForBackend.post(
    '/api/geo-loop/indexing/internal-links',
    body,
  );
  return data;
}

export async function updateInternalLinkStatus(
  id: string,
  status: InternalLinkStatus,
): Promise<InternalLink> {
  const { data } = await axiosForBackend.patch(
    `/api/geo-loop/indexing/internal-links/${id}`,
    { status },
  );
  return data;
}

// ---------- 收录引导 · 外链 ----------

export async function getExternalLinks(
  brandId: string,
): Promise<ExternalLink[]> {
  const { data } = await axiosForBackend.get(
    '/api/geo-loop/indexing/external-links',
    { params: { brandId } },
  );
  return data;
}

export async function getExternalLinkOverview(
  brandId: string,
): Promise<ExternalLinkOverview> {
  const { data } = await axiosForBackend.get(
    '/api/geo-loop/indexing/external-links/overview',
    { params: { brandId } },
  );
  return data;
}

export async function createExternalLink(
  body: Omit<ExternalLink, 'id' | 'brandId' | 'createdAt'> & { brandId: string },
): Promise<ExternalLink> {
  const { data } = await axiosForBackend.post(
    '/api/geo-loop/indexing/external-links',
    body,
  );
  return data;
}

export async function updateExternalLinkStatus(
  id: string,
  status: ExternalLinkStatus,
): Promise<ExternalLink> {
  const { data } = await axiosForBackend.patch(
    `/api/geo-loop/indexing/external-links/${id}`,
    { status },
  );
  return data;
}

// ---------- 收录引导 · 页面体检 ----------

export async function getPageChecks(
  brandId: string,
): Promise<PageCheck[]> {
  const { data } = await axiosForBackend.get(
    '/api/geo-loop/indexing/page-checks',
    { params: { brandId } },
  );
  return data;
}

export async function createPageCheck(
  body: PageCheckCreateRequest,
): Promise<PageCheck> {
  const { data } = await axiosForBackend.post(
    '/api/geo-loop/indexing/page-checks',
    body,
  );
  return data;
}

// ---------- 收录引导 · 收录提交 ----------

export async function getIndexChecks(
  brandId: string,
): Promise<IndexCheck[]> {
  const { data } = await axiosForBackend.get(
    '/api/geo-loop/indexing/index-checks',
    { params: { brandId } },
  );
  return data;
}

export async function createIndexCheck(
  brandId: string,
  url: string,
  searchEngine: SearchEngine,
): Promise<IndexCheck> {
  const { data } = await axiosForBackend.post(
    '/api/geo-loop/indexing/index-checks',
    { brandId, url, searchEngine },
  );
  return data;
}
