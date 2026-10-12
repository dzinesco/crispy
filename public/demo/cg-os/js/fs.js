/* ============================================================
   Virtual filesystem — a tiny tree stored in localStorage.
   Apps (Notepad, Explorer) read/write through this.

   Tree shape:
     {
       type: "dir",
       name: "C:",
       children: {
         "Documents": { type: "dir", children: { ... } },
         "README.txt": { type: "file", mime: "text/plain", content: "..." }
       }
     }
   Paths use "/" separators, e.g. "/C:/Documents/README.txt".
   ============================================================ */

(function () {
  "use strict";

  const LS_KEY = "cg.os.fs.v1";

  function nowISO() { return new Date().toISOString(); }

  function defaultFS() {
    return {
      type: "dir",
      name: "",
      mtime: nowISO(),
      children: {
        "C:": {
          type: "dir",
          name: "C:",
          mtime: nowISO(),
          children: {
            "Documents": {
              type: "dir", name: "Documents", mtime: nowISO(),
              children: {
                "Welcome.txt": {
                  type: "file", name: "Welcome.txt", mtime: nowISO(),
                  mime: "text/plain",
                  content:
                    "Welcome to Crispy Goat OS.\n\n" +
                    "This is a virtual filesystem backed by your browser's localStorage.\n" +
                    "Try the apps in the Start menu. Drag windows. Open Notepad and save a file.\n\n" +
                    "Your desktop, window positions, and notes persist between sessions.",
                },
                "Todo.txt": {
                  type: "file", name: "Todo.txt", mtime: nowISO(),
                  mime: "text/plain",
                  content: "- Try Minesweeper\n- Try Solitaire\n- Load an MP3 into Winamp\n",
                },
              },
            },
            "Desktop": {
              type: "dir", name: "Desktop", mtime: nowISO(),
              children: {},
            },
            "Music": {
              type: "dir", name: "Music", mtime: nowISO(),
              children: {},
            },
            "Pictures": {
              type: "dir", name: "Pictures", mtime: nowISO(),
              children: {},
            },
            "README.txt": {
              type: "file", name: "README.txt", mtime: nowISO(),
              mime: "text/plain",
              content:
                "Crispy Goat OS\n" +
                "=============\n\n" +
                "A living Windows 98-style desktop that runs in the browser.\n" +
                "Pure client-side. No backend. Just vibes.",
            },
          },
        },
      },
    };
  }

  function load() {
    try {
      const s = localStorage.getItem(LS_KEY);
      if (s) return JSON.parse(s);
    } catch {}
    const init = defaultFS();
    save(init);
    return init;
  }
  function save(root) {
    try { localStorage.setItem(LS_KEY, JSON.stringify(root)); } catch (e) {
      console.warn("FS save failed:", e);
    }
  }

  // --- path helpers ---
  function splitPath(path) {
    const parts = String(path).replace(/^\/+|\/+$/g, "").split("/").filter(Boolean);
    return parts;
  }

  function getNode(path, root) {
    if (!path || path === "/" || path === "") return root;
    const parts = splitPath(path);
    let cur = root;
    for (const p of parts) {
      if (!cur || cur.type !== "dir") return null;
      cur = cur.children?.[p];
      if (!cur) return null;
    }
    return cur;
  }

  function ensureDir(path, root) {
    const parts = splitPath(path);
    let cur = root;
    for (const p of parts) {
      if (!cur.children[p]) {
        cur.children[p] = { type: "dir", name: p, mtime: nowISO(), children: {} };
        save(root);
      }
      cur = cur.children[p];
      if (cur.type !== "dir") return null;
    }
    return cur;
  }

  // --- API ---
  const fs = {
    _root: null,
    init() { if (!this._root) this._root = load(); return this._root; },

    read(path) {
      const root = this.init();
      const n = getNode(path, root);
      if (!n || n.type !== "file") return null;
      return n;
    },

    readText(path) {
      const n = this.read(path);
      if (!n) return null;
      if (n.mime && !n.mime.startsWith("text/") && n.mime !== "application/json") return null;
      return n.content ?? "";
    },

    write(path, content, mime = "text/plain") {
      const root = this.init();
      const parts = splitPath(path);
      const name = parts.pop();
      const parent = ensureDir(parts.join("/"), root);
      if (!parent) return false;
      parent.children[name] = {
        type: "file", name, mtime: nowISO(), mime,
        content: typeof content === "string" ? content : String(content),
      };
      save(root);
      return true;
    },

    delete(path) {
      const root = this.init();
      const parts = splitPath(path);
      const name = parts.pop();
      const parent = getNode("/" + parts.join("/"), root);
      if (!parent || parent.type !== "dir") return false;
      if (!parent.children[name]) return false;
      delete parent.children[name];
      save(root);
      return true;
    },

    mkdir(path) { return !!ensureDir(path, this.init()); },

    list(path) {
      const root = this.init();
      const n = getNode(path, root);
      if (!n || n.type !== "dir") return [];
      return Object.values(n.children).map((c) => ({
        name: c.name, type: c.type, mime: c.mime,
        mtime: c.mtime, size: c.type === "file" ? (c.content?.length || 0) : null,
      }));
    },

    tree(path = "/") {
      const root = this.init();
      const node = getNode(path, root);
      if (!node || node.type !== "dir") return [];
      return Object.values(node.children).map((c) => ({
        name: c.name,
        type: c.type,
        mime: c.mime,
        mtime: c.mtime,
        children: c.type === "dir" ? this.tree(joinPath(path, c.name)) : null,
      }));
    },

    exists(path) {
      const root = this.init();
      return !!getNode(path, root);
    },

    reset() {
      const init = defaultFS();
      this._root = init;
      save(init);
    },
  };

  function joinPath(a, b) {
    if (!a || a === "/") return "/" + b;
    if (a.endsWith("/")) return a + b;
    return a + "/" + b;
  }

  window.FS = fs;
})();