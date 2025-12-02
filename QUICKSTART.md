# Lynia Finance - Quick Start Guide

**Get up and running in 30 minutes!**

This guide gets you from zero to running local development environment as fast as possible.

---

## Prerequisites Check ✅

Before starting, ensure you have:

- [ ] **Node.js 18+** installed
- [ ] **Git** installed
- [ ] **pnpm** installed (`npm install -g pnpm`)
- [ ] **Supabase account** created
- [ ] **Meta Developer account** created (for WhatsApp)
- [ ] **30 minutes** of time

---

## Step 1: Clone & Setup (5 minutes)

```bash
# You're already in the project directory
cd "C:\Users\Admin\Documents\Lynia Finance Project\Lynia Finance Dev"

# Create project structure
.\scripts\create-project-structure.bat

# Install dependencies
pnpm install
```

---

## Step 2: Environment Configuration (10 minutes)

### 2.1 Copy Environment Template

```bash
# Copy .env.example to .env
copy .env.example .env
```

### 2.2 Create Supabase Project

1. Go to https://supabase.com/dashboard
2. Click **"New Project"**
3. Fill in:
   - Name: `lynia-finance-dev`
   - Database Password: (generate & save)
   - Region: `eu-west-2` (London, closest to Zimbabwe)
4. Wait 2-3 minutes for provisioning

### 2.3 Get Supabase Credentials

1. In Supabase Dashboard → **Settings** → **API**
2. Copy these values to your `.env`:

```env
SUPABASE_URL=https://xxxxxxxxxxxxx.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### 2.4 Set Up WhatsApp (Can do later)

For now, add placeholders to `.env`:

```env
WHATSAPP_PHONE_NUMBER_ID=placeholder
WHATSAPP_ACCESS_TOKEN=placeholder
WHATSAPP_WEBHOOK_VERIFY_TOKEN=lynia_webhook_2025
```

**Note**: See `SETUP.md` for full WhatsApp Cloud API setup instructions.

---

## Step 3: Database Setup (10 minutes)

### 3.1 Login to Supabase CLI

```bash
# Login
supabase login

# Link to your project
supabase link --project-ref xxxxxxxxxxxxx
```

### 3.2 Deploy Database Schema

**Option A: Using Supabase Dashboard** (Easier)

1. Go to Supabase Dashboard → **SQL Editor**
2. Open `database/migrations/001_initial_schema.sql`
3. Copy entire contents
4. Paste into SQL Editor
5. Click **"Run"**
6. Wait ~30 seconds

**Option B: Using CLI**

```bash
supabase db push
```

### 3.3 Verify Tables Created

In Supabase Dashboard → **Table Editor**, you should see:
- ✅ customers
- ✅ loans
- ✅ payments
- ✅ devices
- ✅ ... (15 more tables)

### 3.4 Load Test Data

1. In SQL Editor, open `database/seed/001_test_data.sql`
2. Copy & paste
3. Click **"Run"**
4. You should see success messages

---

## Step 4: Start Development (5 minutes)

### 4.1 Test Supabase Connection

```bash
# Test connection
supabase status

# Expected output:
# API URL: https://xxxxxxxxxxxxx.supabase.co
# Status: ✓ Connected
```

### 4.2 Run Tests

```bash
# Run tests to verify setup
pnpm test

# Expected: 2/2 tests passing (weights and points validation)
```

### 4.3 Start Development

You're ready to start Phase 2 development!

Choose your first task:

#### **Option A: Build Credit Scoring Service** (P2-T004)
```bash
cd services/scoring-service

# Create main handler
mkdir -p src/handlers
touch src/handlers/calculate-score.ts

# Start coding!
```

#### **Option B: Set Up WhatsApp Bot** (P2-T006)
```bash
cd services/whatsapp-service

# Create main handler
mkdir -p src/handlers
touch src/handlers/webhook.ts

# Start coding!
```

#### **Option C: Build Admin Dashboard** (P2-T011)
```bash
cd frontend/admin-portal

# Initialize Next.js
npx create-next-app@latest . --typescript --tailwind --app

# Start dev server
pnpm dev
```

---

## Verify Your Setup ✅

Run this checklist to confirm everything is working:

### Environment
- [ ] `.env` file exists with Supabase credentials
- [ ] `node --version` shows v18+
- [ ] `pnpm --version` works

### Database
- [ ] Supabase project created
- [ ] 19 tables visible in Table Editor
- [ ] Test data loaded (3 customers, 2 loans, etc.)

### Project Structure
- [ ] `services/` folder exists with 6 service folders
- [ ] `frontend/` folder exists
- [ ] `database/` folder exists with migrations and seed

### Testing
- [ ] `pnpm test` passes (2/2 tests)
- [ ] `supabase status` shows connected

---

## What's Next?

### Immediate Next Steps

1. **Review Phase 2 Plan**: Read [PHASE-2-KICKOFF-PLAN.md](PHASE-2-KICKOFF-PLAN.md)
2. **Start First Task**: Recommended: **P2-T004: Credit Scoring Service**
3. **Set Up WhatsApp**: Follow [SETUP.md#whatsapp-cloud-api-setup](SETUP.md#whatsapp-cloud-api-setup)

### Recommended Order

**Week 1-2: Foundation**
1. ✅ Setup complete (you are here!)
2. P2-T004: Implement credit scoring service
3. P2-T005: Set up WhatsApp Cloud API
4. P2-T006: Build WhatsApp bot onboarding flow

**Week 3-4: Core Services**
5. P2-T007: Integrate Smile Identity KYC
6. P2-T008: Mobile money payment integration
7. P2-T009: Device handover process

**Week 5-6: Dashboard & Testing**
8. P2-T011: Admin dashboard
9. P2-T012: Integration testing
10. Demo preparation

---

## Common Issues & Solutions

### Issue: pnpm install fails

```bash
# Clear cache and retry
pnpm store prune
rm -rf node_modules pnpm-lock.yaml
pnpm install
```

### Issue: Supabase connection fails

```bash
# Check credentials
echo $SUPABASE_URL
echo $SUPABASE_ANON_KEY

# Re-login
supabase login
supabase link --project-ref xxxxxxxxxxxxx
```

### Issue: Database migration fails

```bash
# Reset database (CAUTION: Deletes all data)
supabase db reset

# Re-run migration manually in SQL Editor
```

### Issue: Tests failing

```bash
# Install dependencies
pnpm install

# Run specific test
pnpm test scoring.test.ts
```

---

## Need Help?

### Documentation
- **Full Setup Guide**: [SETUP.md](SETUP.md) (detailed instructions)
- **Phase 2 Plan**: [PHASE-2-KICKOFF-PLAN.md](PHASE-2-KICKOFF-PLAN.md)
- **Validation Report**: [PHASE-1-VALIDATION-REPORT.md](PHASE-1-VALIDATION-REPORT.md)

### Specifications
- **Credit Scoring**: `planning/credit-scoring-algorithm.md`
- **Onboarding Flow**: `planning/customer-onboarding-flow.md`
- **Database Schema**: `planning/database-schema.md`
- **All 45 specs**: `planning/` folder

### External Resources
- Supabase Docs: https://supabase.com/docs
- WhatsApp Cloud API: https://developers.facebook.com/docs/whatsapp/cloud-api
- AWS SAM: https://docs.aws.amazon.com/serverless-application-model/

---

## Development Workflow

### Daily Workflow

```bash
# 1. Start your day
git pull origin main

# 2. Check what you're working on
cat PHASE-2-KICKOFF-PLAN.md

# 3. Start development
cd services/your-service
pnpm dev

# 4. Run tests frequently
pnpm test

# 5. End of day: commit your work
git add .
git commit -m "P2-T004: Implement affordability scoring component"
git push
```

### Testing Workflow

```bash
# Run all tests
pnpm test

# Run specific service tests
cd services/scoring-service
pnpm test

# Run with coverage
pnpm test --coverage

# Watch mode (auto-run on changes)
pnpm test --watch
```

### Database Workflow

```bash
# View current schema
supabase db diff

# Create new migration
touch database/migrations/002_add_new_table.sql

# Apply migration
# Copy-paste SQL into Supabase SQL Editor and run

# Verify changes
# Check Table Editor in Supabase Dashboard
```

---

## Project Overview

### What We're Building

Lynia Finance is a WhatsApp-based device financing platform for Zimbabwe's informal sector. Phase 2 focuses on:

1. **Core Infrastructure** (Supabase + AWS Lambda)
2. **Credit Scoring** (5-component affordability model)
3. **WhatsApp Bot** (8-step onboarding with +263 validation)
4. **KYC Integration** (Smile Identity)
5. **Payment Processing** (EcoCash/OneMoney)
6. **Admin Dashboard** (Next.js 14)

### Key Features (Phase 2)

✅ Zimbabwe-only phone validation (+263)
✅ Affordability-based credit scoring (300-850)
✅ Deposit enforcement (no cash on delivery)
✅ Multi-product architecture
✅ Product filtering in reports
✅ Device lock/unlock management

### Tech Stack

- **Database**: Supabase (PostgreSQL)
- **Backend**: AWS Lambda (Node.js 18, TypeScript)
- **Frontend**: Next.js 14, React, Tailwind CSS
- **Messaging**: WhatsApp Cloud API
- **KYC**: Smile Identity
- **Payments**: EcoCash, OneMoney
- **Deployment**: AWS SAM, Vercel

---

## Success Criteria

You'll know setup is successful when:

✅ **Database**: 19 tables created in Supabase
✅ **Test Data**: 3 customers, 2 loans visible
✅ **Tests**: `pnpm test` shows 2/2 passing
✅ **Connection**: `supabase status` shows connected
✅ **Structure**: All service folders created
✅ **Environment**: `.env` file configured

---

## Time Estimates

- **Setup (this guide)**: 30 minutes
- **Full development setup**: 2-3 hours (with WhatsApp, etc.)
- **Phase 2 completion**: 6-8 weeks
- **MVP ready**: January 22, 2025

---

## Get Coding! 🚀

You're all set! Choose your first task from [PHASE-2-KICKOFF-PLAN.md](PHASE-2-KICKOFF-PLAN.md) and start building.

**Recommended first task**: **P2-T004: Credit Scoring Service** (highest priority)

```bash
cd services/scoring-service
code .  # Open in VS Code
# Start implementing the 5-component scoring algorithm!
```

---

**Need detailed setup instructions?** See [SETUP.md](SETUP.md)

**Ready to start coding?** See [PHASE-2-KICKOFF-PLAN.md](PHASE-2-KICKOFF-PLAN.md)

**Questions about specs?** Check `planning/` folder (45 detailed specs)

**Happy coding! 🎉**
