# T037: Edge Functions Database Trigger Integration

**Task:** Research Edge Functions database trigger integration (auto-execute on INSERT/UPDATE)
**Phase:** Phase 0: Research
**Status:** ✅ Completed
**Date:** November 14, 2025

---

## Executive Summary

Supabase allows **PostgreSQL triggers** to automatically invoke Edge Functions on database events (INSERT, UPDATE, DELETE). This enables **event-driven architecture** where business logic executes automatically in response to data changes—perfect for **payment confirmations, KYC status updates, device lock triggers**, and other real-time workflows.

**Key Capabilities:**
- **Automatic execution**: No manual API calls required
- **Database triggers**: AFTER INSERT, AFTER UPDATE, BEFORE DELETE
- **HTTP invocation**: Triggers call Edge Functions via `net.http_post()`
- **Asynchronous by default**: Non-blocking (doesn't slow down database writes)
- **Payload includes**: NEW/OLD row data, table name, operation type
- **Free tier**: Trigger invocations count toward 500K Edge Function calls/month

**Perfect for Lynia Finance**:
- Payment confirmation SMS (AFTER INSERT on `payments`)
- KYC status notifications (AFTER UPDATE on `kyc_verifications`)
- Device lock on missed payment (AFTER UPDATE on `loans` where status = 'overdue')
- Credit score recalculation (AFTER INSERT/UPDATE on `payments`)
- Inventory alerts (AFTER UPDATE on `devices` where stock < 5)

---

## Table of Contents

1. [Database Triggers Overview](#1-database-triggers-overview)
2. [HTTP Extension (net.http_post)](#2-http-extension-nethttppost)
3. [Setting Up Database Triggers](#3-setting-up-database-triggers)
4. [Use Cases for Lynia Finance](#4-use-cases-for-lynia-finance)
5. [Trigger vs Realtime vs Cron](#5-trigger-vs-realtime-vs-cron)
6. [Performance & Scalability](#6-performance--scalability)
7. [Error Handling](#7-error-handling)
8. [Implementation Examples](#8-implementation-examples)
9. [Summary](#9-summary)

---

## 1. Database Triggers Overview

### 1.1 What Are Database Triggers?

A **PostgreSQL trigger** is a function that automatically executes when a specific database event occurs (INSERT, UPDATE, DELETE).

```
┌─────────────────────────────────────────────────────────────────┐
│                    DATABASE TRIGGER FLOW                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. Database Event                                               │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  INSERT INTO payments (loan_id, amount, status)            │ │
│  │  VALUES ('abc-123', 50, 'confirmed');                      │ │
│  └─────────────────────────┬──────────────────────────────────┘ │
│                            │                                     │
│                            ▼                                     │
│  2. Trigger Fires (AFTER INSERT)                                │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  CREATE TRIGGER on_payment_confirmed                       │ │
│  │  AFTER INSERT ON payments                                  │ │
│  │  FOR EACH ROW                                              │ │
│  │  EXECUTE FUNCTION notify_payment_confirmed();              │ │
│  └─────────────────────────┬──────────────────────────────────┘ │
│                            │                                     │
│                            ▼                                     │
│  3. Trigger Function (PL/pgSQL)                                 │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  CREATE FUNCTION notify_payment_confirmed()                │ │
│  │  RETURNS TRIGGER AS $$                                     │ │
│  │  BEGIN                                                      │ │
│  │    PERFORM net.http_post(                                  │ │
│  │      url := 'https://xxx.supabase.co/functions/v1/...',   │ │
│  │      body := jsonb_build_object('payment', NEW)            │ │
│  │    );                                                       │ │
│  │    RETURN NEW;                                             │ │
│  │  END;                                                       │ │
│  │  $$ LANGUAGE plpgsql;                                      │ │
│  └─────────────────────────┬──────────────────────────────────┘ │
│                            │                                     │
│                            ▼                                     │
│  4. Edge Function Invoked                                       │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  supabase/functions/payment-confirmed/index.ts             │ │
│  │  ┌──────────────────────────────────────────────────────┐  │ │
│  │  │ 1. Parse payment data                                │  │ │
│  │  │ 2. Send SMS confirmation via Africa's Talking        │  │ │
│  │  │ 3. Update loan status to 'active'                    │  │ │
│  │  │ 4. Recalculate customer credit score                 │  │ │
│  │  └──────────────────────────────────────────────────────┘  │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 1.2 Trigger Timing

| Timing | Description | Use Case |
|--------|-------------|----------|
| **BEFORE INSERT** | Fires before row is inserted | Validate data, set defaults |
| **AFTER INSERT** | Fires after row is inserted | Send notifications, trigger workflows |
| **BEFORE UPDATE** | Fires before row is updated | Validate changes, prevent invalid updates |
| **AFTER UPDATE** | Fires after row is updated | Notify stakeholders, recalculate scores |
| **BEFORE DELETE** | Fires before row is deleted | Prevent deletion, log audit trail |
| **AFTER DELETE** | Fires after row is deleted | Clean up related data, send alerts |

**Recommendation for Lynia Finance**: Use **AFTER INSERT/UPDATE** for Edge Function invocations (non-blocking, asynchronous).

---

## 2. HTTP Extension (net.http_post)

### 2.1 Enable HTTP Extension

```sql
-- Enable pg_net extension (HTTP client for PostgreSQL)
CREATE EXTENSION IF NOT EXISTS pg_net;
```

### 2.2 Basic HTTP Request

```sql
-- Make HTTP POST request from PostgreSQL
SELECT net.http_post(
  url := 'https://your-project-ref.supabase.co/functions/v1/payment-confirmed',
  headers := jsonb_build_object(
    'Content-Type', 'application/json',
    'Authorization', 'Bearer ' || current_setting('app.service_role_key')
  ),
  body := jsonb_build_object(
    'payment_id', 'abc-123',
    'amount', 50,
    'customer_phone', '+263771234567'
  )
) AS request_id;
```

### 2.3 Asynchronous by Default

```sql
-- ✅ GOOD: Asynchronous (doesn't block database write)
PERFORM net.http_post(...);  -- Fire and forget

-- ❌ BAD: Synchronous (blocks until HTTP request completes)
SELECT net.http_post(...);   -- Waits for response
```

**For triggers, always use `PERFORM` (asynchronous) to avoid slowing down database writes.**

---

## 3. Setting Up Database Triggers

### 3.1 Step 1: Create Trigger Function

```sql
-- Create function that calls Edge Function
CREATE OR REPLACE FUNCTION notify_payment_confirmed()
RETURNS TRIGGER AS $$
BEGIN
  -- Asynchronous HTTP call to Edge Function
  PERFORM net.http_post(
    url := 'https://your-project-ref.supabase.co/functions/v1/payment-confirmed',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.service_role_key')
    ),
    body := jsonb_build_object(
      'event', 'payment.confirmed',
      'payment', row_to_json(NEW),
      'table', TG_TABLE_NAME,
      'operation', TG_OP
    )
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### 3.2 Step 2: Attach Trigger to Table

```sql
-- Create trigger that fires AFTER INSERT on payments
CREATE TRIGGER on_payment_confirmed
AFTER INSERT ON payments
FOR EACH ROW
WHEN (NEW.status = 'confirmed')  -- Only fire for confirmed payments
EXECUTE FUNCTION notify_payment_confirmed();
```

### 3.3 Step 3: Deploy Edge Function

```typescript
// supabase/functions/payment-confirmed/index.ts
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';
import AfricasTalking from 'npm:africastalking@0.6.3';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

const africastalking = AfricasTalking({
  apiKey: Deno.env.get('AFRICASTALKING_API_KEY') ?? '',
  username: Deno.env.get('AFRICASTALKING_USERNAME') ?? '',
});

serve(async (req: Request) => {
  const { payment } = await req.json();

  try {
    // Get customer phone number
    const { data: loan } = await supabase
      .from('loans')
      .select('customers(phone, first_name)')
      .eq('id', payment.loan_id)
      .single();

    // Send SMS confirmation
    await africastalking.SMS.send({
      to: [loan.customers.phone],
      message: `Hi ${loan.customers.first_name}, we received your payment of $${payment.amount}. Thank you!`,
    });

    // Update loan status
    await supabase
      .from('loans')
      .update({ status: 'active' })
      .eq('id', payment.loan_id);

    return new Response(JSON.stringify({ success: true }), { status: 200 });
  } catch (error) {
    console.error('Payment confirmation failed:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
    });
  }
});
```

### 3.4 Test Trigger

```sql
-- Insert test payment
INSERT INTO payments (loan_id, amount, status, payment_method)
VALUES ('abc-123', 50, 'confirmed', 'ecocash');

-- Trigger should automatically fire and invoke Edge Function
-- Customer should receive SMS within seconds
```

---

## 4. Use Cases for Lynia Finance

### 4.1 Payment Confirmation SMS

**Trigger**: AFTER INSERT on `payments` (when status = 'confirmed')

```sql
CREATE OR REPLACE FUNCTION notify_payment_confirmed()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM net.http_post(
    url := 'https://your-project-ref.supabase.co/functions/v1/payment-confirmed',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.service_role_key')
    ),
    body := jsonb_build_object('payment', row_to_json(NEW))
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_payment_confirmed
AFTER INSERT ON payments
FOR EACH ROW
WHEN (NEW.status = 'confirmed')
EXECUTE FUNCTION notify_payment_confirmed();
```

### 4.2 KYC Status Notifications

**Trigger**: AFTER UPDATE on `kyc_verifications` (when status changes to 'verified' or 'failed')

```sql
CREATE OR REPLACE FUNCTION notify_kyc_status_changed()
RETURNS TRIGGER AS $$
BEGIN
  -- Only fire if status actually changed
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    PERFORM net.http_post(
      url := 'https://your-project-ref.supabase.co/functions/v1/kyc-status-changed',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.service_role_key')
      ),
      body := jsonb_build_object(
        'kyc_id', NEW.id,
        'customer_id', NEW.customer_id,
        'old_status', OLD.status,
        'new_status', NEW.status
      )
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_kyc_status_changed
AFTER UPDATE ON kyc_verifications
FOR EACH ROW
EXECUTE FUNCTION notify_kyc_status_changed();
```

**Edge Function**:
```typescript
// supabase/functions/kyc-status-changed/index.ts
serve(async (req: Request) => {
  const { kyc_id, customer_id, new_status } = await req.json();

  const { data: customer } = await supabase
    .from('customers')
    .select('phone, first_name')
    .eq('id', customer_id)
    .single();

  if (new_status === 'verified') {
    await africastalking.SMS.send({
      to: [customer.phone],
      message: `Hi ${customer.first_name}, your identity verification is complete! You can now apply for a loan.`,
    });
  } else if (new_status === 'failed') {
    await africastalking.SMS.send({
      to: [customer.phone],
      message: `Hi ${customer.first_name}, your identity verification failed. Please contact support for assistance.`,
    });
  }

  return new Response(JSON.stringify({ success: true }), { status: 200 });
});
```

### 4.3 Device Lock on Overdue Payment

**Trigger**: AFTER UPDATE on `loans` (when status changes to 'overdue')

```sql
CREATE OR REPLACE FUNCTION trigger_device_lock()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'overdue' AND OLD.status != 'overdue' THEN
    PERFORM net.http_post(
      url := 'https://your-project-ref.supabase.co/functions/v1/lock-device',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.service_role_key')
      ),
      body := jsonb_build_object(
        'loan_id', NEW.id,
        'device_id', NEW.device_id
      )
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_loan_overdue
AFTER UPDATE ON loans
FOR EACH ROW
EXECUTE FUNCTION trigger_device_lock();
```

### 4.4 Credit Score Recalculation

**Trigger**: AFTER INSERT/UPDATE on `payments`

```sql
CREATE OR REPLACE FUNCTION recalculate_credit_score()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM net.http_post(
    url := 'https://your-project-ref.supabase.co/functions/v1/recalculate-score',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.service_role_key')
    ),
    body := jsonb_build_object(
      'loan_id', NEW.loan_id,
      'payment_id', NEW.id,
      'amount', NEW.amount,
      'status', NEW.status
    )
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_payment_score_update
AFTER INSERT OR UPDATE ON payments
FOR EACH ROW
EXECUTE FUNCTION recalculate_credit_score();
```

### 4.5 Low Stock Alerts

**Trigger**: AFTER UPDATE on `devices` (when stock < 5)

```sql
CREATE OR REPLACE FUNCTION notify_low_stock()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.stock < 5 AND OLD.stock >= 5 THEN
    PERFORM net.http_post(
      url := 'https://your-project-ref.supabase.co/functions/v1/low-stock-alert',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.service_role_key')
      ),
      body := jsonb_build_object(
        'device_id', NEW.id,
        'model', NEW.model,
        'stock', NEW.stock
      )
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_low_stock
AFTER UPDATE ON devices
FOR EACH ROW
EXECUTE FUNCTION notify_low_stock();
```

---

## 5. Trigger vs Realtime vs Cron

| Feature | Database Triggers | Realtime Subscriptions | Cron Jobs |
|---------|------------------|------------------------|-----------|
| **Execution** | Automatic (on INSERT/UPDATE/DELETE) | Client subscribes to changes | Scheduled (time-based) |
| **Latency** | <50ms | 50-150ms | N/A (scheduled) |
| **Use Case** | Backend workflows (SMS, scoring) | Frontend UI updates | Periodic tasks (reminders) |
| **RLS** | Bypassed (server-side) | Enforced (client-side) | Bypassed (service role) |
| **Cost** | Edge Function invocations | Realtime messages | Edge Function invocations |
| **Client Required** | ❌ No | ✅ Yes | ❌ No |

**When to Use Each**:
- **Triggers**: Automated backend workflows (SMS, device lock, scoring)
- **Realtime**: Live UI updates (inventory dashboard, payment status)
- **Cron**: Scheduled batch jobs (daily reminders, weekly commissions)

---

## 6. Performance & Scalability

### 6.1 Trigger Overhead

| Metric | Value | Notes |
|--------|-------|-------|
| **Trigger execution time** | <10ms | Asynchronous HTTP call (`PERFORM net.http_post`) |
| **Database write impact** | <1% | Triggers don't block writes |
| **Edge Function latency** | 50-200ms | Depends on Edge Function complexity |

### 6.2 High-Volume Scenarios

**Problem**: 1,000 payments/hour → 1,000 trigger fires → 1,000 Edge Function invocations

**Solution 1: Debounce with `pg_cron`**
```sql
-- Instead of firing trigger immediately, log events and process in batches
CREATE TABLE pending_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type VARCHAR(50),
  payload JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Trigger just logs event
CREATE OR REPLACE FUNCTION log_payment_event()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO pending_notifications (event_type, payload)
  VALUES ('payment.confirmed', row_to_json(NEW));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Cron job processes batches every 5 minutes
SELECT cron.schedule(
  'process-pending-notifications',
  '*/5 * * * *',  -- Every 5 minutes
  $$
  SELECT net.http_post(
    url := 'https://xxx.supabase.co/functions/v1/process-batch-notifications',
    headers := jsonb_build_object('Content-Type', 'application/json'),
    body := '{}'::jsonb
  );
  $$
);
```

**Solution 2: Conditional Triggers**
```sql
-- Only fire for high-value payments (> $100)
CREATE TRIGGER on_high_value_payment
AFTER INSERT ON payments
FOR EACH ROW
WHEN (NEW.amount > 100 AND NEW.status = 'confirmed')
EXECUTE FUNCTION notify_payment_confirmed();
```

### 6.3 Lynia Finance Scale Estimate

| Scenario | Payments/Day | Trigger Fires/Day | Edge Function Invocations/Month | Cost |
|----------|--------------|-------------------|--------------------------------|------|
| **500 loans/month** | ~70 | 70 | 2,100 | $0 (free tier) |
| **5,000 loans/month** | ~700 | 700 | 21,000 | $0 (free tier) |
| **50,000 loans/month** | ~7,000 | 7,000 | 210,000 | $0 (free tier) |

**Conclusion**: Lynia Finance will stay within free tier (500K invocations/month) even at massive scale.

---

## 7. Error Handling

### 7.1 Handle Failed HTTP Requests

```sql
CREATE OR REPLACE FUNCTION notify_payment_confirmed()
RETURNS TRIGGER AS $$
DECLARE
  request_id BIGINT;
BEGIN
  -- Make HTTP request and capture request ID
  SELECT net.http_post(
    url := 'https://your-project-ref.supabase.co/functions/v1/payment-confirmed',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.service_role_key')
    ),
    body := jsonb_build_object('payment', row_to_json(NEW))
  ) INTO request_id;

  -- Log request for debugging
  INSERT INTO trigger_logs (trigger_name, request_id, payload)
  VALUES ('on_payment_confirmed', request_id, row_to_json(NEW));

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log error but don't fail the transaction
    INSERT INTO trigger_errors (trigger_name, error_message, payload)
    VALUES ('on_payment_confirmed', SQLERRM, row_to_json(NEW));

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

### 7.2 Monitor Failed Requests

```sql
-- Create error logging table
CREATE TABLE trigger_errors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trigger_name VARCHAR(100),
  error_message TEXT,
  payload JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Query recent errors
SELECT * FROM trigger_errors
WHERE created_at > now() - interval '24 hours'
ORDER BY created_at DESC;
```

### 7.3 Retry Failed Requests

```sql
-- Cron job to retry failed trigger invocations
SELECT cron.schedule(
  'retry-failed-triggers',
  '*/15 * * * *',  -- Every 15 minutes
  $$
  SELECT net.http_post(
    url := 'https://xxx.supabase.co/functions/v1/retry-failed-triggers',
    headers := jsonb_build_object('Content-Type', 'application/json'),
    body := '{}'::jsonb
  );
  $$
);
```

---

## 8. Implementation Examples

### 8.1 Complete Setup Script

```sql
-- setup-database-triggers.sql

-- 1. Enable extensions
CREATE EXTENSION IF NOT EXISTS pg_net;

-- 2. Create logging tables
CREATE TABLE IF NOT EXISTS trigger_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trigger_name VARCHAR(100),
  request_id BIGINT,
  payload JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS trigger_errors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trigger_name VARCHAR(100),
  error_message TEXT,
  payload JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Payment confirmation trigger
CREATE OR REPLACE FUNCTION notify_payment_confirmed()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM net.http_post(
    url := 'https://your-project-ref.supabase.co/functions/v1/payment-confirmed',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.service_role_key')
    ),
    body := jsonb_build_object('payment', row_to_json(NEW))
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_payment_confirmed
AFTER INSERT ON payments
FOR EACH ROW
WHEN (NEW.status = 'confirmed')
EXECUTE FUNCTION notify_payment_confirmed();

-- 4. KYC status change trigger
CREATE OR REPLACE FUNCTION notify_kyc_status_changed()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    PERFORM net.http_post(
      url := 'https://your-project-ref.supabase.co/functions/v1/kyc-status-changed',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.service_role_key')
      ),
      body := jsonb_build_object(
        'kyc_id', NEW.id,
        'customer_id', NEW.customer_id,
        'new_status', NEW.status
      )
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_kyc_status_changed
AFTER UPDATE ON kyc_verifications
FOR EACH ROW
EXECUTE FUNCTION notify_kyc_status_changed();

-- 5. Device lock on overdue loan
CREATE OR REPLACE FUNCTION trigger_device_lock()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'overdue' AND OLD.status != 'overdue' THEN
    PERFORM net.http_post(
      url := 'https://your-project-ref.supabase.co/functions/v1/lock-device',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.service_role_key')
      ),
      body := jsonb_build_object('loan_id', NEW.id, 'device_id', NEW.device_id)
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_loan_overdue
AFTER UPDATE ON loans
FOR EACH ROW
EXECUTE FUNCTION trigger_device_lock();

-- 6. Verify triggers
SELECT trigger_name, event_manipulation, event_object_table
FROM information_schema.triggers
WHERE trigger_schema = 'public';
```

---

## 9. Summary

### 9.1 Key Takeaways

✅ **Automatic Execution**: Triggers fire on INSERT/UPDATE/DELETE without manual API calls
✅ **Asynchronous**: Use `PERFORM` to avoid blocking database writes
✅ **Event-Driven**: Perfect for real-time workflows (SMS, device lock, scoring)
✅ **Free Tier**: Trigger invocations count toward 500K Edge Function calls/month
✅ **Simple Setup**: Enable `pg_net`, create trigger function, attach to table
✅ **Error Handling**: Log failed requests, retry with cron jobs

### 9.2 Recommended Triggers for Lynia Finance

| Trigger | Table | Event | Edge Function |
|---------|-------|-------|---------------|
| **on_payment_confirmed** | `payments` | AFTER INSERT (status = 'confirmed') | payment-confirmed (send SMS) |
| **on_kyc_status_changed** | `kyc_verifications` | AFTER UPDATE (status changed) | kyc-status-changed (notify customer) |
| **on_loan_overdue** | `loans` | AFTER UPDATE (status = 'overdue') | lock-device (trigger device lock) |
| **on_payment_score_update** | `payments` | AFTER INSERT/UPDATE | recalculate-score (update credit score) |
| **on_low_stock** | `devices` | AFTER UPDATE (stock < 5) | low-stock-alert (notify admin) |

### 9.3 Next Steps

- [ ] Enable `pg_net` extension
- [ ] Create trigger functions for each use case
- [ ] Attach triggers to tables
- [ ] Deploy corresponding Edge Functions
- [ ] Test with sample data
- [ ] Monitor trigger logs for 1 week

---

**Status**: ✅ T037 Complete
**Next Task**: T038 - Research Supabase Storage (file upload, signed URLs, automatic image optimization)
**Related**: T035 (Edge Functions), T036 (Cron jobs), T038-T039 (Storage & Events)
