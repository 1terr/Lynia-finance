/**
 * RBZ Report Scheduling — Monthly & Quarterly batch runners
 */

import { logger } from '../utils/logger';
import { generateRBZReport } from './dispatcher';
import type {
  RBZGeneratedReport,
  FineractRBZReportType,
  Currency,
} from '../types/rbz-reports';

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Run all monthly RBZ reports (triggered by EventBridge).
 */
export async function runMonthlyRBZReports(generatedBy: string): Promise<RBZGeneratedReport[]> {
  const now = new Date();
  const periodStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const periodEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
  const currency: Currency = 'USD';

  const reportTypes: FineractRBZReportType[] = [
    'monthly_transaction_summary',
    'gl_trial_balance',
    'loan_portfolio_fineract',
  ];

  const results: RBZGeneratedReport[] = [];

  for (const reportType of reportTypes) {
    try {
      const report = await generateRBZReport({
        reportType,
        frequency: 'monthly',
        periodStart,
        periodEnd,
        generatedBy,
        currency,
        includesFineractData: ['gl_trial_balance', 'loan_portfolio_fineract'].includes(reportType),
      });
      results.push(report);
    } catch (error) {
      logger.error(`Failed to generate monthly report: ${reportType}`, {
        action: 'rbz.monthly.report.failed',
        errorMessage: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return results;
}

/**
 * Run all quarterly RBZ reports (triggered by EventBridge).
 */
export async function runQuarterlyRBZReports(generatedBy: string): Promise<RBZGeneratedReport[]> {
  const now = new Date();
  const currentQuarter = Math.floor(now.getMonth() / 3);
  const periodStart = new Date(now.getFullYear(), (currentQuarter - 1) * 3, 1);
  const periodEnd = new Date(now.getFullYear(), currentQuarter * 3, 0, 23, 59, 59);
  const currency: Currency = 'USD';

  const reportTypes: FineractRBZReportType[] = [
    'prudential_return',
    'capital_adequacy',
    'npl_analysis',
    'foreign_currency_exposure',
  ];

  const results: RBZGeneratedReport[] = [];

  for (const reportType of reportTypes) {
    try {
      const report = await generateRBZReport({
        reportType,
        frequency: 'quarterly',
        periodStart,
        periodEnd,
        generatedBy,
        currency,
        includesFineractData: reportType === 'npl_analysis',
      });
      results.push(report);
    } catch (error) {
      logger.error(`Failed to generate quarterly report: ${reportType}`, {
        action: 'rbz.quarterly.report.failed',
        errorMessage: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return results;
}
