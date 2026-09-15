import { Router } from 'express';
import Stripe from 'stripe';
import db from '../db.js';
import { config } from '../config.js';

const router = Router();

function getStripe() {
  if (!config.stripeSecret) return null;
  return new Stripe(config.stripeSecret, { apiVersion: '2024-09-30.acacia' });
}

router.post('/checkout', async (req, res) => {
  const { kit_slug } = req.body || {};
  if (!kit_slug) return res.status(400).json({ error: 'kit_slug_required' });

  const stripe = getStripe();
  if (!stripe) {
    return res.status(503).json({ error: 'stripe_not_configured' });
  }

  const kit = db.prepare("SELECT * FROM kits WHERE slug = ? AND status = 'published'").get(kit_slug);
  if (!kit) return res.status(404).json({ error: 'kit_not_found' });

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: kit.stripe_price_id
        ? [{ price: kit.stripe_price_id, quantity: 1 }]
        : [{
            price_data: {
              currency: 'usd',
              product_data: { name: kit.title, description: kit.tagline || undefined },
              unit_amount: kit.price_cents,
            },
            quantity: 1,
          }],
      success_url: `${config.siteUrl.replace(/\/$/, '')}/kits/${kit.slug}?purchase=success`,
      cancel_url: `${config.siteUrl.replace(/\/$/, '')}/kits/${kit.slug}?purchase=cancelled`,
    });

    db.prepare(
      `INSERT INTO orders (stripe_session, kit_slug, amount_cents, status) VALUES (?, ?, ?, 'pending')`
    ).run(session.id, kit.slug, kit.price_cents);

    res.json({ url: session.url });
  } catch (e) {
    console.error('stripe checkout error', e);
    res.status(500).json({ error: 'stripe_error', message: e.message });
  }
});

// Webhook — Stripe sends raw body. Caller must mount this BEFORE express.json()
// for the /stripe/webhook route. Done in index.js.
export async function stripeWebhook(req, res) {
  const stripe = getStripe();
  if (!stripe || !config.stripeWebhookSecret) {
    return res.status(503).json({ error: 'stripe_not_configured' });
  }
  const sig = req.headers['stripe-signature'];
  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, config.stripeWebhookSecret);
  } catch (e) {
    return res.status(400).json({ error: 'invalid_signature', message: e.message });
  }
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    db.prepare(
      `UPDATE orders SET status = 'paid', customer_email = ?, updated_at = datetime('now')
       WHERE stripe_session = ?`
    ).run(session.customer_details?.email || null, session.id);
  } else if (event.type === 'checkout.session.expired') {
    db.prepare(`UPDATE orders SET status = 'failed' WHERE stripe_session = ?`).run(event.data.object.id);
  }
  res.json({ received: true });
}

export default router;
