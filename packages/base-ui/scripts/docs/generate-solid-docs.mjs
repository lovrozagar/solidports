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
/** Hand-ported demos the transforms cannot express, copied over the generated ones. */
const SOLID_DEMO_OVERRIDES = join(SOLID, 'overrides/demos');

/**
 * Left out of the Solid docs until a Solid 2 library exists: React Hook Form has no Solid port, and
 * `@tanstack/solid-virtual` targets Solid 1. Remove an entry to bring its demo and section back.
 */
const EXCLUDED = [
  {
    demo: 'handbook/forms/react-hook-form',
    page: 'handbook/forms',
    heading: 'React Hook Form',
    mentions: ['[React Hook Form](#react-hook-form) and ', "    'React Hook Form Integration',\n"],
  },
  { demo: 'combobox/virtualized', page: 'components/combobox', heading: 'Virtualized', level: 3, mentions: [] },
  { demo: 'autocomplete/virtualized', page: 'components/autocomplete', heading: 'Virtualized', level: 3, mentions: [] },
];

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

/**
 * Every output path this run produced. Output folders are pruned against it instead of being
 * deleted up front: removing a folder under a running Vite dev server drops its file watcher.
 */
const written = new Set();

/** Writes only when the content changed, so regenerating does not trigger a reload storm. */
function write(p, body) {
  written.add(p);
  if (existsSync(p) && readFileSync(p).equals(Buffer.from(body))) return;
  ensureDir(dirname(p));
  writeFileSync(p, body);
}

/** Deletes files under `dir` this run did not write, then any folders left empty. */
function pruneStale(dir) {
  if (!existsSync(dir)) return;
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) {
      pruneStale(path);
      if (readdirSync(path).length === 0) rmSync(path, { recursive: true });
    } else if (!written.has(path)) {
      rmSync(path);
    }
  }
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
  write(dest, expandCustomMedia(css));
}

/** Copies `from` into `to`. Top-level names in `skip` are left for the caller to write. */
function copyTree(from, to, skip = []) {
  if (!existsSync(from)) return;
  ensureDir(to);
  for (const name of readdirSync(from)) {
    if (skip.includes(name)) continue;
    const src = join(from, name);
    const dest = join(to, name);
    if (statSync(src).isDirectory()) copyTree(src, dest);
    else if (name.endsWith('.css')) writeCss(dest, readFileSync(src, 'utf8'));
    else write(dest, readFileSync(src));
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

/**
 * `useEffect(fn, deps)` → Solid 2. A mount-only effect (`[]`) becomes `onSettled(fn)`, which runs
 * after the first render and may return a cleanup; a body that only returns a cleanup becomes
 * `onCleanup`. Other deps map to the two-phase `createEffect(() => deps, fn)`.
 */
function effectCall(args) {
  const fn = args[0] ?? '() => {}';
  const deps = args[1];
  if (deps !== undefined && deps.replace(/\s/g, '') !== '[]') {
    console.warn(`docs:generate: useEffect deps ${deps} need review; emitted createEffect(compute, apply).`);
    return `createEffect(() => ${deps}, ${fn})`;
  }
  const body = /^\(\)\s*=>\s*\{([\s\S]*)\}$/.exec(fn.trim());
  const cleanupOnly = body && /^\s*return\s*\(\)\s*=>\s*(\{[\s\S]*\})\s*;?\s*$/.exec(body[1]);
  if (cleanupOnly) {
    /* The cleanup sat one function deeper in React; drop that indent level. */
    const block = cleanupOnly[1].replace(/\n {2}/g, '\n');
    return `onCleanup(() => ${block})`;
  }
  return `onSettled(${fn})`;
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
    const genericAt = match.index + match[0].length;
    const i = skipGeneric(text, genericAt);
    /* Type arguments carry over: without them `createSignal([])` infers `never[]`. */
    const generic = text.slice(genericAt, i);
    const typeArg = generic.slice(1, -1).trim();
    if (text[i] !== '(') {
      match = re.exec(text);
      continue;
    }
    const call = readBalanced(text, i, '(', ')');
    if (!call) break;
    const args = splitArgs(call.inner);
    let replacement = null;
    if (hook === 'useState') {
      replacement = `createSignal${generic}(${args[0] ?? ''})`;
      const decl = text.slice(last, match.index);
      const named = decl.match(/\[(\w+)\s*,/);
      if (named) signalNames.push(named[1]);
    } else if (hook === 'useRef') {
      /* React's `useRef<T>(null)` is a `RefObject<T | null>`. */
      const initial = args[0] ?? 'undefined';
      let current = initial;
      if (typeArg) {
        const nullable =
          initial === 'null' && !/\bnull\b/.test(typeArg) ? `${typeArg} | null` : typeArg;
        current = `${initial} as ${nullable}`;
      }
      replacement = `{ current: ${current} }`;
      const decl = text.slice(Math.max(0, match.index - 80), match.index);
      const named = decl.match(/const\s+(\w+)\s*=\s*$/);
      if (named) refNames.push(named[1]);
    } else if (hook === 'useCallback') {
      replacement = args[0] ?? '() => {}';
    } else if (hook === 'useMemo') {
      replacement = `createMemo${generic}(${args[0] ?? '() => undefined'})`;
    } else if (hook === 'useEffect' || hook === 'useLayoutEffect') {
      replacement = effectCall(args);
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

/** React `key` is a reconciliation hint. Solid has no equivalent and renders it as a DOM attribute. */
function stripReactKeys(text) {
  const re = /(\n[ \t]*|[ \t]+)key=\{/g;
  let out = '';
  let last = 0;
  let match;
  while ((match = re.exec(text))) {
    const block = readBalanced(text, match.index + match[0].length - 1, '{', '}');
    if (!block) continue;
    out += text.slice(last, match.index);
    last = block.end;
    re.lastIndex = block.end;
  }
  return out + text.slice(last);
}

/** Solid writes `style={{ ... }}` keys verbatim, and camelCase is not a CSS property. */
function kebabStyleKeys(text) {
  const re = /style=\{\{/g;
  let match;
  while ((match = re.exec(text))) {
    const object = readBalanced(text, match.index + match[0].length - 1, '{', '}');
    if (!object) continue;
    const inner = object.inner.replace(
      /(^\s*|,\s*)([a-z]+(?:[A-Z][a-z0-9]*)+)(\s*:)/g,
      (_m, lead, key, colon) => `${lead}"${key.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}"${colon}`,
    );
    text = `${text.slice(0, match.index + match[0].length)}${inner}${text.slice(object.end - 1)}`;
    re.lastIndex = match.index + match[0].length + inner.length;
  }
  return text;
}

/** React prop names that Solid 2 writes under their DOM attribute names. */
const DOM_ATTRIBUTE_NAMES = {
  htmlFor: 'for',
  autoComplete: 'autocomplete',
  autoFocus: 'autofocus',
  crossOrigin: 'crossorigin',
  itemProp: 'itemprop',
  itemScope: 'itemscope',
  itemType: 'itemtype',
  maxLength: 'maxlength',
  minLength: 'minlength',
  noValidate: 'novalidate',
  readOnly: 'readonly',
  spellCheck: 'spellcheck',
  tabIndex: 'tabindex',
  clipPath: 'clip-path',
  clipRule: 'clip-rule',
  fillOpacity: 'fill-opacity',
  fillRule: 'fill-rule',
  stopColor: 'stop-color',
  strokeDasharray: 'stroke-dasharray',
  strokeLinecap: 'stroke-linecap',
  strokeLinejoin: 'stroke-linejoin',
  strokeMiterlimit: 'stroke-miterlimit',
  strokeOpacity: 'stroke-opacity',
  strokeWidth: 'stroke-width',
  vectorEffect: 'vector-effect',
};

/** Renames JSX attributes (`name=` or a bare boolean `name`) to their DOM names. */
function renameDomAttributes(text) {
  const rename = (_m, lead, name) => `${lead}${DOM_ATTRIBUTE_NAMES[name]}`;
  const names = Object.keys(DOM_ATTRIBUTE_NAMES).join('|');
  const booleans = 'autoFocus|itemScope|noValidate|readOnly';
  return text
    .replace(new RegExp(`(\\s)(${names})(?==)`, 'g'), rename)
    .replace(new RegExp(`(\\s)(${booleans})(?=\\s*\\/?>|\\s+[A-Za-z{]|[ \\t]*\\n)`, 'g'), rename);
}

/**
 * Solid types `style` as `CSSProperties | string`, so an icon that merges `...props.style` into its
 * own style object (React's `ComponentProps<'svg'>` style is always an object) narrows `style`.
 */
function objectStyleSvgProps(text) {
  const re = /(function \w+\(props: )JSX\.SvgSVGAttributes<SVGSVGElement>(\) \{)/g;
  let match;
  while ((match = re.exec(text))) {
    const body = readBalanced(text, match.index + match[0].length - 1, '{', '}');
    if (!body || !body.inner.includes('...props.style')) continue;
    const head = `${match[1]}Omit<JSX.SvgSVGAttributes<SVGSVGElement>, 'style'> & { style?: JSX.CSSProperties }${match[2]}`;
    text = text.slice(0, match.index) + head + text.slice(match.index + match[0].length);
    re.lastIndex = match.index + head.length;
  }
  return text;
}

/**
 * `<Combobox.Value>` and `<Autocomplete.Value>` pass their render function an accessor so the
 * rendered children track the selection. Type the parameter as one and call it where it is read.
 */
function accessorValueChildren(text) {
  const re = /<(Combobox|Autocomplete)\.Value>\s*\{\s*\((\w+)(?::\s*([^)]+))?\)\s*=>/g;
  let match;
  while ((match = re.exec(text))) {
    const [, part, name, type] = match;
    /* React passes Autocomplete render functions `String(inputValue)`. */
    const read = part === 'Autocomplete' ? `String(${name}())` : `${name}()`;
    const container = text.lastIndexOf('{', match.index + match[0].length);
    const block = readBalanced(text, container, '{', '}');
    if (!block) continue;
    const arrowEnd = match.index + match[0].length;
    const head = type
      ? text.slice(container, arrowEnd).replace(`${name}: ${type}`, `${name}: Accessor<${type.trim()}>`)
      : text.slice(container, arrowEnd);
    const body = text
      .slice(arrowEnd, block.end)
      .replace(new RegExp(`(?<![\\w$.'"])${name}(?![\\w$(:'"])`, 'g'), read);
    text = text.slice(0, container) + head + body + text.slice(block.end);
    re.lastIndex = container + head.length;
  }
  return text;
}

/**
 * React's `onChange` on a text field fires on every edit (the native `input` event). Solid binds
 * the native `change` event, which fires on commit, so a controlled field would lag behind.
 */
function nativeInputEvents(text) {
  const re = /<(input|textarea)\b/g;
  let match;
  while ((match = re.exec(text))) {
    let depth = 0;
    let end = match.index + match[0].length;
    for (; end < text.length; end += 1) {
      const c = text[end];
      if (c === '{') depth += 1;
      else if (c === '}') depth -= 1;
      else if (c === '>' && depth === 0) break;
    }
    const tag = text.slice(match.index, end).replace(/(\s)onChange=/g, '$1onInput=');
    text = text.slice(0, match.index) + tag + text.slice(end);
  }
  return text;
}

/** Skips whitespace and JS comments from `i`. */
function skipTrivia(text, i) {
  for (;;) {
    while (i < text.length && /\s/.test(text[i])) i += 1;
    if (text.startsWith('//', i)) i = text.indexOf('\n', i) + 1 || text.length;
    else if (text.startsWith('/*', i)) i = text.indexOf('*/', i) + 2;
    else return i;
  }
}

/** Index just past the `/>` that closes a self-closing JSX tag, or -1 if the tag has children. */
function selfClosingEnd(text, i) {
  let depth = 0;
  let quote = null;
  for (; i < text.length; i += 1) {
    const c = text[i];
    if (quote) {
      if (c === quote) quote = null;
    } else if (c === '"' || c === "'" || c === '`') quote = c;
    else if (c === '{') depth += 1;
    else if (c === '}') depth -= 1;
    else if (depth === 0 && c === '/' && text[i + 1] === '>') return i + 2;
    else if (depth === 0 && c === '>') return -1;
  }
  return -1;
}

/**
 * `render={<X a={b} />}` → `render={(props) => <X {...props} a={b} />}`. React clones the element
 * with `mergeProps(props, element.props)`. Solid evaluates JSX to a DOM node immediately and cannot
 * clone it, so the element becomes a render function. A `class` on the element joins the part's
 * class through Base UI `mergeProps`, as `className` does in React.
 */
function rewriteRenderElements(text) {
  const re = /render=\{/g;
  let match;
  let usesMergeProps = false;
  while ((match = re.exec(text))) {
    const open = match.index + match[0].length;
    const tagAt = skipTrivia(text, open);
    if (text[tagAt] !== '<') continue;
    const name = /^<([A-Za-z][\w.]*)/.exec(text.slice(tagAt));
    if (!name) continue;
    const afterName = skipGeneric(text, tagAt + name[0].length);
    const end = selfClosingEnd(text, afterName);
    if (end === -1) continue;
    const close = skipTrivia(text, end);
    if (text[close] !== '}') continue;

    let attrs = text.slice(afterName, end - 2).trimEnd();
    let spread = '{...props}';
    const classAttr = /(\s+)class=("[^"]*"|'[^']*'|\{)/.exec(attrs);
    if (classAttr) {
      let value = classAttr[2];
      let attrEnd = classAttr.index + classAttr[0].length;
      if (value === '{') {
        const expr = readBalanced(attrs, attrEnd - 1, '{', '}');
        value = `{ get class() { return ${expr.inner.trim()}; } }`;
        attrEnd = expr.end;
      } else {
        value = `{ class: ${value} }`;
      }
      attrs = attrs.slice(0, classAttr.index) + attrs.slice(attrEnd);
      spread = `{...mergeProps(props, ${value})}`;
      usesMergeProps = true;
    }
    const element = `${text.slice(tagAt, afterName)} ${spread}${attrs} />`;
    const replacement = `${text.slice(open, tagAt)}(props) => ${element}${text.slice(end, close)}`;
    text = text.slice(0, open) + replacement + text.slice(close);
    re.lastIndex = open + replacement.length;
  }
  if (usesMergeProps && !text.includes("from '@solidports/base-ui/merge-props'")) {
    text = `import { mergeProps } from '@solidports/base-ui/merge-props';\n${text}`;
  }
  return text;
}

/** React renders a bare `aria-*` as "true". Solid renders `""`, which ARIA reads as unset. */
function stringifyBareAria(text) {
  return text.replace(/(\s)(aria-[a-z]+)(?=\s*\/?>|\s+[A-Za-z{]|[ \t]*\n)/g, '$1$2="true"');
}

/**
 * `({ className, ...props }) => <X class={clsx(.., className)} {...props} />` destructures Solid
 * props, which reads `children` eagerly outside the parent's context. Rewrite to `omit`.
 * `React.forwardRef` wrappers become plain components: Solid passes `ref` as a prop.
 */
function rewriteDestructuredProps(text) {
  const headers = [
    {
      re: /export const (\w+) = React\.forwardRef<[^,>]+,\s*([\w.<>]+)>\(\s*function \w+\(\s*\{ className, \.\.\.props \}: [\w.<>]+,\s*forwardedRef: React\.ForwardedRef<\w+>,?\s*\) \{/,
      head: (m) => `export function ${m[1]}(props: ${m[2]}) {`,
      children: false,
      forwardRef: true,
    },
    {
      re: /(export )?function (\w+)(<[^>(]*>)?\(\{ className,( children,)? \.\.\.props \}: ([^)]+)\) \{/,
      head: (m) => `${m[1] ?? ''}function ${m[2]}${m[3] ?? ''}(props: ${m[5]}) {`,
      children: (m) => Boolean(m[4]),
      forwardRef: false,
    },
  ];
  for (const { re, head, children, forwardRef } of headers) {
    let match;
    while ((match = re.exec(text))) {
      const braceAt = match.index + match[0].length - 1;
      const body = readBalanced(text, braceAt, '{', '}');
      if (!body) break;
      const withChildren = typeof children === 'function' ? children(match) : children;
      const keys = withChildren ? "'class', 'children'" : "'class'";
      let inner = body.inner
        .replace(/\bclassName\b/g, 'props.class')
        .replace(/\{\.\.\.props\}/g, '{...others}')
        .replace(/\n[ \t]*ref=\{forwardedRef\}/g, '');
      if (withChildren) inner = inner.replace(/(?<![\w.])children(?![\w:])/g, 'props.children');
      if (forwardRef) inner = dedent(inner, 2);
      let rest = text.slice(body.end);
      if (forwardRef) rest = rest.replace(/^\s*,?\s*\)\s*;?/, '');
      text = `${text.slice(0, match.index)}${head(match)}\n  const others = omit(props, ${keys});${inner}}${rest}`;
    }
  }
  return text;
}

/** Re-indent a block body so its shallowest line sits at `indent` spaces. */
function dedent(block, indent) {
  const depths = block
    .split('\n')
    .filter((line) => line.trim())
    .map((line) => line.match(/^ */)[0].length);
  const shift = Math.min(...depths) - indent;
  if (shift <= 0) return block;
  return block
    .split('\n')
    .map((line) => (line.startsWith(' '.repeat(shift)) ? line.slice(shift) : line))
    .join('\n');
}

const TANSTACK_FORM_TYPES = new Set(['DeepKeys', 'DeepValue', 'ValidationError']);

/** `@tanstack/react-form` → `@tanstack/solid-form`: `createForm(() => opts)`, field render props are accessors. */
function rewriteTanstackForm(text) {
  if (!text.includes("from '@tanstack/react-form'")) return text;
  text = text.replace(/import \{([^}]*)\} from '@tanstack\/react-form';/g, (_m, names) => {
    const list = names
      .split(',')
      .map((name) => name.trim())
      .filter(Boolean)
      .map((name) => {
        if (name === 'useForm') return 'createForm';
        return TANSTACK_FORM_TYPES.has(name) ? `type ${name}` : name;
      });
    return `import { ${list.join(', ')} } from '@tanstack/solid-form';`;
  });
  const call = /\buseForm(<[^>(]*>)?\(/g;
  let match;
  while ((match = call.exec(text))) {
    const args = readBalanced(text, match.index + match[0].length - 1, '(', ')');
    if (!args) break;
    const generic = match[1] ?? '';
    const inner = args.inner.trim();
    let options = '';
    if (inner.startsWith('{')) options = `() => (${args.inner})`;
    else if (inner) options = `() => ({ ${inner} })`;
    const replacement = `createForm${generic}(${options})`;
    text = `${text.slice(0, match.index)}${replacement}${text.slice(args.end)}`;
    call.lastIndex = match.index + replacement.length;
  }
  return text.replace(/\buseForm\b/g, 'createForm').replace(/\bfield\.(?=[a-zA-Z])/g, 'field().');
}

/** Rewrite the MDX "TanStack Form" section (prose and snippets) to the Solid adapter API. */
function rewriteTanstackSection(text) {
  const start = text.indexOf('\n## TanStack Form');
  if (start === -1) return text;
  const next = text.slice(start + 1).search(/\n## |\nexport const metadata/);
  const end = next === -1 ? text.length : start + 1 + next;
  const section = rewriteTanstackForm(text.slice(start, end)).replace(
    /`createForm` hook/g,
    '`createForm` function',
  );
  return text.slice(0, start) + section + text.slice(end);
}

/** Merge named imports into the module's `solid-js` import, or add one. */
function addSolidImport(text, name) {
  if (new RegExp(`import \\{[^}]*\\b${name}\\b[^}]*\\} from 'solid-js'`).test(text)) return text;
  const existing = /import \{([^}]*)\} from 'solid-js';/;
  if (existing.test(text)) {
    return text.replace(existing, (_m, names) => `import { ${names.trim()}, ${name} } from 'solid-js';`);
  }
  return `import { ${name} } from 'solid-js';\n${text}`;
}

/**
 * Rewrites reads of the accessor `name` (a signal getter or memo) into calls. React reads these as
 * plain values. `declaration` marks the line that defines it. With `strict`, only `{name}` is
 * rewritten when a parameter elsewhere in the file shadows the name.
 */
function callAccessor(text, name, declaration, strict) {
  const shadowed = declaresParameter(text, name);
  const call = `${name}()`;
  const rules = [
    [new RegExp(`\\{${name}\\}`, 'g'), `{${call}}`, false],
    [new RegExp(`(?<![\\w.])${name}\\.(?!\\.)`, 'g'), `${call}.`, strict],
    [
      new RegExp(`(?<![\\w.])${name}(?=\\s*(?:===|!==|==|!=|>=|<=|[<>+?]|&&|\\|\\|))`, 'g'),
      call,
      strict,
    ],
    [new RegExp(`\\breturn\\s+${name}\\b(?!\\()`), `return ${call}`, strict],
    [new RegExp(`\\.\\.\\.${name}\\b(?!\\()`), `...${call}`, strict],
    [new RegExp(`([?:]\\s*)${name}\\b(?!\\()`), `$1${call}`, strict],
    /* A getter read as a condition or an operand is always truthy / NaN. */
    [
      new RegExp(
        `(?<=(?:\\bif\\s*\\(|&&|\\|\\||!|[=!]==?|\\s[<>]=?)\\s*)${name}\\b(?![\\w$(.:])`,
        'g',
      ),
      call,
      true,
    ],
    [new RegExp(`(?<![\\w.$-])${name}(?=\\s+[-*/%]\\s)`, 'g'), call, true],
    [new RegExp(`(?<=\\s[-*/%]\\s+)${name}\\b(?![\\w$(.-])`, 'g'), call, true],
  ];
  return text
    .split('\n')
    .map((line) => {
      if (line.includes(declaration)) return line;
      for (const [re, replacement, gated] of rules) {
        if (gated && shadowed) continue;
        line = line.replace(re, replacement);
      }
      return line;
    })
    .join('\n');
}

/** End index (exclusive, past `;`) of the statement whose expression starts at `i`. */
function statementEnd(text, i) {
  let depth = 0;
  let quote = null;
  for (; i < text.length; i += 1) {
    const c = text[i];
    if (quote) {
      if (c === '\\') i += 1;
      else if (c === quote) quote = null;
    } else if (c === '"' || c === "'" || c === '`') quote = c;
    else if ('([{'.includes(c)) depth += 1;
    else if (')]}'.includes(c)) depth -= 1;
    else if (c === ';' && depth === 0) return i + 1;
  }
  return -1;
}

const COMPONENT_CONST =
  /^ {2}const (\w+)(?::\s*([^=\n]+?))? =\s+(?!createSignal|createMemo|createUniqueId|\{ current)/gm;

/**
 * Component-body constants computed from state re-run on every React render. Solid runs the body
 * once, so a constant that reads an accessor would never update. Returns those names in order.
 */
function memoizeDerivedConsts(text, accessorNames) {
  const names = [];
  const known = new Set(accessorNames);
  for (const match of text.matchAll(COMPONENT_CONST)) {
    const start = match.index + match[0].length;
    const end = statementEnd(text, start);
    if (end === -1) continue;
    const expr = text.slice(start, end - 1).trim();
    if (/^(?:async\s*)?(?:\([^)]*\)|\w+)\s*(?::[^=]+)?=>|^function\b/.test(expr)) continue;
    const reads =
      [...known].some((name) => new RegExp(`(?<![\\w.$])${name}\\(\\)`).test(expr)) ||
      names.some((name) => new RegExp(`(?<![\\w.$])${name}(?![\\w$:])`).test(expr));
    if (!reads) continue;
    names.push(match[1]);
    known.add(match[1]);
  }
  return names;
}

/** `const name: T = expr;` → `const name = createMemo<T>(() => expr);` */
function memoizeConst(text, name) {
  const match = new RegExp(`^ {2}const ${name}(?::\\s*([^=\\n]+?))? =\\s+`, 'm').exec(text);
  const start = match.index + match[0].length;
  const end = statementEnd(text, start);
  const expr = text.slice(start, end - 1);
  const generic = match[1] ? `<${match[1].trim()}>` : '';
  const head = `${text.slice(0, match.index)}  const ${name} = createMemo${generic}(() => `;
  return `${head}${expr});${text.slice(end)}`;
}

/** Whether any arrow function or function declaration in `text` takes a parameter called `name`. */
function declaresParameter(text, name) {
  const own = new RegExp(`(?<![\\w$.])${name}(?![\\w$])`);
  if (new RegExp(`(?<![\\w$.])${name}\\s*=>`).test(text)) return true;
  for (const match of text.matchAll(/\(([^()]*)\)\s*(?::\s*[^=;{]+)?=>|\bfunction\s*\w*\s*(?:<[^>]*>)?\(([^()]*)\)/g)) {
    const params = (match[1] ?? match[2]).replace(/:[^,]*/g, '');
    if (own.test(params)) return true;
  }
  return false;
}

function transformDemoTsx(src) {
  let text = src;
  text = text.replaceAll('@base-ui/react/', '@solidports/base-ui/');
  text = text.replaceAll("'@base-ui/react'", "'@solidports/base-ui'");
  text = text.replaceAll('"@base-ui/react"', '"@solidports/base-ui"');
  text = text.replace(/\bclassName=/g, 'class=');
  text = renameDomAttributes(text);
  text = nativeInputEvents(text);

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
  /* React's native props carry an object `style`; Solid's also allow a string, which Base UI parts
     (like React's) do not accept. */
  text = text.replace(
    /React\.ComponentPropsWithoutRef<('[a-z]+')>/g,
    "Omit<ComponentProps<$1>, 'ref' | 'style'> & { style?: JSX.CSSProperties }",
  );
  text = text.replace(/React\.ComponentProps<('[a-z]+')>/g, 'ComponentProps<$1>');
  text = text.replace(/React\.CSSProperties/g, 'JSX.CSSProperties');
  /* Solid handlers receive native DOM events with a typed `currentTarget`. */
  text = text.replace(
    /React\.(Mouse|Keyboard|Pointer|Focus)Event<(\w+)>/g,
    '$1Event & { currentTarget: $2 }',
  );
  text = text.replace(/React\.FormEvent<(\w+)>/g, 'Event & { currentTarget: $1 }');
  text = text.replace(/React\.ComponentType\b/g, 'Component');
  text = text.replace(/React\.ReactNode/g, 'JSX.Element');
  text = text.replace(/React\.ReactElement/g, 'JSX.Element');

  const rewritten = rewriteHooks(text);
  text = rewritten.text;
  for (const name of rewritten.refNames) {
    text = text.replaceAll(
      `ref={${name}}`,
      `ref={(el) => { ${name}.current = el; }}`,
    );
    /* Solid focus props take an element or a getter, not a ref object. */
    text = text.replace(
      new RegExp(`\\b(initialFocus|finalFocus)=\\{${name}\\}`, 'g'),
      `$1={() => ${name}.current}`,
    );
  }

  for (const name of rewritten.signalNames) {
    text = callAccessor(text, name, `const [${name},`, false);
  }
  const accessorNames = new Set(rewritten.signalNames);
  for (const [, name] of text.matchAll(/const\s+(\w+)\s*=\s*(?:createMemo|useMediaQuery)\b/g)) {
    accessorNames.add(name);
    text = callAccessor(text, name, `const ${name} = `, true);
  }
  for (const name of memoizeDerivedConsts(text, accessorNames)) {
    text = memoizeConst(text, name);
    accessorNames.add(name);
    text = callAccessor(text, name, `const ${name} = `, true);
  }
  text = text.replace(/\btoasts\./g, 'toasts().');
  text = kebabStyleKeys(text);
  text = text.replace(
    /return toasts\(\)\.map\(\(([^)]+)\) => \(([\s\S]*?)\)\);/g,
    'return (\n    <For each={toasts()}>\n      {($1) => ($2)}\n    </For>\n  );',
  );
  text = text.replace(
    /return toasts\(\)\.map\(\(([^)]+)\) => (<[^;]+)\);/g,
    'return (\n    <For each={toasts()}>\n      {($1) => $2}\n    </For>\n  );',
  );
  text = accessorValueChildren(text);
  text = text.replace(/import\s+\{[^}]+\}\s+from\s+'motion\/react';\n*/g, '');
  text = text.replace(/<motion\.div\b[\s\S]*?\/>/g, '<div />');
  text = text.replace(/<motion\.div\b([^>]*)>/g, '<div$1>');
  text = text.replace(/<\/motion\.div>/g, '</div>');
  text = text.replace(/<\/?AnimatePresence>/g, '');
  text = stripReactKeys(text);
  text = rewriteRenderElements(text);
  text = stringifyBareAria(text);
  text = rewriteDestructuredProps(text);
  text = rewriteTanstackForm(text);
  text = objectStyleSvgProps(text);
  if (/\bReact\./.test(text)) {
    text = `const React = { forwardRef: (render) => (props) => render(props, props.ref), useActionState: (_action, initial) => [initial, () => {}, false] };\n${text}`;
  }

  const needed = [];
  for (const name of ['createSignal', 'createEffect', 'createMemo', 'createUniqueId']) {
    if (new RegExp(`\\b${name}(?:<[^(]*>)?\\(`).test(text)) needed.push(name);
  }
  if (/\bonCleanup\(/.test(text)) needed.push('onCleanup');
  if (/\bonSettled\(/.test(text)) needed.push('onSettled');
  if (/<For[\s>]/.test(text)) needed.push('For');
  if (/\bAccessor</.test(text)) needed.push('type Accessor');
  const typeJsx = /JSX\.(SvgSVGAttributes|CSSProperties|Element)/.test(text);
  const header = [];
  if (needed.length > 0) {
    header.push(`import { ${[...new Set(needed)].join(', ')} } from 'solid-js';`);
  }
  /* Solid 2 moved the JSX namespace (and ComponentProps) to @solidjs/web. */
  const webTypes = [];
  if (/\bComponentProps</.test(text)) webTypes.push('ComponentProps');
  if (typeJsx) webTypes.push('JSX');
  if (webTypes.length > 0 && !/import type \{[^}]*\} from '@solidjs\/web'/.test(text)) {
    header.push(`import type { ${webTypes.join(', ')} } from '@solidjs/web';`);
  }
  if (header.length > 0) text = `${header.join('\n')}\n${text}`;

  if (/\bomit\(/.test(text)) text = addSolidImport(text, 'omit');
  if (/<Component>/.test(text)) text = addSolidImport(text, 'type Component');


  return text;
}

/** Drops a heading's section (up to the next heading of the same or a higher level) and its mentions. */
function removeMdxSection(text, { heading, level = 2, mentions }) {
  const start = text.indexOf(`\n${'#'.repeat(level)} ${heading}\n`);
  if (start !== -1) {
    const next = text.slice(start + 1).search(new RegExp(`\\n#{1,${level}} |\\nexport const metadata`));
    text = text.slice(0, start) + (next === -1 ? '' : text.slice(start + 1 + next));
  }
  for (const mention of mentions) text = text.replaceAll(mention, '');
  return text;
}

function transformMdx(src, pageRelDir) {
  let text = src;
  for (const entry of EXCLUDED) {
    if (entry.page === pageRelDir) text = removeMdxSection(text, entry);
  }
  text = text.replaceAll('@base-ui/react/', '@solidports/base-ui/');
  text = text.replaceAll("'@base-ui/react'", "'@solidports/base-ui'");
  text = text.replaceAll('"@base-ui/react"', '"@solidports/base-ui"');
  text = text.replaceAll('/react/', '/solid/');
  text = text.replaceAll('unstyled React ', 'unstyled Solid ');
  text = text.replaceAll('Headless React Components', 'Headless Solid Components');
  text = text.replaceAll('React Accordion', 'Solid Accordion');
  text = rewriteTanstackSection(text);


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
    copyTree(fromCss, toCss, ['index.css', 'syntax.css']);
    const index = join(toCss, 'index.css');
    if (existsSync(join(fromCss, 'index.css'))) {
      let css = readFileSync(join(fromCss, 'index.css'), 'utf8');
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
      if (!css.includes("@import '../syntax-highlighting/index.css';")) {
        css = css.replace(
          "@import './syntax.css';",
          "@import './syntax.css';\n@import '../syntax-highlighting/index.css';",
        );
      }
      writeCss(index, css);
    }
    const syntax = join(toCss, 'syntax.css');
    if (existsSync(join(fromCss, 'syntax.css'))) {
      /* Inline code highlighted by shiki carries `--syntax-tag` on HTML tags instead of `.di-ht`. */
      const css = readFileSync(join(fromCss, 'syntax.css'), 'utf8').replace(
        /( *\/\* stylelint-disable-next-line [^*]*\*\/\n)?  \.MdCode\[data-inline\]:not\(:has\(> \.di-ht\)\) \{/,
        (_m, lint = '') =>
          `  /* HTML tags stay colored text. Shiki marks them with --syntax-tag; React uses .di-ht. */\n${lint}  .MdCode[data-inline]:not(:has(> .di-ht)):not(:has([style*='--syntax-tag'])) {`,
      );
      writeCss(syntax, css);
    }
    pruneStale(toCss);
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
    const demoRel = join(prefix, rest);
    if (EXCLUDED.some((entry) => demoRel.startsWith(`${entry.demo}/`))) continue;
    if (existsSync(join(SOLID_DEMO_OVERRIDES, demoRel))) continue;
    const dest = join(SOLID_DEMOS, demoRel);
    let body = readFileSync(file, 'utf8');
    if (file.endsWith('.tsx') || file.endsWith('.ts') || file.endsWith('.jsx') || file.endsWith('.js')) {
      body = transformDemoTsx(body);
    }
    write(dest, body);
    n += 1;
  }
  copyTree(SOLID_DEMO_OVERRIDES, SOLID_DEMOS);
  pruneStale(SOLID_DEMOS);
  return n;
}

function generatePages() {
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
  pruneStale(SOLID_ROUTES);
  return files.length;
}

function transformSolidTsx(src) {
  let text = src;
  text = text.replace(/<React\.Fragment>/g, '<>');
  text = text.replace(/<\/React\.Fragment>/g, '</>');
  text = text.replace(/^import \* as React from 'react';\n/m, '');
  text = text.replace(/^import type \{[^}]+\} from 'next(?:\/types)?';\n/gm, '');
  text = text.replace(/\bclassName=/g, 'class=');
  text = renameDomAttributes(text);
  text = text.replaceAll('@base-ui/react/', '@solidports/base-ui/');
  text = text.replaceAll('@base-ui/react', '@solidports/base-ui');
  text = text.replaceAll('/react/', '/solid/');
  text = text.replace(
    /props: React\.ComponentProps<'svg'>/g,
    'props: JSX.SvgSVGAttributes<SVGSVGElement>',
  );
  if (text.includes('JSX.SvgSVGAttributes') && !/\bJSX\b[^;]*from '@solidjs\/web'/.test(text)) {
    text = `import type { JSX } from '@solidjs/web';\n${text}`;
  }
  return objectStyleSvgProps(kebabStyleKeys(text));
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
  pruneStale(dest);
}

function patchSolidCssImport() {
  const appTsx = join(SOLID, 'src/app.tsx');
  if (existsSync(join(SOLID, 'src/css/index.css')) && existsSync(appTsx)) {
    let t = readFileSync(appTsx, 'utf8');
    t = t.replace('import "./app.css"', 'import "./css/index.css"');
    t = t.replace("import './app.css'", "import './css/index.css'");
    write(appTsx, t);
  }
  // Tailwind v4 resolves nested @import paths as src/src/css/*; duplicate the folder.
  // Imports written for src/css (`../components`) must climb one more level from the copy.
  const twCss = join(SOLID, 'src', 'src', 'css');
  copyTree(join(SOLID, 'src', 'css'), twCss, ['index.css']);
  const srcIndex = join(SOLID, 'src', 'css', 'index.css');
  if (existsSync(srcIndex)) {
    write(join(twCss, 'index.css'), readFileSync(srcIndex, 'utf8').replaceAll("'../", "'../../"));
  }
  pruneStale(twCss);
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
