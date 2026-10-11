import { esc, prefersReducedMotion } from './util.js';
import { icon } from './icons.js';
import { play } from './audio.js';

const EXTENSIONS = [
  { name: 'Appearance', icon: 'controls' },
  { name: 'Timepiece', icon: 'notepad' },
  { name: 'GoatSound', icon: 'scrapbook' },
  { name: 'Keys', icon: 'calculator' },
  { name: 'Memory', icon: 'system' },
  { name: 'Colors', icon: 'paint' },
  { name: 'Finder', icon: 'folder' },
  { name: 'Crispy', icon: 'hd' },
];

let timer = 0;
let playing = false;

export function boot() {
  const el = document.getElementById('startup');
  if (prefersReducedMotion()) {
    el.hidden = true;
    el.dataset.ready = 'skip';
    return;
  }
  run();
}

export function replayBoot() {
  if (prefersReducedMotion()) {
    play('startup');
    return;
  }
  window.clearInterval(timer);
  playing = false;
  const el = document.getElementById('startup');
  el.hidden = false;
  el.classList.remove('done');
  run();
}

function run() {
  if (playing) return;
  playing = true;
  const el = document.getElementById('startup');
  const bar = document.getElementById('boot-bar');
  const sub = document.getElementById('boot-sub');
  const ext = document.getElementById('boot-ext');
  ext.innerHTML = '';
  bar.style.width = '0%';
  sub.textContent = 'Starting up…';
  el.hidden = false;
  el.dataset.ready = '1';
  let shown = 0;
  const started = performance.now();
  const finish = () => {
    if (!playing) return;
    playing = false;
    window.clearInterval(timer);
    el.hidden = true;
    play('startup');
  };
  el.onclick = (event) => {
    event.preventDefault();
    finish();
  };
  timer = window.setInterval(() => {
    const t = (performance.now() - started) / 3400;
    bar.style.width = `${Math.min(100, t * 100)}%`;
    const due = Math.min(EXTENSIONS.length, Math.floor(t * (EXTENSIONS.length + 0.2)));
    while (shown < due) {
      const item = EXTENSIONS[shown];
      shown += 1;
      const node = document.createElement('div');
      node.className = 'ext';
      node.innerHTML = `${icon(item.icon)}<span>${esc(item.name)}</span>`;
      ext.appendChild(node);
      sub.textContent = item.name;
    }
    if (t >= 1) finish();
  }, 40);
}
