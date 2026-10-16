---
tags: [testing, ci, vitest, browsers]
sources: [.github/workflows/base-ui-tests.yml, .github/workflows/base-ui-browser-parity.yml, .github/workflows/base-ui-typescript-next.yml, .github/workflows/ci.yml, packages/base-ui/scripts/test-all.mjs, packages/base-ui/packages/solid/vitest.config.mts, packages/base-ui/packages/solid/vitest.ssr.config.mts, packages/base-ui/vitest.shared.mts, scripts/verify.ts]
verified: 2026-10-16
---

# Test suites

Base UI has 27 suites, one per step of the "Base UI tests" workflow plus Firefox and WebKit browser parity; `bun run test:base-ui:all` runs them all, while root `bun run verify` checks only Base UI types and this context map.

## Run everything

From the repo root: `bun run test:base-ui:all` (`packages/base-ui/scripts/test-all.mjs`).

- Runs each suite with the workflow's own commands, in order, then prints a pass / fail / not run table. A suite that cannot run here (screen reader off Windows) is "not run", never omitted. Report all three states; "not run" is not a pass.
- `--list` prints the 27 suites; `--only a,b` reruns some (the rest show "not run").
- Generated-file suites fail when they change the tree, compared against the tree state before the suite (local edits are not discarded).
- Each suite's log goes to a gitignored folder at the repo root, one `<suite>.log` per suite; a failing row prints its path.

## Local setup

- Other repos' gates on the same machine: suites that launch browsers or bind fixed ports (`chromium`, both parity suites, `e2e`, `regressions`, `screen-reader`, `docs-hydration`, `benchmark`) take an exclusive flock on the gate lock that flare's gates also take (`~/.cache/flare-gates/heavy.lock`, `GATES_LOCK` overrides it), and log when they wait for it. Ports fail instead of drifting. The fixed-port `serve` scripts run `scripts/assert-port-free.mjs 5173` first, because `serve` 14 moves to a random port when 5173 is taken even with `--no-port-switching`. The vitest browser server binds `127.0.0.1:63315` with `strictPort`; with only a port, Vite binds `localhost` beside a process holding the other address family, and the test iframe can load that process ("Cannot connect to the iframe ... unknown due to CORS", "Failed to fetch dynamically imported module"). A process outside any gate (a dev server on 5173) still fails these suites, now with a message naming the port.
- Playwright browsers: CI installs them per job (`bunx playwright install --with-deps chromium` in the workflows), and nothing installs them locally. After `bun install` or any Playwright bump, run `bunx playwright install chromium firefox webkit` from `packages/base-ui`. `regressions` launches full Chromium (`~/.cache/ms-playwright/chromium-<rev>`), not only the headless shell; when that is missing it fails with "Executable doesn't exist" and the runner then throws `ENOENT` renaming `screenshots/chrome`.
- `/tmp` quota: on this machine `/tmp` (and `/dev/shm`) is a tmpfs mounted with `usrquota`, and uid 1000 has a 12.18 GiB block limit shared by every process of the user, every Claude session included. Playwright writes its browser profiles and artifacts there. Near the limit, `chromium` dies about 30 files in, with `Unknown system error -122` (EDQUOT) on writes, `Failed to fetch dynamically imported module`, and `Cannot connect to the iframe`; the files pass when run alone. The disk itself has room, so `df` hides this. Read usage against the limit with the `quotactl_fd` syscall (no quota tools are installed), and delete stale test scratch in `/tmp` before a full run.

## Suites and CI jobs

Workflow `.github/workflows/base-ui-tests.yml` runs on push to `main`, pull requests, dispatch, and from the release workflow. Commands run from `packages/base-ui` unless the cwd says otherwise.

| suite | CI job | command |
| --- | --- | --- |
| `format` | Linting | `bun run fmt:check` (root; oxfmt ignores `packages/base-ui/**`) |
| `oxlint` | Linting | `bun run lint` (root; lints `scripts/` only) |
| `eslint` | Linting | `bunx eslint packages/solid/src packages/solid/test docs/solid/src --report-unused-disable-directives --max-warnings 0` |
| `eslint-rule-tests` | Linting | `bun run test:lint-rules` |
| `stylelint` | Linting | `bunx stylelint ... 'docs/solid/**/*.css'` |
| `vale` | Linting | `bun run valelint` (every tracked `.md`/`.mdx` outside `docs/docs-infra`) |
| `error-codes` | Generated files verification | `bun run extract-error-codes` + clean diff |
| `inline-scripts` | Generated files verification | `bun run inline-scripts` + clean diff |
| `test-parity` | Generated files verification | `node scripts/test-parity.mjs` |
| `typecheck` | Typechecking | `bun run typecheck` (root) |
| `typecheck-solid` | Typechecking | `bun run typescript` and `bunx tsc -p tsconfig.test.json --noEmit` (cwd `packages/solid`) |
| `typecheck-docs` | Typechecking | `bun run typescript --noEmit` (cwd `docs/solid`) |
| `typecheck-next` | Typechecking (typescript@next) | `bunx --package typescript@next tsc -b tsconfig.json` (cwd `packages/solid`) |
| `package` | Package verification | `bun run types`, `test:built-types`, `test:package` (cwd `packages/solid`) |
| `public-types` | Package verification | `bun run release:test` (cwd `test/public-types-solid`) |
| `node-resolution` | Package verification | `bun run test` (cwd `test/node-resolution-solid`) |
| `jsdom` | JSDOM tests | `bun run test:solid:jsdom --run --maxWorkers=2` (after `bun run types` in CI) |
| `chromium` | Browser tests | `bun run test:solid:chromium --run --maxWorkers=2` |
| `parity-firefox` | Browser parity (firefox) | React and Solid suites with JSON reporters, then `scripts/browser-parity.mjs --confirm firefox` |
| `parity-webkit` | Browser parity (webkit) | same for WebKit |
| `e2e` | E2E tests | `bun run test:e2e:solid` |
| `regressions` | Regression tests | `test:regressions:solid:build`, then `test:regressions:solid` |
| `screen-reader` | Screen Reader (Windows / NVDA) | `bunx guidepup install`, then Playwright with `test/screen-reader-solid/playwright.config.ts` |
| `docs-validate` | Validating Docs | `bun run docs:validate` + clean diff |
| `docs-build` | Validating Docs | `bun run docs:build` |
| `docs-hydration` | Validating Docs | `bun run docs:check-hydration --serve` (Solid only) |
| `benchmark` | Benchmark tests | `bun run bench:solid:build`, then `bun run bench:solid` |

Other workflows:

- `base-ui-browser-parity.yml`: push to `main` touching `packages/base-ui/**` runs Firefox and WebKit; a dispatch adds Chromium. Each job uploads both JSON reports. Details in [parity](parity.md).
- `base-ui-typescript-next.yml`: nightly cron. Fails on `tsc -b` with `typescript@next`; the built-types check after it only logs.
- `ci.yml`: commitlint on pull requests; `lint` job (`fmt:check`, `lint`, `typecheck`, `test:scripts`); `solid-table tests`.

## Vitest environments

`packages/base-ui/vitest.shared.mts` reads `VITEST_ENV`:

| `VITEST_ENV` | runs in | script |
| --- | --- | --- |
| `jsdom` or unset | jsdom (`pretendToBeVisual`) | `test:solid:jsdom` |
| `chromium`, `firefox`, `webkit` | Playwright browser mode, headless, timezone pinned to UTC | `test:solid:<browser>` |
| `all-browsers` | all three browser instances | `test:solid:browsers` |

- `test:solid:_unit` sets `TZ=UTC` and runs four projects: `@solidports/base-ui`, `@solidports/base-ui:ssr`, `@solidports/docs`, `@solidports/docs:dom`.
- `packages/solid/vitest.config.mts`: Solid plugin with `hydratable: true`; excludes `test/ssr/**`, and `test/package/**` in browsers; `globalSetup` server-renders hydration fixtures in Node first; setup files `test/disableAutoCleanup.ts` and `test/setupSolid.ts`; pre-optimizes every browser dependency so a cold CI runner does not load two reactive cores.
- `packages/solid/vitest.ssr.config.mts`: project `@solidports/base-ui:ssr`, Node environment, `test/ssr/**/*.test.ts`.
- CI retries a failed test once (`retry: process.env.CI ? 1 : 0`).
- Single component: `bun run test:solid:jsdom NumberField --no-watch` (or `test:solid:chromium`).

## Engine matrix

| engine | upstream CI | ours |
| --- | --- | --- |
| jsdom | JSDOM tests | JSDOM tests |
| Chromium | Browser tests (`test:chromium`); e2e and regressions | Browser tests; e2e; regressions (`VITEST_ENV: 'chromium'`) |
| Firefox, WebKit | not run | browser parity workflow, measured against upstream's results in the same browser |

Upstream mui/base-ui runs `test:jsdom` and `test:chromium` on CircleCI, and its e2e and regression jobs install only Chromium. Its `browserstack-force` pipeline parameter is still declared, but no job runs BrowserStack. E2E and regressions stay Chromium-only here too.

## Root gates

`bun run verify` (`scripts/verify.ts`) runs `fmt:check`, `lint`, `typecheck`, `test`, `test:scripts`, `test:solid-table` on a clean tree and stamps HEAD; see `.claude/rules/standards.md`. For Base UI it covers only `tsc -b` of `packages/solid` (inside root `typecheck`) and the scripts tests (this context map among them). Root oxfmt and oxlint ignore `packages/base-ui/**`, and root `test` runs only Recharts. A Base UI change therefore also needs `bun run test:base-ui:all`, as the root `AGENTS.md` says.
