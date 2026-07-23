const STORAGE_KEY = 'wafree_notifications';

export function isNotifyEnabled(): boolean {
  return localStorage.getItem(STORAGE_KEY) === '1' && Notification.permission === 'granted';
}

export async function enableNotifications(): Promise<boolean> {
  if (!('Notification' in window)) return false;
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return false;
  localStorage.setItem(STORAGE_KEY, '1');
  return true;
}

export function disableNotifications(): void {
  localStorage.setItem(STORAGE_KEY, '0');
}

/** Short two-tone notification beep via WebAudio (no asset file needed). */
export function playBeep(): void {
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    const gain = ctx.createGain();
    gain.gain.value = 0.08;
    gain.connect(ctx.destination);
    [880, 1174.7].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = freq;
      osc.connect(gain);
      osc.start(ctx.currentTime + i * 0.12);
      osc.stop(ctx.currentTime + i * 0.12 + 0.11);
    });
    setTimeout(() => void ctx.close(), 500);
  } catch {
    // audio unavailable — silent fallback
  }
}

export function showMessageNotification(title: string, body: string, onClick?: () => void): void {
  if (!isNotifyEnabled()) return;
  try {
    const n = new Notification(title, {
      body: body.slice(0, 120),
      icon: '/favicon.ico',
      tag: `wafree-${title}`,
      silent: true
    });
    n.onclick = () => {
      window.focus();
      onClick?.();
      n.close();
    };
    playBeep();
  } catch {
    // Notification constructor can throw on some mobile browsers
  }
}
