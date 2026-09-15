import { Link, useParams } from 'react-router-dom';
import { marked } from 'marked';
import Seo from '../components/Seo.jsx';
import { usePost } from '../lib/api.js';

export default function BlogPost() {
  const { slug } = useParams();
  const { data: post, isLoading, error } = usePost(slug);

  if (isLoading) {
    return (
      <section className="mx-auto max-w-3xl px-4 py-24 text-center text-charcoal/60 sm:px-6 lg:px-8">
        Loading…
      </section>
    );
  }
  if (error || !post?.post) {
    return (
      <section className="mx-auto max-w-3xl px-4 py-24 sm:px-6 lg:px-8">
        <h1 className="mb-4 text-3xl font-bold">Post not found</h1>
        <Link to="/blog" className="text-gold hover:underline">← Back to blog</Link>
      </section>
    );
  }

  const html = marked.parse(post.post.body_md || '');
  return (
    <>
      <Seo title={post.post.title} description={post.post.excerpt} path={`/blog/${post.post.slug}`} />
      <article className="mx-auto max-w-3xl px-4 py-20 sm:px-6 lg:px-8">
        <Link to="/blog" className="mb-6 inline-block text-sm font-semibold text-charcoal/60 hover:text-gold">
          ← Back to blog
        </Link>
        <h1 className="mb-4 text-4xl font-extrabold tracking-tight sm:text-5xl">{post.post.title}</h1>
        {post.post.published_at && (
          <p className="mb-10 font-mono text-xs uppercase tracking-wider text-charcoal/50">
            {new Date(post.post.published_at).toLocaleDateString()}
          </p>
        )}
        {post.post.excerpt && (
          <p className="mb-8 text-xl text-charcoal/70">{post.post.excerpt}</p>
        )}
        <div
          className="prose prose-charcoal max-w-none text-charcoal/85"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      </article>
    </>
  );
}
