import type { Organization } from '@/types';

export const mockOrganization: Organization = {
  id: 'org-001-uuid',
  org_code: 'GOV_CSC',
  org_name: 'Civil Service Commission',
  org_type: 'government',
  verification_method: 'excel_upload',
  scoring_trust_level: 90,
  contact_person: 'Jane Smith',
  contact_phone: '+263771234567',
  contact_email: 'jane@csc.gov.zw',
  api_endpoint: undefined,
  is_active: true,
  created_at: '2025-01-01T00:00:00Z',
  updated_at: '2025-06-15T00:00:00Z',
};

export const mockApiOrganization: Organization = {
  ...mockOrganization,
  id: 'org-002-uuid',
  org_code: 'CORP_DELTA',
  org_name: 'Delta Corporation',
  org_type: 'corporate',
  verification_method: 'api',
  scoring_trust_level: 70,
  api_endpoint: 'https://api.delta.co.zw/verify',
};
