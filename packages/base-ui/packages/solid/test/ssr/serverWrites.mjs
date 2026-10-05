// Server-renders Solid docs demos and reports every `[SERVER_WRITE]` dev finding with the library
// frames that made the write. Solid reports each write category once per process, so the caller
// runs one process per group of demos that must be checked independently.
// Usage: node serverWrites.mjs <absolute demo index.tsx>...   → JSON on stdout:
//   { "<demo file>": [{ "message": string, "frames": string[] }] }
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import solidPlugin from '@solidjs/vite-plugin';
import { createServer } from 'vite';

const here = dirname(fileURLToPath(import.meta.url));
const pkg = resolve(here, '../..');
const files = process.argv.slice(2);

let current = '';
const writes = {};
const originalWarn = console.warn;
console.warn = (...args) => {
  const message = String(args[0] ?? '');
  // The first report carries the repair-guide footer in the same message; a footer-only line
  // (`[SERVER_WRITE] repair guide: …`) is not a write.
  if (message.startsWith('[SERVER_WRITE]') && !message.startsWith('[SERVER_WRITE] repair guide')) {
    Error.stackTraceLimit = 80;
    const frames = (new Error().stack ?? '')
      .split('\n')
      .filter((line) => line.includes('/packages/solid/src/'))
      .map((line) =>
        line
          .trim()
          .replace(/.*\/packages\/solid\/src\//, '')
          .replace(/\)$/, ''),
      )
      .slice(0, 6);
    (writes[current] ??= []).push({ message: message.split('\n')[0].slice(0, 160), frames });
    return;
  }
  if (message.startsWith('[SERVER_WRITE]')) {
    return;
  }
  originalWarn(...args);
};

const server = await createServer({
  appType: 'custom',
  cacheDir: join(tmpdir(), 'solidports-ssr-purity'),
  configFile: false,
  logLevel: 'silent',
  optimizeDeps: { noDiscovery: true },
  plugins: [solidPlugin({ ssr: true })],
  resolve: { alias: { '@solidports/base-ui': resolve(pkg, 'src') } },
  root: resolve(pkg, '../..'),
  server: { hmr: false, middlewareMode: true, watch: null },
});
try {
  const web = await server.ssrLoadModule('@solidjs/web');
  for (const file of files) {
    current = file;
    try {
      const mod = await server.ssrLoadModule(file);
      web.renderToString(() => web.createComponent(mod.default, {}));
    } catch (error) {
      (writes[file] ??= []).push({
        message: `render failed: ${String(error?.message ?? error).slice(0, 200)}`,
        frames: [],
      });
    }
  }
} finally {
  await server.close();
}
process.stdout.write(JSON.stringify(writes));
