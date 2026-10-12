/* ============================================================
   Office chrome — shared menu bar, toolbar, status bar helpers
   for Word / Excel / PowerPoint / Outlook.
   ============================================================ */

(function () {
  "use strict";

  function escapeHTML(s) {
    return String(s ?? "").replace(/[&<>"']/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    }[c]));
  }

  // ---------------- Menu bar with dropdowns ----------------
  // items: [{ label, shortcut?, disabled?, submenu?: [{label, ...}] }]
  function buildMenuBar(items) {
    const bar = document.createElement("div");
    bar.className = "office-menubar";

    let openMenuItem = null;
    let closeOnDocClickHandler = null;

    function closeAll() {
      bar.querySelectorAll(".office-menu-item.is-open").forEach((el) => el.classList.remove("is-open"));
      const dd = bar.querySelector(".office-menubar-dropdown");
      if (dd) dd.remove();
      openMenuItem = null;
      if (closeOnDocClickHandler) {
        document.removeEventListener("mousedown", closeOnDocClickHandler, true);
        closeOnDocClickHandler = null;
      }
    }

    items.forEach((it, idx) => {
      const item = document.createElement("div");
      item.className = "office-menu-item";
      item.textContent = it.label;
      if (it.disabled) item.classList.add("is-disabled");
      item.addEventListener("mousedown", (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (it.disabled) return;
        if (openMenuItem === item) { closeAll(); return; }
        closeAll();
        openMenuItem = item;
        item.classList.add("is-open");
        // dropdown
        const dd = document.createElement("div");
        dd.className = "office-menubar-dropdown";
        const r = item.getBoundingClientRect();
        dd.style.left = r.left + "px";
        dd.style.top = r.bottom + "px";
        buildDropdownItems(dd, it.submenu || [], () => {
          closeAll();
          if (it.onClick) it.onClick();
        });
        document.body.appendChild(dd);
        closeOnDocClickHandler = (ev) => {
          if (dd.contains(ev.target) || item.contains(ev.target)) return;
          closeAll();
        };
        setTimeout(() => {
          document.addEventListener("mousedown", closeOnDocClickHandler, true);
        }, 0);
      });
      bar.appendChild(item);
    });
    return bar;
  }

  function buildDropdownItems(host, items, onClose) {
    items.forEach((it) => {
      if (it === "-") {
        const sep = document.createElement("div");
        sep.className = "office-menu-dd-sep";
        host.appendChild(sep);
        return;
      }
      const row = document.createElement("div");
      row.className = "office-menu-dd-item" + (it.disabled ? " is-disabled" : "");
      row.innerHTML =
        `<span class="dd-check">${it.checked ? "✓" : ""}</span>` +
        `<span class="dd-label">${escapeHTML(it.label)}</span>` +
        `<span class="dd-shortcut">${it.shortcut ? escapeHTML(it.shortcut) : ""}</span>`;
      row.addEventListener("mousedown", (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (it.disabled) return;
        onClose && onClose();
        if (it.act) { try { it.act(); } catch (e) { console.error(e); } }
      });
      host.appendChild(row);
    });
  }

  // ---------------- Toolbar (groups of buttons + selects) ----------------
  // groups: [[ { type: "btn" | "select" | "spacer", ... } ]]
  function buildToolbar(groups, opts = {}) {
    const bar = document.createElement("div");
    bar.className = "office-toolbar";

    function setState() {
      // re-evaluate button pressed/disabled states
      groups.flat().forEach((item) => {
        if (item.type === "btn" && item.refreshState) {
          const st = item.refreshState();
          const el = item._el;
          if (!el) return;
          el.classList.toggle("is-active", !!st.active);
          el.classList.toggle("is-disabled", !!st.disabled);
        }
      });
    }
    bar.refreshState = setState;

    groups.forEach((group, gi) => {
      if (gi > 0) {
        const sep = document.createElement("div");
        sep.className = "office-toolbar-sep";
        bar.appendChild(sep);
      }
      const wrap = document.createElement("div");
      wrap.className = "office-toolbar-group";
      group.forEach((item) => {
        if (item.type === "btn") {
          const b = document.createElement("button");
          b.className = "office-tb-btn" + (item.toggle ? " toggle" : "");
          b.type = "button";
          b.title = item.title || item.label || "";
          b.innerHTML = item.html || escapeHTML(item.label || "");
          b.addEventListener("mousedown", (e) => {
            // toolbar buttons should not steal focus from editor
            e.preventDefault();
          });
          b.addEventListener("click", (e) => {
            e.preventDefault();
            if (item.disabled) return;
            if (item.act) { try { item.act(); } catch (err) { console.error(err); } }
            setState();
          });
          item._el = b;
          if (item.disabled) b.classList.add("is-disabled");
          wrap.appendChild(b);
        } else if (item.type === "select") {
          const sel = document.createElement("select");
          sel.className = "office-tb-select";
          (item.options || []).forEach((o) => {
            const opt = document.createElement("option");
            opt.value = o.value;
            opt.textContent = o.label;
            if (o.selected) opt.selected = true;
            sel.appendChild(opt);
          });
          sel.addEventListener("change", () => {
            if (item.onChange) { try { item.onChange(sel.value); } catch (e) { console.error(e); } }
          });
          item._el = sel;
          wrap.appendChild(sel);
        } else if (item.type === "label") {
          const lab = document.createElement("span");
          lab.className = "office-tb-label";
          lab.textContent = item.text;
          wrap.appendChild(lab);
        } else if (item.type === "input") {
          const inp = document.createElement("input");
          inp.className = "office-tb-input field";
          inp.value = item.value || "";
          inp.placeholder = item.placeholder || "";
          inp.addEventListener("input", () => item.onChange && item.onChange(inp.value));
          item._el = inp;
          wrap.appendChild(inp);
        }
      });
      bar.appendChild(wrap);
    });
    setState();
    return bar;
  }

  // ---------------- Status bar ----------------
  function buildStatusBar(cells) {
    const bar = document.createElement("div");
    bar.className = "win-statusbar";
    cells.forEach((cell) => {
      const c = document.createElement("div");
      c.className = "win-statusbar-cell";
      c.innerHTML = cell.html || "";
      if (cell.id) c.id = cell.id;
      bar.appendChild(c);
    });
    return bar;
  }

  // ---------------- Word-style status bar cells ----------------
  function buildWordStatusBar() {
    return buildStatusBar([
      { id: "of-stat-page", html: "Page 1" },
      { id: "of-stat-sec",  html: "Section 1" },
      { id: "of-stat-pos",  html: "1 / 1" },
      { id: "of-stat-mode", html: "EXT" },
    ]);
  }

  function buildExcelStatusBar() {
    return buildStatusBar([
      { id: "of-stat-ready", html: "Ready" },
      { id: "of-stat-sum",   html: "Sum = 0" },
      { id: "of-stat-avg",   html: "Average = 0" },
      { id: "of-stat-count", html: "Count = 0" },
    ]);
  }

  function buildPowerPointStatusBar() {
    return buildStatusBar([
      { id: "of-stat-slide", html: "Slide 1 of 1" },
      { id: "of-stat-design", html: "Design: Blank" },
      { id: "of-stat-zoom",  html: "100%" },
    ]);
  }

  // ---------------- Form-row input ----------------
  // for compose / new doc / new sheet / new presentation forms
  function buildFormField({ label, value, type = "text", placeholder, onChange }) {
    const row = document.createElement("div");
    row.className = "form-row";
    const lab = document.createElement("label");
    lab.textContent = label;
    const inp = document.createElement("input");
    inp.className = "field";
    inp.type = type;
    inp.value = value || "";
    if (placeholder) inp.placeholder = placeholder;
    inp.addEventListener("input", () => onChange && onChange(inp.value));
    row.appendChild(lab);
    row.appendChild(inp);
    row._input = inp;
    return row;
  }

  // expose
  window.OfficeChrome = {
    buildMenuBar,
    buildToolbar,
    buildStatusBar,
    buildWordStatusBar,
    buildExcelStatusBar,
    buildPowerPointStatusBar,
    buildFormField,
    escapeHTML,
  };
})();