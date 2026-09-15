import { Link } from 'react-router-dom';
import Seo from '../components/Seo.jsx';

const tiers = [
  { name: 'Billy Basic', price: '$1,200', desc: 'A clean, single-page site. For when you need to exist online, today.' },
  { name: 'Grumpy Grazer', price: '$3,800', desc: 'A 5–7 page site with a CMS, blog, and basic SEO. The starter pack most folks want.' },
  { name: 'Alpha Horn', price: 'From $8,500', desc: 'A custom build with integrations, auth, and the works. When a kit won\'t cut it.' },
];

export default function Packages() {
  return (
    <>
      <Seo title="Starter Packs" description="Three packs, one anti-agency. Pick your size." />
      <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6 lg:px-8">
        <h1 className="mb-4 text-4xl font-extrabold tracking-tight sm:text-5xl">Starter Packs</h1>
        <p className="mb-12 max-w-2xl text-lg text-charcoal/70">
          Three tiers, scoped tight. Pay the deposit, get the work — no kickoff workshops, no surprises.
        </p>
        <div className="grid gap-6 md:grid-cols-3">
          {tiers.map((t) => (
            <div key={t.name} className="card">
              <h2 className="mb-2 text-2xl font-bold">{t.name}</h2>
              <p className="mb-4 font-mono text-3xl font-bold text-gold">{t.price}</p>
              <p className="mb-6 text-sm text-charcoal/70">{t.desc}</p>
              <Link to="/apply" className="btn-ghost w-full">Pitch for this</Link>
            </div>
          ))}
        </div>
        <div className="mt-12 card text-center">
          <p className="mb-4 text-charcoal/70">
            Want to ship a $49 template today instead?
          </p>
          <Link to="/kits/farm-stand" className="btn-accent">Buy Farm Stand Kit</Link>
        </div>
      </section>
    </>
  );
}
