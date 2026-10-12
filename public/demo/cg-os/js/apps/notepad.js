/* ============================================================
   Notepad — basic text editor with save/load to virtual FS.
   ============================================================ */

(function () {
  "use strict";

  const app = {
    id: "notepad",
    name: "Notepad",
    icon: "notepad",
    category: "utility",

    launch(opts = {}) {
      const winId = "notepad_" + (opts.path || "untitled-" + Date.now()).replace(/[^\w. -]/g, "_");
      let path = opts.path || "/C:/Documents/Welcome.txt";
      let isDirty = false;

      const content = document.createElement("textarea");
      content.className = "notepad-area";
      content.spellcheck = false;
      content.style.flex = "1";

      const win = window.WM.createWindow({
        id: winId,
        title: pathName(path) + " — Notepad",
        icon: "notepad",
        width: opts.width || 520,
        height: opts.height || 360,
        x: opts.x, y: opts.y,
        persistKey: "notepad:" + path,
        content: (body) => {
          const existing = window.FS.exists(path) ? window.FS.readText(path) : "";
          content.value = opts.state?.text ?? existing ?? "";
          body.style.display = "flex";
          body.style.flexDirection = "column";
          body.style.padding = "4px";
          body.style.gap = "4px";

          const menu = document.createElement("div");
          menu.className = "win-menubar";
          ["File", "Edit", "Format", "View", "Help"].forEach((m, i) => {
            const item = document.createElement("span");
            item.className = "win-menubar-item";
            item.textContent = m;
            item.dataset.m = i;
            item.addEventListener("click", () => onMenu(i, item));
            menu.appendChild(item);
          });
          body.appendChild(menu);

          body.appendChild(content);

          const status = document.createElement("div");
          status.className = "win-statusbar";
          const left = document.createElement("div");
          left.className = "win-statusbar-cell";
          left.textContent = "Ln 1, Col 1";
          const right = document.createElement("div");
          right.className = "win-statusbar-cell";
          right.textContent = "100%";
          status.appendChild(left);
          status.appendChild(right);
          body.appendChild(status);

          content.addEventListener("input", () => {
            isDirty = true;
            markDirty();
          });
          content.addEventListener("keyup", () => updateCursor());
          content.addEventListener("click", () => updateCursor());

          setTimeout(() => content.focus(), 0);

          function markDirty() {
            win.setTitle((isDirty ? "* " : "") + pathName(path) + " — Notepad");
          }
          function updateCursor() {
            const pos = content.selectionStart;
            const before = content.value.slice(0, pos);
            const line = before.split("\n").length;
            const col = before.length - before.lastIndexOf("\n");
            left.textContent = `Ln ${line}, Col ${col}`;
          }

          function onMenu(idx, item) {
            // dismiss any open menu visual state
            menu.querySelectorAll(".win-menubar-item").forEach((x) => x.classList.remove("is-active"));
            item.classList.add("is-active");
            if (idx === 0) openFileMenu();
          }

          function openFileMenu() {
            const items = [
              { label: "New", shortcut: "Ctrl+N", act: () => window.Apps.launch("notepad") },
              { label: "Open…", shortcut: "Ctrl+O", act: () => fileOpenDialog() },
              { label: "Save", shortcut: "Ctrl+S", act: () => save() },
              { label: "Save As…", shortcut: "Ctrl+Shift+S", act: () => saveAs() },
              "-",
              { label: "Page Setup…", disabled: true },
              { label: "Print…", shortcut: "Ctrl+P", act: () => printFallback() },
              "-",
              { label: "Close", act: () => window.WM.closeWindow(winId) },
            ];
            const r = item.getBoundingClientRect();
            window.WM.showContextMenu(r.left, r.bottom, items);
            // close menu visual on outside click
            setTimeout(() => {
              document.addEventListener("click", () => item.classList.remove("is-active"), { once: true });
            }, 0);
          }

          function save() {
            window.FS.write(path, content.value);
            isDirty = false;
            markDirty();
          }
          function saveAs() {
            const next = prompt("Save as (virtual path):", path);
            if (!next) return;
            const clean = next.startsWith("/") ? next : "/C:/Documents/" + next;
            if (window.FS.write(clean, content.value)) {
              path = clean;
              win.persistKey = "notepad:" + path;
              isDirty = false;
              markDirty();
            }
          }
          function fileOpenDialog() {
            const next = prompt("Open (virtual path):", path);
            if (!next) return;
            const clean = next.startsWith("/") ? next : "/C:/Documents/" + next;
            if (window.FS.readText(clean) == null) { alert("File not found: " + clean); return; }
            content.value = window.FS.readText(clean) || "";
            path = clean;
            win.persistKey = "notepad:" + path;
            isDirty = false;
            markDirty();
          }
          function printFallback() {
            const w = window.open("", "_blank");
            if (!w) { alert("Pop-ups blocked. Try Ctrl+P in this window."); return; }
            w.document.write("<pre>" + escapeHTML(content.value) + "</pre>");
            w.document.close();
            w.print();
          }

          content.addEventListener("keydown", (e) => {
            const ctrl = e.ctrlKey || e.metaKey;
            if (ctrl && e.key.toLowerCase() === "s") {
              e.preventDefault();
              if (e.shiftKey) saveAs(); else save();
            } else if (ctrl && e.key.toLowerCase() === "o") {
              e.preventDefault();
              fileOpenDialog();
            } else if (ctrl && e.key.toLowerCase() === "a") {
              // allow default select-all
            } else if (ctrl && e.key.toLowerCase() === "c") {
              const sel = content.value.slice(content.selectionStart, content.selectionEnd);
              if (sel) window.Clipboard.setText(sel);
            } else if (ctrl && e.key.toLowerCase() === "x") {
              const sel = content.value.slice(content.selectionStart, content.selectionEnd);
              if (sel) {
                window.Clipboard.setText(sel);
                content.value = content.value.slice(0, content.selectionStart) + content.value.slice(content.selectionEnd);
                isDirty = true; markDirty();
              }
            } else if (ctrl && e.key.toLowerCase() === "v") {
              e.preventDefault();
              window.Clipboard.getText().then((txt) => {
                if (!txt) return;
                content.setRangeText(txt, content.selectionStart, content.selectionEnd, "end");
                isDirty = true; markDirty();
              });
            }
          });

          // expose state for persistence
          queueMicrotask(() => {
            win.appState = { path, text: content.value };
            win.getAppState = () => ({ path, text: content.value });
            // save state on close
            win.onClose = () => {
              if (isDirty && confirm("Save changes to " + pathName(path) + "?")) save();
            };
          });
        },
      });

      win.app = "notepad";
      return win;
    },
  };

  function pathName(p) {
    const parts = p.split("/").filter(Boolean);
    return parts[parts.length - 1] || "Untitled";
  }

  function escapeHTML(s) {
    return String(s ?? "").replace(/[&<>"']/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    }[c]));
  }

  window.NotepadApp = app;
})();