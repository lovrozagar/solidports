// Adds explicit extensions to the relative specifiers in the emitted declarations.
//
// The sources import extensionless paths, as upstream does, and `tsc` copies those specifiers into
// `types/` unchanged. `moduleResolution: bundler` resolves them, but `node16`/`nodenext` require
// the full path, so without this every import from the package types as `any` there.
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const TYPES_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../types');

function listDeclarations(dir) {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) {
      return listDeclarations(path);
    }
    return path.endsWith('.d.ts') ? [path] : [];
  });
}

/** The string literals naming a module: import/export declarations and `import('…')` types. */
function moduleSpecifiers(sourceFile) {
  const specifiers = [];
  function visit(node) {
    if (
      (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
      node.moduleSpecifier &&
      ts.isStringLiteral(node.moduleSpecifier)
    ) {
      specifiers.push(node.moduleSpecifier);
    } else if (
      ts.isImportTypeNode(node) &&
      ts.isLiteralTypeNode(node.argument) &&
      ts.isStringLiteral(node.argument.literal)
    ) {
      specifiers.push(node.argument.literal);
    }
    ts.forEachChild(node, visit);
  }
  visit(sourceFile);
  return specifiers;
}

function withExtension(file, specifier) {
  if (!/^\.{1,2}(?:\/|$)/.test(specifier)) {
    return specifier;
  }
  if (/\.(?:c|m)?js$/.test(specifier)) {
    return specifier;
  }
  const target = resolve(dirname(file), specifier);
  if (existsSync(`${target}.d.ts`)) {
    return `${specifier}.js`;
  }
  if (existsSync(join(target, 'index.d.ts'))) {
    return `${specifier.replace(/\/$/, '')}/index.js`;
  }
  throw new Error(`Cannot resolve ${specifier} from ${file}`);
}

let rewritten = 0;
for (const file of listDeclarations(TYPES_ROOT)) {
  const source = readFileSync(file, 'utf8');
  const sourceFile = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, false);
  // Replace from the end so earlier positions stay valid.
  const edits = moduleSpecifiers(sourceFile)
    .map((literal) => ({
      start: literal.getStart(sourceFile) + 1,
      end: literal.getEnd() - 1,
      text: withExtension(file, literal.text),
    }))
    .filter((edit) => edit.text !== source.slice(edit.start, edit.end))
    .sort((a, b) => b.start - a.start);
  if (edits.length === 0) {
    continue;
  }
  let output = source;
  for (const edit of edits) {
    output = output.slice(0, edit.start) + edit.text + output.slice(edit.end);
  }
  writeFileSync(file, output);
  rewritten += 1;
}

console.log(`Added declaration extensions in ${rewritten} files.`);
