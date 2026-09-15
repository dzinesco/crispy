import Seo from '../components/Seo.jsx';

export default function About() {
  return (
    <>
      <Seo title="About" description="What Crispy Goat is and how we work." />
      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
        <h1 className="max-w-[12ch] text-4xl font-extrabold tracking-tightish sm:text-5xl">A shop, not an agency.</h1>
        <div className="prose-cg mt-10">
          <p>
            Crispy Goat sells site kits and takes on a small number of custom builds. We skip the kickoff
            workshops, the status theater, and the twelve-person Slack.
          </p>
          <h2>We move because we already know the work</h2>
          <p>
            Most briefs don’t need a strategy offsite. They need a site that loads, takes money, and doesn’t
            embarrass you. That’s the work.
          </p>
          <h2>One roof</h2>
          <p>
            Strategy and execution stay together. No handoff, no lost context, no “the other team owns that.”
          </p>
          <h2>Keep what works</h2>
          <p>
            We plug into the stack you already have. If a tool earns its keep, it stays. If it doesn’t, it goes.
          </p>
        </div>
      </section>
    </>
  );
}
