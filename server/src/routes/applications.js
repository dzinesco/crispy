import { Router } from 'express';
import db from '../db.js';
import { authRequired } from '../middleware/auth.js';

const router = Router();

router.post('/applications', (req, res) => {
  const { name, email, company, brief, budget } = req.body || {};
  if (!name || !email || !brief) return res.status(400).json({ error: 'name_email_brief_required' });
  const info = db
    .prepare('INSERT INTO applications (name, email, company, brief, budget) VALUES (?, ?, ?, ?, ?)')
    .run(String(name).trim(), String(email).trim().toLowerCase(), company || null, String(brief).trim(), budget || null);
  res.status(201).json({ id: info.lastInsertRowid });
});

router.get('/applications', authRequired, (_req, res) => {
  const rows = db.prepare('SELECT * FROM applications ORDER BY created_at DESC').all();
  res.json({ applications: rows });
});

export default router;
