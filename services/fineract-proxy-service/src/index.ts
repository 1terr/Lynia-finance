/**
 * Fineract Proxy Service
 *
 * Backend proxy that serves the admin portal's Fineract UI pages.
 * Accepts authenticated requests from the admin portal, queries both
 * the Lynia PostgreSQL database and the internal Fineract ALB, and
 * returns merged/transformed responses matching the frontend types.
 *
 * All routes require Cognito authentication (enforced by API Gateway).
 */

import { createRouter } from '../../shared/utils/lambda-router';
import { handleGetLoans, handleGetPendingLoans, handleGetOverdueLoans, handleGetAgingSummary, handleGetLoanDetail } from './handlers/loans';
import { handleLoanApprove, handleLoanDisburse, handleLoanRepayment, handleLoanReject, handleLoanWriteOff, handleLoanClose, handleLoanReschedule, handleEarlyPayoff, handleLoanRetrySync } from './handlers/loan-actions';
import { handleGetLoanProducts, handleGetLoanProduct, handleCreateFineractProduct } from './handlers/loan-products';
import { handleGetGLAccounts, handleGetJournalEntries, handleGetTrialBalance } from './handlers/gl-accounts';
import { handleGetReconciliation, handleRunReconciliation } from './handlers/reconciliation';
import { handleGetReports, handleRunReport } from './handlers/reports';
import { handleGetSystemHealth } from './handlers/system-health';

export const handler = createRouter({
  // Static paths FIRST to avoid false matches with :loanId
  'GET /api/v1/fineract/loans/pending':            handleGetPendingLoans,
  'GET /api/v1/fineract/loans/overdue':             handleGetOverdueLoans,
  'GET /api/v1/fineract/loans/aging-summary':       handleGetAgingSummary,
  'GET /api/v1/fineract/loans':                     handleGetLoans,
  'GET /api/v1/fineract/loans/:loanId':             handleGetLoanDetail,
  'POST /api/v1/fineract/loans/:loanId/approve':    handleLoanApprove,
  'POST /api/v1/fineract/loans/:loanId/disburse':   handleLoanDisburse,
  'POST /api/v1/fineract/loans/:loanId/repayment':  handleLoanRepayment,
  'POST /api/v1/fineract/loans/:loanId/reject':     handleLoanReject,
  'POST /api/v1/fineract/loans/:loanId/writeoff':   handleLoanWriteOff,
  'POST /api/v1/fineract/loans/:loanId/close':      handleLoanClose,
  'POST /api/v1/fineract/loans/:loanId/reschedule': handleLoanReschedule,
  'POST /api/v1/fineract/loans/:loanId/early-payoff': handleEarlyPayoff,
  'POST /api/v1/fineract/loans/:loanId/retry-sync':  handleLoanRetrySync,
  'POST /api/v1/fineract/loan-products/create-from-lynia': handleCreateFineractProduct,
  'GET /api/v1/fineract/loan-products':             handleGetLoanProducts,
  'GET /api/v1/fineract/loan-products/:id':         handleGetLoanProduct,
  'GET /api/v1/fineract/gl-accounts':               handleGetGLAccounts,
  'GET /api/v1/fineract/journal-entries':            handleGetJournalEntries,
  'GET /api/v1/fineract/trial-balance':              handleGetTrialBalance,
  'GET /api/v1/fineract/system-health':               handleGetSystemHealth,
  'GET /api/v1/fineract/reconciliation':             handleGetReconciliation,
  'POST /api/v1/fineract/reconciliation/run':        handleRunReconciliation,
  'GET /api/v1/fineract/reports':                    handleGetReports,
  'GET /api/v1/fineract/reports/:name':              handleRunReport,
}, { serviceName: 'fineract-proxy', skipAuth: true });
