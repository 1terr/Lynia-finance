import { fetchAPI } from '@lynia/api-client';
import { MAX_PAGE_SIZE } from '@lynia/utils';
import type {
  LoanProduct,
  CreateProductInput,
  ProductCategory,
  ProductStatus,
  DeviceModel,
  CreateDeviceModelInput,
  Organization,
  CreateOrganizationInput,
  OrgType,
  OrganizationMember,
  MemberImportInput,
  MemberImportResult,
} from '@/types';

// ─── Product Filters ───

export interface ProductFilters {
  category?: ProductCategory;
  status?: ProductStatus;
  search?: string;
  page?: number;
  limit?: number;
}

// ─── Product CRUD ───

export async function getProducts(filters: ProductFilters = {}) {
  const { category, status, search, page = 1, limit: rawLimit = 25 } = filters;
  const limit = Math.min(rawLimit, MAX_PAGE_SIZE);

  const params = new URLSearchParams();
  params.set('page', String(page));
  params.set('limit', String(limit));
  if (category) params.set('category', category);
  if (status) params.set('status', status);
  if (search) params.set('search', search);

  return fetchAPI<{
    data: LoanProduct[];
    total: number;
    page: number;
    limit: number;
    total_pages: number;
  }>(`/admin/products?${params.toString()}`);
}

export async function getProduct(id: string): Promise<LoanProduct | null> {
  try {
    return await fetchAPI<LoanProduct>(`/admin/products/${id}`);
  } catch {
    return null;
  }
}

export async function createProduct(data: CreateProductInput): Promise<LoanProduct> {
  return fetchAPI<LoanProduct>('/admin/products', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateProduct(id: string, data: Partial<LoanProduct>): Promise<LoanProduct> {
  return fetchAPI<LoanProduct>(`/admin/products/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export async function deleteProduct(id: string): Promise<void> {
  return fetchAPI<void>(`/admin/products/${id}`, {
    method: 'DELETE',
  });
}

export async function getProductStats(): Promise<Record<string, { totalLoans: number; totalVolume: number }>> {
  return fetchAPI<Record<string, { totalLoans: number; totalVolume: number }>>('/admin/products/stats');
}

export async function getProductLoansCount(id: string): Promise<{ active_loans: number }> {
  return fetchAPI<{ active_loans: number }>(`/admin/products/${id}/loans-count`);
}

// ─── Device Model Filters ───

export interface DeviceModelFilters {
  brand?: string;
  is_active?: boolean;
  search?: string;
  page?: number;
  limit?: number;
}

// ─── Device Model CRUD ───

export async function getDeviceModels(filters: DeviceModelFilters = {}) {
  const { brand, is_active, search, page = 1, limit: rawLimit = 25 } = filters;
  const limit = Math.min(rawLimit, MAX_PAGE_SIZE);

  const params = new URLSearchParams();
  params.set('page', String(page));
  params.set('limit', String(limit));
  if (brand) params.set('brand', brand);
  if (is_active !== undefined) params.set('is_active', String(is_active));
  if (search) params.set('search', search);

  return fetchAPI<{
    data: DeviceModel[];
    total: number;
    page: number;
    limit: number;
    total_pages: number;
  }>(`/admin/device-models?${params.toString()}`);
}

export async function getDeviceModel(id: string): Promise<DeviceModel | null> {
  try {
    return await fetchAPI<DeviceModel>(`/admin/device-models/${id}`);
  } catch {
    return null;
  }
}

export async function createDeviceModel(data: CreateDeviceModelInput): Promise<DeviceModel> {
  return fetchAPI<DeviceModel>('/admin/device-models', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateDeviceModel(id: string, data: Partial<DeviceModel>): Promise<DeviceModel> {
  return fetchAPI<DeviceModel>(`/admin/device-models/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export async function deleteDeviceModel(id: string): Promise<void> {
  return fetchAPI<void>(`/admin/device-models/${id}`, {
    method: 'DELETE',
  });
}

// ─── Organization Filters ───

export interface OrganizationFilters {
  org_type?: OrgType;
  is_active?: boolean;
  search?: string;
  page?: number;
  limit?: number;
}

// ─── Organization CRUD ───

export async function getOrganizations(filters: OrganizationFilters = {}) {
  const { org_type, is_active, search, page = 1, limit: rawLimit = 25 } = filters;
  const limit = Math.min(rawLimit, MAX_PAGE_SIZE);

  const params = new URLSearchParams();
  params.set('page', String(page));
  params.set('limit', String(limit));
  if (org_type) params.set('org_type', org_type);
  if (is_active !== undefined) params.set('is_active', String(is_active));
  if (search) params.set('search', search);

  return fetchAPI<{
    data: Organization[];
    total: number;
    page: number;
    limit: number;
    total_pages: number;
  }>(`/admin/organizations?${params.toString()}`);
}

export async function getOrganization(id: string): Promise<Organization | null> {
  try {
    return await fetchAPI<Organization>(`/admin/organizations/${id}`);
  } catch {
    return null;
  }
}

export async function createOrganization(data: CreateOrganizationInput): Promise<Organization> {
  return fetchAPI<Organization>('/admin/organizations', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateOrganization(id: string, data: Partial<Organization>): Promise<Organization> {
  return fetchAPI<Organization>(`/admin/organizations/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

// ─── Organization Members ───

export interface MemberFilters {
  page?: number;
  limit?: number;
}

export async function getMembers(orgId: string, filters: MemberFilters = {}) {
  const { page = 1, limit: rawLimit = 25 } = filters;
  const limit = Math.min(rawLimit, MAX_PAGE_SIZE);

  const params = new URLSearchParams();
  params.set('page', String(page));
  params.set('limit', String(limit));

  return fetchAPI<{
    data: OrganizationMember[];
    total: number;
    page: number;
    limit: number;
    total_pages: number;
  }>(`/admin/organizations/${orgId}/members?${params.toString()}`);
}

export async function importMembers(
  orgId: string,
  members: MemberImportInput[],
  dataSource: string = 'manual'
): Promise<MemberImportResult> {
  return fetchAPI<MemberImportResult>(`/admin/organizations/${orgId}/import`, {
    method: 'POST',
    body: JSON.stringify({ members, data_source: dataSource }),
  });
}
