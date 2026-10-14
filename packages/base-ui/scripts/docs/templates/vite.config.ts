// The Solid docs: the generated sources (`src`, `docs-infra`, `base-ui-utils`) served by Solid's
// start mode, with Next's app router and the docs' `next.config.mjs` applied by `framework/vite`.
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import solid from '@solidjs/vite-plugin';
import { nextApp } from './framework/vite';

const root = fileURLToPath(new URL('.', import.meta.url));
const at = (relative: string) => fileURLToPath(new URL(relative, import.meta.url));

export default defineConfig(async () => ({
  root,
  plugins: [
    ...(await nextApp(root)),
    solid({
      start: {
        app: 'framework/App.tsx',
        document: 'framework/Document.tsx',
        // A page's metadata reaches the head before the document is sent.
        renderMode: 'stream',
      },
      ssr: true,
      extensions: ['.mdx', '.md'],
    }),
  ],
  resolve: {
    alias: [
      { find: /^docs\//, replacement: root },
      { find: /^@mui\/internal-docs-infra\/(.*)$/, replacement: `${at('./docs-infra/src/')}$1` },
      { find: /^@base-ui\/utils\/(.*)$/, replacement: `${at('./base-ui-utils/src/')}$1` },
      { find: /^@solidports\/base-ui$/, replacement: at('../../packages/solid/src/index.ts') },
      { find: /^@solidports\/base-ui\/(.*)$/, replacement: `${at('../../packages/solid/src/')}$1` },
      {
        find: /^@solidjs\/web\/jsx-(dev-)?runtime$/,
        replacement: at('./src/adapters/jsx-runtime.ts'),
      },
      // Packages built for Solid 1 (`lucide-solid`).
      { find: /^solid-js\/web$/, replacement: at('./src/adapters/solid-js-web.ts') },
      { find: /^solid-js\/store$/, replacement: 'solid-js' },
    ],
  },
  // Bundled for the server too, so its `solid-js/web` imports take the alias.
  ssr: { noExternal: ['lucide-solid'] },
  optimizeDeps: { exclude: ['lucide-solid'] },
  server: { port: 3001 },
}));
