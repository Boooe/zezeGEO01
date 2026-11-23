import { axiosForBackend } from '@lark-apaas/client-toolkit/utils/getAxiosForBackend';
import type {
  Contract,
  PagedResponse,
  Payment,
} from '@shared/api.interface';

export interface ContractsQueryParams {
  page?: number;
  pageSize?: number;
  keyword?: string;
  status?: string;
  brandId?: string;
}

/** 分页查询合同列表 */
export async function getContracts(
  params: ContractsQueryParams = {},
): Promise<PagedResponse<Contract>> {
  const { data } = await axiosForBackend.get('/api/contracts', { params });
  return data;
}

/** 获取合同详情（含收款记录） */
export async function getContractDetail(id: string): Promise<{
  contract: Contract;
  payments: Payment[];
}> {
  const { data } = await axiosForBackend.get(`/api/contracts/${id}`);
  return data;
}

export interface CreateContractPayload {
  brandId?: string;
  customerName: string;
  industry?: string;
  contactPerson?: string;
  contactPhone?: string;
  packageType: string;
  contractAmount: number;
  signDate?: string;
  serviceStart?: string;
  serviceEnd?: string;
  paymentStatus: string;
  remark?: string;
}

/** 新增合同 */
export async function createContract(
  payload: CreateContractPayload,
): Promise<Contract> {
  const { data } = await axiosForBackend.post('/api/contracts', payload);
  return data;
}

export type UpdateContractPayload = Partial<CreateContractPayload>;

/** 编辑合同 */
export async function updateContract(
  id: string,
  payload: UpdateContractPayload,
): Promise<Contract> {
  const { data } = await axiosForBackend.patch(`/api/contracts/${id}`, payload);
  return data;
}

/** 删除合同 */
export async function deleteContract(id: string): Promise<void> {
  await axiosForBackend.delete(`/api/contracts/${id}`);
}

export interface CreatePaymentPayload {
  amount: number;
  paymentDate?: string;
  paymentMethod?: string;
  remark?: string;
}

/** 新增收款记录 */
export async function createPayment(
  contractId: string,
  payload: CreatePaymentPayload,
): Promise<Payment> {
  const { data } = await axiosForBackend.post(
    `/api/contracts/${contractId}/payments`,
    payload,
  );
  return data;
}

/** 续费顺延 */
export async function renewContract(
  id: string,
  months: number,
): Promise<Contract> {
  const { data } = await axiosForBackend.post(
    `/api/contracts/${id}/renew`,
    { months },
  );
  return data;
}

/** 导出 CSV */
export async function exportContracts(params: ContractsQueryParams = {}): Promise<void> {
  const response = await axiosForBackend.get('/api/contracts/export', {
    params,
    responseType: 'blob',
  });
  const url = window.URL.createObjectURL(new Blob([response.data]));
  const link = document.createElement('a');
  link.href = url;
  const dateStr = new Date().toISOString().slice(0, 10);
  link.setAttribute('download', `contracts_${dateStr}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
}
