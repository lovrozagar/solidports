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
        renderMode: 'async',
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
    ],
  },
  // Bundled for the server too: the Solid packages share the app's `solid-js` (one context
  // registry).
  ssr: { noExternal: ['@solidjs/router'] },
  server: {
    port: 3001,
    // docs-infra writes a component's `types.md` as it loads its types; the file is its output,
    // not a module.
    watch: { ignored: ['**/types.md'] },
  },
}));
