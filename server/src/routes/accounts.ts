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
      SELECT a.id, a.label, a.color, a.phone, a.status, a.max_agents, a.auto_assign, a.created_at,
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
    const { label, color, max_agents, auto_assign } = req.body ?? {};
    if (label) db.prepare(`UPDATE wa_accounts SET label = ? WHERE id = ?`).run(String(label).trim(), id);
    if (color) db.prepare(`UPDATE wa_accounts SET color = ? WHERE id = ?`).run(String(color), id);
    if (max_agents) db.prepare(`UPDATE wa_accounts SET max_agents = ? WHERE id = ?`).run(Number(max_agents), id);
    if (auto_assign !== undefined) {
      db.prepare(`UPDATE wa_accounts SET auto_assign = ? WHERE id = ?`).run(auto_assign ? 1 : 0, id);
    }
    res.json({ success: true, data: null });
  });

  router.delete('/:accountId', requireAdmin, async (req, res) => {
    const id = Number(req.params.accountId);
    await manager.stop(id).catch(() => undefined);
    db.prepare(`DELETE FROM wa_accounts WHERE id = ?`).run(id);
    db.prepare(`DELETE FROM assignments WHERE account_id = ?`).run(id);
    // Keep chats, messages, contacts persistent for historical audit trail!
    res.json({ success: true, data: null });
  });

  /** Start session / show QR (admin only — force fresh session if needed). */
  router.post('/:accountId/connect', requireAdmin, async (req, res) => {
    const id = Number(req.params.accountId);
    const exists = db.prepare(`SELECT id FROM wa_accounts WHERE id = ?`).get(id);
    if (!exists) {
      res.status(404).json({ success: false, error: 'Account not found' });
      return;
    }
    await manager.start(id, true);
    res.json({ success: true, data: { status: manager.getStatus(id), qr: manager.getQr(id) } });
  });

  router.post('/:accountId/logout', requireAdmin, async (req, res) => {
    await manager.logout(Number(req.params.accountId));
    res.json({ success: true, data: null });
  });

  /** Replace the set of assigned agents (assign any system users). */
  router.put('/:accountId/agents', requireAdmin, (req, res) => {
    const id = Number(req.params.accountId);
    const { user_ids } = req.body ?? {};
    if (!Array.isArray(user_ids) || !user_ids.every((u) => Number.isInteger(u))) {
      res.status(400).json({ success: false, error: 'user_ids must be an array of user ids' });
      return;
    }
    const account = db.prepare(`SELECT id FROM wa_accounts WHERE id = ?`).get(id);
    if (!account) {
      res.status(404).json({ success: false, error: 'Account not found' });
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

  /** Profile-picture URL for a chat/contact (cached server-side). */
  router.get('/:accountId/avatar/:jid', requireAccountAccess, async (req, res) => {
    const accountId = Number(req.params.accountId);
    const jid = String(req.params.jid);
    const url = await manager.getAvatarUrl(accountId, jid).catch(() => null);
    res.json({ success: true, data: { url } });
  });

  /** Full contact card for the info panel: name, phone (lid-resolved), avatar. */
  router.get('/:accountId/contact/:jid', requireAccountAccess, async (req, res) => {
    const accountId = Number(req.params.accountId);
    const jid = String(req.params.jid);

    let phone: string | null = null;
    if (jid.endsWith('@s.whatsapp.net')) {
      phone = jid.split('@')[0];
    } else if (jid.endsWith('@lid')) {
      const row = db.prepare(`SELECT pn FROM lid_map WHERE account_id = ? AND lid = ?`).get(accountId, jid) as
        | { pn: string }
        | undefined;
      if (row) phone = row.pn.split('@')[0];
    }

    const chat = db
      .prepare(`SELECT name, status, assigned_user_id FROM chats WHERE account_id = ? AND jid = ?`)
      .get(accountId, jid) as { name: string | null; status: string; assigned_user_id: number | null } | undefined;
    const contact = db.prepare(`SELECT name FROM contacts WHERE account_id = ? AND jid = ?`).get(accountId, jid) as
      | { name: string | null }
      | undefined;
    const avatarUrl = await manager.getAvatarUrl(accountId, jid).catch(() => null);

    res.json({
      success: true,
      data: {
        jid,
        phone,
        name: chat?.name || contact?.name || null,
        is_group: jid.endsWith('@g.us'),
        is_lid: jid.endsWith('@lid'),
        status: chat?.status ?? null,
        avatar_url: avatarUrl
      }
    });
  });

  return router;
}
