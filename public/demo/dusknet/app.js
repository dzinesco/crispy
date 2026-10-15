/* =============================================================
   DUSKNET BBS — message board
   Vanilla JS, no build. State, hash router, BBCode, seeded users.
   ============================================================= */

(() => {
  'use strict';

  // ============================================================
  // CONSTANTS
  // ============================================================
  const STORAGE_KEY = 'dusknet.bbs.v1';
  const STREAK_KEY = 'dusknet.streak.v1';
  const PROFILE_KEY = 'dusknet.profile.v1';
  const ACHIEVEMENTS_KEY = 'dusknet.achievements.v1';
  const LIKED_KEY = 'dusknet.liked.v1';
  const TRIVIA_KEY = 'dusknet.trivia.v1';
  const SEEN_THREADS_KEY = 'dusknet.seen.v1';
  const VERSION = '1.97';
  const BBS_NAME = 'DUSKNET BBS';
  const BBS_TAGLINE = 'A 90s Bulletin Board System';
  const STAFF_HANDLES = new Set([
    'cyberangel',
    'NeoTerra',
    'ctrl-alt-del',
    'omega_red',
  ]);
  const ONLINE_USERS = [
    'cyberangel', 'xX_Ph4nt0m_Xx', 'COOLGUY97', 'Lisa_M',
    'SKATER_BOY', 'RAMROD', 'DaKoDeMaN', 'NeoTerra',
    'ctrl-alt-del', 'omega_red', '~angeldust~',
    'CyberPunkPrincess', 'buddyHolly1997'
  ];

  // ============================================================
  // DAILY TRIVIA — question bank (date-stable seed)
  // ============================================================
  const TRIVIA_QUESTIONS = [
    { q: 'What year was the first BBS created?',
      a: '1978' },
    { q: 'What does "BBS" stand for?',
      a: 'Bulletin Board System' },
    { q: 'Who is credited with creating the first BBS (CBBS)?',
      a: 'Ward Christensen' },
    { q: 'What baud rate did the original CBBS use?',
      a: '300 baud' },
    { q: 'In what year did Tim Berners-Lee propose the World Wide Web?',
      a: '1989' },
    { q: 'What was the name of the first graphical web browser?',
      a: 'Mosaic' },
    { q: 'What does "HTTP" stand for?',
      a: 'HyperText Transfer Protocol' },
    { q: 'What is the maximum realistic speed of a 56k modem?',
      a: '46kbps' },
    { q: 'What does "FTP" stand for?',
      a: 'File Transfer Protocol' },
    { q: 'What does "ASCII" stand for?',
      a: 'American Standard Code for Information Interchange' },
    { q: 'What does "GIF" stand for?',
      a: 'Graphics Interchange Format' },
    { q: 'What year did AOL launch AIM (AOL Instant Messenger)?',
      a: '1997' },
    { q: 'In what year was the first email sent?',
      a: '1971' },
    { q: 'What does "MIDI" stand for?',
      a: 'Musical Instrument Digital Interface' },
  ];

  // Achievement definitions
  const ACHIEVEMENT_DEFS = [
    { id: 'first_post',  label: 'First Post',     glyph: '✎', color: 'cy',
      hint: 'make your first post' },
    { id: 'lurker',      label: 'Lurker No More', glyph: '◉', color: 'mg',
      hint: 'post a reply in any thread' },
    { id: 'streak7',     label: 'Streak: 7 Days', glyph: '🔥', color: 'am',
      hint: 'post 7 days in a row' },
    { id: 'popular',     label: 'Popular',         glyph: '★', color: 'yw',
      hint: 'one of your posts gets 10+ likes' },
    { id: 'veteran',     label: 'BBS Veteran',     glyph: '◆', color: 'li',
      hint: 'make 50+ posts total' },
    { id: 'trivia',      label: 'Trivia Master',   glyph: '? ', color: 'ro',
      hint: 'be marked as the correct trivia answer' },
  ];

  // ============================================================
  // HTML / text helpers
  // ============================================================
  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[c]));
  }
  function escapeAttr(s) { return escapeHtml(s); }
  function plural(n, one, many) { return n === 1 ? one : (many || one + 's'); }
  function makeId() {
    return Math.random().toString(36).slice(2, 8) +
           Date.now().toString(36).slice(-4);
  }
  function intFromHash(s, fallback) {
    let h = 0;
    for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
    return Math.abs(h);
  }

  // ============================================================
  // TIME
  // ============================================================
  function formatStamp(ms) {
    const d = new Date(ms);
    const mo = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][d.getMonth()];
    const pad = n => (n < 10 ? '0' + n : '' + n);
    return `${mo} ${d.getDate()}, ${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }
  function formatAge(ms) {
    const diff = (Date.now() - ms) / 1000;
    if (diff < 60) return 'just now';
    if (diff < 3600) return Math.floor(diff / 60) + ' min ago';
    if (diff < 86400) return Math.floor(diff / 3600) + ' hr ago';
    if (diff < 86400 * 30) return Math.floor(diff / 86400) + ' days ago';
    return formatStamp(ms);
  }

  // ============================================================
  // ============================================================
  // CAPTCHA / ANTI-BOT
  // ============================================================
  const FORBIDDEN_HANDLES = new Set([
    // staff
    'cyberangel', 'neoterra', 'ctrl-alt-del', 'omega_red',
    // generic admin/role words
    'admin', 'sysop', 'root', 'mod', 'moderator', 'operator',
    'system', 'service', 'helpdesk', 'support', 'security',
    'null', 'undefined', 'anonymous', 'anon', 'guest', 'official',
    // bot/spam tells
    'bot', 'spam', 'phisher', 'scraper', 'crawler', 'flooder',
    // reserved branding
    'dusknet', 'dusk-net', 'dusk_net',
    // single chars / too short — checked separately too
  ]);

  const RATE_LIMITS = {
    post:   { minIntervalMs: 4000, perMinute: 8,  perHour: 30,  perDay: 120 },
    handle: { minIntervalMs: 2000, perHour: 5,   perDay: 12 },
  };

  const FORM_MIN_DWELL_MS = 1800;     // must take ≥ 1.8s to submit
  const CAPTCHA_TTL_MS    = 10 * 60 * 1000; // 10 min
  const MAX_CAPTCHA_FAILS = 3;
  const LOCKOUT_MS        = 60 * 1000; // 1 min lockout after too many fails

  // ============================================================
  // BBCode → HTML
  // ============================================================
  function parseBB(text) {
    let s = escapeHtml(text);

    // [CODE] blocks
    s = s.replace(/\[CODE\]([\s\S]*?)\[\/CODE\]/gi, (m, body) => {
      return `<pre class="code">${body.replace(/<br>/g, '')}</pre>`;
    });
    // [QUOTE=handle] ... [/QUOTE]
    s = s.replace(/\[QUOTE(?:=([^\]]+))?\]([\s\S]*?)\[\/QUOTE\]/gi, (m, h, body) => {
      const who = h ? escapeHtml(h) : 'Quote';
      return `<blockquote class="quote"><span class="q-handle">${who}</span> wrote:<br>${body.trim()}</blockquote>`;
    });
    // [B] [I] [U] [S]
    s = s.replace(/\[B\]([\s\S]*?)\[\/B\]/gi, '<b>$1</b>');
    s = s.replace(/\[I\]([\s\S]*?)\[\/I\]/gi, '<em>$1</em>');
    s = s.replace(/\[U\]([\s\S]*?)\[\/U\]/gi, '<u>$1</u>');
    s = s.replace(/\[S\]([\s\S]*?)\[\/S\]/gi, '<s>$1</s>');
    // [URL=...]label[/URL] & [URL]label[/URL]
    s = s.replace(/\[URL(?:=([^\]\s]+))?\]([\s\S]*?)\[\/URL\]/gi, (m, u, l) => {
      const url = (u || l).trim();
      return `<a href="${escapeAttr(url)}" target="_blank" rel="noopener noreferrer">${l}</a>`;
    });
    // Auto-link bare URLs
    s = s.replace(/(?<!["'>])\b(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>');

    // Paragraph + line break
    const parts = s.split(/\r?\n\r?\n/);
    return parts.map(p => `<p>${p.replace(/\r?\n/g, '<br>')}</p>`).join('');
  }

  // ============================================================
  // CAPTCHA + ANTI-BOT HELPERS
  // ============================================================
  let _activeCaptcha = null;     // currently-displayed captcha
  let _captchaFails = 0;         // consecutive fails
  let _lockoutUntil = 0;         // ms timestamp; submit blocked until then

  function generateCaptcha() {
    const a = 2 + Math.floor(Math.random() * 8);
    const b = 2 + Math.floor(Math.random() * 8);
    return {
      id: makeId(),
      mathA: a, mathB: b,
      mathAnswer: a + b,
      yearAnswer: '96',
      token: makeId() + makeId() + makeId(),
      createdAt: Date.now(),
      expiresAt: Date.now() + CAPTCHA_TTL_MS,
    };
  }

  function renderCaptchaBlock(captcha, prefix) {
    const cooldown = _lockoutUntil > Date.now()
      ? `<span class="cap-cooldown">LOCKED — wait ${Math.ceil((_lockoutUntil - Date.now()) / 1000)}s</span>`
      : `<span>failures: ${_captchaFails}/${MAX_CAPTCHA_FAILS}</span>`;
    return `
      <div class="captcha-block" id="${prefix}-captcha" data-prefix="${prefix}">
        <div class="cap-title">
          <span class="cap-shield">⚠</span>
          HUMAN CHECK — REQUIRED
        </div>
        <span class="cap-q">1) Solve: <b>${captcha.mathA}</b> + <b>${captcha.mathB}</b> = ?</span>
        <input type="text" class="cap-input" name="captcha_math" inputmode="numeric" pattern="[0-9]*" maxlength="3" autocomplete="off" placeholder="answer" required />

        <span class="cap-q">2) DUSKNET was founded in 19__ — last 2 digits:</span>
        <input type="text" class="cap-input" name="captcha_year" inputmode="numeric" maxlength="4" autocomplete="off" placeholder="hint: the logo knows" required />
        <div class="cap-hint">(check the page header — sysop dropped the year up top)</div>

        <div class="honeypot-field" aria-hidden="true">
          <label>Leave blank: <input type="text" name="website" tabindex="-1" autocomplete="off" /></label>
        </div>
        <input type="hidden" name="captcha_token" value="${captcha.token}" />
        <input type="hidden" name="captcha_opened_at" value="${captcha.createdAt}" />
        <div class="cap-error"></div>
        <div class="cap-meta">
          <span>${MAX_CAPTCHA_FAILS - _captchaFails} attempts left</span>
          ${cooldown}
        </div>
      </div>
    `;
  }

  function showCaptchaError(prefix, msg) {
    const el = document.getElementById(prefix + '-captcha');
    if (!el) return;
    el.classList.remove('has-error');
    void el.offsetWidth; // restart animation
    el.classList.add('has-error');
    const errEl = el.querySelector('.cap-error');
    if (errEl) errEl.textContent = '✘ ' + msg;
  }

  function verifyCaptcha(captcha, response) {
    if (!captcha || !response) return { ok: false, why: 'no-captcha' };
    if (Date.now() > captcha.expiresAt) return { ok: false, why: 'expired' };
    if (response.token && response.token !== captcha.token) {
      return { ok: false, why: 'bad-token' };
    }
    if (response.honeypot && String(response.honeypot).length > 0) {
      return { ok: false, why: 'bot' };
    }
    if (response.openedAt) {
      const dwell = Date.now() - Number(response.openedAt);
      if (Number.isFinite(dwell) && dwell < FORM_MIN_DWELL_MS) {
        return { ok: false, why: 'too-fast' };
      }
    }
    const math = parseInt((response.math || '').toString().trim(), 10);
    if (!Number.isFinite(math) || math !== captcha.mathAnswer) {
      return { ok: false, why: 'math' };
    }
    const yearRaw = (response.year || '').toString().replace(/\s+/g, '').trim();
    const yearLast2 = yearRaw.slice(-2);
    if (yearLast2 !== captcha.yearAnswer) {
      return { ok: false, why: 'year' };
    }
    return { ok: true };
  }

  function captchaErrorMessage(why) {
    return ({
      'no-captcha': 'CAPTCHA MISSING',
      'expired':    'CAPTCHA EXPIRED — RELOAD',
      'bad-token':  'INVALID FORM TOKEN — RELOAD',
      'bot':        'HONEYPOT TRIGGERED — BOT DETECTED',
      'too-fast':   'TOO FAST — TYPE LIKE A HUMAN',
      'math':       'MATH ANSWER IS WRONG',
      'year':       'YEAR IS WRONG — CHECK THE LOGO',
    })[why] || 'VERIFICATION FAILED';
  }

  function recordCaptchaFail() {
    _captchaFails++;
    if (_captchaFails >= MAX_CAPTCHA_FAILS) {
      _lockoutUntil = Date.now() + LOCKOUT_MS;
      _captchaFails = 0;
      return { locked: true };
    }
    return { locked: false };
  }

  function isLockedOut() {
    return _lockoutUntil > Date.now();
  }

  function isForbiddenHandle(h) {
    if (!h) return true;
    if (h.length < 2) return true;
    const lower = h.toLowerCase();
    if (FORBIDDEN_HANDLES.has(lower)) return true;
    if (/^(mod|admin|sysop|root|op)/.test(lower)) return true;
    if (/(bot|spam|crawl|script)/.test(lower)) return true;
    if (!/^[A-Za-z0-9_~.\-]+$/.test(h)) return true;
    return false;
  }

  function rateLimitStatus(kind) {
    const cfg = RATE_LIMITS[kind];
    const key = kind === 'post' ? 'postTimestamps' : 'handleTimestamps';
    state.rate[key] = state.rate[key] || [];
    const now = Date.now();
    const ts = state.rate[key];
    const last1m  = ts.filter(t => now - t < 60000);
    const last1h  = ts.filter(t => now - t < 3600000);
    const last1d  = ts.filter(t => now - t < 86400000);
    const last = ts[ts.length - 1] || 0;
    const sinceLast = now - last;

    let allowed = true;
    let reason = null;

    if (sinceLast < cfg.minIntervalMs) {
      allowed = false;
      reason = `SLOW DOWN — WAIT ${Math.ceil((cfg.minIntervalMs - sinceLast) / 1000)}S`;
    } else if (cfg.perMinute && last1m.length >= cfg.perMinute) {
      allowed = false;
      reason = `RATE LIMIT — ${cfg.perMinute}/MIN`;
    } else if (cfg.perHour && last1h.length >= cfg.perHour) {
      allowed = false;
      reason = `RATE LIMIT — ${cfg.perHour}/HR`;
    } else if (cfg.perDay && last1d.length >= cfg.perDay) {
      allowed = false;
      reason = `RATE LIMIT — ${cfg.perDay}/DAY`;
    }

    return {
      allowed, reason,
      current: { last1m: last1m.length, last1h: last1h.length, last1d: last1d.length },
    };
  }

  function rateLimitStamp(kind) {
    const key = kind === 'post' ? 'postTimestamps' : 'handleTimestamps';
    state.rate[key] = state.rate[key] || [];
    state.rate[key].push(Date.now());
    state.rate[key] = state.rate[key].slice(-200);
    saveState();
  }

  function handleCaptchaSubmit(form, prefix) {
    if (isLockedOut()) {
      showCaptchaError(prefix, `LOCKED — ${Math.ceil((_lockoutUntil - Date.now()) / 1000)}s`);
      return { ok: false, why: 'locked' };
    }
    const fd = new FormData(form);
    const response = {
      math:     fd.get('captcha_math'),
      year:     fd.get('captcha_year'),
      token:    fd.get('captcha_token'),
      honeypot: fd.get('website'),
      openedAt: fd.get('captcha_opened_at'),
    };
    const v = verifyCaptcha(_activeCaptcha, response);
    if (!v.ok) {
      const result = recordCaptchaFail();
      showCaptchaError(prefix, captchaErrorMessage(v.why));
      if (result.locked) {
        toast('LOCKED OUT — 60s cooldown');
      }
      return v;
    }
    _captchaFails = 0;
    return { ok: true };
  }

  // ============================================================
  // STATE
  // ============================================================
  const state = {
    handle: null,
    hitCount: 0,
    seenPosts: [],          // post ids user has seen
    rate: { postTimestamps: [], handleTimestamps: [] },
    boards: [],             // [{ id, name, glyph, color, blurb }]
    threads: {},            // threadId -> { id, boardId, subject, author, createdAt, isSticky, isLocked, views, postIds[] }
    posts: {},              // postId -> { id, threadId, author, body, createdAt, likes, likedBy, ... }
    // New fields — all persisted via localStorage
    streak: { count: 0, lastDate: null },
    profile: { bio: '', favoriteMp3: '', hometown: '', modem: '' },
    achievements: {},
    likedPosts: {},
    triviaDate: null,       // YYYY-MM-DD of current daily trivia thread
    triviaQuestion: '',
    triviaAnswer: '',
  };

  function saveState() {
    try {
      const snap = {
        handle: state.handle,
        hitCount: state.hitCount,
        boards: state.boards,
        threads: state.threads,
        posts: state.posts,
        rate: state.rate,
        profile: state.profile,
        achievements: state.achievements,
        likedPosts: state.likedPosts,
        triviaDate: state.triviaDate,
        triviaQuestion: state.triviaQuestion,
        triviaAnswer: state.triviaAnswer,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(snap));
      localStorage.setItem(SEEN_THREADS_KEY, JSON.stringify(state.seenPosts));
      localStorage.setItem(STREAK_KEY, JSON.stringify(state.streak));
      localStorage.setItem(PROFILE_KEY, JSON.stringify(state.profile));
      localStorage.setItem(ACHIEVEMENTS_KEY, JSON.stringify(state.achievements));
      localStorage.setItem(LIKED_KEY, JSON.stringify(state.likedPosts));
      localStorage.setItem(TRIVIA_KEY, JSON.stringify({
        date: state.triviaDate,
        question: state.triviaQuestion,
        answer: state.triviaAnswer,
      }));
    } catch (_) {}
  }
  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return false;
      const data = JSON.parse(raw);
      if (!data.boards || !data.threads || !data.posts) return false;
      Object.assign(state, {
        handle: data.handle,
        hitCount: data.hitCount || 0,
        boards: data.boards,
        threads: data.threads,
        posts: data.posts,
        rate: data.rate || { postTimestamps: [], handleTimestamps: [] },
        profile: data.profile || { bio: '', favoriteMp3: '', hometown: '', modem: '' },
        achievements: data.achievements || {},
        likedPosts: data.likedPosts || {},
        triviaDate: data.triviaDate || null,
        triviaQuestion: data.triviaQuestion || '',
        triviaAnswer: data.triviaAnswer || '',
      });
      try {
        const seen = JSON.parse(localStorage.getItem(SEEN_THREADS_KEY) || '[]');
        if (Array.isArray(seen)) state.seenPosts = seen;
      } catch (_) {}
      // Per-handle stores (preferred; if missing, fall back to in-snap)
      try {
        const streak = JSON.parse(localStorage.getItem(STREAK_KEY) || 'null');
        if (streak) state.streak = streak;
        else state.streak = { count: 0, lastDate: null };
      } catch (_) { state.streak = state.streak || { count: 0, lastDate: null }; }
      try {
        const prof = JSON.parse(localStorage.getItem(PROFILE_KEY) || 'null');
        if (prof) state.profile = prof;
      } catch (_) {}
      try {
        const ach = JSON.parse(localStorage.getItem(ACHIEVEMENTS_KEY) || 'null');
        if (ach) state.achievements = ach;
      } catch (_) {}
      try {
        const lk = JSON.parse(localStorage.getItem(LIKED_KEY) || 'null');
        if (lk) state.likedPosts = lk;
      } catch (_) {}
      try {
        const tr = JSON.parse(localStorage.getItem(TRIVIA_KEY) || 'null');
        if (tr && tr.date) {
          state.triviaDate = tr.date;
          state.triviaQuestion = tr.question || state.triviaQuestion;
          state.triviaAnswer = tr.answer || state.triviaAnswer;
        }
      } catch (_) {}
      return true;
    } catch (_) { return false; }
  }

  // ============================================================
  // SEED DATA (Nov 1998 — DUSKNET)
  //
  // Threads hold postIds; posts live in state.posts by id. A clean
  // addThread() helper keeps the seed linear and readable below.
  // ============================================================
  function buildSeed() {
    const base = Date.UTC(1998, 10, 1, 8, 0, 0); // Nov 1 1998
    const T = (days, hrs, mins = 0) =>
      base + days * 86400000 + hrs * 3600000 + mins * 60000;

    const boards = [
      { id: 'general', name: 'GENERAL',     glyph: 'GEN', color: 'cyan',    blurb: 'Welcome, announcements, and introductions. Read the rules before posting.' },
      { id: 'tech',    name: 'TECH ZONE',    glyph: 'TEC', color: 'lime',    blurb: 'Dial-up tips, Win95/98, HTML help, hardware. Sysop-approved only.' },
      { id: 'media',   name: 'MP3s & MEDIA', glyph: 'MP3', color: 'magenta', blurb: 'CD trades, mp3.com finds, band talk. Self-promo is fine. No warez.' },
      { id: 'gamerz',  name: 'GAMERZ',       glyph: 'GMZ', color: 'amber',   blurb: 'Quake, StarCraft, Diablo, emulators, PSX hacks.' },
      { id: 'ot',      name: 'OFF-TOPIC',    glyph: 'OT',  color: 'rose',    blurb: 'Locker room, music, polls, life, the universe.' },
    ];

    const threads = {};
    const posts = {};

    function addThread(t) {
      const tdata = {
        id: t.id, boardId: t.boardId, subject: t.subject,
        author: t.author, createdAt: t.createdAt,
        isSticky: !!t.sticky, isLocked: !!t.locked,
        views: t.views != null ? t.views : (Math.floor(Math.random() * 900) + 80),
        postIds: [],
      };
      (t.posts || []).forEach((p, i) => {
        const pid = t.id + '-p' + (i + 1);
        tdata.postIds.push(pid);
        posts[pid] = { id: pid, threadId: t.id, author: p.a, createdAt: p.t, body: p.b };
      });
      threads[t.id] = tdata;
    }

    // ============ GENERAL ============
    addThread({
      id: 'rules', boardId: 'general', sticky: true, locked: true,
      author: 'cyberangel', createdAt: T(0, 9, 12), views: 9218,
      subject: '★ READ FIRST — Board Rules & Guidelines',
      posts: [
        { a: 'cyberangel',   t: T(0, 9, 12), b: 'Welcome to DUSKNET BBS. We keep it simple here:\n\n[B]1.[/B] Be cool. Don\'t trash other callers — you\'ll get a purge.\n[B]2.[/B] No warez. We do NOT host illegal mp3s. Linking to Napster is fine.\n[B]3.[/B] Keep threads on-topic per board. OT board is for everything else.\n[B]4.[/B] Don\'t spam. One thread per topic.\n[B]5.[/B] Have fun. Use [B][I][U][CODE][/CODE][/I][/B] tags.\n\nMods: cyberangel, NeoTerra, ctrl-alt-del, omega_red. Ping us if someone breaks the rules.' },
        { a: 'NeoTerra',     t: T(0, 14, 4),  b: 'pinned. also — keep sig lines short, ppl reading on 14.4k.' },
        { a: 'ctrl-alt-del', t: T(0, 17, 22), b: 'adding: the [CODE]CODE[/CODE] tag is for snippets. if your log scrolls past 30 lines, save it as a file and link.' },
        { a: 'omega_red',    t: T(2, 8, 41),  b: 'just a reminder — repeated net etiquette violations get a 24h ban. no appeals.' },
      ]
    });

    addThread({
      id: 'welcome', boardId: 'general', sticky: true,
      author: 'cyberangel', createdAt: T(1, 10, 0), views: 5310,
      subject: '★ Welcome new callers — introduce yourself here',
      posts: [
        { a: 'cyberangel', t: T(1, 10, 0),  b: 'New to DUSKNET? Drop a [B]hi[/B] here — your handle, your rig, your favorite mp3 of 98. We won\'t bite.' },
        { a: 'COOLGUY97',  t: T(1, 13, 14), b: 'COOLGUY97 here. First time on a BBS, came from AOL. Got a P2 266 with 64mb ram. Makin my own webpage next week. Hi everyone.' },
        { a: 'Lisa_M',     t: T(1, 14, 2),  b: 'welcome coolguy :) Lisa_M from detroit, big into smashing pumpkins. don\'t be shy.' },
        { a: 'ctrl-alt-del', t: T(1, 18, 0), b: 'aol refugees always welcome. you can update your profile from the [B]Sign In[/B] pill at the top.' },
      ]
    });

    addThread({
      id: 'aolcd', boardId: 'general', author: 'Lisa_M', createdAt: T(2, 9, 14), views: 2104,
      subject: 'is anyone else getting AOL 4.0 cd-roms in the mail ??',
      posts: [
        { a: 'Lisa_M',     t: T(2, 9, 14), b: 'Ok seriously — every week I get a new AOL cd in the mailbox. I now have like 14 of them. They keep coming. am I on a list?' },
        { a: 'SKATER_BOY', t: T(2, 9, 51), b: 'yes. we are ALL on a list lol. mine came with a 100h free trial card glued to the front.' },
        { a: 'omega_red',  t: T(2, 11, 6),  b: 'aol uses bulk mail for cds as advertising. some of mine came with [B]bawlz![/B] stickers?? wild.' },
        { a: 'Lisa_M',     t: T(2, 12, 30), b: 'just weird. anyway is the AOL 4.0 software any good or is it the same as 3.0?' },
        { a: 'NeoTerra',   t: T(2, 13, 11), b: 'aol 4.0 has a new "buddy list" feature and AIM. aim is the real deal. use 3.5 build 32 or above.' },
        { a: 'CyberPunkPrincess', t: T(2, 15, 2), b: 'haha I made a friendship bracelet out of one of mine. keeping the tally. I have 22.' },
        { a: 'buddyHolly1997', t: T(2, 17, 38), b: 'pro tip: the discs work as drink coasters' },
      ]
    });

    addThread({
      id: 'ircisdead', boardId: 'general', author: 'xX_Ph4nt0m_Xx', createdAt: T(3, 22, 8), views: 1873,
      subject: 'is IRC dying?? long live BBS!!',
      posts: [
        { a: 'xX_Ph4nt0m_Xx', t: T(3, 22, 8), b: 'been on efnet since 95. lately every channel is dead or just ppl idling. where did everyone go? BBS feel more alive tbh.' },
        { a: 'RAMROD',     t: T(4, 6, 12), b: 'they moved to AIM. ur right tho. IRC is a graveyard at 3am.' },
        { a: 'ctrl-alt-del', t: T(4, 9, 0), b: 'long live bbs. long live threaded discussions. quote blocks. jump-to-post. none of that on irc.' },
        { a: 'DaKoDeMaN',  t: T(4, 11, 41), b: 'try dalnet: undernet: irc.tomsk.net. ppl still hang in #quake and #diablo. efnet is rough.' },
        { a: 'Lisa_M',     t: T(4, 15, 6), b: '#team_libre on efnet still hopping. ppl talk linux there.' },
        { a: 'xX_Ph4nt0m_Xx', t: T(4, 22, 30), b: 'rlly appreciate this thread. glad the bbs crowd is awake.' },
      ]
    });

    addThread({
      id: 'onlinetoday', boardId: 'general', author: 'SKATER_BOY', createdAt: T(5, 8, 4), views: 998,
      subject: 'how long have u been online today? mine = 11 hrs',
      posts: [
        { a: 'SKATER_BOY',  t: T(5, 8, 4), b: 'been online since 9pm last night. mom brought me sandwich. love this thing called the internet' },
        { a: 'CyberPunkPrincess', t: T(5, 11, 0), b: '5 hrs. since 6am. got a paper due tmrw for english. not doing it.' },
        { a: 'COOLGUY97',   t: T(5, 13, 24), b: '3 hrs. only counted since modem stopped screaming' },
        { a: 'omega_red',   t: T(5, 14, 18), b: 'been on since Thu. dont ask.' },
      ]
    });

    addThread({
      id: 'mircscripts', boardId: 'general', author: 'ctrl-alt-del', createdAt: T(6, 17, 2), views: 712,
      subject: 'mIRC scripts that rock — drop your faves',
      posts: [
        { a: 'ctrl-alt-del', t: T(6, 17, 2), b: 'curating this thread as a sticky of sorts. drop the script name + where to get it. share warez -> ban. share point to legit site -> thanks.' },
        { a: 'xX_Ph4nt0m_Xx', t: T(6, 18, 11), b: '[URL=irc://irc.undernet.org/quakenet]QuakeNet[/URL] has an addon called [B]modEGO[/B]. lets you op friends. k-rad.' },
        { a: 'NeoTerra',    t: T(6, 19, 50), b: 'try [CODE]alias fudge { if ($1 ison #mychan) { .msg $1 hi } }[/CODE]' },
        { a: 'cyberangel',  t: T(6, 22, 0), b: 'reminder: keep this thread on topic (mIRC scripts and config). the OT board is one click away.' },
      ]
    });

    // ============ TECH ZONE ============
    addThread({
      id: 'htmldesk', boardId: 'tech', sticky: true,
      author: 'cyberangel', createdAt: T(0, 11, 0), views: 4280,
      subject: '★ HTML Help Desk — paste your broken page here',
      posts: [
        { a: 'cyberangel', t: T(0, 11, 0), b: 'post your HTML, describe your problem. volunteer mods will reply. pinging [B]NeoTerra[/B] for marquee + table layout help.' },
        { a: 'NeoTerra',   t: T(0, 12, 0), b: 'common gotchas:\n\n- you must close [CODE]<TABLE>...[/CODE] tags.\n- use [CODE]<P>[/CODE] not [CODE]<p>[/CODE] (case matters in xhtml 4.0 strict).\n- <img> needs [CODE]alt[/CODE] text.' },
      ]
    });

    addThread({
      id: 'frames', boardId: 'tech', author: 'DaKoDeMaN', createdAt: T(2, 14, 22), views: 540,
      subject: 'frames are killing me!! how do i target a link from one frame to another??',
      posts: [
        { a: 'DaKoDeMaN', t: T(2, 14, 22), b: 'i have a 2-frame layout. nav on the left, content on the right. when i click a link in the nav, page loads IN the nav pane. halp pls.' },
        { a: 'NeoTerra',  t: T(2, 15, 4),  b: 'name the right frame:\n[CODE]<FRAME NAME="content">[/CODE]\nthen in your links use [CODE]TARGET=content[/CODE]:\n[CODE]<A HREF="about.html" TARGET="content">About</A>[/CODE]\n\nwelcome to 1996.' },
        { a: 'DaKoDeMaN',  t: T(2, 16, 0), b: 'SAVED MY LIFE. ty NeoTerra. ur a beast.' },
        { a: 'buddyHolly1997', t: T(2, 19, 11), b: 'honestly, frames are overrated. try a sticky nav table. trust me.' },
      ]
    });

    addThread({
      id: 'freehost', boardId: 'tech', author: 'NeoTerra', createdAt: T(4, 11, 0), views: 1640,
      subject: 'Best FREE web host in 98 — make your case',
      posts: [
        { a: 'NeoTerra',   t: T(4, 11, 0), b: 'lets do a snapshot. i\'ve used tripod, geocities, angelfire, and brinkster. ranked by uptime + ftp. results inside:\n\n1. [B]GeoCities[/B] — 99% up, no ftp tho\n2. [B]Angelfire[/B] — better ftp but banner ads\n3. [B]Tripod[/B] — popups galore\n4. [B]Brinkster[/B] — cgi, no ads, sketchy uptime' },
        { a: 'COOLGUY97',  t: T(4, 12, 13), b: 'tripod for me. the popups build character.' },
        { a: 'DaKoDeMaN',  t: T(4, 13, 50), b: 'i pay $4.95/mo for small but reliable hosting. worth every penny.' },
        { a: 'Lisa_M',     t: T(4, 17, 22), b: 'word — free is fine until you want a counter that works. then u pay.' },
        { a: 'buddyHolly1997', t: T(4, 22, 11), b: 'still think AOL Hometown is great if u wanna stay in the AOL world.' },
      ]
    });

    addThread({
      id: '56kmodem', boardId: 'tech', author: 'omega_red', createdAt: T(5, 7, 0), views: 1102,
      subject: 'my 56k modem only connects at 28.8 !! is it broken??',
      posts: [
        { a: 'omega_red',  t: T(5, 7, 0), b: 'just got a US Robotics 56k. connects at 26400 every time. called isp, they say "thats normal". u serious? 56k is a lie??' },
        { a: 'NeoTerra',   t: T(5, 7, 41), b: 'welcome to the 56k lie. U.S. Robotics marketing kept "56k" on the box but real top speed is ~46k, and that\'s only on a clean line. plan on 28.8–33.6 in practice.' },
        { a: 'omega_red',  t: T(5, 8, 12), b: 'wait so i should return it?' },
        { a: 'NeoTerra',   t: T(5, 8, 30), b: 'no. just upgrade to v.90 firmware when it ships. u\'ll get 42-46k. line noise is your enemy.' },
        { a: 'Lisa_M',     t: T(5, 9, 0), b: 'my line is so bad i sync at 21k. i hear u. i feel u.' },
      ]
    });

    addThread({
      id: 'win95osr2', boardId: 'tech', author: 'buddyHolly1997', createdAt: T(7, 14, 11), views: 822,
      subject: 'anyone got a copy of win95 OSR2 they can mail me??',
      posts: [
        { a: 'buddyHolly1997', t: T(7, 14, 11), b: 'i have the original retail 95 and its old. want the FAT32 / USB support in OSR2. no warez, i just need a friend with a CD. mail blank cdr to:' },
        { a: 'COOLGUY97',  t: T(7, 15, 1),  b: 'will burn u one for the cost of media + postage. PM me.' },
        { a: '~angeldust~', t: T(7, 17, 23), b: 'got OSR2.5 too. pm ur addy.' },
      ]
    });

    // ============ MP3s & MEDIA ============
    addThread({
      id: 'warez', boardId: 'media', sticky: true,
      author: 'cyberangel', createdAt: T(0, 9, 50), views: 3814,
      subject: '★ NO warez. NO warez. NO warez. (read before posting)',
      posts: [
        { a: 'cyberangel', t: T(0, 9, 50), b: 'okay ppl, this is getting silly. the MP3 board is for talking about music — not hosting cracked software or shipping mp3s of unreleased tracks. you may post:\n\n- links to legit downloads (mp3.com, band websites)\n- links to [B]Napster[/B] queries for tracks\n- CD trade offers\n\ndo NOT post direct mp3 attachments. violators get purged, no warning. ❤️ mods' },
      ]
    });

    addThread({
      id: 'top10mp3s', boardId: 'media', author: 'RAMROD', createdAt: T(2, 19, 0), views: 1402,
      subject: 'top 10 mp3s of 97 — what\'s in your winamp playlist??',
      posts: [
        { a: 'RAMROD',     t: T(2, 19, 0), b: 'my top 10 of 97, in no order:\n\n[B]1.[/B] The Prodigy — Firestarter\n[B]2.[/B] Chemical Bros — Block Rockin Beats\n[B]3.[/B] Smashing Pumpkins — Eye\n[B]4.[/B] Radiohead — Karma Police\n[B]5.[/B] Beastie Boys — Intergalactic\n[B]6.[/B] RATM — Bulls on Parade\n[B]7.[/B] No Doubt — Just a Girl\n[B]8.[/B] Fatboy Slim — Punk\n[B]9.[/B] Cake — The Distance\n[B]10.[/B] Foo Fighters — Everlong' },
        { a: 'xX_Ph4nt0m_Xx', t: T(2, 20, 0), b: 'good list. add: Bjork — Joga, Fiona Apple — Sleep to Dream, Portishead — Wandering Star' },
        { a: 'Lisa_M',     t: T(2, 21, 17), b: '["Without a trace" by Morphine], Archies — Sugar Sugar (jk)' },
        { a: 'NeoTerra',   t: T(3, 8, 0),  b: 'aphex twin — Xtal. made me close the door and listen. deserves a slot.' },
        { a: 'ctrl-alt-del', t: T(3, 9, 22), b: 'massive respect for Xtal placement. honorable mention: Boards of Canada — Telephasic Workshop.' },
      ]
    });

    addThread({
      id: 'cdtrade', boardId: 'media', author: 'Lisa_M', createdAt: T(4, 13, 0), views: 412,
      subject: 'best blank CDs in 98?? getting into burning',
      posts: [
        { a: 'Lisa_M',     t: T(4, 13, 0), b: 'about to start burning. memorex vs tdk vs verbatim. which is the move? pls dont say verbatim sonic 😬' },
        { a: 'RAMROD',     t: T(4, 13, 41), b: 'verbatim datalife plus — pricey but works in every burner i\'ve tried. also for ages on a spindle.' },
        { a: 'COOLGUY97',  t: T(4, 14, 33), b: 'tdk is solid. memorex is mostly fine but had a bad batch in july.' },
        { a: '~angeldust~', t: T(4, 18, 5), b: 'imho: burn at 4x. faster writes = coasters. half my memorex cds at 12x are unreadable.' },
      ]
    });

    addThread({
      id: 'prodfire', boardId: 'media', author: 'xX_Ph4nt0m_Xx', createdAt: T(6, 1, 30), views: 1821,
      subject: 'The Prodigy — Firestarter (jungle remix mp3, 7mb)',
      posts: [
        { a: 'xX_Ph4nt0m_Xx', t: T(6, 1, 30), b: 'founD a 1996 jungle bootleg of firestarter. 7mb, 192kbps. host it for the community please, im capped at 2400 dialup :(' },
        { a: 'RAMROD',     t: T(6, 2, 11), b: 'link? plz??' },
        { a: 'xX_Ph4nt0m_Xx', t: T(6, 2, 14), b: '[URL=ftp://ftp.dusknet.bbs/pub/audio/prodigy-firestarter-remix.mp3]ftp mirror[/URL]. lemme know if the mirror drops!' },
        { a: 'NeoTerra',   t: T(6, 3, 0),  b: 'grabbed. ty for hosting this. 8MB at my speed will take 22 min 💀' },
        { a: 'COOLGUY97',  t: T(6, 9, 11), b: 'THANK U. sounded amazing in winamp.' },
      ]
    });

    addThread({
      id: 'smashtrade', boardId: 'media', author: 'COOLGUY97', createdAt: T(8, 17, 0), views: 290,
      subject: 'TRADE — Smashing Pumpkins "Adore" for Radiohead "OK Computer"',
      posts: [
        { a: 'COOLGUY97',  t: T(8, 17, 0), b: 'got the Adore CD sealed (US first pressing). looking for sealed OK Computer. willing to throw in extras for fair trade.' },
        { a: 'Lisa_M',     t: T(8, 18, 0),  b: 'omg i want adore but i only have the cassette of OK Computer. nope?' },
        { a: 'COOLGUY97',  t: T(8, 18, 33), b: 'no cassettes please. CD or vinyl.' },
      ]
    });

    // ============ GAMERZ ============
    addThread({
      id: 'quakelan', boardId: 'gamerz', sticky: true,
      author: 'cyberangel', createdAt: T(1, 7, 50), views: 2204,
      subject: '★ Quake II LAN — central midwest US, looking for teams',
      posts: [
        { a: 'cyberangel', t: T(1, 7, 50), b: 'official: DUSKNET will host a Quake II LAN at the [B]Cyber Barn[/B] in Springfield IL on Dec 12. 32 stations. food provided, BYOB. ping me to register your 4-player squad. details and rules upcoming.' },
        { a: 'xX_Ph4nt0m_Xx', t: T(1, 8, 30), b: 'PHANTOM.NET will be there. 4 ppl confirmed.' },
        { a: 'DaKoDeMaN',  t: T(1, 11, 0), b: 'count us in. 3 ppl so far. looking for a 4th.' },
      ]
    });

    addThread({
      id: 'phantom', boardId: 'gamerz', author: 'xX_Ph4nt0m_Xx', createdAt: T(2, 16, 0), views: 904,
      subject: 'PHANTOM.NET clan is recruiting — Quake 2 / Diablo',
      posts: [
        { a: 'xX_Ph4nt0m_Xx', t: T(2, 16, 0), b: 'roster:\n\n- xX_Ph4nt0m_Xx (cap, Quake)\n- omega_red (Diablo)\n- ctrl-alt-del (Q2 demo)\n- Lisa_M (Diablo)\n- +1 open slot\n\napply if u can pulse at least 80ms or below. DM me.' },
        { a: 'SKATER_BOY', t: T(2, 17, 0), b: 'what\'s ur record so far this season?' },
        { a: 'xX_Ph4nt0m_Xx', t: T(2, 17, 33), b: '47-12 in Q2 clan wars. ranked #22 in the [URL]clan ring rankings[/URL].' },
      ]
    });

    addThread({
      id: 'd2leak', boardId: 'gamerz', author: 'NeoTerra', createdAt: T(4, 9, 0), views: 1980,
      subject: 'Diablo II rumor — ZD-net leak? anyone seen the screenshots??',
      posts: [
        { a: 'NeoTerra',   t: T(4, 9, 0), b: 'allegedly blizz is testing a fully 3d isometric rendering. new skill tree. 5-act story. ETA late 99. anyone with screenshots or a beta invite pm me. WILL PAY.' },
        { a: 'xX_Ph4nt0m_Xx', t: T(4, 10, 0), b: 'saw it. cannot post for legal reasons but the screenshots are real. the new druid class looks GORGEOUS.' },
        { a: 'RAMROD',     t: T(4, 14, 0),  b: 'if this drops at e3 we riot. cannot wait that long.' },
        { a: 'DaKoDeMaN',  t: T(4, 18, 0),  b: 'predicting: d2 ships q3 99. bet on it.' },
      ]
    });

    addThread({
      id: 'starfin', boardId: 'gamerz', author: 'DaKoDeMaN', createdAt: T(5, 22, 0), views: 512,
      subject: 'StarCraft final chapter — Broodwar balance??',
      posts: [
        { a: 'DaKoDeMaN',  t: T(5, 22, 0), b: 'broodwar is the best RTS ever made, fight me. protoss needs buffs. lurkers are too good. disagree in 5 sentences or less.' },
        { a: 'SKATER_BOY', t: T(6, 8, 0), b: 'zerg main, agree on lurkers. disagree on protoss. storm is ridiculous.' },
        { a: 'NeoTerra',   t: T(6, 13, 0), b: 'terran needs less reliance on dropships. otherwise OK.' },
      ]
    });

    addThread({
      id: 'psxpc', boardId: 'gamerz', author: 'SKATER_BOY', createdAt: T(7, 16, 0), views: 783,
      subject: 'PSX controller on PC — anyone got it working with emulators??',
      posts: [
        { a: 'SKATER_BOY', t: T(7, 16, 0), b: 'got a PSX controller, an adapter cable, and a copy of [B]ePSXe[/B] 1.4. buttons map but the analog sticks won\'t register. vcom drivers? troubleshooting guide?' },
        { a: 'ctrl-alt-del', t: T(7, 18, 11), b: 'check: control panel -> gaming options. enable [B]DirectInput[/B]. set pad to analog in game menu. also open ePSXe.cfg and bump [CODE]PadMode=2[/CODE] to [CODE]PadMode=1[/CODE].' },
        { a: 'SKATER_BOY', t: T(7, 18, 41), b: 'works. snaps up right away. ty.' },
      ]
    });

    // ============ OFF-TOPIC ============
    addThread({
      id: 'pizza', boardId: 'ot', author: 'CyberPunkPrincess', createdAt: T(1, 20, 0), views: 2204,
      subject: 'PIZZA ROLLS vs BAGEL BITES — the showdown!! 🍕',
      posts: [
        { a: 'CyberPunkPrincess', t: T(1, 20, 0), b: 'which snack is righteous and which is a lie. defend ur pick in 1 paragraph.' },
        { a: 'Lisa_M',     t: T(1, 20, 41), b: 'PIZZA ROLLS — bold, saucy, and only take 9 min. bagel bites are dry & underfilled.' },
        { a: 'RAMROD',     t: T(1, 21, 0), b: 'bagel bites. pizza rolls are soggy at the bottom. real food has texture.' },
        { a: 'xX_Ph4nt0m_Xx', t: T(1, 21, 30), b: 'pizza rolls in marinara dipping sauce = unbeatable. case closed.' },
        { a: 'SKATER_BOY', t: T(2, 8, 0),  b: 'neither. totinos pizza. bigger rolls. better sauce.' },
        { a: 'CyberPunkPrincess', t: T(2, 12, 0), b: 'totinos tier 3 — acknowledged but not in the ring. verdict: 4-2 pizza rolls.' },
      ]
    });

    addThread({
      id: 'ninshow', boardId: 'ot', author: 'RAMROD', createdAt: T(3, 13, 0), views: 418,
      subject: 'who here has been to a Nine Inch Nails show?',
      posts: [
        { a: 'RAMROD',     t: T(3, 13, 0), b: 'just saw NIN at the fiddler\'s green amphitheater in denver last week. EVERYTHING in my body hurts from the pit. WHAT a set. best show of 98 for me by a mile.' },
        { a: 'CyberPunkPrincess', t: T(3, 14, 0), b: 'no but my dad took me to a Rammstein show at the united center in 97. blew my mind. industrial scene royalty.' },
        { a: 'Lisa_M',     t: T(3, 16, 41), b: 'jtmfc the dethklok concert was loud but worth it.' },
        { a: 'RAMROD',     t: T(3, 17, 0),  b: 'TYPO lisa_m. (dethklok is a cartoon lol)' },
      ]
    });

    addThread({
      id: 'y2k', boardId: 'ot', author: 'buddyHolly1997', createdAt: T(4, 9, 0), views: 3120,
      subject: 'will Y2K break everything?? i\'m scared',
      posts: [
        { a: 'buddyHolly1997', t: T(4, 9, 0), b: 'read an article in [B]Time[/B] that says planes could fall out of the sky on jan 1 2000. elevator ppl could be stuck forever. the banks will forget u have $$. should i pull my cash from the bank??' },
        { a: 'NeoTerra',   t: T(4, 10, 0), b: 'no. y2k compliance is mostly done. there will be small bugs but the world will not end. dont listen to [I]The Starr Report[/I].' },
        { a: 'omega_red',  t: T(4, 11, 0), b: 'tldr: buy beans, water, and flashlights. be ready for a week of small outages. chill out ppl.' },
        { a: 'Lisa_M',     t: T(4, 13, 0), b: 'i just bought a 13" black-and-white tv that doesn\'t need AC power. love it.' },
        { a: 'ctrl-alt-del', t: T(4, 18, 0), b: 'hot take: y2k is a marketing scare. programmers built dates with 2-digit years because they [I]knew[/I] it would be a problem in 30 years. they fixed it. relax.' },
        { a: 'buddyHolly1997', t: T(5, 8, 0), b: 'ok calming down. just stocked up on ramen anyway. :P' },
      ]
    });

    addThread({
      id: 'aolcollection', boardId: 'ot', author: '~angeldust~', createdAt: T(6, 11, 0), views: 612,
      subject: 'my AOL cd collection (pics inside) — now at 87 disks 📀',
      posts: [
        { a: '~angeldust~', t: T(6, 11, 0), b: 'ive been collecting every AOL cd mailed to me since 95. im at 87. some highlights:\n\n[B]1.[/B] AOL 3.0 with the [B]Area 51[/B] cd-rom game attached\n[B]2.[/B] AOL 4.0 trial that came with 250 hours free\n[B]3.[/B] AOL 4.0 trial that came with a 1 cent stamp on the envelope\n[B]4.[/B] custom Disney branded AOL cd (???)\n[B]5.[/B] AOL cd with the [B]Towers of Hanoi[/B] sticker\n\npics loaded as attachments below (cmon ftp clears up eventually).' },
        { a: 'CyberPunkPrincess', t: T(6, 11, 41), b: 'i NEED a pic of the disney one. that\'s wild.' },
        { a: 'Lisa_M',     t: T(6, 12, 0), b: 'this is art. ur the pablo picasso of plastic.' },
        { a: '~angeldust~', t: T(6, 12, 30), b: 'ty ty. the disney one was a free promo tie-in w/ lion king ii release. collecting since 95. PMed u a pic' },
      ]
    });

    addThread({
      id: 'trollforum', boardId: 'ot', author: 'omega_red', createdAt: T(7, 16, 0), views: 1108,
      subject: 'TROLLS — new troll forum for the DUSKNET community',
      posts: [
        { a: 'omega_red',  t: T(7, 16, 0), b: 'heard through the wire that DUSKNET is launching a /troll board in 99. dedicated to flame-bait, spam, and 4chan-esque posting. anyone interested in being a board mod?' },
        { a: 'DaKoDeMaN',  t: T(7, 17, 0),  b: 'troll board??? im in. mods pls.' },
        { a: 'cyberangel', t: T(7, 18, 0),  b: 'lol no. mods will keep this place tidy. the OT board is for everything else.' },
        { a: 'omega_red',  t: T(7, 18, 30), b: 'savage lmao. fair.' },
        { a: 'xX_Ph4nt0m_Xx', t: T(7, 19, 0), b: 'mods do be moving fast tho. respect.' },
      ]
    });

    return { boards, threads, posts };
  }

  // ============================================================
  // INITIAL BOOT
  // ============================================================
  function reseed(opts = {}) {
    const seed = buildSeed();
    state.boards = seed.boards;
    state.threads = seed.threads;
    state.posts = seed.posts;
    state.hitCount = 9901 + Math.floor(Math.random() * 8000);
    state.seenPosts = [];
    state.handle = opts.keepHandle ? state.handle : null;
    state.likedPosts = {};
    state.achievements = {};
    state.streak = { count: 0, lastDate: null };
    state.profile = { bio: '', favoriteMp3: '', hometown: '', modem: '' };
    normalizeState();
    ensureDailyTriviaThread();
    saveState();
  }

  // ============================================================
  // STATE MUTATIONS
  // ============================================================
  function setHandle(name) {
    state.handle = name;
    saveState();
    renderHandlePill();
  }
  function incrementHit() {
    state.hitCount++;
    saveState();
    renderHitDigits();
  }
  function markSeenPost(postId) {
    if (!state.seenPosts.includes(postId)) state.seenPosts.push(postId);
    saveState();
  }
  function threadLastPostId(threadId) {
    const t = state.threads[threadId];
    return t && t.postIds.length ? t.postIds[t.postIds.length - 1] : null;
  }
  function threadLastPostAt(threadId) {
    const lastId = threadLastPostId(threadId);
    return lastId ? state.posts[lastId].createdAt : state.threads[threadId].createdAt;
  }
  function threadReplyCount(threadId) {
    return Math.max(0, state.threads[threadId].postIds.length - 1);
  }
  function postCountForBoard(boardId) {
    let total = 0;
    Object.values(state.threads).forEach(t => {
      if (t.boardId === boardId) total += t.postIds.length;
    });
    return total;
  }
  function threadCountForBoard(boardId) {
    return Object.values(state.threads).filter(t => t.boardId === boardId).length;
  }
  function latestThreadInBoard(boardId) {
    const threads = Object.values(state.threads).filter(t => t.boardId === boardId);
    if (!threads.length) return null;
    threads.sort((a, b) => threadLastPostAt(b.id) - threadLastPostAt(a.id));
    return threads[0];
  }
  function allThreadsNewestFirst() {
    const ts = Object.values(state.threads);
    ts.sort((a, b) => threadLastPostAt(b.id) - threadLastPostAt(a.id));
    return ts;
  }
  function isStaffHandle(h) { return STAFF_HANDLES.has(h); }
  function isPostNew(postId) { return !state.seenPosts.includes(postId); }
  function threadHasNew(threadId) {
    return state.threads[threadId].postIds.some(id => isPostNew(id));
  }

  // ============================================================
  // ADDICTIVE FIXES — streak, karma/likes, profile, achievements,
  // daily trivia
  // ============================================================
  const MONTH_ABBR = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];

  function dateKey(d) {
    d = d || new Date();
    return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate();
  }
  function dateKeyFromMs(ms) {
    return dateKey(new Date(ms));
  }
  function todayLabel() {
    const d = new Date();
    return MONTH_ABBR[d.getMonth()] + ' ' + d.getDate();
  }
  function yesterdayKey() {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return dateKey(d);
  }
  function prettyDateLabel(key) {
    // "YYYY-M-D" -> "OCT 14"
    if (!key) return '';
    const parts = key.split('-');
    if (parts.length !== 3) return key;
    const m = parseInt(parts[1], 10) - 1;
    const d = parseInt(parts[2], 10);
    if (m < 0 || m > 11) return key;
    return MONTH_ABBR[m] + ' ' + d;
  }

  function normalizeState() {
    state.streak = state.streak || { count: 0, lastDate: null };
    state.profile = Object.assign({ bio: '', favoriteMp3: '', hometown: '', modem: '' },
      state.profile || {});
    state.achievements = state.achievements || {};
    state.likedPosts = state.likedPosts || {};
    Object.values(state.posts).forEach(p => {
      if (typeof p.likes !== 'number') p.likes = 0;
      if (!Array.isArray(p.likedBy)) p.likedBy = [];
    });
  }

  // ---- streak ----
  function bumpStreakIfNewDay() {
    const today = dateKey();
    if (state.streak.lastDate === today) return false; // already counted
    const yest = yesterdayKey();
    if (state.streak.lastDate === yest) {
      state.streak.count = (state.streak.count || 0) + 1;
    } else {
      state.streak.count = 1; // start / reset
    }
    state.streak.lastDate = today;
    saveState();
    return true;
  }
  function streakCount() { return state.streak && state.streak.count || 0; }
  function streakActive() { return state.streak && state.streak.lastDate === dateKey(); }

  // ---- karma / likes ----
  function karmaForHandle(h) {
    if (!h) return 0;
    let total = 0;
    Object.values(state.posts).forEach(p => {
      if (p.author === h) total += (p.likes || 0);
    });
    return total;
  }
  function totalKarma() {
    return karmaForHandle(state.handle);
  }
  function currentUserLiked(postId) {
    if (!state.handle) return false;
    return !!(state.likedPosts && state.likedPosts[postId]);
  }
  function toggleLike(postId) {
    const p = state.posts[postId];
    if (!p) return false;
    if (!state.handle) {
      openHandleModal();
      return false;
    }
    p.likedBy = p.likedBy || [];
    p.likes = p.likes || 0;
    state.likedPosts = state.likedPosts || {};
    const idx = p.likedBy.indexOf(state.handle);
    if (idx >= 0) {
      p.likedBy.splice(idx, 1);
      p.likes = Math.max(0, p.likes - 1);
      delete state.likedPosts[postId];
    } else {
      p.likedBy.push(state.handle);
      p.likes += 1;
      state.likedPosts[postId] = true;
    }
    saveState();
    evaluateAchievements();
    return true;
  }

  // ---- profile ----
  function isProfileEmpty() {
    const p = state.profile || {};
    return !p.bio && !p.favoriteMp3 && !p.hometown && !p.modem;
  }
  function saveProfile(p) {
    state.profile = {
      bio: (p.bio || '').toString().slice(0, 240),
      favoriteMp3: (p.favoriteMp3 || '').toString().slice(0, 80),
      hometown: (p.hometown || '').toString().slice(0, 60),
      modem: (p.modem || '').toString().slice(0, 40),
    };
    saveState();
  }

  // ---- achievements ----
  function hasAchievement(id) { return !!(state.achievements && state.achievements[id]); }
  function awardAchievement(id) {
    if (!state.achievements[id]) {
      state.achievements[id] = true;
      saveState();
      return true; // newly awarded
    }
    return false;
  }
  function evaluateAchievements() {
    if (!state.handle) return;
    const newOnes = [];
    const myPostCount = Object.values(state.posts).filter(p => p.author === state.handle).length;
    if (myPostCount >= 1 && awardAchievement('first_post')) newOnes.push('first_post');
    if (myPostCount >= 50 && awardAchievement('veteran')) newOnes.push('veteran');
    // Lurker: at least one reply (post that is not the first in its thread)
    const myReplies = Object.values(state.posts).filter(p => {
      if (p.author !== state.handle) return false;
      const t = state.threads[p.threadId];
      return t && t.postIds[0] !== p.id;
    });
    if (myReplies.length >= 1 && awardAchievement('lurker')) newOnes.push('lurker');
    // Popular: any of my posts has 10+ likes
    const hasPopular = Object.values(state.posts).some(p =>
      p.author === state.handle && (p.likes || 0) >= 10);
    if (hasPopular && awardAchievement('popular')) newOnes.push('popular');
    // Streak 7
    if (streakCount() >= 7 && awardAchievement('streak7')) newOnes.push('streak7');
    return newOnes;
  }

  // ---- daily trivia ----
  function pickTriviaForDate(d) {
    const key = dateKey(d);
    // deterministic index based on date
    const h = intFromHash(key, 0);
    return TRIVIA_QUESTIONS[h % TRIVIA_QUESTIONS.length];
  }
  function ensureDailyTriviaThread() {
    const today = dateKey();
    const threadId = 'daily-trivia-' + today;
    if (state.threads[threadId]) {
      // already exists — just make sure answer is on the first post
      const t = state.threads[threadId];
      const firstId = t.postIds[0];
      if (firstId && state.posts[firstId]) {
        state.posts[firstId].triviaAnswer = state.triviaAnswer;
        state.posts[firstId].isTrivia = true;
        state.posts[firstId].triviaDate = today;
      }
      return threadId;
    }
    // pick today's question (re-pick even if we have state.triviaDate saved — verify)
    const q = pickTriviaForDate(new Date());
    state.triviaDate = today;
    state.triviaQuestion = q.q;
    state.triviaAnswer = q.a;
    const now = Date.now();
    const t = {
      id: threadId,
      boardId: 'ot',
      subject: '★ DAILY TRIVIA · ' + todayLabel() + ' · ' + q.q,
      author: 'cyberangel',
      createdAt: now,
      isSticky: true,
      isLocked: false,
      views: 1,
      postIds: [],
    };
    const firstPid = threadId + '-q';
    t.postIds.push(firstPid);
    state.threads[threadId] = t;
    state.posts[firstPid] = {
      id: firstPid,
      threadId,
      author: 'cyberangel',
      createdAt: now,
      body: '★ DAILY TRIVIA · ' + todayLabel() + '\n\n[B]' + q.q + '[/B]\n\npost your guess as a reply. mods (any caller, for the demo) can mark a reply as the correct answer — the guesser gets the [B]Trivia Master[/B] badge.\n\nclick [I]REVEAL ANSWER[/I] to see it.',
      triviaAnswer: q.a,
      isTrivia: true,
      triviaDate: today,
    };
    saveState();
    return threadId;
  }
  function triviaFirstPostId(threadId) {
    const t = state.threads[threadId];
    return t && t.postIds[0];
  }
  function isDailyTriviaThread(threadId) {
    return typeof threadId === 'string' && threadId.indexOf('daily-trivia-') === 0;
  }
  function markTriviaAnswerCorrect(postId) {
    const p = state.posts[postId];
    if (!p) return;
    p.isCorrectTrivia = true;
    // award the achievement to the post's author
    const oldHandle = state.handle;
    if (p.author) {
      const wasAchievement = state.achievements && state.achievements.trivia;
      // Temporarily switch handle context to award the achievement to the right user
      // We do this by directly toggling the achievement on state.achievements, persisting,
      // and noting it for toast feedback.
      if (!wasAchievement) {
        state.achievements = state.achievements || {};
        state.achievements.trivia = true;
        // tag the author so we can toast/notify
        state.achievements._trivia_awarded_to = p.author;
      }
    }
    saveState();
  }
  function postIsCorrectAnswer(postId) {
    const p = state.posts[postId];
    return !!(p && p.isCorrectTrivia);
  }

  // ============================================================
  // RENDER: header chrome
  // ============================================================
  function renderHitDigits() {
    const el = document.getElementById('hit-digits');
    if (!el) return;
    const s = String(Math.max(0, state.hitCount)).padStart(7, '0');
    el.innerHTML = s.split('').map(ch => {
      const isDigit = /\d/.test(ch);
      return `<span class="led-cell ${isDigit ? 'on' : ''}" data-d="${ch}"></span>`;
    }).join('');
  }
  function renderStats() {
    const threadsEl = document.getElementById('stat-threads');
    const postsEl = document.getElementById('stat-posts');
    const usersEl = document.getElementById('stat-users');
    if (threadsEl) threadsEl.textContent = Object.keys(state.threads).length;
    if (postsEl) postsEl.textContent = Object.keys(state.posts).length;
    if (usersEl) usersEl.textContent = ONLINE_USERS.length + (state.handle && !ONLINE_USERS.includes(state.handle) ? 1 : 0);
  }
  function renderHandlePill() {
    const el = document.getElementById('handle-pill');
    if (!el) return;
    if (!state.handle) {
      el.textContent = 'Sign In ▾';
      el.classList.remove('is-staff');
      el.dataset.staff = '0';
    } else {
      el.textContent = state.handle + (isStaffHandle(state.handle) ? ' ★' : '') + ' ▾';
      el.classList.toggle('is-staff', isStaffHandle(state.handle));
      el.dataset.staff = isStaffHandle(state.handle) ? '1' : '0';
    }
  }
  function renderNavActive() {
    const route = currentRoute();
    document.querySelectorAll('.nav-btn').forEach(a => {
      a.classList.toggle('is-active', a.dataset.route === route.home);
    });
  }

  // ============================================================
  // ROUTER
  // ============================================================
  function currentRoute() {
    const raw = (location.hash || '#/').replace(/^#/, '');
    const [pathPart, queryPart] = raw.split('?');
    const segs = pathPart.split('/').filter(Boolean);
    const params = {};
    if (queryPart) {
      queryPart.split('&').forEach(kv => {
        const [k, v] = kv.split('=');
        if (k) params[decodeURIComponent(k)] = v != null ? decodeURIComponent(v) : '';
      });
    }
    let name = 'home';
    if (segs.length === 0) name = 'home';
    else if (segs[0] === 'boards' && segs.length === 1) name = 'boards';
    else if (segs[0] === 'board' && segs[1]) name = 'board', params.boardId = segs[1];
    else if (segs[0] === 'thread' && segs[1]) name = 'thread', params.threadId = segs[1];
    else if (segs[0] === 'compose') name = 'compose';
    else if (segs[0] === 'profile') name = 'profile';
    else if (segs[0] === 'online') name = 'online';
    else if (segs[0] === 'staff') name = 'staff';
    else if (segs[0] === 'help') name = 'help';
    else name = 'notfound';
    return { name, params, home: deriveHomeFromName(name) };
  }
  function deriveHomeFromName(name) {
    if (name === 'home' || name === 'boards' || name === 'board' || name === 'thread') return name === 'home' ? 'home' : (name === 'boards' ? 'boards' : 'boards');
    return 'none';
  }
  function navigate(hash) {
    if (location.hash === hash) {
      renderApp();
    } else {
      location.hash = hash;
    }
  }

  // ============================================================
  // VIEW: HOME
  // ============================================================
  function viewHome() {
    const topThreads = allThreadsNewestFirst().slice(0, 6);
    const onlineCount = ONLINE_USERS.length + (state.handle && !ONLINE_USERS.includes(state.handle) ? 1 : 0);

    const boardListHtml = state.boards.map(b => {
      const tcount = threadCountForBoard(b.id);
      const pcount = postCountForBoard(b.id);
      const latest = latestThreadInBoard(b.id);
      const triviaBadge = b.id === 'ot' && state.triviaDate
        ? `<span class="board-trivia-flag" title="Daily Trivia">★ TRIVIA TODAY</span>` : '';
      return `
        <a href="#/board/${b.id}" class="board-card">
          <div class="board-icon">${b.glyph}</div>
          <div class="board-info">
            <h3>${b.name}${triviaBadge}</h3>
            <p>${b.blurb}</p>
          </div>
          <div class="board-meta">
            <div><strong>${tcount}</strong> ${plural(tcount, 'thread')}</div>
            <div><strong>${pcount}</strong> ${plural(pcount, 'post')}</div>
            <div>latest: ${latest ? escapeHtml(latest.subject).slice(0, 28) : '—'}</div>
          </div>
        </a>
      `;
    }).join('');

    const topThreadsHtml = topThreads.map(t => renderThreadRow(t)).join('');

    // Streak + achievements — only meaningful for signed-in users
    const streakHtml = state.handle ? renderStreakBox() : '';
    const achievementsHtml = state.handle ? renderAchievementsGrid(true) : '';

    // Trivia banner (if today's trivia thread is in top threads, link to it)
    const triviaId = 'daily-trivia-' + dateKey();
    const triviaThread = state.threads[triviaId];
    const triviaBanner = triviaThread ? `
      <a href="#/thread/${triviaId}" class="trivia-banner">
        <span class="trivia-flag">★ DAILY TRIVIA</span>
        <span class="trivia-date">${todayLabel()}</span>
        <span class="trivia-q">${escapeHtml(state.triviaQuestion || triviaThread.subject)}</span>
        <span class="trivia-cta">▶ ANSWER</span>
      </a>
    ` : '';

    return `
      <section class="panel magenta">
        <div class="home-hero">
          <h1 class="home-tag">${BBS_NAME}</h1>
          <p class="home-tagline">
            <span class="blink">▣</span>
            A BULLETIN BOARD FOR THE LATE 90S CROWD
            <span class="blink">▣</span>
          </p>
          <pre class="ascii-rule" style="color: var(--neon-yw); text-shadow: 0 0 4px var(--neon-yw); margin: 4px auto 18px; text-align: center;">★  ☆  ★  ☆  ★  ☆  ★  ☆  ★  ☆  ★  ☆  ★</pre>
          <div class="hero-actions">
            <a href="#/boards" class="btn">▶ ENTER THE BOARDS</a>
            <a href="#/compose" class="btn magenta">✎ START A NEW THREAD</a>
            <a href="#/online" class="btn lime">◉ SEE WHO'S ONLINE</a>
          </div>
          <pre class="ascii-rule" style="color: var(--neon-cy); text-shadow: 0 0 4px var(--neon-cy); margin: 18px auto 0; text-align: center;">[ ${onlineCount} CALLERS ONLINE · UP 24/7 · NETIQUETTE ENFORCED ]</pre>
        </div>
      </section>

      ${triviaBanner}

      ${streakHtml}

      <div class="home-cols">
        <section class="panel">
          <h2 class="panel-title">▶ LATEST THREADS</h2>
          <div class="thread-row head">
            <div class="t-subj">SUBJECT</div>
            <div class="t-author">AUTHOR</div>
            <div class="t-stats">REPLIES</div>
            <div class="t-last">LAST POST</div>
          </div>
          ${topThreadsHtml}
          <div style="text-align:center; margin-top: 14px;">
            <a href="#/boards" class="btn sm">VIEW ALL BOARDS ▸</a>
          </div>
        </section>

        <aside class="panel lime">
          <h2 class="panel-title">★ NOBODY ASKED, BUT...</h2>
          <p style="font-family: var(--ff-mono); font-size: 13px; color: var(--ink-1);">
            Welcome back to DUSKNET! The boards have been busy. Three new threads in MP3s &amp; MEDIA, an argument in OFF-TOPIC, and the sysop pinned a new rules reminder.
          </p>
          <div class="ascii-rule">╔══════════════════╗<br>║  STATS &amp; FACTS  ║<br>╚══════════════════╝</div>
          <ul style="font-family: var(--ff-mono); font-size: 13px; color: var(--ink-1); padding-left: 18px;">
            <li><b style="color: var(--neon-cy)">${Object.keys(state.threads).length}</b> active threads</li>
            <li><b style="color: var(--neon-cy)">${Object.keys(state.posts).length}</b> posts in the archive</li>
            <li><b style="color: var(--neon-cy)">${STAFF_HANDLES.size}</b> moderators online this week</li>
            <li><b style="color: var(--neon-cy)">${ONLINE_USERS.length}</b> regular callers</li>
            <li><b style="color: var(--neon-cy)">${state.hitCount}</b> total calls logged</li>
          </ul>
          <div class="ascii-rule">·̩̩̥͙**•̩̩͙✦•̩̩͙*˚̩̩̥͙**•̩̩͙✦•̩̩͙*˚̩̩̥͙**•̩̩͙✦•̩̩͙*˚·̩̩̥͙</div>
          <p style="font-family: var(--ff-mono); font-size: 12px; color: var(--ink-2);">
            <span class="blink" style="color: var(--neon-mg)">■</span>
            Pro tip: hit <kbd style="background: var(--neon-cy); color: #07021a; padding: 1px 5px; border-radius: 2px; font-family: var(--ff-mono);">Sign In</kbd> at the top to claim your handle and post as yourself.
          </p>

          ${achievementsHtml}
        </aside>
      </div>

      <section class="panel amber">
        <h2 class="panel-title">▤ ALL BOARDS</h2>
        ${boardListHtml}
      </section>
    `;
  }

  function renderStreakBox() {
    const c = streakCount();
    const active = streakActive();
    const flame = c >= 1 ? '🔥' : '·';
    const klass = active ? 'streak-box is-active' : 'streak-box is-cold';
    const tag = active ? 'ACTIVE TODAY' : 'POST TO RESTART';
    return `
      <div class="${klass}">
        <div class="streak-flame">${flame}</div>
        <div class="streak-meta">
          <div class="streak-label">DAILY CALLER STREAK</div>
          <div class="streak-value">STREAK: <b>${c}</b> ${plural(c, 'DAY', 'DAYS')}</div>
          <div class="streak-tag">${tag}</div>
        </div>
        <div class="streak-aside">
          <div class="streak-karma">KARMA: <b>${totalKarma()}</b></div>
          <a href="#/profile" class="btn sm magenta">▶ PROFILE</a>
        </div>
      </div>
    `;
  }

  function renderAchievementsGrid(compact) {
    const unlocked = ACHIEVEMENT_DEFS.filter(d => hasAchievement(d.id)).length;
    const total = ACHIEVEMENT_DEFS.length;
    const cells = ACHIEVEMENT_DEFS.map(d => {
      const on = hasAchievement(d.id);
      return `
        <div class="ach-badge ach-${d.color} ${on ? 'is-on' : 'is-off'}" title="${escapeHtml(d.hint)}">
          <div class="ach-glyph">${escapeHtml(d.glyph)}</div>
          <div class="ach-status">${on ? '✓' : '✗'}</div>
          <div class="ach-label">${escapeHtml(d.label)}</div>
        </div>
      `;
    }).join('');
    return `
      <div class="ach-block">
        <div class="ach-head">
          <span class="ach-title">★ ACHIEVEMENTS</span>
          <span class="ach-count">${unlocked}/${total}</span>
        </div>
        <div class="ach-grid ${compact ? 'compact' : ''}">${cells}</div>
      </div>
    `;
  }

  function renderThreadRow(t) {
    const isNew = threadHasNew(t.id);
    const replies = threadReplyCount(t.id);
    const lastAt = threadLastPostAt(t.id);
    const lastId = threadLastPostId(t.id);
    const lastAuthor = lastId ? state.posts[lastId].author : t.author;
    const subjectHtml = (t.isSticky ? `<span class="t-pin" title="Pinned">★ STICKY</span>` : '')
                      + (isNew ? `<span class="t-new">NEW!</span>` : '')
                      + escapeHtml(t.subject)
                      + (t.isLocked ? ` <span class="t-pin" style="color: var(--neon-rd); text-shadow: 0 0 4px var(--neon-rd)">🔒</span>` : '');
    return `
      <div class="thread-row">
        <a class="t-subj" href="#/thread/${t.id}">${subjectHtml}</a>
        <div class="t-author"><a href="#" style="color: inherit; text-decoration: none">${escapeHtml(t.author)}</a></div>
        <div class="t-stats">${replies}</div>
        <div class="t-last">${formatAge(lastAt)}<br><span style="color: var(--ink-3); font-size: 10px;">by ${escapeHtml(lastAuthor)}</span></div>
      </div>
    `;
  }

  // ============================================================
  // VIEW: BOARDS INDEX
  // ============================================================
  function viewBoards() {
    const boardListHtml = state.boards.map(b => {
      const tcount = threadCountForBoard(b.id);
      const pcount = postCountForBoard(b.id);
      const latest = latestThreadInBoard(b.id);
      return `
        <a href="#/board/${b.id}" class="board-card">
          <div class="board-icon">${b.glyph}</div>
          <div class="board-info">
            <h3>${b.name}</h3>
            <p>${b.blurb}</p>
          </div>
          <div class="board-meta">
            <div><strong>${tcount}</strong> ${plural(tcount, 'thread')} · <strong>${pcount}</strong> ${plural(pcount, 'post')}</div>
            <div>latest by ${escapeHtml(latest ? state.posts[threadLastPostId(latest.id)].author : '—')}</div>
            <div style="color: var(--neon-yw); text-shadow: 0 0 4px rgba(255,240,77,0.4)">${latest ? formatAge(threadLastPostAt(latest.id)) : 'no threads yet'}</div>
          </div>
        </a>
      `;
    }).join('');

    const topUsersHtml = ONLINE_USERS.slice(0, 12).map(h => {
      const staff = isStaffHandle(h);
      return `
        <div class="user-tile ${staff ? 'staff' : ''}">
          <div class="user-avatar">${escapeHtml(h[0].toUpperCase())}</div>
          <div class="user-handle">${escapeHtml(h)}</div>
          <div class="user-role-tag">${staff ? 'STAFF' : 'MEMBER'}</div>
        </div>
      `;
    }).join('');

    return `
      <div class="breadcrumbs">
        <a href="#/">Home</a> <span class="sep">›</span>
        <span class="here">All Boards</span>
      </div>
      <section class="panel">
        <h2 class="panel-title">▤ ALL BOARDS — choose your forum</h2>
        ${boardListHtml}
      </section>

      <section class="panel magenta">
        <h2 class="panel-title">◉ CALLERS ONLINE NOW</h2>
        <div class="user-list">${topUsersHtml}</div>
        <div class="ascii-rule">·̩̩̥͙**•̩̩͙✦•̩̩͙*˚̩̩̥͙**•̩̩͙✦•̩̩͙*˚·̩̩̥͙</div>
        <p style="font-family: var(--ff-mono); font-size: 12px; color: var(--ink-2); text-align: center;">
          Idle counts in parenthesis. Hit <kbd style="background: var(--neon-mg); color: #07021a; padding: 1px 5px; border-radius: 2px;">ENTER THE BOARDS</kbd> to start reading.
        </p>
      </section>
    `;
  }

  // ============================================================
  // VIEW: BOARD (thread list)
  // ============================================================
  function viewBoard(boardId) {
    const board = state.boards.find(b => b.id === boardId);
    if (!board) return viewNotFound('That board was unplugged.');
    const allThreads = Object.values(state.threads).filter(t => t.boardId === boardId);
    allThreads.sort((a, b) => {
      if (a.isSticky !== b.isSticky) return a.isSticky ? -1 : 1;
      return threadLastPostAt(b.id) - threadLastPostAt(a.id);
    });

    const rows = allThreads.map(t => renderThreadRow(t)).join('');

    // Daily Trivia banner on OFF-TOPIC
    let triviaHtml = '';
    if (boardId === 'ot') {
      const triviaId = 'daily-trivia-' + dateKey();
      const triviaT = state.threads[triviaId];
      if (triviaT) {
        triviaHtml = `
          <a class="trivia-banner trivia-banner-board" href="#/thread/${triviaId}">
            <div class="trivia-banner-row">
              <span class="trivia-flag">★ DAILY TRIVIA</span>
              <span class="trivia-date">${todayLabel()}</span>
              <span class="trivia-cta">▶ TAKE YOUR GUESS</span>
            </div>
            <div class="trivia-q">${escapeHtml(state.triviaQuestion || '')}</div>
          </a>
        `;
      }
    }

    return `
      <div class="breadcrumbs">
        <a href="#/">Home</a> <span class="sep">›</span>
        <a href="#/boards">Boards</a> <span class="sep">›</span>
        <span class="here">${board.name}</span>
      </div>
      ${triviaHtml}
      <section class="panel">
        <h2 class="panel-title">▤ ${board.name}</h2>
        <p style="font-family: var(--ff-mono); color: var(--ink-1); font-size: 14px;">${board.blurb}</p>
        <div style="text-align: right; margin-bottom: 12px;">
          <a href="#/compose?boardId=${board.id}" class="btn magenta">✎ POST NEW THREAD</a>
        </div>
        <div class="thread-row head">
          <div class="t-subj">SUBJECT</div>
          <div class="t-author">AUTHOR</div>
          <div class="t-stats">REPLIES</div>
          <div class="t-last">LAST POST</div>
        </div>
        ${rows || '<div class="empty-state"><h3>NO THREADS YET</h3><p>Be the first one to post.</p></div>'}
      </section>
    `;
  }

  // ============================================================
  // VIEW: THREAD (posts)
  // ============================================================
  function viewThread(threadId) {
    const t = state.threads[threadId];
    if (!t) return viewNotFound('That thread was deleted.');
    const board = state.boards.find(b => b.id === t.boardId);
    if (!board) return viewNotFound('That board was unplugged.');

    // bump views + mark posts as seen
    t.views = (t.views || 0) + 1;
    t.postIds.forEach(markSeenPost);
    saveState();

    const postHtml = t.postIds.map((pid, i) => renderPost(pid, i + 1)).join('');

    // Trivia thread — special header / sub-banner
    let triviaHeader = '';
    if (isDailyTriviaThread(threadId)) {
      triviaHeader = `
        <section class="panel magenta trivia-thread-head">
          <div class="trivia-thread-flag">★ DAILY TRIVIA · ${prettyDateLabel(state.triviaDate)}</div>
          <div class="trivia-thread-q">${escapeHtml(state.triviaQuestion || '')}</div>
          <div class="trivia-thread-meta">post a guess below · any caller (it's a demo) can <b>★ MARK CORRECT</b> on a reply</div>
        </section>
      `;
    }

    return `
      <div class="breadcrumbs">
        <a href="#/">Home</a> <span class="sep">›</span>
        <a href="#/boards">Boards</a> <span class="sep">›</span>
        <a href="#/board/${board.id}">${board.name}</a> <span class="sep">›</span>
        <span class="here">${escapeHtml(t.subject).slice(0, 40)}${t.subject.length > 40 ? '…' : ''}</span>
      </div>

      ${triviaHeader}

      <section class="panel">
        <div class="thread-head">
          <h2>${escapeHtml(t.subject)}</h2>
          <div class="thread-meta">
            Started by <a href="#" data-post-author="${escapeHtml(t.author)}"><b>${escapeHtml(t.author)}</b></a> on ${formatStamp(t.createdAt)} ·
            <b>${threadReplyCount(t.id)}</b> ${plural(threadReplyCount(t.id), 'reply', 'replies')} ·
            <b>${t.views}</b> views ·
            ${t.isLocked ? '<span style="color: var(--neon-rd)">🔒 LOCKED</span>' : `<a href="#/compose?threadId=${t.id}"><b>QUICK REPLY</b></a>`}
          </div>
        </div>

        ${postHtml}

        ${t.isLocked ? '<div class="ascii-rule" style="color: var(--neon-rd)">🔒 THIS THREAD IS LOCKED — NO NEW REPLIES 🔒</div>' : `
          <div style="text-align: center; margin-top: 16px;">
            <a href="#/compose?threadId=${t.id}" class="btn">✎ POST A REPLY</a>
          </div>
        `}
      </section>
    `;
  }

  function renderPost(postId, n) {
    const p = state.posts[postId];
    const author = p.author;
    const staff = isStaffHandle(author);
    const count = postCountForHandle(author);
    const joined = joinedAtForHandle(author);
    const sig = authorSigFor(author);
    const karma = karmaForHandle(author);
    const altColor = (n % 3 === 0) ? 'magenta' : (n % 3 === 1 ? '' : 'lime');

    const liked = currentUserLiked(postId);
    const likeCount = p.likes || 0;
    const likeBtn = `<a href="#" class="like-btn ${liked ? 'is-liked' : ''}" data-like="${postId}" title="${liked ? 'Unlike' : 'Like'}">▲ <b>${likeCount}</b></a>`;
    const isCorrect = !!p.isCorrectTrivia;
    const correctTag = isCorrect
      ? `<span class="trivia-correct-tag">✓ CORRECT ANSWER</span>` : '';

    // Trivia special UI on the first post of a daily-trivia thread
    let triviaUi = '';
    if (p.isTrivia) {
      const ans = p.triviaAnswer || state.triviaAnswer || '';
      triviaUi = `
        <div class="trivia-reveal-bar">
          <button type="button" class="trivia-reveal-btn" data-reveal-answer="${postId}">▶ REVEAL ANSWER</button>
          <span class="trivia-meta">post your guess as a reply · any caller can mark a reply as the correct answer</span>
        </div>
        <div class="trivia-reveal" data-trivia-reveal="${postId}" hidden>
          <span class="trivia-answer-label">ANSWER:</span>
          <span class="trivia-answer-text">${escapeHtml(ans)}</span>
        </div>
      `;
    }

    // For non-trivia replies in a daily-trivia thread, show MARK CORRECT
    const threadId = p.threadId;
    let markCorrect = '';
    if (isDailyTriviaThread(threadId) && n > 1 && !isCorrect) {
      markCorrect = `<a href="#" class="trivia-mark-btn" data-mark-correct="${postId}">★ MARK CORRECT</a>`;
    }

    return `
      <article class="post ${altColor} ${p.isTrivia ? 'is-trivia' : ''} ${isCorrect ? 'is-correct' : ''}" id="${postId}">
        <aside class="post-author">
          <div class="pa-handle">${escapeHtml(author)}${karma > 0 ? ` <span class="pa-karma" title="Total karma">★ ${karma}</span>` : ''}</div>
          ${staff ? '<span class="pa-role">★ MOD</span>' : ''}
          <div class="pa-stat">
            Posts: <b>${count}</b><br>
            Karma: <b>${karma}</b><br>
            Joined: ${joined}<br>
          </div>
        </aside>
        <div class="post-body">
          <div class="post-meta">
            <span class="pm-id">#${n}</span>
            <span>${formatStamp(p.createdAt)}</span>
            <span class="post-actions">
              <a href="#/compose?threadId=${posts_thread(p)}${p.id ? '&quotePostId=' + postId : ''}" data-quote="${postId}">QUOTE</a>
              <a href="#" data-post-author="${escapeHtml(author)}">PROFILE</a>
              ${likeBtn}
              ${markCorrect}
              ${correctTag}
            </span>
          </div>
          ${parseBB(p.body)}
          ${triviaUi}
          ${sig ? `<div class="sig">${escapeHtml(sig)}</div>` : ''}
        </div>
      </article>
    `;
  }
  function posts_thread(p) { return p.threadId; }

  function postCountForHandle(h) {
    if (!h) return 0;
    let n = 0;
    Object.values(state.posts).forEach(p => { if (p.author === h) n++; });
    return n;
  }
  function joinedAtForHandle(h) {
    if (isStaffHandle(h)) return '1996';
    if (['xX_Ph4nt0m_Xx','COOLGUY97','Lisa_M','SKATER_BOY','RAMROD'].includes(h)) return '1997';
    return '1998';
  }
  function authorSigFor(h) {
    const sigs = {
      'cyberangel': 'sysop · DUSKNET BBS · ICQ 44210933',
      'NeoTerra': '—> https://neoterra.dusknet.bbs/ —>',
      'ctrl-alt-del': 'ctrl · alt · delete ur problems',
      'omega_red': 'i came i saw i 56k-ed',
      'xX_Ph4nt0m_Xx': '~ ph4nt0m ~ strike first ~ strike hard ~',
      'COOLGUY97': 'cool guy 97 · lysergic dreams',
      'Lisa_M': '— lisa · 313 · smashing pumpkins since 91 —',
      'SKATER_BOY': 'sk8er b · lx · gnarly 4 life',
      'RAMROD': '■ RAMROD ■ industrial ■ nine inch nails ■ prodigy ■',
      'DaKoDeMaN': 'Quake 2 — Z : StarCraft — P : Diablo — S',
      '~angeldust~': 'angel dust ☼ aol disk collector ☼ pittsburgh',
      'buddyHolly1997': 'buddy holly ❤️ the crystal baller',
      'CyberPunkPrincess': 'cyber ⌬ punk ⌬ princess ⌬ detroit',
    };
    return sigs[h] || '';
  }

  // ============================================================
  // VIEW: COMPOSE
  // ============================================================
  function viewCompose(params) {
    const replyingTo = params.threadId && state.threads[params.threadId];
    const targetBoard = replyingTo
      ? state.boards.find(b => b.id === replyingTo.boardId)
      : state.boards.find(b => b.id === params.boardId) || state.boards[0];

    if (!targetBoard) return viewNotFound('No boards available.');

    if (!state.handle) {
      openHandleModal();
      return '';
    }

    const quotePid = params.quotePostId;
    const quoteP = quotePid ? state.posts[quotePid] : null;
    const quoteAuthor = quoteP ? quoteP.author : '';

    const submitUrl = replyingTo
      ? `#/thread/${replyingTo.id}`
      : '#/boards';

    // Generate a fresh captcha each time the compose view renders
    _activeCaptcha = generateCaptcha();
    const rate = rateLimitStatus('post');
    const rateBanner = !rate.allowed
      ? `<div class="lockout-banner">🛡 ${rate.reason} — TRY AGAIN IN A BIT</div>`
      : '';
    const lockoutBanner = isLockedOut()
      ? `<div class="lockout-banner">🛡 LOCKED — CAPTCHA BLOCKED. WAIT ${Math.ceil((_lockoutUntil - Date.now()) / 1000)}s</div>`
      : '';

    return `
      <div class="breadcrumbs">
        <a href="#/">Home</a> <span class="sep">›</span>
        <a href="#/boards">Boards</a> <span class="sep">›</span>
        ${replyingTo ? `<a href="#/board/${targetBoard.id}">${targetBoard.name}</a> <span class="sep">›</span>` : ''}
        ${replyingTo ? `<a href="#/thread/${replyingTo.id}">${escapeHtml(replyingTo.subject).slice(0, 28)}${replyingTo.subject.length > 28 ? '…' : ''}</a> <span class="sep">›</span>` : ''}
        <span class="here">${replyingTo ? 'Reply' : 'New Thread'}</span>
      </div>

      <section class="panel magenta">
        <h2 class="panel-title">${replyingTo ? '✎ POST A REPLY' : '✎ START A NEW THREAD'}</h2>
        <p style="font-family: var(--ff-mono); color: var(--ink-1); font-size: 13px;">
          posting as <b style="color: var(--neon-yw); text-shadow: 0 0 4px rgba(255, 240, 77, 0.5)">${escapeHtml(state.handle)}</b>${isStaffHandle(state.handle) ? ' (★ MOD)' : ''} ·
          board <b style="color: var(--neon-cy); text-shadow: 0 0 4px rgba(0, 246, 255, 0.45)">${targetBoard.name}</b>
        </p>
        <p style="font-family: var(--ff-mono); color: var(--ink-2); font-size: 12px;">
          your session: <b style="color: var(--neon-mg)">${rate.current.last1m}/min</b> ·
          <b style="color: var(--neon-mg)">${rate.current.last1h}/hr</b> ·
          <b style="color: var(--neon-mg)">${rate.current.last1d}/day</b> posts used
        </p>

        ${lockoutBanner}
        ${rateBanner}

        <form id="compose-form" class="compose-form" data-thread-id="${replyingTo ? replyingTo.id : ''}" data-board-id="${targetBoard.id}" novalidate>
          ${replyingTo ? '' : `
            <label>
              <span class="lbl">BOARD</span>
              <select name="boardId" style="background: #04010a; border: 1px solid var(--neon-cy); border-radius: 2px; padding: 8px 10px; font-family: var(--ff-mono); font-size: 14px; color: var(--ink-0);">
                ${state.boards.map(b => `<option value="${b.id}" ${b.id === targetBoard.id ? 'selected' : ''}>${b.name}</option>`).join('')}
              </select>
            </label>
            <label>
              <span class="lbl">SUBJECT</span>
              <input type="text" name="subject" maxlength="120" placeholder="Make it specific — this isn't facebook" required />
            </label>
          `}

          <label>
            <span class="lbl">${replyingTo ? `REPLY (re: ${escapeHtml(replyingTo.subject.slice(0, 40))}${replyingTo.subject.length > 40 ? '…' : ''})` : 'BODY'}</span>
            <textarea name="body" placeholder="Type your message here. Be kind. Mind the netiquette." required>${quoteP ? `[QUOTE=${quoteAuthor}]${quoteP.body}\n[/QUOTE]\n\n` : ''}</textarea>
          </label>

          <div class="format-help">
            <b>FORMAT:</b>
            <code>[B]</code> bold,
            <code>[I]</code> italic,
            <code>[U]</code> underline,
            <code>[CODE]...[/CODE]</code> code block,
            <code>[QUOTE=handle]...[/QUOTE]</code> quote,
            <code>[URL=link]label[/URL]</code> link.
            Plain URLs auto-link. Double-linebreak = paragraph.
          </div>

          ${renderCaptchaBlock(_activeCaptcha, 'compose')}

          <div class="cap-rules">
            🛡 ANTI-BOT — Captcha required. Honeypot, dwell timer, and rate limits active. ${MAX_CAPTCHA_FAILS - _captchaFails} attempts left.
          </div>

          <div class="compose-actions">
            <button type="submit" class="btn">▶ POST</button>
            <a href="${submitUrl}" class="btn danger sm">CANCEL</a>
            <span style="font-family: var(--ff-mono); font-size: 12px; color: var(--ink-2); margin-left: auto;">
              Posts are immediate. The mods review flagged posts within 24h.
            </span>
          </div>
        </form>
      </section>
    `;
  }

  function submitCompose(form) {
    const fd = new FormData(form);
    const subject = (fd.get('subject') || '').toString().trim();
    const body = (fd.get('body') || '').toString().trim();
    const replyThreadId = form.dataset.threadId;
    const boardId = replyThreadId
      ? state.threads[replyThreadId].boardId
      : (fd.get('boardId') || form.dataset.boardId);

    if (!state.handle) { openHandleModal(); return; }
    if (!body) return;

    // Anti-bot: rate limit
    const rate = rateLimitStatus('post');
    if (!rate.allowed) {
      toast(rate.reason);
      return;
    }
    // Anti-bot: captcha
    const v = handleCaptchaSubmit(form, 'compose');
    if (!v.ok) return;
    // Dwell timer: too-fast check is inside verifyCaptcha via openedAt

    // Bump daily streak (only counts once per calendar day)
    const streakBumped = bumpStreakIfNewDay();

    if (replyThreadId) {
      const t = state.threads[replyThreadId];
      if (t.isLocked) { toast('That thread is locked.'); return; }
      const id = makeId();
      state.posts[id] = {
        id, threadId: t.id, author: state.handle,
        createdAt: Date.now(), body, likes: 0, likedBy: [],
      };
      t.postIds.push(id);
      rateLimitStamp('post');
      saveState();
      _activeCaptcha = null;
      _captchaFails = 0;
      // Check achievements
      const newAch = evaluateAchievements() || [];
      const achMsg = newAch.length ? ' · achievement unlocked: ' + newAch.map(id => {
        const d = ACHIEVEMENT_DEFS.find(x => x.id === id);
        return d ? d.label : id;
      }).join(', ') : '';
      const streakMsg = streakBumped ? ' · streak: ' + streakCount() : '';
      toast('Posted!' + streakMsg + achMsg);
      navigate('#/thread/' + t.id);
    } else {
      if (!subject) { toast('Subject required for new threads.'); return; }
      const id = makeId();
      const t = {
        id, boardId, subject, author: state.handle,
        createdAt: Date.now(),
        isSticky: false, isLocked: false,
        views: 1, postIds: [],
      };
      const pid = id + '-p1';
      t.postIds.push(pid);
      state.threads[id] = t;
      state.posts[pid] = {
        id: pid, threadId: id, author: state.handle,
        createdAt: Date.now(), body, likes: 0, likedBy: [],
      };
      rateLimitStamp('post');
      saveState();
      _activeCaptcha = null;
      _captchaFails = 0;
      const newAch = evaluateAchievements() || [];
      const achMsg = newAch.length ? ' · achievement unlocked: ' + newAch.map(id => {
        const d = ACHIEVEMENT_DEFS.find(x => x.id === id);
        return d ? d.label : id;
      }).join(', ') : '';
      const streakMsg = streakBumped ? ' · streak: ' + streakCount() : '';
      toast('Posted!' + streakMsg + achMsg);
      navigate('#/thread/' + id);
    }
  }

  // ============================================================
  // VIEW: PROFILE
  // ============================================================
  function viewProfile() {
    if (!state.handle) {
      openHandleModal();
      setTimeout(() => navigate('#/'), 100);
      return '';
    }
    const posts = Object.values(state.posts).filter(p => p.author === state.handle);
    const threads = Object.values(state.threads).filter(t => t.author === state.handle);
    const staff = isStaffHandle(state.handle);
    const karma = totalKarma();
    const likedByMe = Object.keys(state.likedPosts || {}).length;
    const profile = state.profile || {};
    const sc = streakCount();
    const sa = streakActive();

    return `
      <div class="breadcrumbs">
        <a href="#/">Home</a> <span class="sep">›</span>
        <span class="here">Your Profile</span>
      </div>

      <section class="panel magenta">
        <h2 class="panel-title">▶ YOUR PROFILE</h2>
        <p style="font-family: var(--ff-mono); color: var(--ink-1); font-size: 14px;">
          Logged in as <b style="color: var(--neon-yw); text-shadow: 0 0 4px rgba(255, 240, 77, 0.55)">${escapeHtml(state.handle)}</b>${staff ? ' (★ MOD)' : ''}.
        </p>
        <div class="user-list" style="margin: 12px 0;">
          <div class="user-tile ${staff ? 'staff' : ''}">
            <div class="user-avatar">${escapeHtml(state.handle[0].toUpperCase())}</div>
            <div class="user-handle">${escapeHtml(state.handle)}</div>
            <div class="user-role-tag">${staff ? 'STAFF' : 'MEMBER'}</div>
          </div>
        </div>
        <div class="profile-stats">
          <div class="profile-stat">
            <div class="ps-label">POSTS</div>
            <div class="ps-value">${posts.length}</div>
          </div>
          <div class="profile-stat">
            <div class="ps-label">THREADS</div>
            <div class="ps-value">${threads.length}</div>
          </div>
          <div class="profile-stat">
            <div class="ps-label">KARMA</div>
            <div class="ps-value karma-val">★ ${karma}</div>
          </div>
          <div class="profile-stat">
            <div class="ps-label">STREAK</div>
            <div class="ps-value">${sa ? '🔥' : '·'} ${sc} ${plural(sc, 'day', 'days')}</div>
          </div>
          <div class="profile-stat">
            <div class="ps-label">LIKED</div>
            <div class="ps-value">▲ ${likedByMe}</div>
          </div>
        </div>

        <h3 style="font-family: var(--ff-pixel); font-size: 11px; color: var(--neon-yw); text-shadow: 0 0 4px rgba(255, 240, 77, 0.55); margin: 18px 0 8px;">★ ABOUT YOU</h3>
        <div class="profile-card">
          <div class="profile-row">
            <span class="pr-key">Bio:</span>
            <span class="pr-val">${profile.bio ? escapeHtml(profile.bio) : '<i style="color: var(--ink-3)">— not set —</i>'}</span>
          </div>
          <div class="profile-row">
            <span class="pr-key">Favorite MP3:</span>
            <span class="pr-val">${profile.favoriteMp3 ? '♫ ' + escapeHtml(profile.favoriteMp3) : '<i style="color: var(--ink-3)">— not set —</i>'}</span>
          </div>
          <div class="profile-row">
            <span class="pr-key">Hometown:</span>
            <span class="pr-val">${profile.hometown ? escapeHtml(profile.hometown) : '<i style="color: var(--ink-3)">— not set —</i>'}</span>
          </div>
          <div class="profile-row">
            <span class="pr-key">Modem Speed:</span>
            <span class="pr-val">${profile.modem ? '◉ ' + escapeHtml(profile.modem) : '<i style="color: var(--ink-3)">— not set —</i>'}</span>
          </div>
          <div class="profile-actions-row">
            <button type="button" class="btn sm" id="edit-profile-btn">✎ EDIT PROFILE</button>
            <span class="profile-hint">Set bio, favorite mp3, hometown, modem speed</span>
          </div>
        </div>

        ${renderAchievementsGrid(false)}

        <h3 style="font-family: var(--ff-pixel); font-size: 11px; color: var(--neon-mg); text-shadow: 0 0 4px rgba(255, 43, 214, 0.55); margin: 22px 0 8px;">CHANGE HANDLE</h3>
        <form id="handle-change-form" class="compose-form" style="max-width: 420px;">
          <label>
            <span class="lbl">NEW HANDLE</span>
            <input type="text" name="handle" maxlength="24" value="${escapeHtml(state.handle)}" pattern="[A-Za-z0-9_~.\\-]{2,24}" required />
          </label>
          <div class="modal-helper">Letters, digits, underscore, dash, dot, or tilde. 2–24 chars.</div>
          <div class="compose-actions">
            <button type="submit" class="btn">▶ CHANGE HANDLE</button>
            <button type="button" class="btn danger sm" id="sign-out-btn">SIGN OUT</button>
            <button type="button" class="btn amber sm" id="reset-bbs-btn">RESET BBS</button>
          </div>
        </form>

        ${threads.length || posts.length ? `
          <h3 style="font-family: var(--ff-pixel); font-size: 11px; color: var(--neon-cy); text-shadow: 0 0 4px rgba(0, 246, 255, 0.55); margin: 22px 0 8px;">YOUR RECENT POSTS</h3>
          <div class="thread-row head"><div class="t-subj">SUBJECT</div><div class="t-author">BOARD</div><div class="t-stats">REPLIES</div><div class="t-last">WHEN</div></div>
          ${[...threads, ...posts].slice(0, 8).map((x, i) => {
            if (x.postIds) {
              // it's a thread
              const b = state.boards.find(b => b.id === x.boardId);
              return renderThreadRow(x);
            }
            // it's a post — find its thread
            const t = state.threads[x.threadId];
            if (!t) return '';
            const b = state.boards.find(b => b.id === t.boardId);
            return `
              <div class="thread-row">
                <a class="t-subj" href="#/thread/${t.id}">${escapeHtml(t.subject)}</a>
                <div class="t-author">${b ? escapeHtml(b.name) : '—'}</div>
                <div class="t-stats">${threadReplyCount(t.id)}</div>
                <div class="t-last">${formatAge(x.createdAt)}</div>
              </div>
            `;
          }).join('')}
        ` : ''}
      </section>
    `;
  }

  // ============================================================
  // VIEW: ONLINE
  // ============================================================
  function viewOnline() {
    const list = [...ONLINE_USERS];
    if (state.handle && !list.includes(state.handle)) list.unshift(state.handle);
    const tiles = list.map(h => {
      const staff = isStaffHandle(h);
      return `
        <div class="user-tile ${staff ? 'staff' : ''}">
          <div class="user-avatar">${escapeHtml(h[0].toUpperCase())}</div>
          <div class="user-handle">${escapeHtml(h)}</div>
          <div class="user-role-tag">${staff ? 'STAFF' : 'MEMBER'}</div>
        </div>
      `;
    }).join('');
    return `
      <div class="breadcrumbs">
        <a href="#/">Home</a> <span class="sep">›</span>
        <span class="here">Online Now</span>
      </div>
      <section class="panel lime">
        <h2 class="panel-title">◉ CALLERS ONLINE — ${list.length} ACTIVE</h2>
        <p style="font-family: var(--ff-mono); color: var(--ink-1); font-size: 14px;">
          These callers are connected to DUSKNET BBS right now. Idle time in <i>parenthesis</i>. Say hi.
        </p>
        <div class="user-list">${tiles}</div>
      </section>
    `;
  }

  // ============================================================
  // VIEW: STAFF
  // ============================================================
  function viewStaff() {
    const tiles = [...STAFF_HANDLES].map(h => `
      <div class="user-tile staff">
        <div class="user-avatar">${escapeHtml(h[0].toUpperCase())}</div>
        <div class="user-handle">${escapeHtml(h)}</div>
        <div class="user-role-tag">MOD</div>
      </div>
    `).join('');
    return `
      <div class="breadcrumbs">
        <a href="#/">Home</a> <span class="sep">›</span>
        <span class="here">Staff</span>
      </div>
      <section class="panel amber">
        <h2 class="panel-title">★ BBS STAFF</h2>
        <p style="font-family: var(--ff-mono); color: var(--ink-1); font-size: 14px;">
          These are the moderators and the sysop of DUSKNET BBS. They've been here since the floppy days. Ping them with reports or ideas.
        </p>
        <div class="user-list">${tiles}</div>
        <div class="ascii-rule">╔════════════════════════════════╗<br>║  sysop: cyberangel (1996)  ║<br>╚════════════════════════════════╝</div>
      </section>
    `;
  }

  // ============================================================
  // VIEW: HELP
  // ============================================================
  function viewHelp() {
    return `
      <div class="breadcrumbs">
        <a href="#/">Home</a> <span class="sep">›</span>
        <span class="here">Help &amp; Rules</span>
      </div>

      <section class="panel">
        <h2 class="panel-title">? HOW TO USE DUSKNET BBS</h2>
        <ol style="font-family: var(--ff-mono); color: var(--ink-1); font-size: 14px; padding-left: 22px; line-height: 1.7;">
          <li>Pick a handle (top right <b>Sign In ▾</b>). 2-24 chars.</li>
          <li>Pick a board from the <a href="#/boards">Boards</a> index.</li>
          <li>Click any thread to read replies.</li>
          <li>Hit <b>QUOTE</b> under a post to reply with a quote block.</li>
          <li>Start a new thread with the <b>POST NEW THREAD</b> button on a board page.</li>
          <li>Change your handle anytime at <a href="#/profile">your profile</a>.</li>
        </ol>
        <div class="ascii-rule">·̩̩̥͙**•̩̩͙✦•̩̩͙*˚̩̩̥͙**•̩̩͙✦•̩̩͙*˚·̩̩̥͙</div>

        <h3 style="font-family: var(--ff-pixel); font-size: 11px; color: var(--neon-rd); text-shadow: 0 0 4px rgba(255, 78, 78, 0.55); margin-bottom: 6px;">⚠ RULES — DON'T GET PURGED ⚠</h3>
        <ul style="font-family: var(--ff-mono); color: var(--ink-1); font-size: 13px; padding-left: 22px; line-height: 1.7;">
          <li>Be cool. No doxxing, no slurs, no harassment.</li>
          <li>No warez. Linking to mp3.com and Napster queries is fine.</li>
          <li>One thread per topic. Use the boards.</li>
          <li>Don't paste logs over 30 lines — link a file instead.</li>
          <li>Keep sig lines short. Some ppl are on 14.4k.</li>
        </ul>

        <h3 style="font-family: var(--ff-pixel); font-size: 11px; color: var(--neon-cy); text-shadow: 0 0 4px rgba(0, 246, 255, 0.55); margin-bottom: 6px;">✦ FORMATTING ✦</h3>
        <p style="font-family: var(--ff-mono); font-size: 13px; color: var(--ink-1);">
          <code>[B]bold[/B]</code> · <code>[I]italic[/I]</code> · <code>[U]underline[/U]</code><br>
          <code>[CODE]fprintf(1, "hi");[/CODE]</code> · <code>[QUOTE=handle]…[/QUOTE]</code> · <code>[URL=link]label[/URL]</code><br>
          Plain URLs auto-link. Double-linebreak = paragraph.
        </p>

        <h3 style="font-family: var(--ff-pixel); font-size: 11px; color: var(--neon-mg); text-shadow: 0 0 4px rgba(255, 43, 214, 0.55); margin-bottom: 6px;">★ ABOUT THIS BBS ★</h3>
        <p style="font-family: var(--ff-mono); font-size: 13px; color: var(--ink-1);">
          This is a portfolio piece — a vibe-coded throwback to 1996–1999 web bulletin boards. All handles, posts, and threads are fictional. Press <kbd style="background: var(--neon-mg); color: #07021a; padding: 1px 5px; border-radius: 2px;">RESET BBS</kbd> in your profile to wipe the seed and start fresh.
        </p>
      </section>
    `;
  }

  // ============================================================
  // VIEW: NOT FOUND
  // ============================================================
  function viewNotFound(detail) {
    return `
      <div class="breadcrumbs"><a href="#/">Home</a> <span class="sep">›</span> <span class="here">404</span></div>
      <section class="panel">
        <div class="empty-state">
          <pre class="ascii">
   ╔════════════════════════════╗
   ║   END OF LINE — 404 ✦      ║
   ╚════════════════════════════╝</pre>
          <h3>404 — PAGE NOT FOUND</h3>
          <p>${detail || 'The page you tried to load doesn\'t exist on this BBS.'}</p>
          <a class="btn" href="#/">▶ BACK TO HOME</a>
        </div>
      </section>
    `;
  }

  // ============================================================
  // MODAL (sign in / handle change)
  // ============================================================
  let modalClose = null;
  function openModal(title, bodyHtml, onClose) {
    const root = document.getElementById('modal-root');
    document.getElementById('modal-title').textContent = title;
    document.getElementById('modal-body').innerHTML = bodyHtml;
    root.hidden = false;
    modalClose = onClose;
    setTimeout(() => {
      const input = root.querySelector('input[type="text"]');
      if (input) input.focus();
    }, 50);
  }
  function closeModal() {
    const root = document.getElementById('modal-root');
    root.hidden = true;
    if (modalClose) { try { modalClose(); } catch (_) {} }
    modalClose = null;
  }
  function openHandleModal() {
    _activeCaptcha = generateCaptcha();
    openModal('SIGN IN TO DUSKNET', `
      <p style="color: var(--ink-1);">Choose a handle to post under. Don't use your real name — this is the 90s. Pick anything memorable.</p>
      <form id="handle-form" novalidate>
        <label>
          <span class="lbl">HANDLE</span>
          <input type="text" name="handle" maxlength="24" placeholder="e.g. phantom99" pattern="[A-Za-z0-9_~.\\-]{2,24}" required />
        </label>
        <div class="modal-helper">2–24 chars. Letters, digits, underscore, dash, dot, or tilde.</div>

        ${renderCaptchaBlock(_activeCaptcha, 'handle')}

        <div class="cap-rules">
          ⚡ This BBS is bot-shielded. Submissions are rate-limited and audited. Repeated bot-like activity = 1h purge.
        </div>

        <div class="modal-actions">
          <button type="submit" class="btn">▶ ENTER</button>
          <button type="button" class="btn danger sm" data-modal-close>CANCEL</button>
        </div>
      </form>
    `);
    const form = document.getElementById('handle-form');
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const fd = new FormData(form);
      const h = (fd.get('handle') || '').toString().trim();
      if (!h) {
        showCaptchaError('handle', 'HANDLE REQUIRED');
        return;
      }
      if (isForbiddenHandle(h)) {
        showCaptchaError('handle', `HANDLE "${h}" IS RESERVED OR INVALID`);
        return;
      }
      const rate = rateLimitStatus('handle');
      if (!rate.allowed) {
        showCaptchaError('handle', rate.reason);
        return;
      }
      const v = handleCaptchaSubmit(form, 'handle');
      if (!v.ok) return;
      const wasNew = !state.handle;
      setHandle(h);
      rateLimitStamp('handle');
      _activeCaptcha = null;
      _captchaFails = 0;
      closeModal();
      toast('Welcome, ' + h + '.');
      renderApp();
      // First-time sign-in: prompt for profile customization
      if (wasNew && isProfileEmpty()) {
        setTimeout(() => openProfileCustomizationModal(true), 280);
      }
    });
  }

  function openProfileCustomizationModal(isFirstTime) {
    const p = state.profile || {};
    const title = isFirstTime
      ? '★ WELCOME — SET UP YOUR PROFILE'
      : '★ EDIT PROFILE';
    openModal(title, `
      <p style="color: var(--ink-1); font-family: var(--ff-mono); font-size: 12px;">
        ${isFirstTime ? 'One quick setup before you post — tell us about yourself. You can edit this anytime from your profile.' : 'Update your profile details.'}
      </p>
      <form id="profile-custom-form" class="compose-form" style="margin-top: 8px;">
        <label>
          <span class="lbl">BIO</span>
          <input type="text" name="bio" maxlength="240" value="${escapeHtml(p.bio || '')}" placeholder="e.g. dial-up survivor · 14.4k · into remix culture" />
        </label>
        <label>
          <span class="lbl">FAVORITE MP3</span>
          <input type="text" name="favoriteMp3" maxlength="80" value="${escapeHtml(p.favoriteMp3 || '')}" placeholder="e.g. The Prodigy — Firestarter" />
        </label>
        <label>
          <span class="lbl">HOMETOWN</span>
          <input type="text" name="hometown" maxlength="60" value="${escapeHtml(p.hometown || '')}" placeholder="e.g. Detroit, MI" />
        </label>
        <label>
          <span class="lbl">MODEM SPEED</span>
          <input type="text" name="modem" maxlength="40" value="${escapeHtml(p.modem || '')}" placeholder="e.g. 33.6k · v.90 · 56k lie" />
        </label>
        <div class="modal-actions">
          <button type="submit" class="btn">▶ ${isFirstTime ? 'SAVE & ENTER' : 'SAVE'}</button>
          ${isFirstTime ? '<button type="button" class="btn danger sm" data-modal-close>SKIP FOR NOW</button>' : '<button type="button" class="btn danger sm" data-modal-close>CANCEL</button>'}
        </div>
      </form>
    `);
    const form = document.getElementById('profile-custom-form');
    if (!form) return;
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const fd = new FormData(form);
      saveProfile({
        bio: fd.get('bio'),
        favoriteMp3: fd.get('favoriteMp3'),
        hometown: fd.get('hometown'),
        modem: fd.get('modem'),
      });
      closeModal();
      toast('Profile saved.');
      renderApp();
    });
  }

  // ============================================================
  // TOAST
  // ============================================================
  let toastTimer = null;
  function toast(text) {
    const el = document.getElementById('toast');
    if (!el) return;
    el.textContent = text;
    el.hidden = false;
    requestAnimationFrame(() => el.classList.add('is-open'));
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      el.classList.remove('is-open');
      setTimeout(() => { el.hidden = true; }, 220);
    }, 2200);
  }

  // ============================================================
  // APP RENDER
  // ============================================================
  function renderApp() {
    const route = currentRoute();
    const stage = document.getElementById('app');
    if (!stage) return;

    let html = '';
    switch (route.name) {
      case 'home':    html = viewHome(); break;
      case 'boards':  html = viewBoards(); break;
      case 'board':   html = viewBoard(route.params.boardId); break;
      case 'thread':  html = viewThread(route.params.threadId); break;
      case 'compose': html = viewCompose(route.params); break;
      case 'profile': html = viewProfile(); break;
      case 'online':  html = viewOnline(); break;
      case 'staff':   html = viewStaff(); break;
      case 'help':    html = viewHelp(); break;
      default:        html = viewNotFound(); break;
    }
    stage.innerHTML = html;
    stage.scrollTop = 0;
    window.scrollTo({ top: 0, behavior: 'instant' });

    renderStats();
    renderHandlePill();
    renderHitDigits();
    renderNavActive();

    // wire up compose form if present
    const composeForm = document.getElementById('compose-form');
    if (composeForm) composeForm.addEventListener('submit', onComposeSubmit);

    // nav state
    currentRouteRef = route;
  }
  let currentRouteRef = null;

  function onComposeSubmit(e) {
    e.preventDefault();
    submitCompose(e.target);
  }

  // ============================================================
  // EVENT WIRING
  // ============================================================
  function onClick(e) {
    const handlePill = e.target.closest('#handle-pill');
    if (handlePill) { state.handle ? openProfileModal() : openHandleModal(); return; }

    const close = e.target.closest('[data-modal-close]');
    if (close) { closeModal(); return; }

    const profile = e.target.closest('[data-post-author]');
    if (profile) { e.preventDefault(); toast('No profile viewer in 1996. Handle: ' + profile.dataset.postAuthor); return; }

    // Like button
    const likeBtn = e.target.closest('[data-like]');
    if (likeBtn) {
      e.preventDefault();
      const pid = likeBtn.dataset.like;
      const ok = toggleLike(pid);
      if (ok) {
        // Re-render the post in-place by finding the article and re-rendering it
        const article = document.getElementById(pid);
        if (article) {
          const t = state.threads[state.posts[pid].threadId];
          const idx = t ? t.postIds.indexOf(pid) : 0;
          const tmp = document.createElement('div');
          tmp.innerHTML = renderPost(pid, idx + 1);
          const newArt = tmp.firstElementChild;
          if (newArt) article.replaceWith(newArt);
        }
        // Update other UI (stats, home, profile)
        renderStats();
      }
      return;
    }

    // Reveal trivia answer
    const revealBtn = e.target.closest('[data-reveal-answer]');
    if (revealBtn) {
      e.preventDefault();
      const pid = revealBtn.dataset.revealAnswer;
      const target = document.querySelector('[data-trivia-reveal="' + pid + '"]');
      if (target) {
        target.hidden = false;
        revealBtn.disabled = true;
        revealBtn.textContent = '✓ ANSWER REVEALED';
      }
      return;
    }

    // Mark trivia reply as correct
    const markBtn = e.target.closest('[data-mark-correct]');
    if (markBtn) {
      e.preventDefault();
      const pid = markBtn.dataset.markCorrect;
      markTriviaAnswerCorrect(pid);
      // Find thread and re-render
      const post = state.posts[pid];
      if (post) {
        const t = state.threads[post.threadId];
        if (t) {
          // toast feedback
          const author = post.author;
          const you = state.handle;
          if (author === you) {
            toast('★ Marked as correct — you earned Trivia Master!');
          } else {
            toast('★ Marked ' + author + ' as the trivia winner.');
          }
          // re-render full thread
          renderApp();
        }
      }
      return;
    }

    // Edit profile button
    const editProf = e.target.closest('#edit-profile-btn');
    if (editProf) {
      e.preventDefault();
      openProfileCustomizationModal(false);
      return;
    }

    const reset = e.target.closest('#reset-bbs-btn');
    if (reset) {
      if (confirm('Wipe the seed and start fresh? Posts and threads will be lost.')) {
        reseed();
        renderApp();
        toast('BBS reset to seed state.');
      }
      return;
    }

    const signOut = e.target.closest('#sign-out-btn');
    if (signOut) {
      state.handle = null;
      state.likedPosts = {};
      saveState();
      renderApp();
      toast('Signed out.');
      return;
    }

    const handleChange = e.target.closest('#handle-change-form');
    if (handleChange && e.target.matches('button[type="submit"]')) {
      e.preventDefault();
      const form = handleChange;
      const fd = new FormData(form);
      const h = (fd.get('handle') || '').toString().trim();
      if (h) {
        setHandle(h);
        toast('Handle updated.');
        renderApp();
      }
      return;
    }
  }

  function openProfileModal() {
    const h = state.handle || '';
    openModal('YOUR HANDLE', `
      <p style="color: var(--ink-1);">You are signed in as <b style="color: var(--neon-yw)">${escapeHtml(h)}</b>.</p>
      <div class="modal-actions">
        <a href="#/profile" class="btn" data-modal-close>▶ PROFILE</a>
        <button type="button" class="btn danger sm" id="modal-signout">SIGN OUT</button>
        <button type="button" class="btn amber sm" data-modal-close>CLOSE</button>
      </div>
    `);
    setTimeout(() => {
      const so = document.getElementById('modal-signout');
      if (so) so.addEventListener('click', () => {
        state.handle = null;
        saveState();
        renderApp();
        closeModal();
        toast('Signed out.');
      });
    }, 30);
  }

  function onHashChange() {
    renderApp();
  }

  // ============================================================
  // BOOT
  // ============================================================
  function init() {
    const had = loadState();
    if (!had) { reseed(); saveState(); }
    normalizeState();
    ensureDailyTriviaThread();
    incrementHit();
    document.body.addEventListener('click', onClick);
    window.addEventListener('hashchange', onHashChange);
    renderApp();
  }

  document.addEventListener('DOMContentLoaded', init);
})();
