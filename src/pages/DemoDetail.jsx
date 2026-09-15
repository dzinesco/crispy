import { Link, useParams } from 'react-router-dom';
import Seo from '../components/Seo.jsx';
import { useDemo } from '../lib/api.js';

export default function DemoDetail() {
  const { slug } = useParams();
  const { data, isLoading, error } = useDemo(slug);

  if (isLoading) {
    return <section className="mx-auto max-w-3xl px-4 py-24 text-center text-charcoal/60">Loading…</section>;
  }
  if (error || !data?.demo) {
    return (
      <section className="mx-auto max-w-3xl px-4 py-24 sm:px-6 lg:px-8">
        <h1 className="mb-4 text-3xl font-bold">Demo not found</h1>
        <Link to="/packages" className="text-gold hover:underline">← See packs</Link>
      </section>
    );
  }
  const demo = data.demo;
  return (
    <>
      <Seo title={`Demo · ${demo.title}`} description={demo.title} path={`/demos/${demo.slug}`} />
      <section className="border-b border-charcoal/10 bg-white py-10">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
          <Link to="/packages" className="mb-3 inline-block text-sm font-semibold text-charcoal/60 hover:text-gold">
            ← All packs
          </Link>
          <h1 className="text-3xl font-bold">{demo.title}</h1>
          <p className="mt-2 text-charcoal/60">A live preview of what comes with the kit.</p>
        </div>
      </section>
      <section className="bg-bone py-12">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
          <div
            className="overflow-hidden rounded-xl border border-charcoal/10 bg-white shadow-sm"
            dangerouslySetInnerHTML={{ __html: demo.html }}
          />
        </div>
      </section>
    </>
  );
}
