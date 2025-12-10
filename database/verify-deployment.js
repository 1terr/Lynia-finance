/**
 * Verify Database Deployment
 * Checks that all tables and test data were created successfully
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Missing Supabase credentials in .env');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function verifyDeployment() {
  console.log('🔍 Verifying Database Deployment...\n');

  const expectedTables = [
    'customers',
    'loan_products',
    'admin_users',
    'loans',
    'devices',
    'payments',
    'device_locks',
    'distributors',
    'agents',
    'agent_inventory',
    'kyc_verifications',
    'whatsapp_messages',
    'notifications',
    'audit_logs',
    'system_config',
    'commission_tiers',
    'commission_payments',
    'payment_methods',
    'loan_fees',
    'distributor_commissions'
  ];

  let successCount = 0;
  let failCount = 0;

  // Check each table
  for (const table of expectedTables) {
    try {
      const { data, error } = await supabase
        .from(table)
        .select('*', { count: 'exact', head: true });

      if (error) {
        console.log(`❌ ${table} - NOT FOUND`);
        failCount++;
      } else {
        console.log(`✅ ${table} - exists`);
        successCount++;
      }
    } catch (err) {
      console.log(`❌ ${table} - ERROR: ${err.message}`);
      failCount++;
    }
  }

  console.log('\n' + '═'.repeat(50));
  console.log(`📊 Results: ${successCount}/${expectedTables.length} tables found`);
  console.log('═'.repeat(50));

  if (successCount === expectedTables.length) {
    console.log('\n✅ DATABASE DEPLOYMENT SUCCESSFUL!');
    console.log('\n📋 Next Steps:');
    console.log('   1. Check test data loaded correctly');
    console.log('   2. Mark P2-T002 as completed');
    console.log('   3. Move to P2-T003: AWS Lambda Setup');
    return true;
  } else {
    console.log('\n⚠️  DEPLOYMENT INCOMPLETE');
    console.log(`Missing ${failCount} tables`);
    console.log('\nPlease check for errors in the SQL execution.');
    return false;
  }
}

// Check test data
async function checkTestData() {
  console.log('\n🔍 Checking Test Data...\n');

  const checks = [
    { table: 'customers', expected: 3, description: 'test customers' },
    { table: 'loans', expected: 2, description: 'test loans' },
    { table: 'devices', expected: 3, description: 'test devices' },
    { table: 'payments', expected: 2, description: 'test payments' }
  ];

  for (const check of checks) {
    try {
      const { data, error, count } = await supabase
        .from(check.table)
        .select('*', { count: 'exact' });

      if (error) throw error;

      const status = count >= check.expected ? '✅' : '⚠️';
      console.log(`${status} ${check.table}: ${count} records (expected ${check.expected})`);
    } catch (err) {
      console.log(`❌ ${check.table}: Error checking - ${err.message}`);
    }
  }
}

// Main execution
(async () => {
  try {
    const tablesOk = await verifyDeployment();

    if (tablesOk) {
      await checkTestData();
    }
  } catch (error) {
    console.error('\n❌ Verification failed:', error.message);
    process.exit(1);
  }
})();
