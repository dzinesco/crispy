import { Link } from 'react-router-dom';
import Seo from '../components/Seo.jsx';
import HitCounter from '../components/HitCounter.jsx';
import GuestbookForm from '../components/GuestbookForm.jsx';
import GuestbookList from '../components/GuestbookList.jsx';
import ButtonWall from '../components/ButtonWall.jsx';
import Webring from '../components/Webring.jsx';
import { usePosts } from '../lib/api.js';
import {
  projects,
  byNewest,
  featuredProject,
  soonProjects,
  shortName,
} from '../data/portfolio.js';

function when(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

export default function Home() {
  const { data, isLoading, error } = usePosts();
  const posts = (data?.posts || []).slice(0, 4);
  const featured = featuredProject(projects);
  const newest = byNewest(projects)[0];
  const apps = byNewest(projects).filter((project) => project.slug !== featured?.slug);
  const defrag = soonProjects(projects).find((project) => project.slug === 'defrag');

  return (
    <div className="pw">
      <Seo
        title="A personal homepage"
        description="Crispy Goat, est. 2024. Apps, a guestbook, and notes. A personal homepage, like the internet used to make."
        path="/"
      />

      <header className="pw-hero">
        <p className="pixel">EST. 2024</p>
        <div className="pw-hero-row">
          <h1>A personal homepage, like the internet used to make.</h1>
          <HitCounter />
        </div>
      </header>

      {featured && (
        <section className="pw-flag" id="goatshop" aria-labelledby="goatshop-title">
          <div className="pw-flag-copy">
            <p className="pixel">Goatshop 5.0</p>
            <h2 id="goatshop-title">{featured.title}</h2>
            <p>{featured.description}</p>
            <div className="pw-flag-actions">
              <a className="btn-primary" href={featured.demoHref}>Open {shortName(featured)}</a>
              {featured.postHref && <Link className="btn-ghost" to={featured.postHref}>Read the build</Link>}
            </div>
          </div>
          <a className="pw-flag-shot" href={featured.demoHref}>
            <img
              src={featured.image}
              alt={featured.imageAlt || ''}
              width="1280"
              height="800"
              decoding="async"
            />
          </a>
        </section>
      )}

      <section className="pw-apps" aria-labelledby="apps-title">
        <div className="pw-section-head">
          <p className="pixel">Newest first</p>
          <h2 id="apps-title">Apps</h2>
        </div>
        <ul className="pw-grid">
          {apps.map((project) => {
            const fresh = project.slug === newest?.slug;
            return (
              <li key={project.slug}>
                <a className="pw-app" href={project.demoHref}>
                  {fresh && <span className="blinkie">New</span>}
                  <img
                    src={project.image}
                    alt=""
                    width="1280"
                    height="800"
                    loading="lazy"
                    decoding="async"
                  />
                  <h3>{shortName(project)}</h3>
                  <p>{project.description}</p>
                </a>
              </li>
            );
          })}
        </ul>
      </section>

      {defrag && (
        <section className="pw-defrag" aria-labelledby="defrag-title">
          <div className="pw-defrag-card">
            <p className="pixel">Under construction</p>
            <h2 id="defrag-title">{defrag.title}</h2>
            <p>{defrag.description}</p>
          </div>
        </section>
      )}

      <section className="pw-split" aria-labelledby="gb-title">
        <div>
          <p className="pixel">Sign it</p>
          <h2 id="gb-title">Guestbook</h2>
          <GuestbookList page="guestbook" limit={3} empty="Be the first name in the book." />
          <GuestbookForm page="guestbook" />
          <p className="pw-more"><Link to="/guestbook">Open the guestbook</Link></p>
        </div>
        <Webring />
      </section>

      <section className="pw-buttons" aria-labelledby="buttons-title">
        <h2 id="buttons-title" className="pixel">88×31</h2>
        <ButtonWall />
      </section>

      <section className="pw-notes" aria-labelledby="notes-title">
        <div className="pw-section-head">
          <p className="pixel">Latest</p>
          <h2 id="notes-title">Notes</h2>
        </div>
        {isLoading && <p className="gb-empty">Loading notes…</p>}
        {error && <p className="gb-empty">Notes aren’t loading.</p>}
        {!isLoading && !error && posts.length === 0 && <p className="gb-empty">Nothing published yet.</p>}
        <ul className="pw-post-list">
          {posts.map((post) => (
            <li key={post.slug}>
              <Link to={`/blog/${post.slug}`}>
                {post.published_at && <time className="pixel" dateTime={post.published_at}>{when(post.published_at)}</time>}
                <span>{post.title}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
