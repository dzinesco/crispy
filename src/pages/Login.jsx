import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import Seo from '../components/Seo.jsx';
import { useLogin } from '../lib/api.js';

export default function Login() {
  const login = useLogin();
  const nav = useNavigate();
  const loc = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errMsg, setErrMsg] = useState(null);

  async function onSubmit(e) {
    e.preventDefault();
    setErrMsg(null);
    try {
      await login.mutateAsync({ email, password });
      const to = loc.state?.from || '/admin';
      nav(to, { replace: true });
    } catch (err) {
      setErrMsg(err.detail?.error || err.message);
    }
  }

  return (
    <>
      <Seo title="Admin Login" description="Sign in to manage the site." />
      <section className="mx-auto max-w-md px-4 py-24 sm:px-6 lg:px-8">
        <h1 className="mb-2 text-3xl font-bold">Admin sign-in</h1>
        <p className="mb-8 text-charcoal/60">Restricted area.</p>
        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="label">Email</label>
            <input required type="email" className="input" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div>
            <label className="label">Password</label>
            <input required type="password" className="input" value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          <button type="submit" disabled={login.isPending} className="btn-primary w-full">
            {login.isPending ? 'Signing in…' : 'Sign in'}
          </button>
          {errMsg && <p className="text-sm text-red-600">{errMsg}</p>}
        </form>
      </section>
    </>
  );
}
