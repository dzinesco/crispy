import { aboutApp, helpApp } from './app-help.js';
import { calcApp } from './app-calc.js';
import { calendarApp } from './app-calendar.js';
import { desktopApp } from './app-desktop.js';
import { filerApp } from './app-filer.js';
import { musicApp } from './app-music.js';
import { paintApp } from './app-paint.js';
import { sheetApp } from './app-sheet.js';
import { telecomApp } from './app-telecom.js';
import { textApp } from './app-text.js';
import { beep, unlock } from './audio.js';
import { loadDisk, saveDisk } from './disk.js';
import { goatSvg } from './icons.js';
import { esc, formatClock } from './util.js';

const registry = {
  desktop: desktopApp,
  text: textApp,
  sheet: sheetApp,
  filer: filerApp,
  telecom: telecomApp,
  calendar: calendarApp,
  paint: paintApp,
  music: musicApp,
  calc: calcApp,
  help: helpApp,
  about: aboutApp,
};

const disk = loadDisk();
const screen = document.getElementById('screen');
const boot = document.getElementById('boot');
const os = document.getElementById('os');
const intro = document.getElementById('intro');
const stageEl = document.getElementById('stage');
const fkeys = document.getElementById('fkeys');
const touchkeys = document.getElementById('touchkeys');
const titleName = document.getElementById('title-name');
const clock = document.getElementById('title-clock');
const statusEl = document.getElementById('status');
const memory = document.querySelector('[data-memory]');
const ready = document.querySelector('[data-boot-ready]');

let current = null;
let keySig = '';
let booting = true;
let replaying = false;
let timer = 0;

const api = {
  disk,
  persist,
  show,
  help,
  exit,
  setStatus,
  setKeys,
  toggleScan,
  reboot,
  openFile,
};

function persist() {
  if (!saveDisk(disk)) {
    setStatus('Disk full');
    return false;
  }
  return true;
}

function setStatus(text) {
  if (statusEl) statusEl.textContent = text;
}

function setTitle(text) {
  titleName.textContent = text;
}

function setKeys(labels) {
  const next = labels.join('\0');
  if (next === keySig) return;
  keySig = next;
  paintKeys(fkeys, labels);
  paintKeys(touchkeys, labels);
  if (document.body.classList.contains('show-touch')) fit();
}

function paintKeys(nav, labels) {
  nav.innerHTML = labels.map((label, index) => {
    const n = index + 1;
    const name = label || '-';
    return `<button type="button" data-fkey="${n}"${label ? '' : ' disabled'} aria-label="F${n} ${esc(label)}"><kbd>F${n}</kbd><span>${esc(name)}</span></button>`;
  }).join('');
}

function show(id, arg) {
  current?.destroy?.();
  current = registry[id] || desktopApp;
  stageEl.dataset.view = current === desktopApp ? 'desktop' : id;
  if (id !== 'help') delete stageEl.dataset.helpPage;
  stageEl.replaceChildren();
  setTitle(current.title || 'DeskMate');
  keySig = '';
  setKeys(current.keys || []);
  current.mount(stageEl, api, arg);
}

function help() {
  const from = stageEl.dataset.view || 'desktop';
  if (from === 'help') {
    helpApp.toggle();
    return;
  }
  show('help', { from, reset: true });
}

function exit() {
  show('desktop');
}

function reboot() {
  startBoot(true);
}

function toggleScan() {
  disk.scanlines = !disk.scanlines;
  screen.classList.toggle('scanlines', disk.scanlines);
  persist();
  setStatus(disk.scanlines ? 'Scanlines on' : 'Scanlines off');
}

function openFile(filename) {
  const file = disk.files[filename];
  if (!file) return;
  if (file.kind === 'text') {
    textApp.open(filename, file.text || '');
    show('text');
    return;
  }
  if (file.kind === 'sheet') {
    sheetApp.open(filename, file.cells || {});
    show('sheet');
    return;
  }
  if (file.kind === 'paint') {
    paintApp.open(filename, file.data || '');
    show('paint');
    return;
  }
  if (file.kind === 'music') {
    musicApp.open(filename, file.steps || []);
    show('music');
    return;
  }
  if (file.kind === 'cal') {
    show('calendar');
    return;
  }
  setStatus('Cannot open that');
}

function dismissIntro() {
  if (intro.hidden) return;
  intro.hidden = true;
  disk.seen = true;
  persist();
  if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
}

function fireF(n) {
  if (!intro.hidden) {
    if (n === 1) {
      dismissIntro();
      help();
    }
    return;
  }
  if (document.querySelector('.ask')) return;
  current?.onF?.(n);
}

function fKey(event) {
  if (event.altKey && !event.ctrlKey && !event.metaKey) {
    const digits = {
      Digit1: 1, Digit2: 2, Digit3: 3, Digit4: 4, Digit5: 5,
      Digit6: 6, Digit7: 7, Digit8: 8, Digit9: 9, Digit0: 10,
    };
    if (digits[event.code]) return digits[event.code];
  }
  if (event.altKey || event.ctrlKey || event.metaKey) return 0;
  const match = /^F(10|[1-9])$/.exec(event.key);
  return match ? Number(match[1]) : 0;
}

function onKey(event) {
  unlock();
  if (booting) {
    event.preventDefault();
    leaveBoot();
    return;
  }
  const fn = fKey(event);
  if (fn) {
    event.preventDefault();
    if (event.repeat) return;
    if (event.target.closest?.('.ask')) return;
    fireF(fn);
    return;
  }
  if (event.altKey && !event.ctrlKey && !event.metaKey && event.code === 'KeyL') {
    event.preventDefault();
    toggleScan();
    return;
  }
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
    event.preventDefault();
    if (!document.querySelector('.ask')) current?.save?.();
    return;
  }
  if (event.target.closest?.('.ask')) return;
  if (!intro.hidden) {
    if (event.key === 'Enter' || event.key === 'Escape') {
      event.preventDefault();
      dismissIntro();
    }
    return;
  }
  const typing = Boolean(event.target?.matches?.('input, textarea'));
  if (!typing && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Home', 'End', ' '].includes(event.key)) {
    event.preventDefault();
  }
  if (!typing && event.key === 'Enter') {
    event.preventDefault();
    const button = event.target?.closest?.('[data-fkey]');
    if (button && !button.disabled) {
      fireF(Number(button.dataset.fkey));
      return;
    }
  }
  current?.onKey?.(event);
}

function arm() {
  memory.textContent = '655360 bytes';
  ready.hidden = false;
}

function runCounter() {
  window.clearInterval(timer);
  const marks = [65536, 131072, 196608, 262144, 327680, 393216, 458752, 524288, 589824, 655360];
  let index = 0;
  memory.textContent = '0 bytes';
  ready.hidden = true;
  timer = window.setInterval(() => {
    if (index >= marks.length) {
      window.clearInterval(timer);
      arm();
      return;
    }
    memory.textContent = `${marks[index]} bytes`;
    index += 1;
    if (index >= marks.length) {
      window.clearInterval(timer);
      arm();
    }
  }, 70);
}

function startBoot(replay) {
  replaying = Boolean(replay);
  booting = true;
  boot.hidden = false;
  os.hidden = true;
  intro.hidden = true;
  if (document.documentElement.classList.contains('reduce-motion')) arm();
  else runCounter();
}

function leaveBoot() {
  if (!booting) return;
  booting = false;
  window.clearInterval(timer);
  memory.textContent = '655360 bytes';
  boot.hidden = true;
  os.hidden = false;
  unlock();
  show('desktop');
  beep(523, 0.05);
  if (!replaying && !disk.seen) {
    intro.hidden = false;
    intro.querySelector('[data-dismiss-intro]')?.focus();
  }
}

function fit() {
  const narrow = window.innerWidth < 860;
  document.body.classList.toggle('show-touch', narrow);
  const bar = narrow ? touchkeys.offsetHeight : 0;
  const vw = document.documentElement.clientWidth;
  const vh = document.documentElement.clientHeight;
  const frame = 20;
  let cell = Math.floor(Math.min((vw - frame) / 80, (vh - bar - frame) / 25));
  if (narrow) cell = Math.max(cell, 8);
  cell = Math.max(4, cell);
  document.documentElement.style.setProperty('--cell', `${cell}px`);
}

function tick() {
  clock.textContent = formatClock(new Date());
}

document.querySelector('[data-goat]').innerHTML = goatSvg();
if (disk.scanlines) screen.classList.add('scanlines');
fkeys.addEventListener('click', (event) => {
  const button = event.target.closest('[data-fkey]');
  if (!button || button.disabled) return;
  fireF(Number(button.dataset.fkey));
});
touchkeys.addEventListener('click', (event) => {
  const button = event.target.closest('[data-fkey]');
  if (!button || button.disabled) return;
  fireF(Number(button.dataset.fkey));
});
intro.querySelector('[data-dismiss-intro]').addEventListener('click', dismissIntro);
boot.addEventListener('pointerdown', () => {
  if (booting) leaveBoot();
});
window.addEventListener('keydown', onKey, true);
window.addEventListener('pointerdown', () => unlock());
window.addEventListener('resize', fit);
window.visualViewport?.addEventListener('resize', fit);
tick();
window.setInterval(tick, 1000);
fit();
startBoot(false);
