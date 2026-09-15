import { Link, useParams } from 'react-router-dom';
import { marked } from 'marked';
import Seo from '../components/Seo.jsx';
import { usePost } from '../lib/api.js';

export default function BlogPost() {
  const { slug } = useParams();
  const { data: post, isLoading, error } = usePost(slug);

  if (isLoading) {
    return <section className="mx-auto max-w-6xl px-4 py-24 text-ink/50 sm:px-6">Loading…</section>;
  }
  if (error || !post?.post) {
    return (
      <section className="mx-auto max-w-6xl px-4 py-24 sm:px-6">
        <h1 className="text-3xl font-bold tracking-tightish">Note not found</h1>
        <Link to="/blog" className="mt-4 inline-block text-brass hover:text-ink">All notes</Link>
      </section>
    );
  }

  const html = marked.parse(post.post.body_md || '');
  return (
    <>
      <Seo title={post.post.title} description={post.post.excerpt} path={`/blog/${post.post.slug}`} />
      <article className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
        <Link to="/blog" className="text-sm text-ink/50 hover:text-ink">All notes</Link>
        <h1 className="mt-6 max-w-[20ch] text-4xl font-extrabold tracking-tightish sm:text-5xl">
          {post.post.title}
        </h1>
        {post.post.published_at && (
          <p className="mt-3 text-sm text-ink/45">
            {new Date(post.post.published_at).toLocaleDateString()}
          </p>
        )}
        {post.post.excerpt && (
          <p className="mt-8 max-w-measure text-xl leading-8 text-ink/70">{post.post.excerpt}</p>
        )}
        <div
          className="prose-cg mt-10"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      </article>
    </>
  );
}
