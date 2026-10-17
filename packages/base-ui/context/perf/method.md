---
tags: [perf, benchmark, ssr, cost]
sources: [packages/base-ui/test/perf-solid/run.mjs, packages/base-ui/test/perf-solid/ssr/sample.mjs, packages/base-ui/test/perf-solid/shared/manifest.ts, packages/base-ui/test/perf-solid/shared/step.ts, packages/base-ui/test/perf-solid/shared/filter.mjs, packages/base-ui/test/perf-solid/shared/regression.mjs, packages/base-ui/test/perf-solid/shared/report.mjs, packages/base-ui/scripts/bench-component.mjs, packages/base-ui/test/perf-solid/ssr/cases.ts, scripts/base-ui-perf-manifest.test.ts, scripts/base-ui-perf-filter.test.ts, scripts/base-ui-perf-regression.test.ts, scripts/base-ui-perf-report.test.ts, scripts/base-ui-bench-component.test.ts, scripts/base-ui-perf-step.test.ts, packages/base-ui/test/perf-solid/shared/harness.ts, packages/base-ui/test/perf-solid/shared/scenarios, packages/base-ui/test/perf-solid/known-differences.json, packages/base-ui/test/perf-solid/ssr/run.mjs, packages/base-ui/test/perf-solid/profile.mjs, packages/base-ui/packages/solid/src/utils/popups/closedRoot.cost.test.tsx, packages/base-ui/packages/solid/src/utils/useRenderElement.cost.test.tsx]
verified: 2026-10-17
---

# Perf method

Three instruments: the Chromium benchmark (React vs Solid production builds, in CI with no thresholds), the local-only SSR bench, and `*.cost.test.tsx` reactive-node budgets counted in dev mode.

## Scenario manifest

Every scenario declares `components` (primary first; the id prefix names it, except `static/` and `composition/`) and `tags`, both from closed unions in `shared/manifest.ts`, so a typo fails typecheck.

- `COMPONENTS` must equal the `packages/solid/package.json` export subpaths minus `NON_COMPONENT_EXPORTS`, each listed with a reason (the barrel, `merge-props`, `types`, `utils`, `internals/*`).
- Tags are the coverage axes of the per-component matrix: one `scale-*` bucket (up to 30, 31 to 600, above 600), `controlled`/`uncontrolled`, `static-props`/`reactive-props`, `wrapper`, `render-fn`/`render-element`, `open`/`close`/`toggle-all`, `keyboard`/`pointer`/`typing`, `animated`, `portal`, `nested`, `raw` (the hand-written floor), `ssr`/`hydrate`.
- Every component needs a non-`raw` scenario or a `PENDING_COVERAGE` entry naming the leaf that adds it; a pending entry for a covered component fails.
- `bun run test:scripts` runs `scripts/base-ui-perf-manifest.test.ts`, which imports each scenario file in Bun and typechecks `test/perf-solid/tsconfig.json`.

## Planned instruments (plan 3, phase 1)

The spec for the tooling phase 1 builds. Each item moves into the sections below when it lands.

- Engines: `ENGINE=chromium|firefox|webkit` in `run.mjs`. Outside Chromium only `sync` and `paint` exist (`performance.now`), and the CDP columns are marked absent. `--remote mac` serves the builds on 0.0.0.0 and drives real Safari over `ssh mac`. Chromium gates every iteration; the other engines run at family milestones. Never mix machines in one ratio.
- Floor: a hand-written Solid `floor/` app per pilot component runs as a third `VARIANTS` entry, so every report shows React, the port and the floor.
- Warning census: the dev bench build (`BENCH_DEV=1`) records every `console.warn`, `console.error` and `pageerror` per scenario, and fails on any entry missing from `known-warnings.json` (each entry with a reason). The unit setup reports warnings per suite, including the `FLUSH_IN_EFFECT_CALLBACK` hits that `setupSolid.ts` swallows, split into library and harness frames. The docs hydration crawl collects console output the same way. Counts live in the Warnings section of [baseline](baseline.md) and may only go down.

## Chromium benchmark (`test/perf-solid`)

Identical scenarios mounted by `@base-ui/react` (`react/`) and `@solidports/base-ui` (`solid/`) apps, both built in production mode. CI job "Benchmark tests" runs it on every push.

```bash
# from packages/base-ui
bun run bench:solid:build              # both production builds
bun run bench:solid                    # 8 measured runs, every scenario
node test/perf-solid/run.mjs 8 select,menu   # scenario id prefixes
node test/perf-solid/run.mjs 8 component:collapsible,!tag:raw
```

- Filter (`shared/filter.mjs`, the same for `run.mjs` and `ssr/run.mjs`): comma-separated terms, each an id prefix, `component:<name>` or `tag:<tag>`. Positive terms are OR'd; `!` excludes; exclusions alone start from everything.
  - `component:X` matches every entry that lists X, wherever X appears, so `component:toggle` also selects `composition/direction-500`. An id prefix selects by the primary component, the one the id names.
  - Every value is checked: an unknown term kind, a `component:` outside `COMPONENTS`, a `tag:` outside `SCENARIO_TAGS`, or an id prefix that no id starts with exits 1 with the closest valid value. Exclusions are checked too, so `!tag:rwa` fails instead of silently keeping the raw floors. The runners read the vocabularies from the bundles (`window.bench.vocab`, the SSR server bundles' `vocab`). A filter that matches nothing also exits 1.

- Scenarios: `shared/scenarios/*.ts`, one file per component (32 files plus `index.ts`), 77 scenarios and 387 steps in CI. Each `Scenario` has `id`, `fixture`, `components`, `tags`, `steps`, optional `verifyMount`; `mount` and `unmount` steps are added and timed automatically (`shared/harness.ts`).
- Env: `VARIANTS=name:lib:dir,...` (A/B of several builds), `THROTTLE=4` (CPU throttling), `SIZE=large` (5x fixture sizes), `WARMUP` (default 2). Build env: `SOLID_SRC=<abs path>` builds the Solid app from a copy of the source, `OUT=<dir>`, `MINIFY=0`, `BENCH_DEV=1` (dev runtime).
- Builds and results go to gitignored folders named in `vite.config.mjs` and `run.mjs`.

### How a run works

- Each scenario opens a fresh page per variant. Order: two rounds of react, solid (interleaved), each with `WARMUP` unmeasured then `RUNS` measured cycles of mount, steps, unmount. Medians therefore cover `2 × RUNS` samples; the JSON also keeps p90.
- Per step: CDP `Performance.getMetrics` before and after, then `window.bench.step` runs the action and `lib.flush()`, in a task of its own (`shared/measure.mjs`): CDP `ScriptDuration` leaves out script run inside a DevTools `Runtime.evaluate`, which is how `page.evaluate` runs a function, so a synchronous step read no script at all while a library that defers work to later tasks read all of it. Both benches check the metric at startup (a 10 ms synchronous burn must read at least 9 ms, or the run exits 1); `scripts/base-ui-perf-measure.test.ts` holds the positive control in Chromium. `script` numbers from before 2026-10-17 left out every step's synchronous work.

| column | meaning |
| --- | --- |
| `sync` | step start through the action and `flush()` |
| `paint` | `sync` plus `nextPaint()` (one `requestAnimationFrame` then `setTimeout(0)`) |
| `script` | change in CDP `ScriptDuration`, ms (the step runs in its own task, so its synchronous work counts) |
| layout, style | change in `LayoutDuration`, `RecalcStyleDuration` (JSON only) |
| heap after mount KB | `usedJSHeapSize` after the mount step minus before it, both after `gc()` (`--expose-gc`) |
| settled | steps with `until` only: ms from step start until `until` first held, minus the step's `timerMs` |

- Settle steps (mount, unmount, and any step with `settle`) wait two more frames before `verify`.
- A step whose end state arrives on the library's own timer declares `until` and `timerMs` (the manifest test requires both or neither). The hover-leave steps of Popover, PreviewCard and Tooltip use them, because safePolygon closes on a 40 ms timer when the pointer leaves inside its polygon (`floating-ui-solid/safePolygon.ts`); a fixed frame count lands on either side of that timer depending on load, so the summaries flipped between React and Solid from run to run. Never paper over such a race with a `known-differences.json` entry.
  - Before the action, the runner attaches a MutationObserver to `document` for that step only, and records the time inside the first mutation batch where `until` holds. After settling it polls `until` once per frame as the fallback for state no mutation reports, and fails the step after `UNTIL_TIMEOUT_MS` (2 s). An `until` that already holds before the action is an error, since it would measure nothing.
  - `settled` is that time minus `timerMs`, so a slow close render shows up instead of hiding behind the timer; `sync` and `paint` never include it, and CDP `script` covers the whole step. The observer's cost lands on those three steps only, and equally on every variant.
  - The step runner lives in `shared/step.ts`; `scripts/base-ui-perf-step.test.ts` covers it.
- Ratios are each variant's median over the first variant's (`solid/react` by default; `base/react` and `cur/react` in a compare). `shared/report.mjs` builds the summary, which keeps every variant's raw `sync`, `script`, `settled` and heap samples for the regression rule. `RESULTS_FILE=<path without extension>` names the output; otherwise it lands in the results folder. CI prints the table to the job log.

### Correctness gate, not a speed gate

- `verify` summaries (mount: `document.body` element count plus `verifyMount`; unmount: root child count) must match across variants. `known-differences.json` lists 16 intentional deltas (inert trailing focus guards, kept-mounted combobox dismiss buttons), each with a `nodesDelta` or ignored `fields` and a reason.
- Exit 1 only on a step error or an unlisted summary mismatch. There are no thresholds and no stored baseline: a slower build passes CI. Track numbers in [baseline](baseline.md).

### Reading numbers

- Compare ratios from one session, never absolute ms across sessions (the README notes up to 2x drift). Between CI runs 38559281856 and 38882393542 the unchanged React side moved 20–30% on many steps.
- Small or negative heap values (closed popups, combobox) are GC noise; read heap only where both sides exceed about 100 KB.
- CPU and allocation profile of one scenario: `node test/perf-solid/profile.mjs <lib> <scenario> [dir] [setup] [measured]` (self time per function plus sampled heap).

## SSR bench (`test/perf-solid/ssr/run.mjs`)

`bun run bench:solid:ssr [runs=20] [filter,...]` from `packages/base-ui`, with the same filter as the Chromium benchmark. Not in CI. Node runs it with `--expose-gc`: each server sample is the mean of a batch of renders sized to about 250 ms from the warmup (the same count for every variant), the heap is collected before each batch outside the timed span, and variants alternate run by run (`ssr/sample.mjs`; `scripts/base-ui-perf-ssr-sampling.test.ts`). `SSR_REPEAT=name:N` renders one variant's case N times per render, a known slowdown for checking the instrument.

- Builds a server bundle per variant (`vite build --ssr`; framework packages external so Node loads their server builds) and a hydratable client bundle. `SSR_VARIANTS=name:lib[:solidSrc[:outDir]],...` (default `react:react,solid:solid`) lets a Solid variant build from another copy of the library source. `NO_BUILD=1` reuses every build, `NO_BUILD=a,b` some; `BUILD_ONLY=1` builds and exits; `SERVER_ONLY=1` skips Chromium; `RESULTS_FILE` names the output.
- Cases (`ssr/cases.ts`): accordion/300, checkbox/1000, collapsible/300, collapsible/300-floor (Solid's hand-written floor, `packages/solid/test/floor`, against React's parts), dialog/page, form/50, select/1000, tabs/200, and the static family's progress/1000 (Progress and Meter), input/1000 (Input and Separator) and avatar/1000, which reuse the browser bench's static fixtures, each with `components` and `tags` (always `ssr` and `hydrate`) from the scenario manifest. Each library registers them in `ssr/<lib>/fixtures/<component>.tsx`, one file per primary component, collected by `fixtures/index.ts`. The server bundles export the case list, and the runner exits 1 when either library registers a different id set. The manifest test checks the cases and the per-file registrations.
- Server ms: median of `render(key)` in Node after 3 warmups, variants alternating run by run. HTML bytes are reported. Hydration pages alternate the same way.
- Hydration: a fresh Chromium page per run. Hydrate ms runs from the hydrate call to the commit: React's root layout effect (`hydrateRoot` is concurrent and returns after scheduling), Solid's `hydrate` plus `flush` (synchronous). Then two frames settle; script ms is the `ScriptDuration` change. Then the page's first expanded trigger (`aria-expanded="true"`) is clicked and two frames settle again: first close ms is that span and close script ms its `ScriptDuration` change, so work a part defers past hydration (D11) is counted where it lands. The ratio column adds hydrate and close script ms. Solid's hydrate script ms reads far below its hydrate ms (at D11, collapsible/300-open 2.41 against 22.2 ms, and the floor 0.10 against 11.9 ms), as an earlier version of this page noted (at d2164d9d: compare hydration only Solid-to-Solid). The cause: CDP `ScriptDuration` leaves out script run inside a DevTools `Runtime.evaluate`, and Solid's synchronous hydrate ran inside the bench's `page.evaluate`, while React's work runs in later tasks and counts. A probe of 50 forced layouts in an evaluate reads `ScriptDuration` 0 and `TaskDuration` 6.7 ms. The hydrate now runs in a task of its own, as the browser bench's steps do, so its script counts. A second table gives CDP `TaskDuration` (which does count it), `LayoutDuration`, `RecalcStyleDuration`, `LayoutCount` and `RecalcStyleCount` medians in two steps, read between them: up to the commit (a layout there was forced by script) and over the two settled frames. At D11 every variant reads zero layouts and recalculations in both steps: hydrating unchanged server markup lays nothing out, so the port's extra hydrate time over the floor is script, not forced layout. The JSON keeps the sync time (`hydrateSyncMs`, React's scheduling only) for the Solid-to-Solid regression rule.
- Exit 1 on a hydration mismatch log or differing hydrated DOM summaries.

## Component runs and baselines (`scripts/bench-component.mjs`)

`bun run bench:component <name>[,...]|all [--runs 12] [--ssr-runs 20] [--filter terms] [--save-baseline label | --compare label]` from `packages/base-ui` (Bun, which imports the TypeScript manifests).

- Validates names against `COMPONENTS`, builds once, then runs the browser scenarios that list a component (`component:` terms plus `--filter`, browser only), the SSR cases that list it (skipped with a line when none does), and exactly the cost tests `COST_TESTS` assigns it, through `vitest -t` with anchored names; every expected cost test must run and pass. A component with neither a cost test nor a `PENDING_COST` entry fails the run. Cost tests run on the working tree only, since budgets are absolute.
- Writes `component-<names>-<stamp>.{md,json}` (plus `-browser`, `-ssr`, `-cost` part files) to the results folder. The JSON records the working tree's provenance: SHA, dirty flag, and when dirty the sha256 of `git diff HEAD` plus every untracked file, with the untracked paths, so two dirty runs can be told apart. Exit 1 on any failed part, problem or regression.
- `--save-baseline <label>` refuses a dirty tree (a baseline is a commit) and a run with correctness failures, then writes `baselines/<label>.json`: SHA, build hash, and the full browser and SSR results.
- `--save-baseline <label> --at <sha>` measures commit `<sha>`'s library with today's harness instead of the working tree's (built as `--compare` builds a baseline) and skips the working tree's cost tests. A baseline records exit-bar misses as targets; only correctness failures (hydration mismatches, DOM summaries, cost tests) block it. b0 is taken at d2164d9d, the last commit before the pilot, and b1 at 4562ec2b.
- `--compare <label>` runs React, `base` (the baseline commit's library) and `cur` (the working tree) interleaved in one session, in the browser and in SSR, and judges `cur` against `base` with the rule below. The baseline library comes from `git archive <sha> packages/base-ui/packages/solid/src`, extracted under `.tmp/grunt/bench-src/` and deleted right after the build. That is exactly the commit's content, and it resolves dependencies from the main `node_modules`, so there is one reactive core (`@solidjs/signals` is deduped too). Builds are cached by `<sha>-<hash of test/perf-solid and bun.lock>`; each carries a `.build-hash` checked on reuse. When `bun.lock` differs between the baseline commit and the working tree, the headline says "baseline built with working-tree dependencies" and the JSON sets `base.depsFromWorkingTree`, because a dependency change would otherwise read as no difference.
- A dirty working tree is allowed for `--compare` (iteration happens on uncommitted code) and is flagged in the headline and the JSON.

### Regression rule (`shared/regression.mjs`)

Per step and metric, from one interleaved session (D16): `cur` regresses when a one-sided Mann–Whitney U test on the two sample sets gives p < `ALPHA` (0.01) and the bootstrap 95% interval of the median shift lies wholly above the minimum effect, the larger of the metric's absolute floor and `MIN_RELATIVE` (3%) of the base median; the mirror case is an improvement. Ranks are not moved by the one slow sample per side that a collection pause or the first measured run leaves, which the old tolerance (the summed p90 spreads, the maximum at ten samples) let decide: a halving of progress/1000's server time read "same". Requiring the interval, not the point estimate, to clear the minimum keeps a true shift of about 3% from flagging on noise. The report lists the shift, its interval, the minimum effect and p. A `--compare` run judges all its comparisons together (`judgeAll`): the two-sided Mann–Whitney p values of the judged pairs, browser and SSR, go through Benjamini–Hochberg at `FDR_Q` (0.05), so hundreds of step × metric pairs keep the expected share of false "regressed" lines at 5% of the flagged ones; a pair at or below the resulting threshold is then decided by the margin. The summary states how many pairs were judged and the threshold. Power needs samples: `--runs 12` (24 a side, the default) flagged all of five 2x regressions among 400 pairs on the simulated clock, where 16 a side missed 14 in 100. The cost is wall time: the browser part of a run takes about 1.5x its old `--runs 8` time, and each SSR case about 20 × (variants) × 250 ms of server sampling plus its hydration runs, so a three-variant case adds about 15 s. Decisions use samples, not ratios: React is shared within the session, so the ratio form is the same test.

| metric | floor | note |
| --- | --- | --- |
| `sync`, `script`, `settled`, SSR `serverMs` and `hydrateSyncMs` | 0.1 ms | `performance.now` is coarsened to 100 µs without cross-origin isolation |
| heap after mount | 0 | judged only when both medians exceed 100 KB |

Below `MIN_SAMPLES` (10) on either side the verdict is `insufficient`, never a pass or a fail. Use `--runs 5` or more (two rounds give 10 samples). Raw floor scenarios (tag `raw`) never use the library, so their base/cur difference is session noise; they are reported as `unjudged (raw floor)`. `paint` (frame-aligned) and layout/style (noise at these sizes) are reported, not gated. Hydration is judged only `base` against `cur`, never against React. `scripts/base-ui-perf-regression.test.ts` and `scripts/base-ui-perf-report.test.ts` cover the rule and the summary, the first also on a simulated clock calibrated to the Mac's samples (`scripts/perf-noise-model.ts`: about one sample in ten 50–60 ms slow, first-run outliers): a 2x shift decides for at least 19 of 20 seeds, a 1.03x shift and an A/A run read "same".

### Exit bar (`exitBar` in `shared/regression.mjs`)

Plan 3's bar, judged on production builds: every SSR case with a `<id>-floor` twin (the same case written as the Solid floor) needs the port within `EXIT_BAR` (1.25x) of the floor and below React, on medians of `serverMs` and `hydrateCommitMs`. `bench:component` reports the three ratios per metric (port vs React, floor vs React, port vs floor) and adds a failure for every miss. Dev-mode unit tests keep only deterministic guards (hydration keys, node counts), never timings.

## Reactive-node cost tests

Counting technique (all five files): set `DEV.hooks.onOwner` to count every non-null owner (owners and computations), render, `flush()`, unset, unmount. `perPart` renders two copies minus one copy, so the parent's insert is counted once; native tests also subtract a plain element. Counts are dev-mode: the dev runtime wraps each component in one root that production does not create.

| file | budgets |
| --- | --- |
| `src/utils/popups/closedRoot.cost.test.tsx` | per closed root: Tooltip 83, Menu 142, ContextMenu 103, Popover 94, PreviewCard 83, Dialog 73, AlertDialog 73, Drawer 101, Select 123, Combobox 149, NavigationMenu 230 |
| `src/utils/useRenderElement.cost.test.tsx` | Button 3, Checkbox.Root 10, Select.Item 27; static attributes 0 |
| `src/utils/native/native.cost.test.tsx` | native Button 1 beyond a plain button (3 with reactive props and children); static attributes and handlers 0; extra reactive inputs share one effect |
| `src/utils/native/toggles.cost.test.tsx` | beyond hand-written markup: Checkbox+Indicator 19, Switch+Thumb 10, Toggle 5, grouped Toggle 5, Radio+Indicator 18 |
| `src/utils/native/disclosure.cost.test.tsx` | Collapsible closed 12, open 18; closed Accordion item 14; Tab plus hidden Panel 4 |

`shared/manifest.ts` maps each component to its cost tests by full name (`COST_TESTS`); components without one name the leaf that adds it (`PENDING_COST`), render-core guards are listed in `GENERIC_COST_TESTS`, and the manifest test checks every name against `vitest list` and fails on an unclaimed cost test. No cost test covers Avatar, Input, the Progress and Meter Roots or `useRender`, the slowest mount scenarios in [baseline](baseline.md) after the static parts (`utils/native/static.cost.test.tsx`). No bench scenario covers Fieldset, FilterDropdown or `unstable-use-media-query`.

### Probing a count

1. Copy the `nodes()` and `perPart()` helpers from a cost test into a temporary `*.test.tsx` under `packages/solid/src`.
2. Render the shape to measure (direct, wrapped in a `{...props}` component, open or closed) and log the count.
3. `bun run test:solid:jsdom <file> --no-watch`, then delete the file.

A new budget belongs in a cost test with a failing case first (see [parity](../testing/parity.md) for the test policy).

Related: [baseline](baseline.md), [optimization map](optimization-map.md), [primitive costs](../solid/primitive-costs.md).
