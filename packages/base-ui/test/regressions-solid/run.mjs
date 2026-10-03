// Runs the upstream visual regression spec (`test/regressions/index.test.ts`, unchanged) against the
// React host and then the Solid host, keeping each run's screenshots under `screenshots/<host>`,
// then compares them (`scripts/compare-regressions.mjs`). Build the hosts first
// (`test:regressions:solid:build`).
import { spawn, spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(here, '../..');
const specScreenshots = path.join(packageRoot, 'test/regressions/screenshots/chrome');
const outDir = path.resolve(process.env.REGRESSIONS_OUT ?? path.join(here, 'screenshots'));
const port = 5173;

async function waitForServer() {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      const response = await fetch(`http://localhost:${port}/`);
      if (response.ok) {
        return;
      }
    } catch {
      // Not up yet.
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`The regressions server did not start on port ${port}.`);
}

async function waitForPortFree() {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      await fetch(`http://localhost:${port}/`);
    } catch {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Port ${port} is still in use.`);
}

async function runHost(host) {
  await waitForPortFree();
  // Its own process group: `npx` starts `serve` as a child, and both must stop before the next host.
  const server = spawn('npx', ['serve', path.join(here, host), '-p', String(port)], {
    cwd: packageRoot,
    detached: true,
    stdio: 'ignore',
  });
  try {
    await waitForServer();
    // The spec launches a headed browser; give it a virtual display when there is none.
    const command = ['npx', 'vitest', 'run', '--project', 'regressions'];
    const useXvfb = !process.env.DISPLAY || process.env.REGRESSIONS_XVFB === '1';
    const result = spawnSync(
      useXvfb ? 'xvfb-run' : command[0],
      useXvfb ? ['-a', ...command] : command.slice(1),
      {
        cwd: packageRoot,
        env: { ...process.env, VITEST_ENV: 'chromium' },
        stdio: 'inherit',
      },
    );
    const target = path.join(outDir, host);
    fs.rmSync(target, { force: true, recursive: true });
    fs.mkdirSync(outDir, { recursive: true });
    fs.renameSync(specScreenshots, target);
    return result.status ?? 1;
  } finally {
    process.kill(-server.pid, 'SIGTERM');
    await waitForPortFree();
  }
}

const statuses = [];
for (const host of ['react', 'solid']) {
  statuses.push(await runHost(host));
}
const compare = spawnSync(
  'node',
  [path.join(packageRoot, 'scripts/compare-regressions.mjs'), outDir],
  { cwd: packageRoot, stdio: 'inherit' },
);
process.exit(Math.max(...statuses, compare.status ?? 1));
