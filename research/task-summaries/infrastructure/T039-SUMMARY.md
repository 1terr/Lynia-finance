# T039: Event Architecture (PostgreSQL Triggers + pg_notify + Event Log)

**Task:** Document event architecture: PostgreSQL triggers + pg_notify() + event_log table
**Phase:** Phase 0: Research
**Status:** ✅ Completed
**Date:** November 14, 2025

---

## Executive Summary

A robust **event-driven architecture** using PostgreSQL triggers, `pg_notify()` for real-time pub/sub, and a centralized `event_log` table provides complete **audit trails, debugging capabilities**, and **event replay** for Lynia Finance—critical for financial compliance and troubleshooting.

**Key Components:**
- **PostgreSQL Triggers**: Automatically capture database events (INSERT/UPDATE/DELETE)
- **pg_notify()**: Real-time publish/subscribe for event broadcasting
- **event_log Table**: Centralized event storage for audit trails and debugging
- **Event Sourcing**: Complete history of all state changes
- **Event Replay**: Reconstruct system state from event log

**Perfect for Lynia Finance**:
- Audit trail (who changed what, when, why)
- Regulatory compliance (RBZ lending requirements)
- Debugging (trace payment flow, KYC status changes)
- Event replay (reconstruct loan state, recalculate credit scores)
- Real-time notifications (staff dashboard, admin alerts)

---

## Table of Contents

1. [Event Architecture Overview](#1-event-architecture-overview)
2. [Event Log Table Schema](#2-event-log-table-schema)
3. [PostgreSQL Triggers for Event Capture](#3-postgresql-triggers-for-event-capture)
4. [pg_notify() for Real-Time Broadcasting](#4-pg_notify-for-real-time-broadcasting)
5. [Event Types for Lynia Finance](#5-event-types-for-lynia-finance)
6. [Event Replay & State Reconstruction](#6-event-replay--state-reconstruction)
7. [Audit Trail & Compliance](#7-audit-trail--compliance)
8. [Performance & Scalability](#8-performance--scalability)
9. [Implementation Examples](#9-implementation-examples)
10. [Summary](#10-summary)

---

## 1. Event Architecture Overview

### 1.1 Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                    EVENT-DRIVEN ARCHITECTURE                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. Database Event (INSERT/UPDATE/DELETE)                        │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  INSERT INTO payments (loan_id, amount, status)            │ │
│  │  VALUES ('abc-123', 50, 'confirmed');                      │ │
│  └─────────────────────────┬──────────────────────────────────┘ │
│                            │                                     │
│                            ▼                                     │
│  2. Trigger Fires (AFTER INSERT)                                │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  CREATE TRIGGER log_payment_event                          │ │
│  │  AFTER INSERT ON payments                                  │ │
│  │  FOR EACH ROW                                              │ │
│  │  EXECUTE FUNCTION capture_payment_event();                 │ │
│  └─────────────────────────┬──────────────────────────────────┘ │
│                            │                                     │
│                            ▼                                     │
│  3. Capture Event (event_log table)                             │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  INSERT INTO event_log (                                   │ │
│  │    event_type, aggregate_id, aggregate_type,               │ │
│  │    payload, user_id, metadata                              │ │
│  │  ) VALUES (                                                 │ │
│  │    'payment.confirmed', 'abc-123', 'payment',              │ │
│  │    '{"amount": 50, "method": "ecocash"}',                  │ │
│  │    'user-456', '{"ip": "41.79.xx.xx"}'                     │ │
│  │  );                                                         │ │
│  └─────────────────────────┬──────────────────────────────────┘ │
│                            │                                     │
│                            ▼                                     │
│  4. Broadcast Event (pg_notify)                                 │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  PERFORM pg_notify(                                        │ │
│  │    'payment_events',                                       │ │
│  │    json_build_object(                                      │ │
│  │      'event_type', 'payment.confirmed',                    │ │
│  │      'payment_id', 'abc-123',                              │ │
│  │      'amount', 50                                          │ │
│  │    )::text                                                 │ │
│  │  );                                                         │ │
│  └─────────────────────────┬──────────────────────────────────┘ │
│                            │                                     │
│                            ▼                                     │
│  5. Real-Time Subscribers (Edge Functions, Clients)             │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  Edge Function: payment-confirmed                          │ │
│  │  ┌──────────────────────────────────────────────────────┐  │ │
│  │  │ 1. Send SMS confirmation                             │  │ │
│  │  │ 2. Update loan status                                │  │ │
│  │  │ 3. Recalculate credit score                          │  │ │
│  │  └──────────────────────────────────────────────────────┘  │ │
│  │                                                             │ │
│  │  Staff Dashboard (Realtime Subscription)                   │ │
│  │  ┌──────────────────────────────────────────────────────┐  │ │
│  │  │ Show toast: "Payment received: $50 from Customer X"  │  │ │
│  │  └──────────────────────────────────────────────────────┘  │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                  │
│  6. Event Log (Audit Trail, Debugging, Replay)                  │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  Query: "Show all events for loan abc-123"                │ │
│  │  ┌──────────────────────────────────────────────────────┐  │ │
│  │  │ 2025-11-01 09:00: loan.created                       │  │ │
│  │  │ 2025-11-01 09:15: kyc.verified                       │  │ │
│  │  │ 2025-11-01 10:30: loan.disbursed                     │  │ │
│  │  │ 2025-11-14 15:42: payment.confirmed ($50)            │  │ │
│  │  └──────────────────────────────────────────────────────┘  │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 1.2 Why Event-Driven Architecture?

| Benefit | Description | Lynia Finance Use Case |
|---------|-------------|------------------------|
| **Audit Trail** | Complete history of all changes | Regulatory compliance (RBZ) |
| **Debugging** | Trace event flow (payment → loan → SMS) | Troubleshoot failed payments |
| **Event Replay** | Reconstruct state from events | Recalculate credit scores, fix data issues |
| **Real-Time Notifications** | Broadcast events to subscribers | Staff dashboard alerts, customer SMS |
| **Decoupling** | Services react to events independently | Add new features without modifying existing code |
| **Scalability** | Asynchronous processing | Handle high volumes (1,000s of payments/day) |

---

## 2. Event Log Table Schema

### 2.1 Create event_log Table

```sql
-- Centralized event log for all domain events
CREATE TABLE event_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type VARCHAR(100) NOT NULL,         -- 'payment.confirmed', 'loan.created', etc.
  aggregate_id VARCHAR(100) NOT NULL,       -- ID of the entity (loan ID, payment ID, etc.)
  aggregate_type VARCHAR(50) NOT NULL,      -- 'loan', 'payment', 'customer', etc.
  payload JSONB NOT NULL,                   -- Complete event data
  user_id UUID,                             -- Who triggered the event (customer/staff)
  metadata JSONB,                           -- Additional context (IP, user agent, etc.)
  created_at TIMESTAMPTZ DEFAULT now()      -- When the event occurred
);

-- Indexes for fast queries
CREATE INDEX idx_event_log_aggregate ON event_log(aggregate_id, aggregate_type, created_at DESC);
CREATE INDEX idx_event_log_type ON event_log(event_type, created_at DESC);
CREATE INDEX idx_event_log_user ON event_log(user_id, created_at DESC);
CREATE INDEX idx_event_log_created_at ON event_log(created_at DESC);
```

### 2.2 Example Events

| Event Type | Aggregate ID | Aggregate Type | Payload | User ID |
|------------|-------------|----------------|---------|---------|
| `loan.created` | `loan-123` | `loan` | `{"customer_id": "cust-456", "amount": 200}` | `staff-789` |
| `payment.confirmed` | `pay-abc` | `payment` | `{"loan_id": "loan-123", "amount": 50}` | `cust-456` |
| `kyc.verified` | `kyc-def` | `kyc` | `{"customer_id": "cust-456", "status": "verified"}` | `system` |
| `device.locked` | `dev-xyz` | `device` | `{"reason": "overdue_payment"}` | `system` |

---

## 3. PostgreSQL Triggers for Event Capture

### 3.1 Generic Event Capture Function

```sql
-- Generic function to capture events to event_log
CREATE OR REPLACE FUNCTION capture_event(
  p_event_type VARCHAR,
  p_aggregate_id VARCHAR,
  p_aggregate_type VARCHAR,
  p_payload JSONB,
  p_user_id UUID DEFAULT NULL,
  p_metadata JSONB DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
  event_id UUID;
BEGIN
  INSERT INTO event_log (
    event_type,
    aggregate_id,
    aggregate_type,
    payload,
    user_id,
    metadata
  ) VALUES (
    p_event_type,
    p_aggregate_id,
    p_aggregate_type,
    p_payload,
    COALESCE(p_user_id, auth.uid()),
    p_metadata
  ) RETURNING id INTO event_id;

  RETURN event_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### 3.2 Payment Event Capture

```sql
-- Capture payment events (INSERT, UPDATE)
CREATE OR REPLACE FUNCTION capture_payment_event()
RETURNS TRIGGER AS $$
DECLARE
  event_type VARCHAR;
  event_id UUID;
BEGIN
  -- Determine event type
  IF TG_OP = 'INSERT' THEN
    event_type := 'payment.' || NEW.status;  -- 'payment.confirmed', 'payment.pending'
  ELSIF TG_OP = 'UPDATE' AND NEW.status != OLD.status THEN
    event_type := 'payment.status_changed';
  ELSE
    RETURN NEW;  -- No event for other updates
  END IF;

  -- Capture event
  SELECT capture_event(
    event_type,
    NEW.id::VARCHAR,
    'payment',
    row_to_json(NEW)::JSONB,
    NULL,
    jsonb_build_object(
      'operation', TG_OP,
      'table', TG_TABLE_NAME,
      'old_status', CASE WHEN TG_OP = 'UPDATE' THEN OLD.status ELSE NULL END
    )
  ) INTO event_id;

  -- Broadcast event
  PERFORM pg_notify(
    'payment_events',
    json_build_object(
      'event_id', event_id,
      'event_type', event_type,
      'payment_id', NEW.id,
      'loan_id', NEW.loan_id,
      'amount', NEW.amount,
      'status', NEW.status
    )::text
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Attach trigger
CREATE TRIGGER log_payment_event
AFTER INSERT OR UPDATE ON payments
FOR EACH ROW
EXECUTE FUNCTION capture_payment_event();
```

### 3.3 Loan Event Capture

```sql
-- Capture loan events
CREATE OR REPLACE FUNCTION capture_loan_event()
RETURNS TRIGGER AS $$
DECLARE
  event_type VARCHAR;
  event_id UUID;
BEGIN
  IF TG_OP = 'INSERT' THEN
    event_type := 'loan.created';
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.status != OLD.status THEN
      event_type := 'loan.status_changed.' || NEW.status;
    ELSE
      RETURN NEW;
    END IF;
  ELSIF TG_OP = 'DELETE' THEN
    event_type := 'loan.deleted';
  END IF;

  SELECT capture_event(
    event_type,
    COALESCE(NEW.id, OLD.id)::VARCHAR,
    'loan',
    COALESCE(row_to_json(NEW), row_to_json(OLD))::JSONB,
    NULL,
    jsonb_build_object('operation', TG_OP)
  ) INTO event_id;

  PERFORM pg_notify(
    'loan_events',
    json_build_object(
      'event_id', event_id,
      'event_type', event_type,
      'loan_id', COALESCE(NEW.id, OLD.id)
    )::text
  );

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER log_loan_event
AFTER INSERT OR UPDATE OR DELETE ON loans
FOR EACH ROW
EXECUTE FUNCTION capture_loan_event();
```

---

## 4. pg_notify() for Real-Time Broadcasting

### 4.1 Listen for Events (PostgreSQL Client)

```sql
-- Listen for payment events
LISTEN payment_events;

-- Will receive notifications like:
-- {
--   "event_id": "550e8400-e29b-41d4-a716-446655440000",
--   "event_type": "payment.confirmed",
--   "payment_id": "pay-abc",
--   "amount": 50
-- }
```

### 4.2 Subscribe in Edge Function

```typescript
// supabase/functions/event-subscriber/index.ts
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { Client } from 'https://deno.land/x/postgres@v0.17.0/mod.ts';

const client = new Client({
  hostname: Deno.env.get('DB_HOSTNAME'),
  port: 5432,
  user: 'postgres',
  password: Deno.env.get('DB_PASSWORD'),
  database: 'postgres',
});

await client.connect();

// Listen for payment events
await client.queryObject`LISTEN payment_events`;

// Handle notifications
client.on('notification', async (msg) => {
  const event = JSON.parse(msg.payload);

  console.log('Received event:', event);

  if (event.event_type === 'payment.confirmed') {
    // Send SMS confirmation
    // Update loan status
    // Recalculate credit score
  }
});

serve(() => new Response('Event subscriber running', { status: 200 }));
```

### 4.3 Subscribe in Supabase Realtime

```typescript
// Client-side (React/Next.js)
import { useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(url, key);

useEffect(() => {
  // Subscribe to event_log table changes
  const channel = supabase
    .channel('event-log-changes')
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'event_log',
        filter: 'event_type=eq.payment.confirmed'
      },
      (payload) => {
        console.log('New payment event:', payload.new);
        // Show toast notification
        showToast(`Payment received: $${payload.new.payload.amount}`);
      }
    )
    .subscribe();

  return () => {
    channel.unsubscribe();
  };
}, []);
```

---

## 5. Event Types for Lynia Finance

### 5.1 Payment Events

| Event Type | Description | Payload |
|------------|-------------|---------|
| `payment.pending` | Payment initiated | `{loan_id, amount, method, phone}` |
| `payment.confirmed` | Payment confirmed by gateway | `{loan_id, amount, method, reference}` |
| `payment.failed` | Payment failed | `{loan_id, amount, error}` |
| `payment.refunded` | Payment refunded | `{loan_id, amount, reason}` |

### 5.2 Loan Events

| Event Type | Description | Payload |
|------------|-------------|---------|
| `loan.created` | New loan application | `{customer_id, amount, term_months}` |
| `loan.approved` | Loan approved by staff | `{approved_by, approved_amount}` |
| `loan.disbursed` | Funds disbursed to customer | `{disbursed_at, disbursed_amount}` |
| `loan.status_changed.active` | Loan activated (first payment) | `{previous_status, new_status}` |
| `loan.status_changed.overdue` | Loan overdue | `{days_overdue, amount_due}` |
| `loan.status_changed.defaulted` | Loan defaulted | `{days_overdue, total_due}` |
| `loan.completed` | Loan fully repaid | `{total_paid, final_payment_date}` |

### 5.3 Customer Events

| Event Type | Description | Payload |
|------------|-------------|---------|
| `customer.registered` | New customer registration | `{phone, email, first_name, last_name}` |
| `kyc.submitted` | KYC documents submitted | `{kyc_id, documents: ['id_card', 'selfie']}` |
| `kyc.verified` | KYC verification passed | `{verification_method, verified_at}` |
| `kyc.failed` | KYC verification failed | `{failure_reason, retry_allowed}` |
| `score.updated` | Credit score updated | `{old_score, new_score, reason}` |
| `tier.changed` | Loan tier changed | `{old_tier, new_tier}` |

### 5.4 Device Events

| Event Type | Description | Payload |
|------------|-------------|---------|
| `device.locked` | Device locked due to overdue payment | `{device_id, reason, loan_id}` |
| `device.unlocked` | Device unlocked after payment | `{device_id, payment_id}` |
| `device.collected` | Device collected by customer | `{device_id, collected_at}` |
| `device.returned` | Device returned after loan completion | `{device_id, returned_at, condition}` |

---

## 6. Event Replay & State Reconstruction

### 6.1 Reconstruct Loan State

```sql
-- Reconstruct full loan history from events
SELECT
  event_type,
  payload,
  created_at
FROM event_log
WHERE aggregate_id = 'loan-123'
AND aggregate_type = 'loan'
ORDER BY created_at ASC;

-- Output:
-- event_type                | payload                                  | created_at
-- -------------------------+------------------------------------------+------------------------
-- loan.created             | {"amount": 200, "customer_id": "c-456"}  | 2025-11-01 09:00:00
-- loan.approved            | {"approved_by": "staff-789"}             | 2025-11-01 09:15:00
-- loan.disbursed           | {"disbursed_amount": 200}                | 2025-11-01 10:30:00
-- payment.confirmed        | {"amount": 50}                           | 2025-11-14 15:42:00
-- loan.status_changed.active | {"new_status": "active"}                | 2025-11-14 15:43:00
```

### 6.2 Recalculate Credit Score from Events

```sql
-- Function to recalculate credit score from payment events
CREATE OR REPLACE FUNCTION recalculate_credit_score_from_events(p_customer_id UUID)
RETURNS INTEGER AS $$
DECLARE
  base_score INTEGER := 65;
  score_adjustment INTEGER := 0;
  event RECORD;
BEGIN
  -- Loop through all payment events for customer's loans
  FOR event IN
    SELECT
      e.event_type,
      e.payload,
      e.created_at
    FROM event_log e
    JOIN loans l ON l.id = (e.payload->>'loan_id')::UUID
    WHERE l.customer_id = p_customer_id
    AND e.aggregate_type = 'payment'
    ORDER BY e.created_at ASC
  LOOP
    -- Apply score adjustments based on event type
    IF event.event_type = 'payment.confirmed' THEN
      score_adjustment := score_adjustment + 2;  -- On-time payment
    ELSIF event.event_type = 'payment.late' THEN
      score_adjustment := score_adjustment - 3;  -- Late payment
    ELSIF event.event_type = 'payment.missed' THEN
      score_adjustment := score_adjustment - 15;  -- Missed payment
    END IF;
  END LOOP;

  RETURN LEAST(100, GREATEST(60, base_score + score_adjustment));
END;
$$ LANGUAGE plpgsql;

-- Recalculate score for customer
SELECT recalculate_credit_score_from_events('customer-456');
-- Output: 73
```

### 6.3 Event Replay for Data Fixes

```sql
-- Replay events to fix incorrect loan status
DO $$
DECLARE
  event RECORD;
  current_status VARCHAR := 'pending';
BEGIN
  -- Replay all loan events in order
  FOR event IN
    SELECT * FROM event_log
    WHERE aggregate_id = 'loan-123'
    AND aggregate_type = 'loan'
    ORDER BY created_at ASC
  LOOP
    -- Apply state transitions
    IF event.event_type = 'loan.disbursed' THEN
      current_status := 'disbursed';
    ELSIF event.event_type = 'payment.confirmed' THEN
      current_status := 'active';
    ELSIF event.event_type = 'loan.completed' THEN
      current_status := 'completed';
    END IF;
  END LOOP;

  -- Update loan with correct status
  UPDATE loans
  SET status = current_status
  WHERE id = 'loan-123';

  RAISE NOTICE 'Loan status corrected to: %', current_status;
END $$;
```

---

## 7. Audit Trail & Compliance

### 7.1 Query Audit Trail

```sql
-- Who changed loan status to 'approved'?
SELECT
  event_type,
  payload,
  user_id,
  created_at
FROM event_log
WHERE aggregate_id = 'loan-123'
AND event_type = 'loan.approved';

-- Output:
-- event_type    | payload                          | user_id     | created_at
-- --------------+----------------------------------+-------------+------------------------
-- loan.approved | {"approved_by": "staff-789"}     | staff-789   | 2025-11-01 09:15:00
```

### 7.2 Track Payment Flow

```sql
-- Trace complete payment flow (payment → loan update → SMS)
SELECT
  event_type,
  aggregate_type,
  payload,
  created_at
FROM event_log
WHERE payload->>'loan_id' = 'loan-123'
AND created_at > '2025-11-14 15:00:00'
ORDER BY created_at ASC;

-- Output:
-- event_type         | aggregate_type | payload                          | created_at
-- -------------------+----------------+----------------------------------+------------------------
-- payment.confirmed  | payment        | {"amount": 50, "method": "ecocash"} | 2025-11-14 15:42:00
-- loan.status_changed| loan           | {"new_status": "active"}         | 2025-11-14 15:43:00
-- sms.sent           | notification   | {"message": "Payment received"}  | 2025-11-14 15:43:02
```

### 7.3 Compliance Reporting

```sql
-- Generate monthly report for RBZ: All loan disbursements
SELECT
  e.payload->>'loan_id' AS loan_id,
  e.payload->>'disbursed_amount' AS amount,
  e.created_at AS disbursed_at,
  c.first_name || ' ' || c.last_name AS customer_name
FROM event_log e
JOIN loans l ON l.id = (e.payload->>'loan_id')::UUID
JOIN customers c ON c.id = l.customer_id
WHERE e.event_type = 'loan.disbursed'
AND e.created_at >= '2025-11-01'
AND e.created_at < '2025-12-01'
ORDER BY e.created_at;
```

---

## 8. Performance & Scalability

### 8.1 Event Log Growth Estimate

| Scenario | Events/Day | Events/Month | Storage (1 year) |
|----------|------------|--------------|------------------|
| **500 loans/month** | ~200 | 6,000 | 72,000 events (~50MB) |
| **5,000 loans/month** | ~2,000 | 60,000 | 720,000 events (~500MB) |
| **50,000 loans/month** | ~20,000 | 600,000 | 7.2M events (~5GB) |

**Recommendation**: Archive events older than 2 years to separate table.

### 8.2 Archiving Old Events

```sql
-- Create archive table
CREATE TABLE event_log_archive (
  LIKE event_log INCLUDING ALL
);

-- Move events older than 2 years to archive
WITH moved AS (
  DELETE FROM event_log
  WHERE created_at < now() - interval '2 years'
  RETURNING *
)
INSERT INTO event_log_archive
SELECT * FROM moved;
```

### 8.3 Partitioning for Large Scale

```sql
-- Partition event_log by month for better performance
CREATE TABLE event_log (
  id UUID DEFAULT gen_random_uuid(),
  event_type VARCHAR(100) NOT NULL,
  aggregate_id VARCHAR(100) NOT NULL,
  aggregate_type VARCHAR(50) NOT NULL,
  payload JSONB NOT NULL,
  user_id UUID,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (created_at);

-- Create monthly partitions
CREATE TABLE event_log_2025_11 PARTITION OF event_log
FOR VALUES FROM ('2025-11-01') TO ('2025-12-01');

CREATE TABLE event_log_2025_12 PARTITION OF event_log
FOR VALUES FROM ('2025-12-01') TO ('2026-01-01');
```

---

## 9. Implementation Examples

### 9.1 Complete Event Architecture Setup

```sql
-- setup-event-architecture.sql

-- 1. Create event_log table
CREATE TABLE event_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type VARCHAR(100) NOT NULL,
  aggregate_id VARCHAR(100) NOT NULL,
  aggregate_type VARCHAR(50) NOT NULL,
  payload JSONB NOT NULL,
  user_id UUID,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_event_log_aggregate ON event_log(aggregate_id, aggregate_type, created_at DESC);
CREATE INDEX idx_event_log_type ON event_log(event_type, created_at DESC);
CREATE INDEX idx_event_log_created_at ON event_log(created_at DESC);

-- 2. Generic event capture function
CREATE OR REPLACE FUNCTION capture_event(
  p_event_type VARCHAR,
  p_aggregate_id VARCHAR,
  p_aggregate_type VARCHAR,
  p_payload JSONB,
  p_user_id UUID DEFAULT NULL,
  p_metadata JSONB DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
  event_id UUID;
BEGIN
  INSERT INTO event_log (
    event_type, aggregate_id, aggregate_type, payload, user_id, metadata
  ) VALUES (
    p_event_type, p_aggregate_id, p_aggregate_type, p_payload,
    COALESCE(p_user_id, auth.uid()), p_metadata
  ) RETURNING id INTO event_id;

  RETURN event_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Payment event capture
CREATE OR REPLACE FUNCTION capture_payment_event()
RETURNS TRIGGER AS $$
DECLARE
  event_type VARCHAR;
  event_id UUID;
BEGIN
  IF TG_OP = 'INSERT' THEN
    event_type := 'payment.' || NEW.status;
  ELSIF TG_OP = 'UPDATE' AND NEW.status != OLD.status THEN
    event_type := 'payment.status_changed';
  ELSE
    RETURN NEW;
  END IF;

  SELECT capture_event(
    event_type, NEW.id::VARCHAR, 'payment', row_to_json(NEW)::JSONB, NULL,
    jsonb_build_object('operation', TG_OP, 'old_status', CASE WHEN TG_OP = 'UPDATE' THEN OLD.status ELSE NULL END)
  ) INTO event_id;

  PERFORM pg_notify('payment_events', json_build_object('event_id', event_id, 'event_type', event_type, 'payment_id', NEW.id)::text);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER log_payment_event
AFTER INSERT OR UPDATE ON payments
FOR EACH ROW
EXECUTE FUNCTION capture_payment_event();

-- 4. Loan event capture
CREATE OR REPLACE FUNCTION capture_loan_event()
RETURNS TRIGGER AS $$
DECLARE
  event_type VARCHAR;
  event_id UUID;
BEGIN
  IF TG_OP = 'INSERT' THEN
    event_type := 'loan.created';
  ELSIF TG_OP = 'UPDATE' AND NEW.status != OLD.status THEN
    event_type := 'loan.status_changed.' || NEW.status;
  ELSE
    RETURN NEW;
  END IF;

  SELECT capture_event(
    event_type, NEW.id::VARCHAR, 'loan', row_to_json(NEW)::JSONB
  ) INTO event_id;

  PERFORM pg_notify('loan_events', json_build_object('event_id', event_id, 'event_type', event_type, 'loan_id', NEW.id)::text);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER log_loan_event
AFTER INSERT OR UPDATE ON loans
FOR EACH ROW
EXECUTE FUNCTION capture_loan_event();
```

---

## 10. Summary

### 10.1 Key Takeaways

✅ **Complete Audit Trail**: Every database change captured in event_log
✅ **Real-Time Broadcasting**: pg_notify() for instant event notifications
✅ **Event Replay**: Reconstruct state from events, fix data issues
✅ **Regulatory Compliance**: RBZ reporting, audit requirements
✅ **Debugging**: Trace payment flow, identify issues
✅ **Scalability**: Partition event_log by month for large-scale

### 10.2 Recommended Event Types for Lynia Finance

- **Payment**: `payment.confirmed`, `payment.failed`, `payment.refunded`
- **Loan**: `loan.created`, `loan.approved`, `loan.disbursed`, `loan.status_changed.*`
- **Customer**: `customer.registered`, `kyc.verified`, `score.updated`, `tier.changed`
- **Device**: `device.locked`, `device.unlocked`, `device.collected`, `device.returned`

### 10.3 Next Steps

- [ ] Create event_log table with indexes
- [ ] Deploy event capture triggers (payments, loans, customers, devices)
- [ ] Set up pg_notify() for real-time broadcasting
- [ ] Implement event replay for credit score recalculation
- [ ] Create compliance reporting queries (RBZ)
- [ ] Monitor event_log growth, implement archiving strategy

---

**Status**: ✅ T039 Complete
**Next Task**: T040 - Create Supabase project and test Realtime subscription with inventory table
**Related**: T037 (Database triggers), T038 (Storage), T040+ (Supabase testing)
