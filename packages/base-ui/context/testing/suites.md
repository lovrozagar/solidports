---
tags: [testing, ci, vitest, browsers]
sources: [package.json, packages/base-ui/packages/solid/test/warningCensus.ts, packages/base-ui/scripts/warning-census.mjs, scripts/pinned-bun-test.ts, .github/workflows/base-ui-tests.yml, .github/workflows/base-ui-browser-parity.yml, .github/workflows/base-ui-typescript-next.yml, .github/workflows/ci.yml, packages/base-ui/scripts/test-all.mjs, packages/base-ui/packages/solid/vitest.config.mts, packages/base-ui/packages/solid/vitest.ssr.config.mts, packages/base-ui/vitest.shared.mts, scripts/verify.ts]
verified: 2026-10-17
---

# Test suites

Base UI has 28 suites, one per step of the "Base UI tests" workflow plus Firefox and WebKit browser parity; `bun run test:base-ui:all` runs them all, while root `bun run verify` checks only Base UI types and this context map.

## Run everything

From the repo root: `bun run test:base-ui:all` (`packages/base-ui/scripts/test-all.mjs`).

- Runs each suite with the workflow's own commands, then prints a pass / fail / not run table in suite order. A suite that cannot run here (screen reader off Windows) is "not run", never omitted. Report all three states; "not run" is not a pass.
- Suites run concurrently: light ones (lint, typecheck, package, generated files) up to `GATES_LIGHT` at a time (default 4), heavy ones (test runners, browsers, docs builds, benchmark) up to `GATES_HEAVY` (default 2), and at most one `exclusive` suite (browsers, fixed ports) at a time on top of the machine lock below. `after` keeps chains ordered: package → public-types → node-resolution, docs-validate → docs-build → docs-hydration.
- `--list` prints the 28 suites; `--only a,b` reruns some (the rest show "not run"). `--changed [ref]` runs only jsdom and chromium on vitest's module-graph diff against HEAD (uncommitted changes) or the ref, with `--passWithNoTests`: a one-line change to `utils/useRenderElement.tsx` selects 369 test files, an untouched tree none. `--full-bench` runs the measured benchmark instead of the gate's one-run check.
- Generated-file suites fail when they change the paths they declare (`generated`), compared against those paths before the suite (local edits are not discarded); scoping keeps suites running beside them from being blamed on them.
- One run per tree: a second `test:base-ui:all` is refused, naming the PID that holds `.tmp/base-ui-test-all/run.lock`; a crashed run's lock frees itself within seconds. Each run logs to its own `.tmp/base-ui-test-all/<stamp>/` folder (one `<suite>.log` per suite, parity reports beside them), `latest` points at the newest, and a failing row prints its log path.

## Gate tiers

User-approved 2026-10-16 for the perf rewrite (plan 3):

| change | gate |
| --- | --- |
| phase 1 tooling (bench, scripts, context) | `bun run verify`, `bun run test:scripts`, a filtered smoke bench; one full table at plan leaf 1.15 |
| library code (`packages/solid`) | `bun run verify` and the full `test:base-ui:all` table, whose benchmark is the one-run correctness check |
| milestones (`b0`, each family end, the final gate) | the measured benchmark (`--full-bench`, `bench:component`) |

A perf commit is pushed only after its Mac bench against current `main` shows the metric it targets improved and no gated metric regressed under the regression rule (`shared/regression.mjs`, D16); correctness gates alone are not enough (from D13, where a perf unit with every correctness gate green made the server no faster). Before a push of library code, two jsdom runs: the Mac's full test-all jsdom and chromium (the gate of record), and Linux jsdom scoped to the change, `bun run test:solid:jsdom --changed origin/main --run` at `nice -n 19 ionice -c3`. The Mac's timing can hide a failure that is deterministic on Linux, as an effect-order change was (D10). A change to shared core code fans out to most of the suite, which is correct. CI stays the final word.

The benchmark suite's gate form is `WARMUP=0 HEAP_RUNS=1 node test/perf-solid/run.mjs 1`: the same DOM summaries and known differences, without the 8-run timing (about 28 minutes in the measured form).

## Local setup

- Bun: `package.json` pins `bun@1.4.3` (`packageManager`), every workflow's `BUN_VERSION` matches it, and the Mac test machine runs 1.4.3. A local Bun of another version still passes `bun run verify`, so pre-push's `scripts-on-pinned-bun` job (`scripts/pinned-bun-test.ts`) reruns `test:scripts` under the pin through `bunx`; with matching versions it does nothing. A bump changes the pin and every `BUN_VERSION` in one commit, with `bun install --frozen-lockfile` passing under the new version.
- Load robustness (deferred): under heavy machine load (load average above 13 on 16 cores) the chromium suite has lost iframes with "Failed to fetch dynamically imported module" and "Cannot connect to the iframe ... unknown due to CORS" (vitest's orchestrator rejects an iframe whose navigation ended on Chrome's cross-origin error page). The named causes so far were concurrent runs in the same tree and files written into `packages/solid/src` mid-run (a new test file is collected and the module graph invalidated). Run audits and probes in a separate worktree. If it recurs without such a cause, capture Chrome's NetLog (`--log-net-log`) through the Playwright launch args to name the failing request's network error before changing timeouts or worker counts.
- Other repos' gates on the same machine: suites that launch browsers or bind fixed ports (`chromium`, both parity suites, `e2e`, `regressions`, `screen-reader`, `docs-hydration`, `benchmark`) take an exclusive flock on the machine-wide gate lock that flare's gates also take (`~/.cache/gates/heavy.lock`, `GATES_LOCK` overrides it), and log when they wait for it. Each locked command runs under `timeout` (20 minutes, `GATES_TIMEOUT` overrides; the measured benchmark gets an hour), so a hung browser run is killed and the lock released; `bench:component` takes the same lock and timeout for its browser and SSR runs. Ports fail instead of drifting. The fixed-port test servers use `scripts/serve-strict.mjs`, which binds 127.0.0.1 and ::1 on 5173 and exits naming the port when either is taken; `serve` 14 moves to a random port when 5173 is taken even with `--no-port-switching`, and the specs target `localhost:5173`, which either family can answer. The vitest browser server binds `127.0.0.1:63315` with `strictPort`; with only a port, Vite binds `localhost` beside a process holding the other address family, and the test iframe can load that process ("Cannot connect to the iframe ... unknown due to CORS", "Failed to fetch dynamically imported module"). A process outside any gate (a dev server on 5173) still fails these suites, now with a message naming the port.
- Playwright browsers: CI installs them per job (`bunx playwright install --with-deps chromium` in the workflows), and nothing installs them locally. After `bun install` or any Playwright bump, run `bunx playwright install chromium firefox webkit` from `packages/base-ui`. `regressions` launches full Chromium (`~/.cache/ms-playwright/chromium-<rev>`), not only the headless shell; when that is missing it fails with "Executable doesn't exist" and the runner then throws `ENOENT` renaming `screenshots/chrome`.
- Open on one Linux workstation (2026-10-17): a scoped local `bun run test:solid:chromium <dirs>` (for example `src/select src/combobox`) stops after about 20 files and 12 s every time. One file fails to import (`Failed to fetch dynamically imported module …?import&browserv=<new stamp>`), the next fails with "Cannot connect to the iframe ... unknown due to CORS", and the rest never run, with no assertion failure. It does the same with `--no-file-parallelism` and `--maxWorkers 2` and at load 1 or 30. Ruled out: another process on 63315 (only the run's own listener), log writes under `.tmp/` (a control run without them fails the same), the two files around the break (they pass together), and source changes during the run (none outside dependency folders). The changed `browserv` stamp points at Vite's dependency optimizer invalidating modules mid-run, the open suspect. The Mac and CI's Linux runners pass the same trees, so the Mac (`remote-mac.mjs … --only chromium`) is the Chromium gate there.
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
| `docs-generate` | Generated files verification | `bun run docs:generate` + clean diff of `docs/solid` (Solid only: the docs are generated from `docs/react`) |
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

## Warning census

`vitest-fail-on-console` fails a test that logs, so a green suite shows no warnings, yet two kinds pass unseen: what `setupSolid.ts` drops (Solid's `[FLUSH_IN_EFFECT_CALLBACK]` about the harness's own flush after an event, which happens when an effect dispatches one, as a browser's parallel iframes do) and what tests assert (`toWarnDev`, `toErrorDev`, `vi.spyOn(console, …)`). The census (`packages/solid/test/warningCensus.ts`, plan 3 leaf 1.10) records every `console.warn` and `console.error` that reaches the console during a test, before any filter: suite, test, Solid code, first line, origin (the first stack frame outside dependencies: `library` under `src/`, `harness` under `test/` or testing-library, `test` in a test file, `dependency` otherwise) and whether the harness swallows it. Asserted messages are expected behavior and stay outside it: the assertion replaces the console method for its span.

    SOLID_WARNING_CENSUS=$PWD/.tmp/census.jsonl bun run test:solid:chromium --run   # or test:solid:jsdom
    node scripts/warning-census.mjs .tmp/census.jsonl [out.md]

Both environments record: jsdom appends with Node's `fs`, browser mode through the `appendWarningCensus` command in `packages/solid/vitest.config.mts` (the file path is substituted at transform time, since browser mode has no `process.env`). The report counts per suite by kind, origin and swallowed, and lists distinct messages by code or text.

The browser bench and the docs crawl hold their pages to the same rule (plan 3 leaves 1.9 and 1.11): every console warning and error a page logs fails the run unless a list names it with a reason, `test/perf-solid/known-warnings.json` for the bench (per variant, `shared/console.mjs`) and `scripts/docs/known-console.json` for the crawl (`scripts/docs/consoleCheck.mjs`, where a message about hydration fails at any level, listed or not). Both lists start empty; an entry is added only for a message that is intentional, never to make a run pass.

## Engine matrix

| engine | upstream CI | ours |
| --- | --- | --- |
| jsdom | JSDOM tests | JSDOM tests |
| Chromium | Browser tests (`test:chromium`); e2e and regressions | Browser tests; e2e; regressions (`VITEST_ENV: 'chromium'`) |
| Firefox, WebKit | not run | browser parity workflow, measured against upstream's results in the same browser |

Upstream mui/base-ui runs `test:jsdom` and `test:chromium` on CircleCI, and its e2e and regression jobs install only Chromium. Its `browserstack-force` pipeline parameter is still declared, but no job runs BrowserStack. E2E and regressions stay Chromium-only here too.

### Mac parity baseline

The Mac test machine (`remote-mac.mjs`) runs macOS 14.6 with Playwright's `webkit_mac14_arm64_special-2251` WebKit and `firefox-1532`. CI's browser parity runs on Linux, which is the parity authority for landing. On the Mac, the WebKit suite fails these 43 tests that upstream's passes. They fail the same way at `main` 4562ec2b: 73 failures in their files at both 4562ec2b and 64de52e9, the same tests. So they belong to that engine and not to a change. A Mac parity run is judged on the tests outside this set.

- `test/hydration/ssrFixtures.hydration`, in the string, stream and streamBoundaries renders (36):
  - `menu/filter-root/MenuFilterRoot.ssr-fixtures.tsx`: `relationships`, `submenu`.
  - `menu/root/MenuRoot.ssr-fixtures.tsx`: `filterableIndicators`, `filterProvider`, `plainTrigger`, `renderTrigger`, `submenuTrigger`, `wrapped`, `wrappedFilterProvider`.
  - `navigation-menu/content/NavigationMenuContent.ssr-fixtures.tsx`: `keepMounted`.
  - `popover/root/PopoverRoot.ssr-fixtures.tsx`: `plainTrigger`, `renderTrigger`.
- `combobox/root/ComboboxRoot`: dialog pattern, "clears the highlight when a keepMounted dialog closes", with `multiple=false` and `multiple=true` (`query=""`).
- `drawer/virtual-keyboard-provider/DrawerVirtualKeyboardProvider`: "compensates for keyboard overlap without adding extra spacing and centers the focused input", and "restores keyboard scroll slack when the drawer closes".
- `menu/filter-root/MenuFilterRoot.react17`: "omits partial ids during SSR and wires relationships after hydration", and "registers a submenu trigger after fallback ids resolve".
- `menu/filter-submenu-root/MenuFilterSubmenuRoot`: closing a filtered submenu from the keyboard, "does not wrap a filterable parent when closing from its first item (filterable submenu: true)".

Firefox on the Mac has no such set. `utils/popups/useTriggerFocusGuards`'s "uses the current tab order when an adjacent control is inserted during close" failed once in a full parity run at 64de52e9. It then passed alone 5 of 5 times at both 4562ec2b and 64de52e9, and in the full parity run at 26819b60.

## Root gates

`bun run verify` (`scripts/verify.ts`) runs `fmt:check`, `lint`, `typecheck`, `test`, `test:scripts`, `test:solid-table` on a clean tree and stamps HEAD; see `.claude/rules/standards.md`. For Base UI it covers only `tsc -b` of `packages/solid` (inside root `typecheck`) and the scripts tests (this context map among them). Root oxfmt and oxlint ignore `packages/base-ui/**`, and root `test` runs only Recharts. A Base UI change therefore also needs `bun run test:base-ui:all`, as the root `AGENTS.md` says.

Load events in a stamp, one strike each (2026-10-17): Recharts' `test/chart/AccessibilityLayer.spec.tsx` "When chart receives focus, show the tooltip for the first point" (accessibilityLayer=true, AreaChart horizontal) timed out at 5000 ms in a verify at load average 40 on 16 cores, from other sessions' gates. Alone the file passes 58/58; the test is synchronous, and its first instance costs 456 ms cold against 52–93 ms warm. The re-stamp passed. If it, or any Recharts test, times out in a verify again, fixing it is the only work: a warm-up render in the file's `beforeAll`, so the timed test never pays the cold start, with the timeout unchanged (raising it would hide real slowness).
