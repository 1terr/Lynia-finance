/**
 * WhatsApp Onboarding - Device Selection State Handler
 *
 * Customer picks a smartphone from the numbered list shown after credit approval.
 * Validates choice, stores device details, transitions to term_selection.
 */

import { updateSession } from '../session';
import { getAllowedTermsForProduct } from '../../../../shared/utils/loan-calculator';
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

  // "Back" — return to credit_scoring which will re-show device list
  if (message.toLowerCase() === 'back') {
    await updateSession(context.from, {
      current_state: 'credit_scoring',
      state_data: {
        ...session.state_data,
        available_devices: undefined,
      }
    });
    return 'No problem! Reply with any message to see the available devices.';
  }

  const choice = parseInt(message);

  if (isNaN(choice) || choice < 1 || choice > devices.length) {
    const brandGroups = new Map<string, Array<typeof devices[0]>>();
    for (const d of devices) {
      const group = brandGroups.get(d.brand) || [];
      group.push(d);
      brandGroups.set(d.brand, group);
    }

    let counter = 1;
    const deviceList = Array.from(brandGroups.entries())
      .map(([brand, models]) => {
        const header = `*${brand}:*`;
        const items = models.map(d =>
          `${counter++}. ${d.model_name} - $${Number(d.retail_price_usd).toFixed(2)}`
        ).join('\n');
        return `${header}\n${items}`;
      }).join('\n\n');

    return `Please reply with a number between 1 and ${devices.length}, or *Back* to go back.

${deviceList}`;
  }

  const selectedDevice = devices[choice - 1];
  const minTerm = session.state_data.matched_product_min_term ?? 6;
  const maxTerm = session.state_data.matched_product_max_term ?? 12;
  const allowedTerms = getAllowedTermsForProduct(minTerm, maxTerm);

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
