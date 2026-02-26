/**
 * RBZ Report Dispatcher
 *
 * Routes report generation requests to the appropriate generator
 * and persists the result with a full audit trail.
 */

import { db } from '../clients/database';
import { logger } from '../utils/logger';
import { computeChecksum } from './helpers';
import type { RBZReportConfig, RBZGeneratedReport } from '../types/rbz-reports';

import { generateMonthlyTransactionSummary } from './reports/monthly-transaction-summary';
import { generateGLTrialBalance } from './reports/gl-trial-balance';
import { generatePrudentialReturn } from './reports/prudential-return';
import { generateCapitalAdequacy } from './reports/capital-adequacy';
import { generateNPLAnalysis } from './reports/npl-analysis';
import { generateLargeTransactionReport } from './reports/large-transaction-report';
import { generateForeignCurrencyExposure } from './reports/foreign-currency-exposure';
import { generateInterestRateSchedule } from './reports/interest-rate-schedule';
import { generateAnnualComplianceAudit } from './reports/annual-compliance-audit';
import { generateLoanPortfolioFineract } from './reports/loan-portfolio-fineract';

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Generate any RBZ report by type.
 * Routes to the appropriate generator and persists the result.
 */
export async function generateRBZReport(
  config: RBZReportConfig
): Promise<RBZGeneratedReport> {
  const op = logger.startOperation('rbz.report.generate', {
    reportType: config.reportType,
    periodStart: config.periodStart.toISOString(),
    periodEnd: config.periodEnd.toISOString(),
  });

  try {
    let data: Record<string, unknown>;

    switch (config.reportType) {
      case 'monthly_transaction_summary':
        data = (await generateMonthlyTransactionSummary(config)) as unknown as Record<string, unknown>;
        break;
      case 'gl_trial_balance':
        data = (await generateGLTrialBalance(config)) as unknown as Record<string, unknown>;
        break;
      case 'prudential_return':
        data = (await generatePrudentialReturn(config)) as unknown as Record<string, unknown>;
        break;
      case 'capital_adequacy':
        data = (await generateCapitalAdequacy(config)) as unknown as Record<string, unknown>;
        break;
      case 'npl_analysis':
        data = (await generateNPLAnalysis(config)) as unknown as Record<string, unknown>;
        break;
      case 'large_transaction_report':
        data = (await generateLargeTransactionReport(config)) as unknown as Record<string, unknown>;
        break;
      case 'foreign_currency_exposure':
        data = (await generateForeignCurrencyExposure(config)) as unknown as Record<string, unknown>;
        break;
      case 'interest_rate_schedule':
        data = (await generateInterestRateSchedule(config)) as unknown as Record<string, unknown>;
        break;
      case 'annual_compliance_audit':
        data = (await generateAnnualComplianceAudit(config)) as unknown as Record<string, unknown>;
        break;
      case 'loan_portfolio_fineract':
        data = (await generateLoanPortfolioFineract(config)) as unknown as Record<string, unknown>;
        break;
      default:
        throw new Error(`Unknown report type: ${config.reportType}`);
    }

    const checksum = computeChecksum(data);

    const report: RBZGeneratedReport = {
      reportType: config.reportType,
      frequency: config.frequency,
      periodStart: config.periodStart,
      periodEnd: config.periodEnd,
      generatedBy: config.generatedBy,
      generatedAt: new Date(),
      data,
      status: 'generated',
      fineractSourced: config.includesFineractData,
      checksum,
    };

    // Persist to database
    const { data: saved } = await db.from('fineract_rbz_reports').insert({
      report_type: report.reportType,
      frequency: report.frequency,
      period_start: report.periodStart,
      period_end: report.periodEnd,
      currency: config.currency,
      generated_by: report.generatedBy,
      generated_at: report.generatedAt,
      data: report.data,
      status: report.status,
      fineract_sourced: report.fineractSourced,
      checksum: report.checksum,
    }).execute();

    if (saved?.[0]?.id) {
      report.id = saved[0].id;
    }

    // Log audit trail
    await db.from('audit_log').insert({
      action: 'rbz_report_generated',
      entity_type: 'fineract_rbz_report',
      entity_id: report.id || 'unknown',
      performed_by: config.generatedBy,
      details: {
        reportType: config.reportType,
        periodStart: config.periodStart.toISOString(),
        periodEnd: config.periodEnd.toISOString(),
        fineractSourced: config.includesFineractData,
      },
      created_at: new Date(),
    }).execute();

    op.succeed({ reportId: report.id });
    return report;
  } catch (error) {
    op.fail(error);
    throw error;
  }
}
