// Verifies the new crispy site end-to-end:
//  - visits every public route and screenshots it
//  - logs into /admin
//  - posts a kit + a blog post via the API
//  - screenshots the kit + blog post detail pages
//  - exits non-zero if any console error or page error fired
//
// Usage: node scripts/verify.mjs [baseUrl]
import { chromium } from 'playwright';
import { mkdir } from 'fs/promises';

const BASE = process.argv[2] || 'http://localhost:5174';
const OUT = '/tmp/crispy-screenshots';

const ROUTES = [
  { name: 'home', path: '/' },
  { name: 'about', path: '/about' },
  { name: 'packages', path: '/packages' },
  { name: 'blog', path: '/blog' },
  { name: 'apply', path: '/apply' },
  { name: 'contact', path: '/contact' },
  { name: 'admin-login', path: '/admin/login' },
  { name: '404', path: '/does-not-exist' },
];

const VIEWPORTS = [
  { name: 'desktop', width: 1280, height: 800 },
  { name: 'mobile', width: 390, height: 844 },
];

async function api(base, path, opts = {}) {
  const res = await fetch(`${base}/api${path}`, {
    ...opts,
    headers: {
      'content-type': 'application/json',
      ...(opts.headers || {}),
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API ${path} → ${res.status}: ${text}`);
  }
  return res.json();
}

async function main() {
  await mkdir(OUT, { recursive: true });
  const browser = await chromium.launch();
  const allErrors = [];
  let createdSlug = null;
  let createdKit = null;

  // Phase 1: API — log in, post a blog + a kit
  const apiBase = BASE.replace(/:\d+$/, ':3102');
  const loginRes = await fetch(`${apiBase}/api/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: 'admin@crispygoat.com', password: 'changeme' }),
  });
  if (!loginRes.ok) throw new Error(`login failed: ${loginRes.status}`);
  const cookie = loginRes.headers.get('set-cookie').split(';')[0];

  await api(apiBase, '/admin/posts', {
    method: 'POST',
    headers: { cookie },
    body: JSON.stringify({
      slug: 'verify-hello',
      title: 'Verify: hello world',
      excerpt: 'Posted by scripts/verify.mjs to prove the API works.',
      body_md: '# Hello\n\nThis post was created by the verify script.',
      status: 'published',
      published_at: new Date().toISOString(),
    }),
  });
  createdSlug = 'verify-hello';

  await api(apiBase, '/admin/kits', {
    method: 'POST',
    headers: { cookie },
    body: JSON.stringify({
      slug: 'verify-kit',
      title: 'Verify Kit',
      tagline: '$1 — sanity check',
      description_md: '<p>Created by the verify script.</p>',
      price_cents: 100,
      features_json: '["Feature one","Feature two"]',
      status: 'published',
    }),
  });
  createdKit = 'verify-kit';

  // Phase 2: visit every route at both viewports
  for (const vp of VIEWPORTS) {
    const ctx = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      deviceScaleFactor: 1,
    });
    const page = await ctx.newPage();
    page.on('console', (msg) => {
      if (msg.type() === 'error') allErrors.push(`[${vp.name} console] ${msg.text()}`);
    });
    page.on('pageerror', (err) => allErrors.push(`[${vp.name} pageerror] ${err.message}`));

    const allRoutes = [...ROUTES];
    if (vp.name === 'desktop' && createdSlug) {
      allRoutes.push({ name: 'blog-post', path: `/blog/${createdSlug}` });
      allRoutes.push({ name: 'kit-detail', path: `/kits/${createdKit}` });
    }
    for (const r of allRoutes) {
      const url = BASE + r.path;
      try {
        await page.goto(url, { waitUntil: 'load', timeout: 15000 });
        await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {});
        const file = `${OUT}/${vp.name}-${r.name}.png`;
        await page.screenshot({ path: file, fullPage: false });
        console.log(`[${vp.name}] ${url} → ${file}`);
      } catch (e) {
        allErrors.push(`[${vp.name}] ${r.path}: ${e.message}`);
      }
    }
    await ctx.close();
  }

  await browser.close();

  if (allErrors.length) {
    console.log('\n❌ ERRORS:');
    for (const e of allErrors) console.log(' -', e);
    process.exit(1);
  }
  console.log('\n✅ all routes rendered with no console errors');
}

main().catch((e) => {
  console.error('verify failed:', e);
  process.exit(1);
});
