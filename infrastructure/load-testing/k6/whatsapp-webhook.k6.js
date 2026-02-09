/**
 * k6 Load Test: WhatsApp Webhook Service
 *
 * Tests webhook ingestion throughput - highest volume endpoint (25% weight).
 * Simulates various message types: text, button replies, media.
 *
 * Run: k6 run --env API_URL=https://staging-api.lyniafinance.co.zw whatsapp-webhook.k6.js
 */

import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { Counter, Rate, Trend } from 'k6/metrics';
import { config, publicHeaders, loadProfiles } from './config.js';

// Custom metrics
const webhookLatency = new Trend('webhook_process_duration', true);
const webhookThroughput = new Counter('webhook_messages_processed');
const webhookErrors = new Counter('webhook_errors');
const webhookSuccessRate = new Rate('webhook_success_rate');

const profile = loadProfiles[__ENV.LOAD_PROFILE || 'normal'];

export const options = {
  stages: profile.stages,
  thresholds: {
    ...profile.thresholds,
    webhook_process_duration: ['p(95)<200', 'p(99)<500'],
    webhook_success_rate: ['rate>0.995'],
  },
  tags: {
    service: 'whatsapp-service',
    test_type: __ENV.LOAD_PROFILE || 'normal',
  },
};

const phoneNumbers = Array.from({ length: 50 }, (_, i) =>
  `+26377${String(1000000 + i).padStart(7, '0')}`
);

const textMessages = [
  'Hello', 'Hi', 'I want a loan', 'Check my balance',
  'Pay', '1', '2', '3', 'Yes', 'No', 'Help',
  'Status', 'Apply', 'Ndiri kuda foni', 'Ngicela usizo',
];

const messageTypes = ['text', 'button_reply', 'interactive_reply'];

function createWebhookPayload(phoneNumber, messageType) {
  const msgId = `wamid.${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const timestamp = Math.floor(Date.now() / 1000).toString();

  const basePayload = {
    object: 'whatsapp_business_account',
    entry: [{
      id: 'waba-test-entry',
      changes: [{
        value: {
          messaging_product: 'whatsapp',
          metadata: {
            display_phone_number: '+263771000000',
            phone_number_id: 'test-phone-number-id',
          },
          contacts: [{
            profile: { name: 'Test User' },
            wa_id: phoneNumber.replace('+', ''),
          }],
          messages: [],
        },
        field: 'messages',
      }],
    }],
  };

  switch (messageType) {
    case 'button_reply':
      basePayload.entry[0].changes[0].value.messages.push({
        from: phoneNumber.replace('+', ''),
        id: msgId,
        timestamp: timestamp,
        type: 'interactive',
        interactive: {
          type: 'button_reply',
          button_reply: {
            id: `btn_${Math.floor(Math.random() * 5) + 1}`,
            title: ['Apply Now', 'Check Balance', 'Make Payment', 'Get Help', 'Exit'][Math.floor(Math.random() * 5)],
          },
        },
      });
      break;

    case 'interactive_reply':
      basePayload.entry[0].changes[0].value.messages.push({
        from: phoneNumber.replace('+', ''),
        id: msgId,
        timestamp: timestamp,
        type: 'interactive',
        interactive: {
          type: 'list_reply',
          list_reply: {
            id: `list_${Math.floor(Math.random() * 5) + 1}`,
            title: 'Selected Option',
            description: 'User selected this option',
          },
        },
      });
      break;

    default: // text
      basePayload.entry[0].changes[0].value.messages.push({
        from: phoneNumber.replace('+', ''),
        id: msgId,
        timestamp: timestamp,
        type: 'text',
        text: {
          body: textMessages[Math.floor(Math.random() * textMessages.length)],
        },
      });
  }

  return basePayload;
}

export default function () {
  const phone = phoneNumbers[Math.floor(Math.random() * phoneNumbers.length)];
  const msgType = messageTypes[Math.floor(Math.random() * messageTypes.length)];

  group('WhatsApp Webhook Processing', () => {
    const payload = JSON.stringify(createWebhookPayload(phone, msgType));

    const res = http.post(
      `${config.baseUrl}/whatsapp/webhook`,
      payload,
      { headers: publicHeaders, tags: { endpoint: 'webhook_inbound', message_type: msgType } }
    );

    webhookLatency.add(res.timings.duration);
    webhookThroughput.add(1);

    const success = check(res, {
      'webhook returns 200': (r) => r.status === 200,
      'webhook response time < 200ms': (r) => r.timings.duration < 200,
      'webhook body is valid': (r) => {
        try {
          const body = JSON.parse(r.body);
          return body !== undefined;
        } catch {
          return r.body === 'OK' || r.body === '';
        }
      },
    });

    if (!success) webhookErrors.add(1);
    webhookSuccessRate.add(success);
  });

  // 20% of iterations also verify webhook token (GET)
  if (Math.random() < 0.2) {
    group('Webhook Verification', () => {
      const verifyToken = __ENV.WEBHOOK_VERIFY_TOKEN || 'test-verify-token';
      const challenge = `challenge_${Math.random().toString(36).slice(2, 10)}`;

      const res = http.get(
        `${config.baseUrl}/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=${verifyToken}&hub.challenge=${challenge}`,
        { headers: publicHeaders, tags: { endpoint: 'webhook_verify' } }
      );

      check(res, {
        'verify returns 200 or 403': (r) => r.status === 200 || r.status === 403,
        'verify response time < 100ms': (r) => r.timings.duration < 100,
      });
    });
  }

  sleep(Math.random() * 0.5 + 0.1); // 0.1-0.6s (WhatsApp messages arrive rapidly)
}

export function handleSummary(data) {
  return {
    'reports/whatsapp-webhook-summary.json': JSON.stringify(data, null, 2),
  };
}
