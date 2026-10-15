/* =====================================================================
 * MAVIS BEACON TEACHES TYPING — 1987 EDITION
 *
 * Browser recreation of the classic EGA-era typing tutor.
 *
 * Architecture:
 *   - Single `app` IIFE owns everything
 *   - FSM phase: BOOT, MENU, LESSONS, LESSON, PRACTICE, TESTS, TEST,
 *                DAILY, RESULTS, REPORTS, OPTIONS, GAME, CERT
 *   - Each phase has enter()/exit()/tick() functions
 *   - Shared typing input feeds WPM/accuracy/error tracking
 *   - localStorage saves settings + history + per-key error counters
 *
 * Sections:
 *   Constants · State · Audio · Persistence · Helpers ·
 *   Boot · Menu · Lessons · Lesson · Practice · Tests ·
 *   Test · Daily · Results · Reports · Game · Options · Cert ·
 *   Input · Keyboard · Modern HUD · Init
 * ===================================================================== */

(() => {
  "use strict";

  // =====================================================================
  // CONSTANTS
  // =====================================================================

  const SCHEMA_VERSION = 2;
  const SAVE_KEY = "mavisbeacon.save.v1";

  // Status bar messages per phase
  const STATUS = {
    BOOT:     "READY",
    MENU:     "MAIN MENU",
    LESSONS:  "LESSON PLAN",
    LESSON:   "LESSON IN PROGRESS",
    PRACTICE: "FREE PRACTICE",
    TESTS:    "TIMED TESTS",
    TEST:     "TEST IN PROGRESS",
    DAILY:    "DAILY CHALLENGE",
    RESULTS:  "TEST RESULTS",
    REPORTS:  "PROGRESS REPORTS",
    GAME:     "KEY-BOARD HERO",
    OPTIONS:  "OPTIONS",
    CERT:     "CERTIFICATE OF ACCOMPLISHMENT",
  };

  // 5 characters = 1 word (industry-standard WPM convention)
  const CHARS_PER_WORD = 5;

  // Long-form practice texts (paragraph length)
  const PRACTICE_TEXTS = [
    "The quick brown fox jumps over the lazy dog. This sentence uses every letter of the keyboard, so it is perfect for typing practice. Try to keep a steady rhythm and avoid looking down at your hands.",
    "Pack my box with five dozen liquor jugs. A classic pangram for testing keyboards and finger reach across the home, top, and bottom rows. Watch your posture and breathe as you type.",
    "Mavis Beacon teaches typing the right way: with patience, repetition, and a clear sense of which finger belongs to which key. Trust the muscle memory; it will come.",
    "Sphinx of black quartz, judge my vow. Another pangram, this one using rare letters like q, x, and z. Excellent for practicing tricky bottom-row keys.",
    "How razorback-jumping frogs can level six piqued gymnasts. A fun sentence for stretching your reach and warming up before a test. Keep your wrists loose and your hands light.",
    "She sells seashells by the seashore. The waves roll in, the gulls cry out, and the sun beats down on the sand. A classic tongue-twister turned typing drill.",
  ];

  // Short paragraphs used for tests (roughly 60s of content)
  const TEST_TEXTS = [
    "Mavis Beacon believes everyone can type well with practice. Keep your fingers on the home row, look at the screen, and let your hands learn where each key belongs. Speed comes from accuracy, not the other way around.",
    "The keyboard is divided into zones, one for each finger. Your left pinky handles the bottom-left keys, your thumbs handle the space bar, and your index fingers share the top-row bumps on F and J. Train each hand separately.",
    "Typing is a conversation between your eyes and your hands. Your eyes read the words ahead, your fingers know where to land, and the rhythm in between is where speed is born. Stay calm, breathe, and trust the process.",
    "Good posture helps you type faster for longer. Sit up straight, keep your elbows at a right angle, and rest your wrists lightly on the table. A relaxed body types better than a tense one, every single time.",
    "The best way to learn is to type a little every day. Twenty minutes of focused practice beats two hours of distracted drilling. Come back tomorrow, and tomorrow, and the keys will start to feel like home.",
    "Punctuation is part of the language too. Commas slow you down for a breath, periods mark the end of a thought, and quotes and apostrophes earn their place on the top row. Practice them early and often.",
  ];

  // Grade thresholds (for timed tests). Grade based on WPM × accuracy factor.
  const GRADES = [
    { min: 90, grade: "A+", msg: "Outstanding! Mavis is proud of you." },
    { min: 75, grade: "A",  msg: "Excellent typing — keep it up!" },
    { min: 60, grade: "B",  msg: "Strong work. A little more practice and you'll ace it." },
    { min: 45, grade: "C",  msg: "Solid foundation. Focus on accuracy next." },
    { min: 30, grade: "D",  msg: "Keep at it — speed comes with repetition." },
    { min: 0,  grade: "F",  msg: "Don't give up. Start with the lessons." },
  ];

  // Short daily-challenge sentences. The same sentence is shown to everyone
  // on a given calendar day (date-seeded), so leaderboards would be fair.
  const DAILY_TEXTS = [
    "Mavis says: type one sentence a day and your speed will grow like a sunflower in July.",
    "Every key you press is a small promise to your future self. Keep typing, keep learning.",
    "The hum of a CRT monitor is the soundtrack of progress. Make each keystroke count today.",
    "Sphinx of black quartz, judge my vow. Five words, twenty-nine letters, all the power.",
    "Patience, posture, and practice — those are the three P's of becoming a typing master.",
  ];

  // Game tuning (combo, waves, boss, power-ups)
  const COMBO_TIMEOUT_MS = 1500;
  const COMBO_MAX = 8;
  const COMBO_TIER_FLASH = new Set([2, 3, 5, COMBO_MAX]);
  const GAME_DURATION_MS = 60_000;
  const GAME_FALL_INTERVAL_START = 1100;     // ms between new letters at start
  const GAME_FALL_INTERVAL_END = 700;        // ms between new letters at end
  const GAME_LETTER_SPEED = 0.06;            // px/ms base fall speed
  const GAME_WAVE_DURATION_MS = 6_000;       // each numbered wave is ~6s
  const GAME_BOSS_EVERY_WAVES = 2;           // boss every 2 named waves (~12s)
  const GAME_BOSS_FONT = 56;
  const GAME_BOSS_COLOR = "#ff4040";         // red
  const GAME_BOSS_VALUE_MULT = 5;
  const POWERUP_DROP_CHANCE = 0.05;
  const POWERUP_TYPES = {
    S: { id: "slow", label: "SLOW",   durationMs: 5000, speedMult: 0.5 },
    B: { id: "bomb", label: "BOMB",   durationMs: 0,    speedMult: 1,   bomb: true },
    X: { id: "x2",   label: "2X POINTS", durationMs: 5000, speedMult: 1, mult: 2 },
  };
  // Letters used for normal falling letters (subset of the keyboard)
  const GAME_LETTERS = "asdfjkl;qwertyuiopzxcvbnm";

  // =====================================================================
  // STATE
  // =====================================================================

  // Persistent app state (saved to localStorage)
  const settings = {
    sound: true,
    palette: "ega-teal",
    goalWpm: 40,
    goalAccuracy: 95,
  };

  const stats = {
    completedLessons: [],   // array of lesson indices
    history: [],            // [{when, kind, wpm, acc, errors, durationSec, score?}]
    keyErrors: {},          // { "j": 12, "f": 4, ... }
    bestWpm: 0,
    bestAcc: 0,
    streak: 0,              // consecutive active days
    lastActiveDate: "",     // "YYYY-MM-DD"
    dailyBest: {},          // { "YYYY-MM-DD": { wpm, acc, errors, chars, durationSec } }
  };

  // Transient runtime state
  const ui = {
    phase: "BOOT",
    prevPhase: null,
    booted: false,
    selectedLesson: 0,
    selectedOption: 0,
    flashTimer: 0,
  };

  // Active session state for typing screens (lesson / practice / test / daily)
  const session = {
    target: "",          // text to type
    typed: "",           // what the user has typed so far
    startTime: 0,        // performance.now() when typing began
    elapsedMs: 0,        // accumulated elapsed time (for tests, ticks pause)
    errors: 0,
    completed: false,
    timerHandle: 0,      // setInterval id
    lessonIdx: 0,
    testKind: "1min",    // "1min" | "3min" | "5min"
    testDurationMs: 60_000,
    testTimeLeftMs: 60_000,
    paused: false,
    // Daily challenge state
    daily: null,
    // Game state
    game: null,          // initialized by game phase
  };

  // =====================================================================
  // AUDIO — simple WebAudio beeps (DOS-era feel)
  // =====================================================================

  const audio = {
    ctx: null,

    ensure() {
      if (!settings.sound) return null;
      if (this.ctx) return this.ctx;
      try {
        const Ctx = window.AudioContext || window.webkitAudioContext;
        if (!Ctx) return null;
        this.ctx = new Ctx();
        return this.ctx;
      } catch { return null; }
    },

    resume() {
      const ctx = this.ensure();
      if (ctx && ctx.state === "suspended") ctx.resume().catch(() => {});
    },

    beep(freq, durationMs, type = "square", gain = 0.06) {
      if (!settings.sound) return;
      const ctx = this.ensure();
      if (!ctx) return;
      const t0 = ctx.currentTime;
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, t0);
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(gain, t0 + 0.005);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + durationMs / 1000);
      osc.connect(g).connect(ctx.destination);
      osc.start(t0);
      osc.stop(t0 + durationMs / 1000 + 0.02);
    },

    click()  { this.beep(880, 35); },
    good()   { this.beep(1200, 60); },
    bad()    { this.beep(160, 120, "sawtooth", 0.1); },
    combo(tier) {
      // Higher pitch + double-note for higher combos
      const base = 880 + (tier - 1) * 110;
      this.beep(base, 70, "square", 0.05);
      setTimeout(() => this.beep(base * 1.5, 80, "square", 0.05), 60);
    },
    boss() {
      this.beep(110, 220, "sawtooth", 0.12);
      setTimeout(() => this.beep(82, 260, "sawtooth", 0.12), 220);
    },
    powerup() {
      this.beep(523, 60);
      setTimeout(() => this.beep(784, 60), 60);
      setTimeout(() => this.beep(1046, 100), 120);
    },
    bomb() {
      this.beep(220, 120, "sawtooth", 0.12);
      setTimeout(() => this.beep(110, 220, "sawtooth", 0.12), 100);
    },
    wave(n) {
      this.beep(660, 80);
      setTimeout(() => this.beep(880, 80), 80);
      setTimeout(() => this.beep(990, 120), 160);
    },
    success() {
      this.beep(660, 80);
      setTimeout(() => this.beep(880, 80), 80);
      setTimeout(() => this.beep(1320, 140), 160);
    },
    boot()   {
      this.beep(220, 90);
      setTimeout(() => this.beep(440, 90), 90);
      setTimeout(() => this.beep(880, 200), 180);
    },
    error()  { this.beep(220, 200, "sawtooth", 0.1); },
  };

  // =====================================================================
  // PERSISTENCE
  // =====================================================================

  function saveSnapshot() {
    return {
      schema: SCHEMA_VERSION,
      settings: { ...settings },
      stats: {
        completedLessons: [...stats.completedLessons],
        history: stats.history.slice(-50),
        keyErrors: { ...stats.keyErrors },
        bestWpm: stats.bestWpm,
        bestAcc: stats.bestAcc,
        streak: stats.streak || 0,
        lastActiveDate: stats.lastActiveDate || "",
        dailyBest: { ...(stats.dailyBest || {}) },
      },
    };
  }

  function save() {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(saveSnapshot()));
    } catch (e) {
      console.warn("save failed", e);
    }
  }

  function load() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return null;
      const snap = JSON.parse(raw);
      if (!snap || typeof snap !== "object") return null;
      if (snap.schema !== SCHEMA_VERSION) {
        // Best-effort migration. Carry over what we can from older schemas.
        if (!snap.settings) snap.settings = {};
        if (!snap.stats) snap.stats = {};
        if (typeof snap.stats.streak !== "number") snap.stats.streak = 0;
        if (typeof snap.stats.lastActiveDate !== "string") snap.stats.lastActiveDate = "";
        if (!snap.stats.dailyBest || typeof snap.stats.dailyBest !== "object") snap.stats.dailyBest = {};
        snap.schema = SCHEMA_VERSION;
      }
      return snap;
    } catch { return null; }
  }

  function resetStats() {
    stats.completedLessons = [];
    stats.history = [];
    stats.keyErrors = {};
    stats.bestWpm = 0;
    stats.bestAcc = 0;
    stats.streak = 0;
    stats.lastActiveDate = "";
    stats.dailyBest = {};
    save();
  }

  // =====================================================================
  // HELPERS
  // =====================================================================

  const $ = (id) => document.getElementById(id);

  function fmtTime(ms) {
    const totalSec = Math.max(0, Math.floor(ms / 1000));
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return `${m}:${String(s).padStart(2, "0")}`;
  }

  function fmtClock(ms) {
    const totalSec = Math.max(0, Math.ceil(ms / 1000));
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return `${m}:${String(s).padStart(2, "0")}`;
  }

  function wpmOf(typedLen, elapsedMs) {
    if (elapsedMs < 200) return 0;
    const words = typedLen / CHARS_PER_WORD;
    const minutes = elapsedMs / 60000;
    return Math.max(0, Math.round(words / minutes));
  }

  function accOf(typedLen, errors) {
    const total = typedLen + errors;
    if (total <= 0) return 100;
    return Math.round((typedLen / total) * 100);
  }

  function gradeFor(wpm, acc) {
    // Score = wpm × (acc/100). Higher = better.
    const score = wpm * (acc / 100);
    for (const g of GRADES) {
      if (score >= g.min) return g;
    }
    return GRADES[GRADES.length - 1];
  }

  function flashKey(key, correct) {
    const btn = document.querySelector(`.key[data-key="${cssEscape(key)}"]`);
    if (!btn) return;
    btn.classList.remove("flash-correct", "flash-wrong", "active");
    btn.classList.add(correct ? "flash-correct" : "flash-wrong", "active");
    setTimeout(() => {
      btn.classList.remove("flash-correct", "flash-wrong", "active");
    }, 180);
  }

  function cssEscape(s) {
    if (window.CSS && window.CSS.escape) return window.CSS.escape(s);
    return String(s).replace(/([^\w-])/g, "\\$1");
  }

  // Compute WPM-based reward for finishing a lesson. Always returns full
  // stats so feedback messages can show them, even for very fast finishes.
  function wpmReward(typedLen, errors, elapsedMs) {
    const effectiveMs = Math.max(1, elapsedMs);
    const wpm = wpmOf(typedLen, effectiveMs);
    const acc = accOf(typedLen, errors);
    return {
      passed: acc >= 90 && typedLen >= 30,
      score: Math.round(wpm * (acc / 100)),
      wpm, acc,
    };
  }

  // =====================================================================
  // LESSON CURRICULUM
  //
  // Each lesson introduces new keys and drills them progressively.
  // Modeled on the original 1987 Mavis Beacon curriculum (home row first,
  // then top row, then bottom row, then numbers/symbols).
  //
  // `keys`  — new keys taught
  // `text`  — drill text (uses only previously + currently introduced keys)
  // `finger` — finger assigned to each new key (for visual highlight)
  // =====================================================================

  const LESSONS = [
    {
      keys: ["j", "f"],
      text: "jjj fff jjj fff jfj fjf jfj fjf jff fjj j f f j jjjj ffff jjj fff",
      instr: "Place left index on F, right index on J. Feel the bumps.",
      goal: "Type with both index fingers.",
    },
    {
      keys: ["k", "d"],
      text: "ddd kkk ddd kkk kdk dkd kdk dkd kdd dkk d k k d dddk kkkd ddd kkk",
      instr: "Add middle fingers on D and K. Stay on the home row.",
      goal: "Four keys on the home row.",
    },
    {
      keys: ["l", "s"],
      text: "sss lll sss lll sls lsl sls lsl sll lss s l l s ss ll sss lll ddd kkk fff jjj",
      instr: "Ring fingers join in. Curve your fingers over the keys.",
      goal: "All home-row letters except A and ;",
    },
    {
      keys: ["a", ";"],
      text: "aaa ;;; aaa ;;; a;a ;a; a;a ;a; aa ;; a ; ; a aa fff jjj ddd kkk sss lll",
      instr: "Pinky keys complete the home row. A is left pinky, ; is right.",
      goal: "Complete home row mastered.",
    },
    {
      keys: ["u", "r"],
      text: "uuu rrr uuu rrr uru rur uru rur uur ruu u r r u fjf juj fjr rjr juj ruj",
      instr: "Top row: R (left index) and U (right index).",
      goal: "Two top-row letters added.",
    },
    {
      keys: ["i", "e"],
      text: "eee iii eee iii eie iei eie iei eei iee e i i e e ded kei ied eki ide",
      instr: "Middle-finger top row: E and I.",
      goal: "Four top-row keys.",
    },
    {
      keys: ["o", "w"],
      text: "ooo www ooo www owo wow owo wow oow woo o w w o wo wo wo wo joe foe woe",
      instr: "Ring-finger top row: W and O.",
      goal: "Six top-row keys.",
    },
    {
      keys: ["p", "q"],
      text: "ppp qqq ppp qqq pqp qpq pqp qpq ppq qpp p q q p pjp pjq pwj qwj pqj",
      instr: "Pinky top row: Q (left) and P (right). Full top row now!",
      goal: "Complete top row mastered.",
    },
    {
      keys: ["t", "y"],
      text: "ttt yyy ttt yyy tyt yty tyt yty tty ytt t y y t ftf yjy fty yft typ try yet",
      instr: "Index top row extended: T (left) and Y (right).",
      goal: "Full top + home rows.",
    },
    {
      keys: ["n", "m"],
      text: "nnn mmm nnn mmm nmn mnm nmn mnm nnm mnn n m m n man men fan fun tan jam mum",
      instr: "Bottom row: N (right index) and M (right index).",
      goal: "Two bottom-row keys added.",
    },
    {
      keys: ["v", "b"],
      text: "vvv bbb vvv bbb vbv bvb vbv bvb vvb bvv v b b v van ban fit bit vat bat",
      instr: "Left index bottom row: V and B.",
      goal: "Full keyboard reachable.",
    },
    {
      keys: ["c", ","],
      text: "ccc ,,, ccc ,,, c,c ,c; c,c ,c; cc ,, c , , c cat car can car, can,cab,cab",
      instr: "Middle (L) and pinky bottom row: C and comma.",
      goal: "Almost complete alphabet.",
    },
    {
      keys: ["x", "."],
      text: "xxx ... xxx ... x.x .x. x.x .x. xx .. x . . x box fox tax six mix max",
      instr: "Ring bottom row: X (left) and period (right).",
      goal: "All letters + comma + period.",
    },
    {
      keys: ["z", "/"],
      text: "zzz /// zzz /// z/z /z/ z/z /z/ zz // z / / z zip zap zoo azoozy/lazy zone",
      instr: "Pinky bottom row: Z and slash. Full keyboard, well done!",
      goal: "Keyboard complete!",
    },
    {
      keys: ["g", "h"],
      text: "ggg hhh ggg hhh ghg hgh ghg hgh ggh hgg g h h g get her hog hug high light",
      instr: "Index home row bumps: G and H.",
      goal: "Full alphabet + punctuation.",
    },
    {
      keys: ["CAPS", "SHIFT"],
      text: "Aa Bb Cc Dd Ee Ff Gg Hh Ii Jj Kk Ll Mm Nn Oo Pp Qq Rr Ss Tt Uu Vv Ww Xx Yy Zz",
      instr: "Practice capitals and SHIFT for symbols. The home row is your anchor.",
      goal: "Shift key drill.",
    },
    {
      keys: ["SPACE"],
      text: "the quick brown fox jumps over the lazy dog",
      instr: "Words and spaces. Thumbs handle the space bar.",
      goal: "Pangram #1 — every letter used.",
    },
    {
      keys: ["PUNCT"],
      text: "Hello, Mavis! How are you today? I'm fine, thanks.",
      instr: "Sentences with commas, periods, apostrophes.",
      goal: "Punctuation practice.",
    },
    {
      keys: ["PARAGRAPH"],
      text: "Mavis teaches typing with patience. Good posture helps you type faster. Keep your fingers on the home row. Look at the screen, not the keyboard.",
      instr: "A short paragraph. Read a few words ahead.",
      goal: "Full paragraph drill.",
    },
    {
      keys: ["DRILL"],
      text: "pack my box with five dozen liquor jugs sphinx of black quartz judge my vow how razorback jumping frogs can level six piqued gymnasts",
      instr: "Multi-pangram warmup. All keys, all fingers.",
      goal: "Final graduation drill.",
    },
  ];

  function isLessonLocked(idx) {
    if (idx === 0) return false;
    return !stats.completedLessons.includes(idx - 1);
  }

  // =====================================================================
  // BOOT / TITLE PHASE
  // =====================================================================

  function enterBoot() {
    ui.phase = "BOOT";
    setSceneVisible("boot");
    setStatus(STATUS.BOOT);
    $("status-left").textContent = "PRESS ENTER";
    if (!ui.booted) {
      // First visit: play boot chime
      setTimeout(() => audio.boot(), 200);
      ui.booted = true;
    }
  }

  function exitBoot() {}

  // =====================================================================
  // MAIN MENU
  // =====================================================================

  function enterMenu() {
    ui.phase = "MENU";
    setSceneVisible("menu");
    setStatus(STATUS.MENU);
    $("status-left").textContent = "READY";
    renderMenuBanner();
  }

  function exitMenu() {}

  function renderMenuBanner() {
    // Streak — show even if 0 so users see the metric and understand it.
    const streak = Math.max(0, stats.streak || 0);
    const banner = $("streak-banner");
    const flame = $("streak-flame");
    const text = $("streak-text");
    if (!banner) return;
    if (streak <= 0) {
      banner.classList.add("zero");
      banner.classList.remove("active");
      flame.textContent = "·";
      text.textContent = "STREAK: — DAYS";
    } else {
      banner.classList.remove("zero");
      if (streak >= 7) banner.classList.add("active");
      else banner.classList.remove("active");
      flame.textContent = flameIcon(streak);
      text.textContent = `STREAK: ${streak} ${streak === 1 ? "DAY" : "DAYS"}`;
    }
    // Daily challenge yesterday — show last day's WPM if any.
    const yKey = yesterdayKey();
    const yesterday = stats.dailyBest && stats.dailyBest[yKey];
    const yEl = $("daily-yesterday-menu");
    if (yEl) {
      const todayBest = stats.dailyBest && stats.dailyBest[todayKey()];
      if (todayBest) {
        yEl.textContent = `TODAY: ${todayBest.wpm} WPM · YESTERDAY: ${yesterday ? yesterday.wpm + " WPM" : "—"}`;
        yEl.classList.add("has-data");
      } else if (yesterday) {
        yEl.textContent = `YESTERDAY: ${yesterday.wpm} WPM`;
        yEl.classList.add("has-data");
      } else {
        yEl.textContent = "";
        yEl.classList.remove("has-data");
      }
    }
  }

  // =====================================================================
  // LESSONS OVERVIEW
  // =====================================================================

  function enterLessons() {
    ui.phase = "LESSONS";
    setSceneVisible("lessons");
    setStatus(STATUS.LESSONS);
    const list = $("lessons-list");
    list.innerHTML = "";
    LESSONS.forEach((l, idx) => {
      const row = document.createElement("div");
      row.className = "lesson-row";
      if (isLessonLocked(idx)) row.classList.add("locked");
      if (idx === ui.selectedLesson) row.classList.add("selected");
      const completed = stats.completedLessons.includes(idx);
      row.innerHTML = `
        <div class="lesson-check">${completed ? "✓" : isLessonLocked(idx) ? "✗" : "▸"}</div>
        <div class="lesson-row-name"><b>Lesson ${idx + 1}:</b> ${l.instr}</div>
        <div class="lesson-row-meta">${completed ? "DONE" : isLessonLocked(idx) ? "LOCKED" : "READY"}</div>
      `;
      row.addEventListener("click", () => {
        if (!isLessonLocked(idx)) startLesson(idx);
      });
      list.appendChild(row);
    });
  }

  function exitLessons() {}

  // =====================================================================
  // LESSON PLAY
  // =====================================================================

  function startLesson(idx) {
    session.lessonIdx = idx;
    session.target = LESSONS[idx].text;
    session.typed = "";
    session.errors = 0;
    session.startTime = 0;
    session.elapsedMs = 0;
    session.completed = false;
    audio.resume();
    enterLesson();
  }

  function enterLesson() {
    ui.phase = "LESSON";
    setSceneVisible("lesson");
    setStatus(STATUS.LESSON);
    const idx = session.lessonIdx;
    $("lesson-num").textContent = `Lesson ${idx + 1} / ${LESSONS.length}`;
    $("lesson-title").textContent = LESSONS[idx].goal;
    $("lesson-instr").textContent = LESSONS[idx].instr;
    renderLessonTarget();
    renderLessonPrompt();
    renderLessonTyped();
    updateLessonStats();
    $("lesson-feedback").textContent = "";
    $("lesson-feedback").className = "lesson-feedback";
  }

  function renderLessonTarget() {
    const idx = session.lessonIdx;
    const next = session.target[session.typed.length] || "";
    $("target-key").textContent = next === " " ? "⎵" : next.toUpperCase() || "—";
    const finger = fingerOf(next, idx);
    $("target-finger").textContent = finger ? `finger: ${finger}` : "";
    // Highlight the right key on the on-screen keyboard
    document.querySelectorAll(".key.target-key").forEach((k) => k.classList.remove("target-key"));
    if (next) {
      const key = next === " " ? " " : next;
      const btn = document.querySelector(`.key[data-key="${cssEscape(key)}"]`);
      if (btn) btn.classList.add("target-key");
    }
  }

  function fingerOf(ch, lessonIdx) {
    if (!ch) return "";
    if (ch === " ") return "thumb";
    const fingerMap = {
      q: "L-Pinky", w: "L-Ring", e: "L-Middle", r: "L-Index", t: "L-Index",
      y: "R-Index", u: "R-Index", i: "R-Middle", o: "R-Ring", p: "R-Pinky",
      a: "L-Pinky", s: "L-Ring", d: "L-Middle", f: "L-Index", g: "L-Index",
      h: "R-Index", j: "R-Index", k: "R-Middle", l: "R-Ring",
      z: "L-Pinky", x: "L-Ring", c: "L-Middle", v: "L-Index", b: "L-Index",
      n: "R-Index", m: "R-Index",
    };
    return fingerMap[ch.toLowerCase()] || "";
  }

  function renderLessonPrompt() {
    const target = session.target;
    const typed = session.typed;
    const html = [];
    for (let i = 0; i < target.length; i++) {
      const ch = target[i];
      const isSpace = ch === " ";
      const cls = ["ch"];
      if (isSpace) cls.push("space");
      if (i < typed.length) cls.push("ok");
      else if (i === typed.length) cls.push("next");
      else cls.push("remaining");
      const display = isSpace ? "⎵" : ch;
      html.push(`<span class="${cls.join(" ")}">${escapeHtml(display)}</span>`);
    }
    $("lesson-prompt").innerHTML = html.join("");
  }

  function renderLessonTyped() {
    const target = session.target;
    const typed = session.typed;
    const html = [];
    for (let i = 0; i < typed.length; i++) {
      const expected = target[i];
      const got = typed[i];
      const isSpace = got === " ";
      const correct = expected === got;
      const cls = ["ch", correct ? "ok" : "bad"];
      if (isSpace) cls.push("space");
      const display = isSpace ? "⎵" : got;
      html.push(`<span class="${cls.join(" ")}">${escapeHtml(display)}</span>`);
    }
    $("lesson-typed").innerHTML = html.join("");
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  // "YYYY-MM-DD" key in local time. We use this for streak & daily tracking
  // so a calendar day boundary is the user's actual midnight, not UTC.
  function todayKey(d = new Date()) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }

  function yesterdayKey(d = new Date()) {
    const y = new Date(d.getFullYear(), d.getMonth(), d.getDate() - 1);
    return todayKey(y);
  }

  function daysBetween(aKey, bKey) {
    if (!aKey || !bKey) return Infinity;
    const a = new Date(aKey + "T00:00:00");
    const b = new Date(bKey + "T00:00:00");
    return Math.round((b - a) / 86_400_000);
  }

  // Tiny string-hash seeded RNG. Deterministic per day so everyone gets the
  // same sentence, but the sentence rotates tomorrow.
  function seededPick(arr, key) {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < key.length; i++) {
      h ^= key.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return arr[h % arr.length];
  }

  // Mark that the user did something today: lesson / test / game counts.
  // First call of the day, or any call after a skipped day, recalculates
  // the streak based on `daysBetween`. Idempotent within the same calendar day.
  function registerActivity() {
    const today = todayKey();
    const last = stats.lastActiveDate || "";
    if (last === today) return; // already counted today
    if (!last) {
      stats.streak = 1;
    } else {
      const gap = daysBetween(last, today);
      if (gap === 1) stats.streak = (stats.streak || 0) + 1;
      else stats.streak = 1; // first time, or streak broken
    }
    stats.lastActiveDate = today;
    save();
  }

  // Render an ASCII flame. The taller the flame, the hotter the streak.
  function flameIcon(streak) {
    if (!streak || streak <= 0) return "·";
    if (streak >= 30) return "🔥";
    if (streak >= 14) return "▲▲";
    if (streak >= 7)  return "▲";
    return "˄";
  }

  function updateLessonStats() {
    const typed = session.typed.length;
    $("stat-wpm").textContent = wpmOf(typed, session.elapsedMs);
    $("stat-acc").textContent = `${accOf(typed, session.errors)}%`;
    $("stat-time").textContent = fmtTime(session.elapsedMs);
    $("stat-err").textContent = session.errors;
    $("stat-prog").textContent = `${typed}/${session.target.length}`;
    $("stat-err").className = "stat-val" + (session.errors > 5 ? " warn" : "");
  }

  function tickLesson() {
    if (!session.startTime || session.completed) return;
    session.elapsedMs = performance.now() - session.startTime;
    updateLessonStats();
  }

  function completeLesson() {
    session.completed = true;
    clearInterval(session.timerHandle);
    const reward = wpmReward(session.typed.length, session.errors, session.elapsedMs);
    const idx = session.lessonIdx;
    registerActivity();
    if (reward.passed && !stats.completedLessons.includes(idx)) {
      stats.completedLessons.push(idx);
      save();
      audio.success();
      $("lesson-feedback").textContent = `Lesson ${idx + 1} complete! WPM ${reward.wpm} · ACC ${reward.acc}%`;
      $("lesson-feedback").className = "lesson-feedback success";
    } else if (!reward.passed) {
      audio.error();
      $("lesson-feedback").textContent = `Keep practicing — try again. (ACC ${reward.acc}% needs to be ≥ 90%)`;
      $("lesson-feedback").className = "lesson-feedback fail";
    } else {
      $("lesson-feedback").textContent = `Already completed. WPM ${reward.wpm} · ACC ${reward.acc}%`;
      $("lesson-feedback").className = "lesson-feedback";
    }
    // Wait a moment, then return to lesson list
    setTimeout(() => {
      if (ui.phase === "LESSON") enterLessons();
    }, 1800);
  }

  function exitLesson() {
    clearInterval(session.timerHandle);
  }

  // =====================================================================
  // PRACTICE
  // =====================================================================

  function enterPractice() {
    ui.phase = "PRACTICE";
    setSceneVisible("practice");
    setStatus(STATUS.PRACTICE);
    session.target = pickRandom(PRACTICE_TEXTS);
    session.typed = "";
    session.errors = 0;
    session.startTime = 0;
    session.elapsedMs = 0;
    session.completed = false;
    renderPracticeText();
    updatePracticeStats();
    $("status-left").textContent = "TYPE TO START";
  }

  function renderPracticeText() {
    const target = session.target;
    const typed = session.typed;
    const html = [];
    for (let i = 0; i < target.length; i++) {
      const expected = target[i];
      const got = typed[i];
      const cls = ["ch"];
      if (got === undefined) cls.push("next");
      else cls.push(got === expected ? "ok" : "bad");
      const ch = got === undefined ? expected : got;
      html.push(`<span class="${cls.join(" ")}">${escapeHtml(ch === " " ? "⎵" : ch)}</span>`);
    }
    $("practice-text").innerHTML = html.join("");
  }

  function updatePracticeStats() {
    const typed = session.typed.length;
    $("prac-wpm").textContent = wpmOf(typed, session.elapsedMs);
    $("prac-acc").textContent = `${accOf(typed, session.errors)}%`;
    $("prac-time").textContent = fmtTime(session.elapsedMs);
    $("prac-err").textContent = session.errors;
  }

  function tickPractice() {
    if (!session.startTime || session.completed) return;
    session.elapsedMs = performance.now() - session.startTime;
    updatePracticeStats();
  }

  function exitPractice() {
    clearInterval(session.timerHandle);
  }

  // =====================================================================
  // TESTS OVERVIEW
  // =====================================================================

  function enterTests() {
    ui.phase = "TESTS";
    setSceneVisible("tests");
    setStatus(STATUS.TESTS);
    const tests = [
      { key: "1min", num: "1", name: "1 Minute Test", desc: "Quick check of your typing speed" },
      { key: "3min", num: "2", name: "3 Minute Test", desc: "Standard timed test, full paragraph" },
      { key: "5min", num: "3", name: "5 Minute Test", desc: "Endurance test, multi-paragraph" },
    ];
    const list = $("test-list");
    list.innerHTML = "";
    tests.forEach((t) => {
      const row = document.createElement("div");
      row.className = "test-row";
      row.innerHTML = `
        <div class="test-row-num">${t.num}</div>
        <div class="test-row-name">${t.name}</div>
        <div class="test-row-desc">${t.desc}</div>
      `;
      row.addEventListener("click", () => startTest(t.key));
      list.appendChild(row);
    });
  }

  function exitTests() {}

  // =====================================================================
  // TEST RUN
  // =====================================================================

  function startTest(kind) {
    session.testKind = kind;
    session.testDurationMs =
      kind === "1min" ? 60_000 :
      kind === "3min" ? 180_000 : 300_000;
    session.testTimeLeftMs = session.testDurationMs;
    session.target = pickRandom(TEST_TEXTS);
    if (kind === "5min") session.target = session.target + "\n\n" + pickRandom(TEST_TEXTS);
    session.typed = "";
    session.errors = 0;
    session.startTime = 0;
    session.elapsedMs = 0;
    session.completed = false;
    session.paused = false;
    audio.resume();
    enterTest();
  }

  function enterTest() {
    ui.phase = "TEST";
    setSceneVisible("test");
    setStatus(STATUS.TEST);
    const labels = { "1min": "1 Minute Test", "3min": "3 Minute Test", "5min": "5 Minute Test" };
    $("test-title").textContent = labels[session.testKind];
    renderTestText();
    updateTestStats();
    $("status-left").textContent = "TYPE TO START";
  }

  function renderTestText() {
    const target = session.target;
    const typed = session.typed;
    const html = [];
    for (let i = 0; i < target.length; i++) {
      const expected = target[i];
      const got = typed[i];
      const cls = ["ch"];
      if (got === undefined) cls.push("next");
      else cls.push(got === expected ? "ok" : "bad");
      const ch = got === undefined ? expected : got;
      // Newlines render as actual newlines for readability
      const display = ch === "\n" ? "↵" : (ch === " " ? "⎵" : ch);
      html.push(`<span class="${cls.join(" ")}">${escapeHtml(display)}</span>`);
      if (ch === "\n") html.push("<br>");
    }
    $("test-prompt").innerHTML = html.join("");
  }

  function updateTestStats() {
    const typed = session.typed.length;
    $("test-wpm").textContent = wpmOf(typed, session.elapsedMs);
    $("test-acc").textContent = `${accOf(typed, session.errors)}%`;
    $("test-err").textContent = session.errors;
    $("test-chars").textContent = typed;
    $("test-err").className = "stat-val" + (session.errors > 10 ? " warn" : "");
  }

  function tickTest() {
    if (!session.startTime || session.completed || session.paused) return;
    session.elapsedMs = performance.now() - session.startTime;
    session.testTimeLeftMs = Math.max(0, session.testDurationMs - session.elapsedMs);
    const timeEl = $("test-time");
    timeEl.textContent = fmtClock(session.testTimeLeftMs);
    if (session.testTimeLeftMs < 10_000) timeEl.classList.add("urgent");
    else timeEl.classList.remove("urgent");
    updateTestStats();
    if (session.testTimeLeftMs <= 0) {
      completeTest(true);
    }
  }

  function completeTest(timedOut) {
    session.completed = true;
    clearInterval(session.timerHandle);
    const typed = session.typed.length;
    const wpm = wpmOf(typed, session.elapsedMs);
    const acc = accOf(typed, session.errors);
    audio.success();
    // Save history
    stats.history.push({
      when: Date.now(),
      kind: session.testKind,
      wpm, acc, errors: session.errors,
      durationSec: Math.round(session.elapsedMs / 1000),
    });
    if (wpm > stats.bestWpm) stats.bestWpm = wpm;
    if (acc > stats.bestAcc) stats.bestAcc = acc;
    registerActivity();
    save();
    ui._lastResult = { wpm, acc, errors: session.errors, kind: session.testKind, timedOut };
    enterResults();
  }

  function exitTest() {
    clearInterval(session.timerHandle);
  }

  // =====================================================================
  // DAILY CHALLENGE — same sentence for everyone, date-seeded
  // =====================================================================
  const DAILY_DURATION_MS = 60_000;

  function pickDailyText() {
    return seededPick(DAILY_TEXTS, todayKey());
  }

  function enterDaily() {
    ui.phase = "DAILY";
    setSceneVisible("daily");
    setStatus(STATUS.DAILY);
    audio.resume();
    session.daily = {
      target: pickDailyText(),
      typed: "",
      errors: 0,
      startTime: 0,
      elapsedMs: 0,
      durationMs: DAILY_DURATION_MS,
      timeLeftMs: DAILY_DURATION_MS,
      completed: false,
      key: todayKey(),
    };
    $("daily-meta").textContent = `SAME SENTENCE FOR EVERYONE TODAY · ${session.daily.key}`;
    renderDailyText();
    updateDailyStats();
    renderDailyBest();
    $("daily-finish").classList.add("hidden");
    $("daily-finish").textContent = "";
    $("status-left").textContent = "TYPE TO START";
  }

  function exitDaily() {
    clearInterval(session.timerHandle);
    session.daily = null;
  }

  function renderDailyText() {
    if (!session.daily) return;
    const target = session.daily.target;
    const typed = session.daily.typed;
    const html = [];
    for (let i = 0; i < target.length; i++) {
      const expected = target[i];
      const got = typed[i];
      const cls = ["ch"];
      if (got === undefined) cls.push("next");
      else cls.push(got === expected ? "ok" : "bad");
      const ch = got === undefined ? expected : got;
      const display = ch === " " ? "⎵" : ch;
      html.push(`<span class="${cls.join(" ")}">${escapeHtml(display)}</span>`);
    }
    $("daily-prompt").innerHTML = html.join("");
  }

  function updateDailyStats() {
    if (!session.daily) return;
    const typed = session.daily.typed.length;
    $("daily-wpm").textContent = wpmOf(typed, session.daily.elapsedMs);
    $("daily-acc").textContent = `${accOf(typed, session.daily.errors)}%`;
    $("daily-err").textContent = session.daily.errors;
    $("daily-chars").textContent = typed;
  }

  function renderDailyBest() {
    if (!session.daily) return;
    const best = stats.dailyBest && stats.dailyBest[session.daily.key];
    const el = $("daily-best");
    if (best) {
      el.textContent = `YOUR BEST TODAY: ${best.wpm} WPM · ${best.acc}% ACC`;
    } else {
      el.textContent = "YOUR BEST TODAY: —";
    }
  }

  function tickDaily() {
    if (!session.daily || !session.daily.startTime || session.daily.completed) return;
    session.daily.elapsedMs = performance.now() - session.daily.startTime;
    session.daily.timeLeftMs = Math.max(0, session.daily.durationMs - session.daily.elapsedMs);
    const tEl = $("daily-timer");
    tEl.textContent = fmtClock(session.daily.timeLeftMs);
    if (session.daily.timeLeftMs < 10_000) tEl.classList.add("urgent");
    else tEl.classList.remove("urgent");
    updateDailyStats();
    if (session.daily.timeLeftMs <= 0) {
      completeDaily(true);
    }
  }

  function completeDaily(timedOut) {
    if (!session.daily) return;
    session.daily.completed = true;
    clearInterval(session.timerHandle);
    const typed = session.daily.typed.length;
    const wpm = wpmOf(typed, session.daily.elapsedMs);
    const acc = accOf(typed, session.daily.errors);
    const key = session.daily.key;
    const prev = stats.dailyBest && stats.dailyBest[key];
    const isNewBest = !prev || wpm > prev.wpm;
    stats.dailyBest = stats.dailyBest || {};
    if (isNewBest) {
      stats.dailyBest[key] = {
        wpm, acc,
        errors: session.daily.errors,
        chars: typed,
        durationSec: Math.round(session.daily.elapsedMs / 1000),
        when: Date.now(),
      };
    }
    stats.history.push({
      when: Date.now(),
      kind: "daily",
      wpm, acc, errors: session.daily.errors,
      durationSec: Math.round(session.daily.elapsedMs / 1000),
    });
    registerActivity();
    if (wpm > stats.bestWpm) stats.bestWpm = wpm;
    if (acc > stats.bestAcc) stats.bestAcc = acc;
    save();
    const fEl = $("daily-finish");
    if (fEl) {
      fEl.classList.remove("hidden");
      fEl.textContent = (timedOut ? "TIME UP — " : "DONE! ") +
        `${wpm} WPM · ${acc}% ACC · ${session.daily.errors} ERR` +
        (isNewBest ? " ★ NEW BEST" : "");
    }
    renderDailyBest();
  }

  function startDailyTimerIfNeeded() {
    if (session.daily.startTime) return;
    session.daily.startTime = performance.now();
    session.timerHandle = setInterval(tickDaily, 100);
  }

  function handleDailyChar(ch) {
    if (!session.daily || session.daily.completed) return false;
    if (ch === "\n") return false;
    if (ch.length !== 1) return false;
    startDailyTimerIfNeeded();
    const i = session.daily.typed.length;
    const expected = session.daily.target[i];
    if (expected === undefined) {
      completeDaily(false);
      return true;
    }
    const ok = ch === expected;
    session.daily.typed += ch;
    flashKey(ch, ok);
    if (!ok) {
      session.daily.errors++;
      stats.keyErrors[expected] = (stats.keyErrors[expected] || 0) + 1;
    }
    renderDailyText();
    updateDailyStats();
    if (session.daily.typed.length >= session.daily.target.length) {
      completeDaily(false);
    }
    return true;
  }

  // =====================================================================
  // RESULTS
  // =====================================================================

  function enterResults() {
    ui.phase = "RESULTS";
    setSceneVisible("results");
    setStatus(STATUS.RESULTS);
    const r = ui._lastResult;
    const g = gradeFor(r.wpm, r.acc);
    $("results-wpm").textContent = r.wpm;
    $("results-acc").textContent = `${r.acc}%`;
    $("results-err").textContent = r.errors;
    $("results-grade").textContent = g.grade;
    $("results-message").textContent = g.msg + (r.timedOut ? " (time ran out)" : "");
  }

  function exitResults() {}

  // =====================================================================
  // REPORTS
  // =====================================================================

  function enterReports() {
    ui.phase = "REPORTS";
    setSceneVisible("reports");
    setStatus(STATUS.REPORTS);
    drawProgressChart();
    renderHistoryTable();
    renderKeyReport();
    renderGoals();
  }

  function drawProgressChart() {
    const canvas = $("progress-canvas");
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const w = canvas.width, h = canvas.height;
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, w, h);
    // Grid
    ctx.strokeStyle = "rgba(0, 255, 255, 0.2)";
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const y = (i / 4) * h;
      ctx.beginPath();
      ctx.moveTo(20, y);
      ctx.lineTo(w - 10, y);
      ctx.stroke();
    }
    // Data
    const history = stats.history.slice(-20);
    if (history.length === 0) {
      ctx.fillStyle = "rgba(0, 255, 255, 0.5)";
      ctx.font = "16px 'Press Start 2P', monospace";
      ctx.textAlign = "center";
      ctx.fillText("NO TESTS YET — TAKE A TEST TO SEE YOUR PROGRESS", w / 2, h / 2);
      return;
    }
    const maxWpm = Math.max(60, ...history.map((r) => r.wpm)) * 1.1;
    const barWidth = (w - 30) / history.length;
    // WPM line
    ctx.strokeStyle = "#00ffff";
    ctx.lineWidth = 2;
    ctx.beginPath();
    history.forEach((r, i) => {
      const x = 20 + i * barWidth + barWidth / 2;
      const y = h - (r.wpm / maxWpm) * (h - 10) - 5;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();
    // Accuracy line
    ctx.strokeStyle = "#ffff00";
    ctx.lineWidth = 2;
    ctx.beginPath();
    history.forEach((r, i) => {
      const x = 20 + i * barWidth + barWidth / 2;
      const y = h - (r.acc / 100) * (h - 10) - 5;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();
    // Axis labels
    ctx.fillStyle = "#808080";
    ctx.font = "8px 'Press Start 2P', monospace";
    ctx.textAlign = "left";
    ctx.fillText(`MAX ${Math.round(maxWpm)} WPM`, 22, 12);
    ctx.fillText("0", 22, h - 4);
  }

  function renderHistoryTable() {
    const tbl = $("history-table");
    const rows = stats.history.slice(-10).reverse();
    let html = `<div class="report-row header"><span>WHEN</span><span>KIND</span><span>WPM</span><span>ACC</span></div>`;
    if (rows.length === 0) {
      html += `<div class="report-row"><span colspan="4" style="text-align:center;color:#808080;">No tests yet</span></div>`;
    } else {
      for (const r of rows) {
        const date = new Date(r.when);
        const dateStr = `${date.getMonth() + 1}/${date.getDate()}`;
        html += `<div class="report-row">
          <span>${dateStr}</span>
          <span>${r.kind}</span>
          <span class="report-wpm ${r.wpm >= 40 ? "good" : ""}">${r.wpm}</span>
          <span class="report-acc ${r.acc < 90 ? "warn" : ""}">${r.acc}%</span>
        </div>`;
      }
    }
    tbl.innerHTML = html;
  }

  function renderKeyReport() {
    const el = $("report-keys");
    const errs = stats.keyErrors;
    const keys = "abcdefghijklmnopqrstuvwxyz".split("");
    const max = Math.max(1, ...Object.values(errs));
    let html = "";
    let any = false;
    for (const k of keys) {
      const n = errs[k] || 0;
      if (n > 0) any = true;
      const pct = (n / max) * 100;
      html += `<div class="report-key" title="${k.toUpperCase()}: ${n} errors">
        <b>${k.toUpperCase()}</b>
        <div class="report-key-bar"><i style="width:${pct}%"></i></div>
        <span style="font-size:8px;color:#808080">${n}</span>
      </div>`;
    }
    if (!any) html = `<div class="report-keys-empty">No errors tracked yet — start typing!</div>`;
    el.innerHTML = html;
  }

  function renderGoals() {
    const el = $("report-goals");
    const lessonsDone = stats.completedLessons.length;
    const totalLessons = LESSONS.length;
    const bestWpm = stats.bestWpm;
    const bestAcc = stats.bestAcc;

    const lessonsPct = Math.round((lessonsDone / totalLessons) * 100);
    const wpmPct = Math.min(100, Math.round((bestWpm / settings.goalWpm) * 100));
    const accPct = Math.min(100, Math.round((bestAcc / settings.goalAccuracy) * 100));

    el.innerHTML = `
      <div class="report-goal">
        <div class="report-goal-label">Lessons ${lessonsDone}/${totalLessons}</div>
        <div class="report-goal-bar${lessonsDone >= totalLessons ? " done" : ""}"><i style="width:${lessonsPct}%"></i></div>
      </div>
      <div class="report-goal">
        <div class="report-goal-label">Best WPM ${bestWpm}/${settings.goalWpm}</div>
        <div class="report-goal-bar${bestWpm >= settings.goalWpm ? " done" : ""}"><i style="width:${wpmPct}%"></i></div>
      </div>
      <div class="report-goal">
        <div class="report-goal-label">Best Accuracy ${bestAcc}%/${settings.goalAccuracy}%</div>
        <div class="report-goal-bar${bestAcc >= settings.goalAccuracy ? " done" : ""}"><i style="width:${accPct}%"></i></div>
      </div>
      <div class="report-goal-val" style="margin-top:8px;">
        ${lessonsDone >= totalLessons && bestWpm >= settings.goalWpm && bestAcc >= settings.goalAccuracy
          ? "★ All goals achieved!"
          : "Keep going!"}
      </div>
    `;
  }

  function exitReports() {}

  // =====================================================================
  // GAME — Key-Board Hero (falling letters)
  //
  // Mechanics:
  //   - Combo: kills within COMBO_TIMEOUT_MS (1.5s) bump a 1→2→3→…→8 tier.
  //            Score per kill = base_points × tier. Tier 2, 3, 5, 8 trigger
  //            a screen flash + shake.
  //   - Waves: spawn interval accelerates from 1100ms to 700ms over the
  //            60s round, in 10 waves.
  //   - Boss: every 10th wave a single huge red letter spawns. Hitting it
  //            is worth 5× base × combo; missing costs 2 lives.
  //   - Power-ups: 5% of killed letters drop a "SLOW", "BOMB", or "2X"
  //            letter. Typing it activates the effect.
  // =====================================================================

  function enterGame() {
    ui.phase = "GAME";
    setSceneVisible("game");
    setStatus(STATUS.GAME);
    const now = performance.now();
    // Cancel any prior RAF loop before replacing session.game
    if (session.game && session.game._raf) {
      cancelAnimationFrame(session.game._raf);
    }
    session.game = {
      letters: [],
      powerups: [],          // active power-up letters the player must type
      effects: {             // active global effects
        slowUntil: 0,        // timestamp
        x2Until: 0,          // timestamp
      },
      score: 0,
      lives: 3,
      lastSpawn: now,
      lastFrame: now,
      startTime: now,
      endAt: now + GAME_DURATION_MS,
      running: true,
      nextLetterId: 0,
      combo: 1,              // current combo tier (1..COMBO_MAX)
      lastKillAt: 0,         // performance.now() of most recent kill
      wave: 1,               // 1..10
      waveStartAt: now,      // start time of the current wave
      waveSpawned: 0,
      _raf: 0,               // requestAnimationFrame handle
    };
    $("game-overlay").classList.add("hidden");
    $("game-score").textContent = "0";
    $("game-lives").textContent = "♥♥♥";
    $("game-time").textContent = "60";
    $("game-wave").textContent = "1";
    const cEl = $("game-combo"); cEl.textContent = "x1"; cEl.classList.remove("active","max");
    const pEl = $("game-powerup"); pEl.classList.add("hidden"); pEl.textContent = "";
    const bEl = $("wave-banner"); bEl.classList.remove("show","boss");
    document.querySelector(".screen")?.classList.remove("screen-shake");
    showWaveBanner(1, /*boss*/ false);
    gameLoop();
  }

  function exitGame() {
    if (session.game && session.game._raf) {
      cancelAnimationFrame(session.game._raf);
    }
    session.game = null;
    document.querySelector(".screen")?.classList.remove("screen-shake");
    const pEl = $("game-powerup"); if (pEl) pEl.classList.add("hidden");
    const bEl = $("wave-banner"); if (bEl) bEl.classList.remove("show","boss");
  }

  // The spawn interval eases from start to end as the round progresses.
  function currentSpawnInterval(g, now) {
    const elapsed = Math.min(1, Math.max(0, (now - g.startTime) / GAME_DURATION_MS));
    return GAME_FALL_INTERVAL_START +
      (GAME_FALL_INTERVAL_END - GAME_FALL_INTERVAL_START) * elapsed;
  }

  function spawnLetter(g, now) {
    const ch = GAME_LETTERS[Math.floor(Math.random() * GAME_LETTERS.length)];
    g.letters.push({
      id: ++g.nextLetterId,
      ch,
      x: 30 + Math.random() * 600,
      y: 0,
      boss: false,
    });
  }

  // Boss letters are spawned mid-wave: 1 huge red letter per 10th wave
  function spawnBoss(g) {
    const ch = GAME_LETTERS[Math.floor(Math.random() * GAME_LETTERS.length)];
    g.letters.push({
      id: ++g.nextLetterId,
      ch,
      x: 30 + Math.random() * 600,
      y: 0,
      boss: true,
    });
  }

  function spawnPowerup(g) {
    // Pick one of three types with roughly equal odds
    const types = Object.keys(POWERUP_TYPES); // S, B, X
    const ch = types[Math.floor(Math.random() * types.length)];
    g.powerups.push({
      id: ++g.nextLetterId,
      ch,
      x: 30 + Math.random() * 600,
      y: 0,
      type: POWERUP_TYPES[ch],
      bob: 0,
    });
  }

  function gameFrame(now) {
    const g = session.game;
    if (!g || !g.running) return;
    const dt = now - g.lastFrame;
    g.lastFrame = now;

    // Combo timeout: reset combo if no kill happened recently
    if (g.combo > 1 && now - g.lastKillAt > COMBO_TIMEOUT_MS) {
      g.combo = 1;
      updateGameHUD();
    }
    // Check for power-up expiry
    if (g.effects.slowUntil && now > g.effects.slowUntil) g.effects.slowUntil = 0;
    if (g.effects.x2Until && now > g.effects.x2Until) g.effects.x2Until = 0;

    const slowActive = g.effects.slowUntil > now;
    const speedMult = slowActive ? 0.5 : 1;
    updatePowerupHUD(g, now);

    // Wave management
    const waveElapsed = now - g.waveStartAt;
    if (waveElapsed > GAME_WAVE_DURATION_MS && g.wave < 10) {
      const next = g.wave + 1;
      const bossNext = (next % GAME_BOSS_EVERY_WAVES === 0);
      g.wave = next;
      g.waveStartAt = now;
      g.waveSpawned = 0;
      showWaveBanner(next, bossNext);
      if (bossNext) {
        // Spawn boss letter right at the start of its wave
        spawnBoss(g);
      }
      updateGameHUD();
    }

    // Spawn cadence
    if (now - g.lastSpawn > currentSpawnInterval(g, now)) {
      spawnLetter(g, now);
      g.waveSpawned++;
      g.lastSpawn = now;
    }

    // Move letters (apply slow multiplier)
    for (const L of g.letters) {
      L.y += GAME_LETTER_SPEED * speedMult * dt;
    }
    for (const P of g.powerups) {
      P.y += GAME_LETTER_SPEED * 0.7 * speedMult * dt;
      P.bob = (P.bob || 0) + dt;
    }

    // Letters past the bottom: lose a life (boss = 2 lives)
    let touchGround = false;
    let bottomLives = 0;
    const remaining = [];
    for (const L of g.letters) {
      if (L.y > 260) {
        bottomLives += L.boss ? 2 : 1;
        touchGround = true;
      } else {
        remaining.push(L);
      }
    }
    g.letters = remaining;
    const remainingPower = [];
    for (const P of g.powerups) {
      if (P.y > 260) {
        // missed power-up is harmless
      } else {
        remainingPower.push(P);
      }
    }
    g.powerups = remainingPower;

    if (touchGround) {
      g.lives = Math.max(0, g.lives - bottomLives);
      audio.bad();
      // Wave resets naturally on time; boss impact may also reset combo
      updateGameHUD();
    }

    // Timer
    const left = Math.max(0, g.endAt - now);
    $("game-time").textContent = Math.ceil(left / 1000);
    if (left <= 0 || g.lives <= 0) {
      endGame();
      return;
    }

    drawGame();
    g._raf = requestAnimationFrame(gameFrame);
  }

  function gameLoop() {
    if (!session.game) return;
    session.game.lastFrame = performance.now();
    session.game._raf = requestAnimationFrame(gameFrame);
  }

  function drawGame() {
    const g = session.game;
    const cnv = $("game-canvas");
    const ctx = cnv.getContext("2d");
    const w = cnv.width, h = cnv.height;
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, w, h);

    // Ground line
    ctx.strokeStyle = "#ff00ff";
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(0, 260);
    ctx.lineTo(w, 260);
    ctx.stroke();
    ctx.setLineDash([]);

    const gNow = performance.now();
    const slowActive = g.effects.slowUntil > gNow;
    const x2Active = g.effects.x2Until > gNow;

    // Falling letters
    ctx.textAlign = "center";
    for (const L of g.letters) {
      if (L.boss) {
        ctx.font = `bold ${GAME_BOSS_FONT}px 'Press Start 2P', monospace`;
        ctx.fillStyle = GAME_BOSS_COLOR;
        ctx.fillText(L.ch.toUpperCase(), L.x, L.y + 18);
        // little tag
        ctx.font = "bold 9px 'Press Start 2P', monospace";
        ctx.fillStyle = "#ffffff";
        ctx.fillText("BOSS", L.x, L.y - 30);
      } else {
        ctx.font = "bold 28px 'Press Start 2P', monospace";
        ctx.fillStyle = slowActive ? "#00ffff" : "#ffff00";
        ctx.fillRect(L.x - 14, L.y - 2, 28, 2);
        ctx.fillText(L.ch.toUpperCase(), L.x, L.y + 10);
      }
    }

    // Power-up floating letters
    for (const P of g.powerups) {
      const bob = Math.sin((P.bob || 0) * 0.005) * 2;
      const colors = { S: "#ff80ff", B: "#ff8000", X: "#80ff80" };
      ctx.font = "bold 22px 'Press Start 2P', monospace";
      ctx.fillStyle = "#ffffff";
      ctx.fillText("•", P.x, P.y - 12 + bob);
      ctx.fillStyle = colors[P.ch] || "#ffff00";
      ctx.fillText(P.ch.toUpperCase(), P.x, P.y + 8 + bob);
    }
  }

  function updateGameHUD() {
    const g = session.game;
    if (!g) return;
    $("game-score").textContent = g.score;
    $("game-lives").textContent = "♥".repeat(Math.max(0, g.lives)) || "—";
    $("game-wave").textContent = String(g.wave);
    const cEl = $("game-combo");
    cEl.textContent = g.combo >= COMBO_MAX ? `x${g.combo} COMBO!` : `x${g.combo}`;
    cEl.classList.toggle("active", g.combo >= 2);
    cEl.classList.toggle("max", g.combo >= COMBO_MAX);
  }

  function updatePowerupHUD(g, now) {
    const pEl = $("game-powerup");
    const slowLeft = Math.max(0, g.effects.slowUntil - now);
    const x2Left   = Math.max(0, g.effects.x2Until - now);
    if (slowLeft > 0) {
      pEl.textContent = `SLOW ACTIVE ${Math.ceil(slowLeft / 1000)}s`;
      pEl.classList.remove("hidden");
    } else if (x2Left > 0) {
      pEl.textContent = `2X ACTIVE ${Math.ceil(x2Left / 1000)}s`;
      pEl.classList.remove("hidden");
    } else if (g.powerups.length > 0) {
      const next = g.powerups[0];
      pEl.textContent = `${next.type.label} READY`;
      pEl.classList.remove("hidden");
    } else {
      pEl.classList.add("hidden");
      pEl.textContent = "";
    }
  }

  function showWaveBanner(n, boss) {
    const el = $("wave-banner");
    if (!el) return;
    el.textContent = boss ? `BOSS WAVE ${n}` : `WAVE ${n}`;
    el.classList.toggle("boss", !!boss);
    el.classList.remove("show");
    // force reflow to restart animation
    void el.offsetWidth;
    el.classList.add("show");
    setTimeout(() => el.classList.remove("show"), 1500);
  }

  function flashComboTier() {
    const screen = document.querySelector(".screen");
    if (screen) {
      screen.classList.remove("screen-shake");
      void screen.offsetWidth;
      screen.classList.add("screen-shake");
    }
    const f = $("combo-flash");
    if (!f) return;
    f.classList.remove("show");
    void f.offsetWidth;
    f.classList.add("show");
  }

  function hitLetter(ch) {
    const g = session.game;
    if (!g || !g.running) return;
    const lower = ch.toLowerCase();

    // Power-up activation takes priority (you type "S"/"B"/"X" to use them)
    const puIdx = g.powerups.findIndex((P) => {
      const pc = (P.ch || "").toLowerCase();
      return pc === lower;
    });
    if (puIdx >= 0) {
      const P = g.powerups[puIdx];
      g.powerups.splice(puIdx, 1);
      activatePowerup(g, P);
      updateGameHUD();
      return;
    }

    // Otherwise: hit the lowest matching letter (closest to bottom)
    let target = null;
    for (const L of g.letters) {
      if (L.ch === lower || L.ch === ch) {
        if (!target || L.y > target.y) target = L;
      }
    }
    if (!target) {
      audio.click();
      return;
    }
    g.letters = g.letters.filter((L) => L !== target);
    awardKill(g, target);
    updateGameHUD();
  }

  function awardKill(g, L) {
    const now = performance.now();
    // Combo update
    if (now - g.lastKillAt <= COMBO_TIMEOUT_MS && g.combo < COMBO_MAX) {
      g.combo++;
    } else if (now - g.lastKillAt > COMBO_TIMEOUT_MS) {
      g.combo = 1;
    }
    g.lastKillAt = now;

    const basePoints = L.boss ? GAME_BOSS_VALUE_MULT : Math.max(1, Math.round((L.y / 260) * 5));
    let points = basePoints * g.combo;
    if (g.effects.x2Until > now) points *= 2;
    g.score += points;

    audio.good();
    if (COMBO_TIER_FLASH.has(g.combo)) {
      audio.combo(g.combo);
      flashComboTier();
    }
    if (L.boss) audio.boss();

    // Power-up drop — 5% chance
    if (Math.random() < POWERUP_DROP_CHANCE) {
      spawnPowerup(g);
    }
  }

  function activatePowerup(g, P) {
    const now = performance.now();
    const def = P.type;
    if (def.id === "slow") {
      g.effects.slowUntil = now + def.durationMs;
      audio.powerup();
    } else if (def.id === "bomb") {
      // Award 30 bonus per cleared letter
      const cleared = g.letters.length + g.powerups.length;
      g.score += cleared * 30;
      g.letters = [];
      g.powerups = [];
      audio.bomb();
      audio.powerup();
      flashComboTier();
    } else if (def.id === "x2") {
      g.effects.x2Until = now + def.durationMs;
      audio.powerup();
    }
  }

  function endGame() {
    const g = session.game;
    if (!g) return;
    g.running = false;
    audio.success();
    $("game-overlay").classList.remove("hidden");
    $("game-overlay-title").textContent = g.lives <= 0 ? "Game Over!" : "Time Up!";
    $("game-overlay-score").textContent = g.score;
    stats.history.push({
      when: Date.now(),
      kind: "game",
      wpm: 0,
      acc: 0,
      errors: 0,
      durationSec: Math.round((Date.now() - (g.endAt - GAME_DURATION_MS)) / 1000),
      score: g.score,
    });
    registerActivity();
    save();
  }

  function resumeGame() {
    const g = session.game;
    if (!g) return;
    $("game-overlay").classList.add("hidden");
    g.running = true;
    g.lastFrame = performance.now();
    g.lastSpawn = g.lastFrame;
    g.endAt = g.lastFrame + GAME_DURATION_MS;
    g._raf = requestAnimationFrame(gameFrame);
  }

  // =====================================================================
  // OPTIONS
  // =====================================================================

  function enterOptions() {
    ui.phase = "OPTIONS";
    setSceneVisible("options");
    setStatus(STATUS.OPTIONS);
    renderOptions();
  }

  function renderOptions() {
    const el = $("options-list");
    const palettes = ["ega-teal", "ega-amber", "ega-green", "hot-pink"];
    const palLabel = {
      "ega-teal": "EGA TEAL",
      "ega-amber": "AMBER CRT",
      "ega-green": "GREEN CRT",
      "hot-pink": "HOT PINK",
    };
    const items = [
      { key: "sound", label: "Sound Effects", value: settings.sound ? "ON" : "OFF" },
      { key: "palette", label: "Color Palette", value: palLabel[settings.palette] },
      { key: "goalWpm", label: "WPM Goal", value: String(settings.goalWpm) },
      { key: "goalAccuracy", label: "Accuracy Goal", value: `${settings.goalAccuracy}%` },
      { key: "reset", label: "Reset All Stats", value: "→" },
      { key: "cert", label: "View Certificate", value: "→" },
    ];
    el.innerHTML = "";
    items.forEach((it, idx) => {
      const row = document.createElement("div");
      row.className = "option-row";
      if (idx === ui.selectedOption) row.classList.add("selected");
      row.innerHTML = `<span class="option-label">${it.label}</span><span class="option-value">${it.value}</span>`;
      row.addEventListener("click", () => handleOptionClick(it.key));
      el.appendChild(row);
    });
  }

  function handleOptionClick(key) {
    audio.click();
    if (key === "sound") {
      settings.sound = !settings.sound;
      save();
      renderOptions();
    } else if (key === "palette") {
      const palettes = ["ega-teal", "ega-amber", "ega-green", "hot-pink"];
      const i = palettes.indexOf(settings.palette);
      settings.palette = palettes[(i + 1) % palettes.length];
      document.body.dataset.palette = settings.palette;
      save();
      renderOptions();
    } else if (key === "goalWpm") {
      settings.goalWpm = settings.goalWpm >= 80 ? 20 : settings.goalWpm + 10;
      save();
      renderOptions();
    } else if (key === "goalAccuracy") {
      settings.goalAccuracy = settings.goalAccuracy >= 99 ? 80 : settings.goalAccuracy + 5;
      save();
      renderOptions();
    } else if (key === "reset") {
      if (confirm("Reset all stats? This cannot be undone.")) resetStats();
      renderOptions();
    } else if (key === "cert") {
      enterCert();
    }
  }

  function exitOptions() {}

  // =====================================================================
  // CERTIFICATE
  // =====================================================================

  function enterCert() {
    ui.phase = "CERT";
    setSceneVisible("cert");
    setStatus(STATUS.CERT);
    const lessonsDone = stats.completedLessons.length;
    const detail = `${lessonsDone}/${LESSONS.length} lessons · best ${stats.bestWpm} WPM · ${stats.bestAcc}% accuracy`;
    $("cert-detail").textContent = detail;
  }

  function exitCert() {}

  // =====================================================================
  // INPUT HANDLING — keyboard
  // =====================================================================

  function pickRandom(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  function setSceneVisible(name) {
    document.querySelectorAll(".scene").forEach((s) => s.classList.add("hidden"));
    const target = document.querySelector(`.scene-${name}`);
    if (target) target.classList.remove("hidden");
  }

  function setStatus(text) {
    $("status-left").textContent = text;
  }

  function startTimerIfNeeded() {
    if (session.startTime) return;
    session.startTime = performance.now();
    session.timerHandle = setInterval(() => {
      if (ui.phase === "LESSON") tickLesson();
      else if (ui.phase === "PRACTICE") tickPractice();
      else if (ui.phase === "TEST") tickTest();
    }, 100);
  }

  function handleTypingKey(ch) {
    // Universal character-by-character input handler for lesson/practice/test/daily.
    audio.resume();
    if (ui.phase === "LESSON") return handleLessonChar(ch);
    if (ui.phase === "PRACTICE") return handlePracticeChar(ch);
    if (ui.phase === "TEST") return handleTestChar(ch);
    if (ui.phase === "DAILY") return handleDailyChar(ch);
    if (ui.phase === "GAME") return hitLetter(ch);
    return false;
  }

  function handleLessonChar(ch) {
    if (session.completed) return false;
    // Ignore SHIFT alone; let browser handle.
    if (ch.length !== 1) return false;
    startTimerIfNeeded();
    const i = session.typed.length;
    const expected = session.target[i];
    if (expected === undefined) return false; // already finished
    const ok = ch === expected;
    session.typed += ch;
    flashKey(ch, ok);
    if (!ok) {
      session.errors++;
      stats.keyErrors[expected] = (stats.keyErrors[expected] || 0) + 1;
      audio.bad();
    } else {
      audio.click();
    }
    renderLessonPrompt();
    renderLessonTyped();
    updateLessonStats();
    renderLessonTarget();
    if (session.typed.length >= session.target.length) {
      completeLesson();
    }
    return true;
  }

  function handlePracticeChar(ch) {
    if (session.completed) return false;
    if (ch.length !== 1 && ch !== "\n") return false;
    // Allow newlines? Practice texts don't have them, so skip.
    if (ch === "\n") return false;
    startTimerIfNeeded();
    const i = session.typed.length;
    const expected = session.target[i];
    if (expected === undefined) {
      // Allow user to keep typing past the end? Just ignore.
      return false;
    }
    const ok = ch === expected;
    session.typed += ch;
    flashKey(ch, ok);
    if (!ok) {
      session.errors++;
      audio.bad();
    } else {
      audio.click();
    }
    renderPracticeText();
    updatePracticeStats();
    return true;
  }

  function handleTestChar(ch) {
    if (session.completed) return false;
    if (ch.length !== 1 && ch !== "\n") return false;
    startTimerIfNeeded();
    const i = session.typed.length;
    const expected = session.target[i];
    if (expected === undefined) {
      // Past the end — finish early
      completeTest(false);
      return true;
    }
    const ok = ch === expected;
    session.typed += ch;
    flashKey(ch, ok);
    if (!ok) {
      session.errors++;
      stats.keyErrors[expected] = (stats.keyErrors[expected] || 0) + 1;
      audio.bad();
    } else {
      audio.click();
    }
    renderTestText();
    updateTestStats();
    return true;
  }

  // =====================================================================
  // GLOBAL KEY HANDLER
  // =====================================================================

  document.addEventListener("keydown", (e) => {
    // Global: F10 returns to menu
    if (e.key === "F10") { e.preventDefault(); returnToMenu(); return; }

    // Phase-specific shortcut keys
    if (ui.phase === "BOOT" && (e.key === "Enter" || e.key === " ")) {
      e.preventDefault();
      audio.click();
      enterMenu();
      return;
    }

    if (ui.phase === "MENU") {
      if (e.key === "Escape") return;
      if (e.key >= "1" && e.key <= "7") {
        e.preventDefault();
        audio.click();
        const actions = ["lessons", "practice", "tests", "daily", "reports", "game", "options"];
        const idx = parseInt(e.key, 10) - 1;
        handleMenuAction(actions[idx]);
        return;
      }
    }

    if (ui.phase === "LESSONS") {
      if (e.key === "Escape") { e.preventDefault(); enterMenu(); return; }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        ui.selectedLesson = Math.min(LESSONS.length - 1, ui.selectedLesson + 1);
        enterLessons();
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        ui.selectedLesson = Math.max(0, ui.selectedLesson - 1);
        enterLessons();
        return;
      }
      if (e.key === "Enter") {
        e.preventDefault();
        if (!isLessonLocked(ui.selectedLesson)) startLesson(ui.selectedLesson);
        return;
      }
    }

    if (ui.phase === "LESSON") {
      if (e.key === "Escape") { e.preventDefault(); enterLessons(); return; }
      if (e.key === "Tab") { e.preventDefault(); return; }
      // Block most keys except printable chars + Backspace
      if (e.key === "Backspace") {
        e.preventDefault();
        if (session.typed.length > 0 && !session.completed) {
          session.typed = session.typed.slice(0, -1);
          renderLessonPrompt();
          renderLessonTyped();
          updateLessonStats();
          renderLessonTarget();
        }
        return;
      }
      if (handleTypingKey(e.key)) { e.preventDefault(); }
      return;
    }

    if (ui.phase === "PRACTICE") {
      if (e.key === "Escape") { e.preventDefault(); enterMenu(); return; }
      if (e.key === "Backspace") {
        e.preventDefault();
        if (session.typed.length > 0) {
          session.typed = session.typed.slice(0, -1);
          renderPracticeText();
          updatePracticeStats();
        }
        return;
      }
      if (handleTypingKey(e.key)) { e.preventDefault(); }
      return;
    }

    if (ui.phase === "TESTS") {
      if (e.key === "Escape") { e.preventDefault(); enterMenu(); return; }
      if (e.key >= "1" && e.key <= "3") {
        e.preventDefault();
        const kinds = ["1min", "3min", "5min"];
        startTest(kinds[parseInt(e.key, 10) - 1]);
        return;
      }
    }

    if (ui.phase === "TEST") {
      if (e.key === "Escape") { e.preventDefault(); completeTest(false); return; }
      if (e.key === "Backspace") {
        e.preventDefault();
        if (session.typed.length > 0 && !session.completed) {
          session.typed = session.typed.slice(0, -1);
          renderTestText();
          updateTestStats();
        }
        return;
      }
      if (handleTypingKey(e.key)) { e.preventDefault(); }
      return;
    }

    if (ui.phase === "RESULTS") {
      if (e.key === "Escape") { e.preventDefault(); enterMenu(); return; }
      if (e.key === "Enter") { e.preventDefault(); enterTests(); return; }
      if (e.key === "r" || e.key === "R") { e.preventDefault(); startTest(session.testKind); return; }
      return;
    }

    if (ui.phase === "DAILY") {
      if (e.key === "Escape") { e.preventDefault(); enterMenu(); return; }
      if (e.key === "Enter" && session.daily && session.daily.completed) {
        e.preventDefault();
        enterDaily();
        return;
      }
      if (e.key === "Backspace") {
        e.preventDefault();
        if (session.daily && session.daily.typed.length > 0 && !session.daily.completed) {
          session.daily.typed = session.daily.typed.slice(0, -1);
          renderDailyText();
          updateDailyStats();
        }
        return;
      }
      if (handleTypingKey(e.key)) { e.preventDefault(); }
      return;
    }

    if (ui.phase === "REPORTS") {
      if (e.key === "Escape") { e.preventDefault(); enterMenu(); return; }
      if (e.key === "r" || e.key === "R") {
        e.preventDefault();
        if (confirm("Reset all stats? This cannot be undone.")) resetStats();
        enterReports();
        return;
      }
      return;
    }

    if (ui.phase === "GAME") {
      if (e.key === "Escape") { e.preventDefault(); enterMenu(); return; }
      if (e.key === "p" || e.key === "P") {
        e.preventDefault();
        if (session.game && session.game.running) {
          session.game.running = false;
          $("game-overlay").classList.remove("hidden");
          $("game-overlay-title").textContent = "Paused";
          $("game-overlay-score").textContent = session.game.score;
        } else if (session.game) {
          resumeGame();
        }
        return;
      }
      if (e.key === "Enter" && session.game && !session.game.running) {
        e.preventDefault();
        if (session.game.lives <= 0 || session.game.endAt <= performance.now()) {
          // Restart
          enterGame();
        } else {
          resumeGame();
        }
        return;
      }
      if (e.key.length === 1) {
        e.preventDefault();
        handleTypingKey(e.key);
      }
      return;
    }

    if (ui.phase === "OPTIONS") {
      if (e.key === "Escape") { e.preventDefault(); enterMenu(); return; }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        ui.selectedOption = Math.min(5, ui.selectedOption + 1);
        renderOptions();
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        ui.selectedOption = Math.max(0, ui.selectedOption - 1);
        renderOptions();
        return;
      }
      if (e.key === "Enter") {
        e.preventDefault();
        const keys = ["sound", "palette", "goalWpm", "goalAccuracy", "reset", "cert"];
        handleOptionClick(keys[ui.selectedOption]);
        return;
      }
      return;
    }

    if (ui.phase === "CERT") {
      if (e.key === "Escape" || e.key === "Enter") { e.preventDefault(); enterMenu(); return; }
    }
  });

  function handleMenuAction(action) {
    switch (action) {
      case "lessons": enterLessons(); break;
      case "practice": enterPractice(); break;
      case "tests": enterTests(); break;
      case "daily": enterDaily(); break;
      case "reports": enterReports(); break;
      case "game": enterGame(); break;
      case "options": enterOptions(); break;
    }
  }

  function returnToMenu() {
    audio.click();
    enterMenu();
  }

  // =====================================================================
  // KEYBOARD UI — click any key to "press" it visually (no input)
  // =====================================================================

  document.querySelectorAll(".key").forEach((btn) => {
    btn.addEventListener("mousedown", () => {
      btn.classList.add("active");
    });
    btn.addEventListener("mouseup", () => {
      btn.classList.remove("active");
    });
    btn.addEventListener("mouseleave", () => {
      btn.classList.remove("active");
    });
    btn.addEventListener("click", () => {
      audio.resume();
      const k = btn.dataset.key;
      // Generate a synthetic keydown event for this key
      let key = k;
      if (k === "Backspace") key = "Backspace";
      else if (k === "Tab") key = "Tab";
      else if (k === "Enter") key = "Enter";
      else if (k === "Shift") key = "Shift";
      else if (k === "CapsLock") key = "CapsLock";
      else if (k === "Control") key = "Control";
      else if (k === "Alt") key = "Alt";
      else if (k === "Meta") key = "Meta";
      // For printable keys, dispatch a synthetic keydown
      if (k.length === 1 || k === "Backspace") {
        // Use document.dispatchEvent with synthetic KeyboardEvent
        const evt = new KeyboardEvent("keydown", { key, bubbles: true });
        document.dispatchEvent(evt);
      }
    });
  });

  // =====================================================================
  // MENU BUTTON CLICKS + RESULTS BUTTON CLICKS
  // =====================================================================

  document.querySelectorAll(".menu-item").forEach((btn) => {
    btn.addEventListener("click", () => {
      audio.resume();
      handleMenuAction(btn.dataset.action);
    });
  });

  document.querySelectorAll(".results-actions .retro-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      audio.click();
      const a = btn.dataset.action;
      if (a === "results-retry") startTest(session.testKind);
      else if (a === "results-tests") enterTests();
      else if (a === "results-menu") enterMenu();
    });
  });

  document.querySelectorAll(".cert-actions .retro-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      audio.click();
      enterMenu();
    });
  });

  document.querySelectorAll(".game-overlay .retro-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      audio.click();
      if (btn.dataset.action === "game-retry") enterGame();
      else if (btn.dataset.action === "game-menu") enterMenu();
    });
  });

  // =====================================================================
  // MODERN HUD — sound toggle, palette toggle, reset stats
  // =====================================================================

  $("mute-toggle").addEventListener("click", () => {
    settings.sound = !settings.sound;
    $("mute-toggle").textContent = settings.sound ? "SOUND: ON" : "SOUND: OFF";
    save();
  });

  $("palette-toggle").addEventListener("click", () => {
    const palettes = ["ega-teal", "ega-amber", "ega-green", "hot-pink"];
    const labels = ["EGA TEAL", "AMBER", "GREEN", "HOT PINK"];
    const i = palettes.indexOf(settings.palette);
    settings.palette = palettes[(i + 1) % palettes.length];
    document.body.dataset.palette = settings.palette;
    $("palette-toggle").textContent = `PALETTE: ${labels[(i + 1) % palettes.length]}`;
    save();
  });

  $("reset-stats").addEventListener("click", () => {
    if (confirm("Reset all stats? This cannot be undone.")) {
      resetStats();
      if (ui.phase === "REPORTS") enterReports();
    }
  });

  // =====================================================================
  // INIT
  // =====================================================================

  function init() {
    // Load saved state
    const snap = load();
    if (snap) {
      Object.assign(settings, snap.settings || {});
      Object.assign(stats, snap.stats || {});
      // Re-hydrate arrays
      if (Array.isArray(snap.stats?.completedLessons)) stats.completedLessons = snap.stats.completedLessons;
      if (Array.isArray(snap.stats?.history)) stats.history = snap.stats.history;
      if (snap.stats?.keyErrors) stats.keyErrors = snap.stats.keyErrors;
    }
    document.body.dataset.palette = settings.palette;
    $("mute-toggle").textContent = settings.sound ? "SOUND: ON" : "SOUND: OFF";
    const palLabels = { "ega-teal": "EGA TEAL", "ega-amber": "AMBER", "ega-green": "GREEN", "hot-pink": "HOT PINK" };
    $("palette-toggle").textContent = `PALETTE: ${palLabels[settings.palette] || "EGA"}`;
    enterBoot();
  }

  // Boot when DOM ready (script has defer)
  init();

})();