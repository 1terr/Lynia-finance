/**
 * Fineract Sync Service
 *
 * This file is a barrel re-export for backwards compatibility.
 * Implementation has been decomposed into:
 *  - fineract-sync/sync-scheduler.ts   -- scheduling, queue management, sync logging
 *  - fineract-sync/sync-executor.ts    -- actual sync execution (customer, loan, repayment)
 *  - fineract-sync/conflict-resolver.ts -- query helpers (loan balance, schedule)
 *  - fineract-sync/index.ts            -- barrel re-exports
 */
export * from './fineract-sync/index';
