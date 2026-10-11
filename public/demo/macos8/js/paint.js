import { PAINT_PATTERNS, patternCanvas } from './patterns.js';
import {
  children, createFile, get, listFiles, resolve, updateFile, validateName,
} from './fs.js';
import { front, open, setTitle } from './wm.js';
import { registerLauncher } from './launch.js';
import { dialog } from './dialog.js';
import { play } from './audio.js';

const TOOLS = [
  ['pencil', 'Pencil'],
  ['brush', 'Brush'],
  ['eraser', 'Eraser'],
  ['line', 'Line'],
  ['rect', 'Rectangle'],
  ['oval', 'Oval'],
  ['fill', 'Fill'],
];

function prep(ctx) {
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
}

function loadUrl(ctx, url) {
  return new Promise((resolve) => {
    if (!url) {
      resolve();
      return;
    }
    const img = new Image();
    img.onload = () => {
      prep(ctx);
      ctx.drawImage(img, 0, 0, ctx.canvas.width, ctx.canvas.height);
      resolve();
    };
    img.onerror = () => {
      prep(ctx);
      resolve();
    };
    img.src = url;
  });
}

async function savePaint(win, saveAs = false) {
  const dataUrl = win.payload.canvas.toDataURL('image/png');
  if (win.fileId && !saveAs) {
    updateFile(win.fileId, { dataUrl });
    win.payload.dirty = false;
    return true;
  }
  const current = win.fileId ? get(win.fileId) : null;
  const result = await dialog({
    message: 'Save this picture as:',
    fields: [{ name: 'filename', label: 'Name', value: current?.name || 'Untitled' }],
    buttons: [
      { id: 'cancel', label: 'Cancel' },
      { id: 'ok', label: 'Save', default: true },
    ],
    validate: ({ button, values }) => {
      if (button !== 'ok') return null;
      if (!validateName(values.filename)) return 'Names can’t be empty or contain a colon.';
      return null;
    },
  });
  if (result.button !== 'ok') return false;
  const name = validateName(result.values.filename);
  const parent = 'docs';
  const existing = children(parent).find((node) => node.kind === 'paint' && node.name.toLowerCase() === name.toLowerCase());
  if (existing) {
    updateFile(existing.id, { dataUrl });
    win.fileId = existing.id;
    setTitle(win.id, existing.name);
  } else {
    const node = createFile(parent, { name, dataUrl, kind: 'paint', app: 'paint' });
    win.fileId = node.id;
    setTitle(win.id, node.name);
  }
  win.payload.dirty = false;
  const link = document.createElement('a');
  link.href = dataUrl;
  link.download = `${name}.png`;
  link.click();
  return true;
}

function openPaint(fileId) {
  let node = fileId ? get(fileId) : null;
  if (node?.kind === 'alias') node = resolve(node);
  if (node && node.kind !== 'paint') node = null;
  return open({
    app: 'paint',
    title: node?.name || 'Untitled',
    fileId: node?.id || null,
    w: 680,
    h: 480,
    minW: 460,
    minH: 320,
    scroll: false,
    render(win, body) {
      body.classList.add('paint-body');
      const patterns = PAINT_PATTERNS.map((bits) => ({ bits, url: patternCanvas(bits).toDataURL() }));
      const ui = document.createElement('div');
      ui.className = 'paint';
      ui.innerHTML = `
        <div class="tools" role="toolbar" aria-label="Paint tools">
          ${TOOLS.map(([id, label], index) => `
            <button type="button" class="tool${index === 0 ? ' on' : ''}" data-tool="${id}" aria-label="${label}" title="${label}">${glyph(id)}</button>`).join('')}
        </div>
        <div class="sheet"><canvas data-paint-canvas width="512" height="320"></canvas></div>
        <div class="patterns" role="listbox" aria-label="Patterns">
          ${patterns.map((item, index) => `
            <button type="button" class="pat${index === 0 ? ' on' : ''}" data-pat="${index}" aria-label="Pattern ${index + 1}"
              style="background-image:url('${item.url}')"></button>`).join('')}
        </div>`;
      body.insertBefore(ui, body.firstChild);
      const canvas = ui.querySelector('canvas');
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      prep(ctx);
      const state = {
        canvas,
        ctx,
        tool: 'pencil',
        pattern: 0,
        patterns,
        dirty: false,
        history: [],
        snapshot: null,
        last: null,
        drawing: false,
      };
      win.payload = state;
      win.payload.save = (as) => savePaint(win, as);
      win.payload.undo = () => {
        const prev = state.history.pop();
        if (!prev) {
          play('alert');
          return;
        }
        state.ctx.putImageData(prev, 0, 0);
        state.dirty = true;
      };
      loadUrl(ctx, node?.dataUrl || '');
      ui.addEventListener('click', (event) => {
        const tool = event.target.closest('[data-tool]');
        if (tool) {
          state.tool = tool.dataset.tool;
          ui.querySelectorAll('[data-tool]').forEach((button) => button.classList.toggle('on', button === tool));
          return;
        }
        const pat = event.target.closest('[data-pat]');
        if (pat) {
          state.pattern = Number(pat.dataset.pat);
          ui.querySelectorAll('[data-pat]').forEach((button) => button.classList.toggle('on', button === pat));
        }
      });
      canvas.addEventListener('pointerdown', (event) => {
        if (event.button !== 0) return;
        event.preventDefault();
        canvas.setPointerCapture(event.pointerId);
        state.history.push(ctx.getImageData(0, 0, canvas.width, canvas.height));
        if (state.history.length > 12) state.history.shift();
        state.snapshot = ctx.getImageData(0, 0, canvas.width, canvas.height);
        state.drawing = true;
        state.dirty = true;
        const point = localPos(canvas, event);
        state.last = point;
        if (state.tool === 'fill') {
          flood(ctx, point.x, point.y, state.patterns[state.pattern].bits);
          state.drawing = false;
          return;
        }
        stamp(state, point, point);
      });
      canvas.addEventListener('pointermove', (event) => {
        if (!state.drawing) return;
        const point = localPos(canvas, event);
        if (state.tool === 'line' || state.tool === 'rect' || state.tool === 'oval') {
          ctx.putImageData(state.snapshot, 0, 0);
          shape(state, state.last, point);
        } else {
          stamp(state, state.last, point);
          state.last = point;
        }
      });
      const end = (event) => {
        if (!state.drawing) return;
        const point = localPos(canvas, event);
        if (state.tool === 'line' || state.tool === 'rect' || state.tool === 'oval') {
          ctx.putImageData(state.snapshot, 0, 0);
          shape(state, state.last, point);
        }
        state.drawing = false;
      };
      canvas.addEventListener('pointerup', end);
      canvas.addEventListener('pointercancel', end);
    },
    onBeforeClose: async (win) => {
      if (!win.payload.dirty) return true;
      const result = await dialog({
        message: `Save changes to “${win.title}” before closing?`,
        buttons: [
          { id: 'discard', label: "Don't Save" },
          { id: 'cancel', label: 'Cancel' },
          { id: 'save', label: 'Save', default: true },
        ],
      });
      if (result.button === 'cancel') return false;
      if (result.button === 'discard') return true;
      return savePaint(win);
    },
  });
}

function localPos(canvas, event) {
  const rect = canvas.getBoundingClientRect();
  const x = Math.max(0, Math.min(canvas.width - 1, Math.floor(((event.clientX - rect.left) / rect.width) * canvas.width)));
  const y = Math.max(0, Math.min(canvas.height - 1, Math.floor(((event.clientY - rect.top) / rect.height) * canvas.height)));
  return { x, y };
}

function stamp(state, from, to) {
  const { ctx, tool, patterns, pattern } = state;
  ctx.save();
  ctx.lineCap = 'square';
  ctx.lineJoin = 'miter';
  if (tool === 'eraser') {
    ctx.strokeStyle = '#fff';
    ctx.fillStyle = '#fff';
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(to.x, to.y);
    ctx.stroke();
  } else if (tool === 'brush') {
    const bits = patterns[pattern].bits;
    const steps = Math.max(1, Math.hypot(to.x - from.x, to.y - from.y));
    for (let i = 0; i <= steps; i += 1) {
      const x = Math.round(from.x + ((to.x - from.x) * i) / steps);
      const y = Math.round(from.y + ((to.y - from.y) * i) / steps);
      for (let py = 0; py < 8; py += 1) {
        for (let px = 0; px < 8; px += 1) {
          ctx.fillStyle = bits[py][px] === '1' ? '#111' : '#fff';
          ctx.fillRect(x + px - 4, y + py - 4, 1, 1);
        }
      }
    }
  } else {
    ctx.strokeStyle = '#111';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(from.x + 0.5, from.y + 0.5);
    ctx.lineTo(to.x + 0.5, to.y + 0.5);
    ctx.stroke();
  }
  ctx.restore();
}

function shape(state, a, b) {
  const { ctx, tool } = state;
  ctx.save();
  ctx.strokeStyle = '#111';
  ctx.lineWidth = 1;
  ctx.beginPath();
  if (tool === 'line') {
    ctx.moveTo(a.x + 0.5, a.y + 0.5);
    ctx.lineTo(b.x + 0.5, b.y + 0.5);
  } else if (tool === 'rect') {
    ctx.strokeRect(Math.min(a.x, b.x) + 0.5, Math.min(a.y, b.y) + 0.5, Math.abs(b.x - a.x), Math.abs(b.y - a.y));
  } else if (tool === 'oval') {
    ctx.ellipse((a.x + b.x) / 2, (a.y + b.y) / 2, Math.max(1, Math.abs(b.x - a.x) / 2), Math.max(1, Math.abs(b.y - a.y) / 2), 0, 0, Math.PI * 2);
  }
  ctx.stroke();
  ctx.restore();
}

function flood(ctx, x, y, bits) {
  const { width, height } = ctx.canvas;
  const img = ctx.getImageData(0, 0, width, height);
  const start = (y * width + x) * 4;
  const sr = img.data[start];
  const sg = img.data[start + 1];
  const sb = img.data[start + 2];
  const seen = new Uint8Array(width * height);
  const stack = [[x, y]];
  const matches = (i) => Math.abs(img.data[i] - sr) < 12 && Math.abs(img.data[i + 1] - sg) < 12 && Math.abs(img.data[i + 2] - sb) < 12;
  while (stack.length) {
    const [cx, cy] = stack.pop();
    if (cx < 0 || cy < 0 || cx >= width || cy >= height) continue;
    const p = cy * width + cx;
    if (seen[p]) continue;
    seen[p] = 1;
    const i = p * 4;
    if (!matches(i)) continue;
    const ink = bits[cy & 7][cx & 7] === '1' ? 17 : 255;
    img.data[i] = ink;
    img.data[i + 1] = ink;
    img.data[i + 2] = ink;
    img.data[i + 3] = 255;
    stack.push([cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]);
  }
  ctx.putImageData(img, 0, 0);
}

function glyph(tool) {
  const paths = {
    pencil: '<path d="M4 20 L14 4 L17 7 L7 23 Z"/>',
    brush: '<path d="M8 22c4-8 8-8 10-2"/><path d="M14 8l6-4 2 2-6 6z"/>',
    eraser: '<rect x="6" y="8" width="12" height="8" transform="rotate(-20 12 12)"/>',
    line: '<path d="M5 19 L19 5"/>',
    rect: '<rect x="5" y="6" width="14" height="12"/>',
    oval: '<ellipse cx="12" cy="12" rx="7" ry="5"/>',
    fill: '<path d="M6 16c4 4 8 0 10-4 1 6-4 8-8 8-4 0-6-2-2-4z"/>',
  };
  return `<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">${paths[tool] || ''}</svg>`;
}

export async function openPaintFile() {
  const files = listFiles((node) => node.kind === 'paint');
  const result = await dialog({
    message: files.length ? 'Open a picture' : 'No pictures saved yet.',
    wide: true,
    list: files.map((file) => ({ id: file.id, label: file.name })),
    buttons: [
      { id: 'cancel', label: 'Cancel' },
      { id: 'ok', label: 'Open', default: true },
    ],
  });
  if (result.button !== 'ok' || !result.values.picked) return;
  openPaint(result.values.picked);
}

export function saveFrontPaint(saveAs) {
  const win = front();
  if (win?.app !== 'paint') return false;
  return win.payload.save?.(saveAs);
}

export function undoFrontPaint() {
  const win = front();
  if (win?.app !== 'paint') return false;
  win.payload.undo?.();
  return true;
}

registerLauncher('paint', ({ fileId } = {}) => openPaint(fileId));
