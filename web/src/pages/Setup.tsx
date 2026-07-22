import { useState, type FormEvent } from 'react';
import { api, setToken } from '../api';
import type { User } from '../types';

interface Props {
  onComplete: (user: User) => void;
}

export default function Setup({ onComplete }: Props) {
  const [step, setStep] = useState(1);
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [webhookUrl, setWebhookUrl] = useState('');
  const [webhookSecret, setWebhookSecret] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const nextFromAdmin = (e: FormEvent) => {
    e.preventDefault();
    setError('');
    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match');
      return;
    }
    setStep(2);
  };

  const finish = async (skipWebhook: boolean) => {
    setError('');
    setBusy(true);
    try {
      const res = await api.post<{ token: string; user: User }>('/api/setup', {
        name: name.trim(),
        username: username.trim(),
        password,
        webhook_url: skipWebhook ? '' : webhookUrl.trim(),
        webhook_secret: skipWebhook ? '' : webhookSecret.trim()
      });
      setToken(res.data.token);
      onComplete(res.data.user);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Setup failed');
      setBusy(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-band" />
      <div className="login-card setup-card">
        <div className="setup-steps">
          <span className={`setup-step ${step >= 1 ? 'active' : ''}`}>1. Admin account</span>
          <span className={`setup-step ${step >= 2 ? 'active' : ''}`}>2. Notifications</span>
        </div>
        <h1>Welcome to WaFree</h1>
        {error && <div className="form-error">{error}</div>}

        {step === 1 && (
          <form onSubmit={nextFromAdmin} className="setup-form">
            <p className="login-sub">Let's create your administrator account.</p>
            <label>
              Your name
              <input value={name} onChange={(e) => setName(e.target.value)} required autoFocus />
            </label>
            <label>
              Username
              <input value={username} onChange={(e) => setUsername(e.target.value)} required />
            </label>
            <label>
              Password (min 6 characters)
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            </label>
            <label>
              Confirm password
              <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
            </label>
            <button className="btn-primary" disabled={!name.trim() || !username.trim()}>
              Continue
            </button>
          </form>
        )}

        {step === 2 && (
          <div className="setup-form">
            <p className="login-sub">
              Optional: get webhook notifications when a WhatsApp account disconnects, logs out, or a scheduled
              message fails. Works great with Slack, n8n, Discord or any HTTP endpoint. You can change this later
              in Admin → Settings.
            </p>
            <label>
              Webhook URL
              <input
                placeholder="https://your-endpoint.example.com/wafree"
                value={webhookUrl}
                onChange={(e) => setWebhookUrl(e.target.value)}
              />
            </label>
            <label>
              Secret (optional — sent as X-WaFree-Secret header)
              <input value={webhookSecret} onChange={(e) => setWebhookSecret(e.target.value)} />
            </label>
            <div className="setup-actions">
              <button className="btn-ghost" disabled={busy} onClick={() => void finish(true)}>
                Skip for now
              </button>
              <button className="btn-primary" disabled={busy || !webhookUrl.trim()} onClick={() => void finish(false)}>
                {busy ? 'Finishing…' : 'Finish setup'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
