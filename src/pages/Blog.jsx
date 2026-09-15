import { Link } from 'react-router-dom';
import Seo from '../components/Seo.jsx';
import { usePosts } from '../lib/api.js';

export default function Blog() {
  const { data, isLoading, error } = usePosts();
  const posts = data?.posts || [];

  return (
    <>
      <Seo title="Blog" description="Notes on shipping sites, billing pipelines, and productized work." />
      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
        <h1 className="text-4xl font-semibold tracking-[-0.03em] sm:text-5xl">Blog</h1>
        <p className="mt-4 max-w-measure text-lg text-ink/65">
          Colorado Medicaid billing, home-care ops, and how we ship work.
        </p>
        {isLoading && <p className="mt-10 text-ink/50">Loading…</p>}
        {error && <p className="mt-10 text-red-800">Couldn’t load posts.</p>}
        {!isLoading && posts.length === 0 && (
          <p className="mt-12 max-w-measure text-ink/60">Nothing published yet.</p>
        )}
        <div className="mt-14 divide-y divide-ink/10 border-y border-ink/10">
          {posts.map((p) => (
            <Link key={p.slug} to={`/blog/${p.slug}`} className="block py-8 hover:text-brass">
              {p.published_at && (
                <p className="text-[13px] text-ink/45">
                  {new Date(p.published_at).toLocaleDateString(undefined, {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                  })}
                </p>
              )}
              <h2 className="mt-2 max-w-[28ch] text-2xl font-semibold tracking-[-0.025em] sm:text-3xl">
                {p.title}
              </h2>
              {p.excerpt && <p className="mt-3 max-w-measure text-[17px] leading-7 text-ink/65">{p.excerpt}</p>}
            </Link>
          ))}
        </div>
      </section>
    </>
  );
}
