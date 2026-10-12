/* ============================================================
   Persistence — desktop state, open windows, icons, settings.
   Survives reload. Per-app state is stored under its own key.
   ============================================================ */

(function () {
  "use strict";

  const LS = {
    DESKTOP: "cg.os.desktop.v1",
    SETTINGS: "cg.os.settings.v1",
  };

  const defaultDesktop = {
    icons: [
      { id: "mycomputer", label: "My Computer", icon: "computer", x: 0, y: 0, action: "explorer" },
      { id: "explorer", label: "File Explorer", icon: "explorer", x: 0, y: 1, action: "explorer" },
      { id: "notepad", label: "Notepad", icon: "notepad", x: 0, y: 2, action: "notepad" },
      { id: "paint", label: "Paint", icon: "paint", x: 0, y: 3, action: "paint" },
      { id: "minesweeper", label: "Minesweeper", icon: "mine", x: 0, y: 4, action: "minesweeper" },
      { id: "solitaire", label: "Solitaire", icon: "cards", x: 0, y: 5, action: "solitaire" },
      { id: "winamp", label: "Winamp", icon: "winamp", x: 0, y: 6, action: "winamp" },
      { id: "calculator", label: "Calculator", icon: "calc", x: 0, y: 7, action: "calculator" },
      { id: "doom", label: "DOOM", icon: "doom", x: 0, y: 8, action: "doom" },
      { id: "ipod", label: "iPod", icon: "ipod", x: 0, y: 9, action: "ipod" },
      { id: "lotus", label: "Lotus 1-2-3", icon: "lotus", x: 0, y: 10, action: "lotus" },
      { id: "recyle", label: "Recycle Bin", icon: "recyle", x: 0, y: 11, action: "noop" },
      { id: "word", label: "Word 2000", icon: "word", x: 1, y: 0, action: "word" },
      { id: "excel", label: "Excel 2000", icon: "excel", x: 1, y: 1, action: "excel" },
      { id: "powerpoint", label: "PowerPoint 2000", icon: "powerpoint", x: 1, y: 2, action: "powerpoint" },
      { id: "outlook", label: "Outlook 2000", icon: "outlook", x: 1, y: 3, action: "outlook" },
    ],
    windows: [], // { id, app, x, y, w, h, state, maximized }
  };

  const defaultSettings = {
    skipBoot: false,
    autoLogin: false,
    sound: true,
    theme: "classic",
  };

  const persistence = {
    loadDesktop() {
      try {
        const s = localStorage.getItem(LS.DESKTOP);
        if (s) return Object.assign({}, defaultDesktop, JSON.parse(s));
      } catch {}
      return JSON.parse(JSON.stringify(defaultDesktop));
    },
    saveDesktop(state) {
      try { localStorage.setItem(LS.DESKTOP, JSON.stringify(state)); } catch {}
    },
    loadSettings() {
      try {
        const s = localStorage.getItem(LS.SETTINGS);
        if (s) return Object.assign({}, defaultSettings, JSON.parse(s));
      } catch {}
      return Object.assign({}, defaultSettings);
    },
    saveSettings(s) {
      try { localStorage.setItem(LS.SETTINGS, JSON.stringify(s)); } catch {}
    },
    defaults: { desktop: defaultDesktop, settings: defaultSettings },
  };

  window.Persistence = persistence;
})();