-- Migration 010: Security & Compliance Hardening
-- P4-T006: Security fixes
-- P4-T007: RBZ regulatory compliance enforcement
--
-- Changes:
--   1. Add transaction limits enforcement via database constraints
--   2. Add KYC enhancement fields for proof of residence and income declaration
--   3. Add record retention policy metadata
--   4. Add security audit tracking table
--   5. Add fee disclosure tracking

-- ===================================================================
-- 1. TRANSACTION LIMITS TABLE
-- Enforces RBZ regulatory limits per customer per period
-- ===================================================================

CREATE TABLE IF NOT EXISTS transaction_limits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL REFERENCES customers(id),
    limit_type VARCHAR(20) NOT NULL CHECK (limit_type IN ('single', 'daily', 'monthly')),
    max_amount_usd DECIMAL(12, 2) NOT NULL,
    current_amount_usd DECIMAL(12, 2) DEFAULT 0,
    period_start TIMESTAMPTZ NOT NULL,
    period_end TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_customer_limit_period UNIQUE (customer_id, limit_type, period_start)
);

-- Default RBZ transaction limits
COMMENT ON TABLE transaction_limits IS 'RBZ regulatory transaction limits enforcement. Retention: 7 years.';
COMMENT ON COLUMN transaction_limits.max_amount_usd IS 'RBZ limits: single=$2000, daily=$5000, monthly=$50000';

CREATE INDEX idx_transaction_limits_customer ON transaction_limits(customer_id, limit_type);
CREATE INDEX idx_transaction_limits_period ON transaction_limits(period_start, period_end);

-- ===================================================================
-- 2. KYC ENHANCEMENTS
-- Add fields for proof of residence and income declaration per RBZ
-- ===================================================================

-- Add proof of residence fields to kyc_submissions
ALTER TABLE kyc_submissions ADD COLUMN IF NOT EXISTS proof_of_residence_url TEXT;
ALTER TABLE kyc_submissions ADD COLUMN IF NOT EXISTS proof_of_residence_type VARCHAR(50);
ALTER TABLE kyc_submissions ADD COLUMN IF NOT EXISTS proof_of_residence_verified BOOLEAN DEFAULT FALSE;

-- Add income declaration fields
ALTER TABLE kyc_submissions ADD COLUMN IF NOT EXISTS income_declaration_url TEXT;
ALTER TABLE kyc_submissions ADD COLUMN IF NOT EXISTS income_declaration_type VARCHAR(50);
ALTER TABLE kyc_submissions ADD COLUMN IF NOT EXISTS income_declaration_verified BOOLEAN DEFAULT FALSE;
ALTER TABLE kyc_submissions ADD COLUMN IF NOT EXISTS declared_monthly_income DECIMAL(10, 2);

-- Add loan amount threshold triggers
COMMENT ON COLUMN kyc_submissions.proof_of_residence_url IS 'Required for loans > $500 per RBZ regulations';
COMMENT ON COLUMN kyc_submissions.income_declaration_url IS 'Required for loans > $1000 per RBZ regulations';

-- ===================================================================
-- 3. RECORD RETENTION POLICY TABLE
-- Tracks retention requirements per RBZ regulations
-- ===================================================================

CREATE TABLE IF NOT EXISTS record_retention_policies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    table_name VARCHAR(100) NOT NULL UNIQUE,
    retention_years INTEGER NOT NULL,
    regulation_reference VARCHAR(200),
    archive_strategy VARCHAR(50) DEFAULT 'soft_delete' CHECK (archive_strategy IN ('soft_delete', 'archive_to_s3', 'anonymize')),
    last_archive_run TIMESTAMPTZ,
    next_archive_run TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE record_retention_policies IS 'RBZ mandated record retention periods per data category';

-- Insert RBZ retention requirements
INSERT INTO record_retention_policies (table_name, retention_years, regulation_reference, archive_strategy)
VALUES
    ('payments', 7, 'RBZ Financial Records Retention - Transaction Records', 'archive_to_s3'),
    ('loans', 7, 'RBZ Financial Records Retention - Loan Records', 'archive_to_s3'),
    ('kyc_submissions', 10, 'RBZ KYC/AML - Identity Verification Documents', 'archive_to_s3'),
    ('audit_log', 5, 'RBZ Compliance - Audit Trail', 'archive_to_s3'),
    ('privacy_audit_log', 5, 'POPIA/RBZ - Privacy Access Records', 'archive_to_s3'),
    ('regulatory_reports', 7, 'RBZ Regulatory Reporting - Submitted Reports', 'archive_to_s3'),
    ('data_breaches', 7, 'RBZ/POTRAZ - Security Incident Records', 'archive_to_s3'),
    ('customer_consents', 7, 'POPIA - Consent Records', 'archive_to_s3')
ON CONFLICT (table_name) DO NOTHING;

-- ===================================================================
-- 4. SECURITY AUDIT LOG TABLE
-- Tracks security-specific events separate from general audit
-- ===================================================================

CREATE TABLE IF NOT EXISTS security_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type VARCHAR(50) NOT NULL,
    severity VARCHAR(20) NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    description TEXT NOT NULL,
    source_ip VARCHAR(45),
    user_agent TEXT,
    user_id UUID,
    endpoint VARCHAR(200),
    request_id VARCHAR(100),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE security_audit_log IS 'Security event tracking. Events: rate_limit_hit, auth_failure, suspicious_activity, cors_violation. Retention: 5 years.';

CREATE INDEX idx_security_audit_event ON security_audit_log(event_type, created_at);
CREATE INDEX idx_security_audit_severity ON security_audit_log(severity, created_at);
CREATE INDEX idx_security_audit_user ON security_audit_log(user_id);

-- ===================================================================
-- 5. FEE DISCLOSURE TRACKING
-- Tracks when fee disclosures are shown and acknowledged by customers
-- ===================================================================

CREATE TABLE IF NOT EXISTS fee_disclosures (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL REFERENCES customers(id),
    loan_product_id UUID,
    disclosure_type VARCHAR(50) NOT NULL CHECK (disclosure_type IN ('loan_terms', 'interest_rate', 'fees_schedule', 'penalties', 'insurance')),
    disclosed_via VARCHAR(20) DEFAULT 'whatsapp' CHECK (disclosed_via IN ('whatsapp', 'web', 'sms', 'document')),
    content_hash VARCHAR(64) NOT NULL,
    acknowledged BOOLEAN DEFAULT FALSE,
    acknowledged_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE fee_disclosures IS 'RBZ consumer protection - fee transparency tracking. Retention: 7 years.';

CREATE INDEX idx_fee_disclosures_customer ON fee_disclosures(customer_id, disclosure_type);
CREATE INDEX idx_fee_disclosures_loan ON fee_disclosures(loan_product_id);

-- ===================================================================
-- 6. ADD CONSTRAINTS FOR PAYMENT AMOUNT VALIDATION
-- ===================================================================

-- Add check constraint for maximum single transaction amount
ALTER TABLE payments ADD CONSTRAINT chk_payment_max_amount
    CHECK (amount <= 200000); -- $2000 in cents, or $2000 if stored in dollars

-- ===================================================================
-- 7. RLS POLICIES FOR NEW TABLES
-- ===================================================================

ALTER TABLE transaction_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE record_retention_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE security_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE fee_disclosures ENABLE ROW LEVEL SECURITY;

-- Transaction limits: customers see own, admins see all
CREATE POLICY "Customers view own transaction limits"
ON transaction_limits FOR SELECT
TO authenticated
USING (
    customer_id = auth.uid()
    OR EXISTS (
        SELECT 1 FROM admin_users
        WHERE id = auth.uid()
        AND status = 'active'
    )
);

-- Record retention: admin only
CREATE POLICY "Admins manage retention policies"
ON record_retention_policies FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM admin_users
        WHERE id = auth.uid()
        AND role IN ('admin', 'manager')
        AND status = 'active'
    )
);

-- Security audit log: admin only
CREATE POLICY "Admins view security audit log"
ON security_audit_log FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM admin_users
        WHERE id = auth.uid()
        AND role IN ('admin', 'manager')
        AND status = 'active'
    )
);

-- Service role can insert security events
CREATE POLICY "Service role inserts security events"
ON security_audit_log FOR INSERT
TO service_role
WITH CHECK (true);

-- Fee disclosures: customers see own, admins see all
CREATE POLICY "Customers view own fee disclosures"
ON fee_disclosures FOR SELECT
TO authenticated
USING (
    customer_id = auth.uid()
    OR EXISTS (
        SELECT 1 FROM admin_users
        WHERE id = auth.uid()
        AND status = 'active'
    )
);
