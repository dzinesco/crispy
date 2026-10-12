/** Open, save, and IndexedDB session restore for Goatshop documents. */
import { createDocument, setStatus, state } from './doc.js';
import {
  canvasToBlob,
  createCanvas,
  downloadBlob,
  getCtx,
  loadImage,
  resetCtx,
} from './util.js';

function bytesToBase64(bytes) {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

async function canvasToPngDataUrl(canvas) {
  const blob = await canvasToBlob(canvas, 'image/png');
  const bytes = new Uint8Array(await blob.arrayBuffer());
  return `data:image/png;base64,${bytesToBase64(bytes)}`;
}

export async function serializeDoc(doc) {
  const layers = [];
  for (const layer of doc.layers) {
    layers.push({
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
      text: layer.text,
      effects: layer.effects,
      maskOn: layer.maskOn,
      png: await canvasToPngDataUrl(layer.canvas),
      mask: layer.mask ? await canvasToPngDataUrl(layer.mask) : null,
    });
  }
  return {
    format: 'goat',
    version: 1,
    app: 'Goatshop 5.0',
    name: doc.name,
    width: doc.width,
    height: doc.height,
    resolution: doc.resolution,
    activeId: doc.activeId,
    guides: (doc.guides || []).map((guide) => ({ id: guide.id, axis: guide.axis, pos: guide.pos })),
    layers,
  };
}

export async function saveGoat(doc) {
  const json = JSON.stringify(await serializeDoc(doc));
  downloadBlob(new Blob([json], { type: 'application/json' }), `${safeName(doc.name)}.goat`);
  doc.dirty = false;
  setStatus('Saved .goat');
}

export async function savePng(doc) {
  const { ensureFlat } = await import('./doc.js');
  const flat = ensureFlat(doc);
  const blob = await canvasToBlob(flat, 'image/png');
  downloadBlob(blob, `${safeName(doc.name)}.png`);
  setStatus('Saved PNG');
}

export async function saveJpeg(doc) {
  const { ensureFlat } = await import('./doc.js');
  const flat = ensureFlat(doc);
  const canvas = document.createElement('canvas');
  canvas.width = doc.width;
  canvas.height = doc.height;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, doc.width, doc.height);
  ctx.drawImage(flat, 0, 0);
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.92));
  downloadBlob(blob, `${safeName(doc.name)}.jpg`);
  setStatus('Saved JPEG');
}

function safeName(name) {
  return String(name || 'untitled').replace(/[^\w.-]+/g, '-').replace(/^-|-$/g, '') || 'untitled';
}

export async function openGoatText(text, filename) {
  const data = JSON.parse(text);
  if (data.format !== 'goat' && data.format !== 'pgoat') throw new Error('Not a Goatshop document');
  const built = [];
  for (const layer of data.layers || []) {
    built.push({
      id: layer.id || `l${built.length}`,
      name: layer.name || 'Layer',
      visible: layer.visible !== false,
      locked: !!layer.locked,
      isBackground: !!layer.isBackground,
      opacity: layer.opacity ?? 1,
      blend: layer.blend || 'normal',
      x: layer.x || 0,
      y: layer.y || 0,
      kind: layer.kind || 'pixel',
      text: layer.text || null,
      effects: layer.effects,
      maskOn: layer.maskOn !== false,
      maskTarget: false,
      canvas: await canvasFromUrl(layer.png, data.width, data.height),
      mask: layer.mask ? await canvasFromUrl(layer.mask, data.width, data.height) : null,
      rev: 1,
    });
  }
  if (!built.length) throw new Error('Document has no layers');
  return createDocument({
    name: data.name || String(filename || 'document').replace(/\.goat$/i, ''),
    width: data.width,
    height: data.height,
    resolution: data.resolution || 72,
    background: 'transparent',
    draw(created) {
      created.layers = built;
      created.activeId = built.some((layer) => layer.id === data.activeId) ? data.activeId : built.at(-1).id;
      created.guides = (Array.isArray(data.guides) ? data.guides : []).flatMap((guide, index) => {
        if (!guide || (guide.axis !== 'h' && guide.axis !== 'v') || !Number.isFinite(Number(guide.pos))) return [];
        return [{ id: String(guide.id || `g${index + 1}`), axis: guide.axis, pos: Number(guide.pos) }];
      });
    },
  });
}

function canvasFromUrl(url, w, h) {
  return loadImage(url).then((img) => {
    const canvas = createCanvas(w, h);
    getCtx(canvas).drawImage(img, 0, 0);
    return canvas;
  });
}

export async function openImageFile(file) {
  const name = file.name.replace(/\.[^.]+$/, '');
  if (/\.goat$/i.test(file.name) || file.type === 'application/json') {
    const text = await file.text();
    if (text.includes('"format"')) return openGoatText(text, file.name);
  }
  const url = URL.createObjectURL(file);
  try {
    const img = await loadImage(url);
    return createDocument({
      name,
      width: img.naturalWidth || img.width,
      height: img.naturalHeight || img.height,
      background: 'transparent',
      draw(doc) {
        const layer = doc.layers[0];
        layer.name = 'Background';
        layer.isBackground = true;
        const ctx = getCtx(layer.canvas);
        resetCtx(ctx);
        ctx.drawImage(img, 0, 0);
      },
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function openSample(url, name) {
  const img = await loadImage(url);
  return createDocument({
    name,
    width: img.naturalWidth || img.width,
    height: img.naturalHeight || img.height,
    background: 'white',
    draw(doc) {
      const layer = doc.layers[0];
      layer.name = 'Background';
      const ctx = getCtx(layer.canvas);
      resetCtx(ctx);
      ctx.drawImage(img, 0, 0);
    },
  });
}

function db() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('goatshop', 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore('session');
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function hasSession() {
  try {
    const database = await db();
    return await new Promise((resolve) => {
      const tx = database.transaction('session', 'readonly');
      const req = tx.objectStore('session').get('autosave');
      req.onsuccess = () => resolve(!!req.result);
      req.onerror = () => resolve(false);
    });
  } catch {
    return false;
  }
}

let saveTimer = 0;

export function scheduleAutosave() {
  window.clearTimeout(saveTimer);
  saveTimer = window.setTimeout(() => {
    saveSession().catch(() => {});
  }, 4000);
}

export async function saveSession() {
  if (!state.docs.length) return;
  const payload = [];
  for (const doc of state.docs) payload.push(await serializeDoc(doc));
  const database = await db();
  await new Promise((resolve, reject) => {
    const tx = database.transaction('session', 'readwrite');
    tx.objectStore('session').put({ savedAt: Date.now(), docs: payload }, 'autosave');
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function restoreSession() {
  const database = await db();
  const record = await new Promise((resolve, reject) => {
    const tx = database.transaction('session', 'readonly');
    const req = tx.objectStore('session').get('autosave');
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  if (!record?.docs?.length) return false;
  for (const doc of record.docs) {
    await openGoatText(JSON.stringify(doc), doc.name || 'session.goat');
  }
  setStatus('Session restored');
  return true;
}

export function activeDocName() {
  return activeLayer() ? 'ok' : '';
}
