#!/usr/bin/env node
/**
 * Test Supabase Connection Script
 *
 * This script tests the connection to Supabase using credentials from .env
 */

require('dotenv').config();
const https = require('https');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

console.log('\n🔍 Testing Supabase Connection...\n');

if (!SUPABASE_URL || SUPABASE_URL.includes('your-project-id')) {
  console.error('❌ Error: SUPABASE_URL not configured in .env');
  console.error('   Please update .env with your Supabase project URL\n');
  process.exit(1);
}

if (!SUPABASE_ANON_KEY || SUPABASE_ANON_KEY.includes('your-anon-key')) {
  console.error('❌ Error: SUPABASE_ANON_KEY not configured in .env');
  console.error('   Please update .env with your Supabase anon key\n');
  process.exit(1);
}

console.log(`📍 Supabase URL: ${SUPABASE_URL}`);
console.log(`🔑 API Key: ${SUPABASE_ANON_KEY.substring(0, 20)}...`);
console.log('');

// Test REST API endpoint
const url = new URL('/rest/v1/', SUPABASE_URL);

const options = {
  hostname: url.hostname,
  path: url.pathname,
  method: 'GET',
  headers: {
    'apikey': SUPABASE_ANON_KEY,
    'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
  }
};

const req = https.request(options, (res) => {
  console.log(`📊 Status Code: ${res.statusCode}`);

  if (res.statusCode === 200) {
    console.log('✅ Connection successful!');
    console.log('✅ Supabase is ready to use\n');
    process.exit(0);
  } else if (res.statusCode === 401) {
    console.error('❌ Authentication failed - Invalid API key');
    console.error('   Please check your SUPABASE_ANON_KEY in .env\n');
    process.exit(1);
  } else {
    console.error(`❌ Connection failed with status ${res.statusCode}`);
    process.exit(1);
  }
});

req.on('error', (error) => {
  console.error('❌ Connection error:', error.message);
  console.error('   Please check your SUPABASE_URL in .env\n');
  process.exit(1);
});

req.setTimeout(10000, () => {
  console.error('❌ Connection timeout');
  console.error('   Please check your internet connection and SUPABASE_URL\n');
  req.destroy();
  process.exit(1);
});

req.end();
