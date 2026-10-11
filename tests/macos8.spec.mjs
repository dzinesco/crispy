// Smoke tests for the Mac OS 8 desk.
// Usage: node tests/macos8.spec.mjs [baseUrl]
import { chromium } from 'playwright';
import assert from 'node:assert/strict';

const BASE = (process.argv[2] || process.env.BASE_URL || 'http://127.0.0.1:5173').replace(/\/$/, '');

const APPS = ['simpletext', 'paint', 'calculator', 'notepad', 'scrapbook', 'puzzle', 'brickout', 'controls', 'about'];

function track(page, errors) {
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  page.on('pageerror', (err) => errors.push(String(err)));
}

async function boot(page, { reduced = true } = {}) {
  if (reduced) await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript(() => localStorage.removeItem('crispy.macos8.v1'));
  await page.goto(`${BASE}/demo/macos8/`, { waitUntil: 'load' });
  await page.waitForSelector('#menubar');
  await page.waitForSelector('#desktop [data-desktop-icon="vol-hd"], #icon-vol-hd');
}

async function openApp(page, launchId) {
  await page.click('[data-menu="goat"]');
  const item = page.locator(`#menu-pop [data-launch="${launchId}"]`);
  await item.waitFor({ state: 'visible' });
  await item.click();
  const win = page.locator(`.window[data-app="${launchId}"]`);
  await win.waitFor({ state: 'visible' });
  return win;
}

async function main() {
  const browser = await chromium.launch();
  const errors = [];

  const desktop = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await desktop.newPage();
  track(page, errors);

  const bare = await page.goto(`${BASE}/demo/macos8`, { waitUntil: 'domcontentloaded' });
  assert.ok(bare, 'navigation failed');
  assert.ok(page.url().endsWith('/demo/macos8/'), `expected trailing slash, got ${page.url()}`);

  await page.evaluate(() => localStorage.removeItem('crispy.macos8.v1'));
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.reload({ waitUntil: 'load' });
  await page.waitForSelector('#icon-vol-hd');
  const startupHidden = await page.locator('#startup').isHidden();
  assert.equal(startupHidden, true, 'reduced motion should skip the startup');

  for (const app of APPS) {
    const win = await openApp(page, app);
    assert.equal(await win.count(), 1, app);
    if (app === 'calculator') {
      await page.click('.window[data-app="calculator"] [data-key="1"]');
      await page.click('.window[data-app="calculator"] [data-key="+"]');
      await page.click('.window[data-app="calculator"] [data-key="2"]');
      await page.click('.window[data-app="calculator"] [data-key="="]');
      assert.equal(await page.locator('[data-calc-display]').innerText(), '3');
    }
    if (app === 'paint') {
      const canvas = page.locator('[data-paint-canvas]');
      const box = await canvas.boundingBox();
      assert.ok(box, 'paint canvas');
      await page.mouse.move(box.x + 24, box.y + 24);
      await page.mouse.down();
      await page.mouse.move(box.x + 90, box.y + 60, { steps: 6 });
      await page.mouse.up();
    }
    if (app === 'puzzle') {
      await page.click('.window[data-app="puzzle"] .tile:not(.empty)');
    }
    if (app === 'brickout') {
      const canvas = page.locator('[data-brick-canvas]');
      const box = await canvas.boundingBox();
      await page.mouse.click(box.x + box.width / 2, box.y + box.height - 30);
    }
    await page.keyboard.press('Control+w');
    if (app === 'paint') await page.locator('[data-btn="discard"]').click();
    await win.waitFor({ state: 'detached' });
  }

  await page.locator('#icon-vol-hd .glyph').dblclick();
  const finder = page.locator('.window[data-app="finder"]');
  await finder.waitFor({ state: 'visible' });
  await finder.locator('[data-set-view="list"]').click();
  await finder.locator('.row').first().waitFor({ state: 'visible' });
  await finder.locator('[data-set-view="icon"]').click();
  await finder.locator('.ficon').first().waitFor({ state: 'visible' });
  await page.keyboard.press('Control+w');

  const calc = await openApp(page, 'calculator');
  const before = await calc.boundingBox();
  const bar = calc.locator('[data-titlebar]');
  const title = await bar.boundingBox();
  await page.mouse.move(title.x + title.width / 2, title.y + title.height / 2);
  await page.mouse.down();
  await page.mouse.move(title.x + title.width / 2 + 150, title.y + title.height / 2 + 80, { steps: 10 });
  await page.mouse.up();
  const after = await calc.boundingBox();
  assert.ok(Math.abs(after.x - before.x) > 40 || Math.abs(after.y - before.y) > 30, 'window should move when dragged');
  await page.keyboard.press('Control+w');

  await openApp(page, 'simpletext');
  const text = page.locator('.window[data-app="simpletext"] textarea');
  await text.click();
  await text.fill('hello from the desk');
  await page.keyboard.press('Control+s');
  await page.locator('[data-field="filename"]').waitFor();
  await page.fill('[data-field="filename"]', 'Notes');
  await page.click('[data-btn="ok"]');
  await page.locator('[data-dialog]').waitFor({ state: 'detached' });
  const readNotes = () => page.evaluate(() => {
    const data = JSON.parse(localStorage.getItem('crispy.macos8.v1'));
    return Object.values(data.nodes).find((node) => node.name === 'Notes' && !node.trashed);
  });
  const saved = await readNotes();
  assert.ok(saved, 'saved file missing');
  assert.equal(saved.text, 'hello from the desk');
  await page.reload({ waitUntil: 'load' });
  await page.waitForSelector('#icon-vol-hd');
  const kept = await readNotes();
  assert.equal(kept.text, 'hello from the desk');

  const desk = await page.locator('#desktop').boundingBox();
  await page.mouse.click(desk.x + 30, desk.y + 80);
  await page.click('[data-menu="file"]');
  await page.click('#menu-pop [data-cmd="new"]');
  const rename = page.locator('.dicon .rename');
  await rename.waitFor({ state: 'visible' });
  await page.keyboard.press('Escape');
  await rename.waitFor({ state: 'detached' });
  const icon = page.locator('.dicon.selected');
  await icon.waitFor({ state: 'visible' });
  const iconBox = await icon.boundingBox();
  const trashBox = await page.locator('#icon-vol-trash').boundingBox();
  await page.mouse.move(iconBox.x + 20, iconBox.y + 16);
  await page.mouse.down();
  await page.mouse.move(trashBox.x + 16, trashBox.y + 16, { steps: 12 });
  await page.mouse.up();
  await page.waitForFunction(() => {
    const data = JSON.parse(localStorage.getItem('crispy.macos8.v1'));
    return Object.values(data.nodes).some((node) => node.trashed);
  });
  await page.click('[data-menu="special"]');
  await page.click('#menu-pop [data-cmd="empty-trash"]');
  await page.locator('[data-btn="ok"]').click();
  await page.waitForFunction(() => {
    const data = JSON.parse(localStorage.getItem('crispy.macos8.v1'));
    return Object.values(data.nodes).every((node) => !node.trashed);
  });

  const moved = await page.evaluate(async () => {
    const el = document.querySelector('#icon-vol-hd');
    const beforeX = parseFloat(el.style.left);
    const rect = el.getBoundingClientRect();
    const x = rect.left + 12;
    const y = rect.top + 12;
    el.dispatchEvent(new PointerEvent('pointerdown', {
      bubbles: true, cancelable: true, clientX: x, clientY: y, pointerId: 7, pointerType: 'touch', button: 0, buttons: 1,
    }));
    await new Promise((resolve) => setTimeout(resolve, 360));
    el.dispatchEvent(new PointerEvent('pointermove', {
      bubbles: true, cancelable: true, clientX: x + 30, clientY: y + 20, pointerId: 7, pointerType: 'touch', buttons: 1,
    }));
    el.dispatchEvent(new PointerEvent('pointerup', {
      bubbles: true, cancelable: true, clientX: x + 30, clientY: y + 20, pointerId: 7, pointerType: 'touch', button: 0,
    }));
    return Math.abs(parseFloat(el.style.left) - beforeX) > 2;
  });
  assert.equal(moved, true, 'long-press touch drag should move a desktop icon');

  await desktop.close();

  const startupCtx = await browser.newContext({ viewport: { width: 1024, height: 768 } });
  const bootPage = await startupCtx.newPage();
  track(bootPage, errors);
  await bootPage.emulateMedia({ reducedMotion: 'no-preference' });
  await bootPage.addInitScript(() => localStorage.removeItem('crispy.macos8.v1'));
  await bootPage.goto(`${BASE}/demo/macos8/`, { waitUntil: 'load' });
  await bootPage.waitForSelector('#startup[data-ready="1"]');
  assert.equal((await bootPage.locator('.welcome-title').innerText()).trim(), 'Welcome to Mac OS 8');
  await bootPage.locator('.ext').first().waitFor({ state: 'visible', timeout: 4000 });
  await bootPage.click('#startup');
  await bootPage.locator('#startup').waitFor({ state: 'hidden' });
  await bootPage.waitForSelector('#icon-vol-trash');
  await startupCtx.close();

  const phone = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true });
  const mobile = await phone.newPage();
  track(mobile, errors);
  await mobile.emulateMedia({ reducedMotion: 'reduce' });
  await mobile.addInitScript(() => localStorage.removeItem('crispy.macos8.v1'));
  await mobile.goto(`${BASE}/demo/macos8/`, { waitUntil: 'load' });
  await mobile.waitForSelector('#icon-vol-hd');
  const transform = await mobile.locator('#stage').evaluate((el) => getComputedStyle(el).transform);
  assert.match(transform, /matrix/);
  const fit = await mobile.locator('#stage').evaluate((el) => {
    const rect = el.getBoundingClientRect();
    return rect.width <= 391 && rect.height <= 845;
  });
  assert.equal(fit, true, 'desktop should scale to the phone viewport');
  await mobile.tap('[data-menu="goat"]');
  await mobile.locator('#menu-pop [data-launch="calculator"]').tap();
  await mobile.locator('.window[data-app="calculator"]').waitFor({ state: 'visible' });
  await phone.close();

  await browser.close();

  if (errors.length) {
    console.error(errors.join('\n'));
    process.exit(1);
  }
  console.log('macos8 smoke ok');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
