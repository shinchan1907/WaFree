import { db } from '../db/index.js';

/**
 * Auto-distribution: picks the assigned agent with the fewest open
 * (non-resolved) chats on that account, so work spreads evenly.
 * Ties break by rotating on agent id. Returns null when nothing to do.
 */
export function pickAgentForChat(accountId: number): number | null {
  const account = db.prepare(`SELECT auto_assign FROM wa_accounts WHERE id = ?`).get(accountId) as
    | { auto_assign: number }
    | undefined;
  if (!account?.auto_assign) return null;

  const agents = db
    .prepare(
      `SELECT u.id,
              (SELECT COUNT(*) FROM chats c
               WHERE c.account_id = ? AND c.assigned_user_id = u.id AND c.status != 'resolved') AS open_count
       FROM assignments a JOIN users u ON u.id = a.user_id
       WHERE a.account_id = ? AND u.is_active = 1
       ORDER BY open_count ASC, u.id ASC`
    )
    .all(accountId, accountId) as { id: number; open_count: number }[];

  return agents[0]?.id ?? null;
}

/** Assigns an unassigned chat to the least-loaded agent. Returns the agent id if assigned. */
export function autoAssignChat(accountId: number, jid: string): number | null {
  const chat = db
    .prepare(`SELECT assigned_user_id FROM chats WHERE account_id = ? AND jid = ?`)
    .get(accountId, jid) as { assigned_user_id: number | null } | undefined;
  if (!chat || chat.assigned_user_id !== null) return null;

  const agentId = pickAgentForChat(accountId);
  if (agentId === null) return null;
  db.prepare(`UPDATE chats SET assigned_user_id = ? WHERE account_id = ? AND jid = ?`).run(agentId, accountId, jid);
  return agentId;
}

/** Records a status change for agent-performance reports. */
export function logStatusChange(accountId: number, jid: string, status: string, userId: number | null): void {
  db.prepare(`INSERT INTO chat_status_log (account_id, chat_jid, status, user_id, at) VALUES (?, ?, ?, ?, ?)`).run(
    accountId,
    jid,
    status,
    userId,
    Math.floor(Date.now() / 1000)
  );
}
