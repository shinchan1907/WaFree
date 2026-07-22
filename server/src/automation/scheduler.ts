import { db } from '../db/index.js';
import { sendWebhook } from '../notify.js';
import { getManager } from './index.js';

const TICK_MS = 20000;
const EXPIRE_AFTER_HOURS = 24;

interface ScheduledRow {
  id: number;
  account_id: number;
  chat_jid: string;
  text: string;
  send_at: number;
  created_by: number | null;
}

async function processDue(): Promise<void> {
  const now = Math.floor(Date.now() / 1000);
  const due = db
    .prepare(`SELECT * FROM scheduled_messages WHERE status = 'pending' AND send_at <= ? ORDER BY send_at LIMIT 20`)
    .all(now) as ScheduledRow[];

  for (const item of due) {
    const manager = getManager();
    // Expire messages that could not be delivered for a long time.
    if (now - item.send_at > EXPIRE_AFTER_HOURS * 3600) {
      db.prepare(`UPDATE scheduled_messages SET status = 'failed', error = ? WHERE id = ?`).run(
        'Expired: account was not connected for 24h after the scheduled time',
        item.id
      );
      void sendWebhook('scheduled.failed', { scheduledId: item.id, accountId: item.account_id, jid: item.chat_jid });
      continue;
    }
    if (manager.getStatus(item.account_id) !== 'connected') continue; // retry next tick

    try {
      await manager.sendText(item.account_id, item.chat_jid, item.text, item.created_by ?? 0);
      db.prepare(`UPDATE scheduled_messages SET status = 'sent', sent_at = ? WHERE id = ?`).run(
        Math.floor(Date.now() / 1000),
        item.id
      );
    } catch (err) {
      db.prepare(`UPDATE scheduled_messages SET status = 'failed', error = ? WHERE id = ?`).run(
        (err as Error).message,
        item.id
      );
      void sendWebhook('scheduled.failed', {
        scheduledId: item.id,
        accountId: item.account_id,
        jid: item.chat_jid,
        error: (err as Error).message
      });
    }
  }
}

export function startScheduler(): void {
  setInterval(() => {
    processDue().catch((err) => console.error('[scheduler] tick failed:', err));
  }, TICK_MS);
  console.log('[scheduler] message scheduler running');
}
