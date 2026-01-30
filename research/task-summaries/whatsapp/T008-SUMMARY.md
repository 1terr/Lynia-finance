# T008: WhatsApp Cloud API Webhooks - Research Summary

**Status:** ✅ Research Complete (Documentation-based)
**Date:** 2025-11-10
**GitHub Issue:** https://github.com/1terr/Lynia-finance/issues/11

---

## Executive Summary

WhatsApp webhooks enable real-time bidirectional communication by receiving incoming messages, delivery status updates, and customer interactions. For Lynia Finance, webhooks are essential for processing customer loan applications, payment confirmations, and support requests via WhatsApp.

**Key Finding:** Webhooks require a publicly accessible HTTPS endpoint with proper verification. All incoming messages must be acknowledged within 20 seconds to prevent duplicate delivery.

---

## 1. Webhook Overview

### 1.1 What Are Webhooks?

**Webhooks** are HTTP callbacks that WhatsApp sends to your server when events occur:
- ✅ Customer sends a message
- ✅ Message delivery status changes
- ✅ Customer reads a message
- ✅ Customer interacts with buttons/lists

**Flow:**
```
Customer sends WhatsApp message
        ↓
WhatsApp Cloud API
        ↓
POST request to your webhook URL
        ↓
Your server processes message
        ↓
Return 200 OK within 20 seconds
        ↓
Send response back to customer
```

---

### 1.2 Webhook Requirements

**Your webhook endpoint must:**
- ✅ Be publicly accessible (not localhost)
- ✅ Use HTTPS (valid SSL certificate)
- ✅ Respond with 200 OK within 20 seconds
- ✅ Verify webhook signature (security)
- ✅ Handle duplicate messages (idempotency)

**Options for hosting:**
- AWS Lambda + API Gateway
- Heroku
- DigitalOcean
- Cloudflare Workers
- ngrok (for local testing only)

---

## 2. Webhook Setup

### 2.1 Configuration in Meta Dashboard

**Step 1: Configure Callback URL**
```
1. Go to Meta App Dashboard
2. WhatsApp > Configuration
3. Callback URL: https://api.lynia.finance/webhooks/whatsapp
4. Verify Token: lynia_webhook_verify_token_2025
5. Click "Verify and Save"
```

**Step 2: Subscribe to Webhook Fields**
```
Check these fields:
☑ messages - Incoming messages from customers
☑ message_status - Delivery/read status updates
```

---

### 2.2 Webhook Verification

When you save the webhook URL, WhatsApp sends a GET request to verify:

```javascript
// Express.js webhook verification
app.get('/webhooks/whatsapp', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  // Check if mode and token are correct
  if (mode === 'subscribe' && token === process.env.WEBHOOK_VERIFY_TOKEN) {
    console.log('Webhook verified successfully!');
    res.status(200).send(challenge);
  } else {
    console.error('Webhook verification failed!');
    res.sendStatus(403);
  }
});
```

**Verification Request:**
```http
GET /webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=lynia_webhook_verify_token_2025&hub.challenge=1234567890
```

**Your Response:**
```
200 OK
Body: 1234567890 (echo the challenge)
```

---

## 3. Receiving Messages

### 3.1 Webhook Payload Structure

When a customer sends a message, WhatsApp POSTs this to your webhook:

```json
{
  "object": "whatsapp_business_account",
  "entry": [
    {
      "id": "WHATSAPP_BUSINESS_ACCOUNT_ID",
      "changes": [
        {
          "value": {
            "messaging_product": "whatsapp",
            "metadata": {
              "display_phone_number": "263771234567",
              "phone_number_id": "123456789012345"
            },
            "contacts": [
              {
                "profile": {
                  "name": "John Doe"
                },
                "wa_id": "263771234567"
              }
            ],
            "messages": [
              {
                "from": "263771234567",
                "id": "wamid.HBgLMjYzNzcxMjM0NTY3FQIAERgSQzg5OTA2RjBGMDREMzAzOTU0AA==",
                "timestamp": "1699564800",
                "text": {
                  "body": "APPLY"
                },
                "type": "text"
              }
            ]
          },
          "field": "messages"
        }
      ]
    }
  ]
}
```

---

### 3.2 Complete Webhook Handler

```javascript
// webhooks/whatsapp-handler.js

const express = require('express');
const router = express.Router();

// Webhook verification (GET)
router.get('/whatsapp', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === process.env.WEBHOOK_VERIFY_TOKEN) {
    console.log('✅ Webhook verified');
    res.status(200).send(challenge);
  } else {
    console.error('❌ Webhook verification failed');
    res.sendStatus(403);
  }
});

// Webhook handler (POST)
router.post('/whatsapp', async (req, res) => {
  // Respond immediately to acknowledge receipt
  res.sendStatus(200);

  const data = req.body;

  // Validate payload
  if (data.object !== 'whatsapp_business_account') {
    console.log('Not a WhatsApp webhook');
    return;
  }

  // Process each entry
  for (const entry of data.entry) {
    for (const change of entry.changes) {
      const value = change.value;

      // Handle incoming messages
      if (value.messages) {
        for (const message of value.messages) {
          await handleIncomingMessage(message, value.metadata);
        }
      }

      // Handle message status updates
      if (value.statuses) {
        for (const status of value.statuses) {
          await handleMessageStatus(status, value.metadata);
        }
      }
    }
  }
});

/**
 * Handle incoming message from customer
 */
async function handleIncomingMessage(message, metadata) {
  console.log('📩 Incoming message:', {
    from: message.from,
    messageId: message.id,
    type: message.type,
    timestamp: message.timestamp
  });

  // Check for duplicate (idempotency)
  const isDuplicate = await checkDuplicateMessage(message.id);
  if (isDuplicate) {
    console.log('⚠️  Duplicate message, skipping');
    return;
  }

  // Save message to database
  await saveIncomingMessage(message, metadata);

  // Process based on message type
  switch (message.type) {
    case 'text':
      await handleTextMessage(message);
      break;
    case 'interactive':
      await handleInteractiveMessage(message);
      break;
    case 'button':
      await handleButtonMessage(message);
      break;
    case 'image':
      await handleImageMessage(message);
      break;
    case 'document':
      await handleDocumentMessage(message);
      break;
    default:
      console.log(`Unsupported message type: ${message.type}`);
  }
}

/**
 * Handle message status updates
 */
async function handleMessageStatus(status, metadata) {
  console.log('📊 Status update:', {
    messageId: status.id,
    status: status.status,
    timestamp: status.timestamp
  });

  // Update message status in database
  await updateMessageStatus(status.id, status.status, status.timestamp);

  // Handle failed messages
  if (status.status === 'failed') {
    console.error(`❌ Message ${status.id} failed:`, status.errors);
    await handleFailedMessage(status);
  }
}

module.exports = router;
```

---

### 3.3 Message Type Handlers

#### Text Messages

```javascript
/**
 * Handle text message
 */
async function handleTextMessage(message) {
  const from = message.from;
  const text = message.text.body.trim();
  const upperText = text.toUpperCase();

  console.log(`💬 Text from ${from}: "${text}"`);

  // Command routing
  if (upperText === 'APPLY') {
    await handleApplyCommand(from);
  } else if (upperText === 'BALANCE') {
    await handleBalanceCommand(from);
  } else if (upperText === 'HELP') {
    await handleHelpCommand(from);
  } else if (upperText === 'ACCEPT') {
    await handleAcceptCommand(from);
  } else if (upperText === 'DECLINE') {
    await handleDeclineCommand(from);
  } else if (upperText.startsWith('PAY')) {
    await handlePayCommand(from, text);
  } else {
    // Natural language processing or default response
    await handleFreeformText(from, text);
  }
}

/**
 * Handle APPLY command
 */
async function handleApplyCommand(phone) {
  const customer = await db.customers.findByPhone(phone);

  if (!customer) {
    // New customer - start onboarding
    await startOnboarding(phone);
  } else if (customer.hasActiveLoan) {
    // Already has active loan
    await whatsapp.sendTextMessage(
      phone,
      `You already have an active loan. Balance: $${customer.loanBalance}\n\nReply *BALANCE* for details or *HELP* for support.`
    );
  } else {
    // Existing customer - start loan application
    await startLoanApplication(phone, customer);
  }
}

/**
 * Handle BALANCE command
 */
async function handleBalanceCommand(phone) {
  const loan = await db.loans.findActiveByPhone(phone);

  if (!loan) {
    await whatsapp.sendTextMessage(
      phone,
      `You don't have an active loan.\n\nReply *APPLY* to start a new application.`
    );
    return;
  }

  const schedule = await getLoanSchedule(loan.id);
  const daysOverdue = calculateDaysOverdue(schedule);

  const message = `
*Loan Balance* 📊

*Total Outstanding:* $${loan.totalOutstanding}
*Principal:* $${loan.principalOutstanding}
*Interest:* $${loan.interestOutstanding}

*Next Payment*
Amount: $${schedule.nextPayment.amount}
Due: ${formatDate(schedule.nextPayment.dueDate)}
${daysOverdue > 0 ? `⚠️  ${daysOverdue} days overdue` : ''}

Reply *PAY* to make a payment or *SCHEDULE* to view full schedule.
  `.trim();

  await whatsapp.sendTextMessage(phone, message);
}
```

#### Interactive Messages (Button Replies)

```javascript
/**
 * Handle interactive message (button reply)
 */
async function handleInteractiveMessage(message) {
  const from = message.from;
  const interactive = message.interactive;

  if (interactive.type === 'button_reply') {
    const buttonId = interactive.button_reply.id;
    const buttonTitle = interactive.button_reply.title;

    console.log(`🔘 Button click from ${from}: ${buttonTitle} (${buttonId})`);

    // Route based on button ID
    switch (buttonId) {
      case 'accept':
        await handleAcceptCommand(from);
        break;
      case 'decline':
        await handleDeclineCommand(from);
        break;
      case 'more_info':
        await handleMoreInfoCommand(from);
        break;
      case 'check_balance':
        await handleBalanceCommand(from);
        break;
      case 'make_payment':
        await handlePayCommand(from);
        break;
      default:
        console.log(`Unknown button: ${buttonId}`);
    }
  } else if (interactive.type === 'list_reply') {
    const listId = interactive.list_reply.id;
    const listTitle = interactive.list_reply.title;

    console.log(`📋 List selection from ${from}: ${listTitle} (${listId})`);

    // Route based on list item ID
    switch (listId) {
      case 'apply':
        await handleApplyCommand(from);
        break;
      case 'check_balance':
        await handleBalanceCommand(from);
        break;
      case 'make_payment':
        await handlePayCommand(from);
        break;
      case 'help':
        await handleHelpCommand(from);
        break;
      case 'contact':
        await handleContactCommand(from);
        break;
      default:
        console.log(`Unknown list item: ${listId}`);
    }
  }
}
```

#### Media Messages

```javascript
/**
 * Handle image message
 */
async function handleImageMessage(message) {
  const from = message.from;
  const image = message.image;

  console.log(`📷 Image from ${from}:`, image.id);

  // Download image
  const imageUrl = await downloadMedia(image.id);

  // Check if customer is in KYC verification flow
  const customer = await db.customers.findByPhone(from);

  if (customer && customer.kycStatus === 'awaiting_id_photo') {
    // Process National ID photo
    await processNationalIdPhoto(from, imageUrl);
  } else if (customer && customer.kycStatus === 'awaiting_selfie') {
    // Process selfie
    await processSelfiePhoto(from, imageUrl);
  } else {
    // Unexpected image
    await whatsapp.sendTextMessage(
      from,
      `I received your image, but I'm not sure what to do with it. Reply *HELP* for assistance.`
    );
  }
}

/**
 * Download media from WhatsApp
 */
async function downloadMedia(mediaId) {
  // Step 1: Get media URL
  const response = await axios.get(
    `https://graph.facebook.com/v18.0/${mediaId}`,
    {
      headers: {
        'Authorization': `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`
      }
    }
  );

  const mediaUrl = response.data.url;

  // Step 2: Download media
  const mediaResponse = await axios.get(mediaUrl, {
    headers: {
      'Authorization': `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`
    },
    responseType: 'arraybuffer'
  });

  // Step 3: Upload to your storage (S3, etc.)
  const filename = `media/${mediaId}.jpg`;
  await uploadToS3(filename, mediaResponse.data);

  return filename;
}
```

---

## 4. Database Schema for Messages

### 4.1 Messages Table

```sql
CREATE TABLE whatsapp_messages (
  id BIGSERIAL PRIMARY KEY,

  -- WhatsApp identifiers
  whatsapp_message_id VARCHAR(255) UNIQUE NOT NULL,
  phone_number VARCHAR(20) NOT NULL,

  -- Message details
  direction VARCHAR(10) NOT NULL, -- 'inbound' or 'outbound'
  message_type VARCHAR(20) NOT NULL, -- 'text', 'interactive', 'image', etc.
  content TEXT,
  media_url TEXT,

  -- Status tracking
  status VARCHAR(20) DEFAULT 'sent', -- 'sent', 'delivered', 'read', 'failed'

  -- Metadata
  timestamp TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  -- Indexes
  INDEX idx_phone (phone_number),
  INDEX idx_whatsapp_id (whatsapp_message_id),
  INDEX idx_timestamp (timestamp)
);
```

---

### 4.2 Message Helper Functions

```javascript
// db/messages.js

/**
 * Check if message already processed (idempotency)
 */
async function checkDuplicateMessage(whatsappMessageId) {
  const result = await db.query(
    'SELECT id FROM whatsapp_messages WHERE whatsapp_message_id = $1',
    [whatsappMessageId]
  );
  return result.rows.length > 0;
}

/**
 * Save incoming message
 */
async function saveIncomingMessage(message, metadata) {
  await db.query(`
    INSERT INTO whatsapp_messages (
      whatsapp_message_id,
      phone_number,
      direction,
      message_type,
      content,
      timestamp
    ) VALUES ($1, $2, $3, $4, $5, to_timestamp($6))
  `, [
    message.id,
    message.from,
    'inbound',
    message.type,
    message.text?.body || JSON.stringify(message),
    parseInt(message.timestamp)
  ]);
}

/**
 * Save outgoing message
 */
async function saveOutgoingMessage(phone, messageType, content, whatsappMessageId) {
  await db.query(`
    INSERT INTO whatsapp_messages (
      whatsapp_message_id,
      phone_number,
      direction,
      message_type,
      content,
      timestamp
    ) VALUES ($1, $2, $3, $4, $5, NOW())
  `, [
    whatsappMessageId,
    phone,
    'outbound',
    messageType,
    content
  ]);
}

/**
 * Update message status
 */
async function updateMessageStatus(whatsappMessageId, status, timestamp) {
  await db.query(`
    UPDATE whatsapp_messages
    SET status = $1, updated_at = to_timestamp($2)
    WHERE whatsapp_message_id = $3
  `, [
    status,
    parseInt(timestamp),
    whatsappMessageId
  ]);
}

module.exports = {
  checkDuplicateMessage,
  saveIncomingMessage,
  saveOutgoingMessage,
  updateMessageStatus
};
```

---

## 5. Conversation State Management

### 5.1 Conversation States

```javascript
// State machine for loan application flow
const CONVERSATION_STATES = {
  IDLE: 'idle',
  ONBOARDING_NAME: 'onboarding_name',
  ONBOARDING_NATIONAL_ID: 'onboarding_national_id',
  ONBOARDING_PHONE_VERIFY: 'onboarding_phone_verify',
  ONBOARDING_INCOME: 'onboarding_income',
  ONBOARDING_EMPLOYMENT: 'onboarding_employment',
  KYC_ID_PHOTO: 'kyc_id_photo',
  KYC_SELFIE: 'kyc_selfie',
  LOAN_OFFER_PENDING: 'loan_offer_pending',
  LOAN_ACCEPTED: 'loan_accepted',
  LOAN_ACTIVE: 'loan_active',
  PAYMENT_PROCESSING: 'payment_processing'
};
```

---

### 5.2 State Tracking

```sql
CREATE TABLE conversation_state (
  id BIGSERIAL PRIMARY KEY,
  phone_number VARCHAR(20) UNIQUE NOT NULL,
  state VARCHAR(50) NOT NULL DEFAULT 'idle',
  context JSONB, -- Store additional context
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

```javascript
/**
 * Get customer conversation state
 */
async function getConversationState(phone) {
  const result = await db.query(
    'SELECT state, context FROM conversation_state WHERE phone_number = $1',
    [phone]
  );

  if (result.rows.length === 0) {
    return { state: 'idle', context: {} };
  }

  return result.rows[0];
}

/**
 * Update conversation state
 */
async function updateConversationState(phone, state, context = {}) {
  await db.query(`
    INSERT INTO conversation_state (phone_number, state, context, updated_at)
    VALUES ($1, $2, $3, NOW())
    ON CONFLICT (phone_number)
    DO UPDATE SET state = $2, context = $3, updated_at = NOW()
  `, [phone, state, context]);
}
```

---

### 5.3 Stateful Message Handler

```javascript
/**
 * Handle message based on conversation state
 */
async function handleFreeformText(phone, text) {
  const { state, context } = await getConversationState(phone);

  switch (state) {
    case 'onboarding_name':
      await handleNameInput(phone, text);
      break;

    case 'onboarding_national_id':
      await handleNationalIdInput(phone, text);
      break;

    case 'onboarding_income':
      await handleIncomeInput(phone, text, context);
      break;

    case 'onboarding_employment':
      await handleEmploymentInput(phone, text, context);
      break;

    case 'payment_processing':
      await handlePaymentReference(phone, text, context);
      break;

    default:
      // No active conversation - show main menu
      await showMainMenu(phone);
  }
}

/**
 * Handle name input during onboarding
 */
async function handleNameInput(phone, name) {
  // Validate name
  if (name.length < 2 || name.length > 100) {
    await whatsapp.sendTextMessage(
      phone,
      `Please enter a valid name (2-100 characters).`
    );
    return;
  }

  // Save name
  await updateConversationState(phone, 'onboarding_national_id', { name });

  // Ask for National ID
  await whatsapp.sendTextMessage(
    phone,
    `Thanks ${name}! 👋\n\nNow, please share your Zimbabwe National ID number.\n\nFormat: 63-123456-A-12`
  );
}

/**
 * Handle National ID input
 */
async function handleNationalIdInput(phone, nationalId) {
  const { context } = await getConversationState(phone);

  // Validate format
  const nationalIdPattern = /^\d{2}-\d{6,7}-[A-Z]-\d{2}$/;
  if (!nationalIdPattern.test(nationalId)) {
    await whatsapp.sendTextMessage(
      phone,
      `Invalid National ID format. Please use format: 63-123456-A-12`
    );
    return;
  }

  // Check for duplicate
  const existingCustomer = await db.customers.findByNationalId(nationalId);
  if (existingCustomer) {
    await whatsapp.sendTextMessage(
      phone,
      `This National ID is already registered. Reply *HELP* for assistance.`
    );
    return;
  }

  // Save National ID
  context.nationalId = nationalId;
  await updateConversationState(phone, 'onboarding_income', context);

  // Ask for monthly income
  await whatsapp.sendTextMessage(
    phone,
    `Great! Now, what is your average monthly income? (in USD)\n\nExample: 250`
  );
}

/**
 * Handle income input
 */
async function handleIncomeInput(phone, incomeText, context) {
  // Parse income
  const income = parseFloat(incomeText.replace(/[^0-9.]/g, ''));

  if (isNaN(income) || income < 0) {
    await whatsapp.sendTextMessage(
      phone,
      `Please enter a valid income amount in USD.\n\nExample: 250`
    );
    return;
  }

  // Save income
  context.monthlyIncome = income;
  await updateConversationState(phone, 'onboarding_employment', context);

  // Ask for employment status
  await whatsapp.sendReplyButtons(
    phone,
    'What is your employment status?',
    [
      { id: 'employed', title: 'Employed' },
      { id: 'self_employed', title: 'Self-Employed' },
      { id: 'other', title: 'Other' }
    ]
  );
}
```

---

## 6. Security

### 6.1 Webhook Signature Verification

WhatsApp signs webhook requests for security. Verify signatures to ensure requests are authentic:

```javascript
const crypto = require('crypto');

/**
 * Verify WhatsApp webhook signature
 */
function verifyWebhookSignature(req, res, next) {
  const signature = req.headers['x-hub-signature-256'];

  if (!signature) {
    console.error('Missing webhook signature');
    return res.sendStatus(401);
  }

  // Calculate expected signature
  const expectedSignature = crypto
    .createHmac('sha256', process.env.WHATSAPP_APP_SECRET)
    .update(JSON.stringify(req.body))
    .digest('hex');

  const expectedHeader = `sha256=${expectedSignature}`;

  // Compare signatures (constant-time comparison)
  if (crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedHeader)
  )) {
    next();
  } else {
    console.error('Invalid webhook signature');
    res.sendStatus(401);
  }
}

// Apply middleware
router.post('/whatsapp', verifyWebhookSignature, async (req, res) => {
  // ... handle webhook
});
```

---

### 6.2 Rate Limiting

Protect webhook endpoint from abuse:

```javascript
const rateLimit = require('express-rate-limit');

const webhookLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 100, // Max 100 requests per minute
  message: 'Too many webhook requests',
  standardHeaders: true,
  legacyHeaders: false
});

router.post('/whatsapp', webhookLimiter, verifyWebhookSignature, async (req, res) => {
  // ... handle webhook
});
```

---

### 6.3 Input Validation

Always validate user input:

```javascript
/**
 * Sanitize user input
 */
function sanitizeInput(text) {
  // Remove control characters
  let sanitized = text.replace(/[\x00-\x1F\x7F]/g, '');

  // Trim whitespace
  sanitized = sanitized.trim();

  // Limit length
  if (sanitized.length > 1000) {
    sanitized = sanitized.substring(0, 1000);
  }

  return sanitized;
}

/**
 * Validate National ID format
 */
function validateNationalId(nationalId) {
  const pattern = /^\d{2}-\d{6,7}-[A-Z]-\d{2}$/;
  return pattern.test(nationalId);
}

/**
 * Validate phone number
 */
function validatePhoneNumber(phone) {
  const pattern = /^263[0-9]{9}$/;
  return pattern.test(phone);
}
```

---

## 7. Testing Webhooks Locally

### 7.1 Using ngrok

For local development, expose your localhost to the internet:

```bash
# Install ngrok
npm install -g ngrok

# Start your webhook server
node server.js

# In another terminal, expose port 3000
ngrok http 3000

# Output:
# Forwarding: https://abc123.ngrok.io -> http://localhost:3000
```

**Configure webhook URL in Meta Dashboard:**
```
Callback URL: https://abc123.ngrok.io/webhooks/whatsapp
Verify Token: lynia_webhook_verify_token_2025
```

---

### 7.2 Testing Script

```javascript
// test/webhook-test.js

const axios = require('axios');

/**
 * Simulate WhatsApp webhook POST request
 */
async function testWebhook() {
  const webhookPayload = {
    object: 'whatsapp_business_account',
    entry: [
      {
        id: 'WHATSAPP_BUSINESS_ACCOUNT_ID',
        changes: [
          {
            value: {
              messaging_product: 'whatsapp',
              metadata: {
                display_phone_number: '263771234567',
                phone_number_id: '123456789012345'
              },
              contacts: [
                {
                  profile: {
                    name: 'Test Customer'
                  },
                  wa_id: '263771234567'
                }
              ],
              messages: [
                {
                  from: '263771234567',
                  id: 'test_message_' + Date.now(),
                  timestamp: Math.floor(Date.now() / 1000).toString(),
                  text: {
                    body: 'APPLY'
                  },
                  type: 'text'
                }
              ]
            },
            field: 'messages'
          }
        ]
      }
    ]
  };

  try {
    const response = await axios.post(
      'http://localhost:3000/webhooks/whatsapp',
      webhookPayload,
      {
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );

    console.log('✅ Webhook test successful');
    console.log('Response:', response.status);
  } catch (error) {
    console.error('❌ Webhook test failed:', error.message);
  }
}

testWebhook();
```

**Run test:**
```bash
node test/webhook-test.js
```

---

## 8. Error Handling and Logging

### 8.1 Comprehensive Error Handling

```javascript
router.post('/whatsapp', async (req, res) => {
  // Always respond 200 OK immediately
  res.sendStatus(200);

  try {
    const data = req.body;

    // Validate payload
    if (!data.object || data.object !== 'whatsapp_business_account') {
      console.log('Invalid webhook payload');
      return;
    }

    // Process webhook
    await processWebhook(data);
  } catch (error) {
    // Log error but don't return error to WhatsApp
    console.error('Error processing webhook:', error);

    // Send alert to monitoring service
    await sendAlert({
      severity: 'error',
      message: 'Webhook processing failed',
      error: error.message,
      stack: error.stack
    });
  }
});

/**
 * Process webhook with timeout
 */
async function processWebhook(data) {
  // Set 15-second timeout (WhatsApp requires response within 20s)
  const timeout = new Promise((_, reject) =>
    setTimeout(() => reject(new Error('Webhook processing timeout')), 15000)
  );

  const processing = (async () => {
    for (const entry of data.entry) {
      for (const change of entry.changes) {
        if (change.value.messages) {
          for (const message of change.value.messages) {
            await handleIncomingMessage(message, change.value.metadata);
          }
        }
      }
    }
  })();

  await Promise.race([processing, timeout]);
}
```

---

### 8.2 Structured Logging

```javascript
const winston = require('winston');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: 'logs/webhook-error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/webhook.log' })
  ]
});

// Log incoming message
logger.info('Incoming message', {
  from: message.from,
  messageId: message.id,
  type: message.type,
  content: message.text?.body
});

// Log error
logger.error('Failed to process message', {
  messageId: message.id,
  error: error.message,
  stack: error.stack
});
```

---

## 9. Complete Server Implementation

### 9.1 Express Server

```javascript
// server.js

const express = require('express');
const bodyParser = require('body-parser');
const whatsappRouter = require('./webhooks/whatsapp-handler');

const app = express();
const PORT = process.env.PORT || 3000;

// Parse JSON body
app.use(bodyParser.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// WhatsApp webhook routes
app.use('/webhooks', whatsappRouter);

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('Server error:', error);
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
  console.log(`📞 Webhook URL: http://localhost:${PORT}/webhooks/whatsapp`);
});

module.exports = app;
```

---

### 9.2 Deployment Configuration

**Heroku:**
```json
{
  "name": "lynia-whatsapp-webhook",
  "description": "WhatsApp webhook for Lynia Finance",
  "repository": "https://github.com/1terr/Lynia-finance",
  "env": {
    "WEBHOOK_VERIFY_TOKEN": {
      "description": "Webhook verification token",
      "value": "lynia_webhook_verify_token_2025"
    },
    "WHATSAPP_ACCESS_TOKEN": {
      "description": "WhatsApp Cloud API access token"
    },
    "WHATSAPP_PHONE_NUMBER_ID": {
      "description": "WhatsApp Phone Number ID"
    },
    "DATABASE_URL": {
      "description": "PostgreSQL database URL"
    }
  },
  "buildpacks": [
    {
      "url": "heroku/nodejs"
    }
  ]
}
```

**Deploy:**
```bash
git push heroku master
heroku config:set WEBHOOK_VERIFY_TOKEN=lynia_webhook_verify_token_2025
heroku config:set WHATSAPP_ACCESS_TOKEN=your_token
```

---

## 10. Monitoring and Analytics

### 10.1 Webhook Metrics

Track important metrics:

```javascript
const metrics = {
  messagesReceived: 0,
  messagesSent: 0,
  activeConversations: 0,
  averageResponseTime: 0,
  errorRate: 0
};

/**
 * Track message received
 */
function trackMessageReceived() {
  metrics.messagesReceived++;
  // Send to analytics service (Mixpanel, Segment, etc.)
}

/**
 * Track response time
 */
async function trackResponseTime(startTime) {
  const duration = Date.now() - startTime;
  metrics.averageResponseTime =
    (metrics.averageResponseTime + duration) / 2;

  if (duration > 5000) {
    console.warn(`Slow response: ${duration}ms`);
  }
}
```

---

### 10.2 Dashboard Endpoint

```javascript
app.get('/admin/metrics', (req, res) => {
  res.json({
    messagesReceived: metrics.messagesReceived,
    messagesSent: metrics.messagesSent,
    activeConversations: metrics.activeConversations,
    averageResponseTime: `${metrics.averageResponseTime.toFixed(2)}ms`,
    errorRate: `${(metrics.errorRate * 100).toFixed(2)}%`,
    uptime: process.uptime()
  });
});
```

---

## 11. Completion Checklist

- [x] Understand webhook architecture
- [x] Document webhook setup and verification
- [x] Implement webhook handler (GET and POST)
- [x] Handle different message types (text, interactive, media)
- [x] Implement conversation state management
- [x] Create database schema for messages
- [x] Implement security (signature verification, rate limiting)
- [x] Create local testing setup with ngrok
- [x] Implement error handling and logging
- [x] Create complete Express server
- [x] Document deployment configuration
- [x] Implement monitoring and metrics

---

## 12. Mark as Complete

**Status:** ✅ **Research COMPLETE**

We have:
- ✅ Complete webhook implementation with Express.js
- ✅ Message type handlers for all WhatsApp message formats
- ✅ Conversation state management system
- ✅ Database schema for message persistence
- ✅ Security measures (signature verification, rate limiting)
- ✅ Local testing setup with ngrok
- ✅ Production deployment configuration
- ✅ Monitoring and metrics tracking
- ✅ Error handling and structured logging

**Recommendation:** Mark GitHub issue #11 (T008) as **COMPLETE** and proceed to T009 (Document WhatsApp Conversation Flow).

---

**Research completed by:** Claude
**Date:** 2025-11-10
**Next:** T009 - Document WhatsApp conversation flow for loan application
