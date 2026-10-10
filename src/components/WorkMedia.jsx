import { useEffect, useRef, useState } from 'react';
import Mark from './Mark.jsx';
import usePrefersReducedMotion from '../hooks/usePrefersReducedMotion.js';

export default function WorkMedia({ project, live = false }) {
  const reduced = usePrefersReducedMotion();
  const frameRef = useRef(null);
  const [wide, setWide] = useState(false);
  const [seen, setSeen] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)');
    const apply = () => setWide(mq.matches);
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, []);

  useEffect(() => {
    if (!live || reduced || !wide) return undefined;
    const node = frameRef.current;
    if (!node) return undefined;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setSeen(true);
      },
      { rootMargin: '160px' },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [live, reduced, wide]);

  const showLive = Boolean(project && live && project.demoHref && wide && !reduced && seen);

  useEffect(() => {
    if (!showLive) return undefined;
    const stage = frameRef.current?.querySelector('.work-stage');
    const iframe = stage?.querySelector('.work-live');
    if (!stage || !iframe) return undefined;
    const apply = () => {
      const scale = stage.clientWidth / 1280;
      iframe.style.transform = `scale(${scale})`;
    };
    apply();
    const observer = new ResizeObserver(apply);
    observer.observe(stage);
    return () => observer.disconnect();
  }, [showLive]);

  if (!project) return null;

  return (
    <div className="work-frame" ref={frameRef}>
      <div className="work-chrome">
        <Mark className="h-5 w-5 shrink-0" />
        <span className="min-w-0 truncate font-medium">{project.title}</span>
        <span className="live-pip">
          <span className="live-dot" aria-hidden="true" />
          Live
        </span>
        {project.demoHref && (
          <a className="work-open" href={project.demoHref} aria-label={`Open ${project.title}`}>
            Open
          </a>
        )}
      </div>
      <div className="work-stage">
        {project.image && (
          <img
            src={project.image}
            alt={project.imageAlt || ''}
            className="work-still"
            width="1280"
            height="800"
            decoding="async"
          />
        )}
        {showLive && (
          <iframe
            className={ready ? 'work-live is-ready' : 'work-live'}
            src={project.demoHref}
            title=""
            tabIndex={-1}
            aria-hidden="true"
            loading="lazy"
            onLoad={() => setReady(true)}
          />
        )}
      </div>
    </div>
  );
}
