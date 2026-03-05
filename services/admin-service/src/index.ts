/**
 * Admin Service Lambda Handler
 *
 * Slim router entrypoint — all business logic lives in handler modules
 * under ./handlers/. This file only wires routes to handlers via the
 * shared lambda-router utility.
 */

import { createRouter } from '../../shared/utils/lambda-router';

// ─── User Management ───
import { handleGetCurrentAdmin, handleGetUsers, handleCreateUser, handleGetUserById, handleUpdateUser } from './handlers/users';

// ─── Configuration & Audit ───
import { handleGetConfigs, handleUpdateConfig } from './handlers/configuration';
import { handleGetAuditLogs } from './handlers/audit-logs';

// ─── Products ───
import { handleGetProducts, handleCreateProduct, handleGetProductById, handleUpdateProduct, handleDeleteProduct, handleGetProductStats, handleGetProductLoansCount } from './handlers/products';

// ─── Device Models ───
import { handleGetDeviceModels, handleCreateDeviceModel, handleGetDeviceModelById, handleUpdateDeviceModel, handleDeleteDeviceModel } from './handlers/device-models';

// ─── Organizations ───
import { handleGetOrganizations, handleCreateOrganization, handleGetOrganizationById, handleUpdateOrganization, handleImportOrgMembers, handleGetOrgMembers } from './handlers/organizations';

// ─── Inventory: Devices ───
import { handleGetDevices, handleCreateDevice, handleBulkImportDevices, handleGetDeviceInventoryStats, handleGetDeviceById, handleUpdateDevice, handleGetDeviceMovements } from './handlers/inventory-devices';

// ─── Inventory: Adjustments ───
import { handleGetAdjustments, handleCreateAdjustment, handleApproveAdjustment } from './handlers/inventory-adjustments';

// ─── Inventory: Transfers ───
import { handleGetTransfers, handleCreateTransfer, handleUpdateTransfer } from './handlers/inventory-transfers';

// ─── Inventory: Reports ───
import { handleInventoryReport, handleMovementsReport, handleLowStockReport } from './handlers/inventory-reports';

// ─── Dashboard ───
import { handleDashboardMetrics, handlePortfolioAtRisk, handleDailyTrends, handleLoansByStatus, handleRecentActivity } from './handlers/dashboard';

// ─── KYC Review ───
import { handleGetKYCPending, handleGetKYCReviewHistory, handleGetKYCSLAStats, handleApproveKYC, handleRejectKYC } from './handlers/kyc-review';

// ─── Customers ───
import { handleGetCustomers, handleGetCustomerById, handleUpdateCustomerStatus, handleGetCustomerLoans, handleGetCustomerPayments, handleGetCustomerCreditScore, handleGetCreditScoreHistory, handleGetCustomerKYC, handleGetCustomerTimeline, handleAddCustomerNote } from './handlers/customers';

// ─── Route Map ───
// Static paths MUST come before parameterized paths of the same segment
// length so the router matches exact segments first.

export const handler = createRouter({
  // User management
  'GET /admin/me':                handleGetCurrentAdmin,
  'GET /admin/users':             handleGetUsers,
  'POST /admin/users':            handleCreateUser,
  'GET /admin/users/:id':         handleGetUserById,
  'PATCH /admin/users/:id':       handleUpdateUser,

  // Configuration
  'GET /admin/config':            handleGetConfigs,
  'PATCH /admin/config/:id':      handleUpdateConfig,

  // Audit logs
  'GET /admin/audit-logs':        handleGetAuditLogs,

  // Products (static routes before parameterized)
  'GET /admin/products/stats':           handleGetProductStats,
  'GET /admin/products':                 handleGetProducts,
  'POST /admin/products':                handleCreateProduct,
  'GET /admin/products/:id/loans-count': handleGetProductLoansCount,
  'GET /admin/products/:id':             handleGetProductById,
  'PATCH /admin/products/:id':           handleUpdateProduct,
  'DELETE /admin/products/:id':          handleDeleteProduct,

  // Device models
  'GET /admin/device-models':          handleGetDeviceModels,
  'POST /admin/device-models':         handleCreateDeviceModel,
  'GET /admin/device-models/:id':      handleGetDeviceModelById,
  'PATCH /admin/device-models/:id':    handleUpdateDeviceModel,
  'DELETE /admin/device-models/:id':   handleDeleteDeviceModel,

  // Organizations (sub-routes before single-ID routes)
  'POST /admin/organizations/:id/import':   handleImportOrgMembers,
  'GET /admin/organizations/:id/members':   handleGetOrgMembers,
  'GET /admin/organizations':               handleGetOrganizations,
  'POST /admin/organizations':              handleCreateOrganization,
  'GET /admin/organizations/:id':           handleGetOrganizationById,
  'PATCH /admin/organizations/:id':         handleUpdateOrganization,

  // Inventory: Devices (static before parameterized)
  'GET /admin/devices':                     handleGetDevices,
  'POST /admin/devices':                    handleCreateDevice,
  'POST /admin/devices/bulk-import':        handleBulkImportDevices,
  'GET /admin/devices/stats':               handleGetDeviceInventoryStats,
  'GET /admin/devices/:id/movements':       handleGetDeviceMovements,
  'GET /admin/devices/:id':                 handleGetDeviceById,
  'PATCH /admin/devices/:id':               handleUpdateDevice,

  // Inventory: Adjustments
  'GET /admin/inventory/adjustments':               handleGetAdjustments,
  'POST /admin/inventory/adjustments':              handleCreateAdjustment,
  'POST /admin/inventory/adjustments/:id/approve':  handleApproveAdjustment,

  // Inventory: Transfers
  'GET /admin/inventory/transfers':         handleGetTransfers,
  'POST /admin/inventory/transfers':        handleCreateTransfer,
  'PATCH /admin/inventory/transfers/:id':   handleUpdateTransfer,

  // Inventory: Reports
  'GET /admin/reports/inventory':             handleInventoryReport,
  'GET /admin/reports/inventory/movements':   handleMovementsReport,
  'GET /admin/reports/inventory/low-stock':   handleLowStockReport,

  // Dashboard
  'GET /api/v1/dashboard/metrics':            handleDashboardMetrics,
  'GET /api/v1/dashboard/portfolio-at-risk':  handlePortfolioAtRisk,
  'GET /api/v1/dashboard/daily-trends':       handleDailyTrends,
  'GET /api/v1/dashboard/loans-by-status':    handleLoansByStatus,
  'GET /api/v1/dashboard/recent-activity':    handleRecentActivity,

  // KYC Review
  'GET /api/v1/kyc/submissions/pending':          handleGetKYCPending,
  'GET /api/v1/kyc/submissions/review-history':   handleGetKYCReviewHistory,
  'GET /api/v1/kyc/submissions/sla-stats':        handleGetKYCSLAStats,
  'POST /api/v1/kyc/submissions/:id/approve':     handleApproveKYC,
  'POST /api/v1/kyc/submissions/:id/reject':      handleRejectKYC,

  // Customers (sub-routes before single-ID routes)
  'GET /api/v1/customers':                              handleGetCustomers,
  'GET /api/v1/customers/:id/loans':                    handleGetCustomerLoans,
  'GET /api/v1/customers/:id/payments':                 handleGetCustomerPayments,
  'GET /api/v1/customers/:id/credit-score/history':     handleGetCreditScoreHistory,
  'GET /api/v1/customers/:id/credit-score':             handleGetCustomerCreditScore,
  'GET /api/v1/customers/:id/kyc':                      handleGetCustomerKYC,
  'GET /api/v1/customers/:id/timeline':                 handleGetCustomerTimeline,
  'POST /api/v1/customers/:id/notes':                   handleAddCustomerNote,
  'PATCH /api/v1/customers/:id/status':                 handleUpdateCustomerStatus,
  'GET /api/v1/customers/:id':                          handleGetCustomerById,
}, { serviceName: 'admin-service' });
