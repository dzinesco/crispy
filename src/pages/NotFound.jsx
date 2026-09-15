import { Link } from 'react-router-dom';
import Seo from '../components/Seo.jsx';

export default function NotFound() {
  return (
    <>
      <Seo title="404" description="Page not found." />
      <section className="mx-auto max-w-6xl px-4 py-24 sm:px-6 sm:py-32">
        <p className="text-sm text-brass">404</p>
        <h1 className="mt-3 text-5xl font-extrabold tracking-tightish">Nothing cooking.</h1>
        <p className="mt-4 max-w-measure text-lg text-ink/65">
          That page isn’t here. The link may be old, or we moved it.
        </p>
        <Link to="/" className="btn-primary mt-10">Back to home</Link>
      </section>
    </>
  );
}
