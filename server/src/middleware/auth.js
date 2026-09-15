import jwt from 'jsonwebtoken';
import { config } from '../config.js';

export function signToken(user) {
  return jwt.sign({ id: user.id, email: user.email, role: user.role }, config.jwtSecret, {
    expiresIn: '7d',
  });
}

export function verifyToken(token) {
  try {
    return jwt.verify(token, config.jwtSecret);
  } catch {
    return null;
  }
}

export function authRequired(req, res, next) {
  const token = req.cookies?.token;
  const user = token ? verifyToken(token) : null;
  if (!user) return res.status(401).json({ error: 'auth_required' });
  req.user = user;
  next();
}

export function authOptional(req, _res, next) {
  const token = req.cookies?.token;
  req.user = token ? verifyToken(token) : null;
  next();
}
