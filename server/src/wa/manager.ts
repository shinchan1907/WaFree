import makeWASocket, {
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  DisconnectReason,
  Browsers,
  type WASocket,
  type proto
} from 'baileys';
import { Boom } from '@hapi/boom';
import pino from 'pino';
import QRCode from 'qrcode';
import fs from 'node:fs';
import path from 'node:path';
import type { Server as SocketServer } from 'socket.io';
import { config } from '../config.js';
import { db } from '../db/index.js';
import { extractContent, isTrackableJid } from './messageText.js';
import {
  saveIncoming,
  saveHistorical,
  upsertContact,
  upsertHistoryChat,
  setChatName,
  getChat,
  setAccountStatus,
  canonicalJid,
  storeLidMapping
} from './store.js';
import { sendWebhook } from '../notify.js';
import { runBots } from '../automation/botEngine.js';
import { runAutoReplies } from '../automation/autoReply.js';

const logger = pino({ level: 'warn' });
const RECONNECT_DELAY_MS = 5000;

type AccountStatus = 'disconnected' | 'connecting' | 'qr' | 'connected' | 'logged_out';

interface Session {
  accountId: number;
  sock: WASocket | null;
  status: AccountStatus;
  qrDataUrl: string | null;
  stopping: boolean;
}

export class WaManager {
  private sessions = new Map<number, Session>();
  private io: SocketServer;

  constructor(io: SocketServer) {
    this.io = io;
  }

  private sessionDir(accountId: number): string {
    return path.join(config.dataDir, 'sessions', String(accountId));
  }

  /** Emits to everyone with access to the account (executives in room + all admins). */
  private emitAccount(accountId: number, event: string, payload: unknown): void {
    this.io.to(`account:${accountId}`).to('admins').emit(event, payload);
  }

  /** Public helper for routes: push the current chat row to all viewers. */
  broadcastChat(accountId: number, jid: string): void {
    this.emitAccount(accountId, 'chat:updated', { accountId, chat: getChat(accountId, jid) });
  }

  private setStatus(accountId: number, status: AccountStatus, phone?: string | null): void {
    const s = this.sessions.get(accountId);
    if (s) s.status = status;
    setAccountStatus(accountId, status, phone);
    this.emitAccount(accountId, 'account:status', { accountId, status, phone: phone ?? undefined });
  }

  getStatus(accountId: number): AccountStatus {
    return this.sessions.get(accountId)?.status ?? 'disconnected';
  }

  getQr(accountId: number): string | null {
    return this.sessions.get(accountId)?.qrDataUrl ?? null;
  }

  /** Restore all sessions that already have credentials (on server boot). */
  async restoreAll(): Promise<void> {
    const accounts = db.prepare(`SELECT id FROM wa_accounts`).all() as { id: number }[];
    for (const { id } of accounts) {
      const credsFile = path.join(this.sessionDir(id), 'creds.json');
      if (fs.existsSync(credsFile)) {
        this.start(id).catch((err) => console.error(`[wa:${id}] restore failed:`, err));
      } else {
        setAccountStatus(id, 'disconnected');
      }
    }
  }

  async start(accountId: number, force: boolean = false): Promise<void> {
    const existing = this.sessions.get(accountId);
    if (existing) {
      if (!force) {
        if (existing.status === 'connected') return;
        if (existing.status === 'qr' && existing.qrDataUrl) return;
      }
      // Clean up stale socket session before starting fresh
      existing.stopping = true;
      try {
        existing.sock?.end(undefined);
      } catch {
        // ignore close error
      }
      this.sessions.delete(accountId);
    }

    if (force) {
      // Wipe old auth credentials folder so Baileys generates a fresh QR code
      this.clearCredentials(accountId);
    }

    const session: Session = { accountId, sock: null, status: 'connecting', qrDataUrl: null, stopping: false };
    this.sessions.set(accountId, session);
    this.setStatus(accountId, 'connecting');

    const dir = this.sessionDir(accountId);
    fs.mkdirSync(dir, { recursive: true });

    // Fast timeout for version fetch so server boot / pairing never hangs
    const { version } = await Promise.race([
      fetchLatestBaileysVersion(),
      new Promise<{ version: [number, number, number] }>((resolve) =>
        setTimeout(() => resolve({ version: [2, 3000, 1035194821] as [number, number, number] }), 2500)
      )
    ]).catch(() => ({ version: [2, 3000, 1035194821] as [number, number, number] }));

    const { state, saveCreds } = await useMultiFileAuthState(dir);

    const sock = makeWASocket({
      version,
      auth: state,
      logger,
      // Use Ubuntu Chrome browser profile to prevent 428 disconnection errors
      browser: Browsers.ubuntu('Chrome'),
      markOnlineOnConnect: false,
      syncFullHistory: true,
      generateHighQualityLinkPreview: false
    });
    session.sock = sock;

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        session.qrDataUrl = await QRCode.toDataURL(qr, { margin: 1, width: 300 });
        session.status = 'qr';
        setAccountStatus(accountId, 'qr');
        // QR grants full account takeover — emit to admins and account room.
        this.io.to('admins').emit('account:qr', { accountId, qr: session.qrDataUrl });
        this.emitAccount(accountId, 'account:qr', { accountId, qr: session.qrDataUrl });
        this.emitAccount(accountId, 'account:status', { accountId, status: 'qr' });
      }

      if (connection === 'open') {
        session.qrDataUrl = null;
        const phone = sock.user?.id?.split(':')[0]?.split('@')[0] ?? null;
        this.setStatus(accountId, 'connected', phone);
        console.log(`[wa:${accountId}] connected as ${phone}`);
        void sendWebhook('account.connected', { account: this.accountInfo(accountId) });
      }

      if (connection === 'close') {
        const code = (lastDisconnect?.error as Boom | undefined)?.output?.statusCode;
        const loggedOut = code === DisconnectReason.loggedOut || code === 401 || code === 428;
        session.qrDataUrl = null;
        if (session.stopping) {
          this.setStatus(accountId, 'disconnected');
          return;
        }
        if (loggedOut) {
          console.log(`[wa:${accountId}] session ended (code ${code}) — clearing credentials`);
          this.clearCredentials(accountId);
          this.setStatus(accountId, 'logged_out');
          void sendWebhook('account.logged_out', {
            account: this.accountInfo(accountId),
            message: 'WhatsApp session was logged out. Re-scan the QR code to reconnect.'
          });
          return;
        }
        console.log(`[wa:${accountId}] connection closed (code ${code}) — reconnecting`);
        this.setStatus(accountId, 'connecting');
        setTimeout(() => {
          this.sessions.delete(accountId);
          this.start(accountId).catch((err) => console.error(`[wa:${accountId}] reconnect failed:`, err));
        }, RECONNECT_DELAY_MS);
      }
    });

    sock.ev.on('messages.upsert', async ({ messages, type }) => {
      if (type !== 'notify' && type !== 'append') return;
      for (const m of messages) {
        this.handleMessage(accountId, sock, m, false);
      }
    });

    sock.ev.on('messaging-history.set', ({ chats, messages, contacts }) => {
      for (const c of contacts ?? []) this.storeContact(accountId, c);
      for (const ch of chats ?? []) {
        if (!isTrackableJid(ch.id)) continue;
        upsertHistoryChat(
          accountId,
          canonicalJid(accountId, ch.id),
          ch.name || null,
          Number(ch.conversationTimestamp) || null,
          Number(ch.unreadCount) || 0
        );
      }
      for (const m of messages ?? []) {
        this.handleMessage(accountId, sock, m, true);
      }
      // History arrives in several batches — let clients refetch the chat list.
      this.emitAccount(accountId, 'chats:refresh', { accountId });
    });

    sock.ev.on('contacts.upsert', (contacts) => {
      for (const c of contacts) this.storeContact(accountId, c);
    });

    sock.ev.on('contacts.update', (contacts) => {
      for (const c of contacts) this.storeContact(accountId, c as (typeof contacts)[number] & { id: string });
    });

    sock.ev.on('chats.upsert', (chats) => {
      for (const ch of chats) {
        if (!isTrackableJid(ch.id) || !ch.name) continue;
        setChatName(accountId, ch.id, ch.name);
      }
    });
  }

  private handleMessage(
    accountId: number,
    sock: WASocket,
    m: proto.IWebMessageInfo,
    historical: boolean
  ): void {
    try {
      const rawJid = m.key?.remoteJid;
      if (!isTrackableJid(rawJid)) return;
      const jid = canonicalJid(accountId, rawJid);
      const content = extractContent(m.message);
      if (!content || !m.key?.id) return;

      const fromMe = Boolean(m.key.fromMe);
      const timestamp = Number(m.messageTimestamp) || Math.floor(Date.now() / 1000);
      const senderJid = m.key.participant || (fromMe ? null : jid);
      const senderName = m.pushName || null;
      const chatName = !fromMe && !jid.endsWith('@g.us') ? senderName : null;

      const stored = {
        account_id: accountId,
        chat_jid: jid,
        msg_id: m.key.id,
        from_me: fromMe,
        sender_jid: senderJid,
        sender_name: senderName,
        type: content.type,
        text: content.text ?? content.preview,
        timestamp
      };

      if (historical) {
        saveHistorical(stored, content.preview, chatName);
        return;
      }

      const isNew = saveIncoming(stored, content.preview, chatName);
      if (!isNew) return;

      if (jid.endsWith('@g.us')) this.ensureGroupName(accountId, sock, jid);

      this.emitAccount(accountId, 'message:new', {
        accountId,
        chatJid: jid,
        message: {
          msg_id: stored.msg_id,
          from_me: fromMe,
          sender_jid: senderJid,
          sender_name: senderName,
          type: content.type,
          text: stored.text,
          timestamp
        }
      });
      this.emitAccount(accountId, 'chat:updated', { accountId, chat: getChat(accountId, jid) });

      // Automation: bots first, then simple auto-replies (customer messages only).
      if (!fromMe && stored.text) {
        this.runAutomation(accountId, jid, stored.text);
      }
    } catch (err) {
      console.error(`[wa:${accountId}] failed to handle message:`, err);
    }
  }

  private runAutomation(accountId: number, jid: string, text: string): void {
    runBots(accountId, jid, text, jid.endsWith('@g.us'))
      .then((handled) => (handled ? true : runAutoReplies(accountId, jid, text)))
      .catch((err) => console.warn(`[wa:${accountId}] automation error:`, (err as Error).message));
  }

  private accountInfo(accountId: number): { id: number; label: string; phone: string | null } | null {
    const row = db.prepare(`SELECT id, label, phone FROM wa_accounts WHERE id = ?`).get(accountId) as
      | { id: number; label: string; phone: string | null }
      | undefined;
    return row ?? null;
  }

  /**
   * Stores a contact name under its phone-number JID and, when present, its
   * LID (privacy alias) JID — chats addressed by LID resolve names this way.
   */
  private storeContact(
    accountId: number,
    c: { id: string; lid?: string; name?: string | null; notify?: string | null; verifiedName?: string | null }
  ): void {
    const name = c.name || c.verifiedName || c.notify || null;
    if (name) {
      if (isTrackableJid(c.id)) upsertContact(accountId, c.id, name);
      if (typeof c.lid === 'string' && isTrackableJid(c.lid)) upsertContact(accountId, c.lid, name);
    }
    // Learn lid ↔ phone-number pairs so split conversations get merged.
    if (typeof c.lid === 'string' && c.lid.endsWith('@lid') && c.id.endsWith('@s.whatsapp.net')) {
      storeLidMapping(accountId, c.lid, c.id);
    }
  }

  private groupNameFetched = new Set<string>();

  private ensureGroupName(accountId: number, sock: WASocket, jid: string): void {
    const key = `${accountId}:${jid}`;
    if (this.groupNameFetched.has(key)) return;
    this.groupNameFetched.add(key);
    const chat = getChat(accountId, jid);
    if (chat?.name) return;
    sock
      .groupMetadata(jid)
      .then((meta) => {
        if (meta.subject) {
          setChatName(accountId, jid, meta.subject);
          this.emitAccount(accountId, 'chat:updated', { accountId, chat: getChat(accountId, jid) });
        }
      })
      .catch(() => this.groupNameFetched.delete(key));
  }

  async sendText(
    accountId: number,
    jid: string,
    text: string,
    userId: number
  ): Promise<{ msgId: string; timestamp: number }> {
    const session = this.sessions.get(accountId);
    if (!session?.sock || session.status !== 'connected') {
      throw new Error('WhatsApp account is not connected');
    }
    const sent = await session.sock.sendMessage(jid, { text });
    if (!sent?.key?.id) throw new Error('Send failed');
    const timestamp = Number(sent.messageTimestamp) || Math.floor(Date.now() / 1000);

    saveIncoming(
      {
        account_id: accountId,
        chat_jid: jid,
        msg_id: sent.key.id,
        from_me: true,
        sender_jid: null,
        sender_name: null,
        type: 'text',
        text,
        timestamp,
        sent_by_user_id: userId
      },
      text,
      null
    );
    // Agent replied — chat moves to ongoing unless already resolved manually afterwards.
    db.prepare(
      `UPDATE chats SET status = 'ongoing' WHERE account_id = ? AND jid = ? AND status = 'pending'`
    ).run(accountId, jid);

    this.emitAccount(accountId, 'message:new', {
      accountId,
      chatJid: jid,
      message: {
        msg_id: sent.key.id,
        from_me: true,
        sender_jid: null,
        sender_name: null,
        type: 'text',
        text,
        timestamp,
        sent_by_user_id: userId
      }
    });
    this.emitAccount(accountId, 'chat:updated', { accountId, chat: getChat(accountId, jid) });
    return { msgId: sent.key.id, timestamp };
  }

  async logout(accountId: number): Promise<void> {
    const session = this.sessions.get(accountId);
    if (session?.sock) {
      session.stopping = true;
      await session.sock.logout().catch(() => undefined);
      session.sock.end(undefined);
    }
    this.sessions.delete(accountId);
    this.clearCredentials(accountId);
    this.setStatus(accountId, 'logged_out');
  }

  async stop(accountId: number): Promise<void> {
    const session = this.sessions.get(accountId);
    if (session?.sock) {
      session.stopping = true;
      session.sock.end(undefined);
    }
    this.sessions.delete(accountId);
    this.setStatus(accountId, 'disconnected');
  }

  private clearCredentials(accountId: number): void {
    fs.rmSync(this.sessionDir(accountId), { recursive: true, force: true });
  }
}
