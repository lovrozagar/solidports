// Compares the Solid test suite with the upstream React snapshot, test by test.
//
// Upstream's unit run covers `packages/react` (`src` and `test`), `packages/utils` and `docs`. For
// every upstream test or type spec file (`*.test.*`, `*.spec.*`) in those trees and its Solid
// counterpart (see TREES) it reports:
// - upstream files without a Solid counterpart,
// - upstream tests whose title has no match in the Solid file,
// - upstream tests whose Solid `skipIf` skips them in an environment upstream runs them in,
// - Solid `.skip`, `.todo` and `.fails` anywhere in the Solid trees.
//
// `--json <file>` writes the full report. Exits 1 when any check finds something.
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TEST_FILE = /\.(test|spec)\.[cm]?[jt]sx?$/;
const IGNORED_DIRECTORIES = new Set(['node_modules', 'build', 'dist', '.next', '.output']);

// Each upstream tree and the Solid tree its tests live in, at the same relative path.
const TREES = [
  {
    react: 'packages/react/src',
    solid: 'packages/solid/src',
    rename: (relative) => relative.replace(/^floating-ui-react\//, 'floating-ui-solid/'),
  },
  { react: 'packages/react/test', solid: 'packages/solid/test' },
  { react: 'packages/utils/src', solid: 'packages/solid/src/utils' },
  { react: 'docs/react', solid: 'docs/solid' },
];

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) {
    return out;
  }
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!IGNORED_DIRECTORIES.has(entry.name)) {
        walk(full, out);
      }
    } else if (TEST_FILE.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

/** The Solid counterparts of an upstream test file (a test can move between `.ts` and `.tsx`). */
function solidCounterparts(tree, reactFile) {
  const relative = (tree.rename ?? ((name) => name))(
    path.relative(path.join(root, tree.react), reactFile),
  ).replace(/\.[cm]?[jt]sx?$/, '');
  return ['.tsx', '.ts', '.jsx', '.js', '.mts', '.mjs']
    .map((extension) => path.join(root, tree.solid, relative + extension))
    .filter((candidate) => fs.existsSync(candidate));
}

/** Reads a balanced `(...)` starting at `open` (the index of `(`); returns [inner, endIndex]. */
function readParens(source, open) {
  let depth = 0;
  let quote = null;
  for (let index = open; index < source.length; index += 1) {
    const char = source[index];
    if (quote) {
      if (char === '\\') {
        index += 1;
      } else if (char === quote) {
        quote = null;
      }
      continue;
    }
    if (char === "'" || char === '"' || char === '`') {
      quote = char;
    } else if (char === '(') {
      depth += 1;
    } else if (char === ')') {
      depth -= 1;
      if (depth === 0) {
        return [source.slice(open + 1, index), index];
      }
    }
  }
  return [source.slice(open + 1), source.length];
}

/** The index after `<...>` type arguments at `index` (an arrow's `=>` is not a closing bracket). */
function skipTypeArguments(source, index) {
  let cursor = index;
  while (/\s/.test(source[cursor] ?? '')) cursor += 1;
  if (source[cursor] !== '<') return cursor;
  let depth = 0;
  for (; cursor < source.length; cursor += 1) {
    const char = source[cursor];
    if (char === '<') depth += 1;
    else if (char === '>' && source[cursor - 1] !== '=') {
      depth -= 1;
      if (depth === 0) {
        cursor += 1;
        while (/\s/.test(source[cursor] ?? '')) cursor += 1;
        return cursor;
      }
    }
  }
  return cursor;
}

const TITLE = /^\s*(['"`])((?:\\.|(?!\1).)*)\1/s;
const CALL =
  /\b(it|test|describe)\b((?:\.(?:only|skip|todo|fails|concurrent|sequential)\b)*)(?:\.(skipIf|runIf)\s*\()?/g;

/**
 * Every test and suite title in a file with its modifiers, as `{ kind, title, condition, flags }`.
 * `condition` is the normalized `skipIf`/`runIf` argument (`runIf(x)` becomes `!(x)`).
 */
function extractTests(rawSource) {
  // Comments become spaces (offsets kept), so a word like `test (` in prose is not a test.
  const source = rawSource.replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, (comment) =>
    comment.replace(/[^\n]/g, ' '),
  );
  const tests = [];
  CALL.lastIndex = 0;
  let match;
  while ((match = CALL.exec(source))) {
    const [, kind, flagText, conditional] = match;
    let cursor = CALL.lastIndex;
    let condition = null;
    if (conditional) {
      const [inner, end] = readParens(source, cursor - 1);
      condition = inner.replace(/\s+/g, ' ').trim();
      if (conditional === 'runIf') {
        condition = `!(${condition})`;
      }
      cursor = end + 1;
    }
    // `.each(table)` or `.for(table)` (optionally with type arguments) before the title call.
    const each = /^\s*\.(?:each|for)\s*/.exec(source.slice(cursor));
    if (each) {
      const open = skipTypeArguments(source, cursor + each[0].length);
      if (source[open] === '(') {
        const [, end] = readParens(source, open);
        cursor = end + 1;
      }
    }
    const call = /^\s*\(/.exec(source.slice(cursor));
    if (!call) {
      continue;
    }
    const title = TITLE.exec(source.slice(cursor + call[0].length));
    if (!title) {
      continue;
    }
    tests.push({
      kind,
      title: title[2],
      condition,
      flags: flagText.split('.').filter(Boolean),
    });
  }
  return tests;
}

// The environments upstream runs its suite in. React-only terms take upstream CI's values (React
// 19 with owner stacks), so a React 18 skip is not a skip there.
const ENVIRONMENTS = [
  { isJSDOM: true, isBlink: false, isWebKit: false, isGecko: false },
  { isJSDOM: false, isBlink: true, isWebKit: false, isGecko: false },
  { isJSDOM: false, isBlink: false, isWebKit: false, isGecko: true },
  { isJSDOM: false, isBlink: false, isWebKit: true, isGecko: false },
].map((environment) => ({ ...environment, reactMajor: 19, hasCaptureOwnerStack: true }));

// Feature checks and test parameters a condition may read, as free booleans: two conditions
// agree only when they agree for every value.
const ATOMS = [
  [/typeof\s+Touch\s*===\s*['"]undefined['"]/g, '$touchMissing'],
  [/\(\s*['"]onbeforematch['"]\s+in\s+window\s*\)/g, '$beforeMatch'],
  [/['"]onbeforematch['"]\s+in\s+window/g, '$beforeMatch'],
  [/\/WebKit\/\.test\(\s*window\.navigator\.userAgent\s*\)/g, 'isWebKit'],
  [/platform\.engine\.blink/g, 'isBlink'],
  [/platform\.engine\.webkit/g, 'isWebKit'],
  [/platform\.engine\.gecko/g, 'isGecko'],
  [/direction\s*===\s*['"]rtl['"]/g, '$rtl'],
];

function compileCondition(condition) {
  if (condition == null) {
    return { free: [], evaluate: () => false };
  }
  let expression = condition;
  for (const [pattern, replacement] of ATOMS) {
    expression = expression.replace(pattern, replacement);
  }
  const known = new Set(Object.keys(ENVIRONMENTS[0]));
  const identifiers = new Set(expression.match(/[$A-Za-z_][$\w]*/g) ?? []);
  const free = [...identifiers].filter((name) => !known.has(name));
  // eslint-disable-next-line no-new-func -- evaluates a test file's own skip condition
  const fn = new Function(...known, ...free, `return Boolean(${expression});`);
  return {
    free,
    evaluate: (environment, values) =>
      fn(...[...known].map((name) => environment[name]), ...free.map((name) => values[name])),
  };
}

/** Every assignment of the given free booleans. */
function* assignments(names) {
  for (let mask = 0; mask < 2 ** names.length; mask += 1) {
    yield Object.fromEntries(names.map((name, index) => [name, Boolean(mask & (1 << index))]));
  }
}

/** The environments where Solid skips a test upstream runs (empty when Solid skips no more). */
function extraSkips(upstreamCondition, solidCondition) {
  const upstream = compileCondition(upstreamCondition);
  const solid = compileCondition(solidCondition);
  const free = [...new Set([...upstream.free, ...solid.free])];
  const environments = [];
  for (const environment of ENVIRONMENTS) {
    for (const values of assignments(free)) {
      if (solid.evaluate(environment, values) && !upstream.evaluate(environment, values)) {
        environments.push(
          `${['jsdom', 'chromium', 'firefox', 'webkit'][ENVIRONMENTS.indexOf(environment)]}${
            free.length ? ` ${JSON.stringify(values)}` : ''
          }`,
        );
      }
    }
  }
  return environments;
}

// Upstream titles that name React where the Solid test names its own package.
const TITLE_ALIASES = { '@base-ui/react': '@solidports/base-ui' };

const report = {
  missingFiles: [],
  missingTests: [],
  extraSkips: [],
  markers: [],
  solidOnlyConditional: [],
};

for (const [tree, reactFile] of TREES.flatMap((entry) =>
  walk(path.join(root, entry.react)).map((file) => [entry, file]),
)) {
  const solidFiles = solidCounterparts(tree, reactFile);
  const reactRelative = path.relative(root, reactFile);
  if (solidFiles.length === 0) {
    report.missingFiles.push(reactRelative);
    continue;
  }
  const solidRelative = solidFiles.map((file) => path.relative(root, file)).join(', ');
  const reactTests = extractTests(fs.readFileSync(reactFile, 'utf8'));
  const solidTests = solidFiles.flatMap((file) => extractTests(fs.readFileSync(file, 'utf8')));
  const solidByTitle = new Map();
  for (const test of solidTests) {
    const list = solidByTitle.get(test.title) ?? [];
    list.push(test);
    solidByTitle.set(test.title, list);
  }
  for (const test of reactTests) {
    const matches = solidByTitle.get(TITLE_ALIASES[test.title] ?? test.title);
    if (!matches) {
      report.missingTests.push({ file: solidRelative, kind: test.kind, title: test.title });
      continue;
    }
    // `.skip`/`.todo`/`.fails` are reported as markers; compare the conditional skips.
    const runnable = matches.filter((candidate) => candidate.flags.length === 0);
    if (runnable.length === 0) {
      continue;
    }
    const skips = runnable.map((candidate) => extraSkips(test.condition, candidate.condition));
    if (skips.every((environments) => environments.length > 0)) {
      report.extraSkips.push({
        file: solidRelative,
        kind: test.kind,
        title: test.title,
        upstream: test.condition,
        solid: runnable.map((candidate) => candidate.condition),
        environments: skips[0],
      });
    }
  }
  const reactTitles = new Set(reactTests.map((test) => test.title));
  for (const test of solidTests) {
    if (test.condition && !reactTitles.has(test.title)) {
      report.solidOnlyConditional.push({
        file: solidRelative,
        kind: test.kind,
        title: test.title,
        condition: test.condition,
      });
    }
  }
}

for (const solidFile of new Set(TREES.flatMap((tree) => walk(path.join(root, tree.solid))))) {
  for (const test of extractTests(fs.readFileSync(solidFile, 'utf8'))) {
    const markers = test.flags.filter((flag) => ['skip', 'todo', 'fails', 'only'].includes(flag));
    if (markers.length > 0) {
      report.markers.push({
        file: path.relative(root, solidFile),
        kind: test.kind,
        title: test.title,
        markers,
      });
    }
  }
}

const jsonIndex = process.argv.indexOf('--json');
if (jsonIndex !== -1) {
  fs.writeFileSync(process.argv[jsonIndex + 1], `${JSON.stringify(report, null, 2)}\n`);
}

const listed = [
  ...report.missingFiles.map((file) => `missing file: ${file}`),
  ...report.missingTests.map((test) => `missing test: ${test.file} :: ${test.title}`),
  ...report.extraSkips.map(
    (test) => `extra skip (${test.environments.join(', ')}): ${test.file} :: ${test.title}`,
  ),
  ...report.markers.map((test) => `${test.markers.join(', ')}: ${test.file} :: ${test.title}`),
];
for (const line of listed) {
  console.log(`- ${line}`);
}

console.log(
  [
    `upstream test files without a Solid counterpart: ${report.missingFiles.length}`,
    `upstream tests missing from their Solid file: ${report.missingTests.length}`,
    `upstream tests Solid skips in an environment upstream runs them: ${report.extraSkips.length}`,
    `Solid .skip/.todo/.fails/.only markers: ${report.markers.length}`,
    `Solid-only tests with a skip condition (not counted): ${report.solidOnlyConditional.length}`,
  ].join('\n'),
);

const failed =
  report.missingFiles.length +
  report.missingTests.length +
  report.extraSkips.length +
  report.markers.length;
process.exitCode = failed > 0 ? 1 : 0;
