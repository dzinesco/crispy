import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

const root = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root,
  base: '/demo/goatshop/',
  publicDir: path.join(root, 'public'),
  build: {
    outDir: path.resolve(root, '../../public/demo/goatshop'),
    emptyOutDir: true,
    sourcemap: false,
    assetsDir: 'assets',
    target: 'es2020',
  },
});
