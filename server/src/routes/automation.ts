import { Router } from 'express';
import { db } from '../db/index.js';
import { requireAuth, requireAdmin } from '../auth/middleware.js';

export const automationRouter = Router();
automationRouter.use(requireAuth, requireAdmin);

/* ─── Auto-reply rules ────────────────────────────────────────────── */

automationRouter.get('/auto-replies', (_req, res) => {
  res.json({ success: true, data: db.prepare(`SELECT * FROM auto_replies ORDER BY id`).all() });
});

automationRouter.post('/auto-replies', (req, res) => {
  const b = req.body ?? {};
  if (!b.name) {
    res.status(400).json({ success: false, error: 'Rule name is required' });
    return;
  }
  if (b.response_type === 'text' && !b.reply_text) {
    res.status(400).json({ success: false, error: 'Reply text is required for text responses' });
    return;
  }
  const info = db
    .prepare(
      `INSERT INTO auto_replies
       (account_id, name, enabled, trigger_type, keywords, match_mode, response_type, reply_text, ai_prompt, cooldown_minutes, only_individual)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      b.account_id ? Number(b.account_id) : null,
      String(b.name).trim(),
      b.enabled === false ? 0 : 1,
      ['keyword', 'all'].includes(b.trigger_type) ? b.trigger_type : 'keyword',
      b.keywords ? String(b.keywords) : null,
      ['contains', 'exact', 'starts'].includes(b.match_mode) ? b.match_mode : 'contains',
      ['text', 'ai'].includes(b.response_type) ? b.response_type : 'text',
      b.reply_text ? String(b.reply_text) : null,
      b.ai_prompt ? String(b.ai_prompt) : null,
      Number(b.cooldown_minutes) >= 0 ? Number(b.cooldown_minutes) : 60,
      b.only_individual === false ? 0 : 1
    );
  res.json({ success: true, data: { id: info.lastInsertRowid } });
});

automationRouter.patch('/auto-replies/:id', (req, res) => {
  const id = Number(req.params.id);
  const b = req.body ?? {};
  const existing = db.prepare(`SELECT id FROM auto_replies WHERE id = ?`).get(id);
  if (!existing) {
    res.status(404).json({ success: false, error: 'Rule not found' });
    return;
  }
  const fields: Record<string, unknown> = {};
  if (b.name !== undefined) fields.name = String(b.name).trim();
  if (b.enabled !== undefined) fields.enabled = b.enabled ? 1 : 0;
  if (b.account_id !== undefined) fields.account_id = b.account_id === null ? null : Number(b.account_id);
  if (['keyword', 'all'].includes(b.trigger_type)) fields.trigger_type = b.trigger_type;
  if (b.keywords !== undefined) fields.keywords = b.keywords ? String(b.keywords) : null;
  if (['contains', 'exact', 'starts'].includes(b.match_mode)) fields.match_mode = b.match_mode;
  if (['text', 'ai'].includes(b.response_type)) fields.response_type = b.response_type;
  if (b.reply_text !== undefined) fields.reply_text = b.reply_text ? String(b.reply_text) : null;
  if (b.ai_prompt !== undefined) fields.ai_prompt = b.ai_prompt ? String(b.ai_prompt) : null;
  if (b.cooldown_minutes !== undefined) fields.cooldown_minutes = Math.max(0, Number(b.cooldown_minutes) || 0);
  if (b.only_individual !== undefined) fields.only_individual = b.only_individual ? 1 : 0;
  const keys = Object.keys(fields);
  if (keys.length > 0) {
    db.prepare(`UPDATE auto_replies SET ${keys.map((k) => `${k} = ?`).join(', ')} WHERE id = ?`).run(
      ...keys.map((k) => fields[k]),
      id
    );
  }
  res.json({ success: true, data: null });
});

automationRouter.delete('/auto-replies/:id', (req, res) => {
  db.prepare(`DELETE FROM auto_replies WHERE id = ?`).run(Number(req.params.id));
  res.json({ success: true, data: null });
});

/* ─── Bots (visual flows) ─────────────────────────────────────────── */

automationRouter.get('/bots', (_req, res) => {
  const bots = db.prepare(`SELECT * FROM bots ORDER BY id`).all() as { flow: string }[];
  res.json({ success: true, data: bots.map((b) => ({ ...b, flow: JSON.parse(b.flow) })) });
});

automationRouter.get('/bots/:id', (req, res) => {
  const bot = db.prepare(`SELECT * FROM bots WHERE id = ?`).get(Number(req.params.id)) as
    | { flow: string }
    | undefined;
  if (!bot) {
    res.status(404).json({ success: false, error: 'Bot not found' });
    return;
  }
  res.json({ success: true, data: { ...bot, flow: JSON.parse(bot.flow) } });
});

automationRouter.post('/bots', (req, res) => {
  const { name, account_id } = req.body ?? {};
  if (!name) {
    res.status(400).json({ success: false, error: 'Bot name is required' });
    return;
  }
  const starterFlow = {
    nodes: [
      { id: 'trigger-1', type: 'trigger', position: { x: 80, y: 160 }, data: { mode: 'any', keywords: '' } }
    ],
    edges: []
  };
  const info = db
    .prepare(`INSERT INTO bots (account_id, name, enabled, flow) VALUES (?, ?, 0, ?)`)
    .run(account_id ? Number(account_id) : null, String(name).trim(), JSON.stringify(starterFlow));
  res.json({ success: true, data: { id: info.lastInsertRowid } });
});

automationRouter.patch('/bots/:id', (req, res) => {
  const id = Number(req.params.id);
  const { name, enabled, account_id, flow } = req.body ?? {};
  const existing = db.prepare(`SELECT id FROM bots WHERE id = ?`).get(id);
  if (!existing) {
    res.status(404).json({ success: false, error: 'Bot not found' });
    return;
  }
  if (name !== undefined) db.prepare(`UPDATE bots SET name = ? WHERE id = ?`).run(String(name).trim(), id);
  if (enabled !== undefined) db.prepare(`UPDATE bots SET enabled = ? WHERE id = ?`).run(enabled ? 1 : 0, id);
  if (account_id !== undefined) {
    db.prepare(`UPDATE bots SET account_id = ? WHERE id = ?`).run(account_id === null ? null : Number(account_id), id);
  }
  if (flow !== undefined) {
    if (!flow || !Array.isArray(flow.nodes) || !Array.isArray(flow.edges)) {
      res.status(400).json({ success: false, error: 'Invalid flow format' });
      return;
    }
    db.prepare(`UPDATE bots SET flow = ?, updated_at = datetime('now') WHERE id = ?`).run(JSON.stringify(flow), id);
  }
  res.json({ success: true, data: null });
});

automationRouter.delete('/bots/:id', (req, res) => {
  db.prepare(`DELETE FROM bots WHERE id = ?`).run(Number(req.params.id));
  res.json({ success: true, data: null });
});

/* ─── Scheduled messages (admin overview) ─────────────────────────── */

automationRouter.get('/scheduled', (_req, res) => {
  const rows = db
    .prepare(
      `SELECT s.*, a.label AS account_label, u.name AS created_by_name, c.name AS chat_name
       FROM scheduled_messages s
       LEFT JOIN wa_accounts a ON a.id = s.account_id
       LEFT JOIN users u ON u.id = s.created_by
       LEFT JOIN chats c ON c.account_id = s.account_id AND c.jid = s.chat_jid
       ORDER BY s.send_at DESC LIMIT 300`
    )
    .all();
  res.json({ success: true, data: rows });
});

automationRouter.delete('/scheduled/:id', (req, res) => {
  db.prepare(`UPDATE scheduled_messages SET status = 'cancelled' WHERE id = ? AND status = 'pending'`).run(
    Number(req.params.id)
  );
  res.json({ success: true, data: null });
});
