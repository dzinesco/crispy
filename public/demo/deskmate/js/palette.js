// IBM CGA / Tandy 16-color palette. Original values, no vendor assets.
export const CGA = [
  '#000000', '#0000aa', '#00aa00', '#00aaaa',
  '#aa0000', '#aa00aa', '#aa5500', '#aaaaaa',
  '#555555', '#5555ff', '#55ff55', '#55ffff',
  '#ff5555', '#ff55ff', '#ffff55', '#ffffff',
];

export const CGA_NAMES = [
  'Black', 'Blue', 'Green', 'Cyan',
  'Red', 'Magenta', 'Brown', 'LtGray',
  'DkGray', 'LtBlue', 'LtGreen', 'LtCyan',
  'LtRed', 'LtMag', 'Yellow', 'White',
];

export const CGA_RGB = CGA.map((hex) => [
  Number.parseInt(hex.slice(1, 3), 16),
  Number.parseInt(hex.slice(3, 5), 16),
  Number.parseInt(hex.slice(5, 7), 16),
]);
