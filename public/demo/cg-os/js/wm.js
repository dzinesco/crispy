/* ============================================================
   Window Manager — single shared desktop, single z-order, all apps.
   Public API: window.WM
     - WM.createWindow({ id, title, icon, width, height, x, y, content,
                          resizable, maximizable, minimizable,
                          onFocus, onBlur, onClose, onResize, onMove,
                          onMinimize, onMaximize, onRestore,
                          persistKey })
     - WM.closeWindow(id)
     - WM.focusWindow(id)
     - WM.minimizeWindow(id)
     - WM.toggleMaximize(id)
     - WM.listWindows()
     - WM.getWindow(id)
     - WM.on('focus'|'blur'|'create'|'close'|'minimize'|'maximize'|'restore', cb)
     - WM.startAltTab() — begin alt-tab cycling
   ============================================================ */

(function () {
  "use strict";

  const TASKBAR_H = 28;
  const TITLE_H = 18;
  const MIN_W = 180;
  const MIN_H = 80;

  // ---------- module state ----------
  const host = () => document.getElementById("window-host");
  const taskbarButtons = () => document.getElementById("taskbar-buttons");

  /** @type {Map<string, WinInstance>} */
  const windows = new Map();
  /** @type {string[]} z-order, last entry = topmost */
  let zStack = [];
  /** @type {string|null} */
  let focusedId = null;
  /** z-index base — windows stack above this */
  const Z_BASE = 100;

  let nextZ = Z_BASE + 1;

  /** simple event emitter */
  const listeners = new Map();
  function on(ev, cb) {
    if (!listeners.has(ev)) listeners.set(ev, new Set());
    listeners.get(ev).add(cb);
    return () => listeners.get(ev).delete(cb);
  }
  function emit(ev, payload) {
    const set = listeners.get(ev);
    if (set) set.forEach((cb) => { try { cb(payload); } catch (e) { console.error(e); } });
  }

  // ---------- bounds helpers ----------
  function clampToDesktop(rect) {
    const hostEl = host();
    if (!hostEl) return rect;
    const b = hostEl.getBoundingClientRect();
    const w = Math.max(MIN_W, Math.min(rect.w, b.width));
    const h = Math.max(MIN_H, Math.min(rect.h, b.height));
    let x = rect.x;
    let y = rect.y;
    if (x < 0) x = 0;
    if (y < 0) y = 0;
    if (x + w > b.width) x = b.width - w;
    if (y + h > b.height) y = b.height - h;
    return { x, y, w, h };
  }

  // ---------- create ----------
  /**
   * @typedef {Object} WinCreateOpts
   * @property {string} id
   * @property {string} title
   * @property {string} [icon="app"]
   * @property {number} [width=400]
   * @property {number} [height=300]
   * @property {number} [x]
   * @property {number} [y]
   * @property {HTMLElement|function(HTMLElement, WinInstance):void} [content]
   * @property {boolean} [resizable=true]
   * @property {boolean} [maximizable=true]
   * @property {boolean} [minimizable=true]
   * @property {boolean} [closable=true]
   * @property {HTMLElement[]} [menubar]
   * @property {HTMLElement[]} [statusbar]
   * @property {string} [persistKey]    storage key for position/state
   * @property {function(WinInstance)} [onCreate]
   * @property {function(WinInstance)} [onFocus]
   * @property {function(WinInstance)} [onBlur]
   * @property {function(WinInstance)} [onClose]    return false to abort
   * @property {function(WinInstance)} [onMinimize]
   * @property {function(WinInstance)} [onMaximize]
   * @property {function(WinInstance)} [onRestore]
   */

  function createWindow(opts) {
    const id = opts.id || ("win_" + Math.random().toString(36).slice(2, 9));
    if (windows.has(id)) {
      const existing = windows.get(id);
      if (existing.minimized) restoreWindow(id);
      focusWindow(id);
      return existing;
    }

    const hostEl = host();
    if (!hostEl) throw new Error("WM: window-host not found");

    // bounds
    const persisted = opts.persistKey ? loadBounds(opts.persistKey) : null;
    const defW = opts.width || 420;
    const defH = opts.height || 280;
    let rect = clampToDesktop({
      x: persisted?.x ?? opts.x ?? randomOffset(),
      y: persisted?.y ?? opts.y ?? 60,
      w: persisted?.w ?? defW,
      h: persisted?.h ?? defH,
    });

    // build DOM
    const el = document.createElement("div");
    el.className = "win";
    el.dataset.windowId = id;
    el.style.left = rect.x + "px";
    el.style.top = rect.y + "px";
    el.style.width = rect.w + "px";
    el.style.height = rect.h + "px";
    el.style.zIndex = String(++nextZ);

    // titlebar
    const tb = document.createElement("div");
    tb.className = "win-titlebar";
    tb.innerHTML =
      `<span class="win-title-icon" data-role="icon">${iconHTML(opts.icon)}</span>` +
      `<span class="win-title-text">${escapeHTML(opts.title || id)}</span>` +
      `<div class="win-title-buttons">` +
        (opts.minimizable !== false ? `<button class="win-title-btn min" data-act="min" title="Minimize"></button>` : "") +
        (opts.maximizable !== false ? `<button class="win-title-btn max" data-act="max" title="Maximize"></button>` : "") +
        (opts.closable !== false ? `<button class="win-title-btn close" data-act="close" title="Close"></button>` : "") +
      `</div>`;
    el.appendChild(tb);

    // menubar
    let menubarEl = null;
    if (opts.menubar && opts.menubar.length) {
      menubarEl = document.createElement("div");
      menubarEl.className = "win-menubar";
      opts.menubar.forEach((m) => menubarEl.appendChild(m));
      el.appendChild(menubarEl);
    }

    // body
    const body = document.createElement("div");
    body.className = "win-body";
    if (opts.content instanceof HTMLElement) body.appendChild(opts.content);
    el.appendChild(body);

    // statusbar
    let statusbarEl = null;
    if (opts.statusbar && opts.statusbar.length) {
      statusbarEl = document.createElement("div");
      statusbarEl.className = "win-statusbar";
      opts.statusbar.forEach((s) => statusbarEl.appendChild(s));
      el.appendChild(statusbarEl);
    }

    // resize handle
    if (opts.resizable !== false) {
      const grip = document.createElement("div");
      grip.className = "win-resize";
      grip.dataset.role = "resize";
      el.appendChild(grip);
    }

    hostEl.appendChild(el);

    // ---------- instance ----------
    /** @typedef {Object} WinInstance */
    const win = {
      id,
      el,
      titlebar: tb,
      body,
      menubar: menubarEl,
      statusbar: statusbarEl,
      title: opts.title || id,
      icon: opts.icon,
      bounds: rect,
      savedBounds: null,    // for restore from maximize
      minimized: false,
      maximized: false,
      resizable: opts.resizable !== false,
      maximizable: opts.maximizable !== false,
      minimizable: opts.minimizable !== false,
      closable: opts.closable !== false,
      persistKey: opts.persistKey,
      onFocus: opts.onFocus,
      onBlur: opts.onBlur,
      onClose: opts.onClose,
      onMinimize: opts.onMinimize,
      onMaximize: opts.onMaximize,
      onRestore: opts.onRestore,

      setTitle(newTitle) {
        this.title = newTitle;
        const t = tb.querySelector(".win-title-text");
        if (t) t.textContent = newTitle;
        updateTaskbarButton(this);
      },
      setIcon(newIcon) {
        this.icon = newIcon;
        const i = tb.querySelector(".win-title-icon");
        if (i) i.innerHTML = iconHTML(newIcon);
        updateTaskbarButton(this);
      },
      setStatus(cellIndex, text) {
        if (!statusbarEl) return;
        const cell = statusbarEl.children[cellIndex];
        if (cell) cell.textContent = text;
      },
      persist() {
        if (!this.persistKey) return;
        saveBounds(this.persistKey, { ...this.bounds, maximized: this.maximized });
      },
    };

    windows.set(id, win);
    zStack.push(id);

    // wire events
    attachWindowEvents(win);
    addTaskbarButton(win);
    setInactive(win, false);

    emit("create", win);
    if (opts.onCreate) { try { opts.onCreate(win); } catch (e) { console.error(e); } }
    if (typeof opts.content === "function") {
      // Deferred so apps that reference their own `const win = createWindow(...)`
      // inside content() don't hit a temporal-dead-zone ReferenceError.
      queueMicrotask(() => { try { opts.content(body, win); } catch (e) { console.error(e); } });
    }
    focusWindow(id);
    return win;
  }

  function attachWindowEvents(win) {
    const { el, titlebar } = win;

    // titlebar buttons
    titlebar.addEventListener("mousedown", (e) => {
      const btn = e.target.closest("[data-act]");
      if (btn) {
        e.stopPropagation();
        const a = btn.dataset.act;
        if (a === "close") closeWindow(win.id);
        else if (a === "min") minimizeWindow(win.id);
        else if (a === "max") toggleMaximize(win.id);
        return;
      }
      focusWindow(win.id);
    });

    // double-click titlebar to maximize/restore
    titlebar.addEventListener("dblclick", (e) => {
      if (e.target.closest("[data-act]")) return;
      if (win.maximizable) toggleMaximize(win.id);
    });

    // bring focus on any click in the window
    el.addEventListener("mousedown", () => focusWindow(win.id), true);

    // drag
    titlebar.addEventListener("mousedown", (e) => beginDrag(win, e));
    titlebar.addEventListener("touchstart", (e) => beginDrag(win, e.touches[0]), { passive: false });

    // resize
    const grip = el.querySelector(".win-resize");
    if (grip) {
      grip.addEventListener("mousedown", (e) => beginResize(win, e));
      grip.addEventListener("touchstart", (e) => beginResize(win, e.touches[0]), { passive: false });
    }
  }

  // ---------- drag ----------
  function beginDrag(win, e) {
    if (e.target.closest("[data-act]")) return;
    if (e.button !== undefined && e.button !== 0) return;
    e.preventDefault();
    focusWindow(win.id);
    if (win.maximized) return; // can't drag while maximized

    const startX = e.clientX;
    const startY = e.clientY;
    const startBounds = { ...win.bounds };
    const hostEl = host();
    const hb = hostEl.getBoundingClientRect();

    win.el.classList.add("is-dragging");

    function onMove(ev) {
      const cx = ev.touches ? ev.touches[0].clientX : ev.clientX;
      const cy = ev.touches ? ev.touches[0].clientY : ev.clientY;
      const dx = cx - startX;
      const dy = cy - startY;
      let nx = startBounds.x + dx;
      let ny = startBounds.y + dy;
      // keep at least 16px of title visible at top
      if (ny < 0) ny = 0;
      if (ny > hb.height - 24) ny = hb.height - 24;
      if (nx < -win.bounds.w + 32) nx = -win.bounds.w + 32;
      if (nx > hb.width - 32) nx = hb.width - 32;
      win.el.style.left = nx + "px";
      win.el.style.top = ny + "px";
      win.bounds.x = nx;
      win.bounds.y = ny;
    }
    function onUp() {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("mouseup", onUp);
      window.removeEventListener("touchend", onUp);
      win.el.classList.remove("is-dragging");
      win.persist();
    }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("touchmove", onMove, { passive: false });
    window.addEventListener("mouseup", onUp);
    window.addEventListener("touchend", onUp);
  }

  // ---------- resize ----------
  function beginResize(win, e) {
    if (e.button !== undefined && e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    focusWindow(win.id);
    if (win.maximized) return;

    const startX = e.clientX;
    const startY = e.clientY;
    const startBounds = { ...win.bounds };
    const hostEl = host();
    const hb = hostEl.getBoundingClientRect();

    win.el.classList.add("is-resizing");

    function onMove(ev) {
      const cx = ev.touches ? ev.touches[0].clientX : ev.clientX;
      const cy = ev.touches ? ev.touches[0].clientY : ev.clientY;
      const dx = cx - startX;
      const dy = cy - startY;
      const nw = Math.max(MIN_W, Math.min(startBounds.w + dx, hb.width - startBounds.x));
      const nh = Math.max(MIN_H, Math.min(startBounds.h + dy, hb.height - startBounds.y));
      win.el.style.width = nw + "px";
      win.el.style.height = nh + "px";
      win.bounds.w = nw;
      win.bounds.h = nh;
      emit("resize", win);
    }
    function onUp() {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("mouseup", onUp);
      window.addEventListener("touchend", onUp);
      win.el.classList.remove("is-resizing");
      win.persist();
    }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("touchmove", onMove, { passive: false });
    window.addEventListener("mouseup", onUp);
    window.addEventListener("touchend", onUp);
  }

  // ---------- focus / z-order ----------
  function focusWindow(id) {
    const win = windows.get(id);
    if (!win) return;
    if (focusedId === id) return;
    if (win.minimized) {
      // restoring is the same as focusing when minimized
      restoreWindow(id);
      return;
    }
    if (focusedId && windows.has(focusedId)) {
      const prev = windows.get(focusedId);
      setInactive(prev, true);
      emit("blur", prev);
      if (prev.onBlur) { try { prev.onBlur(prev); } catch (e) {} }
    }
    focusedId = id;
    setInactive(win, false);
    bringToFront(win);
    updateTaskbarButton(win);
    emit("focus", win);
    if (win.onFocus) { try { win.onFocus(win); } catch (e) {} }
  }

  function bringToFront(win) {
    zStack = zStack.filter((id) => id !== win.id);
    zStack.push(win.id);
    win.el.style.zIndex = String(++nextZ);
  }

  function setInactive(win, inactive) {
    win.el.classList.toggle("is-inactive", inactive);
  }

  // ---------- minimize / maximize / restore ----------
  function minimizeWindow(id) {
    const win = windows.get(id);
    if (!win) return;
    if (!win.minimizable) return;
    win.minimized = true;
    win.el.classList.add("is-minimized");
    if (focusedId === id) {
      focusedId = null;
      emit("blur", win);
      if (win.onBlur) { try { win.onBlur(win); } catch (e) {} }
      // focus the next visible window
      for (let i = zStack.length - 1; i >= 0; i--) {
        const other = windows.get(zStack[i]);
        if (other && !other.minimized) { focusWindow(other.id); break; }
      }
    }
    updateTaskbarButton(win);
    emit("minimize", win);
    if (win.onMinimize) { try { win.onMinimize(win); } catch (e) {} }
    win.persist();
  }

  function restoreWindow(id) {
    const win = windows.get(id);
    if (!win) return;
    const wasMinimized = win.minimized;
    const wasMaximized = win.maximized;
    win.minimized = false;
    win.el.classList.remove("is-minimized");
    if (win.maximized) {
      // keep maximized, just un-minimize
      updateTaskbarButton(win);
      if (wasMinimized) emit("restore", win);
      if (wasMinimized && win.onRestore) { try { win.onRestore(win); } catch (e) {} }
      focusWindow(id);
      return;
    }
    updateTaskbarButton(win);
    if (wasMinimized) emit("restore", win);
    if (wasMinimized && win.onRestore) { try { win.onRestore(win); } catch (e) {} }
    focusWindow(id);
  }

  function toggleMaximize(id) {
    const win = windows.get(id);
    if (!win || !win.maximizable) return;
    if (win.maximized) {
      win.maximized = false;
      win.el.classList.remove("is-maximized");
      if (win.savedBounds) {
        const r = clampToDesktop(win.savedBounds);
        win.bounds = r;
        win.el.style.left = r.x + "px";
        win.el.style.top = r.y + "px";
        win.el.style.width = r.w + "px";
        win.el.style.height = r.h + "px";
      }
      const maxBtn = win.titlebar.querySelector("[data-act='max']");
      if (maxBtn) {
        maxBtn.classList.remove("restore");
        maxBtn.title = "Maximize";
      }
      emit("restore", win);
      if (win.onRestore) { try { win.onRestore(win); } catch (e) {} }
      emit("resize", win);
    } else {
      win.savedBounds = { ...win.bounds };
      const hostEl = host();
      const b = hostEl.getBoundingClientRect();
      win.maximized = true;
      win.bounds = { x: 0, y: 0, w: b.width, h: b.height };
      win.el.classList.add("is-maximized");
      win.el.style.left = "0px";
      win.el.style.top = "0px";
      win.el.style.width = "100%";
      win.el.style.height = "100%";
      const maxBtn = win.titlebar.querySelector("[data-act='max']");
      if (maxBtn) {
        maxBtn.classList.add("restore");
        maxBtn.title = "Restore";
      }
      emit("maximize", win);
      if (win.onMaximize) { try { win.onMaximize(win); } catch (e) {} }
      emit("resize", win);
    }
    updateTaskbarButton(win);
    win.persist();
  }

  function closeWindow(id) {
    const win = windows.get(id);
    if (!win) return;
    if (!win.closable) return;
    if (win.onClose) {
      try {
        const r = win.onClose(win);
        if (r === false) return;
      } catch (e) { console.error(e); }
    }
    // remove DOM
    win.el.remove();
    windows.delete(id);
    zStack = zStack.filter((wid) => wid !== id);
    if (focusedId === id) {
      focusedId = null;
      for (let i = zStack.length - 1; i >= 0; i--) {
        const other = windows.get(zStack[i]);
        if (other && !other.minimized) { focusWindow(other.id); break; }
      }
    }
    removeTaskbarButton(win);
    emit("close", win);
  }

  // ---------- taskbar ----------
  function addTaskbarButton(win) {
    const bar = taskbarButtons();
    if (!bar) return;
    const btn = document.createElement("button");
    btn.className = "tb-btn";
    btn.type = "button";
    btn.dataset.windowId = win.id;
    btn.innerHTML =
      `<span class="tb-icon">${iconHTML(win.icon)}</span>` +
      `<span class="tb-text">${escapeHTML(win.title)}</span>`;
    btn.addEventListener("click", () => {
      if (focusedId === win.id && !win.minimized) {
        minimizeWindow(win.id);
      } else {
        if (win.minimized) restoreWindow(win.id);
        else focusWindow(win.id);
      }
    });
    btn.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      showWindowContextMenu(win, e.clientX, e.clientY);
    });
    bar.appendChild(btn);
    updateTaskbarButton(win);
  }

  function updateTaskbarButton(win) {
    const bar = taskbarButtons();
    if (!bar) return;
    const btn = bar.querySelector(`[data-window-id="${win.id}"]`);
    if (!btn) return;
    const txt = btn.querySelector(".tb-text");
    if (txt) txt.textContent = win.title;
    const icon = btn.querySelector(".tb-icon");
    if (icon) icon.innerHTML = iconHTML(win.icon);
    btn.classList.toggle("is-active", focusedId === win.id && !win.minimized);
  }

  function removeTaskbarButton(win) {
    const bar = taskbarButtons();
    if (!bar) return;
    const btn = bar.querySelector(`[data-window-id="${win.id}"]`);
    if (btn) btn.remove();
  }

  function showWindowContextMenu(win, x, y) {
    const items = [
      win.minimizable ? { label: "Minimize", act: () => minimizeWindow(win.id) } : null,
      win.maximizable ? { label: win.maximized ? "Restore" : "Maximize", act: () => toggleMaximize(win.id) } : null,
      { label: "Close", act: () => closeWindow(win.id) },
    ].filter(Boolean);
    showContextMenu(x, y, items);
  }

  // ---------- alt-tab ----------
  let altTabIdx = -1;
  let altTabPrevFocus = null;
  let altTabOverlay = null;

  function startAltTab() {
    if (zStack.length === 0) return;
    altTabPrevFocus = focusedId;
    altTabIdx = 0;
    cycleAltTab();
  }
  function cycleAltTab() {
    const order = zStack.slice().reverse(); // topmost first
    const win = windows.get(order[altTabIdx % order.length]);
    if (!win) return;
    focusWindow(win.id);
    flashTaskbar(win);
    showAltTabOverlay(win);
  }
  function endAltTab() {
    altTabIdx = -1;
    altTabPrevFocus = null;
    if (altTabOverlay) { altTabOverlay.remove(); altTabOverlay = null; }
  }
  function flashTaskbar(win) {
    const bar = taskbarButtons();
    const btn = bar?.querySelector(`[data-window-id="${win.id}"]`);
    if (!btn) return;
    btn.classList.add("is-flashing");
    setTimeout(() => btn.classList.remove("is-flashing"), 400);
  }
  function showAltTabOverlay(win) {
    if (altTabOverlay) altTabOverlay.remove();
    altTabOverlay = document.createElement("div");
    altTabOverlay.className = "alt-tab-overlay";
    Object.assign(altTabOverlay.style, {
      position: "fixed",
      left: "50%",
      top: "50%",
      transform: "translate(-50%, -50%)",
      background: "rgba(0,0,32,0.85)",
      color: "#fff",
      padding: "16px 24px",
      border: "2px solid var(--c-light)",
      boxShadow: "2px 2px 0 rgba(0,0,0,0.6)",
      fontFamily: "Tahoma, sans-serif",
      fontSize: "12px",
      display: "flex",
      alignItems: "center",
      gap: "10px",
      zIndex: 99999,
      pointerEvents: "none",
    });
    altTabOverlay.innerHTML =
      `<span style="font-size:24px;">${iconHTML(win.icon)}</span>` +
      `<div><div style="font-weight:700;">${escapeHTML(win.title)}</div>` +
      `<div style="opacity:.7;font-size:11px;">Hold Alt and press Tab to cycle</div></div>`;
    document.body.appendChild(altTabOverlay);
  }

  // ---------- helpers ----------
  function iconHTML(name) {
    if (window.Icons && typeof window.Icons.get === "function") {
      return window.Icons.get(name) || window.Icons.get("app");
    }
    return `<span style="font-size:14px;">▣</span>`;
  }

  function escapeHTML(s) {
    return String(s ?? "").replace(/[&<>"']/g, (c) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    }[c]));
  }

  function randomOffset() {
    let i = windows.size;
    return 30 + (i % 6) * 24;
  }

  function loadBounds(key) {
    try {
      const s = localStorage.getItem("cg.os.win." + key);
      if (!s) return null;
      return JSON.parse(s);
    } catch { return null; }
  }
  function saveBounds(key, b) {
    try { localStorage.setItem("cg.os.win." + key, JSON.stringify(b)); } catch {}
  }

  function listWindows() {
    return Array.from(windows.values()).slice();
  }
  function getWindow(id) { return windows.get(id) || null; }

  // ---------- context menu utility ----------
  function showContextMenu(x, y, items) {
    const menu = document.getElementById("context-menu");
    if (!menu) return;
    menu.innerHTML = "";
    items.forEach((it) => {
      if (it === "-") {
        const sep = document.createElement("div");
        sep.className = "ctx-sep";
        menu.appendChild(sep);
        return;
      }
      const el = document.createElement("div");
      el.className = "ctx-item" + (it.disabled ? " disabled" : "");
      el.innerHTML =
        `<span>${escapeHTML(it.label)}</span>` +
        (it.shortcut ? `<span class="ctx-shortcut">${escapeHTML(it.shortcut)}</span>` : "");
      if (!it.disabled) {
        el.addEventListener("click", () => {
          hideContextMenu();
          try { it.act && it.act(); } catch (e) { console.error(e); }
        });
      }
      menu.appendChild(el);
    });
    menu.style.left = x + "px";
    menu.style.top = y + "px";
    menu.hidden = false;
    // adjust if off-screen
    const r = menu.getBoundingClientRect();
    if (r.right > innerWidth) menu.style.left = (x - r.width) + "px";
    if (r.bottom > innerHeight) menu.style.top = (y - r.height) + "px";
  }
  function hideContextMenu() {
    const menu = document.getElementById("context-menu");
    if (menu) menu.hidden = true;
  }

  // ---------- public API ----------
  window.WM = {
    createWindow,
    closeWindow,
    focusWindow,
    minimizeWindow,
    restoreWindow,
    toggleMaximize,
    listWindows,
    getWindow,
    on,
    showContextMenu,
    hideContextMenu,
    startAltTab,
    cycleAltTab,
    endAltTab,
    get focusedId() { return focusedId; },
  };

  // hide ctx menu on outside click
  document.addEventListener("mousedown", (e) => {
    const menu = document.getElementById("context-menu");
    if (!menu || menu.hidden) return;
    if (!menu.contains(e.target)) hideContextMenu();
  });
})();