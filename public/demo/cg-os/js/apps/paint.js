/* ============================================================
   Paint — basic canvas drawing (pencil, line, rect, fill, eraser).
   ============================================================ */

(function () {
  "use strict";

  const COLORS = [
    "#000", "#808080", "#800000", "#808000", "#008000", "#008080", "#000080", "#800080",
    "#fff", "#c0c0c0", "#ff0000", "#ffff00", "#00ff00", "#00ffff", "#0000ff", "#ff00ff",
    "#404040", "#a0a0a0", "#ff8000", "#ffff80", "#80ff80", "#80ffff", "#8080ff", "#ff80ff",
    "#a06030", "#f0c0a0", "#80ff00", "#a0e0ff", "#600000", "#000040", "#202020", "#e0e0e0",
  ];

  const TOOLS = ["pencil", "line", "rect", "rect-fill", "fill", "eraser"];

  const app = {
    id: "paint",
    name: "Paint",
    icon: "paint",
    category: "utility",

    launch(opts = {}) {
      const winId = "paint_" + Date.now();
      const state = Object.assign({
        color: "#000",
        tool: "pencil",
        lineWidth: 2,
        fillColor: "#ffffff",
      }, opts.state || {});

      const W = 480, H = 320;
      const canvas = document.createElement("canvas");
      canvas.className = "paint-canvas";
      canvas.width = W;
      canvas.height = H;

      const wrap = document.createElement("div");
      wrap.className = "paint";
      const tb = document.createElement("div");
      tb.className = "paint-toolbar";
      const canvasWrap = document.createElement("div");
      canvasWrap.className = "paint-canvas-wrap";
      const colorRow = document.createElement("div");
      colorRow.className = "paint-color-row";

      wrap.appendChild(tb);
      wrap.appendChild(canvasWrap);
      wrap.appendChild(colorRow);
      canvasWrap.appendChild(canvas);

      // tools
      const toolBtns = {};
      TOOLS.forEach((t) => {
        const b = document.createElement("button");
        b.className = "toolbar-btn";
        b.title = t;
        b.textContent = iconForTool(t);
        b.addEventListener("click", () => {
          state.tool = t;
          for (const k in toolBtns) toolBtns[k].classList.remove("is-default");
          b.classList.add("is-default");
        });
        toolBtns[t] = b;
        tb.appendChild(b);
      });
      toolBtns[state.tool]?.classList.add("is-default");
      // sep
      const sep = document.createElement("div"); sep.className = "toolbar-sep"; tb.appendChild(sep);
      // size
      const sizeLbl = document.createElement("span"); sizeLbl.textContent = "Size:"; tb.appendChild(sizeLbl);
      const sizeSel = document.createElement("select");
      sizeSel.className = "field";
      [1, 2, 4, 6, 10, 16].forEach((n) => {
        const o = document.createElement("option"); o.textContent = String(n); o.value = String(n);
        if (n === state.lineWidth) o.selected = true;
        sizeSel.appendChild(o);
      });
      sizeSel.addEventListener("change", () => state.lineWidth = Number(sizeSel.value));
      tb.appendChild(sizeSel);
      // sep
      const sep2 = document.createElement("div"); sep2.className = "toolbar-sep"; tb.appendChild(sep2);
      // clear
      const clearBtn = document.createElement("button");
      clearBtn.className = "btn"; clearBtn.textContent = "Clear";
      clearBtn.addEventListener("click", () => {
        const ctx = canvas.getContext("2d");
        ctx.fillStyle = "#fff";
        ctx.fillRect(0, 0, W, H);
        saveState();
      });
      tb.appendChild(clearBtn);
      // save PNG
      const saveBtn = document.createElement("button");
      saveBtn.className = "btn"; saveBtn.textContent = "Save PNG";
      saveBtn.addEventListener("click", () => {
        const a = document.createElement("a");
        a.download = "paint-" + Date.now() + ".png";
        a.href = canvas.toDataURL("image/png");
        a.click();
      });
      tb.appendChild(saveBtn);
      // save to FS
      const saveFsBtn = document.createElement("button");
      saveFsBtn.className = "btn"; saveFsBtn.textContent = "Save to FS";
      saveFsBtn.addEventListener("click", () => {
        const name = prompt("Filename (in /C:/Pictures/):", "Drawing-" + Date.now() + ".png");
        if (!name) return;
        const path = "/C:/Pictures/" + name.replace(/[^\w. -]/g, "_");
        window.FS.write(path, canvas.toDataURL("image/png"), "image/png");
      });
      tb.appendChild(saveFsBtn);

      // colors
      COLORS.forEach((c, i) => {
        const sw = document.createElement("div");
        sw.className = "paint-swatch" + (state.color === c ? " active" : "");
        sw.style.background = c;
        sw.title = c;
        sw.addEventListener("click", () => {
          state.color = c;
          colorRow.querySelectorAll(".paint-swatch").forEach((x) => x.classList.remove("active"));
          sw.classList.add("active");
        });
        colorRow.appendChild(sw);
      });
      // fill color
      const fillLabel = document.createElement("span");
      fillLabel.textContent = " Fill:";
      colorRow.appendChild(fillLabel);
      const fillSw = document.createElement("div");
      fillSw.className = "paint-swatch";
      fillSw.style.background = state.fillColor;
      fillSw.addEventListener("click", () => {
        const c = prompt("Fill color (#hex):", state.fillColor);
        if (!c) return;
        state.fillColor = c;
        fillSw.style.background = c;
      });
      colorRow.appendChild(fillSw);

      // initial fill white
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, W, H);

      // restore from state.image (dataURL)
      if (opts.state?.image) {
        const img = new Image();
        img.onload = () => ctx.drawImage(img, 0, 0, W, H);
        img.src = opts.state.image;
      }

      // drawing
      let drawing = false;
      let lastX = 0, lastY = 0;
      let snapshot = null;

      canvas.addEventListener("mousedown", (e) => {
        const r = canvas.getBoundingClientRect();
        const sx = canvas.width / r.width;
        const sy = canvas.height / r.height;
        lastX = (e.clientX - r.left) * sx;
        lastY = (e.clientY - r.top) * sy;
        if (state.tool === "fill") {
          floodFill(ctx, Math.floor(lastX), Math.floor(lastY), state.color);
          saveState();
          return;
        }
        if (state.tool !== "fill") {
          // snapshot for line/rect preview
          snapshot = ctx.getImageData(0, 0, canvas.width, canvas.height);
        }
        drawing = true;
        if (state.tool === "pencil" || state.tool === "eraser") {
          drawDot(ctx, lastX, lastY);
        }
      });
      canvas.addEventListener("mousemove", (e) => {
        if (!drawing) return;
        const r = canvas.getBoundingClientRect();
        const sx = canvas.width / r.width;
        const sy = canvas.height / r.height;
        const x = (e.clientX - r.left) * sx;
        const y = (e.clientY - r.top) * sy;
        if (state.tool === "pencil" || state.tool === "eraser") {
          drawLine(ctx, lastX, lastY, x, y, state.tool === "eraser" ? "#fff" : state.color, state.lineWidth);
          lastX = x; lastY = y;
        } else if (state.tool === "line" || state.tool === "rect" || state.tool === "rect-fill") {
          ctx.putImageData(snapshot, 0, 0);
          if (state.tool === "line") drawLine(ctx, lastX, lastY, x, y, state.color, state.lineWidth);
          else if (state.tool === "rect") drawRect(ctx, lastX, lastY, x, y, state.color, state.lineWidth);
          else drawRectFill(ctx, lastX, lastY, x, y, state.color, state.fillColor);
        }
      });
      canvas.addEventListener("mouseup", () => {
        if (drawing) saveState();
        drawing = false; snapshot = null;
      });
      canvas.addEventListener("mouseleave", () => { if (drawing) saveState(); drawing = false; });

      function drawDot(ctx, x, y) {
        ctx.fillStyle = state.tool === "eraser" ? "#fff" : state.color;
        ctx.beginPath();
        ctx.arc(x, y, state.lineWidth / 2, 0, Math.PI * 2);
        ctx.fill();
      }
      function drawLine(ctx, x1, y1, x2, y2, color, w) {
        ctx.strokeStyle = color;
        ctx.lineWidth = w;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
      }
      function drawRect(ctx, x1, y1, x2, y2, color, w) {
        ctx.strokeStyle = color;
        ctx.lineWidth = w;
        ctx.strokeRect(Math.min(x1, x2), Math.min(y1, y2), Math.abs(x2 - x1), Math.abs(y2 - y1));
      }
      function drawRectFill(ctx, x1, y1, x2, y2, stroke, fill) {
        ctx.fillStyle = fill;
        ctx.fillRect(Math.min(x1, x2), Math.min(y1, y2), Math.abs(x2 - x1), Math.abs(y2 - y1));
        ctx.strokeStyle = stroke;
        ctx.lineWidth = state.lineWidth;
        ctx.strokeRect(Math.min(x1, x2), Math.min(y1, y2), Math.abs(x2 - x1), Math.abs(y2 - y1));
      }
      function floodFill(ctx, x, y, fillColor) {
        x = Math.floor(x); y = Math.floor(y);
        const w = ctx.canvas.width, h = ctx.canvas.height;
        const data = ctx.getImageData(0, 0, w, h);
        const target = getPixel(data, x, y);
        const replacement = parseColor(fillColor);
        if (colorsMatch(target, replacement)) return;
        const stack = [[x, y]];
        while (stack.length) {
          const [cx, cy] = stack.pop();
          if (cx < 0 || cy < 0 || cx >= w || cy >= h) continue;
          const idx = (cy * w + cx) * 4;
          const cur = [data.data[idx], data.data[idx + 1], data.data[idx + 2], data.data[idx + 3]];
          if (!colorsMatch(cur, target)) continue;
          data.data[idx] = replacement[0];
          data.data[idx + 1] = replacement[1];
          data.data[idx + 2] = replacement[2];
          data.data[idx + 3] = 255;
          stack.push([cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]);
        }
        ctx.putImageData(data, 0, 0);
      }
      function getPixel(data, x, y) {
        const i = (y * data.width + x) * 4;
        return [data.data[i], data.data[i + 1], data.data[i + 2], data.data[i + 3]];
      }
      function parseColor(c) {
        const div = document.createElement("div");
        div.style.color = c;
        document.body.appendChild(div);
        const cs = getComputedStyle(div).color;
        document.body.removeChild(div);
        const m = cs.match(/(\d+)\D+(\d+)\D+(\d+)/);
        return m ? [+m[1], +m[2], +m[3], 255] : [0, 0, 0, 255];
      }
      function colorsMatch(a, b) {
        return a[0] === b[0] && a[1] === b[1] && a[2] === b[2];
      }

      function saveState() {
        win.getAppState = () => ({
          color: state.color, tool: state.tool, lineWidth: state.lineWidth, fillColor: state.fillColor,
          image: canvas.toDataURL("image/png"),
        });
      }
      const win = window.WM.createWindow({
        id: winId,
        title: "untitled — Paint",
        icon: "paint",
        width: 560, height: 460,
        x: opts.x, y: opts.y,
        persistKey: "paint",
        content: (body) => {
          body.style.padding = "0";
          body.appendChild(wrap);
        },
      });
      win.app = "paint";
      saveState();
      return win;
    },
  };

  function iconForTool(t) {
    return ({
      pencil: "✎",
      line: "╱",
      rect: "▭",
      "rect-fill": "▣",
      fill: "◉",
      eraser: "⌫",
    })[t] || "?";
  }

  window.PaintApp = app;
})();