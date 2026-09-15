import Seo from '../components/Seo.jsx';

export default function Contact() {
  return (
    <>
      <Seo title="Contact" description="Reach Crispy Goat." />
      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
        <h1 className="text-4xl font-extrabold tracking-tightish sm:text-5xl">Contact</h1>
        <p className="mt-4 max-w-measure text-lg text-ink/65">
          Email is fastest. We answer within one business day.
        </p>
        <a
          href="mailto:tm@crispygoat.com"
          className="mt-10 inline-block text-3xl font-semibold tracking-tightish text-brass hover:text-ink"
        >
          tm@crispygoat.com
        </a>
      </section>
    </>
  );
}
