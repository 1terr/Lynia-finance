#!/usr/bin/env node
/**
 * API Endpoint Testing Script
 *
 * Tests all Lambda function endpoints with realistic data
 *
 * Usage:
 *   node scripts/test-api-endpoints.js
 *   node scripts/test-api-endpoints.js --service whatsapp
 *   node scripts/test-api-endpoints.js --verbose
 */

const https = require('https');
const http = require('http');

// Configuration
const API_BASE_URL = process.env.API_GATEWAY_URL || 'http://localhost:3000';
const VERBOSE = process.argv.includes('--verbose');
const SERVICE_FILTER = process.argv.find(arg => arg.startsWith('--service='))?.split('=')[1];

// Test data
const TEST_DATA = {
  whatsapp: {
    webhook_verify: {
      method: 'GET',
      path: '/whatsapp/webhook',
      query: '?hub.mode=subscribe&hub.verify_token=test_token&hub.challenge=1234567890',
      expected: { status: 200, body: '1234567890' }
    },
    incoming_message: {
      method: 'POST',
      path: '/whatsapp/webhook',
      body: {
        object: 'whatsapp_business_account',
        entry: [{
          id: '123456789',
          changes: [{
            value: {
              messaging_product: 'whatsapp',
              metadata: {
                display_phone_number: '263771234567',
                phone_number_id: 'PHONE_NUMBER_ID'
              },
              messages: [{
                from: '263771234567',
                id: 'wamid.test123',
                timestamp: Date.now(),
                text: { body: 'Hello' },
                type: 'text'
              }]
            }
          }]
        }]
      },
      expected: { status: 200 }
    }
  },

  scoring: {
    calculate_score: {
      method: 'POST',
      path: '/scoring/calculate',
      body: {
        customer_id: 'test_customer_001',
        phone_number: '+263771234567',
        national_id: '63-123456-A-12',
        date_of_birth: '1995-06-15',
        monthly_income: 500,
        employment_type: 'informal',
        references: [
          { phone: '+263772345678', relationship: 'sibling' },
          { phone: '+263773456789', relationship: 'friend' }
        ]
      },
      expected: { status: 200, fields: ['credit_score', 'credit_tier', 'credit_limit'] }
    }
  },

  kyc: {
    submit_documents: {
      method: 'POST',
      path: '/kyc/submit',
      body: {
        customer_id: 'test_customer_001',
        phone_number: '+263771234567',
        national_id: '63-123456-A-12',
        selfie_image: 'base64_encoded_image_data_here',
        id_front_image: 'base64_encoded_image_data_here',
        id_back_image: 'base64_encoded_image_data_here'
      },
      expected: { status: 200, fields: ['verification_status', 'verification_id'] }
    },
    check_status: {
      method: 'GET',
      path: '/kyc/status',
      query: '?customer_id=test_customer_001',
      expected: { status: 200, fields: ['kyc_status'] }
    }
  },

  payment: {
    initiate_payment: {
      method: 'POST',
      path: '/payment/initiate',
      body: {
        customer_id: 'test_customer_001',
        loan_id: 'test_loan_001',
        amount: 43.88,
        payment_method: 'ecocash',
        phone_number: '+263771234567'
      },
      expected: { status: 200, fields: ['transaction_id', 'status'] }
    },
    check_payment_status: {
      method: 'GET',
      path: '/payment/status',
      query: '?transaction_id=test_txn_001',
      expected: { status: 200, fields: ['payment_status'] }
    },
    webhook_callback: {
      method: 'POST',
      path: '/payment/callback',
      body: {
        transaction_id: 'test_txn_001',
        status: 'completed',
        amount: 43.88,
        phone_number: '+263771234567',
        reference: 'ECO123456789'
      },
      expected: { status: 200 }
    }
  },

  lock: {
    lock_device: {
      method: 'POST',
      path: '/lock/device',
      body: {
        customer_id: 'test_customer_001',
        loan_id: 'test_loan_001',
        device_id: 'DEVICE_TEST_001',
        imei: '352000112345678',
        reason: 'missed_payment',
        days_overdue: 7
      },
      expected: { status: 200, fields: ['lock_status', 'locked_at'] }
    },
    unlock_device: {
      method: 'POST',
      path: '/lock/unlock',
      body: {
        customer_id: 'test_customer_001',
        loan_id: 'test_loan_001',
        device_id: 'DEVICE_TEST_001',
        reason: 'payment_received'
      },
      expected: { status: 200, fields: ['lock_status', 'unlocked_at'] }
    },
    check_lock_status: {
      method: 'GET',
      path: '/lock/status',
      query: '?device_id=DEVICE_TEST_001',
      expected: { status: 200, fields: ['lock_status'] }
    }
  },

  notification: {
    send_reminder: {
      method: 'POST',
      path: '/notification/send',
      body: {
        customer_id: 'test_customer_001',
        type: 'payment_reminder',
        channel: 'whatsapp',
        phone_number: '+263771234567',
        data: {
          amount_due: 43.88,
          due_date: '2025-12-15',
          days_until_due: 3
        }
      },
      expected: { status: 200, fields: ['notification_id', 'status'] }
    },
    send_sms: {
      method: 'POST',
      path: '/notification/sms',
      body: {
        phone_number: '+263771234567',
        message: 'Your payment of $43.88 is due in 3 days. Pay via EcoCash to avoid late fees.'
      },
      expected: { status: 200 }
    }
  }
};

/**
 * Make HTTP request
 */
function makeRequest(options, body = null) {
  return new Promise((resolve, reject) => {
    const protocol = options.protocol === 'https:' ? https : http;

    const req = protocol.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          const jsonData = data ? JSON.parse(data) : {};
          resolve({
            status: res.statusCode,
            headers: res.headers,
            body: jsonData
          });
        } catch (error) {
          resolve({
            status: res.statusCode,
            headers: res.headers,
            body: data
          });
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    if (body) {
      req.write(JSON.stringify(body));
    }

    req.end();
  });
}

/**
 * Test a single endpoint
 */
async function testEndpoint(service, testName, testConfig) {
  const url = new URL(API_BASE_URL);
  const fullPath = testConfig.path + (testConfig.query || '');

  const options = {
    protocol: url.protocol,
    hostname: url.hostname,
    port: url.port || (url.protocol === 'https:' ? 443 : 80),
    path: fullPath,
    method: testConfig.method,
    headers: {
      'Content-Type': 'application/json'
    }
  };

  try {
    const response = await makeRequest(options, testConfig.body);

    // Validate response
    const isStatusCorrect = response.status === testConfig.expected.status;
    const hasRequiredFields = testConfig.expected.fields
      ? testConfig.expected.fields.every(field => field in response.body)
      : true;

    const passed = isStatusCorrect && hasRequiredFields;

    if (VERBOSE || !passed) {
      console.log(`\n${passed ? '✅' : '❌'} ${service}/${testName}`);
      console.log(`   Method: ${testConfig.method} ${fullPath}`);
      console.log(`   Status: ${response.status} (expected: ${testConfig.expected.status})`);

      if (testConfig.expected.fields) {
        console.log(`   Fields: ${hasRequiredFields ? 'All present' : 'Some missing'}`);
        if (!hasRequiredFields) {
          const missingFields = testConfig.expected.fields.filter(field => !(field in response.body));
          console.log(`   Missing: ${missingFields.join(', ')}`);
        }
      }

      if (VERBOSE) {
        console.log(`   Response: ${JSON.stringify(response.body, null, 2)}`);
      }
    } else {
      console.log(`✅ ${service}/${testName}`);
    }

    return { service, testName, passed, response };

  } catch (error) {
    console.log(`❌ ${service}/${testName}`);
    console.log(`   Error: ${error.message}`);
    return { service, testName, passed: false, error: error.message };
  }
}

/**
 * Main function
 */
async function main() {
  console.log('═══════════════════════════════════════════════════════');
  console.log('  Lynia Finance - API Endpoint Testing');
  console.log('═══════════════════════════════════════════════════════');
  console.log(`\n📡 API Base URL: ${API_BASE_URL}\n`);

  const results = {
    total: 0,
    passed: 0,
    failed: 0,
    byService: {}
  };

  // Run tests for each service
  for (const [service, tests] of Object.entries(TEST_DATA)) {
    // Skip if service filter is set and doesn't match
    if (SERVICE_FILTER && SERVICE_FILTER !== service) {
      continue;
    }

    console.log(`\n🔍 Testing ${service} service...`);
    results.byService[service] = { total: 0, passed: 0, failed: 0 };

    for (const [testName, testConfig] of Object.entries(tests)) {
      const result = await testEndpoint(service, testName, testConfig);

      results.total++;
      results.byService[service].total++;

      if (result.passed) {
        results.passed++;
        results.byService[service].passed++;
      } else {
        results.failed++;
        results.byService[service].failed++;
      }

      // Small delay between requests
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  // Print summary
  console.log('\n═══════════════════════════════════════════════════════');
  console.log('  Test Summary');
  console.log('═══════════════════════════════════════════════════════\n');

  console.log(`Total Tests: ${results.total}`);
  console.log(`✅ Passed: ${results.passed}`);
  console.log(`❌ Failed: ${results.failed}`);
  console.log(`📊 Success Rate: ${((results.passed / results.total) * 100).toFixed(1)}%\n`);

  console.log('By Service:');
  for (const [service, stats] of Object.entries(results.byService)) {
    const rate = ((stats.passed / stats.total) * 100).toFixed(1);
    console.log(`  ${service.padEnd(15)} ${stats.passed}/${stats.total} (${rate}%)`);
  }

  console.log('\n═══════════════════════════════════════════════════════\n');

  // Exit with error code if tests failed
  if (results.failed > 0) {
    console.log('❌ Some tests failed. Check the output above for details.\n');
    process.exit(1);
  } else {
    console.log('✅ All tests passed!\n');
  }
}

// Run if called directly
if (require.main === module) {
  main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

module.exports = {
  testEndpoint,
  TEST_DATA
};
