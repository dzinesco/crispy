/* ============================================================
   Apps registry — every app exposes:
     id, name, icon, category, launch(opts)
   The desktop, start menu, and persistence all go through this.
   ============================================================ */

(function () {
  "use strict";

  const apps = [];

  function register(app) {
    if (apps.find((a) => a.id === app.id)) return apps.find((a) => a.id === app.id);
    apps.push(app);
    return app;
  }

  function get(id) { return apps.find((a) => a.id === id); }
  function list() { return apps.slice(); }
  function listByCategory(cat) { return apps.filter((a) => a.category === cat); }

  function launch(id, opts = {}) {
    const app = get(id);
    if (!app) {
      console.warn("Unknown app:", id);
      return null;
    }
    return app.launch(opts);
  }

  // Register all built-in apps
  if (window.NotepadApp)     register(window.NotepadApp);
  if (window.CalculatorApp)   register(window.CalculatorApp);
  if (window.PaintApp)        register(window.PaintApp);
  if (window.MinesweeperApp)  register(window.MinesweeperApp);
  if (window.SolitaireApp)    register(window.SolitaireApp);
  if (window.WinampApp)       register(window.WinampApp);
  if (window.ExplorerApp)     register(window.ExplorerApp);
  if (window.DoomStubApp)     register(window.DoomStubApp);
  if (window.IPodStubApp)     register(window.IPodStubApp);
  if (window.LotusStubApp)    register(window.LotusStubApp);
  if (window.AboutApp)        register(window.AboutApp);
  if (window.WordApp)         register(window.WordApp);
  if (window.ExcelApp)        register(window.ExcelApp);
  if (window.PowerPointApp)   register(window.PowerPointApp);
  if (window.OutlookApp)      register(window.OutlookApp);

  window.Apps = { register, get, list, listByCategory, launch };
})();