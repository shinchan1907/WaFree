import { Router } from 'express';
import { db } from '../db/index.js';
import { requireAuth, requireAccountAccess } from '../auth/middleware.js';
import { logStatusChange } from '../automation/assignment.js';
import type { WaManager } from '../wa/manager.js';
import { getChat } from '../wa/store.js';

const PAGE_SIZE = 50;
const CHAT_STATUSES = ['pending', 'ongoing', 'resolved'] as const;

export function chatsRouter(manager: WaManager): Router {
  const router = Router({ mergeParams: true });
  router.use(requireAuth, requireAccountAccess);

  /** List chats for an account, optional ?status= filter and ?q= search. */
  router.get('/', (req, res) => {
    const accountId = Number((req.params as Record<string, string>).accountId);
    const { status, q } = req.query;
    let sql = `SELECT c.account_id, c.jid,
                      COALESCE(c.name, ct.name, (SELECT sender_name FROM messages WHERE account_id = c.account_id AND chat_jid = c.jid AND sender_name IS NOT NULL AND sender_name != '' ORDER BY timestamp DESC LIMIT 1)) AS name,
                      c.last_message_at, c.last_message_preview, c.unread_count, c.status, c.assigned_user_id
               FROM chats c
               LEFT JOIN contacts ct ON ct.account_id = c.account_id AND ct.jid = c.jid
               WHERE c.account_id = ?`;
    const params: unknown[] = [accountId];
    if (typeof status === 'string' && (CHAT_STATUSES as readonly string[]).includes(status)) {
      sql += ` AND c.status = ?`;
      params.push(status);
    }
    if (typeof q === 'string' && q.trim()) {
      sql += ` AND (COALESCE(c.name, ct.name) LIKE ? OR c.jid LIKE ?)`;
      const like = `%${q.trim()}%`;
      params.push(like, like);
    }
    sql += ` ORDER BY COALESCE(c.last_message_at, 0) DESC LIMIT 500`;
    const rows = db.prepare(sql).all(...params) as { account_id: number; jid: string }[];
    const tagStmt = db.prepare(`SELECT tag_id FROM chat_tags WHERE account_id = ? AND jid = ?`);
    const data = rows.map((r) => ({
      ...r,
      tag_ids: (tagStmt.all(r.account_id, r.jid) as { tag_id: number }[]).map((t) => t.tag_id)
    }));
    res.json({ success: true, data });
  });

  /** Message history, newest-last. ?before=<unix seconds> for pagination. */
  router.get('/:jid/messages', (req, res) => {
    const accountId = Number((req.params as Record<string, string>).accountId);
    const jid = String(req.params.jid);
    const before = Number(req.query.before) || 0;
    let sql = `SELECT msg_id, from_me, sender_jid, sender_name, type, text, timestamp, sent_by_user_id, status
               FROM messages WHERE account_id = ? AND chat_jid = ?`;
    const params: unknown[] = [accountId, jid];
    if (before > 0) {
      sql += ` AND timestamp < ?`;
      params.push(before);
    }
    sql += ` ORDER BY timestamp DESC, id DESC LIMIT ${PAGE_SIZE}`;
    const rows = db.prepare(sql).all(...params) as any[];
    res.json({ success: true, data: rows.reverse(), meta: { hasMore: rows.length === PAGE_SIZE } });
  });

  /** Send a text message. */
  router.post('/:jid/messages', async (req, res) => {
    const accountId = Number((req.params as Record<string, string>).accountId);
    const jid = String(req.params.jid);
    const { text } = req.body ?? {};
    if (typeof text !== 'string' || !text.trim()) {
      res.status(400).json({ success: false, error: 'Message text is required' });
      return;
    }
    try {
      const result = await manager.sendText(accountId, jid, text.trim(), req.user!.id);
      // Ticket ownership: the first person to reply claims the chat.
      const claimed = db
        .prepare(
          `UPDATE chats SET assigned_user_id = ? WHERE account_id = ? AND jid = ? AND assigned_user_id IS NULL`
        )
        .run(req.user!.id, accountId, jid);
      if (claimed.changes > 0) manager.broadcastChat(accountId, jid);
      res.json({ success: true, data: result });
    } catch (err: any) {
      res.status(502).json({ success: false, error: err?.message || 'Failed to send message' });
    }
  });

  /** Update chat status (pending/ongoing/resolved) and/or assigned agent. */
  router.patch('/:jid', (req, res) => {
    const accountId = Number((req.params as Record<string, string>).accountId);
    const jid = String(req.params.jid);
    const { status, assigned_user_id } = req.body ?? {};
    const chat = getChat(accountId, jid);
    if (!chat) {
      res.status(404).json({ success: false, error: 'Chat not found' });
      return;
    }
    if (status !== undefined) {
      if (!(CHAT_STATUSES as readonly string[]).includes(status)) {
        res.status(400).json({ success: false, error: 'Invalid status' });
        return;
      }
      db.prepare(`UPDATE chats SET status = ? WHERE account_id = ? AND jid = ?`).run(status, accountId, jid);
      if (status !== chat.status) {
        logStatusChange(accountId, jid, status, req.user!.id);
        // Resolving a ticket triggers the customer-satisfaction survey (if enabled).
        if (status === 'resolved') {
          const agentId = chat.assigned_user_id ?? req.user!.id;
          void manager.sendCsatSurvey(accountId, jid, agentId).catch(() => undefined);
        }
      }
    }
    if (assigned_user_id !== undefined) {
      db.prepare(`UPDATE chats SET assigned_user_id = ? WHERE account_id = ? AND jid = ?`).run(
        assigned_user_id === null ? null : Number(assigned_user_id),
        accountId,
        jid
      );
    }
    const updated = getChat(accountId, jid);
    manager.broadcastChat(accountId, jid);
    res.json({ success: true, data: updated });
  });

  /** Schedule a message for later delivery. */
  router.post('/:jid/schedule', (req, res) => {
    const accountId = Number((req.params as Record<string, string>).accountId);
    const jid = String(req.params.jid);
    const { text, send_at } = req.body ?? {};
    if (typeof text !== 'string' || !text.trim()) {
      res.status(400).json({ success: false, error: 'Message text is required' });
      return;
    }
    const sendAt = Number(send_at);
    if (!Number.isFinite(sendAt) || sendAt <= Math.floor(Date.now() / 1000)) {
      res.status(400).json({ success: false, error: 'send_at must be a future unix timestamp (seconds)' });
      return;
    }
    const info = db
      .prepare(
        `INSERT INTO scheduled_messages (account_id, chat_jid, text, send_at, created_by) VALUES (?, ?, ?, ?, ?)`
      )
      .run(accountId, jid, text.trim(), sendAt, req.user!.id);
    res.json({ success: true, data: { id: info.lastInsertRowid, send_at: sendAt } });
  });

  /** Pending scheduled messages for one chat. */
  router.get('/:jid/schedule', (req, res) => {
    const accountId = Number((req.params as Record<string, string>).accountId);
    const jid = String(req.params.jid);
    const rows = db
      .prepare(
        `SELECT id, text, send_at, status FROM scheduled_messages
         WHERE account_id = ? AND chat_jid = ? AND status = 'pending' ORDER BY send_at`
      )
      .all(accountId, jid);
    res.json({ success: true, data: rows });
  });

  /** Cancel a pending scheduled message for this chat. */
  router.delete('/:jid/schedule/:scheduleId', (req, res) => {
    const accountId = Number((req.params as Record<string, string>).accountId);
    db.prepare(
      `UPDATE scheduled_messages SET status = 'cancelled'
       WHERE id = ? AND account_id = ? AND status = 'pending'`
    ).run(Number(req.params.scheduleId), accountId);
    res.json({ success: true, data: null });
  });

  /** Replace this chat's tags. */
  router.put('/:jid/tags', (req, res) => {
    const accountId = Number((req.params as Record<string, string>).accountId);
    const jid = String(req.params.jid);
    const { tag_ids } = req.body ?? {};
    if (!Array.isArray(tag_ids) || !tag_ids.every((t) => Number.isInteger(t))) {
      res.status(400).json({ success: false, error: 'tag_ids must be an array of tag ids' });
      return;
    }
    const replace = db.transaction((ids: number[]) => {
      db.prepare(`DELETE FROM chat_tags WHERE account_id = ? AND jid = ?`).run(accountId, jid);
      const ins = db.prepare(`INSERT OR IGNORE INTO chat_tags (account_id, jid, tag_id) VALUES (?, ?, ?)`);
      for (const tagId of ids) ins.run(accountId, jid, tagId);
    });
    replace(tag_ids as number[]);
    manager.broadcastChat(accountId, jid);
    res.json({ success: true, data: getChat(accountId, jid) });
  });

  /** Mark chat read (clears unread counter for everyone). */
  router.post('/:jid/read', (req, res) => {
    const accountId = Number((req.params as Record<string, string>).accountId);
    const jid = String(req.params.jid);
    db.prepare(`UPDATE chats SET unread_count = 0 WHERE account_id = ? AND jid = ?`).run(accountId, jid);
    manager.broadcastChat(accountId, jid);
    res.json({ success: true, data: getChat(accountId, jid) });
  });

  return router;
}
