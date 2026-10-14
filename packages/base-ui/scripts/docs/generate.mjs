#!/usr/bin/env node
/**
 * Generates the Solid docs from the React docs, file for file: `docs/react` → `docs/solid`.
 *
 * - Source: every file under the React docs' `src` and `public`, and its root files. React code
 *   (`.ts`, `.tsx`) goes through `react-to-solid.mjs`; MDX pages transform their ESM, their JSX
 *   and their code samples; everything else is copied. Routes move from `/react/` to `/solid/`.
 * - Source packages: the upstream React packages the docs import (`@mui/internal-docs-infra`,
 *   `@base-ui/utils`) are generated from their source, as far as the docs reach into them.
 * - Templates: `templates/` holds what the React docs get from Next.js and React that Solid does
 *   not have (the app router, the docs-infra loaders, `next/*`, React runtime APIs). It is copied
 *   over the output.
 *
 *   bun run docs:generate                          # writes docs/solid
 *   node scripts/docs/generate.mjs --out <dir>     # writes elsewhere
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import * as prettier from 'prettier';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkMdx from 'remark-mdx';
import remarkGfm from 'remark-gfm';
import { visit } from 'unist-util-visit';
import { mapsModule, printCode, transformReactToSolid } from './react-to-solid.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const FORK = path.join(HERE, '../..');
const REACT = path.join(FORK, 'docs/react');
const TEMPLATES = path.join(HERE, 'templates');

const outFlag = process.argv.indexOf('--out');
const OUT =
  outFlag === -1 ? path.join(FORK, 'docs/solid') : path.resolve(process.argv[outFlag + 1]);

// The React docs files the Solid docs are generated from (paths under `docs/react`).
const SOURCES = ['src', 'public', 'scripts', 'postcss.config.js', 'next.config.mjs'];
const SKIP = new Set(['node_modules', '.next', 'export']);
// Output folders the generator does not own (build output, local state, hand-ported overrides).
const KEEP = new Set([
  'node_modules',
  'dist',
  '.output',
  'test-results',
  'playwright-report',
  'overrides',
]);

/**
 * React docs folders the Solid docs leave out, each with its reason. Paths are under `docs/react`.
 */
const EXCLUDED = [
  {
    path: 'src/app/(private)/experiments/',
    reason:
      'Internal React test pages rendered as React Server Components (they list and read their ' +
      'own files with node:fs at render time); Solid has no counterpart to render them with.',
  },
  {
    path: 'src/app/(private)/playground/',
    reason:
      'Internal React playground served as React Server Components (node:fs at render time); ' +
      'no counterpart in Solid.',
  },
];

/**
 * Page sections the Solid docs leave out, with their demos, each with its reason: the library the
 * section shows has no Solid 2 version. `mentions` are links to the section elsewhere on the page.
 */
const EXCLUDED_SECTIONS = [
  {
    page: 'src/app/(docs)/react/components/combobox/page.mdx',
    heading: 'Virtualized',
    demos: 'src/app/(docs)/react/components/combobox/demos/virtualized/',
    reason:
      "@tanstack/solid-virtual targets Solid 1; the demo's virtualizer has no Solid 2 version.",
  },
  {
    page: 'src/app/(docs)/react/components/autocomplete/page.mdx',
    heading: 'Virtualized',
    demos: 'src/app/(docs)/react/components/autocomplete/demos/virtualized/',
    reason:
      "@tanstack/solid-virtual targets Solid 1; the demo's virtualizer has no Solid 2 version.",
  },
  {
    page: 'src/app/(docs)/react/handbook/forms/page.mdx',
    heading: 'React Hook Form',
    demos: 'src/app/(docs)/react/handbook/forms/demos/react-hook-form/',
    mentions: ['[React Hook Form](#react-hook-form) and ', "    'React Hook Form Integration',\n"],
    reason: 'React Hook Form has no Solid version.',
  },
];
for (const section of EXCLUDED_SECTIONS) {
  EXCLUDED.push({ path: section.demos, reason: section.reason });
}

const headingText = (node) =>
  (node.children ?? []).map((child) => child.value ?? headingText(child)).join('');

/** A page without its excluded sections (heading to the next heading of its level or above). */
function removeExcludedSections(code, rel) {
  const sections = EXCLUDED_SECTIONS.filter((section) => section.page === rel);
  if (sections.length === 0) {
    return code;
  }
  const tree = unified().use(remarkParse).use(remarkMdx).use(remarkGfm).parse(code);
  const ranges = [];
  tree.children.forEach((node, index) => {
    const section =
      node.type === 'heading' &&
      sections.find((candidate) => candidate.heading === headingText(node));
    if (!section) {
      return;
    }
    const next = tree.children
      .slice(index + 1)
      .find((candidate) => candidate.type === 'heading' && candidate.depth <= node.depth);
    ranges.push([node.position.start.offset, next ? next.position.start.offset : code.length]);
  });
  let output = code;
  for (const [start, end] of ranges.sort((a, b) => b[0] - a[0])) {
    output = output.slice(0, start) + output.slice(end);
  }
  for (const section of sections) {
    for (const mention of section.mentions ?? []) {
      output = output.replaceAll(mention, '');
    }
  }
  return output;
}

const ROUTE_RENAMES = [['src/app/(docs)/react/', 'src/app/(docs)/solid/']];

// docs-infra's output for the docs it renders (a component's API reference, `types.md`): written
// for the Solid docs by docs-infra itself (`docs-infra validate`), never copied from React's.
const DOCS_INFRA_OUTPUT = /(^|\/)types\.md$/;
// A page's index section docs-infra writes below this marker (`docs-infra validate`).
const DOCS_INFRA_SECTION = "[//]: # 'This section is autogenerated, DO NOT EDIT AFTER THIS LINE";

/** A page as generated, with the section docs-infra wrote for the Solid docs kept. */
function keepDocsInfraSection(file, generated) {
  const at = generated.indexOf(DOCS_INFRA_SECTION);
  if (at === -1 || !fs.existsSync(file)) {
    return generated;
  }
  const current = fs.readFileSync(file, 'utf8');
  const currentAt = current.indexOf(DOCS_INFRA_SECTION);
  return currentAt === -1 ? generated : generated.slice(0, at) + current.slice(currentAt);
}

/** Upstream React packages the docs import, generated from their source into `<dest>/src`. */
const requireFromFork = createRequire(path.join(FORK, 'package.json'));
const packageRoot = (name) => {
  let dir = path.dirname(requireFromFork.resolve(name));
  while (!fs.existsSync(path.join(dir, 'package.json'))) {
    dir = path.dirname(dir);
  }
  return dir;
};
const SOURCE_PACKAGES = [
  {
    name: '@mui/internal-docs-infra',
    root: path.join(FORK, 'docs/docs-infra'),
    dest: 'docs-infra',
  },
  { name: '@base-ui/utils', root: path.join(FORK, 'packages/utils'), dest: 'base-ui-utils' },
  // docs-infra's code editor (a React component that ships its source).
  {
    name: 'react-simple-code-editor',
    root: packageRoot('react-simple-code-editor'),
    dest: 'react-simple-code-editor',
    entry: 'src/index.tsx',
  },
];

// Modules the Solid docs import instead (the `docs/src/adapters` ones come from `templates/`).
const MODULES = {
  next: 'docs/src/adapters/next',
  'next/types': 'docs/src/adapters/next',
  'next/link': 'docs/src/adapters/next/link',
  'next/navigation': 'docs/src/adapters/next/navigation',
  'next/script': 'docs/src/adapters/next/script',
  'next/image': 'docs/src/adapters/next/image',
  'react/jsx-runtime': 'docs/src/adapters/jsx-runtime',
  'react-error-boundary': 'docs/src/adapters/react-error-boundary',
  'react-simple-code-editor': 'docs/react-simple-code-editor/src/index',
  'hast-util-to-jsx-runtime': 'docs/src/adapters/hast-util-to-jsx-runtime',
  'server-only': 'docs/src/adapters/server-only',
};

/**
 * Solid-specific edits to generated files, each with its reason. Everything else is generated as
 * the transform writes it.
 */
const ADAPTATIONS = [
  {
    file: 'next.config.mjs',
    from: "include: ['src/app/react']",
    to: "include: ['src/app/solid']",
    reason: 'The page index covers the Solid routes.',
  },
];

/** The Solid docs' wording for the package and its routes. */
function rewriteText(value) {
  return value
    .replaceAll('@base-ui/react', '@solidports/base-ui')
    .replaceAll('(docs)/react', '(docs)/solid')
    .replaceAll('/react/', '/solid/');
}

/** Imports of a renamed route folder follow it. */
const rewriteModule = (source) => source.replace('(docs)/react/', '(docs)/solid/');

/**
 * Prop names that components declare in camelCase (Base UI's `readOnly`, `tabIndex`): on a
 * component the transform keeps them instead of writing the DOM attribute name.
 */
function declaredComponentProps() {
  const names = new Set();
  const roots = [
    path.join(FORK, 'packages/solid/src'),
    path.join(REACT, 'src'),
    ...SOURCE_PACKAGES.map((pkg) => path.join(pkg.root, 'src')),
  ];
  for (const file of roots.flatMap((root) => walk(root))) {
    if (!/\.tsx?$/.test(file) || /\.(test|spec)\./.test(file)) {
      continue;
    }
    for (const match of fs.readFileSync(file, 'utf8').matchAll(/^\s+([a-z]+[A-Z]\w*)\??:/gm)) {
      names.add(match[1]);
    }
  }
  return [...names];
}
const COMPONENT_PROPS = declaredComponentProps();

/**
 * Hooks the docs' modules export as Base UI's own (`export const useToastManager =
 * Toast.useToastManager`): their callers read the Base UI hook's result, not a lowered hook's.
 */
function baseUiHookAliases() {
  const aliases = new Set();
  const defined = new Set();
  for (const file of walk(path.join(REACT, 'src'))) {
    if (!/\.tsx?$/.test(file)) {
      continue;
    }
    const code = fs.readFileSync(file, 'utf8');
    for (const match of code.matchAll(/^export const (use\w+) = \w+\.(use\w+);$/gm)) {
      aliases.add(match[1]);
    }
    for (const match of code.matchAll(/^export (?:default )?function (use\w+)/gm)) {
      defined.add(match[1]);
    }
  }
  return [...aliases].filter((name) => !defined.has(name));
}
const BASE_UI_HOOK_ALIASES = baseUiHookAliases();

const written = new Set();
let prettierConfig;

function write(file, content) {
  written.add(file);
  const body = Buffer.isBuffer(content) ? content : Buffer.from(content);
  if (fs.existsSync(file) && fs.readFileSync(file).equals(body)) {
    return;
  }
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, body);
}

function walk(dir, acc = []) {
  if (!fs.existsSync(dir)) {
    return acc;
  }
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP.has(entry.name)) {
      continue;
    }
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full, acc);
    } else {
      acc.push(full);
    }
  }
  return acc;
}

function outPath(rel) {
  for (const [from, to] of ROUTE_RENAMES) {
    if (rel.startsWith(from)) {
      return to + rel.slice(from.length);
    }
  }
  return rel;
}

async function format(code, file) {
  prettierConfig ??= await prettier.resolveConfig(path.join(FORK, 'prettier.config.mjs'));
  return prettier.format(code, { ...prettierConfig, filepath: file });
}

/**
 * Whether a module needs the transform (React, its global types, JSX, hooks, or a module the Solid
 * docs import instead), or is plain code to copy.
 */
function needsTransform(code, file) {
  return (
    /from ['"]react(-dom)?(\/[^'"]*)?['"]/.test(code) ||
    importsOf(code).some((specifier) => mapsModule(specifier, MODULES)) ||
    /\bReact\.[A-Z]/.test(code) ||
    /\buse[A-Z]\w*\s*\(/.test(code) ||
    (file.endsWith('.tsx') && /<[A-Za-z>]/.test(code))
  );
}

async function transformCode(code, file, options) {
  return format(
    transformReactToSolid(code, {
      modules: MODULES,
      filename: file,
      componentProps: COMPONENT_PROPS,
      baseUiHookAliases: BASE_UI_HOOK_ALIASES,
      rewriteModule,
      ...options,
    }),
    file,
  );
}

/**
 * A code sample in an MDX page: transformed when it parses as a module, renamed as text when not
 * (a fragment with placeholders, say). An unchanged sample keeps its text.
 */
async function transformSample(code, lang) {
  const file = `sample.${lang === 'js' || lang === 'jsx' ? 'jsx' : 'tsx'}`;
  let output;
  try {
    output = transformReactToSolid(code, {
      modules: MODULES,
      componentProps: COMPONENT_PROPS,
      baseUiHookAliases: BASE_UI_HOOK_ALIASES,
      standalone: true,
    });
    if (printCode(output) === printCode(code)) {
      return code;
    }
    output = await format(output, file);
  } catch {
    return code.replace(/\bclassName=/g, 'class=').replace(/\bhtmlFor=/g, 'for=');
  }
  // The blank line after the imports stays (the printer drops blank lines).
  const importsEnd = /^(?:import [^\n]*\n)+\n/.exec(code);
  if (importsEnd) {
    output = output.replace(/^((?:import [^\n]*\n)+)(?!\n)/, '$1\n');
  }
  // A sample that ends in an expression without a semicolon keeps it that way.
  if (!/;\s*$/.test(code)) {
    output = output.replace(/;\n$/, '\n');
  }
  return output.replace(/\n$/, '');
}

async function transformMdx(source, rel) {
  const code = removeExcludedSections(source, rel);
  const tree = unified().use(remarkParse).use(remarkMdx).use(remarkGfm).parse(code);
  const edits = [];
  const jobs = [];
  visit(tree, (node) => {
    const start = node.position?.start.offset;
    const end = node.position?.end.offset;
    if (node.type === 'mdxjsEsm') {
      jobs.push(
        (async () => {
          const output = transformReactToSolid(node.value, {
            modules: MODULES,
            componentProps: COMPONENT_PROPS,
            baseUiHookAliases: BASE_UI_HOOK_ALIASES,
          });
          edits.push({ start, end, text: output });
        })(),
      );
    } else if (node.type === 'code' && /^(tsx|jsx|ts|js)$/.test(node.lang ?? '')) {
      const text = code.slice(start, end);
      const open = text.indexOf('\n') + 1;
      const close = text.lastIndexOf('\n');
      if (open <= 0 || close < open) {
        return;
      }
      const inner = text.slice(open, close);
      jobs.push(
        (async () => {
          const output = await transformSample(inner, node.lang);
          if (output !== inner) {
            edits.push({ start: start + open, end: start + close, text: output });
          }
        })(),
      );
    } else if (node.type === 'mdxJsxFlowElement' || node.type === 'mdxJsxTextElement') {
      for (const attribute of node.attributes ?? []) {
        const renamed = { className: 'class', htmlFor: 'for' }[attribute.name];
        if (renamed && attribute.position) {
          const offset = attribute.position.start.offset;
          edits.push({ start: offset, end: offset + attribute.name.length, text: renamed });
        }
      }
    }
  });
  await Promise.all(jobs);
  let output = code;
  for (const edit of edits.sort((a, b) => b.start - a.start)) {
    output = output.slice(0, edit.start) + edit.text + output.slice(edit.end);
  }
  return rewriteText(output);
}

async function generateSource(file, rel) {
  const code = fs.readFileSync(file, 'utf8');
  if (/\.(tsx?|mts)$/.test(file) && !file.endsWith('.d.ts')) {
    // A demo is code users copy: it stands on its own.
    const standalone = /\/demos\//.test(rel);
    return transformCode(code, file, { rewriteString: rewriteText, standalone });
  }
  if (file.endsWith('.mdx')) {
    return transformMdx(code, rel);
  }
  if (/\.(css|md|json|txt|mjs|js|d\.ts)$/.test(file)) {
    return rel.startsWith('src/') || rel === 'next.config.mjs' ? rewriteText(code) : code;
  }
  return fs.readFileSync(file);
}

async function generateDocs() {
  const files = SOURCES.flatMap((source) => {
    const full = path.join(REACT, source);
    return fs.statSync(full).isDirectory() ? walk(full) : [full];
  });
  // An excluded module that the generated docs import (a utility of an excluded page that a docs
  // test covers) is generated with them.
  const included = new Set(
    files.filter((file) => {
      const rel = path.relative(REACT, file);
      return !DOCS_INFRA_OUTPUT.test(rel) && !EXCLUDED.some((entry) => rel.startsWith(entry.path));
    }),
  );
  const queue = [...included].filter((file) => /\.(tsx?|mjs|js|mdx)$/.test(file));
  while (queue.length > 0) {
    const file = queue.pop();
    // A page imports what it renders without its excluded sections.
    const code = removeExcludedSections(fs.readFileSync(file, 'utf8'), path.relative(REACT, file));
    for (const specifier of importsOf(code)) {
      let base = null;
      if (specifier.startsWith('.')) {
        base = path.resolve(path.dirname(file), specifier);
      } else if (specifier.startsWith('docs/')) {
        base = path.join(REACT, specifier.slice('docs/'.length));
      }
      const target = base && resolveRelative(base);
      if (target && target.startsWith(`${REACT}${path.sep}`) && !included.has(target)) {
        included.add(target);
        queue.push(target);
      }
    }
  }
  const failures = [];
  await Promise.all(
    [...included].map(async (file) => {
      const rel = path.relative(REACT, file);
      try {
        const dest = path.join(OUT, outPath(rel));
        const content = await generateSource(file, rel);
        write(dest, rel.endsWith('.mdx') ? keepDocsInfraSection(dest, content) : content);
      } catch (error) {
        failures.push(`${rel}: ${String(error.message).split('\n')[0]}`);
      }
    }),
  );
  return { count: included.size, failures };
}

const IMPORT_PATTERN =
  /(?:import|export)\s(?:[^'";]*?\sfrom\s)?['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)/g;

function resolveRelative(base) {
  for (const candidate of [
    base,
    `${base}.ts`,
    `${base}.tsx`,
    `${base}/index.ts`,
    `${base}/index.tsx`,
  ]) {
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
      return candidate;
    }
  }
  return null;
}

/** The file a package specifier resolves to through the package's `exports`. */
function resolveExport(pkg, specifier) {
  const manifest = JSON.parse(fs.readFileSync(path.join(pkg.root, 'package.json'), 'utf8'));
  const subpath = `.${specifier.slice(pkg.name.length)}`;
  if (subpath === '.' && pkg.entry) {
    return path.join(pkg.root, pkg.entry);
  }
  const exports = manifest.exports ?? {};
  if (typeof exports[subpath] === 'string') {
    return resolveRelative(path.join(pkg.root, exports[subpath]));
  }
  for (const [pattern, target] of Object.entries(exports)) {
    if (
      pattern.endsWith('*') &&
      typeof target === 'string' &&
      subpath.startsWith(pattern.slice(0, -1))
    ) {
      const rest = subpath.slice(pattern.length - 1);
      return (
        resolveRelative(path.join(pkg.root, target.replace('*', rest)).replace(/\.ts$/, '')) ??
        resolveRelative(path.join(pkg.root, target.replace('*', rest)))
      );
    }
  }
  return null;
}

function importsOf(code) {
  return [...code.matchAll(IMPORT_PATTERN)].map((match) => match[1] ?? match[2]);
}

/** Generates each source package's files the docs reach (their import closure). */
async function generateSourcePackages() {
  const docsFiles = [...written].filter((file) => /\.(tsx?|mdx)$/.test(file));
  const queue = [];
  const seen = new Set();
  const owner = (file) => SOURCE_PACKAGES.find((pkg) => file.startsWith(`${pkg.root}${path.sep}`));
  const enqueueSpecifier = (specifier, from) => {
    const pkg = SOURCE_PACKAGES.find(
      (candidate) => specifier === candidate.name || specifier.startsWith(`${candidate.name}/`),
    );
    if (pkg) {
      const file = resolveExport(pkg, specifier);
      if (file) {
        queue.push(file);
      } else {
        console.warn(`unresolved ${specifier} (from ${path.relative(FORK, from)})`);
      }
      return;
    }
    if (specifier.startsWith('.') && owner(from)) {
      const file = resolveRelative(path.resolve(path.dirname(from), specifier));
      if (file) {
        queue.push(file);
      }
    }
  };
  for (const file of docsFiles) {
    for (const specifier of importsOf(fs.readFileSync(file, 'utf8'))) {
      enqueueSpecifier(specifier, file);
    }
  }
  const failures = [];
  while (queue.length > 0) {
    const file = queue.pop();
    if (seen.has(file)) {
      continue;
    }
    seen.add(file);
    const code = fs.readFileSync(file, 'utf8');
    for (const specifier of importsOf(code)) {
      enqueueSpecifier(specifier, file);
    }
  }
  // A folder's ambient declarations (`hast.d.ts` augmenting `hast`) come with its modules.
  for (const dir of new Set([...seen].map((file) => path.dirname(file)))) {
    for (const entry of fs.readdirSync(dir)) {
      if (entry.endsWith('.d.ts')) {
        seen.add(path.join(dir, entry));
      }
    }
  }
  await Promise.all(
    [...seen].map(async (file) => {
      const pkg = owner(file);
      const dest = path.join(OUT, pkg.dest, path.relative(pkg.root, file));
      const code = fs.readFileSync(file, 'utf8');
      try {
        write(dest, needsTransform(code, file) ? await transformCode(code, file) : code);
      } catch (error) {
        failures.push(`${path.relative(FORK, file)}: ${String(error.message).split('\n')[0]}`);
        write(dest, code);
      }
    }),
  );
  return { count: seen.size, failures };
}

function applyAdaptations() {
  for (const adaptation of ADAPTATIONS) {
    const file = path.join(OUT, adaptation.file);
    const code = fs.readFileSync(file, 'utf8');
    if (!code.includes(adaptation.from)) {
      throw new Error(`adaptation no longer applies to ${adaptation.file}: ${adaptation.from}`);
    }
    write(file, code.replaceAll(adaptation.from, adaptation.to));
  }
}

// React docs dependencies with no place in the Solid docs (React, Next.js and their libraries).
const REACT_ONLY_DEPENDENCIES = new Set([
  '@base-ui/utils',
  '@mdx-js/loader',
  '@mdx-js/react',
  '@next/mdx',
  '@react-spring/web',
  '@types/react',
  '@types/react-dom',
  'next',
  'radix-ui',
  'react',
  'react-dom',
  'react-error-boundary',
  'react-hook-form',
  'server-only',
]);
const DEPENDENCY_RENAMES = {
  '@base-ui/react': '@solidports/base-ui',
  '@tanstack/react-form': '@tanstack/solid-form',
  '@tanstack/react-virtual': '@tanstack/solid-virtual',
  'lucide-react': 'lucide-solid',
};
// What the framework templates import.
const FRAMEWORK_DEPENDENCIES = {
  '@mdx-js/mdx': 'catalog:',
  '@mdx-js/rollup': 'catalog:',
  '@solidjs/router': 'catalog:',
  '@solidjs/vite-plugin': 'catalog:',
  '@solidjs/web': 'catalog:',
  'cross-env': 'catalog:',
  'hast-util-to-jsx-runtime': '^2.3.6',
  jiti: '^2.7.0',
  picomatch: '^4.0.3',
  'solid-js': 'catalog:',
  vite: 'catalog:',
};
const FRAMEWORK_DEV_DEPENDENCIES = {
  '@types/picomatch': '^4.0.3',
};
const DOCS_INFRA_PACKAGE = '@mui/internal-docs-infra';

/**
 * The Solid docs' package: the React docs' dependencies in their Solid form, the dependencies of
 * the generated docs-infra source (at docs-infra's versions), and the framework's. Scripts run
 * the framework (Vite) where the React docs run Next.js; docs-infra's commands load
 * `framework/typescript.mjs`.
 */
function generatePackageJson() {
  const read = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));
  const reactPackage = read(path.join(REACT, 'package.json'));
  const infraPackage = read(path.join(SOURCE_PACKAGES[0].root, 'package.json'));
  const catalog = read(path.join(FORK, '../../package.json')).workspaces.catalog;
  const docsInfraVersion = reactPackage.dependencies[DOCS_INFRA_PACKAGE];
  const mapped = (dependencies) => {
    const result = {};
    for (const [name, version] of Object.entries(dependencies ?? {})) {
      if (REACT_ONLY_DEPENDENCIES.has(name)) {
        continue;
      }
      const solidName = DEPENDENCY_RENAMES[name] ?? name;
      if (solidName === '@solidports/base-ui') {
        result[solidName] = 'workspace:*';
      } else if (solidName === DOCS_INFRA_PACKAGE) {
        result[solidName] = docsInfraVersion;
      } else {
        result[solidName] = catalog[solidName] ? 'catalog:' : version;
      }
    }
    return result;
  };
  const infraDependencies = Object.fromEntries(
    Object.entries(infraPackage.dependencies).filter(
      // `typescript` resolves to the workspace's (see `framework/typescript.mjs`); the editor is
      // an adapter.
      ([name]) => name !== 'typescript' && name !== 'react-simple-code-editor',
    ),
  );
  const sorted = (object) =>
    Object.fromEntries(Object.entries(object).sort(([a], [b]) => a.localeCompare(b)));
  const hook = 'cross-env NODE_OPTIONS=--import=./framework/typescript.mjs';
  const pkg = {
    name: '@solidports/docs',
    private: true,
    type: 'module',
    scripts: {
      dev: `${hook} vite --port 3001`,
      build: `${hook} vite build`,
      preview: 'vite preview --port 3001',
      'docs-infra': `${hook} docs-infra`,
      validate: 'bun internal-validate --command "bun validate"',
      'internal-validate': `${hook} docs-infra validate`,
      typescript: 'tsc -p tsconfig.json',
      'link-check': reactPackage.scripts['link-check'],
      'generate-llms': reactPackage.scripts['generate-llms'],
    },
    dependencies: sorted({
      ...mapped(reactPackage.dependencies),
      ...infraDependencies,
      [DOCS_INFRA_PACKAGE]: docsInfraVersion,
      ...FRAMEWORK_DEPENDENCIES,
    }),
    devDependencies: sorted({
      ...mapped(reactPackage.devDependencies),
      // The types the generated docs-infra source compiles against.
      ...mapped(
        Object.fromEntries(
          Object.entries(infraPackage.devDependencies).filter(([name]) =>
            name.startsWith('@types/'),
          ),
        ),
      ),
      ...FRAMEWORK_DEV_DEPENDENCIES,
    }),
  };
  write(path.join(OUT, 'package.json'), `${JSON.stringify(pkg, null, 2)}\n`);
}

// The Solid docs lint as upstream lints `docs/react`: the Solid package's config, then the root
// config's `docs/react` entries for the same paths in `docs/solid`. React's and Next.js's rules stay
// off: the docs are a Solid app.
const ESLINT_CONFIG = `// Generated by \`scripts/docs/generate.mjs\`.
import { defineConfig } from 'eslint/config';
// eslint-disable-next-line import/no-relative-packages
import rootConfig from '../../eslint.config.mjs';
// eslint-disable-next-line import/no-relative-packages
import solidConfig from '../../packages/solid/eslint.config.mjs';

const toSolid = (pattern) =>
  Array.isArray(pattern)
    ? pattern.map(toSolid)
    : pattern
        .replace('docs/react/src/app/(docs)/react/', 'docs/solid/src/app/(docs)/solid/')
        .replace(/^docs\\/react\\//, 'docs/solid/');
const isReactDocs = (pattern) =>
  Array.isArray(pattern) ? pattern.some(isReactDocs) : pattern.startsWith('docs/react/');

const docsConfig = rootConfig
  .filter((config) => config.files?.some(isReactDocs))
  .map((config) => ({
    ...config,
    basePath: '../..',
    files: config.files.map(toSolid),
    ...(config.ignores && { ignores: config.ignores.map(toSolid) }),
  }));

const nonSolidRulesOff = Object.fromEntries(
  [...solidConfig, ...docsConfig]
    .flatMap((config) => Object.keys(config.rules ?? {}))
    .filter((ruleName) => ruleName.startsWith('react') || ruleName.startsWith('@next/'))
    .map((ruleName) => [ruleName, 'off']),
);

export default defineConfig(...solidConfig, ...docsConfig, {
  rules: {
    ...nonSolidRulesOff,
    // Docs code is application code, the code \`solid/reactivity\` is written for.
    'solid/reactivity': 'warn',
  },
});
`;

function copyTemplates() {
  for (const file of walk(TEMPLATES)) {
    write(path.join(OUT, path.relative(TEMPLATES, file)), fs.readFileSync(file));
  }
}

/** Deletes files the run did not write, then empty folders (outside the folders it keeps). */
function pruneStale(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (KEEP.has(entry.name)) {
      continue;
    }
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      pruneStale(full);
      if (fs.readdirSync(full).length === 0) {
        fs.rmdirSync(full);
      }
    } else if (!written.has(full) && !DOCS_INFRA_OUTPUT.test(full)) {
      fs.rmSync(full);
    }
  }
}

if (!fs.existsSync(path.join(REACT, 'src'))) {
  console.error('docs/react is missing. Run `bun run docs:sync` first.');
  process.exit(1);
}
fs.mkdirSync(OUT, { recursive: true });
const docs = await generateDocs();
const packages = await generateSourcePackages();
applyAdaptations();
generatePackageJson();
write(path.join(OUT, 'eslint.config.mjs'), ESLINT_CONFIG);
copyTemplates();
pruneStale(OUT);
// eslint-disable-next-line no-console -- the generator's report
console.log(
  `generated ${docs.count} docs files and ${packages.count} source package files into ${path.relative(process.cwd(), OUT) || '.'}`,
);
const failures = [...docs.failures, ...packages.failures];
for (const failure of failures) {
  console.error(`FAIL ${failure}`);
}
if (failures.length > 0) {
  process.exitCode = 1;
}
