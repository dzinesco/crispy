/**
 * Goatshop documents: layers, history, compositing, selections.
 * Layer pixels live on offscreen canvases. The flattened composite is
 * another offscreen canvas blitted to the visible view.
 */
import {
  BLENDS,
  blendOp,
  changed,
  cloneCanvas,
  clamp,
  copyInto,
  createCanvas,
  getCtx,
  hexToRgb,
  resetCtx,
  scratch,
  uid,
} from './util.js';

export { BLENDS, blendOp };

export const state = {
  docs: [],
  activeId: null,
  tool: 'brush',
  variant: {
    marquee: 'rect',
    lasso: 'free',
    focus: 'blur',
    tone: 'dodge',
  },
  fg: '#000000',
  bg: '#ffffff',
  opts: {
    marquee: { feather: 0, antialias: true },
    lasso: { feather: 0, antialias: true },
    wand: { tolerance: 32, contiguous: true, sampleAll: false },
    bucket: { tolerance: 32, contiguous: true, opacity: 1 },
    brush: { size: 17, hardness: 80, opacity: 1, spacing: 0.25, flow: 1 },
    airbrush: { size: 29, hardness: 0, opacity: 1, spacing: 0.08, flow: 0.18 },
    pencil: { size: 1, opacity: 1 },
    eraser: { size: 17, hardness: 100, opacity: 1 },
    stamp: { size: 31, hardness: 70, opacity: 1, spacing: 0.2, aligned: true },
    history: { size: 31, hardness: 60, opacity: 1, spacing: 0.2 },
    line: { width: 2 },
    gradient: { opacity: 1, kind: 'linear' },
    focus: { size: 29, strength: 50 },
    tone: { size: 29, exposure: 40, range: 'midtones' },
    type: { font: 'Tahoma', size: 36 },
  },
  panels: {
    options: true,
    tools: true,
    nav: true,
    color: true,
    layers: true,
    history: true,
  },
  palettesHidden: false,
  showGrid: false,
  showRulers: true,
  snapGuides: true,
  guideDrag: null,
  status: 'Ready',
  busy: false,
  cloneSource: null,
  clipboard: null,
  lastFilter: null,
  antsPhase: 0,
};

let untitled = 1;

export function activeDoc() {
  return state.docs.find((doc) => doc.id === state.activeId) || null;
}

export function activeLayer(doc = activeDoc()) {
  if (!doc) return null;
  return doc.layers.find((layer) => layer.id === doc.activeId) || doc.layers.at(-1) || null;
}

export function toolOpts(id = state.tool) {
  return state.opts[id] || state.opts.brush;
}

export function setStatus(text) {
  state.status = text;
  const el = document.querySelector('[data-status]');
  if (el) el.textContent = text;
}

function defaultEffects() {
  return {
    dropShadow: {
      enabled: false,
      color: '#000000',
      opacity: 0.75,
      angle: 120,
      distance: 8,
      size: 6,
    },
  };
}

function cloneEffects(effects) {
  const src = effects || defaultEffects();
  return { dropShadow: { ...defaultEffects().dropShadow, ...(src.dropShadow || {}) } };
}

function makeLayer(doc, name, isBackground) {
  return {
    id: uid('l'),
    name,
    visible: true,
    locked: false,
    isBackground: !!isBackground,
    opacity: 1,
    blend: 'normal',
    x: 0,
    y: 0,
    kind: 'pixel',
    text: null,
    effects: defaultEffects(),
    mask: null,
    maskOn: true,
    maskTarget: false,
    canvas: createCanvas(doc.width, doc.height),
    rev: 1,
  };
}

export function createDocument({
  name,
  width,
  height,
  resolution = 72,
  background = 'white',
  draw,
} = {}) {
  const doc = {
    id: uid('d'),
    name: name || `Untitled-${untitled}`,
    width: clamp(Math.round(width || 640), 1, 4096),
    height: clamp(Math.round(height || 480), 1, 4096),
    resolution: clamp(Math.round(resolution || 72), 1, 2400),
    layers: [],
    activeId: null,
    selection: null,
    lastSelection: null,
    channel: 'rgb',
    quickMask: false,
    qm: null,
    paths: [],
    activePathId: null,
    guides: [],
    zoom: 1,
    panX: 16,
    panY: 16,
    win: {
      x: 28 + (state.docs.length % 5) * 26,
      y: 28 + (state.docs.length % 5) * 26,
      w: 560,
      h: 420,
      z: state.docs.length + 1,
    },
    history: null,
    gesture: null,
    transform: null,
    crop: null,
    flat: null,
    ants: null,
    flatDirty: true,
    antsDirty: true,
    dirty: false,
  };
  if (!name) untitled += 1;
  if (background === 'transparent') {
    const layer = makeLayer(doc, 'Layer 1', false);
    doc.layers = [layer];
    doc.activeId = layer.id;
  } else {
    const layer = makeLayer(doc, 'Background', true);
    const ctx = getCtx(layer.canvas);
    resetCtx(ctx);
    ctx.fillStyle = background === 'background' ? state.bg : '#ffffff';
    ctx.fillRect(0, 0, doc.width, doc.height);
    doc.layers = [layer];
    doc.activeId = layer.id;
  }
  if (draw) draw(doc);
  ensureBuffers(doc);
  initHistory(doc);
  state.docs.push(doc);
  state.activeId = doc.id;
  changed();
  return doc;
}

export function closeDocument(id) {
  const index = state.docs.findIndex((doc) => doc.id === id);
  if (index < 0) return;
  state.docs.splice(index, 1);
  if (state.activeId === id) state.activeId = state.docs.at(-1)?.id || null;
  changed();
}

export function focusDoc(id) {
  const doc = state.docs.find((item) => item.id === id);
  if (!doc) return;
  state.activeId = id;
  const top = Math.max(0, ...state.docs.map((item) => item.win.z));
  doc.win.z = top + 1;
  changed();
}

function ensureBuffers(doc) {
  if (!doc.flat || doc.flat.width !== doc.width || doc.flat.height !== doc.height) {
    doc.flat = createCanvas(doc.width, doc.height);
    doc.flatDirty = true;
  }
  if (!doc.ants || doc.ants.width !== doc.width || doc.ants.height !== doc.height) {
    doc.ants = createCanvas(doc.width, doc.height);
    doc.antsDirty = true;
  }
}

function shadowKey(effect) {
  return `${effect.color}|${effect.opacity}|${effect.angle}|${effect.distance}|${effect.size}`;
}

function ensureShadow(layer) {
  const effect = layer.effects?.dropShadow;
  if (!effect?.enabled) return null;
  if (layer._shadow && layer._shadowRev === layer.rev && layer._shadowKey === shadowKey(effect)) {
    return layer._shadow;
  }
  const canvas = createCanvas(layer.canvas.width, layer.canvas.height);
  const ctx = getCtx(canvas);
  resetCtx(ctx);
  const rad = (effect.angle * Math.PI) / 180;
  const dx = -Math.cos(rad) * effect.distance;
  const dy = Math.sin(rad) * effect.distance;
  try {
    ctx.filter = `blur(${Math.max(0, effect.size)}px)`;
  } catch {
    ctx.filter = 'none';
  }
  ctx.drawImage(layer.canvas, dx, dy);
  ctx.filter = 'none';
  ctx.globalCompositeOperation = 'source-in';
  ctx.fillStyle = effect.color || '#000000';
  ctx.globalAlpha = effect.opacity ?? 0.75;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  layer._shadow = canvas;
  layer._shadowRev = layer.rev;
  layer._shadowKey = shadowKey(effect);
  return canvas;
}

function blitLayer(dest, doc, layer) {
  const { canvas: tmp, ctx } = scratch(doc.width, doc.height, 0);
  if (layer.effects?.dropShadow?.enabled) {
    const shadow = ensureShadow(layer);
    if (shadow) ctx.drawImage(shadow, layer.x, layer.y);
  }
  const gesture = doc.gesture && doc.gesture.layerId === layer.id ? doc.gesture : null;
  if (gesture?.kind === 'replace' && gesture.work) {
    ctx.drawImage(gesture.work, layer.x, layer.y);
  } else if (doc.transform && doc.transform.layerId === layer.id) {
    ctx.drawImage(layer.canvas, layer.x, layer.y);
  } else {
    ctx.drawImage(layer.canvas, layer.x, layer.y);
    if (gesture?.kind === 'float' && gesture.float) {
      ctx.drawImage(gesture.float, layer.x + (gesture.dx || 0), layer.y + (gesture.dy || 0));
    }
    if (gesture?.overlay && (gesture.kind === 'paint' || gesture.kind === 'erase' || gesture.kind === 'stamp')) {
      ctx.save();
      ctx.globalAlpha = gesture.opacity ?? 1;
      ctx.globalCompositeOperation = gesture.kind === 'erase' ? 'destination-out' : 'source-over';
      if (doc.selection && !doc.quickMask && gesture.clip !== false) {
        const clip = scratch(doc.width, doc.height, 1);
        clip.ctx.drawImage(gesture.overlay, 0, 0);
        clip.ctx.globalCompositeOperation = 'destination-in';
        clip.ctx.drawImage(doc.selection, 0, 0);
        ctx.drawImage(clip.canvas, 0, 0);
      } else {
        ctx.drawImage(gesture.overlay, 0, 0);
      }
      ctx.restore();
    }
  }
  if (layer.mask && layer.maskOn) {
    ctx.globalCompositeOperation = 'destination-in';
    ctx.drawImage(layer.mask, layer.x, layer.y);
    ctx.globalCompositeOperation = 'source-over';
  }
  dest.save();
  dest.globalAlpha = layer.opacity;
  dest.globalCompositeOperation = blendOp(layer.blend);
  dest.drawImage(tmp, 0, 0);
  dest.restore();
}

export function paintFlat(doc) {
  ensureBuffers(doc);
  const ctx = getCtx(doc.flat);
  resetCtx(ctx);
  ctx.clearRect(0, 0, doc.width, doc.height);
  for (const layer of doc.layers) {
    if (!layer.visible || layer.opacity <= 0) continue;
    blitLayer(ctx, doc, layer);
  }
}

export function ensureFlat(doc) {
  if (!doc) return null;
  if (doc.flatDirty || doc.gesture || doc.transform) {
    paintFlat(doc);
    if (!doc.gesture && !doc.transform) doc.flatDirty = false;
  }
  return doc.flat;
}

export function mark(doc, layer) {
  if (layer) {
    layer.rev += 1;
    layer._shadow = null;
  }
  if (doc) doc.flatDirty = true;
}

export function renderText(doc, layer) {
  const ctx = getCtx(layer.canvas);
  resetCtx(ctx);
  ctx.clearRect(0, 0, doc.width, doc.height);
  const text = layer.text;
  if (!text?.value) {
    mark(doc, layer);
    return;
  }
  ctx.font = `${text.size}px ${text.font || 'Tahoma'}`;
  ctx.fillStyle = text.color || '#000000';
  ctx.textBaseline = 'top';
  const lines = String(text.value).split('\n');
  lines.forEach((line, index) => {
    ctx.fillText(line, text.x, text.y + index * text.size * 1.25);
  });
  mark(doc, layer);
}

function layerRecord(layer, canvas, mask) {
  return {
    id: layer.id,
    name: layer.name,
    visible: layer.visible,
    locked: layer.locked,
    isBackground: layer.isBackground,
    opacity: layer.opacity,
    blend: layer.blend,
    x: layer.x,
    y: layer.y,
    kind: layer.kind,
    text: layer.text ? { ...layer.text } : null,
    effects: cloneEffects(layer.effects),
    maskOn: layer.maskOn,
    canvas,
    mask,
  };
}

function capture(doc, dirty) {
  const prev = doc.history?.entries?.[doc.history.cursor];
  return {
    label: '',
    width: doc.width,
    height: doc.height,
    resolution: doc.resolution,
    activeId: doc.activeId,
    channel: doc.channel,
    paths: doc.paths.map((path) => ({
      ...path,
      points: path.points.map((point) => ({ ...point })),
    })),
    activePathId: doc.activePathId,
    guides: (doc.guides || []).map((guide) => ({ id: guide.id, axis: guide.axis, pos: guide.pos })),
    layers: doc.layers.map((layer) => {
      const prevLayer = prev?.layers.find((item) => item.id === layer.id);
      const isDirty = !prevLayer || dirty?.has(layer.id);
      return layerRecord(
        layer,
        isDirty ? cloneCanvas(layer.canvas) : prevLayer.canvas,
        layer.mask ? (isDirty || !prevLayer?.mask ? cloneCanvas(layer.mask) : prevLayer.mask) : null,
      );
    }),
    selection: doc.selection
      ? (dirty?.has('selection') || !prev?.selection ? cloneCanvas(doc.selection) : prev.selection)
      : null,
  };
}

export function initHistory(doc) {
  doc.history = { entries: [], cursor: -1, limit: 40, brushSource: 0, snaps: [] };
  const entry = capture(doc, new Set(['selection', ...doc.layers.map((layer) => layer.id)]));
  entry.label = 'New';
  doc.history.entries.push(entry);
  doc.history.cursor = 0;
}

export function commit(doc, label, dirty = new Set()) {
  if (!doc?.history) return;
  const history = doc.history;
  history.entries.splice(history.cursor + 1);
  const entry = capture(doc, dirty);
  entry.label = label;
  history.entries.push(entry);
  while (history.entries.length > history.limit) {
    history.entries.shift();
    if (history.brushSource > 0) history.brushSource -= 1;
  }
  history.cursor = history.entries.length - 1;
  doc.dirty = label !== 'New';
  doc.flatDirty = true;
  doc.antsDirty = dirty.has('selection') || doc.antsDirty;
  changed();
}

function restore(doc, entry) {
  doc.width = entry.width;
  doc.height = entry.height;
  doc.resolution = entry.resolution;
  doc.channel = entry.channel || 'rgb';
  doc.paths = (entry.paths || []).map((path) => ({
    ...path,
    points: path.points.map((point) => ({ ...point })),
  }));
  doc.activePathId = entry.activePathId || null;
  doc.guides = Array.isArray(entry.guides)
    ? entry.guides.map((guide) => ({ id: guide.id, axis: guide.axis, pos: guide.pos }))
    : (doc.guides || []);
  doc.layers = entry.layers.map((layer) => ({
    ...layer,
    text: layer.text ? { ...layer.text } : null,
    effects: cloneEffects(layer.effects),
    canvas: cloneCanvas(layer.canvas),
    mask: layer.mask ? cloneCanvas(layer.mask) : null,
    maskTarget: false,
    rev: 1,
  }));
  doc.activeId = doc.layers.some((layer) => layer.id === entry.activeId)
    ? entry.activeId
    : doc.layers.at(-1).id;
  doc.selection = entry.selection ? cloneCanvas(entry.selection) : null;
  doc.gesture = null;
  doc.transform = null;
  doc.crop = null;
  doc.quickMask = false;
  doc.flatDirty = true;
  doc.antsDirty = true;
  ensureBuffers(doc);
}

export function undo(doc = activeDoc()) {
  if (!doc || doc.history.cursor <= 0) return;
  doc.history.cursor -= 1;
  restore(doc, doc.history.entries[doc.history.cursor]);
  setStatus('Undo');
  changed();
}

export function redo(doc = activeDoc()) {
  if (!doc || doc.history.cursor >= doc.history.entries.length - 1) return;
  doc.history.cursor += 1;
  restore(doc, doc.history.entries[doc.history.cursor]);
  setStatus('Redo');
  changed();
}

export function jumpHistory(doc, index) {
  if (!doc || !doc.history.entries[index]) return;
  doc.history.cursor = index;
  restore(doc, doc.history.entries[index]);
  changed();
}

export function takeSnapshot(doc = activeDoc(), name) {
  if (!doc) return;
  const entry = capture(doc, new Set(['selection', ...doc.layers.map((layer) => layer.id)]));
  entry.label = name || `Snapshot ${doc.history.snaps.length + 1}`;
  doc.history.snaps.push({ name: entry.label, entry });
  setStatus(entry.label);
  changed();
}

export function jumpSnapshot(doc, index) {
  const snap = doc.history.snaps[index];
  if (!snap) return;
  restore(doc, snap.entry);
  commit(doc, snap.name, new Set(['selection', ...doc.layers.map((layer) => layer.id)]));
}

export function setHistoryBrush(doc, index) {
  doc.history.brushSource = index;
  changed();
}

export function historySourceCanvas(doc, layerId) {
  const entry = doc.history.entries[doc.history.brushSource];
  return entry?.layers.find((layer) => layer.id === layerId)?.canvas || null;
}

export function addLayer(doc = activeDoc(), name) {
  if (!doc) return null;
  const layer = makeLayer(doc, name || `Layer ${doc.layers.length}`, false);
  const index = Math.max(0, doc.layers.findIndex((item) => item.id === doc.activeId));
  doc.layers.splice(index + 1, 0, layer);
  doc.activeId = layer.id;
  commit(doc, 'New Layer', new Set([layer.id]));
  return layer;
}

export function duplicateLayer(doc = activeDoc()) {
  const layer = activeLayer(doc);
  if (!doc || !layer) return;
  const copy = makeLayer(doc, `${layer.name} copy`, false);
  copy.opacity = layer.opacity;
  copy.blend = layer.blend;
  copy.x = layer.x;
  copy.y = layer.y;
  copy.kind = layer.kind;
  copy.text = layer.text ? { ...layer.text } : null;
  copy.effects = cloneEffects(layer.effects);
  copyInto(copy.canvas, layer.canvas);
  if (layer.mask) {
    copy.mask = cloneCanvas(layer.mask);
    copy.maskOn = layer.maskOn;
  }
  const index = doc.layers.findIndex((item) => item.id === layer.id);
  doc.layers.splice(index + 1, 0, copy);
  doc.activeId = copy.id;
  commit(doc, 'Duplicate Layer', new Set([copy.id]));
}

export function deleteLayer(doc = activeDoc()) {
  const layer = activeLayer(doc);
  if (!doc || !layer || doc.layers.length < 2) return;
  const index = doc.layers.findIndex((item) => item.id === layer.id);
  doc.layers.splice(index, 1);
  doc.activeId = doc.layers[Math.max(0, index - 1)].id;
  commit(doc, 'Delete Layer', new Set());
}

export function reorderLayer(doc, fromIndex, toIndex) {
  if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0) return;
  const [layer] = doc.layers.splice(fromIndex, 1);
  doc.layers.splice(toIndex, 0, layer);
  commit(doc, 'Reorder Layer', new Set());
}

export function mergeDown(doc = activeDoc()) {
  const layer = activeLayer(doc);
  if (!doc || !layer) return;
  const index = doc.layers.findIndex((item) => item.id === layer.id);
  if (index <= 0) return;
  const below = doc.layers[index - 1];
  const merged = createCanvas(doc.width, doc.height);
  const ctx = getCtx(merged);
  resetCtx(ctx);
  ctx.drawImage(below.canvas, below.x, below.y);
  ctx.save();
  ctx.globalAlpha = layer.opacity;
  ctx.globalCompositeOperation = blendOp(layer.blend);
  if (layer.mask && layer.maskOn) {
    const clip = scratch(doc.width, doc.height, 2);
    clip.ctx.drawImage(layer.canvas, layer.x, layer.y);
    clip.ctx.globalCompositeOperation = 'destination-in';
    clip.ctx.drawImage(layer.mask, layer.x, layer.y);
    ctx.drawImage(clip.canvas, 0, 0);
  } else {
    ctx.drawImage(layer.canvas, layer.x, layer.y);
  }
  ctx.restore();
  below.canvas = merged;
  below.x = 0;
  below.y = 0;
  below.kind = 'pixel';
  below.rev += 1;
  doc.layers.splice(index, 1);
  doc.activeId = below.id;
  commit(doc, 'Merge Down', new Set([below.id]));
}

export function flatten(doc = activeDoc()) {
  if (!doc) return;
  ensureFlat(doc);
  const layer = makeLayer(doc, 'Background', true);
  getCtx(layer.canvas).drawImage(doc.flat, 0, 0);
  doc.layers = [layer];
  doc.activeId = layer.id;
  doc.selection = null;
  commit(doc, 'Flatten', new Set([layer.id, 'selection']));
}

export function addMask(doc = activeDoc()) {
  const layer = activeLayer(doc);
  if (!doc || !layer) return;
  const mask = createCanvas(doc.width, doc.height);
  const ctx = getCtx(mask);
  resetCtx(ctx);
  if (doc.selection) {
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, doc.width, doc.height);
    ctx.drawImage(doc.selection, 0, 0);
  } else {
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, doc.width, doc.height);
  }
  layer.mask = mask;
  layer.maskOn = true;
  layer.maskTarget = true;
  commit(doc, 'Add Layer Mask', new Set([layer.id]));
}

function selectionFromMask(doc, maskCanvas) {
  doc.selection = maskCanvas;
  doc.antsDirty = true;
  doc.flatDirty = true;
}

export function selectAll(doc = activeDoc()) {
  if (!doc) return;
  const canvas = createCanvas(doc.width, doc.height);
  const ctx = getCtx(canvas);
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, doc.width, doc.height);
  selectionFromMask(doc, canvas);
  commit(doc, 'Select All', new Set(['selection']));
}

export function deselect(doc = activeDoc()) {
  if (!doc?.selection) return;
  doc.lastSelection = cloneCanvas(doc.selection);
  doc.selection = null;
  doc.antsDirty = true;
  commit(doc, 'Deselect', new Set(['selection']));
}

export function reselect(doc = activeDoc()) {
  if (!doc?.lastSelection) return;
  doc.selection = cloneCanvas(doc.lastSelection);
  doc.antsDirty = true;
  commit(doc, 'Reselect', new Set(['selection']));
}

export function inverseSelection(doc = activeDoc()) {
  if (!doc) return;
  const canvas = createCanvas(doc.width, doc.height);
  const ctx = getCtx(canvas);
  resetCtx(ctx);
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, doc.width, doc.height);
  if (doc.selection) {
    ctx.globalCompositeOperation = 'destination-out';
    ctx.drawImage(doc.selection, 0, 0);
  }
  selectionFromMask(doc, canvas);
  commit(doc, 'Inverse', new Set(['selection']));
}

export function featherSelection(doc, radius) {
  if (!doc?.selection || radius <= 0) return;
  const canvas = createCanvas(doc.width, doc.height);
  const ctx = getCtx(canvas);
  resetCtx(ctx);
  ctx.filter = `blur(${radius}px)`;
  ctx.drawImage(doc.selection, 0, 0);
  ctx.filter = 'none';
  selectionFromMask(doc, canvas);
  commit(doc, 'Feather', new Set(['selection']));
}

function drawShape(ctx, shape) {
  const { kind, x, y, w, h } = shape;
  ctx.beginPath();
  if (kind === 'ellipse') {
    ctx.ellipse(x + w / 2, y + h / 2, Math.abs(w) / 2, Math.abs(h) / 2, 0, 0, Math.PI * 2);
  } else {
    ctx.rect(x, y, w, h);
  }
  ctx.fill();
}

export function selectShape(doc, shape, mode = 'replace') {
  const canvas = createCanvas(doc.width, doc.height);
  const ctx = getCtx(canvas);
  resetCtx(ctx);
  if (mode === 'add' && doc.selection) ctx.drawImage(doc.selection, 0, 0);
  if (mode === 'subtract' && doc.selection) {
    ctx.drawImage(doc.selection, 0, 0);
    ctx.globalCompositeOperation = 'destination-out';
  }
  if (mode === 'replace' || mode === 'add' || !doc.selection) {
    ctx.fillStyle = '#fff';
  }
  drawShape(ctx, normalizeRect(shape));
  if (shape.feather > 0) {
    const blurred = createCanvas(doc.width, doc.height);
    const bctx = getCtx(blurred);
    bctx.filter = `blur(${shape.feather}px)`;
    bctx.drawImage(canvas, 0, 0);
    selectionFromMask(doc, blurred);
  } else {
    selectionFromMask(doc, canvas);
  }
  commit(doc, 'Selection', new Set(['selection']));
}

export function selectPolygon(doc, points, mode, feather) {
  if (!points || points.length < 3) return;
  const canvas = createCanvas(doc.width, doc.height);
  const ctx = getCtx(canvas);
  resetCtx(ctx);
  if (mode === 'add' && doc.selection) ctx.drawImage(doc.selection, 0, 0);
  if (mode === 'subtract' && doc.selection) {
    ctx.drawImage(doc.selection, 0, 0);
    ctx.globalCompositeOperation = 'destination-out';
  }
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y);
  ctx.closePath();
  ctx.fill();
  if (feather > 0) {
    const blurred = createCanvas(doc.width, doc.height);
    const bctx = getCtx(blurred);
    bctx.filter = `blur(${feather}px)`;
    bctx.drawImage(canvas, 0, 0);
    selectionFromMask(doc, blurred);
  } else selectionFromMask(doc, canvas);
  commit(doc, 'Lasso', new Set(['selection']));
}

function normalizeRect(shape) {
  let { x, y, w, h } = shape;
  if (w < 0) {
    x += w;
    w = -w;
  }
  if (h < 0) {
    y += h;
    h = -h;
  }
  return { ...shape, x, y, w, h };
}

function readPixels(canvas) {
  return getCtx(canvas).getImageData(0, 0, canvas.width, canvas.height);
}

function colorClose(data, index, r, g, b, tolerance) {
  return Math.abs(data[index] - r) <= tolerance
    && Math.abs(data[index + 1] - g) <= tolerance
    && Math.abs(data[index + 2] - b) <= tolerance;
}

export function floodMask(canvas, x, y, tolerance, contiguous) {
  const w = canvas.width;
  const h = canvas.height;
  const ix = clamp(Math.round(x), 0, w - 1);
  const iy = clamp(Math.round(y), 0, h - 1);
  const image = readPixels(canvas);
  const data = image.data;
  const mask = new Uint8Array(w * h);
  const start = (iy * w + ix) * 4;
  const sr = data[start];
  const sg = data[start + 1];
  const sb = data[start + 2];
  if (!contiguous) {
    for (let i = 0; i < w * h; i++) {
      if (colorClose(data, i * 4, sr, sg, sb, tolerance)) mask[i] = 1;
    }
    return mask;
  }
  const stack = [ix, iy];
  while (stack.length) {
    const cy = stack.pop();
    let cx = stack.pop();
    let i = cy * w + cx;
    while (cx >= 0 && !mask[i] && colorClose(data, i * 4, sr, sg, sb, tolerance)) {
      cx -= 1;
      i -= 1;
    }
    cx += 1;
    i += 1;
    let spanUp = false;
    let spanDown = false;
    while (cx < w && !mask[i] && colorClose(data, i * 4, sr, sg, sb, tolerance)) {
      mask[i] = 1;
      if (cy > 0) {
        const up = i - w;
        if (!mask[up] && colorClose(data, up * 4, sr, sg, sb, tolerance)) {
          if (!spanUp) {
            stack.push(cx, cy - 1);
            spanUp = true;
          }
        } else spanUp = false;
      }
      if (cy < h - 1) {
        const down = i + w;
        if (!mask[down] && colorClose(data, down * 4, sr, sg, sb, tolerance)) {
          if (!spanDown) {
            stack.push(cx, cy + 1);
            spanDown = true;
          }
        } else spanDown = false;
      }
      cx += 1;
      i += 1;
    }
  }
  return mask;
}

function maskToCanvas(doc, mask) {
  const canvas = createCanvas(doc.width, doc.height);
  const image = getCtx(canvas).createImageData(doc.width, doc.height);
  for (let i = 0; i < mask.length; i++) {
    if (!mask[i]) continue;
    const o = i * 4;
    image.data[o] = 255;
    image.data[o + 1] = 255;
    image.data[o + 2] = 255;
    image.data[o + 3] = 255;
  }
  getCtx(canvas).putImageData(image, 0, 0);
  return canvas;
}

export function wandSelect(doc, x, y) {
  const opts = state.opts.wand;
  const source = opts.sampleAll ? ensureFlat(doc) : (activeLayer(doc)?.canvas || ensureFlat(doc));
  const mask = floodMask(source, x, y, opts.tolerance, opts.contiguous);
  const canvas = maskToCanvas(doc, mask);
  if (opts.antialias) {
    const soft = createCanvas(doc.width, doc.height);
    const ctx = getCtx(soft);
    ctx.filter = 'blur(0.6px)';
    ctx.drawImage(canvas, 0, 0);
    selectionFromMask(doc, soft);
  } else selectionFromMask(doc, canvas);
  commit(doc, 'Magic Wand', new Set(['selection']));
}

export function bucketFill(doc, x, y) {
  const layer = activeLayer(doc);
  if (!doc || !layer || layer.locked) return;
  const opts = state.opts.bucket;
  const mask = floodMask(layer.canvas, x, y, opts.tolerance, opts.contiguous);
  const image = readPixels(layer.canvas);
  const sel = doc.selection ? readPixels(doc.selection).data : null;
  const { r, g, b } = hexToRgb(state.fg);
  const alpha = opts.opacity ?? 1;
  for (let i = 0; i < mask.length; i++) {
    if (!mask[i]) continue;
    const o = i * 4;
    if (sel && sel[o + 3] < 8) continue;
    const m = sel ? sel[o + 3] / 255 : 1;
    const k = alpha * m;
    image.data[o] = r * k + image.data[o] * (1 - k);
    image.data[o + 1] = g * k + image.data[o + 1] * (1 - k);
    image.data[o + 2] = b * k + image.data[o + 2] * (1 - k);
    image.data[o + 3] = Math.max(image.data[o + 3], alpha * 255 * m);
  }
  getCtx(layer.canvas).putImageData(image, 0, 0);
  mark(doc, layer);
  commit(doc, 'Fill', new Set([layer.id]));
}

export function fillSelection(doc, color, opacity = 1) {
  const layer = activeLayer(doc);
  if (!doc || !layer || layer.locked) return;
  const paint = createCanvas(doc.width, doc.height);
  const ctx = getCtx(paint);
  resetCtx(ctx);
  ctx.fillStyle = color;
  ctx.globalAlpha = opacity;
  ctx.fillRect(0, 0, doc.width, doc.height);
  if (doc.selection) {
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'destination-in';
    ctx.drawImage(doc.selection, 0, 0);
  }
  const dest = getCtx(layer.canvas);
  dest.save();
  dest.globalCompositeOperation = 'source-over';
  dest.drawImage(paint, 0, 0);
  dest.restore();
  mark(doc, layer);
  commit(doc, 'Fill', new Set([layer.id]));
}

export function strokeSelection(doc, color, width) {
  const layer = activeLayer(doc);
  if (!doc?.selection || !layer || layer.locked) return;
  const ring = createCanvas(doc.width, doc.height);
  const ctx = getCtx(ring);
  resetCtx(ctx);
  const steps = 16;
  const radius = Math.max(1, width / 2);
  for (let i = 0; i < steps; i++) {
    const a = (i / steps) * Math.PI * 2;
    ctx.drawImage(doc.selection, Math.cos(a) * radius, Math.sin(a) * radius);
  }
  ctx.globalCompositeOperation = 'destination-out';
  ctx.drawImage(doc.selection, 0, 0);
  ctx.globalCompositeOperation = 'source-in';
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, doc.width, doc.height);
  getCtx(layer.canvas).drawImage(ring, 0, 0);
  mark(doc, layer);
  commit(doc, 'Stroke', new Set([layer.id]));
}

export function growSelection(doc = activeDoc()) {
  const layer = activeLayer(doc);
  if (!doc?.selection || !layer) return;
  const tolerance = state.opts.wand.tolerance;
  const src = readPixels(layer.canvas).data;
  const sel = readPixels(doc.selection).data;
  const w = doc.width;
  const h = doc.height;
  const mask = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) if (sel[i * 4 + 3] > 128) mask[i] = 1;
  const queue = [];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (!mask[i]) continue;
      const neighbors = [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]];
      if (neighbors.some(([nx, ny]) => nx >= 0 && ny >= 0 && nx < w && ny < h && !mask[ny * w + nx])) {
        queue.push(x, y);
      }
    }
  }
  const seen = new Uint8Array(w * h);
  let q = 0;
  while (q < queue.length) {
    const x = queue[q++];
    const y = queue[q++];
    const i = y * w + x;
    const base = i * 4;
    const neighbors = [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]];
    for (const [nx, ny] of neighbors) {
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      const ni = ny * w + nx;
      if (mask[ni] || seen[ni]) continue;
      if (!colorClose(src, ni * 4, src[base], src[base + 1], src[base + 2], tolerance)) continue;
      seen[ni] = 1;
      mask[ni] = 1;
      queue.push(nx, ny);
    }
  }
  selectionFromMask(doc, maskToCanvas(doc, mask));
  commit(doc, 'Grow', new Set(['selection']));
}

export function rebuildAnts(doc) {
  ensureBuffers(doc);
  const ctx = getCtx(doc.ants);
  resetCtx(ctx);
  ctx.clearRect(0, 0, doc.width, doc.height);
  if (!doc.selection) {
    doc.antsDirty = false;
    return;
  }
  const src = readPixels(doc.selection).data;
  const image = ctx.createImageData(doc.width, doc.height);
  const w = doc.width;
  const h = doc.height;
  const out = image.data;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      if (src[i + 3] < 128) continue;
      const edge = x === 0 || y === 0 || x === w - 1 || y === h - 1
        || src[i - 4 + 3] < 128
        || src[i + 4 + 3] < 128
        || src[i - w * 4 + 3] < 128
        || src[i + w * 4 + 3] < 128;
      if (!edge) continue;
      out[i] = 255;
      out[i + 1] = 255;
      out[i + 2] = 255;
      out[i + 3] = 255;
    }
  }
  ctx.putImageData(image, 0, 0);
  doc.antsDirty = false;
}

export function enterQuickMask(doc = activeDoc()) {
  if (!doc || doc.quickMask) return;
  const canvas = createCanvas(doc.width, doc.height);
  const ctx = getCtx(canvas);
  resetCtx(ctx);
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, doc.width, doc.height);
  if (doc.selection) {
    ctx.globalCompositeOperation = 'destination-out';
    ctx.drawImage(doc.selection, 0, 0);
  }
  doc.qm = canvas;
  doc.quickMask = true;
  changed();
}

export function exitQuickMask(doc = activeDoc()) {
  if (!doc?.quickMask) return;
  const canvas = createCanvas(doc.width, doc.height);
  const ctx = getCtx(canvas);
  resetCtx(ctx);
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, doc.width, doc.height);
  ctx.globalCompositeOperation = 'destination-out';
  if (doc.qm) ctx.drawImage(doc.qm, 0, 0);
  doc.selection = canvas;
  doc.quickMask = false;
  doc.qm = null;
  doc.antsDirty = true;
  commit(doc, 'Quick Mask', new Set(['selection']));
}

export function toggleQuickMask(doc = activeDoc()) {
  if (!doc) return;
  if (doc.quickMask) exitQuickMask(doc);
  else enterQuickMask(doc);
}

export async function applyPixelFilter(doc, name, params, label) {
  const layer = activeLayer(doc);
  if (!doc || !layer || layer.locked || state.busy) return;
  state.busy = true;
  setStatus(label || 'Applying…');
  changed('render');
  try {
    const ctx = getCtx(layer.canvas);
    const image = ctx.getImageData(0, 0, doc.width, doc.height);
    const { runFilter } = await import('./filters.js');
    const out = await runFilter(name, image.data, doc.width, doc.height, params);
    if (doc.selection) {
      const sel = readPixels(doc.selection).data;
      const next = image.data;
      for (let i = 0; i < next.length; i += 4) {
        const m = sel[i + 3] / 255;
        if (m <= 0) continue;
        next[i] = out[i] * m + next[i] * (1 - m);
        next[i + 1] = out[i + 1] * m + next[i + 1] * (1 - m);
        next[i + 2] = out[i + 2] * m + next[i + 2] * (1 - m);
        next[i + 3] = out[i + 3] * m + next[i + 3] * (1 - m);
      }
    } else {
      image.data.set(out);
    }
    ctx.putImageData(image, 0, 0);
    mark(doc, layer);
    state.lastFilter = { name, params, label };
    commit(doc, label || name, new Set([layer.id]));
    setStatus('Ready');
  } catch (error) {
    setStatus(error instanceof Error ? error.message : 'Filter failed');
  } finally {
    state.busy = false;
    changed();
  }
}

function resample(canvas, w, h, dx = 0, dy = 0) {
  const next = createCanvas(w, h);
  getCtx(next).drawImage(canvas, dx, dy);
  return next;
}

function rotateGuide(guide, turns, w, h) {
  if (turns === 2) return { ...guide, pos: guide.axis === 'v' ? w - guide.pos : h - guide.pos };
  if (turns === 1) {
    return guide.axis === 'v'
      ? { ...guide, axis: 'h', pos: w - guide.pos }
      : { ...guide, axis: 'v', pos: guide.pos };
  }
  return guide.axis === 'v'
    ? { ...guide, axis: 'h', pos: guide.pos }
    : { ...guide, axis: 'v', pos: h - guide.pos };
}

export function resizeImage(doc, width, height) {
  const w = clamp(Math.round(width), 1, 4096);
  const h = clamp(Math.round(height), 1, 4096);
  const sx = w / doc.width;
  const sy = h / doc.height;
  if (doc.guides?.length) {
    doc.guides = doc.guides.map((guide) => (
      guide.axis === 'v' ? { ...guide, pos: guide.pos * sx } : { ...guide, pos: guide.pos * sy }
    ));
  }
  for (const layer of doc.layers) {
    const next = createCanvas(w, h);
    const ctx = getCtx(next);
    ctx.drawImage(layer.canvas, 0, 0, w, h);
    layer.canvas = next;
    layer.x = Math.round(layer.x * sx);
    layer.y = Math.round(layer.y * sy);
    if (layer.mask) layer.mask = resample(layer.mask, w, h);
    layer.rev += 1;
  }
  if (doc.selection) {
    const next = createCanvas(w, h);
    getCtx(next).drawImage(doc.selection, 0, 0, w, h);
    doc.selection = next;
  }
  doc.width = w;
  doc.height = h;
  ensureBuffers(doc);
  doc.flatDirty = true;
  doc.antsDirty = true;
  commit(doc, 'Image Size', new Set(['selection', ...doc.layers.map((layer) => layer.id)]));
}

export function resizeCanvas(doc, width, height, anchor = 'center') {
  const w = clamp(Math.round(width), 1, 4096);
  const h = clamp(Math.round(height), 1, 4096);
  const ax = anchor.includes('w') ? 0 : anchor.includes('e') ? 1 : 0.5;
  const ay = anchor.includes('n') ? 0 : anchor.includes('s') ? 1 : 0.5;
  const dx = Math.round((w - doc.width) * ax);
  const dy = Math.round((h - doc.height) * ay);
  if (doc.guides?.length) {
    doc.guides = doc.guides.map((guide) => (
      guide.axis === 'v' ? { ...guide, pos: guide.pos + dx } : { ...guide, pos: guide.pos + dy }
    ));
  }
  for (const layer of doc.layers) {
    layer.canvas = resample(layer.canvas, w, h, dx + layer.x, dy + layer.y);
    layer.x = 0;
    layer.y = 0;
    if (layer.mask) layer.mask = resample(layer.mask, w, h, dx, dy);
    layer.rev += 1;
  }
  if (doc.selection) doc.selection = resample(doc.selection, w, h, dx, dy);
  doc.width = w;
  doc.height = h;
  ensureBuffers(doc);
  doc.flatDirty = true;
  doc.antsDirty = true;
  commit(doc, 'Canvas Size', new Set(['selection', ...doc.layers.map((layer) => layer.id)]));
}

function transformDoc(doc, nw, nh, draw) {
  for (const layer of doc.layers) {
    const next = createCanvas(nw, nh);
    draw(getCtx(next), layer.canvas, doc.width, doc.height, nw, nh);
    layer.canvas = next;
    layer.x = 0;
    layer.y = 0;
    if (layer.mask) {
      const mask = createCanvas(nw, nh);
      draw(getCtx(mask), layer.mask, doc.width, doc.height, nw, nh);
      layer.mask = mask;
    }
    layer.rev += 1;
  }
  if (doc.selection) {
    const next = createCanvas(nw, nh);
    draw(getCtx(next), doc.selection, doc.width, doc.height, nw, nh);
    doc.selection = next;
  }
  doc.width = nw;
  doc.height = nh;
  ensureBuffers(doc);
  doc.flatDirty = true;
  doc.antsDirty = true;
}

export function rotateDoc(doc, turns) {
  const w = doc.width;
  const h = doc.height;
  const quarter = ((turns % 4) + 4) % 4;
  if (quarter && doc.guides?.length) {
    doc.guides = doc.guides.map((guide) => rotateGuide(guide, quarter, w, h));
  }
  const swap = Math.abs(turns) === 1;
  const nw = swap ? doc.height : doc.width;
  const nh = swap ? doc.width : doc.height;
  transformDoc(doc, nw, nh, (ctx, src, w, h, dw, dh) => {
    resetCtx(ctx);
    ctx.translate(dw / 2, dh / 2);
    ctx.rotate((turns * Math.PI) / 2);
    ctx.drawImage(src, -w / 2, -h / 2);
  });
  commit(doc, 'Rotate', new Set(['selection', ...doc.layers.map((layer) => layer.id)]));
}

export function flipDoc(doc, axis) {
  const w = doc.width;
  const h = doc.height;
  if (doc.guides?.length) {
    doc.guides = doc.guides.map((guide) => {
      if (axis === 'h' && guide.axis === 'v') return { ...guide, pos: w - guide.pos };
      if (axis === 'v' && guide.axis === 'h') return { ...guide, pos: h - guide.pos };
      return guide;
    });
  }
  transformDoc(doc, doc.width, doc.height, (ctx, src, w, h) => {
    resetCtx(ctx);
    if (axis === 'h') {
      ctx.translate(w, 0);
      ctx.scale(-1, 1);
    } else {
      ctx.translate(0, h);
      ctx.scale(1, -1);
    }
    ctx.drawImage(src, 0, 0);
  });
  commit(doc, 'Flip', new Set(['selection', ...doc.layers.map((layer) => layer.id)]));
}

export function cropTo(doc, rect) {
  let { x, y, w, h } = normalizeRect(rect);
  x = clamp(Math.round(x), 0, doc.width - 1);
  y = clamp(Math.round(y), 0, doc.height - 1);
  w = clamp(Math.round(w), 1, doc.width - x);
  h = clamp(Math.round(h), 1, doc.height - y);
  if (doc.guides?.length) {
    doc.guides = doc.guides.map((guide) => (
      guide.axis === 'v' ? { ...guide, pos: guide.pos - x } : { ...guide, pos: guide.pos - y }
    ));
  }
  for (const layer of doc.layers) {
    const next = createCanvas(w, h);
    getCtx(next).drawImage(layer.canvas, layer.x - x, layer.y - y);
    layer.canvas = next;
    layer.x = 0;
    layer.y = 0;
    if (layer.mask) {
      const mask = createCanvas(w, h);
      getCtx(mask).drawImage(layer.mask, -x, -y);
      layer.mask = mask;
    }
    layer.rev += 1;
  }
  if (doc.selection) {
    const next = createCanvas(w, h);
    getCtx(next).drawImage(doc.selection, -x, -y);
    doc.selection = next;
  }
  doc.width = w;
  doc.height = h;
  doc.crop = null;
  ensureBuffers(doc);
  doc.flatDirty = true;
  doc.antsDirty = true;
  commit(doc, 'Crop', new Set(['selection', ...doc.layers.map((layer) => layer.id)]));
}

export function copySelection(doc = activeDoc(), cut = false) {
  const layer = activeLayer(doc);
  if (!doc || !layer) return;
  const canvas = createCanvas(doc.width, doc.height);
  const ctx = getCtx(canvas);
  resetCtx(ctx);
  ctx.drawImage(layer.canvas, 0, 0);
  if (doc.selection) {
    ctx.globalCompositeOperation = 'destination-in';
    ctx.drawImage(doc.selection, 0, 0);
  }
  state.clipboard = canvas;
  if (cut && !layer.locked) {
    const dest = getCtx(layer.canvas);
    dest.save();
    if (layer.isBackground) {
      dest.fillStyle = state.bg;
      if (doc.selection) {
        dest.globalCompositeOperation = 'source-over';
        const paint = scratch(doc.width, doc.height, 2);
        paint.ctx.fillStyle = state.bg;
        paint.ctx.fillRect(0, 0, doc.width, doc.height);
        paint.ctx.globalCompositeOperation = 'destination-in';
        paint.ctx.drawImage(doc.selection, 0, 0);
        dest.drawImage(paint.canvas, 0, 0);
      } else dest.fillRect(0, 0, doc.width, doc.height);
    } else if (doc.selection) {
      dest.globalCompositeOperation = 'destination-out';
      dest.drawImage(doc.selection, 0, 0);
    } else {
      dest.clearRect(0, 0, doc.width, doc.height);
    }
    dest.restore();
    mark(doc, layer);
    commit(doc, 'Cut', new Set([layer.id]));
  } else {
    setStatus('Copied');
  }
}

export function paste(doc = activeDoc()) {
  if (!doc || !state.clipboard) return;
  const layer = makeLayer(doc, 'Pasted', false);
  getCtx(layer.canvas).drawImage(state.clipboard, 0, 0);
  const index = Math.max(0, doc.layers.findIndex((item) => item.id === doc.activeId));
  doc.layers.splice(index + 1, 0, layer);
  doc.activeId = layer.id;
  commit(doc, 'Paste', new Set([layer.id]));
}

export function bakeGesture(doc) {
  const gesture = doc?.gesture;
  if (!gesture) return;
  const layer = doc.layers.find((item) => item.id === gesture.layerId);
  doc.gesture = null;
  if (!layer) return;
  if (gesture.kind === 'replace' && gesture.work) {
    copyInto(layer.canvas, gesture.work);
  } else if (gesture.kind === 'float' && gesture.float) {
    getCtx(layer.canvas).drawImage(gesture.float, gesture.dx || 0, gesture.dy || 0);
    if (doc.selection && (gesture.dx || gesture.dy)) {
      const next = createCanvas(doc.width, doc.height);
      getCtx(next).drawImage(doc.selection, gesture.dx || 0, gesture.dy || 0);
      doc.selection = next;
      doc.antsDirty = true;
    }
  } else if (gesture.overlay) {
    const ctx = getCtx(layer.canvas);
    ctx.save();
    ctx.globalAlpha = gesture.opacity ?? 1;
    ctx.globalCompositeOperation = gesture.kind === 'erase' ? 'destination-out' : 'source-over';
    if (doc.selection && !doc.quickMask && gesture.clip !== false) {
      const clip = scratch(doc.width, doc.height, 1);
      clip.ctx.drawImage(gesture.overlay, 0, 0);
      clip.ctx.globalCompositeOperation = 'destination-in';
      clip.ctx.drawImage(doc.selection, 0, 0);
      ctx.drawImage(clip.canvas, 0, 0);
    } else {
      ctx.drawImage(gesture.overlay, 0, 0);
    }
    ctx.restore();
    if (gesture.channel && gesture.channel !== 'rgb' && gesture.before) {
      const idx = { r: 0, g: 1, b: 2 }[gesture.channel];
      const before = readPixels(gesture.before);
      const after = readPixels(layer.canvas);
      for (let i = 0; i < after.data.length; i += 4) {
        for (let c = 0; c < 3; c++) if (c !== idx) after.data[i + c] = before.data[i + c];
      }
      getCtx(layer.canvas).putImageData(after, 0, 0);
    }
  } else {
    return;
  }
  mark(doc, layer);
  const dirty = new Set([layer.id]);
  if (gesture.kind === 'float') dirty.add('selection');
  commit(doc, gesture.label || 'Paint', dirty);
}

export function cancelGesture(doc) {
  if (!doc?.gesture && !doc?.transform) return;
  const entry = doc.history.entries[doc.history.cursor];
  doc.gesture = null;
  doc.transform = null;
  if (entry) restore(doc, entry);
  changed();
}

export function sampleColor(doc, x, y) {
  const flat = ensureFlat(doc);
  const ix = clamp(Math.floor(x), 0, doc.width - 1);
  const iy = clamp(Math.floor(y), 0, doc.height - 1);
  const pixel = getCtx(flat).getImageData(ix, iy, 1, 1).data;
  return [pixel[0], pixel[1], pixel[2], pixel[3]];
}

export function layerSample(doc, x, y) {
  const layer = activeLayer(doc);
  if (!layer) return [0, 0, 0, 0];
  const ix = clamp(Math.floor(x - layer.x), 0, layer.canvas.width - 1);
  const iy = clamp(Math.floor(y - layer.y), 0, layer.canvas.height - 1);
  const pixel = getCtx(layer.canvas).getImageData(ix, iy, 1, 1).data;
  return [pixel[0], pixel[1], pixel[2], pixel[3]];
}

export function pathToSelection(doc, path) {
  if (!path?.points?.length) return;
  const canvas = createCanvas(doc.width, doc.height);
  const ctx = getCtx(canvas);
  resetCtx(ctx);
  ctx.fillStyle = '#fff';
  tracePath(ctx, path);
  ctx.fill();
  selectionFromMask(doc, canvas);
  commit(doc, 'Path to Selection', new Set(['selection']));
}

export function tracePath(ctx, path) {
  const pts = path.points;
  if (!pts.length) return;
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) {
    const prev = pts[i - 1];
    const point = pts[i];
    ctx.bezierCurveTo(
      prev.x + (prev.outx || 0),
      prev.y + (prev.outy || 0),
      point.x + (point.inx || 0),
      point.y + (point.iny || 0),
      point.x,
      point.y,
    );
  }
  if (path.closed) ctx.closePath();
}

export function strokePath(doc, path) {
  const layer = activeLayer(doc);
  if (!doc || !layer || !path) return;
  const ctx = getCtx(layer.canvas);
  ctx.save();
  ctx.strokeStyle = state.fg;
  ctx.lineWidth = toolOpts('line').width || toolOpts('brush').size || 2;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  tracePath(ctx, path);
  ctx.stroke();
  ctx.restore();
  mark(doc, layer);
  commit(doc, 'Stroke Path', new Set([layer.id]));
}

export function fillPath(doc, path) {
  const layer = activeLayer(doc);
  if (!doc || !layer || !path) return;
  const ctx = getCtx(layer.canvas);
  ctx.save();
  ctx.fillStyle = state.fg;
  tracePath(ctx, path);
  ctx.fill();
  ctx.restore();
  mark(doc, layer);
  commit(doc, 'Fill Path', new Set([layer.id]));
}
