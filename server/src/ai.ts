import { getSetting } from './settings.js';
import { db } from './db/index.js';

const AI_TIMEOUT_MS = 30000;
const CONTEXT_MESSAGES = 10;
const MAX_TOKENS = 500;

export function isAiConfigured(): boolean {
  return Boolean(getSetting('ai_base_url') && getSetting('ai_model'));
}

/** Builds recent conversation context for the AI from stored messages. */
function conversationContext(accountId: number, jid: string): { role: 'user' | 'assistant'; content: string }[] {
  const rows = db
    .prepare(
      `SELECT from_me, text FROM messages WHERE account_id = ? AND chat_jid = ? AND text IS NOT NULL
       ORDER BY timestamp DESC, id DESC LIMIT ${CONTEXT_MESSAGES}`
    )
    .all(accountId, jid) as { from_me: number; text: string }[];
  return rows.reverse().map((r) => ({ role: r.from_me ? ('assistant' as const) : ('user' as const), content: r.text }));
}

/**
 * Calls any OpenAI-compatible chat completions API (OpenAI, Anthropic compat,
 * Groq, OpenRouter, DeepSeek, Ollama, LM Studio, ...).
 */
export async function aiReply(accountId: number, jid: string, rulePrompt: string): Promise<string | null> {
  const baseUrl = getSetting('ai_base_url').replace(/\/+$/, '');
  const model = getSetting('ai_model');
  if (!baseUrl || !model) return null;

  const systemPrompt = [getSetting('ai_system_prompt'), rulePrompt].filter(Boolean).join('\n\n');
  const messages = [
    { role: 'system', content: systemPrompt || 'You are a helpful customer support assistant. Reply concisely.' },
    ...conversationContext(accountId, jid)
  ];
  if (messages.length === 1) return null;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), AI_TIMEOUT_MS);
  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    const apiKey = getSetting('ai_api_key');
    if (apiKey) headers.Authorization = `Bearer ${apiKey}`;

    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ model, messages, max_tokens: MAX_TOKENS }),
      signal: controller.signal
    });
    if (!res.ok) {
      console.warn(`[ai] completion failed: HTTP ${res.status} ${await res.text().catch(() => '')}`);
      return null;
    }
    const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const text = json.choices?.[0]?.message?.content?.trim();
    return text || null;
  } catch (err) {
    console.warn('[ai] completion error:', (err as Error).message);
    return null;
  } finally {
    clearTimeout(timer);
  }
}
