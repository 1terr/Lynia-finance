-- Migration 027: Two-Phase Payment Holds
--
-- Adds 'held' and 'released' payment statuses with hold tracking columns,
-- and a PostgreSQL function for safe atomic status transitions with
-- optimistic concurrency control.

-- Add new columns for hold tracking
ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS held_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS hold_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS released_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS release_reason TEXT;

-- Index for finding expired holds efficiently
CREATE INDEX IF NOT EXISTS idx_payments_held_expiry
  ON payments(hold_expires_at)
  WHERE status = 'held' AND hold_expires_at IS NOT NULL;

-- Safe atomic status transition function.
-- Returns TRUE if transition succeeded, FALSE if current status
-- didn't match expected (optimistic concurrency).
CREATE OR REPLACE FUNCTION transition_payment_status(
  p_payment_id UUID,
  p_expected_status TEXT,
  p_new_status TEXT,
  p_metadata JSONB DEFAULT '{}'
) RETURNS BOOLEAN AS $$
DECLARE
  affected INTEGER;
BEGIN
  UPDATE payments
  SET status = p_new_status,
      updated_at = NOW(),
      held_at = CASE WHEN p_new_status = 'held' THEN NOW() ELSE held_at END,
      hold_expires_at = CASE WHEN p_new_status = 'held'
        THEN NOW() + INTERVAL '30 minutes' ELSE hold_expires_at END,
      released_at = CASE WHEN p_new_status = 'released' THEN NOW() ELSE released_at END,
      release_reason = CASE WHEN p_new_status = 'released' AND p_metadata->>'release_reason' IS NOT NULL
        THEN p_metadata->>'release_reason' ELSE release_reason END,
      completed_at = CASE WHEN p_new_status = 'completed' THEN NOW() ELSE completed_at END,
      failed_at = CASE WHEN p_new_status = 'failed' THEN NOW() ELSE failed_at END
  WHERE id = p_payment_id
    AND status = p_expected_status;

  GET DIAGNOSTICS affected = ROW_COUNT;
  RETURN affected > 0;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION transition_payment_status IS
  'Atomic payment status transition with optimistic concurrency. '
  'Returns FALSE if the payment is not in the expected status (concurrent modification).';
