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
    return <section className="mx-auto max-w-6xl px-4 py-24 text-ink/50 sm:px-6">Loading…</section>;
  }
  if (error || !data?.kit) {
    return (
      <section className="mx-auto max-w-6xl px-4 py-24 sm:px-6">
        <h1 className="text-3xl font-bold tracking-tightish">Kit not found</h1>
        <Link to="/packages" className="mt-4 inline-block text-brass hover:text-ink">See packs</Link>
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
      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
        <Link to="/packages" className="text-sm text-ink/50 hover:text-ink">All packs</Link>
        <h1 className="mt-6 text-4xl font-extrabold tracking-tightish sm:text-5xl">{kit.title}</h1>
        {kit.tagline && <p className="mt-3 max-w-measure text-xl text-ink/65">{kit.tagline}</p>}
        <p className="mt-8 text-4xl text-brass">${(kit.price_cents / 100).toFixed(0)}</p>
        {kit.description_md && (
          <div className="prose-cg mt-10" dangerouslySetInnerHTML={{ __html: kit.description_md }} />
        )}
        {features.length > 0 && (
          <ul className="mt-10 max-w-measure space-y-2 text-[15px]">
            {features.map((f) => (
              <li key={f} className="flex gap-3">
                <span className="mt-2 h-1.5 w-1.5 shrink-0 bg-brass" />
                <span>{f}</span>
              </li>
            ))}
          </ul>
        )}
        {kit.demo_slug && (
          <p className="mt-8">
            <Link to={`/demos/${kit.demo_slug}`} className="text-brass hover:text-ink">
              See a live demo
            </Link>
          </p>
        )}
        <div className="mt-12 flex flex-col items-start gap-4 border-t border-ink/10 pt-8 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[15px] text-ink/65">Stripe checkout. No sales call.</p>
          <button onClick={onBuy} disabled={checkout.isPending} className="btn-accent">
            {checkout.isPending ? 'Redirecting…' : `Buy ${kit.title}`}
          </button>
        </div>
        {errMsg && (
          <p className="mt-4 text-sm text-red-800">
            {errMsg === 'stripe_not_configured'
              ? 'Checkout isn’t live yet. Email tm@crispygoat.com to buy this kit.'
              : errMsg}
          </p>
        )}
      </section>
    </>
  );
}
