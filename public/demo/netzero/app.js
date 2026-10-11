/* =============================================================
   NetZero v1.2 — Dial-up Experience
   Vanilla JS, no build. Synthesized modem audio, dial state machine,
   window chrome, classic 1999 start page.
   ============================================================= */

(() => {
  'use strict';

  // ============================================================
  // STATE
  // ============================================================
  const ACCESS_NUMBER = '18006389376';
  const STORAGE_KEY = 'netzero.v1.state';

  const state = {
    phase: 'idle',          // idle | dialing | authenticating | connected
    muted: false,
    cancelled: false,
  };

  // ============================================================
  // DOM HELPERS
  // ============================================================
  const $ = (id) => document.getElementById(id);
  const $$ = (sel) => document.querySelectorAll(sel);
  const el = (tag, cls) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    return e;
  };

  // ============================================================
  // DTMF FREQUENCIES
  // ============================================================
  const DTMF = {
    '1': [697, 1209], '2': [697, 1336], '3': [697, 1477],
    '4': [770, 1209], '5': [770, 1336], '6': [770, 1477],
    '7': [852, 1209], '8': [852, 1336], '9': [852, 1477],
    '*': [941, 1209], '0': [941, 1336], '#': [941, 1477],
  };

  // ============================================================
  // MODEM AUDIO ENGINE
  // ============================================================
  const audio = {
    ctx: null,
    master: null,
    analyser: null,
    analyserData: null,
    muted: false,

    init() {
      if (this.ctx) return;
      const Ctx = window.AudioContext || window.webkitAudioContext;
      this.ctx = new Ctx();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.55;

      this.analyser = this.ctx.createAnalyser();
      this.analyser.fftSize = 512;
      this.analyser.smoothingTimeConstant = 0.6;
      this.analyserData = new Uint8Array(this.analyser.frequencyBinCount);

      this.master.connect(this.analyser);
      this.analyser.connect(this.ctx.destination);
    },

    resume() {
      if (this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume();
      }
    },

    setMuted(m) {
      this.muted = m;
      if (this.master) {
        this.master.gain.setTargetAtTime(m ? 0 : 0.55, this.ctx.currentTime, 0.02);
      }
    },

    // ---------- DTMF ----------
    dtmf(digit, durMs = 160) {
      const pair = DTMF[digit];
      if (!pair || !this.ctx) return;
      const ctx = this.ctx;
      const t0 = ctx.currentTime;
      const dur = durMs / 1000;

      const o1 = ctx.createOscillator();
      const o2 = ctx.createOscillator();
      o1.frequency.value = pair[0];
      o2.frequency.value = pair[1];

      const gain = ctx.createGain();
      const peak = 0.32;
      gain.gain.setValueAtTime(0, t0);
      gain.gain.linearRampToValueAtTime(peak, t0 + 0.012);
      gain.gain.setValueAtTime(peak, t0 + dur - 0.025);
      gain.gain.linearRampToValueAtTime(0, t0 + dur);

      o1.connect(gain);
      o2.connect(gain);
      gain.connect(this.master);
      o1.start(t0); o2.start(t0);
      o1.stop(t0 + dur); o2.stop(t0 + dur);
    },

    // ---------- Dial tone (350 + 440 Hz) ----------
    dialTone(durMs) {
      if (!this.ctx) return;
      const ctx = this.ctx;
      const t0 = ctx.currentTime;
      const dur = durMs / 1000;

      const o1 = ctx.createOscillator();
      const o2 = ctx.createOscillator();
      o1.frequency.value = 350;
      o2.frequency.value = 440;
      o1.type = 'sine';
      o2.type = 'sine';

      const g = ctx.createGain();
      g.gain.setValueAtTime(0, t0);
      g.gain.linearRampToValueAtTime(0.32, t0 + 0.04);
      g.gain.setValueAtTime(0.32, t0 + dur - 0.06);
      g.gain.linearRampToValueAtTime(0, t0 + dur);

      o1.connect(g);
      o2.connect(g);
      g.connect(this.master);
      o1.start(t0); o2.start(t0);
      o1.stop(t0 + dur); o2.stop(t0 + dur);
    },

    // ---------- Ringback tone (440 + 480 Hz, 2s on, 4s off) ----------
    ringback(durMs) {
      if (!this.ctx) return;
      const ctx = this.ctx;
      const t0 = ctx.currentTime;
      const dur = durMs / 1000;

      const o1 = ctx.createOscillator();
      const o2 = ctx.createOscillator();
      o1.frequency.value = 440;
      o2.frequency.value = 480;

      const g = ctx.createGain();
      // pulses: 1s on, 2s off (US ringback ~ 2s on, 4s off in some regions;
      // we'll use 1s on, 2s off for snappier experience)
      let t = t0;
      while (t < t0 + dur) {
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(0.32, t + 0.04);
        g.gain.setValueAtTime(0.32, t + 0.9);
        g.gain.linearRampToValueAtTime(0, t + 1.0);
        t += 3.0;
      }

      o1.connect(g);
      o2.connect(g);
      g.connect(this.master);
      o1.start(t0); o2.start(t0);
      o1.stop(t0 + dur); o2.stop(t0 + dur);
    },

    // ---------- V.8 answer (2100 Hz brief tone) ----------
    v8Answer() {
      if (!this.ctx) return;
      const ctx = this.ctx;
      const t0 = ctx.currentTime;
      const dur = 0.8;

      const o = ctx.createOscillator();
      o.frequency.value = 2100;
      o.type = 'sine';
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, t0);
      g.gain.linearRampToValueAtTime(0.3, t0 + 0.05);
      g.gain.setValueAtTime(0.3, t0 + dur - 0.05);
      g.gain.linearRampToValueAtTime(0, t0 + dur);
      o.connect(g).connect(this.master);
      o.start(t0); o.stop(t0 + dur);
    },

    // ---------- Modem handshake (the iconic "brrrup-shhhhhhh") ----------
    // Composed of: bandpass-filtered noise + AM-modulated carrier
    handshake(durMs = 13000) {
      if (!this.ctx) return;
      const ctx = this.ctx;
      const t0 = ctx.currentTime;
      const dur = durMs / 1000;

      // White-noise source (looping)
      const noiseLen = ctx.sampleRate * 2;
      const buf = ctx.createBuffer(1, noiseLen, ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < noiseLen; i++) data[i] = Math.random() * 2 - 1;
      const noise = ctx.createBufferSource();
      noise.buffer = buf;
      noise.loop = true;

      // Bandpass for noise (telephony band)
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 1700;
      bp.Q.value = 1.2;

      // Slight filter sweep via LFO (gives the "swooping" character)
      const sweepLFO = ctx.createOscillator();
      sweepLFO.frequency.value = 0.3;
      const sweepAmt = ctx.createGain();
      sweepAmt.gain.value = 400;
      sweepLFO.connect(sweepAmt).connect(bp.frequency);

      // Noise envelope (pulsing for the "training" feel)
      const noiseGain = ctx.createGain();
      noiseGain.gain.setValueAtTime(0, t0);
      noiseGain.gain.linearRampToValueAtTime(0.22, t0 + 0.05);
      noiseGain.gain.setTargetAtTime(0.22, t0 + 0.05, 0.1);

      // Carrier (2400 Hz with subtle drift)
      const carrier = ctx.createOscillator();
      carrier.type = 'sine';
      carrier.frequency.setValueAtTime(2400, t0);
      carrier.frequency.linearRampToValueAtTime(2300, t0 + dur);

      // Carrier AM mod for the "brrrup" envelope (~30 Hz LFO)
      const modLFO = ctx.createOscillator();
      modLFO.frequency.value = 28;
      const modAmt = ctx.createGain();
      modAmt.gain.value = 0.22;

      const carrierGain = ctx.createGain();
      carrierGain.gain.value = 0.42;
      modLFO.connect(modAmt).connect(carrierGain.gain);

      // Mixer
      const mix = ctx.createGain();
      mix.gain.value = 1;

      noise.connect(bp).connect(noiseGain).connect(mix);
      carrier.connect(carrierGain).connect(mix);
      mix.connect(this.master);

      carrier.start(t0);
      modLFO.start(t0);
      sweepLFO.start(t0);
      noise.start(t0);

      // Final fade-out
      mix.gain.setValueAtTime(1, t0 + dur - 0.3);
      mix.gain.linearRampToValueAtTime(0, t0 + dur);

      carrier.stop(t0 + dur);
      modLFO.stop(t0 + dur);
      sweepLFO.stop(t0 + dur);
      noise.stop(t0 + dur);
    },

    // ---------- Connected chime (1800 Hz brief tone) ----------
    chime() {
      if (!this.ctx) return;
      const ctx = this.ctx;
      const t0 = ctx.currentTime;

      // Two short beeps
      const beep = (at, freq, dur) => {
        const o = ctx.createOscillator();
        o.frequency.value = freq;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0, t0 + at);
        g.gain.linearRampToValueAtTime(0.3, t0 + at + 0.02);
        g.gain.setValueAtTime(0.3, t0 + at + dur - 0.04);
        g.gain.linearRampToValueAtTime(0, t0 + at + dur);
        o.connect(g).connect(this.master);
        o.start(t0 + at); o.stop(t0 + at + dur);
      };
      beep(0, 1800, 0.18);
      beep(0.3, 1400, 0.18);
      beep(0.6, 1200, 0.4);
    },

    // ---------- Error buzz ----------
    errorBuzz() {
      if (!this.ctx) return;
      const ctx = this.ctx;
      const t0 = ctx.currentTime;
      const dur = 0.5;
      const o = ctx.createOscillator();
      o.type = 'square';
      o.frequency.value = 180;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, t0);
      g.gain.linearRampToValueAtTime(0.25, t0 + 0.02);
      g.gain.setValueAtTime(0.25, t0 + dur - 0.05);
      g.gain.linearRampToValueAtTime(0, t0 + dur);
      o.connect(g).connect(this.master);
      o.start(t0); o.stop(t0 + dur);
    },
  };

  // ============================================================
  // SIGNAL CANVAS — renders live audio waveform
  // ============================================================
  const signalCanvas = $('signal-canvas');
  const signalCtx = signalCanvas.getContext('2d');

  function fitSignalCanvas() {
    const r = signalCanvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    signalCanvas.width = Math.floor(r.width * dpr);
    signalCanvas.height = Math.floor(r.height * dpr);
    signalCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function drawSignal() {
    const w = signalCanvas.clientWidth;
    const h = signalCanvas.clientHeight;
    if (h === 0) {
      // Element hidden; retry later
      requestAnimationFrame(drawSignal);
      return;
    }

    // Always draw background, grid, and center line
    signalCtx.fillStyle = '#000814';
    signalCtx.fillRect(0, 0, w, h);

    signalCtx.strokeStyle = 'rgba(95, 255, 95, 0.12)';
    signalCtx.lineWidth = 1;
    for (let i = 1; i < 5; i++) {
      const y = (h / 5) * i;
      signalCtx.beginPath();
      signalCtx.moveTo(0, y);
      signalCtx.lineTo(w, y);
      signalCtx.stroke();
    }

    signalCtx.strokeStyle = 'rgba(95, 255, 95, 0.25)';
    signalCtx.beginPath();
    signalCtx.moveTo(0, h / 2);
    signalCtx.lineTo(w, h / 2);
    signalCtx.stroke();

    if (!audio.analyser) {
      requestAnimationFrame(drawSignal);
      return;
    }

    audio.analyser.getByteTimeDomainData(audio.analyserData);

    // Waveform
    signalCtx.strokeStyle = '#5fff5f';
    signalCtx.lineWidth = 1.5;
    signalCtx.shadowColor = '#5fff5f';
    signalCtx.shadowBlur = 4;
    signalCtx.beginPath();
    const step = w / audio.analyserData.length;
    for (let i = 0; i < audio.analyserData.length; i++) {
      const v = audio.analyserData[i] / 128 - 1;
      const y = h / 2 + v * (h / 2) * 0.85;
      if (i === 0) signalCtx.moveTo(0, y);
      else signalCtx.lineTo(i * step, y);
    }
    signalCtx.stroke();
    signalCtx.shadowBlur = 0;

    requestAnimationFrame(drawSignal);
  }

  // Fallback ticker using setInterval so the canvas keeps animating
  // even when rAF is throttled (e.g., tab in background, headless)
  let lastDraw = 0;
  setInterval(() => {
    if (!audio.analyser) return;
    const now = performance.now();
    if (now - lastDraw < 33) return; // throttle to ~30 fps
    lastDraw = now;
    drawSignal();
  }, 33);

  // ============================================================
  // LOG WINDOW
  // ============================================================
  const dialLog = $('dial-log');
  function log(msg, kind = 'info') {
    const line = el('div', `log-line log-${kind}`);
    const ts = new Date().toLocaleTimeString([], { hour12: false });
    line.textContent = `[${ts}] ${msg}`;
    dialLog.appendChild(line);
    dialLog.scrollTop = dialLog.scrollHeight;
  }
  function clearLog() {
    dialLog.innerHTML = '';
  }

  // ============================================================
  // WINDOW MANAGEMENT — drag, minimize, close
  // ============================================================
  function setupWindowDraggable(winEl) {
    const titlebar = winEl.querySelector('.titlebar');
    if (!titlebar) return;

    let dragging = false, sx = 0, sy = 0, wx = 0, wy = 0;
    titlebar.addEventListener('mousedown', (e) => {
      if (e.target.closest('.title-buttons')) return;
      dragging = true;
      sx = e.clientX; sy = e.clientY;
      const rect = winEl.getBoundingClientRect();
      wx = rect.left; wy = rect.top;
      // Bring to front
      bringToFront(winEl);
      e.preventDefault();
    });
    window.addEventListener('mousemove', (e) => {
      if (!dragging) return;
      const dx = e.clientX - sx;
      const dy = e.clientY - sy;
      const parentRect = winEl.parentElement.getBoundingClientRect();
      const r = winEl.getBoundingClientRect();
      let nx = wx + dx - parentRect.left;
      let ny = wy + dy - parentRect.top;
      nx = Math.max(-r.width + 60, Math.min(parentRect.width - 60, nx));
      ny = Math.max(0, Math.min(parentRect.height - 40, ny));
      winEl.style.left = nx + 'px';
      winEl.style.top = ny + 'px';
      winEl.style.transform = 'none';
    });
    window.addEventListener('mouseup', () => {
      if (dragging) {
        dragging = false;
        saveState();
      }
    });
  }

  let zCounter = 100;
  function bringToFront(winEl) {
    zCounter++;
    winEl.style.zIndex = zCounter;
  }

  function setupWindows() {
    $$('.window').forEach(setupWindowDraggable);
    $$('.window').forEach(bringToFront);
  }

  // ============================================================
  // DIAL SEQUENCE — the main state machine
  // ============================================================
  let dialTimeouts = [];

  function cancelDialTimers() {
    dialTimeouts.forEach(t => clearTimeout(t));
    dialTimeouts = [];
  }

  function after(ms, fn) {
    const id = setTimeout(() => {
      dialTimeouts = dialTimeouts.filter(t => t !== id);
      if (!state.cancelled) fn();
    }, ms);
    dialTimeouts.push(id);
  }

  function setProgress(pct, text) {
    $('progress-fill').style.width = `${Math.max(0, Math.min(100, pct))}%`;
    if (text) $('progress-text').textContent = text;
  }

  function setLoginStatus(text, mode) {
    $('status-text').textContent = text;
    const light = $('status-light');
    light.classList.remove('connecting', 'error');
    if (mode) light.classList.add(mode);
  }

  function startConnect() {
    state.phase = 'dialing';
    state.cancelled = false;

    // Init audio (user gesture)
    audio.init();
    audio.resume();

    // Show status window, hide login buttons
    $('login-window').classList.add('busy');
    $('connect-btn').disabled = true;
    $('status-window').hidden = false;
    bringToFront($('status-window'));
    setLoginStatus('Connecting…', 'connecting');

    // Re-fit signal canvas now that window is visible
    requestAnimationFrame(() => fitSignalCanvas());

    clearLog();
    log('NetZero Connection Manager v1.2 starting up...', 'info');
    log(`Modem detected on COM1: 56k V.92 Data/Fax Modem`, 'info');
    log(`Initializing modem at 115.2 kbps...`, 'info');
    setProgress(2, 'Initializing modem...');

    after(700, () => {
      log('ATZ - Reset modem', 'info');
      log('OK', 'success');
      log(`ATDT ${formatAccessNumber(ACCESS_NUMBER)}`, 'info');
      setProgress(8, 'Dialing access number...');
    });

    after(1500, () => {
      log('Dialing access number...', 'info');
      audio.dialTone(1500);
      setLoginStatus('Dialing…', 'connecting');
    });

    after(3000, () => {
      // DTMF each digit
      log('Sending DTMF tones...', 'info');
      let delay = 0;
      ACCESS_NUMBER.split('').forEach((digit) => {
        if (DTMF[digit]) {
          const d = delay;
          setTimeout(() => audio.dtmf(digit, 180), d);
          delay += 200;
        } else if (digit === '-') {
          delay += 80;
        }
      });
    });

    after(5200, () => {
      log('Waiting for carrier...', 'info');
      setProgress(18, 'Waiting for remote carrier...');
    });

    after(6000, () => {
      log('Ring...', 'info');
      audio.ringback(3000);
    });

    after(9000, () => {
      log('Remote modem answered.', 'success');
      log('V.8 bis negotiation in progress...', 'info');
      setProgress(28, 'Negotiating protocols...');
    });

    after(9700, () => {
      audio.v8Answer();
    });

    after(10800, () => {
      log('V.32 bis handshake initiated at 53,333 bps', 'info');
      log('Training echo canceller...', 'info');
      audio.handshake(12000);
      setProgress(35, 'Training modem...');
    });

    after(11500, () => {
      log('Equalizer training...', 'info');
      setProgress(42, 'Equalizer training...');
    });

    after(14000, () => {
      setProgress(55, 'Carrier training...');
      log('Carrier training...', 'info');
    });

    after(17000, () => {
      setProgress(68, 'Constellation learning...');
      log('Learning constellation...', 'info');
    });

    after(20500, () => {
      setProgress(82, 'Final negotiation...');
    });

    after(22500, () => {
      log('Carrier established at 53,333 bps', 'success');
      setProgress(92, 'Carrier established @ 53.3 kbps');
    });

    after(23200, () => {
      log('Sending PPP LCP requests...', 'info');
      log(`Authenticating member "coolcoder@netzero.net"...`, 'info');
      setLoginStatus('Authenticating…', 'connecting');
      setProgress(96, 'Logging on to NetZero...');
    });

    after(25200, () => {
      log('Password verified.', 'success');
      log('Assigning IP address 63.251.92.45...', 'info');
      log('Establishing TCP/IP...', 'info');
    });

    after(26500, () => {
      log('Connected to NetZero. Session active.', 'success');
      audio.chime();
      setProgress(100, 'Connected!');
      setLoginStatus('Connected', null);
      $('tray-state').textContent = 'Connected · 53.3kbps';
    });

    after(27500, () => {
      // Transition to browser
      state.phase = 'connected';
      log('Launching NetZero start page...', 'info');
      openBrowser();
      $('taskbar').hidden = false;
      $('login-window').classList.remove('busy');
      $('connect-btn').disabled = false;
      $('login-window').hidden = true;
      after(500, () => {
        $('status-window').hidden = true;
        cancelDialTimers();
      });
    });
  }

  function formatAccessNumber(num) {
    return `1-${num.slice(1, 4)}-${num.slice(4, 7)}-${num.slice(7)}`;
  }

  function cancelDial() {
    state.cancelled = true;
    state.phase = 'idle';
    cancelDialTimers();
    log('User cancelled connection.', 'error');
    setProgress(0, 'Disconnected');
    setLoginStatus('Ready', null);
    $('tray-state').textContent = 'Disconnected';
    audio.errorBuzz();
    $('login-window').classList.remove('busy');
    $('connect-btn').disabled = false;
    $('status-window').hidden = true;
  }

  // ============================================================
  // BROWSER OPEN — transition to NetZero start page
  // ============================================================
  function openBrowser() {
    const browser = $('browser-window');
    browser.hidden = false;
    bringToFront(browser);

    const memberId = $('member-id').value;
    $('nav-greeting').textContent = `Welcome, ${memberId}`;

    const iframe = $('browser-iframe');
    iframe.src = 'start.html';
  }

  // ============================================================
  // ACCESS NUMBER DIALOG
  // ============================================================
  function openAccess() {
    $('access-window').hidden = false;
    bringToFront($('access-window'));
  }

  // ============================================================
  // ABOUT DIALOG
  // ============================================================
  function openAbout() {
    $('about-window').hidden = false;
    bringToFront($('about-window'));
  }

  // ============================================================
  // MUTE TOGGLE
  // ============================================================
  function toggleMute() {
    state.muted = !state.muted;
    audio.setMuted(state.muted);
    $('tray-mute').classList.toggle('muted', state.muted);
    saveState();
  }

  // ============================================================
  // PERSISTENT STATE
  // ============================================================
  function saveState() {
    try {
      const w = (id) => {
        const win = $(id);
        if (!win || win.hidden) return null;
        return { left: win.style.left, top: win.style.top };
      };
      const data = {
        muted: state.muted,
        windows: {
          login: w('login-window'),
          browser: w('browser-window'),
        },
        visible: {
          browser: !$('browser-window').hidden,
        },
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (e) {}
  }

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const data = JSON.parse(raw);
      if (typeof data.muted === 'boolean') {
        state.muted = data.muted;
        audio.setMuted(state.muted);
        $('tray-mute').classList.toggle('muted', state.muted);
      }
      if (data.windows && data.windows.login) {
        const l = data.windows.login;
        if (l && l.left && l.top) {
          $('login-window').style.transform = 'none';
          $('login-window').style.left = l.left;
          $('login-window').style.top = l.top;
        }
      }
      if (data.windows && data.windows.browser) {
        const b = data.windows.browser;
        if (b && b.left && b.top) {
          $('browser-window').style.transform = 'none';
          $('browser-window').style.left = b.left;
          $('browser-window').style.top = b.top;
        }
      }
    } catch (e) {}
  }

  // ============================================================
  // EVENT WIRING
  // ============================================================
  function setupEvents() {
    // Member ID greeting
    $('member-id').addEventListener('change', () => {
      $('nav-greeting').textContent = `Welcome, ${$('member-id').value}`;
    });

    // Login window buttons
    $$('#login-window [data-action]').forEach(btn => {
      btn.addEventListener('click', () => {
        const action = btn.dataset.action;
        if (action === 'connect') startConnect();
        else if (action === 'cancel') {
          // Reset fields
          $('password').value = '';
        } else if (action === 'setup') openAccess();
        else if (action === 'help') {
          alert('NetZero Help: Click "Connect" to start your free dial-up session.\n\nNo password? Sign up at www.netzero.net');
        } else if (action === 'change-number') openAccess();
        else if (action === 'minimize') {
          $('login-window').classList.toggle('minimized');
        } else if (action === 'close') {
          $('login-window').hidden = true;
          saveState();
        }
      });
    });

    // Desktop icons
    $('netzero-icon').addEventListener('click', () => {
      $('login-window').hidden = false;
      bringToFront($('login-window'));
    });
    $('netzero-icon').addEventListener('dblclick', () => {
      $('login-window').hidden = false;
      bringToFront($('login-window'));
    });
    $('recycle-icon').addEventListener('click', openAbout);

    // Status window actions
    $$('#status-window [data-action]').forEach(btn => {
      btn.addEventListener('click', () => {
        const action = btn.dataset.action;
        if (action === 'cancel-dial') cancelDial();
        if (action === 'details') {
          alert('Detailed connection info would appear here.\n\nNegotiated protocol: V.90\nTX/RX rates: 53,333 / 48,000 bps\nCompression: V.42bis\nLocal IP: 63.251.92.45\nRemote IP: 63.251.92.1\nDNS: 207.115.64.1');
        }
      });
    });

    // Browser window actions
    $$('#browser-window [data-action]').forEach(btn => {
      btn.addEventListener('click', () => {
        const action = btn.dataset.action;
        if (action === 'minimize') $('browser-window').classList.toggle('minimized');
        if (action === 'close') {
          $('browser-window').hidden = true;
          state.phase = 'idle';
          setLoginStatus('Ready', null);
          $('tray-state').textContent = 'Disconnected';
          saveState();
        }
      });
    });

    // Browser tabs (decorative click)
    $$('.tab-btn').forEach(tab => {
      tab.addEventListener('click', () => {
        $$('.tab-btn').forEach(t => t.classList.remove('tab-active'));
        tab.classList.add('tab-active');
      });
    });

    // Access dialog
    $$('#access-window [data-action]').forEach(btn => {
      btn.addEventListener('click', () => {
        const action = btn.dataset.action;
        if (action === 'close' || action === 'save-numbers') {
          $('access-window').hidden = true;
        }
      });
    });

    // About dialog
    $$('#about-window [data-action]').forEach(btn => {
      btn.addEventListener('click', () => {
        if (btn.dataset.action === 'close') {
          $('about-window').hidden = true;
        }
      });
    });

    // Access number row selection
    $$('.access-num-row').forEach(row => {
      row.addEventListener('click', () => {
        $$('.access-num-row').forEach(r => r.classList.remove('selected'));
        row.classList.add('selected');
        const num = row.textContent.split(' ')[0];
        $('access-num').value = `1-${num.slice(0, 3)}-${num.slice(4)}`;
      });
    });

    // Mute
    $('tray-mute').addEventListener('click', toggleMute);

    // Start button
    document.querySelector('.start-btn').addEventListener('click', () => {
      const win = $('login-window');
      win.hidden = false;
      bringToFront(win);
    });

    // Click anywhere to bring window to front
    $$('.window').forEach(win => {
      win.addEventListener('mousedown', () => bringToFront(win));
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      if (e.target.matches('input, textarea, select')) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      if (e.key === 'Enter') {
        if (state.phase === 'idle' && !$('login-window').hidden) {
          startConnect();
        }
      } else if (e.key === 'Escape') {
        if (state.phase === 'dialing') {
          cancelDial();
        } else {
          // Close top window
          $$('.window').forEach(w => w.hidden = true);
          saveState();
        }
      } else if (e.key.toLowerCase() === 'm') {
        toggleMute();
      } else if (e.key.toLowerCase() === 'l') {
        $('login-window').hidden = false;
        bringToFront($('login-window'));
      } else if (e.key.toLowerCase() === 'b') {
        if (state.phase === 'connected') {
          $('browser-window').hidden = false;
          bringToFront($('browser-window'));
        }
      }
    });

    // Update tray time
    function updateTrayTime() {
      const d = new Date();
      let h = d.getHours();
      const m = String(d.getMinutes()).padStart(2, '0');
      const ap = h >= 12 ? 'PM' : 'AM';
      h = h % 12 || 12;
      $('tray-time').textContent = `${h}:${m} ${ap}`;
    }
    updateTrayTime();
    setInterval(updateTrayTime, 10000);

    // Update browser session timer
    let sessionSeconds = 0;
    setInterval(() => {
      if (state.phase === 'connected') {
        sessionSeconds++;
        const m = String(Math.floor(sessionSeconds / 60)).padStart(2, '0');
        const s = String(sessionSeconds % 60).padStart(2, '0');
        const bs = document.querySelector('.bs-left');
        if (bs) bs.textContent = `✅ Connected to NetZero · 53.3 kbps · ${m}:${s}`;
      }
    }, 1000);

    // Save on resize
    window.addEventListener('resize', () => {
      fitSignalCanvas();
    });
  }

  // ============================================================
  // INIT
  // ============================================================
  function init() {
    setupWindows();
    setupEvents();
    loadState();
    fitSignalCanvas();
    drawSignal();
    saveState();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();