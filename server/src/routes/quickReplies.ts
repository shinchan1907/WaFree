import { Router } from 'express';
import { db } from '../db/index.js';
import { requireAuth, requireAdmin } from '../auth/middleware.js';
import { accessibleAccountIds } from '../auth/service.js';

export const quickRepliesRouter = Router();
quickRepliesRouter.use(requireAuth);

/** Everyone sees global replies + replies for accounts they can access. */
quickRepliesRouter.get('/', (req, res) => {
  const ids = accessibleAccountIds(req.user!);
  const placeholders = ids.map(() => '?').join(',');
  const sql = ids.length
    ? `SELECT * FROM quick_replies WHERE account_id IS NULL OR account_id IN (${placeholders}) ORDER BY shortcut`
    : `SELECT * FROM quick_replies WHERE account_id IS NULL ORDER BY shortcut`;
  res.json({ success: true, data: db.prepare(sql).all(...ids) });
});

quickRepliesRouter.post('/', requireAdmin, (req, res) => {
  const { shortcut, text, account_id } = req.body ?? {};
  if (!shortcut || !text) {
    res.status(400).json({ success: false, error: 'shortcut and text are required' });
    return;
  }
  const info = db
    .prepare(`INSERT INTO quick_replies (account_id, shortcut, text) VALUES (?, ?, ?)`)
    .run(account_id ? Number(account_id) : null, String(shortcut).trim().replace(/^\//, ''), String(text));
  res.json({ success: true, data: { id: info.lastInsertRowid } });
});

quickRepliesRouter.patch('/:id', requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  const { shortcut, text, account_id } = req.body ?? {};
  if (shortcut) {
    db.prepare(`UPDATE quick_replies SET shortcut = ? WHERE id = ?`).run(
      String(shortcut).trim().replace(/^\//, ''),
      id
    );
  }
  if (text) db.prepare(`UPDATE quick_replies SET text = ? WHERE id = ?`).run(String(text), id);
  if (account_id !== undefined) {
    db.prepare(`UPDATE quick_replies SET account_id = ? WHERE id = ?`).run(
      account_id === null ? null : Number(account_id),
      id
    );
  }
  res.json({ success: true, data: null });
});

quickRepliesRouter.delete('/:id', requireAdmin, (req, res) => {
  db.prepare(`DELETE FROM quick_replies WHERE id = ?`).run(Number(req.params.id));
  res.json({ success: true, data: null });
});
