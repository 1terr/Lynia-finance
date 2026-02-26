/**
 * RBZ Report Validation
 */

import type {
  FineractRBZReportType,
  RBZReportValidationResult,
} from '../types/rbz-reports';

/* eslint-disable @typescript-eslint/no-explicit-any */

export function validateRBZReport(
  reportType: FineractRBZReportType,
  data: Record<string, unknown>
): RBZReportValidationResult {
  const errors: RBZReportValidationResult['errors'] = [];
  let completenessScore = 100;
  const dataSources: Array<'lynia_db' | 'fineract'> = ['lynia_db'];

  // Check required fields based on report type
  const requiredFieldsByType: Record<string, string[]> = {
    monthly_transaction_summary: ['reportingPeriod', 'totalTransactions', 'transactionsByType'],
    gl_trial_balance: ['accounts', 'totals'],
    prudential_return: ['balanceSheet', 'incomeStatement', 'portfolioQuality', 'capitalAdequacy'],
    capital_adequacy: ['tier1Capital', 'tier2Capital', 'riskWeightedAssets', 'ratios'],
    npl_analysis: ['summary', 'agingBuckets', 'provisionRequirements'],
    large_transaction_report: ['transactions', 'summary'],
    suspicious_transaction_report: ['subject', 'suspiciousActivity', 'transactionAnalysis'],
    annual_compliance_audit: ['kycCompliance', 'amlCompliance', 'dataPrivacy', 'regulatoryFilings'],
  };

  const requiredFields = requiredFieldsByType[reportType] || [];
  for (const field of requiredFields) {
    if (!(field in data)) {
      errors.push({
        field,
        message: `Required field '${field}' is missing`,
        severity: 'error',
      });
      completenessScore -= 10;
    }
  }

  // Check Fineract-sourced reports
  if (['gl_trial_balance', 'npl_analysis', 'loan_portfolio_fineract'].includes(reportType)) {
    dataSources.push('fineract');
  }

  // Validate GL trial balance is balanced
  if (reportType === 'gl_trial_balance' && data.totals) {
    const totals = data.totals as { isBalanced: boolean; variance: number };
    if (!totals.isBalanced) {
      errors.push({
        field: 'totals.isBalanced',
        message: `GL trial balance is not balanced (variance: ${totals.variance})`,
        severity: 'error',
      });
      completenessScore -= 20;
    }
  }

  // Validate capital adequacy compliance
  if (reportType === 'capital_adequacy' && data.rbzMinimumRequirements) {
    const reqs = data.rbzMinimumRequirements as { isCompliant: boolean; shortfall: number };
    if (!reqs.isCompliant) {
      errors.push({
        field: 'rbzMinimumRequirements.isCompliant',
        message: `Capital adequacy below minimum (shortfall: $${reqs.shortfall})`,
        severity: 'warning',
      });
    }
  }

  completenessScore = Math.max(0, completenessScore);

  return {
    reportType,
    isValid: errors.filter(e => e.severity === 'error').length === 0,
    errors,
    completenessScore,
    dataSourcesUsed: dataSources,
    reconciliationStatus: dataSources.includes('fineract') ? 'matched' : 'not_applicable',
  };
}
