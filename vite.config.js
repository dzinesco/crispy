import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));

const DEMO_MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.json': 'application/json',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
};

// Static apps in public/demo/<slug>/ are real files, not React routes.
// Dev and preview serve them before the SPA fallback. Production nginx
// already does this with `try_files $uri $uri/ /index.html`.
function serveDemoApps() {
  const demoRoot = path.resolve(root, 'public/demo');

  const handler = (req, res, next) => {
    const raw = req.url || '';
    const q = raw.indexOf('?');
    let pathname = q === -1 ? raw : raw.slice(0, q);
    const search = q === -1 ? '' : raw.slice(q);
    try {
      pathname = decodeURIComponent(pathname);
    } catch {
      return next();
    }
    if (!pathname.startsWith('/demo/')) return next();

    const rel = pathname.slice('/demo/'.length);
    const resolved = path.resolve(demoRoot, rel);
    const demoPrefix = demoRoot.endsWith(path.sep) ? demoRoot : demoRoot + path.sep;
    if (resolved !== demoRoot && !resolved.startsWith(demoPrefix)) return next();

    let file = resolved;
    let stat = fs.existsSync(file) ? fs.statSync(file) : null;
    if (stat?.isDirectory()) {
      if (!pathname.endsWith('/')) {
        res.statusCode = 308;
        res.setHeader('Location', pathname + '/' + search);
        res.end();
        return;
      }
      file = path.join(file, 'index.html');
      stat = fs.existsSync(file) ? fs.statSync(file) : null;
    } else if (!stat && !path.extname(resolved)) {
      const index = path.join(resolved, 'index.html');
      if (fs.existsSync(index)) {
        res.statusCode = 308;
        res.setHeader('Location', pathname + '/' + search);
        res.end();
        return;
      }
    }
    if (!stat?.isFile()) return next();

    res.setHeader('Content-Type', DEMO_MIME[path.extname(file)] || 'application/octet-stream');
    fs.createReadStream(file).pipe(res);
  };

  return {
    name: 'serve-demo-apps',
    configureServer(server) {
      server.middlewares.use(handler);
    },
    configurePreviewServer(server) {
      server.middlewares.use(handler);
    },
  };
}

export default defineConfig({
  plugins: [serveDemoApps(), react()],
  server: {
    port: 5173,
    host: '0.0.0.0',
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:3102',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
});
