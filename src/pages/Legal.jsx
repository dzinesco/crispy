import Seo from '../components/Seo.jsx';

export function Privacy() {
  return (
    <>
      <Seo title="Privacy" description="How Crispy Goat handles information." />
      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
        <h1 className="text-4xl font-extrabold tracking-tightish">Privacy</h1>
        <div className="prose-cg mt-8">
          <p>
            We collect what you send us: pitch forms, checkout emails via Stripe, and the usual server logs
            (IP, user agent) needed to keep the site up.
          </p>
          <p>
            We don’t sell that information. We don’t run ad pixels. Stripe processes payments under their own
            terms. Email us at tm@crispygoat.com if you want something deleted.
          </p>
        </div>
      </section>
    </>
  );
}

export function Terms() {
  return (
    <>
      <Seo title="Terms" description="Terms for buying kits and commissioning work." />
      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
        <h1 className="text-4xl font-extrabold tracking-tightish">Terms</h1>
        <div className="prose-cg mt-8">
          <p>
            Kits are sold as-is. Once you have the files, they’re yours to use on one live site. Custom work
            is scoped in the proposal you approve; anything outside that is a new job.
          </p>
          <p>
            Deposits are non-refundable once the week is locked. Questions: tm@crispygoat.com.
          </p>
        </div>
      </section>
    </>
  );
}
