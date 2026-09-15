import { Link } from 'react-router-dom';
import Seo from '../components/Seo.jsx';
import { usePosts } from '../lib/api.js';

export default function Blog() {
  const { data, isLoading, error } = usePosts();
  const posts = data?.posts || [];

  return (
    <>
      <Seo title="Notes" description="Notes on shipping sites and productized work." />
      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
        <h1 className="text-4xl font-extrabold tracking-tightish sm:text-5xl">Notes</h1>
        <p className="mt-4 max-w-measure text-lg text-ink/65">
          Shipping sites, productized work, and the rest of the shop.
        </p>
        {isLoading && <p className="mt-10 text-ink/50">Loading…</p>}
        {error && <p className="mt-10 text-red-800">Couldn’t load notes.</p>}
        {!isLoading && posts.length === 0 && (
          <p className="mt-12 max-w-measure text-ink/60">Nothing published yet. Check back.</p>
        )}
        <div className="mt-12 divide-y divide-ink/10 border-y border-ink/10">
          {posts.map((p) => (
            <Link key={p.slug} to={`/blog/${p.slug}`} className="block py-6 hover:text-brass">
              <h2 className="text-2xl font-semibold tracking-tightish">{p.title}</h2>
              {p.excerpt && <p className="mt-2 text-[15px] text-ink/65">{p.excerpt}</p>}
              {p.published_at && (
                <p className="mt-2 text-sm text-ink/45">
                  {new Date(p.published_at).toLocaleDateString()}
                </p>
              )}
            </Link>
          ))}
        </div>
      </section>
    </>
  );
}
