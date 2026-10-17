---
tags: [testing, parity, upstream, tdd]
sources: [packages/base-ui/scripts/test-parity.mjs, packages/base-ui/scripts/browser-parity.mjs, packages/base-ui/scripts/compare-regressions.mjs, packages/base-ui/test/regressions-solid/run.mjs, packages/base-ui/test/regressions-solid/accepted.json, packages/base-ui/packages/solid/test/parityHarness.tsx, .rulesync/reference/tdd.md]
verified: 2026-10-17
---

# Test parity

Three scripts hold the Solid suite to upstream's: `test-parity.mjs` matches every upstream test by title, `browser-parity.mjs` fails on Solid-only browser failures, and `compare-regressions.mjs` diffs screenshots.

## `scripts/test-parity.mjs` (CI: Generated files verification)

Static check, no tests run. Exits 1 on any finding in the first five counters below.

- Tree mapping (`TREES`): `packages/react/src` to `packages/solid/src` (with `floating-ui-react/` renamed to `floating-ui-solid/`), `packages/react/test` to `packages/solid/test`, `packages/utils/src` to `packages/solid/src/utils`, `docs/react` to `docs/solid`. Same relative path; the extension may change between `.ts` and `.tsx`.
- Extraction: comments are blanked, then a regex finds `it`/`test`/`describe` with modifiers (`.skip`, `.todo`, `.fails`, `.only`, `.each`/`.for`, `skipIf`/`runIf`). `runIf(x)` becomes `!(x)`; a body starting `if (cond) { skip(); }` counts as `skipIf(cond)`; a title with no body is a todo.
- Title matching: exact string, after `TITLE_ALIASES` (`@base-ui/react` to `@solidports/base-ui`, two React 17 id titles to their Solid server-id titles).
- Skip evaluation: both conditions compile to functions over `isJSDOM`, `isBlink`, `isWebKit`, `isGecko` (React terms fixed to React 19). Free identifiers and feature atoms (`typeof Touch === 'undefined'`, `'onbeforematch' in window`, `platform.engine.*`, `direction === 'rtl'`) are enumerated over every boolean assignment. Solid skipping where upstream runs, in any of jsdom/chromium/firefox/webkit, is an "extra skip".
- `renderServer` count: each Solid file needs at least as many `renderServer(` calls as upstream has `renderToString(`, so a server-markup test cannot quietly become a client render.
- `NOT_APPLICABLE_TESTS`: three React Server Components titles, reported with a reason. A Solid test under one of those titles fails the check.
- `UNUSED_UTILS_MODULES`: `store/createSelector`, `store/createSelectorMemoized`, `useIdleCallback`. Their six test files are "not ported" until anything upstream uses the module, which then fails as a missing file.
- `--json <file>` writes the full report.

Current run (local, rc.15, 2026-10-16): 0 missing files, 0 missing tests, 0 extra skips, 0 markers, 0 client-rendered server tests; 3 Solid-only conditional tests (not counted), 6 not ported, 3 not applicable.

## `scripts/browser-parity.mjs` (CI: browser parity workflow)

Input: Vitest JSON reports of upstream's suite and the Solid suite in one browser. Keys are `<file without .test.tsx> :: <ancestor titles > title>`, with `floating-ui-react` mapped to `floating-ui-solid`.

- Solid-only failure: Solid fails, upstream does not fail (passes or has no such test). Failing in both counts as shared (browser or environment).
- `--confirm <browser>` reruns the files of Solid-only failures 10 times per suite (`CONFIRM_RUNS`). Confirmed means Solid failed every rerun and upstream passed at least one (or has no such test); the rest print as not confirmed, with both counts (Solid failed x/10, upstream passed y/10), and do not fail. The rule is `confirm()`, tested in `scripts/base-ui-browser-parity.test.ts`. On CI the reruns take about 22 s per pair, so 10 add about 7 minutes.
- Why every rerun: on CI's WebKit over 30 runs (to 98d6a238), upstream failed Popover's "keeps the popover open when a nested menu opens via pointer using a shared container" in 10 of 27 runs ('contained triggers'), 22 of 27 and 20 of 27 (the detached variants), and "should toggle closed with Enter or Space when rendering a <div>" in 4 of 27. With two reruns, a Solid test failing 60% of runs failed both by chance, which failed 98d6a238's check. With ten, for a 60%-vs-37% test, a Solid flake confirms with 0.6^10 (0.6%), and a deterministic Solid break goes unconfirmed only if upstream fails all ten reruns too, 0.37^10 (under 0.01%). Requiring upstream to pass every rerun would have hidden about 90% of real breaks on such tests (0.63^5 to pass five of five).
- Open finding: Solid fails the 'contained triggers' variant in 18 of 30 of those runs against upstream's 10 of 27, a gap present since the oldest run. It passes in Chromium and Firefox.
- Prints Solid failures, shared, Solid-only, not confirmed, and upstream failures Solid passes. Exit 1 on any confirmed Solid-only failure.

## Visual regressions (CI: Regression tests)

- `test/regressions-solid/run.mjs` serves the React host, then the Solid host, on port 5173, and runs upstream's unchanged `test/regressions` spec in Chromium (`xvfb-run` without a display). Screenshots land in `test/regressions-solid/screenshots/{react,solid}`.
- `scripts/compare-regressions.mjs`: pixelmatch (`threshold: 0.1`) per route; fails on a route over `REGRESSIONS_MAX_DIFF` (default 0.001 of pixels), a size change, or a missing side, unless `test/regressions-solid/accepted.json` lists the route with a reason. Diff images go to `screenshots/diff`.
- `accepted.json` holds 16 routes: demos with no Solid port (virtualized lists, react-hook-form, Motion) and preview-card demos with sub-pixel text shaping.

## Solid-only test files

476 Solid test and spec files; 59 have no upstream counterpart. The kinds that guard the perf rewrite:

| pattern | count | what it checks |
| --- | --- | --- |
| `*.parity.test.tsx` | 7 (Accordion, Checkbox, Collapsible, Radio, Switch, Tabs, Toggle) plus `utils/native/parity.test.tsx` | native fast path and slow path (`render="<same tag>"`) give identical normalized DOM, handler order and state changes; harness `packages/solid/test/parityHarness.tsx` |
| `*.cost.test.tsx` | 5 under `src/utils` | reactive-node budgets; see [perf method](../perf/method.md) |
| `*.stale-closure.test.tsx` | 5 (AlertDialog, Dialog, Menu, PreviewCard, Tooltip roots) | a swapped callback prop (`onOpenChange`) is the one invoked |

Others: `*.hydration.test.tsx` and `test/hydration/*`, `test/ssr/*`, `useRenderElement.*.test.tsx` (reactivity, stableProps, diagnostics), `SolidStoreV2.test.tsx`, `solid-helpers.test.tsx`, `SelectRoot.reactivity.test.tsx`, `test/package/exports.test.ts`.

## Test policy for the perf rewrite

The perf rewrite has one hard rule: every suite passes at every step.

- Upstream-mirrored tests (title-matched by `test-parity.mjs`), e2e, regressions, screen reader, docs hydration, public types and node resolution pass unchanged.
- A unit test may change only when it probes a low-level Solid internal that the step rewrites honestly: node budgets in `*.cost.test.tsx`, `useRenderElement.*` internals, `SolidStoreV2`, `solid-helpers`, native-kit parity mechanics. The change keeps the behavior the test protects and states why in the commit.
- Lowering a cost budget is the expected outcome of a perf step; raising one needs a reason.
- Never add `.skip`, `.todo`, `.fails` or a new `skipIf` to make a step pass; `test-parity.mjs` fails on them.
- Loop per step: red (a test or budget that fails for the named reason), fix, green, then every gate and `bun run test:base-ui:all`. See `.rulesync/reference/tdd.md` and `.claude/rules/standards.md`.

Related: [suites](suites.md), [quirks](quirks.md), [optimization map](../perf/optimization-map.md).
