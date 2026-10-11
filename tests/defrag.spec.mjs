// Disk Defragmenter: model checks, zen mode, and a full floppy clear.
// Usage: node tests/defrag.spec.mjs [baseUrl]
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import {
  LEVELS,
  ZEN_DRIVES,
  createLevel,
  solve,
  isComplete,
  formatResult,
  contiguity,
  mulberry32,
} from '../public/demo/defrag/js/disk.js';
import { createZen, zenStep, zenRestart, zenRatio } from '../public/demo/defrag/js/zen.js';

for (const level of LEVELS) {
  const state = createLevel(level);
  const moves = solve(state);
  assert.equal(isComplete(state), true, `${level.id} should pack (${moves.length} moves)`);
  assert.equal(contiguity(state), 1, level.id);
}
assert.equal(formatResult('2.1GB', 222000, 0.97), 'Defragged 2.1GB in 3:42, 97% contiguous');

const zenDisk = createZen(ZEN_DRIVES[2], 11);
let steps = 0;
while (zenRatio(zenDisk) < 0.4 && steps < 8000) {
  zenStep(zenDisk, { reduced: true });
  steps += 1;
}
assert.ok(zenRatio(zenDisk) >= 0.4, 'zen should advance');
const restarted = zenRestart(zenDisk, mulberry32(9));
assert.ok(Math.abs(restarted - 0.1) < 0.03, `restart landed at ${restarted}`);

const BASE = (process.argv[2] || process.env.BASE_URL || 'http://127.0.0.1:5173').replace(/\/$/, '');

function track(page, errors) {
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  page.on('pageerror', (err) => errors.push(String(err)));
}

async function fresh(browser, viewport, extra = {}) {
  const context = await browser.newContext({ viewport, ...extra });
  await context.addInitScript(() => localStorage.removeItem('crispy.defrag.v1'));
  const page = await context.newPage();
  return { context, page };
}

async function clickCell(page, index) {
  const box = await page.locator('#grid').boundingBox();
  assert.ok(box && box.width > 40, 'cluster map should be on screen');
  const { cols, rows } = await page.evaluate(() => ({
    cols: window.__defrag.cols(),
    rows: window.__defrag.rows(),
  }));
  const col = index % cols;
  const row = Math.floor(index / cols);
  await page.mouse.click(box.x + ((col + 0.5) * box.width) / cols, box.y + ((row + 0.5) * box.height) / rows);
}

async function main() {
  const browser = await chromium.launch();
  const errors = [];

  const desktop = await fresh(browser, { width: 1280, height: 800 });
  track(desktop.page, errors);
  const response = await desktop.page.goto(`${BASE}/demo/defrag`, { waitUntil: 'load' });
  assert.ok(response, 'navigation failed');
  assert.ok(desktop.page.url().endsWith('/demo/defrag/'), desktop.page.url());
  const slash = await desktop.page.request.get(`${BASE}/demo/defrag/`);
  assert.equal(slash.status(), 200);

  await desktop.page.locator('[data-tutorial="zen"]').click();
  await desktop.page.locator('[data-title]').waitFor();
  assert.match(await desktop.page.locator('[data-title]').innerText(), /Defragmenting Drive C/);
  const startPct = parseInt(await desktop.page.locator('[data-progress]').innerText(), 10);
  const startTicks = await desktop.page.evaluate(() => window.__defrag.ticks());
  await desktop.page.locator('[data-action="details"]').click();
  await desktop.page.waitForFunction(() => {
    const rect = document.querySelector('#grid')?.getBoundingClientRect();
    return rect && rect.width > 80 && rect.height > 40;
  });
  await desktop.page.waitForFunction((ticks) => window.__defrag.ticks() > ticks + 3, startTicks);
  const nextPct = parseInt(await desktop.page.locator('[data-progress]').innerText(), 10);
  assert.ok(nextPct >= startPct, `progress moved ${startPct} -> ${nextPct}`);
  const hashCanvas = () => {
    const canvas = document.querySelector('#grid');
    const ctx = canvas.getContext('2d');
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    let hash = 0;
    for (let i = 0; i < data.length; i += 64) hash = (hash + data[i] * 3 + data[i + 1] * 5 + data[i + 2]) % 10000019;
    return hash;
  };
  const first = await desktop.page.evaluate(hashCanvas);
  await desktop.page.waitForFunction((seen) => {
    const canvas = document.querySelector('#grid');
    const ctx = canvas.getContext('2d');
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    let hash = 0;
    for (let i = 0; i < data.length; i += 64) hash = (hash + data[i] * 3 + data[i + 1] * 5 + data[i + 2]) % 10000019;
    return hash !== seen;
  }, first);
  await desktop.page.locator('[data-action="pause"]').click();
  assert.equal(await desktop.page.locator('[data-action="pause"]').innerText(), 'Resume');
  await desktop.page.locator('[data-action="mute"]').click();
  assert.equal(await desktop.page.locator('[data-action="mute"]').getAttribute('aria-pressed'), 'true');
  const legend = await desktop.page.locator('.legend').innerText();
  assert.match(legend, /Optimized data/);
  assert.match(legend, /Bad/);
  await desktop.context.close();

  const game = await fresh(browser, { width: 1280, height: 800 });
  track(game.page, errors);
  await game.page.goto(`${BASE}/demo/defrag/`, { waitUntil: 'load' });
  await game.page.locator('[data-tutorial="game"]').click();
  await game.page.locator('#grid').waitFor({ state: 'visible' });
  await game.page.waitForFunction(() => {
    const rect = document.querySelector('#grid')?.getBoundingClientRect();
    return rect && rect.width > 80 && window.__defrag.mode() === 'game';
  });

  for (let guard = 0; guard < 80; guard += 1) {
    const move = await game.page.evaluate(() => window.__defrag.hintMove());
    if (!move) break;
    await clickCell(game.page, move.from);
    await clickCell(game.page, move.to);
  }
  await game.page.locator('[data-share]').waitFor();
  const card = await game.page.locator('[data-share]').innerText();
  assert.match(card, /Defragged 1\.44MB in \d+:\d{2}, 100% contiguous/);
  const saved = await game.page.evaluate(() => JSON.parse(localStorage.getItem('crispy.defrag.v1')));
  assert.ok(saved.best.floppy.score > 0, 'floppy score should be saved');
  assert.ok(saved.scores.floppy.length >= 1);
  await game.context.close();

  const phone = await fresh(browser, { width: 390, height: 844 }, { hasTouch: true });
  track(phone.page, errors);
  await phone.page.goto(`${BASE}/demo/defrag/`, { waitUntil: 'load' });
  await phone.page.locator('[data-tutorial="later"]').tap();
  await phone.page.locator('#drive').selectOption('floppy');
  await phone.page.locator('input[value="game"]').check();
  await phone.page.locator('[data-action="start"]').tap();
  await phone.page.locator('#grid').waitFor({ state: 'visible' });
  const fit = await phone.page.locator('[data-screen="defrag"]').evaluate((el) => {
    const rect = el.getBoundingClientRect();
    return rect.width > 40 && rect.width <= 390 && rect.top >= -2;
  });
  assert.equal(fit, true, 'window should fit the phone');
  await phone.page.locator('[data-dir="right"]').tap();
  await phone.page.locator('[data-use]').tap();
  await phone.context.close();

  await browser.close();
  if (errors.length) {
    console.error(errors.join('\n'));
    process.exit(1);
  }
  console.log('defrag smoke ok');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
