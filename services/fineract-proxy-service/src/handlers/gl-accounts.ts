/**
 * GL Account, Journal Entry, and Trial Balance Handlers
 *
 * GET endpoints for Fineract general ledger data.
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { getFineractClient, FineractApiError } from '../../../shared/clients/fineract';
import logger from '../../../shared/utils/logger';
import type { RouteParams } from '../../../shared/utils/lambda-router';
import type { AuthContext } from '../../../shared/middleware/authorization';
import { ok, err, clampPage, fmtDate, MAX_PAGE_SIZE } from './helpers';

// ============================================================
// GET /api/v1/fineract/gl-accounts
// ============================================================

export async function handleGetGLAccounts(
  event: APIGatewayProxyEvent,
  _params: RouteParams,
  _auth: AuthContext
): Promise<APIGatewayProxyResult> {
  try {
    const fineract = await getFineractClient();
    const accounts = await fineract.listGLAccounts();

    const mapped = accounts.map((a) => ({
      id: a.id,
      name: a.name,
      glCode: a.glCode,
      type: a.type?.value || 'ASSET',
      usage: a.usage?.value || 'DETAIL',
      description: a.description || null,
      disabled: a.disabled,
      manualEntriesAllowed: a.manualEntriesAllowed,
      parentId: a.parentId ?? null,
    }));

    return ok(mapped, event);
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    logger.error('Handler failed', { action: 'gl-accounts.list', status: 'failed', errorMessage: message });
    if (e instanceof FineractApiError) {
      return err(502, e.errorBody?.defaultUserMessage || 'Core banking system error', event);
    }
    return err(500, 'An unexpected error occurred', event);
  }
}

// ============================================================
// GET /api/v1/fineract/journal-entries
// ============================================================

export async function handleGetJournalEntries(
  event: APIGatewayProxyEvent,
  _params: RouteParams,
  _auth: AuthContext
): Promise<APIGatewayProxyResult> {
  try {
    const qs = event.queryStringParameters || {};
    const page = clampPage(qs.page, 1, 1000);
    const limit = clampPage(qs.limit, 50, MAX_PAGE_SIZE);

    const fineract = await getFineractClient();
    const result = await fineract.listJournalEntries({
      glAccountId: qs.glAccountId ? parseInt(qs.glAccountId, 10) : undefined,
      fromDate: qs.fromDate,
      toDate: qs.toDate,
      limit,
      offset: (page - 1) * limit,
    });

    const entries = (result.pageItems || []).map((je) => ({
      id: je.id,
      officeId: je.officeId,
      officeName: je.officeName,
      glAccountId: je.glAccountId,
      glAccountName: je.glAccountName,
      glAccountCode: je.glAccountCode,
      glAccountType: je.glAccountType?.value || '',
      transactionDate: fmtDate(je.transactionDate) || '',
      entryType: je.entryType?.value || '',
      amount: je.amount,
      currency: {
        code: je.currency?.code || 'USD',
        name: je.currency?.name || 'US Dollar',
        decimalPlaces: je.currency?.decimalPlaces ?? 2,
        displaySymbol: je.currency?.displaySymbol || '$',
        displayLabel: je.currency?.displayLabel || 'US Dollar ($)',
      },
      transactionId: je.transactionId,
      manualEntry: je.manualEntry,
      entityType: je.entityType?.value || '',
      entityId: je.entityId,
      reversed: je.reversed,
      referenceNumber: je.referenceNumber || null,
      submittedOnDate: fmtDate(je.submittedOnDate) || '',
    }));

    return ok(
      {
        data: entries,
        pagination: {
          page,
          limit,
          total: result.totalFilteredRecords || entries.length,
          totalPages: Math.ceil((result.totalFilteredRecords || entries.length) / limit),
        },
      },
      event
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    logger.error('Handler failed', { action: 'journal-entries.list', status: 'failed', errorMessage: message });
    if (e instanceof FineractApiError) {
      return err(502, e.errorBody?.defaultUserMessage || 'Core banking system error', event);
    }
    return err(500, 'An unexpected error occurred', event);
  }
}

// ============================================================
// GET /api/v1/fineract/trial-balance
// ============================================================

export async function handleGetTrialBalance(
  event: APIGatewayProxyEvent,
  _params: RouteParams,
  _auth: AuthContext
): Promise<APIGatewayProxyResult> {
  try {
    const fineract = await getFineractClient();

    // Get all GL accounts
    const accounts = await fineract.listGLAccounts();

    // Get all journal entries (summary)
    const { pageItems } = await fineract.listJournalEntries({ limit: 10000 });

    // Compute trial balance per account
    const balanceMap = new Map<number, { debit: number; credit: number }>();

    for (const je of pageItems || []) {
      const entry = balanceMap.get(je.glAccountId) || { debit: 0, credit: 0 };
      if (je.entryType?.value === 'DEBIT') {
        entry.debit += je.amount;
      } else {
        entry.credit += je.amount;
      }
      balanceMap.set(je.glAccountId, entry);
    }

    const trialBalance = accounts
      .filter((a) => a.usage?.id === 2) // DETAIL accounts only
      .map((a) => {
        const bal = balanceMap.get(a.id) || { debit: 0, credit: 0 };
        return {
          glAccountId: a.id,
          glAccountName: a.name,
          glAccountCode: a.glCode,
          glAccountType: a.type?.value || '',
          totalDebit: bal.debit,
          totalCredit: bal.credit,
          balance: bal.debit - bal.credit,
        };
      });

    return ok(trialBalance, event);
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    logger.error('Handler failed', { action: 'trial-balance.get', status: 'failed', errorMessage: message });
    if (e instanceof FineractApiError) {
      return err(502, e.errorBody?.defaultUserMessage || 'Core banking system error', event);
    }
    return err(500, 'An unexpected error occurred', event);
  }
}
