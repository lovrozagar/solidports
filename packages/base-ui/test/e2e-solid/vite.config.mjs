import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import solid from '@solidjs/vite-plugin';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

const root = path.dirname(fileURLToPath(import.meta.url));

// The package resolves through its `exports` (the `solid` condition), as in a consumer app.
export default defineConfig({
  root,
  mode: process.env.NODE_ENV || 'development',
  plugins: [solid(), tailwindcss()],
  build: { outDir: 'build', chunkSizeWarningLimit: 9999 },
});
