import { Link } from 'react-router-dom';
import { mergeLatest } from '../lib/latest.js';

function formatDate(value) {
  const time = Date.parse(value || '');
  if (Number.isNaN(time)) return null;
  return {
    iso: new Date(time).toISOString(),
    label: new Date(time).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }),
    day: new Date(time).toLocaleDateString('en-US', { day: '2-digit' }),
    month: new Date(time).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
  };
}

function CardLink({ item, className, children }) {
  if (item.external) {
    return (
      <a href={item.href} className={className}>
        {children}
      </a>
    );
  }
  return (
    <Link to={item.href} className={className}>
      {children}
    </Link>
  );
}

export default function LatestStrip({ posts = [], projects = [] }) {
  const items = mergeLatest(posts, projects, 6);
  if (!items.length) return null;

  const workImages = new Set(
    items.filter((item) => item.kind === 'work' && item.image).map((item) => item.image),
  );

  return (
    <section id="latest" className="bg-cream py-12 text-ink sm:py-16" aria-labelledby="latest-heading">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="mb-6 flex flex-col gap-3 sm:mb-8 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 id="latest-heading" className="text-3xl font-semibold tracking-[-0.03em] sm:text-4xl">
              Latest
            </h2>
            <p className="mt-2 text-[15px] text-ink/65">Newest notes and tools.</p>
          </div>
          <div className="flex gap-5 text-[15px]">
            <Link className="inline-flex min-h-[44px] items-center text-ink/70 hover:text-ink" to="/portfolio">
              Portfolio
            </Link>
            <Link className="inline-flex min-h-[44px] items-center text-ink/70 hover:text-ink" to="/blog">
              Blog
            </Link>
          </div>
        </div>

        <ul className="latest-rail -mx-4 px-4 sm:-mx-6 sm:px-6">
          {items.map((item) => {
            const date = formatDate(item.date);
            const showImage = item.image && !(item.kind === 'note' && workImages.has(item.image));
            return (
              <li key={item.id} className="latest-card">
                <CardLink
                  item={item}
                  className="group flex h-full flex-col border border-ink/10 bg-paper transition-colors hover:border-brass"
                >
                  {showImage ? (
                    <img
                      src={item.image}
                      alt={item.imageAlt || ''}
                      className="aspect-[16/10] w-full object-cover object-top"
                      width="1280"
                      height="800"
                      decoding="async"
                    />
                  ) : (
                    <div className="flex aspect-[16/10] flex-col justify-between bg-ink p-4 text-cream">
                      <span className="text-[12px] font-medium text-brass">{item.kicker}</span>
                      {date ? (
                        <span>
                          <span className="block text-[2rem] font-semibold leading-none tracking-[-0.04em]">{date.day}</span>
                          <span className="mt-1 block text-[13px] text-cream/70">{date.month}</span>
                        </span>
                      ) : (
                        <span className="text-xl font-semibold tracking-[-0.03em]">{item.title}</span>
                      )}
                    </div>
                  )}
                  <div className="flex flex-1 flex-col p-4">
                    <div className="flex items-center justify-between gap-3 text-[12px]">
                      <span className="font-medium text-brass">{item.kicker}</span>
                      {date && <time dateTime={date.iso}>{date.label}</time>}
                    </div>
                    <h3 className="mt-2 line-clamp-2 text-lg font-semibold tracking-[-0.02em] group-hover:text-brass">
                      {item.title}
                    </h3>
                    <p className="mt-2 line-clamp-2 min-h-[2.5rem] text-[14px] leading-5 text-ink/65">
                      {item.excerpt}
                    </p>
                  </div>
                </CardLink>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
