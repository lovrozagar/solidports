// Reads the jsdom workers' exit records (`packages/solid/test/exitDiagnostics.ts`) and says which
// worker ended how, and in which test file. Each worker appends a line when it starts a test file,
// one when the file finishes, and one when it exits, with its exit code and memory. Vitest's pool
// ends idle workers with a signal, which runs no exit handler, so a worker whose last file finished
// ended normally; one whose last file started and never finished died inside it.
//
// Usage (from the monorepo root):
//   node packages/base-ui/scripts/jsdom-exits.mjs [run dir]   default: the newest run under
//                                                            .tmp/grunt/jsdom-exits/
// Exits 1 when a worker exited nonzero or was killed.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
export const EXITS_DIR = path.join(root, '.tmp/grunt/jsdom-exits');

/**
 * Each worker's ending from its records, in pid order: `clean` (exit code 0), `exit-code`
 * (nonzero), `ended` (no exit record after its last file finished: vitest's pool signals idle
 * workers, so most clean workers end this way), or `killed` (its last file started and never
 * finished, with no exit record: a signal or a crash inside that file). With the last test file it
 * started and its memory at exit.
 * @param {{ event: 'file' | 'exit', pid: number, t: number, file?: string, code?: number, rss?: number, heapUsed?: number }[]} records
 */
export function classifyWorkers(records) {
  const workers = new Map();
  for (const record of [...records].sort((a, b) => a.t - b.t)) {
    const worker = workers.get(record.pid) ?? {
      pid: record.pid,
      status: 'killed',
      code: null,
      lastFile: null,
      files: 0,
      rss: null,
      heapUsed: null,
    };
    if (record.event === 'file') {
      worker.lastFile = record.file;
      worker.files += 1;
      worker.status = 'killed';
    } else if (record.event === 'done') {
      // Finished its file: the pool may now end it with a signal, which runs no exit handler.
      worker.status = 'ended';
    } else if (record.event === 'exit') {
      worker.status = record.code === 0 ? 'clean' : 'exit-code';
      worker.code = record.code;
      worker.rss = record.rss;
      worker.heapUsed = record.heapUsed;
    }
    workers.set(record.pid, worker);
  }
  return [...workers.values()].sort((a, b) => a.pid - b.pid);
}

function main(argv) {
  const runs = fs.existsSync(EXITS_DIR)
    ? fs
        .readdirSync(EXITS_DIR)
        .map((name) => path.join(EXITS_DIR, name))
        .sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs)
    : [];
  const dir = argv[0] ? path.resolve(argv[0]) : runs[0];
  if (!dir || !fs.existsSync(dir)) {
    console.error(`no jsdom exit records under ${path.relative(root, EXITS_DIR)}/`);
    return 1;
  }
  const records = fs
    .readdirSync(dir)
    .filter((name) => name.endsWith('.jsonl'))
    .flatMap((name) =>
      fs
        .readFileSync(path.join(dir, name), 'utf8')
        .split('\n')
        .filter(Boolean)
        .map((line) => JSON.parse(line)),
    );
  const workers = classifyWorkers(records);
  const unclean = workers.filter((worker) => worker.status === 'exit-code' || worker.status === 'killed');
  const mb = (bytes) => (bytes == null ? '-' : `${Math.round(bytes / 1048576)} MB`);
  console.log(`${path.relative(root, dir)}: ${workers.length} workers, ${unclean.length} unclean`);
  for (const worker of unclean) {
    console.log(
      `  pid ${worker.pid} ${worker.status}${worker.code == null ? '' : ` ${worker.code}`} after ${worker.files} files, last ${worker.lastFile}, rss ${mb(worker.rss)}, heap ${mb(worker.heapUsed)}`,
    );
  }
  return unclean.length ? 1 : 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exit(main(process.argv.slice(2)));
}
