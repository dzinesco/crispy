import { CGA, CGA_NAMES, CGA_RGB } from './palette.js';
import { askLine, cleanName } from './util.js';

const W = 128;
const H = 72;

let api = null;
let stage = null;
let pix = new Uint8Array(W * H);
let undo = null;
let name = '';
let tool = 'pen';
let color = 14;
let cx = 8;
let cy = 8;
let drawing = false;
let last = null;

function snapshot() {
  undo = pix.slice();
}

function plot(x, y) {
  if (x < 0 || y < 0 || x >= W || y >= H) return;
  pix[y * W + x] = tool === 'erase' ? 0 : color;
}

function line(x0, y0, x1, y1) {
  let dx = Math.abs(x1 - x0);
  let dy = Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx - dy;
  for (;;) {
    plot(x0, y0);
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 > -dy) {
      err -= dy;
      x0 += sx;
    }
    if (e2 < dx) {
      err += dx;
      y0 += sy;
    }
  }
}

function flood(x, y) {
  const to = tool === 'erase' ? 0 : color;
  const from = pix[y * W + x];
  if (from === to) return;
  const stack = [[x, y]];
  while (stack.length) {
    const [px, py] = stack.pop();
    if (px < 0 || py < 0 || px >= W || py >= H) continue;
    const index = py * W + px;
    if (pix[index] !== from) continue;
    pix[index] = to;
    stack.push([px + 1, py], [px - 1, py], [px, py + 1], [px, py - 1]);
  }
}

function draw(canvas, cursor) {
  const ctx = canvas.getContext('2d');
  const image = ctx.createImageData(W, H);
  for (let i = 0; i < pix.length; i += 1) {
    const [r, g, b] = CGA_RGB[pix[i]] || CGA_RGB[0];
    image.data[i * 4] = r;
    image.data[i * 4 + 1] = g;
    image.data[i * 4 + 2] = b;
    image.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(image, 0, 0);
  const mark = cursor.getContext('2d');
  mark.clearRect(0, 0, W, H);
  mark.fillStyle = color === 15 ? '#000000' : '#ffffff';
  mark.fillRect(cx, cy, 1, 1);
}

export const paintApp = {
  title: 'Paint',
  keys: ['Help', 'Save', 'Load', 'Clear', 'Pen', 'Fill', 'Color', 'Erase', 'Undo', 'Exit'],
  open(filename, data) {
    name = filename || '';
    pix = decode(data);
    undo = null;
  },
  mount(nextStage, nextApi) {
    stage = nextStage;
    api = nextApi;
    stage.innerHTML = `<div class="paint">
      <div class="tools">
        <button type="button" data-tool="pen">Pen</button>
        <button type="button" data-tool="fill">Fill</button>
        <button type="button" data-tool="erase">Erase</button>
        <span class="tool-name" data-tool-name></span>
      </div>
      <div class="paint-stage">
        <canvas data-paint width="${W}" height="${H}"></canvas>
        <canvas class="cursor" data-cursor width="${W}" height="${H}"></canvas>
      </div>
      <div class="swatches">${CGA.map((hex, index) => `<button type="button" class="swatch" data-swatch="${index}" style="background:${hex}" aria-label="${CGA_NAMES[index]}"></button>`).join('')}</div>
    </div>`;
    stage.querySelectorAll('[data-tool]').forEach((button) => {
      button.addEventListener('click', () => this.setTool(button.dataset.tool));
    });
    stage.querySelectorAll('[data-swatch]').forEach((button) => {
      button.addEventListener('click', () => {
        color = Number(button.dataset.swatch);
        if (tool === 'erase') tool = 'pen';
        this.sync();
      });
    });
    const canvas = stage.querySelector('[data-paint]');
    canvas.addEventListener('pointerdown', (event) => this.pointerDown(event));
    canvas.addEventListener('pointermove', (event) => this.pointerMove(event));
    window.addEventListener('pointerup', this.pointerUp);
    this.sync();
    api.setStatus('Drag to draw. F9 undoes.');
  },
  destroy() {
    window.removeEventListener('pointerup', this.pointerUp);
    stage = null;
    drawing = false;
  },
  pointerUp: () => {
    drawing = false;
    last = null;
  },
  setTool(next) {
    tool = next;
    this.sync();
  },
  sync() {
    if (!stage) return;
    stage.querySelectorAll('[data-tool]').forEach((button) => {
      button.classList.toggle('on', button.dataset.tool === tool);
    });
    stage.querySelectorAll('[data-swatch]').forEach((button) => {
      button.classList.toggle('on', Number(button.dataset.swatch) === color);
    });
    const label = stage.querySelector('[data-tool-name]');
    if (label) label.textContent = `${tool}  ${CGA_NAMES[color]}`;
    const canvas = stage.querySelector('[data-paint]');
    const cursor = stage.querySelector('[data-cursor]');
    if (canvas && cursor) draw(canvas, cursor);
  },
  cell(event) {
    const canvas = stage.querySelector('[data-paint]');
    const rect = canvas.getBoundingClientRect();
    const x = Math.floor(((event.clientX - rect.left) / rect.width) * W);
    const y = Math.floor(((event.clientY - rect.top) / rect.height) * H);
    return [x, y];
  },
  pointerDown(event) {
    if (!stage) return;
    event.preventDefault();
    const [x, y] = this.cell(event);
    if (x < 0 || y < 0 || x >= W || y >= H) return;
    snapshot();
    cx = x;
    cy = y;
    if (tool === 'fill') flood(x, y);
    else {
      drawing = true;
      last = [x, y];
      plot(x, y);
    }
    this.sync();
    event.currentTarget.setPointerCapture?.(event.pointerId);
  },
  pointerMove(event) {
    if (!drawing || tool === 'fill') return;
    const [x, y] = this.cell(event);
    cx = Math.max(0, Math.min(W - 1, x));
    cy = Math.max(0, Math.min(H - 1, y));
    if (last) line(last[0], last[1], cx, cy);
    last = [cx, cy];
    this.sync();
  },
  async save() {
    let filename = name;
    if (!filename) {
      const entered = await askLine(stage, 'Save as', { value: 'DOODLE.PIC', save: true });
      if (entered == null) return;
      filename = cleanName(entered);
      if (!filename) {
        api.setStatus('Use a short name like DOODLE.PIC');
        return;
      }
    }
    api.disk.files[filename] = { kind: 'paint', w: W, h: H, data: encode(pix), modified: Date.now() };
    if (!api.persist()) return;
    name = filename;
    api.setStatus(`Saved ${filename}`);
  },
  pics() {
    return Object.entries(api.disk.files)
      .filter(([, file]) => file.kind === 'paint')
      .sort(([a], [b]) => a.localeCompare(b));
  },
  showLoad() {
    const files = this.pics();
    if (!files.length) {
      api.setStatus('No pictures on A:');
      return;
    }
    this.open(files[0][0], files[0][1].data || '');
    this.sync();
    api.setStatus(`Loaded ${files[0][0]}`);
  },
  onF(n) {
    if (n === 1) api.help();
    if (n === 2) this.save();
    if (n === 3) this.showLoad();
    if (n === 4) {
      snapshot();
      pix = new Uint8Array(W * H);
      this.sync();
    }
    if (n === 5) this.setTool('pen');
    if (n === 6) this.setTool('fill');
    if (n === 7) {
      color = (color + 1) % 16;
      if (tool === 'erase') tool = 'pen';
      this.sync();
    }
    if (n === 8) this.setTool('erase');
    if (n === 9 && undo) {
      pix = undo;
      undo = null;
      this.sync();
    }
    if (n === 10) api.exit();
  },
  onKey(event) {
    if (event.key === 'ArrowLeft') cx = Math.max(0, cx - 1);
    if (event.key === 'ArrowRight') cx = Math.min(W - 1, cx + 1);
    if (event.key === 'ArrowUp') cy = Math.max(0, cy - 1);
    if (event.key === 'ArrowDown') cy = Math.min(H - 1, cy + 1);
    if (event.key === ' ') {
      if (!event.repeat) snapshot();
      plot(cx, cy);
    }
    if ('ArrowLeftArrowRightArrowUpArrowDown '.includes(event.key) || event.key === ' ') this.sync();
    if (event.key === 'Escape') api.exit();
  },
};

function encode(buffer) {
  let out = '';
  for (let i = 0; i < buffer.length; i += 1) out += buffer[i].toString(16);
  return out;
}

function decode(data) {
  const out = new Uint8Array(W * H);
  const text = String(data || '');
  for (let i = 0; i < out.length; i += 1) {
    const n = Number.parseInt(text[i] || '0', 16);
    out[i] = Number.isNaN(n) ? 0 : n;
  }
  return out;
}
