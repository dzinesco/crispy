/* ============================================================
   Word 2000 — paragraph-based rich text editor.
   Document model: { paragraphs: [ { align, runs: [{text, bold, italic, underline}] } ] }
   Renders into a contenteditable page; uses execCommand for
   formatting so the user gets familiar Ctrl+B/I/U behavior.
   ============================================================ */

(function () {
  "use strict";

  const FONT_FAMILIES = ["Times New Roman", "Arial", "Courier New", "Georgia", "Tahoma", "Verdana"];
  const FONT_SIZES = ["8", "9", "10", "11", "12", "14", "16", "18", "20", "24", "28", "36", "48", "72"];

  const DEFAULT_DOC = () => ({
    type: "word-doc", version: 1,
    paragraphs: [{ align: "left", runs: [{ text: "" }] }],
  });

  const app = {
    id: "word",
    name: "Microsoft Word",
    icon: "word",
    category: "office",

    launch(opts = {}) {
      const winId = "word_" + (opts.path || "untitled-" + Date.now()).replace(/[^\w. -]/g, "_");
      let path = opts.path || "/C:/My Documents/Untitled.doc";
      let isDirty = false;
      let doc = loadDoc(path, opts.state);

      const fileName = () => {
        const parts = (path || "").split("/").filter(Boolean);
        return parts[parts.length - 1] || "Untitled";
      };

      // ---------- DOM ----------
      const root = document.createElement("div");
      root.className = "word";
      const pagesHost = document.createElement("div");
      pagesHost.className = "word-pages";
      const page = document.createElement("div");
      page.className = "word-page";
      page.contentEditable = "true";
      page.spellcheck = false;
      pagesHost.appendChild(page);
      root.appendChild(pagesHost);

      const statusBar = OfficeChrome.buildWordStatusBar();
      const toolbar = OfficeChrome.buildToolbar([
        [
          { type: "btn", title: "New", html: "🗋", act: () => fileNew() },
          { type: "btn", title: "Open", html: "📂", act: () => fileOpen() },
          { type: "btn", title: "Save", html: "💾", act: () => fileSave() },
        ],
        [
          { type: "btn", title: "Print", html: "🖶", act: () => filePrint() },
          { type: "btn", title: "Print Preview", html: "🔍", act: () => filePrintPreview() },
        ],
        [
          { type: "btn", title: "Cut (Ctrl+X)", html: "✂", act: () => exec("cut") },
          { type: "btn", title: "Copy (Ctrl+C)", html: "⧉", act: () => exec("copy") },
          { type: "btn", title: "Paste (Ctrl+V)", html: "⎘", act: () => exec("paste") },
        ],
        [
          { type: "btn", title: "Undo (Ctrl+Z)", html: "↶", act: () => exec("undo") },
          { type: "btn", title: "Redo (Ctrl+Y)", html: "↷", act: () => exec("redo") },
        ],
        [
          { type: "label", text: "Font" },
          { type: "select", title: "Font family", options: FONT_FAMILIES.map((f) => ({ value: f, label: f, selected: f === "Times New Roman" })),
            onChange: (v) => { setFontFamily(v); refreshState(); } },
          { type: "select", title: "Font size", options: FONT_SIZES.map((s) => ({ value: s, label: s, selected: s === "12" })),
            onChange: (v) => { setFontSize(v); refreshState(); } },
        ],
        [
          { type: "btn", title: "Bold (Ctrl+B)", toggle: true, label: "B", html: "<b>B</b>", className: "bold",
            refreshState: () => ({ active: queryState("bold"), disabled: false }),
            act: () => { exec("bold"); refreshState(); } },
          { type: "btn", title: "Italic (Ctrl+I)", toggle: true, label: "I", html: "<i>I</i>",
            refreshState: () => ({ active: queryState("italic"), disabled: false }),
            act: () => { exec("italic"); refreshState(); } },
          { type: "btn", title: "Underline (Ctrl+U)", toggle: true, label: "U", html: "<u>U</u>",
            refreshState: () => ({ active: queryState("underline"), disabled: false }),
            act: () => { exec("underline"); refreshState(); } },
        ],
        [
          { type: "btn", title: "Align left (Ctrl+L)", html: "⫷", toggle: true, className: "align-left",
            refreshState: () => ({ active: queryAlign() === "left" }),
            act: () => { exec("justifyLeft"); refreshState(); } },
          { type: "btn", title: "Center (Ctrl+E)", html: "≡", toggle: true, className: "align-center",
            refreshState: () => ({ active: queryAlign() === "center" }),
            act: () => { exec("justifyCenter"); refreshState(); } },
          { type: "btn", title: "Align right (Ctrl+R)", html: "⫸", toggle: true, className: "align-right",
            refreshState: () => ({ active: queryAlign() === "right" }),
            act: () => { exec("justifyRight"); refreshState(); } },
          { type: "btn", title: "Justify (Ctrl+J)", html: "☰", toggle: true, className: "align-justify",
            refreshState: () => ({ active: queryAlign() === "justify" }),
            act: () => { exec("justifyFull"); refreshState(); } },
        ],
        [
          { type: "btn", title: "Bulleted list", html: "•≡", act: () => { exec("insertUnorderedList"); refreshState(); } },
          { type: "btn", title: "Numbered list", html: "1≡", act: () => { exec("insertOrderedList"); refreshState(); } },
          { type: "btn", title: "Decrease indent", html: "⤺", act: () => { exec("outdent"); refreshState(); } },
          { type: "btn", title: "Increase indent", html: "⤻", act: () => { exec("indent"); refreshState(); } },
        ],
        [
          { type: "btn", title: "Insert date/time", html: "🕒", act: () => insertDateTime() },
          { type: "btn", title: "Word count", html: "∑", act: () => wordCount() },
        ],
      ], {});
      const menuBar = OfficeChrome.buildMenuBar([
        { label: "File", submenu: [
          { label: "New", shortcut: "Ctrl+N", act: () => fileNew() },
          { label: "Open…", shortcut: "Ctrl+O", act: () => fileOpen() },
          { label: "Save", shortcut: "Ctrl+S", act: () => fileSave() },
          { label: "Save As…", act: () => fileSaveAs() },
          "-",
          { label: "Print Preview", act: () => filePrintPreview() },
          { label: "Print…", shortcut: "Ctrl+P", act: () => filePrint() },
          "-",
          { label: "Close", act: () => window.WM.closeWindow(winId) },
        ] },
        { label: "Edit", submenu: [
          { label: "Undo", shortcut: "Ctrl+Z", act: () => exec("undo") },
          { label: "Redo", shortcut: "Ctrl+Y", act: () => exec("redo") },
          "-",
          { label: "Cut", shortcut: "Ctrl+X", act: () => exec("cut") },
          { label: "Copy", shortcut: "Ctrl+C", act: () => exec("copy") },
          { label: "Paste", shortcut: "Ctrl+V", act: () => exec("paste") },
          "-",
          { label: "Select All", shortcut: "Ctrl+A", act: () => exec("selectAll") },
          { label: "Find…", shortcut: "Ctrl+F", act: () => findInPage() },
        ] },
        { label: "View", submenu: [
          { label: "Zoom…", act: () => zoomDialog() },
        ] },
        { label: "Insert", submenu: [
          { label: "Page Break", shortcut: "Ctrl+Enter", act: () => exec("insertHTML", "<p><br></p>") },
          { label: "Date and Time…", act: () => insertDateTime() },
        ] },
        { label: "Format", submenu: [
          { label: "Font…", act: () => fontDialog() },
          { label: "Paragraph…", act: () => alert("Paragraph dialog: not implemented in this demo.") },
        ] },
        { label: "Tools", submenu: [
          { label: "Word Count…", act: () => wordCount() },
        ] },
      ]);

      const win = window.WM.createWindow({
        id: winId,
        title: fileName() + " — Word",
        icon: "word",
        width: 760, height: 580,
        x: opts.x, y: opts.y,
        persistKey: "word:" + path,
        content: (body) => {
          body.style.padding = "0";
          body.appendChild(menuBar);
          body.appendChild(toolbar);
          body.appendChild(root);
          body.appendChild(statusBar);
          renderDoc();
          setTimeout(() => page.focus(), 0);
        },
      });

      // ---------- input → model + dirty + status ----------
      page.addEventListener("input", () => { markDirty(); updateStatus(); });
      page.addEventListener("keyup", () => { refreshState(); updateStatus(); });
      page.addEventListener("mouseup", () => { refreshState(); updateStatus(); });
      document.addEventListener("selectionchange", () => { if (win.el.contains(document.activeElement)) refreshState(); });

      page.addEventListener("keydown", (e) => {
        const ctrl = e.ctrlKey || e.metaKey;
        if (ctrl && e.key.toLowerCase() === "s") { e.preventDefault(); fileSave(); }
        else if (ctrl && e.key.toLowerCase() === "o") { e.preventDefault(); fileOpen(); }
        else if (ctrl && e.key.toLowerCase() === "n") { e.preventDefault(); fileNew(); }
        else if (ctrl && e.key.toLowerCase() === "p") { e.preventDefault(); filePrint(); }
        else if (ctrl && e.key.toLowerCase() === "f") { e.preventDefault(); findInPage(); }
        else if (ctrl && e.key.toLowerCase() === "a") { /* allow default */ }
        else if (ctrl && e.key.toLowerCase() === "b") { e.preventDefault(); exec("bold"); refreshState(); }
        else if (ctrl && e.key.toLowerCase() === "i") { e.preventDefault(); exec("italic"); refreshState(); }
        else if (ctrl && e.key.toLowerCase() === "u") { e.preventDefault(); exec("underline"); refreshState(); }
        else if (ctrl && e.key.toLowerCase() === "l") { e.preventDefault(); exec("justifyLeft"); refreshState(); }
        else if (ctrl && e.key.toLowerCase() === "e") { e.preventDefault(); exec("justifyCenter"); refreshState(); }
        else if (ctrl && e.key.toLowerCase() === "r") { e.preventDefault(); exec("justifyRight"); refreshState(); }
        else if (ctrl && e.key.toLowerCase() === "j") { e.preventDefault(); exec("justifyFull"); refreshState(); }
        else if (ctrl && e.key.toLowerCase() === "z") { e.preventDefault(); exec("undo"); refreshState(); }
        else if (ctrl && e.key.toLowerCase() === "y") { e.preventDefault(); exec("redo"); refreshState(); }
      });

      function markDirty() {
        if (!isDirty) { isDirty = true; updateTitle(); }
      }
      function updateTitle() {
        win.setTitle((isDirty ? "* " : "") + fileName() + " — Word");
      }
      function updateStatus() {
        const sel = window.getSelection();
        let text = "";
        if (sel && sel.rangeCount) text = sel.toString();
        const pos = getCursorStats();
        const sec = document.querySelectorAll("section").length || 1;
        document.getElementById("of-stat-page").textContent = "Page " + (pos.page + 1);
        document.getElementById("of-stat-sec").textContent = "Section " + sec;
        document.getElementById("of-stat-pos").textContent = pos.line + ":" + pos.col + (text.length ? " (" + text.length + " sel)" : "");
        document.getElementById("of-stat-mode").textContent = "EXT";
      }

      function getCursorStats() {
        const sel = window.getSelection();
        if (!sel.rangeCount) return { line: 1, col: 1, page: 0 };
        const range = sel.getRangeAt(0);
        // figure out which paragraph
        const p = range.startContainer.nodeType === 3
          ? range.startContainer.parentElement.closest("p")
          : range.startContainer.closest?.("p");
        const line = p ? Array.from(p.parentElement.children).indexOf(p) + 1 : 1;
        const col = range.startOffset + 1;
        return { line, col, page: 0 };
      }

      // ---------- formatting helpers ----------
      function exec(cmd, val) {
        try { document.execCommand(cmd, false, val); markDirty(); }
        catch (e) { console.warn("execCommand failed:", cmd, e); }
      }
      function queryState(cmd) {
        try { return document.queryCommandState(cmd); } catch { return false; }
      }
      function queryAlign() {
        try {
          const a = document.queryCommandValue("justifyLeft") ? "left"
            : document.queryCommandValue("justifyCenter") ? "center"
            : document.queryCommandValue("justifyRight") ? "right"
            : document.queryCommandValue("justifyFull") ? "justify" : "left";
          return a;
        } catch { return "left"; }
      }
      function setFontFamily(name) {
        exec("fontName", name);
      }
      function setFontSize(px) {
        // execCommand fontSize takes 1..7; we map px to closest.
        const map = { "8": 1, "10": 2, "12": 3, "14": 4, "18": 5, "24": 6, "36": 7 };
        const code = map[px] || 3;
        exec("fontSize", code);
      }
      function refreshState() {
        toolbar.refreshState && toolbar.refreshState();
      }

      // ---------- file ops ----------
      function fileNew() {
        doc = DEFAULT_DOC();
        path = "/C:/My Documents/Document" + Date.now() + ".doc";
        isDirty = false;
        win.persistKey = "word:" + path;
        renderDoc();
        updateTitle();
      }
      function fileOpen() {
        const cur = prompt("Open (virtual path):", path);
        if (!cur) return;
        const clean = cur.startsWith("/") ? cur : "/C:/My Documents/" + cur;
        if (!window.FS.exists(clean)) { alert("File not found: " + clean); return; }
        doc = loadDoc(clean);
        path = clean;
        isDirty = false;
        win.persistKey = "word:" + path;
        renderDoc();
        updateTitle();
      }
      function fileSave() {
        serializeToDoc();
        const ok = window.FS.write(path, JSON.stringify(doc, null, 2), "application/json");
        if (ok) { isDirty = false; updateTitle(); }
        return ok;
      }
      function fileSaveAs() {
        const next = prompt("Save as (virtual path):", path);
        if (!next) return;
        const clean = next.startsWith("/") ? next : "/C:/My Documents/" + next.replace(/[^\w. -]/g, "_");
        serializeToDoc();
        if (window.FS.write(clean, JSON.stringify(doc, null, 2), "application/json")) {
          path = clean; isDirty = false; win.persistKey = "word:" + path;
          updateTitle();
        }
      }
      function filePrint() {
        const w = window.open("", "_blank");
        if (!w) { alert("Pop-ups blocked."); return; }
        w.document.write(`<style>body{font-family: 'Times New Roman', serif; padding: 40px; line-height: 1.5}</style>` + page.innerHTML);
        w.document.close();
        w.print();
      }
      function filePrintPreview() {
        alert("Print preview: opening in a new window.");
        filePrint();
      }
      function wordCount() {
        const text = page.innerText || "";
        const words = (text.match(/\S+/g) || []).length;
        const chars = text.replace(/\s/g, "").length;
        alert(`Words: ${words}\nCharacters: ${chars}\nParagraphs: ${doc.paragraphs.length}`);
      }
      function findInPage() {
        const q = prompt("Find:");
        if (!q) return;
        const sel = window.getSelection();
        sel.removeAllRanges();
        // simple scroll-into-view
        const walker = document.createTreeWalker(page, NodeFilter.SHOW_TEXT, null, false);
        let node;
        while ((node = walker.nextNode())) {
          if (node.textContent.toLowerCase().includes(q.toLowerCase())) {
            const r = document.createRange();
            const idx = node.textContent.toLowerCase().indexOf(q.toLowerCase());
            r.setStart(node, idx);
            r.setEnd(node, idx + q.length);
            sel.addRange(r);
            node.parentElement.scrollIntoView({ block: "center" });
            return;
          }
        }
        alert("Not found: " + q);
      }
      function fontDialog() {
        const name = prompt("Font name:", "Times New Roman");
        if (name) setFontFamily(name);
      }
      function zoomDialog() {
        const z = prompt("Zoom (50–200):", "100");
        if (!z) return;
        const n = Math.max(50, Math.min(200, +z || 100));
        page.style.transform = "scale(" + (n / 100) + ")";
        page.style.transformOrigin = "top left";
      }
      function insertDateTime() {
        const s = new Date().toLocaleString();
        exec("insertText", s);
      }

      // ---------- render & serialize ----------
      function renderDoc() {
        page.innerHTML = "";
        for (const p of doc.paragraphs) {
          const el = document.createElement("p");
          el.className = "align-" + (p.align || "left");
          for (const r of (p.runs || [])) {
            if (!r.text) continue;
            const span = document.createElement("span");
            span.className = "run";
            if (r.bold) span.classList.add("bold");
            if (r.italic) span.classList.add("italic");
            if (r.underline) span.classList.add("underline");
            if (r.size) span.style.fontSize = r.size + "pt";
            if (r.font) span.style.fontFamily = r.font;
            span.textContent = r.text;
            el.appendChild(span);
          }
          if (el.childNodes.length === 0) el.innerHTML = "<br>";
          page.appendChild(el);
        }
      }

      function serializeToDoc() {
        const paragraphs = [];
        page.querySelectorAll("p").forEach((p) => {
          const align = (p.style.textAlign || p.className.match(/align-(\w+)/)?.[1] || "left");
          const runs = [];
          const walk = (node, fmt) => {
            node.childNodes.forEach((child) => {
              if (child.nodeType === Node.TEXT_NODE) {
                if (child.textContent.length > 0) {
                  runs.push({ text: child.textContent, ...fmt });
                }
              } else if (child.nodeType === Node.ELEMENT_NODE) {
                if (child.tagName === "BR") return;
                const nextFmt = { ...fmt };
                if (child.tagName === "B" || child.style.fontWeight === "bold" || +child.style.fontWeight >= 600) nextFmt.bold = true;
                if (child.tagName === "I" || child.style.fontStyle === "italic") nextFmt.italic = true;
                if (child.tagName === "U" || child.style.textDecoration === "underline") nextFmt.underline = true;
                if (child.style.fontSize) nextFmt.size = parseInt(child.style.fontSize, 10) || undefined;
                if (child.style.fontFamily) nextFmt.font = child.style.fontFamily;
                if (child.childNodes.length === 0) {
                  if (child.textContent) runs.push({ text: child.textContent, ...nextFmt });
                } else {
                  walk(child, nextFmt);
                }
              }
            });
          };
          walk(p, {});
          if (runs.length === 0) runs.push({ text: "" });
          paragraphs.push({ align, runs });
        });
        if (paragraphs.length === 0) paragraphs.push({ align: "left", runs: [{ text: "" }] });
        doc = { type: "word-doc", version: 1, paragraphs };
      }

      function loadDoc(p, state) {
        if (state && state.paragraphs) return state;
        const raw = window.FS.readText(p);
        if (!raw) return DEFAULT_DOC();
        try {
          const parsed = JSON.parse(raw);
          if (parsed && parsed.paragraphs) return parsed;
        } catch {}
        // legacy: treat as plain text → one paragraph
        return {
          type: "word-doc", version: 1,
          paragraphs: [{ align: "left", runs: [{ text: raw }] }],
        };
      }

      win.getAppState = () => {
        serializeToDoc();
        return { path, doc };
      };
      win.app = "word";
      win.onClose = () => {
        if (isDirty && confirm("Save changes to " + fileName() + "?")) fileSave();
      };
      return win;
    },
  };

  window.WordApp = app;
})();