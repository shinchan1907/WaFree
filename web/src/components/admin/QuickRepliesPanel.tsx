import { useCallback, useEffect, useState } from 'react';
import { api } from '../../api';
import type { Account, QuickReply } from '../../types';

export default function QuickRepliesPanel() {
  const [replies, setReplies] = useState<QuickReply[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [shortcut, setShortcut] = useState('');
  const [text, setText] = useState('');
  const [accountId, setAccountId] = useState<string>('');
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    const [qr, acc] = await Promise.all([
      api.get<QuickReply[]>('/api/quick-replies'),
      api.get<Account[]>('/api/accounts')
    ]);
    setReplies(qr.data);
    setAccounts(acc.data);
  }, []);

  useEffect(() => {
    load().catch(console.error);
  }, [load]);

  const create = async () => {
    setError('');
    try {
      await api.post('/api/quick-replies', {
        shortcut: shortcut.trim(),
        text: text.trim(),
        account_id: accountId ? Number(accountId) : null
      });
      setShortcut('');
      setText('');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add quick reply');
    }
  };

  const remove = async (id: number) => {
    await api.del(`/api/quick-replies/${id}`).catch(console.error);
    await load();
  };

  return (
    <div className="panel">
      {error && <div className="form-error">{error}</div>}

      <div className="card">
        <h3>Add quick reply</h3>
        <p className="muted">Agents type "/" in the message box to pick these instantly.</p>
        <div className="form-row">
          <input
            placeholder="Shortcut (e.g. greeting)"
            value={shortcut}
            onChange={(e) => setShortcut(e.target.value)}
          />
          <select value={accountId} onChange={(e) => setAccountId(e.target.value)}>
            <option value="">All WhatsApps (global)</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                Only: {a.label}
              </option>
            ))}
          </select>
          <button className="btn-primary" onClick={create} disabled={!shortcut.trim() || !text.trim()}>
            Add
          </button>
        </div>
        <textarea
          className="qr-textarea"
          placeholder="Reply text… e.g. Hello! Thanks for reaching out. How can we help you today?"
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={3}
        />
      </div>

      <div className="card">
        <table className="data-table">
          <thead>
            <tr>
              <th>Shortcut</th>
              <th>Text</th>
              <th>Scope</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {replies.map((q) => (
              <tr key={q.id}>
                <td>
                  <code>/{q.shortcut}</code>
                </td>
                <td className="qr-cell">{q.text}</td>
                <td>{q.account_id ? accounts.find((a) => a.id === q.account_id)?.label ?? `#${q.account_id}` : 'Global'}</td>
                <td className="row-actions">
                  <button className="btn-danger" onClick={() => remove(q.id)}>
                    Delete
                  </button>
                </td>
              </tr>
            ))}
            {replies.length === 0 && (
              <tr>
                <td colSpan={4} className="muted">
                  No quick replies yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
