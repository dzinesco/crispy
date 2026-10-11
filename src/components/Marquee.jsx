import { useState } from 'react';
import usePrefersReducedMotion from '../hooks/usePrefersReducedMotion.js';

const TEXT = 'Welcome to Crispy Goat  ·  a personal homepage  ·  EST. 2024  ·  open an app  ·  sign the guestbook  ·  ';

export default function Marquee() {
  const reduced = usePrefersReducedMotion();
  const [paused, setPaused] = useState(false);
  const still = reduced || paused;

  return (
    <div className="marquee">
      <p className="sr-only">{TEXT}</p>
      <div className="marquee-viewport" aria-hidden="true">
        <div className={`marquee-track${still ? ' is-still' : ''}`}>
          <span>{TEXT}</span>
          <span>{TEXT}</span>
        </div>
      </div>
      <button
        type="button"
        className="marquee-pause"
        aria-pressed={still}
        onClick={() => setPaused((value) => !value)}
      >
        {still ? 'Play updates' : 'Pause updates'}
      </button>
    </div>
  );
}
