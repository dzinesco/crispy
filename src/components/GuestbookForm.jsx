import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api.js';

export default function GuestbookForm({ page = 'guestbook' }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({ first_name: '', city: '', message: '', company_url: '' });
  const [state, setState] = useState('idle');

  function set(field) {
    return (event) => setForm((current) => ({ ...current, [field]: event.target.value }));
  }

  async function onSubmit(event) {
    event.preventDefault();
    setState('saving');
    try {
      await api.post('/guestbook', { ...form, page });
      setForm({ first_name: '', city: '', message: '', company_url: '' });
      setState('saved');
      qc.invalidateQueries({ queryKey: ['guestbook'] });
    } catch (error) {
      setState(error.status === 429 ? 'limited' : 'error');
    }
  }

  return (
    <form className="gb-form" onSubmit={onSubmit}>
      <div className="gb-hp" aria-hidden="true">
        <label>
          Company URL
          <input
            tabIndex={-1}
            autoComplete="off"
            value={form.company_url}
            onChange={set('company_url')}
          />
        </label>
      </div>
      <label className="label" htmlFor={`gb-name-${page}`}>
        First name
        <input
          id={`gb-name-${page}`}
          className="input"
          name="first_name"
          autoComplete="given-name"
          required
          maxLength={40}
          value={form.first_name}
          onChange={set('first_name')}
        />
      </label>
      <label className="label" htmlFor={`gb-city-${page}`}>
        City <span className="gb-optional">(optional)</span>
        <input
          id={`gb-city-${page}`}
          className="input"
          name="city"
          autoComplete="address-level2"
          maxLength={60}
          value={form.city}
          onChange={set('city')}
        />
      </label>
      <label className="label" htmlFor={`gb-message-${page}`}>
        Message
        <textarea
          id={`gb-message-${page}`}
          className="input"
          name="message"
          required
          maxLength={500}
          rows={4}
          value={form.message}
          onChange={set('message')}
        />
      </label>
      <p className="gb-count">{form.message.length}/500</p>
      <button className="btn-primary" type="submit" disabled={state === 'saving'}>
        {state === 'saving' ? 'Signing…' : 'Sign'}
      </button>
      <p className="gb-status" role="status">
        {state === 'saved' && 'Signed. It shows up here after it’s approved.'}
        {state === 'limited' && 'That’s a lot of notes. Try again in a little while.'}
        {state === 'error' && 'Couldn’t sign just now. Check the name and the message.'}
      </p>
    </form>
  );
}
