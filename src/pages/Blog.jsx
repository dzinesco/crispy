import { Link } from 'react-router-dom';
import Seo from '../components/Seo.jsx';
import { usePosts } from '../lib/api.js';

export default function Blog() {
  const { data, isLoading, error } = usePosts();
  const posts = data?.posts || [];

  return (
    <>
      <Seo title="Blog" description="Notes on shipping sites, anti-agency ops, and productized work." />
      <section className="mx-auto max-w-4xl px-4 py-20 sm:px-6 lg:px-8">
        <h1 className="mb-4 text-4xl font-extrabold tracking-tight sm:text-5xl">Blog</h1>
        <p className="mb-12 text-lg text-charcoal/70">
          Notes on shipping sites, anti-agency ops, and productized work.
        </p>
        {isLoading && <p className="text-charcoal/60">Loading…</p>}
        {error && <p className="text-red-600">Failed to load posts.</p>}
        {!isLoading && posts.length === 0 && (
          <div className="card">
            <p className="mb-2 text-charcoal/70">No posts yet.</p>
            <p className="text-sm text-charcoal/50">
              Post one via{' '}
              <code className="rounded bg-charcoal/5 px-1 py-0.5 font-mono text-xs">POST /api/posts</code>.
            </p>
          </div>
        )}
        <div className="space-y-6">
          {posts.map((p) => (
            <Link key={p.slug} to={`/blog/${p.slug}`} className="card block transition-shadow hover:shadow-md">
              <h2 className="mb-2 text-2xl font-bold leading-tight hover:text-gold">{p.title}</h2>
              <p className="text-charcoal/70">{p.excerpt}</p>
              {p.published_at && (
                <p className="mt-3 font-mono text-xs uppercase tracking-wider text-charcoal/50">
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
