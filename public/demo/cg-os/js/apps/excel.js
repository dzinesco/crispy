/* ============================================================
   Excel 2000 — grid of cells with formula support.
   Model: { sheets: [{ name, cells: { A1: { value, format } } }] }
   Cell value can be a string (literal) or a formula starting with "=".
   Supports: =A1+B1, =SUM(A1:A5), =A1*B2, etc.
   ============================================================ */

(function () {
  "use strict";

  const ROWS = 60;
  const COLS = 26; // A..Z
  const DEFAULT_CELL_W = 64;
  const DEFAULT_CELL_H = 18;

  const DEFAULT_BOOK = () => ({
    type: "xlsx", version: 1,
    sheets: [{ name: "Sheet1", cells: {} }],
  });

  const app = {
    id: "excel",
    name: "Microsoft Excel",
    icon: "excel",
    category: "office",

    launch(opts = {}) {
      const winId = "excel_" + (opts.path || "untitled-" + Date.now()).replace(/[^\w. -]/g, "_");
      let path = opts.path || "/C:/My Documents/Book1.xls";
      let isDirty = false;
      let book = loadBook(path, opts.state);
      let curSheet = book.sheets[0];
      let curCell = "A1";
      let editing = false;
      let editBuf = "";
      let range = null; // { r1, c1, r2, c2 } inclusive

      const fileName = () => {
        const parts = (path || "").split("/").filter(Boolean);
        return parts[parts.length - 1] || "Untitled";
      };
      const colLabel = (c) => {
        let s = "", n = c;
        while (true) { s = String.fromCharCode(65 + (n % 26)) + s; n = Math.floor(n / 26) - 1; if (n < 0) break; }
        return s;
      };
      const colToIdx = (col) => {
        let n = 0;
        for (const ch of col) n = n * 26 + (ch.charCodeAt(0) - 64);
        return n - 1;
      };
      const parseRef = (s) => {
        const m = s.match(/^\$?([A-Z]+)\$?(\d+)$/);
        if (!m) return null;
        return { c: colToIdx(m[1]), r: parseInt(m[2], 10) - 1 };
      };
      const isFormula = (v) => typeof v === "string" && v.startsWith("=");
      const getCell = (ref) => curSheet.cells[ref] || null;
      const setCell = (ref, val) => {
        if (val === "" || val == null) delete curSheet.cells[ref];
        else curSheet.cells[ref] = { value: String(val), format: curSheet.cells[ref]?.format || "general" };
        isDirty = true;
        updateTitle();
      };

      // ---------- formula evaluator ----------
      function evaluate(formula) {
        if (!formula.startsWith("=")) return formula;
        let f = formula.slice(1).toUpperCase();
        // SUM(A1:A5) - replace range
        f = f.replace(/SUM\(([A-Z]+\d+):([A-Z]+\d+)\)/g, (m, a, b) => {
          const r1 = parseRef(a), r2 = parseRef(b);
          if (!r1 || !r2) return "0";
          let sum = 0;
          for (let r = r1.r; r <= r2.r; r++) {
            for (let c = r1.c; c <= r2.c; c++) {
              const v = computeCell(colLabel(c) + (r + 1));
              const n = Number(v);
              if (isFinite(n)) sum += n;
            }
          }
          return String(sum);
        });
        // AVERAGE, MIN, MAX, COUNT
        const aggReplace = (fn, reduce) => f.replace(new RegExp(`${fn}\\(([A-Z]+\\d+):([A-Z]+\\d+)\\)`, "g"), (m, a, b) => {
          const r1 = parseRef(a), r2 = parseRef(b);
          if (!r1 || !r2) return "0";
          const vals = [];
          for (let r = r1.r; r <= r2.r; r++) {
            for (let c = r1.c; c <= r2.c; c++) {
              const v = computeCell(colLabel(c) + (r + 1));
              const n = Number(v);
              if (isFinite(n)) vals.push(n);
            }
          }
          return String(reduce(vals));
        });
        f = aggReplace("AVERAGE", (vs) => vs.length ? vs.reduce((a, b) => a + b, 0) / vs.length : 0);
        f = aggReplace("MIN", (vs) => vs.length ? Math.min(...vs) : 0);
        f = aggReplace("MAX", (vs) => vs.length ? Math.max(...vs) : 0);
        f = aggReplace("COUNT", (vs) => vs.length);
        // cell refs
        f = f.replace(/([A-Z]+)(\d+)/g, (m, col, row) => {
          const ref = col + row;
          const v = computeCell(ref);
          const n = Number(v);
          return isFinite(n) && v !== "" ? String(n) : "0";
        });
        try {
          // eslint-disable-next-line no-new-func
          const r = Function(`"use strict"; return (${f});`)();
          if (isFinite(r)) return Math.round(r * 1e10) / 1e10;
          return "#ERR";
        } catch (e) { return "#ERR"; }
      }

      function computeCell(ref) {
        const c = getCell(ref);
        if (!c) return "";
        if (isFormula(c.value)) return evaluate(c.value);
        return c.value;
      }

      // ---------- DOM ----------
      const root = document.createElement("div");
      root.className = "excel";

      const formulaBar = document.createElement("div");
      formulaBar.className = "excel-formula";
      const nameBox = document.createElement("div");
      nameBox.className = "name-box";
      nameBox.textContent = curCell;
      const fxBtn = document.createElement("button");
      fxBtn.className = "fx";
      fxBtn.textContent = "fx";
      fxBtn.title = "Insert function";
      fxBtn.addEventListener("click", () => {
        const fn = prompt("Insert function (SUM, AVERAGE, MIN, MAX, COUNT):", "SUM");
        if (!fn) return;
        startEditing("=" + fn + "(" + curCell + ":" + curCell + ")");
      });
      const formulaInput = document.createElement("input");
      formulaInput.className = "formula-input";
      formulaInput.placeholder = "Enter value or formula (e.g. =A1+B1)";
      formulaInput.addEventListener("focus", () => { if (!editing) startEditing(); });
      formulaInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter") { commitEdit(); e.preventDefault(); }
        else if (e.key === "Escape") { cancelEdit(); e.preventDefault(); }
        else if (e.key === "Tab") { commitEdit(); moveTo(relRef(curCell, 0, e.shiftKey ? -1 : 1)); e.preventDefault(); }
      });
      formulaInput.addEventListener("input", () => { editBuf = formulaInput.value; });
      formulaBar.appendChild(nameBox);
      formulaBar.appendChild(fxBtn);
      formulaBar.appendChild(formulaInput);

      const gridWrap = document.createElement("div");
      gridWrap.className = "excel-grid-wrap";
      const table = document.createElement("table");
      table.className = "excel-grid";
      gridWrap.appendChild(table);
      root.appendChild(formulaBar);
      root.appendChild(gridWrap);

      const statusBar = OfficeChrome.buildExcelStatusBar();
      const toolbar = OfficeChrome.buildToolbar([
        [
          { type: "btn", title: "New", html: "🗋", act: () => fileNew() },
          { type: "btn", title: "Open", html: "📂", act: () => fileOpen() },
          { type: "btn", title: "Save", html: "💾", act: () => fileSave() },
        ],
        [
          { type: "btn", title: "Cut", html: "✂", act: () => { copyRangeToClipboard(true); } },
          { type: "btn", title: "Copy", html: "⧉", act: () => copyRangeToClipboard(false) },
          { type: "btn", title: "Paste", html: "⎘", act: () => pasteFromClipboard() },
        ],
        [
          { type: "btn", title: "Bold (Ctrl+B)", html: "<b>B</b>",
            refreshState: () => ({ active: curCellBold() }),
            act: () => toggleCellFormat("bold") },
          { type: "btn", title: "Italic (Ctrl+I)", html: "<i>I</i>",
            refreshState: () => ({ active: curCellFormat() === "italic" }),
            act: () => toggleCellFormat("italic") },
        ],
        [
          { type: "btn", title: "Align left", html: "⫷", act: () => setAlign("left") },
          { type: "btn", title: "Center", html: "≡", act: () => setAlign("center") },
          { type: "btn", title: "Align right", html: "⫸", act: () => setAlign("right") },
        ],
        [
          { type: "label", text: "Format" },
          { type: "select", title: "Number format", options: [
            { value: "general", label: "General" },
            { value: "number", label: "Number" },
            { value: "currency", label: "Currency ($)" },
            { value: "percent", label: "Percent" },
            { value: "date", label: "Date" },
          ], onChange: (v) => {
            const c = getCell(curCell); if (!c) return;
            c.format = v; isDirty = true; updateTitle(); renderGrid();
          } },
        ],
        [
          { type: "btn", title: "Sum selected", html: "∑", act: () => startEditing("=SUM(" + curCell + ":" + curCell + ")") },
          { type: "btn", title: "Insert row", html: "↧", act: () => insertRow() },
          { type: "btn", title: "Insert column", html: "↦", act: () => insertColumn() },
        ],
      ], {});

      const menuBar = OfficeChrome.buildMenuBar([
        { label: "File", submenu: [
          { label: "New", shortcut: "Ctrl+N", act: () => fileNew() },
          { label: "Open…", shortcut: "Ctrl+O", act: () => fileOpen() },
          { label: "Save", shortcut: "Ctrl+S", act: () => fileSave() },
          { label: "Save As…", act: () => fileSaveAs() },
          "-",
          { label: "Close", act: () => window.WM.closeWindow(winId) },
        ] },
        { label: "Edit", submenu: [
          { label: "Undo", shortcut: "Ctrl+Z", act: () => { /* simple: clear cell */ clearCell(); } },
          { label: "Cut", shortcut: "Ctrl+X", act: () => copyRangeToClipboard(true) },
          { label: "Copy", shortcut: "Ctrl+C", act: () => copyRangeToClipboard(false) },
          { label: "Paste", shortcut: "Ctrl+V", act: () => pasteFromClipboard() },
          "-",
          { label: "Find…", act: () => findInGrid() },
        ] },
        { label: "Insert", submenu: [
          { label: "Rows", act: () => insertRow() },
          { label: "Columns", act: () => insertColumn() },
        ] },
        { label: "Format", submenu: [
          { label: "Cells…", act: () => cellsDialog() },
        ] },
      ]);

      const win = window.WM.createWindow({
        id: winId,
        title: fileName() + " — Excel",
        icon: "excel",
        width: 760, height: 520,
        x: opts.x, y: opts.y,
        persistKey: "excel:" + path,
        content: (body) => {
          body.style.padding = "0";
          body.appendChild(menuBar);
          body.appendChild(toolbar);
          body.appendChild(root);
          body.appendChild(statusBar);
          renderGrid();
        },
      });

      // ---------- render ----------
      function renderGrid() {
        table.innerHTML = "";
        // header row
        const thead = document.createElement("thead");
        const trh = document.createElement("tr");
        const th0 = document.createElement("th");
        th0.className = "corner";
        th0.textContent = "";
        trh.appendChild(th0);
        for (let c = 0; c < COLS; c++) {
          const th = document.createElement("th");
          th.className = "col";
          th.textContent = colLabel(c);
          trh.appendChild(th);
        }
        thead.appendChild(trh);
        table.appendChild(thead);
        const tbody = document.createElement("tbody");
        for (let r = 0; r < ROWS; r++) {
          const tr = document.createElement("tr");
          const rh = document.createElement("th");
          rh.className = "row";
          rh.textContent = String(r + 1);
          tr.appendChild(rh);
          for (let c = 0; c < COLS; c++) {
            const td = document.createElement("td");
            const ref = colLabel(c) + (r + 1);
            td.className = "cell";
            td.dataset.ref = ref;
            const cell = getCell(ref);
            if (cell) {
              const display = computeCell(ref);
              td.textContent = display;
              if (isFormula(cell.value)) td.classList.add("is-formula");
              if (cell.bold) td.style.fontWeight = "700";
              if (cell.italic) td.style.fontStyle = "italic";
              td.style.textAlign = cell.align || (isFormula(cell.value) ? "right" : "left");
              td.style.color = (display + "").startsWith("#") ? "#a00" : "#000";
            }
            if (ref === curCell) td.classList.add("is-active");
            else if (range && refInRange(ref, range)) td.classList.add("is-range");
            td.addEventListener("mousedown", (e) => {
              if (e.shiftKey && range) {
                const start = parseRef(range.r1 + ":" + range.c1) || { r: r, c: c };
                range = { r1: start.r, c1: start.c, r2: r, c2: c };
              } else {
                range = null;
                setCur(ref, false);
              }
              renderGrid();
              e.preventDefault();
            });
            td.addEventListener("mouseover", (e) => {
              if (e.buttons === 1) {
                if (range) {
                  range.r2 = r; range.c2 = c;
                  renderGrid();
                }
              }
            });
            td.addEventListener("dblclick", () => startEditing());
            tr.appendChild(td);
          }
          tbody.appendChild(tr);
        }
        table.appendChild(tbody);
        nameBox.textContent = curCell;
        updateFormula();
        updateStatus();
      }

      function refInRange(ref, r) {
        const p = parseRef(ref);
        if (!p) return false;
        const minR = Math.min(r.r1, r.r2), maxR = Math.max(r.r1, r.r2);
        const minC = Math.min(r.c1, r.c2), maxC = Math.max(r.c1, r.c2);
        return p.r >= minR && p.r <= maxR && p.c >= minC && p.c <= maxC;
      }

      function setCur(ref, start) {
        curCell = ref;
        if (start) startEditing();
        else { updateFormula(); updateStatus(); }
      }

      function updateFormula() {
        const c = getCell(curCell);
        formulaInput.value = c ? c.value : "";
        editBuf = formulaInput.value;
      }

      function startEditing(initial) {
        if (editing) return;
        editing = true;
        editBuf = initial != null ? initial : (getCell(curCell)?.value || "");
        formulaInput.value = editBuf;
        formulaInput.focus();
        formulaInput.select();
        document.getElementById("of-stat-ready").textContent = "Edit";
      }

      function commitEdit() {
        if (!editing) return;
        const v = editBuf;
        if (v === "") delete curSheet.cells[curCell];
        else curSheet.cells[curCell] = { value: v, format: curSheet.cells[curCell]?.format || "general" };
        editing = false;
        isDirty = true; updateTitle();
        renderGrid();
        document.getElementById("of-stat-ready").textContent = "Ready";
      }
      function cancelEdit() {
        editing = false;
        updateFormula();
        document.getElementById("of-stat-ready").textContent = "Ready";
      }

      function moveTo(ref) {
        if (!ref) return;
        if (ref.r < 0 || ref.r >= ROWS || ref.c < 0 || ref.c >= COLS) return;
        curCell = colLabel(ref.c) + (ref.r + 1);
        renderGrid();
        // scroll into view
        const td = table.querySelector(`td[data-ref="${curCell}"]`);
        if (td) td.scrollIntoView({ block: "nearest", inline: "nearest" });
      }
      function relRef(ref, dRow, dCol) {
        const p = parseRef(ref);
        return { r: p.r + dRow, c: p.c + dCol };
      }

      // keyboard
      document.addEventListener("keydown", (e) => {
        if (!win.el.contains(document.activeElement) && !win.el.matches(":hover")) {
          // no-op when not focused
        }
        // capture global shortcuts when excel window focused
        if (!win.el.contains(document.activeElement)) return;
        if (editing) return;
        const p = parseRef(curCell);
        if (e.key === "ArrowDown") { e.preventDefault(); moveTo({ r: p.r + 1, c: p.c }); }
        else if (e.key === "ArrowUp") { e.preventDefault(); moveTo({ r: p.r - 1, c: p.c }); }
        else if (e.key === "ArrowRight") { e.preventDefault(); moveTo({ r: p.r, c: p.c + 1 }); }
        else if (e.key === "ArrowLeft") { e.preventDefault(); moveTo({ r: p.r, c: p.c - 1 }); }
        else if (e.key === "Tab") { e.preventDefault(); moveTo({ r: p.r, c: p.c + (e.shiftKey ? -1 : 1) }); }
        else if (e.key === "Enter") {
          if (e.shiftKey) { e.preventDefault(); moveTo({ r: p.r - 1, c: p.c }); }
          else { e.preventDefault(); startEditing(); }
        }
        else if (e.key === "F2") { e.preventDefault(); startEditing(); }
        else if (e.key === "Delete" || e.key === "Backspace") { e.preventDefault(); clearCell(); }
        else if (e.key === "Escape") { range = null; renderGrid(); }
        else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") { e.preventDefault(); fileSave(); }
        else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "b") { e.preventDefault(); toggleCellFormat("bold"); }
        else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "i") { e.preventDefault(); toggleCellFormat("italic"); }
        else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
          // typing starts editing and replaces
          if (document.activeElement === document.body || win.el.contains(document.activeElement)) {
            e.preventDefault();
            startEditing(e.key);
          }
        }
      });

      function clearCell() {
        delete curSheet.cells[curCell];
        isDirty = true; updateTitle();
        renderGrid();
      }
      function curCellBold() {
        const c = getCell(curCell); return !!(c && c.bold);
      }
      function curCellFormat() {
        const c = getCell(curCell); return c?.format || "general";
      }
      function toggleCellFormat(kind) {
        const c = getCell(curCell) || (curSheet.cells[curCell] = { value: "", format: "general" });
        if (kind === "bold") c.bold = !c.bold;
        if (kind === "italic") c.italic = !c.italic;
        isDirty = true; updateTitle();
        renderGrid();
      }
      function setAlign(a) {
        const c = getCell(curCell) || (curSheet.cells[curCell] = { value: "", format: "general" });
        c.align = a;
        isDirty = true; updateTitle();
        renderGrid();
      }
      function insertRow() {
        // shift cells down at current row
        const p = parseRef(curCell);
        const old = curSheet.cells;
        const next = {};
        for (const ref in old) {
          const pp = parseRef(ref);
          if (pp.r >= p.r) next[colLabel(pp.c) + (pp.r + 2)] = old[ref];
          else next[ref] = old[ref];
        }
        curSheet.cells = next;
        isDirty = true; updateTitle();
        renderGrid();
      }
      function insertColumn() {
        const p = parseRef(curCell);
        const old = curSheet.cells;
        const next = {};
        for (const ref in old) {
          const pp = parseRef(ref);
          if (pp.c >= p.c) next[colLabel(pp.c + 1) + (pp.r + 1)] = old[ref];
          else next[ref] = old[ref];
        }
        curSheet.cells = next;
        isDirty = true; updateTitle();
        renderGrid();
      }
      function copyRangeToClipboard(cut) {
        const r = range || { r1: parseRef(curCell).r, c1: parseRef(curCell).c, r2: parseRef(curCell).r, c2: parseRef(curCell).c };
        const minR = Math.min(r.r1, r.r2), maxR = Math.max(r.r1, r.r2);
        const minC = Math.min(r.c1, r.c2), maxC = Math.max(r.c1, r.c2);
        let text = "";
        for (let rr = minR; rr <= maxR; rr++) {
          for (let cc = minC; cc <= maxC; cc++) {
            const ref = colLabel(cc) + (rr + 1);
            const cell = getCell(ref);
            text += cell ? (isFormula(cell.value) ? computeCell(ref) : cell.value) : "";
            if (cc < maxC) text += "\t";
          }
          if (rr < maxR) text += "\n";
        }
        window.Clipboard.setText(text);
        if (cut) {
          for (let rr = minR; rr <= maxR; rr++) {
            for (let cc = minC; cc <= maxC; cc++) {
              delete curSheet.cells[colLabel(cc) + (rr + 1)];
            }
          }
          isDirty = true; updateTitle();
          renderGrid();
        }
      }
      async function pasteFromClipboard() {
        const text = await window.Clipboard.getText();
        if (!text) return;
        const lines = text.split(/\r?\n/);
        const p = parseRef(curCell);
        for (let i = 0; i < lines.length; i++) {
          const parts = lines[i].split("\t");
          for (let j = 0; j < parts.length; j++) {
            const ref = colLabel(p.c + j) + (p.r + i + 1);
            if (parts[j] !== "") {
              curSheet.cells[ref] = { value: parts[j], format: "general" };
            }
          }
        }
        isDirty = true; updateTitle();
        renderGrid();
      }
      function findInGrid() {
        const q = prompt("Find:");
        if (!q) return;
        const ql = q.toLowerCase();
        for (const ref in curSheet.cells) {
          const v = computeCell(ref);
          if ((v + "").toLowerCase().includes(ql)) {
            curCell = ref;
            renderGrid();
            const td = table.querySelector(`td[data-ref="${ref}"]`);
            if (td) td.scrollIntoView({ block: "center" });
            return;
          }
        }
        alert("Not found: " + q);
      }
      function cellsDialog() {
        const c = getCell(curCell) || (curSheet.cells[curCell] = { value: "", format: "general" });
        const format = prompt("Number format (general, number, currency, percent, date):", c.format || "general");
        if (format) {
          c.format = format;
          isDirty = true; updateTitle();
          renderGrid();
        }
      }

      function updateStatus() {
        const nums = [];
        const r = range || (() => { const p = parseRef(curCell); return { r1: p.r, c1: p.c, r2: p.r, c2: p.c }; })();
        const minR = Math.min(r.r1, r.r2), maxR = Math.max(r.r1, r.r2);
        const minC = Math.min(r.c1, r.c2), maxC = Math.max(r.c1, r.c2);
        for (let rr = minR; rr <= maxR; rr++) {
          for (let cc = minC; cc <= maxC; cc++) {
            const v = computeCell(colLabel(cc) + (rr + 1));
            const n = Number(v);
            if (isFinite(n) && v !== "") nums.push(n);
          }
        }
        const sum = nums.reduce((a, b) => a + b, 0);
        const avg = nums.length ? sum / nums.length : 0;
        const el1 = document.getElementById("of-stat-sum");
        const el2 = document.getElementById("of-stat-avg");
        const el3 = document.getElementById("of-stat-count");
        if (el1) el1.textContent = "Sum = " + (nums.length ? sum : 0);
        if (el2) el2.textContent = "Average = " + (nums.length ? Math.round(avg * 100) / 100 : 0);
        if (el3) el3.textContent = "Count = " + nums.length;
      }
      function updateTitle() {
        win.setTitle((isDirty ? "* " : "") + fileName() + " — Excel");
      }

      // ---------- file ops ----------
      function fileNew() {
        book = DEFAULT_BOOK();
        curSheet = book.sheets[0];
        curCell = "A1";
        path = "/C:/My Documents/Book" + Date.now() + ".xls";
        isDirty = false;
        win.persistKey = "excel:" + path;
        renderGrid();
        updateTitle();
      }
      function fileOpen() {
        const cur = prompt("Open (virtual path):", path);
        if (!cur) return;
        const clean = cur.startsWith("/") ? cur : "/C:/My Documents/" + cur;
        if (!window.FS.exists(clean)) { alert("File not found: " + clean); return; }
        book = loadBook(clean);
        curSheet = book.sheets[0];
        curCell = "A1";
        path = clean; isDirty = false;
        win.persistKey = "excel:" + path;
        renderGrid();
        updateTitle();
      }
      function fileSave() {
        if (window.FS.write(path, JSON.stringify(book, null, 2), "application/json")) {
          isDirty = false; updateTitle();
        }
      }
      function fileSaveAs() {
        const next = prompt("Save as (virtual path):", path);
        if (!next) return;
        const clean = next.startsWith("/") ? next : "/C:/My Documents/" + next.replace(/[^\w. -]/g, "_");
        if (window.FS.write(clean, JSON.stringify(book, null, 2), "application/json")) {
          path = clean; isDirty = false; win.persistKey = "excel:" + path;
          updateTitle();
        }
      }

      function loadBook(p, state) {
        if (state && state.sheets) return state;
        const raw = window.FS.readText(p);
        if (!raw) return DEFAULT_BOOK();
        try {
          const parsed = JSON.parse(raw);
          if (parsed && parsed.sheets) return parsed;
        } catch {}
        return DEFAULT_BOOK();
      }

      win.getAppState = () => ({ path, book });
      win.app = "excel";
      win.onClose = () => {
        if (isDirty && confirm("Save changes to " + fileName() + "?")) fileSave();
      };
      return win;
    },
  };

  window.ExcelApp = app;
})();