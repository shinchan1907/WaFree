import { Fragment, useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../api';
import { getSocket } from '../socket';
import type { Account, Agent, Chat, ChatStatus, Message, QuickReply, Tag } from '../types';
import { avatarColor, chatDisplayName, formatDaySeparator, formatTime, initials, jidSubtitle } from '../lib/format';
import Composer from './Composer';

interface Props {
  account: Account;
  chat: Chat;
  tags: Tag[];
  quickReplies: QuickReply[];
}

function dayKey(ts: number): string {
  return new Date(ts * 1000).toDateString();
}

export default function ChatWindow({ account, chat, tags, quickReplies }: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [sendError, setSendError] = useState('');
  const [tagMenuOpen, setTagMenuOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const stickToBottom = useRef(true);

  const chatUrl = `/api/accounts/${account.id}/chats/${encodeURIComponent(chat.jid)}`;
  const name = chatDisplayName(chat.name, chat.jid);
  const isGroup = chat.jid.endsWith('@g.us');

  useEffect(() => {
    api
      .get<Message[]>(`${chatUrl}/messages`)
      .then((res) => {
        setMessages(res.data);
        setHasMore(Boolean(res.meta?.hasMore));
      })
      .catch(console.error);
    api
      .get<Agent[]>(`/api/accounts/${account.id}/agents`)
      .then((res) => setAgents(res.data))
      .catch(() => setAgents([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;
    const onMessage = (payload: { accountId: number; chatJid: string; message: Message }) => {
      if (payload.accountId !== account.id || payload.chatJid !== chat.jid) return;
      setMessages((prev) =>
        prev.some((m) => m.msg_id === payload.message.msg_id) ? prev : [...prev, payload.message]
      );
    };
    socket.on('message:new', onMessage);
    return () => {
      socket.off('message:new', onMessage);
    };
  }, [account.id, chat.jid]);

  useEffect(() => {
    if (stickToBottom.current && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const onScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
  };

  const loadOlder = async () => {
    if (!messages.length || loadingOlder) return;
    setLoadingOlder(true);
    try {
      const oldest = messages[0].timestamp;
      const res = await api.get<Message[]>(`${chatUrl}/messages?before=${oldest}`);
      const el = scrollRef.current;
      const prevHeight = el?.scrollHeight ?? 0;
      setMessages((prev) => {
        const known = new Set(prev.map((m) => m.msg_id));
        return [...res.data.filter((m) => !known.has(m.msg_id)), ...prev];
      });
      setHasMore(Boolean(res.meta?.hasMore));
      requestAnimationFrame(() => {
        if (el) el.scrollTop = el.scrollHeight - prevHeight;
      });
    } finally {
      setLoadingOlder(false);
    }
  };

  const send = useCallback(
    async (text: string) => {
      setSendError('');
      try {
        await api.post(`${chatUrl}/messages`, { text });
        stickToBottom.current = true;
      } catch (err) {
        setSendError(err instanceof Error ? err.message : 'Failed to send');
        throw err;
      }
    },
    [chatUrl]
  );

  const updateChat = async (patch: { status?: ChatStatus; assigned_user_id?: number | null }) => {
    await api.patch(chatUrl, patch).catch(console.error);
  };

  const toggleTag = async (tagId: number) => {
    const current = chat.tag_ids ?? [];
    const next = current.includes(tagId) ? current.filter((id) => id !== tagId) : [...current, tagId];
    await api.put(`${chatUrl}/tags`, { tag_ids: next }).catch(console.error);
  };

  const schedule = useCallback(
    async (text: string, sendAtSeconds: number) => {
      setSendError('');
      try {
        await api.post(`${chatUrl}/schedule`, { text, send_at: sendAtSeconds });
      } catch (err) {
        setSendError(err instanceof Error ? err.message : 'Failed to schedule');
        throw err;
      }
    },
    [chatUrl]
  );

  const chatTags = (chat.tag_ids ?? [])
    .map((id) => tags.find((t) => t.id === id))
    .filter((t): t is Tag => Boolean(t));

  let lastDay = '';

  return (
    <section className="chat-window">
      <header className="chat-header">
        <div className="avatar" style={{ background: avatarColor(chat.jid) }}>
          {initials(name)}
        </div>
        <div className="chat-header-info">
          <div className="chat-header-name">{name}</div>
          <div className="chat-header-sub">
            {jidSubtitle(chat.jid)}
            <span className="account-badge" style={{ borderColor: account.color, color: account.color }}>
              <span className="account-dot" style={{ background: account.color }} />
              {account.label}
            </span>
            {chatTags.map((t) => (
              <span key={t.id} className="tag-chip" style={{ background: `${t.color}26`, color: t.color }}>
                {t.name}
              </span>
            ))}
            <span className="tag-menu-wrap">
              <button className="tag-add-btn" title="Tags" onClick={() => setTagMenuOpen((o) => !o)}>
                🏷️+
              </button>
              {tagMenuOpen && (
                <span className="tag-menu">
                  {tags.length === 0 && <span className="muted">No tags defined (Admin → Tags)</span>}
                  {tags.map((t) => (
                    <button
                      key={t.id}
                      className={`tag-menu-item ${(chat.tag_ids ?? []).includes(t.id) ? 'active' : ''}`}
                      onClick={() => void toggleTag(t.id)}
                    >
                      <span className="tag-dot" style={{ background: t.color }} />
                      {t.name}
                      {(chat.tag_ids ?? []).includes(t.id) && ' ✓'}
                    </button>
                  ))}
                </span>
              )}
            </span>
          </div>
        </div>
        <div className="chat-header-actions">
          <select
            className="assign-select"
            value={chat.assigned_user_id ?? ''}
            onChange={(e) => updateChat({ assigned_user_id: e.target.value ? Number(e.target.value) : null })}
            title="Assigned agent"
          >
            <option value="">Unassigned</option>
            {agents.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
          <div className="status-buttons">
            {(['pending', 'ongoing', 'resolved'] as ChatStatus[]).map((s) => (
              <button
                key={s}
                className={`status-btn chip-${s} ${chat.status === s ? 'active' : ''}`}
                onClick={() => updateChat({ status: s })}
              >
                {s === 'pending' ? 'Pending' : s === 'ongoing' ? 'On-going' : 'Resolved'}
              </button>
            ))}
          </div>
        </div>
      </header>

      <div className="messages-area" ref={scrollRef} onScroll={onScroll}>
        {hasMore && (
          <div className="load-older">
            <button onClick={loadOlder} disabled={loadingOlder}>
              {loadingOlder ? 'Loading…' : 'Load older messages'}
            </button>
          </div>
        )}
        {messages.map((m) => {
          const fromMe = Boolean(m.from_me);
          const day = dayKey(m.timestamp);
          const showDay = day !== lastDay;
          lastDay = day;
          return (
            <Fragment key={m.msg_id}>
              {showDay && (
                <div className="day-separator">
                  <span>{formatDaySeparator(m.timestamp)}</span>
                </div>
              )}
              <div className={`bubble-row ${fromMe ? 'out' : 'in'}`}>
                <div className={`bubble ${fromMe ? 'bubble-out' : 'bubble-in'}`}>
                  {isGroup && !fromMe && m.sender_name && (
                    <div className="bubble-sender" style={{ color: avatarColor(m.sender_jid ?? '') }}>
                      {m.sender_name}
                    </div>
                  )}
                  {m.type !== 'text' && <div className="bubble-type">{m.type.toUpperCase()}</div>}
                  <span className="bubble-text">{m.text ?? ''}</span>
                  <span className="bubble-time">{formatTime(m.timestamp)}</span>
                </div>
              </div>
            </Fragment>
          );
        })}
      </div>

      {sendError && <div className="send-error">{sendError}</div>}
      <Composer
        onSend={send}
        onSchedule={schedule}
        quickReplies={quickReplies}
        disabled={account.status !== 'connected'}
        disabledHint={account.status !== 'connected' ? `WhatsApp "${account.label}" is ${account.status}` : ''}
      />
    </section>
  );
}
