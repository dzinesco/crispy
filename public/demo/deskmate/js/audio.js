let ctx = null;
const live = new Set();

function context() {
  if (!ctx) ctx = new AudioContext();
  return ctx;
}

export function unlock() {
  try {
    const audio = context();
    if (audio.state !== 'running') audio.resume();
    return audio;
  } catch {
    return null;
  }
}

export function invalidate() {
  for (const node of live) {
    try { node.stop(); } catch { /* already finished */ }
  }
  live.clear();
}

function track(node) {
  live.add(node);
  node.addEventListener('ended', () => live.delete(node));
}

export function tone(freqs, duration, type = 'square', gainValue = 0.04) {
  const audio = unlock();
  if (!audio) return;
  const gain = audio.createGain();
  const now = audio.currentTime;
  gain.gain.setValueAtTime(Math.max(0.0001, gainValue), now);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
  gain.connect(audio.destination);
  for (const freq of freqs) {
    const osc = audio.createOscillator();
    osc.type = type;
    osc.frequency.value = freq;
    osc.connect(gain);
    osc.start(now);
    osc.stop(now + duration);
    track(osc);
  }
}

export function beep(freq = 440, duration = 0.05) {
  tone([freq], duration, 'square', 0.03);
}

export function noise(duration, gainValue = 0.04) {
  const audio = unlock();
  if (!audio) return;
  const length = Math.max(1, Math.floor(audio.sampleRate * duration));
  const buffer = audio.createBuffer(1, length, audio.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i += 1) {
    const env = 1 - i / length;
    data[i] = (Math.random() * 2 - 1) * env;
  }
  const source = audio.createBufferSource();
  source.buffer = buffer;
  const gain = audio.createGain();
  gain.gain.value = gainValue;
  source.connect(gain);
  gain.connect(audio.destination);
  source.start();
  track(source);
}

const SEMI = { C: 0, 'C#': 1, D: 2, 'D#': 3, E: 4, F: 5, 'F#': 6, G: 7, 'G#': 8, A: 9, 'A#': 10, B: 11 };

export function freqOf(name) {
  const match = /^([A-G]#?)(\d)$/.exec(name || '');
  if (!match || SEMI[match[1]] == null) return null;
  const midi = (Number(match[2]) + 1) * 12 + SEMI[match[1]];
  return 440 * 2 ** ((midi - 69) / 12);
}
