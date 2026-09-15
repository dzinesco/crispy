import { Link } from 'react-router-dom';
import Mark from './Mark.jsx';

export default function Footer() {
  return (
    <footer className="border-t border-ink/10 bg-ink text-cream">
      <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
        <div className="grid gap-10 md:grid-cols-3">
          <div className="md:col-span-1">
            <Link to="/" className="mb-4 inline-flex items-center gap-2.5">
              <Mark className="h-7 w-7" />
              <span className="font-semibold tracking-tightish">Crispy Goat</span>
            </Link>
            <p className="mt-4 max-w-xs text-[15px] leading-6 text-cream/70">
              Site kits you can buy today. Custom work when a kit won’t cover it.
            </p>
          </div>
          <div>
            <p className="mb-3 text-sm text-cream/50">Pages</p>
            <ul className="space-y-2 text-[15px]">
              <li><Link className="text-cream/80 hover:text-brass" to="/packages">Packs</Link></li>
              <li><Link className="text-cream/80 hover:text-brass" to="/blog">Blog</Link></li>
              <li><Link className="text-cream/80 hover:text-brass" to="/apply">Pitch</Link></li>
              <li><Link className="text-cream/80 hover:text-brass" to="/about">About</Link></li>
            </ul>
          </div>
          <div>
            <p className="mb-3 text-sm text-cream/50">Reach</p>
            <a className="text-[15px] text-cream/80 hover:text-brass" href="mailto:tm@crispygoat.com">
              tm@crispygoat.com
            </a>
            <p className="mt-3 text-[15px] text-cream/60">Remote. Worldwide.</p>
          </div>
        </div>
        <div className="mt-12 flex flex-col gap-3 border-t border-cream/10 pt-6 text-sm text-cream/45 sm:flex-row sm:justify-between">
          <p>© {new Date().getFullYear()} Crispy Goat</p>
          <div className="flex gap-5">
            <Link className="hover:text-cream" to="/privacy">Privacy</Link>
            <Link className="hover:text-cream" to="/terms">Terms</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
