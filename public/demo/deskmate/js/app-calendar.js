import { askLine, isoDate } from './util.js';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const DOW = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

let api = null;
let stage = null;
let cursor = new Date();

function storeName() {
  const hit = Object.entries(api.disk.files).find(([, file]) => file.kind === 'cal');
  return hit ? hit[0] : 'CALENDAR.DAT';
}

function items() {
  const file = api.disk.files[storeName()];
  if (file?.kind === 'cal' && file.items && typeof file.items === 'object') return file.items;
  return {};
}

function write(next) {
  const name = storeName();
  api.disk.files[name] = { kind: 'cal', items: next, modified: Date.now() };
  api.persist();
}

function shiftMonth(date, delta) {
  const day = date.getDate();
  const target = new Date(date.getFullYear(), date.getMonth() + delta, 1);
  const dim = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  return new Date(target.getFullYear(), target.getMonth(), Math.min(day, dim));
}

export const calendarApp = {
  title: 'Calendar',
  keys: ['Help', 'Add', 'Delete', 'Today', 'Prev', 'Next', '', '', '', 'Exit'],
  mount(nextStage, nextApi) {
    stage = nextStage;
    api = nextApi;
    this.render();
  },
  destroy() {
    stage = null;
  },
  render() {
    if (!stage) return;
    const year = cursor.getFullYear();
    const month = cursor.getMonth();
    const first = new Date(year, month, 1).getDay();
    const dim = new Date(year, month + 1, 0).getDate();
    const book = items();
    const today = isoDate(new Date());
    const cells = [];
    for (let i = 0; i < first; i += 1) cells.push('<span class="day pad"></span>');
    for (let day = 1; day <= dim; day += 1) {
      const date = new Date(year, month, day);
      const key = isoDate(date);
      const on = key === isoDate(cursor);
      const marks = Array.isArray(book[key]) && book[key].length ? '*' : '';
      const classes = ['day', on ? 'on' : '', key === today ? 'today' : ''].filter(Boolean).join(' ');
      cells.push(`<button type="button" class="${classes}" data-date="${key}">${day}${marks ? `<i>${marks}</i>` : ''}</button>`);
    }
    const notes = book[isoDate(cursor)] || [];
    stage.innerHTML = `<div class="cal">
      <div class="cal-title">${MONTHS[month]} ${year}</div>
      <div class="cal-grid">
        ${DOW.map((name) => `<span class="dow">${name}</span>`).join('')}
        ${cells.join('')}
      </div>
      <div class="cal-notes">${notes.length ? notes.map((note) => `<p>${escapeNote(note)}</p>`).join('') : '<p class="dim">F2 adds an appointment.</p>'}</div>
    </div>`;
    stage.querySelectorAll('[data-date]').forEach((button) => {
      button.addEventListener('click', () => {
        const [y, m, d] = button.dataset.date.split('-').map(Number);
        cursor = new Date(y, m - 1, d);
        this.render();
      });
    });
    const note = notes[0] ? `  ${notes[0]}` : '';
    api.setStatus(`${isoDate(cursor)}${note}`);
  },
  move(days) {
    const next = new Date(cursor);
    next.setDate(next.getDate() + days);
    cursor = next;
    this.render();
  },
  async add() {
    const entered = await askLine(stage, 'Appointment');
    if (entered == null || !entered.trim()) {
      this.render();
      return;
    }
    const book = { ...items() };
    const key = isoDate(cursor);
    const list = Array.isArray(book[key]) ? book[key].slice() : [];
    list.push(entered.trim().slice(0, 60));
    book[key] = list;
    write(book);
    this.render();
    api.setStatus('Noted');
  },
  remove() {
    const book = { ...items() };
    const key = isoDate(cursor);
    const list = Array.isArray(book[key]) ? book[key].slice() : [];
    if (!list.length) {
      api.setStatus('Nothing that day');
      return;
    }
    list.pop();
    if (list.length) book[key] = list;
    else delete book[key];
    write(book);
    this.render();
    api.setStatus('Removed');
  },
  onF(n) {
    if (n === 1) api.help();
    if (n === 2) this.add();
    if (n === 3) this.remove();
    if (n === 4) {
      cursor = new Date();
      this.render();
    }
    if (n === 5) {
      cursor = shiftMonth(cursor, -1);
      this.render();
    }
    if (n === 6) {
      cursor = shiftMonth(cursor, 1);
      this.render();
    }
    if (n === 10) api.exit();
  },
  onKey(event) {
    if (event.key === 'ArrowLeft') this.move(-1);
    if (event.key === 'ArrowRight') this.move(1);
    if (event.key === 'ArrowUp') this.move(-7);
    if (event.key === 'ArrowDown') this.move(7);
    if (event.key === 'Escape') api.exit();
  },
};

function escapeNote(value) {
  return String(value).replace(/[&<>]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[ch]);
}
