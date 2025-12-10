/**
 * Automated Database Deployment
 * Uses Supabase JS client to deploy schema
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Missing credentials');
  process.exit(1);
}

// Create Supabase client with service role
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function deployDatabase() {
  console.log('🚀 Automated Database Deployment Starting...\n');

  // Read SQL file
  const sqlPath = path.join(__dirname, 'COMBINED-DEPLOYMENT.sql');
  console.log(`📄 Reading: ${sqlPath}`);

  const sql = fs.readFileSync(sqlPath, 'utf8');
  console.log(`✅ SQL loaded: ${(sql.length / 1024).toFixed(1)} KB\n`);

  console.log('🔄 Executing SQL...');
  console.log('⏱️  This will take 30-60 seconds...\n');

  try {
    // Execute via Supabase SQL RPC
    const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql });

    if (error) {
      throw error;
    }

    console.log('✅ DATABASE DEPLOYMENT COMPLETE!');
    console.log('\n📊 Deployment Summary:');
    console.log('   • 19 core tables created');
    console.log('   • 1 distributor commissions table');
    console.log('   • Trustonic device fields added');
    console.log('   • Row Level Security enabled');
    console.log('   • Test data loaded');
    console.log('\n✅ Next: Verify tables in Supabase Table Editor');

  } catch (error) {
    console.error('\n❌ Deployment failed:', error.message);

    if (error.message.includes('exec_sql')) {
      console.log('\n⚠️  Direct SQL execution not available via API');
      console.log('\n📋 MANUAL DEPLOYMENT REQUIRED:');
      console.log('');
      console.log('1. Open: https://supabase.com/dashboard/project/ghdrnxlsupbzoddtyxcp/sql');
      console.log('2. The SQL file is already open in your editor');
      console.log('3. Copy ALL the text (Ctrl+A, Ctrl+C)');
      console.log('4. Paste into Supabase SQL Editor');
      console.log('5. Click "Run" or press Ctrl+Enter');
      console.log('6. Wait 30-40 seconds');
      console.log('');
      console.log('Expected result:');
      console.log('  ═══════════════════════════════════════════════');
      console.log('  ✅ DATABASE DEPLOYMENT COMPLETE!');
      console.log('  ═══════════════════════════════════════════════');
    } else {
      console.log('\nError details:', error);
    }

    process.exit(1);
  }
}

deployDatabase();
