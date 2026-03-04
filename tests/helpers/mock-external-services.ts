/**
 * Mock External Services
 *
 * Provides mock implementations for external APIs used in integration tests:
 * - DIDIT (KYC)
 * - EcoCash / OneMoney (Payments)
 * - Trustonic (Device Lock)
 * - WhatsApp Cloud API (Messaging)
 */

// =====================================================
// DIDIT KYC MOCKS
// =====================================================

export const mockDiditResponses = {
  verifiedKYC: {
    provider_job_id: 'didit_job_001',
    job_id: 'job_001',
    result: {
      ResultCode: '1012',
      ResultText: 'Verified',
      confidence_value: 99.5,
      match_result: 'Verified',
      id_info: {
        full_name: 'Tendai Moyo',
        dob: '1990-05-15',
        gender: 'M',
        id_number: 'ZIM123456789',
        country: 'ZW',
      },
      face_match: {
        score: 0.97,
        status: 'matched',
      },
      liveness_check: {
        score: 0.99,
        status: 'passed',
        passed: true,
      },
      document_check: {
        authentic: true,
        tampered: false,
        expired: false,
      },
    },
    partner_params: {
      user_id: 'cust_test_001',
      job_id: 'job_001',
    },
  },

  rejectedKYC: {
    provider_job_id: 'didit_job_002',
    job_id: 'job_002',
    result: {
      ResultCode: '1014',
      ResultText: 'Face Not Matched',
      confidence_value: 35.2,
      match_result: 'Not Verified',
      id_info: {
        full_name: 'Unknown',
        dob: null,
        gender: null,
        id_number: 'ZIM999999999',
        country: 'ZW',
      },
      face_match: {
        score: 0.35,
        status: 'not_matched',
      },
      liveness_check: {
        score: 0.45,
        status: 'failed',
        passed: false,
      },
      document_check: {
        authentic: false,
        tampered: false,
        expired: false,
      },
    },
    partner_params: {
      user_id: 'cust_test_005',
      job_id: 'job_002',
    },
  },

  manualReviewKYC: {
    provider_job_id: 'didit_job_003',
    job_id: 'job_003',
    result: {
      ResultCode: '1013',
      ResultText: 'Needs Review',
      confidence_value: 72.0,
      match_result: 'Uncertain',
      id_info: {
        full_name: 'Grace Chiweshe',
        dob: '1995-03-10',
        gender: 'F',
        id_number: 'ZIM987654321',
        country: 'ZW',
      },
      face_match: {
        score: 0.72,
        status: 'uncertain',
      },
      liveness_check: {
        score: 0.85,
        status: 'passed',
        passed: true,
      },
      document_check: {
        authentic: true,
        tampered: false,
        expired: false,
      },
    },
    partner_params: {
      user_id: 'cust_test_003',
      job_id: 'job_003',
    },
  },
};

// =====================================================
// ECOCASH / ONEMONEY MOCKS
// =====================================================

export const mockPaymentProviderResponses = {
  ecocash: {
    successPayment: {
      transaction_id: 'EC_TXN_001',
      merchant_reference: 'pay_test_001',
      status: 'SUCCESS',
      amount: 70.00,
      currency: 'USD',
      phone_number: '+263771234567',
      timestamp: new Date().toISOString(),
    },
    failedPayment: {
      transaction_id: 'EC_TXN_002',
      merchant_reference: 'pay_test_002',
      status: 'FAILED',
      amount: 44.00,
      currency: 'USD',
      phone_number: '+263772345678',
      failure_reason: 'Insufficient funds',
      timestamp: new Date().toISOString(),
    },
    pendingPayment: {
      transaction_id: 'EC_TXN_003',
      merchant_reference: 'pay_test_003',
      status: 'PENDING',
      amount: 51.33,
      currency: 'USD',
      phone_number: '+263771234567',
      timestamp: new Date().toISOString(),
    },
    cancelledPayment: {
      transaction_id: 'EC_TXN_004',
      merchant_reference: 'pay_test_004',
      status: 'CANCELLED',
      amount: 51.33,
      currency: 'USD',
      phone_number: '+263771234567',
      timestamp: new Date().toISOString(),
    },
  },

  onemoney: {
    successPayment: {
      transaction_id: 'OM_TXN_001',
      merchant_reference: 'pay_test_001',
      status: 'SUCCESS',
      amount: 70.00,
      currency: 'USD',
      phone_number: '+263771234567',
      timestamp: new Date().toISOString(),
    },
    failedPayment: {
      transaction_id: 'OM_TXN_002',
      merchant_reference: 'pay_test_002',
      status: 'FAILED',
      amount: 44.00,
      currency: 'USD',
      phone_number: '+263772345678',
      failure_reason: 'Transaction timeout',
      timestamp: new Date().toISOString(),
    },
  },
};

// =====================================================
// TRUSTONIC MOCKS
// =====================================================

export const mockTrustonicResponses = {
  lockSuccess: {
    device_id: 'trustonic_dev_001',
    status: 'locked',
    lock_message: 'Device locked due to overdue payment',
    locked_at: new Date().toISOString(),
    emergency_calls_enabled: true,
  },

  unlockSuccess: {
    device_id: 'trustonic_dev_001',
    status: 'unlocked',
    unlocked_at: new Date().toISOString(),
  },

  enrollSuccess: {
    device_id: 'trustonic_dev_001',
    enrollment_status: 'enrolled',
    enrolled_at: new Date().toISOString(),
  },

  lockFailed: {
    device_id: 'trustonic_dev_002',
    status: 'error',
    error: 'Device not reachable',
    error_code: 'DEVICE_OFFLINE',
  },
};

// =====================================================
// WHATSAPP API MOCKS
// =====================================================

export const mockWhatsAppResponses = {
  messageSent: {
    messaging_product: 'whatsapp',
    contacts: [{ input: '263771234567', wa_id: '263771234567' }],
    messages: [{ id: 'wamid.test_msg_001' }],
  },

  templateSent: {
    messaging_product: 'whatsapp',
    contacts: [{ input: '263771234567', wa_id: '263771234567' }],
    messages: [{ id: 'wamid.test_template_001' }],
  },

  sendFailed: {
    error: {
      message: 'Invalid WhatsApp number',
      type: 'OAuthException',
      code: 100,
      fbtrace_id: 'trace_001',
    },
  },
};

/** Create a WhatsApp incoming message webhook event body */
export function createWhatsAppWebhookPayload(
  from: string,
  messageText: string,
  messageType: 'text' | 'interactive' | 'image' = 'text'
) {
  return {
    object: 'whatsapp_business_account',
    entry: [{
      id: '123456789',
      changes: [{
        value: {
          messaging_product: 'whatsapp',
          metadata: {
            display_phone_number: '15551234567',
            phone_number_id: 'phone_id_001',
          },
          contacts: [{
            profile: { name: 'Test User' },
            wa_id: from.replace('+', ''),
          }],
          messages: [{
            from: from.replace('+', ''),
            id: `wamid.inbound_${Date.now()}`,
            timestamp: String(Math.floor(Date.now() / 1000)),
            type: messageType,
            ...(messageType === 'text' ? { text: { body: messageText } } : {}),
            ...(messageType === 'interactive' ? {
              interactive: {
                type: 'button_reply',
                button_reply: { id: 'btn_1', title: messageText }
              }
            } : {}),
          }],
        },
        field: 'messages',
      }],
    }],
  };
}
