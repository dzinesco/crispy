import { Link, useParams } from 'react-router-dom';
import { useState } from 'react';
import Seo from '../components/Seo.jsx';
import { useKit, useStripeCheckout } from '../lib/api.js';

export default function KitDetail() {
  const { slug } = useParams();
  const { data, isLoading, error } = useKit(slug);
  const checkout = useStripeCheckout();
  const [errMsg, setErrMsg] = useState(null);

  if (isLoading) {
    return <section className="mx-auto max-w-3xl px-4 py-24 text-center text-charcoal/60">Loading…</section>;
  }
  if (error || !data?.kit) {
    return (
      <section className="mx-auto max-w-3xl px-4 py-24 sm:px-6 lg:px-8">
        <h1 className="mb-4 text-3xl font-bold">Kit not found</h1>
        <Link to="/packages" className="text-gold hover:underline">← See packs</Link>
      </section>
    );
  }
  const kit = data.kit;
  const features = (() => {
    try { return JSON.parse(kit.features_json || '[]'); } catch { return []; }
  })();

  async function onBuy() {
    setErrMsg(null);
    try {
      const res = await checkout.mutateAsync(kit.slug);
      if (res?.url) window.location.href = res.url;
    } catch (e) {
      setErrMsg(e.detail?.error || e.message);
    }
  }

  return (
    <>
      <Seo title={kit.title} description={kit.tagline} path={`/kits/${kit.slug}`} />
      <section className="mx-auto max-w-4xl px-4 py-20 sm:px-6 lg:px-8">
        <Link to="/packages" className="mb-6 inline-block text-sm font-semibold text-charcoal/60 hover:text-gold">
          ← All packs
        </Link>
        <p className="mb-2 font-mono text-xs uppercase tracking-wider text-charcoal/50">Kit</p>
        <h1 className="mb-2 text-4xl font-extrabold tracking-tight sm:text-5xl">{kit.title}</h1>
        <p className="mb-8 text-xl text-charcoal/70">{kit.tagline}</p>
        <p className="mb-8 font-mono text-4xl font-bold text-gold">${(kit.price_cents / 100).toFixed(0)}</p>
        {kit.description_md && (
          <div className="prose prose-charcoal mb-10 max-w-none text-charcoal/85" dangerouslySetInnerHTML={{ __html: kit.description_md }} />
        )}
        {features.length > 0 && (
          <ul className="mb-10 space-y-2">
            {features.map((f) => (
              <li key={f} className="flex items-start gap-2">
                <span className="mt-1 inline-block h-2 w-2 rounded-full bg-gold" />
                <span>{f}</span>
              </li>
            ))}
          </ul>
        )}
        {kit.demo_slug && (
          <p className="mb-6">
            <Link to={`/demos/${kit.demo_slug}`} className="font-semibold text-gold hover:underline">
              See a live demo →
            </Link>
          </p>
        )}
        <div className="card flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-charcoal/70">Stripe checkout. No sales call required.</p>
          <button onClick={onBuy} disabled={checkout.isPending} className="btn-accent w-full sm:w-auto">
            {checkout.isPending ? 'Redirecting…' : `Buy ${kit.title}`}
          </button>
        </div>
        {errMsg && <p className="mt-4 text-sm text-red-600">{errMsg}</p>}
      </section>
    </>
  );
}
