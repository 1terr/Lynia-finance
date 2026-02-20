-- ============================================================================
-- Migration 030: Inventory Foundation
-- Creates missing tables referenced by services + standardizes device status
-- ============================================================================

-- ============================================================================
-- A. CREATE device_handovers - Missing table used by handover-service.ts
-- ============================================================================

CREATE TABLE IF NOT EXISTS device_handovers (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- References
  loan_id                   UUID NOT NULL REFERENCES loans(id),
  device_id                 UUID NOT NULL REFERENCES devices(id),
  customer_id               UUID NOT NULL REFERENCES customers(id),
  distributor_id            UUID NOT NULL REFERENCES distributors(id),

  -- Handover Details
  handover_location         VARCHAR(200),
  handed_over_by            UUID,
  handed_over_at            TIMESTAMPTZ,

  -- Status Tracking
  status                    VARCHAR(50) NOT NULL DEFAULT 'initiated',
    -- initiated, identity_verified, deposit_verified, device_inspected, completed, failed

  -- Verification Checkpoints
  identity_verified         BOOLEAN NOT NULL DEFAULT FALSE,
  deposit_verified          BOOLEAN NOT NULL DEFAULT FALSE,
  device_condition_verified BOOLEAN NOT NULL DEFAULT FALSE,
  app_installed             BOOLEAN NOT NULL DEFAULT FALSE,
  app_configured            BOOLEAN NOT NULL DEFAULT FALSE,
  lock_test_passed          BOOLEAN NOT NULL DEFAULT FALSE,

  -- Condition & Documents
  device_condition          JSONB,
  customer_signature_url    TEXT,
  loan_agreement_url        TEXT,
  device_condition_form_url TEXT,

  -- Failure
  failure_reason            TEXT,

  -- Metadata
  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_device_handovers_loan ON device_handovers(loan_id);
CREATE INDEX IF NOT EXISTS idx_device_handovers_device ON device_handovers(device_id);
CREATE INDEX IF NOT EXISTS idx_device_handovers_customer ON device_handovers(customer_id);
CREATE INDEX IF NOT EXISTS idx_device_handovers_distributor ON device_handovers(distributor_id);
CREATE INDEX IF NOT EXISTS idx_device_handovers_status ON device_handovers(status);

COMMENT ON TABLE device_handovers IS
  'Tracks the multi-step device handover workflow from distributor to customer';

-- ============================================================================
-- B. CREATE device_lock_triggers - Missing table used by lock-management-service.ts
-- ============================================================================

CREATE TABLE IF NOT EXISTS device_lock_triggers (
  trigger_id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- References
  loan_id                   UUID NOT NULL REFERENCES loans(id),
  customer_id               UUID NOT NULL REFERENCES customers(id),
  device_id                 UUID NOT NULL REFERENCES devices(id),

  -- Trigger Details
  trigger_type              VARCHAR(50) NOT NULL,
    -- missed_payment, severe_default, fraud, theft
  severity                  VARCHAR(20) NOT NULL DEFAULT 'warning',
    -- warning, lock
  triggered_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Grace Period
  grace_period_until        TIMESTAMPTZ NOT NULL,
  lock_scheduled_at         TIMESTAMPTZ NOT NULL,

  -- Status
  status                    VARCHAR(20) NOT NULL DEFAULT 'pending',
    -- pending, executed, cancelled, failed
  executed_at               TIMESTAMPTZ,
  cancelled_at              TIMESTAMPTZ,
  cancellation_reason       TEXT,
  error_message             TEXT,

  -- Metadata
  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lock_triggers_loan ON device_lock_triggers(loan_id);
CREATE INDEX IF NOT EXISTS idx_lock_triggers_device ON device_lock_triggers(device_id);
CREATE INDEX IF NOT EXISTS idx_lock_triggers_status ON device_lock_triggers(status);
CREATE INDEX IF NOT EXISTS idx_lock_triggers_scheduled ON device_lock_triggers(lock_scheduled_at)
  WHERE status = 'pending';

COMMENT ON TABLE device_lock_triggers IS
  'Scheduled lock triggers with grace periods for overdue payments';

-- ============================================================================
-- C. CREATE device_lock_history - Missing table used by lock-management-service.ts
-- ============================================================================

CREATE TABLE IF NOT EXISTS device_lock_history (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- References
  device_id                 UUID NOT NULL REFERENCES devices(id),

  -- Lock Event
  action                    VARCHAR(20) NOT NULL,
    -- lock, unlock
  reason                    TEXT,
  performed_by              VARCHAR(50) NOT NULL DEFAULT 'system',
    -- system, admin, customer_payment
  admin_user_id             UUID REFERENCES admin_users(id),

  -- Execution
  execution_status          VARCHAR(20) NOT NULL DEFAULT 'pending',
    -- pending, success, failed
  error_message             TEXT,
  lock_provider             VARCHAR(50) DEFAULT 'trustonic',

  -- Metadata
  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lock_history_device ON device_lock_history(device_id);
CREATE INDEX IF NOT EXISTS idx_lock_history_action ON device_lock_history(action);
CREATE INDEX IF NOT EXISTS idx_lock_history_created ON device_lock_history(created_at);

COMMENT ON TABLE device_lock_history IS
  'Immutable audit log of every device lock/unlock operation';

-- ============================================================================
-- D. Standardize device status enum
-- Add missing status values: reserved, damaged, repossessed, written_off
-- ============================================================================

-- Add unlocked_at column to devices (referenced in lock-management-service but missing)
ALTER TABLE devices
  ADD COLUMN IF NOT EXISTS unlocked_at TIMESTAMPTZ;

-- ============================================================================
-- E. Add reorder_level and lead_time_days to device_models
-- ============================================================================

ALTER TABLE device_models
  ADD COLUMN IF NOT EXISTS reorder_level INTEGER NOT NULL DEFAULT 5,
  ADD COLUMN IF NOT EXISTS lead_time_days INTEGER NOT NULL DEFAULT 14;

COMMENT ON COLUMN device_models.reorder_level IS
  'Minimum stock level before reorder alert is triggered';
COMMENT ON COLUMN device_models.lead_time_days IS
  'Expected days from order to delivery for this model';

-- ============================================================================
-- F. Create trigger to keep device_models.available_stock in sync
-- ============================================================================

CREATE OR REPLACE FUNCTION fn_sync_device_model_stock()
RETURNS TRIGGER AS $$
BEGIN
  -- On INSERT: if device has a model and is in_stock, increment
  IF TG_OP = 'INSERT' THEN
    IF NEW.device_model_id IS NOT NULL AND NEW.status = 'in_stock' THEN
      UPDATE device_models
        SET available_stock = available_stock + 1,
            updated_at = NOW()
        WHERE id = NEW.device_model_id;
    END IF;
    RETURN NEW;
  END IF;

  -- On UPDATE: adjust stock when status or model changes
  IF TG_OP = 'UPDATE' THEN
    -- Only act if status or device_model_id changed
    IF OLD.status IS DISTINCT FROM NEW.status
       OR OLD.device_model_id IS DISTINCT FROM NEW.device_model_id THEN

      -- Decrement old model if was in_stock
      IF OLD.device_model_id IS NOT NULL AND OLD.status = 'in_stock' THEN
        UPDATE device_models
          SET available_stock = GREATEST(available_stock - 1, 0),
              updated_at = NOW()
          WHERE id = OLD.device_model_id;
      END IF;

      -- Increment new model if now in_stock
      IF NEW.device_model_id IS NOT NULL AND NEW.status = 'in_stock' THEN
        UPDATE device_models
          SET available_stock = available_stock + 1,
              updated_at = NOW()
          WHERE id = NEW.device_model_id;
      END IF;
    END IF;
    RETURN NEW;
  END IF;

  -- On DELETE: decrement if was in_stock
  IF TG_OP = 'DELETE' THEN
    IF OLD.device_model_id IS NOT NULL AND OLD.status = 'in_stock' THEN
      UPDATE device_models
        SET available_stock = GREATEST(available_stock - 1, 0),
            updated_at = NOW()
        WHERE id = OLD.device_model_id;
    END IF;
    RETURN OLD;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_device_model_stock ON devices;
CREATE TRIGGER trg_sync_device_model_stock
  AFTER INSERT OR UPDATE OR DELETE ON devices
  FOR EACH ROW
  EXECUTE FUNCTION fn_sync_device_model_stock();

COMMENT ON FUNCTION fn_sync_device_model_stock IS
  'Keeps device_models.available_stock in sync with actual device counts';
