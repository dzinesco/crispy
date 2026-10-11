let ctx = null;
let volume = 5;
let muted = false;
let unlocked = false;

export function setAudioLevel(nextVolume, nextMuted) {
  volume = Math.max(0, Math.min(7, Number(nextVolume) || 0));
  muted = Boolean(nextMuted) || volume === 0;
}

export function unlockAudio() {
  unlocked = true;
  try {
    const audio = context();
    if (audio.state === 'suspended') audio.resume();
  } catch {
    /* autoplay policies vary; stay quiet */
  }
}

function context() {
  if (!ctx) ctx = new AudioContext();
  return ctx;
}

function tone({ freq, dur = 0.08, type = 'square', gain = 0.05, delay = 0, slide = 0 }) {
  if (!unlocked || muted || volume <= 0 || !ctx) return;
  const audio = context();
  const t = audio.currentTime + delay;
  const osc = audio.createOscillator();
  const amp = audio.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(40, slide), t + dur);
  const peak = Math.max(0.0002, (volume / 7) * gain);
  amp.gain.setValueAtTime(0.0001, t);
  amp.gain.exponentialRampToValueAtTime(peak, t + 0.012);
  amp.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(amp).connect(audio.destination);
  osc.start(t);
  osc.stop(t + dur + 0.03);
}

export function play(name) {
  try {
    if (name === 'startup') {
      [392, 523.25, 659.25, 784].forEach((freq, i) => {
        tone({ freq, dur: 0.16, type: 'triangle', gain: 0.055, delay: i * 0.09 });
      });
      return;
    }
    if (name === 'alert') {
      tone({ freq: 698, dur: 0.07, type: 'square', gain: 0.035 });
      tone({ freq: 466, dur: 0.11, type: 'square', gain: 0.035, delay: 0.09 });
      return;
    }
    if (name === 'click') {
      tone({ freq: 1600, dur: 0.018, type: 'square', gain: 0.018 });
      return;
    }
    if (name === 'open') {
      tone({ freq: 620, dur: 0.045, type: 'triangle', gain: 0.04 });
      return;
    }
    if (name === 'trash') {
      tone({ freq: 196, dur: 0.12, type: 'sawtooth', gain: 0.03, slide: 70 });
      return;
    }
    if (name === 'brick') {
      tone({ freq: 480, dur: 0.035, type: 'square', gain: 0.028 });
      return;
    }
    if (name === 'wall') {
      tone({ freq: 210, dur: 0.03, type: 'square', gain: 0.022 });
      return;
    }
    if (name === 'lose') {
      tone({ freq: 330, dur: 0.12, type: 'square', gain: 0.03, slide: 90 });
    }
  } catch {
    /* missing audio device or blocked autoplay */
  }
}
