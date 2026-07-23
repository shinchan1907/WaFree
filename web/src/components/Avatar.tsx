import { useEffect, useState } from 'react';
import { api } from '../api';
import { avatarColor, initials } from '../lib/format';

interface Props {
  accountId: number;
  jid: string;
  name: string;
  size?: number;
}

/** Module-level cache so each jid's avatar is fetched once per session. */
const urlCache = new Map<string, Promise<string | null>>();

function fetchAvatarUrl(accountId: number, jid: string): Promise<string | null> {
  const key = `${accountId}:${jid}`;
  let cached = urlCache.get(key);
  if (!cached) {
    cached = api
      .get<{ url: string | null }>(`/api/accounts/${accountId}/avatar/${encodeURIComponent(jid)}`)
      .then((res) => res.data.url)
      .catch(() => null);
    urlCache.set(key, cached);
  }
  return cached;
}

export default function Avatar({ accountId, jid, name, size = 44 }: Props) {
  const [url, setUrl] = useState<string | null>(null);
  const [imgFailed, setImgFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    setUrl(null);
    setImgFailed(false);
    fetchAvatarUrl(accountId, jid).then((u) => {
      if (alive) setUrl(u);
    });
    return () => {
      alive = false;
    };
  }, [accountId, jid]);

  const style = { width: size, height: size, fontSize: size * 0.36 };

  if (url && !imgFailed) {
    return (
      <img
        className="avatar avatar-img"
        style={style}
        src={url}
        alt={name}
        loading="lazy"
        referrerPolicy="no-referrer"
        onError={() => setImgFailed(true)}
      />
    );
  }
  return (
    <div className="avatar" style={{ ...style, background: avatarColor(jid) }}>
      {initials(name)}
    </div>
  );
}
