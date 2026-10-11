import { Link, useParams } from 'react-router-dom';
import { marked } from 'marked';
import Seo from '../components/Seo.jsx';
import { usePost } from '../lib/api.js';

export default function BlogPost() {
  const { slug } = useParams();
  const { data: post, isLoading, error } = usePost(slug);

  if (isLoading) {
    return <div className="pw"><p className="gb-empty">Loading…</p></div>;
  }
  if (error || !post?.post) {
    return (
      <div className="pw">
        <h1>Post not found</h1>
        <p className="pw-more"><Link to="/blog">All posts</Link></p>
      </div>
    );
  }

  const html = marked.parse(post.post.body_md || '');
  return (
    <article className="pw">
      <Seo title={post.post.title} description={post.post.excerpt} path={`/blog/${post.post.slug}`} />
      <p className="pixel"><Link to="/blog">Blog</Link></p>
      <h1 className="pw-post-title">{post.post.title}</h1>
      {post.post.published_at && (
        <p className="pixel">
          <time dateTime={post.post.published_at}>
            {new Date(post.post.published_at).toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}
          </time>
        </p>
      )}
      {post.post.excerpt && <p className="pw-lead">{post.post.excerpt}</p>}
      <div className="prose-cg" dangerouslySetInnerHTML={{ __html: html }} />
    </article>
  );
}
