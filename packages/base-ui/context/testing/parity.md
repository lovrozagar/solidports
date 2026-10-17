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
- `--confirm <browser>` reruns the files of Solid-only failures 10 times per suite (`CONFIRM_RUNS`). Confirmed means Solid failed every rerun and failed significantly more often than upstream: a one-sided Fisher exact p under 0.01 (`ALPHA`), or upstream has no such test. A failure Solid failed in every rerun whose p is not yet under 0.01 is inconclusive: the files of all such failures rerun 10 more times in one batch, and they are decided at 20 (`MAX_CONFIRM_RUNS`). The rest print as not confirmed and do not fail. Every line prints both counts and p (Solid failed x/n, upstream passed y/n, p). The rule is `confirm()`, tested in `scripts/base-ui-browser-parity.test.ts` (D12).
- Error rates per test: two looks at α = 0.01, so a failure that is not Solid's confirms at most about 2% of the time. A Solid flake failing 60% of runs fails all 10 reruns 0.6% of the time. A deterministic Solid break on a test upstream passes 63% of the time is confirmed at 20 reruns once upstream passes 7, which happens over 99% of the time. On CI the reruns take about 22 s per pair: about 4 minutes for the first stage, and about 4 more when any failure reaches the second.
- History: two reruns, with one passing upstream rerun enough, confirmed a Solid test failing 60% of runs by chance at 98d6a238. Ten reruns with the same rule then confirmed Popover's "should toggle closed with Enter or Space when rendering a <div>" at 75bdb4e3 (Solid failed 10/10, upstream passed 3/10, p 0.105).
- Known WebKit driver race, that test: both libraries move focus into the popup one frame after the open (`enqueueFocus`, one `requestAnimationFrame`, identical on both sides), and Playwright's WebKit presses several keys within one frame, so a shift-Tab in the frame of an open leaves the popup before it has focus. A frame counter on the Mac showed the same click-to-focus frame for both libraries in WebKit and Chromium; which cycle a run loses depends on frame alignment (upstream lost at its second Enter, Solid at its second Space).
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
| `*.parity.test.tsx` | 7 (Accordion, Checkbox, Collapsible, Radio, Switch, Tabs, Toggle) plus `utils/native/parity.test.tsx` | native fast path and slow path give identical normalized DOM, handler order and state changes; the harness (`packages/solid/test/parityHarness.tsx`) forces the slow side with a reactive `render` (a getter returning the case's form or the part's tag), since a static `render` may render natively (plan 3 leaf 5.1.2); the suites that build trees by hand keep `render="<same tag>"`, which stays slow for parts without a `render` check |
| `*.cost.test.tsx` | 5 under `src/utils` | reactive-node budgets; see [perf method](../perf/method.md) |
| `*.stale-closure.test.tsx` | 5 (AlertDialog, Dialog, Menu, PreviewCard, Tooltip roots) | a swapped callback prop (`onOpenChange`) is the one invoked |

Others: `*.hydration.test.tsx` and `test/hydration/*`, `test/ssr/*`, `useRenderElement.*.test.tsx` (reactivity, stableProps, diagnostics), `SolidStoreV2.test.tsx`, `solid-helpers.test.tsx`, `SelectRoot.reactivity.test.tsx`, `test/package/exports.test.ts`.

## Test policy for the perf rewrite

The perf rewrite has one hard rule: every suite passes at every step.

- Upstream-mirrored tests (title-matched by `test-parity.mjs`), e2e, regressions, screen reader, docs hydration, public types and node resolution pass unchanged.
- A unit test may change only when it probes a low-level Solid internal that the step rewrites honestly: node budgets in `*.cost.test.tsx`, `useRenderElement.*` internals, `SolidStoreV2`, `solid-helpers`, native-kit parity mechanics. The change keeps the behavior the test protects and states why in the commit.
- Lowering a cost budget is the expected outcome of a perf step; raising one needs a reason.
- One mirrored test is split by render path (2026-10-17, plan 3 leaf 5.1.2's fallout). In `CollapsiblePanel.test.tsx`, "keeps the measured size when an open animation finishes during a close commit" mocks `getAnimations` and requires an initially open panel to call it at mount. Upstream's mount-time `useOpenChangeComplete` makes that call.
  - A static render function now takes the native path. There the panel builds no open-complete watcher until its root's state first changes (5.1.2's mount win), so the call does not exist.
  - The upstream title keeps the original body, precondition included, on the slow path: `render={slow.render}`, whose getter keeps the slow path.
  - "keeps the measured size when a natively rendered panel created open closes" asserts the native path's outcome (px height after the close) and that nothing reads the animations at mount.
  - Building the watcher at mount was rejected: a frame and a `getAnimations` per initially open panel is the cost 5.1.2 removed, and nothing observable needs it.
- Never add `.skip`, `.todo`, `.fails` or a new `skipIf` to make a step pass; `test-parity.mjs` fails on them.
- Loop per step: red (a test or budget that fails for the named reason), fix, green, then every gate and `bun run test:base-ui:all`. See `.rulesync/reference/tdd.md` and `.claude/rules/standards.md`.

Related: [suites](suites.md), [quirks](quirks.md), [optimization map](../perf/optimization-map.md).
