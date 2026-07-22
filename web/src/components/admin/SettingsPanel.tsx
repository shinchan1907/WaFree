import { useEffect, useState } from 'react';
import { api } from '../../api';
import type { AppSettings } from '../../types';

export default function SettingsPanel() {
  const [settings, setSettings] = useState<AppSettings>({});
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api
      .get<AppSettings>('/api/settings')
      .then((res) => setSettings(res.data))
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load settings'));
  }, []);

  const set = (key: string, value: string) => setSettings((s) => ({ ...s, [key]: value }));

  const save = async () => {
    setError('');
    setMessage('');
    setBusy(true);
    try {
      const res = await api.put<AppSettings>('/api/settings', settings);
      setSettings(res.data);
      setMessage('Settings saved.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setBusy(false);
    }
  };

  const testWebhook = async () => {
    setError('');
    setMessage('');
    try {
      await api.post('/api/settings/test-webhook');
      setMessage('Test webhook delivered successfully ✓');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Webhook test failed');
    }
  };

  return (
    <div className="panel">
      {error && <div className="form-error">{error}</div>}
      {message && <div className="form-success">{message}</div>}

      <div className="card">
        <h3>🔔 Webhook notifications</h3>
        <p className="muted">
          WaFree sends a POST request to this URL when something needs your attention: a WhatsApp account logs
          out, connects, or a scheduled message fails. Point it at Slack, n8n, Zapier or your own endpoint.
        </p>
        <div className="settings-grid">
          <label className="settings-field">
            <span>Enabled</span>
            <select
              value={settings.webhook_enabled ?? ''}
              onChange={(e) => set('webhook_enabled', e.target.value)}
            >
              <option value="">Disabled</option>
              <option value="1">Enabled</option>
            </select>
          </label>
          <label className="settings-field wide">
            <span>Webhook URL</span>
            <input
              placeholder="https://hooks.example.com/wafree"
              value={settings.webhook_url ?? ''}
              onChange={(e) => set('webhook_url', e.target.value)}
            />
          </label>
          <label className="settings-field">
            <span>Secret header (X-WaFree-Secret)</span>
            <input value={settings.webhook_secret ?? ''} onChange={(e) => set('webhook_secret', e.target.value)} />
          </label>
        </div>
        <div className="form-row" style={{ marginTop: 12 }}>
          <button className="btn-ghost" onClick={() => void testWebhook()}>
            Send test notification
          </button>
        </div>
      </div>

      <div className="card">
        <h3>🤖 AI integration</h3>
        <p className="muted">
          Used by AI auto-replies and AI bot nodes. Works with any OpenAI-compatible chat API — OpenAI, Anthropic
          (compat endpoint), Groq, OpenRouter, DeepSeek, Ollama, LM Studio and more.
        </p>
        <div className="settings-grid">
          <label className="settings-field wide">
            <span>API base URL</span>
            <input
              placeholder="https://api.openai.com/v1"
              value={settings.ai_base_url ?? ''}
              onChange={(e) => set('ai_base_url', e.target.value)}
            />
          </label>
          <label className="settings-field">
            <span>API key</span>
            <input value={settings.ai_api_key ?? ''} onChange={(e) => set('ai_api_key', e.target.value)} />
          </label>
          <label className="settings-field">
            <span>Model</span>
            <input
              placeholder="gpt-4o-mini"
              value={settings.ai_model ?? ''}
              onChange={(e) => set('ai_model', e.target.value)}
            />
          </label>
          <label className="settings-field wide">
            <span>System prompt (business context for every AI reply)</span>
            <textarea
              rows={3}
              placeholder="You are the support assistant for Acme Store. We sell ... Opening hours are ..."
              value={settings.ai_system_prompt ?? ''}
              onChange={(e) => set('ai_system_prompt', e.target.value)}
            />
          </label>
        </div>
      </div>

      <div className="form-row">
        <button className="btn-primary" onClick={() => void save()} disabled={busy}>
          {busy ? 'Saving…' : 'Save settings'}
        </button>
      </div>
    </div>
  );
}
