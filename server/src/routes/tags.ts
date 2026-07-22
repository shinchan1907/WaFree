import { Router } from 'express';
import { db } from '../db/index.js';
import { requireAuth, requireAdmin } from '../auth/middleware.js';

export const tagsRouter = Router();
tagsRouter.use(requireAuth);

tagsRouter.get('/', (_req, res) => {
  res.json({ success: true, data: db.prepare(`SELECT * FROM tags ORDER BY name`).all() });
});

tagsRouter.post('/', requireAdmin, (req, res) => {
  const { name, color } = req.body ?? {};
  if (!name || typeof name !== 'string') {
    res.status(400).json({ success: false, error: 'Tag name is required' });
    return;
  }
  try {
    const info = db
      .prepare(`INSERT INTO tags (name, color) VALUES (?, ?)`)
      .run(name.trim(), typeof color === 'string' ? color : '#53bdeb');
    res.json({ success: true, data: { id: info.lastInsertRowid } });
  } catch (err: any) {
    if (String(err?.message).includes('UNIQUE')) {
      res.status(409).json({ success: false, error: 'Tag already exists' });
      return;
    }
    throw err;
  }
});

tagsRouter.patch('/:id', requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  const { name, color } = req.body ?? {};
  if (name) db.prepare(`UPDATE tags SET name = ? WHERE id = ?`).run(String(name).trim(), id);
  if (color) db.prepare(`UPDATE tags SET color = ? WHERE id = ?`).run(String(color), id);
  res.json({ success: true, data: null });
});

tagsRouter.delete('/:id', requireAdmin, (req, res) => {
  db.prepare(`DELETE FROM tags WHERE id = ?`).run(Number(req.params.id));
  res.json({ success: true, data: null });
});
