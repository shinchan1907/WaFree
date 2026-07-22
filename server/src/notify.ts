import { getSetting } from './settings.js';

const WEBHOOK_TIMEOUT_MS = 8000;

export type WebhookEvent =
  | 'account.connected'
  | 'account.disconnected'
  | 'account.logged_out'
  | 'account.qr_required'
  | 'message.send_failed'
  | 'scheduled.failed'
  | 'test';

/**
 * Fire-and-forget webhook notification. Used for operational alerts
 * (account logged out, send failures) so the owner can wire alerts
 * into Slack, n8n, Telegram bots, etc.
 */
export async function sendWebhook(event: WebhookEvent, payload: Record<string, unknown>): Promise<boolean> {
  if (getSetting('webhook_enabled') !== '1') return false;
  const url = getSetting('webhook_url');
  if (!url) return false;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), WEBHOOK_TIMEOUT_MS);
  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    const secret = getSetting('webhook_secret');
    if (secret) headers['X-WaFree-Secret'] = secret;
    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({ event, timestamp: new Date().toISOString(), ...payload }),
      signal: controller.signal
    });
    return res.ok;
  } catch (err) {
    console.warn(`[notify] webhook delivery failed for "${event}":`, (err as Error).message);
    return false;
  } finally {
    clearTimeout(timer);
  }
}
