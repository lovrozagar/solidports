#!/usr/bin/env bun
/**
 * Generate Solid docs content from the React docs snapshot.
 *
 * Reads:  docs/react/src/app/(docs)/react/**  and docs/react/src/css
 * Writes: docs/solid/src/routes/(docs)/solid/** , docs/solid/src/demos/solid/**
 *         docs/solid/src/css , copied chrome CSS
 *
 *   bun run docs:generate
 */
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
  copyFileSync,
  symlinkSync,
  lstatSync,
} from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const FORK = join(HERE, '../..');
const REACT = join(FORK, 'docs/react');
const SOLID = join(FORK, 'docs/solid');
const REACT_PAGES = join(REACT, 'src/app/(docs)/react');
const SOLID_ROUTES = join(SOLID, 'src/routes/(docs)/solid');
const SOLID_DEMOS = join(SOLID, 'src/demos/solid');

const GENERATED_BANNER =
  '{/* Generated from docs/react by `bun run docs:generate`. Do not edit by hand. */}';

function walk(dir, acc = []) {
  if (!existsSync(dir)) return acc;
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, acc);
    else acc.push(p);
  }
  return acc;
}

function ensureDir(p) {
  mkdirSync(p, { recursive: true });
}

function write(p, body) {
  ensureDir(dirname(p));
  writeFileSync(p, body);
}

const CUSTOM_MEDIA = [
  ['--show-quick-nav', '(min-width: 84rem)'],
  ['--show-side-nav', '(min-width: 64rem)'],
  ['--2xl', '(min-width: 96rem)'],
  ['--xl', '(min-width: 80rem)'],
  ['--lg', '(min-width: 64rem)'],
  ['--md', '(min-width: 48rem)'],
  ['--sm', '(min-width: 40rem)'],
  ['--xs', '(min-width: 32rem)'],
];

function expandCustomMedia(css) {
  let out = css.replace(/@import ['"]docs\/src\/css\/custom-media\.css['"];\n*/g, '');
  for (const [name, query] of CUSTOM_MEDIA) {
    out = out.replaceAll(`(${name})`, query);
  }
  return out;
}

function writeCss(dest, css) {
  ensureDir(dirname(dest));
  writeFileSync(dest, expandCustomMedia(css));
}

function copyTree(from, to) {
  if (!existsSync(from)) return;
  ensureDir(to);
  for (const name of readdirSync(from)) {
    const src = join(from, name);
    const dest = join(to, name);
    if (statSync(src).isDirectory()) copyTree(src, dest);
    else if (name.endsWith('.css')) writeCss(dest, readFileSync(src, 'utf8'));
    else {
      ensureDir(dirname(dest));
      copyFileSync(src, dest);
    }
  }
}

/** React page dir under (docs)/react → Solid demo path prefix. */
function demoPrefixFromPageDir(relDir) {
  // components/dialog → dialog
  // handbook/animation → handbook/animation
  // utils/use-render → use-render
  if (relDir === '.' || relDir === '') return '';
  const parts = relDir.split('/');
  if (parts[0] === 'components' || parts[0] === 'utils') {
    return parts.slice(1).join('/');
  }
  return relDir;
}

function skipGeneric(text, i) {
  if (text[i] !== '<') return i;
  let depth = 0;
  for (; i < text.length; i += 1) {
    if (text[i] === '<') depth += 1;
    else if (text[i] === '>') {
      depth -= 1;
      if (depth === 0) return i + 1;
    }
  }
  return i;
}

function readBalanced(text, i, open, close) {
  if (text[i] !== open) return null;
  let depth = 0;
  const start = i;
  for (; i < text.length; i += 1) {
    if (text[i] === open) depth += 1;
    else if (text[i] === close) {
      depth -= 1;
      if (depth === 0) return { end: i + 1, inner: text.slice(start + 1, i) };
    }
  }
  return null;
}

function splitArgs(inner) {
  const args = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < inner.length; i += 1) {
    const c = inner[i];
    if (c === '(' || c === '{' || c === '[') depth += 1;
    else if (c === ')' || c === '}' || c === ']') depth -= 1;
    else if (c === ',' && depth === 0) {
      args.push(inner.slice(start, i).trim());
      start = i + 1;
    }
  }
  args.push(inner.slice(start).trim());
  return args.filter(Boolean);
}

function effectFn(fn) {
  const marker = 'return () =>';
  const at = fn.indexOf(marker);
  if (at === -1) return fn;
  const brace = fn.indexOf('{', at + marker.length);
  const block = readBalanced(fn, brace, '{', '}');
  if (!block) return fn;
  const after = fn.slice(block.end).replace(/^\s*;/, '');
  return `${fn.slice(0, at)}onCleanup(() => {${block.inner}});${after}`;
}

/** Rewrite React hook calls into Solid. Returns the new source and signal names. */
function rewriteHooks(text) {
  const signalNames = [];
  const refNames = [];
  const re = /React\.(use[A-Za-z]+)/g;
  let out = '';
  let last = 0;
  let match = re.exec(text);
  while (match) {
    const hook = match[1];
    let i = match.index + match[0].length;
    i = skipGeneric(text, i);
    if (text[i] !== '(') {
      match = re.exec(text);
      continue;
    }
    const call = readBalanced(text, i, '(', ')');
    if (!call) break;
    const args = splitArgs(call.inner);
    let replacement = null;
    if (hook === 'useState') {
      replacement = `createSignal(${args[0] ?? ''})`;
      const decl = text.slice(last, match.index);
      const named = decl.match(/\[(\w+)\s*,/);
      if (named) signalNames.push(named[1]);
    } else if (hook === 'useRef') {
      replacement = `{ current: ${args[0] ?? 'null'} }`;
      const decl = text.slice(Math.max(0, match.index - 80), match.index);
      const named = decl.match(/const\s+(\w+)\s*=\s*$/);
      if (named) refNames.push(named[1]);
    } else if (hook === 'useCallback') {
      replacement = args[0] ?? '() => {}';
    } else if (hook === 'useMemo') {
      replacement = `createMemo(${args[0] ?? '() => undefined'})`;
    } else if (hook === 'useEffect' || hook === 'useLayoutEffect') {
      replacement = `createEffect(${effectFn(args[0] ?? '() => {}')})`;
    } else if (hook === 'useId') {
      replacement = 'createUniqueId()';
    } else if (hook === 'useImperativeHandle') {
      replacement = 'undefined';
    } else if (hook === 'useTransition') {
      replacement = '[false, (callback) => callback()]';
    }
    if (replacement == null) {
      match = re.exec(text);
      continue;
    }
    out += text.slice(last, match.index) + replacement;
    last = call.end;
    re.lastIndex = call.end;
    match = re.exec(text);
  }
  out += text.slice(last);
  return { text: out, signalNames, refNames };
}

function transformDemoTsx(src) {
  let text = src;
  text = text.replaceAll('@base-ui/react/', '@solidports/base-ui/');
  text = text.replaceAll("'@base-ui/react'", "'@solidports/base-ui'");
  text = text.replaceAll('"@base-ui/react"', '"@solidports/base-ui"');
  text = text.replace(/\bclassName=/g, 'class=');
  text = text.replace(/\bhtmlFor=/g, 'for=');

  // Keep the newline so a removed React import still occupies a line in the
  // demo source view. Short samples render fully, and a missing line shifts
  // every section below the demo.
  text = text.replace(/^['"]use client['"];[ \t]*\n/gm, '\n');
  text = text.replace(/import\s+\*\s+as\s+React\s+from\s+['"]react['"];?[ \t]*\n/g, '\n');
  text = text.replace(/import\s+React\s*,?\s*\{([^}]*)\}\s+from\s+['"]react['"];?[ \t]*\n/g, '\n');
  text = text.replace(/import\s+React\s+from\s+['"]react['"];?[ \t]*\n/g, '\n');
  text = text.replace(/import\s+\{([^}]*)\}\s+from\s+['"]react['"];?[ \t]*\n/g, '\n');
  text = text.replace(/import\s+type\s+\{([^}]*)\}\s+from\s+['"]react['"];?[ \t]*\n/g, '\n');
  text = text.replace(/<React\.Fragment(?:\s[^>]*)?>/g, '<>');
  text = text.replace(/<\/React\.Fragment>/g, '</>');
  text = text.replace(/React\.ComponentProps<'svg'>/g, 'JSX.SvgSVGAttributes<SVGSVGElement>');
  text = text.replace(/React\.ComponentProps<"svg">/g, 'JSX.SvgSVGAttributes<SVGSVGElement>');
  text = text.replace(/React\.CSSProperties/g, 'JSX.CSSProperties');
  text = text.replace(/React\.ReactNode/g, 'JSX.Element');
  text = text.replace(/React\.ReactElement/g, 'JSX.Element');

  const rewritten = rewriteHooks(text);
  text = rewritten.text;
  for (const name of rewritten.refNames) {
    text = text.replaceAll(
      `ref={${name}}`,
      `ref={(el) => { ${name}.current = el; }}`,
    );
  }

  for (const name of rewritten.signalNames) {
    const lines = text.split('\n');
    const expr = new RegExp(`\\{${name}\\}`, 'g');
    const member = new RegExp(`(?<![\\w.])${name}\\.(?!\\.)`, 'g');
    const compare = new RegExp(
      `(?<![\\w.])${name}(?=\\s*(?:===|!==|==|!=|>=|<=|[<>+?]|&&|\\|\\|))`,
      'g',
    );
    for (let i = 0; i < lines.length; i += 1) {
      if (lines[i].includes(`const [${name},`)) continue;
      lines[i] = lines[i].replace(expr, `{${name}()}`);
      lines[i] = lines[i].replace(member, `${name}().`);
      lines[i] = lines[i].replace(compare, `${name}()`);
      lines[i] = lines[i].replace(new RegExp(`\\breturn\\s+${name}\\b(?!\\()`), `return ${name}()`);
      lines[i] = lines[i].replace(new RegExp(`\\.\\.\\.${name}\\b(?!\\()`), `...${name}()`);
      lines[i] = lines[i].replace(new RegExp(`([?:]\\s*)${name}\\b(?!\\()`), `$1${name}()`);
    }
    text = lines.join('\n');
  }
  const memoNames = [...text.matchAll(/const\s+(\w+)\s*=\s*createMemo\(/g)].map((match) => match[1]);
  if (memoNames.length > 0) {
    const lines = text.split('\n');
    for (const name of memoNames) {
      const expr = new RegExp(`\\{${name}\\}`, 'g');
      for (let i = 0; i < lines.length; i += 1) {
        if (lines[i].includes(`const ${name} = createMemo`)) continue;
        lines[i] = lines[i].replace(expr, `{${name}()}`);
      }
    }
    text = lines.join('\n');
  }
  text = text.replace(/\btoasts\./g, 'toasts().');
  /* Solid's style inliner writes object keys verbatim. CamelCase is not a CSS property. */
  text = text.replace(/\bmarginLeft:/g, '"margin-left":');
  text = text.replace(/\bborderTop:/g, '"border-top":');
  text = text.replace(/\bminWidth:/g, '"min-width":');
  text = text.replace(
    /return toasts\(\)\.map\(\(([^)]+)\) => \(([\s\S]*?)\)\);/g,
    'return (\n    <For each={toasts()}>\n      {($1) => ($2)}\n    </For>\n  );',
  );
  text = text.replace(
    /return toasts\(\)\.map\(\(([^)]+)\) => (<[^;]+)\);/g,
    'return (\n    <For each={toasts()}>\n      {($1) => $2}\n    </For>\n  );',
  );
  text = text.replace(/render=\{<([A-Za-z0-9.]+) \/>\}/g, 'render={(props) => <$1 {...props} />}');
  text = text.replace(/\{value\.map\(/g, '{(Array.isArray(value) ? value : []).map(');
  text = text.replace(/<Select\.Label\b/g, '<label');
  text = text.replace(/<\/Select\.Label>/g, '</label>');
  text = text.replace(/import\s+\{[^}]+\}\s+from\s+'motion\/react';\n*/g, '');
  text = text.replace(/<motion\.div\b[\s\S]*?\/>/g, '<div />');
  text = text.replace(/<motion\.div\b([^>]*)>/g, '<div$1>');
  text = text.replace(/<\/motion\.div>/g, '</div>');
  text = text.replace(/<\/?AnimatePresence>/g, '');
  if (/\bReact\./.test(text)) {
    text = `const React = { forwardRef: (render) => (props) => render(props, props.ref), useActionState: (_action, initial) => [initial, () => {}, false] };\n${text}`;
  }

  const needed = [];
  if (text.includes('createSignal(')) needed.push('createSignal');
  if (text.includes('createEffect(')) needed.push('createEffect');
  if (text.includes('createMemo(')) needed.push('createMemo');
  if (text.includes('createUniqueId(')) needed.push('createUniqueId');
  if (/\bonCleanup\(/.test(text)) needed.push('onCleanup');
  if (text.includes('<For')) needed.push('For');
  const typeJsx = /JSX\.(SvgSVGAttributes|CSSProperties|Element)/.test(text);
  if (needed.length > 0 || typeJsx) {
    const names = [...new Set(needed)];
    if (typeJsx) names.push('type JSX');
    if (!text.includes("from 'solid-js'") && !text.includes('from "solid-js"')) {
      text = `import { ${names.join(', ')} } from 'solid-js';\n${text}`;
    }
  }

  text = text.replace(/\bReact\.useId\(/g, 'createUniqueId(');
  if (text.includes('createUniqueId(') && !text.includes('createUniqueId')) {
    text = text.replace(
      "from 'solid-js';",
      "from 'solid-js';\nimport { createUniqueId } from 'solid-js';",
    );
    if (!text.includes("from 'solid-js'")) {
      text = `import { createUniqueId } from 'solid-js';\n${text}`;
    }
  }

  return text;
}

function transformMdx(src, pageRelDir) {
  let text = src;
  text = text.replaceAll('@base-ui/react/', '@solidports/base-ui/');
  text = text.replaceAll("'@base-ui/react'", "'@solidports/base-ui'");
  text = text.replaceAll('"@base-ui/react"', '"@solidports/base-ui"');
  text = text.replaceAll('/react/', '/solid/');
  text = text.replaceAll('unstyled React ', 'unstyled Solid ');
  text = text.replaceAll('Headless React Components', 'Headless Solid Components');
  text = text.replaceAll('React Accordion', 'Solid Accordion');


  const prefix = demoPrefixFromPageDir(pageRelDir);
  const demoImports = [];
  text = text.replace(
    /import\s+\{\s*(\w+)\s*\}\s+from\s+'\.\/demos\/([^']+)';\n*/g,
    (_m, ident, demoName) => {
      const path = prefix ? `${prefix}/${demoName}` : demoName;
      demoImports.push({ ident, path });
      return '';
    },
  );
  text = text.replace(
    /import\s+\{\s*(\w+)\s*\}\s+from\s+'(\.\.\/)+components\/([^']+)\/demos\/([^']+)';\n*/g,
    (_m, ident, _up, component, demoName) => {
      demoImports.push({ ident, path: `${component}/${demoName}` });
      return '';
    },
  );
  text = text.replace(
    /import\s+\{\s*(\w+)\s*\}\s+from\s+'(?:\.\.\/)+([^/'"]+)\/demos\/([^']+)';\n*/g,
    (_m, ident, component, demoName) => {
      demoImports.push({ ident, path: `${component}/${demoName}` });
      return '';
    },
  );

  for (const { ident, path } of demoImports) {
    text = text.replace(
      new RegExp(`<${ident}(\\s[^>]*)?\\s*/>`, 'g'),
      (_m, attrs) => {
        const compact = attrs && /\bcompact\b/.test(attrs) ? ' compact' : '';
        return `<Demo path="${path}"${compact} />`;
      },
    );
  }

  const typeTags = [...text.matchAll(/<Types([A-Za-z0-9]+)(?:\.(\w+))?/g)];
  const partNames = [
    ...new Set(typeTags.map((m) => m[2]).filter((p) => p && p !== 'useFilter' && !p.startsWith('use'))),
  ];
  const typeRoots = [...new Set(typeTags.map((m) => m[1].replace(/AdditionalTypes$|Additional$/, '')))];
  text = text.replace(/import\s+\{[^}]*Types[^}]*\}\s+from\s+'[^']*types';\n*/g, '');
  text = text.replace(/<Types[A-Za-z0-9.]+(?:\s[^>]*)?\s*\/>\n*/g, '');
  if (typeRoots.length > 0) {
    const component = typeRoots[0];
    const partsAttr = partNames.length > 0 ? ` parts="${partNames.join(', ')}"` : '';
    const tag = `<Reference component="${component}"${partsAttr} />`;
    if (text.includes('## API reference')) {
      text = text.replace('## API reference', `## API reference\n\n${tag}`);
    } else {
      text += `\n\n## API reference\n\n${tag}\n`;
    }
    text = text.replace(/\n### [A-Za-z][A-Za-z0-9]*\n(?=\n### |\nexport |\n## |\n$)/g, '\n');
  }

  text = text.replace(/<!--([\s\S]*?)-->/g, '{/*$1*/}');
  text = text.replace(/\n{3,}/g, '\n\n');
  if (pageRelDir === '.') {
    text = text.replace(/^# React\b/m, '# Solid');
  }
  return `${GENERATED_BANNER}\n\n${text.trim()}\n`;
}

function pageOutPath(relFromReactPages) {
  // Always use index.mdx so a section file never collides with a child folder
  // (overview.mdx vs overview/quick-start.mdx breaks Vinxi nested routes).
  if (relFromReactPages === 'page.mdx') return 'index.mdx';
  if (relFromReactPages.endsWith('/page.mdx')) {
    return relFromReactPages.replace(/page\.mdx$/, 'index.mdx');
  }
  return relFromReactPages;
}

/** Titles, hrefs, and tags from the React outline lists (the createSitemap source). */
function parseOutlineList(mdx) {
  const end = mdx.search(/DO NOT EDIT AFTER THIS LINE/);
  const head = end === -1 ? mdx : mdx.slice(0, end);
  const pages = [];
  for (const rawLine of head.split('\n')) {
    const line = rawLine.trim();
    if (!line.startsWith('- ')) continue;
    const body = line.slice(2).trim();
    const single = body.match(/^\[([^\]]+)\]\(([^)]+)\)\s*(.*)$/);
    if (single && !body.includes('[Contents]')) {
      const tags = [...single[3].matchAll(/\[([^\]]+)\]/g)].map((m) => m[1]);
      const page = { title: single[1], path: single[2] };
      if (tags.length > 0) page.tags = tags;
      pages.push(page);
      continue;
    }
    const titled = body.match(/^(.*?)\s+-\s+\((.*)\)\s*$/);
    if (!titled) continue;
    const tags = [...titled[1].matchAll(/\[([^\]]+)\]/g)].map((m) => m[1]);
    const title = titled[1].replace(/\s*\[[^\]]+\]/g, '').trim();
    const contents = titled[2].match(/\[Contents\]\(([^)]+)\)/);
    if (!contents) continue;
    const page = { title, path: contents[1] };
    if (tags.length > 0) page.tags = tags;
    pages.push(page);
  }
  return pages;
}

function generateSitemap() {
  const specs = [
    ['Overview', 'overview/page.mdx', '/solid/overview/'],
    ['Handbook', 'handbook/page.mdx', '/solid/handbook/'],
    ['Components', 'components/page.mdx', '/solid/components/'],
    ['Utils', 'utils/page.mdx', '/solid/utils/'],
  ];
  const sections = {};
  for (const [name, rel, prefix] of specs) {
    const mdx = readFileSync(join(REACT_PAGES, rel), 'utf8');
    sections[name] = { prefix, pages: parseOutlineList(mdx) };
  }

  return `/* Generated by bun run docs:generate. */
export interface SitemapPage {
  title: string
  path: string
  tags?: string[]
  isNew?: boolean
  isPreview?: boolean
}

export interface SitemapSection {
  title?: string
  prefix?: string
  pages: SitemapPage[]
}

export interface Sitemap {
  data: Record<string, SitemapSection>
}

export const sitemap: Sitemap = ${JSON.stringify({ data: sections }, null, 2)}
`;
}

function copyChromeCss() {
  const fromCss = join(REACT, 'src/css');
  const toCss = join(SOLID, 'src/css');
  if (existsSync(fromCss)) {
    if (existsSync(toCss)) rmSync(toCss, { recursive: true });
    copyTree(fromCss, toCss);
    const index = join(toCss, 'index.css');
    if (existsSync(index)) {
      let css = readFileSync(index, 'utf8');
      css = css.replaceAll(
        "'../app/(docs)/**/demos/**/*.{ts,tsx}'",
        "'../demos/solid/**/*.{ts,tsx}'",
      );
      css = css.replaceAll(
        "'../app/(docs)/**/demos/**/*.css'",
        "'../demos/solid/**/*.css'",
      );
      if (!css.includes("@source '../components/**/*.{ts,tsx}'")) {
        css = css.replace(
          "@source '../demos/solid/**/*.{ts,tsx}';",
          `@source '../demos/solid/**/*.{ts,tsx}';
@source '../components/**/*.{ts,tsx}';
@source '../routes/**/*.{ts,tsx,mdx}';`,
        );
      }
      writeCss(index, css);
    }
  }

  const reactComponents = join(REACT, 'src/components');
  const solidComponents = join(SOLID, 'src/components');
  if (existsSync(reactComponents) && existsSync(solidComponents)) {
    for (const file of walk(reactComponents)) {
      if (!file.endsWith('.css')) continue;
      const rel = relative(reactComponents, file);
      const dest = join(solidComponents, rel);
      writeCss(dest, readFileSync(file, 'utf8'));
    }
  }

  const demoData = join(REACT, 'src/demo-data');
  if (existsSync(demoData)) copyTree(demoData, join(SOLID, 'src/demo-data'));

  const releases = join(REACT, 'src/data/releases.ts');
  if (existsSync(releases)) {
    let t = readFileSync(releases, 'utf8');
    t = t.replaceAll('@base-ui/react', '@solidports/base-ui');
    write(join(SOLID, 'src/data/releases.ts'), t);
  }

  const reactPublicFonts = join(REACT, 'public/fonts');
  const solidPublicFonts = join(SOLID, 'public/fonts');
  if (existsSync(reactPublicFonts)) copyTree(reactPublicFonts, solidPublicFonts);

  const reactLayoutCss = join(REACT, 'src/app/(docs)/layout.css');
  const solidLayoutCss = join(SOLID, 'src/routes/(docs)/layout.css');
  if (existsSync(reactLayoutCss)) writeCss(solidLayoutCss, readFileSync(reactLayoutCss, 'utf8'));
}

function generateDemos() {
  if (existsSync(SOLID_DEMOS)) rmSync(SOLID_DEMOS, { recursive: true });
  const files = walk(REACT_PAGES);
  let n = 0;
  for (const file of files) {
    const rel = relative(REACT_PAGES, file);
    const m = rel.match(/^(.*)\/demos\/(.+)$/);
    if (!m) continue;
    const pageDir = m[1];
    const rest = m[2]; // hero/css-modules/index.tsx
    if (rest.endsWith('index.ts') && !rest.endsWith('index.tsx')) continue;
    const prefix = demoPrefixFromPageDir(pageDir);
    const dest = join(SOLID_DEMOS, prefix, rest);
    let body = readFileSync(file, 'utf8');
    if (file.endsWith('.tsx') || file.endsWith('.ts') || file.endsWith('.jsx') || file.endsWith('.js')) {
      body = transformDemoTsx(body);
    }
    write(dest, body);
    n += 1;
  }
  return n;
}

function generatePages() {
  if (existsSync(SOLID_ROUTES)) rmSync(SOLID_ROUTES, { recursive: true });
  const files = walk(REACT_PAGES).filter((f) => f.endsWith('page.mdx'));
  for (const file of files) {
    const rel = relative(REACT_PAGES, file);
    const pageDir = dirname(rel);
    const outRel = pageOutPath(rel);
    const dest = join(SOLID_ROUTES, outRel);
    const body = transformMdx(readFileSync(file, 'utf8'), pageDir);
    write(dest, body);
  }
  write(join(SOLID, 'src/sitemap.ts'), generateSitemap());
  return files.length;
}

function transformSolidTsx(src) {
  let text = src;
  text = text.replace(/<React\.Fragment>/g, '<>');
  text = text.replace(/<\/React\.Fragment>/g, '</>');
  text = text.replace(/^import \* as React from 'react';\n/m, '');
  text = text.replace(/^import type \{[^}]+\} from 'next(?:\/types)?';\n/gm, '');
  text = text.replace(/\bclassName=/g, 'class=');
  text = text.replaceAll('@base-ui/react/', '@solidports/base-ui/');
  text = text.replaceAll('@base-ui/react', '@solidports/base-ui');
  text = text.replaceAll('/react/', '/solid/');
  text = text.replace(
    /props: React\.ComponentProps<'svg'>/g,
    'props: JSX.SvgSVGAttributes<SVGSVGElement>',
  );
  if (text.includes('JSX.SvgSVGAttributes') && !text.includes("from 'solid-js'")) {
    text = `import type { JSX } from 'solid-js';\n${text}`;
  }
  return text;
}

const HOME_LAYOUT = `import type { ParentProps } from 'solid-js'
import { Link } from '../components/Link'
import { Logo } from '../components/Logo'
import { Search } from '../components/Search'
import './css/index.css'

export function HomeLayout(props: ParentProps) {
  return (
    <div class="Body bui-p-6 bp2:bui-py-7 bp2:bui-px-9" style={{ 'min-height': '100vh' }}>
      <div
        class="bui-bs-bb bui-d-g bui-gtc-8 bui-g-8 bp2:bui-g-9"
        style={{ 'max-width': '1480px', 'margin-inline': 'auto' }}
      >
        <header class="bui-d-c">
          <div class="bui-gcs-1 bui-gce-4">
            <Logo aria-label="Base UI" />
          </div>
          <nav
            class="bui-d-f bui-fd-c bui-g-2 bui-gcs-5 bui-gce-8 bp2:bui-gcs-5 bp2:bui-gce-9 bp3:bui-gcs-5 bp3:bui-gce-7"
            aria-label="social links"
          >
            <Link class="Text sz-1" href="https://x.com/base_ui">
              X
            </Link>
            <Link class="Text sz-1" href="https://github.com/mui/base-ui">
              GitHub
            </Link>
            <Link class="Text sz-1" href="https://base-ui.com/r/discord">
              Discord
            </Link>
          </nav>
          <div class="bui-d-n bp3:bui-d-f bui-fd-c bui-g-2 bui-ai-s bui-gcs-7 bui-gce-9">
            <Search enableKeyboardShortcut mobileTriggerClass="bui-d-n" />
          </div>
        </header>
        <main id="main" class="bui-d-c">
          {props.children}
        </main>
        <div class="bui-gcs-1 bui-gce-9 bp3:bui-gcs-3">
          <div class="Separator" role="separator" aria-hidden="true" />
        </div>
        <footer class="bui-d-c">
          <div class="bui-gcs-1 bui-gce-9 bp2:bui-gce-3">
            <span class="Text sz-1">© Base UI</span>
          </div>
          <nav
            class="bui-d-f bui-fd-c bui-g-2 bui-gcs-1 bui-gce-9 bp2:bui-gcs-3 bp4:bui-gce-7"
            aria-label="social links"
          >
            <Link class="Text sz-1" href="https://x.com/base_ui">
              X
            </Link>
            <Link class="Text sz-1" href="https://github.com/mui/base-ui">
              GitHub
            </Link>
            <Link class="Text sz-1" href="https://base-ui.com/r/discord">
              Discord
            </Link>
            <Link class="Text sz-1" href="https://www.npmjs.com/package/@solidports/base-ui">
              npm
            </Link>
            <Link class="Text sz-1" href="https://bsky.app/profile/base-ui.com">
              Bluesky
            </Link>
          </nav>
        </footer>
      </div>
    </div>
  )
}
`

function generateWebsite() {
  const site = join(REACT, 'src/app/(website)');
  const dest = join(SOLID, 'src/website');
  if (existsSync(dest)) rmSync(dest, { recursive: true });
  copyTree(join(site, 'css'), join(dest, 'css'));
  for (const folder of ['logos', 'icons']) {
    const from = join(site, folder);
    if (!existsSync(from)) continue;
    for (const file of walk(from)) {
      const rel = relative(from, file);
      let body = readFileSync(file, 'utf8');
      if (file.endsWith('.tsx') || file.endsWith('.ts')) body = transformSolidTsx(body);
      write(join(dest, folder, rel), body);
    }
  }
  let page = readFileSync(join(site, 'page.tsx'), 'utf8');
  const metaAt = page.search(/\nconst description =|\nexport const metadata/);
  if (metaAt !== -1) page = page.slice(0, metaAt);
  page = transformSolidTsx(page);
  page = page.replaceAll("from 'docs/src/components/Link'", "from '../components/Link'");
  page = page.replace(
    /dangerouslySetInnerHTML=\{\{\s*__html:\s*JSON\.stringify\(([\s\S]*?)\)\s*,?\s*\}\}/g,
    'innerHTML={JSON.stringify($1)}',
  );
  page = page.replaceAll('process.env.BASE_URL', "'https://base-ui.com'");
  page = page.replaceAll('process.env.SOURCE_CODE_REPO', "'https://github.com/mui/base-ui'");
  page = page.replace(/\s*\/\/ eslint-disable-next-line react\/no-danger\n/g, '\n');
  write(join(dest, 'page.tsx'), `${page.trim()}\n`);
  write(join(dest, 'HomeLayout.tsx'), HOME_LAYOUT);
  write(
    join(SOLID, 'src/routes/index.tsx'),
    `import { HomeLayout } from '../website/HomeLayout'
import Homepage from '../website/page'

export default function Home() {
  return (
    <HomeLayout>
      <Homepage />
    </HomeLayout>
  )
}
`,
  );
}

function patchSolidCssImport() {
  const appTsx = join(SOLID, 'src/app.tsx');
  if (existsSync(join(SOLID, 'src/css/index.css')) && existsSync(appTsx)) {
    let t = readFileSync(appTsx, 'utf8');
    t = t.replace('import "./app.css"', 'import "./css/index.css"');
    t = t.replace("import './app.css'", "import './css/index.css'");
    writeFileSync(appTsx, t);
  }
  // Tailwind v4 resolves nested @import paths as src/src/css/*; duplicate the folder.
  // Imports written for src/css (`../components`) must climb one more level from the copy.
  const twCss = join(SOLID, 'src', 'src', 'css');
  rmSync(twCss, { recursive: true, force: true });
  copyTree(join(SOLID, 'src', 'css'), twCss);
  const twIndex = join(twCss, 'index.css');
  if (existsSync(twIndex)) {
    const css = readFileSync(twIndex, 'utf8').replaceAll("'../", "'../../");
    writeFileSync(twIndex, css);
  }
}

if (!existsSync(REACT_PAGES)) {
  console.error('docs/react snapshot missing. Run bun run docs:sync first.');
  process.exit(1);
}

console.log('copying chrome CSS / demo-data / releases…');
copyChromeCss();
console.log('generating demos…');
const demos = generateDemos();
console.log('generating pages…');
const pages = generatePages();
console.log('generating homepage…');
generateWebsite();
patchSolidCssImport();
console.log(`wrote ${pages} MDX pages and ${demos} demo files`);
