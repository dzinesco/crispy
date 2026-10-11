import { esc, prefersReducedMotion, stageBox, stageScale } from './util.js';
import { goatMark } from './icons.js';
import { play } from './audio.js';
import { dialog, dialogIsOpen } from './dialog.js';
import {
  bringAppForward, close, findApp, focus, front, frontApp, onWindows, requestClose,
} from './wm.js';
import { launch } from './launch.js';
import {
  duplicate, emptyTrash, moveToTrash, putAway, trashCount,
} from './fs.js';
import { desktopSelection, cleanUpDesktop, beginRename } from './desktop.js';
import {
  cleanUpFinder, finderFront, finderView, selectionIds, setFinderView, renameSelection,
} from './finder.js';
import { createFolder } from './fs.js';
import { selectDesktop } from './desktop.js';
import { openNode } from './open.js';
import { openInfo, openTextFile, saveFrontText } from './textapps.js';
import { openPaintFile, saveFrontPaint, undoFrontPaint } from './paint.js';
import { beginFinderRename } from './finder.js';

const APP_LABELS = {
  finder: 'Finder',
  simpletext: 'SimpleText',
  paint: 'Paint',
  calculator: 'Calculator',
  notepad: 'Note Pad',
  scrapbook: 'Scrapbook',
  puzzle: 'Puzzle',
  brickout: 'Brickout',
  controls: 'Control Panels',
  about: 'About This Computer',
  help: 'Help',
  info: 'Get Info',
};

let openId = null;

export function initMenus() {
  const goat = document.querySelector('[data-menu="goat"]');
  goat.innerHTML = goatMark();
  const bar = document.getElementById('menubar');
  bar.addEventListener('pointerdown', (event) => {
    const button = event.target.closest('[data-menu]');
    if (!button) return;
    event.preventDefault();
    event.stopPropagation();
    if (dialogIsOpen()) return;
    if (openId === button.dataset.menu) hideMenu();
    else showMenu(button.dataset.menu, button);
  });
  bar.addEventListener('pointerover', (event) => {
    if (!openId) return;
    const button = event.target.closest('[data-menu]');
    if (!button || button.dataset.menu === openId) return;
    showMenu(button.dataset.menu, button);
  });
  document.getElementById('menu-pop').addEventListener('click', onMenuClick);
  document.getElementById('stage').addEventListener('pointerdown', (event) => {
    if (event.target.closest('#menubar, #menu-pop')) return;
    hideMenu();
  });
  onWindows(updateFront);
  updateFront();
}

function updateFront() {
  const label = document.getElementById('front-app');
  if (label) label.textContent = APP_LABELS[frontApp()] || 'Finder';
}

function hideMenu() {
  openId = null;
  const pop = document.getElementById('menu-pop');
  pop.hidden = true;
  pop.innerHTML = '';
  document.querySelectorAll('.menu-title.open').forEach((button) => button.classList.remove('open'));
  document.getElementById('menubar').classList.remove('menu-open');
}

function showMenu(id, anchor) {
  openId = id;
  const pop = document.getElementById('menu-pop');
  const items = menuItems(id);
  pop.innerHTML = items.map((item) => {
    if (item.sep) return '<div class="sep" role="separator"></div>';
    const disabled = item.enabled === false;
    return `<button type="button" class="menu-item${disabled ? ' disabled' : ''}" role="menuitem"
      ${disabled ? 'disabled' : ''}
      ${item.cmd ? `data-cmd="${esc(item.cmd)}"` : ''}
      ${item.launch ? `data-launch="${esc(item.launch)}"` : ''}>
      <span class="mi-label">${item.checked ? '<i class="check" aria-hidden="true">✓</i>' : ''}${esc(item.label)}</span>
      <span class="kbd">${esc(item.shortcut || '')}</span>
    </button>`;
  }).join('');
  pop.hidden = false;
  const rect = anchor.getBoundingClientRect();
  const stage = stageBox();
  const scale = stageScale();
  let left = (rect.left - stage.left) / scale;
  const top = (rect.bottom - stage.top) / scale - 1;
  pop.style.left = `${Math.max(0, left)}px`;
  pop.style.top = `${top}px`;
  if (left + pop.offsetWidth > 1024) {
    left = Math.max(0, 1024 - pop.offsetWidth - 2);
    pop.style.left = `${left}px`;
  }
  document.querySelectorAll('.menu-title').forEach((button) => {
    button.classList.toggle('open', button.dataset.menu === id);
  });
  document.getElementById('menubar').classList.add('menu-open');
}

function menuItems(id) {
  const app = frontApp();
  const finder = finderFront();
  const inTrash = finder?.folderId === 'trash';
  if (id === 'goat') {
    return [
      { label: 'About This Computer…', launch: 'about' },
      { sep: true },
      { label: 'SimpleText', launch: 'simpletext' },
      { label: 'Paint', launch: 'paint' },
      { label: 'Calculator', launch: 'calculator' },
      { label: 'Note Pad', launch: 'notepad' },
      { label: 'Scrapbook', launch: 'scrapbook' },
      { label: 'Puzzle', launch: 'puzzle' },
      { label: 'Brickout', launch: 'brickout' },
      { sep: true },
      { label: 'Control Panels', launch: 'controls' },
      { sep: true },
      { label: 'Shut Down', cmd: 'shutdown' },
    ];
  }
  if (id === 'file') {
    const finderOn = app === 'finder';
    return [
      { label: finderOn ? 'New Folder' : 'New', shortcut: '⌘N', cmd: 'new', enabled: app === 'finder' || app === 'simpletext' || app === 'paint' },
      { label: 'Open', shortcut: '⌘O', cmd: 'open', enabled: finderOn || app === 'simpletext' || app === 'paint' },
      { label: 'Close', shortcut: '⌘W', cmd: 'close', enabled: Boolean(front()) },
      { sep: true },
      { label: 'Save', shortcut: '⌘S', cmd: 'save', enabled: app === 'simpletext' || app === 'paint' },
      { label: 'Save As…', cmd: 'save-as', enabled: app === 'simpletext' || app === 'paint' },
      { sep: true },
      { label: 'Get Info', shortcut: '⌘I', cmd: 'info' },
      { label: 'Duplicate', cmd: 'duplicate', enabled: Boolean(primarySelection()) },
      { label: 'Rename', cmd: 'rename', enabled: Boolean(primarySelection()) && !inTrash },
      { label: inTrash ? 'Put Away' : 'Move to Trash', cmd: inTrash ? 'put-away' : 'trash', enabled: Boolean(primarySelection()) },
      { label: 'Empty Trash…', cmd: 'empty-trash' },
      { sep: true },
      { label: 'Quit', shortcut: '⌘Q', cmd: 'quit', enabled: app !== 'finder' },
    ];
  }
  if (id === 'edit') {
    return [
      { label: 'Undo', shortcut: '⌘Z', cmd: 'undo', enabled: app === 'paint' },
      { sep: true },
      { label: 'Cut', shortcut: '⌘X', cmd: 'cut' },
      { label: 'Copy', shortcut: '⌘C', cmd: 'copy' },
      { label: 'Paste', shortcut: '⌘V', cmd: 'paste' },
      { label: 'Select All', shortcut: '⌘A', cmd: 'select-all' },
    ];
  }
  if (id === 'view') {
    const view = finderView();
    return [
      { label: 'as Icons', cmd: 'view-icon', enabled: Boolean(finder), checked: Boolean(finder) && view === 'icon' },
      { label: 'as List', cmd: 'view-list', enabled: Boolean(finder), checked: Boolean(finder) && view === 'list' },
      { sep: true },
      { label: 'Clean Up', cmd: 'cleanup' },
    ];
  }
  if (id === 'special') {
    return [
      { label: 'Clean Up Desktop', cmd: 'cleanup-desktop' },
      { label: 'Empty Trash…', cmd: 'empty-trash' },
      { sep: true },
      { label: 'Sleep', cmd: 'sleep' },
      { label: 'Restart', cmd: 'restart' },
      { label: 'Shut Down', cmd: 'shutdown' },
    ];
  }
  if (id === 'help') {
    return [
      { label: 'Mac OS Help', launch: 'help' },
      { label: 'About This Desk', launch: 'about' },
    ];
  }
  if (id === 'apps') return appMenu();
  return [];
}

function appMenu() {
  const openApps = ['finder'];
  for (const win of findAppList()) {
    if (!openApps.includes(win.app)) openApps.push(win.app);
  }
  const current = frontApp();
  return openApps.map((app) => ({
    label: APP_LABELS[app] || app,
    cmd: `switch:${app}`,
    checked: app === current,
  }));
}

function findAppList() {
  return findApp('simpletext')
    .concat(findApp('paint'), findApp('calculator'), findApp('notepad'), findApp('scrapbook'), findApp('puzzle'), findApp('brickout'), findApp('controls'), findApp('about'), findApp('help'), findApp('info'), findApp('finder'));
}

function primarySelection() {
  const fromFinder = selectionIds();
  if (fromFinder) return fromFinder[0] || null;
  const desk = desktopSelection().filter((id) => id !== 'vol-hd' && id !== 'vol-trash');
  return desk[0] || desktopSelection()[0] || null;
}

function selectionList() {
  const fromFinder = selectionIds();
  if (fromFinder) return fromFinder;
  return desktopSelection();
}

function onMenuClick(event) {
  const item = event.target.closest('.menu-item');
  if (!item) return;
  if (item.disabled) {
    play('alert');
    flashBar();
    return;
  }
  const cmd = item.dataset.cmd || '';
  const launchId = item.dataset.launch || '';
  hideMenu();
  if (launchId) {
    launch(launchId);
    return;
  }
  run(cmd);
}

export function run(cmd) {
  if (!cmd || dialogIsOpen()) return;
  if (cmd.startsWith('switch:')) {
    const app = cmd.slice(7);
    if (app === 'finder') {
      const finderWins = findApp('finder');
      if (finderWins.length) bringAppForward('finder');
      else focus(null);
      return;
    }
    const wins = findApp(app);
    if (wins.length) bringAppForward(app);
    else launch(app);
    return;
  }
  const actions = {
    new: () => doNew(),
    open: () => doOpen(),
    close: () => { const win = front(); if (win) requestClose(win.id); },
    save: () => doSave(false),
    'save-as': () => doSave(true),
    info: () => doInfo(),
    duplicate: () => doDuplicate(),
    rename: () => doRename(),
    trash: () => doTrash(),
    'put-away': () => doPutAway(),
    'empty-trash': () => doEmpty(),
    quit: () => doQuit(),
    undo: () => undoFrontPaint(),
    cut: () => edit('cut'),
    copy: () => edit('copy'),
    paste: () => edit('paste'),
    'select-all': () => edit('selectAll'),
    'view-icon': () => setFinderView('icon'),
    'view-list': () => setFinderView('list'),
    cleanup: () => { if (finderFront()) cleanUpFinder(); else cleanUpDesktop(); },
    'cleanup-desktop': () => cleanUpDesktop(),
    sleep: () => sleepNow(),
    restart: () => document.dispatchEvent(new CustomEvent('os-restart')),
    shutdown: () => shutDown(),
  };
  const fn = actions[cmd];
  if (fn) fn();
  else play('alert');
}

function doNew() {
  const app = frontApp();
  if (app === 'simpletext') {
    launch('simpletext');
    return;
  }
  if (app === 'paint') {
    launch('paint');
    return;
  }
  if (app !== 'finder') {
    play('alert');
    return;
  }
  const finder = finderFront();
  if (finder && finder.folderId !== 'trash') {
    const node = createFolder(finder.folderId);
    finder.selected = new Set([node.id]);
    setTimeout(() => beginFinderRename(finder, node.id), 40);
    return;
  }
  if (finder?.folderId === 'trash') {
    play('alert');
    return;
  }
  const node = createFolder('desk');
  selectDesktop([node.id]);
  setTimeout(() => beginRename(node.id), 40);
}

async function doOpen() {
  const app = frontApp();
  if (app === 'finder') {
    const id = primarySelection();
    if (!id || id === 'vol-hd') {
      if (id === 'vol-hd' || !finderFront()) launch('finder', { folderId: 'hd' });
      else play('alert');
      return;
    }
    if (id === 'vol-trash') {
      launch('finder', { folderId: 'trash' });
      return;
    }
    openNode(id);
    return;
  }
  if (app === 'paint') {
    await openPaintFile();
    return;
  }
  if (app === 'simpletext') {
    await openTextFile();
    return;
  }
  play('alert');
}

function doSave(saveAs) {
  const app = frontApp();
  if (app === 'simpletext') saveFrontText(saveAs);
  else if (app === 'paint') saveFrontPaint(saveAs);
  else play('alert');
}

function doInfo() {
  const id = primarySelection();
  if (!id) {
    const finder = finderFront();
    if (finder) launch('info', { id: finder.folderId === 'trash' ? 'vol-trash' : (finder.folderId === 'hd' ? 'vol-hd' : finder.folderId) });
    else launch('info', { id: 'vol-hd' });
    return;
  }
  launch('info', { id });
}

function doDuplicate() {
  const id = primarySelection();
  if (!id || id.startsWith('vol-')) {
    play('alert');
    return;
  }
  if (!duplicate(id)) play('alert');
}

function doRename() {
  if (renameSelection()) return;
  const id = desktopSelection()[0];
  if (id) beginRename(id);
  else play('alert');
}

function doTrash() {
  const ids = selectionList().filter((id) => id !== 'vol-hd' && id !== 'vol-trash');
  if (!ids.length) {
    play('alert');
    return;
  }
  const count = moveToTrash(ids);
  if (count) play('trash');
  else play('alert');
}

function doPutAway() {
  const ids = selectionList();
  if (!putAway(ids)) play('alert');
}

async function doEmpty() {
  const count = trashCount();
  if (!count) {
    play('alert');
    await dialog({
      message: 'The Trash is already empty.',
      buttons: [{ id: 'ok', label: 'OK', default: true }],
    });
    return;
  }
  const result = await dialog({
    message: `Empty the Trash? ${count} item${count === 1 ? '' : 's'} will be removed from this computer.`,
    buttons: [
      { id: 'cancel', label: 'Cancel' },
      { id: 'ok', label: 'OK', default: true },
    ],
  });
  if (result.button === 'ok') {
    emptyTrash();
    play('trash');
  }
}

async function doQuit() {
  const app = frontApp();
  if (app === 'finder') {
    play('alert');
    flashBar();
    return;
  }
  const ids = findApp(app).map((win) => win.id);
  for (const id of ids) {
    const ok = await requestClose(id);
    if (!ok) return;
  }
}

function edit(command) {
  const el = document.activeElement;
  if (el && (el.tagName === 'TEXTAREA' || (el.tagName === 'INPUT' && el.type === 'text'))) {
    document.execCommand(command);
    return;
  }
  if (command === 'undo') undoFrontPaint();
  else play('alert');
}

function flashBar() {
  if (prefersReducedMotion()) return;
  const bar = document.getElementById('menubar');
  bar.classList.add('flash');
  setTimeout(() => bar.classList.remove('flash'), 70);
  setTimeout(() => bar.classList.add('flash'), 130);
  setTimeout(() => bar.classList.remove('flash'), 200);
}

export function sleepNow() {
  document.getElementById('sleep').hidden = false;
}

export function wake() {
  const sleep = document.getElementById('sleep');
  if (sleep.hidden) return false;
  sleep.hidden = true;
  return true;
}

async function shutDown() {
  const result = await dialog({
    message: 'Shut down the computer now?',
    buttons: [
      { id: 'cancel', label: 'Cancel' },
      { id: 'ok', label: 'Shut Down', default: true },
    ],
  });
  if (result.button !== 'ok') return;
  hideMenu();
  document.getElementById('shutdown').hidden = false;
}

export function isMenuOpen() {
  return Boolean(openId);
}

export function closeMenu() {
  hideMenu();
}

void close;
void openInfo;
