import { Link } from 'react-router-dom';
import Mark from './Mark.jsx';
import WorkMedia from './WorkMedia.jsx';

export default function WorkHero({ project, featured }) {
  return (
    <section className="hero-stage relative isolate overflow-hidden bg-ink text-cream" aria-label="Introduction">
      <div className="relative z-10 mx-auto grid min-h-0 max-w-6xl items-center gap-10 px-4 py-12 sm:px-6 sm:py-16 lg:min-h-[calc(100svh-3rem)] lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)] lg:gap-12 lg:py-10">
        <div className="rise">
          <p className="flex items-center gap-2 text-[13px] font-medium text-cream">
            <span className="live-dot" aria-hidden="true" />
            On the bench
          </p>
          <h1 className="mt-4 max-w-[12ch] text-[2.6rem] font-semibold leading-[1.02] tracking-[-0.04em] sm:text-6xl lg:text-[4.15rem]">
            Ship the site. Skip the agency theater.
          </h1>
          <p className="mt-5 max-w-[34rem] text-[17px] leading-7 text-cream/75 sm:text-[19px] sm:leading-8">
            Buy a kit and go live today. Or open what’s on the bench.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            {project?.demoHref ? (
              <a className="btn-accent" href={project.demoHref}>
                Open {project.title}
              </a>
            ) : (
              <Link className="btn-accent" to="/packages">See starter packs</Link>
            )}
            <Link
              to={project?.demoHref ? '/packages' : '/apply'}
              className="btn-ghost border-white/25 text-cream hover:border-white hover:bg-white hover:text-ink"
            >
              {project?.demoHref ? 'See starter packs' : 'Pitch a build'}
            </Link>
          </div>
          {featured && (
            <p className="mt-6 text-[15px] text-cream/70">
              On the counter:{' '}
              <Link
                to={`/kits/${featured.slug}`}
                className="text-cream underline decoration-brass decoration-2 underline-offset-4 hover:text-brass"
              >
                {featured.title}
              </Link>
              <span> · ${(featured.price_cents / 100).toFixed(0)}</span>
            </p>
          )}
        </div>

        <div className="rise rise-2 min-w-0">
          {project?.image ? (
            <WorkMedia project={project} live />
          ) : (
            <div className="flex aspect-[16/10] items-center justify-center bg-soot text-cream">
              <Mark className="h-28 w-28" />
            </div>
          )}
          {project?.description && (
            <p className="mt-3 text-[14px] leading-6 text-cream/75">{project.description}</p>
          )}
        </div>
      </div>
      <div className="h-1 bg-brass" aria-hidden="true" />
    </section>
  );
}
