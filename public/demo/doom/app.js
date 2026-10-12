/* =============================================================
   DOOM — Web Edition
   Vanilla JavaScript raycasting FPS.
   Single-file game: engine + audio + game state + main loop.
   ============================================================= */

// Catch all errors for debugging
window.__doomErrors = [];
window.addEventListener('error', (e) => {
  window.__doomErrors.push({ msg: e.message, src: e.filename, line: e.lineno, col: e.colno, stack: e.error?.stack });
});
window.addEventListener('unhandledrejection', (e) => {
  window.__doomErrors.push({ promise: true, msg: e.reason?.message || String(e.reason) });
});

(() => {
'use strict';

// ============================================================
// CONSTANTS
// ============================================================

const SCREEN_W      = 640;
const SCREEN_H      = 400;
const HALF_H        = SCREEN_H >> 1;
const TEX_SIZE      = 64;
const SPRITE_SIZE   = 128;       // square bitmap for any sprite
const FOV           = Math.PI / 3;   // 60 degrees
const HALF_FOV      = FOV / 2;

const MOVE_SPEED    = 2.4;       // units / sec
const STRAFE_SPEED  = 1.9;
const RUN_FACTOR    = 1.45;
const ROT_KEY_SPEED = 2.2;       // rad / sec
const MOUSE_SENS    = 0.0028;    // rad / px

const MAX_ENEMIES   = 64;
const MAX_PROJ      = 96;
const MAX_PICKUPS   = 64;

const MAP_EMPTY  = 0;
const MAP_WALL_A = 1;
const MAP_WALL_B = 2;
const MAP_WALL_C = 3;
const MAP_WALL_D = 4;
const MAP_DOOR   = 5;

// ============================================================
// UTILITIES
// ============================================================

const TAU = Math.PI * 2;

function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
function lerp(a, b, t)    { return a + (b - a) * t; }
function dist2(ax, ay, bx, by) {
  const dx = ax - bx, dy = ay - by;
  return dx * dx + dy * dy;
}

// Cache a color (string) into an [r,g,b] triplet in a pool
const COL = new Map();
function hex(c) {
  if (COL.has(c)) return COL.get(c);
  const h = c.replace('#','');
  const r = +('0x' + h.slice(0,2));
  const g = +('0x' + h.slice(2,4));
  const b = +('0x' + h.slice(4,6));
  const arr = [r, g, b];
  COL.set(c, arr);
  return arr;
}
function mix(c1, c2, t) {
  const a = hex(c1), b = hex(c2);
  return [
    Math.round(lerp(a[0], b[0], t)),
    Math.round(lerp(a[1], b[1], t)),
    Math.round(lerp(a[2], b[2], t)),
  ];
}
function rgbStr([r,g,b], a = 255) {
  // Pack RGBA as little-endian uint32 so direct writes to a Uint32Array
  // view of an ImageData buffer land in the correct R,G,B,A byte order.
  return ((a & 0xff) << 24) | ((b & 0xff) << 16) | ((g & 0xff) << 8) | (r & 0xff);
}
function shade(c, s) {
  const a = hex(c);
  return [Math.round(a[0]*s), Math.round(a[1]*s), Math.round(a[2]*s)];
}

// ============================================================
// LEVELS
// ============================================================
// Tile legend:
//   # = solid wall
//   . = empty
//   1-4 = decorated wall variant
//   D = locked door (auto-opens on approach)
//   P = player start (also marked in `spawn` for angle)

const LEVELS = [
  // ------------------------------------------------------------
  // E1M1: HANGER  — small introduction, 4 zombies
  // ------------------------------------------------------------
  {
    name: 'E1M1: HANGER',
    sky:    '#220c08',
    floor:  '#3a1c14',
    ceil:   '#1c100a',
    fog:    '#1a0a08',
    ambient: 0.55,
    music: 'e1m1',
    spawn: { x: 2.5, y: 2.5, dir: 0 },
    spawns: [
      { type: 'zombie', x:  6.5, y: 4.5 },
      { type: 'zombie', x: 10.5, y: 6.5 },
      { type: 'zombie', x: 12.5, y: 2.5 },
      { type: 'zombie', x:  5.5, y: 9.5 },
    ],
    pickups: [
      { type: 'ammo_pistol',  x: 11.5, y: 3.5 },
      { type: 'stimpack',     x:  4.5, y: 6.5 },
    ],
    map: [
      '################',
      '#..............#',
      '#..####..####..#',
      '#..#......#.....#',
      '#..#......#.....#',
      '#..............#',
      '#......##......#',
      '#......##......#',
      '#..............#',
      '#..##......##..#',
      '#..##......##..#',
      '#..............#',
      '################',
    ],
  },

  // ------------------------------------------------------------
  // E1M2: ARMORY — zombies + imps, shotgun + chainsaw ammo
  // ------------------------------------------------------------
  {
    name: 'E1M2: ARMORY',
    sky:   '#180808',
    floor: '#301410',
    ceil:  '#160808',
    fog:   '#0e0404',
    ambient: 0.5,
    music: 'e1m2',
    spawn: { x: 2.5, y: 2.5, dir: 0 },
    spawns: [
      { type: 'zombie', x:  5.5, y: 5.5 },
      { type: 'zombie', x:  9.5, y: 3.5 },
      { type: 'imp',    x: 14.5, y: 6.5 },
      { type: 'imp',    x: 11.5, y: 9.5 },
      { type: 'zombie', x:  4.5, y: 11.5 },
      { type: 'imp',    x:  6.5, y: 14.5 },
    ],
    pickups: [
      { type: 'shotgun',     x: 8.5, y: 7.5 },
      { type: 'ammo_shotgun', x: 9.5, y: 7.5 },
      { type: 'stimpack',     x: 3.5, y: 9.5 },
      { type: 'ammo_pistol',  x: 13.5, y: 4.5 },
    ],
    map: [
      '##################',
      '#................#',
      '#.####...#########',
      '#.#..#............#',
      '#.#..####..####..#',
      '#.#.....#..#.....#',
      '#.#.D...#..#.....#',
      '#.######..######.#',
      '#................D',
      '#.####..####.....#',
      '#.#..#..#..#.....#',
      '#.#..#..#..#.....#',
      '#.#..####..#.....#',
      '#.#.........#....#',
      '#.#######...#....#',
      '#.........###....#',
      '##################',
    ],
  },

  // ------------------------------------------------------------
  // E1M3: LAB — cacodemons + imps, more ammo
  // ------------------------------------------------------------
  {
    name: 'E1M3: LAB',
    sky:   '#1a0a14',
    floor: '#2a1024',
    ceil:  '#180a14',
    fog:   '#0a040a',
    ambient: 0.5,
    music: 'e1m3',
    spawn: { x: 2.5, y: 2.5, dir: 0 },
    spawns: [
      { type: 'imp',       x:  6.5, y: 5.5 },
      { type: 'imp',       x:  9.5, y: 3.5 },
      { type: 'cacodemon', x: 12.5, y: 8.5 },
      { type: 'imp',       x:  4.5, y: 11.5 },
      { type: 'cacodemon', x: 14.5, y: 6.5 },
      { type: 'lost_soul', x:  7.5, y: 14.5 },
      { type: 'imp',       x: 11.5, y: 12.5 },
    ],
    pickups: [
      { type: 'ammo_pistol',  x: 5.5, y: 8.5 },
      { type: 'stimpack',     x: 8.5, y: 13.5 },
      { type: 'ammo_pistol',  x: 14.5, y: 3.5 },
    ],
    map: [
      '##################',
      '#................#',
      '#.####..####.....#',
      '#.#..#..#..#.....#',
      '#.#..####..#.....#',
      '#.#........#.....#',
      '#.######.##......#',
      '#................#',
      '#.##..#####.####.#',
      '#.##......#.#....#',
      '#.........#......#',
      '#......##........#',
      '#.####.##........#',
      '#.#..#.....####..#',
      '#.#..#.....#..#..#',
      '#.####.....####..#',
      '##################',
    ],
  },

  // ------------------------------------------------------------
  // E1M4: CORRIDORS — demons + lost souls, tight choke points
  // ------------------------------------------------------------
  {
    name: 'E1M4: CORRIDORS',
    sky:   '#220806',
    floor: '#3a1408',
    ceil:  '#1a0804',
    fog:   '#120402',
    ambient: 0.45,
    music: 'e1m4',
    spawn: { x: 2.5, y: 2.5, dir: 0 },
    spawns: [
      { type: 'demon',    x:  6.5, y: 5.5 },
      { type: 'lost_soul',x:  9.5, y: 4.5 },
      { type: 'imp',      x: 12.5, y: 7.5 },
      { type: 'demon',    x: 14.5, y: 5.5 },
      { type: 'lost_soul',x:  4.5, y: 9.5 },
      { type: 'imp',      x: 10.5, y: 11.5 },
      { type: 'demon',    x:  6.5, y: 14.5 },
      { type: 'lost_soul',x: 13.5, y: 12.5 },
    ],
    pickups: [
      { type: 'ammo_shotgun', x:  7.5, y: 8.5 },
      { type: 'stimpack',     x: 11.5, y: 9.5 },
      { type: 'ammo_pistol',  x: 14.5, y: 10.5 },
      { type: 'stimpack',     x:  3.5, y: 13.5 },
    ],
    map: [
      '##################',
      '#................#',
      '##.##.##.##.##.##.#',
      '#..#..#..#..#..#.#',
      '#.##.##.##.##.##.#',
      '#................#',
      '###..########..###',
      '#.................#',
      '#.#####.#####.....#',
      '#.#...#.#...#.....#',
      '#.#.#.#.#.#.#.....#',
      '#.#.#.#.#.#.#.....#',
      '#...#...#...#.....#',
      '#####.#####.######',
      '#.................#',
      '###################',
    ],
  },

  // ------------------------------------------------------------
  // E1M5: INFERNO — final boss arena, cyberdemon + spawn waves
  // ------------------------------------------------------------
  {
    name: 'E1M5: INFERNO',
    sky:   '#2a0606',
    floor: '#4a1408',
    ceil:  '#220404',
    fog:   '#180202',
    ambient: 0.4,
    music: 'e1m5',
    spawn: { x: 1.5, y: 9.5, dir: 0 },
    spawns: [
      { type: 'cyberdemon', x: 12.5, y: 9.5 },
    ],
    pickups: [
      { type: 'super_shotgun_ammo', x: 1.5, y: 9.5 },
      { type: 'mega_armor',         x: 1.5, y: 5.5 },
      { type: 'super_shotgun_ammo', x: 1.5, y: 13.5 },
    ],
    map: [
      '######################',
      '#....................#',
      '#....................#',
      '#....................#',
      '#....................#',
      '#....................#',
      '#....................#',
      '#....................#',
      '#####............#####',
      '#....................#',
      '#####............#####',
      '#....................#',
      '#....................#',
      '#....................#',
      '#....................#',
      '#....................#',
      '#....................#',
      '######################',
    ],
    spawn_waves: [
      { at: 0,    spawns: [{type:'imp', x:6.5, y:3.5}, {type:'imp', x:15.5, y:3.5}, {type:'imp', x:6.5, y:15.5}, {type:'imp', x:15.5, y:15.5}] },
      { at: 12,   spawns: [{type:'cacodemon', x:5.5, y:9.5}, {type:'cacodemon', x:18.5, y:9.5}] },
      { at: 28,   spawns: [{type:'demon', x:3.5, y:2.5}, {type:'demon', x:3.5, y:16.5}, {type:'lost_soul', x:9.5, y:2.5}, {type:'lost_soul', x:9.5, y:16.5}] },
      { at: 45,   spawns: [{type:'mancubus', x:11.5, y:6.5}, {type:'mancubus', x:11.5, y:12.5}] },
      { at: 65,   spawns: [{type:'baron', x:5.5, y:4.5}, {type:'baron', x:5.5, y:14.5}, {type:'baron', x:18.5, y:4.5}, {type:'baron', x:18.5, y:14.5}] },
    ],
  },
];

// ============================================================
// ENEMY TYPES
// ============================================================

// Normalize map data from string rows ('#', '.', 'D') to 2D arrays of
// numeric tile codes so the renderer / collision code can compare with > 0.
for (const lv of LEVELS) {
  lv.map = lv.map.map(row => row.split('').map(c => {
    if (c === '#') return 1;
    if (c >= '1' && c <= '4') return parseInt(c, 10);
    if (c === 'D') return MAP_DOOR;
    return MAP_EMPTY; // '.', 'P', 'e' etc.
  }));
}

const ENEMY_TYPES = {
  zombie: {
    hp: 35, speed: 1.0, damage: 7,  sight: 8,  attackRange: 1.3, attackCooldown: 0.8,
    size: 0.45, color: '#86a468', melee: true, body: 'h',
  },
  imp: {
    hp: 65, speed: 1.3, damage: 12, sight: 10, attackRange: 6,  attackCooldown: 1.1,
    size: 0.5,  color: '#a8663a', shoots: 'fireball',
  },
  demon: {
    hp: 140, speed: 2.0, damage: 22, sight: 9,  attackRange: 1.4, attackCooldown: 0.55,
    size: 0.7,  color: '#d07291', melee: true,
  },
  baron: {
    hp: 320, speed: 1.5, damage: 30, sight: 10, attackRange: 1.7, attackCooldown: 0.8,
    size: 0.8,  color: '#704050', melee: true, big: true,
  },
  cyberdemon: {
    hp: 1800, speed: 0.85, damage: 50, sight: 16, attackRange: 9, attackCooldown: 1.6,
    size: 1.6,  color: '#a83820', shoots: 'rocket', boss: true,
  },
  cacodemon: {
    hp: 260, speed: 0.9,  damage: 18, sight: 9, attackRange: 7, attackCooldown: 1.0,
    size: 0.85, color: '#d8302a', shoots: 'fireball', flies: true,
  },
  lost_soul: {
    hp: 50, speed: 2.6,  damage: 14, sight: 14, attackRange: 1.0, attackCooldown: 0.5,
    size: 0.45, color: '#ffaa55', flies: true, melee: true, homing: true,
  },
  mancubus: {
    hp: 380, speed: 0.85, damage: 28, sight: 10, attackRange: 8, attackCooldown: 1.4,
    size: 1.0,  color: '#8a4a26', shoots: 'spread',
  },
};

// ============================================================
// WEAPONS
// ============================================================

const WEAPONS = [
  { name: 'FIST',     damage: 14, fireRate: 0.5,  range: 1.6, ammo: null,      pellets: 1, spread: 0,    kickback: 1, kickY: 1, color: '#d4b078' },
  { name: 'PISTOL',   damage: 16, fireRate: 0.4,  range: 16,  ammo: 'pistol',   pellets: 1, spread: 0.02, kickback: 3, kickY: 2, color: '#bbbcc0' },
  { name: 'SHOTGUN',  damage: 9,  fireRate: 0.7,  range: 12,  ammo: 'shotgun',  pellets: 7, spread: 0.18, kickback: 8, kickY: 4, color: '#c66a3a' },
  { name: 'CHAINGUN', damage: 9,  fireRate: 0.09, range: 18,  ammo: 'chaingun', pellets: 1, spread: 0.05, kickback: 2, kickY: 1, color: '#666a72' },
];

// ============================================================
// INPUT
// ============================================================

const Input = {
  keys: {},
  mouseDX: 0,
  mouseX: 0,
  pointerLocked: false,
  firePressed: false,
  cheatBuf: [],

  init() {
    window.addEventListener('keydown', (e) => {
      this.keys[e.code] = true;

      // Weapon select
      if (e.code >= 'Digit1' && e.code <= 'Digit4') {
        Game.selectWeapon(parseInt(e.code.slice(5)) - 1);
      }
      // Restart
      if (e.code === 'KeyR' && (Game.state === 'dead' || Game.state === 'win')) {
        Game.restart();
      }

      // IDDQD cheat
      this.cheatBuf.push(e.code);
      if (this.cheatBuf.length > 6) this.cheatBuf.shift();
      if (this.cheatBuf.join('|') === 'KeyI|KeyD|KeyD|KeyQ|KeyD') {
        Game.godMode = !Game.godMode;
        Game.message('GOD MODE ' + (Game.godMode ? 'ON' : 'OFF'));
        this.cheatBuf = [];
      }

      // Block some keys from scrolling
      if (['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code)) {
        e.preventDefault();
      }
    });

    window.addEventListener('keyup', (e) => {
      this.keys[e.code] = false;
    });

    // Pointer lock for mouse look
    const canvas = document.getElementById('game');
    canvas.addEventListener('click', () => {
      if (Game.state === 'playing') {
        canvas.requestPointerLock();
      }
    });
    canvas.addEventListener('mousedown', (e) => {
      if (Game.state === 'playing' && e.button === 0) {
        this.firePressed = true;
      }
    });
    canvas.addEventListener('mouseup', (e) => {
      if (e.button === 0) this.firePressed = false;
    });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());

    document.addEventListener('pointerlockchange', () => {
      this.pointerLocked = (document.pointerLockElement === canvas);
    });
    document.addEventListener('mousemove', (e) => {
      if (this.pointerLocked) {
        this.mouseDX += e.movementX || 0;
      }
    });

    // Wheel = weapon swap
    canvas.addEventListener('wheel', (e) => {
      if (Game.state !== 'playing') return;
      const d = Math.sign(e.deltaY);
      let w = Game.player.weapon;
      for (let i = 0; i < 4; i++) {
        w = (w + d + 4) % 4;
        if (Game.hasAmmoFor(w) || w === 0) break;
      }
      Game.selectWeapon(w);
    });
  },

  consumeMouseDX() {
    const dx = this.mouseDX;
    this.mouseDX = 0;
    return dx;
  },

  isMoving() {
    return this.keys['KeyW'] || this.keys['KeyS'] ||
           this.keys['KeyA'] || this.keys['KeyD'] ||
           this.keys['ArrowUp'] || this.keys['ArrowDown'];
  },
};

// ============================================================
// AUDIO — procedural SFX + music via Web Audio API
// ============================================================

const Audio = {
  ctx: null,
  master: null,
  musicGain: null,
  music: { track: null, playing: false, tempo: 1, step: 0, lastTime: 0 },

  init() {
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.45;
      this.master.connect(this.ctx.destination);
      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.value = 0.25;
      this.musicGain.connect(this.master);
    } catch (e) {
      console.warn('AudioContext unavailable', e);
    }
  },

  resume() {
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
  },

  // -------- Simple SFX helpers --------
  tone(freq, dur, type = 'square', vol = 0.4, slide = 0) {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    if (slide) {
      osc.frequency.exponentialRampToValueAtTime(
        Math.max(40, freq + slide), this.ctx.currentTime + dur);
    }
    g.gain.setValueAtTime(vol, this.ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + dur);
    osc.connect(g);
    g.connect(this.master);
    osc.start();
    osc.stop(this.ctx.currentTime + dur);
  },

  noise(dur, vol = 0.3, filterFreq = 1200) {
    if (!this.ctx) return;
    const buf = this.ctx.createBuffer(1,
      this.ctx.sampleRate * dur, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const f = this.ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = filterFreq;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, this.ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + dur);
    src.connect(f); f.connect(g); g.connect(this.master);
    src.start();
  },

  // -------- Game sounds --------
  pistol()  {
    this.tone(660, 0.05, 'square', 0.25, -300);
    this.noise(0.08, 0.25, 2000);
  },
  shotgun() {
    this.noise(0.25, 0.55, 1400);
    this.tone(180, 0.12, 'sawtooth', 0.3, -100);
  },
  chaingun() {
    this.tone(440, 0.04, 'square', 0.18, -200);
    this.noise(0.05, 0.18, 2400);
  },
  fist() {
    this.tone(180, 0.06, 'triangle', 0.35, -80);
    this.noise(0.04, 0.2, 800);
  },
  hurt()   { this.tone(220, 0.18, 'sawtooth', 0.35, -120); },
  enemyHurt(){ this.tone(140, 0.08, 'square', 0.15, -40); },
  enemyDie(){
    this.tone(330, 0.18, 'sawtooth', 0.3, -200);
    setTimeout(() => this.tone(180, 0.22, 'square',   0.25, -80), 60);
  },
  pickup() {
    this.tone(880, 0.06, 'square', 0.2, 0);
    setTimeout(() => this.tone(1100, 0.1, 'square', 0.18, 0), 60);
  },
  door()   { this.tone(120, 0.18, 'triangle', 0.3, 60); },
  levelUp(){
    [0, 80, 160, 240].forEach((d, i) => {
      setTimeout(() => this.tone(440 + i * 80, 0.15, 'square', 0.3, 0), d);
    });
  },

  // -------- Procedural music --------
  // A simple step sequencer driven by level time.
  setTrack(level) {
    if (!this.music.playing || this.music.track !== level) {
      this.music.track = level;
      this.music.tempo = ({ e1m1: 0.42, e1m2: 0.38, e1m3: 0.5, e1m4: 0.55, e1m5: 0.62 })[level] || 0.45;
      this.music.step = 0;
      this.music.playing = true;
      this.music.lastTime = performance.now();
    }
  },

  stopMusic() {
    this.music.playing = false;
  },

  musicTick() {
    if (!this.ctx || !this.music.playing) return;
    const now = performance.now();
    const interval = 1000 * this.music.tempo / 4; // 16th notes
    if (now - this.music.lastTime < interval) return;
    this.music.lastTime = now;
    const step = this.music.step % 16;
    this.music.step++;

    // Pattern per track. Notes: freq or 0 = rest. [bass, lead, hat]
    const PATTERNS = {
      e1m1: { scale: [0, 110, 130.81, 146.83, 164.81, 196, 220], bpm: this.music.tempo },
      e1m2: { scale: [0, 98, 116.5, 138.6, 164.81, 174.6, 196],  bpm: this.music.tempo },
      e1m3: { scale: [0, 82, 98, 110, 130.8, 146.8, 164.8],     bpm: this.music.tempo },
      e1m4: { scale: [0, 73, 87, 98, 110, 130.8, 146.8],        bpm: this.music.tempo },
      e1m5: { scale: [0, 82, 87, 98, 116.5, 130.8, 146.8],      bpm: this.music.tempo },
    };
    const pat = PATTERNS[this.music.track] || PATTERNS.e1m1;

    // Bassline (drives every quarter)
    if (step % 4 === 0) {
      const root = pat.scale[Math.floor(step / 4) % 7] || 110;
      this.musicNote(root / 2, 0.16, 'sawtooth', 0.35, this.musicGain);
    }
    // Lead (8-step melodic pattern, level specific)
    const lead = {
      e1m1: [0, 2, 4, 5,  0, 2, 4, 6,  0, 2, 4, 5,  0, 4, 3, 2],
      e1m2: [0, 3, 5, 3,  0, 2, 4, 5,  0, 3, 6, 4,  0, 2, 4, 2],
      e1m3: [0, 2, 0, 3,  0, 5, 4, 3,  0, 2, 5, 6,  0, 4, 3, 2],
      e1m4: [0, 2, 3, 5,  6, 5, 3, 2,  0, 3, 5, 6,  5, 3, 2, 0],
      e1m5: [0, 2, 4, 6,  5, 4, 2, 0,  3, 5, 4, 3,  2, 3, 4, 5],
    }[this.music.track] || [];
    if (lead[step] && step % 2 === 0) {
      const note = pat.scale[lead[step]] * 2;
      this.musicNote(note, 0.14, 'square', 0.25, this.musicGain);
    }
    // Hi-hat noise (off-beats)
    if (step % 2 === 1) {
      this.musicNote(0, 0.04, 'noise', 0.08, this.musicGain, 6000);
    }
    // Kick on 1
    if (step % 8 === 0) {
      this.musicNote(60, 0.14, 'sine', 0.5, this.musicGain, 0, -40);
    }
  },

  musicNote(freq, dur, type, vol, dest, filterFreq = 0, slide = 0) {
    if (!this.ctx || !freq) return;
    const now = this.ctx.currentTime;
    let src;
    if (type === 'noise') {
      const buf = this.ctx.createBuffer(1, this.ctx.sampleRate * dur, this.ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1);
      src = this.ctx.createBufferSource();
      src.buffer = buf;
    } else {
      src = this.ctx.createOscillator();
      src.type = type;
      src.frequency.value = freq;
      if (slide) src.frequency.exponentialRampToValueAtTime(
        Math.max(40, freq + slide), now + dur);
    }
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + dur);
    if (filterFreq) {
      const f = this.ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = filterFreq;
      src.connect(f); f.connect(g);
    } else {
      src.connect(g);
    }
    g.connect(dest);
    src.start(now);
    if (src.stop) src.stop(now + dur);
  },
};

// ============================================================
// RENDERER — raycasting engine + sprite drawing
// ============================================================

const Renderer = {
  canvas: null,
  ctx: null,
  imgData: null,
  buf: null,
  zbuf: new Float32Array(SCREEN_W),
  wallTex: [],          // 4 wall textures as ImageData
  monsterTex: {},       // monster key -> ImageData
  pickupTex: {},        // pickup key -> ImageData
  weaponTex: [],        // 4 weapon bitmaps

  init() {
    this.canvas = document.getElementById('game');
    this.canvas.width = SCREEN_W;
    this.canvas.height = SCREEN_H;
    this.ctx = this.canvas.getContext('2d');
    this.imgData = this.ctx.createImageData(SCREEN_W, SCREEN_H);
    this.buf = new Uint32Array(this.imgData.data.buffer);
    this.zbuf.fill(0);

    this.buildWallTextures();
    this.buildMonsterSprites();
    this.buildPickupSprites();
    this.buildWeaponSprites();

    // Pointer cursor: crosshair
    this.canvas.style.cursor = 'crosshair';
  },

  // -------- Procedurally generated wall textures --------
  buildWallTextures() {
    for (let t = 0; t < 4; t++) {
      const img = new ImageData(TEX_SIZE, TEX_SIZE);
      const base = ['#5a1a14', '#3a2018', '#4a1408', '#280c14'][t];
      const alt  = ['#3a0e08', '#1a1008', '#2a0804', '#18060c'][t];
      const accent = ['#aa6644', '#7a6644', '#c44a2a', '#a04060'][t];
      for (let y = 0; y < TEX_SIZE; y++) {
        for (let x = 0; x < TEX_SIZE; x++) {
          let c = base;
          // Brick/cell pattern depending on variant
          if (t === 0) {
            // Hell stone: large blocks with mortar lines
            const row = Math.floor(y / 16);
            const off = (row % 2) * 8;
            const bx = (x + off) % 16;
            if (y % 16 === 0 || bx === 0) c = '#000';
          } else if (t === 1) {
            // Tech panel
            const row = Math.floor(y / 8);
            const col = Math.floor(x / 8);
            if (y % 8 === 0 || x % 8 === 0) c = '#0a0a0a';
            if ((row + col) % 5 === 0) c = accent;
          } else if (t === 2) {
            // Brown brick
            if (y === 0 || y === 8 || y === 16 || y === 24 || y === 32 || y === 40 || y === 48 || y === 56) c = '#000';
            const row = Math.floor(y / 8);
            const off = (row % 2) * 8;
            const bx = (x + off) % 16;
            if (bx === 0) c = '#000';
            if ((x + y) % 13 === 0) c = accent;
          } else {
            // Purple flesh
            if ((x*y) % 7 === 0) c = alt;
            if (Math.abs(Math.sin(x*0.4) * Math.cos(y*0.5)) > 0.85) c = accent;
          }
          const rgb = hex(c);
          const i = (y * TEX_SIZE + x) * 4;
          img.data[i  ] = rgb[0];
          img.data[i+1] = rgb[1];
          img.data[i+2] = rgb[2];
          img.data[i+3] = 255;
        }
      }
      this.wallTex.push(img);
    }
  },

  // -------- Monster sprites (drawn into 128x128 RGBA buffers) --------
  buildMonsterSprites() {
    const types = Object.keys(ENEMY_TYPES);
    for (const type of types) {
      const img = new ImageData(SPRITE_SIZE, SPRITE_SIZE);
      this.drawMonster(type, img);
      this.monsterTex[type] = img;
    }
  },

  drawMonster(type, img) {
    const cx = SPRITE_SIZE / 2;
    const cy = SPRITE_SIZE / 2 + 14;  // anchor near feet
    const def = ENEMY_TYPES[type];
    const base = hex(def.color);
    const dark = shade(def.color, 0.55);
    const veryDark = shade(def.color, 0.3);
    const W = SPRITE_SIZE, H = SPRITE_SIZE;

    function pix(x, y, col) {
      if (x < 0 || y < 0 || x >= W || y >= H) return;
      const i = ((y|0) * W + (x|0)) * 4;
      img.data[i] = (col>>16)&0xff;
      img.data[i+1] = (col>>8)&0xff;
      img.data[i+2] = col&0xff;
      img.data[i+3] = 255;
    }
    function circle(x, y, r, color, hollow=false) {
      const c = rgbStr(hex(color));
      const r2 = r*r;
      for (let py = -r; py <= r; py++) {
        for (let px = -r; px <= r; px++) {
          const d = px*px + py*py;
          if (hollow ? Math.abs(d - r2) < r * 1.4 : d <= r2) {
            pix(x + px, y + py, c);
          }
        }
      }
    }
    function ellipse(x, y, rx, ry, color) {
      const c = rgbStr(hex(color));
      for (let py = -ry; py <= ry; py++) {
        for (let px = -rx; px <= rx; px++) {
          const n = (px*px)/(rx*rx) + (py*py)/(ry*ry);
          if (n <= 1) pix(x + px, y + py, c);
        }
      }
    }
    function rect(x, y, w, h, color) {
      const c = rgbStr(hex(color));
      for (let py = 0; py < h; py++) {
        for (let px = 0; px < w; px++) {
          pix(x + px, y + py, c);
        }
      }
    }

    const t = type;
    const S = def.size;

    if (t === 'zombie') {
      // head + body + arms
      rect(cx-10, cy-40, 20, 18, def.color);
      ellipse(cx, cy-22, 18, 12, def.color);
      // arms hanging
      rect(cx-22, cy-22, 6, 28, def.color);
      rect(cx+16, cy-22, 6, 28, def.color);
      // legs
      rect(cx-8, cy-2, 6, 18, def.color);
      rect(cx+2, cy-2, 6, 18, def.color);
      // blood face
      circle(cx-4, cy-32, 2.5, '#aa1111');
      circle(cx+4, cy-32, 2.5, '#aa1111');
    } else if (t === 'imp') {
      // brown demon with horns
      ellipse(cx, cy-22, 16, 14, def.color);
      // horns
      for (let h = 0; h < 8; h++) {
        pix(cx-10 + h, cy-36 - h, rgbStr(hex('#7a3010')));
        pix(cx+10 - h, cy-36 - h, rgbStr(hex('#7a3010')));
      }
      // eyes
      circle(cx-6, cy-26, 1.8, '#ffcc00');
      circle(cx+6, cy-26, 1.8, '#ffcc00');
      // body
      ellipse(cx, cy-10, 14, 18, def.color);
      // arms outstretched
      for (let h = 0; h < 20; h++) {
        pix(cx-20 - h*0.4, cy-14 + h*0.2, rgbStr(hex(def.color)));
        pix(cx+20 + h*0.4, cy-14 + h*0.2, rgbStr(hex(def.color)));
      }
    } else if (t === 'demon') {
      // pink beast: round body, mouth with teeth, horns
      ellipse(cx, cy-22, 22, 18, def.color);
      // horns
      for (let h = 0; h < 10; h++) {
        pix(cx-14 + h*0.5, cy-40 - h*0.6, rgbStr(hex('#883355')));
        pix(cx+14 - h*0.5, cy-40 - h*0.6, rgbStr(hex('#883355')));
      }
      // mouth
      rect(cx-10, cy-18, 20, 6, '#330000');
      for (let px = -8; px <= 8; px += 4) {
        rect(cx + px, cy-18, 2, 3, '#fff');
      }
      // eyes
      circle(cx-7, cy-26, 2, '#fff');
      circle(cx+7, cy-26, 2, '#fff');
      circle(cx-7, cy-26, 0.8, '#000');
      circle(cx+7, cy-26, 0.8, '#000');
    } else if (t === 'baron') {
      // bulky demon
      ellipse(cx, cy-22, 22, 22, def.color);
      // horns (twin pairs)
      for (let h = 0; h < 12; h++) {
        pix(cx-10 + h*0.2, cy-44 + h*0.4, rgbStr(hex('#3a1820')));
        pix(cx+10 - h*0.2, cy-44 + h*0.4, rgbStr(hex('#3a1820')));
      }
      // mouth with fangs
      rect(cx-12, cy-18, 24, 8, '#1a0a0a');
      rect(cx-10, cy-14, 3, 6, '#fff');
      rect(cx+7,  cy-14, 3, 6, '#fff');
      // eye
      circle(cx, cy-32, 2.5, '#ffcc00');
    } else if (t === 'cyberdemon') {
      // big mecha: huge body, legs, rocket arm
      // body
      rect(cx-28, cy-78, 56, 50, '#3a3a44');
      rect(cx-28, cy-78, 56, 50, '#55555a');
      // chest detail
      rect(cx-12, cy-60, 24, 18, '#1a1a22');
      circle(cx, cy-52, 5, '#c44a2a');
      // head
      rect(cx-12, cy-90, 24, 14, '#444450');
      circle(cx-5, cy-82, 1.8, '#ffcc00');
      circle(cx+5, cy-82, 1.8, '#ffcc00');
      // legs
      rect(cx-22, cy-28, 14, 32, '#444450');
      rect(cx+8,  cy-28, 14, 32, '#444450');
      // rocket arm
      rect(cx+28, cy-66, 36, 12, '#444450');
      rect(cx+58, cy-60, 8, 12, '#c44a2a');
      // shoulder pauldron
      rect(cx-30, cy-78, 16, 10, '#1a1a22');
      // tinted with red
      for (let i = 0; i < img.data.length; i += 4) {
        const r = img.data[i], g = img.data[i+1], b = img.data[i+2];
        if (r < 100 && g < 100 && b < 100) {
          // emphasize red tints
          img.data[i]   = Math.min(255, r + 80);
          img.data[i+1] = Math.max(0,   g - 10);
          img.data[i+2] = Math.max(0,   b - 20);
        }
      }
    } else if (t === 'cacodemon') {
      // big floating red ball with eye + fangs
      circle(cx, cy-22, 24, def.color);
      // eye
      circle(cx, cy-26, 8, '#fff');
      circle(cx, cy-26, 4, '#000');
      circle(cx, cy-26, 2, '#aa1111');
      // mouth below eye
      rect(cx-10, cy-12, 20, 7, '#1a0a0a');
      rect(cx-8, cy-8, 2, 5, '#fff');
      rect(cx-2, cy-8, 2, 5, '#fff');
      rect(cx+4, cy-8, 2, 5, '#fff');
      // small spikes
      for (let a = 0; a < 6; a++) {
        const ang = a * (Math.PI / 3) + Math.PI;
        const px = cx + Math.cos(ang) * 30;
        const py = cy-22 + Math.sin(ang) * 30;
        circle(px, py, 2.5, '#7a1810');
      }
    } else if (t === 'lost_soul') {
      // flaming skull-like projectile
      circle(cx, cy-22, 10, def.color);
      circle(cx, cy-22, 6, '#ffffaa');
      // eyes
      circle(cx-2, cy-22, 1.2, '#000');
      circle(cx+2, cy-22, 1.2, '#000');
      // flame trail (off-center)
      for (let h = 0; h < 6; h++) {
        const r = 10 - h;
        circle(cx, cy-22 + r + 2, r * 0.3, ['#ff5530', '#ffaa30', '#ffff60'][Math.floor(Math.random()*3)]);
      }
    } else if (t === 'mancubus') {
      // bulky demon with cannons
      ellipse(cx, cy-22, 22, 22, def.color);
      // cannons (arm-mounted)
      rect(cx-40, cy-32, 18, 10, def.color);
      rect(cx-44, cy-32, 6, 14, '#1a0808');
      rect(cx+22, cy-32, 18, 10, def.color);
      rect(cx+38, cy-32, 6, 14, '#1a0808');
      // head
      rect(cx-14, cy-50, 28, 22, def.color);
      // eyes
      circle(cx-6, cy-40, 2, '#ffcc00');
      circle(cx+6, cy-40, 2, '#ffcc00');
      // mouth with horns
      rect(cx-10, cy-32, 20, 6, '#1a0a0a');
    }
  },

  // -------- Pickup sprites --------
  buildPickupSprites() {
    const W = 32, H = 32;
    function newImg() { return new ImageData(W, H); }
    function set(img, x, y, c) {
      if (x<0||y<0||x>=W||y>=H) return;
      const i = (y * W + x) * 4;
      img.data[i  ] = (c>>16)&0xff;
      img.data[i+1] = (c>>8)&0xff;
      img.data[i+2] = c&0xff;
      img.data[i+3] = 255;
    }
    function fillRect(img, x, y, w, h, c) {
      for (let yy = y; yy < y+h; yy++)
        for (let xx = x; xx < x+w; xx++) set(img, xx, yy, c);
    }

    // Medkit (stimpack)
    {
      const img = newImg();
      const cB  = rgbStr(hex('#cccccc'));
      const cR  = rgbStr(hex('#cc2222'));
      const cW  = rgbStr(hex('#ffffff'));
      fillRect(img, 6, 4, 20, 24, cB);
      fillRect(img, 14, 8, 4, 16, cR);
      fillRect(img, 10, 12, 12, 4, cR);
      fillRect(img, 6, 4, 20, 2, cW);
      this.pickupTex['stimpack'] = img;
    }

    // Ammo box (pistol)
    {
      const img = newImg();
      const cB = rgbStr(hex('#886622'));
      const cD = rgbStr(hex('#221a08'));
      fillRect(img, 4, 8, 24, 20, cB);
      fillRect(img, 4, 8, 24, 2, cD);
      fillRect(img, 4, 26, 24, 2, cD);
      fillRect(img, 8, 12, 4, 12, cD);
      fillRect(img, 16, 12, 4, 12, cD);
      this.pickupTex['ammo_pistol'] = img;
    }

    // Shotgun ammo box
    {
      const img = newImg();
      const cR = rgbStr(hex('#aa3322'));
      const cD = rgbStr(hex('#220804'));
      fillRect(img, 4, 6, 24, 20, cR);
      fillRect(img, 4, 6, 24, 2, cD);
      for (let i = 0; i < 4; i++)
        fillRect(img, 8 + i*4, 12, 2, 10, cD);
      this.pickupTex['ammo_shotgun'] = img;
    }

    // Shotgun pickup (weapon)
    {
      const img = newImg();
      const cB = rgbStr(hex('#3a3a44'));
      const cW = rgbStr(hex('#c0c0c0'));
      const cO = rgbStr(hex('#aa7a40'));
      fillRect(img, 6, 12, 18, 4, cB);
      fillRect(img, 8, 8, 4, 8, cO);
      fillRect(img, 4, 14, 24, 2, cW);
      this.pickupTex['shotgun'] = img;
    }

    // Chaingun ammo
    {
      const img = newImg();
      const cG = rgbStr(hex('#444444'));
      const cY = rgbStr(hex('#cccc00'));
      fillRect(img, 4, 8, 24, 18, cG);
      for (let i = 0; i < 4; i++)
        fillRect(img, 8 + i*4, 12, 2, 10, cY);
      this.pickupTex['super_shotgun_ammo'] = img; // reuse slot for mega chaingun ammo
    }

    // Mega armor (blue)
    {
      const img = newImg();
      const cB = rgbStr(hex('#2266aa'));
      const cD = rgbStr(hex('#0a1822'));
      fillRect(img, 6, 4, 20, 24, cB);
      fillRect(img, 14, 8, 4, 16, cD);
      fillRect(img, 10, 12, 12, 4, cD);
      this.pickupTex['mega_armor'] = img;
    }
  },

  // -------- Weapon bitmaps (foreground) --------
  buildWeaponSprites() {
    const W = 128, H = 128;
    for (let w = 0; w < 4; w++) {
      const img = new ImageData(W, H);
      const def = WEAPONS[w];
      const base = hex(def.color);
      const dark = shade(def.color, 0.5);

      function set(img, x, y, c) {
        if (x<0||y<0||x>=W||y>=H) return;
        const i = (y * W + x) * 4;
        img.data[i  ] = (c>>16)&0xff;
        img.data[i+1] = (c>>8)&0xff;
        img.data[i+2] = c&0xff;
        img.data[i+3] = 255;
      }
      function fillRect(img, x, y, w, h, c) {
        for (let yy = y; yy < y+h; yy++)
          for (let xx = x; xx < x+w; xx++) set(img, xx, yy, c);
      }
      function line(img, x1, y1, x2, y2, c) {
        const dx = x2 - x1, dy = y2 - y1;
        const steps = Math.max(Math.abs(dx), Math.abs(dy));
        for (let s = 0; s <= steps; s++) {
          const x = Math.round(x1 + dx * s / steps);
          const y = Math.round(y1 + dy * s / steps);
          set(img, x, y, c);
          set(img, x+1, y, c); set(img, x, y+1, c);
        }
      }

      const cBase = rgbStr(base);
      const cDark = rgbStr(dark);

      if (w === 0) { // FIST
        // clenched fist bottom-right
        const cx = 70, cy = 92, r = 22;
        for (let yy = -r; yy <= r; yy++)
          for (let xx = -r; xx <= r; xx++) {
            const d = xx*xx + yy*yy;
            if (d <= r*r) set(img, cx+xx, cy+yy, d > r*r*0.7 ? cDark : cBase);
          }
        // knuckles
        for (let k = -3; k <= 3; k += 2) {
          for (let yy = -3; yy <= 3; yy++)
            for (let xx = -3; xx <= 3; xx++) {
              if (xx*xx+yy*yy <= 9) set(img, cx + k*4 + xx, cy - 6 + yy, cDark);
            }
        }
        // arm
        fillRect(img, 50, 110, 30, 18, rgbStr(hex('#d4a070')));
      } else if (w === 1) { // PISTOL
        // grip
        fillRect(img, 60, 70, 20, 50, cDark);
        // slide
        fillRect(img, 50, 60, 50, 18, cBase);
        fillRect(img, 50, 60, 50, 4, cDark);
        // barrel
        fillRect(img, 100, 66, 22, 6, cDark);
        // sight
        fillRect(img, 64, 56, 6, 6, cDark);
        // trigger
        fillRect(img, 72, 78, 4, 8, cDark);
      } else if (w === 2) { // SHOTGUN
        // grip
        fillRect(img, 50, 78, 24, 42, rgbStr(hex('#5a3018')));
        // stock
        fillRect(img, 30, 80, 22, 16, rgbStr(hex('#3a2010')));
        // body
        fillRect(img, 50, 70, 40, 14, cDark);
        // double barrel
        fillRect(img, 88, 64, 60, 6, cBase);
        fillRect(img, 88, 72, 60, 6, cBase);
        fillRect(img, 88, 62, 4, 16, cDark);
        fillRect(img, 144, 62, 4, 16, cDark);
      } else { // CHAINGUN
        // stock
        fillRect(img, 20, 80, 28, 18, rgbStr(hex('#3a2010')));
        // body
        fillRect(img, 38, 70, 40, 22, cDark);
        // drum
        for (let yy = 60; yy < 100; yy++)
          for (let xx = 70; xx < 110; xx++) {
            const d = (xx-90)*(xx-90) + (yy-80)*(yy-80);
            if (d <= 26*26) set(img, xx, yy, d > 26*26*0.7 ? cDark : cBase);
          }
        // barrels
        fillRect(img, 110, 70, 32, 4, cBase);
        fillRect(img, 110, 78, 32, 4, cBase);
        fillRect(img, 110, 86, 32, 4, cBase);
        // muzzle
        fillRect(img, 138, 68, 6, 24, cDark);
      }

      this.weaponTex.push(img);
    }
  },

  // -------- Per-frame render --------
  render(player, scene) {
    const { map, level } = scene;
    const posX = player.x, posY = player.y;
    const dirX = player.dirX, dirY = player.dirY;
    const planeX = player.planeX, planeY = player.planeY;
    const ambient = level.ambient;

    const W = SCREEN_W, H = SCREEN_H;
    const buf = this.buf;

    // ---- 1. Ceiling and floor solid fills ----
    const ceilRGB  = rgbStr(hex(level.ceil));
    const floorRGB = rgbStr(hex(level.floor));
    const horizonY = HALF_H;

    for (let y = 0; y < horizonY; y++) {
      const row = y * W;
      for (let x = 0; x < W; x++) buf[row + x] = ceilRGB;
    }
    for (let y = horizonY; y < H; y++) {
      const row = y * W;
      for (let x = 0; x < W; x++) buf[row + x] = floorRGB;
    }

    // ---- 2. Wall raycasting (DDA) ----
    for (let x = 0; x < W; x++) {
      const cameraX = 2 * x / W - 1;
      const rayDirX = dirX + planeX * cameraX;
      const rayDirY = dirY + planeY * cameraX;

      let mapX = Math.floor(posX);
      let mapY = Math.floor(posY);

      const deltaDistX = (rayDirX === 0) ? 1e30 : Math.abs(1 / rayDirX);
      const deltaDistY = (rayDirY === 0) ? 1e30 : Math.abs(1 / rayDirY);

      let stepX, stepY, sideDistX, sideDistY;
      if (rayDirX < 0) {
        stepX = -1;
        sideDistX = (posX - mapX) * deltaDistX;
      } else {
        stepX = 1;
        sideDistX = (mapX + 1 - posX) * deltaDistX;
      }
      if (rayDirY < 0) {
        stepY = -1;
        sideDistY = (posY - mapY) * deltaDistY;
      } else {
        stepY = 1;
        sideDistY = (mapY + 1 - posY) * deltaDistY;
      }

      let hit = false, side = 0;
      let tile = 1;
      for (let i = 0; i < 64; i++) {
        if (sideDistX < sideDistY) {
          sideDistX += deltaDistX;
          mapX += stepX;
          side = 0;
        } else {
          sideDistY += deltaDistY;
          mapY += stepY;
          side = 1;
        }
        if (mapY < 0 || mapX < 0 || mapY >= map.length || mapX >= map[0].length) break;
        const t = map[mapY][mapX];
        if (t > 0 && t < 9) { hit = true; tile = t; break; }
      }
      if (!hit) { this.zbuf[x] = 1e30; continue; }

      const perpDist = side === 0
        ? (sideDistX - deltaDistX)
        : (sideDistY - deltaDistY);
      this.zbuf[x] = perpDist;

      const lineHeight = Math.floor(H / perpDist);
      const drawStart = Math.max(0, Math.floor(HALF_H - lineHeight / 2));
      const drawEnd   = Math.min(H - 1, Math.floor(HALF_H + lineHeight / 2));

      // Texture mapping: pick tex variant
      const texIdx = (tile - 1) % 4;
      const tex = this.wallTex[texIdx];

      // wallX: where on the wall the ray hit
      let wallX;
      if (side === 0) wallX = posY + perpDist * rayDirY;
      else            wallX = posX + perpDist * rayDirX;
      wallX -= Math.floor(wallX);
      let texX = Math.floor(wallX * TEX_SIZE);
      if ((side === 0 && rayDirX > 0) || (side === 1 && rayDirY < 0)) texX = TEX_SIZE - texX - 1;

      // Distance fog & side darkening
      const distMul = clamp(1 - perpDist / 18, 0, 1);
      const sideShade = side === 0 ? 1.0 : 0.7;
      const totalShade = ambient * distMul * sideShade;

      for (let y = drawStart; y <= drawEnd; y++) {
        let texY = Math.floor(((y - (HALF_H - lineHeight/2)) / lineHeight) * TEX_SIZE);
        if (texY < 0) texY = 0;
        if (texY >= TEX_SIZE) texY = TEX_SIZE - 1;
        const t = (texY * TEX_SIZE + texX) * 4;
        let r = tex.data[t];
        let g = tex.data[t+1];
        let b = tex.data[t+2];
        r = Math.floor(r * totalShade);
        g = Math.floor(g * totalShade);
        b = Math.floor(b * totalShade);
        buf[y * W + x] = (0xff << 24) | (b << 16) | (g << 8) | r;
      }
    }

    // ---- 3. Sprites (enemies, projectiles, pickups) ----
    // Build candidate sprite list, sorted far→near
    const sprites = [];
    for (const e of scene.enemies) {
      if (!e.alive) continue;
      sprites.push({
        x: e.x, y: e.y, kind: 'monster', key: e.type,
        size: ENEMY_TYPES[e.type].size,
        bob: e.bob,
      });
    }
    for (const p of scene.projectiles) {
      sprites.push({ x: p.x, y: p.y, kind: 'projectile', key: p.kind, size: p.size || 0.25 });
    }
    for (const pk of scene.pickups) {
      if (pk.dead) continue;
      sprites.push({ x: pk.x, y: pk.y, kind: 'pickup', key: pk.type, size: 0.5, bob: pk.bob });
    }

    // Compute distance and sort far→near
    for (const s of sprites) {
      const dx = s.x - posX, dy = s.y - posY;
      s.dist = dx*dx + dy*dy;
    }
    sprites.sort((a, b) => b.dist - a.dist);

    const invDet = 1 / (planeX * dirY - dirX * planeY);
    for (const s of sprites) {
      const relX = s.x - posX, relY = s.y - posY;
      const transformX = invDet * (dirY * relX - dirX * relY);
      const transformY = invDet * (-planeY * relX + planeX * relY);
      if (transformY <= 0.05) continue;

      const spriteScreenX = Math.floor(W / 2 * (1 + transformX / transformY));
      const spriteH = Math.abs(Math.floor(H / transformY));
      const spriteW = spriteH;
      const drawStartY = Math.max(0, -spriteH/2 + H/2);
      const drawEndY   = Math.min(H - 1, spriteH/2 + H/2);

      let tex, isMonster = false;
      if (s.kind === 'monster') { tex = this.monsterTex[s.key]; isMonster = true; }
      else if (s.kind === 'pickup') tex = this.pickupTex[s.key];
      else if (s.kind === 'projectile') tex = this.monsterTex['lost_soul'];
      if (!tex) continue;

      const texW = tex.width;
      const texH = tex.height;

      const drawStartX = Math.max(0, -spriteW/2 + spriteScreenX);
      const drawEndX   = Math.min(W - 1, spriteW/2 + spriteScreenX);

      const distMul = clamp(1 - transformY / 12, 0, 1);
      const shade = ambient * distMul;

      for (let stripe = drawStartX; stripe <= drawEndX; stripe++) {
        if (transformY > this.zbuf[stripe]) continue;
        const texX = Math.floor((stripe - (-spriteW/2 + spriteScreenX)) * texW / spriteW);
        if (texX < 0 || texX >= texW) continue;

        for (let y = drawStartY; y <= drawEndY; y++) {
          // Use y as vertical texture coordinate with optional bob
          let dY = y - (-spriteH/2 + H/2);
          if (s.bob) dY -= Math.sin(s.bob) * (s.kind === 'pickup' ? 6 : 4);
          const texY = Math.floor(dY * texH / spriteH);
          if (texY < 0 || texY >= texH) continue;
          const i = (texY * texW + texX) * 4;
          const a = tex.data[i+3];
          if (a < 128) continue;
          let r = tex.data[i  ];
          let g = tex.data[i+1];
          let b = tex.data[i+2];
          if (s.kind === 'projectile') {
            // Add glow
            const glow = 1.3;
            r = Math.min(255, Math.floor(r * glow));
            g = Math.min(255, Math.floor(g * glow));
            b = Math.min(255, Math.floor(b * glow));
          } else {
            r = Math.floor(r * shade);
            g = Math.floor(g * shade);
            b = Math.floor(b * shade);
          }
          buf[y * W + stripe] = (0xff << 24) | (b << 16) | (g << 8) | r;
        }
      }
    }

    // ---- 4. Weapon overlay ----
    this.drawWeapon(player, buf);

    this.ctx.putImageData(this.imgData, 0, 0);

    // Reset zbuffer for next frame
    // (we keep last frame's zbuf to avoid reallocating)
  },

  drawWeapon(player, buf) {
    const w = this.weaponTex[player.weapon];
    if (!w) return;
    const W = SCREEN_W, H = SCREEN_H;

    const bobY = Math.sin(player.bobPhase) * 4 - Math.abs(Math.cos(player.bobPhase)) * 2;
    const kickY = player.kickAnim * WEAPONS[player.weapon].kickY * 4;
    const cx = W * 0.65, cy = H * 0.75 + bobY + kickY;
    const scale = 0.85;
    const weaponW = w.width * scale;
    const weaponH = w.height * scale;

    const startX = Math.floor(cx - weaponW/2);
    const startY = Math.floor(cy - weaponH/2);

    for (let yy = 0; yy < weaponH; yy++) {
      const dstY = startY + yy;
      if (dstY < 0 || dstY >= H) continue;
      const srcY = (yy / scale) | 0;
      const rowOff = dstY * W;
      for (let xx = 0; xx < weaponW; xx++) {
        const dstX = startX + xx;
        if (dstX < 0 || dstX >= W) continue;
        const srcX = (xx / scale) | 0;
        const i = (srcY * w.width + srcX) * 4;
        const a = w.data[i+3];
        if (a < 128) continue;
        const r = w.data[i  ];
        const g = w.data[i+1];
        const b = w.data[i+2];
        buf[rowOff + dstX] = (0xff << 24) | (b << 16) | (g << 8) | r;
      }
    }
  },

  flash(amount) {
    // Damage flash: use the actual canvas — we draw an overlay after the frame
    this.ctx.fillStyle = `rgba(255, 30, 30, ${amount})`;
    this.ctx.fillRect(0, 0, SCREEN_W, SCREEN_H);
  },
};

// ============================================================
// GAME — state, enemies, weapons, AI, levels
// ============================================================

const Game = {
  state: 'menu',     // 'menu' | 'playing' | 'dead' | 'win' | 'level'
  level: 0,
  levelTimer: 0,
  player: null,
  enemies: [],
  projectiles: [],
  pickups: [],
  spawnPoints: [],
  messageText: '',
  messageTimer: 0,
  godMode: false,
  totalKills: 0,
  levelKills: 0,

  init() {
    this.player = {
      x: 2.5, y: 2.5,
      dirX: 1, dirY: 0,
      planeX: 0, planeY: 0.66,
      hp: 100, maxHp: 100,
      armor: 0,
      weapon: 1,
      ammo: { pistol: 30, shotgun: 0, chaingun: 0 },
      bobPhase: 0,
      invuln: 0,
      kickAnim: 0,
      lastFire: 0,
    };
  },

  hasAmmoFor(w) {
    if (w === 0) return true;
    return this.player.ammo[WEAPONS[w].ammo] > 0;
  },

  selectWeapon(w) {
    if (w < 0 || w > 3) return;
    this.player.weapon = w;
    this.messageText = WEAPONS[w].name;
    this.messageTimer = 1.5;
  },

  message(text) {
    this.messageText = text;
    this.messageTimer = 2.0;
  },

  hideOverlays() {
    document.getElementById('start-screen').style.display = 'none';
    document.getElementById('death-screen').style.display = 'none';
    document.getElementById('win-screen').style.display = 'none';
    document.getElementById('level-screen').style.display = 'none';
  },

  start() {
    Audio.resume();
    this.init();
    Input.init();
    this.hideOverlays();
    this.loadLevel(0);
    this.state = 'playing';
  },

  restart() {
    this.init();
    this.totalKills = 0;
    this.hideOverlays();
    this.loadLevel(0);
    this.state = 'playing';
  },

  loadLevel(idx) {
    this.level = idx;
    this.levelTimer = 0;
    this.levelKills = 0;
    this.enemies = [];
    this.projectiles = [];
    this.pickups = [];
    this.spawnPoints = [];

    const lv = LEVELS[idx];
    this.player.x = lv.spawn.x;
    this.player.y = lv.spawn.y;
    const a = lv.spawn.dir;
    this.player.dirX = Math.cos(a);
    this.player.dirY = Math.sin(a);
    this.player.planeX = -Math.sin(a) * 0.66;
    this.player.planeY =  Math.cos(a) * 0.66;
    this.player.hp = Math.min(this.player.maxHp, this.player.hp + 25);
    if (idx > 0) this.player.armor = Math.min(100, this.player.armor + 25);

    for (const s of lv.spawns) {
      this.enemies.push(this.makeEnemy(s.type, s.x, s.y));
    }
    for (const p of lv.pickups) {
      this.pickups.push({
        type: p.type,
        x: p.x,
        y: p.y,
        bob: Math.random() * Math.PI * 2,
        t: 0,
        dead: false,
      });
    }

    document.getElementById('title-level').textContent = lv.name;
    document.title = 'DOOM — Web Edition · ' + lv.name;

    // Reset wave-spawn "fired" flags so replay resets them
    if (lv.spawn_waves) for (const w of lv.spawn_waves) w.fired = false;

    Audio.stopMusic();
    if (idx > 0) Audio.levelUp();
    Audio.setTrack(lv.music);
    this.message('ENTERING ' + lv.name);
  },

  makeEnemy(type, x, y) {
    const def = ENEMY_TYPES[type];
    return {
      type,
      x, y,
      hp: def.hp,
      maxHp: def.hp,
      speed: def.speed,
      sight: def.sight,
      damage: def.damage,
      attackRange: def.attackRange,
      attackCooldown: def.attackCooldown,
      size: def.size,
      flies: !!def.flies,
      homing: !!def.homing,
      melee: !!def.melee,
      shoots: def.shoots || null,
      boss: !!def.boss,
      alive: true,
      attackT: 0,
      bob: 0,
      aggro: false,
      state: 'idle',   // idle | alert | chase | attack | pain | dying
      painT: 0,
      dyingT: 0,
      sawPlayerAt: 0,
    };
  },

  pickupType: type => {
    switch (type) {
      case 'stimpack':         return { kind: 'health', amount: 25 };
      case 'mega_armor':       return { kind: 'armor',  amount: 50 };
      case 'ammo_pistol':      return { kind: 'ammo',   ammo: 'pistol',   amount: 10 };
      case 'ammo_shotgun':     return { kind: 'ammo',   ammo: 'shotgun',  amount: 4 };
      case 'super_shotgun_ammo':return { kind: 'ammo',  ammo: 'chaingun', amount: 30 };
      case 'shotgun':          return { kind: 'weapon', weapon: 2, ammoFor: 'shotgun', ammo: 6 };
    }
    return null;
  },

  // -------- Game loop update --------
  update(dt) {
    if (this.state === 'menu') return;
    if (this.state === 'dead' || this.state === 'win') return;
    if (this.state === 'level') {
      this.levelTimer += dt;
      return;
    }

    this.playerUpdate(dt);
    this.enemyUpdate(dt);
    this.projectileUpdate(dt);
    this.pickupUpdate(dt);
    this.spawnWaves(dt);
    this.messageTimer = Math.max(0, this.messageTimer - dt);
    this.levelTimer += dt;

    // Win: all enemies (and wave-spawned) are gone
    if (this.enemies.length === 0) {
      this.win();
      return;
    }

    Audio.musicTick();

    // Sync DOM HUD
    this.syncHUD();
  },

  playerUpdate(dt) {
    const p = this.player;
    const keys = Input.keys;

    // Rotation
    const mdx = Input.consumeMouseDX();
    if (mdx !== 0) {
      const r = mdx * MOUSE_SENS;
      const c = Math.cos(r), s = Math.sin(r);
      const odX = p.dirX, odY = p.dirY;
      p.dirX = odX * c - odY * s;
      p.dirY = odX * s + odY * c;
      const opX = p.planeX, opY = p.planeY;
      p.planeX = opX * c - opY * s;
      p.planeY = opX * s + opY * c;
    }
    if (keys['ArrowLeft'])  this.rotate(-ROT_KEY_SPEED * dt);
    if (keys['ArrowRight']) this.rotate( ROT_KEY_SPEED * dt);

    // Movement
    const running = keys['ShiftLeft'] || keys['ShiftRight'];
    const speed = MOVE_SPEED * dt * (running ? RUN_FACTOR : 1);

    let mx = 0, my = 0;
    if (keys['KeyW'] || keys['ArrowUp'])    { mx += p.dirX * speed; my += p.dirY * speed; }
    if (keys['KeyS'] || keys['ArrowDown'])  { mx -= p.dirX * speed; my -= p.dirY * speed; }
    if (keys['KeyA'])                      { mx -= p.planeX * speed * 0.8; my -= p.planeY * speed * 0.8; }
    if (keys['KeyD'])                      { mx += p.planeX * speed * 0.8; my += p.planeY * speed * 0.8; }

    // Collision: check grid cells touched
    this.movePlayer(p.x + mx, p.y, p.size);
    this.movePlayer(p.x, p.y + my, p.size);

    // Bob
    if (Input.isMoving()) {
      p.bobPhase += dt * 8;
    } else {
      p.bobPhase *= 0.9;
    }

    // Kick anim decay
    p.kickAnim = Math.max(0, p.kickAnim - dt * 4);

    // Invuln decay
    p.invuln = Math.max(0, p.invuln - dt);

    // Fire: held fire (works for chaingun); respects fireRate
    const now = performance.now() / 1000;
    const w = WEAPONS[p.weapon];
    if ((Input.firePressed || Input.keys['Space']) && now - p.lastFire > w.fireRate) {
      if (this.hasAmmoFor(p.weapon)) {
        this.fire();
        p.lastFire = now;
      }
    }
  },

  rotate(angle) {
    const p = this.player;
    const c = Math.cos(angle), s = Math.sin(angle);
    const odX = p.dirX, odY = p.dirY;
    p.dirX = odX * c - odY * s;
    p.dirY = odX * s + odY * c;
    const opX = p.planeX, opY = p.planeY;
    p.planeX = opX * c - opY * s;
    p.planeY = opX * s + opY * c;
  },

  movePlayer(nx, ny, sz) {
    const p = this.player;
    const margin = 0.18;
    const lv = LEVELS[this.level];
    const map = lv.map;
    const tryX = clamp(nx, margin, map[0].length - 1 - margin);
    const tryY = clamp(ny, margin, map.length - 1 - margin);

    // Check 4 corners
    const corners = [
      [tryX - margin, tryY - margin],
      [tryX + margin, tryY - margin],
      [tryX - margin, tryY + margin],
      [tryX + margin, tryY + margin],
    ];
    let blocked = false;
    for (const [cx, cy] of corners) {
      const mx = Math.floor(cx), my = Math.floor(cy);
      if (my < 0 || mx < 0 || my >= map.length || mx >= map[0].length) { blocked = true; break; }
      const t = map[my][mx];
      if (t > 0 && t < 9) { blocked = true; break; }
    }
    if (!blocked) { p.x = tryX; p.y = tryY; }
  },

  fire() {
    const p = this.player;
    const w = WEAPONS[p.weapon];
    p.kickAnim = 1;

    if (p.weapon === 0) {
      // Fist: hitscan in arc in front
      this.fistSwing();
    } else {
      if (p.weapon !== 0) p.ammo[w.ammo]--;
      // Spawn pellets (hitscan style with spread)
      const baseAng = Math.atan2(p.dirY, p.dirX);
      for (let i = 0; i < w.pellets; i++) {
        const ang = baseAng + (Math.random() - 0.5) * w.spread;
        this.fireBullet(ang, w.range, w.damage, w.name);
      }
      if (p.weapon === 1) Audio.pistol();
      else if (p.weapon === 2) Audio.shotgun();
      else if (p.weapon === 3) Audio.chaingun();
    }
  },

  fistSwing() {
    Audio.fist();
    const p = this.player;
    const reach = 1.6;
    for (const e of this.enemies) {
      if (!e.alive) continue;
      const dx = e.x - p.x, dy = e.y - p.y;
      const d  = Math.sqrt(dx*dx + dy*dy);
      if (d > reach) continue;
      // Cone: must be in front (within ~60°)
      const normX = dx / d, normY = dy / d;
      const fwd   = p.dirX * normX + p.dirY * normY;
      if (fwd < 0.4) continue;
      this.damageEnemy(e, 14);
    }
  },

  fireBullet(ang, range, damage, name) {
    const p = this.player;
    const rayDirX = Math.cos(ang), rayDirY = Math.sin(ang);

    // Find nearest enemy hit (or wall)
    let bestT = range;
    let hitEnemy = null;
    for (const e of this.enemies) {
      if (!e.alive) continue;
      // Closest point on the line to the enemy
      const ax = e.x - p.x, ay = e.y - p.y;
      const t  = ax * rayDirX + ay * rayDirY;
      if (t < 0 || t > bestT) continue;
      const cx = p.x + rayDirX * t, cy = p.y + rayDirY * t;
      const ddx = e.x - cx, ddy = e.y - cy;
      const distSq = ddx*ddx + ddy*ddy;
      const hitR = (e.size + 0.1) * 0.7;
      if (distSq <= hitR * hitR) {
        bestT = t;
        hitEnemy = e;
      }
    }
    if (hitEnemy) {
      this.damageEnemy(hitEnemy, damage);
    }

    // Spawn a tiny tracer sprite so the bullet is visible
    this.projectiles.push({
      kind: 'tracer',
      x: p.x + rayDirX * bestT,
      y: p.y + rayDirY * bestT,
      vx: rayDirX * 0.5, vy: rayDirY * 0.5,
      life: 0.1,
      damage: 0,
      size: 0.2,
      friendly: true,
    });
  },

  damageEnemy(e, dmg) {
    e.hp -= dmg;
    Audio.enemyHurt();
    if (e.hp <= 0) {
      e.alive = false;
      e.dyingT = 1.0;
      Audio.enemyDie();
      this.totalKills++;
      this.levelKills++;
      // Small chance of ammo drop
      if (Math.random() < 0.18) {
        const drop = Math.random() < 0.5 ? 'ammo_pistol' :
                     Math.random() < 0.5 ? 'ammo_shotgun' : 'stimpack';
        this.pickups.push({
          type: drop, x: e.x, y: e.y,
          bob: Math.random() * Math.PI * 2, t: 0, dead: false,
        });
      }
    } else {
      e.painT = 0.25;
      e.state = 'chase';
      e.aggro = true;
    }
  },

  enemyUpdate(dt) {
    const p = this.player;
    const lv = LEVELS[this.level];
    const map = lv.map;

    for (const e of this.enemies) {
      if (!e.alive) {
        e.dyingT -= dt;
        continue;
      }
      if (e.painT > 0) e.painT -= dt;

      // Distance / line-of-sight
      const dx = p.x - e.x, dy = p.y - e.y;
      const d  = Math.sqrt(dx*dx + dy*dy);
      e.sawPlayerAt = e.sawPlayerAt || 0;
      const hasLOS = (d < e.sight) && this.los(e.x, e.y, p.x, p.y, map);
      if (hasLOS) {
        e.aggro = true;
        e.sawPlayerAt = this.levelTimer;
      }

      if (!e.aggro) {
        // Idle: small bobbing
        e.bob += dt * 2;
        continue;
      }

      // AI state
      if (e.melee && !e.shoots) {
        // Pure melee: just chase
        this.chaseEnemy(e, p, dx, dy, d, dt);
      } else if (e.shoots) {
        // Ranged: maintain range
        if (d > e.attackRange * 1.2 || (!hasLOS && d > e.attackRange)) {
          this.chaseEnemy(e, p, dx, dy, d, dt);
        } else if (d < e.attackRange * 0.7) {
          // Too close, strafe back
          this.strafe(e, dx, dy, d, dt, -1);
        }
      } else if (e.homing) {
        // Lost soul: chase directly, fast
        this.chaseEnemy(e, p, dx, dy, d, dt);
      }

      // Attack
      e.attackT -= dt;
      if (hasLOS && d <= e.attackRange && e.attackT <= 0) {
        this.enemyAttack(e, p, d);
        e.attackT = e.attackCooldown;
      }

      e.bob += dt * 6;
    }

    // Cull dead (after death anim)
    this.enemies = this.enemies.filter(e => e.alive || e.dyingT > 0);
  },

  los(ax, ay, bx, by, map) {
    const dx = bx - ax, dy = by - ay;
    const dist = Math.sqrt(dx*dx + dy*dy);
    const steps = Math.ceil(dist * 2);
    const nx = dx / steps, ny = dy / steps;
    for (let i = 1; i < steps; i++) {
      const cx = ax + nx * i, cy = ay + ny * i;
      const mx = Math.floor(cx), my = Math.floor(cy);
      if (my < 0 || mx < 0 || my >= map.length || mx >= map[0].length) return false;
      const t = map[my][mx];
      if (t > 0 && t < 9) return false;
    }
    return true;
  },

  chaseEnemy(e, p, dx, dy, d, dt) {
    if (d < 0.01) return;
    const nx = dx / d, ny = dy / d;
    const sp = e.speed * dt;
    const tryX = e.x + nx * sp, tryY = e.y + ny * sp;
    if (!this.enemyBlocked(tryX, e.y, e.size)) e.x = tryX;
    if (!this.enemyBlocked(e.x, tryY, e.size)) e.y = tryY;
  },

  strafe(e, dx, dy, d, dt, dir) {
    if (d < 0.01) return;
    const nx = dx / d, ny = dy / d;
    // perpendicular
    const px = -ny, py = nx;
    const sp = e.speed * 0.5 * dt;
    const tryX = e.x + px * dir * sp;
    const tryY = e.y + py * dir * sp;
    if (!this.enemyBlocked(tryX, e.y, e.size)) e.x = tryX;
    if (!this.enemyBlocked(e.x, tryY, e.size)) e.y = tryY;
  },

  enemyBlocked(x, y, sz) {
    const margin = sz * 0.55;
    const lv = LEVELS[this.level];
    const map = lv.map;
    for (const [cx, cy] of [
      [x - margin, y - margin],
      [x + margin, y - margin],
      [x - margin, y + margin],
      [x + margin, y + margin],
    ]) {
      const mx = Math.floor(cx), my = Math.floor(cy);
      if (my < 0 || mx < 0 || my >= map.length || mx >= map[0].length) return true;
      const t = map[my][mx];
      if (t > 0 && t < 9) return true;
    }
    return false;
  },

  enemyAttack(e, p, d) {
    if (e.melee) {
      // Touch damage
      this.damagePlayer(e.damage);
      Audio.hurt();
    } else if (e.shoots === 'fireball') {
      this.spawnEnemyProjectile(e, 'fireball', 6);
    } else if (e.shoots === 'rocket') {
      this.spawnEnemyProjectile(e, 'rocket', 4);
    } else if (e.shoots === 'spread') {
      this.spawnEnemyProjectile(e, 'fireball', 5, true);
    }
  },

  spawnEnemyProjectile(e, kind, speed, spread = false) {
    const p = this.player;
    const dx = p.x - e.x, dy = p.y - e.y;
    const d = Math.sqrt(dx*dx + dy*dy);
    const baseAng = Math.atan2(dy, dx);
    if (spread) {
      for (let s = -1; s <= 1; s++) {
        const ang = baseAng + s * 0.18;
        this.projectiles.push({
          kind, x: e.x, y: e.y,
          vx: Math.cos(ang) * speed, vy: Math.sin(ang) * speed,
          life: 2.0, damage: e.damage, friendly: false, size: 0.25,
        });
      }
    } else {
      this.projectiles.push({
        kind, x: e.x, y: e.y,
        vx: dx/d * speed, vy: dy/d * speed,
        life: 2.0, damage: e.damage, friendly: false, size: 0.25,
      });
    }
  },

  projectileUpdate(dt) {
    for (const pr of this.projectiles) {
      pr.life -= dt;
      pr.x += pr.vx * dt;
      pr.y += pr.vy * dt;
      if (pr.life <= 0) continue;

      // Wall collision
      const mx = Math.floor(pr.x), my = Math.floor(pr.y);
      const lv = LEVELS[this.level];
      const map = lv.map;
      if (my < 0 || mx < 0 || my >= map.length || mx >= map[0].length) {
        pr.life = 0;
        continue;
      }
      if (map[my][mx] > 0) {
        pr.life = 0;
        continue;
      }

      if (pr.friendly) {
        // Hit enemy
        for (const e of this.enemies) {
          if (!e.alive) continue;
          const dx = e.x - pr.x, dy = e.y - pr.y;
          if (dx*dx + dy*dy < (e.size + 0.1) * (e.size + 0.1) * 0.6) {
            this.damageEnemy(e, pr.damage || 8);
            pr.life = 0;
            break;
          }
        }
      } else {
        // Hit player
        const dx = this.player.x - pr.x, dy = this.player.y - pr.y;
        if (dx*dx + dy*dy < 0.4 * 0.4) {
          this.damagePlayer(pr.damage);
          pr.life = 0;
        }
      }
    }

    // Cull
    this.projectiles = this.projectiles.filter(p => p.life > 0);
  },

  pickupUpdate(dt) {
    for (const pk of this.pickups) {
      pk.t += dt;
      pk.bob += dt * 3;
      // Pickup if player walks over it
      const dx = this.player.x - pk.x, dy = this.player.y - pk.y;
      if (dx*dx + dy*dy < 0.5) {
        const def = this.pickupType(pk.type);
        if (!def) { pk.dead = true; continue; }
        switch (def.kind) {
          case 'health': this.player.hp = Math.min(this.player.maxHp, this.player.hp + def.amount); break;
          case 'armor':  this.player.armor = Math.min(100, this.player.armor + def.amount); break;
          case 'ammo':   this.player.ammo[def.ammo] = (this.player.ammo[def.ammo] || 0) + def.amount; break;
          case 'weapon':
            this.player.weapon = def.weapon;
            this.player.ammo[def.ammoFor] = (this.player.ammo[def.ammoFor] || 0) + def.ammo;
            break;
        }
        pk.dead = true;
        Audio.pickup();
        this.message(pk.type.replace(/_/g,' ').toUpperCase());
      }
    }
    this.pickups = this.pickups.filter(p => !p.dead);
  },

  spawnWaves(dt) {
    const lv = LEVELS[this.level];
    if (!lv.spawn_waves) return;
    for (const w of lv.spawn_waves) {
      if (!w.fired && this.levelTimer >= w.at) {
        w.fired = true;
        for (const s of w.spawns) {
          const e = this.makeEnemy(s.type, s.x, s.y);
          e.spawnFromWave = true;
          this.enemies.push(e);
        }
        this.message('INCOMING!');
      }
    }
  },

  damagePlayer(dmg) {
    if (this.godMode) return;
    const p = this.player;
    if (p.invuln > 0) return;
    const armorAbsorb = Math.min(this.player.armor, dmg * 0.7);
    this.player.armor = Math.max(0, this.player.armor - armorAbsorb);
    const hpDmg = dmg - armorAbsorb;
    p.hp -= hpDmg;
    p.invuln = 0.4;
    Audio.hurt();
    Renderer.flash(0.35);
    if (p.hp <= 0) {
      this.die();
    }
  },

  die() {
    if (this.state === 'dead') return;
    this.state = 'dead';
    Audio.stopMusic();
    this.hideOverlays();
    document.getElementById('death-screen').style.display = 'flex';
  },

  win() {
    if (this.state === 'win') return;
    this.state = 'win';
    Audio.stopMusic();
    Audio.levelUp();
    this.hideOverlays();

    const nextLevel = this.level + 1;
    if (nextLevel < LEVELS.length) {
      // Mid-campaign: show stats briefly, then auto-advance
      document.getElementById('win-stats').textContent =
        `KILLS: ${this.totalKills}  ·  NEXT ${LEVELS[nextLevel].name}`;
      document.getElementById('win-screen').style.display = 'flex';
      setTimeout(() => {
        if (this.state === 'win') {
          this.hideOverlays();
          this.loadLevel(nextLevel);
          this.state = 'playing';
        }
      }, 2500);
    } else {
      // Final level complete: full mission complete screen
      document.getElementById('win-stats').textContent =
        `KILLS: ${this.totalKills}`;
      document.getElementById('win-screen').style.display = 'flex';
    }
  },

  syncHUD() {
    const p = this.player;
    document.getElementById('hud-health').textContent = Math.max(0, Math.ceil(p.hp));
    document.getElementById('hud-health-bar').style.width = (clamp(p.hp / p.maxHp, 0, 1) * 100) + '%';
    document.getElementById('hud-armor').textContent = Math.round(p.armor);
    document.getElementById('hud-armor-bar').style.width = clamp(p.armor / 100, 0, 1) * 100 + '%';
    document.getElementById('hud-weapon').textContent = WEAPONS[p.weapon].name + ' (' + (p.weapon + 1) + ')';
    document.getElementById('hud-ammo').textContent =
      p.weapon === 0 ? 'INF' : (p.ammo[WEAPONS[p.weapon].ammo] || 0);
    document.getElementById('title-stats').textContent =
      `KILLS ${this.totalKills}`;

    if (this.messageTimer > 0) {
      const msg = document.getElementById('hud-message');
      msg.textContent = this.messageText;
      msg.classList.add('show');
    } else {
      document.getElementById('hud-message').classList.remove('show');
    }
  },
};

// ============================================================
// MAIN LOOP
// ============================================================

let last = 0;
function tick(now) {
  if (!last) last = now;
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;

  if (Game.state === 'playing' || Game.state === 'level') {
    Game.update(dt);

    if (Game.state === 'playing') {
      const lv = LEVELS[Game.level];
      Renderer.render(Game.player, {
        map: lv.map,
        level: lv,
        enemies: Game.enemies,
        projectiles: Game.projectiles,
        pickups: Game.pickups,
      });
    }

    if (Game.state === 'level') {
      // Show "Entering E1M2" screen
      const ls = document.getElementById('level-screen');
      document.getElementById('level-name').textContent = LEVELS[Game.level].name;
      ls.style.display = 'flex';
      ls.style.opacity = '1';
      if (Game.levelTimer >= 1.5) {
        ls.style.opacity = '0';
        if (Game.levelTimer >= 2.0) {
          ls.style.display = 'none';
          Game.state = 'playing';
          Game.levelTimer = 0;
        }
      }
    }
  }

  requestAnimationFrame(tick);
}

// ============================================================
// BOOT
// ============================================================

// The script tag is at the end of <body>, so the DOM is already parsed.
// Run init synchronously. We still guard against the script being hoisted
// higher by checking readyState and waiting for DOMContentLoaded if needed.

function boot() {
  Renderer.init();
  Game.init();

  const btn = document.getElementById('start-btn');
  if (btn && !btn.dataset.bound) {
    btn.dataset.bound = '1';
    btn.addEventListener('click', () => {
      Game.start();
      requestAnimationFrame(tick);
    });
  }

  // Render a static title scene before play starts
  const lv0 = LEVELS[0];
  try {
    Renderer.render(Game.player, {
      map: lv0.map, level: lv0, enemies: [], projectiles: [], pickups: [],
    });
  } catch (e) {
    console.error('Initial render failed', e);
  }

  requestAnimationFrame(tick);
}

if (document.readyState === 'loading') {
  window.addEventListener('DOMContentLoaded', () => {
    try { boot(); }
    catch (e) {
      console.error('boot() failed', e);
      window.__doomErrors.push({ bootFailed: true, msg: e.message, stack: e.stack });
    }
  }, { once: true });
} else {
  try { boot(); }
  catch (e) {
    console.error('boot() failed', e);
    window.__doomErrors.push({ bootFailed: true, msg: e.message, stack: e.stack });
  }
}

// Expose internals for the browser console / debugging
window.Game = Game;
window.Renderer = Renderer;
window.Input = Input;
window.Audio = Audio;
window.LEVELS = LEVELS;

})();
