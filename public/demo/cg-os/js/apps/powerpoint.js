/* ============================================================
   PowerPoint 2000 — slide editor.
   Model: { slides: [ { background, objects: [ { type, x, y, w, h, text|color|shape, ... } ] } ] }
   Each slide is rendered into a 640x360 canvas. Objects can be
   text boxes or shapes (rect / circle / triangle).
   Drag to move. Click to select. Double-click to edit.
   ============================================================ */

(function () {
  "use strict";

  const SLIDE_W = 640, SLIDE_H = 360;
  const FONT_SIZES = [10, 12, 14, 18, 24, 32, 40, 48, 60, 72];
  const SHAPE_COLORS = ["#ff0000", "#0000ff", "#00aa00", "#ffff00", "#ff00ff", "#00ffff", "#000000", "#ffffff"];

  function defaultDeck() {
    return {
      type: "pptx", version: 1,
      slides: [{
        background: "#ffffff",
        objects: [
          { type: "text", x: 80, y: 40, w: 480, h: 60, text: "Click to add title", size: 32, bold: true, align: "center" },
          { type: "text", x: 80, y: 240, w: 480, h: 80, text: "Click to add subtitle", size: 18, align: "center", color: "#555" },
        ],
      }],
    };
  }

  const app = {
    id: "powerpoint",
    name: "Microsoft PowerPoint",
    icon: "powerpoint",
    category: "office",

    launch(opts = {}) {
      const winId = "ppt_" + (opts.path || "untitled-" + Date.now()).replace(/[^\w. -]/g, "_");
      let path = opts.path || "/C:/My Documents/Presentation1.ppt";
      let isDirty = false;
      let deck = loadDeck(path, opts.state);
      let curSlide = 0;
      let selected = null; // { slideIdx, objIdx }

      const fileName = () => {
        const parts = (path || "").split("/").filter(Boolean);
        return parts[parts.length - 1] || "Untitled";
      };

      // ---------- DOM ----------
      const root = document.createElement("div");
      root.className = "ppt";

      const slidesHost = document.createElement("div");
      slidesHost.className = "ppt-slides";

      const stage = document.createElement("div");
      stage.className = "ppt-stage";

      const stageCanvas = document.createElement("div");
      stageCanvas.className = "ppt-stage-canvas";
      const slideEl = document.createElement("div");
      slideEl.className = "ppt-slide-canvas";
      stageCanvas.appendChild(slideEl);
      stage.appendChild(stageCanvas);

      const stageControls = document.createElement("div");
      stageControls.className = "ppt-stage-controls";
      stage.appendChild(stageControls);

      root.appendChild(slidesHost);
      root.appendChild(stage);

      const statusBar = OfficeChrome.buildPowerPointStatusBar();
      const toolbar = OfficeChrome.buildToolbar([
        [
          { type: "btn", title: "New", html: "🗋", act: () => fileNew() },
          { type: "btn", title: "Open", html: "📂", act: () => fileOpen() },
          { type: "btn", title: "Save", html: "💾", act: () => fileSave() },
        ],
        [
          { type: "btn", title: "Insert text box", html: "𝐓", act: () => insertText() },
          { type: "btn", title: "Insert rectangle", html: "▭", act: () => insertShape("rect") },
          { type: "btn", title: "Insert circle", html: "◯", act: () => insertShape("circle") },
          { type: "btn", title: "Insert triangle", html: "△", act: () => insertShape("triangle") },
        ],
        [
          { type: "label", text: "Color" },
          { type: "select", title: "Shape/text color", options: SHAPE_COLORS.map((c) => ({ value: c, label: c })),
            onChange: (v) => { setColor(v); } },
        ],
        [
          { type: "label", text: "Size" },
          { type: "select", title: "Font size", options: FONT_SIZES.map((s) => ({ value: s, label: s })),
            onChange: (v) => { setFontSize(+v); } },
        ],
        [
          { type: "btn", title: "Bold", html: "<b>B</b>", toggle: true, className: "bold",
            refreshState: () => ({ active: selObj()?.bold }),
            act: () => toggleBold() },
          { type: "btn", title: "Italic", html: "<i>I</i>", toggle: true,
            refreshState: () => ({ active: selObj()?.italic }),
            act: () => toggleItalic() },
        ],
        [
          { type: "btn", title: "Delete (Del)", html: "🗑", act: () => deleteSelected() },
        ],
        [
          { type: "btn", title: "Background color", html: "🎨", act: () => setBackground() },
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
          { label: "Undo", act: () => alert("Undo: not implemented in this demo.") },
          "-",
          { label: "Duplicate selection", act: () => duplicateSelected() },
          { label: "Delete selection", act: () => deleteSelected() },
        ] },
        { label: "Insert", submenu: [
          { label: "New Slide", shortcut: "Ctrl+M", act: () => addSlide() },
          { label: "Text Box", act: () => insertText() },
          { label: "Rectangle", act: () => insertShape("rect") },
          { label: "Circle", act: () => insertShape("circle") },
          { label: "Triangle", act: () => insertShape("triangle") },
        ] },
        { label: "Slide", submenu: [
          { label: "Next Slide", act: () => nextSlide() },
          { label: "Previous Slide", act: () => prevSlide() },
          { label: "Delete Slide", act: () => deleteSlide() },
        ] },
        { label: "Format", submenu: [
          { label: "Background…", act: () => setBackground() },
        ] },
      ]);

      const win = window.WM.createWindow({
        id: winId,
        title: fileName() + " — PowerPoint",
        icon: "powerpoint",
        width: 820, height: 560,
        x: opts.x, y: opts.y,
        persistKey: "ppt:" + path,
        content: (body) => {
          body.style.padding = "0";
          body.appendChild(menuBar);
          body.appendChild(toolbar);
          body.appendChild(root);
          body.appendChild(statusBar);
          // stage controls
          stageControls.innerHTML = "";
          const prevBtn = makeBtn("◀ Prev", prevSlide);
          const nextBtn = makeBtn("Next ▶", nextSlide);
          const newBtn = makeBtn("+ New Slide", addSlide);
          const space = document.createElement("div");
          space.className = "spacer";
          stageControls.appendChild(prevBtn);
          stageControls.appendChild(nextBtn);
          stageControls.appendChild(newBtn);
          stageControls.appendChild(space);
          renderAll();
        },
      });

      function makeBtn(label, fn) {
        const b = document.createElement("button");
        b.className = "btn";
        b.textContent = label;
        b.addEventListener("click", fn);
        return b;
      }

      // ---------- render ----------
      function renderAll() {
        renderSlideList();
        renderSlide();
        updateStatus();
        toolbar.refreshState();
      }

      function renderSlideList() {
        slidesHost.innerHTML = "";
        deck.slides.forEach((slide, i) => {
          const thumb = document.createElement("div");
          thumb.className = "ppt-slide-thumb" + (i === curSlide ? " is-active" : "");
          // mini-render slide contents scaled down
          const scaleX = 124 / SLIDE_W, scaleY = 78 / SLIDE_H;
          for (const o of slide.objects) {
            const min = document.createElement("div");
            min.style.position = "absolute";
            min.style.left = (o.x * scaleX) + "px";
            min.style.top = (o.y * scaleY) + "px";
            min.style.width = (o.w * scaleX) + "px";
            min.style.height = (o.h * scaleY) + "px";
            min.style.background = o.type === "text" ? "transparent" : (o.color || "#888");
            if (o.type === "text") {
              min.style.fontSize = Math.max(6, (o.size || 12) * scaleX) + "px";
              min.style.fontWeight = o.bold ? "700" : "400";
              min.style.color = o.color || "#000";
              min.style.display = "flex";
              min.style.alignItems = "center";
              min.style.justifyContent = "center";
              min.style.textAlign = "center";
              min.style.overflow = "hidden";
              min.textContent = o.text || "";
            } else if (o.shape === "circle") {
              min.style.borderRadius = "50%";
            } else if (o.shape === "triangle") {
              min.style.background = "transparent";
              min.style.width = "0px";
              min.style.height = "0px";
              min.style.borderLeft = ((o.w * scaleX) / 2) + "px solid transparent";
              min.style.borderRight = ((o.w * scaleX) / 2) + "px solid transparent";
              min.style.borderBottom = (o.h * scaleY) + "px solid " + (o.color || "#f00");
            }
            thumb.appendChild(min);
          }
          const num = document.createElement("div");
          num.className = "thumb-num";
          num.textContent = String(i + 1);
          thumb.appendChild(num);
          thumb.addEventListener("click", () => { curSlide = i; selected = null; renderAll(); });
          thumb.addEventListener("dblclick", () => { curSlide = i; renderAll(); });
          slidesHost.appendChild(thumb);
        });
      }

      function renderSlide() {
        const slide = deck.slides[curSlide];
        if (!slide) return;
        slideEl.innerHTML = "";
        slideEl.style.background = slide.background || "#fff";
        slide.objects.forEach((o, i) => {
          const el = document.createElement("div");
          el.className = "ppt-obj " + (o.type === "text" ? "text" : "shape " + o.shape);
          el.style.left = o.x + "px";
          el.style.top = o.y + "px";
          el.style.width = o.w + "px";
          el.style.height = o.h + "px";
          el.dataset.idx = i;
          if (o.type === "text") {
            el.style.fontSize = (o.size || 18) + "px";
            el.style.fontWeight = o.bold ? "700" : "400";
            el.style.fontStyle = o.italic ? "italic" : "normal";
            el.style.color = o.color || "#000";
            el.style.textAlign = o.align || "left";
            el.style.background = o.fill || "transparent";
            el.style.border = o.fill ? "1px solid #888" : "none";
            el.textContent = o.text || "";
          } else {
            el.style.background = o.color || "#888";
            if (o.shape === "circle") el.style.borderRadius = "50%";
            if (o.shape === "triangle") {
              el.style.background = "transparent";
              el.style.width = "0px";
              el.style.height = "0px";
              el.style.borderLeft = (o.w / 2) + "px solid transparent";
              el.style.borderRight = (o.w / 2) + "px solid transparent";
              el.style.borderBottom = o.h + "px solid " + (o.color || "#f00");
              el.style.left = o.x + "px";
              el.style.top = o.y + "px";
            }
          }
          if (selected && selected.slideIdx === curSlide && selected.objIdx === i) {
            el.classList.add("is-selected");
          }
          el.addEventListener("mousedown", (e) => {
            e.stopPropagation();
            selected = { slideIdx: curSlide, objIdx: i };
            renderSlide();
            beginDrag(o, el, e);
            toolbar.refreshState();
          });
          el.addEventListener("dblclick", (e) => {
            e.stopPropagation();
            editText(o, el);
          });
          slideEl.appendChild(el);
        });
        // click background to deselect
        slideEl.onmousedown = (e) => {
          if (e.target === slideEl) { selected = null; renderSlide(); toolbar.refreshState(); }
        };
      }

      function selObj() {
        if (!selected) return null;
        return deck.slides[selected.slideIdx]?.objects[selected.objIdx] || null;
      }

      function beginDrag(o, el, e) {
        const startX = e.clientX, startY = e.clientY;
        const ox = o.x, oy = o.y;
        function onMove(ev) {
          const dx = ev.clientX - startX, dy = ev.clientY - startY;
          o.x = Math.max(0, Math.min(SLIDE_W - o.w, ox + dx));
          o.y = Math.max(0, Math.min(SLIDE_H - o.h, oy + dy));
          el.style.left = o.x + "px";
          el.style.top = o.y + "px";
        }
        function onUp() {
          window.removeEventListener("mousemove", onMove);
          window.removeEventListener("mouseup", onUp);
          renderSlideList();
          isDirty = true; updateTitle();
        }
        window.addEventListener("mousemove", onMove);
        window.addEventListener("mouseup", onUp);
      }

      function editText(o, el) {
        if (o.type !== "text") return;
        const ta = document.createElement("textarea");
        ta.value = o.text || "";
        Object.assign(ta.style, {
          position: "absolute", left: o.x + "px", top: o.y + "px",
          width: o.w + "px", height: o.h + "px",
          fontFamily: "Tahoma, sans-serif",
          fontSize: (o.size || 18) + "px",
          fontWeight: o.bold ? "700" : "400",
          fontStyle: o.italic ? "italic" : "normal",
          color: o.color || "#000",
          background: "#fff",
          border: "2px solid #000",
          padding: "2px",
          resize: "none",
          zIndex: 10,
        });
        slideEl.appendChild(ta);
        ta.focus();
        ta.select();
        const finish = (commit) => {
          if (commit) { o.text = ta.value; isDirty = true; updateTitle(); }
          ta.remove();
          renderSlide();
          renderSlideList();
        };
        ta.addEventListener("blur", () => finish(true));
        ta.addEventListener("keydown", (e) => {
          if (e.key === "Escape") { e.preventDefault(); finish(false); }
          if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); finish(true); }
        });
      }

      // ---------- ops ----------
      function insertText() {
        const slide = deck.slides[curSlide];
        const text = prompt("Text:", "New Text");
        if (text == null) return;
        slide.objects.push({
          type: "text", x: 80, y: 80, w: 240, h: 60,
          text, size: 24, align: "left", color: "#000",
        });
        isDirty = true; updateTitle();
        renderAll();
      }
      function insertShape(shape) {
        const slide = deck.slides[curSlide];
        slide.objects.push({
          type: "shape", shape, x: 120, y: 80, w: 120, h: 120,
          color: SHAPE_COLORS[0],
        });
        isDirty = true; updateTitle();
        renderAll();
      }
      function addSlide() {
        deck.slides.splice(curSlide + 1, 0, { background: "#ffffff", objects: [] });
        curSlide++;
        isDirty = true; updateTitle();
        renderAll();
      }
      function deleteSlide() {
        if (deck.slides.length <= 1) { alert("Can't delete the only slide."); return; }
        if (!confirm("Delete slide " + (curSlide + 1) + "?")) return;
        deck.slides.splice(curSlide, 1);
        curSlide = Math.max(0, curSlide - 1);
        isDirty = true; updateTitle();
        renderAll();
      }
      function nextSlide() { if (curSlide < deck.slides.length - 1) { curSlide++; renderAll(); } }
      function prevSlide() { if (curSlide > 0) { curSlide--; renderAll(); } }
      function deleteSelected() {
        const s = selObj();
        if (!s) return;
        deck.slides[selected.slideIdx].objects.splice(selected.objIdx, 1);
        selected = null;
        isDirty = true; updateTitle();
        renderAll();
      }
      function duplicateSelected() {
        const slide = deck.slides[curSlide];
        if (!selected) return;
        const o = slide.objects[selected.objIdx];
        if (!o) return;
        const copy = JSON.parse(JSON.stringify(o));
        copy.x += 20; copy.y += 20;
        slide.objects.push(copy);
        isDirty = true; updateTitle();
        renderAll();
      }
      function setColor(c) {
        const o = selObj();
        if (!o) return;
        o.color = c;
        if (o.type === "shape" && o.shape === "triangle") {/* no-op */}
        isDirty = true; updateTitle();
        renderAll();
      }
      function setFontSize(s) {
        const o = selObj();
        if (!o || o.type !== "text") return;
        o.size = s;
        isDirty = true; updateTitle();
        renderAll();
      }
      function toggleBold() {
        const o = selObj();
        if (!o || o.type !== "text") return;
        o.bold = !o.bold;
        isDirty = true; updateTitle();
        renderAll();
      }
      function toggleItalic() {
        const o = selObj();
        if (!o || o.type !== "text") return;
        o.italic = !o.italic;
        isDirty = true; updateTitle();
        renderAll();
      }
      function setBackground() {
        const c = prompt("Slide background color (hex):", deck.slides[curSlide].background || "#ffffff");
        if (!c) return;
        deck.slides[curSlide].background = c;
        isDirty = true; updateTitle();
        renderAll();
      }

      function updateStatus() {
        const s1 = document.getElementById("of-stat-slide");
        if (s1) s1.textContent = "Slide " + (curSlide + 1) + " of " + deck.slides.length;
      }
      function updateTitle() {
        win.setTitle((isDirty ? "* " : "") + fileName() + " — PowerPoint");
      }

      // keyboard
      document.addEventListener("keydown", (e) => {
        if (!win.el.contains(document.activeElement)) return;
        if (e.key === "Escape") { selected = null; renderSlide(); }
        if (e.key === "Delete" || e.key === "Backspace") {
          if (selected) { e.preventDefault(); deleteSelected(); }
        }
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") { e.preventDefault(); fileSave(); }
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "m") { e.preventDefault(); addSlide(); }
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "n") { e.preventDefault(); fileNew(); }
        if (e.key === "PageDown") { e.preventDefault(); nextSlide(); }
        if (e.key === "PageUp") { e.preventDefault(); prevSlide(); }
      });

      // ---------- file ----------
      function fileNew() {
        deck = defaultDeck();
        curSlide = 0; selected = null;
        path = "/C:/My Documents/Presentation" + Date.now() + ".ppt";
        isDirty = false; win.persistKey = "ppt:" + path;
        updateTitle();
        renderAll();
      }
      function fileOpen() {
        const cur = prompt("Open (virtual path):", path);
        if (!cur) return;
        const clean = cur.startsWith("/") ? cur : "/C:/My Documents/" + cur;
        if (!window.FS.exists(clean)) { alert("File not found: " + clean); return; }
        deck = loadDeck(clean);
        curSlide = 0; selected = null; path = clean; isDirty = false;
        win.persistKey = "ppt:" + path;
        updateTitle(); renderAll();
      }
      function fileSave() {
        if (window.FS.write(path, JSON.stringify(deck, null, 2), "application/json")) {
          isDirty = false; updateTitle();
        }
      }
      function fileSaveAs() {
        const next = prompt("Save as (virtual path):", path);
        if (!next) return;
        const clean = next.startsWith("/") ? next : "/C:/My Documents/" + next.replace(/[^\w. -]/g, "_");
        if (window.FS.write(clean, JSON.stringify(deck, null, 2), "application/json")) {
          path = clean; isDirty = false; win.persistKey = "ppt:" + path;
          updateTitle();
        }
      }

      function loadDeck(p, state) {
        if (state && state.slides) return state;
        const raw = window.FS.readText(p);
        if (!raw) return defaultDeck();
        try {
          const parsed = JSON.parse(raw);
          if (parsed && parsed.slides) return parsed;
        } catch {}
        return defaultDeck();
      }

      win.getAppState = () => ({ path, deck });
      win.app = "powerpoint";
      win.onClose = () => {
        if (isDirty && confirm("Save changes to " + fileName() + "?")) fileSave();
      };
      return win;
    },
  };

  window.PowerPointApp = app;
})();