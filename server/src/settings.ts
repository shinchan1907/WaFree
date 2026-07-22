import { db } from './db/index.js';

export type SettingKey =
  | 'webhook_url'
  | 'webhook_secret'
  | 'webhook_enabled'
  | 'ai_base_url'
  | 'ai_api_key'
  | 'ai_model'
  | 'ai_system_prompt';

export const SETTING_KEYS: SettingKey[] = [
  'webhook_url',
  'webhook_secret',
  'webhook_enabled',
  'ai_base_url',
  'ai_api_key',
  'ai_model',
  'ai_system_prompt'
];

/** Keys whose values are masked when sent to the frontend. */
export const SECRET_KEYS: SettingKey[] = ['webhook_secret', 'ai_api_key'];

export function getSetting(key: SettingKey): string {
  const row = db.prepare(`SELECT value FROM settings WHERE key = ?`).get(key) as { value: string } | undefined;
  return row?.value ?? '';
}

export function setSetting(key: SettingKey, value: string): void {
  db.prepare(
    `INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value`
  ).run(key, value);
}

export function getAllSettingsMasked(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const key of SETTING_KEYS) {
    const value = getSetting(key);
    out[key] = SECRET_KEYS.includes(key) && value ? '••••••••' : value;
  }
  return out;
}
