// Smoke tests for the DeskMate desk.
// Usage: node tests/deskmate.spec.mjs [baseUrl]
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { formatNumber, present } from '../public/demo/deskmate/js/formula.js';

const sheet = {
  A1: '2',
  A2: '3',
  A3: '=A1+A2',
  A4: '=SUM(A1:A2)',
  A5: '=2+3*4',
  A6: '=(2+3)*4',
  A7: '=A1/0',
  B1: '800',
  B2: '40',
  B3: '=SUM(B1:B2)',
  C1: '=A1*A2-1',
};
assert.equal(present(sheet.A3, 'A3', sheet), '5');
assert.equal(present(sheet.A4, 'A4', sheet), '5');
assert.equal(present(sheet.A5, 'A5', sheet), '14');
assert.equal(present(sheet.A6, 'A6', sheet), '20');
assert.equal(present(sheet.A7, 'A7', sheet), 'ERR');
assert.equal(present(sheet.B3, 'B3', sheet), '840');
assert.equal(present(sheet.C1, 'C1', sheet), '5');
assert.equal(formatNumber(1 / 2), '0.5');

const BASE = (process.argv[2] || process.env.BASE_URL || 'http://127.0.0.1:5173').replace(/\/$/, '');
const APPS = ['text', 'sheet', 'filer', 'telecom', 'calendar', 'paint', 'music', 'calc'];

function track(page, errors) {
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  page.on('pageerror', (err) => errors.push(String(err)));
}

async function bootReady(page) {
  await page.addInitScript(() => localStorage.removeItem('crispy.deskmate.v1'));
  const response = await page.goto(`${BASE}/demo/deskmate`, { waitUntil: 'load' });
  assert.ok(response, 'navigation failed');
  assert.ok(page.url().endsWith('/demo/deskmate/'), `expected trailing slash, got ${page.url()}`);
  await page.waitForSelector('[data-boot]');
  await page.waitForSelector('[data-goat] svg');
  assert.match(await page.locator('.boot-name').innerText(), /Crispygoat DeskMate/);
  await page.waitForSelector('[data-boot-ready]');
  assert.match(await page.locator('[data-memory]').innerText(), /655360/);
  await page.keyboard.press('Enter');
  await page.locator('[data-overlay="intro"]').waitFor();
  await page.keyboard.press('Enter');
  await page.locator('[data-overlay="intro"]').waitFor({ state: 'hidden' });
  await page.locator('[data-view="desktop"]').waitFor();
}

async function desk(page) {
  if (await page.locator('[data-view="desktop"]').isVisible()) return;
  await page.keyboard.press('Escape');
  await page.locator('[data-view="desktop"]').waitFor();
}

async function openAt(page, index) {
  await desk(page);
  await page.keyboard.press('Home');
  const col = index % 4;
  const row = Math.floor(index / 4);
  for (let i = 0; i < col; i += 1) await page.keyboard.press('ArrowRight');
  for (let i = 0; i < row; i += 1) await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await page.locator(`[data-view="${APPS[index]}"]`).waitFor();
}

async function main() {
  const browser = await chromium.launch();
  const errors = [];

  const desktop = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await desktop.newPage();
  track(page, errors);
  await bootReady(page);

  for (const [index, id] of APPS.entries()) {
    await openAt(page, index);
    assert.equal(await page.locator(`[data-view="${id}"]`).count(), 1, id);
    await page.keyboard.press('Escape');
    await page.locator('[data-view="desktop"]').waitFor();
  }

  await openAt(page, 0);
  await page.locator('textarea[data-editor]').fill('hello deskmate');
  await page.keyboard.press('F2');
  await page.locator('[data-save-name]').waitFor();
  await page.fill('[data-save-name]', 'HELLO.TXT');
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => {
    const data = JSON.parse(localStorage.getItem('crispy.deskmate.v1') || '{}');
    return data.files?.['HELLO.TXT']?.text === 'hello deskmate';
  });

  await page.keyboard.press('Escape');
  await page.locator('[data-view="desktop"]').waitFor();
  await page.click('#fkeys [data-fkey="1"]');
  await page.locator('[data-view="help"]').waitFor();
  assert.match(await page.locator('#stage').innerText(), /Press F1 for help\. Press F1 again for more help\./);
  await page.keyboard.press('F1');
  await page.locator('[data-help-page="1"]').waitFor();
  assert.match(await page.locator('#stage').innerText(), /You pressed F1 again/);
  await page.keyboard.press('Escape');
  await page.locator('[data-view="desktop"]').waitFor();

  await openAt(page, 1);
  await page.keyboard.type('2');
  await page.keyboard.press('Enter');
  await page.keyboard.type('3');
  await page.keyboard.press('Enter');
  await page.keyboard.type('=SUM(A1:A2)');
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => document.querySelector('[data-cell="A3"]')?.textContent === '5');
  await page.keyboard.press('F7');
  await page.keyboard.press('Alt+L');
  const scanned = await page.locator('#screen').evaluate((el) => el.classList.contains('scanlines'));
  assert.equal(scanned, true);

  await desktop.close();

  const phone = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true });
  const mobile = await phone.newPage();
  track(mobile, errors);
  await mobile.addInitScript(() => localStorage.removeItem('crispy.deskmate.v1'));
  await mobile.goto(`${BASE}/demo/deskmate/`, { waitUntil: 'load' });
  await mobile.waitForSelector('[data-boot-ready]');
  await mobile.tap('[data-boot]');
  await mobile.locator('[data-overlay="intro"]').waitFor();
  await mobile.tap('[data-dismiss-intro]');
  await mobile.locator('#touchkeys').waitFor({ state: 'visible' });
  await mobile.tap('#touchkeys [data-fkey="1"]');
  await mobile.locator('[data-view="help"]').waitFor();
  const fit = await mobile.locator('#screen').evaluate((el) => {
    const rect = el.getBoundingClientRect();
    return rect.height > 40 && rect.width > 40;
  });
  assert.equal(fit, true, 'screen should stay on the phone');
  await phone.close();

  await browser.close();
  if (errors.length) {
    console.error(errors.join('\n'));
    process.exit(1);
  }
  console.log('deskmate smoke ok');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
