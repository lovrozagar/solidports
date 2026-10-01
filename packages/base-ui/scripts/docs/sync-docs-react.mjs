#!/usr/bin/env bun
/**
 * Clone mui/base-ui@DOCS_TAG and copy its `docs/` tree into `docs/react` 1:1.
 * Only path/workspace overlays are applied so Next can run inside this monorepo.
 *
 *   bun run docs:sync
 */
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const FORK = join(HERE, '../..');
const DEST = join(FORK, 'docs/react');
const TAG = process.env.DOCS_TAG ?? 'v1.8.0';
const CACHE =
  process.env.DOCS_UPSTREAM_CACHE ??
  (existsSync('/tmp/base-ui-v1.8.0/docs/src') && TAG === 'v1.8.0'
    ? '/tmp/base-ui-v1.8.0'
    : `/tmp/base-ui-docs-${TAG}`);

function run(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, { stdio: 'inherit', ...opts });
  if (r.status !== 0) process.exit(r.status ?? 1);
}

function ensureUpstream() {
  if (existsSync(join(CACHE, 'docs/src'))) {
    console.log(`using cached ${CACHE}`);
    return;
  }
  console.log(`cloning mui/base-ui@${TAG} → ${CACHE}`);
  mkdirSync(CACHE, { recursive: true });
  run('git', [
    'clone',
    '--depth',
    '1',
    '--branch',
    TAG,
    '--filter=blob:none',
    '--sparse',
    'https://github.com/mui/base-ui.git',
    CACHE,
  ]);
  run('git', ['sparse-checkout', 'set', 'docs'], { cwd: CACHE });
}

function rsyncDir(from, to) {
  mkdirSync(to, { recursive: true });
  run('rsync', [
    '-a',
    '--delete',
    '--exclude',
    'node_modules',
    '--exclude',
    '.next',
    '--exclude',
    'export',
    `${from}/`,
    `${to}/`,
  ]);
}

function overlayNextConfig() {
  const file = join(DEST, 'next.config.mjs');
  let t = readFileSync(file, 'utf8');
  t = t.replace(
    "path.resolve(currentDirectory, '../')",
    "path.resolve(currentDirectory, '../..')",
  );
  t = t.replace(
    "fs.readFileSync(path.resolve(workspaceRoot, 'package.json'), 'utf8')",
    "fs.readFileSync(path.resolve(workspaceRoot, 'packages/react/package.json'), 'utf8')",
  );
  if (!t.includes('outputFileTracingRoot')) {
    t = t.replace(
      'const nextConfig = {',
      `const nextConfig = {\n  outputFileTracingRoot: currentDirectory,\n  typescript: { ignoreBuildErrors: true },`,
    );
  }
  if (!t.includes('docs: currentDirectory')) {
    t = t.replace(
      'turbopack: {',
      `turbopack: {\n    resolveAlias: { docs: currentDirectory },`,
    );
    t = t.replace(
      'webpack: (config, { defaultLoaders }) => {',
      `webpack: (config, { defaultLoaders }) => {\n    config.resolve.alias = { ...config.resolve.alias, docs: currentDirectory };`,
    );
  }
  writeFileSync(file, t);
}

function overlayTsconfig() {
  const file = join(DEST, 'tsconfig.json');
  let t = readFileSync(file, 'utf8');
  t = t.replaceAll('"../tsconfig.base.json"', '"../../tsconfig.base.json"');
  t = t.replaceAll('"../packages/', '"../../packages/');
  writeFileSync(file, t);
}

function overlayPackageJson() {
  const file = join(DEST, 'package.json');
  const pkg = JSON.parse(readFileSync(file, 'utf8'));
  pkg.name = 'docs';
  pkg.private = true;
  for (const [k, v] of Object.entries(pkg.scripts ?? {})) {
    pkg.scripts[k] = String(v).replaceAll('pnpm ', 'bun ');
  }
  if (pkg.scripts?.dev && !pkg.scripts.dev.includes('--webpack')) {
    pkg.scripts.dev = 'next dev --webpack --port 3005';
  }
  // typescript6 is ESM-only; Next's CJS loader sees an empty module (no sys / readConfigFile).
  pkg.devDependencies = pkg.devDependencies ?? {};
  pkg.devDependencies.typescript = '5.9.2';
  writeFileSync(file, `${JSON.stringify(pkg, null, 2)}\n`);
}

ensureUpstream();
const src = join(CACHE, 'docs');
if (!existsSync(join(src, 'src'))) {
  console.error(`upstream docs/src missing at ${src}`);
  process.exit(1);
}

console.log(`copy ${src} → ${DEST} (full docs tree)`);
rsyncDir(src, DEST);
overlayNextConfig();
overlayTsconfig();
overlayPackageJson();
writeFileSync(join(DEST, '.upstream-tag'), `${TAG}\n`);
console.log(`docs/react is mui/base-ui@${TAG} docs + path overlay`);
console.log('next: bun install && bun run docs:generate');
