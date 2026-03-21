/**
 * Lambda handler for auto-default scheduler.
 * Triggered daily by EventBridge cron at 5am UTC (7am CAT).
 */

import { processAutoDefaults } from '../auto-default-scheduler';
import logger from '../../../shared/utils/logger';

export const handler = async (event: Record<string, unknown>): Promise<{
  statusCode: number;
  body: string;
}> => {
  const requestId = (event.requestContext as Record<string, unknown>)?.requestId as string
    || crypto.randomUUID();

  logger.info('Auto-default handler invoked', {
    action: 'auto-default.handler.start',
    requestId,
    source: (event.source as string) || 'manual',
  });

  try {
    const result = await processAutoDefaults();

    logger.info('Auto-default handler completed', {
      action: 'auto-default.handler.complete',
      requestId,
      ...result,
    });

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        message: `Auto-default completed: ${result.defaulted} loans defaulted out of ${result.processed} processed`,
        ...result,
      }),
    };
  } catch (error) {
    logger.error('Auto-default handler failed', {
      action: 'auto-default.handler.error',
      requestId,
      errorMessage: error instanceof Error ? error.message : String(error),
    });

    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        error: 'Auto-default processing failed',
        requestId,
      }),
    };
  }
};
