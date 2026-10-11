// Auto-defrag. The read head chases the next red block. Blue grows from the left.

import { COLORS, mulberry32 } from './disk.js';

function shuffle(list, rng) {
  for (let i = list.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    const swap = list[i];
    list[i] = list[j];
    list[j] = swap;
  }
  return list;
}

export function createZen(spec, seed = 1) {
  const rng = mulberry32(seed >>> 0);
  const n = spec.cols * spec.rows;
  const cells = Array.from({ length: n }, () => ({ t: 'free', opt: false, flash: null }));
  const pool = [];
  for (let i = Math.floor(n * 0.08); i < n; i += 1) pool.push(i);
  shuffle(pool, rng);
  const hazards = spec.hazards || 0;
  const bad = spec.bad || 0;
  for (let i = 0; i < hazards && i < pool.length; i += 1) {
    cells[pool[i]] = { t: 'fixed', opt: false, flash: null };
  }
  for (let i = 0; i < bad && hazards + i < pool.length; i += 1) {
    cells[pool[hazards + i]] = { t: 'bad', opt: false, flash: null };
  }
  const targetData = Math.max(1, Math.floor(n * (spec.fill ?? 0.74)));
  const initialOpt = Math.max(1, Math.floor(targetData * (spec.initial ?? 0.05)));
  let opt = 0;
  let data = 0;
  for (let i = 0; i < n && opt < initialOpt; i += 1) {
    if (cells[i].t !== 'free') continue;
    cells[i] = { t: 'data', opt: true, flash: null };
    opt += 1;
    data += 1;
  }
  const free = [];
  for (let i = 0; i < n; i += 1) if (cells[i].t === 'free') free.push(i);
  shuffle(free, rng);
  while (data < targetData && free.length) {
    const index = free.pop();
    cells[index] = { t: 'data', opt: false, flash: null };
    data += 1;
  }
  return {
    spec,
    cols: spec.cols,
    rows: spec.rows,
    cells,
    totalData: data,
    optData: opt,
    cursor: 0,
    prevCursor: 0,
    readFrom: -1,
    done: false,
    restartsFired: 0,
  };
}

export function zenRatio(zen) {
  return zen.totalData ? zen.optData / zen.totalData : 0;
}

function clearFlashes(zen) {
  for (const cell of zen.cells) cell.flash = null;
}

function findFrontier(zen) {
  for (let i = 0; i < zen.cells.length; i += 1) {
    const cell = zen.cells[i];
    if (cell.t === 'fixed' || cell.t === 'bad') continue;
    if (cell.t === 'free' || (cell.t === 'data' && !cell.opt)) return i;
  }
  return -1;
}

function findFragment(zen, from) {
  for (let i = from; i < zen.cells.length; i += 1) {
    if (zen.cells[i].t === 'data' && !zen.cells[i].opt) return i;
  }
  for (let i = 0; i < from; i += 1) {
    if (zen.cells[i].t === 'data' && !zen.cells[i].opt) return i;
  }
  return -1;
}

export function zenStep(zen, { reduced = false } = {}) {
  if (zen.done) return { sound: null, done: true };
  clearFlashes(zen);
  const writeAt = findFrontier(zen);
  if (writeAt < 0) {
    zen.done = true;
    return { sound: null, done: true };
  }
  const cell = zen.cells[writeAt];
  if (cell.t === 'data' && !cell.opt) {
    if (!reduced && zen.readFrom !== writeAt) {
      cell.flash = 'read';
      zen.readFrom = writeAt;
      zen.cursor = writeAt;
      return { sound: 'read', dist: Math.abs(writeAt - zen.prevCursor) };
    }
    cell.opt = true;
    cell.flash = 'write';
    zen.optData += 1;
    zen.readFrom = -1;
    zen.prevCursor = zen.cursor;
    zen.cursor = writeAt;
    return { sound: 'write', dist: 0 };
  }
  const src = findFragment(zen, writeAt + 1);
  if (src < 0) {
    zen.done = true;
    return { sound: null, done: true };
  }
  if (!reduced && zen.readFrom !== src) {
    zen.cells[src].flash = 'read';
    const dist = Math.abs(src - zen.prevCursor);
    zen.prevCursor = zen.cursor;
    zen.cursor = src;
    zen.readFrom = src;
    return { sound: dist > 6 ? 'seek' : 'read', dist };
  }
  zen.cells[writeAt] = { t: 'data', opt: true, flash: 'write' };
  zen.cells[src] = { t: 'free', opt: false, flash: null };
  zen.optData += 1;
  zen.readFrom = -1;
  zen.prevCursor = zen.cursor;
  zen.cursor = writeAt;
  return { sound: 'write', dist: Math.abs(writeAt - src) };
}

export function zenRestart(zen, rng) {
  const target = Math.max(1, Math.round(zen.totalData * 0.1));
  const optimized = [];
  for (let i = 0; i < zen.cells.length; i += 1) {
    if (zen.cells[i].t === 'data' && zen.cells[i].opt) optimized.push(i);
  }
  shuffle(optimized, rng);
  let guard = 0;
  while (zen.optData > target && optimized.length && guard < 10000) {
    guard += 1;
    const src = optimized.pop();
    if (!(zen.cells[src].t === 'data' && zen.cells[src].opt)) continue;
    const free = [];
    for (let i = 0; i < zen.cells.length; i += 1) {
      if (zen.cells[i].t === 'free') free.push(i);
    }
    if (!free.length) {
      zen.cells[src].opt = false;
      zen.optData -= 1;
      continue;
    }
    const dest = free[Math.floor(rng() * free.length)];
    zen.cells[dest] = { t: 'data', opt: false, flash: null };
    zen.cells[src] = { t: 'free', opt: false, flash: null };
    zen.optData -= 1;
  }
  zen.readFrom = -1;
  zen.done = false;
  return zenRatio(zen);
}

export function zenRefragment(zen, rng, ratio = 0.45) {
  const keep = Math.max(1, Math.round(zen.totalData * ratio));
  const optimized = [];
  for (let i = 0; i < zen.cells.length; i += 1) {
    if (zen.cells[i].t === 'data' && zen.cells[i].opt) optimized.push(i);
  }
  shuffle(optimized, rng);
  while (zen.optData > keep && optimized.length) {
    const src = optimized.pop();
    if (!(zen.cells[src].t === 'data' && zen.cells[src].opt)) continue;
    const free = [];
    for (let i = Math.floor(zen.cells.length * 0.35); i < zen.cells.length; i += 1) {
      if (zen.cells[i].t === 'free') free.push(i);
    }
    if (!free.length) {
      zen.cells[src].opt = false;
      zen.optData -= 1;
      continue;
    }
    const dest = free[Math.floor(rng() * free.length)];
    zen.cells[dest] = { t: 'data', opt: false, flash: null };
    zen.cells[src] = { t: 'free', opt: false, flash: null };
    zen.optData -= 1;
  }
  zen.readFrom = -1;
  zen.done = false;
}

export const ZEN_RESTARTS = [0.32, 0.68];

export function zenColor(cell) {
  if (cell.flash === 'read') return COLORS.reading;
  if (cell.flash === 'write') return COLORS.writing;
  if (cell.t === 'fixed') return COLORS.unmovable;
  if (cell.t === 'bad') return COLORS.bad;
  if (cell.t === 'free') return COLORS.free;
  return cell.opt ? COLORS.optimized : COLORS.fragmented;
}
