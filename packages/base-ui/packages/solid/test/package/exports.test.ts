import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { builtinModules } from 'node:module';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, describe, it } from 'vitest';
import { isJSDOM } from '#test-utils';

// The package ships its `src` (uncompiled Solid JSX) plus emitted declarations in `types`.
const PACKAGE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const SRC_ROOT = join(PACKAGE_ROOT, 'src');

const packageJson = JSON.parse(readFileSync(join(PACKAGE_ROOT, 'package.json'), 'utf8')) as {
  exports: Record<string, { types: string; solid: string; default: string }>;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
  bundleDependencies?: string[];
  bundledDependencies?: string[];
  peerDependencies?: Record<string, string>;
};

// Subpaths that only export types have no runtime exports.
const TYPE_ONLY_SUBPATHS = new Set(['./types', './internals/types', './internals/temporal']);
const SOURCE_FILE = /\.tsx?$/;
// Mirrors the `files` exclusions in package.json.
const TEST_FILE = /(\.(test|spec|ssr-fixtures)\.tsx?|\/test-utils\.tsx?)$/;
const IMPORT_SPECIFIER =
  /(?:^|[\s;])(?:import|export)\s(?:[^'"]*?\sfrom\s)?['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)/g;

function listRuntimeFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) {
      return listRuntimeFiles(path);
    }
    return SOURCE_FILE.test(entry) && !TEST_FILE.test(path) && !entry.endsWith('.d.ts')
      ? [path]
      : [];
  });
}

function packageName(specifier: string) {
  const parts = specifier.split('/');
  return specifier.startsWith('@') ? `${parts[0]}/${parts[1]}` : parts[0];
}

describe.skipIf(!isJSDOM)('package exports', () => {
  const entries = Object.entries(packageJson.exports);

  it('maps every subpath to a source file and a declaration file', () => {
    expect(entries.length).toBeGreaterThanOrEqual(80);
    entries.forEach(([subpath, target]) => {
      expect(target.default, `${subpath} default`).toMatch(/^\.\/src\/.+\.tsx?$/);
      expect(existsSync(join(PACKAGE_ROOT, target.default)), `${subpath} default exists`).toBe(
        true,
      );
      // The `solid` condition marks the package as Solid source for bundler plugins
      // (`@solidjs/vite-plugin` compiles it instead of pre-bundling it).
      expect(target.solid, `${subpath} solid`).toBe(target.default);
      expect(Object.keys(target), `${subpath} condition order`).toEqual([
        'types',
        'solid',
        'default',
      ]);
      expect(target.types, `${subpath} types`).toBe(
        target.default.replace(/^\.\/src\//, './types/').replace(/\.tsx?$/, '.d.ts'),
      );
      expect(existsSync(join(PACKAGE_ROOT, target.types)), `${subpath} types exists`).toBe(true);
    });
  });

  it('resolves every subpath with at least one export', async () => {
    await Promise.all(
      entries
        .filter(([subpath]) => !TYPE_ONLY_SUBPATHS.has(subpath))
        .map(async ([subpath]) => {
          const specifier = `@solidports/base-ui${subpath.slice(1)}`;
          const module = await import(/* @vite-ignore */ specifier);
          expect(Object.keys(module).length, `${specifier} exports`).toBeGreaterThan(0);
        }),
    );
  });

  it('has no dependencies of its own: every package it needs is a peer, installed for development', () => {
    expect(packageJson.dependencies, 'dependencies').toBe(undefined);
    expect(packageJson.optionalDependencies, 'optionalDependencies').toBe(undefined);
    expect(packageJson.bundleDependencies, 'bundleDependencies').toBe(undefined);
    expect(packageJson.bundledDependencies, 'bundledDependencies').toBe(undefined);
    const devDependencies = Object.keys(packageJson.devDependencies ?? {});
    Object.keys(packageJson.peerDependencies ?? {}).forEach((peer) => {
      expect(devDependencies, `${peer} in devDependencies`).toContain(peer);
    });
  });

  it('pins @solidjs/signals to the solid-js range', () => {
    // Native parts set context with `setContext`, which only `@solidjs/signals` exports. Sharing
    // the solid-js range keeps one installed core: production bundles dedupe it, and Vite dev's
    // second module instance (solid-js is pre-bundled, this source package is not) runs the same
    // file, so a context written on an owner reaches `useContext`.
    expect(packageJson.peerDependencies?.['@solidjs/signals']).toBe(
      packageJson.peerDependencies?.['solid-js'],
    );
  });

  it('only imports published files and peer dependencies', () => {
    const allowed = new Set(Object.keys(packageJson.peerDependencies ?? {}));
    const violations: string[] = [];

    listRuntimeFiles(SRC_ROOT).forEach((file) => {
      const source = readFileSync(file, 'utf8');
      for (const match of source.matchAll(IMPORT_SPECIFIER)) {
        const specifier = match[1] ?? match[2];
        const location = `${relative(PACKAGE_ROOT, file)} -> ${specifier}`;
        if (specifier.startsWith('.')) {
          const target = resolve(dirname(file), specifier);
          if (relative(SRC_ROOT, target).startsWith('..')) {
            violations.push(location);
          }
        } else if (
          specifier.startsWith('#') ||
          specifier.startsWith('node:') ||
          builtinModules.includes(specifier) ||
          !allowed.has(packageName(specifier))
        ) {
          violations.push(location);
        }
      }
    });

    expect(violations).toEqual([]);
  });
});
