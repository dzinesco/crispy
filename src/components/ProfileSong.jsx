import { useEffect, useRef, useState } from 'react';
import usePrefersReducedMotion from '../hooks/usePrefersReducedMotion.js';

// Original loop. Square wave, short notes, no sample.
const NOTES = [262, 330, 392, 330, 349, 294, 262, 294, 330, 262, 220, 262];
const STEP_MS = 220;

export default function ProfileSong({ title }) {
  const reduced = usePrefersReducedMotion();
  const [playing, setPlaying] = useState(false);
  const [failed, setFailed] = useState(false);
  const ctxRef = useRef(null);
  const timerRef = useRef(0);
  const stepRef = useRef(0);
  const aliveRef = useRef([]);

  function stopOscillators() {
    for (const osc of aliveRef.current) {
      try { osc.stop(); } catch { /* already stopped */ }
    }
    aliveRef.current = [];
  }

  function stop() {
    window.clearTimeout(timerRef.current);
    timerRef.current = 0;
    stopOscillators();
    setPlaying(false);
  }

  useEffect(() => () => {
    window.clearTimeout(timerRef.current);
    stopOscillators();
    if (ctxRef.current) ctxRef.current.close().catch(() => {});
  }, []);

  function blip(freq) {
    const ctx = ctxRef.current;
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'square';
    osc.frequency.value = freq;
    const now = ctx.currentTime;
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.05, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.16);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.17);
    aliveRef.current.push(osc);
    osc.onended = () => {
      aliveRef.current = aliveRef.current.filter((node) => node !== osc);
    };
  }

  function tick() {
    blip(NOTES[stepRef.current % NOTES.length]);
    stepRef.current += 1;
    timerRef.current = window.setTimeout(tick, STEP_MS);
  }

  async function toggle() {
    if (playing) {
      stop();
      return;
    }
    setFailed(false);
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) throw new Error('no-audio');
      if (!ctxRef.current) ctxRef.current = new Ctx();
      if (ctxRef.current.state === 'suspended') await ctxRef.current.resume();
      stepRef.current = 0;
      setPlaying(true);
      tick();
    } catch {
      setFailed(true);
      setPlaying(false);
    }
  }

  return (
    <div className="song">
      <p className="pixel">Profile song</p>
      <p className="song-title">{title}</p>
      <button
        type="button"
        data-song
        className="btn-primary"
        aria-pressed={playing}
        onClick={toggle}
      >
        {playing ? 'Stop song' : 'Play song'}
      </button>
      <div className={`song-bars${playing && !reduced ? ' is-on' : ''}`} aria-hidden="true">
        {NOTES.slice(0, 8).map((note, index) => (
          <span key={note + index} style={{ '--i': index }} />
        ))}
      </div>
      <p className="gb-status" role="status">
        {failed ? 'This browser blocked the song.' : playing ? 'Playing. It’s a square wave, and it stays off until you press play.' : 'Plays only when you press play.'}
      </p>
    </div>
  );
}
