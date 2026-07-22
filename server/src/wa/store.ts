import { db } from '../db/index.js';

export interface ChatRow {
  account_id: number;
  jid: string;
  name: string | null;
  last_message_at: number | null;
  last_message_preview: string | null;
  unread_count: number;
  status: 'pending' | 'ongoing' | 'resolved';
  assigned_user_id: number | null;
}

export interface StoredMessage {
  account_id: number;
  chat_jid: string;
  msg_id: string;
  from_me: boolean;
  sender_jid: string | null;
  sender_name: string | null;
  type: string;
  text: string | null;
  timestamp: number;
  sent_by_user_id?: number | null;
}

const upsertChatStmt = db.prepare(`
  INSERT INTO chats (account_id, jid, name, last_message_at, last_message_preview, unread_count, status)
  VALUES (@account_id, @jid, @name, @last_message_at, @last_message_preview, @unread_inc, @status)
  ON CONFLICT (account_id, jid) DO UPDATE SET
    name = COALESCE(excluded.name, chats.name),
    last_message_at = MAX(COALESCE(chats.last_message_at, 0), COALESCE(excluded.last_message_at, 0)),
    last_message_preview = CASE
      WHEN COALESCE(excluded.last_message_at, 0) >= COALESCE(chats.last_message_at, 0)
      THEN excluded.last_message_preview ELSE chats.last_message_preview END,
    unread_count = chats.unread_count + @unread_inc,
    status = CASE
      WHEN chats.status = 'resolved' AND @reopen = 1 THEN 'pending'
      ELSE chats.status END
`);

const insertMessageStmt = db.prepare(`
  INSERT OR IGNORE INTO messages
    (account_id, chat_jid, msg_id, from_me, sender_jid, sender_name, type, text, timestamp, sent_by_user_id)
  VALUES
    (@account_id, @chat_jid, @msg_id, @from_me, @sender_jid, @sender_name, @type, @text, @timestamp, @sent_by_user_id)
`);

export function saveIncoming(msg: StoredMessage, preview: string, chatName: string | null): boolean {
  const inserted = insertMessageStmt.run({
    ...msg,
    from_me: msg.from_me ? 1 : 0,
    sent_by_user_id: msg.sent_by_user_id ?? null
  });
  if (inserted.changes === 0) return false;
  upsertChatStmt.run({
    account_id: msg.account_id,
    jid: msg.chat_jid,
    name: chatName,
    last_message_at: msg.timestamp,
    last_message_preview: preview,
    unread_inc: msg.from_me ? 0 : 1,
    reopen: msg.from_me ? 0 : 1,
    status: 'pending'
  });
  return true;
}

/** History-sync variant: never bumps unread or reopens resolved chats. */
export function saveHistorical(msg: StoredMessage, preview: string, chatName: string | null): void {
  const inserted = insertMessageStmt.run({
    ...msg,
    from_me: msg.from_me ? 1 : 0,
    sent_by_user_id: null
  });
  if (inserted.changes === 0) return;
  upsertChatStmt.run({
    account_id: msg.account_id,
    jid: msg.chat_jid,
    name: chatName,
    last_message_at: msg.timestamp,
    last_message_preview: preview,
    unread_inc: 0,
    reopen: 0,
    status: 'pending'
  });
}

const historyChatStmt = db.prepare(`
  INSERT INTO chats (account_id, jid, name, last_message_at, last_message_preview, unread_count, status)
  VALUES (@account_id, @jid, @name, @last_message_at, NULL, @unread_count, 'pending')
  ON CONFLICT (account_id, jid) DO UPDATE SET
    name = COALESCE(excluded.name, chats.name),
    last_message_at = MAX(COALESCE(chats.last_message_at, 0), COALESCE(excluded.last_message_at, 0))
`);

/** From history sync: creates/renames chats without touching unread counters of existing rows. */
export function upsertHistoryChat(
  accountId: number,
  jid: string,
  name: string | null,
  lastMessageAt: number | null,
  unreadCount: number
): void {
  historyChatStmt.run({
    account_id: accountId,
    jid,
    name,
    last_message_at: lastMessageAt,
    unread_count: unreadCount
  });
}

export function upsertContact(accountId: number, jid: string, name: string | null): void {
  if (!name) return;
  db.prepare(
    `INSERT INTO contacts (account_id, jid, name) VALUES (?, ?, ?)
     ON CONFLICT (account_id, jid) DO UPDATE SET name = excluded.name`
  ).run(accountId, jid, name);
  db.prepare(`UPDATE chats SET name = ? WHERE account_id = ? AND jid = ? AND (name IS NULL OR name = '')`).run(
    name,
    accountId,
    jid
  );
}

export function setChatName(accountId: number, jid: string, name: string): void {
  db.prepare(`UPDATE chats SET name = ? WHERE account_id = ? AND jid = ?`).run(name, accountId, jid);
}

export function getChat(accountId: number, jid: string): (ChatRow & { tag_ids: number[] }) | undefined {
  const row = db
    .prepare(
      `SELECT c.account_id, c.jid, COALESCE(c.name, ct.name) AS name, c.last_message_at,
              c.last_message_preview, c.unread_count, c.status, c.assigned_user_id
       FROM chats c
       LEFT JOIN contacts ct ON ct.account_id = c.account_id AND ct.jid = c.jid
       WHERE c.account_id = ? AND c.jid = ?`
    )
    .get(accountId, jid) as ChatRow | undefined;
  if (!row) return undefined;
  const tags = db
    .prepare(`SELECT tag_id FROM chat_tags WHERE account_id = ? AND jid = ?`)
    .all(accountId, jid) as { tag_id: number }[];
  return { ...row, tag_ids: tags.map((t) => t.tag_id) };
}

export function setAccountStatus(accountId: number, status: string, phone?: string | null): void {
  if (phone !== undefined) {
    db.prepare(`UPDATE wa_accounts SET status = ?, phone = ? WHERE id = ?`).run(status, phone, accountId);
  } else {
    db.prepare(`UPDATE wa_accounts SET status = ? WHERE id = ?`).run(status, accountId);
  }
}
