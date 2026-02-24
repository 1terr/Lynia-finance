-- Migration 032: Align database schema with WhatsApp service code
--
-- The WhatsApp service references columns and types that don't exist in
-- the current schema. This migration adds them so that message storage,
-- customer lookup, and deduplication work correctly.
--
-- All changes are additive (ADD COLUMN IF NOT EXISTS) and therefore
-- backward-compatible with the currently deployed code.

-- ===================================================================
-- 1. CUSTOMERS TABLE - Add whatsapp_number column
-- ===================================================================
-- Code in whatsapp-service/src/index.ts queries and inserts using
-- `whatsapp_number`, but the table only has `phone_number`.

ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS whatsapp_number VARCHAR(20);

-- Backfill from phone_number for existing customers
UPDATE customers
  SET whatsapp_number = phone_number
  WHERE whatsapp_number IS NULL AND phone_number IS NOT NULL;

-- Index for WhatsApp lookups (findOrCreateCustomer)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_customers_whatsapp_number
  ON customers(whatsapp_number);

-- ===================================================================
-- 2. WHATSAPP_MESSAGES TABLE - Add missing columns
-- ===================================================================
-- Code inserts customer_id, whatsapp_message_id, template_name, and
-- failed_at, but the table (migration 001) only has message_id,
-- session_id, phone_number, direction, message_type, content, status.

ALTER TABLE whatsapp_messages
  ADD COLUMN IF NOT EXISTS customer_id UUID REFERENCES customers(id),
  ADD COLUMN IF NOT EXISTS whatsapp_message_id VARCHAR(200),
  ADD COLUMN IF NOT EXISTS template_name VARCHAR(100),
  ADD COLUMN IF NOT EXISTS failed_at TIMESTAMPTZ;

-- Index for deduplication checks (prevent duplicate webhook processing)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_whatsapp_messages_wa_msg_id
  ON whatsapp_messages(whatsapp_message_id);

-- Index for customer message lookups
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_whatsapp_messages_customer_id
  ON whatsapp_messages(customer_id);
