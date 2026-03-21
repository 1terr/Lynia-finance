-- Migration 052: WhatsApp Session Analytics
--
-- Adds analytics columns to whatsapp_sessions for funnel tracking:
-- completed_at, abandoned_at, total_messages_sent, state_transitions.
-- Enables measurement of onboarding completion rates, drop-off points,
-- and average time per state.

ALTER TABLE whatsapp_sessions ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;
ALTER TABLE whatsapp_sessions ADD COLUMN IF NOT EXISTS abandoned_at TIMESTAMPTZ;
ALTER TABLE whatsapp_sessions ADD COLUMN IF NOT EXISTS total_messages_sent INTEGER DEFAULT 0;
ALTER TABLE whatsapp_sessions ADD COLUMN IF NOT EXISTS state_transitions JSONB DEFAULT '[]'::jsonb;

CREATE INDEX IF NOT EXISTS idx_sessions_completed ON whatsapp_sessions(completed_at) WHERE completed_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_sessions_abandoned ON whatsapp_sessions(abandoned_at) WHERE abandoned_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_sessions_created ON whatsapp_sessions(created_at);
