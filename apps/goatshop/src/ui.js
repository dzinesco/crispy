/** Goatshop chrome: menus, toolbox, palettes, document windows, splash. */
import {
  openAbout,
  openBalance,
  openBrightness,
  openCanvasSize,
  openCurves,
  openFeather,
  openFill,
  openFilter,
  openHue,
  openImageSize,
  openLevels,
  openNewDialog,
  openPosterize,
  openShadow,
  openShortcuts,
  openStroke,
  openThreshold,
} from './dialogs.js';
import {
  BLENDS,
  activeDoc,
  activeLayer,
  addLayer,
  addMask,
  applyPixelFilter,
  closeDocument,
  commit,
  deleteLayer,
  deselect,
  duplicateLayer,
  ensureFlat,
  flatten,
  flipDoc,
  focusDoc,
  growSelection,
  inverseSelection,
  jumpHistory,
  jumpSnapshot,
  mark,
  mergeDown,
  paintFlat,
  rebuildAnts,
  redo,
  reorderLayer,
  reselect,
  rotateDoc,
  selectAll,
  setHistoryBrush,
  state,
  takeSnapshot,
  toggleQuickMask,
  toolOpts,
  undo,
} from './engine/doc.js';
import { hasSession, openImageFile, openSample, restoreSession, saveGoat, saveJpeg, savePng, scheduleAutosave } from './engine/io.js';
import {
  RULER,
  bindRuler,
  clearGuides,
  drawGuides,
  drawRulers,
  guideCursor,
  guidePointerDown,
  guidePointerMove,
  guidePointerUp,
  loadViewPrefs,
  toggleRulers,
  toggleSnap,
} from './guides.js';
import { TOOL_BUTTONS, icon } from './icons.js';
import {
  actualPixels,
  applyCrop,
  applyTransform,
  beginTransform,
  cancelGesture,
  clientToDoc,
  currentTool,
  fitDoc,
  onDoubleClick,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  stepZoom,
  usePath,
} from './tools.js';
import {
  SAMPLES,
  SWATCHES,
  changed,
  onChange,
  registerCommands,
  requestRender,
  runCommand,
  setRenderer,
} from './engine/util.js';

const has = () => !!activeDoc();
const PLUGINS = [
  'Hoof Diffuse', 'Bellwether Curves', 'Rumen Blur', 'Cud Sharpen', 'Pasture Clouds',
  'Whisker Emboss', 'Fleece Grain', 'Alpine Unsharp', 'Tin Bell Mosaic', 'Haystack Twirl',
  'Barnyard Noise', 'Nanny Levels', 'Billy Stamp', 'Chevre Hue', 'Wether Burn',
  'Scapegoat Shadow', 'Meadow Wand', 'Bramble Lasso', 'Kid Leather', 'Goat Tear',
  'Clover Threshold', 'Wool Spherize', 'Saltlick Grain',
];

let layerSig = '';
let optionSig = '';
let historySig = '';
const antPats = [];

export function mount() {
  loadViewPrefs();
  const app = document.getElementById('app');
  app.innerHTML = `
    <header class="titlebar"><span class="goat-mark" aria-hidden="true"></span><span>Goatshop 5.0</span><a href="/">crispygoat.com</a></header>
    <nav class="menubar" role="menubar"></nav>
    <section class="options" data-palette="options"><div data-options></div></section>
    <div class="workspace">
      <aside class="toolbox" data-palette="tools"></aside>
      <div class="desk" id="desk"></div>
      <aside class="dock" id="dock"></aside>
    </div>
    <footer class="statusbar">
      <span data-status>Ready</span>
      <span data-docstat></span>
      <button type="button" class="btn pal-toggle" data-action="toggle-panels">Palettes</button>
    </footer>
    <div id="splash" data-splash></div>
    <div id="start" data-screen="start" hidden></div>
    <input id="file-open" type="file" hidden accept="image/*,.goat,.pgoat,application/json">
  `;
  buildMenus();
  buildTools();
  buildPalettes();
  buildSplash();
  buildStart();
  wireGlobal();
  registerCommands(commands);
  setRenderer(renderFrame);
  onChange(sync);
  sync();
  showSplash();
}

const commands = {
  'file.new': openNewDialog,
  'file.open': () => document.getElementById('file-open').click(),
  'file.savePng': () => { const doc = activeDoc(); if (doc) savePng(doc); },
  'file.saveJpeg': () => { const doc = activeDoc(); if (doc) saveJpeg(doc); },
  'file.saveGoat': () => { const doc = activeDoc(); if (doc) saveGoat(doc); },
  'file.close': () => closeActive(),
  'edit.undo': () => undo(),
  'edit.redo': () => redo(),
  'edit.cut': () => import('./engine/doc.js').then(({ copySelection }) => copySelection(activeDoc(), true)),
  'edit.copy': () => import('./engine/doc.js').then(({ copySelection }) => copySelection(activeDoc(), false)),
  'edit.paste': () => import('./engine/doc.js').then(({ paste }) => paste(activeDoc())),
  'edit.transform': () => beginTransform(),
  'edit.applyTransform': () => applyTransform(),
  'edit.fill': openFill,
  'edit.stroke': openStroke,
  'image.levels': openLevels,
  'image.curves': openCurves,
  'image.brightness': openBrightness,
  'image.hue': openHue,
  'image.balance': openBalance,
  'image.invert': () => applyPixelFilter(activeDoc(), 'invert', {}, 'Invert'),
  'image.desaturate': () => applyPixelFilter(activeDoc(), 'desaturate', {}, 'Desaturate'),
  'image.threshold': openThreshold,
  'image.posterize': openPosterize,
  'image.size': openImageSize,
  'image.canvas': openCanvasSize,
  'image.rot180': () => rotateDoc(activeDoc(), 2),
  'image.rot90': () => rotateDoc(activeDoc(), 1),
  'image.rot270': () => rotateDoc(activeDoc(), -1),
  'image.flipH': () => flipDoc(activeDoc(), 'h'),
  'image.flipV': () => flipDoc(activeDoc(), 'v'),
  'layer.new': () => addLayer(),
  'layer.dup': () => duplicateLayer(),
  'layer.del': () => deleteLayer(),
  'layer.mask': () => addMask(),
  'layer.merge': () => mergeDown(),
  'layer.flat': () => flatten(),
  'layer.shadow': openShadow,
  'select.all': () => selectAll(),
  'select.none': () => deselect(),
  'select.reselect': () => reselect(),
  'select.inverse': () => inverseSelection(),
  'select.feather': openFeather,
  'select.grow': () => growSelection(),
  'view.zoomIn': () => { const d = activeDoc(); if (d) stepZoom(d, 1); },
  'view.zoomOut': () => { const d = activeDoc(); if (d) stepZoom(d, -1); },
  'view.fit': () => { const d = activeDoc(); if (d) fitDoc(d); },
  'view.actual': () => { const d = activeDoc(); if (d) actualPixels(d); },
  'view.rulers': () => toggleRulers(),
  'view.snapGuides': () => toggleSnap(),
  'view.clearGuides': () => clearGuides(),
  'view.grid': () => { state.showGrid = !state.showGrid; changed(); },
  'window.reset': () => resetPanels(),
  'help.about': openAbout,
  'help.keys': openShortcuts,
  'filter.last': () => {
    const last = state.lastFilter;
    if (last && activeDoc()) applyPixelFilter(activeDoc(), last.name, last.params, last.label);
  },
};

function menuDef() {
  const sub = (id, label, children) => ({ id, label, children });
  const item = (id, label, accel) => ({ id, label, accel, enabled: has });
  return [
    { id: 'file', label: 'File', items: [
      { id: 'file.new', label: 'New...', accel: 'Ctrl+N' },
      { id: 'file.open', label: 'Open...', accel: 'Ctrl+O' },
      { sep: true },
      item('file.savePng', 'Save PNG'),
      item('file.saveJpeg', 'Save JPEG'),
      item('file.saveGoat', 'Save Goat...', 'Ctrl+S'),
      { sep: true },
      item('file.close', 'Close', 'Ctrl+W'),
    ] },
    { id: 'edit', label: 'Edit', items: [
      item('edit.undo', 'Undo', 'Ctrl+Z'),
      item('edit.redo', 'Redo', 'Ctrl+Alt+Z'),
      { sep: true },
      item('edit.cut', 'Cut', 'Ctrl+X'),
      item('edit.copy', 'Copy', 'Ctrl+C'),
      item('edit.paste', 'Paste', 'Ctrl+V'),
      { sep: true },
      item('edit.transform', 'Free Transform', 'Ctrl+T'),
      { sep: true },
      item('edit.fill', 'Fill...', 'Shift+F5'),
      item('edit.stroke', 'Stroke...'),
    ] },
    { id: 'image', label: 'Image', items: [
      sub('image.adjust', 'Adjust', [
        item('image.levels', 'Levels...'),
        item('image.curves', 'Curves...'),
        item('image.brightness', 'Brightness/Contrast...'),
        item('image.hue', 'Hue/Saturation...'),
        item('image.balance', 'Color Balance...'),
        { sep: true },
        item('image.invert', 'Invert'),
        item('image.desaturate', 'Desaturate'),
        item('image.threshold', 'Threshold...'),
        item('image.posterize', 'Posterize...'),
      ]),
      { sep: true },
      item('image.size', 'Image Size...'),
      item('image.canvas', 'Canvas Size...'),
      { sep: true },
      item('image.rot180', 'Rotate 180°'),
      item('image.rot90', 'Rotate 90° CW'),
      item('image.rot270', 'Rotate 90° CCW'),
      item('image.flipH', 'Flip Horizontal'),
      item('image.flipV', 'Flip Vertical'),
    ] },
    { id: 'layer', label: 'Layer', items: [
      item('layer.new', 'New Layer', 'Ctrl+Shift+N'),
      item('layer.dup', 'Duplicate Layer', 'Ctrl+J'),
      item('layer.del', 'Delete Layer'),
      { sep: true },
      item('layer.mask', 'Add Layer Mask'),
      item('layer.merge', 'Merge Down', 'Ctrl+E'),
      item('layer.flat', 'Flatten Image'),
      { sep: true },
      sub('layer.fx', 'Effects', [item('layer.shadow', 'Drop Shadow...')]),
    ] },
    { id: 'select', label: 'Select', items: [
      item('select.all', 'All', 'Ctrl+A'),
      item('select.none', 'Deselect', 'Ctrl+D'),
      item('select.reselect', 'Reselect', 'Ctrl+Shift+D'),
      item('select.inverse', 'Inverse', 'Ctrl+Shift+I'),
      { sep: true },
      item('select.feather', 'Feather...'),
      item('select.grow', 'Grow'),
    ] },
    { id: 'filter', label: 'Filter', items: [
      item('filter.last', 'Last Filter', 'Ctrl+F'),
      { sep: true },
      sub('filter.blur', 'Blur', [
        { id: 'filter.gaussian', label: 'Gaussian Blur...', enabled: has, run: () => openFilter('gaussian') },
        { id: 'filter.motion', label: 'Motion Blur...', enabled: has, run: () => openFilter('motion') },
      ]),
      sub('filter.sharpen', 'Sharpen', [
        { id: 'filter.unsharp', label: 'Unsharp Mask...', enabled: has, run: () => openFilter('unsharp') },
      ]),
      sub('filter.noise', 'Noise', [
        { id: 'filter.noise', label: 'Add Noise...', enabled: has, run: () => openFilter('noise') },
      ]),
      sub('filter.stylize', 'Stylize', [
        { id: 'filter.emboss', label: 'Emboss', enabled: has, run: () => openFilter('emboss') },
        { id: 'filter.edges', label: 'Find Edges', enabled: has, run: () => openFilter('edges') },
      ]),
      sub('filter.pixel', 'Pixelate', [
        { id: 'filter.mosaic', label: 'Mosaic...', enabled: has, run: () => openFilter('mosaic') },
      ]),
      sub('filter.render', 'Render', [
        { id: 'filter.lensflare', label: 'Lens Flare...', enabled: has, run: () => openFilter('lensflare') },
        { id: 'filter.clouds', label: 'Clouds...', enabled: has, run: () => openFilter('clouds') },
      ]),
      sub('filter.distort', 'Distort', [
        { id: 'filter.twirl', label: 'Twirl...', enabled: has, run: () => openFilter('twirl') },
        { id: 'filter.spherize', label: 'Spherize...', enabled: has, run: () => openFilter('spherize') },
      ]),
    ] },
    { id: 'view', label: 'View', items: [
      item('view.zoomIn', 'Zoom In', 'Ctrl++'),
      item('view.zoomOut', 'Zoom Out', 'Ctrl+-'),
      item('view.fit', 'Fit on Screen', 'Ctrl+0'),
      item('view.actual', 'Actual Pixels', 'Ctrl+1'),
      { sep: true },
      { id: 'view.rulers', label: 'Rulers', accel: 'Ctrl+R', checked: state.showRulers },
      { id: 'view.snapGuides', label: 'Snap to Guides', checked: state.snapGuides },
      { id: 'view.clearGuides', label: 'Clear Guides', enabled: () => (activeDoc()?.guides?.length || 0) > 0 },
      { sep: true },
      { id: 'view.grid', label: 'Show Grid', accel: "Ctrl+'" },
    ] },
    { id: 'window', label: 'Window', items: [
      { id: 'window.options', label: 'Options', run: () => togglePanel('options') },
      { id: 'window.tools', label: 'Toolbox', run: () => togglePanel('tools') },
      { id: 'window.nav', label: 'Navigator / Info', run: () => togglePanel('nav') },
      { id: 'window.color', label: 'Color / Brushes', run: () => togglePanel('color') },
      { id: 'window.layers', label: 'Layers / Paths', run: () => togglePanel('layers') },
      { id: 'window.history', label: 'History', run: () => togglePanel('history') },
      { sep: true },
      { id: 'window.reset', label: 'Reset Workspace' },
    ] },
    { id: 'help', label: 'Help', items: [
      { id: 'help.keys', label: 'Keyboard Shortcuts' },
      { id: 'help.about', label: 'About Goatshop...' },
    ] },
  ];
}

function buildMenus() {
  const bar = document.querySelector('.menubar');
  for (const menu of menuDef()) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'menu-title';
    btn.dataset.menu = menu.id;
    btn.textContent = menu.label;
    btn.addEventListener('click', (event) => {
      event.stopPropagation();
      const open = document.querySelector(`.menu-pop[data-menu-pop="${menu.id}"]`);
      closeMenus();
      if (!open) showMenu(menuDef().find((item) => item.id === menu.id), btn);
    });
    bar.append(btn);
  }
}

function showMenu(menu, anchor) {
  const pop = document.createElement('div');
  pop.className = 'menu-pop';
  pop.dataset.menuPop = menu.id;
  for (const item of menu.items) pop.append(menuNode(item));
  document.getElementById('app').append(pop);
  const rect = anchor.getBoundingClientRect();
  const host = document.getElementById('app').getBoundingClientRect();
  pop.style.left = `${rect.left - host.left}px`;
  pop.style.top = `${rect.bottom - host.top}px`;
}

function menuNode(item) {
  if (item.sep) {
    const sep = document.createElement('div');
    sep.className = 'sep';
    return sep;
  }
  const el = document.createElement('button');
  el.type = 'button';
  el.className = 'menu-item';
  el.dataset.menuItem = item.id;
  if (item.enabled && !item.enabled()) el.disabled = true;
  if (item.checked) el.classList.add('checked');
  const mark = item.checked ? '✓ ' : '';
  el.innerHTML = `<span>${mark}${item.label}</span><em>${item.accel || (item.children ? '▸' : '')}</em>`;
  if (item.children) {
    const open = () => showSub(el, item.children);
    el.addEventListener('mouseenter', open);
    el.addEventListener('click', (event) => { event.stopPropagation(); open(); });
  } else {
    el.addEventListener('click', () => {
      closeMenus();
      if (item.run) item.run();
      else runCommand(item.id);
    });
  }
  return el;
}

function showSub(anchor, items) {
  anchor.parentElement.querySelectorAll(':scope > .menu-pop').forEach((node) => node.remove());
  const pop = document.createElement('div');
  pop.className = 'menu-pop sub';
  for (const item of items) pop.append(menuNode(item));
  anchor.parentElement.append(pop);
  const rect = anchor.getBoundingClientRect();
  const host = anchor.parentElement.getBoundingClientRect();
  pop.style.left = `${rect.width - 4}px`;
  pop.style.top = `${rect.top - host.top}px`;
}

function closeMenus() {
  document.querySelectorAll('.menu-pop').forEach((node) => node.remove());
}

function buildTools() {
  const box = document.querySelector('.toolbox');
  const grid = document.createElement('div');
  grid.className = 'tool-grid';
  for (const tool of TOOL_BUTTONS) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'tool';
    btn.dataset.tool = tool.id;
    btn.title = tool.id;
    btn.innerHTML = icon(iconName(tool));
    if (tool.fly) {
      const fly = document.createElement('i');
      fly.dataset.fly = tool.id;
      btn.append(fly);
      fly.addEventListener('pointerdown', (event) => {
        event.stopPropagation();
        event.preventDefault();
        openFly(tool, btn);
      });
    }
    btn.addEventListener('click', () => {
      state.tool = tool.id;
      changed();
    });
    grid.append(btn);
  }
  box.append(grid);
  const colors = document.createElement('div');
  colors.className = 'swatches';
  colors.innerHTML = `
    <button type="button" class="fg" data-slot="fg" title="Foreground"></button>
    <button type="button" class="bg" data-slot="bg" title="Background"></button>
    <button type="button" class="mini" data-action="swap" title="Swap colors (X)">↯</button>
    <button type="button" class="mini" data-action="reset-colors" title="Default colors (D)">■</button>`;
  box.append(colors);
  const qm = document.createElement('button');
  qm.type = 'button';
  qm.className = 'tool qm';
  qm.dataset.action = 'quick-mask';
  qm.title = 'Quick Mask (Q)';
  qm.innerHTML = icon('mask');
  box.append(qm);
}

function iconName(tool) {
  if (!tool.fly) return tool.icon;
  const key = state.variant[tool.id];
  return tool.fly.find((item) => item[0] === key)?.[2] || tool.fly[0][2];
}

function openFly(tool, anchor) {
  closeMenus();
  const pop = document.createElement('div');
  pop.className = 'menu-pop';
  for (const [id, label, glyph] of tool.fly) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'menu-item';
    btn.innerHTML = `${icon(glyph)} <span>${label}</span>`;
    btn.addEventListener('click', () => {
      state.variant[tool.id] = id;
      state.tool = tool.id;
      closeMenus();
      changed();
    });
    pop.append(btn);
  }
  document.getElementById('app').append(pop);
  const rect = anchor.getBoundingClientRect();
  const host = document.getElementById('app').getBoundingClientRect();
  pop.style.left = `${rect.right - host.left}px`;
  pop.style.top = `${rect.top - host.top}px`;
}

function palette(id, title, html) {
  const el = document.createElement('section');
  el.className = 'palette';
  el.dataset.palette = id;
  el.innerHTML = `<header class="pal-title"><span>${title}</span><button type="button" data-collapse aria-label="Collapse">_</button></header><div class="pal-body">${html}</div>`;
  const head = el.querySelector('.pal-title');
  head.addEventListener('dblclick', () => el.classList.toggle('collapsed'));
  el.querySelector('[data-collapse]').addEventListener('click', () => el.classList.toggle('collapsed'));
  head.addEventListener('pointerdown', (event) => startPalDrag(event, el));
  return el;
}

function startPalDrag(event, el) {
  if (event.target.closest('button')) return;
  const desk = document.getElementById('desk');
  const startX = event.clientX;
  const startY = event.clientY;
  const rect = el.getBoundingClientRect();
  const host = document.getElementById('desk').getBoundingClientRect();
  let moved = false;
  const move = (ev) => {
    if (!moved && Math.hypot(ev.clientX - startX, ev.clientY - startY) < 4) return;
    moved = true;
    if (el.parentElement.id === 'dock') {
      el.classList.add('floating');
      desk.append(el);
    }
    el.style.left = `${rect.left - host.left + ev.clientX - startX}px`;
    el.style.top = `${rect.top - host.top + ev.clientY - startY}px`;
  };
  const up = (ev) => {
    window.removeEventListener('pointermove', move);
    window.removeEventListener('pointerup', up);
    const dock = document.getElementById('dock').getBoundingClientRect();
    if (moved && ev.clientX > dock.left - 8) {
      el.classList.remove('floating');
      el.style.left = '';
      el.style.top = '';
      document.getElementById('dock').append(el);
    }
  };
  window.addEventListener('pointermove', move);
  window.addEventListener('pointerup', up);
}

function buildPalettes() {
  const dock = document.getElementById('dock');
  dock.append(
    palette('nav', 'Navigator', `<canvas data-nav width="180" height="110"></canvas><input data-zoom type="range" min="5" max="1600" value="100"><div data-info>X: — Y: —</div>`),
    palette('layers', 'Layers', `
      <div class="tabs">
        <button type="button" data-tab="layers" class="on">Layers</button>
        <button type="button" data-tab="channels">Channels</button>
        <button type="button" data-tab="paths">Paths</button>
      </div>
      <div data-tab-panel="layers">
        <div class="layer-controls">
          <select data-field="blend">${BLENDS.map(([id, label]) => `<option value="${id}">${label}</option>`).join('')}</select>
          <label>Op <input data-field="opacity" type="range" min="0" max="100" value="100"></label>
        </div>
        <div data-layer-list></div>
        <div class="layer-buttons">
          <button type="button" class="btn" data-action="new-layer">New</button>
          <button type="button" class="btn" data-action="dup-layer">Dup</button>
          <button type="button" class="btn" data-action="del-layer">Del</button>
          <button type="button" class="btn" data-action="mask-layer">Mask</button>
          <button type="button" class="btn" data-action="fx-layer">Fx</button>
          <button type="button" class="btn" data-action="merge-layer">Merge</button>
          <button type="button" class="btn" data-action="flat-layer">Flat</button>
        </div>
      </div>
      <div data-tab-panel="channels" hidden></div>
      <div data-tab-panel="paths" hidden>
        <div data-path-list></div>
        <div class="layer-buttons">
          <button type="button" class="btn" data-action="path-selection">Selection</button>
          <button type="button" class="btn" data-action="path-stroke">Stroke</button>
          <button type="button" class="btn" data-action="path-fill">Fill</button>
        </div>
      </div>`),
    palette('history', 'History', `<div class="layer-buttons"><button type="button" class="btn" data-action="snapshot">Snapshot</button></div><div data-snaps></div><div data-history></div>`),
    palette('color', 'Color', `
      <div class="tabs">
        <button type="button" data-tab="color" class="on">Color</button>
        <button type="button" data-tab="swatches">Swatches</button>
        <button type="button" data-tab="brushes">Brushes</button>
      </div>
      <div data-tab-panel="color">
        <label>R <input data-rgb="r" type="range" min="0" max="255" value="0"></label>
        <label>G <input data-rgb="g" type="range" min="0" max="255" value="0"></label>
        <label>B <input data-rgb="b" type="range" min="0" max="255" value="0"></label>
        <label>Hex <input data-field="fg-hex" value="#000000"></label>
      </div>
      <div data-tab-panel="swatches" hidden class="swatch-grid"></div>
      <div data-tab-panel="brushes" hidden>
        <div data-brush-presets class="brush-presets"></div>
        <label>Size <input data-opt="size" data-brush-global type="range" min="1" max="200" value="17"></label>
        <label>Hardness <input data-opt="hardness" data-brush-global type="range" min="0" max="100" value="80"></label>
      </div>`),
  );
  const grid = dock.querySelector('.swatch-grid');
  for (const color of SWATCHES) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.dataset.swatch = color;
    btn.style.background = color;
    btn.title = color;
    btn.addEventListener('click', (event) => {
      if (event.altKey) state.bg = color;
      else state.fg = color;
      changed();
    });
    grid.append(btn);
  }
  const presets = dock.querySelector('[data-brush-presets]');
  for (const preset of [1, 3, 5, 9, 13, 19, 27, 45, 65, 100]) {
    for (const hardness of [100, 0]) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.textContent = `${preset}${hardness ? '' : 's'}`;
      btn.addEventListener('click', () => {
        const opts = toolOpts();
        if (opts.size != null) opts.size = preset;
        if (opts.hardness != null) opts.hardness = hardness;
        state.opts.brush.size = preset;
        state.opts.brush.hardness = hardness;
        changed();
      });
      presets.append(btn);
    }
  }
  dock.querySelectorAll('.tabs').forEach((tabs) => {
    tabs.addEventListener('click', (event) => {
      const btn = event.target.closest('[data-tab]');
      if (!btn) return;
      const root = tabs.parentElement;
      root.querySelectorAll('.tabs [data-tab]').forEach((tab) => tab.classList.toggle('on', tab === btn));
      root.querySelectorAll(':scope > [data-tab-panel]').forEach((panel) => {
        panel.hidden = panel.dataset.tabPanel !== btn.dataset.tab;
      });
    });
  });
}

function optionsHtml() {
  const o = toolOpts();
  const range = (key, label, min, max, step = 1) => `<label>${label} <input data-opt="${key}" type="range" min="${min}" max="${max}" step="${step}" value="${o[key] ?? 0}"></label>`;
  const tool = state.tool;
  if (tool === 'marquee') return `${range('feather', 'Feather', 0, 50)} <span>${state.variant.marquee}</span>`;
  if (tool === 'lasso') return `${range('feather', 'Feather', 0, 50)} <span>${state.variant.lasso}</span>`;
  if (tool === 'wand') return `${range('tolerance', 'Tolerance', 0, 255)} <label class="check"><input data-opt="contiguous" type="checkbox" ${o.contiguous ? 'checked' : ''}> Contiguous</label> <label class="check"><input data-opt="sampleAll" type="checkbox" ${o.sampleAll ? 'checked' : ''}> All layers</label>`;
  if (tool === 'bucket') return `${range('tolerance', 'Tolerance', 0, 255)} ${range('opacity', 'Opacity', 0.05, 1, 0.05)} <label class="check"><input data-opt="contiguous" type="checkbox" ${o.contiguous ? 'checked' : ''}> Contiguous</label>`;
  if (tool === 'pencil') return range('size', 'Size', 1, 80);
  if (tool === 'line') return range('width', 'Width', 1, 40);
  if (tool === 'gradient') return `${range('opacity', 'Opacity', 0.05, 1, 0.05)} <label>Kind <select data-opt="kind"><option value="linear" ${o.kind !== 'radial' ? 'selected' : ''}>Linear</option><option value="radial" ${o.kind === 'radial' ? 'selected' : ''}>Radial</option></select></label>`;
  if (tool === 'stamp') return `${range('size', 'Size', 1, 200)} ${range('hardness', 'Hardness', 0, 100)} ${range('opacity', 'Opacity', 0.05, 1, 0.05)} <label class="check"><input data-opt="aligned" type="checkbox" ${o.aligned ? 'checked' : ''}> Aligned</label>`;
  if (tool === 'type') return `<label>Font <select data-opt="font"><option>Tahoma</option><option>Georgia</option><option>Times New Roman</option><option>Courier New</option></select></label> ${range('size', 'Size', 8, 180)}`;
  if (tool === 'focus' || tool === 'tone') return `${range('size', 'Size', 1, 200)} ${range(tool === 'focus' ? 'strength' : 'exposure', tool === 'focus' ? 'Strength' : 'Exposure', 1, 100)} ${tool === 'tone' ? `<label>Range <select data-opt="range"><option>shadows</option><option selected>midtones</option><option>highlights</option></select></label>` : `<span>${state.variant.focus}</span>`}`;
  if (tool === 'crop') return `<button type="button" class="btn" data-action="apply-crop">Crop</button> <button type="button" class="btn" data-action="cancel-crop">Cancel</button>`;
  if (tool === 'pen') return `<button type="button" class="btn" data-action="path-selection">Make Selection</button> <button type="button" class="btn" data-action="path-stroke">Stroke</button> <button type="button" class="btn" data-action="path-fill">Fill</button>`;
  if (o.size != null) return `${range('size', 'Size', 1, 200)} ${o.hardness != null ? range('hardness', 'Hardness', 0, 100) : ''} ${o.opacity != null ? range('opacity', 'Opacity', 0.05, 1, 0.05) : ''}`;
  return `<span>${tool}</span>`;
}

function bindOptions(root) {
  root.querySelectorAll('[data-opt]').forEach((el) => {
    el.addEventListener('input', () => {
      const opts = toolOpts();
      if (el.type === 'checkbox') opts[el.dataset.opt] = el.checked;
      else if (el.type === 'range' || el.type === 'number') opts[el.dataset.opt] = Number(el.value);
      else opts[el.dataset.opt] = el.value;
      changed('render');
    });
  });
  root.querySelector('[data-action=apply-crop]')?.addEventListener('click', applyCrop);
  root.querySelector('[data-action=cancel-crop]')?.addEventListener('click', () => {
    const doc = activeDoc();
    if (doc) doc.crop = null;
    requestRender();
  });
}

function sync() {
  const doc = activeDoc();
  const ruler = state.showRulers ? `${RULER}px` : '0px';
  if (document.documentElement.style.getPropertyValue('--ruler') !== ruler) {
    document.documentElement.style.setProperty('--ruler', ruler);
    requestRender();
  }
  document.querySelectorAll('.tool').forEach((btn) => btn.classList.toggle('on', btn.dataset.tool === state.tool));
  document.querySelector('[data-slot=fg]').style.background = state.fg;
  document.querySelector('[data-slot=bg]').style.background = state.bg;
  document.querySelector('[data-action=quick-mask]')?.classList.toggle('on', !!doc?.quickMask);
  const optHost = document.querySelector('[data-options]');
  const sig = `${state.tool}|${state.variant.marquee}|${state.variant.lasso}|${state.variant.focus}|${state.variant.tone}`;
  if (sig !== optionSig) {
    optionSig = sig;
    optHost.innerHTML = optionsHtml();
    bindOptions(optHost);
  }
  for (const tool of TOOL_BUTTONS) {
    const btn = document.querySelector(`[data-tool="${tool.id}"]`);
    if (!btn) continue;
    const svg = btn.querySelector('svg');
    const next = icon(iconName(tool));
    if (svg && !svg.outerHTML.includes(next.slice(0, 24))) {
      svg.outerHTML = next;
    }
  }
  document.querySelector('[data-palette=options]').hidden = !state.panels.options || state.palettesHidden;
  document.querySelector('[data-palette=tools]').hidden = !state.panels.tools || state.palettesHidden;
  document.getElementById('dock').hidden = state.palettesHidden;
  for (const id of ['nav', 'layers', 'history', 'color']) {
    const el = document.querySelector(`.palette[data-palette="${id}"]`);
    if (el) el.hidden = !state.panels[id];
  }
  syncWindows();
  syncLayers();
  syncHistory();
  syncPaths();
  syncChannels();
  syncColor();
  const stat = document.querySelector('[data-docstat]');
  if (doc) stat.textContent = `${doc.width} × ${doc.height} px  ·  ${Math.round(doc.zoom * 100)}%`;
  else stat.textContent = '';
  document.getElementById('start').hidden = state.docs.length > 0 || document.getElementById('splash') && !document.getElementById('splash').hidden;
  scheduleAutosave();
}

function syncWindows() {
  const desk = document.getElementById('desk');
  const ids = new Set(state.docs.map((doc) => doc.id));
  for (const el of [...desk.querySelectorAll('.docwin')]) {
    if (!ids.has(el.dataset.docId)) el.remove();
  }
  for (const doc of state.docs) {
    let el = desk.querySelector(`[data-doc-id="${doc.id}"]`);
    if (!el) {
      el = buildWindow(doc);
      desk.append(el);
      requestAnimationFrame(() => fitDoc(doc));
    }
    el.style.left = `${doc.win.x}px`;
    el.style.top = `${doc.win.y}px`;
    el.style.width = `${doc.win.w}px`;
    el.style.height = `${doc.win.h}px`;
    el.style.zIndex = String(doc.win.z);
    el.classList.toggle('active', doc.id === state.activeId);
    el.querySelector('.doc-name').textContent = `${doc.name}${doc.dirty ? ' *' : ''} @ ${Math.round(doc.zoom * 100)}%`;
    el.querySelector('.doc-body')?.classList.toggle('show-rulers', !!state.showRulers);
    for (const node of el.querySelectorAll('[data-ruler]')) node.hidden = !state.showRulers;
  }
}

function buildWindow(doc) {
  const el = document.createElement('section');
  el.className = 'docwin';
  el.dataset.docId = doc.id;
  const rulerHidden = state.showRulers ? '' : ' hidden';
  el.innerHTML = `<header class="doc-title"><span class="doc-name"></span><button type="button" data-win-close aria-label="Close">×</button></header><div class="doc-body${state.showRulers ? ' show-rulers' : ''}"><div class="ruler-corner" data-ruler${rulerHidden}></div><canvas class="ruler-x" data-ruler data-ruler-x${rulerHidden}></canvas><canvas class="ruler-y" data-ruler data-ruler-y${rulerHidden}></canvas><canvas data-doc-canvas></canvas></div><i class="doc-resize"></i>`;
  const canvas = el.querySelector('[data-doc-canvas]');
  doc.view = canvas;
  bindRuler(doc, el.querySelector('[data-ruler-x]'), 'h');
  bindRuler(doc, el.querySelector('[data-ruler-y]'), 'v');
  canvas.addEventListener('pointerdown', (event) => {
    if (state.activeId !== doc.id) focusDoc(doc.id);
    if (guidePointerDown(doc, event)) {
      canvas.setPointerCapture(event.pointerId);
      return;
    }
    canvas.setPointerCapture(event.pointerId);
    onPointerDown(event);
  });
  canvas.addEventListener('pointermove', (event) => {
    if (guidePointerMove(doc, event)) return;
    onPointerMove(event);
  });
  canvas.addEventListener('pointerup', (event) => {
    if (guidePointerUp(doc)) return;
    onPointerUp(event);
  });
  canvas.addEventListener('dblclick', (event) => {
    if (doc.crop) applyCrop();
    else onDoubleClick(event);
  });
  canvas.addEventListener('contextmenu', (event) => event.preventDefault());
  el.querySelector('.doc-title').addEventListener('pointerdown', (event) => {
    if (event.target.closest('button')) return;
    if (state.activeId !== doc.id) focusDoc(doc.id);
    const sx = event.clientX;
    const sy = event.clientY;
    const ox = doc.win.x;
    const oy = doc.win.y;
    const move = (ev) => {
      doc.win.x = ox + ev.clientX - sx;
      doc.win.y = oy + ev.clientY - sy;
      el.style.left = `${doc.win.x}px`;
      el.style.top = `${doc.win.y}px`;
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  });
  el.querySelector('[data-win-close]').addEventListener('click', () => closeActive(doc.id));
  el.querySelector('.doc-resize').addEventListener('pointerdown', (event) => {
    event.stopPropagation();
    const sx = event.clientX;
    const sy = event.clientY;
    const ow = doc.win.w;
    const oh = doc.win.h;
    const move = (ev) => {
      doc.win.w = Math.max(180, ow + ev.clientX - sx);
      doc.win.h = Math.max(140, oh + ev.clientY - sy);
      el.style.width = `${doc.win.w}px`;
      el.style.height = `${doc.win.h}px`;
      requestRender();
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  });
  return el;
}

async function closeActive(id) {
  const doc = state.docs.find((item) => item.id === (id || state.activeId));
  if (!doc) return;
  if (doc.dirty && !window.confirm(`Close ${doc.name} without saving?`)) return;
  closeDocument(doc.id);
}

function syncLayers() {
  const doc = activeDoc();
  const list = document.querySelector('[data-layer-list]');
  const blend = document.querySelector('[data-field=blend]');
  const opacity = document.querySelector('[data-field=opacity]');
  if (!doc || !list) return;
  const layer = activeLayer(doc);
  if (blend && document.activeElement !== blend) blend.value = layer?.blend || 'normal';
  if (opacity && document.activeElement !== opacity) opacity.value = String(Math.round((layer?.opacity ?? 1) * 100));
  const sig = doc.layers.map((item) => `${item.id}:${item.visible}:${item.name}:${item.mask ? 1 : 0}`).join('|') + doc.activeId;
  if (sig === layerSig) return;
  layerSig = sig;
  list.innerHTML = '';
  [...doc.layers].reverse().forEach((item, visual) => {
    const index = doc.layers.length - 1 - visual;
    const row = document.createElement('div');
    row.className = 'layer-row';
    row.draggable = true;
    row.dataset.layerId = item.id;
    if (item.id === doc.activeId) row.classList.add('on');
    row.innerHTML = `<button type="button" class="eye" data-eye>${item.visible ? '◉' : '○'}</button><canvas width="32" height="24"></canvas><span></span>`;
    row.querySelector('span').textContent = item.name;
    const thumb = row.querySelector('canvas');
    thumb.getContext('2d').drawImage(item.canvas, 0, 0, 32, 24);
    row.addEventListener('click', () => {
      doc.activeId = item.id;
      layerSig = '';
      changed();
    });
    row.querySelector('[data-eye]').addEventListener('click', (event) => {
      event.stopPropagation();
      item.visible = !item.visible;
      doc.flatDirty = true;
      commit(doc, 'Visibility', new Set());
    });
    row.addEventListener('dragstart', () => { row.dataset.drag = index; });
    row.addEventListener('dragover', (event) => event.preventDefault());
    row.addEventListener('drop', (event) => {
      event.preventDefault();
      const from = Number(document.querySelector('.layer-row[data-drag]')?.dataset.drag ?? index);
      reorderLayer(doc, from, index);
    });
    list.append(row);
  });
}

function syncHistory() {
  const doc = activeDoc();
  const host = document.querySelector('[data-history]');
  const snaps = document.querySelector('[data-snaps]');
  if (!doc || !host) return;
  const sig = `${doc.history.cursor}:${doc.history.entries.length}:${doc.history.snaps.length}:${doc.history.brushSource}`;
  if (sig === historySig) return;
  historySig = sig;
  snaps.innerHTML = '';
  doc.history.snaps.forEach((snap, index) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'hist';
    btn.textContent = snap.name;
    btn.addEventListener('click', () => jumpSnapshot(doc, index));
    snaps.append(btn);
  });
  host.innerHTML = '';
  doc.history.entries.forEach((entry, index) => {
    const row = document.createElement('div');
    row.className = 'hist-row';
    if (index === doc.history.cursor) row.classList.add('on');
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'hist';
    btn.dataset.historyIndex = String(index);
    btn.textContent = entry.label;
    btn.addEventListener('click', () => jumpHistory(doc, index));
    const src = document.createElement('button');
    src.type = 'button';
    src.className = 'hist-src';
    src.title = 'History brush source';
    src.textContent = index === doc.history.brushSource ? '◉' : '○';
    src.addEventListener('click', () => setHistoryBrush(doc, index));
    row.append(src, btn);
    host.append(row);
  });
}

function syncPaths() {
  const doc = activeDoc();
  const host = document.querySelector('[data-path-list]');
  if (!host) return;
  host.innerHTML = '';
  if (!doc) return;
  for (const path of doc.paths) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'hist';
    if (path.id === doc.activePathId) btn.classList.add('on');
    btn.textContent = path.name;
    btn.addEventListener('click', () => {
      doc.activePathId = path.id;
      changed();
    });
    host.append(btn);
  }
}

function syncChannels() {
  const doc = activeDoc();
  const host = document.querySelector('[data-tab-panel=channels]');
  if (!host) return;
  host.innerHTML = '';
  if (!doc) return;
  for (const [id, label] of [['rgb', 'RGB'], ['r', 'Red'], ['g', 'Green'], ['b', 'Blue']]) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'hist';
    if (doc.channel === id) btn.classList.add('on');
    btn.textContent = label;
    btn.addEventListener('click', () => {
      doc.channel = id;
      changed();
    });
    host.append(btn);
  }
}

function syncColor() {
  const { r, g, b } = hexToRgbSafe(state.fg);
  for (const channel of ['r', 'g', 'b']) {
    const el = document.querySelector(`[data-rgb=${channel}]`);
    if (el && document.activeElement !== el) el.value = String({ r, g, b }[channel]);
  }
  const hex = document.querySelector('[data-field=fg-hex]');
  if (hex && document.activeElement !== hex) hex.value = state.fg;
}

function hexToRgbSafe(hex) {
  const h = String(hex || '#000').replace('#', '');
  const n = Number.parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function renderFrame() {
  for (const doc of state.docs) drawDoc(doc);
  drawNav();
}

function drawDoc(doc) {
  const canvas = doc.view;
  if (!canvas) return;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  if (w < 2 || h < 2) return;
  if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
  }
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = '#808080';
  ctx.fillRect(0, 0, w, h);
  const flat = ensureFlat(doc);
  ctx.save();
  ctx.beginPath();
  ctx.rect(doc.panX, doc.panY, doc.width * doc.zoom, doc.height * doc.zoom);
  ctx.clip();
  ctx.fillStyle = checker();
  ctx.fillRect(doc.panX, doc.panY, doc.width * doc.zoom, doc.height * doc.zoom);
  ctx.imageSmoothingEnabled = doc.zoom < 2;
  ctx.translate(doc.panX, doc.panY);
  ctx.scale(doc.zoom, doc.zoom);
  if (flat) ctx.drawImage(flat, 0, 0);
  if (doc.transform) {
    const tr = doc.transform;
    ctx.save();
    const cx = tr.x + tr.w / 2;
    const cy = tr.y + tr.h / 2;
    ctx.translate(cx, cy);
    ctx.rotate(tr.angle || 0);
    ctx.translate(-cx, -cy);
    ctx.drawImage(tr.sprite, tr.ox, tr.oy, Math.max(1, tr.ow), Math.max(1, tr.oh), tr.x, tr.y, tr.w, tr.h);
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 1 / doc.zoom;
    ctx.strokeRect(tr.x, tr.y, tr.w, tr.h);
    ctx.restore();
  }
  if (doc.quickMask && doc.qm) {
    ctx.save();
    ctx.fillStyle = 'rgba(196,73,29,0.45)';
    ctx.fillRect(0, 0, doc.width, doc.height);
    ctx.globalCompositeOperation = 'destination-in';
    ctx.drawImage(doc.qm, 0, 0);
    ctx.restore();
  }
  ctx.restore();
  if (doc.selection && !doc.quickMask) {
    if (doc.antsDirty) rebuildAnts(doc);
    drawAnts(ctx, doc, dpr, w, h);
  }
  drawOverlay(ctx, doc);
  if (doc.channel !== 'rgb') tintChannel(canvas, doc.channel);
  drawGuides(ctx, doc, w, h);
  drawRulers(doc);
  canvas.style.cursor = guideCursor(doc, doc.cursor) || currentTool().cursor || 'crosshair';
}

let checkerPat;
function checker() {
  if (checkerPat) return checkerPat;
  const c = document.createElement('canvas');
  c.width = 16;
  c.height = 16;
  const g = c.getContext('2d');
  g.fillStyle = '#fff';
  g.fillRect(0, 0, 16, 16);
  g.fillStyle = '#c8c8c8';
  g.fillRect(0, 0, 8, 8);
  g.fillRect(8, 8, 8, 8);
  checkerPat = g.createPattern(c, 'repeat');
  return checkerPat;
}

function antPattern(phase) {
  if (antPats[phase]) return antPats[phase];
  const c = document.createElement('canvas');
  c.width = 8;
  c.height = 8;
  const g = c.getContext('2d');
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) {
      g.fillStyle = ((x + y + phase) % 8) < 4 ? '#fff' : '#000';
      g.fillRect(x, y, 1, 1);
    }
  }
  antPats[phase] = c;
  return c;
}

function drawAnts(ctx, doc, dpr, w, h) {
  const scratch = antsBuffer(w, h, dpr);
  const actx = scratch.getContext('2d');
  actx.setTransform(dpr, 0, 0, dpr, 0, 0);
  actx.clearRect(0, 0, w, h);
  actx.save();
  actx.translate(doc.panX, doc.panY);
  actx.scale(doc.zoom, doc.zoom);
  actx.drawImage(doc.ants, 0, 0);
  actx.restore();
  actx.globalCompositeOperation = 'source-in';
  actx.fillStyle = actx.createPattern(antPattern(state.antsPhase), 'repeat');
  actx.fillRect(0, 0, w, h);
  actx.globalCompositeOperation = 'source-over';
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.drawImage(scratch, 0, 0, w, h);
}

let antCanvas;
function antsBuffer(w, h, dpr) {
  const width = Math.round(w * dpr);
  const height = Math.round(h * dpr);
  if (!antCanvas || antCanvas.width !== width || antCanvas.height !== height) {
    antCanvas = document.createElement('canvas');
    antCanvas.width = width;
    antCanvas.height = height;
  }
  return antCanvas;
}

function drawOverlay(ctx, doc) {
  ctx.save();
  ctx.setTransform(Math.min(2, window.devicePixelRatio || 1), 0, 0, Math.min(2, window.devicePixelRatio || 1), 0, 0);
  ctx.translate(doc.panX, doc.panY);
  ctx.scale(doc.zoom, doc.zoom);
  ctx.lineWidth = 1 / doc.zoom;
  const gesture = doc.gesture;
  if (gesture?.kind === 'marquee') {
    ctx.strokeStyle = '#000';
    ctx.setLineDash([4 / doc.zoom, 3 / doc.zoom]);
    if (state.variant.marquee === 'ellipse') {
      ctx.beginPath();
      ctx.ellipse(gesture.x + gesture.w / 2, gesture.y + gesture.h / 2, Math.abs(gesture.w || 0) / 2, Math.abs(gesture.h || 0) / 2, 0, 0, Math.PI * 2);
      ctx.stroke();
    } else ctx.strokeRect(gesture.x, gesture.y, gesture.w || 0, gesture.h || 0);
  }
  if (gesture?.kind === 'lasso' && gesture.points) {
    ctx.strokeStyle = '#111';
    ctx.setLineDash([3 / doc.zoom, 2 / doc.zoom]);
    ctx.beginPath();
    ctx.moveTo(gesture.points[0].x, gesture.points[0].y);
    for (const point of gesture.points) ctx.lineTo(point.x, point.y);
    if (gesture.hover) ctx.lineTo(gesture.hover.x, gesture.hover.y);
    ctx.stroke();
  }
  if (gesture?.kind === 'zoom') {
    ctx.strokeStyle = '#000';
    ctx.strokeRect(gesture.x, gesture.y, (gesture.cx || gesture.x) - gesture.x, (gesture.cy || gesture.y) - gesture.y);
  }
  if (doc.crop) {
    const { x, y, w, h } = normalized(doc.crop);
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.fillRect(0, 0, doc.width, y);
    ctx.fillRect(0, y, x, h);
    ctx.fillRect(x + w, y, doc.width - x - w, h);
    ctx.fillRect(0, y + h, doc.width, doc.height - y - h);
    ctx.strokeStyle = '#fff';
    ctx.strokeRect(x, y, w, h);
  }
  const path = doc.paths.find((item) => item.id === doc.activePathId);
  if (path?.points?.length && state.tool === 'pen') {
    ctx.strokeStyle = '#111';
    ctx.beginPath();
    ctx.moveTo(path.points[0].x, path.points[0].y);
    for (let i = 1; i < path.points.length; i++) {
      const prev = path.points[i - 1];
      const point = path.points[i];
      ctx.bezierCurveTo(prev.x + (prev.outx || 0), prev.y + (prev.outy || 0), point.x + (point.inx || 0), point.y + (point.iny || 0), point.x, point.y);
    }
    if (path.closed) ctx.closePath();
    ctx.stroke();
  }
  if (state.showGrid) {
    ctx.strokeStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath();
    for (let x = 0; x < doc.width; x += 32) {
      ctx.moveTo(x, 0);
      ctx.lineTo(x, doc.height);
    }
    for (let y = 0; y < doc.height; y += 32) {
      ctx.moveTo(0, y);
      ctx.lineTo(doc.width, y);
    }
    ctx.stroke();
  }
  if (doc.cursor && ['brush', 'pencil', 'eraser', 'airbrush', 'stamp', 'history', 'focus', 'tone'].includes(state.tool)) {
    const size = toolOpts().size || state.opts.brush.size || 8;
    ctx.strokeStyle = '#000';
    ctx.beginPath();
    ctx.arc(doc.cursor.x, doc.cursor.y, size / 2, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}

function normalized(rect) {
  let { x, y, w, h } = rect;
  if (w < 0) { x += w; w = -w; }
  if (h < 0) { y += h; h = -h; }
  return { x, y, w, h };
}

function tintChannel(canvas, channel) {
  const ctx = canvas.getContext('2d');
  const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const index = { r: 0, g: 1, b: 2 }[channel];
  for (let i = 0; i < img.data.length; i += 4) {
    const v = img.data[i + index];
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
  }
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.putImageData(img, 0, 0);
}

function drawNav() {
  const canvas = document.querySelector('[data-nav]');
  const doc = activeDoc();
  if (!canvas || !doc) return;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#808080';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const flat = doc.flat;
  if (!flat) return;
  const scale = Math.min(canvas.width / doc.width, canvas.height / doc.height);
  const w = doc.width * scale;
  const h = doc.height * scale;
  const x = (canvas.width - w) / 2;
  const y = (canvas.height - h) / 2;
  ctx.drawImage(flat, x, y, w, h);
  if (!doc.view) return;
  const rect = doc.view.getBoundingClientRect();
  const vx = (-doc.panX / doc.zoom) * scale + x;
  const vy = (-doc.panY / doc.zoom) * scale + y;
  const vw = (rect.width / doc.zoom) * scale;
  const vh = (rect.height / doc.zoom) * scale;
  ctx.strokeStyle = '#f00';
  ctx.strokeRect(vx, vy, vw, vh);
  const slider = document.querySelector('[data-zoom]');
  if (slider && document.activeElement !== slider) slider.value = String(Math.round(doc.zoom * 100));
}

function buildSplash() {
  const splash = document.getElementById('splash');
  splash.innerHTML = `
    <div class="splash-card">
      <canvas id="splash-eye" width="220" height="140"></canvas>
      <h1>Goatshop 5.0</h1>
      <p>Crispygoat · 1998 Edition</p>
      <div class="plugins"><div class="plugins-track"></div></div>
      <div class="loadbar"><i></i></div>
      <button type="button" class="btn" data-action="splash-continue">Continue</button>
    </div>`;
  const track = splash.querySelector('.plugins-track');
  const names = [...PLUGINS, ...PLUGINS];
  track.innerHTML = names.map((name) => `<div>Loading ${name}…</div>`).join('');
  drawEye(splash.querySelector('#splash-eye'));
}

function drawEye(canvas) {
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#d8dde6';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#f4f7fb';
  ctx.beginPath();
  ctx.ellipse(78, 72, 58, 36, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#1c2430';
  ctx.stroke();
  const iris = ctx.createRadialGradient(78, 72, 4, 78, 72, 22);
  iris.addColorStop(0, '#f0c14a');
  iris.addColorStop(0.6, '#c4491d');
  iris.addColorStop(1, '#6a2412');
  ctx.fillStyle = iris;
  ctx.beginPath();
  ctx.ellipse(78, 72, 22, 22, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#140e0a';
  ctx.fillRect(70, 56, 8, 32);
  ctx.fillStyle = 'rgba(255,255,255,.85)';
  ctx.fillRect(88, 62, 6, 4);
  ctx.strokeStyle = '#6b4a2a';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(150, 110);
  ctx.quadraticCurveTo(190, 40, 210, 18);
  ctx.stroke();
  ctx.fillStyle = '#e7e2d4';
  ctx.beginPath();
  ctx.ellipse(206, 22, 10, 18, -0.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#8a8172';
  ctx.stroke();
  ctx.strokeStyle = '#b7ad9a';
  ctx.beginPath();
  ctx.moveTo(198, 30);
  ctx.quadraticCurveTo(206, 22, 214, 16);
  ctx.stroke();
}

function showSplash() {
  const splash = document.getElementById('splash');
  const done = () => {
    if (splash.hidden) return;
    splash.hidden = true;
    document.getElementById('start').hidden = state.docs.length > 0;
    changed();
  };
  splash.querySelector('[data-action=splash-continue]').addEventListener('click', done);
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  window.setTimeout(done, reduce ? 500 : 2600);
}

function buildStart() {
  const start = document.getElementById('start');
  start.innerHTML = `
    <div class="start-card">
      <header class="dialog-title"><span>Goatshop 5.0</span></header>
      <div class="dialog-body">
        <p>Open a picture or start a blank canvas.</p>
        <div class="start-actions">
          <button type="button" class="btn" data-action="start-new">New...</button>
          <button type="button" class="btn" data-action="start-open">Open...</button>
          <button type="button" class="btn" data-action="start-restore" hidden>Restore session</button>
        </div>
        <div class="samples" data-samples></div>
      </div>
    </div>`;
  const host = start.querySelector('[data-samples]');
  for (const sample of SAMPLES) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'sample';
    btn.innerHTML = `<img alt="" src="${sample.file}" width="120" height="80"><span>${sample.name}</span>`;
    btn.addEventListener('click', () => openSample(sample.file, sample.name).catch((error) => {
      state.status = error.message;
      changed();
    }));
    host.append(btn);
  }
  hasSession().then((yes) => {
    const btn = start.querySelector('[data-action=start-restore]');
    if (btn) btn.hidden = !yes;
  }).catch(() => {});
}

function wireGlobal() {
  document.getElementById('app').addEventListener('click', (event) => {
    const action = event.target.closest('[data-action]')?.dataset.action;
    if (!action) return;
    if (action === 'swap') { const t = state.fg; state.fg = state.bg; state.bg = t; changed(); }
    if (action === 'reset-colors') { state.fg = '#000000'; state.bg = '#ffffff'; changed(); }
    if (action === 'quick-mask') toggleQuickMask();
    if (action === 'toggle-panels') { state.palettesHidden = !state.palettesHidden; changed(); }
    if (action === 'start-new' || action === 'new') openNewDialog();
    if (action === 'start-open') document.getElementById('file-open').click();
    if (action === 'start-restore') restoreSession().catch(() => {});
    if (action === 'new-layer') addLayer();
    if (action === 'dup-layer') duplicateLayer();
    if (action === 'del-layer') deleteLayer();
    if (action === 'mask-layer') addMask();
    if (action === 'fx-layer') openShadow();
    if (action === 'merge-layer') mergeDown();
    if (action === 'flat-layer') flatten();
    if (action === 'snapshot') takeSnapshot();
    if (action === 'path-selection') usePath('selection');
    if (action === 'path-stroke') usePath('stroke');
    if (action === 'path-fill') usePath('fill');
  });
  document.querySelector('[data-field=blend]').addEventListener('change', (event) => {
    const layer = activeLayer();
    if (!layer) return;
    layer.blend = event.target.value;
    commit(activeDoc(), 'Blend', new Set());
  });
  const opacity = document.querySelector('[data-field=opacity]');
  opacity.addEventListener('input', () => {
    const layer = activeLayer();
    const doc = activeDoc();
    if (!layer || !doc) return;
    layer.opacity = Number(opacity.value) / 100;
    doc.flatDirty = true;
    requestRender();
  });
  opacity.addEventListener('change', () => {
    if (activeDoc()) commit(activeDoc(), 'Opacity', new Set());
  });
  document.querySelector('[data-zoom]').addEventListener('input', (event) => {
    const doc = activeDoc();
    if (!doc) return;
    const point = clientToDoc(doc, doc.view.getBoundingClientRect().left + doc.view.clientWidth / 2, doc.view.getBoundingClientRect().top + doc.view.clientHeight / 2);
    import('./tools.js').then(({ zoomAt }) => zoomAt(doc, Number(event.target.value) / 100, point));
  });
  document.getElementById('file-open').addEventListener('change', (event) => {
    const file = event.target.files?.[0];
    if (file) openImageFile(file).catch((error) => { state.status = error.message; changed(); });
    event.target.value = '';
  });
  const desk = document.getElementById('desk');
  desk.addEventListener('dragover', (event) => event.preventDefault());
  desk.addEventListener('drop', (event) => {
    event.preventDefault();
    const file = event.dataTransfer?.files?.[0];
    if (file) openImageFile(file).catch(() => {});
  });
  document.addEventListener('pointerdown', (event) => {
    if (!event.target.closest('.menu-pop') && !event.target.closest('.menu-title')) closeMenus();
  });
  for (const channel of ['r', 'g', 'b']) {
    document.querySelector(`[data-rgb=${channel}]`).addEventListener('input', () => {
      const r = document.querySelector('[data-rgb=r]').value;
      const g = document.querySelector('[data-rgb=g]').value;
      const b = document.querySelector('[data-rgb=b]').value;
      state.fg = `#${[r, g, b].map((v) => Number(v).toString(16).padStart(2, '0')).join('')}`;
      changed();
    });
  }
  document.querySelector('[data-field=fg-hex]').addEventListener('change', (event) => {
    const value = event.target.value.trim();
    if (/^#?[0-9a-fA-F]{6}$/.test(value)) {
      state.fg = value.startsWith('#') ? value : `#${value}`;
      changed();
    }
  });
  document.querySelectorAll('[data-brush-global]').forEach((el) => {
    el.addEventListener('input', () => {
      const opts = toolOpts();
      const key = el.dataset.opt;
      const value = Number(el.value);
      if (opts[key] != null) opts[key] = value;
      state.opts.brush[key] = value;
      changed('render');
    });
  });
  window.addEventListener('resize', () => requestRender());
}

function togglePanel(id) {
  state.panels[id] = !state.panels[id];
  changed();
}

function resetPanels() {
  state.panels = { options: true, tools: true, nav: true, color: true, layers: true, history: true };
  state.palettesHidden = false;
  document.querySelectorAll('.palette.floating').forEach((el) => {
    el.classList.remove('floating');
    el.style.left = '';
    el.style.top = '';
    document.getElementById('dock').append(el);
  });
  changed();
}

export function cycleVariant(id) {
  const tool = TOOL_BUTTONS.find((item) => item.id === id);
  if (!tool?.fly) return;
  const list = tool.fly.map((item) => item[0]);
  const current = state.variant[id] || list[0];
  state.variant[id] = list[(list.indexOf(current) + 1) % list.length];
  state.tool = id;
  changed();
}

export { paintFlat, mark, closeMenus };
