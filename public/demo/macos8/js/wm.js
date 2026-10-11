import { MENU_H, DESK_W, DESK_H, clamp, stageScale } from './util.js';
import { createScroll } from './scroll.js';
import { play } from './audio.js';

const windows = new Map();
const hooks = new Set();
let z = 3;
let cascade = 0;
let focused = null;
const host = () => document.getElementById('windows');

export function onWindows(fn) {
  hooks.add(fn);
  return () => hooks.delete(fn);
}

function notify() {
  for (const fn of hooks) fn();
}

export function front() {
  if (!focused) return null;
  return windows.get(focused) || null;
}

export function frontApp() {
  return front()?.app || 'finder';
}

export function allWindows() {
  return [...windows.values()].sort((a, b) => a.z - b.z);
}

export function findApp(app) {
  return allWindows().filter((win) => win.app === app);
}

function geom(win) {
  const el = win.el;
  if (!el) return;
  el.style.left = `${win.x}px`;
  el.style.top = `${win.y}px`;
  el.style.width = `${win.w}px`;
  el.style.zIndex = String(win.z);
  el.style.height = win.collapsed ? `${el.querySelector('[data-titlebar]').offsetHeight || 22}px` : `${win.h}px`;
  el.classList.toggle('collapsed', win.collapsed);
  el.classList.toggle('active', win.id === focused);
  el.dataset.x = String(Math.round(win.x));
  el.dataset.y = String(Math.round(win.y));
}

function clampPos(win, x, y) {
  return {
    x: clamp(x, 8 - win.w, DESK_W - 48),
    y: clamp(y, MENU_H, DESK_H - 28),
  };
}

export function focus(id) {
  const win = windows.get(id);
  if (!win) {
    focused = null;
    for (const other of windows.values()) other.el?.classList.remove('active');
    notify();
    return;
  }
  focused = id;
  z += 1;
  win.z = z;
  for (const other of windows.values()) geom(other);
  notify();
}

export function focusDesktop() {
  focus(null);
}

function resizeBy(win, dx, dy) {
  win.w = clamp(Math.round(win._rw + dx), win.minW, DESK_W - 8);
  win.h = clamp(Math.round(win._rh + dy), win.minH, DESK_H - MENU_H - 4);
  win.zoomed = false;
  geom(win);
  win.onResize?.(win);
  win.scroll?.refresh();
}

function attachResize(win, handle) {
  handle.addEventListener('pointerdown', (event) => {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    focus(win.id);
    handle.setPointerCapture(event.pointerId);
    win._rw = win.w;
    win._rh = win.h;
    const sx = event.clientX;
    const sy = event.clientY;
    const move = (ev) => {
      resizeBy(win, (ev.clientX - sx) / stageScale(), (ev.clientY - sy) / stageScale());
    };
    const up = () => {
      handle.removeEventListener('pointermove', move);
      handle.removeEventListener('pointerup', up);
    };
    handle.addEventListener('pointermove', move);
    handle.addEventListener('pointerup', up);
  });
}

function attachDrag(win) {
  const bar = win.el.querySelector('[data-titlebar]');
  bar.addEventListener('pointerdown', (event) => {
    if (event.button !== 0) return;
    if (event.target.closest('.wbtn')) return;
    event.preventDefault();
    focus(win.id);
    try { bar.setPointerCapture(event.pointerId); } catch { /* synthetic or already captured */ }
    const sx = event.clientX;
    const sy = event.clientY;
    const ox = win.x;
    const oy = win.y;
    win.el.classList.add('dragging');
    const move = (ev) => {
      const next = clampPos(win, ox + (ev.clientX - sx) / stageScale(), oy + (ev.clientY - sy) / stageScale());
      win.x = next.x;
      win.y = next.y;
      win.zoomed = false;
      geom(win);
    };
    const up = () => {
      win.el.classList.remove('dragging');
      bar.removeEventListener('pointermove', move);
      bar.removeEventListener('pointerup', up);
    };
    bar.addEventListener('pointermove', move);
    bar.addEventListener('pointerup', up);
  });
  bar.addEventListener('click', (event) => {
    const button = event.target.closest('[data-action]');
    if (!button) return;
    event.stopPropagation();
    if (button.dataset.action === 'close') requestClose(win.id);
    if (button.dataset.action === 'shade') toggleShade(win.id);
    if (button.dataset.action === 'zoom') toggleZoom(win.id);
  });
  win.el.addEventListener('pointerdown', () => focus(win.id));
}

export function toggleShade(id) {
  const win = windows.get(id);
  if (!win) return;
  win.collapsed = !win.collapsed;
  geom(win);
  if (!win.collapsed) win.scroll?.refresh();
}

export function toggleZoom(id) {
  const win = windows.get(id);
  if (!win || win.resizable === false) return;
  if (!win.zoomed) {
    win.restore = { x: win.x, y: win.y, w: win.w, h: win.h };
    win.x = 10;
    win.y = MENU_H + 6;
    win.w = DESK_W - 20;
    win.h = DESK_H - MENU_H - 16;
    win.zoomed = true;
  } else if (win.restore) {
    Object.assign(win, win.restore);
    win.zoomed = false;
  }
  win.collapsed = false;
  geom(win);
  win.onResize?.(win);
  win.scroll?.refresh();
}

export async function requestClose(id) {
  const win = windows.get(id);
  if (!win) return false;
  if (win.onBeforeClose) {
    const ok = await win.onBeforeClose(win);
    if (!ok) return false;
  }
  close(id);
  return true;
}

export function close(id) {
  const win = windows.get(id);
  if (!win) return;
  win.onClose?.(win);
  win.el?.remove();
  windows.delete(id);
  if (focused === id) {
    const rest = allWindows();
    focused = rest.length ? rest[rest.length - 1].id : null;
    if (focused) focus(focused);
    else notify();
  } else {
    notify();
  }
}

export function closeApp(app) {
  return findApp(app).map((win) => win.id);
}

export function bringAppForward(app) {
  const list = findApp(app);
  if (!list.length) return;
  for (const win of list) {
    z += 1;
    win.z = z;
  }
  focus(list[list.length - 1].id);
}

export function setTitle(id, title) {
  const win = windows.get(id);
  if (!win) return;
  win.title = title;
  const node = win.el?.querySelector('[data-title]');
  if (node) node.textContent = title;
}

export function contentOf(id) {
  return windows.get(id)?.content || null;
}

export function getWin(id) {
  return windows.get(id) || null;
}

export function open(opts) {
  if (opts.singleton) {
    const existing = findApp(opts.app)[0];
    if (existing) {
      focus(existing.id);
      if (opts.onFocusExisting) opts.onFocusExisting(existing);
      return existing;
    }
  }
  const i = cascade++;
  const win = {
    id: `w${Date.now().toString(36)}${i}`,
    app: opts.app,
    title: opts.title || 'Untitled',
    x: opts.x ?? 28 + (i % 8) * 24,
    y: opts.y ?? MENU_H + 18 + (i % 8) * 22,
    w: opts.w ?? 420,
    h: opts.h ?? 300,
    minW: opts.minW ?? 220,
    minH: opts.minH ?? 140,
    resizable: opts.resizable !== false,
    collapsed: false,
    zoomed: false,
    z: ++z,
    fileId: opts.fileId || null,
    folderId: opts.folderId || null,
    payload: opts.payload || {},
    onResize: opts.onResize,
    onClose: opts.onClose,
    onBeforeClose: opts.onBeforeClose,
    render: opts.render,
  };
  const pos = clampPos(win, win.x, win.y);
  win.x = pos.x;
  win.y = pos.y;
  const el = document.createElement('section');
  el.className = 'window active';
  el.dataset.window = 'open';
  el.dataset.app = win.app;
  el.dataset.id = win.id;
  el.innerHTML = `
    <div class="titlebar" data-titlebar>
      <button type="button" class="wbtn close" data-action="close" aria-label="Close"></button>
      <div class="title" data-title></div>
      <button type="button" class="wbtn collapse" data-action="shade" aria-label="Collapse"></button>
      <button type="button" class="wbtn zoom" data-action="zoom" aria-label="Zoom"></button>
    </div>
    <div class="win-body" data-body></div>`;
  el.querySelector('[data-title]').textContent = win.title;
  win.el = el;
  host().appendChild(el);
  windows.set(win.id, win);
  const body = el.querySelector('[data-body]');
  if (opts.scroll) {
    const scroll = createScroll(body, {
      onResize: win.resizable ? ({ phase, dx, dy }) => {
        if (phase === 'start') {
          win._rw = win.w;
          win._rh = win.h;
          return;
        }
        resizeBy(win, dx, dy);
      } : null,
    });
    win.scroll = scroll;
    win.content = scroll.content;
  } else {
    win.content = body;
    if (win.resizable) {
      const grow = document.createElement('button');
      grow.type = 'button';
      grow.className = 'grow solo';
      grow.dataset.grow = 'true';
      grow.setAttribute('aria-label', 'Resize');
      body.appendChild(grow);
      attachResize(win, grow);
    }
  }
  attachDrag(win);
  focus(win.id);
  try {
    win.render?.(win, win.content);
  } catch {
    win.content.textContent = 'This window could not be drawn.';
  }
  win.scroll?.refresh();
  play('open');
  return win;
}

export function refreshScroll(id) {
  windows.get(id)?.scroll?.refresh();
}
