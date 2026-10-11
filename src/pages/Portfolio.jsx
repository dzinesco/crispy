import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import Seo from '../components/Seo.jsx';
import Mark from '../components/Mark.jsx';
import usePrefersReducedMotion from '../hooks/usePrefersReducedMotion.js';
import {
  projects,
  shippedProjects,
  byNewest,
  featuredProject,
  portfolioFilters,
  backdropName,
  shortName,
  cardTagline,
} from '../data/portfolio.js';

const SIZES = '(min-width:1024px) 560px, 100vw';

function imageBase(src) {
  return String(src || '').replace(/\.png$/, '');
}

function Shot({ project, priority = false }) {
  const [failed, setFailed] = useState(false);
  if (failed || !project?.image) {
    return (
      <div className="cg-bezel__fallback">
        <Mark className="h-12 w-12" />
      </div>
    );
  }
  const base = imageBase(project.image);
  return (
    <picture>
      <source media="(max-width: 639px)" type="image/avif" srcSet={`${base}-m.avif`} />
      <source media="(max-width: 639px)" type="image/webp" srcSet={`${base}-m.webp`} />
      <source
        type="image/avif"
        srcSet={`${base}-640.avif 640w, ${base}-1280.avif 1280w`}
        sizes={SIZES}
      />
      <source
        type="image/webp"
        srcSet={`${base}-640.webp 640w, ${base}-1280.webp 1280w`}
        sizes={SIZES}
      />
      <img
        className="cg-bezel__shot"
        src={project.image}
        alt={project.imageAlt || ''}
        width="1280"
        height="800"
        sizes={SIZES}
        loading={priority ? 'eager' : 'lazy'}
        fetchpriority={priority ? 'high' : undefined}
        decoding="async"
        onError={() => setFailed(true)}
      />
    </picture>
  );
}

function Bezel({ project, priority = false, live = false }) {
  return (
    <div className="cg-bezel">
      <div className={`cg-bezel__bg cg-bg-${backdropName(project)}`} />
      <Shot project={project} priority={priority} />
      {live && (
        <iframe
          className="cg-bezel__live is-in"
          src={project.demoHref}
          title={`Live preview of ${project.title}`}
          tabIndex={-1}
          aria-hidden="true"
        />
      )}
    </div>
  );
}

function Pills({ tags }) {
  const visible = (tags || []).filter((tag) => tag && tag !== 'Browser');
  if (!visible.length) return null;
  return (
    <ul className="cg-pills">
      {visible.map((tag) => (
        <li key={tag} className="cg-pill">{tag}</li>
      ))}
    </ul>
  );
}

function useLivePreview(enabled) {
  const ref = useRef(null);
  const [live, setLive] = useState(false);
  useEffect(() => {
    if (!enabled) return undefined;
    const node = ref.current;
    if (!node) return undefined;
    let timer = 0;
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      timer = window.setTimeout(() => setLive(true), 800);
      observer.disconnect();
    });
    observer.observe(node);
    return () => {
      observer.disconnect();
      window.clearTimeout(timer);
    };
  }, [enabled]);
  return [ref, live];
}

function Featured({ project }) {
  const reduced = usePrefersReducedMotion();
  const [allowLive, setAllowLive] = useState(false);
  useEffect(() => {
    const desktop = window.matchMedia('(min-width: 1024px)');
    const saveData = navigator.connection && navigator.connection.saveData;
    const apply = () => setAllowLive(desktop.matches && !saveData && !reduced);
    apply();
    desktop.addEventListener('change', apply);
    return () => desktop.removeEventListener('change', apply);
  }, [reduced]);
  const [ref, live] = useLivePreview(allowLive && Boolean(project?.demoHref));
  if (!project) return null;
  return (
    <article className="cg-feature cg-enter" style={{ '--i': 0 }} ref={ref}>
      <Bezel project={project} priority live={live} />
      <div className="cg-feature__copy">
        <p className="cg-feature__kicker">Featured</p>
        <h2 className="cg-feature__title">{project.title}</h2>
        <p className="cg-feature__tagline">{project.description}</p>
        <Pills tags={project.tags} />
        <div className="cg-feature__actions">
          <a className="cg-btn cg-btn-rose" href={project.demoHref}>Open app</a>
          {project.postHref && (
            <Link className="cg-btn cg-btn-ghost-dark" to={project.postHref}>Read the build</Link>
          )}
        </div>
      </div>
    </article>
  );
}

function AppCard({ project, index }) {
  const name = shortName(project);
  return (
    <li className="cg-card cg-enter" id={project.slug} style={{ '--i': Math.min(index + 1, 5), viewTransitionName: `cg-${project.slug}` }}>
      <Bezel project={project} />
      <div className="cg-card__body">
        <h3 className="cg-card__title">{name}</h3>
        <p className="cg-card__tagline">{cardTagline(project)}</p>
        <Pills tags={project.tags} />
      </div>
      <a className="cg-card__link" href={project.demoHref}>
        <span className="sr-only">{name}</span>
      </a>
    </li>
  );
}

function FilterBar({ options, value, onChange }) {
  const groupRef = useRef(null);
  const buttonRefs = useRef([]);
  const [box, setBox] = useState(null);
  const selected = options.indexOf(value);

  useLayoutEffect(() => {
    const group = groupRef.current;
    if (!group) return undefined;
    const measure = () => {
      const overflow = group.scrollWidth > group.clientWidth + 1;
      group.classList.toggle('is-overflow', overflow);
      if (selected < 0) {
        setBox(null);
        return;
      }
      const el = buttonRefs.current[selected];
      if (!el) return;
      setBox({ x: el.offsetLeft, w: el.offsetWidth });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(group);
    return () => observer.disconnect();
  }, [selected, options]);

  function choose(index) {
    const next = options[index];
    if (!next) return;
    onChange(next);
    buttonRefs.current[index]?.focus();
  }

  function onKeyDown(event) {
    const current = selected < 0 ? 0 : selected;
    const last = options.length - 1;
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      event.preventDefault();
      choose(current === last ? 0 : current + 1);
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      event.preventDefault();
      choose(current === 0 ? last : current - 1);
    } else if (event.key === 'Home') {
      event.preventDefault();
      choose(0);
    } else if (event.key === 'End') {
      event.preventDefault();
      choose(last);
    }
  }

  return (
    <div
      ref={groupRef}
      className="cg-segments"
      role="radiogroup"
      aria-label="Filter apps"
      onKeyDown={onKeyDown}
    >
      {box && (
        <span
          className="cg-segments__indicator"
          style={{ transform: `translateX(${box.x}px)`, width: box.w }}
          aria-hidden="true"
        />
      )}
      {options.map((tag, index) => {
        const checked = tag === value;
        return (
          <button
            key={tag}
            ref={(node) => { buttonRefs.current[index] = node; }}
            type="button"
            role="radio"
            aria-checked={checked}
            tabIndex={checked || (selected < 0 && index === 0) ? 0 : -1}
            className="cg-segment"
            onClick={() => onChange(tag)}
          >
            {tag}
          </button>
        );
      })}
    </div>
  );
}

export default function Portfolio() {
  const reduced = usePrefersReducedMotion();
  const live = shippedProjects(projects);
  const ordered = byNewest(projects);
  const tags = portfolioFilters(projects);
  const featured = featuredProject(projects);
  const [params, setParams] = useSearchParams();
  const raw = params.get('tag');
  const value = !raw || raw === 'All' ? 'All' : raw;
  const known = value === 'All' || tags.includes(value);
  const matching = value === 'All'
    ? ordered
    : ordered.filter((project) => (project.tags || []).includes(value));
  const grid = value === 'All'
    ? matching.filter((project) => project.slug !== featured?.slug)
    : matching;
  const announced = matching.length;

  function selectTag(tag) {
    const apply = () => {
      if (!tag || tag === 'All') setParams({}, { replace: false });
      else setParams({ tag }, { replace: false });
    };
    if (!reduced && typeof document.startViewTransition === 'function') {
      document.startViewTransition(apply);
    } else {
      apply();
    }
  }

  const countLabel = `${live.length} ${live.length === 1 ? 'app' : 'apps'} · all open in your browser`;

  return (
    <div className="cg-portfolio">
      <Seo
        title="Portfolio"
        description="Every project here is live. Pick one, break it, tell me what you'd build next."
        path="/portfolio"
      />

      <header className="cg-hero">
        <div className="cg-page">
          <h1>You had to be there. Now you can be.</h1>
          <p className="cg-hero__sub">Old software, rebuilt from scratch for the modern web. Click anything.</p>
          <p className="cg-hero__meta">{countLabel}</p>
        </div>
      </header>

      <div className="cg-feature-wrap">
        <div className="cg-page">
          <Featured project={featured} />
        </div>
      </div>

      <div className="cg-filter">
        <div className="cg-page">
          <FilterBar options={['All', ...tags]} value={known ? value : ''} onChange={selectTag} />
          <p className="sr-only" aria-live="polite">{announced} {announced === 1 ? 'app' : 'apps'}</p>
        </div>
      </div>

      <div className="cg-grid-wrap">
        <div className="cg-page">
          {!known || (value !== 'All' && grid.length === 0) ? (
            <p className="cg-empty">
              Nothing tagged {value} yet.{' '}
              <button type="button" onClick={() => selectTag('All')}>Show all</button>
            </p>
          ) : (
            <ul className={grid.length >= 6 ? 'cg-grid is-wide' : 'cg-grid'}>
              {grid.map((project, index) => (
                <AppCard key={project.slug} project={project} index={index} />
              ))}
            </ul>
          )}
        </div>
      </div>

      <section className="cg-close">
        <div className="cg-page">
          <h2>Want one of these for your brand?</h2>
          <Link className="cg-btn cg-btn-ghost" to="/apply">Pitch</Link>
        </div>
      </section>
    </div>
  );
}
