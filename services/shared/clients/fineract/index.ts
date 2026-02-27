/**
 * Fineract Client Module - Barrel Re-exports
 *
 * Re-exports the FineractClient class, factory function, error class,
 * and helper functions from the main fineract module.
 *
 * Domain-specific operation modules:
 *  - client-client.ts  -- customer/client and office operations
 *  - loan-client.ts    -- loan CRUD, approval, disbursement, repayment
 *  - charge-client.ts  -- GL accounts, journal entries, interop, health, reports
 *  - savings-client.ts -- savings account operations (future)
 */

// Re-export everything from the parent fineract module
// The parent module (../fineract.ts) is the canonical entry point
// and delegates to the domain-specific modules internally.
export { createClientOperations } from './client-client';
export { createLoanOperations } from './loan-client';
export { createChargeOperations } from './charge-client';
export { createSavingsOperations } from './savings-client';
