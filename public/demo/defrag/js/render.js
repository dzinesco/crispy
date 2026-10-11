// 60fps cluster map. One rectangle per block, nearest-neighbor crisp.

import { COLORS } from './disk.js';

export function paint(canvas, view) {
  const ctx = canvas.getContext('2d', { alpha: false });
  if (!ctx) return;
  const { cols, rows, colors, head, carry, hint, cursor } = view;
  const width = canvas.width;
  const height = canvas.height;
  ctx.fillStyle = '#c0c0c0';
  ctx.fillRect(0, 0, width, height);
  const cw = width / cols;
  const ch = height / rows;
  const inset = Math.max(1, Math.round(Math.min(cw, ch) * 0.08));
  for (let i = 0; i < colors.length; i += 1) {
    const col = i % cols;
    const row = (i / cols) | 0;
    const x = Math.round(col * cw) + inset;
    const y = Math.round(row * ch) + inset;
    const w = Math.max(1, Math.round((col + 1) * cw) - Math.round(col * cw) - inset * 2);
    const h = Math.max(1, Math.round((row + 1) * ch) - Math.round(row * ch) - inset * 2);
    ctx.fillStyle = i === carry ? COLORS.free : colors[i];
    ctx.fillRect(x, y, w, h);
    if (colors[i] === COLORS.bad && w > 6 && h > 6 && i !== carry) {
      ctx.strokeStyle = '#ff4040';
      ctx.lineWidth = Math.max(1, Math.round(Math.min(w, h) * 0.12));
      ctx.beginPath();
      ctx.moveTo(x + 2, y + 2);
      ctx.lineTo(x + w - 2, y + h - 2);
      ctx.moveTo(x + w - 2, y + 2);
      ctx.lineTo(x + 2, y + h - 2);
      ctx.stroke();
    }
  }
  if (hint != null && hint >= 0 && hint < colors.length) stroke(ctx, hint, cols, cw, ch, '#ffffff', '#000000');
  if (cursor != null && cursor >= 0) stroke(ctx, cursor, cols, cw, ch, '#00ff00', '#003300');
  if (head != null && head >= 0) {
    stroke(ctx, head, cols, cw, ch, '#ffffff', '#000000');
    if (carry != null && view.carryColor) {
      const col = head % cols;
      const row = (head / cols) | 0;
      const x = Math.round(col * cw) + inset + 2;
      const y = Math.round(row * ch) + inset + 2;
      const w = Math.max(1, Math.round((col + 1) * cw) - Math.round(col * cw) - inset * 2 - 4);
      const h = Math.max(1, Math.round((row + 1) * ch) - Math.round(row * ch) - inset * 2 - 4);
      ctx.fillStyle = view.carryColor;
      ctx.fillRect(x, y, w, h);
    }
  }
}

function stroke(ctx, index, cols, cw, ch, outer, inner) {
  const col = index % cols;
  const row = (index / cols) | 0;
  const x = Math.round(col * cw);
  const y = Math.round(row * ch);
  const w = Math.round((col + 1) * cw) - x;
  const h = Math.round((row + 1) * ch) - y;
  ctx.strokeStyle = outer;
  ctx.lineWidth = 2;
  ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);
  ctx.strokeStyle = inner;
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 3, y + 3, w - 6, h - 6);
}
