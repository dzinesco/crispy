import { esc, formatDate, formatSize, stageScale } from './util.js';
import {
  batch, children, folderName, get, iconName, kindLabel, moveNode, moveToTrash,
  onChange, rename, resolve, setFolderPos, sizeOf, trashItems,
} from './fs.js';
import { icon } from './icons.js';
import { createScroll } from './scroll.js';
import { allWindows, focus, front, open, setTitle } from './wm.js';
import { registerLauncher } from './launch.js';
import { openNode } from './open.js';
import { play } from './audio.js';
import { dialog } from './dialog.js';

registerLauncher('finder', ({ folderId }) => openFinder(folderId || 'hd'));

export function openFinder(folderId = 'hd') {
  const existing = allWindows().find((win) => win.app === 'finder' && win.folderId === folderId);
  if (existing) {
    focus(existing.id);
    return existing;
  }
  return open({
    app: 'finder',
    title: folderName(folderId),
    folderId,
    w: 520,
    h: 360,
    minW: 280,
    minH: 180,
    scroll: false,
    render(win, body) {
      win.view = 'icon';
      win.sort = { key: 'name', dir: 1 };
      win.selected = new Set();
      body.classList.add('finder-body');
      body.querySelector('.grow.solo')?.remove();
      body.innerHTML = `
        <div class="finder">
          <div class="finder-bar" data-bar></div>
          <div class="list-head" data-head hidden></div>
          <div class="finder-scroll" data-scroll></div>
        </div>`;
      const growHost = body.querySelector('[data-scroll]');
      win.scroll = createScroll(growHost, {
        onResize: ({ phase, dx, dy }) => {
          if (phase === 'start') {
            win._rw = win.w;
            win._rh = win.h;
            return;
          }
          win.w = Math.max(win.minW, Math.round(win._rw + dx));
          win.h = Math.max(win.minH, Math.round(win._rh + dy));
          win.zoomed = false;
          win.el.style.width = `${win.w}px`;
          if (!win.collapsed) win.el.style.height = `${win.h}px`;
          win.el.dataset.x = String(Math.round(win.x));
          win.el.dataset.y = String(Math.round(win.y));
          win.scroll?.refresh();
        },
      });
      win.content = win.scroll.content;
      body.addEventListener('pointerdown', (event) => onPointerDown(win, event));
      body.addEventListener('click', (event) => onClick(win, event));
      win._unsub = onChange(() => {
        if (!win.el?.isConnected || win._dragging) return;
        draw(win);
      });
      draw(win);
    },
    onClose(win) {
      win._unsub?.();
    },
  });
}

function itemsOf(win) {
  const items = win.folderId === 'trash' ? trashItems() : children(win.folderId);
  const { key, dir } = win.sort;
  return [...items].sort((a, b) => {
    let av;
    let bv;
    if (key === 'size') { av = sizeOf(a); bv = sizeOf(b); }
    else if (key === 'kind') { av = kindLabel(a); bv = kindLabel(b); }
    else if (key === 'modified') { av = a.modified || ''; bv = b.modified || ''; }
    else { av = a.name.toLowerCase(); bv = b.name.toLowerCase(); }
    if (av < bv) return -1 * dir;
    if (av > bv) return 1 * dir;
    return 0;
  });
}

function draw(win) {
  if (!win.el?.isConnected) return;
  for (const id of [...win.selected]) {
    if (win.folderId === 'trash') {
      if (!get(id)?.trashed) win.selected.delete(id);
    } else if (!get(id) || get(id).trashed || get(id).parent !== win.folderId) {
      win.selected.delete(id);
    }
  }
  setTitle(win.id, folderName(win.folderId));
  const bar = win.el.querySelector('[data-bar]');
  const head = win.el.querySelector('[data-head]');
  const items = itemsOf(win);
  bar.innerHTML = `
    <div class="crumbs">${crumbs(win.folderId).map((part, index, all) => `
      ${index ? '<span class="colon">:</span>' : ''}
      <button type="button" class="crumb" data-crumb="${esc(part.id)}">${esc(part.name)}</button>`).join('')}
    </div>
    <div class="view-toggle">
      <button type="button" class="viewbtn${win.view === 'icon' ? ' on' : ''}" data-set-view="icon" aria-label="Icon view">▦</button>
      <button type="button" class="viewbtn${win.view === 'list' ? ' on' : ''}" data-set-view="list" aria-label="List view">☰</button>
    </div>
    <span class="count">${items.length} item${items.length === 1 ? '' : 's'}</span>`;
  if (win.view === 'list') {
    head.hidden = false;
    head.innerHTML = ['name', 'size', 'kind', 'modified'].map((key) => {
      const label = { name: 'Name', size: 'Size', kind: 'Kind', modified: 'Modified' }[key];
      const mark = win.sort.key === key ? (win.sort.dir > 0 ? ' ▲' : ' ▼') : '';
      return `<button type="button" data-sort="${key}">${label}${mark}</button>`;
    }).join('');
    win.content.innerHTML = `<div class="list">${items.map((node) => `
      <button type="button" class="row${win.selected.has(node.id) ? ' selected' : ''}" data-id="${esc(node.id)}" data-file="${esc(node.id)}">
        <span class="cell name">${icon(iconName(node))}<span>${esc(node.name)}</span></span>
        <span class="cell">${node.kind === 'folder' ? '—' : formatSize(sizeOf(node))}</span>
        <span class="cell">${esc(kindLabel(node))}</span>
        <span class="cell">${esc(formatDate(node.modified))}</span>
      </button>`).join('') || '<p class="empty">This folder is empty.</p>'}</div>`;
    win.content.style.width = '100%';
    win.content.style.height = 'auto';
  } else {
    head.hidden = true;
    const laid = items.map((node, index) => {
      const saved = node.pos?.[win.folderId];
      const col = index % 4;
      const row = Math.floor(index / 4);
      return {
        node,
        x: saved?.x ?? 14 + col * 96,
        y: saved?.y ?? 8 + row * 88,
      };
    });
    const maxX = laid.reduce((m, item) => Math.max(m, item.x + 96), 320);
    const maxY = laid.reduce((m, item) => Math.max(m, item.y + 88), 160);
    win.content.style.width = `${maxX}px`;
    win.content.style.height = `${maxY}px`;
    win.content.innerHTML = laid.map(({ node, x, y }) => `
      <button type="button" class="ficon${win.selected.has(node.id) ? ' selected' : ''}" data-id="${esc(node.id)}" data-file="${esc(node.id)}"
        style="left:${x}px;top:${y}px">
        <span class="glyph">${icon(iconName(node))}</span>
        <span class="label">${esc(node.name)}</span>
      </button>`).join('') || '<p class="empty">This folder is empty.</p>';
  }
  const where = win.el.querySelector('.finder-bar');
  if (where && !where.querySelector('.where')) {
    /* path already in crumbs */
  }
  win.el.dataset.folder = win.folderId;
  win.scroll?.refresh();
}

function crumbs(folderId) {
  if (folderId === 'trash') return [{ id: 'trash', name: 'Trash' }];
  const parts = [];
  let id = folderId;
  const guard = new Set();
  while (id && !guard.has(id)) {
    guard.add(id);
    if (id !== 'desk') parts.unshift({ id, name: folderName(id) });
    if (id === 'hd') break;
    const node = get(id);
    id = node?.parent || null;
  }
  if (!parts.length) parts.push({ id: 'hd', name: 'Macintosh HD' });
  return parts;
}

function onClick(win, event) {
  const crumb = event.target.closest('[data-crumb]');
  if (crumb) {
    win.folderId = crumb.dataset.crumb;
    win.selected.clear();
    draw(win);
    return;
  }
  const view = event.target.closest('[data-set-view]');
  if (view) {
    win.view = view.dataset.setView;
    draw(win);
    return;
  }
  const sort = event.target.closest('[data-sort]');
  if (sort) {
    if (win.sort.key === sort.dataset.sort) win.sort.dir *= -1;
    else win.sort = { key: sort.dataset.sort, dir: 1 };
    draw(win);
  }
}

function onPointerDown(win, event) {
  if (event.button !== 0) return;
  const row = event.target.closest('[data-id]');
  if (!row || event.target.closest('[data-bar], [data-head]')) {
    if (event.target.closest('[data-bar], [data-head], .sarrow, .strack, [data-grow]')) return;
    if (!event.shiftKey) win.selected.clear();
    sync(win);
    return;
  }
  event.preventDefault();
  const id = row.dataset.id;
  if (event.shiftKey) {
    if (win.selected.has(id)) win.selected.delete(id);
    else win.selected.add(id);
    sync(win);
    return;
  }
  const was = win.selected.has(id);
  if (!was) {
    win.selected.clear();
    win.selected.add(id);
    sync(win);
  }
  dragItems(win, event, id, was && event.target.closest('.label'));
}

function sync(win) {
  for (const el of win.el.querySelectorAll('[data-id]')) {
    el.classList.toggle('selected', win.selected.has(el.dataset.id));
  }
}

function dragItems(win, event, id, armRename) {
  let renameTimer = 0;
  if (armRename) renameTimer = setTimeout(() => beginFinderRename(win, id), 650);
  const ids = [...win.selected];
  const sx = event.clientX;
  const sy = event.clientY;
  let active = false;
  const nodes = ids.map((itemId) => win.el.querySelector(`[data-id="${CSS.escape(itemId)}"]`)).filter(Boolean);
  const starts = nodes.map((el) => ({
    id: el.dataset.id,
    x: parseFloat(el.style.left) || 0,
    y: parseFloat(el.style.top) || 0,
    el,
  }));
  const begin = () => {
    if (active) return;
    active = true;
    win._dragging = true;
    clearTimeout(renameTimer);
    for (const item of starts) item.el.classList.add('lifting');
  };
  const hold = setTimeout(begin, 280);
  const handle = event.currentTarget;
  try { handle.setPointerCapture(event.pointerId); } catch { /* already captured */ }
  const move = (ev) => {
    const dist = Math.hypot(ev.clientX - sx, ev.clientY - sy);
    if (!active && dist > 5) {
      clearTimeout(hold);
      begin();
    }
    if (!active || win.view !== 'icon') return;
    const dx = (ev.clientX - sx) / stageScale();
    const dy = (ev.clientY - sy) / stageScale();
    for (const item of starts) {
      item.el.style.left = `${item.x + dx}px`;
      item.el.style.top = `${item.y + dy}px`;
    }
    document.getElementById('icon-vol-trash')?.classList.toggle('drop-target', overTrash(ev, ids));
  };
  const up = (ev) => {
    clearTimeout(hold);
    handle.removeEventListener('pointermove', move);
    handle.removeEventListener('pointerup', up);
    const droppedOnTrash = overTrash(ev, ids);
    const droppedFolder = folderUnder(ev, new Set(ids));
    const under = elementUnder(ev, ids);
    document.getElementById('icon-vol-trash')?.classList.remove('drop-target');
    for (const item of starts) item.el.classList.remove('lifting');
    if (!active) {
      const stamp = performance.now();
      win._last = win._last || { id: null, t: 0 };
      if (win._last.id === id && stamp - win._last.t < 450) {
        clearTimeout(renameTimer);
        win._last = { id: null, t: 0 };
        openNode(id);
      } else win._last = { id, t: stamp };
      win._dragging = false;
      return;
    }
    const dx = (ev.clientX - sx) / stageScale();
    const dy = (ev.clientY - sy) / stageScale();
    win._dragging = false;
    if (droppedOnTrash) {
      moveToTrash(ids);
      win.selected.clear();
      play('trash');
      draw(win);
      return;
    }
    const folder = droppedFolder;
    if (folder && folder !== win.folderId) {
      let moved = 0;
      batch(() => {
        for (const itemId of ids) if (moveNode(itemId, folder)) moved += 1;
      });
      win.selected.clear();
      if (!moved) play('alert');
      draw(win);
      return;
    }
    if (under?.closest('#desktop') && win.view === 'icon') {
      batch(() => {
        for (const itemId of ids) moveNode(itemId, 'desk');
      });
      win.selected.clear();
      draw(win);
      return;
    }
    if (win.view === 'icon' && win.folderId !== 'trash') {
      batch(() => {
        for (const item of starts) {
          setFolderPos(item.id, win.folderId, Math.max(4, item.x + dx), Math.max(4, item.y + dy));
        }
      });
    } else draw(win);
  };
  handle.addEventListener('pointermove', move);
  handle.addEventListener('pointerup', up);
}

function elementUnder(event, ignore) {
  const lifted = [...document.querySelectorAll('.lifting')];
  for (const el of lifted) el.style.pointerEvents = 'none';
  const under = document.elementFromPoint(event.clientX, event.clientY);
  for (const el of lifted) el.style.pointerEvents = '';
  return under;
}

function overTrash(event, ids) {
  if (ids.includes('vol-trash')) return false;
  return Boolean(elementUnder(event, ids)?.closest?.('#icon-vol-trash'));
}

function folderUnder(event, ignore) {
  const under = elementUnder(event, ignore);
  const host = under?.closest?.('[data-id]');
  if (!host) return null;
  const id = host.dataset.id;
  if (ignore.has(id)) return null;
  const node = resolve(get(id));
  if (!node) return null;
  if (node.kind === 'volume') return 'hd';
  if (node.kind === 'folder') return node.id;
  return null;
}

export function beginFinderRename(win, id) {
  if (win.folderId === 'trash') {
    play('alert');
    return;
  }
  const node = get(id);
  const el = win.el.querySelector(`[data-id="${CSS.escape(id)}"] .label, [data-id="${CSS.escape(id)}"] .name span`);
  if (!node || !el) return;
  const input = document.createElement('input');
  input.className = 'rename';
  input.value = node.name;
  input.maxLength = 31;
  input.setAttribute('aria-label', 'Rename');
  el.replaceWith(input);
  input.focus();
  input.select();
  let done = false;
  const commit = () => {
    if (done) return;
    done = true;
    const result = rename(id, input.value);
    if (!result.ok) {
      play('alert');
      dialog({
        message: result.reason === 'exists' ? 'That name is already taken.' : 'Names can’t be empty or contain a colon.',
        buttons: [{ id: 'ok', label: 'OK', default: true }],
      });
    }
    draw(win);
  };
  input.addEventListener('keydown', (ev) => {
    ev.stopPropagation();
    if (ev.key === 'Enter') {
      ev.preventDefault();
      input.blur();
    } else if (ev.key === 'Escape') {
      done = true;
      draw(win);
    }
  });
  input.addEventListener('blur', commit);
}

export function finderFront() {
  const win = front();
  return win?.app === 'finder' ? win : null;
}

export function setFinderView(view) {
  const win = finderFront();
  if (!win) return;
  win.view = view;
  draw(win);
}

export function finderView() {
  return finderFront()?.view || 'icon';
}

export function cleanUpFinder() {
  const win = finderFront();
  if (!win || win.folderId === 'trash') return;
  const items = itemsOf(win);
  batch(() => {
    items.forEach((node, index) => {
      const col = index % 4;
      const row = Math.floor(index / 4);
      setFolderPos(node.id, win.folderId, 14 + col * 96, 10 + row * 78);
    });
  });
}

export function selectionIds() {
  const win = finderFront();
  if (win) return [...win.selected];
  return null;
}

export function renameSelection() {
  const win = finderFront();
  if (!win) return false;
  const [id] = [...win.selected];
  if (!id) return false;
  beginFinderRename(win, id);
  return true;
}
