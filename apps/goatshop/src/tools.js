/** Pointer tools. Painting stays on an overlay until pointerup so the UI thread only blits. */
import {
  activeDoc,
  activeLayer,
  bakeGesture,
  bucketFill,
  cancelGesture,
  commit,
  cropTo,
  deselect,
  fillPath,
  historySourceCanvas,
  mark,
  pathToSelection,
  renderText,
  addLayer,
  sampleColor,
  selectPolygon,
  selectShape,
  state,
  strokePath,
  toolOpts,
  wandSelect,
} from './engine/doc.js';
import { snapOffset } from './guides.js';
import {
  changed,
  clamp,
  cloneCanvas,
  createCanvas,
  getCtx,
  hexToRgb,
  requestRender,
  resetCtx,
  rgbToHex,
  scratch,
} from './engine/util.js';

const tipCache = new Map();

function brushTip(size, hardness, color) {
  const s = Math.max(1, Math.round(size));
  const key = `${s}|${Math.round(hardness)}|${color}`;
  const cached = tipCache.get(key);
  if (cached) return cached;
  const canvas = createCanvas(s, s);
  const ctx = getCtx(canvas);
  resetCtx(ctx);
  const { r, g, b } = hexToRgb(color);
  const radius = s / 2;
  const inner = Math.max(0, radius * (hardness / 100) * 0.92);
  const grad = ctx.createRadialGradient(radius, radius, inner, radius, radius, Math.max(inner + 0.01, radius));
  grad.addColorStop(0, `rgba(${r},${g},${b},1)`);
  grad.addColorStop(1, `rgba(${r},${g},${b},0)`);
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(radius, radius, radius, 0, Math.PI * 2);
  ctx.fill();
  tipCache.set(key, canvas);
  if (tipCache.size > 40) tipCache.delete(tipCache.keys().next().value);
  return canvas;
}

function pressureOf(event) {
  if (event.pointerType === 'pen') return clamp(event.pressure || 0.5, 0.05, 1);
  return 1;
}

export function clientToDoc(doc, clientX, clientY) {
  const rect = doc.view.getBoundingClientRect();
  return {
    x: (clientX - rect.left - doc.panX) / doc.zoom,
    y: (clientY - rect.top - doc.panY) / doc.zoom,
  };
}

export function docToClient(doc, x, y) {
  const rect = doc.view.getBoundingClientRect();
  return {
    x: rect.left + doc.panX + x * doc.zoom,
    y: rect.top + doc.panY + y * doc.zoom,
  };
}

function paintTarget(doc) {
  const layer = activeLayer(doc);
  if (!layer || layer.locked) return null;
  if (layer.mask && layer.maskTarget) return { layer, canvas: layer.mask, color: state.fg, kind: 'mask' };
  if (doc.quickMask && doc.qm) return { layer, canvas: doc.qm, color: state.fg, kind: 'qm' };
  return { layer, canvas: layer.canvas, color: state.fg, kind: 'pixel' };
}

function beginPaint(doc, label, kind = 'paint') {
  const target = paintTarget(doc);
  if (!target) return null;
  const overlay = createCanvas(doc.width, doc.height);
  const opts = toolOpts(state.tool);
  doc.gesture = {
    kind: target.kind === 'pixel' && kind === 'erase' && !target.layer.isBackground ? 'erase' : 'paint',
    layerId: target.layer.id,
    overlay,
    opacity: opts.opacity ?? 1,
    label,
    clip: target.kind === 'pixel',
    channel: doc.channel,
    before: doc.channel !== 'rgb' ? cloneCanvas(target.canvas) : null,
    target,
    last: null,
    color: kind === 'erase' && target.layer.isBackground ? state.bg : target.color,
  };
  if (kind === 'erase' && target.layer.isBackground) doc.gesture.kind = 'paint';
  if (target.kind !== 'pixel') doc.gesture.kind = 'paint';
  return doc.gesture;
}

function stamp(gesture, x, y, size, hardness, flow, color) {
  const tip = brushTip(size, hardness, color || '#000');
  const ctx = getCtx(gesture.overlay);
  ctx.save();
  ctx.globalAlpha = flow ?? 1;
  ctx.drawImage(tip, x - size / 2, y - size / 2, size, size);
  ctx.restore();
}

function strokeTo(gesture, x, y, size, hardness, spacing, flow, color) {
  if (!gesture.last) {
    stamp(gesture, x, y, size, hardness, flow, color);
    gesture.last = { x, y };
    return;
  }
  const dx = x - gesture.last.x;
  const dy = y - gesture.last.y;
  const dist = Math.hypot(dx, dy);
  const step = Math.max(1, size * spacing);
  if (dist < step) return;
  const n = Math.floor(dist / step);
  for (let i = 1; i <= n; i++) {
    const t = (i * step) / dist;
    stamp(gesture, gesture.last.x + dx * t, gesture.last.y + dy * t, size, hardness, flow, color);
  }
  gesture.last = { x: gesture.last.x + dx * (n * step) / dist, y: gesture.last.y + dy * (n * step) / dist };
}

function stampFrom(overlay, source, sx, sy, dx, dy, size, hardness, flow) {
  const s = Math.max(1, Math.round(size));
  const tmp = scratch(s, s, 5);
  tmp.ctx.drawImage(source, sx - s / 2, sy - s / 2, s, s, 0, 0, s, s);
  tmp.ctx.globalCompositeOperation = 'destination-in';
  tmp.ctx.drawImage(brushTip(s, hardness, '#fff'), 0, 0, s, s);
  const ctx = getCtx(overlay);
  ctx.save();
  ctx.globalAlpha = flow ?? 1;
  ctx.drawImage(tmp.canvas, dx - s / 2, dy - s / 2);
  ctx.restore();
}

let airTimer = 0;

function stopAir() {
  if (airTimer) {
    clearInterval(airTimer);
    airTimer = 0;
  }
}

const tools = {
  move: {
    cursor: 'move',
    down(doc, p, event) {
      const layer = activeLayer(doc);
      if (!layer || layer.locked || layer.isBackground) return;
      if (doc.selection) {
        const float = createCanvas(doc.width, doc.height);
        const ctx = getCtx(float);
        ctx.drawImage(layer.canvas, 0, 0);
        ctx.globalCompositeOperation = 'destination-in';
        ctx.drawImage(doc.selection, 0, 0);
        const dest = getCtx(layer.canvas);
        dest.save();
        dest.globalCompositeOperation = 'destination-out';
        dest.drawImage(doc.selection, 0, 0);
        dest.restore();
        const bounds = opaqueBounds(doc.selection);
        doc.gesture = {
          kind: 'float', layerId: layer.id, float, dx: 0, dy: 0, ox: p.x, oy: p.y,
          bx: bounds.x, by: bounds.y, bw: bounds.w, bh: bounds.h, label: 'Move',
        };
      } else {
        doc.gesture = {
          kind: 'nudge', layerId: layer.id, ox: p.x, oy: p.y, lx: layer.x, ly: layer.y, label: 'Move',
        };
      }
      requestRender();
    },
    move(doc, p) {
      const gesture = doc.gesture;
      if (!gesture) return;
      if (gesture.kind === 'float') {
        let dx = p.x - gesture.ox;
        let dy = p.y - gesture.oy;
        dx = snapOffset(doc, gesture.bx + dx, gesture.bw, 'v') - gesture.bx;
        dy = snapOffset(doc, gesture.by + dy, gesture.bh, 'h') - gesture.by;
        gesture.dx = dx;
        gesture.dy = dy;
      } else if (gesture.kind === 'nudge') {
        const layer = doc.layers.find((item) => item.id === gesture.layerId);
        let x = gesture.lx + (p.x - gesture.ox);
        let y = gesture.ly + (p.y - gesture.oy);
        x = snapOffset(doc, x, doc.width, 'v');
        y = snapOffset(doc, y, doc.height, 'h');
        layer.x = Math.round(x);
        layer.y = Math.round(y);
      }
      doc.flatDirty = true;
      requestRender();
    },
    up(doc) {
      const gesture = doc.gesture;
      if (!gesture) return;
      if (gesture.kind === 'nudge') {
        doc.gesture = null;
        commit(doc, 'Move', new Set());
      } else bakeGesture(doc);
    },
  },
  marquee: {
    cursor: 'crosshair',
    down(doc, p, event) {
      doc.gesture = {
        kind: 'marquee',
        x: p.x,
        y: p.y,
        cx: p.x,
        cy: p.y,
        mode: event.altKey ? 'subtract' : event.shiftKey ? 'add' : 'replace',
        square: false,
      };
    },
    move(doc, p, event) {
      const gesture = doc.gesture;
      if (!gesture || gesture.kind !== 'marquee') return;
      let w = p.x - gesture.x;
      let h = p.y - gesture.y;
      if (event.shiftKey && gesture.mode === 'replace') {
        const s = Math.max(Math.abs(w), Math.abs(h));
        w = Math.sign(w || 1) * s;
        h = Math.sign(h || 1) * s;
      }
      gesture.w = w;
      gesture.h = h;
      requestRender();
    },
    up(doc) {
      const gesture = doc.gesture;
      doc.gesture = null;
      if (!gesture?.w && !gesture?.h) return;
      selectShape(doc, {
        kind: state.variant.marquee,
        x: gesture.x,
        y: gesture.y,
        w: gesture.w,
        h: gesture.h,
        feather: state.opts.marquee.feather,
      }, gesture.mode);
    },
  },
  lasso: {
    cursor: 'crosshair',
    down(doc, p, event) {
      const variant = state.variant.lasso;
      if (variant === 'poly' || variant === 'magnetic') {
        if (!doc.gesture || doc.gesture.kind !== 'lasso') {
          doc.gesture = {
            kind: 'lasso',
            variant,
            points: [p],
            mode: event.altKey ? 'subtract' : event.shiftKey ? 'add' : 'replace',
            cache: variant === 'magnetic' ? getCtx(activeLayer(doc).canvas).getImageData(0, 0, doc.width, doc.height) : null,
          };
        } else if (Math.hypot(p.x - doc.gesture.points[0].x, p.y - doc.gesture.points[0].y) < 8 / doc.zoom) {
          finishLasso(doc);
        } else doc.gesture.points.push(p);
      } else {
        doc.gesture = {
          kind: 'lasso',
          variant: 'free',
          points: [p],
          mode: event.altKey ? 'subtract' : event.shiftKey ? 'add' : 'replace',
        };
      }
      requestRender();
    },
    move(doc, p) {
      const gesture = doc.gesture;
      if (!gesture || gesture.kind !== 'lasso') return;
      if (gesture.variant === 'free') {
        const last = gesture.points.at(-1);
        if (Math.hypot(p.x - last.x, p.y - last.y) > 1.5) gesture.points.push(p);
      } else if (gesture.variant === 'magnetic') {
        const last = gesture.points.at(-1);
        if (Math.hypot(p.x - last.x, p.y - last.y) < 6) {
          gesture.hover = p;
        } else {
          gesture.points.push(snapEdge(gesture.cache, doc.width, doc.height, last, p));
          gesture.hover = null;
        }
      } else gesture.hover = p;
      requestRender();
    },
    up(doc) {
      if (doc.gesture?.variant === 'free') finishLasso(doc);
    },
    dbl(doc) {
      if (doc.gesture?.kind === 'lasso') finishLasso(doc);
    },
  },
  wand: {
    cursor: 'crosshair',
    down(doc, p) {
      wandSelect(doc, p.x, p.y);
    },
  },
  crop: {
    cursor: 'crosshair',
    down(doc, p) {
      doc.crop = { x: p.x, y: p.y, w: 1, h: 1, ax: p.x, ay: p.y, dragging: 'new' };
      requestRender();
    },
    move(doc, p) {
      if (!doc.crop) return;
      doc.crop.w = p.x - doc.crop.ax;
      doc.crop.h = p.y - doc.crop.ay;
      requestRender();
    },
    up(doc) {
      if (doc.crop) doc.crop.dragging = null;
      requestRender();
    },
  },
  brush: paintTool('brush', 'Paintbrush'),
  pencil: paintTool('pencil', 'Pencil', { hardness: 100, spacing: 0.05 }),
  airbrush: {
    cursor: 'crosshair',
    down(doc, p, event) {
      const gesture = beginPaint(doc, 'Airbrush');
      if (!gesture) return;
      const opts = state.opts.airbrush;
      const spray = () => {
        if (!doc.gesture) return stopAir();
        const size = opts.size * (0.65 + 0.35 * (gesture.pressure || 1));
        stamp(doc.gesture, gesture.x, gesture.y, size, opts.hardness, opts.flow, doc.gesture.color);
        doc.flatDirty = true;
        requestRender();
      };
      gesture.x = p.x;
      gesture.y = p.y;
      gesture.pressure = pressureOf(event);
      spray();
      stopAir();
      airTimer = setInterval(spray, 30);
    },
    move(doc, p, event) {
      if (!doc.gesture) return;
      doc.gesture.x = p.x;
      doc.gesture.y = p.y;
      doc.gesture.pressure = pressureOf(event);
    },
    up(doc) {
      stopAir();
      bakeGesture(doc);
    },
  },
  eraser: {
    cursor: 'crosshair',
    down(doc, p, event) {
      const gesture = beginPaint(doc, 'Eraser', 'erase');
      if (!gesture) return;
      dabPaint(doc, p, event, 'eraser');
    },
    move(doc, p, event) {
      if (!doc.gesture) return;
      dabPaint(doc, p, event, 'eraser');
    },
    up(doc) {
      bakeGesture(doc);
    },
  },
  stamp: {
    cursor: 'crosshair',
    down(doc, p, event) {
      if (event.altKey) {
        state.cloneSource = { x: p.x, y: p.y, docId: doc.id };
        changed();
        return;
      }
      if (!state.cloneSource) return;
      const layer = activeLayer(doc);
      if (!layer || layer.locked) return;
      const overlay = createCanvas(doc.width, doc.height);
      doc.gesture = {
        kind: 'stamp',
        layerId: layer.id,
        overlay,
        opacity: state.opts.stamp.opacity,
        label: 'Clone Stamp',
        source: cloneCanvas(layer.canvas),
        ox: p.x,
        oy: p.y,
        sx: state.cloneSource.x,
        sy: state.cloneSource.y,
        last: null,
      };
      dabClone(doc, p, event);
    },
    move(doc, p, event) {
      if (doc.gesture?.kind === 'stamp') dabClone(doc, p, event);
    },
    up(doc) {
      if (doc.gesture?.kind === 'stamp') bakeGesture(doc);
    },
  },
  history: {
    cursor: 'crosshair',
    down(doc, p, event) {
      const layer = activeLayer(doc);
      const source = layer && historySourceCanvas(doc, layer.id);
      if (!layer || !source || layer.locked) return;
      const overlay = createCanvas(doc.width, doc.height);
      doc.gesture = {
        kind: 'stamp', layerId: layer.id, overlay, opacity: state.opts.history.opacity,
        label: 'History Brush', source, ox: p.x, oy: p.y, sx: p.x, sy: p.y, last: null, history: true,
      };
      dabClone(doc, p, event, 'history');
    },
    move(doc, p, event) {
      if (doc.gesture?.history) dabClone(doc, p, event, 'history');
    },
    up(doc) {
      if (doc.gesture?.history) bakeGesture(doc);
    },
  },
  line: {
    cursor: 'crosshair',
    down(doc, p) {
      const gesture = beginPaint(doc, 'Line');
      if (!gesture) return;
      gesture.x = p.x;
      gesture.y = p.y;
    },
    move(doc, p, event) {
      const gesture = doc.gesture;
      if (!gesture?.overlay) return;
      let x = p.x;
      let y = p.y;
      if (event.shiftKey) {
        const angle = Math.atan2(y - gesture.y, x - gesture.x);
        const snap = Math.round(angle / (Math.PI / 4)) * (Math.PI / 4);
        const dist = Math.hypot(x - gesture.x, y - gesture.y);
        x = gesture.x + Math.cos(snap) * dist;
        y = gesture.y + Math.sin(snap) * dist;
      }
      const ctx = getCtx(gesture.overlay);
      resetCtx(ctx);
      ctx.clearRect(0, 0, doc.width, doc.height);
      ctx.strokeStyle = gesture.color;
      ctx.lineWidth = state.opts.line.width;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(gesture.x, gesture.y);
      ctx.lineTo(x, y);
      ctx.stroke();
      doc.flatDirty = true;
      requestRender();
    },
    up(doc) {
      bakeGesture(doc);
    },
  },
  gradient: {
    cursor: 'crosshair',
    down(doc, p) {
      const gesture = beginPaint(doc, 'Gradient');
      if (!gesture) return;
      gesture.x = p.x;
      gesture.y = p.y;
      gesture.opacity = state.opts.gradient.opacity;
    },
    move(doc, p) {
      const gesture = doc.gesture;
      if (!gesture) return;
      gesture.x2 = p.x;
      gesture.y2 = p.y;
      paintGradient(doc, gesture);
      requestRender();
    },
    up(doc) {
      if (doc.gesture) {
        paintGradient(doc, doc.gesture);
        bakeGesture(doc);
      }
    },
  },
  bucket: {
    cursor: 'crosshair',
    down(doc, p) {
      bucketFill(doc, p.x, p.y);
    },
  },
  focus: {
    cursor: 'crosshair',
    down(doc, p, event) {
      const layer = activeLayer(doc);
      if (!layer || layer.locked) return;
      doc.gesture = {
        kind: 'replace', layerId: layer.id, work: cloneCanvas(layer.canvas), label: state.variant.focus, last: p,
      };
      dabFocus(doc, p, event);
    },
    move(doc, p, event) {
      if (doc.gesture?.kind === 'replace' && doc.gesture.label !== 'Tone') dabFocus(doc, p, event);
    },
    up(doc) {
      if (doc.gesture?.kind === 'replace') bakeGesture(doc);
    },
  },
  tone: {
    cursor: 'crosshair',
    down(doc, p, event) {
      const layer = activeLayer(doc);
      if (!layer || layer.locked) return;
      doc.gesture = { kind: 'replace', layerId: layer.id, work: cloneCanvas(layer.canvas), label: 'Tone', last: p };
      dabTone(doc, p, event);
    },
    move(doc, p, event) {
      if (doc.gesture?.label === 'Tone') dabTone(doc, p, event);
    },
    up(doc) {
      if (doc.gesture?.label === 'Tone') bakeGesture(doc);
    },
  },
  pen: {
    cursor: 'crosshair',
    down(doc, p) {
      let path = doc.paths.find((item) => item.id === doc.activePathId);
      if (!path) {
        path = { id: `p${doc.paths.length + 1}`, name: `Path ${doc.paths.length + 1}`, points: [], closed: false };
        doc.paths.push(path);
        doc.activePathId = path.id;
      }
      const first = path.points[0];
      if (first && path.points.length > 2 && Math.hypot(p.x - first.x, p.y - first.y) < 8 / doc.zoom) {
        path.closed = true;
        commit(doc, 'Close Path', new Set());
        return;
      }
      path.points.push({ x: p.x, y: p.y, inx: 0, iny: 0, outx: 0, outy: 0 });
      doc.gesture = { kind: 'pen', index: path.points.length - 1 };
      requestRender();
    },
    move(doc, p) {
      if (doc.gesture?.kind !== 'pen') return;
      const path = doc.paths.find((item) => item.id === doc.activePathId);
      const point = path?.points[doc.gesture.index];
      if (!point) return;
      point.outx = p.x - point.x;
      point.outy = p.y - point.y;
      point.inx = -point.outx;
      point.iny = -point.outy;
      requestRender();
    },
    up(doc) {
      if (doc.gesture?.kind === 'pen') {
        doc.gesture = null;
        commit(doc, 'Pen', new Set());
      }
    },
  },
  type: {
    cursor: 'text',
    down(doc, p) {
      const hit = [...doc.layers].reverse().find((layer) => layer.kind === 'text' && layer.text && Math.abs(p.x - (layer.text.x + layer.x)) < 180 && p.y >= layer.y + layer.text.y - 8 && p.y <= layer.y + layer.text.y + layer.text.size * 2);
      if (hit) {
        doc.activeId = hit.id;
        openTypeEditor(doc, hit);
        return;
      }
      const layer = addLayer(doc, 'Type');
      layer.kind = 'text';
      layer.text = {
        value: 'Text',
        x: p.x,
        y: p.y,
        font: state.opts.type.font,
        size: state.opts.type.size,
        color: state.fg,
      };
      renderText(doc, layer);
      openTypeEditor(doc, layer);
    },
  },
  eyedropper: {
    cursor: 'crosshair',
    down(doc, p, event) {
      const [r, g, b] = sampleColor(doc, p.x, p.y);
      const hex = rgbToHex(r, g, b);
      if (event.altKey) state.bg = hex;
      else state.fg = hex;
      changed();
    },
  },
  hand: {
    cursor: 'grab',
    down(doc, p, event) {
      doc.gesture = { kind: 'hand', x: event.clientX, y: event.clientY, px: doc.panX, py: doc.panY };
    },
    move(doc, p, event) {
      if (doc.gesture?.kind !== 'hand') return;
      doc.panX = doc.gesture.px + (event.clientX - doc.gesture.x);
      doc.panY = doc.gesture.py + (event.clientY - doc.gesture.y);
      requestRender();
    },
    up(doc) {
      if (doc.gesture?.kind === 'hand') doc.gesture = null;
    },
  },
  zoom: {
    cursor: 'zoom-in',
    down(doc, p, event) {
      if (event.altKey) stepZoom(doc, -1, p);
      else {
        doc.gesture = { kind: 'zoom', x: p.x, y: p.y, cx: p.x, cy: p.y };
      }
    },
    move(doc, p) {
      if (doc.gesture?.kind !== 'zoom') return;
      doc.gesture.cx = p.x;
      doc.gesture.cy = p.y;
      requestRender();
    },
    up(doc, p, event) {
      const gesture = doc.gesture;
      doc.gesture = null;
      if (!gesture || gesture.kind !== 'zoom') return;
      const w = Math.abs((gesture.cx || gesture.x) - gesture.x);
      const h = Math.abs((gesture.cy || gesture.y) - gesture.y);
      if (w > 4 && h > 4) {
        const rect = doc.view.getBoundingClientRect();
        const zx = rect.width / w;
        const zy = rect.height / h;
        doc.zoom = clamp(Math.min(zx, zy), 0.05, 16);
        const left = Math.min(gesture.x, gesture.cx);
        const top = Math.min(gesture.y, gesture.cy);
        doc.panX = -left * doc.zoom + 8;
        doc.panY = -top * doc.zoom + 8;
        changed();
      } else stepZoom(doc, event?.altKey ? -1 : 1, p);
    },
  },
};

function paintTool(id, label, overrides = {}) {
  return {
    cursor: 'crosshair',
    down(doc, p, event) {
      const gesture = beginPaint(doc, label);
      if (!gesture) return;
      dabPaint(doc, p, event, id, overrides);
    },
    move(doc, p, event) {
      if (!doc.gesture || doc.gesture.label !== label) return;
      dabPaint(doc, p, event, id, overrides);
    },
    up(doc) {
      if (doc.gesture?.label === label) bakeGesture(doc);
    },
  };
}

function dabPaint(doc, p, event, id, overrides = {}) {
  const opts = { ...toolOpts(id), ...overrides };
  const gesture = doc.gesture;
  const size = Math.max(1, (opts.size || 1) * (id === 'pencil' ? 1 : 0.45 + 0.55 * pressureOf(event)));
  const hardness = id === 'pencil' ? 100 : (opts.hardness ?? 80);
  const events = event.getCoalescedEvents?.() || [event];
  let point = p;
  if (events.length > 1) {
    const last = events.at(-1);
    point = clientToDoc(doc, last.clientX, last.clientY);
  }
  strokeTo(gesture, point.x, point.y, size, hardness, opts.spacing ?? 0.25, opts.flow ?? 1, gesture.color);
  doc.flatDirty = true;
  requestRender();
}

function dabClone(doc, p, event, which = 'stamp') {
  const opts = state.opts[which];
  const gesture = doc.gesture;
  const size = opts.size * (0.5 + 0.5 * pressureOf(event));
  const aligned = which === 'history' || opts.aligned;
  const sx = aligned ? gesture.sx + (p.x - gesture.ox) : gesture.sx;
  const sy = aligned ? gesture.sy + (p.y - gesture.oy) : gesture.sy;
  if (!gesture.last) {
    stampFrom(gesture.overlay, gesture.source, sx, sy, p.x, p.y, size, opts.hardness, 1);
    gesture.last = { x: p.x, y: p.y };
  } else {
    const dx = p.x - gesture.last.x;
    const dy = p.y - gesture.last.y;
    const dist = Math.hypot(dx, dy);
    const step = Math.max(1, size * (opts.spacing || 0.2));
    const n = Math.max(1, Math.floor(dist / step));
    for (let i = 1; i <= n; i++) {
      const t = i / n;
      const x = gesture.last.x + dx * t;
      const y = gesture.last.y + dy * t;
      const ssx = aligned ? gesture.sx + (x - gesture.ox) : gesture.sx + (x - p.x);
      const ssy = aligned ? gesture.sy + (y - gesture.oy) : gesture.sy + (y - p.y);
      stampFrom(gesture.overlay, gesture.source, ssx, ssy, x, y, size, opts.hardness, 1);
    }
    gesture.last = { x: p.x, y: p.y };
  }
  doc.flatDirty = true;
  requestRender();
}

function paintGradient(doc, gesture) {
  const x2 = gesture.x2 ?? gesture.x + 1;
  const y2 = gesture.y2 ?? gesture.y;
  const ctx = getCtx(gesture.overlay);
  resetCtx(ctx);
  ctx.clearRect(0, 0, doc.width, doc.height);
  let grad;
  if (state.variant.grad === 'radial' || state.opts.gradient.kind === 'radial') {
    const radius = Math.max(1, Math.hypot(x2 - gesture.x, y2 - gesture.y));
    grad = ctx.createRadialGradient(gesture.x, gesture.y, 0, gesture.x, gesture.y, radius);
  } else {
    grad = ctx.createLinearGradient(gesture.x, gesture.y, x2, y2);
  }
  grad.addColorStop(0, state.fg);
  grad.addColorStop(1, state.bg);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, doc.width, doc.height);
  doc.flatDirty = true;
}

function dabFocus(doc, p, event) {
  const opts = state.opts.focus;
  const size = opts.size;
  const mode = state.variant.focus;
  const work = doc.gesture.work;
  const ctx = getCtx(work);
  const r = Math.max(2, Math.round(size / 2));
  const x = clamp(Math.round(p.x - r), 0, doc.width - 1);
  const y = clamp(Math.round(p.y - r), 0, doc.height - 1);
  const w = Math.min(r * 2, doc.width - x);
  const h = Math.min(r * 2, doc.height - y);
  const image = ctx.getImageData(x, y, w, h);
  const copy = new Uint8ClampedArray(image.data);
  const strength = (opts.strength || 50) / 100;
  for (let yy = 1; yy < h - 1; yy++) {
    for (let xx = 1; xx < w - 1; xx++) {
      const cx = xx - r;
      const cy = yy - r;
      if (cx * cx + cy * cy > r * r) continue;
      const i = (yy * w + xx) * 4;
      for (let c = 0; c < 3; c++) {
        let acc = 0;
        acc += copy[i - 4 - w * 4 + c] + copy[i - w * 4 + c] + copy[i + 4 - w * 4 + c];
        acc += copy[i - 4 + c] + copy[i + c] + copy[i + 4 + c];
        acc += copy[i - 4 + w * 4 + c] + copy[i + w * 4 + c] + copy[i + 4 + w * 4 + c];
        const blur = acc / 9;
        if (mode === 'blur') image.data[i + c] = copy[i + c] + (blur - copy[i + c]) * strength;
        else if (mode === 'sharpen') image.data[i + c] = copy[i + c] + (copy[i + c] - blur) * strength * 1.4;
        else image.data[i + c] = copy[i + c] * (1 - strength * 0.45) + (doc.gesture.smudge?.[c] ?? copy[i + c]) * strength * 0.45;
      }
      if (mode === 'smudge') {
        doc.gesture.smudge = [image.data[i], image.data[i + 1], image.data[i + 2]];
      }
    }
  }
  ctx.putImageData(image, x, y);
  doc.flatDirty = true;
  requestRender();
}

function dabTone(doc, p) {
  const opts = state.opts.tone;
  const mode = state.variant.tone;
  const work = doc.gesture.work;
  const ctx = getCtx(work);
  const r = Math.max(2, Math.round(opts.size / 2));
  const x = clamp(Math.round(p.x - r), 0, doc.width - 1);
  const y = clamp(Math.round(p.y - r), 0, doc.height - 1);
  const w = Math.min(r * 2, doc.width - x);
  const h = Math.min(r * 2, doc.height - y);
  const image = ctx.getImageData(x, y, w, h);
  const exp = (opts.exposure || 30) / 100;
  for (let yy = 0; yy < h; yy++) {
    for (let xx = 0; xx < w; xx++) {
      const cx = xx - (p.x - x);
      const cy = yy - (p.y - y);
      if (cx * cx + cy * cy > r * r) continue;
      const i = (yy * w + xx) * 4;
      const lum = (image.data[i] + image.data[i + 1] + image.data[i + 2]) / (3 * 255);
      let weight = 1;
      if (opts.range === 'shadows') weight = 1 - lum;
      else if (opts.range === 'highlights') weight = lum;
      else weight = 1 - Math.abs(lum - 0.5) * 1.2;
      for (let c = 0; c < 3; c++) {
        let v = image.data[i + c];
        if (mode === 'dodge') v += 255 * exp * 0.35 * weight;
        else if (mode === 'burn') v -= 255 * exp * 0.35 * weight;
        else {
          const gray = (image.data[i] + image.data[i + 1] + image.data[i + 2]) / 3;
          v += (gray - v) * exp * weight;
        }
        image.data[i + c] = clamp(v, 0, 255);
      }
    }
  }
  ctx.putImageData(image, x, y);
  doc.flatDirty = true;
  requestRender();
}

function finishLasso(doc) {
  const gesture = doc.gesture;
  doc.gesture = null;
  if (!gesture?.points || gesture.points.length < 3) {
    requestRender();
    return;
  }
  selectPolygon(doc, gesture.points, gesture.mode, state.opts.lasso.feather);
}

function snapEdge(image, w, h, from, to) {
  if (!image) return to;
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const len = Math.hypot(dx, dy) || 1;
  const px = -dy / len;
  const py = dx / len;
  let best = to;
  let bestScore = -1;
  const data = image.data;
  for (let o = -10; o <= 10; o++) {
    const x = Math.round(to.x + px * o);
    const y = Math.round(to.y + py * o);
    if (x <= 0 || y <= 0 || x >= w - 1 || y >= h - 1) continue;
    const i = (y * w + x) * 4;
    const lum = (nx, ny) => {
      const j = (ny * w + nx) * 4;
      return data[j] * 0.3 + data[j + 1] * 0.59 + data[j + 2] * 0.11;
    };
    const score = Math.abs(lum(x + 1, y) - lum(x - 1, y)) + Math.abs(lum(x, y + 1) - lum(x, y - 1));
    if (score > bestScore) {
      bestScore = score;
      best = { x, y };
    }
  }
  return best;
}

const ZOOMS = [0.125, 0.25, 0.33, 0.5, 0.67, 1, 1.5, 2, 3, 4, 6, 8, 12, 16];

export function stepZoom(doc, dir, point) {
  const current = doc.zoom;
  const next = dir > 0
    ? (ZOOMS.find((z) => z > current + 0.001) || 16)
    : ([...ZOOMS].reverse().find((z) => z < current - 0.001) || 0.125);
  zoomAt(doc, next, point);
}

export function zoomAt(doc, zoom, point) {
  const prev = doc.zoom;
  doc.zoom = clamp(zoom, 0.05, 16);
  if (point) {
    doc.panX = point.x * prev + doc.panX - point.x * doc.zoom;
    doc.panY = point.y * prev + doc.panY - point.y * doc.zoom;
  }
  changed();
}

export function fitDoc(doc) {
  if (!doc?.view) return;
  const rect = doc.view.getBoundingClientRect();
  if (rect.width < 20 || rect.height < 20) return;
  const zoom = Math.min((rect.width - 24) / doc.width, (rect.height - 24) / doc.height);
  doc.zoom = clamp(zoom, 0.05, 16);
  doc.panX = (rect.width - doc.width * doc.zoom) / 2;
  doc.panY = (rect.height - doc.height * doc.zoom) / 2;
  changed();
}

export function actualPixels(doc) {
  doc.zoom = 1;
  if (doc.view) {
    const rect = doc.view.getBoundingClientRect();
    doc.panX = (rect.width - doc.width) / 2;
    doc.panY = (rect.height - doc.height) / 2;
  }
  changed();
}

function openTypeEditor(doc, layer) {
  let box = document.getElementById('type-editor');
  if (!box) {
    box = document.createElement('textarea');
    box.id = 'type-editor';
    box.className = 'type-editor';
    box.setAttribute('aria-label', 'Type layer');
    document.getElementById('app').appendChild(box);
  }
  const place = () => {
    const pt = docToClient(doc, layer.text.x, layer.text.y);
    const host = document.getElementById('app').getBoundingClientRect();
    box.style.left = `${pt.x - host.left}px`;
    box.style.top = `${pt.y - host.top}px`;
    box.style.fontSize = `${layer.text.size * doc.zoom}px`;
    box.style.fontFamily = layer.text.font;
  };
  box.value = layer.text.value === 'Text' ? '' : layer.text.value;
  box.hidden = false;
  place();
  box.focus();
  const onInput = () => {
    layer.text.value = box.value || ' ';
    layer.text.font = state.opts.type.font;
    layer.text.size = state.opts.type.size;
    layer.text.color = state.fg;
    renderText(doc, layer);
    requestRender();
    place();
  };
  const close = () => {
    box.removeEventListener('input', onInput);
    box.removeEventListener('blur', close);
    box.hidden = true;
    layer.text.value = box.value;
    renderText(doc, layer);
    commit(doc, 'Type', new Set([layer.id]));
  };
  box.addEventListener('input', onInput);
  box.addEventListener('blur', close);
  onInput();
}

export function currentTool() {
  return tools[state.tool] || tools.brush;
}

export function onPointerDown(event) {
  const doc = activeDoc();
  if (!doc || event.button !== 0) return;
  const p = clientToDoc(doc, event.clientX, event.clientY);
  if (doc.transform) {
    transformDown(doc, p);
    return;
  }
  const tool = state.space ? tools.hand : currentTool();
  tool.down?.(doc, p, event);
}

export function onPointerMove(event) {
  const doc = activeDoc();
  if (!doc) return;
  const p = clientToDoc(doc, event.clientX, event.clientY);
  if (doc.transform && doc.transform.drag) {
    transformMove(doc, p, event);
  }
  const tool = state.space ? tools.hand : currentTool();
  if (doc.gesture) tool.move?.(doc, p, event);
  const info = document.querySelector('[data-info]');
  if (info) {
    const [r, g, b, a] = sampleColor(doc, p.x, p.y);
    info.innerHTML = `<div>X: ${Math.round(p.x)} &nbsp; Y: ${Math.round(p.y)}</div><div>R ${r} &nbsp; G ${g} &nbsp; B ${b}${a < 255 ? ` &nbsp; A ${a}` : ''}</div>`;
  }
  doc.cursor = p;
  if (!doc.gesture) requestRender();
}

export function onPointerUp(event) {
  const doc = activeDoc();
  if (!doc) return;
  if (doc.transform?.drag) doc.transform.drag = null;
  const tool = state.space ? tools.hand : currentTool();
  const p = clientToDoc(doc, event.clientX, event.clientY);
  tool.up?.(doc, p, event);
}

export function onDoubleClick(event) {
  const doc = activeDoc();
  if (!doc) return;
  currentTool().dbl?.(doc, clientToDoc(doc, event.clientX, event.clientY), event);
}

export function applyCrop() {
  const doc = activeDoc();
  if (!doc?.crop) return;
  cropTo(doc, doc.crop);
}

export function usePath(action) {
  const doc = activeDoc();
  const path = doc?.paths.find((item) => item.id === doc.activePathId) || doc?.paths.at(-1);
  if (!path) return;
  if (action === 'selection') pathToSelection(doc, path);
  if (action === 'stroke') strokePath(doc, path);
  if (action === 'fill') fillPath(doc, path);
}

function opaqueBounds(canvas) {
  const w = canvas.width;
  const h = canvas.height;
  const data = getCtx(canvas).getImageData(0, 0, w, h).data;
  let minX = w;
  let minY = h;
  let maxX = 0;
  let maxY = 0;
  let any = false;
  const step = w * h > 800000 ? 2 : 1;
  for (let y = 0; y < h; y += step) {
    for (let x = 0; x < w; x += step) {
      if (data[(y * w + x) * 4 + 3] < 8) continue;
      any = true;
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
  }
  if (!any) return { x: 0, y: 0, w, h };
  return { x: minX, y: minY, w: Math.max(1, maxX - minX + 1), h: Math.max(1, maxY - minY + 1) };
}

export function beginTransform(doc = activeDoc()) {
  const layer = activeLayer(doc);
  if (!doc || !layer || layer.locked || doc.transform) return;
  const sprite = createCanvas(doc.width, doc.height);
  const ctx = getCtx(sprite);
  resetCtx(ctx);
  ctx.drawImage(layer.canvas, 0, 0);
  if (doc.selection) {
    ctx.globalCompositeOperation = 'destination-in';
    ctx.drawImage(doc.selection, 0, 0);
    const dest = getCtx(layer.canvas);
    dest.save();
    dest.globalCompositeOperation = 'destination-out';
    dest.drawImage(doc.selection, 0, 0);
    dest.restore();
  } else {
    getCtx(layer.canvas).clearRect(0, 0, doc.width, doc.height);
  }
  const bounds = doc.selection ? opaqueBounds(sprite) : { x: 0, y: 0, w: doc.width, h: doc.height };
  doc.transform = {
    layerId: layer.id,
    sprite,
    ox: bounds.x,
    oy: bounds.y,
    ow: bounds.w,
    oh: bounds.h,
    x: bounds.x,
    y: bounds.y,
    w: bounds.w,
    h: bounds.h,
    angle: 0,
    drag: null,
  };
  doc.flatDirty = true;
  changed();
}

function transformHandles(tr, zoom) {
  const cx = tr.x + tr.w / 2;
  const cy = tr.y + tr.h / 2;
  return {
    nw: [tr.x, tr.y],
    n: [tr.x + tr.w / 2, tr.y],
    ne: [tr.x + tr.w, tr.y],
    e: [tr.x + tr.w, tr.y + tr.h / 2],
    se: [tr.x + tr.w, tr.y + tr.h],
    s: [tr.x + tr.w / 2, tr.y + tr.h],
    sw: [tr.x, tr.y + tr.h],
    w: [tr.x, tr.y + tr.h / 2],
    rot: [cx, tr.y - 18 / zoom],
    cx,
    cy,
  };
}

function transformDown(doc, p) {
  const tr = doc.transform;
  const handles = transformHandles(tr, doc.zoom);
  const hit = 8 / doc.zoom;
  for (const name of ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w', 'rot']) {
    const [x, y] = handles[name];
    if (Math.hypot(p.x - x, p.y - y) <= hit) {
      tr.drag = { name, x: tr.x, y: tr.y, w: tr.w, h: tr.h, px: p.x, py: p.y, angle: tr.angle };
      return;
    }
  }
  if (p.x >= tr.x && p.y >= tr.y && p.x <= tr.x + tr.w && p.y <= tr.y + tr.h) {
    tr.drag = { name: 'move', x: tr.x, y: tr.y, w: tr.w, h: tr.h, px: p.x, py: p.y, angle: tr.angle };
  }
}

function transformMove(doc, p, event) {
  const tr = doc.transform;
  const drag = tr.drag;
  if (!drag) return;
  if (drag.name === 'move') {
    let x = drag.x + (p.x - drag.px);
    let y = drag.y + (p.y - drag.py);
    x = snapOffset(doc, x, drag.w, 'v');
    y = snapOffset(doc, y, drag.h, 'h');
    tr.x = x;
    tr.y = y;
  } else if (drag.name === 'rot') {
    const cx = drag.x + drag.w / 2;
    const cy = drag.y + drag.h / 2;
    tr.angle = Math.atan2(p.y - cy, p.x - cx) + Math.PI / 2;
  } else {
    let w = drag.w;
    let h = drag.h;
    let x = drag.x;
    let y = drag.y;
    const dx = p.x - drag.px;
    const dy = p.y - drag.py;
    if (drag.name.includes('e')) w = drag.w + dx;
    if (drag.name.includes('s')) h = drag.h + dy;
    if (drag.name.includes('w')) {
      w = drag.w - dx;
      x = drag.x + dx;
    }
    if (drag.name.includes('n')) {
      h = drag.h - dy;
      y = drag.y + dy;
    }
    if (event.shiftKey && drag.w && drag.h) {
      const scale = Math.max(w / drag.w, h / drag.h);
      w = drag.w * scale;
      h = drag.h * scale;
    }
    tr.x = x;
    tr.y = y;
    tr.w = w;
    tr.h = h;
  }
  requestRender();
}

export function applyTransform(doc = activeDoc()) {
  const tr = doc?.transform;
  if (!tr) return;
  const layer = doc.layers.find((item) => item.id === tr.layerId);
  doc.transform = null;
  if (!layer) return;
  const ctx = getCtx(layer.canvas);
  ctx.save();
  const cx = tr.x + tr.w / 2;
  const cy = tr.y + tr.h / 2;
  ctx.translate(cx, cy);
  ctx.rotate(tr.angle || 0);
  ctx.translate(-cx, -cy);
  ctx.drawImage(tr.sprite, tr.ox, tr.oy, tr.ow, tr.oh, tr.x, tr.y, tr.w, tr.h);
  ctx.restore();
  mark(doc, layer);
  commit(doc, 'Free Transform', new Set([layer.id]));
}

export function nudgeBrush(delta) {
  const opts = toolOpts();
  if (opts && Object.prototype.hasOwnProperty.call(opts, 'size')) {
    opts.size = clamp(Math.round((opts.size || 1) + delta), 1, 500);
  } else if (state.opts.line && state.tool === 'line') {
    state.opts.line.width = clamp(state.opts.line.width + delta, 1, 100);
  }
  changed();
}

export { tools, deselect, cancelGesture };
