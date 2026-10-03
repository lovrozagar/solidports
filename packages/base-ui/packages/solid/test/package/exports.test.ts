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
  peerDependencies?: Record<string, string>;
};

// Subpaths that only export types have no runtime exports.
const TYPE_ONLY_SUBPATHS = new Set(['./types', './internals/types', './internals/temporal']);
const SOURCE_FILE = /\.tsx?$/;
const TEST_FILE = /(\.(test|spec)\.tsx?|\/test-utils\.tsx?)$/;
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
    expect(entries.length).to.be.at.least(80);
    entries.forEach(([subpath, target]) => {
      expect(target.default, `${subpath} default`).to.match(/^\.\/src\/.+\.tsx?$/);
      expect(existsSync(join(PACKAGE_ROOT, target.default)), `${subpath} default exists`).to.equal(
        true,
      );
      // The `solid` condition marks the package as Solid source for bundler plugins
      // (`@solidjs/vite-plugin` compiles it instead of pre-bundling it).
      expect(target.solid, `${subpath} solid`).to.equal(target.default);
      expect(Object.keys(target), `${subpath} condition order`).to.deep.equal([
        'types',
        'solid',
        'default',
      ]);
      expect(target.types, `${subpath} types`).to.equal(
        target.default.replace(/^\.\/src\//, './types/').replace(/\.tsx?$/, '.d.ts'),
      );
      expect(existsSync(join(PACKAGE_ROOT, target.types)), `${subpath} types exists`).to.equal(
        true,
      );
    });
  });

  it('resolves every subpath with at least one export', async () => {
    await Promise.all(
      entries
        .filter(([subpath]) => !TYPE_ONLY_SUBPATHS.has(subpath))
        .map(async ([subpath]) => {
          const specifier = `@solidports/base-ui${subpath.slice(1)}`;
          const module = await import(/* @vite-ignore */ specifier);
          expect(Object.keys(module).length, `${specifier} exports`).to.be.greaterThan(0);
        }),
    );
  });

  it('only imports published files and runtime dependencies', () => {
    const allowed = new Set([
      ...Object.keys(packageJson.dependencies ?? {}),
      ...Object.keys(packageJson.peerDependencies ?? {}),
    ]);
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

    expect(violations).to.deep.equal([]);
  });
});
