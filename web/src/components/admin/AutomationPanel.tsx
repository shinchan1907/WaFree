import { useCallback, useEffect, useState } from 'react';
import { api } from '../../api';
import type { Account, AutoReply, ScheduledMessage } from '../../types';
import { formatTime } from '../../lib/format';

const EMPTY_FORM = {
  name: '',
  account_id: '' as string,
  trigger_type: 'keyword' as 'keyword' | 'all',
  keywords: '',
  match_mode: 'contains' as 'contains' | 'exact' | 'starts',
  response_type: 'text' as 'text' | 'ai',
  reply_text: '',
  ai_prompt: '',
  cooldown_minutes: 60
};

export default function AutomationPanel() {
  const [rules, setRules] = useState<AutoReply[]>([]);
  const [scheduled, setScheduled] = useState<ScheduledMessage[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    const [r, s, a] = await Promise.all([
      api.get<AutoReply[]>('/api/automation/auto-replies'),
      api.get<ScheduledMessage[]>('/api/automation/scheduled'),
      api.get<Account[]>('/api/accounts')
    ]);
    setRules(r.data);
    setScheduled(s.data);
    setAccounts(a.data);
  }, []);

  useEffect(() => {
    load().catch(console.error);
  }, [load]);

  const createRule = async () => {
    setError('');
    try {
      await api.post('/api/automation/auto-replies', {
        ...form,
        account_id: form.account_id ? Number(form.account_id) : null
      });
      setForm({ ...EMPTY_FORM });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create rule');
    }
  };

  const toggleRule = async (rule: AutoReply) => {
    await api.patch(`/api/automation/auto-replies/${rule.id}`, { enabled: !rule.enabled }).catch(console.error);
    await load();
  };

  const deleteRule = async (id: number) => {
    if (!window.confirm('Delete this auto-reply rule?')) return;
    await api.del(`/api/automation/auto-replies/${id}`).catch(console.error);
    await load();
  };

  const cancelScheduled = async (id: number) => {
    await api.del(`/api/automation/scheduled/${id}`).catch(console.error);
    await load();
  };

  const accountLabel = (id: number | null) =>
    id === null ? 'All WhatsApps' : accounts.find((a) => a.id === id)?.label ?? `#${id}`;

  const fmtDateTime = (ts: number) => `${new Date(ts * 1000).toLocaleDateString()} ${formatTime(ts)}`;

  return (
    <div className="panel">
      {error && <div className="form-error">{error}</div>}

      <div className="card">
        <h3>⚡ New auto-reply rule</h3>
        <p className="muted">
          Replies automatically to incoming customer messages. Keyword rules answer specific questions; "every
          message" rules make great out-of-office or welcome messages. AI responses use the model configured in
          Settings.
        </p>
        <div className="settings-grid">
          <label className="settings-field">
            <span>Rule name</span>
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Welcome message" />
          </label>
          <label className="settings-field">
            <span>WhatsApp account</span>
            <select value={form.account_id} onChange={(e) => setForm({ ...form, account_id: e.target.value })}>
              <option value="">All WhatsApps</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.label}
                </option>
              ))}
            </select>
          </label>
          <label className="settings-field">
            <span>Trigger</span>
            <select
              value={form.trigger_type}
              onChange={(e) => setForm({ ...form, trigger_type: e.target.value as 'keyword' | 'all' })}
            >
              <option value="keyword">Keyword match</option>
              <option value="all">Every incoming message</option>
            </select>
          </label>
          {form.trigger_type === 'keyword' && (
            <>
              <label className="settings-field">
                <span>Keywords (comma separated)</span>
                <input
                  value={form.keywords}
                  onChange={(e) => setForm({ ...form, keywords: e.target.value })}
                  placeholder="price, pricing, cost"
                />
              </label>
              <label className="settings-field">
                <span>Match mode</span>
                <select
                  value={form.match_mode}
                  onChange={(e) => setForm({ ...form, match_mode: e.target.value as typeof form.match_mode })}
                >
                  <option value="contains">Contains</option>
                  <option value="exact">Exact message</option>
                  <option value="starts">Starts with</option>
                </select>
              </label>
            </>
          )}
          <label className="settings-field">
            <span>Response type</span>
            <select
              value={form.response_type}
              onChange={(e) => setForm({ ...form, response_type: e.target.value as 'text' | 'ai' })}
            >
              <option value="text">Fixed text</option>
              <option value="ai">AI generated</option>
            </select>
          </label>
          <label className="settings-field">
            <span>Cooldown (minutes per contact)</span>
            <input
              type="number"
              min={0}
              value={form.cooldown_minutes}
              onChange={(e) => setForm({ ...form, cooldown_minutes: Number(e.target.value) })}
            />
          </label>
          {form.response_type === 'text' ? (
            <label className="settings-field wide">
              <span>Reply text</span>
              <textarea
                rows={2}
                value={form.reply_text}
                onChange={(e) => setForm({ ...form, reply_text: e.target.value })}
                placeholder="Thanks for reaching out! Our team will reply shortly."
              />
            </label>
          ) : (
            <label className="settings-field wide">
              <span>Extra AI instructions (optional)</span>
              <textarea
                rows={2}
                value={form.ai_prompt}
                onChange={(e) => setForm({ ...form, ai_prompt: e.target.value })}
                placeholder="Answer pricing questions using: Basic plan $9/mo, Pro plan $29/mo."
              />
            </label>
          )}
        </div>
        <div className="form-row" style={{ marginTop: 12 }}>
          <button
            className="btn-primary"
            onClick={() => void createRule()}
            disabled={!form.name.trim() || (form.response_type === 'text' && !form.reply_text.trim())}
          >
            Add rule
          </button>
        </div>
      </div>

      <div className="card">
        <h3>Auto-reply rules</h3>
        <table className="data-table">
          <thead>
            <tr>
              <th>Rule</th>
              <th>Scope</th>
              <th>Trigger</th>
              <th>Response</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rules.map((r) => (
              <tr key={r.id}>
                <td>{r.name}</td>
                <td>{accountLabel(r.account_id)}</td>
                <td>{r.trigger_type === 'all' ? 'Every message' : `${r.match_mode}: ${r.keywords ?? ''}`}</td>
                <td className="qr-cell">{r.response_type === 'ai' ? '🤖 AI' : r.reply_text}</td>
                <td>
                  <button className={`toggle ${r.enabled ? 'on' : ''}`} onClick={() => void toggleRule(r)}>
                    <span />
                  </button>
                </td>
                <td className="row-actions">
                  <button className="btn-danger" onClick={() => void deleteRule(r.id)}>
                    Delete
                  </button>
                </td>
              </tr>
            ))}
            {rules.length === 0 && (
              <tr>
                <td colSpan={6} className="muted">
                  No auto-reply rules yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="card">
        <h3>🕐 Scheduled messages</h3>
        <p className="muted">Agents schedule messages from the clock icon in any chat.</p>
        <table className="data-table">
          <thead>
            <tr>
              <th>When</th>
              <th>Account</th>
              <th>To</th>
              <th>Message</th>
              <th>Status</th>
              <th>By</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {scheduled.map((s) => (
              <tr key={s.id}>
                <td>{fmtDateTime(s.send_at)}</td>
                <td>{s.account_label}</td>
                <td>{s.chat_name || s.chat_jid.split('@')[0]}</td>
                <td className="qr-cell">{s.text}</td>
                <td>
                  <span className={`sched-status sched-${s.status}`} title={s.error ?? ''}>
                    {s.status}
                  </span>
                </td>
                <td>{s.created_by_name ?? '—'}</td>
                <td className="row-actions">
                  {s.status === 'pending' && (
                    <button className="btn-danger" onClick={() => void cancelScheduled(s.id)}>
                      Cancel
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {scheduled.length === 0 && (
              <tr>
                <td colSpan={7} className="muted">
                  No scheduled messages.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
