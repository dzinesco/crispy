import { present } from './formula.js';
import { askLine, cleanName } from './util.js';

const COLS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
const ROWS = 10;

let name = '';
let cells = {};
let cursor = 'A1';
let editing = false;
let draft = '';
let caret = 0;
let api = null;
let stage = null;
let listing = false;
let listIndex = 0;

function colOf(addr) {
  return addr[0];
}

function rowOf(addr) {
  return Number(addr.slice(1));
}

export const sheetApp = {
  title: 'Worksheet',
  keys: ['Help', 'Save', 'Load', 'Recalc', 'Sum', 'Clear', '', '', '', 'Exit'],
  open(filename, next) {
    name = filename || '';
    cells = {};
    for (const [key, value] of Object.entries(next || {})) cells[key] = String(value);
    cursor = 'A1';
    editing = false;
    listing = false;
  },
  mount(nextStage, nextApi) {
    stage = nextStage;
    api = nextApi;
    listing = false;
    this.grid();
  },
  destroy() {
    if (editing) this.commit(false);
    stage = null;
  },
  grid() {
    listing = false;
    api.setKeys(this.keys);
    const head = COLS.map((col) => `<th>${col}</th>`).join('');
    const body = [];
    for (let row = 1; row <= ROWS; row += 1) {
      const tds = COLS.map((col) => `<td data-cell="${col}${row}"></td>`).join('');
      body.push(`<tr><th data-row="${row}">${row}</th>${tds}</tr>`);
    }
    stage.innerHTML = `<div class="sheet">
      <div class="formula"><span data-addr></span><span data-formula></span></div>
      <div class="gridwrap"><table>
        <thead><tr><th></th>${head}</tr></thead>
        <tbody>${body.join('')}</tbody>
      </table></div>
    </div>`;
    stage.querySelectorAll('[data-cell]').forEach((cell) => {
      cell.addEventListener('click', () => this.select(cell.dataset.cell));
    });
    this.refresh();
    api.setStatus(name ? `A: ${name}` : 'Type a number or =SUM(A1:A4)');
  },
  refresh() {
    if (!stage || listing) return;
    for (let row = 1; row <= ROWS; row += 1) {
      for (const col of COLS) {
        const addr = col + row;
        const cell = stage.querySelector(`[data-cell="${addr}"]`);
        if (!cell) continue;
        const shown = present(cells[addr], addr, cells);
        cell.textContent = shown;
        cell.classList.toggle('on', addr === cursor);
        cell.classList.toggle('err', shown === 'ERR');
        cell.classList.toggle('num', shown !== '' && shown !== 'ERR' && /^-?\d/.test(shown));
      }
      const label = stage.querySelector(`[data-row="${row}"]`);
      if (label) label.classList.toggle('on', row === rowOf(cursor));
    }
    stage.querySelectorAll('thead th').forEach((th, index) => {
      if (index === 0) return;
      th.classList.toggle('on', COLS[index - 1] === colOf(cursor));
    });
    this.paintFormula();
  },
  paintFormula() {
    const addr = stage?.querySelector('[data-addr]');
    const formula = stage?.querySelector('[data-formula]');
    if (!addr || !formula) return;
    addr.textContent = cursor;
    if (!editing) {
      formula.textContent = cells[cursor] ?? '';
      return;
    }
    formula.innerHTML = `${escapeDraft(draft.slice(0, caret))}<span class="block"></span>${escapeDraft(draft.slice(caret))}`;
  },
  select(addr) {
    if (editing) this.commit(false);
    cursor = addr;
    this.refresh();
  },
  commit(moveDown) {
    const value = draft.trim();
    if (!value) delete cells[cursor];
    else cells[cursor] = value;
    editing = false;
    if (moveDown) this.move(0, 1);
    else this.refresh();
  },
  move(dx, dy) {
    const col = Math.max(0, Math.min(COLS.length - 1, COLS.indexOf(colOf(cursor)) + dx));
    const row = Math.max(1, Math.min(ROWS, rowOf(cursor) + dy));
    cursor = COLS[col] + row;
    this.refresh();
  },
  sheetFiles() {
    return Object.entries(api.disk.files)
      .filter(([, file]) => file.kind === 'sheet')
      .sort(([a], [b]) => a.localeCompare(b));
  },
  async save() {
    if (editing) this.commit(false);
    let filename = name;
    if (!filename) {
      const entered = await askLine(stage, 'Save as', { value: 'SHEET.WKS', save: true });
      if (entered == null) return;
      filename = cleanName(entered);
      if (!filename) {
        api.setStatus('Use a short name like SHEET.WKS');
        return;
      }
    }
    api.disk.files[filename] = { kind: 'sheet', cells: { ...cells }, modified: Date.now() };
    if (!api.persist()) return;
    name = filename;
    api.setStatus(`Saved ${filename}`);
  },
  showLoad() {
    if (editing) this.commit(false);
    const files = this.sheetFiles();
    listing = true;
    listIndex = 0;
    api.setKeys(['Help', '', 'Open', '', '', '', '', '', '', 'Back']);
    if (!files.length) {
      stage.innerHTML = `<div class="doc"><h2>LOAD</h2><p>No worksheets on A:.</p></div>`;
      return;
    }
    stage.innerHTML = `<div class="list"><div class="list-head">Worksheets on A:</div><div class="list-rows">${
      files.map(([filename], index) => `<button type="button" class="row${index === 0 ? ' on' : ''}" data-file="${filename}">${filename}</button>`).join('')
    }</div></div>`;
    stage.querySelectorAll('[data-file]').forEach((button, index) => {
      button.addEventListener('click', () => {
        if (listIndex === index) this.loadIndex();
        else {
          listIndex = index;
          this.paintList();
        }
      });
    });
    api.setStatus('Enter loads. Esc returns.');
  },
  paintList() {
    stage.querySelectorAll('[data-file]').forEach((button, index) => {
      button.classList.toggle('on', index === listIndex);
    });
  },
  loadIndex() {
    const hit = this.sheetFiles()[listIndex];
    if (!hit) return;
    this.open(hit[0], hit[1].cells || {});
    this.grid();
    api.setStatus(`Loaded ${hit[0]}`);
  },
  onF(n) {
    if (n === 1) api.help();
    if (n === 2 && !listing) this.save();
    if (n === 3) {
      if (listing) this.loadIndex();
      else this.showLoad();
    }
    if (n === 4 && !listing) {
      this.refresh();
      api.setStatus('Recalculated');
    }
    if (n === 5 && !listing) {
      editing = true;
      draft = '=SUM()';
      caret = 5;
      this.paintFormula();
      api.setStatus('Type a range, then Enter');
    }
    if (n === 6 && !listing) {
      editing = false;
      delete cells[cursor];
      this.refresh();
    }
    if (n === 10) {
      if (listing) this.grid();
      else api.exit();
    }
  },
  onKey(event) {
    if (listing) {
      const count = this.sheetFiles().length;
      if (event.key === 'ArrowDown') listIndex = Math.min(count - 1, listIndex + 1);
      if (event.key === 'ArrowUp') listIndex = Math.max(0, listIndex - 1);
      if (event.key === 'Enter') this.loadIndex();
      if (event.key === 'Escape') this.grid();
      this.paintList();
      return;
    }
    if (editing) {
      if (event.key === 'Enter') {
        this.commit(true);
        return;
      }
      if (event.key === 'Escape') {
        editing = false;
        this.refresh();
        return;
      }
      if (event.key === 'Backspace') {
        if (caret > 0) {
          draft = draft.slice(0, caret - 1) + draft.slice(caret);
          caret -= 1;
          this.paintFormula();
        }
        return;
      }
      if (event.key === 'ArrowLeft') {
        caret = Math.max(0, caret - 1);
        this.paintFormula();
        return;
      }
      if (event.key === 'ArrowRight') {
        caret = Math.min(draft.length, caret + 1);
        this.paintFormula();
        return;
      }
      if (event.key === 'ArrowUp') {
        this.commit(false);
        this.move(0, -1);
        return;
      }
      if (event.key === 'ArrowDown') {
        this.commit(false);
        this.move(0, 1);
        return;
      }
      if (event.key === 'Home') {
        caret = 0;
        this.paintFormula();
        return;
      }
      if (event.key === 'End') {
        caret = draft.length;
        this.paintFormula();
        return;
      }
      if (event.key.length === 1 && !event.altKey && !event.ctrlKey && !event.metaKey) {
        draft = draft.slice(0, caret) + event.key + draft.slice(caret);
        caret += 1;
        this.paintFormula();
      }
      return;
    }
    if (event.key === 'ArrowLeft') this.move(-1, 0);
    if (event.key === 'ArrowRight') this.move(1, 0);
    if (event.key === 'ArrowUp') this.move(0, -1);
    if (event.key === 'ArrowDown') this.move(0, 1);
    if (event.key === 'Enter') {
      editing = true;
      draft = cells[cursor] ?? '';
      caret = draft.length;
      this.paintFormula();
      return;
    }
    if (event.key === 'Escape') {
      api.exit();
      return;
    }
    if (event.key === 'Backspace' || event.key === 'Delete') {
      delete cells[cursor];
      this.refresh();
      return;
    }
    if (event.key.length === 1 && !event.altKey && !event.ctrlKey && !event.metaKey) {
      editing = true;
      draft = event.key;
      caret = 1;
      this.paintFormula();
    }
  },
};

function escapeDraft(value) {
  return String(value).replace(/[&<>]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[ch]);
}
