// `docs-infra validate`, with the types.ts pages in batches of one page per worker.
//
// docs-infra hands every types.ts page to its workers at once, and each worker's type server runs
// its pages in turn, while a page's request times out 5 minutes after it was sent, queue
// included. With few cores (CI's 4-core runner: 3 workers) a server queues about 14 pages and the
// last ones time out although nothing failed. One page per worker per run leaves no queue.
//
// Takes `docs-infra validate`'s arguments: `--command`, `--indexes`, `--types` and route paths.
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import { availableParallelism } from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const appDir = path.join(root, 'src/app');
const cli = path.join(root, 'framework/docs-infra.mjs');

const args = process.argv.slice(2);
const options = [];
const paths = [];
for (let index = 0; index < args.length; index += 1) {
  const arg = args[index];
  if (arg === '--command') {
    options.push(arg, args[index + 1]);
    index += 1;
  } else if (arg.startsWith('--')) {
    options.push(arg);
  } else {
    paths.push(arg);
  }
}
const onlyIndexes = options.includes('--indexes');
const onlyTypes = options.includes('--types');
const passOptions = options.filter((option) => option !== '--indexes' && option !== '--types');

function run(extra) {
  const result = spawnSync(process.execPath, [cli, 'validate', ...passOptions, ...extra], {
    cwd: root,
    stdio: 'inherit',
  });
  return result.status ?? 1;
}

/** The route of every page folder with a types.ts under `dir`, relative to `src/app`. */
function typesPages(dir) {
  const pages = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory() && entry.name !== 'node_modules') {
      pages.push(...typesPages(full));
    } else if (entry.name === 'types.ts') {
      pages.push(path.relative(appDir, dir));
    }
  }
  return pages;
}

let failed = false;
if (!onlyTypes) {
  failed = run(['--indexes', ...paths]) !== 0 || failed;
}
if (!onlyIndexes) {
  const roots = paths.length > 0 ? paths.map((route) => path.join(appDir, route)) : [appDir];
  const pages = roots.filter((dir) => fs.existsSync(dir)).flatMap((dir) => typesPages(dir));
  const batchSize = Math.max(1, availableParallelism() - 1);
  for (let start = 0; start < pages.length; start += batchSize) {
    failed = run(['--types', ...pages.slice(start, start + batchSize)]) !== 0 || failed;
  }
}
process.exit(failed ? 1 : 0);
