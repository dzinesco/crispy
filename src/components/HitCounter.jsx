import { useEffect, useState } from 'react';

export default function HitCounter() {
  const [count, setCount] = useState(null);

  useEffect(() => {
    let cancel = false;
    async function load() {
      try {
        const res = await fetch('/api/hits', {
          method: 'POST',
          credentials: 'include',
          headers: { 'content-type': 'application/json' },
          body: '{}',
        });
        if (!res.ok) throw new Error('hits');
        const data = await res.json();
        if (!cancel) setCount(Number(data.count) || 0);
      } catch {
        try {
          const res = await fetch('/api/hits');
          const data = await res.json();
          if (!cancel) setCount(Number(data.count) || 0);
        } catch {
          if (!cancel) setCount(null);
        }
      }
    }
    load();
    return () => {
      cancel = true;
    };
  }, []);

  const text = count == null ? '------' : String(count).padStart(6, '0');
  const label = count == null ? 'Hit counter loading' : `${count} hits`;

  return (
    <p className="hit" aria-label={label} aria-busy={count == null}>
      <span className="hit-label pixel">Hits</span>
      <span className="hit-digits" aria-hidden="true">
        {[...text].map((digit, index) => (
          <span key={`${index}-${digit}`} className="hit-digit">{digit}</span>
        ))}
      </span>
    </p>
  );
}
