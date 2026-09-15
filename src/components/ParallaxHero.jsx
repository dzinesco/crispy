import { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import usePrefersReducedMotion from '../hooks/usePrefersReducedMotion.js';

export default function ParallaxHero({ featured }) {
  const stageRef = useRef(null);
  const farRef = useRef(null);
  const midRef = useRef(null);
  const copyRef = useRef(null);
  const reduced = usePrefersReducedMotion();

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;

    let px = 0;
    let py = 0;
    let tx = 0;
    let ty = 0;
    let scroll = 0;
    let raf = 0;
    const finePointer = window.matchMedia('(pointer: fine)').matches;

    const apply = () => {
      raf = 0;
      if (reduced) return;
      px += (tx - px) * 0.08;
      py += (ty - py) * 0.08;
      const far = farRef.current;
      const mid = midRef.current;
      const copy = copyRef.current;
      if (far) {
        far.style.transform = `translate3d(${px * -18}px, ${py * -10 + scroll * 40}px, -240px) scale(1.18)`;
      }
      if (mid) {
        mid.style.transform = `translate3d(${px * 28}px, ${py * 16 + scroll * 70}px, 80px) rotateX(${py * -10}deg) rotateY(${px * 14}deg)`;
      }
      if (copy) {
        copy.style.transform = `translate3d(${px * 8}px, ${py * 6 + scroll * 24}px, 0)`;
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
      const h = r.height || 1;
      scroll = Math.min(1, Math.max(0, -r.top / h));
      kick();
    };

    if (!reduced) {
      stage.addEventListener('pointermove', onMove);
      window.addEventListener('scroll', onScroll, { passive: true });
      onScroll();
      kick();
    }

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
      <div className="hero-world">
        <img
          ref={farRef}
          src="/images/studio-bokeh.jpg"
          alt=""
          className="hero-layer hero-far"
          decoding="async"
        />
        <img
          ref={midRef}
          src="/images/mark-3d.jpg?v=2"
          alt="Brass mark"
          className="hero-layer hero-mid"
          decoding="async"
        />
      </div>

      <div ref={copyRef} className="relative z-10 mx-auto max-w-6xl px-4 py-[22vh] sm:px-6 sm:py-[24vh]">
        <p className="mb-5 text-[13px] font-medium tracking-wide text-brass">Crispy Goat</p>
        <h1 className="max-w-[13ch] text-[2.6rem] font-semibold leading-[1.02] tracking-[-0.035em] sm:text-6xl lg:text-[4.75rem]">
          Ship the site. Skip the agency theater.
        </h1>
        <p className="mt-6 max-w-[34rem] text-[17px] leading-7 text-cream/70 sm:text-[19px] sm:leading-8">
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
    </section>
  );
}
