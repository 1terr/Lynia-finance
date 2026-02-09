-- Migration 007: Compliance, Privacy, Referrals, Fraud Detection tables
-- Supports: P3-T025 (Support Ticketing), P3-T026 (Referrals),
--           P3-T027 (Fraud Detection), P3-T028 (Regulatory Reporting),
--           P3-T029 (Data Privacy)

-- ===================================================================
-- SUPPORT TICKETING (P3-T025)
-- ===================================================================

CREATE TABLE IF NOT EXISTS ticket_messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  ticket_id UUID NOT NULL REFERENCES support_tickets(id),
  sender_type VARCHAR(20) NOT NULL CHECK (sender_type IN ('customer', 'agent', 'system')),
  sender_id UUID,
  message TEXT NOT NULL,
  is_internal_note BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_ticket_messages_ticket_id ON ticket_messages(ticket_id);

-- Add SLA columns to existing support_tickets table
ALTER TABLE support_tickets
  ADD COLUMN IF NOT EXISTS category VARCHAR(50),
  ADD COLUMN IF NOT EXISTS sla_deadline TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS csat_score INTEGER CHECK (csat_score >= 1 AND csat_score <= 5),
  ADD COLUMN IF NOT EXISTS csat_comment TEXT,
  ADD COLUMN IF NOT EXISTS resolution_summary TEXT;

-- ===================================================================
-- REFERRAL PROGRAM (P3-T026)
-- ===================================================================

CREATE TABLE IF NOT EXISTS referral_codes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_id UUID NOT NULL REFERENCES customers(id),
  code VARCHAR(10) UNIQUE NOT NULL,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_referral_codes_customer ON referral_codes(customer_id);
CREATE UNIQUE INDEX idx_referral_codes_code ON referral_codes(code);

CREATE TABLE IF NOT EXISTS referrals (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  referrer_id UUID NOT NULL REFERENCES customers(id),
  referee_phone VARCHAR(20) NOT NULL,
  referee_id UUID REFERENCES customers(id),
  referral_code VARCHAR(10) NOT NULL,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'converted', 'expired', 'invalid')),
  referrer_reward_amount DECIMAL(10,2) DEFAULT 0,
  referee_discount_percent DECIMAL(5,2) DEFAULT 0,
  converted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_referrals_referrer ON referrals(referrer_id);
CREATE INDEX idx_referrals_referee_phone ON referrals(referee_phone);
CREATE INDEX idx_referrals_status ON referrals(status);

-- ===================================================================
-- FRAUD DETECTION (P3-T027)
-- ===================================================================

CREATE TABLE IF NOT EXISTS fraud_alerts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_id UUID NOT NULL REFERENCES customers(id),
  check_type VARCHAR(50) NOT NULL,
  risk_score INTEGER NOT NULL CHECK (risk_score >= 0 AND risk_score <= 100),
  action VARCHAR(20) NOT NULL CHECK (action IN ('allow', 'flag', 'block', 'report')),
  details TEXT,
  rules_triggered JSONB DEFAULT '[]'::jsonb,
  reviewed BOOLEAN DEFAULT false,
  reviewed_by UUID REFERENCES admin_users(id),
  reviewed_at TIMESTAMPTZ,
  resolution TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_fraud_alerts_customer ON fraud_alerts(customer_id);
CREATE INDEX idx_fraud_alerts_reviewed ON fraud_alerts(reviewed);
CREATE INDEX idx_fraud_alerts_risk_score ON fraud_alerts(risk_score DESC);
CREATE INDEX idx_fraud_alerts_check_type ON fraud_alerts(check_type);

-- ===================================================================
-- REGULATORY REPORTING (P3-T028)
-- ===================================================================

CREATE TABLE IF NOT EXISTS regulatory_reports (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  report_type VARCHAR(50) NOT NULL,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  generated_by UUID NOT NULL REFERENCES admin_users(id),
  generated_at TIMESTAMPTZ DEFAULT NOW(),
  data JSONB NOT NULL,
  status VARCHAR(20) DEFAULT 'generated' CHECK (status IN ('generated', 'reviewed', 'submitted', 'archived')),
  submitted_to_rbz_at TIMESTAMPTZ,
  file_path TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_regulatory_reports_type ON regulatory_reports(report_type);
CREATE INDEX idx_regulatory_reports_status ON regulatory_reports(status);
CREATE INDEX idx_regulatory_reports_period ON regulatory_reports(period_start, period_end);

-- ===================================================================
-- DATA PRIVACY (P3-T029)
-- ===================================================================

CREATE TABLE IF NOT EXISTS customer_consents (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_id UUID NOT NULL REFERENCES customers(id),
  purpose VARCHAR(50) NOT NULL,
  granted BOOLEAN DEFAULT false,
  granted_at TIMESTAMPTZ,
  withdrawn_at TIMESTAMPTZ,
  consent_method VARCHAR(20) CHECK (consent_method IN ('whatsapp', 'web', 'verbal', 'document')),
  ip_address INET,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(customer_id, purpose)
);

CREATE INDEX idx_customer_consents_customer ON customer_consents(customer_id);
CREATE INDEX idx_customer_consents_purpose ON customer_consents(purpose);

CREATE TABLE IF NOT EXISTS deletion_requests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_id UUID NOT NULL REFERENCES customers(id),
  requested_at TIMESTAMPTZ DEFAULT NOW(),
  requested_via VARCHAR(20) CHECK (requested_via IN ('whatsapp', 'email', 'admin')),
  reason TEXT,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'processing', 'completed', 'rejected')),
  approved_by UUID REFERENCES admin_users(id),
  approved_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  rejected_reason TEXT,
  data_categories_deleted JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_deletion_requests_customer ON deletion_requests(customer_id);
CREATE INDEX idx_deletion_requests_status ON deletion_requests(status);

CREATE TABLE IF NOT EXISTS privacy_audit_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  action VARCHAR(100) NOT NULL,
  entity_type VARCHAR(50) NOT NULL,
  entity_id UUID NOT NULL,
  accessed_by VARCHAR(100) NOT NULL,
  access_reason TEXT NOT NULL,
  fields_accessed JSONB DEFAULT '[]'::jsonb,
  ip_address INET,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_privacy_audit_entity ON privacy_audit_log(entity_type, entity_id);
CREATE INDEX idx_privacy_audit_accessed_by ON privacy_audit_log(accessed_by);
CREATE INDEX idx_privacy_audit_created ON privacy_audit_log(created_at);

CREATE TABLE IF NOT EXISTS data_breaches (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  detected_at TIMESTAMPTZ NOT NULL,
  severity VARCHAR(20) NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  description TEXT NOT NULL,
  affected_customers INTEGER DEFAULT 0,
  data_types_affected JSONB DEFAULT '[]'::jsonb,
  containment_actions JSONB DEFAULT '[]'::jsonb,
  notification_sent BOOLEAN DEFAULT false,
  notification_sent_at TIMESTAMPTZ,
  reported_to_authority BOOLEAN DEFAULT false,
  reported_at TIMESTAMPTZ,
  resolved BOOLEAN DEFAULT false,
  resolved_at TIMESTAMPTZ,
  reported_by UUID NOT NULL REFERENCES admin_users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_data_breaches_resolved ON data_breaches(resolved);
CREATE INDEX idx_data_breaches_severity ON data_breaches(severity);

-- Add anonymization columns to customers table
ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS anonymized BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS anonymized_at TIMESTAMPTZ;

-- ===================================================================
-- ROW LEVEL SECURITY
-- ===================================================================

ALTER TABLE ticket_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE referral_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE fraud_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE regulatory_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_consents ENABLE ROW LEVEL SECURITY;
ALTER TABLE deletion_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE privacy_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE data_breaches ENABLE ROW LEVEL SECURITY;

-- Service role policies (full access for backend services)
CREATE POLICY "Service role full access" ON ticket_messages FOR ALL USING (true);
CREATE POLICY "Service role full access" ON referral_codes FOR ALL USING (true);
CREATE POLICY "Service role full access" ON referrals FOR ALL USING (true);
CREATE POLICY "Service role full access" ON fraud_alerts FOR ALL USING (true);
CREATE POLICY "Service role full access" ON regulatory_reports FOR ALL USING (true);
CREATE POLICY "Service role full access" ON customer_consents FOR ALL USING (true);
CREATE POLICY "Service role full access" ON deletion_requests FOR ALL USING (true);
CREATE POLICY "Service role full access" ON privacy_audit_log FOR ALL USING (true);
CREATE POLICY "Service role full access" ON data_breaches FOR ALL USING (true);

-- Data retention comment (7 years per RBZ)
COMMENT ON TABLE regulatory_reports IS 'RBZ regulatory reports - 7 year retention';
COMMENT ON TABLE privacy_audit_log IS 'Privacy audit trail - 7 year retention';
COMMENT ON TABLE fraud_alerts IS 'Fraud detection alerts - 7 year retention';
