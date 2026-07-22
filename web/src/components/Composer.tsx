import { useMemo, useRef, useState, type KeyboardEvent } from 'react';
import type { QuickReply } from '../types';
import EmojiPicker from './EmojiPicker';
import GifPicker from './GifPicker';

interface Props {
  onSend: (text: string) => Promise<void>;
  onSchedule?: (text: string, sendAtSeconds: number) => Promise<void>;
  quickReplies: QuickReply[];
  disabled?: boolean;
  disabledHint?: string;
}

/** Local datetime string 15 minutes from now, for the schedule input default. */
function defaultScheduleValue(): string {
  const d = new Date(Date.now() + 15 * 60 * 1000);
  d.setSeconds(0, 0);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function Composer({ onSend, onSchedule, quickReplies, disabled, disabledHint }: Props) {
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [pickerIndex, setPickerIndex] = useState(0);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [gifOpen, setGifOpen] = useState(false);
  const [scheduleAt, setScheduleAt] = useState(defaultScheduleValue);
  const [scheduleNote, setScheduleNote] = useState('');
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const slashQuery = text.startsWith('/') ? text.slice(1).toLowerCase() : null;
  const matches = useMemo(() => {
    if (slashQuery === null) return [];
    return quickReplies
      .filter((q) => q.shortcut.toLowerCase().startsWith(slashQuery))
      .slice(0, 8);
  }, [slashQuery, quickReplies]);

  const applyQuickReply = (q: QuickReply) => {
    setText(q.text);
    setPickerIndex(0);
    inputRef.current?.focus();
  };

  const insertEmoji = (emoji: string) => {
    setText((prev) => prev + emoji);
    setEmojiOpen(false);
    inputRef.current?.focus();
  };

  const insertGif = async (url: string) => {
    setGifOpen(false);
    if (!disabled && !sending) {
      setSending(true);
      try {
        await onSend(url);
      } finally {
        setSending(false);
      }
    }
  };

  const doSend = async () => {
    const trimmed = text.trim();
    if (!trimmed || sending || disabled) return;
    setSending(true);
    try {
      await onSend(trimmed);
      setText('');
      if (inputRef.current) {
        inputRef.current.style.height = 'auto';
      }
    } catch {
      // error surfaced by parent; keep text for retry
    } finally {
      setSending(false);
    }
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (matches.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setPickerIndex((i) => (i + 1) % matches.length);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setPickerIndex((i) => (i - 1 + matches.length) % matches.length);
        return;
      }
      if (e.key === 'Tab' || e.key === 'Enter') {
        e.preventDefault();
        applyQuickReply(matches[pickerIndex] ?? matches[0]);
        return;
      }
      if (e.key === 'Escape') {
        setText('');
        return;
      }
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void doSend();
    }
  };

  return (
    <footer className="composer">
      {matches.length > 0 && (
        <div className="qr-picker">
          <div className="qr-picker-title">Quick replies</div>
          {matches.map((q, i) => (
            <button
              key={q.id}
              className={`qr-item ${i === pickerIndex ? 'active' : ''}`}
              onMouseEnter={() => setPickerIndex(i)}
              onClick={() => applyQuickReply(q)}
            >
              <span className="qr-shortcut">/{q.shortcut}</span>
              <span className="qr-text">{q.text}</span>
            </button>
          ))}
        </div>
      )}

      {emojiOpen && <EmojiPicker onSelect={insertEmoji} onClose={() => setEmojiOpen(false)} />}
      {gifOpen && <GifPicker onSelectGif={insertGif} onClose={() => setGifOpen(false)} />}

      {scheduleOpen && (
        <div className="schedule-pop">
          <div className="palette-title">Schedule this message</div>
          <input
            type="datetime-local"
            value={scheduleAt}
            min={defaultScheduleValue()}
            onChange={(e) => setScheduleAt(e.target.value)}
          />
          {scheduleNote && <div className="muted">{scheduleNote}</div>}
          <div className="setup-actions">
            <button className="btn-ghost" onClick={() => setScheduleOpen(false)}>
              Cancel
            </button>
            <button
              className="btn-primary"
              disabled={!text.trim()}
              onClick={async () => {
                const ts = Math.floor(new Date(scheduleAt).getTime() / 1000);
                if (!Number.isFinite(ts) || ts * 1000 <= Date.now()) {
                  setScheduleNote('Pick a time in the future');
                  return;
                }
                try {
                  await onSchedule?.(text.trim(), ts);
                  setText('');
                  setScheduleOpen(false);
                  setScheduleNote('');
                } catch {
                  /* error shown by parent */
                }
              }}
            >
              Schedule
            </button>
          </div>
        </div>
      )}
      <div className="composer-row">
        <button
          className="send-btn"
          title="Insert Emoji"
          disabled={disabled}
          onClick={() => {
            setEmojiOpen((o) => !o);
            setGifOpen(false);
            setScheduleOpen(false);
          }}
        >
          😊
        </button>

        <button
          className="send-btn"
          title="Insert GIF / Reaction"
          disabled={disabled}
          style={{ fontSize: 13, fontWeight: 700 }}
          onClick={() => {
            setGifOpen((o) => !o);
            setEmojiOpen(false);
            setScheduleOpen(false);
          }}
        >
          GIF
        </button>

        {onSchedule && (
          <button
            className="send-btn"
            title="Schedule message"
            disabled={disabled || !text.trim()}
            onClick={() => {
              setScheduleOpen((o) => !o);
              setEmojiOpen(false);
              setGifOpen(false);
            }}
          >
            <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor">
              <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm0 18a8 8 0 1 1 0-16 8 8 0 0 1 0 16zm.5-13H11v6l5.2 3.1.8-1.2-4.5-2.7z" />
            </svg>
          </button>
        )}

        <textarea
          ref={inputRef}
          rows={1}
          placeholder={disabled ? disabledHint || 'Not connected' : 'Type a message  ( /  for quick replies)'}
          value={text}
          disabled={disabled}
          onChange={(e) => {
            setText(e.target.value);
            setPickerIndex(0);
            e.target.style.height = 'auto';
            e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`;
          }}
          onKeyDown={onKeyDown}
        />
        <button
          className="send-btn"
          onClick={() => void doSend()}
          disabled={disabled || sending || !text.trim()}
          title="Send"
        >
          <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
            <path d="M1.1 21.8 23 12 1.1 2.2 1 9.8 16.7 12 1 14.2z" />
          </svg>
        </button>
      </div>
    </footer>
  );
}
