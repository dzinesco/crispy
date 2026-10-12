// Home page: hero, Goatshop CTA, limited apps list, mobile overflow, clean console.
// Usage: node tests/home.spec.mjs [baseUrl]
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import {
  projects,
  featuredProject,
  shippedProjects,
  homeGridProjects,
  homeAppsLabel,
  shortName,
} from '../src/data/portfolio.js';

const BASE = (process.argv[2] || process.env.BASE_URL || 'http://127.0.0.1:5173').replace(/\/$/, '');

function track(page, errors) {
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  page.on('pageerror', (err) => errors.push(String(err)));
}

async function main() {
  const featured = featuredProject(projects);
  const grid = homeGridProjects(projects);
  const total = shippedProjects(projects).length;
  assert.ok(featured);
  assert.equal(featured.demoHref, '/demo/goatshop/');
  assert.ok(grid.length > 0);
  assert.ok(grid.length <= 6);
  assert.ok(grid.length < total);

  const browser = await chromium.launch();
  const errors = [];

  const desktop = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  track(desktop, errors);

  await desktop.goto(`${BASE}/`, { waitUntil: 'networkidle' });
  await desktop.getByRole('heading', { level: 1, name: 'A personal homepage, like the internet used to make.' }).waitFor();
  await desktop.getByRole('img', { name: 'Crispy Goat' }).waitFor();
  await desktop.locator('.hit').waitFor();

  const cta = desktop.locator('a.btn-accent');
  assert.equal(await cta.getAttribute('href'), '/demo/goatshop/');
  assert.equal((await cta.innerText()).trim(), `Open ${shortName(featured)}`);

  const desk = desktop.locator('a.home-desk');
  assert.equal(await desk.getAttribute('href'), '/demo/goatshop/');

  const titles = await desktop.locator('.home-grid h3').allTextContents();
  assert.deepEqual(titles.map((title) => title.trim()), grid.map(shortName));
  assert.equal(await desktop.locator('.home-grid > li').count(), grid.length);

  const seeAll = desktop.getByRole('link', { name: homeAppsLabel(total) });
  assert.equal(await seeAll.getAttribute('href'), '/portfolio');
  await seeAll.click();
  await desktop.waitForURL((url) => new URL(url).pathname === '/portfolio');
  await desktop.getByRole('heading', { level: 1, name: 'Apps' }).waitFor();

  await desktop.goto(`${BASE}/blog`, { waitUntil: 'networkidle' });
  await desktop.getByRole('heading', { level: 1, name: 'Blog' }).waitFor();

  const mobile = await browser.newPage({ viewport: { width: 390, height: 844 } });
  track(mobile, errors);
  await mobile.goto(`${BASE}/`, { waitUntil: 'networkidle' });
  await mobile.getByRole('heading', { level: 1, name: /personal homepage/ }).waitFor();
  const overflow = await mobile.evaluate(() => {
    const doc = document.documentElement;
    return doc.scrollWidth - doc.clientWidth;
  });
  assert.ok(overflow <= 1, `horizontal overflow ${overflow}px at 390px`);
  assert.equal(await mobile.locator('a.btn-accent').getAttribute('href'), '/demo/goatshop/');
  assert.equal(await mobile.locator('.home-grid > li').count(), grid.length);

  await browser.close();
  if (errors.length) {
    console.error(errors.join('\n'));
    process.exit(1);
  }
  console.log(`home ok (${grid.length} of ${total} apps)`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
