import { esc, formatDate, formatSize } from './util.js';
import {
  children, createFile, get, iconName, kindLabel, listFiles, notepadPages, resolve,
  setNotepadPage, settings, sizeOf, trashCount, trashItems, updateFile, updateSettings, validateName,
} from './fs.js';
import { DESK_PATTERNS, patternById } from './patterns.js';
import { icon } from './icons.js';
import { allWindows, findApp, front, onWindows, open, setTitle } from './wm.js';
import { registerLauncher } from './launch.js';
import { dialog } from './dialog.js';
import { play, setAudioLevel } from './audio.js';

const HILITES = ['#000099', '#660099', '#006633', '#990000', '#885500', '#111111', '#005566'];

function textOf(win) {
  return win.payload.ta?.value ?? '';
}

async function saveText(win, saveAs = false) {
  const text = textOf(win);
  if (win.fileId && !saveAs) {
    updateFile(win.fileId, { text });
    win.payload.saved = text;
    return true;
  }
  const current = win.fileId ? get(win.fileId) : null;
  const result = await dialog({
    message: 'Save this document as:',
    fields: [{ name: 'filename', label: 'Name', value: current?.name || 'Untitled' }],
    buttons: [
      { id: 'cancel', label: 'Cancel' },
      { id: 'ok', label: 'Save', default: true },
    ],
    validate: ({ button, values }) => {
      if (button !== 'ok') return null;
      if (!validateName(values.filename)) return 'Names can’t be empty or contain a colon.';
      return null;
    },
  });
  if (result.button !== 'ok') return false;
  const name = validateName(result.values.filename);
  const parent = current?.parent && current.parent !== 'desk' ? current.parent : 'docs';
  const existing = children(parent).find((node) => node.kind === 'file' && node.name.toLowerCase() === name.toLowerCase());
  if (existing) {
    updateFile(existing.id, { text });
    win.fileId = existing.id;
    setTitle(win.id, existing.name);
  } else {
    const node = createFile(parent, { name, text, kind: 'file', app: 'simpletext' });
    win.fileId = node.id;
    setTitle(win.id, node.name);
  }
  win.payload.saved = text;
  return true;
}

async function confirmText(win) {
  if (!win.payload.ta || textOf(win) === win.payload.saved) return true;
  const result = await dialog({
    message: `Save changes to “${win.title}” before closing?`,
    buttons: [
      { id: 'discard', label: "Don't Save" },
      { id: 'cancel', label: 'Cancel' },
      { id: 'save', label: 'Save', default: true },
    ],
  });
  if (result.button === 'cancel') return false;
  if (result.button === 'discard') return true;
  return saveText(win);
}

function bindTextarea(win, text) {
  const ta = document.createElement('textarea');
  ta.className = 'st-text';
  ta.spellcheck = false;
  ta.value = text || '';
  ta.setAttribute('aria-label', 'Document');
  win.content.appendChild(ta);
  win.payload.ta = ta;
  win.payload.saved = ta.value;
  const fit = () => {
    const clip = win.scroll?.clip;
    if (!clip) return;
    ta.style.width = `${clip.clientWidth}px`;
    ta.style.height = 'auto';
    ta.style.height = `${Math.max(clip.clientHeight, ta.scrollHeight)}px`;
    win.scroll.refresh();
  };
  ta.addEventListener('input', fit);
  win.onResize = fit;
  requestAnimationFrame(fit);
}

export function openSimpleText(fileId) {
  let node = fileId ? get(fileId) : null;
  if (node?.kind === 'alias') node = resolve(node);
  return open({
    app: 'simpletext',
    title: node?.name || 'Untitled',
    fileId: node?.kind === 'file' ? node.id : null,
    w: 460,
    h: 340,
    scroll: true,
    render(win) {
      bindTextarea(win, node?.text || '');
    },
    onBeforeClose: confirmText,
  });
}

export async function openTextFile() {
  const files = listFiles((node) => node.kind === 'file');
  const result = await dialog({
    message: 'Open a document',
    wide: true,
    list: files.map((file) => ({ id: file.id, label: `${file.name}` })),
    buttons: [
      { id: 'cancel', label: 'Cancel' },
      { id: 'ok', label: 'Open', default: true },
    ],
  });
  if (result.button !== 'ok' || !result.values.picked) return;
  openSimpleText(result.values.picked);
}

export function saveFrontText(saveAs) {
  const win = front();
  if (win?.app !== 'simpletext') return false;
  return saveText(win, saveAs);
}

function openNotepad() {
  let page = 0;
  open({
    app: 'notepad',
    title: 'Note Pad',
    singleton: true,
    w: 380,
    h: 300,
    minW: 260,
    minH: 200,
    scroll: false,
    render(win, body) {
      body.classList.add('pad-body');
      body.querySelector('.grow.solo')?.classList.add('above');
      const pages = notepadPages();
      body.insertAdjacentHTML('afterbegin', `
        <div class="pad">
          <textarea class="pad-text" spellcheck="false" aria-label="Note pad page"></textarea>
          <div class="pad-nav">
            <button type="button" data-flip="-1" aria-label="Previous page">◀</button>
            <span data-page></span>
            <button type="button" data-flip="1" aria-label="Next page">▶</button>
          </div>
        </div>`);
      const ta = body.querySelector('textarea');
      const label = body.querySelector('[data-page]');
      const show = () => {
        ta.value = notepadPages()[page] || '';
        label.textContent = `Page ${page + 1} of 8`;
      };
      show();
      ta.addEventListener('input', () => setNotepadPage(page, ta.value));
      body.addEventListener('click', (event) => {
        const flip = event.target.closest('[data-flip]');
        if (!flip) return;
        setNotepadPage(page, ta.value);
        page = (page + Number(flip.dataset.flip) + 8) % 8;
        show();
      });
      void pages;
    },
  });
}

function openHelp() {
  open({
    app: 'help',
    title: 'Help',
    singleton: true,
    w: 440,
    h: 320,
    scroll: true,
    render(win) {
      win.content.innerHTML = `
        <article class="help">
          <h2>Using this desk</h2>
          <p>The goat at the left of the menu bar opens desk accessories. File, Edit, View, and Special follow the front window.</p>
          <p>Double-click Macintosh HD for the Finder. Icon view and list view are in the View menu, or the buttons in a folder window.</p>
          <p>⌘N makes a folder in the Finder, or a new note in SimpleText. ⌘S saves. ⌘W closes the front window. ⌘Q quits the front program. Finder itself stays open.</p>
          <p>Drag icons with the mouse, or press and hold on a touch screen. Drop them on the Trash, then choose Special → Empty Trash.</p>
          <p>Paint is black and white, like a one-bit studio. The Control Panels change the desktop pattern, the highlight color, and the beep.</p>
          <p>Special → Sleep dims the screen. Restart plays the startup again. Shut Down leaves the safe-to-switch-off screen.</p>
        </article>`;
      requestAnimationFrame(() => win.scroll?.refresh());
    },
  });
}

const MEMORY = {
  system: 12400,
  finder: 2848,
  simpletext: 512,
  paint: 1480,
  calculator: 192,
  notepad: 256,
  scrapbook: 640,
  puzzle: 384,
  brickout: 768,
  controls: 320,
  about: 160,
  help: 220,
  info: 128,
};
const TOTAL = 65536;

function memoryRows() {
  const rows = [
    ['System Software', MEMORY.system],
    ['Finder', MEMORY.finder],
  ];
  const seen = new Set();
  for (const win of allWindows()) {
    if (win.app === 'finder' || seen.has(win.app)) continue;
    seen.add(win.app);
    const extra = findApp(win.app).length - 1;
    rows.push([win.title.split('—')[0], (MEMORY[win.app] || 256) + extra * 128]);
  }
  return rows;
}

function paintAbout(root) {
  const rows = memoryRows();
  const used = rows.reduce((sum, row) => sum + row[1], 0);
  root.innerHTML = `
    <div class="about">
      <div class="about-head">
        ${icon('hd')}
        <div>
          <strong>Mac OS 8</strong>
          <p>Crispy Goat desk</p>
        </div>
      </div>
      <p class="about-total">Built-in Memory: 64,000K</p>
      <ul class="mem">
        ${rows.map(([name, kb]) => `
          <li>
            <span>${esc(name)}</span>
            <span class="mem-kb">${kb.toLocaleString('en-US')}K</span>
            <i style="width:${Math.max(4, (kb / TOTAL) * 100)}%"></i>
          </li>`).join('')}
      </ul>
      <p>Largest Unused Block: ${Math.max(0, TOTAL - used).toLocaleString('en-US')}K</p>
    </div>`;
}

function openAbout() {
  open({
    app: 'about',
    title: 'About This Computer',
    singleton: true,
    w: 380,
    h: 420,
    scroll: true,
    render(win) {
      const paint = () => {
        if (!win.el?.isConnected) return;
        paintAbout(win.content);
        win.scroll?.refresh();
      };
      paint();
      win.payload.unsub = onWindows(paint);
    },
    onClose(win) {
      win.payload.unsub?.();
    },
  });
}

export function openInfo(id) {
  let title = 'Info';
  let body = '';
  if (id === 'vol-hd') {
    title = 'Macintosh HD Info';
    body = infoBlock({
      icon: 'hd',
      name: 'Macintosh HD',
      kind: 'disk',
      size: formatSize(sizeOf(get('hd'))),
      where: 'Desktop',
      created: '—',
    });
  } else if (id === 'vol-trash') {
    title = 'Trash Info';
    const items = trashItems();
    body = infoBlock({
      icon: items.length ? 'trashfull' : 'trash',
      name: 'Trash',
      kind: 'trash',
      size: formatSize(items.reduce((sum, node) => sum + sizeOf(node), 0)),
      where: 'Desktop',
      created: `${trashCount()} item${trashCount() === 1 ? '' : 's'}`,
    });
  } else {
    const node = get(id);
    if (!node) return;
    const real = node.kind === 'alias' ? resolve(node) : node;
    title = `${node.name} Info`;
    body = infoBlock({
      icon: iconName(node),
      name: node.name,
      kind: kindLabel(node),
      size: node.kind === 'folder' || node.kind === 'alias' ? (real ? formatSize(sizeOf(real)) : '—') : formatSize(sizeOf(node)),
      where: node.trashed ? 'Trash' : (node.parent === 'desk' ? 'Desktop' : (get(node.parent)?.name || 'Macintosh HD')),
      created: formatDate(node.created),
      modified: formatDate(node.modified),
    });
  }
  open({
    app: 'info',
    title,
    fileId: id,
    w: 340,
    h: 230,
    minW: 280,
    minH: 200,
    scroll: true,
    render(win) {
      win.content.innerHTML = body;
      requestAnimationFrame(() => win.scroll?.refresh());
    },
  });
}

function infoBlock(info) {
  return `
    <div class="info">
      <div class="info-head">${icon(info.icon)}<strong>${esc(info.name)}</strong></div>
      <dl>
        <dt>Kind</dt><dd>${esc(info.kind)}</dd>
        <dt>Size</dt><dd>${esc(info.size)}</dd>
        <dt>Where</dt><dd>${esc(info.where)}</dd>
        <dt>Created</dt><dd>${esc(info.created)}</dd>
        ${info.modified ? `<dt>Modified</dt><dd>${esc(info.modified)}</dd>` : ''}
      </dl>
    </div>`;
}

function openControls() {
  open({
    app: 'controls',
    title: 'Control Panels',
    singleton: true,
    w: 460,
    h: 340,
    scroll: true,
    render(win) {
      const current = settings();
      win.content.innerHTML = `
        <div class="controls">
          <section>
            <h2>Desktop pattern</h2>
            <div class="swatches" data-patterns>
              ${DESK_PATTERNS.map((item) => `
                <button type="button" class="swatch${item.id === current.pattern ? ' on' : ''}" data-pattern="${item.id}" aria-label="${esc(item.name)}"
                  style="background-image:url('${item.url}')"></button>`).join('')}
            </div>
          </section>
          <section>
            <h2>Highlight color</h2>
            <div class="swatches colors">
              ${HILITES.map((color) => `
                <button type="button" class="swatch color${color === current.hilite ? ' on' : ''}" data-hilite="${color}" aria-label="Highlight ${color}"
                  style="background:${color}"></button>`).join('')}
            </div>
          </section>
          <section>
            <h2>Sound</h2>
            <label class="sound-row">Volume
              <input data-volume type="range" min="0" max="7" step="1" value="${current.volume}" />
              <span data-vol-label>${current.volume}</span>
            </label>
            <label class="sound-row"><input data-mute type="checkbox" ${current.muted ? 'checked' : ''}/> Mute</label>
            <button type="button" class="btn" data-test>Test beep</button>
          </section>
        </div>`;
      win.content.addEventListener('click', (event) => {
        const pattern = event.target.closest('[data-pattern]');
        if (pattern) {
          updateSettings({ pattern: pattern.dataset.pattern });
          win.content.querySelectorAll('[data-pattern]').forEach((button) => {
            button.classList.toggle('on', button.dataset.pattern === pattern.dataset.pattern);
          });
          return;
        }
        const color = event.target.closest('[data-hilite]');
        if (color) {
          updateSettings({ hilite: color.dataset.hilite });
          win.content.querySelectorAll('[data-hilite]').forEach((button) => {
            button.classList.toggle('on', button.dataset.hilite === color.dataset.hilite);
          });
          return;
        }
        if (event.target.closest('[data-test]')) play('alert');
      });
      const slider = win.content.querySelector('[data-volume]');
      const mute = win.content.querySelector('[data-mute]');
      const label = win.content.querySelector('[data-vol-label]');
      const sync = () => {
        const volume = Number(slider.value);
        label.textContent = String(volume);
        updateSettings({ volume, muted: mute.checked || volume === 0 });
        setAudioLevel(volume, mute.checked || volume === 0);
      };
      slider.addEventListener('input', sync);
      mute.addEventListener('change', sync);
      void patternById;
      requestAnimationFrame(() => win.scroll?.refresh());
    },
  });
}

registerLauncher('simpletext', ({ fileId } = {}) => openSimpleText(fileId));
registerLauncher('notepad', () => openNotepad());
registerLauncher('help', () => openHelp());
registerLauncher('about', () => openAbout());
registerLauncher('controls', () => openControls());
registerLauncher('info', ({ id } = {}) => openInfo(id));
