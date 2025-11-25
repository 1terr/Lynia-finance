# WhatsApp Natural Language Understanding (NLU) Design

**Task ID**: P1-T012
**Phase**: Phase 1 - WhatsApp Bot Design
**Priority**: Low
**Estimated**: 8 hours
**Dependencies**: P1-T007 (Conversation Flow Design)

---

## Table of Contents
1. [Overview](#overview)
2. [Intent Recognition](#intent-recognition)
3. [Entity Extraction](#entity-extraction)
4. [Fallback Handling](#fallback-handling)
5. [Context-Aware Responses](#context-aware-responses)
6. [Multi-Language Support](#multi-language-support)
7. [Implementation Guide](#implementation-guide)
8. [Testing Strategy](#testing-strategy)
9. [Performance Optimization](#performance-optimization)

---

## 1. Overview

Natural Language Understanding (NLU) enables the Lynia Finance WhatsApp bot to understand user messages in natural language, extract key information, and respond intelligently.

### NLU Pipeline

```
User Message
    ↓
Text Normalization (lowercase, trim, remove special chars)
    ↓
Intent Classification (rule-based + keyword matching)
    ↓
Entity Extraction (phone, ID, amount, dates)
    ↓
Context Resolution (use session state)
    ↓
Response Generation
    ↓
Send WhatsApp Message
```

### Design Principles

1. **Simplicity First**: Use rule-based NLU before ML models (cost optimization)
2. **Zimbabwe Context**: Support local language patterns and formats
3. **Graceful Degradation**: Always provide fallback for unknown inputs
4. **Context-Aware**: Use session state to disambiguate intents
5. **Fast Response**: Process in <200ms for 95% of messages

### NLU Technology Stack

| Component | Technology | Justification |
|-----------|-----------|---------------|
| **Intent Classification** | Rule-based regex + keywords | Simple, fast, no ML costs |
| **Entity Extraction** | Named regex patterns | Accurate for structured data (phone, ID) |
| **Fallback** | Levenshtein distance | Typo tolerance (e.g., "paymnt" → "payment") |
| **Context Management** | Session JSONB field | Fast retrieval from PostgreSQL |
| **Multi-Language** | i18n JSON files | Support English + Shona (Phase 2) |

---

## 2. Intent Recognition

### 2.1 Intent Taxonomy

**15 Core Intents** organized by category:

| Category | Intent | Example Messages | Priority |
|----------|--------|-----------------|----------|
| **Onboarding** | `intent_start` | "hello", "hi", "start" | High |
| | `intent_register` | "register", "sign up", "new account" | High |
| **KYC** | `intent_kyc_status` | "kyc status", "verification status" | Medium |
| | `intent_submit_kyc` | "submit documents", "verify my id" | High |
| **Browsing** | `intent_browse_devices` | "browse", "show phones", "available devices" | High |
| | `intent_device_details` | "tell me about samsung a14", "specs" | Medium |
| **Loans** | `intent_apply_loan` | "apply", "get loan", "buy phone" | High |
| | `intent_loan_status` | "loan status", "my loan", "application status" | Medium |
| **Payment** | `intent_make_payment` | "pay", "payment", "make payment" | High |
| | `intent_payment_history` | "payment history", "my payments" | Low |
| | `intent_reschedule_payment` | "reschedule", "change date", "extend" | Medium |
| **Account** | `intent_check_limit` | "credit limit", "my limit", "how much" | Medium |
| | `intent_account_info` | "account", "my account", "profile" | Low |
| **Support** | `intent_help` | "help", "support", "i need help" | High |
| | `intent_talk_to_human` | "agent", "human", "talk to someone" | High |
| **Other** | `intent_unknown` | Unrecognized messages | N/A |

### 2.2 Intent Classification (Rule-Based)

**Implementation**:
```typescript
interface Intent {
  name: string;
  patterns: RegExp[];
  keywords: string[];
  priority: number; // Higher = checked first
  requiresState?: BotState[]; // Only match in certain states
}

const INTENTS: Intent[] = [
  {
    name: 'intent_make_payment',
    patterns: [
      /^pay(ment)?$/i,
      /^make\s+payment$/i,
      /^i\s+want\s+to\s+pay$/i,
      /^pay\s+now$/i
    ],
    keywords: ['pay', 'payment', 'installment', 'balance'],
    priority: 10
  },
  {
    name: 'intent_browse_devices',
    patterns: [
      /^browse$/i,
      /^show\s+(me\s+)?(phones|devices)$/i,
      /^what\s+(phones|devices).*available$/i,
      /^(view|see)\s+catalog$/i
    ],
    keywords: ['browse', 'devices', 'phones', 'catalog', 'shop'],
    priority: 9
  },
  {
    name: 'intent_check_limit',
    patterns: [
      /^(my\s+)?(credit\s+)?limit$/i,
      /^how\s+much\s+can\s+i\s+(borrow|get)$/i,
      /^what.*my.*limit$/i
    ],
    keywords: ['limit', 'credit', 'borrow', 'qualify'],
    priority: 8
  },
  {
    name: 'intent_help',
    patterns: [
      /^help$/i,
      /^i\s+need\s+help$/i,
      /^support$/i
    ],
    keywords: ['help', 'support', 'stuck', 'problem'],
    priority: 7
  },
  {
    name: 'intent_talk_to_human',
    patterns: [
      /^(talk\s+to\s+)?(agent|human|person)$/i,
      /^speak\s+to\s+someone$/i,
      /^escalate$/i
    ],
    keywords: ['agent', 'human', 'person', 'representative'],
    priority: 11 // Highest priority
  }
];

async function classifyIntent(
  message: string,
  session: Session
): Promise<{ intent: string; confidence: number }> {
  const normalizedMessage = message.toLowerCase().trim();

  // Sort intents by priority (highest first)
  const sortedIntents = INTENTS.sort((a, b) => b.priority - a.priority);

  for (const intent of sortedIntents) {
    // Check if intent is valid for current state
    if (intent.requiresState && !intent.requiresState.includes(session.current_state)) {
      continue;
    }

    // Check regex patterns (exact match = confidence 1.0)
    for (const pattern of intent.patterns) {
      if (pattern.test(normalizedMessage)) {
        return { intent: intent.name, confidence: 1.0 };
      }
    }

    // Check keyword matching (confidence based on keyword count)
    const keywordMatches = intent.keywords.filter(keyword =>
      normalizedMessage.includes(keyword)
    ).length;

    if (keywordMatches > 0) {
      const confidence = Math.min(keywordMatches / intent.keywords.length, 0.8);
      return { intent: intent.name, confidence };
    }
  }

  // No match found
  return { intent: 'intent_unknown', confidence: 0.0 };
}
```

### 2.3 Context-Aware Intent Classification

**Problem**: "yes" could mean different things in different states

**Solution**: Use session state to disambiguate

```typescript
async function classifyIntentWithContext(
  message: string,
  session: Session
): Promise<{ intent: string; confidence: number }> {
  const normalizedMessage = message.toLowerCase().trim();

  // Handle affirmative/negative responses based on state
  if (['yes', 'yeah', 'yep', 'ok', 'okay', 'confirm'].includes(normalizedMessage)) {
    switch (session.current_state) {
      case 'KYC_SUBMIT':
        return { intent: 'intent_confirm_kyc', confidence: 1.0 };
      case 'LOAN_APPLICATION':
        return { intent: 'intent_confirm_loan', confidence: 1.0 };
      case 'PAYMENT_CONFIRM':
        return { intent: 'intent_confirm_payment', confidence: 1.0 };
      default:
        return { intent: 'intent_affirmative', confidence: 0.7 };
    }
  }

  if (['no', 'nope', 'cancel', 'stop'].includes(normalizedMessage)) {
    return { intent: 'intent_cancel', confidence: 1.0 };
  }

  // Fallback to standard classification
  return classifyIntent(message, session);
}
```

### 2.4 Typo Tolerance with Levenshtein Distance

**Problem**: Users make typos ("paymnt", "brwse", "hlep")

**Solution**: Calculate edit distance to known keywords

```typescript
import { distance } from 'fastest-levenshtein';

function findClosestKeyword(input: string, keywords: string[], threshold: number = 2): string | null {
  let closestKeyword: string | null = null;
  let minDistance = Infinity;

  for (const keyword of keywords) {
    const dist = distance(input, keyword);
    if (dist < minDistance && dist <= threshold) {
      minDistance = dist;
      closestKeyword = keyword;
    }
  }

  return closestKeyword;
}

// Example usage:
const allKeywords = ['payment', 'browse', 'help', 'limit', 'loan', 'device'];
const userInput = 'paymnt'; // Typo

const corrected = findClosestKeyword(userInput, allKeywords, 2);
// Returns 'payment' (distance = 1)
```

---

## 3. Entity Extraction

### 3.1 Entity Types

**5 Entity Types** relevant to Zimbabwe and Lynia Finance:

| Entity Type | Pattern | Example | Validation |
|-------------|---------|---------|------------|
| **Phone Number** | `+263XXXXXXXXX` | +263771234567 | 13 chars, starts with +263 |
| **National ID** | `XX-XXXXXX-X-XX` | 63-123456-A-12 | Zimbabwe format |
| **Amount** | `$XX.XX` or `XX` | $47.81, 47 | 0.01 - 10000.00 |
| **Date** | `DD/MM/YYYY` | 30/01/2025 | Valid date |
| **Device Name** | Brand + Model | Samsung A14 | Match device catalog |

### 3.2 Entity Extraction Patterns

```typescript
interface Entity {
  type: string;
  value: string;
  rawValue: string;
  confidence: number;
  position: { start: number; end: number };
}

const ENTITY_PATTERNS = {
  phone_number: {
    pattern: /\+263\d{9}\b/g,
    validator: (value: string) => /^\+263\d{9}$/.test(value)
  },
  national_id: {
    pattern: /\b\d{2}-\d{6,7}-[A-Z]-\d{2}\b/g,
    validator: (value: string) => /^\d{2}-\d{6,7}-[A-Z]-\d{2}$/.test(value)
  },
  amount: {
    pattern: /\$?\d+(\.\d{1,2})?/g,
    validator: (value: string) => {
      const num = parseFloat(value.replace('$', ''));
      return num >= 0.01 && num <= 10000;
    }
  },
  date: {
    pattern: /\b\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4}\b/g,
    validator: (value: string) => {
      const [day, month, year] = value.split(/[\/\-]/).map(Number);
      const date = new Date(year, month - 1, day);
      return date.getFullYear() === year && date.getMonth() === month - 1;
    }
  },
  device_name: {
    // Extract device names from message (e.g., "Samsung A14", "Tecno Spark 10")
    pattern: /(samsung|tecno|infinix|xiaomi)\s+[a-z0-9\s]+/gi,
    validator: async (value: string) => {
      // Check if device exists in catalog
      const { data } = await supabase
        .from('devices')
        .select('id')
        .ilike('name', `%${value}%`)
        .limit(1);
      return data && data.length > 0;
    }
  }
};

async function extractEntities(message: string): Promise<Entity[]> {
  const entities: Entity[] = [];

  for (const [type, config] of Object.entries(ENTITY_PATTERNS)) {
    const matches = message.matchAll(config.pattern);

    for (const match of matches) {
      const rawValue = match[0];
      const value = rawValue.replace(/[\$\s]/g, ''); // Clean value

      // Validate entity
      const isValid = typeof config.validator === 'function'
        ? await config.validator(value)
        : config.validator(value);

      if (isValid) {
        entities.push({
          type,
          value,
          rawValue,
          confidence: 1.0,
          position: { start: match.index!, end: match.index! + rawValue.length }
        });
      }
    }
  }

  return entities;
}
```

### 3.3 Zimbabwe-Specific Entity Extraction

**National ID Validation**:
```typescript
function validateZimbabweNationalID(nationalId: string): {
  isValid: boolean;
  birthYear?: number;
  registrationNumber?: number;
  district?: string;
  checkDigit?: number;
} {
  const pattern = /^(\d{2})-(\d{6,7})-([A-Z])-(\d{2})$/;
  const match = nationalId.match(pattern);

  if (!match) {
    return { isValid: false };
  }

  const [_, birthYear, regNumber, district, checkDigit] = match;

  // Validate birth year (e.g., 63 = 1963, 05 = 2005)
  const year = parseInt(birthYear);
  const currentYear = new Date().getFullYear() % 100;
  const fullYear = year <= currentYear ? 2000 + year : 1900 + year;

  // Check age (must be 18+)
  const age = new Date().getFullYear() - fullYear;
  if (age < 18) {
    return { isValid: false };
  }

  return {
    isValid: true,
    birthYear: fullYear,
    registrationNumber: parseInt(regNumber),
    district,
    checkDigit: parseInt(checkDigit)
  };
}

// Example:
const result = validateZimbabweNationalID('63-123456-A-12');
// { isValid: true, birthYear: 1963, registrationNumber: 123456, district: 'A', checkDigit: 12 }
```

**Phone Number Normalization**:
```typescript
function normalizeZimbabwePhoneNumber(phone: string): string | null {
  // Remove spaces, dashes, parentheses
  let cleaned = phone.replace(/[\s\-\(\)]/g, '');

  // Handle different formats
  if (cleaned.startsWith('0')) {
    // 0771234567 → +263771234567
    cleaned = '+263' + cleaned.substring(1);
  } else if (cleaned.startsWith('263')) {
    // 263771234567 → +263771234567
    cleaned = '+' + cleaned;
  } else if (!cleaned.startsWith('+263')) {
    return null; // Invalid format
  }

  // Validate final format
  if (!/^\+263\d{9}$/.test(cleaned)) {
    return null;
  }

  return cleaned;
}

// Examples:
normalizeZimbabwePhoneNumber('0771234567') // +263771234567
normalizeZimbabwePhoneNumber('+263 77 123 4567') // +263771234567
normalizeZimbabwePhoneNumber('263771234567') // +263771234567
```

### 3.4 Amount Extraction for Payment

```typescript
function extractPaymentAmount(message: string): number | null {
  // Match currency amounts: $47.81, $47, 47.81, 47
  const patterns = [
    /\$(\d+(?:\.\d{1,2})?)/,  // $47.81
    /(\d+(?:\.\d{1,2})?)\s*(?:dollars?|usd)/i,  // 47.81 dollars
    /(?:pay|payment)\s+(?:of\s+)?(\d+(?:\.\d{1,2})?)/i  // payment of 47.81
  ];

  for (const pattern of patterns) {
    const match = message.match(pattern);
    if (match) {
      const amount = parseFloat(match[1]);
      if (amount >= 0.01 && amount <= 10000) {
        return amount;
      }
    }
  }

  return null;
}

// Examples:
extractPaymentAmount('pay $47.81') // 47.81
extractPaymentAmount('payment of 50 dollars') // 50
extractPaymentAmount('I want to pay 47') // 47
```

---

## 4. Fallback Handling

### 4.1 Fallback Hierarchy

```
User Message
    ↓
Intent Classification (confidence < 0.5?)
    ↓ Yes
Typo Correction (Levenshtein distance)
    ↓ Still unknown?
    ↓ Yes
Context-Based Suggestions (use session state)
    ↓ Still unknown?
    ↓ Yes
Generic Fallback (show menu)
```

### 4.2 Typo Correction Fallback

```typescript
async function handleTypoFallback(message: string, session: Session): Promise<void> {
  const allKeywords = ['payment', 'browse', 'help', 'limit', 'loan', 'device', 'kyc'];
  const closestKeyword = findClosestKeyword(message, allKeywords, 2);

  if (closestKeyword) {
    await sendWhatsAppMessage(session.phone_number, {
      type: 'text',
      text: {
        body: `Did you mean "${closestKeyword}"?\n\nReply YES to confirm, or type your message again.`
      }
    });

    // Store suggestion in session context
    await updateSessionContext(session.id, {
      fallback_suggestion: closestKeyword,
      fallback_original: message
    });
  } else {
    // No correction found, use generic fallback
    await handleGenericFallback(session);
  }
}
```

### 4.3 Context-Based Suggestions

**Problem**: User says something unclear in specific state

**Solution**: Provide state-specific suggestions

```typescript
async function handleContextFallback(session: Session): Promise<void> {
  const suggestions = {
    IDLE: [
      'Browse devices',
      'Make a payment',
      'Check your credit limit',
      'Get help'
    ],
    BROWSING: [
      'View device details',
      'Apply for a loan',
      'Go back to main menu'
    ],
    KYC_SUBMIT: [
      'Submit your national ID photo',
      'Submit a selfie',
      'Get KYC submission help'
    ],
    PAYMENT_MENU: [
      'Pay via EcoCash',
      'Pay via Paynow',
      'View payment history'
    ],
    SUPPORT: [
      'Payment issues',
      'Device issues',
      'Talk to a human agent'
    ]
  };

  const stateSuggestions = suggestions[session.current_state] || suggestions.IDLE;

  await sendWhatsAppMessage(session.phone_number, {
    type: 'text',
    text: {
      body: `I'm not sure what you mean. Here are some things you can do:\n\n${stateSuggestions.map((s, i) => `${i + 1}. ${s}`).join('\n')}\n\nReply with a number or type your message.`
    }
  });
}
```

### 4.4 Generic Fallback (Last Resort)

```typescript
async function handleGenericFallback(session: Session): Promise<void> {
  await sendWhatsAppMessage(session.phone_number, {
    type: 'interactive',
    interactive: {
      type: 'button',
      body: {
        text: `I didn't understand that. What would you like to do?`
      },
      action: {
        buttons: [
          { type: 'reply', reply: { id: 'btn_browse', title: 'Browse Devices' } },
          { type: 'reply', reply: { id: 'btn_payment', title: 'Make Payment' } },
          { type: 'reply', reply: { id: 'btn_help', title: 'Get Help' } }
        ]
      }
    }
  });

  // Log unknown message for analysis
  await logEvent('unknown_message', {
    phone_number: session.phone_number,
    message: session.context.last_message,
    state: session.current_state
  });
}
```

### 4.5 Escalation to Human Agent

**Trigger**: User types variations of "talk to human", "agent", "representative"

```typescript
async function escalateToHuman(session: Session, reason: string): Promise<void> {
  // Create support ticket
  const ticket = await createSupportTicket({
    customer_id: session.customer_id,
    phone_number: session.phone_number,
    reason,
    source: 'whatsapp',
    priority: 'medium',
    status: 'pending'
  });

  // Notify admin team (via Slack, email, or admin dashboard)
  await notifyAdminTeam({
    type: 'escalation',
    ticket_id: ticket.id,
    customer_phone: session.phone_number,
    reason
  });

  // Inform user
  await sendWhatsAppMessage(session.phone_number, {
    type: 'text',
    text: {
      body: `I've escalated your request to our support team.\n\nTicket ID: ${ticket.id}\n\nA human agent will respond within 2 hours during business hours (Mon-Sat, 8am-6pm).\n\nIs there anything else I can help with in the meantime?`
    }
  });

  // Update session state
  await transitionState(session.id, 'SUPPORT', {
    escalated: true,
    ticket_id: ticket.id
  });
}
```

---

## 5. Context-Aware Responses

### 5.1 Session Context Schema

```sql
-- Session context stored in JSONB field
{
  "last_intent": "intent_browse_devices",
  "last_entity": { "type": "device_name", "value": "Samsung A14" },
  "conversation_history": [
    { "role": "user", "message": "show me phones", "timestamp": "2025-01-24T10:00:00Z" },
    { "role": "bot", "message": "Here are available devices...", "timestamp": "2025-01-24T10:00:02Z" }
  ],
  "selected_device_id": "device-uuid-123",
  "payment_reminder_count": 2,
  "fallback_count": 0
}
```

### 5.2 Using Context for Disambiguation

**Example**: User says "tell me more"

```typescript
async function handleAmbiguousMessage(message: string, session: Session): Promise<void> {
  const context = session.context;

  if (message.toLowerCase().includes('tell me more') || message.toLowerCase().includes('more info')) {
    // Check what user was last looking at
    if (context.selected_device_id) {
      // User wants more info about a device
      await sendDeviceDetails(session.phone_number, context.selected_device_id);
    } else if (context.last_intent === 'intent_check_limit') {
      // User wants more info about credit limit
      await sendCreditLimitDetails(session.phone_number, session.customer_id);
    } else {
      // No context available
      await sendWhatsAppMessage(session.phone_number, {
        type: 'text',
        text: { body: 'What would you like to know more about?' }
      });
    }
  }
}
```

### 5.3 Conversation History for Context

**Keep last 5 messages** to understand conversation flow

```typescript
async function addToConversationHistory(
  sessionId: string,
  role: 'user' | 'bot',
  message: string
): Promise<void> {
  const { data: session } = await supabase
    .from('whatsapp_sessions')
    .select('context')
    .eq('id', sessionId)
    .single();

  const history = session.context.conversation_history || [];

  // Add new message
  history.push({
    role,
    message,
    timestamp: new Date().toISOString()
  });

  // Keep only last 5 messages
  const trimmedHistory = history.slice(-5);

  // Update session
  await supabase
    .from('whatsapp_sessions')
    .update({
      context: {
        ...session.context,
        conversation_history: trimmedHistory
      }
    })
    .eq('id', sessionId);
}
```

### 5.4 Personalized Responses

**Use customer data** to personalize responses

```typescript
async function generatePersonalizedResponse(
  intent: string,
  session: Session,
  customer: Customer
): Promise<string> {
  const templates = {
    intent_browse_devices: `Hi ${customer.first_name}! You have a $${customer.credit_limit} credit limit. Here are devices you can afford:`,
    intent_check_limit: `Hi ${customer.first_name}! Your credit limit is $${customer.credit_limit}. You've used $${customer.credit_limit - customer.available_credit} so far.`,
    intent_make_payment: customer.active_loan
      ? `Hi ${customer.first_name}! Your next payment of $${customer.active_loan.installment_amount} is due on ${customer.active_loan.next_due_date}.`
      : `Hi ${customer.first_name}! You don't have any active loans. Would you like to browse devices?`
  };

  return templates[intent] || `Hi ${customer.first_name}! How can I help you today?`;
}
```

---

## 6. Multi-Language Support

### 6.1 Language Strategy

**Phase 1**: English only (95% of users)
**Phase 2**: Add Shona support (optional)

**Supported Languages**:
| Language | Code | Usage | Status |
|----------|------|-------|--------|
| English | en | 95% | ✅ Implemented |
| Shona | sn | 5% | 🔜 Phase 2 |

### 6.2 Language Detection

```typescript
function detectLanguage(message: string): 'en' | 'sn' {
  // Simple rule-based language detection
  const shonaKeywords = ['mhoro', 'ndiri', 'mari', 'foni', 'kubhadhara'];
  const lowerMessage = message.toLowerCase();

  const shonaMatches = shonaKeywords.filter(keyword => lowerMessage.includes(keyword)).length;

  return shonaMatches >= 2 ? 'sn' : 'en';
}
```

### 6.3 i18n Response Templates

**File Structure**:
```
/locales
  /en.json
  /sn.json (Phase 2)
```

**en.json**:
```json
{
  "greeting": "Hi {{name}}! Welcome to Lynia Finance.",
  "browse_devices": "Here are devices you can afford with your ${{limit}} credit limit:",
  "payment_reminder": "Hi {{name}}, your payment of ${{amount}} is due on {{date}}.",
  "kyc_pending": "Your KYC verification is in progress. We'll notify you within 24 hours.",
  "loan_approved": "Congratulations! Your loan for {{device}} has been approved.",
  "fallback": "I didn't understand that. What would you like to do?"
}
```

**sn.json (Phase 2)**:
```json
{
  "greeting": "Mhoro {{name}}! Tatigamuchira ku Lynia Finance.",
  "browse_devices": "Aya ndiwo mafoni aunogona kutenga ne{{limit}} credit limit yako:",
  "payment_reminder": "Mhoro {{name}}, kubhadhara kwako kwe ${{amount}} kunofanira kuitwa pa{{date}}.",
  "kyc_pending": "KYC verification yako iri kuitwa. Tichakuzivisa mukati meawa 24.",
  "loan_approved": "Makorokoto! Loan yako ye{{device}} yabvumidzwa.",
  "fallback": "Handina kunzwisisa izvo. Ungada kuita chii?"
}
```

**i18n Utility**:
```typescript
import fs from 'fs';

const translations = {
  en: JSON.parse(fs.readFileSync('./locales/en.json', 'utf-8')),
  sn: JSON.parse(fs.readFileSync('./locales/sn.json', 'utf-8'))
};

function t(key: string, params: Record<string, any> = {}, lang: 'en' | 'sn' = 'en'): string {
  let template = translations[lang][key] || translations['en'][key] || key;

  // Replace {{param}} with actual values
  for (const [param, value] of Object.entries(params)) {
    template = template.replace(new RegExp(`{{${param}}}`, 'g'), String(value));
  }

  return template;
}

// Usage:
const message = t('greeting', { name: 'John' }, 'en');
// "Hi John! Welcome to Lynia Finance."
```

---

## 7. Implementation Guide

### 7.1 Complete NLU Pipeline

```typescript
async function processUserMessage(
  phoneNumber: string,
  message: string
): Promise<void> {
  // 1. Get or create session
  const session = await getOrCreateSession(phoneNumber);

  // 2. Add message to conversation history
  await addToConversationHistory(session.id, 'user', message);

  // 3. Classify intent with context
  const { intent, confidence } = await classifyIntentWithContext(message, session);

  // 4. Extract entities
  const entities = await extractEntities(message);

  // 5. Update session context
  await updateSessionContext(session.id, {
    last_intent: intent,
    last_entities: entities,
    last_message: message
  });

  // 6. Handle based on intent and confidence
  if (confidence >= 0.7) {
    // High confidence - process intent
    await handleIntent(intent, entities, session);
  } else if (confidence >= 0.4) {
    // Medium confidence - confirm with user
    await confirmIntent(intent, session);
  } else {
    // Low confidence - use fallback
    await handleTypoFallback(message, session);
  }

  // 7. Log for analytics
  await logEvent('message_processed', {
    phone_number: phoneNumber,
    intent,
    confidence,
    entities: entities.length,
    state: session.current_state
  });
}
```

### 7.2 Intent Handler Router

```typescript
async function handleIntent(
  intent: string,
  entities: Entity[],
  session: Session
): Promise<void> {
  switch (intent) {
    case 'intent_browse_devices':
      await handleBrowseDevices(session);
      break;

    case 'intent_make_payment':
      await handleMakePayment(session, entities);
      break;

    case 'intent_check_limit':
      await handleCheckLimit(session);
      break;

    case 'intent_help':
      await handleHelp(session);
      break;

    case 'intent_talk_to_human':
      await escalateToHuman(session, 'User requested human agent');
      break;

    case 'intent_device_details':
      const deviceEntity = entities.find(e => e.type === 'device_name');
      if (deviceEntity) {
        await handleDeviceDetails(session, deviceEntity.value);
      } else {
        await sendWhatsAppMessage(session.phone_number, {
          type: 'text',
          text: { body: 'Which device would you like to know more about?' }
        });
      }
      break;

    default:
      await handleGenericFallback(session);
  }
}
```

### 7.3 Lambda Handler

```typescript
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';

export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    const body = JSON.parse(event.body || '{}');

    // WhatsApp webhook structure
    const { entry } = body;
    const changes = entry[0]?.changes[0];
    const message = changes?.value?.messages?.[0];

    if (!message) {
      return { statusCode: 200, body: 'OK' };
    }

    const phoneNumber = message.from;
    const messageText = message.text?.body;
    const messageType = message.type;

    // Process text messages only (images handled separately)
    if (messageType === 'text') {
      await processUserMessage(phoneNumber, messageText);
    }

    return { statusCode: 200, body: 'OK' };
  } catch (error) {
    console.error('NLU processing error:', error);
    return { statusCode: 500, body: 'Internal Server Error' };
  }
}
```

---

## 8. Testing Strategy

### 8.1 Intent Classification Tests

```typescript
import { describe, it, expect } from 'vitest';
import { classifyIntent } from './nlu';

describe('Intent Classification', () => {
  it('should classify payment intent correctly', async () => {
    const testMessages = [
      'pay',
      'make payment',
      'I want to pay my installment',
      'payment'
    ];

    for (const message of testMessages) {
      const { intent, confidence } = await classifyIntent(message, mockSession);
      expect(intent).toBe('intent_make_payment');
      expect(confidence).toBeGreaterThan(0.7);
    }
  });

  it('should handle typos with Levenshtein distance', async () => {
    const { intent } = await classifyIntent('paymnt', mockSession);
    // Should suggest 'payment' after fallback
    expect(intent).toBe('intent_make_payment');
  });

  it('should use context for disambiguation', async () => {
    const session = { ...mockSession, current_state: 'LOAN_APPLICATION' };
    const { intent } = await classifyIntentWithContext('yes', session);
    expect(intent).toBe('intent_confirm_loan');
  });
});
```

### 8.2 Entity Extraction Tests

```typescript
describe('Entity Extraction', () => {
  it('should extract Zimbabwe phone number', async () => {
    const entities = await extractEntities('My number is +263771234567');
    expect(entities).toContainEqual({
      type: 'phone_number',
      value: '+263771234567',
      confidence: 1.0
    });
  });

  it('should extract national ID', async () => {
    const entities = await extractEntities('My ID is 63-123456-A-12');
    expect(entities).toContainEqual({
      type: 'national_id',
      value: '63-123456-A-12',
      confidence: 1.0
    });
  });

  it('should extract payment amount', async () => {
    const amount = extractPaymentAmount('I want to pay $47.81');
    expect(amount).toBe(47.81);
  });
});
```

### 8.3 End-to-End Conversation Tests

```typescript
describe('E2E Conversation Flow', () => {
  it('should handle complete payment flow', async () => {
    // User: "pay"
    await processUserMessage('+263771234567', 'pay');
    let session = await getSession('+263771234567');
    expect(session.current_state).toBe('PAYMENT_MENU');

    // User: "ecocash"
    await processUserMessage('+263771234567', 'ecocash');
    session = await getSession('+263771234567');
    expect(session.current_state).toBe('PAYMENT_CONFIRM');

    // User: "confirm"
    await processUserMessage('+263771234567', 'confirm');
    session = await getSession('+263771234567');
    expect(session.context.payment_session_created).toBe(true);
  });
});
```

---

## 9. Performance Optimization

### 9.1 Caching Intent Patterns

```typescript
import NodeCache from 'node-cache';

const intentCache = new NodeCache({ stdTTL: 3600 }); // 1 hour cache

async function classifyIntentCached(message: string, session: Session): Promise<{ intent: string; confidence: number }> {
  const cacheKey = `intent:${message.toLowerCase()}:${session.current_state}`;
  const cached = intentCache.get<{ intent: string; confidence: number }>(cacheKey);

  if (cached) {
    return cached;
  }

  const result = await classifyIntent(message, session);
  intentCache.set(cacheKey, result);

  return result;
}
```

### 9.2 Batch Entity Extraction

```typescript
async function extractEntitiesBatch(messages: string[]): Promise<Entity[][]> {
  return Promise.all(messages.map(msg => extractEntities(msg)));
}
```

### 9.3 Performance Metrics

**Target Performance**:
- Intent classification: <50ms (95th percentile)
- Entity extraction: <100ms (95th percentile)
- End-to-end message processing: <200ms (95th percentile)

**Monitoring**:
```typescript
import { performance } from 'perf_hooks';

async function processUserMessageWithMetrics(phoneNumber: string, message: string): Promise<void> {
  const startTime = performance.now();

  await processUserMessage(phoneNumber, message);

  const duration = performance.now() - startTime;

  // Log to CloudWatch
  await logMetric('nlu_processing_duration', duration, {
    phone_number: phoneNumber,
    message_length: message.length
  });

  if (duration > 500) {
    console.warn(`Slow NLU processing: ${duration}ms for message: ${message}`);
  }
}
```

---

## Summary

This document defines the Natural Language Understanding (NLU) system for the Lynia Finance WhatsApp bot:

1. **Intent Recognition**: 15 core intents with rule-based classification
2. **Entity Extraction**: 5 entity types (phone, national ID, amount, date, device)
3. **Fallback Handling**: 4-tier fallback (typo correction, context suggestions, generic menu, human escalation)
4. **Context-Aware Responses**: Use session state and conversation history
5. **Multi-Language Support**: English (Phase 1), Shona (Phase 2)

**Key Features**:
- Rule-based NLU (no ML costs in Year 1)
- Zimbabwe-specific patterns (national ID, phone numbers)
- Typo tolerance with Levenshtein distance
- Context disambiguation using session state
- <200ms processing time (95th percentile)

**Next Steps**: Implement webhook security (P1-T013) to validate incoming WhatsApp messages.
