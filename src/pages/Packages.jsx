import { Link } from 'react-router-dom';
import Seo from '../components/Seo.jsx';
import { useKits } from '../lib/api.js';

const tiers = [
  { name: 'Billy Basic', price: '$1,200', desc: 'A single page. For when you need to exist online, today.' },
  { name: 'Grumpy Grazer', price: '$3,800', desc: '5–7 pages, a blog, and basic SEO. The pack most people want.' },
  { name: 'Alpha Horn', price: 'From $8,500', desc: 'Custom build: auth, payments, integrations. When a kit won’t cover it.' },
];

export default function Packages() {
  const { data } = useKits();
  const kits = data?.kits || [];

  return (
    <>
      <Seo title="Starter packs" description="Three packs, scoped tight. Pay a deposit, get the work." />
      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
        <h1 className="text-4xl font-extrabold tracking-tightish sm:text-5xl">Starter packs</h1>
        <p className="mt-4 max-w-measure text-lg text-ink/65">
          Three sizes. Pay a deposit, get a date. No kickoff theater.
        </p>

        <div className="mt-12 divide-y divide-ink/10 border-y border-ink/10">
          {tiers.map((t) => (
            <div key={t.name} className="flex flex-col gap-4 py-8 sm:flex-row sm:items-baseline sm:justify-between">
              <div className="max-w-xl">
                <h2 className="text-2xl font-semibold tracking-tightish">{t.name}</h2>
                <p className="mt-2 text-[15px] leading-6 text-ink/65">{t.desc}</p>
              </div>
              <div className="flex shrink-0 items-center gap-6">
                <p className="text-xl text-brass">{t.price}</p>
                <Link to="/apply" className="btn-ghost">Pitch this</Link>
              </div>
            </div>
          ))}
        </div>

        {kits.length > 0 && (
          <div className="mt-16">
            <h2 className="mb-6 text-2xl font-semibold tracking-tightish">Kits you can buy today</h2>
            <div className="divide-y divide-ink/10 border-y border-ink/10">
              {kits.map((kit) => (
                <Link
                  key={kit.slug}
                  to={`/kits/${kit.slug}`}
                  className="flex items-baseline justify-between gap-6 py-5 hover:text-brass"
                >
                  <span className="text-lg font-semibold tracking-tightish">{kit.title}</span>
                  <span className="text-brass">${(kit.price_cents / 100).toFixed(0)}</span>
                </Link>
              ))}
            </div>
          </div>
        )}
      </section>
    </>
  );
}
