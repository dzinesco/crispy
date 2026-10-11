export const DESK_W = 1024;
export const DESK_H = 768;
export const MENU_H = 26;

export function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, (ch) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[ch]));
}

export function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

export function nowIso() {
  return new Date().toISOString();
}

export function formatDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function formatSize(bytes) {
  const n = Math.max(0, Math.round(bytes || 0));
  if (n < 1024) return `${n} bytes`;
  if (n < 1024 * 1024) return `${Math.ceil(n / 1024)}K`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

export function prefersReducedMotion() {
  return document.documentElement.classList.contains('reduce-motion')
    || matchMedia('(prefers-reduced-motion: reduce)').matches;
}

let stageEl = null;
let scale = 1;

export function setStage(el) {
  stageEl = el;
}

export function stageScale() {
  return scale;
}

export function setStageScale(next) {
  scale = next || 1;
}

export function stageBox() {
  return stageEl ? stageEl.getBoundingClientRect() : { left: 0, top: 0, width: DESK_W, height: DESK_H };
}

export function stagePoint(event) {
  const box = stageBox();
  return {
    x: (event.clientX - box.left) / scale,
    y: (event.clientY - box.top) / scale,
  };
}

export function pointIn(event, el) {
  const box = el.getBoundingClientRect();
  return event.clientX >= box.left && event.clientX <= box.right
    && event.clientY >= box.top && event.clientY <= box.bottom;
}

export function $(sel, root = document) {
  return root.querySelector(sel);
}

export function html(strings, ...vals) {
  return strings.reduce((acc, part, i) => acc + part + (i < vals.length ? vals[i] : ''), '');
}
