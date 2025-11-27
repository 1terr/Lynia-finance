# Notification Delivery Tracking

**Epic**: Phase 1: Core Architecture & Platform Foundation
**Section**: 1.7 Notification System Design
**Task ID**: P1-T040
**Priority**: High
**Estimated Duration**: 6 hours

---

## 1. Overview

Comprehensive notification delivery tracking is essential for understanding customer engagement, optimizing notification strategies, and ensuring critical messages reach customers. This specification defines tracking mechanisms for all notification lifecycle stages (sent, delivered, read, clicked, converted) across all channels (WhatsApp, SMS, Email), along with analytics and reporting capabilities.

**Key Objectives**:
- Track delivery status for 100% of notifications
- Monitor read rates and engagement metrics
- Identify delivery failures and patterns
- Calculate cost per notification
- Optimize channel selection based on performance data
- Provide real-time delivery status to admins

**Tracking Lifecycle**: Queued → Sent → Delivered → Read → Clicked → Converted

---

## 2. Delivery Status Tracking

### 2.1 Notification Lifecycle States

```typescript
enum NotificationStatus {
  QUEUED = 'queued',           // Added to queue, not yet sent
  SENDING = 'sending',         // Currently being sent
  SENT = 'sent',               // Sent to provider, awaiting delivery confirmation
  DELIVERED = 'delivered',     // Confirmed delivered to device
  READ = 'read',               // Customer opened/read the message
  CLICKED = 'clicked',         // Customer clicked a button/link
  CONVERTED = 'converted',     // Customer completed desired action
  FAILED = 'failed',           // Failed to send
  EXPIRED = 'expired',         // Expired before delivery
  REJECTED = 'rejected'        // Rejected by provider (invalid number, etc.)
}

interface NotificationDeliveryStatus {
  delivery_id: string;
  notification_id: string;
  customer_id: string;
  template_id: string;
  channel: 'whatsapp' | 'sms' | 'email' | 'push';

  // Status timeline
  status: NotificationStatus;
  queued_at: Date;
  sent_at?: Date;
  delivered_at?: Date;
  read_at?: Date;
  clicked_at?: Date;
  converted_at?: Date;
  failed_at?: Date;
  expired_at?: Date;

  // Provider details
  provider: 'whatsapp_cloud_api' | 'africastalking' | 'sendgrid' | 'expo_push';
  provider_message_id?: string;
  provider_status?: string;

  // Failure tracking
  error_code?: string;
  error_message?: string;
  retry_count: number;

  // Cost tracking
  cost_usd: number;

  // Content snapshot
  content_sent: string;
  variables_used: Record<string, any>;

  created_at: Date;
  updated_at: Date;
}
```

### 2.2 Status Update Handler

```typescript
async function updateDeliveryStatus(
  deliveryId: string,
  newStatus: NotificationStatus,
  metadata?: {
    provider_message_id?: string;
    provider_status?: string;
    error_code?: string;
    error_message?: string;
  }
): Promise<void> {
  const now = new Date();
  const updateData: any = {
    status: newStatus,
    updated_at: now
  };

  // Set appropriate timestamp based on status
  switch (newStatus) {
    case NotificationStatus.SENT:
      updateData.sent_at = now;
      break;
    case NotificationStatus.DELIVERED:
      updateData.delivered_at = now;
      break;
    case NotificationStatus.READ:
      updateData.read_at = now;
      break;
    case NotificationStatus.CLICKED:
      updateData.clicked_at = now;
      break;
    case NotificationStatus.CONVERTED:
      updateData.converted_at = now;
      break;
    case NotificationStatus.FAILED:
      updateData.failed_at = now;
      break;
    case NotificationStatus.EXPIRED:
      updateData.expired_at = now;
      break;
  }

  // Add metadata if provided
  if (metadata) {
    Object.assign(updateData, metadata);
  }

  // Update database
  await supabase
    .from('notification_deliveries')
    .update(updateData)
    .eq('delivery_id', deliveryId);

  // Emit event for real-time tracking
  await emitDeliveryStatusEvent(deliveryId, newStatus);

  // Update aggregated metrics
  await updateDeliveryMetrics(deliveryId, newStatus);
}
```

---

## 3. Channel-Specific Tracking

### 3.1 WhatsApp Delivery Tracking

WhatsApp Cloud API provides webhook callbacks for delivery status updates:

```typescript
interface WhatsAppWebhookPayload {
  object: 'whatsapp_business_account';
  entry: {
    id: string;
    changes: {
      value: {
        messaging_product: 'whatsapp';
        metadata: {
          display_phone_number: string;
          phone_number_id: string;
        };
        statuses?: WhatsAppStatus[];
        messages?: WhatsAppInboundMessage[];
      };
      field: string;
    }[];
  }[];
}

interface WhatsAppStatus {
  id: string; // Message ID from Meta
  status: 'sent' | 'delivered' | 'read' | 'failed';
  timestamp: string;
  recipient_id: string;
  errors?: {
    code: number;
    title: string;
    message: string;
  }[];
}

// WhatsApp webhook endpoint
app.post('/webhooks/whatsapp', async (req, res) => {
  const payload: WhatsAppWebhookPayload = req.body;

  // Verify webhook signature
  const signature = req.headers['x-hub-signature-256'];
  if (!verifyWhatsAppSignature(signature, JSON.stringify(payload))) {
    return res.status(403).send('Invalid signature');
  }

  // Process status updates
  for (const entry of payload.entry) {
    for (const change of entry.changes) {
      const statuses = change.value.statuses;

      if (statuses) {
        for (const status of statuses) {
          await processWhatsAppStatus(status);
        }
      }

      const messages = change.value.messages;
      if (messages) {
        for (const message of messages) {
          await processInboundMessage(message);
        }
      }
    }
  }

  res.status(200).send('OK');
});

async function processWhatsAppStatus(status: WhatsAppStatus): Promise<void> {
  // Find delivery record by provider message ID
  const { data: delivery } = await supabase
    .from('notification_deliveries')
    .select('*')
    .eq('provider_message_id', status.id)
    .single();

  if (!delivery) {
    console.warn(`No delivery found for WhatsApp message ID: ${status.id}`);
    return;
  }

  // Map WhatsApp status to our status enum
  let newStatus: NotificationStatus;
  switch (status.status) {
    case 'sent':
      newStatus = NotificationStatus.SENT;
      break;
    case 'delivered':
      newStatus = NotificationStatus.DELIVERED;
      break;
    case 'read':
      newStatus = NotificationStatus.READ;
      break;
    case 'failed':
      newStatus = NotificationStatus.FAILED;
      break;
    default:
      return;
  }

  // Update delivery status
  await updateDeliveryStatus(delivery.delivery_id, newStatus, {
    provider_status: status.status,
    error_code: status.errors?.[0]?.code?.toString(),
    error_message: status.errors?.[0]?.message
  });
}
```

### 3.2 SMS Delivery Tracking (Africa's Talking)

```typescript
interface AfricasTalkingDLR {
  id: string; // Message ID
  status: 'Success' | 'Sent' | 'Buffered' | 'Rejected' | 'Failed';
  phoneNumber: string;
  networkCode: string;
  retryCount: number;
  failureReason?: string;
}

// Africa's Talking Delivery Report endpoint
app.post('/webhooks/africastalking/delivery', async (req, res) => {
  const dlr: AfricasTalkingDLR = req.body;

  // Find delivery record
  const { data: delivery } = await supabase
    .from('notification_deliveries')
    .select('*')
    .eq('provider_message_id', dlr.id)
    .single();

  if (!delivery) {
    return res.status(404).send('Delivery not found');
  }

  // Map Africa's Talking status to our status
  let newStatus: NotificationStatus;
  switch (dlr.status) {
    case 'Success':
      newStatus = NotificationStatus.DELIVERED;
      break;
    case 'Sent':
      newStatus = NotificationStatus.SENT;
      break;
    case 'Buffered':
      newStatus = NotificationStatus.SENDING;
      break;
    case 'Rejected':
      newStatus = NotificationStatus.REJECTED;
      break;
    case 'Failed':
      newStatus = NotificationStatus.FAILED;
      break;
    default:
      return res.status(200).send('OK');
  }

  await updateDeliveryStatus(delivery.delivery_id, newStatus, {
    provider_status: dlr.status,
    error_message: dlr.failureReason
  });

  res.status(200).send('OK');
});
```

### 3.3 Email Tracking (SendGrid)

```typescript
interface SendGridEvent {
  event: 'delivered' | 'open' | 'click' | 'bounce' | 'dropped' | 'deferred' | 'spam_report';
  email: string;
  timestamp: number;
  sg_message_id: string;
  url?: string; // For click events
  reason?: string; // For bounce/dropped events
}

// SendGrid webhook endpoint
app.post('/webhooks/sendgrid/events', async (req, res) => {
  const events: SendGridEvent[] = req.body;

  for (const event of events) {
    await processSendGridEvent(event);
  }

  res.status(200).send('OK');
});

async function processSendGridEvent(event: SendGridEvent): Promise<void> {
  const { data: delivery } = await supabase
    .from('notification_deliveries')
    .select('*')
    .eq('provider_message_id', event.sg_message_id)
    .single();

  if (!delivery) return;

  let newStatus: NotificationStatus;
  switch (event.event) {
    case 'delivered':
      newStatus = NotificationStatus.DELIVERED;
      break;
    case 'open':
      newStatus = NotificationStatus.READ;
      break;
    case 'click':
      newStatus = NotificationStatus.CLICKED;
      // Track which link was clicked
      await trackEmailClick(delivery.delivery_id, event.url);
      break;
    case 'bounce':
    case 'dropped':
      newStatus = NotificationStatus.FAILED;
      break;
    case 'deferred':
      newStatus = NotificationStatus.SENDING;
      break;
    case 'spam_report':
      newStatus = NotificationStatus.REJECTED;
      await handleSpamReport(delivery.customer_id);
      break;
    default:
      return;
  }

  await updateDeliveryStatus(delivery.delivery_id, newStatus, {
    provider_status: event.event,
    error_message: event.reason
  });
}

async function trackEmailClick(deliveryId: string, url: string): Promise<void> {
  await supabase.from('email_click_tracking').insert({
    delivery_id: deliveryId,
    url: url,
    clicked_at: new Date()
  });
}
```

---

## 4. Conversion Tracking

### 4.1 Tracking Desired Actions

```typescript
interface ConversionEvent {
  conversion_id: string;
  delivery_id: string;
  notification_id: string;
  customer_id: string;

  // Conversion details
  conversion_type: 'payment_made' | 'kyc_submitted' | 'loan_applied' | 'device_selected' | 'custom';
  conversion_value_usd?: number; // For payment conversions
  conversion_data?: Record<string, any>; // Additional metadata

  // Attribution
  time_to_conversion_minutes: number;
  converted_at: Date;
}

async function trackConversion(
  deliveryId: string,
  conversionType: string,
  conversionData?: Record<string, any>
): Promise<void> {
  const delivery = await getDelivery(deliveryId);

  if (!delivery) {
    console.warn(`Delivery ${deliveryId} not found for conversion tracking`);
    return;
  }

  // Calculate time to conversion
  const sentAt = delivery.sent_at || delivery.queued_at;
  const convertedAt = new Date();
  const timeToConversionMinutes = Math.floor(
    (convertedAt.getTime() - sentAt.getTime()) / (1000 * 60)
  );

  const conversion: ConversionEvent = {
    conversion_id: uuidv4(),
    delivery_id: deliveryId,
    notification_id: delivery.notification_id,
    customer_id: delivery.customer_id,
    conversion_type: conversionType as any,
    conversion_value_usd: conversionData?.amount_usd,
    conversion_data: conversionData,
    time_to_conversion_minutes: timeToConversionMinutes,
    converted_at: convertedAt
  };

  // Save conversion
  await supabase.from('notification_conversions').insert(conversion);

  // Update delivery status to converted
  await updateDeliveryStatus(deliveryId, NotificationStatus.CONVERTED);

  // Update conversion metrics
  await updateConversionMetrics(delivery.template_id, conversion);
}

// Example: Track payment conversion
async function onPaymentReceived(payment: Payment): Promise<void> {
  // Find most recent payment reminder sent to this customer
  const { data: reminder } = await supabase
    .from('payment_reminders_sent')
    .select('notification_id')
    .eq('customer_id', payment.customer_id)
    .eq('payment_id', payment.id)
    .order('sent_at', { ascending: false })
    .limit(1)
    .single();

  if (reminder?.notification_id) {
    const { data: delivery } = await supabase
      .from('notification_deliveries')
      .select('delivery_id')
      .eq('notification_id', reminder.notification_id)
      .single();

    if (delivery) {
      await trackConversion(delivery.delivery_id, 'payment_made', {
        amount_usd: payment.amount_usd,
        payment_method: payment.payment_method
      });
    }
  }
}
```

### 4.2 Attribution Windows

```typescript
interface AttributionWindow {
  conversion_type: string;
  window_minutes: number; // How long after notification to attribute conversion
}

const ATTRIBUTION_WINDOWS: AttributionWindow[] = [
  { conversion_type: 'payment_made', window_minutes: 24 * 60 }, // 24 hours
  { conversion_type: 'kyc_submitted', window_minutes: 48 * 60 }, // 48 hours
  { conversion_type: 'loan_applied', window_minutes: 7 * 24 * 60 }, // 7 days
  { conversion_type: 'device_selected', window_minutes: 48 * 60 } // 48 hours
];

function isWithinAttributionWindow(
  sentAt: Date,
  convertedAt: Date,
  conversionType: string
): boolean {
  const window = ATTRIBUTION_WINDOWS.find(w => w.conversion_type === conversionType);
  if (!window) return true; // Default to attributing

  const minutesSinceSent = (convertedAt.getTime() - sentAt.getTime()) / (1000 * 60);
  return minutesSinceSent <= window.window_minutes;
}
```

---

## 5. Analytics & Reporting

### 5.1 Delivery Metrics Dashboard

```typescript
interface DeliveryMetrics {
  period_start: Date;
  period_end: Date;

  total_notifications: number;
  total_cost_usd: number;

  // By status
  queued: number;
  sent: number;
  delivered: number;
  read: number;
  clicked: number;
  converted: number;
  failed: number;

  // Rates
  delivery_rate: number; // % of sent that were delivered
  read_rate: number; // % of delivered that were read
  click_rate: number; // % of read that were clicked
  conversion_rate: number; // % of delivered that converted

  // Performance
  avg_delivery_time_seconds: number;
  avg_time_to_read_minutes: number;
  avg_time_to_conversion_minutes: number;

  // By channel
  by_channel: {
    channel: string;
    count: number;
    delivered: number;
    read: number;
    converted: number;
    delivery_rate: number;
    read_rate: number;
    conversion_rate: number;
    avg_cost_usd: number;
  }[];

  // By template
  by_template: {
    template_id: string;
    template_name: string;
    count: number;
    delivered: number;
    read: number;
    converted: number;
    conversion_rate: number;
  }[];

  // By category
  by_category: {
    category: string;
    count: number;
    conversion_rate: number;
    total_cost_usd: number;
  }[];
}

async function generateDeliveryMetrics(
  startDate: Date,
  endDate: Date
): Promise<DeliveryMetrics> {
  const { data: deliveries } = await supabase
    .from('notification_deliveries')
    .select('*, notification_templates(*), notification_conversions(*)')
    .gte('created_at', startDate.toISOString())
    .lte('created_at', endDate.toISOString());

  if (!deliveries || deliveries.length === 0) {
    return emptyMetrics(startDate, endDate);
  }

  const total = deliveries.length;
  const delivered = deliveries.filter(d => d.status === 'delivered' || d.status === 'read' || d.status === 'clicked' || d.status === 'converted').length;
  const read = deliveries.filter(d => d.status === 'read' || d.status === 'clicked' || d.status === 'converted').length;
  const clicked = deliveries.filter(d => d.status === 'clicked' || d.status === 'converted').length;
  const converted = deliveries.filter(d => d.status === 'converted').length;

  // Calculate average times
  const deliveryTimes = deliveries
    .filter(d => d.sent_at && d.delivered_at)
    .map(d => (new Date(d.delivered_at).getTime() - new Date(d.sent_at).getTime()) / 1000);

  const timeToRead = deliveries
    .filter(d => d.delivered_at && d.read_at)
    .map(d => (new Date(d.read_at).getTime() - new Date(d.delivered_at).getTime()) / (1000 * 60));

  const timeToConversion = deliveries
    .filter(d => d.notification_conversions && d.notification_conversions.length > 0)
    .map(d => d.notification_conversions[0].time_to_conversion_minutes);

  // Group by channel
  const channels = ['whatsapp', 'sms', 'email'];
  const byChannel = channels.map(channel => {
    const channelDeliveries = deliveries.filter(d => d.channel === channel);
    const channelDelivered = channelDeliveries.filter(d => ['delivered', 'read', 'clicked', 'converted'].includes(d.status)).length;
    const channelRead = channelDeliveries.filter(d => ['read', 'clicked', 'converted'].includes(d.status)).length;
    const channelConverted = channelDeliveries.filter(d => d.status === 'converted').length;

    return {
      channel,
      count: channelDeliveries.length,
      delivered: channelDelivered,
      read: channelRead,
      converted: channelConverted,
      delivery_rate: channelDeliveries.length > 0 ? (channelDelivered / channelDeliveries.length) * 100 : 0,
      read_rate: channelDelivered > 0 ? (channelRead / channelDelivered) * 100 : 0,
      conversion_rate: channelDelivered > 0 ? (channelConverted / channelDelivered) * 100 : 0,
      avg_cost_usd: average(channelDeliveries.map(d => d.cost_usd))
    };
  });

  // Group by template
  const templates = [...new Set(deliveries.map(d => d.template_id))];
  const byTemplate = templates.map(templateId => {
    const templateDeliveries = deliveries.filter(d => d.template_id === templateId);
    const templateDelivered = templateDeliveries.filter(d => ['delivered', 'read', 'clicked', 'converted'].includes(d.status)).length;
    const templateRead = templateDeliveries.filter(d => ['read', 'clicked', 'converted'].includes(d.status)).length;
    const templateConverted = templateDeliveries.filter(d => d.status === 'converted').length;

    return {
      template_id: templateId,
      template_name: templateDeliveries[0]?.notification_templates?.template_name || 'Unknown',
      count: templateDeliveries.length,
      delivered: templateDelivered,
      read: templateRead,
      converted: templateConverted,
      conversion_rate: templateDelivered > 0 ? (templateConverted / templateDelivered) * 100 : 0
    };
  });

  return {
    period_start: startDate,
    period_end: endDate,
    total_notifications: total,
    total_cost_usd: deliveries.reduce((sum, d) => sum + (d.cost_usd || 0), 0),
    queued: deliveries.filter(d => d.status === 'queued').length,
    sent: deliveries.filter(d => d.status === 'sent').length,
    delivered: delivered,
    read: read,
    clicked: clicked,
    converted: converted,
    failed: deliveries.filter(d => d.status === 'failed').length,
    delivery_rate: total > 0 ? (delivered / total) * 100 : 0,
    read_rate: delivered > 0 ? (read / delivered) * 100 : 0,
    click_rate: read > 0 ? (clicked / read) * 100 : 0,
    conversion_rate: delivered > 0 ? (converted / delivered) * 100 : 0,
    avg_delivery_time_seconds: average(deliveryTimes),
    avg_time_to_read_minutes: average(timeToRead),
    avg_time_to_conversion_minutes: average(timeToConversion),
    by_channel: byChannel,
    by_template: byTemplate.sort((a, b) => b.conversion_rate - a.conversion_rate),
    by_category: []
  };
}
```

### 5.2 Real-Time Delivery Status Dashboard

```typescript
// WebSocket-based real-time tracking
interface DeliveryStatusUpdate {
  delivery_id: string;
  notification_id: string;
  customer_id: string;
  customer_name: string;
  template_name: string;
  channel: string;
  status: NotificationStatus;
  timestamp: Date;
}

// Emit status updates via WebSocket
async function emitDeliveryStatusEvent(
  deliveryId: string,
  newStatus: NotificationStatus
): Promise<void> {
  const delivery = await getDelivery(deliveryId);
  const customer = await getCustomer(delivery.customer_id);
  const template = await getTemplate(delivery.template_id);

  const update: DeliveryStatusUpdate = {
    delivery_id: deliveryId,
    notification_id: delivery.notification_id,
    customer_id: delivery.customer_id,
    customer_name: `${customer.first_name} ${customer.last_name}`,
    template_name: template.template_name,
    channel: delivery.channel,
    status: newStatus,
    timestamp: new Date()
  };

  // Emit to all connected admin dashboards
  io.emit('delivery_status_update', update);

  // Emit to customer-specific room (if customer dashboard exists)
  io.to(`customer_${delivery.customer_id}`).emit('notification_status', {
    notification_id: delivery.notification_id,
    status: newStatus
  });
}
```

### 5.3 Failure Analysis

```typescript
interface FailureAnalysis {
  period_start: Date;
  period_end: Date;

  total_failures: number;
  failure_rate: number;

  // By error type
  by_error_code: {
    error_code: string;
    error_message: string;
    count: number;
    percentage: number;
    affected_customers: number;
  }[];

  // By channel
  by_channel: {
    channel: string;
    failures: number;
    failure_rate: number;
  }[];

  // By customer
  high_failure_customers: {
    customer_id: string;
    customer_name: string;
    phone_number: string;
    failure_count: number;
    total_sent: number;
    failure_rate: number;
  }[];
}

async function analyzeFailures(
  startDate: Date,
  endDate: Date
): Promise<FailureAnalysis> {
  const { data: failures } = await supabase
    .from('notification_deliveries')
    .select('*, customers(*)')
    .eq('status', 'failed')
    .gte('created_at', startDate.toISOString())
    .lte('created_at', endDate.toISOString());

  const { data: allDeliveries } = await supabase
    .from('notification_deliveries')
    .select('count')
    .gte('created_at', startDate.toISOString())
    .lte('created_at', endDate.toISOString());

  const totalDeliveries = allDeliveries?.[0]?.count || 0;
  const totalFailures = failures?.length || 0;

  // Group by error code
  const errorCodes = groupBy(failures, 'error_code');
  const byErrorCode = Object.entries(errorCodes).map(([code, fails]) => ({
    error_code: code,
    error_message: fails[0]?.error_message || '',
    count: fails.length,
    percentage: (fails.length / totalFailures) * 100,
    affected_customers: [...new Set(fails.map(f => f.customer_id))].length
  }));

  // Group by customer
  const customerFailures = groupBy(failures, 'customer_id');
  const highFailureCustomers = Object.entries(customerFailures)
    .map(([customerId, fails]) => {
      const customer = fails[0]?.customers;
      return {
        customer_id: customerId,
        customer_name: `${customer?.first_name} ${customer?.last_name}`,
        phone_number: customer?.whatsapp_number || customer?.phone_number,
        failure_count: fails.length,
        total_sent: fails.length, // TODO: Get actual total
        failure_rate: 100 // TODO: Calculate actual rate
      };
    })
    .filter(c => c.failure_count >= 3)
    .sort((a, b) => b.failure_count - a.failure_count)
    .slice(0, 20);

  return {
    period_start: startDate,
    period_end: endDate,
    total_failures: totalFailures,
    failure_rate: totalDeliveries > 0 ? (totalFailures / totalDeliveries) * 100 : 0,
    by_error_code: byErrorCode.sort((a, b) => b.count - a.count),
    by_channel: [],
    high_failure_customers: highFailureCustomers
  };
}
```

---

## 6. Customer-Level Tracking

### 6.1 Customer Notification History

```typescript
interface CustomerNotificationHistory {
  customer_id: string;
  customer_name: string;

  total_notifications_received: number;
  notifications_last_30_days: number;

  // Engagement metrics
  average_read_rate: number;
  average_response_time_minutes: number;
  preferred_channel: string;

  // Recent notifications
  recent_notifications: {
    notification_id: string;
    template_name: string;
    channel: string;
    sent_at: Date;
    status: NotificationStatus;
    read_at?: Date;
  }[];

  // Conversation tracking (for WhatsApp)
  last_inbound_message_at?: Date;
  total_inbound_messages: number;
}

async function getCustomerNotificationHistory(
  customerId: string
): Promise<CustomerNotificationHistory> {
  const { data: deliveries } = await supabase
    .from('notification_deliveries')
    .select('*, notification_templates(*)')
    .eq('customer_id', customerId)
    .order('created_at', { ascending: false });

  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const recentDeliveries = deliveries?.filter(
    d => new Date(d.created_at) > thirtyDaysAgo
  ) || [];

  const readDeliveries = deliveries?.filter(d => d.read_at) || [];
  const readRate = deliveries?.length > 0
    ? (readDeliveries.length / deliveries.length) * 100
    : 0;

  // Calculate average response time
  const responseTimes = readDeliveries
    .filter(d => d.delivered_at && d.read_at)
    .map(d => (new Date(d.read_at).getTime() - new Date(d.delivered_at).getTime()) / (1000 * 60));

  // Find preferred channel
  const channelCounts = groupBy(deliveries, 'channel');
  const preferredChannel = Object.entries(channelCounts)
    .sort((a, b) => b[1].length - a[1].length)[0]?.[0] || 'whatsapp';

  return {
    customer_id: customerId,
    customer_name: '', // TODO: Get from customer record
    total_notifications_received: deliveries?.length || 0,
    notifications_last_30_days: recentDeliveries.length,
    average_read_rate: readRate,
    average_response_time_minutes: average(responseTimes),
    preferred_channel: preferredChannel,
    recent_notifications: deliveries?.slice(0, 10).map(d => ({
      notification_id: d.notification_id,
      template_name: d.notification_templates?.template_name || 'Unknown',
      channel: d.channel,
      sent_at: d.sent_at || d.created_at,
      status: d.status as NotificationStatus,
      read_at: d.read_at
    })) || [],
    last_inbound_message_at: undefined,
    total_inbound_messages: 0
  };
}
```

### 6.2 Opt-Out / Unsubscribe Tracking

```typescript
interface OptOutRecord {
  opt_out_id: string;
  customer_id: string;
  channel: 'whatsapp' | 'sms' | 'email' | 'all';
  category?: string; // 'marketing', 'transactional', etc.
  opted_out_at: Date;
  reason?: string;
  can_resubscribe: boolean;
}

async function handleOptOut(
  customerId: string,
  channel: string,
  reason?: string
): Promise<void> {
  // Record opt-out
  const optOut: OptOutRecord = {
    opt_out_id: uuidv4(),
    customer_id: customerId,
    channel: channel as any,
    opted_out_at: new Date(),
    reason: reason,
    can_resubscribe: channel !== 'all' // Can resubscribe unless opted out of all
  };

  await supabase.from('notification_opt_outs').insert(optOut);

  // Update customer preferences
  await supabase
    .from('customer_notification_preferences')
    .update({ [`${channel}_enabled`]: false })
    .eq('customer_id', customerId);

  // Send confirmation
  if (channel !== 'all') {
    // Use a different channel to confirm
    const alternateChannel = channel === 'whatsapp' ? 'sms' : 'whatsapp';
    await sendWhatsAppMessage(
      customerId,
      `You've been unsubscribed from ${channel} notifications. Reply RESUBSCRIBE to opt back in.`
    );
  }
}

async function isOptedOut(
  customerId: string,
  channel: string,
  category?: string
): Promise<boolean> {
  const { data: optOuts } = await supabase
    .from('notification_opt_outs')
    .select('*')
    .eq('customer_id', customerId)
    .or(`channel.eq.${channel},channel.eq.all`);

  if (!optOuts || optOuts.length === 0) return false;

  // Check if opted out of this category
  if (category) {
    return optOuts.some(opt => !opt.category || opt.category === category);
  }

  return true;
}
```

---

## 7. Database Schema

### 7.1 Enhanced Notification Deliveries Table

```sql
CREATE TABLE notification_deliveries (
  delivery_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_id UUID NOT NULL REFERENCES notification_queue(notification_id),
  customer_id UUID NOT NULL REFERENCES customers(id),
  template_id UUID NOT NULL REFERENCES notification_templates(template_id),

  channel VARCHAR(20) NOT NULL CHECK (channel IN ('whatsapp', 'sms', 'email', 'push')),
  status VARCHAR(20) NOT NULL CHECK (status IN (
    'queued', 'sending', 'sent', 'delivered', 'read', 'clicked', 'converted', 'failed', 'expired', 'rejected'
  )),

  -- Timeline
  queued_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sent_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  read_at TIMESTAMPTZ,
  clicked_at TIMESTAMPTZ,
  converted_at TIMESTAMPTZ,
  failed_at TIMESTAMPTZ,
  expired_at TIMESTAMPTZ,

  -- Provider details
  provider VARCHAR(50) NOT NULL,
  provider_message_id VARCHAR(200),
  provider_status VARCHAR(50),

  -- Failure tracking
  error_code VARCHAR(50),
  error_message TEXT,
  retry_count INT DEFAULT 0,

  -- Cost tracking
  cost_usd DECIMAL(10,4),

  -- Content snapshot
  content_sent TEXT NOT NULL,
  variables_used JSONB,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_notification_deliveries_notification_id ON notification_deliveries(notification_id);
CREATE INDEX idx_notification_deliveries_customer_id ON notification_deliveries(customer_id);
CREATE INDEX idx_notification_deliveries_template_id ON notification_deliveries(template_id);
CREATE INDEX idx_notification_deliveries_channel ON notification_deliveries(channel);
CREATE INDEX idx_notification_deliveries_status ON notification_deliveries(status);
CREATE INDEX idx_notification_deliveries_provider_message_id ON notification_deliveries(provider_message_id);
CREATE INDEX idx_notification_deliveries_sent_at ON notification_deliveries(sent_at DESC);
```

### 7.2 Notification Conversions Table

```sql
CREATE TABLE notification_conversions (
  conversion_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  delivery_id UUID NOT NULL REFERENCES notification_deliveries(delivery_id),
  notification_id UUID NOT NULL REFERENCES notification_queue(notification_id),
  customer_id UUID NOT NULL REFERENCES customers(id),

  conversion_type VARCHAR(50) NOT NULL CHECK (conversion_type IN (
    'payment_made', 'kyc_submitted', 'loan_applied', 'device_selected', 'custom'
  )),
  conversion_value_usd DECIMAL(10,2),
  conversion_data JSONB,

  time_to_conversion_minutes INT NOT NULL,
  converted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_notification_conversions_delivery_id ON notification_conversions(delivery_id);
CREATE INDEX idx_notification_conversions_customer_id ON notification_conversions(customer_id);
CREATE INDEX idx_notification_conversions_type ON notification_conversions(conversion_type);
CREATE INDEX idx_notification_conversions_converted_at ON notification_conversions(converted_at DESC);
```

### 7.3 Notification Opt-Outs Table

```sql
CREATE TABLE notification_opt_outs (
  opt_out_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customers(id),

  channel VARCHAR(20) NOT NULL CHECK (channel IN ('whatsapp', 'sms', 'email', 'push', 'all')),
  category VARCHAR(50), -- Optional: 'marketing', 'transactional', etc.

  opted_out_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reason TEXT,
  can_resubscribe BOOLEAN DEFAULT TRUE,

  -- Re-subscription tracking
  resubscribed_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_notification_opt_outs_customer_id ON notification_opt_outs(customer_id);
CREATE INDEX idx_notification_opt_outs_channel ON notification_opt_outs(channel);
CREATE UNIQUE INDEX idx_notification_opt_outs_customer_channel ON notification_opt_outs(customer_id, channel) WHERE resubscribed_at IS NULL;
```

### 7.4 Email Click Tracking Table

```sql
CREATE TABLE email_click_tracking (
  click_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  delivery_id UUID NOT NULL REFERENCES notification_deliveries(delivery_id),

  url TEXT NOT NULL,
  clicked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- User agent tracking
  user_agent TEXT,
  ip_address INET,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_email_click_tracking_delivery_id ON email_click_tracking(delivery_id);
CREATE INDEX idx_email_click_tracking_clicked_at ON email_click_tracking(clicked_at DESC);
```

---

## 8. Summary

This notification delivery tracking specification provides comprehensive monitoring and analytics for all customer communications:

**Complete Lifecycle Tracking**: From queued → sent → delivered → read → clicked → converted
**Multi-Channel Support**: WhatsApp, SMS, Email with provider-specific webhook integrations
**Real-Time Updates**: WebSocket-based live delivery status dashboard
**Conversion Attribution**: Track desired actions within attribution windows
**Engagement Analytics**: Read rates, click rates, conversion rates by channel and template
**Failure Analysis**: Identify patterns in delivery failures and problematic customers
**Cost Tracking**: Monitor per-message costs across channels
**Opt-Out Management**: Handle unsubscribe requests and channel preferences
**Customer History**: Complete notification timeline for each customer

**Key Performance Metrics**:
- Delivery Rate: Target >98% (WhatsApp), >95% (SMS), >90% (Email)
- Read Rate: Target >60% (WhatsApp), >40% (SMS), >25% (Email)
- Conversion Rate: Target >30% for payment reminders, >50% for critical alerts
- Average Time to Read: Target <2 hours
- Average Time to Conversion: Target <24 hours

**Implementation Priority**: High (critical for optimizing communication strategy)
**Implementation Complexity**: Medium (requires webhook integrations and analytics)
**Business Impact**: High (enables data-driven notification optimization)

**Related Tasks**:
- P1-T037: Multi-Channel Notification Design
- P1-T038: Notification Templates & Triggers
- P1-T039: Payment Reminder Strategy

**Next Steps**:
1. Set up WhatsApp, SMS, and Email webhook endpoints
2. Implement delivery status update handlers
3. Build real-time WebSocket delivery dashboard
4. Create conversion tracking system
5. Implement analytics and reporting endpoints
6. Build failure analysis and alerting system
7. Create customer notification history views
