import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { getSocket } from '../socket';
import { useAuth } from '../AuthContext';
import type { Account, Chat, ChatStatus, QuickReply, Tag } from '../types';
import { initials } from '../lib/format';
import ChatList from '../components/ChatList';
import ChatWindow from '../components/ChatWindow';

export type TabFilter = 'all' | ChatStatus;

export default function ChatApp() {
  const { user, logout } = useAuth();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [activeAccountId, setActiveAccountId] = useState<number | null>(null);
  const [chats, setChats] = useState<Chat[]>([]);
  const [activeJid, setActiveJid] = useState<string | null>(null);
  const [quickReplies, setQuickReplies] = useState<QuickReply[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [loadingChats, setLoadingChats] = useState(false);

  const loadAccounts = useCallback(async () => {
    const res = await api.get<Account[]>('/api/accounts');
    setAccounts(res.data);
    setActiveAccountId((prev) => {
      if (prev && res.data.some((a) => a.id === prev)) return prev;
      return res.data[0]?.id ?? null;
    });
  }, []);

  useEffect(() => {
    loadAccounts().catch(console.error);
    api
      .get<QuickReply[]>('/api/quick-replies')
      .then((r) => setQuickReplies(r.data))
      .catch(console.error);
    api
      .get<Tag[]>('/api/tags')
      .then((r) => setTags(r.data))
      .catch(console.error);
  }, [loadAccounts]);

  useEffect(() => {
    if (!activeAccountId) {
      setChats([]);
      return;
    }
    setLoadingChats(true);
    setActiveJid(null);
    api
      .get<Chat[]>(`/api/accounts/${activeAccountId}/chats`)
      .then((r) => setChats(r.data))
      .catch(console.error)
      .finally(() => setLoadingChats(false));
  }, [activeAccountId]);

  // Realtime: chat rows + account status
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const onChatUpdated = (payload: { accountId: number; chat: Chat | null }) => {
      if (!payload.chat || payload.accountId !== activeAccountId) return;
      setChats((prev) => {
        const idx = prev.findIndex((c) => c.jid === payload.chat!.jid);
        const next = idx >= 0 ? prev.map((c, i) => (i === idx ? payload.chat! : c)) : [...prev, payload.chat!];
        return [...next].sort((a, b) => (b.last_message_at ?? 0) - (a.last_message_at ?? 0));
      });
    };

    const onChatsRefresh = (payload: { accountId: number }) => {
      if (payload.accountId !== activeAccountId) return;
      api
        .get<Chat[]>(`/api/accounts/${payload.accountId}/chats`)
        .then((r) => setChats(r.data))
        .catch(console.error);
    };

    const onAccountStatus = (payload: { accountId: number; status: Account['status']; phone?: string }) => {
      setAccounts((prev) =>
        prev.map((a) =>
          a.id === payload.accountId ? { ...a, status: payload.status, phone: payload.phone ?? a.phone } : a
        )
      );
    };

    socket.on('chat:updated', onChatUpdated);
    socket.on('chats:refresh', onChatsRefresh);
    socket.on('account:status', onAccountStatus);
    return () => {
      socket.off('chat:updated', onChatUpdated);
      socket.off('chats:refresh', onChatsRefresh);
      socket.off('account:status', onAccountStatus);
    };
  }, [activeAccountId]);

  const activeAccount = useMemo(
    () => accounts.find((a) => a.id === activeAccountId) ?? null,
    [accounts, activeAccountId]
  );
  const activeChat = useMemo(() => chats.find((c) => c.jid === activeJid) ?? null, [chats, activeJid]);

  const openChat = useCallback(
    (jid: string) => {
      setActiveJid(jid);
      if (!activeAccountId) return;
      const chat = chats.find((c) => c.jid === jid);
      if (chat && chat.unread_count > 0) {
        api.post(`/api/accounts/${activeAccountId}/chats/${encodeURIComponent(jid)}/read`).catch(console.error);
      }
    },
    [activeAccountId, chats]
  );

  return (
    <div className="app-shell">
      <nav className="account-rail">
        <div className="rail-accounts">
          {accounts.map((a) => (
            <button
              key={a.id}
              className={`rail-account ${a.id === activeAccountId ? 'active' : ''}`}
              style={{ background: a.color }}
              title={`${a.label}${a.phone ? ` (+${a.phone})` : ''} — ${a.status}`}
              onClick={() => setActiveAccountId(a.id)}
            >
              {initials(a.label)}
              <span className={`rail-status-dot st-${a.status}`} />
            </button>
          ))}
          {accounts.length === 0 && <div className="rail-empty">—</div>}
        </div>
        <div className="rail-bottom">
          {user?.role === 'admin' && (
            <Link to="/admin" className="rail-icon" title="Admin panel">
              <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor">
                <path d="M19.4 13a7.9 7.9 0 0 0 .1-1 7.9 7.9 0 0 0-.1-1l2.1-1.7a.5.5 0 0 0 .1-.6l-2-3.5a.5.5 0 0 0-.6-.2l-2.5 1a7.7 7.7 0 0 0-1.7-1l-.4-2.6a.5.5 0 0 0-.5-.4h-4a.5.5 0 0 0-.5.4l-.4 2.6a7.7 7.7 0 0 0-1.7 1l-2.5-1a.5.5 0 0 0-.6.2l-2 3.5a.5.5 0 0 0 .1.6L4.5 11a7.9 7.9 0 0 0 0 2l-2.1 1.7a.5.5 0 0 0-.1.6l2 3.5c.1.2.4.3.6.2l2.5-1a7.7 7.7 0 0 0 1.7 1l.4 2.6c0 .2.2.4.5.4h4c.2 0 .4-.2.5-.4l.4-2.6a7.7 7.7 0 0 0 1.7-1l2.5 1c.2.1.5 0 .6-.2l2-3.5a.5.5 0 0 0-.1-.6L19.4 13zM12 15.5A3.5 3.5 0 1 1 12 8.5a3.5 3.5 0 0 1 0 7z" />
              </svg>
            </Link>
          )}
          <div className="rail-user" title={`${user?.name} (${user?.role})`}>
            {initials(user?.name ?? '?')}
          </div>
          <button className="rail-icon" title="Log out" onClick={logout}>
            <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor">
              <path d="M16 13v-2H7V8l-5 4 5 4v-3h9zm3-10H11a2 2 0 0 0-2 2v3h2V5h8v14h-8v-3H9v3a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2z" />
            </svg>
          </button>
        </div>
      </nav>

      <ChatList
        chats={chats}
        loading={loadingChats}
        account={activeAccount}
        activeJid={activeJid}
        tags={tags}
        onOpenChat={openChat}
      />

      {activeAccount && activeChat ? (
        <ChatWindow
          key={`${activeAccount.id}:${activeChat.jid}`}
          account={activeAccount}
          chat={activeChat}
          tags={tags}
          quickReplies={quickReplies.filter((q) => q.account_id === null || q.account_id === activeAccount.id)}
        />
      ) : (
        <div className="chat-placeholder">
          <div className="placeholder-inner">
            <svg viewBox="0 0 24 24" width="80" height="80" fill="#364147">
              <path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5.1-1.3A10 10 0 1 0 12 2z" />
            </svg>
            <h2>WaFree Dashboard</h2>
            <p>
              {accounts.length === 0
                ? user?.role === 'admin'
                  ? 'No WhatsApp accounts yet. Add one in the Admin panel.'
                  : 'No WhatsApp accounts assigned to you yet. Ask your admin.'
                : 'Select a chat to start messaging.'}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
