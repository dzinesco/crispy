import 'dotenv/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const required = (name, fallback) => {
  const v = process.env[name];
  if (v && v.trim()) return v.trim();
  if (fallback !== undefined) return fallback;
  throw new Error(`Missing required env var: ${name}`);
};

export const config = {
  port: parseInt(process.env.PORT || '3102', 10),
  databaseFile: path.resolve(__dirname, '..', process.env.DATABASE_FILE || './data/crispy.db'),
  corsOrigins: (process.env.CORS_ORIGIN || 'http://localhost:5173')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
  siteUrl: required('SITE_URL', 'https://crispygoat.com'),
  jwtSecret: required('JWT_SECRET', 'dev-only-jwt-secret-please-change-in-production'),
  adminEmail: required('ADMIN_EMAIL', 'admin@crispygoat.com'),
  adminPassword: required('ADMIN_PASSWORD', 'changeme'),
  stripeSecret: process.env.STRIPE_SECRET_KEY || '',
  stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET || '',
  isProd: process.env.NODE_ENV === 'production',
};
