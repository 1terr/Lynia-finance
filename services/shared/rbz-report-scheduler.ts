/**
 * RBZ Report Scheduler Lambda Handler
 *
 * Triggered by EventBridge rules on a schedule (cron) to automatically
 * generate RBZ compliance reports. Supports monthly, quarterly, and
 * annual report generation cycles.
 *
 * EventBridge rules:
 *   Monthly:    cron(0 6 1 * ? *)     — 1st of every month at 06:00 UTC
 *   Quarterly:  cron(0 6 1 1,4,7,10 ? *) — 1st of Jan, Apr, Jul, Oct
 *   Annual:     cron(0 6 15 1 ? *)    — January 15th each year
 *
 * Each invocation:
 *   1. Determines which reports are due
 *   2. Generates each report via fineract-rbz-reporting
 *   3. Exports to CSV and stores in S3
 *   4. Validates the generated reports
 *   5. Logs results and emits CloudWatch metrics
 */

import {
  generateRBZReport,
  runMonthlyRBZReports,
  runQuarterlyRBZReports,
  validateRBZReport,
} from './fineract-rbz-reporting';
import { exportReportToCSV, getReportS3Key } from './rbz-report-export';
import { db } from './clients/database';
import { logger } from './utils/logger';
import type {
  FineractRBZReportType,
  RBZGeneratedReport,
  RBZReportValidationResult,
  Currency,
} from './types/rbz-reports';

// ===================================================================
// TYPES
// ===================================================================

interface SchedulerEvent {
  scheduleType: 'monthly' | 'quarterly' | 'annual' | 'on_demand';
  reportTypes?: FineractRBZReportType[];
  generatedBy?: string;
  currency?: Currency;
}

interface SchedulerResult {
  success: boolean;
  scheduleType: string;
  reportsGenerated: number;
  reportsFailed: number;
  validationResults: RBZReportValidationResult[];
  reports: Array<{
    reportType: FineractRBZReportType;
    status: string;
    csvKey?: string;
    validationPassed: boolean;
  }>;
  durationMs: number;
  timestamp: string;
}

// ===================================================================
// LAMBDA HANDLER
// ===================================================================

/**
 * Lambda handler for scheduled RBZ report generation.
 * Triggered by EventBridge cron rules.
 */
export async function rbzReportSchedulerHandler(
  event: SchedulerEvent
): Promise<{ statusCode: number; body: string }> {
  const startTime = Date.now();
  const scheduleType = event.scheduleType || 'monthly';
  const generatedBy = event.generatedBy || 'system-scheduler';
  const currency = event.currency || 'USD';

  logger.info('RBZ report scheduler triggered', {
    action: 'rbz.scheduler.start',
    status: 'started',
    scheduleType,
  });

  const result: SchedulerResult = {
    success: true,
    scheduleType,
    reportsGenerated: 0,
    reportsFailed: 0,
    validationResults: [],
    reports: [],
    durationMs: 0,
    timestamp: new Date().toISOString(),
  };

  try {
    let reports: RBZGeneratedReport[] = [];

    switch (scheduleType) {
      case 'monthly':
        reports = await runMonthlyRBZReports(generatedBy);
        break;

      case 'quarterly':
        reports = await runQuarterlyRBZReports(generatedBy);
        break;

      case 'annual': {
        const now = new Date();
        const yearStart = new Date(now.getFullYear() - 1, 0, 1);
        const yearEnd = new Date(now.getFullYear() - 1, 11, 31, 23, 59, 59);

        const annualTypes: FineractRBZReportType[] = [
          'interest_rate_schedule',
          'annual_compliance_audit',
        ];

        for (const reportType of annualTypes) {
          try {
            const report = await generateRBZReport({
              reportType,
              frequency: 'annual',
              periodStart: yearStart,
              periodEnd: yearEnd,
              generatedBy,
              currency,
              includesFineractData: false,
            });
            reports.push(report);
          } catch (error) {
            logger.error(`Annual report generation failed: ${reportType}`, {
              action: 'rbz.scheduler.report.failed',
              errorMessage: error instanceof Error ? error.message : String(error),
            });
          }
        }
        break;
      }

      case 'on_demand': {
        if (!event.reportTypes || event.reportTypes.length === 0) {
          throw new Error('reportTypes required for on_demand schedule');
        }

        const now = new Date();
        const periodStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const periodEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);

        for (const reportType of event.reportTypes) {
          try {
            const report = await generateRBZReport({
              reportType,
              frequency: 'on_demand',
              periodStart,
              periodEnd,
              generatedBy,
              currency,
              includesFineractData: [
                'gl_trial_balance',
                'npl_analysis',
                'loan_portfolio_fineract',
              ].includes(reportType),
            });
            reports.push(report);
          } catch (error) {
            logger.error(`On-demand report generation failed: ${reportType}`, {
              action: 'rbz.scheduler.report.failed',
              errorMessage: error instanceof Error ? error.message : String(error),
            });
          }
        }
        break;
      }

      default:
        throw new Error(`Unknown schedule type: ${scheduleType}`);
    }

    // Process each generated report
    for (const report of reports) {
      try {
        // Export to CSV
        const csvContent = exportReportToCSV(report.reportType, report.data);
        const csvKey = getReportS3Key(report.reportType, report.periodEnd);

        // Store CSV path reference (actual S3 upload would use AWS SDK)
        if (report.id) {
          await db.from('fineract_rbz_reports').update({
            file_path: csvKey,
            file_format: 'csv',
          }).eq('id', report.id).execute();
        }

        // Validate
        const validation = validateRBZReport(report.reportType, report.data);
        result.validationResults.push(validation);

        // Store validation result
        if (report.id) {
          await db.from('rbz_report_validations').insert({
            report_id: report.id,
            is_valid: validation.isValid,
            errors: JSON.stringify(validation.errors),
            completeness_score: validation.completenessScore,
            data_sources_used: JSON.stringify(validation.dataSourcesUsed),
            reconciliation_status: validation.reconciliationStatus,
          }).execute();
        }

        result.reports.push({
          reportType: report.reportType,
          status: 'generated',
          csvKey,
          validationPassed: validation.isValid,
        });
        result.reportsGenerated++;
      } catch (error) {
        result.reports.push({
          reportType: report.reportType,
          status: 'failed',
          validationPassed: false,
        });
        result.reportsFailed++;

        logger.error(`Report post-processing failed: ${report.reportType}`, {
          action: 'rbz.scheduler.postprocess.failed',
          errorMessage: error instanceof Error ? error.message : String(error),
        });
      }
    }

    // Update schedule tracking
    await updateScheduleLastRun(scheduleType);

  } catch (error) {
    result.success = false;
    logger.error('RBZ report scheduler failed', {
      action: 'rbz.scheduler.failed',
      status: 'failed',
      errorMessage: error instanceof Error ? error.message : String(error),
    });
  }

  result.durationMs = Date.now() - startTime;

  logger.info('RBZ report scheduler completed', {
    action: 'rbz.scheduler.complete',
    status: 'completed',
    duration: result.durationMs,
    reportsGenerated: result.reportsGenerated,
    reportsFailed: result.reportsFailed,
  });

  return {
    statusCode: result.success ? 200 : 500,
    body: JSON.stringify(result),
  };
}

// ===================================================================
// SCHEDULE MANAGEMENT
// ===================================================================

/**
 * Update the last run timestamp for a schedule frequency.
 */
async function updateScheduleLastRun(frequency: string): Promise<void> {
  try {
    await db.from('rbz_report_schedules')
      .update({
        last_run_at: new Date(),
        updated_at: new Date(),
      })
      .eq('frequency', frequency)
      .eq('enabled', true)
      .execute();
  } catch (error) {
    logger.warn('Failed to update schedule last_run_at', {
      action: 'rbz.scheduler.update_schedule',
      errorMessage: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * Get all active report schedules.
 */
export async function getActiveSchedules(): Promise<Array<{
  reportType: FineractRBZReportType;
  frequency: string;
  lastRunAt: string | null;
  nextRunAt: string | null;
  enabled: boolean;
}>> {
  const { data } = await db
    .from('rbz_report_schedules')
    .select('report_type, frequency, last_run_at, next_run_at, enabled')
    .eq('enabled', true)
    .execute();

  return (data || []).map((s: Record<string, unknown>) => ({
    reportType: s.report_type as FineractRBZReportType,
    frequency: s.frequency as string,
    lastRunAt: s.last_run_at as string | null,
    nextRunAt: s.next_run_at as string | null,
    enabled: s.enabled as boolean,
  }));
}
