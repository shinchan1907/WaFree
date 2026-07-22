import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { db } from '../db/index.js';
import { setSetting } from '../settings.js';
import { login } from '../auth/service.js';

export const setupRouter = Router();

const MIN_PASSWORD_LENGTH = 6;

function needsSetup(): boolean {
  const row = db.prepare(`SELECT COUNT(*) AS c FROM users`).get() as { c: number };
  return row.c === 0;
}

setupRouter.get('/status', (_req, res) => {
  res.json({ success: true, data: { needsSetup: needsSetup() } });
});

/**
 * First-run onboarding: creates the initial admin and (optionally)
 * configures the notification webhook. Only works while no users exist.
 */
setupRouter.post('/', (req, res) => {
  if (!needsSetup()) {
    res.status(403).json({ success: false, error: 'Setup already completed' });
    return;
  }
  const { username, password, name, webhook_url, webhook_secret } = req.body ?? {};
  if (!username || !password || !name) {
    res.status(400).json({ success: false, error: 'name, username and password are required' });
    return;
  }
  if (String(password).length < MIN_PASSWORD_LENGTH) {
    res.status(400).json({ success: false, error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters` });
    return;
  }

  const hash = bcrypt.hashSync(String(password), 10);
  db.prepare(`INSERT INTO users (username, password_hash, name, role) VALUES (?, ?, ?, 'admin')`).run(
    String(username).trim().toLowerCase(),
    hash,
    String(name).trim()
  );

  if (typeof webhook_url === 'string' && webhook_url.trim()) {
    setSetting('webhook_url', webhook_url.trim());
    setSetting('webhook_enabled', '1');
    if (typeof webhook_secret === 'string' && webhook_secret.trim()) {
      setSetting('webhook_secret', webhook_secret.trim());
    }
  }

  const result = login(String(username).trim().toLowerCase(), String(password));
  res.json({ success: true, data: result });
});
