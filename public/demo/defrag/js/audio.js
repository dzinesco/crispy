// Synthesized hard-drive ticks. Nothing sampled, nothing branded.

export function createAudio() {
  let ctx = null;
  let master = null;
  let hum = null;
  let muted = false;
  let humming = false;

  function context() {
    if (ctx) return ctx;
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return null;
    try {
      ctx = new AudioCtx();
    } catch {
      return null;
    }
    master = ctx.createGain();
    master.gain.value = 0.22;
    master.connect(ctx.destination);
    return ctx;
  }

  function unlock() {
    const audio = context();
    if (!audio) return;
    if (audio.state === 'suspended') audio.resume().catch(() => {});
  }

  function setMuted(next) {
    muted = !!next;
    if (master) master.gain.value = muted ? 0 : 0.22;
    if (muted) stopHum();
  }

  function noiseBuffer(audio, seconds) {
    const length = Math.max(1, Math.floor(audio.sampleRate * seconds));
    const buffer = audio.createBuffer(1, length, audio.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) data[i] = Math.random() * 2 - 1;
    return buffer;
  }

  function blip(freq, seconds, type, gain) {
    const audio = context();
    if (!audio || muted) return;
    const osc = audio.createOscillator();
    const amp = audio.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    amp.gain.setValueAtTime(gain, audio.currentTime);
    amp.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + seconds);
    osc.connect(amp);
    amp.connect(master);
    osc.start();
    osc.stop(audio.currentTime + seconds + 0.02);
  }

  function tick(kind) {
    const audio = context();
    if (!audio || muted) return;
    const src = audio.createBufferSource();
    src.buffer = noiseBuffer(audio, 0.018);
    const filter = audio.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = kind === 'write' ? 1800 : 900;
    filter.Q.value = 0.7;
    const amp = audio.createGain();
    amp.gain.setValueAtTime(kind === 'write' ? 0.35 : 0.22, audio.currentTime);
    amp.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + 0.03);
    src.connect(filter);
    filter.connect(amp);
    amp.connect(master);
    src.start();
  }

  function seek(distance) {
    const audio = context();
    if (!audio || muted) return;
    const seconds = Math.min(0.18, 0.04 + Math.abs(distance) * 0.004);
    const src = audio.createBufferSource();
    src.buffer = noiseBuffer(audio, seconds);
    const filter = audio.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(2400, audio.currentTime);
    filter.frequency.exponentialRampToValueAtTime(400, audio.currentTime + seconds);
    const amp = audio.createGain();
    amp.gain.setValueAtTime(0.18, audio.currentTime);
    amp.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + seconds);
    src.connect(filter);
    filter.connect(amp);
    amp.connect(master);
    src.start();
    blip(180, seconds, 'triangle', 0.04);
  }

  function startHum() {
    const audio = context();
    if (!audio || muted || humming) return;
    humming = true;
    const osc = audio.createOscillator();
    const osc2 = audio.createOscillator();
    const amp = audio.createGain();
    osc.type = 'sine';
    osc2.type = 'sine';
    osc.frequency.value = 90;
    osc2.frequency.value = 120;
    amp.gain.value = 0.03;
    osc.connect(amp);
    osc2.connect(amp);
    amp.connect(master);
    osc.start();
    osc2.start();
    hum = { osc, osc2, amp };
  }

  function stopHum() {
    if (!hum) {
      humming = false;
      return;
    }
    try {
      hum.osc.stop();
      hum.osc2.stop();
    } catch {
      /* already stopped */
    }
    hum = null;
    humming = false;
  }

  function restartSting() {
    blip(392, 0.12, 'square', 0.05);
    setTimeout(() => blip(330, 0.14, 'square', 0.05), 130);
    setTimeout(() => blip(262, 0.2, 'square', 0.05), 270);
  }

  function fanfare() {
    [523, 659, 784, 1046].forEach((freq, index) => {
      setTimeout(() => blip(freq, 0.16, 'triangle', 0.06), index * 110);
    });
  }

  function error() {
    blip(140, 0.08, 'square', 0.04);
    setTimeout(() => blip(110, 0.1, 'square', 0.04), 90);
  }

  return { unlock, setMuted, tick, seek, startHum, stopHum, restartSting, fanfare, error, get muted() { return muted; } };
}
