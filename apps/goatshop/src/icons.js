/** Original 16×16 tool icons. Drawn for Goatshop, not copied from any editor. */
const I = {
  marquee: `<rect x="2" y="2" width="12" height="12" fill="none" stroke="#111" stroke-width="1" stroke-dasharray="2 1"/>`,
  ellipse: `<ellipse cx="8" cy="8" rx="6" ry="5" fill="none" stroke="#111" stroke-dasharray="2 1"/>`,
  move: `<path d="M8 1v14M1 8h14M8 1l-2 2M8 1l2 2M8 15l-2-2M8 15l2-2M1 8l2-2M1 8l2 2M15 8l-2-2M15 8l-2 2" stroke="#111" fill="none"/>`,
  lasso: `<path d="M3 8c0-4 3-6 6-4 2 1 4 0 4 2 0 4-2 3-3 5-1 2-4 3-6 1" fill="none" stroke="#111"/>`,
  poly: `<path d="M3 12 L8 3 L13 8 L10 13 Z" fill="none" stroke="#111"/>`,
  magnetic: `<path d="M2 9c2-5 4-5 6-2s4 0 6-3" fill="none" stroke="#111"/><rect x="2" y="8" width="2" height="2" fill="#111"/><rect x="7" y="6" width="2" height="2" fill="#111"/><rect x="12" y="3" width="2" height="2" fill="#111"/>`,
  wand: `<path d="M3 13 L10 6" stroke="#111"/><rect x="9" y="2" width="5" height="5" fill="#c4491d"/><rect x="11" y="1" width="1" height="2" fill="#111"/><rect x="13" y="4" width="2" height="1" fill="#111"/>`,
  crop: `<path d="M4 2v10h10" fill="none" stroke="#111"/><path d="M2 4h2M12 14v-2" stroke="#111"/>`,
  airbrush: `<rect x="6" y="2" width="4" height="6" fill="#444"/><rect x="7" y="8" width="2" height="2" fill="#222"/><rect x="3" y="11" width="2" height="2" fill="#666"/><rect x="7" y="12" width="2" height="2" fill="#888"/><rect x="11" y="11" width="2" height="2" fill="#555"/><rect x="5" y="14" width="1" height="1" fill="#777"/><rect x="9" y="14" width="1" height="1" fill="#777"/>`,
  brush: `<path d="M2 12c2-1 3-4 4-7 1-2 3-3 5-3 1 2-1 4-2 5-2 2-4 3-7 5z" fill="#c4491d" stroke="#111"/><rect x="2" y="12" width="3" height="2" fill="#222"/>`,
  pencil: `<path d="M2 14 L10 4 L13 6 L5 15 Z" fill="#e6c34a" stroke="#111"/><path d="M10 4 L13 6 L12 2 Z" fill="#ddd" stroke="#111"/>`,
  stamp: `<rect x="4" y="2" width="8" height="4" fill="#666"/><rect x="7" y="6" width="2" height="3" fill="#444"/><rect x="3" y="9" width="10" height="4" fill="#c4491d" stroke="#111"/>`,
  history: `<circle cx="8" cy="8" r="5" fill="none" stroke="#111"/><path d="M8 5v4l3 2" stroke="#111"/><rect x="2" y="12" width="4" height="3" fill="#c4491d"/>`,
  eraser: `<rect x="3" y="6" width="10" height="5" transform="rotate(-30 8 8)" fill="#f4b4c4" stroke="#111"/>`,
  line: `<path d="M2 13 L13 3" stroke="#111" stroke-width="2"/>`,
  gradient: `<rect x="2" y="3" width="12" height="10" fill="#111"/><rect x="3" y="4" width="3" height="8" fill="#ccc"/><rect x="6" y="4" width="3" height="8" fill="#888"/><rect x="9" y="4" width="4" height="8" fill="#333"/>`,
  bucket: `<path d="M3 7h8l1 7H4z" fill="#3a6ea5" stroke="#111"/><path d="M11 6c2 0 3 2 2 3" fill="none" stroke="#111"/><rect x="5" y="3" width="4" height="2" fill="#888"/>`,
  blur: `<circle cx="6" cy="8" r="3" fill="#9cf"/><circle cx="10" cy="8" r="3" fill="#9cf" opacity=".7"/>`,
  sharpen: `<path d="M8 2 L14 14 H2 Z" fill="none" stroke="#111"/>`,
  smudge: `<path d="M4 12c0-4 1-8 3-8s2 2 2 4 1 2 2 2 2-3 3-3 1 5 1 6c0 2-2 3-5 3H7c-2 0-3-1-3-4z" fill="#e6b898" stroke="#111"/>`,
  dodge: `<circle cx="8" cy="7" r="4" fill="#eee" stroke="#111"/><path d="M8 11v3" stroke="#111"/>`,
  burn: `<circle cx="8" cy="7" r="4" fill="#222" stroke="#111"/><path d="M8 11v3" stroke="#111"/>`,
  sponge: `<ellipse cx="8" cy="8" rx="6" ry="4" fill="#d4a017" stroke="#111"/><rect x="4" y="7" width="2" height="2" fill="#a67c00"/><rect x="8" y="6" width="2" height="2" fill="#a67c00"/>`,
  pen: `<path d="M3 13 L9 3 L12 5 L6 15 Z" fill="#111"/><path d="M9 3 L12 5 L13 2 Z" fill="#c4491d"/>`,
  type: `<path d="M3 3h10M8 3v10M5 13h6" stroke="#111" fill="none"/>`,
  eyedropper: `<path d="M9 2l5 5-2 2-5-5z" fill="#ccc" stroke="#111"/><path d="M7 7 L3 13l2 1 5-6" fill="#3a6ea5" stroke="#111"/>`,
  hand: `<path d="M6 7V3h2v4h1V4h2v4h1V5h2v6c0 3-2 4-5 4H8c-2 0-3-2-3-4V8H6z" fill="#f2d2b3" stroke="#111"/>`,
  zoom: `<circle cx="7" cy="7" r="4" fill="none" stroke="#111"/><path d="M10 10l4 4" stroke="#111"/>`,
  mask: `<rect x="2" y="2" width="12" height="12" fill="#c4491d"/><rect x="5" y="5" width="6" height="6" fill="none" stroke="#fff" stroke-dasharray="2 1"/>`,
};

export function icon(name) {
  const body = I[name] || I.brush;
  return `<svg class="ico" viewBox="0 0 16 16" width="16" height="16" shape-rendering="crispEdges" aria-hidden="true">${body}</svg>`;
}

export const TOOL_BUTTONS = [
  { id: 'marquee', fly: [['rect', 'Rectangular', 'marquee'], ['ellipse', 'Elliptical', 'ellipse']] },
  { id: 'move', icon: 'move' },
  { id: 'lasso', fly: [['free', 'Lasso', 'lasso'], ['poly', 'Polygonal', 'poly'], ['magnetic', 'Magnetic', 'magnetic']] },
  { id: 'wand', icon: 'wand' },
  { id: 'crop', icon: 'crop' },
  { id: 'airbrush', icon: 'airbrush' },
  { id: 'brush', icon: 'brush' },
  { id: 'pencil', icon: 'pencil' },
  { id: 'stamp', icon: 'stamp' },
  { id: 'history', icon: 'history' },
  { id: 'eraser', icon: 'eraser' },
  { id: 'line', icon: 'line' },
  { id: 'gradient', icon: 'gradient' },
  { id: 'bucket', icon: 'bucket' },
  { id: 'focus', fly: [['blur', 'Blur', 'blur'], ['sharpen', 'Sharpen', 'sharpen'], ['smudge', 'Smudge', 'smudge']] },
  { id: 'tone', fly: [['dodge', 'Dodge', 'dodge'], ['burn', 'Burn', 'burn'], ['sponge', 'Sponge', 'sponge']] },
  { id: 'pen', icon: 'pen' },
  { id: 'type', icon: 'type' },
  { id: 'eyedropper', icon: 'eyedropper' },
  { id: 'hand', icon: 'hand' },
  { id: 'zoom', icon: 'zoom' },
];

export function toolIconName(id) {
  const row = TOOL_BUTTONS.find((item) => item.id === id);
  if (!row) return id;
  if (row.icon) return row.icon;
  const variant = row.fly?.[0]?.[2] || id;
  return variant;
}
