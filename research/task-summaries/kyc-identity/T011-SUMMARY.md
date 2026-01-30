# T011: WhatsApp Conversation Error Handling - Research Summary

**Status:** ✅ Research Complete (Documentation-based)
**Date:** 2025-11-10
**GitHub Issue:** https://github.com/1terr/Lynia-finance/issues/14

---

## Executive Summary

Error handling in conversational UI is critical for user experience. For Lynia Finance's WhatsApp bot, we must gracefully handle invalid inputs, timeouts, system errors, API failures, and edge cases while maintaining a helpful, friendly tone and guiding customers toward successful completion.

**Key Finding:** Good error handling transforms frustration into trust. Clear error messages, helpful suggestions, and easy recovery paths are essential for maintaining high application completion rates (target: 70%+).

---

## 1. Error Handling Philosophy

### 1.1 Core Principles

**1. Be Helpful, Not Critical**
```
❌ Bad: "Invalid input. Try again."
✅ Good: "I didn't quite get that. Let me help! Please enter your National ID like this: 63-123456-A-12"
```

**2. Provide Clear Examples**
```
❌ Bad: "Phone number format incorrect"
✅ Good: "Please enter your phone number starting with 263. Example: 263771234567"
```

**3. Offer Easy Recovery**
```
❌ Bad: "Error occurred. Restart application."
✅ Good: "Something went wrong, but I saved your progress! Reply CONTINUE to pick up where you left off."
```

**4. Escalate Gracefully**
```
After 3 failed attempts:
"I'm having trouble understanding. Let me connect you with a human agent who can help. ⏳ Please wait..."
```

**5. Learn from Errors**
```javascript
// Track common errors to improve prompts
async function logUserError(phone, errorType, userInput) {
  await db.errorLog.create({
    phone: phone,
    errorType: errorType,
    userInput: userInput,
    timestamp: new Date()
  });

  // If this error is common, improve the prompt
  const errorCount = await db.errorLog.countRecent(errorType);
  if (errorCount > 100) {
    await notifyTeam(`Common error detected: ${errorType}`);
  }
}
```

---

### 1.2 Error Categories

| Category | Severity | Response Time | Escalation |
|----------|----------|---------------|------------|
| **User Input Errors** | Low | Immediate | After 3 attempts |
| **Validation Errors** | Low-Medium | Immediate | After 3 attempts |
| **Timeout Errors** | Medium | 10 min, 24h | After 48h |
| **System Errors** | High | Immediate | After 2 failures |
| **API Errors** | High | Auto-retry | After 3 retries |
| **Network Errors** | Medium | Auto-retry | Alert after 5 min |

---

## 2. User Input Error Handling

### 2.1 Invalid Format Errors

#### National ID Format Error

**Scenario:** Customer enters "631234567A12" instead of "63-1234567-A-12"

**Detection:**
```javascript
function validateNationalId(input) {
  const pattern = /^\d{2}-\d{6,7}-[A-Z]-\d{2}$/;

  if (!pattern.test(input)) {
    return {
      valid: false,
      error: 'invalid_format',
      suggestion: attemptAutoCorrection(input)
    };
  }

  return { valid: true };
}

function attemptAutoCorrection(input) {
  // Remove all non-alphanumeric characters
  const cleaned = input.replace(/[^0-9A-Z]/gi, '').toUpperCase();

  // Try to format: XX-XXXXXXX-L-XX
  if (cleaned.length >= 11 && cleaned.length <= 12) {
    const formatted = `${cleaned.slice(0, 2)}-${cleaned.slice(2, -3)}-${cleaned.slice(-3, -2)}-${cleaned.slice(-2)}`;

    // Verify formatted version
    if (/^\d{2}-\d{6,7}-[A-Z]-\d{2}$/.test(formatted)) {
      return formatted;
    }
  }

  return null;
}
```

**Response (with auto-correction):**
```
I think you meant: *63-1234567-A-12*

Is this your National ID?

Reply *YES* to confirm or *NO* to re-enter.
```

**Response (without auto-correction):**
```
Invalid National ID format.

Please use this format: 63-123456-A-12

*Example:*
63-1234567-A-12

Make sure to include the dashes (-).
```

**After 3 Failed Attempts:**
```
I'm having trouble with your National ID. 😔

Let me connect you with our support team who can help you directly.

⏳ An agent will respond within 5 minutes.
```

---

#### Phone Number Format Error

**Scenario:** Customer enters "0771234567" instead of "263771234567"

**Auto-Correction:**
```javascript
function normalizePhoneNumber(input) {
  // Remove all non-digit characters
  let cleaned = input.replace(/\D/g, '');

  // If starts with 0, replace with 263
  if (cleaned.startsWith('0')) {
    cleaned = '263' + cleaned.substring(1);
  }

  // If doesn't start with 263, prepend it
  if (!cleaned.startsWith('263')) {
    cleaned = '263' + cleaned;
  }

  // Validate length (should be 12 digits: 263 + 9 digits)
  if (cleaned.length === 12 && /^263[0-9]{9}$/.test(cleaned)) {
    return { valid: true, normalized: cleaned };
  }

  return { valid: false, normalized: null };
}
```

**Response (with auto-correction):**
```
Got it! I'll use: *263771234567*

Is this correct?

Reply *YES* to confirm or *NO* to re-enter.
```

**Response (format error):**
```
Please enter your phone number with country code.

*Format:* 263771234567

Zimbabwe country code is 263, followed by your 9-digit number.
```

---

#### Income Format Error

**Scenario:** Customer enters "two hundred fifty" instead of "250"

**Detection:**
```javascript
function parseIncome(input) {
  // Remove currency symbols and commas
  let cleaned = input.replace(/[$,\s]/g, '');

  // Try to parse as number
  const amount = parseFloat(cleaned);

  if (isNaN(amount)) {
    return { valid: false, error: 'not_a_number' };
  }

  if (amount < 0) {
    return { valid: false, error: 'negative_amount' };
  }

  if (amount < 50) {
    return { valid: false, error: 'below_minimum' };
  }

  if (amount > 10000) {
    return { valid: false, error: 'suspiciously_high' };
  }

  return { valid: true, amount: amount };
}
```

**Response (not a number):**
```
Please enter your monthly income as a number.

*Example:* 250 (for $250/month)

Don't include currency symbols or commas.
```

**Response (below minimum):**
```
Our minimum income requirement is $50/month.

If your income is at least $50, please re-enter the correct amount.

If not, you may reapply in the future when your income increases.

Reply *SUPPORT* if you think this is an error.
```

**Response (suspiciously high):**
```
The amount you entered ($15,000) seems high for monthly income.

Did you mean:
• *$1,500* per month? (Reply 1500)
• *$15,000* per year? (Reply 1250 for monthly)

Or reply with the correct monthly amount.
```

---

### 2.2 Unexpected Input Handling

#### Customer Sends Wrong Message Type

**Scenario:** Bot asks for name, customer sends voice message

**Detection:**
```javascript
async function handleIncomingMessage(message) {
  const state = await getConversationState(message.from);

  switch (message.type) {
    case 'text':
      return await handleTextMessage(message, state);

    case 'audio':
    case 'voice':
      return await handleUnexpectedMedia(message, state, 'voice message');

    case 'video':
      return await handleUnexpectedMedia(message, state, 'video');

    case 'sticker':
      return await handleSticker(message, state);

    case 'location':
      return await handleUnexpectedMedia(message, state, 'location');

    default:
      return await handleUnknownMessageType(message, state);
  }
}

async function handleUnexpectedMedia(message, state, mediaType) {
  if (state === 'kyc_id_photo' || state === 'kyc_selfie') {
    // Photo expected, but got something else
    return await sendMessage(message.from, `
I need a photo, not a ${mediaType}. 📸

Please send a clear photo of your National ID.
    `.trim());
  } else {
    // Text expected
    return await sendMessage(message.from, `
I received your ${mediaType}, but I need a text reply right now.

Please type your answer.
    `.trim());
  }
}
```

**Response:**
```
I received your voice message, but I need a text reply for this question.

Please type your full name.

*Example:* John Doe
```

---

#### Customer Sends Command at Wrong Time

**Scenario:** Bot asks for National ID, customer sends "BALANCE"

**Detection:**
```javascript
async function handleTextMessage(message, state) {
  const text = message.text.body.trim().toUpperCase();

  // Check if it's a global command
  const globalCommands = ['HELP', 'CANCEL', 'START'];
  if (globalCommands.includes(text)) {
    return await handleGlobalCommand(message.from, text);
  }

  // Check if it's a command in wrong context
  const outOfContextCommands = ['BALANCE', 'PAY', 'SCHEDULE'];
  if (outOfContextCommands.includes(text) && !state.includes('loan_active')) {
    return await handleOutOfContextCommand(message.from, text, state);
  }

  // Process normally
  return await processConversationState(message, state);
}

async function handleOutOfContextCommand(phone, command, state) {
  await sendMessage(phone, `
I see you want to ${command.toLowerCase()}, but you don't have an active loan yet.

Let's finish your application first!

Please answer the previous question, or reply *CANCEL* to stop.
  `.trim());
}
```

**Response:**
```
I see you want to check your balance, but you don't have an active loan yet.

Let's finish your application first!

Please enter your National ID: 63-123456-A-12
```

---

#### Customer Changes Mind Mid-Application

**Scenario:** Customer is halfway through application and wants to start over

**Detection:**
```javascript
async function handleGlobalCommand(phone, command) {
  const state = await getConversationState(phone);

  if (command === 'CANCEL') {
    return await handleCancel(phone, state);
  } else if (command === 'START' || command === 'RESTART') {
    return await handleRestart(phone, state);
  } else if (command === 'HELP') {
    return await handleHelp(phone, state);
  }
}

async function handleCancel(phone, state) {
  if (state.state === 'idle' || state.state === 'welcome') {
    return await sendMessage(phone, "You don't have an active application.");
  }

  // Save partial data
  await savePartialApplication(phone, state);

  // Reset state
  await updateConversationState(phone, 'idle', {});

  await sendMessage(phone, `
Application cancelled.

Your progress has been saved for 48 hours.

Reply *CONTINUE* to resume or *APPLY* to start fresh.
  `.trim());
}

async function handleRestart(phone, state) {
  if (state.state === 'idle') {
    return await startApplication(phone);
  }

  await sendMessage(phone, `
Are you sure you want to restart? Your current progress will be lost.

Reply *YES* to restart or *NO* to continue.
  `.trim());

  await updateConversationState(phone, 'confirm_restart', { previousState: state });
}
```

**Response:**
```
Application cancelled.

Your progress has been saved for 48 hours.

Reply *CONTINUE* to resume or *APPLY* to start fresh.
```

---

### 2.3 Validation Error Recovery

#### Duplicate National ID

**Scenario:** National ID already registered

**Response:**
```
This National ID is already registered in our system.

*Possible reasons:*
• You've already applied before
• Someone else used this ID (identity theft)

*What you can do:*
Reply *MYACCOUNT* to access your existing account

Or reply *FRAUD* if you think someone used your ID without permission
```

**Follow-up Actions:**
```javascript
async function handleDuplicateNationalId(phone, nationalId) {
  const existingCustomer = await db.customers.findByNationalId(nationalId);

  // Check if same phone number
  if (existingCustomer.phone === phone) {
    // Same person, redirect to existing account
    await sendMessage(phone, `
Welcome back! You already have an account.

*Your Status:*
${existingCustomer.hasActiveLoan ?
  `Active Loan: $${existingCustomer.loanBalance} remaining` :
  'No active loan'}

Reply *BALANCE* to check details or *APPLY* for a new loan.
    `.trim());
  } else {
    // Different phone, possible fraud
    await notifySecurityTeam({
      type: 'duplicate_national_id',
      nationalId: nationalId,
      existingPhone: existingCustomer.phone,
      newPhone: phone
    });

    await sendMessage(phone, `
This National ID is registered with a different phone number.

For security, a member of our team will contact you to verify your identity.

*Reference:* SEC-${Date.now()}

You'll hear from us within 24 hours.
    `.trim());
  }
}
```

---

#### KYC Photo Quality Issues

**Scenario:** ID photo is blurry or incomplete

**Detection:**
```javascript
async function validateIdPhoto(imageBuffer) {
  try {
    // Check image quality using image processing
    const quality = await checkImageQuality(imageBuffer);

    if (quality.brightness < 50) {
      return { valid: false, error: 'too_dark' };
    }

    if (quality.blur > 0.7) {
      return { valid: false, error: 'too_blurry' };
    }

    if (quality.size < 100000) { // 100KB
      return { valid: false, error: 'too_small' };
    }

    // Try OCR to detect text
    const ocrResult = await performOCR(imageBuffer);
    if (!ocrResult.text || ocrResult.text.length < 20) {
      return { valid: false, error: 'no_text_detected' };
    }

    return { valid: true };
  } catch (error) {
    return { valid: false, error: 'processing_failed' };
  }
}
```

**Responses:**

**Too Dark:**
```
❌ Photo is too dark

Please take another photo with better lighting:
• Use natural daylight if possible
• Or turn on room lights
• Avoid shadows

Send the new photo when ready.
```

**Too Blurry:**
```
❌ Photo is blurry

Please retake with:
• Steady hands (no movement)
• Good focus (tap to focus)
• Clear view of all text

Try again when ready!
```

**No Text Detected:**
```
❌ Can't read the ID in this photo

Make sure:
• Entire ID is in frame
• All text is visible
• No glare or reflections
• ID is flat (not bent)

Send a clearer photo.
```

**After 3 Failed Attempts:**
```
Having trouble with the photo? 😔

*Try these tips:*
• Place ID on dark background
• Use camera app (not WhatsApp camera)
• Take photo in good light
• Make sure all corners are visible

Or tap "Get Help" to speak with an agent.
```

---

## 3. Timeout Error Handling

### 3.1 Short Timeout (10 Minutes)

**Scenario:** Customer starts application but doesn't respond to a question

**Implementation:**
```javascript
// Set timeout when question is asked
async function askQuestion(phone, question, state) {
  await sendMessage(phone, question);

  // Schedule timeout check
  await scheduleTimeout(phone, state, 10 * 60 * 1000); // 10 minutes
}

async function scheduleTimeout(phone, state, delay) {
  setTimeout(async () => {
    const currentState = await getConversationState(phone);

    // Check if still in same state (no response)
    if (currentState.state === state &&
        currentState.updatedAt < new Date(Date.now() - delay)) {
      await handleShortTimeout(phone, state);
    }
  }, delay);
}

async function handleShortTimeout(phone, state) {
  const context = await getConversationContext(phone);

  await sendMessage(phone, `
Hi ${context.firstname || 'there'}, are you still there? 👋

I'm waiting for your answer to continue.

Reply *CONTINUE* to pick up where we left off, or *CANCEL* to stop.
  `.trim());

  // Track timeout
  await db.analytics.track({
    phone: phone,
    event: 'short_timeout',
    state: state,
    timestamp: new Date()
  });
}
```

**Response:**
```
Hi John, are you still there? 👋

I'm waiting for your National ID to continue.

Reply *CONTINUE* to pick up where we left off, or *CANCEL* to stop.
```

---

### 3.2 Medium Timeout (24 Hours)

**Scenario:** Customer hasn't responded for 24 hours

**Implementation:**
```javascript
// Daily cron job to check for stale applications
async function checkStaleApplications() {
  const staleApplications = await db.conversationState.find({
    state: { $ne: 'idle' },
    updatedAt: { $lt: new Date(Date.now() - 24 * 60 * 60 * 1000) }
  });

  for (const app of staleApplications) {
    await handleMediumTimeout(app.phone, app.state, app.context);
  }
}

async function handleMediumTimeout(phone, state, context) {
  await whatsapp.sendTemplateMessage(
    phone,
    'application_incomplete',
    'en',
    [context.firstname || 'there']
  );

  // Track timeout
  await db.analytics.track({
    phone: phone,
    event: 'medium_timeout',
    state: state,
    timestamp: new Date()
  });
}
```

**Template Message:**
```
Hi John, you started a loan application but didn't finish.

We saved your progress! Complete it now to get your device financing approved.

⏱️ Time remaining: 48 hours

Tap below to continue.

[Continue Application]
```

---

### 3.3 Long Timeout (48+ Hours)

**Scenario:** Customer abandoned application, auto-cleanup

**Implementation:**
```javascript
async function cleanupAbandonedApplications() {
  const abandoned = await db.conversationState.find({
    state: { $ne: 'idle' },
    updatedAt: { $lt: new Date(Date.now() - 48 * 60 * 60 * 1000) }
  });

  for (const app of abandoned) {
    // Archive partial data
    await archivePartialApplication(app);

    // Reset conversation state
    await updateConversationState(app.phone, 'idle', {});

    // Send final message
    await sendMessage(app.phone, `
Your application has expired due to inactivity.

Don't worry - you can start a new application anytime!

Reply *APPLY* when you're ready.
    `.trim());

    // Track abandonment
    await db.analytics.track({
      phone: app.phone,
      event: 'application_abandoned',
      lastState: app.state,
      timestamp: new Date()
    });
  }
}
```

**Response:**
```
Your application has expired due to inactivity.

Don't worry - you can start a new application anytime!

Reply *APPLY* when you're ready.
```

---

## 4. System Error Handling

### 4.1 API Errors (Fineract)

**Scenario:** Fineract API is down or returns error

**Detection & Recovery:**
```javascript
async function createLoanWithRetry(clientId, loanData, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const loan = await fineract.createLoan(loanData);
      return { success: true, loan: loan };
    } catch (error) {
      console.error(`Fineract API error (attempt ${attempt}):`, error);

      // Check if retryable
      if (isRetryableError(error)) {
        if (attempt < maxRetries) {
          // Exponential backoff
          const delay = Math.pow(2, attempt) * 1000;
          await sleep(delay);
          continue;
        }
      }

      // Not retryable or max retries reached
      return { success: false, error: error };
    }
  }
}

function isRetryableError(error) {
  // Network errors - retry
  if (error.code === 'ECONNREFUSED' ||
      error.code === 'ETIMEDOUT' ||
      error.code === 'ENOTFOUND') {
    return true;
  }

  // Server errors (5xx) - retry
  if (error.response && error.response.status >= 500) {
    return true;
  }

  // Client errors (4xx) - don't retry
  if (error.response && error.response.status >= 400 && error.response.status < 500) {
    return false;
  }

  return false;
}
```

**Customer Communication:**
```javascript
async function handleLoanCreationError(phone, error) {
  // Send user-friendly message
  await sendMessage(phone, `
😔 Sorry, we're experiencing technical difficulties.

Your application is saved. Our team has been notified and will process it manually.

*Reference Number:* ERR-${Date.now()}

You'll receive an update within 2 hours.

Questions? Reply *SUPPORT*
  `.trim());

  // Alert team
  await notifyTeam({
    type: 'loan_creation_failed',
    phone: phone,
    error: error.message,
    reference: `ERR-${Date.now()}`
  });

  // Queue for manual processing
  await db.manualQueue.create({
    phone: phone,
    action: 'create_loan',
    data: await getConversationContext(phone),
    status: 'pending',
    createdAt: new Date()
  });
}
```

**Response:**
```
😔 Sorry, we're experiencing technical difficulties.

Your application is saved. Our team has been notified and will process it manually.

*Reference Number:* ERR-1699564812345

You'll receive an update within 2 hours.

Questions? Reply *SUPPORT*
```

---

### 4.2 Database Errors

**Scenario:** Database connection lost

**Implementation:**
```javascript
async function handleDatabaseError(operation, error) {
  console.error('Database error:', error);

  // Try to reconnect
  try {
    await db.reconnect();
    console.log('Database reconnected');

    // Retry operation
    return await operation();
  } catch (retryError) {
    // Still failing, alert team
    await sendAlert({
      severity: 'critical',
      message: 'Database connection lost',
      error: error.message
    });

    // Return generic error to user
    throw new Error('SYSTEM_ERROR');
  }
}

// Wrap database operations
async function saveCustomerSafely(customerData) {
  try {
    return await db.customers.create(customerData);
  } catch (error) {
    return await handleDatabaseError(
      () => db.customers.create(customerData),
      error
    );
  }
}
```

**Customer Communication:**
```
😔 We're having technical issues right now.

Your information is safe. Please try again in a few minutes.

*If urgent:* Call us at +263 771 234 567

Reference: SYS-${Date.now()}
```

---

### 4.3 WhatsApp API Errors

**Scenario:** WhatsApp API rate limit or error

**Detection & Handling:**
```javascript
async function sendMessageSafely(phone, message) {
  try {
    const result = await whatsapp.sendTextMessage(phone, message);

    if (!result.success) {
      throw new Error(result.error.message);
    }

    return result;
  } catch (error) {
    const errorCode = error.response?.data?.error?.code;

    switch (errorCode) {
      case 131031: // Rate limit
        return await handleRateLimit(phone, message);

      case 131047: // Message undeliverable
        return await handleUndeliverable(phone);

      case 130472: // User not found
        return await handleUserNotFound(phone);

      case 133016: // Service window expired
        return await handleServiceWindowExpired(phone, message);

      default:
        return await handleGenericWhatsAppError(phone, error);
    }
  }
}

async function handleRateLimit(phone, message) {
  console.warn('Rate limit hit, queuing message');

  // Queue message for later
  await db.messageQueue.create({
    phone: phone,
    message: message,
    retryAt: new Date(Date.now() + 60000), // Retry in 1 minute
    status: 'queued'
  });

  return { success: false, queued: true };
}

async function handleUndeliverable(phone) {
  console.error(`Message undeliverable to ${phone}`);

  // Mark customer as unreachable
  await db.customers.update(
    { phone: phone },
    { unreachable: true, unreachableSince: new Date() }
  );

  // Try SMS as backup
  await sendSMS(phone, 'WhatsApp message failed. Please check your WhatsApp or call us at +263 771 234 567');

  return { success: false, unreachable: true };
}

async function handleServiceWindowExpired(phone, message) {
  console.log('Service window expired, using template');

  // Convert to template message
  // (This requires pre-approved templates)
  await sendFallbackTemplate(phone, message);

  return { success: true, usedTemplate: true };
}
```

---

## 5. Network Error Handling

### 5.1 Customer Network Issues

**Scenario:** Customer has poor internet connection

**Detection:**
```javascript
// Detect slow responses
async function trackResponseTime(phone) {
  const lastMessage = await db.messages.findLatest({
    phone: phone,
    direction: 'outbound'
  });

  const thisMessage = await db.messages.findLatest({
    phone: phone,
    direction: 'inbound'
  });

  if (lastMessage && thisMessage) {
    const responseTime = thisMessage.timestamp - lastMessage.timestamp;

    if (responseTime > 5 * 60 * 1000) { // 5+ minutes
      // Slow response, possible network issues
      await checkNetworkIssues(phone);
    }
  }
}

async function checkNetworkIssues(phone) {
  // Check message delivery status
  const recentMessages = await db.messages.find({
    phone: phone,
    direction: 'outbound',
    timestamp: { $gt: new Date(Date.now() - 30 * 60 * 1000) }
  });

  const failedDeliveries = recentMessages.filter(m =>
    m.status === 'failed' || m.status === 'undelivered'
  );

  if (failedDeliveries.length > 3) {
    // Likely network issues
    await handleNetworkIssues(phone);
  }
}

async function handleNetworkIssues(phone) {
  await sendMessage(phone, `
Having connection issues? 📶

*Tips:*
• Check your data bundle
• Try WiFi if available
• Move to better signal area

Your progress is saved. Reply when you have better connection.
  `.trim());
}
```

---

### 5.2 Server Network Issues

**Scenario:** Server can't reach external APIs

**Circuit Breaker Pattern:**
```javascript
class CircuitBreaker {
  constructor(threshold = 5, timeout = 60000) {
    this.failureCount = 0;
    this.threshold = threshold;
    this.timeout = timeout;
    this.state = 'CLOSED'; // CLOSED, OPEN, HALF_OPEN
    this.nextAttempt = Date.now();
  }

  async execute(fn) {
    if (this.state === 'OPEN') {
      if (Date.now() < this.nextAttempt) {
        throw new Error('Circuit breaker is OPEN - service unavailable');
      }
      this.state = 'HALF_OPEN';
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  onSuccess() {
    this.failureCount = 0;
    this.state = 'CLOSED';
  }

  onFailure() {
    this.failureCount++;
    if (this.failureCount >= this.threshold) {
      this.state = 'OPEN';
      this.nextAttempt = Date.now() + this.timeout;

      // Alert team
      sendAlert({
        severity: 'high',
        message: `Circuit breaker opened after ${this.failureCount} failures`,
        service: 'fineract'
      });
    }
  }
}

// Usage
const fineractCircuitBreaker = new CircuitBreaker();

async function callFineractSafely(operation) {
  try {
    return await fineractCircuitBreaker.execute(operation);
  } catch (error) {
    if (error.message.includes('Circuit breaker is OPEN')) {
      // Service is down, handle gracefully
      return { success: false, serviceDown: true };
    }
    throw error;
  }
}
```

---

## 6. Edge Cases

### 6.1 Customer Sends Multiple Messages Rapidly

**Scenario:** Customer sends 5 messages in quick succession

**Handling:**
```javascript
async function handleRapidMessages(phone, messages) {
  // Combine messages into one response
  const combinedInput = messages.map(m => m.text.body).join(' ');

  // Send single response
  await sendMessage(phone, `
I received multiple messages from you. 😊

Please send one message at a time so I can help you better.

Let's continue: ${await getNextQuestion(phone)}
  `.trim());

  // Process only the last message
  return await processMessage(messages[messages.length - 1]);
}
```

---

### 6.2 Customer Sends Very Long Message

**Scenario:** Customer sends 1000+ character message

**Handling:**
```javascript
function validateMessageLength(text) {
  if (text.length > 500) {
    return {
      valid: false,
      error: 'too_long'
    };
  }
  return { valid: true };
}

async function handleTooLongMessage(phone) {
  await sendMessage(phone, `
That message was quite long! 😅

Please keep your answer short and simple.

${await getNextQuestion(phone)}
  `.trim());
}
```

---

### 6.3 Customer Uses Inappropriate Language

**Scenario:** Customer uses profanity or abusive language

**Detection:**
```javascript
const inappropriateWords = ['bad_word1', 'bad_word2']; // Full list in production

function containsInappropriateLanguage(text) {
  const lowerText = text.toLowerCase();
  return inappropriateWords.some(word => lowerText.includes(word));
}

async function handleInappropriateLanguage(phone) {
  await sendMessage(phone, `
Please keep the conversation professional.

Our team is here to help you get device financing.

Let's continue: ${await getNextQuestion(phone)}
  `.trim());

  // Log for review
  await db.flaggedMessages.create({
    phone: phone,
    reason: 'inappropriate_language',
    timestamp: new Date()
  });
}
```

---

### 6.4 Customer Tries to Exploit System

**Scenario:** Customer tries SQL injection, XSS, or other attacks

**Detection & Prevention:**
```javascript
function sanitizeInput(input) {
  // Remove control characters
  let sanitized = input.replace(/[\x00-\x1F\x7F]/g, '');

  // Check for SQL injection patterns
  const sqlPatterns = [
    /('|(\\')|(;)|(--)|(\\)|(%27)|(%3D)|(\*)|(\bor\b)|(\band\b)/gi
  ];

  if (sqlPatterns.some(pattern => pattern.test(sanitized))) {
    throw new Error('SUSPICIOUS_INPUT');
  }

  // Check for script tags
  if (/<script|javascript:/i.test(sanitized)) {
    throw new Error('SUSPICIOUS_INPUT');
  }

  return sanitized;
}

async function handleSuspiciousInput(phone) {
  // Block user temporarily
  await db.customers.update(
    { phone: phone },
    { blocked: true, blockedReason: 'suspicious_input', blockedAt: new Date() }
  );

  // Alert security team
  await notifySecurityTeam({
    type: 'suspicious_input',
    phone: phone,
    timestamp: new Date()
  });

  await sendMessage(phone, `
For security reasons, your account has been temporarily suspended.

Our security team will review and contact you within 24 hours.

*Reference:* SEC-${Date.now()}
  `.trim());
}
```

---

## 7. Error Recovery Workflows

### 7.1 Resume After Error

**Implementation:**
```javascript
async function resumeConversation(phone) {
  const state = await getConversationState(phone);
  const context = state.context;

  if (state.state === 'idle') {
    return await sendMessage(phone, `
You don't have an application in progress.

Reply *APPLY* to start a new loan application!
    `.trim());
  }

  // Resume from last step
  const lastQuestion = getQuestionForState(state.state);

  await sendMessage(phone, `
Welcome back! Let's continue from where we left off.

${lastQuestion}
  `.trim());
}
```

---

### 7.2 Backtrack to Previous Step

**Implementation:**
```javascript
async function handleBack(phone) {
  const state = await getConversationState(phone);
  const previousState = getPreviousState(state.state);

  if (!previousState) {
    return await sendMessage(phone, `
You're at the beginning. Can't go back further!

Reply *CANCEL* to stop or answer the question to continue.
    `.trim());
  }

  // Go back one step
  await updateConversationState(phone, previousState, state.context);

  await sendMessage(phone, `
Going back...

${getQuestionForState(previousState)}
  `.trim());
}

function getPreviousState(currentState) {
  const stateFlow = [
    'welcome',
    'onboarding_name',
    'onboarding_national_id',
    'onboarding_phone_verify',
    'onboarding_income',
    'onboarding_employment',
    'kyc_id_photo',
    'kyc_selfie'
  ];

  const currentIndex = stateFlow.indexOf(currentState);
  if (currentIndex > 0) {
    return stateFlow[currentIndex - 1];
  }

  return null;
}
```

---

## 8. Error Analytics & Monitoring

### 8.1 Error Tracking

**Implementation:**
```javascript
async function trackError(errorType, details) {
  await db.errorLog.create({
    errorType: errorType,
    details: details,
    timestamp: new Date()
  });

  // Real-time monitoring
  await sendToMonitoring({
    metric: `error.${errorType}`,
    value: 1,
    tags: {
      severity: details.severity || 'medium',
      component: details.component || 'chatbot'
    }
  });
}

// Error types
const ERROR_TYPES = {
  USER_INPUT: 'user_input_error',
  VALIDATION: 'validation_error',
  TIMEOUT: 'timeout_error',
  API: 'api_error',
  SYSTEM: 'system_error',
  NETWORK: 'network_error'
};
```

---

### 8.2 Error Dashboard

**Metrics to Track:**
```javascript
async function getErrorMetrics() {
  const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000);

  return {
    totalErrors: await db.errorLog.count({ timestamp: { $gt: last24h } }),
    byType: await db.errorLog.aggregate([
      { $match: { timestamp: { $gt: last24h } } },
      { $group: { _id: '$errorType', count: { $sum: 1 } } }
    ]),
    byHour: await db.errorLog.aggregate([
      { $match: { timestamp: { $gt: last24h } } },
      { $group: {
        _id: { $hour: '$timestamp' },
        count: { $sum: 1 }
      } }
    ]),
    topErrors: await db.errorLog.aggregate([
      { $match: { timestamp: { $gt: last24h } } },
      { $group: { _id: '$details.message', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 }
    ])
  };
}
```

---

### 8.3 Alerting Rules

**Alert Thresholds:**
```javascript
const ALERT_THRESHOLDS = {
  ERROR_RATE_5MIN: 10,      // More than 10 errors in 5 minutes
  ERROR_RATE_HOUR: 50,       // More than 50 errors in 1 hour
  TIMEOUT_RATE: 0.20,        // More than 20% timeout rate
  API_FAILURE_RATE: 0.10,    // More than 10% API failures
  SYSTEM_ERROR_COUNT: 5      // Any 5 system errors
};

async function checkAlertThresholds() {
  const metrics = await getErrorMetrics();

  // Check error rate
  const errorRateLast5Min = await db.errorLog.count({
    timestamp: { $gt: new Date(Date.now() - 5 * 60 * 1000) }
  });

  if (errorRateLast5Min > ALERT_THRESHOLDS.ERROR_RATE_5MIN) {
    await sendAlert({
      severity: 'high',
      message: `High error rate: ${errorRateLast5Min} errors in last 5 minutes`
    });
  }

  // Check timeout rate
  const totalConversations = await db.conversationState.count();
  const timeouts = await db.errorLog.count({
    errorType: 'timeout_error',
    timestamp: { $gt: new Date(Date.now() - 60 * 60 * 1000) }
  });

  const timeoutRate = timeouts / totalConversations;
  if (timeoutRate > ALERT_THRESHOLDS.TIMEOUT_RATE) {
    await sendAlert({
      severity: 'medium',
      message: `High timeout rate: ${(timeoutRate * 100).toFixed(2)}%`
    });
  }
}
```

---

## 9. Completion Checklist

- [x] Document error handling philosophy
- [x] Create user input error handlers
- [x] Implement validation error recovery
- [x] Document timeout handling (3 levels)
- [x] Create system error handlers
- [x] Implement network error handling
- [x] Document edge cases
- [x] Create error recovery workflows
- [x] Implement error analytics & monitoring
- [x] Define alerting rules

---

## 10. Mark as Complete

**Status:** ✅ **Research COMPLETE**

We have:
- ✅ Comprehensive error handling strategy
- ✅ User-friendly error messages with examples
- ✅ Auto-correction for common mistakes
- ✅ Timeout handling at 3 levels (10min, 24h, 48h)
- ✅ System error recovery with retries
- ✅ Circuit breaker for API failures
- ✅ Edge case handling (rapid messages, long text, inappropriate content)
- ✅ Error analytics and monitoring
- ✅ Graceful escalation to human support

**Recommendation:** Mark GitHub issue #14 (T011) as **COMPLETE** and proceed to T012 (Conversation Testing Strategy).

---

**Research completed by:** Claude
**Date:** 2025-11-10
**Next:** T012 - Document testing strategy for WhatsApp conversations
