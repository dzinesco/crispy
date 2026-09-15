import { useState } from 'react';
import Seo from '../components/Seo.jsx';
import { useSubmitApplication } from '../lib/api.js';

export default function Apply() {
  const submit = useSubmitApplication();
  const [form, setForm] = useState({ name: '', email: '', company: '', brief: '', budget: '' });
  const [submitted, setSubmitted] = useState(false);

  function update(field) {
    return (e) => setForm((f) => ({ ...f, [field]: e.target.value }));
  }

  async function onSubmit(e) {
    e.preventDefault();
    try {
      await submit.mutateAsync(form);
      setSubmitted(true);
    } catch (err) {
      alert(err.detail?.error || err.message);
    }
  }

  if (submitted) {
    return (
      <>
        <Seo title="Apply" description="Application submitted." />
        <section className="mx-auto max-w-2xl px-4 py-24 text-center sm:px-6 lg:px-8">
          <h1 className="mb-4 text-3xl font-bold">Got it.</h1>
          <p className="text-charcoal/70">
            We review every pitch. If it sparks something, you'll hear from us within a few business days.
          </p>
        </section>
      </>
    );
  }

  return (
    <>
      <Seo title="Apply" description="Pitch a custom build." />
      <section className="mx-auto max-w-2xl px-4 py-20 sm:px-6 lg:px-8">
        <h1 className="mb-4 text-4xl font-extrabold tracking-tight">Pitch your project</h1>
        <p className="mb-10 text-lg text-charcoal/70">
          Be clear, be concise, be compelling. No calls. No intros. Just the facts.
        </p>
        <form onSubmit={onSubmit} className="space-y-5">
          <div>
            <label className="label">Name</label>
            <input required className="input" value={form.name} onChange={update('name')} />
          </div>
          <div>
            <label className="label">Email</label>
            <input required type="email" className="input" value={form.email} onChange={update('email')} />
          </div>
          <div>
            <label className="label">Company (optional)</label>
            <input className="input" value={form.company} onChange={update('company')} />
          </div>
          <div>
            <label className="label">Budget</label>
            <input className="input" placeholder="e.g. $5k–$10k" value={form.budget} onChange={update('budget')} />
          </div>
          <div>
            <label className="label">The brief</label>
            <textarea required rows={6} className="input" value={form.brief} onChange={update('brief')} />
          </div>
          <button type="submit" disabled={submit.isPending} className="btn-accent w-full">
            {submit.isPending ? 'Sending…' : 'Submit pitch'}
          </button>
        </form>
      </section>
    </>
  );
}
