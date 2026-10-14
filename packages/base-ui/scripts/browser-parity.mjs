/* eslint-disable no-console */
// Compares upstream's (React) and the Solid suite's results in one browser, from Vitest JSON
// reports: prints the Solid failures of tests upstream passes there ("Solid-only"), then the
// counts, and exits 1 when there is any. A test failing in both is the browser's or the test
// environment's, not the port's.
//
// Usage: node scripts/browser-parity.mjs <react-report.json> <solid-report.json>
import * as fs from 'node:fs';

function results(path, sourceRoot) {
  const report = JSON.parse(fs.readFileSync(path, 'utf8'));
  const tests = new Map();
  for (const file of report.testResults) {
    const name = file.name
      .split(sourceRoot)
      .pop()
      .replace(/\.(test|spec)\.tsx?$/, '')
      .replace('floating-ui-react', 'floating-ui-solid');
    for (const assertion of file.assertionResults) {
      const title = [...assertion.ancestorTitles, assertion.title].join(' > ');
      tests.set(`${name} :: ${title}`, {
        status: assertion.status,
        message: (assertion.failureMessages?.[0] ?? '').split('\n')[0].slice(0, 200),
      });
    }
  }
  return tests;
}

const [reactPath, solidPath] = process.argv.slice(2);
if (!reactPath || !solidPath) {
  console.error('Usage: node scripts/browser-parity.mjs <react-report.json> <solid-report.json>');
  process.exit(2);
}

const react = results(reactPath, 'packages/react/src/');
const solid = results(solidPath, 'packages/solid/src/');

const solidOnly = [];
let shared = 0;
let solidFailures = 0;
for (const [key, result] of solid) {
  if (result.status !== 'failed') {
    continue;
  }
  solidFailures += 1;
  if (react.get(key)?.status === 'failed') {
    shared += 1;
  } else {
    solidOnly.push([key, result.message, react.get(key)?.status ?? 'absent']);
  }
}
const upstreamOnly = [...react].filter(
  ([key, result]) => result.status === 'failed' && solid.get(key)?.status === 'passed',
).length;

for (const [key, message, upstream] of solidOnly.sort()) {
  console.log(`- [upstream: ${upstream}] ${key}\n    ${message}`);
}
console.log(
  `\nSolid failures: ${solidFailures}; shared with upstream: ${shared}; Solid-only: ${solidOnly.length}; upstream failures Solid passes: ${upstreamOnly}`,
);
process.exit(solidOnly.length > 0 ? 1 : 0);
