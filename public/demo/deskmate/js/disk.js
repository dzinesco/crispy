const KEY = 'crispy.deskmate.v1';

const README = [
  'CRISPYGOAT DESKMATE',
  '-------------------',
  'Arrow keys move. Enter opens.',
  'The bar at the bottom is the menu.',
  'F1 is help. F1 again is more help.',
  'Alt+1 through Alt+0 match F1 through F10.',
  '',
  'This file lives on the disk in your browser.',
  'Sixteen colors. No overlapping windows.',
].join('\n');

function fresh() {
  return {
    v: 1,
    seen: false,
    scanlines: false,
    files: {
      'README.TXT': { kind: 'text', text: README, modified: 0 },
      'BUDGET.WKS': {
        kind: 'sheet',
        cells: {
          A1: 'Rent',
          B1: '800',
          A2: 'Feed',
          B2: '40',
          A3: 'Total',
          B3: '=SUM(B1:B2)',
        },
        modified: 0,
      },
    },
  };
}

export function loadDisk() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return fresh();
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return fresh();
    return {
      v: 1,
      seen: Boolean(parsed.seen),
      scanlines: Boolean(parsed.scanlines),
      files: parsed.files && typeof parsed.files === 'object' ? parsed.files : fresh().files,
    };
  } catch {
    return fresh();
  }
}

export function saveDisk(disk) {
  try {
    localStorage.setItem(KEY, JSON.stringify(disk));
    return true;
  } catch {
    return false;
  }
}
