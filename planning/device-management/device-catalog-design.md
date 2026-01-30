# P1-T032: Device Catalog Design

**Task ID:** P1-T032
**Section:** 1.6 Device Management Design
**Priority:** High
**Estimated Duration:** 6 hours
**Dependencies:** Database Schema (P1-T009), WhatsApp Interactive Components (P1-T003)
**Status:** In Progress

---

## Table of Contents

1. [Overview](#overview)
2. [Device Categories](#device-categories)
3. [Device Data Model](#device-data-model)
4. [Device Specifications](#device-specifications)
5. [Inventory Management](#inventory-management)
6. [Pricing Strategy](#pricing-strategy)
7. [Device Browsing Experience](#device-browsing-experience)
8. [Integration Points](#integration-points)
9. [Implementation](#implementation)

---

## 1. Overview

The Device Catalog is the core inventory system for Lynia Finance, managing all financed devices available to customers. It supports WhatsApp-based browsing, real-time availability tracking, dynamic pricing, and integrates with the credit scoring and loan systems.

### Business Goals

1. **Curated Selection**: 15-20 carefully selected devices (smartphones, feature phones) popular in Zimbabwe
2. **Affordable Entry**: Devices ranging from $100-$600 to serve Tier 1-3 customers
3. **Real-Time Availability**: Prevent overselling by tracking inventory across distributors
4. **Dynamic Pricing**: Adjust based on distributor costs, demand, and market conditions
5. **WhatsApp-Native Browsing**: Enable device discovery and selection via interactive messages

### Key Metrics

- **Average Device Price**: $250-$300
- **Most Popular Tier**: Tier 1 ($100-$250) - 60% of sales
- **Inventory Turnover**: 30-45 days
- **Stock-Out Rate**: <5% (maintain buffer stock)

---

## 2. Device Categories

### 2.1 Category Structure

**3 Primary Categories**:

1. **Smartphones** (70% of catalog)
   - Android devices (Samsung, Tecno, Infinix, Itel)
   - Price range: $150-$600
   - Target: Urban customers, higher credit tiers

2. **Feature Phones** (25% of catalog)
   - Basic phones with WhatsApp support (KaiOS)
   - Price range: $100-$180
   - Target: Rural customers, first-time buyers

3. **Tablets** (5% of catalog)
   - Budget Android tablets
   - Price range: $200-$400
   - Target: Students, small business owners

### 2.2 Brand Distribution

**Target Brand Mix** (based on Zimbabwe market share 2024):

| Brand | Market Share | Catalog % | Price Range | Notes |
|-------|--------------|-----------|-------------|-------|
| **Samsung** | 35% | 30% | $200-$600 | Premium tier, high demand |
| **Tecno** | 25% | 30% | $150-$350 | Best value, popular |
| **Infinix** | 15% | 20% | $150-$300 | Mid-range, growing |
| **Itel** | 10% | 10% | $100-$200 | Entry-level, budget |
| **Nokia/KaiOS** | 8% | 10% | $100-$180 | Feature phones |

---

## 3. Device Data Model

### 3.1 Database Schema

```sql
CREATE TABLE devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Basic info
  brand VARCHAR(50) NOT NULL,
  model VARCHAR(100) NOT NULL,
  category VARCHAR(50) NOT NULL,  -- 'smartphone', 'feature_phone', 'tablet'

  -- Specifications
  specs JSONB NOT NULL,  -- Detailed specs (see below)

  -- Pricing
  retail_price_usd DECIMAL(10,2) NOT NULL,
  cost_price_usd DECIMAL(10,2) NOT NULL,
  deposit_percentage DECIMAL(5,2) DEFAULT 20.00,  -- 20% default

  -- Inventory
  total_stock INT DEFAULT 0,
  available_stock INT DEFAULT 0,
  reserved_stock INT DEFAULT 0,
  sold_stock INT DEFAULT 0,

  -- Financing
  min_credit_tier INT NOT NULL,  -- 1, 2, or 3
  loan_term_months INT NOT NULL,  -- 3, 6, or 12
  monthly_payment_usd DECIMAL(10,2) NOT NULL,

  -- Metadata
  image_url TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  is_featured BOOLEAN DEFAULT FALSE,
  launch_date DATE,
  discontinue_date DATE,

  -- Audit
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT unique_device UNIQUE(brand, model)
);

CREATE INDEX idx_devices_category ON devices(category);
CREATE INDEX idx_devices_active ON devices(is_active) WHERE is_active = TRUE;
CREATE INDEX idx_devices_featured ON devices(is_featured) WHERE is_featured = TRUE;
CREATE INDEX idx_devices_price ON devices(retail_price_usd);
```

---

### 3.2 Device Specifications (JSONB)

```typescript
interface DeviceSpecs {
  // Display
  display: {
    size: string;          // e.g., "6.5 inches"
    resolution: string;    // e.g., "720x1600"
    type: string;          // e.g., "IPS LCD"
  };

  // Hardware
  processor: string;       // e.g., "MediaTek Helio G85"
  ram: string;             // e.g., "4GB"
  storage: string;         // e.g., "64GB"
  expandable_storage: boolean;

  // Camera
  camera: {
    rear: string;          // e.g., "50MP + 2MP"
    front: string;         // e.g., "8MP"
  };

  // Battery
  battery: {
    capacity: string;      // e.g., "5000mAh"
    fast_charging: boolean;
  };

  // Connectivity
  network: string;         // e.g., "4G LTE"
  wifi: boolean;
  bluetooth: string;       // e.g., "5.0"

  // Software
  os: string;              // e.g., "Android 12"

  // Physical
  weight: string;          // e.g., "195g"
  dimensions: string;      // e.g., "164.2 x 75.6 x 8.9 mm"
  colors: string[];        // e.g., ["Black", "Blue", "Green"]
}
```

**Example Device Record**:

```typescript
const samsungA14: Device = {
  id: '550e8400-e29b-41d4-a716-446655440000',
  brand: 'Samsung',
  model: 'Galaxy A14 5G',
  category: 'smartphone',

  specs: {
    display: {
      size: '6.6 inches',
      resolution: '1080x2408',
      type: 'PLS LCD'
    },
    processor: 'MediaTek Dimensity 700',
    ram: '4GB',
    storage: '128GB',
    expandable_storage: true,
    camera: {
      rear: '50MP + 2MP + 2MP',
      front: '13MP'
    },
    battery: {
      capacity: '5000mAh',
      fast_charging: true
    },
    network: '5G',
    wifi: true,
    bluetooth: '5.2',
    os: 'Android 13',
    weight: '202g',
    dimensions: '167.7 x 78.0 x 9.1 mm',
    colors: ['Black', 'Silver', 'Green']
  },

  retail_price_usd: 250.00,
  cost_price_usd: 200.00,
  deposit_percentage: 20.00,

  total_stock: 50,
  available_stock: 35,
  reserved_stock: 10,
  sold_stock: 5,

  min_credit_tier: 2,  // Tier 2 required ($350 limit)
  loan_term_months: 6,
  monthly_payment_usd: 45.00,

  image_url: 'https://cdn.lynia.finance/devices/samsung-a14.jpg',
  is_active: true,
  is_featured: true,
  launch_date: '2024-01-15',
  discontinue_date: null
};
```

---

## 4. Device Specifications

### 4.1 Minimum Device Requirements

**Smartphone Minimum Specs** (for WhatsApp compatibility):

- **OS**: Android 7.0+ or KaiOS 2.5+
- **RAM**: 2GB minimum (4GB preferred)
- **Storage**: 32GB minimum (64GB preferred)
- **Display**: 5.5" minimum
- **Battery**: 3000mAh minimum
- **Network**: 3G minimum (4G preferred)

**Feature Phone Requirements**:

- **OS**: KaiOS 2.5+ with WhatsApp support
- **Display**: 2.4" minimum
- **Battery**: 1500mAh minimum
- **Network**: 3G minimum

### 4.2 Prohibited Device Types

**NOT Financed** (too risky/low demand):

- Second-hand/refurbished devices
- Laptops/desktops
- Gaming consoles
- Smart watches
- Accessories (cases, chargers, etc.)
- Devices >$600 (too high risk for Phase 1)

---

## 5. Inventory Management

### 5.1 Stock Levels

```typescript
interface StockLevel {
  total_stock: number;        // Total units owned
  available_stock: number;    // Ready to sell
  reserved_stock: number;     // Pending loans (approved but not disbursed)
  sold_stock: number;         // Actively financed

  // Thresholds
  reorder_point: number;      // When to restock
  max_stock: number;          // Prevent overstocking
}

function calculateAvailableStock(device: Device): number {
  return device.total_stock - device.reserved_stock - device.sold_stock;
}

function shouldReorder(device: Device): boolean {
  const reorderPoint = device.total_stock * 0.2;  // 20% threshold
  return device.available_stock <= reorderPoint;
}
```

---

### 5.2 Stock Reservation

When loan is **approved** but not yet **disbursed**:

```typescript
async function reserveDevice(deviceId: string, loanId: string): Promise<void> {

  // Check stock availability
  const device = await getDevice(deviceId);

  if (device.available_stock < 1) {
    throw new Error('Device out of stock');
  }

  // Create reservation
  await supabase.from('device_reservations').insert({
    device_id: deviceId,
    loan_id: loanId,
    reserved_at: new Date(),
    expires_at: new Date(Date.now() + 48 * 60 * 60 * 1000),  // 48 hours
    status: 'active'
  });

  // Update stock
  await supabase.from('devices').update({
    available_stock: device.available_stock - 1,
    reserved_stock: device.reserved_stock + 1
  }).eq('id', deviceId);
}
```

**Reservation Expiry**: 48 hours (release if loan not disbursed)

```typescript
// Scheduled job (runs every hour)
async function releaseExpiredReservations(): Promise<void> {

  const { data: expired } = await supabase
    .from('device_reservations')
    .select('*, devices(*)')
    .eq('status', 'active')
    .lt('expires_at', new Date());

  for (const reservation of expired) {
    // Release stock
    await supabase.from('devices').update({
      available_stock: reservation.devices.available_stock + 1,
      reserved_stock: reservation.devices.reserved_stock - 1
    }).eq('id', reservation.device_id);

    // Mark reservation as expired
    await supabase.from('device_reservations').update({
      status: 'expired',
      expired_at: new Date()
    }).eq('id', reservation.id);
  }
}
```

---

### 5.3 Stock Replenishment

```typescript
interface StockOrder {
  order_id: string;
  distributor_id: string;
  devices: Array<{
    device_id: string;
    quantity: number;
    cost_price_usd: number;
  }>;
  total_cost_usd: number;
  status: 'pending' | 'ordered' | 'received' | 'cancelled';
  ordered_at: Date;
  expected_delivery_date: Date;
  received_at: Date | null;
}

async function createStockOrder(
  distributorId: string,
  devices: Array<{ device_id: string; quantity: number }>
): Promise<StockOrder> {

  // Create order
  const order: StockOrder = {
    order_id: generateOrderId(),
    distributor_id: distributorId,
    devices: devices,
    total_cost_usd: await calculateOrderCost(devices),
    status: 'pending',
    ordered_at: new Date(),
    expected_delivery_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),  // 7 days
    received_at: null
  };

  await supabase.from('stock_orders').insert(order);

  return order;
}

async function receiveStockOrder(orderId: string): Promise<void> {

  const { data: order } = await supabase
    .from('stock_orders')
    .select('*')
    .eq('order_id', orderId)
    .single();

  // Update device stock
  for (const item of order.devices) {
    await supabase.from('devices').update({
      total_stock: supabase.raw(`total_stock + ${item.quantity}`),
      available_stock: supabase.raw(`available_stock + ${item.quantity}`)
    }).eq('id', item.device_id);
  }

  // Mark order as received
  await supabase.from('stock_orders').update({
    status: 'received',
    received_at: new Date()
  }).eq('order_id', orderId);
}
```

---

## 6. Pricing Strategy

### 6.1 Retail Price Calculation

```typescript
function calculateRetailPrice(
  costPrice: number,
  category: string
): number {

  // Markup percentages
  const markups = {
    smartphone: 0.25,     // 25% markup
    feature_phone: 0.20,  // 20% markup
    tablet: 0.30          // 30% markup
  };

  const markup = markups[category] || 0.25;
  const retailPrice = costPrice * (1 + markup);

  // Round to nearest $10
  return Math.ceil(retailPrice / 10) * 10;
}
```

**Example**:
- Cost: $200
- Markup: 25%
- Retail: $200 × 1.25 = $250

---

### 6.2 Monthly Payment Calculation

```typescript
function calculateMonthlyPayment(
  retailPrice: number,
  depositPercentage: number,
  loanTermMonths: number,
  interestRate: number = 0.18  // 18% annual
): number {

  // Calculate financed amount
  const deposit = retailPrice * (depositPercentage / 100);
  const principal = retailPrice - deposit;

  // Simple interest calculation
  const monthlyInterestRate = interestRate / 12;
  const totalInterest = principal * interestRate * (loanTermMonths / 12);
  const totalRepayment = principal + totalInterest;

  const monthlyPayment = totalRepayment / loanTermMonths;

  // Round to nearest $5
  return Math.ceil(monthlyPayment / 5) * 5;
}
```

**Example** (Samsung A14):
- Retail: $250
- Deposit (20%): $50
- Principal: $200
- Term: 6 months
- Interest (18% APR): $18 (6 months)
- Total Repayment: $218
- **Monthly Payment**: $218 / 6 = **$36.33** → **$40** (rounded)

---

### 6.3 Dynamic Pricing

**Adjust prices based on**:

1. **Demand**: Increase popular devices by 5-10%
2. **Stock Level**: Discount slow-moving devices by 10-15%
3. **Seasonality**: Promotions during holidays (Christmas, back-to-school)
4. **Competition**: Match or beat competitor pricing

```typescript
async function applyDynamicPricing(): Promise<void> {

  // Get all active devices
  const { data: devices } = await supabase
    .from('devices')
    .select('*')
    .eq('is_active', true);

  for (const device of devices) {
    let adjustedPrice = device.retail_price_usd;

    // High demand: increase price
    const salesLast30Days = await getSalesCount(device.id, 30);
    if (salesLast30Days > 20) {
      adjustedPrice = adjustedPrice * 1.05;  // +5%
    }

    // Low stock: increase price
    if (device.available_stock < 5) {
      adjustedPrice = adjustedPrice * 1.10;  // +10%
    }

    // Slow-moving: decrease price
    if (salesLast30Days < 3 && device.available_stock > 10) {
      adjustedPrice = adjustedPrice * 0.90;  // -10%
    }

    // Update price if changed
    if (adjustedPrice !== device.retail_price_usd) {
      await supabase.from('devices').update({
        retail_price_usd: adjustedPrice,
        updated_at: new Date()
      }).eq('id', device.id);
    }
  }
}
```

---

## 7. Device Browsing Experience

### 7.1 WhatsApp List Message

```typescript
async function sendDeviceCatalog(phoneNumber: string, category?: string): Promise<void> {

  // Fetch devices
  let query = supabase
    .from('devices')
    .select('*')
    .eq('is_active', true)
    .gt('available_stock', 0);

  if (category) {
    query = query.eq('category', category);
  }

  const { data: devices } = await query.order('retail_price_usd', { ascending: true });

  // Create WhatsApp list message
  const listMessage = {
    type: 'interactive',
    interactive: {
      type: 'list',
      header: {
        type: 'text',
        text: '📱 Available Devices'
      },
      body: {
        text: `Browse our selection of ${devices.length} devices. Tap to view details.`
      },
      action: {
        button: 'Browse Devices',
        sections: [
          {
            title: 'Budget Devices ($100-$200)',
            rows: devices
              .filter(d => d.retail_price_usd <= 200)
              .map(d => ({
                id: d.id,
                title: `${d.brand} ${d.model}`,
                description: `$${d.retail_price_usd} • ${d.monthly_payment_usd}/month`
              }))
          },
          {
            title: 'Mid-Range Devices ($200-$400)',
            rows: devices
              .filter(d => d.retail_price_usd > 200 && d.retail_price_usd <= 400)
              .map(d => ({
                id: d.id,
                title: `${d.brand} ${d.model}`,
                description: `$${d.retail_price_usd} • ${d.monthly_payment_usd}/month`
              }))
          }
        ]
      }
    }
  };

  await whatsappService.sendMessage(phoneNumber, listMessage);
}
```

---

### 7.2 Device Detail View

When user selects a device:

```typescript
async function sendDeviceDetails(phoneNumber: string, deviceId: string): Promise<void> {

  const { data: device } = await supabase
    .from('devices')
    .select('*')
    .eq('id', deviceId)
    .single();

  const message = `
📱 *${device.brand} ${device.model}*

💰 *Price*: $${device.retail_price_usd}
📅 *Monthly Payment*: $${device.monthly_payment_usd} (${device.loan_term_months} months)
💵 *Deposit*: $${(device.retail_price_usd * device.deposit_percentage / 100).toFixed(2)} (${device.deposit_percentage}%)

📊 *Specifications*:
• Display: ${device.specs.display.size} ${device.specs.display.type}
• Processor: ${device.specs.processor}
• RAM: ${device.specs.ram}
• Storage: ${device.specs.storage}
• Camera: ${device.specs.camera.rear} (rear), ${device.specs.camera.front} (front)
• Battery: ${device.specs.battery.capacity}
• Network: ${device.specs.network}

✅ *In Stock*: ${device.available_stock} units available

Select an option:
  `.trim();

  const buttons = {
    type: 'interactive',
    interactive: {
      type: 'button',
      body: { text: message },
      action: {
        buttons: [
          {
            type: 'reply',
            reply: {
              id: `apply_${deviceId}`,
              title: 'Apply Now'
            }
          },
          {
            type: 'reply',
            reply: {
              id: 'browse_more',
              title: 'Browse More'
            }
          },
          {
            type: 'reply',
            reply: {
              id: 'main_menu',
              title: 'Main Menu'
            }
          }
        ]
      }
    }
  };

  await whatsappService.sendMessage(phoneNumber, buttons);
}
```

---

## 8. Integration Points

### 8.1 Credit Scoring Integration

```typescript
async function checkDeviceEligibility(
  customerId: string,
  deviceId: string
): Promise<{
  eligible: boolean;
  reason: string;
}> {

  const customer = await getCustomer(customerId);
  const device = await getDevice(deviceId);

  // Check credit tier
  if (customer.credit_tier < device.min_credit_tier) {
    return {
      eligible: false,
      reason: `This device requires Tier ${device.min_credit_tier}. Your current tier is ${customer.credit_tier}.`
    };
  }

  // Check credit limit
  if (customer.credit_limit < device.retail_price_usd) {
    return {
      eligible: false,
      reason: `Your credit limit ($${customer.credit_limit}) is below the device price ($${device.retail_price_usd}).`
    };
  }

  return {
    eligible: true,
    reason: 'You are eligible for this device!'
  };
}
```

---

### 8.2 Loan Creation Integration

When customer applies for device:

```typescript
async function createDeviceLoan(
  customerId: string,
  deviceId: string
): Promise<Loan> {

  const customer = await getCustomer(customerId);
  const device = await getDevice(deviceId);

  // Reserve device
  await reserveDevice(deviceId, null);  // Temporary reservation

  // Calculate loan terms
  const deposit = device.retail_price_usd * (device.deposit_percentage / 100);
  const principal = device.retail_price_usd - deposit;

  // Create loan
  const loan = await supabase.from('loans').insert({
    customer_id: customerId,
    device_id: deviceId,

    principal: principal,
    deposit_amount: deposit,
    loan_term_months: device.loan_term_months,
    monthly_installment: device.monthly_payment_usd,
    interest_rate: 0.18,  // 18% APR

    status: 'pending_approval',
    created_at: new Date()
  }).select().single();

  // Update reservation with loan ID
  await supabase.from('device_reservations')
    .update({ loan_id: loan.data.id })
    .eq('device_id', deviceId)
    .eq('status', 'active')
    .is('loan_id', null);

  return loan.data;
}
```

---

## 9. Implementation

### 9.1 API Endpoints

#### GET `/api/devices`

**Description**: List all active devices

**Query Parameters**:
- `category`: Filter by category (smartphone, feature_phone, tablet)
- `min_price`, `max_price`: Price range filter
- `brand`: Filter by brand
- `in_stock`: Only show in-stock devices (default: true)

**Response**:
```json
{
  "devices": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "brand": "Samsung",
      "model": "Galaxy A14 5G",
      "category": "smartphone",
      "retail_price_usd": 250.00,
      "monthly_payment_usd": 45.00,
      "available_stock": 35,
      "image_url": "https://cdn.lynia.finance/devices/samsung-a14.jpg"
    }
  ],
  "total": 15
}
```

---

#### GET `/api/devices/:id`

**Description**: Get device details

**Response**:
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "brand": "Samsung",
  "model": "Galaxy A14 5G",
  "category": "smartphone",
  "specs": { ... },
  "retail_price_usd": 250.00,
  "monthly_payment_usd": 45.00,
  "loan_term_months": 6,
  "available_stock": 35,
  "min_credit_tier": 2
}
```

---

#### POST `/api/devices/:id/check-eligibility`

**Description**: Check if customer is eligible for device

**Request**:
```json
{
  "customer_id": "customer-123"
}
```

**Response**:
```json
{
  "eligible": true,
  "reason": "You are eligible for this device!",
  "credit_tier": 2,
  "credit_limit": 350.00
}
```

---

## Summary

**Device Catalog Design Deliverables**:
- ✅ **Device Data Model**: Complete schema with specs, pricing, inventory
- ✅ **15-20 Device Catalog**: Curated selection across 3 categories
- ✅ **Inventory Management**: Stock tracking, reservations, replenishment
- ✅ **Dynamic Pricing**: Demand-based price adjustments
- ✅ **WhatsApp Browsing**: Interactive list messages for device discovery
- ✅ **Credit Integration**: Tier-based device eligibility

**Key Features**:
- Real-time stock availability
- 48-hour device reservations
- Automatic restocking alerts
- Mobile-first browsing experience

**Next Steps**: Implement Device Lock/Unlock Integration (P1-T033)
