import { axiosForBackend } from '@lark-apaas/client-toolkit/utils/getAxiosForBackend';
import type {
  CustomerItem,
  CustomerDetail,
  CreateCustomerRequest,
  CreateCustomerResponse,
  CreateBrandUserRequest,
  CreateBrandUserResponse,
  ResetUserPasswordResponse,
  AdjustCreditResponse,
  PagedResponse,
} from '@shared/api.interface';

export interface CustomersQueryParams {
  page?: number;
  pageSize?: number;
  industry?: string;
  accountStatus?: string;
  keyword?: string;
  includeDemo?: boolean;
}

/** 分页查询客户列表 */
export async function getCustomers(
  params: CustomersQueryParams = {},
): Promise<PagedResponse<CustomerItem>> {
  const { data } = await axiosForBackend.get('/api/customers', { params });
  return data;
}

/** 新建客户 */
export async function createCustomer(
  body: CreateCustomerRequest,
): Promise<CreateCustomerResponse> {
  const { data } = await axiosForBackend.post('/api/customers', body);
  return data;
}

/** 获取客户详情 */
export async function getCustomerDetail(id: string): Promise<CustomerDetail> {
  const { data } = await axiosForBackend.get(`/api/customers/${id}`);
  return data;
}

/** 开通品牌用户账号 */
export async function createBrandUser(
  brandId: string,
  body: CreateBrandUserRequest,
): Promise<CreateBrandUserResponse> {
  const { data } = await axiosForBackend.post(
    `/api/customers/${brandId}/users`,
    body,
  );
  return data;
}

/** 重置用户密码 */
export async function resetUserPassword(
  userId: string,
): Promise<ResetUserPasswordResponse> {
  const { data } = await axiosForBackend.post(
    `/api/customers/users/${userId}/reset-password`,
  );
  return data;
}

/** 启用/停用用户账号 */
export async function toggleUserStatus(
  userId: string,
  status: string,
): Promise<{ userId: string; status: string }> {
  const { data } = await axiosForBackend.patch(
    `/api/customers/users/${userId}/status`,
    { status },
  );
  return data;
}

/** 更新用户角色 */
export async function updateUserRole(
  userId: string,
  role: string,
): Promise<{ userId: string; role: string }> {
  const { data } = await axiosForBackend.patch(
    `/api/customers/users/${userId}/role`,
    { role },
  );
  return data;
}

/** 调整算力额度 */
export async function adjustCredit(
  brandId: string,
  amount: number,
  reason: string,
): Promise<AdjustCreditResponse> {
  const { data } = await axiosForBackend.post(
    `/api/customers/${brandId}/credit/adjust`,
    { amount, reason },
  );
  return data;
}

/** 获取品牌下用户列表 */
export async function listBrandUsers(brandId: string): Promise<
  Array<{
    id: string;
    username: string;
    role: string;
    status: string;
    lastLoginAt: string | null;
    createdAt: string;
  }>
> {
  const { data } = await axiosForBackend.get(
    `/api/customers/${brandId}/users`,
  );
  return data;
}

/** 更新品牌命中词 */
export async function updateBrandHitWords(
  customerId: string,
  hitWords: string[],
): Promise<{ hitWords: string[] }> {
  const { data } = await axiosForBackend.patch(
    `/api/customers/${customerId}/hit-words`,
    { hitWords },
  );
  return data;
}
