import { formatNumber } from './formula.js';

let api = null;
let stage = null;
let entry = '0';
let acc = null;
let pending = null;
let fresh = false;

function paint() {
  const display = stage?.querySelector('[data-calc-display]');
  if (display) display.textContent = entry;
}

function resetEntry(next) {
  entry = next;
  fresh = false;
}

function apply(op, a, b) {
  if (op === '+') return a + b;
  if (op === '-') return a - b;
  if (op === '*') return a * b;
  if (op === '/') {
    if (b === 0) return NaN;
    return a / b;
  }
  return b;
}

function fail() {
  entry = 'ERR';
  acc = null;
  pending = null;
  fresh = true;
  paint();
}

export const calcApp = {
  title: 'Calculator',
  keys: ['Help', 'Clear', '', '', '', '', '', '', '', 'Exit'],
  mount(nextStage, nextApi) {
    stage = nextStage;
    api = nextApi;
    stage.innerHTML = `<div class="calc"><div class="calc-box">
      <div class="calc-display" data-calc-display>0</div>
      <div class="calc-keys">
        ${['7', '8', '9', '/', '4', '5', '6', '*', '1', '2', '3', '-', '0', '.', '+', '='].map((key) => {
          const op = '/+-*='.includes(key);
          return `<button type="button" class="${op ? 'op' : ''}" data-key="${key}">${key}</button>`;
        }).join('')}
        <button type="button" class="op wide" data-key="C">C</button>
      </div>
    </div></div>`;
    stage.querySelectorAll('[data-key]').forEach((button) => {
      button.addEventListener('click', () => this.press(button.dataset.key));
    });
    paint();
    api.setStatus('F2 clears');
  },
  destroy() {
    stage = null;
  },
  clear() {
    entry = '0';
    acc = null;
    pending = null;
    fresh = false;
    paint();
  },
  press(key) {
    if (entry === 'ERR' && key !== 'C') {
      entry = '0';
      fresh = false;
    }
    if (key === 'C') {
      this.clear();
      return;
    }
    if (/\d/.test(key)) {
      if (fresh || entry === '0') resetEntry(key);
      else if (entry.length < 12) entry += key;
      fresh = false;
      paint();
      return;
    }
    if (key === '.') {
      if (fresh) resetEntry('0.');
      else if (!entry.includes('.')) entry += '.';
      fresh = false;
      paint();
      return;
    }
    if ('+-*/'.includes(key)) {
      const value = Number(entry);
      if (acc == null || fresh) acc = value;
      else acc = apply(pending, acc, value);
      if (!Number.isFinite(acc)) {
        fail();
        return;
      }
      pending = key;
      entry = formatNumber(acc);
      fresh = true;
      paint();
      return;
    }
    if (key === '=') {
      if (!pending) return;
      const value = Number(entry);
      acc = apply(pending, acc, value);
      pending = null;
      if (!Number.isFinite(acc)) {
        fail();
        return;
      }
      entry = formatNumber(acc);
      fresh = true;
      paint();
    }
  },
  onF(n) {
    if (n === 1) api.help();
    if (n === 2) this.clear();
    if (n === 10) api.exit();
  },
  onKey(event) {
    if (event.key === 'Escape') {
      api.exit();
      return;
    }
    if (event.key === 'Enter') {
      this.press('=');
      return;
    }
    if (event.key === 'Backspace') {
      if (fresh || entry === 'ERR') return;
      entry = entry.slice(0, -1) || '0';
      paint();
      return;
    }
    const key = event.key === 'x' || event.key === 'X' ? '*' : event.key;
    if (/^[0-9.+\-*/=]$/.test(key) || key === 'c' || key === 'C') {
      this.press(key === 'c' ? 'C' : key);
    }
  },
};
