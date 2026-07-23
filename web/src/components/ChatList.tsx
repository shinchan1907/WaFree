import { useMemo, useState } from 'react';
import type { Account, Chat, Tag } from '../types';
import type { TabFilter } from '../pages/ChatApp';
import { chatDisplayName, formatChatListDate } from '../lib/format';
import Avatar from './Avatar';

const TABS: { key: TabFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'pending', label: 'Pending' },
  { key: 'ongoing', label: 'Ongoing' },
  { key: 'resolved', label: 'Resolved' }
];

interface Props {
  chats: Chat[];
  loading: boolean;
  account: Account | null;
  activeJid: string | null;
  tags: Tag[];
  onOpenChat: (jid: string) => void;
}

export default function ChatList({ chats, loading, account, activeJid, tags, onOpenChat }: Props) {
  const [tab, setTab] = useState<TabFilter>('all');
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return chats.filter((c) => {
      if (tab !== 'all' && c.status !== tab) return false;
      if (!q) return true;
      return (
        chatDisplayName(c.name, c.jid).toLowerCase().includes(q) ||
        c.jid.includes(q) ||
        (c.last_message_preview ?? '').toLowerCase().includes(q)
      );
    });
  }, [chats, tab, query]);

  const counts = useMemo(() => {
    const c = { pending: 0, ongoing: 0, resolved: 0 };
    for (const chat of chats) c[chat.status]++;
    return c;
  }, [chats]);

  return (
    <aside className="chat-list-pane">
      <header className="pane-header">
        <div className="pane-title">
          {account ? (
            <>
              <span className="account-dot" style={{ background: account.color }} />
              <div>
                <div className="pane-title-label">{account.label}</div>
                <div className="pane-title-sub">
                  {account.phone ? `+${account.phone}` : ''} <span className={`conn conn-${account.status}`}>{account.status}</span>
                </div>
              </div>
            </>
          ) : (
            <div className="pane-title-label">Chats</div>
          )}
        </div>
      </header>

      <div className="search-row">
        <div className="search-box">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="#8696a0">
            <path d="M15.5 14h-.8l-.3-.3a6.5 6.5 0 1 0-.7.7l.3.3v.8l5 5 1.5-1.5-5-5zm-6 0a4.5 4.5 0 1 1 0-9 4.5 4.5 0 0 1 0 9z" />
          </svg>
          <input
            placeholder="Search or start new chat"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      </div>

      <div className="filter-tabs">
        {TABS.map((t) => (
          <button
            key={t.key}
            className={`filter-tab ${tab === t.key ? 'active' : ''}`}
            onClick={() => setTab(t.key)}
          >
            {t.label}
            {t.key !== 'all' && counts[t.key] > 0 && <span className="tab-count">{counts[t.key]}</span>}
          </button>
        ))}
      </div>

      <div className="chat-list">
        {loading && <div className="list-empty">Loading chats…</div>}
        {!loading && filtered.length === 0 && (
          <div className="list-empty">{chats.length === 0 ? 'No conversations yet' : 'No chats match'}</div>
        )}
        {filtered.map((c) => {
          const name = chatDisplayName(c.name, c.jid);
          return (
            <button
              key={c.jid}
              className={`chat-item ${c.jid === activeJid ? 'active' : ''}`}
              onClick={() => onOpenChat(c.jid)}
            >
              <Avatar accountId={c.account_id} jid={c.jid} name={name} size={44} />
              <div className="chat-item-body">
                <div className="chat-item-top">
                  <span className="chat-item-name">{name}</span>
                  <span className={`chat-item-time ${c.unread_count > 0 ? 'unread' : ''}`}>
                    {formatChatListDate(c.last_message_at)}
                  </span>
                </div>
                <div className="chat-item-bottom">
                  <span className="chat-item-preview">{c.last_message_preview ?? ''}</span>
                  <span className="chat-item-badges">
                    {(c.tag_ids ?? []).slice(0, 3).map((tid) => {
                      const tag = tags.find((t) => t.id === tid);
                      return tag ? (
                        <span key={tid} className="tag-dot" style={{ background: tag.color }} title={tag.name} />
                      ) : null;
                    })}
                    <span className={`status-chip chip-${c.status}`}>{c.status}</span>
                    {c.unread_count > 0 && <span className="unread-badge">{c.unread_count}</span>}
                  </span>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </aside>
  );
}
