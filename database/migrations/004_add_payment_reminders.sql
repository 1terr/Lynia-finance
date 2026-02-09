-- =====================================================
-- Lynia Finance - Payment Reminders & Customer Preferences
-- Migration: 004
-- Created: February 8, 2026
-- Phase: Phase 3 - P3-T014 Payment Reminders
-- =====================================================

-- Payment Reminders Table
CREATE TABLE IF NOT EXISTS payment_reminders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- References
  loan_id UUID NOT NULL REFERENCES loans(id),
  customer_id UUID NOT NULL REFERENCES customers(id),

  -- Reminder details
  reminder_type VARCHAR(30) NOT NULL,   -- pre_due_7, overdue_1, etc.
  tone VARCHAR(30) NOT NULL,            -- friendly, reminder, urgent, warning, firm, collection, default_notice
  message_content TEXT NOT NULL,
  payment_link TEXT,

  -- Scheduling
  scheduled_for TIMESTAMPTZ NOT NULL,
  sent_at TIMESTAMPTZ,

  -- Delivery tracking
  status VARCHAR(20) NOT NULL DEFAULT 'pending',  -- pending, sent, delivered, read, failed, skipped, opted_out
  whatsapp_message_id VARCHAR(100),
  failure_reason TEXT,

  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_reminders_loan ON payment_reminders(loan_id);
CREATE INDEX idx_reminders_customer ON payment_reminders(customer_id);
CREATE INDEX idx_reminders_status ON payment_reminders(status);
CREATE INDEX idx_reminders_type ON payment_reminders(reminder_type);
CREATE INDEX idx_reminders_scheduled ON payment_reminders(scheduled_for);
-- Prevent duplicate reminders for same loan/type combination
CREATE UNIQUE INDEX idx_reminders_unique_per_cycle
  ON payment_reminders(loan_id, reminder_type, DATE(scheduled_for));

-- Customer Preferences Table
CREATE TABLE IF NOT EXISTS customer_preferences (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID UNIQUE NOT NULL REFERENCES customers(id),

  -- Notification preferences
  reminder_opt_out BOOLEAN DEFAULT FALSE,
  preferred_language VARCHAR(10) DEFAULT 'en',   -- en, sn (Shona), nd (Ndebele)
  preferred_reminder_time VARCHAR(5),            -- HH:MM format, e.g. '09:00'
  sms_fallback_enabled BOOLEAN DEFAULT TRUE,

  -- Communication preferences
  marketing_opt_in BOOLEAN DEFAULT FALSE,
  promotional_opt_in BOOLEAN DEFAULT FALSE,

  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_preferences_customer ON customer_preferences(customer_id);

-- RLS Policies
ALTER TABLE payment_reminders ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_preferences ENABLE ROW LEVEL SECURITY;

-- Service role can manage reminders
CREATE POLICY "Service role manages reminders"
  ON payment_reminders FOR ALL
  USING (true);

CREATE POLICY "Service role manages preferences"
  ON customer_preferences FOR ALL
  USING (true);
