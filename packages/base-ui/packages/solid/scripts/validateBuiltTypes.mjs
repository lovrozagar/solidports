/* eslint-disable no-console */
// The counterpart of upstream's `code-infra validate-built-types`: the emitted declarations must
// only reference published files. Every import in `types/` (static, `export … from` and inferred
// `import("…")` types) is either relative and resolves to a declaration file in `types/`, or names
// a peer dependency (or a subpath of one).
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const typesRoot = join(packageRoot, 'types');
const { peerDependencies } = JSON.parse(readFileSync(join(packageRoot, 'package.json'), 'utf8'));
const peers = new Set(Object.keys(peerDependencies ?? {}));
const SPECIFIER = /(?:\bfrom\s+|\bimport\s*\(\s*|\bimport\s+)(['"])([^'"]+)\1/g;

function listDeclarations(dir) {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) {
      return listDeclarations(path);
    }
    return entry.endsWith('.d.ts') ? [path] : [];
  });
}

function packageName(specifier) {
  const parts = specifier.split('/');
  return specifier.startsWith('@') ? `${parts[0]}/${parts[1]}` : parts[0];
}

if (!existsSync(typesRoot)) {
  console.error('❌ No built declarations: run `bun run types` first.');
  process.exit(1);
}

const invalid = [];
const files = listDeclarations(typesRoot);
for (const file of files) {
  // Comments hold examples (`import { platform } from '../utils/platform'`), not imports.
  const content = readFileSync(file, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');
  for (const match of content.matchAll(SPECIFIER)) {
    const specifier = match[2];
    const location = `${relative(packageRoot, file)} -> ${specifier}`;
    if (specifier.startsWith('.')) {
      const target = resolve(dirname(file), specifier.replace(/\.js$/, '.d.ts'));
      if (relative(typesRoot, target).startsWith('..') || !existsSync(target)) {
        invalid.push(location);
      }
    } else if (!peers.has(packageName(specifier))) {
      invalid.push(location);
    }
  }
}

if (invalid.length > 0) {
  console.error('❌ Found imports of unpublished files in the built declarations:');
  console.log(invalid.join('\n'));
  process.exit(1);
}
console.log(`✅ ${files.length} declaration files only import published files and peer dependencies.`);
