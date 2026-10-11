/** Main-thread bridge to the filter worker, plus small image helpers. */

let worker;
let seq = 1;
const pending = new Map();

function getWorker() {
  if (worker) return worker;
  worker = new Worker(new URL('./worker.js', import.meta.url), { type: 'module' });
  worker.onmessage = (event) => {
    const { id, buffer, error } = event.data;
    const job = pending.get(id);
    if (!job) return;
    pending.delete(id);
    if (error) job.reject(new Error(error));
    else job.resolve(new Uint8ClampedArray(buffer));
  };
  worker.onerror = (event) => {
    const message = event.message || 'Filter worker failed';
    for (const job of pending.values()) job.reject(new Error(message));
    pending.clear();
  };
  return worker;
}

export function runFilter(name, pixels, width, height, params) {
  const id = seq;
  seq += 1;
  const copy = new Uint8ClampedArray(pixels);
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    getWorker().postMessage({
      id,
      name,
      width,
      height,
      params: params || {},
      buffer: copy.buffer,
    }, [copy.buffer]);
  });
}

export function histogram(canvas) {
  const scale = Math.min(1, 180 / Math.max(canvas.width, canvas.height));
  const w = Math.max(1, Math.round(canvas.width * scale));
  const h = Math.max(1, Math.round(canvas.height * scale));
  const view = document.createElement('canvas');
  view.width = w;
  view.height = h;
  const ctx = view.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(canvas, 0, 0, w, h);
  const data = ctx.getImageData(0, 0, w, h).data;
  const bins = [new Uint32Array(256), new Uint32Array(256), new Uint32Array(256), new Uint32Array(256)];
  for (let i = 0; i < data.length; i += 4) {
    bins[0][data[i]] += 1;
    bins[1][data[i + 1]] += 1;
    bins[2][data[i + 2]] += 1;
    const y = Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
    bins[3][y] += 1;
  }
  return bins;
}

export function curveLut(points) {
  const pts = [...points].sort((a, b) => a.x - b.x);
  const lut = new Array(256);
  for (let x = 0; x < 256; x++) {
    let i = 0;
    while (i < pts.length - 1 && pts[i + 1].x < x) i += 1;
    const a = pts[i];
    const b = pts[Math.min(pts.length - 1, i + 1)];
    const t = a.x === b.x ? 0 : (x - a.x) / (b.x - a.x);
    const y = a.y + (b.y - a.y) * Math.max(0, Math.min(1, t));
    lut[x] = Math.max(0, Math.min(255, Math.round(y)));
  }
  return lut;
}

export async function scaledPreview(source, maxSize, name, params) {
  const scale = Math.min(1, maxSize / Math.max(source.width, source.height));
  const w = Math.max(1, Math.round(source.width * scale));
  const h = Math.max(1, Math.round(source.height * scale));
  const view = document.createElement('canvas');
  view.width = w;
  view.height = h;
  const ctx = view.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(source, 0, 0, w, h);
  const image = ctx.getImageData(0, 0, w, h);
  const out = await runFilter(name, image.data, w, h, params);
  image.data.set(out);
  ctx.putImageData(image, 0, 0);
  return view;
}
