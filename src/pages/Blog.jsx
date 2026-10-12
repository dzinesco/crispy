import { Link } from 'react-router-dom';
import Seo from '../components/Seo.jsx';
import { usePosts } from '../lib/api.js';

export default function Blog() {
  const { data, isLoading, error } = usePosts();
  const posts = data?.posts || [];

  return (
    <div className="pw blog-read">
      <Seo title="Blog" description="Notes from Crispy Goat." path="/blog" />
      <header className="pw-hero">
        <p className="pixel">Notes</p>
        <h1>Blog</h1>
        <p className="pw-lead">What got shipped, and the work around it.</p>
      </header>
      {isLoading && <p className="gb-empty">Loading notes…</p>}
      {error && <p className="gb-empty">Couldn’t load posts.</p>}
      {!isLoading && posts.length === 0 && <p className="gb-empty">Nothing published yet.</p>}
      <ul className="pw-post-list">
        {posts.map((p) => (
          <li key={p.slug}>
            <Link to={`/blog/${p.slug}`}>
              {p.cover_image && (
                <img className="blog-card-cover" src={p.cover_image} alt={`Screenshot: ${p.title}`} width="1280" height="800" loading="lazy" decoding="async" />
              )}
              {p.published_at && (
                <time className="pixel" dateTime={p.published_at}>
                  {new Date(p.published_at).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                  })}
                </time>
              )}
              <span>{p.title}</span>
              {p.excerpt && <small>{p.excerpt}</small>}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
