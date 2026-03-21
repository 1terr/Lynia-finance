import { fetchAPI } from '@lynia/api-client';
import { MAX_PAGE_SIZE } from '@lynia/utils';
import type {
  LoanProduct,
  CreateProductInput,
  FineractProductDefaults,
  GLAccount,
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
  LinkedOrganization,
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

// ─── Product Version History ───

export interface ProductVersion {
  id: string;
  product_id: string;
  version_number: number;
  changed_by: string;
  changed_at: string;
  change_type: 'create' | 'update' | 'deactivate' | 'reactivate';
  previous_values: Record<string, unknown> | null;
  new_values: Record<string, unknown>;
  change_reason: string | null;
  created_at: string;
}

export async function getProductVersions(productId: string): Promise<{ data: ProductVersion[] }> {
  return fetchAPI<{ data: ProductVersion[] }>(`/admin/products/${productId}/versions`);
}

// ─── Fineract Defaults & GL Accounts ───

export async function getProductFineractDefaults(): Promise<FineractProductDefaults> {
  return fetchAPI<FineractProductDefaults>('/admin/products/fineract-defaults');
}

export async function getGLAccounts(): Promise<{
  accounts: GLAccount[];
  grouped: Record<string, GLAccount[]>;
}> {
  return fetchAPI<{ accounts: GLAccount[]; grouped: Record<string, GLAccount[]> }>('/admin/products/gl-accounts');
}

// ─── Product-Device Model Linking ───

export interface LinkedDeviceModel {
  id: string;
  device_model_id: string;
  brand: string;
  model_name: string;
  model_code: string;
  retail_price_usd: number;
  wholesale_price_usd: number;
  available_stock: number;
  is_active: boolean;
  storage_gb: number | null;
}

export async function getProductDeviceModels(productId: string): Promise<{ data: LinkedDeviceModel[] }> {
  return fetchAPI<{ data: LinkedDeviceModel[] }>(`/admin/products/${productId}/device-models`);
}

export async function linkDeviceModels(productId: string, deviceModelIds: string[]): Promise<void> {
  return fetchAPI<void>(`/admin/products/${productId}/device-models`, {
    method: 'POST',
    body: JSON.stringify({ device_model_ids: deviceModelIds }),
  });
}

export async function unlinkDeviceModel(productId: string, deviceModelId: string): Promise<void> {
  return fetchAPI<void>(`/admin/products/${productId}/device-models/${deviceModelId}`, {
    method: 'DELETE',
  });
}

// ─── Product-Organization Linking ───

export async function getProductOrganizations(productId: string): Promise<{ data: LinkedOrganization[] }> {
  return fetchAPI<{ data: LinkedOrganization[] }>(`/admin/products/${productId}/organizations`);
}

export async function linkOrganizations(productId: string, organizationIds: string[]): Promise<void> {
  return fetchAPI<void>(`/admin/products/${productId}/organizations`, {
    method: 'POST',
    body: JSON.stringify({ organization_ids: organizationIds }),
  });
}

export async function unlinkOrganization(productId: string, orgId: string): Promise<void> {
  return fetchAPI<void>(`/admin/products/${productId}/organizations/${orgId}`, {
    method: 'DELETE',
  });
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

export async function getOrganization(id: string): Promise<Organization> {
  return fetchAPI<Organization>(`/admin/organizations/${id}`);
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

export async function checkOrgCode(code: string): Promise<{ available: boolean }> {
  return fetchAPI<{ available: boolean }>(`/admin/organizations/check-code?code=${encodeURIComponent(code)}`);
}

// ─── Organization Members ───

export interface MemberFilters {
  page?: number;
  limit?: number;
  search?: string;
  employment_status?: string;
}

export async function getMembers(orgId: string, filters: MemberFilters = {}) {
  const { page = 1, limit: rawLimit = 25, search, employment_status } = filters;
  const limit = Math.min(rawLimit, MAX_PAGE_SIZE);

  const params = new URLSearchParams();
  params.set('page', String(page));
  params.set('limit', String(limit));
  if (search) params.set('search', search);
  if (employment_status) params.set('employment_status', employment_status);

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
