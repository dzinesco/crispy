const WRAP = (body) => `<svg class="ico" viewBox="0 0 32 32" width="32" height="32" aria-hidden="true">${body}</svg>`;

const folder = (badge) => `
  <path d="M3 11h9l2 2h15v13H3V11z" fill="#d5dde3" stroke="#161616"/>
  <path d="M3 15h26" stroke="#161616" stroke-opacity=".35"/>
  <path d="M3 11h9l2 2h15" fill="none" stroke="#161616"/>
  ${badge || ''}
`;

const page = (extra = '') => `
  <path d="M8 3h11l6 6v20H8V3z" fill="#fff" stroke="#161616"/>
  <path d="M19 3v6h6" fill="#eee" stroke="#161616"/>
  ${extra}
`;

const ICONS = {
  hd: `
    <rect x="6" y="7" width="20" height="16" rx="1.5" fill="#e6e6e6" stroke="#161616"/>
    <rect x="8" y="9" width="16" height="8" fill="#9eb4bc" stroke="#161616" stroke-width=".6"/>
    <rect x="6" y="19" width="20" height="4" fill="#cfcfcf" stroke="#161616"/>
    <circle cx="22" cy="21" r="1.1" fill="#1f7a38"/>
    <rect x="9" y="24" width="14" height="2" fill="#8d8d8d"/>
    <rect x="12" y="26" width="8" height="2" fill="#6e6e6e"/>
  `,
  trash: `
    <path d="M11 8h10l-1 2H12L11 8z" fill="#eee" stroke="#161616"/>
    <path d="M7 10h18" stroke="#161616" stroke-width="1.4"/>
    <path d="M9 11l1.2 15h11.6L23 11H9z" fill="#d0d0d0" stroke="#161616"/>
    <path d="M13 14v9M16 14v9M19 14v9" stroke="#161616" stroke-width=".8"/>
  `,
  trashfull: `
    <path d="M11 8h10l-1 2H12L11 8z" fill="#eee" stroke="#161616"/>
    <path d="M7 10h18" stroke="#161616" stroke-width="1.4"/>
    <path d="M9 11l1.2 15h11.6L23 11H9z" fill="#d0d0d0" stroke="#161616"/>
    <path d="M12 16h8l-1 6H13l-1-6z" fill="#f4f4f4" stroke="#161616"/>
    <path d="M13 14v9M19 14v9" stroke="#161616" stroke-width=".8"/>
  `,
  folder: folder(),
  system: folder('<circle cx="22" cy="22" r="3.2" fill="#eceff2" stroke="#161616"/><path d="M22 19.5v5M19.5 22h5" stroke="#161616" stroke-width=".8"/>'),
  apps: folder('<rect x="18" y="18" width="3" height="3" fill="#161616"/><rect x="22" y="18" width="3" height="3" fill="#161616"/><rect x="18" y="22" width="3" height="3" fill="#161616"/><rect x="22" y="22" width="3" height="3" fill="#161616"/>'),
  file: page('<path d="M11 15h10M11 18h10M11 21h7" stroke="#161616" stroke-width=".8"/>'),
  paintfile: page('<path d="M12 20c2-4 6-4 8-1" fill="none" stroke="#161616"/><path d="M18 12l4 2-6 8-3 1 1-3z" fill="#161616"/>'),
  simpletext: page('<path d="M11 14h10M11 17h10M11 20h8M11 23h6" stroke="#161616" stroke-width=".9"/>'),
  paint: `
    <rect x="5" y="8" width="16" height="14" fill="#fff" stroke="#161616"/>
    <path d="M18 18l8-10 3 2-8 10z" fill="#333" stroke="#161616"/>
    <path d="M26 8l3 2" stroke="#161616"/>
    <rect x="7" y="23" width="18" height="3" fill="#d0d0d0" stroke="#161616"/>
  `,
  calculator: `
    <rect x="7" y="3" width="18" height="26" rx="1.5" fill="#e4e4e4" stroke="#161616"/>
    <rect x="9" y="5" width="14" height="5" fill="#d5e4e8" stroke="#161616"/>
    <g fill="#f7f7f7" stroke="#161616">
      <rect x="9" y="13" width="4" height="3"/>
      <rect x="14" y="13" width="4" height="3"/>
      <rect x="19" y="13" width="4" height="3"/>
      <rect x="9" y="17" width="4" height="3"/>
      <rect x="14" y="17" width="4" height="3"/>
      <rect x="19" y="17" width="4" height="3"/>
      <rect x="9" y="21" width="4" height="3"/>
      <rect x="14" y="21" width="4" height="3"/>
      <rect x="19" y="21" width="4" height="3"/>
    </g>
  `,
  notepad: `
    <rect x="7" y="4" width="18" height="24" fill="#fff" stroke="#161616"/>
    <path d="M7 8h18M7 12h18M7 16h18M7 20h18M7 24h18" stroke="#9ec0ea" stroke-width=".7"/>
    <path d="M11 4v4M16 4v4M21 4v4" stroke="#161616"/>
  `,
  scrapbook: `
    <path d="M6 6h9v20H6z" fill="#f4f1e6" stroke="#161616"/>
    <path d="M17 6h9v20h-9z" fill="#fff" stroke="#161616"/>
    <path d="M8 12h5M8 15h5M19 11h5M19 14h4" stroke="#161616" stroke-width=".7"/>
    <circle cx="22" cy="20" r="2" fill="#6a909b" stroke="#161616"/>
  `,
  puzzle: `
    <rect x="5" y="5" width="10" height="10" fill="#e8e8e8" stroke="#161616"/>
    <rect x="17" y="5" width="10" height="10" fill="#c9d5da" stroke="#161616"/>
    <rect x="5" y="17" width="10" height="10" fill="#b7c6cc" stroke="#161616"/>
    <rect x="17" y="17" width="10" height="10" fill="#f4f4f4" stroke="#161616"/>
    <path d="M9 11h2M21 8v2M8 21v2M22 20h2" stroke="#161616"/>
  `,
  brickout: `
    <rect x="6" y="6" width="6" height="3" fill="#161616"/>
    <rect x="13" y="6" width="6" height="3" fill="#161616"/>
    <rect x="20" y="6" width="6" height="3" fill="#161616"/>
    <rect x="6" y="10" width="6" height="3" fill="#444"/>
    <rect x="13" y="10" width="6" height="3" fill="#444"/>
    <rect x="20" y="10" width="6" height="3" fill="#444"/>
    <circle cx="16" cy="20" r="1.6" fill="#161616"/>
    <rect x="10" y="24" width="12" height="2.4" fill="#161616"/>
  `,
  controls: `
    <rect x="5" y="6" width="22" height="20" rx="1" fill="#e6e6e6" stroke="#161616"/>
    <circle cx="11" cy="12" r="2" fill="#fff" stroke="#161616"/>
    <path d="M6 12h3M13 12h8" stroke="#161616"/>
    <circle cx="18" cy="18" r="2" fill="#fff" stroke="#161616"/>
    <path d="M6 18h10M20 18h5" stroke="#161616"/>
    <circle cx="14" cy="23" r="1.6" fill="#fff" stroke="#161616"/>
  `,
  extension: `
    <rect x="6" y="8" width="14" height="16" rx="1" fill="#e8e8e8" stroke="#161616"/>
    <path d="M20 12h6v4h-6" fill="#cfd8dc" stroke="#161616"/>
    <path d="M10 12h6M10 16h6M10 20h4" stroke="#161616" stroke-width=".8"/>
  `,
  help: `
    <circle cx="16" cy="16" r="11" fill="#fff" stroke="#161616"/>
    <path d="M12 13c.4-2 2-3 4-3 2.2 0 3.6 1.2 3.6 2.8 0 2-2 2.4-3.2 3.2-.6.4-.8 1-.8 1.8" fill="none" stroke="#161616" stroke-width="1.4"/>
    <circle cx="16" cy="22" r="1" fill="#161616"/>
  `,
};

export function icon(name) {
  return WRAP(ICONS[name] || ICONS.file);
}

export function goatMark() {
  return `<span class="goat-mark" aria-hidden="true"><svg viewBox="0 0 16 16" width="16" height="16">
    <path fill="#161616" d="M4.2 7.2C4.2 4.6 5.6 3.2 7 3.6 7.3 2.2 8.7 2.2 9 3.6c1.4-.4 2.8 1 2.8 3.6.7 1 .8 2.6 0 3.8-.8 1.5-2.4 2.4-3.8 2.2-1.4.2-3-.7-3.8-2.2-.8-1.2-.7-2.8 0-3.8z"/>
    <path fill="#161616" d="M5.2 6.4 3.2 2.8l2.8 2.2zm5.6 0 2-3.6-2.8 2.2z"/>
    <circle cx="6.6" cy="8" r=".7" fill="#fff"/>
    <circle cx="9.4" cy="8" r=".7" fill="#fff"/>
  </svg></span>`;
}

export const APP_ICONS = {
  finder: 'folder',
  simpletext: 'simpletext',
  paint: 'paint',
  calculator: 'calculator',
  notepad: 'notepad',
  scrapbook: 'scrapbook',
  puzzle: 'puzzle',
  brickout: 'brickout',
  controls: 'controls',
  about: 'help',
  help: 'help',
  info: 'file',
};
