/* ============================================================
   Minesweeper — Beginner / Intermediate / Expert / Custom.
   Left-click reveals, right-click flags, double-click opens neighbors.
   ============================================================ */

(function () {
  "use strict";

  const DIFF = {
    Beginner:     { rows: 9,  cols: 9,  mines: 10 },
    Intermediate: { rows: 16, cols: 16, mines: 40 },
    Expert:       { rows: 16, cols: 30, mines: 99 },
  };

  const app = {
    id: "minesweeper",
    name: "Minesweeper",
    icon: "mine",
    category: "game",

    launch(opts = {}) {
      const winId = "minesweeper_" + Date.now();
      let diff = opts.state?.diff || "Beginner";
      const game = makeGame(diff);

      const bar = document.createElement("div");
      bar.className = "mine-bar";
      const mineCountEl = document.createElement("div");
      mineCountEl.className = "led";
      const timeEl = document.createElement("div");
      timeEl.className = "led";
      mineCountEl.textContent = String(game.mineCount).padStart(3, "0");
      timeEl.textContent = "000";

      const face = document.createElement("button");
      face.className = "mine-face";
      face.type = "button";
      face.textContent = "🙂";

      bar.appendChild(mineCountEl);
      bar.appendChild(face);
      bar.appendChild(timeEl);

      const grid = document.createElement("div");
      grid.className = "mine-grid";
      grid.style.gridTemplateColumns = `repeat(${game.cols}, 22px)`;

      const wrap = document.createElement("div");
      wrap.className = "mine";
      const menu = document.createElement("div");
      menu.className = "win-menubar";
      ["Game", "Help"].forEach((m) => {
        const item = document.createElement("span");
        item.className = "win-menubar-item";
        item.textContent = m;
        item.addEventListener("click", () => onMenu(item, m));
        menu.appendChild(item);
      });

      wrap.appendChild(menu);
      wrap.appendChild(bar);
      wrap.appendChild(grid);

      const win = window.WM.createWindow({
        id: winId,
        title: "Minesweeper",
        icon: "mine",
        width: 320, height: 380,
        x: opts.x, y: opts.y,
        persistKey: "minesweeper",
        content: (body) => {
          body.style.padding = "0";
          body.appendChild(wrap);
          queueMicrotask(() => { resetGame(); startTimer(); });
        },
      });

      let timerHandle = null;
      let elapsed = 0;
      function startTimer() {
        if (timerHandle) clearInterval(timerHandle);
        timerHandle = setInterval(() => {
          elapsed = Math.min(999, elapsed + 1);
          timeEl.textContent = String(elapsed).padStart(3, "0");
        }, 1000);
      }
      function stopTimer() { if (timerHandle) { clearInterval(timerHandle); timerHandle = null; } }

      function onMenu(item, name) {
        if (name === "Game") {
          window.WM.showContextMenu(item.getBoundingClientRect().left, item.getBoundingClientRect().bottom, [
            { label: "New", act: () => resetGame() },
            "-",
            ...Object.keys(DIFF).map((d) => ({ label: (diff === d ? "✓ " : "") + d, act: () => { diff = d; resetGame(); } })),
            { label: "Custom…", act: () => customDialog() },
          ]);
        } else if (name === "Help") {
          window.WM.showContextMenu(item.getBoundingClientRect().left, item.getBoundingClientRect().bottom, [
            { label: "How to play", act: () => {
              window.Apps.launch("about", { hint:
                "Left-click to reveal a cell.\n" +
                "Right-click to flag a suspected mine.\n" +
                "Double-click a revealed cell to open its neighbors (when flags match).\n" +
                "Reveal all non-mine cells to win."
              });
            }},
            { label: "About", act: () => window.Apps.launch("about") },
          ]);
        }
      }

      function customDialog() {
        const r = prompt("Custom: rows,cols,mines (e.g. 12,12,20)", "12,12,20");
        if (!r) return;
        const m = r.match(/^\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*$/);
        if (!m) { alert("Bad format"); return; }
        const rows = Math.min(24, Math.max(5, +m[1]));
        const cols = Math.min(40, Math.max(5, +m[2]));
        const mines = Math.min(rows * cols - 1, Math.max(1, +m[3]));
        diff = "Custom";
        Object.assign(game, makeGame("Custom", rows, cols, mines));
        resetGame();
      }

      function resetGame() {
        stopTimer();
        elapsed = 0;
        timeEl.textContent = "000";
        face.textContent = "🙂";
        game.revealed = 0;
        game.flags = 0;
        game.board = Array.from({ length: game.rows }, () => Array(game.cols).fill(null).map(() => ({ mine: false, open: false, flag: false, n: 0 })));
        game.firstClick = true;
        game.over = false;
        mineCountEl.textContent = String(game.mineCount).padStart(3, "0");
        render();
      }

      function makeGame(d, rows, cols, mines) {
        const def = DIFF[d] || DIFF.Beginner;
        return {
          diff: d,
          rows: rows || def.rows,
          cols: cols || def.cols,
          mineCount: mines || def.mines,
          board: [],
          revealed: 0,
          flags: 0,
          firstClick: true,
          over: false,
        };
      }

      function placeMines(safeR, safeC) {
        const placed = new Set([`${safeR},${safeC}`]);
        let m = 0;
        while (m < game.mineCount) {
          const r = Math.floor(Math.random() * game.rows);
          const c = Math.floor(Math.random() * game.cols);
          const k = `${r},${c}`;
          if (placed.has(k)) continue;
          placed.add(k);
          game.board[r][c].mine = true;
          m++;
        }
        for (let r = 0; r < game.rows; r++) {
          for (let c = 0; c < game.cols; c++) {
            if (game.board[r][c].mine) continue;
            let n = 0;
            for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
              if (!dr && !dc) continue;
              const nr = r + dr, nc = c + dc;
              if (nr < 0 || nr >= game.rows || nc < 0 || nc >= game.cols) continue;
              if (game.board[nr][nc].mine) n++;
            }
            game.board[r][c].n = n;
          }
        }
      }

      function render() {
        grid.style.gridTemplateColumns = `repeat(${game.cols}, 22px)`;
        grid.innerHTML = "";
        for (let r = 0; r < game.rows; r++) {
          for (let c = 0; c < game.cols; c++) {
            const cell = game.board[r][c];
            const el = document.createElement("div");
            el.className = "mine-cell";
            el.dataset.r = r; el.dataset.c = c;
            if (cell.open) {
              el.classList.add("is-open");
              if (cell.mine) el.classList.add("is-mine");
              else if (cell.n) { el.classList.add("n" + cell.n); el.textContent = cell.n; }
            } else if (cell.flag) {
              el.classList.add("is-flag");
            }
            el.addEventListener("mousedown", (e) => {
              if (game.over) return;
              if (e.button === 2) {
                e.preventDefault();
                cell.flag = !cell.flag;
                game.flags += cell.flag ? 1 : -1;
                mineCountEl.textContent = String(Math.max(0, game.mineCount - game.flags)).padStart(3, "0");
                render();
                if (checkWin()) winGame();
                return;
              }
              if (e.button === 0) {
                face.textContent = "😮";
                if (cell.open && cell.n) chord(r, c);
                else reveal(r, c);
                render();
                if (game.over && cell.mine) loseGame(r, c);
                else if (checkWin()) winGame();
              }
            });
            el.addEventListener("mouseup", () => { if (!game.over) face.textContent = "🙂"; });
            el.addEventListener("mouseleave", () => { if (!game.over) face.textContent = "🙂"; });
            el.addEventListener("dblclick", () => { if (game.over) return; chord(r, c); render(); });
            el.addEventListener("contextmenu", (e) => e.preventDefault());
            grid.appendChild(el);
          }
        }
        face.textContent = game.over ? "😵" : (game.flags === game.mineCount && game.revealed + game.flags === game.rows * game.cols ? "😎" : "🙂");
      }

      function reveal(r, c) {
        if (r < 0 || r >= game.rows || c < 0 || c >= game.cols) return;
        const cell = game.board[r][c];
        if (cell.open || cell.flag) return;
        if (game.firstClick) { placeMines(r, c); game.firstClick = false; }
        cell.open = true;
        game.revealed++;
        if (cell.mine) { game.over = true; return; }
        if (cell.n === 0) {
          for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
            if (!dr && !dc) continue;
            reveal(r + dr, c + dc);
          }
        }
      }

      function chord(r, c) {
        const cell = game.board[r][c];
        if (!cell.open || !cell.n) return;
        let f = 0;
        for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
          if (!dr && !dc) continue;
          const nr = r + dr, nc = c + dc;
          if (nr < 0 || nr >= game.rows || nc < 0 || nc >= game.cols) continue;
          if (game.board[nr][nc].flag) f++;
        }
        if (f === cell.n) {
          for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
            if (!dr && !dc) continue;
            const nr = r + dr, nc = c + dc;
            if (nr < 0 || nr >= game.rows || nc < 0 || nc >= game.cols) continue;
            if (!game.board[nr][nc].flag) reveal(nr, nc);
          }
        }
      }

      function checkWin() {
        let safe = 0;
        for (let r = 0; r < game.rows; r++) for (let c = 0; c < game.cols; c++) {
          if (!game.board[r][c].mine) safe++;
        }
        return game.revealed === safe;
      }

      function loseGame(r, c) {
        // reveal all mines
        for (let r2 = 0; r2 < game.rows; r2++) for (let c2 = 0; c2 < game.cols; c2++) {
          if (game.board[r2][c2].mine) game.board[r2][c2].open = true;
        }
        face.textContent = "😵";
        stopTimer();
        render();
        setTimeout(() => {
          if (confirm("Boom! You hit a mine. Try again?")) resetGame();
        }, 50);
      }

      function winGame() {
        face.textContent = "😎";
        stopTimer();
        // flag remaining mines automatically
        for (let r = 0; r < game.rows; r++) for (let c = 0; c < game.cols; c++) {
          if (game.board[r][c].mine && !game.board[r][c].flag) {
            game.board[r][c].flag = true;
          }
        }
        mineCountEl.textContent = String(0).padStart(3, "0");
        render();
        setTimeout(() => {
          if (confirm(`You won in ${elapsed}s! Play again?`)) resetGame();
        }, 50);
      }

      win.getAppState = () => ({ diff });
      win.app = "minesweeper";
      return win;
    },
  };

  window.MinesweeperApp = app;
})();