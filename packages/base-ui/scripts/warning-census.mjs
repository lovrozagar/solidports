/* eslint-disable no-console */
// The unit-suite warning census report (plan 3, leaf 1.10): reads the JSONL a test run writes when
// `SOLID_WARNING_CENSUS=<file>` is set (`packages/solid/test/warningCensus.ts`) and prints, per
// suite, how many warnings and errors it logged and from where (library, harness, test file,
// dependency), and the distinct messages with their counts, including what the harness swallows.
//
// Usage (from packages/base-ui):
//   SOLID_WARNING_CENSUS=$PWD/.tmp/census.jsonl bun run test:solid:jsdom --run
//   node scripts/warning-census.mjs .tmp/census.jsonl [out.md]
import fs from 'node:fs';

const ORIGINS = ['library', 'harness', 'test', 'dependency'];

/** Per-suite counts and distinct messages, suites and messages with the most first. */
export function summarizeCensus(entries) {
  const suites = new Map();
  const messages = new Map();
  for (const entry of entries) {
    let suite = suites.get(entry.file);
    if (!suite) {
      suite = {
        file: entry.file,
        warn: 0,
        error: 0,
        library: 0,
        harness: 0,
        test: 0,
        dependency: 0,
        swallowed: 0,
      };
      suites.set(entry.file, suite);
    }
    suite[entry.kind] += 1;
    suite[entry.origin] += 1;
    if (entry.swallowed) suite.swallowed += 1;
    const key = entry.code ?? entry.message;
    const id = `${key}\0${entry.kind}\0${entry.origin}`;
    let message = messages.get(id);
    if (!message) {
      message = {
        key,
        kind: entry.kind,
        origin: entry.origin,
        count: 0,
        files: new Set(),
        swallowed: 0,
      };
      messages.set(id, message);
    }
    message.count += 1;
    message.files.add(entry.file);
    if (entry.swallowed) message.swallowed += 1;
  }
  const total = (suite) => suite.warn + suite.error;
  return {
    total: entries.length,
    suites: [...suites.values()].sort(
      (a, b) => total(b) - total(a) || a.file.localeCompare(b.file),
    ),
    messages: [...messages.values()]
      .map(({ files, ...rest }) => ({ ...rest, suites: files.size }))
      .sort((a, b) => b.count - a.count || a.key.localeCompare(b.key)),
  };
}

const cell = (text) => String(text).replaceAll('|', '\\|');

/** The census as markdown: the totals line, the per-suite table and the distinct messages. */
export function censusReport(summary) {
  const byOrigin = Object.fromEntries(ORIGINS.map((origin) => [origin, 0]));
  let swallowed = 0;
  for (const suite of summary.suites) {
    for (const origin of ORIGINS) byOrigin[origin] += suite[origin];
    swallowed += suite.swallowed;
  }
  return [
    '# Unit-suite warning census',
    '',
    `${summary.total} messages in ${summary.suites.length} suites: ${ORIGINS.map((origin) => `${byOrigin[origin]} ${origin}`).join(', ')}; ${swallowed} swallowed by the harness.`,
    '',
    '## Suites',
    '',
    '| suite | warn | error | library | harness | test | dependency | swallowed |',
    '|---|---|---|---|---|---|---|---|',
    ...summary.suites.map(
      (s) =>
        `| ${cell(s.file)} | ${s.warn} | ${s.error} | ${s.library} | ${s.harness} | ${s.test} | ${s.dependency} | ${s.swallowed} |`,
    ),
    '',
    '## Messages',
    '',
    '| message or code | kind | origin | count | suites | swallowed |',
    '|---|---|---|---|---|---|',
    ...summary.messages.map(
      (m) =>
        `| ${cell(m.key)} | ${m.kind} | ${m.origin} | ${m.count} | ${m.suites} | ${m.swallowed} |`,
    ),
    '',
  ].join('\n');
}

if (import.meta.main || process.argv[1]?.endsWith('warning-census.mjs')) {
  const [input, output] = process.argv.slice(2);
  if (!input) {
    console.error('usage: node scripts/warning-census.mjs <census.jsonl> [out.md]');
    process.exit(1);
  }
  const lines = fs.existsSync(input)
    ? fs.readFileSync(input, 'utf8').split('\n').filter(Boolean)
    : [];
  const md = censusReport(summarizeCensus(lines.map((line) => JSON.parse(line))));
  if (output) fs.writeFileSync(output, md);
  console.log(md);
}
