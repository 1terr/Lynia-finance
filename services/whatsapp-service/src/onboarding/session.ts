/**
 * WhatsApp Onboarding - Session Management
 *
 * Handles creation and update of onboarding sessions in the database.
 */

import { db } from '../../../shared/clients/database';
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
    // Check if session expired (30 minutes)
    const lastActivity = new Date(existingSession.last_activity_at);
    const now = new Date();
    const diffMinutes = (now.getTime() - lastActivity.getTime()) / (1000 * 60);

    if (diffMinutes < 30) {
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
 */
export async function updateSession(
  phoneNumber: string,
  updates: Partial<OnboardingSession>
): Promise<void> {
  const { error } = await db
    .from('whatsapp_sessions')
    .update({
      ...updates,
      last_activity_at: new Date()
    })
    .eq('phone_number', phoneNumber)
    .execute();

  if (error) {
    logger.error('Failed to update session', { action: 'session.update', meta: { error: error instanceof Error ? error.message : 'Unknown' } });
    throw new Error('Failed to update session');
  }
}
