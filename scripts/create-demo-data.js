#!/usr/bin/env node
/**
 * Create Demo Test Data for Lynia Finance
 *
 * This script creates test data for all 4 demo scenarios:
 * 1. Successful Onboarding (Zimbabwe customer)
 * 2. Non-Zimbabwe Rejection (Kenya customer)
 * 3. Manual Review (borderline credit score)
 * 4. Payment & Lock (missed payment scenario)
 *
 * Usage:
 *   node scripts/create-demo-data.js
 *   node scripts/create-demo-data.js --scenario 1
 *   node scripts/create-demo-data.js --reset
 */

const { createClient } = require('@supabase/supabase-js');

// Configuration
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://ghdrnxlsupbzoddtyxcp.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Error: SUPABASE_SERVICE_ROLE_KEY environment variable not set');
  console.log('\nSet it with:');
  console.log('  export SUPABASE_SERVICE_ROLE_KEY=your-key-here');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Demo data templates
const DEMO_DATA = {
  // Scenario 1: Successful Onboarding (Zimbabwe)
  scenario1: {
    name: 'Successful Onboarding',
    customer: {
      phone_number: '+263771234567',
      whatsapp_id: 'wa_demo_success_001',
      first_name: 'Tatenda',
      last_name: 'Moyo',
      national_id: '63-123456-A-12',
      date_of_birth: '1995-06-15',
      address: '123 Samora Machel Ave, Harare',
      kyc_status: 'verified',
      credit_tier: 'tier_2',
      credit_limit: 350,
      onboarding_step: 'completed',
      onboarding_completed_at: new Date().toISOString()
    },
    loan: {
      amount: 300,
      device_type: 'smartphone',
      device_model: 'Samsung Galaxy A14',
      device_value: 300,
      term_months: 8,
      interest_rate: 30,
      monthly_payment: 43.88,
      total_repayment: 351.00,
      status: 'active',
      disbursed_at: new Date().toISOString()
    },
    payments: [
      {
        amount: 43.88,
        payment_method: 'ecocash',
        status: 'completed',
        paid_at: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString() // 30 days ago
      }
    ]
  },

  // Scenario 2: Non-Zimbabwe Rejection (Kenya)
  scenario2: {
    name: 'Non-Zimbabwe Rejection',
    customer: {
      phone_number: '+254712345678',
      whatsapp_id: 'wa_demo_kenya_001',
      first_name: 'James',
      last_name: 'Kamau',
      onboarding_step: 'rejected',
      rejection_reason: 'non_zimbabwe_phone',
      rejection_date: new Date().toISOString()
    },
    waitlist: {
      phone_number: '+254712345678',
      country: 'Kenya',
      interest_reason: 'device_financing',
      added_at: new Date().toISOString()
    }
  },

  // Scenario 3: Manual Review (Borderline Score)
  scenario3: {
    name: 'Manual Review',
    customer: {
      phone_number: '+263778765432',
      whatsapp_id: 'wa_demo_review_001',
      first_name: 'Rumbidzai',
      last_name: 'Ndlovu',
      national_id: '63-987654-B-21',
      date_of_birth: '1988-03-22',
      address: '456 Robert Mugabe Rd, Bulawayo',
      kyc_status: 'verified',
      credit_score: 640,
      credit_tier: 'under_review',
      onboarding_step: 'manual_review',
      review_requested_at: new Date().toISOString()
    },
    review: {
      review_type: 'credit_assessment',
      status: 'pending',
      notes: 'Borderline credit score (640). Customer has verifiable income from informal trading. Consider approval with reduced limit.',
      created_at: new Date().toISOString()
    }
  },

  // Scenario 4: Payment & Lock (Missed Payment)
  scenario4: {
    name: 'Payment & Lock',
    customer: {
      phone_number: '+263773456789',
      whatsapp_id: 'wa_demo_lock_001',
      first_name: 'Blessing',
      last_name: 'Chikomba',
      national_id: '63-456789-C-34',
      date_of_birth: '1992-09-10',
      address: '789 Kwame Nkrumah Ave, Gweru',
      kyc_status: 'verified',
      credit_tier: 'tier_1',
      credit_limit: 250,
      onboarding_step: 'completed',
      onboarding_completed_at: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString() // 60 days ago
    },
    loan: {
      amount: 200,
      device_type: 'smartphone',
      device_model: 'Samsung Galaxy A04',
      device_value: 200,
      term_months: 6,
      interest_rate: 30,
      monthly_payment: 36.67,
      total_repayment: 220.00,
      status: 'active',
      disbursed_at: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(),
      days_overdue: 7,
      next_payment_date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString() // 7 days overdue
    },
    device_lock: {
      device_id: 'DEVICE_DEMO_LOCK_001',
      imei: '352000112345678',
      lock_status: 'locked',
      locked_at: new Date().toISOString(),
      lock_reason: 'missed_payment',
      days_overdue_at_lock: 7
    },
    reminders: [
      {
        type: 'payment_reminder',
        sent_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(), // 3 days ago
        status: 'sent',
        channel: 'whatsapp'
      },
      {
        type: 'final_warning',
        sent_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(), // 1 day ago
        status: 'sent',
        channel: 'whatsapp'
      }
    ]
  }
};

/**
 * Reset demo data (delete all test data)
 */
async function resetDemoData() {
  console.log('🗑️  Resetting demo data...\n');

  try {
    // Delete in reverse order of dependencies
    await supabase.from('reminders').delete().like('whatsapp_id', 'wa_demo_%');
    await supabase.from('device_locks').delete().like('device_id', 'DEVICE_DEMO_%');
    await supabase.from('payments').delete().like('reference', 'DEMO_%');
    await supabase.from('loans').delete().like('account_number', 'DEMO_%');
    await supabase.from('manual_reviews').delete().like('customer_phone', '+263%');
    await supabase.from('international_waitlist').delete().like('phone_number', '+254%');
    await supabase.from('customers').delete().like('whatsapp_id', 'wa_demo_%');

    console.log('✅ Demo data reset complete\n');
  } catch (error) {
    console.error('❌ Error resetting demo data:', error.message);
    throw error;
  }
}

/**
 * Create scenario 1: Successful Onboarding
 */
async function createScenario1() {
  console.log('📝 Creating Scenario 1: Successful Onboarding\n');

  const { scenario1 } = DEMO_DATA;

  try {
    // Create customer
    const { data: customer, error: customerError } = await supabase
      .from('customers')
      .insert(scenario1.customer)
      .select()
      .single();

    if (customerError) throw customerError;
    console.log(`✅ Created customer: ${customer.first_name} ${customer.last_name} (${customer.phone_number})`);

    // Create loan
    const loanData = {
      ...scenario1.loan,
      customer_id: customer.id,
      account_number: `DEMO_LOAN_${Date.now()}`
    };

    const { data: loan, error: loanError } = await supabase
      .from('loans')
      .insert(loanData)
      .select()
      .single();

    if (loanError) throw loanError;
    console.log(`✅ Created loan: $${loan.amount} for ${loan.device_model}`);

    // Create payment
    const paymentData = {
      ...scenario1.payments[0],
      loan_id: loan.id,
      customer_id: customer.id,
      reference: `DEMO_PAY_${Date.now()}`
    };

    const { error: paymentError } = await supabase
      .from('payments')
      .insert(paymentData);

    if (paymentError) throw paymentError;
    console.log(`✅ Created payment: $${paymentData.amount} via ${paymentData.payment_method}\n`);

    return { customer, loan };
  } catch (error) {
    console.error('❌ Error creating Scenario 1:', error.message);
    throw error;
  }
}

/**
 * Create scenario 2: Non-Zimbabwe Rejection
 */
async function createScenario2() {
  console.log('📝 Creating Scenario 2: Non-Zimbabwe Rejection\n');

  const { scenario2 } = DEMO_DATA;

  try {
    // Create rejected customer
    const { data: customer, error: customerError } = await supabase
      .from('customers')
      .insert(scenario2.customer)
      .select()
      .single();

    if (customerError) throw customerError;
    console.log(`✅ Created rejected customer: ${customer.first_name} ${customer.last_name} (${customer.phone_number})`);

    // Add to international waitlist
    const { error: waitlistError } = await supabase
      .from('international_waitlist')
      .insert(scenario2.waitlist);

    if (waitlistError) throw waitlistError;
    console.log(`✅ Added to international waitlist: ${scenario2.waitlist.country}\n`);

    return { customer };
  } catch (error) {
    console.error('❌ Error creating Scenario 2:', error.message);
    throw error;
  }
}

/**
 * Create scenario 3: Manual Review
 */
async function createScenario3() {
  console.log('📝 Creating Scenario 3: Manual Review\n');

  const { scenario3 } = DEMO_DATA;

  try {
    // Create customer under review
    const { data: customer, error: customerError } = await supabase
      .from('customers')
      .insert(scenario3.customer)
      .select()
      .single();

    if (customerError) throw customerError;
    console.log(`✅ Created customer under review: ${customer.first_name} ${customer.last_name} (Score: ${customer.credit_score})`);

    // Create manual review entry
    const reviewData = {
      ...scenario3.review,
      customer_id: customer.id,
      customer_phone: customer.phone_number
    };

    const { error: reviewError } = await supabase
      .from('manual_reviews')
      .insert(reviewData);

    if (reviewError) throw reviewError;
    console.log(`✅ Created manual review: ${reviewData.review_type}\n`);

    return { customer };
  } catch (error) {
    console.error('❌ Error creating Scenario 3:', error.message);
    throw error;
  }
}

/**
 * Create scenario 4: Payment & Lock
 */
async function createScenario4() {
  console.log('📝 Creating Scenario 4: Payment & Lock\n');

  const { scenario4 } = DEMO_DATA;

  try {
    // Create customer
    const { data: customer, error: customerError } = await supabase
      .from('customers')
      .insert(scenario4.customer)
      .select()
      .single();

    if (customerError) throw customerError;
    console.log(`✅ Created customer: ${customer.first_name} ${customer.last_name} (${customer.phone_number})`);

    // Create overdue loan
    const loanData = {
      ...scenario4.loan,
      customer_id: customer.id,
      account_number: `DEMO_LOAN_OVERDUE_${Date.now()}`
    };

    const { data: loan, error: loanError } = await supabase
      .from('loans')
      .insert(loanData)
      .select()
      .single();

    if (loanError) throw loanError;
    console.log(`✅ Created overdue loan: $${loan.amount} (${loan.days_overdue} days overdue)`);

    // Create device lock
    const lockData = {
      ...scenario4.device_lock,
      customer_id: customer.id,
      loan_id: loan.id
    };

    const { error: lockError } = await supabase
      .from('device_locks')
      .insert(lockData);

    if (lockError) throw lockError;
    console.log(`✅ Created device lock: ${lockData.lock_status} (Reason: ${lockData.lock_reason})`);

    // Create reminders
    for (const reminder of scenario4.reminders) {
      const reminderData = {
        ...reminder,
        customer_id: customer.id,
        loan_id: loan.id,
        whatsapp_id: customer.whatsapp_id
      };

      await supabase.from('reminders').insert(reminderData);
    }
    console.log(`✅ Created ${scenario4.reminders.length} reminders\n`);

    return { customer, loan };
  } catch (error) {
    console.error('❌ Error creating Scenario 4:', error.message);
    throw error;
  }
}

/**
 * Main function
 */
async function main() {
  const args = process.argv.slice(2);
  const scenario = args.find(arg => /^\d+$/.test(arg));
  const shouldReset = args.includes('--reset');

  console.log('═══════════════════════════════════════════════════════');
  console.log('  Lynia Finance - Demo Data Creator');
  console.log('═══════════════════════════════════════════════════════\n');

  try {
    // Reset if requested
    if (shouldReset) {
      await resetDemoData();
    }

    // Create specific scenario or all scenarios
    if (scenario) {
      switch (scenario) {
        case '1':
          await createScenario1();
          break;
        case '2':
          await createScenario2();
          break;
        case '3':
          await createScenario3();
          break;
        case '4':
          await createScenario4();
          break;
        default:
          console.error(`❌ Invalid scenario: ${scenario}`);
          console.log('Valid scenarios: 1, 2, 3, 4');
          process.exit(1);
      }
    } else {
      // Create all scenarios
      await createScenario1();
      await createScenario2();
      await createScenario3();
      await createScenario4();
    }

    console.log('═══════════════════════════════════════════════════════');
    console.log('✅ Demo Data Creation Complete!');
    console.log('═══════════════════════════════════════════════════════\n');

    console.log('📊 Summary:');
    console.log('  ✅ Scenario 1: Successful onboarding with active loan');
    console.log('  ✅ Scenario 2: Non-Zimbabwe rejection with waitlist');
    console.log('  ✅ Scenario 3: Customer under manual review');
    console.log('  ✅ Scenario 4: Overdue loan with locked device\n');

    console.log('🎯 Next Steps:');
    console.log('  1. Run demo script: node scripts/demo-presentation.js');
    console.log('  2. Test API endpoints: npm run test:api');
    console.log('  3. View admin dashboard: http://localhost:3000/admin\n');

  } catch (error) {
    console.error('\n❌ Demo data creation failed:', error.message);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = {
  DEMO_DATA,
  resetDemoData,
  createScenario1,
  createScenario2,
  createScenario3,
  createScenario4
};
