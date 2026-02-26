/**
 * POST /scoring/verify-organization
 *
 * Look up a customer's organization membership by phone number.
 * Called before /scoring/calculate to retrieve org verification data.
 */

import { RouteHandler } from '../../../shared/utils/lambda-router';
import { db } from '../../../shared/clients/database';
import { getSecurityHeaders } from '../../../shared/utils/response';
import logger from '../../../shared/utils/logger';

export const handleVerifyOrganization: RouteHandler = async (event, _params, _auth) => {
  const body = JSON.parse(event.body || '{}');

  if (!body.phone_number) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'phone_number is required' }),
      headers: getSecurityHeaders(event)
    };
  }

  try {
    const { data: member, error } = await db
      .from('organization_members')
      .select('organization_id, employment_status, employment_start_date, salary_verified, monthly_salary_usd, customer_id')
      .eq('phone_number', body.phone_number)
      .limit(1)
      .single()
      .execute();

    if (error || !member) {
      return {
        statusCode: 200,
        body: JSON.stringify({ found: false }),
        headers: getSecurityHeaders(event)
      };
    }

    // Fetch the organization details
    const { data: org } = await db
      .from('organizations')
      .select('id, org_name, org_type, scoring_trust_level')
      .eq('id', member.organization_id)
      .eq('is_active', true)
      .single()
      .execute();

    if (!org) {
      return {
        statusCode: 200,
        body: JSON.stringify({ found: false }),
        headers: getSecurityHeaders(event)
      };
    }

    // Calculate tenure in months from employment_start_date
    let tenureMonths = 0;
    if (member.employment_start_date) {
      const startDate = new Date(member.employment_start_date);
      const now = new Date();
      tenureMonths = (now.getFullYear() - startDate.getFullYear()) * 12
        + (now.getMonth() - startDate.getMonth());
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        found: true,
        organization_id: org.id,
        org_name: org.org_name,
        org_type: org.org_type,
        scoring_trust_level: org.scoring_trust_level,
        employment_status: member.employment_status || 'active',
        employment_start_date: member.employment_start_date,
        tenure_months: tenureMonths,
        salary_verified: member.salary_verified || false,
        monthly_salary_usd: member.monthly_salary_usd || 0,
      }),
      headers: getSecurityHeaders(event)
    };
  } catch (error) {
    logger.error('Organization verification failed', {
      action: 'scoring.verifyOrganization',
      status: 'failed',
      errorMessage: error instanceof Error ? error.message : String(error),
    });
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'Failed to verify organization membership',
        message: 'An unexpected error occurred. Please try again later.'
      }),
      headers: getSecurityHeaders(event)
    };
  }
};
