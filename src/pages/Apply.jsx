import { useState } from 'react';
import Seo from '../components/Seo.jsx';
import { useSubmitApplication } from '../lib/api.js';

export default function Apply() {
  const submit = useSubmitApplication();
  const [form, setForm] = useState({ name: '', email: '', company: '', brief: '', budget: '' });
  const [submitted, setSubmitted] = useState(false);
  const [errMsg, setErrMsg] = useState(null);

  function update(field) {
    return (e) => setForm((f) => ({ ...f, [field]: e.target.value }));
  }

  async function onSubmit(e) {
    e.preventDefault();
    setErrMsg(null);
    try {
      await submit.mutateAsync(form);
      setSubmitted(true);
    } catch (err) {
      setErrMsg(err.detail?.error || err.message);
    }
  }

  if (submitted) {
    return (
      <>
        <Seo title="Pitch sent" description="We have your brief." />
        <section className="mx-auto max-w-6xl px-4 py-24 sm:px-6">
          <h1 className="text-4xl font-extrabold tracking-tightish">Got it.</h1>
          <p className="mt-4 max-w-measure text-lg text-ink/65">
            We read every pitch. If it fits, you’ll hear from us within a few business days.
          </p>
        </section>
      </>
    );
  }

  return (
    <>
      <Seo title="Pitch a build" description="Send a brief. No calls." />
      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
        <h1 className="text-4xl font-extrabold tracking-tightish sm:text-5xl">Pitch a build</h1>
        <p className="mt-4 max-w-measure text-lg text-ink/65">
          Facts, not a deck. No calls. No intros.
        </p>
        <form onSubmit={onSubmit} className="mt-12 max-w-xl space-y-5">
          <div>
            <label className="label" htmlFor="name">Name</label>
            <input id="name" required className="input" value={form.name} onChange={update('name')} />
          </div>
          <div>
            <label className="label" htmlFor="email">Email</label>
            <input id="email" required type="email" className="input" value={form.email} onChange={update('email')} />
          </div>
          <div>
            <label className="label" htmlFor="company">Company (optional)</label>
            <input id="company" className="input" value={form.company} onChange={update('company')} />
          </div>
          <div>
            <label className="label" htmlFor="budget">Budget</label>
            <input id="budget" className="input" placeholder="$5k–$10k" value={form.budget} onChange={update('budget')} />
          </div>
          <div>
            <label className="label" htmlFor="brief">The brief</label>
            <textarea id="brief" required rows={7} className="input" value={form.brief} onChange={update('brief')} />
          </div>
          {errMsg && <p className="text-sm text-red-800">{errMsg}</p>}
          <button type="submit" disabled={submit.isPending} className="btn-accent">
            {submit.isPending ? 'Sending…' : 'Send pitch'}
          </button>
        </form>
      </section>
    </>
  );
}
