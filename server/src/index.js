import express from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import morgan from 'morgan';
import { config } from './config.js';
import './db.js';
import authRoutes from './routes/auth.js';
import postRoutes from './routes/posts.js';
import kitRoutes from './routes/kits.js';
import demoRoutes from './routes/demos.js';
import appRoutes from './routes/applications.js';
import stripeRoutes, { stripeWebhook } from './routes/stripe.js';

const app = express();

// Stripe webhook needs the raw body — mount before express.json().
app.post('/api/stripe/webhook', express.raw({ type: 'application/json' }), stripeWebhook);

app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());
app.use(morgan('tiny'));

app.use(
  cors({
    origin: (origin, cb) => {
      if (!origin) return cb(null, true); // curl / server-to-server
      if (config.corsOrigins.includes(origin)) return cb(null, true);
      return cb(new Error('cors_blocked'));
    },
    credentials: true,
  })
);

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, version: '1.0.0' });
});

app.use('/api', authRoutes);
app.use('/api', postRoutes);
app.use('/api', kitRoutes);
app.use('/api', demoRoutes);
app.use('/api', appRoutes);
app.use('/api', stripeRoutes);

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'internal_error', message: err.message });
});

app.listen(config.port, () => {
  console.log(`[crispy-api] listening on http://127.0.0.1:${config.port}`);
  if (!config.stripeSecret) {
    console.log('[crispy-api] stripe_not_configured — set STRIPE_SECRET_KEY to enable /api/stripe/checkout');
  }
});
