import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../api';
import type { Account, Bot } from '../../types';

export default function BotsPanel() {
  const navigate = useNavigate();
  const [bots, setBots] = useState<Bot[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [name, setName] = useState('');
  const [accountId, setAccountId] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    const [b, a] = await Promise.all([api.get<Bot[]>('/api/automation/bots'), api.get<Account[]>('/api/accounts')]);
    setBots(b.data);
    setAccounts(a.data);
  }, []);

  useEffect(() => {
    load().catch(console.error);
  }, [load]);

  const create = async () => {
    setError('');
    try {
      const res = await api.post<{ id: number }>('/api/automation/bots', {
        name: name.trim(),
        account_id: accountId ? Number(accountId) : null
      });
      navigate(`/admin/bots/${res.data.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create bot');
    }
  };

  const toggle = async (bot: Bot) => {
    await api.patch(`/api/automation/bots/${bot.id}`, { enabled: !bot.enabled }).catch(console.error);
    await load();
  };

  const remove = async (id: number) => {
    if (!window.confirm('Delete this bot?')) return;
    await api.del(`/api/automation/bots/${id}`).catch(console.error);
    await load();
  };

  return (
    <div className="panel">
      {error && <div className="form-error">{error}</div>}

      <div className="card">
        <h3>🧩 Visual bot builder</h3>
        <p className="muted">
          Build conversation flows on a drag-and-drop canvas — triggers, conditions, text replies, AI replies,
          delays, tags and status changes. Bots run on incoming customer messages (individual chats only) and
          take priority over auto-reply rules.
        </p>
        <div className="form-row">
          <input placeholder="Bot name (e.g. Lead Qualifier)" value={name} onChange={(e) => setName(e.target.value)} />
          <select value={accountId} onChange={(e) => setAccountId(e.target.value)}>
            <option value="">All WhatsApps</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                Only: {a.label}
              </option>
            ))}
          </select>
          <button className="btn-primary" onClick={() => void create()} disabled={!name.trim()}>
            Create & open builder
          </button>
        </div>
      </div>

      <div className="card">
        <table className="data-table">
          <thead>
            <tr>
              <th>Bot</th>
              <th>Scope</th>
              <th>Nodes</th>
              <th>Updated</th>
              <th>Enabled</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {bots.map((b) => (
              <tr key={b.id}>
                <td>{b.name}</td>
                <td>{b.account_id ? accounts.find((a) => a.id === b.account_id)?.label ?? `#${b.account_id}` : 'All WhatsApps'}</td>
                <td>{b.flow.nodes.length}</td>
                <td>{b.updated_at}</td>
                <td>
                  <button className={`toggle ${b.enabled ? 'on' : ''}`} onClick={() => void toggle(b)}>
                    <span />
                  </button>
                </td>
                <td className="row-actions">
                  <button className="btn-ghost" onClick={() => navigate(`/admin/bots/${b.id}`)}>
                    Open builder
                  </button>
                  <button className="btn-danger" onClick={() => void remove(b.id)}>
                    Delete
                  </button>
                </td>
              </tr>
            ))}
            {bots.length === 0 && (
              <tr>
                <td colSpan={6} className="muted">
                  No bots yet — create your first flow above.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
