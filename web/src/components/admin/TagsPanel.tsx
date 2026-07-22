import { useCallback, useEffect, useState } from 'react';
import { api } from '../../api';
import type { Tag } from '../../types';

const TAG_COLORS = ['#53bdeb', '#00a884', '#f5b642', '#e9557b', '#9b7ded', '#fa6533', '#2ab8a0', '#8696a0'];

export default function TagsPanel() {
  const [tags, setTags] = useState<Tag[]>([]);
  const [name, setName] = useState('');
  const [color, setColor] = useState(TAG_COLORS[0]);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    const res = await api.get<Tag[]>('/api/tags');
    setTags(res.data);
  }, []);

  useEffect(() => {
    load().catch(console.error);
  }, [load]);

  const create = async () => {
    setError('');
    try {
      await api.post('/api/tags', { name: name.trim(), color });
      setName('');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create tag');
    }
  };

  const remove = async (id: number) => {
    if (!window.confirm('Delete this tag? It will be removed from all chats.')) return;
    await api.del(`/api/tags/${id}`).catch(console.error);
    await load();
  };

  return (
    <div className="panel">
      {error && <div className="form-error">{error}</div>}
      <div className="card">
        <h3>Create tag</h3>
        <p className="muted">Tags help you label conversations — "Lead", "VIP", "Complaint", "Order" …</p>
        <div className="form-row">
          <input placeholder="Tag name" value={name} onChange={(e) => setName(e.target.value)} />
          <div className="color-picker">
            {TAG_COLORS.map((c) => (
              <button
                key={c}
                className={`color-swatch ${c === color ? 'active' : ''}`}
                style={{ background: c }}
                onClick={() => setColor(c)}
              />
            ))}
          </div>
          <button className="btn-primary" onClick={() => void create()} disabled={!name.trim()}>
            Add tag
          </button>
        </div>
      </div>

      <div className="card">
        <div className="tag-grid">
          {tags.map((t) => (
            <span key={t.id} className="tag-chip big" style={{ background: `${t.color}26`, color: t.color }}>
              <span className="tag-dot" style={{ background: t.color }} />
              {t.name}
              <button className="tag-x" onClick={() => void remove(t.id)} title="Delete tag">
                ×
              </button>
            </span>
          ))}
          {tags.length === 0 && <span className="muted">No tags yet.</span>}
        </div>
      </div>
    </div>
  );
}
