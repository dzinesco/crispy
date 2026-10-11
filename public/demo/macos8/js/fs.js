import { nowIso } from './util.js';

const KEY = 'crispy.macos8.v1';

const README = `Welcome to this desk.

This is a browser sketch of a 1997 Platinum desktop, drawn for Crispy Goat. The pictures, beeps, and letters are original — a look-alike, not a copy of anyone’s icons or sounds.

Try this:
• Double-click Macintosh HD.
• Open SimpleText and save a note (⌘S).
• Paint in black and white, then save a PNG.
• Drag a file onto the Trash, then choose Special → Empty Trash.
• The goat at the top left launches every desk accessory.

Files stay in this browser, on this computer.`;

const state = {
  nodes: {},
  settings: {
    pattern: 'harbor',
    hilite: '#000099',
    volume: 5,
    muted: false,
    hdX: 924,
    hdY: 36,
    trashX: 924,
    trashY: 640,
  },
  notepad: ['', '', '', '', '', '', '', ''],
};

let seq = 1;
let mute = 0;
const listeners = new Set();

export function onChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function emit() {
  if (mute > 0) return;
  persist();
  for (const fn of listeners) fn();
}

export function batch(fn) {
  mute += 1;
  try {
    fn();
  } finally {
    mute -= 1;
    if (mute === 0) emit();
  }
}

function persist() {
  try {
    localStorage.setItem(KEY, JSON.stringify({
      nodes: state.nodes,
      settings: state.settings,
      notepad: state.notepad,
      seq,
    }));
  } catch {
    /* quota or private mode — the desk still runs for this visit */
  }
}

function nid() {
  seq += 1;
  return `n${seq}`;
}

function add(node) {
  state.nodes[node.id] = node;
  return node;
}

function folder(parent, name, extra = {}) {
  return add({
    id: nid(),
    parent,
    name,
    kind: 'folder',
    created: nowIso(),
    modified: nowIso(),
    ...extra,
  });
}

function seed() {
  state.nodes = {};
  seq = 1;
  add({ id: 'hd', parent: null, name: 'Macintosh HD', kind: 'volume', created: nowIso(), modified: nowIso() });
  add({ id: 'desk', parent: 'hd', name: 'Desktop', kind: 'folder', hidden: true, created: nowIso(), modified: nowIso() });
  const apps = folder('hd', 'Applications', { badge: 'apps' });
  const docs = folder('hd', 'Documents');
  const sys = folder('hd', 'System Folder', { badge: 'system' });
  folder(sys.id, 'Control Panels');
  const ext = folder(sys.id, 'Extensions');
  const appsList = [
    ['SimpleText', 'simpletext'],
    ['Paint', 'paint'],
    ['Calculator', 'calculator'],
    ['Note Pad', 'notepad'],
    ['Scrapbook', 'scrapbook'],
    ['Puzzle', 'puzzle'],
    ['Brickout', 'brickout'],
    ['Control Panels', 'controls'],
  ];
  let simpleId = null;
  for (const [name, app] of appsList) {
    const node = add({
      id: nid(), parent: apps.id, name, kind: 'app', app, created: nowIso(), modified: nowIso(),
    });
    if (app === 'simpletext') simpleId = node.id;
  }
  const readme = add({
    id: nid(),
    parent: docs.id,
    name: 'Read Me',
    kind: 'file',
    app: 'simpletext',
    text: README,
    created: nowIso(),
    modified: nowIso(),
  });
  for (const name of ['Appearance', 'Timepiece', 'GoatSound', 'Keys', 'Memory', 'Colors']) {
    add({ id: nid(), parent: ext.id, name, kind: 'extension', created: nowIso(), modified: nowIso() });
  }
  add({
    id: nid(), parent: 'desk', name: 'SimpleText', kind: 'alias', target: simpleId,
    x: 924, y: 124, created: nowIso(), modified: nowIso(),
  });
  add({
    id: nid(), parent: 'desk', name: 'Read Me', kind: 'alias', target: readme.id,
    x: 924, y: 212, created: nowIso(), modified: nowIso(),
  });
}

export function initFS() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const data = JSON.parse(raw);
      if (data?.nodes?.hd && data?.nodes?.desk && data.settings) {
        state.nodes = data.nodes;
        state.settings = { ...state.settings, ...data.settings };
        state.notepad = Array.isArray(data.notepad) ? data.notepad.slice(0, 8) : state.notepad;
        while (state.notepad.length < 8) state.notepad.push('');
        seq = data.seq || 40;
        return;
      }
    }
  } catch {
    /* reseed a damaged save */
  }
  seed();
  persist();
}

export function settings() {
  return state.settings;
}

export function updateSettings(patch) {
  Object.assign(state.settings, patch);
  emit();
}

export function notepadPages() {
  return state.notepad;
}

export function setNotepadPage(index, text) {
  state.notepad[index] = text;
  clearTimeout(setNotepadPage._t);
  setNotepadPage._t = setTimeout(persist, 180);
}

export function get(id) {
  return state.nodes[id] || null;
}

export function resolve(node) {
  if (!node) return null;
  if (node.kind === 'alias') return state.nodes[node.target] || null;
  return node;
}

export function children(parentId) {
  return Object.values(state.nodes)
    .filter((node) => node.parent === parentId && !node.trashed && !node.hidden)
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
}

export function desktopNodes() {
  return children('desk');
}

export function trashItems() {
  return Object.values(state.nodes)
    .filter((node) => node.trashed)
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
}

export function trashCount() {
  return trashItems().length;
}

export function specials() {
  const s = state.settings;
  return {
    hd: { id: 'vol-hd', name: 'Macintosh HD', icon: 'hd', x: s.hdX, y: s.hdY },
    trash: {
      id: 'vol-trash',
      name: 'Trash',
      icon: trashCount() ? 'trashfull' : 'trash',
      x: s.trashX,
      y: s.trashY,
    },
  };
}

function siblingNames(parentId, exceptId) {
  return Object.values(state.nodes)
    .filter((node) => node.parent === parentId && !node.trashed && node.id !== exceptId)
    .map((node) => node.name.toLowerCase());
}

export function uniqueName(parentId, base, exceptId) {
  const used = new Set(siblingNames(parentId, exceptId));
  if (!used.has(base.toLowerCase())) return base;
  for (let i = 2; i < 200; i += 1) {
    const cand = `${base} ${i}`;
    if (!used.has(cand.toLowerCase())) return cand;
  }
  return `${base} ${seq}`;
}

export function validateName(name) {
  const clean = String(name || '').trim();
  if (!clean || clean.includes(':') || clean.length > 31) return null;
  return clean;
}

export function rename(id, name) {
  const node = state.nodes[id];
  if (!node || node.kind === 'volume') return { ok: false, reason: 'bad' };
  const clean = validateName(name);
  if (!clean) return { ok: false, reason: 'bad' };
  if (siblingNames(node.parent, id).includes(clean.toLowerCase())) return { ok: false, reason: 'exists' };
  node.name = clean;
  node.modified = nowIso();
  emit();
  return { ok: true, name: clean };
}

function freeDesktopSlot() {
  const taken = desktopNodes().map((node) => `${node.x},${node.y}`);
  taken.push(`${state.settings.hdX},${state.settings.hdY}`);
  taken.push(`${state.settings.trashX},${state.settings.trashY}`);
  for (let col = 0; col < 6; col += 1) {
    for (let row = 0; row < 7; row += 1) {
      const x = 924 - col * 96;
      const y = 36 + row * 88;
      if (y > 620 && col === 0) continue;
      if (!taken.includes(`${x},${y}`)) return { x, y };
    }
  }
  return { x: 40, y: 40 };
}

export function createFolder(parentId, name) {
  const node = {
    id: nid(),
    parent: parentId,
    name: uniqueName(parentId, name || 'untitled folder'),
    kind: 'folder',
    created: nowIso(),
    modified: nowIso(),
  };
  if (parentId === 'desk') {
    const pos = freeDesktopSlot();
    node.x = pos.x;
    node.y = pos.y;
  }
  add(node);
  emit();
  return node;
}

export function createFile(parentId, spec) {
  const node = {
    id: nid(),
    parent: parentId,
    name: uniqueName(parentId, spec.name || 'Untitled'),
    kind: spec.kind || 'file',
    app: spec.app || 'simpletext',
    text: spec.text || '',
    dataUrl: spec.dataUrl || '',
    created: nowIso(),
    modified: nowIso(),
  };
  if (parentId === 'desk') {
    const pos = freeDesktopSlot();
    node.x = pos.x;
    node.y = pos.y;
  }
  add(node);
  emit();
  return node;
}

export function updateFile(id, patch) {
  const node = state.nodes[id];
  if (!node) return null;
  if (patch.text != null) node.text = patch.text;
  if (patch.dataUrl != null) node.dataUrl = patch.dataUrl;
  node.modified = nowIso();
  emit();
  return node;
}

export function setPos(id, x, y) {
  const nx = Math.round(x);
  const ny = Math.round(y);
  if (id === 'vol-hd') {
    state.settings.hdX = nx;
    state.settings.hdY = ny;
  } else if (id === 'vol-trash') {
    state.settings.trashX = nx;
    state.settings.trashY = ny;
  } else if (state.nodes[id]) {
    state.nodes[id].x = nx;
    state.nodes[id].y = ny;
  }
  emit();
}

export function setFolderPos(id, folderId, x, y) {
  const node = state.nodes[id];
  if (!node) return;
  node.pos = node.pos || {};
  node.pos[folderId] = { x: Math.round(x), y: Math.round(y) };
  emit();
}

export function moveToTrash(ids) {
  let count = 0;
  for (const id of ids) {
    if (id === 'vol-hd' || id === 'vol-trash' || id === 'hd' || id === 'desk') continue;
    const node = state.nodes[id];
    if (!node || node.trashed || node.kind === 'volume') continue;
    node.trashed = true;
    node.trashedFrom = node.parent;
    node.modified = nowIso();
    count += 1;
  }
  if (count) emit();
  return count;
}

export function putAway(ids) {
  let count = 0;
  for (const id of ids) {
    const node = state.nodes[id];
    if (!node?.trashed) continue;
    node.trashed = false;
    const parent = state.nodes[node.trashedFrom] ? node.trashedFrom : 'docs';
    node.parent = parent;
    node.name = uniqueName(parent, node.name, id);
    node.modified = nowIso();
    count += 1;
  }
  if (count) emit();
  return count;
}

export function emptyTrash() {
  for (const node of trashItems()) delete state.nodes[node.id];
  emit();
}

export function moveNode(id, parentId) {
  const node = state.nodes[id];
  if (!node || id === parentId || node.kind === 'volume') return false;
  let walk = parentId;
  while (walk) {
    if (walk === id) return false;
    walk = state.nodes[walk]?.parent;
  }
  if (!state.nodes[parentId] || (state.nodes[parentId].kind !== 'folder' && parentId !== 'desk' && parentId !== 'hd')) {
    return false;
  }
  node.trashed = false;
  node.parent = parentId;
  node.name = uniqueName(parentId, node.name, id);
  if (parentId === 'desk') {
    const pos = freeDesktopSlot();
    node.x = pos.x;
    node.y = pos.y;
  }
  node.modified = nowIso();
  emit();
  return true;
}

export function duplicate(id) {
  const node = state.nodes[id];
  if (!node || node.kind === 'volume' || node.kind === 'alias' || node.kind === 'app') return null;
  const copy = {
    ...node,
    id: nid(),
    name: uniqueName(node.parent, `${node.name} copy`),
    created: nowIso(),
    modified: nowIso(),
    pos: null,
    trashed: false,
  };
  if (node.parent === 'desk') {
    const pos = freeDesktopSlot();
    copy.x = pos.x;
    copy.y = pos.y;
  }
  add(copy);
  emit();
  return copy;
}

export function listFiles(pred) {
  return Object.values(state.nodes)
    .filter((node) => !node.trashed && !node.hidden && pred(node))
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
}

export function folderName(id) {
  if (id === 'trash') return 'Trash';
  if (id === 'hd') return 'Macintosh HD';
  return state.nodes[id]?.name || 'Folder';
}

export function sizeOf(node) {
  if (!node) return 0;
  if (node.kind === 'alias') return 0;
  if (node.kind === 'folder' || node.kind === 'volume') {
    return Object.values(state.nodes)
      .filter((child) => child.parent === node.id && !child.trashed)
      .reduce((sum, child) => sum + sizeOf(child), 0);
  }
  if (node.dataUrl) return Math.round((node.dataUrl.length - 'data:'.length) * 0.75);
  return (node.text || '').length;
}

export function kindLabel(node) {
  if (!node) return 'item';
  if (node.kind === 'alias') return 'alias';
  if (node.kind === 'volume') return 'disk';
  if (node.kind === 'folder') return node.badge === 'system' ? 'system folder' : 'folder';
  if (node.kind === 'app') return 'application program';
  if (node.kind === 'extension') return 'system extension';
  if (node.kind === 'paint') return 'paint document';
  return 'text document';
}

export function iconName(node) {
  if (!node) return 'file';
  if (node.kind === 'alias') {
    const target = resolve(node);
    return target ? iconName(target) : 'file';
  }
  if (node.kind === 'volume') return 'hd';
  if (node.kind === 'folder') {
    if (node.badge === 'system') return 'system';
    if (node.badge === 'apps') return 'apps';
    return 'folder';
  }
  if (node.kind === 'app') return node.app || 'file';
  if (node.kind === 'extension') return 'extension';
  if (node.kind === 'paint') return 'paintfile';
  return 'file';
}

export function pathLabel(id) {
  if (id === 'trash') return 'Trash';
  const parts = [];
  let node = id === 'hd' ? state.nodes.hd : state.nodes[id];
  const guard = new Set();
  while (node && !guard.has(node.id)) {
    guard.add(node.id);
    if (!node.hidden) parts.unshift(node.name);
    node = node.parent ? state.nodes[node.parent] : null;
  }
  return parts.join(' : ') || 'Macintosh HD';
}
