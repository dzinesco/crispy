import Seo from '../components/Seo.jsx';

export default function Contact() {
  return (
    <>
      <Seo title="Contact" description="Reach Crispy Goat." />
      <section className="mx-auto max-w-3xl px-4 py-20 sm:px-6 lg:px-8">
        <h1 className="mb-4 text-4xl font-extrabold tracking-tight sm:text-5xl">Contact</h1>
        <p className="mb-10 text-lg text-charcoal/70">
          The fastest way to reach us is email. We answer within one business day.
        </p>
        <div className="card">
          <p className="mb-1 font-mono text-xs uppercase tracking-wider text-charcoal/50">Email</p>
          <a href="mailto:tm@crispygoat.com" className="text-2xl font-bold text-gold hover:underline">
            tm@crispygoat.com
          </a>
        </div>
      </section>
    </>
  );
}
