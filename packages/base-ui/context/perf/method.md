---
tags: [perf, benchmark, ssr, cost]
sources: [packages/base-ui/test/perf-solid/run.mjs, packages/base-ui/test/perf-solid/shared/manifest.ts, packages/base-ui/test/perf-solid/shared/step.ts, packages/base-ui/test/perf-solid/shared/filter.mjs, packages/base-ui/test/perf-solid/ssr/cases.ts, scripts/base-ui-perf-manifest.test.ts, scripts/base-ui-perf-filter.test.ts, scripts/base-ui-perf-step.test.ts, packages/base-ui/test/perf-solid/shared/harness.ts, packages/base-ui/test/perf-solid/shared/scenarios, packages/base-ui/test/perf-solid/known-differences.json, packages/base-ui/test/perf-solid/ssr/run.mjs, packages/base-ui/test/perf-solid/profile.mjs, packages/base-ui/packages/solid/src/utils/popups/closedRoot.cost.test.tsx, packages/base-ui/packages/solid/src/utils/useRenderElement.cost.test.tsx]
verified: 2026-10-16
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

- Component-scoped run: `bun run bench:component <name>[,...]` builds once, then runs the scenarios whose `components` include a name, that component's SSR cases (through the shared filter) and its cost tests. It writes one report (md plus json) to the gitignored results folder.
- Baseline and compare: `--save-baseline <label>` stores the SHA, the build hash and the results. `--compare <label>` builds the baseline SHA from a worktree copy through `SOLID_SRC` and runs it interleaved with the working tree and React in one session. A step regresses when its ratio is worse than the baseline's by more than the p90 spread of both sides.
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
- Per step: CDP `Performance.getMetrics` before and after, then `window.bench.step` runs the action and `lib.flush()`.

| column | meaning |
| --- | --- |
| `sync` | step start through the action and `flush()` |
| `paint` | `sync` plus `nextPaint()` (one `requestAnimationFrame` then `setTimeout(0)`) |
| `script` | change in CDP `ScriptDuration`, ms |
| layout, style | change in `LayoutDuration`, `RecalcStyleDuration` (JSON only) |
| heap after mount KB | `usedJSHeapSize` after the mount step minus before it, both after `gc()` (`--expose-gc`) |

- Settle steps (mount, unmount, and any step with `settle`) wait two more frames before `verify`.
- A step whose end state arrives on the library's own timer declares `until`: after settling, the harness polls it once per frame, untimed, and fails the step after `UNTIL_TIMEOUT_MS` (2 s). The hover-leave steps of Popover, PreviewCard and Tooltip use it, because safePolygon closes on a 40 ms timer when the pointer leaves inside its polygon (`floating-ui-solid/safePolygon.ts`). A fixed frame count lands on either side of that timer depending on load, so the summaries flipped between React and Solid from run to run. Never paper over such a race with a `known-differences.json` entry. The step runner lives in `shared/step.ts`; `scripts/base-ui-perf-step.test.ts` covers it.
- Ratios are `solid/react` of the medians. The report table and JSON land in the results folder; CI prints the table to the job log.

### Correctness gate, not a speed gate

- `verify` summaries (mount: `document.body` element count plus `verifyMount`; unmount: root child count) must match across variants. `known-differences.json` lists 16 intentional deltas (inert trailing focus guards, kept-mounted combobox dismiss buttons), each with a `nodesDelta` or ignored `fields` and a reason.
- Exit 1 only on a step error or an unlisted summary mismatch. There are no thresholds and no stored baseline: a slower build passes CI. Track numbers in [baseline](baseline.md).

### Reading numbers

- Compare ratios from one session, never absolute ms across sessions (the README notes up to 2x drift). Between CI runs 38559281856 and 38882393542 the unchanged React side moved 20–30% on many steps.
- Small or negative heap values (closed popups, combobox) are GC noise; read heap only where both sides exceed about 100 KB.
- CPU and allocation profile of one scenario: `node test/perf-solid/profile.mjs <lib> <scenario> [dir] [setup] [measured]` (self time per function plus sampled heap).

## SSR bench (`test/perf-solid/ssr/run.mjs`)

`bun run bench:solid:ssr [runs=20] [filter,...]` from `packages/base-ui`, with the same filter as the Chromium benchmark. Not in CI.

- Builds a server bundle per library (`vite build --ssr`; framework packages external so Node loads their server builds) and a hydratable client bundle. `NO_BUILD=1` reuses builds; `SERVER_ONLY=1` skips Chromium.
- Cases (`ssr/cases.ts`): accordion/300, checkbox/1000, dialog/page, form/50, select/1000, tabs/200, each with `components` and `tags` (always `ssr` and `hydrate`) from the scenario manifest. Each library registers them in `ssr/<lib>/fixtures/<component>.tsx`, one file per primary component, collected by `fixtures/index.ts`. The server bundles export the case list, and the runner exits 1 when either library registers a different id set. The manifest test checks the cases and the per-file registrations.
- Server ms: median of `render(key)` in Node after 3 warmups. HTML bytes are reported.
- Hydration: a fresh Chromium page per run; `__hydrate` returns its synchronous time, then two frames settle; script ms is the `ScriptDuration` change.
- React's `hydrateRoot` schedules its work, so React's sync column (about 0.9 ms) excludes most of it. Solid hydrates synchronously and its script column reads lower than its sync column, so cross-library hydration numbers are not settled; compare server ms, and compare hydration only Solid-to-Solid.
- Exit 1 on a hydration mismatch log or differing hydrated DOM summaries.

## Reactive-node cost tests

Counting technique (all five files): set `DEV.hooks.onOwner` to count every non-null owner (owners and computations), render, `flush()`, unset, unmount. `perPart` renders two copies minus one copy, so the parent's insert is counted once; native tests also subtract a plain element. Counts are dev-mode: the dev runtime wraps each component in one root that production does not create.

| file | budgets |
| --- | --- |
| `src/utils/popups/closedRoot.cost.test.tsx` | per closed root: Tooltip 83, Menu 142, ContextMenu 103, Popover 94, PreviewCard 83, Dialog 73, AlertDialog 73, Drawer 101, Select 123, Combobox 149, NavigationMenu 230 |
| `src/utils/useRenderElement.cost.test.tsx` | Button 3, Checkbox.Root 10, Select.Item 27; static attributes 0 |
| `src/utils/native/native.cost.test.tsx` | native Button 1 beyond a plain button (3 with reactive props and children); static attributes and handlers 0; extra reactive inputs share one effect |
| `src/utils/native/toggles.cost.test.tsx` | beyond hand-written markup: Checkbox+Indicator 19, Switch+Thumb 10, Toggle 5, grouped Toggle 5, Radio+Indicator 18 |
| `src/utils/native/disclosure.cost.test.tsx` | Collapsible closed 12, open 18; closed Accordion item 14; Tab plus hidden Panel 4 |

No cost test covers Progress, Meter, Avatar, Separator or `useRender`, the slowest mount scenarios in [baseline](baseline.md). No bench scenario covers Fieldset, FilterDropdown or `unstable-use-media-query`.

### Probing a count

1. Copy the `nodes()` and `perPart()` helpers from a cost test into a temporary `*.test.tsx` under `packages/solid/src`.
2. Render the shape to measure (direct, wrapped in a `{...props}` component, open or closed) and log the count.
3. `bun run test:solid:jsdom <file> --no-watch`, then delete the file.

A new budget belongs in a cost test with a failing case first (see [parity](../testing/parity.md) for the test policy).

Related: [baseline](baseline.md), [optimization map](optimization-map.md), [primitive costs](../solid/primitive-costs.md).
