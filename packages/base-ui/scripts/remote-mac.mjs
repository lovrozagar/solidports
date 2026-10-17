/* eslint-disable no-console */
// Runs a command on the Mac test machine (`ssh mac`) at a local commit, for suites this machine is
// too loaded to run. The commit travels as a git bundle on top of origin/main into ~/solidports-ci
// (cloned from GitHub once), dependencies install from the lockfile, and the command runs from the
// monorepo root under the Mac's machine-wide lock with a hard timeout. Its output streams to the
// terminal and to a local log; `--fetch <path>` copies a result file back afterwards.
//
// macOS has no `flock` or `timeout`, so the run installs small Python stand-ins in ~/.gates/bin:
// an fcntl lock released when its holder dies, and a timeout that kills the command's process
// group. Every run holds ~/.gates/heavy.flock (other repos' Mac gates take the same lock) from its
// checkout to the copy of its `--fetch` files, since all runs share the one checkout: a run queued
// behind another must not move the tree under it. Each run sends its own bundle and collects its
// files in its own folder. The suites inside a run order themselves on a lock of their own, so the
// two never deadlock.
//
// Usage (from the monorepo root):
//   node packages/base-ui/scripts/remote-mac.mjs <sha> [--timeout 1200] [--fetch <path>]... -- <command>
//   e.g. ... HEAD -- bun run test:base-ui:all --only chromium
// The timeout covers the checkout and install too, which run under the lock.
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
# flock [-n] [-o] [-E code] <file> [command...]: an fcntl lock on <file>, held while the command
# runs; the command inherits it unless -o. TERM, INT and HUP pass on to the command.
import fcntl, os, signal, subprocess, sys
args = sys.argv[1:]
block = True
inherit = True
conflict = 1
while args and args[0] in ('-n', '-o', '-E'):
    if args[0] == '-n':
        block = False
        args = args[1:]
    elif args[0] == '-o':
        inherit = False
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
if len(args) == 1:
    sys.exit(0)
child = subprocess.Popen(args[1:], pass_fds=(fd,) if inherit else ())
for sig in (signal.SIGTERM, signal.SIGINT, signal.SIGHUP):
    signal.signal(sig, lambda signum, frame: child.send_signal(signum))
sys.exit(child.wait())
`;

export const TIMEOUT_SHIM = `#!/usr/bin/env python3
# timeout [-k grace] <seconds> <command...>: TERM the command's process group at <seconds>, KILL after
# grace. TERM, INT and HUP end the command's process group the same way.
import os, signal, subprocess, sys
args = sys.argv[1:]
grace = 0
if args[0] == '-k':
    grace = float(args[1])
    args = args[2:]
limit = float(args[0])
child = subprocess.Popen(args[1:], start_new_session=True)

def end(code, reason):
    try:
        os.killpg(child.pid, signal.SIGTERM)
        child.wait(timeout=grace or None)
    except subprocess.TimeoutExpired:
        os.killpg(child.pid, signal.SIGKILL)
        child.wait()
    except ProcessLookupError:
        pass
    print(f'timeout: {reason}', file=sys.stderr)
    sys.exit(code)

for sig in (signal.SIGTERM, signal.SIGINT, signal.SIGHUP):
    signal.signal(sig, lambda signum, frame: end(128 + signum, f'stopped by signal {signum}'))
try:
    sys.exit(child.wait(timeout=limit))
except subprocess.TimeoutExpired:
    end(124, f'killed after {limit:g}s')
`;

/**
 * The run inside the lock: clone once, check out the commit from the run's bundle, install, run
 * the command, then copy the `fetch` files to the run's own folder (`~/<outDir>`).
 */
export function lockedScript({ sha, command, bundle, ref, fetch = [], outDir }) {
  const collect = fetch
    .map(
      (file) =>
        `mkdir -p "$(dirname ~/${outDir}/${quote(file)})" && cp -R ${quote(file)} ~/${outDir}/${quote(file)} || echo "remote-mac: could not collect "${quote(file)}`,
    )
    .join('\n');
  return `[ -d ${REMOTE_REPO}/.git ] || git clone -q ${REPO_URL} ${REMOTE_REPO} || exit 1
cd ${REMOTE_REPO} || exit 1
git fetch -q origin main || exit 1
git fetch -q ~/${bundle} ${ref} || exit 1
rm -f ~/${bundle}
git checkout -q --detach ${quote(sha)} || exit 1
echo "remote-mac: at $(git log --oneline -1)"
bun install --frozen-lockfile > /tmp/solidports-install.log 2>&1 || { tail -20 /tmp/solidports-install.log; exit 1; }
${command.map(quote).join(' ')}
code=$?
mkdir -p ~/${outDir}
${collect}
exit $code
`;
}

/** The remote script: shims, then the checkout, install and command under the lock. */
export function remoteScript({ sha, timeout, command, bundle, ref, fetch = [], outDir, heartbeat }) {
  return `set -uo pipefail
export PATH="$HOME/.gates/bin:$HOME/.bun/bin:$HOME/.local/node/bin:$PATH"
mkdir -p ~/.gates/bin${
    heartbeat
      ? `
mkdir -p "$(dirname ~/${heartbeat})" && touch ~/${heartbeat}
export REMOTE_MAC_HEARTBEAT=~/${heartbeat}`
      : ''
  }
# Written beside the installed shims and renamed over them: a run started together may be
# executing them, and a rewrite in place made it exit 126 or read a half-written script.
cat > ~/.gates/bin/flock.$$ <<'SHIM'
${FLOCK_SHIM}SHIM
cat > ~/.gates/bin/timeout.$$ <<'SHIM'
${TIMEOUT_SHIM}SHIM
chmod +x ~/.gates/bin/flock.$$ ~/.gates/bin/timeout.$$
mv -f ~/.gates/bin/flock.$$ ~/.gates/bin/flock
mv -f ~/.gates/bin/timeout.$$ ~/.gates/bin/timeout
flock -n ~/.gates/heavy.flock true || echo "remote-mac: waiting for ~/.gates/heavy.flock ($(cat ~/.gates/heavy.flock 2>/dev/null) holds it)"
${lockedRun(timeout, ['bash', '-c', lockedScript({ sha, command, bundle, ref, fetch, outDir })])}`;
}

/** How often the driver refreshes a run's heartbeat file, and how stale it may get. */
export const HEARTBEAT_SECONDS = 20;
export const HEARTBEAT_STALE_SECONDS = 90;

/**
 * Runs `command` under the Mac's machine-wide lock with a hard timeout, and ends it when the
 * machine that started it goes away: a run stopped on this machine must not go on holding the lock
 * there. Two signs: the ssh session ends (its parent, or `$REMOTE_MAC_WATCH`), or the heartbeat
 * file `$REMOTE_MAC_HEARTBEAT`, which the driver refreshes every `HEARTBEAT_SECONDS`, goes
 * `$REMOTE_MAC_STALE` seconds without one. The session alone is not enough: with no tty, sshd
 * notices a vanished client only when it next forwards output, so a quiet run held the lock for 48
 * minutes after its driver was stopped. Heavy suites run one at a time there unless the caller sets
 * `GATES_HEAVY`: jsdom beside a browser suite took 922 s and timed out a cold import test, and the
 * two one after the other took 527 s.
 */
export function lockedRun(timeout, command) {
  return `GATES_HEAVY=\${GATES_HEAVY:-1} GATES_LOCK=~/.gates/solidports-suites.flock flock ~/.gates/heavy.flock timeout -k 30 ${timeout} sh -c ${quote(command.map(quote).join(' '))} &
RUN=$!
WATCH=\${REMOTE_MAC_WATCH:-$PPID}
HEARTBEAT=\${REMOTE_MAC_HEARTBEAT:-}
STALE=\${REMOTE_MAC_STALE:-${HEARTBEAT_STALE_SECONDS}}
(
  # Its stderr is the pipe to sshd: once that is gone, a report would raise SIGPIPE and end this
  # watcher before it stopped the run. It stops the run first, and ignores SIGPIPE and SIGHUP.
  trap '' PIPE HUP
  while kill -0 "$RUN" 2>/dev/null; do
    if ! kill -0 "$WATCH" 2>/dev/null; then
      kill -TERM "$RUN"
      echo "remote-mac: the session that started this run is gone; stopped it" >&2
      break
    fi
    if [ -n "$HEARTBEAT" ]; then
      beat=$(stat -c %Y "$HEARTBEAT" 2>/dev/null || stat -f %m "$HEARTBEAT" 2>/dev/null || echo 0)
      if [ $(( $(date +%s) - beat )) -gt "$STALE" ]; then
        kill -TERM "$RUN"
        echo "remote-mac: the machine that started this run stopped its heartbeat; stopped it" >&2
        break
      fi
    fi
    sleep 1
  done
) &
wait "$RUN"
code=$?
# A driver stopped by force never removes its heartbeat file.
[ -n "$HEARTBEAT" ] && rm -f "$HEARTBEAT"
exit $code
`;
}

/** ssh's own exit code: the remote command never ran or the session died, never the command's. */
const SSH_FAILED = 255;
const LINK_ERROR = new RegExp(
  [
    'Connection (closed|timed out|refused|reset)',
    'not responding',
    'Could not resolve',
    'Network is unreachable',
    'No route to host',
    'Broken pipe',
  ].join('|'),
);

/** Whether a step failed on the link to the Mac (ssh or scp's 255 with a connection error). */
export function isLinkFailure(status, stderr) {
  return status === SSH_FAILED && LINK_ERROR.test(stderr ?? '');
}

/** How long a run waits for a lost link before it fails: a blip must not cost a night's queue. */
export const LINK_BUDGET_MS = 15 * 60 * 1000;
const LINK_DELAYS_MS = [10_000, 30_000, 60_000, 120_000];
const PROBE_MS = 30_000;

/**
 * Runs `step` (resolving `{ status, stderr }`) and, while it fails on the link, waits (the backoff
 * in `delaysMs`, then `probe` until the Mac answers) and runs it again, up to `budgetMs` of
 * waiting.
 * Any other result, success or the step's own failure, is returned as it is.
 */
export async function withLink(
  step,
  {
    probe,
    wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
    delaysMs = LINK_DELAYS_MS,
    probeMs = PROBE_MS,
    budgetMs = LINK_BUDGET_MS,
    log = () => {},
  },
) {
  let waited = 0;
  const pause = async (ms) => {
    if (waited + ms > budgetMs) {
      throw new Error(
        `remote-mac: the link to the Mac stayed down for ${Math.round(waited / 1000)} s; giving up`,
      );
    }
    await wait(ms);
    waited += ms;
  };
  for (let attempt = 0; ; attempt += 1) {
    const result = await step();
    if (!isLinkFailure(result.status, result.stderr)) {
      return result;
    }
    const delay = delaysMs[Math.min(attempt, delaysMs.length - 1)];
    const reason = result.stderr.trim().split('\n').pop();
    log(`remote-mac: lost the link (${reason}); retrying in ${delay / 1000} s`);
    await pause(delay);
    while (!(await probe())) {
      await pause(probeMs);
    }
  }
}

/** Whether the Mac answers an ssh round trip within ten seconds. */
const probeLink = async () =>
  spawnSync('ssh', ['-o', 'ConnectTimeout=10', '-o', 'BatchMode=yes', HOST, 'true']).status === 0;

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
  // Every name a run uses is its own, so runs started together never share a file or a ref.
  const stamp = `${new Date().toISOString().replace(/[:.]/g, '-')}-${process.pid}`;
  const bundle = path.join(root, `.tmp/grunt/remote-mac/${stamp}.bundle`);
  fs.mkdirSync(path.dirname(bundle), { recursive: true });
  const base = run('git', ['merge-base', 'origin/main', options.sha]).trim();
  // A bundle carries refs, not bare commits: a temporary ref (not a branch) names the commit.
  const ref = `refs/remote-mac/${stamp}`;
  run('git', ['update-ref', ref, options.sha]);
  try {
    // At origin/main itself the clone already has the commit; the bundle still needs one.
    run('git', ['bundle', 'create', bundle, ...(base === options.sha ? [ref, '-1'] : [`${base}..${ref}`])]);
  } finally {
    run('git', ['update-ref', '-d', ref]);
  }
  const remoteBundle = `solidports-remote-${stamp}.bundle`;
  const outDir = `.gates/remote-mac-out/${stamp}`;
  const heartbeat = `.gates/remote-mac-heartbeat/${stamp}`;
  const copied = await withLink(
    async () =>
      spawnSync('scp', ['-q', '-o', 'ConnectTimeout=15', bundle, `${HOST}:${remoteBundle}`], {
        encoding: 'utf8',
      }),
    { probe: probeLink, log: console.error },
  );
  if (copied.status !== 0) {
    throw new Error(`scp ${bundle} exited ${copied.status}: ${copied.stderr}`);
  }
  fs.rmSync(bundle);

  const log = path.join(root, `.tmp/grunt/remote-mac/${stamp}.log`);
  fs.mkdirSync(path.dirname(log), { recursive: true });
  console.log(`remote-mac: ${options.sha.slice(0, 12)} on ${HOST}; log ${path.relative(root, log)}`);
  const out = fs.createWriteStream(log);
  // The run stops itself once this stops: a driver killed here leaves no run holding the lock there.
  const beat = setInterval(() => {
    spawn('ssh', [HOST, `touch ${heartbeat}`], { stdio: 'ignore' }).on('error', () => {});
  }, HEARTBEAT_SECONDS * 1000);
  // A session the link dropped runs again from its start (the run there stops itself once the
  // heartbeat goes stale, and the next one queues on the lock); a run's own exit code is final.
  const session = () =>
    new Promise((resolve) => {
      let stderr = '';
      const child = spawn('ssh', ['-o', 'ConnectTimeout=15', HOST, 'bash -s'], {
        stdio: ['pipe', 'pipe', 'pipe'],
      });
      child.stdout.on('data', (chunk) => {
        process.stdout.write(chunk);
        out.write(chunk);
      });
      child.stderr.on('data', (chunk) => {
        stderr += chunk;
        process.stderr.write(chunk);
        out.write(chunk);
      });
      child.on('close', (status) => resolve({ status, stderr }));
      child.stdin.end(remoteScript({ ...options, bundle: remoteBundle, ref, outDir, heartbeat }));
    });
  const { status: code } = await withLink(session, { probe: probeLink, log: console.error });
  clearInterval(beat);
  out.end();
  for (const file of options.fetch) {
    const target = path.join(root, '.tmp/grunt/remote-mac', stamp, file);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    const copy = spawnSync('scp', ['-q', '-r', `${HOST}:${outDir}/${file}`, target]);
    console.log(
      copy.status === 0
        ? `remote-mac: fetched ${file} → ${path.relative(root, target)}`
        : `remote-mac: could not fetch ${file}`,
    );
  }
  spawnSync('ssh', [HOST, `rm -rf ${quote(outDir)} ${quote(remoteBundle)} ${quote(heartbeat)}`]);
  console.log(`remote-mac: exit ${code}`);
  process.exit(code ?? 1);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  await main();
}
