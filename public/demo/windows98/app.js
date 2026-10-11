/* =============================================================
   Windows 98 Setup Challenge
   A small browser game that walks you through a (simulated)
   Windows 98 install. Do all the right things, and you get
   to the file copy. Mess up too many times and your PC
   reboots — from the start.
   ============================================================= */

/* ---------- State ---------- */
function resetTransientTimers() {
  if (cdKeyInterval) { clearInterval(cdKeyInterval); cdKeyInterval = null; }
  clearScandiskTimers();
}

const STATE = {
  phase: 'start',
  errors: 0,
  restarts: 0,
  startedAt: null,
  pausedStart: null,
  pausedAcc: 0,
  muted: false,
  typingHistory: []
};

const MAX_ERRORS = 3;
const TOTAL_PHASES = 7;

const $ = (s, root = document) => root.querySelector(s);
const $$ = (s, root = document) => [...root.querySelectorAll(s)];
const el = (tag, props = {}, children = []) => {
  const n = document.createElement(tag);
  Object.assign(n, props);
  for (const c of children) n.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
  return n;
};

/* ---------- Audio ---------- */
const Sounds = (() => {
  let ctx = null;
  const getCtx = () => {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  };
  const tone = (freq, dur, type = 'sine', gain = 0.06, slide = null) => {
    if (STATE.muted) return;
    const c = getCtx(); if (!c) return;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, c.currentTime);
    if (slide) o.frequency.exponentialRampToValueAtTime(slide, c.currentTime + dur);
    g.gain.setValueAtTime(0.0001, c.currentTime);
    g.gain.exponentialRampToValueAtTime(gain, c.currentTime + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + dur);
    o.connect(g).connect(c.destination);
    o.start();
    o.stop(c.currentTime + dur);
  };
  const noise = (dur, gain = 0.05, filterFreq = 1500) => {
    if (STATE.muted) return;
    const c = getCtx(); if (!c) return;
    const bufSize = c.sampleRate * dur;
    const buf = c.createBuffer(1, bufSize, c.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bufSize; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / bufSize);
    const src = c.createBufferSource();
    src.buffer = buf;
    const f = c.createBiquadFilter();
    f.type = 'lowpass'; f.frequency.value = filterFreq;
    const g = c.createGain();
    g.gain.value = gain;
    src.connect(f).connect(g).connect(c.destination);
    src.start();
  };
  return {
    keyClick() { tone(620, 0.015, 'square', 0.025); },
    enter() { tone(880, 0.04, 'square', 0.04, 660); },
    error() { tone(160, 0.45, 'square', 0.08, 70); },
    success() {
      [523, 659, 784, 1046].forEach((f, i) =>
        setTimeout(() => tone(f, 0.18, 'triangle', 0.07), i * 90));
    },
    win() {
      // Upward fanfare — picked to sound upbeat/celebratory
      const seq = [523, 659, 784, 988, 1175, 1318, 1568, 1976];
      seq.forEach((f, i) =>
        setTimeout(() => tone(f, 0.22, 'triangle', 0.08), i * 100));
    },
    insertDisk() { noise(0.25, 0.08, 800); },
    scanTick() { tone(1200, 0.04, 'square', 0.03); },
    bsod() {
      tone(220, 1.2, 'sawtooth', 0.06, 80);
      noise(0.8, 0.04, 400);
    },
    click() { tone(440, 0.03, 'square', 0.04, 380); }
  };
})();

/* ---------- HUD ---------- */
const hud = {
  show(show = true) { $('#hud').hidden = !show; },
  set(phaseNum, errors, time) {
    $('#hud-level').textContent = `Phase ${phaseNum} / ${TOTAL_PHASES}`;
    $('#hud-errors').textContent = `Errors: ${errors} / ${MAX_ERRORS}`;
    $('#hud-time').textContent = formatTime(time);
  }
};

function formatTime(ms) {
  const total = Math.floor(ms / 1000);
  const m = String(Math.floor(total / 60)).padStart(2, '0');
  const s = String(total % 60).padStart(2, '0');
  return `${m}:${s}`;
}

/* ---------- Phase management ---------- */
function showPhase(name) {
  $$('.phase').forEach(p => p.hidden = true);
  const target = $(`[data-phase="${name}"]`);
  if (target) target.hidden = false;
  STATE.phase = name;
  const isWin = name === 'setup';
  $('#screen').classList.toggle('win-mode', isWin);
  // HUD is visible only during active play, not on title/ME-boot/win
  const isPlaying = !['start', 'me-boot', 'win'].includes(name);
  hud.show(isPlaying);
  if (isPlaying) hud.set(currentPhaseNum(), STATE.errors, currentTime());
}

function currentPhaseNum() {
  // Each phase maps to a user-meaningful step number.
  // Not every internal step bumps the counter; the Win98 setup wizard
  // stays on a single number while inside the wizard.
  switch (STATE.phase) {
    case 'start':
    case 'boot':           return 1; // power on / boot
    case 'prompt-floppy':  return 2; // A:\> DOS prompt
    case 'disk-insert':    return 3; // insert the CD
    case 'prompt-cd':      return 4; // D:\> DOS prompt
    case 'setup-launch':
    case 'setup':          return 5; // Win98 Setup wizard (all substeps)
    case 'me-boot':
    case 'win':            return 6; // ME reveal / completion
    case 'bsod':           return 6; // failure shows final phase
    default:               return 1;
  }
}

function currentTime() {
  if (!STATE.startedAt || STATE.pausedStart) return STATE.pausedAcc;
  return STATE.pausedAcc + (Date.now() - STATE.startedAt);
}

function startTimer() {
  STATE.startedAt = Date.now();
  STATE.pausedStart = null;
  STATE.pausedAcc = 0;
  tickTimer();
}

function pauseTimer() {
  if (!STATE.startedAt || STATE.pausedStart) return;
  STATE.pausedAcc += Date.now() - STATE.startedAt;
  STATE.pausedStart = Date.now();
  STATE.startedAt = null;
}

function resumeTimer() {
  if (!STATE.pausedStart) return;
  STATE.startedAt = Date.now();
  STATE.pausedStart = null;
}

let tickInterval = null;
function tickTimer() {
  // 4Hz is plenty for an in-game time display and avoids starving the
  // browser's main thread (which was breaking page.screenshot calls).
  if (tickInterval) clearInterval(tickInterval);
  tickInterval = setInterval(() => {
    if (!STATE.startedAt) return;
    hud.set(currentPhaseNum(), STATE.errors, currentTime());
  }, 250);
}

/* ---------- Pause / Resume on hidden tab ---------- */
document.addEventListener('visibilitychange', () => {
  if (document.hidden) pauseTimer(); else resumeTimer();
});

/* ---------- Errors & Failure ---------- */
function addError(reason) {
  if (STATE.phase === 'win' || STATE.phase === 'start') return;
  STATE.errors++;
  Sounds.error();
  flashHud();
  if (STATE.errors >= MAX_ERRORS) {
    triggerRestart(reason);
  }
}

function flashHud() {
  const e = $('#hud-errors');
  e.style.color = '#ff4040';
  setTimeout(() => { e.style.color = ''; }, 250);
}

function triggerRestart(reason) {
  pauseTimer();
  Sounds.bsod();
  const msgs = [
    'A fatal exception 0E has occurred at 0028:C0014E0B in VXD VWIN32(05) + 00000784. The current application will be terminated.',
    'Windows protection error. Please restart your computer.',
    'An unrecoverable error occurred during Setup. Setup cannot continue. Press any key to restart your computer.',
    'Setup error 112: Insufficient memory to continue Setup. Restart your computer to free memory.'
  ];
  $('#bsod-msg').textContent = msgs[Math.floor(Math.random() * msgs.length)];
  showPhase('bsod');
  // Listen for any key to restart
  const handler = (e) => {
    if (e.repeat) return;
    window.removeEventListener('keydown', handler);
    document.removeEventListener('click', handler);
    resetTransientTimers();
    STATE.restarts++;
    STATE.errors = 0;
    STATE.startedAt = Date.now();
    STATE.pausedAcc = 0;
    STATE.pausedStart = null;
    runBootSequence();
  };
  window.addEventListener('keydown', handler);
  document.addEventListener('click', handler);
}

/* ---------- DOS helpers ---------- */
const DOS_HEADER = [
  'Award BIOS v4.51, An Energy Star Ally',
  'Copyright (C) 1984-1998, Award Software, Inc.',
  '',
  'PENTIUM-S CPU at 233MHz',
  'Memory Test : 32768K  OK',
  'Award Plug and Play BIOS Extension v1.0A',
  'Detecting IDE Primary Master... ST32122A',
  'Detecting IDE Primary Slave...  None',
  'Detecting IDE Secondary Master... CD-ROM 36X',
  'Detecting IDE Secondary Slave...  None',
  '',
  'Starting Windows 98...',
  '',
  'Microsoft(R) Windows 98',
  '   (C)Copyright Microsoft Corp 1981-1998.',
  '',
  'Starting MS-DOS...',
  '',
  'HIMEM is testing extended memory...done.',
  'HIMEM.SYS  loaded.',
  'IFSHLP.SYS loaded.',
  'SETVER.EXE loaded.',
  'COMMAND.COM loaded.',
  ''
];

function appendText(target, text, color = null) {
  const node = document.createTextNode(text + '\n');
  if (color) {
    const span = document.createElement('span');
    span.className = color;
    span.appendChild(node);
    target.appendChild(span);
  } else {
    target.appendChild(node);
  }
  target.parentElement.scrollTop = target.parentElement.scrollHeight;
}

/* ---------- Boot sequence ---------- */
function runBootSequence() {
  STATE.phase = 'boot';
  showPhase('boot');
  const screen = $('#boot-screen');
  const text = $('#boot-text');
  text.textContent = '';
  let lineIdx = 0;
  const stepTime = 70;
  const interval = setInterval(() => {
    if (lineIdx >= DOS_HEADER.length) {
      clearInterval(interval);
      setTimeout(() => {
        text.appendChild(document.createTextNode('A:\\>'));
        advanceToFloppyPrompt();
      }, 250);
      return;
    }
    appendText(text, DOS_HEADER[lineIdx]);
    lineIdx++;
  }, stepTime);
}

function advanceToFloppyPrompt() {
  STATE.phase = 'prompt-floppy';
  showPhase('prompt-floppy');
  const text = $('#floppy-text');
  text.textContent = '';
  $('#floppy-input').value = '';
  setUpDosInput('#floppy-input', '#floppy-text', 'floppy');
  const floppyPromptScreen = $('[data-phase="prompt-floppy"]');
  // Remove any old hint and re-add fresh one
  floppyPromptScreen.querySelectorAll('.hint').forEach(h => h.remove());

  const hint = document.createElement('div');
  hint.className = 'hint';
  hint.innerHTML = 'Try typing <b>dir</b> to see what&rsquo;s on the disk.<br><span style="color:#666">Then click the floppy drive up top to swap it for the Windows 98 CD.</span>';
  floppyPromptScreen.appendChild(hint);

  // Make the hint dismissable when the player starts typing seriously
  const dismiss = () => {
    if (text.textContent.length > 80) hint.remove();
  };
  const obs = new MutationObserver(dismiss);
  obs.observe(text, { childList: true, subtree: true, characterData: true });
}

/* ---------- DOS input handler ---------- */
function setUpDosInput(inputSel, textSel, mode) {
  const input = $(inputSel);
  const text = $(textSel);
  // focus
  setTimeout(() => input.focus(), 50);

  const handler = (e) => {
    // Drop everything else, we control the buffer
    if (e.key === 'Enter') {
      e.preventDefault();
      Sounds.enter();
      const cmd = input.value.trim();
      input.value = '';
      // Echo
      let promptText;
      if (mode === 'floppy') promptText = 'A:\\>';
      else if (mode === 'cd') promptText = 'D:\\>';
      else promptText = '$';
      appendText(text, promptText + cmd);
      handleDosCommand(cmd, text, mode);
    } else if (e.key === 'Backspace') {
      e.preventDefault();
      input.value = input.value.slice(0, -1);
      Sounds.keyClick();
    } else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey) {
      e.preventDefault();
      input.value += e.key;
      Sounds.keyClick();
    }
  };
  // Replace any previous handler to avoid stacking
  input.onkeydown = handler;
  // Clicking the prompt area focuses the input
  text.parentElement.onclick = () => input.focus();
}

function handleDosCommand(cmd, text, mode) {
  const upper = cmd.toUpperCase();
  if (!upper) return;

  if (mode === 'floppy') {
    handleFloppyCommand(upper, text);
  } else if (mode === 'cd') {
    handleCdCommand(upper, text);
  }
}

function handleFloppyCommand(upper, text) {
  if (upper === 'DIR') {
    appendText(text, ' Volume in drive A is W98STARTUP');
    appendText(text, ' Volume Serial Number is 1234-ABCD');
    appendText(text, ' Directory of A:\\');
    appendText(text, '');
    const files = [
      ['COMMAND', 'COM',  '93,328', '05-11-98', '12:00a'],
      ['HIMEM',   'SYS',  '39,824', '05-11-98', '12:00a'],
      ['IFSHLP',  'SYS',   '3,712', '05-11-98', '12:00a'],
      ['FORMAT',  'EXE',  '61,520', '05-11-98', '12:00a'],
      ['SCANDISK','EXE', '153,088', '05-11-98', '12:00a'],
      ['FDISK',   'EXE',  '65,536', '05-11-98', '12:00a'],
      ['SETVER',  'EXE',  '19,824', '05-11-98', '12:00a'],
      ['DRVSPACE', 'BIN', '12,384', '05-11-98', '12:00a'],
      ['README',  'TXT',   '8,341', '05-11-98', '12:00a'],
      ['SETUPLOG','TXT',  '11,028', '05-11-98', '12:00a']
    ];
    for (const f of files) {
      const line = `${f[0].padEnd(9)} ${f[1].padEnd(8)}${f[2].padStart(10)}  ${f[3]}  ${f[4]}`;
      appendText(text, line);
    }
    appendText(text, '');
    appendText(text, '          11 file(s)        466,617 bytes', 'dim-line');
    appendText(text, '                     1,457,664 bytes free', 'dim-line');
    appendText(text, '');
    appendText(text, 'A:\\>');
  } else if (upper === 'CLS') {
    text.textContent = '';
    appendText(text, 'A:\\>');
  } else if (upper === 'VER') {
    appendText(text, '');
    appendText(text, '  Windows 98 [Version 4.10.1998]');
    appendText(text, '');
    appendText(text, 'A:\\>');
  } else if (upper === 'HELP') {
    appendText(text, '');
    appendText(text, 'Available commands: DIR  VER  HELP  CLS  C:  D:  SETUP', 'dim-line');
    appendText(text, '');
    appendText(text, 'A:\\>');
  } else if (upper.startsWith('C:') || upper.startsWith('D:')) {
    appendText(text, '');
    appendText(text, 'Invalid drive specification', 'error-line');
    appendText(text, 'A:\\>');
  } else if (upper === 'SETUP') {
    appendText(text, '');
    appendText(text, 'Bad command or file name', 'error-line');
    appendText(text, 'A:\\>');
  } else {
    appendText(text, '');
    appendText(text, 'Bad command or file name', 'error-line');
    appendText(text, 'A:\\>');
  }
}

function handleCdCommand(upper, text) {
  if (upper === 'DIR') {
    appendText(text, ' Volume in drive D is W98CDROM');
    appendText(text, ' Volume Serial Number is 5678-EFGH');
    appendText(text, ' Directory of D:\\');
    appendText(text, '');
    const files = [
      ['EULA',     'TXT',     '4,732', '05-11-98', '12:00a'],
      ['SETUP',    'EXE',  '262,144', '05-11-98', '12:00a'],
      ['README',   'TXT',     '8,341', '05-11-98', '12:00a'],
      ['WIN98',    'CAB', '184,232,768','05-11-98','12:00a'],
      ['WIN98_22', 'CAB',  '24,576,000','05-11-98','12:00a'],
      ['WIN98_23', 'CAB',  '12,288,000','05-11-98','12:00a'],
      ['BASE4',    'CAB',  '14,336,000','05-11-98','12:00a']
    ];
    for (const f of files) {
      const line = `${f[0].padEnd(9)} ${f[1].padEnd(8)}${f[2].padStart(15)}  ${f[3]}  ${f[4]}`;
      appendText(text, line);
    }
    appendText(text, '');
    appendText(text, '            7 file(s)    233,707,985 bytes', 'dim-line');
    appendText(text, '                       230,031,360 bytes free', 'dim-line');
    appendText(text, '');
    appendText(text, 'D:\\>');
  } else if (upper === 'SETUP') {
    runSetupLaunch();
  } else if (upper === 'CLS') {
    text.textContent = '';
    appendText(text, 'D:\\>');
  } else if (upper === 'VER') {
    appendText(text, '');
    appendText(text, '  Windows 98 [Version 4.10.1998]');
    appendText(text, '');
    appendText(text, 'D:\\>');
  } else if (upper === 'HELP') {
    appendText(text, '');
    appendText(text, 'Try typing SETUP to start the installer.', 'dim-line');
    appendText(text, '');
    appendText(text, 'D:\\>');
  } else {
    appendText(text, '');
    appendText(text, 'Bad command or file name', 'error-line');
    appendText(text, 'D:\\>');
  }
}

/* ---------- Eject / insert CD ---------- */
function bindDriveButtons() {
  const floppyBtn = $('#floppy-eject');
  if (floppyBtn) {
    floppyBtn.addEventListener('click', () => {
      Sounds.insertDisk();
      advanceToDiskInsert();
    });
  }
}

function advanceToDiskInsert() {
  showPhase('disk-insert');
  const text = $('#disk-insert-text');
  text.textContent = '';
  appendText(text, '');
  appendText(text, 'Please insert the Windows 98 CD into drive D:', 'success-line');
  appendText(text, '');
  appendText(text, '(Click the CD below to insert it.)', 'dim-line');
  $('#insert-disk').onclick = () => {
    Sounds.insertDisk();
    $('#insert-card').hidden = true;
    appendText(text, '');
    appendText(text, 'Reading CD-ROM...', 'success-line');
    appendText(text, 'Microsoft(R) Windows(R) 98 CD-ROM detected.', 'success-line');
    appendText(text, '');
    appendText(text, 'A:\\>', 'success-line');
    setTimeout(advanceToCdPrompt, 700);
  };
}

function advanceToCdPrompt() {
  showPhase('prompt-cd');
  const text = $('#cd-text');
  text.textContent = '';
  $('#cd-input').value = '';
  setUpDosInput('#cd-input', '#cd-text', 'cd');
  appendText(text, 'Microsoft(R) Windows 98');
  appendText(text, '(C)Copyright Microsoft Corp 1981-1998.', 'dim-line');
  appendText(text, '');
  appendText(text, 'D:\\>');
}

/* ---------- Setup launch ---------- */
function runSetupLaunch() {
  showPhase('setup-launch');
  const text = $('#setup-launch-text');
  text.textContent = '';
  const lines = [
    ['D:\\>SETUP', null, 100],
    ['', null, 100],
    ['Microsoft(R) Windows 98 Setup', 'success-line', 200],
    ['Copyright (C) Microsoft Corp 1981-1998.', 'dim-line', 100],
    ['', null, 100],
    ['Setup is initializing...', null, 250],
    ['', null, 100],
    ['  - Checking hardware environment...', 'dim-line', 100],
    ['  - Examining system requirements...', 'dim-line', 100],
    ['  - Detecting storage devices...', 'dim-line', 100],
    ['  - Loading user interface...', 'dim-line', 100],
    ['', null, 200],
    ['Please wait while Windows 98 Setup loads...', 'success-line', 0]
  ];
  let acc = 0;
  for (const [line, cls, delay] of lines) {
    setTimeout(() => {
      if (cls) appendText(text, line, cls);
      else appendText(text, line);
    }, acc);
    acc += delay;
  }
  setTimeout(() => enterSetup(), acc + 300);
}

/* ---------- WIN98 setup wizard ---------- */
function enterSetup() {
  showPhase('setup');
  showSetupStep('welcome');
  prepareEULA();
}

function prepareEULA() {
  const EULA =
`End-User License Agreement
===========================

IMPORTANT-READ CAREFULLY: This End-User License Agreement
("EULA") is a legal agreement between you (either an individual
or a single entity) and Microsoft Corporation ("Microsoft")
for the Microsoft software product identified above, which
includes computer software and may include associated media,
printed materials, and "on-line" or electronic documentation
("SOFTWARE PRODUCT"). By installing, copying, or otherwise
using the SOFTWARE PRODUCT, you agree to be bound by the terms
of this EULA. If you do not agree to the terms of this EULA,
do not install or use the SOFTWARE PRODUCT.

1. GRANT OF LICENSE.
   Microsoft grants you the following rights provided that you
   comply with all terms and conditions of this EULA:

   a. Installation and Use. You may install and use one copy
      of the SOFTWARE PRODUCT, or in lieu of a copy you may
      receive the SOFTWARE PRODUCT on a single computer.

   b. Reproduction and Distribution. You may not reproduce or
      distribute the SOFTWARE PRODUCT except as expressly
      provided herein.

2. COPYRIGHT.
   All title and copyrights in and to the SOFTWARE PRODUCT
   (including but not limited to any images, photographs,
   animations, video, audio, music, text, and "applets"
   incorporated into the SOFTWARE PRODUCT) are owned by
   Microsoft or its suppliers. The SOFTWARE PRODUCT is
   protected by copyright laws and international treaty
   provisions.

3. DESCRIPTION OF OTHER RIGHTS AND LIMITATIONS.
   - Limitations on Reverse Engineering, Decompilation, and
     Disassembly. You may not reverse engineer, decompile, or
     disassemble the SOFTWARE PRODUCT, except and only to the
     extent that such activity is expressly permitted by
     applicable law notwithstanding this limitation.
   - Support Services. Microsoft provides support services
     related to the SOFTWARE PRODUCT.

4. SOFTWARE TRANSFER.
   You may permanently transfer all of your rights under this
   EULA, provided you retain no copies, you transfer all of
   the SOFTWARE PRODUCT, and the recipient agrees to the
   terms of this EULA.

5. EXPORT RESTRICTIONS.
   You agree that you will not export or re-export the
   SOFTWARE PRODUCT to any country, person, or entity.

6. LIMITED WARRANTY.
   Microsoft warrants that the SOFTWARE PRODUCT will perform
   substantially in accordance with the accompanying written
   materials for a period of ninety (90) days from the date
   of receipt.

7. ENTIRE AGREEMENT.
   This EULA is the entire agreement between you and
   Microsoft relating to the SOFTWARE PRODUCT.

  [ Press F8 to accept, ESC to decline ]`;
  $('#eula-text').textContent = EULA;
  const box = $('#eula-box');
  // disable Accept until scrolled
  $('.setup-btn[data-action="eula-accept"]').disabled = true;
  box.onscroll = () => {
    if (box.scrollTop + box.clientHeight >= box.scrollHeight - 6) {
      $('.setup-btn[data-action="eula-accept"]').disabled = false;
    }
  };
  // Auto-scroll finish
  setTimeout(() => {
    box.scrollTop = box.scrollHeight;
    $('.setup-btn[data-action="eula-accept"]').disabled = false;
  }, 2200);
}

function showSetupStep(name) {
  $$('.win-step').forEach(s => s.hidden = true);
  const step = $(`.win-step[data-step="${name}"]`);
  if (step) step.hidden = false;
}

function setupShortcutHandler(e) {
  if (STATE.phase !== 'setup') return;
  const stepEl = $('.win-step:not([hidden])');
  if (!stepEl) return;
  const step = stepEl.dataset.step;

  if (e.key === 'F8' && step === 'welcome') {
    e.preventDefault();
    acceptEula();
  } else if (e.key === 'Escape' && step === 'welcome') {
    e.preventDefault();
    addError('You declined the license agreement');
  } else if (e.key === 'PageDown' && step === 'welcome') {
    const box = $('#eula-box');
    if (box) box.scrollTop += box.clientHeight;
  } else if (e.key === 'End' && step === 'welcome') {
    const box = $('#eula-box');
    if (box) {
      box.scrollTop = box.scrollHeight;
      $('.setup-btn[data-action="eula-accept"]').disabled = false;
    }
  } else if (e.key.toLowerCase() === 'y' && step === 'scandisk-prompt') {
    if (e.target.tagName !== 'INPUT') {
      e.preventDefault();
      startScandiskGame();
    }
  } else if (e.key.toLowerCase() === 'n' && step === 'scandisk-prompt') {
    if (e.target.tagName !== 'INPUT') {
      e.preventDefault();
      skipScandisk();
    }
  }
}

function acceptEula() {
  Sounds.click();
  showSetupStep('checking');
  runCheckingProgress();
}

function runCheckingProgress() {
  const fill = $('#setup-progress-fill');
  const meta = $('#checking-meta');
  const status = $('#checking-status');
  let pct = 0;
  const tickMs = 60;
  const msgs = [
    [0,   'Setup is checking your system configuration...'],
    [18,  'Setup is checking your system configuration...'],
    [30,  'Detecting storage controllers...'],
    [55,  'Verifying minimum system requirements...'],
    [78,  'Checking Plug and Play devices...'],
    [96,  'Loading installer...']
  ];
  const interval = setInterval(() => {
    pct += 1;
    fill.style.width = pct + '%';
    meta.textContent = pct + '% complete';
    const m = msgs.find(([p, _]) => Math.abs(p - pct) < 3);
    if (m) status.textContent = m[1];
    Sounds.scanTick();
    if (pct >= 100) {
      clearInterval(interval);
      fill.style.width = '100%';
      Sounds.click();
      setTimeout(() => showSetupStep('scandisk-prompt'), 300);
    }
  }, tickMs);
}

/* ---------- SCANDISK prompt / mini-game ---------- */
let scandiskRafId = null;
let scandiskFixIntervalId = null;
function clearScandiskTimers() {
  if (scandiskRafId) { cancelAnimationFrame(scandiskRafId); scandiskRafId = null; }
  if (scandiskFixIntervalId) { clearInterval(scandiskFixIntervalId); scandiskFixIntervalId = null; }
}

function startScandiskGame() {
  Sounds.click();
  showSetupStep('scandisk-game');
  const grid = $('#scandisk-grid');
  grid.innerHTML = '';
  const COLS = 12, ROWS = 8;
  grid.style.gridTemplateColumns = `repeat(${COLS}, 1fr)`;
  const cells = [];
  for (let i = 0; i < COLS * ROWS; i++) {
    const cell = document.createElement('button');
    cell.type = 'button';
    cell.className = 'scandisk-cell';
    cell.dataset.idx = i;
    grid.appendChild(cell);
    cells.push(cell);
  }
  let badTotal = 6;
  let badFound = 0;
  let badAlive = 0;
  let elapsed = 0;
  let spawnTimer = 0;
  const totalEl = $('#scandisk-total');
  const foundEl = $('#scandisk-found');
  const timeEl = $('#scandisk-time');
  const progressFill = $('#scandisk-progress-fill');
  totalEl.textContent = badTotal;
  foundEl.textContent = '0';
  timeEl.textContent = '10.0';
  progressFill.style.width = '0%';

  const pickRandomIdx = () => Math.floor(Math.random() * cells.length);
  const spawnBad = () => {
    if (badAlive >= badTotal) return;
    const i = pickRandomIdx();
    const cell = cells[i];
    if (cell.classList.contains('bad') || cell.classList.contains('fixed')) {
      // try a few times to find a free one
      for (let j = 0; j < 8; j++) {
        const k = pickRandomIdx();
        if (!cells[k].classList.contains('bad') && !cells[k].classList.contains('fixed')) {
          cells[k].classList.add('bad');
          badAlive++;
          return;
        }
      }
      return;
    }
    cell.classList.add('bad');
    badAlive++;
  };

  // Spawn first immediately, then spawn more as time progresses
  spawnBad();

  const start = performance.now();
  let lastTime = start;

  const tick = (now) => {
    if (STATE.phase !== 'setup') return;
    const stepScreen = $('[data-step="scandisk-game"]');
    if (!stepScreen || stepScreen.hidden) return;

    const delta = (now - lastTime) / 1000;
    lastTime = now;
    elapsed = (now - start) / 1000;
    const remaining = Math.max(0, 10 - elapsed);
    timeEl.textContent = remaining.toFixed(1);

    // progress bar
    progressFill.style.width = Math.min(100, elapsed * 10) + '%';

    // Spawn additional bad sectors over the run
    spawnTimer += delta;
    if (spawnTimer > 1.4 && badAlive < badTotal) {
      spawnBad();
      spawnTimer = 0;
    }

    if (remaining <= 0) {
      // End: count misses
      const missed = $$('.scandisk-cell.bad:not(.fixed)');
      missed.forEach(c => c.classList.add('missed'));
      const unfixed = missed.length;
      addErrorsLater(unfixed);
      setTimeout(() => endScandisk(unfixed), 400);
      scandiskRafId = null;
      return;
    }
    scandiskRafId = requestAnimationFrame(tick);
  };

  scandiskRafId = requestAnimationFrame(tick);

  // Bind click handlers
  cells.forEach(cell => {
    cell.addEventListener('click', () => {
      if (cell.classList.contains('bad') && !cell.classList.contains('fixed')) {
        cell.classList.remove('bad');
        cell.classList.add('fixed');
        badAlive = Math.max(0, badAlive - 1);
        badFound++;
        foundEl.textContent = badFound;
        Sounds.click();
      }
    });
  });
}

function addErrorsLater(n) {
  for (let i = 0; i < n && i < 2; i++) {
    setTimeout(() => addError('Unrepaired disk sectors'), (i + 1) * 200);
  }
  if (n > 2) {
    setTimeout(() => addError('Multiple unrepaired sectors'), (3) * 200);
  }
}

function endScandisk(unfixed) {
  if (unfixed === 0) {
    Sounds.success();
    showSetupStep('install-dir');
  } else {
    Sounds.error();
    const banner = document.createElement('p');
    banner.style.cssText = 'margin-top:8px;color:#c83838;font-weight:600;';
    banner.textContent = `${unfixed} unrepaired error${unfixed === 1 ? '' : 's'} reported. Setup may be unstable.`;
    if (!$('.step-finished-scandisk-flag')) {
      banner.classList.add('step-finished-scandisk-flag');
      $('.win-step[data-step="scandisk-game"] .setup-body').appendChild(banner);
    }
    setTimeout(() => showSetupStep('install-dir'), 1500);
  }
}

function skipScandisk() {
  Sounds.error();
  addError('You skipped ScanDisk');
  showSetupStep('install-dir');
}

/* ---------- CD key ---------- */
function bindSetupActions() {
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('.setup-btn, .setup-option');
    if (!btn) return;
    const action = btn.dataset.action;
    if (!action) return;
    Sounds.click();
    runAction(action);
  });

  // CD key input formatting
  const keyInput = $('#product-key');
  if (keyInput) {
    keyInput.addEventListener('input', () => {
      const raw = keyInput.value.replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 25);
      const formatted = raw.match(/.{1,5}/g)?.join('-') ?? '';
      if (keyInput.value !== formatted) keyInput.value = formatted;
    });
  }

  // Submit on Enter inside any input in setup
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return;
    const stepEl = $('.win-step:not([hidden])');
    if (!stepEl) return;
    const step = stepEl.dataset.step;
    if (step === 'user-info' && e.target.tagName === 'INPUT') {
      e.preventDefault();
      runAction('user-info-ok');
    } else if (step === 'product-key' && e.target === keyInput) {
      e.preventDefault();
      runAction('product-key-ok');
    }
  });
}

function runAction(action) {
  switch (action) {
    case 'eula-accept': acceptEula(); break;
    case 'eula-decline': addError('You declined the EULA'); break;
    case 'scandisk-yes': startScandiskGame(); break;
    case 'scandisk-no':  skipScandisk(); break;
    case 'install-dir-ok': showSetupStep('options'); break;
    case 'opt-typical':
    case 'opt-portable':
    case 'opt-custom':
      showSetupStep('user-info');
      $('#user-name').value = '';
      $('#user-org').value = '';
      setTimeout(() => $('#user-name').focus(), 50);
      break;
    case 'opt-compact':
      addError('Compact install skips required drivers');
      showSetupStep('user-info');
      setTimeout(() => $('#user-name').focus(), 50);
      break;
    case 'user-info-ok':
      const nm = $('#user-name').value.trim();
      const org = $('#user-org').value.trim();
      if (!nm) {
        $('#user-name').focus();
        addError('Name is required');
        return;
      }
      if (!org) $('#user-org').value = '—';
      showSetupStep('product-key');
      runCdKeyTimer();
      break;
    case 'product-key-ok':
      const expected = $('#disc-key').textContent.trim();
      const typed = $('#product-key').value.trim().toUpperCase();
      if (typed === expected) {
        Sounds.success();
        stopCdKeyTimer();
        showSetupStep('final');
      } else {
        addError('Wrong product key');
        $('#product-key').value = '';
        $('#product-key').focus();
      }
      break;
    case 'start-copy':
      runCopyPhase();
      break;
    case 'cancel-copy':
      addError('You cancelled file copy');
      break;
  }
}

/* ---------- CD key timer ---------- */
let cdKeyInterval = null;
function runCdKeyTimer() {
  const fill = $('#scandisk-progress-fill'); // reuse a stripe
  // Build/insert a timer hint in product-key step
  const meta = $('#product-key-hint');
  let seconds = 30;
  meta.innerHTML = `Read the disc label. Format: <b>XXXXX-XXXXX-XXXXX-XXXXX-XXXXX</b>. Time left: <b id="cd-key-time">${seconds}s</b>`;
  const timeEl = $('#cd-key-time');
  if (cdKeyInterval) clearInterval(cdKeyInterval);
  cdKeyInterval = setInterval(() => {
    seconds--;
    if (timeEl) timeEl.textContent = seconds + 's';
    if (seconds <= 0) {
      clearInterval(cdKeyInterval);
      cdKeyInterval = null;
      addError('Product key timed out');
      seconds = 30;
      runCdKeyTimer();
    }
  }, 1000);
  $('#product-key').value = '';
  setTimeout(() => $('#product-key').focus(), 50);
}

function stopCdKeyTimer() {
  if (cdKeyInterval) clearInterval(cdKeyInterval);
  cdKeyInterval = null;
}

/* ---------- Final copy ---------- */
function runCopyPhase() {
  showSetupStep('copy');
  const fill = $('#copy-fill');
  const meta = $('#copy-meta');
  let pct = 0;
  const interval = setInterval(() => {
    // Slow ramp; takes ~22 seconds to complete
    pct += 1;
    fill.style.width = pct + '%';
    meta.textContent = pct + '% complete';
    if (pct >= 100) {
      clearInterval(interval);
      meta.textContent = '100% complete';
      Sounds.success();
      $('#copy-done').hidden = false;
      setTimeout(triggerWin, 1200);
    }
  }, 220);
}

function triggerWin() {
  // The kicker — instead of installing the user's chosen Windows,
  // this ancient computer has instead installed Windows ME.
  pauseTimer();
  STATE.phase = 'me-boot';
  showPhase('me-boot');
  hud.show(false);
  Sounds.win();
  setTimeout(showWinScreen, 2700);
}

function showWinScreen() {
  showPhase('win');
  hud.show(false);
  $('#stat-time').textContent = formatTime(currentTime());
  $('#stat-errors').textContent = STATE.errors;
  $('#stat-restarts').textContent = STATE.restarts;
  const quotes = [
    '"Me? An upgrade? In THESE pants?"',
    'Windows ME: the dawn of a new computing age.',
    'You have just installed the greatest OS ever made.',
    '"PC Magazine\'s highest-rated Windows of all time." (citation not needed)',
    'It just works. Mostly. Sometimes. In its own way.',
    'Your favorite. The favorite of millions.',
    'You will defend this decision to your friends.',
    'Tomorrow you will try to install XP. You will fail.',
    'A triumph of engineering. A work of art. A new beginning.',
    '1998 was a long time ago, but ME is forever.'
  ];
  $('#end-quote').textContent = quotes[Math.floor(Math.random() * quotes.length)];
}

/* ---------- Wire everything ---------- */
function init() {
  // Mute toggle
  const mute = $('#mute-toggle');
  mute.checked = STATE.muted;
  mute.addEventListener('change', () => {
    STATE.muted = mute.checked;
    if (!STATE.muted) Sounds.click();
  });

  // Start button
  $('#start-btn').addEventListener('click', () => {
    if (!STATE.startedAt) startTimer();
    Sounds.success();
    runBootSequence();
  });

  // Drive buttons
  bindDriveButtons();

  // Setup actions (and global keyboard shortcuts for the wizard)
  bindSetupActions();
  window.addEventListener('keydown', setupShortcutHandler);

  // End restart
  $('#restart-btn').addEventListener('click', () => {
    resetTransientTimers();
    STATE.errors = 0;
    STATE.startedAt = Date.now();
    STATE.pausedAcc = 0;
    STATE.pausedStart = null;
    Sounds.click();
    runBootSequence();
  });

  // Show start phase
  showPhase('start');
  hud.show(false);
}

document.addEventListener('DOMContentLoaded', init);
