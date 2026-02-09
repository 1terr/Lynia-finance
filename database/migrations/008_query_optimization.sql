-- =====================================================
-- Lynia Finance - Query Optimization & Performance Indexes
-- Migration: 008
-- Created: February 9, 2026
-- Phase: Phase 4 - P4-T005 Database Query Optimization
-- =====================================================
-- Purpose: Add composite indexes, covering indexes, and
-- partial indexes to optimize critical query paths identified
-- during P4-T004 performance benchmarking.
-- =====================================================

-- =====================================================
-- 1. COMPOSITE INDEXES FOR CRITICAL JOIN PATTERNS
-- =====================================================

-- Loans: Customer + Status (most common dashboard query)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_loans_customer_status
  ON loans(customer_id, status);

-- Loans: Status + Days Past Due (delinquency reporting)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_loans_status_dpd
  ON loans(status, days_past_due)
  WHERE status = 'active' AND days_past_due > 0;

-- Loans: Created date + Status (time-series reporting)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_loans_created_status
  ON loans(created_at DESC, status);

-- Payments: Loan + Status + Date (payment history per loan)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_payments_loan_status_date
  ON payments(loan_id, status, payment_date DESC);

-- Payments: Customer + Date (customer payment history)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_payments_customer_date
  ON payments(customer_id, payment_date DESC);

-- Payments: Reconciliation status (admin reconciliation page)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_payments_unreconciled
  ON payments(reconciled, status)
  WHERE reconciled = FALSE AND status = 'confirmed';

-- Payments: Method + Status (reconciliation by provider)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_payments_method_status
  ON payments(payment_method, status);

-- =====================================================
-- 2. COVERING INDEXES FOR DASHBOARD QUERIES
-- =====================================================

-- Credit scores: Latest score per customer (avoids table lookup)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_credit_scores_customer_latest
  ON credit_scores(customer_id, calculated_at DESC)
  INCLUDE (scaled_score, decision, credit_tier);

-- KYC submissions: Latest per customer
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_kyc_customer_latest
  ON kyc_submissions(customer_id, submitted_at DESC)
  INCLUDE (status, confidence_score);

-- Notifications: Customer history with status
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_notifications_customer_status_date
  ON notifications(customer_id, status, created_at DESC);

-- Device locks: Device history ordered by date
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_device_locks_device_date
  ON device_locks(device_id, executed_at DESC)
  INCLUDE (action, execution_status);

-- =====================================================
-- 3. PARTIAL INDEXES FOR FREQUENT FILTERED QUERIES
-- =====================================================

-- Active loans only (most dashboard queries filter for active)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_loans_active
  ON loans(customer_id, next_payment_date)
  WHERE status = 'active';

-- Pending loan approvals (admin approval queue)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_loans_pending_approval
  ON loans(created_at DESC)
  WHERE status = 'pending' AND approval_status = 'manual_review';

-- Overdue loans (delinquency management)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_loans_overdue
  ON loans(days_past_due DESC, customer_id)
  WHERE days_past_due > 0 AND status = 'active';

-- Pending KYC reviews (admin KYC queue)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_kyc_pending_review
  ON kyc_submissions(submitted_at DESC)
  WHERE status = 'pending' OR status = 'in_review';

-- Active WhatsApp sessions
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_whatsapp_sessions_active_phone
  ON whatsapp_sessions(phone_number)
  WHERE active = TRUE;

-- Pending payment reminders (scheduler query)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_reminders_pending_schedule
  ON payment_reminders(scheduled_for)
  WHERE status = 'pending';

-- Unreviewed fraud alerts
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_fraud_alerts_unreviewed
  ON fraud_alerts(risk_score DESC, created_at DESC)
  WHERE reviewed = FALSE;

-- Locked devices (lock management page)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_devices_locked
  ON devices(locked_at DESC, customer_id)
  WHERE lock_status = 'locked';

-- =====================================================
-- 4. EXPRESSION INDEXES
-- =====================================================

-- Audit log: Date-only index for daily reporting
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_log_date
  ON audit_log(DATE(created_at));

-- Payments: Date-only index for daily reconciliation
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_payments_payment_date_only
  ON payments(DATE(payment_date));

-- WhatsApp messages: Date-only for daily message volume
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_whatsapp_messages_date
  ON whatsapp_messages(DATE(sent_at));

-- =====================================================
-- 5. MATERIALIZED VIEW OPTIMIZATION
-- =====================================================

-- Drop and recreate portfolio summary with more detail
DROP MATERIALIZED VIEW IF EXISTS mv_portfolio_summary;

CREATE MATERIALIZED VIEW mv_portfolio_summary AS
SELECT
  COUNT(DISTINCT l.id) AS total_loans,
  COUNT(DISTINCT l.customer_id) AS total_customers,
  COALESCE(SUM(l.loan_amount_usd), 0) AS total_disbursed_usd,
  COALESCE(SUM(l.outstanding_balance_usd), 0) AS total_outstanding_usd,
  COALESCE(SUM(l.total_paid_usd), 0) AS total_collected_usd,
  COALESCE(AVG(l.days_past_due), 0) AS avg_days_past_due,
  COUNT(CASE WHEN l.status = 'active' THEN 1 END) AS active_loans,
  COUNT(CASE WHEN l.status = 'pending' THEN 1 END) AS pending_loans,
  COUNT(CASE WHEN l.status = 'disbursed' THEN 1 END) AS disbursed_loans,
  COUNT(CASE WHEN l.status = 'paid_off' THEN 1 END) AS paid_off_loans,
  COUNT(CASE WHEN l.status = 'defaulted' THEN 1 END) AS defaulted_loans,
  COUNT(CASE WHEN l.days_past_due > 0 AND l.status = 'active' THEN 1 END) AS delinquent_loans,
  COUNT(CASE WHEN l.days_past_due > 30 AND l.status = 'active' THEN 1 END) AS seriously_delinquent_loans,
  CASE
    WHEN COUNT(CASE WHEN l.status = 'active' THEN 1 END) > 0
    THEN COUNT(CASE WHEN l.days_past_due > 30 AND l.status = 'active' THEN 1 END)::DECIMAL /
         COUNT(CASE WHEN l.status = 'active' THEN 1 END) * 100
    ELSE 0
  END AS delinquency_rate_pct,
  NOW() AS last_refreshed_at
FROM loans l
WHERE l.status NOT IN ('rejected', 'cancelled');

-- Create unique index for concurrent refresh
CREATE UNIQUE INDEX ON mv_portfolio_summary (last_refreshed_at);

-- Daily payment summary materialized view (for reconciliation dashboard)
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_daily_payment_summary AS
SELECT
  DATE(p.payment_date) AS payment_day,
  p.payment_method,
  p.status,
  COUNT(*) AS transaction_count,
  COALESCE(SUM(p.amount_usd), 0) AS total_amount_usd,
  COALESCE(AVG(p.amount_usd), 0) AS avg_amount_usd,
  MIN(p.payment_date) AS earliest_payment,
  MAX(p.payment_date) AS latest_payment
FROM payments p
WHERE p.payment_date >= NOW() - INTERVAL '90 days'
GROUP BY DATE(p.payment_date), p.payment_method, p.status
ORDER BY payment_day DESC, p.payment_method;

CREATE UNIQUE INDEX ON mv_daily_payment_summary (payment_day, payment_method, status);

-- Customer credit summary materialized view (for scoring dashboard)
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_customer_credit_summary AS
SELECT
  c.id AS customer_id,
  c.first_name,
  c.last_name,
  c.kyc_status,
  c.credit_score,
  c.credit_tier,
  COUNT(DISTINCT l.id) AS total_loans,
  COUNT(DISTINCT CASE WHEN l.status = 'active' THEN l.id END) AS active_loans,
  COALESCE(SUM(CASE WHEN l.status = 'active' THEN l.outstanding_balance_usd END), 0) AS total_outstanding,
  COALESCE(MAX(l.days_past_due), 0) AS max_days_past_due,
  COUNT(DISTINCT p.id) FILTER (WHERE p.status = 'confirmed') AS confirmed_payments,
  COUNT(DISTINCT p.id) FILTER (WHERE p.status = 'failed') AS failed_payments
FROM customers c
LEFT JOIN loans l ON l.customer_id = c.id
LEFT JOIN payments p ON p.customer_id = c.id
WHERE c.deleted_at IS NULL
GROUP BY c.id, c.first_name, c.last_name, c.kyc_status, c.credit_score, c.credit_tier;

CREATE UNIQUE INDEX ON mv_customer_credit_summary (customer_id);

-- =====================================================
-- 6. REFRESH FUNCTIONS FOR MATERIALIZED VIEWS
-- =====================================================

-- Refresh all materialized views (called by scheduler)
CREATE OR REPLACE FUNCTION refresh_all_materialized_views()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_portfolio_summary;
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_daily_payment_summary;
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_customer_credit_summary;
END;
$$ LANGUAGE plpgsql;

-- Refresh portfolio summary (frequent - every 5 minutes)
CREATE OR REPLACE FUNCTION refresh_portfolio_summary()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_portfolio_summary;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 7. QUERY OPTIMIZATION: UPDATE STATISTICS
-- =====================================================

-- Analyze tables to update query planner statistics
ANALYZE customers;
ANALYZE loans;
ANALYZE payments;
ANALYZE devices;
ANALYZE device_locks;
ANALYZE credit_scores;
ANALYZE kyc_submissions;
ANALYZE notifications;
ANALYZE whatsapp_sessions;
ANALYZE whatsapp_messages;
ANALYZE audit_log;
ANALYZE payment_reminders;
ANALYZE fraud_alerts;

-- =====================================================
-- COMPLETION MESSAGE
-- =====================================================
DO $$
BEGIN
  RAISE NOTICE 'Query optimization migration completed successfully!';
  RAISE NOTICE 'Added:';
  RAISE NOTICE '  - 7 composite indexes for critical join patterns';
  RAISE NOTICE '  - 4 covering indexes for dashboard queries';
  RAISE NOTICE '  - 8 partial indexes for filtered queries';
  RAISE NOTICE '  - 3 expression indexes for date-based reporting';
  RAISE NOTICE '  - 3 materialized views (portfolio, payments, credit)';
  RAISE NOTICE '  - 2 refresh functions';
  RAISE NOTICE '  - Table statistics updated (ANALYZE)';
END $$;
