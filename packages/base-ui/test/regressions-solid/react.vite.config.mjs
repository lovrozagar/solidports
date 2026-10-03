// Builds the React regressions host (`react/main.tsx`: the upstream host adapted to the fork's docs
// layout) for the visual comparison with the Solid host. Vite 8 rejects the shared config's `null`
// aliases (`stream`, `zlib`), so they are dropped here instead of editing the upstream config.
import * as path from 'path';
import { defineConfig, mergeConfig } from 'vite';
import sharedConfig from '../vite.shared.config.mjs';

// The host imports `docs/src/styles.css` and the shared config aliases `./fonts` to `src/fonts`;
// the docs snapshot keeps both under `src/css/` (its relative imports resolve on their own).
// `docs/src/*` imports resolve into the docs snapshot (`docs/react/src`).
const alias = [
  {
    find: /^docs\/src\/styles\.css$/,
    replacement: path.join(process.cwd(), 'docs/react/src/css/index.css'),
  },
  { find: /^docs\/src\//, replacement: `${path.join(process.cwd(), 'docs/react/src')}/` },
  ...Object.entries(sharedConfig.resolve?.alias ?? {})
    .filter(([find, value]) => value != null && find !== './fonts')
    .map(([find, replacement]) => ({ find, replacement })),
];

export default mergeConfig(
  // One React for the host and the demos (the docs snapshot has its own install).
  { ...sharedConfig, resolve: { ...sharedConfig.resolve, alias, dedupe: ['react', 'react-dom'] } },
  defineConfig({
    root: path.join(process.cwd(), 'test/regressions-solid/react'),
    build: { outDir: 'build', emptyOutDir: true },
  }),
);
