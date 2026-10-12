/** Photoshop 5 rulers and guides. Pixel units; the ruler toggle sticks for the browser session. */
import { activeDoc, commit, focusDoc, setStatus, state } from './engine/doc.js';
import { changed, requestRender, uid } from './engine/util.js';

export const RULER = 20;
const GUIDE = '#c4491d';
const RULER_KEY = 'goatshop-rulers';
const SNAP_KEY = 'goatshop-snap';
const SNAP_PX = 6;

export function loadViewPrefs() {
  try {
    const rulers = sessionStorage.getItem(RULER_KEY);
    if (rulers === '0' || rulers === '1') state.showRulers = rulers === '1';
    const snap = sessionStorage.getItem(SNAP_KEY);
    if (snap === '0' || snap === '1') state.snapGuides = snap === '1';
  } catch {
    /* private mode */
  }
}

function savePref(key, on) {
  try {
    sessionStorage.setItem(key, on ? '1' : '0');
  } catch {
    /* private mode */
  }
}

export function toggleRulers() {
  state.showRulers = !state.showRulers;
  savePref(RULER_KEY, state.showRulers);
  setStatus(state.showRulers ? 'Rulers on' : 'Rulers off');
  changed();
}

export function toggleSnap() {
  state.snapGuides = !state.snapGuides;
  savePref(SNAP_KEY, state.snapGuides);
  setStatus(state.snapGuides ? 'Snap to guides on' : 'Snap to guides off');
  changed();
}

export function clearGuides(doc = activeDoc()) {
  if (!doc?.guides?.length) return;
  doc.guides = [];
  state.guideDrag = null;
  setStatus('Guides cleared');
  commit(doc, 'Clear Guides', new Set());
}

function detachDrag(drag) {
  if (!drag?.move) return;
  window.removeEventListener('pointermove', drag.move);
  window.removeEventListener('pointerup', drag.up);
  window.removeEventListener('pointercancel', drag.up);
}

export function cancelGuideDrag() {
  const drag = state.guideDrag;
  if (!drag) return;
  const doc = state.docs.find((item) => item.id === drag.docId);
  state.guideDrag = null;
  detachDrag(drag);
  if (doc && !drag.creating && drag.id) {
    const guide = doc.guides.find((item) => item.id === drag.id);
    if (guide && drag.origin != null) guide.pos = drag.origin;
  }
  requestRender();
}

/** Snap an edge pair (origin and origin+size) to the nearest guide on this axis. */
export function snapOffset(doc, origin, size, axis) {
  if (!state.snapGuides || !doc?.guides?.length) return origin;
  const threshold = SNAP_PX / (doc.zoom || 1);
  let best = null;
  let bestDist = threshold;
  for (const guide of doc.guides) {
    if (guide.axis !== axis) continue;
    for (const edge of [origin, origin + (size || 0)]) {
      const dist = Math.abs(guide.pos - edge);
      if (dist <= bestDist) {
        bestDist = dist;
        best = origin + (guide.pos - edge);
      }
    }
  }
  return best == null ? origin : best;
}

export function guideAt(doc, point) {
  if (!doc?.guides?.length || !point) return null;
  const threshold = 5 / (doc.zoom || 1);
  let best = null;
  let bestDist = threshold;
  for (const guide of doc.guides) {
    const dist = guide.axis === 'v' ? Math.abs(point.x - guide.pos) : Math.abs(point.y - guide.pos);
    if (dist <= bestDist) {
      bestDist = dist;
      best = guide;
    }
  }
  return best;
}

export function guideCursor(doc, point) {
  const drag = state.guideDrag;
  if (drag?.docId === doc?.id) return drag.axis === 'v' ? 'ew-resize' : 'ns-resize';
  const hit = guideAt(doc, point);
  if (!hit) return '';
  return hit.axis === 'v' ? 'ew-resize' : 'ns-resize';
}

function pointerDoc(doc, clientX, clientY) {
  const rect = doc.view.getBoundingClientRect();
  return {
    x: (clientX - rect.left - doc.panX) / doc.zoom,
    y: (clientY - rect.top - doc.panY) / doc.zoom,
  };
}

function overCanvas(doc, clientX, clientY) {
  const rect = doc.view.getBoundingClientRect();
  return clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom;
}

function moveDrag(doc, event) {
  const drag = state.guideDrag;
  if (!drag || drag.docId !== doc.id) return false;
  const point = pointerDoc(doc, event.clientX, event.clientY);
  drag.pos = drag.axis === 'h' ? point.y : point.x;
  doc.cursor = point;
  if (!drag.creating && drag.id) {
    const guide = doc.guides.find((item) => item.id === drag.id);
    if (guide) guide.pos = drag.pos;
  }
  setStatus(`${drag.axis === 'h' ? 'Y' : 'X'}: ${Math.round(drag.pos)}`);
  requestRender();
  return true;
}

function finishDrag(doc, event, cancel) {
  const drag = state.guideDrag;
  if (!drag || drag.docId !== doc.id) return false;
  state.guideDrag = null;
  detachDrag(drag);
  if (cancel) {
    if (!drag.creating && drag.id) {
      const guide = doc.guides.find((item) => item.id === drag.id);
      if (guide && drag.origin != null) guide.pos = drag.origin;
    }
    requestRender();
    return true;
  }
  const inside = overCanvas(doc, event.clientX, event.clientY);
  if (drag.creating) {
    if (inside && Number.isFinite(drag.pos)) {
      doc.guides.push({ id: uid('g'), axis: drag.axis, pos: Math.round(drag.pos) });
      setStatus(drag.axis === 'h' ? 'Horizontal guide' : 'Vertical guide');
      commit(doc, 'New Guide', new Set());
    } else requestRender();
    return true;
  }
  const index = doc.guides.findIndex((item) => item.id === drag.id);
  if (index < 0) {
    requestRender();
    return true;
  }
  if (!inside) {
    doc.guides.splice(index, 1);
    setStatus('Guide removed');
    commit(doc, 'Delete Guide', new Set());
    return true;
  }
  const pos = Math.round(drag.pos);
  if (pos !== drag.origin) {
    doc.guides[index].pos = pos;
    setStatus('Guide moved');
    commit(doc, 'Move Guide', new Set());
  } else {
    doc.guides[index].pos = drag.origin;
    requestRender();
  }
  return true;
}

function beginDrag(doc, axis, creating, id, origin) {
  if (state.guideDrag) cancelGuideDrag();
  const drag = { docId: doc.id, axis, creating, id, origin, pos: origin ?? null, move: null, up: null };
  drag.move = (event) => moveDrag(doc, event);
  drag.up = (event) => finishDrag(doc, event, event.type === 'pointercancel');
  state.guideDrag = drag;
  window.addEventListener('pointermove', drag.move);
  window.addEventListener('pointerup', drag.up);
  window.addEventListener('pointercancel', drag.up);
}

export function bindRuler(doc, canvas, axis) {
  canvas.addEventListener('pointerdown', (event) => {
    if (event.button !== 0 || !state.showRulers) return;
    if (state.activeId !== doc.id) focusDoc(doc.id);
    beginDrag(doc, axis, true, null, null);
    moveDrag(doc, event);
  });
  canvas.addEventListener('pointermove', (event) => {
    if (state.guideDrag?.docId === doc.id) return;
    doc.cursor = pointerDoc(doc, event.clientX, event.clientY);
    requestRender();
  });
}

export function guidePointerDown(doc, event) {
  if (event.button !== 0 || state.space || doc.transform || doc.crop || doc.gesture) return false;
  const hit = guideAt(doc, pointerDoc(doc, event.clientX, event.clientY));
  if (!hit) return false;
  beginDrag(doc, hit.axis, false, hit.id, hit.pos);
  return true;
}

export function guidePointerMove(doc, event) {
  if (state.guideDrag?.docId !== doc.id) return false;
  return true;
}

export function guidePointerUp(doc) {
  return state.guideDrag?.docId === doc.id;
}

export function drawGuides(ctx, doc, width, height) {
  const guides = doc.guides || [];
  const drag = state.guideDrag?.docId === doc.id ? state.guideDrag : null;
  if (!guides.length && !(drag?.creating && Number.isFinite(drag.pos))) return;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  ctx.save();
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 3]);
  ctx.strokeStyle = GUIDE;
  const lines = guides.map((guide) => ({ axis: guide.axis, pos: guide.pos }));
  if (drag?.creating && Number.isFinite(drag.pos)) lines.push({ axis: drag.axis, pos: drag.pos });
  for (const guide of lines) {
    ctx.beginPath();
    if (guide.axis === 'v') {
      const x = Math.round(doc.panX + guide.pos * doc.zoom) + 0.5;
      if (x < -2 || x > width + 2) continue;
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
    } else {
      const y = Math.round(doc.panY + guide.pos * doc.zoom) + 0.5;
      if (y < -2 || y > height + 2) continue;
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
    }
    ctx.stroke();
  }
  ctx.restore();
}

function majorStep(zoom) {
  const target = 56 / Math.max(zoom, 0.05);
  const mag = 10 ** Math.floor(Math.log10(target));
  const norm = target / mag;
  const base = norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10;
  return base * mag;
}

function minorStep(major, zoom) {
  for (const div of [10, 5, 2]) {
    const step = major / div;
    if (step * zoom >= 7) return step;
  }
  return major;
}

function isMultiple(value, step) {
  const q = value / step;
  return Math.abs(q - Math.round(q)) < 1e-4;
}

function formatTick(value) {
  const rounded = Math.round(value);
  if (Math.abs(value - rounded) < 1e-4) return String(rounded);
  return String(Math.round(value * 10) / 10);
}

function fitSurface(canvas) {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  if (w < 2 || h < 2) return null;
  const bw = Math.round(w * dpr);
  const bh = Math.round(h * dpr);
  if (canvas.width !== bw || canvas.height !== bh) {
    canvas.width = bw;
    canvas.height = bh;
  }
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { ctx, w, h };
}

function paintAxis(canvas, doc, axis) {
  const surface = fitSurface(canvas);
  if (!surface) return;
  const { ctx, w, h } = surface;
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = '#c0c0c0';
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = '#808080';
  ctx.beginPath();
  if (axis === 'h') {
    ctx.moveTo(0, h - 0.5);
    ctx.lineTo(w, h - 0.5);
  } else {
    ctx.moveTo(w - 0.5, 0);
    ctx.lineTo(w - 0.5, h);
  }
  ctx.stroke();
  const major = majorStep(doc.zoom);
  const minor = minorStep(major, doc.zoom);
  const span = axis === 'h' ? w : h;
  const pan = axis === 'h' ? doc.panX : doc.panY;
  const start = -pan / doc.zoom;
  const end = (span - pan) / doc.zoom;
  const i0 = Math.floor(start / minor) - 1;
  const i1 = Math.ceil(end / minor) + 1;
  ctx.strokeStyle = '#000';
  ctx.fillStyle = '#000';
  ctx.font = '9px Tahoma, "MS Sans Serif", sans-serif';
  ctx.textBaseline = 'top';
  ctx.lineWidth = 1;
  let nextLabel = -999;
  for (let i = i0; i <= i1; i += 1) {
    const value = i * minor;
    const screen = pan + value * doc.zoom;
    if (screen < -20 || screen > span + 20) continue;
    const majorTick = isMultiple(value, major);
    const midTick = !majorTick && isMultiple(value, major / 2);
    const len = majorTick ? 12 : midTick ? 7 : 4;
    ctx.beginPath();
    if (axis === 'h') {
      const x = Math.round(screen) + 0.5;
      ctx.moveTo(x, h);
      ctx.lineTo(x, h - len);
    } else {
      const y = Math.round(screen) + 0.5;
      ctx.moveTo(w, y);
      ctx.lineTo(w - len, y);
    }
    ctx.stroke();
    if (!majorTick) continue;
    const label = formatTick(value);
    if (axis === 'h') {
      const x = Math.round(screen) + 2;
      if (x < nextLabel) continue;
      ctx.fillText(label, x, 1);
      nextLabel = x + ctx.measureText(label).width + 4;
    } else {
      const y = Math.round(screen) - 1;
      const labelWidth = ctx.measureText(label).width;
      if (y - labelWidth < nextLabel) continue;
      ctx.save();
      ctx.translate(1, y);
      ctx.rotate(-Math.PI / 2);
      ctx.fillText(label, 0, 0);
      ctx.restore();
      nextLabel = y + 3;
    }
  }
  if (doc.cursor) {
    const cursor = axis === 'h'
      ? doc.panX + doc.cursor.x * doc.zoom
      : doc.panY + doc.cursor.y * doc.zoom;
    if (cursor >= 0 && cursor <= span) {
      ctx.strokeStyle = GUIDE;
      ctx.beginPath();
      if (axis === 'h') {
        const x = Math.round(cursor) + 0.5;
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
      } else {
        const y = Math.round(cursor) + 0.5;
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
      }
      ctx.stroke();
    }
  }
}

export function drawRulers(doc) {
  const body = doc.view?.parentElement;
  if (!body || !state.showRulers) return;
  const horizontal = body.querySelector('[data-ruler-x]');
  const vertical = body.querySelector('[data-ruler-y]');
  if (horizontal) paintAxis(horizontal, doc, 'h');
  if (vertical) paintAxis(vertical, doc, 'v');
}
