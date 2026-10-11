import { esc } from './util.js';
import { open } from './wm.js';
import { registerLauncher } from './launch.js';
import { play } from './audio.js';
import { front } from './wm.js';

function openCalculator() {
  let acc = null;
  let op = null;
  let entry = '0';
  let fresh = true;
  open({
    app: 'calculator',
    title: 'Calculator',
    singleton: true,
    w: 214,
    h: 268,
    minW: 200,
    minH: 250,
    resizable: false,
    scroll: false,
    render(win, body) {
      body.classList.add('calc-body');
      body.innerHTML = `
        <div class="calc">
          <output data-calc-display>0</output>
          <div class="calc-keys">
            ${['C', '±', '÷', '×', '7', '8', '9', '−', '4', '5', '6', '+', '1', '2', '3', '=', '0', '.'].map((key) => `
              <button type="button" data-key="${esc(key)}" class="${key === '=' ? 'eq' : ''} ${key === '0' ? 'zero' : ''}">${key}</button>`).join('')}
          </div>
        </div>`;
      const out = body.querySelector('[data-calc-display]');
      const show = () => { out.textContent = entry; };
      const format = (n) => {
        if (!Number.isFinite(n)) return 'Error';
        const rounded = Math.round(n * 1e8) / 1e8;
        let text = String(rounded);
        if (text.length > 12) text = rounded.toExponential(5);
        return text;
      };
      const apply = (next) => {
        const n = parseFloat(entry);
        if (acc == null || op == null || fresh) acc = n;
        else {
          acc = compute(acc, op, n);
          entry = format(acc);
        }
        op = next;
        fresh = true;
        show();
      };
      const press = (key) => {
        play('click');
        if (key >= '0' && key <= '9') {
          if (fresh || entry === 'Error') {
            entry = key;
            fresh = false;
          } else if (entry.length < 12) entry = entry === '0' ? key : entry + key;
          show();
          return;
        }
        if (key === '.') {
          if (fresh || entry === 'Error') {
            entry = '0.';
            fresh = false;
          } else if (!entry.includes('.')) entry += '.';
          show();
          return;
        }
        if (key === 'C') {
          acc = null;
          op = null;
          entry = '0';
          fresh = true;
          show();
          return;
        }
        if (key === '±') {
          if (entry === 'Error') return;
          entry = format(-parseFloat(entry));
          fresh = false;
          show();
          return;
        }
        if (key === '=') {
          if (op && !fresh && entry !== 'Error') {
            acc = compute(acc, op, parseFloat(entry));
            entry = format(acc);
            op = null;
            fresh = true;
            show();
          }
          return;
        }
        if ('÷×−+'.includes(key)) apply(key);
      };
      body.addEventListener('click', (event) => {
        const key = event.target.closest('[data-key]');
        if (key) press(key.dataset.key);
      });
      win.payload.onKey = (event) => {
        const map = { Enter: '=', Escape: 'C', '*': '×', '/': '÷', '-': '−', '+': '+', c: 'C', C: 'C' };
        const key = map[event.key] || event.key;
        if ('0123456789.=C±÷×−+'.includes(key) || key === 'C') {
          event.preventDefault();
          press(key === 'c' ? 'C' : key);
        }
      };
    },
  });
}

function compute(a, op, b) {
  if (op === '+') return a + b;
  if (op === '−') return a - b;
  if (op === '×') return a * b;
  if (op === '÷') return b === 0 ? NaN : a / b;
  return b;
}

const PAGES = [
  { title: 'The mark', src: '/images/mark-3d.jpg', alt: 'Crispy Goat mark' },
  { title: 'Kit box', src: '/images/kit-box.jpg', alt: 'A kraft kit box' },
  { title: 'On the desk', src: '/images/laptop.jpg', alt: 'A laptop on a desk' },
  { title: 'Studio', src: '/images/studio-bokeh.jpg', alt: 'Studio light behind the mark' },
];

function drawFallback(canvas, title) {
  const g = canvas.getContext('2d');
  g.fillStyle = '#d5e4e8';
  g.fillRect(0, 0, canvas.width, canvas.height);
  g.fillStyle = '#163038';
  g.beginPath();
  g.ellipse(180, 150, 70, 58, 0, 0, Math.PI * 2);
  g.fill();
  g.beginPath();
  g.moveTo(130, 120);
  g.lineTo(110, 60);
  g.lineTo(150, 110);
  g.fill();
  g.beginPath();
  g.moveTo(230, 120);
  g.lineTo(250, 60);
  g.lineTo(210, 110);
  g.fill();
  g.fillStyle = '#fff';
  g.beginPath();
  g.arc(158, 145, 6, 0, Math.PI * 2);
  g.arc(202, 145, 6, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#163038';
  g.font = '16px DeskText, sans-serif';
  g.fillText(title, 16, 28);
  g.fillText('crispygoat', 16, 250);
}

function openScrapbook() {
  let page = 0;
  open({
    app: 'scrapbook',
    title: 'Scrapbook',
    singleton: true,
    w: 440,
    h: 380,
    minW: 320,
    minH: 280,
    scroll: false,
    render(win, body) {
      body.classList.add('scrap-body');
      body.insertAdjacentHTML('afterbegin', `
        <div class="scrap">
          <div class="scrap-frame">
            <img alt="" data-scrap-img />
            <canvas width="360" height="260" data-scrap-fallback hidden></canvas>
          </div>
          <div class="pad-nav">
            <button type="button" data-flip="-1" aria-label="Previous page">◀</button>
            <span data-caption></span>
            <button type="button" data-flip="1" aria-label="Next page">▶</button>
          </div>
        </div>`);
      const img = body.querySelector('[data-scrap-img]');
      const canvas = body.querySelector('[data-scrap-fallback]');
      const caption = body.querySelector('[data-caption]');
      const show = () => {
        const item = PAGES[page];
        caption.textContent = `${item.title}  ·  ${page + 1} / ${PAGES.length}`;
        img.alt = item.alt;
        img.hidden = false;
        canvas.hidden = true;
        img.src = item.src;
      };
      img.addEventListener('error', () => {
        img.hidden = true;
        canvas.hidden = false;
        drawFallback(canvas, PAGES[page].title);
      });
      body.addEventListener('click', (event) => {
        const flip = event.target.closest('[data-flip]');
        if (!flip) return;
        page = (page + Number(flip.dataset.flip) + PAGES.length) % PAGES.length;
        show();
      });
      show();
    },
  });
}

function makePuzzleArt() {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const g = canvas.getContext('2d');
  g.fillStyle = '#6a909b';
  g.fillRect(0, 0, 256, 256);
  g.fillStyle = '#e8eef0';
  g.fillRect(18, 18, 220, 220);
  g.fillStyle = '#163038';
  g.beginPath();
  g.ellipse(128, 140, 62, 50, 0, 0, Math.PI * 2);
  g.fill();
  g.beginPath();
  g.moveTo(86, 110);
  g.lineTo(64, 48);
  g.lineTo(108, 100);
  g.fill();
  g.beginPath();
  g.moveTo(170, 110);
  g.lineTo(192, 48);
  g.lineTo(148, 100);
  g.fill();
  g.fillStyle = '#fff';
  g.beginPath();
  g.arc(108, 136, 7, 0, Math.PI * 2);
  g.arc(148, 136, 7, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = '#163038';
  g.lineWidth = 3;
  g.beginPath();
  g.arc(128, 156, 16, 0.2, Math.PI - 0.2);
  g.stroke();
  return canvas.toDataURL();
}

function openPuzzle() {
  const art = makePuzzleArt();
  let tiles = [...Array(15).keys()].map((n) => n + 1).concat(0);
  const shuffle = () => {
    for (let i = 0; i < 80; i += 1) {
      const empty = tiles.indexOf(0);
      const options = neighbors(empty);
      const pick = options[Math.floor(Math.random() * options.length)];
      [tiles[empty], tiles[pick]] = [tiles[pick], tiles[empty]];
    }
  };
  shuffle();
  open({
    app: 'puzzle',
    title: 'Puzzle',
    singleton: true,
    w: 360,
    h: 420,
    minW: 280,
    minH: 340,
    scroll: false,
    render(win, body) {
      body.classList.add('puzzle-body');
      body.insertAdjacentHTML('afterbegin', `
        <div class="puzzle">
          <div class="puzzle-grid" data-grid></div>
          <div class="pad-nav">
            <button type="button" data-shuffle>Shuffle</button>
            <span data-status>Slide a tile.</span>
          </div>
        </div>`);
      const grid = body.querySelector('[data-grid]');
      const status = body.querySelector('[data-status]');
      const draw = () => {
        grid.innerHTML = tiles.map((n, index) => {
          if (!n) return '<button type="button" class="tile empty" data-i="' + index + '" aria-label="Empty"></button>';
          const col = (n - 1) % 4;
          const row = Math.floor((n - 1) / 4);
          return `<button type="button" class="tile" data-i="${index}" aria-label="Tile ${n}"
            style="background-image:url('${art}');background-size:256px 256px;background-position:${-col * 64}px ${-row * 64}px"><span>${n}</span></button>`;
        }).join('');
        const solved = tiles.every((n, i) => n === (i === 15 ? 0 : i + 1));
        status.textContent = solved ? 'Solved.' : 'Slide a tile.';
      };
      const slide = (index) => {
        const empty = tiles.indexOf(0);
        if (!neighbors(empty).includes(index)) return;
        [tiles[index], tiles[empty]] = [tiles[empty], tiles[index]];
        play('click');
        draw();
      };
      grid.addEventListener('click', (event) => {
        const tile = event.target.closest('[data-i]');
        if (tile) slide(Number(tile.dataset.i));
      });
      body.addEventListener('click', (event) => {
        if (!event.target.closest('[data-shuffle]')) return;
        shuffle();
        draw();
      });
      win.payload.onKey = (event) => {
        const empty = tiles.indexOf(0);
        const row = Math.floor(empty / 4);
        const col = empty % 4;
        const map = {
          ArrowLeft: col < 3 ? empty + 1 : -1,
          ArrowRight: col > 0 ? empty - 1 : -1,
          ArrowUp: row < 3 ? empty + 4 : -1,
          ArrowDown: row > 0 ? empty - 4 : -1,
        };
        if (event.key in map && map[event.key] >= 0) {
          event.preventDefault();
          slide(map[event.key]);
        }
      };
      draw();
    },
  });
}

function neighbors(index) {
  const row = Math.floor(index / 4);
  const col = index % 4;
  const list = [];
  if (col > 0) list.push(index - 1);
  if (col < 3) list.push(index + 1);
  if (row > 0) list.push(index - 4);
  if (row < 3) list.push(index + 4);
  return list;
}

function openBrickout() {
  open({
    app: 'brickout',
    title: 'Brickout',
    singleton: true,
    w: 460,
    h: 420,
    minW: 320,
    minH: 280,
    scroll: false,
    render(win, body) {
      body.classList.add('brick-body');
      body.insertAdjacentHTML('afterbegin', `
        <div class="brick">
          <div class="brick-hud"><span data-score>0</span><span data-lives>3 lives</span></div>
          <canvas data-brick-canvas width="420" height="300"></canvas>
          <p class="brick-help">Move the paddle. Space or click launches the ball.</p>
        </div>`);
      const canvas = body.querySelector('canvas');
      const ctx = canvas.getContext('2d');
      const scoreEl = body.querySelector('[data-score]');
      const livesEl = body.querySelector('[data-lives]');
      const cols = 10;
      const rows = 6;
      const state = {
        paddle: 160,
        ball: { x: 210, y: 250, vx: 2.4, vy: -2.6, r: 4 },
        launched: false,
        lives: 3,
        score: 0,
        over: false,
        bricks: [],
      };
      const resetBricks = () => {
        state.bricks = [];
        for (let r = 0; r < rows; r += 1) {
          for (let c = 0; c < cols; c += 1) {
            state.bricks.push({ c, r, alive: true, solid: (r + c) % 2 === 0 });
          }
        }
      };
      const serve = () => {
        state.ball.x = state.paddle + 28;
        state.ball.y = 268;
        state.ball.vx = 2.3;
        state.ball.vy = -2.7;
        state.launched = false;
      };
      resetBricks();
      serve();
      const draw = () => {
        ctx.fillStyle = '#f4f4f4';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        for (const brick of state.bricks) {
          if (!brick.alive) continue;
          const x = 10 + brick.c * 40;
          const y = 12 + brick.r * 16;
          ctx.fillStyle = brick.solid ? '#161616' : '#f4f4f4';
          ctx.fillRect(x, y, 38, 14);
          ctx.strokeStyle = '#161616';
          ctx.strokeRect(x + 0.5, y + 0.5, 37, 13);
        }
        ctx.fillStyle = '#161616';
        ctx.fillRect(state.paddle, 276, 64, 8);
        ctx.beginPath();
        ctx.arc(state.ball.x, state.ball.y, state.ball.r, 0, Math.PI * 2);
        ctx.fill();
        if (!state.launched && !state.over) {
          ctx.font = '14px DeskText, sans-serif';
          ctx.fillText('Click to launch', 150, 180);
        }
        if (state.over) {
          ctx.font = '16px DeskText, sans-serif';
          ctx.fillText('Game over', 168, 180);
        }
      };
      const step = () => {
        if (!state.launched || state.over) return;
        const ball = state.ball;
        ball.x += ball.vx;
        ball.y += ball.vy;
        if (ball.x < ball.r || ball.x > canvas.width - ball.r) {
          ball.vx *= -1;
          ball.x = Math.max(ball.r, Math.min(canvas.width - ball.r, ball.x));
          play('wall');
        }
        if (ball.y < ball.r) {
          ball.vy *= -1;
          ball.y = ball.r;
          play('wall');
        }
        if (ball.y > 292) {
          state.lives -= 1;
          livesEl.textContent = `${state.lives} live${state.lives === 1 ? '' : 's'}`;
          play('lose');
          if (state.lives <= 0) {
            state.over = true;
            state.launched = false;
          } else serve();
          return;
        }
        if (ball.vy > 0 && ball.y >= 272 && ball.y <= 286 && ball.x >= state.paddle && ball.x <= state.paddle + 64) {
          const hit = (ball.x - state.paddle) / 64 - 0.5;
          ball.vx = hit * 4.2;
          ball.vy = -Math.abs(ball.vy);
          ball.y = 270;
          play('wall');
        }
        for (const brick of state.bricks) {
          if (!brick.alive) continue;
          const x = 10 + brick.c * 40;
          const y = 12 + brick.r * 16;
          if (ball.x > x && ball.x < x + 38 && ball.y > y && ball.y < y + 14) {
            brick.alive = false;
            ball.vy *= -1;
            state.score += 10;
            scoreEl.textContent = String(state.score);
            play('brick');
            if (state.bricks.every((item) => !item.alive)) {
              resetBricks();
              serve();
            }
            break;
          }
        }
      };
      const aim = (event) => {
        const rect = canvas.getBoundingClientRect();
        const x = ((event.clientX - rect.left) / rect.width) * canvas.width;
        state.paddle = Math.max(0, Math.min(canvas.width - 64, x - 32));
        if (!state.launched && !state.over) state.ball.x = state.paddle + 28;
      };
      canvas.addEventListener('pointermove', aim);
      canvas.addEventListener('pointerdown', (event) => {
        aim(event);
        if (state.over) {
          state.over = false;
          state.lives = 3;
          state.score = 0;
          scoreEl.textContent = '0';
          livesEl.textContent = '3 lives';
          resetBricks();
          serve();
          return;
        }
        state.launched = true;
      });
      win.payload.onKey = (event) => {
        if (event.key === 'ArrowLeft') state.paddle = Math.max(0, state.paddle - 16);
        if (event.key === 'ArrowRight') state.paddle = Math.min(canvas.width - 64, state.paddle + 16);
        if (event.key === ' ') {
          event.preventDefault();
          if (state.over) {
            state.over = false;
            state.lives = 3;
            resetBricks();
            serve();
          }
          state.launched = true;
        }
        if (!state.launched) state.ball.x = state.paddle + 28;
      };
      const loop = () => {
        if (!win.el?.isConnected) return;
        if (!win.collapsed) {
          step();
          draw();
        }
        win.payload.raf = requestAnimationFrame(loop);
      };
      win.payload.raf = requestAnimationFrame(loop);
      draw();
    },
    onClose(win) {
      cancelAnimationFrame(win.payload.raf);
    },
  });
}

export function dispatchAppKey(event) {
  const win = front();
  if (!win?.payload?.onKey) return false;
  const tag = document.activeElement?.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA') return false;
  win.payload.onKey(event);
  return true;
}

registerLauncher('calculator', () => openCalculator());
registerLauncher('scrapbook', () => openScrapbook());
registerLauncher('puzzle', () => openPuzzle());
registerLauncher('brickout', () => openBrickout());
