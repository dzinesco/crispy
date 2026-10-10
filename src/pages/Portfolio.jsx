import { Link } from 'react-router-dom';
import Seo from '../components/Seo.jsx';
import { projects } from '../data/portfolio.js';

export default function Portfolio() {
  return (
    <>
      <Seo
        title="Portfolio"
        description="Small tools and experiments from Crispy Goat. Open one and use it."
        path="/portfolio"
      />
      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
        <h1 className="text-4xl font-semibold tracking-[-0.03em] sm:text-5xl">Portfolio</h1>
        <p className="mt-4 max-w-measure text-lg text-ink/65">
          Small tools we shipped and left running. If it is on this page, you can open it.
        </p>

        {projects.length === 0 ? (
          <p className="mt-12 max-w-measure text-ink/60">Nothing on the counter yet.</p>
        ) : (
          <ul className="mt-14 grid list-none gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {projects.map((project) => (
              <li key={project.slug} className="flex flex-col border border-ink/10 bg-cream">
                <img
                  src={project.image}
                  alt={project.imageAlt || ''}
                  className="aspect-[16/10] w-full object-cover object-top"
                  width="1280"
                  height="800"
                />
                <div className="flex flex-1 flex-col p-5">
                  <h2 className="text-2xl font-semibold tracking-[-0.025em]">{project.title}</h2>
                  <p className="mt-2 text-[15px] leading-6 text-ink/65">{project.description}</p>
                  {project.tags?.length > 0 && (
                    <ul className="mt-4 flex list-none flex-wrap gap-2">
                      {project.tags.map((tag) => (
                        <li key={tag} className="border border-ink/15 px-2 py-0.5 text-[12px] text-ink/70">
                          {tag}
                        </li>
                      ))}
                    </ul>
                  )}
                  <div className="mt-auto flex flex-wrap items-center gap-3 pt-6">
                    <a className="btn-primary" href={project.demoHref}>
                      Try it
                    </a>
                    {project.postHref && (
                      <Link className="btn-ghost" to={project.postHref}>
                        Read more
                      </Link>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
