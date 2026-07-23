// Integration check for auto-assignment against a throwaway database.
// Run: DATA_DIR=<tmp> npx tsx tests/assignment.integration.mjs
import assert from 'node:assert/strict';
import { db } from '../src/db/index.js';
import { pickAgentForChat, autoAssignChat, logStatusChange } from '../src/automation/assignment.js';

// Arrange: one account with auto-assign on, two agents, uneven load.
db.exec(`DELETE FROM chats; DELETE FROM assignments; DELETE FROM users; DELETE FROM wa_accounts; DELETE FROM chat_status_log;`);
db.prepare(`INSERT INTO wa_accounts (id, label, auto_assign) VALUES (1, 'Test', 1)`).run();
db.prepare(`INSERT INTO users (id, username, password_hash, name, role) VALUES (10, 'a1', 'x', 'Agent One', 'executive')`).run();
db.prepare(`INSERT INTO users (id, username, password_hash, name, role) VALUES (11, 'a2', 'x', 'Agent Two', 'executive')`).run();
db.prepare(`INSERT INTO assignments (user_id, account_id) VALUES (10, 1), (11, 1)`).run();

// Agent 10 already has 2 open chats; agent 11 has none.
db.prepare(`INSERT INTO chats (account_id, jid, status, assigned_user_id) VALUES (1, 'c1@s.whatsapp.net', 'pending', 10)`).run();
db.prepare(`INSERT INTO chats (account_id, jid, status, assigned_user_id) VALUES (1, 'c2@s.whatsapp.net', 'ongoing', 10)`).run();
db.prepare(`INSERT INTO chats (account_id, jid, status, assigned_user_id) VALUES (1, 'c3@s.whatsapp.net', 'pending', NULL)`).run();

// Act + Assert: least-loaded agent (11) gets the new chat.
assert.equal(pickAgentForChat(1), 11, 'least-loaded agent should be picked');
assert.equal(autoAssignChat(1, 'c3@s.whatsapp.net'), 11);
const c3 = db.prepare(`SELECT assigned_user_id FROM chats WHERE jid = 'c3@s.whatsapp.net'`).get();
assert.equal(c3.assigned_user_id, 11);

// Already-assigned chats are never re-assigned.
assert.equal(autoAssignChat(1, 'c3@s.whatsapp.net'), null);

// Auto-assign off → no assignment.
db.prepare(`UPDATE wa_accounts SET auto_assign = 0 WHERE id = 1`).run();
db.prepare(`INSERT INTO chats (account_id, jid, status) VALUES (1, 'c4@s.whatsapp.net', 'pending')`).run();
assert.equal(autoAssignChat(1, 'c4@s.whatsapp.net'), null);

// Status log records resolves for reports.
logStatusChange(1, 'c1@s.whatsapp.net', 'resolved', 10);
const logged = db.prepare(`SELECT COUNT(*) AS c FROM chat_status_log WHERE user_id = 10 AND status = 'resolved'`).get();
assert.equal(logged.c, 1);

console.log('assignment integration: ALL PASS');
