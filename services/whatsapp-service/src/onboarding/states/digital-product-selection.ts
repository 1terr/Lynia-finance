/**
 * WhatsApp Onboarding - Digital Loan Product Selection State Handler
 *
 * After org verification, customers select from available digital loan products
 * linked to their verified organization(s). If only one product is available,
 * it is auto-selected and the customer proceeds directly to KYC.
 *
 * Inserted AFTER org_verification and BEFORE kyc_id_upload for digital loan customers.
 */

import { query } from '../../../../shared/clients/database';
import { logger } from '../../../../shared/utils/logger';
import { t as _t, type SupportedLanguage } from '../../i18n';
import { updateSession } from '../session';
import type { OnboardingSession, MessageContext } from '../types';

interface DigitalProduct {
  id: string;
  product_code: string;
  product_name: string;
  min_amount_usd: number;
  max_amount_usd: number;
  interest_rate_monthly: number;
  min_term_months: number;
  max_term_months: number;
  org_name: string | null;
  org_id: string | null;
}

/**
 * Handle DIGITAL_PRODUCT_SELECTION state.
 * After org verification, customers select from available loan products
 * linked to their verified organization(s).
 */
export async function handleDigitalProductSelection(
  session: OnboardingSession,
  context: MessageContext
): Promise<string> {
  const message = context.message.trim();
  const _lang: SupportedLanguage = session.state_data.preferred_language || 'en';
  const stateData = session.state_data;

  // First entry: show available products
  if (!stateData.products_shown) {
    const orgIds = stateData.verified_organization_ids ||
      (stateData.organization_id ? [stateData.organization_id] : []);

    if (orgIds.length === 0) {
      // No verified org — shouldn't reach here, but handle gracefully
      logger.warn('No verified org IDs in digital product selection', {
        action: 'digital-product-selection.no-org',
        status: 'failed',
        meta: { phone: context.from },
      });
      await updateSession(context.from, {
        current_state: 'org_verification',
      });
      return 'We need to verify your organization first. Please provide your National ID number in the format XX-XXXXXXX-X-XX.';
    }

    // Query products available for the customer's verified orgs
    const { data: products } = await query<DigitalProduct>(
      `SELECT lp.id, lp.product_code, lp.product_name, lp.min_amount_usd, lp.max_amount_usd,
              lp.interest_rate_monthly, lp.min_term_months, lp.max_term_months,
              o.org_name, o.id as org_id
       FROM loan_products lp
       JOIN product_organizations po ON po.product_id = lp.id
       JOIN organizations o ON o.id = po.organization_id
       WHERE po.organization_id = ANY($1)
         AND lp.product_category = 'digital'
         AND lp.status = 'active'
         AND (lp.deleted_at IS NULL)
       ORDER BY o.org_name, lp.display_order, lp.max_amount_usd DESC`,
      [orgIds]
    );

    // Also check for products without org restrictions (available to all org members)
    const { data: openProducts } = await query<DigitalProduct>(
      `SELECT lp.id, lp.product_code, lp.product_name, lp.min_amount_usd, lp.max_amount_usd,
              lp.interest_rate_monthly, lp.min_term_months, lp.max_term_months,
              NULL as org_name, NULL as org_id
       FROM loan_products lp
       WHERE lp.product_category = 'digital'
         AND lp.status = 'active'
         AND lp.requires_organization_verification = true
         AND NOT EXISTS (SELECT 1 FROM product_organizations po WHERE po.product_id = lp.id)
         AND (lp.deleted_at IS NULL)
       ORDER BY lp.display_order, lp.max_amount_usd DESC`,
      []
    );

    const allProducts: DigitalProduct[] = [...(products || []), ...(openProducts || [])];

    if (allProducts.length === 0) {
      await updateSession(context.from, {
        current_state: 'rejected',
        state_data: {
          ...stateData,
          rejection_reason: 'no_products_available',
        },
      });
      return 'Sorry, there are no digital loan products currently available for your organization. Please contact support for assistance.';
    }

    // Auto-select if only one product
    if (allProducts.length === 1) {
      const product = allProducts[0];
      await updateSession(context.from, {
        current_state: 'kyc_id_upload',
        state_data: {
          ...stateData,
          selected_digital_product_id: product.id,
          selected_product_code: product.product_code,
          selected_product_name: product.product_name,
          selected_organization_id: product.org_id || stateData.organization_id,
          product_min_amount: product.min_amount_usd,
          product_max_amount: product.max_amount_usd,
          product_interest_rate: product.interest_rate_monthly,
          product_min_term: product.min_term_months,
          product_max_term: product.max_term_months,
        },
      });

      const orgLabel = product.org_name ? ` (${product.org_name})` : '';
      return `Great! You've been matched with *${product.product_name}*${orgLabel}.\n\nLoan range: $${product.min_amount_usd} - $${product.max_amount_usd}\nRate: ${product.interest_rate_monthly}% per month\n\nNow let's verify your identity. Please upload a clear photo of your National ID card.`;
    }

    // Multiple products: show list grouped by org
    let productList = '📋 *Available Loan Products*\n\n';
    let currentOrg = '';

    allProducts.forEach((p, i) => {
      const orgLabel = p.org_name || 'General';
      if (orgLabel !== currentOrg) {
        productList += `*${orgLabel}:*\n`;
        currentOrg = orgLabel;
      }
      productList += `${i + 1}. ${p.product_name} — $${p.min_amount_usd}-$${p.max_amount_usd} (${p.interest_rate_monthly}%/month)\n`;
    });

    productList += '\nReply with the number of your choice.';

    // D4: Store only product IDs instead of full objects to minimize session data
    await updateSession(context.from, {
      state_data: {
        ...stateData,
        products_shown: true,
        available_product_ids: allProducts.map(p => p.id),
        available_product_count: allProducts.length,
      },
    });

    return productList;
  }

  // Customer selecting a product by number
  const choice = parseInt(message, 10);
  const productCount = stateData.available_product_count || (stateData.available_products || []).length;
  const productIds: string[] = stateData.available_product_ids || (stateData.available_products || []).map((p: DigitalProduct) => p.id);

  if (isNaN(choice) || choice < 1 || choice > productCount) {
    return `Please reply with a number between 1 and ${productCount}.`;
  }

  // Re-query the selected product by ID
  const selectedId = productIds[choice - 1];
  const { data: selectedProducts } = await query<DigitalProduct>(
    `SELECT lp.id, lp.product_code, lp.product_name, lp.min_amount_usd, lp.max_amount_usd,
            lp.interest_rate_monthly, lp.min_term_months, lp.max_term_months,
            o.org_name, o.id as org_id
     FROM loan_products lp
     LEFT JOIN product_organizations po ON po.product_id = lp.id
     LEFT JOIN organizations o ON o.id = po.organization_id
     WHERE lp.id = $1`,
    [selectedId]
  );

  const selected = selectedProducts?.[0];
  if (!selected) {
    return 'Sorry, the selected product is no longer available. Please type any message to see the updated list.';
  }

  await updateSession(context.from, {
    current_state: 'kyc_id_upload',
    state_data: {
      ...stateData,
      selected_digital_product_id: selected.id,
      selected_product_code: selected.product_code,
      selected_product_name: selected.product_name,
      selected_organization_id: selected.org_id || stateData.organization_id,
      product_min_amount: selected.min_amount_usd,
      product_max_amount: selected.max_amount_usd,
      product_interest_rate: selected.interest_rate_monthly,
      product_min_term: selected.min_term_months,
      product_max_term: selected.max_term_months,
      // Clean up temporary selection state
      products_shown: undefined,
      available_products: undefined,
      available_product_ids: undefined,
      available_product_count: undefined,
    },
  });

  return `You selected *${selected.product_name}*.\n\nLoan range: $${selected.min_amount_usd} - $${selected.max_amount_usd}\n\nNow let's verify your identity. Please upload a clear photo of your National ID card.`;
}
