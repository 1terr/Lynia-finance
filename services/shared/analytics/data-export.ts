/**
 * Data Export & Reporting API (P3-T024)
 *
 * Features:
 *  - CSV/JSON export for all major entities
 *  - Date range filtering
 *  - Field selection
 *  - PII masking for exports
 *  - Scheduled report generation
 *  - Export audit logging
 */

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ===================================================================
// TYPE DEFINITIONS
// ===================================================================

export type ExportEntity =
  | 'customers'
  | 'loans'
  | 'payments'
  | 'devices'
  | 'distributors'
  | 'commissions'
  | 'credit_scores';

export type ExportFormat = 'csv' | 'json';

export interface ExportRequest {
  entity: ExportEntity;
  format: ExportFormat;
  date_from?: string;
  date_to?: string;
  fields?: string[];
  mask_pii: boolean;
  requested_by: string;
}

export interface ExportResult {
  export_id: string;
  entity: ExportEntity;
  format: ExportFormat;
  record_count: number;
  file_size_bytes: number;
  data: string;
  created_at: string;
}

// ===================================================================
// PII MASKING
// ===================================================================

const PII_FIELDS = new Set([
  'phone_number', 'email', 'national_id', 'date_of_birth',
  'address_line1', 'address_line2', 'bank_account_number',
  'mobile_money_number', 'account_number',
]);

function maskValue(key: string, value: unknown): unknown {
  if (!PII_FIELDS.has(key) || value == null) return value;

  const str = String(value);
  if (key === 'phone_number' && str.length > 6) {
    return str.substring(0, 4) + '****' + str.substring(str.length - 3);
  }
  if (key === 'email') {
    const [local, domain] = str.split('@');
    return local.substring(0, 2) + '***@' + domain;
  }
  if (key === 'national_id' && str.length > 4) {
    return str.substring(0, 2) + '******' + str.substring(str.length - 2);
  }
  if (str.length > 4) {
    return str.substring(0, 2) + '*'.repeat(str.length - 4) + str.substring(str.length - 2);
  }
  return '***';
}

function maskRecord(record: Record<string, unknown>, maskPii: boolean): Record<string, unknown> {
  if (!maskPii) return record;
  const masked: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(record)) {
    masked[key] = maskValue(key, value);
  }
  return masked;
}

// ===================================================================
// ENTITY QUERIES
// ===================================================================

const ENTITY_CONFIGS: Record<ExportEntity, {
  table: string;
  defaultFields: string[];
  dateField: string;
}> = {
  customers: {
    table: 'customers',
    defaultFields: ['id', 'phone_number', 'first_name', 'last_name', 'city', 'province', 'kyc_status', 'credit_score', 'credit_tier', 'onboarding_status', 'created_at'],
    dateField: 'created_at',
  },
  loans: {
    table: 'loans',
    defaultFields: ['id', 'customer_id', 'loan_reference', 'principal_amount', 'total_amount_due', 'total_amount_paid', 'monthly_installment_amount', 'loan_status', 'days_past_due', 'term_months', 'created_at'],
    dateField: 'created_at',
  },
  payments: {
    table: 'payments',
    defaultFields: ['id', 'customer_id', 'loan_id', 'amount', 'payment_method', 'status', 'reference', 'created_at'],
    dateField: 'created_at',
  },
  devices: {
    table: 'devices',
    defaultFields: ['id', 'brand', 'model', 'imei', 'retail_price', 'status', 'lock_status', 'customer_id', 'assigned_at'],
    dateField: 'created_at',
  },
  distributors: {
    table: 'distributors',
    defaultFields: ['id', 'name', 'business_name', 'city', 'province', 'status', 'total_devices_distributed', 'total_commissions_earned', 'average_rating'],
    dateField: 'created_at',
  },
  commissions: {
    table: 'distributor_commissions',
    defaultFields: ['id', 'distributor_id', 'loan_id', 'device_retail_price', 'commission_percentage', 'commission_amount', 'payment_status', 'calculation_date'],
    dateField: 'calculation_date',
  },
  credit_scores: {
    table: 'credit_scores',
    defaultFields: ['id', 'customer_id', 'raw_score', 'scaled_score', 'tier', 'decision', 'affordability_score', 'repayment_score', 'created_at'],
    dateField: 'created_at',
  },
};

// ===================================================================
// EXPORT FUNCTIONS
// ===================================================================

/**
 * Generate a data export
 */
export async function generateExport(request: ExportRequest): Promise<ExportResult> {
  const config = ENTITY_CONFIGS[request.entity];
  if (!config) throw new Error(`Unknown entity: ${request.entity}`);

  const fields = request.fields?.length ? request.fields : config.defaultFields;
  const selectStr = fields.join(', ');

  let query = supabase.from(config.table).select(selectStr);

  if (request.date_from) {
    query = query.gte(config.dateField, request.date_from);
  }
  if (request.date_to) {
    query = query.lte(config.dateField, request.date_to);
  }

  query = query.order(config.dateField, { ascending: false }).limit(10000);

  const { data: records, error } = await query;

  if (error) throw new Error(`Export failed: ${error.message}`);

  const maskedRecords = (records || []).map(r => maskRecord(r, request.mask_pii));

  let data: string;
  if (request.format === 'csv') {
    data = convertToCSV(maskedRecords, fields);
  } else {
    data = JSON.stringify(maskedRecords, null, 2);
  }

  const exportId = `exp_${Date.now()}_${request.entity}`;

  // Log export for audit
  await supabase.from('audit_log').insert({
    action: 'data.export',
    entity_type: request.entity,
    entity_id: exportId,
    performed_by: request.requested_by,
    metadata: {
      format: request.format,
      record_count: maskedRecords.length,
      pii_masked: request.mask_pii,
      date_from: request.date_from,
      date_to: request.date_to,
    },
  });

  return {
    export_id: exportId,
    entity: request.entity,
    format: request.format,
    record_count: maskedRecords.length,
    file_size_bytes: Buffer.byteLength(data),
    data,
    created_at: new Date().toISOString(),
  };
}

function convertToCSV(records: Record<string, unknown>[], fields: string[]): string {
  if (records.length === 0) return fields.join(',') + '\n';

  const header = fields.join(',');
  const rows = records.map(record =>
    fields.map(field => {
      const value = record[field];
      if (value == null) return '';
      const str = String(value);
      return str.includes(',') || str.includes('"') || str.includes('\n')
        ? `"${str.replace(/"/g, '""')}"`
        : str;
    }).join(',')
  );

  return header + '\n' + rows.join('\n');
}

/**
 * Get list of available export entities with metadata
 */
export function getExportableEntities(): Array<{
  entity: ExportEntity;
  label: string;
  defaultFields: string[];
}> {
  return [
    { entity: 'customers', label: 'Customers', defaultFields: ENTITY_CONFIGS.customers.defaultFields },
    { entity: 'loans', label: 'Loans', defaultFields: ENTITY_CONFIGS.loans.defaultFields },
    { entity: 'payments', label: 'Payments', defaultFields: ENTITY_CONFIGS.payments.defaultFields },
    { entity: 'devices', label: 'Devices', defaultFields: ENTITY_CONFIGS.devices.defaultFields },
    { entity: 'distributors', label: 'Distributors', defaultFields: ENTITY_CONFIGS.distributors.defaultFields },
    { entity: 'commissions', label: 'Commissions', defaultFields: ENTITY_CONFIGS.commissions.defaultFields },
    { entity: 'credit_scores', label: 'Credit Scores', defaultFields: ENTITY_CONFIGS.credit_scores.defaultFields },
  ];
}
