import { Link } from 'react-router-dom';
import Seo from '../components/Seo.jsx';

export default function NotFound() {
  return (
    <>
      <Seo title="404" description="Page not found." />
      <section className="mx-auto max-w-2xl px-4 py-32 text-center sm:px-6 lg:px-8">
        <p className="mb-2 font-mono text-sm uppercase tracking-widest text-gold">404</p>
        <h1 className="mb-4 text-5xl font-extrabold tracking-tight">Nothing cooking.</h1>
        <p className="mb-10 text-lg text-charcoal/70">
          That page doesn't exist. The link may be old, or we may have moved it.
        </p>
        <Link to="/" className="btn-primary">Back to home</Link>
      </section>
    </>
  );
}
