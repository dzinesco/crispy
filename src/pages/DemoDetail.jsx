import { Link, useParams } from 'react-router-dom';
import Seo from '../components/Seo.jsx';
import { useDemo } from '../lib/api.js';

export default function DemoDetail() {
  const { slug } = useParams();
  const { data, isLoading, error } = useDemo(slug);

  if (isLoading) {
    return <section className="mx-auto max-w-6xl px-4 py-24 text-ink/50 sm:px-6">Loading…</section>;
  }
  if (error || !data?.demo) {
    return (
      <section className="mx-auto max-w-6xl px-4 py-24 sm:px-6">
        <h1 className="text-3xl font-bold tracking-tightish">Demo not found</h1>
        <Link to="/packages" className="mt-4 inline-block text-brass hover:text-ink">See packs</Link>
      </section>
    );
  }
  const demo = data.demo;
  return (
    <>
      <Seo title={`Demo · ${demo.title}`} description={demo.title} path={`/demos/${demo.slug}`} />
      <section className="border-b border-ink/10 py-10">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <Link to="/packages" className="text-sm text-ink/50 hover:text-ink">All packs</Link>
          <h1 className="mt-3 text-3xl font-bold tracking-tightish">{demo.title}</h1>
          <p className="mt-2 text-ink/60">A preview of what comes with the kit.</p>
        </div>
      </section>
      <section className="py-12">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div
            className="overflow-hidden border border-ink/10 bg-cream"
            dangerouslySetInnerHTML={{ __html: demo.html }}
          />
        </div>
      </section>
    </>
  );
}
