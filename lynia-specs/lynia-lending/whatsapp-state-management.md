# WhatsApp Bot State Management

**Document**: P1-T009 - WhatsApp Bot State Management
**Status**: Complete
**Last Updated**: 2025-11-24
**Owner**: Engineering Team

## Table of Contents
1. [Overview](#overview)
2. [State Machine Architecture](#state-machine-architecture)
3. [Session Management](#session-management)
4. [Context Persistence](#context-persistence)
5. [State Transition Logic](#state-transition-logic)
6. [Timeout & Expiry Handling](#timeout--expiry-handling)
7. [Multi-Device Session Handling](#multi-device-session-handling)
8. [Recovery Mechanisms](#recovery-mechanisms)
9. [Performance Optimization](#performance-optimization)
10. [Testing & Validation](#testing--validation)

---

## 1. Overview

### 1.1 Purpose

The State Management system is the brain of the WhatsApp bot, responsible for:
- **Tracking conversation state**: Where the user is in their journey
- **Preserving context**: Remember user inputs across messages
- **Managing sessions**: Handle timeouts, expiry, and cleanup
- **Ensuring consistency**: Prevent invalid state transitions
- **Recovering from errors**: Handle crashes and resume gracefully

### 1.2 Design Goals

**Reliability**:
- ✅ No lost user progress (persistent storage)
- ✅ Graceful recovery from failures
- ✅ Idempotent state transitions

**Performance**:
- ✅ <100ms state lookup
- ✅ <50ms state update
- ✅ Efficient context serialization

**Scalability**:
- ✅ Support 10,000+ concurrent sessions
- ✅ Horizontal scaling (stateless Lambda)
- ✅ Database connection pooling

**User Experience**:
- ✅ Seamless conversation flow
- ✅ Resume after timeout
- ✅ Clear progress indicators

### 1.3 Technology Stack

| Component | Technology | Purpose |
|-----------|------------|---------|
| **State Storage** | Supabase PostgreSQL | Persistent session state |
| **Caching** | Redis (ElastiCache) | Fast state lookup |
| **Queue** | AWS SQS | State transition events |
| **Compute** | AWS Lambda (Node.js 18) | Stateless execution |
| **Lock Manager** | Redis distributed locks | Prevent race conditions |

---

## 2. State Machine Architecture

### 2.1 State Definitions

**Core States** (12 total):

```typescript
enum BotState {
  // Initial state
  IDLE = 'IDLE',

  // Onboarding flow
  ONBOARDING = 'ONBOARDING',
  KYC_SUBMIT = 'KYC_SUBMIT',
  KYC_PENDING = 'KYC_PENDING',

  // Device browsing
  BROWSING = 'BROWSING',
  DEVICE_SELECTED = 'DEVICE_SELECTED',

  // Loan application
  LOAN_APPLICATION = 'LOAN_APPLICATION',
  LOAN_REVIEW = 'LOAN_REVIEW',

  // Payment
  PAYMENT_MENU = 'PAYMENT_MENU',
  PAYMENT_CONFIRM = 'PAYMENT_CONFIRM',

  // Support
  SUPPORT = 'SUPPORT',

  // Account
  ACCOUNT_MENU = 'ACCOUNT_MENU'
}
```

**State Properties**:
```typescript
interface StateDefinition {
  name: BotState;
  description: string;
  allowedTransitions: BotState[];
  timeout: number; // milliseconds
  requiresAuth: boolean;
  canResume: boolean;
  priority: 'low' | 'medium' | 'high' | 'critical';
}
```

**State Registry**:
```typescript
const STATE_REGISTRY: Record<BotState, StateDefinition> = {
  [BotState.IDLE]: {
    name: BotState.IDLE,
    description: 'No active conversation',
    allowedTransitions: [
      BotState.ONBOARDING,
      BotState.BROWSING,
      BotState.LOAN_APPLICATION,
      BotState.PAYMENT_MENU,
      BotState.SUPPORT,
      BotState.ACCOUNT_MENU
    ],
    timeout: 0, // No timeout
    requiresAuth: false,
    canResume: false,
    priority: 'low'
  },

  [BotState.ONBOARDING]: {
    name: BotState.ONBOARDING,
    description: 'User is completing onboarding',
    allowedTransitions: [BotState.KYC_SUBMIT, BotState.IDLE],
    timeout: 30 * 60 * 1000, // 30 minutes
    requiresAuth: false,
    canResume: true,
    priority: 'high'
  },

  [BotState.KYC_SUBMIT]: {
    name: BotState.KYC_SUBMIT,
    description: 'User is submitting KYC documents',
    allowedTransitions: [BotState.KYC_PENDING, BotState.ONBOARDING, BotState.IDLE],
    timeout: 30 * 60 * 1000, // 30 minutes
    requiresAuth: false,
    canResume: true,
    priority: 'high'
  },

  [BotState.KYC_PENDING]: {
    name: BotState.KYC_PENDING,
    description: 'KYC verification in progress',
    allowedTransitions: [BotState.IDLE],
    timeout: 0, // No timeout (async process)
    requiresAuth: false,
    canResume: false,
    priority: 'medium'
  },

  [BotState.BROWSING]: {
    name: BotState.BROWSING,
    description: 'User is browsing devices',
    allowedTransitions: [BotState.DEVICE_SELECTED, BotState.IDLE],
    timeout: 30 * 60 * 1000, // 30 minutes
    requiresAuth: true,
    canResume: true,
    priority: 'medium'
  },

  [BotState.DEVICE_SELECTED]: {
    name: BotState.DEVICE_SELECTED,
    description: 'User has selected a device',
    allowedTransitions: [BotState.LOAN_APPLICATION, BotState.BROWSING, BotState.IDLE],
    timeout: 10 * 60 * 1000, // 10 minutes
    requiresAuth: true,
    canResume: true,
    priority: 'high'
  },

  [BotState.LOAN_APPLICATION]: {
    name: BotState.LOAN_APPLICATION,
    description: 'User is applying for a loan',
    allowedTransitions: [BotState.LOAN_REVIEW, BotState.IDLE],
    timeout: 30 * 60 * 1000, // 30 minutes
    requiresAuth: true,
    canResume: true,
    priority: 'critical'
  },

  [BotState.LOAN_REVIEW]: {
    name: BotState.LOAN_REVIEW,
    description: 'Loan application under review',
    allowedTransitions: [BotState.IDLE],
    timeout: 0, // No timeout (async process)
    requiresAuth: true,
    canResume: false,
    priority: 'critical'
  },

  [BotState.PAYMENT_MENU]: {
    name: BotState.PAYMENT_MENU,
    description: 'User is in payment menu',
    allowedTransitions: [BotState.PAYMENT_CONFIRM, BotState.IDLE],
    timeout: 15 * 60 * 1000, // 15 minutes
    requiresAuth: true,
    canResume: true,
    priority: 'critical'
  },

  [BotState.PAYMENT_CONFIRM]: {
    name: BotState.PAYMENT_CONFIRM,
    description: 'User is confirming payment',
    allowedTransitions: [BotState.IDLE],
    timeout: 5 * 60 * 1000, // 5 minutes (payment window)
    requiresAuth: true,
    canResume: false, // Payment should complete or expire
    priority: 'critical'
  },

  [BotState.SUPPORT]: {
    name: BotState.SUPPORT,
    description: 'User is in customer support',
    allowedTransitions: [BotState.IDLE],
    timeout: 60 * 60 * 1000, // 60 minutes (long for human agents)
    requiresAuth: false,
    canResume: true,
    priority: 'high'
  },

  [BotState.ACCOUNT_MENU]: {
    name: BotState.ACCOUNT_MENU,
    description: 'User is managing account',
    allowedTransitions: [BotState.IDLE],
    timeout: 15 * 60 * 1000, // 15 minutes
    requiresAuth: true,
    canResume: true,
    priority: 'medium'
  }
};
```

### 2.2 State Diagram

```
                           [IDLE]
                              │
          ┌───────────────────┼───────────────────┬─────────────┬───────────────┐
          │                   │                   │             │               │
          ▼                   ▼                   ▼             ▼               ▼
   [ONBOARDING]         [BROWSING]        [LOAN_APPLICATION] [PAYMENT_MENU] [SUPPORT]
          │                   │                   │             │
          ▼                   ▼                   ▼             ▼
   [KYC_SUBMIT]        [DEVICE_SELECTED]   [LOAN_REVIEW]  [PAYMENT_CONFIRM]
          │                   │                   │             │
          ▼                   │                   │             │
   [KYC_PENDING]             │                   │             │
          │                   │                   │             │
          └───────────────────┴───────────────────┴─────────────┘
                              │
                              ▼
                           [IDLE]
```

### 2.3 State Metadata

**Additional State Properties**:
```typescript
interface StateMetadata {
  enteredAt: Date;
  step: string; // Current step within state (e.g., "national_id_capture")
  attempts: number; // Number of attempts in current step
  maxAttempts: number; // Max attempts before failure
  errors: StateError[];
  warnings: StateWarning[];
  progressPercentage: number; // 0-100
  estimatedTimeRemaining: number; // milliseconds
}

interface StateError {
  code: string;
  message: string;
  timestamp: Date;
  recoverable: boolean;
}

interface StateWarning {
  code: string;
  message: string;
  timestamp: Date;
}
```

---

## 3. Session Management

### 3.1 Session Schema

**Database Table**: `whatsapp_sessions`

```sql
CREATE TABLE whatsapp_sessions (
  -- Identifiers
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES customers(id),
  phone_number VARCHAR(15) NOT NULL,

  -- State
  current_state VARCHAR(50) NOT NULL DEFAULT 'IDLE',
  previous_state VARCHAR(50),
  state_metadata JSONB DEFAULT '{}',

  -- Context
  context JSONB DEFAULT '{}',

  -- Preferences
  language VARCHAR(10) DEFAULT 'en',
  timezone VARCHAR(50) DEFAULT 'Africa/Harare',

  -- Timing
  started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_interaction_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE,

  -- Metadata
  device_info JSONB, -- Phone model, WhatsApp version
  ip_address INET,
  user_agent TEXT,

  -- Audit
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Constraints
  CONSTRAINT valid_state CHECK (current_state IN (
    'IDLE', 'ONBOARDING', 'KYC_SUBMIT', 'KYC_PENDING',
    'BROWSING', 'DEVICE_SELECTED', 'LOAN_APPLICATION', 'LOAN_REVIEW',
    'PAYMENT_MENU', 'PAYMENT_CONFIRM', 'SUPPORT', 'ACCOUNT_MENU'
  ))
);

-- Indexes
CREATE INDEX idx_sessions_phone ON whatsapp_sessions(phone_number) WHERE current_state != 'IDLE';
CREATE INDEX idx_sessions_customer ON whatsapp_sessions(customer_id) WHERE current_state != 'IDLE';
CREATE INDEX idx_sessions_state ON whatsapp_sessions(current_state);
CREATE INDEX idx_sessions_expires ON whatsapp_sessions(expires_at) WHERE expires_at IS NOT NULL;
CREATE INDEX idx_sessions_last_interaction ON whatsapp_sessions(last_interaction_at);

-- Unique constraint: One active session per phone number
CREATE UNIQUE INDEX idx_sessions_phone_unique ON whatsapp_sessions(phone_number)
  WHERE current_state != 'IDLE' AND expires_at > NOW();

COMMENT ON TABLE whatsapp_sessions IS 'WhatsApp bot session state and context';
```

### 3.2 Session Lifecycle

**1. Session Creation**:
```typescript
async function createSession(phoneNumber: string, customerId?: string): Promise<Session> {
  // Check if active session exists
  const existingSession = await db.whatsapp_sessions.findOne({
    phone_number: phoneNumber,
    current_state: { $ne: 'IDLE' },
    expires_at: { $gt: new Date() }
  });

  if (existingSession) {
    // Reuse existing session
    return existingSession;
  }

  // Create new session
  const session = await db.whatsapp_sessions.insert({
    phone_number: phoneNumber,
    customer_id: customerId,
    current_state: 'IDLE',
    context: {},
    language: 'en',
    timezone: 'Africa/Harare',
    started_at: new Date(),
    last_interaction_at: new Date(),
    expires_at: null // No expiry for IDLE state
  });

  // Cache session
  await redis.setex(
    `session:${phoneNumber}`,
    3600, // 1 hour TTL
    JSON.stringify(session)
  );

  return session;
}
```

**2. Session Retrieval**:
```typescript
async function getSession(phoneNumber: string): Promise<Session | null> {
  // Try cache first
  const cached = await redis.get(`session:${phoneNumber}`);
  if (cached) {
    return JSON.parse(cached);
  }

  // Fallback to database
  const session = await db.whatsapp_sessions.findOne({
    phone_number: phoneNumber
  });

  if (session) {
    // Update cache
    await redis.setex(
      `session:${phoneNumber}`,
      3600,
      JSON.stringify(session)
    );
  }

  return session;
}
```

**3. Session Update**:
```typescript
async function updateSession(
  sessionId: string,
  updates: Partial<Session>
): Promise<Session> {
  // Distributed lock to prevent race conditions
  const lock = await acquireLock(`session:${sessionId}`, 5000); // 5s timeout

  try {
    // Update database
    const session = await db.whatsapp_sessions.update(
      { id: sessionId },
      {
        ...updates,
        last_interaction_at: new Date(),
        updated_at: new Date()
      }
    );

    // Invalidate cache
    await redis.del(`session:${session.phone_number}`);

    // Publish state change event
    await publishStateChangeEvent(session);

    return session;
  } finally {
    await releaseLock(lock);
  }
}
```

**4. Session Expiry**:
```typescript
async function expireSession(sessionId: string): Promise<void> {
  const session = await db.whatsapp_sessions.findOne({ id: sessionId });

  if (!session || session.current_state === 'IDLE') {
    return; // Already expired or IDLE
  }

  // Save context before expiring (for potential resume)
  await db.expired_sessions.insert({
    session_id: sessionId,
    phone_number: session.phone_number,
    customer_id: session.customer_id,
    expired_state: session.current_state,
    context: session.context,
    expired_at: new Date(),
    resumable: STATE_REGISTRY[session.current_state].canResume
  });

  // Transition to IDLE
  await updateSession(sessionId, {
    current_state: 'IDLE',
    previous_state: session.current_state,
    context: {}, // Clear context
    expires_at: null
  });

  // Send timeout notification to user
  await sendMessage(session.phone_number, {
    text: `Your session has expired due to inactivity. Type "resume" to continue where you left off, or "menu" to start over.`
  });
}
```

**5. Session Cleanup** (Cron Job):
```typescript
// Run every 5 minutes
async function cleanupExpiredSessions() {
  const expiredSessions = await db.whatsapp_sessions.find({
    expires_at: { $lt: new Date() },
    current_state: { $ne: 'IDLE' }
  });

  for (const session of expiredSessions) {
    await expireSession(session.id);
  }

  console.log(`Cleaned up ${expiredSessions.length} expired sessions`);
}
```

### 3.3 Session Context

**Context Structure**:
```typescript
interface SessionContext {
  // Onboarding
  onboarding?: {
    step: 'first_name' | 'last_name' | 'national_id' | 'id_photos' | 'selfie';
    first_name?: string;
    last_name?: string;
    national_id?: string;
    id_front_url?: string;
    id_back_url?: string;
    selfie_url?: string;
    attempts: number;
    max_attempts: number;
  };

  // Device browsing
  device_browsing?: {
    filters: {
      max_price?: number;
      brand?: string;
      min_ram?: number;
    };
    selected_device_id?: string;
    browsing_history: string[]; // device IDs
    viewed_devices: Array<{ device_id: string; viewed_at: Date }>;
  };

  // Loan application
  loan_application?: {
    device_id: string;
    principal: number;
    term_months: number;
    monthly_payment: number;
    delivery_address?: string;
    confirmation_pending: boolean;
  };

  // Payment
  payment?: {
    loan_id: string;
    amount: number;
    payment_method?: 'ecocash' | 'paynow' | 'bank_transfer';
    phone_number?: string;
    payment_id?: string;
  };

  // Support
  support?: {
    issue_category?: string;
    issue_description?: string;
    ticket_id?: string;
    agent_id?: string;
  };

  // Preferences
  preferences?: {
    notifications_enabled: boolean;
    marketing_consent: boolean;
    preferred_language: string;
  };
}
```

**Context Utilities**:
```typescript
// Get context value safely
function getContext<K extends keyof SessionContext>(
  session: Session,
  key: K
): SessionContext[K] | undefined {
  return session.context[key];
}

// Set context value
function setContext<K extends keyof SessionContext>(
  session: Session,
  key: K,
  value: SessionContext[K]
): Session {
  return {
    ...session,
    context: {
      ...session.context,
      [key]: value
    }
  };
}

// Clear context
function clearContext(session: Session, ...keys: (keyof SessionContext)[]): Session {
  const newContext = { ...session.context };
  keys.forEach(key => delete newContext[key]);
  return { ...session, context: newContext };
}
```

---

## 4. Context Persistence

### 4.1 Persistence Strategy

**Two-Tier Storage**:
1. **Redis** (Hot cache): Active sessions, fast read/write
2. **PostgreSQL** (Cold storage): Persistent, source of truth

**Write Strategy**: Write-through cache
- Write to PostgreSQL first (durable)
- Then update Redis (fast subsequent reads)
- Invalidate cache on updates

**Read Strategy**: Cache-aside
- Check Redis first
- On miss, read from PostgreSQL
- Populate Redis for next read

### 4.2 Context Serialization

**JSONB in PostgreSQL**:
```sql
-- Context is stored as JSONB for efficient querying
SELECT
  id,
  phone_number,
  current_state,
  context->>'onboarding' AS onboarding_context,
  context->'device_browsing'->>'selected_device_id' AS selected_device
FROM whatsapp_sessions
WHERE context->>'onboarding' IS NOT NULL;
```

**Compression** (for large contexts):
```typescript
import zlib from 'zlib';

async function compressContext(context: SessionContext): Promise<Buffer> {
  const json = JSON.stringify(context);
  return zlib.gzipSync(Buffer.from(json));
}

async function decompressContext(compressed: Buffer): Promise<SessionContext> {
  const json = zlib.gunzipSync(compressed).toString();
  return JSON.parse(json);
}
```

### 4.3 Context Versioning

**Schema Evolution**:
```typescript
interface ContextVersion {
  version: number;
  migratedAt: Date;
}

// Migrate context from v1 to v2
function migrateContext(context: any, fromVersion: number, toVersion: number): SessionContext {
  if (fromVersion === 1 && toVersion === 2) {
    // V1 → V2: Add browsing_history
    if (context.device_browsing && !context.device_browsing.browsing_history) {
      context.device_browsing.browsing_history = [];
    }
  }

  return context;
}
```

### 4.4 Context Backup

**Periodic Snapshots** (hourly):
```sql
-- Archive context snapshots for analysis
CREATE TABLE context_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES whatsapp_sessions(id),
  phone_number VARCHAR(15) NOT NULL,
  current_state VARCHAR(50) NOT NULL,
  context JSONB NOT NULL,
  snapshot_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Partition by month for efficient querying
CREATE INDEX idx_context_snapshots_session ON context_snapshots(session_id, snapshot_at DESC);
CREATE INDEX idx_context_snapshots_phone ON context_snapshots(phone_number, snapshot_at DESC);
```

---

## 5. State Transition Logic

### 5.1 Transition Validation

```typescript
async function transitionState(
  sessionId: string,
  newState: BotState,
  contextUpdates?: Partial<SessionContext>
): Promise<Session> {
  // 1. Get current session
  const session = await getSession(sessionById(sessionId));
  if (!session) {
    throw new Error('Session not found');
  }

  // 2. Validate transition
  const currentStateConfig = STATE_REGISTRY[session.current_state];
  if (!currentStateConfig.allowedTransitions.includes(newState)) {
    throw new InvalidStateTransitionError(
      `Cannot transition from ${session.current_state} to ${newState}`
    );
  }

  // 3. Check authentication requirement
  const newStateConfig = STATE_REGISTRY[newState];
  if (newStateConfig.requiresAuth && !session.customer_id) {
    throw new UnauthorizedError('Authentication required for this state');
  }

  // 4. Calculate expiry
  const expiresAt = newStateConfig.timeout > 0
    ? new Date(Date.now() + newStateConfig.timeout)
    : null;

  // 5. Update session
  const updatedSession = await updateSession(sessionId, {
    previous_state: session.current_state,
    current_state: newState,
    context: {
      ...session.context,
      ...contextUpdates
    },
    state_metadata: {
      enteredAt: new Date(),
      step: 'initial',
      attempts: 0,
      maxAttempts: 3,
      errors: [],
      warnings: [],
      progressPercentage: 0
    },
    expires_at: expiresAt
  });

  // 6. Log transition
  await db.state_transition_logs.insert({
    session_id: sessionId,
    from_state: session.current_state,
    to_state: newState,
    transitioned_at: new Date(),
    context_snapshot: session.context
  });

  return updatedSession;
}
```

### 5.2 Transition Guards

```typescript
type TransitionGuard = (session: Session) => Promise<boolean>;

const TRANSITION_GUARDS: Record<string, TransitionGuard> = {
  // Can only browse devices if KYC approved
  'IDLE->BROWSING': async (session) => {
    if (!session.customer_id) return false;

    const customer = await db.customers.findOne({ id: session.customer_id });
    return customer?.kyc_status === 'approved';
  },

  // Can only apply for loan if device selected
  'DEVICE_SELECTED->LOAN_APPLICATION': async (session) => {
    const context = getContext(session, 'device_browsing');
    return !!context?.selected_device_id;
  },

  // Can only access payment menu if active loan exists
  'IDLE->PAYMENT_MENU': async (session) => {
    if (!session.customer_id) return false;

    const activeLoan = await db.loans.findOne({
      customer_id: session.customer_id,
      status: 'active'
    });
    return !!activeLoan;
  }
};

async function canTransition(
  session: Session,
  newState: BotState
): Promise<boolean> {
  const guardKey = `${session.current_state}->${newState}`;
  const guard = TRANSITION_GUARDS[guardKey];

  if (guard) {
    return await guard(session);
  }

  // No guard means transition is allowed (if in allowedTransitions)
  return true;
}
```

### 5.3 Transition Hooks

```typescript
type TransitionHook = (session: Session, newState: BotState) => Promise<void>;

// Before transition
const BEFORE_TRANSITION_HOOKS: Record<string, TransitionHook> = {
  'ANY->PAYMENT_CONFIRM': async (session, newState) => {
    // Create payment record in database before entering payment confirmation
    const paymentContext = getContext(session, 'payment');
    if (paymentContext) {
      await db.payments.insert({
        loan_id: paymentContext.loan_id,
        amount: paymentContext.amount,
        status: 'initiated',
        created_at: new Date()
      });
    }
  }
};

// After transition
const AFTER_TRANSITION_HOOKS: Record<string, TransitionHook> = {
  'KYC_SUBMIT->KYC_PENDING': async (session, newState) => {
    // Submit KYC to Smile Identity
    const onboardingContext = getContext(session, 'onboarding');
    if (onboardingContext) {
      await smileIdentityService.submitKYC({
        customer_id: session.customer_id!,
        national_id: onboardingContext.national_id!,
        id_front_url: onboardingContext.id_front_url!,
        id_back_url: onboardingContext.id_back_url,
        selfie_url: onboardingContext.selfie_url!
      });
    }
  },

  'LOAN_APPLICATION->LOAN_REVIEW': async (session, newState) => {
    // Process loan application
    const loanContext = getContext(session, 'loan_application');
    if (loanContext) {
      await processLoanApplication({
        customer_id: session.customer_id!,
        device_id: loanContext.device_id,
        principal: loanContext.principal,
        term_months: loanContext.term_months
      });
    }
  }
};
```

### 5.4 Forced Transitions

**Global Commands** (work in any state):
```typescript
async function handleGlobalCommand(
  session: Session,
  command: string
): Promise<Session | null> {
  switch (command.toLowerCase()) {
    case 'menu':
    case 'cancel':
      // Force return to IDLE
      return await transitionState(session.id, 'IDLE');

    case 'help':
      // Send help message but don't change state
      await sendHelpMessage(session.phone_number);
      return null;

    case 'resume':
      // Try to resume from expired session
      return await resumeExpiredSession(session.phone_number);

    case 'status':
      // Show current state info
      await sendStatusMessage(session);
      return null;

    default:
      return null;
  }
}
```

---

## 6. Timeout & Expiry Handling

### 6.1 Timeout Configuration

**Per-State Timeouts**:
```typescript
const STATE_TIMEOUTS: Record<BotState, number> = {
  IDLE: 0, // No timeout
  ONBOARDING: 30 * 60 * 1000, // 30 minutes
  KYC_SUBMIT: 30 * 60 * 1000, // 30 minutes
  KYC_PENDING: 0, // No timeout (async)
  BROWSING: 30 * 60 * 1000, // 30 minutes
  DEVICE_SELECTED: 10 * 60 * 1000, // 10 minutes
  LOAN_APPLICATION: 30 * 60 * 1000, // 30 minutes
  LOAN_REVIEW: 0, // No timeout (async)
  PAYMENT_MENU: 15 * 60 * 1000, // 15 minutes
  PAYMENT_CONFIRM: 5 * 60 * 1000, // 5 minutes (critical)
  SUPPORT: 60 * 60 * 1000, // 60 minutes (long for agents)
  ACCOUNT_MENU: 15 * 60 * 1000 // 15 minutes
};
```

### 6.2 Timeout Detection

**Method 1: Database Query** (Cron Job every 5 minutes):
```typescript
async function detectExpiredSessions() {
  const expiredSessions = await db.whatsapp_sessions.find({
    expires_at: { $lt: new Date() },
    current_state: { $ne: 'IDLE' }
  });

  for (const session of expiredSessions) {
    await handleSessionTimeout(session);
  }
}
```

**Method 2: TTL-based** (Redis):
```typescript
// Set TTL when entering state
async function enterState(session: Session, newState: BotState) {
  const timeout = STATE_TIMEOUTS[newState];

  if (timeout > 0) {
    // Set Redis key with TTL
    await redis.setex(
      `session:timeout:${session.id}`,
      Math.floor(timeout / 1000), // Convert to seconds
      '1'
    );

    // Listen for expiry event
    redis.configSet('notify-keyspace-events', 'Ex');
    redis.on('expired', async (key: string) => {
      if (key.startsWith('session:timeout:')) {
        const sessionId = key.replace('session:timeout:', '');
        const session = await db.whatsapp_sessions.findOne({ id: sessionId });
        if (session) {
          await handleSessionTimeout(session);
        }
      }
    });
  }
}
```

### 6.3 Timeout Handling

```typescript
async function handleSessionTimeout(session: Session) {
  const stateConfig = STATE_REGISTRY[session.current_state];

  // 1. Save context if resumable
  if (stateConfig.canResume) {
    await db.expired_sessions.insert({
      session_id: session.id,
      phone_number: session.phone_number,
      customer_id: session.customer_id,
      expired_state: session.current_state,
      context: session.context,
      expired_at: new Date(),
      resumable: true,
      resume_expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
    });
  }

  // 2. Transition to IDLE
  await transitionState(session.id, 'IDLE');

  // 3. Notify user
  const message = stateConfig.canResume
    ? `Your session has timed out due to inactivity.\n\nYour progress has been saved. Type "resume" to continue where you left off, or "menu" for main menu.`
    : `Your session has expired. Type "menu" to start over.`;

  await sendMessage(session.phone_number, { text: message });

  // 4. Log timeout event
  await db.session_timeout_logs.insert({
    session_id: session.id,
    phone_number: session.phone_number,
    timed_out_state: session.current_state,
    context_at_timeout: session.context,
    timed_out_at: new Date()
  });
}
```

### 6.4 Session Resume

```typescript
async function resumeExpiredSession(phoneNumber: string): Promise<Session | null> {
  // Find most recent expired session
  const expiredSession = await db.expired_sessions.findOne({
    phone_number: phoneNumber,
    resumable: true,
    resume_expires_at: { $gt: new Date() }
  }, {
    orderBy: { expired_at: 'DESC' }
  });

  if (!expiredSession) {
    await sendMessage(phoneNumber, {
      text: `No session to resume. Type "menu" to start over.`
    });
    return null;
  }

  // Create new session with restored context
  const session = await createSession(phoneNumber, expiredSession.customer_id);

  await transitionState(
    session.id,
    expiredSession.expired_state as BotState,
    expiredSession.context
  );

  // Send resume confirmation
  await sendMessage(phoneNumber, {
    text: `Welcome back! Resuming from where you left off...`
  });

  // Mark expired session as resumed
  await db.expired_sessions.update(
    { id: expiredSession.id },
    { resumed_at: new Date() }
  );

  return session;
}
```

### 6.5 Proactive Timeout Warnings

**Warn before timeout** (5 minutes before):
```typescript
// Cron job runs every minute
async function sendTimeoutWarnings() {
  const warnThreshold = 5 * 60 * 1000; // 5 minutes

  const sessions = await db.whatsapp_sessions.find({
    expires_at: {
      $gt: new Date(),
      $lt: new Date(Date.now() + warnThreshold)
    },
    current_state: { $ne: 'IDLE' }
  });

  for (const session of sessions) {
    // Check if warning already sent
    const warningSent = await redis.get(`timeout_warning:${session.id}`);
    if (warningSent) continue;

    // Send warning
    await sendMessage(session.phone_number, {
      text: `⏱️ Your session will expire in 5 minutes due to inactivity. Send any message to keep it active.`
    });

    // Mark warning as sent (TTL = 10 minutes)
    await redis.setex(`timeout_warning:${session.id}`, 600, '1');
  }
}
```

---

## 7. Multi-Device Session Handling

### 7.1 Challenge

**Problem**: Customer uses WhatsApp on multiple devices (phone + WhatsApp Web)
- Two devices, same phone number
- Concurrent messages from different devices
- Risk of session conflicts

**Solution**: Single active session per phone number, device-aware

### 7.2 Device Tracking

```sql
ALTER TABLE whatsapp_sessions ADD COLUMN device_info JSONB;

-- Device info structure
{
  "primary_device": {
    "device_id": "abc123",
    "platform": "Android",
    "whatsapp_version": "2.23.20.76",
    "last_seen": "2025-11-24T12:00:00Z"
  },
  "web_device": {
    "device_id": "web456",
    "platform": "WhatsApp Web",
    "browser": "Chrome 120",
    "last_seen": "2025-11-24T12:05:00Z"
  }
}
```

### 7.3 Concurrent Request Handling

**Distributed Lock**:
```typescript
async function handleMessage(phoneNumber: string, message: string) {
  // Acquire lock for this phone number
  const lock = await acquireLock(`phone:${phoneNumber}`, 5000); // 5s timeout

  try {
    // Get or create session
    const session = await getSession(phoneNumber) || await createSession(phoneNumber);

    // Process message
    await processMessage(session, message);
  } finally {
    // Always release lock
    await releaseLock(lock);
  }
}

async function acquireLock(key: string, timeout: number): Promise<Lock> {
  const lockKey = `lock:${key}`;
  const lockValue = uuidv4();
  const acquired = await redis.set(lockKey, lockValue, 'PX', timeout, 'NX');

  if (!acquired) {
    throw new Error('Failed to acquire lock (concurrent request)');
  }

  return { key: lockKey, value: lockValue };
}

async function releaseLock(lock: Lock): Promise<void> {
  // Only release if we still own the lock
  const script = `
    if redis.call("get", KEYS[1]) == ARGV[1] then
      return redis.call("del", KEYS[1])
    else
      return 0
    end
  `;

  await redis.eval(script, 1, lock.key, lock.value);
}
```

### 7.4 Device Switching

**Seamless handoff** between devices:
```typescript
async function handleDeviceSwitch(session: Session, newDeviceId: string) {
  const currentDevice = session.device_info?.primary_device?.device_id;

  if (currentDevice && currentDevice !== newDeviceId) {
    // User switched devices
    console.log(`User ${session.phone_number} switched from device ${currentDevice} to ${newDeviceId}`);

    // Update device info
    await updateSession(session.id, {
      device_info: {
        ...session.device_info,
        previous_device: session.device_info?.primary_device,
        primary_device: {
          device_id: newDeviceId,
          last_seen: new Date()
        }
      }
    });
  }
}
```

### 7.5 Conflict Resolution

**Last-write-wins** strategy:
```typescript
async function updateSessionWithConflictResolution(
  sessionId: string,
  updates: Partial<Session>,
  expectedVersion: number
): Promise<Session> {
  // Optimistic locking with version number
  const result = await db.whatsapp_sessions.update(
    {
      id: sessionId,
      version: expectedVersion // Only update if version matches
    },
    {
      ...updates,
      version: expectedVersion + 1,
      updated_at: new Date()
    }
  );

  if (!result) {
    // Version mismatch = concurrent update
    throw new ConcurrentUpdateError('Session was updated by another request');
  }

  return result;
}
```

---

## 8. Recovery Mechanisms

### 8.1 Crash Recovery

**Scenario**: Lambda crashes mid-conversation

**Detection**:
```typescript
// Health check queries for stale sessions
async function detectStaleSessions() {
  const staleThreshold = 10 * 60 * 1000; // 10 minutes

  const staleSessions = await db.whatsapp_sessions.find({
    current_state: { $ne: 'IDLE' },
    last_interaction_at: { $lt: new Date(Date.now() - staleThreshold) },
    expires_at: { $gt: new Date() } // Not expired yet
  });

  for (const session of staleSessions) {
    await recoverStaleSession(session);
  }
}
```

**Recovery**:
```typescript
async function recoverStaleSession(session: Session) {
  console.log(`Recovering stale session: ${session.id}`);

  // Send reconnection message
  await sendMessage(session.phone_number, {
    text: `We noticed a connection issue. Let's continue from where we were...\n\nYou were: ${getStateDescription(session.current_state)}\n\nType "continue" to resume, or "menu" to start over.`
  });

  // Extend timeout
  const stateConfig = STATE_REGISTRY[session.current_state];
  if (stateConfig.timeout > 0) {
    await updateSession(session.id, {
      expires_at: new Date(Date.now() + stateConfig.timeout)
    });
  }
}
```

### 8.2 Data Corruption Recovery

**Validation on read**:
```typescript
function validateSession(session: Session): boolean {
  // Check required fields
  if (!session.phone_number || !session.current_state) {
    return false;
  }

  // Check state is valid
  if (!Object.values(BotState).includes(session.current_state as BotState)) {
    return false;
  }

  // Check context is valid JSON
  try {
    JSON.stringify(session.context);
  } catch (e) {
    return false;
  }

  return true;
}

async function getSessionWithValidation(phoneNumber: string): Promise<Session> {
  const session = await getSession(phoneNumber);

  if (!session) {
    throw new Error('Session not found');
  }

  if (!validateSession(session)) {
    console.error(`Corrupted session detected: ${session.id}`);

    // Log corruption
    await db.session_corruption_logs.insert({
      session_id: session.id,
      phone_number: phoneNumber,
      corrupted_data: session,
      detected_at: new Date()
    });

    // Create fresh session
    return await createSession(phoneNumber, session.customer_id);
  }

  return session;
}
```

### 8.3 Idempotent Operations

**Prevent duplicate state transitions**:
```typescript
async function transitionStateIdempotent(
  sessionId: string,
  newState: BotState,
  idempotencyKey: string
): Promise<Session> {
  // Check if this transition already happened
  const existingTransition = await db.state_transition_logs.findOne({
    session_id: sessionId,
    to_state: newState,
    idempotency_key: idempotencyKey
  });

  if (existingTransition) {
    console.log(`Idempotent transition detected: ${idempotencyKey}`);
    return await db.whatsapp_sessions.findOne({ id: sessionId })!;
  }

  // Perform transition
  const session = await transitionState(sessionId, newState);

  // Store idempotency key
  await db.state_transition_logs.update(
    { session_id: sessionId, to_state: newState },
    { idempotency_key: idempotencyKey }
  );

  return session;
}
```

---

## 9. Performance Optimization

### 9.1 Caching Strategy

**Three-Level Cache**:
```
┌─────────────────────────────────────────────────┐
│ Level 1: Memory (Lambda)     TTL: Request lifecycle │
├─────────────────────────────────────────────────┤
│ Level 2: Redis (ElastiCache) TTL: 1 hour        │
├─────────────────────────────────────────────────┤
│ Level 3: PostgreSQL (Supabase) TTL: Permanent   │
└─────────────────────────────────────────────────┘
```

**Implementation**:
```typescript
class SessionCache {
  private memoryCache: Map<string, Session> = new Map();

  async get(phoneNumber: string): Promise<Session | null> {
    // L1: Memory
    if (this.memoryCache.has(phoneNumber)) {
      return this.memoryCache.get(phoneNumber)!;
    }

    // L2: Redis
    const cached = await redis.get(`session:${phoneNumber}`);
    if (cached) {
      const session = JSON.parse(cached);
      this.memoryCache.set(phoneNumber, session);
      return session;
    }

    // L3: Database
    const session = await db.whatsapp_sessions.findOne({ phone_number: phoneNumber });
    if (session) {
      await redis.setex(`session:${phoneNumber}`, 3600, JSON.stringify(session));
      this.memoryCache.set(phoneNumber, session);
    }

    return session;
  }

  async invalidate(phoneNumber: string): Promise<void> {
    this.memoryCache.delete(phoneNumber);
    await redis.del(`session:${phoneNumber}`);
  }
}
```

### 9.2 Database Optimization

**Connection Pooling**:
```typescript
import { Pool } from 'pg';

const pool = new Pool({
  host: process.env.SUPABASE_DB_HOST,
  port: 5432,
  database: 'postgres',
  user: process.env.SUPABASE_DB_USER,
  password: process.env.SUPABASE_DB_PASSWORD,
  max: 20, // Max connections
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000
});
```

**Query Optimization**:
```sql
-- Use partial indexes for active sessions only
CREATE INDEX idx_sessions_active ON whatsapp_sessions(phone_number, current_state)
  WHERE current_state != 'IDLE' AND deleted_at IS NULL;

-- Use covering indexes for common queries
CREATE INDEX idx_sessions_full_lookup ON whatsapp_sessions(phone_number)
  INCLUDE (current_state, context, expires_at);
```

### 9.3 Batch Operations

**Bulk timeout handling**:
```typescript
async function expireSessionsBatch(sessionIds: string[]): Promise<void> {
  // Batch database updates
  await db.whatsapp_sessions.updateMany(
    { id: { $in: sessionIds } },
    {
      current_state: 'IDLE',
      context: {},
      expires_at: null,
      updated_at: new Date()
    }
  );

  // Batch cache invalidation
  const pipeline = redis.pipeline();
  sessionIds.forEach(id => {
    pipeline.del(`session:${id}`);
  });
  await pipeline.exec();

  // Batch notifications (send via SQS)
  const messages = sessionIds.map(id => ({
    type: 'session_expired',
    session_id: id,
    timestamp: new Date()
  }));

  await sqs.sendMessageBatch(messages);
}
```

---

## 10. Testing & Validation

### 10.1 Unit Tests

**State Transition Tests**:
```typescript
describe('State Transitions', () => {
  it('should allow IDLE -> ONBOARDING transition', async () => {
    const session = await createSession('+263771234567');
    const updated = await transitionState(session.id, 'ONBOARDING');

    expect(updated.current_state).toBe('ONBOARDING');
    expect(updated.previous_state).toBe('IDLE');
  });

  it('should reject invalid ONBOARDING -> PAYMENT_MENU transition', async () => {
    const session = await createSession('+263771234567');
    await transitionState(session.id, 'ONBOARDING');

    await expect(
      transitionState(session.id, 'PAYMENT_MENU')
    ).rejects.toThrow(InvalidStateTransitionError);
  });

  it('should enforce authentication for BROWSING state', async () => {
    const session = await createSession('+263771234567'); // No customer_id

    await expect(
      transitionState(session.id, 'BROWSING')
    ).rejects.toThrow(UnauthorizedError);
  });
});
```

**Context Persistence Tests**:
```typescript
describe('Context Persistence', () => {
  it('should save and restore context', async () => {
    const session = await createSession('+263771234567');

    const contextData = {
      onboarding: {
        step: 'national_id',
        first_name: 'John',
        last_name: 'Doe',
        attempts: 1,
        max_attempts: 3
      }
    };

    await updateSession(session.id, { context: contextData });

    const restored = await getSession('+263771234567');
    expect(restored?.context.onboarding?.first_name).toBe('John');
  });
});
```

### 10.2 Integration Tests

**End-to-End Flow Test**:
```typescript
describe('Onboarding Flow E2E', () => {
  it('should complete full onboarding flow', async () => {
    const phoneNumber = '+263771234567';

    // 1. Start onboarding
    let session = await createSession(phoneNumber);
    session = await transitionState(session.id, 'ONBOARDING');

    // 2. Capture name
    session = await updateSession(session.id, {
      context: {
        onboarding: {
          step: 'first_name',
          first_name: 'John',
          attempts: 0,
          max_attempts: 3
        }
      }
    });

    // 3. Capture National ID
    session = await updateSession(session.id, {
      context: {
        onboarding: {
          ...session.context.onboarding,
          step: 'national_id',
          last_name: 'Doe',
          national_id: '63-123456-A-12'
        }
      }
    });

    // 4. Upload photos
    session = await transitionState(session.id, 'KYC_SUBMIT');
    session = await updateSession(session.id, {
      context: {
        onboarding: {
          ...session.context.onboarding,
          id_front_url: 'https://cdn.lynia.com/kyc/front.jpg',
          id_back_url: 'https://cdn.lynia.com/kyc/back.jpg',
          selfie_url: 'https://cdn.lynia.com/kyc/selfie.jpg'
        }
      }
    });

    // 5. Submit KYC
    session = await transitionState(session.id, 'KYC_PENDING');

    expect(session.current_state).toBe('KYC_PENDING');
    expect(session.context.onboarding?.national_id).toBe('63-123456-A-12');
  });
});
```

### 10.3 Load Tests

**Concurrent Sessions**:
```typescript
describe('Load Tests', () => {
  it('should handle 1000 concurrent sessions', async () => {
    const promises = [];

    for (let i = 0; i < 1000; i++) {
      const phoneNumber = `+26377${String(i).padStart(7, '0')}`;
      promises.push(createSession(phoneNumber));
    }

    const sessions = await Promise.all(promises);
    expect(sessions).toHaveLength(1000);
  });

  it('should handle 100 concurrent updates to same session', async () => {
    const session = await createSession('+263771234567');

    const promises = [];
    for (let i = 0; i < 100; i++) {
      promises.push(
        updateSession(session.id, {
          context: { counter: i }
        })
      );
    }

    await Promise.all(promises);

    const final = await getSession('+263771234567');
    expect(final).toBeTruthy();
    // Last write wins
  });
});
```

### 10.4 Timeout Tests

```typescript
describe('Timeout Handling', () => {
  it('should expire session after timeout', async () => {
    const session = await createSession('+263771234567');
    await transitionState(session.id, 'ONBOARDING');

    // Fast-forward time (mock)
    jest.advanceTimersByTime(30 * 60 * 1000); // 30 minutes

    await cleanupExpiredSessions();

    const expired = await getSession('+263771234567');
    expect(expired?.current_state).toBe('IDLE');
  });

  it('should allow session resume after expiry', async () => {
    const phoneNumber = '+263771234567';
    let session = await createSession(phoneNumber);
    await transitionState(session.id, 'ONBOARDING', {
      onboarding: { step: 'national_id', first_name: 'John' }
    });

    // Expire session
    await expireSession(session.id);

    // Resume
    session = await resumeExpiredSession(phoneNumber);

    expect(session?.current_state).toBe('ONBOARDING');
    expect(session?.context.onboarding?.first_name).toBe('John');
  });
});
```

---

## 11. Monitoring & Observability

### 11.1 Key Metrics

**Session Metrics**:
- Active sessions count
- Sessions created per minute
- Average session duration
- Session timeout rate
- Session resume rate

**State Metrics**:
- State transition count (by state pair)
- Time spent in each state
- Invalid transition attempts
- State transition errors

**Performance Metrics**:
- Session lookup latency (p50, p95, p99)
- Session update latency
- Context size distribution
- Cache hit rate

### 11.2 CloudWatch Dashboards

```typescript
// Publish metrics to CloudWatch
async function publishMetrics() {
  const cloudwatch = new AWS.CloudWatch();

  // Active sessions
  const activeSessions = await db.whatsapp_sessions.count({
    current_state: { $ne: 'IDLE' }
  });

  await cloudwatch.putMetricData({
    Namespace: 'LyniaFinance/WhatsAppBot',
    MetricData: [
      {
        MetricName: 'ActiveSessions',
        Value: activeSessions,
        Unit: 'Count',
        Timestamp: new Date()
      }
    ]
  });
}
```

### 11.3 Alerts

**Critical Alerts**:
- High session timeout rate (>10%)
- High invalid transition rate (>5%)
- Session lookup latency >500ms
- Database connection pool exhaustion

**Warning Alerts**:
- Cache hit rate <80%
- Average session duration >1 hour
- Stale session count >100

---

## 12. Implementation Checklist

### Phase 1: Core Implementation (Week 1)
- [ ] Implement state machine (12 states, transition logic)
- [ ] Create session database table + indexes
- [ ] Implement session CRUD operations
- [ ] Set up Redis caching layer
- [ ] Implement distributed locking

### Phase 2: Advanced Features (Week 2)
- [ ] Implement timeout handling (detection + recovery)
- [ ] Build session resume functionality
- [ ] Add context versioning
- [ ] Implement multi-device support
- [ ] Add crash recovery mechanisms

### Phase 3: Testing (Week 3)
- [ ] Write unit tests (80% coverage)
- [ ] Write integration tests (E2E flows)
- [ ] Run load tests (1000 concurrent sessions)
- [ ] Test timeout scenarios
- [ ] Test recovery mechanisms

### Phase 4: Monitoring (Week 4)
- [ ] Set up CloudWatch metrics
- [ ] Create monitoring dashboards
- [ ] Configure alerts (critical + warning)
- [ ] Document runbooks
- [ ] Conduct failure mode testing

---

## 13. Document Control

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2025-11-24 | Engineering Team | Initial state management design |

**Review Schedule**: Bi-weekly
**Next Review**: 2025-12-08
**Owner**: Lead Backend Engineer
**Approvers**: CTO, Engineering Manager

---

**End of Document**
