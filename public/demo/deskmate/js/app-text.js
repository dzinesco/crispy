import { askLine, cleanName } from './util.js';

let name = '';
let body = '';
let clean = '';
let api = null;
let stage = null;
let listing = false;
let listIndex = 0;

function dirty() {
  return body !== clean;
}

function caretOf(textarea) {
  const pos = textarea.selectionStart || 0;
  const lines = textarea.value.slice(0, pos).split('\n');
  return { line: lines.length, col: lines[lines.length - 1].length + 1 };
}

function status() {
  const textarea = stage?.querySelector('[data-editor]');
  const label = name || '(untitled)';
  const mark = dirty() ? '*' : '';
  if (!textarea) {
    api?.setStatus(`A: ${label}${mark}`);
    return;
  }
  const caret = caretOf(textarea);
  api?.setStatus(`A: ${label}${mark}   Ln ${caret.line} Col ${caret.col}`);
}

function textFiles() {
  return Object.entries(api.disk.files)
    .filter(([, file]) => file.kind === 'text')
    .sort(([a], [b]) => a.localeCompare(b));
}

function readBody() {
  const textarea = stage?.querySelector('[data-editor]');
  if (textarea) body = textarea.value;
}

export const textApp = {
  title: 'Text',
  keys: ['Help', 'Save', 'Load', 'New', '', '', '', '', '', 'Exit'],
  open(filename, text) {
    name = filename || '';
    body = String(text || '');
    clean = body;
    listing = false;
  },
  mount(nextStage, nextApi) {
    stage = nextStage;
    api = nextApi;
    listing = false;
    this.editor();
  },
  destroy() {
    readBody();
    stage = null;
  },
  editor() {
    listing = false;
    api.setKeys(this.keys);
    stage.innerHTML = `<div class="text-app"><textarea data-editor wrap="off" spellcheck="false" aria-label="Text"></textarea></div>`;
    const textarea = stage.querySelector('[data-editor]');
    textarea.value = body;
    const sync = () => {
      body = textarea.value;
      status();
    };
    textarea.addEventListener('input', sync);
    textarea.addEventListener('keyup', sync);
    textarea.addEventListener('click', sync);
    textarea.focus();
    status();
  },
  async save() {
    readBody();
    let filename = name;
    if (!filename) {
      const entered = await askLine(stage, 'Save as', { value: 'NOTES.TXT', save: true });
      if (entered == null) {
        status();
        return;
      }
      filename = cleanName(entered);
      if (!filename) {
        api.setStatus('Use a short name like NOTES.TXT');
        return;
      }
    }
    api.disk.files[filename] = { kind: 'text', text: body, modified: Date.now() };
    if (!api.persist()) return;
    name = filename;
    clean = body;
    api.setStatus(`Saved ${filename}`);
    status();
  },
  showLoad() {
    readBody();
    const files = textFiles();
    listing = true;
    listIndex = Math.max(0, files.findIndex(([filename]) => filename === name));
    if (listIndex < 0) listIndex = 0;
    api.setKeys(['Help', '', 'Open', '', '', '', '', '', '', 'Back']);
    if (!files.length) {
      stage.innerHTML = `<div class="doc"><h2>LOAD</h2><p>No text files on A:.</p></div>`;
      api.setStatus('F3 does nothing. Esc returns.');
      return;
    }
    stage.innerHTML = `<div class="list"><div class="list-head">Text files on A:</div><div class="list-rows">${
      files.map(([filename], index) => `<button type="button" class="row${index === listIndex ? ' on' : ''}" data-file="${filename}">${filename}</button>`).join('')
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
    const files = textFiles();
    const hit = files[listIndex];
    if (!hit) return;
    this.open(hit[0], hit[1].text || '');
    this.editor();
    api.setStatus(`Loaded ${hit[0]}`);
  },
  blank() {
    name = '';
    body = '';
    clean = '';
    listing = false;
    this.editor();
  },
  onF(n) {
    if (n === 1) api.help();
    if (n === 2 && !listing) this.save();
    if (n === 3) {
      if (listing) this.loadIndex();
      else this.showLoad();
    }
    if (n === 4 && !listing) this.blank();
    if (n === 10) {
      if (listing) this.editor();
      else api.exit();
    }
  },
  onKey(event) {
    if (listing) {
      const count = textFiles().length;
      if (event.key === 'ArrowDown') listIndex = Math.min(count - 1, listIndex + 1);
      if (event.key === 'ArrowUp') listIndex = Math.max(0, listIndex - 1);
      if (event.key === 'Enter') this.loadIndex();
      if (event.key === 'Escape') this.editor();
      this.paintList();
      return;
    }
    if (event.key === 'Escape') api.exit();
  },
};
