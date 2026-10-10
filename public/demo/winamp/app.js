/* =============================================================
   Winamp 2 — Web Edition
   Vanilla JS, no build. Audio engine, EQ, spectrum, drag windows.
   ============================================================= */

(() => {
  'use strict';

  // ============================================================
  // CONSTANTS
  // ============================================================
  const EQ_BANDS = [60, 170, 310, 600, 1000, 3000, 6000, 12000, 14000, 16000];
  const EQ_LABELS = ['60', '170', '310', '600', '1K', '3K', '6K', '12K', '14K', '16K'];
  const PRESETS = {
    flat:   [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    rock:   [5, 4, 3, 1, -1, -1, 1, 2, 3, 4],
    bass:   [8, 7, 5, 3, 0, 0, 0, 0, 0, 0],
    treble: [0, 0, 0, 0, 0, 0, 2, 4, 5, 6],
  };
  const DEFAULT_POSITIONS = {
    player:   { x: 24,  y: 24  },
    eq:       { x: 24,  y: 280 },
    playlist: { x: 340, y: 24  },
  };
  const STORAGE_KEY = 'winamp2.state.v1';
  const BAR_COUNT = 19;

  // ============================================================
  // STATE
  // ============================================================
  const state = {
    playlist: [],          // [{name, url, duration?}]
    current: -1,
    isPlaying: false,
    volume: 0.8,
    balance: 0,
    shuffle: false,
    repeat: false,
    eqOn: true,
    eqBands: [...PRESETS.flat],
    preamp: 0,
    positions: cloneObj(DEFAULT_POSITIONS),
    visible: { player: true, eq: false, playlist: false },
    minimized: { player: false, eq: false, playlist: false },
    selected: new Set(),
    zCounter: 1,
  };

  function cloneObj(o) { return JSON.parse(JSON.stringify(o)); }

  function saveState() {
    try {
      const snapshot = {
        volume: state.volume,
        balance: state.balance,
        shuffle: state.shuffle,
        repeat: state.repeat,
        eqOn: state.eqOn,
        eqBands: state.eqBands,
        preamp: state.preamp,
        positions: state.positions,
        visible: state.visible,
        minimized: state.minimized,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
    } catch (e) {}
  }

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw);
      if (typeof saved.volume === 'number') state.volume = saved.volume;
      if (typeof saved.balance === 'number') state.balance = saved.balance;
      if (typeof saved.shuffle === 'boolean') state.shuffle = saved.shuffle;
      if (typeof saved.repeat === 'boolean') state.repeat = saved.repeat;
      if (typeof saved.eqOn === 'boolean') state.eqOn = saved.eqOn;
      if (Array.isArray(saved.eqBands) && saved.eqBands.length === 10) state.eqBands = saved.eqBands;
      if (typeof saved.preamp === 'number') state.preamp = saved.preamp;
      if (saved.positions) state.positions = { ...DEFAULT_POSITIONS, ...saved.positions };
      if (saved.visible) state.visible = { ...state.visible, ...saved.visible };
      if (saved.minimized) state.minimized = { ...state.minimized, ...saved.minimized };
    } catch (e) {}
  }

  // ============================================================
  // AUDIO ENGINE
  // ============================================================
  const audio = new Audio();
  audio.preload = 'auto';
  audio.crossOrigin = 'anonymous';

  let audioCtx = null;
  let source = null;
  let analyser = null;
  const eqFilters = [];
  let preampNode = null;
  let gainNode = null;
  let pannerNode = null;

  function initAudioGraph() {
    if (audioCtx) return;
    const Ctx = window.AudioContext || window.webkitAudioContext;
    audioCtx = new Ctx();
    source = audioCtx.createMediaElementSource(audio);

    preampNode = audioCtx.createGain();
    preampNode.gain.value = Math.pow(10, state.preamp / 20);

    EQ_BANDS.forEach((freq, i) => {
      const f = audioCtx.createBiquadFilter();
      f.type = 'peaking';
      f.frequency.value = freq;
      f.Q.value = 1.2;
      f.gain.value = state.eqOn ? (state.eqBands[i] || 0) : 0;
      eqFilters.push(f);
    });

    gainNode = audioCtx.createGain();
    gainNode.gain.value = state.volume;

    pannerNode = audioCtx.createStereoPanner();
    pannerNode.pan.value = state.balance;

    analyser = audioCtx.createAnalyser();
    analyser.fftSize = 64;
    analyser.smoothingTimeConstant = 0.78;

    // Chain: source -> preamp -> eq chain -> gain -> panner -> analyser -> destination
    source.connect(preampNode);
    let last = preampNode;
    eqFilters.forEach(f => {
      last.connect(f);
      last = f;
    });
    last.connect(gainNode);
    gainNode.connect(pannerNode);
    pannerNode.connect(analyser);
    analyser.connect(audioCtx.destination);
  }

  function applyEqState() {
    if (!audioCtx) return;
    const t = audioCtx.currentTime;
    eqFilters.forEach((f, i) => {
      const target = state.eqOn ? (state.eqBands[i] || 0) : 0;
      f.gain.setTargetAtTime(target, t, 0.02);
    });
    preampNode.gain.setTargetAtTime(Math.pow(10, state.preamp / 20), t, 0.02);
  }

  function applyVolume() {
    if (!audioCtx) return;
    gainNode.gain.setTargetAtTime(state.volume, audioCtx.currentTime, 0.02);
  }

  function applyBalance() {
    if (!audioCtx) return;
    pannerNode.pan.setTargetAtTime(state.balance, audioCtx.currentTime, 0.02);
  }

  // ============================================================
  // PLAYBACK
  // ============================================================
  function playIndex(i) {
    if (i < 0 || i >= state.playlist.length) return;
    state.current = i;
    const track = state.playlist[i];

    initAudioGraph();
    if (audioCtx.state === 'suspended') audioCtx.resume();

    audio.src = track.url;
    const p = audio.play();
    if (p && p.catch) {
      p.catch(err => {
        console.warn('Playback failed:', err);
        state.isPlaying = false;
        renderTransport();
      });
    }
    state.isPlaying = true;
    renderPlaylist();
    renderTransport();
    saveState();
  }

  function play() {
    if (state.playlist.length === 0) return;
    if (state.current < 0) { playIndex(0); return; }
    initAudioGraph();
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const p = audio.play();
    if (p && p.catch) {
      p.catch(err => {
        console.warn('Playback failed:', err);
        state.isPlaying = false;
        renderTransport();
      });
    }
    state.isPlaying = true;
    renderTransport();
  }

  function pause() {
    audio.pause();
    state.isPlaying = false;
    renderTransport();
  }

  function stop() {
    audio.pause();
    audio.currentTime = 0;
    state.isPlaying = false;
    renderTransport();
    updateLCD();
  }

  function next() {
    if (state.playlist.length === 0) return;
    let i;
    if (state.shuffle && state.playlist.length > 1) {
      do { i = Math.floor(Math.random() * state.playlist.length); }
      while (i === state.current);
    } else {
      i = (state.current + 1) % state.playlist.length;
    }
    playIndex(i);
  }

  function prev() {
    if (state.playlist.length === 0) return;
    if (audio.currentTime > 3) {
      audio.currentTime = 0;
      audio.play();
      return;
    }
    const i = (state.current - 1 + state.playlist.length) % state.playlist.length;
    playIndex(i);
  }

  audio.addEventListener('ended', () => {
    if (state.repeat && state.current >= 0) {
      audio.currentTime = 0;
      const p = audio.play();
      if (p && p.catch) p.catch(() => {});
      return;
    }
    next();
  });

  audio.addEventListener('loadedmetadata', () => {
    if (state.current >= 0 && state.playlist[state.current]) {
      const dur = isFinite(audio.duration) ? audio.duration : 0;
      state.playlist[state.current].duration = dur;
      renderPlaylist();
    }
  });

  audio.addEventListener('error', () => {
    state.isPlaying = false;
    renderTransport();
    const titleEl = document.getElementById('lcd-title-text');
    if (titleEl) titleEl.textContent = '(error loading track)';
  });

  // ============================================================
  // HELPERS
  // ============================================================
  function fmt(s) {
    if (!isFinite(s) || s < 0) return '00:00';
    s = Math.floor(s);
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
    return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[c]);
  }

  function stripExt(name) {
    return name.replace(/\.[^.]+$/, '');
  }

  // ============================================================
  // RENDER — LCD, transport, playlist
  // ============================================================
  function updateLCD() {
    const cur = audio.currentTime || 0;
    const dur = isFinite(audio.duration) ? audio.duration : 0;
    document.getElementById('lcd-time').textContent = `${fmt(cur)} / ${fmt(dur)}`;

    const track = state.playlist[state.current];
    const titleEl = document.getElementById('lcd-title-text');
    const titleContainer = titleEl.parentElement;
    const newText = track ? stripExt(track.name) : 'Drop or add tracks to play...';

    if (titleEl.textContent !== newText) {
      titleEl.textContent = newText;
      // Restart animation
      titleEl.style.animation = 'none';
      void titleEl.offsetWidth;
      titleEl.style.animation = '';
    }

    // Marquee when text overflows
    requestAnimationFrame(() => {
      const overflow = titleEl.scrollWidth - titleContainer.clientWidth;
      titleContainer.classList.toggle('marquee', overflow > 4 && state.current >= 0);
    });

    const hasAudio = state.playlist.length > 0;
    document.getElementById('lcd-bitrate').textContent = hasAudio ? '128' : '---';
    document.getElementById('lcd-bitrate').classList.toggle('active', hasAudio);
    document.getElementById('lcd-sr').textContent = hasAudio ? '44' : '--';
    document.getElementById('lcd-sr').classList.toggle('active', hasAudio);
    document.getElementById('lcd-mode').textContent = hasAudio ? 'STEREO' : '----';
    document.getElementById('lcd-mode').classList.toggle('active', hasAudio);
  }

  function renderTransport() {
    document.querySelector('.t-play').classList.toggle('playing', state.isPlaying);
    document.querySelector('.t-pause').classList.toggle('playing', !state.isPlaying && state.current >= 0);
  }

  function renderPlaylist() {
    const container = document.getElementById('pl-list');
    container.innerHTML = '';
    state.playlist.forEach((track, i) => {
      const row = document.createElement('div');
      row.className = 'pl-row';
      if (i === state.current) row.classList.add('current');
      if (state.selected.has(i)) row.classList.add('selected');
      row.dataset.idx = i;
      row.innerHTML = `
        <span class="pl-idx">${(i + 1).toString().padStart(2, '0')}.</span>
        <span class="pl-name" title="${escapeHtml(track.name)}">${escapeHtml(track.name)}</span>
        <span class="pl-time">${track.duration ? fmt(track.duration) : '--:--'}</span>
      `;
      row.addEventListener('click', (e) => onRowClick(i, e));
      row.addEventListener('dblclick', () => playIndex(i));
      container.appendChild(row);
    });
    document.getElementById('pl-empty').classList.toggle('hidden', state.playlist.length > 0);
    updatePlaylistLength();
  }

  function onRowClick(i, e) {
    if (e.shiftKey && state.selected.size > 0) {
      const last = Math.max(...state.selected);
      const [a, b] = i > last ? [last, i] : [i, last];
      state.selected.clear();
      for (let j = a; j <= b; j++) state.selected.add(j);
    } else if (e.metaKey || e.ctrlKey) {
      if (state.selected.has(i)) state.selected.delete(i);
      else state.selected.add(i);
    } else {
      state.selected.clear();
      state.selected.add(i);
    }
    renderPlaylist();
  }

  function updatePlaylistLength() {
    let total = 0;
    state.playlist.forEach(t => total += t.duration || 0);
    const len = state.playlist.length;
    document.getElementById('pl-len').textContent =
      `${len} file${len === 1 ? '' : 's'} · ${fmt(total)}`;
  }

  // ============================================================
  // SPECTRUM
  // ============================================================
  const specCanvas = document.getElementById('spectrum');
  const specCtx = specCanvas.getContext('2d');

  function drawSpectrum() {
    const c = specCanvas;
    specCtx.clearRect(0, 0, c.width, c.height);

    if (!analyser || !state.isPlaying || audio.paused || state.current < 0) {
      drawIdleSpectrum();
      return;
    }

    const data = new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteFrequencyData(data);

    const barW = c.width / BAR_COUNT;
    for (let i = 0; i < BAR_COUNT; i++) {
      // Logarithmic-ish bin mapping
      const idx = Math.floor(Math.pow(i / (BAR_COUNT - 1), 1.7) * (data.length - 1));
      const v = data[idx] / 255;
      const h = Math.max(2, v * c.height);
      const x = i * barW;
      const y = c.height - h;

      const grad = specCtx.createLinearGradient(0, y, 0, c.height);
      grad.addColorStop(0, '#b6ff5a');
      grad.addColorStop(0.4, '#6fff38');
      grad.addColorStop(0.75, '#39b300');
      grad.addColorStop(1, '#1f5e00');
      specCtx.fillStyle = grad;
      specCtx.fillRect(x + 1, y, Math.max(1, barW - 2), h);

      // Bright cap
      specCtx.fillStyle = '#e0ffa8';
      specCtx.fillRect(x + 1, y, Math.max(1, barW - 2), 1);
    }
  }

  function drawIdleSpectrum() {
    const c = specCanvas;
    const barW = c.width / BAR_COUNT;
    specCtx.fillStyle = '#1f5e00';
    for (let i = 0; i < BAR_COUNT; i++) {
      const x = i * barW;
      specCtx.fillRect(x + 1, c.height - 2, Math.max(1, barW - 2), 2);
    }
  }

  // ============================================================
  // SLIDERS — generic drag vertical/horizontal helper
  // ============================================================
  function makeVSlider(track, fill, knob, opts) {
    let dragging = false;
    function update(e) {
      const r = track.getBoundingClientRect();
      const pct = 1 - Math.max(0, Math.min(1, (e.clientY - r.top) / r.height));
      opts.onChange(pct);
      opts.setVisual(pct);
    }
    track.addEventListener('mousedown', (e) => {
      dragging = true;
      update(e);
      e.preventDefault();
    });
    window.addEventListener('mousemove', (e) => { if (dragging) update(e); });
    window.addEventListener('mouseup', () => { if (dragging) { dragging = false; saveState(); } });
    opts.setVisual(opts.initPct);
    return { set: (pct) => opts.setVisual(pct) };
  }

  function makeHSlider(track, knob, opts) {
    let dragging = false;
    function update(e) {
      const r = track.getBoundingClientRect();
      const pct = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width));
      opts.onChange(pct);
      opts.setVisual(pct);
    }
    track.addEventListener('mousedown', (e) => {
      dragging = true;
      update(e);
      e.preventDefault();
    });
    window.addEventListener('mousemove', (e) => { if (dragging) update(e); });
    window.addEventListener('mouseup', () => { if (dragging) { dragging = false; saveState(); } });
    opts.setVisual(opts.initPct);
    return { set: (pct) => opts.setVisual(pct) };
  }

  // ============================================================
  // VOLUME
  // ============================================================
  function setupVolume() {
    makeVSlider(
      document.getElementById('vol-track'),
      document.getElementById('vol-fill'),
      document.getElementById('vol-knob'),
      {
        initPct: state.volume,
        onChange: (pct) => { state.volume = pct; applyVolume(); },
        setVisual: (pct) => {
          document.getElementById('vol-fill').style.height = (pct * 100) + '%';
          document.getElementById('vol-knob').style.top = `calc(${(1 - pct) * 100}% - 2px)`;
        },
      }
    );
  }

  // ============================================================
  // BALANCE
  // ============================================================
  function setupBalance() {
    makeHSlider(
      document.getElementById('bal-track'),
      document.getElementById('bal-knob'),
      {
        initPct: (state.balance + 1) / 2,
        onChange: (pct) => { state.balance = (pct - 0.5) * 2; applyBalance(); },
        setVisual: (pct) => {
          document.getElementById('bal-knob').style.left = `calc(${pct * 100}% - 1px)`;
        },
      }
    );
  }

  // ============================================================
  // EQ BANDS
  // ============================================================
  function setupEqBands() {
    const container = document.getElementById('eq-bands');
    const labels = document.getElementById('eq-labels');
    EQ_BANDS.forEach((_, i) => {
      const band = document.createElement('div');
      band.className = 'eq-band';
      band.innerHTML = `
        <div class="eq-fader-val" data-band="${i}">+0.0</div>
        <div class="eq-fader-track" data-band="${i}">
          <div class="eq-fader-fill"></div>
          <div class="eq-fader-knob"></div>
        </div>
      `;
      container.appendChild(band);

      const label = document.createElement('div');
      label.textContent = EQ_LABELS[i];
      labels.appendChild(label);

      const track = band.querySelector('.eq-fader-track');
      const knob = band.querySelector('.eq-fader-knob');
      const fill = band.querySelector('.eq-fader-fill');
      const valEl = band.querySelector('.eq-fader-val');
      const initGain = state.eqBands[i] || 0;

      makeVSlider(track, fill, knob, {
        initPct: 0.5 - initGain / 24,
        onChange: (pct) => {
          const gain = Math.max(-12, Math.min(12, (0.5 - pct) * 24));
          state.eqBands[i] = gain;
          if (eqFilters[i]) {
            eqFilters[i].gain.setTargetAtTime(state.eqOn ? gain : 0, audioCtx.currentTime, 0.02);
          }
          valEl.textContent = (gain >= 0 ? '+' : '') + gain.toFixed(1);
          updateEqFill(fill, pct);
        },
        setVisual: (pct) => {
          knob.style.top = `${pct * 100}%`;
          updateEqFill(fill, pct);
        },
      });

      valEl.textContent = (initGain >= 0 ? '+' : '') + initGain.toFixed(1);
      updateEqFill(fill, 0.5 - initGain / 24);
    });
  }

  function updateEqFill(fill, pct) {
    if (pct <= 0.5) {
      // Above center — fill from current pct to 50%
      fill.style.top = `${pct * 100}%`;
      fill.style.height = `${(0.5 - pct) * 100}%`;
    } else {
      // Below center — fill from 50% to current pct
      fill.style.top = '50%';
      fill.style.height = `${(pct - 0.5) * 100}%`;
    }
  }

  // ============================================================
  // PREAMP
  // ============================================================
  function setupPreamp() {
    const track = document.getElementById('preamp-track');
    const knob = document.getElementById('preamp-knob');
    const valEl = document.getElementById('preamp-val');
    const initGain = state.preamp;

    makeVSlider(track, null, knob, {
      initPct: 0.5 - initGain / 24,
      onChange: (pct) => {
        const gain = Math.max(-12, Math.min(12, (0.5 - pct) * 24));
        state.preamp = gain;
        if (preampNode) preampNode.gain.setTargetAtTime(Math.pow(10, gain / 20), audioCtx.currentTime, 0.02);
        valEl.textContent = (gain >= 0 ? '+' : '') + gain.toFixed(1) + ' dB';
      },
      setVisual: (pct) => {
        knob.style.top = `${pct * 100}%`;
      },
    });
    valEl.textContent = (initGain >= 0 ? '+' : '') + initGain.toFixed(1) + ' dB';
  }

  // ============================================================
  // WINDOWS — drag, minimize, close, z-order
  // ============================================================
  function setupWindows() {
    document.querySelectorAll('.win').forEach(win => {
      const name = win.dataset.window;
      const pos = state.positions[name] || DEFAULT_POSITIONS[name];
      win.style.left = pos.x + 'px';
      win.style.top = pos.y + 'px';

      if (!state.visible[name]) win.hidden = true;
      if (state.minimized[name]) win.classList.add('minimized');

      const titlebar = win.querySelector('.titlebar');
      let dragging = false, sx, sy, wx, wy;
      titlebar.addEventListener('mousedown', (e) => {
        if (e.target.closest('.title-buttons')) return;
        dragging = true;
        win.classList.remove('minimized');
        state.minimized[name] = false;
        sx = e.clientX; sy = e.clientY;
        wx = win.offsetLeft; wy = win.offsetTop;
        win.style.zIndex = ++state.zCounter;
        e.preventDefault();
      });
      window.addEventListener('mousemove', (e) => {
        if (!dragging) return;
        win.style.left = (wx + e.clientX - sx) + 'px';
        win.style.top = (wy + e.clientY - sy) + 'px';
      });
      window.addEventListener('mouseup', () => {
        if (!dragging) return;
        dragging = false;
        state.positions[name] = { x: win.offsetLeft, y: win.offsetTop };
        saveState();
      });

      win.addEventListener('mousedown', () => {
        win.style.zIndex = ++state.zCounter;
      });

      win.querySelectorAll('[data-action]').forEach(btn => {
        const action = btn.dataset.action;
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          if (action === 'minimize') {
            win.classList.toggle('minimized');
            state.minimized[name] = win.classList.contains('minimized');
            saveState();
          } else if (action === 'close') {
            win.hidden = true;
            state.visible[name] = false;
            if (name === 'eq') document.querySelector('.eq-btn').classList.remove('active');
            if (name === 'playlist') document.querySelector('.pl-btn').classList.remove('active');
            saveState();
          }
        });
      });
    });
  }

  function showWindow(name) {
    const win = document.querySelector(`.win[data-window="${name}"]`);
    if (!win) return;
    win.hidden = false;
    win.classList.remove('minimized');
    state.visible[name] = true;
    state.minimized[name] = false;
    win.style.zIndex = ++state.zCounter;
    saveState();
  }

  function toggleWindow(name) {
    const win = document.querySelector(`.win[data-window="${name}"]`);
    if (!win) return;
    if (win.hidden) {
      showWindow(name);
    } else if (win.classList.contains('minimized')) {
      win.classList.remove('minimized');
      state.minimized[name] = false;
      saveState();
    } else {
      win.hidden = true;
      state.visible[name] = false;
      if (name === 'eq') document.querySelector('.eq-btn').classList.remove('active');
      if (name === 'playlist') document.querySelector('.pl-btn').classList.remove('active');
      saveState();
    }
  }

  // ============================================================
  // BUTTONS
  // ============================================================
  function setupButtons() {
    document.querySelectorAll('.t-btn').forEach(btn => {
      btn.addEventListener('click', () => handleAction(btn.dataset.action));
    });
    document.querySelectorAll('.tgl-btn').forEach(btn => {
      btn.addEventListener('click', () => handleAction(btn.dataset.action));
    });

    // EQ on/off
    document.querySelector('[data-action="eq-toggle"]').addEventListener('click', (e) => {
      state.eqOn = !state.eqOn;
      e.currentTarget.classList.toggle('on', state.eqOn);
      applyEqState();
      saveState();
    });

    // EQ presets
    document.querySelectorAll('.eq-preset-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const name = btn.dataset.preset;
        document.querySelectorAll('.eq-preset-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        if (PRESETS[name]) {
          state.eqBands = [...PRESETS[name]];
          applyEqState();
          document.querySelectorAll('.eq-band').forEach((bandEl, i) => {
            const g = state.eqBands[i];
            const pct = 0.5 - g / 24;
            bandEl.querySelector('.eq-fader-knob').style.top = `${pct * 100}%`;
            updateEqFill(bandEl.querySelector('.eq-fader-fill'), pct);
            bandEl.querySelector('.eq-fader-val').textContent = (g >= 0 ? '+' : '') + g.toFixed(1);
          });
          saveState();
        }
      });
    });

    // Playlist toolbar
    document.querySelector('[data-action="pl-add"]').addEventListener('click', () => {
      document.getElementById('file-input').click();
    });

    document.querySelector('[data-action="pl-remove"]').addEventListener('click', () => {
      if (state.selected.size === 0) return;
      const toRemove = [...state.selected].sort((a, b) => b - a);
      toRemove.forEach(i => {
        if (state.playlist[i]) URL.revokeObjectURL(state.playlist[i].url);
        state.playlist.splice(i, 1);
      });
      if (toRemove.includes(state.current)) {
        state.current = -1;
        audio.pause();
        audio.src = '';
        state.isPlaying = false;
        renderTransport();
      } else if (state.current > 0) {
        const removedBefore = toRemove.filter(e => e < state.current).length;
        state.current -= removedBefore;
      }
      state.selected.clear();
      renderPlaylist();
      saveState();
    });

    document.querySelector('[data-action="pl-select-all"]').addEventListener('click', () => {
      state.selected.clear();
      state.playlist.forEach((_, i) => state.selected.add(i));
      renderPlaylist();
    });

    document.querySelector('[data-action="pl-clear"]').addEventListener('click', () => {
      if (state.playlist.length === 0) return;
      if (!confirm('Clear the entire playlist?')) return;
      state.playlist.forEach(t => URL.revokeObjectURL(t.url));
      state.playlist = [];
      state.current = -1;
      state.selected.clear();
      audio.pause();
      audio.src = '';
      state.isPlaying = false;
      renderTransport();
      renderPlaylist();
      saveState();
    });
  }

  function handleAction(action) {
    switch (action) {
      case 'play':     play(); break;
      case 'pause':    pause(); break;
      case 'stop':     stop(); break;
      case 'next':     next(); break;
      case 'prev':     prev(); break;
      case 'eject':    document.getElementById('file-input').click(); break;
      case 'shuffle':
        state.shuffle = !state.shuffle;
        document.querySelector('.shuffle').classList.toggle('active', state.shuffle);
        saveState();
        break;
      case 'repeat':
        state.repeat = !state.repeat;
        document.querySelector('.repeat').classList.toggle('active', state.repeat);
        saveState();
        break;
      case 'toggle-eq':
        toggleWindow('eq');
        document.querySelector('.eq-btn').classList.toggle('active', !document.querySelector('.win-eq').hidden);
        break;
      case 'toggle-pl':
        toggleWindow('playlist');
        document.querySelector('.pl-btn').classList.toggle('active', !document.querySelector('.win-pl').hidden);
        break;
    }
  }

  // ============================================================
  // FILE INPUT + DRAG/DROP
  // ============================================================
  function setupFiles() {
    const input = document.getElementById('file-input');
    input.addEventListener('change', (e) => {
      addFiles([...e.target.files]);
      input.value = '';
    });

    let dragCounter = 0;
    const isFileDrag = (e) =>
      e.dataTransfer && e.dataTransfer.types && Array.from(e.dataTransfer.types).includes('Files');

    window.addEventListener('dragenter', (e) => {
      if (!isFileDrag(e)) return;
      e.preventDefault();
      dragCounter++;
      document.body.classList.add('drag-over');
    });
    window.addEventListener('dragleave', () => {
      dragCounter = Math.max(0, dragCounter - 1);
      if (dragCounter === 0) document.body.classList.remove('drag-over');
    });
    window.addEventListener('dragover', (e) => {
      if (!isFileDrag(e)) return;
      e.preventDefault();
    });
    window.addEventListener('drop', (e) => {
      e.preventDefault();
      dragCounter = 0;
      document.body.classList.remove('drag-over');
      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        addFiles([...e.dataTransfer.files]);
      }
    });
  }

  function addFiles(files) {
    const audioFiles = files.filter(f =>
      f.type.startsWith('audio/') || /\.(mp3|wav|ogg|m4a|flac|opus|aac)$/i.test(f.name)
    );
    if (audioFiles.length === 0) {
      alert('No audio files found. Drop MP3, WAV, OGG, M4A, FLAC, or OPUS files.');
      return;
    }

    showWindow('playlist');
    document.querySelector('.pl-btn').classList.add('active');

    const startIdx = state.playlist.length;
    audioFiles.forEach(f => {
      state.playlist.push({
        name: f.name,
        url: URL.createObjectURL(f),
        duration: 0,
      });
    });

    if (state.current < 0) {
      playIndex(startIdx);
    } else {
      renderPlaylist();
    }
  }

  // ============================================================
  // KEYBOARD
  // ============================================================
  function setupKeys() {
    document.addEventListener('keydown', (e) => {
      if (e.target.matches('input, textarea')) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      switch (e.key.toLowerCase()) {
        case 'x': play();  e.preventDefault(); break;
        case 'c': pause(); e.preventDefault(); break;
        case 'v': stop();  e.preventDefault(); break;
        case 'b': next();  e.preventDefault(); break;
        case 'z': prev();  e.preventDefault(); break;
        case 'e': handleAction('toggle-eq'); e.preventDefault(); break;
        case 'l': handleAction('toggle-pl'); e.preventDefault(); break;
      }
    });
  }

  // ============================================================
  // TICK
  // ============================================================
  function tick() {
    updateLCD();
    drawSpectrum();
    requestAnimationFrame(tick);
  }

  // ============================================================
  // INIT
  // ============================================================
  function init() {
    loadState();
    setupWindows();
    setupButtons();
    setupFiles();
    setupKeys();
    setupBalance();
    setupEqBands();
    setupPreamp();
    setupVolume();

    document.querySelector('.shuffle').classList.toggle('active', state.shuffle);
    document.querySelector('.repeat').classList.toggle('active', state.repeat);
    document.querySelector('.eq-btn').classList.toggle('active', state.visible.eq);
    document.querySelector('.pl-btn').classList.toggle('active', state.visible.playlist);
    document.querySelector('[data-action="eq-toggle"]').classList.toggle('on', state.eqOn);

    renderPlaylist();
    tick();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();