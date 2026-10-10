import { useState } from 'react';
import { Link } from 'react-router-dom';
import Seo from '../components/Seo.jsx';
import Mark from '../components/Mark.jsx';
import WorkMedia from '../components/WorkMedia.jsx';
import {
  projects,
  shippedProjects,
  soonProjects,
  featuredProject,
  portfolioTags,
} from '../data/portfolio.js';

function Tags({ tags }) {
  if (!tags?.length) return null;
  return (
    <ul className="mt-4 flex list-none flex-wrap gap-2">
      {tags.map((tag) => (
        <li key={tag} className="border border-current/20 px-2 py-0.5 text-[12px] opacity-80">
          {tag}
        </li>
      ))}
    </ul>
  );
}

function Actions({ project, onDark = false }) {
  if (!project?.demoHref && !project?.postHref) return null;
  const ghost = onDark
    ? 'btn-ghost border-white/25 text-cream hover:border-white hover:bg-white hover:text-ink'
    : 'btn-ghost';
  return (
    <div className="mt-auto flex flex-col gap-3 pt-6 sm:flex-row sm:flex-wrap">
      {project.demoHref && (
        <a className={`${onDark ? 'btn-accent' : 'btn-primary'} w-full sm:w-auto`} href={project.demoHref}>
          Try it
        </a>
      )}
      {project.postHref && (
        <Link className={`${ghost} w-full sm:w-auto`} to={project.postHref}>
          Read more
        </Link>
      )}
    </div>
  );
}

function Shot({ project }) {
  if (!project?.image) return null;
  const frame = (
    <>
      <img
        src={project.image}
        alt={project.imageAlt || ''}
        className="folio-still"
        width="1280"
        height="800"
        decoding="async"
      />
      {project.demoHref && (
        <span className="folio-launch" aria-hidden="true">Launch</span>
      )}
    </>
  );
  return (
    <div className="folio-bezel">
      {project.demoHref ? (
        <a className="folio-shot" href={project.demoHref} aria-label={`Launch ${project.title}`}>
          {frame}
        </a>
      ) : (
        <div className="folio-shot">{frame}</div>
      )}
    </div>
  );
}

function AppCard({ project }) {
  return (
    <li id={project.slug} className="folio-card scroll-mt-20 flex h-full flex-col bg-cream text-ink">
      <Shot project={project} />
      <div className="flex flex-1 flex-col p-5">
        <h3 className="text-2xl font-semibold tracking-[-0.03em]">{project.title}</h3>
        <p className="mt-2 text-[15px] leading-6 text-ink/70">{project.description}</p>
        <Tags tags={project.tags} />
        <Actions project={project} />
      </div>
    </li>
  );
}

function SoonCard({ project }) {
  return (
    <li id={project.slug} className="folio-card folio-soon scroll-mt-20 flex h-full flex-col bg-cream text-ink">
      <div className="folio-bezel">
        <div className="folio-shot folio-soon-stage">
          <Mark className="h-16 w-16 text-brass" />
          <p className="text-[12px] font-medium uppercase tracking-[0.16em] text-cream/80">In progress</p>
        </div>
      </div>
      <div className="flex flex-1 flex-col p-5">
        <h3 className="text-2xl font-semibold tracking-[-0.03em]">{project.title}</h3>
        <p className="mt-2 text-[15px] leading-6 text-ink/70">{project.description}</p>
      </div>
    </li>
  );
}

export default function Portfolio() {
  const live = shippedProjects(projects);
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

  return (
    <>
      <Seo
        title="Portfolio"
        description="Working browser apps from Crispy Goat. Open one and use it."
        path="/portfolio"
      />

      <section className="folio-stage text-cream">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-20">
          <p className="flex items-center gap-2.5 text-[13px] font-medium text-cream">
            <Mark className="h-6 w-6 text-brass" />
            Portfolio
          </p>
          <div className="mt-6 grid items-end gap-8 lg:grid-cols-[minmax(0,1fr)_auto]">
            <div>
              <h1 className="max-w-[14ch] text-4xl font-semibold leading-[1.02] tracking-[-0.04em] sm:text-6xl">
                Open one. It runs.
              </h1>
              <p className="mt-4 max-w-measure text-[17px] leading-7 text-cream/75 sm:text-lg">
                Drawing boards, old desktops, a player that whips. If it is listed, it works in the browser. More are on the bench.
              </p>
            </div>
            <p className="flex items-baseline gap-3 lg:text-right">
              <span className="text-6xl font-semibold tracking-[-0.05em] text-brass sm:text-7xl">{count}</span>
              <span className="text-[13px] font-medium uppercase tracking-[0.14em] text-cream/70">
                {live.length === 1 ? 'live app' : 'live apps'}
              </span>
            </p>
          </div>

          {hero && (
            <article id={hero.slug} className="scroll-mt-20 mt-12 grid items-center gap-8 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] lg:gap-12">
              <WorkMedia project={hero} live />
              <div>
                <p className="text-[12px] font-medium uppercase tracking-[0.16em] text-brass">
                  {filter === 'All' ? 'Featured' : filter}
                </p>
                <h2 className="mt-3 text-3xl font-semibold tracking-[-0.03em] sm:text-4xl">{hero.title}</h2>
                <p className="mt-3 text-[16px] leading-7 text-cream/75">{hero.description}</p>
                <Tags tags={hero.tags} />
                <Actions project={hero} onDark />
              </div>
            </article>
          )}
        </div>
        <div className="h-1 bg-brass" aria-hidden="true" />
      </section>

      <section className="bg-paper">
        <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
          {live.length === 0 ? (
            <p className="max-w-measure text-ink/60">Nothing on the counter yet.</p>
          ) : (
            <>
              <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                <h2 className="text-2xl font-semibold tracking-[-0.03em]">The shelf</h2>
                <div className="flex flex-wrap gap-2" role="group" aria-label="Filter apps by tag">
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
                <p className="mt-10 text-ink/60">Nothing with that tag yet.</p>
              )}

              {(rest.length > 0 || (filter === 'All' && soon.length > 0)) && (
                <ul className="mt-8 grid list-none items-stretch gap-6 sm:grid-cols-2 lg:grid-cols-3">
                  {rest.map((project) => (
                    <AppCard key={project.slug} project={project} />
                  ))}
                  {filter === 'All' && soon.map((project) => (
                    <SoonCard key={project.slug} project={project} />
                  ))}
                </ul>
              )}

              {filter !== 'All' && soon.length > 0 && (
                <ul className="mt-6 grid list-none gap-6 sm:grid-cols-2 lg:grid-cols-3">
                  {soon.map((project) => (
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
