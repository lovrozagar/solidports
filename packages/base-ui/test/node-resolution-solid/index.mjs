/* eslint-disable no-console */
// The package ships Solid source (`src`, uncompiled JSX), which a Solid app compiles: Node resolves
// its exports, and a Solid app's server build (Vite with `@solidjs/vite-plugin`) loads them.
import { existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import solidPlugin from '@solidjs/vite-plugin';
import { createServer } from 'vite';

// The package's manifest, found from its resolved root entry (`./package.json` is not exported).
let packageRoot = dirname(fileURLToPath(import.meta.resolve('@solidports/base-ui')));
while (!existsSync(join(packageRoot, 'package.json'))) {
  packageRoot = dirname(packageRoot);
}
const { exports } = JSON.parse(readFileSync(join(packageRoot, 'package.json'), 'utf8'));
// Subpaths that only export types have no runtime exports.
const TYPE_ONLY_SUBPATHS = new Set(['./types', './internals/types', './internals/temporal']);

const failures = [];
const subpaths = Object.keys(exports).filter((subpath) => subpath !== './package.json');

// Node's resolver, as a consumer's tooling resolves the package.
for (const subpath of subpaths) {
  const specifier = `@solidports/base-ui${subpath.slice(1)}`;
  try {
    import.meta.resolve(specifier);
  } catch (error) {
    failures.push(`${specifier}: does not resolve in Node (${error.message})`);
  }
}

const server = await createServer({
  appType: 'custom',
  cacheDir: join(tmpdir(), 'solidports-node-resolution'),
  configFile: false,
  logLevel: 'silent',
  optimizeDeps: { noDiscovery: true },
  plugins: [solidPlugin({ ssr: true })],
  server: { hmr: false, middlewareMode: true, watch: null },
});
try {
  const base = await server.ssrLoadModule('@solidports/base-ui');
  const { Accordion } = await server.ssrLoadModule('@solidports/base-ui/accordion');
  console.assert(base, 'base');
  console.assert(Accordion, 'Accordion');

  for (const subpath of subpaths.filter((path) => !TYPE_ONLY_SUBPATHS.has(path))) {
    const specifier = `@solidports/base-ui${subpath.slice(1)}`;
    try {
      // eslint-disable-next-line no-await-in-loop -- one Vite server loads one module at a time
      const module = await server.ssrLoadModule(specifier);
      if (Object.keys(module).length === 0) {
        failures.push(`${specifier}: loads with no exports`);
      }
    } catch (error) {
      const where = error.stack?.split('\n').find((line) => line.includes('/src/'));
      failures.push(`${specifier}: does not load (${error.message})${where ? `\n  ${where.trim()}` : ''}`);
    }
  }
} finally {
  await server.close();
}

if (failures.length > 0) {
  console.error(failures.join('\n'));
  process.exit(1);
}
console.log(`${subpaths.length} export paths resolve and load.`);
