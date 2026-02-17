-- Migration 026: Payment Events Audit Log
--
-- Structured audit trail tracking every payment state transition.
-- Replaces ad-hoc console.log with a queryable event stream.
-- Modeled after the fineract_sync_log pattern (migration 019).
--
-- Partition by created_at when volume exceeds 1M rows.

CREATE TABLE IF NOT EXISTS payment_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Payment reference
  payment_id UUID NOT NULL,
  loan_id UUID,
  customer_id UUID,

  -- State transition
  from_status TEXT,           -- NULL for initial creation
  to_status TEXT NOT NULL,
  event_type TEXT NOT NULL,   -- 'initiated','held','provider_submitted','webhook_received',
                              -- 'completed','failed','released','timeout','reconciled','escalated'

  -- Context
  gateway TEXT,               -- 'ecocash','onemoney','omari','innbucks'
  provider_transaction_id TEXT,
  provider_response JSONB,

  -- Actor
  actor_type TEXT NOT NULL DEFAULT 'system',  -- 'system','webhook','admin','reconciliation'
  actor_id TEXT,

  -- Error tracking
  error_code TEXT,
  error_message TEXT,

  -- Timing
  duration_ms INTEGER,        -- Time spent in previous state
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Correlation
  request_id TEXT,            -- Lambda request ID for tracing
  idempotency_key TEXT        -- For deduplication
);

-- Indexes optimized for common query patterns
CREATE INDEX IF NOT EXISTS idx_payment_events_payment_id
  ON payment_events(payment_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_payment_events_type
  ON payment_events(event_type, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_payment_events_status_transition
  ON payment_events(from_status, to_status);

CREATE INDEX IF NOT EXISTS idx_payment_events_created
  ON payment_events(created_at DESC);

-- For finding stuck payments by gateway
CREATE INDEX IF NOT EXISTS idx_payment_events_gateway_status
  ON payment_events(gateway, to_status, created_at DESC);

COMMENT ON TABLE payment_events IS
  'Structured audit log tracking every payment state transition. '
  'Replaces ad-hoc console logging with queryable event stream.';
