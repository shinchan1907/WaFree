import type { proto } from 'baileys';

export interface ExtractedContent {
  type: string;
  text: string | null;
  preview: string;
}

/** Unwraps ephemeral/viewOnce wrappers and extracts a displayable text + type. */
export function extractContent(message: proto.IMessage | null | undefined): ExtractedContent | null {
  if (!message) return null;
  const inner =
    message.ephemeralMessage?.message ||
    message.viewOnceMessage?.message ||
    message.viewOnceMessageV2?.message ||
    message.documentWithCaptionMessage?.message ||
    message;

  if (inner.conversation) return { type: 'text', text: inner.conversation, preview: inner.conversation };
  if (inner.extendedTextMessage?.text) {
    const t = inner.extendedTextMessage.text;
    return { type: 'text', text: t, preview: t };
  }
  if (inner.imageMessage) {
    const cap = inner.imageMessage.caption || '';
    return { type: 'image', text: cap || null, preview: cap ? `📷 ${cap}` : '📷 Photo' };
  }
  if (inner.videoMessage) {
    const cap = inner.videoMessage.caption || '';
    return { type: 'video', text: cap || null, preview: cap ? `🎥 ${cap}` : '🎥 Video' };
  }
  if (inner.audioMessage) {
    return { type: 'audio', text: null, preview: inner.audioMessage.ptt ? '🎤 Voice message' : '🎵 Audio' };
  }
  if (inner.documentMessage) {
    const name = inner.documentMessage.fileName || 'Document';
    return { type: 'document', text: name, preview: `📄 ${name}` };
  }
  if (inner.stickerMessage) return { type: 'sticker', text: null, preview: '💟 Sticker' };
  if (inner.locationMessage) return { type: 'location', text: null, preview: '📍 Location' };
  if (inner.liveLocationMessage) return { type: 'location', text: null, preview: '📍 Live location' };
  if (inner.contactMessage) {
    return { type: 'contact', text: inner.contactMessage.displayName || null, preview: '👤 Contact card' };
  }
  if (inner.contactsArrayMessage) return { type: 'contact', text: null, preview: '👤 Contacts' };
  if (inner.pollCreationMessage || inner.pollCreationMessageV2 || inner.pollCreationMessageV3) {
    return { type: 'poll', text: null, preview: '📊 Poll' };
  }
  // reactions / protocol / key distribution etc. — not renderable as chat rows
  return null;
}

/** True for jids we track as chats (people + groups), false for broadcast/status/newsletter. */
export function isTrackableJid(jid: string | null | undefined): jid is string {
  if (!jid) return false;
  return jid.endsWith('@s.whatsapp.net') || jid.endsWith('@g.us') || jid.endsWith('@lid');
}
