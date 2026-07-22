import { Router } from 'express';
import { login } from '../auth/service.js';
import { requireAuth } from '../auth/middleware.js';

export const authRouter = Router();

authRouter.post('/login', (req, res) => {
  const { username, password } = req.body ?? {};
  if (typeof username !== 'string' || typeof password !== 'string' || !username || !password) {
    res.status(400).json({ success: false, error: 'Username and password are required' });
    return;
  }
  const result = login(username.trim(), password);
  if (!result) {
    res.status(401).json({ success: false, error: 'Invalid username or password' });
    return;
  }
  res.json({ success: true, data: result });
});

authRouter.get('/me', requireAuth, (req, res) => {
  res.json({ success: true, data: req.user });
});
