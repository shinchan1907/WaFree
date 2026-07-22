import { Router } from 'express';
import { db } from '../db/index.js';
import { requireAuth, requireAdmin, requireAccountAccess } from '../auth/middleware.js';
import type { WaManager } from '../wa/manager.js';

export function accountsRouter(manager: WaManager): Router {
  const router = Router();
  router.use(requireAuth);

  /** List accounts visible to the current user, with assigned agents. */
  router.get('/', (req, res) => {
    const base = `
      SELECT a.id, a.label, a.color, a.phone, a.status, a.max_agents, a.created_at,
             (SELECT json_group_array(json_object('id', u.id, 'name', u.name, 'username', u.username))
              FROM assignments s JOIN users u ON u.id = s.user_id WHERE s.account_id = a.id) AS agents
      FROM wa_accounts a`;
    const rows =
      req.user!.role === 'admin'
        ? db.prepare(`${base} ORDER BY a.id`).all()
        : db
            .prepare(`${base} WHERE a.id IN (SELECT account_id FROM assignments WHERE user_id = ?) ORDER BY a.id`)
            .all(req.user!.id);
    const data = rows.map((r: any) => ({
      ...r,
      agents: JSON.parse(r.agents || '[]'),
      status: manager.getStatus(r.id) === 'disconnected' ? r.status : manager.getStatus(r.id)
    }));
    res.json({ success: true, data });
  });

  router.post('/', requireAdmin, (req, res) => {
    const { label, color, max_agents } = req.body ?? {};
    if (!label || typeof label !== 'string') {
      res.status(400).json({ success: false, error: 'label is required' });
      return;
    }
    const info = db
      .prepare(`INSERT INTO wa_accounts (label, color, max_agents) VALUES (?, ?, ?)`)
      .run(label.trim(), typeof color === 'string' ? color : '#00a884', Number(max_agents) || 2);
    res.json({ success: true, data: { id: info.lastInsertRowid } });
  });

  router.patch('/:accountId', requireAdmin, (req, res) => {
    const id = Number(req.params.accountId);
    const { label, color, max_agents } = req.body ?? {};
    if (label) db.prepare(`UPDATE wa_accounts SET label = ? WHERE id = ?`).run(String(label).trim(), id);
    if (color) db.prepare(`UPDATE wa_accounts SET color = ? WHERE id = ?`).run(String(color), id);
    if (max_agents) db.prepare(`UPDATE wa_accounts SET max_agents = ? WHERE id = ?`).run(Number(max_agents), id);
    res.json({ success: true, data: null });
  });

  router.delete('/:accountId', requireAdmin, async (req, res) => {
    const id = Number(req.params.accountId);
    await manager.stop(id).catch(() => undefined);
    db.prepare(`DELETE FROM wa_accounts WHERE id = ?`).run(id);
    db.prepare(`DELETE FROM chats WHERE account_id = ?`).run(id);
    db.prepare(`DELETE FROM messages WHERE account_id = ?`).run(id);
    db.prepare(`DELETE FROM contacts WHERE account_id = ?`).run(id);
    res.json({ success: true, data: null });
  });

  /** Start session / show QR (admin only — the QR grants full account access). */
  router.post('/:accountId/connect', requireAdmin, async (req, res) => {
    const id = Number(req.params.accountId);
    const exists = db.prepare(`SELECT id FROM wa_accounts WHERE id = ?`).get(id);
    if (!exists) {
      res.status(404).json({ success: false, error: 'Account not found' });
      return;
    }
    await manager.start(id);
    res.json({ success: true, data: { status: manager.getStatus(id), qr: manager.getQr(id) } });
  });

  router.post('/:accountId/logout', requireAdmin, async (req, res) => {
    await manager.logout(Number(req.params.accountId));
    res.json({ success: true, data: null });
  });

  /** Replace the set of assigned agents (respects max_agents). */
  router.put('/:accountId/agents', requireAdmin, (req, res) => {
    const id = Number(req.params.accountId);
    const { user_ids } = req.body ?? {};
    if (!Array.isArray(user_ids) || !user_ids.every((u) => Number.isInteger(u))) {
      res.status(400).json({ success: false, error: 'user_ids must be an array of user ids' });
      return;
    }
    const account = db.prepare(`SELECT max_agents FROM wa_accounts WHERE id = ?`).get(id) as
      | { max_agents: number }
      | undefined;
    if (!account) {
      res.status(404).json({ success: false, error: 'Account not found' });
      return;
    }
    if (user_ids.length > account.max_agents) {
      res.status(400).json({
        success: false,
        error: `This account allows at most ${account.max_agents} agent(s)`
      });
      return;
    }
    const replace = db.transaction((ids: number[]) => {
      db.prepare(`DELETE FROM assignments WHERE account_id = ?`).run(id);
      const ins = db.prepare(`INSERT OR IGNORE INTO assignments (user_id, account_id) VALUES (?, ?)`);
      for (const uid of ids) ins.run(uid, id);
    });
    replace(user_ids as number[]);
    res.json({ success: true, data: null });
  });

  /** Current QR (admin, e.g. after page refresh while pairing). */
  router.get('/:accountId/qr', requireAdmin, (req, res) => {
    const id = Number(req.params.accountId);
    res.json({ success: true, data: { status: manager.getStatus(id), qr: manager.getQr(id) } });
  });

  /** Agents assigned to an account — visible to anyone with access (for chat assignment UI). */
  router.get('/:accountId/agents', requireAccountAccess, (req, res) => {
    const rows = db
      .prepare(
        `SELECT u.id, u.name, u.username FROM assignments s JOIN users u ON u.id = s.user_id
         WHERE s.account_id = ? AND u.is_active = 1`
      )
      .all(Number(req.params.accountId));
    res.json({ success: true, data: rows });
  });

  return router;
}
