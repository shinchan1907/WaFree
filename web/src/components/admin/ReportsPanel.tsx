import { useCallback, useEffect, useState } from 'react';
import { api } from '../../api';

interface AgentReport {
  id: number;
  name: string;
  username: string;
  role: string;
  replies_sent: number;
  chats_resolved: number;
  avg_response_seconds: number | null;
  response_samples: number;
  csat_avg: number | null;
  csat_count: number;
  open_pending: number;
  open_ongoing: number;
}

interface Overview {
  pending: number;
  ongoing: number;
  resolved: number;
  unassigned_open: number;
  incoming_messages: number;
  outgoing_messages: number;
  csat_avg: number | null;
  csat_count: number;
}

const RANGES = [
  { days: 1, label: 'Today' },
  { days: 7, label: '7 days' },
  { days: 30, label: '30 days' }
];

function formatDuration(seconds: number | null): string {
  if (seconds === null) return '—';
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
  return `${Math.floor(seconds / 3600)}h ${Math.round((seconds % 3600) / 60)}m`;
}

function csatStars(avg: number | null): string {
  if (avg === null) return '—';
  return `${avg.toFixed(2)} ★`;
}

export default function ReportsPanel() {
  const [days, setDays] = useState(7);
  const [agents, setAgents] = useState<AgentReport[]>([]);
  const [overview, setOverview] = useState<Overview | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      const [a, o] = await Promise.all([
        api.get<AgentReport[]>(`/api/analytics/agents?days=${days}`),
        api.get<Overview>(`/api/analytics/overview?days=${days}`)
      ]);
      setAgents(a.data);
      setOverview(o.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load reports');
    }
  }, [days]);

  useEffect(() => {
    load().catch(console.error);
  }, [load]);

  return (
    <div className="panel">
      {error && <div className="form-error">{error}</div>}

      <div className="card">
        <div className="reports-head">
          <h3>📊 Team performance</h3>
          <div className="filter-tabs" style={{ padding: 0 }}>
            {RANGES.map((r) => (
              <button
                key={r.days}
                className={`filter-tab ${days === r.days ? 'active' : ''}`}
                onClick={() => setDays(r.days)}
              >
                {r.label}
              </button>
            ))}
            <button className="btn-ghost" onClick={() => void load()} style={{ marginLeft: 'auto' }}>
              Refresh
            </button>
          </div>
        </div>

        {overview && (
          <div className="stat-grid">
            <div className="stat-tile">
              <div className="stat-value">{overview.pending}</div>
              <div className="stat-label">Pending tickets</div>
            </div>
            <div className="stat-tile">
              <div className="stat-value">{overview.ongoing}</div>
              <div className="stat-label">On-going</div>
            </div>
            <div className="stat-tile">
              <div className="stat-value">{overview.unassigned_open}</div>
              <div className="stat-label">Unassigned open</div>
            </div>
            <div className="stat-tile">
              <div className="stat-value">{overview.incoming_messages}</div>
              <div className="stat-label">Messages in</div>
            </div>
            <div className="stat-tile">
              <div className="stat-value">{overview.outgoing_messages}</div>
              <div className="stat-label">Messages out</div>
            </div>
            <div className="stat-tile">
              <div className="stat-value">{csatStars(overview.csat_avg)}</div>
              <div className="stat-label">CSAT ({overview.csat_count} ratings)</div>
            </div>
          </div>
        )}
      </div>

      <div className="card">
        <h3>Agent breakdown</h3>
        <table className="data-table">
          <thead>
            <tr>
              <th>Agent</th>
              <th title="Messages sent in the selected period">Replies</th>
              <th title="Distinct chats this agent marked resolved">Resolved</th>
              <th title="Average time between a customer message and this agent's reply">Avg response</th>
              <th title="Average customer rating (1-5) for chats resolved by this agent">CSAT</th>
              <th title="Chats currently assigned and not resolved">Pendency</th>
            </tr>
          </thead>
          <tbody>
            {agents.map((a) => (
              <tr key={a.id}>
                <td>
                  {a.name} <span className="muted">@{a.username}</span>{' '}
                  <span className={`role-chip role-${a.role}`}>{a.role}</span>
                </td>
                <td>{a.replies_sent}</td>
                <td>{a.chats_resolved}</td>
                <td title={`${a.response_samples} samples`}>{formatDuration(a.avg_response_seconds)}</td>
                <td title={`${a.csat_count} ratings`}>{csatStars(a.csat_avg)}</td>
                <td>
                  {a.open_pending + a.open_ongoing > 0 ? (
                    <>
                      <span className="status-chip chip-pending">{a.open_pending} pending</span>{' '}
                      <span className="status-chip chip-ongoing">{a.open_ongoing} ongoing</span>
                    </>
                  ) : (
                    <span className="muted">Clear ✓</span>
                  )}
                </td>
              </tr>
            ))}
            {agents.length === 0 && (
              <tr>
                <td colSpan={6} className="muted">
                  No active users.
                </td>
              </tr>
            )}
          </tbody>
        </table>
        <p className="muted" style={{ marginTop: 10 }}>
          Avg response = time between a customer message and the agent's next reply (same chat, capped at 24h).
          CSAT ratings are collected automatically when a resolved customer replies 1–5 to the survey (enable it
          in Settings).
        </p>
      </div>
    </div>
  );
}
