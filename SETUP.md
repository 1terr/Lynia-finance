# Lynia Finance - Phase 2 Setup Guide

**Complete setup instructions for Phase 2 development environment**

**Estimated Setup Time**: 2-3 hours
**Last Updated**: November 28, 2025
**Phase**: Phase 2 - Infrastructure & Implementation

---

## 📋 Table of Contents

1. [Prerequisites](#prerequisites)
2. [Development Tools Installation](#development-tools-installation)
3. [Project Structure Setup](#project-structure-setup)
4. [Supabase Setup (P2-T001)](#supabase-setup)
5. [WhatsApp Cloud API Setup (P2-T005)](#whatsapp-cloud-api-setup)
6. [Third-Party Service Credentials](#third-party-service-credentials)
7. [Database Schema Deployment (P2-T002)](#database-schema-deployment)
8. [AWS Lambda Configuration (P2-T003)](#aws-lambda-configuration)
9. [Environment Variables](#environment-variables)
10. [Local Development Setup](#local-development-setup)
11. [Testing Setup](#testing-setup)
12. [Troubleshooting](#troubleshooting)

---

## Prerequisites

### Required Accounts

Before starting, create accounts for the following services:

- [ ] **Supabase** - https://supabase.com (Free tier available)
- [ ] **Meta Developer** - https://developers.facebook.com
- [ ] **DIDIT** - https://usediditid.com (Sandbox access)
- [ ] **AWS** - https://aws.amazon.com (Free tier available)
- [ ] **GitHub** - https://github.com (for version control)

### System Requirements

- **OS**: Windows 10+, macOS 10.15+, or Linux (Ubuntu 20.04+)
- **RAM**: Minimum 8GB (16GB recommended)
- **Disk Space**: 10GB free space
- **Internet**: Stable broadband connection

---

## Development Tools Installation

### 1. Install Node.js 18+

**Windows**:
```bash
# Download from https://nodejs.org/
# OR use winget
winget install OpenJS.NodeJS.LTS
```

**macOS**:
```bash
# Using Homebrew
brew install node@18
```

**Linux**:
```bash
# Using nvm (recommended)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
nvm install 18
nvm use 18
```

**Verify Installation**:
```bash
node --version  # Should show v18.x.x or higher
npm --version   # Should show 9.x.x or higher
```

---

### 2. Install pnpm (Package Manager)

```bash
npm install -g pnpm

# Verify
pnpm --version  # Should show 8.x.x or higher
```

**Why pnpm?** Faster, more efficient, better monorepo support than npm.

---

### 3. Install Git

**Windows**:
```bash
winget install Git.Git
```

**macOS**:
```bash
brew install git
```

**Linux**:
```bash
sudo apt-get install git
```

**Verify**:
```bash
git --version
```

---

### 4. Install TypeScript

```bash
npm install -g typescript ts-node

# Verify
tsc --version  # Should show 5.x.x or higher
```

---

### 5. Install Supabase CLI

```bash
npm install -g supabase

# Verify
supabase --version
```

---

### 6. Install AWS SAM CLI

**Windows**:
```bash
# Download MSI installer from:
# https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/install-sam-cli.html
```

**macOS**:
```bash
brew tap aws/tap
brew install aws-sam-cli
```

**Linux**:
```bash
pip install aws-sam-cli
```

**Verify**:
```bash
sam --version
```

---

### 7. Install Docker Desktop (Optional, for local testing)

Download from: https://www.docker.com/products/docker-desktop

**Verify**:
```bash
docker --version
docker-compose --version
```

---

### 8. Install VS Code (Recommended IDE)

Download from: https://code.visualstudio.com/

**Recommended Extensions**:
- ESLint
- Prettier
- Thunder Client (API testing)
- Supabase Extension
- AWS Toolkit
- GitLens

---

## Project Structure Setup

### 1. Clone Repository

```bash
cd "C:\Users\Admin\Documents\Lynia Finance Project"
cd "Lynia Finance Dev"

# Verify you're in the right directory
pwd
```

---

### 2. Create Project Folder Structure

```bash
# Create services directory structure
mkdir -p services/shared/types
mkdir -p services/shared/utils
mkdir -p services/scoring-service/src/handlers
mkdir -p services/scoring-service/src/scoring
mkdir -p services/scoring-service/tests
mkdir -p services/whatsapp-service/src/handlers
mkdir -p services/whatsapp-service/src/flows
mkdir -p services/whatsapp-service/tests
mkdir -p services/kyc-service/src/handlers
mkdir -p services/kyc-service/tests
mkdir -p services/payment-service/src/handlers
mkdir -p services/payment-service/tests
mkdir -p services/lock-service/src/handlers
mkdir -p services/lock-service/tests

# Create frontend directory
mkdir -p frontend/admin-portal

# Create database migrations directory
mkdir -p database/migrations
mkdir -p database/seed

# Create infrastructure directory
mkdir -p infrastructure/aws
mkdir -p infrastructure/supabase

# Create config directory
mkdir -p config

echo "✅ Project structure created"
```

**Verify Structure**:
```bash
tree services -L 2
```

---

## Supabase Setup

### Step 1: Create Supabase Project

1. Go to https://supabase.com/dashboard
2. Click **"New Project"**
3. Fill in details:
   - **Name**: `lynia-finance-dev`
   - **Database Password**: Generate strong password (save it!)
   - **Region**: Choose closest to Zimbabwe (e.g., `eu-west-2` London)
   - **Pricing Plan**: Free (upgradeable later)
4. Click **"Create new project"**
5. Wait 2-3 minutes for provisioning

---

### Step 2: Get Supabase Credentials

1. In Supabase Dashboard, go to **Settings** → **API**
2. Copy the following:

```bash
# Project URL
SUPABASE_URL=https://xxxxxxxxxxxxx.supabase.co

# Anon (public) Key
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Service Role Key (KEEP SECRET!)
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**⚠️ IMPORTANT**: Never commit `SUPABASE_SERVICE_ROLE_KEY` to Git!

---

### Step 3: Configure Supabase Authentication

1. Go to **Authentication** → **Settings**
2. **Site URL**: `http://localhost:3000` (for development)
3. **Redirect URLs**: Add:
   - `http://localhost:3000/**`
   - (Add production URL later)
4. Enable **Email Authentication**
5. **Email Templates**: Customize later

---

### Step 4: Test Supabase Connection

```bash
# Login to Supabase CLI
supabase login

# Link to your project
supabase link --project-ref xxxxxxxxxxxxx

# Test connection
supabase db pull

# Expected output: "✅ Connected to Supabase"
```

---

## WhatsApp Cloud API Setup

### Step 1: Create Meta Developer Account

1. Go to https://developers.facebook.com/
2. Click **"Get Started"**
3. Complete account verification
4. Accept Terms of Service

---

### Step 2: Create WhatsApp Business App

1. Go to **My Apps** → **Create App**
2. Select **"Business"** as app type
3. Fill in details:
   - **App Name**: `Lynia Finance Bot`
   - **App Contact Email**: your-email@domain.com
   - **Business Account**: Create new or select existing
4. Click **"Create App"**

---

### Step 3: Add WhatsApp Product

1. In App Dashboard, find **WhatsApp** product
2. Click **"Set Up"**
3. Select **WhatsApp Cloud API** (not On-Premises)
4. Click **"Get Started"**

---

### Step 4: Get WhatsApp Credentials

**Temporary Access Token** (expires in 24 hours):
```bash
# From WhatsApp → API Setup page
WHATSAPP_ACCESS_TOKEN=EAAxxxxxxxxxxxxx
```

**Phone Number ID**:
```bash
# From WhatsApp → API Setup page
WHATSAPP_PHONE_NUMBER_ID=123456789012345
```

**Test Phone Number**:
- You'll get a test number like `+1 555 0100`
- Can send to max 5 verified numbers

---

### Step 5: Configure Webhook

1. Go to **WhatsApp** → **Configuration**
2. Click **"Edit"** on Webhook
3. **Callback URL**: `https://your-ngrok-url.ngrok.io/webhook`
   - For local testing, use ngrok (see below)
4. **Verify Token**: Create a secret token (e.g., `lynia_webhook_2025`)
   - Save as `WHATSAPP_WEBHOOK_VERIFY_TOKEN`
5. Click **"Verify and Save"**

**Subscribe to Webhook Fields**:
- [x] messages
- [x] message_status (optional)

---

### Step 6: Set Up ngrok for Local Testing

```bash
# Install ngrok
npm install -g ngrok

# Start ngrok tunnel (in a separate terminal)
ngrok http 3000

# Copy the HTTPS URL (e.g., https://abc123.ngrok.io)
# Use this as your Webhook URL in Meta Dashboard
```

---

### Step 7: Generate Permanent Access Token

**For production, create a permanent token**:

1. Go to **WhatsApp** → **API Setup**
2. Click **"Create Permanent Token"**
3. Select permissions:
   - `whatsapp_business_messaging`
   - `whatsapp_business_management`
4. Save the token securely

```bash
WHATSAPP_PERMANENT_ACCESS_TOKEN=EAAxxxxxxxxxxxxx
```

---

### Step 8: Verify WhatsApp Number (for testing)

1. Go to **WhatsApp** → **API Setup**
2. Under **"To"**, add your phone number with country code
3. You'll receive a code via WhatsApp
4. Enter code to verify

**Now you can send test messages to your verified number!**

---

## Third-Party Service Credentials

### DIDIT (KYC Verification)

**Step 1: Request Sandbox Access**
1. Go to https://usediditid.com/
2. Click **"Get Started"** or **"Request Demo"**
3. Fill form requesting **Sandbox API Access**
4. Mention: "Zimbabwe ID verification for fintech startup"

**Step 2: Get Credentials** (they'll email you)
```bash
DIDIT_API_KEY=001
DIDIT_WEBHOOK_SECRET=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
DIDIT_WEBHOOK_URL=https://your-api.com/api/kyc/callback
```

**Step 3: Test Connection** (once credentials received)
```bash
curl -X POST https://testapi.diditidentity.com/v1/services \
  -H "Content-Type: application/json" \
  -d '{
    "partner_id": "001",
    "api_key": "your-api-key"
  }'
```

---

### Mobile Money APIs (Sandbox)

**EcoCash API**:
1. Contact: https://www.econet.co.zw/business/ecocash-merchant-services
2. Request **Sandbox API Access** for testing
3. Get credentials:
```bash
ECOCASH_MERCHANT_ID=TEST_MERCHANT_001
ECOCASH_API_KEY=test_xxxxxxxxxxxxxxxx
ECOCASH_API_URL=https://sandbox.ecocash.co.zw/api/v1
```

**OneMoney API**:
1. Contact: https://www.onemoney.co.zw/
2. Request **Developer Sandbox Access**
3. Get credentials:
```bash
ONEMONEY_MERCHANT_ID=TEST_MERCHANT_001
ONEMONEY_API_KEY=test_xxxxxxxxxxxxxxxx
ONEMONEY_API_URL=https://sandbox.onemoney.co.zw/api/v1
```

**⚠️ Note**: These might take 1-2 weeks for approval. Start requests early!

---

### Device Lock APIs

**Google Find My Device API**:
- For Android devices
- Requires Google Workspace Business account
- Documentation: https://developers.google.com/android/management

**Samsung Knox**:
- For Samsung devices
- Free tier available
- Documentation: https://docs.samsungknox.com/

**Start with one**, expand later.

---

## Database Schema Deployment

### Step 1: Review Database Schema

```bash
# Open the database schema spec
cat planning/database-schema.md
```

Review the 19 tables we need to create.

---

### Step 2: Create Migration File

Create file: `database/migrations/001_initial_schema.sql`

I'll create this in the next step with all tables.

---

### Step 3: Run Migration

```bash
# Connect to Supabase
supabase db push

# OR use Supabase Dashboard SQL Editor
# Copy-paste the migration SQL
```

---

### Step 4: Verify Tables Created

```bash
# Check tables exist
supabase db diff

# OR in Supabase Dashboard → Table Editor
# You should see all 19 tables
```

---

### Step 5: Set Up Row Level Security (RLS)

Enable RLS on all tables:

```sql
-- Run in Supabase SQL Editor
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE loans ENABLE ROW LEVEL SECURITY;
-- ... for all tables
```

---

### Step 6: Create RLS Policies

Example for customers table:

```sql
-- Admins can view all customers
CREATE POLICY "Admins can view all customers"
ON customers FOR SELECT
TO authenticated
USING (
  auth.uid() IN (
    SELECT id FROM admin_users WHERE role IN ('admin', 'manager')
  )
);

-- Customers can view their own data
CREATE POLICY "Customers can view own data"
ON customers FOR SELECT
TO authenticated
USING (auth.uid() = id);
```

(Full RLS policies will be in migration file)

---

### Step 7: Seed Test Data

Create file: `database/seed/001_test_data.sql`

```sql
-- Insert test admin user
INSERT INTO admin_users (email, full_name, role) VALUES
('admin@lynia.finance', 'Test Admin', 'admin');

-- Insert test product
INSERT INTO loan_products (
  product_code,
  product_name,
  product_type,
  status
) VALUES (
  'SMRT_FIN_001',
  'Smartphone Financing',
  'asset_financing',
  'active'
);
```

---

## AWS Lambda Configuration

### Step 1: Install AWS CLI

**Windows**:
```bash
msiexec.exe /i https://awscli.amazonaws.com/AWSCLIV2.msi
```

**macOS**:
```bash
brew install awscli
```

**Linux**:
```bash
curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
unzip awscliv2.zip
sudo ./aws/install
```

---

### Step 2: Configure AWS Credentials

```bash
aws configure

# Enter:
AWS Access Key ID: AKIA...
AWS Secret Access Key: ...
Default region: us-east-1
Default output format: json
```

**Get AWS credentials**:
1. AWS Console → IAM → Users → Create User
2. Attach policy: `AdministratorAccess` (for dev)
3. Create access key → Save credentials

---

### Step 3: Initialize SAM Project

```bash
cd services

# Initialize SAM
sam init

# Choose:
# 1 - AWS Quick Start Templates
# 1 - Hello World Example
# N - Use the most popular runtime and package type? (nodejs18.x and Zip)
# Project name: lynia-services
# Y - Use dependency manager? (npm)
```

---

### Step 4: Test SAM Locally

```bash
cd lynia-services

# Build
sam build

# Test locally
sam local start-api

# Test endpoint
curl http://localhost:3000/hello
```

---

## Environment Variables

### Step 1: Create `.env` File

```bash
# In project root
touch .env

# Add to .gitignore
echo ".env" >> .gitignore
echo ".env.*" >> .gitignore
echo "!.env.example" >> .gitignore
```

---

### Step 2: Populate `.env`

```bash
# ==================================
# Lynia Finance - Environment Variables
# ==================================

# ----- Supabase -----
SUPABASE_URL=https://xxxxxxxxxxxxx.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...  # KEEP SECRET!

# ----- WhatsApp Cloud API -----
WHATSAPP_PHONE_NUMBER_ID=123456789012345
WHATSAPP_ACCESS_TOKEN=EAAxxxxxxxxxxxxx
WHATSAPP_WEBHOOK_VERIFY_TOKEN=lynia_webhook_2025  # Your secret token
WHATSAPP_API_VERSION=v18.0

# ----- DIDIT (KYC) -----
DIDIT_API_KEY=001
DIDIT_WEBHOOK_SECRET=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
DIDIT_WEBHOOK_URL=https://your-api.com/api/kyc/callback
DIDIT_ENVIRONMENT=sandbox  # or 'production'

# ----- Mobile Money - EcoCash -----
ECOCASH_MERCHANT_ID=TEST_MERCHANT_001
ECOCASH_API_KEY=test_xxxxxxxxxxxxxxxx
ECOCASH_API_URL=https://sandbox.ecocash.co.zw/api/v1

# ----- Mobile Money - OneMoney -----
ONEMONEY_MERCHANT_ID=TEST_MERCHANT_001
ONEMONEY_API_KEY=test_xxxxxxxxxxxxxxxx
ONEMONEY_API_URL=https://sandbox.onemoney.co.zw/api/v1

# ----- AWS -----
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=AKIA...
AWS_SECRET_ACCESS_KEY=...

# ----- Application Config -----
NODE_ENV=development
PORT=3000
API_BASE_URL=http://localhost:3000

# ----- Security -----
JWT_SECRET=your-super-secret-jwt-key-change-in-production
ENCRYPTION_KEY=your-encryption-key-32-characters

# ----- Logging -----
LOG_LEVEL=debug  # debug, info, warn, error

# ----- Feature Flags -----
ENABLE_SMS_OTP=true
ENABLE_WHATSAPP_OTP=false
ENABLE_DEVICE_LOCK=true
ENABLE_MULTI_PRODUCT=false  # Phase 3 feature
```

---

### Step 3: Create `.env.example` Template

```bash
# Copy .env to create template (without secrets)
cp .env .env.example

# Replace all values with placeholders
# Example:
# SUPABASE_URL=https://your-project-id.supabase.co
# SUPABASE_ANON_KEY=your-anon-key-here
```

**Commit `.env.example` to Git, but NEVER `.env`!**

---

## Local Development Setup

### Step 1: Install Dependencies

```bash
# In project root
pnpm install

# Install dependencies for each service
cd services/scoring-service
pnpm install

cd ../whatsapp-service
pnpm install

cd ../kyc-service
pnpm install

cd ../payment-service
pnpm install

cd ../lock-service
pnpm install

# Back to root
cd ../..
```

---

### Step 2: Set Up TypeScript

Create `tsconfig.json` in project root:

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "lib": ["ES2020"],
    "outDir": "./dist",
    "rootDir": "./services",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "moduleResolution": "node",
    "types": ["node", "jest"]
  },
  "include": ["services/**/*"],
  "exclude": ["node_modules", "dist", "**/*.spec.ts"]
}
```

---

### Step 3: Set Up ESLint & Prettier

```bash
# Install ESLint
pnpm add -D eslint @typescript-eslint/parser @typescript-eslint/eslint-plugin

# Install Prettier
pnpm add -D prettier eslint-config-prettier eslint-plugin-prettier

# Create .eslintrc.json
cat > .eslintrc.json << 'EOF'
{
  "parser": "@typescript-eslint/parser",
  "extends": [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended",
    "prettier"
  ],
  "plugins": ["@typescript-eslint", "prettier"],
  "rules": {
    "prettier/prettier": "error",
    "@typescript-eslint/no-unused-vars": "warn",
    "@typescript-eslint/explicit-function-return-type": "off"
  }
}
EOF

# Create .prettierrc
cat > .prettierrc << 'EOF'
{
  "semi": true,
  "singleQuote": true,
  "tabWidth": 2,
  "trailingComma": "es5",
  "printWidth": 100
}
EOF
```

---

### Step 4: Set Up Git Hooks (Optional)

```bash
# Install husky for pre-commit hooks
pnpm add -D husky lint-staged

# Initialize husky
npx husky install

# Add pre-commit hook
npx husky add .husky/pre-commit "npx lint-staged"

# Configure lint-staged in package.json
```

---

## Testing Setup

### Step 1: Install Jest

```bash
# Install Jest and TypeScript support
pnpm add -D jest @types/jest ts-jest

# Initialize Jest config
npx ts-jest config:init
```

---

### Step 2: Configure Jest

Create `jest.config.js`:

```javascript
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/services'],
  testMatch: ['**/__tests__/**/*.ts', '**/?(*.)+(spec|test).ts'],
  transform: {
    '^.+\\.ts$': 'ts-jest',
  },
  collectCoverageFrom: [
    'services/**/*.ts',
    '!services/**/*.d.ts',
    '!services/**/*.spec.ts',
    '!services/**/index.ts',
  ],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },
};
```

---

### Step 3: Create Sample Test

Create `services/scoring-service/tests/scoring.test.ts`:

```typescript
import { describe, expect, test } from '@jest/globals';

describe('Credit Scoring', () => {
  test('weights should sum to 100%', () => {
    const weights = {
      affordability: 0.30,
      repayment_willingness: 0.25,
      mobile_money: 0.20,
      external_credit: 0.15,
      kyc_verification: 0.10
    };

    const total = Object.values(weights).reduce((a, b) => a + b, 0);
    expect(total).toBe(1.0);
  });

  test('points should sum to 1000', () => {
    const points = {
      affordability: 300,
      repayment_willingness: 250,
      mobile_money: 200,
      external_credit: 150,
      kyc_verification: 100
    };

    const total = Object.values(points).reduce((a, b) => a + b, 0);
    expect(total).toBe(1000);
  });
});
```

---

### Step 4: Run Tests

```bash
# Run all tests
pnpm test

# Run with coverage
pnpm test --coverage

# Run in watch mode
pnpm test --watch
```

---

## Troubleshooting

### Common Issues

#### 1. Supabase Connection Failed

**Error**: `Failed to connect to Supabase`

**Solution**:
```bash
# Check credentials
echo $SUPABASE_URL
echo $SUPABASE_ANON_KEY

# Re-login
supabase login

# Re-link project
supabase link --project-ref xxxxxxxxxxxxx
```

---

#### 2. WhatsApp Webhook Verification Failed

**Error**: `Webhook verification failed`

**Solution**:
- Ensure `WHATSAPP_WEBHOOK_VERIFY_TOKEN` matches the token in Meta Dashboard
- Check ngrok is running and HTTPS URL is correct
- Verify webhook endpoint returns correct challenge response

---

#### 3. AWS SAM Build Failed

**Error**: `sam build failed`

**Solution**:
```bash
# Check Node.js version
node --version  # Must be 18+

# Clean and rebuild
sam build --use-container

# Check SAM version
sam --version  # Update if < 1.100
```

---

#### 4. Database Migration Failed

**Error**: `Migration failed: relation already exists`

**Solution**:
```bash
# Reset database (CAUTION: deletes all data)
supabase db reset

# Re-run migration
supabase db push
```

---

#### 5. pnpm Install Failed

**Error**: `ENOENT: no such file or directory`

**Solution**:
```bash
# Clear pnpm cache
pnpm store prune

# Delete node_modules and lock file
rm -rf node_modules pnpm-lock.yaml

# Reinstall
pnpm install
```

---

### Getting Help

**Documentation**:
- Supabase: https://supabase.com/docs
- WhatsApp Cloud API: https://developers.facebook.com/docs/whatsapp/cloud-api
- AWS SAM: https://docs.aws.amazon.com/serverless-application-model/

**Community**:
- Supabase Discord: https://discord.supabase.com
- WhatsApp Developers: https://developers.facebook.com/community/

**Internal**:
- Check `planning/*.md` files for specifications
- Review `PHASE-2-KICKOFF-PLAN.md` for task details

---

## ✅ Setup Verification Checklist

Run through this checklist to verify setup is complete:

### Tools Installed
- [ ] Node.js 18+ (`node --version`)
- [ ] pnpm (`pnpm --version`)
- [ ] Git (`git --version`)
- [ ] TypeScript (`tsc --version`)
- [ ] Supabase CLI (`supabase --version`)
- [ ] AWS SAM CLI (`sam --version`)
- [ ] Docker (optional) (`docker --version`)

### Accounts Created
- [ ] Supabase account
- [ ] Meta Developer account
- [ ] AWS account
- [ ] DIDIT sandbox requested
- [ ] Mobile Money sandbox requested

### Credentials Obtained
- [ ] Supabase URL and keys
- [ ] WhatsApp Phone Number ID and Access Token
- [ ] AWS Access Key and Secret
- [ ] DIDIT Partner ID (pending)
- [ ] EcoCash/OneMoney credentials (pending)

### Project Setup
- [ ] Folder structure created
- [ ] `.env` file configured
- [ ] `.env.example` created
- [ ] Dependencies installed
- [ ] TypeScript configured
- [ ] ESLint & Prettier configured

### Connections Tested
- [ ] Supabase connection working
- [ ] WhatsApp webhook verified
- [ ] AWS credentials configured
- [ ] Sample test passes

### Database
- [ ] Database schema reviewed
- [ ] Migration file ready (see next document)
- [ ] RLS policies planned

---

## Next Steps

Once setup is complete:

1. **Deploy Database Schema** → See `DATABASE-MIGRATION.md` (next document)
2. **Start P2-T004: Credit Scoring Service** → Highest priority
3. **Implement WhatsApp Bot** → P2-T006
4. **Integrate KYC** → P2-T007

---

**Setup Status**: 🎯 **FOLLOW THIS GUIDE STEP-BY-STEP**

**Estimated Time**: 2-3 hours (excluding API approval wait times)

**Questions?** Review `PHASE-2-KICKOFF-PLAN.md` for detailed task specifications.

---

**Happy Coding! 🚀**
