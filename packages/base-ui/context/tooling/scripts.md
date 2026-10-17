---
tags: [scripts, ci, inventory]
sources: [packages/base-ui/scripts, packages/base-ui/package.json, packages/base-ui/packages/solid/scripts, scripts, package.json, .github/workflows/base-ui-tests.yml, .github/workflows/base-ui-browser-parity.yml]
verified: 2026-10-17
---

# Scripts

Inventory of `packages/base-ui/scripts/`, `packages/base-ui/packages/solid/scripts/` and the root `scripts/`: what each does, what runs it, and whether it came from upstream, the port, or `~/Development/standards`.

## `packages/base-ui/scripts/`

| Path | Does | Wired by | Origin |
| :--- | :--- | :--- | :--- |
| `test-all.mjs` | Runs every suite of the Base UI tests, browser parity and typescript@next workflows (28 suites), logs to `.tmp/base-ui-test-all/`, prints pass/fail/not run. `--only`, `--list`. Suites that launch browsers or bind fixed ports run under an flock on the machine-wide gate lock (`GATES_LOCK`, default `~/.cache/gates/heavy.lock`, which flare's gates take too). | root `test:base-ui:all` | port |
| `serve-strict.mjs` | Serves `<dir>/build` with the SPA fallback on 127.0.0.1 and ::1 at one port; exits 1 naming the port when either is taken (replaces `serve`, which drifts to a random port). | the four fixed-port test servers (`test:e2e*:server`, `test:regressions*:server`) | port |
| `warning-census.mjs` | Turns a `SOLID_WARNING_CENSUS` JSONL into the per-suite warning census report: counts by kind, origin and swallowed, and the distinct messages ([suites](../testing/suites.md)). | manual | port |
| `bench-component.mjs` | One perf report per component: browser scenarios, SSR cases and cost tests; `--save-baseline`, `--compare` (baseline library from `git archive`, cached builds, the regression rule, D16). Run with Bun. | `bench:component` | port |
| `vitest-filter-guard.mjs` | A Vitest reporter in the root config: a filtered run fails when a file filter matched no test file, or a path filter matched fewer files than the test files under that path ("filter … matched N of M files"). Filters resolve from `packages/base-ui`, where `bun run` starts the scripts. | every filtered Vitest run | port |
| `remote-mac.mjs` | Runs a command at a local commit on the Mac test machine (`ssh mac`): ships `origin/main..<sha>` as a git bundle into `~/solidports-ci`, installs from the lockfile, runs under `~/.gates/heavy.flock` (the Mac gates' shared lock) with a hard timeout. The lock covers the checkout, install, command and result copy, since every run shares the one checkout, and each run has its own bundle, ref and result folder, so queued runs never move the tree under each other and `GATES_HEAVY=1` (heavy suites one at a time) unless the caller sets it, streams to `.tmp/grunt/remote-mac/`. Installs Python `flock`/`timeout` stand-ins in `~/.gates/bin` (macOS has neither), each written beside the installed one and renamed over it, since a run started together may be executing it. `--fetch` copies result files back. A run stops itself when the machine that started it goes away: the ssh session ends, or the driver stops refreshing its heartbeat file (every 20 s; the run stops after 90 s without one), since sshd can outlive a killed client. The watcher stops the run before it reports, so a report to a closed pipe cannot end it first. Verify stamps stay local. | by hand, for example `… <sha> -- bun run test:base-ui:all --only chromium` | port |
| `test-parity.mjs` | Compares upstream tests with Solid tests, file by file and title by title, over four tree pairs (`packages/react/src`, `packages/react/test`, `packages/utils/src`, `docs/react` → Solid counterparts); flags missing files and titles, `skipIf` skips where upstream runs, and any `.skip`/`.todo`/`.fails`. `--json <file>`. | CI "Generated files verification"; `test-all` | port |
| `browser-parity.mjs` | Compares upstream and Solid Vitest JSON reports for one browser; `--confirm <browser>` reruns Solid-only failures 10 times per suite (20 when undecided) and fails only on confirmed ones (Solid fails every rerun, one-sided Fisher exact p under 0.01), printing both counts and p for every one. | `base-ui-browser-parity.yml`; `test-all` `parity-firefox`/`parity-webkit` | port |
| `compare-regressions.mjs` | Pixel diff of React vs Solid regression screenshots; `REGRESSIONS_MAX_DIFF` (default 0.001); `accepted.json` entries need a reason. | `test/regressions-solid/run.mjs` (`test:regressions:solid`) | port |
| `inlineScripts.mts` | Minifies `*.template.js` in `packages/react/src` and `packages/solid/src` into `*.min.ts`. | `inline-scripts`; CI checks the tree stays clean | upstream, extended to Solid |
| `changelog.config.mjs` | `@mui/internal-code-infra` changelog config (PR labels, `@author`). | nothing in this repo's release flow | upstream |
| `eslint/testRules.mjs`, `testRules.test.mjs` | Six `base-ui-test/*` rules and their RuleTester cases. | both ESLint configs; `test:lint-rules` | upstream |
| `stylelint/no-unknown-demo-colors.mjs` | Stylelint rule for demo CSS colors; its test lives in `docs/solid/scripts/stylelint/`. | `stylelint.config.mjs` | upstream |
| `tsconfig.json` | Typechecks `scripts/**` and the Base UI root config files. | editor only | upstream |
| `README.md` | Pointers to this context. | none | port |
| `docs/sync-docs-react.mjs` | Snapshot `docs/react` and `docs/docs-infra`. | `docs:sync` | port |
| `docs/generate.mjs` | Writes `docs/solid`. | `docs:generate` | port |
| `docs/react-to-solid.mjs` + `.test.mjs` | React → Solid source transform (Babel AST with scope analysis). | imported by `generate.mjs`; tests in `@solidports/docs` | port |
| `docs/excluded.mjs` | Excluded folders and sections, each with a reason. | `generate.mjs`, `check-hydration.mjs` | port |
| `docs/check-hydration.mjs` | Crawls the docs build in Chromium. | `docs:check-hydration`; CI "Validating Docs" | port |
| `docs/templates/` | Framework shell, Next/React adapters, hand-written docs-infra runtime, Vitest configs. | copied by `generate.mjs` | port |
| `docs/README.md` | Pipeline reference. | none | port |

Details of the docs scripts: [docs pipeline](docs-pipeline.md). Upstream's `api-docs-builder` is not in this tree; docs-infra's `validate` writes the API tables.

## `packages/base-ui/packages/solid/scripts/`

| Script | Does | Wired by |
| :--- | :--- | :--- |
| `addDeclarationExtensions.mjs` | Adds explicit extensions to relative specifiers in `types/*.d.ts` so `node16`/`nodenext` consumers resolve them. | `types` (and so `prepack`) |
| `validateBuiltTypes.mjs` | Port of upstream's `code-infra validate-built-types`: every import in `types/` resolves inside `types/` or names a peer dependency. | `test:built-types` |

## Root `scripts/`

| Script | Does | Wired by | Owner |
| :--- | :--- | :--- | :--- |
| `packages.ts` | Published packages: dir, id, npm name, tag prefix. | `release-target.ts` | repo |
| `release-target.ts` + `.test.ts` | Resolves a release tag to GitHub Actions outputs; checks the version. | `release.yml` | repo |
| `context-map.ts` + `.test.ts` | Writes each `packages/**/context/INDEX.md`; `--check` validates frontmatter, sources and links. | `test:scripts` (the test runs the check) | repo |
| `verify.ts` | Runs every gate, stamps HEAD. | `verify` | standards ("Managed by" header) |
| `pre-push.ts` | Refuses pushed commits without a verify stamp. | `lefthook.base.yml` pre-push | standards |
| `standards-check.ts` | Drift check against `~/Development/standards/sync.ts`; skips when absent. | `lefthook.base.yml` pre-push | standards |
| `pinned-bun-test.ts` + `.test.ts` | Runs `bun test ./scripts` under the Bun `packageManager` pins (`bunx bun@<pin>`, the version CI installs) when the local Bun is another version; does nothing when they match. | `lefthook.yml` pre-push | repo |

| `perf-noise-model.ts` | A seeded clock with the Mac bench's noise (GC pauses, stalls, first-run outliers) for the perf rule's tests (D16). | `base-ui-perf-*.test.ts` | port |

Two root tests guard `packages/base-ui/scripts` beyond its unit tests. `base-ui-scripts-lint.test.ts` runs oxlint with `no-shadow` and `no-use-before-define` (hoisted functions allowed) over the tooling scripts and `test/perf-solid`, which no other linter covers: root oxlint ignores `packages/base-ui`, and Base UI's ESLint covers the library and the docs app. The docs generator under `scripts/docs` is outside it (eight hits there). `base-ui-bench-component-main.test.ts` drives `bench:component`'s `main` end to end with canned runner output (builds, browser and SSR runs, the cost run) through compare, judging and the report.

`test:scripts` (`bun test ./scripts`) runs the root tests and is a verify gate. Root `lint` lints only `scripts/`. Release flow: [release](release.md); gates: [standards](standards.md).

## `package.json` wiring

- Root: `test:base-ui` (jsdom only), `test:base-ui:all`, `docs:bootstrap`, `docs:sync`, `docs:generate`, `docs:dev`, `docs:react:dev`, `verify`, `test:scripts`.
- `packages/base-ui`: the `test:solid:*`, `test:e2e:solid`, `test:regressions:solid*`, `test:screen-reader:solid`, `bench:solid*` and `docs:*` scripts are port-owned. The `test:*` scripts without `solid` run upstream's React suite (used by browser parity).

## Port gaps

- Naming mix: upstream camelCase (`inlineScripts.mts`, `testRules.mjs`) next to port kebab-case (`test-parity.mjs`, `browser-parity.mjs`); the Solid package's scripts are camelCase.
- Upstream scripts still unused or wrong here: `release:*` (lerna, `code-infra publish`), `prettier` (`pretty-quick --branch master`; this repo uses `main`), `markdownlint` (not in CI, and its config fails to load: `@mui/internal-code-infra` exports no `./markdownlint`). The `inlineScripts.mts` preamble still says `pnpm inline-scripts`.
- `packages/base-ui/package.json` keeps upstream's name `@base-ui/monorepo` and version `1.2.0`.
- The root workspace glob `packages/base-ui/scripts/*` matches no package.
- Hand-written runtime code (`docs/templates/src/adapters/react.ts`, `templates/docs-infra/src`) lives under `scripts/`.
- `scripts/` and `test/*-solid` are outside every CI lint step ([lint and format](lint-and-format.md)).
