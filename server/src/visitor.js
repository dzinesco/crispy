import crypto from 'node:crypto';
import { config } from './config.js';

export function utcDay(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

// req.ip is the forwarded client only when trust proxy is on (loopback nginx).
// The raw address is hashed below and never written to the database.
export function clientIp(req) {
  return String(req.ip || req.socket?.remoteAddress || '');
}

export function visitorHash(req) {
  const ip = clientIp(req);
  const ua = req.get('user-agent') || '';
  return crypto.createHmac('sha256', config.jwtSecret).update(`${ip}\n${ua}`).digest('hex');
}

export function requestDay(req) {
  if (process.env.NODE_ENV === 'test') {
    const header = req.get('x-test-day') || '';
    if (/^\d{4}-\d{2}-\d{2}$/.test(header)) return header;
  }
  return utcDay();
}
