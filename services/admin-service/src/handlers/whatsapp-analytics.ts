/**
 * WhatsApp Funnel Analytics Handler
 *
 * Provides onboarding funnel metrics: completion rates, drop-off points,
 * average time per state, and top abandonment states.
 */

import { RouteHandler } from '../../../shared/utils/lambda-router';
import { query } from '../../../shared/clients/database';
import { successResponse, errorResponse } from '../../../shared/utils/response';
import { isAdminOrManager } from '../../../shared/middleware/authorization';
import logger from '../../../shared/utils/logger';

/** Ordered onboarding funnel states (happy path) */
const FUNNEL_STATES = [
  'welcome',
  'phone_validation',
  'personal_info_name',
  'personal_info_dob',
  'personal_info_gender',
  'personal_info_location',
  'employment_type',
  'employment_income',
  'employment_debts',
  'employment_household',
  'product_selection',
  'org_verification',
  'digital_product_selection',
  'kyc_id_upload',
  'kyc_selfie_upload',
  'kyc_processing',
  'credit_scoring',
  'device_selection',
  'amount_selection',
  'term_selection',
  'loan_summary',
  'loan_offer',
  'disbursement_method_selection',
  'terms_acceptance',
  'completed',
] as const;

interface FunnelStep {
  state: string;
  count: number;
  drop_off_rate: number;
  avg_time_seconds: number | null;
}

// ─── GET /admin/analytics/whatsapp-funnel ───

export const handleGetWhatsAppFunnel: RouteHandler = async (event, _params, auth) => {
  if (!isAdminOrManager(auth)) {
    return errorResponse('Forbidden', 403, {}, event);
  }

  try {
    const qs = event.queryStringParameters || {};
    const startDate = qs.start_date || null;
    const endDate = qs.end_date || null;
    const productCategory = qs.product_category || null;

    // Build date and product filters
    const conditions: string[] = [];
    const params: unknown[] = [];
    let idx = 1;

    if (startDate) {
      conditions.push(`ws.created_at >= $${idx++}`);
      params.push(startDate);
    }
    if (endDate) {
      conditions.push(`ws.created_at <= $${idx++}`);
      params.push(endDate);
    }
    if (productCategory) {
      conditions.push(`ws.state_data->>'selected_product' = $${idx++}`);
      params.push(productCategory);
    }

    const whereClause = conditions.length > 0
      ? 'WHERE ' + conditions.join(' AND ')
      : '';

    // Get summary counts
    const summaryResult = await query<{
      total_sessions: string;
      completed: string;
      abandoned: string;
      active: string;
      avg_duration_seconds: string | null;
    }>(`
      SELECT
        COUNT(*) AS total_sessions,
        COUNT(*) FILTER (WHERE ws.completed_at IS NOT NULL) AS completed,
        COUNT(*) FILTER (WHERE ws.abandoned_at IS NOT NULL) AS abandoned,
        COUNT(*) FILTER (WHERE ws.completed_at IS NULL AND ws.abandoned_at IS NULL) AS active,
        AVG(EXTRACT(EPOCH FROM (COALESCE(ws.completed_at, ws.abandoned_at, ws.last_activity_at) - ws.created_at)))
          FILTER (WHERE ws.completed_at IS NOT NULL OR ws.abandoned_at IS NOT NULL) AS avg_duration_seconds
      FROM whatsapp_sessions ws
      ${whereClause}
    `, params);

    const summary = summaryResult.data[0];
    const totalSessions = parseInt(summary?.total_sessions || '0');
    const completedCount = parseInt(summary?.completed || '0');
    const abandonedCount = parseInt(summary?.abandoned || '0');
    const activeCount = parseInt(summary?.active || '0');
    const completionRate = totalSessions > 0
      ? (completedCount / totalSessions) * 100
      : 0;

    // Get per-state counts from state_transitions JSONB
    // For sessions with state_transitions, count how many sessions reached each state
    const funnelResult = await query<{
      state: string;
      reach_count: string;
      avg_time_in_state: string | null;
    }>(`
      WITH transitions AS (
        SELECT
          ws.id,
          jsonb_array_elements(COALESCE(ws.state_transitions, '[]'::jsonb)) AS t
        FROM whatsapp_sessions ws
        ${whereClause}
      ),
      state_visits AS (
        SELECT
          t->>'state' AS state,
          COUNT(DISTINCT id) AS reach_count,
          AVG(
            CASE WHEN (t->>'entered_at') IS NOT NULL
              THEN EXTRACT(EPOCH FROM (
                COALESCE(
                  LEAD(( t->>'entered_at')::timestamptz) OVER (PARTITION BY id ORDER BY (t->>'entered_at')::timestamptz),
                  NOW()
                ) - (t->>'entered_at')::timestamptz
              ))
            END
          ) AS avg_time_in_state
        FROM transitions
        GROUP BY t->>'state'
      )
      SELECT state, reach_count::text, avg_time_in_state::text
      FROM state_visits
      ORDER BY reach_count DESC
    `, params);

    // Also get fallback counts from current_state for sessions without state_transitions
    const fallbackResult = await query<{
      current_state: string;
      state_count: string;
    }>(`
      SELECT
        ws.current_state,
        COUNT(*) AS state_count
      FROM whatsapp_sessions ws
      ${whereClause}
      ${conditions.length > 0 ? 'AND' : 'WHERE'} (ws.state_transitions IS NULL OR ws.state_transitions = '[]'::jsonb)
      GROUP BY ws.current_state
    `, params);

    // Merge: build state reach counts
    const stateReachMap = new Map<string, { count: number; avgTime: number | null }>();

    // From state_transitions analysis
    for (const row of funnelResult.data) {
      stateReachMap.set(row.state, {
        count: parseInt(row.reach_count || '0'),
        avgTime: row.avg_time_in_state ? parseFloat(row.avg_time_in_state) : null,
      });
    }

    // Add fallback current_state counts (sessions without transitions tracked)
    // For these sessions, assume they reached their current state and all prior states
    for (const row of fallbackResult.data) {
      const stateIndex = FUNNEL_STATES.indexOf(row.current_state as typeof FUNNEL_STATES[number]);
      const fallbackCount = parseInt(row.state_count || '0');

      if (stateIndex >= 0) {
        for (let i = 0; i <= stateIndex; i++) {
          const state = FUNNEL_STATES[i];
          const existing = stateReachMap.get(state) || { count: 0, avgTime: null };
          stateReachMap.set(state, { count: existing.count + fallbackCount, avgTime: existing.avgTime });
        }
      }
    }

    // Build ordered funnel with drop-off rates
    const funnel: FunnelStep[] = [];
    let prevCount = totalSessions;

    for (const state of FUNNEL_STATES) {
      const data = stateReachMap.get(state);
      const count = data?.count || 0;
      const dropOffRate = prevCount > 0
        ? ((prevCount - count) / prevCount) * 100
        : 0;

      funnel.push({
        state,
        count,
        drop_off_rate: Math.round(dropOffRate * 100) / 100,
        avg_time_seconds: data?.avgTime ? Math.round(data.avgTime) : null,
      });

      if (count > 0) {
        prevCount = count;
      }
    }

    // Top drop-off states (highest drop-off rate, excluding terminal states)
    const topDropOffs = funnel
      .filter(s => s.state !== 'completed' && s.state !== 'welcome' && s.count > 0)
      .sort((a, b) => b.drop_off_rate - a.drop_off_rate)
      .slice(0, 5)
      .map(s => ({ state: s.state, drop_off_rate: s.drop_off_rate, count: s.count }));

    return successResponse({
      total_sessions: totalSessions,
      completed: completedCount,
      abandoned: abandonedCount,
      active: activeCount,
      completion_rate: Math.round(completionRate * 100) / 100,
      avg_duration_seconds: summary?.avg_duration_seconds
        ? Math.round(parseFloat(summary.avg_duration_seconds))
        : null,
      funnel,
      top_drop_off_states: topDropOffs,
    }, 200, event);
  } catch (error) {
    logger.error('Failed to fetch WhatsApp funnel analytics', {
      action: 'analytics.whatsapp_funnel',
      status: 'failed',
      errorMessage: error instanceof Error ? error.message : String(error),
    });
    return errorResponse('An unexpected error occurred', 500, {}, event);
  }
};
