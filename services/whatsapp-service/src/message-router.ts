/**
 * Message Router Module
 *
 * Routes incoming WhatsApp messages through the T011 error handling
 * layers and dispatches to the appropriate handler (onboarding,
 * loan commands, global commands, etc.).
 */

import type { WhatsAppWebhookEvent } from '../../shared/types';
import { db } from '../../shared/clients/database';
import { routeOnboardingMessage, type MessageContext } from './onboarding';
import { routeLoanCommand } from './loan-commands';
import {
  sanitizeInput,
  getSuspiciousInputResponse,
  detectRapidMessages,
  getRapidMessageResponse,
  validateMessageLength,
  checkInappropriateLanguage,
  handleUnexpectedMessageType,
  getExpectedInputType,
  detectGlobalCommand,
  detectOutOfContextCommand,
  handleGlobalCommandResponse,
  handleOutOfContextResponse,
  trackError,
  trackSecurityEvent,
} from './error-handler';
import { logger } from '../../shared/utils/logger';
import { sendTextMessage, sendInteractiveButtons, sendInteractiveList, storeMessage } from './message-sender';
import type { WhatsAppResponse } from './onboarding/types';

/**
 * Process incoming message from customer
 *
 * Applies T011 error handling layers in order:
 * 1. Rapid message detection
 * 2. Input sanitization (XSS/SQL injection)
 * 3. Message length validation
 * 4. Inappropriate language check
 * 5. Unexpected message type handling
 * 6. Global command detection (HELP, CANCEL, BACK, etc.)
 * 7. Out-of-context loan command detection
 * 8. Onboarding flow routing
 */
export async function processIncomingMessage(
  message: NonNullable<WhatsAppWebhookEvent['entry'][number]['changes'][number]['value']['messages']>[number],
  contactName?: string
): Promise<void> {
  const phoneNumber = message.from;

  try {
    // Deduplication: check if this message ID was already processed
    // Meta may deliver the same webhook multiple times (at-least-once delivery)
    const { data: existingMsg } = await db
      .from('whatsapp_messages')
      .select('id')
      .eq('whatsapp_message_id', message.id)
      .single()
      .execute();

    if (existingMsg) {
      logger.info('Duplicate webhook message, skipping', { action: 'webhook.dedup', meta: { messageId: message.id } });
      return;
    }

    let messageText = '';
    let imageUrl: string | undefined;

    // Extract message text based on type
    if (message.type === 'text' && message.text) {
      messageText = message.text.body;
    } else if (message.type === 'interactive' && message.interactive) {
      if (message.interactive.button_reply) {
        messageText = message.interactive.button_reply.title;
      } else if (message.interactive.list_reply) {
        messageText = message.interactive.list_reply.title;
      }
    } else if (message.type === 'image' && message.image) {
      messageText = '[Image received]';
      imageUrl = message.image.id;
      logger.info('Image received', { action: 'message.receive', meta: { mediaId: imageUrl } });
    }

    logger.info('Incoming message processed', { action: 'message.receive', meta: { type: message.type } });

    // Store incoming message
    await storeMessage({
      phone_number: phoneNumber,
      message_type: message.type,
      direction: 'inbound',
      content: messageText,
      whatsapp_message_id: message.id,
      status: 'delivered'
    });

    // --- T011 Error Handling Layers ---

    // 1. Rapid message detection
    if (detectRapidMessages(phoneNumber)) {
      await sendTextMessage(phoneNumber, getRapidMessageResponse());
      return;
    }

    // 2. Input sanitization (skip for non-text)
    if (messageText && messageText !== '[Image received]') {
      const { safe, sanitized } = sanitizeInput(messageText);
      if (!safe) {
        await trackSecurityEvent(phoneNumber, 'suspicious_input', {
          original_input: messageText.substring(0, 100),
        });
        await sendTextMessage(phoneNumber, getSuspiciousInputResponse());
        return;
      }
      messageText = sanitized;
    }

    // 3. Message length validation
    if (messageText.length > 0) {
      const lengthCheck = validateMessageLength(messageText);
      if (!lengthCheck.valid && lengthCheck.userMessage) {
        await sendTextMessage(phoneNumber, lengthCheck.userMessage);
        return;
      }
    }

    // 4. Inappropriate language check
    if (messageText.length > 0) {
      const inappropriateMsg = checkInappropriateLanguage(messageText);
      if (inappropriateMsg) {
        await trackError(phoneNumber, {
          category: 'security',
          severity: 'low',
          code: 'INAPPROPRIATE_LANGUAGE',
          userMessage: inappropriateMsg,
          internalMessage: 'Inappropriate language detected',
        });
        await sendTextMessage(phoneNumber, inappropriateMsg);
        return;
      }
    }

    // 5. Unexpected message type handling
    // Get current conversation state to determine expected input
    const { data: session } = await db
      .from('whatsapp_sessions')
      .select('current_state')
      .eq('phone_number', phoneNumber)
      .single()
      .execute();

    const currentState = session?.current_state || 'welcome';
    const expectedType = getExpectedInputType(currentState);
    const typeError = handleUnexpectedMessageType(message.type, expectedType, currentState);
    if (typeError) {
      await sendTextMessage(phoneNumber, typeError);
      return;
    }

    // 6. Global command detection
    if (messageText.length > 0) {
      const globalCmd = detectGlobalCommand(messageText);
      if (globalCmd) {
        const response = handleGlobalCommandResponse(globalCmd);
        if (response) {
          if (globalCmd === 'cancel') {
            // Save progress and reset state
            await db
              .from('whatsapp_sessions')
              .update({ current_state: 'welcome', last_activity_at: new Date() })
              .eq('phone_number', phoneNumber)
              .execute();
          }
          await sendTextMessage(phoneNumber, response);
          return;
        }
        // 'back' and 'continue' fall through to onboarding router
      }
    }

    // 7. For completed users, route loan commands
    if (messageText.length > 0 && currentState === 'completed') {
      const loanResponse = await routeLoanCommand(phoneNumber, messageText);
      if (loanResponse) {
        await sendTextMessage(phoneNumber, loanResponse);
        return;
      }
    }

    // 7b. Out-of-context loan command detection (for non-completed users)
    if (messageText.length > 0 && currentState !== 'completed') {
      const loanCmd = detectOutOfContextCommand(messageText);
      if (loanCmd) {
        await sendTextMessage(phoneNumber, handleOutOfContextResponse(loanCmd));
        return;
      }
    }

    // 8. Find or create customer and route to onboarding flow
    const customer = await findOrCreateCustomer(phoneNumber, contactName);

    if (!customer) {
      logger.error('Failed to find or create customer', { action: 'customer.lookup', meta: { phone: phoneNumber } });
      await sendTextMessage(
        phoneNumber,
        'We had trouble setting up your account. Please try again in a moment.\n\nReference: SYS-' + Date.now()
      );
      return;
    }

    // Store customer_id in session so downstream code can reference it
    if (customer.id) {
      await db.from('whatsapp_sessions')
        .update({ customer_id: customer.id })
        .eq('phone_number', phoneNumber)
        .execute();
    }

    const context: MessageContext = {
      from: phoneNumber,
      message: messageText,
      messageId: message.id,
      timestamp: parseInt(message.timestamp, 10)
    };

    const response = await routeOnboardingMessage(context, imageUrl);
    await dispatchWhatsAppResponse(phoneNumber, response);

  } catch (error) {
    logger.error('Error processing incoming message', { action: 'message.process', meta: { error: error instanceof Error ? error.message : 'Unknown', stack: error instanceof Error ? error.stack : undefined } });

    await trackError(phoneNumber, {
      category: 'system',
      severity: 'high',
      code: 'PROCESSING_ERROR',
      userMessage: '',
      internalMessage: error instanceof Error ? error.message : 'Unknown error',
    });

    try {
      await sendTextMessage(
        phoneNumber,
        'Something went wrong, but your progress is saved. Reply *CONTINUE* to pick up where you left off.\n\nReference: SYS-' + Date.now()
      );
    } catch (sendError) {
      logger.error('Failed to send error message', { action: 'message.send', meta: { error: sendError instanceof Error ? sendError.message : 'Unknown' } });
    }
  }
}

/**
 * Helper: Dispatch a WhatsAppResponse to the appropriate sender.
 * - string → sendTextMessage (skips empty strings)
 * - ButtonsResponse → sendInteractiveButtons
 * - ListResponse → sendInteractiveList
 */
async function dispatchWhatsAppResponse(to: string, response: WhatsAppResponse): Promise<void> {
  if (typeof response === 'string') {
    if (response.length > 0) {
      await sendTextMessage(to, response);
    }
    return;
  }

  if (response.type === 'buttons') {
    await sendInteractiveButtons(to, response.body, response.buttons);
    return;
  }

  if (response.type === 'list') {
    await sendInteractiveList(to, response.body, response.buttonText, response.sections);
  }
}

/**
 * Helper: Find or create customer
 */
async function findOrCreateCustomer(phoneNumber: string, name?: string): Promise<Record<string, unknown> | null> {
  try {
    // Try to find existing customer by whatsapp_number first
    let { data: customer } = await db
      .from('customers')
      .select('*')
      .eq('whatsapp_number', phoneNumber)
      .single()
      .execute();

    if (!customer) {
      // Also try phone_number for customers created before whatsapp_number column
      const { data: phoneCustomer } = await db
        .from('customers')
        .select('*')
        .eq('phone_number', phoneNumber)
        .single()
        .execute();
      customer = phoneCustomer;

      if (customer && !customer.whatsapp_number) {
        // Backfill whatsapp_number for existing customer
        await db.from('customers')
          .update({ whatsapp_number: phoneNumber })
          .eq('id', customer.id)
          .execute();
      }
    }

    if (!customer) {
      // Create new customer record - split name into first_name/last_name
      const nameParts = (name || 'WhatsApp User').trim().split(/\s+/);
      const firstName = nameParts[0] || 'WhatsApp';
      const lastName = nameParts.slice(1).join(' ') || 'User';

      const { data: newCustomer, error } = await db
        .from('customers')
        .insert({
          phone_number: phoneNumber,
          whatsapp_number: phoneNumber,
          first_name: firstName,
          last_name: lastName,
          kyc_status: 'pending',
          onboarding_status: 'in_progress'
        })
        .select()
        .single()
        .execute();

      if (error) {
        // INSERT failed -- likely a duplicate. Re-fetch the existing record.
        logger.warn('Customer insert failed, re-fetching existing record', { action: 'customer.create', meta: { error: error.message } });
        const { data: existingCustomer } = await db
          .from('customers')
          .select('*')
          .or(`whatsapp_number.eq.${phoneNumber},phone_number.eq.${phoneNumber}`)
          .limit(1)
          .single()
          .execute();

        if (existingCustomer) {
          customer = existingCustomer;
          // Backfill whatsapp_number if missing
          if (!existingCustomer.whatsapp_number) {
            await db.from('customers')
              .update({ whatsapp_number: phoneNumber })
              .eq('id', existingCustomer.id)
              .execute();
          }
        } else {
          // Truly failed -- no existing record found either
          logger.error('Customer insert failed and no existing record found', { action: 'customer.create', meta: { error: error.message } });
          return null;
        }
      } else {
        customer = newCustomer;
      }
      logger.info('Created new customer', { action: 'customer.create', meta: { customerId: customer?.id } });
    }

    return customer;
  } catch (error) {
    logger.error('Error finding/creating customer', { action: 'customer.lookup', meta: { error: error instanceof Error ? error.message : 'Unknown' } });
    return null;
  }
}
