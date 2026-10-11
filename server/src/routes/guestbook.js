import { Router } from 'express';
import db from '../db.js';
import { authRequired } from '../middleware/auth.js';
import { visitorHash } from '../visitor.js';

const router = Router();
const PAGES = new Set(['guestbook', 'tyler']);
const WINDOW_MS = 60 * 60 * 1000;
const MAX_PER_WINDOW = 5;
const buckets = new Map();

function limited(key) {
  const now = Date.now();
  const fresh = (buckets.get(key) || []).filter((stamp) => now - stamp < WINDOW_MS);
  if (fresh.length >= MAX_PER_WINDOW) {
    buckets.set(key, fresh);
    return true;
  }
  fresh.push(now);
  buckets.set(key, fresh);
  return false;
}

function trimmed(value) {
  return String(value ?? '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').trim();
}

router.get('/guestbook', (req, res) => {
  const page = PAGES.has(req.query.page) ? req.query.page : 'guestbook';
  const limit = Math.min(Math.max(parseInt(req.query.limit || '20', 10) || 20, 1), 50);
  const entries = db
    .prepare(
      `SELECT id, first_name, city, message, page, created_at
       FROM guestbook
       WHERE status = 'approved' AND page = ?
       ORDER BY created_at DESC, id DESC
       LIMIT ?`
    )
    .all(page, limit);
  res.json({ entries });
});

router.post('/guestbook', (req, res) => {
  const body = req.body || {};
  const key = visitorHash(req);

  // Honeypot. Bots fill it; people never see it. Pretend the sign worked.
  if (String(body.company_url || '').trim()) {
    if (limited(key)) return res.status(429).json({ error: 'rate_limited' });
    return res.status(201).json({ ok: true, status: 'pending' });
  }

  const firstName = trimmed(body.first_name);
  const city = trimmed(body.city);
  const message = trimmed(body.message);
  const page = body.page || 'guestbook';

  if (!firstName) return res.status(400).json({ error: 'first_name_required' });
  if (firstName.length > 40) return res.status(400).json({ error: 'first_name_too_long' });
  if (city.length > 60) return res.status(400).json({ error: 'city_too_long' });
  if (!message) return res.status(400).json({ error: 'message_required' });
  if (message.length > 500) return res.status(400).json({ error: 'message_too_long' });
  if (!PAGES.has(page)) return res.status(400).json({ error: 'invalid_page' });
  if (limited(key)) return res.status(429).json({ error: 'rate_limited' });

  const info = db
    .prepare(
      `INSERT INTO guestbook (first_name, city, message, page, status)
       VALUES (?, ?, ?, ?, 'pending')`
    )
    .run(firstName, city || null, message, page);

  res.status(201).json({ ok: true, status: 'pending', id: Number(info.lastInsertRowid) });
});

router.get('/admin/guestbook', authRequired, (_req, res) => {
  const entries = db
    .prepare(
      `SELECT id, first_name, city, message, page, status, created_at
       FROM guestbook
       ORDER BY CASE status WHEN 'pending' THEN 0 ELSE 1 END, created_at DESC, id DESC`
    )
    .all();
  res.json({ entries });
});

router.post('/admin/guestbook/:id/approve', authRequired, (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(404).json({ error: 'not_found' });
  const existing = db.prepare('SELECT id FROM guestbook WHERE id = ?').get(id);
  if (!existing) return res.status(404).json({ error: 'not_found' });
  db.prepare("UPDATE guestbook SET status = 'approved' WHERE id = ?").run(id);
  const entry = db
    .prepare('SELECT id, first_name, city, message, page, status, created_at FROM guestbook WHERE id = ?')
    .get(id);
  res.json({ entry });
});

router.delete('/admin/guestbook/:id', authRequired, (req, res) => {
  const info = db.prepare('DELETE FROM guestbook WHERE id = ?').run(req.params.id);
  if (info.changes === 0) return res.status(404).json({ error: 'not_found' });
  res.json({ ok: true });
});

export default router;
