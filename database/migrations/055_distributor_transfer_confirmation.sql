-- Migration 055: Distributor Transfer Confirmation & Returns

-- Alter stock_transfers
ALTER TABLE stock_transfers ADD COLUMN IF NOT EXISTS transfer_type VARCHAR(20) NOT NULL DEFAULT 'outbound';
ALTER TABLE stock_transfers ADD COLUMN IF NOT EXISTS batch_id UUID;
ALTER TABLE stock_transfers ADD COLUMN IF NOT EXISTS confirmed_by UUID REFERENCES distributors(id);
ALTER TABLE stock_transfers ADD COLUMN IF NOT EXISTS confirmed_at TIMESTAMPTZ;
ALTER TABLE stock_transfers ADD COLUMN IF NOT EXISTS rejected_at TIMESTAMPTZ;
ALTER TABLE stock_transfers ADD COLUMN IF NOT EXISTS rejection_reason TEXT;
ALTER TABLE stock_transfers ADD COLUMN IF NOT EXISTS force_confirmed_by UUID REFERENCES admin_users(id);
ALTER TABLE stock_transfers ADD COLUMN IF NOT EXISTS force_confirmed_at TIMESTAMPTZ;
ALTER TABLE stock_transfers ADD COLUMN IF NOT EXISTS force_confirm_reason TEXT;
ALTER TABLE stock_transfers ADD COLUMN IF NOT EXISTS initiated_by_type VARCHAR(20) NOT NULL DEFAULT 'admin';
ALTER TABLE stock_transfers ADD COLUMN IF NOT EXISTS initiated_by_distributor UUID REFERENCES distributors(id);

CREATE INDEX IF NOT EXISTS idx_transfers_pending_receipt ON stock_transfers(to_distributor_id, status) WHERE status = 'pending_receipt';
CREATE INDEX IF NOT EXISTS idx_transfers_type ON stock_transfers(transfer_type);
CREATE INDEX IF NOT EXISTS idx_transfers_batch ON stock_transfers(batch_id) WHERE batch_id IS NOT NULL;

-- Spot-check verification for bulk transfers
CREATE TABLE IF NOT EXISTS transfer_spot_checks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transfer_id UUID NOT NULL REFERENCES stock_transfers(id),
  device_id UUID NOT NULL REFERENCES devices(id),
  imei_verified BOOLEAN DEFAULT FALSE,
  condition_rating VARCHAR(20),
  verified_at TIMESTAMPTZ,
  verified_by UUID REFERENCES distributors(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_spot_checks_transfer ON transfer_spot_checks(transfer_id);

-- In-app notifications
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_type VARCHAR(20) NOT NULL,
  recipient_id UUID NOT NULL,
  type VARCHAR(50) NOT NULL,
  title VARCHAR(200) NOT NULL,
  message TEXT NOT NULL,
  reference_type VARCHAR(50),
  reference_id UUID,
  read BOOLEAN NOT NULL DEFAULT FALSE,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_notifications_recipient ON notifications(recipient_type, recipient_id, read) WHERE read = FALSE;
CREATE INDEX IF NOT EXISTS idx_notifications_created ON notifications(created_at);
