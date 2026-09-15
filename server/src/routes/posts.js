import { Router } from 'express';
import db from '../db.js';
import { authRequired } from '../middleware/auth.js';

const router = Router();

function rowToPost(r) {
  if (!r) return null;
  const { body_md, ...rest } = r;
  return { ...rest, body_md };
}

// ---- Public reads ----
router.get('/posts', (req, res) => {
  const limit = Math.min(parseInt(req.query.limit || '50', 10), 100);
  const offset = Math.max(parseInt(req.query.offset || '0', 10), 0);
  const rows = db
    .prepare(
      `SELECT slug, title, excerpt, cover_image, status, published_at, created_at, updated_at
       FROM posts WHERE status = 'published'
       ORDER BY (published_at IS NULL), published_at DESC, created_at DESC
       LIMIT ? OFFSET ?`
    )
    .all(limit, offset);
  res.json({ posts: rows });
});

router.get('/posts/:slug', (req, res) => {
  const row = db
    .prepare("SELECT * FROM posts WHERE slug = ? AND status = 'published'")
    .get(req.params.slug);
  if (!row) return res.status(404).json({ error: 'not_found' });
  res.json({ post: rowToPost(row) });
});

// ---- Admin ----
router.get('/admin/posts', authRequired, (_req, res) => {
  const rows = db
    .prepare('SELECT * FROM posts ORDER BY created_at DESC')
    .all();
  res.json({ posts: rows });
});

router.post('/admin/posts', authRequired, (req, res) => {
  const { slug, title, excerpt, body_md, cover_image, status, published_at } = req.body || {};
  if (!slug || !title) return res.status(400).json({ error: 'slug_and_title_required' });
  if (!['draft', 'published'].includes(status || 'draft')) {
    return res.status(400).json({ error: 'invalid_status' });
  }
  try {
    const info = db
      .prepare(
        `INSERT INTO posts (slug, title, excerpt, body_md, cover_image, status, published_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .run(slug, title, excerpt || '', body_md || '', cover_image || null, status || 'draft', published_at || null);
    const row = db.prepare('SELECT * FROM posts WHERE id = ?').get(info.lastInsertRowid);
    res.status(201).json({ post: rowToPost(row) });
  } catch (e) {
    if (String(e.message).includes('UNIQUE')) return res.status(409).json({ error: 'slug_taken' });
    throw e;
  }
});

router.put('/admin/posts/:slug', authRequired, (req, res) => {
  const existing = db.prepare('SELECT * FROM posts WHERE slug = ?').get(req.params.slug);
  if (!existing) return res.status(404).json({ error: 'not_found' });
  const fields = ['title', 'excerpt', 'body_md', 'cover_image', 'status', 'published_at'];
  const updates = [];
  const values = [];
  for (const f of fields) {
    if (f in (req.body || {})) {
      updates.push(`${f} = ?`);
      values.push(req.body[f]);
    }
  }
  if (updates.length === 0) return res.json({ post: rowToPost(existing) });
  updates.push("updated_at = datetime('now')");
  values.push(req.params.slug);
  db.prepare(`UPDATE posts SET ${updates.join(', ')} WHERE slug = ?`).run(...values);
  const row = db.prepare('SELECT * FROM posts WHERE slug = ?').get(req.params.slug);
  res.json({ post: rowToPost(row) });
});

router.delete('/admin/posts/:slug', authRequired, (req, res) => {
  const info = db.prepare('DELETE FROM posts WHERE slug = ?').run(req.params.slug);
  if (info.changes === 0) return res.status(404).json({ error: 'not_found' });
  res.json({ ok: true });
});

export default router;
