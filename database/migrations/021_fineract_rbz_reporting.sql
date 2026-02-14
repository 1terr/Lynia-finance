-- Migration 021: Fineract RBZ Reporting Engine Tables
-- Supports Phase 10: Fineract-powered RBZ compliance reporting
-- Tables for report scheduling, audit, validation, and Fineract GL snapshots.

-- ===================================================================
-- FINERACT RBZ REPORTS (enhanced version of regulatory_reports)
-- ===================================================================

CREATE TABLE IF NOT EXISTS fineract_rbz_reports (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  report_type VARCHAR(60) NOT NULL,
  frequency VARCHAR(20) NOT NULL CHECK (frequency IN ('monthly', 'quarterly', 'annual', 'on_demand')),
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  currency VARCHAR(3) NOT NULL DEFAULT 'USD',
  generated_by UUID NOT NULL REFERENCES admin_users(id),
  generated_at TIMESTAMPTZ DEFAULT NOW(),
  data JSONB NOT NULL,
  status VARCHAR(20) DEFAULT 'generated' CHECK (status IN (
    'scheduled', 'generating', 'generated', 'reviewed', 'submitted', 'rejected', 'archived'
  )),
  reviewed_by UUID REFERENCES admin_users(id),
  reviewed_at TIMESTAMPTZ,
  rejection_reason TEXT,
  submitted_to_rbz_at TIMESTAMPTZ,
  file_path TEXT,
  file_format VARCHAR(10) CHECK (file_format IN ('csv', 'pdf', 'json')),
  fineract_sourced BOOLEAN DEFAULT false,
  checksum VARCHAR(64),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_fineract_rbz_reports_type ON fineract_rbz_reports(report_type);
CREATE INDEX idx_fineract_rbz_reports_status ON fineract_rbz_reports(status);
CREATE INDEX idx_fineract_rbz_reports_period ON fineract_rbz_reports(period_start, period_end);
CREATE INDEX idx_fineract_rbz_reports_frequency ON fineract_rbz_reports(frequency);
CREATE INDEX idx_fineract_rbz_reports_generated_at ON fineract_rbz_reports(generated_at DESC);

COMMENT ON TABLE fineract_rbz_reports IS 'Fineract-sourced RBZ regulatory compliance reports - 7 year retention';

-- ===================================================================
-- REPORT SCHEDULES
-- ===================================================================

CREATE TABLE IF NOT EXISTS rbz_report_schedules (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  report_type VARCHAR(60) NOT NULL,
  frequency VARCHAR(20) NOT NULL CHECK (frequency IN ('monthly', 'quarterly', 'annual', 'on_demand')),
  cron_expression VARCHAR(100) NOT NULL,
  enabled BOOLEAN DEFAULT true,
  last_run_at TIMESTAMPTZ,
  next_run_at TIMESTAMPTZ,
  generated_by UUID NOT NULL REFERENCES admin_users(id),
  recipient_emails JSONB DEFAULT '[]'::jsonb,
  s3_bucket VARCHAR(255),
  s3_prefix VARCHAR(255),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(report_type, frequency)
);

CREATE INDEX idx_rbz_report_schedules_enabled ON rbz_report_schedules(enabled);
CREATE INDEX idx_rbz_report_schedules_next_run ON rbz_report_schedules(next_run_at);

COMMENT ON TABLE rbz_report_schedules IS 'Scheduled RBZ report generation configuration';

-- ===================================================================
-- REPORT VALIDATION LOG
-- ===================================================================

CREATE TABLE IF NOT EXISTS rbz_report_validations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  report_id UUID NOT NULL REFERENCES fineract_rbz_reports(id) ON DELETE CASCADE,
  is_valid BOOLEAN NOT NULL,
  errors JSONB DEFAULT '[]'::jsonb,
  completeness_score DECIMAL(5,2) NOT NULL CHECK (completeness_score >= 0 AND completeness_score <= 100),
  data_sources_used JSONB DEFAULT '[]'::jsonb,
  reconciliation_status VARCHAR(20) CHECK (reconciliation_status IN ('matched', 'unmatched', 'not_applicable')),
  validated_at TIMESTAMPTZ DEFAULT NOW(),
  validated_by UUID REFERENCES admin_users(id)
);

CREATE INDEX idx_rbz_report_validations_report ON rbz_report_validations(report_id);
CREATE INDEX idx_rbz_report_validations_valid ON rbz_report_validations(is_valid);

COMMENT ON TABLE rbz_report_validations IS 'Validation results for RBZ regulatory reports';

-- ===================================================================
-- FINERACT GL SNAPSHOTS (point-in-time captures for auditing)
-- ===================================================================

CREATE TABLE IF NOT EXISTS fineract_gl_snapshots (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  snapshot_date DATE NOT NULL,
  currency VARCHAR(3) NOT NULL DEFAULT 'USD',
  gl_account_id INTEGER NOT NULL,
  gl_code VARCHAR(20) NOT NULL,
  account_name VARCHAR(200) NOT NULL,
  account_type VARCHAR(20) NOT NULL CHECK (account_type IN ('ASSET', 'LIABILITY', 'EQUITY', 'INCOME', 'EXPENSE')),
  opening_balance DECIMAL(18,2) NOT NULL DEFAULT 0,
  debits DECIMAL(18,2) NOT NULL DEFAULT 0,
  credits DECIMAL(18,2) NOT NULL DEFAULT 0,
  closing_balance DECIMAL(18,2) NOT NULL DEFAULT 0,
  captured_at TIMESTAMPTZ DEFAULT NOW(),
  report_id UUID REFERENCES fineract_rbz_reports(id)
);

CREATE INDEX idx_gl_snapshots_date ON fineract_gl_snapshots(snapshot_date);
CREATE INDEX idx_gl_snapshots_account ON fineract_gl_snapshots(gl_account_id);
CREATE INDEX idx_gl_snapshots_type ON fineract_gl_snapshots(account_type);
CREATE INDEX idx_gl_snapshots_report ON fineract_gl_snapshots(report_id);
CREATE UNIQUE INDEX idx_gl_snapshots_unique ON fineract_gl_snapshots(snapshot_date, gl_account_id, currency);

COMMENT ON TABLE fineract_gl_snapshots IS 'Point-in-time GL account balance snapshots from Fineract';

-- ===================================================================
-- LARGE TRANSACTION MONITORING
-- ===================================================================

CREATE TABLE IF NOT EXISTS large_transaction_alerts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  payment_id UUID REFERENCES payments(id),
  customer_id UUID NOT NULL REFERENCES customers(id),
  transaction_date TIMESTAMPTZ NOT NULL,
  amount DECIMAL(18,2) NOT NULL,
  currency VARCHAR(3) NOT NULL DEFAULT 'USD',
  payment_channel VARCHAR(30),
  threshold_amount DECIMAL(18,2) NOT NULL,
  fineract_transaction_id INTEGER,
  reported BOOLEAN DEFAULT false,
  report_id UUID REFERENCES fineract_rbz_reports(id),
  reported_at TIMESTAMPTZ,
  reviewed BOOLEAN DEFAULT false,
  reviewed_by UUID REFERENCES admin_users(id),
  reviewed_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_large_txn_customer ON large_transaction_alerts(customer_id);
CREATE INDEX idx_large_txn_reported ON large_transaction_alerts(reported);
CREATE INDEX idx_large_txn_reviewed ON large_transaction_alerts(reviewed);
CREATE INDEX idx_large_txn_date ON large_transaction_alerts(transaction_date DESC);

COMMENT ON TABLE large_transaction_alerts IS 'Transactions exceeding RBZ reporting threshold - 7 year retention';

-- ===================================================================
-- ROW LEVEL SECURITY
-- ===================================================================

ALTER TABLE fineract_rbz_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE rbz_report_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE rbz_report_validations ENABLE ROW LEVEL SECURITY;
ALTER TABLE fineract_gl_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE large_transaction_alerts ENABLE ROW LEVEL SECURITY;

-- Service role policies (full access for backend services)
CREATE POLICY "Service role full access" ON fineract_rbz_reports FOR ALL USING (true);
CREATE POLICY "Service role full access" ON rbz_report_schedules FOR ALL USING (true);
CREATE POLICY "Service role full access" ON rbz_report_validations FOR ALL USING (true);
CREATE POLICY "Service role full access" ON fineract_gl_snapshots FOR ALL USING (true);
CREATE POLICY "Service role full access" ON large_transaction_alerts FOR ALL USING (true);

-- ===================================================================
-- DATA RETENTION COMMENTS
-- ===================================================================

COMMENT ON COLUMN fineract_rbz_reports.checksum IS 'SHA-256 hash of report data for tamper detection';
COMMENT ON COLUMN fineract_rbz_reports.fineract_sourced IS 'Whether this report includes data fetched from Fineract GL/journal APIs';
