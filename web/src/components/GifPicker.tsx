import { useState } from 'react';

interface Props {
  onSelectGif: (gifUrl: string) => void;
  onClose: () => void;
}

const FEATURED_GIFS = [
  { name: 'Thumbs Up', url: 'https://media.giphy.com/media/111ebonMs92sh2/giphy.gif' },
  { name: 'Thank You', url: 'https://media.giphy.com/media/osjgQPWRx3cac/giphy.gif' },
  { name: 'Celebrating', url: 'https://media.giphy.com/media/lszAB3TzFtRHm/giphy.gif' },
  { name: 'Welcome', url: 'https://media.giphy.com/media/l0MYC0LajbaPoEADu/giphy.gif' },
  { name: 'Working On It', url: 'https://media.giphy.com/media/JIX9t2j0ZTN9S/giphy.gif' },
  { name: 'OK Got It', url: 'https://media.giphy.com/media/G1vplKuyucywpg15T9/giphy.gif' }
];

export default function GifPicker({ onSelectGif, onClose }: Props) {
  const [customUrl, setCustomUrl] = useState('');

  const submitCustom = () => {
    if (customUrl.trim()) {
      onSelectGif(customUrl.trim());
      setCustomUrl('');
    }
  };

  return (
    <div className="gif-picker-popover">
      <div className="emoji-picker-header">
        <span>GIFs &amp; Media Reactions</span>
        <button className="tag-x" onClick={onClose}>&times;</button>
      </div>
      <div className="gif-grid">
        {FEATURED_GIFS.map((g) => (
          <button key={g.name} className="gif-card" onClick={() => onSelectGif(g.url)}>
            <img src={g.url} alt={g.name} loading="lazy" />
            <span>{g.name}</span>
          </button>
        ))}
      </div>
      <div className="gif-custom-row">
        <input
          placeholder="Paste Image / GIF URL..."
          value={customUrl}
          onChange={(e) => setCustomUrl(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') submitCustom();
          }}
        />
        <button className="btn-primary" onClick={submitCustom} disabled={!customUrl.trim()}>
          Insert
        </button>
      </div>
    </div>
  );
}
