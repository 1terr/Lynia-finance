-- Migration 054: Consolidate agent_inventory into devices table
-- Adds distributor_id directly to devices, eliminating dual-tracking

ALTER TABLE devices ADD COLUMN IF NOT EXISTS distributor_id UUID REFERENCES distributors(id);
ALTER TABLE devices ADD COLUMN IF NOT EXISTS assigned_to_distributor_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS idx_devices_distributor ON devices(distributor_id) WHERE distributor_id IS NOT NULL;

-- Backfill from agent_inventory
UPDATE devices d SET
  distributor_id = ai.distributor_id,
  assigned_to_distributor_at = ai.assigned_date
FROM agent_inventory ai
WHERE ai.device_id = d.id AND ai.status IN ('available', 'sold');
