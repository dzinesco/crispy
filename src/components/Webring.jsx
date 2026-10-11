import { Link, useLocation, useNavigate } from 'react-router-dom';
import { webring } from '../data/webring.js';

export default function Webring() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const index = Math.max(0, webring.findIndex((item) => item.href === pathname));
  const prev = webring[(index - 1 + webring.length) % webring.length];
  const next = webring[(index + 1) % webring.length];

  function random() {
    const options = webring.filter((item) => item.href !== pathname);
    const pick = options[Math.floor(Math.random() * options.length)] || webring[0];
    navigate(pick.href);
  }

  return (
    <div className="ring">
      <p className="pixel">Webring</p>
      <h2>This ring is the site.</h2>
      <p className="ring-note">Previous, next, and a random page. That’s the whole ring.</p>
      <div className="ring-nav">
        <Link to={prev.href}>← {prev.label}</Link>
        <button type="button" onClick={random}>Random</button>
        <Link to={next.href}>{next.label} →</Link>
      </div>
    </div>
  );
}
