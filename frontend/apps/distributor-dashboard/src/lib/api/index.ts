/**
 * Unified API exports for distributor dashboard
 *
 * This file re-exports all API functions from modular files for easy importing.
 * Import from specific modules when you only need a subset of functions.
 */

// Authentication
export { loginDistributor, isCognitoConfigured } from './auth';

// Profile
export { fetchDistributorProfile, updateDistributorProfile } from './profile';

// Dashboard stats
export { fetchDashboardStats } from './dashboard';

// Inventory
export { fetchInventory } from './inventory';

// Commissions
export { fetchCommissions } from './commissions';

// Handovers
export {
  searchApprovedLoans,
  fetchCompletedHandovers,
  verifyCustomerIdentity,
  verifyDeviceSelection,
  verifyDepositPayment,
  submitHandover,
} from './handovers';
