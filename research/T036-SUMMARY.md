# T036: Supabase Edge Functions Cron Jobs

**Task:** Research Edge Functions cron jobs (weekly commissions, daily reminders, reconciliation)
**Phase:** Phase 0: Research
**Status:** ✅ Completed
**Date:** November 14, 2025

---

## Executive Summary

Supabase Edge Functions support **scheduled cron jobs** via `pg_cron` (PostgreSQL extension) for automated recurring tasks. Perfect for **daily payment reminders, weekly commission calculations, monthly reconciliation**, and other time-based automation without external services like AWS Lambda + EventBridge.

**Key Capabilities:**
- **pg_cron integration**: Unix cron syntax (`0 9 * * *` = daily at 9am)
- **Timezone support**: Configurable timezone (Africa/Harare for Zimbabwe)
- **Automatic retries**: Failed jobs retry with exponential backoff
- **Free tier**: Unlimited cron jobs (execution time counts toward 400K GB-seconds/month)
- **No external dependencies**: No need for AWS CloudWatch Events, GitHub Actions, or third-party schedulers

**Perfect for Lynia Finance**:
- Daily payment reminders (9am every day)
- Weekly commission calculations (Monday 6am)
- Monthly reconciliation reports (1st of month, 7am)
- Overdue loan checks (daily at 10pm)
- Device lock reminders (daily at 8am for unpaid customers)

---

## Table of Contents

1. [pg_cron Overview](#1-pg_cron-overview)
2. [Cron Syntax Reference](#2-cron-syntax-reference)
3. [Setting Up Cron Jobs](#3-setting-up-cron-jobs)
4. [Use Cases for Lynia Finance](#4-use-cases-for-lynia-finance)
5. [Error Handling & Retries](#5-error-handling--retries)
6. [Monitoring & Logging](#6-monitoring--logging)
7. [Cost Analysis](#7-cost-analysis)
8. [Implementation Examples](#8-implementation-examples)
9. [Summary](#9-summary)

---

## 1. pg_cron Overview

### 1.1 What is pg_cron?

`pg_cron` is a **PostgreSQL extension** that runs scheduled jobs directly in the database using cron syntax. Supabase enables pg_cron for all projects, allowing you to schedule Edge Function invocations.

```
┌─────────────────────────────────────────────────────────────────┐
│                    CRON JOB ARCHITECTURE                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  PostgreSQL (pg_cron)                                            │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  Cron Schedule: 0 9 * * *  (Daily at 9am)                  │ │
│  │                                                             │ │
│  │  SELECT net.http_post(                                      │ │
│  │    url := 'https://xxx.supabase.co/functions/v1/reminders',│ │
│  │    headers := '{"Authorization": "Bearer xxx"}'::jsonb     │ │
│  │  );                                                         │ │
│  └─────────────────────────┬───────────────────────────────────┘ │
│                            │                                     │
│                            ▼                                     │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  Edge Function: daily-reminders                            │ │
│  │  ┌──────────────────────────────────────────────────────┐  │ │
│  │  │ 1. Query loans with payments due tomorrow            │  │ │
│  │  │ 2. Send SMS reminders via Africa's Talking           │  │ │
│  │  │ 3. Log results to cron_logs table                    │  │ │
│  │  └──────────────────────────────────────────────────────┘  │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 1.2 Why Use pg_cron Instead of Alternatives?

| Feature | pg_cron (Supabase) | AWS EventBridge + Lambda | GitHub Actions | Cron.io |
|---------|-------------------|-------------------------|----------------|---------|
| **Cost (free tier)** | ✅ Free | ⚠️  1M events/month free | ✅ Free (2K min/month) | ⚠️  $19/month |
| **Setup complexity** | ✅ SQL query | ⚠️  IAM, CloudWatch, etc. | ✅ Simple YAML | ✅ Simple |
| **Database access** | ✅ Direct | ❌ Requires VPC/public IP | ❌ Requires API | ❌ Requires API |
| **Timezone support** | ✅ Yes | ✅ Yes | ✅ Yes | ✅ Yes |
| **Retries** | ✅ Manual | ✅ Automatic | ⚠️  Manual | ✅ Automatic |
| **Execution logs** | ✅ `cron.job_run_details` | ✅ CloudWatch | ✅ Actions tab | ✅ Dashboard |

**Recommendation for Lynia Finance**: Use pg_cron for simplicity and cost savings.

---

## 2. Cron Syntax Reference

### 2.1 Standard Cron Format

```
 ┌───────────── minute (0 - 59)
 │ ┌───────────── hour (0 - 23)
 │ │ ┌───────────── day of month (1 - 31)
 │ │ │ ┌───────────── month (1 - 12)
 │ │ │ │ ┌───────────── day of week (0 - 6) (Sunday = 0)
 │ │ │ │ │
 │ │ │ │ │
 * * * * *
```

### 2.2 Common Patterns

| Schedule | Cron Expression | Use Case |
|----------|-----------------|----------|
| **Every minute** | `* * * * *` | Testing only |
| **Every 15 minutes** | `*/15 * * * *` | High-frequency checks |
| **Every hour** | `0 * * * *` | Hourly reconciliation |
| **Daily at 9am** | `0 9 * * *` | Payment reminders |
| **Daily at 10pm** | `0 22 * * *` | Overdue loan checks |
| **Every Monday at 6am** | `0 6 * * 1` | Weekly commission calculation |
| **1st of month at 7am** | `0 7 1 * *` | Monthly reports |
| **Weekdays at 8am** | `0 8 * * 1-5` | Business days only |
| **Every 6 hours** | `0 */6 * * *` | Periodic sync |

### 2.3 Timezone Configuration

```sql
-- Set timezone for cron jobs (Zimbabwe = Africa/Harare = UTC+2)
ALTER DATABASE postgres SET cron.timezone = 'Africa/Harare';

-- Verify timezone
SHOW cron.timezone;
-- Output: Africa/Harare
```

---

## 3. Setting Up Cron Jobs

### 3.1 Enable pg_cron Extension

```sql
-- Run in Supabase SQL Editor
CREATE EXTENSION IF NOT EXISTS pg_cron;
```

### 3.2 Schedule Edge Function Invocation

```sql
-- Schedule daily payment reminders at 9am (Africa/Harare time)
SELECT cron.schedule(
  'daily-payment-reminders',              -- Job name (unique identifier)
  '0 9 * * *',                            -- Cron expression (daily at 9am)
  $$
  SELECT net.http_post(
    url := 'https://your-project-ref.supabase.co/functions/v1/daily-reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.service_role_key')
    ),
    body := '{}'::jsonb
  ) AS request_id;
  $$
);
```

### 3.3 List All Scheduled Jobs

```sql
-- View all cron jobs
SELECT * FROM cron.job;

-- Output:
-- jobid | schedule   | command                              | nodename  | nodeport | database | username | active
-- ------+------------+--------------------------------------+-----------+----------+----------+----------+--------
-- 1     | 0 9 * * *  | SELECT net.http_post(...)            | localhost | 5432     | postgres | postgres | t
```

### 3.4 Unschedule a Job

```sql
-- Remove job by name
SELECT cron.unschedule('daily-payment-reminders');

-- Or by job ID
SELECT cron.unschedule(1);
```

### 3.5 Update Existing Job

```sql
-- Unschedule old version
SELECT cron.unschedule('daily-payment-reminders');

-- Schedule new version
SELECT cron.schedule(
  'daily-payment-reminders',
  '0 8 * * *',  -- Changed from 9am to 8am
  $$
  SELECT net.http_post(...) AS request_id;
  $$
);
```

---

## 4. Use Cases for Lynia Finance

### 4.1 Daily Payment Reminders (9am)

**Goal**: Send SMS to customers with payments due tomorrow.

```sql
SELECT cron.schedule(
  'daily-payment-reminders',
  '0 9 * * *',  -- Daily at 9am
  $$
  SELECT net.http_post(
    url := 'https://your-project-ref.supabase.co/functions/v1/daily-reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.service_role_key')
    ),
    body := '{}'::jsonb
  ) AS request_id;
  $$
);
```

**Edge Function** (`supabase/functions/daily-reminders/index.ts`):
```typescript
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
  try {
    // Find loans with payments due tomorrow
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];

    const { data: loans } = await supabase
      .from('loans')
      .select('id, monthly_payment, customers(phone, first_name)')
      .eq('status', 'active')
      .eq('next_payment_date', tomorrowStr);

    let sent = 0;
    for (const loan of loans ?? []) {
      const message = `Hi ${loan.customers.first_name}, your loan payment of $${loan.monthly_payment} is due tomorrow. Pay via EcoCash to *151*2*4#.`;

      await africastalking.SMS.send({
        to: [loan.customers.phone],
        message,
      });

      sent++;
    }

    // Log results
    await supabase.from('cron_logs').insert({
      job_name: 'daily-payment-reminders',
      status: 'success',
      details: { sent, total: loans?.length ?? 0 },
    });

    return new Response(JSON.stringify({ sent }), { status: 200 });
  } catch (error) {
    await supabase.from('cron_logs').insert({
      job_name: 'daily-payment-reminders',
      status: 'error',
      error: error.message,
    });

    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
    });
  }
});
```

### 4.2 Weekly Commission Calculations (Monday 6am)

**Goal**: Calculate commissions for sales agents every Monday.

```sql
SELECT cron.schedule(
  'weekly-commissions',
  '0 6 * * 1',  -- Every Monday at 6am
  $$
  SELECT net.http_post(
    url := 'https://your-project-ref.supabase.co/functions/v1/calculate-commissions',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.service_role_key')
    ),
    body := '{}'::jsonb
  ) AS request_id;
  $$
);
```

**Edge Function** (`supabase/functions/calculate-commissions/index.ts`):
```typescript
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

serve(async (req: Request) => {
  try {
    // Get last week's date range
    const today = new Date();
    const lastMonday = new Date(today);
    lastMonday.setDate(today.getDate() - 7);
    const lastSunday = new Date(today);
    lastSunday.setDate(today.getDate() - 1);

    // Find all loans disbursed last week
    const { data: loans } = await supabase
      .from('loans')
      .select('id, loan_amount, sales_agent_id')
      .gte('disbursed_at', lastMonday.toISOString())
      .lte('disbursed_at', lastSunday.toISOString());

    // Calculate commissions (2% of loan amount)
    const commissionsBySales = {};
    for (const loan of loans ?? []) {
      const agentId = loan.sales_agent_id;
      const commission = loan.loan_amount * 0.02;

      if (!commissionsBySales[agentId]) {
        commissionsBySales[agentId] = 0;
      }
      commissionsBySales[agentId] += commission;
    }

    // Insert commission records
    const commissions = Object.entries(commissionsBySales).map(
      ([agentId, amount]) => ({
        sales_agent_id: agentId,
        amount,
        period_start: lastMonday.toISOString().split('T')[0],
        period_end: lastSunday.toISOString().split('T')[0],
        status: 'pending',
      })
    );

    await supabase.from('commissions').insert(commissions);

    return new Response(
      JSON.stringify({ calculated: commissions.length }),
      { status: 200 }
    );
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
    });
  }
});
```

### 4.3 Monthly Reconciliation (1st of month, 7am)

**Goal**: Generate monthly reports for accounting.

```sql
SELECT cron.schedule(
  'monthly-reconciliation',
  '0 7 1 * *',  -- 1st day of every month at 7am
  $$
  SELECT net.http_post(
    url := 'https://your-project-ref.supabase.co/functions/v1/monthly-reconciliation',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.service_role_key')
    ),
    body := '{}'::jsonb
  ) AS request_id;
  $$
);
```

### 4.4 Overdue Loan Checks (Daily 10pm)

**Goal**: Identify overdue loans and trigger device locks.

```sql
SELECT cron.schedule(
  'overdue-loan-checks',
  '0 22 * * *',  -- Daily at 10pm
  $$
  SELECT net.http_post(
    url := 'https://your-project-ref.supabase.co/functions/v1/check-overdue-loans',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.service_role_key')
    ),
    body := '{}'::jsonb
  ) AS request_id;
  $$
);
```

**Edge Function** (`supabase/functions/check-overdue-loans/index.ts`):
```typescript
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

serve(async (req: Request) => {
  try {
    const today = new Date().toISOString().split('T')[0];

    // Find loans with overdue payments
    const { data: overdueLoans } = await supabase
      .from('loans')
      .select('id, device_id, customers(phone)')
      .eq('status', 'active')
      .lt('next_payment_date', today);

    let lockedDevices = 0;
    for (const loan of overdueLoans ?? []) {
      // Trigger device lock
      await fetch(
        `${Deno.env.get('SUPABASE_URL')}/functions/v1/lock-device`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${Deno.env.get('SUPABASE_ANON_KEY')}`,
          },
          body: JSON.stringify({ device_id: loan.device_id }),
        }
      );

      // Update loan status
      await supabase
        .from('loans')
        .update({ status: 'overdue' })
        .eq('id', loan.id);

      lockedDevices++;
    }

    return new Response(JSON.stringify({ locked: lockedDevices }), {
      status: 200,
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
    });
  }
});
```

---

## 5. Error Handling & Retries

### 5.1 Manual Retry Logic

```typescript
// supabase/functions/daily-reminders/index.ts
async function sendSMSWithRetry(phone: string, message: string, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await africastalking.SMS.send({ to: [phone], message });
      return { success: true };
    } catch (error) {
      if (attempt === maxRetries) {
        console.error(`Failed after ${maxRetries} attempts:`, error);
        return { success: false, error: error.message };
      }

      // Exponential backoff: 1s, 2s, 4s
      await new Promise((resolve) =>
        setTimeout(resolve, Math.pow(2, attempt - 1) * 1000)
      );
    }
  }
}
```

### 5.2 Logging Failed Jobs

```sql
-- Create cron_logs table
CREATE TABLE cron_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_name VARCHAR(100) NOT NULL,
  status VARCHAR(20) NOT NULL,  -- 'success', 'error', 'partial'
  details JSONB,
  error TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Index for quick lookups
CREATE INDEX idx_cron_logs_job_name ON cron_logs(job_name, created_at DESC);
```

```typescript
// Log every cron job execution
await supabase.from('cron_logs').insert({
  job_name: 'daily-payment-reminders',
  status: 'success',
  details: { sent: 42, failed: 1 },
});
```

### 5.3 Monitoring with SQL Queries

```sql
-- Check recent job executions
SELECT * FROM cron.job_run_details
ORDER BY start_time DESC
LIMIT 10;

-- Find failed jobs in last 24 hours
SELECT * FROM cron_logs
WHERE status = 'error'
AND created_at > now() - interval '24 hours';

-- Calculate success rate for each job
SELECT
  job_name,
  COUNT(*) AS total_runs,
  SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) AS successful,
  ROUND(
    SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END)::numeric / COUNT(*) * 100,
    2
  ) AS success_rate_percent
FROM cron_logs
WHERE created_at > now() - interval '30 days'
GROUP BY job_name;
```

---

## 6. Monitoring & Logging

### 6.1 View Cron Execution History

```sql
-- See last 100 cron job runs
SELECT
  jobid,
  runid,
  job_pid,
  database,
  username,
  command,
  status,
  return_message,
  start_time,
  end_time
FROM cron.job_run_details
ORDER BY start_time DESC
LIMIT 100;
```

### 6.2 Alert on Failed Jobs

```typescript
// supabase/functions/check-cron-health/index.ts
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';
import twilio from 'npm:twilio@4.19.0';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

serve(async (req: Request) => {
  // Check for failed jobs in last hour
  const { data: failures } = await supabase
    .from('cron_logs')
    .select('*')
    .eq('status', 'error')
    .gte('created_at', new Date(Date.now() - 3600000).toISOString());

  if (failures && failures.length > 0) {
    // Send alert to admin
    const twilioClient = twilio(
      Deno.env.get('TWILIO_ACCOUNT_SID'),
      Deno.env.get('TWILIO_AUTH_TOKEN')
    );

    await twilioClient.messages.create({
      to: '+263771234567',  // Admin phone
      from: '+12345678901',
      body: `⚠️ Lynia Finance Alert: ${failures.length} cron job(s) failed in the last hour.`,
    });
  }

  return new Response(JSON.stringify({ failures: failures?.length ?? 0 }), {
    status: 200,
  });
});
```

Schedule health check every hour:
```sql
SELECT cron.schedule(
  'cron-health-check',
  '0 * * * *',  -- Every hour
  $$
  SELECT net.http_post(
    url := 'https://your-project-ref.supabase.co/functions/v1/check-cron-health',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.service_role_key')
    ),
    body := '{}'::jsonb
  ) AS request_id;
  $$
);
```

---

## 7. Cost Analysis

### 7.1 Free Tier Limits

| Metric | Free Tier | Lynia Finance Usage (500 loans/month) | Cost |
|--------|-----------|---------------------------------------|------|
| **Edge Function Invocations** | 500K/month | ~150/month (5 jobs × 30 days) | $0 |
| **Execution Time** | 400K GB-seconds | ~30 seconds/month | $0 |
| **Database Queries** | Unlimited (in free tier) | ~1,500 queries/month | $0 |

**Conclusion**: Lynia Finance cron jobs will **easily stay within free tier**.

### 7.2 At Scale (5,000 loans/month)

| Job | Frequency | Invocations/Month | Execution Time | Cost |
|-----|-----------|-------------------|----------------|------|
| Daily reminders | Daily | 30 | 3 sec × 30 = 90 sec | $0 |
| Weekly commissions | Weekly | 4 | 2 sec × 4 = 8 sec | $0 |
| Monthly reconciliation | Monthly | 1 | 5 sec × 1 = 5 sec | $0 |
| Overdue checks | Daily | 30 | 2 sec × 30 = 60 sec | $0 |
| **TOTAL** | - | **65/month** | **163 seconds** | **$0** |

**Even at 10x scale, still free.**

---

## 8. Implementation Examples

### 8.1 Complete Cron Setup Script

```sql
-- setup-cron-jobs.sql

-- 1. Enable pg_cron
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- 2. Set timezone
ALTER DATABASE postgres SET cron.timezone = 'Africa/Harare';

-- 3. Create logging table
CREATE TABLE IF NOT EXISTS cron_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_name VARCHAR(100) NOT NULL,
  status VARCHAR(20) NOT NULL,
  details JSONB,
  error TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cron_logs_job_name
ON cron_logs(job_name, created_at DESC);

-- 4. Schedule daily payment reminders (9am)
SELECT cron.schedule(
  'daily-payment-reminders',
  '0 9 * * *',
  $$
  SELECT net.http_post(
    url := 'https://your-project-ref.supabase.co/functions/v1/daily-reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.service_role_key')
    ),
    body := '{}'::jsonb
  ) AS request_id;
  $$
);

-- 5. Schedule weekly commission calculations (Monday 6am)
SELECT cron.schedule(
  'weekly-commissions',
  '0 6 * * 1',
  $$
  SELECT net.http_post(
    url := 'https://your-project-ref.supabase.co/functions/v1/calculate-commissions',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.service_role_key')
    ),
    body := '{}'::jsonb
  ) AS request_id;
  $$
);

-- 6. Schedule monthly reconciliation (1st of month, 7am)
SELECT cron.schedule(
  'monthly-reconciliation',
  '0 7 1 * *',
  $$
  SELECT net.http_post(
    url := 'https://your-project-ref.supabase.co/functions/v1/monthly-reconciliation',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.service_role_key')
    ),
    body := '{}'::jsonb
  ) AS request_id;
  $$
);

-- 7. Schedule overdue loan checks (Daily 10pm)
SELECT cron.schedule(
  'overdue-loan-checks',
  '0 22 * * *',
  $$
  SELECT net.http_post(
    url := 'https://your-project-ref.supabase.co/functions/v1/check-overdue-loans',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.service_role_key')
    ),
    body := '{}'::jsonb
  ) AS request_id;
  $$
);

-- 8. Verify jobs
SELECT jobid, jobname, schedule, command FROM cron.job;
```

---

## 9. Summary

### 9.1 Key Takeaways

✅ **pg_cron Integration**: Schedule Edge Functions with Unix cron syntax
✅ **Timezone Support**: Configure for Africa/Harare (UTC+2)
✅ **Free Tier**: Unlimited cron jobs (execution time counts toward free tier)
✅ **No External Dependencies**: No AWS EventBridge, GitHub Actions, or third-party schedulers
✅ **Direct Database Access**: Query Supabase tables directly from cron jobs
✅ **Automatic Logging**: Track job execution history in `cron.job_run_details`

### 9.2 Recommended Cron Jobs for Lynia Finance

| Job | Schedule | Purpose |
|-----|----------|---------|
| **daily-payment-reminders** | `0 9 * * *` | SMS reminders for payments due tomorrow |
| **weekly-commissions** | `0 6 * * 1` | Calculate sales agent commissions |
| **monthly-reconciliation** | `0 7 1 * *` | Generate accounting reports |
| **overdue-loan-checks** | `0 22 * * *` | Lock devices for overdue loans |
| **cron-health-check** | `0 * * * *` | Monitor for failed jobs, send alerts |

### 9.3 Next Steps

- [ ] Enable `pg_cron` extension in Supabase
- [ ] Set timezone to `Africa/Harare`
- [ ] Create `cron_logs` table for monitoring
- [ ] Deploy Edge Functions for each cron job
- [ ] Schedule jobs with `cron.schedule()`
- [ ] Test locally with manual invocations
- [ ] Monitor execution logs for 1 week

---

**Status**: ✅ T036 Complete
**Next Task**: T037 - Research Edge Functions database trigger integration (auto-execute on INSERT/UPDATE)
**Related**: T035 (Edge Functions basics), T037-T039 (Advanced Edge Functions)
