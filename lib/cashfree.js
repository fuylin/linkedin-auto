import { getPlatformSettings } from './platformCheck.js';

/**
 * Get Cashfree config. Returns null if not configured.
 */
export async function getCashfreeConfig() {
  const settings = await getPlatformSettings();
  const b = settings?.billing;
  if (!b?.cashfreeAppId || !b?.cashfreeSecretKey) return null;
  return {
    appId: b.cashfreeAppId,
    secretKey: b.cashfreeSecretKey,
    environment: b.cashfreeEnvironment || 'sandbox',
    webhookSecret: b.cashfreeWebhookSecret || '',
    baseUrl: b.cashfreeEnvironment === 'production'
      ? 'https://api.cashfree.com/pg'
      : 'https://sandbox.cashfree.com/pg',
  };
}

/**
 * Make an authenticated Cashfree API call.
 */
export async function cashfreeApi(method, path, body = null) {
  const config = await getCashfreeConfig();
  if (!config) throw new Error('Cashfree is not configured');

  const headers = {
    'x-client-id': config.appId,
    'x-client-secret': config.secretKey,
    'x-api-version': '2023-08-01',
    'Content-Type': 'application/json',
  };

  const opts = { method, headers };
  if (body) opts.body = JSON.stringify(body);

  const res = await fetch(`${config.baseUrl}${path}`, opts);
  const data = await res.json();
  if (!res.ok) {
    const msg = data?.message || data?.error?.message || `Cashfree API error ${res.status}`;
    const err = new Error(msg);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

/**
 * Verify Cashfree webhook signature.
 */
export async function verifyCashfreeWebhook(rawBody, signature) {
  const config = await getCashfreeConfig();
  if (!config?.webhookSecret) return false;

  const crypto = await import('node:crypto');
  const expected = crypto.createHmac('sha256', config.webhookSecret)
    .update(rawBody)
    .digest('base64');
  return expected === signature;
}
