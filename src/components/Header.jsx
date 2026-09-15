import { useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import Mark from './Mark.jsx';

const links = [
  { to: '/packages', label: 'Packs' },
  { to: '/blog', label: 'Notes' },
  { to: '/apply', label: 'Pitch' },
  { to: '/contact', label: 'Contact' },
];

export default function Header() {
  const [open, setOpen] = useState(false);
  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-ink/70 text-cream backdrop-blur-xl">
      <div className="mx-auto flex h-12 max-w-6xl items-center justify-between px-4 sm:h-12 sm:px-6">
        <Link to="/" className="flex items-center gap-2.5" onClick={() => setOpen(false)}>
          <Mark />
          <span className="text-[13px] font-medium tracking-tight">Crispy Goat</span>
        </Link>

        <nav className="hidden items-center gap-7 text-[13px] md:flex">
          {links.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              className={({ isActive }) =>
                isActive ? 'font-medium text-cream' : 'text-cream/60 hover:text-cream'
              }
            >
              {l.label}
            </NavLink>
          ))}
        </nav>

        <button
          type="button"
          aria-label="Toggle menu"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          className="inline-flex h-11 w-11 items-center justify-center md:hidden"
        >
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            {open ? (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.75" d="M6 18L18 6M6 6l12 12" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.75" d="M4 7h16M4 12h16M4 17h16" />
            )}
          </svg>
        </button>
      </div>

      {open && (
        <nav className="border-t border-white/10 bg-ink md:hidden">
          <div className="flex flex-col px-4 py-2">
            {links.map((l) => (
              <NavLink
                key={l.to}
                to={l.to}
                onClick={() => setOpen(false)}
                className={({ isActive }) =>
                  `min-h-[44px] py-3 text-[15px] ${isActive ? 'font-medium text-cream' : 'text-cream/70'}`
                }
              >
                {l.label}
              </NavLink>
            ))}
          </div>
        </nav>
      )}
    </header>
  );
}
