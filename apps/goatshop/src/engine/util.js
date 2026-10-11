/** Shared canvas, color, and UI-bus helpers for Goatshop 5.0. */

export const BLENDS = [
  ['normal', 'Normal', 'source-over'],
  ['multiply', 'Multiply', 'multiply'],
  ['screen', 'Screen', 'screen'],
  ['overlay', 'Overlay', 'overlay'],
  ['darken', 'Darken', 'darken'],
  ['lighten', 'Lighten', 'lighten'],
  ['difference', 'Difference', 'difference'],
  ['color-dodge', 'Color Dodge', 'color-dodge'],
  ['color-burn', 'Color Burn', 'color-burn'],
  ['hue', 'Hue', 'hue'],
  ['saturation', 'Saturation', 'saturation'],
  ['color', 'Color', 'color'],
  ['luminosity', 'Luminosity', 'luminosity'],
];

export function blendOp(id) {
  return BLENDS.find((row) => row[0] === id)?.[2] || 'source-over';
}

export function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function hexToRgb(hex) {
  let h = String(hex || '#000000').replace('#', '').trim();
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  const n = Number.parseInt(h, 16);
  if (!Number.isFinite(n)) return { r: 0, g: 0, b: 0 };
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

export function rgbToHex(r, g, b) {
  const c = (v) => clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0');
  return `#${c(r)}${c(g)}${c(b)}`;
}

export function createCanvas(w, h) {
  const width = Math.max(1, Math.round(w));
  const height = Math.max(1, Math.round(h));
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(width, height);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

const contexts = new WeakMap();

export function getCtx(canvas) {
  let ctx = contexts.get(canvas);
  if (!ctx) {
    ctx = canvas.getContext('2d');
    contexts.set(canvas, ctx);
  }
  return ctx;
}

export function resetCtx(ctx) {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
  ctx.filter = 'none';
  ctx.shadowBlur = 0;
  ctx.imageSmoothingEnabled = true;
}

export function cloneCanvas(src) {
  const copy = createCanvas(src.width, src.height);
  const ctx = getCtx(copy);
  resetCtx(ctx);
  ctx.drawImage(src, 0, 0);
  return copy;
}

export function copyInto(dst, src) {
  if (dst.width !== src.width || dst.height !== src.height) {
    dst.width = src.width;
    dst.height = src.height;
  }
  const ctx = getCtx(dst);
  resetCtx(ctx);
  ctx.clearRect(0, 0, dst.width, dst.height);
  ctx.drawImage(src, 0, 0);
}

const pool = [];

/** Cleared scratch canvas. Distinct indexes can be used in one call stack. */
export function scratch(w, h, index = 0) {
  const width = Math.max(1, Math.round(w));
  const height = Math.max(1, Math.round(h));
  let canvas = pool[index];
  if (!canvas || canvas.width !== width || canvas.height !== height) {
    canvas = createCanvas(width, height);
    pool[index] = canvas;
  }
  const ctx = getCtx(canvas);
  resetCtx(ctx);
  ctx.clearRect(0, 0, width, height);
  return { canvas, ctx };
}

export async function canvasToBlob(canvas, type = 'image/png', quality) {
  if (typeof canvas.convertToBlob === 'function') return canvas.convertToBlob({ type, quality });
  return new Promise((resolve) => canvas.toBlob((blob) => resolve(blob), type, quality));
}

let seq = 1;
export function uid(prefix = 'id') {
  seq += 1;
  return `${prefix}${seq.toString(36)}`;
}

const listeners = new Set();
let renderFn = () => {};
let renderQueued = false;
let changeQueued = false;

export function setRenderer(fn) {
  renderFn = fn;
}

export function onChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function requestRender() {
  if (renderQueued) return;
  renderQueued = true;
  requestAnimationFrame(() => {
    renderQueued = false;
    renderFn();
  });
}

/** Notify palettes. Pass 'render' to repaint the canvas only. */
export function changed(kind = 'ui') {
  if (kind === 'render') {
    requestRender();
    return;
  }
  requestRender();
  if (changeQueued) return;
  changeQueued = true;
  requestAnimationFrame(() => {
    changeQueued = false;
    for (const fn of listeners) fn();
  });
}

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

export function cssEscape(value) {
  return String(value).replace(/[&<>"']/g, (ch) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[ch]);
}

const commands = new Map();

export function registerCommands(map) {
  for (const [id, fn] of Object.entries(map)) commands.set(id, fn);
}

export function runCommand(id) {
  const fn = commands.get(id);
  if (fn) return fn();
  return undefined;
}

export function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Could not load ${url}`));
    img.src = url;
  });
}

export const SAMPLES = [
  { file: 'samples/meadow.png', name: 'Meadow' },
  { file: 'samples/still-life.png', name: 'Still Life' },
  { file: 'samples/harbor.png', name: 'Harbor Dusk' },
  { file: 'samples/kid.png', name: 'Kid' },
];

export const SWATCHES = [
  '#000000', '#ffffff', '#808080', '#c0c0c0',
  '#800000', '#ff0000', '#ff8080', '#804000',
  '#ff8000', '#ffff00', '#808000', '#c4a574',
  '#008000', '#00ff00', '#80ff80', '#004040',
  '#008080', '#00ffff', '#000080', '#0000ff',
  '#8080ff', '#800080', '#ff00ff', '#ff80c0',
  '#4a3728', '#e7d7b1', '#87a96b', '#1f4e5f',
  '#f2efe9', '#c4491d', '#2c2416', '#d7e4ea',
];
