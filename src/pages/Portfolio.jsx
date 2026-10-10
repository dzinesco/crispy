import { useState } from 'react';
import { Link } from 'react-router-dom';
import Seo from '../components/Seo.jsx';
import Mark from '../components/Mark.jsx';
import WorkMedia from '../components/WorkMedia.jsx';
import {
  projects,
  byNewest,
  soonProjects,
  featuredProject,
  portfolioTags,
  backdropName,
} from '../data/portfolio.js';

function backdropClass(project) {
  return `gc-${backdropName(project)}`;
}

function Tags({ tags, light = false }) {
  if (!tags?.length) return null;
  return (
    <ul className={`mt-4 flex list-none flex-wrap gap-2 text-[12px] ${light ? 'text-cream/80' : 'text-ink/70'}`}>
      {tags.map((tag) => (
        <li key={tag} className="border border-current/25 px-2 py-0.5">
          {tag}
        </li>
      ))}
    </ul>
  );
}

function LaunchLink({ project, onDark = false }) {
  if (!project?.demoHref) return null;
  return (
    <a className={`${onDark ? 'btn-accent' : 'folio-go'} w-full sm:w-auto`} href={project.demoHref}>
      Launch
    </a>
  );
}

function ReadMore({ project, onDark = false }) {
  if (!project?.postHref) return null;
  const ghost = onDark
    ? 'btn-ghost border-white/25 text-cream hover:border-white hover:bg-white hover:text-ink'
    : 'btn-ghost';
  return (
    <Link className={`${ghost} w-full sm:w-auto`} to={project.postHref}>
      Read more
    </Link>
  );
}

function AppCard({ project }) {
  return (
    <li id={project.slug} className="folio-card scroll-mt-20 flex h-full flex-col bg-cream text-ink">
      <div className={`folio-bezel ${backdropClass(project)}`}>
        <div className="folio-shot">
          <img
            src={project.image}
            alt={project.imageAlt || ''}
            className="folio-still"
            width="1280"
            height="800"
            decoding="async"
          />
        </div>
      </div>
      <div className="flex flex-1 flex-col p-3">
        <h3 className="folio-title">{project.title}</h3>
        <div className="folio-read">
          {project.postHref ? (
            <Link to={project.postHref}>Read more</Link>
          ) : (
            <span aria-hidden="true">Read more</span>
          )}
        </div>
        <a className="folio-go" href={project.demoHref}>Launch</a>
      </div>
    </li>
  );
}

function SoonCard({ project }) {
  return (
    <li id={project.slug} className="folio-card folio-soon scroll-mt-20 flex h-full flex-col bg-cream text-ink">
      <div className={`folio-bezel ${backdropClass(project)}`}>
        <div className="folio-shot folio-soon-stage">
          <Mark className="h-10 w-10 text-brass" />
          <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-cream/80">In progress</p>
        </div>
      </div>
      <div className="flex flex-1 flex-col p-3">
        <h3 className="folio-title">{project.title}</h3>
        <p className="folio-read text-ink/60">{project.description}</p>
        <span className="folio-go is-soon">Soon</span>
      </div>
    </li>
  );
}

export default function Portfolio() {
  const live = byNewest(projects);
  const soon = soonProjects(projects);
  const tags = portfolioTags(projects);
  const pinned = featuredProject(projects);
  const [filter, setFilter] = useState('All');

  const visible = filter === 'All'
    ? live
    : live.filter((project) => (project.tags || []).includes(filter));

  const hero = visible.find((project) => project.slug === pinned?.slug) || visible[0] || null;
  const rest = visible.filter((project) => project.slug !== hero?.slug);
  const count = String(live.length).padStart(2, '0');
  const showSoon = filter === 'All' && soon.length > 0;

  return (
    <>
      <Seo
        title="Portfolio"
        description="Working browser apps from Crispy Goat. Open one and use it."
        path="/portfolio"
      />

      <section className="folio-stage text-cream">
        <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
          <p className="flex items-center gap-2.5 text-[13px] font-medium text-cream">
            <Mark className="h-6 w-6 text-brass" />
            Portfolio
          </p>
          <div className="mt-5 grid items-end gap-6 sm:grid-cols-[minmax(0,1fr)_auto]">
            <div>
              <h1 className="max-w-[12ch] text-4xl font-semibold leading-[0.98] tracking-[-0.045em] sm:text-6xl">
                Open one. It runs.
              </h1>
              <p className="mt-4 max-w-measure text-[17px] leading-7 text-cream/75">
                A shelf of toys that work in the browser. The newest one is on top. The rest are one tap away.
              </p>
            </div>
            <p className="flex items-baseline gap-3">
              <span className="text-6xl font-semibold tracking-[-0.05em] text-brass sm:text-7xl">{count}</span>
              <span className="max-w-[6rem] text-[13px] font-medium uppercase leading-4 tracking-[0.14em] text-cream/70">
                {live.length === 1 ? 'live app' : 'live apps'}
              </span>
            </p>
          </div>

          {hero && (
            <article id={hero.slug} className="scroll-mt-20 mt-10 grid items-center gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)] lg:gap-10">
              <div className={`gc-showcase ${backdropClass(hero)}`}>
                <div className="gc-marquee" aria-hidden="true">
                  <span>★ crispy goat ★ {hero.title} ★ a working browser app ★ click launch ★</span>
                </div>
                <WorkMedia project={hero} live />
                <p className="gc-hits" aria-hidden="true">HITS 000042</p>
              </div>
              <div>
                <p className="text-[12px] font-medium uppercase tracking-[0.16em] text-brass">
                  {filter === 'All' ? 'Featured' : filter}
                </p>
                <h2 className="mt-2 text-3xl font-semibold tracking-[-0.03em] sm:text-4xl">{hero.title}</h2>
                <p className="mt-3 text-[16px] leading-7 text-cream/75">{hero.description}</p>
                <Tags tags={hero.tags} light />
                <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                  <LaunchLink project={hero} onDark />
                  <ReadMore project={hero} onDark />
                </div>
              </div>
            </article>
          )}
        </div>
        <div className="h-1 bg-brass" aria-hidden="true" />
      </section>

      <section className="bg-paper">
        <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
          {live.length === 0 ? (
            <p className="max-w-measure text-ink/60">Nothing on the counter yet.</p>
          ) : (
            <>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <h2 className="text-xl font-semibold tracking-[-0.03em]">All apps</h2>
                <div className="folio-chips" role="group" aria-label="Filter apps by tag">
                  {['All', ...tags].map((tag) => {
                    const pressed = filter === tag;
                    return (
                      <button
                        key={tag}
                        type="button"
                        aria-pressed={pressed}
                        onClick={() => setFilter(tag)}
                        className={pressed ? 'folio-chip is-on' : 'folio-chip'}
                      >
                        {tag}
                      </button>
                    );
                  })}
                </div>
              </div>

              {visible.length === 0 && (
                <p className="mt-8 text-ink/60">Nothing with that tag yet.</p>
              )}

              {(rest.length > 0 || showSoon) && (
                <ul className="folio-grid mt-6 list-none">
                  {rest.map((project) => (
                    <AppCard key={project.slug} project={project} />
                  ))}
                  {showSoon && soon.map((project) => (
                    <SoonCard key={project.slug} project={project} />
                  ))}
                </ul>
              )}
            </>
          )}
        </div>
      </section>
    </>
  );
}
