/* ============================================================
   Outlook 2000 — 3-pane mail client.
   Stores messages in /C:/Outlook/store.json (virtual FS).
   Folders: Inbox, Sent, Drafts, Trash.
   ============================================================ */

(function () {
  "use strict";

  const STORE_PATH = "/C:/Outlook/store.json";
  const FOLDERS = ["Inbox", "Sent", "Drafts", "Trash"];

  function defaultStore() {
    return {
      type: "outlook-store", version: 1,
      messages: {
        Inbox: [
          msg("1", "Boss", "Quarterly review", "Hi,\n\nLet's schedule the quarterly review for next Tuesday.\n\nThanks.", false),
          msg("2", "Crispy Goat Team", "Welcome to the new OS!", "Hey everyone,\n\nWe just shipped a new build. Drag windows around. Try the Start menu.\n\n— The team", false),
          msg("3", "IT Support", "Password reset", "Your password has been reset. Use the new one in your next login.\n\nIT", true),
        ],
        Sent: [],
        Drafts: [
          msg("draft-1", "", "Re: Project update", "(draft — type to continue)", false, { draft: true }),
        ],
        Trash: [],
      },
    };
  }
  function msg(id, from, subject, body, read, extra) {
    return {
      id, from, subject, body,
      date: new Date(Date.now() - Math.random() * 7 * 86400_000).toISOString(),
      read: !!read,
      ...(extra || {}),
    };
  }

  const app = {
    id: "outlook",
    name: "Microsoft Outlook",
    icon: "outlook",
    category: "office",

    launch(opts = {}) {
      const winId = "outlook_" + Date.now();
      let store = loadStore();
      let curFolder = "Inbox";
      let curMsgId = null;
      const draftTmp = { editing: false, body: "", to: "", subject: "", id: null };

      // ensure folders
      for (const f of FOLDERS) if (!store.messages[f]) store.messages[f] = [];
      saveStore();

      // ---------- DOM ----------
      const root = document.createElement("div");
      root.className = "outlook";

      const toolbar = OfficeChrome.buildToolbar([
        [
          { type: "btn", title: "New Message (Ctrl+N)", html: "✉", act: () => composeNew() },
          { type: "btn", title: "Reply", html: "↩", act: () => reply() },
          { type: "btn", title: "Forward", html: "↪", act: () => forward() },
          { type: "btn", title: "Delete (Del)", html: "🗑", act: () => deleteCurrent() },
        ],
        [
          { type: "btn", title: "Send / Receive", html: "⇅", act: () => sendReceive() },
        ],
      ], {});

      const menuBar = OfficeChrome.buildMenuBar([
        { label: "File", submenu: [
          { label: "New Message", shortcut: "Ctrl+N", act: () => composeNew() },
          { label: "Save Store", act: () => saveStore() },
          "-",
          { label: "Close", act: () => window.WM.closeWindow(winId) },
        ] },
        { label: "Edit", submenu: [
          { label: "Find…", act: () => findMessage() },
        ] },
        { label: "View", submenu: [
          { label: "Refresh", act: () => renderAll() },
        ] },
        { label: "Tools", submenu: [
          { label: "Send / Receive", act: () => sendReceive() },
        ] },
      ]);

      const body = document.createElement("div");
      body.className = "outlook-body";
      const folders = document.createElement("div");
      folders.className = "outlook-folders";
      const list = document.createElement("div");
      list.className = "outlook-list";
      const reading = document.createElement("div");
      reading.className = "outlook-reading";
      body.appendChild(folders);
      body.appendChild(list);
      body.appendChild(reading);

      root.appendChild(toolbar);
      root.appendChild(body);

      const statusBar = OfficeChrome.buildStatusBar([
        { html: "Online" },
        { html: "0 unread" },
        { html: STORE_PATH },
      ]);

      const win = window.WM.createWindow({
        id: winId,
        title: "Inbox — Outlook",
        icon: "outlook",
        width: 780, height: 520,
        x: opts.x, y: opts.y,
        persistKey: "outlook",
        content: (bodyEl) => {
          bodyEl.style.padding = "0";
          bodyEl.appendChild(menuBar);
          bodyEl.appendChild(toolbar);
          bodyEl.appendChild(root);
          bodyEl.appendChild(statusBar);
          renderAll();
        },
      });

      function renderAll() {
        renderFolders();
        renderList();
        renderReading();
        updateStatus();
      }

      function renderFolders() {
        folders.innerHTML = "";
        // folder root
        const f1 = document.createElement("div");
        f1.className = "outlook-folder";
        f1.style.fontWeight = "700";
        f1.innerHTML = window.Icons.get("folder") + " <span>Outlook</span>";
        folders.appendChild(f1);
        for (const f of FOLDERS) {
          const count = store.messages[f].length;
          const unread = store.messages[f].filter((m) => !m.read).length;
          const row = document.createElement("div");
          row.className = "outlook-folder" + (f === curFolder ? " is-active" : "");
          row.innerHTML =
            (unread ? window.Icons.get("mailnew") : window.Icons.get("mail")) +
            ` <span class="${unread ? "unread" : ""}">${f}</span>` +
            (unread ? ` <span class="unread">(${unread})</span>` : (count ? ` (${count})` : ""));
          row.addEventListener("click", () => { curFolder = f; curMsgId = null; renderAll(); });
          folders.appendChild(row);
        }
      }

      function renderList() {
        list.innerHTML = "";
        const items = store.messages[curFolder].slice().sort((a, b) => (b.date || "").localeCompare(a.date || ""));
        if (items.length === 0) {
          const empty = document.createElement("div");
          empty.style.padding = "12px";
          empty.style.color = "#888";
          empty.textContent = "No messages.";
          list.appendChild(empty);
          return;
        }
        items.forEach((m) => {
          const row = document.createElement("div");
          row.className = "outlook-list-row" +
            (m.read ? "" : " is-unread") +
            (curMsgId === m.id ? " is-active" : "");
          const fromEl = document.createElement("div");
          fromEl.className = "from";
          fromEl.textContent = m.from || "(no sender)";
          const dateEl = document.createElement("div");
          dateEl.className = "date";
          dateEl.textContent = formatDate(m.date);
          const subjEl = document.createElement("div");
          subjEl.className = "subj";
          subjEl.textContent = m.subject || "(no subject)";
          row.appendChild(fromEl);
          row.appendChild(dateEl);
          row.appendChild(subjEl);
          row.addEventListener("click", () => { curMsgId = m.id; if (!m.read) { m.read = true; saveStore(); } renderAll(); });
          row.addEventListener("dblclick", () => { curMsgId = m.id; if (!m.read) { m.read = true; saveStore(); } openMessage(m); });
          list.appendChild(row);
        });
      }

      function renderReading() {
        reading.innerHTML = "";
        const m = store.messages[curFolder].find((x) => x.id === curMsgId);
        if (!m) {
          const empty = document.createElement("div");
          empty.className = "empty";
          empty.textContent = "Select a message to read it.";
          reading.appendChild(empty);
          return;
        }
        const head = document.createElement("div");
        head.className = "head";
        head.innerHTML = `
          <h2>${escapeHTML(m.subject || "(no subject)")}</h2>
          <div class="meta">From: <b>${escapeHTML(m.from || "(no sender)")}</b> · ${formatDate(m.date)}</div>
        `;
        const bodyEl = document.createElement("div");
        bodyEl.className = "body";
        bodyEl.textContent = m.body || "";
        reading.appendChild(head);
        reading.appendChild(bodyEl);
      }

      function formatDate(iso) {
        if (!iso) return "";
        const d = new Date(iso);
        const now = new Date();
        if (d.toDateString() === now.toDateString()) {
          return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
        }
        return d.toLocaleDateString([], { month: "short", day: "numeric" });
      }

      function composeNew(opts = {}) {
        const composeWinId = "compose_" + Date.now();
        const fields = document.createElement("div");
        fields.className = "compose-fields";
        const toRow = row("To:", opts.to || "");
        const subjectRow = row("Subject:", opts.subject || "");
        fields.appendChild(toRow.row);
        fields.appendChild(subjectRow.row);

        const body = document.createElement("div");
        body.className = "compose-body";
        body.contentEditable = "true";
        body.spellcheck = false;
        body.textContent = opts.body || "";

        const tb = OfficeChrome.buildToolbar([
          [
            { type: "btn", title: "Send", html: "✉ Send", act: () => send(toRow.input.value, subjectRow.input.value, body.textContent) },
            { type: "btn", title: "Save Draft", html: "💾 Save", act: () => saveDraft(toRow.input.value, subjectRow.input.value, body.textContent) },
            { type: "btn", title: "Discard", html: "🗑 Discard", act: () => window.WM.closeWindow(composeWinId) },
          ],
        ], {});

        const compose = document.createElement("div");
        compose.className = "compose";
        compose.appendChild(tb);
        compose.appendChild(fields);
        compose.appendChild(body);

        const composeWin = window.WM.createWindow({
          id: composeWinId,
          title: (opts.subject || "Untitled") + " — Message",
          icon: "mailnew",
          width: 560, height: 440,
          x: (opts.x || 200) + 30, y: (opts.y || 160) + 30,
          content: (b) => {
            b.style.padding = "0";
            b.appendChild(compose);
            setTimeout(() => body.focus(), 0);
          },
        });
        composeWin.app = "outlook-compose";
        return composeWin;
      }
      function row(label, value) {
        const r = document.createElement("div");
        r.className = "compose-field";
        const lab = document.createElement("label");
        lab.textContent = label;
        const input = document.createElement("input");
        input.value = value;
        input.type = "text";
        r.appendChild(lab);
        r.appendChild(input);
        return { row: r, input };
      }

      function send(to, subject, body) {
        if (!to) { alert("Please enter a recipient."); return; }
        const m = msg("m-" + Date.now(), "Me", subject, body, true);
        store.messages.Sent.unshift(m);
        saveStore();
        // close compose window
        const allW = window.WM.listWindows();
        for (const w of allW) {
          if (w.title && w.title.includes("Message")) {
            // close the one that was just used
            try { window.WM.closeWindow(w.id); } catch {}
          }
        }
        renderAll();
      }
      function saveDraft(to, subject, body) {
        const m = msg("d-" + Date.now(), to, subject, body, true, { draft: true });
        store.messages.Drafts.unshift(m);
        saveStore();
        renderAll();
      }

      function reply() {
        const m = store.messages[curFolder].find((x) => x.id === curMsgId);
        if (!m) return;
        composeNew({
          to: m.from,
          subject: m.subject?.startsWith("Re:") ? m.subject : "Re: " + m.subject,
          body: "\n\nOn " + formatDate(m.date) + ", " + m.from + " wrote:\n> " + (m.body || "").split("\n").join("\n> "),
        });
      }
      function forward() {
        const m = store.messages[curFolder].find((x) => x.id === curMsgId);
        if (!m) return;
        composeNew({
          subject: m.subject?.startsWith("Fwd:") ? m.subject : "Fwd: " + m.subject,
          body: "\n\nForwarded message:\nFrom: " + m.from + "\nDate: " + formatDate(m.date) + "\n\n" + (m.body || ""),
        });
      }
      function deleteCurrent() {
        const m = store.messages[curFolder].find((x) => x.id === curMsgId);
        if (!m) return;
        if (curFolder === "Trash") {
          // permanently delete
          store.messages.Trash = store.messages.Trash.filter((x) => x.id !== m.id);
        } else {
          // move to trash
          store.messages.Trash.unshift(m);
          store.messages[curFolder] = store.messages[curFolder].filter((x) => x.id !== m.id);
        }
        curMsgId = null;
        saveStore();
        renderAll();
      }
      function openMessage(m) {
        // re-render reading (already there) — but also flash
        m.read = true; saveStore(); renderAll();
      }
      function findMessage() {
        const q = prompt("Find message containing:");
        if (!q) return;
        const ql = q.toLowerCase();
        for (const f of FOLDERS) {
          for (const m of store.messages[f]) {
            if ((m.subject + " " + m.body + " " + m.from).toLowerCase().includes(ql)) {
              curFolder = f; curMsgId = m.id;
              if (!m.read) { m.read = true; saveStore(); }
              renderAll();
              return;
            }
          }
        }
        alert("Not found: " + q);
      }
      function sendReceive() {
        // simulate fetching new mail
        const newMsg = msg("m-" + Date.now(), "Auto-Reply", "Welcome", "Thanks for using Outlook. This is an auto-reply.", false);
        store.messages.Inbox.unshift(newMsg);
        saveStore();
        renderAll();
      }
      function updateStatus() {
        const all = FOLDERS.reduce((n, f) => n + store.messages[f].length, 0);
        const unread = FOLDERS.reduce((n, f) => n + store.messages[f].filter((m) => !m.read).length, 0);
        statusBar.children[0].textContent = "Online";
        statusBar.children[1].textContent = unread + " unread";
        statusBar.children[2].textContent = "Store: " + STORE_PATH;
        win.setTitle((curFolder === "Inbox" ? "Inbox" : curFolder) + " — Outlook");
      }

      function loadStore() {
        const raw = window.FS.readText(STORE_PATH);
        if (!raw) return defaultStore();
        try {
          const parsed = JSON.parse(raw);
          if (parsed && parsed.messages) {
            for (const f of FOLDERS) if (!parsed.messages[f]) parsed.messages[f] = [];
            return parsed;
          }
        } catch {}
        return defaultStore();
      }
      function saveStore() {
        window.FS.write(STORE_PATH, JSON.stringify(store, null, 2), "application/json");
      }
      function escapeHTML(s) {
        return String(s ?? "").replace(/[&<>"']/g, (c) => ({
          "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
        }[c]));
      }

      win.getAppState = () => ({ store });
      win.app = "outlook";
      return win;
    },
  };

  window.OutlookApp = app;
})();