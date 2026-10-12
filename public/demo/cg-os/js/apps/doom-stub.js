/* ============================================================
   Doom stub — pseudo-3D raycaster mini-demo (no assets).
   WASD to move, mouse to look, click to "fire" (visual flash).
   ============================================================ */

(function () {
  "use strict";

  const MAP_W = 16, MAP_H = 16;
  const MAP = [
    "################",
    "#..............#",
    "#..#...........#",
    "#..#.....#.....#",
    "#..#.....#.....#",
    "#........#.....#",
    "#..............#",
    "#.....##.......#",
    "#.....##.......#",
    "#..............#",
    "#..............#",
    "#....#.........#",
    "#....#.........#",
    "#....#.........#",
    "#..............#",
    "################",
  ];

  const app = {
    id: "doom",
    name: "DOOM",
    icon: "doom",
    category: "demo",

    launch(opts = {}) {
      const winId = "doom_" + Date.now();
      const state = {
        px: 2.5, py: 2.5, pangle: 0,
        keys: {},
        fireFlash: 0,
        health: 100, ammo: 50, kills: 0,
      };

      const W = 320, H = 200;
      const canvas = document.createElement("canvas");
      canvas.width = W;
      canvas.height = H;
      canvas.style.width = "100%";
      canvas.style.height = "100%";
      canvas.style.imageRendering = "pixelated";

      const stub = document.createElement("div");
      stub.className = "stub";
      stub.appendChild(canvas);

      const info = document.createElement("div");
      info.className = "stub-info";
      info.innerHTML = `
        <span class="stub-stage">E1M1: CG HANGAR</span>
        <span>HP <b id="d-hp">100</b></span>
        <span>AMMO <b id="d-ammo">50</b></span>
        <span>KILLS <b id="d-kills">0</b></span>
      `;
      stub.appendChild(info);

      const hint = document.createElement("div");
      hint.style.fontSize = "11px";
      hint.style.color = "#888";
      hint.innerHTML = "WASD or IJKL to move · mouse drag to look · click to shoot · R to restart";
      stub.appendChild(hint);

      const ctx = canvas.getContext("2d");

      // input
      canvas.tabIndex = 0;
      const onKey = (down) => (e) => {
        const k = e.key.toLowerCase();
        state.keys[k] = down;
        if (down && k === "r") {
          state.px = 2.5; state.py = 2.5; state.pangle = 0;
          state.health = 100; state.ammo = 50; state.kills = 0;
        }
      };
      window.addEventListener("keydown", onKey(true));
      window.addEventListener("keyup", onKey(false));

      let dragging = false, lastX = 0;
      canvas.addEventListener("mousedown", (e) => {
        if (e.button === 0) {
          if (state.ammo > 0) {
            state.ammo = Math.max(0, state.ammo - 1);
            state.fireFlash = 8;
            // random kill for the vibe
            if (Math.random() < 0.3) state.kills++;
          }
        } else {
          dragging = true; lastX = e.clientX;
        }
      });
      window.addEventListener("mouseup", () => dragging = false);
      window.addEventListener("mousemove", (e) => {
        if (!dragging) return;
        state.pangle += (e.clientX - lastX) * 0.005;
        lastX = e.clientX;
      });

      // game loop
      let raf;
      function tick() {
        // movement
        const speed = 0.06;
        let dx = 0, dy = 0;
        if (state.keys["w"] || state.keys["i"] || state.keys["arrowup"]) { dx += Math.cos(state.pangle) * speed; dy += Math.sin(state.pangle) * speed; }
        if (state.keys["s"] || state.keys["k"] || state.keys["arrowdown"]) { dx -= Math.cos(state.pangle) * speed; dy -= Math.sin(state.pangle) * speed; }
        if (state.keys["a"] || state.keys["j"]) { dx += Math.cos(state.pangle - Math.PI / 2) * speed; dy += Math.sin(state.pangle - Math.PI / 2) * speed; }
        if (state.keys["d"] || state.keys["l"]) { dx += Math.cos(state.pangle + Math.PI / 2) * speed; dy += Math.sin(state.pangle + Math.PI / 2) * speed; }
        if (state.keys["q"]) state.pangle -= 0.04;
        if (state.keys["e"]) state.pangle += 0.04;
        if (!collide(state.px + dx, state.py)) state.px += dx;
        if (!collide(state.px, state.py + dy)) state.py += dy;
        if (state.fireFlash > 0) state.fireFlash--;

        render();
        raf = requestAnimationFrame(tick);
      }
      function collide(x, y) {
        const ix = Math.floor(x), iy = Math.floor(y);
        if (ix < 0 || iy < 0 || ix >= MAP_W || iy >= MAP_H) return true;
        return MAP[iy][ix] === "#";
      }

      function render() {
        // sky / floor
        const grad = ctx.createLinearGradient(0, 0, 0, H);
        grad.addColorStop(0, "#3a0a0a");
        grad.addColorStop(0.5, "#1a0505");
        grad.addColorStop(0.5, "#1a0a05");
        grad.addColorStop(1, "#2a1a0a");
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, W, H);

        // raycaster
        const fov = Math.PI / 3;
        for (let x = 0; x < W; x++) {
          const rayAngle = state.pangle - fov / 2 + (x / W) * fov;
          const dx = Math.cos(rayAngle), dy = Math.sin(rayAngle);
          let dist = 0;
          let hit = false;
          let side = 0;
          while (dist < 16) {
            dist += 0.02;
            const px = state.px + dx * dist;
            const py = state.py + dy * dist;
            const ix = Math.floor(px), iy = Math.floor(py);
            if (ix < 0 || iy < 0 || ix >= MAP_W || iy >= MAP_H) { hit = true; break; }
            if (MAP[iy][ix] === "#") { hit = true; break; }
          }
          if (!hit) continue;
          const corrected = dist * Math.cos(rayAngle - state.pangle);
          const wallH = Math.min(H, Math.round(H / corrected));
          const top = Math.floor((H - wallH) / 2);
          const shade = Math.max(0.2, 1 - corrected / 12);
          const r = Math.round(180 * shade);
          const g = Math.round(40 * shade);
          const b = Math.round(40 * shade);
          ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
          ctx.fillRect(x, top, 1, wallH);
          // edge highlight
          ctx.fillStyle = `rgba(255,80,40,${0.4 * shade})`;
          ctx.fillRect(x, top, 1, 1);
        }

        // muzzle flash
        if (state.fireFlash > 0) {
          ctx.fillStyle = "rgba(255,200,80,0.7)";
          ctx.fillRect(W * 0.45, H * 0.55, W * 0.1, H * 0.1);
          ctx.fillStyle = "rgba(255,80,40,0.3)";
          ctx.fillRect(0, H * 0.55, W, H * 0.2);
        }

        // crosshair
        ctx.strokeStyle = "#6fff38";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(W / 2 - 6, H / 2); ctx.lineTo(W / 2 - 2, H / 2);
        ctx.moveTo(W / 2 + 2, H / 2); ctx.lineTo(W / 2 + 6, H / 2);
        ctx.moveTo(W / 2, H / 2 - 6); ctx.lineTo(W / 2, H / 2 - 2);
        ctx.moveTo(W / 2, H / 2 + 2); ctx.lineTo(W / 2, H / 2 + 6);
        ctx.stroke();

        // weapon stub
        ctx.fillStyle = "#404040";
        ctx.fillRect(W * 0.55, H * 0.55, W * 0.18, H * 0.4);
        ctx.fillStyle = "#202020";
        ctx.fillRect(W * 0.55, H * 0.55, W * 0.18, H * 0.05);

        // HUD numbers
        const hp = stub.querySelector("#d-hp"); if (hp) hp.textContent = String(state.health);
        const ammo = stub.querySelector("#d-ammo"); if (ammo) ammo.textContent = String(state.ammo);
        const kills = stub.querySelector("#d-kills"); if (kills) kills.textContent = String(state.kills);
      }

      const win = window.WM.createWindow({
        id: winId,
        title: "DOOM — Crispy Goat Edition",
        icon: "doom",
        width: 560, height: 420,
        x: opts.x, y: opts.y,
        persistKey: "doom-stub",
        content: (body) => {
          body.style.padding = "0";
          body.appendChild(stub);
          setTimeout(() => canvas.focus(), 0);
        },
      });
      win.onClose = () => {
        cancelAnimationFrame(raf);
        window.removeEventListener("keydown", onKey(true));
        window.removeEventListener("keyup", onKey(false));
      };
      win.app = "doom";
      return win;
    },
  };

  window.DoomStubApp = app;
})();