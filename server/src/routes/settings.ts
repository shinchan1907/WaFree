import { Router } from 'express';
import { requireAuth, requireAdmin } from '../auth/middleware.js';
import { getAllSettingsMasked, setSetting, SETTING_KEYS, SECRET_KEYS, type SettingKey } from '../settings.js';
import { sendWebhook } from '../notify.js';
import { isAiConfigured } from '../ai.js';

export const settingsRouter = Router();
settingsRouter.use(requireAuth, requireAdmin);

settingsRouter.get('/', (_req, res) => {
  res.json({ success: true, data: { ...getAllSettingsMasked(), ai_configured: isAiConfigured() ? '1' : '0' } });
});

settingsRouter.put('/', (req, res) => {
  const body = req.body ?? {};
  for (const key of SETTING_KEYS) {
    if (!(key in body)) continue;
    const value = String(body[key] ?? '');
    // Masked placeholder means "keep existing secret".
    if (SECRET_KEYS.includes(key as SettingKey) && value === '••••••••') continue;
    setSetting(key as SettingKey, value);
  }
  res.json({ success: true, data: getAllSettingsMasked() });
});

settingsRouter.post('/test-webhook', async (_req, res) => {
  const ok = await sendWebhook('test', { message: 'WaFree webhook test — your notifications are working!' });
  if (!ok) {
    res.status(502).json({
      success: false,
      error: 'Webhook call failed. Check the URL, make sure webhook notifications are enabled, and that the endpoint answers 2xx.'
    });
    return;
  }
  res.json({ success: true, data: null });
});
