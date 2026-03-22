-- Create device_lock_events table for tracking lock/unlock operations
CREATE TABLE IF NOT EXISTS device_lock_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id UUID NOT NULL REFERENCES devices(id),
  event_type VARCHAR(10) NOT NULL CHECK (event_type IN ('lock', 'unlock')),
  triggered_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_device_lock_events_device ON device_lock_events(device_id);
CREATE INDEX idx_device_lock_events_created ON device_lock_events(created_at);
CREATE INDEX idx_device_lock_events_type_created ON device_lock_events(event_type, created_at);
