#!/usr/bin/env bun
/* eslint-disable no-console */
/**
 * Clone mui/base-ui@DOCS_TAG and copy its `docs/` tree into `docs/react` 1:1.
 * Only path/workspace overlays are applied so Next can run inside this monorepo.
 *
 * Also copies the source of `@mui/internal-docs-infra` (the docs' React runtime: code highlighting,
 * demos, types, search) into `docs/docs-infra`, at the mui/mui-public commit the version the docs
 * depend on was published from. The npm package ships compiled code; the Solid docs are generated
 * from this TypeScript source.
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
const TAG = process.env.DOCS_TAG ?? 'v1.9.0';
const CACHE =
  process.env.DOCS_UPSTREAM_CACHE ??
  (existsSync('/tmp/base-ui-v1.9.0/docs/src') && TAG === 'v1.9.0'
    ? '/tmp/base-ui-v1.9.0'
    : `/tmp/base-ui-docs-${TAG}`);

// `@mui/internal-docs-infra` 0.13.1-canary.7 (docs/react's dependency) was published from
// mui/mui-public 73b01ccc61 (committed 13:52Z, published 13:59Z on 2026-10-02). Update both together.
const DOCS_INFRA_VERSION = '0.13.1-canary.7';
const DOCS_INFRA_COMMIT = '73b01ccc61d2096ec1bac12c735482f8d056c917';
const DOCS_INFRA_DEST = join(FORK, 'docs/docs-infra');
const DOCS_INFRA_CACHE = `/tmp/mui-public-${DOCS_INFRA_COMMIT.slice(0, 10)}`;

function run(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, { stdio: 'inherit', ...opts });
  if (r.status !== 0) {
    process.exit(r.status ?? 1);
  }
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

function rsyncDir(from, to, excludes) {
  mkdirSync(to, { recursive: true });
  run('rsync', [
    '-a',
    '--delete',
    ...excludes.flatMap((pattern) => ['--exclude', pattern]),
    `${from}/`,
    `${to}/`,
  ]);
}

function overlayNextConfig() {
  const file = join(DEST, 'next.config.mjs');
  let t = readFileSync(file, 'utf8');
  t = t.replace("path.resolve(currentDirectory, '../')", "path.resolve(currentDirectory, '../..')");
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
    t = t.replace('turbopack: {', `turbopack: {\n    resolveAlias: { docs: currentDirectory },`);
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

function overlayVitestConfig() {
  const file = join(DEST, 'vitest.config.mts');
  if (!existsSync(file)) {
    return;
  }
  let t = readFileSync(file, 'utf8');
  t = t.replace("from '../vitest.shared.mts'", "from '../../vitest.shared.mts'");
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
  writeFileSync(file, `${JSON.stringify(pkg, null, 2)}\n`);
}

function syncDocsInfra() {
  const docsPackage = JSON.parse(readFileSync(join(DEST, 'package.json'), 'utf8'));
  const dependency = docsPackage.dependencies?.['@mui/internal-docs-infra'];
  if (dependency !== DOCS_INFRA_VERSION) {
    console.error(
      `docs/react depends on @mui/internal-docs-infra ${dependency}, but the source commit is pinned for ${DOCS_INFRA_VERSION}: update DOCS_INFRA_COMMIT.`,
    );
    process.exit(1);
  }
  if (!existsSync(join(DOCS_INFRA_CACHE, 'packages/docs-infra/src'))) {
    console.log(`fetching mui/mui-public@${DOCS_INFRA_COMMIT} → ${DOCS_INFRA_CACHE}`);
    mkdirSync(DOCS_INFRA_CACHE, { recursive: true });
    run('git', ['init', '-q'], { cwd: DOCS_INFRA_CACHE });
    run('git', ['remote', 'add', 'origin', 'https://github.com/mui/mui-public.git'], {
      cwd: DOCS_INFRA_CACHE,
    });
    run('git', ['sparse-checkout', 'set', 'packages/docs-infra'], { cwd: DOCS_INFRA_CACHE });
    run('git', ['fetch', '-q', '--depth', '1', '--filter=blob:none', 'origin', DOCS_INFRA_COMMIT], {
      cwd: DOCS_INFRA_CACHE,
    });
    run('git', ['checkout', '-q', 'FETCH_HEAD'], { cwd: DOCS_INFRA_CACHE });
  }
  // The package's own tests and their setup stay upstream: the generator reads the runtime only.
  rsyncDir(join(DOCS_INFRA_CACHE, 'packages/docs-infra'), DOCS_INFRA_DEST, [
    'node_modules',
    '*.test.ts',
    '*.test.tsx',
    '__snapshots__',
    '/vitest.config.mts',
    '/vitest.setup.ts',
  ]);
  writeFileSync(
    join(DOCS_INFRA_DEST, '.upstream-commit'),
    `mui/mui-public@${DOCS_INFRA_COMMIT} (@mui/internal-docs-infra ${DOCS_INFRA_VERSION})\n`,
  );
}

ensureUpstream();
const src = join(CACHE, 'docs');
if (!existsSync(join(src, 'src'))) {
  console.error(`upstream docs/src missing at ${src}`);
  process.exit(1);
}

console.log(`copy ${src} → ${DEST} (full docs tree)`);
rsyncDir(src, DEST, [
  'node_modules',
  '.next',
  'export',
  // Written by `next dev` (not upstream files): leave them to Next.
  '/AGENTS.md',
  '/CLAUDE.md',
  '/next-env.d.ts',
]);
overlayNextConfig();
overlayTsconfig();
overlayVitestConfig();
overlayPackageJson();
writeFileSync(join(DEST, '.upstream-tag'), `${TAG}\n`);
syncDocsInfra();
// The copy brings upstream's `error-codes.json`; the fork's lists the Solid package's errors.
console.log('extract-error-codes → docs/react/src/error-codes.json');
run('bun', ['run', 'extract-error-codes'], { cwd: FORK });
console.log(`docs/react is mui/base-ui@${TAG} docs + path overlay`);
console.log('next: bun install && bun run docs:generate');
