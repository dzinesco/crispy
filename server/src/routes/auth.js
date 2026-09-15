import { Router } from 'express';
import bcrypt from 'bcryptjs';
import db from '../db.js';
import { authRequired, signToken, authOptional } from '../middleware/auth.js';

const router = Router();

router.post('/auth/login', (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'email_and_password_required' });
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email.toLowerCase().trim());
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: 'invalid_credentials' });
  }
  const token = signToken(user);
  res.cookie('token', token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: '/',
  });
  res.json({ user: { id: user.id, email: user.email, role: user.role } });
});

router.post('/auth/logout', (_req, res) => {
  res.clearCookie('token', { path: '/' });
  res.json({ ok: true });
});

router.get('/auth/me', authOptional, (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'not_authenticated' });
  const user = db.prepare('SELECT id, email, role FROM users WHERE id = ?').get(req.user.id);
  if (!user) return res.status(401).json({ error: 'not_authenticated' });
  res.json({ user });
});

export default router;
