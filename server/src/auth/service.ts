import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { db } from '../db/index.js';
import { config } from '../config.js';

export interface AuthUser {
  id: number;
  username: string;
  name: string;
  role: 'admin' | 'executive';
}

interface UserRow {
  id: number;
  username: string;
  password_hash: string;
  name: string;
  role: 'admin' | 'executive';
  is_active: number;
}

export function login(username: string, password: string): { token: string; user: AuthUser } | null {
  const row = db.prepare(`SELECT * FROM users WHERE username = ?`).get(username) as UserRow | undefined;
  if (!row || !row.is_active) return null;
  if (!bcrypt.compareSync(password, row.password_hash)) return null;
  const user: AuthUser = { id: row.id, username: row.username, name: row.name, role: row.role };
  const token = jwt.sign(user, config.jwtSecret, { expiresIn: config.jwtExpiresIn } as jwt.SignOptions);
  return { token, user };
}

export function verifyToken(token: string): AuthUser | null {
  try {
    const payload = jwt.verify(token, config.jwtSecret) as AuthUser & jwt.JwtPayload;
    const row = db.prepare(`SELECT is_active FROM users WHERE id = ?`).get(payload.id) as
      | { is_active: number }
      | undefined;
    if (!row || !row.is_active) return null;
    return { id: payload.id, username: payload.username, name: payload.name, role: payload.role };
  } catch {
    return null;
  }
}

export function canAccessAccount(user: AuthUser, accountId: number): boolean {
  if (user.role === 'admin') return true;
  const row = db
    .prepare(`SELECT 1 AS ok FROM assignments WHERE user_id = ? AND account_id = ?`)
    .get(user.id, accountId);
  return Boolean(row);
}

export function accessibleAccountIds(user: AuthUser): number[] {
  if (user.role === 'admin') {
    const rows = db.prepare(`SELECT id FROM wa_accounts`).all() as { id: number }[];
    return rows.map((r) => r.id);
  }
  const rows = db.prepare(`SELECT account_id FROM assignments WHERE user_id = ?`).all(user.id) as {
    account_id: number;
  }[];
  return rows.map((r) => r.account_id);
}
