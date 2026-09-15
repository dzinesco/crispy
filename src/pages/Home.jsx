import { Link } from 'react-router-dom';
import Seo from '../components/Seo.jsx';
import { useKits, usePosts } from '../lib/api.js';

export default function Home() {
  const { data: kitsData } = useKits();
  const { data: postsData } = usePosts();
  const kits = kitsData?.kits || [];
  const posts = postsData?.posts || [];

  return (
    <>
      <Seo
        title="Ship sites without the agency theater"
        description="Productized site kits you can buy today — plus selective custom builds when the brief is sharp."
      />

      {/* Hero */}
      <section className="relative isolate overflow-hidden bg-charcoal text-bone">
        <div className="absolute inset-0 bg-gradient-to-br from-charcoal via-charcoal/95 to-charcoal/80" />
        <div className="absolute -right-32 top-1/2 h-96 w-96 -translate-y-1/2 rounded-full bg-gold/20 blur-3xl" />
        <div className="relative mx-auto max-w-7xl px-4 py-24 sm:px-6 sm:py-32 lg:px-8">
          <p className="mb-4 font-mono text-xs uppercase tracking-[0.22em] text-gold">Crispy Goat · {new Date().getFullYear()}</p>
          <h1 className="max-w-4xl text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-5xl md:text-6xl lg:text-7xl">
            Ship the site.<br />Skip the agency theater.
          </h1>
          <p className="mt-6 max-w-2xl text-lg text-bone/80 sm:text-xl">
            Productized kits you can buy today — plus selective custom builds when the brief is sharp.
          </p>
          <div className="mt-10 flex flex-col gap-3 sm:flex-row">
            <Link to="/kits/farm-stand" className="btn-accent">Buy Farm Stand Kit — $49</Link>
            <Link to="/packages" className="btn-ghost border-bone/30 bg-transparent text-bone hover:border-gold hover:text-gold">
              See starter packs
            </Link>
          </div>
        </div>
      </section>

      {/* Featured kits */}
      <section className="bg-bone py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mb-10 flex items-end justify-between">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">Kits ready to ship</h2>
            <Link to="/packages" className="text-sm font-semibold text-charcoal hover:text-gold">All packs →</Link>
          </div>
          {kits.length === 0 ? (
            <div className="card text-center text-charcoal/60">
              No kits yet — post one via <code className="rounded bg-charcoal/5 px-1 py-0.5 font-mono text-xs">POST /api/kits</code>.
            </div>
          ) : (
            <div className="grid gap-6 md:grid-cols-3">
              {kits.slice(0, 3).map((kit) => (
                <Link key={kit.slug} to={`/kits/${kit.slug}`} className="card transition-shadow hover:shadow-md">
                  <p className="mb-1 font-mono text-xs uppercase tracking-wider text-charcoal/50">Kit</p>
                  <h3 className="mb-2 text-xl font-bold">{kit.title}</h3>
                  <p className="mb-4 text-sm text-charcoal/70">{kit.tagline}</p>
                  <p className="font-mono text-2xl font-bold text-gold">${(kit.price_cents / 100).toFixed(0)}</p>
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* How it works */}
      <section className="bg-charcoal py-20 text-bone">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <h2 className="mb-12 text-center text-3xl font-bold sm:text-4xl">How it works</h2>
          <div className="grid gap-6 sm:grid-cols-2 md:grid-cols-4">
            {[
              { n: '1', t: 'Submit', d: 'Fill out the pitch form. Be clear, be concise, be compelling.' },
              { n: '2', t: 'We Review', d: 'If it sparks interest, we’ll send a proposal with pricing and scope.' },
              { n: '3', t: 'You Approve', d: 'Like the plan? Pay the deposit. We lock the timeline and move.' },
              { n: '4', t: 'We Ship', d: 'You get working code, design, or whatever else you paid for.' },
            ].map((s) => (
              <div key={s.n} className="rounded-lg border border-bone/10 bg-charcoal/80 p-6">
                <h3 className="mb-2 text-xl font-semibold">{s.n}. {s.t}</h3>
                <p className="text-sm text-bone/80">{s.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Recent posts */}
      {posts.length > 0 && (
        <section className="bg-white py-20">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="mb-10 flex items-end justify-between">
              <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">From the blog</h2>
              <Link to="/blog" className="text-sm font-semibold text-charcoal hover:text-gold">All posts →</Link>
            </div>
            <div className="grid gap-6 md:grid-cols-3">
              {posts.slice(0, 3).map((p) => (
                <Link key={p.slug} to={`/blog/${p.slug}`} className="card transition-shadow hover:shadow-md">
                  <h3 className="mb-2 text-lg font-bold leading-snug">{p.title}</h3>
                  <p className="text-sm text-charcoal/70">{p.excerpt}</p>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      <section className="bg-bone py-20 text-center">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          <h2 className="mb-4 text-3xl font-bold sm:text-4xl">Ready when you are.</h2>
          <p className="mb-8 text-lg text-charcoal/70">
            Grab a kit and ship today — or pitch a custom build if your problem is bigger than a template.
          </p>
          <div className="flex flex-col justify-center gap-3 sm:flex-row">
            <Link to="/kits/farm-stand" className="btn-primary">Buy Farm Stand Kit — $49</Link>
            <Link to="/apply" className="btn-accent">Pitch Your Project</Link>
          </div>
        </div>
      </section>
    </>
  );
}
