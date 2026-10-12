/* ============================================================
   Desktop — icons, start menu, clock, tray, selection, context menu,
   keyboard shortcuts.
   ============================================================ */

(function () {
  "use strict";

  const desktop = document.getElementById("desktop");
  const iconsHost = document.getElementById("desktop-icons");
  const startBtn = document.getElementById("start-btn");
  const startMenu = document.getElementById("start-menu");
  const startBody = document.getElementById("start-menu-body");
  const trayClock = document.getElementById("tray-clock");
  const trayClipboard = document.getElementById("tray-clipboard");
  const trayVolume = document.getElementById("tray-volume");
  const trayNetwork = document.getElementById("tray-network");
  const clipboardPeek = document.getElementById("clipboard-peek");
  const clipboardClose = document.getElementById("clipboard-close");
  const clipboardContent = document.getElementById("clipboard-content");

  let state = null;
  let altTabHeld = false;

  function init() {
    state = window.Persistence.loadDesktop();
    renderDesktopIcons();
    renderStartMenu();
    startClock();
    wireTaskbar();
    wireDesktop();
    wireClipboard();
    wireShortcuts();
  }

  // ---------- clock ----------
  function startClock() {
    function tick() {
      const d = new Date();
      let h = d.getHours();
      const m = String(d.getMinutes()).padStart(2, "0");
      const ampm = h >= 12 ? " PM" : " AM";
      const dh = ((h + 11) % 12) + 1;
      trayClock.textContent = `${dh}:${m}${ampm}`;
    }
    tick();
    setInterval(tick, 1000 * 15);
  }

  // ---------- desktop icons ----------
  function renderDesktopIcons() {
    iconsHost.innerHTML = "";
    state.icons.forEach((icon) => iconsHost.appendChild(buildIcon(icon)));
  }

  function buildIcon(spec) {
    const el = document.createElement("div");
    el.className = "desktop-icon";
    el.dataset.iconId = spec.id;
    el.style.gridColumn = String(spec.x + 1);
    el.style.gridRow = String(spec.y + 1);
    el.innerHTML =
      `<div class="icon-glyph">${window.Icons.get(spec.icon)}</div>` +
      `<div class="icon-label">${escapeHTML(spec.label)}</div>`;
    el.addEventListener("click", (e) => {
      e.stopPropagation();
      clearSelection();
      el.classList.add("is-selected");
    });
    el.addEventListener("dblclick", () => activateIcon(spec));
    el.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      e.stopPropagation();
      clearSelection();
      el.classList.add("is-selected");
      window.WM.showContextMenu(e.clientX, e.clientY, [
        { label: "Open", act: () => activateIcon(spec) },
        { label: "Open in new window", disabled: true },
        "-",
        { label: "Cut", disabled: true },
        { label: "Copy", disabled: true },
        "-",
        { label: "Delete", act: () => removeIcon(spec.id) },
        { label: "Rename", act: () => renameIcon(spec) },
        "-",
        { label: "Properties", act: () => iconProperties(spec) },
      ]);
    });
    attachIconDrag(el, spec);
    return el;
  }

  function activateIcon(spec) {
    if (spec.action === "explorer") window.Apps.launch("explorer");
    else if (spec.action === "noop") return;
    else window.Apps.launch(spec.action);
  }

  function removeIcon(id) {
    state.icons = state.icons.filter((i) => i.id !== id);
    window.Persistence.saveDesktop(state);
    renderDesktopIcons();
  }

  function renameIcon(spec) {
    const next = prompt("Rename icon:", spec.label);
    if (!next) return;
    spec.label = next.trim().slice(0, 32);
    window.Persistence.saveDesktop(state);
    renderDesktopIcons();
  }

  function iconProperties(spec) {
    window.WM.createWindow({
      id: "props_" + spec.id,
      title: spec.label + " Properties",
      icon: spec.icon,
      width: 320, height: 240, x: 120, y: 80,
      persistKey: "props_" + spec.id,
      content: (body) => {
        const wrap = document.createElement("div");
        wrap.style.padding = "12px";
        wrap.innerHTML = `
          <div style="display:flex; gap:12px; align-items:center;">
            <div style="width:48px; height:48px; display:grid; place-items:center;">${window.Icons.get(spec.icon)}</div>
            <div>
              <div style="font-weight:700; font-size:14px;">${escapeHTML(spec.label)}</div>
              <div style="color:#444;">Type: ${spec.action === "noop" ? "System folder" : "Application"}</div>
            </div>
          </div>
          <hr class="sep" />
          <div class="group">
            <div class="group-label">Details</div>
            <div>ID: ${escapeHTML(spec.id)}</div>
            <div>Action: ${escapeHTML(spec.action)}</div>
            <div>Position: column ${spec.x + 1}, row ${spec.y + 1}</div>
          </div>
          <div style="display:flex; justify-content:flex-end; gap:6px; margin-top:8px;">
            <button class="btn is-default" id="props-ok">OK</button>
          </div>`;
        body.appendChild(wrap);
        wrap.querySelector("#props-ok").addEventListener("click", () => window.WM.closeWindow("props_" + spec.id));
      },
    });
  }

  function attachIconDrag(el, spec) {
    let drag = null;
    el.addEventListener("mousedown", (e) => {
      if (e.button !== 0) return;
      const startX = e.clientX, startY = e.clientY;
      const origX = spec.x, origY = spec.y;
      el.classList.add("is-dragging");
      drag = { moved: false, startX, startY, origX, origY };
    });
    el.addEventListener("mousemove", (e) => {
      if (!drag) return;
      const dx = e.clientX - drag.startX;
      const dy = e.clientY - drag.startY;
      if (!drag.moved && Math.hypot(dx, dy) < 4) return;
      drag.moved = true;
      const colW = 84, rowH = 90;
      const nx = Math.max(0, Math.min(8, drag.origX + Math.round(dx / colW)));
      const ny = Math.max(0, Math.min(20, drag.origY + Math.round(dy / rowH)));
      spec.x = nx; spec.y = ny;
      el.style.gridColumn = String(nx + 1);
      el.style.gridRow = String(ny + 1);
    });
    el.addEventListener("mouseup", () => {
      if (!drag) return;
      el.classList.remove("is-dragging");
      const wasDrag = drag.moved;
      drag = null;
      if (wasDrag) window.Persistence.saveDesktop(state);
    });
    el.addEventListener("mouseleave", () => {
      if (!drag) return;
      el.classList.remove("is-dragging");
      const wasDrag = drag.moved;
      drag = null;
      if (wasDrag) window.Persistence.saveDesktop(state);
    });
  }

  function clearSelection() {
    iconsHost.querySelectorAll(".is-selected").forEach((el) => el.classList.remove("is-selected"));
  }

  // ---------- start menu ----------
  function renderStartMenu() {
    startBody.innerHTML = "";

    const programs = document.createElement("div");
    programs.className = "start-menu-section";
    programs.innerHTML = `<div class="start-menu-section-title">Programs</div>`;
    const progItems = [
      "notepad", "calculator", "paint", "minesweeper", "solitaire", "winamp", "explorer",
    ];
    progItems.forEach((id) => {
      const app = window.Apps.get(id);
      if (!app) return;
      const item = document.createElement("div");
      item.className = "start-menu-item";
      item.innerHTML =
        `<span class="icon">${window.Icons.get(app.icon)}</span>` +
        `<span class="label">${escapeHTML(app.name)}</span>`;
      item.addEventListener("click", () => {
        hideStartMenu();
        window.Apps.launch(id);
      });
      programs.appendChild(item);
    });

    const office = document.createElement("div");
    office.className = "start-menu-section";
    office.innerHTML = `<div class="start-menu-section-title">Microsoft Office</div>`;
    const officeItems = ["word", "excel", "powerpoint", "outlook"];
    officeItems.forEach((id) => {
      const app = window.Apps.get(id);
      if (!app) return;
      const item = document.createElement("div");
      item.className = "start-menu-item";
      item.innerHTML =
        `<span class="icon">${window.Icons.get(app.icon)}</span>` +
        `<span class="label">${escapeHTML(app.name)}</span>`;
      item.addEventListener("click", () => {
        hideStartMenu();
        window.Apps.launch(id);
      });
      office.appendChild(item);
    });

    const demos = document.createElement("div");
    demos.className = "start-menu-section";
    demos.innerHTML = `<div class="start-menu-section-title">Crispy Goat Demos</div>`;
    ["doom", "ipod", "lotus"].forEach((id) => {
      const app = window.Apps.get(id);
      if (!app) return;
      const item = document.createElement("div");
      item.className = "start-menu-item";
      item.innerHTML =
        `<span class="icon">${window.Icons.get(app.icon)}</span>` +
        `<span class="label">${escapeHTML(app.name)}</span>`;
      item.addEventListener("click", () => {
        hideStartMenu();
        window.Apps.launch(id);
      });
      demos.appendChild(item);
    });

    const sys = document.createElement("div");
    sys.className = "start-menu-section";
    sys.innerHTML = `<div class="start-menu-section-title">System</div>`;
    [
      { id: "explorer", label: "File Explorer", icon: "explorer" },
      { id: "about", label: "About Crispy Goat OS", icon: "about" },
    ].forEach((row) => {
      const app = window.Apps.get(row.id);
      if (!app) return;
      const item = document.createElement("div");
      item.className = "start-menu-item";
      item.innerHTML =
        `<span class="icon">${window.Icons.get(row.icon)}</span>` +
        `<span class="label">${escapeHTML(row.label)}</span>`;
      item.addEventListener("click", () => {
        hideStartMenu();
        window.Apps.launch(row.id);
      });
      sys.appendChild(item);
    });

    const shutdown = document.createElement("div");
    shutdown.className = "start-menu-section";
    const shutItem = document.createElement("div");
    shutItem.className = "start-menu-item";
    shutItem.innerHTML =
      `<span class="icon">${window.Icons.get("shutdown")}</span>` +
      `<span class="label">Shut Down&hellip;</span>`;
    shutItem.addEventListener("click", () => {
      hideStartMenu();
      shutdownDialog();
    });
    shutdown.appendChild(shutItem);

    startBody.appendChild(programs);
    startBody.appendChild(office);
    startBody.appendChild(demos);
    startBody.appendChild(sys);
    startBody.appendChild(shutdown);
  }

  function showStartMenu() {
    startMenu.hidden = false;
    startBtn.classList.add("is-open");
  }
  function hideStartMenu() {
    startMenu.hidden = true;
    startBtn.classList.remove("is-open");
  }
  function toggleStartMenu() {
    if (startMenu.hidden) showStartMenu(); else hideStartMenu();
  }

  function shutdownDialog() {
    const w = window.WM.createWindow({
      id: "shutdown",
      title: "Shut Down Crispy Goat OS",
      icon: "shutdown",
      width: 360, height: 200, x: 200, y: 140,
      content: (body) => {
        const wrap = document.createElement("div");
        wrap.style.padding = "12px";
        wrap.innerHTML = `
          <div style="display:flex; gap:12px; align-items:center;">
            <div style="width:48px; height:48px; display:grid; place-items:center; font-size:32px;">⏻</div>
            <div>
              <div style="font-weight:700; font-size:13px;">Are you sure you want to:</div>
              <div style="margin-top:6px;">
                <label class="radio"><input type="radio" name="shutact" value="standby" checked> Stand by</label>
                <label class="radio"><input type="radio" name="shutact" value="shutdown"> Shut down</label>
                <label class="radio"><input type="radio" name="shutact" value="restart"> Restart</label>
              </div>
            </div>
          </div>
          <hr class="sep" />
          <div style="display:flex; justify-content:flex-end; gap:6px;">
            <button class="btn is-default" id="shut-ok">OK</button>
            <button class="btn" id="shut-cancel">Cancel</button>
          </div>`;
        body.appendChild(wrap);
        wrap.querySelector("#shut-ok").addEventListener("click", () => {
          const act = wrap.querySelector('input[name="shutact"]:checked').value;
          if (act === "shutdown") {
            // close all and show black "off" screen
            window.WM.listWindows().forEach((w) => window.WM.closeWindow(w.id));
            const off = document.createElement("div");
            Object.assign(off.style, {
              position: "fixed", inset: 0, background: "#000", zIndex: 99999,
              display: "grid", placeItems: "center", color: "#888",
              fontFamily: "monospace", fontSize: "12px",
            });
            off.innerHTML = "It's now safe to close this browser tab.<br><br><span style='opacity:.5'>Click to wake the OS.</span>";
            off.addEventListener("click", () => off.remove());
            document.body.appendChild(off);
            window.WM.closeWindow("shutdown");
          } else if (act === "restart") {
            location.reload();
          } else {
            window.WM.closeWindow("shutdown");
          }
        });
        wrap.querySelector("#shut-cancel").addEventListener("click", () => window.WM.closeWindow("shutdown"));
      },
    });
    return w;
  }

  // ---------- taskbar wiring ----------
  function wireTaskbar() {
    startBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      toggleStartMenu();
    });
    document.addEventListener("click", (e) => {
      if (startMenu.hidden) return;
      if (startMenu.contains(e.target) || startBtn.contains(e.target)) return;
      hideStartMenu();
    });

    trayClipboard.addEventListener("click", () => {
      clipboardContent.textContent = window.Clipboard.peek() || "(empty)";
      clipboardPeek.hidden = !clipboardPeek.hidden;
    });
    clipboardClose.addEventListener("click", () => clipboardPeek.hidden = true);

    trayVolume.addEventListener("click", () => {
      // simple toggle that mutes/unmutes <audio> elements by setting gain
      const muted = document.documentElement.dataset.muted === "1";
      document.documentElement.dataset.muted = muted ? "0" : "1";
      window.Apps.launch("about", { hint: muted ? "Volume unmuted" : "Volume muted" });
    });

    trayNetwork.addEventListener("click", () => {
      window.Apps.launch("about", { hint: "Network: CG-LAN 100Mb/s — connected" });
    });

    trayClock.addEventListener("dblclick", () => {
      window.Apps.launch("about", { hint: "Time: " + new Date().toString() });
    });
  }

  // ---------- desktop wiring ----------
  function wireDesktop() {
    desktop.addEventListener("mousedown", (e) => {
      // ignore if click is on a window / icon / start menu / taskbar
      if (e.target.closest(".win, .desktop-icon, #taskbar, #start-menu, .ctx-menu")) return;
      clearSelection();
      hideStartMenu();
      // selection rect
      if (e.button !== 0) return;
      const sx = e.clientX, sy = e.clientY;
      const rect = document.getElementById("selection-rect");
      rect.hidden = false;
      rect.style.left = sx + "px";
      rect.style.top = sy + "px";
      rect.style.width = "0px";
      rect.style.height = "0px";

      function onMove(ev) {
        const cx = ev.clientX, cy = ev.clientY;
        const x = Math.min(sx, cx), y = Math.min(sy, cy);
        const w = Math.abs(cx - sx), h = Math.abs(cy - sy);
        rect.style.left = x + "px";
        rect.style.top = y + "px";
        rect.style.width = w + "px";
        rect.style.height = h + "px";
      }
      function onUp() {
        rect.hidden = true;
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
      }
      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    });

    desktop.addEventListener("contextmenu", (e) => {
      if (e.target.closest(".win, .desktop-icon, #taskbar, #start-menu")) return;
      e.preventDefault();
      window.WM.showContextMenu(e.clientX, e.clientY, [
        { label: "Refresh", act: () => location.reload() },
        "-",
        { label: "New Folder", act: () => {
            const name = prompt("Folder name:", "New Folder");
            if (!name) return;
            const path = "/C:/Desktop/" + name.replace(/[^\w. -]/g, "_");
            window.FS.mkdir(path);
        }},
        { label: "New Text File", act: () => {
            const name = prompt("File name:", "New File.txt");
            if (!name) return;
            const path = "/C:/Desktop/" + name.replace(/[^\w. -]/g, "_");
            window.FS.write(path, "");
            window.Apps.launch("notepad", { path });
        }},
        "-",
        { label: "Paste", act: async () => {
            const txt = await window.Clipboard.getText();
            if (txt) window.FS.write("/C:/Desktop/Paste-" + Date.now() + ".txt", txt);
        }},
        "-",
        { label: "Properties", act: () => window.Apps.launch("about") },
      ]);
    });
  }

  // ---------- clipboard peek wiring ----------
  function wireClipboard() {
    window.Clipboard.onChange((t) => {
      if (!clipboardPeek.hidden) clipboardContent.textContent = t || "(empty)";
    });
  }

  // ---------- keyboard shortcuts ----------
  function wireShortcuts() {
    window.addEventListener("keydown", (e) => {
      const t = e.target;
      const inEditable = t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable);

      // Ctrl+Esc → Start menu
      if (e.ctrlKey && e.key === "Escape") {
        e.preventDefault();
        toggleStartMenu();
        return;
      }

      // Alt+Tab
      if (e.altKey && e.key === "Tab") {
        e.preventDefault();
        if (!altTabHeld) {
          altTabHeld = true;
          window.WM.startAltTab();
        } else {
          window.WM.cycleAltTab();
        }
        return;
      }

      // Esc closes start menu / clipboard peek
      if (e.key === "Escape" && !inEditable) {
        if (!startMenu.hidden) hideStartMenu();
        if (!clipboardPeek.hidden) clipboardPeek.hidden = true;
      }

      // Alt+F4 closes focused window
      if (e.altKey && e.key === "F4") {
        e.preventDefault();
        const id = window.WM.focusedId;
        if (id) window.WM.closeWindow(id);
        return;
      }

      // Win key / Cmd — not bound (would collide with browser shortcuts)
    });
    window.addEventListener("keyup", (e) => {
      if (e.key === "Alt" && altTabHeld) {
        altTabHeld = false;
        window.WM.endAltTab();
      }
    });
  }

  function escapeHTML(s) {
    return String(s ?? "").replace(/[&<>"']/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    }[c]));
  }

  window.Desktop = { init, refresh: () => { state = window.Persistence.loadDesktop(); renderDesktopIcons(); renderStartMenu(); } };
})();