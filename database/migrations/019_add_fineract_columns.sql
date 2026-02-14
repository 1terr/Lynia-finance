-- =====================================================
-- Lynia Finance - Fineract Integration Columns
-- Migration: 019
-- Created: February 14, 2026
-- Phase: Phase 6 - Apache Fineract Integration
-- Description: Adds Fineract foreign key columns to existing
--   tables so Lynia can map its UUIDs to Fineract integer IDs.
--   These columns enable bidirectional lookup between the two systems.
-- =====================================================

-- =====================================================
-- 1. CUSTOMERS TABLE — Add Fineract client mapping
-- =====================================================
ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS fineract_client_id INTEGER,
  ADD COLUMN IF NOT EXISTS fineract_account_no VARCHAR(50),
  ADD COLUMN IF NOT EXISTS fineract_synced_at TIMESTAMP WITH TIME ZONE;

CREATE UNIQUE INDEX IF NOT EXISTS idx_customers_fineract_client_id
  ON customers(fineract_client_id) WHERE fineract_client_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_customers_fineract_synced
  ON customers(fineract_synced_at) WHERE fineract_client_id IS NOT NULL;

COMMENT ON COLUMN customers.fineract_client_id IS 'Apache Fineract m_client.id — set when client is created in Fineract after KYC approval';
COMMENT ON COLUMN customers.fineract_account_no IS 'Fineract auto-generated client account number';
COMMENT ON COLUMN customers.fineract_synced_at IS 'Timestamp of last successful sync with Fineract';

-- =====================================================
-- 2. LOANS TABLE — Add Fineract loan mapping
-- =====================================================
ALTER TABLE loans
  ADD COLUMN IF NOT EXISTS fineract_loan_id INTEGER,
  ADD COLUMN IF NOT EXISTS fineract_loan_account_no VARCHAR(50),
  ADD COLUMN IF NOT EXISTS fineract_product_id INTEGER,
  ADD COLUMN IF NOT EXISTS fineract_synced_at TIMESTAMP WITH TIME ZONE;

CREATE UNIQUE INDEX IF NOT EXISTS idx_loans_fineract_loan_id
  ON loans(fineract_loan_id) WHERE fineract_loan_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_loans_fineract_synced
  ON loans(fineract_synced_at) WHERE fineract_loan_id IS NOT NULL;

COMMENT ON COLUMN loans.fineract_loan_id IS 'Apache Fineract m_loan.id — set when loan is created in Fineract';
COMMENT ON COLUMN loans.fineract_loan_account_no IS 'Fineract auto-generated loan account number';
COMMENT ON COLUMN loans.fineract_product_id IS 'Fineract m_product_loan.id used for this loan';
COMMENT ON COLUMN loans.fineract_synced_at IS 'Timestamp of last successful sync with Fineract';

-- =====================================================
-- 3. PAYMENTS TABLE — Add Fineract transaction mapping
-- =====================================================
ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS fineract_transaction_id INTEGER,
  ADD COLUMN IF NOT EXISTS fineract_synced_at TIMESTAMP WITH TIME ZONE;

CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_fineract_txn_id
  ON payments(fineract_transaction_id) WHERE fineract_transaction_id IS NOT NULL;

COMMENT ON COLUMN payments.fineract_transaction_id IS 'Apache Fineract m_loan_transaction.id — set when repayment is posted';
COMMENT ON COLUMN payments.fineract_synced_at IS 'Timestamp of last successful sync with Fineract';

-- =====================================================
-- 4. LOAN_PRODUCTS TABLE — Add Fineract product mapping
-- =====================================================
ALTER TABLE loan_products
  ADD COLUMN IF NOT EXISTS fineract_product_id INTEGER,
  ADD COLUMN IF NOT EXISTS fineract_synced_at TIMESTAMP WITH TIME ZONE;

CREATE UNIQUE INDEX IF NOT EXISTS idx_loan_products_fineract_id
  ON loan_products(fineract_product_id) WHERE fineract_product_id IS NOT NULL;

COMMENT ON COLUMN loan_products.fineract_product_id IS 'Apache Fineract m_product_loan.id';
COMMENT ON COLUMN loan_products.fineract_synced_at IS 'Timestamp of last product sync with Fineract';

-- =====================================================
-- 5. FINERACT SYNC LOG TABLE (NEW)
-- Tracks all sync operations for audit and debugging
-- =====================================================
CREATE TABLE IF NOT EXISTS fineract_sync_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- What was synced
  entity_type VARCHAR(50) NOT NULL,  -- 'client', 'loan', 'repayment', 'product'
  entity_id UUID NOT NULL,           -- Lynia entity UUID
  fineract_id INTEGER,               -- Fineract entity ID (set on success)

  -- Sync details
  operation VARCHAR(50) NOT NULL,    -- 'create', 'approve', 'disburse', 'repayment', 'query'
  direction VARCHAR(10) NOT NULL DEFAULT 'outbound',  -- 'outbound' (Lynia → Fineract) or 'inbound'
  status VARCHAR(20) NOT NULL DEFAULT 'pending',      -- 'pending', 'success', 'failed', 'retrying'

  -- Request/Response
  request_payload JSONB,
  response_payload JSONB,
  error_message TEXT,
  http_status_code INTEGER,

  -- Timing
  started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE,
  duration_ms INTEGER,

  -- Retry tracking
  attempt_number INTEGER DEFAULT 1,
  max_attempts INTEGER DEFAULT 3,
  next_retry_at TIMESTAMP WITH TIME ZONE,

  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  lambda_request_id VARCHAR(100)  -- AWS Lambda request ID for correlation
);

-- Indexes for the sync log
CREATE INDEX idx_fineract_sync_entity
  ON fineract_sync_log(entity_type, entity_id);

CREATE INDEX idx_fineract_sync_status
  ON fineract_sync_log(status) WHERE status IN ('failed', 'retrying');

CREATE INDEX idx_fineract_sync_created
  ON fineract_sync_log(created_at);

-- Partition-ready: this table will grow fast
COMMENT ON TABLE fineract_sync_log IS 'Audit log for all Lynia ↔ Fineract synchronization operations. Partition by created_at when volume exceeds 1M rows.';
