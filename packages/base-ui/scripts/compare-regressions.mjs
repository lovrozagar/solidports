// Compares the React and Solid regression screenshots (`<dir>/react`, `<dir>/solid`): the share of
// differing pixels per route, routes missing on either side, and a diff image per differing route
// under `<dir>/diff`. Prints the routes sorted by difference. Threshold: `REGRESSIONS_MAX_DIFF`
// (fraction of pixels, default 0.001); routes listed in `<dir>/../accepted.json` with a reason are
// reported but do not fail.
import * as fs from 'node:fs';
import * as path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const pixelmatch = require('pixelmatch').default ?? require('pixelmatch');
const { PNG } = require('pngjs');

const dir = path.resolve(process.argv[2] ?? 'test/regressions-solid/screenshots');
const maxDiff = Number(process.env.REGRESSIONS_MAX_DIFF ?? 0.001);
const acceptedFile = path.join(path.dirname(dir), 'accepted.json');
const accepted = fs.existsSync(acceptedFile)
  ? JSON.parse(fs.readFileSync(acceptedFile, 'utf8'))
  : {};

function list(root) {
  if (!fs.existsSync(root)) {
    return [];
  }
  return fs
    .readdirSync(root, { recursive: true })
    .filter((file) => String(file).endsWith('.png'))
    .map(String);
}

const reactFiles = new Set(list(path.join(dir, 'react')));
const solidFiles = new Set(list(path.join(dir, 'solid')));
const results = [];

for (const file of [...reactFiles].sort()) {
  if (!solidFiles.has(file)) {
    results.push({ file, status: 'missing in solid', ratio: 1 });
    continue;
  }
  const react = PNG.sync.read(fs.readFileSync(path.join(dir, 'react', file)));
  const solid = PNG.sync.read(fs.readFileSync(path.join(dir, 'solid', file)));
  if (react.width !== solid.width || react.height !== solid.height) {
    results.push({
      file,
      status: `size ${react.width}x${react.height} vs ${solid.width}x${solid.height}`,
      ratio: 1,
    });
    continue;
  }
  const diff = new PNG({ width: react.width, height: react.height });
  const differing = pixelmatch(react.data, solid.data, diff.data, react.width, react.height, {
    threshold: 0.1,
  });
  const ratio = differing / (react.width * react.height);
  if (differing > 0) {
    const out = path.join(dir, 'diff', file);
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, PNG.sync.write(diff));
  }
  results.push({ file, status: differing > 0 ? 'differs' : 'same', ratio });
}
for (const file of [...solidFiles].sort()) {
  if (!reactFiles.has(file)) {
    results.push({ file, status: 'missing in react', ratio: 1 });
  }
}

results.sort((a, b) => b.ratio - a.ratio || a.file.localeCompare(b.file));
let failures = 0;
for (const result of results) {
  const route = result.file.replace(/\.png$/, '');
  const reason = accepted[route];
  const over = result.ratio > maxDiff;
  if (over && !reason) {
    failures += 1;
  }
  if (result.status !== 'same') {
    console.log(
      `${(result.ratio * 100).toFixed(3).padStart(8)}%  ${result.status.padEnd(16)} ${route}${reason ? `  (accepted: ${reason})` : ''}`,
    );
  }
}
const same = results.filter((result) => result.status === 'same').length;
console.log(
  `\n${results.length} routes: ${same} identical, ${results.length - same} differ or missing, ${failures} over ${(maxDiff * 100).toFixed(1)}% without an accepted reason`,
);
process.exit(failures > 0 ? 1 : 0);
