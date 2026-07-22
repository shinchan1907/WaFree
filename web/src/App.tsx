import { useEffect, useState } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { api } from './api';
import { connectSocket } from './socket';
import { useAuth } from './AuthContext';
import Login from './pages/Login';
import Setup from './pages/Setup';
import ChatApp from './pages/ChatApp';
import Admin from './pages/Admin';
import BotEditor from './pages/BotEditor';

export default function App() {
  const { user, loading } = useAuth();
  const [needsSetup, setNeedsSetup] = useState<boolean | null>(null);

  useEffect(() => {
    if (user) {
      setNeedsSetup(false);
      return;
    }
    api
      .get<{ needsSetup: boolean }>('/api/setup/status')
      .then((res) => setNeedsSetup(res.data.needsSetup))
      .catch(() => setNeedsSetup(false));
  }, [user]);

  if (loading || (!user && needsSetup === null)) {
    return (
      <div className="full-center">
        <div className="spinner" />
      </div>
    );
  }

  if (!user && needsSetup) {
    return (
      <Setup
        onComplete={() => {
          connectSocket();
          window.location.href = '/';
        }}
      />
    );
  }

  if (!user) {
    return (
      <Routes>
        <Route path="*" element={<Login />} />
      </Routes>
    );
  }

  return (
    <Routes>
      <Route path="/" element={<ChatApp />} />
      <Route path="/admin" element={user.role === 'admin' ? <Admin /> : <Navigate to="/" replace />} />
      <Route path="/admin/bots/:botId" element={user.role === 'admin' ? <BotEditor /> : <Navigate to="/" replace />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
