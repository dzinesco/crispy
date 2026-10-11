function tile(size, draw) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const g = canvas.getContext('2d');
  draw(g, size);
  return canvas.toDataURL();
}

function pixels(g, size, fn) {
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      g.fillStyle = fn(x, y);
      g.fillRect(x, y, 1, 1);
    }
  }
}

export const DESK_PATTERNS = [
  {
    id: 'harbor',
    name: 'Harbor',
    url: tile(16, (g) => pixels(g, 16, (x, y) => {
      const twill = ((x + y * 2) & 3) === 0;
      const spark = ((x * 3 + y * 5) & 7) === 0;
      if (spark) return '#93b4bc';
      return twill ? '#4c6e79' : '#6a909b';
    })),
  },
  {
    id: 'slate',
    name: 'Slate',
    url: tile(8, (g) => pixels(g, 8, (x, y) => ((x + y) & 1) ? '#7d8b96' : '#6a7782')),
  },
  {
    id: 'ink',
    name: 'Ink',
    url: tile(16, (g) => pixels(g, 16, (x, y) => {
      const n = (x * 13 + y * 7) % 11;
      if (n === 0) return '#3a4550';
      return '#2c3640';
    })),
  },
  {
    id: 'linen',
    name: 'Linen',
    url: tile(8, (g) => pixels(g, 8, (x, y) => (y % 4 === 0 || x % 4 === 0) ? '#c5c8cc' : '#b7bcc2')),
  },
  {
    id: 'meadow',
    name: 'Meadow',
    url: tile(16, (g) => pixels(g, 16, (x, y) => {
      const check = ((x >> 2) + (y >> 2)) & 1;
      return check ? '#6e8f78' : '#7fa188';
    })),
  },
  {
    id: 'brick',
    name: 'Brick',
    url: tile(16, (g) => {
      g.fillStyle = '#8d6a62';
      g.fillRect(0, 0, 16, 16);
      g.fillStyle = '#6f514c';
      for (let y = 0; y < 16; y += 4) g.fillRect(0, y, 16, 1);
      for (let y = 0; y < 16; y += 8) {
        for (let x = 0; x < 16; x += 8) g.fillRect(x + ((y / 4) % 2 ? 4 : 0), y, 1, 4);
      }
    }),
  },
  {
    id: 'graphite',
    name: 'Graphite',
    url: tile(2, (g) => {
      g.fillStyle = '#9aa0a6';
      g.fillRect(0, 0, 2, 2);
      g.fillStyle = '#8b9198';
      g.fillRect(0, 0, 1, 1);
      g.fillRect(1, 1, 1, 1);
    }),
  },
  {
    id: 'signal',
    name: 'Signal',
    url: tile(16, (g) => pixels(g, 16, (x, y) => {
      if (y % 8 === 0) return '#5c6570';
      return (x + y) % 5 === 0 ? '#8a6270' : '#6e7884';
    })),
  },
];

export function patternById(id) {
  return DESK_PATTERNS.find((item) => item.id === id) || DESK_PATTERNS[0];
}

export const PAINT_PATTERNS = [
  ['11111111', '11111111', '11111111', '11111111', '11111111', '11111111', '11111111', '11111111'],
  ['00000000', '00000000', '00000000', '00000000', '00000000', '00000000', '00000000', '00000000'],
  ['10101010', '01010101', '10101010', '01010101', '10101010', '01010101', '10101010', '01010101'],
  ['11001100', '11001100', '00110011', '00110011', '11001100', '11001100', '00110011', '00110011'],
  ['11110000', '11110000', '11110000', '11110000', '00001111', '00001111', '00001111', '00001111'],
  ['10001000', '00000000', '00100010', '00000000', '10001000', '00000000', '00100010', '00000000'],
  ['11111111', '10000001', '10000001', '10000001', '11111111', '00001000', '00001000', '00001000'],
  ['01111110', '10000001', '10000001', '10011001', '10011001', '10000001', '10000001', '01111110'],
  ['01000100', '00101000', '00010000', '00101000', '01000100', '10000010', '01000100', '00111000'],
  ['11101110', '11011101', '10111011', '01110111', '11101110', '11011101', '10111011', '01110111'],
  ['10000000', '01000000', '00100000', '00010000', '00001000', '00000100', '00000010', '00000001'],
  ['11111111', '11111111', '00000000', '00000000', '11111111', '11111111', '00000000', '00000000'],
];

export function patternCanvas(bits) {
  const canvas = document.createElement('canvas');
  canvas.width = 8;
  canvas.height = 8;
  const g = canvas.getContext('2d');
  for (let y = 0; y < 8; y += 1) {
    for (let x = 0; x < 8; x += 1) {
      g.fillStyle = bits[y][x] === '1' ? '#111' : '#fff';
      g.fillRect(x, y, 1, 1);
    }
  }
  return canvas;
}

export function patternStyle(bits) {
  const rows = bits.map((row) => row.replace(/0/g, '░░').replace(/1/g, '██')).join('');
  return rows;
}
