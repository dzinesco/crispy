import { Link } from 'react-router-dom';
import Mark from './Mark.jsx';

export default function Footer() {
  return (
    <footer className="border-t border-white/10 bg-ink text-white">
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <div className="grid gap-10 md:grid-cols-3">
          <div>
            <Link to="/" className="inline-flex items-center gap-2.5 text-white">
              <Mark className="h-7 w-7" />
              <span className="font-semibold tracking-tight">Crispy Goat</span>
            </Link>
            <p className="mt-4 max-w-xs text-[15px] leading-6 text-[#e4e4e7]">
              A personal homepage. EST. 2024.
            </p>
          </div>
          <nav aria-label="Footer">
            <ul className="space-y-2 text-[15px]">
              <li><Link to="/portfolio">Apps</Link></li>
              <li><Link to="/blog">Blog</Link></li>
              <li><Link to="/tyler">Tyler</Link></li>
              <li><Link to="/guestbook">Guestbook</Link></li>
            </ul>
          </nav>
          <div>
            <a className="text-[15px]" href="mailto:tm@crispygoat.com">tm@crispygoat.com</a>
            <p className="mt-3 text-[15px] text-[#e4e4e7]">Western Slope, Colorado</p>
            <p className="mt-4 text-sm">
              <Link to="/contact">hire me</Link>
            </p>
          </div>
        </div>
        <div className="mt-10 flex flex-col gap-3 border-t border-white/10 pt-6 text-sm text-[#e4e4e7] sm:flex-row sm:justify-between">
          <p>© {new Date().getFullYear()} Crispy Goat</p>
          <div className="flex gap-5">
            <Link to="/about">About</Link>
            <Link to="/privacy">Privacy</Link>
            <Link to="/terms">Terms</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
