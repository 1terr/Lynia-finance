/**
 * WhatsApp Onboarding - Media Helpers
 *
 * Downloads media from WhatsApp Cloud API for KYC document processing.
 */

import axios from 'axios';

const WHATSAPP_API_URL = 'https://graph.facebook.com/v18.0';
const WHATSAPP_ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN!;

/**
 * Download media from WhatsApp Cloud API and return as base64.
 * Step 1: GET media metadata to get the download URL.
 * Step 2: Download the binary data.
 * Step 3: Convert to base64.
 */
export async function downloadWhatsAppMedia(mediaId: string): Promise<string> {
  const metadataResponse = await axios.get(
    `${WHATSAPP_API_URL}/${mediaId}`,
    { headers: { 'Authorization': `Bearer ${WHATSAPP_ACCESS_TOKEN}` } }
  );

  const downloadUrl = metadataResponse.data.url;

  const mediaResponse = await axios.get(downloadUrl, {
    headers: { 'Authorization': `Bearer ${WHATSAPP_ACCESS_TOKEN}` },
    responseType: 'arraybuffer'
  });

  return Buffer.from(mediaResponse.data).toString('base64');
}
