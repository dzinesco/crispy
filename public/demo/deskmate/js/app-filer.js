import { askLine, cleanName, fileBytes } from './util.js';

const KINDS = {
  text: 'Text',
  sheet: 'Sheet',
  paint: 'Paint',
  music: 'Music',
  cal: 'Cal',
};

let api = null;
let stage = null;
let index = 0;
let mode = 'list';

function entries() {
  return Object.entries(api.disk.files).sort(([a], [b]) => a.localeCompare(b));
}

export const filerApp = {
  title: 'Filer',
  keys: ['Help', 'Rename', 'Open', 'Delete', '', 'New', '', '', '', 'Exit'],
  mount(nextStage, nextApi) {
    stage = nextStage;
    api = nextApi;
    mode = 'list';
    index = 0;
    this.render();
  },
  destroy() {
    stage = null;
  },
  render() {
    mode = 'list';
    api.setKeys(this.keys);
    const files = entries();
    if (index >= files.length) index = Math.max(0, files.length - 1);
    const rows = files.map(([filename, file], row) => {
      const kind = KINDS[file.kind] || 'File';
      const bytes = String(fileBytes(file)).padStart(5, ' ');
      return `<button type="button" class="row${row === index ? ' on' : ''}" data-file="${filename}"><span>${filename}</span><span>${kind}</span><span>${bytes}</span></button>`;
    }).join('');
    stage.innerHTML = `<div class="filer">
      <div class="filer-head"><span>Name</span><span>Type</span><span>Bytes</span></div>
      <div class="list-rows">${rows || '<p class="empty">Disk is empty. F6 makes a text file.</p>'}</div>
    </div>`;
    stage.querySelectorAll('[data-file]').forEach((button, row) => {
      button.addEventListener('click', () => {
        if (index === row) api.openFile(button.dataset.file);
        else {
          index = row;
          this.paint();
        }
      });
    });
    const current = files[index];
    api.setStatus(current ? `A: ${current[0]}` : 'A: empty');
  },
  paint() {
    stage.querySelectorAll('[data-file]').forEach((button, row) => {
      button.classList.toggle('on', row === index);
    });
    const current = entries()[index];
    if (current) api.setStatus(`A: ${current[0]}`);
  },
  async rename() {
    const files = entries();
    const current = files[index];
    if (!current) return;
    const entered = await askLine(stage, 'Rename to', { value: current[0] });
    if (entered == null) {
      this.render();
      return;
    }
    const filename = cleanName(entered);
    if (!filename) {
      api.setStatus('Use a short name');
      return;
    }
    if (filename !== current[0] && api.disk.files[filename]) {
      api.setStatus('Already on the disk');
      return;
    }
    if (filename !== current[0]) {
      api.disk.files[filename] = api.disk.files[current[0]];
      delete api.disk.files[current[0]];
      api.disk.files[filename].modified = Date.now();
      api.persist();
    }
    this.render();
    api.setStatus(`Renamed to ${filename}`);
  },
  async create() {
    const entered = await askLine(stage, 'New text', { value: 'NEW.TXT', save: true });
    if (entered == null) return;
    const filename = cleanName(entered);
    if (!filename) {
      api.setStatus('Use a short name like NEW.TXT');
      return;
    }
    if (api.disk.files[filename]) {
      api.setStatus('Already on the disk');
      return;
    }
    api.disk.files[filename] = { kind: 'text', text: '', modified: Date.now() };
    api.persist();
    api.openFile(filename);
  },
  remove() {
    const current = entries()[index];
    if (!current) return;
    delete api.disk.files[current[0]];
    api.persist();
    mode = 'list';
    this.render();
    api.setStatus(`Deleted ${current[0]}`);
  },
  onF(n) {
    if (mode === 'confirm') {
      if (n === 10) {
        mode = 'list';
        api.setStatus('Kept');
        api.setKeys(this.keys);
      }
      return;
    }
    if (n === 1) api.help();
    if (n === 2) this.rename();
    if (n === 3) {
      const current = entries()[index];
      if (current) api.openFile(current[0]);
    }
    if (n === 4) {
      const current = entries()[index];
      if (!current) return;
      mode = 'confirm';
      api.setStatus(`Delete ${current[0]}?  Y/N`);
    }
    if (n === 6) this.create();
    if (n === 10) api.exit();
  },
  onKey(event) {
    if (mode === 'confirm') {
      if (event.key === 'y' || event.key === 'Y') this.remove();
      if (event.key === 'n' || event.key === 'N' || event.key === 'Escape') {
        mode = 'list';
        api.setStatus('Kept');
      }
      return;
    }
    const count = entries().length;
    if (event.key === 'ArrowDown') index = Math.min(count - 1, index + 1);
    if (event.key === 'ArrowUp') index = Math.max(0, index - 1);
    if (event.key === 'Home') index = 0;
    if (event.key === 'End') index = Math.max(0, count - 1);
    if (event.key === 'Enter') {
      const current = entries()[index];
      if (current) api.openFile(current[0]);
      return;
    }
    if (event.key === 'Escape') {
      api.exit();
      return;
    }
    this.paint();
  },
};
