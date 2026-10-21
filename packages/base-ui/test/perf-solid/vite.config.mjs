import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import solid from '@solidjs/vite-plugin';
import { defineConfig } from 'vite';

const here = path.dirname(fileURLToPath(import.meta.url));
const base = path.resolve(here, '../../packages');
// Builds live outside the repo tree (gitignored scratch): `<repo>/.tmp/grunt/bench-builds/<lib>/<OUT>`.
const builds = path.resolve(here, '../../../../.tmp/grunt/bench-builds');
const lib = process.env.LIB;
const solidSrc = process.env.SOLID_SRC || path.join(base, 'solid/src');
export default defineConfig({
  root: path.join(here, lib),
  // BENCH_DEV=1 builds with the development runtime (for diffing dev-only vs production-only behavior).
  mode: process.env.BENCH_DEV ? 'development' : 'production',
  base: './',
  define: { 'process.env.NODE_ENV': process.env.BENCH_DEV ? '"development"' : '"production"' },
  plugins: [lib === 'react' ? react() : solid()],
  resolve: {
    // The dev runtime of solid-js / @solidjs/web resolves through the `development` condition.
    ...(process.env.BENCH_DEV ? { conditions: ['solid', 'module', 'browser', 'development'] } : {}),
    alias: {
      '@base-ui/react': path.join(base, 'react/src'),
      '@base-ui/utils': path.join(base, 'utils/src'),
      '@solidports/base-ui': solidSrc,
      // The raw-Solid floors are the harness's (D31): always the working tree's, whatever library
      // variant this build bundles. They import nothing from the library.
      '@solidports/base-ui-floor': path.join(base, 'solid/test/floor'),
    },
    // One reactive core even when SOLID_SRC points at a baseline copy of the source.
    dedupe: ['react', 'react-dom', 'solid-js', '@solidjs/web', '@solidjs/signals'],
  },
  build: {
    outDir: path.join(builds, lib, process.env.OUT || 'dist'),
    emptyOutDir: true,
    minify: process.env.MINIFY !== '0',
    // The profiling pass (`attribution.mjs`) maps samples back to the source.
    sourcemap: process.env.SOURCEMAP === '1',
    chunkSizeWarningLimit: 99999,
  },
  logLevel: 'warn',
});
