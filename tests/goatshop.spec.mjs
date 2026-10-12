// Smoke tests for Goatshop 5.0.
// Usage: node tests/goatshop.spec.mjs [baseUrl]
import { chromium } from 'playwright';
import assert from 'node:assert/strict';

const BASE = (process.argv[2] || process.env.BASE_URL || 'http://127.0.0.1:5173').replace(/\/$/, '');

function track(page, errors) {
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  page.on('pageerror', (err) => errors.push(String(err)));
}

async function boot(page) {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(`${BASE}/demo/goatshop/`, { waitUntil: 'load' });
  const splash = page.locator('[data-action=splash-continue]');
  if (await splash.isVisible()) await splash.click();
  await page.waitForSelector('[data-screen=start]:not([hidden])');
}

async function sample(page, x, y) {
  return page.evaluate(([px, py]) => window.goatshop.sample(px, py), [x, y]);
}

async function stroke(page, x0, y0, x1, y1) {
  const start = await page.evaluate(([x, y]) => window.goatshop.docToClient(x, y), [x0, y0]);
  const end = await page.evaluate(([x, y]) => window.goatshop.docToClient(x, y), [x1, y1]);
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(end.x, end.y, { steps: 8 });
  await page.mouse.up();
}

async function clickDoc(page, x, y) {
  const point = await page.evaluate(([px, py]) => window.goatshop.docToClient(px, py), [x, y]);
  await page.mouse.click(point.x, point.y);
}

async function settle(page) {
  await page.evaluate(() => new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(resolve));
  }));
}

async function setMenuCheck(page, menuId, itemId, want) {
  await page.click(`[data-menu=${menuId}]`);
  const entry = page.locator(`[data-menu-item="${itemId}"]`);
  await entry.waitFor({ state: 'visible' });
  const on = (await entry.innerText()).includes('✓');
  if (on !== want) await entry.click();
  else await page.click(`[data-menu=${menuId}]`);
}

async function menu(page, id, item) {
  await page.click(`[data-menu=${id}]`);
  const entry = page.locator(`[data-menu-item="${item}"]`);
  await entry.waitFor({ state: 'visible' });
  await entry.click();
}

async function main() {
  const browser = await chromium.launch();
  const errors = [];
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, acceptDownloads: true });
  const page = await context.newPage();
  track(page, errors);

  const bare = await page.goto(`${BASE}/demo/goatshop`, { waitUntil: 'domcontentloaded' });
  assert.ok(bare, 'navigation failed');
  assert.ok(page.url().endsWith('/demo/goatshop/'), `expected trailing slash, got ${page.url()}`);

  await boot(page);
  await page.click('[data-action=start-new]');
  await page.locator('[data-field=width]').fill('200');
  await page.locator('[data-field=height]').fill('140');
  await page.click('[data-action=dialog-ok]');
  await page.waitForSelector('[data-doc-canvas]');
  await page.waitForFunction(() => window.goatshop?.state?.docs?.length === 1);

  await page.evaluate(() => window.goatshop.setBrush(5, 100));
  await page.click('[data-tool=brush]');
  await stroke(page, 30, 70, 170, 70);
  const painted = await sample(page, 80, 70);
  assert.ok(painted[0] < 40 && painted[1] < 40 && painted[2] < 40, `expected a dark stroke, got ${painted}`);

  await page.click('[data-action=new-layer]');
  await page.waitForFunction(() => document.querySelectorAll('[data-layer-id]').length >= 2);
  await page.locator('[data-field=blend]').selectOption('multiply');
  assert.equal(await page.locator('[data-field=blend]').inputValue(), 'multiply');
  assert.ok(await page.locator('[data-layer-id]').count() >= 2);

  await page.locator('[data-layer-id]').nth(1).click();
  await page.click('[data-tool=wand]');
  await clickDoc(page, 8, 8);
  await page.evaluate(() => window.goatshop.setFg('#ff0000'));
  await menu(page, 'edit', 'edit.fill');
  await page.click('[data-action=dialog-ok]');
  const corner = await sample(page, 8, 8);
  assert.ok(corner[0] > 200 && corner[1] < 40, `expected a red fill, got ${corner}`);
  const strokePx = await sample(page, 80, 70);
  assert.ok(strokePx[0] < 80, `stroke should stay dark, got ${strokePx}`);

  await page.keyboard.press('Control+d');
  const before = await sample(page, 80, 70);
  await menu(page, 'filter', 'filter.blur');
  await page.locator('[data-menu-item="filter.gaussian"]').click();
  await page.locator('[data-field=radius]').fill('16');
  await page.click('[data-action=dialog-ok]');
  await page.waitForFunction(() => !window.goatshop.state.busy);
  await settle(page);
  const after = await sample(page, 80, 70);
  assert.notDeepEqual(after, before, 'gaussian blur should change the stroke');

  const cursor = await page.evaluate(() => window.goatshop.state.docs[0].history.cursor);
  await page.locator(`[data-history-index="${cursor - 1}"]`).click();
  const restored = await sample(page, 80, 70);
  assert.deepEqual(restored, before);

  const downloadPromise = page.waitForEvent('download');
  await menu(page, 'file', 'file.savePng');
  const download = await downloadPromise;
  assert.ok(download.suggestedFilename().endsWith('.png'), download.suggestedFilename());

  await page.evaluate(() => {
    window.dispatchEvent(new KeyboardEvent('keydown', {
      key: 'r', ctrlKey: true, bubbles: true, cancelable: true,
    }));
  });
  await settle(page);
  assert.equal(await page.evaluate(() => window.goatshop.state.showRulers), false);
  await setMenuCheck(page, 'view', 'view.rulers', true);
  await page.waitForFunction(() => {
    const ruler = document.querySelector('[data-ruler-x]');
    if (!ruler || ruler.hidden) return false;
    const box = ruler.getBoundingClientRect();
    if (box.width < 40 || box.height < 8 || ruler.width < 40) return false;
    const data = ruler.getContext('2d').getImageData(0, 0, ruler.width, ruler.height).data;
    let dark = 0;
    for (let i = 0; i < data.length; i += 16) {
      if (data[i] < 40 && data[i + 1] < 40 && data[i + 2] < 40) dark += 1;
    }
    return dark > 4;
  });

  const ruler = await page.locator('[data-ruler-x]').boundingBox();
  const canvasBox = await page.locator('[data-doc-canvas]').boundingBox();
  assert.ok(ruler && canvasBox, 'ruler and canvas should be on screen');
  await page.mouse.move(ruler.x + ruler.width * 0.45, ruler.y + ruler.height * 0.5);
  await page.mouse.down();
  await page.mouse.move(canvasBox.x + canvasBox.width * 0.4, canvasBox.y + Math.min(70, canvasBox.height * 0.35), { steps: 12 });
  await page.mouse.up();
  await settle(page);
  const guides = await page.evaluate(() => window.goatshop.state.docs[0].guides.map((guide) => guide.axis));
  assert.deepEqual(guides, ['h'], `expected one horizontal guide, got ${guides.join(',') || 'none'}`);

  await menu(page, 'view', 'view.clearGuides');
  await settle(page);
  assert.equal(await page.evaluate(() => window.goatshop.state.docs[0].guides.length), 0);

  await context.close();
  await browser.close();
  if (errors.length) {
    console.error(errors.join('\n'));
    process.exit(1);
  }
  console.log('goatshop ok');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
