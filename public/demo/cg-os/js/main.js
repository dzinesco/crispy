/* ============================================================
   main.js — entrypoint. Boots, then mounts desktop.
   ============================================================ */

(function () {
  "use strict";

  document.addEventListener("DOMContentLoaded", () => {
    // initialise subsystems that don't depend on the desktop
    window.FS.init();

    const desktopEl = document.getElementById("desktop");
    const bootEl = document.getElementById("boot");

    // boot
    window.Boot.startBoot(() => {
      desktopEl.hidden = false;
      bootEl.hidden = true;
      window.Desktop.init();
      restoreWindows();
    });

    // expose "Reset everything" helper for the about dialog
    window.ResetOS = () => {
      if (!confirm("Reset Crispy Goat OS? All saved windows, files, and settings will be erased.")) return;
      localStorage.clear();
      location.reload();
    };
  });

  // Re-open windows from previous session
  function restoreWindows() {
    const state = window.Persistence.loadDesktop();
    if (!state.windows || state.windows.length === 0) return;
    state.windows.forEach((w) => {
      const app = window.Apps.get(w.app);
      if (!app) return;
      try {
        const win = window.Apps.launch(w.app, {
          x: w.x, y: w.y, width: w.w, height: w.h,
          state: w.state || {},
          restoreOnly: true,
        });
        if (win && w.maximized) {
          // schedule maximize after createWindow returns
          setTimeout(() => window.WM.toggleMaximize(win.id), 0);
        }
      } catch (e) { console.warn("Failed to restore", w.app, e); }
    });
  }

  // Save open windows when closing/refresh
  window.addEventListener("beforeunload", () => {
    const wins = window.WM.listWindows().map((w) => ({
      id: w.id,
      app: w.app || guessAppFromId(w.id),
      x: w.bounds.x, y: w.bounds.y,
      w: w.bounds.w, h: w.bounds.h,
      maximized: w.maximized,
      state: w.appState || {},
    }));
    const cur = window.Persistence.loadDesktop();
    cur.windows = wins;
    window.Persistence.saveDesktop(cur);
  });

  function guessAppFromId(id) {
    // Best-effort: not strictly required, but keeps windows.json sane
    if (id.startsWith("notepad")) return "notepad";
    if (id.startsWith("paint")) return "paint";
    if (id.startsWith("explorer")) return "explorer";
    if (id.startsWith("calc")) return "calculator";
    if (id.startsWith("minesweeper")) return "minesweeper";
    if (id.startsWith("solitaire")) return "solitaire";
    if (id.startsWith("winamp")) return "winamp";
    if (id.startsWith("doom")) return "doom";
    if (id.startsWith("ipod")) return "ipod";
    if (id.startsWith("lotus")) return "lotus";
    return null;
  }
})();