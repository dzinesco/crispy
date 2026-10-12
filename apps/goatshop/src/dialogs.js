/** Win98 dialogs: new document, adjustments, filters, about. */
import {
  activeDoc,
  activeLayer,
  applyPixelFilter,
  commit,
  createDocument,
  featherSelection,
  fillSelection,
  mark,
  resizeCanvas,
  resizeImage,
  state,
  strokeSelection,
} from './engine/doc.js';
import { curveLut, histogram, scaledPreview } from './engine/filters.js';
import { clamp, cssEscape, hexToRgb } from './engine/util.js';

let modal = null;

export function closeDialog() {
  modal?.remove();
  modal = null;
}

export function openDialog({ title, width = 380, body, ok = 'OK', cancel = 'Cancel', onOk, onCancel }) {
  closeDialog();
  const root = document.createElement('div');
  root.className = 'modal';
  root.innerHTML = `
    <form class="dialog" style="width:${width}px" data-dialog>
      <header class="dialog-title"><span>${cssEscape(title)}</span></header>
      <div class="dialog-body">${body}</div>
      <footer class="dialog-buttons">
        <button type="submit" class="btn" data-action="dialog-ok">${cssEscape(ok)}</button>
        ${cancel ? `<button type="button" class="btn" data-action="dialog-cancel">${cssEscape(cancel)}</button>` : ''}
      </footer>
    </form>`;
  root.addEventListener('submit', async (event) => {
    event.preventDefault();
    const result = await onOk?.(root);
    if (result !== false) closeDialog();
  });
  root.querySelector('[data-action=dialog-cancel]')?.addEventListener('click', () => {
    onCancel?.();
    closeDialog();
  });
  document.getElementById('app').append(root);
  modal = root;
  const field = root.querySelector('input, select, textarea');
  field?.focus();
  return root;
}

export function openNewDialog() {
  openDialog({
    title: 'New',
    body: `
      <label>Name <input data-field="name" value="Untitled"></label>
      <label>Width <input data-field="width" type="number" min="1" max="4096" value="800"></label>
      <label>Height <input data-field="height" type="number" min="1" max="4096" value="600"></label>
      <label>Resolution <input data-field="resolution" type="number" min="1" max="2400" value="72"> px/in</label>
      <label>Background
        <select data-field="background">
          <option value="white">White</option>
          <option value="background">Background Color</option>
          <option value="transparent">Transparent</option>
        </select>
      </label>`,
    onOk: (root) => {
      const read = (name) => root.querySelector(`[data-field="${name}"]`).value;
      createDocument({
        name: read('name') || 'Untitled',
        width: Number(read('width')),
        height: Number(read('height')),
        resolution: Number(read('resolution')),
        background: read('background'),
      });
    },
  });
}

function valuesFrom(root) {
  const values = {};
  for (const el of root.querySelectorAll('[data-field]')) {
    values[el.dataset.field] = el.type === 'checkbox' ? el.checked : el.value;
  }
  return values;
}

function fieldHtml(field) {
  const step = field.step ?? 1;
  return `<label>${cssEscape(field.label)}
    <input data-field="${field.key}" type="range" min="${field.min}" max="${field.max}" step="${step}" value="${field.value}">
    <output data-out="${field.key}">${field.value}</output>
  </label>`;
}

export function sliderDialog({ title, fields = [], check, previewName, mapParams, okLabel }) {
  const doc = activeDoc();
  const layer = activeLayer(doc);
  if (!doc || !layer) return;
  const body = `
    <canvas class="preview" width="280" height="180" data-preview></canvas>
    ${fields.map(fieldHtml).join('')}
    ${check ? `<label class="check"><input data-field="${check.key}" type="checkbox"> ${cssEscape(check.label)}</label>` : ''}`;
  const root = openDialog({
    title,
    width: 420,
    ok: okLabel || 'OK',
    body,
    onOk: async (node) => {
      const params = mapParams ? mapParams(valuesFrom(node), doc) : coerce(valuesFrom(node), fields);
      await applyPixelFilter(doc, previewName, params, title);
    },
  });
  const paint = async () => {
    const canvas = root.querySelector('[data-preview]');
    const params = mapParams ? mapParams(valuesFrom(root), doc) : coerce(valuesFrom(root), fields);
    try {
      const view = await scaledPreview(layer.canvas, 280, previewName, params);
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const scale = Math.min(canvas.width / view.width, canvas.height / view.height);
      const w = view.width * scale;
      const h = view.height * scale;
      ctx.drawImage(view, (canvas.width - w) / 2, (canvas.height - h) / 2, w, h);
    } catch {
      /* preview is optional; OK still runs the full filter */
    }
  };
  root.querySelectorAll('input').forEach((input) => {
    input.addEventListener('input', () => {
      const out = root.querySelector(`[data-out="${input.dataset.field}"]`);
      if (out) out.textContent = input.value;
      paint();
    });
  });
  paint();
}

function coerce(values, fields) {
  const params = {};
  for (const field of fields) params[field.key] = Number(values[field.key]);
  for (const [key, value] of Object.entries(values)) {
    if (params[key] == null) params[key] = value === 'true' || value === true;
  }
  return params;
}

export const FILTERS = {
  gaussian: { title: 'Gaussian Blur', name: 'gaussian', fields: [{ key: 'radius', label: 'Radius', min: 0.1, max: 80, step: 0.1, value: 4 }] },
  motion: { title: 'Motion Blur', name: 'motion', fields: [{ key: 'distance', label: 'Distance', min: 1, max: 200, value: 24 }, { key: 'angle', label: 'Angle', min: 0, max: 360, value: 0 }] },
  unsharp: { title: 'Unsharp Mask', name: 'unsharp', fields: [{ key: 'amount', label: 'Amount', min: 1, max: 500, value: 120 }, { key: 'radius', label: 'Radius', min: 0.1, max: 40, step: 0.1, value: 1.6 }, { key: 'threshold', label: 'Threshold', min: 0, max: 255, value: 2 }] },
  noise: { title: 'Add Noise', name: 'noise', fields: [{ key: 'amount', label: 'Amount', min: 1, max: 100, value: 12 }], check: { key: 'monochrome', label: 'Monochrome' } },
  emboss: { title: 'Emboss', name: 'emboss', fields: [] },
  edges: { title: 'Find Edges', name: 'edges', fields: [] },
  mosaic: { title: 'Mosaic', name: 'mosaic', fields: [{ key: 'size', label: 'Cell Size', min: 2, max: 64, value: 8 }] },
  twirl: { title: 'Twirl', name: 'twirl', fields: [{ key: 'angle', label: 'Angle', min: -360, max: 360, value: 90 }] },
  spherize: { title: 'Spherize', name: 'spherize', fields: [{ key: 'amount', label: 'Amount', min: -100, max: 100, value: 60 }] },
  clouds: { title: 'Clouds', name: 'clouds', fields: [{ key: 'scale', label: 'Scale', min: 8, max: 220, value: 70 }] },
  lensflare: { title: 'Lens Flare', name: 'lensflare', flare: true, fields: [{ key: 'brightness', label: 'Brightness', min: 20, max: 220, value: 120 }] },
};

export function openFilter(id) {
  const spec = FILTERS[id];
  if (!spec) return;
  if (spec.name === 'clouds') {
    sliderDialog({
      title: spec.title,
      fields: spec.fields,
      previewName: spec.name,
      mapParams: (values) => {
        const fg = hexToRgb(state.fg);
        const bg = hexToRgb(state.bg);
        return { scale: Number(values.scale), fg: [fg.r, fg.g, fg.b], bg: [bg.r, bg.g, bg.b] };
      },
    });
    return;
  }
  if (spec.flare) {
    openFlare(spec);
    return;
  }
  sliderDialog({ title: spec.title, fields: spec.fields, check: spec.check, previewName: spec.name });
}

function openFlare(spec) {
  const doc = activeDoc();
  const layer = activeLayer(doc);
  if (!doc || !layer) return;
  const pos = { x: 0.68, y: 0.36 };
  const root = openDialog({
    title: spec.title,
    width: 440,
    body: `<p class="hint">Click the preview to place the flare.</p>
      <canvas class="preview" width="300" height="190" data-preview></canvas>
      ${spec.fields.map(fieldHtml).join('')}`,
    onOk: async (node) => {
      const brightness = Number(node.querySelector('[data-field=brightness]').value);
      await applyPixelFilter(doc, 'lensflare', {
        brightness,
        cx: pos.x * doc.width,
        cy: pos.y * doc.height,
      }, 'Lens Flare');
    },
  });
  const paint = async () => {
    const canvas = root.querySelector('[data-preview]');
    const brightness = Number(root.querySelector('[data-field=brightness]').value);
    const view = await scaledPreview(layer.canvas, 300, 'lensflare', {
      brightness,
      cx: pos.x * doc.width,
      cy: pos.y * doc.height,
    });
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#111';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const scale = Math.min(canvas.width / view.width, canvas.height / view.height);
    const w = view.width * scale;
    const h = view.height * scale;
    const ox = (canvas.width - w) / 2;
    const oy = (canvas.height - h) / 2;
    ctx.drawImage(view, ox, oy, w, h);
    canvas.dataset.ox = ox;
    canvas.dataset.oy = oy;
    canvas.dataset.dw = w;
    canvas.dataset.dh = h;
  };
  root.querySelector('[data-preview]').addEventListener('pointerdown', (event) => {
    const canvas = event.currentTarget;
    const rect = canvas.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * canvas.width;
    const y = ((event.clientY - rect.top) / rect.height) * canvas.height;
    const ox = Number(canvas.dataset.ox);
    const oy = Number(canvas.dataset.oy);
    const dw = Number(canvas.dataset.dw);
    const dh = Number(canvas.dataset.dh);
    pos.x = clamp((x - ox) / dw, 0, 1);
    pos.y = clamp((y - oy) / dh, 0, 1);
    paint();
  });
  root.querySelector('input').addEventListener('input', paint);
  paint();
}

export function openLevels() {
  const doc = activeDoc();
  const layer = activeLayer(doc);
  if (!layer) return;
  const bins = histogram(layer.canvas)[3];
  const root = openDialog({
    title: 'Levels',
    width: 440,
    body: `
      <canvas data-hist width="256" height="80"></canvas>
      <label>Input black <input data-field="inBlack" type="range" min="0" max="255" value="0"></label>
      <label>Gamma <input data-field="gamma" type="range" min="10" max="300" value="100"></label>
      <label>Input white <input data-field="inWhite" type="range" min="0" max="255" value="255"></label>
      <label>Output black <input data-field="outBlack" type="range" min="0" max="255" value="0"></label>
      <label>Output white <input data-field="outWhite" type="range" min="0" max="255" value="255"></label>`,
    onOk: async (node) => {
      const v = valuesFrom(node);
      await applyPixelFilter(doc, 'levels', {
        inBlack: Number(v.inBlack),
        inWhite: Number(v.inWhite),
        gamma: Number(v.gamma) / 100,
        outBlack: Number(v.outBlack),
        outWhite: Number(v.outWhite),
      }, 'Levels');
    },
  });
  const hist = root.querySelector('[data-hist]');
  const ctx = hist.getContext('2d');
  const max = Math.max(...bins, 1);
  ctx.fillStyle = '#111';
  ctx.fillRect(0, 0, 256, 80);
  ctx.fillStyle = '#d0d0d0';
  for (let i = 0; i < 256; i++) {
    const h = (bins[i] / max) * 76;
    ctx.fillRect(i, 78 - h, 1, h);
  }
}

export function openCurves() {
  const doc = activeDoc();
  if (!activeLayer(doc)) return;
  const points = [{ x: 0, y: 0 }, { x: 255, y: 255 }];
  const root = openDialog({
    title: 'Curves',
    width: 420,
    body: `<canvas data-curve width="256" height="256"></canvas><p class="hint">Click to add a point. Drag to bend the curve.</p>`,
    onOk: async () => {
      await applyPixelFilter(doc, 'curves', { lut: curveLut(points) }, 'Curves');
    },
  });
  const canvas = root.querySelector('[data-curve]');
  const ctx = canvas.getContext('2d');
  let drag = -1;
  const draw = () => {
    ctx.fillStyle = '#c0c0c0';
    ctx.fillRect(0, 0, 256, 256);
    ctx.strokeStyle = '#808080';
    ctx.strokeRect(0.5, 0.5, 255, 255);
    ctx.beginPath();
    ctx.moveTo(0, 256);
    const lut = curveLut(points);
    for (let x = 0; x < 256; x++) ctx.lineTo(x, 255 - lut[x]);
    ctx.strokeStyle = '#111';
    ctx.stroke();
    ctx.fillStyle = '#000080';
    for (const point of points) ctx.fillRect(point.x - 3, 255 - point.y - 3, 6, 6);
  };
  const local = (event) => {
    const rect = canvas.getBoundingClientRect();
    return {
      x: clamp(Math.round(((event.clientX - rect.left) / rect.width) * 255), 0, 255),
      y: clamp(Math.round(255 - ((event.clientY - rect.top) / rect.height) * 255), 0, 255),
    };
  };
  canvas.addEventListener('pointerdown', (event) => {
    const p = local(event);
    drag = points.findIndex((point) => Math.hypot(point.x - p.x, point.y - p.y) < 8);
    if (drag < 0) {
      points.push(p);
      points.sort((a, b) => a.x - b.x);
      drag = points.findIndex((point) => point.x === p.x && point.y === p.y);
    }
    canvas.setPointerCapture(event.pointerId);
    draw();
  });
  canvas.addEventListener('pointermove', (event) => {
    if (drag < 0) return;
    const p = local(event);
    if (drag === 0) p.x = 0;
    if (drag === points.length - 1 || points[drag].x === 255 && drag !== 0) {
      const last = points.findIndex((point) => point.x === 255);
      if (drag === last) p.x = 255;
    }
    points[drag].x = p.x;
    points[drag].y = p.y;
    points.sort((a, b) => a.x - b.x);
    drag = points.findIndex((point) => point.x === p.x && point.y === p.y);
    draw();
  });
  canvas.addEventListener('pointerup', () => { drag = -1; });
  draw();
}

export function openBrightness() {
  sliderDialog({
    title: 'Brightness/Contrast',
    previewName: 'brightness',
    fields: [
      { key: 'brightness', label: 'Brightness', min: -100, max: 100, value: 0 },
      { key: 'contrast', label: 'Contrast', min: -100, max: 100, value: 0 },
    ],
  });
}

export function openHue() {
  sliderDialog({
    title: 'Hue/Saturation',
    previewName: 'hue',
    fields: [
      { key: 'hue', label: 'Hue', min: -180, max: 180, value: 0 },
      { key: 'saturation', label: 'Saturation', min: -100, max: 100, value: 0 },
      { key: 'lightness', label: 'Lightness', min: -100, max: 100, value: 0 },
    ],
  });
}

export function openBalance() {
  const doc = activeDoc();
  if (!activeLayer(doc)) return;
  const tones = { shadows: [0, 0, 0], midtones: [0, 0, 0], highlights: [0, 0, 0] };
  let tone = 'midtones';
  const root = openDialog({
    title: 'Color Balance',
    width: 420,
    body: `
      <div class="row">
        <label><input type="radio" name="tone" value="shadows"> Shadows</label>
        <label><input type="radio" name="tone" value="midtones" checked> Midtones</label>
        <label><input type="radio" name="tone" value="highlights"> Highlights</label>
      </div>
      <label>Cyan / Red <input data-slider="0" type="range" min="-100" max="100" value="0"></label>
      <label>Magenta / Green <input data-slider="1" type="range" min="-100" max="100" value="0"></label>
      <label>Yellow / Blue <input data-slider="2" type="range" min="-100" max="100" value="0"></label>
      <label class="check"><input data-field="preserve" type="checkbox" checked> Preserve luminosity</label>`,
    onOk: async (node) => {
      sync();
      await applyPixelFilter(doc, 'balance', {
        shadows: tones.shadows,
        midtones: tones.midtones,
        highlights: tones.highlights,
        preserve: node.querySelector('[data-field=preserve]').checked,
      }, 'Color Balance');
    },
  });
  const sliders = [...root.querySelectorAll('[data-slider]')];
  const sync = () => {
    tones[tone] = sliders.map((slider) => Number(slider.value));
  };
  const load = () => {
    sliders.forEach((slider, index) => { slider.value = tones[tone][index]; });
  };
  root.querySelectorAll('input[name=tone]').forEach((radio) => {
    radio.addEventListener('change', () => {
      sync();
      tone = radio.value;
      load();
    });
  });
}

export function openThreshold() {
  sliderDialog({
    title: 'Threshold',
    previewName: 'threshold',
    fields: [{ key: 'threshold', label: 'Level', min: 1, max: 255, value: 128 }],
  });
}

export function openPosterize() {
  sliderDialog({
    title: 'Posterize',
    previewName: 'posterize',
    fields: [{ key: 'levels', label: 'Levels', min: 2, max: 32, value: 4 }],
  });
}

export function openFeather() {
  openDialog({
    title: 'Feather',
    body: `<label>Radius <input data-field="radius" type="number" min="0" max="250" value="2"> px</label>`,
    onOk: (root) => {
      const doc = activeDoc();
      if (doc) featherSelection(doc, Number(root.querySelector('[data-field=radius]').value));
    },
  });
}

export function openFill() {
  openDialog({
    title: 'Fill',
    body: `<label>Contents
      <select data-field="color">
        <option value="fg">Foreground</option>
        <option value="bg">Background</option>
        <option value="#000000">Black</option>
        <option value="#ffffff">White</option>
      </select></label>
      <label>Opacity <input data-field="opacity" type="number" min="1" max="100" value="100"> %</label>`,
    onOk: (root) => {
      const doc = activeDoc();
      if (!doc) return;
      const which = root.querySelector('[data-field=color]').value;
      const color = which === 'fg' ? state.fg : which === 'bg' ? state.bg : which;
      fillSelection(doc, color, Number(root.querySelector('[data-field=opacity]').value) / 100);
    },
  });
}

export function openStroke() {
  openDialog({
    title: 'Stroke',
    body: `<label>Width <input data-field="width" type="number" min="1" max="100" value="2"> px</label>`,
    onOk: (root) => {
      const doc = activeDoc();
      if (doc) strokeSelection(doc, state.fg, Number(root.querySelector('[data-field=width]').value));
    },
  });
}

export function openImageSize() {
  const doc = activeDoc();
  if (!doc) return;
  openDialog({
    title: 'Image Size',
    body: `<label>Width <input data-field="width" type="number" min="1" max="4096" value="${doc.width}"></label>
      <label>Height <input data-field="height" type="number" min="1" max="4096" value="${doc.height}"></label>
      <label>Resolution <input data-field="resolution" type="number" min="1" max="2400" value="${doc.resolution}"></label>`,
    onOk: (root) => {
      doc.resolution = Number(root.querySelector('[data-field=resolution]').value) || doc.resolution;
      resizeImage(doc, Number(root.querySelector('[data-field=width]').value), Number(root.querySelector('[data-field=height]').value));
    },
  });
}

export function openCanvasSize() {
  const doc = activeDoc();
  if (!doc) return;
  openDialog({
    title: 'Canvas Size',
    body: `<label>Width <input data-field="width" type="number" min="1" max="4096" value="${doc.width}"></label>
      <label>Height <input data-field="height" type="number" min="1" max="4096" value="${doc.height}"></label>
      <label>Anchor
        <select data-field="anchor">
          <option value="nw">Top left</option><option value="n">Top</option><option value="ne">Top right</option>
          <option value="w">Left</option><option value="center" selected>Center</option><option value="e">Right</option>
          <option value="sw">Bottom left</option><option value="s">Bottom</option><option value="se">Bottom right</option>
        </select></label>`,
    onOk: (root) => {
      resizeCanvas(
        doc,
        Number(root.querySelector('[data-field=width]').value),
        Number(root.querySelector('[data-field=height]').value),
        root.querySelector('[data-field=anchor]').value,
      );
    },
  });
}

export function openShadow() {
  const doc = activeDoc();
  const layer = activeLayer(doc);
  if (!layer) return;
  const prev = JSON.parse(JSON.stringify(layer.effects));
  const effect = layer.effects.dropShadow;
  const root = openDialog({
    title: 'Drop Shadow',
    body: `<label class="check"><input data-field="enabled" type="checkbox" ${effect.enabled ? 'checked' : ''}> Preview / enable</label>
      <label>Color <input data-field="color" type="color" value="${effect.color}"></label>
      <label>Opacity <input data-field="opacity" type="range" min="0" max="100" value="${Math.round(effect.opacity * 100)}"></label>
      <label>Angle <input data-field="angle" type="range" min="0" max="359" value="${effect.angle}"></label>
      <label>Distance <input data-field="distance" type="range" min="0" max="200" value="${effect.distance}"></label>
      <label>Size <input data-field="size" type="range" min="0" max="80" value="${effect.size}"></label>`,
    onOk: () => {
      apply();
      mark(doc, layer);
      commit(doc, 'Drop Shadow', new Set());
    },
    onCancel: () => {
      layer.effects = prev;
      mark(doc, layer);
    },
  });
  const apply = () => {
    const v = valuesFrom(root);
    layer.effects.dropShadow = {
      enabled: !!root.querySelector('[data-field=enabled]').checked,
      color: v.color,
      opacity: Number(v.opacity) / 100,
      angle: Number(v.angle),
      distance: Number(v.distance),
      size: Number(v.size),
    };
    mark(doc, layer);
  };
  root.querySelectorAll('input').forEach((input) => input.addEventListener('input', () => {
    apply();
    import('./engine/util.js').then(({ requestRender }) => requestRender());
  }));
}

export function openAbout() {
  openDialog({
    title: 'About Goatshop',
    cancel: '',
    ok: 'Close',
    width: 360,
    body: `<div class="about">
      <strong>Goatshop 5.0</strong>
      <p>A 1998-style picture editor drawn from scratch for Crispy Goat. Layers, history, marching ants, and a lens flare.</p>
      <p>No Adobe artwork, type, or trademarks.</p>
    </div>`,
  });
}

export function openShortcuts() {
  openDialog({
    title: 'Shortcuts',
    cancel: '',
    ok: 'Close',
    width: 420,
    body: `<ul class="shortcuts">
      <li>V move · M marquee · L lasso · W wand · C crop</li>
      <li>B brush · S stamp · E eraser · G gradient · T type</li>
      <li>I eyedropper · H hand · Z zoom · Q quick mask</li>
      <li>D default colors · X swap · [ ] brush size</li>
      <li>Ctrl+Z undo · Ctrl+Alt+Z redo · Ctrl+T transform</li>
      <li>Ctrl+J duplicate · Ctrl+D deselect · Ctrl+Shift+I inverse</li>
      <li>Ctrl+A all · Ctrl+R rulers · Tab hide palettes · Space hand</li>
    </ul>`,
  });
}
