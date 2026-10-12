/* ============================================================
   File Explorer — tree on the left, list on the right, address
   bar on top. Reads/writes the virtual filesystem.
   ============================================================ */

(function () {
  "use strict";

  const app = {
    id: "explorer",
    name: "File Explorer",
    icon: "explorer",
    category: "utility",

    launch(opts = {}) {
      const winId = "explorer_" + (opts.path || "root").replace(/[^\w. -]/g, "_");
      const state = { path: opts.path || "/C:/" };

      const root = document.createElement("div");
      root.className = "explorer";

      const address = document.createElement("div");
      address.className = "explorer-address";
      const backBtn = document.createElement("button");
      backBtn.className = "btn";
      backBtn.textContent = "←";
      backBtn.title = "Up";
      backBtn.addEventListener("click", () => goUp());
      const upBtn = document.createElement("button");
      upBtn.className = "btn";
      upBtn.textContent = "↑";
      upBtn.title = "Up";
      upBtn.addEventListener("click", () => goUp());
      const addrField = document.createElement("input");
      addrField.className = "field";
      addrField.value = state.path;
      addrField.addEventListener("keydown", (e) => {
        if (e.key === "Enter") { state.path = addrField.value; renderAll(); }
      });
      const goBtn = document.createElement("button");
      goBtn.className = "btn";
      goBtn.textContent = "Go";
      goBtn.addEventListener("click", () => { state.path = addrField.value; renderAll(); });

      address.appendChild(backBtn);
      address.appendChild(upBtn);
      address.appendChild(addrField);
      address.appendChild(goBtn);

      const body = document.createElement("div");
      body.className = "explorer-body";

      const tree = document.createElement("div");
      tree.className = "explorer-tree";
      const list = document.createElement("div");
      list.className = "explorer-list";

      body.appendChild(tree);
      body.appendChild(list);

      const status = document.createElement("div");
      status.className = "win-statusbar";
      const statusLeft = document.createElement("div");
      statusLeft.className = "win-statusbar-cell";
      const statusRight = document.createElement("div");
      statusRight.className = "win-statusbar-cell";
      status.appendChild(statusLeft);
      status.appendChild(statusRight);

      const menu = document.createElement("div");
      menu.className = "win-menubar";
      ["File", "Edit", "View", "Help"].forEach((m) => {
        const item = document.createElement("span");
        item.className = "win-menubar-item";
        item.textContent = m;
        item.addEventListener("click", () => onMenu(item, m));
        menu.appendChild(item);
      });

      root.appendChild(menu);
      root.appendChild(address);
      root.appendChild(body);

      const win = window.WM.createWindow({
        id: winId,
        title: "File Explorer",
        icon: "explorer",
        width: 540, height: 380,
        x: opts.x, y: opts.y,
        persistKey: "explorer",
        content: (body) => {
          body.style.padding = "0";
          body.appendChild(root);
          body.appendChild(status);
          renderAll();
        },
      });

      function onMenu(item, name) {
        if (name === "File") {
          window.WM.showContextMenu(item.getBoundingClientRect().left, item.getBoundingClientRect().bottom, [
            { label: "New Folder", act: () => newFolder() },
            { label: "New Text File", act: () => newFile() },
            "-",
            { label: "Refresh", act: renderAll },
          ]);
        } else if (name === "View") {
          window.WM.showContextMenu(item.getBoundingClientRect().left, item.getBoundingClientRect().bottom, [
            { label: "Refresh", act: renderAll },
          ]);
        } else if (name === "Help") {
          window.Apps.launch("about", { hint: "Double-click a .txt file to open in Notepad.\nDrag icons to move." });
        } else if (name === "Edit") {
          window.WM.showContextMenu(item.getBoundingClientRect().left, item.getBoundingClientRect().bottom, [
            { label: "Copy path", act: () => window.Clipboard.setText(state.path) },
          ]);
        }
      }

      function goUp() {
        if (state.path === "/" || state.path === "") return;
        const p = state.path.replace(/\/$/, "").split("/").slice(0, -1).join("/");
        state.path = p || "/";
        addrField.value = state.path;
        renderAll();
      }

      function newFolder() {
        const name = prompt("Folder name:", "New Folder");
        if (!name) return;
        const path = joinPath(state.path, name.replace(/[^\w. -]/g, "_"));
        window.FS.mkdir(path);
        renderAll();
      }
      function newFile() {
        const name = prompt("File name:", "New File.txt");
        if (!name) return;
        const path = joinPath(state.path, name.replace(/[^\w. -]/g, "_"));
        window.FS.write(path, "");
        renderAll();
      }

      function renderAll() {
        addrField.value = state.path;
        renderTree();
        renderList();
      }

      function renderTree() {
        tree.innerHTML = "";
        // show root and first level
        const buildNode = (path, label, depth) => {
            const node = document.createElement("div");
            const head = document.createElement("div");
            head.className = "tree-node" + (path === state.path ? " is-selected" : "");
            head.style.paddingLeft = (4 + depth * 12) + "px";
            head.innerHTML = `<span class="caret">${path === state.path ? "▾" : "▸"}</span>${window.Icons.get("folder")}<span>${escapeHTML(label)}</span>`;
            head.addEventListener("click", () => { state.path = path; renderAll(); });
            node.appendChild(head);
            if (depth < 2) {
              const children = document.createElement("div");
              children.className = "tree-children";
              const list = window.FS.list(path);
              list.filter((x) => x.type === "dir").forEach((c) => {
                const childPath = joinPath(path, c.name);
                children.appendChild(buildNode(childPath, c.name, depth + 1));
              });
              node.appendChild(children);
            }
            return node;
          };
        tree.appendChild(buildNode("/C:/", "C:", 0));
      }

      function renderList() {
        list.innerHTML = "";
        const items = window.FS.list(state.path);
        items.sort((a, b) => (a.type === b.type ? a.name.localeCompare(b.name) : a.type === "dir" ? -1 : 1));
        statusLeft.textContent = items.length + " object(s)";
        items.forEach((it) => {
          const el = document.createElement("div");
          el.className = "explorer-item";
          el.innerHTML = `<div class="icon">${iconFor(it)}</div><div class="label">${escapeHTML(it.name)}</div>`;
          el.title = it.name;
          el.addEventListener("click", (e) => {
            e.stopPropagation();
            list.querySelectorAll(".explorer-item.is-selected").forEach((x) => x.classList.remove("is-selected"));
            el.classList.add("is-selected");
            statusRight.textContent = it.type === "file" ? `${it.size} bytes` : "Folder";
          });
          el.addEventListener("dblclick", () => openItem(it));
          el.addEventListener("contextmenu", (e) => {
            e.preventDefault();
            e.stopPropagation();
            window.WM.showContextMenu(e.clientX, e.clientY, [
              { label: "Open", act: () => openItem(it) },
              "-",
              { label: "Rename", act: () => renameItem(it) },
              { label: "Delete", act: () => deleteItem(it) },
              "-",
              { label: "Copy", act: () => window.Clipboard.setText(it.name) },
            ]);
          });
          list.appendChild(el);
        });
        if (items.length === 0) {
          const empty = document.createElement("div");
          empty.style.color = "#888";
          empty.style.padding = "12px";
          empty.textContent = "This folder is empty.";
          list.appendChild(empty);
        }
      }

      function openItem(it) {
        if (it.type === "dir") {
          state.path = joinPath(state.path, it.name);
          renderAll();
          return;
        }
        const path = joinPath(state.path, it.name);
        if ((it.mime || "").startsWith("image/")) {
          window.Apps.launch("about", { hint: "Image: " + it.name + " (" + it.mime + ")" });
          return;
        }
        window.Apps.launch("notepad", { path });
      }

      function renameItem(it) {
        const next = prompt("Rename to:", it.name);
        if (!next || next === it.name) return;
        const src = joinPath(state.path, it.name);
        const dst = joinPath(state.path, next.replace(/[^\w. -]/g, "_"));
        if (it.type === "file") {
          const data = window.FS.read(src);
          if (!data) return;
          window.FS.write(dst, data.content, data.mime);
          window.FS.delete(src);
        } else {
          // rename by creating new and moving children one by one
          const children = window.FS.list(src);
          window.FS.mkdir(dst);
          children.forEach((c) => {
            const sp = joinPath(src, c.name);
            const dp = joinPath(dst, c.name);
            if (c.type === "file") {
              const d = window.FS.read(sp);
              if (d) { window.FS.write(dp, d.content, d.mime); window.FS.delete(sp); }
            } else {
              window.FS.mkdir(dp);
            }
          });
          window.FS.delete(src);
        }
        renderAll();
      }
      function deleteItem(it) {
        if (!confirm("Delete " + it.name + "?")) return;
        window.FS.delete(joinPath(state.path, it.name));
        renderAll();
      }

      function iconFor(it) {
        if (it.type === "dir") return window.Icons.get("folder");
        if ((it.mime || "").startsWith("text/")) return window.Icons.get("text");
        if ((it.mime || "").startsWith("image/")) return window.Icons.get("image");
        if ((it.mime || "").startsWith("audio/")) return window.Icons.get("audio");
        return window.Icons.get("file");
      }

      function joinPath(a, b) {
        if (!a || a === "/") return "/" + b;
        if (a.endsWith("/")) return a + b;
        return a + "/" + b;
      }

      function escapeHTML(s) {
        return String(s ?? "").replace(/[&<>"']/g, (c) => ({
          "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
        }[c]));
      }

      win.getAppState = () => ({ path: state.path });
      win.app = "explorer";
      return win;
    },
  };

  window.ExplorerApp = app;
})();