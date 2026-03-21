/**
 * Organization Data Freshness Checker
 *
 * Scheduled Lambda that runs monthly to detect organizations with stale
 * member data (no import in 30+ days). Publishes SNS alerts and emits
 * CloudWatch metrics for monitoring.
 */

import { query } from '../../../shared/clients/database';
import logger from '../../../shared/utils/logger';

// AWS SDK v3 clients (tree-shaken, marked external in esbuild)
import { SNSClient, PublishCommand } from '@aws-sdk/client-sns';
import { CloudWatchClient, PutMetricDataCommand } from '@aws-sdk/client-cloudwatch';

const sns = new SNSClient({});
const cw = new CloudWatchClient({});

interface StaleOrg {
  id: string;
  org_code: string;
  org_name: string;
  last_data_import_at: string | null;
  total_members: number;
}

/**
 * Lambda handler entry point. Invoked by EventBridge cron schedule.
 */
export const handler = async (event: Record<string, unknown>): Promise<{
  statusCode: number;
  body: string;
}> => {
  const requestId = (event.requestContext as Record<string, unknown>)?.requestId as string
    || crypto.randomUUID();

  logger.info('Org data freshness check started', {
    action: 'org_data.freshness_check',
    status: 'started',
    requestId,
    source: (event.source as string) || 'manual',
  });

  try {
    // Find organizations with stale data (no import in 30+ days or never imported)
    const { data: staleOrgs, error } = await query<StaleOrg>(
      `SELECT id, org_code, org_name, last_data_import_at, total_members
       FROM organizations
       WHERE deleted_at IS NULL
         AND is_active = true
         AND (last_data_import_at IS NULL OR last_data_import_at < NOW() - INTERVAL '30 days')
       ORDER BY last_data_import_at ASC NULLS FIRST`
    );

    if (error) {
      throw error;
    }

    const staleCount = staleOrgs.length;

    // Log each stale org
    for (const org of staleOrgs) {
      logger.warn('Organization data is stale', {
        action: 'org_data.stale',
        status: 'failed',
        metadata: {
          orgId: org.id,
          orgCode: org.org_code,
          orgName: org.org_name,
          lastImportAt: org.last_data_import_at || 'never',
          totalMembers: org.total_members,
        },
      });
    }

    // Emit CloudWatch metric
    await cw.send(new PutMetricDataCommand({
      Namespace: 'Lynia/Organizations',
      MetricData: [{
        MetricName: 'StaleOrganizations',
        Value: staleCount,
        Unit: 'Count',
        Timestamp: new Date(),
        Dimensions: [{
          Name: 'Environment',
          Value: process.env.ENVIRONMENT || 'production',
        }],
      }],
    }));

    // Publish SNS alert if stale orgs found
    const snsTopicArn = process.env.ALERT_SNS_TOPIC_ARN;
    if (staleCount > 0 && snsTopicArn) {
      const orgList = staleOrgs
        .slice(0, 10)
        .map(o => `  - ${o.org_name} (${o.org_code}): last import ${o.last_data_import_at || 'never'}`)
        .join('\n');

      const message = [
        `[WARNING] ${staleCount} organization(s) have stale member data (30+ days since last import)`,
        '',
        orgList,
        staleOrgs.length > 10 ? `  ... and ${staleOrgs.length - 10} more` : '',
        '',
        'Action required: Re-import member data for these organizations to maintain accurate credit scoring.',
      ].join('\n');

      await sns.send(new PublishCommand({
        TopicArn: snsTopicArn,
        Subject: `Lynia: ${staleCount} organization(s) with stale data`,
        Message: message,
      }));

      logger.info('Stale org alert published to SNS', {
        action: 'org_data.alert_sent',
        status: 'completed',
        metadata: { staleCount, topicArn: snsTopicArn },
      });
    }

    const result = {
      staleOrganizations: staleCount,
      organizations: staleOrgs.map(o => ({
        orgCode: o.org_code,
        orgName: o.org_name,
        lastImportAt: o.last_data_import_at || null,
        totalMembers: o.total_members,
      })),
    };

    logger.info('Org data freshness check completed', {
      action: 'org_data.freshness_check',
      status: 'completed',
      requestId,
      metadata: { staleCount },
    });

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        message: `Found ${staleCount} organization(s) with stale data`,
        ...result,
      }),
    };
  } catch (error) {
    logger.error('Org data freshness check failed', {
      action: 'org_data.freshness_check',
      status: 'failed',
      requestId,
      errorMessage: error instanceof Error ? error.message : String(error),
    });

    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        error: 'Org data freshness check failed',
        requestId,
      }),
    };
  }
};
