// Renders /tyler and checks the profile song stays silent until click.
// Usage: node tests/tyler.spec.mjs [baseUrl]
import { chromium } from 'playwright';
import assert from 'node:assert/strict';

const BASE = (process.argv[2] || process.env.BASE_URL || 'http://127.0.0.1:5173').replace(/\/$/, '');

async function main() {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const errors = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  page.on('pageerror', (err) => errors.push(String(err)));

  await page.goto(`${BASE}/tyler`, { waitUntil: 'networkidle' });
  await page.getByRole('heading', { name: 'Tyler', level: 1 }).waitFor();
  const text = await page.locator('body').innerText();
  assert.match(text, /Tyler is in your extended network/);
  assert.match(text, /Mood/);
  assert.match(text, /building/);
  assert.match(text, /Western Slope, Colorado/);
  assert.match(text, /Crispygoat and Black Canyon Tickets/);
  for (const name of ['Elon', 'Creative Director', 'Ledger', 'Canyon', 'Goatshop', 'Napster', 'Windows 98 Setup Challenge', 'Winamp']) {
    assert.match(text, new RegExp(name));
  }
  await page.locator('a[href="/demo/windows98/"]').waitFor();
  await page.locator('a[href="/demo/winamp/"]').waitFor();
  await page.getByRole('img', { name: 'Tyler, drawn as a goat' }).waitFor();
  const song = page.locator('button[data-song]');
  assert.equal(await song.getAttribute('aria-pressed'), 'false');
  const playingBefore = await page.evaluate(() => {
    const ctx = window.AudioContext || window.webkitAudioContext;
    return Boolean(ctx && document.querySelector('button[data-song][aria-pressed="true"]'));
  });
  assert.equal(playingBefore, false);
  await song.click();
  await page.waitForFunction(() => document.querySelector('button[data-song]')?.getAttribute('aria-pressed') === 'true');
  await song.click();
  await page.waitForFunction(() => document.querySelector('button[data-song]')?.getAttribute('aria-pressed') === 'false');

  await page.goto(`${BASE}/guestbook`, { waitUntil: 'networkidle' });
  await page.getByRole('heading', { name: 'Guestbook', level: 1 }).waitFor();
  await page.getByLabel('First name').waitFor();
  await page.getByLabel(/^City/).waitFor();
  await page.getByLabel('Message').waitFor();

  await browser.close();
  if (errors.length) {
    console.error(errors.join('\n'));
    process.exit(1);
  }
  console.log('tyler render ok');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
