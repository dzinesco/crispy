/* ============================================================
   Icons — inline SVGs in classic Win98-ish glyph style.
   No copyrighted assets. All hand-drawn shapes.
   ============================================================ */

(function () {
  "use strict";

  const ICONS = {
    app: `
      <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
        <rect x="2" y="3" width="12" height="10" fill="#c0c0c0" stroke="#000"/>
        <rect x="3" y="4" width="10" height="2" fill="#000080"/>
        <rect x="4" y="8" width="8" height="1" fill="#000"/>
        <rect x="4" y="10" width="6" height="1" fill="#000"/>
      </svg>`,
    notepad: `
      <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
        <rect x="3" y="2" width="10" height="12" fill="#fff" stroke="#000"/>
        <rect x="3" y="2" width="10" height="2" fill="#c0c0c0" stroke="#000"/>
        <line x1="5" y1="6" x2="11" y2="6" stroke="#000"/>
        <line x1="5" y1="8" x2="11" y2="8" stroke="#000"/>
        <line x1="5" y1="10" x2="11" y2="10" stroke="#000"/>
        <line x1="5" y1="12" x2="9" y2="12" stroke="#000"/>
      </svg>`,
    calc: `
      <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
        <rect x="3" y="2" width="10" height="12" fill="#c0c0c0" stroke="#000"/>
        <rect x="4" y="3" width="8" height="2" fill="#a0a0a0" stroke="#000"/>
        <rect x="4" y="6" width="1.5" height="1.5" fill="#000"/>
        <rect x="6.25" y="6" width="1.5" height="1.5" fill="#000"/>
        <rect x="8.5" y="6" width="1.5" height="1.5" fill="#000"/>
        <rect x="4" y="8.5" width="1.5" height="1.5" fill="#000"/>
        <rect x="6.25" y="8.5" width="1.5" height="1.5" fill="#000"/>
        <rect x="8.5" y="8.5" width="1.5" height="1.5" fill="#000"/>
        <rect x="4" y="11" width="1.5" height="1.5" fill="#000"/>
        <rect x="6.25" y="11" width="1.5" height="1.5" fill="#000"/>
        <rect x="8.5" y="11" width="1.5" height="1.5" fill="#ff0000"/>
      </svg>`,
    paint: `
      <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
        <rect x="2" y="3" width="9" height="9" fill="#fff" stroke="#000"/>
        <circle cx="4" cy="6" r="1" fill="#ff0000"/>
        <circle cx="7" cy="9" r="1.5" fill="#0000ff"/>
        <circle cx="10" cy="5" r="1" fill="#ffff00"/>
        <rect x="6" y="11" width="2" height="3" fill="#a06030"/>
        <rect x="8" y="10" width="2" height="4" fill="#a06030" transform="rotate(20 9 12)"/>
      </svg>`,
    mine: `
      <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
        <rect x="2" y="2" width="12" height="12" fill="#c0c0c0" stroke="#000"/>
        <circle cx="6" cy="6" r="1" fill="#000"/>
        <circle cx="10" cy="6" r="1" fill="#000"/>
        <circle cx="8" cy="9" r="1" fill="#000"/>
        <circle cx="6" cy="11" r="1" fill="#000"/>
        <circle cx="10" cy="11" r="1" fill="#000"/>
        <path d="M8 4 L8 0 M9 0 L8 0" stroke="#ff0000" stroke-width="0.8" fill="none"/>
      </svg>`,
    cards: `
      <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
        <rect x="2" y="3" width="6" height="9" fill="#fff" stroke="#000" transform="rotate(-12 5 7)"/>
        <rect x="5" y="4" width="6" height="9" fill="#fff" stroke="#000"/>
        <rect x="8" y="3" width="6" height="9" fill="#fff" stroke="#000" stroke="#ff0000" transform="rotate(12 11 7)"/>
        <text x="7" y="11" font-size="5" fill="#000">♠</text>
        <text x="10" y="11" font-size="5" fill="#ff0000">♥</text>
      </svg>`,
    winamp: `
      <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
        <rect x="1" y="4" width="14" height="8" fill="#2a2a2a" stroke="#000"/>
        <rect x="2" y="5" width="3" height="2" fill="#ff0000"/>
        <rect x="2" y="8" width="3" height="2" fill="#ffff00"/>
        <rect x="6" y="5" width="2" height="6" fill="#00ff00"/>
        <rect x="9" y="5" width="1.5" height="6" fill="#00ffff"/>
        <rect x="11" y="5" width="3" height="6" fill="#ff00ff"/>
      </svg>`,
    folder: `
      <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
        <path d="M1 5 L1 13 L15 13 L15 6 L8 6 L7 5 Z" fill="#ffff00" stroke="#000"/>
        <path d="M1 5 L1 4 L7 4 L8 5 Z" fill="#ffff80" stroke="#000"/>
      </svg>`,
    folderOpen: `
      <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
        <path d="M1 5 L1 13 L15 13 L13 6 L8 6 L7 5 Z" fill="#ffff00" stroke="#000"/>
      </svg>`,
    file: `
      <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
        <path d="M3 2 L10 2 L13 5 L13 14 L3 14 Z" fill="#fff" stroke="#000"/>
        <path d="M10 2 L10 5 L13 5" fill="#c0c0c0" stroke="#000"/>
      </svg>`,
    text: `
      <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
        <path d="M3 2 L10 2 L13 5 L13 14 L3 14 Z" fill="#fff" stroke="#000"/>
        <line x1="5" y1="6" x2="11" y2="6" stroke="#000080"/>
        <line x1="5" y1="8" x2="11" y2="8" stroke="#000080"/>
        <line x1="5" y1="10" x2="11" y2="10" stroke="#000080"/>
        <line x1="5" y1="12" x2="9" y2="12" stroke="#000080"/>
      </svg>`,
    image: `
      <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
        <rect x="2" y="3" width="12" height="10" fill="#fff" stroke="#000"/>
        <circle cx="6" cy="7" r="1.5" fill="#ffff00" stroke="#000"/>
        <path d="M2 13 L6 9 L9 11 L13 7 L13 13 Z" fill="#00a040"/>
      </svg>`,
    audio: `
      <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
        <path d="M3 2 L10 2 L13 5 L13 14 L3 14 Z" fill="#fff" stroke="#000"/>
        <circle cx="6" cy="9" r="1.5" fill="#000"/>
        <circle cx="6" cy="9" r="0.6" fill="#fff"/>
        <path d="M7 9 L11 6 L11 12 Z" fill="#000"/>
      </svg>`,
    explorer: `
      <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
        <rect x="2" y="2" width="12" height="12" fill="#c0c0c0" stroke="#000"/>
        <rect x="3" y="3" width="10" height="2" fill="#000080"/>
        <rect x="3" y="6" width="10" height="7" fill="#fff" stroke="#808080"/>
        <rect x="4" y="7" width="2" height="2" fill="#ffff00" stroke="#000"/>
        <rect x="6" y="7" width="2" height="2" fill="#ffff00" stroke="#000"/>
        <rect x="8" y="7" width="2" height="2" fill="#ffff00" stroke="#000"/>
        <rect x="10" y="7" width="2" height="2" fill="#ffff00" stroke="#000"/>
      </svg>`,
    computer: `
      <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
        <rect x="2" y="3" width="12" height="9" fill="#c0c0c0" stroke="#000"/>
        <rect x="3" y="4" width="10" height="7" fill="#008080"/>
        <rect x="2" y="12" width="12" height="2" fill="#c0c0c0" stroke="#000"/>
        <rect x="4" y="13" width="8" height="1" fill="#808080"/>
      </svg>`,
    recyle: `
      <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
        <path d="M5 4 L5 13 L11 13 L11 4 Z" fill="#c0c0c0" stroke="#000"/>
        <line x1="6" y1="6" x2="6" y2="12" stroke="#000"/>
        <line x1="8" y1="6" x2="8" y2="12" stroke="#000"/>
        <line x1="10" y1="6" x2="10" y2="12" stroke="#000"/>
        <path d="M4 4 L12 4" stroke="#000" stroke-width="1.2"/>
      </svg>`,
    doom: `
      <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
        <rect x="2" y="3" width="12" height="9" fill="#1a1a1a" stroke="#000"/>
        <rect x="3" y="4" width="10" height="7" fill="#400"/>
        <path d="M3 4 L7 7 L3 10 Z" fill="#c44a2a"/>
        <path d="M13 4 L9 7 L13 10 Z" fill="#a73a20"/>
        <rect x="6" y="9" width="4" height="2" fill="#000"/>
      </svg>`,
    ipod: `
      <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
        <rect x="2" y="2" width="12" height="12" fill="#f5f5f5" stroke="#000" rx="2"/>
        <rect x="3" y="3" width="10" height="5" fill="#88aacc" stroke="#000"/>
        <circle cx="8" cy="11" r="2" fill="#e0e0e0" stroke="#000"/>
      </svg>`,
    lotus: `
      <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
        <rect x="2" y="2" width="12" height="10" fill="#000" stroke="#000"/>
        <rect x="2" y="2" width="12" height="10" fill="none" stroke="#ffb000"/>
        <rect x="3" y="3" width="2" height="7" fill="#ffb000"/>
        <rect x="6" y="3" width="2" height="3" fill="#ffb000"/>
        <rect x="6" y="7" width="2" height="3" fill="#ffb000"/>
        <rect x="9" y="3" width="2" height="5" fill="#ffb000"/>
        <rect x="12" y="3" width="1" height="7" fill="#ffb000"/>
      </svg>`,
    about: `
      <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
        <circle cx="8" cy="8" r="6" fill="#000080" stroke="#000"/>
        <text x="8" y="11" font-size="8" font-family="serif" fill="#fff" text-anchor="middle">i</text>
      </svg>`,
    shutdown: `
      <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
        <circle cx="8" cy="8" r="6" fill="none" stroke="#ff0000" stroke-width="1.4"/>
        <line x1="8" y1="8" x2="8" y2="3" stroke="#ff0000" stroke-width="1.4"/>
      </svg>`,
    settings: `
      <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
        <circle cx="8" cy="8" r="3" fill="none" stroke="#000" stroke-width="1.2"/>
        <g stroke="#000" stroke-width="1.2">
          <line x1="8" y1="1" x2="8" y2="3"/>
          <line x1="8" y1="13" x2="8" y2="15"/>
          <line x1="1" y1="8" x2="3" y2="8"/>
          <line x1="13" y1="8" x2="15" y2="8"/>
          <line x1="3" y1="3" x2="4.5" y2="4.5"/>
          <line x1="11.5" y1="11.5" x2="13" y2="13"/>
          <line x1="3" y1="13" x2="4.5" y2="11.5"/>
          <line x1="11.5" y1="4.5" x2="13" y2="3"/>
        </g>
      </svg>`,
  };

  const OFFICE = {
    word: `
      <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
        <rect x="2" y="2" width="12" height="12" fill="#1a4f8b" stroke="#000"/>
        <text x="8" y="11" font-size="7" font-family="serif" font-weight="700" fill="#fff" text-anchor="middle">W</text>
      </svg>`,
    excel: `
      <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
        <rect x="2" y="2" width="12" height="12" fill="#1d6f42" stroke="#000"/>
        <text x="8" y="11" font-size="7" font-family="serif" font-weight="700" fill="#fff" text-anchor="middle">X</text>
      </svg>`,
    powerpoint: `
      <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
        <rect x="2" y="2" width="12" height="12" fill="#c43c3c" stroke="#000"/>
        <text x="8" y="11" font-size="7" font-family="serif" font-weight="700" fill="#fff" text-anchor="middle">P</text>
      </svg>`,
    outlook: `
      <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
        <rect x="2" y="2" width="12" height="12" fill="#0c5cab" stroke="#000"/>
        <text x="8" y="11" font-size="7" font-family="serif" font-weight="700" fill="#fff" text-anchor="middle">O</text>
      </svg>`,
    doc: `
      <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
        <path d="M3 2 L10 2 L13 5 L13 14 L3 14 Z" fill="#fff" stroke="#000"/>
        <path d="M10 2 L10 5 L13 5" fill="#c0c0c0" stroke="#000"/>
        <text x="8" y="12" font-size="5" font-family="serif" font-weight="700" fill="#1a4f8b" text-anchor="middle">W</text>
      </svg>`,
    xls: `
      <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
        <path d="M3 2 L10 2 L13 5 L13 14 L3 14 Z" fill="#fff" stroke="#000"/>
        <path d="M10 2 L10 5 L13 5" fill="#c0c0c0" stroke="#000"/>
        <text x="8" y="12" font-size="5" font-family="serif" font-weight="700" fill="#1d6f42" text-anchor="middle">X</text>
      </svg>`,
    ppt: `
      <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
        <path d="M3 2 L10 2 L13 5 L13 14 L3 14 Z" fill="#fff" stroke="#000"/>
        <path d="M10 2 L10 5 L13 5" fill="#c0c0c0" stroke="#000"/>
        <text x="8" y="12" font-size="5" font-family="serif" font-weight="700" fill="#c43c3c" text-anchor="middle">P</text>
      </svg>`,
    mail: `
      <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
        <rect x="1" y="3" width="14" height="10" fill="#fff" stroke="#000"/>
        <path d="M1 3 L8 9 L15 3" fill="none" stroke="#000"/>
      </svg>`,
    mailnew: `
      <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
        <rect x="1" y="3" width="14" height="10" fill="#fff" stroke="#000"/>
        <path d="M1 3 L8 9 L15 3" fill="none" stroke="#000"/>
        <rect x="9" y="1" width="6" height="3" fill="#ffff00" stroke="#000"/>
        <text x="12" y="3.2" font-size="2" font-family="sans-serif" font-weight="700" fill="#000" text-anchor="middle">NEW</text>
      </svg>`,
    bin: `
      <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
        <rect x="2" y="2" width="12" height="2" fill="#c0c0c0" stroke="#000"/>
        <rect x="2" y="4" width="12" height="10" fill="#c0c0c0" stroke="#000"/>
        <line x1="5" y1="6" x2="5" y2="13" stroke="#000"/>
        <line x1="8" y1="6" x2="8" y2="13" stroke="#000"/>
        <line x1="11" y1="6" x2="11" y2="13" stroke="#000"/>
      </svg>`,
  };

  Object.assign(ICONS, OFFICE);

  window.Icons = {
    get(name) { return ICONS[name] || ICONS.app; },
    all() { return ICONS; },
  };
})();