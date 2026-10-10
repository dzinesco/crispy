// Syntax-check the site and the API, then lock the Latest ordering rules.
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { transform } from 'esbuild';
import { leadProject, mergeLatest } from '../src/lib/latest.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

async function walk(dir, acc = []) {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name === 'data') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) await walk(full, acc);
    else if (/\.(js|jsx|mjs)$/.test(entry.name)) acc.push(full);
  }
  return acc;
}

const files = [
  ...(await walk(path.join(root, 'src'))),
  ...(await walk(path.join(root, 'server', 'src'))),
  ...(await walk(path.join(root, 'scripts'))),
  path.join(root, 'public', 'demo', 'cad', 'app.js'),
];

let failed = 0;
for (const file of files) {
  const source = await readFile(file, 'utf8');
  const loader = file.endsWith('.jsx') ? 'jsx' : 'js';
  try {
    await transform(source, { loader, sourcefile: path.relative(root, file), jsx: 'automatic', format: 'esm' });
  } catch (error) {
    failed += 1;
    console.error(error.message);
  }
}

const projects = [
  { slug: 'other', title: 'Other', description: 'Later', shippedAt: '2026-11-01', demoHref: '/demo/other/', image: '/a.png' },
  { slug: 'cad', title: 'CAD', description: 'Board', shippedAt: '2026-10-10', demoHref: '/demo/cad/', image: '/c.png' },
];
assert.equal(leadProject(projects).slug, 'cad');
assert.equal(leadProject([]), null);
assert.equal(leadProject([{ slug: 'only', title: 'Only' }]).slug, 'only');

const items = mergeLatest(
  [
    { slug: 'old', title: 'Old', excerpt: 'e', published_at: '2026-01-01' },
    { slug: 'new', title: 'New', excerpt: 'e', published_at: '2026-10-10' },
  ],
  projects,
  3,
);
assert.deepEqual(items.map((item) => item.id), ['work:other', 'work:cad', 'post:new']);

const undated = mergeLatest([], [
  { slug: 'x', title: 'X', description: 'd' },
  { slug: 'cad', title: 'CAD', description: 'd', shippedAt: '2020-01-01' },
]);
assert.equal(undated[0].id, 'work:cad');
assert.equal(undated[1].id, 'work:x');

if (failed) {
  console.error(`lint failed (${failed} file${failed === 1 ? '' : 's'})`);
  process.exit(1);
}
console.log(`lint ok (${files.length} files)`);
