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
      <Seo title="Admin" description="Sign in." />
      <section className="mx-auto max-w-6xl px-4 py-24 sm:px-6">
        <h1 className="text-3xl font-bold tracking-tightish">Admin</h1>
        <form onSubmit={onSubmit} className="mt-10 max-w-sm space-y-4">
          <div>
            <label className="label" htmlFor="email">Email</label>
            <input id="email" required type="email" className="input" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div>
            <label className="label" htmlFor="password">Password</label>
            <input id="password" required type="password" className="input" value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          <button type="submit" disabled={login.isPending} className="btn-primary">
            {login.isPending ? 'Signing in…' : 'Sign in'}
          </button>
          {errMsg && <p className="text-sm text-red-800">{errMsg}</p>}
        </form>
      </section>
    </>
  );
}
