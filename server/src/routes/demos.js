import { Router } from 'express';
import db from '../db.js';
import { authRequired } from '../middleware/auth.js';

const router = Router();

// ---- Public reads ----
router.get('/demos/:slug', (req, res) => {
  const row = db.prepare("SELECT * FROM demos WHERE slug = ? AND status = 'published'").get(req.params.slug);
  if (!row) return res.status(404).json({ error: 'not_found' });
  if (row.kit_slug) {
    const kit = db.prepare("SELECT status FROM kits WHERE slug = ?").get(row.kit_slug);
    if (kit && kit.status !== 'published') {
      return res.status(404).json({ error: 'not_found' });
    }
  }
  res.json({ demo: row });
});

// ---- Admin ----
router.get('/admin/demos', authRequired, (_req, res) => {
  const rows = db.prepare('SELECT * FROM demos ORDER BY created_at DESC').all();
  res.json({ demos: rows });
});

router.post('/admin/demos', authRequired, (req, res) => {
  const { slug, title, html, kit_slug, status } = req.body || {};
  if (!slug || !title) return res.status(400).json({ error: 'slug_and_title_required' });
  if (!['draft', 'published'].includes(status || 'draft')) {
    return res.status(400).json({ error: 'invalid_status' });
  }
  try {
    const info = db
      .prepare(`INSERT INTO demos (slug, title, html, kit_slug, status) VALUES (?, ?, ?, ?, ?)`)
      .run(slug, title, html || '', kit_slug || null, status || 'draft');
    const row = db.prepare('SELECT * FROM demos WHERE id = ?').get(info.lastInsertRowid);
    res.status(201).json({ demo: row });
  } catch (e) {
    if (String(e.message).includes('UNIQUE')) return res.status(409).json({ error: 'slug_taken' });
    throw e;
  }
});

router.put('/admin/demos/:slug', authRequired, (req, res) => {
  const existing = db.prepare('SELECT * FROM demos WHERE slug = ?').get(req.params.slug);
  if (!existing) return res.status(404).json({ error: 'not_found' });
  const fields = ['title', 'html', 'kit_slug', 'status'];
  const updates = [];
  const values = [];
  for (const f of fields) {
    if (f in (req.body || {})) {
      updates.push(`${f} = ?`);
      values.push(req.body[f]);
    }
  }
  if (updates.length === 0) return res.json({ demo: existing });
  updates.push("updated_at = datetime('now')");
  values.push(req.params.slug);
  db.prepare(`UPDATE demos SET ${updates.join(', ')} WHERE slug = ?`).run(...values);
  const row = db.prepare('SELECT * FROM demos WHERE slug = ?').get(req.params.slug);
  res.json({ demo: row });
});

router.delete('/admin/demos/:slug', authRequired, (req, res) => {
  const info = db.prepare('DELETE FROM demos WHERE slug = ?').run(req.params.slug);
  if (info.changes === 0) return res.status(404).json({ error: 'not_found' });
  res.json({ ok: true });
});

export default router;
