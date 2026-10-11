/** Goatshop 5.0 boot: chrome, marching ants, Photoshop-style keys. */
import './style.css';
import { closeDialog } from './dialogs.js';
import {
  activeDoc,
  addLayer,
  deselect,
  duplicateLayer,
  inverseSelection,
  layerSample,
  mergeDown,
  redo,
  selectAll,
  state,
  toggleQuickMask,
  undo,
} from './engine/doc.js';
import { changed, requestRender, runCommand } from './engine/util.js';
import {
  actualPixels,
  applyCrop,
  applyTransform,
  beginTransform,
  cancelGesture,
  clientToDoc,
  docToClient,
  fitDoc,
  nudgeBrush,
  stepZoom,
} from './tools.js';
import { cycleVariant, mount } from './ui.js';

const TOOL_KEYS = {
  v: 'move',
  m: 'marquee',
  l: 'lasso',
  w: 'wand',
  c: 'crop',
  b: 'brush',
  s: 'stamp',
  e: 'eraser',
  g: 'gradient',
  t: 'type',
  i: 'eyedropper',
  h: 'hand',
  z: 'zoom',
};

function typing(event) {
  const el = event.target;
  if (!el || !el.tagName) return false;
  const tag = el.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable;
}

function onKeyDown(event) {
  if (event.code === 'Space' && !typing(event)) {
    state.space = true;
    event.preventDefault();
    return;
  }
  if (typing(event) && event.key !== 'Escape') return;
  const key = event.key.toLowerCase();
  const ctrl = event.ctrlKey || event.metaKey;
  if (event.key === 'Escape') {
    const dialog = document.querySelector('[data-dialog]');
    if (dialog) {
      dialog.querySelector('[data-action=dialog-cancel]')?.click();
      if (document.querySelector('[data-dialog]')) closeDialog();
    }
    const doc = activeDoc();
    if (doc?.crop) doc.crop = null;
    cancelGesture(doc);
    event.preventDefault();
    return;
  }
  if (event.key === 'Enter' && !typing(event)) {
    const doc = activeDoc();
    if (doc?.transform) applyTransform(doc);
    else if (doc?.crop) applyCrop();
    return;
  }
  if (ctrl && key === 'z') {
    if (event.altKey || event.shiftKey) redo();
    else undo();
    event.preventDefault();
    return;
  }
  if (ctrl && key === 'y') { redo(); event.preventDefault(); return; }
  if (ctrl && key === 't') { beginTransform(); event.preventDefault(); return; }
  if (ctrl && key === 'j') { duplicateLayer(); event.preventDefault(); return; }
  if (ctrl && key === 'd' && event.shiftKey) { runCommand('select.reselect'); event.preventDefault(); return; }
  if (ctrl && key === 'd') { deselect(); event.preventDefault(); return; }
  if (ctrl && key === 'i' && event.shiftKey) { inverseSelection(); event.preventDefault(); return; }
  if (ctrl && key === 'a') { selectAll(); event.preventDefault(); return; }
  if (ctrl && key === 'c') { runCommand('edit.copy'); event.preventDefault(); return; }
  if (ctrl && key === 'x') { runCommand('edit.cut'); event.preventDefault(); return; }
  if (ctrl && key === 'v') { runCommand('edit.paste'); event.preventDefault(); return; }
  if (ctrl && key === 'n' && event.shiftKey) { addLayer(); event.preventDefault(); return; }
  if (ctrl && key === 'n') { runCommand('file.new'); event.preventDefault(); return; }
  if (ctrl && key === 'o') { runCommand('file.open'); event.preventDefault(); return; }
  if (ctrl && key === 's') { runCommand('file.saveGoat'); event.preventDefault(); return; }
  if (ctrl && key === 'w') { runCommand('file.close'); event.preventDefault(); return; }
  if (ctrl && key === 'e') { mergeDown(); event.preventDefault(); return; }
  if (ctrl && key === 'f') { runCommand('filter.last'); event.preventDefault(); return; }
  if (ctrl && (key === '=' || key === '+')) { const d = activeDoc(); if (d) stepZoom(d, 1); event.preventDefault(); return; }
  if (ctrl && key === '-') { const d = activeDoc(); if (d) stepZoom(d, -1); event.preventDefault(); return; }
  if (ctrl && key === '0') { const d = activeDoc(); if (d) fitDoc(d); event.preventDefault(); return; }
  if (ctrl && key === '1') { const d = activeDoc(); if (d) actualPixels(d); event.preventDefault(); return; }
  if (event.key === 'Tab') {
    state.palettesHidden = !state.palettesHidden;
    changed();
    event.preventDefault();
    return;
  }
  if (typing(event)) return;
  if (key === '[') { nudgeBrush(event.shiftKey ? -10 : -1); return; }
  if (key === ']') { nudgeBrush(event.shiftKey ? 10 : 1); return; }
  if (key === 'd') { state.fg = '#000000'; state.bg = '#ffffff'; changed(); return; }
  if (key === 'x') { const t = state.fg; state.fg = state.bg; state.bg = t; changed(); return; }
  if (key === 'q') { toggleQuickMask(); return; }
  if (event.shiftKey && key === 'm') { cycleVariant('marquee'); return; }
  if (event.shiftKey && key === 'l') { cycleVariant('lasso'); return; }
  const tool = TOOL_KEYS[key];
  if (tool && !ctrl && !event.altKey && key.length === 1) {
    state.tool = tool;
    changed();
  }
}

function onKeyUp(event) {
  if (event.code === 'Space') state.space = false;
}

mount();

window.addEventListener('keydown', onKeyDown);
window.addEventListener('keyup', onKeyUp);

window.setInterval(() => {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const doc = activeDoc();
  if (!doc?.selection || doc.quickMask) return;
  state.antsPhase = (state.antsPhase + 1) % 8;
  requestRender();
}, 90);

window.goatshop = {
  state,
  sample(x, y) {
    const doc = activeDoc();
    if (!doc) return [0, 0, 0, 0];
    return layerSample(doc, x, y);
  },
  docToClient(x, y) {
    return docToClient(activeDoc(), x, y);
  },
  clientToDoc(x, y) {
    return clientToDoc(activeDoc(), x, y);
  },
  setFg(hex) {
    state.fg = hex;
    changed();
  },
  setBrush(size, hardness) {
    state.opts.brush.size = size;
    if (hardness != null) state.opts.brush.hardness = hardness;
    if (state.tool === 'pencil') state.opts.pencil.size = size;
    changed();
  },
};
