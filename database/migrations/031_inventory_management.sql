-- ============================================================================
-- Migration 031: Inventory Management System
-- Creates inventory_movements, inventory_adjustments, stock_transfers,
-- and device_reservations tables
-- ============================================================================

-- ============================================================================
-- A. CREATE inventory_movements - Immutable ledger of every stock change
-- ============================================================================

CREATE TABLE IF NOT EXISTS inventory_movements (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Device Reference
  device_id                 UUID REFERENCES devices(id),
  device_model_id           UUID REFERENCES device_models(id),

  -- Movement Details
  movement_type             VARCHAR(50) NOT NULL,
    -- received, assigned_to_agent, handover, returned, damaged, lost,
    -- transferred, adjustment, repossessed, written_off, reserved, unreserved
  from_status               VARCHAR(50),
  to_status                 VARCHAR(50),

  -- Location Tracking
  from_location             VARCHAR(200),
  to_location               VARCHAR(200),
  from_distributor_id       UUID REFERENCES distributors(id),
  to_distributor_id         UUID REFERENCES distributors(id),

  -- Reference
  reference_type            VARCHAR(50),
    -- purchase_order, transfer, handover, adjustment, repossession, reservation, bulk_import
  reference_id              UUID,

  -- Metadata
  performed_by              UUID REFERENCES admin_users(id),
  notes                     TEXT,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inv_movements_device ON inventory_movements(device_id);
CREATE INDEX IF NOT EXISTS idx_inv_movements_model ON inventory_movements(device_model_id);
CREATE INDEX IF NOT EXISTS idx_inv_movements_type ON inventory_movements(movement_type);
CREATE INDEX IF NOT EXISTS idx_inv_movements_created ON inventory_movements(created_at);
CREATE INDEX IF NOT EXISTS idx_inv_movements_ref ON inventory_movements(reference_type, reference_id);

COMMENT ON TABLE inventory_movements IS
  'Immutable audit ledger of every device stock movement. Never updated or deleted.';

-- ============================================================================
-- B. CREATE inventory_adjustments - Auditable stock corrections
-- ============================================================================

CREATE TABLE IF NOT EXISTS inventory_adjustments (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Device Reference
  device_id                 UUID REFERENCES devices(id),
  device_model_id           UUID REFERENCES device_models(id),

  -- Adjustment Details
  adjustment_type           VARCHAR(50) NOT NULL,
    -- add, remove, damage, write_off, found, audit_correction
  reason                    TEXT NOT NULL,

  -- Before/After State
  previous_status           VARCHAR(50),
  new_status                VARCHAR(50),

  -- Approval Workflow (maker-checker)
  requested_by              UUID NOT NULL REFERENCES admin_users(id),
  approved_by               UUID REFERENCES admin_users(id),
  approval_status           VARCHAR(20) NOT NULL DEFAULT 'pending',
    -- pending, approved, rejected
  approved_at               TIMESTAMPTZ,
  rejection_reason          TEXT,

  -- Notes
  notes                     TEXT,

  -- Metadata
  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inv_adjustments_device ON inventory_adjustments(device_id);
CREATE INDEX IF NOT EXISTS idx_inv_adjustments_status ON inventory_adjustments(approval_status);
CREATE INDEX IF NOT EXISTS idx_inv_adjustments_type ON inventory_adjustments(adjustment_type);
CREATE INDEX IF NOT EXISTS idx_inv_adjustments_pending ON inventory_adjustments(approval_status)
  WHERE approval_status = 'pending';

COMMENT ON TABLE inventory_adjustments IS
  'Stock adjustment requests with maker-checker approval workflow';

-- ============================================================================
-- C. CREATE stock_transfers - Inter-location movements
-- ============================================================================

CREATE TABLE IF NOT EXISTS stock_transfers (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Device Reference
  device_id                 UUID NOT NULL REFERENCES devices(id),

  -- Transfer Parties
  from_distributor_id       UUID REFERENCES distributors(id),
  to_distributor_id         UUID REFERENCES distributors(id),
  from_location             VARCHAR(200),
  to_location               VARCHAR(200),

  -- Status
  status                    VARCHAR(20) NOT NULL DEFAULT 'requested',
    -- requested, approved, in_transit, received, cancelled
  requested_by              UUID NOT NULL REFERENCES admin_users(id),
  approved_by               UUID REFERENCES admin_users(id),
  approved_at               TIMESTAMPTZ,
  shipped_at                TIMESTAMPTZ,
  received_at               TIMESTAMPTZ,
  cancelled_at              TIMESTAMPTZ,
  cancellation_reason       TEXT,

  -- Notes
  notes                     TEXT,

  -- Metadata
  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_transfers_device ON stock_transfers(device_id);
CREATE INDEX IF NOT EXISTS idx_transfers_from ON stock_transfers(from_distributor_id);
CREATE INDEX IF NOT EXISTS idx_transfers_to ON stock_transfers(to_distributor_id);
CREATE INDEX IF NOT EXISTS idx_transfers_status ON stock_transfers(status);

COMMENT ON TABLE stock_transfers IS
  'Device transfer requests between distributors or warehouse locations';

-- ============================================================================
-- D. CREATE device_reservations - Temporary holds for approved loans
-- ============================================================================

CREATE TABLE IF NOT EXISTS device_reservations (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- References
  device_id                 UUID NOT NULL REFERENCES devices(id),
  loan_id                   UUID NOT NULL REFERENCES loans(id),
  customer_id               UUID NOT NULL REFERENCES customers(id),

  -- Reservation Timing
  reserved_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at                TIMESTAMPTZ NOT NULL,

  -- Status
  status                    VARCHAR(20) NOT NULL DEFAULT 'active',
    -- active, expired, converted, cancelled
  converted_at              TIMESTAMPTZ,
  cancelled_at              TIMESTAMPTZ,
  cancellation_reason       TEXT,

  -- Metadata
  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reservations_device ON device_reservations(device_id);
CREATE INDEX IF NOT EXISTS idx_reservations_loan ON device_reservations(loan_id);
CREATE INDEX IF NOT EXISTS idx_reservations_status ON device_reservations(status);
CREATE INDEX IF NOT EXISTS idx_reservations_expires ON device_reservations(expires_at)
  WHERE status = 'active';

COMMENT ON TABLE device_reservations IS
  'Temporary 48-hour device holds when a loan is approved before handover';

-- ============================================================================
-- E. CREATE trigger for inventory_movements on device status changes
-- ============================================================================

CREATE OR REPLACE FUNCTION fn_record_inventory_movement()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO inventory_movements (
      device_id, device_model_id, movement_type,
      from_status, to_status, to_location
    ) VALUES (
      NEW.id, NEW.device_model_id, 'received',
      NULL, NEW.status, NEW.location
    );
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO inventory_movements (
      device_id, device_model_id, movement_type,
      from_status, to_status,
      from_location, to_location
    ) VALUES (
      NEW.id, NEW.device_model_id,
      CASE NEW.status
        WHEN 'in_stock' THEN 'returned'
        WHEN 'assigned' THEN 'assigned_to_agent'
        WHEN 'reserved' THEN 'reserved'
        WHEN 'sold' THEN 'handover'
        WHEN 'returned' THEN 'returned'
        WHEN 'repossessed' THEN 'repossessed'
        WHEN 'damaged' THEN 'damaged'
        WHEN 'lost' THEN 'lost'
        WHEN 'written_off' THEN 'written_off'
        ELSE 'adjustment'
      END,
      OLD.status, NEW.status,
      OLD.location, NEW.location
    );
    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_record_inventory_movement ON devices;
CREATE TRIGGER trg_record_inventory_movement
  AFTER INSERT OR UPDATE ON devices
  FOR EACH ROW
  EXECUTE FUNCTION fn_record_inventory_movement();

COMMENT ON FUNCTION fn_record_inventory_movement IS
  'Automatically records an inventory_movements entry on every device status change';
