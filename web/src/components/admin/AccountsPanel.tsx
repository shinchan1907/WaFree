import { useCallback, useEffect, useState } from 'react';
import { api } from '../../api';
import { getSocket } from '../../socket';
import type { Account, AdminUser } from '../../types';

const ACCOUNT_COLORS = ['#00a884', '#53bdeb', '#f5b642', '#e9557b', '#9b7ded', '#fa6533', '#2ab8a0', '#5f66cd'];

export default function AccountsPanel() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [label, setLabel] = useState('');
  const [color, setColor] = useState(ACCOUNT_COLORS[0]);
  const [maxAgents, setMaxAgents] = useState(2);
  const [qrModal, setQrModal] = useState<{ accountId: number; qr: string | null; status: string } | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    const [acc, usr] = await Promise.all([
      api.get<Account[]>('/api/accounts'),
      api.get<AdminUser[]>('/api/users')
    ]);
    setAccounts(acc.data);
    setUsers(usr.data);
  }, []);

  useEffect(() => {
    load().catch(console.error);
  }, [load]);

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;
    const onQr = (payload: { accountId: number; qr: string }) => {
      setQrModal((prev) => (prev && prev.accountId === payload.accountId ? { ...prev, qr: payload.qr, status: 'qr' } : prev));
    };
    const onStatus = (payload: { accountId: number; status: Account['status']; phone?: string }) => {
      setAccounts((prev) =>
        prev.map((a) => (a.id === payload.accountId ? { ...a, status: payload.status, phone: payload.phone ?? a.phone } : a))
      );
      setQrModal((prev) => {
        if (!prev || prev.accountId !== payload.accountId) return prev;
        if (payload.status === 'connected') return null;
        return { ...prev, status: payload.status };
      });
    };
    socket.on('account:qr', onQr);
    socket.on('account:status', onStatus);
    return () => {
      socket.off('account:qr', onQr);
      socket.off('account:status', onStatus);
    };
  }, []);

  const createAccount = async () => {
    setError('');
    if (!label.trim()) return;
    try {
      await api.post('/api/accounts', { label: label.trim(), color, max_agents: maxAgents });
      setLabel('');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create');
    }
  };

  const connect = async (accountId: number) => {
    setError('');
    setQrModal({ accountId, qr: null, status: 'connecting' });
    try {
      const res = await api.post<{ status: string; qr: string | null }>(`/api/accounts/${accountId}/connect`);
      setQrModal({ accountId, qr: res.data.qr, status: res.data.status });
    } catch (err) {
      setQrModal(null);
      setError(err instanceof Error ? err.message : 'Failed to connect');
    }
  };

  const logoutAccount = async (accountId: number) => {
    if (!window.confirm('Log out this WhatsApp? You will need to re-scan the QR to reconnect.')) return;
    await api.post(`/api/accounts/${accountId}/logout`).catch(() => undefined);
    await load();
  };

  const removeAccount = async (accountId: number) => {
    if (!window.confirm('Delete this account AND its stored chat history? This cannot be undone.')) return;
    await api.del(`/api/accounts/${accountId}`).catch(() => undefined);
    await load();
  };

  const toggleAgent = async (account: Account, userId: number) => {
    const current = account.agents.map((a) => a.id);
    const next = current.includes(userId) ? current.filter((id) => id !== userId) : [...current, userId];
    setError('');
    try {
      await api.put(`/api/accounts/${account.id}/agents`, { user_ids: next });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update agents');
    }
  };

  const executives = users.filter((u) => u.role === 'executive' && u.is_active);
  const qrAccount = qrModal ? accounts.find((a) => a.id === qrModal.accountId) : null;

  return (
    <div className="panel">
      {error && <div className="form-error">{error}</div>}

      <div className="card">
        <h3>Add WhatsApp account</h3>
        <div className="form-row">
          <input placeholder="Label (e.g. Sales, Support)" value={label} onChange={(e) => setLabel(e.target.value)} />
          <div className="color-picker">
            {ACCOUNT_COLORS.map((c) => (
              <button
                key={c}
                className={`color-swatch ${c === color ? 'active' : ''}`}
                style={{ background: c }}
                onClick={() => setColor(c)}
              />
            ))}
          </div>
          <select value={maxAgents} onChange={(e) => setMaxAgents(Number(e.target.value))}>
            <option value={1}>1 agent max</option>
            <option value={2}>2 agents max</option>
            <option value={3}>3 agents max</option>
            <option value={5}>5 agents max</option>
          </select>
          <button className="btn-primary" onClick={createAccount} disabled={!label.trim()}>
            Add account
          </button>
        </div>
      </div>

      {accounts.map((a) => (
        <div className="card account-card" key={a.id}>
          <div className="account-card-head">
            <span className="account-dot big" style={{ background: a.color }} />
            <div className="account-card-title">
              <strong>{a.label}</strong>
              <span className="muted">{a.phone ? `+${a.phone}` : 'Not paired yet'}</span>
            </div>
            <span className={`conn conn-${a.status}`}>{a.status}</span>
            <div className="account-card-actions">
              {a.status === 'connected' ? (
                <button className="btn-ghost" onClick={() => logoutAccount(a.id)}>
                  Log out
                </button>
              ) : (
                <button className="btn-primary" onClick={() => connect(a.id)}>
                  {a.status === 'qr' || a.status === 'connecting' ? 'Show QR' : 'Connect / Scan QR'}
                </button>
              )}
              <button className="btn-danger" onClick={() => removeAccount(a.id)}>
                Delete
              </button>
            </div>
          </div>
          <div className="agents-block">
            <div className="agents-block-title">
              Agents who can see &amp; reply on this WhatsApp
              <span className={`agents-count ${a.agents.length >= a.max_agents ? 'full' : ''}`}>
                {a.agents.length}/{a.max_agents}
              </span>
            </div>
            {executives.length === 0 ? (
              <span className="muted">No executives yet — add them in Team &amp; Access first.</span>
            ) : (
              <div className="agents-checklist">
                {executives.map((u) => {
                  const assigned = a.agents.some((ag) => ag.id === u.id);
                  const limitReached = !assigned && a.agents.length >= a.max_agents;
                  return (
                    <label key={u.id} className={`agent-check ${limitReached ? 'disabled' : ''}`}>
                      <input
                        type="checkbox"
                        checked={assigned}
                        disabled={limitReached}
                        onChange={() => void toggleAgent(a, u.id)}
                      />
                      <span className="agent-check-name">{u.name}</span>
                      <span className="muted">@{u.username}</span>
                    </label>
                  );
                })}
              </div>
            )}
            {a.agents.length >= a.max_agents && executives.length > a.agents.length && (
              <span className="muted">
                Agent limit reached — raise "max agents" on this account to add more.
              </span>
            )}
          </div>
        </div>
      ))}
      {accounts.length === 0 && <div className="list-empty">No WhatsApp accounts yet — add your first one above.</div>}

      {qrModal && (
        <div className="modal-backdrop" onClick={() => setQrModal(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Link WhatsApp — {qrAccount?.label ?? ''}</h3>
            {qrModal.qr ? (
              <>
                <img className="qr-img" src={qrModal.qr} alt="WhatsApp QR code" />
                <ol className="qr-steps">
                  <li>Open WhatsApp on the phone</li>
                  <li>Tap Menu → Linked devices</li>
                  <li>Tap "Link a device" and scan this code</li>
                </ol>
              </>
            ) : (
              <div className="qr-waiting">
                <div className="spinner" />
                <p>{qrModal.status === 'connecting' ? 'Generating QR code…' : `Status: ${qrModal.status}`}</p>
              </div>
            )}
            <button className="btn-ghost" onClick={() => setQrModal(null)}>
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
