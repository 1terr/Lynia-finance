/**
 * WhatsApp Onboarding - Session Management
 *
 * Handles creation and update of onboarding sessions in the database.
 */

import { db, query } from '../../../shared/clients/database';
import { logger } from '../../../shared/utils/logger';
import type { OnboardingSession } from './types';

/**
 * Get or create onboarding session
 */
export async function getOrCreateSession(phoneNumber: string): Promise<OnboardingSession> {
  // Try to get existing active session
  const { data: existingSession } = await db
    .from('whatsapp_sessions')
    .select('*')
    .eq('phone_number', phoneNumber)
    .single()
    .execute();

  if (existingSession && existingSession.current_state !== 'completed') {
    // Check if session expired (24 hours)
    const lastActivity = new Date(existingSession.last_activity_at);
    const now = new Date();
    const diffMinutes = (now.getTime() - lastActivity.getTime()) / (1000 * 60);

    if (diffMinutes < 1440) {
      return existingSession as OnboardingSession;
    }
  }

  // Create new session
  const session: Partial<OnboardingSession> = {
    phone_number: phoneNumber,
    current_state: 'welcome',
    state_data: {
      started_at: new Date().toISOString(),
      retry_count: 0
    },
    last_activity_at: new Date(),
    created_at: new Date()
  };

  const { data: newSession, error } = await db
    .from('whatsapp_sessions')
    .insert(session)
    .select()
    .single()
    .execute();

  if (error) {
    logger.error('Failed to create session', { action: 'session.create', meta: { error: error instanceof Error ? error.message : 'Unknown' } });
    throw new Error('Failed to create onboarding session');
  }

  return newSession as OnboardingSession;
}

/**
 * Update session state
 *
 * When current_state changes, records the transition in state_transitions
 * JSONB array, increments total_messages_sent, and sets completed_at /
 * abandoned_at for terminal states.
 */
export async function updateSession(
  phoneNumber: string,
  updates: Partial<OnboardingSession>
): Promise<void> {
  const now = new Date();

  // Track state transition if current_state is changing
  if (updates.current_state) {
    const transition = JSON.stringify([{
      state: updates.current_state,
      entered_at: now.toISOString()
    }]);

    // Use raw SQL to append to JSONB array and increment message counter atomically
    const { error } = await query(
      `UPDATE whatsapp_sessions
       SET current_state = $1,
           state_data = COALESCE($2::jsonb, state_data),
           last_activity_at = $3,
           state_transitions = COALESCE(state_transitions, '[]'::jsonb) || $4::jsonb,
           total_messages_sent = COALESCE(total_messages_sent, 0) + 1,
           completed_at = CASE WHEN $1 = 'completed' THEN $3::timestamptz ELSE completed_at END,
           abandoned_at = CASE WHEN $1 = 'rejected' THEN $3::timestamptz ELSE abandoned_at END
       WHERE phone_number = $5`,
      [
        updates.current_state,
        updates.state_data ? JSON.stringify(updates.state_data) : null,
        now.toISOString(),
        transition,
        phoneNumber
      ]
    );

    if (error) {
      logger.error('Failed to update session', { action: 'session.update', meta: { error: error instanceof Error ? error.message : 'Unknown' } });
      throw new Error('Failed to update session');
    }
    return;
  }

  // Non-state-change update: use QueryBuilder for simple field updates
  const { error } = await db
    .from('whatsapp_sessions')
    .update({
      ...updates,
      last_activity_at: now
    })
    .eq('phone_number', phoneNumber)
    .execute();

  if (error) {
    logger.error('Failed to update session', { action: 'session.update', meta: { error: error instanceof Error ? error.message : 'Unknown' } });
    throw new Error('Failed to update session');
  }

  // Increment message counter separately (QueryBuilder doesn't support SQL expressions)
  await query(
    `UPDATE whatsapp_sessions SET total_messages_sent = COALESCE(total_messages_sent, 0) + 1 WHERE phone_number = $1`,
    [phoneNumber]
  );
}
