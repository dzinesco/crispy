import { appIcon } from './icons.js';
import { beep } from './audio.js';

export const APPS = [
  { id: 'text', name: 'Text' },
  { id: 'sheet', name: 'Worksheet' },
  { id: 'filer', name: 'Filer' },
  { id: 'telecom', name: 'Telecom' },
  { id: 'calendar', name: 'Calendar' },
  { id: 'paint', name: 'Paint' },
  { id: 'music', name: 'Music' },
  { id: 'calc', name: 'Calculator' },
];

let selected = 0;
let api = null;
let root = null;

function paint() {
  if (!root) return;
  root.querySelectorAll('[data-app-icon]').forEach((button, index) => {
    const on = index === selected;
    button.classList.toggle('selected', on);
    if (on) button.setAttribute('data-selected', 'true');
    else button.removeAttribute('data-selected');
  });
  api?.setStatus(`${APPS[selected].name}  -  Enter opens`);
}

export function nudge(dx, dy) {
  const col = selected % 4;
  const row = Math.floor(selected / 4);
  const nextCol = Math.max(0, Math.min(3, col + dx));
  const nextRow = Math.max(0, Math.min(1, row + dy));
  const next = nextRow * 4 + nextCol;
  if (next === selected) return;
  selected = next;
  paint();
  beep(180, 0.02);
}

export function openSelected() {
  api?.show(APPS[selected].id);
}

export const desktopApp = {
  title: 'DeskMate',
  keys: ['Help', 'Open', 'Info', '', '', '', 'Lines', '', '', 'Boot'],
  mount(stage, nextApi) {
    api = nextApi;
    root = stage;
    stage.innerHTML = `<div class="desk">${APPS.map((app) => `
      <button type="button" class="icon" data-app-icon="${app.id}">
        <span class="art">${appIcon(app.id)}</span>
        <span class="name">${app.name}</span>
      </button>`).join('')}</div>`;
    stage.querySelectorAll('[data-app-icon]').forEach((button, index) => {
      button.addEventListener('click', () => {
        if (selected === index) openSelected();
        else {
          selected = index;
          paint();
        }
      });
    });
    paint();
  },
  destroy() {
    root = null;
  },
  onF(n) {
    if (n === 1) api.help();
    if (n === 2) openSelected();
    if (n === 3) api.show('about');
    if (n === 7) api.toggleScan();
    if (n === 10) api.reboot();
  },
  onKey(event) {
    if (event.key === 'ArrowLeft') nudge(-1, 0);
    if (event.key === 'ArrowRight') nudge(1, 0);
    if (event.key === 'ArrowUp') nudge(0, -1);
    if (event.key === 'ArrowDown') nudge(0, 1);
    if (event.key === 'Home') {
      selected = 0;
      paint();
    }
    if (event.key === 'End') {
      selected = APPS.length - 1;
      paint();
    }
    if (event.key === 'Enter') openSelected();
  },
};
