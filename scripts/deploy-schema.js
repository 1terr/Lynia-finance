#!/usr/bin/env node
/**
 * Deploy Database Schema to Supabase
 * Executes 001_initial_schema.sql against Supabase database
 */
require('dotenv').config();
const https = require('https');
const fs = require('fs');
const path = require('path');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

console.log('\n🚀 Deploying Database Schema to Supabase...\n');

// Validation
if (!SUPABASE_URL || SUPABASE_URL.includes('your-project-id')) {
  console.error('❌ Error: SUPABASE_URL not configured in .env');
  process.exit(1);
}

if (!SUPABASE_SERVICE_ROLE_KEY || SUPABASE_SERVICE_ROLE_KEY.includes('your-service-role-key')) {
  console.error('❌ Error: SUPABASE_SERVICE_ROLE_KEY not configured in .env');
  process.exit(1);
}

// Read SQL file
const schemaPath = path.join(__dirname, '..', 'database', 'migrations', '001_initial_schema.sql');
console.log(`📂 Reading schema file: ${schemaPath}`);

let schemaSql;
try {
  schemaSql = fs.readFileSync(schemaPath, 'utf8');
  console.log(`✅ Schema file loaded (${schemaSql.length} characters)\n`);
} catch (error) {
  console.error('❌ Error reading schema file:', error.message);
  process.exit(1);
}

// Extract project ID from URL
const projectId = SUPABASE_URL.match(/https:\/\/([^.]+)\.supabase\.co/)[1];
console.log(`📍 Project ID: ${projectId}`);
console.log(`📍 Supabase URL: ${SUPABASE_URL}\n`);

// Prepare API request
const url = new URL(`/rest/v1/rpc/exec_sql`, SUPABASE_URL);

const postData = JSON.stringify({
  query: schemaSql
});

const options = {
  hostname: url.hostname,
  path: url.pathname,
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(postData),
    'apikey': SUPABASE_SERVICE_ROLE_KEY,
    'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`
  }
};

console.log('⏳ Executing SQL migration...\n');

const req = https.request(options, (res) => {
  let data = '';

  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', () => {
    console.log(`📊 Status Code: ${res.statusCode}\n`);

    if (res.statusCode === 200 || res.statusCode === 201) {
      console.log('✅ Database schema deployed successfully!\n');
      console.log('📊 Created:');
      console.log('   - 19 tables');
      console.log('   - UUID extension');
      console.log('   - Indexes for performance');
      console.log('   - Row Level Security (RLS) on 15 tables');
      console.log('   - RLS policies');
      console.log('   - Triggers for updated_at fields');
      console.log('   - Materialized views for reporting');
      console.log('   - Default data (loan_products, system_config)\n');
      console.log('🎯 Next step: Load test data');
      console.log('   Run: node scripts/load-test-data.js\n');
      process.exit(0);
    } else if (res.statusCode === 404) {
      console.error('❌ API endpoint not found. Using alternative method...\n');
      console.log('📝 Manual Deployment Instructions:');
      console.log('   1. Go to Supabase Dashboard: https://supabase.com/dashboard');
      console.log(`   2. Select project: ${projectId}`);
      console.log('   3. Click "SQL Editor" in left sidebar');
      console.log('   4. Click "New Query"');
      console.log('   5. Copy entire contents of: database/migrations/001_initial_schema.sql');
      console.log('   6. Paste into SQL Editor');
      console.log('   7. Click "Run" button');
      console.log('   8. Wait for success message\n');
      console.log('💡 This is the recommended approach for initial schema deployment.\n');
      process.exit(1);
    } else {
      console.error(`❌ Deployment failed with status ${res.statusCode}`);
      if (data) {
        console.error('Response:', data);
      }
      console.log('\n📝 Try manual deployment instead (see instructions above)\n');
      process.exit(1);
    }
  });
});

req.on('error', (error) => {
  console.error('❌ Connection error:', error.message);
  console.log('\n📝 Manual Deployment Instructions:');
  console.log('   1. Go to Supabase Dashboard: https://supabase.com/dashboard');
  console.log(`   2. Select project: ${projectId}`);
  console.log('   3. Click "SQL Editor" in left sidebar');
  console.log('   4. Click "New Query"');
  console.log('   5. Copy entire contents of: database/migrations/001_initial_schema.sql');
  console.log('   6. Paste into SQL Editor');
  console.log('   7. Click "Run" button\n');
  process.exit(1);
});

req.setTimeout(30000, () => {
  console.error('❌ Request timeout (30s)\n');
  console.log('Schema deployment may take longer. Try manual deployment.\n');
  req.destroy();
  process.exit(1);
});

req.write(postData);
req.end();
