import type { Request, Response, NextFunction } from 'express';
import { verifyToken, canAccessAccount, type AuthUser } from './service.js';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    res.status(401).json({ success: false, error: 'Missing token' });
    return;
  }
  const user = verifyToken(header.slice(7));
  if (!user) {
    res.status(401).json({ success: false, error: 'Invalid or expired token' });
    return;
  }
  req.user = user;
  next();
}

export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  if (req.user?.role !== 'admin') {
    res.status(403).json({ success: false, error: 'Admin access required' });
    return;
  }
  next();
}

/** For routes with :accountId — checks assignment for executives. */
export function requireAccountAccess(req: Request, res: Response, next: NextFunction): void {
  const accountId = Number(req.params.accountId);
  if (!Number.isInteger(accountId)) {
    res.status(400).json({ success: false, error: 'Invalid account id' });
    return;
  }
  if (!req.user || !canAccessAccount(req.user, accountId)) {
    res.status(403).json({ success: false, error: 'No access to this WhatsApp account' });
    return;
  }
  next();
}
