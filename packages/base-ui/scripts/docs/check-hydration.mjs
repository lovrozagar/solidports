#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * Checks the built Solid docs in Chromium, route by route:
 *
 * - Route parity: every React docs page has a Solid page, unless `excluded.mjs` leaves it out.
 * - Each Solid route returns 200 with server-rendered hydration keys, logs no errors, and every
 *   server-rendered element is claimed by hydration (an unclaimed one is a key miss: Solid built a
 *   detached copy, and the element on the page never becomes interactive).
 * - The first collapsed trigger in the page content (not a text input, which opens as the user
 *   types) opens on click and stays the same element.
 * - A link preloads its page: hovering a side-nav link loads the page's code, and clicking it then
 *   shows the page without loading more.
 *
 *   node scripts/docs/check-hydration.mjs --serve            # serves the build with docs:preview
 *   node scripts/docs/check-hydration.mjs --origin <url> [route…]
 */
import { spawn } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';
import { consoleProblem } from './consoleCheck.mjs';
import { EXCLUDED } from './excluded.mjs';

const FORK = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const REACT_APP = path.join(FORK, 'docs/react/src/app');
const SOLID_APP = path.join(FORK, 'docs/solid/src/app');
const PORT = 3001;
const CONCURRENCY = 4;

const args = process.argv.slice(2);
const serve = args.includes('--serve');
const originFlag = args.indexOf('--origin');
const origin = originFlag === -1 ? `http://localhost:${PORT}` : args[originFlag + 1];
const only = args.filter((arg, index) => !arg.startsWith('--') && args[index - 1] !== '--origin');

/** The page files under an app folder, as paths relative to it. */
function pageFiles(dir, rel = '') {
  const files = [];
  for (const entry of fs.readdirSync(path.join(dir, rel), { withFileTypes: true })) {
    const child = rel ? `${rel}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      files.push(...pageFiles(dir, child));
    } else if (/^page\.(tsx|mdx)$/.test(entry.name)) {
      files.push(child);
    }
  }
  return files;
}

/** The React pages without a Solid page, other than the excluded ones. */
function missingRoutes() {
  return pageFiles(REACT_APP)
    .filter((file) => !EXCLUDED.some((entry) => `src/app/${file}`.startsWith(entry.path)))
    .map((file) => file.replace(/^\(docs\)\/react\//, '(docs)/solid/'))
    .filter((file) => !fs.existsSync(path.join(SOLID_APP, file)));
}

/** The Solid routes with no dynamic segment: route groups and the page file leave the path. */
function solidRoutes() {
  return pageFiles(SOLID_APP)
    .map((file) => file.split('/').slice(0, -1))
    .filter((segments) => !segments.some((segment) => /^[[_]/.test(segment)))
    .map((segments) => `/${segments.filter((segment) => !/^\(.*\)$/.test(segment)).join('/')}`)
    .sort();
}

/** Records the elements hydration claims: Solid adds each one to `_$HY.completed`. */
function recordClaims() {
  const claimed = new WeakSet();
  window.__claimed = claimed;
  let value;
  Object.defineProperty(window, '_$HY', {
    configurable: true,
    get: () => value,
    set(next) {
      value = next;
      const completed = next?.completed;
      if (completed && !completed.__recorded) {
        const add = completed.add.bind(completed);
        completed.add = (node) => {
          claimed.add(node);
          return add(node);
        };
        completed.__recorded = true;
      }
    },
  });
}

async function checkRoute(browser, route) {
  const page = await browser.newPage();
  await page.addInitScript(recordClaims);
  const problems = [];
  page.on('console', (message) => {
    const problem = consoleProblem({ type: message.type(), text: message.text() });
    if (problem) problems.push(problem);
  });
  page.on('pageerror', (error) => problems.push(`page error: ${error.message.slice(0, 240)}`));
  let demo = 'none';
  try {
    const response = await page.goto(origin + route, { waitUntil: 'networkidle', timeout: 120000 });
    if (response?.status() !== 200) {
      problems.push(`status ${response?.status()}`);
    }
    await page.waitForTimeout(500);
    const keys = await page.evaluate(() => {
      const keyed = [...document.querySelectorAll('[_hk]')];
      const unclaimed = keyed.filter((element) => !window.__claimed.has(element));
      return {
        keyed: keyed.length,
        unclaimed: unclaimed.length,
        samples: unclaimed.slice(0, 3).map((element) => element.outerHTML.slice(0, 100)),
      };
    });
    if (keys.keyed === 0) {
      problems.push('no server-rendered hydration keys');
    }
    if (keys.unclaimed > 0) {
      problems.push(`${keys.unclaimed} of ${keys.keyed} keyed elements not hydrated`);
      problems.push(...keys.samples.map((sample) => `  ${sample}`));
    }
    // A text input (an autocomplete's) opens as the user types, not on click.
    const trigger = page.locator('main [aria-expanded="false"]:not(input):visible').first();
    if ((await trigger.count()) > 0) {
      const handle = await trigger.elementHandle();
      await trigger.click();
      let opened = false;
      for (let attempt = 0; attempt < 20 && !opened; attempt += 1) {
        opened = await handle.evaluate(
          (element) => element.getAttribute('aria-expanded') === 'true',
        );
        if (!opened) {
          await page.waitForTimeout(100);
        }
      }
      const connected = await handle.evaluate((element) => element.isConnected);
      demo = opened && connected ? 'opens' : 'broken';
      if (!opened) {
        problems.push('the first collapsed trigger does not open');
      }
      if (!connected) {
        problems.push('the first collapsed trigger was replaced on click');
      }
    }
  } catch (error) {
    problems.push(`check failed: ${error.message.split('\n')[0]}`);
  }
  await page.close();
  return { route, demo, problems };
}

const NAVIGATION_FROM = '/solid/components/accordion';
const NAVIGATION_TO = 'Menu';

/** Hovers a side-nav link, then clicks it: the hover loads the page, so the click loads nothing. */
async function checkNavigation(browser) {
  const page = await browser.newPage();
  const problems = [];
  let scripts = 0;
  page.on('request', (request) => {
    if (request.resourceType() === 'script') {
      scripts += 1;
    }
  });
  try {
    await page.goto(origin + NAVIGATION_FROM, { waitUntil: 'networkidle', timeout: 120000 });
    const link = page.locator('nav a', { hasText: new RegExp(`^${NAVIGATION_TO}$`) }).first();
    scripts = 0;
    await link.hover();
    await page.waitForTimeout(200);
    await page.waitForLoadState('networkidle');
    if (scripts === 0) {
      problems.push(`hovering the ${NAVIGATION_TO} link loads none of its page`);
    }
    scripts = 0;
    await link.click();
    await page.waitForFunction(
      (title) => document.querySelector('h1')?.textContent?.trim() === title,
      NAVIGATION_TO,
      { timeout: 60000 },
    );
    if (scripts > 0) {
      problems.push(`clicking the ${NAVIGATION_TO} link loads ${scripts} more scripts`);
    }
  } catch (error) {
    problems.push(`check failed: ${error.message.split('\n')[0]}`);
  }
  await page.close();
  return { route: `${NAVIGATION_FROM} → ${NAVIGATION_TO}`, demo: 'navigation', problems };
}

/** Serves the build with `docs:preview` and resolves once it answers. */
async function startPreview() {
  const busy = await fetch(origin).then(
    () => true,
    () => false,
  );
  if (busy) {
    throw new Error(`${origin} already answers: stop that server, then serve the build here`);
  }
  const server = spawn('bun', ['run', 'docs:preview'], {
    cwd: FORK,
    detached: true,
    stdio: 'ignore',
  });
  for (let attempt = 0; attempt < 120; attempt += 1) {
    try {
      // eslint-disable-next-line no-await-in-loop -- polls until the server answers
      await fetch(origin);
      return server;
    } catch {
      // eslint-disable-next-line no-await-in-loop -- polls until the server answers
      await new Promise((resolve) => {
        setTimeout(resolve, 500);
      });
    }
  }
  process.kill(-server.pid);
  throw new Error(`docs:preview did not answer at ${origin}`);
}

const missing = missingRoutes();
for (const file of missing) {
  console.log(
    `FAIL route parity: no Solid page for ${file.replace('(docs)/solid/', '(docs)/react/')}`,
  );
}

const routes = only.length > 0 ? only : solidRoutes();
const server = serve ? await startPreview() : null;
const browser = await chromium.launch();
const results = [];
let navigation;
try {
  const queue = [...routes];
  await Promise.all(
    Array.from({ length: CONCURRENCY }, async () => {
      while (queue.length > 0) {
        const route = queue.shift();
        // eslint-disable-next-line no-await-in-loop -- one route at a time per worker
        const result = await checkRoute(browser, route);
        results.push(result);
        console.log(`${result.problems.length ? 'FAIL' : 'ok  '} ${route} (demo: ${result.demo})`);
        for (const problem of result.problems) {
          console.log(`     ${problem}`);
        }
      }
    }),
  );
  navigation = await checkNavigation(browser);
  console.log(`${navigation.problems.length ? 'FAIL' : 'ok  '} ${navigation.route} (preload)`);
  for (const problem of navigation.problems) {
    console.log(`     ${problem}`);
  }
} finally {
  await browser.close();
  if (server) {
    process.kill(-server.pid);
  }
}

const failed = results.filter((result) => result.problems.length > 0).length;
console.log(
  `\n${results.length - failed} of ${results.length} routes ok, ${failed} failed; ` +
    `${missing.length} React pages without a Solid page; link preload ${
      navigation?.problems.length === 0 ? 'ok' : 'failed'
    }`,
);
process.exit(failed > 0 || missing.length > 0 || navigation?.problems.length !== 0 ? 1 : 0);
