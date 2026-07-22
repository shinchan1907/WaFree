import { useState } from 'react';
import { Link } from 'react-router-dom';
import AccountsPanel from '../components/admin/AccountsPanel';
import UsersPanel from '../components/admin/UsersPanel';
import QuickRepliesPanel from '../components/admin/QuickRepliesPanel';
import AutomationPanel from '../components/admin/AutomationPanel';
import BotsPanel from '../components/admin/BotsPanel';
import TagsPanel from '../components/admin/TagsPanel';
import SettingsPanel from '../components/admin/SettingsPanel';
import ThemeToggle from '../components/ThemeToggle';

type AdminTab = 'accounts' | 'users' | 'quickreplies' | 'automation' | 'bots' | 'tags' | 'settings';

const TABS: { key: AdminTab; label: string }[] = [
  { key: 'accounts', label: 'WhatsApp Accounts' },
  { key: 'users', label: 'Team & Access' },
  { key: 'quickreplies', label: 'Quick Replies' },
  { key: 'automation', label: 'Automation' },
  { key: 'bots', label: 'Bot Builder' },
  { key: 'tags', label: 'Tags' },
  { key: 'settings', label: 'Settings' }
];

export default function Admin() {
  const [tab, setTab] = useState<AdminTab>('accounts');

  return (
    <div className="admin-page">
      <header className="admin-header">
        <Link to="/" className="back-link">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
            <path d="M20 11H7.8l5.6-5.6L12 4l-8 8 8 8 1.4-1.4L7.8 13H20z" />
          </svg>
          Back to chats
        </Link>
        <h1>Admin Panel</h1>
        <nav className="admin-tabs">
          {TABS.map((t) => (
            <button
              key={t.key}
              className={`admin-tab ${tab === t.key ? 'active' : ''}`}
              onClick={() => setTab(t.key)}
            >
              {t.label}
            </button>
          ))}
        </nav>
      </header>
      <main className="admin-body">
        {tab === 'accounts' && <AccountsPanel />}
        {tab === 'users' && <UsersPanel />}
        {tab === 'quickreplies' && <QuickRepliesPanel />}
        {tab === 'automation' && <AutomationPanel />}
        {tab === 'bots' && <BotsPanel />}
        {tab === 'tags' && <TagsPanel />}
        {tab === 'settings' && <SettingsPanel />}
      </main>
    </div>
  );
}
