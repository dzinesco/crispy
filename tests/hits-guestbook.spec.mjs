// Hit counter dedupe and guestbook submit + moderation.
// Usage: node tests/hits-guestbook.spec.mjs
import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import fs from 'node:fs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(path.join(root, 'server/package.json'));
const Database = require('better-sqlite3');
const port = 3198;
const base = `http://127.0.0.1:${port}`;

function cookieFrom(res) {
  const list = typeof res.headers.getSetCookie === 'function' ? res.headers.getSetCookie() : [];
  const raw = list.length ? list : [res.headers.get('set-cookie')].filter(Boolean);
  return raw.map((item) => item.split(';')[0]).join('; ');
}

async function api(pathname, { method = 'GET', body, headers = {} } = {}) {
  const res = await fetch(base + pathname, {
    method,
    headers: {
      'content-type': 'application/json',
      ...headers,
    },
    body: body == null ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch { json = { raw: text }; }
  return { status: res.status, json, headers: res.headers, cookie: cookieFrom(res) };
}

async function waitForHealth(child, logs) {
  for (let i = 0; i < 40; i += 1) {
    try {
      const res = await fetch(`${base}/api/health`);
      if (res.ok) return;
    } catch { /* booting */ }
    if (child.exitCode != null) break;
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  throw new Error(`api did not boot\n${logs()}`);
}

function migrationTwice() {
  const db = new Database(':memory:');
  const sql = fs.readFileSync(path.join(root, 'server/migrations/004_hits_guestbook.sql'), 'utf8');
  db.exec(sql);
  db.exec(sql);
  assert.equal(db.prepare('SELECT count FROM hits WHERE id = 1').get().count, 2000);
  db.prepare('UPDATE hits SET count = 2500 WHERE id = 1').run();
  db.exec(sql);
  assert.equal(db.prepare('SELECT count FROM hits WHERE id = 1').get().count, 2500);
  db.close();
}

async function main() {
  migrationTwice();
  const dir = await mkdtemp(path.join(tmpdir(), 'crispy-gb-'));
  const dbFile = path.join(dir, 'test.db');
  let log = '';
  const child = spawn(process.execPath, ['server/src/index.js'], {
    cwd: root,
    env: {
      ...process.env,
      PORT: String(port),
      DATABASE_FILE: dbFile,
      NODE_ENV: 'test',
      JWT_SECRET: 'test-secret',
      ADMIN_EMAIL: 'admin@crispygoat.com',
      ADMIN_PASSWORD: 'changeme',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stdout.on('data', (chunk) => { log += chunk; });
  child.stderr.on('data', (chunk) => { log += chunk; });
  const logs = () => log;

  try {
    await waitForHealth(child, logs);

    const before = await api('/api/hits');
    assert.equal(before.status, 200);
    assert.equal(before.json.count, 2000);
    const still = await api('/api/hits');
    assert.equal(still.json.count, 2000);

    const headers = {
      'user-agent': 'crispy-test',
      'x-forwarded-for': '203.0.113.10',
    };
    const first = await api('/api/hits', { method: 'POST', body: {}, headers });
    assert.equal(first.status, 200);
    assert.equal(first.json.count, 2001);
    const again = await api('/api/hits', { method: 'POST', body: {}, headers });
    assert.equal(again.json.count, 2001);

    const otherAgent = await api('/api/hits', {
      method: 'POST',
      body: {},
      headers: { ...headers, 'user-agent': 'crispy-test-other' },
    });
    assert.equal(otherAgent.json.count, 2002);

    const nextDay = await api('/api/hits', {
      method: 'POST',
      body: {},
      headers: { ...headers, 'x-test-day': '2030-01-02' },
    });
    assert.equal(nextDay.json.count, 2003);

    const db = new Database(dbFile, { readonly: true });
    const stored = JSON.stringify(db.prepare('SELECT visitor_hash, day FROM hit_visitors').all());
    db.close();
    assert.equal(stored.includes('203.0.113.10'), false);
    assert.equal(stored.includes('crispy-test'), false);

    const missing = await api('/api/guestbook', {
      method: 'POST',
      body: { message: 'hi' },
      headers: { 'x-forwarded-for': '203.0.113.20', 'user-agent': 'gb' },
    });
    assert.equal(missing.status, 400);

    const tooLong = await api('/api/guestbook', {
      method: 'POST',
      body: { first_name: 'Ada', message: 'a'.repeat(501) },
      headers: { 'x-forwarded-for': '203.0.113.21', 'user-agent': 'gb' },
    });
    assert.equal(tooLong.status, 400);
    assert.equal(tooLong.json.error, 'message_too_long');

    const honeypot = await api('/api/guestbook', {
      method: 'POST',
      body: { first_name: 'Bot', message: 'buy now', company_url: 'https://spam.test', page: 'guestbook' },
      headers: { 'x-forwarded-for': '203.0.113.22', 'user-agent': 'gb' },
    });
    assert.equal(honeypot.status, 201);

    const signed = await api('/api/guestbook', {
      method: 'POST',
      body: { first_name: 'Ada', city: 'Grand Junction', message: 'Nice goat.', page: 'guestbook' },
      headers: { 'x-forwarded-for': '203.0.113.23', 'user-agent': 'gb' },
    });
    assert.equal(signed.status, 201);
    assert.equal(signed.json.status, 'pending');
    const publicBefore = await api('/api/guestbook?page=guestbook');
    assert.deepEqual(publicBefore.json.entries, []);

    const tylerNote = await api('/api/guestbook', {
      method: 'POST',
      body: { first_name: 'Lin', message: 'Cool profile.', page: 'tyler' },
      headers: { 'x-forwarded-for': '203.0.113.24', 'user-agent': 'gb' },
    });
    assert.equal(tylerNote.status, 201);

    const login = await api('/api/auth/login', {
      method: 'POST',
      body: { email: 'admin@crispygoat.com', password: 'changeme' },
    });
    assert.equal(login.status, 200);
    const auth = { cookie: login.cookie };

    const unauth = await api(`/api/admin/guestbook/${signed.json.id}/approve`, { method: 'POST', body: {} });
    assert.equal(unauth.status, 401);

    const queue = await api('/api/admin/guestbook', { headers: auth });
    assert.equal(queue.status, 200);
    assert.equal(queue.json.entries.length, 2);

    const approved = await api(`/api/admin/guestbook/${signed.json.id}/approve`, {
      method: 'POST',
      body: {},
      headers: auth,
    });
    assert.equal(approved.status, 200);
    assert.equal(approved.json.entry.status, 'approved');

    const visible = await api('/api/guestbook?page=guestbook');
    assert.equal(visible.json.entries.length, 1);
    assert.equal(visible.json.entries[0].first_name, 'Ada');
    assert.equal(visible.json.entries[0].city, 'Grand Junction');
    assert.equal(visible.json.entries[0].status, undefined);

    const tylerPublic = await api('/api/guestbook?page=tyler');
    assert.equal(tylerPublic.json.entries.length, 0);
    await api(`/api/admin/guestbook/${tylerNote.json.id}/approve`, { method: 'POST', body: {}, headers: auth });
    const tylerVisible = await api('/api/guestbook?page=tyler');
    assert.equal(tylerVisible.json.entries.length, 1);
    assert.equal(tylerVisible.json.entries[0].first_name, 'Lin');
    const guestbookOnly = await api('/api/guestbook?page=guestbook');
    assert.equal(guestbookOnly.json.entries.some((entry) => entry.first_name === 'Lin'), false);

    const removed = await api(`/api/admin/guestbook/${signed.json.id}`, { method: 'DELETE', headers: auth });
    assert.equal(removed.status, 200);
    const afterDelete = await api('/api/guestbook?page=guestbook');
    assert.equal(afterDelete.json.entries.length, 0);

    const limitHeaders = { 'x-forwarded-for': '203.0.113.30', 'user-agent': 'limit' };
    for (let i = 0; i < 5; i += 1) {
      const ok = await api('/api/guestbook', {
        method: 'POST',
        body: { first_name: 'Max', message: `note ${i}` },
        headers: limitHeaders,
      });
      assert.equal(ok.status, 201, `sign ${i}`);
    }
    const blocked = await api('/api/guestbook', {
      method: 'POST',
      body: { first_name: 'Max', message: 'one more' },
      headers: limitHeaders,
    });
    assert.equal(blocked.status, 429);

    console.log('hits + guestbook ok');
  } finally {
    child.kill('SIGTERM');
    await rm(dir, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
