export function formatTime(tsSeconds: number): string {
  const d = new Date(tsSeconds * 1000);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function formatChatListDate(tsSeconds: number | null): string {
  if (!tsSeconds) return '';
  const d = new Date(tsSeconds * 1000);
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  if (d.getTime() >= startOfToday) return formatTime(tsSeconds);
  if (d.getTime() >= startOfToday - 86400000) return 'Yesterday';
  return d.toLocaleDateString([], { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export function formatDaySeparator(tsSeconds: number): string {
  const d = new Date(tsSeconds * 1000);
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  if (d.getTime() >= startOfToday) return 'Today';
  if (d.getTime() >= startOfToday - 86400000) return 'Yesterday';
  return d.toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

export function chatDisplayName(name: string | null, jid: string): string {
  if (name) return name;
  const bare = jid.split('@')[0];
  if (jid.endsWith('@g.us')) return 'Group';
  // @lid ids are WhatsApp privacy aliases, not phone numbers — don't fake a "+".
  if (jid.endsWith('@lid')) return `~${bare.slice(-6)}`;
  return `+${bare}`;
}

/** Subtitle under the chat name in the header. */
export function jidSubtitle(jid: string): string {
  if (jid.endsWith('@g.us')) return 'Group';
  if (jid.endsWith('@lid')) return 'Privacy-protected contact (no number shared)';
  return `+${jid.split('@')[0]}`;
}

export function initials(text: string): string {
  const words = text.replace(/[^\p{L}\p{N} ]/gu, '').trim().split(/\s+/);
  if (words.length === 0 || !words[0]) return '#';
  const first = words[0][0] ?? '';
  const second = words.length > 1 ? words[1][0] ?? '' : '';
  return (first + second).toUpperCase();
}

/** Deterministic avatar hue from a string. */
export function avatarColor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 35%, 45%)`;
}
