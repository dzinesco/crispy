import { Link } from 'react-router-dom';

export default function Footer() {
  return (
    <footer className="bg-charcoal text-bone">
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="grid gap-12 lg:grid-cols-4">
          <div className="lg:col-span-2">
            <div className="mb-4 flex items-center gap-3">
              <span className="inline-block h-8 w-8 rounded bg-bone text-center font-mono text-xs leading-8 text-gold">CG</span>
              <div>
                <h3 className="text-xl font-bold">Crispy Goat</h3>
                <p className="text-xs text-bone/70">The Anti-Agency Tech Agency</p>
              </div>
            </div>
            <p className="max-w-md text-bone/80">
              Productized site kits and selective custom builds. We deliver digital solutions with culinary precision —
              no fluff, no nonsense.
            </p>
          </div>
          <div>
            <h4 className="mb-4 text-sm font-semibold uppercase tracking-wider text-bone/70">Site</h4>
            <ul className="space-y-2 text-sm">
              <li><Link className="text-bone/80 hover:text-gold" to="/packages">Starter Packs</Link></li>
              <li><Link className="text-bone/80 hover:text-gold" to="/blog">Blog</Link></li>
              <li><Link className="text-bone/80 hover:text-gold" to="/apply">Apply</Link></li>
              <li><Link className="text-bone/80 hover:text-gold" to="/contact">Contact</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="mb-4 text-sm font-semibold uppercase tracking-wider text-bone/70">Contact</h4>
            <ul className="space-y-2 text-sm text-bone/80">
              <li><a className="hover:text-gold" href="mailto:tm@crispygoat.com">tm@crispygoat.com</a></li>
              <li>Remote-first,<br />Serving clients worldwide</li>
            </ul>
          </div>
        </div>
        <div className="mt-12 flex flex-col items-center justify-between gap-3 border-t border-bone/20 pt-6 text-xs text-bone/60 md:flex-row">
          <p>© {new Date().getFullYear()} Crispy Goat. No rights reserved. Cook up something amazing.</p>
          <div className="flex gap-4">
            <Link className="hover:text-gold" to="/privacy">Privacy</Link>
            <Link className="hover:text-gold" to="/terms">Terms</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
