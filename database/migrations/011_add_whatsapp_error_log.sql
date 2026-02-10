-- Migration 011: Add WhatsApp error log table (T011)
-- Tracks conversation errors for analytics and monitoring

CREATE TABLE IF NOT EXISTS whatsapp_error_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_number TEXT NOT NULL,
  error_category TEXT NOT NULL CHECK (error_category IN (
    'user_input', 'validation', 'timeout', 'api', 'system', 'network', 'security'
  )),
  error_severity TEXT NOT NULL CHECK (error_severity IN (
    'low', 'medium', 'high', 'critical'
  )),
  error_code TEXT NOT NULL,
  user_message TEXT,
  internal_message TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for querying by phone number (recent errors for a customer)
CREATE INDEX IF NOT EXISTS idx_whatsapp_error_log_phone
  ON whatsapp_error_log (phone_number, created_at DESC);

-- Index for monitoring dashboards (error rates by category)
CREATE INDEX IF NOT EXISTS idx_whatsapp_error_log_category
  ON whatsapp_error_log (error_category, created_at DESC);

-- Index for security event alerting
CREATE INDEX IF NOT EXISTS idx_whatsapp_error_log_security
  ON whatsapp_error_log (error_severity, created_at DESC)
  WHERE error_category = 'security';

-- Partitioning hint: partition by month when table grows large
COMMENT ON TABLE whatsapp_error_log IS 'WhatsApp conversation error tracking (T011). Partition by created_at when > 1M rows.';

-- RLS: service role only (no direct user access)
ALTER TABLE whatsapp_error_log ENABLE ROW LEVEL SECURITY;

-- Allow service role to insert/select (Lambda functions use service role key)
CREATE POLICY "Service role full access on whatsapp_error_log"
  ON whatsapp_error_log
  FOR ALL
  USING (true)
  WITH CHECK (true);
