/**
 * RBZ Reporting — Barrel Re-export
 *
 * All public API surfaces are re-exported here so that external consumers
 * can import from './rbz-reporting' (or from the backward-compatible
 * '../fineract-rbz-reporting' barrel).
 */

// Dispatcher
export { generateRBZReport } from './dispatcher';

// Individual report generators
export { generateMonthlyTransactionSummary } from './reports/monthly-transaction-summary';
export { generateGLTrialBalance } from './reports/gl-trial-balance';
export { generatePrudentialReturn } from './reports/prudential-return';
export { generateCapitalAdequacy } from './reports/capital-adequacy';
export { generateNPLAnalysis } from './reports/npl-analysis';
export { generateLargeTransactionReport } from './reports/large-transaction-report';
export { generateEnhancedSTR } from './reports/enhanced-str';
export { generateForeignCurrencyExposure } from './reports/foreign-currency-exposure';
export { generateInterestRateSchedule } from './reports/interest-rate-schedule';
export { generateAnnualComplianceAudit } from './reports/annual-compliance-audit';
export { generateLoanPortfolioFineract } from './reports/loan-portfolio-fineract';

// Validation, management, scheduling
export { validateRBZReport } from './validation';
export { reviewReport, submitReportToRBZ, getRBZReportHistory } from './management';
export { runMonthlyRBZReports, runQuarterlyRBZReports } from './scheduling';

// Helpers (exported for testing)
export {
  filterSum,
  computeChecksum,
  round2,
  formatDateForFineract,
  mapGLAccountType,
  classifyNPL,
  calculateProvisions,
  parPercentage,
} from './helpers';

export {
  INSTITUTION_NAME,
  LICENSE_NUMBER,
  LARGE_TRANSACTION_THRESHOLD_USD,
  RBZ_RATE_CEILING,
} from './helpers';

// Re-export types
export type {
  RBZReportConfig,
  RBZGeneratedReport,
  FineractRBZReportType,
  RBZReportStatus,
  RBZReportFrequency,
} from '../types/rbz-reports';
