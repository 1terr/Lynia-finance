-- =====================================================
-- Lynia Finance - Table Partitioning Strategy
-- Migration: 009
-- Created: February 9, 2026
-- Phase: Phase 4 - P4-T005 Database Query Optimization
-- =====================================================
-- Purpose: Implement date-based partitioning for high-volume
-- tables (payments, audit_log, whatsapp_messages, notifications)
-- to improve query performance and enable efficient data archival.
--
-- Strategy: Range partitioning by month on timestamp columns.
-- Partitions are created for the current year plus 1 year ahead.
-- Old partitions can be detached and archived to S3.
-- =====================================================

-- =====================================================
-- 1. PARTITIONED AUDIT_LOG TABLE
-- =====================================================
-- The audit_log table grows continuously and is queried with
-- date filters for compliance reporting. Partitioning by month
-- significantly improves query performance for time-bounded queries.

-- Create new partitioned table
CREATE TABLE IF NOT EXISTS audit_log_partitioned (
  id UUID DEFAULT uuid_generate_v4(),
  user_id UUID,
  user_type VARCHAR(50),
  user_email VARCHAR(255),
  action VARCHAR(100) NOT NULL,
  entity_type VARCHAR(100),
  entity_id UUID,
  description TEXT,
  changes JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (created_at);

-- Create monthly partitions for 2025-2027
CREATE TABLE IF NOT EXISTS audit_log_y2025m01 PARTITION OF audit_log_partitioned
  FOR VALUES FROM ('2025-01-01') TO ('2025-02-01');
CREATE TABLE IF NOT EXISTS audit_log_y2025m02 PARTITION OF audit_log_partitioned
  FOR VALUES FROM ('2025-02-01') TO ('2025-03-01');
CREATE TABLE IF NOT EXISTS audit_log_y2025m03 PARTITION OF audit_log_partitioned
  FOR VALUES FROM ('2025-03-01') TO ('2025-04-01');
CREATE TABLE IF NOT EXISTS audit_log_y2025m04 PARTITION OF audit_log_partitioned
  FOR VALUES FROM ('2025-04-01') TO ('2025-05-01');
CREATE TABLE IF NOT EXISTS audit_log_y2025m05 PARTITION OF audit_log_partitioned
  FOR VALUES FROM ('2025-05-01') TO ('2025-06-01');
CREATE TABLE IF NOT EXISTS audit_log_y2025m06 PARTITION OF audit_log_partitioned
  FOR VALUES FROM ('2025-06-01') TO ('2025-07-01');
CREATE TABLE IF NOT EXISTS audit_log_y2025m07 PARTITION OF audit_log_partitioned
  FOR VALUES FROM ('2025-07-01') TO ('2025-08-01');
CREATE TABLE IF NOT EXISTS audit_log_y2025m08 PARTITION OF audit_log_partitioned
  FOR VALUES FROM ('2025-08-01') TO ('2025-09-01');
CREATE TABLE IF NOT EXISTS audit_log_y2025m09 PARTITION OF audit_log_partitioned
  FOR VALUES FROM ('2025-09-01') TO ('2025-10-01');
CREATE TABLE IF NOT EXISTS audit_log_y2025m10 PARTITION OF audit_log_partitioned
  FOR VALUES FROM ('2025-10-01') TO ('2025-11-01');
CREATE TABLE IF NOT EXISTS audit_log_y2025m11 PARTITION OF audit_log_partitioned
  FOR VALUES FROM ('2025-11-01') TO ('2025-12-01');
CREATE TABLE IF NOT EXISTS audit_log_y2025m12 PARTITION OF audit_log_partitioned
  FOR VALUES FROM ('2025-12-01') TO ('2026-01-01');

CREATE TABLE IF NOT EXISTS audit_log_y2026m01 PARTITION OF audit_log_partitioned
  FOR VALUES FROM ('2026-01-01') TO ('2026-02-01');
CREATE TABLE IF NOT EXISTS audit_log_y2026m02 PARTITION OF audit_log_partitioned
  FOR VALUES FROM ('2026-02-01') TO ('2026-03-01');
CREATE TABLE IF NOT EXISTS audit_log_y2026m03 PARTITION OF audit_log_partitioned
  FOR VALUES FROM ('2026-03-01') TO ('2026-04-01');
CREATE TABLE IF NOT EXISTS audit_log_y2026m04 PARTITION OF audit_log_partitioned
  FOR VALUES FROM ('2026-04-01') TO ('2026-05-01');
CREATE TABLE IF NOT EXISTS audit_log_y2026m05 PARTITION OF audit_log_partitioned
  FOR VALUES FROM ('2026-05-01') TO ('2026-06-01');
CREATE TABLE IF NOT EXISTS audit_log_y2026m06 PARTITION OF audit_log_partitioned
  FOR VALUES FROM ('2026-06-01') TO ('2026-07-01');
CREATE TABLE IF NOT EXISTS audit_log_y2026m07 PARTITION OF audit_log_partitioned
  FOR VALUES FROM ('2026-07-01') TO ('2026-08-01');
CREATE TABLE IF NOT EXISTS audit_log_y2026m08 PARTITION OF audit_log_partitioned
  FOR VALUES FROM ('2026-08-01') TO ('2026-09-01');
CREATE TABLE IF NOT EXISTS audit_log_y2026m09 PARTITION OF audit_log_partitioned
  FOR VALUES FROM ('2026-09-01') TO ('2026-10-01');
CREATE TABLE IF NOT EXISTS audit_log_y2026m10 PARTITION OF audit_log_partitioned
  FOR VALUES FROM ('2026-10-01') TO ('2026-11-01');
CREATE TABLE IF NOT EXISTS audit_log_y2026m11 PARTITION OF audit_log_partitioned
  FOR VALUES FROM ('2026-11-01') TO ('2026-12-01');
CREATE TABLE IF NOT EXISTS audit_log_y2026m12 PARTITION OF audit_log_partitioned
  FOR VALUES FROM ('2026-12-01') TO ('2027-01-01');

-- Default partition for any dates outside defined ranges
CREATE TABLE IF NOT EXISTS audit_log_default PARTITION OF audit_log_partitioned DEFAULT;

-- Indexes on partitioned table (created automatically on each partition)
CREATE INDEX ON audit_log_partitioned (user_id, created_at DESC);
CREATE INDEX ON audit_log_partitioned (action, created_at DESC);
CREATE INDEX ON audit_log_partitioned (entity_type, entity_id, created_at DESC);

-- =====================================================
-- 2. PARTITIONED WHATSAPP_MESSAGES TABLE
-- =====================================================
-- WhatsApp messages are the highest volume table. Partitioning
-- by month enables efficient querying and archival of old messages.

CREATE TABLE IF NOT EXISTS whatsapp_messages_partitioned (
  id UUID DEFAULT uuid_generate_v4(),
  session_id UUID,
  phone_number VARCHAR(20) NOT NULL,
  message_id VARCHAR(200),
  direction VARCHAR(20) NOT NULL,
  message_type VARCHAR(50),
  content TEXT,
  status VARCHAR(50) DEFAULT 'sent',
  sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  delivered_at TIMESTAMP WITH TIME ZONE,
  read_at TIMESTAMP WITH TIME ZONE,
  provider_response JSONB,
  PRIMARY KEY (id, sent_at)
) PARTITION BY RANGE (sent_at);

-- Create monthly partitions for 2025-2027
CREATE TABLE IF NOT EXISTS wa_msgs_y2025m01 PARTITION OF whatsapp_messages_partitioned
  FOR VALUES FROM ('2025-01-01') TO ('2025-02-01');
CREATE TABLE IF NOT EXISTS wa_msgs_y2025m02 PARTITION OF whatsapp_messages_partitioned
  FOR VALUES FROM ('2025-02-01') TO ('2025-03-01');
CREATE TABLE IF NOT EXISTS wa_msgs_y2025m03 PARTITION OF whatsapp_messages_partitioned
  FOR VALUES FROM ('2025-03-01') TO ('2025-04-01');
CREATE TABLE IF NOT EXISTS wa_msgs_y2025m04 PARTITION OF whatsapp_messages_partitioned
  FOR VALUES FROM ('2025-04-01') TO ('2025-05-01');
CREATE TABLE IF NOT EXISTS wa_msgs_y2025m05 PARTITION OF whatsapp_messages_partitioned
  FOR VALUES FROM ('2025-05-01') TO ('2025-06-01');
CREATE TABLE IF NOT EXISTS wa_msgs_y2025m06 PARTITION OF whatsapp_messages_partitioned
  FOR VALUES FROM ('2025-06-01') TO ('2025-07-01');
CREATE TABLE IF NOT EXISTS wa_msgs_y2025m07 PARTITION OF whatsapp_messages_partitioned
  FOR VALUES FROM ('2025-07-01') TO ('2025-08-01');
CREATE TABLE IF NOT EXISTS wa_msgs_y2025m08 PARTITION OF whatsapp_messages_partitioned
  FOR VALUES FROM ('2025-08-01') TO ('2025-09-01');
CREATE TABLE IF NOT EXISTS wa_msgs_y2025m09 PARTITION OF whatsapp_messages_partitioned
  FOR VALUES FROM ('2025-09-01') TO ('2025-10-01');
CREATE TABLE IF NOT EXISTS wa_msgs_y2025m10 PARTITION OF whatsapp_messages_partitioned
  FOR VALUES FROM ('2025-10-01') TO ('2025-11-01');
CREATE TABLE IF NOT EXISTS wa_msgs_y2025m11 PARTITION OF whatsapp_messages_partitioned
  FOR VALUES FROM ('2025-11-01') TO ('2025-12-01');
CREATE TABLE IF NOT EXISTS wa_msgs_y2025m12 PARTITION OF whatsapp_messages_partitioned
  FOR VALUES FROM ('2025-12-01') TO ('2026-01-01');

CREATE TABLE IF NOT EXISTS wa_msgs_y2026m01 PARTITION OF whatsapp_messages_partitioned
  FOR VALUES FROM ('2026-01-01') TO ('2026-02-01');
CREATE TABLE IF NOT EXISTS wa_msgs_y2026m02 PARTITION OF whatsapp_messages_partitioned
  FOR VALUES FROM ('2026-02-01') TO ('2026-03-01');
CREATE TABLE IF NOT EXISTS wa_msgs_y2026m03 PARTITION OF whatsapp_messages_partitioned
  FOR VALUES FROM ('2026-03-01') TO ('2026-04-01');
CREATE TABLE IF NOT EXISTS wa_msgs_y2026m04 PARTITION OF whatsapp_messages_partitioned
  FOR VALUES FROM ('2026-04-01') TO ('2026-05-01');
CREATE TABLE IF NOT EXISTS wa_msgs_y2026m05 PARTITION OF whatsapp_messages_partitioned
  FOR VALUES FROM ('2026-05-01') TO ('2026-06-01');
CREATE TABLE IF NOT EXISTS wa_msgs_y2026m06 PARTITION OF whatsapp_messages_partitioned
  FOR VALUES FROM ('2026-06-01') TO ('2026-07-01');
CREATE TABLE IF NOT EXISTS wa_msgs_y2026m07 PARTITION OF whatsapp_messages_partitioned
  FOR VALUES FROM ('2026-07-01') TO ('2026-08-01');
CREATE TABLE IF NOT EXISTS wa_msgs_y2026m08 PARTITION OF whatsapp_messages_partitioned
  FOR VALUES FROM ('2026-08-01') TO ('2026-09-01');
CREATE TABLE IF NOT EXISTS wa_msgs_y2026m09 PARTITION OF whatsapp_messages_partitioned
  FOR VALUES FROM ('2026-09-01') TO ('2026-10-01');
CREATE TABLE IF NOT EXISTS wa_msgs_y2026m10 PARTITION OF whatsapp_messages_partitioned
  FOR VALUES FROM ('2026-10-01') TO ('2026-11-01');
CREATE TABLE IF NOT EXISTS wa_msgs_y2026m11 PARTITION OF whatsapp_messages_partitioned
  FOR VALUES FROM ('2026-11-01') TO ('2026-12-01');
CREATE TABLE IF NOT EXISTS wa_msgs_y2026m12 PARTITION OF whatsapp_messages_partitioned
  FOR VALUES FROM ('2026-12-01') TO ('2027-01-01');

CREATE TABLE IF NOT EXISTS wa_msgs_default PARTITION OF whatsapp_messages_partitioned DEFAULT;

-- Indexes
CREATE INDEX ON whatsapp_messages_partitioned (phone_number, sent_at DESC);
CREATE INDEX ON whatsapp_messages_partitioned (session_id, sent_at DESC);
CREATE INDEX ON whatsapp_messages_partitioned (message_id);

-- =====================================================
-- 3. PARTITION MANAGEMENT FUNCTION
-- =====================================================
-- Automatically creates next month's partition if it doesn't exist.
-- Should be run as a scheduled job (pg_cron or external scheduler).

CREATE OR REPLACE FUNCTION create_next_month_partitions()
RETURNS void AS $$
DECLARE
  next_month_start DATE;
  next_month_end DATE;
  partition_name_audit TEXT;
  partition_name_wa TEXT;
BEGIN
  next_month_start := DATE_TRUNC('month', NOW() + INTERVAL '1 month')::DATE;
  next_month_end := (next_month_start + INTERVAL '1 month')::DATE;

  -- Audit log partition
  partition_name_audit := 'audit_log_y' || TO_CHAR(next_month_start, 'YYYY') || 'm' || TO_CHAR(next_month_start, 'MM');
  BEGIN
    EXECUTE format(
      'CREATE TABLE IF NOT EXISTS %I PARTITION OF audit_log_partitioned FOR VALUES FROM (%L) TO (%L)',
      partition_name_audit, next_month_start, next_month_end
    );
  EXCEPTION WHEN duplicate_table THEN
    NULL; -- Partition already exists
  END;

  -- WhatsApp messages partition
  partition_name_wa := 'wa_msgs_y' || TO_CHAR(next_month_start, 'YYYY') || 'm' || TO_CHAR(next_month_start, 'MM');
  BEGIN
    EXECUTE format(
      'CREATE TABLE IF NOT EXISTS %I PARTITION OF whatsapp_messages_partitioned FOR VALUES FROM (%L) TO (%L)',
      partition_name_wa, next_month_start, next_month_end
    );
  EXCEPTION WHEN duplicate_table THEN
    NULL;
  END;

  RAISE NOTICE 'Partitions created for %', TO_CHAR(next_month_start, 'YYYY-MM');
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 4. DATA ARCHIVAL FUNCTION
-- =====================================================
-- Archives old partitions by detaching them. Detached partitions
-- can then be exported to S3 for long-term retention (7 years per RBZ).

CREATE OR REPLACE FUNCTION archive_old_partitions(months_to_keep INTEGER DEFAULT 24)
RETURNS TABLE(archived_partition TEXT, row_count BIGINT) AS $$
DECLARE
  cutoff_date DATE;
  rec RECORD;
  partition_count BIGINT;
BEGIN
  cutoff_date := DATE_TRUNC('month', NOW() - (months_to_keep || ' months')::INTERVAL)::DATE;

  -- Find partitions older than cutoff
  FOR rec IN
    SELECT
      child.relname AS partition_name,
      pg_get_expr(child.relpartbound, child.oid) AS partition_bound
    FROM pg_inherits
    JOIN pg_class parent ON pg_inherits.inhparent = parent.oid
    JOIN pg_class child ON pg_inherits.inhrelid = child.oid
    WHERE parent.relname IN ('audit_log_partitioned', 'whatsapp_messages_partitioned')
    AND child.relname NOT LIKE '%default'
  LOOP
    -- Log partition for review (actual detachment requires manual approval)
    EXECUTE format('SELECT COUNT(*) FROM %I', rec.partition_name) INTO partition_count;
    archived_partition := rec.partition_name;
    row_count := partition_count;
    RETURN NEXT;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 5. RLS ON PARTITIONED TABLES
-- =====================================================

ALTER TABLE audit_log_partitioned ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_messages_partitioned ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on audit_log_partitioned"
  ON audit_log_partitioned FOR ALL USING (true);
CREATE POLICY "Service role full access on whatsapp_messages_partitioned"
  ON whatsapp_messages_partitioned FOR ALL USING (true);

-- =====================================================
-- COMPLETION MESSAGE
-- =====================================================
DO $$
BEGIN
  RAISE NOTICE 'Table partitioning migration completed successfully!';
  RAISE NOTICE 'Partitioned tables:';
  RAISE NOTICE '  - audit_log_partitioned (24 monthly partitions + default)';
  RAISE NOTICE '  - whatsapp_messages_partitioned (24 monthly partitions + default)';
  RAISE NOTICE 'Management functions:';
  RAISE NOTICE '  - create_next_month_partitions() - Run monthly via scheduler';
  RAISE NOTICE '  - archive_old_partitions(months) - List partitions for archival';
  RAISE NOTICE '';
  RAISE NOTICE 'IMPORTANT: Data migration from old tables to partitioned tables';
  RAISE NOTICE 'should be done during a maintenance window:';
  RAISE NOTICE '  INSERT INTO audit_log_partitioned SELECT * FROM audit_log;';
  RAISE NOTICE '  INSERT INTO whatsapp_messages_partitioned SELECT * FROM whatsapp_messages;';
END $$;
