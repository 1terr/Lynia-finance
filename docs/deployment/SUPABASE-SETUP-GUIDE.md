# [ARCHIVED] Supabase Setup Guide

> **This guide is archived.** Lynia Finance has migrated from Supabase to native AWS services (RDS, Cognito, S3).
> See **[AWS-SETUP-GUIDE.md](./AWS-SETUP-GUIDE.md)** for the current setup instructions.
> See **[Migration Report](../SUPABASE-TO-AWS-MIGRATION-REPORT.md)** for details on what changed.

---

# Supabase Setup Guide - Quick Start (ARCHIVED)

**Duration**: 10 minutes
**Current Status**: ARCHIVED - Replaced by AWS infrastructure

---

## Step 1: Create Supabase Project (3 minutes)

### 1.1 Go to Supabase Dashboard
🔗 https://supabase.com/dashboard

### 1.2 Create New Project
1. Click **"New Project"** button (green button, top right)
2. Select your organization (or create one)
3. Fill in project details:
   - **Name**: `lynia-finance-dev`
   - **Database Password**: Click "Generate a password" and **SAVE IT IMMEDIATELY**
   - **Region**: Select `Europe West (London) - eu-west-2`
   - **Pricing Plan**: Free (sufficient for development)

### 1.3 Wait for Provisioning
- Takes 2-3 minutes ☕
- You'll see a loading screen with progress indicators
- Don't close the tab!

---

## Step 2: Get Your API Credentials (2 minutes)

Once your project is ready:

### 2.1 Navigate to API Settings
1. In the left sidebar, click **"Settings"** (gear icon)
2. Click **"API"** in the settings menu

### 2.2 Copy These 3 Values

You'll see several credentials. Copy these THREE:

#### ① Project URL
- Label: "Project URL"
- Format: `https://xxxxxxxxxxxxx.supabase.co`
- Example: `https://abcdefghijklmnop.supabase.co`

#### ② anon/public Key
- Label: "anon" or "anon public"
- Format: Long JWT token starting with `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.`
- This is your **public** API key (safe to expose in frontend)

#### ③ service_role Key (Secret!)
- Label: "service_role"
- Click "Reveal" to see it
- Format: Long JWT token starting with `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.`
- This is your **secret** key (never expose in frontend)
- ⚠️ **IMPORTANT**: This key has admin privileges - keep it secret!

---

## Step 3: Update Your .env File (2 minutes)

### 3.1 Open .env File
Located at: `c:\Users\Admin\Documents\Lynia Finance Project\Lynia Finance Dev\.env`

### 3.2 Find Supabase Section
Look for these lines:

```env
# Supabase Configuration
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_ANON_KEY=your-anon-key-here
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
```

### 3.3 Replace with Your Credentials

**Before:**
```env
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_ANON_KEY=your-anon-key-here
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
```

**After:**
```env
SUPABASE_URL=https://abcdefghijklmnop.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI...
```

### 3.4 Save the File
- Press `Ctrl+S` to save
- Close the file

---

## Step 4: Test Connection (1 minute)

### 4.1 Run Connection Test
Open terminal and run:

```bash
cd "c:\Users\Admin\Documents\Lynia Finance Project\Lynia Finance Dev"
node scripts/test-supabase-connection.js
```

### 4.2 Expected Output

**✅ Success:**
```
🔍 Testing Supabase Connection...

📍 Supabase URL: https://abcdefghijklmnop.supabase.co
🔑 API Key: eyJhbGciOiJIUzI1NiI...

📊 Status Code: 200
✅ Connection successful!
✅ Supabase is ready to use
```

**❌ Error:**
If you see an error:
- Check that you copied the credentials correctly
- Ensure there are no extra spaces or quotes
- Make sure you saved the .env file
- Verify your internet connection

---

## Step 5: Deploy Database Schema (Next Step)

Once connection test passes, we'll deploy the database schema with 19 tables.

---

## Quick Checklist

- [ ] Supabase project created and provisioned
- [ ] Project URL copied to .env
- [ ] Anon key copied to .env
- [ ] Service role key copied to .env
- [ ] .env file saved
- [ ] Connection test passed ✅

---

## Need Help?

### Common Issues

**Issue: "Invalid API key"**
- Solution: Re-copy the anon key from Supabase dashboard
- Make sure you didn't copy extra spaces

**Issue: "Connection timeout"**
- Solution: Check your internet connection
- Verify the SUPABASE_URL is correct

**Issue: "Project still provisioning"**
- Solution: Wait another minute, then refresh the dashboard
- Project creation can take 2-3 minutes

**Issue: "Can't find service_role key"**
- Solution: Click "Reveal" next to the service_role field
- It's hidden by default for security

---

## What's Next?

After successful Supabase setup, we'll:

1. ✅ **Deploy Database Schema** (P2-T002)
   - Create 19 tables
   - Set up Row Level Security
   - Create indexes
   - Deploy test data

2. ✅ **Start Building Services**
   - Credit Scoring Service (P2-T004) ⭐
   - WhatsApp Bot (P2-T006) ⭐
   - KYC Integration (P2-T007)
   - And more...

---

**Ready?** Complete the steps above and let me know when your connection test passes! 🚀
