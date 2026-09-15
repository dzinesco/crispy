// Publish markdown in content/blog to the API.
// Usage: node scripts/seed-posts.mjs [apiBase] [email] [password]
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

const API = process.argv[2] || 'http://127.0.0.1:3102';
const EMAIL = process.argv[3] || process.env.ADMIN_EMAIL || 'tm@crispygoat.com';
const PASSWORD = process.argv[4] || process.env.ADMIN_PASSWORD || 'changeme';
const DIR = path.resolve('content/blog');

function parseFrontmatter(raw) {
  const m = raw.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!m) return { meta: {}, body: raw.trim() };
  const meta = {};
  for (const line of m[1].split('\n')) {
    const kv = line.match(/^([a-zA-Z0-9_]+):\s*(.*)$/);
    if (!kv) continue;
    let val = kv[2].trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    meta[kv[1]] = val;
  }
  return { meta, body: m[2].trim() };
}

function slugFromFile(file) {
  return path.basename(file, '.md');
}

async function main() {
  const login = await fetch(`${API}/api/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });
  if (!login.ok) throw new Error(`login ${login.status}: ${await login.text()}`);
  const cookie = login.headers.get('set-cookie')?.split(';')[0];
  if (!cookie) throw new Error('no session cookie');

  const files = (await readdir(DIR)).filter((f) => f.endsWith('.md')).sort();
  for (const file of files) {
    const raw = await readFile(path.join(DIR, file), 'utf8');
    const { meta, body } = parseFrontmatter(raw);
    const slug = slugFromFile(file);
    const title = meta.title || slug;
    const payload = {
      slug,
      title,
      excerpt: meta.description || '',
      body_md: body,
      cover_image: meta.heroImage || null,
      status: 'published',
      published_at: meta.pubDate ? new Date(meta.pubDate).toISOString() : new Date().toISOString(),
    };

    const existing = await fetch(`${API}/api/admin/posts`, { headers: { cookie } });
    const { posts } = await existing.json();
    const found = (posts || []).find((p) => p.slug === slug);
    const url = found ? `${API}/api/admin/posts/${slug}` : `${API}/api/admin/posts`;
    const method = found ? 'PUT' : 'POST';
    const res = await fetch(url, {
      method,
      headers: { 'content-type': 'application/json', cookie },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(`${method} ${slug} → ${res.status} ${await res.text()}`);
    console.log(`${found ? 'updated' : 'created'} ${slug}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
