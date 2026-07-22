import { db } from '../db/index.js';
import { aiReply, isAiConfigured } from '../ai.js';
import { getManager, AUTOMATION_USER_ID } from './index.js';

export interface AutoReplyRule {
  id: number;
  account_id: number | null;
  name: string;
  enabled: number;
  trigger_type: 'keyword' | 'all';
  keywords: string | null;
  match_mode: 'contains' | 'exact' | 'starts';
  response_type: 'text' | 'ai';
  reply_text: string | null;
  ai_prompt: string | null;
  cooldown_minutes: number;
  only_individual: number;
}

export type KeywordMatcher = Pick<AutoReplyRule, 'trigger_type' | 'keywords' | 'match_mode'>;

export function matchesKeywords(rule: KeywordMatcher, text: string): boolean {
  if (rule.trigger_type === 'all') return true;
  const keywords = (rule.keywords ?? '')
    .split(',')
    .map((k) => k.trim().toLowerCase())
    .filter(Boolean);
  if (keywords.length === 0) return false;
  const lower = text.toLowerCase().trim();
  return keywords.some((k) => {
    if (rule.match_mode === 'exact') return lower === k;
    if (rule.match_mode === 'starts') return lower.startsWith(k);
    return lower.includes(k);
  });
}

function cooldownOk(rule: AutoReplyRule, accountId: number, jid: string): boolean {
  const row = db
    .prepare(`SELECT last_sent_at FROM auto_reply_log WHERE rule_id = ? AND account_id = ? AND jid = ?`)
    .get(rule.id, accountId, jid) as { last_sent_at: number } | undefined;
  if (!row) return true;
  return Date.now() / 1000 - row.last_sent_at >= rule.cooldown_minutes * 60;
}

function recordSent(rule: AutoReplyRule, accountId: number, jid: string): void {
  db.prepare(
    `INSERT INTO auto_reply_log (rule_id, account_id, jid, last_sent_at) VALUES (?, ?, ?, ?)
     ON CONFLICT (rule_id, account_id, jid) DO UPDATE SET last_sent_at = excluded.last_sent_at`
  ).run(rule.id, accountId, jid, Math.floor(Date.now() / 1000));
}

/** Runs the first matching enabled rule for an incoming message. Returns true if replied. */
export async function runAutoReplies(accountId: number, jid: string, text: string): Promise<boolean> {
  const isGroup = jid.endsWith('@g.us');
  const rules = db
    .prepare(
      `SELECT * FROM auto_replies WHERE enabled = 1 AND (account_id IS NULL OR account_id = ?) ORDER BY id`
    )
    .all(accountId) as AutoReplyRule[];

  for (const rule of rules) {
    if (rule.only_individual && isGroup) continue;
    if (!matchesKeywords(rule, text)) continue;
    if (!cooldownOk(rule, accountId, jid)) continue;

    let reply: string | null = null;
    if (rule.response_type === 'ai') {
      if (!isAiConfigured()) continue;
      reply = await aiReply(accountId, jid, rule.ai_prompt ?? '');
    } else {
      reply = rule.reply_text;
    }
    if (!reply) continue;

    try {
      await getManager().sendText(accountId, jid, reply, AUTOMATION_USER_ID);
      recordSent(rule, accountId, jid);
      return true;
    } catch (err) {
      console.warn(`[auto-reply] rule "${rule.name}" send failed:`, (err as Error).message);
    }
  }
  return false;
}
