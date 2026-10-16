/* eslint-disable no-console */
// Runs a command on the Mac test machine (`ssh mac`) at a local commit, for suites this machine is
// too loaded to run. The commit travels as a git bundle on top of origin/main into ~/solidports-ci
// (cloned from GitHub once), dependencies install from the lockfile, and the command runs from the
// monorepo root under the Mac's machine-wide lock with a hard timeout. Its output streams to the
// terminal and to a local log; `--fetch <path>` copies a result file back afterwards.
//
// macOS has no `flock` or `timeout`, so the run installs small Python stand-ins in ~/.gates/bin:
// an fcntl lock released when its holder dies, and a timeout that kills the command's process
// group. Every run holds ~/.gates/heavy.flock (other repos' Mac gates take the same lock); the
// suites inside a run order themselves on a lock of their own, so the two never deadlock.
//
// Usage (from the monorepo root):
//   node packages/base-ui/scripts/remote-mac.mjs <sha> [--timeout 1200] [--fetch <path>]... -- <command>
//   e.g. ... HEAD -- bun run test:base-ui:all --only chromium
import { spawn, spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const HOST = process.env.REMOTE_MAC_HOST ?? 'mac';
const REMOTE_REPO = '~/solidports-ci';
const REPO_URL = 'https://github.com/lovrozagar/solidports.git';

export function parseArgs(argv) {
  const separator = argv.indexOf('--');
  if (separator < 1 || separator === argv.length - 1) {
    throw new Error(
      'usage: remote-mac.mjs <sha> [--timeout seconds] [--fetch path]... -- <command>',
    );
  }
  const options = { sha: argv[0], timeout: 1200, fetch: [], command: argv.slice(separator + 1) };
  for (let i = 1; i < separator; i += 1) {
    const flag = argv[i];
    const value = argv[i + 1];
    if (value === undefined || i + 1 >= separator) {
      throw new Error(`${flag} needs a value`);
    }
    if (flag === '--timeout') {
      options.timeout = Number(value);
      if (!Number.isInteger(options.timeout) || options.timeout <= 0) {
        throw new Error(`--timeout must be a positive whole number of seconds, got ${value}`);
      }
    } else if (flag === '--fetch') {
      options.fetch.push(value);
    } else {
      throw new Error(`unknown option ${flag}`);
    }
    i += 1;
  }
  return options;
}

/** Single-quotes `value` for a POSIX shell. */
export const quote = (value) => `'${String(value).replace(/'/g, `'\\''`)}'`;

export const FLOCK_SHIM = `#!/usr/bin/env python3
# flock [-n] [-E code] <file> [command...]: an fcntl lock on <file>, held while the command runs.
import fcntl, os, subprocess, sys
args = sys.argv[1:]
block = True
conflict = 1
while args and args[0] in ('-n', '-E'):
    if args[0] == '-n':
        block = False
        args = args[1:]
    else:
        conflict = int(args[1])
        args = args[2:]
fd = os.open(args[0], os.O_RDWR | os.O_CREAT, 0o644)
try:
    fcntl.flock(fd, fcntl.LOCK_EX | (0 if block else fcntl.LOCK_NB))
except BlockingIOError:
    sys.exit(conflict)
os.ftruncate(fd, 0)
os.write(fd, str(os.getpid()).encode())
sys.exit(subprocess.call(args[1:], pass_fds=(fd,)) if len(args) > 1 else 0)
`;

export const TIMEOUT_SHIM = `#!/usr/bin/env python3
# timeout [-k grace] <seconds> <command...>: TERM the command's process group at <seconds>, KILL after grace.
import os, signal, subprocess, sys
args = sys.argv[1:]
grace = 0
if args[0] == '-k':
    grace = float(args[1])
    args = args[2:]
limit = float(args[0])
child = subprocess.Popen(args[1:], start_new_session=True)
try:
    sys.exit(child.wait(timeout=limit))
except subprocess.TimeoutExpired:
    os.killpg(child.pid, signal.SIGTERM)
    try:
        child.wait(timeout=grace or None)
    except subprocess.TimeoutExpired:
        os.killpg(child.pid, signal.SIGKILL)
        child.wait()
    print(f'timeout: killed after {limit:g}s', file=sys.stderr)
    sys.exit(124)
`;

/** The remote script: shims, checkout, install, then the command under the lock. */
export function remoteScript({ sha, timeout, command }) {
  return `set -uo pipefail
export PATH="$HOME/.gates/bin:$HOME/.bun/bin:$HOME/.local/node/bin:$PATH"
mkdir -p ~/.gates/bin
cat > ~/.gates/bin/flock <<'SHIM'
${FLOCK_SHIM}SHIM
cat > ~/.gates/bin/timeout <<'SHIM'
${TIMEOUT_SHIM}SHIM
chmod +x ~/.gates/bin/flock ~/.gates/bin/timeout
[ -d ${REMOTE_REPO}/.git ] || git clone -q ${REPO_URL} ${REMOTE_REPO} || exit 1
cd ${REMOTE_REPO}
git fetch -q origin main || exit 1
git fetch -q ~/solidports-remote.bundle refs/remote-mac/run || exit 1
git checkout -q --detach ${quote(sha)} || exit 1
echo "remote-mac: at $(git log --oneline -1)"
bun install --frozen-lockfile > /tmp/solidports-install.log 2>&1 || { tail -20 /tmp/solidports-install.log; exit 1; }
flock -n ~/.gates/heavy.flock true || echo "remote-mac: waiting for ~/.gates/heavy.flock ($(cat ~/.gates/heavy.flock 2>/dev/null) holds it)"
GATES_LOCK=~/.gates/solidports-suites.flock flock ~/.gates/heavy.flock timeout -k 30 ${timeout} sh -c ${quote(command.map(quote).join(' '))}
`;
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, { cwd: root, encoding: 'utf8', ...options });
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(' ')} exited ${result.status}: ${result.stderr}`);
  }
  return result.stdout;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  options.sha = run('git', ['rev-parse', options.sha]).trim();
  const bundle = path.join(root, '.tmp/grunt/solidports-remote.bundle');
  fs.mkdirSync(path.dirname(bundle), { recursive: true });
  const base = run('git', ['merge-base', 'origin/main', options.sha]).trim();
  // A bundle carries refs, not bare commits: a temporary ref (not a branch) names the commit.
  const ref = 'refs/remote-mac/run';
  run('git', ['update-ref', ref, options.sha]);
  try {
    // At origin/main itself the clone already has the commit; the bundle still needs one.
    run('git', ['bundle', 'create', bundle, ...(base === options.sha ? [ref, '-1'] : [`${base}..${ref}`])]);
  } finally {
    run('git', ['update-ref', '-d', ref]);
  }
  run('scp', ['-q', bundle, `${HOST}:solidports-remote.bundle`]);

  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const log = path.join(root, `.tmp/grunt/remote-mac/${stamp}.log`);
  fs.mkdirSync(path.dirname(log), { recursive: true });
  console.log(`remote-mac: ${options.sha.slice(0, 12)} on ${HOST}; log ${path.relative(root, log)}`);
  const out = fs.createWriteStream(log);
  const code = await new Promise((resolve) => {
    const child = spawn('ssh', [HOST, 'bash -s'], { stdio: ['pipe', 'pipe', 'pipe'] });
    child.stdout.on('data', (chunk) => {
      process.stdout.write(chunk);
      out.write(chunk);
    });
    child.stderr.on('data', (chunk) => {
      process.stderr.write(chunk);
      out.write(chunk);
    });
    child.on('close', resolve);
    child.stdin.end(remoteScript(options));
  });
  out.end();
  for (const file of options.fetch) {
    const target = path.join(root, '.tmp/grunt/remote-mac', stamp, file);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    const copy = spawnSync('scp', ['-q', '-r', `${HOST}:${REMOTE_REPO.slice(2)}/${file}`, target]);
    console.log(
      copy.status === 0
        ? `remote-mac: fetched ${file} → ${path.relative(root, target)}`
        : `remote-mac: could not fetch ${file}`,
    );
  }
  console.log(`remote-mac: exit ${code}`);
  process.exit(code ?? 1);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  await main();
}
