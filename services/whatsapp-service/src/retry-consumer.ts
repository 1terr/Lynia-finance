import { SQSEvent, SQSHandler } from 'aws-lambda';
import axios from 'axios';
import { logger, setRequestContext } from '../../shared/utils/logger';

const WHATSAPP_API_URL = 'https://graph.facebook.com/v18.0';
const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID!;
const ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN!;

/** Maximum number of retries before letting SQS route to DLQ */
const MAX_RETRY_COUNT = 3;

/** Shape of the SQS message body for WhatsApp retry messages */
interface RetryMessageBody {
  phoneNumber: string;
  messageContent: string;
  messageType: string;
  retryCount: number;
  originalError: string;
}

/**
 * SQS Consumer Lambda for retrying failed WhatsApp messages.
 *
 * Messages land in the ${Environment}-lynia-whatsapp-message-retry queue
 * when the primary WhatsApp service cannot deliver (circuit open, rate
 * limited, transient API failure). This handler picks them up in batches
 * and attempts re-delivery via the WhatsApp Cloud API.
 *
 * If retryCount >= MAX_RETRY_COUNT the message is skipped so SQS
 * visibility-timeout expiry routes it to the dead-letter queue.
 */
export const handler: SQSHandler = async (event: SQSEvent): Promise<void> => {
  setRequestContext();

  logger.info('WhatsApp retry consumer invoked', {
    action: 'retry.invoke',
    meta: { recordCount: event.Records.length },
  });

  for (const record of event.Records) {
    let body: RetryMessageBody;

    try {
      body = JSON.parse(record.body) as RetryMessageBody;
    } catch (parseError) {
      logger.error('Failed to parse SQS message body', {
        action: 'retry.parse',
        meta: {
          messageId: record.messageId,
          error: parseError instanceof Error ? parseError.message : 'Unknown',
        },
      });
      // Do not throw - malformed messages should not block the batch.
      // They will eventually land in the DLQ after maxReceiveCount.
      continue;
    }

    const { phoneNumber, messageContent, messageType, retryCount, originalError } = body;

    // If the message has already been retried too many times, skip it
    // and let SQS route to the DLQ after visibility timeout.
    if (retryCount >= MAX_RETRY_COUNT) {
      logger.warn('Max retry count reached, skipping message for DLQ routing', {
        action: 'retry.max_reached',
        meta: {
          retryCount,
          messageType,
          originalError,
          messageId: record.messageId,
        },
      });
      continue;
    }

    try {
      const payload = {
        messaging_product: 'whatsapp',
        to: phoneNumber,
        type: 'text',
        text: { body: messageContent },
      };

      const response = await axios.post(
        `${WHATSAPP_API_URL}/${PHONE_NUMBER_ID}/messages`,
        payload,
        {
          headers: {
            'Authorization': `Bearer ${ACCESS_TOKEN}`,
            'Content-Type': 'application/json',
          },
        }
      );

      const waMessageId = response.data?.messages?.[0]?.id;

      logger.info('Retry message sent successfully', {
        action: 'retry.send',
        status: 'completed',
        meta: {
          waMessageId,
          retryCount,
          messageType,
          messageId: record.messageId,
        },
      });
    } catch (error) {
      logger.error('Retry message send failed', {
        action: 'retry.send',
        status: 'failed',
        meta: {
          retryCount,
          messageType,
          originalError,
          error: error instanceof Error ? error.message : 'Unknown',
          messageId: record.messageId,
        },
      });

      // Re-throw so SQS marks this message as failed and retries automatically
      throw error;
    }
  }
};
