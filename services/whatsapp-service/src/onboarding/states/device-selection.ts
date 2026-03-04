/**
 * WhatsApp Onboarding - Device Selection State Handler
 *
 * Customer picks a smartphone from the numbered list shown after credit approval.
 * Validates choice, stores device details, transitions to term_selection.
 */

import { updateSession } from '../session';
import { getAllowedTerms } from '../../../../shared/utils/loan-calculator';
import type { OnboardingSession, MessageContext } from '../types';

/**
 * Handle DEVICE_SELECTION state
 */
export async function handleDeviceSelection(
  session: OnboardingSession,
  context: MessageContext
): Promise<string> {
  const message = context.message.trim();
  const devices = session.state_data.available_devices;

  if (!devices || devices.length === 0) {
    return 'Something went wrong. Reply *Restart* to begin again.';
  }

  const choice = parseInt(message);

  if (isNaN(choice) || choice < 1 || choice > devices.length) {
    const deviceList = devices
      .map((d, i) => `${i + 1}. ${d.brand} ${d.model_name} - $${d.retail_price_usd}`)
      .join('\n');

    return `Please reply with a number between 1 and ${devices.length}.

${deviceList}`;
  }

  const selectedDevice = devices[choice - 1];
  const tier = session.state_data.credit_tier || 'Tier 1';
  const allowedTerms = getAllowedTerms(tier);

  await updateSession(context.from, {
    current_state: 'term_selection',
    state_data: {
      ...session.state_data,
      selected_device_id: selectedDevice.id,
      selected_device_price: selectedDevice.retail_price_usd,
      selected_device_name: `${selectedDevice.brand} ${selectedDevice.model_name}`,
      allowed_terms: allowedTerms,
      available_devices: undefined,
    }
  });

  const termList = allowedTerms
    .map((months, i) => `${i + 1}. ${months} months`)
    .join('\n');

  return `You selected: *${selectedDevice.brand} ${selectedDevice.model_name}* ($${selectedDevice.retail_price_usd})

How long would you like to pay?

${termList}

Reply with the number of your choice (e.g. *1*)`;
}
