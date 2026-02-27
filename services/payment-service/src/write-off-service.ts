/**
 * Loan Write-Off Service (Phase 8)
 *
 * This file is a barrel re-export for backwards compatibility.
 * Implementation has been decomposed into:
 *  - write-off/write-off-types.ts       -- type/interface definitions
 *  - write-off/write-off-processor.ts   -- write-off execution, approval, reversal
 *  - write-off/write-off-eligibility.ts -- eligibility checks, queries, recovery
 *  - write-off/index.ts                 -- barrel re-exports
 */
export * from './write-off/index';
