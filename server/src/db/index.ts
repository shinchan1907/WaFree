import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { config } from '../config.js';

fs.mkdirSync(config.dataDir, { recursive: true });

export const db = new Database(path.join(config.dataDir, 'wafree.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin','executive')),
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS wa_accounts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  label TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#00a884',
  phone TEXT,
  status TEXT NOT NULL DEFAULT 'disconnected',
  max_agents INTEGER NOT NULL DEFAULT 2,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS assignments (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  account_id INTEGER NOT NULL REFERENCES wa_accounts(id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, account_id)
);

CREATE TABLE IF NOT EXISTS chats (
  account_id INTEGER NOT NULL,
  jid TEXT NOT NULL,
  name TEXT,
  last_message_at INTEGER,
  last_message_preview TEXT,
  unread_count INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','ongoing','resolved')),
  assigned_user_id INTEGER,
  PRIMARY KEY (account_id, jid)
);

CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  account_id INTEGER NOT NULL,
  chat_jid TEXT NOT NULL,
  msg_id TEXT NOT NULL,
  from_me INTEGER NOT NULL,
  sender_jid TEXT,
  sender_name TEXT,
  type TEXT NOT NULL,
  text TEXT,
  timestamp INTEGER NOT NULL,
  sent_by_user_id INTEGER,
  UNIQUE (account_id, chat_jid, msg_id)
);
CREATE INDEX IF NOT EXISTS idx_messages_chat ON messages (account_id, chat_jid, timestamp);

CREATE TABLE IF NOT EXISTS contacts (
  account_id INTEGER NOT NULL,
  jid TEXT NOT NULL,
  name TEXT,
  PRIMARY KEY (account_id, jid)
);

CREATE TABLE IF NOT EXISTS quick_replies (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  account_id INTEGER,
  shortcut TEXT NOT NULL,
  text TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS tags (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT UNIQUE NOT NULL,
  color TEXT NOT NULL DEFAULT '#53bdeb'
);

CREATE TABLE IF NOT EXISTS chat_tags (
  account_id INTEGER NOT NULL,
  jid TEXT NOT NULL,
  tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (account_id, jid, tag_id)
);

CREATE TABLE IF NOT EXISTS scheduled_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  account_id INTEGER NOT NULL,
  chat_jid TEXT NOT NULL,
  text TEXT NOT NULL,
  send_at INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','sent','failed','cancelled')),
  error TEXT,
  created_by INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  sent_at INTEGER
);
CREATE INDEX IF NOT EXISTS idx_sched_due ON scheduled_messages (status, send_at);

CREATE TABLE IF NOT EXISTS auto_replies (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  account_id INTEGER,
  name TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1,
  trigger_type TEXT NOT NULL DEFAULT 'keyword' CHECK (trigger_type IN ('keyword','all')),
  keywords TEXT,
  match_mode TEXT NOT NULL DEFAULT 'contains' CHECK (match_mode IN ('contains','exact','starts')),
  response_type TEXT NOT NULL DEFAULT 'text' CHECK (response_type IN ('text','ai')),
  reply_text TEXT,
  ai_prompt TEXT,
  cooldown_minutes INTEGER NOT NULL DEFAULT 60,
  only_individual INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS auto_reply_log (
  rule_id INTEGER NOT NULL,
  account_id INTEGER NOT NULL,
  jid TEXT NOT NULL,
  last_sent_at INTEGER NOT NULL,
  PRIMARY KEY (rule_id, account_id, jid)
);

CREATE TABLE IF NOT EXISTS bots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  account_id INTEGER,
  name TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 0,
  flow TEXT NOT NULL DEFAULT '{"nodes":[],"edges":[]}',
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
`;

db.exec(SCHEMA);
