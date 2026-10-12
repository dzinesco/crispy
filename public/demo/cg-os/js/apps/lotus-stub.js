/* ============================================================
   Lotus stub — a tiny spreadsheet with formula support and
   amber-on-black CRT vibe.
   ============================================================ */

(function () {
  "use strict";

  const ROWS = 24, COLS = 12;
  const CELL_W = 56, CELL_H = 18;

  const app = {
    id: "lotus",
    name: "Lotus 1-2-3",
    icon: "lotus",
    category: "demo",

    launch(opts = {}) {
      const winId = "lotus_" + Date.now();
      const data = Array.from({ length: ROWS }, () => Array(COLS).fill(""));
      const display = Array.from({ length: ROWS }, () => Array(COLS).fill(""));
      Object.assign(data, opts.state?.data || {});
      let curR = 0, curC = 0;
      let editing = false;
      let editBuf = "";

      const W = 600, H = 360;
      const canvas = document.createElement("canvas");
      canvas.width = W;
      canvas.height = H;
      canvas.style.width = "100%";
      canvas.style.height = "100%";

      const screen = document.createElement("div");
      screen.style.cssText = `
        background: #000; padding: 6px; border-radius: 8px;
        border: 4px solid #404000;
        box-shadow: 0 0 16px rgba(255, 176, 0, 0.4);
      `;
      screen.appendChild(canvas);

      const bar = document.createElement("div");
      bar.style.cssText = `
        font-family: "VT323", monospace;
        font-size: 18px;
        color: #ffb000;
        background: #1a0a00;
        padding: 4px 8px;
        margin-bottom: 4px;
        display: flex;
        justify-content: space-between;
      `;
      const cellLabel = document.createElement("span");
      const formulaLabel = document.createElement("span");
      cellLabel.textContent = "A1";
      formulaLabel.textContent = "";
      bar.appendChild(cellLabel);
      bar.appendChild(formulaLabel);

      const stub = document.createElement("div");
      stub.className = "stub";
      stub.style.background = "#000";
      stub.insertBefore(bar, stub.firstChild);
      stub.appendChild(screen);

      const ctx = canvas.getContext("2d");

      const formulaInput = document.createElement("input");
      formulaInput.style.cssText = `
        width: 100%; box-sizing: border-box;
        font-family: "VT323", monospace; font-size: 18px;
        background: #1a0a00; color: #ffb000;
        border: 1px solid #ffb000; padding: 2px 6px;
        margin-top: 4px;
      `;
      formulaInput.addEventListener("keydown", onKey);
      stub.appendChild(formulaInput);

      function colLabel(c) {
        let s = "";
        let n = c;
        while (true) { s = String.fromCharCode(65 + (n % 26)) + s; n = Math.floor(n / 26) - 1; if (n < 0) break; }
        return s;
      }

      function recompute() {
        for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
          const v = data[r][c];
          if (typeof v === "string" && v.startsWith("=")) {
            display[r][c] = evalFormula(v.slice(1));
          } else {
            display[r][c] = v ?? "";
          }
        }
        render();
      }

      function evalFormula(f) {
        try {
          // expand cell refs
          const expanded = f.replace(/([A-Z]+)(\d+)/g, (m, col, row) => {
            const ci = colToIdx(col); const ri = parseInt(row, 10) - 1;
            const v = display[ri]?.[ci] ?? "";
            const n = Number(v);
            return isFinite(n) && v !== "" ? String(n) : "0";
          });
          // eslint-disable-next-line no-new-func
          const result = Function(`"use strict"; return (${expanded});`)();
          if (isFinite(result)) return String(Math.round(result * 100) / 100);
          return "#ERR";
        } catch (e) { return "#ERR"; }
      }

      function colToIdx(col) {
        let n = 0;
        for (const ch of col) n = n * 26 + (ch.charCodeAt(0) - 64);
        return n - 1;
      }

      function onKey(e) {
        const k = e.key;
        if (editing) {
          if (k === "Enter") {
            data[curR][curC] = editBuf;
            editing = false; editBuf = "";
            curR = Math.min(ROWS - 1, curR + 1);
            updateLabels(); recompute();
          } else if (k === "Escape") {
            editing = false; editBuf = "";
            updateLabels();
          } else if (k === "Backspace") {
            editBuf = editBuf.slice(0, -1);
            updateLabels();
          } else if (k.length === 1) {
            editBuf += k;
            updateLabels();
          }
          e.preventDefault();
          return;
        }
        if (k === "ArrowUp") { curR = Math.max(0, curR - 1); updateLabels(); }
        else if (k === "ArrowDown") { curR = Math.min(ROWS - 1, curR + 1); updateLabels(); }
        else if (k === "ArrowLeft") { curC = Math.max(0, curC - 1); updateLabels(); }
        else if (k === "ArrowRight") { curC = Math.min(COLS - 1, curC + 1); updateLabels(); }
        else if (k === "Tab") { curC = (curC + 1) % COLS; updateLabels(); e.preventDefault(); }
        else if (k === "Enter" || k === "F2") {
          editing = true; editBuf = String(data[curR][curC] ?? "");
          updateLabels();
        } else if (k === "Delete" || k === "Backspace") {
          data[curR][curC] = "";
          recompute();
        }
      }

      canvas.tabIndex = 0;
      canvas.addEventListener("keydown", onKey);
      canvas.addEventListener("mousedown", (e) => {
        canvas.focus();
        const r = canvas.getBoundingClientRect();
        const sx = canvas.width / r.width, sy = canvas.height / r.height;
        const x = (e.clientX - r.left) * sx;
        const y = (e.clientY - r.top) * sy;
        const c = Math.floor((x - 28) / CELL_W);
        const rr = Math.floor((y - 16) / CELL_H);
        if (c >= 0 && c < COLS && rr >= 0 && rr < ROWS) {
          curC = c; curR = rr; editing = false; editBuf = ""; updateLabels();
        }
      });

      function updateLabels() {
        cellLabel.textContent = `${colLabel(curC)}${curR + 1}`;
        formulaLabel.textContent = editing ? editBuf : String(data[curR][curC] ?? "");
      }

      function render() {
        ctx.fillStyle = "#000";
        ctx.fillRect(0, 0, W, H);

        ctx.font = "13px 'Share Tech Mono', monospace";
        ctx.textBaseline = "middle";

        // column letters
        ctx.fillStyle = "#ffb000";
        ctx.textAlign = "right";
        for (let c = 0; c < COLS; c++) {
          ctx.fillStyle = c === curC ? "#ffffff" : "#ffb000";
          ctx.fillText(colLabel(c), 24, 8);
        }

        // row numbers
        for (let r = 0; r < ROWS; r++) {
          ctx.fillStyle = r === curR ? "#ffffff" : "#ffb000";
          ctx.textAlign = "right";
          ctx.fillText(String(r + 1), 24, 16 + r * CELL_H + CELL_H / 2);
        }

        // grid lines
        ctx.strokeStyle = "#806000";
        ctx.lineWidth = 1;
        for (let r = 0; r <= ROWS; r++) {
          ctx.beginPath();
          ctx.moveTo(28, 16 + r * CELL_H);
          ctx.lineTo(W, 16 + r * CELL_H);
          ctx.stroke();
        }
        for (let c = 0; c <= COLS; c++) {
          ctx.beginPath();
          ctx.moveTo(28 + c * CELL_W, 16);
          ctx.lineTo(28 + c * CELL_W, H);
          ctx.stroke();
        }

        // cell content
        ctx.textAlign = "left";
        for (let r = 0; r < ROWS; r++) {
          for (let c = 0; c < COLS; c++) {
            const val = display[r][c] ?? "";
            const isCur = r === curR && c === curC;
            ctx.fillStyle = isCur ? "#000" : "#ffb000";
            if (isCur) {
              ctx.fillRect(28 + c * CELL_W + 1, 16 + r * CELL_H + 1, CELL_W - 2, CELL_H - 2);
              ctx.fillStyle = "#ffb000";
            }
            const text = String(val);
            const max = Math.floor((CELL_W - 6) / 8);
            const clipped = text.length > max ? text.slice(0, max - 1) + "…" : text;
            ctx.fillText(clipped, 28 + c * CELL_W + 4, 16 + r * CELL_H + CELL_H / 2);
          }
        }
      }

      recompute();
      updateLabels();

      const win = window.WM.createWindow({
        id: winId,
        title: "Lotus 1-2-3",
        icon: "lotus",
        width: 620, height: 460,
        x: opts.x, y: opts.y,
        persistKey: "lotus-stub",
        content: (body) => {
          body.style.padding = "0";
          body.appendChild(stub);
          setTimeout(() => canvas.focus(), 0);
        },
      });
      win.getAppState = () => ({ data });
      win.app = "lotus";
      return win;
    },
  };

  window.LotusStubApp = app;
})();