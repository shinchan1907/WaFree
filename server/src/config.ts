import 'dotenv/config';
import path from 'node:path';
import crypto from 'node:crypto';

const DEFAULT_PORT = 4000;

function resolveJwtSecret(): string {
  if (process.env.JWT_SECRET) return process.env.JWT_SECRET;
  console.warn(
    '[config] JWT_SECRET not set — using a random secret. ' +
      'All sessions will be invalidated on restart. Set JWT_SECRET in production!'
  );
  return crypto.randomBytes(32).toString('hex');
}

export const config = {
  port: Number(process.env.PORT) || DEFAULT_PORT,
  dataDir: path.resolve(process.env.DATA_DIR || './data'),
  jwtSecret: resolveJwtSecret(),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '12h',
  corsOrigin: process.env.CORS_ORIGIN || true
} as const;
