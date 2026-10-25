// Test files that browser runs load must not statically import a Node builtin: the Chromium,
// Firefox and WebKit runs fail to load the file (a top-level `import … from 'node:inspector'`
// failed all three on 2026-10-25), and the pre-commit jsdom run does not see it. Node-only
// projects are exempt: `test/ssr/**` (its own Node project) and `test/package/**` (excluded from
// browser runs, `packages/solid/vitest.config.mts`).
import { readdirSync, readFileSync } from 'node:fs';
import { builtinModules } from 'node:module';
import path from 'node:path';

const BUILTINS = new Set(builtinModules.flatMap((name) => [name, `node:${name}`]));

/** Directories, relative to the Solid package, whose tests never run in a browser. */
export const NODE_ONLY_DIRS = ['test/ssr/', 'test/package/'];

// A static import or re-export, side-effect import included; `import(…)` is dynamic and allowed.
const STATIC_IMPORT = /^\s*(?:import|export)\s+(?:type\s+)?(?:[^'";]*?\s+from\s+)?['"]([^'"]+)['"]/gm;

/** The Node builtins `source` imports statically, type-only imports left out. */
export function nodeBuiltinImports(source) {
  const found = [];
  for (const match of source.matchAll(STATIC_IMPORT)) {
    const statement = match[0];
    const specifier = match[1];
    if (/^\s*(?:import|export)\s+type\s/.test(statement)) {
      continue;
    }
    const base = specifier.startsWith('node:') ? specifier : specifier.split('/')[0];
    if (BUILTINS.has(base) || BUILTINS.has(specifier)) {
      found.push(specifier);
    }
  }
  return found;
}

/** Test files under the Solid package's `src` and `test` that browser runs load. */
export function browserTestFiles(solidDir) {
  const files = [];
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name !== 'node_modules') {
          walk(full);
        }
      } else if (/\.test\.(?:ts|tsx|js|jsx|mts|mjs)$/.test(entry.name)) {
        const relative = path.relative(solidDir, full).split(path.sep).join('/');
        if (!NODE_ONLY_DIRS.some((prefix) => relative.startsWith(prefix))) {
          files.push(relative);
        }
      }
    }
  };
  walk(path.join(solidDir, 'src'));
  walk(path.join(solidDir, 'test'));
  return files.sort();
}

/** Every browser-run test file that imports a Node builtin statically, with the builtins. */
export function browserNodeImports(solidDir) {
  return browserTestFiles(solidDir)
    .map((file) => ({ file, imports: nodeBuiltinImports(readFileSync(path.join(solidDir, file), 'utf8')) }))
    .filter((entry) => entry.imports.length > 0);
}
