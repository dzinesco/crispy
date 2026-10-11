/* =============================================================
   iPod — Web Edition
   Vanilla JS, no build. The screen is a <canvas>; click wheel
   drives navigation; two playback engines (demo MP3 + Spotify).
   ============================================================= */

(() => {
  'use strict';

  // ============================================================
  // CONSTANTS
  // ============================================================
  const CANVAS_W = 320;
  const CANVAS_H = 240;

  // iPod aesthetic palette — classic monochrome (backlit) LCD
  const COL = {
    bg:        '#c9d1c0',  // pale gray-green backlight (top)
    bgDeep:    '#b8c2ae',  // backlight (bottom)
    bgHi:      '#101010',  // inverted selection bar
    bgHiLine:  '#101010',
    bgAlt:     'transparent',
    text:      '#101010',
    textDim:   '#2e3429',
    textInverse:'#d4dbcb',
    rule:      '#101010',
    ruleSoft:  '#101010',
    progress:  '#101010',
    progressBg:'#c9d1c0',
    accent:    '#101010',
  };

  // Font used on the LCD. Pixelated rendering gives the bitmap look.
  const LCD_FONT = '"Chicago", "ChicagoFLF", "Pixelify Sans", "VT323", monospace';

  // Status icons (drawn on canvas)
  const ICON = {
    play: '▶',
    pause: '⏸',
    battery: '█',
    batteryLow: '▌',
    lock: '🔒', // drawn as shape, not emoji
    shuffle: '⇄',
  };

  // Sample/demo tracks (royalty-free SoundHelix songs)
  const DEMO_TRACKS = [
    { id: 'd1', title: 'SoundHelix Song 1',  artist: 'T. Schürger', durationMs: 372000,
      url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
      art: null },
    { id: 'd2', title: 'SoundHelix Song 2',  artist: 'T. Schürger', durationMs: 388000,
      url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3',
      art: null },
    { id: 'd3', title: 'SoundHelix Song 3',  artist: 'T. Schürger', durationMs: 423000,
      url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3',
      art: null },
    { id: 'd4', title: 'SoundHelix Song 4',  artist: 'T. Schürger', durationMs: 398000,
      url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3',
      art: null },
    { id: 'd5', title: 'SoundHelix Song 5',  artist: 'T. Schürger', durationMs: 421000,
      url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-5.mp3',
      art: null },
    { id: 'd6', title: 'SoundHelix Song 6',  artist: 'T. Schürger', durationMs: 415000,
      url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-6.mp3',
      art: null },
    { id: 'd7', title: 'SoundHelix Song 7',  artist: 'T. Schürger', durationMs: 447000,
      url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-7.mp3',
      art: null },
    { id: 'd8', title: 'SoundHelix Song 8',  artist: 'T. Schürger', durationMs: 432000,
      url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-8.mp3',
      art: null },
  ];

  const STORAGE = {
    clientId: 'ipod.clientId.v1',
    tokens: 'ipod.tokens.v1',
    volume: 'ipod.volume.v1',
  };

  // ============================================================
  // STATE
  // ============================================================
  const state = {
    // Navigation
    stack: [],                          // [{screen, props}]
    selected: 0,                       // index of selected row in current screen
    scroll: 0,                         // top row of viewport
    rowsPerScreen: 7,                  // visible rows in list screens
    mode: 'menu',                      // 'menu' | 'nowPlaying' | 'search'
    searchInput: '',                   // current text being entered in search
    searchCharIndex: 0,                // cursor index in keyboard layout
    // User-added tracks
    library: [],                       // [{id,title,artist,durationMs,url,art}]
    // Playback
    queue: [],                         // current play queue
    queueIndex: -1,
    isPlaying: false,
    positionMs: 0,
    durationMs: 0,
    volume: 0.7,                       // 0..1
    shuffle: false,
    // Spotify
    spotify: {
      accessToken: null,
      refreshToken: null,
      expiresAt: 0,
      user: null,                      // {id,display_name}
      player: null,
      deviceId: null,
      connected: false,                // SDK ready
      premium: false,                  // user is premium (Web Playback requires it)
    },
    // Demo playback element (lazy-created)
    audioEl: null,
  };

  // ============================================================
  // UTIL
  // ============================================================
  const $ = (sel) => document.querySelector(sel);
  const canvas = $('#screen-canvas');
  const ctx = canvas.getContext('2d');

  function saveTokens() {
    try {
      localStorage.setItem(STORAGE.tokens, JSON.stringify({
        accessToken: state.spotify.accessToken,
        refreshToken: state.spotify.refreshToken,
        expiresAt: state.spotify.expiresAt,
        user: state.spotify.user,
      }));
    } catch (e) {}
  }
  function loadTokens() {
    try {
      const raw = localStorage.getItem(STORAGE.tokens);
      if (!raw) return;
      const t = JSON.parse(raw);
      Object.assign(state.spotify, t);
    } catch (e) {}
  }
  function saveClientId(id) {
    localStorage.setItem(STORAGE.clientId, id);
  }
  function loadClientId() {
    return localStorage.getItem(STORAGE.clientId) || '';
  }
  function saveVolume() {
    localStorage.setItem(STORAGE.volume, String(state.volume));
  }
  function loadVolume() {
    const v = parseFloat(localStorage.getItem(STORAGE.volume));
    if (!isNaN(v)) state.volume = Math.max(0, Math.min(1, v));
  }

  function fmtTime(ms) {
    if (!ms || ms < 0) ms = 0;
    const s = Math.floor(ms / 1000);
    const m = Math.floor(s / 60);
    const ss = String(s % 60).padStart(2, '0');
    return `${m}:${ss}`;
  }

  function uid() {
    return Math.random().toString(36).slice(2, 10);
  }

  // ============================================================
  // NAVIGATION
  // ============================================================
  function pushScreen(screen, props = {}) {
    state.stack.push({ screen, props });
    state.selected = 0;
    state.scroll = 0;
    state.mode = 'menu';
    render();
  }
  function popScreen() {
    if (state.stack.length <= 1) return; // can't pop root
    state.stack.pop();
    state.selected = 0;
    state.scroll = 0;
    state.mode = 'menu';
    render();
  }
  function currentScreen() {
    if (state.stack.length === 0) return null;
    return state.stack[state.stack.length - 1].screen;
  }
  function currentProps() {
    if (state.stack.length === 0) return {};
    return state.stack[state.stack.length - 1].props;
  }

  function rootMenu() {
    state.stack = [];
    pushScreen('mainMenu');
  }

  // ============================================================
  // CANVAS RENDERING
  // ============================================================
  const ROW_H = 30;
  const TITLE_H = 28;
  const STATUS_H = 2;
  const FOOTER_H = 0;
  const PAD = 4;
  const CONTENT_TOP = TITLE_H;
  const CONTENT_BOTTOM = CANVAS_H - STATUS_H - FOOTER_H;

  function clearBg() {
    // Reset any leaked context state so frames never ghost/overlap
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.filter = 'none';
    ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
    // Slight vertical gradient for the LCD
    const g = ctx.createLinearGradient(0, 0, 0, CANVAS_H);
    g.addColorStop(0, COL.bg);
    g.addColorStop(1, COL.bgDeep);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
  }

  function drawTitleBar(title) {
    // Classic mono iPod: centered title, thin black rule, play glyph left, battery right.
    ctx.fillStyle = COL.text;
    ctx.font = `600 19px ${LCD_FONT}`;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'center';
    ctx.fillText(truncate(title, 24), CANVAS_W / 2, TITLE_H / 2 + 1);
    ctx.fillRect(0, TITLE_H - 1, CANVAS_W, 1);
    drawPlayIndicator(8, 8);
    drawBatteryIcon(CANVAS_W - 30, 8);
  }

  function drawBatteryIcon(x, y) {
    // Outlined battery with segmented charge (1-bit pixels)
    ctx.fillStyle = COL.text;
    ctx.fillRect(x, y + 2, 18, 1); ctx.fillRect(x, y + 10, 18, 1);
    ctx.fillRect(x, y + 2, 1, 9);  ctx.fillRect(x + 17, y + 2, 1, 9);
    ctx.fillRect(x + 18, y + 4, 2, 5);
    for (let i = 0; i < 3; i++) ctx.fillRect(x + 2 + i * 5, y + 4, 4, 5);
  }

  function drawPlayIndicator(x, y) {
    if (!state.isPlaying) return;
    // Pixel triangle
    ctx.fillStyle = COL.text;
    for (let i = 0; i < 5; i++) ctx.fillRect(x + i, y + 2 + i, 1, 9 - i * 2);
  }

  function drawStatusBar() {
    const y = CANVAS_H - STATUS_H;
    // Thin top rule
    ctx.fillStyle = COL.ruleSoft;
    ctx.fillRect(0, y, CANVAS_W, 1);
  }

  function drawRow(y, label, sublabel, isSelected, isDim, arrow) {
    const x = PAD;
    const w = CANVAS_W - PAD * 2;

    // Row background
    if (isSelected) {
      // Solid black inverted bar, full width (classic mono iPod)
      ctx.fillStyle = COL.bgHi;
      ctx.fillRect(0, y, CANVAS_W - 7, ROW_H);
    }

    // Label
    ctx.fillStyle = isSelected ? COL.textInverse : (isDim ? COL.textDim : COL.text);
    ctx.font = `600 20px ${LCD_FONT}`;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    ctx.fillText(truncate(label, sublabel ? 17 : 24), x + 6, y + ROW_H / 2);

    if (sublabel) {
      ctx.fillStyle = isSelected ? COL.textInverse : COL.textDim;
      ctx.font = `15px ${LCD_FONT}`;
      ctx.textAlign = 'right';
      ctx.fillText(truncate(sublabel, 10), x + w - (arrow ? 20 : 8), y + ROW_H / 2);
    }

    // Disclosure arrow
    if (arrow) {
      ctx.fillStyle = isSelected ? COL.textInverse : COL.text;
      ctx.font = `600 20px ${LCD_FONT}`;
      ctx.textAlign = 'right';
      ctx.fillText('>', x + w - 6, y + ROW_H / 2 + 1);
    }
  }

  function drawListScreen(title, items, opts = {}) {
    drawTitleBar(title);
    drawStatusBar();
    // Footer hints
    drawFooter(opts.hints);

    const viewH = CONTENT_BOTTOM - CONTENT_TOP - (opts.footerHint ? 0 : 0);
    const rowsVisible = Math.floor(viewH / ROW_H);
    state.rowsPerScreen = rowsVisible;

    // Adjust scroll so selected is visible
    if (state.selected < state.scroll) state.scroll = state.selected;
    if (state.selected >= state.scroll + rowsVisible) {
      state.scroll = state.selected - rowsVisible + 1;
    }
    state.scroll = Math.max(0, Math.min(state.scroll, Math.max(0, items.length - rowsVisible)));

    const startY = CONTENT_TOP;
    for (let i = 0; i < rowsVisible; i++) {
      const idx = i + state.scroll;
      if (idx >= items.length) break;
      const item = items[idx];
      drawRow(
        startY + i * ROW_H,
        item.label,
        item.sublabel,
        idx === state.selected,
        !!item.dim,
        !!item.arrow,
      );
    }

    // Scroll indicator on right edge
    if (items.length > rowsVisible) {
      const trackH = CONTENT_BOTTOM - CONTENT_TOP;
      const trackX = CANVAS_W - 6;
      ctx.fillStyle = COL.text;
      ctx.strokeStyle = COL.text; ctx.lineWidth = 1;
      ctx.strokeRect(trackX + 0.5, CONTENT_TOP + 1.5, 5, trackH - 3);
      const thumbH = Math.max(8, Math.floor((rowsVisible / items.length) * trackH));
      const thumbY = CONTENT_TOP + 1 + Math.floor((state.scroll / items.length) * (trackH - thumbH));
      ctx.fillStyle = COL.text;
      ctx.fillRect(trackX, thumbY, 6, thumbH);
    }
  }

  function drawFooter(hints) {
    // Footer hint sits in the dedicated footer strip (between content and status).
    const y = CANVAS_H - STATUS_H - FOOTER_H;
    if (hints && FOOTER_H > 0) {
      ctx.fillStyle = COL.textDim;
      ctx.font = `9px ${LCD_FONT}`;
      ctx.textBaseline = 'middle';
      ctx.textAlign = 'left';
      ctx.fillText(truncate(hints, 46), PAD + 1, y + FOOTER_H / 2 + 1);
    }
  }

  // ----- Screens -----

  function renderMainMenu() {
    const items = [];

    if (state.isPlaying) {
      items.push({ label: 'Now Playing', arrow: true, sublabel: truncate(shortTrackLabel(), 14) });
    }

    items.push({ label: 'Music', arrow: true });
    items.push({ label: 'Search', arrow: true });

    if (state.spotify.accessToken) {
      items.push({
        label: 'Sign Out',
        sublabel: truncate(state.spotify.user?.display_name || 'Spotify', 14),
      });
    } else if (state.spotify.clientIdConfigured) {
      items.push({ label: 'Sign in to Spotify', arrow: true });
    } else {
      items.push({ label: 'Connect Spotify', arrow: true });
    }

    items.push({ label: 'Settings', arrow: true });
    items.push({ label: 'About', arrow: true });

    drawListScreen('iPod', items, {
      hints: state.isPlaying ? `▶ ${truncate(shortTrackLabel(), 38)}` : 'Ready',
    });
  }

  function shortTrackLabel() {
    const t = currentTrack();
    return t ? `${t.title} — ${t.artist}` : '';
  }

  function currentTrack() {
    if (state.queueIndex < 0 || state.queueIndex >= state.queue.length) return null;
    return state.queue[state.queueIndex];
  }

  function renderMusicMenu() {
    const items = [
      { label: 'Browse', arrow: true, sublabel: state.spotify.accessToken ? 'Featured' : 'Demo' },
      { label: 'Playlists', arrow: true, sublabel: state.spotify.accessToken ? '' : 'Demo' },
      { label: 'Albums', arrow: true },
      { label: 'Artists', arrow: true },
    ];
    drawListScreen('Music', items, { hints: state.spotify.accessToken ? '● Spotify' : '● Demo mode' });
  }

  function renderBrowseMenu() {
    const featured = [
      'Today’s Top Hits',
      'RapCaviar',
      'All Time Greatest',
      'Rock Classics',
      'Lo-Fi Beats',
    ];
    const items = [
      ...featured.map(name => ({ label: name, sublabel: 'Featured', arrow: true })),
      ...DEMO_TRACKS.map(t => ({ label: t.title, sublabel: t.artist, arrow: true })),
    ];
    drawListScreen('Browse', items, {
      hints: state.spotify.accessToken ? '● Spotify preview' : '● Demo library',
    });
  }

  function renderPlaylistDetail(name) {
    const tracks = state.queue.length
      ? state.queue
      : DEMO_TRACKS;
    const items = tracks.map((t, i) => ({
      label: t.title,
      sublabel: t.artist,
      arrow: false,
    }));
    // Mark current
    const drawItems = items.map((it, i) => {
      const cur = currentTrack();
      if (cur && tracks[i].id === cur.id) {
        return { ...it, label: `▶ ${it.label}`, sublabel: it.sublabel };
      }
      return it;
    });
    drawListScreen(name, drawItems, { hints: `${tracks.length} tracks` });
  }

  function renderSettings() {
    const id = loadClientId();
    const masked = id ? id.slice(0, 6) + '…' + id.slice(-4) : 'Not set';
    const signed = !!state.spotify.accessToken;
    const user = state.spotify.user?.display_name || 'Not signed in';

    const items = [
      { label: 'Spotify Client ID', sublabel: masked, arrow: true },
      { label: 'Spotify Account',   sublabel: signed ? user : 'Sign in', arrow: true },
      { label: 'Spotify Status',    sublabel: spotifyStatusLabel() },
      { label: 'Playback Mode',     sublabel: state.spotify.accessToken ? 'Spotify (Premium)' : 'Demo MP3' },
      { label: 'Volume',            sublabel: `${Math.round(state.volume * 100)}%` },
      { label: 'Reset Demo Library',sublabel: 'Reset' },
    ];
    drawListScreen('Settings', items, { hints: '● iPod OS Web Edition' });
  }

  function spotifyStatusLabel() {
    if (!state.spotify.clientIdConfigured) return 'No Client ID';
    if (!state.spotify.accessToken) return 'Ready to sign in';
    if (!state.spotify.connected) return 'Signed in (web only)';
    if (!state.spotify.premium) return 'Signed in (no Premium)';
    return 'Connected';
  }

  function renderAbout() {
    drawTitleBar('About');
    drawStatusBar();
    ctx.fillStyle = COL.text;
    ctx.font = `12px ${LCD_FONT}`;
    ctx.textBaseline = 'top';
    ctx.textAlign = 'left';
    const lines = [
      'iPod — Web Edition',
      '',
      'A faithful Click Wheel',
      'music player that plays',
      'Spotify.',
      '',
      'Drag the wheel or use',
      'arrow keys to navigate.',
      'Center / Enter selects.',
      '',
      'github.com/crispygoat',
    ];
    let y = CONTENT_TOP + 8;
    for (const line of lines) {
      const isTitle = line.startsWith('iPod');
      ctx.fillStyle = isTitle ? COL.accent : COL.text;
      ctx.font = isTitle ? `600 13px ${LCD_FONT}` : `11px ${LCD_FONT}`;
      ctx.fillText(line, PAD + 6, y);
      y += 13;
    }
  }

  // ----- Now Playing -----

  function renderNowPlaying() {
    const t = currentTrack();
    if (!t) { rootMenu(); return; }

    drawTitleBar('Now Playing');
    drawStatusBar();

    // Text-only layout, like the 2G-4G monochrome iPod
    ctx.fillStyle = COL.text;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    ctx.font = `18px ${LCD_FONT}`;
    ctx.fillText(`${state.queueIndex + 1} of ${state.queue.length}`, 12, CONTENT_TOP + 20);

    ctx.textAlign = 'center';
    ctx.font = `600 22px ${LCD_FONT}`;
    ctx.fillText(truncate(t.title, 22), CANVAS_W / 2, CONTENT_TOP + 56);
    ctx.font = `600 19px ${LCD_FONT}`;
    ctx.fillText(truncate(t.artist, 30), CANVAS_W / 2, CONTENT_TOP + 84);
    ctx.font = `19px ${LCD_FONT}`;
    ctx.fillText(truncate(t.album || (state.spotify.accessToken ? 'Spotify' : 'Demo Library'), 30), CANVAS_W / 2, CONTENT_TOP + 110);

    // Progress bar: outlined box with solid fill
    const barX = 20, barY = CONTENT_TOP + 146, barW = CANVAS_W - 40, barH = 12;
    ctx.strokeStyle = COL.text; ctx.lineWidth = 1;
    ctx.strokeRect(barX + 0.5, barY + 0.5, barW - 1, barH - 1);
    const pct = state.durationMs ? Math.min(1, state.positionMs / state.durationMs) : 0;
    ctx.fillStyle = COL.progress;
    ctx.fillRect(barX + 2, barY + 2, Math.floor((barW - 4) * pct), barH - 4);

    ctx.font = `18px ${LCD_FONT}`;
    ctx.textAlign = 'left';
    ctx.fillText(fmtTime(state.positionMs), barX, barY + 32);
    ctx.textAlign = 'right';
    ctx.fillText(`-${fmtTime(Math.max(0, state.durationMs - state.positionMs))}`, barX + barW, barY + 32);

    if (!state.isPlaying) {
      ctx.textAlign = 'center';
      ctx.fillText('Paused', CANVAS_W / 2, barY + 32);
    }
  }

  function drawAlbumArt(dataUrl, x, y, size) {
    // LCD-style art panel
    ctx.fillStyle = COL.bgDeep;
    ctx.fillRect(x, y, size, size);
    ctx.strokeStyle = COL.rule;
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 0.5, y + 0.5, size - 1, size - 1);

    if (!dataUrl) {
      // Musical note placeholder
      ctx.fillStyle = COL.textDim;
      ctx.font = `${Math.floor(size * 0.55)}px ${LCD_FONT}`;
      ctx.textBaseline = 'middle';
      ctx.textAlign = 'center';
      ctx.fillText('♪', x + size / 2, y + size / 2 + 2);
      return;
    }
    const img = artCache[dataUrl];
    if (img) {
      // Grayscale filter to keep monochrome look
      ctx.save();
      ctx.filter = 'grayscale(1) contrast(1.1) brightness(0.9)';
      ctx.drawImage(img, x, y, size, size);
      ctx.restore();
    } else {
      const i = new Image();
      i.crossOrigin = 'anonymous';
      i.onload = () => {
        artCache[dataUrl] = i;
        render();
      };
      i.src = dataUrl;
    }
  }
  const artCache = {};
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { try { render(); } catch (_) {} });

  function truncate(s, n) {
    if (!s) return '';
    return s.length > n ? s.slice(0, n - 1) + '…' : s;
  }

  // ----- Search screen (custom on-screen keyboard via wheel) -----
  const KB_LAYOUT = [
    'abcdefghijklmnopqrstuvwxyz'.split(''),
    '0123456789'.split(''),
    ['space', 'del', 'ok'],
  ];

  function renderSearch() {
    drawTitleBar('Search');
    drawStatusBar();

    ctx.fillStyle = COL.textDim;
    ctx.font = `10px ${LCD_FONT}`;
    ctx.fillText('Type to search Spotify.', PAD + 4, CONTENT_TOP + 4);

    // Input
    const inputY = CONTENT_TOP + 22;
    ctx.fillStyle = COL.bgDeep;
    ctx.fillRect(PAD + 4, inputY, CANVAS_W - PAD * 2 - 8, 20);
    ctx.fillStyle = COL.rule;
    ctx.fillRect(PAD + 4, inputY, CANVAS_W - PAD * 2 - 8, 1);
    ctx.fillRect(PAD + 4, inputY + 19, CANVAS_W - PAD * 2 - 8, 1);
    ctx.fillRect(PAD + 4, inputY, 1, 20);
    ctx.fillRect(PAD + 4 + (CANVAS_W - PAD * 2 - 8) - 1, inputY, 1, 20);

    ctx.fillStyle = COL.text;
    ctx.font = `600 12px ${LCD_FONT}`;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    const shown = state.searchInput || '';
    ctx.fillText(truncate(shown, 30), PAD + 8, inputY + 10);

    // Caret
    if (Date.now() % 1000 < 600) {
      const caretX = PAD + 8 + ctx.measureText(shown).width + 1;
      ctx.fillStyle = COL.text;
      ctx.fillRect(caretX, inputY + 4, 1, 12);
    }

    // Keyboard
    const kbY = inputY + 26;
    const cellW = 11;
    const cellH = 14;
    const startX = (CANVAS_W - (cellW * 12)) / 2;

    for (let r = 0; r < KB_LAYOUT.length; r++) {
      const row = KB_LAYOUT[r];
      let x = startX;
      if (r === 2) {
        const w = row.length * cellW * 2;
        x = (CANVAS_W - w) / 2;
      }
      for (let i = 0; i < row.length; i++) {
        const ch = row[i];
        const w = r === 2 ? cellW * 2 : cellW;
        const sel = state.searchCharIndex === r && state.searchCharIndexCol === i;
        if (sel) {
          ctx.fillStyle = COL.bgHi;
          ctx.fillRect(x, kbY + r * (cellH + 2), w, cellH);
        }
        ctx.fillStyle = sel ? COL.text : COL.textDim;
        ctx.font = `10px ${LCD_FONT}`;
        ctx.textBaseline = 'middle';
        ctx.textAlign = 'center';
        const label = ch === 'space' ? '␣' : ch === 'del' ? '⌫' : ch === 'ok' ? 'OK' : ch;
        ctx.fillText(label, x + w / 2, kbY + r * (cellH + 2) + cellH / 2);
        x += w;
      }
    }

    // Footer
    ctx.fillStyle = COL.textDim;
    ctx.font = `10px ${LCD_FONT}`;
    ctx.textAlign = 'left';
    ctx.fillText('Wheel move  Center pick  Menu cancel', PAD, CANVAS_H - STATUS_H - 7);
  }

  // ----- Master render -----
  function render() {
    clearBg();
    if (state.mode === 'nowPlaying') return renderNowPlaying();
    if (state.mode === 'search')     return renderSearch();

    const s = currentScreen();
    switch (s) {
      case 'mainMenu':   return renderMainMenu();
      case 'music':      return renderMusicMenu();
      case 'browse':     return renderBrowseMenu();
      case 'playlists':  return renderPlaylists();
      case 'playlist':   return renderPlaylistDetail(currentProps().name || 'Playlist');
      case 'settings':   return renderSettings();
      case 'about':      return renderAbout();
      case 'alert':      return renderAlertScreen();
      default:           return renderMainMenu();
    }
  }

  function renderPlaylists() {
    const lists = [
      { label: 'Favorites', sublabel: '12 tracks' },
      { label: 'Recently Added', sublabel: '24 tracks' },
      { label: 'Top 25 Most Played', sublabel: '25 tracks' },
      { label: '90’s Music', sublabel: 'Demo', arrow: true },
      { label: 'Chill Beats', sublabel: 'Demo', arrow: true },
    ];
    drawListScreen('Playlists', lists, { hints: state.spotify.accessToken ? '● Spotify preview' : '● Demo only' });
  }

  // ============================================================
  // CLICK WHEEL INTERACTION
  // ============================================================
  const wheel = $('#wheel-ring');
  const wheelEl = $('#wheel');
  let dragState = null;

  function wheelAngle(cx, cy, x, y) {
    const dx = x - cx, dy = y - cy;
    let a = Math.atan2(dy, dx) * 180 / Math.PI;
    if (a < 0) a += 360;
    return a;
  }

  wheel.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    const rect = wheelEl.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dist = Math.hypot(e.clientX - cx, e.clientY - cy);
    // Only respond in the ring area, not the center
    if (dist < rect.width * 0.21) return;
    wheel.setPointerCapture(e.pointerId);
    wheel.classList.add('dragging');
    dragState = {
      cx, cy,
      lastAngle: wheelAngle(cx, cy, e.clientX, e.clientY),
      accumulated: 0,
    };
  });

  wheel.addEventListener('pointermove', (e) => {
    if (!dragState) return;
    const a = wheelAngle(dragState.cx, dragState.cy, e.clientX, e.clientY);
    let delta = a - dragState.lastAngle;
    if (delta > 180) delta -= 360;
    if (delta < -180) delta += 360;
    dragState.accumulated += delta;
    dragState.lastAngle = a;

    // Threshold ~18 degrees per notch
    const THRESHOLD = 18;
    while (dragState.accumulated >= THRESHOLD) {
      onWheelForward();
      dragState.accumulated -= THRESHOLD;
    }
    while (dragState.accumulated <= -THRESHOLD) {
      onWheelBack();
      dragState.accumulated += THRESHOLD;
    }
  });

  function endDrag(e) {
    if (!dragState) return;
    wheel.classList.remove('dragging');
    try { wheel.releasePointerCapture(e.pointerId); } catch (_) {}
    dragState = null;
  }
  wheel.addEventListener('pointerup', endDrag);
  wheel.addEventListener('pointercancel', endDrag);

  function onWheelForward() {
    if (state.mode === 'nowPlaying') {
      adjustVolume(0.05);
      return;
    }
    if (state.mode === 'search') {
      moveSearchCursor(1);
      return;
    }
    state.selected = Math.min(state.selected + 1, currentItemCount() - 1);
    render();
  }
  function onWheelBack() {
    if (state.mode === 'nowPlaying') {
      adjustVolume(-0.05);
      return;
    }
    if (state.mode === 'search') {
      moveSearchCursor(-1);
      return;
    }
    state.selected = Math.max(state.selected - 1, 0);
    render();
  }

  function currentItemCount() {
    const s = currentScreen();
    switch (s) {
      case 'mainMenu': {
        let n = 0;
        if (state.isPlaying) n++;
        n += 5; // Music, Search, Spotify row, Settings, About
        return n;
      }
      case 'music':      return 4;
      case 'browse':     return 5 + DEMO_TRACKS.length;
      case 'playlists':  return 5;
      case 'playlist':   return (state.queue.length || DEMO_TRACKS.length);
      case 'settings':   return 6;
      default:           return 0;
    }
  }

  function moveSearchCursor(dir) {
    const r = state.searchCharIndex;
    const row = KB_LAYOUT[r];
    let c = state.searchCharIndexCol ?? 0;
    c += dir;
    if (c < 0) {
      if (r > 0) {
        state.searchCharIndex = r - 1;
        state.searchCharIndexCol = KB_LAYOUT[state.searchCharIndex].length - 1;
      } else {
        state.searchCharIndexCol = 0;
      }
    } else if (c >= row.length) {
      if (r < KB_LAYOUT.length - 1) {
        state.searchCharIndex = r + 1;
        state.searchCharIndexCol = 0;
      } else {
        state.searchCharIndexCol = row.length - 1;
      }
    } else {
      state.searchCharIndexCol = c;
    }
    render();
  }

  function adjustVolume(delta) {
    state.volume = Math.max(0, Math.min(1, state.volume + delta));
    saveVolume();
    applyVolume();
    render();
  }

  function applyVolume() {
    if (state.spotify.connected && state.spotify.player) {
      try { state.spotify.player.setVolume(state.volume); } catch (e) {}
    }
    if (state.audioEl) state.audioEl.volume = state.volume;
  }

  // ----- Button clicks -----
  document.querySelectorAll('.wheel-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const a = btn.dataset.action;
      if (a === 'menu')   return onMenu();
      if (a === 'select') return onSelect();
      if (a === 'next')   return onNext();
      if (a === 'prev')   return onPrev();
      if (a === 'play')   return onPlay();
    });
  });

  function onMenu() {
    if (state.mode === 'search') {
      state.mode = 'menu';
      popScreen();
      return;
    }
    if (state.mode === 'nowPlaying') {
      // First press returns to previous screen, then exits
      if (currentScreen() === 'mainMenu') {
        state.mode = 'menu';
        rootMenu();
      } else {
        state.mode = 'menu';
        render();
      }
      return;
    }
    popScreen();
  }

  function onSelect() {
    if (state.mode === 'nowPlaying') {
      // Select on Now Playing = play/pause
      togglePlay();
      return;
    }
    if (state.mode === 'search') {
      handleSearchKey();
      return;
    }
    const s = currentScreen();
    const idx = state.selected;
    switch (s) {
      case 'mainMenu': return handleMainMenuSelect(idx);
      case 'music':    return handleMusicSelect(idx);
      case 'browse':   return handleBrowseSelect(idx);
      case 'playlists':return handlePlaylistsSelect(idx);
      case 'playlist': return handlePlaylistTrackSelect(idx);
      case 'settings': return handleSettingsSelect(idx);
    }
  }

  function onNext() {
    if (state.mode === 'nowPlaying') {
      playNext();
      return;
    }
    onWheelForward();
  }
  function onPrev() {
    if (state.mode === 'nowPlaying') {
      playPrev();
      return;
    }
    onWheelBack();
  }
  function onPlay() {
    if (state.mode === 'nowPlaying') {
      togglePlay();
      return;
    }
    // From menu, jump to Now Playing if something is queued
    if (state.queue.length && state.queueIndex >= 0) {
      state.mode = 'nowPlaying';
      render();
      return;
    }
    togglePlay();
  }

  // ----- Keyboard -----
  document.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT') return;
    switch (e.key) {
      case 'ArrowUp':    e.preventDefault(); onPrev(); break;
      case 'ArrowDown':  e.preventDefault(); onNext(); break;
      case 'ArrowLeft':  e.preventDefault(); onMenu(); break;
      case 'ArrowRight': e.preventDefault(); onSelect(); break;
      case 'Enter':      e.preventDefault(); onSelect(); break;
      case 'Escape':     e.preventDefault(); onMenu(); break;
      case ' ':          e.preventDefault(); onPlay(); break;
    }
  });

  // ----- Selection handlers -----
  function handleMainMenuSelect(idx) {
    let i = 0;
    if (state.isPlaying) {
      if (idx === 0) {
        state.mode = 'nowPlaying';
        render();
        return;
      }
      i++;
    }
    if (idx === i)      return pushScreen('music');   // Music
    if (idx === i + 1)  return startSearch();        // Search
    if (idx === i + 2) { // Sign in / Sign out / Connect
      if (state.spotify.accessToken) {
        signOutSpotify();
      } else if (state.spotify.clientIdConfigured) {
        beginSpotifyAuth();
      } else {
        pushScreen('settings');
      }
      return;
    }
    if (idx === i + 3)  return pushScreen('settings');
    if (idx === i + 4)  return pushScreen('about');
  }

  function handleMusicSelect(idx) {
    if (idx === 0) return pushScreen('browse');
    if (idx === 1) return pushScreen('playlists');
    if (idx === 2) return pushScreen('browse');
    if (idx === 3) return pushScreen('browse');
  }

  function handleBrowseSelect(idx) {
    if (idx < 5) {
      // Featured card → play demo track 1 (placeholder for Spotify)
      playDemoTracks();
      state.mode = 'nowPlaying';
      render();
      return;
    }
    const t = DEMO_TRACKS[idx - 5];
    if (!t) return;
    state.queue = DEMO_TRACKS.slice();
    state.queueIndex = idx - 5;
    state.positionMs = 0;
    playCurrent();
    state.mode = 'nowPlaying';
    render();
  }

  function handlePlaylistsSelect(idx) {
    const lists = ['Favorites', 'Recently Added', 'Top 25', '90’s Music', 'Chill Beats'];
    pushScreen('playlist', { name: lists[idx] || 'Playlist' });
  }

  function handlePlaylistTrackSelect(idx) {
    const tracks = state.queue.length ? state.queue : DEMO_TRACKS;
    state.queue = tracks.slice();
    state.queueIndex = idx;
    playCurrent();
    state.mode = 'nowPlaying';
    render();
  }

  function handleSettingsSelect(idx) {
    if (idx === 0) promptForClientId();
    if (idx === 1) {
      if (state.spotify.accessToken) signOutSpotify();
      else beginSpotifyAuth();
    }
    if (idx === 2) return; // status — info only
    if (idx === 3) return; // playback mode — info only
    if (idx === 4) state.volume = state.volume < 1 ? 1 : 0;
    if (idx === 5) { state.library = []; render(); }
    saveVolume();
    applyVolume();
  }

  function startSearch() {
    state.mode = 'search';
    state.searchInput = '';
    state.searchCharIndex = 0;
    state.searchCharIndexCol = 0;
    pushScreen('search');
    state.mode = 'search'; // pushScreen resets to menu; reapply
    render();
  }

  function handleSearchKey() {
    const r = state.searchCharIndex;
    const c = state.searchCharIndexCol;
    const row = KB_LAYOUT[r];
    const ch = row[c];
    if (ch === 'del') {
      state.searchInput = state.searchInput.slice(0, -1);
    } else if (ch === 'ok') {
      runSearch(state.searchInput);
      return;
    } else if (ch === 'space') {
      state.searchInput += ' ';
    } else {
      state.searchInput += ch;
    }
    render();
  }

  async function runSearch(q) {
    if (!q) return;
    state.mode = 'menu';
    popScreen();
    if (state.spotify.accessToken) {
      const items = await spotifySearchTracks(q);
      if (items && items.length) {
        state.queue = items;
        state.queueIndex = 0;
        playCurrent();
        state.mode = 'nowPlaying';
        render();
      } else {
        alertModal('No results on Spotify.');
      }
    } else {
      // Demo fallback: find a demo track whose title starts with the query
      const t = DEMO_TRACKS.find(t => t.title.toLowerCase().includes(q.toLowerCase()));
      if (t) {
        state.queue = DEMO_TRACKS.slice();
        state.queueIndex = DEMO_TRACKS.indexOf(t);
        playCurrent();
        state.mode = 'nowPlaying';
      } else {
        alertModal('No matches in demo library.');
      }
      render();
    }
  }

  function alertModal(text) {
    state._alertText = text;
    pushScreen('alert');
  }

  function renderAlertScreen() {
    drawTitleBar('Notice');
    drawStatusBar();
    ctx.fillStyle = COL.text;
    ctx.font = `12px ${LCD_FONT}`;
    ctx.textBaseline = 'top';
    ctx.fillText(state._alertText || '', PAD + 8, CONTENT_TOP + 30);
    ctx.fillStyle = COL.textDim;
    ctx.font = `10px ${LCD_FONT}`;
    ctx.fillText('Press MENU to dismiss.', PAD + 8, CONTENT_TOP + 60);
  }

  // ============================================================
  // PLAYBACK ENGINES
  // ============================================================
  function ensureAudio() {
    if (!state.audioEl) {
      state.audioEl = new Audio();
      state.audioEl.preload = 'metadata';
      state.audioEl.addEventListener('timeupdate', () => {
        if (state.mode === 'nowPlaying') {
          state.positionMs = (state.audioEl.currentTime || 0) * 1000;
          render();
        }
      });
      state.audioEl.addEventListener('ended', () => {
        playNext();
      });
      state.audioEl.addEventListener('loadedmetadata', () => {
        const t = currentTrack();
        if (t) {
          t.durationMs = Math.floor((state.audioEl.duration || 0) * 1000);
          state.durationMs = t.durationMs;
          render();
        }
      });
      state.audioEl.addEventListener('play', () => {
        state.isPlaying = true;
        render();
      });
      state.audioEl.addEventListener('pause', () => {
        state.isPlaying = false;
        render();
      });
    }
    return state.audioEl;
  }

  function playCurrent() {
    const t = currentTrack();
    if (!t) return;
    if (state.spotify.accessToken && state.spotify.connected) {
      spotifyPlayUri(t.uri);
      return;
    }
    const a = ensureAudio();
    a.src = t.url;
    a.volume = state.volume;
    a.play().catch(err => {
      console.warn('audio play failed', err);
    });
  }

  function togglePlay() {
    if (!currentTrack()) return;
    if (state.spotify.accessToken && state.spotify.connected) {
      if (state.isPlaying) spotifyPause();
      else spotifyResume();
      return;
    }
    const a = ensureAudio();
    if (a.paused) {
      if (!a.src) a.src = currentTrack().url;
      a.play().catch(() => {});
    } else {
      a.pause();
    }
  }

  function playNext() {
    if (!state.queue.length) return;
    state.queueIndex = (state.queueIndex + 1) % state.queue.length;
    state.positionMs = 0;
    playCurrent();
    render();
  }
  function playPrev() {
    if (!state.queue.length) return;
    if (state.positionMs > 3000) {
      state.positionMs = 0;
      if (state.audioEl) state.audioEl.currentTime = 0;
      return;
    }
    state.queueIndex = (state.queueIndex - 1 + state.queue.length) % state.queue.length;
    state.positionMs = 0;
    playCurrent();
    render();
  }

  function playDemoTracks() {
    state.queue = DEMO_TRACKS.slice();
    state.queueIndex = 0;
    playCurrent();
  }

  // ============================================================
  // SPOTIFY: PKCE OAUTH
  // ============================================================
  function getClientId() {
    return loadClientId();
  }
  function setClientId(id) {
    saveClientId(id);
    state.spotify.clientIdConfigured = !!id;
  }

  function promptForClientId() {
    const cur = getClientId();
    const next = window.prompt(
      'Enter your Spotify App Client ID\n\n(developer.spotify.com → My Apps → New App)',
      cur,
    );
    if (next != null) setClientId(next.trim());
    render();
  }

  // PKCE helpers
  function base64urlencode(bytes) {
    let s = btoa(String.fromCharCode.apply(null, bytes));
    return s.replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  }
  async function sha256(input) {
    const buf = new TextEncoder().encode(input);
    return new Uint8Array(await crypto.subtle.digest('SHA-256', buf));
  }
  async function genCodeVerifier() {
    const arr = new Uint8Array(64);
    crypto.getRandomValues(arr);
    return base64urlencode(arr);
  }
  async function genCodeChallenge(verifier) {
    return base64urlencode(await sha256(verifier));
  }

  async function beginSpotifyAuth() {
    const clientId = getClientId();
    if (!clientId) {
      promptForClientId();
      return;
    }
    const verifier = await genCodeVerifier();
    sessionStorage.setItem('ipod.pkce.verifier', verifier);
    const challenge = await genCodeChallenge(verifier);
    const redirect = window.location.origin + window.location.pathname;
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: clientId,
      scope: 'streaming user-read-email user-read-private user-modify-playback-state user-read-playback-state playlist-read-private',
      redirect_uri: redirect,
      code_challenge_method: 'S256',
      code_challenge: challenge,
    });
    window.location.href = 'https://accounts.spotify.com/authorize?' + params.toString();
  }

  async function completeSpotifyAuthFromUrl() {
    const url = new URL(window.location.href);
    const code = url.searchParams.get('code');
    if (!code) return false;
    const verifier = sessionStorage.getItem('ipod.pkce.verifier');
    if (!verifier) return false;
    const clientId = getClientId();
    if (!clientId) return false;
    const redirect = window.location.origin + window.location.pathname;
    try {
      const body = new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirect,
        client_id: clientId,
        code_verifier: verifier,
      });
      const res = await fetch('https://accounts.spotify.com/api/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
      });
      if (!res.ok) {
        console.warn('token exchange failed', await res.text());
        return false;
      }
      const tok = await res.json();
      state.spotify.accessToken = tok.access_token;
      state.spotify.refreshToken = tok.refresh_token;
      state.spotify.expiresAt = Date.now() + (tok.expires_in || 3600) * 1000;
      saveTokens();
      // Fetch user profile
      await refreshSpotifyProfile();
      // Clean URL
      history.replaceState({}, '', window.location.pathname);
      return true;
    } finally {
      sessionStorage.removeItem('ipod.pkce.verifier');
    }
  }

  async function refreshSpotifyToken() {
    const rt = state.spotify.refreshToken;
    const clientId = getClientId();
    if (!rt || !clientId) return false;
    try {
      const body = new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: rt,
        client_id: clientId,
      });
      const res = await fetch('https://accounts.spotify.com/api/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
      });
      if (!res.ok) return false;
      const tok = await res.json();
      state.spotify.accessToken = tok.access_token;
      state.spotify.expiresAt = Date.now() + (tok.expires_in || 3600) * 1000;
      if (tok.refresh_token) state.spotify.refreshToken = tok.refresh_token;
      saveTokens();
      return true;
    } catch (e) { return false; }
  }

  async function spotifyFetch(path, options = {}) {
    if (!state.spotify.accessToken) return null;
    if (Date.now() > state.spotify.expiresAt - 30_000) {
      await refreshSpotifyToken();
    }
    const res = await fetch('https://api.spotify.com/v1' + path, {
      ...options,
      headers: {
        Authorization: 'Bearer ' + state.spotify.accessToken,
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      },
    });
    if (!res.ok) {
      console.warn('spotify api', path, res.status);
      return null;
    }
    return res.json();
  }

  async function refreshSpotifyProfile() {
    const me = await spotifyFetch('/me');
    if (me) state.spotify.user = { id: me.id, display_name: me.display_name };
  }

  function signOutSpotify() {
    state.spotify.accessToken = null;
    state.spotify.refreshToken = null;
    state.spotify.expiresAt = 0;
    state.spotify.user = null;
    if (state.spotify.player) {
      try { state.spotify.player.disconnect(); } catch (e) {}
      state.spotify.player = null;
    }
    state.spotify.connected = false;
    saveTokens();
    render();
  }

  // ============================================================
  // SPOTIFY: WEB PLAYBACK SDK
  // ============================================================
  function loadSpotifySdk() {
    return new Promise((resolve, reject) => {
      if (window.Spotify) return resolve();
      window.onSpotifyWebPlaybackSDKReady = () => resolve();
      const tag = document.getElementById('spotify-sdk');
      if (!tag) return reject(new Error('SDK script missing'));
      // The script tag has defer; script will load.
    });
  }

  async function initSpotifyPlayer() {
    if (!state.spotify.accessToken) return;
    await loadSpotifySdk();
    if (!window.Spotify) return;
    if (state.spotify.player) return;
    const player = new window.Spotify.Player({
      name: 'iPod Web Edition',
      getOAuthToken: (cb) => {
        if (Date.now() > state.spotify.expiresAt - 30_000) {
          refreshSpotifyToken().then(() => cb(state.spotify.accessToken));
        } else {
          cb(state.spotify.accessToken);
        }
      },
      volume: state.volume,
    });
    state.spotify.player = player;

    player.addListener('initialization_error', ({ message }) => console.warn('init error', message));
    player.addListener('authentication_error', ({ message }) => console.warn('auth error', message));
    player.addListener('account_error', ({ message }) => {
      console.warn('account error', message);
      state.spotify.premium = false;
      render();
    });
    player.addListener('playback_error', ({ message }) => console.warn('playback error', message));
    player.addListener('player_state_changed', (s) => {
      if (!s) return;
      state.isPlaying = !s.paused;
      state.positionMs = s.position;
      const t = currentTrack();
      if (t && s.track_window?.current_track?.id) {
        // Spotify may report different durations in ms
        if (s.duration) t.durationMs = s.duration;
        state.durationMs = s.duration || t.durationMs;
      }
      render();
    });
    player.addListener('ready', ({ device_id }) => {
      console.log('spotify player ready', device_id);
      state.spotify.connected = true;
      state.spotify.deviceId = device_id;
      state.spotify.premium = true;
      render();
    });
    player.addListener('not_ready', () => {
      state.spotify.connected = false;
      render();
    });
    player.connect();
  }

  async function spotifyPlayUri(uri) {
    if (!state.spotify.deviceId) return;
    const body = { uris: [uri] };
    // PUT /me/player/play requires Premium
    const url = `https://api.spotify.com/v1/me/player/play?device_id=${encodeURIComponent(state.spotify.deviceId)}`;
    const res = await fetch(url, {
      method: 'PUT',
      headers: {
        Authorization: 'Bearer ' + state.spotify.accessToken,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) console.warn('play uri failed', res.status);
  }
  async function spotifyPause() {
    if (!state.spotify.deviceId) return;
    await fetch(`https://api.spotify.com/v1/me/player/pause?device_id=${encodeURIComponent(state.spotify.deviceId)}`, {
      method: 'PUT',
      headers: { Authorization: 'Bearer ' + state.spotify.accessToken },
    });
  }
  async function spotifyResume() {
    if (!state.spotify.deviceId) return;
    await fetch(`https://api.spotify.com/v1/me/player/play?device_id=${encodeURIComponent(state.spotify.deviceId)}`, {
      method: 'PUT',
      headers: { Authorization: 'Bearer ' + state.spotify.accessToken },
    });
  }

  async function spotifySearchTracks(q) {
    const data = await spotifyFetch(`/search?q=${encodeURIComponent(q)}&type=track&limit=20`);
    if (!data || !data.tracks) return [];
    return data.tracks.items.map(t => ({
      id: t.id,
      title: t.name,
      artist: t.artists.map(a => a.name).join(', '),
      album: t.album.name,
      durationMs: t.duration_ms,
      url: t.preview_url || '', // Web Playback SDK plays full track; preview_url is 30s sample
      uri: t.uri,
      art: t.album.images?.[0]?.url || null,
      isSpotify: true,
    }));
  }

  // ============================================================
  // BOOT
  // ============================================================
  async function boot() {
    loadVolume();
    loadTokens();
    state.spotify.clientIdConfigured = !!getClientId();

    // Handle Spotify OAuth redirect
    if (window.location.search.includes('code=')) {
      const ok = await completeSpotifyAuthFromUrl();
      if (ok) {
        // After signing in, init player
        await initSpotifyPlayer();
      }
    } else if (state.spotify.accessToken) {
      await refreshSpotifyProfile();
      await initSpotifyPlayer();
    }

    // Default queue = demo library, ready to play
    state.queue = DEMO_TRACKS.slice();
    state.queueIndex = 0;
    state.durationMs = DEMO_TRACKS[0].durationMs;
    state.positionMs = 0;
    state.isPlaying = false;

    rootMenu();
    setInterval(tick, 500);
    applyVolume();
  }

  function tick() {
    if (state.mode === 'nowPlaying' && state.isPlaying) {
      // Repaint to animate progress + caret
      render();
    } else if (state.mode === 'search' && Date.now() % 1000 < 600) {
      render();
    }
  }

  // Hide desktop hint once user interacts
  ['click', 'keydown', 'pointerdown'].forEach(ev =>
    document.addEventListener(ev, () => {
      const hint = $('#desktop-hint');
      if (hint) hint.style.display = 'none';
    }, { once: true })
  );

  document.addEventListener('DOMContentLoaded', boot);

  // Expose for tests
  window.__ipod = { state, render, boot };
})();