import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { db } from '../db/index.js';
import { requireAuth, requireAdmin } from '../auth/middleware.js';

export const usersRouter = Router();
usersRouter.use(requireAuth, requireAdmin);

const MIN_PASSWORD_LENGTH = 6;

usersRouter.get('/', (_req, res) => {
  const users = db
    .prepare(
      `SELECT u.id, u.username, u.name, u.role, u.is_active, u.created_at,
              (SELECT json_group_array(account_id) FROM assignments a WHERE a.user_id = u.id) AS account_ids
       FROM users u ORDER BY u.id`
    )
    .all()
    .map((u: any) => ({ ...u, account_ids: JSON.parse(u.account_ids || '[]') }));
  res.json({ success: true, data: users });
});

usersRouter.post('/', (req, res) => {
  const { username, password, name, role } = req.body ?? {};
  if (!username || !password || !name || !['admin', 'executive'].includes(role)) {
    res.status(400).json({ success: false, error: 'username, password, name and valid role are required' });
    return;
  }
  if (String(password).length < MIN_PASSWORD_LENGTH) {
    res.status(400).json({ success: false, error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters` });
    return;
  }
  try {
    const hash = bcrypt.hashSync(String(password), 10);
    const info = db
      .prepare(`INSERT INTO users (username, password_hash, name, role) VALUES (?, ?, ?, ?)`)
      .run(String(username).trim().toLowerCase(), hash, String(name).trim(), role);
    res.json({ success: true, data: { id: info.lastInsertRowid } });
  } catch (err: any) {
    if (String(err?.message).includes('UNIQUE')) {
      res.status(409).json({ success: false, error: 'Username already exists' });
      return;
    }
    throw err;
  }
});

usersRouter.patch('/:id', (req, res) => {
  const id = Number(req.params.id);
  const { name, password, role, is_active } = req.body ?? {};
  const user = db.prepare(`SELECT id, role FROM users WHERE id = ?`).get(id) as
    | { id: number; role: string }
    | undefined;
  if (!user) {
    res.status(404).json({ success: false, error: 'User not found' });
    return;
  }
  if (name) db.prepare(`UPDATE users SET name = ? WHERE id = ?`).run(String(name).trim(), id);
  if (password) {
    if (String(password).length < MIN_PASSWORD_LENGTH) {
      res.status(400).json({ success: false, error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters` });
      return;
    }
    db.prepare(`UPDATE users SET password_hash = ? WHERE id = ?`).run(bcrypt.hashSync(String(password), 10), id);
  }
  if (role && ['admin', 'executive'].includes(role)) {
    db.prepare(`UPDATE users SET role = ? WHERE id = ?`).run(role, id);
  }
  if (is_active !== undefined && req.user!.id !== id) {
    db.prepare(`UPDATE users SET is_active = ? WHERE id = ?`).run(is_active ? 1 : 0, id);
  }
  res.json({ success: true, data: null });
});

usersRouter.delete('/:id', (req, res) => {
  const id = Number(req.params.id);
  if (id === req.user!.id) {
    res.status(400).json({ success: false, error: 'You cannot delete your own account' });
    return;
  }
  db.prepare(`DELETE FROM users WHERE id = ?`).run(id);
  res.json({ success: true, data: null });
});
