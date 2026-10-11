import { DESK_W, DESK_H, MENU_H, clamp, esc, stagePoint, stageScale } from './util.js';
import {
  batch, desktopNodes, get, iconName, moveToTrash, onChange, rename, setPos, settings, specials,
} from './fs.js';
import { patternById } from './patterns.js';
import { icon } from './icons.js';
import { setAudioLevel, play } from './audio.js';
import { focusDesktop } from './wm.js';
import { openNode } from './open.js';
import { launch } from './launch.js';
import { dialog } from './dialog.js';

const selected = new Set();
let dragging = false;
let lastClick = { id: null, t: 0 };
let renameTimer = 0;

const desk = () => document.getElementById('desktop');

export function desktopSelection() {
  return [...selected];
}

export function initDesktop() {
  const root = desk();
  root.addEventListener('pointerdown', onPointerDown);
  onChange(() => {
    applyChrome();
    if (!dragging) renderDesktop();
  });
  applyChrome();
  renderDesktop();
}

function applyChrome() {
  const current = settings();
  const pattern = patternById(current.pattern);
  const root = desk();
  root.style.backgroundImage = `url("${pattern.url}")`;
  root.style.backgroundColor = '#5f818c';
  document.getElementById('stage').style.setProperty('--hilite', current.hilite || '#000099');
  setAudioLevel(current.volume, current.muted);
}

export function renderDesktop() {
  const spec = specials();
  const items = [
    spec.hd,
    ...desktopNodes().map((node) => ({
      id: node.id,
      name: node.name,
      icon: iconName(node),
      x: node.x ?? 40,
      y: node.y ?? 40,
    })),
    spec.trash,
  ];
  desk().innerHTML = items.map((item) => `
    <button type="button" class="dicon${selected.has(item.id) ? ' selected' : ''}"
      data-desktop-icon data-id="${esc(item.id)}" id="icon-${esc(item.id)}"
      style="left:${item.x}px;top:${item.y}px">
      <span class="glyph">${icon(item.icon)}</span>
      <span class="label">${esc(item.name)}</span>
    </button>`).join('');
}

function syncSelection() {
  for (const el of desk().querySelectorAll('[data-desktop-icon]')) {
    el.classList.toggle('selected', selected.has(el.dataset.id));
  }
}

function hitTrash(event) {
  const lifted = [...document.querySelectorAll('.lifting')];
  for (const el of lifted) el.style.pointerEvents = 'none';
  const under = document.elementFromPoint(event.clientX, event.clientY);
  for (const el of lifted) el.style.pointerEvents = '';
  return Boolean(under?.closest?.('#icon-vol-trash'));
}

function onPointerDown(event) {
  if (event.button !== 0) return;
  focusDesktop();
  const iconEl = event.target.closest('[data-desktop-icon]');
  if (!iconEl) {
    if (!event.shiftKey) selected.clear();
    syncSelection();
    startMarquee(event);
    return;
  }
  event.preventDefault();
  onIconDown(event, iconEl);
}

function onIconDown(event, iconEl) {
  const id = iconEl.dataset.id;
  clearTimeout(renameTimer);
  if (event.shiftKey) {
    if (selected.has(id)) selected.delete(id);
    else selected.add(id);
    syncSelection();
    return;
  }
  if (!selected.has(id)) {
    selected.clear();
    selected.add(id);
    syncSelection();
  } else if (event.target.closest('.label')) {
    renameTimer = setTimeout(() => beginRename(id), 650);
  }
  const starts = [...selected].map((sid) => {
    const el = document.getElementById(`icon-${sid}`);
    return { id: sid, x: parseFloat(el.style.left), y: parseFloat(el.style.top), el };
  }).filter((item) => item.el);
  const sx = event.clientX;
  const sy = event.clientY;
  let moved = false;
  let active = false;
  const begin = () => {
    if (active) return;
    active = true;
    dragging = true;
    clearTimeout(renameTimer);
    for (const item of starts) item.el.classList.add('lifting');
  };
  const hold = setTimeout(begin, 280);
  try { iconEl.setPointerCapture(event.pointerId); } catch { /* synthetic or already captured */ }
  const move = (ev) => {
    const dist = Math.hypot(ev.clientX - sx, ev.clientY - sy);
    if (!active && dist > 5) {
      clearTimeout(hold);
      begin();
    }
    if (!active) return;
    const dx = (ev.clientX - sx) / stageScale();
    const dy = (ev.clientY - sy) / stageScale();
    for (const item of starts) {
      item.el.style.left = `${item.x + dx}px`;
      item.el.style.top = `${item.y + dy}px`;
    }
    const trash = document.getElementById('icon-vol-trash');
    const over = hitTrash(ev) && starts.every((item) => item.id !== 'vol-trash' && item.id !== 'vol-hd');
    trash?.classList.toggle('drop-target', over);
  };
  const up = (ev) => {
    clearTimeout(hold);
    iconEl.removeEventListener('pointermove', move);
    iconEl.removeEventListener('pointerup', up);
    const trashable = starts.filter((item) => item.id !== 'vol-hd' && item.id !== 'vol-trash');
    const overTrash = hitTrash(ev) && trashable.length > 0 && starts.every((item) => item.id !== 'vol-trash');
    document.getElementById('icon-vol-trash')?.classList.remove('drop-target');
    for (const item of starts) item.el.classList.remove('lifting');
    if (!active) {
      const stamp = performance.now();
      if (lastClick.id === id && stamp - lastClick.t < 450) {
        clearTimeout(renameTimer);
        lastClick = { id: null, t: 0 };
        openDesktopItem(id);
      } else {
        lastClick = { id, t: stamp };
      }
      dragging = false;
      return;
    }
    const dx = (ev.clientX - sx) / stageScale();
    const dy = (ev.clientY - sy) / stageScale();
    dragging = false;
    if (overTrash) {
      const count = moveToTrash(trashable.map((item) => item.id));
      selected.clear();
      if (count) play('trash');
      else play('alert');
      return;
    }
    batch(() => {
      for (const item of starts) {
        setPos(
          item.id,
          clamp(item.x + dx, 4, DESK_W - 86),
          clamp(item.y + dy, MENU_H + 2, DESK_H - 72),
        );
      }
    });
  };
  iconEl.addEventListener('pointermove', move);
  iconEl.addEventListener('pointerup', up);
}

function openDesktopItem(id) {
  if (id === 'vol-hd') launch('finder', { folderId: 'hd' });
  else if (id === 'vol-trash') launch('finder', { folderId: 'trash' });
  else openNode(id);
}

function startMarquee(event) {
  const layer = document.getElementById('marquee');
  const start = stagePoint(event);
  const root = desk();
  root.setPointerCapture(event.pointerId);
  let moved = false;
  const move = (ev) => {
    const point = stagePoint(ev);
    const x = Math.min(start.x, point.x);
    const y = Math.min(start.y, point.y);
    const w = Math.abs(point.x - start.x);
    const h = Math.abs(point.y - start.y);
    if (w + h < 4) return;
    moved = true;
    layer.hidden = false;
    layer.style.left = `${x}px`;
    layer.style.top = `${y}px`;
    layer.style.width = `${w}px`;
    layer.style.height = `${h}px`;
    selected.clear();
    for (const el of root.querySelectorAll('[data-desktop-icon]')) {
      const ix = parseFloat(el.style.left);
      const iy = parseFloat(el.style.top);
      if (ix < x + w && ix + 80 > x && iy < y + h && iy + 64 > y) selected.add(el.dataset.id);
    }
    syncSelection();
  };
  const up = () => {
    layer.hidden = true;
    root.removeEventListener('pointermove', move);
    root.removeEventListener('pointerup', up);
    if (!moved && !event.shiftKey) {
      selected.clear();
      syncSelection();
    }
  };
  root.addEventListener('pointermove', move);
  root.addEventListener('pointerup', up);
}

export function beginRename(id) {
  if (id === 'vol-hd' || id === 'vol-trash') {
    play('alert');
    return;
  }
  const el = document.getElementById(`icon-${id}`);
  const node = get(id);
  if (!el || !node) return;
  const label = el.querySelector('.label');
  const input = document.createElement('input');
  input.className = 'rename';
  input.value = node.name;
  input.maxLength = 31;
  input.setAttribute('aria-label', 'Rename');
  label.replaceWith(input);
  input.focus();
  input.select();
  let done = false;
  const commit = () => {
    if (done) return;
    done = true;
    const result = rename(id, input.value);
    if (!result.ok) {
      play('alert');
      renderDesktop();
      dialog({
        message: result.reason === 'exists'
          ? 'That name is already taken.'
          : 'Names can’t be empty or contain a colon.',
        buttons: [{ id: 'ok', label: 'OK', default: true }],
      });
    }
  };
  input.addEventListener('keydown', (ev) => {
    ev.stopPropagation();
    if (ev.key === 'Enter') {
      ev.preventDefault();
      input.blur();
    } else if (ev.key === 'Escape') {
      input.value = node.name;
      input.blur();
    }
  });
  input.addEventListener('blur', commit);
}

export function cleanUpDesktop() {
  const nodes = desktopNodes();
  const spots = ['vol-hd', ...nodes.map((node) => node.id), 'vol-trash'];
  batch(() => {
    let row = 0;
    let col = 0;
    for (const id of spots) {
      setPos(id, 924 - col * 96, 36 + row * 88);
      row += 1;
      if (36 + row * 88 > 640) {
        row = 0;
        col += 1;
      }
    }
  });
}

export function selectDesktop(ids) {
  selected.clear();
  for (const id of ids) selected.add(id);
  syncSelection();
}
