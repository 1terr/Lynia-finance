# T035: Supabase Edge Functions (Deno Runtime)

**Task:** Research Supabase Edge Functions Deno runtime (TypeScript, NPM modules)
**Phase:** Phase 0: Research
**Status:** ✅ Completed
**Date:** November 14, 2025

---

## Executive Summary

Supabase Edge Functions run on **Deno Deploy** infrastructure, providing serverless TypeScript/JavaScript functions at the edge (globally distributed). They are ideal for **webhooks, scheduled jobs, API integrations, and serverless business logic** with native TypeScript support, NPM compatibility, and built-in Supabase client access.

**Key Capabilities:**
- **Deno runtime**: Secure, TypeScript-first, no node_modules
- **NPM support**: Import packages via `npm:` specifier (e.g., `import twilio from 'npm:twilio'`)
- **Native TypeScript**: No compilation step required
- **Free tier**: 500K function invocations/month
- **Global deployment**: <100ms cold start, deployed to 35+ regions
- **Supabase client included**: Direct database access with RLS enforcement
- **Environment variables**: Secure secrets management

**Perfect for Lynia Finance**:
- WhatsApp/SMS webhooks (Africa's Talking, Twilio)
- Payment gateway webhooks (EcoCash, Omari)
- Scheduled jobs (daily reminders, weekly commissions)
- KYC verification workflows (DIDIT callbacks)
- Device lock/unlock API integrations

---

## Table of Contents

1. [Deno Runtime Overview](#1-deno-runtime-overview)
2. [NPM Module Support](#2-npm-module-support)
3. [Supabase Client Integration](#3-supabase-client-integration)
4. [Environment Variables & Secrets](#4-environment-variables--secrets)
5. [Deployment Workflow](#5-deployment-workflow)
6. [Use Cases for Lynia Finance](#6-use-cases-for-lynia-finance)
7. [Pricing & Limits](#7-pricing--limits)
8. [Implementation Examples](#8-implementation-examples)
9. [Summary](#9-summary)

---

## 1. Deno Runtime Overview

### 1.1 What is Deno?

Deno is a **modern JavaScript/TypeScript runtime** created by Ryan Dahl (Node.js creator) that addresses Node.js limitations:

| Feature | Deno | Node.js |
|---------|------|---------|
| **TypeScript** | Native support (no compilation) | Requires tsc/ts-node |
| **Security** | Sandboxed by default (explicit permissions) | Full system access |
| **Modules** | ES modules (import from URLs) | CommonJS (require) |
| **Package Manager** | None (imports from URLs/NPM) | npm/yarn/pnpm |
| **Standard Library** | Comprehensive, tested | Minimal (relies on npm) |
| **Top-level await** | ✅ Yes | ✅ Yes (ES modules only) |

### 1.2 Deno in Supabase Edge Functions

```typescript
// index.ts (Supabase Edge Function)
// No build step, no package.json, pure TypeScript

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';

serve(async (req: Request) => {
  const { name } = await req.json();

  return new Response(
    JSON.stringify({ message: `Hello, ${name}!` }),
    { headers: { 'Content-Type': 'application/json' } }
  );
});
```

**Key Benefits for Lynia Finance**:
- No build process (write TypeScript, deploy immediately)
- Fast cold starts (<100ms vs 500ms+ for Node.js)
- Secure by default (can't access filesystem or network without explicit permission)
- Lightweight (no node_modules to upload)

---

## 2. NPM Module Support

### 2.1 Importing NPM Packages

Deno supports NPM packages via `npm:` specifier (no package.json required):

```typescript
// Import NPM packages directly
import twilio from 'npm:twilio@4.19.0';
import axios from 'npm:axios@1.6.0';
import { z } from 'npm:zod@3.22.0';

// Use immediately
const client = twilio(
  Deno.env.get('TWILIO_ACCOUNT_SID'),
  Deno.env.get('TWILIO_AUTH_TOKEN')
);

await client.messages.create({
  to: '+263771234567',
  from: '+12345678901',
  body: 'Your loan has been approved!'
});
```

### 2.2 Version Locking

```typescript
// ✅ GOOD: Pin exact versions
import twilio from 'npm:twilio@4.19.0';

// ❌ BAD: No version (uses latest, may break)
import twilio from 'npm:twilio';

// ⚠️  ACCEPTABLE: Semver range (auto-updates patches)
import twilio from 'npm:twilio@^4.19.0';
```

### 2.3 Commonly Used NPM Packages for Lynia Finance

| Package | Use Case | Import Statement |
|---------|----------|------------------|
| **twilio** | SMS notifications | `import twilio from 'npm:twilio@4.19.0'` |
| **africastalking** | SMS (cheaper for Zimbabwe) | `import AfricasTalking from 'npm:africastalking@0.6.3'` |
| **zod** | Request validation | `import { z } from 'npm:zod@3.22.0'` |
| **date-fns** | Date manipulation | `import { addDays } from 'npm:date-fns@3.0.0'` |
| **axios** | HTTP requests | `import axios from 'npm:axios@1.6.0'` |
| **stripe** | Payment processing | `import Stripe from 'npm:stripe@14.0.0'` |
| **jsonwebtoken** | JWT authentication | `import jwt from 'npm:jsonwebtoken@9.0.2'` |

### 2.4 Deno Standard Library (No NPM Required)

```typescript
// Deno provides many utilities built-in
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { crypto } from 'https://deno.land/std@0.177.0/crypto/mod.ts';
import { encode } from 'https://deno.land/std@0.177.0/encoding/base64.ts';

// HMAC signature verification (for webhooks)
const signature = await crypto.subtle.sign(
  { name: 'HMAC', hash: 'SHA-256' },
  key,
  data
);
```

---

## 3. Supabase Client Integration

### 3.1 Built-In Supabase Client

Edge Functions have **automatic access** to Supabase client with RLS enforcement:

```typescript
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

serve(async (req: Request) => {
  // Create Supabase client with user's auth token
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    {
      global: {
        headers: { Authorization: req.headers.get('Authorization')! },
      },
    }
  );

  // Database queries respect RLS policies
  const { data: loans, error } = await supabase
    .from('loans')
    .select('*')
    .eq('status', 'active');

  return new Response(JSON.stringify({ loans }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
```

### 3.2 Service Role Access (Bypass RLS)

For admin operations (webhooks, cron jobs), use **service role key**:

```typescript
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

// Service role bypasses RLS (use carefully!)
const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

// Can access any row, regardless of RLS policies
const { data: allCustomers } = await supabaseAdmin
  .from('customers')
  .select('*');
```

**Use Cases**:
- Payment webhooks (update loan status regardless of who triggered)
- Scheduled jobs (send reminders to all customers)
- Admin operations (recalculate credit scores)

### 3.3 RLS-Aware Queries

```typescript
// Example: Customer portal (RLS enforced)
serve(async (req: Request) => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    {
      global: { headers: { Authorization: req.headers.get('Authorization')! } },
    }
  );

  // Only returns loans for authenticated customer (RLS policy enforced)
  const { data: myLoans } = await supabase
    .from('loans')
    .select('*');

  return new Response(JSON.stringify({ loans: myLoans }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
```

---

## 4. Environment Variables & Secrets

### 4.1 Setting Secrets

```bash
# Set environment variables via Supabase CLI
supabase secrets set TWILIO_ACCOUNT_SID=AC1234567890abcdef
supabase secrets set TWILIO_AUTH_TOKEN=your_auth_token
supabase secrets set AFRICASTALKING_API_KEY=your_api_key
supabase secrets set DIDIT_PARTNER_ID=your_partner_id
```

### 4.2 Accessing Secrets in Edge Functions

```typescript
// Deno.env.get() retrieves secrets
const twilioAccountSid = Deno.env.get('TWILIO_ACCOUNT_SID');
const twilioAuthToken = Deno.env.get('TWILIO_AUTH_TOKEN');

// Always validate environment variables
if (!twilioAccountSid || !twilioAuthToken) {
  return new Response(
    JSON.stringify({ error: 'Missing Twilio credentials' }),
    { status: 500 }
  );
}
```

### 4.3 Best Practices

```typescript
// ✅ GOOD: Type-safe environment variable helper
function getEnv(key: string): string {
  const value = Deno.env.get(key);
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

// Usage
const apiKey = getEnv('AFRICASTALKING_API_KEY');
```

---

## 5. Deployment Workflow

### 5.1 Project Structure

```
supabase/
├── functions/
│   ├── payment-webhook/
│   │   └── index.ts
│   ├── send-sms/
│   │   └── index.ts
│   ├── kyc-callback/
│   │   └── index.ts
│   └── daily-reminders/
│       └── index.ts
```

### 5.2 Deploy Single Function

```bash
# Deploy specific function
supabase functions deploy payment-webhook

# Deploy with custom name
supabase functions deploy payment-webhook --project-ref your-project-ref

# Deploy all functions
supabase functions deploy
```

### 5.3 Local Development

```bash
# Start local Supabase stack
supabase start

# Serve Edge Function locally
supabase functions serve payment-webhook --env-file .env.local

# Test with curl
curl -i --location --request POST 'http://localhost:54321/functions/v1/payment-webhook' \
  --header 'Authorization: Bearer YOUR_ANON_KEY' \
  --header 'Content-Type: application/json' \
  --data '{"amount": 50, "phone": "+263771234567"}'
```

### 5.4 CI/CD with GitHub Actions

```yaml
# .github/workflows/deploy-edge-functions.yml
name: Deploy Edge Functions

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - uses: supabase/setup-cli@v1
        with:
          version: latest

      - name: Deploy Edge Functions
        run: |
          supabase functions deploy --project-ref ${{ secrets.SUPABASE_PROJECT_REF }}
        env:
          SUPABASE_ACCESS_TOKEN: ${{ secrets.SUPABASE_ACCESS_TOKEN }}
```

---

## 6. Use Cases for Lynia Finance

### 6.1 Payment Gateway Webhooks

```typescript
// supabase/functions/payment-webhook/index.ts
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';
import { z } from 'npm:zod@3.22.0';

const PaymentSchema = z.object({
  reference: z.string(),
  amount: z.number().positive(),
  phone: z.string().regex(/^\+263\d{9}$/),
  status: z.enum(['success', 'failed']),
});

serve(async (req: Request) => {
  try {
    const payload = await req.json();
    const { reference, amount, phone, status } = PaymentSchema.parse(payload);

    // Use service role to update payment status
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    if (status === 'success') {
      // Update loan payment
      const { data: payment } = await supabase
        .from('payments')
        .update({ status: 'confirmed', confirmed_at: new Date().toISOString() })
        .eq('reference', reference)
        .select()
        .single();

      // Send confirmation SMS
      const response = await fetch(
        `${Deno.env.get('SUPABASE_URL')}/functions/v1/send-sms`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${Deno.env.get('SUPABASE_ANON_KEY')}`,
          },
          body: JSON.stringify({
            to: phone,
            message: `Payment received! Your $${amount} payment has been confirmed.`,
          }),
        }
      );

      return new Response(JSON.stringify({ success: true, payment }), {
        status: 200,
      });
    }

    return new Response(JSON.stringify({ success: false }), { status: 400 });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
    });
  }
});
```

### 6.2 SMS Sending Function

```typescript
// supabase/functions/send-sms/index.ts
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import AfricasTalking from 'npm:africastalking@0.6.3';

const africastalking = AfricasTalking({
  apiKey: Deno.env.get('AFRICASTALKING_API_KEY') ?? '',
  username: Deno.env.get('AFRICASTALKING_USERNAME') ?? '',
});

const sms = africastalking.SMS;

serve(async (req: Request) => {
  const { to, message } = await req.json();

  try {
    const result = await sms.send({ to: [to], message });

    return new Response(JSON.stringify({ success: true, result }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
    });
  }
});
```

### 6.3 KYC Callback Handler

```typescript
// supabase/functions/kyc-callback/index.ts
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

serve(async (req: Request) => {
  const payload = await req.json();

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  // Extract DIDIT response
  const { job_id, ResultCode, ResultText, IDInfo } = payload;

  if (ResultCode === '1012') {
    // KYC successful
    await supabase
      .from('kyc_verifications')
      .update({
        status: 'verified',
        result_code: ResultCode,
        id_info: IDInfo,
        verified_at: new Date().toISOString(),
      })
      .eq('job_id', job_id);

    return new Response(JSON.stringify({ success: true }), { status: 200 });
  } else {
    // KYC failed
    await supabase
      .from('kyc_verifications')
      .update({
        status: 'failed',
        result_code: ResultCode,
        result_text: ResultText,
      })
      .eq('job_id', job_id);

    return new Response(JSON.stringify({ success: false }), { status: 400 });
  }
});
```

---

## 7. Pricing & Limits

### 7.1 Free Tier

| Metric | Free Tier | Overage Cost |
|--------|-----------|--------------|
| **Function Invocations** | 500K/month | $2 per 1M invocations |
| **Function Execution Time** | 400K GB-seconds/month | $0.00001667 per GB-second |
| **Bandwidth** | 50 GB/month | $0.09 per GB |
| **Edge Functions** | Unlimited | N/A |

### 7.2 Lynia Finance Estimate (500 loans/month)

| Use Case | Invocations/Month | Execution Time (avg) | Cost |
|----------|-------------------|----------------------|------|
| **Payment Webhooks** | 2,000 (4 payments × 500 loans) | 200ms | Free |
| **SMS Sending** | 2,000 | 150ms | Free |
| **KYC Callbacks** | 500 (1 per loan) | 300ms | Free |
| **Daily Reminders** | 15,000 (30 customers × 500 days) | 100ms | Free |
| **Device Lock/Unlock** | 1,000 | 250ms | Free |
| **TOTAL** | **20,500/month** | - | **$0** ✅ |

**Conclusion**: Lynia Finance will stay **well within free tier** (500K invocations/month).

### 7.3 Cost at Scale (5,000 loans/month)

| Use Case | Invocations/Month | Cost |
|----------|-------------------|------|
| **Payment Webhooks** | 20,000 | Free |
| **SMS Sending** | 20,000 | Free |
| **KYC Callbacks** | 5,000 | Free |
| **Daily Reminders** | 150,000 | Free |
| **Device Lock/Unlock** | 10,000 | Free |
| **TOTAL** | **205,000/month** | **$0** ✅ |

Even at 10x scale, **still free**.

---

## 8. Implementation Examples

### 8.1 Scheduled Daily Reminders (Cron Job)

See next task (T036) for cron job details. Preview:

```typescript
// supabase/functions/daily-reminders/index.ts
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

serve(async (req: Request) => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  // Find customers with payments due tomorrow
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);

  const { data: loans } = await supabase
    .from('loans')
    .select('*, customers(phone)')
    .eq('status', 'active')
    .eq('next_payment_date', tomorrow.toISOString().split('T')[0]);

  // Send SMS reminders
  for (const loan of loans ?? []) {
    await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/send-sms`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${Deno.env.get('SUPABASE_ANON_KEY')}`,
      },
      body: JSON.stringify({
        to: loan.customers.phone,
        message: `Reminder: Your loan payment of $${loan.monthly_payment} is due tomorrow.`,
      }),
    });
  }

  return new Response(JSON.stringify({ sent: loans?.length ?? 0 }), {
    status: 200,
  });
});
```

### 8.2 Request Validation with Zod

```typescript
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { z } from 'npm:zod@3.22.0';

const CreateLoanSchema = z.object({
  customer_id: z.string().uuid(),
  device_id: z.string().uuid(),
  loan_amount: z.number().positive().max(500),
  term_months: z.number().int().min(3).max(12),
});

serve(async (req: Request) => {
  try {
    const payload = await req.json();
    const validatedData = CreateLoanSchema.parse(payload);

    // Proceed with validated data
    // ...

    return new Response(JSON.stringify({ success: true }), { status: 200 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return new Response(JSON.stringify({ errors: error.errors }), {
        status: 400,
      });
    }

    return new Response(JSON.stringify({ error: 'Internal error' }), {
      status: 500,
    });
  }
});
```

### 8.3 CORS Headers for Client Access

```typescript
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    });
  }

  // Your logic here
  const result = { message: 'Hello from Edge Function' };

  return new Response(JSON.stringify(result), {
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
  });
});
```

---

## 9. Summary

### 9.1 Key Takeaways

✅ **Deno Runtime**: Modern, TypeScript-first, secure by default
✅ **NPM Support**: Import packages directly with `npm:` specifier
✅ **Supabase Integration**: Built-in client with RLS enforcement
✅ **Free Tier**: 500K invocations/month (sufficient for 10K+ loans/month)
✅ **Fast Cold Starts**: <100ms (ideal for webhooks)
✅ **Global Deployment**: 35+ regions (low latency worldwide)
✅ **No Build Step**: Write TypeScript, deploy immediately

### 9.2 Recommended Architecture for Lynia Finance

```
┌─────────────────────────────────────────────────────────────────┐
│                    EDGE FUNCTIONS ARCHITECTURE                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────┐     ┌──────────────┐     ┌──────────────┐    │
│  │   Webhooks   │     │   Scheduled  │     │  API Routes  │    │
│  │              │     │     Jobs     │     │              │    │
│  ├──────────────┤     ├──────────────┤     ├──────────────┤    │
│  │ payment-     │     │ daily-       │     │ send-sms     │    │
│  │ webhook      │     │ reminders    │     │              │    │
│  │              │     │              │     │ verify-kyc   │    │
│  │ kyc-callback │     │ weekly-      │     │              │    │
│  │              │     │ commissions  │     │ lock-device  │    │
│  │ sms-callback │     │              │     │              │    │
│  └──────────────┘     │ monthly-     │     │ unlock-      │    │
│                       │ reports      │     │ device       │    │
│                       └──────────────┘     └──────────────┘    │
│                                                                  │
│                     All connected to Supabase DB                │
│                     (RLS enforced for security)                 │
└─────────────────────────────────────────────────────────────────┘
```

### 9.3 Next Steps

- [ ] Deploy first Edge Function (payment-webhook)
- [ ] Set up environment variables for APIs (Twilio, Africa's Talking, DIDIT)
- [ ] Test locally with `supabase functions serve`
- [ ] Configure CORS for client access
- [ ] Set up CI/CD with GitHub Actions

---

**Status**: ✅ T035 Complete
**Next Task**: T036 - Research Edge Functions cron jobs (weekly commissions, daily reminders)
**Related**: T034 (Realtime latency), T036-T039 (Edge Functions use cases)
