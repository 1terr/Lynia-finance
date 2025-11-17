# T032-T033: Supabase Realtime - Database Changes & Row Level Security

**Task IDs**: T032 (GitHub Issue #44), T033 (GitHub Issue #45)
**Phase**: Phase 0 - Research
**Date**: 2025-11-14
**Status**: ✅ Completed

---

## Executive Summary

Supabase Realtime provides **WebSocket-based real-time features** for PostgreSQL databases, enabling Lynia Finance to build live-updating dashboards, instant notifications, and collaborative features. The system offers three core capabilities: **Postgres Changes** (database event listeners), **Broadcast** (client-to-client messaging), and **Presence** (state synchronization), all secured via **Row Level Security (RLS)** policies.

**Key Use Cases for Lynia**:
- Live inventory updates (device availability)
- Real-time payment status (EcoCash/O'mari webhooks → instant UI updates)
- Staff dashboard (loan applications, KYC queue, collection status)
- Customer notifications (payment confirmations, device ready alerts)

**Cost**: Free tier includes 500,000 messages/month (sufficient for 10,000+ loans/month)

---

## Table of Contents

1. [Supabase Realtime Overview](#1-supabase-realtime-overview)
2. [Postgres Changes (Database Listeners)](#2-postgres-changes-database-listeners)
3. [Row Level Security (RLS) Integration](#3-row-level-security-rls-integration)
4. [Broadcast Channels](#4-broadcast-channels)
5. [Presence (State Synchronization)](#5-presence-state-synchronization)
6. [Implementation for Lynia Finance](#6-implementation-for-lynia-finance)
7. [Performance & Scaling](#7-performance--scaling)
8. [Security Best Practices](#8-security-best-practices)

---

## 1. Supabase Realtime Overview

### What is Supabase Realtime?

**Supabase Realtime** is a WebSocket server that broadcasts PostgreSQL changes to authorized clients in real-time. Built on Elixir/Phoenix, it scales horizontally and supports millions of concurrent connections.

### Architecture

```
┌──────────────────────────────────────────────────┐
│         Supabase Realtime Architecture           │
├──────────────────────────────────────────────────┤
│                                                  │
│  Client (Browser/Mobile)                         │
│  └─ WebSocket connection                         │
│       ↓                                          │
│  Supabase Realtime Server (Elixir/Phoenix)       │
│  ├─ Channel management                           │
│  ├─ Authorization (RLS enforcement)              │
│  └─ Message routing                              │
│       ↓                                          │
│  PostgreSQL Database                             │
│  ├─ Logical replication slot                     │
│  ├─ WAL (Write-Ahead Log)                        │
│  └─ RLS policies                                 │
│                                                  │
└──────────────────────────────────────────────────┘
```

### Three Core Features

| Feature | Purpose | Use Case (Lynia) |
|---------|---------|------------------|
| **Postgres Changes** | Listen to INSERT/UPDATE/DELETE events | Live inventory, payment status updates |
| **Broadcast** | Send messages between clients | Staff chat, customer notifications |
| **Presence** | Track online users & shared state | Staff online status, active customers |

---

## 2. Postgres Changes (Database Listeners)

### Overview

**Postgres Changes** allows clients to subscribe to database events (INSERT, UPDATE, DELETE) in real-time via WebSockets.

### How It Works

```
1. Client subscribes to table changes
   └─ supabase.channel('inventory').on('postgres_changes', {...})

2. Database row inserted/updated/deleted
   └─ INSERT INTO devices (model, stock) VALUES ('Galaxy A04', 5)

3. PostgreSQL WAL captures change
   └─ Write-Ahead Log records transaction

4. Realtime server detects change
   └─ Logical replication slot streams WAL

5. RLS policy checked
   └─ Does user have SELECT permission on this row?

6. Change broadcast to authorized clients
   └─ WebSocket message sent to subscribed clients
```

### Event Types

```javascript
// Subscribe to specific event type
const channel = supabase
  .channel('table-changes')
  .on(
    'postgres_changes',
    {
      event: 'INSERT',    // 'INSERT', 'UPDATE', 'DELETE', or '*' for all
      schema: 'public',   // Database schema
      table: 'devices',   // Table name
      filter: 'stock=eq.0' // Optional filter
    },
    (payload) => {
      console.log('Change detected:', payload);
    }
  )
  .subscribe();
```

### Payload Structure

#### INSERT Event

```json
{
  "schema": "public",
  "table": "devices",
  "commit_timestamp": "2025-11-14T10:30:00Z",
  "eventType": "INSERT",
  "new": {
    "id": "abc123",
    "model": "Samsung Galaxy A04",
    "stock": 5,
    "price": 200.00,
    "created_at": "2025-11-14T10:30:00Z"
  },
  "old": {},
  "errors": null
}
```

#### UPDATE Event

```json
{
  "schema": "public",
  "table": "devices",
  "commit_timestamp": "2025-11-14T11:00:00Z",
  "eventType": "UPDATE",
  "new": {
    "id": "abc123",
    "model": "Samsung Galaxy A04",
    "stock": 3,    // Changed from 5 to 3
    "price": 200.00,
    "updated_at": "2025-11-14T11:00:00Z"
  },
  "old": {
    "id": "abc123",
    "stock": 5     // Previous value (requires REPLICA IDENTITY FULL)
  },
  "errors": null
}
```

#### DELETE Event

```json
{
  "schema": "public",
  "table": "devices",
  "commit_timestamp": "2025-11-14T12:00:00Z",
  "eventType": "DELETE",
  "new": {},
  "old": {
    "id": "abc123",
    "model": "Samsung Galaxy A04",
    "stock": 3,
    "price": 200.00
  },
  "errors": null
}
```

### Enabling Realtime

By default, Realtime is **disabled** for new tables. Enable it via SQL:

```sql
-- Enable Realtime for devices table
ALTER PUBLICATION supabase_realtime ADD TABLE devices;

-- Enable full row data for UPDATEs and DELETEs (includes "old" values)
ALTER TABLE devices REPLICA IDENTITY FULL;
```

Or via Supabase Dashboard:
```
Database > Replication > Enable Realtime for "devices" table
```

### Subscription Examples

#### Example 1: Live Inventory Updates

```javascript
// components/InventoryDashboard.jsx
import { useEffect, useState } from 'react';
import { supabase } from './supabaseClient';

function InventoryDashboard() {
  const [devices, setDevices] = useState([]);

  useEffect(() => {
    // Fetch initial data
    fetchDevices();

    // Subscribe to real-time changes
    const channel = supabase
      .channel('inventory-changes')
      .on(
        'postgres_changes',
        {
          event: '*',  // Listen to all events
          schema: 'public',
          table: 'devices'
        },
        (payload) => {
          console.log('Device change:', payload);

          if (payload.eventType === 'INSERT') {
            setDevices((prev) => [...prev, payload.new]);
          } else if (payload.eventType === 'UPDATE') {
            setDevices((prev) =>
              prev.map((device) =>
                device.id === payload.new.id ? payload.new : device
              )
            );
          } else if (payload.eventType === 'DELETE') {
            setDevices((prev) =>
              prev.filter((device) => device.id !== payload.old.id)
            );
          }
        }
      )
      .subscribe();

    // Cleanup on unmount
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  async function fetchDevices() {
    const { data } = await supabase.from('devices').select('*');
    setDevices(data);
  }

  return (
    <div>
      <h2>Live Inventory</h2>
      <ul>
        {devices.map((device) => (
          <li key={device.id}>
            {device.model} - Stock: {device.stock}
          </li>
        ))}
      </ul>
    </div>
  );
}
```

#### Example 2: Payment Status Updates

```javascript
// Listen for payment confirmations
const paymentChannel = supabase
  .channel('payment-updates')
  .on(
    'postgres_changes',
    {
      event: 'UPDATE',
      schema: 'public',
      table: 'payments',
      filter: `customer_id=eq.${customerId}`  // Only this customer's payments
    },
    (payload) => {
      if (payload.new.status === 'CONFIRMED') {
        showNotification('Payment received! Your device is being prepared.');
        updateUI(payload.new);
      }
    }
  )
  .subscribe();
```

#### Example 3: KYC Queue (Staff Dashboard)

```javascript
// Staff dashboard: Listen for new KYC applications
const kycChannel = supabase
  .channel('kyc-queue')
  .on(
    'postgres_changes',
    {
      event: 'INSERT',
      schema: 'public',
      table: 'customers',
      filter: 'kyc_status=eq.PENDING'
    },
    (payload) => {
      // New customer needs KYC verification
      playNotificationSound();
      addToKYCQueue(payload.new);
    }
  )
  .subscribe();
```

### Filtering

Use PostgreSQL operators in the `filter` parameter:

```javascript
// Equality
filter: 'status=eq.PENDING'

// Greater than
filter: 'stock=gt.0'

// In array
filter: 'tier=in.(SILVER,GOLD)'

// Not equal
filter: 'status=neq.CANCELLED'

// Multiple filters (AND)
filter: 'status=eq.ACTIVE&stock=gt.0'
```

---

## 3. Row Level Security (RLS) Integration

### Overview

**RLS policies** control which database changes are broadcast to which clients. Only rows the user can SELECT are sent via Realtime.

### How RLS Works with Realtime

```
1. Database change occurs
   └─ INSERT INTO loans (customer_id, amount) VALUES ('user123', 200)

2. Realtime server detects change
   └─ WAL log entry captured

3. RLS policy evaluated FOR EACH SUBSCRIBED CLIENT
   ├─ Client A (user123): SELECT permission? YES → Send change
   ├─ Client B (user456): SELECT permission? NO → Block change
   └─ Client C (admin): SELECT permission? YES → Send change

4. Authorized clients receive update
   └─ Only clients with SELECT access receive the row
```

### Setting Up RLS for Realtime

#### Step 1: Enable RLS

```sql
-- Enable RLS on table
ALTER TABLE loans ENABLE ROW LEVEL SECURITY;
```

#### Step 2: Create RLS Policies

```sql
-- Policy: Customers can only see their own loans
CREATE POLICY "Customers see own loans"
ON loans
FOR SELECT
TO authenticated
USING (
  customer_id = auth.uid()
);

-- Policy: Staff can see all loans
CREATE POLICY "Staff see all loans"
ON loans
FOR SELECT
TO authenticated
USING (
  auth.jwt() ->> 'role' = 'staff'
);
```

#### Step 3: Subscribe with Authentication

```javascript
// Client-side: Subscribe with JWT token
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://your-project.supabase.co',
  'your-anon-key'
);

// Sign in (generates JWT)
await supabase.auth.signInWithPassword({
  email: 'customer@example.com',
  password: 'password'
});

// Subscribe to loans (RLS enforced automatically)
const channel = supabase
  .channel('my-loans')
  .on(
    'postgres_changes',
    {
      event: '*',
      schema: 'public',
      table: 'loans'
    },
    (payload) => {
      // Only receives changes for loans where customer_id matches auth.uid()
      console.log('My loan updated:', payload);
    }
  )
  .subscribe();
```

### Private Channels

For **Broadcast** and **Presence** (not Postgres Changes), use private channels with RLS:

```sql
-- Enable RLS on realtime.messages table
ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;

-- Policy: Only allow users in same room
CREATE POLICY "Staff can join staff-room"
ON realtime.messages
FOR INSERT
TO authenticated
USING (
  auth.jwt() ->> 'role' = 'staff' AND
  realtime.topic() = 'staff-room'
);
```

```javascript
// Client must explicitly mark channel as private
const privateChannel = supabase
  .channel('staff-room', {
    config: { private: true }  // Enforces RLS on realtime.messages
  })
  .subscribe();
```

### Example: Customer-Specific Realtime Updates

```sql
-- Customers table with RLS
CREATE TABLE customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users NOT NULL,
  name TEXT,
  kyc_status TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE customers ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see their own customer record
CREATE POLICY "Users see own customer"
ON customers
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- Enable Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE customers;
```

```javascript
// Frontend: Customer only receives their own KYC updates
const { data: { user } } = await supabase.auth.getUser();

const channel = supabase
  .channel('my-kyc-status')
  .on(
    'postgres_changes',
    {
      event: 'UPDATE',
      schema: 'public',
      table: 'customers'
      // No filter needed - RLS automatically restricts to user's own record
    },
    (payload) => {
      if (payload.new.kyc_status === 'VERIFIED') {
        showSuccessMessage('KYC approved! You can now apply for a loan.');
      }
    }
  )
  .subscribe();
```

---

## 4. Broadcast Channels

### Overview

**Broadcast** allows clients to send messages to other clients subscribed to the same channel, without storing messages in the database.

### Use Cases

- Staff chat
- Real-time notifications (push alerts without page refresh)
- Collaborative editing (though Presence is better for this)

### Example: Staff Notifications

```javascript
// Staff A: Send notification to all staff
const staffChannel = supabase
  .channel('staff-notifications')
  .on('broadcast', { event: 'new-application' }, (payload) => {
    console.log('New application:', payload);
    showDesktopNotification(payload.message);
  })
  .subscribe();

// Trigger notification
staffChannel.send({
  type: 'broadcast',
  event: 'new-application',
  payload: {
    customerId: 'abc123',
    customerName: 'John Doe',
    message: 'New loan application from John Doe'
  }
});

// Staff B and C receive notification instantly
```

---

## 5. Presence (State Synchronization)

### Overview

**Presence** tracks online users and synchronizes shared state across clients (e.g., "who's online", "who's typing").

### Example: Staff Online Status

```javascript
const staffPresenceChannel = supabase
  .channel('staff-presence')
  .on('presence', { event: 'sync' }, () => {
    const state = staffPresenceChannel.presenceState();
    console.log('Online staff:', state);
    updateOnlineStaffList(state);
  })
  .on('presence', { event: 'join' }, ({ key, newPresences }) => {
    console.log('Staff joined:', newPresences);
  })
  .on('presence', { event: 'leave' }, ({ key, leftPresences }) => {
    console.log('Staff left:', leftPresences);
  })
  .subscribe(async (status) => {
    if (status === 'SUBSCRIBED') {
      // Track this staff member
      await staffPresenceChannel.track({
        user_id: currentUser.id,
        name: currentUser.name,
        role: 'staff',
        online_at: new Date().toISOString()
      });
    }
  });
```

---

## 6. Implementation for Lynia Finance

### Use Case 1: Live Inventory Dashboard

**Requirement**: Show real-time device availability to customers browsing devices.

```javascript
// pages/devices.jsx
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

function DeviceCatalog() {
  const [devices, setDevices] = useState([]);

  useEffect(() => {
    fetchDevices();

    // Subscribe to inventory changes
    const channel = supabase
      .channel('device-inventory')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'devices',
          filter: 'stock=gt.0'  // Only show devices in stock
        },
        (payload) => {
          setDevices((prev) =>
            prev.map((d) =>
              d.id === payload.new.id ? { ...d, stock: payload.new.stock } : d
            )
          );

          // Show notification if stock changed significantly
          if (payload.old.stock > 0 && payload.new.stock === 0) {
            showToast(`${payload.new.model} is now out of stock`);
          }
        }
      )
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, []);

  async function fetchDevices() {
    const { data } = await supabase
      .from('devices')
      .select('*')
      .gt('stock', 0);
    setDevices(data);
  }

  return (
    <div className="device-grid">
      {devices.map((device) => (
        <DeviceCard key={device.id} device={device} />
      ))}
    </div>
  );
}
```

### Use Case 2: Payment Status Tracking

**Requirement**: Update customer UI instantly when payment is confirmed (EcoCash/O'mari webhook → database → customer UI).

```javascript
// components/PaymentStatus.jsx
function PaymentStatus({ paymentId }) {
  const [payment, setPayment] = useState(null);

  useEffect(() => {
    fetchPayment();

    const channel = supabase
      .channel(`payment-${paymentId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'payments',
          filter: `id=eq.${paymentId}`
        },
        (payload) => {
          setPayment(payload.new);

          if (payload.new.status === 'CONFIRMED') {
            // Show success animation
            confetti();
            setTimeout(() => {
              router.push('/device-selection');
            }, 2000);
          } else if (payload.new.status === 'FAILED') {
            showErrorModal(payload.new.failure_reason);
          }
        }
      )
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [paymentId]);

  async function fetchPayment() {
    const { data } = await supabase
      .from('payments')
      .select('*')
      .eq('id', paymentId)
      .single();
    setPayment(data);
  }

  return (
    <div>
      {payment?.status === 'PENDING' && <Spinner text="Waiting for payment..." />}
      {payment?.status === 'CONFIRMED' && <SuccessMessage />}
      {payment?.status === 'FAILED' && <ErrorMessage reason={payment.failure_reason} />}
    </div>
  );
}
```

### Use Case 3: Staff KYC Queue

**Requirement**: Staff dashboard shows live queue of customers pending KYC verification.

```javascript
// pages/staff/kyc-queue.jsx
function KYCQueue() {
  const [queue, setQueue] = useState([]);

  useEffect(() => {
    fetchQueue();

    const channel = supabase
      .channel('kyc-queue')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'customers',
          filter: 'kyc_status=eq.PENDING'
        },
        (payload) => {
          // New customer needs verification
          setQueue((prev) => [payload.new, ...prev]);
          playNotificationSound();
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'customers'
        },
        (payload) => {
          if (payload.new.kyc_status !== 'PENDING') {
            // Customer KYC completed, remove from queue
            setQueue((prev) => prev.filter((c) => c.id !== payload.new.id));
          }
        }
      )
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, []);

  async function fetchQueue() {
    const { data } = await supabase
      .from('customers')
      .select('*')
      .eq('kyc_status', 'PENDING')
      .order('created_at', { ascending: true });
    setQueue(data);
  }

  return (
    <div>
      <h2>KYC Queue ({queue.length})</h2>
      <ul>
        {queue.map((customer) => (
          <li key={customer.id}>
            <strong>{customer.name}</strong> - Applied {formatRelative(customer.created_at)}
            <button onClick={() => verifyKYC(customer.id)}>Verify Now</button>
          </li>
        ))}
      </ul>
    </div>
  );
}
```

---

## 7. Performance & Scaling

### Free Tier Limits

| Metric | Free Tier | Pro Tier ($25/month) |
|--------|-----------|---------------------|
| **Messages** | 500,000/month | Unlimited |
| **Concurrent Connections** | 200 | 500 |
| **Max Message Size** | 250 KB | 3 MB |

**Lynia Estimate** (500 loans/month):
- 500 loans × 10 updates/loan = **5,000 messages/month**
- **10x under free tier limit** ✅

### Optimization Tips

#### 1. Use Filters to Reduce Traffic

```javascript
// ❌ Bad: Receive all payments, filter client-side
const channel = supabase
  .channel('all-payments')
  .on('postgres_changes', { event: '*', schema: 'public', table: 'payments' }, ...)
  .subscribe();

// ✅ Good: Only receive relevant payments
const channel = supabase
  .channel('my-payments')
  .on('postgres_changes', {
    event: '*',
    schema: 'public',
    table: 'payments',
    filter: `customer_id=eq.${customerId}`  // Server-side filter
  }, ...)
  .subscribe();
```

#### 2. Unsubscribe When Not Needed

```javascript
useEffect(() => {
  const channel = supabase.channel('data').on(...).subscribe();

  // Clean up when component unmounts
  return () => {
    supabase.removeChannel(channel);
  };
}, []);
```

#### 3. Batch Updates (Postgres Trigger)

Instead of broadcasting every INSERT, batch updates every 5 seconds:

```sql
CREATE OR REPLACE FUNCTION batch_inventory_updates()
RETURNS TRIGGER AS $$
BEGIN
  -- Only broadcast if stock changed significantly (> 5 units)
  IF ABS(NEW.stock - OLD.stock) > 5 THEN
    RETURN NEW;
  END IF;
  RETURN NULL;  -- Don't broadcast
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER inventory_batch_trigger
AFTER UPDATE ON devices
FOR EACH ROW
EXECUTE FUNCTION batch_inventory_updates();
```

---

## 8. Security Best Practices

### 1. Always Enable RLS

```sql
-- ❌ Dangerous: No RLS = all clients see all data
ALTER TABLE sensitive_data DISABLE ROW LEVEL SECURITY;

-- ✅ Safe: RLS enabled
ALTER TABLE sensitive_data ENABLE ROW LEVEL SECURITY;
```

### 2. Use Private Channels for Sensitive Data

```javascript
// ✅ Private channel with RLS enforcement
const channel = supabase
  .channel('staff-only', {
    config: { private: true }
  })
  .subscribe();
```

### 3. Validate Client Input

```javascript
// ❌ Don't trust client data
channel.send({
  type: 'broadcast',
  event: 'message',
  payload: userInput  // Could contain malicious data
});

// ✅ Sanitize and validate
channel.send({
  type: 'broadcast',
  event: 'message',
  payload: {
    message: sanitize(userInput.message),
    timestamp: new Date().toISOString()  // Server-controlled
  }
});
```

---

## Summary

Supabase Realtime provides production-ready WebSocket infrastructure for Lynia Finance's live features:

**Postgres Changes**: Real-time database event listeners (INSERT/UPDATE/DELETE) with RLS security
**Broadcast**: Client-to-client messaging for notifications and chat
**Presence**: Online status tracking for staff collaboration

**Implementation**: Simple JavaScript SDK with automatic RLS enforcement, free tier sufficient for 10,000+ loans/month, and production-ready with horizontal scaling.

**Recommended Use Cases**:
1. Live inventory dashboard (customer-facing)
2. Payment status tracking (instant confirmations)
3. Staff KYC queue (operational efficiency)
4. Device collection status (customer notifications)

**Cost**: Free tier (500K messages/month) covers early operations, scale to Pro ($25/month) at 500+ loans/month.

---

**Document Information**:
- **Created**: 2025-11-14
- **Author**: Research Team
- **Tasks**: T032 (Issue #44), T033 (Issue #45)
- **Phase**: Phase 0 - Research
- **Next Task**: T034 (Issue #46)
