import { beep, freqOf, invalidate, tone } from './audio.js';
import { askLine, cleanName, wait } from './util.js';

const WHITE = ['C', 'D', 'E', 'F', 'G', 'A', 'B', 'C'];
const BLACK = [
  { note: 'C#', col: 2 },
  { note: 'D#', col: 4 },
  { note: 'F#', col: 7 },
  { note: 'G#', col: 9 },
  { note: 'A#', col: 11 },
];
const LETTERS = {
  a: ['C', 0],
  w: ['C#', 0],
  s: ['D', 0],
  e: ['D#', 0],
  d: ['E', 0],
  f: ['F', 0],
  t: ['F#', 0],
  g: ['G', 0],
  y: ['G#', 0],
  h: ['A', 0],
  u: ['A#', 0],
  j: ['B', 0],
  k: ['C', 1],
};

let api = null;
let stage = null;
let name = '';
let steps = ['C4', 'E4', 'G4', 'C5', '', 'G4', 'E4', 'C4', '', '', '', '', '', '', '', ''];
let cursor = 0;
let octave = 4;
let playing = 0;

function pad(stepsIn) {
  const next = stepsIn.slice(0, 16);
  while (next.length < 16) next.push('');
  return next;
}

export const musicApp = {
  title: 'Music',
  keys: ['Help', 'Play', 'Stop', 'Save', 'Oct-', 'Oct+', 'Load', 'Clear', '', 'Exit'],
  open(filename, next) {
    name = filename || '';
    steps = pad(Array.isArray(next) ? next.map((note) => String(note || '')) : []);
    cursor = 0;
  },
  mount(nextStage, nextApi) {
    stage = nextStage;
    api = nextApi;
    const whites = WHITE.map((note, index) => {
      const label = index === 7 ? 'C' : note;
      return `<button type="button" class="key white" data-pitch="${label}" data-jump="${index === 7 ? 1 : 0}">${label}</button>`;
    }).join('');
    const blacks = BLACK.map((key) => `<button type="button" class="key black" style="grid-column:${key.col}" data-pitch="${key.note}" data-jump="0">${key.note}</button>`).join('');
    stage.innerHTML = `<div class="music">
      <div class="pattern" data-pattern></div>
      <p class="hint">A W S E D F T G Y H U J K</p>
      <div class="piano">
        <div class="blacks">${blacks}</div>
        <div class="whites">${whites}</div>
      </div>
    </div>`;
    stage.querySelectorAll('[data-pitch]').forEach((button) => {
      button.addEventListener('click', () => {
        this.strike(`${button.dataset.pitch}${octave + Number(button.dataset.jump)}`);
      });
    });
    stage.querySelector('[data-pattern]').addEventListener('click', (event) => {
      const row = event.target.closest('[data-step]');
      if (!row) return;
      cursor = Number(row.dataset.step);
      this.paint();
    });
    this.paint();
    api.setStatus(`Octave ${octave}. F2 plays.`);
  },
  destroy() {
    playing += 1;
    invalidate();
    stage = null;
  },
  paint() {
    const box = stage?.querySelector('[data-pattern]');
    if (!box) return;
    box.innerHTML = steps.map((note, index) => (
      `<button type="button" class="step${index === cursor ? ' on' : ''}" data-step="${index}">${String(index + 1).padStart(2, '0')}  ${note || '---'}</button>`
    )).join('');
  },
  strike(note) {
    const freq = freqOf(note);
    if (!freq) return;
    tone([freq], 0.18, 'square', 0.05);
    steps[cursor] = note;
    cursor = (cursor + 1) % steps.length;
    this.paint();
    api.setStatus(note);
  },
  async play() {
    const token = playing + 1;
    playing = token;
    invalidate();
    for (let index = 0; index < steps.length; index += 1) {
      if (playing !== token) return;
      cursor = index;
      this.paint();
      const freq = freqOf(steps[index]);
      if (freq) tone([freq], 0.16, 'square', 0.05);
      await wait(180);
    }
    if (playing === token) api.setStatus('Done');
  },
  stop() {
    playing += 1;
    invalidate();
    api.setStatus('Stopped');
  },
  async save() {
    let filename = name;
    if (!filename) {
      const entered = await askLine(stage, 'Save as', { value: 'TUNE.MUS', save: true });
      if (entered == null) return;
      filename = cleanName(entered);
      if (!filename) {
        api.setStatus('Use a short name like TUNE.MUS');
        return;
      }
    }
    api.disk.files[filename] = { kind: 'music', steps: steps.slice(), modified: Date.now() };
    if (!api.persist()) return;
    name = filename;
    api.setStatus(`Saved ${filename}`);
  },
  tunes() {
    return Object.entries(api.disk.files)
      .filter(([, file]) => file.kind === 'music')
      .sort(([a], [b]) => a.localeCompare(b));
  },
  loadFirst() {
    const files = this.tunes();
    if (!files.length) {
      api.setStatus('No tunes on A:');
      return;
    }
    this.open(files[0][0], files[0][1].steps || []);
    this.paint();
    api.setStatus(`Loaded ${files[0][0]}`);
  },
  onF(n) {
    if (n === 1) api.help();
    if (n === 2) this.play();
    if (n === 3) this.stop();
    if (n === 4) this.save();
    if (n === 5) {
      octave = Math.max(2, octave - 1);
      api.setStatus(`Octave ${octave}`);
    }
    if (n === 6) {
      octave = Math.min(6, octave + 1);
      api.setStatus(`Octave ${octave}`);
    }
    if (n === 7) this.loadFirst();
    if (n === 8) {
      steps = pad([]);
      cursor = 0;
      this.paint();
      beep(120, 0.04);
    }
    if (n === 10) api.exit();
  },
  onKey(event) {
    if (event.key === 'ArrowUp') cursor = Math.max(0, cursor - 1);
    if (event.key === 'ArrowDown') cursor = Math.min(steps.length - 1, cursor + 1);
    if (event.key === 'Backspace' || event.key === 'Delete') {
      steps[cursor] = '';
      this.paint();
      return;
    }
    if (event.key === 'Escape') {
      api.exit();
      return;
    }
    const letter = LETTERS[event.key.toLowerCase()];
    if (letter && !event.altKey && !event.ctrlKey && !event.metaKey && event.key.length === 1) {
      this.strike(`${letter[0]}${octave + letter[1]}`);
      return;
    }
    if (event.key === 'ArrowUp' || event.key === 'ArrowDown') this.paint();
  },
};
