// Disk model for the defragmenter. No DOM. Levels, moves, scoring.

export const COLORS = {
  optimized: '#0000ff',
  fragmented: '#ff0000',
  reading: '#00ff00',
  writing: '#ffff00',
  free: '#ffffff',
  unmovable: '#008080',
  bad: '#800000',
};

export const LEGEND = [
  { id: 'optimized', label: 'Optimized data', color: COLORS.optimized },
  { id: 'fragmented', label: 'Fragmented data', color: COLORS.fragmented },
  { id: 'reading', label: 'Data being read', color: COLORS.reading },
  { id: 'writing', label: 'Data being written', color: COLORS.writing },
  { id: 'free', label: 'Free space', color: COLORS.free },
  { id: 'unmovable', label: 'Unmovable', color: COLORS.unmovable },
  { id: 'bad', label: 'Bad', color: COLORS.bad },
];

export const FILE_COLORS = [
  '#ff66cc', '#ff8800', '#cc66ff', '#66ccff', '#ccff66', '#ffcc66',
  '#ff6666', '#66ffcc', '#ff99ff', '#99aaff', '#ffaa33', '#dda0dd',
  '#f4a460', '#87ceeb', '#da70d6', '#cd853f', '#b0e0e6', '#ffb6c1',
];

export const ZEN_DRIVES = [
  { id: 'floppy', label: 'A:  1.44 MB', title: 'Defragmenting Drive A', sizeLabel: '1.44MB', cols: 18, rows: 8, fill: 0.7, hazards: 1, bad: 0, initial: 0.06 },
  { id: '540', label: 'C:  540 MB', title: 'Defragmenting Drive C', sizeLabel: '540MB', cols: 28, rows: 12, fill: 0.74, hazards: 4, bad: 1, initial: 0.05 },
  { id: '2g', label: 'C:  2.1 GB', title: 'Defragmenting Drive C', sizeLabel: '2.1GB', cols: 36, rows: 16, fill: 0.76, hazards: 6, bad: 2, initial: 0.05 },
  { id: 'family', label: 'C:  The Family PC', title: 'Defragmenting Drive C', sizeLabel: 'the family PC', cols: 44, rows: 18, fill: 0.8, hazards: 10, bad: 4, initial: 0.04 },
];

export const LEVELS = [
  {
    id: 'floppy',
    name: 'Floppy',
    label: 'A:  1.44 MB',
    title: 'Defragmenting Drive A',
    sizeLabel: '1.44MB',
    cols: 12,
    rows: 5,
    seed: 1440,
    unmovable: 2,
    bad: 0,
    hazardGap: 8,
    hazardFrom: 0.72,
    scatter: 0.92,
    restart: false,
    scandiskAt: 0,
    charges: { turbo: 0, format: 0, coffee: 1 },
    par: { seek: 420, ms: 180000 },
    files: [
      { name: 'GOAT.SYS', size: 3 },
      { name: 'READ.ME', size: 2 },
      { name: 'SNACK.DAT', size: 4 },
      { name: 'BOOT.CFG', size: 2 },
    ],
  },
  {
    id: '540',
    name: '540 MB',
    label: 'C:  540 MB',
    title: 'Defragmenting Drive C',
    sizeLabel: '540MB',
    cols: 20,
    rows: 10,
    seed: 5401,
    unmovable: 4,
    bad: 1,
    hazardGap: 11,
    hazardFrom: 0.28,
    scatter: 0.9,
    restart: false,
    scandiskAt: 0,
    charges: { turbo: 1, format: 0, coffee: 1 },
    par: { seek: 2200, ms: 300000 },
    files: [
      { name: 'DIARY.DOC', size: 6 },
      { name: 'HOMEWORK.TXT', size: 5 },
      { name: 'MIDI.TUN', size: 8 },
      { name: 'SAVE.GAM', size: 7 },
      { name: 'BUDGET.NUM', size: 4 },
      { name: 'PHOTO.BMP', size: 9 },
      { name: 'MODEM.LOG', size: 3 },
      { name: 'RECIPE.TXT', size: 4 },
    ],
  },
  {
    id: '2g',
    name: '2.1 GB',
    label: 'C:  2.1 GB',
    title: 'Defragmenting Drive C',
    sizeLabel: '2.1GB',
    cols: 28,
    rows: 14,
    seed: 2100,
    unmovable: 8,
    bad: 3,
    hazardGap: 12,
    hazardFrom: 0.22,
    scatter: 0.9,
    restart: true,
    scandiskAt: 0,
    charges: { turbo: 1, format: 1, coffee: 1 },
    par: { seek: 6000, ms: 420000 },
    files: [
      { name: 'ESSAY.FIN', size: 8 },
      { name: 'DOG-PIC.BMP', size: 10 },
      { name: 'TAX98.NUM', size: 6 },
      { name: 'CHAT.LOG', size: 5 },
      { name: 'MIXTAPE.WAV', size: 11 },
      { name: 'LETTER.DOC', size: 4 },
      { name: 'SCHOOL.TXT', size: 7 },
      { name: 'GAME.SAV', size: 9 },
      { name: 'SCANNER.BMP', size: 8 },
      { name: 'JOKE.TXT', size: 3 },
      { name: 'BACKUP.OLD', size: 6 },
      { name: 'SCREEN.BMP', size: 7 },
    ],
  },
  {
    id: 'family',
    name: 'The Family PC',
    label: 'C:  The Family PC',
    title: 'Defragmenting Drive C',
    sizeLabel: 'the family PC',
    cols: 32,
    rows: 16,
    seed: 6400,
    unmovable: 12,
    bad: 5,
    hazardGap: 14,
    hazardFrom: 0.18,
    scatter: 0.93,
    restart: true,
    scandiskAt: 6,
    charges: { turbo: 2, format: 1, coffee: 2 },
    par: { seek: 9000, ms: 540000 },
    files: [
      { name: 'TAXES.DOC', size: 8 },
      { name: 'DOG.BMP', size: 10 },
      { name: 'TERM.PAP', size: 9 },
      { name: 'MAYBE.EXE', size: 6 },
      { name: 'FAMILY.BMP', size: 11 },
      { name: 'CHAT.LOG', size: 5 },
      { name: 'MIXTAPE.WAV', size: 8 },
      { name: 'RECIPE.BOX', size: 4 },
      { name: 'SCHOOL.TXT', size: 7 },
      { name: 'GAME.SAV', size: 10 },
      { name: 'LETTER.DOC', size: 4 },
      { name: 'BUDGET.NUM', size: 6 },
      { name: 'SCANNER.BMP', size: 8 },
      { name: 'MODEM.CFG', size: 3 },
      { name: 'JOKE.TXT', size: 3 },
      { name: 'DIARY.DOC', size: 7 },
    ],
  },
];

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function rng() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle(list, rng) {
  for (let i = list.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    const swap = list[i];
    list[i] = list[j];
    list[j] = swap;
  }
  return list;
}

export function levelById(id) {
  return LEVELS.find((level) => level.id === id) || LEVELS[0];
}

export function zenById(id) {
  return ZEN_DRIVES.find((drive) => drive.id === id) || ZEN_DRIVES[2];
}

function blankCell() {
  return { t: 'free', f: null };
}

function assignHomes(cells, files) {
  const gaps = [];
  let run = [];
  for (let i = 0; i < cells.length; i += 1) {
    if (cells[i].t === 'free') run.push(i);
    else if (run.length) {
      gaps.push(run);
      run = [];
    }
  }
  if (run.length) gaps.push(run);
  const used = gaps.map(() => 0);
  const order = [...files].sort((a, b) => b.size - a.size || a.id - b.id);
  for (const file of order) {
    let placed = false;
    for (let g = 0; g < gaps.length; g += 1) {
      const room = gaps[g].length - used[g];
      if (room < file.size) continue;
      file.home = gaps[g].slice(used[g], used[g] + file.size);
      used[g] += file.size;
      for (const idx of file.home) cells[idx] = { t: 'file', f: file.id };
      placed = true;
      break;
    }
    if (!placed) return false;
  }
  return true;
}

function scatter(cells, rng, chance) {
  const free = [];
  for (let i = 0; i < cells.length; i += 1) if (cells[i].t === 'free') free.push(i);
  for (let i = 0; i < cells.length; i += 1) {
    if (cells[i].t !== 'file' || rng() > chance || !free.length) continue;
    const j = Math.floor(rng() * free.length);
    const dest = free[j];
    const fileId = cells[i].f;
    cells[dest] = { t: 'file', f: fileId };
    cells[i] = blankCell();
    free[j] = i;
  }
}

function tryCreate(spec, seed, dropHazards) {
  const rng = mulberry32(seed);
  const n = spec.cols * spec.rows;
  const cells = Array.from({ length: n }, blankCell);
  const unmovable = Math.max(0, spec.unmovable - dropHazards);
  const bad = Math.max(0, spec.bad - Math.max(0, dropHazards - spec.unmovable));
  const pool = [];
  const from = Math.floor(n * spec.hazardFrom);
  for (let i = from; i < n; i += 1) pool.push(i);
  shuffle(pool, rng);
  const chosen = [];
  const need = unmovable + bad;
  const gap = spec.hazardGap || 8;
  for (const idx of pool) {
    if (chosen.length >= need) break;
    if (chosen.some((other) => Math.abs(other - idx) < gap)) continue;
    chosen.push(idx);
  }
  if (chosen.length < need) return null;
  for (let i = 0; i < unmovable; i += 1) cells[chosen[i]] = { t: 'fixed', f: null };
  for (let i = 0; i < bad; i += 1) cells[chosen[unmovable + i]] = { t: 'bad', f: null };
  const files = spec.files.map((file, index) => ({
    id: index + 1,
    name: file.name,
    color: FILE_COLORS[index % FILE_COLORS.length],
    size: file.size,
    home: [],
  }));
  if (!assignHomes(cells, files)) return null;
  scatter(cells, rng, spec.scatter ?? 0.9);
  return { cells, files, seed };
}

export function createLevel(spec, seed = spec.seed) {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const made = tryCreate(spec, (seed + attempt * 997) >>> 0, attempt);
    if (!made) continue;
    return {
      id: spec.id,
      name: spec.name,
      label: spec.label,
      title: spec.title,
      sizeLabel: spec.sizeLabel,
      cols: spec.cols,
      rows: spec.rows,
      cells: made.cells,
      files: made.files,
      charges: { ...spec.charges },
      par: spec.par,
      restart: !!spec.restart,
      scandiskAt: spec.scandiskAt || 0,
      seed: made.seed,
    };
  }
  throw new Error(`Level ${spec.id} does not fit on the disk`);
}

export function relocate(state, from, to) {
  const src = state.cells[from];
  const dest = state.cells[to];
  if (!src || src.t !== 'file') return { ok: false, reason: 'empty' };
  if (!dest || dest.t !== 'free') return { ok: false, reason: 'blocked' };
  if (from === to) return { ok: false, reason: 'same' };
  const fileId = src.f;
  state.cells[to] = { t: 'file', f: fileId };
  state.cells[from] = blankCell();
  return { ok: true, fileId, dist: Math.abs(to - from) };
}

export function fileById(state, id) {
  return state.files.find((file) => file.id === id) || null;
}

export function fileHome(state, fileId) {
  const file = fileById(state, fileId);
  if (!file) return false;
  return file.home.every((index) => state.cells[index].f === fileId);
}

export function isComplete(state) {
  return state.files.every((file) => fileHome(state, file.id));
}

export function optimizedCount(state) {
  let n = 0;
  let total = 0;
  for (const file of state.files) {
    total += file.home.length;
    for (const index of file.home) if (state.cells[index].f === file.id) n += 1;
  }
  return { n, total, ratio: total ? n / total : 1 };
}

export function contiguity(state) {
  let good = 0;
  let total = 0;
  for (const file of state.files) {
    const idx = [];
    for (let i = 0; i < state.cells.length; i += 1) {
      if (state.cells[i].f === file.id) idx.push(i);
    }
    total += idx.length;
    let intact = idx.length > 0;
    for (let k = 1; k < idx.length; k += 1) {
      if (idx[k] !== idx[k - 1] + 1) intact = false;
    }
    if (intact) good += idx.length;
  }
  return total ? good / total : 1;
}

export function fragmentLabel(state, file) {
  const idx = [];
  for (let i = 0; i < state.cells.length; i += 1) {
    if (state.cells[i].f === file.id) idx.push(i);
  }
  if (fileHome(state, file.id)) return 'optimized';
  let runs = idx.length ? 1 : 0;
  for (let k = 1; k < idx.length; k += 1) {
    if (idx[k] !== idx[k - 1] + 1) runs += 1;
  }
  if (runs <= 1) return 'contiguous';
  return `${runs} fragments`;
}

function homelessIndex(state, fileId) {
  const file = fileById(state, fileId);
  if (!file) return -1;
  const home = new Set(file.home);
  for (let i = 0; i < state.cells.length; i += 1) {
    if (state.cells[i].f === fileId && !home.has(i)) return i;
  }
  return -1;
}

export function nextHint(state) {
  const homeSet = new Set();
  for (const file of state.files) for (const index of file.home) homeSet.add(index);
  for (const file of state.files) {
    for (const slot of file.home) {
      if (state.cells[slot].f === file.id) continue;
      if (state.cells[slot].t === 'free') {
        const src = homelessIndex(state, file.id);
        if (src < 0) return null;
        return { from: src, to: slot };
      }
      let outside = -1;
      let any = -1;
      for (let i = 0; i < state.cells.length; i += 1) {
        if (state.cells[i].t !== 'free') continue;
        if (any < 0) any = i;
        if (!homeSet.has(i)) {
          outside = i;
          break;
        }
      }
      const dest = outside >= 0 ? outside : any;
      if (dest < 0) return null;
      return { from: slot, to: dest };
    }
  }
  return null;
}

export function solve(state, limit = 20000) {
  const moves = [];
  for (let i = 0; i < limit; i += 1) {
    if (isComplete(state)) return moves;
    const move = nextHint(state);
    if (!move) break;
    const result = relocate(state, move.from, move.to);
    if (!result.ok) break;
    moves.push(move);
  }
  return moves;
}

export function packFile(state, fileId) {
  const file = fileById(state, fileId);
  if (!file) return 0;
  let steps = 0;
  const cap = file.size * 4 + 8;
  while (steps < cap && !fileHome(state, fileId)) {
    const homeSet = new Set(file.home);
    let acted = false;
    for (const slot of file.home) {
      if (state.cells[slot].f === fileId) continue;
      if (state.cells[slot].t === 'free') {
        const src = homelessIndex(state, fileId);
        if (src < 0) return steps;
        if (!relocate(state, src, slot).ok) return steps;
        steps += 1;
        acted = true;
        break;
      }
      let dest = -1;
      for (let i = 0; i < state.cells.length; i += 1) {
        if (state.cells[i].t === 'free' && !homeSet.has(i)) {
          dest = i;
          break;
        }
      }
      if (dest < 0) return steps;
      if (!relocate(state, slot, dest).ok) return steps;
      steps += 1;
      acted = true;
      break;
    }
    if (!acted) break;
  }
  return steps;
}

export function firstIncomplete(state) {
  return state.files.find((file) => !fileHome(state, file.id)) || null;
}

export function scatterDownTo(state, ratio, rng) {
  const { total } = optimizedCount(state);
  const target = Math.round(total * ratio);
  let guard = 0;
  while (optimizedCount(state).n > target && guard < 10000) {
    guard += 1;
    const homes = [];
    for (const file of state.files) {
      for (const index of file.home) {
        if (state.cells[index].f === file.id) homes.push(index);
      }
    }
    const free = [];
    for (let i = 0; i < state.cells.length; i += 1) {
      if (state.cells[i].t === 'free') free.push(i);
    }
    if (!homes.length || !free.length) break;
    const src = homes[Math.floor(rng() * homes.length)];
    const dest = free[Math.floor(rng() * free.length)];
    relocate(state, src, dest);
  }
  return optimizedCount(state);
}

export function quickFormat(state, fileId, rng) {
  const file = fileById(state, fileId) || firstIncomplete(state);
  if (!file) return { ok: true, message: 'Nothing left to format.' };
  if (rng() < 0.55) {
    packFile(state, file.id);
    return { ok: true, file, message: `${file.name} snapped into place. The scorekeeper noticed.` };
  }
  const locs = [];
  for (let i = 0; i < state.cells.length; i += 1) if (state.cells[i].f === file.id) locs.push(i);
  const free = [];
  for (let i = 0; i < state.cells.length; i += 1) if (state.cells[i].t === 'free') free.push(i);
  for (const loc of locs) {
    if (!free.length || rng() < 0.35) continue;
    const j = Math.floor(rng() * free.length);
    const dest = free[j];
    state.cells[dest] = { t: 'file', f: file.id };
    state.cells[loc] = blankCell();
    free[j] = loc;
  }
  const homes = new Set(state.files.flatMap((item) => item.home));
  const candidates = [];
  for (let i = 0; i < state.cells.length; i += 1) {
    if (state.cells[i].t === 'free' && !homes.has(i)) candidates.push(i);
  }
  if (candidates.length) {
    const idx = candidates[Math.floor(rng() * candidates.length)];
    state.cells[idx] = { t: 'bad', f: null };
  }
  return { ok: false, file, message: 'Quick format hiccuped. A sector went bad and a file came apart.' };
}

export function clearOneBad(state) {
  const index = state.cells.findIndex((cell) => cell.t === 'bad');
  if (index < 0) return false;
  state.cells[index] = blankCell();
  return true;
}

export function addBad(state, rng) {
  const homes = new Set(state.files.flatMap((file) => file.home));
  const candidates = [];
  for (let i = 0; i < state.cells.length; i += 1) {
    if (state.cells[i].t === 'free' && !homes.has(i)) candidates.push(i);
  }
  if (!candidates.length) return false;
  const idx = candidates[Math.floor(rng() * candidates.length)];
  state.cells[idx] = { t: 'bad', f: null };
  return true;
}

export function computeScore({ seek, elapsedMs, contig, combos, blocks }) {
  const base = Math.round(contig * 10000);
  const combo = combos * 750;
  const bulk = blocks * 15;
  const seekPenalty = seek * 3;
  const timePenalty = Math.round(elapsedMs / 120);
  return Math.max(0, base + combo + bulk - seekPenalty - timePenalty);
}

export function starCount({ complete, seek, elapsedMs, par }) {
  if (!complete) return 0;
  let stars = 1;
  if (seek <= par.seek) stars = 2;
  if (seek <= par.seek && elapsedMs <= par.ms) stars = 3;
  return stars;
}

export function formatClock(ms) {
  const seconds = Math.max(0, Math.round(ms / 1000));
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return `${minutes}:${String(rest).padStart(2, '0')}`;
}

export function formatResult(sizeLabel, elapsedMs, ratio) {
  const pct = Math.round(ratio * 100);
  return `Defragged ${sizeLabel} in ${formatClock(elapsedMs)}, ${pct}% contiguous`;
}

export function cellColor(state, index, fx, now) {
  const flash = fx?.find((item) => item.index === index && item.until > now);
  if (flash?.kind === 'read') return COLORS.reading;
  if (flash?.kind === 'write') return COLORS.writing;
  const cell = state.cells[index];
  if (!cell || cell.t === 'free') return COLORS.free;
  if (cell.t === 'fixed') return COLORS.unmovable;
  if (cell.t === 'bad') return COLORS.bad;
  const file = fileById(state, cell.f);
  if (file && file.home.includes(index) && cell.f === file.id) return COLORS.optimized;
  return file?.color || COLORS.fragmented;
}
