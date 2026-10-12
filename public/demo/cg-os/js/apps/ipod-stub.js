/* ============================================================
   iPod stub — click wheel with menu/now-playing/about.
   Keyboard arrows work too.
   ============================================================ */

(function () {
  "use strict";

  const MENU = [
    { id: "now-playing", label: "Now Playing" },
    { id: "music",       label: "Music" },
    { id: "photos",      label: "Photos" },
    { id: "settings",    label: "Settings" },
    { id: "about",       label: "About" },
  ];

  const app = {
    id: "ipod",
    name: "iPod",
    icon: "ipod",
    category: "demo",

    launch(opts = {}) {
      const winId = "ipod_" + Date.now();

      const W = 160, H = 130;
      const canvas = document.createElement("canvas");
      canvas.width = W;
      canvas.height = H;
      canvas.style.imageRendering = "pixelated";

      const wheel = document.createElement("div");
      wheel.className = "ipod-stub-wheel";
      Object.assign(wheel.style, {
        width: "100px",
        height: "100px",
        borderRadius: "50%",
        background: "#f5f5f5",
        border: "2px solid #000",
        position: "relative",
        margin: "12px auto 0",
        boxShadow: "inset 0 0 4px rgba(0,0,0,0.4)",
      });
      const center = document.createElement("button");
      center.textContent = "MENU";
      Object.assign(center.style, {
        position: "absolute",
        left: "50%", top: "50%",
        transform: "translate(-50%, -50%)",
        width: "36px", height: "36px",
        borderRadius: "50%",
        border: "1px solid #000",
        background: "#fff",
        fontSize: "9px",
        fontWeight: "700",
        cursor: "default",
        padding: 0,
      });
      center.addEventListener("click", () => action("select"));
      wheel.appendChild(center);

      const root = document.createElement("div");
      root.className = "stub";
      const screen = document.createElement("div");
      screen.style.cssText = `
        display:flex; flex-direction:column; align-items:center;
        background:#88aacc; padding:12px; gap:8px;
      `;
      const canvasWrap = document.createElement("div");
      Object.assign(canvasWrap.style, {
        background: "#aaccee",
        border: "2px solid #000",
        borderRadius: "8px",
        width: (W + 16) + "px",
        padding: "8px",
      });
      canvasWrap.appendChild(canvas);
      screen.appendChild(canvasWrap);
      screen.appendChild(wheel);

      const stub = document.createElement("div");
      stub.className = "stub";
      stub.appendChild(screen);

      const ctx = canvas.getContext("2d");

      const state = {
        menuStack: [{ name: "main", items: MENU, idx: 0 }],
        songs: [
          { title: "Welcome", artist: "Crispy Goat", duration: 30 },
          { title: "8-bit Boogie", artist: "Pixel Pete", duration: 30 },
          { title: "Floppy Drive", artist: "Diskette", duration: 30 },
          { title: "Dial-Up", artist: "Modem Lord", duration: 30 },
        ],
        songIdx: 0,
        playing: false,
        progress: 0,
        view: "menu", // menu | now-playing | about | settings
      };

      function action(act) {
        const top = state.menuStack[state.menuStack.length - 1];
        if (state.view === "now-playing") {
          if (act === "select") { state.playing = !state.playing; }
          else if (act === "back") { state.view = "menu"; }
          return;
        }
        if (state.view !== "menu") {
          if (act === "back") state.view = "menu";
          return;
        }
        if (act === "up") top.idx = (top.idx - 1 + top.items.length) % top.items.length;
        else if (act === "down") top.idx = (top.idx + 1) % top.items.length;
        else if (act === "select") {
          const it = top.items[top.idx];
          if (it.id === "now-playing") state.view = "now-playing";
          else if (it.id === "about") state.view = "about";
          else if (it.id === "settings") state.view = "settings";
          else if (it.id === "music") {
            state.menuStack.push({
              name: "music",
              items: state.songs.map((s, i) => ({ id: "song-" + i, label: s.title, songIdx: i })),
              idx: 0,
            });
          }
        } else if (act === "back") {
          if (state.menuStack.length > 1) state.menuStack.pop();
        }
      }

      // wheel gesture
      let dragStart = null, dragLast = null, dragAngle = 0;
      function angleFromCenter(e) {
        const r = wheel.getBoundingClientRect();
        const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
        return Math.atan2(e.clientY - cy, e.clientX - cx);
      }
      wheel.addEventListener("mousedown", (e) => {
        if (e.target === center) return;
        dragStart = angleFromCenter(e);
        dragLast = dragStart;
        dragAngle = 0;
      });
      window.addEventListener("mousemove", (e) => {
        if (dragStart == null) return;
        const a = angleFromCenter(e);
        let delta = a - dragLast;
        if (delta > Math.PI) delta -= Math.PI * 2;
        if (delta < -Math.PI) delta += Math.PI * 2;
        dragAngle += delta;
        dragLast = a;
        const steps = Math.round((dragAngle * 4) / Math.PI);
        if (Math.abs(steps) > 0) {
          for (let i = 0; i < Math.abs(steps); i++) action(steps > 0 ? "down" : "up");
          dragAngle = 0;
        }
      });
      window.addEventListener("mouseup", (e) => {
        if (dragStart == null) return;
        const r = wheel.getBoundingClientRect();
        const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
        const dx = e.clientX - cx, dy = e.clientY - cy;
        const dist = Math.hypot(dx, dy);
        dragStart = null;
        if (dist < 14) return; // center is handled by center click
        // detect which quadrant
        const a = Math.atan2(dy, dx);
        if (a > -Math.PI * 0.85 && a < -Math.PI * 0.15) action("back");   // top
        else if (a > Math.PI * 0.15 && a < Math.PI * 0.85) action("select"); // bottom
        else if (a >= -Math.PI * 0.15 && a <= Math.PI * 0.15) action("down"); // right
        else action("up"); // left
      });

      // keyboard
      const onKey = (down) => (e) => {
        if (!down) return;
        const k = e.key.toLowerCase();
        if (k === "arrowup") action("up");
        else if (k === "arrowdown") action("down");
        else if (k === "arrowleft") action("back");
        else if (k === "arrowright" || k === "enter") action("select");
      };
      window.addEventListener("keydown", onKey(true));

      // screen renderer
      function render() {
        ctx.fillStyle = "#88aacc";
        ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = "#fff";
        ctx.font = "bold 9px monospace";
        ctx.textBaseline = "top";
        if (state.view === "menu") {
          const top = state.menuStack[state.menuStack.length - 1];
          ctx.fillText(top.name === "main" ? "iPod" : top.name, 4, 4);
          const start = Math.max(0, Math.min(top.idx - 2, top.items.length - 5));
          for (let i = 0; i < 5 && (start + i) < top.items.length; i++) {
            const idx = start + i;
            const item = top.items[idx];
            if (idx === top.idx) {
              ctx.fillStyle = "#000088";
              ctx.fillRect(0, 16 + i * 12, W, 12);
              ctx.fillStyle = "#fff";
            } else {
              ctx.fillStyle = "#fff";
            }
            ctx.fillText((idx === top.idx ? "> " : "  ") + item.label, 4, 18 + i * 12);
          }
          // battery indicator
          ctx.fillStyle = "#000";
          ctx.fillRect(W - 22, 4, 18, 6);
          ctx.fillStyle = "#6fff38";
          ctx.fillRect(W - 21, 5, 14, 4);
        } else if (state.view === "now-playing") {
          const s = state.songs[state.songIdx];
          ctx.fillText("Now Playing", 4, 4);
          ctx.fillText(s.title, 4, 24);
          ctx.font = "8px monospace";
          ctx.fillText(s.artist, 4, 36);
          // progress
          ctx.fillStyle = "#000";
          ctx.fillRect(4, H - 18, W - 8, 6);
          ctx.fillStyle = "#000088";
          const progressW = Math.round((W - 8) * state.progress);
          ctx.fillRect(4, H - 18, progressW, 6);
          // play icon
          ctx.fillStyle = "#000";
          if (state.playing) {
            ctx.beginPath();
            ctx.moveTo(W / 2 - 4, H / 2 - 8);
            ctx.lineTo(W / 2 - 4, H / 2 + 8);
            ctx.lineTo(W / 2 + 6, H / 2);
            ctx.closePath();
            ctx.fill();
          } else {
            ctx.fillRect(W / 2 - 5, H / 2 - 6, 4, 12);
            ctx.fillRect(W / 2 + 1, H / 2 - 6, 4, 12);
          }
        } else if (state.view === "about") {
          ctx.fillText("iPod", 4, 4);
          ctx.fillText("Crispy Goat Ed.", 4, 18);
          ctx.fillText("v1.0", 4, 30);
          ctx.fillText("Tracks: " + state.songs.length, 4, 42);
          ctx.fillText("Battery: 96%", 4, 54);
          ctx.fillText("Click wheel center", 4, 80);
          ctx.fillText("to go back.", 4, 92);
        } else if (state.view === "settings") {
          ctx.fillText("Settings", 4, 4);
          ctx.fillText("About >", 4, 24);
          ctx.fillText("Backlight: ON", 4, 36);
          ctx.fillText("Volume: 70%", 4, 48);
          ctx.fillText("EQ: Off", 4, 60);
        }
      }

      let raf;
      function tick() {
        if (state.playing) {
          const s = state.songs[state.songIdx];
          if (s.duration > 0) {
            state.progress = (state.progress + 0.005) % 1;
            if (state.progress < 0.005) {
              state.songIdx = (state.songIdx + 1) % state.songs.length;
            }
          }
        }
        render();
        raf = requestAnimationFrame(tick);
      }
      raf = requestAnimationFrame(tick);

      const win = window.WM.createWindow({
        id: winId,
        title: "iPod",
        icon: "ipod",
        width: 280, height: 360,
        x: opts.x, y: opts.y,
        persistKey: "ipod-stub",
        content: (body) => {
          body.style.padding = "0";
          body.appendChild(stub);
          setTimeout(() => wheel.scrollIntoView({ block: "center" }), 0);
        },
      });
      win.onClose = () => {
        cancelAnimationFrame(raf);
        window.removeEventListener("keydown", onKey(true));
      };
      win.app = "ipod";
      return win;
    },
  };

  window.IPodStubApp = app;
})();