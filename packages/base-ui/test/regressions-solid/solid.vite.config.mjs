// Builds the Solid regressions host (`solid/`): every generated Solid docs demo at the route the
// React host (`react/`) gives its React counterpart, so the upstream screenshot spec produces
// comparable images from both. The package resolves through its exports, as in a consumer app.
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import solid from '@solidjs/vite-plugin';
import { defineConfig } from 'vite';

const here = path.dirname(fileURLToPath(import.meta.url));
const reactDocs = path.resolve(here, '../../docs/react/src/app/(docs)/react');

function walk(dir) {
  return fs.readdirSync(dir).flatMap((entry) => {
    const full = path.join(dir, entry);
    return fs.statSync(full).isDirectory() ? walk(full) : [full];
  });
}

// React demo `<section>/<name>/demos/<demo>/<variant>/index.tsx` is routed as
// `/docs-<section>-<name>-demos-<demo>-<variant>/index.tsx` (the React host's naming); the
// generated Solid demo lives at `<name>/<demo>/<variant>` (`handbook/<name>/...` for handbook pages).
const routes = {};
for (const file of walk(reactDocs)) {
  const relative = path.relative(reactDocs, file).split(path.sep);
  if (relative.length !== 6 || relative[2] !== 'demos' || relative[5] !== 'index.tsx') {
    continue;
  }
  const [section, name, , demo, variant] = relative;
  const solidDir = [section === 'handbook' ? 'handbook' : null, name, demo, variant]
    .filter(Boolean)
    .join('/');
  routes[solidDir] = `/docs-${section}-${name}-demos-${demo}-${variant}/index.tsx`;
}

export default defineConfig({
  root: path.join(here, 'solid'),
  mode: process.env.NODE_ENV || 'development',
  plugins: [solid()],
  define: { __REGRESSION_ROUTES__: JSON.stringify(routes) },
  build: { outDir: 'build', emptyOutDir: true, chunkSizeWarningLimit: 9999 },
});
