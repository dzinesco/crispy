import { Link } from 'react-router-dom';
import Seo from '../components/Seo.jsx';
import WorkHero from '../components/WorkHero.jsx';
import LatestStrip from '../components/LatestStrip.jsx';
import { projects } from '../data/portfolio.js';
import { leadProject } from '../lib/latest.js';
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
  const featured = kits.find((kit) => kit.slug === 'farm-stand') || kits[0];
  const lead = leadProject(projects);

  return (
    <>
      <Seo
        title="Ship sites without the agency theater"
        description="Productized site kits you can buy today — plus selective custom builds when the brief is sharp."
      />

      <WorkHero project={lead} featured={featured} />
      <LatestStrip posts={posts} projects={projects} />

      <section className="border-b border-ink/10 py-16 sm:py-24">
        <div className="mx-auto grid max-w-6xl items-start gap-12 px-4 sm:px-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          <div>
            <p className="text-[13px] font-medium text-brass">The kit</p>
            <h2 className="mt-3 max-w-[12ch] text-4xl font-semibold tracking-[-0.03em] sm:text-5xl">
              Packed. Priced. Ready to open.
            </h2>
            <p className="mt-5 max-w-measure text-[17px] leading-7 text-ink/70">
              A site kit is a finished starting point: structure, type, checkout if you need it. You buy it, you ship it. Custom work is a separate conversation.
            </p>
            <Link to="/packages" className="btn-primary mt-8">See starter packs</Link>
            <div className="product-tilt mt-10 hidden max-w-sm lg:block">
              <img
                src="/images/kit-box.jpg"
                alt="Kraft kit box with a small metal mark"
                className="w-full"
                decoding="async"
              />
            </div>
          </div>

          {kits.length === 0 ? (
            <div className="divide-y divide-ink/10 border border-ink/10 bg-cream">
              {[
                { name: 'Billy Basic', price: '$1,200', note: 'One page. You exist online today.' },
                { name: 'Grumpy Grazer', price: '$3,800', note: '5–7 pages, a blog, basic SEO.' },
                { name: 'Alpha Horn', price: 'From $8,500', note: 'Custom. Auth, payments, the works.' },
              ].map((row) => (
                <Link key={row.name} to="/packages" className="flex min-h-[72px] flex-col justify-center gap-1 px-5 py-5 hover:text-brass sm:flex-row sm:items-baseline sm:justify-between sm:gap-6">
                  <div>
                    <p className="text-xl font-semibold tracking-[-0.02em]">{row.name}</p>
                    <p className="mt-1 text-[15px] text-ink/60">{row.note}</p>
                  </div>
                  <p className="shrink-0 text-lg text-brass">{row.price}</p>
                </Link>
              ))}
            </div>
          ) : (
            <div className="divide-y divide-ink/10 border border-ink/10 bg-cream">
              {kits.slice(0, 4).map((kit) => (
                <Link
                  key={kit.slug}
                  to={`/kits/${kit.slug}`}
                  className="flex min-h-[72px] flex-col justify-center gap-1 px-5 py-5 hover:text-brass sm:flex-row sm:items-baseline sm:justify-between sm:gap-6"
                >
                  <div>
                    <p className="text-xl font-semibold tracking-[-0.02em]">{kit.title}</p>
                    {kit.tagline && <p className="mt-1 text-[15px] text-ink/60">{kit.tagline}</p>}
                  </div>
                  <p className="shrink-0 text-lg text-brass">${(kit.price_cents / 100).toFixed(0)}</p>
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="overflow-hidden bg-ink py-16 text-cream sm:py-24">
        <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 sm:px-6 lg:grid-cols-2">
          <div className="order-2 lg:order-1">
            <img
              src="/images/laptop.jpg"
              alt="A finished site on a laptop"
              className="w-full border border-white/10"
              decoding="async"
            />
          </div>
          <div className="order-1 lg:order-2">
            <p className="text-[13px] font-medium text-cream">How a custom job runs</p>
            <h2 className="mt-3 text-4xl font-semibold tracking-[-0.03em] sm:text-5xl">Four steps. No kickoff.</h2>
            <ol className="mt-10 space-y-6">
              {steps.map((step, index) => (
                <li key={step.t} className="flex gap-5">
                  <span className="w-8 shrink-0 pt-0.5 text-[13px] text-cream">{String(index + 1).padStart(2, '0')}</span>
                  <div>
                    <h3 className="text-xl font-semibold tracking-[-0.02em]">{step.t}</h3>
                    <p className="mt-1 text-[15px] leading-6 text-cream/75">{step.d}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      <section className="bg-cream py-16 sm:py-24">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <h2 className="max-w-[14ch] text-4xl font-semibold tracking-[-0.03em] sm:text-5xl">Ready when you are.</h2>
          <p className="mt-4 max-w-measure text-lg text-ink/70">
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
