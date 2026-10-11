// Disk Defragmenter — Game Edition. Zen stare, and a drive you pack by hand.

import { createAudio } from './audio.js';
import {
  LEGEND,
  LEVELS,
  ZEN_DRIVES,
  addBad,
  cellColor,
  clearOneBad,
  computeScore,
  contiguity,
  createLevel,
  fileById,
  fileHome,
  firstIncomplete,
  formatClock,
  formatResult,
  fragmentLabel,
  isComplete,
  levelById,
  mulberry32,
  nextHint,
  optimizedCount,
  packFile,
  quickFormat,
  relocate,
  scatterDownTo,
  starCount,
  zenById,
} from './disk.js';
import { paint } from './render.js';
import { ZEN_RESTARTS, createZen, zenColor, zenRatio, zenRefragment, zenRestart, zenStep } from './zen.js';

const SAVE_KEY = 'crispy.defrag.v1';
const IDLE_MS = 18000;
const COFFEE_MS = 15000;

const reducedQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
let reduced = reducedQuery.matches;
if (reduced) document.documentElement.classList.add('reduce');
reducedQuery.addEventListener?.('change', (event) => {
  reduced = event.matches;
  document.documentElement.classList.toggle('reduce', reduced);
});

const audio = createAudio();
const $ = (sel) => document.querySelector(sel);
const app = $('#app');
const canvas = $('#grid');
const legendEl = $('[data-legend]');
const filesEl = $('[data-files]');
const powersEl = $('[data-powers]');
const statsEl = $('[data-stats]');
const statusEl = $('[data-status]');
const progressEl = $('[data-progress]');
const meterEl = $('[data-meter]');
const titleEl = $('[data-title]');
const detailsEl = $('[data-details]');
const detailsBtn = $('[data-action="details"]');
const pauseBtn = $('[data-action="pause"]');
const muteBtn = $('[data-action="mute"]');
const defragWin = $('[data-screen="defrag"]');
const launcher = $('[data-screen="launcher"]');
const dialogRoot = $('[data-dialog]');
const dialogTitle = $('[data-dialog-title]');
const dialogBody = $('[data-dialog-body]');
const dialogActions = $('[data-dialog-actions]');
const toastEl = $('[data-toast]');
const dimEl = $('[data-dim]');
const dialogCard = $('[data-dialog-card]');

const ACHIEVEMENTS = [
  { id: 'stare', name: 'Stared for 10 minutes', detail: 'Let Zen mode run for ten minutes.' },
  { id: 'restart', name: 'Restarted at 10% three times', detail: 'The drive changed its mind. Three times.' },
  { id: 'floppy', name: 'Floppy hero', detail: 'Pack the 1.44MB disk.' },
  { id: 'family', name: 'Family reunion', detail: 'Survive the family PC.' },
  { id: 'combo', name: 'One-pass wonder', detail: 'Finish a file without wandering off.' },
  { id: 'perfect', name: 'Still contiguous', detail: 'Finish a drive at 100% contiguous.' },
  { id: 'coffee', name: 'Coffee break', detail: 'Stop the clock and keep the head.' },
  { id: 'turbo', name: 'Turbo nerd', detail: 'Use Defrag Turbo.' },
  { id: 'saver', name: 'Lights off', detail: 'Watch the screensaver.' },
];

function emptySave() {
  return {
    v: 1,
    tutorialSeen: false,
    mute: false,
    zenMs: 0,
    restarts: 0,
    achievements: [],
    best: {},
    scores: {},
  };
}

function loadSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return emptySave();
    return { ...emptySave(), ...JSON.parse(raw) };
  } catch {
    return emptySave();
  }
}

let save = loadSave();

function persist() {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(save));
  } catch {
    /* private mode */
  }
}

let mode = null;
let zen = null;
let game = null;
let details = false;
let paused = false;
let saver = false;
let modal = null;
let raf = 0;
let lastFrame = 0;
let zenAcc = 0;
let zenClock = 0;
let lastPersist = 0;
let drag = null;
let toastTimer = 0;
let finishedCard = false;
let ticks = 0;

function grant(id) {
  if (save.achievements.includes(id)) return;
  save.achievements.push(id);
  persist();
  const found = ACHIEVEMENTS.find((item) => item.id === id);
  toast(found ? found.name : id);
}

function toast(text) {
  toastEl.textContent = text;
  toastEl.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toastEl.hidden = true;
  }, reduced ? 1600 : 2800);
}

function setStatus(text) {
  statusEl.textContent = text;
}

function setProgress(ratio) {
  const pct = Math.max(0, Math.min(100, Math.round(ratio * 100)));
  progressEl.textContent = `${pct}%`;
  meterEl.style.width = `${pct}%`;
  meterEl.parentElement?.setAttribute('aria-valuenow', String(pct));
}

function setMute(next) {
  save.mute = !!next;
  audio.setMuted(save.mute);
  muteBtn.textContent = save.mute ? 'Unmute' : 'Mute';
  muteBtn.setAttribute('aria-pressed', save.mute ? 'true' : 'false');
  const box = $('#mute');
  if (box) box.checked = save.mute;
  persist();
}

function showScreen(name) {
  launcher.hidden = name !== 'launcher';
  defragWin.hidden = name !== 'defrag';
  document.body.classList.toggle('mode-game', name === 'defrag' && mode === 'game');
  document.body.classList.toggle('mode-zen', name === 'defrag' && mode === 'zen');
}

function setDetails(open) {
  details = open;
  detailsEl.hidden = !open;
  defragWin.classList.toggle('is-details', open);
  detailsBtn.textContent = open ? 'Hide Details' : 'Show Details';
  detailsBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
  if (open) requestAnimationFrame(layout);
}

function layout() {
  const rect = canvas.getBoundingClientRect();
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const width = Math.max(2, Math.round(rect.width * dpr));
  const height = Math.max(2, Math.round(rect.height * dpr));
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }
  draw();
}

function currentColors(now) {
  if (mode === 'zen' && zen) return zen.cells.map((cell) => zenColor(cell));
  if (mode === 'game' && game) {
    return game.state.cells.map((_, index) => cellColor(game.state, index, game.fx, now));
  }
  return [];
}

function draw() {
  const now = performance.now();
  if (mode === 'zen' && zen) {
    paint(canvas, {
      cols: zen.cols,
      rows: zen.rows,
      colors: currentColors(now),
      cursor: details || saver ? zen.cursor : null,
      head: null,
      carry: null,
      hint: null,
    });
    return;
  }
  if (mode === 'game' && game) {
    const file = game.carry ? fileById(game.state, game.carry.fileId) : null;
    paint(canvas, {
      cols: game.state.cols,
      rows: game.state.rows,
      colors: currentColors(now),
      head: game.head,
      carry: game.carry ? game.carry.from : null,
      carryColor: file?.color || null,
      hint: game.hint,
      cursor: null,
    });
  }
}

function playZenSound(step) {
  if (!step?.sound || paused || modal) return;
  if (step.sound === 'seek') audio.seek(step.dist || 8);
  else audio.tick(step.sound === 'write' ? 'write' : 'read');
}

function openDialog({ title, html, buttons }) {
  return new Promise((resolve) => {
    modal = { resolve };
    $('#tutorial').hidden = true;
    dialogCard.hidden = false;
    dialogTitle.textContent = title;
    dialogBody.innerHTML = html;
    dialogActions.replaceChildren();
    buttons.forEach((button, index) => {
      const el = document.createElement('button');
      el.type = 'button';
      el.className = button.primary ? 'btn default' : 'btn';
      el.textContent = button.label;
      el.dataset.choice = button.id;
      el.addEventListener('click', () => closeDialog(button.id));
      dialogActions.appendChild(el);
      if (index === 0) el.focus();
    });
    dialogRoot.hidden = false;
  });
}

function closeDialog(choice) {
  if (!modal) return;
  const { resolve } = modal;
  modal = null;
  dialogCard.hidden = true;
  dialogRoot.hidden = true;
  resolve(choice);
}

function renderFiles() {
  if (!game) {
    filesEl.hidden = true;
    return;
  }
  filesEl.hidden = false;
  filesEl.replaceChildren();
  for (const file of game.state.files) {
    const li = document.createElement('li');
    const swatch = document.createElement('i');
    swatch.style.background = file.color;
    const name = document.createElement('span');
    name.textContent = file.name;
    const note = document.createElement('em');
    note.textContent = fragmentLabel(game.state, file);
    li.append(swatch, name, note);
    if (game.carry?.fileId === file.id || fileById(game.state, game.state.cells[game.head]?.f)?.id === file.id) {
      li.classList.add('is-hot');
    }
    filesEl.appendChild(li);
  }
}

function renderPowers() {
  powersEl.replaceChildren();
  if (!game) {
    powersEl.hidden = true;
    return;
  }
  const defs = [
    ['turbo', 'Defrag Turbo'],
    ['format', 'Quick Format'],
    ['coffee', 'Coffee break'],
  ];
  let any = false;
  for (const [id, label] of defs) {
    const count = game.state.charges[id] || 0;
    if (!(id in game.state.charges)) continue;
    if (count <= 0 && id !== 'coffee' && id !== 'turbo' && id !== 'format') continue;
    any = true;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'btn';
    button.dataset.power = id;
    button.textContent = `${label} (${count})`;
    button.disabled = count <= 0 || (id === 'coffee' && performance.now() < game.coffeeUntil);
    powersEl.appendChild(button);
  }
  powersEl.hidden = !any;
}

function renderStats() {
  if (mode === 'zen' && zen) {
    const clusters = zen.cols * zen.rows;
    statsEl.textContent = saver
      ? 'Screensaver · Esc returns'
      : `Clusters ${clusters} · ${paused ? 'Paused' : 'Head is moving'}`;
    return;
  }
  if (!game) {
    statsEl.textContent = '';
    return;
  }
  const now = performance.now();
  const coffee = game.coffeeUntil > now ? ` · Coffee ${Math.ceil((game.coffeeUntil - now) / 1000)}s` : '';
  const score = liveScore();
  statsEl.textContent = `Seek ${game.seek} · ${formatClock(game.elapsed)} · Combo ×${game.combos} · Score ${score}${coffee}`;
}

function liveScore() {
  if (!game) return 0;
  const blocks = game.state.files.reduce((sum, file) => sum + file.size, 0);
  return computeScore({
    seek: game.seek,
    elapsedMs: game.elapsed,
    contig: contiguity(game.state),
    combos: game.combos,
    blocks,
  });
}

function syncGameHud() {
  if (!game) return;
  const { ratio } = optimizedCount(game.state);
  setProgress(ratio);
  renderFiles();
  renderPowers();
  renderStats();
}

function achievementCheckRestart() {
  save.restarts += 1;
  persist();
  if (save.restarts >= 3) grant('restart');
}

async function showRestartDialog() {
  paused = true;
  pauseBtn.textContent = 'Resume';
  audio.restartSting();
  setStatus('Drive contents have changed. Restarting at 10%.');
  setProgress(mode === 'zen' && zen ? zenRatio(zen) : game ? optimizedCount(game.state).ratio : 0.1);
  await openDialog({
    title: 'Disk Defragmenter',
    html: '<p>Drive contents have changed.</p><p>Defragmentation will restart at 10%.</p>',
    buttons: [{ id: 'ok', label: 'OK', primary: true }],
  });
  paused = false;
  pauseBtn.textContent = 'Pause';
  setStatus('Restarted at 10%.');
}

function maybeZenRestart() {
  if (!zen || paused || modal || zen.restartsFired >= ZEN_RESTARTS.length) return false;
  const mark = ZEN_RESTARTS[zen.restartsFired];
  if (zenRatio(zen) < mark) return false;
  zen.restartsFired += 1;
  zenRestart(zen, mulberry32((Date.now() ^ (zen.restartsFired * 997)) >>> 0));
  achievementCheckRestart();
  showRestartDialog();
  return true;
}

function cellFromEvent(event) {
  const rect = canvas.getBoundingClientRect();
  const cols = mode === 'game' ? game.state.cols : zen?.cols || 1;
  const rows = mode === 'game' ? game.state.rows : zen?.rows || 1;
  const x = event.clientX - rect.left;
  const y = event.clientY - rect.top;
  if (x < 0 || y < 0 || x > rect.width || y > rect.height) return -1;
  const col = Math.min(cols - 1, Math.max(0, Math.floor((x / rect.width) * cols)));
  const row = Math.min(rows - 1, Math.max(0, Math.floor((y / rect.height) * rows)));
  return row * cols + col;
}

function wake() {
  game && (game.lastInput = performance.now());
  if (!dimEl.hidden) dimEl.hidden = true;
}

function noteCombo(fileId) {
  if (!game || fileId == null) return;
  if (!game.pass.has(fileId)) game.pass.set(fileId, true);
  if (game.lastFile != null && game.lastFile !== fileId && !fileHome(game.state, game.lastFile)) {
    game.pass.set(game.lastFile, false);
  }
  game.lastFile = fileId;
  if (!fileHome(game.state, fileId)) return;
  const file = fileById(game.state, fileId);
  if (game.pass.get(fileId)) {
    game.combos += 1;
    game.pass.set(fileId, false);
    grant('combo');
    setStatus(`${file.name} packed in one pass.`);
    audio.fanfare();
  } else {
    setStatus(`${file.name} packed.`);
    audio.tick('write');
  }
}

function playerMove(from, to) {
  if (!game || paused || modal) return false;
  const travel = Math.abs(from - game.head) + Math.abs(to - from);
  const result = relocate(game.state, from, to);
  if (!result.ok) {
    audio.error();
    setStatus(result.reason === 'blocked' ? 'That cluster is taken.' : 'Nothing to move there.');
    return false;
  }
  game.seek += travel;
  game.moves += 1;
  game.head = to;
  game.hint = null;
  game.carry = null;
  const now = performance.now();
  const flash = reduced ? 0 : 160;
  game.fx.push({ index: from, kind: 'read', until: now + flash });
  game.fx.push({ index: to, kind: 'write', until: now + flash + 40 });
  audio.seek(travel);
  noteCombo(result.fileId);
  afterMove();
  return true;
}

function afterMove() {
  syncGameHud();
  draw();
  if (isComplete(game.state)) {
    finishGame();
    return;
  }
  if (modal || paused) return;
  const now = performance.now();
  if (game.coffeeUntil > now) return;
  if (game.state.restart && !game.restartFired && optimizedCount(game.state).ratio >= 0.4) {
    game.restartFired = true;
    scatterDownTo(game.state, 0.1, mulberry32((game.state.seed ^ 0x9e3779b9) >>> 0));
    game.pass.clear();
    game.lastFile = null;
    achievementCheckRestart();
    syncGameHud();
    showRestartDialog();
    return;
  }
  if (game.state.scandiskAt && !game.scandiskFired && game.moves >= game.state.scandiskAt) {
    game.scandiskFired = true;
    showScanDisk();
  }
}

async function showScanDisk() {
  paused = true;
  pauseBtn.textContent = 'Resume';
  setStatus('ScanDisk wants the drive.');
  const choice = await openDialog({
    title: 'ScanDisk',
    html: '<p>ScanDisk found a problem on drive C while Defragmenter was working.</p>',
    buttons: [
      { id: 'fix', label: 'Fix it', primary: true },
      { id: 'later', label: 'Later' },
    ],
  });
  if (choice === 'fix') {
    const fixed = clearOneBad(game.state);
    setStatus(fixed ? 'ScanDisk repaired a bad sector.' : 'ScanDisk found nothing else.');
    audio.tick('write');
  } else {
    addBad(game.state, mulberry32((game.state.seed ^ 0x51ed) >>> 0));
    setStatus('ScanDisk left a bad sector behind.');
    audio.error();
  }
  paused = false;
  pauseBtn.textContent = 'Pause';
  syncGameHud();
  draw();
  if (isComplete(game.state)) finishGame();
}

function finishGame() {
  if (!game || game.done) return;
  game.done = true;
  paused = true;
  const ratio = contiguity(game.state);
  const complete = isComplete(game.state);
  const stars = starCount({
    complete,
    seek: game.seek,
    elapsedMs: game.elapsed,
    par: game.state.par,
  });
  const score = liveScore();
  const line = formatResult(game.state.sizeLabel, game.elapsed, ratio);
  recordScore(game.state.id, { score, stars, time: game.elapsed, contig: ratio, seek: game.seek });
  if (complete && ratio >= 1) grant('perfect');
  if (game.state.id === 'floppy' && complete) grant('floppy');
  if (game.state.id === 'family' && complete) grant('family');
  audio.fanfare();
  setStatus('Defragmentation complete.');
  setProgress(1);
  showResult(line, { score, stars, again: true, next: nextLevelId(game.state.id) });
}

function nextLevelId(id) {
  const index = LEVELS.findIndex((level) => level.id === id);
  return index >= 0 && index < LEVELS.length - 1 ? LEVELS[index + 1].id : null;
}

function recordScore(id, row) {
  const at = new Date().toISOString();
  const entry = { ...row, at };
  save.scores[id] = save.scores[id] || [];
  save.scores[id].push(entry);
  save.scores[id].sort((a, b) => b.score - a.score);
  save.scores[id] = save.scores[id].slice(0, 5);
  const best = save.best[id];
  if (!best || row.score > best.score) save.best[id] = entry;
  persist();
}

function starText(count) {
  return '★★★'.slice(0, count) + '☆☆☆'.slice(0, 3 - count);
}

async function showResult(line, extra = {}) {
  finishedCard = true;
  const best = extra.levelId ? save.best[extra.levelId] : game ? save.best[game.state.id] : null;
  const bits = [`<p class="share" data-share>${line}</p>`];
  if (extra.score != null) {
    bits.push(`<p>Score ${extra.score} · ${starText(extra.stars || 0)}</p>`);
  }
  if (best) bits.push(`<p>Best on this drive: ${best.score}</p>`);
  const buttons = [
    { id: 'copy', label: 'Copy result', primary: true },
  ];
  if (extra.next) buttons.push({ id: 'next', label: 'Next drive' });
  if (extra.again || extra.zen) buttons.push({ id: 'again', label: extra.zen ? 'Run it again' : 'Again' });
  buttons.push({ id: 'close', label: 'Close' });
  const choice = await openDialog({
    title: extra.stopped ? 'Defragmentation stopped' : 'Defragmentation complete',
    html: bits.join(''),
    buttons,
  });
  const shown = dialogWas(line);
  if (choice === 'copy') {
    await copyText(shown);
    showResult(shown, extra);
    return;
  }
  if (choice === 'again' && extra.zen && extra.againId) startZen(extra.againId);
  else if (choice === 'again' && game) startGame(game.state.id);
  else if (choice === 'next' && extra.next) startGame(extra.next);
  else if (choice === 'close') {
    /* leave the finished map up */
  }
}

function dialogWas(fallback) {
  return fallback;
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    toast('Copied');
  } catch {
    const area = document.createElement('textarea');
    area.value = text;
    area.setAttribute('readonly', '');
    document.body.appendChild(area);
    area.select();
    try {
      document.execCommand('copy');
      toast('Copied');
    } catch {
      toast(text);
    }
    area.remove();
  }
}

function stopToLauncher() {
  audio.stopHum();
  cancelAnimationFrame(raf);
  raf = 0;
  exitSaver();
  mode = null;
  zen = null;
  game = null;
  paused = false;
  showScreen('launcher');
  window.__defrag = api;
}

function onCell(index, dragTo) {
  if (mode !== 'game' || !game || paused || modal || index < 0) return;
  wake();
  if (dragTo != null) {
    game.carry = null;
    if (game.state.cells[index]?.t === 'file' && game.state.cells[dragTo]?.t === 'free') playerMove(index, dragTo);
    else {
      audio.error();
      setStatus('Drop blocks on free space.');
    }
    draw();
    return;
  }
  game.head = index;
  if (game.carry) {
    if (index === game.carry.from) {
      game.carry = null;
      draw();
      return;
    }
    if (game.state.cells[index].t === 'free') {
      playerMove(game.carry.from, index);
      return;
    }
    if (game.state.cells[index].t === 'file') {
      game.carry = { from: index, fileId: game.state.cells[index].f };
      setStatus(`Carrying ${fileById(game.state, game.carry.fileId).name}. Drop it on free space.`);
      draw();
      return;
    }
    audio.error();
    draw();
    return;
  }
  if (game.state.cells[index].t === 'file') {
    const file = fileById(game.state, game.state.cells[index].f);
    game.carry = { from: index, fileId: file.id };
    setStatus(`Carrying ${file.name}.`);
  } else if (game.state.cells[index].t === 'fixed') setStatus('Unmovable. The head goes around it.');
  else if (game.state.cells[index].t === 'bad') setStatus('Bad sector. Do not put a file here.');
  else setStatus('Free space.');
  draw();
}

function moveHead(dir) {
  if (!game || paused || modal) return;
  wake();
  const cols = game.state.cols;
  const col = game.head % cols;
  const delta = { left: -1, right: 1, up: -cols, down: cols }[dir];
  if (delta == null) return;
  if (dir === 'left' && col === 0) return;
  if (dir === 'right' && col === cols - 1) return;
  const next = game.head + delta;
  if (next < 0 || next >= game.state.cells.length) return;
  game.head = next;
  draw();
}

function useHead() {
  if (!game) return;
  onCell(game.head);
}

function usePower(id) {
  if (!game || paused || modal) return;
  wake();
  if ((game.state.charges[id] || 0) <= 0) return;
  if (id === 'coffee') {
    game.state.charges.coffee -= 1;
    game.coffeeUntil = performance.now() + COFFEE_MS;
    grant('coffee');
    setStatus('Coffee break. The clock is stopped.');
    audio.tick('write');
    renderPowers();
    renderStats();
    return;
  }
  if (id === 'turbo') {
    const under = game.carry?.fileId || game.state.cells[game.head]?.f;
    const file = (under && fileById(game.state, under)) || firstIncomplete(game.state);
    if (!file) return;
    game.state.charges.turbo -= 1;
    const from = game.head;
    packFile(game.state, file.id);
    game.seek += Math.abs(from - (file.home[0] ?? from)) + 1;
    game.head = file.home[file.home.length - 1] ?? game.head;
    game.carry = null;
    grant('turbo');
    noteCombo(file.id);
    setStatus(`Defrag Turbo packed ${file.name}.`);
    afterMove();
    return;
  }
  if (id === 'format') {
    confirmFormat();
  }
}

async function confirmFormat() {
  if (!game || game.state.charges.format <= 0) return;
  paused = true;
  const choice = await openDialog({
    title: 'Quick Format',
    html: '<p>This throws out the free-space map and hopes for the best. It can pack a file, or it can punch a bad sector.</p>',
    buttons: [
      { id: 'go', label: 'Format', primary: true },
      { id: 'no', label: 'Cancel' },
    ],
  });
  paused = false;
  pauseBtn.textContent = paused ? 'Resume' : 'Pause';
  if (choice !== 'go' || !game) return;
  game.state.charges.format -= 1;
  const under = game.carry?.fileId || game.state.cells[game.head]?.f;
  const result = quickFormat(game.state, under, mulberry32((Date.now() ^ game.state.seed) >>> 0));
  game.pass.clear();
  game.carry = null;
  setStatus(result.message);
  if (!result.ok) audio.error();
  else audio.tick('write');
  syncGameHud();
  draw();
  if (isComplete(game.state)) finishGame();
}

function startZen(id) {
  cancelAnimationFrame(raf);
  const spec = zenById(id);
  mode = 'zen';
  game = null;
  zen = createZen(spec, (Date.now() ^ 0xa5a5) >>> 0);
  paused = false;
  finishedCard = false;
  saver = false;
  document.body.classList.remove('is-saver');
  canvas.style.aspectRatio = `${spec.cols} / ${spec.rows}`;
  titleEl.textContent = spec.title;
  setStatus(`${spec.title}…`);
  setProgress(zenRatio(zen));
  setDetails(false);
  filesEl.hidden = true;
  powersEl.hidden = true;
  pauseBtn.textContent = 'Pause';
  showScreen('defrag');
  $('[data-action="saver"]').hidden = false;
  $('[data-action="hint"]').hidden = true;
  audio.unlock();
  audio.startHum();
  lastFrame = performance.now();
  zenAcc = 0;
  loop();
  window.__defrag = api;
}

function startGame(id) {
  cancelAnimationFrame(raf);
  const spec = levelById(id);
  const state = createLevel(spec);
  mode = 'game';
  zen = null;
  audio.stopHum();
  game = {
    state,
    head: 0,
    carry: null,
    hint: null,
    seek: 0,
    moves: 0,
    elapsed: 0,
    combos: 0,
    pass: new Map(),
    lastFile: null,
    fx: [],
    coffeeUntil: 0,
    lastInput: performance.now(),
    restartFired: false,
    scandiskFired: false,
    done: false,
  };
  paused = false;
  finishedCard = false;
  exitSaver();
  canvas.style.aspectRatio = `${state.cols} / ${state.rows}`;
  titleEl.textContent = state.title;
  setStatus('Pack each file into one run at the start of the disk.');
  setDetails(true);
  pauseBtn.textContent = 'Pause';
  $('[data-action="saver"]').hidden = true;
  $('[data-action="hint"]').hidden = false;
  showScreen('defrag');
  syncGameHud();
  audio.unlock();
  lastFrame = performance.now();
  loop();
  window.__defrag = api;
}

function exitSaver() {
  if (!saver) return;
  saver = false;
  document.body.classList.remove('is-saver');
  setDetails(details);
  requestAnimationFrame(layout);
}

function enterSaver() {
  if (mode !== 'zen') return;
  saver = true;
  document.body.classList.add('is-saver');
  grant('saver');
  requestAnimationFrame(layout);
}

function loop(now = performance.now()) {
  const dt = Math.min(100, now - lastFrame || 16);
  lastFrame = now;
  raf = requestAnimationFrame(loop);
  if (mode === 'zen' && zen && !paused && !modal) {
    const stepMs = reduced ? 110 : 36;
    zenAcc += dt;
    let guard = 0;
    while (zenAcc >= stepMs && guard < 4) {
      zenAcc -= stepMs;
      guard += 1;
      const step = zenStep(zen, { reduced });
      ticks += 1;
      playZenSound(step);
      if (step.done) {
        setStatus('Defragmentation complete.');
        setProgress(1);
        if (saver) {
          zenRefragment(zen, mulberry32((Date.now() ^ 0x1234) >>> 0), 0.42);
          setStatus('Screensaver · still going');
        } else if (!finishedCard) {
          finishedCard = true;
          paused = true;
          pauseBtn.textContent = 'Resume';
          audio.stopHum();
          const line = formatResult(zen.spec.sizeLabel, save.zenMs, 1);
          showResult(line, { zen: true, againId: zen.spec.id });
        }
        break;
      }
    }
    if (!modal) maybeZenRestart();
    setProgress(zenRatio(zen));
    save.zenMs += dt;
    if (now - lastPersist > 5000) {
      lastPersist = now;
      persist();
      if (save.zenMs >= 10 * 60 * 1000) grant('stare');
    }
    renderStats();
  }
  if (mode === 'game' && game && !game.done && !paused && !modal) {
    const coffee = now < game.coffeeUntil;
    if (!coffee) game.elapsed += dt;
    if (!coffee && dimEl.hidden && now - game.lastInput > IDLE_MS) {
      dimEl.hidden = false;
    }
    if (game.fx.length) game.fx = game.fx.filter((item) => item.until > now);
    renderStats();
    if (now < game.coffeeUntil) renderPowers();
  }
  if (mode === 'game' && game && !dimEl.hidden && now - game.lastInput <= IDLE_MS) dimEl.hidden = true;
  if ((details || saver) && (mode === 'zen' || mode === 'game')) draw();
}

const api = {
  cols: () => (game ? game.state.cols : zen?.cols || 0),
  rows: () => (game ? game.state.rows : zen?.rows || 0),
  hintMove: () => (game && !game.done ? nextHint(game.state) : null),
  act: (from, to) => playerMove(from, to),
  complete: () => (game ? isComplete(game.state) : false),
  mode: () => mode,
  ticks: () => ticks,
};

function bootLauncher() {
  const select = $('#drive');
  select.replaceChildren();
  for (const drive of ZEN_DRIVES) {
    const option = document.createElement('option');
    option.value = drive.id;
    option.textContent = drive.label;
    select.appendChild(option);
  }
  select.value = '2g';
  const list = $('[data-scores]');
  list.replaceChildren();
  for (const level of LEVELS) {
    const best = save.best[level.id];
    const li = document.createElement('li');
    li.textContent = best
      ? `${level.name}: ${best.score} ${starText(best.stars || 0)}`
      : `${level.name}: no score yet`;
    list.appendChild(li);
  }
  setMute(save.mute);
}

function openAchievements() {
  const items = ACHIEVEMENTS.map((item) => {
    const have = save.achievements.includes(item.id);
    return `<li>${have ? '■' : '□'} ${item.name}${have ? '' : ` — ${item.detail}`}</li>`;
  }).join('');
  openDialog({
    title: 'Achievements',
    html: `<ul class="ach">${items}</ul>`,
    buttons: [{ id: 'ok', label: 'OK', primary: true }],
  });
}

function maybeTutorial() {
  if (save.tutorialSeen) return;
  dialogCard.hidden = true;
  $('#tutorial').hidden = false;
  dialogRoot.hidden = false;
}

function dismissTutorial(choice) {
  save.tutorialSeen = true;
  persist();
  $('#tutorial').hidden = true;
  dialogCard.hidden = true;
  dialogRoot.hidden = true;
  if (choice === 'zen') startZen($('#drive').value);
  if (choice === 'game') startGame('floppy');
}

legendEl.replaceChildren();
for (const item of LEGEND) {
  const li = document.createElement('li');
  const swatch = document.createElement('i');
  swatch.style.background = item.color;
  li.append(swatch, document.createTextNode(item.label));
  legendEl.appendChild(li);
}

document.body.addEventListener('click', (event) => {
  const tutorial = event.target.closest('[data-tutorial]');
  if (tutorial) {
    dismissTutorial(tutorial.dataset.tutorial);
    return;
  }
  const power = event.target.closest('[data-power]');
  if (power) {
    usePower(power.dataset.power);
    return;
  }
  const dir = event.target.closest('[data-dir]');
  if (dir) {
    moveHead(dir.dataset.dir);
    return;
  }
  if (event.target.closest('[data-use]')) {
    useHead();
    return;
  }
  const action = event.target.closest('[data-action]')?.dataset.action;
  if (!action) return;
  if (action === 'start') {
    audio.unlock();
    const drive = $('#drive').value;
    const picked = document.querySelector('input[name="mode"]:checked')?.value || 'zen';
    if (picked === 'game') startGame(drive);
    else startZen(drive);
  } else if (action === 'achievements') openAchievements();
  else if (action === 'help') {
    dialogCard.hidden = true;
    $('#tutorial').hidden = false;
    dialogRoot.hidden = false;
  } else if (action === 'min') setDetails(false);
  else if (action === 'stop' || action === 'close') {
    if (mode === 'zen' && zen && !finishedCard) {
      const line = formatResult(zen.spec.sizeLabel, save.zenMs, zenRatio(zen));
      stopToLauncher();
      showResult(line, { stopped: true });
    } else if (mode === 'game' && game && !game.done) {
      const line = formatResult(game.state.sizeLabel, game.elapsed, contiguity(game.state));
      const score = liveScore();
      stopToLauncher();
      showResult(line, { score, stars: 0, stopped: true });
    } else stopToLauncher();
  } else if (action === 'pause') {
    paused = !paused;
    pauseBtn.textContent = paused ? 'Resume' : 'Pause';
    if (paused) audio.stopHum();
    else if (mode === 'zen') audio.startHum();
  } else if (action === 'details') setDetails(!details);
  else if (action === 'legend') {
    const extra = mode === 'game'
      ? '<p>Each file has its own color until the block sits in its packed place. Then it turns blue.</p>'
      : '<p>Green is the head reading. Yellow is the head writing. Blue stays.</p>';
    openDialog({
      title: 'Legend',
      html: `<ul class="legend pop">${legendEl.innerHTML}</ul>${extra}<p>Arrows or WASD move the head. Space picks up and drops. Drag works. Seek time is the enemy.</p>`,
      buttons: [{ id: 'ok', label: 'OK', primary: true }],
    });
  } else if (action === 'hint' && game) {
    const move = nextHint(game.state);
    if (!move) setStatus('Nothing left to hint.');
    else {
      game.head = move.from;
      game.hint = move.to;
      setStatus('Hint: pick up the marked block and drop it on the outline.');
      draw();
    }
  } else if (action === 'saver') enterSaver();
  else if (action === 'mute') setMute(!save.mute);
});

$('#mute')?.addEventListener('change', (event) => setMute(event.target.checked));

canvas.addEventListener('pointerdown', (event) => {
  audio.unlock();
  if (saver) {
    exitSaver();
    return;
  }
  if (!dimEl.hidden) {
    wake();
    return;
  }
  if (mode !== 'game') return;
  canvas.setPointerCapture(event.pointerId);
  drag = { index: cellFromEvent(event), x: event.clientX, y: event.clientY };
});

canvas.addEventListener('pointerup', (event) => {
  if (!drag || mode !== 'game') {
    drag = null;
    return;
  }
  const index = cellFromEvent(event);
  const moved = Math.hypot(event.clientX - drag.x, event.clientY - drag.y) > 6;
  const from = drag.index;
  drag = null;
  if (from < 0) return;
  if (moved && index >= 0 && index !== from) onCell(from, index);
  else onCell(from);
});

window.addEventListener('keydown', (event) => {
  audio.unlock();
  if (saver && event.key === 'Escape') {
    exitSaver();
    event.preventDefault();
    return;
  }
  if (!dimEl.hidden && mode === 'game') {
    wake();
    event.preventDefault();
    return;
  }
  if (modal && event.key === 'Escape') {
    const buttons = [...dialogActions.querySelectorAll('button')];
    buttons[buttons.length - 1]?.click();
    return;
  }
  if ($('#tutorial') && !$('#tutorial').hidden && event.key === 'Escape') {
    dismissTutorial('later');
    return;
  }
  const key = event.key.toLowerCase();
  if (mode === 'game' && !event.target.closest('input, select, textarea, button')) {
    const dirs = { arrowleft: 'left', arrowright: 'right', arrowup: 'up', arrowdown: 'down', a: 'left', d: 'right', w: 'up', s: 'down' };
    if (dirs[key] || dirs[event.key.toLowerCase()]) {
      moveHead(dirs[event.key.toLowerCase()] || dirs[key]);
      event.preventDefault();
      return;
    }
    if (event.key === ' ' || event.key === 'Enter') {
      useHead();
      event.preventDefault();
      return;
    }
    if (event.key === 'Escape' && game?.carry) {
      game.carry = null;
      draw();
      event.preventDefault();
      return;
    }
  }
  if (event.target.closest('input, textarea, select')) return;
  if (key === 'm') setMute(!save.mute);
  if (key === 'p' && mode) {
    paused = !paused;
    pauseBtn.textContent = paused ? 'Resume' : 'Pause';
  }
  if (key === 'h' && mode === 'game') $('[data-action="hint"]').click();
  if (key === 'f' && mode === 'zen') enterSaver();
});

window.addEventListener('pointerdown', () => audio.unlock());
window.addEventListener('resize', () => {
  if (details || saver) layout();
});
document.addEventListener('visibilitychange', () => {
  if (document.hidden) persist();
});
window.addEventListener('pagehide', persist);

if (typeof ResizeObserver === 'function') {
  const observer = new ResizeObserver(() => {
    if (details || saver) layout();
  });
  observer.observe(canvas);
}

dimEl.addEventListener('pointerdown', (event) => {
  event.preventDefault();
  wake();
});

bootLauncher();
showScreen('launcher');
setMute(save.mute);
window.__defrag = api;
if (!save.tutorialSeen) maybeTutorial();
else dialogRoot.hidden = true;
