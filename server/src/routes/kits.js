import { Router } from 'express';
import db from '../db.js';
import { authRequired } from '../middleware/auth.js';

const router = Router();

// ---- Public reads ----
router.get('/kits', (_req, res) => {
  const rows = db
    .prepare(
      `SELECT * FROM kits WHERE status = 'published' ORDER BY price_cents ASC, created_at DESC`
    )
    .all();
  res.json({ kits: rows });
});

router.get('/kits/:slug', (req, res) => {
  const row = db
    .prepare("SELECT * FROM kits WHERE slug = ? AND status = 'published'")
    .get(req.params.slug);
  if (!row) return res.status(404).json({ error: 'not_found' });
  res.json({ kit: row });
});

// ---- Admin ----
router.get('/admin/kits', authRequired, (_req, res) => {
  const rows = db.prepare('SELECT * FROM kits ORDER BY created_at DESC').all();
  res.json({ kits: rows });
});

router.post('/admin/kits', authRequired, (req, res) => {
  const {
    slug, title, tagline, description_md, price_cents, stripe_price_id,
    features_json, demo_slug, status,
  } = req.body || {};
  if (!slug || !title || typeof price_cents !== 'number') {
    return res.status(400).json({ error: 'slug_title_price_required' });
  }
  if (!['draft', 'published'].includes(status || 'draft')) {
    return res.status(400).json({ error: 'invalid_status' });
  }
  try {
    const info = db
      .prepare(
        `INSERT INTO kits (slug, title, tagline, description_md, price_cents, stripe_price_id,
                           features_json, demo_slug, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        slug, title, tagline || '', description_md || '', price_cents, stripe_price_id || null,
        features_json || '[]', demo_slug || null, status || 'draft'
      );
    const row = db.prepare('SELECT * FROM kits WHERE id = ?').get(info.lastInsertRowid);
    res.status(201).json({ kit: row });
  } catch (e) {
    if (String(e.message).includes('UNIQUE')) return res.status(409).json({ error: 'slug_taken' });
    throw e;
  }
});

router.put('/admin/kits/:slug', authRequired, (req, res) => {
  const existing = db.prepare('SELECT * FROM kits WHERE slug = ?').get(req.params.slug);
  if (!existing) return res.status(404).json({ error: 'not_found' });
  const fields = ['title', 'tagline', 'description_md', 'price_cents', 'stripe_price_id',
                  'features_json', 'demo_slug', 'status'];
  const updates = [];
  const values = [];
  for (const f of fields) {
    if (f in (req.body || {})) {
      updates.push(`${f} = ?`);
      values.push(req.body[f]);
    }
  }
  if (updates.length === 0) return res.json({ kit: existing });
  updates.push("updated_at = datetime('now')");
  values.push(req.params.slug);
  db.prepare(`UPDATE kits SET ${updates.join(', ')} WHERE slug = ?`).run(...values);
  const row = db.prepare('SELECT * FROM kits WHERE slug = ?').get(req.params.slug);
  res.json({ kit: row });
});

router.delete('/admin/kits/:slug', authRequired, (req, res) => {
  const info = db.prepare('DELETE FROM kits WHERE slug = ?').run(req.params.slug);
  if (info.changes === 0) return res.status(404).json({ error: 'not_found' });
  res.json({ ok: true });
});

export default router;
