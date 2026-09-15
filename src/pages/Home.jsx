import { Link } from 'react-router-dom';
import Seo from '../components/Seo.jsx';
import { useKits, usePosts } from '../lib/api.js';

const steps = [
  { t: 'You send a brief', d: 'Form, not a call. Facts, not a deck.' },
  { t: 'We say yes or no', d: 'If it fits, you get a price and a date. If not, silence.' },
  { t: 'You pay a deposit', d: 'That locks the week. Still no meetings.' },
  { t: 'We ship', d: 'Working site, on the date we named.' },
];

export default function Home() {
  const { data: kitsData } = useKits();
  const { data: postsData } = usePosts();
  const kits = kitsData?.kits || [];
  const posts = postsData?.posts || [];
  const featured = kits.find((k) => k.slug === 'farm-stand') || kits[0];

  return (
    <>
      <Seo
        title="Ship sites without the agency theater"
        description="Productized site kits you can buy today — plus selective custom builds when the brief is sharp."
      />

      <section className="border-b border-ink/10 bg-ink text-cream">
        <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-28">
          <p className="mb-6 text-sm text-brass">Anti-agency · site kits · {new Date().getFullYear()}</p>
          <h1 className="max-w-[14ch] text-[2.75rem] font-extrabold leading-[0.95] tracking-tightish sm:text-6xl lg:text-7xl">
            Ship the site. Skip the agency theater.
          </h1>
          <p className="mt-7 max-w-measure text-lg leading-7 text-cream/70 sm:text-xl">
            Buy a kit and go live today. Or pitch a custom build if the problem is bigger than a template.
          </p>
          <div className="mt-10 flex flex-col gap-3 sm:flex-row">
            {featured ? (
              <Link to={`/kits/${featured.slug}`} className="btn-accent">
                Buy {featured.title} — ${(featured.price_cents / 100).toFixed(0)}
              </Link>
            ) : (
              <Link to="/packages" className="btn-accent">See starter packs</Link>
            )}
            <Link to="/apply" className="btn-ghost border-cream/25 text-cream hover:border-cream hover:bg-cream hover:text-ink">
              Pitch a build
            </Link>
          </div>
        </div>
      </section>

      <section className="border-b border-ink/10 py-16 sm:py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="mb-10 flex items-baseline justify-between gap-4">
            <h2 className="text-3xl font-bold tracking-tightish sm:text-4xl">On the counter</h2>
            <Link to="/packages" className="text-[15px] text-ink/60 hover:text-ink">All packs</Link>
          </div>
          {kits.length === 0 ? (
            <div className="divide-y divide-ink/10 border-y border-ink/10">
              {[
                { name: 'Billy Basic', price: '$1,200', note: 'One page. You exist online today.' },
                { name: 'Grumpy Grazer', price: '$3,800', note: '5–7 pages, a blog, basic SEO.' },
                { name: 'Alpha Horn', price: 'From $8,500', note: 'Custom. Auth, payments, the works.' },
              ].map((row) => (
                <Link key={row.name} to="/packages" className="flex items-baseline justify-between gap-6 py-5 hover:text-brass">
                  <div>
                    <p className="text-xl font-semibold tracking-tightish">{row.name}</p>
                    <p className="mt-1 text-[15px] text-ink/60">{row.note}</p>
                  </div>
                  <p className="shrink-0 text-lg text-brass">{row.price}</p>
                </Link>
              ))}
            </div>
          ) : (
            <div className="divide-y divide-ink/10 border-y border-ink/10">
              {kits.slice(0, 4).map((kit) => (
                <Link
                  key={kit.slug}
                  to={`/kits/${kit.slug}`}
                  className="flex items-baseline justify-between gap-6 py-5 hover:text-brass"
                >
                  <div>
                    <p className="text-xl font-semibold tracking-tightish">{kit.title}</p>
                    {kit.tagline && <p className="mt-1 text-[15px] text-ink/60">{kit.tagline}</p>}
                  </div>
                  <p className="shrink-0 text-lg text-brass">${(kit.price_cents / 100).toFixed(0)}</p>
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="border-b border-ink/10 bg-cream py-16 sm:py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <h2 className="mb-10 text-3xl font-bold tracking-tightish sm:text-4xl">How a custom job runs</h2>
          <ol className="grid gap-0 sm:grid-cols-2 lg:grid-cols-4">
            {steps.map((s, i) => (
              <li key={s.t} className="border-t border-ink/10 py-6 sm:border-l sm:border-t-0 sm:px-6 first:sm:border-l-0 first:sm:pl-0">
                <p className="mb-3 text-sm text-brass">{String(i + 1).padStart(2, '0')}</p>
                <h3 className="text-xl font-semibold tracking-tightish">{s.t}</h3>
                <p className="mt-2 text-[15px] leading-6 text-ink/65">{s.d}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {posts.length > 0 && (
        <section className="border-b border-ink/10 py-16 sm:py-20">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <div className="mb-10 flex items-baseline justify-between">
              <h2 className="text-3xl font-bold tracking-tightish sm:text-4xl">Notes</h2>
              <Link to="/blog" className="text-[15px] text-ink/60 hover:text-ink">All notes</Link>
            </div>
            <div className="divide-y divide-ink/10 border-y border-ink/10">
              {posts.slice(0, 4).map((p) => (
                <Link key={p.slug} to={`/blog/${p.slug}`} className="block py-5 hover:text-brass">
                  <h3 className="text-xl font-semibold tracking-tightish">{p.title}</h3>
                  {p.excerpt && <p className="mt-1 text-[15px] text-ink/60">{p.excerpt}</p>}
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      <section className="py-16 sm:py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <h2 className="max-w-[16ch] text-3xl font-bold tracking-tightish sm:text-4xl">Ready when you are.</h2>
          <p className="mt-4 max-w-measure text-lg text-ink/65">
            Grab a pack, or send a brief. We don’t do kickoff workshops.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link to="/packages" className="btn-primary">See starter packs</Link>
            <Link to="/apply" className="btn-accent">Pitch a build</Link>
          </div>
        </div>
      </section>
    </>
  );
}
