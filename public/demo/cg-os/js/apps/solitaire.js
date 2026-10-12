/* ============================================================
   Solitaire (Klondike) — single-suit simplification, drag & drop.
   ============================================================ */

(function () {
  "use strict";

  const SUITS = ["♠", "♥", "♦", "♣"];
  const SUIT_RED = { "♥": true, "♦": true };
  const RANKS = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];

  function buildDeck() {
    const d = [];
    for (const s of SUITS) for (let i = 0; i < RANKS.length; i++) d.push({ suit: s, rank: RANKS[i], faceUp: false });
    return shuffle(d);
  }
  function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  const app = {
    id: "solitaire",
    name: "Solitaire",
    icon: "cards",
    category: "game",

    launch(opts = {}) {
      const winId = "solitaire_" + Date.now();
      const game = {
        stock: [],
        waste: [],
        foundations: [[], [], [], []],
        tableau: [[], [], [], [], [], [], []],
        moves: 0,
        won: false,
      };

      newGame(game);

      function newGame(g) {
        const deck = buildDeck();
        g.stock.length = 0;
        g.waste.length = 0;
        g.foundations.forEach((f) => f.length = 0);
        g.tableau.forEach((t) => t.length = 0);
        // deal tableau
        let i = 0;
        for (let col = 0; col < 7; col++) {
          for (let row = col; row < 7; row++) {
            const card = deck[i++];
            card.faceUp = (row === col);
            g.tableau[col].push(card);
          }
        }
        // rest to stock
        while (i < deck.length) g.stock.push(deck[i++]);
        g.moves = 0;
        g.won = false;
      }

      const root = document.createElement("div");
      root.className = "solitaire";

      const topRow = document.createElement("div");
      topRow.className = "solitaire-top";
      const stock = makePile();
      const waste = makePile();
      const f1 = makePile(); const f2 = makePile(); const f3 = makePile(); const f4 = makePile();
      [stock, waste, f1, f2, f3, f4].forEach((p) => topRow.appendChild(p));

      const botRow = document.createElement("div");
      botRow.className = "solitaire-bottom";
      const tableaus = [];
      for (let i = 0; i < 7; i++) {
        const t = makePile();
        t.classList.add("tableau");
        tableaus.push(t);
        botRow.appendChild(t);
      }

      const status = document.createElement("div");
      status.className = "solitaire-status";
      const movesEl = document.createElement("div");
      const hintEl = document.createElement("div");
      status.appendChild(movesEl);
      status.appendChild(hintEl);

      const menu = document.createElement("div");
      menu.className = "win-menubar";
      ["Game", "Help"].forEach((m) => {
        const item = document.createElement("span");
        item.className = "win-menubar-item";
        item.textContent = m;
        item.addEventListener("click", () => onMenu(item, m));
        menu.appendChild(item);
      });

      root.appendChild(menu);
      root.appendChild(topRow);
      root.appendChild(botRow);
      root.appendChild(status);

      const win = window.WM.createWindow({
        id: winId,
        title: "Solitaire",
        icon: "cards",
        width: 520, height: 460,
        x: opts.x, y: opts.y,
        persistKey: "solitaire",
        content: (body) => {
          body.style.padding = "0";
          body.appendChild(root);
        },
      });

      function onMenu(item, name) {
        if (name === "Game") {
          window.WM.showContextMenu(item.getBoundingClientRect().left, item.getBoundingClientRect().bottom, [
            { label: "New Game", act: () => { newGame(game); render(); } },
            { label: "Restart This Deal", act: () => { newGame(game); render(); } },
          ]);
        } else if (name === "Help") {
          window.Apps.launch("about", { hint:
            "Build down on the tableau (red on black).\n" +
            "Build up on the foundations by suit.\n" +
            "Click the stock to draw cards. Click a card to try to send it home.\n" +
            "Drag any face-up card."
          });
        }
      }

      function makePile() {
        const p = document.createElement("div");
        p.className = "solitaire-pile";
        p.addEventListener("dragover", (e) => { e.preventDefault(); });
        p.addEventListener("drop", (e) => onDrop(p, e));
        return p;
      }

      function render() {
        movesEl.textContent = "Moves: " + game.moves;
        hintEl.textContent = game.won ? "🏆 You won!" : "Click stock to draw";
        renderPile(stock, game.stock, false);
        renderPile(waste, game.waste, true);
        for (let i = 0; i < 4; i++) renderPile([f1, f2, f3, f4][i], game.foundations[i], true);
        for (let i = 0; i < 7; i++) renderTableau(tableaus[i], game.tableau[i]);
      }

      function renderPile(hostEl, pile, fanUp) {
        hostEl.innerHTML = "";
        if (pile.length === 0) {
          hostEl.style.border = "2px dashed rgba(255,255,255,0.4)";
          return;
        }
        hostEl.style.border = "none";
        const card = pile[pile.length - 1];
        const cardEl = cardElFor(card);
        cardEl.style.position = "absolute";
        cardEl.style.left = "4px";
        cardEl.style.top = "4px";
        hostEl.appendChild(cardEl);
        if (fanUp && pile.length > 1) {
          // show a tiny stack indicator
          const c = pile.length - 2;
          const ghost = document.createElement("div");
          ghost.style.position = "absolute";
          ghost.style.right = "4px";
          ghost.style.top = (4 + c * 2) + "px";
          ghost.style.fontSize = "10px";
          ghost.style.color = "rgba(255,255,255,0.6)";
          ghost.textContent = "+" + (pile.length - 1);
          hostEl.appendChild(ghost);
        }
      }

      function renderTableau(hostEl, pile) {
        hostEl.innerHTML = "";
        pile.forEach((card, idx) => {
          const el = cardElFor(card);
          el.style.top = (4 + idx * 14) + "px";
          el.style.left = "4px";
          hostEl.appendChild(el);
        });
      }

      function cardElFor(card) {
        const el = document.createElement("div");
        el.className = "solitaire-card" + (SUIT_RED[card.suit] ? " red" : "") + (card.faceUp ? "" : " face-down");
        el.draggable = card.faceUp;
        if (card.faceUp) {
          el.innerHTML = `<div class="card-rank">${card.rank}</div><div class="card-suit">${card.suit}</div>`;
        }
        el.dataset.cardId = card.suit + card.rank + (card.faceUp ? "u" : "d");
        el.addEventListener("dragstart", (e) => {
          e.dataTransfer.setData("text/plain", el.dataset.cardId);
          e.dataTransfer.effectAllowed = "move";
        });
        el.addEventListener("dblclick", () => tryAutoHome(el));
        return el;
      }

      // ----- interactions -----
      stock.addEventListener("click", () => {
        if (game.stock.length === 0) {
          // recycle
          while (game.waste.length) {
            const c = game.waste.pop();
            c.faceUp = false;
            game.stock.push(c);
          }
        } else {
          const c = game.stock.pop();
          c.faceUp = true;
          game.waste.push(c);
        }
        game.moves++;
        render();
      });

      function onDrop(target, e) {
        e.preventDefault();
        const id = e.dataTransfer.getData("text/plain");
        if (!id) return;
        const card = findCard(id);
        if (!card) return;
        moveCardTo(card.card, card.from, target);
      }

      function findCard(id) {
        // tableau
        for (let i = 0; i < 7; i++) {
          const t = game.tableau[i];
          for (let k = 0; k < t.length; k++) {
            const c = t[k];
            if ((c.suit + c.rank + (c.faceUp ? "u" : "d")) === id) {
              if (!c.faceUp) return null;
              return { card: c, from: { type: "tableau", idx: i, startIdx: k } };
            }
          }
        }
        if (game.waste.length) {
          const c = game.waste[game.waste.length - 1];
          if ((c.suit + c.rank + (c.faceUp ? "u" : "d")) === id) {
            return { card: c, from: { type: "waste" } };
          }
        }
        for (let i = 0; i < 4; i++) {
          const f = game.foundations[i];
          if (f.length) {
            const c = f[f.length - 1];
            if ((c.suit + c.rank + (c.faceUp ? "u" : "d")) === id) {
              return { card: c, from: { type: "foundation", idx: i } };
            }
          }
        }
        return null;
      }

      function moveCardTo(card, from, target) {
        const targetPile = pileFromEl(target);
        if (!targetPile) return;
        if (!canMove(card, from, targetPile)) return;

        // remove from source, taking any attached run for tableau
        const movingRun = [];
        if (from.type === "tableau") {
          const t = game.tableau[from.idx];
          for (let k = from.startIdx; k < t.length; k++) movingRun.push(t[k]);
          t.length = from.startIdx;
          if (t.length && !t[t.length - 1].faceUp) t[t.length - 1].faceUp = true;
        } else if (from.type === "waste") {
          movingRun.push(game.waste.pop());
        } else if (from.type === "foundation") {
          movingRun.push(game.foundations[from.idx].pop());
        }
        // add to destination
        movingRun.forEach((c) => { c.faceUp = true; targetPile.pile.push(c); });
        game.moves++;
        checkWin();
        render();
      }

      function pileFromEl(el) {
        if (el === stock) return { type: "stock", pile: game.stock };
        if (el === waste) return { type: "waste", pile: game.waste };
        if (el === f1) return { type: "foundation", idx: 0, pile: game.foundations[0] };
        if (el === f2) return { type: "foundation", idx: 1, pile: game.foundations[1] };
        if (el === f3) return { type: "foundation", idx: 2, pile: game.foundations[2] };
        if (el === f4) return { type: "foundation", idx: 3, pile: game.foundations[3] };
        for (let i = 0; i < 7; i++) if (el === tableaus[i]) return { type: "tableau", idx: i, pile: game.tableau[i] };
        return null;
      }

      function canMove(card, from, dest) {
        if (dest.type === "tableau") {
          if (dest.pile.length === 0) return card.rank === "K";
          const top = dest.pile[dest.pile.length - 1];
          return top.faceUp && SUIT_RED[top.suit] !== SUIT_RED[card.suit] && rankIdx(top.rank) === rankIdx(card.rank) + 1;
        }
        if (dest.type === "foundation") {
          // only single card onto foundation
          if (from.type === "tableau" && from.startIdx !== game.tableau[from.idx].length - 1) return false;
          if (dest.pile.length === 0) return card.rank === "A";
          const top = dest.pile[dest.pile.length - 1];
          return top.suit === card.suit && rankIdx(top.rank) === rankIdx(card.rank) - 1;
        }
        return false;
      }

      function tryAutoHome(el) {
        const found = findCard(el.dataset.cardId);
        if (!found) return;
        // try foundations
        for (let i = 0; i < 4; i++) {
          const target = { type: "foundation", idx: i, pile: game.foundations[i] };
          if (canMove(found.card, found.from, target)) {
            moveCardTo(found.card, found.from, [f1, f2, f3, f4][i]);
            return;
          }
        }
      }

      function rankIdx(r) { return RANKS.indexOf(r); }
      function checkWin() {
        game.won = game.foundations.every((f) => f.length === 13);
      }

      render();
      win.getAppState = () => ({ moves: game.moves });
      win.app = "solitaire";
      return win;
    },
  };

  window.SolitaireApp = app;
})();