import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Seo from '../components/Seo.jsx';
import {
  useAdminPosts, useAdminKits, useAdminDemos, useApplications,
  useLogout, useAdminActions,
} from '../lib/api.js';

const TABS = ['Posts', 'Kits', 'Demos', 'Applications'];

export default function Admin() {
  const [tab, setTab] = useState('Posts');
  const nav = useNavigate();
  const logout = useLogout();
  const posts = useAdminPosts();
  const kits = useAdminKits();
  const demos = useAdminDemos();
  const apps = useApplications();
  const actions = useAdminActions();

  async function onLogout() {
    await logout.mutateAsync();
    nav('/admin/login');
  }

  return (
    <>
      <Seo title="Admin" description="Manage content." />
      <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="mb-8 flex items-center justify-between">
          <h1 className="text-3xl font-bold">Admin</h1>
          <button onClick={onLogout} className="btn-ghost">Sign out</button>
        </div>

        <div className="mb-6 flex flex-wrap gap-2 border-b border-charcoal/10">
          {TABS.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`-mb-px border-b-2 px-4 py-2 text-sm font-semibold transition-colors ${
                tab === t ? 'border-gold text-gold' : 'border-transparent text-charcoal/60 hover:text-charcoal'
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        {tab === 'Posts' && <PostsPanel data={posts.data?.posts || []} actions={actions} />}
        {tab === 'Kits' && <KitsPanel data={kits.data?.kits || []} actions={actions} />}
        {tab === 'Demos' && <DemosPanel data={demos.data?.demos || []} actions={actions} />}
        {tab === 'Applications' && <AppsPanel data={apps.data?.applications || []} />}
      </section>
    </>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <label className="label">{label}</label>
      {children}
    </div>
  );
}

function StatusBadge({ status }) {
  const colors = status === 'published' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800';
  return <span className={`rounded px-2 py-0.5 font-mono text-xs uppercase ${colors}`}>{status}</span>;
}

function PostsPanel({ data, actions }) {
  const [editing, setEditing] = useState(null);
  const items = data;

  async function save() {
    if (editing.id) {
      await actions.updatePost.mutateAsync({ slug: editing.slug, ...editingForm(editing) });
    } else {
      await actions.createPost.mutateAsync(editingForm(editing));
    }
    setEditing(null);
  }
  function editingForm(e) {
    return {
      slug: e.slug,
      title: e.title,
      excerpt: e.excerpt || '',
      body_md: e.body_md || '',
      status: e.status || 'draft',
      published_at: e.published_at || null,
    };
  }

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <button onClick={() => setEditing({ status: 'draft', title: '', slug: '', excerpt: '', body_md: '' })} className="btn-primary">
          New post
        </button>
      </div>
      {editing && (
        <div className="card mb-6 space-y-3">
          <Field label="Title"><input className="input" value={editing.title} onChange={(e) => setEditing({ ...editing, title: e.target.value })} /></Field>
          <Field label="Slug"><input className="input font-mono" value={editing.slug} onChange={(e) => setEditing({ ...editing, slug: e.target.value })} /></Field>
          <Field label="Excerpt"><input className="input" value={editing.excerpt} onChange={(e) => setEditing({ ...editing, excerpt: e.target.value })} /></Field>
          <Field label="Body (markdown)"><textarea rows={10} className="input font-mono text-xs" value={editing.body_md} onChange={(e) => setEditing({ ...editing, body_md: e.target.value })} /></Field>
          <Field label="Status">
            <select className="input" value={editing.status} onChange={(e) => setEditing({ ...editing, status: e.target.value })}>
              <option value="draft">draft</option>
              <option value="published">published</option>
            </select>
          </Field>
          <div className="flex gap-2">
            <button onClick={save} className="btn-primary">Save</button>
            <button onClick={() => setEditing(null)} className="btn-ghost">Cancel</button>
          </div>
        </div>
      )}
      <table className="w-full text-sm">
        <thead className="border-b border-charcoal/10 text-left font-mono text-xs uppercase text-charcoal/50">
          <tr><th className="py-2">Title</th><th>Slug</th><th>Status</th><th></th></tr>
        </thead>
        <tbody>
          {items.map((p) => (
            <tr key={p.slug} className="border-b border-charcoal/5">
              <td className="py-3 font-semibold">{p.title}</td>
              <td className="font-mono text-xs">{p.slug}</td>
              <td><StatusBadge status={p.status} /></td>
              <td className="text-right">
                <button onClick={() => setEditing(p)} className="mr-2 text-charcoal hover:text-gold">Edit</button>
                <button onClick={() => actions.deletePost.mutate(p.slug)} className="text-red-600 hover:underline">Delete</button>
              </td>
            </tr>
          ))}
          {items.length === 0 && <tr><td colSpan={4} className="py-6 text-center text-charcoal/50">No posts yet.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

function KitsPanel({ data, actions }) {
  const [editing, setEditing] = useState(null);
  async function save() {
    const payload = {
      slug: editing.slug,
      title: editing.title,
      tagline: editing.tagline || '',
      description_md: editing.description_md || '',
      price_cents: parseInt(editing.price_dollars || '0', 10) * 100,
      stripe_price_id: editing.stripe_price_id || null,
      features_json: JSON.stringify(
        (editing.features || '').split('\n').map((s) => s.trim()).filter(Boolean)
      ),
      demo_slug: editing.demo_slug || null,
      status: editing.status || 'draft',
    };
    if (editing.id) await actions.updateKit.mutateAsync({ slug: editing.slug, ...payload });
    else await actions.createKit.mutateAsync(payload);
    setEditing(null);
  }
  return (
    <div>
      <div className="mb-4 flex justify-end">
        <button
          onClick={() => setEditing({ status: 'draft', title: '', slug: '', tagline: '', description_md: '', price_dollars: '49', features: '', demo_slug: '' })}
          className="btn-primary"
        >
          New kit
        </button>
      </div>
      {editing && (
        <div className="card mb-6 space-y-3">
          <Field label="Title"><input className="input" value={editing.title} onChange={(e) => setEditing({ ...editing, title: e.target.value })} /></Field>
          <Field label="Slug"><input className="input font-mono" value={editing.slug} onChange={(e) => setEditing({ ...editing, slug: e.target.value })} /></Field>
          <Field label="Tagline"><input className="input" value={editing.tagline} onChange={(e) => setEditing({ ...editing, tagline: e.target.value })} /></Field>
          <Field label="Price (USD)"><input className="input" type="number" value={editing.price_dollars} onChange={(e) => setEditing({ ...editing, price_dollars: e.target.value })} /></Field>
          <Field label="Stripe price ID (optional)"><input className="input font-mono text-xs" value={editing.stripe_price_id || ''} onChange={(e) => setEditing({ ...editing, stripe_price_id: e.target.value })} placeholder="price_xxx" /></Field>
          <Field label="Description (markdown)"><textarea rows={6} className="input font-mono text-xs" value={editing.description_md} onChange={(e) => setEditing({ ...editing, description_md: e.target.value })} /></Field>
          <Field label="Features (one per line)"><textarea rows={4} className="input" value={editing.features} onChange={(e) => setEditing({ ...editing, features: e.target.value })} /></Field>
          <Field label="Demo slug"><input className="input font-mono" value={editing.demo_slug || ''} onChange={(e) => setEditing({ ...editing, demo_slug: e.target.value })} /></Field>
          <Field label="Status">
            <select className="input" value={editing.status} onChange={(e) => setEditing({ ...editing, status: e.target.value })}>
              <option value="draft">draft</option>
              <option value="published">published</option>
            </select>
          </Field>
          <div className="flex gap-2">
            <button onClick={save} className="btn-primary">Save</button>
            <button onClick={() => setEditing(null)} className="btn-ghost">Cancel</button>
          </div>
        </div>
      )}
      <table className="w-full text-sm">
        <thead className="border-b border-charcoal/10 text-left font-mono text-xs uppercase text-charcoal/50">
          <tr><th className="py-2">Title</th><th>Slug</th><th>Price</th><th>Status</th><th></th></tr>
        </thead>
        <tbody>
          {data.map((k) => (
            <tr key={k.slug} className="border-b border-charcoal/5">
              <td className="py-3 font-semibold">{k.title}</td>
              <td className="font-mono text-xs">{k.slug}</td>
              <td>${(k.price_cents / 100).toFixed(0)}</td>
              <td><StatusBadge status={k.status} /></td>
              <td className="text-right">
                <button onClick={() => setEditing({ ...k, price_dollars: (k.price_cents / 100).toFixed(0), features: (() => { try { return (JSON.parse(k.features_json || '[]')).join('\n'); } catch { return ''; } })() })} className="mr-2 hover:text-gold">Edit</button>
                <button onClick={() => actions.deleteKit.mutate(k.slug)} className="text-red-600 hover:underline">Delete</button>
              </td>
            </tr>
          ))}
          {data.length === 0 && <tr><td colSpan={5} className="py-6 text-center text-charcoal/50">No kits yet.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

function DemosPanel({ data, actions }) {
  const [editing, setEditing] = useState(null);
  async function save() {
    const payload = {
      slug: editing.slug,
      title: editing.title,
      html: editing.html || '',
      kit_slug: editing.kit_slug || null,
      status: editing.status || 'draft',
    };
    if (editing.id) await actions.updateDemo.mutateAsync({ slug: editing.slug, ...payload });
    else await actions.createDemo.mutateAsync(payload);
    setEditing(null);
  }
  return (
    <div>
      <div className="mb-4 flex justify-end">
        <button onClick={() => setEditing({ status: 'draft', title: '', slug: '', html: '', kit_slug: '' })} className="btn-primary">
          New demo
        </button>
      </div>
      {editing && (
        <div className="card mb-6 space-y-3">
          <Field label="Title"><input className="input" value={editing.title} onChange={(e) => setEditing({ ...editing, title: e.target.value })} /></Field>
          <Field label="Slug"><input className="input font-mono" value={editing.slug} onChange={(e) => setEditing({ ...editing, slug: e.target.value })} /></Field>
          <Field label="Linked kit slug"><input className="input font-mono" value={editing.kit_slug || ''} onChange={(e) => setEditing({ ...editing, kit_slug: e.target.value })} /></Field>
          <Field label="HTML (raw)"><textarea rows={12} className="input font-mono text-xs" value={editing.html} onChange={(e) => setEditing({ ...editing, html: e.target.value })} /></Field>
          <Field label="Status">
            <select className="input" value={editing.status} onChange={(e) => setEditing({ ...editing, status: e.target.value })}>
              <option value="draft">draft</option>
              <option value="published">published</option>
            </select>
          </Field>
          <div className="flex gap-2">
            <button onClick={save} className="btn-primary">Save</button>
            <button onClick={() => setEditing(null)} className="btn-ghost">Cancel</button>
          </div>
        </div>
      )}
      <table className="w-full text-sm">
        <thead className="border-b border-charcoal/10 text-left font-mono text-xs uppercase text-charcoal/50">
          <tr><th className="py-2">Title</th><th>Slug</th><th>Kit</th><th>Status</th><th></th></tr>
        </thead>
        <tbody>
          {data.map((d) => (
            <tr key={d.slug} className="border-b border-charcoal/5">
              <td className="py-3 font-semibold">{d.title}</td>
              <td className="font-mono text-xs">{d.slug}</td>
              <td className="font-mono text-xs">{d.kit_slug || '—'}</td>
              <td><StatusBadge status={d.status} /></td>
              <td className="text-right">
                <button onClick={() => setEditing(d)} className="mr-2 hover:text-gold">Edit</button>
                <button onClick={() => actions.deleteDemo.mutate(d.slug)} className="text-red-600 hover:underline">Delete</button>
              </td>
            </tr>
          ))}
          {data.length === 0 && <tr><td colSpan={5} className="py-6 text-center text-charcoal/50">No demos yet.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

function AppsPanel({ data }) {
  if (data.length === 0) return <p className="py-6 text-center text-charcoal/50">No applications yet.</p>;
  return (
    <div className="space-y-3">
      {data.map((a) => (
        <div key={a.id} className="card">
          <div className="mb-2 flex items-center justify-between">
            <p className="font-bold">{a.name} <span className="font-normal text-charcoal/60">— {a.email}</span></p>
            <p className="font-mono text-xs text-charcoal/50">{new Date(a.created_at).toLocaleString()}</p>
          </div>
          {a.company && <p className="text-sm text-charcoal/60">Company: {a.company}</p>}
          {a.budget && <p className="text-sm text-charcoal/60">Budget: {a.budget}</p>}
          <p className="mt-3 whitespace-pre-wrap text-sm">{a.brief}</p>
        </div>
      ))}
    </div>
  );
}
