import { Router } from 'express';
import { db } from '../db/index.js';
import { requireAuth, requireAdmin } from '../auth/middleware.js';

export const analyticsRouter = Router();
analyticsRouter.use(requireAuth, requireAdmin);

const MAX_DAYS = 90;

interface AgentRow {
  id: number;
  name: string;
  username: string;
  role: string;
}

/**
 * Per-agent performance report.
 * ?days=1|7|30 — reporting window (default 7).
 */
analyticsRouter.get('/agents', (req, res) => {
  const days = Math.min(Math.max(Number(req.query.days) || 7, 1), MAX_DAYS);
  const since = Math.floor(Date.now() / 1000) - days * 86400;

  const agents = db
    .prepare(`SELECT id, name, username, role FROM users WHERE is_active = 1 ORDER BY name`)
    .all() as AgentRow[];

  const repliesStmt = db.prepare(
    `SELECT COUNT(*) AS c FROM messages WHERE from_me = 1 AND sent_by_user_id = ? AND timestamp >= ?`
  );
  const resolvedStmt = db.prepare(
    `SELECT COUNT(DISTINCT account_id || ':' || chat_jid) AS c FROM chat_status_log
     WHERE status = 'resolved' AND user_id = ? AND at >= ?`
  );
  // Response time: agent message whose immediately-preceding message in the chat came from the customer.
  const responseStmt = db.prepare(
    `SELECT AVG(m.timestamp - prev.timestamp) AS avg_s, COUNT(*) AS pairs
     FROM messages m
     JOIN messages prev ON prev.id = (
       SELECT MAX(p.id) FROM messages p
       WHERE p.account_id = m.account_id AND p.chat_jid = m.chat_jid AND p.id < m.id
     )
     WHERE m.from_me = 1 AND m.sent_by_user_id = ? AND m.timestamp >= ?
       AND prev.from_me = 0 AND m.timestamp - prev.timestamp BETWEEN 0 AND 86400`
  );
  const csatStmt = db.prepare(
    `SELECT AVG(rating) AS avg_rating, COUNT(*) AS c FROM csat_ratings WHERE agent_id = ? AND rated_at >= ?`
  );
  const pendencyStmt = db.prepare(
    `SELECT
       SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) AS pending,
       SUM(CASE WHEN status = 'ongoing' THEN 1 ELSE 0 END) AS ongoing
     FROM chats WHERE assigned_user_id = ?`
  );

  const data = agents.map((agent) => {
    const replies = (repliesStmt.get(agent.id, since) as { c: number }).c;
    const resolved = (resolvedStmt.get(agent.id, since) as { c: number }).c;
    const response = responseStmt.get(agent.id, since) as { avg_s: number | null; pairs: number };
    const csat = csatStmt.get(agent.id, since) as { avg_rating: number | null; c: number };
    const pendency = pendencyStmt.get(agent.id) as { pending: number | null; ongoing: number | null };
    return {
      ...agent,
      replies_sent: replies,
      chats_resolved: resolved,
      avg_response_seconds: response.avg_s !== null ? Math.round(response.avg_s) : null,
      response_samples: response.pairs,
      csat_avg: csat.avg_rating !== null ? Math.round(csat.avg_rating * 100) / 100 : null,
      csat_count: csat.c,
      open_pending: pendency.pending ?? 0,
      open_ongoing: pendency.ongoing ?? 0
    };
  });

  res.json({ success: true, data, meta: { days } as never });
});

/** Workspace-wide overview counters. */
analyticsRouter.get('/overview', (req, res) => {
  const days = Math.min(Math.max(Number(req.query.days) || 7, 1), MAX_DAYS);
  const since = Math.floor(Date.now() / 1000) - days * 86400;

  const totals = db
    .prepare(
      `SELECT
         SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) AS pending,
         SUM(CASE WHEN status = 'ongoing' THEN 1 ELSE 0 END) AS ongoing,
         SUM(CASE WHEN status = 'resolved' THEN 1 ELSE 0 END) AS resolved,
         SUM(CASE WHEN assigned_user_id IS NULL AND status != 'resolved' THEN 1 ELSE 0 END) AS unassigned_open
       FROM chats`
    )
    .get() as { pending: number | null; ongoing: number | null; resolved: number | null; unassigned_open: number | null };

  const incoming = db
    .prepare(`SELECT COUNT(*) AS c FROM messages WHERE from_me = 0 AND timestamp >= ?`)
    .get(since) as { c: number };
  const outgoing = db
    .prepare(`SELECT COUNT(*) AS c FROM messages WHERE from_me = 1 AND timestamp >= ?`)
    .get(since) as { c: number };
  const csat = db
    .prepare(`SELECT AVG(rating) AS avg_rating, COUNT(*) AS c FROM csat_ratings WHERE rated_at >= ?`)
    .get(since) as { avg_rating: number | null; c: number };

  res.json({
    success: true,
    data: {
      pending: totals.pending ?? 0,
      ongoing: totals.ongoing ?? 0,
      resolved: totals.resolved ?? 0,
      unassigned_open: totals.unassigned_open ?? 0,
      incoming_messages: incoming.c,
      outgoing_messages: outgoing.c,
      csat_avg: csat.avg_rating !== null ? Math.round(csat.avg_rating * 100) / 100 : null,
      csat_count: csat.c
    },
    meta: { days } as never
  });
});
