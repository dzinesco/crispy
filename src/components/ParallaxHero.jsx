import { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import usePrefersReducedMotion from '../hooks/usePrefersReducedMotion.js';

export default function ParallaxHero({ featured }) {
  const stageRef = useRef(null);
  const farRef = useRef(null);
  const midRef = useRef(null);
  const reduced = usePrefersReducedMotion();

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage || reduced) return;

    let px = 0;
    let py = 0;
    let tx = 0;
    let ty = 0;
    let scroll = 0;
    let raf = 0;
    const finePointer = window.matchMedia('(pointer: fine)').matches;

    const apply = () => {
      raf = 0;
      px += (tx - px) * 0.1;
      py += (ty - py) * 0.1;
      if (farRef.current) {
        farRef.current.style.transform = `translate3d(${px * -12}px, ${py * -8 + scroll * 28}px, 0) scale(1.08)`;
      }
      if (midRef.current) {
        midRef.current.style.transform = `translate3d(${px * 16}px, ${py * 10}px, 0) rotateX(${py * -6}deg) rotateY(${px * 8}deg)`;
      }
      if (Math.abs(px - tx) > 0.001 || Math.abs(py - ty) > 0.001) {
        raf = requestAnimationFrame(apply);
      }
    };

    const kick = () => {
      if (!raf) raf = requestAnimationFrame(apply);
    };

    const onMove = (e) => {
      if (!finePointer) return;
      const r = stage.getBoundingClientRect();
      tx = (e.clientX - r.left) / r.width - 0.5;
      ty = (e.clientY - r.top) / r.height - 0.5;
      kick();
    };

    const onScroll = () => {
      const r = stage.getBoundingClientRect();
      scroll = Math.min(1, Math.max(0, -r.top / (r.height || 1)));
      kick();
    };

    stage.addEventListener('pointermove', onMove);
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    kick();
    return () => {
      stage.removeEventListener('pointermove', onMove);
      window.removeEventListener('scroll', onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [reduced]);

  return (
    <section
      ref={stageRef}
      className="hero-stage relative isolate overflow-hidden bg-ink text-cream"
      aria-label="Introduction"
    >
      <img
        ref={farRef}
        src="/images/studio-bokeh.jpg"
        alt=""
        className="hero-far"
        decoding="async"
      />

      <div className="relative z-10 mx-auto grid min-h-[100svh] max-w-6xl items-center gap-8 px-4 py-24 sm:px-6 lg:grid-cols-2 lg:gap-6 lg:py-0">
        <div>
          <h1 className="max-w-[12ch] text-[2.75rem] font-semibold leading-[1.05] tracking-[-0.038em] sm:text-6xl lg:text-[4.35rem]">
            Ship the site. Skip the agency theater.
          </h1>
          <p className="mt-6 max-w-[32rem] text-[17px] leading-7 text-cream/70 sm:text-[19px] sm:leading-8">
            Buy a kit and go live today. Or pitch a custom build if the problem is bigger than a template.
          </p>
          <div className="mt-10 flex flex-col gap-3 sm:flex-row">
            {featured ? (
              <Link to={`/kits/${featured.slug}`} className="btn-accent">
                Buy {featured.title} — ${(featured.price_cents / 100).toFixed(0)}
              </Link>
            ) : (
              <Link to="/packages" className="btn-accent">See starter packs</Link>
            )}
            <Link
              to="/apply"
              className="btn-ghost border-cream/25 text-cream hover:border-cream hover:bg-cream hover:text-ink"
            >
              Pitch a build
            </Link>
          </div>
        </div>

        <div className="hero-product">
          <img
            ref={midRef}
            src="/images/mark-3d.jpg?v=2"
            alt="Brushed brass mark"
            decoding="async"
          />
        </div>
      </div>
    </section>
  );
}
