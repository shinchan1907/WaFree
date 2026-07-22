import { useCallback, useEffect, useState } from 'react';
import { api } from '../../api';
import { useAuth } from '../../AuthContext';
import type { Account, AdminUser } from '../../types';

export default function UsersPanel() {
  const { user: me } = useAuth();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [form, setForm] = useState({ username: '', password: '', name: '', role: 'executive' });
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    const [usr, acc] = await Promise.all([
      api.get<AdminUser[]>('/api/users'),
      api.get<Account[]>('/api/accounts')
    ]);
    setUsers(usr.data);
    setAccounts(acc.data);
  }, []);

  useEffect(() => {
    load().catch(console.error);
  }, [load]);

  const createUser = async () => {
    setError('');
    try {
      await api.post('/api/users', form);
      setForm({ username: '', password: '', name: '', role: 'executive' });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create user');
    }
  };

  const toggleActive = async (u: AdminUser) => {
    await api.patch(`/api/users/${u.id}`, { is_active: !u.is_active }).catch(console.error);
    await load();
  };

  const resetPassword = async (u: AdminUser) => {
    const pw = window.prompt(`New password for ${u.username} (min 6 chars):`);
    if (!pw) return;
    setError('');
    try {
      await api.patch(`/api/users/${u.id}`, { password: pw });
      window.alert('Password updated.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update password');
    }
  };

  const removeUser = async (u: AdminUser) => {
    if (!window.confirm(`Delete user "${u.username}"?`)) return;
    await api.del(`/api/users/${u.id}`).catch(console.error);
    await load();
  };

  const accountLabel = (id: number) => accounts.find((a) => a.id === id)?.label ?? `#${id}`;

  return (
    <div className="panel">
      {error && <div className="form-error">{error}</div>}

      <div className="card">
        <h3>Add team member</h3>
        <div className="form-row">
          <input
            placeholder="Full name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
          <input
            placeholder="Username"
            value={form.username}
            onChange={(e) => setForm({ ...form, username: e.target.value })}
          />
          <input
            placeholder="Password (min 6 chars)"
            type="password"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
          />
          <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
            <option value="executive">Executive</option>
            <option value="admin">Admin</option>
          </select>
          <button
            className="btn-primary"
            onClick={createUser}
            disabled={!form.name.trim() || !form.username.trim() || form.password.length < 6}
          >
            Add user
          </button>
        </div>
      </div>

      <div className="card">
        <table className="data-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Username</th>
              <th>Role</th>
              <th>Assigned WhatsApps</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className={u.is_active ? '' : 'row-disabled'}>
                <td>{u.name}</td>
                <td>{u.username}</td>
                <td>
                  <span className={`role-chip role-${u.role}`}>{u.role}</span>
                </td>
                <td>
                  {u.role === 'admin'
                    ? 'All (admin)'
                    : u.account_ids.length
                      ? u.account_ids.map(accountLabel).join(', ')
                      : '—'}
                </td>
                <td>{u.is_active ? 'Active' : 'Disabled'}</td>
                <td className="row-actions">
                  <button className="btn-ghost" onClick={() => resetPassword(u)}>
                    Reset password
                  </button>
                  {me?.id !== u.id && (
                    <>
                      <button className="btn-ghost" onClick={() => toggleActive(u)}>
                        {u.is_active ? 'Disable' : 'Enable'}
                      </button>
                      <button className="btn-danger" onClick={() => removeUser(u)}>
                        Delete
                      </button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
