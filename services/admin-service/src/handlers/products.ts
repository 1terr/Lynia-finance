import { RouteHandler } from '../../../shared/utils/lambda-router';
import { db, query } from '../../../shared/clients/database';
import { successResponse, errorResponse } from '../../../shared/utils/response';
import { isAdminOrManager } from '../../../shared/middleware/authorization';
import logger from '../../../shared/utils/logger';
import { auditLog } from './helpers';
import { getFineractClient, FineractApiError } from '../../../shared/clients/fineract';
import type { FineractLoanProductCreateRequest } from '../../../shared/types/fineract';

const VALID_PRODUCT_CATEGORIES = ['smartphone', 'digital'] as const;
const PRODUCT_CODE_REGEX = /^[A-Za-z0-9_]{1,50}$/;
const SHORT_NAME_REGEX = /^[A-Za-z0-9]{1,4}$/;

// ─── GET /admin/products ───

export const handleGetProducts: RouteHandler = async (event, _params, auth) => {
  if (!isAdminOrManager(auth)) {
    return errorResponse('Insufficient permissions', 403, {}, event);
  }

  const qs = event.queryStringParameters || {};
  const page = Math.max(1, parseInt(qs.page || '1'));
  const limit = Math.min(100, Math.max(1, parseInt(qs.limit || '25')));
  const offset = (page - 1) * limit;

  let whereClause = 'deleted_at IS NULL';
  const params: unknown[] = [];

  if (qs.category) {
    params.push(qs.category);
    whereClause += ` AND product_category = $${params.length}`;
  }

  if (qs.status) {
    params.push(qs.status);
    whereClause += ` AND status = $${params.length}`;
  }

  if (qs.search) {
    params.push(`%${qs.search}%`);
    const idx = params.length;
    whereClause += ` AND (product_name ILIKE $${idx} OR product_code ILIKE $${idx})`;
  }

  const { data: countRows } = await query<{ count: string }>(
    `SELECT COUNT(*) as count FROM loan_products WHERE ${whereClause}`,
    params
  );
  const total = parseInt(countRows[0]?.count || '0');

  params.push(limit, offset);
  const { data: rows, error } = await query(
    `SELECT * FROM loan_products WHERE ${whereClause} ORDER BY display_order ASC, created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );

  if (error) {
    logger.error('Error fetching products', {
      action: 'admin.products.getAll',
      status: 'failed',
      errorMessage: error.message,
    });
    return errorResponse('Failed to fetch products', 500, {}, event);
  }

  return successResponse({ data: rows, total, page, limit, total_pages: Math.ceil(total / limit) }, 200, event);
};

// ─── GET /admin/products/stats ───

export const handleGetProductStats: RouteHandler = async (event, _params, auth) => {
  if (!isAdminOrManager(auth)) {
    return errorResponse('Insufficient permissions', 403, {}, event);
  }

  const { data: rows, error } = await query<{
    product_category: string;
    total_loans: string;
    total_volume: string;
  }>(
    `SELECT
       lp.product_category,
       COUNT(l.id) as total_loans,
       COALESCE(SUM(l.loan_amount_usd), 0) as total_volume
     FROM loan_products lp
     LEFT JOIN loans l ON l.product_id = lp.id AND l.status IN ('active', 'disbursed', 'approved', 'paid_off')
     WHERE lp.deleted_at IS NULL
     GROUP BY lp.product_category`,
    []
  );

  if (error) {
    logger.error('Error fetching product stats', {
      action: 'admin.products.stats',
      status: 'failed',
      errorMessage: error.message,
    });
    return errorResponse('Failed to fetch product stats', 500, {}, event);
  }

  const stats: Record<string, { totalLoans: number; totalVolume: number }> = {};
  for (const row of rows) {
    stats[row.product_category] = {
      totalLoans: parseInt(row.total_loans) || 0,
      totalVolume: parseFloat(row.total_volume) || 0,
    };
  }

  return successResponse(stats, 200, event);
};

// ─── GET /admin/products/:id/loans-count ───

export const handleGetProductLoansCount: RouteHandler = async (event, params, auth) => {
  if (!isAdminOrManager(auth)) {
    return errorResponse('Insufficient permissions', 403, {}, event);
  }

  const id = params.id;

  const { data: rows } = await query<{ count: string }>(
    `SELECT COUNT(*) as count FROM loans WHERE product_id = $1 AND status IN ('active', 'disbursed', 'approved')`,
    [id]
  );

  return successResponse({ active_loans: parseInt(rows[0]?.count || '0') }, 200, event);
};

// ─── GET /admin/products/:id ───

export const handleGetProductById: RouteHandler = async (event, params, auth) => {
  const id = params.id;

  if (!isAdminOrManager(auth)) {
    return errorResponse('Insufficient permissions', 403, {}, event);
  }

  const { data: row } = await db.from('loan_products')
    .select('*')
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle()
    .execute();

  if (!row) {
    return errorResponse('Product not found', 404, {}, event);
  }

  // Fetch linked device models
  const { data: linkedModels } = await query<{
    id: string; device_model_id: string; brand: string; model_name: string; model_code: string;
    retail_price_usd: string; wholesale_price_usd: string; available_stock: string; is_active: boolean;
    storage_gb: string | null;
  }>(
    `SELECT pdm.id, pdm.device_model_id, dm.brand, dm.model_name, dm.model_code,
            dm.retail_price_usd, dm.wholesale_price_usd, dm.available_stock, dm.is_active, dm.storage_gb
     FROM product_device_models pdm
     JOIN device_models dm ON dm.id = pdm.device_model_id AND dm.deleted_at IS NULL
     WHERE pdm.product_id = $1
     ORDER BY dm.brand, dm.model_name`,
    [id]
  );

  // Count in-stock devices for linked models
  let inStockCount = 0;
  if (linkedModels && linkedModels.length > 0) {
    const modelIds = linkedModels.map(m => m.device_model_id);
    const { data: stockRows } = await query<{ count: string }>(
      `SELECT COUNT(*) as count FROM devices WHERE device_model_id = ANY($1) AND status = 'in_stock' AND deleted_at IS NULL`,
      [modelIds]
    );
    inStockCount = parseInt(stockRows[0]?.count || '0');
  }

  return successResponse({ ...row, linked_device_models: linkedModels || [], in_stock_device_count: inStockCount }, 200, event);
};

// ─── POST /admin/products ───
// Fineract-first: create in Fineract synchronously, then store in Lynia DB.
// If Fineract fails, the product is NOT saved — no orphaned Lynia products.

export const handleCreateProduct: RouteHandler = async (event, _params, auth) => {
  if (!isAdminOrManager(auth)) {
    return errorResponse('Insufficient permissions', 403, {}, event);
  }

  const body = JSON.parse(event.body || '{}');

  // Validate required fields
  const requiredFields = [
    'product_code', 'product_name', 'product_category', 'product_type',
    'short_name', 'default_principal', 'min_amount_usd', 'max_amount_usd',
    'number_of_repayments', 'min_term_months', 'max_term_months',
    'interest_rate_monthly', 'interest_rate_annual',
  ];
  for (const field of requiredFields) {
    if (body[field] === undefined || body[field] === null || body[field] === '') {
      return errorResponse(`Missing required field: ${field}`, 400, { code: 'VAL_REQ_001' }, event);
    }
  }

  // Validate product_code format
  if (!PRODUCT_CODE_REGEX.test(body.product_code)) {
    return errorResponse('product_code must be alphanumeric with underscores, max 50 chars', 400, { code: 'VAL_FMT_001' }, event);
  }

  // Validate short_name (Fineract requires 1-4 alphanumeric chars)
  if (!SHORT_NAME_REGEX.test(body.short_name)) {
    return errorResponse('short_name must be 1-4 alphanumeric characters', 400, { code: 'VAL_FMT_001' }, event);
  }

  // Validate product_category
  if (!VALID_PRODUCT_CATEGORIES.includes(body.product_category)) {
    return errorResponse('product_category must be smartphone or digital', 400, { code: 'VAL_FMT_001' }, event);
  }

  // Validate accounting_rule
  const accountingRule = body.accounting_rule ?? 3;
  if (![1, 2, 3, 4].includes(accountingRule)) {
    return errorResponse('accounting_rule must be 1 (none), 2 (cash), 3 (accrual), or 4 (upfront accrual)', 400, { code: 'VAL_RNG_001' }, event);
  }

  // GL accounts required when accounting_rule > 1
  if (accountingRule > 1) {
    const requiredGLFields = [
      'fund_source_account_id', 'loan_portfolio_account_id',
      'interest_on_loan_account_id', 'income_from_fee_account_id',
      'income_from_penalty_account_id', 'write_off_account_id',
      'overpayment_liability_account_id', 'transfers_in_suspense_account_id',
      'income_from_recovery_account_id',
    ];
    // Accrual (3 and 4) additionally requires receivable accounts
    if (accountingRule >= 3) {
      requiredGLFields.push(
        'receivable_interest_account_id', 'receivable_fee_account_id',
        'receivable_penalty_account_id'
      );
    }
    for (const field of requiredGLFields) {
      if (!body[field]) {
        return errorResponse(`GL account mapping "${field}" is required when accounting_rule > 1`, 400, { code: 'VAL_REQ_001' }, event);
      }
    }
  }

  // Category-specific validations
  if (body.product_category === 'smartphone') {
    if (body.requires_device !== true) {
      return errorResponse('Smartphone products must have requires_device = true', 400, { code: 'VAL_FMT_001' }, event);
    }
    if (!body.deposit_percentage || body.deposit_percentage <= 0) {
      return errorResponse('Smartphone products must have deposit_percentage > 0', 400, { code: 'VAL_RNG_001' }, event);
    }
  }

  if (body.product_category === 'digital') {
    if (body.deposit_percentage && body.deposit_percentage !== 0) {
      return errorResponse('Digital products must have deposit_percentage = 0', 400, { code: 'VAL_FMT_001' }, event);
    }
    if (body.requires_organization_verification !== true) {
      return errorResponse('Digital products must have requires_organization_verification = true', 400, { code: 'VAL_FMT_001' }, event);
    }
  }

  // Interest recalculation validation
  if (body.is_interest_recalculation_enabled) {
    const requiredRecalcFields = [
      'interest_recalculation_compounding_method',
      'reschedule_strategy_method',
      'recalculation_rest_frequency_type',
      'recalculation_rest_frequency_interval',
    ];
    for (const field of requiredRecalcFields) {
      if (body[field] == null) {
        return errorResponse(
          `"${field}" is required when interest recalculation is enabled`,
          400,
          { code: 'VAL_REQ_001' },
          event
        );
      }
    }
    // Fineract requires interestCalculationPeriodType = 0 (daily) when recalculation is enabled
    body.interest_calculation_period_type = 0;
  }

  // Range validations
  if (body.min_term_months >= body.max_term_months) {
    return errorResponse('min_term_months must be less than max_term_months', 400, { code: 'VAL_RNG_001' }, event);
  }
  if (body.min_amount_usd >= body.max_amount_usd) {
    return errorResponse('min_amount_usd must be less than max_amount_usd', 400, { code: 'VAL_RNG_001' }, event);
  }
  if (body.interest_rate_monthly <= 0) {
    return errorResponse('interest_rate_monthly must be greater than 0', 400, { code: 'VAL_RNG_001' }, event);
  }

  // Check uniqueness
  const { data: existing } = await db.from('loan_products')
    .select('id')
    .eq('product_code', body.product_code)
    .maybeSingle()
    .execute();

  if (existing) {
    return errorResponse('A product with this product_code already exists', 409, {}, event);
  }

  // ─── Build Fineract payload from request body ───
  const fineractName = `Lynia - ${body.product_name}`;
  const fineractPayload: FineractLoanProductCreateRequest = {
    name: fineractName,
    shortName: body.short_name.toUpperCase(),
    description: body.description || `Lynia product ${body.product_code}`,
    currencyCode: body.currency_code || 'USD',
    digitsAfterDecimal: body.digits_after_decimal ?? 2,
    inMultiplesOf: body.in_multiples_of ?? 1,
    principal: body.default_principal,
    minPrincipal: body.min_amount_usd,
    maxPrincipal: body.max_amount_usd,
    numberOfRepayments: body.number_of_repayments,
    minNumberOfRepayments: body.min_term_months,
    maxNumberOfRepayments: body.max_term_months,
    repaymentEvery: body.repayment_every ?? 1,
    repaymentFrequencyType: body.repayment_frequency_type ?? 2,
    interestRatePerPeriod: body.interest_rate_monthly,
    minInterestRatePerPeriod: body.min_interest_rate,
    maxInterestRatePerPeriod: body.max_interest_rate,
    interestRateFrequencyType: body.interest_rate_frequency_type ?? 2,
    amortizationType: body.amortization_type ?? 0,
    interestType: body.interest_type ?? 0,
    interestCalculationPeriodType: body.interest_calculation_period_type ?? 1,
    transactionProcessingStrategyCode: body.transaction_processing_strategy || 'mifos-standard-strategy',
    daysInYearType: body.days_in_year_type ?? 365,
    daysInMonthType: body.days_in_month_type ?? 30,
    isInterestRecalculationEnabled: body.is_interest_recalculation_enabled ?? false,
    locale: 'en',
    dateFormat: 'dd MMMM yyyy',
    accountingRule,
  };

  // Add interest recalculation parameters when enabled
  if (fineractPayload.isInterestRecalculationEnabled) {
    fineractPayload.interestRecalculationCompoundingMethod = body.interest_recalculation_compounding_method ?? 0;
    fineractPayload.rescheduleStrategyMethod = body.reschedule_strategy_method ?? 1;
    fineractPayload.recalculationRestFrequencyType = body.recalculation_rest_frequency_type ?? 1;
    fineractPayload.recalculationRestFrequencyInterval = body.recalculation_rest_frequency_interval ?? 1;
    // Force daily calculation period — Fineract requirement
    fineractPayload.interestCalculationPeriodType = 0;
    // Optional recalculation parameters
    if (body.recalculation_compounding_frequency_type != null) {
      fineractPayload.recalculationCompoundingFrequencyType = body.recalculation_compounding_frequency_type;
    }
    if (body.recalculation_compounding_frequency_interval != null) {
      fineractPayload.recalculationCompoundingFrequencyInterval = body.recalculation_compounding_frequency_interval;
    }
    if (body.is_arrears_based_on_original_schedule != null) {
      fineractPayload.isArrearsBasedOnOriginalSchedule = body.is_arrears_based_on_original_schedule;
    }
    if (body.pre_closure_interest_calculation_strategy != null) {
      fineractPayload.preClosureInterestCalculationStrategy = body.pre_closure_interest_calculation_strategy;
    }
    if (body.allow_compounding_on_eod != null) {
      fineractPayload.allowCompoundingOnEod = body.allow_compounding_on_eod;
    }
  }

  // Add GL account mappings when accounting is enabled
  if (accountingRule > 1) {
    fineractPayload.fundSourceAccountId = body.fund_source_account_id;
    fineractPayload.loanPortfolioAccountId = body.loan_portfolio_account_id;
    fineractPayload.transfersInSuspenseAccountId = body.transfers_in_suspense_account_id;
    fineractPayload.interestOnLoanAccountId = body.interest_on_loan_account_id;
    fineractPayload.incomeFromFeeAccountId = body.income_from_fee_account_id;
    fineractPayload.incomeFromPenaltyAccountId = body.income_from_penalty_account_id;
    fineractPayload.writeOffAccountId = body.write_off_account_id;
    fineractPayload.overpaymentLiabilityAccountId = body.overpayment_liability_account_id;
    fineractPayload.incomeFromRecoveryAccountId = body.income_from_recovery_account_id;
  }
  if (accountingRule >= 3) {
    fineractPayload.receivableInterestAccountId = body.receivable_interest_account_id;
    fineractPayload.receivableFeeAccountId = body.receivable_fee_account_id;
    fineractPayload.receivablePenaltyAccountId = body.receivable_penalty_account_id;
  }

  // ─── Create in Fineract FIRST ───
  let fineractProductId: number;
  try {
    const fineract = await getFineractClient();
    const result = await fineract.createLoanProduct(fineractPayload);
    fineractProductId = result.resourceId;

    logger.info('Fineract product created', {
      action: 'admin.products.fineract-create',
      status: 'completed',
      metadata: { fineractProductId, productCode: body.product_code },
    });
  } catch (error) {
    const apiError = error instanceof FineractApiError ? error : null;
    const errorMessage = error instanceof Error ? error.message : String(error);

    // Orphan recovery: if Fineract says duplicate name, find and link it
    if (apiError?.statusCode === 409 || (apiError?.errorBody?.errors?.some(
      (e) => e.defaultUserMessage?.includes('duplicate') || e.defaultUserMessage?.includes('already exists')
    ))) {
      try {
        const fineract = await getFineractClient();
        const allProducts = await fineract.listLoanProducts();
        const orphan = allProducts.find((p) => p.name === fineractName);
        if (orphan) {
          fineractProductId = orphan.id;
          logger.info('Recovered orphaned Fineract product', {
            action: 'admin.products.fineract-orphan-recovery',
            status: 'completed',
            metadata: { fineractProductId: orphan.id, productCode: body.product_code },
          });
          // Fall through to DB insert below
        } else {
          return errorResponse(`Fineract reports duplicate but product not found: ${errorMessage}`, 502, { code: 'PAY_PROV_001' }, event);
        }
      } catch (recoveryError) {
        return errorResponse(`Fineract creation failed and orphan recovery failed: ${errorMessage}`, 502, { code: 'PAY_PROV_001' }, event);
      }
    } else {
      const validationErrors = apiError?.errorBody?.errors?.map((e) => ({
        field: e.parameterName,
        message: e.defaultUserMessage,
      }));

      logger.error('Fineract product creation failed', {
        action: 'admin.products.fineract-create',
        status: 'failed',
        errorMessage,
        metadata: { statusCode: apiError?.statusCode, productCode: body.product_code },
      });

      return errorResponse(
        `Failed to create product in Fineract: ${errorMessage}`,
        apiError?.statusCode && apiError.statusCode >= 400 && apiError.statusCode < 500 ? 400 : 502,
        { code: 'PAY_PROV_001', validation_errors: validationErrors },
        event
      );
    }
  }

  // ─── Fineract succeeded — now save to Lynia DB ───
  const insertData: Record<string, unknown> = {
    // Lynia-specific
    product_code: body.product_code,
    product_name: body.product_name,
    product_type: body.product_type,
    product_category: body.product_category,
    status: body.status || 'active',
    min_amount_usd: body.min_amount_usd,
    max_amount_usd: body.max_amount_usd,
    loan_term_months: body.max_term_months,
    interest_rate_annual: body.interest_rate_annual,
    interest_rate_monthly: body.interest_rate_monthly,
    deposit_percentage: body.deposit_percentage || 0,
    min_deposit_usd: body.min_deposit_usd || 0,
    min_term_months: body.min_term_months,
    max_term_months: body.max_term_months,
    requires_device: body.requires_device || false,
    requires_organization_verification: body.requires_organization_verification || false,
    allowed_disbursement_methods: body.allowed_disbursement_methods
      ? JSON.stringify(
          typeof body.allowed_disbursement_methods === 'string'
            ? JSON.parse(body.allowed_disbursement_methods)
            : body.allowed_disbursement_methods
        )
      : '["ecocash"]',
    max_active_loans: body.max_active_loans || 1,
    display_order: body.display_order || 0,
    description: body.description || null,
    // Fineract link
    fineract_product_id: fineractProductId!,
    // Fineract core parameters
    short_name: body.short_name.toUpperCase(),
    currency_code: body.currency_code || 'USD',
    digits_after_decimal: body.digits_after_decimal ?? 2,
    in_multiples_of: body.in_multiples_of ?? 1,
    default_principal: body.default_principal,
    number_of_repayments: body.number_of_repayments,
    repayment_every: body.repayment_every ?? 1,
    repayment_frequency_type: body.repayment_frequency_type ?? 2,
    amortization_type: body.amortization_type ?? 0,
    interest_type: body.interest_type ?? 0,
    interest_calculation_period_type: body.interest_calculation_period_type ?? 1,
    interest_rate_frequency_type: body.interest_rate_frequency_type ?? 2,
    transaction_processing_strategy: body.transaction_processing_strategy || 'mifos-standard-strategy',
    accounting_rule: accountingRule,
    days_in_year_type: body.days_in_year_type ?? 365,
    days_in_month_type: body.days_in_month_type ?? 30,
    is_interest_recalculation_enabled: body.is_interest_recalculation_enabled ?? false,
    interest_recalculation_compounding_method: body.interest_recalculation_compounding_method ?? null,
    reschedule_strategy_method: body.reschedule_strategy_method ?? null,
    recalculation_rest_frequency_type: body.recalculation_rest_frequency_type ?? null,
    recalculation_rest_frequency_interval: body.recalculation_rest_frequency_interval ?? null,
    recalculation_compounding_frequency_type: body.recalculation_compounding_frequency_type ?? null,
    recalculation_compounding_frequency_interval: body.recalculation_compounding_frequency_interval ?? null,
    is_arrears_based_on_original_schedule: body.is_arrears_based_on_original_schedule ?? null,
    pre_closure_interest_calculation_strategy: body.pre_closure_interest_calculation_strategy ?? null,
    allow_compounding_on_eod: body.allow_compounding_on_eod ?? null,
    min_interest_rate: body.min_interest_rate || null,
    max_interest_rate: body.max_interest_rate || null,
    // GL account mappings
    fund_source_account_id: body.fund_source_account_id || null,
    loan_portfolio_account_id: body.loan_portfolio_account_id || null,
    transfers_in_suspense_account_id: body.transfers_in_suspense_account_id || null,
    interest_on_loan_account_id: body.interest_on_loan_account_id || null,
    income_from_fee_account_id: body.income_from_fee_account_id || null,
    income_from_penalty_account_id: body.income_from_penalty_account_id || null,
    write_off_account_id: body.write_off_account_id || null,
    overpayment_liability_account_id: body.overpayment_liability_account_id || null,
    receivable_interest_account_id: body.receivable_interest_account_id || null,
    receivable_fee_account_id: body.receivable_fee_account_id || null,
    receivable_penalty_account_id: body.receivable_penalty_account_id || null,
    income_from_recovery_account_id: body.income_from_recovery_account_id || null,
    // Timestamps
    fineract_synced_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const { data: created, error } = await db.from('loan_products').insert(insertData).execute();

  if (error) {
    logger.error('Error saving product to DB after Fineract creation', {
      action: 'admin.products.create',
      status: 'failed',
      errorMessage: error.message,
      metadata: { fineractProductId: fineractProductId!, productCode: body.product_code },
    });
    return errorResponse('Product created in Fineract but failed to save to database. Contact support.', 500, { fineract_product_id: fineractProductId! }, event);
  }

  const row = Array.isArray(created) ? created[0] : created;

  await auditLog(auth, 'product.create', 'loan_product', row.id as string, `Created product: ${body.product_code} (Fineract #${fineractProductId!})`, {
    product_code: body.product_code,
    product_category: body.product_category,
    fineract_product_id: fineractProductId!,
  });

  return successResponse(
    { ...row, fineract_sync_status: 'synced' },
    201,
    event
  );
};

// ─── PATCH /admin/products/:id ───
// Fineract-first: update in Fineract first (if linked), then update Lynia DB.

export const handleUpdateProduct: RouteHandler = async (event, params, auth) => {
  const id = params.id;

  if (!isAdminOrManager(auth)) {
    return errorResponse('Insufficient permissions', 403, {}, event);
  }

  const body = JSON.parse(event.body || '{}');

  // Fetch existing product
  const { data: existingProduct } = await db.from('loan_products')
    .select('*')
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle()
    .execute();

  if (!existingProduct) {
    return errorResponse('Product not found', 404, {}, event);
  }

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };

  const allowedFields = [
    // Lynia-specific
    'product_name', 'product_type', 'status', 'min_amount_usd', 'max_amount_usd',
    'loan_term_months', 'interest_rate_annual', 'deposit_percentage', 'min_deposit_usd',
    'min_term_months', 'max_term_months', 'interest_rate_monthly', 'requires_device',
    'requires_organization_verification', 'allowed_disbursement_methods', 'max_active_loans',
    'display_order', 'description',
    // Fineract core parameters
    'short_name', 'currency_code', 'digits_after_decimal', 'in_multiples_of',
    'default_principal', 'number_of_repayments', 'repayment_every',
    'repayment_frequency_type', 'amortization_type', 'interest_type',
    'interest_calculation_period_type', 'interest_rate_frequency_type',
    'transaction_processing_strategy', 'accounting_rule',
    'min_interest_rate', 'max_interest_rate',
    // GL account mappings
    'fund_source_account_id', 'loan_portfolio_account_id',
    'transfers_in_suspense_account_id', 'interest_on_loan_account_id',
    'income_from_fee_account_id', 'income_from_penalty_account_id',
    'write_off_account_id', 'overpayment_liability_account_id',
    'receivable_interest_account_id', 'receivable_fee_account_id',
    'receivable_penalty_account_id',
  ];

  for (const field of allowedFields) {
    if (body[field] !== undefined) {
      if (field === 'allowed_disbursement_methods' && typeof body[field] !== 'string') {
        updates[field] = JSON.stringify(body[field]);
      } else if (field === 'short_name' && typeof body[field] === 'string') {
        updates[field] = body[field].toUpperCase();
      } else {
        updates[field] = body[field];
      }
    }
  }

  // If product is linked to Fineract, update there first
  const fineractProductId = existingProduct.fineract_product_id as number | null;
  if (fineractProductId) {
    const fineractUpdates: Partial<FineractLoanProductCreateRequest> = {};
    let hasFineractChanges = false;

    // Map changed fields to Fineract payload
    if (body.product_name !== undefined) { fineractUpdates.name = `Lynia - ${body.product_name}`; hasFineractChanges = true; }
    if (body.short_name !== undefined) { fineractUpdates.shortName = body.short_name.toUpperCase(); hasFineractChanges = true; }
    if (body.description !== undefined) { fineractUpdates.description = body.description; hasFineractChanges = true; }
    if (body.default_principal !== undefined) { fineractUpdates.principal = body.default_principal; hasFineractChanges = true; }
    if (body.min_amount_usd !== undefined) { fineractUpdates.minPrincipal = body.min_amount_usd; hasFineractChanges = true; }
    if (body.max_amount_usd !== undefined) { fineractUpdates.maxPrincipal = body.max_amount_usd; hasFineractChanges = true; }
    if (body.number_of_repayments !== undefined) { fineractUpdates.numberOfRepayments = body.number_of_repayments; hasFineractChanges = true; }
    if (body.min_term_months !== undefined) { fineractUpdates.minNumberOfRepayments = body.min_term_months; hasFineractChanges = true; }
    if (body.max_term_months !== undefined) { fineractUpdates.maxNumberOfRepayments = body.max_term_months; hasFineractChanges = true; }
    if (body.interest_rate_monthly !== undefined) { fineractUpdates.interestRatePerPeriod = body.interest_rate_monthly; hasFineractChanges = true; }
    if (body.min_interest_rate !== undefined) { fineractUpdates.minInterestRatePerPeriod = body.min_interest_rate; hasFineractChanges = true; }
    if (body.max_interest_rate !== undefined) { fineractUpdates.maxInterestRatePerPeriod = body.max_interest_rate; hasFineractChanges = true; }
    if (body.repayment_every !== undefined) { fineractUpdates.repaymentEvery = body.repayment_every; hasFineractChanges = true; }
    if (body.repayment_frequency_type !== undefined) { fineractUpdates.repaymentFrequencyType = body.repayment_frequency_type; hasFineractChanges = true; }
    if (body.amortization_type !== undefined) { fineractUpdates.amortizationType = body.amortization_type; hasFineractChanges = true; }
    if (body.interest_type !== undefined) { fineractUpdates.interestType = body.interest_type; hasFineractChanges = true; }
    if (body.interest_calculation_period_type !== undefined) { fineractUpdates.interestCalculationPeriodType = body.interest_calculation_period_type; hasFineractChanges = true; }
    if (body.accounting_rule !== undefined) { fineractUpdates.accountingRule = body.accounting_rule; hasFineractChanges = true; }

    if (hasFineractChanges) {
      // Fineract PUT requires locale/dateFormat
      fineractUpdates.locale = 'en';
      fineractUpdates.dateFormat = 'dd MMMM yyyy';

      try {
        const fineract = await getFineractClient();
        await fineract.updateLoanProduct(fineractProductId, fineractUpdates);

        logger.info('Fineract product updated', {
          action: 'admin.products.fineract-update',
          status: 'completed',
          metadata: { fineractProductId, productId: id },
        });
      } catch (error) {
        const apiError = error instanceof FineractApiError ? error : null;
        const errorMessage = error instanceof Error ? error.message : String(error);

        logger.error('Fineract product update failed', {
          action: 'admin.products.fineract-update',
          status: 'failed',
          errorMessage,
        });

        return errorResponse(
          `Failed to update product in Fineract: ${errorMessage}`,
          apiError?.statusCode && apiError.statusCode >= 400 && apiError.statusCode < 500 ? 400 : 502,
          { code: 'PAY_PROV_001' },
          event
        );
      }
    }
  }

  // Update Lynia DB
  const { data: updated, error } = await db.from('loan_products')
    .update(updates)
    .eq('id', id)
    .is('deleted_at', null)
    .execute();

  if (error) {
    logger.error('Error updating product', {
      action: 'admin.products.update',
      status: 'failed',
      errorMessage: error.message,
    });
    return errorResponse('Failed to update product', 500, {}, event);
  }

  const row = Array.isArray(updated) ? updated[0] : updated;
  if (!row) {
    return errorResponse('Product not found', 404, {}, event);
  }

  await auditLog(auth, 'product.update', 'loan_product', id, `Updated product: ${id}`, updates);

  return successResponse(
    { ...row, fineract_sync_status: row.fineract_product_id ? 'synced' : 'not_linked' },
    200,
    event
  );
};

// ─── DELETE /admin/products/:id ───

export const handleDeleteProduct: RouteHandler = async (event, params, auth) => {
  const id = params.id;

  if (!isAdminOrManager(auth)) {
    return errorResponse('Insufficient permissions', 403, {}, event);
  }

  // Safety check: cannot delete if product has active loans
  const { data: activeLoanRows } = await query<{ count: string }>(
    `SELECT COUNT(*) as count FROM loans WHERE product_id = $1 AND status IN ('active', 'disbursed', 'approved')`,
    [id]
  );
  const activeCount = parseInt(activeLoanRows[0]?.count || '0');

  if (activeCount > 0) {
    return errorResponse('Cannot delete product with active loans', 400, { active_loans: activeCount }, event);
  }

  const { data: deleted, error } = await db.from('loan_products')
    .update({ deleted_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq('id', id)
    .is('deleted_at', null)
    .execute();

  if (error) {
    logger.error('Error deleting product', {
      action: 'admin.products.delete',
      status: 'failed',
      errorMessage: error.message,
    });
    return errorResponse('Failed to delete product', 500, {}, event);
  }

  const row = Array.isArray(deleted) ? deleted[0] : deleted;
  if (!row) {
    return errorResponse('Product not found', 404, {}, event);
  }

  await auditLog(auth, 'product.delete', 'loan_product', id, `Soft-deleted product: ${id}`);

  return successResponse({ message: 'Product deleted successfully' }, 200, event);
};

// ─── GET /admin/products/:id/device-models ───

export const handleGetProductDeviceModels: RouteHandler = async (event, params, auth) => {
  if (!isAdminOrManager(auth)) {
    return errorResponse('Insufficient permissions', 403, {}, event);
  }

  const productId = params.id;

  const { data: rows, error } = await query<{
    id: string; device_model_id: string; brand: string; model_name: string; model_code: string;
    retail_price_usd: string; wholesale_price_usd: string; available_stock: string; is_active: boolean;
    storage_gb: string | null;
  }>(
    `SELECT pdm.id, pdm.device_model_id, dm.brand, dm.model_name, dm.model_code,
            dm.retail_price_usd, dm.wholesale_price_usd, dm.available_stock, dm.is_active, dm.storage_gb
     FROM product_device_models pdm
     JOIN device_models dm ON dm.id = pdm.device_model_id AND dm.deleted_at IS NULL
     WHERE pdm.product_id = $1
     ORDER BY dm.brand, dm.model_name`,
    [productId]
  );

  if (error) {
    return errorResponse('Failed to fetch linked device models', 500, {}, event);
  }

  return successResponse({ data: rows || [] }, 200, event);
};

// ─── POST /admin/products/:id/device-models ───

export const handleLinkDeviceModel: RouteHandler = async (event, params, auth) => {
  if (!isAdminOrManager(auth)) {
    return errorResponse('Insufficient permissions', 403, {}, event);
  }

  const productId = params.id;
  const body = JSON.parse(event.body || '{}');
  const deviceModelIds: string[] = body.device_model_ids;

  if (!deviceModelIds || !Array.isArray(deviceModelIds) || deviceModelIds.length === 0) {
    return errorResponse('device_model_ids array is required', 400, { code: 'VAL_REQ_001' }, event);
  }

  // Verify product exists
  const { data: product } = await db.from('loan_products')
    .select('id, product_category')
    .eq('id', productId)
    .is('deleted_at', null)
    .maybeSingle()
    .execute();

  if (!product) {
    return errorResponse('Product not found', 404, {}, event);
  }

  // Insert links (ignore duplicates)
  const values = deviceModelIds.map((_, i) => `($1, $${i + 2}, now())`).join(', ');
  const insertParams = [productId, ...deviceModelIds];

  const { error } = await query(
    `INSERT INTO product_device_models (product_id, device_model_id, created_at)
     VALUES ${values}
     ON CONFLICT (product_id, device_model_id) DO NOTHING`,
    insertParams
  );

  if (error) {
    logger.error('Error linking device models', {
      action: 'admin.products.linkDeviceModels',
      status: 'failed',
      errorMessage: error.message,
    });
    return errorResponse('Failed to link device models', 500, {}, event);
  }

  await auditLog(auth, 'product.linkDeviceModels', 'loan_product', productId,
    `Linked ${deviceModelIds.length} device model(s) to product`, { device_model_ids: deviceModelIds });

  return successResponse({ message: `Linked ${deviceModelIds.length} device model(s)` }, 200, event);
};

// ─── DELETE /admin/products/:id/device-models/:modelId ───

export const handleUnlinkDeviceModel: RouteHandler = async (event, params, auth) => {
  if (!isAdminOrManager(auth)) {
    return errorResponse('Insufficient permissions', 403, {}, event);
  }

  const productId = params.id;
  const modelId = params.modelId;

  const { error } = await query(
    `DELETE FROM product_device_models WHERE product_id = $1 AND device_model_id = $2`,
    [productId, modelId]
  );

  if (error) {
    logger.error('Error unlinking device model', {
      action: 'admin.products.unlinkDeviceModel',
      status: 'failed',
      errorMessage: error.message,
    });
    return errorResponse('Failed to unlink device model', 500, {}, event);
  }

  await auditLog(auth, 'product.unlinkDeviceModel', 'loan_product', productId,
    `Unlinked device model ${modelId} from product`, { device_model_id: modelId });

  return successResponse({ message: 'Device model unlinked' }, 200, event);
};

// ─── GET /admin/products/fineract-defaults ───
// Returns sensible default values for the product creation wizard.

export const handleGetFineractDefaults: RouteHandler = async (event, _params, auth) => {
  if (!isAdminOrManager(auth)) {
    return errorResponse('Insufficient permissions', 403, {}, event);
  }

  // Try to fetch GL accounts from Fineract to pre-populate defaults
  let glAccountDefaults: Record<string, number | undefined> = {};
  try {
    const fineract = await getFineractClient();
    const glAccounts = await fineract.listGLAccounts();

    // Map GL accounts by code to their Fineract IDs (using chart-of-accounts.json codes)
    const byCode: Record<string, number> = {};
    for (const acct of glAccounts) {
      if (acct.usage?.id === 2) { // Detail accounts only (not headers)
        byCode[acct.glCode] = acct.id;
      }
    }

    glAccountDefaults = {
      fund_source_account_id: byCode['1001'],
      loan_portfolio_account_id: byCode['1100'],
      interest_on_loan_account_id: byCode['4001'],
      income_from_fee_account_id: byCode['4002'],
      income_from_penalty_account_id: byCode['4003'],
      write_off_account_id: byCode['5001'],
      overpayment_liability_account_id: byCode['2001'],
      transfers_in_suspense_account_id: byCode['2100'],
      receivable_interest_account_id: byCode['1200'],
      receivable_fee_account_id: byCode['1300'],
      receivable_penalty_account_id: byCode['1400'],
    };
  } catch {
    // Fineract unreachable — return defaults without GL IDs
    logger.warn('Could not fetch GL accounts from Fineract for defaults', {
      action: 'admin.products.fineract-defaults',
      status: 'failed',
    });
  }

  return successResponse({
    currency_code: 'USD',
    digits_after_decimal: 2,
    in_multiples_of: 1,
    repayment_every: 1,
    repayment_frequency_type: 2, // months
    interest_rate_frequency_type: 2, // per month
    amortization_type: 0, // equal installments
    interest_type: 0, // declining balance
    interest_calculation_period_type: 1, // same as repayment
    transaction_processing_strategy: 'mifos-standard-strategy',
    accounting_rule: 3, // accrual (RBZ compliance)
    ...glAccountDefaults,
  }, 200, event);
};

// ─── GET /admin/products/gl-accounts ───
// Proxy to Fineract GL accounts, grouped by type for dropdown population.

export const handleGetGLAccounts: RouteHandler = async (event, _params, auth) => {
  if (!isAdminOrManager(auth)) {
    return errorResponse('Insufficient permissions', 403, {}, event);
  }

  try {
    const fineract = await getFineractClient();
    const accounts = await fineract.listGLAccounts();

    // Filter to detail accounts only (usage.id === 2, i.e., postable)
    const detailAccounts = accounts.filter((a) => a.usage?.id === 2);

    // Group by type for dropdown filtering
    const grouped: Record<string, typeof detailAccounts> = {
      asset: [],     // type.id === 1
      liability: [], // type.id === 2
      equity: [],    // type.id === 3
      income: [],    // type.id === 4
      expense: [],   // type.id === 5
    };

    for (const acct of detailAccounts) {
      const typeId = acct.type?.id;
      if (typeId === 1) grouped.asset.push(acct);
      else if (typeId === 2) grouped.liability.push(acct);
      else if (typeId === 3) grouped.equity.push(acct);
      else if (typeId === 4) grouped.income.push(acct);
      else if (typeId === 5) grouped.expense.push(acct);
    }

    return successResponse({ accounts: detailAccounts, grouped }, 200, event);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('Failed to fetch GL accounts from Fineract', {
      action: 'admin.products.gl-accounts',
      status: 'failed',
      errorMessage,
    });
    return errorResponse(`Failed to fetch GL accounts from Fineract: ${errorMessage}`, 502, {}, event);
  }
};

// ─── POST /admin/products/recover-from-fineract ───
// Recovers an orphaned Fineract product by fetching it from Fineract
// and creating the corresponding Lynia DB record.

export const handleRecoverProductFromFineract: RouteHandler = async (event, _params, auth) => {
  if (!isAdminOrManager(auth)) {
    return errorResponse('Insufficient permissions', 403, {}, event);
  }

  const body = JSON.parse(event.body || '{}');

  // Validate required fields
  const fineractProductId = body.fineract_product_id;
  if (!fineractProductId || typeof fineractProductId !== 'number' || fineractProductId <= 0) {
    return errorResponse('fineract_product_id must be a positive integer', 400, { code: 'VAL_FMT_001' }, event);
  }

  if (!body.product_code || !PRODUCT_CODE_REGEX.test(body.product_code)) {
    return errorResponse('product_code is required and must be alphanumeric with underscores, max 50 chars', 400, { code: 'VAL_FMT_001' }, event);
  }

  if (!body.product_category || !VALID_PRODUCT_CATEGORIES.includes(body.product_category)) {
    return errorResponse('product_category is required and must be smartphone or digital', 400, { code: 'VAL_FMT_001' }, event);
  }

  if (!body.product_type) {
    return errorResponse('product_type is required', 400, { code: 'VAL_REQ_001' }, event);
  }

  // Check no existing Lynia product is linked to this Fineract product
  const { data: existingLinked } = await query<{ id: string }>(
    `SELECT id FROM loan_products WHERE fineract_product_id = $1 AND deleted_at IS NULL`,
    [fineractProductId]
  );
  if (existingLinked.length > 0) {
    return errorResponse('A Lynia product is already linked to this Fineract product', 409, { existing_product_id: existingLinked[0].id }, event);
  }

  // Check product_code uniqueness
  const { data: existingCode } = await query<{ id: string }>(
    `SELECT id FROM loan_products WHERE product_code = $1 AND deleted_at IS NULL`,
    [body.product_code]
  );
  if (existingCode.length > 0) {
    return errorResponse('A product with this product_code already exists', 409, {}, event);
  }

  // Fetch product from Fineract
  let fineractProduct;
  try {
    const fineract = await getFineractClient();
    fineractProduct = await fineract.getLoanProduct(fineractProductId);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const apiError = error instanceof FineractApiError ? error : null;
    if (apiError?.statusCode === 404) {
      return errorResponse('Fineract product not found', 404, {}, event);
    }
    return errorResponse(`Failed to fetch product from Fineract: ${errorMessage}`, 502, {}, event);
  }

  // Strip "Lynia - " prefix from Fineract name for product_name
  const productName = fineractProduct.name.replace(/^Lynia\s*-\s*/, '');

  // Map Fineract fields → Lynia columns
  const insertData: Record<string, unknown> = {
    // Lynia-specific (from request body)
    product_code: body.product_code,
    product_name: productName,
    product_type: body.product_type,
    product_category: body.product_category,
    status: body.status || 'active',
    deposit_percentage: body.deposit_percentage ?? 0,
    min_deposit_usd: body.min_deposit_usd ?? 0,
    requires_device: body.requires_device ?? false,
    requires_organization_verification: body.requires_organization_verification ?? false,
    allowed_disbursement_methods: body.allowed_disbursement_methods
      ? JSON.stringify(
          typeof body.allowed_disbursement_methods === 'string'
            ? JSON.parse(body.allowed_disbursement_methods)
            : body.allowed_disbursement_methods
        )
      : '["ecocash"]',
    max_active_loans: body.max_active_loans ?? 1,
    display_order: body.display_order ?? 0,
    description: body.description || fineractProduct.description || null,
    // Fineract-derived fields
    min_amount_usd: fineractProduct.minPrincipal,
    max_amount_usd: fineractProduct.maxPrincipal,
    default_principal: fineractProduct.principal,
    loan_term_months: fineractProduct.numberOfRepayments,
    interest_rate_monthly: fineractProduct.interestRatePerPeriod,
    interest_rate_annual: fineractProduct.annualInterestRate,
    min_term_months: body.min_term_months ?? fineractProduct.minNumberOfRepayments ?? 1,
    max_term_months: body.max_term_months ?? fineractProduct.maxNumberOfRepayments ?? fineractProduct.numberOfRepayments,
    number_of_repayments: fineractProduct.numberOfRepayments,
    // Fineract core parameters
    short_name: fineractProduct.shortName,
    currency_code: fineractProduct.currency?.code || 'USD',
    digits_after_decimal: fineractProduct.currency?.decimalPlaces ?? 2,
    in_multiples_of: fineractProduct.currency?.inMultiplesOf ?? 1,
    repayment_every: fineractProduct.repaymentEvery,
    repayment_frequency_type: fineractProduct.repaymentFrequencyType?.id ?? 2,
    amortization_type: fineractProduct.amortizationType?.id ?? 0,
    interest_type: fineractProduct.interestType?.id ?? 0,
    interest_calculation_period_type: fineractProduct.interestCalculationPeriodType?.id ?? 1,
    interest_rate_frequency_type: fineractProduct.interestRateFrequencyType?.id ?? 2,
    transaction_processing_strategy: fineractProduct.transactionProcessingStrategyCode || 'mifos-standard-strategy',
    accounting_rule: fineractProduct.accountingRule?.id ?? 1,
    min_interest_rate: fineractProduct.minInterestRatePerPeriod ?? null,
    max_interest_rate: fineractProduct.maxInterestRatePerPeriod ?? null,
    days_in_year_type: fineractProduct.daysInYearType?.id ?? 365,
    days_in_month_type: fineractProduct.daysInMonthType?.id ?? 30,
    is_interest_recalculation_enabled: fineractProduct.isInterestRecalculationEnabled ?? false,
    // GL account mappings from Fineract accountingMappings
    fund_source_account_id: fineractProduct.accountingMappings?.fundSourceAccountId?.id ?? null,
    loan_portfolio_account_id: fineractProduct.accountingMappings?.loanPortfolioAccountId?.id ?? null,
    transfers_in_suspense_account_id: fineractProduct.accountingMappings?.transfersInSuspenseAccountId?.id ?? null,
    interest_on_loan_account_id: fineractProduct.accountingMappings?.interestOnLoanAccountId?.id ?? null,
    income_from_fee_account_id: fineractProduct.accountingMappings?.incomeFromFeeAccountId?.id ?? null,
    income_from_penalty_account_id: fineractProduct.accountingMappings?.incomeFromPenaltyAccountId?.id ?? null,
    write_off_account_id: fineractProduct.accountingMappings?.writeOffAccountId?.id ?? null,
    overpayment_liability_account_id: fineractProduct.accountingMappings?.overpaymentLiabilityAccountId?.id ?? null,
    receivable_interest_account_id: fineractProduct.accountingMappings?.receivableInterestAccountId?.id ?? null,
    receivable_fee_account_id: fineractProduct.accountingMappings?.receivableFeeAccountId?.id ?? null,
    receivable_penalty_account_id: fineractProduct.accountingMappings?.receivablePenaltyAccountId?.id ?? null,
    income_from_recovery_account_id: fineractProduct.accountingMappings?.incomeFromRecoveryAccountId?.id ?? null,
    // Fineract link
    fineract_product_id: fineractProductId,
    fineract_synced_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const { data: created, error } = await db.from('loan_products').insert(insertData).execute();

  if (error) {
    logger.error('Error saving recovered product to DB', {
      action: 'admin.products.recover-from-fineract',
      status: 'failed',
      errorMessage: error.message,
      metadata: { fineractProductId, productCode: body.product_code },
    });
    return errorResponse(`Failed to save recovered product to database: ${error.message}`, 500, { fineract_product_id: fineractProductId }, event);
  }

  const row = Array.isArray(created) ? created[0] : created;

  await auditLog(auth, 'product.recover-from-fineract', 'loan_product', row.id as string,
    `Recovered orphaned Fineract product #${fineractProductId} as ${body.product_code}`, {
      product_code: body.product_code,
      product_category: body.product_category,
      fineract_product_id: fineractProductId,
    });

  logger.info('Product recovered from Fineract', {
    action: 'admin.products.recover-from-fineract',
    status: 'completed',
    metadata: { productId: row.id, fineractProductId, productCode: body.product_code },
  });

  return successResponse(
    { ...row, fineract_sync_status: 'synced' },
    201,
    event
  );
};
