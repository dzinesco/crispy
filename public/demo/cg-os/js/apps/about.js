/* ============================================================
   About — modal dialog with version info and shortcuts.
   ============================================================ */

(function () {
  "use strict";

  const app = {
    id: "about",
    name: "About",
    icon: "about",
    category: "system",

    launch(opts = {}) {
      const win = window.WM.createWindow({
        id: "about",
        title: "About Crispy Goat OS",
        icon: "about",
        width: 380, height: 260,
        x: opts.x ?? 160, y: opts.y ?? 120,
        persistKey: "about",
        content: (body) => {
          body.style.padding = "0";
          const a = document.createElement("div");
          a.className = "about";
          a.innerHTML = `
            <div class="about-logo">CG</div>
            <div class="about-body">
              <h2>Crispy Goat OS</h2>
              <div>Windows 98 Edition</div>
              <div>Version 1.0 (Build 98.012345-OS)</div>
              <div class="credit">© 1998 Crispy Computing, Inc. — Browser recreation.</div>
              <hr class="sep" />
              <div style="font-size:11px;">
                <b>System:</b> ${navigator.platform || "browser"} · ${navigator.userAgent.split(" ").slice(-1)[0]}<br>
                <b>Memory:</b> ${navigator.deviceMemory || "?"} GB<br>
                <b>Storage:</b> localStorage
              </div>
              <div style="font-size:11px; color:#444;">
                <b>Shortcuts:</b> Alt+Tab cycles windows · Ctrl+Esc opens Start · Alt+F4 closes window · Esc closes menus.
              </div>
              ${opts.hint ? `<div style="background:#ffffe0; padding:4px 8px; border:1px solid #888; font-size:11px;">${escapeHTML(opts.hint)}</div>` : ""}
            </div>`;
          body.appendChild(a);
          const actions = document.createElement("div");
          actions.className = "about-actions";
          const ok = document.createElement("button");
          ok.className = "btn is-default";
          ok.textContent = "OK";
          ok.addEventListener("click", () => window.WM.closeWindow("about"));
          const reset = document.createElement("button");
          reset.className = "btn";
          reset.textContent = "Reset OS…";
          reset.style.marginRight = "auto";
          reset.style.marginLeft = "6px";
          reset.addEventListener("click", () => {
            if (confirm("Erase all saved windows, files, and settings?")) {
              localStorage.clear();
              location.reload();
            }
          });
          actions.appendChild(reset);
          actions.appendChild(ok);
          body.appendChild(actions);
        },
      });
      win.app = "about";
      return win;
    },
  };

  function escapeHTML(s) {
    return String(s ?? "").replace(/[&<>"']/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    }[c]));
  }

  window.AboutApp = app;
})();