import { useEffect, useState } from 'react';
import { api } from '../api';
import type { Account, Chat, Tag } from '../types';
import { chatDisplayName } from '../lib/format';
import Avatar from './Avatar';

interface ContactInfo {
  jid: string;
  phone: string | null;
  name: string | null;
  is_group: boolean;
  is_lid: boolean;
  status: string | null;
  avatar_url: string | null;
}

interface Props {
  account: Account;
  chat: Chat;
  tags: Tag[];
  onClose: () => void;
}

function CopyField({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      // http (non-secure) context fallback
      const ta = document.createElement('textarea');
      ta.value = value;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <div className="copy-field">
      <div className="copy-field-label">{label}</div>
      <div className="copy-field-row">
        <span className="copy-field-value">{value}</span>
        <button className="copy-btn" onClick={() => void copy()} title="Copy">
          {copied ? (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2.5" strokeLinecap="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          ) : (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="9" y="9" width="13" height="13" rx="2" />
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
            </svg>
          )}
        </button>
        {copied && <span className="copied-hint">Copied!</span>}
      </div>
    </div>
  );
}

export default function ContactPanel({ account, chat, tags, onClose }: Props) {
  const [info, setInfo] = useState<ContactInfo | null>(null);

  useEffect(() => {
    api
      .get<ContactInfo>(`/api/accounts/${account.id}/contact/${encodeURIComponent(chat.jid)}`)
      .then((res) => setInfo(res.data))
      .catch(() => setInfo(null));
  }, [account.id, chat.jid]);

  const name = chatDisplayName(chat.name, chat.jid);
  const chatTags = (chat.tag_ids ?? [])
    .map((id) => tags.find((t) => t.id === id))
    .filter((t): t is Tag => Boolean(t));

  return (
    <aside className="contact-panel">
      <div className="contact-panel-head">
        <button className="icon-btn" onClick={onClose} title="Close">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
        <span>Contact info</span>
      </div>

      <div className="contact-panel-body">
        <div className="contact-hero">
          <Avatar accountId={account.id} jid={chat.jid} name={name} size={140} />
          <h2>{name}</h2>
          {info?.phone && <div className="muted">+{info.phone}</div>}
        </div>

        {info?.phone ? (
          <CopyField label="Phone number" value={`+${info.phone}`} />
        ) : info?.is_lid ? (
          <div className="contact-note">
            🔒 This contact uses WhatsApp's privacy mode — their phone number is not shared. You can still chat
            normally.
          </div>
        ) : null}

        <CopyField label="WhatsApp ID" value={chat.jid} />

        <div className="copy-field">
          <div className="copy-field-label">Via WhatsApp account</div>
          <div className="copy-field-row">
            <span className="account-dot" style={{ background: account.color }} />
            <span className="copy-field-value">
              {account.label} {account.phone ? `(+${account.phone})` : ''}
            </span>
          </div>
        </div>

        {chatTags.length > 0 && (
          <div className="copy-field">
            <div className="copy-field-label">Tags</div>
            <div className="copy-field-row" style={{ flexWrap: 'wrap', gap: 6 }}>
              {chatTags.map((t) => (
                <span key={t.id} className="tag-chip" style={{ background: `${t.color}26`, color: t.color }}>
                  {t.name}
                </span>
              ))}
            </div>
          </div>
        )}

        <div className="copy-field">
          <div className="copy-field-label">Conversation status</div>
          <div className="copy-field-row">
            <span className={`status-chip chip-${chat.status}`}>{chat.status}</span>
          </div>
        </div>
      </div>
    </aside>
  );
}
