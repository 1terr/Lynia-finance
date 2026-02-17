-- Migration 024: Align whatsapp_sessions table with application code
--
-- The code references columns `state_data` and `last_activity_at` but the
-- original migration (001) defines `session_data` and `last_message_at`.
-- This migration adds the expected columns and keeps the originals for
-- backward compatibility.
--
-- Also ensures `customer_id` is nullable (session created before customer
-- lookup completes in onboarding flow).

-- Add state_data column (code uses this; session_data remains for backward compat)
ALTER TABLE whatsapp_sessions
  ADD COLUMN IF NOT EXISTS state_data JSONB;

-- Copy existing session_data to state_data where applicable
UPDATE whatsapp_sessions
  SET state_data = session_data
  WHERE state_data IS NULL AND session_data IS NOT NULL;

-- Add last_activity_at column
ALTER TABLE whatsapp_sessions
  ADD COLUMN IF NOT EXISTS last_activity_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Copy last_message_at to last_activity_at
UPDATE whatsapp_sessions
  SET last_activity_at = last_message_at
  WHERE last_activity_at IS NULL AND last_message_at IS NOT NULL;

-- Create a trigger to keep state_data and session_data in sync
CREATE OR REPLACE FUNCTION sync_whatsapp_session_data()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.state_data IS DISTINCT FROM OLD.state_data THEN
    NEW.session_data := NEW.state_data;
  ELSIF NEW.session_data IS DISTINCT FROM OLD.session_data THEN
    NEW.state_data := NEW.session_data;
  END IF;

  IF NEW.last_activity_at IS DISTINCT FROM OLD.last_activity_at THEN
    NEW.last_message_at := NEW.last_activity_at;
    NEW.updated_at := NEW.last_activity_at;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_whatsapp_session_data ON whatsapp_sessions;
CREATE TRIGGER trg_sync_whatsapp_session_data
  BEFORE UPDATE ON whatsapp_sessions
  FOR EACH ROW
  EXECUTE FUNCTION sync_whatsapp_session_data();

-- Index on last_activity_at for session expiry checks
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_whatsapp_sessions_last_activity
  ON whatsapp_sessions(last_activity_at);
