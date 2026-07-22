import { useState } from 'react';

interface Props {
  onSelect: (emoji: string) => void;
  onClose: () => void;
}

const EMOJI_CATEGORIES = [
  {
    name: 'Frequent & Popular',
    emojis: ['😊', '😂', '😍', '❤️', '👍', '🙏', '🔥', '🎉', '🚀', '✨', '💯', '🙌', '🤝', '💼', '📌']
  },
  {
    name: 'Faces & Reactions',
    emojis: ['😀', '😃', '😄', '😁', '😆', '😅', '🤣', '🙃', '😉', '😇', '🥰', '😘', '😋', '😎', '🥳', '🤩', '🤔', '😐', '😏', '😢', '😭', '🤯', '😱', '👍', '👎']
  },
  {
    name: 'Hands & Gestures',
    emojis: ['👋', '🖐️', '✋', '👌', '🤌', '🤏', '✌️', '🤞', '🤟', '🤘', '🤙', '👈', '👉', '👆', '👇', '☝️', '👏', '🤝', '💪', '🙏', '⚡']
  },
  {
    name: 'Business & Office',
    emojis: ['💼', '📊', '📈', '📋', '📁', '📄', '📝', '✏️', '📌', '📎', '📞', '📠', '💻', '🖥️', '📧', '✉️', '📦', '🚚', '🏷️', '💰', '💳', '🎯', '💡']
  }
];

export default function EmojiPicker({ onSelect, onClose }: Props) {
  const [activeCategory, setActiveCategory] = useState(0);

  return (
    <div className="emoji-picker-popover">
      <div className="emoji-picker-header">
        <span>Emojis</span>
        <button className="tag-x" onClick={onClose}>&times;</button>
      </div>
      <div className="emoji-picker-tabs">
        {EMOJI_CATEGORIES.map((cat, idx) => (
          <button
            key={cat.name}
            className={`emoji-tab ${activeCategory === idx ? 'active' : ''}`}
            onClick={() => setActiveCategory(idx)}
          >
            {cat.emojis[0]}
          </button>
        ))}
      </div>
      <div className="emoji-picker-grid">
        {EMOJI_CATEGORIES[activeCategory].emojis.map((emoji) => (
          <button
            key={emoji}
            className="emoji-btn"
            onClick={() => {
              onSelect(emoji);
            }}
          >
            {emoji}
          </button>
        ))}
      </div>
    </div>
  );
}
