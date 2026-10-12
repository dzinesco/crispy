import { Link } from 'react-router-dom';
import Seo from '../components/Seo.jsx';
import HitCounter from '../components/HitCounter.jsx';
import GuestbookForm from '../components/GuestbookForm.jsx';
import GuestbookList from '../components/GuestbookList.jsx';
import ButtonWall from '../components/ButtonWall.jsx';
import Webring from '../components/Webring.jsx';
import Mark from '../components/Mark.jsx';
import { usePosts } from '../lib/api.js';
import {
  projects,
  byNewest,
  featuredProject,
  soonProjects,
  shippedProjects,
  shortName,
  homeGridProjects,
  homeAppsLabel,
} from '../data/portfolio.js';
import './home.css';

function when(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

const DESK_MENUS = ['File', 'Edit', 'Image', 'Layer', 'Filter'];

export default function Home() {
  const { data, isLoading, error } = usePosts();
  const posts = (data?.posts || []).slice(0, 4);
  const featured = featuredProject(projects);
  const newest = byNewest(projects)[0];
  const apps = homeGridProjects(projects);
  const totalApps = shippedProjects(projects).length;
  const defrag = soonProjects(projects).find((project) => project.slug === 'defrag');

  return (
    <div className="home">
      <Seo
        title="A personal homepage"
        description="Crispy Goat, est. 2024. Apps, a guestbook, and notes. A personal homepage, like the internet used to make."
        path="/"
      />

      <header className="home-hero">
        <div className="home-hero-frame">
          <div className="home-hero-brand">
            <div className="home-lockup">
              <div className="home-mark-wrap" role="img" aria-label="Crispy Goat">
                <Mark className="home-mark" />
              </div>
              <p className="pixel home-kicker">EST. 2024</p>
            </div>
            <HitCounter />
          </div>
          <div className="home-hero-copy">
            <h1>A personal homepage, like the internet used to make.</h1>
          </div>
        </div>
      </header>

      <div className="home-main">
        {featured && (
          <section className="home-flag" id="goatshop" aria-labelledby="goatshop-title">
            <div className="home-flag-copy">
              <p className="pixel">Goatshop 5.0</p>
              <h2 id="goatshop-title">{featured.title}</h2>
              <p>{featured.description}</p>
              <div className="home-flag-actions">
                <a className="btn-accent" href={featured.demoHref}>Open {shortName(featured)}</a>
                {featured.postHref && <Link className="btn-ghost" to={featured.postHref}>Read the build</Link>}
              </div>
            </div>
            <a className="home-desk" href={featured.demoHref}>
              <span className="sr-only">Open {shortName(featured)}</span>
              <div className="home-desk-bar" aria-hidden="true">
                <span className="home-desk-glyph" />
                <span className="home-desk-title">{shortName(featured)}</span>
                <span className="home-desk-controls">
                  <span className="home-desk-btn"><i className="home-desk-min" /></span>
                  <span className="home-desk-btn"><i className="home-desk-max" /></span>
                  <span className="home-desk-btn"><i className="home-desk-close" /></span>
                </span>
              </div>
              <div className="home-desk-menu" aria-hidden="true">
                {DESK_MENUS.map((item) => <span key={item}>{item}</span>)}
              </div>
              <span className="home-desk-shot">
                <img
                  src={featured.image}
                  alt=""
                  width="1280"
                  height="800"
                  decoding="async"
                />
              </span>
              <div className="home-desk-status" aria-hidden="true">
                <span>Ready</span>
                <span>1998</span>
              </div>
            </a>
          </section>
        )}

        <section className="home-apps" aria-labelledby="apps-title">
          <div className="home-section-head">
            <div>
              <p className="pixel">Newest first</p>
              <h2 id="apps-title">Apps</h2>
            </div>
            {totalApps > 0 && (
              <Link className="home-seeall" to="/portfolio">{homeAppsLabel(totalApps)}</Link>
            )}
          </div>
          <ul className="home-grid">
            {apps.map((project) => {
              const fresh = project.slug === newest?.slug;
              return (
                <li key={project.slug}>
                  <a className="home-card" href={project.demoHref}>
                    <span className="home-card-shot">
                      {fresh && <span className="home-new">New</span>}
                      <img
                        src={project.image}
                        alt=""
                        width="1280"
                        height="800"
                        loading="lazy"
                        decoding="async"
                      />
                    </span>
                    <span className="home-card-body">
                      <h3>{shortName(project)}</h3>
                      <p>{project.description}</p>
                    </span>
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
      </div>

      <section className="home-gather" aria-labelledby="gb-title">
        <div className="home-gather-inner">
          <div>
            <p className="pixel">Sign it</p>
            <h2 id="gb-title">Guestbook</h2>
            <GuestbookList page="guestbook" limit={3} empty="Be the first name in the book." />
            <GuestbookForm page="guestbook" />
            <p className="pw-more"><Link to="/guestbook">Open the guestbook</Link></p>
          </div>
          <Webring />
        </div>
      </section>

      <div className="home-main home-tail">
        <section className="pw-buttons" aria-labelledby="buttons-title">
          <h2 id="buttons-title" className="pixel">88×31</h2>
          <ButtonWall />
        </section>

        <section className="pw-notes" aria-labelledby="notes-title">
          <div className="home-section-head">
            <div>
              <p className="pixel">Latest</p>
              <h2 id="notes-title">Notes</h2>
            </div>
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
    </div>
  );
}
