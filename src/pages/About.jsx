import Seo from '../components/Seo.jsx';

export default function About() {
  return (
    <>
      <Seo title="About" description="What Crispy Goat is and how we work." />
      <section className="mx-auto max-w-3xl px-4 py-20 sm:px-6 lg:px-8">
        <h1 className="mb-6 text-4xl font-extrabold tracking-tight sm:text-5xl">About</h1>
        <div className="prose prose-charcoal max-w-none space-y-6 text-lg text-charcoal/80">
          <p>
            Crispy Goat is the anti-agency tech agency. We deliver exceptional digital solutions with culinary precision —
            less ceremony, more working code.
          </p>
          <h2 className="text-2xl font-bold text-charcoal">No drag, just dev</h2>
          <p>
            We move quickly because we know what matters. The result: code that ships on time and does what it claims.
          </p>
          <h2 className="text-2xl font-bold text-charcoal">We think, then build</h2>
          <p>
            Strategy and execution under one roof. No handoffs, no lost context — just smart, aligned delivery.
          </p>
          <h2 className="text-2xl font-bold text-charcoal">No bloat, all signal</h2>
          <p>
            We integrate with your stack, not against it. What works, we keep. What doesn't, we replace.
          </p>
        </div>
      </section>
    </>
  );
}
